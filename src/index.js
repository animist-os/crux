import * as ohm from 'ohm-js';

/*

TODOs:

* understand time
  - 1 is 8th note
  - .5 is qtr note
  - .25 is whole
  - (why not the other way around, i.e., 2 is qtr note, 4 is whole note, etc.?)

* should the * operator be written as concatenation?
  - if it's the most used thing, maybe?
  - i.e., instead of "A * B" we would write "A B"

* the > operator
  - should it have lower or higher precedence than the * operator?
  - how will we represent time-shifted motifs?
  - (maybe Motif can have a timeShift field that's 0 by default?)
  - how do time shifts behave wrt the * operator?

* write the function that takes a motif and a "frame of reference" (key and unit of time)
  ... and turns it into actual notes (MIDI?)
  (could be a method in Motif)

* think about unifying pips and motifs

    1 === [1]

    [1, [2, 3], 7] ==> [1, 2/2, 3/2, 7]
    [1, [2, 3, 4], 7] ==> [1, 2/3, 3/3, 4/3, 7]
    [1, [2, 3, 4, 5], 7] ==> [1, 2/4, 3/4, 4/4, 5/4, 7]

    [1, 2, 3] === [[1], [2], [3]]
    [1, [2, 3], 7] === [[1], [2, 3], [7]]
    [1, [2, 3], 7], [8] === [1, [2, 3], 7, 8]
    [1, [2, 3], 7], 8 === [1, [2, 3], 7, 8]
    [[1, [2, 3], 7], 8] ===

    [1, [2, 3], 7], 8 === [1, [2, 3], 7], [8] === [1, [2, 3], 7, 8]
    A, B

    [1, 2, 7], [8] === [1, 2, 7, 8]

    [1, 2, 7]/2, [8] === [1/2, 2/2, 7/2, 8]
    [1, 2, 7]/2, [8]/3 === ???

    A = [1, 2, 3]/3
    B = [4, 5]/7
    [A, B]
    [...A, ...B]

    [0, 1, 2] x [_, 0] ===> [_, _, _, 0, 1, 2]
    [_, 0] x [0, 1, 2] ===> [_, 0, _, 1, _, 2]
    [_, 0, 0] x [0, 1, 2] ===> [_, 0, 0, _, 1, 1, _, 2, 2]

    [0, 1, 2] . [_, 0, 0] ===> [_, 1, 2]
    [0, 1, 2] . [0, _, 0] ===> [0, _, 2]
    [0, 1, 2] . [0, _] ===> [0, _]
    [0, 1, 2, 3] . [0, 0, 0] => [0, 1, 2]
    [0, 1, 2, 3] . [-1, 1, 3] => [-1, 2, 5]

    rotate operator?

    shift left operator?

    shift right operator?



    f([0, 1, 2]) ===> [_, 1, 2, 1, _, 2, 1, 2, _]

    [0, 1, 2] x [X, 0] ===> [0, 1, 2]

    [X, 0] x [0, 1, 2] ===> [X, 0, X, 1, X, 2]

    [X, 0, X, 1, X, 2] * [0, 1, 2] ===> [X, 0, X, 1, X, 2, X, 1, X, 2, X, 3, X, 2, X, 3, X, 4]

    [0, 1, 2] * [X, 0, X, 1, X, 2] ===> [0, 1, 2, 1, 2, 3, 2, 3, 4]


    [3, 4] > 1 === [_/8, 3, 4]
    [...xs[...n], ...xs[(n+5)...]
    [1, 2], ([3, 4] > 1)

  9/.5
    [9]/.5
    [1, 2/.5]/.5 -> [1/.5, 2/.25]
    [1, [2, 3]/.5, 4]/2 ==> [1, 2/.5, 3/.5, 4]/2



  * dot

    [a, b, c] . [d, e] === [a + d, e + b, c + d]

    2nd motif "loops" as needed
    
    could have alt flavor that truncates but we should have different set of slice / rotate / shift / truncate ops?


  * repeat

    4[a] === [a, a, a, a]

    of course:
    
    [a] * [0, 0, 0, 0] === [a, a, a, a] so it's just a sugar?   

    could also be a way to avoid needing parens here: 

    [b, c] * ([a] * [0, 0, 0, 0]) sugars to [b, c] * 4[a]


  * reverse

    [a,b,c] * [R] === [c,b,a]

    [a,b,c] * [0, R] === [a,b,c,c,b,a]

    [a,b,c] * [0, R2] === [a,b,c,c+2, b+2, a+2]

    maybe /-1 is R?   then /-2 is timescaling AND reversing? (so no need for the letter R, just divide by negative numbers)

    [a, b, c] * [0 / -1] === [c, b, a]

    [a, b, c] * [0 / 2] === [a / 2, b / 2, c / 2]

    [a, b, c] * [1 / -1] === [c+1, b+1, a+1]

    [a, b, c] * [1 / -4] === [c+1 / 4, b+1 / 4, a+1 / 4]


  * & for diads

    [a & b, c] 

    [a & b, c] * [0, 1] === [a + b, c, a * 1 + b * 1, c * 1]

    [a & b, c] * [e & f,] ]=== [a * e + a * c + b * e + b * f, e  * c + f * c, e + f]

    [a & b & c, 1] * [0, 1] == [a & b & c, 1, a+1 & b+1 & c+1, 2]


  * x for ommision - noop for mul BUT cool for dot

    4[a, b] * [c, x] results in the same thing as  4[a, b] * [c]

    4[a, b] . [x, d, e] == [xa, db, ea, xb, da, eb, xa, db] == [db, ea, da, eb, db]



  * r for rest - ommision without splicing time

      [a,b,c] * [e, r, g] === [a + e, b + e, c + e, r, r, r, a + g, b + g, c + g]

      [a,b,c] . [e, r, g] === [a + e, r,  g + c]

  * d for displacement (or delay) -  no ommision, inserting time

      [a,b,c] * [e, d, g] === [a + e, b + e, c + e, r, a, r, b, r, c, a + g, b + h, c + g]

      [a,b,c] . [e, d, g] === [a + e, r, b,  g + c]

      [a,b,c] . [e, d / 2, g] === [a + e, r / 2, b,  g + c]



  ? for ranged random inclusive

    4[0, -1?1] ~= [0, 1, 0, -1, 0, -1, 0, 0]


  | for random choice

     [1 | 2, 0] ~= [1, 0]

    4[0 | 1 | 2] ~= [2, 0, 1, 1]
    
    N.B. the random operators suggests a need for optional seedability of the rng


  ... for serial choice inclusive

    [0...3] === [0, 1, 2, 3]
    2[4...6] === [4, 5, 6, 4, 5 6]


  * schenker ops

    step [0, 3] === [0,1,2,3]
    neighbor [0] === [0, 1, 0] or [0, -1, 0] 
    how can we express ...
      a_neighbor[0] => [-1/2, 0/2] — anticipatory lower neighbor, subdividing the time span (very schenker)
      m_neighboor[0] / (1 / 3) => [0, -1, 0] 


  * subdivision

    [a, [b, c]] == [a, b/2, c/2] (Tidal sugar)

    [a, [b, c] / (1/2)] === [a, b, c] (needlessly obtuse illustration of the time scaling + subdivision relationship)

    4[a, b, c] . [0, 0 / 2] === [a, b/2, c, a/2, b, c/2, a, b/2, c, a/2, b, c/2] -- 6/8!


  * grouping / order of operations

    
    [{a, b}, c] * 8[0] === [a, c, b, c, a, c, b, c]

    maybe time-operators are concatenative? 

    OR maybe concatenative operators fire BEFORE the others

    and/or order of operataions is what we use parens to control, default is always L to R regardless of operator type

      A = [0, 1] * [3, 4, 5]
      B = [1, 2] * A

      is same as:

      B = [1, 2] * ([0, 1] * [3, 4, 5])


  * maybe curly bracket for slice rotate etc

    [a, b, c, d, e] {-3,-1} === [c, d, e]
    [a, b, c, d, e] {1,} === [b, c, d, e]
    [a, b, c, d, e] 1{} === [e, a, b, c, d]
    [a, b, c, d, e] -1{2} === [d, e, c] chop off first 2 then rotate left 1

    think about a way for this to "lens" through live mutations, instead of simply repeating
    A = [a, b, c, d] -1{1,} ===  [c, d, b]
    4A === [c, d, b, c, d, b, c, d, b, c, d, b]  

    BUT

    how could we let the rotation keep happening on each iteration of the outer 4 operator to get the more musically interesting

        4$A === [c, d, b,  d, b, c,  b, c, d,  c, d, b]

      instead of

        4A === [c, d, b,  c, d, b,  c, d, b,  c, d, b]  


    some ops could recompute each iteration, how to determine which ones you want?
    maybe left assigning to a variable "freezes" it, otherwise it always recomputes, but the the reductive bracket operators might need to be an exception

    4$A === [c, d, b, d, b, c, b, c, d, c, d, b]
    



  * questions

    I've implemented "x" and "r" as tags, maybe better to just let those be non-numeric values for step
    and watch for them in the evals

    "r" doesn't seem to work as expected when its in the second expression


*/









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
      | "[" ListOf<Value, ","> "]"  -- motif
      | "(" Expr ")"                  -- parens
  
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
      = Special            -- special
      | number "/" number  -- timeScale
      | number             -- noTimeScale

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

  PriExpr_motif(_openBracket, values, _closeBracket) {
    return new Motif(values.parse());
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

  Pip_timeScale(n, _slash, d) {
    return new Pip(n.parse(), d.parse());
  },

  Pip_noTimeScale(n) {
    return new Pip(n.parse(), 1);
  },

  Pip_special(sym) {
    return new Pip(0, 1, sym.sourceString);
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
      for (let xi of xv.values) {
        values.push(xi.mul(yi));
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
      for (let xi of xv.values) {
        values.push(xi.expand(yi));
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
    const tag_str = this.tag ? `:${this.tag}` : '';
    return this.timeScale !== 1
      ? tag_str + `${this.step}/${this.timeScale}`  
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

// interp(`[0, 1, 2, 3, 4, 5, 6, 7]`);

// interp(`[-1, 0] * [0, -1]`);

// interp(`[-1, 0] * [0, -1] * [0, 3, 4, 0] * [3]`);

// interp(`
//   A = [0, 1, 0]
//   B = A * [0, 3, 4, 0]
//   A, B
// `);

// interp(`
//   A = [0, 1, 0]
//   B = A * A
//   B
// `);

// interp(`[4, 9/.5, 8, 7]`);

// interp(`
//   A = [4, 9/.5, 8, 7]/.5
//   A * A * [-4]
// `);

// interp(`[0, 1, 0] ^ [1, 2]`);

interp(`
  A = [0, 1, 0] ^ [2]
  B = A * A
`);

// [0, 2, 0] * [0, 2, 0] ===> [0, 2, 0, 2, 4, 2, 0, 2, 0]
