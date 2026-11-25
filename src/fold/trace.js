// Crux trace: where each output pip came from.
//
//   golden.crux_trace(source) -> the crux_interp result, plus for each pip an
//   `origin`: the outermost frame of a linked list of frames (frame.next is the
//   next inner frame, the last one is the literal). golden.crux_trace_frames(pip)
//   returns the frames as an array, innermost first.
//
// Frames:
//   { kind: 'lit', pos, step, ts, tag }              the literal pip
//   { kind: 'ref', name, use, index, pos }           passed through definition `name`
//   { kind: 'op', op, app, copy, index, arg, exact } passed through an operator
//
// `use` is unique to one evaluation of one reference. `app` is unique to one
// evaluation of one operator. `index` is the pip's position in the operand (op)
// or in the definition's value (ref). `pos` values are offsets in the source
// as given. Op frames can also carry `reverse` (fan copy played backwards),
// `kept` (non-exact operator passed this pip through unchanged) and `out`
// (non-exact operator: the pip's step and timeScale after the operator).
// A new pip of `@` that took the place of one operand pip also has `from`:
// { origin, index, part, parts }, the operand pip's origin and index, and the
// new pip's place in the run of pips that replaced it (see markReplaced).
//
// The trace works by wrapping the evaluator's methods for the length of one
// call. crux_interp is not changed and does no extra work. Pips that the
// evaluator shares between uses are never changed: a frame is added to a copy.
import '../index.js';

const EXACT = { FollowedBy: ',', Mul: '*', Expand: '^', RepeatByCount: ':', Dot: '.', Mirror: 'm', MotTimeScaleOp: '||' };
const GENERIC = {
  JamOp: 'j', DotJam: '.j', DotExpand: '.^', RotateOp: '~', DotRotate: '.~', Steps: '->', DotSteps: '.->',
  DotMirror: '.m', Lens: 'l', DotLens: '.l', DotZip: '.,', ZipColumns: 'zip', ZipInfix: 'z', GlassOp: 'g', DotGlass: '.g',
  ReichOp: 'r', DotReich: '.r', PaertOp: 'p', FoldOp: 'f', DisplaceOp: '>>', Subdivide: '/', TieOp: 't',
  DotTie: '.t', ConstraintOp: 'c', DotConstraint: '.c', AtIndexOp: '@', DropTransform: '\\',
};

let T = null; // trace state while a trace runs

function isMotLike(v) {
  return v != null && typeof v === 'object' && Array.isArray(v.values);
}

function clonePip(p, origin) {
  const q = Object.assign(Object.create(Object.getPrototypeOf(p)), p);
  q.origin = origin;
  return q;
}

function withValues(mot, values) {
  const m = Object.assign(Object.create(Object.getPrototypeOf(mot)), mot);
  m.values = values;
  return m;
}

function mapPos(pos) {
  if (typeof pos !== 'number') return null;
  return T.positionMap && T.positionMap[pos] != null ? T.positionMap[pos] : pos;
}

function litFrame(p) {
  return { kind: 'lit', pos: mapPos(p.sourcePos), step: p.step, ts: p.timeScale, tag: p.tag ?? null, next: null };
}

function originOf(p) {
  return p && p.origin ? p.origin : null;
}

function motChildren(cap) {
  return cap.filter(isMotLike);
}

// Exact operators: output pip k comes from operand pip srcs[k].
function exactMap(name, node, out, cap) {
  const kids = motChildren(cap);
  const n = out.values.length;
  const app = ++T.app;
  const op = EXACT[name];
  const res = new Array(n);
  const put = (k, src, extra) => {
    res[k] = clonePip(out.values[k], { kind: 'op', op, app, exact: true, ...extra, next: originOf(src) });
  };
  if (name === 'FollowedBy') {
    const [a, b] = kids;
    if (!a || !b || a.values.length + b.values.length !== n) return null;
    a.values.forEach((p, i) => put(i, p, { copy: 0, index: i, arg: null }));
    b.values.forEach((p, i) => put(a.values.length + i, p, { copy: 1, index: i, arg: null }));
    return res;
  }
  if (name === 'Mul' || name === 'Expand') {
    const [x0, y, ...more] = kids;
    if (!x0 || !y) return null;
    let k = 0, extra = 0;
    for (let c = 0; c < y.values.length; c++) {
      const yi = y.values[c];
      const reverse = yi.timeScale < 0;
      const absTs = Math.abs(yi.timeScale);
      let base = x0;
      if (name === 'Mul' && yi.step === 0 && absTs === 1 && !yi.tag) base = more[extra++];
      if (!base) return null;
      const m = base.values.length;
      for (let j = 0; j < m; j++) {
        if (k >= n) return null;
        const index = reverse ? m - 1 - j : j;
        put(k++, base.values[index], { copy: c, index, arg: { step: yi.step, ts: absTs }, reverse });
      }
    }
    return k === n ? res : null;
  }
  if (name === 'RepeatByCount') {
    const [x] = kids;
    const m = x ? x.values.length : 0;
    if (!m || n % m !== 0) return null;
    for (let k = 0; k < n; k++) put(k, x.values[k % m], { copy: Math.floor(k / m), index: k % m, arg: null });
    return res;
  }
  if (name === 'Mirror') {
    const [x, y] = kids;
    if (!x || !y || x.values.length * y.values.length !== n) return null;
    const m = x.values.length;
    for (let k = 0; k < n; k++) {
      const r = y.values[Math.floor(k / m)];
      put(k, x.values[k % m], { copy: Math.floor(k / m), index: k % m, arg: { step: r.step, ts: r.timeScale } });
    }
    return res;
  }
  if (name === 'Dot' || name === 'MotTimeScaleOp') {
    const [x] = kids;
    if (!x || x.values.length !== n) return null;
    for (let k = 0; k < n; k++) {
      const a = x.values[k], b = out.values[k];
      const ts = a.timeScale ? b.timeScale / a.timeScale : 1;
      const arg = name === 'Dot' ? { step: b.step - a.step, ts } : { step: 0, ts };
      put(k, a, { copy: 0, index: k, arg });
    }
    return res;
  }
  return null;
}

function sameValue(a, b) {
  return a.step === b.step && a.timeScale === b.timeScale && (a.tag ?? null) === (b.tag ?? null);
}

// Every other operator: one frame per pip, exact: false.
function genericMap(op, out, cap) {
  const kids = motChildren(cap);
  const x = kids[0];
  const app = ++T.app;
  const xs = x ? x.values : [];
  const byObj = new Map(xs.map((p, i) => [p, i]));
  const res = out.values.map((p, k) => {
    let index = byObj.has(p) ? byObj.get(p) : -1;
    if (index < 0 && p.origin) index = xs.findIndex(q => q.origin === p.origin && sameValue(p, q));
    if (index >= 0) {
      return clonePip(p, { kind: 'op', op, app, exact: false, kept: true, copy: 0, index, arg: null, next: originOf(xs[index]) });
    }
    // Changed pip: keep the operand pip it came from, when that can be known.
    let next = originOf(p);
    let from = -1;
    if (!next && xs.length === out.values.length) { from = k; next = originOf(xs[k]); }
    if (next && from < 0) from = xs.findIndex(q => q.origin === next);
    return clonePip(p, {
      kind: 'op', op, app, exact: false, kept: false, copy: 0, index: from, arg: null,
      out: { step: p.step, ts: p.timeScale }, next,
    });
  });
  if (op === '@') markReplaced(res, xs);
  return res;
}

// `@` only: a run of new pips (no operand index) between two pips whose
// operand index is known (or an end of the mot) replaced the operand pips in
// the same gap. When that gap holds exactly one operand pip, each pip of the
// run gets `from` on its frame: the origin and index of the operand pip, its
// own place in the run and the run's length. `index` and `next` stay as they
// are.
function markReplaced(res, xs) {
  const idx = res.map(p => p.origin.index);
  for (let k = 0; k < res.length;) {
    if (idx[k] >= 0) { k++; continue; }
    let e = k;
    while (e < res.length && idx[e] < 0) e++;
    const lo = k > 0 ? idx[k - 1] : -1;
    const hi = e < res.length ? idx[e] : xs.length;
    if (hi - lo === 2) {
      const index = lo + 1;
      for (let j = k; j < e; j++) {
        res[j].origin.from = { origin: originOf(xs[index]), index, part: j - k, parts: e - k };
      }
    }
    k = e;
  }
}

function post(name, node, out, cap) {
  if (!isMotLike(out)) return out;
  const vals = out.values;
  if (name === 'Mot') {
    if (!vals.some(p => !p.origin)) return out;
    return withValues(out, vals.map(p => (p.origin ? p : clonePip(p, litFrame(p)))));
  }
  if (name === 'Ref') {
    const use = ++T.use;
    const pos = mapPos(node.pos);
    return withValues(out, vals.map((p, index) =>
      clonePip(p, { kind: 'ref', name: node.name, use, index, pos, next: originOf(p) || litFrame(p) })));
  }
  if (name === 'GlobalPlaceholder') {
    const app = ++T.app;
    return withValues(out, vals.map((p, index) =>
      clonePip(p, { kind: 'op', op: '_', app, exact: true, copy: 0, index, arg: null, next: originOf(p) })));
  }
  if (name === 'AliasCall') return out; // the aliased operator wrote the frame
  if (name === 'NestedMot' || name === 'NestedMotExpr') {
    // Structural: the same pips, copied. Carry the origin across.
    const kids = motChildren(cap);
    const all = kids.flatMap(m => m.values);
    const last = kids.length ? kids[kids.length - 1].values : [];
    const src = all.length === vals.length ? all : (last.length === vals.length ? last : null);
    if (src) return withValues(out, vals.map((p, k) => clonePip(p, originOf(src[k]) || litFrame(p))));
    return withValues(out, genericMap('[]', out, cap));
  }
  if (name in EXACT) {
    const mapped = exactMap(name, node, out, cap);
    if (mapped) return withValues(out, mapped);
    return withValues(out, genericMap(EXACT[name], out, cap));
  }
  return withValues(out, genericMap(GENERIC[name] || name, out, cap));
}

function install() {
  const I = golden._cruxInternals;
  const saved = [];
  const wrapEval = (name) => {
    const C = I[name];
    if (!C || !Object.prototype.hasOwnProperty.call(C.prototype, 'eval')) return;
    const orig = C.prototype.eval;
    saved.push([C.prototype, 'eval', orig]);
    C.prototype.eval = function (env) {
      const parent = T.cap;
      const cap = [];
      T.cap = cap;
      let out;
      try { out = orig.call(this, env); } finally { T.cap = parent; }
      // A subclass without its own eval (DotConstraint) reports its own name.
      const own = this.constructor && I[this.constructor.name] === this.constructor ? this.constructor.name : name;
      out = post(own, this, out, cap);
      if (parent) parent.push(out);
      return out;
    };
  };
  for (const name of ['Mot', 'NestedMot', 'NestedMotExpr', 'Ref', 'GlobalPlaceholder', 'AliasCall',
    ...Object.keys(EXACT), ...Object.keys(GENERIC)]) wrapEval(name);
  // Pips made by mul/expand/withDiad keep the left pip's origin.
  for (const m of ['mul', 'expand', 'withDiad']) {
    const orig = I.Pip.prototype[m];
    saved.push([I.Pip.prototype, m, orig]);
    I.Pip.prototype[m] = function (...args) {
      const out = orig.apply(this, args);
      if (this.origin && out && !out.origin) out.origin = this.origin;
      return out;
    };
  }
  const rnd = Math.random;
  saved.push([Math, 'random', rnd]);
  Math.random = function () { T.unseededRandom = true; return rnd(); };
  return () => { for (const [obj, key, fn] of saved.reverse()) obj[key] = fn; };
}

golden.crux_trace = function (source) {
  if (T) throw new Error('crux_trace is not re-entrant');
  T = { use: 0, app: 0, cap: null, unseededRandom: false,
    positionMap: golden._cruxInternals.preprocessSource(source).positionMap };
  const uninstall = install();
  try {
    const result = golden.crux_interp(source);
    return { ...result, trace: true, unseededRandom: T.unseededRandom, source };
  } finally {
    uninstall();
    T = null;
  }
};

// Frames of one traced pip, innermost (the literal) first.
golden.crux_trace_frames = function (pip) {
  const out = [];
  for (let f = pip && pip.origin; f; f = f.next) out.push(f);
  return out.reverse();
};

export const cruxTrace = golden.crux_trace;
export const traceFrames = golden.crux_trace_frames;
