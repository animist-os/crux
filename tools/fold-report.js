#!/usr/bin/env node
// Fold report: a text dump of the fold model for one program.
//
//   node tools/fold-report.js program.crux [--tree-depth N] [--min-length N] [--json]
//
// Prints, for each stop, the shapes and note positions that are left; the
// dictionary (one entry per distinct shape, with its count); the residue
// (shapes with no definition that occur once); the repeats and near-misses
// found at stops 6 and 7; the themes left at stop 8 with the notes each
// explains; a summary of the instance tree; and the numbers from
// tools/reduction-score.js. See docs/crux-agent-guide.md.
import fs from 'node:fs';
import { parseArgs } from 'node:util';
import '../src/index.js';
import { foldModel } from '../src/fold/model.js';
import { reductionScore } from './reduction-score.js';

const STOPS = [
  '0 heard',
  '1 scale steps',
  '2 no transposition',
  '3 no mirror, reverse or stretch',
  '4 no repetition',
  '5 no nesting',
  '6 no unstated repeats',
  '7 near-misses folded',
  '8 themes only',
];

export function foldReport(code, { treeDepth = 3, minLength } = {}) {
  const m = foldModel(globalThis.golden.crux_trace(code), { minLength });
  const c = m.counts;
  const lines = [];
  lines.push(`notes ${c.notes}, pips written ${c.pipsWritten}, leverage ${c.leverage.toFixed(2)} notes per pip` +
    (c.edited ? `, edited ${c.edited}` : ''));
  lines.push('', 'stop                               shapes  positions');
  STOPS.forEach((name, s) => {
    lines.push(`  ${name.padEnd(33)}${String(c.shapes[s]).padStart(6)}  ${String(c.positions[s]).padStart(9)}`);
  });
  lines.push('', 'dictionary (source order)');
  for (const e of m.dictionary) {
    if (e.residue) continue;
    lines.push(`  ${String(e.id).padEnd(12)} x${String(e.count).padEnd(4)} ${e.pips} pips`);
  }
  const residue = m.dictionary.filter(e => e.residue);
  lines.push('', `stop 5 residue: ${residue.length} shapes, ${residue.reduce((n, e) => n + e.pips, 0)} pips`);
  const th = m.thematic;
  const steps = slots => '[' + slots.map(x => x.step).join(', ') + ']';
  lines.push('', `stop 6: repeats the program does not state (shortest ${th.minLength} notes)`);
  for (const g of th.found) {
    lines.push(`  ${g.id.padEnd(4)} ${g.length} notes x${g.count}  ` +
      g.occurrences.map(o => `${o.entry}${o.rep ? '*' : ''} ${steps(o.slots)}`).join(', '));
  }
  if (!th.found.length) lines.push('  none');
  const how = x => [x.mirror && 'mirror', x.reverse && 'reverse', x.transpose && `* ${x.transpose}`,
    x.stretch !== 1 && `|| ${+x.stretch.toFixed(3)}`].filter(Boolean).join(', ');
  const bends = list => list.map(b => `${b.step}${b.bent > 0 ? '+' : ''}${b.bent}`).join(' ');
  lines.push('', 'stop 7: near-misses (run -> theme cell; bent notes as step and bend)');
  for (const x of th.near) {
    lines.push(`  ${x.kind === 'edge' ? 'edge ' : ''}${x.from} ${steps(x.slots)} -> ${x.theme}${how(x) ? ' (' + how(x) + ')' : ''}, ` +
      `${x.bent} bent${x.bentNotes.length ? ': ' + bends(x.bentNotes) : ''}`);
  }
  if (!th.near.length) lines.push('  none');
  lines.push('', 'stop 7: themes onto themes');
  for (const f of th.themeFolds) {
    lines.push(`  ${f.from} [${f.steps.join(', ')}] -> ${f.onto} [${f.ontoSteps.join(', ')}]${how(f) ? ' (' + how(f) + ')' : ''}, ` +
      `${f.length} of ${f.of} notes, ${f.bent} bent${f.bentNotes.length ? ': ' + bends(f.bentNotes) : ''}` +
      (f.leftover.length ? `, left over [${f.leftover.join(', ')}]` : ''));
  }
  if (!th.themeFolds.length) lines.push('  none');
  lines.push('', 'stop 8: themes and the notes each explains (own run, then stacked cells)');
  for (const t of th.themes) {
    const att = t.attached.map(a => `${a.owner} ${a.notes}`).join(', ');
    lines.push(`  ${String(t.id).padEnd(8)} ${t.kind.padEnd(6)} ${String(t.positions).padStart(3)} positions ${String(t.notes).padStart(5)} notes` +
      (t.attachedNotes ? `  (${t.own} own, +${t.attachedNotes} attached: ${att})` : ''));
  }
  const rz = th.residue;
  lines.push(`  ${'residue'.padEnd(8)} ${''.padEnd(6)} ${String(rz.positions).padStart(3)} positions ${String(rz.notes).padStart(5)} notes` +
    (rz.cells.length ? `  (${rz.unexplained} not explained, cells with no theme: ${rz.cells.map(a => `${a.owner} ${a.notes}`).join(', ')})` : ''));
  const e = c.explained;
  lines.push('', `explained: program ${e.program}, found repeats ${e.repeat}, near-misses ${e.near}, not explained ${e.none} (of ${c.notes} notes); ${c.attached} stacked as attachments`);
  lines.push('', `instance tree (to depth ${treeDepth})`);
  const walk = (node, depth) => {
    if (depth > treeDepth) return;
    if (node.kind !== 'op') {
      const label = node.kind === 'voice' ? `voice ${node.voice + 1}` : node.kind === 'ref' ? node.name : (node.edited ? 'edited' : 'literal');
      lines.push(`${'  '.repeat(depth + 1)}${label}  ${node.notes || 0} notes  t ${fmt(node.t0)}-${fmt(node.t1)}`);
      depth++;
    }
    let lits = 0;
    for (const ch of node.children) {
      if (ch.kind === 'lit' && depth > treeDepth - 1) { lits++; continue; }
      walk(ch, depth);
    }
    if (lits) lines.push(`${'  '.repeat(depth + 1)}(literal runs: ${lits})`);
  };
  m.instances.forEach(root => walk(root, 0));
  const r = reductionScore(code);
  lines.push('', `reduction score: saving ${(100 * r.saving).toFixed(1)}%, leverage ${r.leverage.toFixed(2)} (${r.pips} pips, operator arguments included)`);
  return { text: lines.join('\n'), model: m, score: r };
}

function fmt(x) {
  return Number.isInteger(x) ? String(x) : String(+x.toFixed(3));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { json: { type: 'boolean' }, 'tree-depth': { type: 'string' }, 'min-length': { type: 'string' } } });
  if (positionals.length !== 1) throw new Error('Usage: node tools/fold-report.js program.crux [--tree-depth N] [--min-length N] [--json]');
  const minLength = values['min-length'] != null ? Number(values['min-length']) : undefined;
  const out = foldReport(fs.readFileSync(positionals[0], 'utf8'), { treeDepth: Number(values['tree-depth'] ?? 3), minLength });
  if (values.json) console.log(JSON.stringify({ counts: out.model.counts, dictionary: out.model.dictionary, thematic: out.model.thematic, score: out.score }, null, 1));
  else console.log(`${positionals[0]}\n${out.text}`);
}
