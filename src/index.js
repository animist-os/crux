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
    9/.5
    [9]/.5
    [1, 2/.5]/.5 -> [1/.5, 2/.25]
    [1, [2, 3]/.5, 4]/2

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

// interp(`[4, 9/.5, 8, 7]`);

interp(`
  A = [4, 9/.5, 8, 7]/.5
  A * A * [-4]
`);
