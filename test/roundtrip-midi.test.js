import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from '@tonejs/midi';
const { Midi } = pkg;
import {
  findRegime,
  chromaticToDiatonic,
  diatonicToChromatic,
  computeTonicMidi,
  midiNotesToDiatonic,
} from '../tools/find-regime.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIDI_DIR = path.join(__dirname, '..', 'corpus', 'midi_src');

/**
 * Extract a monophonic sequence of MIDI note numbers from a MIDI file buffer.
 * Takes the first track with notes, sorts by time, removes polyphonic overlaps.
 */
function extractMonophonicNotes(buffer) {
  const midi = new Midi(buffer);
  const track = midi.tracks.find(t => t.notes.length > 0);
  if (!track) throw new Error('No tracks with notes');

  const sorted = [...track.notes]
    .filter(n => n.duration > 0)
    .sort((a, b) => a.time - b.time || b.midi - a.midi);

  // Remove polyphonic overlaps (keep first at each onset)
  const mono = [];
  for (const note of sorted) {
    if (mono.length === 0) {
      mono.push(note);
      continue;
    }
    const prev = mono[mono.length - 1];
    if (note.time < prev.time + prev.duration - prev.duration * 0.15) continue;
    mono.push(note);
  }

  return mono.map(n => n.midi);
}


// --- computeTonicMidi unit tests ---

test('computeTonicMidi: tonic matches lowest note PC', () => {
  // Lowest note is C4 (60), tonicPc = 0 (C) → tonicMidi = 60
  assert.equal(computeTonicMidi([60, 62, 64, 65, 67], 0), 60);
});

test('computeTonicMidi: tonic below lowest note', () => {
  // Lowest note is E4 (64), tonicPc = 0 (C) → tonicMidi = 60 (C4)
  assert.equal(computeTonicMidi([64, 67, 69], 0), 60);
});

test('computeTonicMidi: tonic at same PC as lowest', () => {
  // Lowest note is G3 (55), tonicPc = 7 (G) → tonicMidi = 55
  assert.equal(computeTonicMidi([55, 57, 59, 60, 62], 7), 55);
});

test('computeTonicMidi: tonic one semitone below lowest', () => {
  // Lowest note is A3 (57), tonicPc = 8 (G#/Ab) → tonicMidi = 56
  assert.equal(computeTonicMidi([57, 60, 64], 8), 56);
});

test('computeTonicMidi: tonic 11 semitones below lowest', () => {
  // Lowest note is C4 (60), tonicPc = 1 (C#/Db) → tonicMidi = 49
  assert.equal(computeTonicMidi([60, 64, 67], 1), 49);
});


// --- midiNotesToDiatonic unit tests ---

test('midiNotesToDiatonic: C major scale from C4', () => {
  const notes = [60, 62, 64, 65, 67, 69, 71, 72];
  const diatonic = midiNotesToDiatonic(notes, 'Major', 60);
  assert.deepEqual(diatonic, [0, 1, 2, 3, 4, 5, 6, 7]);
});

test('midiNotesToDiatonic: G major scale from G3', () => {
  // G3=55, A3=57, B3=59, C4=60, D4=62, E4=64, F#4=66, G4=67
  const notes = [55, 57, 59, 60, 62, 64, 66, 67];
  const diatonic = midiNotesToDiatonic(notes, 'Major', 55);
  assert.deepEqual(diatonic, [0, 1, 2, 3, 4, 5, 6, 7]);
});

test('midiNotesToDiatonic: chromatic note returns null', () => {
  // C#4 (61) is not in C Major
  const diatonic = midiNotesToDiatonic([60, 61, 64], 'Major', 60);
  assert.equal(diatonic[0], 0);
  assert.equal(diatonic[1], null);
  assert.equal(diatonic[2], 2);
});


// --- Full round-trip tests for each corpus MIDI file ---

const midiFiles = fs.readdirSync(MIDI_DIR)
  .filter(f => f.endsWith('.mid'))
  .sort();

for (const file of midiFiles) {
  const melodyId = file.replace('.mid', '');

  test(`round-trip: ${melodyId}`, () => {
    const buffer = fs.readFileSync(path.join(MIDI_DIR, file));
    const midiNumbers = extractMonophonicNotes(buffer);

    assert.ok(midiNumbers.length > 0, `${melodyId}: should have notes`);

    // Step 1: detect regime from pitch classes
    const pitchClasses = [...new Set(midiNumbers.map(n => n % 12))];
    const { pitchRegime, tonicPc, confidence } = findRegime(pitchClasses);

    // Step 2: compute tonic MIDI number
    const tonicMidi = computeTonicMidi(midiNumbers, tonicPc);

    // Step 3: convert to diatonic and back
    const failures = [];
    for (let i = 0; i < midiNumbers.length; i++) {
      const originalMidi = midiNumbers[i];
      const chromaticOffset = originalMidi - tonicMidi;
      const diatonic = chromaticToDiatonic(chromaticOffset, pitchRegime);

      if (diatonic === null) {
        failures.push(
          `note ${i}: MIDI ${originalMidi} (pc=${originalMidi % 12}) ` +
          `chromatic offset ${chromaticOffset} not in ${pitchRegime} ` +
          `(tonic=${tonicPc}, tonicMidi=${tonicMidi})`
        );
        continue;
      }

      const recoveredChromatic = diatonicToChromatic(diatonic, pitchRegime);
      const recoveredMidi = tonicMidi + recoveredChromatic;

      if (recoveredMidi !== originalMidi) {
        failures.push(
          `note ${i}: MIDI ${originalMidi} → diatonic ${diatonic} → ` +
          `chromatic ${recoveredChromatic} → MIDI ${recoveredMidi} (expected ${originalMidi})`
        );
      }
    }

    assert.equal(failures.length, 0,
      `${melodyId} (${pitchRegime} tonic=${tonicPc} confidence=${confidence}):\n  ${failures.join('\n  ')}`);
  });
}
