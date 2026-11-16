#!/usr/bin/env node
// Fit a kernel: a few shared mots that approximate a score, written as Crux.
//
//   node tools/fit-kernel.js SCORE [--k1 8 --k2 0 --lossy 0.5 --invert --harmony] [--out x.kernel.crux]
//   node tools/fit-kernel.js SCORE --voices S          # the soprano alone
//   node tools/fit-kernel.js SCORE --sweep             # numbers vs fit, Pareto front
//
// --k2 0 skips measure shapes: phrases are found over beat figures, which keeps
// pickups with their phrase. --lossy P allows approximate repeats, priced at P
// numbers per quarter note of extra error.
//
// --out also writes <out>.json: the fit, the controls per level, and the wiggle
// reach of every step number (how many notes move when it goes up by one).
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadScore, scoreToVoices, directiveHeader, verifyAgainstScore } from '../src/score/index.js';
import { buildKernelMany, fitKernel } from '../src/kernel/kernel.js';
import { wiggleReach } from '../src/kernel/wiggle.js';

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  k1: { type: 'string' }, k2: { type: 'string' }, k3: { type: 'string' }, group3: { type: 'string' },
  invert: { type: 'boolean' }, harmony: { type: 'boolean' }, 'no-phrases': { type: 'boolean' },
  out: { type: 'string' }, sweep: { type: 'boolean' }, dir: { type: 'string' }, title: { type: 'string' },
  voices: { type: 'string' }, lossy: { type: 'string' },
} });
if (!positionals.length) throw new Error('Usage: node tools/fit-kernel.js SCORE... [--k1 N --k2 N --invert --harmony] [--out file] [--sweep]');

const titlesFile = path.join(import.meta.dirname, '../corpus/bach-chorale-titles.json');
const titles = fs.existsSync(titlesFile) ? JSON.parse(fs.readFileSync(titlesFile, 'utf8')).pieces : {};

function locate(id) {
  if (fs.existsSync(id)) return id;
  for (const ext of ['.mxl', '.xml', '.musicxml', '.mid', '.midi']) {
    const file = path.join(values.dir ?? '.', id + ext);
    if (fs.existsSync(file)) return file;
  }
  throw new Error(`Score ${id} not found`);
}

const pieces = positionals.map(id => {
  const score = loadScore(locate(id));
  const parts = score.parts.filter(p => p.role).length < 4 ? 'all' : 'satb';
  let converted = scoreToVoices(score, { lens: 'diatonic', parts });
  if (values.voices) {
    // Keep some voices: roles (S,A,T,B) or lane numbers from 1.
    const want = values.voices.split(',');
    const keep = converted.lanes.map((l, i) => i).filter(i => want.includes(converted.lanes[i].role) || want.includes(String(i + 1)));
    if (!keep.length) throw new Error(`no voice matches ${values.voices}`);
    converted = { ...converted, voices: keep.map(i => converted.voices[i]), lanes: keep.map(i => converted.lanes[i]) };
  }
  return { score, converted, label: positionals.length > 1 ? score.id : undefined };
});
const noteCount = pieces.reduce((n, p) => n + p.converted.voices.flat().filter(x => x.tag !== 'r').length, 0);
const stagger = pieces.length > 1;
const fitOf = k => fitKernel(k.code, k.voices, { enters: k.enters });
const describe = o => `k1=${o.k1} k2=${o.k2}${o.invert ? ' invert' : ''}${o.harmony ? ' harmony' : ''}${o.lossy != null ? ' lossy=' + o.lossy : ''}`;

if (values.sweep) {
  const rows = [];
  for (const k1 of [2, 4, 8, 16, 32]) for (const k2 of [0, 4, 8, 16, 32, 64, 128]) {
    if (k2 && k2 < k1) continue;
    for (const invert of [false, true]) for (const lossy of [null, 2, 1, 0.5, 0.25]) {
      const o = { k1, k2, invert, stagger, ...(lossy != null && { lossy }) };
      const k = buildKernelMany(pieces, o);
      rows.push({ ...o, controls: k.controls.total, ...fitOf(k) });
    }
  }
  rows.sort((a, b) => a.controls - b.controls || b.pitch - a.pitch);
  let best = -1;
  console.log(`${pieces.map(p => p.score.id).join(', ')}${values.voices ? ' (' + values.voices + ')' : ''}: ${noteCount} notes. Pareto front (numbers vs pitch fit):\n`);
  console.log('| numbers | per note | pitch fit | notes fit | settings |\n|---|---|---|---|---|');
  for (const r of rows) {
    if (r.pitch <= best + 1e-9) continue;
    best = r.pitch;
    console.log(`| ${r.controls} | ${(r.controls / noteCount).toFixed(2)} | ${r.pitch.toFixed(3)} | ${r.notes.toFixed(3)} | ${describe(r)} |`);
  }
  process.exit(0);
}

const options = {
  k1: Number(values.k1 ?? 8), k2: Number(values.k2 ?? 0), k3: Number(values.k3 ?? 0), group3: Number(values.group3 ?? 2),
  invert: !!values.invert, harmony: !!values.harmony, phrases: !values['no-phrases'], stagger,
  ...(values.lossy != null && { lossy: Number(values.lossy) }),
};
const kernel = buildKernelMany(pieces, options);
const fit = fitOf(kernel);
// Crux reads ';' as a separator even inside comments, so header lines avoid it.
const levels = kernel.controls.perLevel.map(l => `${l.level} ${l.prototypes} mots ${l.numbers} numbers`).join(', ');
const lines = [];
if (pieces.length === 1) {
  const { score, converted } = pieces[0];
  lines.push(directiveHeader({ ...converted.metadata, title: values.title ?? `${score.id}: ${titles[score.id]?.title ?? score.title ?? score.id}` }));
} else {
  lines.push(`// ${values.title ?? 'Kernel for ' + pieces.length + ' pieces'}. One set of mots for every voice of every piece.`);
  lines.push('// #lens diatonic (steps are scale degrees from each piece\'s own tonic)');
  for (const { score, converted } of pieces) lines.push(`// ${score.id} (${titles[score.id]?.title ?? score.title ?? ''}): tonic pc ${converted.metadata.tonicPc}, ${converted.metadata.pitchRegime}, tonicMidi ${converted.metadata.tonicMidi}`);
}
lines.push(`// kernel ${describe(options)}: ${kernel.controls.total} numbers for ${noteCount} notes (${levels}, voice lines ${kernel.controls.top})`);
lines.push(`// fit: ${(100 * fit.pitch).toFixed(1)}% of sounding time at the right pitch, ${(100 * fit.notes).toFixed(1)}% of notes struck right, ${(100 * fit.extra).toFixed(1)}% extra onsets`);
const code = `${lines.join('\n')}\n${kernel.code}\n`;
const wiggle = wiggleReach(code);
const s = wiggle.summary;
const summary = `wiggle: ${s.params} step numbers. Raising one moves ${s.median} notes (median), ${s.mean.toFixed(1)} (mean), up to ${s.max}. ${s.wide} move 10 or more notes, ${s.multiVoice} move more than one voice`;
const text = code.replace(/^(\/\/ fit:.*)$/m, `$1\n// ${summary}`);
// The file as written must read back to the same fit.
const check = fitKernel(text, kernel.voices, { enters: kernel.enters });
if (Math.abs(check.pitch - fit.pitch) > 1e-12 || Math.abs(check.notes - fit.notes) > 1e-12) throw new Error('written kernel does not read back');
// Exact means every note matches the score in MIDI pitch, onset and duration.
const exact = pieces.length === 1 && verifyAgainstScore(text, pieces[0].converted);
if (values.out) {
  fs.writeFileSync(values.out, text);
  const knobs = [...wiggle.params].sort((a, b) => b.moved - a.moved);
  fs.writeFileSync(values.out.replace(/\.crux$/, '') + '.json', JSON.stringify({
    pieces: pieces.map(p => p.score.id), notes: noteCount, options, fit, exact, controls: kernel.controls, wiggle: s,
    // Line numbers refer to the .crux file (header included).
    knobs: knobs.map(k => ({ line: k.line + 1, column: k.column, text: k.text, def: k.def, moved: k.moved, voices: k.voices })),
  }, null, 1) + '\n');
}
console.log(values.out ? `${values.out}: ` : '', `${kernel.controls.total} numbers, pitch ${fit.pitch.toFixed(3)}, notes ${fit.notes.toFixed(3)}${exact ? ', exact' : ''}. ${summary}`);
if (!values.out) console.log(text);
