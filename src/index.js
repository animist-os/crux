import * as ohm from 'ohm-js';






const g = ohm.grammar(String.raw`
  Andy {
  
    Prog
      = Stmt*
  
    Stmt
      = AssignStmt
      | ExprStmt
  
    AssignStmt
      = ident "=" Expr
  
    ExprStmt
      = Expr
  
    Expr
      = FollowedByExpr
  
    FollowedByExpr
      = FollowedByExpr "," MulExpr   -- fby
      | FollowedByExpr hspaces MulExpr  -- juxt
      | MulExpr
  
    MulExpr
      = MulExpr ".*" RepeatExpr -- dotStar
      | MulExpr ".^" RepeatExpr -- dotExpand
      | MulExpr ".n" RepeatExpr  -- dotNeighbor
      | MulExpr ".->" RepeatExpr -- dotSteps
      | MulExpr ".m" RepeatExpr  -- dotMirror
      | MulExpr ".l" RepeatExpr  -- dotLens
      | MulExpr ".t" RepeatExpr  -- dotTie
      | MulExpr ".c" RepeatExpr  -- dotConstraint
      | MulExpr ".f" RepeatExpr  -- dotFilter
      | MulExpr "->" RepeatExpr  -- steps
      | MulExpr "n" RepeatExpr   -- neighbor
      | MulExpr "a" RepeatExpr   -- anticip
      | MulExpr "m" RepeatExpr   -- mirror
      | MulExpr "l" RepeatExpr   -- lens
      | MulExpr "t" RepeatExpr   -- tie
      | MulExpr "c" RepeatExpr   -- constraint
      | MulExpr "f" RepeatExpr   -- filter
      | MulExpr "*" RepeatExpr  -- mul
      | MulExpr "^" RepeatExpr  -- expand
      | MulExpr "." RepeatExpr  -- dot
      | MulExpr "~" RepeatExpr  -- rotate
      | RepeatExpr

    RepeatExpr
      = PostfixExpr hspaces? ":" hspaces? number  -- repeatPost
      | number hspaces? ":" hspaces? PostfixExpr  -- repeat  
      | PostfixExpr

    PostfixExpr
      = PostfixExpr SliceOp  -- slice
      | PriExpr
  
    PriExpr
      = ident                          -- ref
      | "[" MotBody "]"            -- mot
      | "(" Expr ")"                  -- parens

    SliceOp
      = Index hspaces? "_" hspaces? Index   -- both
      | Index hspaces? "_"                 -- startOnly
      | "_" hspaces? Index                 -- endOnly
      | "_" Index                          -- endOnlyTight

    Index = sign? digit+

    MotBody
      = ListOf<Value, ",">            -- absolute
  
    Value
      = Choice

    Choice
      = Choice "|" SingleValue  -- alt
      | SingleValue              -- single

    SingleValue
      = Range
      | RandomRange
      | Etym

    Range
      = number "->" number      -- inclusive

    Etym
      = number hspaces? "*" hspaces? TimeScale  -- withTimeMul
      | number hspaces? "/" hspaces? TimeScale  -- withTimeDiv
      | number                -- noTimeScale
      | Special hspaces? "*" hspaces? TimeScale -- specialWithTimeMul
      | Special hspaces? "/" hspaces? TimeScale -- specialWithTimeDiv
      | Special               -- special

    RandomRange
      = number hspaces? "?" hspaces? number   -- between

    TimeScale
      = number "/" number   -- frac
      | number               -- plain

    Special
      = specialChar

    specialChar
      = letter
      | "?"
  
    ident = (letter | "_") alnum*
  
    number
      = sign? digit+ ("." digit*)?
      | sign? digit* "." digit+
  
    sign = "+" | "-"
  
    hspace = " " | "\t"
    hspaces = hspace+
  
  }
  `);

const s = g.createSemantics().addOperation('parse', {
  Prog(stmts) {
    return new Prog(stmts.parse());
  },

  AssignStmt(name, _equals, expr) {
    return new Assign(name.sourceString, expr.parse());
  },

  FollowedByExpr_fby(x, _comma, y) {
    return new FollowedBy(x.parse(), y.parse());
  },

  FollowedByExpr_juxt(x, _hspaces, y) {
    return new FollowedBy(x.parse(), y.parse());
  },

  // plus variant removed from grammar; keep here if needed for backward compatibility

  MulExpr_mul(x, _times, y) {
    return new Mul(x.parse(), y.parse());
  },

  MulExpr_expand(x, _hat, y) {
    return new Expand(x.parse(), y.parse());
  },

  MulExpr_dotStar(x, _dotStar, y) {
    return new Dot(x.parse(), y.parse());
  },

  MulExpr_dotExpand(x, _dotHat, y) {
    return new DotExpand(x.parse(), y.parse());
  },

  MulExpr_steps(x, _arrow, y) {
    return new Steps(x.parse(), y.parse());
  },

  MulExpr_dotSteps(x, _dotArrow, y) {
    return new DotSteps(x.parse(), y.parse());
  },

  MulExpr_neighbor(x, _n, y) {
    return new Neighbor(x.parse(), y.parse());
  },

  MulExpr_dotNeighbor(x, _dotn, y) {
    return new DotNeighbor(x.parse(), y.parse());
  },

  MulExpr_anticip(x, _a, y) {
    return new Anticip(x.parse(), y.parse());
  },

  MulExpr_mirror(x, _m, y) {
    return new Mirror(x.parse(), y.parse());
  },

  MulExpr_dotMirror(x, _dotm, y) {
    return new DotMirror(x.parse(), y.parse());
  },

  MulExpr_lens(x, _l, y) {
    return new Lens(x.parse(), y.parse());
  },

  MulExpr_dotLens(x, _dotl, y) {
    return new DotLens(x.parse(), y.parse());
  },

  MulExpr_tie(x, _t, y) {
    return new TieOp(x.parse(), y.parse());
  },

  MulExpr_dotTie(x, _dott, y) {
    return new DotTie(x.parse(), y.parse());
  },

  MulExpr_constraint(x, _c, y) {
    return new ConstraintOp(x.parse(), y.parse());
  },

  MulExpr_dotConstraint(x, _dotc, y) {
    return new DotConstraint(x.parse(), y.parse());
  },

  MulExpr_filter(x, _f, y) {
    return new FilterOp(x.parse(), y.parse());
  },

  MulExpr_dotFilter(x, _dotf, y) {
    return new DotFilter(x.parse(), y.parse());
  },

  MulExpr_dot(x, _dot, y) {
    return new Dot(x.parse(), y.parse());
  },

  MulExpr_rotate(x, _tilde, y) {
    return new RotateOp(x.parse(), y.parse());
  },

  RepeatExpr_repeat(n, _h1, _colon, _h2, expr) {
    return new Repeat(n.parse(), expr.parse());
  },

  RepeatExpr_repeatPost(expr, _h1, _colon, _h2, n) {
    return new Repeat(n.parse(), expr.parse());
  },

  PostfixExpr_slice(x, sl) {
    const base = x.parse();
    const spec = sl.parse();
    return new SegmentTransform(base, 0, spec.start, spec.end);
  },

  PriExpr_ref(name) {
    return new Ref(name.sourceString);
  },

  PriExpr_mot(_openBracket, body, _closeBracket) {
    const parsed = body.parse();
    return new Mot(parsed.values);
  },

  MotBody_absolute(values) {
    return { kind: 'absolute', values: values.parse() };
  },
  Choice_alt(left, _bar, right) {
    return new Choice(left.parse(), right.parse());
  },

  Choice_single(value) {
    return value.parse();
  },

  SingleValue(x) {
    return x.parse();
  },

  Range_inclusive(start, _dots, end) {
    return new Range(start.parse(), end.parse());
  },

  RandomRange_between(a, _h1, _q, _h2, b) {
    return new RandomRange(a.parse(), b.parse());
  },

  PriExpr_parens(_openParen, e, _closeParen) {
    return e.parse();
  },

  SliceOp_both(start, _h1, _us, _h2, end) {
    return { start: start.parse(), end: end.parse() };
  },

  SliceOp_startOnly(start, _h1, _us) {
    return { start: start.parse(), end: null };
  },

  SliceOp_endOnly(_us, _h1, end) {
    return { start: null, end: end.parse() };
  },

  SliceOp_endOnlyTight(_us, end) {
    return { start: null, end: end.parse() };
  },

  Index(_sign, _digits) {
    return parseInt(this.sourceString, 10);
  },

  number(_sign, _wholeDigits, _point, _fracDigits) {
    return parseFloat(this.sourceString);
  },

  Etym_noTimeScale(n) {
    return new Etym(n.parse(), 1);
  },

  Etym_special(sym) {
    return new Etym(0, 1, sym.sourceString);
  },

  Etym_specialWithTimeMul(sym, _h1, _star, _h2, ts) {
    return new Etym(0, ts.parse(), sym.sourceString);
  },

  Etym_specialWithTimeDiv(sym, _h1, _slash, _h2, ts) {
    return new Etym(0, 1 / ts.parse(), sym.sourceString);
  },

  Etym_withTimeMul(n, _h1, _star, _h2, ts) {
    return new Etym(n.parse(), ts.parse());
  },

  Etym_withTimeDiv(n, _h1, _slash, _h2, ts) {
    return new Etym(n.parse(), 1 / ts.parse());
  },

  

  TimeScale_frac(n, _slash, d) {
    return n.parse() / d.parse();
  },

  TimeScale_plain(n) {
    return n.parse();
  },

  NonemptyListOf(x, _sep, xs) {
    return [x.parse()].concat(xs.parse());
  },

  EmptyListOf() {
    return [];
  },

  _iter(...children) {
    return children.map(c => c.parse());
  },

  _terminal() {
    return this.sourceString;
  },
});

class Prog {
  constructor(stmts) {
    this.stmts = stmts;
  }

  interp() {
    const env = new Map();
    let lastValue = new Mot([]);
    for (const stmt of this.stmts) {
      lastValue = stmt.eval(env);
    }
    return lastValue;
  }
}

class Assign {
  constructor(name, expr) {
    this.name = name;
    this.expr = expr;
  }

  eval(env) {
    const value = this.expr.eval(env);
    env.set(this.name, value);
    return value;
  }
}

class FollowedBy {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  eval(env) {
    const xv = requireMot(this.x.eval(env));
    const yv = requireMot(this.y.eval(env));
    return new Mot([...xv.values, ...yv.values]);
  }
}

class Mul {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  eval(env) {
    const xv = requireMot(this.x.eval(env));
    const yv = requireMot(this.y.eval(env));
    const values = [];
    for (let yi of yv.values) {
      const reverse = yi.timeScale < 0;
      const absYi = reverse ? new Etym(yi.step, Math.abs(yi.timeScale), yi.tag) : yi;
      const source = reverse ? [...xv.values].reverse() : xv.values;
      for (let xi of source) {
        if (absYi.hasTag && absYi.hasTag('D')) {
          // Insert a rest with timescale derived from right, then the original left value
          values.push(new Etym(xi.step, xi.timeScale * absYi.timeScale, 'r'));
          values.push(xi);
          continue;
        }
        values.push(xi.mul(absYi));
      }
    }
    return new Mot(values);
  }
}

class Repeat {
  constructor(count, expr) {
    this.count = count;
    this.expr = expr;
  }

  eval(env) {
    const countValue = this.count;
    if (!Number.isFinite(countValue) || countValue < 0) {
      throw new Error('repeat count must be a non-negative finite number');
    }
    const values = [];
    for (let i = 0; i < Math.trunc(countValue); i++) {
      const motif = requireMot(this.expr.eval(env));
      // If inner motif has a seeded RNG, carry it forward between iterations for deterministic sequences
      if (motif._rng && typeof this.expr === 'object' && this.expr instanceof Mot) {
        this.expr._rng = motif._rng;
        this.expr.rng_seed = motif.rng_seed;
      }
      for (let v of motif.values) {
        values.push(v);
      }
    }
    return new Mot(values);
  }
}

class Expand {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  eval(env) {
    const xv = requireMot(this.x.eval(env));
    const yv = requireMot(this.y.eval(env));
    const values = [];
    for (let yi of yv.values) {
      const reverse = yi.timeScale < 0;
      const absYi = reverse ? new Etym(yi.step, Math.abs(yi.timeScale), yi.tag) : yi;
      const source = reverse ? [...xv.values].reverse() : xv.values;
      for (let xi of source) {
        values.push(xi.expand(absYi));
      }
    }
    return new Mot(values);
  }
}

class Dot {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  eval(env) {
    const xv = requireMot(this.x.eval(env));
    const yv = requireMot(this.y.eval(env));
    const values = [];

    for (let xi =0; xi < xv.values.length; xi++) {
      let yi = xi % yv.values.length;
      const left = xv.values[xi];
      const right = yv.values[yi];
      if ((left.tag || right.tag)) {
        // Example branch for 'x': treat as omit-on-right or pass-through
        if (left.hasTag && left.hasTag('x')) {
          values.push(left);
          continue;
        } else if (right.hasTag && right.hasTag('x')) {
          // omit
          continue;
        }
        // Displace 'D': insert a rest with right timescale, then original left
        if (right.hasTag && right.hasTag('D')) {
          values.push(new Etym(left.step, left.timeScale * right.timeScale, 'r'));
          values.push(left);
          continue;
        }
        // funky buit sensible for Dot operation with rests on either side?
        if(left.hasTag('r') || right.hasTag('r')) {
          values.push(new Etym(left.step, left.timeScale * right.timeScale, 'r'));
          continue;
        }
        // Default behavior for unknown tags: pass-through left
        values.push(left);
        continue;
      }
      values.push(left.mul(right));
    }
    return new Mot(values);
  }
}

class DotExpand {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  eval(env) {
    const xv = requireMot(this.x.eval(env));
    const yv = requireMot(this.y.eval(env));
    const values = [];

    for (let xi = 0; xi < xv.values.length; xi++) {
      let yi = xi % yv.values.length;
      const left = xv.values[xi];
      const right = yv.values[yi];
      if ((left.tag || right.tag)) {
        if (left.hasTag && left.hasTag('x')) {
          values.push(left);
          continue;
        } else if (right.hasTag && right.hasTag('x')) {
          continue;
        }
        if (left.hasTag('r') || right.hasTag('r')) {
          values.push(new Etym(left.step, left.timeScale * right.timeScale, 'r'));
          continue;
        }
        values.push(left);
        continue;
      }
      values.push(left.expand(right));
    }
    return new Mot(values);
  }
}

class RotateOp {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  eval(env) {
    const left = requireMot(this.x.eval(env));
    const right = requireMot(this.y.eval(env));
    const out = [];
    for (const r of right.values) {
      const k = Math.trunc(r.step);
      if (left.values.length === 0) {
        continue;
      }
      const n = left.values.length;
      // Rotate left by k (positive k => left, negative k => right)
      let rot = ((-k % n) + n) % n; // convert to equivalent rotate-right amount
      const rotated = left.values.slice(-rot).concat(left.values.slice(0, -rot));
      for (const v of rotated) out.push(v);
    }
    return new Mot(out);
  }
}

class Steps {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  eval(env) {
    const left = requireMot(this.x.eval(env));
    const right = requireMot(this.y.eval(env));
    const out = [];
    // Spread semantics: for each right value r, emit left shifted by t for t in [0..k]
    for (const r of right.values) {
      const k = Math.trunc(r.step);
      const dir = k >= 0 ? 1 : -1;
      const count = Math.abs(k);
      for (let t = 0; t <= count; t++) {
        const delta = dir * t;
        for (const v of left.values) {
          out.push(new Etym(v.step + delta, v.timeScale * r.timeScale, v.tag));
        }
      }
    }
    return new Mot(out);
  }
}

class DotSteps {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  eval(env) {
    const left = requireMot(this.x.eval(env));
    const right = requireMot(this.y.eval(env));
    const out = [];
    // Tile semantics: at each position i, expand left[i] into a run up to k_i
    for (let i = 0; i < left.values.length; i++) {
      const li = left.values[i];
      const ri = right.values[i % right.values.length];
      const k = Math.trunc(ri.step);
      const dir = k >= 0 ? 1 : -1;
      const count = Math.abs(k);
      for (let t = 0; t <= count; t++) {
        const delta = dir * t;
        out.push(new Etym(li.step + delta, li.timeScale * ri.timeScale, li.tag));
      }
    }
    return new Mot(out);
  }
}

class Neighbor {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  eval(env) {
    const left = requireMot(this.x.eval(env));
    const right = requireMot(this.y.eval(env));
    const out = [];
    // Spread semantics: for each right k, expand every pip a into [a, a+k, a]
    for (const r of right.values) {
      const k = Math.trunc(r.step);
      for (const a of left.values) {
        out.push(new Etym(a.step, a.timeScale * r.timeScale, a.tag));
        out.push(new Etym(a.step + k, a.timeScale * r.timeScale, a.tag));
        out.push(new Etym(a.step, a.timeScale * r.timeScale, a.tag));
      }
    }
    return new Mot(out);
  }
}

class DotNeighbor {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  eval(env) {
    const left = requireMot(this.x.eval(env));
    const right = requireMot(this.y.eval(env));
    const out = [];
    // Tile semantics (interstitial): [A] + [A + tile(k)] + [A]
    // First block: original left
    for (const a of left.values) out.push(a);
    // Middle block: left transposed by tiled k
    for (let i = 0; i < left.values.length; i++) {
      const a = left.values[i];
      const r = right.values[i % right.values.length];
      const k = Math.trunc(r.step);
      out.push(new Etym(a.step + k, a.timeScale * r.timeScale, a.tag));
    }
    // Final block: original left
    for (const a of left.values) out.push(a);
    return new Mot(out);
  }
}

class Anticip {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  eval(env) {
    const left = requireMot(this.x.eval(env));
    const right = requireMot(this.y.eval(env));
    const out = [];
    // Anticipatory neighbor: for each right k, prepend a+k then original a
    for (const r of right.values) {
      const k = Math.trunc(r.step);
      for (const a of left.values) {
        out.push(new Etym(a.step + k, a.timeScale * r.timeScale, a.tag));
        out.push(new Etym(a.step, a.timeScale * r.timeScale, a.tag));
      }
    }
    return new Mot(out);
  }
}

class Mirror {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  eval(env) {
    const left = requireMot(this.x.eval(env));
    const right = requireMot(this.y.eval(env));
    const out = [];
    for (const r of right.values) {
      const anchor = r.step;
      for (const a of left.values) {
        
        const combinedTag = a.tag ?? r.tag ?? null;
        const mirrored = 2 * anchor - a.step;
        out.push(new Etym(mirrored, a.timeScale * r.timeScale, combinedTag));
      }
    }
    return new Mot(out);
  }
}

class DotMirror {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  eval(env) {
    const left = requireMot(this.x.eval(env));
    const right = requireMot(this.y.eval(env));
    const out = [];
    for (let i = 0; i < left.values.length; i++) {
      const a = left.values[i];
      const r = right.values[i % right.values.length];
      
      
      const combinedTag = a.tag ?? r.tag ?? null;
      const mirrored = 2 * r.step - a.step;
      out.push(new Etym(mirrored, a.timeScale * r.timeScale, combinedTag));
    }
    return new Mot(out);
  }
}

class Lens {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  eval(env) {
    const left = requireMot(this.x.eval(env));
    const right = requireMot(this.y.eval(env));
    const n = left.values.length;
    const out = [];
    if (n === 0) return new Mot([]);
    for (const r of right.values) {
      const rawK = Math.trunc(r.step);
      let size = Math.abs(rawK);
      if (!Number.isFinite(size) || size <= 0) size = 1;
      if (size > n) size = n;
      if (size === n) {
        for (const a of left.values) out.push(new Etym(a.step, a.timeScale * r.timeScale, a.tag));
        continue;
      }
      if (rawK >= 0) {
        // forward windows
        for (let s = 0; s <= n - size; s++) {
          for (let j = 0; j < size; j++) {
            const a = left.values[s + j];
            out.push(new Etym(a.step, a.timeScale * r.timeScale, a.tag));
          }
        }
      } else {
        // reverse windows: start from the last valid start and move backward
        for (let s = n - size; s >= 0; s--) {
          for (let j = 0; j < size; j++) {
            const a = left.values[s + j];
            out.push(new Etym(a.step, a.timeScale * r.timeScale, a.tag));
          }
        }
      }
    }
    return new Mot(out);
  }
}

class DotLens {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  eval(env) {
    const left = requireMot(this.x.eval(env));
    const right = requireMot(this.y.eval(env));
    const n = left.values.length;
    if (n === 0) return new Mot([]);
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = left.values[i];
      const r = right.values[i % right.values.length];
      let k = Math.trunc(Math.abs(r.step));
      if (!Number.isFinite(k) || k <= 0) k = 1;
      if (k > n) k = n;
      for (let j = 0; j < k; j++) {
        const b = left.values[(i + j) % n];
        out.push(new Etym(b.step, b.timeScale * r.timeScale, b.tag));
      }
    }
    return new Mot(out);
  }
}

class TieOp {
  constructor(x, y) {
    this.x = x;
    this.y = y; // currently unused; placeholder for future thresholds
  }

  eval(env) {
    const left = requireMot(this.x.eval(env));
    const values = left.values;
    if (values.length === 0) return new Mot([]);
    const out = [];
    let acc = values[0];
    for (let i = 1; i < values.length; i++) {
      const cur = values[i];
      if (acc.step === cur.step && acc.tag === cur.tag) {
        // merge durations (sum timeScales)
        acc = new Etym(acc.step, acc.timeScale + cur.timeScale, acc.tag);
      } else {
        out.push(acc);
        acc = cur;
      }
    }
    out.push(acc);
    return new Mot(out);
  }
}

class DotTie {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  eval(env) {
    const left = requireMot(this.x.eval(env));
    const right = requireMot(this.y.eval(env));
    const values = left.values;
    if (values.length === 0) return new Mot([]);
    const out = [];
    let i = 0;
    while (i < values.length) {
      let acc = values[i];
      let j = i;
      // attempt to merge forward while mask allows and steps/tags equal
      while (j + 1 < values.length) {
        const mask = right.values[j % right.values.length];
        const next = values[j + 1];
        if (mask.step !== 0 && acc.step === next.step && acc.tag === next.tag) {
          acc = new Etym(acc.step, acc.timeScale + next.timeScale, acc.tag);
          j++;
        } else {
          break;
        }
      }
      out.push(acc);
      i = j + 1;
    }
    return new Mot(out);
  }
}

class ConstraintOp {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  eval(env) {
    const left = requireMot(this.x.eval(env));
    const right = requireMot(this.y.eval(env));
    const out = [];
    const m = right.values.length;
    if (m === 0) return left;
    for (let i = 0; i < left.values.length; i++) {
      const a = left.values[i];
      const r = right.values[i % m];
      // keep when r.step != 0 and tag not 'x'
      const omit = (r.hasTag && r.hasTag('x')) || r.step === 0;
      if (!omit) {
        out.push(new Etym(a.step, a.timeScale * r.timeScale, a.tag));
      }
    }
    return new Mot(out);
  }
}

class DotConstraint extends ConstraintOp {}

class FilterOp {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  eval(env) {
    const left = requireMot(this.x.eval(env));
    const right = requireMot(this.y.eval(env));
    // Spread semantics: apply the filters in RHS sequentially to the whole mot
    let current = left.values;
    for (const r of right.values) {
      current = current.map(a => applyFilterMask(a, r));
    }
    return new Mot(current);
  }
}

class DotFilter {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  eval(env) {
    const left = requireMot(this.x.eval(env));
    const right = requireMot(this.y.eval(env));
    const out = [];
    for (let i = 0; i < left.values.length; i++) {
      const a = left.values[i];
      if (i < right.values.length) {
        const r = right.values[i];
        out.push(applyFilterMask(a, r));
      } else {
        out.push(a);
      }
    }
    return new Mot(out);
  }
}

function applyFilterMask(etym, mask) {
  
  const tag = mask.tag;
  // T: reset timeScale (or set to mask's timeScale if provided)
  if (tag === 'T') {
    const newTs = mask.timeScale != null ? mask.timeScale : 1;
    return new Etym(etym.step, newTs, etym.tag);
  }
  // S: reset step to 0 (keep timeScale)
  if (tag === 'S') {
    return new Etym(0, etym.timeScale, etym.tag);
  }
  // Default: no change
  return etym;
}


function requireMot(value) {
  if (!(value instanceof Mot)) {
    throw new Error('Mot required!');
  }
  return value;
}

// (delta conversion removed; semicolons have no meaning)

// Deterministic RNG factory (xorshift32 over a hashed seed)
function createSeededRng(seed) {
  let state = hashSeedTo32Bit(seed);
  if (state === 0) state = 0x1; // avoid zero state
  return function rng() {
    // xorshift32
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    // Convert to [0,1)
    return ((state >>> 0) / 0x100000000);
  };
}

function hashSeedTo32Bit(seed) {
  const s = String(seed);
  let h = 2166136261 >>> 0; // FNV-1a 32-bit
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

class Ref {
  constructor(name) {
    this.name = name;
  }

  eval(env) {
    if (!env.has(this.name)) {
      throw new Error('undeclared identifier: ' + this.name);
    }
    return env.get(this.name);
  }
}

class Range {
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }

  // expands to a sequence of integer steps inclusive
  expandToEtyms() {
    const result = [];
    const start = this.start;
    const end = this.end;
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      throw new Error('range endpoints must be finite numbers');
    }
    const step = start <= end ? 1 : -1;
    for (let n = start; step > 0 ? n <= end : n >= end; n += step) {
      result.push(new Etym(n, 1));
    }
    return result;
  }
}

class RandomRange {
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }
}

class Choice {
  constructor(left, right) {
    this.left = left;
    this.right = right;
    // flatten nested choices into a single array of options
    const flatten = (node) => {
      if (node instanceof Choice) return [...flatten(node.left), ...flatten(node.right)];
      return [node];
    };
    this.options = [...flatten(left), ...flatten(right)];
  }

  pick(rng = Math.random) {
    const flatOptions = this.options.map(opt => {
      if (opt instanceof Range) {
        // Expand range to all discrete integer pips, then pick from that expansion
        return opt.expandToEtyms();
      }
      if (opt instanceof Etym) return [opt];
      throw new Error('Unsupported choice option');
    }).flat();

    if (flatOptions.length === 0) {
      throw new Error('empty choice');
    }
    const idx = Math.floor(rng() * flatOptions.length);
    return flatOptions[idx];
  }
}

class Mot {
  constructor(values, rng_seed = null) {
    this.values = values;
    // Deterministic RNG seed (number|string|null). If null, use Math.random.
    this.rng_seed = rng_seed;
    this._rng = null; // lazily initialized RNG function when seed provided
  }

  eval(env) {
    const resolved = [];
    // Determine RNG
    const seed = this.rng_seed;
    if (seed != null && this._rng == null) {
      this._rng = createSeededRng(seed);
    }
    const rng = this._rng || Math.random;

    for (const value of this.values) {
      if (value instanceof Etym) {
        // Resolve bare '?' tag to random in [-7,7]
        if (value instanceof Etym && value.hasTag('?')) {
          const rnd = Math.floor(rng() * (7 - (-7) + 1)) + (-7);
          resolved.push(new Etym(rnd, value.timeScale));
          continue;
        }
        resolved.push(value);
      } else if (value instanceof Range) {
        const etyms = value.expandToEtyms();
        for (const p of etyms) resolved.push(p);
      } else if (value instanceof RandomRange) {
        const lo = Math.min(value.start, value.end);
        const hi = Math.max(value.start, value.end);
        const rnd = Math.floor(rng() * (hi - lo + 1)) + lo;
        resolved.push(new Etym(rnd, 1));
      } else if (value instanceof Choice) {
        resolved.push(value.pick(rng));
      } else {
        throw new Error('Unsupported mot value: ' + String(value));
      }
    }
    // Preserve RNG state if this motif will be evaluated again (e.g., inside repeats)
    const out = new Mot(resolved);
    out.rng_seed = this.rng_seed;
    out._rng = this._rng;
    return out;
  }

  toString() {
    return '[' + this.values.map(value => value.toString()).join(', ') + ']';
  }
}

class Etym {
  constructor(step, timeScale = 1, tag = null) {
    this.step = step;
    this.timeScale = timeScale;
    this.tag = tag; // string label for special tokens (e.g., 'x', 'r')
  }

  mul(that) {
    const combinedTag = this.tag ?? that.tag ?? null;
    return new Etym(this.step + that.step, this.timeScale * that.timeScale, combinedTag);
  }

  expand(that) {
    const combinedTag = this.tag ?? that.tag ?? null;
    return new Etym(this.step * that.step, this.timeScale * that.timeScale, combinedTag);
  }

  toString() {
    const tag_str = this.tag ? `:${this.tag}` : '';
    const ts = Math.abs(this.timeScale);
    if (ts === 1) {
      return `${tag_str}${this.step}`;
    }
    // Prefer division form when ts is (approximately) 1/n
    const inv = 1 / ts;
    const invRounded = Math.round(inv);
    const isInvInt = Math.abs(inv - invRounded) < 1e-10 && invRounded !== 0;
    if (isInvInt) {
      return `${tag_str}${this.step}/${invRounded}`;
    }
    // Fallback to multiply form
    const tsStr = Number.isInteger(ts) ? String(ts) : String(+ts.toFixed(6)).replace(/\.0+$/, '');
    return `${tag_str}${this.step}*${tsStr}`;
  }

  hasTag(tag) {
    return this.tag === tag;
  }
}

 

class SegmentTransform {
  constructor(expr, rotation = 0, start = null, end = null) {
    this.expr = expr;
    this.rotation = rotation || 0;
    this.start = start;
    this.end = end;
  }

  eval(env) {
    const motif = requireMot(this.expr.eval(env));
    const values = motif.values.slice();
    const n = values.length;
    if (n === 0) return new Mot([]);

    // Normalize indices: allow negative indices to count from end
    const normIndex = (idx, defaultValue) => {
      if (idx == null) return defaultValue;
      let k = Math.trunc(idx);
      if (k < 0) k = n + k; // -1 => n-1
      return Math.max(0, Math.min(n, k));
    };

    const s = normIndex(this.start, 0);
    const e = normIndex(this.end, n);

    // Slice: default is [0,n)
    let sliced = values.slice(s, e);

    // Rotate: positive rotates right, negative rotates left
    let r = Math.trunc(this.rotation || 0);
    if (sliced.length === 0 || r === 0) {
      return new Mot(sliced);
    }
    r %= sliced.length;
    if (r < 0) r += sliced.length;
    const rotated = sliced.slice(-r).concat(sliced.slice(0, -r));
    return new Mot(rotated);
  }
}

















function parse(input) {
  const matchResult = g.match(input);
  if (matchResult.failed()) {
    throw new Error(matchResult.message);
  }
  return s(matchResult).parse();
}

function interp(input) {
  const prog = parse(input);
  console.log(prog);

  const value = prog.interp();
  console.log('\n... evaluates to ...\n');
  console.log(value.toString());
}

export { parse, interp };

