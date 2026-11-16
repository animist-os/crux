#!/usr/bin/env node
// Reduction score: how well a Crux program reduces the music it plays.
//
//   node tools/reduction-score.js program.crux [more.crux ...] [--json]
//
// Works on any Crux text, hand-written or from the refactoring search.
//
//   saving    1 - bits / literalBits. Bits are the description length of the
//             program text (src/refactor/cost.js). literalBits is the same
//             music written as one literal mot per voice, on its best grid:
//             all lengths are multiplied by one factor, chosen so the literal
//             is smallest. This is the headline number: it rewards reuse and
//             short sources on one scale, and it does not depend on #quanta.
//             For the same music, fewer bits always gives a larger saving.
//   savingAsWritten  the number this tool gave before 2026-11-16. Its literal
//             keeps the program's own unit. Music in sixteenths written with
//             a quarter-note unit gets a large literal (every length is a
//             fraction), and so a saving that is about 20 points too high.
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

/**
 * The literal program for a list of voices (arrays of pips), on its best grid.
 * Tries each note length that occurs as the unit and keeps the smallest literal.
 * Returns { literalBits, gridFactor, literalBitsAsWritten }. Multiply every
 * timeScale by gridFactor to put the music on that grid.
 */
export function literalOnBestGrid(voices) {
  const literalAt = factor => programBits(voices.map(v => `[${v.map(p => pipText({ step: p.step, timeScale: Math.abs(p.timeScale) * factor, tag: p.tag === 'r' ? 'r' : undefined })).join(', ')}]`).join('\n!\n')).bits;
  const literalBitsAsWritten = literalAt(1);
  let literalBits = literalBitsAsWritten, gridFactor = 1;
  for (const d of new Set(voices.flatMap(v => v.map(p => Math.abs(p.timeScale)).filter(d => d > 0)))) {
    const bitsAt = literalAt(1 / d);
    if (bitsAt < literalBits) { literalBits = bitsAt; gridFactor = 1 / d; }
  }
  return { literalBits, gridFactor, literalBitsAsWritten };
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
  const { literalBits, gridFactor, literalBitsAsWritten } = literalOnBestGrid(sections.map(s => s.values));
  return {
    notes, pips, leverage: notes / pips, definitions: defined.size, references: refs,
    reuse: defined.size ? refs / defined.size : 0, keyLane: Boolean(lane),
    bits: Math.round(bits), literalBits: Math.round(literalBits), saving: 1 - bits / literalBits, gridFactor,
    literalBitsAsWritten: Math.round(literalBitsAsWritten), savingAsWritten: 1 - bits / literalBitsAsWritten,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { json: { type: 'boolean' } } });
  if (!positionals.length) throw new Error('Usage: node tools/reduction-score.js program.crux [more.crux ...] [--json]');
  const rows = positionals.map(file => ({ file, ...reductionScore(fs.readFileSync(file, 'utf8')) }));
  if (values.json) console.log(JSON.stringify(rows, null, 1));
  else for (const r of rows) {
    console.log(`${r.file}\n  saving ${(100 * r.saving).toFixed(1)}%  (${r.bits} bits, literal ${r.literalBits} on its best grid, lengths x ${Number(r.gridFactor.toFixed(4))})` +
      `\n  saving as written ${(100 * r.savingAsWritten).toFixed(1)}%  (literal ${r.literalBitsAsWritten} in the program's own unit)` +
      `\n  leverage ${r.leverage.toFixed(2)} notes per pip  (${r.notes} notes, ${r.pips} pips)` +
      `\n  reuse ${r.reuse.toFixed(1)} uses per definition  (${r.references} references, ${r.definitions} definitions)${r.keyLane ? '\n  key lane counted' : ''}`);
  }
}
