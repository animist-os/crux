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

    4[0 | 1 | 2] ~= [2, 0, 1, 1]
    
    N.B. the random operators suggests a need for optional seedability of the rng


  ... for serial choice inclusive

    4[0..3] === [0, 1, 2, 3]


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
    

  * bugs

    I think there's a bug in my implementaiton of "^" because of the way this evaluates -- the second A isnt spread?

    A = [0, 1, 0] ^ [2]
    B = A * A



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
      = MulExpr "*" PriExpr  -- mul
      | MulExpr "^" PriExpr  -- expand
      | PriExpr
  
    PriExpr
      = ident                     -- ref
      | "[" ListOf<Pip, ","> "]"  -- motif
      | "(" Expr ")"              -- parens
  
    Pip
      = number "/" number  -- timeScale
      | number             -- noTimeScale
  
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

  PriExpr_ref(name) {
    return new Ref(name.sourceString);
  },

  PriExpr_motif(_openBracket, values, _closeBracket) {
    return new Motif(values.parse());
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
function requireMotif(value) {
  if (!(value instanceof Motif)) {
    throw new Error('Motif required!');
  }
  return value;
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

class Motif {
  constructor(values) {
    this.values = values;
  }

  eval(env) {
    return this;
  }

  toString() {
    return '[' + this.values.map(value => value.toString()).join(', ') + ']';
  }
}

class Pip {
  constructor(step, timeScale = 1) {
    this.step = step;
    this.timeScale = timeScale;
  }

  mul(that) {
    return new Pip(this.step + that.step, this.timeScale * that.timeScale);
  }

  expand(that) {
    return new Pip(this.step * that.step, this.timeScale * that.timeScale);
  }

  toString() {
    return this.timeScale !== 1
      ? `${this.step}/${this.timeScale}`
      : '' + this.step;
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

interp(`[4, 9/.5, 8, 7]`);

// interp(`
//   A = [4, 9/.5, 8, 7]/.5
//   A * A * [-4]
// `);
