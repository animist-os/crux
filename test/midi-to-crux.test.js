import test from 'node:test';
import assert from 'node:assert/strict';
import pkg from '@tonejs/midi';
const { Midi } = pkg;
import {
  pitchesToSteps,
  findBaseDuration,
  durationsToTimeScales,
  quantizeTimeScale,
  detectRests,
  formatMot,
  midiToMot,
} from '../tools/midi-to-crux.js';

// --- pitchesToSteps ---

test('pitchesToSteps: ascending major scale from C4', () => {
  const pitches = [60, 62, 64, 65, 67, 69, 71, 72];
  assert.deepEqual(pitchesToSteps(pitches), [0, 2, 4, 5, 7, 9, 11, 12]);
});

test('pitchesToSteps: descending from G4', () => {
  const pitches = [67, 65, 64, 62, 60];
  assert.deepEqual(pitchesToSteps(pitches), [0, -2, -3, -5, -7]);
});

test('pitchesToSteps: single note', () => {
  assert.deepEqual(pitchesToSteps([60]), [0]);
});

test('pitchesToSteps: empty', () => {
  assert.deepEqual(pitchesToSteps([]), []);
});

test('pitchesToSteps: repeated pitch', () => {
  assert.deepEqual(pitchesToSteps([60, 60, 60]), [0, 0, 0]);
});

// --- findBaseDuration ---

test('findBaseDuration: uniform durations', () => {
  const base = findBaseDuration([0.5, 0.5, 0.5, 0.5]);
  assert.ok(Math.abs(base - 0.5) < 0.01);
});

test('findBaseDuration: mixed quarter and eighth', () => {
  // 6 quarter notes (0.5s) and 2 eighth notes (0.25s) — mode is 0.5
  const base = findBaseDuration([0.5, 0.5, 0.5, 0.25, 0.5, 0.5, 0.25, 0.5]);
  assert.ok(Math.abs(base - 0.5) < 0.01);
});

test('findBaseDuration: near-equal values cluster', () => {
  // Slightly varied durations that should cluster as one group
  const base = findBaseDuration([0.49, 0.51, 0.50, 0.48, 0.52]);
  assert.ok(Math.abs(base - 0.50) < 0.03);
});

test('findBaseDuration: empty returns 1', () => {
  assert.equal(findBaseDuration([]), 1);
});

// --- durationsToTimeScales ---

test('durationsToTimeScales: uniform yields all 1s', () => {
  assert.deepEqual(durationsToTimeScales([0.5, 0.5, 0.5, 0.5]), [1, 1, 1, 1]);
});

test('durationsToTimeScales: quarter and half notes', () => {
  // Base = 0.5 (quarter), half = 1.0 → timeScale 2
  const result = durationsToTimeScales([0.5, 0.5, 1.0, 0.5], 0.5);
  assert.deepEqual(result, [1, 1, 2, 1]);
});

test('durationsToTimeScales: quarter and eighth notes', () => {
  const result = durationsToTimeScales([0.5, 0.25, 0.25, 0.5], 0.5);
  assert.deepEqual(result, [1, 0.5, 0.5, 1]);
});

// --- quantizeTimeScale ---

test('quantizeTimeScale: exact values pass through', () => {
  assert.equal(quantizeTimeScale(1), 1);
  assert.equal(quantizeTimeScale(0.5), 0.5);
  assert.equal(quantizeTimeScale(2), 2);
});

test('quantizeTimeScale: near-fractions snap', () => {
  assert.equal(quantizeTimeScale(0.498), 0.5);
  assert.equal(quantizeTimeScale(1.98), 2);
  assert.equal(quantizeTimeScale(0.34), 1/3);
  assert.equal(quantizeTimeScale(0.26), 0.25);
});

test('quantizeTimeScale: values near known fractions snap', () => {
  assert.equal(quantizeTimeScale(1.234), 4/3); // within 10% of 4/3
  assert.equal(quantizeTimeScale(0.777), 0.75); // snaps to 3/4
});

test('quantizeTimeScale: true outliers round to 2 decimal places', () => {
  assert.equal(quantizeTimeScale(5.17), 5.17); // not within 10% of any snap fraction
});

// --- detectRests ---

test('detectRests: no gaps means no rests', () => {
  const notes = [
    { midi: 60, time: 0, duration: 0.5 },
    { midi: 62, time: 0.5, duration: 0.5 },
    { midi: 64, time: 1.0, duration: 0.5 },
  ];
  const result = detectRests(notes, 0.5);
  assert.equal(result.length, 3);
  assert.ok(result.every(r => !r.rest));
});

test('detectRests: gap produces rest entry', () => {
  const notes = [
    { midi: 60, time: 0, duration: 0.5 },
    { midi: 62, time: 1.5, duration: 0.5 },
  ];
  const result = detectRests(notes, 0.5);
  assert.equal(result.length, 3);
  assert.ok(result[1].rest);
  assert.ok(Math.abs(result[1].duration - 1.0) < 0.01);
});

test('detectRests: tiny gap ignored', () => {
  const notes = [
    { midi: 60, time: 0, duration: 0.5 },
    { midi: 62, time: 0.52, duration: 0.5 },  // 0.02s gap (< 10% of 0.5)
  ];
  const result = detectRests(notes, 0.5);
  assert.equal(result.length, 2);
});

test('detectRests: empty input', () => {
  assert.deepEqual(detectRests([], 0.5), []);
});

// --- formatMot ---

test('formatMot: simple steps, all timeScale 1', () => {
  const pips = [
    { step: 0, timeScale: 1 },
    { step: 2, timeScale: 1 },
    { step: 4, timeScale: 1 },
  ];
  assert.equal(formatMot(pips), '[0, 2, 4]');
});

test('formatMot: mixed timeScales', () => {
  const pips = [
    { step: 0, timeScale: 1 },
    { step: 2, timeScale: 0.5 },
    { step: 4, timeScale: 2 },
  ];
  assert.equal(formatMot(pips), '[0, 2 | /2, 4 | 2]');
});

test('formatMot: rests', () => {
  const pips = [
    { step: 0, timeScale: 1 },
    { step: 0, timeScale: 1, tag: 'r' },
    { step: 2, timeScale: 1 },
  ];
  assert.equal(formatMot(pips), '[0, r, 2]');
});

test('formatMot: rest with timeScale', () => {
  const pips = [
    { step: 0, timeScale: 1 },
    { step: 0, timeScale: 2, tag: 'r' },
    { step: 2, timeScale: 0.5 },
  ];
  assert.equal(formatMot(pips), '[0, r | 2, 2 | /2]');
});

test('formatMot: negative steps', () => {
  const pips = [
    { step: 0, timeScale: 1 },
    { step: -2, timeScale: 1 },
    { step: -5, timeScale: 1 },
  ];
  assert.equal(formatMot(pips), '[0, -2, -5]');
});

test('formatMot: 1/4 timeScale', () => {
  const pips = [
    { step: 0, timeScale: 0.25 },
    { step: 2, timeScale: 0.25 },
  ];
  assert.equal(formatMot(pips), '[0 | /4, 2 | /4]');
});

// --- round-trip integration: create MIDI → convert to Crux ---

test('round-trip: simple ascending scale', () => {
  const midi = new Midi();
  const track = midi.addTrack();
  track.addNote({ midi: 60, time: 0, duration: 0.5 });
  track.addNote({ midi: 62, time: 0.5, duration: 0.5 });
  track.addNote({ midi: 64, time: 1.0, duration: 0.5 });

  const buffer = Buffer.from(midi.toArray());
  const result = midiToMot(buffer);
  assert.equal(result, '[0, 2, 4]');
});

test('round-trip: mixed durations (quarter + eighth)', () => {
  const midi = new Midi();
  const track = midi.addTrack();
  // 4 quarter notes and 2 eighth notes
  track.addNote({ midi: 60, time: 0, duration: 0.5 });
  track.addNote({ midi: 62, time: 0.5, duration: 0.5 });
  track.addNote({ midi: 64, time: 1.0, duration: 0.25 });
  track.addNote({ midi: 65, time: 1.25, duration: 0.25 });
  track.addNote({ midi: 67, time: 1.5, duration: 0.5 });

  const buffer = Buffer.from(midi.toArray());
  const result = midiToMot(buffer);
  assert.equal(result, '[0, 2, 4 | /2, 5 | /2, 7]');
});

test('round-trip: with rest gap', () => {
  const midi = new Midi();
  const track = midi.addTrack();
  track.addNote({ midi: 60, time: 0, duration: 0.5 });
  // 0.5s gap here = rest
  track.addNote({ midi: 64, time: 1.0, duration: 0.5 });

  const buffer = Buffer.from(midi.toArray());
  const result = midiToMot(buffer);
  assert.equal(result, '[0, r, 4]');
});

test('round-trip: descending melody', () => {
  const midi = new Midi();
  const track = midi.addTrack();
  track.addNote({ midi: 72, time: 0, duration: 0.5 });
  track.addNote({ midi: 69, time: 0.5, duration: 0.5 });
  track.addNote({ midi: 67, time: 1.0, duration: 0.5 });
  track.addNote({ midi: 65, time: 1.5, duration: 0.5 });
  track.addNote({ midi: 64, time: 2.0, duration: 0.5 });
  track.addNote({ midi: 60, time: 2.5, duration: 1.0 });

  const buffer = Buffer.from(midi.toArray());
  const result = midiToMot(buffer);
  assert.equal(result, '[0, -3, -5, -7, -8, -12 | 2]');
});

test('round-trip: single note', () => {
  const midi = new Midi();
  const track = midi.addTrack();
  track.addNote({ midi: 60, time: 0, duration: 0.5 });

  const buffer = Buffer.from(midi.toArray());
  const result = midiToMot(buffer);
  assert.equal(result, '[0]');
});

test('round-trip: repeated pitch', () => {
  const midi = new Midi();
  const track = midi.addTrack();
  track.addNote({ midi: 60, time: 0, duration: 0.5 });
  track.addNote({ midi: 60, time: 0.5, duration: 0.5 });
  track.addNote({ midi: 60, time: 1.0, duration: 0.5 });

  const buffer = Buffer.from(midi.toArray());
  const result = midiToMot(buffer);
  assert.equal(result, '[0, 0, 0]');
});

test('midiToMot: throws on empty track', () => {
  const midi = new Midi();
  midi.addTrack(); // empty track

  const buffer = Buffer.from(midi.toArray());
  assert.throws(() => midiToMot(buffer), /No tracks with notes/);
});

test('midiToMot: track selection', () => {
  const midi = new Midi();
  midi.addTrack(); // track 0: empty
  const track1 = midi.addTrack(); // track 1: has notes
  track1.addNote({ midi: 60, time: 0, duration: 0.5 });
  track1.addNote({ midi: 64, time: 0.5, duration: 0.5 });

  const buffer = Buffer.from(midi.toArray());
  // Default: picks first track with notes (track 1)
  assert.equal(midiToMot(buffer), '[0, 4]');
  // Explicit track selection
  assert.equal(midiToMot(buffer, { track: 1 }), '[0, 4]');
  // Invalid track
  assert.throws(() => midiToMot(buffer, { track: 5 }), /Track 5 not found/);
});
