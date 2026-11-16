#!/usr/bin/env node
// Fold report: a text dump of the fold model for one program.
//
//   node tools/fold-report.js program.crux [--tree-depth N] [--json]
//
// Prints, for each stop, the shapes and note positions that are left; the
// dictionary (one entry per distinct shape, with its count); the residue
// (shapes with no definition that occur once); a summary of the instance tree;
// and the numbers from tools/reduction-score.js. See docs/crux-agent-guide.md.
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
];

export function foldReport(code, { treeDepth = 3 } = {}) {
  const m = foldModel(globalThis.golden.crux_trace(code));
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
  lines.push('', `residue: ${residue.length} shapes, ${residue.reduce((n, e) => n + e.pips, 0)} pips`);
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
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { json: { type: 'boolean' }, 'tree-depth': { type: 'string' } } });
  if (positionals.length !== 1) throw new Error('Usage: node tools/fold-report.js program.crux [--tree-depth N] [--json]');
  const out = foldReport(fs.readFileSync(positionals[0], 'utf8'), { treeDepth: Number(values['tree-depth'] ?? 3) });
  if (values.json) console.log(JSON.stringify({ counts: out.model.counts, dictionary: out.model.dictionary, score: out.score }, null, 1));
  else console.log(`${positionals[0]}\n${out.text}`);
}
