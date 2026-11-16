#!/usr/bin/env node
// Atoms report: which 1-3 pip atoms, under which Crux operators, generate the
// chorale surfaces once the refactoring search may use generators.
//
//   node tools/atom-report.js ../media/music_xml/bach --out docs/atoms
//
// Every program is verified against its score. Writes <out>.md and <out>.json.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadScore, scoreToVoices, verifyAgainstScore } from '../src/score/index.js';
import { refactorVoices, pipBits } from '../src/refactor/grammar.js';
import { buildGenerators, genText, specText } from '../src/refactor/generators.js';
import { cruxNumber } from '../src/score/to-crux.js';
import { programBits } from '../src/refactor/cost.js';

const bitsCache = new Map();
/** Bits of a generator's text at a stream anchor (same accounting as the search). */
function specTextBits(spec, anchor) {
  const text = specText(spec, anchor);
  if (!bitsCache.has(text)) bitsCache.set(text, programBits(text).bits);
  return bitsCache.get(text);
}

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  out: { type: 'string' }, limit: { type: 'string' }, example: { type: 'string' },
} });
if (positionals.length !== 1) throw new Error('Usage: node tools/atom-report.js DIR [--out prefix] [--limit N] [--example bwvNNN]');
const dir = positionals[0];
const limit = values.limit ? Number(values.limit) : Infinity;
const files = fs.readdirSync(dir).filter(f => /\.(mxl|xml)$/i.test(f)).sort();
const step = Number.isFinite(limit) ? Math.max(1, Math.floor(files.length / limit)) : 1;

let t0 = performance.now();
const generators = buildGenerators();
const buildSeconds = (performance.now() - t0) / 1000;
console.error(`dictionary: ${generators.size} surfaces in ${buildSeconds.toFixed(1)} s`);

const num = cruxNumber;
const atoms = new Map(), families = new Map(), expressions = new Map();
const totals = { pieces: 0, verified: 0, literalBits: 0, plainBits: 0, genBits: 0, notes: 0, genNotes: 0 };
let example = null;
const bump = (map, key, init) => { if (!map.has(key)) map.set(key, init()); return map.get(key); };

/** The atom of a fan, as text at step 0 (parenthesized unless it is a postfix form). */
function fanAtomText(atom) {
  if (!atom.g) return '[' + atom.rel.map(p => p.t === 1 ? num(p.s) : `${num(p.s)} | ${num(p.t)}`).join(', ') + ']';
  const text = genText(atom.g, -atom.g.pips[0].s);
  const postfix = atom.g.suffixes.length === 0 || (atom.g.suffixes.length === 1 && (atom.g.suffixes[0] === '/' || atom.g.suffixes[0].startsWith(':')));
  return postfix ? text : `(${text})`;
}

/** Role and template for factorizations; marks paths that are themselves generated. */
function pathed(spec, role, before, after) {
  const generated = spec.pathGen && (spec.type === 'fan' ? specText(spec).includes(' * (') : specText(spec).startsWith('('));
  const path = generated ? `(${genText(spec.pathGen, -spec.pathGen.pips[0].s)})` : (spec.type === 'fan' ? '[path]' : '[skeleton]');
  return { role: generated ? `${role}, generated path` : role, template: `${before}${path}${after}` };
}

/** The atom (contour + rhythm), role and readable template of a generator item. */
function describe(spec) {
  if (spec.type === 'dict') {
    const g = spec.g;
    const rhythm = g.weights ? `weights ${g.weights.join(':')}` : 'even';
    return { contour: g.atom.map(num).join(' '), rhythm, role: g.family, template: genText(g, 0) };
  }
  if (spec.type === 'fan') {
    const rel = spec.atom.rel;
    return { contour: rel.map(p => num(p.s)).join(' '), rhythm: rel.map(p => num(p.t)).join(' '),
      ...pathed(spec, `atom * path (${spec.offsets.length} steps)`, `${fanAtomText(spec.atom)} * `, '') };
  }
  const nested = spec.mask.find(e => !e.plain);
  const mask = spec.mask.map(e => e.plain ? '0' : 'N').join(', ');
  return { contour: nested.rel.map(num).join(' '), rhythm: `weights ${nested.w.join(':')}`,
    ...pathed(spec, `skeleton . [${mask}]`, '', ` . [${spec.mask.map(e => e.plain ? '0' : `[${e.rel.map((x, i) => e.w[i] === 1 ? num(x) : `${num(x)} | ${e.w[i]}`).join(', ')}]/`).join(', ')}]`) };
}

const pick = files.filter((_, i) => i % step === 0).slice(0, limit);
t0 = performance.now();
for (const file of pick) {
  let converted;
  try { converted = scoreToVoices(loadScore(path.join(dir, file))); } catch { continue; }
  const id = file.replace(/\.\w+$/, '');
  const plain = refactorVoices(converted.voices, { streams: 'joint' });
  const r = refactorVoices(converted.voices, { streams: 'joint', generators, voiceLabels: converted.lanes.map(l => l.role) });
  const ok = r.verified && verifyAgainstScore(r.code, converted);
  totals.pieces++; totals.verified += ok;
  totals.literalBits += r.literalBits; totals.plainBits += plain.bits; totals.genBits += r.bits;
  totals.notes += converted.voices.flat().filter(p => p.tag !== 'r').length;
  if (values.example === id) example = { id, code: r.code, bits: r.bits, plainBits: plain.bits, literalBits: r.literalBits };
  // How many times each definition body is instantiated in the music.
  const count = new Map();
  const hostsList = [...r.state.seqs.map(s => ({ items: s.items, anchor: s.anchor, times: 1 }))];
  const defTimes = id2 => {
    if (count.has(id2)) return count.get(id2);
    count.set(id2, 0);
    let n = 0;
    const visit = (items, times) => { for (const it of items) if ((it.kind === 'ref' || it.kind === 'fan') && it.def === id2) n += times * (it.kind === 'fan' ? it.ts.length : 1); };
    for (const s of r.state.seqs) visit(s.items, 1);
    for (const [other, d] of r.state.defs) if (other !== id2) visit(d.items, defTimes(other));
    count.set(id2, n);
    return n;
  };
  for (const [defId, d] of r.state.defs) hostsList.push({ items: d.items, anchor: 0, times: defTimes(defId) });
  for (const h of hostsList) for (const it of h.items) {
    if (it.kind !== 'gen' || !h.times) continue;
    const d = describe(it.spec);
    const notes = it.pips.length * h.times;
    const saved = h.times * (it.pips.reduce((n, p) => n + pipBits(p, h.anchor) + 1, 0) - (specTextBits(it.spec, h.anchor) + 1));
    totals.genNotes += notes;
    const a = bump(atoms, d.contour, () => ({ contour: d.contour, uses: 0, notes: 0, saved: 0, pieces: new Set(), roles: new Map(), examples: new Map() }));
    a.uses += h.times; a.notes += notes; a.saved += saved; a.pieces.add(id);
    a.roles.set(d.role, (a.roles.get(d.role) ?? 0) + h.times);
    a.examples.set(d.template, (a.examples.get(d.template) ?? 0) + h.times);
    const f = bump(families, d.role, () => ({ role: d.role, uses: 0, notes: 0, pieces: new Set(), examples: new Map() }));
    f.uses += h.times; f.notes += notes; f.pieces.add(id);
    f.examples.set(d.template, (f.examples.get(d.template) ?? 0) + h.times);
    const e = bump(expressions, d.template, () => ({ template: d.template, role: d.role, uses: 0, notes: 0, pieces: new Set() }));
    e.uses += h.times; e.notes += notes; e.pieces.add(id);
  }
  if (totals.pieces % 25 === 0) console.error(`${totals.pieces}/${pick.length}`);
}
const evalSeconds = (performance.now() - t0) / 1000;

const top = (map, n, by = 'notes') => [...map.values()].sort((a, b) => b[by] - a[by]).slice(0, n);
const topExamples = (m, n = 3) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([t, c]) => `\`${t.replace(/\|/g, '\\|')}\` ×${c}`).join(', ');
const pct = (a, b) => `${(100 * a / b).toFixed(1)}%`;

const lines = [];
lines.push('# Atoms and the operators that make them into surface', '');
lines.push(`${totals.pieces} chorales, all four voices, diatonic lens. ${totals.verified} of ${totals.pieces} programs verified note for note against the score.`, '');
lines.push(`The generator dictionary holds ${generators.size.toLocaleString()} distinct surfaces, each with its cheapest Crux expression: a 1–3 pip atom under one or two operators.`, '');
lines.push('| | bits | saving vs literal |', '|---|---|---|');
lines.push(`| literal | ${Math.round(totals.literalBits).toLocaleString()} | |`);
lines.push(`| motif search alone | ${Math.round(totals.plainBits).toLocaleString()} | ${pct(totals.literalBits - totals.plainBits, totals.literalBits)} |`);
lines.push(`| motif search with generators | ${Math.round(totals.genBits).toLocaleString()} | ${pct(totals.literalBits - totals.genBits, totals.literalBits)} |`, '');
lines.push(`Generators produce ${pct(totals.genNotes, totals.notes)} of all notes (${totals.genNotes.toLocaleString()} of ${totals.notes.toLocaleString()}).`, '');
lines.push('## Atoms', '', 'Atoms are grouped by contour (scale steps from the first note). "Roles" are the operator families that turn the atom into surface.', '');
lines.push('| atom | notes made | uses | chorales | bits saved | roles | commonest expressions |', '|---|---|---|---|---|---|---|');
for (const a of top(atoms, 30)) {
  const roles = [...a.roles].sort((x, y) => y[1] - x[1]).slice(0, 4).map(([r, c]) => `${r.replace(/\|/g, '\\|')} ×${c}`).join('; ');
  lines.push(`| \`${a.contour}\` | ${a.notes} | ${a.uses} | ${a.pieces.size} | ${Math.round(a.saved)} | ${roles} | ${topExamples(a.examples)} |`);
}
lines.push('', '## Operator families', '');
lines.push('| family | uses | notes made | chorales | commonest expressions |', '|---|---|---|---|---|');
for (const f of top(families, 25, 'uses')) lines.push(`| ${f.role.replace(/\|/g, '\\|')} | ${f.uses} | ${f.notes} | ${f.pieces.size} | ${topExamples(f.examples)} |`);
lines.push('', '## Commonest expressions beyond the plain subdivided pair', '');
lines.push('| expression (at step 0) | family | uses | notes made | chorales |', '|---|---|---|---|---|');
for (const e of [...expressions.values()].filter(e => !/^\[-?\d+, -?\d+\]\/$/.test(e.template)).sort((a, b) => b.uses - a.uses).slice(0, 40)) {
  lines.push(`| \`${e.template.replace(/\|/g, '\\|')}\` | ${e.role.replace(/\|/g, '\\|')} | ${e.uses} | ${e.notes} | ${e.pieces.size} |`);
}
if (example) {
  lines.push('', `## Example: ${example.id}`, '', `${Math.round(example.bits)} bits with generators, ${Math.round(example.plainBits)} without, ${Math.round(example.literalBits)} literal.`, '', '```', example.code, '```');
}
const markdown = lines.join('\n') + '\n';
if (values.out) {
  fs.writeFileSync(`${values.out}.md`, markdown);
  const ser = m => [...m.values()].map(x => ({ ...x, pieces: x.pieces.size, roles: x.roles ? Object.fromEntries(x.roles) : undefined, examples: x.examples ? Object.fromEntries(x.examples) : undefined }));
  fs.writeFileSync(`${values.out}.json`, JSON.stringify({ totals, buildSeconds, evalSeconds, dictionary: generators.size,
    atoms: ser(atoms).sort((a, b) => b.notes - a.notes), families: ser(families).sort((a, b) => b.uses - a.uses),
    expressions: ser(expressions).sort((a, b) => b.uses - a.uses).slice(0, 500) }, null, 1) + '\n');
} else console.log(markdown);
console.error(`done: ${totals.pieces} pieces in ${evalSeconds.toFixed(0)} s`);
