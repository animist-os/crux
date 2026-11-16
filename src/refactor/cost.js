// Description length of Crux source text, in bits, under a fixed naive prefix code.
// It is computed from text alone, so programs from any search method (or hand
// written) are compared on one scale. Comments and directives are free.
//
//   integer n            1 bit if 0, else 1 sign bit + Elias-gamma(|n|)
//   fraction p/q         cost(p) + cost(q)
//   decimal              cost of its exact fraction
//   defined name         log2(names + 1)
//   operator symbol      4 bits  (* m . @ .j || : ~ > ^ f etc.)
//   '|' and rest 'r'     1 bit   (a duration follows / a rest)
//   [ ] ( ) , = &        1 bit   (structure, roughly a stop code per item)
//   newline, '!'         0       (voices and statements are fixed overhead)

const gamma = k => 2 * Math.floor(Math.log2(k)) + 1;
export const integerBits = n => (n === 0 ? 1 : 1 + gamma(Math.abs(n)));

const MULTI = ['.->', '.*', '.^', '.j', '.m', '.l', '.t', '.c', '.,', '.g', '.r', '.~', '->', '||', ':='];
const SINGLE_OPS = new Set(['*', '^', '.', '~', '@', '>', ':', '/', '\\', '{', '}', '$', '+', '-']);
const STRUCTURE = new Set(['[', ']', '(', ')', ',', '=', '&']);
const LETTER_OPS = new Set(['j', 'm', 'l', 'c', 'g', 'r', 'p', 'f', 't', 'z']);

function stripComments(code) {
  return code.split('\n').map(line => {
    const i = line.indexOf('//');
    return i < 0 ? line : line.slice(0, i);
  }).join('\n');
}

export function tokenize(code) {
  const text = stripComments(code);
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '\n') { tokens.push({ type: 'nl' }); i++; continue; }
    const num = /^-?\d+(?:\.\d+)?(?:\/\d+)?/.exec(text.slice(i));
    // A leading '-' is a sign only after an operator/separator, not after a value.
    const prev = tokens[tokens.length - 1];
    // `[@3 -1]`: the value after an at-index is a signed number.
    const afterIndex = prev?.type === 'num' && tokens[tokens.length - 2]?.type === 'at';
    const signAllowed = !prev || afterIndex || ['op', 'struct', 'nl', 'pipe', 'at'].includes(prev.type);
    if (num && (num[0][0] !== '-' || signAllowed)) {
      tokens.push({ type: 'num', text: num[0] });
      i += num[0].length;
      continue;
    }
    const multi = MULTI.find(m => text.startsWith(m, i));
    if (multi) { tokens.push({ type: 'op', text: multi }); i += multi.length; continue; }
    const id = /^[A-Za-z_]\w*/.exec(text.slice(i));
    if (id) { tokens.push({ type: 'id', text: id[0] }); i += id[0].length; continue; }
    if (c === '|') { tokens.push({ type: 'pipe', text: c }); i++; continue; }
    if (c === '!') { tokens.push({ type: 'bang', text: c }); i++; continue; }
    if (c === '@') { tokens.push({ type: 'at', text: c }); i++; continue; }
    if (STRUCTURE.has(c)) { tokens.push({ type: 'struct', text: c }); i++; continue; }
    if (SINGLE_OPS.has(c)) { tokens.push({ type: 'op', text: c }); i++; continue; }
    throw new Error(`Cost tokenizer: unexpected character '${c}'.`);
  }
  return tokens;
}

function numberBits(text) {
  let value = text;
  let [p, q] = value.split('/');
  if (p.includes('.')) {
    // Exact fraction of a terminating decimal.
    const digits = p.split('.')[1].length;
    let num = Math.round(Number(p) * 10 ** digits), den = 10 ** digits;
    const g = (a, b) => (b ? g(b, a % b) : Math.abs(a));
    const d = g(num, den);
    return integerBits(num / d) + integerBits(den / d) + (q ? integerBits(Number(q)) : 0);
  }
  return integerBits(Number(p)) + (q === undefined ? 0 : integerBits(Number(q)));
}

/**
 * Bits for a whole program. Returns { bits, breakdown }.
 * options.external: names defined elsewhere (a shared library); options.extraNames:
 * size of that library's name space (names cost log2(local + library + 1) bits).
 */
export function programBits(code, options = {}) {
  const external = options.external ?? new Set();
  const tokens = tokenize(code);
  // Names defined by `name =` or `name :=` at statement start.
  const defined = new Set();
  tokens.forEach((t, k) => {
    const next = tokens[k + 1];
    const atStart = k === 0 || tokens[k - 1].type === 'nl' || tokens[k - 1].type === 'bang';
    if (t.type === 'id' && atStart && next && ((next.type === 'struct' && next.text === '=') || next.text === ':=')) defined.add(t.text);
  });
  const nameBits = Math.log2(Math.max(2, defined.size + (options.extraNames ?? 0) + 1));
  const breakdown = { numbers: 0, names: 0, operators: 0, structure: 0, durations: 0, rests: 0 };
  for (const t of tokens) {
    if (t.type === 'num') breakdown.numbers += numberBits(t.text);
    else if (t.type === 'id') {
      if (defined.has(t.text) || external.has(t.text)) breakdown.names += nameBits;
      else if (t.text === 'r') breakdown.rests += 1;
      else if (LETTER_OPS.has(t.text)) breakdown.operators += 4;
      else throw new Error(`Cost tokenizer: undefined name '${t.text}'.`);
    } else if (t.type === 'op' || t.type === 'at') breakdown.operators += 4;
    else if (t.type === 'pipe') breakdown.durations += 1;
    else if (t.type === 'struct') breakdown.structure += 1;
  }
  const bits = Object.values(breakdown).reduce((a, b) => a + b, 0);
  return { bits, breakdown, names: defined.size };
}
