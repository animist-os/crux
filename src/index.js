import * as ohm from 'ohm-js';






const g = ohm.grammar(String.raw`
  Andy {
  
    Prog
      = ListOf<Stmt, nls> nls?
  
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
      | FollowedByExpr MulExpr         -- juxt
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
      = Choice "||" SingleValue  -- alt
      | SingleValue              -- single

    SingleValue
      = Pip
      | Range
      | Curly

    Range
      = RandNum "->" RandNum      -- inclusive

    Pip
      = number hspaces? "|" hspaces? TimeScale              -- withTimeMulPipeImplicit
      | number hspaces? "|" hspaces? "*" hspaces? RandNum  -- withTimeMulPipe
      | number hspaces? "|" hspaces? "/" hspaces? RandNum  -- withTimeDivPipe
      | number hspaces? "*" hspaces? TimeScale              -- withTimeMul
      | number hspaces? "/" hspaces? TimeScale              -- withTimeDiv
      | PlainNumber                                          -- noTimeScale
      | Special hspaces? "|" hspaces? TimeScale             -- specialWithTimeMulPipeImplicit
      | Special hspaces? "|" hspaces? "*" hspaces? RandNum -- specialWithTimeMulPipe
      | Special hspaces? "|" hspaces? "/" hspaces? RandNum -- specialWithTimeDivPipe
      | Special hspaces? "*" hspaces? TimeScale             -- specialWithTimeMul
      | Special hspaces? "/" hspaces? TimeScale             -- specialWithTimeDiv
      | Special                                              -- special
      | Range hspaces? "|" hspaces? TimeScale               -- rangeWithTimeMulPipeImplicit
      | Range hspaces? "|" hspaces? "/" hspaces? RandNum    -- rangeWithTimeDivPipe
      | Curly hspaces? "|" hspaces? TimeScale               -- curlyWithTimeMulPipeImplicit
      | Curly hspaces? "|" hspaces? "*" hspaces? RandNum    -- curlyWithTimeMulPipe
      | Curly hspaces? "|" hspaces? "/" hspaces? RandNum    -- curlyWithTimeDivPipe

    RandNum
      = Curly
      | number
    Curly
      = "{" CurlyBody "}" Seed?
    CurlyBody
      = number hspaces? "?" hspaces? number   -- range
      | ListOf<number, ",">                  -- list

    Seed = "@" hexDigit hexDigit hexDigit hexDigit

    // Legacy random range form maintained temporarily if needed
    // RandomRange
    //   = number hspaces? "?" hspaces? number   -- between

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

    // Prevent bare number from capturing the start of a range
    PlainNumber
      = number ~ (hspaces? "->")
  
    sign = "+" | "-"
  
    hspace = " " | "\t"
    hspaces = hspace+

    // Make newlines significant by not skipping them as whitespace
    // Override Ohm's built-in 'space' rule to only skip spaces/tabs
    space := hspace

    // Newline separator (for statements)
    nl = "\r\n" | "\n" | "\r"
    nls = nl+
  
  }
  `);

const s = g.createSemantics().addOperation('parse', {
  Prog(stmts, _optNls) {
    return new Prog(stmts.parse());
  },

  AssignStmt(name, _equals, expr) {
    return new Assign(name.sourceString, expr.parse());
  },

  FollowedByExpr_fby(x, _comma, y) {
    return new FollowedBy(x.parse(), y.parse());
  },

  FollowedByExpr_juxt(x, y) {
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

  RepeatExpr_repeatPost(expr, _h1, _colon, _h2, n) {
    return new Repeat(n.parse(), expr.parse());
  },

  PostfixExpr_slice(x, sl) {
    const base = x.parse();
    const spec = sl.parse();
    return new SegmentTransform(base, spec.start, spec.end);
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
  Curly(_o, body, _c, seedOpt) {
    const obj = body.parse();
    let seed = null;
    if (seedOpt && seedOpt.children && seedOpt.children.length > 0) {
      seed = seedOpt.children[0].parse();
    }
    obj.seed = seed;
    return obj;
  },

  Seed(_at, a, b, c, d) {
    return (a.sourceString + b.sourceString + c.sourceString + d.sourceString).toLowerCase();
  },

  CurlyBody_range(a, _h1, _q, _h2, b) {
    return new RandomRange(a.parse(), b.parse());
  },

  CurlyBody_list(nums) {
    return new RandomChoice(nums.parse());
  },


  Range_inclusive(start, _dots, end) {
    return new Range(start.parse(), end.parse());
  },

  // RandomRange_between removed (use CurlyBody_range)

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

  Pip_noTimeScale(n) {
    const start = n.source.startIdx;
    return new Pip(n.parse(), 1, null, start);
  },

  Pip_special(sym) {
    return new Pip(0, 1, sym.sourceString);
  },

  Pip_specialWithTimeMulPipe(sym, _h1, _pipe, _h2, _star, _h3, m) {
    return new Pip(0, m.parse(), sym.sourceString);
  },

  Pip_specialWithTimeDivPipe(sym, _h1, _pipe, _h2, _slash, _h3, d) {
    return new Pip(0, 1 / d.parse(), sym.sourceString);
  },

  Pip_withTimeMulPipe(n, _h1, _pipe, _h2, _star, _h3, m) {
    const start = n.source.startIdx;
    return new Pip(n.parse(), m.parse(), null, start);
  },

  Pip_withTimeDivPipe(n, _h1, _pipe, _h2, _slash, _h3, d) {
    const start = n.source.startIdx;
    return new Pip(n.parse(), 1 / d.parse(), null, start);
  },

  Pip_withTimeMulPipeImplicit(n, _h1, _pipe, _h2, ts) {
    const start = n.source.startIdx;
    return new Pip(n.parse(), ts.parse(), null, start);
  },

  // Classic star/slash timescale (still supported)
  Pip_withTimeMul(n, _h1, _star, _h2, ts) {
    const start = n.source.startIdx;
    return new Pip(n.parse(), ts.parse(), null, start);
  },

  Pip_withTimeDiv(n, _h1, _slash, _h2, ts) {
    const start = n.source.startIdx;
    return new Pip(n.parse(), 1 / ts.parse(), null, start);
  },

  Pip_specialWithTimeMul(sym, _h1, _star, _h2, ts) {
    return new Pip(0, ts.parse(), sym.sourceString);
  },

  Pip_specialWithTimeDiv(sym, _h1, _slash, _h2, ts) {
    return new Pip(0, 1 / ts.parse(), sym.sourceString);
  },

  // Range pip with pipe scaling (maps to elementwise over expansion)
  Pip_rangeWithTimeMulPipeImplicit(range, _h1, _pipe, _h2, ts) {
    const r = range.parse();
    const tsVal = ts.parse();
    return new RangePipe(r, { kind: 'mul', factor: tsVal });
  },

  Pip_rangeWithTimeDivPipe(range, _h1, _pipe, _h2, _slash, _h3, d) {
    const r = range.parse();
    const rhs = d.parse(); // number or RandNum
    return new RangePipe(r, { kind: 'div', rhs });
  },

  Pip_specialWithTimeMulPipeImplicit(sym, _h1, _pipe, _h2, ts) {
    return new Pip(0, ts.parse(), sym.sourceString);
  },

  // Curly pip with pipe scaling
  Pip_curlyWithTimeMulPipeImplicit(curly, _h1, _pipe, _h2, ts) {
    const obj = curly.parse();
    return new RandomPip(obj, ts.parse());
  },
  Pip_curlyWithTimeMulPipe(curly, _h1, _pipe, _h2, _star, _h3, m) {
    const obj = curly.parse();
    // Defer random timeScale resolution to eval by storing an op spec
    return new RandomPip(obj, { kind: 'mul', rhs: m.parse() });
  },
  Pip_curlyWithTimeDivPipe(curly, _h1, _pipe, _h2, _slash, _h3, d) {
    const obj = curly.parse();
    // Defer random timeScale resolution to eval by storing an op spec
    return new RandomPip(obj, { kind: 'div', rhs: d.parse() });
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
      const absYi = reverse ? new Pip(yi.step, Math.abs(yi.timeScale), yi.tag) : yi;
      const source = reverse ? [...xv.values].reverse() : xv.values;
      for (let xi of source) {
        if (absYi.hasTag && absYi.hasTag('D')) {
          // Insert a rest with timescale derived from right, then the original left value
          values.push(new Pip(xi.step, xi.timeScale * absYi.timeScale, 'r'));
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
      const absYi = reverse ? new Pip(yi.step, Math.abs(yi.timeScale), yi.tag) : yi;
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

    for (let xi = 0; xi < xv.values.length; xi++) {
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
          values.push(new Pip(left.step, left.timeScale * right.timeScale, 'r'));
          values.push(left);
          continue;
        }
        // funky buit sensible for Dot operation with rests on either side?
        if (left.hasTag('r') || right.hasTag('r')) {
          values.push(new Pip(left.step, left.timeScale * right.timeScale, 'r'));
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
          values.push(new Pip(left.step, left.timeScale * right.timeScale, 'r'));
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
          out.push(new Pip(v.step + delta, v.timeScale * r.timeScale, v.tag));
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
        out.push(new Pip(li.step + delta, li.timeScale * ri.timeScale, li.tag));
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
        out.push(new Pip(a.step, a.timeScale * r.timeScale, a.tag));
        out.push(new Pip(a.step + k, a.timeScale * r.timeScale, a.tag));
        out.push(new Pip(a.step, a.timeScale * r.timeScale, a.tag));
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
      out.push(new Pip(a.step + k, a.timeScale * r.timeScale, a.tag));
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
        out.push(new Pip(a.step + k, a.timeScale * r.timeScale, a.tag));
        out.push(new Pip(a.step, a.timeScale * r.timeScale, a.tag));
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
        out.push(new Pip(mirrored, a.timeScale * r.timeScale, combinedTag));
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
      out.push(new Pip(mirrored, a.timeScale * r.timeScale, combinedTag));
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
        for (const a of left.values) out.push(new Pip(a.step, a.timeScale * r.timeScale, a.tag));
        continue;
      }
      if (rawK >= 0) {
        // forward windows
        for (let s = 0; s <= n - size; s++) {
          for (let j = 0; j < size; j++) {
            const a = left.values[s + j];
            out.push(new Pip(a.step, a.timeScale * r.timeScale, a.tag));
          }
        }
      } else {
        // reverse windows: start from the last valid start and move backward
        for (let s = n - size; s >= 0; s--) {
          for (let j = 0; j < size; j++) {
            const a = left.values[s + j];
            out.push(new Pip(a.step, a.timeScale * r.timeScale, a.tag));
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
        out.push(new Pip(b.step, b.timeScale * r.timeScale, b.tag));
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
        acc = new Pip(acc.step, acc.timeScale + cur.timeScale, acc.tag);
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
          acc = new Pip(acc.step, acc.timeScale + next.timeScale, acc.tag);
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
        out.push(new Pip(a.step, a.timeScale * r.timeScale, a.tag));
      }
    }
    return new Mot(out);
  }
}

class DotConstraint extends ConstraintOp { }

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

function applyFilterMask(pip, mask) {

  const tag = mask.tag;
  // T: reset timeScale (or set to mask's timeScale if provided)
  if (tag === 'T') {
    const newTs = mask.timeScale != null ? mask.timeScale : 1;
    return new Pip(pip.step, newTs, pip.tag);
  }
  // S: reset step to 0 (keep timeScale)
  if (tag === 'S') {
    return new Pip(0, pip.timeScale, pip.tag);
  }
  // Default: no change
  return pip;
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
  expandToPips(rng = Math.random) {
    const result = [];
    const start = resolveRandNumToNumber(this.start, rng);
    const end = resolveRandNumToNumber(this.end, rng);
    const step = start <= end ? 1 : -1;
    for (let n = start; step > 0 ? n <= end : n >= end; n += step) {
      result.push(new Pip(n, 1));
    }
    return result;
  }
}

class RandomRange {
  constructor(start, end) {
    this.start = start;
    this.end = end;
    this.seed = null;
  }
}

class RandomChoice {
  constructor(options) {
    this.options = options; // array of numbers
    this.seed = null;
  }
}

// A pip whose step is chosen from a Curly (RandomRange or RandomChoice)
// and then paired with a fixed timeScale
class RandomPip {
  constructor(randnum, timeScale = 1) {
    this.randnum = randnum; // RandomRange | RandomChoice { seed? }
    // timeScale can be a number or an op spec { kind:'mul'|'div', rhs:number|RandNum }
    this.timeScale = timeScale;
  }

  toString() {
    // Render as the resolved step with its timeScale; since evaluation resolves it,
    // this method is used only if someone prints before eval. Fall back to step=0.
    const ts = Math.abs(this.timeScale);
    if (ts === 1) {
      return String(0);
    }
    const inv = 1 / ts;
    const invRounded = Math.round(inv);
    const isInvInt = Math.abs(inv - invRounded) < 1e-10 && invRounded !== 0;
    if (isInvInt) {
      return `0/${invRounded}`;
    }
    const tsStr = Number.isInteger(ts) ? String(ts) : String(+ts.toFixed(6)).replace(/\.0+$/, '');
    return `0*${tsStr}`;
  }
}

// A deferred range + pipe scaling that expands during evaluation
class RangePipe {
  constructor(range, op) {
    this.range = range;        // Range
    this.op = op;              // { kind:'mul', factor:number } | { kind:'div', rhs:number|RandNum }
  }

  toString() {
    // Non-critical representation
    return '[range|ts]';
  }
}

function resolveRandNumToNumber(value, rng) {
  if (typeof value === 'number') return value;
  if (value instanceof RandomRange) {
    const localRng = value.seed != null ? createSeededRng(value.seed) : rng;
    const lo = Math.min(value.start, value.end);
    const hi = Math.max(value.start, value.end);
    return Math.floor(localRng() * (hi - lo + 1)) + lo;
  }
  if (value instanceof RandomChoice) {
    if (value.options.length === 0) throw new Error('empty random choice');
    const localRng = value.seed != null ? createSeededRng(value.seed) : rng;
    const idx = Math.floor(localRng() * value.options.length);
    return value.options[idx];
  }
  throw new Error('Unsupported RandNum');
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
        return opt.expandToPips(rng);
      }
      if (opt instanceof Pip) return [opt];
      throw new Error('Unsupported choice option');
    }).flat();

    if (flatOptions.length === 0) {
      throw new Error('empty choice');
    }
    const idx = Math.floor(rng() * flatOptions.length);
    return flatOptions[idx];
  }
}

// Seed helpers for IDE-side annotation
function formatSeed4(seed) {
  // Ensure 4 lowercase hex chars
  const s = String(seed).toLowerCase().replace(/[^0-9a-f]/g, '');
  const padded = (s + '0000').slice(0, 4);
  return padded;
}

function generateSeed4() {
  const n = Math.floor(Math.random() * 0x10000);
  return n.toString(16).padStart(4, '0');
}

// Collect seeds from a parsed AST (Prog or any node)
function collectCurlySeedsFromAst(root) {
  const seeds = [];
  const visited = new Set();
  const visit = (node) => {
    if (node == null) return;
    if (typeof node !== 'object') return;
    if (visited.has(node)) return;
    visited.add(node);
    if (node instanceof RandomRange || node instanceof RandomChoice) {
      if (node.seed != null) seeds.push(formatSeed4(node.seed));
    }
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    for (const key of Object.keys(node)) {
      visit(node[key]);
    }
  };
  visit(root);
  return seeds;
}

function collectCurlySeedsFromSource(input) {
  const prog = parse(input);
  return collectCurlySeedsFromAst(prog);
}

// Rewrite input by appending @hhhh (4 hex) after any `{...}` that lacks a seed
function rewriteCurlySeeds(input, seedProvider = generateSeed4) {
  const lines = input.split(/\r?\n/);
  const out = [];
  const pattern = /\{[^{}]*\}(?!@[0-9a-fA-F]{4})/g;
  for (const line of lines) {
    const idx = line.indexOf('//');
    if (idx === -1) {
      out.push(line.replace(pattern, (m) => m + '@' + seedProvider()));
    } else {
      const code = line.slice(0, idx);
      const comment = line.slice(idx);
      out.push(code.replace(pattern, (m) => m + '@' + seedProvider()) + comment);
    }
  }
  return out.join('\n');
}

class Pip {
  constructor(step, timeScale = 1, tag = null, sourceStart = null) {
    this.step = step;
    this.timeScale = timeScale;
    this.tag = tag; // string label for special tokens (e.g., 'x', 'r')
    this.sourceStart = sourceStart; // start character offset in source (when available)
  }

  mul(that) {
    const combinedTag = this.tag ?? that.tag ?? null;
    return new Pip(this.step + that.step, this.timeScale * that.timeScale, combinedTag);
  }

  expand(that) {
    const combinedTag = this.tag ?? that.tag ?? null;
    return new Pip(this.step * that.step, this.timeScale * that.timeScale, combinedTag);
  }

  toString() {
    const tag_str = this.tag ? `${this.tag}` : '';
    let step_str;
    if (this.tag == 'r') {
      step_str = tag_str;
    } else {
      step_str = `${this.step}`;
    }
    const ts = Math.abs(this.timeScale);
    if (ts === 1) {
      return `${step_str}`;
    }
    // Prefer division form when ts is (approximately) 1/n
    const inv = 1 / ts;
    const invRounded = Math.round(inv);
    const isInvInt = Math.abs(inv - invRounded) < 1e-10 && invRounded !== 0;
    if (isInvInt) {
      return `${step_str}/${invRounded}`;
    }
    // Fallback to multiply form
    const tsStr = Number.isInteger(ts) ? String(ts) : String(+ts.toFixed(6)).replace(/\.0+$/, '');
    return `${step_str}*${tsStr}`;
  }

  hasTag(tag) {
    return this.tag === tag;
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
      if (value instanceof Pip) {
        // Resolve bare '?' tag to random in [-7,7]
        if (value instanceof Pip && value.hasTag('?')) {
          const rnd = Math.floor(rng() * (7 - (-7) + 1)) + (-7);
          resolved.push(new Pip(rnd, value.timeScale));
          continue;
        }
        resolved.push(value);
      } else if (value instanceof Range) {
        const pips = value.expandToPips(rng);
        for (const p of pips) resolved.push(p);
      } else if (value instanceof RandomPip) {
        // Resolve the step from the contained randnum using its seed if present
        const step = resolveRandNumToNumber(value.randnum, rng);
        let ts = 1;
        const spec = value.timeScale;
        if (typeof spec === 'number') {
          ts = spec;
        } else if (spec && typeof spec === 'object') {
          const rhsRaw = spec.rhs;
          const rhsVal = typeof rhsRaw === 'number' ? rhsRaw : resolveRandNumToNumber(rhsRaw, rng);
          if (spec.kind === 'mul') ts = rhsVal;
          else if (spec.kind === 'div') ts = 1 / rhsVal;
          else ts = 1;
        }
        resolved.push(new Pip(step, ts));
      } else if (value instanceof RangePipe) {
        // Expand range and apply scaling per element
        const expanded = value.range.expandToPips(rng);
        if (value.op.kind === 'mul') {
          for (const p of expanded) resolved.push(new Pip(p.step, p.timeScale * value.op.factor));
        } else {
          // div by number or RandNum
          const denom = typeof value.op.rhs === 'number' ? value.op.rhs : resolveRandNumToNumber(value.op.rhs, rng);
          for (const p of expanded) resolved.push(new Pip(p.step, p.timeScale * (1 / denom)));
        }
      } else if (value instanceof RandomRange) {
        const num = resolveRandNumToNumber(value, rng);
        resolved.push(new Pip(num, 1));
      } else if (value instanceof RandomChoice) {
        const num = resolveRandNumToNumber(value, rng);
        resolved.push(new Pip(num, 1));
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


class SegmentTransform {
  constructor(expr, start = null, end = null) {
    this.expr = expr;
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
    return new Mot(values.slice(s, e));
  }
}







// ---- Depth analysis (parse-time; no evaluation) ----

const BINARY_TRANSFORMS = new Set([
  Mul, Expand, Dot, DotExpand, Steps, DotSteps, Neighbor, DotNeighbor,
  Anticip, Mirror, DotMirror, Lens, DotLens, TieOp, DotTie,
  ConstraintOp, DotConstraint, FilterOp, DotFilter, RotateOp,
]);

function isBinaryTransformNode(node) {
  for (const C of BINARY_TRANSFORMS) {
    if (node instanceof C) return true;
  }
  return false;
}

function getFinalRootAstAndEnv(prog) {
  const env = new Map();
  let last = null;
  for (const stmt of prog.stmts) {
    last = stmt;
    if (stmt instanceof Assign) {
      env.set(stmt.name, stmt.expr);
    }
  }
  const root = (last instanceof Assign) ? last.expr : last;
  return { root, env };
}

// Collect leaf Mots with their binary-transform depth from the root.
// - followRefs: when true, inline assignment RHS at Ref sites without adding depth.
// - excludeConcat: when true, do not count concatenation (FollowedBy) as a transform.
function collectMotLeavesWithDepth(root, env, { followRefs = true, excludeConcat = true } = {}) {
  const out = [];
  const visitingRef = new Set(); // guard cycles by name@depth

  function visit(node, depth) {
    if (!node) return;

    if (isBinaryTransformNode(node)) {
      visit(node.x, depth + 1);
      visit(node.y, depth + 1);
      return;
    }

    if (excludeConcat && node instanceof FollowedBy) {
      visit(node.x, depth);
      visit(node.y, depth);
      return;
    }

    if (node instanceof SegmentTransform) {
      visit(node.expr, depth);
      return;
    }

    if (node instanceof Repeat) {
      visit(node.expr, depth);
      return;
    }

    if (node instanceof Ref) {
      if (!followRefs) return;
      if (!env.has(node.name)) return;
      const key = `${node.name}@${depth}`;
      if (visitingRef.has(key)) return;
      visitingRef.add(key);
      visit(env.get(node.name), depth);
      visitingRef.delete(key);
      return;
    }

    if (node instanceof Mot) {
      out.push({ mot: node, depth });
      return;
    }

    // Fallback: descend any obvious binary pair
    if (node && typeof node === 'object' && 'x' in node && 'y' in node) {
      visit(node.x, depth);
      visit(node.y, depth);
    }
  }

  visit(root, 0);
  return out;
}

// Height (max distance to any leaf Mot) measured in binary transforms.
// Concatenation, slice, repeat do not contribute height.
function computeExprHeight(root, env, { followRefs = true, excludeConcat = true } = {}) {
  const memo = new Map();
  const visitingRef = new Set();

  function height(node) {
    if (!node) return 0;
    if (memo.has(node)) return memo.get(node);

    if (node instanceof SegmentTransform || node instanceof Repeat) {
      const h = height(node.expr);
      memo.set(node, h);
      return h;
    }

    if (excludeConcat && node instanceof FollowedBy) {
      const h = Math.max(height(node.x), height(node.y));
      memo.set(node, h);
      return h;
    }

    if (isBinaryTransformNode(node)) {
      const h = 1 + Math.max(height(node.x), height(node.y));
      memo.set(node, h);
      return h;
    }

    if (node instanceof Ref) {
      if (!followRefs || !env.has(node.name)) {
        memo.set(node, 0);
        return 0;
      }
      const key = node.name;
      if (visitingRef.has(key)) {
        memo.set(node, 0);
        return 0;
      }
      visitingRef.add(key);
      const h = height(env.get(node.name));
      visitingRef.delete(key);
      memo.set(node, h);
      return h;
    }

    if (node instanceof Mot) {
      memo.set(node, 0);
      return 0;
    }

    // Default: if it looks like a binary pair, compute as such; else leaf
    if (node && typeof node === 'object' && 'x' in node && 'y' in node) {
      const h = Math.max(height(node.x), height(node.y));
      memo.set(node, h);
      return h;
    }

    memo.set(node, 0);
    return 0;
  }

  return height(root);
}






// Return arrays of indices (per Mot, left-to-right) of numeric pips whose Mot is exactly targetDepth from the root.
// Numeric pip = Pip with no tag (excludes special/tagged, random, range, etc.).
function findNumericValueIndicesAtDepth(source, targetDepth, options = {}) {
  const prog = parse(source);
  const { root, env } = getFinalRootAstAndEnv(prog);
  const leaves = collectMotLeavesWithDepth(root, env, options);
  const result = [];

  for (const { mot, depth } of leaves) {
    if (depth !== targetDepth) continue;
    const idxs = [];
    for (let i = 0; i < mot.values.length; i++) {
      const v = mot.values[i];
      if (v instanceof Pip && v.tag == null) {
        if (typeof v.sourceStart === 'number') {
          idxs.push(v.sourceStart);
        }
      }
    }
    result.push(idxs);
  }
  return result.flat();
}

// Convenience: compute Mot depths from the final statement's root.
function computeMotDepthsFromRoot(source, options = {}) {
  const prog = parse(source);
  const { root, env } = getFinalRootAstAndEnv(prog);
  return collectMotLeavesWithDepth(root, env, options);
}

// Convenience: compute expression height from the final statement's root.
function computeHeightFromLeaves(source, options = {}) {
  const prog = parse(source);
  const { root, env } = getFinalRootAstAndEnv(prog);
  return computeExprHeight(root, env, options);
}





// Return arrays of indices (per Mot, left-to-right) of numeric pips whose Mot depth >= minDepth.
function findNumericValueIndicesAtDepthOrAbove(source, minDepth, options = {}) {
  const prog = parse(source);
  const { root, env } = getFinalRootAstAndEnv(prog);
  const leaves = collectMotLeavesWithDepth(root, env, options);
  const result = [];

  for (const { mot, depth } of leaves) {
    // "or above" means shallower or equal depth (closer to root)
    if (depth > minDepth) continue;
    const idxs = [];
    for (let i = 0; i < mot.values.length; i++) {
      const v = mot.values[i];
      if (v instanceof Pip && v.tag == null) {
        if (typeof v.sourceStart === 'number') {
          idxs.push(v.sourceStart);
        }
      }
    }
    result.push(idxs);
  }
  return result.flat();
}












/*

This code will need to be gloablized differently in crux.js

*/








function stripLineComments(input) {
  // Replace '//' comments with spaces to preserve indices; keep newlines
  return input.replace(/\/\/.*$/gm, (m) => ' '.repeat(m.length));
}

function parse(input) {
  const withoutComments = stripLineComments(input);
  const matchResult = g.match(withoutComments);
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

export { parse, interp, rewriteCurlySeeds, collectCurlySeedsFromSource, generateSeed4, formatSeed4, findNumericValueIndicesAtDepth, findNumericValueIndicesAtDepthOrAbove, computeMotDepthsFromRoot, computeHeightFromLeaves };
