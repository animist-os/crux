// Kernels: a small hierarchy of mots that approximates a score's surface.
//
// A kernel is written as plain Crux:
//   level 1  beat figures      A1 = [0 | 1/2, -1 | 1/2]       (one beat each)
//   level 2  measure shapes    B1 = A2, (A1 * [-1]), A1, (A3 * [1])
//   level 3  groups of shapes  C1 = B1, (B2 * [-2])           (optional)
//   voices                     (C1 * [7]), (C2 * [5]), ...
// The codebooks are shared by all voices. Each data chunk is replaced by its
// nearest prototype (weighted k-medoids on time-grid distance), so the program
// approximates the surface. Changing one pip of a prototype changes every place
// that uses it, in every voice: the kernel is meant to be wiggled.
//
// Nothing here claims exactness. fitKernel() measures how much of the surface
// the kernel reproduces, through the real interpreter.
import '../index.js';
import { cruxNumber } from '../score/to-crux.js';
import { meterAt } from '../score/to-crux.js';
import { stepNumbers } from './wiggle.js';

export const SLOTS = 24; // grid slots per quarter note
const num = cruxNumber;
const slotsOf = quarters => Math.round(quarters * SLOTS);

// ---------------------------------------------------------------- surface
/** A voice's pips as a timeline of segments { a, b, step|null } in slots. */
export function timeline(pips) {
  const out = [];
  let t = 0;
  for (const p of pips) {
    const len = slotsOf(p.timeScale);
    out.push({ a: t, b: t + len, step: p.tag === 'r' ? null : p.step });
    t += len;
  }
  return out;
}

/** Grid of a timeline: pitch per slot (null = rest) and onset flags. */
export function gridOf(segments, length = null) {
  const end = length ?? (segments.length ? segments[segments.length - 1].b : 0);
  const pitch = new Array(end).fill(null), onset = new Uint8Array(end);
  for (const s of segments) {
    for (let x = Math.max(0, s.a); x < Math.min(end, s.b); x++) pitch[x] = s.step;
    if (s.a >= 0 && s.a < end && s.step !== null) onset[s.a] = 1;
  }
  return { pitch, onset, length: end };
}

/** Beat and measure boundaries (slots), from the score's measures and meter. */
export function metricBoundaries(score) {
  const ppq = score.ppq;
  const measures = score.measures.map(m => slotsOf(m.tick / ppq));
  const end = score.measures.length ? slotsOf((score.measures.at(-1).tick + score.measures.at(-1).durationTicks) / ppq) : 0;
  const beats = new Set();
  for (const m of score.measures) {
    const meter = meterAt(score, m.tick);
    const beat = slotsOf(meter.beatTicks / ppq);
    const full = slotsOf(meter.beats * 4 / meter.beatType);
    const a = slotsOf(m.tick / ppq), len = slotsOf(m.durationTicks / ppq);
    // A short first measure is a pickup: its beats align with its end.
    const phase = m.index === 0 && len < full ? (full - len) % beat : 0;
    for (let x = a + ((beat - phase) % beat); x < a + len; x += beat) beats.add(x);
    beats.add(a);
  }
  return { beats: [...beats].sort((x, y) => x - y), measures: [...measures, end], end };
}

// ---------------------------------------------------------------- level 1: beat figures
/**
 * Split a voice into chunks at the given boundaries. A chunk's figure lists its
 * segments relative to its first sounding pitch (the chunk offset).
 */
export function chunkVoice(segments, bounds, end) {
  const out = [];
  const points = [...bounds.filter(x => x < end), end];
  if (points[0] > 0) points.unshift(0);
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i], b = points[i + 1];
    if (b <= a) continue;
    const parts = segments.filter(s => s.b > a && s.a < b).map(s => ({ a: Math.max(s.a, a) - a, b: Math.min(s.b, b) - a, step: s.step, onset: s.a >= a }));
    const first = parts.find(p => p.step !== null);
    const offset = first ? first.step : null;
    const figure = parts.map(p => ({ rel: p.step === null ? null : p.step - offset, len: p.b - p.a, onset: p.onset }));
    out.push({ a, b, offset, figure, key: figureKey(figure) });
  }
  return out;
}
const figureKey = fig => fig.map(f => `${f.rel === null ? 'r' : num(f.rel)}:${f.len}:${f.onset ? 1 : 0}`).join(' ');

function figureGrid(fig) {
  const len = fig.reduce((n, f) => n + f.len, 0);
  const pitch = new Array(len).fill(null), onset = new Uint8Array(len);
  let t = 0;
  for (const f of fig) {
    for (let x = t; x < t + f.len; x++) pitch[x] = f.rel;
    if (f.rel !== null && f.onset) onset[t] = 1;
    t += f.len;
  }
  return { pitch, onset, length: len };
}

/** Time-grid distance between two relative grids of equal length (0..1.5). */
export function gridDistance(g, h) {
  if (g.length !== h.length) return Infinity;
  let pm = 0, om = 0;
  for (let x = 0; x < g.length; x++) {
    if (g.pitch[x] !== h.pitch[x]) pm++;
    if (g.onset[x] !== h.onset[x]) om++;
  }
  return (pm + 0.5 * om) / g.length;
}

// ---------------------------------------------------------------- clustering
/**
 * Weighted k-medoids. items: [{ key, weight, grid }]. Returns { medoids: [index],
 * assign: Map<key, medoidIndex> }. Items of different lengths never share a
 * medoid; each length class gets a share of k (at least one).
 */
export function kMedoids(items, k, { invert = false } = {}) {
  const classes = new Map();
  for (const it of items) {
    if (!classes.has(it.grid.length)) classes.set(it.grid.length, []);
    classes.get(it.grid.length).push(it);
  }
  const totalWeight = items.reduce((n, it) => n + it.weight, 0);
  const medoids = [], assign = new Map();
  for (const members of classes.values()) {
    const w = members.reduce((n, it) => n + it.weight, 0);
    const kc = Math.max(1, Math.min(members.length, Math.round(k * w / totalWeight)));
    const chosen = clusterClass(members, kc, invert);
    for (const [key, m] of chosen.assign) assign.set(key, { proto: medoids.length + m.proto, inv: m.inv });
    medoids.push(...chosen.medoids);
  }
  return { medoids, assign };
}

/** A relative grid turned upside down (diatonic inversion about its first pitch). */
export function invertGrid(g) {
  return { pitch: g.pitch.map(x => x === null ? null : -x), onset: g.onset, length: g.length };
}

function clusterClass(members, k, invert) {
  const n = members.length;
  const inverted = invert ? members.map(m => invertGrid(m.grid)) : null;
  // Distance of item i to medoid j, and whether i matches j upside down.
  const dd = (i, j) => {
    const up = gridDistance(members[i].grid, members[j].grid);
    if (!invert) return [up, false];
    const down = gridDistance(inverted[i], members[j].grid);
    return down < up ? [down, true] : [up, false];
  };
  const d = (i, j) => dd(i, j)[0];
  // Weighted farthest-first initialization from the most frequent item.
  let first = 0;
  for (let i = 1; i < n; i++) if (members[i].weight > members[first].weight) first = i;
  const meds = [first];
  const near = members.map((_, i) => d(i, first));
  while (meds.length < k) {
    let best = -1, score = -1;
    for (let i = 0; i < n; i++) { const s = members[i].weight * near[i]; if (s > score) { score = s; best = i; } }
    if (score <= 0) break;
    meds.push(best);
    for (let i = 0; i < n; i++) near[i] = Math.min(near[i], d(i, best));
  }
  // Alternate assignment and medoid update.
  let assignment = new Array(n).fill(0);
  for (let iter = 0; iter < 12; iter++) {
    for (let i = 0; i < n; i++) {
      let bi = 0, bd = Infinity;
      meds.forEach((m, j) => { const x = d(i, m); if (x < bd) { bd = x; bi = j; } });
      assignment[i] = bi;
    }
    let changed = false;
    meds.forEach((m, j) => {
      const group = [];
      for (let i = 0; i < n; i++) if (assignment[i] === j) group.push(i);
      let best = m, cost = Infinity;
      for (const c of group) {
        let s = 0;
        for (const i of group) s += members[i].weight * d(i, c);
        if (s < cost - 1e-12) { cost = s; best = c; }
      }
      if (best !== m) { meds[j] = best; changed = true; }
    });
    if (!changed) break;
  }
  return { medoids: meds.map(i => members[i]), assign: new Map(members.map((it, i) => [it.key, { proto: assignment[i], inv: dd(i, meds[assignment[i]])[1] }])) };
}

// ---------------------------------------------------------------- building the kernel
/**
 * Build a kernel for the voices of a converted score.
 * options:
 *   k1, k2     codebook sizes for beat figures (A) and measure shapes (B).
 *              k2 = 0 (default) skips measure shapes, so phrases keep their pickups.
 *   k3, group3 optional level C over groups of `group3` measures (k3 = 0: off)
 *   invert     a chunk may match a prototype upside down: (A1 m [0])
 *   harmony    voices read a shared bass line: (H . [intervals]) . [B...]. Needs k2 > 0.
 *   phrases    exact transposing Re-Pair over the top level (default on; off with harmony)
 *   lossy      price (numbers per quarter of extra error) for approximate repeats
 * Returns { code, levels, units, controls, phrases, harmony }.
 */
export function buildKernel(score, converted, options = {}) {
  return buildKernelMany([{ score, converted }], options);
}

/**
 * One kernel for several pieces: the codebooks and phrases are shared by every
 * voice of every piece. pieces: [{ score, converted, label? }]. With
 * options.stagger each piece enters after the previous one (`!N`).
 */
export function buildKernelMany(pieces, options = {}) {
  const { k1 = 8, k2 = 0, k3 = 0, group3 = 2, invert = false } = options;
  if (options.harmony && pieces.length !== 1) throw new Error('harmony needs a single piece');
  // Level 1: beat figures, pooled across voices.
  // A beat is a boundary only where no note sounds across it, so a half note on
  // beat 1 is one two-beat figure (Crux has no ties). With harmony every barline
  // is one (each voice needs one figure per measure), so a note tied over a
  // barline is struck again.
  const voiceInfo = [], voiceChunks = [];
  let enter = 0;
  for (const { score, converted, label } of pieces) {
    const { beats, measures } = metricBoundaries(score);
    const bars = new Set(measures);
    let length = 0;
    converted.voices.forEach((v, i) => {
      const segs = timeline(v);
      const vEnd = segs.length ? segs[segs.length - 1].b : 0;
      length = Math.max(length, vEnd);
      const open = beats.filter(x => (options.harmony && bars.has(x)) || !segs.some(s => s.step !== null && s.a < x && x < s.b));
      voiceChunks.push(chunkVoice(segs, open, vEnd));
      const role = converted.lanes[i].role ?? converted.lanes[i].name;
      voiceInfo.push({ label: label ? `${label} ${role}` : role, measures, voice: v, enter: options.stagger ? enter : 0 });
    });
    enter += length / SLOTS;
  }
  const measures = voiceInfo[0]?.measures ?? [0];
  const l1 = codebook(voiceChunks.flat(), c => figureGrid(c.figure), k1, invert);
  const l1Grids = l1.medoids.map(m => figureGrid(m.figure));
  // Units at level 1: { proto, inv, offset, a, b }.
  let units = voiceChunks.map(chunks => chunks.map(c => ({ ...l1.assign.get(c.key), offset: c.offset, a: c.a, b: c.b })));
  const levels = [{ name: 'A', protos: l1.medoids.map(m => ({ kind: 'figure', figure: m.figure })), grids: l1Grids }];

  // Level 2: measures; level 3: groups of `group3` measures.
  const groupings = k2 > 0 ? [{ name: 'B', k: k2, bounds: true }] : [];
  if (k3 > 0) groupings.push({ name: 'C', k: k3, every: group3 });
  for (const g of groupings) {
    const childGrids = levels[levels.length - 1].grids;
    const grouped = units.map((us, v) => g.bounds ? groupByBounds(us, voiceInfo[v].measures) : groupByCount(us, g.every));
    const all = grouped.flat();
    const lv = codebook(all, chunk => patternGrid(chunk.pattern, childGrids), g.k, invert);
    const grids = lv.medoids.map(m => patternGrid(m.pattern, childGrids));
    levels.push({ name: g.name, protos: lv.medoids.map(m => ({ kind: 'pattern', pattern: m.pattern })), grids });
    units = grouped.map(chunks => chunks.map(c => ({ ...lv.assign.get(c.key), offset: c.offset, a: c.a, b: c.b })));
  }
  const harmony = options.harmony ? harmonyLine(units, measures) : null;
  const top = levels[levels.length - 1];
  let phrases = null;
  if (!harmony && options.lossy != null) {
    // Exact phrases first, then approximate repeats over them, then exact again.
    const exact = inducePhrases(units, top.name);
    const gridOfSym = symGrids(top, exact.rules);
    const lossy = lossyPhrases(exact.seqs, exact.rules, gridOfSym, voiceInfo.map(v => gridOf(timeline(v.voice))), options.lossy, options);
    phrases = repairTokens(lossy.seqs, lossy.rules);
  } else if (!harmony && options.phrases !== false) phrases = inducePhrases(units, top.name);
  return { ...renderKernel(levels, units, voiceInfo, phrases, harmony), levels, units, phrases, harmony,
    voices: voiceInfo.map(v => v.voice), enters: voiceInfo.map(v => v.enter) };
}

// ---------------------------------------------------------------- harmony line (shared skeleton)
/**
 * One step per measure, shared by every voice: the bass's offset in that measure
 * (the lowest voice). Each voice then reads H . [its intervals above H] . [its
 * figures], so a number in H moves all voices of its measure together.
 * Only voices with exactly one unit per measure take part.
 */
function harmonyLine(units, measures) {
  const count = measures.length - 1;
  const aligned = units.map(us => us.length === count && us.every((u, m) => u.a === measures[m]));
  const bassIndex = aligned.lastIndexOf(true);
  if (bassIndex < 0) return null;
  const line = [];
  let last = 0;
  for (let m = 0; m < count; m++) {
    const o = units[bassIndex][m].offset;
    if (o !== null) last = o;
    line.push(last);
  }
  return { line, aligned, bassIndex };
}

// ---------------------------------------------------------------- phrases (lossy, on top)
/** Relative grid of a top-level symbol: a prototype of `level`, or a rule expanded. */
function symGrids(level, rules) {
  const byName = new Map(rules.map(r => [r.name, r]));
  const memo = new Map();
  const grid = sym => {
    if (memo.has(sym)) return memo.get(sym);
    let g;
    if (byName.has(sym)) {
      g = patternGrid(byName.get(sym).body.map(t => ({ proto: t.sym, inv: t.inv, rel: t.rel })), new Proxy({}, { get: (_, name) => grid(name) }));
    } else g = level.grids[Number(sym.slice(level.name.length)) - 1];
    memo.set(sym, g);
    return g;
  };
  return grid;
}

/**
 * Approximate repeats at the top level. A run of L top-level units in one voice
 * (the source) becomes a rule, and other runs of L units anywhere in the piece
 * (the copies) are replaced by the rule at their best transposition, even where
 * they differ. A copy is taken when the numbers it saves outweigh the surface
 * it gets wrong: gain = numbers saved - price * quarters of extra error, with
 * error measured against the real surface on the time grid (pitch slots plus
 * half of onset slots). Greedy: best source and copies first, until nothing gains.
 * Returns { rules, seqs } in the token form repairTokens() takes.
 */
export function lossyPhrases(seqs, initialRules, gridOfSym, realGrids, price, { maxLength = 16 } = {}) {
  const symOf = u => u.sym;
  const flat = [];
  seqs.forEach((us, v) => {
    let t = 0;
    us.forEach((u, i) => {
      const g0 = gridOfSym(u.sym);
      const g = u.inv ? invertGrid(g0) : g0;
      flat.push({ ...u, v, i, grid: g, a: t, b: t + g.length, id: flat.length });
      t += g.length;
    });
  });
  const units = seqs;
  const at = units.map((us, v) => flat.filter(f => f.v === v));
  // Pair statistics for source unit x laid over the real surface under unit y.
  const stats = new Map();
  const pair = (x, y) => {
    const key = x.id * flat.length + y.id;
    let st = stats.get(key);
    if (st) return st;
    const real = realGrids[y.v], g = x.grid, len = g.length;
    st = { ok: len === y.b - y.a, hist: new Map(), fixed: 0 };
    if (st.ok) {
      for (let s = 0; s < len; s++) {
        const k = g.pitch[s], r = real.pitch[y.a + s] ?? null;
        if (k === null && r === null) {} else if (k === null || r === null) st.fixed++;
        else st.hist.set(r - k, (st.hist.get(r - k) ?? 0) + 1);
        if (g.onset[s] !== (real.onset[y.a + s] ?? 0)) st.fixed += 0.5;
      }
      st.both = [...st.hist.values()].reduce((n, c) => n + c, 0);
    }
    stats.set(key, st);
    return st;
  };
  const errAt = (st, T) => st.fixed + st.both - (st.hist.get(T) ?? 0);
  const cost = u => (u.offset !== null && u.offset !== 0 ? 1 : 0) + (u.inv ? 1 : 0);
  const curErr = flat.map(u => errAt(pair(u, u), u.offset ?? 0));
  const locked = new Uint8Array(flat.length);
  const rules = initialRules.map(r => ({ ...r })), replaced = new Map(); // first unit id -> { sym, offset, length }
  let fresh = 0;
  const free = (v, i, L) => i + L <= at[v].length && at[v].slice(i, i + L).every(u => !locked[u.id]);

  for (;;) {
    let best = null;
    for (let L = 2; L <= maxLength; L++) {
      for (let v = 0; v < at.length; v++) for (let i = 0; i + L <= at[v].length; i++) {
        if (!free(v, i, L)) continue;
        const X = at[v].slice(i, i + L);
        const base = X.find(u => u.offset !== null)?.offset;
        if (base === undefined) continue;
        const rel = X.map(u => u.offset === null ? 0 : u.offset - base);
        // Candidate copies with their best transposition and gain.
        const copies = [];
        for (let w = 0; w < at.length; w++) for (let j = 0; j + L <= at[w].length; j++) {
          if (w === v && j < i + L && i < j + L) continue;
          if (!free(w, j, L)) continue;
          const Y = at[w].slice(j, j + L);
          const sts = X.map((x, q) => pair(x, Y[q]));
          if (!sts.every(st => st.ok)) continue;
          const score = new Map();
          sts.forEach((st, q) => { for (const [d, c] of st.hist) score.set(d - rel[q], (score.get(d - rel[q]) ?? 0) + c); });
          let T = 0, top = -1;
          for (const [t, c] of score) if (c > top || (c === top && Math.abs(t) < Math.abs(T))) { T = t; top = c; }
          let err = 0, was = 0, numbers = 0;
          sts.forEach((st, q) => { err += errAt(st, T + rel[q]); was += curErr[Y[q].id]; numbers += cost(Y[q]); });
          const gain = numbers - (T !== 0 ? 1 : 0) - price * (err - was) / SLOTS;
          if (gain > 0) copies.push({ w, j, T, gain });
        }
        if (!copies.length) continue;
        copies.sort((a, b) => b.gain - a.gain);
        const taken = [];
        for (const c of copies) if (!taken.some(t => t.w === c.w && c.j < t.j + L && t.j < c.j + L)) taken.push(c);
        const body = X.reduce((n, u, q) => n + (rel[q] !== 0 ? 1 : 0) + (u.inv ? 1 : 0), 0);
        const ownDelta = body + (base !== 0 ? 1 : 0) - X.reduce((n, u) => n + cost(u), 0);
        const gain = taken.reduce((n, c) => n + c.gain, 0) - ownDelta;
        if (gain > 1e-9 && (!best || gain > best.gain)) best = { gain, v, i, L, base, rel, X, taken };
      }
    }
    if (!best) break;
    const name = `_Q${++fresh}`;
    rules.push({ name, body: best.X.map((u, q) => ({ sym: symOf(u), inv: !!u.inv, rel: best.rel[q] })) });
    const lock = (v, i, offset) => {
      for (const u of at[v].slice(i, i + best.L)) locked[u.id] = 1;
      replaced.set(at[v][i].id, { sym: name, inv: false, offset, length: best.L });
    };
    lock(best.v, best.i, best.base);
    for (const c of best.taken) lock(c.w, c.j, c.T);
  }
  const outSeqs = at.map(us => {
    const out = [];
    for (let i = 0; i < us.length;) {
      const r = replaced.get(us[i].id);
      if (r) { out.push({ sym: r.sym, inv: false, offset: r.offset }); i += r.length; }
      else { out.push({ sym: symOf(us[i]), inv: !!us[i].inv, offset: us[i].offset }); i++; }
    }
    return out;
  });
  return { rules, seqs: outSeqs };
}

// ---------------------------------------------------------------- phrases (exact, on top)
/**
 * Transposition-invariant Re-Pair over the top-level units of all voices: the
 * commonest adjacent pair (prototype, prototype, interval) becomes a rule, until
 * no pair repeats. Rules used once are inlined. Lossless on the quantized
 * sequence, so it only removes controls and adds reach.
 * Returns { rules: [{ name, body: [{ sym, rel }] }], seqs: [[{ sym, offset }]] }.
 */
export function inducePhrases(units, levelName, options = {}) {
  return repairTokens(units.map(us => us.map(u => ({ sym: `${levelName}${u.proto + 1}`, inv: !!u.inv, offset: u.offset }))), [], options);
}

/**
 * Re-Pair on token sequences ({ sym, inv, offset }) that may already use rules.
 * New rules are added after the given ones. All rules are renamed R1, R2, ...
 * in definition order.
 */
export function repairTokens(seqs, initialRules = [], { minCount = 2 } = {}) {
  const rules = initialRules.map(r => ({ name: r.name, body: r.body.map(t => ({ ...t })) }));
  let fresh = 0;
  const relOf = (a, base) => a === null || base === null ? 0 : a - base;
  const pairKey = (x, y) => {
    const base = x.offset ?? y.offset;
    return `${x.sym}${x.inv ? 'i' : ''}:${relOf(x.offset, base)} ${y.sym}${y.inv ? 'i' : ''}:${relOf(y.offset, base)}`;
  };
  for (;;) {
    const counts = new Map();
    for (const seq of seqs) {
      let last = new Map();
      for (let i = 0; i + 1 < seq.length; i++) {
        const k = pairKey(seq[i], seq[i + 1]);
        if (last.get(k) === i - 1) continue; // overlapping run (a a a)
        last.set(k, i);
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
    let best = null, bestCount = minCount - 1;
    for (const [k, c] of counts) if (c > bestCount) { best = k; bestCount = c; }
    if (!best) break;
    const name = `_R${++fresh}`;
    let body = null;
    seqs = seqs.map(seq => {
      const out = [];
      for (let i = 0; i < seq.length; i++) {
        if (i + 1 < seq.length && pairKey(seq[i], seq[i + 1]) === best) {
          const base = seq[i].offset ?? seq[i + 1].offset;
          body ??= [{ sym: seq[i].sym, inv: seq[i].inv, rel: relOf(seq[i].offset, base) }, { sym: seq[i + 1].sym, inv: seq[i + 1].inv, rel: relOf(seq[i + 1].offset, base) }];
          out.push({ sym: name, inv: false, offset: base });
          i++;
        } else out.push(seq[i]);
      }
      return out;
    });
    rules.push({ name, body });
  }
  // Inline rules used exactly once.
  for (;;) {
    const uses = new Map(rules.map(r => [r.name, 0]));
    for (const seq of seqs) for (const t of seq) if (uses.has(t.sym)) uses.set(t.sym, uses.get(t.sym) + 1);
    for (const r of rules) for (const t of r.body) if (uses.has(t.sym)) uses.set(t.sym, uses.get(t.sym) + 1);
    const once = rules.find(r => uses.get(r.name) === 1);
    if (!once) break;
    const expandSeq = seq => seq.flatMap(t => t.sym === once.name ? once.body.map(b => ({ sym: b.sym, inv: b.inv, offset: t.offset === null ? null : t.offset + b.rel })) : [t]);
    seqs = seqs.map(expandSeq);
    for (const r of rules) r.body = r.body.flatMap(t => t.sym === once.name ? once.body.map(b => ({ sym: b.sym, inv: b.inv, rel: t.rel + b.rel })) : [t]);
    rules.splice(rules.indexOf(once), 1);
  }
  // Renumber in order of definition.
  const rename = new Map(rules.map((r, i) => [r.name, `R${i + 1}`]));
  const rn = sym => rename.get(sym) ?? sym;
  return {
    rules: rules.map(r => ({ name: rn(r.name), body: r.body.map(t => ({ ...t, sym: rn(t.sym) })) })),
    seqs: seqs.map(seq => seq.map(t => ({ ...t, sym: rn(t.sym) }))),
  };
}

/** Distinct chunks with weights, clustered; returns { medoids (chunks), assign: key -> medoid }. */
function codebook(chunks, gridFn, k, invert = false) {
  const byKey = new Map();
  for (const c of chunks) {
    const e = byKey.get(c.key);
    if (e) e.weight++;
    else byKey.set(c.key, { key: c.key, weight: 1, chunk: c, grid: gridFn(c) });
  }
  const items = [...byKey.values()];
  const { medoids, assign } = kMedoids(items, k, { invert });
  return { medoids: medoids.map(m => m.chunk), assign };
}

/** Group units into chunks between consecutive boundaries; pattern = (proto, rel offset). */
function groupByBounds(units, bounds) {
  const out = [];
  let i = 0;
  for (let j = 0; j + 1 < bounds.length && i < units.length; j++) {
    const a = bounds[j], b = bounds[j + 1];
    const members = [];
    while (i < units.length && units[i].a < b) { if (units[i].a >= a || !members.length) members.push(units[i]); i++; }
    if (members.length) out.push(makeChunk(members));
  }
  while (i < units.length) out.push(makeChunk([units[i++]]));
  return out;
}
function groupByCount(units, n) {
  const out = [];
  for (let i = 0; i < units.length; i += n) out.push(makeChunk(units.slice(i, i + n)));
  return out;
}
function makeChunk(members) {
  const base = members.find(u => u.offset !== null)?.offset ?? null;
  const pattern = members.map(u => ({ proto: u.proto, inv: !!u.inv, rel: u.offset === null || base === null ? 0 : u.offset - base, len: u.b - u.a }));
  return { a: members[0].a, b: members[members.length - 1].b, offset: base, pattern,
    key: pattern.map(p => `${p.proto}${p.inv ? 'i' : ''}:${num(p.rel)}:${p.len}`).join(' ') };
}
function patternGrid(pattern, childGrids) {
  const parts = pattern.map(p => p.inv ? invertGrid(childGrids[p.proto]) : childGrids[p.proto]);
  const len = parts.reduce((n, g) => n + g.length, 0);
  const pitch = new Array(len).fill(null), onset = new Uint8Array(len);
  let t = 0;
  pattern.forEach((p, i) => {
    const g = parts[i];
    for (let x = 0; x < g.length; x++) {
      pitch[t + x] = g.pitch[x] === null ? null : g.pitch[x] + p.rel;
      onset[t + x] = g.onset[x];
    }
    t += g.length;
  });
  return { pitch, onset, length: len };
}

// ---------------------------------------------------------------- rendering
function figureText(fig) {
  return '[' + fig.map(f => {
    const head = f.rel === null ? 'r' : num(f.rel);
    const q = f.len / SLOTS;
    return q === 1 ? head : `${head} | ${num(q)}`;
  }).join(', ') + ']';
}

// A reference: B3, (B3 * [2]), (B3 m [0]) upside down, (B3 m [0] * [2]).
function symRef(sym, rel, inv = false) {
  const flip = inv ? ' m [0]' : '';
  return rel === 0 ? (inv ? `(${sym}${flip})` : sym) : `(${sym}${flip} * [${num(rel)}])`;
}

function renderKernel(levels, units, voiceInfo, phrases, harmony) {
  const lines = [];
  const used = levels.map(() => new Set());
  // Mark prototypes that are actually used, top down.
  const top = levels.length - 1;
  const topName = levels[top].name;
  const protoOf = sym => sym.startsWith(topName) ? Number(sym.slice(topName.length)) - 1 : null;
  if (phrases) {
    for (const seq of phrases.seqs) for (const t of seq) if (protoOf(t.sym) !== null) used[top].add(protoOf(t.sym));
    for (const r of phrases.rules) for (const t of r.body) if (protoOf(t.sym) !== null) used[top].add(protoOf(t.sym));
  } else for (const us of units) for (const u of us) used[top].add(u.proto);
  for (let l = top; l > 0; l--) for (const p of used[l]) for (const c of levels[l].protos[p].pattern) used[l - 1].add(c.proto);
  const name = (l, p) => `${levels[l].name}${p + 1}`;
  const ref = (l, p, rel, inv) => symRef(name(l, p), rel, inv);
  for (let l = 0; l <= top; l++) {
    for (const p of [...used[l]].sort((a, b) => a - b)) {
      const proto = levels[l].protos[p];
      const body = proto.kind === 'figure' ? figureText(proto.figure)
        : proto.pattern.map(c => ref(l - 1, c.proto, c.rel, c.inv)).join(', ');
      lines.push(`${name(l, p)} = ${body}`);
    }
  }
  if (phrases) for (const r of phrases.rules) lines.push(`${r.name} = ${r.body.map(t => symRef(t.sym, t.rel, t.inv)).join(', ')}`);
  const seqs = phrases ? phrases.seqs : units.map(us => us.map(u => ({ sym: name(top, u.proto), inv: !!u.inv, offset: u.offset })));
  if (harmony) lines.push(`H = [${harmony.line.map(num).join(', ')}]`);
  const sections = seqs.map((us, v) => {
    if (harmony?.aligned[v]) {
      const d = us.map((u, m) => u.offset === null ? 0 : u.offset - harmony.line[m]);
      const skeleton = d.every(x => x === 0) ? 'H' : `(H . [${d.map(num).join(', ')}])`;
      return `// ${voiceInfo[v].label}\n${skeleton} . [${us.map(u => symRef(u.sym, 0, u.inv)).join(', ')}]`;
    }
    // Consecutive uses of one symbol become a fan: (B1 * [o1, o2]).
    const parts = [];
    for (let i = 0; i < us.length;) {
      let j = i + 1;
      while (j < us.length && us[j].sym === us[i].sym && us[j].inv === us[i].inv) j++;
      const offs = us.slice(i, j).map(u => u.offset ?? 0);
      parts.push(offs.length === 1 ? symRef(us[i].sym, offs[0], us[i].inv) : `(${us[i].sym}${us[i].inv ? ' m [0]' : ''} * [${offs.map(num).join(', ')}])`);
      i = j;
    }
    return `// ${voiceInfo[v].label}\n${parts.join(', ')}`;
  });
  const code = `${lines.join('\n')}\n` + sections.map((text, v) => v === 0 ? text : `!${voiceInfo[v].enter ? num(voiceInfo[v].enter) : ''}\n${text}`).join('\n');
  return { code, controls: countControls(code, levels, used, phrases, harmony) };
}

/**
 * Numbers a person would wiggle: the step numbers written in the program
 * (figure steps, offsets, mirror axes, H and its intervals), per level. A
 * reference at offset 0 writes no number and is not counted.
 */
function countControls(code, levels, used, phrases, harmony) {
  const { numbers } = stepNumbers(code);
  const levelNames = [...levels.map(l => l.name), ...(phrases ? ['R'] : []), ...(harmony ? ['H'] : [])];
  const prototypes = name => {
    const l = levels.findIndex(x => x.name === name);
    if (l >= 0) return used[l].size;
    return name === 'R' ? phrases.rules.length : 1;
  };
  const perLevel = levelNames.map(name => ({
    level: name, prototypes: prototypes(name),
    numbers: numbers.filter(n => n.def && n.def.replace(/\d+$/, '') === name).length,
  }));
  const top = numbers.filter(n => !n.def).length;
  return { perLevel, top, total: numbers.length };
}

// ---------------------------------------------------------------- fit
/**
 * How much of the real surface a program reproduces, through the interpreter.
 * pitch: share of sounding time where the program sounds the same pitch.
 * notes: share of real notes (onset + pitch) the program also plays.
 * extra: program onsets that are not real notes, as a share of real notes.
 */
export function fitKernel(code, target, { enters = null } = {}) {
  const voices = target.voices ?? target;
  const sections = globalThis.golden.crux_interp(code).sections;
  let sounding = 0, pitchHits = 0, notes = 0, noteHits = 0, extra = 0;
  voices.forEach((v, i) => {
    const real = gridOf(timeline(v));
    // A section that enters late (!N) starts with a rest of N quarters.
    const shift = -slotsOf(enters?.[i] ?? 0);
    const segs = timeline((sections[i]?.values ?? []).map(p => ({ step: p.step, timeScale: p.timeScale, tag: p.tag })))
      .map(s => ({ ...s, a: s.a + shift, b: s.b + shift }));
    const got = gridOf(segs, real.length);
    for (let x = 0; x < real.length; x++) {
      if (real.pitch[x] !== null) { sounding++; if (got.pitch[x] === real.pitch[x]) pitchHits++; }
      if (real.onset[x]) { notes++; if (got.onset[x] && got.pitch[x] === real.pitch[x]) noteHits++; }
      else if (got.onset[x]) extra++;
    }
  });
  return { pitch: pitchHits / sounding, notes: noteHits / notes, extra: extra / notes, sounding, noteCount: notes };
}
