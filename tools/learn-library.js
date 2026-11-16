#!/usr/bin/env node
// Corpus-level motif library ("Bach's vocabulary"), with a held-out evaluation.
//
//   node tools/learn-library.js ../media/music_xml/bach --out corpus/chorale-library
//
// Every 4th score (sorted by name) is held out. The library is learned from the
// rest by one grammar over all their voices; definitions used by >= --min-pieces
// pieces are kept. Held-out pieces are then refactored with and without it.
// Writes <out>.crux (the library), <out>.json (stats and evaluation), and with
// --example ID, <out>.ID.crux: that held-out piece written against the library.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadScore, scoreToVoices, verifyAgainstScore, directiveHeader } from '../src/score/index.js';
import { refactorVoices, learnLibrary } from '../src/refactor/grammar.js';

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  out: { type: 'string' }, 'min-pieces': { type: 'string' }, limit: { type: 'string' }, 'test-limit': { type: 'string' },
  all: { type: 'boolean' }, example: { type: 'string', multiple: true },
} });
if (positionals.length !== 1) throw new Error('Usage: node tools/learn-library.js DIR [--out prefix] [--min-pieces 3] [--limit N] [--test-limit N]');
const dir = positionals[0];
const files = fs.readdirSync(dir).filter(f => /\.(mxl|xml|musicxml)$/i.test(f)).sort();
const pieces = [];
for (const f of files) {
  try {
    const score = loadScore(path.join(dir, f));
    pieces.push({ id: score.id, converted: scoreToVoices(score, { lens: 'diatonic' }) });
  } catch { /* not SATB */ }
}
// --all: learn from every piece and describe the whole corpus (library + every piece).
const train = (values.all ? pieces : pieces.filter((_, i) => i % 4 !== 3)).slice(0, values.limit ? Number(values.limit) : Infinity);
const test = (values.all ? pieces : pieces.filter((_, i) => i % 4 === 3)).slice(0, values['test-limit'] ? Number(values['test-limit']) : Infinity);
let t0 = performance.now();
const library = learnLibrary(train.map(p => p.converted.voices), { minPieces: Number(values['min-pieces'] ?? 3) });
const learnMs = performance.now() - t0;
console.error(`library: ${library.defs.size} definitions from ${train.length} pieces, ${Math.round(library.bits)} bits, ${Math.round(learnMs / 1000)} s`);

t0 = performance.now();
const rows = [];
for (const p of test) {
  const plain = refactorVoices(p.converted.voices, { streams: 'joint' });
  const withLib = refactorVoices(p.converted.voices, { streams: 'joint', library });
  rows.push({ id: p.id, literalBits: plain.literalBits, bits: plain.bits, libraryBits: withLib.bits,
    libraryUses: withLib.libraryUses, localDefs: withLib.defs,
    verified: plain.verified && withLib.verified && verifyAgainstScore(withLib.code, p.converted) });
  if (rows.length % 10 === 0) console.error(`${rows.length}/${test.length}`);
}
const sum = k => rows.reduce((n, r) => n + r[k], 0);
const summary = {
  mode: values.all ? 'whole corpus (in-sample)' : 'held out (every 4th score)',
  trainPieces: train.length, testPieces: test.length, librarySize: library.defs.size, libraryBits: library.bits,
  learnSeconds: learnMs / 1000, evalSeconds: (performance.now() - t0) / 1000,
  verified: rows.filter(r => r.verified).length,
  literalBits: sum('literalBits'), perPieceBits: sum('bits'), withLibraryBits: sum('libraryBits'),
  savingPerPiece: 1 - sum('bits') / sum('literalBits'),
  savingWithLibrary: 1 - sum('libraryBits') / sum('literalBits'),
  libraryGainOnHeldOut: 1 - sum('libraryBits') / sum('bits'),
  // Breakeven: pieces needed before the library pays for its own text.
  breakevenPieces: sum('bits') > sum('libraryBits') ? library.bits / ((sum('bits') - sum('libraryBits')) / rows.length) : null,
  // Whole description: library text once, plus every piece written against it.
  corpusSavingWithLibraryText: 1 - (sum('libraryBits') + library.bits) / sum('literalBits'),
};
console.table(summary);
for (const id of values.example ?? []) {
  const p = test.find(x => x.id === id);
  if (!p) throw new Error(`--example ${id} is not among the evaluated pieces`);
  const labels = p.converted.lanes.map(l => l.role);
  const plain = refactorVoices(p.converted.voices, { voiceLabels: labels });
  const r = refactorVoices(p.converted.voices, { voiceLabels: labels, library });
  if (!r.verified || !verifyAgainstScore(r.code, p.converted)) throw new Error(`${id} with library failed verification`);
  const libLines = r.code.split('\n').filter(l => /^L\d+ = /.test(l));
  const text = `${directiveHeader(p.converted.metadata)}\n` +
    `// ${id} written against the corpus library (${library.defs.size} entries learned from ${train.length} other chorales).\n` +
    `// The ${libLines.length} library entries it uses are listed first; they are shared, so the piece's own text\n` +
    `// is everything after them: ${Math.round(r.bits)} bits, against ${Math.round(plain.bits)} without the library and ${Math.round(plain.literalBits)} literal.\n` +
    `${r.code}\n`;
  if (values.out) fs.writeFileSync(`${values.out}.${id}.crux`, text);
  console.error(`${id}: ${Math.round(r.bits)} bits with library, ${Math.round(plain.bits)} without, ${r.libraryUses} library uses`);
}
if (values.out) {
  const lines = library.code.split('\n');
  const stat = new Map(library.stats.map(s => [s.name, s]));
  const annotated = lines.map(l => {
    const s = stat.get(l.split(' = ')[0]);
    const where = s && s.pieces <= 6 ? ` (${s.pieceIndices.map(i => train[i].id).join(', ')})` : '';
    return `${l}${s ? `   // ${s.length} notes, in ${s.pieces} of ${train.length} chorales${where}, ${s.uses} uses` : ''}`;
  });
  fs.writeFileSync(`${values.out}.crux`, `// Motif library learned from ${train.length} Bach chorales (diatonic lens, all four voices).\n` +
    `// Scale-degree steps; durations in quarter notes. Each line: notes, pieces using it, total uses.\n${annotated.join('\n')}\n`);
  fs.writeFileSync(`${values.out}.json`, JSON.stringify({ summary, train: train.map(p => p.id), test: test.map(p => p.id),
    stats: library.stats.map(s => ({ ...s, pieceIds: s.pieceIndices.map(i => train[i].id) })), rows }, null, 1) + '\n');
}
