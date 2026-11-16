#!/usr/bin/env node
/** Lossless note-event MIDI adapter for the bounded Crux vocabulary search. */
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import pkg from '@tonejs/midi';
import { findRepresentations } from '../src/representations.js';
import { findRegime, chromaticToDiatonic, diatonicToChromatic, computeTonicMidi,
  REGIME_PITCH_CLASSES } from './find-regime.js';
const { Midi } = pkg;

/**
 * Decode all note-bearing tracks by default. Within a track, interval partitioning
 * creates non-overlapping lanes without dropping notes. These are mechanical
 * lanes, not an inference of contrapuntal voices. Tick time is tempo-independent.
 */
export function midiToVoices(buffer, options = {}) {
  const midi = new Midi(buffer);
  const { track = null, polyphony = 'split', pitchRegime = '12Tone', tonicMidi = null } = options;
  if (!['split', 'reject'].includes(polyphony)) throw new Error('polyphony must be split or reject.');
  if (track !== null && (!Number.isInteger(track) || track < 0 || !midi.tracks[track])) {
    throw new Error(`Track ${track} not found.`);
  }
  if (tonicMidi !== null && (!Number.isInteger(tonicMidi) || tonicMidi < 0 || tonicMidi > 127)) {
    throw new Error('tonicMidi must be a MIDI number from 0 to 127.');
  }
  if (!['12Tone', 'auto'].includes(pitchRegime) && !REGIME_PITCH_CLASSES[pitchRegime]) {
    throw new Error(`Unknown pitchRegime: ${pitchRegime}`);
  }
  const tracks = midi.tracks.map((t, index) => ({ track: t, index }))
    .filter(t => track === null ? t.track.notes.length : t.index === track);
  const allNotes = tracks.flatMap(t => t.track.notes);
  if (!allNotes.length) throw new Error('No notes in selected MIDI tracks.');
  const maxNotes = options.maxNotes ?? 4096;
  if (!Number.isSafeInteger(maxNotes) || maxNotes < 1) throw new Error('maxNotes must be a positive integer.');
  if (allNotes.length > maxNotes) throw new Error(`MIDI exceeds maxNotes (${maxNotes}); select a track or raise the limit.`);
  if (allNotes.some(n => !Number.isSafeInteger(n.ticks) || n.ticks < 0 ||
      !Number.isSafeInteger(n.durationTicks) || n.durationTicks <= 0)) {
    throw new Error('MIDI notes must have non-negative tick onsets and positive tick durations.');
  }
  if (!Number.isSafeInteger(midi.header.ppq) || midi.header.ppq <= 0) throw new Error('Expected PPQ MIDI timing.');
  const regime = pitchRegime === 'auto'
    ? findRegime(allNotes.map(n => n.midi % 12), tonicMidi === null ? null : tonicMidi % 12)
    : { pitchRegime, confidence: 'explicit' };
  const tonic = tonicMidi ?? (regime.pitchRegime === '12Tone' ? allNotes[0].midi
    : computeTonicMidi(allNotes.map(n => n.midi), regime.tonicPc ?? 0));
  const lanes = [];
  const expectedNotes = [];
  for (const { track: source, index } of tracks) {
    const trackLanes = [];
    for (const note of [...source.notes].sort((a, b) => a.ticks - b.ticks || b.midi - a.midi)) {
      let lane = trackLanes.find(l => l.end <= note.ticks);
      if (!lane) {
        if (polyphony === 'reject' && trackLanes.length) throw new Error(`Overlapping notes in track ${index}.`);
        lane = { end: 0, pips: [], track: index, channel: source.channel, name: source.name,
          lane: trackLanes.length, noteCount: 0 };
        trackLanes.push(lane);
      }
      const step = chromaticToDiatonic(note.midi - tonic, regime.pitchRegime);
      if (step === null) throw new Error(`MIDI note ${note.midi} is outside ${regime.pitchRegime}; use 12Tone or auto.`);
      if (note.ticks > lane.end) lane.pips.push({ step: 0, tag: 'r', timeScale: (note.ticks - lane.end) / midi.header.ppq });
      lane.pips.push({ step, timeScale: note.durationTicks / midi.header.ppq });
      lane.noteCount++;
      lane.end = note.ticks + note.durationTicks;
      expectedNotes.push({ track: index, channel: source.channel, midi: note.midi,
        ticks: note.ticks, durationTicks: note.durationTicks });
    }
    lanes.push(...trackLanes);
  }
  return {
    voices: lanes.map(l => l.pips), expectedNotes,
    metadata: { ppq: midi.header.ppq, tonicMidi: tonic, pitchRegime: regime.pitchRegime,
      regimeConfidence: regime.confidence, noteCount: allNotes.length,
      tempos: midi.header.tempos, timeSignatures: midi.header.timeSignatures,
      voices: lanes.map(({ pips, end, ...info }) => info) },
  };
}

/** Recover absolute MIDI note events from a candidate (velocity/controllers excluded). */
export function representationToNotes(candidate) {
  const { metadata } = candidate;
  const sections = globalThis.golden.crux_interp(candidate.code).sections;
  if (sections.length !== metadata.voices.length) throw new Error('Representation voice count mismatch.');
  return sections.flatMap((section, i) => {
    let ticks = 0;
    const events = [];
    for (const pip of section.values) {
      const durationTicks = pip.timeScale * metadata.ppq;
      if (pip.tag !== 'r') events.push({ track: metadata.voices[i].track, channel: metadata.voices[i].channel,
        midi: metadata.tonicMidi + diatonicToChromatic(pip.step, metadata.pitchRegime),
        ticks, durationTicks });
      ticks += durationTicks;
    }
    return events;
  });
}

const orderNotes = notes => [...notes].sort((a, b) => a.track - b.track || a.channel - b.channel ||
  a.ticks - b.ticks || a.midi - b.midi || a.durationTicks - b.durationTicks);

/** Buffer/Uint8Array -> ranked list. Every result reconstructs the selected note events. */
export function midiToRepresentations(buffer, options = {}) {
  const { voices, metadata, expectedNotes } = midiToVoices(buffer, options);
  const expected = orderNotes(expectedNotes);
  const candidates = findRepresentations(voices, options).map(candidate => ({
    ...candidate,
    code: `// #pitchRegime ${metadata.pitchRegime}\n// #tonic ${metadata.tonicMidi % 12}\n${candidate.code}`,
    metadata,
  }));
  for (const candidate of candidates) {
    const actual = orderNotes(representationToNotes(candidate));
    if (actual.length !== expected.length || actual.some((n, i) =>
      Object.keys(n).some(key => Math.abs(n[key] - expected[i][key]) > 1e-6))) {
      throw new Error('Internal error: representation failed MIDI note-event round-trip.');
    }
  }
  return candidates;
}

/** File path -> ranked list; use midiToRepresentations for uploaded bytes. */
export async function midiFileToRepresentations(filePath, options = {}) {
  return midiToRepresentations(await fs.readFile(filePath), options);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { values, positionals } = parseArgs({ allowPositionals: true, options: {
      track: { type: 'string' }, 'top-k': { type: 'string' }, 'pitch-regime': { type: 'string' },
      'tonic-midi': { type: 'string' }, 'max-vocabulary': { type: 'string' },
      'max-motif-length': { type: 'string' }, 'reject-polyphony': { type: 'boolean' },
      json: { type: 'boolean' }, help: { type: 'boolean' },
    } });
    if (values.help) {
      console.log('Usage: node tools/midi-to-representations.js file.mid [--track N] [--top-k 5] [--pitch-regime auto|12Tone|Major|Minor] [--tonic-midi N] [--max-vocabulary 3] [--max-motif-length 12] [--reject-polyphony] [--json]');
    } else {
      if (positionals.length !== 1) throw new Error('Supply one MIDI file; use --help for options.');
      const options = {};
      for (const [flag, key] of [['track', 'track'], ['top-k', 'topK'], ['tonic-midi', 'tonicMidi'],
        ['max-vocabulary', 'maxVocabulary'], ['max-motif-length', 'maxMotifLength']]) {
        if (values[flag] !== undefined) options[key] = Number(values[flag]);
      }
      if (values['pitch-regime']) options.pitchRegime = values['pitch-regime'];
      if (values['reject-polyphony']) options.polyphony = 'reject';
      const results = await midiFileToRepresentations(positionals[0], options);
      if (values.json) console.log(JSON.stringify(results, null, 2));
      else results.forEach((r, i) => console.log(`\n// Candidate ${i + 1}: score ${r.score.total.toFixed(3)}, coverage ${(100 * r.score.coverage).toFixed(1)}%, ${r.motifs.length} motifs\n${r.code}`));
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
