#!/usr/bin/env node
// Benchmark MIDI fixtures exported by export-bach-chorales.py, against XML events.
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import pkg from '@tonejs/midi';
import { midiToRepresentations, representationToNotes } from './midi-to-representations.js';
const { Midi } = pkg;
const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  controls: { type: 'boolean' }, limit: { type: 'string' }, output: { type: 'string' },
} });
if (positionals.length !== 1) throw new Error('Usage: node tools/benchmark-representations.js fixture-directory [--controls] [--limit N] [--output report.json]');
const limit = values.limit === undefined ? Infinity : Number(values.limit);
if (limit !== Infinity && (!Number.isSafeInteger(limit) || limit < 1)) throw new Error('limit must be a positive integer.');
const directory = positionals[0];
const manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8'));
const rows = [];
const options = { pitchRegime: 'auto', topK: 3 };
const order = notes => [...notes].sort((a, b) => a.ticks - b.ticks || a.midi - b.midi || a.durationTicks - b.durationTicks);
let randomState = 20260904;
function random() {
  randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
  return randomState / 2 ** 32;
}
for (const piece of manifest.pieces.slice(0, limit)) {
  try {
    const buffer = await fs.readFile(path.join(directory, `${piece.id}.mid`));
    const start = performance.now();
    const results = midiToRepresentations(buffer, options);
    const milliseconds = performance.now() - start;
    const expected = order(piece.notes);
    for (const result of results) {
      const actual = order(representationToNotes(result));
      if (actual.length !== expected.length || actual.some((note, i) =>
        ['midi', 'ticks', 'durationTicks'].some(k => Math.abs(note[k] - expected[i][k]) > 1e-6))) {
        throw new Error('MusicXML event mismatch');
      }
    }
    const best = results[0];
    const row = { id: piece.id, notes: expected.length, candidates: results.length,
      score: best.score.total, coverage: best.score.coverage, motifs: best.motifs.length, milliseconds };
    if (values.controls) {
      const midi = new Midi(buffer);
      const notes = midi.tracks.flatMap(t => t.notes);
      const pitches = notes.map(n => n.midi);
      for (let i = pitches.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [pitches[i], pitches[j]] = [pitches[j], pitches[i]];
      }
      notes.forEach((n, i) => { n.midi = pitches[i]; });
      const control = midiToRepresentations(midi.toArray(), { ...options, topK: 1 })[0];
      row.shuffledScore = control.score.total;
      row.shuffledCoverage = control.score.coverage;
    }
    rows.push(row);
  } catch (error) {
    rows.push({ id: piece.id, error: error.message });
  }
  if (rows.length % 50 === 0) process.stderr.write(`Checked ${rows.length} scores\n`);
}
const passed = rows.filter(r => !r.error);
const mean = key => passed.length ? passed.reduce((n, row) => n + row[key], 0) / passed.length : null;
const times = passed.map(r => r.milliseconds).sort((a, b) => a - b);
const summary = { tested: rows.length, passed: passed.length, failed: rows.length - passed.length,
  verifiedCandidates: passed.reduce((n, r) => n + r.candidates, 0),
  structured: passed.filter(r => r.score > 0).length,
  meanScore: mean('score'), meanCoverage: mean('coverage'),
  medianMilliseconds: times[Math.floor(times.length / 2)] ?? null,
  p95Milliseconds: times[Math.floor(times.length * 0.95)] ?? null,
  ...(values.controls ? { meanShuffledScore: mean('shuffledScore'), meanShuffledCoverage: mean('shuffledCoverage'),
    betterThanShuffled: passed.filter(r => r.score > r.shuffledScore).length } : {}),
};
const report = { options, controls: Boolean(values.controls), shuffleSeed: 20260904,
  source: manifest.source, policy: manifest.policy, skippedSources: manifest.skipped, summary, rows };
if (values.output) await fs.writeFile(values.output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
if (summary.failed) process.exitCode = 1;
