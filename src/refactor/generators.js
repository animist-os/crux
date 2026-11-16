// Generators: tiny atoms (1-3 pips) made into surface by Crux operators.
//
// Bottom-up enumerative synthesis with observational equivalence. Every
// expression "atom op operand" (and one more operator on top) is evaluated by a
// small evaluator for the operators used here; expressions that produce the same
// surface (up to transposition) keep only the cheapest text. The result is a
// dictionary: canonical surface -> cheapest generating expression.
//
// Every operator used is equivariant in its left operand (shifting the atom
// shifts the surface), so a surface starting on step o is written by adding o to
// the atom's steps: `[5] -> [3]` is the run 5 6 7 8.
//
// The local evaluator only proposes. Dictionary entries are spot-checked against
// the real interpreter (validateGenerators), and every program that uses a
// generator is verified by the interpreter like any other.
import '../index.js';
import { cruxNumber } from '../score/to-crux.js';
import { programBits } from './cost.js';

const near = (a, b) => Math.abs(a - b) < 1e-9;
const P = (s, t = 1) => ({ s, t });

// ---------------------------------------------------------------- operators
// Pips are { s: step, t: timeScale }. Nested cog entries are { nest: [pips] }.
const OPS = {
  fan: (A, B) => B.flatMap(b => (b.t < 0 ? [...A].reverse() : A).map(a => P(a.s + b.s, a.t * Math.abs(b.t)))),
  cog: (A, B) => A.flatMap((a, i) => {
    const b = B[i % B.length];
    return b.nest ? b.nest.map(n => P(a.s + n.s, a.t * n.t)) : [P(a.s + b.s, a.t * b.t)];
  }),
  steps: (A, k) => {
    const out = [], dir = Math.sign(k);
    for (let j = 0; j <= Math.abs(k); j++) for (const a of A) out.push(P(a.s + dir * j, a.t));
    return out;
  },
  dotSteps: (A, K) => A.flatMap((a, i) => {
    const k = K[i % K.length], dir = Math.sign(k), out = [];
    for (let j = 0; j <= Math.abs(k); j++) out.push(P(a.s + dir * j, a.t));
    return out;
  }),
  fold: (A, k) => [...A, ...[...A].reverse().map(a => P(a.s + k, a.t))],
  lens: (A, n) => { const out = []; for (let i = 0; i + n <= A.length; i++) out.push(...A.slice(i, i + n)); return out; },
  repeat: (A, k) => Array.from({ length: k }, () => A).flat(),
  // Postfix `/` fits the whole mot into one beat: durations scale by 1 / total.
  subdivide: A => { const total = A.reduce((n, a) => n + a.t, 0); return A.map(a => P(a.s, a.t / total)); },
  scale: (A, s) => A.map(a => P(a.s, a.t * s)),
};

const num = cruxNumber;
const pipsText = ps => '[' + ps.map(p => near(p.t, 1) ? num(p.s) : `${num(p.s)} | ${num(p.t)}`).join(', ') + ']';
const atomText = (steps, weights = null) => weights
  ? '[' + steps.map((x, i) => weights[i] === 1 ? num(x) : `${num(x)} | ${weights[i]}`).join(', ') + ']/'
  : '[' + steps.map(num).join(', ') + ']';
// Uneven subdivisions of one beat: `[a | 3, b]/` is a dotted eighth and a sixteenth.
const WEIGHTS = { 2: [[3, 1], [1, 3], [2, 1], [1, 2]], 3: [[2, 1, 1], [1, 1, 2], [1, 2, 1]] };
const WEIGHTED_FAMILIES = new Set(['A || [s]', 'A * B', 'A -> [k]', 'A:k']);

/** Canonical key of a surface: steps relative to the first, and every duration. */
export function surfaceKey(pips) {
  const s0 = pips[0].s ?? pips[0].step;
  return pips.map(p => `${num((p.s ?? p.step) - s0)}:${num(p.t ?? p.timeScale)}`).join(' ');
}

// ---------------------------------------------------------------- operand catalogs
function range(lo, hi) { const r = []; for (let i = lo; i <= hi; i++) r.push(i); return r; }
function* tuples(values, n) {
  if (n === 0) { yield []; return; }
  for (const v of values) for (const rest of tuples(values, n - 1)) yield [v, ...rest];
}

/**
 * Suffix operations: { family, text (appended after the left operand), apply }.
 * `wrap` says whether the left operand needs parentheses when it is itself an
 * expression (postfix `/` binds tighter than binary operators).
 */
function levelOneSuffixes() {
  const out = [];
  out.push({ family: 'A/', text: '/', apply: A => A.length > 1 ? OPS.subdivide(A) : null, postfix: true });
  for (const s of [1 / 2, 1 / 4, 2, 3 / 2]) out.push({ family: 'A || [s]', text: ` || [${num(s)}]`, apply: A => OPS.scale(A, s) });
  // Fan transposition: A * B
  for (const n of [1, 2, 3]) for (const steps of tuples(range(-4, 4), n)) {
    const tsChoices = n === 3 ? [1] : n === 2 ? [1, 1 / 2, -1] : [1, 1 / 2, 2, -1];
    for (const t of tsChoices) {
      if (n === 1 && t === 1) continue; // A * [k] is plain transposition
      const B = steps.map(s => P(s, t));
      out.push({ family: 'A * B', text: ` * ${pipsText(B)}`, apply: A => OPS.fan(A, B) });
    }
  }
  for (const k of [...range(-5, -1), ...range(1, 5)]) out.push({ family: 'A -> [k]', text: ` -> [${k}]`, apply: A => OPS.steps(A, k) });
  for (const k of [...range(-3, -1), ...range(1, 3)]) out.push({ family: 'A .-> [k]', text: ` .-> [${k}]`, apply: A => OPS.dotSteps(A, [k]) });
  for (const ks of tuples([...range(-3, -1), ...range(1, 3)], 2)) out.push({ family: 'A .-> [j, k]', text: ` .-> [${ks.join(', ')}]`, apply: A => OPS.dotSteps(A, ks) });
  for (const k of range(-3, 3)) out.push({ family: 'A f [k]', text: ` f [${k}]`, apply: A => OPS.fold(A, k) });
  for (const n of [2, 3]) out.push({ family: 'A l [n]', text: ` l [${n}]`, apply: A => A.length > n ? OPS.lens(A, n) : null });
  for (const k of [2, 3, 4]) out.push({ family: 'A:k', text: `:${k}`, apply: A => OPS.repeat(A, k), postfix: true });
  // Cog-add with nested subdivisions: A . [0, [0, -1]/]
  const entries = [...range(-2, 2).map(v => ({ text: num(v), e: P(v) })),
    ...[...tuples(range(-2, 2), 2)].map(([x, y]) => ({ text: `[${x}, ${y}]/`, e: { nest: [P(x, 1 / 2), P(y, 1 / 2)] } }))];
  for (const n of [1, 2]) for (const combo of tuples(entries, n)) {
    if (!combo.some(c => c.e.nest)) continue;
    const B = combo.map(c => c.e);
    out.push({ family: 'A . [nested]', text: ` . [${combo.map(c => c.text).join(', ')}]`, apply: A => OPS.cog(A, B) });
  }
  return out;
}

function levelTwoSuffixes() {
  const out = [];
  out.push({ family: '/', text: '/', apply: A => OPS.subdivide(A), postfix: true });
  for (const s of [1 / 2, 1 / 4]) out.push({ family: '|| [s]', text: ` || [${num(s)}]`, apply: A => OPS.scale(A, s) });
  for (const n of [1, 2]) for (const steps of tuples(range(-4, 4), n)) {
    if (n === 1) continue;
    const B = steps.map(s => P(s));
    out.push({ family: '* B', text: ` * ${pipsText(B)}`, apply: A => OPS.fan(A, B) });
  }
  for (const k of [...range(-3, -1), ...range(1, 3)]) out.push({ family: '-> [k]', text: ` -> [${k}]`, apply: A => OPS.steps(A, k) });
  out.push({ family: ':2', text: ':2', apply: A => OPS.repeat(A, 2), postfix: true });
  return out;
}

// ---------------------------------------------------------------- dictionary
const suffixBitsCache = new Map();
/** Bits of a suffix, by difference: bits("[0]" + suffix) - bits("[0]"). */
function suffixBits(text) {
  if (!suffixBitsCache.has(text)) suffixBitsCache.set(text, programBits(`[0]${text}`).bits - programBits('[0]').bits);
  return suffixBitsCache.get(text);
}

/**
 * Build the generator dictionary. Options: maxLength (surface pips, default 16),
 * maxStep (|relative step|, default 10), levels (1 or 2, default 2).
 * Returns { entries: Map<key, gen>, size, families }.
 * gen = { key, length, atom: [steps], suffixes: [text, ...], family, bits0 }.
 */
export function buildGenerators(settings = {}) {
  const { maxLength = 16, maxStep = 10, levels = 2, level2MaxLength = 8 } = settings;
  const entries = new Map();
  const consider = (pips, gen) => {
    if (!pips || pips.length < 2 || pips.length > maxLength) return false;
    if (pips.some(p => Math.abs(p.s - pips[0].s) > maxStep || p.t <= 0)) return false;
    const key = surfaceKey(pips);
    const old = entries.get(key);
    if (old && old.bits0 <= gen.bits0) return false;
    entries.set(key, { ...gen, key, length: pips.length, pips });
    return true;
  };
  // Atoms: first step 0; 1-3 pips, steps -3..3, quarter notes.
  const atoms = [[0]];
  for (const n of [2, 3]) for (const rest of tuples(range(-3, 3), n - 1)) atoms.push([0, ...rest]);
  const one = levelOneSuffixes();
  const levelOne = [];
  const atomVariants = [];
  for (const steps of atoms) {
    atomVariants.push({ steps, weights: null });
    for (const w of WEIGHTS[steps.length] ?? []) atomVariants.push({ steps, weights: w });
  }
  // Chromatic pairs: a half step in the diatonic lens (a leading tone into its
  // degree, a chromatic passing note). Simple operators only, level one.
  for (const x of [-5 / 2, -3 / 2, -1 / 2, 1 / 2, 3 / 2, 5 / 2]) {
    atomVariants.push({ steps: [0, x], weights: null, chromatic: true });
    for (const w of WEIGHTS[2]) atomVariants.push({ steps: [0, x], weights: w, chromatic: true });
  }
  for (const { steps, weights, chromatic } of atomVariants) {
    const total = weights ? weights.reduce((a, b) => a + b, 0) : 1;
    const A = steps.map((x, i) => P(x, weights ? weights[i] / total : 1));
    const atomBits = programBits(atomText(steps, weights)).bits;
    if (steps.length > 1) consider(A, { atom: steps, weights, suffixes: [], family: weights ? '[a | w, b]/' : 'atom', bits0: atomBits });
    for (const sfx of one) {
      // Uneven-beat atoms take only the simple operators, and stay at level one.
      if ((weights || chromatic) && !WEIGHTED_FAMILIES.has(sfx.family) && sfx.text !== '/') continue;
      if (weights && sfx.text === '/') continue;
      if ((weights || chromatic) && sfx.family === 'A * B' && sfx.text.split(',').length > 2) continue;
      const pips = sfx.apply(A);
      if (!pips) continue;
      const gen = { atom: steps, weights, suffixes: [sfx.text], family: weights ? sfx.family.replace(/^A/, 'Aw') : sfx.family, bits0: atomBits + suffixBits(sfx.text) };
      consider(pips, gen);
      if (!weights && !chromatic && pips.length <= level2MaxLength) levelOne.push({ pips, gen });
    }
  }
  if (levels >= 2) {
    const two = levelTwoSuffixes();
    // Only the cheapest expression per level-one surface is extended.
    const best = new Map();
    for (const x of levelOne) {
      const key = surfaceKey(x.pips);
      if (!best.has(key) || best.get(key).gen.bits0 > x.gen.bits0) best.set(key, x);
    }
    for (const { pips, gen } of best.values()) for (const sfx of two) {
      const out = sfx.apply(pips);
      if (!out) continue;
      consider(out, { atom: gen.atom, weights: gen.weights, suffixes: [...gen.suffixes, sfx.text], family: `(${gen.family}) ${sfx.family}`,
        bits0: gen.bits0 + 2 + suffixBits(sfx.text) });
    }
  }
  const families = new Map();
  for (const g of entries.values()) families.set(g.family, (families.get(g.family) ?? 0) + 1);
  return { entries, size: entries.size, families };
}

/** Text of a generator whose surface starts on step `offset`. */
export function genText(gen, offset = 0) {
  let text = atomText(gen.atom.map(s => s + offset), gen.weights) + (gen.suffixes[0] ?? '');
  for (let i = 1; i < gen.suffixes.length; i++) text = `(${text})${gen.suffixes[i]}`;
  return text;
}

const bitsCache = new WeakMap();
/** Bits of genText(gen, offset), cached per generator and offset. */
export function genBits(gen, offset = 0) {
  let m = bitsCache.get(gen);
  if (!m) bitsCache.set(gen, m = new Map());
  if (!m.has(offset)) m.set(offset, programBits(genText(gen, offset)).bits);
  return m.get(offset);
}

/** Spot-check dictionary entries against the real interpreter. Returns failures. */
export function validateGenerators(dict, { sample = 2000, seed = 7 } = {}) {
  const all = [...dict.entries.values()];
  let a = seed >>> 0;
  const rand = () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 2 ** 32; };
  const failures = [];
  for (let n = 0; n < Math.min(sample, all.length); n++) {
    const gen = all[Math.floor(rand() * all.length)];
    const offset = Math.floor(rand() * 9) - 4;
    const text = genText(gen, offset);
    try {
      const got = globalThis.golden.crux_interp(text).sections[0].values;
      const ok = got.length === gen.pips.length && got.every((p, i) => near(p.step, gen.pips[i].s + offset) && near(p.timeScale, gen.pips[i].t));
      if (!ok) failures.push({ text, expected: gen.pips.map(p => `${p.s + offset}|${p.t}`).join(' '), got: got.map(p => `${p.step}|${p.timeScale}`).join(' ') });
    } catch (error) { failures.push({ text, error: error.message.split('\n')[0] }); }
  }
  return failures;
}

// ---------------------------------------------------------------- generator specs
// A spec says how a stretch of surface is generated; specText renders it with
// absolute steps shifted down by `shift` (the anchor of the enclosing stream).
//   { type: 'dict', g, o }                 a dictionary generator starting on step o
//   { type: 'fan', atom, offsets }         `atom * [o1, o2, ...]`: the atom on a path
//   { type: 'cog', skel, mask }            `[skeleton] . [mask]`: every skeleton note
//                                          decorated by the nested atom in its mask slot
import { integerBits } from './cost.js';

function nb(value) {
  const [p, q] = num(value).split('/');
  return integerBits(Number(p)) + (q ? integerBits(Number(q)) : 0);
}
const listBits = items => 2 + items.reduce((n, x) => n + x, 0) + Math.max(0, items.length - 1);
const durBits = t => near(t, 1) ? 0 : 1 + nb(t);

function atomExpr(atom, offset) {
  if (atom.g) {
    const text = genText(atom.g, offset - atom.g.pips[0].s);
    // Postfix forms bind tighter than `*`, so they need no parentheses before it.
    const postfix = atom.g.suffixes.length === 0 || (atom.g.suffixes.length === 1 && (atom.g.suffixes[0] === '/' || atom.g.suffixes[0].startsWith(':')));
    return { text, bare: postfix };
  }
  return { text: pipsText(atom.rel.map(p => P(p.s + offset, p.t))), bare: true };
}

function maskText(mask) {
  return '[' + mask.map(e => e.plain ? '0' : '[' + e.rel.map((x, i) => e.w[i] === 1 ? num(x) : `${num(x)} | ${e.w[i]}`).join(', ') + ']/').join(', ') + ']';
}

/** Crux text of a spec, with absolute steps shifted down by `shift`. */
export function specText(spec, shift = 0) {
  if (spec.type === 'dict') return genText(spec.g, spec.o - shift);
  if (spec.type === 'fan') {
    const rel = spec.offsets.map(o => o - spec.offsets[0]);
    // Either the atom sits at 0 and the path carries the register, or the atom
    // carries the first offset and the path starts at 0. Use the cheaper.
    const a = atomExpr(spec.atom, 0), b = atomExpr(spec.atom, spec.offsets[0] - shift);
    const wrap = x => x.bare ? x.text : `(${x.text})`;
    const options = [`${wrap(a)} * [${spec.offsets.map(o => num(o - shift)).join(', ')}]`,
      `${wrap(b)} * [${rel.map(num).join(', ')}]`];
    // The path may itself be a generator: `[0, -1]/ * ([5] -> [-3])`.
    if (spec.pathGen) options.push(`${wrap(a)} * (${genText(spec.pathGen, spec.offsets[0] - shift - spec.pathGen.pips[0].s)})`);
    return cheapest(options);
  }
  if (spec.type === 'cog') {
    const skel = '[' + spec.skel.map(p => near(p.t, 1) ? num(p.s - shift) : `${num(p.s - shift)} | ${num(p.t)}`).join(', ') + ']';
    const options = [`${skel} . ${maskText(spec.mask)}`];
    // The skeleton may itself be a generator: `([5] -> [-3]) . [[0, -1]/]`.
    if (spec.pathGen) options.push(`(${genText(spec.pathGen, spec.skel[0].s - shift - spec.pathGen.pips[0].s)}) . ${maskText(spec.mask)}`);
    return cheapest(options);
  }
  throw new Error(`Unknown spec ${spec.type}`);
}

function cheapest(texts) {
  let best = null, bits = Infinity;
  for (const t of texts) { const b = programBits(t).bits; if (b < bits) { best = t; bits = b; } }
  return best;
}

/** True if the spec's text can sit inside a mot literal without parentheses. */
export function specBare(spec) {
  return spec.type === 'dict' && isBareGen(spec.g);
}
/** `[a, b]/` and `[a | 3, b]/` can sit inside a mot literal as they are. */
const isBareGen = g => (g.suffixes.length === 1 && g.suffixes[0] === '/' && !g.weights) || (g.suffixes.length === 0 && !!g.weights);

export function shiftSpec(spec, by) {
  if (spec.type === 'dict') return { ...spec, o: spec.o + by };
  if (spec.type === 'fan') return { ...spec, offsets: spec.offsets.map(o => o + by) };
  return { ...spec, skel: spec.skel.map(p => ({ ...p, s: p.s + by })) };
}

const specBitsCache = new Map();
export function specBits(spec, shift = 0) {
  const text = specText(spec, shift);
  if (!specBitsCache.has(text)) {
    if (specBitsCache.size > 200000) specBitsCache.clear();
    specBitsCache.set(text, programBits(text).bits);
  }
  return specBitsCache.get(text);
}

/** Smallest positive integer weights proportional to durations, or null. */
function weights(ts) {
  const min = Math.min(...ts);
  for (let d = 1; d <= 4; d++) {
    const w = ts.map(t => t / min * d);
    if (w.every(x => near(x, Math.round(x)) && Math.round(x) <= 8)) return w.map(Math.round);
  }
  return null;
}

/**
 * Generator candidates for every position of a stream: an array (one entry per
 * start index) of { length, spec, bits } where bits is an estimate of the text
 * cost at the stream's anchor. Uses the dictionary (windows up to its length
 * limit) and the two factorizations (fan over a path, cog decoration of a
 * skeleton) for longer stretches.
 */
export function generatorCandidates(pips, anchor, dict, { maxLength = 32, factor = true } = {}) {
  const n = pips.length;
  const out = Array.from({ length: n }, () => []);
  const ok = p => p.tag !== 'r';
  for (let i = 0; i < n; i++) {
    if (!ok(pips[i])) continue;
    // Dictionary windows.
    let key = '';
    for (let L = 1; L <= 16 && i + L <= n; L++) {
      const p = pips[i + L - 1];
      if (!ok(p)) break;
      key += (L > 1 ? ' ' : '') + `${num(p.step - pips[i].step)}:${num(p.timeScale)}`;
      if (L < 2) continue;
      const g = dict.entries.get(key);
      if (g) {
        // A dictionary surface need not start on 0 at offset 0 (e.g. `[0, 0] . [[-1, 0]/]`).
        const spec = { type: 'dict', g, o: pips[i].step - g.pips[0].s };
        out[i].push({ length: L, spec, bits: specBits(spec, anchor) });
      }
    }
    if (!factor) continue;
    // Fan: chunks of a 2- or 3-pip atom along a path of transpositions.
    for (const a of [2, 3]) {
      if (i + 2 * a > n) continue;
      const atomPips = pips.slice(i, i + a);
      if (!atomPips.every(ok)) continue;
      const rel = atomPips.map(p => P(p.step - atomPips[0].step, p.timeScale));
      const atomKey = rel.map(p => `${num(p.s)}:${num(p.t)}`).join(' ');
      const g = dict.entries.get(atomKey) ?? null;
      const atom = { g, rel };
      const offsets = [atomPips[0].step];
      for (let j = i + a; j + a <= n && j + a - i <= maxLength; j += a) {
        const chunk = pips.slice(j, j + a);
        if (!chunk.every((p, k) => ok(p) && near(p.step - chunk[0].step, rel[k].s) && near(p.timeScale, rel[k].t))) break;
        offsets.push(chunk[0].step);
        const pathGen = offsets.length >= 2 ? dict.entries.get(surfaceKey(offsets.map(o => P(o)))) ?? null : null;
        const spec = { type: 'fan', atom, offsets: offsets.slice(), pathGen };
        out[i].push({ length: j + a - i, spec, bits: specBits(spec, anchor) });
      }
    }
    // Cog: skeleton notes, each decorated by a nested atom in its mask slot. Masks
    // [N], [N, 0], [0, N] and [N, M] (two different atoms alternating).
    for (const pattern of [['N'], ['N', 0], [0, 'N'], ['N', 'M']]) for (const r of [2, 3]) {
      let j = i, k = 0, groups = 0;
      const atoms = {};
      const skel = [];
      while (j < n && j - i < maxLength) {
        const slot = pattern[k % pattern.length];
        if (slot === 0) {
          if (!ok(pips[j])) break;
          skel.push({ s: pips[j].step, t: pips[j].timeScale });
          j += 1;
        } else {
          if (j + r > n) break;
          const group = pips.slice(j, j + r);
          if (!group.every(ok)) break;
          const total = group.reduce((x, p) => x + p.timeScale, 0);
          const relSteps = group.map(p => p.step - group[0].step);
          const w = weights(group.map(p => p.timeScale));
          if (!w) break;
          const atom = atoms[slot];
          if (!atom) atoms[slot] = { rel: relSteps, w };
          else if (!relSteps.every((x, q) => near(x, atom.rel[q])) || !w.every((x, q) => x === atom.w[q])) break;
          skel.push({ s: group[0].step, t: total });
          groups++;
          j += r;
        }
        k++;
        const complete = pattern.every(slot2 => slot2 === 0 || atoms[slot2]);
        if (complete && groups >= 2 && skel.length >= 2) {
          if (pattern.includes('M') && atoms.N.rel.every((x, q) => near(x, atoms.M.rel[q])) && atoms.N.w.every((x, q) => x === atoms.M.w[q])) continue;
          const mask = pattern.map(slot2 => slot2 === 0 ? { plain: true } : { rel: atoms[slot2].rel, w: atoms[slot2].w });
          const pathGen = dict.entries.get(surfaceKey(skel)) ?? null;
          const spec = { type: 'cog', skel: skel.slice(), mask, pathGen };
          out[i].push({ length: j - i, spec, bits: specBits(spec, anchor) });
        }
      }
    }
  }
  return out;
}

/** Pips a spec generates (absolute steps), via the local evaluator. */
export function specPips(spec) {
  if (spec.type === 'dict') return spec.g.pips.map(p => ({ step: p.s + spec.o, timeScale: p.t }));
  if (spec.type === 'fan') return spec.offsets.flatMap(o => spec.atom.rel.map(p => ({ step: p.s + o, timeScale: p.t })));
  const out = [];
  spec.skel.forEach((p, k) => {
    const e = spec.mask[k % spec.mask.length];
    if (e.plain) out.push({ step: p.s, timeScale: p.t });
    else {
      const total = e.w.reduce((a, b) => a + b, 0);
      e.rel.forEach((x, q) => out.push({ step: p.s + x, timeScale: p.t * e.w[q] / total }));
    }
  });
  return out;
}
