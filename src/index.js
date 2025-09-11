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
      = FollowedByExpr "," MulExpr  -- fby
      | FollowedByExpr "+" MulExpr  -- plus
      | MulExpr
  
    MulExpr
      = MulExpr "*" RepeatExpr  -- mul
      | MulExpr "^" RepeatExpr  -- expand
      | MulExpr "." RepeatExpr  -- dot
      | RepeatExpr

    RepeatExpr
      = number PriExpr  -- repeat
      | PriExpr
  
    PriExpr
      = ident                          -- ref
      | "[" MotifBody "]"            -- motif
      | "(" Expr ")"                  -- parens

    MotifBody
      = DeltaList                      -- delta
      | ListOf<Value, ",">            -- absolute

    DeltaList
      = Value ";" ListOf<Value, ";">
  
    Value
      = Choice

    Choice
      = Choice "|" SingleValue  -- alt
      | SingleValue              -- single

    SingleValue
      = Range
      | Pip

    Range
      = number ".." number      -- inclusive

    Pip
      = Special               -- special
      | number ":" TimeScale  -- withTimeScale
      | number                -- noTimeScale

    TimeScale
      = number "/" number   -- frac
      | number               -- plain

    Special
      = specialChar

    specialChar
      = letter
      | "_"
  
    ident = alnum+
  
    number
      = sign? digit+ ("." digit*)?
      | sign? digit* "." digit+
  
    sign = "+" | "-"
  
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

  FollowedByExpr_plus(x, _plus, y) {
    return new FollowedBy(x.parse(), y.parse());
  },

  MulExpr_mul(x, _times, y) {
    return new Mul(x.parse(), y.parse());
  },

  MulExpr_expand(x, _hat, y) {
    return new Expand(x.parse(), y.parse());
  },

  MulExpr_dot(x, _dot, y) {
    return new Dot(x.parse(), y.parse());
  },

  RepeatExpr_repeat(n, expr) {
    return new Repeat(n.parse(), expr.parse());
  },

  PriExpr_ref(name) {
    return new Ref(name.sourceString);
  },

  PriExpr_motif(_openBracket, body, _closeBracket) {
    const parsed = body.parse();
    if (parsed && parsed.kind === 'delta') {
      return new Motif(convertDeltaValuesToAbsolute(parsed.values));
    }
    return new Motif(parsed.values);
  },

  MotifBody_absolute(values) {
    return { kind: 'absolute', values: values.parse() };
  },

  MotifBody_delta(values) {
    return { kind: 'delta', values: values.parse() };
  },

  DeltaList(first, _semi, rest) {
    return [first.parse(), ...rest.parse()];
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

  PriExpr_parens(_openParen, e, _closeParen) {
    return e.parse();
  },

  number(_sign, _wholeDigits, _point, _fracDigits) {
    return parseFloat(this.sourceString);
  },

  Pip_noTimeScale(n) {
    return new Pip(n.parse(), 1);
  },

  Pip_special(sym) {
    return new Pip(0, 1, sym.sourceString);
  },

  Pip_withTimeScale(n, _colon, ts) {
    return new Pip(n.parse(), ts.parse());
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
    let lastValue = new Motif([]);
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
    const xv = requireMotif(this.x.eval(env));
    const yv = requireMotif(this.y.eval(env));
    return new Motif([...xv.values, ...yv.values]);
  }
}

class Mul {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  eval(env) {
    const xv = requireMotif(this.x.eval(env));
    const yv = requireMotif(this.y.eval(env));
    const values = [];
    for (let yi of yv.values) {
      const reverse = yi.timeScale < 0;
      const absYi = reverse ? new Pip(yi.step, Math.abs(yi.timeScale), yi.tag) : yi;
      const source = reverse ? [...xv.values].reverse() : xv.values;
      for (let xi of source) {
        values.push(xi.mul(absYi));
      }
    }
    return new Motif(values);
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
      const motif = requireMotif(this.expr.eval(env));
      // If inner motif has a seeded RNG, carry it forward between iterations for deterministic sequences
      if (motif._rng && typeof this.expr === 'object' && this.expr instanceof Motif) {
        this.expr._rng = motif._rng;
        this.expr.rng_seed = motif.rng_seed;
      }
      for (let v of motif.values) {
        values.push(v);
      }
    }
    return new Motif(values);
  }
}

class Expand {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  eval(env) {
    const xv = requireMotif(this.x.eval(env));
    const yv = requireMotif(this.y.eval(env));
    const values = [];
    for (let yi of yv.values) {
      const reverse = yi.timeScale < 0;
      const absYi = reverse ? new Pip(yi.step, Math.abs(yi.timeScale), yi.tag) : yi;
      const source = reverse ? [...xv.values].reverse() : xv.values;
      for (let xi of source) {
        values.push(xi.expand(absYi));
      }
    }
    return new Motif(values);
  }
}

class Dot {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  eval(env) {
    const xv = requireMotif(this.x.eval(env));
    const yv = requireMotif(this.y.eval(env));
    const values = [];

    for (let xi =0; xi < xv.values.length; xi++) {
      let yi = xi % yv.values.length;
      const left = xv.values[xi];
      const right = yv.values[yi];
      if (left.tag || right.tag) {
        // Example branch for 'x': treat as omit-on-right or pass-through
        if (left.hasTag && left.hasTag('x') || right.hasTag && right.hasTag('x')) {
          values.push(left);
          continue;
        }
        // Default behavior for unknown tags: pass-through left
        values.push(left);
        continue;
      }
      values.push(left.mul(right));
    }
    return new Motif(values);
  }
}


function requireMotif(value) {
  if (!(value instanceof Motif)) {
    throw new Error('Motif required!');
  }
  return value;
}

// Convert a list of delta pips into absolute pips within a motif boundary.
// Example: [0; 1; 1; 1] -> [0, 1, 2, 3]
function convertDeltaValuesToAbsolute(values) {
  let cumulativeStep = 0;
  let inheritedTimeScale = null;
  const out = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!(v instanceof Pip) || v.tag) {
      throw new Error('delta motif supports only simple numeric values');
    }
    cumulativeStep += v.step;
    if (i === 0) {
      inheritedTimeScale = v.timeScale;
      out.push(new Pip(cumulativeStep, inheritedTimeScale, null));
    } else {
      const ts = v.timeScale !== 1 ? v.timeScale : inheritedTimeScale;
      out.push(new Pip(cumulativeStep, ts, null));
    }
  }
  return out;
}

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
  expandToPips() {
    const result = [];
    const start = this.start;
    const end = this.end;
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      throw new Error('range endpoints must be finite numbers');
    }
    const step = start <= end ? 1 : -1;
    for (let n = start; step > 0 ? n <= end : n >= end; n += step) {
      result.push(new Pip(n, 1));
    }
    return result;
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
        return opt.expandToPips();
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

class Motif {
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
        resolved.push(value);
      } else if (value instanceof Range) {
        const pips = value.expandToPips();
        for (const p of pips) resolved.push(p);
      } else if (value instanceof Choice) {
        resolved.push(value.pick(rng));
      } else {
        throw new Error('Unsupported motif value: ' + String(value));
      }
    }
    // Preserve RNG state if this motif will be evaluated again (e.g., inside repeats)
    const out = new Motif(resolved);
    out.rng_seed = this.rng_seed;
    out._rng = this._rng;
    return out;
  }

  toString() {
    return '[' + this.values.map(value => value.toString()).join(', ') + ']';
  }
}

class Pip {
  constructor(step, timeScale = 1, tag = null) {
    this.step = step;
    this.timeScale = timeScale;
    this.tag = tag; // string label for special tokens (e.g., 'x', 'r')
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
    const ts = Math.abs(this.timeScale);
    return ts !== 1
      ? tag_str + `${this.step}:${ts}`
      : tag_str + this.step;
  }

  hasTag(tag) {
    return this.tag === tag;
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

