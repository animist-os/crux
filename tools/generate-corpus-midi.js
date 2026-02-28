#!/usr/bin/env node

/**
 * Generate MIDI files from the corpus YAML.
 *
 * Reads corpus/melodies.yaml, parses each Crux string,
 * converts diatonic steps back to chromatic semitones using
 * the melody's pitchRegime, and writes a .mid file to corpus/.
 *
 * Usage:
 *   node tools/generate-corpus-midi.js
 */

import fs from 'node:fs';
import { parse as parseYaml } from 'yaml';
import pkg from '@tonejs/midi';
const { Midi } = pkg;
import { diatonicToChromatic } from './find-regime.js';

// Import Crux interpreter
import '../src/index.js';
const { parse } = golden;

const BPM = 120;
const QUARTER_NOTE_SEC = 60 / BPM; // 0.5 seconds

function generateMidi(melody) {
  // Parse the Crux string
  const prog = parse(melody.crux);
  const result = prog.interp();
  const mot = result.sections[result.sections.length - 1];

  const rootMidi = melody.tonic;
  const regime = melody.pitchRegime;

  const midi = new Midi();
  midi.header.setTempo(BPM);
  midi.header.name = melody.name;

  const track = midi.addTrack();
  track.name = melody.name;

  let time = 0; // in seconds

  for (const pip of mot.values) {
    const duration = Math.abs(pip.timeScale) * QUARTER_NOTE_SEC;

    if (pip.tag === 'r') {
      // Rest: advance time without adding a note
      time += duration;
      continue;
    }

    // Convert diatonic step to chromatic semitones
    const chromaticStep = diatonicToChromatic(pip.step, regime);
    const midiNote = rootMidi + chromaticStep;
    // Clamp to valid MIDI range
    const clamped = Math.max(0, Math.min(127, midiNote));

    track.addNote({
      midi: clamped,
      time: time,
      duration: duration,
      velocity: 0.7,
    });

    time += duration;
  }

  return midi;
}

// Main
const corpusPath = new URL('../corpus/melodies.yaml', import.meta.url).pathname;
const corpusYaml = fs.readFileSync(corpusPath, 'utf-8');
const corpus = parseYaml(corpusYaml);

let count = 0;
for (const melody of corpus.melodies) {
  const midi = generateMidi(melody);
  const outPath = new URL(`../corpus/midi_src/${melody.id}.mid`, import.meta.url).pathname;
  fs.writeFileSync(outPath, Buffer.from(midi.toArray()));
  const pips = parse(melody.crux).interp().sections.at(-1).values.length;
  console.log(`  ${melody.id}.mid (${pips} pips, ${melody.pitchRegime})`);
  count++;
}

console.log(`\nGenerated ${count} MIDI files in corpus/midi_src/`);
