// Crux - Musical Motif DSL
// Bundled Distribution
// Generated: 2025-10-09T00:56:17.771Z
//
// NOTE: This bundle requires ohm-js as a peer dependency

// Load ohm-js (CommonJS)
var ohm = (typeof require !== 'undefined') ? require('ohm-js') : (globalThis.ohm || (typeof window !== 'undefined' && window.ohm));
if (!ohm) {
  throw new Error('ohm-js is required. Install with: npm install ohm-js');
}

// === Grammar ===
export const g = ohm.grammar(String.raw`
  Crux {

    Prog
      = nls? ListOf<Section, SectionSep> nls?

    Section
      = ListOf<Stmt, nls+>

    SectionSep
      = nls? "!" nls?

    Stmt
      = AssignStmt
      | OpAliasStmt
      | ExprStmt

    AssignStmt
      = ident "=" Expr

    // Simple operator aliasing sugar, e.g.,
    //   splay = *
    // which allows: [0,1] splay [1,2] == [0,1] * [1,2]
    OpAliasStmt
      = ident "=" OpSym

    ExprStmt
      = Expr

  Expr
      = FollowedByExpr

  FollowedByExpr
      = FollowedByExpr "," PostfixExpr   -- fby
      | PostfixExpr

  // Postfix operators (tie, repeat, slice) at lower precedence than binary operators
  // These apply to "everything to the left" by default
  PostfixExpr
      = PostfixExpr "/"                          -- subdivide
      | PostfixExpr "z"                          -- zipColumns
      | PostfixExpr "t"                          -- tiePostfix
      | PostfixExpr hspaces? ":" hspaces? RandNum  -- repeatPostRand
      | PostfixExpr hspaces? ":" hspaces? number   -- repeatPost
      | PostfixExpr hspaces? SliceOp                 -- slice
      | MulExpr

  MulExpr
      = MulExpr ".*" AppendExpr -- dotStar
      | MulExpr ".^" AppendExpr -- dotExpand
      | MulExpr ".->" AppendExpr -- dotSteps
      | MulExpr ".j" AppendExpr -- dotJam
      | MulExpr ".m" AppendExpr  -- dotMirror
      | MulExpr ".l" AppendExpr  -- dotLens
      | MulExpr ".t" AppendExpr  -- dotTie
      | MulExpr ".c" AppendExpr  -- dotConstraint
      | MulExpr ".," AppendExpr  -- dotZip
      | MulExpr ".g" AppendExpr  -- dotGlass
      | MulExpr ".r" AppendExpr  -- dotReich
      | MulExpr "->" AppendExpr  -- steps

      | MulExpr "j" AppendExpr   -- jam
      | MulExpr "m" AppendExpr   -- mirror
      | MulExpr "l" AppendExpr   -- lens
      | MulExpr "c" AppendExpr   -- constraint
      | MulExpr "g" AppendExpr   -- glass
      | MulExpr "r" AppendExpr   -- reich
      | MulExpr "p" AppendExpr   -- paert
      | MulExpr "*" AppendExpr  -- mul
      | MulExpr "^" AppendExpr  -- expand
      | MulExpr "." AppendExpr  -- dot
      | MulExpr "~" AppendExpr  -- rotate
      | MulExpr ".~" AppendExpr  -- dotRotate
      | MulExpr ident AppendExpr -- aliasOp
      | AppendExpr

  AppendExpr
      = PriExpr

  PriExpr
      = ident                          -- ref
      | "[[" NestedBody "]]"       -- nestedMot
      | "[" MotBody "]"            -- mot
      | number                        -- numAsMot
      | "(" Expr ")"                  -- parens
      | Curly                           -- curlyAsExpr

  NestedBody
      = ListOf<NestedElem, ",">       -- nestedAbsolute

  NestedElem
      = MotLiteral "/"                 -- motSubdivide
      | NestedMotLiteral "/"           -- nestedSubdivide
      | SingleValue                    -- single
      | MotLiteral                     -- mot
      | NestedMotLiteral               -- nested

  MotLiteral = "[" MotBody "]"
  NestedMotLiteral = "[[" NestedBody "]]"

  // Abbreviated nested mot that closes with a single ']' so it can be followed by more values inside the same mot
  NestedMotAbbrev = "[[" MotBody "]"

  SliceOp
      = SliceIndex hspaces? "_" hspaces? SliceIndex   -- both
      | SliceIndex hspaces? "_"                       -- startOnly
      | "_" hspaces? SliceIndex                       -- endOnly
      | "_" SliceIndex                                -- endOnlyTight

    // Slice indices can be plain numbers or random numbers (curly)
    SliceIndex
      = RandNum  -- rand
      | Index    -- num

    Index = sign? digit+

  MotBody
      = ListOf<Entry, ",">            -- absolute

    Entry
      = Value ellipsis                  -- withPad
      | Value                           -- plain

    Value
      = SingleValue

    SingleValue
      = MotLiteral hspaces? "*" hspaces? MotLiteral   -- inlineMulMots
      | MotLiteral "/"                                -- motSubdivide
      | NestedMotLiteral "/"                          -- nestedSubdivide
      | NestedMotLiteral
      | NestedMotAbbrev
      | MotLiteral
      | Pip
      | Range
      | Curly
      | CurlyPip
      | ident hspaces? "*" hspaces? MotLiteral      -- inlineMulRefMot
      | "(" Expr ")"                                -- exprInMot
      | ident                                   -- refInMot

    Range
      = RandNum "->" RandNum      -- inclusive

  Pip
      = number hspaces? "|" hspaces? TimeScale              -- withTimeMulPipeImplicit
      | number hspaces? "|" hspaces? "*" hspaces? RandNum  -- withTimeMulPipe
      | number hspaces? "|" hspaces? "/" hspaces? RandNum  -- withTimeDivPipe
      | number hspaces? "|"                                  -- withPipeNoTs
      | "|" hspaces? TimeScale                               -- pipeOnlyTs
      | "|" hspaces? "*" hspaces? RandNum                    -- pipeOnlyMul
      | "|" hspaces? "/" hspaces? RandNum                    -- pipeOnlyDiv
      | "|"                                                 -- pipeBare
      | PlainNumber                                          -- noTimeScale
      | Special hspaces? "|" hspaces? TimeScale             -- specialWithTimeMulPipeImplicit
      | Special hspaces? "|" hspaces? "*" hspaces? RandNum -- specialWithTimeMulPipe
      | Special hspaces? "|" hspaces? "/" hspaces? RandNum -- specialWithTimeDivPipe
      | Special                                              -- special
      | Range hspaces? "|" hspaces? TimeScale               -- rangeWithTimeMulPipeImplicit
      | Range hspaces? "|" hspaces? "/" hspaces? RandNum    -- rangeWithTimeDivPipe
      | Curly hspaces? "|" hspaces? TimeScale               -- curlyWithTimeMulPipeImplicit
      | Curly hspaces? "|" hspaces? "*" hspaces? RandNum    -- curlyWithTimeMulPipe
      | Curly hspaces? "|" hspaces? "/" hspaces? RandNum    -- curlyWithTimeDivPipe
      | CurlyPip hspaces? "|" hspaces? TimeScale            -- curlyPipWithTimeMulPipeImplicit
      | CurlyPip hspaces? "|" hspaces? "*" hspaces? RandNum -- curlyPipWithTimeMulPipe
      | CurlyPip hspaces? "|" hspaces? "/" hspaces? RandNum -- curlyPipWithTimeDivPipe

    RandNum
      = Curly
      | number

  // Curly-of-pips: choose one full pip-like value (number/special/pipe forms/etc.)
  CurlyPip
      = "{" ListOf<Pip, ","> "}" Seed?
    Curly
      = "{" CurlyBody "}" Seed?
    CurlyBody
      = number hspaces? "?" hspaces? number   -- range
      | ListOf<CurlyEntry, ",">              -- list
    CurlyEntry
      = number  -- num
      | ident   -- ref

    Seed = "@" SeedChars
    SeedChars = seedChar+
    seedChar = letter | digit | "_"

    TimeScale
      = RandNum "/" RandNum  -- frac
      | RandNum               -- plain

    Special
      = specialChar

    specialChar
      = "r"
      | "?"

    ident = (letter | "_") alnum+  -- withChars
          | letter                     -- single

    // Set of binary operator symbols that can be aliased
    OpSym
      = ".*" | ".^" | ".->" | ".j" | ".m" | ".l" | ".t" | ".c" | ".," | ".g" | ".r"
      | "->" | "j" | "m" | "l" | "c" | "g" | "r" | "p" | "*" | "^" | "." | "~"

    number
      = sign? digit+ ("." digit+)?
      | sign? digit* "." digit+

    // Prevent bare number from capturing the start of a range
    PlainNumber
      = number ~ (hspaces? "->")

    sign = "+" | "-"

    hspace = " " | "\t"
    hspaces = hspace+
    
    // Ellipsis marker for pad semantics inside Mot
    ellipsis = "..."

    // Line comments
    comment = "//" (~nl any)*

    // Make newlines significant by not skipping them as whitespace
    // Override Ohm's built-in 'space' rule to skip spaces/tabs/comments but not newlines
    space := hspace | comment

    // Newline separator (for statements)
    nl = "\r\n" | "\n" | "\r"
    nls = nl+

  }
  `);


// === Main Implementation ===
// this just makes the code portable to golden
const golden = {};
globalThis.golden = golden;







golden._crux_uuid_cnt = 1;
golden.getCruxUUID = function() {
  return '' + golden._crux_uuid_cnt++;
}


// Grammar is now imported from grammar.js

const s = g.createSemantics().addOperation('parse', {
  Prog(_leadingNls, sections, _trailingNls) {
    return new Prog(sections.parse());
  },

  Section(stmts) {
    return stmts.parse();
  },

  AssignStmt(name, _equals, expr) {
    return new Assign(name.sourceString, expr.parse());
  },

  OpAliasStmt(name, _equals, op) {
    return new OpAliasAssign(name.sourceString, op.parse());
  },

  FollowedByExpr_fby(x, _comma, y) {
    return new FollowedBy(x.parse(), y.parse());
  },

  PostfixExpr_subdivide(expr, _slash) {
    const x = expr.parse();
    return new Subdivide(x);
  },

  PostfixExpr_tiePostfix(expr, _t) {
    const x = expr.parse();
    return new TieOp(x);
  },

  PostfixExpr_zipColumns(expr, _z) {
    const x = expr.parse();
    return new ZipColumns(x);
  },

  PostfixExpr_repeatPost(expr, _h1, _colon, _h2, n) {
    const parsedExpr = expr.parse();
    const count = n.parse();

    // Multiply by a zero-mot of length N
    const zeroMot = new Mot(Array(count).fill(new Pip(0, 1)));
    return new Mul(parsedExpr, zeroMot);
  },

  PostfixExpr_repeatPostRand(expr, _h1, _colon, _h2, rn) {
    const parsedExpr = expr.parse();
    const randSpec = rn.parse(); // number or RandomRange/RandomChoice
    // If the randSpec parsed to a plain number, behave like numeric repeat
    if (typeof randSpec === 'number') {
      const zeroMot = new Mot(Array(randSpec).fill(new Pip(0, 1)));
      return new Mul(parsedExpr, zeroMot);
    }
    return new RepeatByCount(parsedExpr, randSpec);
  },

  PostfixExpr_slice(x, _hspaces, sl) {
    const base = x.parse();
    const spec = sl.parse();
    return new SegmentTransform(base, spec.start, spec.end);
  },

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

  MulExpr_jam(x, _j, y) {
    return new JamOp(x.parse(), y.parse());
  },

  MulExpr_dotJam(x, _dj, y) {
    return new DotJam(x.parse(), y.parse());
  },

  MulExpr_steps(x, _arrow, y) {
    return new Steps(x.parse(), y.parse());
  },

  MulExpr_dotSteps(x, _dotArrow, y) {
    return new DotSteps(x.parse(), y.parse());
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
  MulExpr_dotTie(x, _dott, y) {
    return new DotTie(x.parse(), y.parse());
  },

  

  MulExpr_constraint(x, _c, y) {
    return new ConstraintOp(x.parse(), y.parse());
  },

  MulExpr_dotConstraint(x, _dotc, y) {
    return new DotConstraint(x.parse(), y.parse());
  },

  MulExpr_dotZip(x, _dotcomma, y) {
    return new DotZip(x.parse(), y.parse());
  },

  MulExpr_glass(x, _g, y) {
    return new GlassOp(x.parse(), y.parse());
  },

  MulExpr_dotGlass(x, _dotg, y) {
    return new DotGlass(x.parse(), y.parse());
  },

  MulExpr_reich(x, _r, y) {
    return new ReichOp(x.parse(), y.parse());
  },

  MulExpr_dotReich(x, _dotr, y) {
    return new DotReich(x.parse(), y.parse());
  },

  MulExpr_paert(x, _p, y) {
    return new PaertOp(x.parse(), y.parse());
  },

  MulExpr_dot(x, _dot, y) {
    return new Dot(x.parse(), y.parse());
  },

  MulExpr_rotate(x, _tilde, y) {
    return new RotateOp(x.parse(), y.parse());
  },
  MulExpr_dotRotate(x, _dottilde, y) {
    return new DotRotate(x.parse(), y.parse());
  },

  MulExpr_aliasOp(x, name, y) {
    return new AliasCall(name.sourceString, x.parse(), y.parse());
  },

  PriExpr_ref(name) {
    return new Ref(name.sourceString);
  },
  PriExpr_numAsMot(n) {
    return new Mot([new Pip(n.parse(), 1, null, n.source.startIdx)]);
  },

  PriExpr_mot(_openBracket, body, _closeBracket) {
    const parsed = body.parse();
    // Treat any Mot literal appearing inside a Mot as a nested subdivision,
    // recursively converting deeper Mot literals to NestedMot so that
    // hierarchical nesting like [0, [1, [2,3]]] yields [0, 1/2, 2/4, 3/4].
    const wrapNestedDeep = (val) => {
      if (val instanceof Mot) {
        const inner = Array.isArray(val.values) ? val.values.map(wrapNestedDeep) : [];
        return new NestedMot(inner);
      }
      if (val instanceof NestedMot) {
        const inner = Array.isArray(val.values) ? val.values.map(wrapNestedDeep) : [];
        return new NestedMot(inner);
      }
      return val;
    };
    const values = parsed.values.map(wrapNestedDeep);
    return new Mot(values);
  },

  PriExpr_nestedMot(_openBrackets, body, _closeBrackets) {
    const parsed = body.parse();
    return new NestedMot(parsed.values);
  },

  NestedBody_nestedAbsolute(values) {
    return { kind: 'nestedAbsolute', values: values.parse() };
  },

  NestedElem_motSubdivide(node, _slash) {
    // node is a MotLiteral followed by /
    const body = node.children[1];
    const parsed = body.parse();
    const mot = new Mot(parsed.values);
    return subdivide(mot);
  },

  NestedElem_nestedSubdivide(node, _slash) {
    // node is a NestedMotLiteral followed by /
    const body = node.children[1];
    const parsed = body.parse();
    return subdivide(parsed);
  },

  NestedElem_single(x) {
    return x.parse();
  },

  NestedElem_mot(node) {
    // node is a MotLiteral; reuse Mot parse by delegating through the MotBody
    const body = node.children[1];
    const parsed = body.parse();
    return new Mot(parsed.values);
  },

  NestedElem_nested(node) {
    // node is a NestedMotLiteral
    const body = node.children[1];
    const parsed = body.parse();
    return new NestedMot(parsed.values);
  },

  MotLiteral(_ob, body, _cb) {
    const parsed = body.parse();
    return new Mot(parsed.values);
  },

  NestedMotLiteral(_obb, body, _cbb) {
    const parsed = body.parse();
    return new NestedMot(parsed.values);
  },

  NestedMotAbbrev(_obb, body, _cb) {
    const parsed = body.parse();
    return new NestedMot(parsed.values);
  },

  

  MotBody_absolute(values) {
    return { kind: 'absolute', values: values.parse() };
  },
  
  

  Entry_withPad(value, _dots) {
    return new PadValue(value.parse());
  },

  Entry_plain(value) {
    return value.parse();
  },


  SingleValue(x) {
    return x.parse();
  },
  SingleValue_motSubdivide(node, _slash) {
    // node is a MotLiteral followed by /
    const body = node.children[1];
    const parsed = body.parse();
    const mot = new Mot(parsed.values);
    return subdivide(mot);
  },
  SingleValue_nestedSubdivide(node, _slash) {
    // node is a NestedMotLiteral followed by /
    const body = node.children[1];
    const parsed = body.parse();
    return subdivide(parsed);
  },
  SingleValue_inlineMulMots(aNode, _h1, _star, _h2, bNode) {
    // Inline [X] * [Y] inside a Mot as just Y's Mot, to support cases like [0, [1] * [2], 4].
    // We return the RHS Mot so it behaves as if written directly.
    const _a = aNode.parse(); // Mot (unused for now)
    const b = bNode.parse();  // Mot
    return b;
  },
  SingleValue_inlineMulRefMot(name, _h1, _star, _h2, motNode) {
    // Convert `ident * [mot]` inside a Mot into a NestedMotExpr of the Mul
    const ref = new Ref(name.sourceString);
    const rhs = motNode.parse(); // Mot
    return new NestedMotExpr(new Mul(ref, rhs));
  },
  SingleValue_refInMot(name) {
    // Treat bare identifier inside a Mot as a nested subdivision of the referenced motif
    return new NestedMotExpr(new Ref(name.sourceString));
  },
  SingleValue_exprInMot(_op, expr, _cp) {
    // Parenthesized expression inside Mot; subdivide its evaluated Mot
    return new NestedMotExpr(expr.parse());
  },
  CurlyPip(_o, list, _c, seedOpt) {
    const options = list.parse();
    // options are outputs of Pip_* semantics: Pip | RangePipe | RandomPip
    const obj = new RandomPipChoiceFromPips(options);
    if (seedOpt && seedOpt.children && seedOpt.children.length > 0) {
      obj.seed = seedOpt.children[0].parse();
    }
    return obj;
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

  // Timescale collection skips at parse layer; this is for AST building only

  Seed(_at, chars) {
    return stringToSeed(chars.sourceString);
  },

  CurlyBody_range(a, _h1, _q, _h2, b) {
    // Capture positions of endpoints inside {a ? b}
    const startPos = a.source.startIdx;
    const endPos = b.source.startIdx;
    return new RandomRange(a.parse(), b.parse(), startPos, endPos);
  },

  CurlyBody_list(entries) {
    const items = entries.parse();
    const allNumLits = items.every(x => x && typeof x === 'object' && x.__kind === 'numLit');
    const allRefs = items.every(x => x instanceof Ref);
    if (allNumLits) {
      const positions = items.map(x => x.pos);
      const options = items.map(x => x.value);
      return new RandomChoice(options, positions);
    }
    if (allRefs) return new RandomRefChoice(items);
    // Backward-compat: plain numbers (without position data)
    const allNums = items.every(x => typeof x === 'number');
    if (allNums) return new RandomChoice(items);
    throw new Error('Curly list must be all numbers or all identifiers');
  },

  CurlyEntry_num(n) {
    return { __kind: 'numLit', value: n.parse(), pos: n.source.startIdx };
  },

  CurlyEntry_ref(name) {
    return new Ref(name.sourceString);
  },


  Range_inclusive(start, _dots, end) {
    // Record source positions for the range endpoints so tools can locate them in source
    const a = start.parse();
    const b = end.parse();
    const aPos = start.source.startIdx;
    const bPos = end.source.startIdx;
    return new Range(a, b, aPos, bPos);
  },

  PriExpr_parens(_openParen, e, _closeParen) {
    return e.parse();
  },

  PriExpr_curlyAsExpr(c) {
    // Treat bare Curly as a single-pip Mot chosen randomly at evaluation
    const rn = c.parse();
    return new Mot([new RandomPip(rn, 1)]);
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

  SliceIndex_rand(rn) { return rn.parse(); },
  SliceIndex_num(idx) { return idx.parse(); },

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
    return new Pip(0, 1, sym.sourceString, sym.source.startIdx);
  },

  Pip_specialWithTimeMulPipe(sym, _h1, _pipe, _h2, _star, _h3, m) {
    return new Pip(0, m.parse(), sym.sourceString, sym.source.startIdx);
  },

  Pip_specialWithTimeDivPipe(sym, _h1, _pipe, _h2, _slash, _h3, d) {
    return new Pip(0, 1 / d.parse(), sym.sourceString, sym.source.startIdx);
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

  Pip_withPipeNoTs(n, _h1, _pipe) {
    const start = n.source.startIdx;
    const p = new Pip(n.parse(), 1, null, start);
    p._pipeOnly = true;
    p._jamPass = 'ts'; // override step with RHS, preserve LHS timeScale
    return p;
  },

  Pip_pipeOnlyTs(_pipe, _h1, ts) {
    const p = new Pip(0, ts.parse(), null, _pipe.source.startIdx);
    p._pipeOnly = true;
    p._jamPass = 'step'; // preserve LHS step, override timeScale with RHS
    return p;
  },

  Pip_pipeOnlyMul(_pipe, _h1, _star, _h2, m) {
    // treat as override to provided factor; allow RandNum
    const p = new Pip(0, m.parse(), null, _pipe.source.startIdx);
    p._pipeOnly = true;
    p._jamPass = 'step';
    return p;
  },

  Pip_pipeOnlyDiv(_pipe, _h1, _slash, _h2, d) {
    const p = new Pip(0, 1 / d.parse(), null, _pipe.source.startIdx);
    p._pipeOnly = true;
    p._jamPass = 'step';
    return p;
  },

  Pip_pipeBare(_pipe) {
    const p = new Pip(0, 1, null, _pipe.source.startIdx);
    p._pipeOnly = true;
    p._jamPass = 'step'; // preserve LHS step, override timeScale with RHS (defaults to 1)
    return p;
  },

  // Range pip with pipe scaling (maps to cog-wise over expansion)
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
    return new Pip(0, ts.parse(), sym.sourceString, sym.source.startIdx);
  },

  // Curly pip with pipe scaling
  Pip_curlyWithTimeMulPipeImplicit(curly, _h1, _pipe, _h2, ts) {
    const obj = curly.parse();
    if (!(obj instanceof RandomRange || obj instanceof RandomChoice)) {
      throw new Error('Curly with identifiers cannot be used with timeScale pipe');
    }
    return new RandomPip(obj, ts.parse());
  },
  Pip_curlyWithTimeMulPipe(curly, _h1, _pipe, _h2, _star, _h3, m) {
    const obj = curly.parse();
    // Defer random timeScale resolution to eval by storing an op spec
    if (!(obj instanceof RandomRange || obj instanceof RandomChoice)) {
      throw new Error('Curly with identifiers cannot be used with timeScale pipe');
    }
    return new RandomPip(obj, { kind: 'mul', rhs: m.parse() });
  },
  Pip_curlyWithTimeDivPipe(curly, _h1, _pipe, _h2, _slash, _h3, d) {
    const obj = curly.parse();
    // Defer random timeScale resolution to eval by storing an op spec
    if (!(obj instanceof RandomRange || obj instanceof RandomChoice)) {
      throw new Error('Curly with identifiers cannot be used with timeScale pipe');
    }
    return new RandomPip(obj, { kind: 'div', rhs: d.parse() });
  },

  // Curly-of-pips with outer timescale forms
  Pip_curlyPipWithTimeMulPipeImplicit(curlyPip, _h1, _pipe, _h2, ts) {
    const obj = curlyPip.parse(); // RandomPipChoiceFromPips
    obj.extraTs = ts.parse();
    return obj;
  },
  Pip_curlyPipWithTimeMulPipe(curlyPip, _h1, _pipe, _h2, _star, _h3, m) {
    const obj = curlyPip.parse();
    obj.extraTs = { kind: 'mul', rhs: m.parse() };
    return obj;
  },
  Pip_curlyPipWithTimeDivPipe(curlyPip, _h1, _pipe, _h2, _slash, _h3, d) {
    const obj = curlyPip.parse();
    obj.extraTs = { kind: 'div', rhs: d.parse() };
    return obj;
  },


  TimeScale_frac(n, _slash, d) {
    const num = n.parse();
    const den = d.parse();
    // If either is a RandNum, return a special object for later resolution
    if (num instanceof RandomRange || num instanceof RandomChoice ||
        den instanceof RandomRange || den instanceof RandomChoice) {
      return { _frac: true, num: num, den: den };
    }
    return num / den;
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
  OpSym(_tok) {
    return this.sourceString;
  },

});

// Collect text rewrite edits for ": N" repeat sugar using CST spans (no re-parsing).
// We rewrite only the suffix ": N" (or ": <number>") to " * [0, 0, ...]" and leave the left expr as-is.
const repeatRewriteSem = g.createSemantics().addOperation('collectRepeatSuffixRewrites', {
  Prog(_leadingNls, sections, _trailingNls) {
    const out = [];
    for (const sec of sections.children) {
      const v = sec.collectRepeatSuffixRewrites();
      if (Array.isArray(v)) out.push(...v);
    }
    return out;
  },
  Section(stmts) {
    const out = [];
    for (const s of stmts.children) {
      const v = s.collectRepeatSuffixRewrites();
      if (Array.isArray(v)) out.push(...v);
    }
    return out;
  },
  Stmt(node) { return node.collectRepeatSuffixRewrites(); },
  OpAliasStmt(_name, _eq, _op) { return []; },
  AssignStmt(_name, _eq, expr) { return expr.collectRepeatSuffixRewrites(); },
  ExprStmt(expr) { return expr.collectRepeatSuffixRewrites(); },
  Expr(e) { return e.collectRepeatSuffixRewrites(); },
  FollowedByExpr_fby(x, _comma, y) { return [...x.collectRepeatSuffixRewrites(), ...y.collectRepeatSuffixRewrites()]; },
  PostfixExpr(x) { return x.collectRepeatSuffixRewrites(); },
  MulExpr(x) { return x.collectRepeatSuffixRewrites(); },
  // Explicit handlers for MulExpr variants to ensure traversal
  MulExpr_dotStar(x, _op, y) { return [...x.collectRepeatSuffixRewrites(), ...y.collectRepeatSuffixRewrites()]; },
  MulExpr_dotExpand(x, _op, y) { return [...x.collectRepeatSuffixRewrites(), ...y.collectRepeatSuffixRewrites()]; },
  MulExpr_dotJam(x, _op, y) { return [...x.collectRepeatSuffixRewrites(), ...y.collectRepeatSuffixRewrites()]; },
  MulExpr_dotSteps(x, _op, y) { return [...x.collectRepeatSuffixRewrites(), ...y.collectRepeatSuffixRewrites()]; },
  MulExpr_dotMirror(x, _op, y) { return [...x.collectRepeatSuffixRewrites(), ...y.collectRepeatSuffixRewrites()]; },
  MulExpr_dotLens(x, _op, y) { return [...x.collectRepeatSuffixRewrites(), ...y.collectRepeatSuffixRewrites()]; },
  MulExpr_dotTie(x, _op, y) { return [...x.collectRepeatSuffixRewrites(), ...y.collectRepeatSuffixRewrites()]; },
  MulExpr_dotConstraint(x, _op, y) { return [...x.collectRepeatSuffixRewrites(), ...y.collectRepeatSuffixRewrites()]; },
  MulExpr_dotZip(x, _op, y) { return [...x.collectRepeatSuffixRewrites(), ...y.collectRepeatSuffixRewrites()]; },
  MulExpr_steps(x, _op, y) { return [...x.collectRepeatSuffixRewrites(), ...y.collectRepeatSuffixRewrites()]; },
  MulExpr_mirror(x, _op, y) { return [...x.collectRepeatSuffixRewrites(), ...y.collectRepeatSuffixRewrites()]; },
  MulExpr_jam(x, _op, y) { return [...x.collectRepeatSuffixRewrites(), ...y.collectRepeatSuffixRewrites()]; },
  MulExpr_lens(x, _op, y) { return [...x.collectRepeatSuffixRewrites(), ...y.collectRepeatSuffixRewrites()]; },
  MulExpr_constraint(x, _op, y) { return [...x.collectRepeatSuffixRewrites(), ...y.collectRepeatSuffixRewrites()]; },
  MulExpr_mul(x, _op, y) { return [...x.collectRepeatSuffixRewrites(), ...y.collectRepeatSuffixRewrites()]; },
  MulExpr_expand(x, _op, y) { return [...x.collectRepeatSuffixRewrites(), ...y.collectRepeatSuffixRewrites()]; },
  MulExpr_dot(x, _op, y) { return [...x.collectRepeatSuffixRewrites(), ...y.collectRepeatSuffixRewrites()]; },
  MulExpr_rotate(x, _op, y) { return [...x.collectRepeatSuffixRewrites(), ...y.collectRepeatSuffixRewrites()]; },
  MulExpr_dotRotate(x, _op, y) { return [...x.collectRepeatSuffixRewrites(), ...y.collectRepeatSuffixRewrites()]; },
  MulExpr_glass(x, _op, y) { return [...x.collectRepeatSuffixRewrites(), ...y.collectRepeatSuffixRewrites()]; },
  MulExpr_dotGlass(x, _op, y) { return [...x.collectRepeatSuffixRewrites(), ...y.collectRepeatSuffixRewrites()]; },
  MulExpr_reich(x, _op, y) { return [...x.collectRepeatSuffixRewrites(), ...y.collectRepeatSuffixRewrites()]; },
  MulExpr_dotReich(x, _op, y) { return [...x.collectRepeatSuffixRewrites(), ...y.collectRepeatSuffixRewrites()]; },
  MulExpr_paert(x, _op, y) { return [...x.collectRepeatSuffixRewrites(), ...y.collectRepeatSuffixRewrites()]; },
  MulExpr_aliasOp(x, _name, y) { return [...x.collectRepeatSuffixRewrites(), ...y.collectRepeatSuffixRewrites()]; },
  PostfixExpr_subdivide(x, _slash) { return x.collectRepeatSuffixRewrites(); },
  PostfixExpr_zipColumns(x, _z) { return x.collectRepeatSuffixRewrites(); },
  PostfixExpr_tiePostfix(x, _t) { return x.collectRepeatSuffixRewrites(); },
  PostfixExpr_slice(x, _hspaces, _sl) { return x.collectRepeatSuffixRewrites(); },
  // Core targets: numeric :N, and :<RandNum> only when it's a number literal
  PostfixExpr_repeatPost(_expr, h1, _colon, _h2, n) {
    const raw = String(n.sourceString).trim();
    let num = Number(raw);
    if (!Number.isFinite(num)) return [];
    num = Math.max(0, Math.trunc(num));
    const zeros = (num <= 0) ? '[]' : ('[' + Array(num).fill('0').join(', ') + ']');
    const start = h1.source.startIdx;
    const end = n.source.startIdx + n.sourceString.length;
    return [{ start, end, text: ' * ' + zeros }];
  },
  PostfixExpr_repeatPostRand(_expr, h1, _colon, _h2, rn) {
    const raw = String(rn.sourceString).trim();
    // Only rewrite when RN is plainly numeric; leave curly/refs as-is
    if (raw.startsWith('{')) return [];
    let num = Number(raw);
    if (!Number.isFinite(num)) return [];
    num = Math.max(0, Math.trunc(num));
    const zeros = (num <= 0) ? '[]' : ('[' + Array(num).fill('0').join(', ') + ']');
    const start = h1.source.startIdx;
    const end = rn.source.startIdx + rn.sourceString.length;
    return [{ start, end, text: ' * ' + zeros }];
  },
  PriExpr(_node) { return []; },
  MotBody(_node) { return []; },
  SingleValue(_x) { return []; },
  // Default: flatten child results
  _iter(...children) {
    const out = [];
    for (const c of children) {
      const v = (c && typeof c.collectRepeatSuffixRewrites === 'function') ? c.collectRepeatSuffixRewrites() : [];
      if (Array.isArray(v)) out.push(...v);
    }
    return out;
  },
  NonemptyListOf(x, _sep, xs) {
    return [...x.collectRepeatSuffixRewrites(), ...xs.collectRepeatSuffixRewrites()];
  },
  EmptyListOf() { return []; },
  _terminal() { return []; }
});

// Collect all source indices of timescale numbers across the entire program.
// This inspects syntactic forms only (no evaluation), so indices map to original source.
const tsSemantics = g.createSemantics().addOperation('collectTs', {
  Prog(_leadingNls, sections, _trailingNls) {
    const out = [];
    for (const sec of sections.children) {
      const v = sec.collectTs();
      if (Array.isArray(v)) out.push(...v);
    }
    return out;
  },
  Section(stmts) {
    const out = [];
    for (const s of stmts.children) {
      const v = s.collectTs();
      if (Array.isArray(v)) out.push(...v);
    }
    return out;
  },
  Stmt(node) { return node.collectTs(); },
  OpAliasStmt(_name, _eq, _op) { return []; },
  AssignStmt(_name, _eq, expr) { return expr.collectTs(); },
  ExprStmt(expr) { return expr.collectTs(); },
  Expr(e) { return e.collectTs(); },
  FollowedByExpr_fby(x, _comma, y) { return [...x.collectTs(), ...y.collectTs()]; },
  PostfixExpr(x) { return x.collectTs(); },
  MulExpr(x) { return x.collectTs(); },
  // Explicit handlers for each MulExpr variant to satisfy environments that don't use defaults
  MulExpr_dotStar(x, _op, y) { return [...x.collectTs(), ...y.collectTs()]; },
  MulExpr_dotExpand(x, _op, y) { return [...x.collectTs(), ...y.collectTs()]; },
  MulExpr_dotJam(x, _op, y) { return [...x.collectTs(), ...y.collectTs()]; },
  MulExpr_dotSteps(x, _op, y) { return [...x.collectTs(), ...y.collectTs()]; },
  MulExpr_dotMirror(x, _op, y) { return [...x.collectTs(), ...y.collectTs()]; },
  MulExpr_dotLens(x, _op, y) { return [...x.collectTs(), ...y.collectTs()]; },
  MulExpr_dotTie(x, _op, y) { return [...x.collectTs(), ...y.collectTs()]; },
  MulExpr_dotConstraint(x, _op, y) { return [...x.collectTs(), ...y.collectTs()]; },
  MulExpr_dotZip(x, _op, y) { return [...x.collectTs(), ...y.collectTs()]; },
  MulExpr_steps(x, _op, y) { return [...x.collectTs(), ...y.collectTs()]; },

  MulExpr_mirror(x, _op, y) { return [...x.collectTs(), ...y.collectTs()]; },
  MulExpr_jam(x, _op, y) { return [...x.collectTs(), ...y.collectTs()]; },
  MulExpr_lens(x, _op, y) { return [...x.collectTs(), ...y.collectTs()]; },
  
  MulExpr_constraint(x, _op, y) { return [...x.collectTs(), ...y.collectTs()]; },
  MulExpr_mul(x, _op, y) { return [...x.collectTs(), ...y.collectTs()]; },
  MulExpr_expand(x, _op, y) { return [...x.collectTs(), ...y.collectTs()]; },
  MulExpr_dot(x, _op, y) { return [...x.collectTs(), ...y.collectTs()]; },
  MulExpr_rotate(x, _op, y) { return [...x.collectTs(), ...y.collectTs()]; },
  MulExpr_dotRotate(x, _op, y) { return [...x.collectTs(), ...y.collectTs()]; },
  MulExpr_glass(x, _op, y) { return [...x.collectTs(), ...y.collectTs()]; },
  MulExpr_dotGlass(x, _op, y) { return [...x.collectTs(), ...y.collectTs()]; },
  MulExpr_reich(x, _op, y) { return [...x.collectTs(), ...y.collectTs()]; },
  MulExpr_dotReich(x, _op, y) { return [...x.collectTs(), ...y.collectTs()]; },
  MulExpr_paert(x, _op, y) { return [...x.collectTs(), ...y.collectTs()]; },
  MulExpr_aliasOp(x, _name, y) { return [...x.collectTs(), ...y.collectTs()]; },
  PostfixExpr_subdivide(x, _slash) { return x.collectTs(); },
  PostfixExpr_zipColumns(x, _z) { return x.collectTs(); },
  PostfixExpr_tiePostfix(x, _t) { return x.collectTs(); },
  PostfixExpr_repeatPost(expr, _h1, _colon, _h2, _n) { return expr.collectTs(); },
  PostfixExpr_repeatPostRand(expr, _h1, _colon, _h2, rn) { return [...expr.collectTs(), ...rn.collectTs()]; },
  PostfixExpr_slice(x, _hspaces, _sl) { return x.collectTs(); },
  PriExpr_ref(_name) { return []; },
  PriExpr_mot(_ob, body, _cb) { return body.collectTs(); },
  PriExpr_nestedMot(_ob, body, _cb) { return body.collectTs(); },
  NestedBody_nestedAbsolute(values) { return values.collectTs(); },
  PriExpr_parens(_op, e, _cp) { return e.collectTs(); },
  MotBody_absolute(values) { return values.collectTs(); },

  MotLiteral(_ob, body, _cb) { return body.collectTs(); },

  SingleValue(x) { return x.collectTs(); },
  SingleValue_motSubdivide(node, _slash) { return node.collectTs(); },
  Range_inclusive(_a, _dots, _b) { return []; },
  Pip_noTimeScale(_n) { return []; },
  // Default: flatten children
  _iter(...children) {
    const out = [];
    for (const c of children) {
      const v = (c && typeof c.collectTs === 'function') ? c.collectTs() : [];
      if (Array.isArray(v)) out.push(...v);
    }
    return out;
  },
  _terminal() { return []; },
  NonemptyListOf(x, _sep, xs) { return [...x.collectTs(), ...xs.collectTs()]; },
  EmptyListOf() { return []; },

  // TimeScale forms
  TimeScale_frac(n, _slash, d) {
    return [n.source.startIdx, d.source.startIdx];
  },
  TimeScale_plain(n) {
    return [n.source.startIdx];
  },

  // Pipe implicit timescale after number / special / range / curly
  Pip_withTimeMulPipeImplicit(_n, _h1, _pipe, _h2, ts) { return ts.collectTs(); },
  Pip_withTimeMulPipe(_n, _h1, _pipe, _h2, _star, _h3, m) {
    const xs = m.collectTs();
    return (Array.isArray(xs) && xs.length > 0) ? xs : [m.source.startIdx];
  },
  Pip_withTimeDivPipe(_n, _h1, _pipe, _h2, _slash, _h3, d) {
    const xs = d.collectTs();
    return (Array.isArray(xs) && xs.length > 0) ? xs : [d.source.startIdx];
  },

  Pip_specialWithTimeMulPipeImplicit(_sym, _h1, _pipe, _h2, ts) { return ts.collectTs(); },
  Pip_specialWithTimeMulPipe(_sym, _h1, _pipe, _h2, _star, _h3, m) {
    const xs = m.collectTs();
    return (Array.isArray(xs) && xs.length > 0) ? xs : [m.source.startIdx];
  },
  Pip_specialWithTimeDivPipe(_sym, _h1, _pipe, _h2, _slash, _h3, d) {
    const xs = d.collectTs();
    return (Array.isArray(xs) && xs.length > 0) ? xs : [d.source.startIdx];
  },

  Pip_rangeWithTimeMulPipeImplicit(_range, _h1, _pipe, _h2, ts) { return ts.collectTs(); },
  Pip_rangeWithTimeDivPipe(_range, _h1, _pipe, _h2, _slash, _h3, d) {
    const xs = d.collectTs();
    return (Array.isArray(xs) && xs.length > 0) ? xs : [d.source.startIdx];
  },

  Pip_curlyWithTimeMulPipeImplicit(_curly, _h1, _pipe, _h2, ts) { return ts.collectTs(); },
  Pip_curlyWithTimeMulPipe(_curly, _h1, _pipe, _h2, _star, _h3, m) {
    const xs = m.collectTs();
    return (Array.isArray(xs) && xs.length > 0) ? xs : [m.source.startIdx];
  },
  Pip_curlyWithTimeDivPipe(_curly, _h1, _pipe, _h2, _slash, _h3, d) {
    const xs = d.collectTs();
    return (Array.isArray(xs) && xs.length > 0) ? xs : [d.source.startIdx];
  },

  // Pipe-only forms
  Pip_pipeOnlyTs(_pipe, _h1, ts) { return ts.collectTs(); },
  Pip_pipeOnlyMul(_pipe, _h1, _star, _h2, m) {
    const xs = m.collectTs();
    return (Array.isArray(xs) && xs.length > 0) ? xs : [m.source.startIdx];
  },
  Pip_pipeOnlyDiv(_pipe, _h1, _slash, _h2, d) {
    const xs = d.collectTs();
    return (Array.isArray(xs) && xs.length > 0) ? xs : [d.source.startIdx];
  },
  Pip_withPipeNoTs(_n, _h1, _pipe) { return []; },
  Pip_pipeBare(_pipe) { return []; },

  // Curly-of-pips with outer timescale forms
  Pip_curlyPipWithTimeMulPipeImplicit(_curlyPip, _h1, _pipe, _h2, ts) { return ts.collectTs(); },
  Pip_curlyPipWithTimeMulPipe(_curlyPip, _h1, _pipe, _h2, _star, _h3, m) {
    const xs = m.collectTs();
    return (Array.isArray(xs) && xs.length > 0) ? xs : [m.source.startIdx];
  },
  Pip_curlyPipWithTimeDivPipe(_curlyPip, _h1, _pipe, _h2, _slash, _h3, d) {
    const xs = d.collectTs();
    return (Array.isArray(xs) && xs.length > 0) ? xs : [d.source.startIdx];
  },

  // RandNum used as timescale (number or curly)
  RandNum(node) { return node.collectTs(); },
  Curly(_o, body, _c, _seedOpt) { return body.collectTs(); },
  CurlyBody_list(entries) { return entries.collectTs(); },
  CurlyEntry_num(n) { return [n.source.startIdx]; },
  CurlyEntry_ref(_name) { return []; },
  // Curly-of-pips: collect timescale indices from each contained pip
  CurlyPip(_o, list, _c, _seedOpt) { return list.collectTs(); },
  CurlyBody_range(a, _h1, _q, _h2, b) { return [a.source.startIdx, b.source.startIdx]; },
  number(_sign, _wholeDigits, _point, _fracDigits) { return []; },
  ident_withChars(_first, _rest) { return []; },
  ident_single(_letter) { return []; },
});

class Prog {
  constructor(sections) {
    this.sections = sections; // array of arrays of statements
  }

  interp() {
    const env = new Map();
    const sectionResults = [];

    for (const stmts of this.sections) {
      let lastValue = new Mot([]);
      for (const stmt of stmts) {
        lastValue = stmt.eval(env);
      }
      sectionResults.push(lastValue);
    }

    return sectionResults;
  }
}

// Internal keying for operator aliases inside the environment map
function opKey(name) {
  return 'op:' + name;
}

class OpAliasAssign {
  constructor(name, opSymbol) {
    this.name = name;
    this.opSymbol = opSymbol; // textual operator symbol, e.g., '*', '.*', '->', etc.
  }

  eval(env) {
    env.set(opKey(this.name), this.opSymbol);
    // Return an empty Mot so statements can still yield a Mot value
    return new Mot([]);
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
      let absYi = yi;
      if (reverse) {
        absYi = new Pip(yi.step, Math.abs(yi.timeScale), yi.tag);
      }

      const isZeroRepeat = absYi.step === 0 && absYi.timeScale === 1 && !absYi.tag;
      const leftSourceMot = isZeroRepeat ? requireMot(this.x.eval(env)) : xv;

      const base = reverse ? [...leftSourceMot.values].reverse() : leftSourceMot.values;
      for (let xi of base) {
        values.push(xi.mul(absYi));
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
      let absYi = yi;
      if (reverse) {
        absYi = new Pip(yi.step, Math.abs(yi.timeScale), yi.tag);
      }

      const source = reverse ? [...xv.values].reverse() : xv.values;
      for (let xi of source) {
        values.push(xi.expand(absYi));
      }
    }
    return new Mot(values);
  }
}

// Repeat node that multiplies by a zero-mot whose length is drawn from a RandNum
class RepeatByCount {
  constructor(expr, randSpec) {
    this.expr = expr;       // AST node producing a Mot
    this.randSpec = randSpec; // number | RandomRange | RandomChoice
  }

  eval(env) {
    // Evaluate left to get its Mot (for RNG continuity)
    const leftMot = requireMot(this.expr.eval(env));
    const rng = leftMot._rng || Math.random;
    const count = resolveRandNumToNumber(this.randSpec, rng);
    const zeroMot = new Mot(Array(count).fill(new Pip(0, 1)));
    // Multiply the realized leftMot by zeroMot
    return new Mul(new Mot(leftMot.values, leftMot.rng_seed), zeroMot).eval(env);
  }
}

class Dot {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  eval(env) {
    const xv = requireMot(this.x.eval(env));

    // If RHS is a Mot literal, build a mask that preserves NestedMot groupings and pad semantics
    let rhsMask = null;

    // Handle bare NestedMot on RHS (e.g., [[0,0]])
    if (this.y instanceof NestedMot || this.y instanceof NestedMotExpr) {
      const m = requireMot(this.y.eval(env));
      const pairs = [];
      for (const v of m.values) {
        if (v instanceof Pip) pairs.push({ d: v.step, ts: v.timeScale, tag: v.tag ?? null });
      }
      rhsMask = [{ kind: 'subdiv', pairs }];
    } else if (this.y instanceof Mot) {
      const yAst = this.y;
      rhsMask = yAst.values.map((entry) => {
        // Subdivision grouping: NestedMot or NestedMotExpr
        if (entry instanceof NestedMot || entry instanceof NestedMotExpr) {
          const m = requireMot(entry.eval(env));
          const pairs = [];
          for (const v of m.values) {
            if (v instanceof Pip) pairs.push({ d: v.step, ts: v.timeScale, tag: v.tag ?? null });
          }
          return { kind: 'subdiv', pairs };
        }
        // Pad entry: mark explicitly for later fill logic
        if (entry instanceof PadValue) {
          return { kind: 'pad', value: entry.inner };
        }
        // Otherwise, resolve the single entry to a Pip
        const mv = new Mot([entry]).eval(env);
        let chosen = null;
        for (const v of mv.values) {
          if (v instanceof Pip) { chosen = v; break; }
        }
        if (chosen == null) chosen = new Pip(0, 1);
        return { kind: 'simple', value: chosen };
      });

      // If there is any pad in the mask, convert to an expanded RHS mask that does not cycle:
      // - Keep all elements before the first pad as-is
      // - Repeat the pad element to cover until the tail can right-align
      // - Keep trailing elements after the last pad right-aligned to the end of LHS
      if (rhsMask.some(e => e && e.kind === 'pad')) {
        const nL = xv.values.length;
        const nR = rhsMask.length;
        // find first and last pad
        let firstPad = -1;
        let lastPad = -1;
        for (let i = 0; i < nR; i++) if (rhsMask[i] && rhsMask[i].kind === 'pad') { firstPad = i; break; }
        for (let i = nR - 1; i >= 0; i--) if (rhsMask[i] && rhsMask[i].kind === 'pad') { lastPad = i; break; }
        const head = rhsMask.slice(0, firstPad);
        const tail = rhsMask.slice(lastPad + 1);
        const padSpec = rhsMask[firstPad];
        // Resolve padSpec.value to a simple Pip once
        let padValue = (() => {
          const mv = new Mot([padSpec.value]).eval(env);
          for (const v of mv.values) { if (v instanceof Pip) return v; }
          return new Pip(0, 1);
        })();
        const outMask = new Array(nL);
        // place head as far-left as possible
        for (let i = 0; i < Math.min(head.length, nL); i++) outMask[i] = head[i];
        // place tail right-aligned
        for (let j = 0; j < Math.min(tail.length, nL); j++) outMask[nL - 1 - j] = tail[tail.length - 1 - j];
        // fill middle with padValue
        for (let i = 0; i < nL; i++) if (outMask[i] == null) outMask[i] = { kind: 'simple', value: padValue };
        rhsMask = outMask;
      }
    }

    // When no mask available, use legacy dot behavior
    if (!rhsMask) {
      const yv = requireMot(this.y.eval(env));
      const values = [];
      for (let xi = 0; xi < xv.values.length; xi++) {
        const left = xv.values[xi];
        const right = yv.values[xi % yv.values.length];
        if ((left.tag || right.tag)) {
          if (left.hasTag('r') || right.hasTag('r')) {
            values.push(new Pip(left.step, left.timeScale * right.timeScale, 'r'));
            continue;
          }
          values.push(left);
          continue;
        }
        values.push(left.mul(right));
      }
      return new Mot(values);
    }

    // With mask: apply subdivision coercion where specified; otherwise behave like dot per-position
    const m = rhsMask.length;
    const values = [];
    for (let xi = 0; xi < xv.values.length; xi++) {
      const left = xv.values[xi];
      const mask = rhsMask[xi % m];
      if (mask && mask.kind === 'subdiv' && Array.isArray(mask.pairs) && mask.pairs.length > 0) {
        for (const p of mask.pairs) {
          const combinedTag = left.tag ?? p.tag ?? null;
          const child = new Pip(left.step + p.d, left.timeScale * p.ts, combinedTag);
          // Associate child also with the RHS contributor if available in simple form
          values.push(child);
        }
        continue;
      }
      // Simple per-position pairing (preserve legacy tag handling)
      const right = (mask && mask.kind === 'simple') ? mask.value : new Pip(0, 1);
      if ((left.tag || right.tag)) {
        if (left.hasTag('r') || right.hasTag('r')) {
          const child = new Pip(left.step, left.timeScale * right.timeScale, 'r');
          values.push(child);
          continue;
        }
        values.push(left);
        continue;
      }
      values.push(left.mul(right));
    }
    return new Mot(values);
  }
}

class JamOp {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  eval(env) {
    const left = requireMot(this.x.eval(env));
    const right = requireMot(this.y.eval(env));
    const out = [];
    for (const r of right.values) {
      const passThrough = (r._pipeOnly === true);
      if (passThrough) {
        if (r._jamPass === 'ts') {
          for (const a of left.values) {
            out.push(new Pip(a.step, a.timeScale, a.tag));
          }
        } else if (r._jamPass === 'step') {
          for (const a of left.values) {
            out.push(new Pip(a.step, r.timeScale, a.tag));
          }
        } else {
          for (const a of left.values) {
            out.push(new Pip(a.step, a.timeScale, a.tag));
          }
        }
      } else {
        for (const a of left.values) {
          out.push(new Pip(r.step, r.timeScale, r.tag));
        }
      }
    }
    return new Mot(out);
  }
}

class DotJam {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  eval(env) {
    const left = requireMot(this.x.eval(env));
    const right = requireMot(this.y.eval(env));
    const out = [];
    const m = right.values.length;
    for (let i = 0; i < left.values.length; i++) {
      const a = left.values[i];
      const r = right.values[i % m];
      if (r._pipeOnly === true) {
        if (r._jamPass === 'ts') {
          out.push(new Pip(a.step, a.timeScale, a.tag));
        } else if (r._jamPass === 'step') {
          out.push(new Pip(a.step, r.timeScale, a.tag));
        } else {
          out.push(new Pip(a.step, a.timeScale, a.tag));
        }
      } else {
        out.push(new Pip(r.step, r.timeScale, r.tag));
      }
    }
    return new Mot(out);
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

class DotRotate {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  eval(env) {
    const left = requireMot(this.x.eval(env));
    const right = requireMot(this.y.eval(env));
    const out = [];
    for (let i = 0; i < right.values.length; i++) {
      const r = right.values[i];
      const k = Math.trunc(r.step);
      if (left.values.length === 0) {
        continue;
      }
      const n = left.values.length;
      // Rotate left by k
      let rot = ((-k % n) + n) % n;
      const rotated = left.values.slice(-rot).concat(left.values.slice(0, -rot));
      out.push(rotated[i % rotated.length]);
    }
    return new Mot(out);
  }
}

class AliasCall {
  constructor(opName, x, y) {
    this.opName = opName;
    this.x = x;
    this.y = y;
  }

  eval(env) {
    if (!env.has(opKey(this.opName))) {
      throw new Error('undeclared operator alias: ' + this.opName);
    }
    const sym = env.get(opKey(this.opName));
    const node = instantiateOpNodeBySymbol(sym, this.x, this.y);
    return node.eval(env);
  }
}

function instantiateOpNodeBySymbol(sym, x, y) {
  switch (sym) {
    case '*': return new Mul(x, y);
    case '^': return new Expand(x, y);
    case '.': return new Dot(x, y);
    case '.*': return new Dot(x, y);
    case '.^': return new DotExpand(x, y);
    case '->': return new Steps(x, y);
    case '.->': return new DotSteps(x, y);
    case 'j': return new JamOp(x, y);
    case '.j': return new DotJam(x, y);
    case 'm': return new Mirror(x, y);
    case '.m': return new DotMirror(x, y);
    case 'l': return new Lens(x, y);
    case '.l': return new DotLens(x, y);
    case '.t': return new DotTie(x, y);
    case 'c': return new ConstraintOp(x, y);
    case '.c': return new DotConstraint(x, y);
    case '~': return new RotateOp(x, y);
    case '.,': return new DotZip(x, y);
    case 'g': return new GlassOp(x, y);
    case '.g': return new DotGlass(x, y);
    case 'r': return new ReichOp(x, y);
    case '.r': return new DotReich(x, y);
    case 'p': return new PaertOp(x, y);
    default:
      throw new Error('unknown operator symbol for alias: ' + sym);
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
    // Fan semantics: for each right value r, emit left shifted by t for t in [0..k]
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
    // Cog semantics: at each position i, expand left[i] into a run up to k_i
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

// Neighbor, DotNeighbor, and Anticip operators removed

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

class DotZip {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  eval(env) {
    const left = requireMot(this.x.eval(env));
    const right = requireMot(this.y.eval(env));
    const out = [];
    const maxLen = Math.max(left.values.length, right.values.length);

    for (let i = 0; i < maxLen; i++) {
      if (i < left.values.length) {
        out.push(left.values[i]);
      }
      if (i < right.values.length) {
        out.push(right.values[i]);
      }
    }

    return new Mot(out);
  }
}

// ZipColumns: Takes a comma-concatenation and interleaves the parts in round-robin fashion
// Example: ([A], [B], [C])z where A=[0,0,0], B=[1,1,1], C=[2,2,2] -> [0,1,2,0,1,2,0,1,2]
class ZipColumns {
  constructor(x) {
    this.x = x;
  }

  // Collect all parts from FollowedBy chain into an array
  collectParts(expr, env) {
    if (expr instanceof FollowedBy) {
      return [...this.collectParts(expr.x, env), ...this.collectParts(expr.y, env)];
    } else {
      // It's a single mot
      const mot = requireMot(expr.eval(env));
      return [mot.values];
    }
  }

  eval(env) {
    // Collect all comma-separated parts
    const parts = this.collectParts(this.x, env);

    if (parts.length === 0) return new Mot([]);
    if (parts.length === 1) return new Mot(parts[0]);

    // Find the maximum length
    const maxLen = Math.max(...parts.map(p => p.length));

    // Interleave in round-robin fashion
    const out = [];
    for (let i = 0; i < maxLen; i++) {
      for (let j = 0; j < parts.length; j++) {
        if (i < parts[j].length) {
          out.push(parts[j][i]);
        }
      }
    }

    return new Mot(out);
  }
}

// GlassOp: Interleave two Mots with different rhythmic subdivisions
// Inspired by Glass's minimalist style (triplets vs duplets)
// LHS gets triplet subdivision (1/3), RHS gets duplet subdivision (1/2)
class GlassOp {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  eval(env) {
    const left = requireMot(this.x.eval(env));
    const right = requireMot(this.y.eval(env));
    const out = [];

    // Interleave the two sets with different rhythmic patterns
    // left gets triplets (1/3), right gets duplets (1/2)
    for (const a of left.values) {
      out.push(new Pip(a.step, a.timeScale / 3, a.tag));
    }
    for (const r of right.values) {
      out.push(new Pip(r.step, r.timeScale / 2, r.tag));
    }

    return new Mot(out);
  }
}

// DotGlass: Cog-style Glass operation
// Applies glass subdivision pattern element-wise
class DotGlass {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  eval(env) {
    const left = requireMot(this.x.eval(env));
    const right = requireMot(this.y.eval(env));
    const out = [];

    // Alternate between left (triplet) and right (duplet) subdivision
    const maxLen = Math.max(left.values.length, right.values.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < left.values.length) {
        const a = left.values[i];
        out.push(new Pip(a.step, a.timeScale / 3, a.tag));
      }
      if (i < right.values.length) {
        const r = right.values[i % right.values.length];
        out.push(new Pip(r.step, r.timeScale / 2, r.tag));
      }
    }

    return new Mot(out);
  }
}

// ReichOp: Create phasing patterns between two Mots
// Inspired by Reich's phasing technique - repeats both mots cyclically
class ReichOp {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  eval(env) {
    const left = requireMot(this.x.eval(env));
    const right = requireMot(this.y.eval(env));
    const out = [];

    // Cycle through both sets with 1/4 note subdivision
    // This creates a phasing pattern when the cycle lengths differ
    for (const a of left.values) {
      out.push(new Pip(a.step, a.timeScale / 4, a.tag));
    }
    for (const r of right.values) {
      out.push(new Pip(r.step, r.timeScale / 4, r.tag));
    }

    return new Mot(out);
  }
}

// DotReich: Cog-style Reich operation with varied durations
// Applies phasing pattern with alternating durations (1/2, 1/4)
class DotReich {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  eval(env) {
    const left = requireMot(this.x.eval(env));
    const right = requireMot(this.y.eval(env));
    const out = [];

    // Alternate durations: 1/2, 1/4 for left; 1, 1/2 for right
    const leftDurs = [2, 4];
    const rightDurs = [1, 2];

    for (let i = 0; i < left.values.length; i++) {
      const a = left.values[i];
      const dur = leftDurs[i % leftDurs.length];
      out.push(new Pip(a.step, a.timeScale / dur, a.tag));
    }

    for (let i = 0; i < right.values.length; i++) {
      const r = right.values[i];
      const dur = rightDurs[i % rightDurs.length];
      out.push(new Pip(r.step, r.timeScale / dur, r.tag));
    }

    return new Mot(out);
  }
}

// PaertOp: Tintinnabulation operator with octave equivalence and unison avoidance
// Snaps LHS steps to the nearest RHS step values (mod 7 for octave identity)
// RHS values represent triad tones - the T-voice avoids unisons/octaves with M-voice
// When the nearest triad tone would create a unison, moves to next-nearest (preferring downward)
// Example: [0,1,2,3] p [0,2,4] => [4,0,2,2] (0→4 down, 1→0, 2→2, 3→2)
// Example: [7,8,9,10] p [0,2,4] => [11,7,9,9] (octave equivalence maintained)
class PaertOp {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  eval(env) {
    const input = requireMot(this.x.eval(env));
    const scaleDegrees = requireMot(this.y.eval(env));
    const out = [];

    // Extract scale degrees and normalize to [0,7) range
    const scale = scaleDegrees.values.map(p => {
      const s = Math.round(p.step);
      return ((s % 7) + 7) % 7; // normalize to [0,7)
    });

    if (scale.length === 0) {
      // No scale degrees provided, return input unchanged
      return input;
    }

    // Sort scale degrees for efficient nearest-neighbor search
    const sortedScale = [...new Set(scale)].sort((a, b) => a - b);

    for (const pip of input.values) {
      const inputStep = pip.step;
      const octave = Math.floor(inputStep / 7);
      const pitchClass = ((inputStep % 7) + 7) % 7;

      // Find nearest scale degree to pitchClass, avoiding unisons
      let nearestDegree = null;
      let minDist = Infinity;

      // First pass: find nearest that is NOT a unison
      for (const degree of sortedScale) {
        if (degree === pitchClass) continue; // skip unisons
        const dist = Math.abs(pitchClass - degree);
        if (dist < minDist) {
          minDist = dist;
          nearestDegree = degree;
        }
      }

      // If no non-unison degree found (e.g., scale has only one degree), try other octaves
      if (nearestDegree === null) {
        // Look for nearest degree in adjacent octaves, preferring downward
        const candidates = [];
        for (const degree of sortedScale) {
          // Try octave below
          candidates.push({ degree, octaveOffset: -1, dist: Math.abs(pitchClass - (degree + 7)) });
          // Try octave above
          candidates.push({ degree, octaveOffset: 1, dist: Math.abs(pitchClass - (degree - 7)) });
        }
        candidates.sort((a, b) => {
          if (a.dist !== b.dist) return a.dist - b.dist;
          return a.octaveOffset - b.octaveOffset; // prefer downward (-1 before 1)
        });
        if (candidates.length > 0) {
          nearestDegree = candidates[0].degree;
          // Apply octave offset for reconstruction
          const quantizedStep = (octave + candidates[0].octaveOffset) * 7 + nearestDegree;
          out.push(new Pip(quantizedStep, pip.timeScale, pip.tag));
          continue;
        }
        // Fallback: use original pitch if no alternatives found
        out.push(new Pip(inputStep, pip.timeScale, pip.tag));
        continue;
      }

      // Reconstruct quantized step with same octave
      const quantizedStep = octave * 7 + nearestDegree;
      out.push(new Pip(quantizedStep, pip.timeScale, pip.tag));
    }

    return new Mot(out);
  }
}

// Subdivide postfix operator: divides all timescales by the length of the mot
// Example: [0,1,2]/ → [0|/3, 1|/3, 2|/3]
// Example: [[2,2]]/ → [2|/2, 2|/2]
class Subdivide {
  constructor(x) {
    this.x = x;
  }

  eval(env) {
    const mot = requireMot(this.x.eval(env));
    const N = mot.values.length;
    if (N === 0) return new Mot([]);
    const factor = 1 / N;
    const out = mot.values.map(pip => new Pip(pip.step, pip.timeScale * factor, pip.tag, pip.sourceStart));
    return new Mot(out);
  }
}

// Helper function to subdivide a Mot or NestedMot directly
function subdivide(motOrNested) {
  if (motOrNested instanceof Mot) {
    const N = motOrNested.values.length;
    if (N === 0) return new Mot([]);
    const factor = 1 / N;
    const out = motOrNested.values.map(pip => {
      if (pip instanceof Pip) {
        return new Pip(pip.step, pip.timeScale * factor, pip.tag, pip.sourceStart);
      }
      return pip;
    });
    return new Mot(out);
  }
  if (motOrNested instanceof NestedMot) {
    const N = motOrNested.values.length;
    if (N === 0) return new NestedMot([]);
    const factor = 1 / N;
    const out = motOrNested.values.map(v => {
      if (v instanceof Pip) {
        return new Pip(v.step, v.timeScale * factor, v.tag, v.sourceStart);
      }
      return v;
    });
    return new NestedMot(out);
  }
  return motOrNested;
}

class TieOp {
  constructor(x) {
    this.x = x;
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
        // merge durations (sum timeScales), preserve first sourceStart
        acc = new Pip(acc.step, acc.timeScale + cur.timeScale, acc.tag, acc.sourceStart);
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
          acc = new Pip(acc.step, acc.timeScale + next.timeScale, acc.tag, acc.sourceStart);
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
      // keep when r.step != 0
      const omit = r.step === 0;
      if (!omit) {
        out.push(new Pip(a.step, a.timeScale * r.timeScale, a.tag, a.sourceStart));
      }
    }
    return new Mot(out);
  }
}

class DotConstraint extends ConstraintOp { }

function requireMot(value) {
  if (!(value instanceof Mot) && !(value instanceof NestedMot) && !(value instanceof NestedMotExpr)) {
    throw new Error('Mot required!');
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

function warmUpRng(rng, steps) {
  for (let i = 0; i < steps; i++) rng();
}

function computeWarmupStepsForRandNum(value) {
  let posSalt = 0;
  if (value && typeof value === 'object') {
    // RandomRange has startPos/endPos when numeric endpoints came from source
    if ('startPos' in value && typeof value.startPos === 'number') posSalt ^= value.startPos | 0;
    if ('endPos' in value && typeof value.endPos === 'number') posSalt ^= value.endPos | 0;
    // RandomChoice may carry positions array
    if (Array.isArray(value.positions)) {
      for (const p of value.positions) if (typeof p === 'number') posSalt ^= p | 0;
    }
  }
  // Seed is already a 32-bit number (via stringToSeed), but defend just in case
  const seedNum = (typeof value.seed === 'number') ? value.seed : hashSeedTo32Bit(value.seed ?? 0);
  // Mix seed with position salt to get a small step count in [1..256]
  const mixed = (seedNum ^ posSalt) >>> 0;
  return (mixed & 0xff) + 1;
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
  constructor(start, end, startPos = null, endPos = null) {
    this.start = start;
    this.end = end;
    // Source indices of numeric endpoints when available
    this.startPos = startPos;
    this.endPos = endPos;
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
  constructor(start, end, startPos = null, endPos = null) {
    this.start = start;
    this.end = end;
    this.seed = null;
    // Source indices of endpoints inside {a ? b} when numeric
    this.startPos = startPos;
    this.endPos = endPos;
  }
}

class RandomChoice {
  constructor(options, positions = null) {
    this.options = options; // array of numbers
    this.seed = null;
    // Optional source indices for each numeric option when parsed from CurlyBody_list
    this.positions = Array.isArray(positions) ? positions : null;
  }
}

// Random choice among references to previously assigned mots.
// At evaluation, pick one reference uniformly, resolve its Mot from env, and expand.
class RandomRefChoice {
  constructor(refs) {
    this.refs = refs; // array of Ref
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

// Choose one of several fully specified pip-like values (already Pip/RangePipe/etc.)
class RandomPipChoiceFromPips {
  constructor(options) {
    this.options = options; // array of Pip-like nodes
    this.seed = null;
    this.extraTs = null; // optional extra timescale to apply after selection
  }

  toString() {
    // Non-evaluated form: print as a generic random pip
    return '{pip}';
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
class PadValue {
  constructor(inner) {
    this.inner = inner; // Value node to repeat as needed
  }
}

function resolveRandNumToNumber(value, rng) {
  if (typeof value === 'number') return value;
  if (value instanceof RandomRange) {
    const localRng = value.seed != null ? createSeededRng(value.seed) : rng;
    if (value.seed != null) {
      warmUpRng(localRng, computeWarmupStepsForRandNum(value));
    }
    const lo = Math.min(value.start, value.end);
    const hi = Math.max(value.start, value.end);
    return Math.floor(localRng() * (hi - lo + 1)) + lo;
  }
  if (value instanceof RandomChoice) {
    if (value.options.length === 0) throw new Error('empty random choice');
    const localRng = value.seed != null ? createSeededRng(value.seed) : rng;
    if (value.seed != null) {
      warmUpRng(localRng, computeWarmupStepsForRandNum(value));
    }
    const idx = Math.floor(localRng() * value.options.length);
    return value.options[idx];
  }
  throw new Error('Unsupported RandNum');
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
    if (node instanceof RandomRange || node instanceof RandomChoice || node instanceof RandomRefChoice || node instanceof RandomPipChoiceFromPips) {
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
    const out = new Pip(this.step + that.step, this.timeScale * that.timeScale, combinedTag);
    return out;
  }

  expand(that) {
    const combinedTag = this.tag ?? that.tag ?? null;
    const out = new Pip(this.step * that.step, this.timeScale * that.timeScale, combinedTag);
    return out;
  }

  toString() {
    const tag_str = this.tag ? `${this.tag}` : '';
    let step_str;
    if (this.tag == 'r') {
      step_str = tag_str;
    } else {
      step_str = `${this.step}`;
    }
    let ts = this.timeScale;
    // Handle unresolved fractional timeScales
    if (ts && typeof ts === 'object' && ts._frac) {
      return `${step_str} | ${ts.num}/${ts.den}`;
    }
    ts = Math.abs(ts);
    if (ts === 1) {
      return `${step_str}`;
    }
    // Prefer division form when ts is (approximately) 1/n
    const inv = 1 / ts;
    const invRounded = Math.round(inv);
    const isInvInt = Math.abs(inv - invRounded) < 1e-10 && invRounded !== 0;
    if (isInvInt) {
      return `${step_str} | /${invRounded}`;
    }
    // Fallback to pipe form
    const tsStr = Number.isInteger(ts) ? String(ts) : String(+ts.toFixed(6)).replace(/\.0+$/, '');
    return `${step_str} | ${tsStr}`;
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
    // Determine RNG - use global seed if no local seed set
    let seed = this.rng_seed;
    if (seed == null && golden.CRUX_SEED != null) {
      seed = golden.CRUX_SEED;
    }
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
        // Resolve random timeScale if present
        let ts = value.timeScale;
        if (ts instanceof RandomRange || ts instanceof RandomChoice) {
          ts = resolveRandNumToNumber(ts, rng);
        } else if (ts && typeof ts === 'object' && ts._frac) {
          // Handle fractional timeScales with random components
          const num = ts.num instanceof RandomRange || ts.num instanceof RandomChoice
            ? resolveRandNumToNumber(ts.num, rng) : ts.num;
          const den = ts.den instanceof RandomRange || ts.den instanceof RandomChoice
            ? resolveRandNumToNumber(ts.den, rng) : ts.den;
          ts = num / den;
        }
        if (ts !== value.timeScale) {
          const np = new Pip(value.step, ts, value.tag, value.sourceStart);
          resolved.push(np);
        } else {
          resolved.push(value);
        }
      } else if (value instanceof Range) {
        const pips = value.expandToPips(rng);
        for (const p of pips) { resolved.push(p); }
      } else if (value instanceof PadValue) {
        // In fan contexts, ignore ellipsis semantics by resolving the inner value as-is
        const inner = value.inner;
        const mv = new Mot([inner]).eval(env);
        for (const p of mv.values) { resolved.push(p); }
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
        const np = new Pip(step, ts);
        resolved.push(np);
      } else if (value instanceof RandomPipChoiceFromPips) {
        // Choose an option using seed if present
        const localRng = value.seed != null ? createSeededRng(value.seed) : rng;
        const idx = Math.floor(localRng() * value.options.length);
        const chosen = value.options[idx];
        // Evaluate the chosen node in the same pipeline as other values
        // First, lift chosen into a Mot for reuse of existing logic
        const chosenMot = new Mot([chosen]);
        const evaluated = chosenMot.eval(env); // resolves ranges/randoms/etc
        for (const p of evaluated.values) {
          // Apply extraTs if present
          let ts = p.timeScale;
          const extra = value.extraTs;
          if (extra != null) {
            if (typeof extra === 'number') {
              ts = ts * extra;
            } else if (extra && typeof extra === 'object') {
              const rhsRaw = extra.rhs;
              const rhsVal = typeof rhsRaw === 'number' ? rhsRaw : resolveRandNumToNumber(rhsRaw, rng);
              if (extra.kind === 'mul') ts = ts * rhsVal;
              else if (extra.kind === 'div') ts = ts * (1 / rhsVal);
            }
          }
          const np = new Pip(p.step, ts, p.tag);
          resolved.push(np);
        }
      } else if (value instanceof Ref) {
        // Inline referenced motif values inside a Mot list
        const mv = requireMot(value.eval(env));
        for (const p of mv.values) { resolved.push(p); }
      } else if (value instanceof RangePipe) {
        // Expand range and apply scaling per element
        const expanded = value.range.expandToPips(rng);
        if (value.op.kind === 'mul') {
          for (const p of expanded) { const np = new Pip(p.step, p.timeScale * value.op.factor); resolved.push(np); }
        } else {
          // div by number or RandNum
          const denom = typeof value.op.rhs === 'number' ? value.op.rhs : resolveRandNumToNumber(value.op.rhs, rng);
          for (const p of expanded) { const np = new Pip(p.step, p.timeScale * (1 / denom)); resolved.push(np); }
        }
      } else if (value instanceof RandomRange) {
        const num = resolveRandNumToNumber(value, rng);
        const np = new Pip(num, 1);
        resolved.push(np);
      } else if (value instanceof RandomChoice) {
        const num = resolveRandNumToNumber(value, rng);
        const np = new Pip(num, 1);
        resolved.push(np);
      } else if (value instanceof RandomRefChoice) {
        // Choose a referenced mot and inline its values
        if (!Array.isArray(value.refs) || value.refs.length === 0) {
          throw new Error('empty random mot choice');
        }
        const localRng = value.seed != null ? createSeededRng(value.seed) : rng;
        const idx = Math.floor(localRng() * value.refs.length);
        const ref = value.refs[idx];
        const chosen = requireMot(ref.eval(env));
        for (const p of chosen.values) { resolved.push(p); }
      } else if (value instanceof Mot) {
        // Inline nested Mot inside a Mot (e.g., [ [0,1], 2 ])
        const mv = value.eval(env);
        for (const p of mv.values) { resolved.push(p); }
      } else if (value instanceof NestedMotExpr) {
        // Evaluate nested expression and inline its subdivided values
        const mv = requireMot(value.eval(env));
        for (const p of mv.values) { resolved.push(p); }
      } else if (value instanceof NestedMot) {
        // Inline nested mot content
        const nm = value.eval(env);
        for (const p of nm.values) { resolved.push(p); }
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

class NestedMot {
  constructor(values) {
    this.values = values;
  }

  eval(env) {
    // Nested mots now default to NO scaling (keep original timescales).
    // Use the / postfix operator to get subdivision behavior.
    //
    // Simply flatten all pieces without any timescale adjustment.
    const pieces = [];
    for (const v of this.values) {
      let pieceValues;
      if (v instanceof NestedMot) {
        pieceValues = v.eval(env).values;
      } else if (v instanceof Mot) {
        pieceValues = v.eval(env).values;
      } else {
        pieceValues = new Mot([v]).eval(env).values;
      }
      // Clone pips to avoid mutating nested results downstream
      pieces.push(pieceValues.map(p => new Pip(p.step, p.timeScale, p.tag)));
    }

    if (pieces.length === 0) return new Mot([]);

    // Just flatten - no timescale adjustment
    const out = [];
    for (const chunk of pieces) {
      for (const p of chunk) out.push(p);
    }
    return new Mot(out);
  }

  toString() {
    return '[[' + this.values.map(value => value.toString()).join(', ') + ']]';
  }
}

class NestedMotExpr {
  constructor(expr) {
    this.expr = expr;
  }

  eval(env) {
    // Evaluate the inner expression to get a mot.
    // NEW BEHAVIOR: Just return the mot as-is, preserving timescales.
    // Use the / postfix operator if subdivision is needed.
    //
    // Special-case: if the inner expression is a Mul of two single-element mots,
    // treat it as the RHS mot inside nested context so that constructs like
    // [0, [1] * [2], 4] behave like [0, [2], 4] when used in higher-level ops.
    let innerMot;
    if (this.expr instanceof Mul) {
      try {
        const leftMot = requireMot(this.expr.x.eval(env));
        const rightMot = requireMot(this.expr.y.eval(env));
        const leftIsSingleton = Array.isArray(leftMot.values) && leftMot.values.length === 1;
        const rightIsSingleton = Array.isArray(rightMot.values) && rightMot.values.length === 1;
        if (leftIsSingleton && rightIsSingleton) {
          innerMot = rightMot;
        } else {
          innerMot = requireMot(this.expr.eval(env));
        }
      } catch (_e) {
        innerMot = requireMot(this.expr.eval(env));
      }
    } else {
      innerMot = requireMot(this.expr.eval(env));
    }

    // Just return the mot as-is - no automatic subdivision
    if (innerMot.values.length === 0) return new Mot([]);

    const preservedValues = innerMot.values.map(pip =>
      new Pip(pip.step, pip.timeScale, pip.tag)
    );

    return new Mot(preservedValues);
  }

  toString() {
    return '[[' + this.expr.toString() + ']]';
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
      let k;
      if (typeof idx === 'number') {
        k = Math.trunc(idx);
      } else {
        // RandNum (RandomRange | RandomChoice)
        const rng = motif._rng || Math.random;
        const num = resolveRandNumToNumber(idx, rng);
        k = Math.trunc(num);
      }
      if (k < 0) k = n + k; // -1 => n-1
      return Math.max(0, Math.min(n, k));
    };

    const s = normIndex(this.start, 0);
    const e = normIndex(this.end, n);
    return new Mot(values.slice(s, e));
  }
}


// utilities

function stringToSeed(str) {
  let hash = 5381;
  let i = str.length;

  while (i) {
    hash = (hash * 33) ^ str.charCodeAt(--i);
  }

  // Ensure the hash is a positive 32-bit integer
  return hash >>> 0; 
}



// ---- Depth analysis (parse-time; no evaluation) ----

const BINARY_TRANSFORMS = new Set([
  Mul, Expand, Dot, DotExpand, Steps, DotSteps,
  Mirror, DotMirror, Lens, DotLens, DotTie, JamOp, DotJam,
  ConstraintOp, DotConstraint, RotateOp, DotRotate, DotZip,
  GlassOp, DotGlass, ReichOp, DotReich, PaertOp,
  AliasCall,
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

  // Process all sections to build up the environment
  for (const stmts of prog.sections) {
    for (const stmt of stmts) {
      last = stmt;
      if (stmt instanceof Assign) {
        env.set(stmt.name, stmt.expr);
      }
    }
  }

  const root = (last instanceof Assign) ? last.expr : last;
  return { root, env };
}

// Collect leaf Mots with their binary-transform depth from the root.
// - followRefs: when true, inline assignment RHS at Ref sites without adding depth.
// - excludeConcat: when true, do not count concatenation (FollowedBy) as a transform.
golden.collectMotLeavesWithDepth = function(root, env, { followRefs = true, excludeConcat = true } = {}) {
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

    if (node instanceof TieOp) {
      // TieOp is transparent - doesn't affect depth
      visit(node.x, depth);
      return;
    }

    if (node instanceof Subdivide) {
      // Subdivide is transparent - doesn't affect depth
      visit(node.x, depth);
      return;
    }

    if (node instanceof RepeatByCount) {
      // RepeatByCount is transparent - doesn't affect depth
      // Visit the expression at the current depth
      visit(node.expr, depth);
      // The zero-mot is a child of the implicit Mul, so at depth+1
      const count = typeof node.randSpec === 'number' ? node.randSpec : 5;
      const zeroMot = new Mot(Array(Math.max(0, Math.trunc(count))).fill(new Pip(0, 1)));
      out.push({ mot: zeroMot, depth: depth + 1 });
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
golden.computeExprHeight = function(root, env, { followRefs = true, excludeConcat = true } = {}) {
  const memo = new Map();
  const visitingRef = new Set();

  function height(node) {
    if (!node) return 0;
    if (memo.has(node)) return memo.get(node);

    if (node instanceof SegmentTransform) {
      const h = height(node.expr);
      memo.set(node, h);
      return h;
    }

    if (node instanceof RepeatByCount) {
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



// Convenience: compute Mot depths from the final statement's root.
golden.computeMotDepthsFromRoot = function(source, options = {}) {
  const prog = parse(source);
  const { root, env } = getFinalRootAstAndEnv(prog);
  return golden.collectMotLeavesWithDepth(root, env, options);
}

// Convenience: compute expression height from the final statement's root.
golden.computeHeightFromLeaves = function(source, options = {}) {
  const prog = parse(source);
  const { root, env } = getFinalRootAstAndEnv(prog);
  return golden.computeExprHeight(root, env, options);
}

// Find all source indices where a timescale literal appears in the source program.
golden.findAllTimescaleIndices = function(source) {
  const withoutComments = stripLineComments(source);
  const matchResult = g.match(withoutComments);
  if (matchResult.failed()) return [];
  const idxs = tsSemantics(matchResult).collectTs();
  // Deduplicate and sort for stability
  const uniq = Array.from(new Set(idxs)).sort((a, b) => a - b);
  return uniq;
}





// Return arrays of indices (per Mot, left-to-right) of numeric pips whose Mot is exactly targetDepth from the root.
// Numeric pip = Pip with no tag (excludes special/tagged, random, range, etc.).
golden.findNumericValueIndicesAtDepth = function(source, targetDepth, options = {}) {
  const prog = parse(source);
  const { root, env } = getFinalRootAstAndEnv(prog);
  const leaves = golden.collectMotLeavesWithDepth(root, env, options);
  const result = [];

  for (const { mot, depth } of leaves) {
    if (depth !== targetDepth) continue;
    const idxs = [];
    for (let i = 0; i < mot.values.length; i++) {
      const v = mot.values[i];
      // Plain numeric pip
      if (v instanceof Pip && v.tag == null) {
        if (typeof v.sourceStart === 'number') idxs.push(v.sourceStart);
      }
      // Include explicit range endpoint literals
      else if (v instanceof Range) {
        if (typeof v.startPos === 'number') idxs.push(v.startPos);
        if (typeof v.endPos === 'number') idxs.push(v.endPos);
      }
      // Include endpoints for deferred range with pipe scaling
      else if (v instanceof RangePipe && v.range) {
        const r = v.range;
        if (typeof r.startPos === 'number') idxs.push(r.startPos);
        if (typeof r.endPos === 'number') idxs.push(r.endPos);
      }
      // Include curly-based random specs
      else if (v instanceof RandomRange) {
        if (typeof v.startPos === 'number') idxs.push(v.startPos);
        if (typeof v.endPos === 'number') idxs.push(v.endPos);
      } else if (v instanceof RandomChoice) {
        if (Array.isArray(v.positions)) {
          for (const p of v.positions) if (typeof p === 'number') idxs.push(p);
        }
      } else if (v instanceof RandomPip) {
        const rnd = v.randnum;
        if (rnd instanceof RandomRange) {
          if (typeof rnd.startPos === 'number') idxs.push(rnd.startPos);
          if (typeof rnd.endPos === 'number') idxs.push(rnd.endPos);
        } else if (rnd instanceof RandomChoice) {
          if (Array.isArray(rnd.positions)) {
            for (const p of rnd.positions) if (typeof p === 'number') idxs.push(p);
          }
        }
      }
    }
    result.push(idxs);
  }
  return result.flat();
}


// Return arrays of indices (per Mot, left-to-right) of numeric pips whose Mot depth >= minDepth.
golden.findNumericValueIndicesAtDepthOrAbove = function(source, minDepth, options = {}) {
  const prog = parse(source);
  const { root, env } = getFinalRootAstAndEnv(prog);
  const leaves = golden.collectMotLeavesWithDepth(root, env, options);
  const result = [];

  for (const { mot, depth } of leaves) {
    // "or above" means shallower or equal depth (closer to root)
    if (depth > minDepth) continue;
    const idxs = [];
    for (let i = 0; i < mot.values.length; i++) {
      const v = mot.values[i];
      // Plain numeric pip
      if (v instanceof Pip && v.tag == null) {
        if (typeof v.sourceStart === 'number') idxs.push(v.sourceStart);
      }
      // Include explicit range endpoints
      else if (v instanceof Range) {
        if (typeof v.startPos === 'number') idxs.push(v.startPos);
        if (typeof v.endPos === 'number') idxs.push(v.endPos);
      }
      // Include endpoints for deferred range with pipe scaling
      else if (v instanceof RangePipe && v.range) {
        const r = v.range;
        if (typeof r.startPos === 'number') idxs.push(r.startPos);
        if (typeof r.endPos === 'number') idxs.push(r.endPos);
      }
      // Include curly-based random specs
      else if (v instanceof RandomRange) {
        if (typeof v.startPos === 'number') idxs.push(v.startPos);
        if (typeof v.endPos === 'number') idxs.push(v.endPos);
      } else if (v instanceof RandomChoice) {
        if (Array.isArray(v.positions)) {
          for (const p of v.positions) if (typeof p === 'number') idxs.push(p);
        }
      } else if (v instanceof RandomPip) {
        const rnd = v.randnum;
        if (rnd instanceof RandomRange) {
          if (typeof rnd.startPos === 'number') idxs.push(rnd.startPos);
          if (typeof rnd.endPos === 'number') idxs.push(rnd.endPos);
        } else if (rnd instanceof RandomChoice) {
          if (Array.isArray(rnd.positions)) {
            for (const p of rnd.positions) if (typeof p === 'number') idxs.push(p);
          }
        }
      }
    }
    result.push(idxs);
  }
  return result.flat();
}


// Public: seed any unseeded curly randoms with @hhhh
golden.CruxRewriteCurlySeeds = function(input) {
  return rewriteCurlySeeds(String(input || ''));
}

// Public: desugar only the :N textual suffixes to " * [0,0,...]" using CST spans.
// Preserves all other whitespace and // comments.
golden.CruxDesugarRepeats = function(input) {
  const src = String(input || '');
  // Parse on a comment-stripped shadow to align indices, like parse()
  const withoutComments = stripLineComments(src);
  const matchResult = g.match(withoutComments);
  if (matchResult.failed()) return src;
  const edits = repeatRewriteSem(matchResult).collectRepeatSuffixRewrites();
  if (!Array.isArray(edits) || edits.length === 0) return src;
  // Coalesce non-overlapping edits (they should already be non-overlapping)
  const sorted = edits.slice().sort((a, b) => a.start - b.start);
  let out = '';
  let cur = 0;
  for (const e of sorted) {
    const { start, end, text } = e;
    if (start < cur) continue; // skip overlapping
    out += src.slice(cur, start) + text;
    cur = end;
  }
  out += src.slice(cur);
  return out;
}



function stripLineComments(input) {
  // Replace comment-only lines (with optional leading whitespace) with empty lines
  // For inline comments, replace just the comment part with spaces
  return input.replace(/^(\s*)\/\/.*$/gm, '$1');
}

function parse(input) {
  const processed = input.replace(/\s*;\s*/g, '\n').trim();
  const withoutComments = stripLineComments(processed);
  const matchResult = g.match(withoutComments);
  if (matchResult.failed()) {
    throw new Error(matchResult.message);
  }
  return s(matchResult).parse();
}

golden.parse = parse;

golden.crux_interp = function (input) {
  const prog = parse(input);
  const value = prog.interp();
  return value;
}







// === Exports ===
if (typeof module !== 'undefined' && module.exports) {
  module.exports = golden;
  module.exports.default = golden;
}
if (typeof globalThis !== 'undefined') globalThis.golden = golden;
if (typeof window !== 'undefined') window.golden = golden;
