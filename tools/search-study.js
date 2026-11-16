#!/usr/bin/env node
// How much does extra search effort buy? Bits and time for several search
// strategies over the same chorales (diatonic lens, joint streams, all voices).
//
//   node tools/search-study.js ../media/music_xml/bach --limit 24 --output runs/search-study.json
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadScore, scoreToVoices, verifyAgainstScore } from '../src/score/index.js';
import { refactorVoices } from '../src/refactor/grammar.js';

const STRATEGIES = {
  greedy: {},
  'beam 2x2': { beamWidth: 2, branching: 2 },
  'beam 4x4': { beamWidth: 4, branching: 4 },
  'beam 8x8': { beamWidth: 8, branching: 8 },
  'restarts 4': { restarts: 4 },
  'restarts 16': { restarts: 16 },
  'beam 4x4 + restarts 4': { beamWidth: 4, branching: 4, restarts: 4 },
  'no re-parse': { reparse: false },
  'variants (@ edits)': { variants: true },
  'min motif length 3': { minLength: 3 },
  'max motif length 16': { maxLength: 16 },
};

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  limit: { type: 'string' }, output: { type: 'string' }, only: { type: 'string' },
} });
const dir = positionals[0];
const files = fs.readdirSync(dir).filter(f => /\.(mxl|xml)$/i.test(f)).sort();
// Spread the sample over the corpus: every k-th score.
const limit = Number(values.limit ?? 24);
const step = Math.max(1, Math.floor(files.length / limit));
const pieces = [];
for (let i = 0; i < files.length && pieces.length < limit; i += step) {
  try { pieces.push(scoreToVoices(loadScore(path.join(dir, files[i])), { lens: 'diatonic' })); } catch { /* skip non-SATB */ }
}
const names = values.only ? values.only.split(',') : Object.keys(STRATEGIES);
const results = {};
for (const name of names) {
  let bits = 0, literal = 0, ms = 0, verified = 0;
  for (const converted of pieces) {
    const t0 = performance.now();
    const r = refactorVoices(converted.voices, { streams: 'joint', ...STRATEGIES[name] });
    ms += performance.now() - t0;
    bits += r.bits; literal += r.literalBits;
    verified += r.verified && verifyAgainstScore(r.code, converted);
  }
  results[name] = { pieces: pieces.length, verified, bits, literalBits: literal, saving: 1 - bits / literal, msPerPiece: ms / pieces.length };
  console.error(`${name}: ${(100 * (1 - bits / literal)).toFixed(2)}% saving, ${Math.round(ms / pieces.length)} ms/piece`);
}
const greedy = results.greedy?.bits;
console.table(Object.fromEntries(Object.entries(results).map(([k, r]) => [k, {
  'saving %': (100 * r.saving).toFixed(2), 'bits vs greedy %': greedy ? (100 * (r.bits / greedy - 1)).toFixed(2) : '',
  'ms/piece': Math.round(r.msPerPiece), verified: `${r.verified}/${r.pieces}` }])));
if (values.output) fs.writeFileSync(values.output, JSON.stringify({ date: new Date().toISOString(), strategies: STRATEGIES, results }, null, 1) + '\n');
