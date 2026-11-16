// Hierarchical motif grammar for Crux: an MDL-driven, Re-Pair-style refactoring search.
//
// A program is a set of sequences (voice streams) plus definitions. Each sequence
// is a list of items: a literal pip, a reference to a definition under a
// transformation (transposition, inversion, retrograde, uniform augmentation), or
// a fan (several transformed references in a row, rendered `M * [a, b, c]`).
//
// One search step finds the repeated pattern whose abstraction saves the most
// bits, defines it (normalized to start at step 0), and replaces its occurrences.
// Patterns may contain earlier references, so the vocabulary nests; patterns are
// also found inside definition bodies. A beam over these choices explores
// alternatives. Polishing then inlines single-use definitions, re-parses every
// sequence optimally for the final dictionary (dynamic programming), re-anchors
// definitions, and merges transposed runs into fans.
//
// Streams: a voice is either one joint stream (pitch and rhythm together), or a
// pitch stream (all quarter notes) combined with a rhythm stream (all step 0) by
// cog-add: `(P) . (R)`. Pitch motifs then match regardless of rhythm.
//
// Options also cover note-edit variants `(M * [o]) @ [@i d]`, phrase/beat
// constraints on where motifs may start and end, stochastic restarts, and a
// frozen corpus library (learnLibrary). See REFACTORING.md for measurements.
//
// Every returned program is checked by the real Crux interpreter.
import '../index.js';
import { cruxNumber, pipText } from '../score/to-crux.js';
import { integerBits, programBits } from './cost.js';
import { generatorCandidates, specText, specBits, specBare, shiftSpec } from './generators.js';

// Item kinds: 'pip' (literal), 'gen' (a generator expression for a stretch of
// literal surface, rendered inside literal lists), 'ref' and 'fan' (use a definition).
const isRef = item => item.kind === 'ref' || item.kind === 'fan';
const isLit = item => item.kind === 'pip' || item.kind === 'gen';

const near = (a, b) => Math.abs(a - b) < 1e-9;
const IDENTITY = Object.freeze({ invert: false, retro: false, offset: 0, scale: 1 });
const round9 = x => Math.round(x * 1e9) / 1e9;

// ---------------------------------------------------------------- bit costs
// These mirror src/refactor/cost.js for the strings this module renders.
function numberBits(value) {
  const [p, q] = cruxNumber(value).split('/');
  return integerBits(Number(p)) + (q ? integerBits(Number(q)) : 0);
}
export function pipBits(p, anchor = 0) {
  const head = p.tag === 'r' ? 1 : numberBits(p.step - anchor);
  return near(p.timeScale, 1) ? head : head + 1 + numberBits(p.timeScale);
}
const hasTimeEntry = t => t.retro || !near(t.scale, 1);
function transformListBits(ts) {
  let bits = 2 - 1; // brackets, minus one comma
  for (const t of ts) bits += numberBits(t.offset) + 1 + (hasTimeEntry(t) ? 1 + numberBits(t.retro ? -t.scale : t.scale) : 0);
  return bits;
}
/** Bits of a rendered reference (no separating comma). Offsets are relative to the anchor. */
function refBits(t, nameBits, anchor = 0) {
  let bits = nameBits;
  if (t.invert) bits += 2 + 4 + 2 + 1; // (M m [0])
  const offset = round9(t.offset - anchor);
  if (hasTimeEntry(t) || offset !== 0) bits += 2 + 4 + transformListBits([{ ...t, offset }]);
  if (t.edits?.length) bits += editBits(t.edits);
  return bits;
}
/** (X @ [@i d, @j e]) */
function editBits(edits) {
  return 2 + 4 + 2 - 1 + edits.reduce((n, e) => n + 4 + integerBits(e.i) + numberBits(e.d) + 1, 0);
}
function fanBits(item, nameBits, anchor = 0) {
  const ts = item.ts.map(t => ({ ...t, offset: round9(t.offset - anchor) }));
  const base = nameBits + (item.invert ? 2 + 4 + 2 + 1 : 0);
  if (ts.every(t => t.offset === 0 && !hasTimeEntry(t))) return base + 4 + integerBits(ts.length); // M:k
  return base + 2 + 4 + transformListBits(ts);
}
const nameBitsFor = count => Math.log2(Math.max(2, count + 1));
function itemBits(item, nameBits, anchor) {
  if (item.kind === 'pip') return pipBits(item.pip, anchor) + 1;
  if (item.kind === 'gen') return specBits(item.spec, anchor) + (specBare(item.spec) ? 0 : 2) + 1;
  if (item.kind === 'ref') return refBits(item.t, nameBits, anchor) + 1;
  return fanBits(item, nameBits, anchor) + 1;
}

// ---------------------------------------------------------------- transforms
export function applyTransform(pips, t) {
  const sign = t.invert ? -1 : 1;
  const source = t.retro ? [...pips].reverse() : pips;
  const out = source.map(p => p.tag === 'r'
    ? { step: 0, timeScale: p.timeScale * t.scale, tag: 'r' }
    : { step: round9(sign * p.step + t.offset), timeScale: p.timeScale * t.scale });
  if (t.edits) for (const e of t.edits) out[e.i] = { ...out[e.i], step: round9(out[e.i].step + e.d) };
  return out;
}
/** Composition: apply inner, then outer. */
function compose(outer, inner) {
  if (outer.edits?.length) throw new Error('compose: outer edits must be distributed first');
  const s = outer.invert ? -1 : 1;
  const t = { invert: outer.invert !== inner.invert, retro: outer.retro !== inner.retro,
    offset: round9(s * inner.offset + outer.offset), scale: outer.scale * inner.scale };
  if (inner.edits?.length) {
    t.len = inner.len;
    t.edits = inner.edits.map(e => ({ i: outer.retro ? inner.len - 1 - e.i : e.i, d: s * e.d })).sort((a, b) => a.i - b.i);
  }
  return t;
}
/** Transform mapping exemplar pips onto target pips, preferring fewer operators. */
function findTransform(exemplar, target, options) {
  if (exemplar.length !== target.length) return null;
  let best = null;
  for (const retro of options.retrograde ? [false, true] : [false]) {
    for (const invert of options.inversion ? [false, true] : [false]) {
      const source = retro ? [...exemplar].reverse() : exemplar;
      const sign = invert ? -1 : 1;
      const offset = round9(target[0].step - sign * source[0].step);
      const scale = target[0].timeScale / source[0].timeScale;
      if (!options.augmentation && !near(scale, 1)) continue;
      if (options.integerOffsets && !Number.isInteger(offset)) continue;
      let ok = true;
      for (let i = 0; i < source.length && ok; i++) {
        ok = (source[i].tag === 'r') === (target[i].tag === 'r') &&
          (source[i].tag === 'r' || near(sign * source[i].step + offset, target[i].step)) &&
          near(source[i].timeScale * scale, target[i].timeScale);
      }
      if (!ok) continue;
      const ops = Number(invert) + Number(retro) + Number(offset !== 0) + Number(!near(scale, 1));
      if (!best || ops < best.ops) best = { t: { invert, retro, offset, scale }, ops };
    }
  }
  return best?.t ?? null;
}
/**
 * Variant match: direct transposition (optionally augmented) where at most
 * options.maxEdits notes differ in pitch; rhythm and rests must agree exactly.
 * Returns a transform with `edits` ([{ i, d }]) or null. Exact matches return null.
 */
function findVariant(exemplar, target, options) {
  const n = exemplar.length;
  if (n !== target.length || n < options.variantMinLength) return null;
  const scale = target[0].timeScale / exemplar[0].timeScale;
  if (!options.augmentation && !near(scale, 1)) return null;
  const counts = new Map();
  for (let i = 0; i < n; i++) {
    const a = exemplar[i], b = target[i];
    if ((a.tag === 'r') !== (b.tag === 'r') || !near(a.timeScale * scale, b.timeScale)) return null;
    if (a.tag === 'r') continue;
    const o = round9(b.step - a.step);
    counts.set(o, (counts.get(o) ?? 0) + 1);
  }
  let offset = null, best = -1;
  for (const [o, c] of counts) if (c > best && (!options.integerOffsets || Number.isInteger(o))) { offset = o; best = c; }
  if (offset === null) return null;
  const edits = [];
  for (let i = 0; i < n; i++) {
    if (exemplar[i].tag === 'r') continue;
    const d = round9(target[i].step - exemplar[i].step - offset);
    if (d !== 0) edits.push({ i, d });
  }
  if (!edits.length || edits.length > options.maxEdits) return null;
  return { invert: false, retro: false, offset, scale, len: n, edits };
}

function transformItems(items, t, lengthOf = null) {
  if (t.edits?.length) {
    // Apply the plain transform, then distribute the edits onto the resulting items.
    const { edits, len, ...plain } = t;
    const out = transformItems(items, plain, lengthOf).flatMap(item => item.kind === 'gen' ? genToPips(item) : [item]);
    let start = 0;
    return out.map(item => {
      const n = item.kind === 'pip' ? 1 : lengthOf(item);
      const mine = edits.filter(e => e.i >= start && e.i < start + n).map(e => ({ i: e.i - start, d: e.d }));
      start += n;
      if (!mine.length) return item;
      if (item.kind === 'pip') return { kind: 'pip', pip: { ...item.pip, step: round9(item.pip.step + mine.reduce((a, e) => a + e.d, 0)) } };
      if (item.kind === 'ref') {
        const merged = new Map((item.t.edits ?? []).map(e => [e.i, e.d]));
        for (const e of mine) merged.set(e.i, round9((merged.get(e.i) ?? 0) + e.d));
        const list = [...merged].filter(([, d]) => d !== 0).map(([i, d]) => ({ i, d })).sort((a, b) => a.i - b.i);
        return { kind: 'ref', def: item.def, t: { ...item.t, len: n, edits: list.length ? list : undefined } };
      }
      throw new Error('transformItems: edits inside a fan');
    });
  }
  const source = t.retro ? [...items].reverse() : items;
  const pureOffset = !t.invert && !t.retro && near(t.scale, 1);
  return source.flatMap(item => {
    if (item.kind === 'pip') return [{ kind: 'pip', pip: applyTransform([item.pip], t)[0] }];
    if (item.kind === 'gen') {
      // Generators follow a transposition; anything else turns them back into literal pips.
      if (pureOffset) return [{ kind: 'gen', spec: shiftSpec(item.spec, t.offset), pips: applyTransform(item.pips, t) }];
      return applyTransform(item.pips, t).map(pip => ({ kind: 'pip', pip }));
    }
    if (item.kind === 'ref') return [{ kind: 'ref', def: item.def, t: compose(t, item.t) }];
    const entries = item.ts.map(e => compose(t, { invert: item.invert, retro: e.retro, offset: e.offset, scale: e.scale }));
    if (t.retro) entries.reverse();
    return [{ kind: 'fan', def: item.def, invert: entries[0].invert,
      ts: entries.map(e => ({ offset: e.offset, scale: e.scale, retro: e.retro })) }];
  });
}
const genToPips = item => item.pips.map(pip => ({ kind: 'pip', pip }));

// ---------------------------------------------------------------- state
// state = { defs: Map<id, {id, items}>, seqs: [{ items, anchor, kind }], nextId, history }
const cloneItem = item => isLit(item) ? item : item.kind === 'ref' ? { ...item } : { ...item, ts: item.ts.map(t => ({ ...t })) };
function cloneState(state) {
  const defs = new Map();
  for (const [id, d] of state.defs) defs.set(id, d.frozen ? d : { ...d, items: d.items.map(cloneItem) });
  return { defs, seqs: state.seqs.map(s => ({ ...s, items: s.items.map(cloneItem) })),
    nextId: state.nextId, history: state.history.slice() };
}
function expandItems(items, defs, cache) {
  const out = [];
  for (const item of items) {
    if (item.kind === 'pip') out.push(item.pip);
    else if (item.kind === 'gen') out.push(...item.pips);
    else if (item.kind === 'ref') out.push(...applyTransform(expandDef(item.def, defs, cache), item.t));
    else for (const t of item.ts) out.push(...applyTransform(expandDef(item.def, defs, cache), { invert: item.invert, ...t }));
  }
  return out;
}
function expandDef(id, defs, cache) {
  if (!cache.has(id)) cache.set(id, expandItems(defs.get(id).items, defs, cache));
  return cache.get(id);
}
/** All sequences that can host patterns: streams and definition bodies (anchor 0). */
function hosts(state) {
  const list = state.seqs.map((s, i) => ({ key: `s${i}`, items: s.items, anchor: s.anchor, constraint: s.constraint }));
  for (const [id, d] of state.defs) if (!d.frozen) list.push({ key: `d${id}`, def: id, items: d.items, anchor: 0 });
  return list;
}
function itemsOf(state, key) {
  return key[0] === 's' ? state.seqs[Number(key.slice(1))].items : state.defs.get(Number(key.slice(1))).items;
}
function setItems(state, key, items) {
  if (key[0] === 's') state.seqs[Number(key.slice(1))].items = items;
  else state.defs.get(Number(key.slice(1))).items = items;
}
function stateCost(state) {
  const nameBits = nameBitsFor(state.defs.size);
  let bits = 0;
  for (const h of hosts(state)) {
    for (const item of h.items) bits += itemBits(item, nameBits, h.anchor);
    bits += 2 * literalRuns(h.items, 0, h.items.length);
  }
  return bits + localDefCount(state) * (nameBits + 2);
}
/** Maximal runs of literal pips within items[a, b) (each costs a bracket pair). */
function literalRuns(items, a, b) {
  let runs = 0;
  for (let i = Math.max(0, a); i < Math.min(items.length, b); i++) if (isLit(items[i]) && (i === a || !isLit(items[i - 1]))) runs++;
  return runs;
}
/** Change in bracket bits when items[a, b) of a host become one reference. */
function bracketDelta(items, a, b) {
  const lo = Math.max(0, a - 1), hi = Math.min(items.length, b + 1);
  const before = literalRuns(items, lo, hi);
  const after = (lo < a && isLit(items[lo]) ? 1 : 0) + (hi > b && isLit(items[b]) ? 1 : 0);
  return 2 * (after - before);
}
const localDefCount = state => { let n = 0; for (const d of state.defs.values()) if (!d.frozen) n++; return n; };
function reachableDefs(items, defs, out = new Set()) {
  for (const item of items) {
    if (!isRef(item) || out.has(item.def)) continue;
    out.add(item.def);
    reachableDefs(defs.get(item.def).items, defs, out);
  }
  return out;
}

// ---------------------------------------------------------------- pattern mining
// Rolling hashes over interval tokens. Token k (between pips k and k+1) is
// (step difference, duration ratio). Inversion negates the step difference;
// retrograde reverses token order and negates/inverts each token.
const MOD1 = 2147483647, MOD2 = 2147483629, BASE1 = 1000003, BASE2 = 999983;
// Operands stay below 2^31 and 2^20, so products are exact in doubles (< 2^53).
const mulmod = (a, b, m) => (a * b) % m;
const POW1 = [1], POW2 = [1];
function powers(n) {
  while (POW1.length <= n) {
    POW1.push(mulmod(POW1[POW1.length - 1], BASE1, MOD1));
    POW2.push(mulmod(POW2[POW2.length - 1], BASE2, MOD2));
  }
}

function mineWindows(state, options) {
  const intern = new Map();
  const tokenId = key => {
    let v = intern.get(key);
    if (v === undefined) { v = intern.size + 7; intern.set(key, v); }
    return v;
  };
  powers(options.maxLength + 2);
  const groups = new Map();
  const cache = new Map();
  const nameBits = nameBitsFor(state.defs.size + 1);
  const list = hosts(state);
  for (const host of list) {
    const pips = [], starts = [], prefix = [0];
    for (const item of host.items) {
      starts.push(pips.length);
      pips.push(...expandItems([item], state.defs, cache));
      prefix.push(prefix[prefix.length - 1] + itemBits(item, nameBits, host.anchor));
    }
    starts.push(pips.length);
    Object.assign(host, { pips, starts, prefix });
    const boundary = new Map(starts.map((s, i) => [s, i]));
    const c = host.constraint;
    for (let a = 0; a < host.items.length; a++) {
      const pa = starts[a];
      if (pips[pa].tag === 'r') continue;
      if (c && !c.start[pa]) continue;
      let F1 = 0, F2 = 0, Fi1 = 0, Fi2 = 0, U1 = 0, U2 = 0, Ui1 = 0, Ui2 = 0;
      for (let e = pa + 1; e < pips.length && e - pa < options.maxLength; e++) {
        const prev = pips[e - 1], cur = pips[e];
        if (cur.tag === 'r' || (c && c.cut[e])) break;
        const k = e - pa - 1;
        const d = Math.round((cur.step - prev.step) * 2);
        const r = cruxNumber(cur.timeScale / prev.timeScale), ri = cruxNumber(prev.timeScale / cur.timeScale);
        const tok = tokenId(`${d}:${r}`), tokI = tokenId(`${-d}:${r}`);
        const tokR = tokenId(`${-d}:${ri}`), tokRI = tokenId(`${d}:${ri}`);
        F1 = (F1 + mulmod(tok, POW1[k], MOD1)) % MOD1; F2 = (F2 + mulmod(tok, POW2[k], MOD2)) % MOD2;
        Fi1 = (Fi1 + mulmod(tokI, POW1[k], MOD1)) % MOD1; Fi2 = (Fi2 + mulmod(tokI, POW2[k], MOD2)) % MOD2;
        U1 = (mulmod(U1, BASE1, MOD1) + tokR) % MOD1; U2 = (mulmod(U2, BASE2, MOD2) + tokR) % MOD2;
        Ui1 = (mulmod(Ui1, BASE1, MOD1) + tokRI) % MOD1; Ui2 = (mulmod(Ui2, BASE2, MOD2) + tokRI) % MOD2;
        const b = boundary.get(e + 1);
        if (b === undefined || b - a < 2) continue;
        const len = e + 1 - pa;
        if (len < options.minLength) continue;
        const firstTs = options.augmentation ? '' : cruxNumber(pips[pa].timeScale);
        const lastTs = options.augmentation ? '' : cruxNumber(cur.timeScale);
        let key = `${F1},${F2},${firstTs}`;
        const consider = c => { if (c < key) key = c; };
        if (options.inversion) consider(`${Fi1},${Fi2},${firstTs}`);
        if (options.retrograde) {
          consider(`${U1},${U2},${lastTs}`);
          if (options.inversion) consider(`${Ui1},${Ui2},${lastTs}`);
        }
        key = `${len}|${key}`;
        let group = groups.get(key);
        if (!group) groups.set(key, group = []);
        group.push({ host, a, b, pa, pe: e + 1 });
      }
    }
  }
  return { groups, nameBits, list };
}

/** Integer anchor for a definition body: its first note unless another is cheaper. */
function bodyAnchor(pips) {
  const steps = pips.filter(p => p.tag !== 'r').map(p => p.step);
  const cost = k => steps.reduce((n, s) => n + numberBits(s - k), 0);
  let best = { k: Number.isInteger(steps[0]) ? steps[0] : Math.floor(steps[0]), bits: Infinity };
  best.bits = cost(best.k);
  for (const k of new Set(steps.filter(Number.isInteger))) {
    const bits = cost(k);
    if (bits < best.bits - 1e-9) best = { k, bits };
  }
  return best.k;
}

/** Choose non-overlapping occurrences of one pattern and compute the bit gain. */
function evaluateGroup(windows, options, nameBits, defs) {
  if (windows.length < 2) return null;
  const spanCost = w => w.host.prefix[w.b] - w.host.prefix[w.a] - bracketDelta(w.host.items, w.a, w.b);
  const sorted = [...windows].sort((x, y) => x.host.key < y.host.key ? -1 : x.host.key > y.host.key ? 1 : x.pa - y.pa);
  const chosen = [];
  let lastHost = null, lastEnd = -1;
  for (const w of sorted) {
    if (w.host !== lastHost) { lastHost = w.host; lastEnd = -1; }
    if (w.pa < lastEnd) continue;
    chosen.push(w);
    lastEnd = w.pe;
  }
  if (chosen.length < 2) return null;
  let exemplar = chosen[0];
  for (const w of chosen) if (spanCost(w) < spanCost(exemplar)) exemplar = w;
  const exItems = exemplar.host.items.slice(exemplar.a, exemplar.b);
  const exPips = exemplar.host.pips.slice(exemplar.pa, exemplar.pe);
  // Normalize: write the body around its own register (usually its first note = 0).
  const shift = bodyAnchor(exPips);
  const body = shift === 0 ? exItems : transformItems(exItems, { ...IDENTITY, offset: -shift });
  const bodyPips = exPips.map(p => p.tag === 'r' ? p : { ...p, step: round9(p.step - shift) });
  const reachable = reachableDefs(exItems, defs);
  let gain = -(body.reduce((n, item) => n + itemBits(item, nameBits, 0), 0) + 2 * literalRuns(body, 0, body.length) + nameBits + 2);
  const occurrences = [];
  for (const w of chosen) {
    if (w.host.def !== undefined && reachable.has(w.host.def)) continue;
    const t = findTransform(bodyPips, w.host.pips.slice(w.pa, w.pe), options);
    if (!t) continue;
    occurrences.push({ host: w.host.key, a: w.a, b: w.b, t, anchor: w.host.anchor });
    gain += spanCost(w);
  }
  if (occurrences.length < 2) return null;
  // Reference costs; adjacent occurrences in one host will merge into a fan.
  for (let i = 0; i < occurrences.length;) {
    let j = i + 1;
    while (j < occurrences.length && occurrences[j].host === occurrences[i].host &&
      occurrences[j].a === occurrences[j - 1].b && occurrences[j].t.invert === occurrences[i].t.invert) j++;
    const run = occurrences.slice(i, j);
    const separate = run.reduce((n, o) => n + refBits(o.t, nameBits, o.anchor) + 1, 0);
    const fan = run.length > 1 ? fanBits({ invert: run[0].t.invert, ts: run.map(o => o.t) }, nameBits, run[0].anchor) + 1 : Infinity;
    gain -= Math.min(separate, fan);
    i = j;
  }
  return { gain, body, occurrences, length: exPips.length };
}

/**
 * Near-repeats: seed on exact k-note matches (direct transposition), extend along
 * the diagonal while rhythm agrees, allowing up to maxEdits pitch differences.
 * Each maximal segment pair, snapped to item boundaries, becomes a choice whose
 * second occurrence is a variant reference `(M * [o]) @ [@i d]`.
 */
function allowedWindow(host, pa, pe) {
  const c = host.constraint;
  if (!c) return true;
  if (!c.start[pa]) return false;
  for (let i = pa + 1; i < pe; i++) if (c.cut[i]) return false;
  return true;
}

function mineVariants(list, options, nameBits, defs) {
  const k = options.seedLength;
  const seeds = new Map();
  list.forEach((h, hi) => {
    const p = h.pips;
    h.boundarySet = new Map(h.starts.map((pos, idx) => [pos, idx]));
    for (let i = 0; i + k <= p.length; i++) {
      let key = cruxNumber(p[i].timeScale), ok = p[i].tag !== 'r';
      for (let j = i + 1; j < i + k && ok; j++) {
        if (p[j].tag === 'r') ok = false;
        else key += `;${round9(p[j].step - p[j - 1].step)}:${cruxNumber(p[j].timeScale)}`;
      }
      if (!ok) continue;
      if (!seeds.has(key)) seeds.set(key, []);
      seeds.get(key).push([hi, i]);
    }
  });
  const compatible = (a, b) => a.tag !== 'r' && b.tag !== 'r' && near(a.timeScale, b.timeScale);
  const seen = new Set();
  const choices = [];
  for (const occ of seeds.values()) {
    if (occ.length < 2 || occ.length > options.seedCap) continue;
    for (let x = 0; x < occ.length; x++) for (let y = x + 1; y < occ.length; y++) {
      const [h1, i1] = occ[x], [h2, i2] = occ[y];
      const A = list[h1].pips, B = list[h2].pips, d = i2 - i1;
      let lo = i1, hi = i1 + k; // [lo, hi) in A coordinates
      while (lo - 1 >= 0 && lo - 1 + d >= 0 && compatible(A[lo - 1], B[lo - 1 + d])) lo--;
      while (hi < A.length && hi + d < B.length && compatible(A[hi], B[hi + d])) hi++;
      const regionKey = `${h1}|${h2}|${d}|${lo}`;
      if (seen.has(regionKey)) continue;
      seen.add(regionKey);
      const off = round9(B[i2].step - A[i1].step);
      const mismatch = j => round9(B[j + d].step - A[j].step) !== off;
      // Longest window containing the seed with <= maxEdits mismatches.
      let bestS = i1, bestE = i1 + k, s = lo, count = 0;
      for (let e = lo; e < hi; e++) {
        if (mismatch(e)) count++;
        while (count > options.maxEdits) { if (mismatch(s)) count--; s++; }
        if (s <= i1 && e + 1 >= i1 + k && e + 1 - s > bestE - bestS) { bestS = s; bestE = e + 1; }
      }
      // Snap inward to item boundaries in both hosts.
      const H1 = list[h1], H2 = list[h2];
      let a = bestS, b = bestE;
      while (a < b && !(H1.boundarySet.has(a) && H2.boundarySet.has(a + d))) a++;
      while (b > a && !(H1.boundarySet.has(b) && H2.boundarySet.has(b + d))) b--;
      if (b - a < options.variantMinLength) continue;
      if (h1 === h2 && a + d < b) continue; // overlapping
      let edits = 0;
      for (let j = a; j < b; j++) if (mismatch(j)) edits++;
      if (!edits) continue;
      const w1 = { host: H1, a: H1.boundarySet.get(a), b: H1.boundarySet.get(b), pa: a, pe: b };
      const w2 = { host: H2, a: H2.boundarySet.get(a + d), b: H2.boundarySet.get(b + d), pa: a + d, pe: b + d };
      if (w1.b - w1.a < 2 || w2.b - w2.a < 2) continue;
      if (!allowedWindow(H1, w1.pa, w1.pe) || !allowedWindow(H2, w2.pa, w2.pe)) continue;
      for (const [ex, other] of [[w1, w2], [w2, w1]]) {
        const choice = variantChoice(ex, other, options, nameBits, defs);
        if (choice) choices.push(choice);
      }
    }
  }
  return choices;
}

function variantChoice(ex, other, options, nameBits, defs) {
  const spanCost = w => w.host.prefix[w.b] - w.host.prefix[w.a] - bracketDelta(w.host.items, w.a, w.b);
  const exItems = ex.host.items.slice(ex.a, ex.b);
  const reachable = reachableDefs(exItems, defs);
  if (other.host.def !== undefined && reachable.has(other.host.def)) return null;
  if (ex.host.def !== undefined && reachableDefs(other.host.items.slice(other.a, other.b), defs).has(ex.host.def)) return null;
  const exPips = ex.host.pips.slice(ex.pa, ex.pe);
  const shift = bodyAnchor(exPips);
  const body = shift === 0 ? exItems : transformItems(exItems, { ...IDENTITY, offset: -shift });
  const bodyPips = exPips.map(p => p.tag === 'r' ? p : { ...p, step: round9(p.step - shift) });
  const t1 = findTransform(bodyPips, exPips, options);
  const t2 = findVariant(bodyPips, other.host.pips.slice(other.pa, other.pe), options);
  if (!t1 || !t2) return null;
  const gain = spanCost(ex) + spanCost(other) - body.reduce((n, item) => n + itemBits(item, nameBits, 0), 0) - 2 * literalRuns(body, 0, body.length) - nameBits - 2
    - (refBits(t1, nameBits, ex.host.anchor) + 1) - (refBits(t2, nameBits, other.host.anchor) + 1);
  const occurrences = [
    { host: ex.host.key, a: ex.a, b: ex.b, t: t1, anchor: ex.host.anchor },
    { host: other.host.key, a: other.a, b: other.b, t: t2, anchor: other.host.anchor },
  ];
  return { gain, body, occurrences, length: exPips.length, variant: true };
}

/** Apply up to `limit` choices whose occurrences do not overlap (corpus-scale search). */
function applyBatch(state, choices, limit) {
  const taken = new Map();
  const accepted = [];
  // Cycle guard across the batch: a new body may not reach a definition that hosts
  // another new definition, and vice versa.
  const hostDefs = new Set(), bodyReach = new Set();
  for (const c of choices) {
    if (accepted.length >= limit) break;
    const clash = c.occurrences.some(o => (taken.get(o.host) ?? []).some(([a, b]) => o.a < b && a < o.b));
    if (clash) continue;
    const reach = reachableDefs(c.body, state.defs);
    const hostsOf = c.occurrences.filter(o => o.host[0] === 'd').map(o => Number(o.host.slice(1)));
    if ([...reach].some(id => hostDefs.has(id)) || hostsOf.some(id => bodyReach.has(id))) continue;
    for (const id of reach) bodyReach.add(id);
    for (const id of hostsOf) hostDefs.add(id);
    accepted.push(c);
    for (const o of c.occurrences) {
      if (!taken.has(o.host)) taken.set(o.host, []);
      taken.get(o.host).push([o.a, o.b]);
    }
  }
  const next = cloneState(state);
  const edits = new Map();
  for (const c of accepted) {
    const id = next.nextId++;
    next.defs.set(id, { id, items: c.body.map(cloneItem) });
    next.history.push({ id, gain: c.gain, uses: c.occurrences.length, length: c.length });
    for (const o of c.occurrences) {
      if (!edits.has(o.host)) edits.set(o.host, []);
      edits.get(o.host).push({ ...o, id });
    }
  }
  for (const [key, list] of edits) {
    const items = itemsOf(state, key).slice();
    list.sort((x, y) => y.a - x.a);
    for (const o of list) items.splice(o.a, o.b - o.a, { kind: 'ref', def: o.id, t: o.t });
    setItems(next, key, items);
  }
  return next;
}

function applyAbstraction(state, choice) {
  const next = cloneState(state);
  const id = next.nextId++;
  const byHost = new Map();
  for (const occ of choice.occurrences) {
    if (!byHost.has(occ.host)) byHost.set(occ.host, []);
    byHost.get(occ.host).push(occ);
  }
  for (const [key, occs] of byHost) {
    const items = itemsOf(next, key).slice();
    occs.sort((x, y) => y.a - x.a);
    for (const occ of occs) items.splice(occ.a, occ.b - occ.a, { kind: 'ref', def: id, t: occ.t });
    setItems(next, key, items);
  }
  next.defs.set(id, { id, items: choice.body.map(cloneItem) });
  next.history.push({ id, gain: choice.gain, uses: choice.occurrences.length, length: choice.length });
  return next;
}

// ---------------------------------------------------------------- polishing
function countUses(state) {
  const uses = new Map([...state.defs.keys()].map(id => [id, 0]));
  for (const h of hosts(state)) for (const item of h.items) {
    if (isRef(item)) uses.set(item.def, uses.get(item.def) + (item.kind === 'fan' ? item.ts.length : 1));
  }
  return uses;
}

/** Inline definitions used fewer than twice. */
export function inlineSingletons(state) {
  const current = cloneState(state);
  while (true) {
    const uses = countUses(current);
    const victim = [...uses].find(([id, n]) => n < 2 && !current.defs.get(id).frozen)?.[0];
    if (victim === undefined) return current;
    const body = current.defs.get(victim).items;
    const cache = new Map();
    const lengthOf = item => item.kind === 'gen' ? item.pips.length : item.kind === 'ref' ? expandDef(item.def, current.defs, cache).length
      : item.ts.length * expandDef(item.def, current.defs, cache).length;
    for (const id of current.defs.keys()) expandDef(id, current.defs, cache);
    current.defs.delete(victim);
    for (const h of hosts(current)) {
      setItems(current, h.key, h.items.flatMap(item => {
        if (!isRef(item) || item.def !== victim) return [item];
        if (item.kind === 'ref') return transformItems(body, item.t, lengthOf);
        return item.ts.flatMap(t => transformItems(body, { invert: item.invert, ...t }, lengthOf));
      }));
    }
  }
}

/**
 * Re-parse every sequence from its flat pips by dynamic programming (minimum bits)
 * for the current dictionary. A definition may use only strictly shorter ones,
 * which keeps the grammar acyclic. Unused definitions are then inlined away.
 */
export function reparse(state, options) {
  const cache = new Map();
  const ids = [...state.defs.keys()];
  const expansion = new Map(ids.map(id => [id, expandDef(id, state.defs, cache)]));
  const nameBits = nameBitsFor(state.defs.size);
  const parse = (pips, allowed, anchor, constraint = null) => {
    const n = pips.length;
    const starts = Array.from({ length: n }, () => []);
    // nextCut[i]: first index j > i with a phrase cut before pip j.
    const nextCut = new Int32Array(n + 1).fill(n + 1);
    if (constraint) for (let i = n - 1; i >= 0; i--) nextCut[i] = constraint.cut[i + 1] ? i + 1 : nextCut[i + 1];
    for (const id of allowed) {
      const e = expansion.get(id);
      for (let i = 0; i + e.length <= n; i++) {
        if (pips[i].tag === 'r') continue;
        if (constraint && (!constraint.start[i] || nextCut[i] < i + e.length)) continue;
        const window = pips.slice(i, i + e.length);
        const t = findTransform(e, window, options) ?? (options.variants ? findVariant(e, window, options) : null);
        if (t) starts[i].push({ id, t, len: e.length });
      }
    }
    const gens = options.generators ? generatorCandidates(pips, anchor, options.generators, { factor: options.factor }) : null;
    const dp = new Float64Array(n + 1);
    const edge = new Array(n).fill(null);
    for (let i = n - 1; i >= 0; i--) {
      dp[i] = pipBits(pips[i], anchor) + 1 + dp[i + 1];
      for (const m of starts[i]) {
        const c = refBits(m.t, nameBits, anchor) + 1 + dp[i + m.len];
        if (c < dp[i] - 1e-9) { dp[i] = c; edge[i] = m; }
      }
      if (gens && (!constraint || constraint.start[i])) for (const g of gens[i]) {
        if (constraint && nextCut[i] < i + g.length) continue;
        const c = g.bits + (specBare(g.spec) ? 0 : 2) + 1 + dp[i + g.length];
        if (c < dp[i] - 1e-9) { dp[i] = c; edge[i] = { gen: g, len: g.length }; }
      }
    }
    const items = [];
    for (let i = 0; i < n;) {
      const m = edge[i];
      if (m?.gen) { items.push({ kind: 'gen', spec: m.gen.spec, pips: pips.slice(i, i + m.len) }); i += m.len; }
      else if (m) { items.push({ kind: 'ref', def: m.id, t: m.t }); i += m.len; }
      else { items.push({ kind: 'pip', pip: pips[i] }); i++; }
    }
    return items;
  };
  const next = { defs: new Map(), seqs: [], nextId: state.nextId, history: state.history.slice() };
  for (const id of ids) {
    const def = state.defs.get(id);
    if (def.frozen) { next.defs.set(id, def); continue; }
    const e = expansion.get(id);
    next.defs.set(id, { ...def, items: parse(e, ids.filter(o => o !== id && expansion.get(o).length < e.length), 0) });
  }
  next.seqs = state.seqs.map(s => ({ ...s, items: parse(expandItems(s.items, state.defs, cache), ids, s.anchor, s.constraint) }));
  return inlineSingletons(next);
}

/** Re-anchor each definition body where that saves bits (offsets move into references). */
export function normalizeAnchors(state) {
  const next = cloneState(state);
  const nameBits = nameBitsFor(next.defs.size);
  for (const id of [...next.defs.keys()]) {
    const def = next.defs.get(id);
    if (def.frozen) continue;
    const refs = [];
    for (const h of hosts(next)) for (const item of h.items) if (isRef(item) && item.def === id) refs.push({ item, anchor: h.anchor });
    const bodyCost = items => items.reduce((n, item) => n + itemBits(item, nameBits, 0), 0);
    const shifted = (r, c) => r.item.kind === 'ref'
      ? { ...r.item, t: { ...r.item.t, offset: round9(r.item.t.offset + (r.item.t.invert ? -c : c)) } }
      : { ...r.item, ts: r.item.ts.map(e => ({ ...e, offset: round9(e.offset + (r.item.invert ? -c : c)) })) };
    const refCost = c => refs.reduce((n, r) => n + itemBits(shifted(r, c), nameBits, r.anchor), 0);
    const steps = expandItems(def.items, next.defs, new Map()).filter(p => p.tag !== 'r').map(p => p.step);
    let best = { c: 0, cost: bodyCost(def.items) + refCost(0) };
    for (const c of new Set(steps)) {
      if (!Number.isInteger(c) || c === 0) continue;
      const cost = bodyCost(transformItems(def.items, { ...IDENTITY, offset: -c })) + refCost(c);
      if (cost < best.cost - 1e-9) best = { c, cost };
    }
    if (best.c === 0) continue;
    def.items = transformItems(def.items, { ...IDENTITY, offset: -best.c });
    for (const r of refs) Object.assign(r.item, shifted(r, best.c));
  }
  return next;
}

/** Merge consecutive references to one definition (same inversion) into a fan. */
export function mergeFans(state) {
  const next = cloneState(state);
  const nameBits = nameBitsFor(next.defs.size);
  for (const h of hosts(next)) {
    const items = h.items, out = [];
    for (let i = 0; i < items.length;) {
      const item = items[i];
      if (item.kind !== 'ref' || item.t.edits) { out.push(item); i++; continue; }
      let j = i + 1;
      while (j < items.length && items[j].kind === 'ref' && !items[j].t.edits && items[j].def === item.def && items[j].t.invert === item.t.invert) j++;
      if (j - i >= 2) {
        const fan = { kind: 'fan', def: item.def, invert: item.t.invert,
          ts: items.slice(i, j).map(r => ({ offset: r.t.offset, scale: r.t.scale, retro: r.t.retro })) };
        const separate = items.slice(i, j).reduce((n, r) => n + itemBits(r, nameBits, h.anchor), 0);
        if (itemBits(fan, nameBits, h.anchor) < separate) { out.push(fan); i = j; continue; }
      }
      out.push(item); i++;
    }
    setItems(next, h.key, out);
  }
  return next;
}

// ---------------------------------------------------------------- rendering
function renderTransformList(ts) {
  return '[' + ts.map(t => hasTimeEntry(t)
    ? `${cruxNumber(t.offset)} | ${cruxNumber(t.retro ? -t.scale : t.scale)}`
    : cruxNumber(t.offset)).join(', ') + ']';
}
function renderRef(name, t) {
  let expr = t.invert ? `(${name} m [0])` : name;
  if (hasTimeEntry(t) || t.offset !== 0) expr = `(${expr} * ${renderTransformList([t])})`;
  if (t.edits?.length) expr = `(${expr} @ [${t.edits.map(e => `@${e.i} ${cruxNumber(e.d)}`).join(', ')}])`;
  return expr;
}
function renderItems(items, names) {
  const parts = [];
  let run = [];
  // A run of literal items is one mot; generators sit inside it (bare `[a, b]/`
  // or parenthesized). A run made only of generators is written without a list.
  const flush = () => {
    if (!run.length) return;
    if (run.every(i => i.kind === 'gen')) parts.push(...run.map(i => specText(i.spec)));
    else parts.push('[' + run.map(i => i.kind === 'pip' ? pipText(i.pip)
      : specBare(i.spec) ? specText(i.spec) : `(${specText(i.spec)})`).join(', ') + ']');
    run = [];
  };
  for (const item of items) {
    if (isLit(item)) { run.push(item); continue; }
    flush();
    const name = names.get(item.def);
    if (item.kind === 'ref') { parts.push(renderRef(name, item.t)); continue; }
    const base = item.invert ? `(${name} m [0])` : name;
    const allZero = item.ts.every(t => t.offset === 0 && !hasTimeEntry(t));
    parts.push(allZero ? `${base}:${item.ts.length}` : `(${base} * ${renderTransformList(item.ts)})`);
  }
  flush();
  return { text: parts.join(', '), count: parts.length };
}
/** A stream: items written relative to the stream anchor, wrapped `(...) * [k]`. */
function renderStream(seq, names) {
  const items = seq.anchor ? transformItems(seq.items, { ...IDENTITY, offset: -seq.anchor }) : seq.items;
  const { text, count } = renderItems(items, names);
  if (!seq.anchor) return { text, count };
  return { text: `${count > 1 ? `(${text})` : text} * [${cruxNumber(seq.anchor)}]`, count: 1 };
}
function orderDefs(state) {
  const order = [], seen = new Set();
  const visit = id => {
    if (seen.has(id)) return;
    seen.add(id);
    for (const item of state.defs.get(id).items) if (isRef(item)) visit(item.def);
    order.push(id);
  };
  for (const id of [...state.defs.keys()].sort((a, b) => a - b)) visit(id);
  return order;
}
/**
 * Render a state. layout[i] is { stream: s } or { pitch: p, rhythm: q } for voice i.
 * Pitch definitions are named M1.., rhythm definitions R1..
 */
export function renderState(state, layout, { voiceLabels = null, offsets = false } = {}) {
  const order = orderDefs(state);
  const rhythmDefs = new Set();
  const markRhythm = items => { for (const item of items) if (isRef(item) && !rhythmDefs.has(item.def)) { rhythmDefs.add(item.def); markRhythm(state.defs.get(item.def).items); } };
  state.seqs.forEach(s => { if (s.kind === 'rhythm') markRhythm(s.items); });
  const names = new Map();
  let m = 0, r = 0;
  for (const id of order) {
    const def = state.defs.get(id);
    names.set(id, def.frozen ? def.name : rhythmDefs.has(id) ? `R${++r}` : `M${++m}`);
  }
  // Library (frozen) definitions actually used, with their dependencies.
  const usedLibrary = new Set();
  const visit = items => { for (const item of items) if (isRef(item)) {
    const def = state.defs.get(item.def);
    if (def.frozen && !usedLibrary.has(item.def)) { usedLibrary.add(item.def); visit(def.items); }
    else if (!def.frozen) visit(def.items);
  } };
  state.seqs.forEach(s => visit(s.items));
  const line = id => `${names.get(id)} = ${renderItems(state.defs.get(id).items, names).text}`;
  const libraryLines = order.filter(id => usedLibrary.has(id)).map(line);
  const localLines = order.filter(id => !state.defs.get(id).frozen).map(line);
  const wrap = ({ text, count }) => count > 1 ? `(${text})` : text;
  // With offsets, a joint voice that opens with a rest enters via `!N` instead.
  const entries = layout.map((entry, i) => {
    const label = voiceLabels ? `// ${voiceLabels[i]}\n` : '';
    if (entry.stream !== undefined) {
      const seq = state.seqs[entry.stream];
      const first = seq.items[0];
      if (offsets && i > 0 && first?.kind === 'pip' && first.pip.tag === 'r' && seq.items.length > 1) {
        return { offset: first.pip.timeScale, text: label + renderStream({ ...seq, items: seq.items.slice(1) }, names).text };
      }
      return { offset: 0, text: label + renderStream(seq, names).text };
    }
    return { offset: 0, text: label + `${wrap(renderStream(state.seqs[entry.pitch], names))} . ${wrap(renderStream(state.seqs[entry.rhythm], names))}` };
  });
  const body = entries.map((e, i) => i === 0 ? e.text : `\n!${e.offset ? cruxNumber(e.offset) : ''}\n${e.text}`).join('');
  return { code: [...libraryLines, ...localLines, body].join('\n'), localCode: [...localLines, body].join('\n'),
    names, libraryNames: new Set([...usedLibrary].map(id => names.get(id))) };
}

// ---------------------------------------------------------------- search
export const DEFAULTS = {
  streams: 'auto',           // 'joint' | 'factored' | 'auto' (best of both)
  minLength: 2, maxLength: 48,
  inversion: true, retrograde: true, augmentation: false, integerOffsets: true,
  transforms: 'auto',        // 'auto': also try transposition-only search; 'given': use the flags above
  anchors: true,             // write each voice relative to its register: (...) * [k]
  beamWidth: 1, branching: 1, maxSteps: 400, minGain: 0.5,
  reparse: true, normalize: true,
  variants: false, maxEdits: 2, variantMinLength: 6, seedLength: 4, seedCap: 40,
  batch: 1,                  // >1: apply that many non-overlapping abstractions per step
  library: null,             // frozen shared definitions (see learnLibrary)
  restarts: 0, temperature: 8, sampleFrom: 6, seed: 1,  // stochastic restarts (0 = deterministic only)
  generators: null,          // a buildGenerators() dictionary: atoms made into surface by operators
  factor: true,              // with generators: also try fan (atom * path) and cog (skeleton . [atom/]) factorizations
};

/** Verify a program reproduces the voices' pips exactly, through the real interpreter. */
export function verifyProgram(code, voices) {
  try {
    const sections = globalThis.golden.crux_interp(code).sections;
    return sections.length === voices.length && sections.every((section, i) =>
      section.values.length === voices[i].length && section.values.every((p, j) => {
        const e = voices[i][j];
        return !p.diad && (p.tag ?? null) === (e.tag ?? null) && (e.tag === 'r' || near(p.step, e.step)) && near(p.timeScale, e.timeScale);
      }));
  } catch { return false; }
}

/** Register anchor: the integer minimizing the literal bits of a stream. */
function bestAnchor(pips) {
  const steps = pips.filter(p => p.tag !== 'r').map(p => p.step);
  if (!steps.length) return 0;
  let best = { k: 0, bits: steps.reduce((n, s) => n + numberBits(s), 0) };
  for (let k = Math.floor(Math.min(...steps)); k <= Math.ceil(Math.max(...steps)); k++) {
    const bits = steps.reduce((n, s) => n + numberBits(s - k), 0) + 2 + 4 + 2 + numberBits(k) + 2;
    if (bits < best.bits - 1e-9) best = { k, bits };
  }
  return best.k;
}

const toItem = pip => ({ kind: 'pip', pip: pip.tag === 'r'
  ? { step: 0, timeScale: pip.timeScale, tag: 'r' } : { step: pip.step, timeScale: pip.timeScale } });

function initialState(voices, mode, options) {
  const seqs = [], layout = [];
  voices.forEach((voice, v) => {
    const constraint = options.constraints?.[v] ?? null;
    if (mode === 'joint') {
      layout.push({ stream: seqs.length });
      seqs.push({ kind: 'joint', anchor: options.anchors ? bestAnchor(voice) : 0, items: voice.map(toItem), constraint });
    } else {
      const pitch = voice.map(p => p.tag === 'r' ? { step: 0, timeScale: 1, tag: 'r' } : { step: p.step, timeScale: 1 });
      const rhythm = voice.map(p => ({ step: 0, timeScale: p.timeScale }));
      layout.push({ pitch: seqs.length, rhythm: seqs.length + 1 });
      seqs.push({ kind: 'pitch', anchor: options.anchors ? bestAnchor(pitch) : 0, items: pitch.map(toItem), constraint });
      seqs.push({ kind: 'rhythm', anchor: 0, items: rhythm.map(toItem), constraint });
    }
  });
  const defs = new Map();
  if (options.library) for (const [id, d] of options.library.defs) defs.set(id, d);
  return { state: { defs, seqs, nextId: 1, history: [] }, layout };
}

function search(start, options) {
  let beam = [start];
  start.cost = stateCost(start);
  let best = start;
  for (let step = 0; step < options.maxSteps && beam.length; step++) {
    const expanded = [];
    for (const state of beam) {
      const { groups, nameBits, list } = mineWindows(state, options);
      const choices = [];
      for (const windows of groups.values()) {
        const choice = evaluateGroup(windows, options, nameBits, state.defs);
        if (choice && choice.gain > options.minGain) choices.push(choice);
      }
      if (options.variants) for (const choice of mineVariants(list, options, nameBits, state.defs)) {
        if (choice.gain > options.minGain) choices.push(choice);
      }
      choices.sort((x, y) => y.gain - x.gain || y.length - x.length);
      if (options.random && choices.length > 1) {
        // Stochastic search: sample among the top choices, weight exp(gain / temperature).
        const top = choices.slice(0, options.sampleFrom);
        const w = top.map(c => Math.exp((c.gain - top[0].gain) / options.temperature));
        let r = options.random() * w.reduce((a, b) => a + b, 0), k = 0;
        while (k < top.length - 1 && (r -= w[k]) > 0) k++;
        choices.unshift(...choices.splice(k, 1));
      }
      if (options.batch > 1) { if (choices.length) expanded.push(applyBatch(state, choices, options.batch)); }
      else for (const choice of choices.slice(0, options.branching)) expanded.push(applyAbstraction(state, choice));
    }
    if (!expanded.length) break;
    for (const s of expanded) s.cost = stateCost(s);
    expanded.sort((x, y) => x.cost - y.cost);
    beam = expanded.slice(0, options.beamWidth);
    if (beam[0].cost < best.cost) best = beam[0];
  }
  // The start is always a candidate: the approximate costs can mislead.
  return [...new Set([best, start, ...beam])];
}

function polish(state, options) {
  let current = inlineSingletons(state);
  if (options.reparse) {
    for (let round = 0; round < 4; round++) {
      const next = reparse(current, options);
      if (stateCost(next) >= stateCost(current) - 1e-9) break;
      current = next;
    }
  }
  if (options.normalize) current = normalizeAnchors(current);
  return mergeFans(current);
}

/**
 * Refactor voices of pips ({step, timeScale, tag?}) into a hierarchical motif grammar.
 * Returns { code, bits, literalBits, saving, mode, defs, verified, state, layout }.
 * literalBits is the plain literal program (one bracketed mot per voice).
 */
export function refactorVoices(voices, settings = {}) {
  const options = { ...DEFAULTS, ...settings };
  const modes = options.streams === 'auto' ? ['joint', 'factored'] : [options.streams];
  let result = null;
  const library = options.library;
  const measure = rendered => library
    ? programBits(rendered.localCode, { external: library.names, extraNames: library.defs.size }).bits
    : programBits(rendered.code).bits;
  // A larger transformation group can mislead a greedy search (coincidental
  // inverted/retrograde matches crowd out exact ones), so 'auto' also tries
  // transposition only and keeps the shorter result.
  const groups = [{ inversion: options.inversion, retrograde: options.retrograde }];
  if (options.transforms === 'auto' && (options.inversion || options.retrograde)) groups.push({ inversion: false, retrograde: false });
  const runs = [];
  for (const mode of modes) for (const group of groups) for (let restart = 0; restart <= options.restarts; restart++) runs.push({ mode, group, restart });
  for (const { mode, group, restart } of runs) {
    const base = { ...options, ...group };
    let { state, layout } = initialState(voices, mode, base);
    // Start from the library's parse and/or the generators' parse.
    if (library || options.generators) state = reparse(state, base);
    // Restart 0 is the deterministic search; later restarts sample choices.
    const runOptions = restart === 0 ? base : { ...base, random: mulberry32(options.seed + restart) };
    for (const candidate of search(state, runOptions)) {
      const polished = polish(candidate, runOptions);
      const rendered = renderState(polished, layout, { voiceLabels: options.voiceLabels, offsets: options.offsets });
      const bits = measure(rendered);
      if (!result || bits < result.bits) result = { state: polished, layout, code: rendered.code, localCode: rendered.localCode, bits, mode };
    }
  }
  const plain = voices.map((v, i) => (options.voiceLabels ? `// ${options.voiceLabels[i]}\n` : '') +
    `[${v.map(pipText).join(', ')}]`).join('\n!\n');
  const literalBits = programBits(plain).bits;
  const anchored = initialState(voices, 'joint', { ...options, anchors: true });
  const anchoredBits = programBits(renderState(anchored.state, anchored.layout).code).bits;
  result.verified = verifyProgram(result.code, voices);
  return { ...result, literalBits, anchoredBits, saving: 1 - result.bits / literalBits,
    savingVsAnchored: 1 - result.bits / anchoredBits, defs: localDefCount(result.state),
    libraryUses: library ? countLibraryUses(result.state) : 0 };
}

/** Small deterministic PRNG for reproducible stochastic restarts. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function countLibraryUses(state) {
  let n = 0;
  for (const h of hosts(state)) for (const item of h.items) if (isRef(item) && state.defs.get(item.def).frozen) n += item.kind === 'fan' ? item.ts.length : 1;
  return n;
}

/**
 * Corpus-level library learning: one grammar over the voices of many pieces.
 * pieces: array of voice arrays. Definitions used by at least `minPieces` pieces
 * (directly or through other definitions), plus their dependencies, form a frozen
 * library { defs: Map<id, def>, names: Set, stats }, usable via settings.library.
 */
export function learnLibrary(pieces, settings = {}) {
  // Transposition only by default: on the chorales it learns a smaller library
  // that compresses held-out pieces better than the full transformation group.
  const options = { ...DEFAULTS, streams: 'joint', reparse: false, batch: 64, minPieces: 3,
    inversion: false, retrograde: false, ...settings };
  const voices = pieces.flat();
  const pieceOf = pieces.flatMap((voicesOfPiece, p) => voicesOfPiece.map(() => p));
  const { state } = initialState(voices, 'joint', { ...options, library: null });
  const [best] = search(state, options);
  const learned = inlineSingletons(best);
  // Which pieces use each definition (transitively)?
  const usedBy = new Map([...learned.defs.keys()].map(id => [id, new Set()]));
  const uses = new Map([...learned.defs.keys()].map(id => [id, 0]));
  const mark = (items, piece, seen) => {
    for (const item of items) if (isRef(item)) {
      uses.set(item.def, uses.get(item.def) + (item.kind === 'fan' ? item.ts.length : 1));
      if (seen.has(item.def)) continue;
      seen.add(item.def);
      usedBy.get(item.def).add(piece);
      mark(learned.defs.get(item.def).items, piece, seen);
    }
  };
  learned.seqs.forEach((s, i) => mark(s.items, pieceOf[i], new Set()));
  const keep = new Set([...usedBy].filter(([, ps]) => ps.size >= options.minPieces).map(([id]) => id));
  for (const id of [...keep]) for (const dep of reachableDefs(learned.defs.get(id).items, learned.defs)) keep.add(dep);
  // Rank by coverage, rename L1.., remap ids to negatives (never clash with local ids).
  const ranked = [...keep].sort((a, b) => usedBy.get(b).size - usedBy.get(a).size || uses.get(b) - uses.get(a) || a - b);
  const idMap = new Map(ranked.map((id, i) => [id, -(i + 1)]));
  const remap = items => items.map(item => !isRef(item) ? item : { ...cloneItem(item), def: idMap.get(item.def) });
  const cache = new Map();
  const defs = new Map(), names = new Set(), stats = [];
  ranked.forEach((id, i) => {
    const name = `L${i + 1}`;
    defs.set(-(i + 1), { id: -(i + 1), name, frozen: true, items: remap(learned.defs.get(id).items) });
    names.add(name);
    stats.push({ name, pieces: usedBy.get(id).size, uses: uses.get(id), length: expandDef(id, learned.defs, cache).length,
      pieceIndices: [...usedBy.get(id)].sort((a, b) => a - b) });
  });
  const library = { defs, names, stats };
  library.code = renderLibrary(library);
  library.bits = programBits(library.code).bits;
  return library;
}

/** Library prelude as Crux text (definitions in dependency order). */
export function renderLibrary(library) {
  const names = new Map([...library.defs].map(([id, d]) => [id, d.name]));
  // Rank order (L1 first: ids are -1, -2, ...), each definition after its dependencies.
  const order = [], seen = new Set();
  const visit = id => {
    if (seen.has(id)) return;
    seen.add(id);
    for (const item of library.defs.get(id).items) if (isRef(item)) visit(item.def);
    order.push(id);
  };
  for (const id of [...library.defs.keys()].sort((a, b) => b - a)) visit(id);
  return order.map(id => `${names.get(id)} = ${renderItems(library.defs.get(id).items, names).text}`).join('\n');
}

/**
 * Every use of every definition, located in voice pip coordinates (nested uses
 * included): [{ def, voice, stream, start, length, t }]. For factored voices the
 * pitch and rhythm streams are reported separately (stream: 'pitch' | 'rhythm').
 */
export function locateOccurrences(state, layout) {
  const cache = new Map();
  const out = [];
  // Uses inside a definition body, at absolute positions (mirrored if retrograde).
  const nestedPositions = (defId, base, retro, voice, stream) => {
    const len = expandDef(defId, state.defs, cache).length;
    let pos = 0;
    for (const item of state.defs.get(defId).items) {
      if (item.kind === 'pip') { pos++; continue; }
      if (item.kind === 'gen') { pos += item.pips.length; continue; }
      const l = expandDef(item.def, state.defs, cache).length;
      const count = item.kind === 'fan' ? item.ts.length : 1;
      for (let k = 0; k < count; k++) {
        const t = item.kind === 'ref' ? item.t : { invert: item.invert, ...item.ts[k] };
        const start = retro ? base + len - (pos + l) : base + pos;
        out.push({ def: item.def, voice, stream, start, length: l, t, nested: true });
        nestedPositions(item.def, start, retro !== !!t.retro, voice, stream);
        pos += l;
      }
    }
  };
  layout.forEach((entry, voice) => {
    const streams = entry.stream !== undefined ? [['joint', entry.stream]] : [['pitch', entry.pitch], ['rhythm', entry.rhythm]];
    for (const [stream, index] of streams) {
      let pos = 0;
      for (const item of state.seqs[index].items) {
        if (item.kind === 'pip') { pos++; continue; }
        if (item.kind === 'gen') { pos += item.pips.length; continue; }
        const len = expandDef(item.def, state.defs, cache).length;
        const ts = item.kind === 'ref' ? [item.t] : item.ts.map(t => ({ invert: item.invert, ...t }));
        for (const t of ts) {
          out.push({ def: item.def, voice, stream, start: pos, length: len, t, nested: false });
          nestedPositions(item.def, pos, !!t.retro, voice, stream);
          pos += len;
        }
      }
    }
  });
  return out;
}
