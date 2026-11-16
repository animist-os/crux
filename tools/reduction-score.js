#!/usr/bin/env node
// Reduction score: how well a Crux program reduces the music it plays.
//
//   node tools/reduction-score.js program.crux [more.crux ...] [--json]
//
// Works on any Crux text, hand-written or from the refactoring search.
//
//   saving    1 - bits / literalBits. Bits are the description length of the
//             program text (src/refactor/cost.js). literalBits is the same
//             music written as one literal mot per voice. This is the headline
//             number: it rewards reuse and short sources on one scale.
//   leverage  sounding notes per pip written in the source. Every number or
//             rest in a mot counts, including operator arguments.
//   reuse     references to defined names per definition.
//
// A `// #keyLane [...]` directive is part of the program, so its bits are added
// to the program's bits and its entries to the pip count.
import fs from 'node:fs';
import { parseArgs } from 'node:util';
import '../src/index.js';
import { tokenize, programBits, integerBits } from '../src/refactor/cost.js';
import { pipText } from '../src/score/to-crux.js';

function countPips(tokens, defined) {
  let pips = 0, refs = 0;
  tokens.forEach((t, k) => {
    const prev = tokens[k - 1], next = tokens[k + 1];
    const atStart = k === 0 || ['nl', 'bang'].includes(prev.type);
    if (t.type === 'num' && prev?.type !== 'pipe' && prev?.type !== 'at') pips++;
    else if (t.type === 'id' && t.text === 'r' && !defined.has('r')) pips++;
    else if (t.type === 'pipe' && prev?.type === 'struct' && (prev.text === '[' || prev.text === ',')) pips++;
    else if (t.type === 'id' && defined.has(t.text) && !(atStart && next?.text === '=')) refs++;
  });
  return { pips, refs };
}

export function reductionScore(code) {
  const sections = globalThis.golden.crux_interp(code).sections;
  const notes = sections.reduce((n, s) => n + s.values.filter(p => p.tag !== 'r').length, 0);
  const tokens = tokenize(code);
  const defined = new Set();
  tokens.forEach((t, k) => {
    const next = tokens[k + 1], atStart = k === 0 || ['nl', 'bang'].includes(tokens[k - 1].type);
    if (t.type === 'id' && atStart && next?.text === '=') defined.add(t.text);
  });
  let { pips, refs } = countPips(tokens, defined);
  let bits = programBits(code).bits;
  const lane = code.match(/^\s*\/\/\s*#keyLane\s+(.+?)\s*$/im);
  if (lane && lane[1].trim().startsWith('[')) {
    bits += programBits(lane[1]).bits;
    pips += countPips(tokenize(lane[1]), new Set()).pips;
  } else if (lane) {
    // Bar-address form: each entry is one pip. Its bits are the address numbers
    // plus 5 for the key (3 for the degree, 2 for the mode) and 1 for the comma.
    for (const entry of lane[1].split(',')) {
      const [address = ''] = entry.trim().split(/\s+/);
      pips++;
      bits += 6 + address.split(':').reduce((n, f) => n + integerBits(Number(f) || 0), 0);
    }
  }
  const literal = sections.map(s => `[${s.values.map(p => pipText({ step: p.step, timeScale: Math.abs(p.timeScale), tag: p.tag === 'r' ? 'r' : undefined })).join(', ')}]`).join('\n!\n');
  const literalBits = programBits(literal).bits;
  return {
    notes, pips, leverage: notes / pips, definitions: defined.size, references: refs,
    reuse: defined.size ? refs / defined.size : 0, keyLane: Boolean(lane),
    bits: Math.round(bits), literalBits: Math.round(literalBits), saving: 1 - bits / literalBits,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { json: { type: 'boolean' } } });
  if (!positionals.length) throw new Error('Usage: node tools/reduction-score.js program.crux [more.crux ...] [--json]');
  const rows = positionals.map(file => ({ file, ...reductionScore(fs.readFileSync(file, 'utf8')) }));
  if (values.json) console.log(JSON.stringify(rows, null, 1));
  else for (const r of rows) {
    console.log(`${r.file}\n  saving ${(100 * r.saving).toFixed(1)}%  (${r.bits} bits, literal ${r.literalBits})` +
      `\n  leverage ${r.leverage.toFixed(2)} notes per pip  (${r.notes} notes, ${r.pips} pips)` +
      `\n  reuse ${r.reuse.toFixed(1)} uses per definition  (${r.references} references, ${r.definitions} definitions)${r.keyLane ? '\n  key lane counted' : ''}`);
  }
}
