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
//   6  unstated exact repeats removed (thematic.js)
//   7  near-misses folded onto the program's definitions (thematic.js)
//   8  themes only, with a residue group for what no theme explains (thematic.js)
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

function analysePip(pip) {
  const frames = framesOf(pip);
  let e = -1;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    if (f.kind === 'op' && !f.exact && !f.kept) e = i;
  }
  let owner = -1;
  for (let i = e + 1; i < frames.length; i++) if (frames[i].kind === 'ref') { owner = i; break; }
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
  return { frames, edited: e >= 0, owner: ownerFrame, body, full: at(FULL), noTranspose: at(NO_TRANSPOSE), canon, instanceKey, lit, outer };
}

export function foldModel(trace, options = {}) {
  if (!trace || !trace.trace) throw new Error('foldModel needs the result of crux_trace');
  if (trace.unseededRandom) {
    throw new Error('The fold needs a fixed program, and this one has random choices without a seed. Give each random choice a seed (or freeze the seeds) and try again.');
  }
  const gap = options.gap ?? 0.5;
  const notes = [];
  const all = []; // every pip, rests included
  const voices = [];

  trace.sections.forEach((mot, voice) => {
    let t = 0;
    mot.values.forEach((pip, index) => {
      const d = Math.abs(pip.timeScale);
      const a = analysePip(pip);
      const sounding = pip.tag !== 'r';
      const rec = { voice, index, t, d, step: pip.step, tag: pip.tag ?? null, sounding, a,
        diad: pip.diad ? pip.diad.map(x => x - pip.step) : null };
      if (rec.a.instanceKey === null) rec.a.instanceKey = `p${voice}:${index}`;
      rec.instance = `${voice}|${rec.a.instanceKey}`;
      all.push(rec);
      t += d;
    });
    voices.push({ voice, duration: t, pips: mot.values.length });
  });

  // Instances: start time and canonical offsets (stop 3).
  const inst = new Map();
  for (const rec of all) {
    let I = inst.get(rec.instance);
    if (!I) {
      I = { key: rec.instance, voice: rec.voice, t0: rec.t, t1: rec.t + rec.d, recs: [], name: rec.a.owner ? rec.a.owner.name : null, ownerPos: rec.a.owner ? rec.a.owner.pos : null };
      inst.set(rec.instance, I);
    }
    I.t0 = Math.min(I.t0, rec.t);
    I.t1 = Math.max(I.t1, rec.t + rec.d);
    I.recs.push(rec);
  }
  for (const I of inst.values()) {
    const order = I.recs.slice().sort((x, y) => (x.a.canon ?? x.index) - (y.a.canon ?? y.index) || x.index - y.index);
    let off = 0;
    for (const rec of order) { rec.off = off; off += rec.a.body.d; }
    I.length = off;
    I.signature = (I.name ?? '#') + '|' + order.map(r => [r.a.canon ?? '', r9(r.a.body.s), r9(r.a.body.d), r.tag ?? ''].join(':')).join(',');
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
      const litPos = Math.min(...I.recs.map(r => (r.a.lit && r.a.lit.pos != null ? r.a.lit.pos : Infinity)));
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
  // Folded layout (stop 5): entries side by side in source order.
  const entryList = [...entries.values()].sort((x, y) => (x.litPos ?? Infinity) - (y.litPos ?? Infinity) || x.id.localeCompare(y.id));
  let x = 0;
  for (const E of entryList) {
    E.slot = { x, width: E.length };
    x += E.length + gap;
    E.residue = E.name == null && E.count === 1;
  }

  // Notes and their positions.
  for (const rec of all) {
    if (!rec.sounding) continue;
    const I = inst.get(rec.instance);
    const E = I.entry;
    const p1 = { t: rec.t, step: z(rec.a.full.s), d: rec.d };
    const p2 = { t: rec.t, step: z(rec.a.noTranspose.s), d: rec.d };
    const p3 = { t: I.t0 + rec.off, step: z(rec.a.body.s), d: rec.a.body.d };
    const p4 = { t: E.firstInVoice.get(rec.voice) + rec.off, step: z(rec.a.body.s), d: rec.a.body.d };
    const p5 = { t: E.slot.x + rec.off, step: z(rec.a.body.s), d: rec.a.body.d };
    rec.note = {
      id: notes.length, voice: rec.voice, index: rec.index, tag: rec.tag, diad: rec.diad,
      step: rec.step, edited: rec.a.edited, owner: I.name, entry: E.id, instance: rec.instance,
      litPos: rec.a.lit ? rec.a.lit.pos : null, refPos: I.ownerPos,
      pos: [null, p1, p2, p3, p4, p5],
    };
    notes.push(rec.note);
  }

  // Stops 6 to 8.
  const th = thematicFolds({ notes, recs: all, entries: entryList, relate }, { gap, minLength: options.minLength, themeLength: options.themeLength });
  notes.forEach((n, k) => {
    n.pos.push(...th.notes[k].pos);
    n.bent = th.notes[k].bent;
    n.explainedBy = th.notes[k].explainedBy;
    n.fold8 = th.notes[k].fold8;
  });

  // Counts.
  const distinct = (fn) => new Set(notes.map(fn)).size;
  const pk = (n, s) => `${s >= 5 ? '' : n.voice}|${r9(n.pos[s].t)}|${r9(n.pos[s].step)}`;
  const instanceCount = distinct(n => n.instance);
  const counts = {
    notes: notes.length,
    edited: notes.filter(n => n.edited).length,
    positions: [null, 1, 2, 3, 4, 5, 6, 7, 8].map(s => (s === null ? null : distinct(n => pk(n, s)))),
    shapes: [instanceCount, instanceCount, instanceCount, instanceCount, distinct(n => n.voice + '|' + n.entry), entryList.length,
      th.summary.units[6].length, th.summary.units[7].length, th.summary.units[8].filter(u => u.kind !== 'residue').length],
    pipsWritten: distinct(n => pk(n, 5)),
    entries: entryList.length,
    explained: th.summary.explained,
    attached: th.summary.attachedNotes,
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
    stops: ['heard', 'scale steps', 'no transposition', 'no mirror, reverse or stretch', 'no repetition', 'no nesting',
      'no unstated repeats', 'near-misses folded', 'themes only'],
  };
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
