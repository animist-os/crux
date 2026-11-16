import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import pkg from '@tonejs/midi';
import { midiToRepresentations, midiToVoices, midiFileToRepresentations,
  representationToNotes } from '../tools/midi-to-representations.js';
const { Midi } = pkg;
const sort = notes => [...notes].sort((a, b) => a.track - b.track || a.ticks - b.ticks || a.midi - b.midi);
const clean = notes => sort(notes).map(n => ({ track: n.track, midi: n.midi,
  ticks: Math.round(n.ticks), durationTicks: Math.round(n.durationTicks) }));

function makeMidi(tracks, tempos = []) {
  const midi = new Midi();
  midi.header.tempos = tempos;
  midi.header.update();
  tracks.forEach(notes => {
    const track = midi.addTrack();
    notes.forEach(note => track.addNote({ ...note, velocity: 0.7 }));
  });
  return midi.toArray();
}

test('all tracks and polyphonic notes survive, including pickups, gaps, ties and tempo changes', () => {
  const tracks = [
    [{ midi: 60, ticks: 240, durationTicks: 720 }, { midi: 67, ticks: 240, durationTicks: 240 },
      { midi: 64, ticks: 480, durationTicks: 480 }, { midi: 62, ticks: 1200, durationTicks: 160 }],
    [{ midi: 48, ticks: 0, durationTicks: 960 }, { midi: 50, ticks: 1440, durationTicks: 480 }],
  ];
  const buffer = makeMidi(tracks, [{ ticks: 0, bpm: 120 }, { ticks: 480, bpm: 60 }]);
  const results = midiToRepresentations(buffer);
  const expected = tracks.flatMap((notes, track) => notes.map(n => ({ ...n, track })));
  for (const result of results) {
    assert.deepEqual(clean(representationToNotes(result)), clean(expected));
    assert.equal(result.metadata.tempos.length, 2);
    assert.equal(result.metadata.noteCount, 6);
    assert.equal(result.metadata.voices.length, 3);
  }
  assert.throws(() => midiToRepresentations(buffer, { polyphony: 'reject' }), /Overlapping/);
});

test('explicit track, diatonic regime and tonic retain absolute pitch', () => {
  const notes = [60, 62, 64, 65, 67, 69, 71, 72].map((midi, i) => ({ midi, ticks: i * 480, durationTicks: 480 }));
  const buffer = makeMidi([[{ midi: 45, ticks: 0, durationTicks: 480 }], notes]);
  const results = midiToRepresentations(buffer, { track: 1, pitchRegime: 'Major', tonicMidi: 60 });
  for (const result of results) {
    assert.equal(result.metadata.pitchRegime, 'Major');
    assert.deepEqual(clean(representationToNotes(result)), clean(notes.map(n => ({ ...n, track: 1 }))));
  }
  const decoded = midiToVoices(buffer, { track: 1, pitchRegime: 'auto' });
  assert.equal(decoded.metadata.pitchRegime, 'Major');
  assert.deepEqual(decoded.voices[0].map(p => p.step), [0, 1, 2, 3, 4, 5, 6, 7]);
});

test('reject empty, invalid track, bad limits, and out-of-scale pitches', () => {
  assert.throws(() => midiToRepresentations(makeMidi([[]])), /No notes/);
  const buffer = makeMidi([[{ midi: 61, ticks: 0, durationTicks: 480 }]]);
  for (const track of [-1, 0.5, 10, NaN]) assert.throws(() => midiToRepresentations(buffer, { track }), /Track/);
  assert.throws(() => midiToRepresentations(buffer, { pitchRegime: 'bogus' }), /Unknown/);
  assert.throws(() => midiToRepresentations(buffer, { tonicMidi: -1 }), /tonicMidi/);
  assert.throws(() => midiToRepresentations(buffer, { maxNotes: 0 }), /maxNotes/);
  assert.throws(() => midiToRepresentations(buffer, { pitchRegime: 'Major', tonicMidi: 60 }), /outside/);
});

const fixtureDir = new URL('./fixtures/bach/', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', fixtureDir)));
for (const piece of manifest.pieces) {
  test(`Bach soprano ${piece.id}: every ranked result reproduces MusicXML-derived notes`, async () => {
    const results = await midiFileToRepresentations(new URL(`${piece.id}.mid`, fixtureDir), { pitchRegime: 'auto', topK: 3 });
    const expected = piece.notes.map(n => ({ ...n, track: 0 }));
    assert.ok(results[0].score.total > 0, 'Bach fixture should expose recurring structure');
    for (const result of results) {
      assert.deepEqual(clean(representationToNotes(result)), clean(expected));
    }
  });
}
