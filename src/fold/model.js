// Crux fold model: how a traced program folds back to what it writes.
//
//   golden.crux_fold_model(trace) -> plain data (see foldModel below)
//   golden.crux_fold(source)      -> crux_fold_model(crux_trace(source))
//
// No DOM. Hosts draw it. Stop 0 (notes as heard) is the host's job, because
// pitch is the host's job: the host adds regime, tonic and key lane to the
// stop 1 position. Stops 1 to 5 are positions in time and scale steps.
//
//   1  plain scale steps, as played
//   2  transposition removed: each instance at its own step 0
//   3  mirror, reverse and stretch removed: each instance takes its source's shape
//   4  repetition removed: equal instances stack on the first one in the voice
//   5  nesting removed: one copy of each shape, side by side (one shared layout)
//      From here on a width compares the notes of one shape only: each
//      shape is scaled so that its most common duration is 1, and no note is
//      wider than `capWidth` (4). A note cut by the cap has `capped: true`.
//   6  unstated exact repeats removed (thematic.js)
//   7  near-misses folded onto the program's definitions (thematic.js)
//   8  themes only, with a residue group for what no theme explains (thematic.js)
//   9+ one stop for each level after stop 8, laid out in the order (and, at
//      the cells stop, the place) the shapes had at the stop before on the
//      slider (see `shown` below):
//      - with `// #core a b / c` (or options.core), one focus level for each
//        level named there. A level before the last shows the named
//        definitions whole; the last shows the cell-level entries of its
//        names, with the notes their hosts write stacked on them. At these
//        stops a note that belongs to no named shape is hidden.
//      - without it (or with options.core []), one stop, cells: the themes of
//        stop 8 open to the cell level, where partial and edited statements
//        of a definition fold onto it (an edited note keeps its offset in
//        cellBent), and the pips that `@` put in the place of one pip stack
//        on that pip (note.split)
//
// The model keeps every stop. `shown` lists the stops a host's slider shows:
// all but 5 (nesting), and 8 (themes) only when the program has no `#core`
// level. options.shown (an array of stop numbers) replaces the rule. "The
// stop before" of a level is the last shown stop under it.
//
// A note's owner is the innermost definition it passed through. Frames inside
// the owner are the definition's own body and always apply. Frames outside it
// place the instance, and the stops take them away. A pip changed by an
// operator that the fold cannot undo (exact: false) is "edited": its owner is
// the innermost definition outside that operator, and its value after the
// operator is used as its source.
import '../index.js';
import './trace.js';
import { thematicFolds } from './thematic.js';

const EPS = 1e-9;
const r9 = x => Math.round(x / EPS) * EPS;
const round9 = x => Math.round(x * 1e9) / 1e9;
const z = x => (x === 0 ? 0 : x); // no -0 in the output
const TRANSPARENT = new Set([',', '_', ':']);

function framesOf(pip) {
  const out = [];
  for (let f = pip && pip.origin; f; f = f.next) out.push(f);
  return out.reverse();
}

// Apply one frame to (s, d). mode: { transpose, mirror, stretch }.
function apply(f, s, d, mode) {
  if (f.kind !== 'op' || !f.exact || TRANSPARENT.has(f.op)) return [s, d];
  const a = f.arg || { step: 0, ts: 1 };
  const ts = Math.abs(a.ts ?? 1);
  if (f.op === '*' || f.op === '.') {
    if (mode.transpose) s += a.step;
  } else if (f.op === 'm') {
    if (mode.mirror) s = mode.transpose ? 2 * a.step - s : -s;
  } else if (f.op === '^') {
    if (mode.mirror) s = s * a.step;
  }
  if (mode.stretch) d *= ts;
  return [s, d];
}

const FULL = { transpose: true, mirror: true, stretch: true };
const NO_TRANSPOSE = { transpose: false, mirror: true, stretch: true };

// Step map from rec's owner body to the body of definition use `use`, as
// { a, b } (step -> a * step + b), or null when rec is not inside that use.
function relate(rec, use) {
  const fr = rec.a.frames;
  const o = fr.indexOf(rec.a.owner);
  const j = fr.findIndex(f => f.kind === 'ref' && f.use === use);
  if (o < 0 || j <= o) return null;
  const f = s => { for (let i = o + 1; i < j; i++) [s] = apply(fr[i], s, 1, FULL); return s; };
  const b = f(0);
  return { a: f(1) - b, b };
}

function frameKey(f) {
  if (f.kind === 'ref') return 'r' + f.use;
  if (f.kind === 'op') return 'o' + f.app + ':' + f.copy;
  return 'l';
}

// Without `level` the owner is the innermost definition. With it the owner is
// at the theme level:
// - level.named: definitions picked by hand. The outermost of them that the
//   pip passed through owns it.
// - else the owner climbs from the innermost definition C, and again from
//   where it lands. When C is never used by itself (level.part: each use of
//   C is inside a definition that is used more than once), it goes to the
//   definition next around it, if that one is used 3 times or more: a shape
//   stated twice is more often a passage that returns than a theme. If not,
//   it goes to the outermost definition D
//   around it for which level.inside(C, D) holds: most uses of C are inside
//   D, and D is used more than once.
// With `cells` (the cell level: the cells stop and the core) an edited pip can stay with its
// innermost definition as a bent note (cellBend), and a pip that `@` put in
// the place of another goes where that pip was (splitPart).
function analysePip(pip, level = null, cells = null) {
  const frames = framesOf(pip);
  return (cells && splitPart(frames, cells)) || analyseFrames(frames, pip, level, cells);
}

function analyseFrames(frames, pip, level, cells) {
  let e = -1;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    if (f.kind === 'op' && !f.exact && !f.kept) e = i;
  }
  const bend = cells && e >= 0 ? cellBend(frames, cells) : null;
  if (bend !== null) e = -1;
  let owner = -1;
  for (let i = e + 1; i < frames.length; i++) if (frames[i].kind === 'ref') { owner = i; break; }
  if (level && owner >= 0) {
    let named = -1;
    for (let i = frames.length - 1; i >= owner; i--) {
      if (frames[i].kind === 'ref' && level.named.has(frames[i].name)) { named = i; break; }
    }
    if (named >= 0) owner = named;
    else {
      for (let moved = true; moved;) {
        moved = false;
        const C = frames[owner].name;
        // The climb stops at an operator that makes two or more copies of C
        // (a sequence): what is around it states C several times.
        let end = frames.length;
        for (let i = owner + 1; i < frames.length; i++) if (frames[i].kind === 'op' && level.fan(frames[i])) { end = i; break; }
        if (level.part(C)) {
          let next = -1;
          for (let i = owner + 1; i < end; i++) if (frames[i].kind === 'ref') { next = i; break; }
          if (next >= 0 && level.uses(frames[next].name) >= 3) { owner = next; moved = true; continue; }
        }
        for (let i = end - 1; i > owner; i--) {
          if (frames[i].kind === 'ref' && level.inside(C, frames[i].name)) { owner = i; moved = true; break; }
        }
      }
    }
  }
  let s, d, start;
  if (e >= 0) {
    const out = frames[e].out || { step: pip.step, ts: pip.timeScale };
    s = out.step; d = Math.abs(out.ts); start = e + 1;
  } else if (frames.length && frames[0].kind === 'lit') {
    s = frames[0].step; d = Math.abs(Number(frames[0].ts)); start = 1;
  } else {
    // No trace (for example the rest that a voice entry offset adds).
    s = pip.step; d = Math.abs(pip.timeScale); start = frames.length;
  }
  const bodyEnd = owner >= 0 ? owner : start; // owner-less: every frame places the pip
  for (let i = start; i < bodyEnd; i++) [s, d] = apply(frames[i], s, d, FULL);
  const body = { s, d };
  const outer = frames.slice(owner >= 0 ? owner + 1 : start);
  const at = mode => {
    let x = body.s, y = body.d;
    for (const f of outer) [x, y] = apply(f, x, y, mode);
    return { s: x, d: y };
  };
  const lit = frames[0] && frames[0].kind === 'lit' ? frames[0] : null;
  const ownerFrame = owner >= 0 ? frames[owner] : null;
  let canon;
  if (ownerFrame) canon = ownerFrame.index;
  else if (outer.length) canon = outer[outer.length - 1].index;
  else canon = null;
  // Instance: the owner use plus every frame outside it.
  const pathFrames = owner >= 0 ? frames.slice(owner) : outer;
  const instanceKey = pathFrames.length ? pathFrames.map(frameKey).join('/') : null;
  return { frames, edited: e >= 0, owner: ownerFrame, body, full: at(FULL), noTranspose: at(NO_TRANSPOSE), canon, instanceKey, lit, outer,
    bend: bend ?? 0 };
}

// Cell level: a pip that operators with exact: false changed stays with the
// innermost definition when the frames inside each such operator lead to a
// literal through a definition, the operator kept the duration, and it made
// one pip from one pip (cells.oneToMany holds the frames of operators that
// made two pips from one). Returns the bend in the definition's own frame: the
// step the outermost operator gave, less the step the frames inside it give,
// divided by the scale of the exact frames between the definition and that
// operator. Returns null when a condition fails: the pip stays edited.
function cellBend(frames, cells) {
  if (!frames.length || frames[0].kind !== 'lit') return null;
  const o = frames.findIndex(f => f.kind === 'ref');
  if (o < 0) return null;
  let s = frames[0].step, d = Math.abs(Number(frames[0].ts)), c = -1, bent = 0;
  for (let i = 1; i < frames.length; i++) {
    const f = frames[i];
    if (f.kind === 'op' && !f.exact && !f.kept) {
      if (i < o || !f.out || cells.oneToMany.has(f) || Math.abs(Math.abs(f.out.ts) - d) > 1e-6) return null;
      c = i;
      bent = f.out.step - s;
    }
    [s, d] = apply(f, s, d, FULL);
  }
  const g = x => { for (let i = o + 1; i < c; i++) [x] = apply(frames[i], x, 1, FULL); return x; };
  const a = g(1) - g(0);
  if (Math.abs(a) < EPS) return null;
  return z(round9(bent / a));
}

// Cell level, splits. The changing frame of the pip is an `@` frame with
// `from`: the pip is one of `from.parts` pips that took the place of one
// operand pip. That pip is analysed as if the `@` had kept it (the frames of
// from.origin, the `@` as a kept frame, then the frames outside the `@`),
// and the part takes its owner, canon and body. Its bend is its step after
// the `@`, less the replaced pip's step there, taken back into the owner's
// frame, plus the replaced pip's own bend. Returns null when the durations
// of the parts do not add up to the replaced pip's duration, or the replaced
// pip has no owner inside the `@`: the pip stays edited. A run of one pip
// (parts: 1) is a replacement, not a split: it is bent, with no `split`.
// A replaced pip that is itself a part follows the same rule again; `split`
// and `slot` then come from the innermost `@`.
function splitPart(frames, cells) {
  let e = -1;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    if (f.kind === 'op' && !f.exact && !f.kept) e = i;
  }
  const f = frames[e];
  if (!f || !f.from || !f.out) return null;
  const inner = framesOf({ origin: f.from.origin });
  const v = inner.length ? valueOf(inner) : null;
  if (!v) return null;
  const parts = cells.parts.get(f.app + '|' + f.from.index);
  if (!parts || parts.size !== f.from.parts) return null;
  let sum = 0;
  for (const d of parts.values()) sum += d;
  if (Math.abs(sum - v.d) > 1e-6) return null;
  const at = Object.assign({}, f, { kept: true, index: f.from.index });
  delete at.out;
  delete at.from;
  const vframes = [...inner, at, ...frames.slice(e + 1)];
  const R = splitPart(vframes, cells) || analyseFrames(vframes, null, null, cells);
  // A replaced pip that is a part itself was expanded again: its chain holds
  // this `@` too.
  const chain = R.chain || vframes;
  const o = R.owner ? chain.indexOf(R.owner) : -1;
  const c = chain.indexOf(at);
  if (o < 0 || o > c) return null;
  const g = x => { for (let i = o + 1; i < c; i++) [x] = apply(chain[i], x, 1, FULL); return x; };
  const a = g(1) - g(0);
  if (Math.abs(a) < EPS) return null;
  const bend = z(round9((f.out.step - v.s) / a + R.bend));
  let split = R.split, slot = R.slot;
  if (!split && f.from.parts > 1) {
    split = { part: f.from.part, parts: f.from.parts };
    slot = f.app + '|' + f.from.index;
  }
  return { ...R, frames, chain, edited: false, bend, split: split ?? null, slot: slot ?? null };
}

// Step and duration of a pip from its frames, innermost first: the value
// after the outermost operator that changed it, or the literal, then the
// exact frames outside.
function valueOf(frames) {
  let k = -1;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    if (f.kind === 'op' && !f.exact && !f.kept && f.out) k = i;
  }
  let s, d;
  if (k >= 0) { s = frames[k].out.step; d = Math.abs(frames[k].out.ts); }
  else if (frames[0].kind === 'lit') { s = frames[0].step; d = Math.abs(Number(frames[0].ts)); }
  else return null;
  for (let i = k + 1; i < frames.length; i++) [s, d] = apply(frames[i], s, d, FULL);
  return { s, d };
}

// One level of the dictionary. A(rec) is the pip's analysis and K(rec) its
// instance key. Returns the instances, the entries in layout order, and
// per-pip layout data: { I, off, shownOff, shown, capped }. With `partial`
// (the cell level) a part of an entry joins that entry. Pips with the same
// `slot` in one instance (the parts of one split) are one slot: one key in
// the signature, one offset, the width of the pip they replaced.
function buildLevel(all, A, K, gap, capWidth, partial = false) {
  const info = new Map();
  // Instances: start time and canonical offsets (stop 3).
  const inst = new Map();
  for (const rec of all) {
    const a = A(rec), key = K(rec);
    let I = inst.get(key);
    if (!I) {
      I = { key, voice: rec.voice, t0: rec.t, t1: rec.t + rec.d, recs: [], name: a.owner ? a.owner.name : null, ownerPos: a.owner ? a.owner.pos : null };
      inst.set(key, I);
    }
    I.t0 = Math.min(I.t0, rec.t);
    I.t1 = Math.max(I.t1, rec.t + rec.d);
    I.recs.push(rec);
    info.set(rec, { I });
  }
  for (const I of inst.values()) {
    const order = I.recs.slice().sort((x, y) => (A(x).canon ?? x.index) - (A(y).canon ?? y.index) || x.index - y.index);
    const slots = new Map(), keys = [];
    let off = 0;
    for (const rec of order) {
      const first = slotOf(A, rec, slots);
      if (first) { info.get(rec).off = info.get(first).off; continue; }
      info.get(rec).off = off;
      off += A(rec).body.d;
      keys.push(pipKey(A, rec));
    }
    I.length = off;
    I.order = order;
    I.signature = (I.name ?? '#') + '|' + keys.join(',');
  }

  // Dictionary: one entry per distinct shape.
  const entries = new Map();
  const byName = new Map();
  const instancesSorted = [...inst.values()].sort((x, y) => x.voice - y.voice || x.t0 - y.t0);
  for (const I of instancesSorted) {
    if (!I.recs.some(r => r.sounding)) continue;
    let E = entries.get(I.signature);
    if (!E) {
      const n = (byName.get(I.name) || 0) + 1;
      byName.set(I.name, n);
      const litPos = Math.min(...I.recs.map(r => (A(r).lit && A(r).lit.pos != null ? A(r).lit.pos : Infinity)));
      E = { id: (I.name ?? '_') + (n > 1 ? '#' + n : ''), name: I.name, signature: I.signature, count: 0,
        instances: [], firstInVoice: new Map(), litPos: Number.isFinite(litPos) ? litPos : null,
        refPos: I.ownerPos, length: I.length, pips: I.recs.filter(r => r.sounding).length };
      entries.set(I.signature, E);
    }
    E.count++;
    E.instances.push({ voice: I.voice, t0: I.t0, t1: I.t1 });
    if (!E.firstInVoice.has(I.voice)) E.firstInVoice.set(I.voice, I.t0);
    I.entry = E;
  }
  if (partial) joinParts(inst, entries);
  // Shown widths (stops 5 to 8). A written duration means something only
  // beside the other durations of its own shape, so each shape gets its own
  // unit: the most common duration of its sounding pips (the shorter one on a
  // tie). No pip is wider than capWidth units.
  for (const I of inst.values()) {
    const E = I.entry;
    if (!E || I.part) continue;
    if (E.unit === undefined) {
      const tally = new Map(), slots = new Map();
      for (const rec of I.order) if (rec.sounding && !slotOf(A, rec, slots)) tally.set(r9(A(rec).body.d), (tally.get(r9(A(rec).body.d)) || 0) + 1);
      let unit = 0, best = 0;
      for (const [d, n] of tally) if (d > 0 && (n > best || (n === best && d < unit))) { unit = d; best = n; }
      E.unit = unit || 1;
    }
    let off = 0;
    const slots = new Map();
    for (const rec of I.order) {
      const w = A(rec).body.d / E.unit, R = info.get(rec);
      const first = slotOf(A, rec, slots);
      if (first) { Object.assign(R, { shownOff: info.get(first).shownOff, shown: info.get(first).shown, capped: info.get(first).capped }); continue; }
      R.shownOff = off;
      R.shown = Math.min(w, capWidth);
      R.capped = w > capWidth + 1e-9;
      off += R.shown;
      if (partial) (E.layout ||= new Map()).set(pipKey(A, rec), R);
    }
    E.shownLength = off;
  }
  // A part takes the places of its pips in the whole entry.
  for (const I of inst.values()) {
    if (!I.part) continue;
    for (const rec of I.order) {
      const W = I.entry.layout.get(pipKey(A, rec)), R = info.get(rec);
      Object.assign(R, { off: W.off, shownOff: W.shownOff, shown: W.shown, capped: W.capped });
    }
  }
  // Folded layout: entries side by side in source order. `slot` is the shown
  // layout. `at` is the same layout in written durations, which the later
  // folds match on.
  const entryList = [...entries.values()].sort((x, y) => (x.litPos ?? Infinity) - (y.litPos ?? Infinity) || x.id.localeCompare(y.id));
  let x = 0, xw = 0;
  for (const E of entryList) {
    E.slot = { x, width: E.shownLength, unit: E.unit };
    E.at = xw;
    x += E.shownLength + gap;
    xw += E.length + gap;
    E.residue = E.name == null && E.count === 1;
  }
  return { inst, entryList, info };
}

// The first pip of rec's slot seen so far in `slots`, or undefined (and rec
// is now the first). Pips with no slot are each their own.
function slotOf(A, rec, slots) {
  const sl = A(rec).slot;
  if (sl == null) return undefined;
  const first = slots.get(sl);
  if (!first) slots.set(sl, rec);
  return first;
}

function pipKey(A, r) {
  const a = A(r);
  return [a.canon ?? '', r9(a.body.s), r9(a.body.d), r.tag ?? ''].join(':');
}

// Partial statements (cell level). An entry whose pips are all pips of a
// larger entry of the same definition (same canon, body step, body duration
// and tag) is a part of it, and its instances join that entry. Of two larger
// entries, the one with more pips wins, then the first in source order.
// Entry ids are given again, so that they count the entries that are left.
function joinParts(inst, entries) {
  const list = [...entries.values()];
  const keys = new Map(list.map(E => [E, new Set(E.signature.slice(E.signature.indexOf('|') + 1).split(','))]));
  const order = list.slice().sort((x, y) => (x.litPos ?? Infinity) - (y.litPos ?? Infinity) || x.id.localeCompare(y.id));
  for (const P of list) {
    if (P.name == null) continue;
    const mine = keys.get(P);
    let best = null;
    for (const F of order) {
      const theirs = keys.get(F);
      if (F === P || F.name !== P.name || theirs.size <= mine.size || (best && theirs.size <= keys.get(best).size)) continue;
      if ([...mine].every(k => theirs.has(k))) best = F;
    }
    if (best) P.partOf = best;
  }
  for (const I of inst.values()) {
    const P = I.entry;
    if (!P || !P.partOf) continue;
    const F = P.partOf;
    I.part = true;
    I.entry = F;
    F.count++;
    F.instances.push({ voice: I.voice, t0: I.t0, t1: I.t1 });
    if (!F.firstInVoice.has(I.voice) || F.firstInVoice.get(I.voice) > I.t0) F.firstInVoice.set(I.voice, I.t0);
  }
  const byName = new Map();
  for (const E of list) {
    if (E.partOf) { entries.delete(E.signature); continue; }
    const n = (byName.get(E.name) || 0) + 1;
    byName.set(E.name, n);
    E.id = (E.name ?? '_') + (n > 1 ? '#' + n : '');
  }
}

export function foldModel(trace, options = {}) {
  if (!trace || !trace.trace) throw new Error('foldModel needs the result of crux_trace');
  if (trace.unseededRandom) {
    throw new Error('The fold needs a fixed program, and this one has random choices without a seed. Give each random choice a seed (or freeze the seeds) and try again.');
  }
  const gap = options.gap ?? 0.5;
  const capWidth = options.capWidth ?? 4;
  const notes = [];
  const all = []; // every pip, rests included
  const voices = [];

  trace.sections.forEach((mot, voice) => {
    let t = 0;
    mot.values.forEach((pip, index) => {
      const d = Math.abs(pip.timeScale);
      const a = analysePip(pip);
      const sounding = pip.tag !== 'r';
      const rec = { pip, voice, index, t, d, step: pip.step, tag: pip.tag ?? null, sounding, a,
        diad: pip.diad ? pip.diad.map(x => x - pip.step) : null };
      if (rec.a.instanceKey === null) rec.a.instanceKey = `p${voice}:${index}`;
      rec.instance = `${voice}|${rec.a.instanceKey}`;
      all.push(rec);
      t += d;
    });
    voices.push({ voice, duration: t, pips: mot.values.length });
  });

  // Stops 3 to 5: the innermost definition owns a note.
  const { entryList, info } = buildLevel(all, rec => rec.a, rec => rec.instance, gap, capWidth);

  // Theme level, for stops 6 to 8. A definition that is used mostly inside
  // a larger one belongs to it, so a theme built from smaller definitions is
  // one shape (analysePip). `// #theme A B` in the program, or
  // options.themes, picks the themes by hand.
  const usesOf = new Map(); // name -> Map(instance key -> names of the definitions around it)
  for (const rec of all) {
    if (!rec.sounding) continue;
    const fr = rec.a.frames;
    for (let i = 1; i < fr.length; i++) {
      if (fr[i].kind !== 'ref') continue;
      let uses = usesOf.get(fr[i].name);
      if (!uses) usesOf.set(fr[i].name, (uses = new Map()));
      const key = rec.voice + '|' + fr.slice(i).map(frameKey).join('/');
      if (!uses.has(key)) uses.set(key, new Set(fr.slice(i + 1).filter(f => f.kind === 'ref').map(f => f.name)));
    }
  }
  const insideMemo = new Map();
  const inside = (C, D) => {
    const k = C + '\n' + D;
    if (!insideMemo.has(k)) {
      const uses = usesOf.get(C), outer = usesOf.get(D);
      let n = 0;
      if (uses && outer && outer.size >= 2) for (const around of uses.values()) if (around.has(D)) n++;
      insideMemo.set(k, !!uses && 2 * n > uses.size);
    }
    return insideMemo.get(k);
  };
  const copies = new Map(); // operator application -> highest copy index
  for (const rec of all) {
    for (const f of rec.a.frames) if (f.kind === 'op' && f.copy != null) copies.set(f.app, Math.max(copies.get(f.app) || 0, f.copy));
  }
  const used = name => (usesOf.get(name) || { size: 0 }).size >= 2;
  const partMemo = new Map();
  const part = C => {
    if (!partMemo.has(C)) partMemo.set(C, [...usesOf.get(C).values()].every(around => [...around].some(used)));
    return partMemo.get(C);
  };
  const picked = options.themes ?? String((trace.directives && trace.directives.theme) || '').split(/[\s,]+/).filter(Boolean);
  const level = { named: new Set(picked.filter(name => usesOf.has(name))), inside, part, fan: f => (f.op === '*' || f.op === '^' || f.op === '->') && (copies.get(f.app) || 0) >= 1, uses: name => (usesOf.get(name) || { size: 0 }).size };
  for (const rec of all) {
    rec.th = analysePip(rec.pip, level);
    if (rec.th.instanceKey === null) rec.th.instanceKey = `p${rec.voice}:${rec.index}`;
    rec.thInstance = `${rec.voice}|${rec.th.instanceKey}`;
  }
  const themeLevel = buildLevel(all, rec => rec.th, rec => rec.thInstance, gap, capWidth);

  // Notes and their positions.
  const written = []; // the theme level layout in written durations, by note id
  const themeNotes = []; // what the later folds read: the theme level as their stop 5
  for (const rec of all) {
    if (!rec.sounding) continue;
    const R = info.get(rec), I = R.I;
    const E = I.entry;
    const p1 = { t: rec.t, step: z(rec.a.full.s), d: rec.d };
    const p2 = { t: rec.t, step: z(rec.a.noTranspose.s), d: rec.d };
    const p3 = { t: I.t0 + R.off, step: z(rec.a.body.s), d: rec.a.body.d };
    const p4 = { t: E.firstInVoice.get(rec.voice) + R.off, step: z(rec.a.body.s), d: rec.a.body.d };
    const p5 = { t: E.slot.x + R.shownOff, step: z(rec.a.body.s), d: R.shown };
    if (R.capped) p5.capped = true;
    const T = themeLevel.info.get(rec), TE = T.I.entry;
    rec.note = {
      id: notes.length, voice: rec.voice, index: rec.index, tag: rec.tag, diad: rec.diad,
      step: rec.step, edited: rec.a.edited, owner: I.name, entry: E.id, instance: rec.instance,
      theme: TE.id,
      litPos: rec.a.lit ? rec.a.lit.pos : null, refPos: I.ownerPos,
      pos: [null, p1, p2, p3, p4, p5],
    };
    notes.push(rec.note);
    const t5 = { t: TE.slot.x + T.shownOff, step: z(rec.th.body.s), d: T.shown };
    if (T.capped) t5.capped = true;
    written.push({ t: TE.at + T.off, d: rec.th.body.d });
    themeNotes.push({ id: rec.note.id, voice: rec.voice, index: rec.index, tag: rec.tag, diad: rec.diad,
      entry: TE.id, instance: rec.thInstance, pos: [null, p1, null, null, null, t5] });
  }

  // Stops 6 to 8, on the theme level.
  const themeRecs = all.map(rec => Object.assign(Object.create(rec), { a: rec.th, note: rec.sounding ? themeNotes[rec.note.id] : undefined }));
  const th = thematicFolds({ notes: themeNotes, recs: themeRecs, entries: themeLevel.entryList, relate, written },
    { gap, minLength: options.minLength, themeLength: options.themeLength, foldLength: options.foldLength, showFound: options.showFound });
  notes.forEach((n, k) => {
    n.pos.push(...th.notes[k].pos);
    n.bent = th.notes[k].bent;
    n.explainedBy = th.notes[k].explainedBy;
    n.fold8 = th.notes[k].fold8;
  });

  // The cell level (the cells stop and the core). A changed pip of an operator that made two pips
  // from one is not one pip for one pip (oneToMany). The pips that `@` put in
  // the place of one operand pip (`from`) are the parts of a split: `parts`
  // holds their durations, by `@` application and operand index. A part that
  // a later `@` replaced is not in the output, but its frame is on the
  // from.origin chain of the pips that replaced it.
  const changed = new Map();
  const parts = new Map();
  const seen = new Set();
  const addParts = frames => {
    for (const f of frames) {
      if (f.kind !== 'op' || !f.from || !f.out || seen.has(f)) continue;
      seen.add(f);
      const pk = f.app + '|' + f.from.index;
      if (!parts.has(pk)) parts.set(pk, new Map());
      parts.get(pk).set(f, Math.abs(f.out.ts));
      addParts(framesOf({ origin: f.from.origin }));
    }
  };
  for (const rec of all) {
    for (const f of rec.a.frames) {
      if (f.kind !== 'op' || f.exact || f.kept) continue;
      const k = f.app + '|' + f.index;
      if (!changed.has(k)) changed.set(k, new Set());
      changed.get(k).add(f);
    }
    addParts(rec.a.frames);
  }
  const oneToMany = new Set();
  for (const set of changed.values()) if (set.size > 1) for (const f of set) oneToMany.add(f);
  for (const rec of all) {
    rec.cl = analysePip(rec.pip, null, { oneToMany, parts });
    if (rec.cl.instanceKey === null) rec.cl.instanceKey = `p${rec.voice}:${rec.index}`;
    rec.clInstance = `${rec.voice}|${rec.cl.instanceKey}`;
  }
  const cellLevel = buildLevel(all, rec => rec.cl, rec => rec.clInstance, gap, capWidth, true);
  for (const rec of all) {
    if (!rec.sounding) continue;
    const n = rec.note;
    n.cell = cellLevel.info.get(rec).I.entry.id;
    n.cellBent = rec.cl.bend;
    if (rec.cl.split) n.split = { ...rec.cl.split };
  }

  // Stops 9 and on: the focus levels that `// #core a b / c` in the
  // program, or options.core, names by hand, one stop for each level; or,
  // without them, the cells stop.
  const themed = th.summary.units[8].some(u => u.kind === 'theme');
  let shown = null; // set by focusLevels, before the levels are laid out
  let ladder = null; // set by focusLevels: { derived, line, ancestors }
  const levels = focusLevels(cellLevel);
  notes.forEach((n, k) => { n.focus = levels.map(Lv => Lv.at[k]); });
  const nStops = 9 + levels.length;
  const last = levels[levels.length - 1];

  // Counts.
  const distinct = (fn) => new Set(notes.map(fn)).size;
  const pk = (n, s) => `${s >= 5 ? '' : n.voice}|${r9(n.pos[s].t)}|${r9(n.pos[s].step)}`;
  const instanceCount = distinct(n => n.instance);
  const counts = {
    notes: notes.length,
    edited: notes.filter(n => n.edited).length,
    cellEdited: all.filter(rec => rec.sounding && rec.cl.edited).length,
    cellBent: notes.filter(n => n.cellBent && !n.split).length,
    cellSplit: notes.filter(n => n.split).length,
    // Hidden notes (stops 9 and on) are not counted.
    positions: Array.from({ length: nStops }, (_, s) => (s === 0 ? null : new Set(notes.filter(n => !n.pos[s].hidden).map(n => pk(n, s))).size)),
    shapes: [instanceCount, instanceCount, instanceCount, instanceCount, distinct(n => n.voice + '|' + n.entry), entryList.length,
      th.summary.units[6].length, th.summary.units[7].length, th.summary.units[8].filter(u => u.kind !== 'residue').length,
      ...levels.map(Lv => Lv.units.filter(u => u.kind !== 'residue').length)],
    pipsWritten: distinct(n => pk(n, 5)),
    entries: entryList.length,
    explained: th.summary.explained,
    attached: th.summary.attachedNotes,
    core: last.kind === 'core' ? last.counts : null,
  };
  counts.positions[0] = counts.positions[1];
  counts.leverage = counts.pipsWritten ? counts.notes / counts.pipsWritten : 0;

  return {
    voices,
    notes,
    instances: buildInstanceTrees(all, voices.length),
    dictionary: entryList.map(E => ({
      id: E.id, name: E.name, count: E.count, pips: E.pips, residue: E.residue,
      litPos: E.litPos, refPos: E.refPos, slot: E.slot, instances: E.instances,
    })),
    counts,
    thematic: th.summary,
    inward: { themed, ladder, levels: levels.map(Lv => Lv.info) },
    shown,
    stops: ['heard', 'scale steps', 'no transposition', 'no mirror, reverse or stretch', 'no repetition', 'no nesting',
      'no unstated repeats', 'near-misses folded', 'themes only', ...levels.map(Lv => Lv.title)],
  };

  // Stops 9 and on, one stop for each level. The program names focus levels
  // by hand, `// #core a nugb / nug`, or names only the core, `// #core nug`,
  // and the fold derives the levels before it (deriveLadder). options.core
  // does the same: a string is read as the directive, an array of names
  // derives, an array of arrays is as written, and [] turns the directive
  // off. `/ nug` is the core alone. Each level is one stop, in order. Only
  // what the program states is used.
  // At a focus level a note that belongs to no named shape is hidden: it
  // keeps its position of the stop before on the slider (pos.hidden is true),
  // and counts do not count it.
  // - A level before the last shows whole definitions, as written: a note
  //   belongs to the outermost named definition of the level that it passed
  //   through (analysePip with only `named`). buildLevel gives one copy of
  //   each shape. Kind: shape.
  // - The last level is the core: cell-level entries of the named
  //   definitions. Each note is one of three kinds:
  //   - core: its cell is a core entry. It sits on its own slot of that entry.
  //   - attached: not a core note, and its cell-level owner use is the host
  //     use of a core statement. Going outward from the core definition, the
  //     host is the first definition use whose definition writes notes of its
  //     own (is the cell-level owner of some note). The note stacks on the
  //     core note of that host use that is nearest in time (the earlier on a
  //     tie).
  //   - hidden: every other note.
  //   The themes of stop 8 play no part: the core is picked by hand.
  // With no focus level there is one stop after 8, cells (cellsLevel).
  // Every level is laid out by layOut: the order of the shapes, and at the
  // cells stop their place, come from the stop before.
  function focusLevels(L) {
    const { lists: given, derive } = readCore(options.core ?? (trace.directives && trace.directives.core) ?? '');
    let lists = given, core = null, ancestors = null;
    if (derive) {
      core = coreLevel(L, given[0]);
      ({ lists, ancestors } = deriveLadder(core, given[0]));
    }
    if (lists.length) ladder = { derived: derive, line: lineOf(lists), ...(ancestors ? { ancestors } : {}) };
    const made = lists.length
      ? lists.map((names, i) => Object.assign(i === lists.length - 1 ? core || coreLevel(L, names) : shapeLevel(names), { title: names.join(' ') }))
      : [cellsLevel(L)];
    shown = shownStops(9 + made.length, lists.length > 0);
    return made.map((Lv, i) => layOut(Lv, 9 + i));
  }

  // The levels that `#core` or options.core give, as lists of names, and
  // whether the levels before the core are to be derived. A value with `/`
  // (or an array of arrays) is as written; empty levels are dropped, so
  // `/ nug` is the core alone. A value with names and no `/` (or an array of
  // names) is the core, and derive is true.
  function readCore(given) {
    const names = l => [...new Set(l.map(String).flatMap(x => x.split(/[\s,]+/)).filter(Boolean))];
    if (typeof given === 'string') {
      if (given.includes('/')) return { lists: given.split('/').map(x => names([x])).filter(l => l.length), derive: false };
      const core = names([given]);
      return { lists: core.length ? [core] : [], derive: core.length > 0 };
    }
    if (!Array.isArray(given)) return { lists: [], derive: false };
    if (given.some(Array.isArray)) return { lists: given.map(x => names(Array.isArray(x) ? x : [x])).filter(l => l.length), derive: false };
    const core = names(given);
    return { lists: core.length ? [core] : [], derive: core.length > 0 };
  }

  // The directive value that gives these levels when written out. One level
  // (the core alone) is written `/ nug`, so that it is not derived again.
  function lineOf(lists) {
    const line = lists.map(l => l.join(' ')).join(' / ');
    return lists.length === 1 ? '/ ' + line : line;
  }

  // The derived ladder (`// #core nug`). C is the core level of the given
  // names. At the cell level:
  // 1. An ancestor is a definition that a core or attached note of C passed
  //    through, outside the core definition. The definitions a note passed
  //    through are the ref frames of its chain from its cell-level owner
  //    outward.
  // 2. Its share is the part of the notes that passed through it that are
  //    core or attached. An ancestor with a share below 1/2 is not a level.
  // 3. A definition is real when it writes a note of its own (it is the
  //    cell-level owner of a note), or when, going inward from it along its
  //    notes, the first real definitions or cores reached are two or more
  //    different ones. A definition that is not real is a wrapper, and is not
  //    a level.
  // 4. A definition that is used once is a passage, not a shape that
  //    returns, and is not a level (a voice section that is mostly the
  //    subject).
  // 5. The height of a level ancestor is 1 plus the greatest height of the
  //    level ancestors inside it (0 when there are none).
  // 6. One level for each height, the greatest first, then the core; names
  //    in source order. Past options.maxLevels (4) heights, the ones nearest
  //    the core are kept.
  function deriveLadder(C, given) {
    const coreNames = new Set(C.names);
    const recs = all.filter(rec => rec.sounding);
    const chainOf = rec => rec.cl.chain || rec.cl.frames;
    const paths = recs.map((rec, j) => {
      const fr = chainOf(rec), o = rec.cl.owner ? fr.indexOf(rec.cl.owner) : -1;
      const refs = [];
      for (let i = Math.max(o, 0); o >= 0 && i < fr.length; i++) if (fr[i].kind === 'ref') refs.push(i);
      return { fr, o, refs, kind: C.place[j].kind };
    });
    const total = new Map(), hit = new Map(), ancestor = new Set(), own = new Set();
    for (const P of paths) {
      if (P.o >= 0) own.add(P.fr[P.o].name);
      const on = P.kind === 'core' || P.kind === 'attached';
      for (const name of new Set(P.refs.map(i => P.fr[i].name))) {
        total.set(name, (total.get(name) || 0) + 1);
        if (!on) continue;
        hit.set(name, (hit.get(name) || 0) + 1);
        if (!coreNames.has(name)) ancestor.add(name);
      }
    }
    const share = name => (hit.get(name) || 0) / total.get(name);
    const realMemo = new Map();
    const real = name => {
      if (realMemo.has(name)) return realMemo.get(name);
      realMemo.set(name, false); // a definition that holds itself is not real by that
      let r = own.has(name);
      if (!r) {
        const reached = new Set();
        for (const P of paths) {
          for (const j of P.refs) {
            if (P.fr[j].name !== name) continue;
            for (let i = j - 1; i >= P.o; i--) {
              const f = P.fr[i];
              if (f.kind === 'ref' && (coreNames.has(f.name) || real(f.name))) { reached.add(f.name); break; }
            }
          }
        }
        r = reached.size >= 2;
      }
      realMemo.set(name, r);
      return r;
    };
    const level = new Set([...ancestor].filter(name => share(name) >= 0.5 && real(name) && (usesOf.get(name) || { size: 0 }).size >= 2));
    const inner = new Map([...level].map(name => [name, new Set()]));
    for (const P of paths) {
      const on = P.refs.filter(i => level.has(P.fr[i].name));
      for (let a = 0; a < on.length; a++) for (let b = a + 1; b < on.length; b++) {
        const x = P.fr[on[a]].name, y = P.fr[on[b]].name;
        if (x !== y) inner.get(y).add(x);
      }
    }
    const heightMemo = new Map();
    const height = name => {
      if (heightMemo.has(name)) return heightMemo.get(name);
      heightMemo.set(name, 1);
      let h = 0;
      for (const x of inner.get(name)) h = Math.max(h, height(x));
      heightMemo.set(name, h + 1);
      return h + 1;
    };
    const src = trace.source || '';
    const at = name => {
      const m = new RegExp('^[ \\t]*' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[ \\t]*=(?!=)', 'm').exec(src);
      return m ? m.index : Infinity;
    };
    const byHeight = new Map();
    for (const name of level) {
      const h = height(name);
      if (!byHeight.has(h)) byHeight.set(h, []);
      byHeight.get(h).push(name);
    }
    const max = options.maxLevels ?? 4;
    const heights = [...byHeight.keys()].sort((x, y) => x - y).slice(0, Math.max(0, max)).reverse();
    const lists = [...heights.map(h => byHeight.get(h).sort((x, y) => at(x) - at(y) || x.localeCompare(y))), given];
    const ancestors = [...ancestor].sort((x, y) => at(x) - at(y) || x.localeCompare(y)).map(name => ({
      name, share: round9(share(name)), real: real(name), height: level.has(name) ? height(name) : null }));
    return { lists, ancestors };
  }

  // The stops the slider shows, of the n stops of the model: every stop but
  // 5 (nesting), and 8 (themes) only when there is no focus level (`core`).
  // options.shown, an array of stop numbers, replaces the rule: numbers the
  // model does not have are left out, the rest are sorted, and stop 0 is
  // always first.
  function shownStops(n, core) {
    const given = options.shown;
    const list = Array.isArray(given)
      ? [...new Set(given.map(Number))].filter(k => Number.isInteger(k) && k > 0 && k < n).sort((a, b) => a - b)
      : Array.from({ length: n }, (_, k) => k).filter(k => k > 0 && k !== 5 && !(k === 8 && core));
    return [0, ...list];
  }

  // The stop before stop k: the last shown stop under k. Stop 0 has no
  // position in the model (the host adds pitch to stop 1), so it reads as 1.
  function stopBefore(k) {
    return Math.max(1, ...shown.filter(s => s < k));
  }

  // Units of a level: one for each entry, in source order (layOut orders and
  // places them). Returns the units and a map from entry to unit.
  function packUnits(entries) {
    const units = [], unitOf = new Map();
    for (const E of entries) {
      const U = { kind: 'entry', id: E.id, name: E.name, count: E.count, width: E.shownLength };
      units.push(U);
      unitOf.set(E, U);
    }
    return { units, unitOf };
  }

  // The position of rec on its own slot of level B, from the start of its unit.
  function slotPos(B, rec, a) {
    const R = B.info.get(rec);
    const p = { t: R.shownOff, step: z(a.body.s), d: R.shown };
    if (R.capped) p.capped = true;
    return p;
  }

  // Order and place of the units of level Lv at stop k, then positions,
  // focus entries and the summary. The stop before (b) is the last shown
  // stop under k (stopBefore), so that no note passes through the layout of
  // a stop the slider does not show. The key of a unit is the smallest x at
  // stop b of its notes that are shown there; when b is 8, a note on the
  // residue marker does not count, unless the unit has no other notes.
  // Ties keep source order. The residue marker comes last. At the cells stop
  // (Lv.keep) a unit starts at its key when there is room, and otherwise
  // right after the unit before it; at a focus level the units are packed
  // side by side from 0. Each place `h` is { kind, U, r } (r: the position
  // from the start of U) or { kind: 'hidden' }. Attached notes add no
  // position. A hidden note keeps the position of the stop before.
  function layOut(Lv, k) {
    const { place, units } = Lv;
    const b = stopBefore(k);
    const key = new Map(), any = new Map();
    const low = (m, U, t) => m.set(U, Math.min(m.has(U) ? m.get(U) : Infinity, t));
    place.forEach((h, j) => {
      if (!h.U) return;
      const p = notes[j].pos[b];
      low(any, h.U, p.t);
      if (!p.hidden && !(b === 8 && notes[j].fold8.kind === 'residue')) low(key, h.U, p.t);
    });
    const keyOf = U => (key.has(U) ? key.get(U) : any.has(U) ? any.get(U) : Infinity);
    const order = units.map((U, i) => ({ U, i }))
      .sort((a, b) => (a.U.kind === 'residue') - (b.U.kind === 'residue') || keyOf(a.U) - keyOf(b.U) || a.i - b.i)
      .map(o => o.U);
    let x = 0;
    for (const U of order) {
      U.x = Lv.keep && Number.isFinite(keyOf(U)) ? Math.max(x, keyOf(U)) : x;
      x = U.x + U.width + gap;
      U.keys = new Set();
      U.notes = 0;
    }
    notes.forEach((n, j) => {
      const h = place[j];
      if (!h.U) { n.pos[k] = { ...n.pos[b], hidden: true }; return; }
      const p = n.pos[k] = { ...h.r, t: h.U.x + h.r.t };
      if (h.kind !== 'attached') h.U.keys.add(r9(p.t) + '|' + r9(p.step));
      h.U.notes++;
      if (h.kind === 'attached') h.U.attached = (h.U.attached || 0) + 1;
    });
    for (const U of order) { U.positions = U.keys.size; delete U.keys; }
    const at = place.map(h => ({ kind: h.kind, unit: h.U ? h.U.id : null, entry: h.U && h.U.kind === 'entry' ? h.U.id : null, host: h.host ?? null }));
    const hidden = place.filter(h => h.kind === 'hidden').length;
    const info = { names: Lv.names, missing: Lv.missing, kind: Lv.kind, units: order, shown: place.length - hidden,
      attached: place.filter(h => h.kind === 'attached').length, hidden };
    return { kind: Lv.kind, title: Lv.title, at, units: order, info, counts: Lv.counts };
  }

  // The cells stop (no focus level): the themes of stop 8 open to the cell
  // level. A note that sits on a theme at stop 8 goes to the place of its
  // slot's own note (fold8.rep) on that note's cell-level entry. Only the
  // entries that a theme reaches are shown. Found units (showFound) keep
  // their stop 8 layout, and the residue marker stays one position. With no
  // theme at stop 8, every note opens in place and all entries are shown.
  function cellsLevel(L) {
    const recOf = [];
    for (const rec of all) if (rec.sounding) recOf[rec.note.id] = rec;
    const units8 = th.summary.units[8];
    const host = notes.map((n, k) => {
      if (!themed) return { kind: 'cell', rec: recOf[k] };
      const u = units8[th.notes[k].unit8];
      if (u.kind === 'theme') return { kind: 'cell', rec: recOf[n.fold8.rep] };
      return { kind: u.kind, u };
    });
    const reached = new Set(host.filter(h => h.rec).map(h => L.info.get(h.rec).I.entry));
    const units = [], unitOf = new Map();
    const add = (key, U) => { units.push(U); unitOf.set(key, U); };
    for (const E of L.entryList) if (reached.has(E)) add(E, { kind: 'entry', id: E.id, name: E.name, count: E.count, width: E.shownLength });
    for (const u of units8) if (u.kind === 'found' && host.some(h => h.u === u)) add(u, { kind: 'found', id: u.id, name: u.name, width: u.width });
    const res = units8.find(u => u.kind === 'residue');
    if (res && host.some(h => h.kind === 'residue')) add(res, { kind: 'residue', id: 'residue', name: null, width: res.width });
    const place = host.map((h, k) => {
      if (h.rec) return { kind: 'cell', U: unitOf.get(L.info.get(h.rec).I.entry), r: slotPos(L, h.rec, h.rec.cl) };
      const U = unitOf.get(h.u);
      if (h.kind === 'found') {
        const p8 = notes[k].pos[8];
        const r = { t: p8.t - h.u.x, step: p8.step, d: p8.d };
        if (p8.capped) r.capped = true;
        return { kind: 'found', U, r };
      }
      return { kind: 'residue', U, r: { t: 0, step: 0, d: U.width } };
    });
    return { kind: 'cells', title: 'cells', keep: true, place, units, names: [], missing: [], counts: null };
  }

  function shapeLevel(names) {
    const named = new Set(names);
    const level = { named, inside: () => false, part: () => false, fan: () => false, uses: () => 0 };
    const an = new Map();
    for (const rec of all) {
      const a = analysePip(rec.pip, level);
      if (a.instanceKey === null) a.instanceKey = `p${rec.voice}:${rec.index}`;
      an.set(rec, a);
    }
    const A = rec => an.get(rec);
    const B = buildLevel(all, A, rec => `${rec.voice}|${A(rec).instanceKey}`, gap, capWidth, true);
    const { units, unitOf } = packUnits(B.entryList.filter(E => E.name != null && named.has(E.name)));
    const place = all.filter(rec => rec.sounding).map(rec => {
      const U = unitOf.get(B.info.get(rec).I.entry);
      return U ? { kind: 'shape', U, r: slotPos(B, rec, A(rec)) } : { kind: 'hidden' };
    });
    const found = names.filter(name => units.some(U => U.name === name));
    return { kind: 'shapes', place, units, names: found, missing: names.filter(name => !found.includes(name)), counts: null };
  }

  function coreLevel(L, given) {
    const names = [], missing = [];
    for (const name of given) (L.entryList.some(E => E.name === name) ? names : missing).push(name);
    const recs = all.filter(rec => rec.sounding);
    const entryOf = rec => L.info.get(rec).I.entry;
    const isCore = rec => names.includes(entryOf(rec).name);
    const chainOf = rec => rec.cl.chain || rec.cl.frames;
    // The key of a definition use: the voice and every frame from the use
    // outward (as in usesOf).
    const useKey = (rec, i) => rec.voice + '|' + chainOf(rec).slice(i).map(frameKey).join('/');
    const writes = new Set(recs.filter(rec => rec.cl.owner).map(rec => rec.cl.owner.name));
    const coreAt = new Map(); // host use key -> core recs in it
    for (const rec of recs) {
      if (!isCore(rec)) continue;
      const fr = chainOf(rec), o = fr.indexOf(rec.cl.owner);
      for (let i = o + 1; o >= 0 && i < fr.length; i++) {
        if (fr[i].kind !== 'ref' || !writes.has(fr[i].name)) continue;
        const key = useKey(rec, i);
        if (!coreAt.has(key)) coreAt.set(key, []);
        coreAt.get(key).push(rec);
        break;
      }
    }
    const { units, unitOf } = packUnits(L.entryList.filter(E => names.includes(E.name)));
    const own = rec => ({ U: unitOf.get(entryOf(rec)), r: slotPos(L, rec, rec.cl) });
    const counts = { stated: 0, bent: 0, split: 0, attached: 0, hidden: 0 };
    const place = recs.map(rec => {
      const n = rec.note;
      if (isCore(rec)) {
        counts.stated++;
        if (n.split) counts.split++;
        else if (n.cellBent) counts.bent++;
        return { kind: 'core', ...own(rec) };
      }
      const o = rec.cl.owner ? chainOf(rec).indexOf(rec.cl.owner) : -1;
      const list = o >= 0 && coreAt.get(useKey(rec, o));
      if (!list) { counts.hidden++; return { kind: 'hidden' }; }
      let best = null;
      for (const c of list) {
        const dt = Math.abs(c.t - rec.t), bt = best && Math.abs(best.t - rec.t);
        if (!best || dt < bt - EPS || (Math.abs(dt - bt) <= EPS && c.t < best.t)) best = c;
      }
      counts.attached++;
      return { kind: 'attached', ...own(best), host: rec.cl.owner.name };
    });
    return { kind: 'core', place, units, names, missing, counts };
  }
}

// Instance tree per voice: definition uses and operator copies, outermost
// first, with runs of literal pips as leaves. Concatenation is transparent.
function buildInstanceTrees(all, nVoices) {
  const roots = [];
  for (let v = 0; v < nVoices; v++) roots.push({ kind: 'voice', voice: v, level: 0, t0: Infinity, t1: -Infinity, first: Infinity, last: -1, children: [] });
  for (const rec of all) {
    const root = roots[rec.voice];
    let node = root;
    touch(node, rec);
    const fr = rec.a.frames;
    let level = 0;
    for (let i = fr.length - 1; i >= 1; i--) {
      const f = fr[i];
      if (f.kind === 'op' && (TRANSPARENT.has(f.op) || f.kept)) continue;
      const key = frameKey(f);
      let child = node._map && node._map.get(key);
      if (!child) {
        if (f.kind === 'ref') level++;
        child = f.kind === 'ref'
          ? { kind: 'ref', name: f.name, use: f.use, pos: f.pos, level }
          : { kind: 'op', op: f.op, app: f.app, copy: f.copy, arg: f.arg, exact: f.exact, reverse: !!f.reverse, level };
        Object.assign(child, { t0: Infinity, t1: -Infinity, first: Infinity, last: -1, children: [] });
        (node._map ||= new Map()).set(key, child);
        node.children.push(child);
      } else if (f.kind === 'ref') level++;
      node = child;
      touch(node, rec);
    }
    // Leaf: a run of literal pips (or edited pips) directly under this node.
    const lit = fr[0] && fr[0].kind === 'lit' ? fr[0] : null;
    const lastChild = node.children[node.children.length - 1];
    if (lastChild && lastChild.kind === 'lit' && lastChild.last === rec.index - 1) {
      touch(lastChild, rec);
      if (lit && lit.pos != null) lastChild.pos = Math.min(lastChild.pos ?? Infinity, lit.pos);
    } else {
      const leaf = { kind: 'lit', level: level + 1, pos: lit ? lit.pos : null, edited: !lit, t0: Infinity, t1: -Infinity, first: Infinity, last: -1, children: [] };
      touch(leaf, rec);
      node.children.push(leaf);
    }
  }
  const clean = n => { delete n._map; n.children.forEach(clean); return n; };
  return roots.map(clean);
}

function touch(n, rec) {
  n.t0 = Math.min(n.t0, rec.t);
  n.t1 = Math.max(n.t1, rec.t + rec.d);
  n.first = Math.min(n.first, rec.index);
  n.last = Math.max(n.last, rec.index);
  if (rec.sounding) n.notes = (n.notes || 0) + 1;
}

golden.crux_fold_model = foldModel;
golden.crux_fold = function (source, options) {
  return foldModel(golden.crux_trace(source), options);
};
