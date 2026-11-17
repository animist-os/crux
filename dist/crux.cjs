// Crux - Musical Motif DSL
// Bundled Distribution
// Generated: 2026-11-17T15:50:40.329Z
//
// NOTE: This bundle requires ohm-js as a peer dependency

// Load ohm-js (CommonJS)
var ohm = (typeof require !== 'undefined') ? require('ohm-js') : (globalThis.ohm || (typeof window !== 'undefined' && window.ohm));
if (!ohm) {
  throw new Error('ohm-js is required. Install with: npm install ohm-js');
}

// === Grammar ===
const g = ohm.grammar(String.raw`
  Crux {

    Prog
      = nls? Section ProgRest* trailingSpace      -- withContent
      | nls? trailingSpace                         -- empty

    // A "rest" of the program: a SectionSep followed by another Section.
    // Modeled this way so the parse visitor can recover each section's
    // entry offset from its preceding separator.
    ProgRest
      = SectionSep Section

    trailingSpace = (nl | hspace | comment)*

    Section
      = nls* ListOf<Stmt, nls+>

    SectionSep
      = (nls | hspace | comment)* "!" SectionOffset? (nls | hspace | comment)*

    // Optional absolute-time offset on a section separator: !N introduces the next
    // section as a parallel voice entering at time N (measured from t=0). Bare !
    // is equivalent to !0. Fractional offsets allowed (e.g. !1/2). Negative
    // offsets are not currently supported and are rejected at AST construction.
    SectionOffset
      = hspaces? number hspaces? "/" hspaces? number  -- frac
      | hspaces? number                               -- num

    Stmt
      = EvalAssignStmt
      | MacroAssignStmt
      | OpAliasStmt
      | ExprStmt

    // Evaluating assignment - evaluates expr and stores the result (flattened Mot)
    EvalAssignStmt
      = ident ":=" Expr

    // Macro assignment - stores the expression AST for later substitution
    MacroAssignStmt
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
      = FollowedByExpr "," MulExpr   -- fby
      | MulExpr

  // Binary operators at lower precedence than postfix operators
  MulExpr
      = MulExpr ".*" PostfixExpr -- dotStar
      | MulExpr ".^" PostfixExpr -- dotExpand
      | MulExpr ".->" PostfixExpr -- dotSteps
      | MulExpr ".j" PostfixExpr -- dotJam
      | MulExpr ".m" PostfixExpr  -- dotMirror
      | MulExpr ".l" PostfixExpr  -- dotLens
      | MulExpr ".t" PostfixExpr  -- dotTie
      | MulExpr ".c" PostfixExpr  -- dotConstraint
      | MulExpr ".," PostfixExpr  -- dotZip
      | MulExpr ".g" PostfixExpr  -- dotGlass
      | MulExpr ".r" PostfixExpr  -- dotReich
      | MulExpr "->" PostfixExpr  -- steps

      | MulExpr "j" PostfixExpr   -- jam
      | MulExpr "m" PostfixExpr   -- mirror
      | MulExpr "l" PostfixExpr   -- lens
      | MulExpr "c" PostfixExpr   -- constraint
      | MulExpr "g" PostfixExpr   -- glass
      | MulExpr "r" PostfixExpr   -- reich
      | MulExpr "p" PostfixExpr   -- paert
      | MulExpr "f" PostfixExpr   -- fold
      | MulExpr "*" PostfixExpr  -- mul
      | MulExpr "^" PostfixExpr  -- expand
      | MulExpr "." PostfixExpr  -- dot
      | MulExpr "~" PostfixExpr  -- rotate
      | MulExpr ".~" PostfixExpr  -- dotRotate
      | MulExpr ident PostfixExpr -- aliasOp
      | MulExpr "@" PostfixExpr  -- atIndex
      | MulExpr ">" PostfixExpr  -- displace
      | MulExpr "||" PostfixExpr  -- motTimeScale
      | PostfixExpr

  // Postfix operators (tie, repeat, subdivide, zip, drop) at higher precedence than binary operators
  // These apply to their immediate left operand
  PostfixExpr
      = PostfixExpr "/"                          -- subdivide
      | PostfixExpr "z"                          -- zipColumns
      | PostfixExpr "t"                          -- tiePostfix
      | PostfixExpr hspaces? ":" hspaces? RandNum  -- repeatPostRand
      | PostfixExpr hspaces? ":" hspaces? number   -- repeatPost
      | PostfixExpr hspaces? "\\" hspaces? RandNum  -- dropRand
      | PostfixExpr hspaces? "\\" hspaces? number   -- drop
      | PriExpr

  PriExpr
      = globalPlaceholder             -- globalPlaceholder
      | Pip                          -- pipAsMot
      | ident                          -- ref
      | "[[" NestedBody "]]"       -- nestedMot
      | "[" AtIndexList "]"  -- atIndexMot
      | "[" MotBody "]"            -- mot
      | number                        -- numAsMot
      | "(" Expr ")"                  -- parens
      | Curly                           -- curlyAsExpr

  AtIndexList
      = NonemptyListOf<AtIndexEntry, atIndexSep>
  
  atIndexSep = hspaces? "," hspaces?

  AtIndexEntry
      = "@" hspaces? index hspaces? SingleValue

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

  MotBody
      = ListOf<Entry, ",">            -- absolute

    Entry
      = Value hspaces? ":" hspaces? RandNum  -- repeatPip
      | Value hspaces? ":"                    -- padPip
      | Value                                 -- plain

    Value
      = SingleValue

    SingleValue
      = SingleValue hspaces? "&" ~"&" hspaces? DiadValue  -- diad
      | MotLiteral hspaces? "*" hspaces? MotLiteral   -- inlineMulMots
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

    // Values that can appear on the right side of a diad &
    DiadValue
      = Pip
      | Range
      | Curly
      | CurlyPip
      | ident                                   -- refInDiad
      | "(" Expr ")"                            -- exprInDiad

    Range
      = RandNum "->" RandNum      -- inclusive

  Pip
      = Range hspaces? "|" hspaces? TimeScale               -- rangeWithTimeMulPipeImplicit
      | Range hspaces? "|" hspaces? "/" hspaces? RandNum    -- rangeWithTimeDivPipe
      | Range                                                -- rangeNoTimeScale
      | StepValue hspaces? "|" hspaces? TimeScale              -- withTimeMulPipeImplicit
      | StepValue hspaces? "|" hspaces? "*" hspaces? RandNum  -- withTimeMulPipe
      | StepValue hspaces? "|" hspaces? "/" hspaces? RandNum  -- withTimeDivPipe
      | StepValue hspaces? "|"                                  -- withPipeNoTs
      | "|" hspaces? TimeScale                               -- pipeOnlyTs
      | "|" hspaces? "*" hspaces? RandNum                    -- pipeOnlyMul
      | "|" hspaces? "/" hspaces? RandNum                    -- pipeOnlyDiv
      | "|"                                                 -- pipeBare
      | StepValue                                            -- noTimeScale
      | Special hspaces? "|" hspaces? TimeScale             -- specialWithTimeMulPipeImplicit
      | Special hspaces? "|" hspaces? "*" hspaces? RandNum -- specialWithTimeMulPipe
      | Special hspaces? "|" hspaces? "/" hspaces? RandNum -- specialWithTimeDivPipe
      | Special                                              -- special
      | Curly hspaces? "|" hspaces? TimeScale               -- curlyWithTimeMulPipeImplicit
      | Curly hspaces? "|" hspaces? "*" hspaces? RandNum    -- curlyWithTimeMulPipe
      | Curly hspaces? "|" hspaces? "/" hspaces? RandNum    -- curlyWithTimeDivPipe
      | CurlyPip hspaces? "|" hspaces? TimeScale            -- curlyPipWithTimeMulPipeImplicit
      | CurlyPip hspaces? "|" hspaces? "*" hspaces? RandNum -- curlyPipWithTimeMulPipe
      | CurlyPip hspaces? "|" hspaces? "/" hspaces? RandNum -- curlyPipWithTimeDivPipe

    StepValue
      = number hspaces? "/" hspaces? number  -- frac
      | PlainNumber                          -- plain
      | ArithExpr                            -- arith

    RandNum
      = Curly
      | ParenArithExpr
      | MemberAccess
      | number

    // Parenthesized arithmetic expressions for use in numeric contexts
    // Require parens to avoid ambiguity with other uses of operators
    ParenArithExpr
      = "(" hspaces? ArithExpr hspaces? ")"

    ArithExpr
      = ArithExpr hspaces? "+" hspaces? ArithMulExpr  -- add
      | ArithExpr hspaces? "-" hspaces? ArithMulExpr  -- sub
      | ArithMulExpr

    ArithMulExpr
      = ArithMulExpr hspaces? "*" hspaces? ArithPrimary  -- mul
      | ArithMulExpr hspaces? "/" hspaces? ArithPrimary  -- div
      | ArithPrimary

    ArithPrimary
      = "(" hspaces? ArithExpr hspaces? ")"  -- parens
      | MemberAccess
      | number

  // Curly-of-pips: choose one full pip-like value (number/special/pipe forms/etc.)
  CurlyPip
      = "{" ListOf<Pip, ","> "}" Seed?
    Curly
      = "{" CurlyBody "}" Seed?
    CurlyBody
      = ListOf<CurlyEntry, ",">              -- list
    CurlyEntry
      = Range  -- range
      | number "/" number  -- frac
      | number  -- num
      | MemberAccess  -- member
      | ident   -- ref

    MemberAccess
      = ident "." ident  -- prop

    Seed = "$" SeedChars
    SeedChars = seedChar+
    seedChar = letter | digit | "_"

    TimeScale
      = RandNum "/" RandNum  -- frac
      | RandNum               -- plain

    Special
      = specialChar

    // Special characters only match when NOT followed by alphanumeric
    // This allows identifiers like 'rr', 'rest', 'rhythm' to work
    specialChar
      = "r" ~alnum

    globalPlaceholder = "_" ~(alnum | "_")

    ident = (letter | "_") (alnum | "_")+  -- withChars
          | letter                             -- single

    // Set of binary operator symbols that can be aliased
    OpSym
      = ".*" | ".^" | ".->" | ".j" | ".m" | ".l" | ".t" | ".c" | ".," | ".g" | ".r"
      | "->" | "||" | ">" | "j" | "m" | "l" | "c" | "g" | "r" | "p" | "f" | "*" | "^" | "." | "~" | "@"

    number
      = sign? digit+ ("." digit+)?
      | sign? digit* "." digit+

    // Prevent bare number from capturing the start of a range
    PlainNumber
      = number ~ (hspaces? "->")

    sign = "+" | "-"

    // Index for [@index value] notation (lexical rule - no space skipping)
    index = sign? digit+

    hspace = " " | "\t"
    hspaces = hspace+

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
const golden = globalThis.golden || {};
globalThis.golden = golden;


golden._crux_uuid_cnt = 1;
golden.getCruxUUID = function() {
  return '' + golden._crux_uuid_cnt++;
}


// Grammar is now imported from grammar.js

// Helper to wrap primitive values for arithmetic expressions
function wrapArithNode(node) {
  if (typeof node === 'number') {
    return new ArithNumber(node);
  }
  return node;
}

let _hasGlobalPlaceholder = false;

const s = g.createSemantics().addOperation('parse', {
  Prog_empty(_leadingNls, _trailingNls) {
    return new Prog([], []);
  },

  Prog_withContent(_leadingNls, firstSection, rests, _trailingNls) {
    const sections = [firstSection.parse()];
    const offsets = [0];
    for (const r of rests.children) {
      const { offset, stmts } = r.parse();
      sections.push(stmts);
      offsets.push(offset);
    }
    return new Prog(sections, offsets);
  },

  ProgRest(sep, section) {
    return { offset: sep.parse(), stmts: section.parse() };
  },

  SectionSep(_pre, _bang, offsetOpt, _post) {
    // offsetOpt is an iteration of zero or one SectionOffset
    if (offsetOpt.numChildren === 0) return 0;
    return offsetOpt.child(0).parse();
  },

  SectionOffset_num(_h, num) {
    const n = Number(num.sourceString);
    if (!Number.isFinite(n) || n < 0) {
      throw new Error(`Section offset must be a non-negative finite number, got ${num.sourceString}`);
    }
    return n;
  },

  SectionOffset_frac(_h1, num, _h2, _slash, _h3, denom) {
    const a = Number(num.sourceString);
    const b = Number(denom.sourceString);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b <= 0) {
      throw new Error(`Section offset must be a non-negative finite number, got ${num.sourceString}/${denom.sourceString}`);
    }
    return a / b;
  },

  Section(_leadingNls, stmts) {
    return stmts.parse();
  },

  EvalAssignStmt(name, _colonEquals, expr) {
    return new EvalAssign(name.sourceString, expr.parse());
  },

  MacroAssignStmt(name, _equals, expr) {
    return new MacroAssign(name.sourceString, expr.parse());
  },

  OpAliasStmt(name, _equals, op) {
    return new OpAliasAssign(name.sourceString, op.parse());
  },

  ExprStmt(expr) {
    _hasGlobalPlaceholder = false;
    const parsed = expr.parse();
    if (_hasGlobalPlaceholder) {
      _hasGlobalPlaceholder = false;
      return new GlobalOpStmt(parsed);
    }
    return parsed;
  },

  FollowedByExpr_fby(x, _comma, y) {
    return new FollowedBy(x.parse(), y.parse());
  },

  PostfixExpr_drop(expr, _h1, _backslash, _h2, n) {
    return new DropTransform(expr.parse(), Number(n.sourceString));
  },

  PostfixExpr_dropRand(expr, _h1, _backslash, _h2, rn) {
    return new DropTransform(expr.parse(), rn.parse());
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

  MulExpr_fold(x, _f, y) {
    return new FoldOp(x.parse(), y.parse());
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

  MulExpr_atIndex(x, _at, y) {
    return new AtIndexOp(x.parse(), y.parse());
  },

  MulExpr_displace(x, _gt, y) {
    return new DisplaceOp(x.parse(), y.parse());
  },

  MulExpr_motTimeScale(x, _doublePipe, y) {
    return new MotTimeScaleOp(x.parse(), y.parse());
  },

  PriExpr_globalPlaceholder(_underscore) {
    _hasGlobalPlaceholder = true;
    return new GlobalPlaceholder();
  },
  PriExpr_ref(name) {
    return new Ref(name.sourceString, name.source.startIdx);
  },
  PriExpr_pipAsMot(pip) {
    return new Mot([pip.parse()]);
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

  PriExpr_atIndexMot(_openBracket, atIndexList, _closeBracket) {
    // Returns an AtIndexMot containing the list of {index, value} entries
    const entries = atIndexList.parse();
    return new AtIndexMot(entries);
  },

  AtIndexList(list) {
    return list.parse();
  },

  AtIndexEntry(_at, _h1, indexNode, _h2, valueNode) {
    const index = indexNode.parse();
    const value = valueNode.parse();
    
    // Wrap nested deep like PriExpr_mot does to handle Mot literals as nested subdivisions
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
    
    return { index, value: wrapNestedDeep(value) };
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
  
  

  Entry_repeatPip(value, _h1, _colon, _h2, count) {
    // Pip-level repetition: [0: 3] or [0|/2 : 4]
    return new RepeatPip(value.parse(), count.parse());
  },

  Entry_padPip(value, _h1, _colon) {
    // Padding marker: [0, 1:]
    return new PadValue(value.parse());
  },

  Entry_plain(value) {
    return value.parse();
  },


  SingleValue(x) {
    return x.parse();
  },
  SingleValue_diad(left, _h1, _amp, _h2, right) {
    return new DiadOp(left.parse(), right.parse());
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
    const ref = new Ref(name.sourceString, name.source.startIdx);
    const rhs = motNode.parse(); // Mot
    return new NestedMotExpr(new Mul(ref, rhs));
  },
  SingleValue_refInMot(name) {
    // Treat bare identifier inside a Mot as a nested subdivision of the referenced motif
    return new NestedMotExpr(new Ref(name.sourceString, name.source.startIdx));
  },
  SingleValue_exprInMot(_op, expr, _cp) {
    // Parenthesized expression inside Mot; subdivide its evaluated Mot
    return new NestedMotExpr(expr.parse());
  },
  DiadValue_refInDiad(name) {
    return new NestedMotExpr(new Ref(name.sourceString, name.source.startIdx));
  },
  DiadValue_exprInDiad(_op, expr, _cp) {
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

  Seed(_sigil, chars) {
    return stringToSeed(chars.sourceString);
  },

  CurlyBody_list(entries) {
    const items = entries.parse();
    // If single RandomRange entry, return it directly
    if (items.length === 1 && items[0] instanceof RandomRange) {
      return items[0];
    }
    const allNumLits = items.every(x => x && typeof x === 'object' && x.__kind === 'numLit');
    const allRefs = items.every(x => x instanceof Ref);
    const allMemberAccess = items.every(x => x instanceof MemberAccess);
    if (allNumLits) {
      const positions = items.map(x => x.pos);
      const options = items.map(x => x.value);
      return new RandomChoice(options, positions);
    }
    if (allRefs) return new RandomRefChoice(items);
    if (allMemberAccess) return new RandomMemberChoice(items);
    // Backward-compat: plain numbers (without position data)
    const allNums = items.every(x => typeof x === 'number');
    if (allNums) return new RandomChoice(items);
    throw new Error('Curly list must be all numbers or all identifiers');
  },

  CurlyEntry_range(range) {
    // Parse the range (e.g., -2 -> 2) and convert to RandomRange
    const r = range.parse(); // returns a Range object
    // Convert Range to RandomRange for random selection
    return new RandomRange(r.start, r.end, r.startPos, r.endPos);
  },

  CurlyEntry_num(n) {
    return { __kind: 'numLit', value: n.parse(), pos: n.source.startIdx };
  },

  CurlyEntry_frac(n, _slash, d) {
    const num = n.parse();
    const den = d.parse();
    return { __kind: 'numLit', value: num / den, pos: n.source.startIdx };
  },

  CurlyEntry_ref(name) {
    return new Ref(name.sourceString, name.source.startIdx);
  },

  CurlyEntry_member(ma) {
    return ma.parse();
  },

  MemberAccess_prop(obj, _dot, prop) {
    return new MemberAccess(obj.sourceString, prop.sourceString);
  },

  // Parenthesized arithmetic expression
  ParenArithExpr(_openParen, _h1, expr, _h2, _closeParen) {
    return expr.parse();
  },

  // Arithmetic operations
  ArithExpr_add(left, _h1, _plus, _h2, right) {
    return new ArithAdd(wrapArithNode(left.parse()), wrapArithNode(right.parse()));
  },

  ArithExpr_sub(left, _h1, _minus, _h2, right) {
    return new ArithSub(wrapArithNode(left.parse()), wrapArithNode(right.parse()));
  },

  ArithMulExpr_mul(left, _h1, _star, _h2, right) {
    return new ArithMul(wrapArithNode(left.parse()), wrapArithNode(right.parse()));
  },

  ArithMulExpr_div(left, _h1, _slash, _h2, right) {
    return new ArithDiv(wrapArithNode(left.parse()), wrapArithNode(right.parse()));
  },

  ArithPrimary_parens(_openParen, _h1, expr, _h2, _closeParen) {
    return expr.parse();
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

  index(_sign, _digits) {
    return parseInt(this.sourceString, 10);
  },

  number(_sign, _wholeDigits, _point, _fracDigits) {
    return parseFloat(this.sourceString);
  },

  Pip_noTimeScale(n) {
    return new Pip(n.parse(), 1, null, n.source.startIdx);
  },

  Pip_special(sym) {
    return new Pip(0, 1, sym.sourceString, sym.source.startIdx);
  },

  Pip_specialWithTimeMulPipe(sym, _h1, _pipe, _h2, _star, _h3, m) {
    return new Pip(0, m.parse(), sym.sourceString, sym.source.startIdx);
  },

  Pip_specialWithTimeDivPipe(sym, _h1, _pipe, _h2, _slash, _h3, d) {
    const divisor = d.parse();
    // If divisor is a random choice/range, create fractional timescale object
    if (divisor instanceof RandomRange || divisor instanceof RandomChoice) {
      return new Pip(0, { _frac: true, num: 1, den: divisor }, sym.sourceString, sym.source.startIdx);
    }
    return new Pip(0, 1 / divisor, sym.sourceString, sym.source.startIdx);
  },

  Pip_withTimeMulPipe(n, _h1, _pipe, _h2, _star, _h3, m) {
    return new Pip(n.parse(), m.parse(), null, n.source.startIdx);
  },

  Pip_withTimeDivPipe(n, _h1, _pipe, _h2, _slash, _h3, d) {
    const divisor = d.parse();
    // If divisor is a random choice/range, create fractional timescale object
    if (divisor instanceof RandomRange || divisor instanceof RandomChoice) {
      return new Pip(n.parse(), { _frac: true, num: 1, den: divisor }, null, n.source.startIdx);
    }
    return new Pip(n.parse(), 1 / divisor, null, n.source.startIdx);
  },

  StepValue_arith(expr) {
    return expr.parse();
  },
  StepValue_frac(n, _h1, _slash, _h2, d) {
    return n.parse() / d.parse();
  },
  StepValue_plain(n) {
    return n.parse();
  },

  Pip_withTimeMulPipeImplicit(n, _h1, _pipe, _h2, ts) {
    return new Pip(n.parse(), ts.parse(), null, n.source.startIdx);
  },

  Pip_withPipeNoTs(n, _h1, _pipe) {
    const p = new Pip(n.parse(), 1, null, _pipe.source.startIdx);
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
    const divisor = d.parse();
    let ts;
    // If divisor is a random choice/range, create fractional timescale object
    if (divisor instanceof RandomRange || divisor instanceof RandomChoice) {
      ts = { _frac: true, num: 1, den: divisor };
    } else {
      ts = 1 / divisor;
    }
    const p = new Pip(0, ts, null, _pipe.source.startIdx);
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

  Pip_rangeNoTimeScale(range) {
    return range.parse();
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
    // If either is a RandNum, MemberAccess, or ArithExpr, return a special object for later resolution
    if (num instanceof RandomRange || num instanceof RandomChoice || num instanceof MemberAccess ||
        num instanceof ArithAdd || num instanceof ArithSub || num instanceof ArithMul || num instanceof ArithDiv ||
        den instanceof RandomRange || den instanceof RandomChoice || den instanceof MemberAccess ||
        den instanceof ArithAdd || den instanceof ArithSub || den instanceof ArithMul || den instanceof ArithDiv) {
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
  Prog_empty(_leadingNls, _trailingNls) {
    return [];
  },
  Prog_withContent(_leadingNls, firstSection, rests, _trailingNls) {
    const out = [];
    const first = firstSection.collectRepeatSuffixRewrites();
    if (Array.isArray(first)) out.push(...first);
    for (const r of rests.children) {
      const v = r.collectRepeatSuffixRewrites();
      if (Array.isArray(v)) out.push(...v);
    }
    return out;
  },
  ProgRest(_sep, section) { return section.collectRepeatSuffixRewrites(); },
  SectionSep(_pre, _bang, _offsetOpt, _post) { return []; },
  Section(_leadingNls, stmts) {
    const out = [];
    for (const s of stmts.children) {
      const v = s.collectRepeatSuffixRewrites();
      if (Array.isArray(v)) out.push(...v);
    }
    return out;
  },
  Stmt(node) { return node.collectRepeatSuffixRewrites(); },
  OpAliasStmt(_name, _eq, _op) { return []; },
  EvalAssignStmt(_name, _eq, expr) { return expr.collectRepeatSuffixRewrites(); },
  MacroAssignStmt(_name, _eq, expr) { return expr.collectRepeatSuffixRewrites(); },
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
  MulExpr_fold(x, _op, y) { return [...x.collectRepeatSuffixRewrites(), ...y.collectRepeatSuffixRewrites()]; },
  MulExpr_aliasOp(x, _name, y) { return [...x.collectRepeatSuffixRewrites(), ...y.collectRepeatSuffixRewrites()]; },
  MulExpr_atIndex(x, _op, y) { return [...x.collectRepeatSuffixRewrites(), ...y.collectRepeatSuffixRewrites()]; },
  PostfixExpr_subdivide(x, _slash) { return x.collectRepeatSuffixRewrites(); },
  PostfixExpr_zipColumns(x, _z) { return x.collectRepeatSuffixRewrites(); },
  PostfixExpr_tiePostfix(x, _t) { return x.collectRepeatSuffixRewrites(); },
  PostfixExpr_drop(x, _h1, _bs, _h2, _n) { return x.collectRepeatSuffixRewrites(); },
  PostfixExpr_dropRand(x, _h1, _bs, _h2, _rn) { return x.collectRepeatSuffixRewrites(); },
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
  Prog_empty(_leadingNls, _trailingNls) {
    return [];
  },
  Prog_withContent(_leadingNls, firstSection, rests, _trailingNls) {
    const out = [];
    const first = firstSection.collectTs();
    if (Array.isArray(first)) out.push(...first);
    for (const r of rests.children) {
      const v = r.collectTs();
      if (Array.isArray(v)) out.push(...v);
    }
    return out;
  },
  ProgRest(_sep, section) { return section.collectTs(); },
  SectionSep(_pre, _bang, _offsetOpt, _post) { return []; },
  Section(_leadingNls, stmts) {
    const out = [];
    for (const s of stmts.children) {
      const v = s.collectTs();
      if (Array.isArray(v)) out.push(...v);
    }
    return out;
  },
  Stmt(node) { return node.collectTs(); },
  OpAliasStmt(_name, _eq, _op) { return []; },
  EvalAssignStmt(_name, _eq, expr) { return expr.collectTs(); },
  MacroAssignStmt(_name, _eq, expr) { return expr.collectTs(); },
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
  MulExpr_fold(x, _op, y) { return [...x.collectTs(), ...y.collectTs()]; },
  MulExpr_aliasOp(x, _name, y) { return [...x.collectTs(), ...y.collectTs()]; },
  MulExpr_atIndex(x, _op, y) { return [...x.collectTs(), ...y.collectTs()]; },
  PostfixExpr_subdivide(x, _slash) { return x.collectTs(); },
  PostfixExpr_zipColumns(x, _z) { return x.collectTs(); },
  PostfixExpr_tiePostfix(x, _t) { return x.collectTs(); },
  PostfixExpr_repeatPost(expr, _h1, _colon, _h2, _n) { return expr.collectTs(); },
  PostfixExpr_repeatPostRand(expr, _h1, _colon, _h2, rn) { return [...expr.collectTs(), ...rn.collectTs()]; },
  PostfixExpr_drop(x, _h1, _bs, _h2, _n) { return x.collectTs(); },
  PostfixExpr_dropRand(x, _h1, _bs, _h2, rn) { return [...x.collectTs(), ...rn.collectTs()]; },
  PriExpr_globalPlaceholder(_underscore) { return []; },
  PriExpr_ref(_name) { return []; },
  PriExpr_mot(_ob, body, _cb) { return body.collectTs(); },
  PriExpr_atIndexMot(_ob, atIndexList, _cb) { return atIndexList.collectTs(); },
  AtIndexList(list) { return list.collectTs(); },
  AtIndexEntry(_at, _h1, _idx, _h2, value) { return value.collectTs(); },
  PriExpr_nestedMot(_ob, body, _cb) { return body.collectTs(); },
  NestedBody_nestedAbsolute(values) { return values.collectTs(); },
  PriExpr_parens(_op, e, _cp) { return e.collectTs(); },
  MotBody_absolute(values) { return values.collectTs(); },

  MotLiteral(_ob, body, _cb) { return body.collectTs(); },
  NestedMotLiteral(_ob, body, _cb) { return body.collectTs(); },
  NestedMotAbbrev(_ob, body, _cb) { return body.collectTs(); },

  // NestedElem variants
  NestedElem_motSubdivide(mot, _slash) { return mot.collectTs(); },
  NestedElem_nestedSubdivide(nested, _slash) { return nested.collectTs(); },
  NestedElem_single(value) { return value.collectTs(); },
  NestedElem_mot(mot) { return mot.collectTs(); },
  NestedElem_nested(nested) { return nested.collectTs(); },

  SingleValue(x) { return x.collectTs(); },
  SingleValue_diad(left, _h1, _amp, _h2, right) { return [...left.collectTs(), ...right.collectTs()]; },
  SingleValue_motSubdivide(node, _slash) { return node.collectTs(); },
  SingleValue_nestedSubdivide(nested, _slash) { return nested.collectTs(); },
  SingleValue_inlineMulMots(mot1, _h1, _star, _h2, mot2) { return [...mot1.collectTs(), ...mot2.collectTs()]; },
  SingleValue_inlineMulRefMot(_ref, _h1, _star, _h2, mot) { return mot.collectTs(); },
  SingleValue_exprInMot(_op, expr, _cp) { return expr.collectTs(); },
  SingleValue_refInMot(_ref) { return []; },
  DiadValue_refInDiad(_ref) { return []; },
  DiadValue_exprInDiad(_op, expr, _cp) { return expr.collectTs(); },

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
  Pip_rangeNoTimeScale(_range) { return []; },

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
  CurlyEntry_range(range) { return range.collectTs(); },
  CurlyEntry_num(n) { return [n.source.startIdx]; },
  CurlyEntry_frac(n, _slash, _d) { return [n.source.startIdx]; },
  CurlyEntry_ref(_name) { return []; },
  // Curly-of-pips: collect timescale indices from each contained pip
  CurlyPip(_o, list, _c, _seedOpt) { return list.collectTs(); },

  // Entry with repetition or padding
  Entry_repeatPip(value, _h1, _colon, _h2, count) {
    return [...value.collectTs(), ...count.collectTs()];
  },
  Entry_padPip(value, _h1, _colon) { return value.collectTs(); },
  Entry_plain(value) { return value.collectTs(); },

  number(_sign, _wholeDigits, _point, _fracDigits) { return []; },
  ident_withChars(_first, _rest) { return []; },
  ident_single(_letter) { return []; },
});

// Helper: Get the final statement's root AST and environment
function getFinalRootAstAndEnv(prog, seedEnv) {
  // Seed with global bindings so the stats walk (pip_depth/leaves) for a source
  // that references globals doesn't trip on an "undeclared" lookup. A MacroBinding
  // carries the raw expr AST that the height/leaf walkers expect.
  const env = new Map();
  if (seedEnv) for (const [k, v] of seedEnv) env.set(k, v instanceof MacroBinding ? v.expr : v);
  let last = null;

  // Process all sections to build up the environment
  for (const stmts of prog.sections) {
    for (const stmt of stmts) {
      if (stmt instanceof GlobalOpStmt) continue;
      last = stmt;
      if (stmt instanceof EvalAssign || stmt instanceof MacroAssign) {
        env.set(stmt.name, stmt.expr);
      }
    }
  }

  const root = (last instanceof EvalAssign || last instanceof MacroAssign) ? last.expr : last;
  return { root, env };
}

class Prog {
  constructor(sections, offsets) {
    this.sections = sections; // array of arrays of statements (one entry per voice)
    // Parallel array of voice entry offsets, in absolute time. offsets[0] is
    // always 0 (first voice anchors the arrangement at t=0). Each subsequent
    // entry corresponds to the !N value that precedes its section. Bare !
    // produces an offset of 0 (simultaneous entry).
    this.offsets = Array.isArray(offsets) ? offsets : sections.map(() => 0);
  }

  interp(seedEnv) {
    // seedEnv (optional): bindings supplied by the host, e.g. the globals another
    // program defined (see golden.crux_env). Copied, so this program's own
    // assignments overlay locally and the caller's map is not changed.
    const env = seedEnv ? new Map(seedEnv) : new Map();
    const sections = [];
    const sectionOffsets = [];
    const globalOps = [];

    for (let secIdx = 0; secIdx < this.sections.length; secIdx++) {
      const stmts = this.sections[secIdx];
      const offset = this.offsets[secIdx] || 0;
      let lastValue = new Mot([]);
      let hasNonGlobalStmt = false;
      for (const stmt of stmts) {
        const result = stmt.eval(env);
        if (result instanceof GlobalOpMarker) {
          globalOps.push(result);
          continue;
        }
        lastValue = result;
        hasNonGlobalStmt = true;
      }

      if (!hasNonGlobalStmt) continue;

      sections.push(lastValue);
      sectionOffsets.push(offset);
    }

    for (const { expr } of globalOps) {
      for (let i = 0; i < sections.length; i++) {
        env.set('__globalPlaceholder__', sections[i]);
        sections[i] = expr.eval(env);
      }
    }
    env.delete('__globalPlaceholder__');

    // Prepend a leading rest to each voice that has a positive entry offset.
    // This places the voice at absolute time N in the arrangement timeline by
    // consuming N units of silence at the head of the voice mot. Done after
    // global ops so the offset never gets transformed by them.
    for (let i = 0; i < sections.length; i++) {
      const offset = sectionOffsets[i] || 0;
      if (offset > 0 && sections[i] && Array.isArray(sections[i].values)) {
        const restPip = new Pip(0, offset, 'r');
        sections[i] = new Mot([restPip, ...sections[i].values]);
      }
    }

    // Compute program info for the final statement. With a seedEnv this is
    // best-effort: a seeded binding of an unexpected shape must not sink the
    // sections already computed, so the stats fall back to 0. Without a seedEnv
    // an error here is thrown, as before.
    let pip_depth = 0;
    let leaves = [];
    try {
      const { root, env: finalEnv } = getFinalRootAstAndEnv(this, seedEnv);
      pip_depth = golden.computeExprHeight(root, finalEnv);
      leaves = golden.collectMotLeavesWithDepth(root, finalEnv);
    } catch (e) {
      if (!seedEnv) throw e;
      pip_depth = 0;
      leaves = [];
    }

    let pip_count = 0;
    for (const { mot } of leaves) {
      pip_count += mot.values.length;
    }

    // For duration, find the largest duration across all sections
    let duration = 0;
    for (const mot of sections) {
      if (mot && mot.values) {
        let sectionDuration = 0;
        for (const pip of mot.values) {
          sectionDuration += pip.timeScale;
        }
        duration = Math.max(duration, sectionDuration);
      }
    }

    return {
      sections,
      pip_count,
      pip_depth,
      duration,
      quanta_count: duration,
    };
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

// Evaluating assignment (:=) - evaluates expr and stores the result (flattened Mot)
class EvalAssign {
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

// Macro assignment (=) - stores the expression AST for later substitution
// When referenced, the stored expression is evaluated in the current context
class MacroAssign {
  constructor(name, expr) {
    this.name = name;
    this.expr = expr;
  }

  eval(env) {
    // Store the expression AST itself (wrapped to distinguish from evaluated values)
    env.set(this.name, new MacroBinding(this.expr));
    // Evaluate once to return the "preview" value, but don't store that
    return this.expr.eval(env);
  }
}

// Wrapper to distinguish macro bindings from evaluated Mot values
class MacroBinding {
  constructor(expr) {
    this.expr = expr;
  }
}

// Helper to dereference a macro binding - returns the stored AST if the node is a Ref to a macro
// This allows operators to introspect their operands' AST structure for macro bindings
function derefMacro(ast, env) {
  if (ast instanceof Ref && env.has(ast.name)) {
    const binding = env.get(ast.name);
    if (binding instanceof MacroBinding) {
      return binding.expr;
    }
  }
  return ast;
}

class GlobalPlaceholder {
  eval(env) {
    if (env.has('__globalPlaceholder__')) {
      return env.get('__globalPlaceholder__');
    }
    throw new Error('_ placeholder used outside of a global operation');
  }
}

class GlobalOpStmt {
  constructor(expr) {
    this.expr = expr;
  }
  eval(_env) {
    return new GlobalOpMarker(this.expr);
  }
}

class GlobalOpMarker {
  constructor(expr) {
    this.expr = expr;
  }
}

class FollowedBy {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  eval(env) {
    const left = this.x.eval(env);
    const right = this.y.eval(env);

    const xv = requireMot(left);
    const yv = requireMot(right);
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
    const count = resolveRandNumToNumber(this.randSpec, rng, env);
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

    // Dereference macro bindings to get the underlying AST for introspection
    const yAst = derefMacro(this.y, env);

    // Handle bare NestedMot on RHS (e.g., [[0,0]])
    if (yAst instanceof NestedMot || yAst instanceof NestedMotExpr) {
      const m = requireMot(yAst.eval(env));
      const pairs = [];
      for (const v of m.values) {
        if (v instanceof Pip) pairs.push({ d: v.step, ts: v.timeScale, tag: v.tag ?? null });
      }
      rhsMask = [{ kind: 'subdiv', pairs }];
    } else if (yAst instanceof Mot) {
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
    const n = left.values.length;
    if (n === 0) return new Mot([]);

    // Per-element circular indexing: each position i gets rotated by right[i].step
    for (let i = 0; i < n; i++) {
      const r = right.values[i % right.values.length];
      const k = Math.trunc(r.step);
      // Pick element at position (i + k) mod n, circularly
      const idx = ((i + k) % n + n) % n;
      out.push(left.values[idx]);
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
    case 'f': return new FoldOp(x, y);
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
    // Interleave up to LHS length, cycling RHS if needed
    const len = left.values.length;

    for (let i = 0; i < len; i++) {
      out.push(left.values[i]);
      if (right.values.length > 0) {
        out.push(right.values[i % right.values.length]);
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

// Fold: concatenate mot with its reverse, transposed by RHS step
// [0,1,2] f [0] → [0,1,2,2,1,0]
// [4,5,6] f [2] → [4,5,6,8,7,6]
class FoldOp {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  eval(env) {
    const left = requireMot(this.x.eval(env));
    const right = requireMot(this.y.eval(env));
    const out = [...left.values];

    for (const r of right.values) {
      const reversed = [...left.values].reverse();
      for (const p of reversed) {
        out.push(new Pip(p.step + r.step, p.timeScale * r.timeScale, p.tag));
      }
    }

    return new Mot(out);
  }
}

// Displace: prepend rest(s) to shift a mot forward in time
// [0,1,2] > [1] → [r, 0, 1, 2]  (displaced by 1 unit)
// [0,1,2] > [1/2] → [r | /2, 0, 1, 2]  (displaced by half a unit)
// [0,1,2] > [2] → [r | 2, 0, 1, 2]  (displaced by 2 units)
// Negative displacement removes time from the front (anticipation)
// [0,1,2] > [-1] → [1, 2]  (first pip dropped, like arriving early)
class DisplaceOp {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  eval(env) {
    const left = requireMot(this.x.eval(env));
    const right = requireMot(this.y.eval(env));

    if (right.values.length === 0) return left;

    // Sum all RHS pip steps to get total displacement amount
    // Use the first pip's step as the displacement value
    const dispPip = right.values[0];
    const amount = dispPip.step;

    if (amount === 0) return left;

    if (amount > 0) {
      // Positive: prepend a rest with timeScale = amount
      const restPip = new Pip(0, amount, 'r');
      return new Mot([restPip, ...left.values]);
    } else {
      // Negative: anticipation — trim from front by |amount| time units
      const trimAmount = Math.abs(amount);
      let trimmed = 0;
      let startIdx = 0;
      const values = left.values;

      for (let i = 0; i < values.length; i++) {
        const pipDur = values[i].timeScale;
        if (trimmed + pipDur <= trimAmount) {
          trimmed += pipDur;
          startIdx = i + 1;
        } else if (trimmed < trimAmount) {
          // Partial trim of this pip
          const remaining = pipDur - (trimAmount - trimmed);
          const partialPip = new Pip(values[i].step, remaining, values[i].tag);
          return new Mot([partialPip, ...values.slice(i + 1)]);
        } else {
          break;
        }
      }

      if (startIdx >= values.length) return new Mot([]);
      return new Mot(values.slice(startIdx));
    }
  }
}

// MotTimeScale: scale all pip timeScales in a mot by a factor
// [0,1,2] || [2] → [0 | 2, 1 | 2, 2 | 2]  (all durations doubled)
// [0,1,2] || [1/2] → [0 | /2, 1 | /2, 2 | /2]  (all durations halved)
class MotTimeScaleOp {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  eval(env) {
    const left = requireMot(this.x.eval(env));
    const right = requireMot(this.y.eval(env));

    if (right.values.length === 0) return left;

    // Use first pip's step as the scale factor (treating it as a multiplier)
    // If step is 0, use the timeScale from the pip (for pipe-only entries like [|2])
    const factorPip = right.values[0];
    let factor;
    if (factorPip.step === 0 && factorPip.timeScale !== 1) {
      // Pipe-only form: [|2] or [|/3] — use the timeScale directly as the factor
      factor = factorPip.timeScale;
    } else {
      factor = factorPip.step;
    }

    if (factor === 0) return left;
    if (factor === 1) return left;

    const out = left.values.map(pip =>
      new Pip(pip.step, pip.timeScale * factor, pip.tag)
    );
    return new Mot(out);
  }
}

// DiadOp: the & operator for pip-level chords within a mot
// [0 & 4, 2 & 5] creates pips with multiple simultaneous steps
class DiadOp {
  constructor(left, right) {
    this.left = left;   // left value (Pip, Mot, etc.)
    this.right = right; // right value (Pip, Mot, etc.)
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
    if (mot.values.length === 0) return new Mot([]);
    // Normalize by total duration (sum of timeScales), not element count, so the
    // mot occupies unit time even when pips carry non-unit timescales.
    const total = subdivideTotalDuration(mot.values);
    if (total === 0) return new Mot([]);
    const factor = 1 / total;
    const out = mot.values.map(pip => new Pip(pip.step, pip.timeScale * factor, pip.tag));
    return new Mot(out);
  }
}

// Total duration of a value list: a Pip contributes its timeScale, any other
// element (e.g. a nested mot) contributes one unit. Used by the trailing `/`
// subdivide so normalization is by occupied time, not element count.
function subdivideTotalDuration(values) {
  return values.reduce((s, v) => s + (v instanceof Pip ? v.timeScale : 1), 0);
}

// Helper function to subdivide a Mot or NestedMot directly
function subdivide(motOrNested) {
  if (motOrNested instanceof Mot) {
    if (motOrNested.values.length === 0) return new Mot([]);
    const total = subdivideTotalDuration(motOrNested.values);
    if (total === 0) return new Mot([]);
    const factor = 1 / total;
    const out = motOrNested.values.map(pip => {
      if (pip instanceof Pip) {
        return new Pip(pip.step, pip.timeScale * factor, pip.tag);
      }
      return pip;
    });
    return new Mot(out);
  }
  if (motOrNested instanceof NestedMot) {
    if (motOrNested.values.length === 0) return new NestedMot([]);
    const total = subdivideTotalDuration(motOrNested.values);
    if (total === 0) return new NestedMot([]);
    const factor = 1 / total;
    const out = motOrNested.values.map(v => {
      if (v instanceof Pip) {
        return new Pip(v.step, v.timeScale * factor, v.tag);
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
      // keep when r.step != 0
      const omit = r.step === 0;
      if (!omit) {
        out.push(new Pip(a.step, a.timeScale * r.timeScale, a.tag));
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
  constructor(name, pos = null) {
    this.name = name;
    this.pos = pos; // source offset of the name (used by crux_trace)
  }

  eval(env) {
    if (!env.has(this.name)) {
      throw new Error('undeclared identifier: ' + this.name);
    }
    const binding = env.get(this.name);
    // If it's a macro binding, evaluate the stored expression
    if (binding instanceof MacroBinding) {
      return binding.expr.eval(env);
    }
    return binding;
  }
}

class MemberAccess {
  constructor(objName, propName) {
    this.objName = objName;
    this.propName = propName;
  }

  eval(env) {
    if (!env.has(this.objName)) {
      throw new Error('undeclared identifier: ' + this.objName);
    }
    let obj = env.get(this.objName);

    // Handle MacroBinding - evaluate the stored expression first
    if (obj instanceof MacroBinding) {
      obj = obj.expr.eval(env);
    }

    // Handle .length property
    if (this.propName === 'length') {
      // If it's a Mot, return the number of pips after evaluation
      if (obj instanceof Mot) {
        const evaluated = obj.eval(env);
        return evaluated.values.length;
      }
      throw new Error(`Property 'length' not supported on ${this.objName}`);
    }

    throw new Error(`Unknown property: ${this.propName}`);
  }
}

// Arithmetic expression nodes
class ArithAdd {
  constructor(left, right) {
    this.left = left;
    this.right = right;
  }
  eval(env) {
    return this.left.eval(env) + this.right.eval(env);
  }
}

class ArithSub {
  constructor(left, right) {
    this.left = left;
    this.right = right;
  }
  eval(env) {
    return this.left.eval(env) - this.right.eval(env);
  }
}

class ArithMul {
  constructor(left, right) {
    this.left = left;
    this.right = right;
  }
  eval(env) {
    return this.left.eval(env) * this.right.eval(env);
  }
}

class ArithDiv {
  constructor(left, right) {
    this.left = left;
    this.right = right;
  }
  eval(env) {
    const denominator = this.right.eval(env);
    if (denominator === 0) throw new Error('Division by zero');
    return this.left.eval(env) / denominator;
  }
}

class ArithNumber {
  constructor(value) {
    this.value = value;
  }
  eval(env) {
    return this.value;
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
  expandToPips(rng = Math.random, env = null) {
    const result = [];
    const start = resolveRandNumToNumber(this.start, rng, env);
    const end = resolveRandNumToNumber(this.end, rng, env);
    const step = start <= end ? 1 : -1;
    // Use startPos for all pips in the range (they're generated from this source location)
    const pos = this.startPos;
    for (let n = start; step > 0 ? n <= end : n >= end; n += step) {
      result.push(new Pip(n, 1, null, pos));
    }
    return result;
  }
}

class RandomRange {
  constructor(start, end, startPos = null, endPos = null) {
    this.start = start;
    this.end = end;
    this.seed = null;
    // Source indices of endpoints inside {a -> b} when numeric
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

// Random choice among member access expressions (e.g., {p.length, q.length})
// At evaluation, pick one member access uniformly and evaluate it to get a number.
class RandomMemberChoice {
  constructor(members) {
    this.members = members; // array of MemberAccess
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

class RepeatPip {
  constructor(value, count) {
    this.value = value; // Value node to repeat (Pip, Range, etc.)
    this.count = count; // number or RandNum (RandomRange | RandomChoice)
  }
}

function resolveRandNumToNumber(value, rng, env = null) {
  if (typeof value === 'number') return value;
  if (value instanceof MemberAccess) {
    if (!env) throw new Error('Environment required to evaluate member access');
    return value.eval(env);
  }
  // Handle arithmetic expression nodes
  if (value instanceof ArithAdd || value instanceof ArithSub ||
      value instanceof ArithMul || value instanceof ArithDiv) {
    if (!env) throw new Error('Environment required to evaluate arithmetic expression');
    return value.eval(env);
  }
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
  if (value instanceof RandomMemberChoice) {
    if (!env) throw new Error('Environment required to evaluate member choice');
    if (value.members.length === 0) throw new Error('empty member choice');
    const localRng = value.seed != null ? createSeededRng(value.seed) : rng;
    if (value.seed != null) {
      warmUpRng(localRng, computeWarmupStepsForRandNum(value));
    }
    const idx = Math.floor(localRng() * value.members.length);
    return value.members[idx].eval(env);
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

// Rewrite input by appending $hhhh (4 hex) after any `{...}` that lacks a seed
function rewriteCurlySeeds(input, seedProvider = generateSeed4) {
  const lines = input.split(/\r?\n/);
  const out = [];
  const pattern = /\{[^{}]*\}(?!\$[0-9a-fA-F]{4})/g;
  for (const line of lines) {
    const idx = line.indexOf('//');
    if (idx === -1) {
      out.push(line.replace(pattern, (m) => m + '$' + seedProvider()));
    } else {
      const code = line.slice(0, idx);
      const comment = line.slice(idx);
      out.push(code.replace(pattern, (m) => m + '$' + seedProvider()) + comment);
    }
  }
  return out.join('\n');
}

class Pip {
  constructor(step, timeScale = 1, tag = null, sourcePos = null) {
    this.step = step;
    this.timeScale = timeScale;
    this.tag = tag; // string label for special tokens (e.g., 'x', 'r')
    this.sourcePos = sourcePos; // character position in source (for UI tracking)
    this.diad = null; // array of additional simultaneous steps (for & chords), or null
  }

  // Create a clone of this pip with a new diad array
  withDiad(extraSteps) {
    const p = new Pip(this.step, this.timeScale, this.tag, this.sourcePos);
    p.diad = extraSteps;
    return p;
  }

  // Get all steps (primary + diad steps) as an array
  allSteps() {
    if (!this.diad) return [this.step];
    return [this.step, ...this.diad];
  }

  mul(that) {
    const combinedTag = this.tag ?? that.tag ?? null;
    const out = new Pip(this.step + that.step, this.timeScale * that.timeScale, combinedTag, this.sourcePos);
    // Propagate diad: add that.step to each diad voice independently
    if (this.diad || that.diad) {
      const leftSteps = this.allSteps();
      const rightSteps = that.allSteps();
      // If both have diads, combine them element-wise (pad shorter with primary step)
      if (this.diad && that.diad) {
        const maxLen = Math.max(leftSteps.length, rightSteps.length);
        const combined = [];
        for (let i = 0; i < maxLen; i++) {
          const ls = i < leftSteps.length ? leftSteps[i] : leftSteps[0];
          const rs = i < rightSteps.length ? rightSteps[i] : rightSteps[0];
          combined.push(ls + rs);
        }
        out.step = combined[0];
        out.diad = combined.length > 1 ? combined.slice(1) : null;
      } else if (this.diad) {
        // Only left has diad: add that.step to each
        out.diad = this.diad.map(s => s + that.step);
      } else {
        // Only right has diad: add this.step to each
        out.diad = that.diad.map(s => this.step + s);
      }
    }
    return out;
  }

  expand(that) {
    const combinedTag = this.tag ?? that.tag ?? null;
    const out = new Pip(this.step * that.step, this.timeScale * that.timeScale, combinedTag, this.sourcePos);
    // Propagate diad: multiply each diad voice independently
    if (this.diad || that.diad) {
      const leftSteps = this.allSteps();
      const rightSteps = that.allSteps();
      if (this.diad && that.diad) {
        const maxLen = Math.max(leftSteps.length, rightSteps.length);
        const combined = [];
        for (let i = 0; i < maxLen; i++) {
          const ls = i < leftSteps.length ? leftSteps[i] : leftSteps[0];
          const rs = i < rightSteps.length ? rightSteps[i] : rightSteps[0];
          combined.push(ls * rs);
        }
        out.step = combined[0];
        out.diad = combined.length > 1 ? combined.slice(1) : null;
      } else if (this.diad) {
        out.diad = this.diad.map(s => s * that.step);
      } else {
        out.diad = that.diad.map(s => this.step * s);
      }
    }
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
    // Append diad steps with &
    if (this.diad && this.diad.length > 0) {
      step_str = step_str + this.diad.map(s => ` & ${s}`).join('');
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


// AtIndexMot: Represents a list of (index, value) entries for the @ operator
// Used as the RHS of `mot @ [...]`
class AtIndexMot {
  constructor(entries) {
    // entries is an array of { index: number, value: AST node }
    this.entries = entries;
  }

  eval(env) {
    // AtIndexMot doesn't evaluate directly - it's consumed by AtIndexOp
    // But if evaluated standalone, return a placeholder Mot
    return new Mot([]);
  }
}

// AtIndexOp: The `@` binary operator
// Applies transformations at specific indices without cycling
// Supports negative indices (from end) and compensates for length changes
class AtIndexOp {
  constructor(x, y) {
    this.x = x; // LHS mot
    this.y = y; // RHS AtIndexMot or Mot containing at-index entries
  }

  eval(env) {
    const left = requireMot(this.x.eval(env));
    const rhs = this.y;
    
    // Get the at-index entries from RHS
    let entries = [];
    if (rhs instanceof AtIndexMot) {
      entries = rhs.entries;
    } else {
      throw new Error('@ operator requires [@index value, ...] on the right side');
    }
    
    if (entries.length === 0) {
      return left;
    }
    
    // Clone the left mot's values for mutation
    let values = [...left.values];
    const originalLength = values.length;
    
    // Process entries: resolve negative indices and sort by index descending
    const resolvedEntries = entries.map(entry => {
      let idx = entry.index;
      // Handle negative indices (from end of original mot)
      if (idx < 0) {
        idx = originalLength + idx;
      }
      return { originalIndex: idx, value: entry.value };
    });
    
    // Sort by index descending (highest first) so length changes don't affect lower indices
    resolvedEntries.sort((a, b) => b.originalIndex - a.originalIndex);
    
    for (const entry of resolvedEntries) {
      const targetIndex = entry.originalIndex;
      
      // Skip if index is out of bounds
      if (targetIndex < 0 || targetIndex >= values.length) {
        continue;
      }
      
      // Get the left pip at this position
      const leftPip = values[targetIndex];
      
      // Evaluate the transformation value
      const transformValue = entry.value;
      let transformedPips = [];
      
      if (transformValue instanceof NestedMot || transformValue instanceof NestedMotExpr) {
        // Subdivision: expand the pip into multiple pips
        const m = requireMot(transformValue.eval(env));
        for (const p of m.values) {
          if (p instanceof Pip) {
            const combinedTag = leftPip.tag ?? p.tag ?? null;
            transformedPips.push(new Pip(leftPip.step + p.step, leftPip.timeScale * p.timeScale, combinedTag));
          }
        }
      } else if (transformValue instanceof Mot) {
        // Mot literal: apply as subdivision (like the dot operator)
        const m = requireMot(transformValue.eval(env));
        for (const p of m.values) {
          if (p instanceof Pip) {
            const combinedTag = leftPip.tag ?? p.tag ?? null;
            transformedPips.push(new Pip(leftPip.step + p.step, leftPip.timeScale * p.timeScale, combinedTag));
          }
        }
      } else {
        // Single value: apply transformation
        const mv = new Mot([transformValue]).eval(env);
        for (const p of mv.values) {
          if (p instanceof Pip) {
            // Check for pipe-only (pass-through with optional timescale)
            if (p._pipeOnly) {
              const combinedTag = leftPip.tag ?? p.tag ?? null;
              if (p._jamPass === 'ts') {
                // Preserve LHS step and timeScale
                transformedPips.push(new Pip(leftPip.step, leftPip.timeScale, combinedTag));
              } else if (p._jamPass === 'step') {
                // Preserve LHS step, use RHS timeScale
                transformedPips.push(new Pip(leftPip.step, p.timeScale, combinedTag));
              } else {
                // Default: preserve LHS step and timeScale
                transformedPips.push(new Pip(leftPip.step, leftPip.timeScale, combinedTag));
              }
            } else {
              const combinedTag = leftPip.tag ?? p.tag ?? null;
              transformedPips.push(new Pip(leftPip.step + p.step, leftPip.timeScale * p.timeScale, combinedTag));
            }
          }
        }
      }
      
      // If no transformed pips, keep the original
      if (transformedPips.length === 0) {
        transformedPips = [leftPip];
      }
      
      // Replace the pip(s) at the target index
      values.splice(targetIndex, 1, ...transformedPips);
    }
    
    return new Mot(values);
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
        const isRandNum = ts instanceof RandomRange || ts instanceof RandomChoice || ts instanceof MemberAccess ||
                          ts instanceof ArithAdd || ts instanceof ArithSub || ts instanceof ArithMul || ts instanceof ArithDiv;
        if (isRandNum) {
          ts = resolveRandNumToNumber(ts, rng, env);
        } else if (ts && typeof ts === 'object' && ts._frac) {
          // Handle fractional timeScales with random components
          const numIsRandNum = ts.num instanceof RandomRange || ts.num instanceof RandomChoice || ts.num instanceof MemberAccess ||
                               ts.num instanceof ArithAdd || ts.num instanceof ArithSub || ts.num instanceof ArithMul || ts.num instanceof ArithDiv;
          const denIsRandNum = ts.den instanceof RandomRange || ts.den instanceof RandomChoice || ts.den instanceof MemberAccess ||
                               ts.den instanceof ArithAdd || ts.den instanceof ArithSub || ts.den instanceof ArithMul || ts.den instanceof ArithDiv;
          const num = numIsRandNum ? resolveRandNumToNumber(ts.num, rng, env) : ts.num;
          const den = denIsRandNum ? resolveRandNumToNumber(ts.den, rng, env) : ts.den;
          ts = num / den;
        }
        if (ts !== value.timeScale) {
          const np = new Pip(value.step, ts, value.tag);
          resolved.push(np);
        } else {
          resolved.push(value);
        }
      } else if (value instanceof Range) {
        const pips = value.expandToPips(rng, env);
        for (const p of pips) { resolved.push(p); }
      } else if (value instanceof PadValue) {
        // In fan contexts, ignore padding semantics by resolving the inner value as-is
        const inner = value.inner;
        const mv = new Mot([inner]).eval(env);
        for (const p of mv.values) { resolved.push(p); }
      } else if (value instanceof RepeatPip) {
        // Pip-level repetition: expand the value N times
        const countRaw = value.count;
        const count = Math.max(0, Math.trunc(resolveRandNumToNumber(countRaw, rng, env)));
        for (let i = 0; i < count; i++) {
          // Evaluate the inner value and clone results
          const innerMot = new Mot([value.value]).eval(env);
          for (const p of innerMot.values) {
            resolved.push(p);
          }
        }
      } else if (value instanceof RandomPip) {
        // Resolve the step from the contained randnum using its seed if present
        const step = resolveRandNumToNumber(value.randnum, rng, env);
        let ts = 1;
        const spec = value.timeScale;
        if (typeof spec === 'number') {
          ts = spec;
        } else if (spec instanceof RandomRange || spec instanceof RandomChoice || spec instanceof MemberAccess ||
                   spec instanceof ArithAdd || spec instanceof ArithSub || spec instanceof ArithMul || spec instanceof ArithDiv) {
          // Direct RandomRange/RandomChoice/MemberAccess/ArithExpr as timescale
          ts = resolveRandNumToNumber(spec, rng, env);
        } else if (spec && typeof spec === 'object') {
          const rhsRaw = spec.rhs;
          const rhsVal = typeof rhsRaw === 'number' ? rhsRaw : resolveRandNumToNumber(rhsRaw, rng, env);
          if (spec.kind === 'mul') ts = rhsVal;
          else if (spec.kind === 'div') ts = 1 / rhsVal;
          else ts = 1;
        }
        // Get position from the randnum
        const pos = value.randnum.startPos || (value.randnum.positions && value.randnum.positions[0]) || null;
        const np = new Pip(step, ts, null, pos);
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
        const expanded = value.range.expandToPips(rng, env);
        if (value.op.kind === 'mul') {
          for (const p of expanded) { const np = new Pip(p.step, p.timeScale * value.op.factor); resolved.push(np); }
        } else {
          // div by number or RandNum
          const denom = typeof value.op.rhs === 'number' ? value.op.rhs : resolveRandNumToNumber(value.op.rhs, rng, env);
          for (const p of expanded) { const np = new Pip(p.step, p.timeScale * (1 / denom)); resolved.push(np); }
        }
      } else if (value instanceof RandomRange) {
        const num = resolveRandNumToNumber(value, rng, env);
        const pos = value.startPos;
        const np = new Pip(num, 1, null, pos);
        resolved.push(np);
      } else if (value instanceof RandomChoice) {
        const num = resolveRandNumToNumber(value, rng, env);
        // Use position of first option as representative position
        const pos = (value.positions && value.positions.length > 0) ? value.positions[0] : null;
        const np = new Pip(num, 1, null, pos);
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
      } else if (value instanceof DiadOp) {
        // Resolve diad: combine left and right into a single Pip with diad array
        const leftMot = new Mot([value.left]).eval(env);
        const rightMot = new Mot([value.right]).eval(env);
        if (leftMot.values.length > 0) {
          const basePip = leftMot.values[0];
          // Collect all right-side steps as additional diad voices
          const extraSteps = [];
          for (const rp of rightMot.values) {
            extraSteps.push(rp.step);
            if (rp.diad) extraSteps.push(...rp.diad);
          }
          // Merge with any existing diad on the base pip
          const allDiad = basePip.diad ? [...basePip.diad, ...extraSteps] : extraSteps;
          resolved.push(basePip.withDiad(allDiad));
        }
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


// Drop operator: drops N elements from the end (positive N) or start (negative N)
class DropTransform {
  constructor(expr, count) {
    this.expr = expr;
    this.count = count;
  }

  eval(env) {
    const motif = requireMot(this.expr.eval(env));
    const values = motif.values.slice();
    const n = values.length;
    if (n === 0) return new Mot([]);

    // Resolve count (may be a RandNum)
    let k;
    if (typeof this.count === 'number') {
      k = Math.trunc(this.count);
    } else {
      // RandNum (RandomRange | RandomChoice)
      const rng = motif._rng || Math.random;
      const num = resolveRandNumToNumber(this.count, rng);
      k = Math.trunc(num);
    }

    // Positive k: drop last k elements (equivalent to slice 0 to n-k)
    // Negative k: drop first |k| elements (equivalent to slice |k| to n)
    if (k >= 0) {
      const end = Math.max(0, n - k);
      return new Mot(values.slice(0, end));
    } else {
      const start = Math.min(n, -k);
      return new Mot(values.slice(start));
    }
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
  DisplaceOp, MotTimeScaleOp,
  AliasCall,
]);

function isBinaryTransformNode(node) {
  for (const C of BINARY_TRANSFORMS) {
    if (node instanceof C) return true;
  }
  return false;
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

    if (node instanceof DropTransform) {
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

    if (node instanceof DropTransform) {
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
  const { ast } = parseRaw(source);  // Use parseRaw with semicolon support
  const { root, env } = getFinalRootAstAndEnv(ast);
  return golden.collectMotLeavesWithDepth(root, env, options);
}

// Convenience: compute expression height from the final statement's root.
golden.computeHeightFromLeaves = function(source, options = {}) {
  const { ast } = parseRaw(source);  // Use parseRaw with semicolon support
  const { root, env } = getFinalRootAstAndEnv(ast);
  return golden.computeExprHeight(root, env, options);
}

// Get program info: pip count, pip tree depth, and duration (unit durations in bottom-most mot)
golden.CruxProgramInfo = function(code) {
  const prog = parse(code);
  const { root, env } = getFinalRootAstAndEnv(prog);

  // Compute pip tree depth (height of expression tree)
  const pip_depth = golden.computeExprHeight(root, env);

  // Collect all leaf mots with their depths
  const leaves = golden.collectMotLeavesWithDepth(root, env);

  // Count total pips across all leaf mots
  let pip_count = 0;
  for (const { mot } of leaves) {
    pip_count += mot.values.length;
  }

  // Find the bottom-most mot (deepest leaf) and count its unit durations
  let duration = 0;
  let maxDepth = -1;
  for (const { mot, depth } of leaves) {
    if (depth > maxDepth) {
      maxDepth = depth;
      // Count unit durations in this mot
      duration = 0;
      for (const pip of mot.values) {
        duration += pip.timeScale;
      }
    }
  }

  return { pip_count, pip_depth, duration, quanta_count: duration };
}

// Find all source indices where a timescale literal appears in the source program.
golden.findAllTimescaleIndices = function(source) {
  // Preprocess to handle semicolons, but keep position mapping
  const { source: processed, positionMap } = preprocessSource(source);
  const matchResult = g.match(processed);
  if (matchResult.failed()) return [];
  const idxs = tsSemantics(matchResult).collectTs();
  // Map back to original positions
  const mapped = mapIndicesToOriginal(idxs, positionMap);
  // Deduplicate and sort for stability
  const uniq = Array.from(new Set(mapped)).sort((a, b) => a - b);
  return uniq;
}





// Helper: Map processed indices back to original source positions
function mapIndicesToOriginal(indices, positionMap) {
  if (!positionMap) return indices;
  return indices.map(idx => positionMap[idx] !== undefined ? positionMap[idx] : idx);
}

// Return arrays of indices (per Mot, left-to-right) of numeric pips whose Mot is exactly targetDepth from the root.
// Numeric pip = Pip with no tag (excludes special/tagged, random, range, etc.).
golden.findNumericValueIndicesAtDepth = function(source, targetDepth, options = {}) {
  const { ast, positionMap } = parseRaw(source);  // Use parseRaw with semicolon support
  const { root, env } = getFinalRootAstAndEnv(ast);
  const leaves = golden.collectMotLeavesWithDepth(root, env, options);
  const result = [];

  for (const { mot, depth } of leaves) {
    if (depth !== targetDepth) continue;
    const idxs = [];
    for (let i = 0; i < mot.values.length; i++) {
      const v = mot.values[i];
      // Include plain numeric Pips with source positions (excludes tagged pips like 'r')
      if (v instanceof Pip && typeof v.sourcePos === 'number' && !v.tag) {
        idxs.push(v.sourcePos);
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
  return mapIndicesToOriginal(result.flat(), positionMap);
}


// Return arrays of indices (per Mot, left-to-right) of numeric pips whose Mot depth >= minDepth.
golden.findNumericValueIndicesAtDepthOrAbove = function(source, minDepth, options = {}) {
  const { ast, positionMap } = parseRaw(source);  // Use parseRaw with semicolon support
  const { root, env } = getFinalRootAstAndEnv(ast);
  const leaves = golden.collectMotLeavesWithDepth(root, env, options);
  const result = [];

  for (const { mot, depth } of leaves) {
    // "or above" means shallower or equal depth (closer to root)
    if (depth > minDepth) continue;
    const idxs = [];
    for (let i = 0; i < mot.values.length; i++) {
      const v = mot.values[i];
      // Include plain numeric Pips with source positions (excludes tagged pips like 'r')
      if (v instanceof Pip && typeof v.sourcePos === 'number' && !v.tag) {
        idxs.push(v.sourcePos);
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
  return mapIndicesToOriginal(result.flat(), positionMap);
}


// Public: seed any unseeded curly randoms with $hhhh
golden.CruxRewriteCurlySeeds = function(input) {
  return rewriteCurlySeeds(String(input || ''));
}

// Public: desugar only the :N textual suffixes to " * [0,0,...]" using CST spans.
// Preserves all other whitespace and // comments.
golden.CruxDesugarRepeats = function(input) {
  const src = String(input || '');
  // Parse on a comment-stripped shadow to align indices, like parse()
  const matchResult = g.match(src);
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



// Preprocess source for parsing: replace semicolons with newlines and trim.
// Returns { source, positionMap } where positionMap[processedIdx] = originalIdx
function preprocessSource(input) {
  // Track how much we trim from the start
  const trimmed = input.trim();
  const trimStart = input.indexOf(trimmed);

  // Replace semicolons: "\s*;\s*" becomes "\n"
  // We need to track position changes character by character
  let processed = '';
  const positionMap = [];

  const regex = /\s*;\s*/g;
  let lastIndex = 0;
  let match;

  // Process trimmed input
  const source = trimmed;
  regex.lastIndex = 0;

  while ((match = regex.exec(source)) !== null) {
    // Copy unchanged portion before the match
    const beforeMatch = source.substring(lastIndex, match.index);
    for (let i = 0; i < beforeMatch.length; i++) {
      positionMap.push(trimStart + lastIndex + i);
      processed += beforeMatch[i];
    }

    // Replace the semicolon pattern with a single newline
    // Map the newline back to the position of the semicolon
    const semiPos = source.indexOf(';', match.index);
    positionMap.push(trimStart + semiPos);
    processed += '\n';

    lastIndex = match.index + match[0].length;
  }

  // Copy remaining portion
  const remaining = source.substring(lastIndex);
  for (let i = 0; i < remaining.length; i++) {
    positionMap.push(trimStart + lastIndex + i);
    processed += remaining[i];
  }

  return { source: processed, positionMap };
}

// Internal helper: parse with optional preprocessing
function parseInternal(input, preprocess = true) {
  if (!preprocess) {
    const matchResult = g.match(input);
    if (matchResult.failed()) {
      throw new Error(matchResult.message);
    }
    return { ast: s(matchResult).parse(), positionMap: null };
  }

  const { source, positionMap } = preprocessSource(input);
  const matchResult = g.match(source);
  if (matchResult.failed()) {
    throw new Error(matchResult.message);
  }
  return { ast: s(matchResult).parse(), positionMap };
}

// Parse raw source with semicolon support - preserves source positions for utility functions.
// Returns { ast, positionMap } where positionMap can translate processed -> original positions
function parseRaw(input) {
  return parseInternal(input, true);
}

// Public parse function with preprocessing for convenience (semicolons, trim).
// Returns just the AST for backward compatibility
function parse(input) {
  const { ast } = parseInternal(input, true);
  return ast;
}

golden.parse = parse;

// Extract `// #name value...` directives from source.
//
// Each directive is a comment line of the form `// #name value-tokens...` where
// value-tokens are whitespace-separated. If two or more tokens are present and
// the LAST token is a positive integer, the line is treated as sampler-scoped:
// the trailing integer is the sampler index, and the remaining tokens (joined
// with spaces) are the value. Otherwise the directive is global with the full
// token sequence as its value.
//
// Three directive names get structural treatment:
//   #target SECTION SAMPLER   - routes section SECTION to Sampler-SAMPLER
//   #preset NAME SAMPLER      - preset for Sampler-SAMPLER (same shape, no special handling beyond sampler scoping)
//   #octave VALUE SAMPLER     - octave offset for Sampler-SAMPLER (same)
//
// Out-of-range section indices on #target are recorded verbatim (no error).
// Duplicate directives are last-wins. Unknown directive names follow the same
// sampler-scoping rule and live alongside the known ones in the result.
//
// Returns { routing, samplers, directives } where:
//   routing    = { sectionIndex: samplerIndex }  (1-based, from #target)
//   samplers   = { samplerIndex: { name: value, ... } }  (sampler-scoped)
//   directives = { name: value }  (global, sampler-less)
function extractDirectives(source) {
  const routing = {};
  const samplers = {};
  const directives = {};
  if (typeof source !== 'string') return { routing, samplers, directives };

  // Match a directive line: optional leading whitespace, //, optional space,
  // #, word name, whitespace, value (lazy up to optional trailing comment or
  // end of line).
  const pattern = /^\s*\/\/\s*#(\w+)\s+(.+?)\s*$/;

  for (const line of source.split('\n')) {
    const m = line.match(pattern);
    if (!m) continue;
    const name = m[1];
    const rest = m[2];
    const tokens = rest.split(/\s+/).filter(t => t.length > 0);
    if (tokens.length === 0) continue;

    // Decide whether this is sampler-scoped (2+ tokens, trailing positive int).
    let samplerIdx = null;
    let valueTokens = tokens;
    if (tokens.length >= 2) {
      const last = tokens[tokens.length - 1];
      if (/^[1-9]\d*$/.test(last)) {
        samplerIdx = Number(last);
        valueTokens = tokens.slice(0, -1);
      }
    }
    const value = valueTokens.join(' ');

    if (name === 'target' && samplerIdx !== null) {
      // #target SECTION SAMPLER - value is the section index.
      const sectionIdx = Number(value);
      if (Number.isFinite(sectionIdx) && Number.isInteger(sectionIdx) && sectionIdx >= 1) {
        routing[sectionIdx] = samplerIdx;
      }
      // Out-of-range or non-integer section: silently ignored (no-error policy).
      continue;
    }

    if (samplerIdx !== null) {
      if (!samplers[samplerIdx]) samplers[samplerIdx] = {};
      samplers[samplerIdx][name] = value;
    } else {
      directives[name] = value;
    }
  }

  return { routing, samplers, directives };
}

golden.CruxExtractDirectives = extractDirectives;
// Stable alias — see modules/golden/crux.js for rationale (legacy
// CruxExtractDirectives override-safety).
golden.CruxExtractDirectivesPoly = extractDirectives;

golden.crux_interp = function (input, seedEnv) {
  const prog = parse(input);
  const value = prog.interp(seedEnv);
  const { routing, samplers, directives } = extractDirectives(input);

  // Fill in default routing for any section without an explicit #target.
  // Sections are 1-based externally to match the Sampler-N naming scheme.
  for (let i = 1; i <= value.sections.length; i++) {
    if (!(i in routing)) routing[i] = i;
  }

  return { ...value, routing, samplers, directives };
}

// Parse and evaluate a source for its bindings only, and return the populated
// environment (a Map). Sections and voices are ignored. `=` names are
// MacroBindings (lazy ASTs), `:=` names are evaluated Mots, operator aliases
// are op entries: the shape crux_interp takes as seedEnv. An optional seedEnv
// is copied and layered under the source's own bindings. Throws on a bad
// reference. Hosts use this to share definitions between programs.
golden.crux_env = function (input, seedEnv) {
  const prog = parse(input);
  const env = seedEnv ? new Map(seedEnv) : new Map();
  for (const stmts of prog.sections) for (const stmt of stmts) stmt.eval(env);
  return env;
};

// Internals for src/fold/trace.js (crux_trace). Not a public API.
golden._cruxInternals = {
  preprocessSource, Pip, Mot, NestedMot, NestedMotExpr, Ref, GlobalPlaceholder,
  FollowedBy, Mul, Expand, RepeatByCount, Dot, Mirror, MotTimeScaleOp, AliasCall,
  JamOp, DotJam, DotExpand, RotateOp, DotRotate, Steps, DotSteps, DotMirror,
  Lens, DotLens, DotZip, ZipColumns, GlassOp, DotGlass, ReichOp, DotReich,
  PaertOp, FoldOp, DisplaceOp, Subdivide, TieOp, DotTie, ConstraintOp,
  DotConstraint, AtIndexOp, DropTransform,
};

// Find the pip at a specific character position in the source code.
// Returns { pip, mot, motPath } or null if no pip found at that position.
// motPath is a string like "sections[0].values[2]" for structural tracking.
golden.findPipAtPosition = function(source, position) {
  // Reuse findAllPipsWithPositions and find the closest match
  const allPips = golden.findAllPipsWithPositions(source);

  // Find the pip at or nearest to the requested position
  // For exact match, return immediately
  const exactMatch = allPips.find(item => item.position === position);
  if (exactMatch) return exactMatch;

  // Otherwise find the closest pip before this position
  const before = allPips.filter(item => item.position <= position);
  if (before.length === 0) return null;

  before.sort((a, b) => b.position - a.position);
  return before[0];
}

// Get all pips with their positions and structural paths.
// Returns array of { pip, mot, motPath, position, depth } objects.
// Useful for building UI registries that track pips across edits.
// This function walks the raw AST before evaluation to capture source positions.
golden.findAllPipsWithPositions = function(source) {
  const { ast, positionMap } = parseRaw(source);
  const result = [];

  function collectPipsFromMot(mot, path, depth = 0) {
    if (!mot || !mot.values) return;
    for (let i = 0; i < mot.values.length; i++) {
      const v = mot.values[i];
      const pipPath = `${path}.values[${i}]`;

      if (v instanceof Pip && typeof v.sourcePos === 'number') {
        const origPos = positionMap ? positionMap[v.sourcePos] : v.sourcePos;
        result.push({ pip: v, mot, motPath: pipPath, position: origPos, depth });
      } else if (v instanceof Range) {
        // For ranges, include both start and end positions
        if (typeof v.startPos === 'number') {
          const origPos = positionMap ? positionMap[v.startPos] : v.startPos;
          const expanded = v.expandToPips();
          if (expanded.length > 0) {
            result.push({ pip: expanded[0], mot, motPath: `${pipPath}[start]`, position: origPos, depth, rangeStart: true });
          }
        }
        if (typeof v.endPos === 'number') {
          const origPos = positionMap ? positionMap[v.endPos] : v.endPos;
          const expanded = v.expandToPips();
          if (expanded.length > 0) {
            result.push({ pip: expanded[expanded.length - 1], mot, motPath: `${pipPath}[end]`, position: origPos, depth, rangeEnd: true });
          }
        }
      } else if (v instanceof RandomChoice && Array.isArray(v.positions)) {
        for (let j = 0; j < v.positions.length; j++) {
          if (typeof v.positions[j] === 'number') {
            const origPos = positionMap ? positionMap[v.positions[j]] : v.positions[j];
            result.push({ pip: null, mot, motPath: `${pipPath}.choices[${j}]`, position: origPos, depth, randomChoice: j });
          }
        }
      } else if (v instanceof RandomRange) {
        if (typeof v.startPos === 'number') {
          const origPos = positionMap ? positionMap[v.startPos] : v.startPos;
          result.push({ pip: null, mot, motPath: `${pipPath}[start]`, position: origPos, depth, randomRangeStart: true });
        }
        if (typeof v.endPos === 'number') {
          const origPos = positionMap ? positionMap[v.endPos] : v.endPos;
          result.push({ pip: null, mot, motPath: `${pipPath}[end]`, position: origPos, depth, randomRangeEnd: true });
        }
      } else if (v instanceof RandomPip) {
        const rnd = v.randnum;
        if (rnd instanceof RandomChoice && Array.isArray(rnd.positions)) {
          for (let j = 0; j < rnd.positions.length; j++) {
            if (typeof rnd.positions[j] === 'number') {
              const origPos = positionMap ? positionMap[rnd.positions[j]] : rnd.positions[j];
              result.push({ pip: null, mot, motPath: `${pipPath}.choices[${j}]`, position: origPos, depth, randomChoice: j });
            }
          }
        } else if (rnd instanceof RandomRange) {
          if (typeof rnd.startPos === 'number') {
            const origPos = positionMap ? positionMap[rnd.startPos] : rnd.startPos;
            result.push({ pip: null, mot, motPath: `${pipPath}[start]`, position: origPos, depth, randomRangeStart: true });
          }
          if (typeof rnd.endPos === 'number') {
            const origPos = positionMap ? positionMap[rnd.endPos] : rnd.endPos;
            result.push({ pip: null, mot, motPath: `${pipPath}[end]`, position: origPos, depth, randomRangeEnd: true });
          }
        }
      }
    }
  }

  function walkExpr(expr, path, depth = 0) {
    if (!expr) return;

    if (expr instanceof Mot) {
      collectPipsFromMot(expr, path, depth);
    } else if (isBinaryTransformNode(expr)) {
      walkExpr(expr.x, `${path}.x`, depth + 1);
      walkExpr(expr.y, `${path}.y`, depth + 1);
    } else if (expr instanceof FollowedBy) {
      walkExpr(expr.x, `${path}.x`, depth);
      walkExpr(expr.y, `${path}.y`, depth);
    }
  }

  // Walk all sections
  if (ast && ast.sections) {
    for (let i = 0; i < ast.sections.length; i++) {
      const stmts = ast.sections[i]; // Array of statements
      for (let j = 0; j < stmts.length; j++) {
        const stmt = stmts[j];
        if (stmt instanceof EvalAssign || stmt instanceof MacroAssign) {
          // Walk assignment expression
          walkExpr(stmt.expr, `sections[${i}][${j}].${stmt.name}`, 0);
        } else {
          // Walk statement expression directly
          walkExpr(stmt, `sections[${i}][${j}]`, 0);
        }
      }
    }
  }

  // Sort by position for easier consumption
  result.sort((a, b) => a.position - b.position);
  return result;
}







// === Version (stamped by crux/build.js from crux/package.json) ===
golden.cruxVersion = "2.1.0";
golden.cruxBuiltAt = "2026-11-17T15:50:40.329Z";

// === Decomposition Engine ===
// Crux Decomposition Engine
// Given a flat evaluated mot, discover candidate Crux programs that produce it.

// ============================================================================
// AST Node Types
// ============================================================================
// Each node implements toString() producing valid Crux syntax.
// Verification round-trips through golden.crux_interp().

class DLiteral {
  constructor(pips) {
    // pips: [{step, timeScale}]
    this.pips = pips;
  }
  toString() {
    const parts = this.pips.map(p => {
      const step = p.step;
      const ts = p.timeScale ?? 1;
      if (ts === 1) return `${step}`;
      // Negative timeScale signals retrograde in Mul/Expand operators.
      // Preserve the sign so round-trip verification works.
      const absTs = Math.abs(ts);
      const neg = ts < 0 ? '-' : '';
      if (absTs === 1) return `${step} | ${neg}1`;
      const inv = 1 / absTs;
      const invRounded = Math.round(inv);
      if (Math.abs(inv - invRounded) < 1e-10 && invRounded !== 0) {
        return `${step} | ${neg}/${invRounded}`;
      }
      const tsStr = Number.isInteger(absTs) ? String(absTs) : String(+absTs.toFixed(6)).replace(/\.0+$/, '');
      return `${step} | ${neg}${tsStr}`;
    });
    return '[' + parts.join(', ') + ']';
  }
  get isPrimary() { return true; }
}

class DRange {
  constructor(from, to) {
    this.from = from;
    this.to = to;
  }
  toString() {
    return `[${this.from}->${this.to}]`;
  }
  get isPrimary() { return true; }
}

class DBinOp {
  constructor(opStr, left, right) {
    this.opStr = opStr;
    this.left = left;
    this.right = right;
  }
  toString() {
    let l = this.left.isPrimary ? this.left.toString() : `(${this.left.toString()})`;
    const r = this.right.isPrimary ? this.right.toString() : `(${this.right.toString()})`;
    // .j after a bare ident fails to parse — wrap in parens
    if (this.opStr === '.j' && this.left instanceof DRef) {
      l = `(${l})`;
    }
    return `${l} ${this.opStr} ${r}`;
  }
  get isPrimary() { return false; }
}

class DConcat {
  constructor(parts) {
    // parts: AST[]
    this.parts = parts;
  }
  toString() {
    return this.parts.map(p => p.toString()).join(', ');
  }
  get isPrimary() { return false; }
}

class DRepeat {
  constructor(expr, count) {
    this.expr = expr;
    this.count = count;
  }
  toString() {
    const e = this.expr.isPrimary ? this.expr.toString() : `(${this.expr.toString()})`;
    return `${e} : ${this.count}`;
  }
  get isPrimary() { return false; }
}

class DRhythmMask {
  constructor(timeScales) {
    // timeScales: number[] — the timeScale values for each pip position
    this.timeScales = timeScales;
  }
  toString() {
    const parts = this.timeScales.map(ts => {
      ts = Math.abs(ts);
      if (ts === 1) return '|';
      const inv = 1 / ts;
      const invRounded = Math.round(inv);
      if (Math.abs(inv - invRounded) < 1e-10 && invRounded !== 0) {
        return `|/${invRounded}`;
      }
      const tsStr = Number.isInteger(ts) ? String(ts) : String(+ts.toFixed(6)).replace(/\.0+$/, '');
      return `|${tsStr}`;
    });
    return '[' + parts.join(', ') + ']';
  }
  get isPrimary() { return true; }
}

class DAssign {
  constructor(name, expr) {
    this.name = name;
    this.expr = expr;
  }
  toString() {
    return `${this.name} = ${this.expr.toString()}`;
  }
  get isPrimary() { return false; }
}

class DRef {
  constructor(name) {
    this.name = name;
  }
  toString() {
    return this.name;
  }
  get isPrimary() { return true; }
}

class DProgram {
  constructor(assignments, finalExpr) {
    // assignments: [{name, expr}] — variable assignments in order
    // finalExpr: AST node — the final expression that produces the output
    this.assignments = assignments;
    this.finalExpr = finalExpr;
  }
  toString() {
    const lines = this.assignments.map(a => `${a.name} = ${a.expr.toString()}`);
    lines.push(this.finalExpr.toString());
    return lines.join('\n');
  }
  get isPrimary() { return false; }
}


// ============================================================================
// Analyzers (Phase 1)
// ============================================================================

function analyzeIntervals(pips) {
  const deltas = [];
  const absDeltas = [];
  for (let i = 1; i < pips.length; i++) {
    const d = pips[i].step - pips[i - 1].step;
    deltas.push(d);
    absDeltas.push(Math.abs(d));
  }
  return { deltas, absDeltas };
}

function analyzeProgressions(pips, deltas) {
  // Find maximal contiguous runs where the delta is constant.
  // A run needs >= 3 pips (>= 2 deltas) to be interesting.
  const runs = [];
  if (deltas.length === 0) return runs;

  let runStart = 0;
  for (let i = 1; i <= deltas.length; i++) {
    if (i < deltas.length && deltas[i] === deltas[runStart]) continue;
    // Run of constant delta from runStart to i-1 (in delta-space)
    // which covers pip indices runStart to i (inclusive)
    const pipStart = runStart;
    const pipEnd = i; // inclusive index in pips
    const pipCount = pipEnd - pipStart + 1;
    if (pipCount >= 3) {
      runs.push({
        start: pipStart,
        end: pipEnd,        // inclusive pip index
        startVal: pips[pipStart].step,
        endVal: pips[pipEnd].step,
        delta: deltas[runStart],
        length: pipCount,
      });
    }
    runStart = i;
  }
  return runs;
}

function analyzeRepeats(pips) {
  // Check if the full sequence (or a prefix) repeats a shorter pattern.
  const len = pips.length;
  const results = [];

  for (let period = 1; period <= Math.floor(len / 2); period++) {
    let matches = true;
    for (let i = period; i < len; i++) {
      const ref = i % period;
      if (pips[i].step !== pips[ref].step ||
          Math.abs(pips[i].timeScale - pips[ref].timeScale) > 1e-10) {
        matches = false;
        break;
      }
    }
    if (matches) {
      const count = Math.floor(len / period);
      const remainder = len % period;
      results.push({
        period,
        count: remainder === 0 ? count : count,
        isTruncated: remainder !== 0,
        remainder,
      });
    }
  }
  return results;
}

function analyze(pips) {
  const { deltas, absDeltas } = analyzeIntervals(pips);
  const progressions = analyzeProgressions(pips, deltas);
  const repeats = analyzeRepeats(pips);
  return { deltas, absDeltas, progressions, repeats };
}


// ============================================================================
// Rhythm Factoring
// ============================================================================

function isUniformTs(pips) {
  if (pips.length === 0) return true;
  const ts0 = pips[0].timeScale;
  return pips.every(p => Math.abs(p.timeScale - ts0) < 1e-10);
}

function allTsOne(pips) {
  return pips.every(p => Math.abs(p.timeScale - 1) < 1e-10);
}

// Strip timeScales from pips, returning step-only pips (all ts=1).
function stripRhythm(pips) {
  return pips.map(p => ({ step: p.step, timeScale: 1 }));
}

// Extract the timeScale sequence from pips.
function extractRhythm(pips) {
  return pips.map(p => p.timeScale);
}

// Compress a rhythm mask into a compact AST node.
// Returns null if no compression found (use the full mask literal).
// Note: Only uniform masks (all same value) can be compressed, because .j
// tiles a shorter RHS across the LHS positions. Non-uniform repeating patterns
// can't use DRepeat because the : operator strips _pipeOnly flags from pips,
// breaking the .j step-preservation mechanism.
function compressRhythm(timeScales) {
  const len = timeScales.length;
  if (len === 0) return null;

  // Uniform: all same → single-element mask (tiles via .j)
  const ts0 = timeScales[0];
  if (timeScales.every(ts => Math.abs(ts - ts0) < 1e-10)) {
    return new DRhythmMask([ts0]);
  }

  // No compression found — non-uniform masks must use full literal
  return null;
}

// Build the rhythm expression for use in `.j rhythmExpr`.
function buildRhythmExpr(timeScales) {
  const compressed = compressRhythm(timeScales);
  if (compressed) return compressed;
  return new DRhythmMask(timeScales);
}


// ============================================================================
// Variable Hoisting
// ============================================================================
// Identifies repeated sub-expressions in a candidate AST and hoists them
// into named variable assignments. The goal is to reveal repetition and
// structural relationships — not to save characters. A hoist that costs
// characters but names a motif used three times is a clear win.

const MIN_HOIST_LEN = 5; // min toString() length to consider hoisting

// Variable names: aa, ab, ac, ... az, ba, bb, ...
// Two-char names avoid single-letter operator conflicts (j, m, l, c, g, r, p, t, z).
function generateVarName(index) {
  const first = String.fromCharCode(97 + Math.floor(index / 26));
  const second = String.fromCharCode(97 + (index % 26));
  return first + second;
}

// Walk every node in the AST tree, calling visitor(node) for each.
function walkAST(node, visitor) {
  visitor(node);
  if (node instanceof DBinOp) {
    walkAST(node.left, visitor);
    walkAST(node.right, visitor);
  } else if (node instanceof DConcat) {
    for (const part of node.parts) walkAST(part, visitor);
  } else if (node instanceof DRepeat) {
    walkAST(node.expr, visitor);
  } else if (node instanceof DProgram) {
    for (const a of node.assignments) walkAST(a.expr, visitor);
    walkAST(node.finalExpr, visitor);
  }
}

// Collect all sub-expressions and their occurrence counts.
// Returns Map<serialized_string, {count, node}>.
function collectSubExpressions(node) {
  const map = new Map();
  walkAST(node, (subNode) => {
    // Skip DRef nodes (already hoisted) and the root itself
    if (subNode instanceof DRef) return;
    if (subNode === node) return;
    const key = subNode.toString();
    if (key.length < MIN_HOIST_LEN) return;
    if (!map.has(key)) {
      map.set(key, { count: 0, node: subNode });
    }
    map.get(key).count++;
  });
  return map;
}

// Return a new AST with all nodes matching targetKey replaced by replacement.
function substituteAST(node, targetKey, replacement) {
  if (node.toString() === targetKey) return replacement;
  if (node instanceof DBinOp) {
    const newLeft = substituteAST(node.left, targetKey, replacement);
    const newRight = substituteAST(node.right, targetKey, replacement);
    if (newLeft === node.left && newRight === node.right) return node;
    return new DBinOp(node.opStr, newLeft, newRight);
  }
  if (node instanceof DConcat) {
    let changed = false;
    const newParts = node.parts.map(p => {
      const np = substituteAST(p, targetKey, replacement);
      if (np !== p) changed = true;
      return np;
    });
    return changed ? new DConcat(newParts) : node;
  }
  if (node instanceof DRepeat) {
    const newExpr = substituteAST(node.expr, targetKey, replacement);
    if (newExpr === node.expr) return node;
    return new DRepeat(newExpr, node.count);
  }
  if (node instanceof DProgram) {
    let changed = false;
    const newAssignments = node.assignments.map(a => {
      const newExpr = substituteAST(a.expr, targetKey, replacement);
      if (newExpr !== a.expr) { changed = true; return { ...a, expr: newExpr }; }
      return a;
    });
    const newFinal = substituteAST(node.finalExpr, targetKey, replacement);
    if (newFinal !== node.finalExpr) changed = true;
    return changed ? new DProgram(newAssignments, newFinal) : node;
  }
  return node;
}

// Evaluate a standalone Crux expression and return its pip values.
function evalExpr(code) {
  try {
    const result = golden.crux_interp(code);
    const mot = result.sections.at(-1);
    if (!mot?.values) return null;
    return mot.values.map(p => ({ step: p.step, timeScale: p.timeScale }));
  } catch { return null; }
}

// After hoisting, try to express variables in terms of each other.
// Detects transposition (aa * [N]) and retrograde (aa * [N | -1]).
// Returns the number of inter-variable relationships found.
function findVariableRelationships(assignments) {
  // Evaluate each variable's expression to get pip values
  const evalMap = new Map();
  for (const assign of assignments) {
    const pips = evalExpr(assign.expr.toString());
    if (pips) evalMap.set(assign.name, pips);
  }

  let count = 0;

  for (let i = 1; i < assignments.length; i++) {
    const laterPips = evalMap.get(assignments[i].name);
    if (!laterPips || laterPips.length === 0) continue;

    for (let j = 0; j < i; j++) {
      const earlierPips = evalMap.get(assignments[j].name);
      if (!earlierPips || earlierPips.length === 0) continue;
      if (earlierPips.length !== laterPips.length) continue;

      const earlierName = assignments[j].name;

      // Check transposition: later = earlier + constant offset
      const offset = laterPips[0].step - earlierPips[0].step;
      if (offset !== 0) {
        let isTransposition = true;
        for (let k = 0; k < earlierPips.length; k++) {
          if (laterPips[k].step - earlierPips[k].step !== offset) { isTransposition = false; break; }
          if (Math.abs(laterPips[k].timeScale - earlierPips[k].timeScale) > 1e-10) { isTransposition = false; break; }
        }
        if (isTransposition) {
          assignments[i].expr = new DBinOp('*', new DRef(earlierName),
            new DLiteral([{ step: offset, timeScale: 1 }]));
          assignments[i].derivedFrom = earlierName;
          count++;
          break;
        }
      }

      // Check retrograde: later = reverse(earlier) + offset
      const retroOffset = laterPips[0].step - earlierPips[earlierPips.length - 1].step;
      let isRetrograde = true;
      for (let k = 0; k < earlierPips.length; k++) {
        const rev = earlierPips.length - 1 - k;
        if (laterPips[k].step - earlierPips[rev].step !== retroOffset) { isRetrograde = false; break; }
        if (Math.abs(laterPips[k].timeScale - earlierPips[rev].timeScale) > 1e-10) { isRetrograde = false; break; }
      }
      if (isRetrograde) {
        assignments[i].expr = new DBinOp('*', new DRef(earlierName),
          new DLiteral([{ step: retroOffset, timeScale: -1 }]));
        assignments[i].derivedFrom = earlierName;
        count++;
        break;
      }
    }
  }

  return count;
}

// Attempt to hoist repeated sub-expressions into variables, then
// look for inter-variable relationships (transposition, retrograde).
// Returns {code, score, kind} or null if no hoisting was beneficial.
//
// Selection criterion: structural value = occurrences × expression length.
// This prioritizes naming motifs that appear many times and/or are
// non-trivial expressions, regardless of whether it saves characters.
function attemptHoist(node, targetPips, baseKind) {
  const assignments = [];
  let currentNode = node;
  let varIndex = 0;

  while (true) {
    const freqs = collectSubExpressions(currentNode);
    let bestKey = null;
    let bestValue = 0;
    let bestNode = null;
    let bestCount = 0;

    for (const [key, { count, node: exprNode }] of freqs) {
      if (count < 2) continue;
      // Structural value: how much repetition does naming this reveal?
      // More occurrences and longer expressions = more structure exposed.
      const value = count * key.length;
      if (value > bestValue) {
        bestValue = value;
        bestKey = key;
        bestNode = exprNode;
        bestCount = count;
      }
    }

    if (!bestKey) break;

    const name = generateVarName(varIndex);
    varIndex++;
    currentNode = substituteAST(currentNode, bestKey, new DRef(name));
    assignments.push({ name, expr: bestNode, uses: bestCount });
  }

  if (assignments.length === 0) return null;

  // Snapshot the hoisted-only version before trying relationships.
  const hoistOnlyAssignments = assignments.map(a => ({ ...a }));

  // Phase 2: try to express variables in terms of each other.
  // This reveals structural relationships between motifs.
  const relationships = findVariableRelationships(assignments);

  let program = new DProgram(assignments, currentNode);
  let code = program.toString();

  // Verify the full program round-trips correctly
  if (!verify(code, targetPips)) {
    if (relationships > 0) {
      // Relationship rewrites broke verification — fall back to hoist-only.
      const fallback = new DProgram(hoistOnlyAssignments, currentNode);
      const fallbackCode = fallback.toString();
      if (!verify(fallbackCode, targetPips)) return null;
      return {
        code: fallbackCode,
        score: scoreHoisted(fallbackCode, targetPips, hoistOnlyAssignments, 0),
        kind: baseKind,
      };
    }
    return null;
  }

  return {
    code,
    score: scoreHoisted(code, targetPips, assignments, relationships),
    kind: baseKind,
  };
}


// ============================================================================
// Discoverers (Phase 2)
// ============================================================================
// Discoverers operate on step-only pips (all ts=1). Rhythm is handled
// separately via factoring and recombined with .j in the main discover() flow.

function discoverRanges(pips, features) {
  const candidates = [];

  // Check if full sequence is a single range (all deltas = +1 or all = -1)
  if (features.deltas.length > 0) {
    const allSame = features.deltas.every(d => d === features.deltas[0]);
    if (allSame && (features.deltas[0] === 1 || features.deltas[0] === -1)) {
      candidates.push({
        node: new DRange(pips[0].step, pips[pips.length - 1].step),
        kind: 'range',
      });
    }
  }

  // Check for sub-ranges within progressions (delta = ±1, length >= 3)
  // Only if the full sequence isn't already a single range
  if (candidates.length === 0 && features.progressions.length > 0) {
    const unitRuns = features.progressions.filter(
      r => (r.delta === 1 || r.delta === -1) && r.length >= 3
    );
    // Only emit sub-range candidates if they cover a meaningful portion
    if (unitRuns.length > 0) {
      const parts = buildSegmentedCandidate(pips, unitRuns, (run) => {
        return new DRange(run.startVal, run.endVal);
      });
      if (parts && parts.length < pips.length) {
        candidates.push({
          node: parts.length === 1 ? parts[0] : new DConcat(parts),
          kind: 'range-segments',
        });
      }
    }
  }

  return candidates;
}

function discoverRepeats(pips, features) {
  const candidates = [];
  if (features.repeats.length === 0) return candidates;

  // Prefer the smallest period with an exact (non-truncated) repeat
  const exactRepeats = features.repeats.filter(r => !r.isTruncated && r.count >= 2);
  const truncatedRepeats = features.repeats.filter(r => r.isTruncated && r.count >= 2);

  for (const rep of exactRepeats) {
    const patternPips = pips.slice(0, rep.period);
    candidates.push({
      node: new DRepeat(new DLiteral(patternPips), rep.count),
      kind: 'repeat',
    });
  }

  // Truncated: full repeats + literal remainder
  for (const rep of truncatedRepeats) {
    const patternPips = pips.slice(0, rep.period);
    const remainderPips = pips.slice(rep.count * rep.period);
    candidates.push({
      node: new DConcat([
        new DRepeat(new DLiteral(patternPips), rep.count),
        new DLiteral(remainderPips),
      ]),
      kind: 'repeat-truncated',
    });
  }

  return candidates;
}

function discoverProgressions(pips, features) {
  const candidates = [];

  // Check for constant-value sequences (delta=0)
  if (features.deltas.length > 0 && features.deltas.every(d => d === 0)) {
    if (pips.length >= 2) {
      candidates.push({
        node: new DRepeat(new DLiteral([pips[0]]), pips.length),
        kind: 'constant-repeat',
      });
    }
  }

  // Check for non-unit arithmetic progressions covering the full sequence
  for (const run of features.progressions) {
    if (run.start !== 0 || run.end !== pips.length - 1) continue;
    if (run.delta === 1 || run.delta === -1 || run.delta === 0) continue;
    const count = run.length;
    const rangeEnd = count - 1;

    if (run.startVal === 0) {
      candidates.push({
        node: new DBinOp('^', new DRange(0, rangeEnd), new DLiteral([{ step: run.delta, timeScale: 1 }])),
        kind: 'progression',
      });
    } else {
      const scaled = new DBinOp('^', new DRange(0, rangeEnd), new DLiteral([{ step: run.delta, timeScale: 1 }]));
      candidates.push({
        node: new DBinOp('*', scaled, new DLiteral([{ step: run.startVal, timeScale: 1 }])),
        kind: 'progression',
      });
    }
  }

  // Sub-sequence progressions: build segmented candidate
  const nonUnitRuns = features.progressions.filter(
    r => r.delta !== 1 && r.delta !== -1 && r.delta !== 0 && r.length >= 3
  );
  if (nonUnitRuns.length > 0) {
    const parts = buildSegmentedCandidate(pips, nonUnitRuns, (run) => {
      const count = run.length;
      const rangeEnd = count - 1;
      if (run.startVal === 0) {
        return new DBinOp('^', new DRange(0, rangeEnd), new DLiteral([{ step: run.delta, timeScale: 1 }]));
      } else {
        const scaled = new DBinOp('^', new DRange(0, rangeEnd), new DLiteral([{ step: run.delta, timeScale: 1 }]));
        return new DBinOp('*', scaled, new DLiteral([{ step: run.startVal, timeScale: 1 }]));
      }
    });
    if (parts && parts.length < pips.length) {
      candidates.push({
        node: parts.length === 1 ? parts[0] : new DConcat(parts),
        kind: 'progression-segments',
      });
    }
  }

  return candidates;
}

// Helper: given runs that cover portions of pips, build a DConcat
// filling gaps with DLiteral. runNodeFn(run) returns the AST for that run.
function buildSegmentedCandidate(pips, runs, runNodeFn) {
  // Sort runs by start position
  const sorted = [...runs].sort((a, b) => a.start - b.start);

  // Remove overlapping runs (keep the longer one)
  const filtered = [];
  for (const run of sorted) {
    if (filtered.length === 0) {
      filtered.push(run);
    } else {
      const prev = filtered[filtered.length - 1];
      if (run.start <= prev.end) {
        // Overlap: keep the longer one
        if (run.length > prev.length) {
          filtered[filtered.length - 1] = run;
        }
      } else {
        filtered.push(run);
      }
    }
  }

  const parts = [];
  let cursor = 0;

  for (const run of filtered) {
    // Gap before this run
    if (run.start > cursor) {
      parts.push(new DLiteral(pips.slice(cursor, run.start)));
    }
    parts.push(runNodeFn(run));
    cursor = run.end + 1;
  }

  // Trailing gap
  if (cursor < pips.length) {
    parts.push(new DLiteral(pips.slice(cursor)));
  }

  return parts;
}

// ============================================================================
// Kernel Discovery
// ============================================================================
// Finds a short motif (the "kernel") and shows how the surface derives from
// transformations of it. Reveals thematic self-similarity — the generative
// heart of the material — even when the resulting program is longer than the literal.

const MIN_KERNEL_LEN = 3;
const MAX_KERNEL_LEN_CAP = 8;
const MAX_KERNEL_CANDIDATES = 50;
const MIN_KERNEL_COVERAGE = 0.4;
const KERNEL_TRANSFORM_COUNT = 3; // identity, transposition, retrograde (phase 1)

// Interval profile: the sequence of step deltas between adjacent pips.
// Two subsequences with the same profile are the same kernel modulo transposition.
function intervalProfile(pips) {
  const profile = [];
  for (let i = 1; i < pips.length; i++) {
    profile.push(pips[i].step - pips[i - 1].step);
  }
  return profile.join(',');
}

// Generate candidate kernels from the surface. Deduplicates by interval profile
// and weights toward earlier positions (the generating motif often appears first)
// and shorter lengths (more parsimonious).
function generateKernelCandidates(pips) {
  const maxLen = Math.min(MAX_KERNEL_LEN_CAP, Math.floor(pips.length / 2));
  if (maxLen < MIN_KERNEL_LEN) return [];

  const seen = new Map(); // intervalProfile -> true
  const candidates = [];

  for (let len = MIN_KERNEL_LEN; len <= maxLen; len++) {
    for (let start = 0; start <= pips.length - len; start++) {
      const sub = pips.slice(start, start + len);
      const profile = intervalProfile(sub);

      if (!seen.has(profile)) {
        seen.set(profile, true);
        // Weight: prefer earlier positions and shorter kernels
        const positionWeight = 1 / (1 + start);
        const parsimonyWeight = 1 / len;
        const weight = positionWeight * 0.7 + parsimonyWeight * 0.3;
        candidates.push({ pips: sub, startIndex: start, length: len, weight });
      }
    }
  }

  candidates.sort((a, b) => b.weight - a.weight);
  return candidates.slice(0, MAX_KERNEL_CANDIDATES);
}

// --- Transformation Matchers ---
// Each takes kernel K and target T (same length, step-only),
// returns {transform, params, buildAST(kernelRef)} or null.

function matchIdentity(K, T) {
  for (let i = 0; i < K.length; i++) {
    if (K[i].step !== T[i].step) return null;
  }
  return {
    transform: 'identity',
    params: {},
    buildAST: (ref) => ref,
  };
}

function matchTransposition(K, T) {
  const offset = T[0].step - K[0].step;
  if (offset === 0) return null; // that's identity
  for (let i = 1; i < K.length; i++) {
    if (T[i].step - K[i].step !== offset) return null;
  }
  return {
    transform: 'transposition',
    params: { offset },
    buildAST: (ref) => new DBinOp('*', ref, new DLiteral([{ step: offset, timeScale: 1 }])),
  };
}

function matchRetrograde(K, T) {
  const n = K.length;
  const offset = T[0].step - K[n - 1].step;
  for (let i = 0; i < n; i++) {
    if (T[i].step - K[n - 1 - i].step !== offset) return null;
  }
  return {
    transform: 'retrograde',
    params: { offset },
    buildAST: (ref) => new DBinOp('*', ref, new DLiteral([{ step: offset, timeScale: -1 }])),
  };
}

// Try all matchers in priority order, return first match.
function matchWindow(kernel, window) {
  return matchIdentity(kernel, window)
      || matchTransposition(kernel, window)
      || matchRetrograde(kernel, window)
      || null;
}

// Scan the surface for all windows that match the kernel under some transformation.
function findKernelMatches(kernel, surface) {
  const kLen = kernel.length;
  const matches = [];

  for (let i = 0; i <= surface.length - kLen; i++) {
    const window = surface.slice(i, i + kLen);
    const m = matchWindow(kernel, window);
    if (m) {
      matches.push({ start: i, end: i + kLen - 1, ...m });
    }
  }

  return matches;
}

// Greedy non-overlapping selection. Pick earliest match first among those
// at the best quality tier, mark pips as covered, repeat.
function selectCoverage(matches, surfaceLen) {
  // Sort by start position (prefer earlier matches for stable coverage)
  const sorted = [...matches].sort((a, b) => a.start - b.start);

  const covered = new Uint8Array(surfaceLen);
  const selected = [];

  for (const m of sorted) {
    let overlaps = false;
    for (let i = m.start; i <= m.end; i++) {
      if (covered[i]) { overlaps = true; break; }
    }
    if (overlaps) continue;

    for (let i = m.start; i <= m.end; i++) covered[i] = 1;
    selected.push(m);
  }

  const coveredCount = covered.reduce((sum, v) => sum + v, 0);
  return { selected, coverage: coveredCount / surfaceLen };
}

// Score a kernel candidate. Coverage dominates, structure rewards named variables,
// parsimony rewards shorter kernels, diversity rewards varied transforms.
function scoreKernel(coverage, kernelLength, uniqueTransforms, namedVarCount, surfaceLength) {
  const coverageScore = coverage;
  const parsimonyScore = 1 - (kernelLength / surfaceLength);
  const diversityScore = uniqueTransforms / KERNEL_TRANSFORM_COUNT;
  const structureScore = namedVarCount * 0.15;

  const total = coverageScore * 0.50
              + parsimonyScore * 0.10
              + diversityScore * 0.10
              + structureScore * 0.30;

  return { coverage: coverageScore, parsimony: parsimonyScore,
           diversity: diversityScore, structure: structureScore, total };
}

// Build a DProgram from the kernel, selected matches, and surface.
function buildKernelProgram(kernel, selected, surface) {
  const kernelName = 'nug';
  const kernelRef = new DRef(kernelName);
  const assignments = [];

  // First assignment: the kernel itself
  assignments.push({ name: kernelName, expr: new DLiteral(kernel) });

  // Group matches by transform signature (same transform+params = same variable)
  const groups = new Map();
  for (const m of selected) {
    const sig = m.transform + ':' + JSON.stringify(m.params);
    if (!groups.has(sig)) groups.set(sig, { matches: [], buildAST: m.buildAST, transform: m.transform });
    groups.get(sig).matches.push(m);
  }

  // Create a named variable for each non-identity group
  let varIndex = 0;
  const matchToRef = new Map();

  for (const [sig, group] of groups) {
    if (group.transform === 'identity') {
      for (const m of group.matches) matchToRef.set(m, kernelRef);
      continue;
    }

    const varName = generateVarName(varIndex++);
    const expr = group.buildAST(kernelRef);
    assignments.push({ name: varName, expr });

    const ref = new DRef(varName);
    for (const m of group.matches) matchToRef.set(m, ref);
  }

  // Build final expression: refs in surface order, with literal gaps
  const sortedMatches = [...selected].sort((a, b) => a.start - b.start);
  const parts = [];
  let cursor = 0;

  for (const m of sortedMatches) {
    if (m.start > cursor) {
      parts.push(new DLiteral(surface.slice(cursor, m.start)));
    }
    parts.push(matchToRef.get(m));
    cursor = m.end + 1;
  }

  if (cursor < surface.length) {
    parts.push(new DLiteral(surface.slice(cursor)));
  }

  const finalExpr = parts.length === 1 ? parts[0] : new DConcat(parts);
  return new DProgram(assignments, finalExpr);
}

// Main kernel discoverer. Called from discoverSteps().
function discoverKernels(pips, features) {
  const candidates = [];
  if (pips.length < 6) return candidates; // too short for kernel analysis

  const kernelCandidates = generateKernelCandidates(pips);

  for (const kc of kernelCandidates) {
    const matches = findKernelMatches(kc.pips, pips);
    if (matches.length < 2) continue; // need at least 2 occurrences

    const { selected, coverage } = selectCoverage(matches, pips.length);
    if (coverage < MIN_KERNEL_COVERAGE) continue;

    // Count unique transform types and named variables
    const uniqueTransforms = new Set(selected.map(m => m.transform)).size;
    const transformGroups = new Set(selected.map(m =>
      m.transform + ':' + JSON.stringify(m.params)));
    const hasIdentity = selected.some(m => m.transform === 'identity');
    // Named vars = kernel + non-identity groups
    const namedVarCount = 1 + (transformGroups.size - (hasIdentity ? 1 : 0));

    const kernelScore = scoreKernel(
      coverage, kc.length, uniqueTransforms, namedVarCount, pips.length);

    const program = buildKernelProgram(kc.pips, selected, pips);

    candidates.push({
      node: program,
      kind: 'kernel',
      kernelScore,
    });
  }

  // Sort by kernel score descending, return top 3
  candidates.sort((a, b) => b.kernelScore.total - a.kernelScore.total);
  return candidates.slice(0, 3);
}


// Run all step-only discoverers on a pip sequence.
function discoverSteps(pips, features) {
  const candidates = [];
  candidates.push(...discoverRanges(pips, features));
  candidates.push(...discoverRepeats(pips, features));
  candidates.push(...discoverProgressions(pips, features));
  candidates.push(...discoverKernels(pips, features));
  return candidates;
}

function discover(pips, features) {
  const candidates = [];

  // Always include the literal as a baseline (with original timeScales)
  candidates.push({ node: new DLiteral(pips), kind: 'literal' });

  if (allTsOne(pips)) {
    // All timeScales are 1: run discoverers directly, no factoring needed
    candidates.push(...discoverSteps(pips, features));
  } else {
    // Mixed timeScales: factor rhythm out, decompose steps, recombine with .j
    const stepPips = stripRhythm(pips);
    const rhythm = extractRhythm(pips);
    const stepFeatures = analyze(stepPips);

    // Discover on step-only sequence
    const stepCandidates = discoverSteps(stepPips, stepFeatures);

    // Build rhythm expression
    const rhythmExpr = buildRhythmExpr(rhythm);

    // For each step decomposition, wrap with .j rhythmExpr
    for (const sc of stepCandidates) {
      if (sc.node instanceof DProgram) {
        // DProgram can't be wrapped in DBinOp — add rhythm as a named
        // assignment and apply .j only to the final expression.
        const rhythmAssign = { name: 'rhythm', expr: rhythmExpr };
        const newFinal = new DBinOp('.j', sc.node.finalExpr, new DRef('rhythm'));
        const newProgram = new DProgram(
          [...sc.node.assignments, rhythmAssign],
          newFinal
        );
        candidates.push({
          node: newProgram,
          kind: sc.kind + '+rhythm',
          kernelScore: sc.kernelScore,
        });
      } else {
        candidates.push({
          node: new DBinOp('.j', sc.node, rhythmExpr),
          kind: sc.kind + '+rhythm',
        });
      }
    }

    // Also try: step literal .j compressed-rhythm (if rhythm compresses well)
    // This separates rhythm even when steps don't compress,
    // which can still be a win if the rhythm mask is very compact.
    const rhythmCompressed = compressRhythm(rhythm);
    if (rhythmCompressed) {
      const rhythmStr = rhythmCompressed.toString();
      const fullMaskStr = new DRhythmMask(rhythm).toString();
      // Only emit if the compressed rhythm is shorter than the full mask
      if (rhythmStr.length < fullMaskStr.length) {
        candidates.push({
          node: new DBinOp('.j', new DLiteral(stepPips), rhythmCompressed),
          kind: 'rhythm-factor',
        });
      }
    }

    // Also run discoverers on original pips (with timeScales) for repeat detection.
    // A sequence like [0|/2, 3|/2, 0|/2, 3|/2] repeats including its rhythm.
    candidates.push(...discoverRepeats(pips, features));
  }

  return candidates;
}


// ============================================================================
// Assembler (Phase 3)
// ============================================================================

function verify(code, targetPips) {
  try {
    const result = golden.crux_interp(code);
    const lastSection = result.sections[result.sections.length - 1];
    if (!lastSection || !lastSection.values) return false;
    const actual = lastSection.values;
    if (actual.length !== targetPips.length) return false;
    for (let i = 0; i < actual.length; i++) {
      if (actual[i].step !== targetPips[i].step) return false;
      if (Math.abs(actual[i].timeScale - targetPips[i].timeScale) > 1e-10) return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

// Measure compression of the step portion only (exclude .j rhythm mask).
function compressionOf(code, targetPips) {
  const jIndex = code.indexOf(' .j ');
  let codeLen, baseLen;
  if (jIndex !== -1) {
    codeLen = code.substring(0, jIndex).length;
    baseLen = new DLiteral(stripRhythm(targetPips)).toString().length;
  } else {
    codeLen = code.length;
    baseLen = new DLiteral(targetPips).toString().length;
  }
  return 1 - (codeLen / baseLen);
}

// Score a candidate without hoisting.
function score(code, targetPips) {
  const compression = compressionOf(code, targetPips);
  return {
    compression,
    structure: 0,
    total: compression,
  };
}

// Score a hoisted candidate. Structure dominates: each named variable
// reveals a reusable motif, and each additional use of that variable
// reveals repetition. This matters more than character savings.
//
// Inter-variable relationships (transposition, retrograde) are the
// highest-value structural insight — they show how motifs transform
// into each other. These are rewarded heavily.
function scoreHoisted(code, targetPips, assignments, relationships = 0) {
  const compression = compressionOf(code, targetPips);

  // Structure score: reward naming motifs and their reuse.
  // Base credit for extracting a variable (0.15), plus credit for
  // each additional use beyond the first two (the minimum for hoisting).
  let structure = 0;
  for (const { uses } of assignments) {
    structure += 0.15;                         // named a motif
    structure += (uses - 2) * 0.05;            // extra reuses beyond the pair
  }

  // Inter-variable relationships: a variable expressed as a transformation
  // of another variable is a major structural insight (e.g., ac = aa * [-2]
  // says "this motif is a transposition of that motif"). Reward heavily.
  structure += relationships * 0.40;

  return {
    compression,
    structure,
    total: compression + structure,
  };
}

function assemble(targetPips, candidates) {
  const results = [];

  for (const candidate of candidates) {
    const { node, kind } = candidate;
    const code = node.toString();
    if (verify(code, targetPips)) {
      let finalCode = code;
      let finalScore = score(code, targetPips);
      let finalKind = kind;

      if (kind.startsWith('kernel') && candidate.kernelScore) {
        // Kernel programs have their own variable structure — skip hoisting.
        // Use kernel-specific scoring that rewards coverage and structure.
        finalScore = {
          compression: compressionOf(code, targetPips),
          ...candidate.kernelScore,
        };
      } else if (kind !== 'literal') {
        // Attempt variable hoisting for non-literal, non-kernel candidates
        const hoisted = attemptHoist(node, targetPips, kind);
        if (hoisted) {
          finalCode = hoisted.code;
          finalScore = hoisted.score;
          finalKind = hoisted.kind;
        }
      }

      results.push({
        code: finalCode,
        score: finalScore,
        kind: finalKind,
      });
    }
  }

  // Sort by total score descending (higher compression = better)
  results.sort((a, b) => b.score.total - a.score.total);

  // Deduplicate by code string
  const seen = new Set();
  const deduped = results.filter(r => {
    if (seen.has(r.code)) return false;
    seen.add(r.code);
    return true;
  });

  // Extract rhythm masks into a named `rhythm` variable for readability.
  // This makes it easier to compare compressed code with the flattened literal
  // because both share the same `rhythm` reference.
  for (const result of deduped) {
    if (result.kind === 'literal') continue;
    if (result.kind.startsWith('kernel')) continue; // kernel programs handle rhythm internally
    const lines = result.code.split('\n');
    const lastLine = lines[lines.length - 1];
    const jIdx = lastLine.indexOf(' .j ');
    if (jIdx === -1) continue;

    const stepPart = lastLine.substring(0, jIdx);
    const rhythmPart = lastLine.substring(jIdx + 4);

    lines[lines.length - 1] = `rhythm = ${rhythmPart}`;
    lines.push(`${stepPart} .j rhythm`);
    const newCode = lines.join('\n');

    if (verify(newCode, targetPips)) {
      result.code = newCode;
    }
  }

  return { candidates: deduped };
}


// ============================================================================
// Public API
// ============================================================================

function normalizePips(input) {
  if (typeof input === 'string') {
    const result = golden.crux_interp(input);
    const lastSection = result.sections[result.sections.length - 1];
    if (!lastSection || !lastSection.values) return [];
    return lastSection.values.map(p => ({ step: p.step, timeScale: p.timeScale }));
  }
  if (Array.isArray(input)) {
    return input.map(p => ({ step: p.step, timeScale: p.timeScale ?? 1 }));
  }
  return [];
}

golden.decompose = function (input, options = {}) {
  const pips = normalizePips(input);
  if (pips.length === 0) return { candidates: [] };

  // Single-pip: not worth decomposing
  if (pips.length === 1) {
    const lit = new DLiteral(pips);
    return {
      candidates: [{ code: lit.toString(), score: { compression: 0, total: 0 }, kind: 'literal' }],
    };
  }

  const features = analyze(pips);
  const candidates = discover(pips, features);
  return assemble(pips, candidates);
};


// === Fold view ===
// --- src/fold/trace.js ---
(function () {
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
const EXACT = { FollowedBy: ',', Mul: '*', Expand: '^', RepeatByCount: ':', Dot: '.', Mirror: 'm', MotTimeScaleOp: '||' };
const GENERIC = {
  JamOp: 'j', DotJam: '.j', DotExpand: '.^', RotateOp: '~', DotRotate: '.~', Steps: '->', DotSteps: '.->',
  DotMirror: '.m', Lens: 'l', DotLens: '.l', DotZip: '.,', ZipColumns: 'zip', GlassOp: 'g', DotGlass: '.g',
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


})();

// --- src/fold/thematic.js ---
const thematicFolds = (function () {
// Crux fold model, stops 6 to 8: relations that the program does not state.
//
//   6  unstated exact repeats: equal sub-runs stack on one copy
//   7  near-misses: runs that are still alone move onto a theme cell, with
//      bent notes. Then themes fold onto themes.
//   8  themes only: each theme shows its own run. Short stated cells stack on
//      a note of a theme, and everything else stacks on one residue marker.
//
// Called from foldModel (model.js). It works on the stop 5 picture, where each
// position is one "slot": one literal pip of one dictionary entry. Every note
// on a slot moves with it. See docs/plans/crux-fold-view.md, "Later folds".
//
// Terms used here:
// - A run is a sequence of slots of one entry that are next to each other in
//   the source: no rest between them and no other definition use. A rest
//   breaks a run.
// - An entry is stated when it is a program definition used more than once.
//   Its notes are explained by the program. Passages (definitions used once)
//   and top-level literals are not stated.
// - A theme cell is 3 or more slots of a stated entry, next to each other in
//   one run, that are still in place after the near-misses.
// - A move takes a slot onto a target slot. It keeps the transform:
//   slot step = sign * (target step + bent) + b, sign -1 when mirrored.
//   Moves chain, and bents add up along the chain in the last target's frame.

const EPS = 1e-9;
const r6 = x => String(Math.round(x * 1e6) / 1e6 || 0);
const near = (a, b) => Math.abs(a - b) < 1e-6;
const z = x => (x === 0 ? 0 : x);
// mirror, reverse
const ORIENTS = [[false, false], [true, false], [false, true], [true, true]];

function orient(win, mir, rev) {
  const seq = rev ? win.slice().reverse() : win;
  return seq.map(S => ({
    S, s: mir ? -S.s : S.s, d: S.d, tag: S.tag,
    diad: S.diad ? S.diad.map(o => (mir ? -o : o)).sort((a, b) => a - b) : null,
  }));
}

// Shape key up to transposition and uniform stretch.
function shapeKey(seq) {
  const s0 = seq[0].s, d0 = seq[0].d;
  return seq.map(x => `${r6(x.s - s0)}:${r6(x.d / d0)}:${x.diad ? x.diad.map(r6).join('&') : ''}:${x.tag ?? ''}`).join(' ');
}

// The smallest key over the four orientations. seq[k].S is the slot at
// canonical index k, so two windows with the same key map slot to slot.
function canon(win) {
  let best = null;
  for (const [mir, rev] of ORIENTS) {
    const seq = orient(win, mir, rev);
    const key = shapeKey(seq);
    if (!best || key < best.key) best = { key, mir, rev, seq };
  }
  return best;
}

// The best match of `win` against an equal-length window of one of `targets`
// (each { slots }). Rhythm equal up to uniform stretch, at least half of the
// notes exact, at most maxBent(L, ratio) bent notes, and no note bent by more
// than maxBend steps. Ranked by exact notes, then length, then fewest bent
// notes; the first found wins a tie.
function bestMatch(win, targets, maxBent, maxBend, best = null) {
  const L = win.length;
  for (const T of targets) {
    for (let j = 0; j + L <= T.slots.length; j++) {
      const tw = T.slots.slice(j, j + L);
      if (tw.some(X => win.includes(X))) continue;
      for (const [mir, rev] of ORIENTS) {
        const seq = orient(tw, mir, rev);
        const ratio = win[0].d / seq[0].d;
        if (!win.every((S, k) => near(S.d, seq[k].d * ratio))) continue;
        // The transposition that keeps the most notes exact; on a tie, the
        // smallest one.
        const tally = new Map();
        let b = null, exact = 0;
        for (let k = 0; k < L; k++) {
          const key = r6(win[k].s - seq[k].s);
          tally.set(key, (tally.get(key) || 0) + 1);
        }
        for (const [key, c] of tally) {
          const x = Number(key);
          if (c > exact || (c === exact && Math.abs(x) < Math.abs(b))) { exact = c; b = x; }
        }
        const bent = L - exact;
        if (bent > maxBent(L, ratio) || 2 * exact < L) continue;
        if (!win.every((S, k) => Math.abs(S.s - seq[k].s - b) <= maxBend + EPS)) continue;
        if (!best || exact > best.exact || (exact === best.exact && (L > best.win.length ||
            (L === best.win.length && bent < best.bent)))) {
          best = { win, target: T, seq, mir, rev, b, exact, bent, ratio };
        }
      }
    }
  }
  return best;
}

// The move of win[k] in match m.
function moveFor(S, k, m) {
  const T = m.seq[k].S;
  const off = S.s - (m.seq[k].s + m.b);
  return { to: T, bent: z(m.mir ? -off : off), mir: m.mir, rev: m.rev, b: m.b };
}

// Slot X next to the target of a move from N, on the side of S.
// S sits at N's index + d in its own run.
function edgeTarget(S, N, d, m, maxBend) {
  const T = m.to;
  const X = T.run.slots[T.k + d * (m.rev ? -1 : 1)];
  if (!X || X === S || X === N) return null;
  if (!near(S.d * T.d, X.d * N.d)) return null;
  const sgn = m.mir ? -1 : 1;
  const b = N.s - sgn * (T.s + m.bent);
  const bent = z(sgn * (S.s - b) - X.s);
  if (Math.abs(bent) > maxBend + EPS) return null;
  return { to: X, bent, mir: m.mir, rev: m.rev, b };
}

/**
 * notes:   the model's notes, with pos[1..5]
 * recs:    every pip of every voice (model.js), rec.note set for sounding pips
 * entries: dictionary entries in stop 5 layout order
 * relate(rec, use): { a, b } so that a step in rec's owner body maps to
 *          a * step + b in the body of the definition use `use`, or null
 */
function thematicFolds({ notes, recs, entries, relate, written }, options = {}) {
  const minLength = options.minLength ?? 3;
  // Stop 7 never matches fewer than 3 notes, whatever minLength is.
  const nearLength = Math.max(3, minLength);
  const themeLength = options.themeLength ?? 3;
  // A theme folds onto another theme on a match of foldLength notes or more.
  // A shorter match counts only when it is all of both themes, or all of the
  // target and all but one note of the theme that folds.
  const foldLength = options.foldLength ?? 5;
  // Stop 8 shows the program's themes. With showFound, the repeats that the
  // fold found outside them are units too. Without it they go to the residue.
  const showFound = !!options.showFound;
  const gap = options.gap ?? 0.5;
  // A bent note moves at most a third (2 scale steps) from the theme.
  const maxBend = options.maxBend ?? 2;
  const stated = E => E.name != null && E.count >= 2;
  // 3 notes: exact only. 4 notes: 1 bent, or 2 when the durations are equal
  // (no stretch). Longer: 2.
  const maxBent = (L, ratio) => (L <= 3 ? 0 : L === 4 ? (near(ratio, 1) ? 2 : 1) : 2);

  // Slots: one per stop 5 position.
  const firstInstance = new Map();
  const slotByKey = new Map();
  const slotOfNote = [];
  for (const n of notes) {
    if (!firstInstance.has(n.entry)) firstInstance.set(n.entry, n.instance);
    // t and d are written durations: the folds match on them. x and w are
    // the shown layout of stop 5, which the layouts below keep.
    const shown = n.pos[5];
    const p = written ? written[n.id] : shown;
    const key = n.entry + '|' + r6(p.t);
    let S = slotByKey.get(key);
    if (!S) {
      S = { id: slotByKey.size, key, entry: entries.find(E => E.id === n.entry), t: p.t, s: shown.step, d: p.d,
        x: shown.t, w: shown.d, capped: !!shown.capped,
        diad: n.diad, tag: n.tag, notes: [], first: null };
      slotByKey.set(key, S);
    }
    S.notes.push(n);
    if (!S.first && n.instance === firstInstance.get(n.entry)) S.first = n;
    slotOfNote[n.id] = S;
  }
  const allSlots = [...slotByKey.values()];
  const slotsOf = new Map(entries.map(E => [E.id, []]));
  for (const S of allSlots) {
    S.first ||= S.notes[0];
    slotsOf.get(S.entry.id).push(S);
  }
  for (const list of slotsOf.values()) list.sort((a, b) => a.t - b.t);

  // Runs.
  const runs = [];
  for (const E of entries) {
    let cur = null;
    for (const S of slotsOf.get(E.id)) {
      const prev = cur && cur.slots[cur.slots.length - 1];
      const joined = prev && near(prev.t + prev.d, S.t) && prev.first.voice === S.first.voice &&
        Math.abs(prev.first.index - S.first.index) === 1;
      if (!joined) { cur = { order: runs.length, entry: E, slots: [] }; runs.push(cur); }
      S.k = cur.slots.length;
      cur.slots.push(S);
      S.run = cur;
    }
  }

  const move6 = new Map();
  const move7 = new Map();
  const moveAt = (S, stop) => (stop >= 6 && move6.get(S)) || (stop >= 7 && move7.get(S)) || null;
  const finalOf = (S, stop) => {
    let cur = S, bent = 0;
    for (let g = 0; g < 64; g++) {
      const m = moveAt(cur, stop);
      if (!m) break;
      bent = m.bent + (m.mir ? -bent : bent);
      cur = m.to;
    }
    return { S: cur, bent: z(bent) };
  };

  // Stop 6: unstated exact repeats. Longest first, then most frequent.
  const assigned = new Set();
  const found = [];
  const rank = o => (stated(o.run.entry) ? o.run.entry.count : 0);
  const maxRun = runs.reduce((m, R) => Math.max(m, R.slots.length), 0);
  for (let L = maxRun; L >= minLength; L--) {
    const byKey = new Map();
    for (const R of runs) {
      for (let i = 0; i + L <= R.slots.length; i++) {
        const win = R.slots.slice(i, i + L);
        // A slot that moved is gone. A slot that stayed as the copy of an
        // earlier repeat can be the copy again (fixed), but cannot move.
        if (win.some(S => move6.has(S))) continue;
        const fixed = win.some(S => assigned.has(S));
        const c = canon(win);
        let list = byKey.get(c.key);
        if (!list) byKey.set(c.key, (list = []));
        list.push({ run: R, start: i, slots: win, c, fixed });
      }
    }
    const keys = [...byKey.values()].filter(l => l.length >= 2).sort((a, b) => b.length - a.length);
    for (const list of keys) {
      const picked = [];
      const used = new Set();
      for (const o of list) {
        if (o.slots.some(S => move6.has(S) || used.has(S)) || (!o.fixed && o.slots.some(S => assigned.has(S)))) continue;
        picked.push(o);
        o.slots.forEach(S => used.add(S));
      }
      if (picked.length < 2) continue;
      // The copy that stays: in the most used stated definition, else the first.
      // A fixed copy comes before a free one of the same rank.
      const rep = picked.slice().sort((a, b) => rank(b) - rank(a) || (b.fixed ? 1 : 0) - (a.fixed ? 1 : 0))[0];
      // A stated definition moves only as a whole run: the fold does not cut
      // the program's own cells apart. A part of one can still be the copy
      // that stays, and it counts as an occurrence.
      const whole = o => o.slots.length === o.run.slots.length;
      const movers = picked.filter(o => o !== rep && !o.fixed && (!stated(o.run.entry) || whole(o)));
      if (!movers.length) continue;
      // A short shape is weak evidence: it needs 3 occurrences, or a mover
      // that is a whole stated definition.
      if (L < 4 && picked.length < 3 && !movers.some(o => stated(o.run.entry))) continue;
      const kept = [rep, ...movers];
      const group = { id: 'F' + (found.length + 1), length: L, rep, occurrences: kept };
      for (const o of kept) {
        o.slots.forEach(S => { assigned.add(S); S.found ||= group; });
        if (o === rep) continue;
        const mir = o.c.mir !== rep.c.mir, rev = o.c.rev !== rep.c.rev;
        o.c.seq.forEach((x, k) => {
          const T = rep.c.seq[k].S;
          move6.set(x.S, { to: T, bent: 0, mir, rev, b: x.S.s - (mir ? -T.s : T.s) });
        });
      }
      found.push(group);
    }
  }

  // Stop 7, first part: runs that are still alone, onto stated cells.
  const statedRuns = runs.filter(R => stated(R.entry) && R.slots.length >= minLength);
  const nearMatches = [];
  const free = S => !assigned.has(S) && !stated(S.entry);
  for (;;) {
    let best = null;
    for (const R of runs) {
      if (stated(R.entry)) continue;
      const segs = [];
      let cur = [];
      for (const S of R.slots) {
        if (free(S)) cur.push(S);
        else { if (cur.length) segs.push(cur); cur = []; }
      }
      if (cur.length) segs.push(cur);
      for (const seg of segs) {
        for (let L = seg.length; L >= nearLength; L--) {
          for (let i = 0; i + L <= seg.length; i++) best = bestMatch(seg.slice(i, i + L), statedRuns, maxBent, maxBend, best);
        }
      }
    }
    if (!best) break;
    const match = { kind: 'run', theme: best.target.entry.id, name: best.target.entry.name, notes: best.win.length, bent: best.bent,
      mirror: best.mir, reverse: best.rev, transpose: best.b, stretch: best.ratio, slots: best.win, bentNotes: [] };
    best.win.forEach((S, k) => {
      const mv = moveFor(S, k, best);
      assigned.add(S);
      S.near = match;
      move7.set(S, mv);
      if (mv.bent) match.bentNotes.push({ step: S.s, bent: mv.bent });
    });
    nearMatches.push(match);
  }

  // Stop 7, second part: a single note left alone at the edge of a repeat or
  // a near-miss joins it as a bent note, when the target has a note there
  // with the same rhythm, that note is itself explained (stated or matched),
  // the bend is maxBend steps or less, and the match stays within the bent
  // limits with the note added.
  const edgeJoins = [];
  for (const R of runs) {
    if (stated(R.entry)) continue;
    R.slots.forEach((S, k) => {
      if (!free(S)) return;
      for (const d of [-1, 1]) {
        const N = R.slots[k - d], far = R.slots[k + d];
        if (!N || free(N) || !assigned.has(N) || (far && free(far))) continue;
        const m = move6.get(N) || move7.get(N);
        if (!m) continue;
        const mv = edgeTarget(S, N, d, m, maxBend);
        if (!mv || !(stated(mv.to.entry) || assigned.has(mv.to))) continue;
        const group = N.near ? N.near.slots : N.found.occurrences.find(o => o.slots.includes(N)).slots;
        const bentNow = N.near ? N.near.bent : 0;
        const L = group.length + 1, nb = bentNow + (mv.bent ? 1 : 0);
        if (mv.bent && (nb > maxBent(L, S.d / mv.to.d) || 2 * (L - nb) < L)) continue;
        edgeJoins.push({ S, mv });
        return;
      }
    });
  }
  for (const { S, mv } of edgeJoins) {
    const match = { kind: 'edge', theme: mv.to.entry.id, name: mv.to.entry.name, notes: 1, bent: mv.bent ? 1 : 0,
      mirror: mv.mir, reverse: mv.rev, transpose: mv.b, stretch: 1, slots: [S], bentNotes: mv.bent ? [{ step: S.s, bent: mv.bent }] : [] };
    assigned.add(S);
    S.near = match;
    move7.set(S, mv);
    nearMatches.push(match);
  }

  // Stop 7, third part: themes fold onto themes. Theme cells are ranked by
  // the notes that land on them so far. Each tries to fold onto a cell ranked
  // above it that is still a theme, by the same rules as a near-miss: whole
  // or a part of 3 or more notes on either side. The match must cover all of
  // the target, or all but one note of the theme that folds: a short common
  // fragment (a triad, three notes of a scale) does not make two themes one.
  // Two themes are two shapes in the program, so one bent note at most, and
  // none in a match shorter than foldLength.
  const themeBent = (L, ratio) => (L < foldLength ? 0 : Math.min(1, maxBent(L, ratio)));
  const landed = new Map();
  for (const S of allSlots) {
    const F = finalOf(S, 7).S;
    landed.set(F, (landed.get(F) || 0) + S.notes.length);
  }
  const cells = [];
  for (const R of runs) {
    if (!stated(R.entry)) continue;
    let cur = [];
    const flush = () => { if (cur.length >= themeLength) cells.push({ entry: R.entry, slots: cur }); cur = []; };
    for (const S of R.slots) { if (!moveAt(S, 7)) cur.push(S); else flush(); }
    flush();
  }
  const cellsPerEntry = new Map();
  for (const C of cells) {
    const k = (cellsPerEntry.get(C.entry.id) || 0) + 1;
    cellsPerEntry.set(C.entry.id, k);
    C.id = C.entry.id + (k > 1 ? '.' + k : '');
    C.landed = C.slots.reduce((n, S) => n + (landed.get(S) || 0), 0);
  }
  const ranked = cells.slice().sort((a, b) => b.landed - a.landed ||
    entries.indexOf(a.entry) - entries.indexOf(b.entry) || a.slots[0].t - b.slots[0].t);
  const alive = [];
  const themeFolds = [];
  for (const C of ranked) {
    let best = null;
    for (let L = C.slots.length; L >= nearLength; L--) {
      const whole = L >= C.slots.length - 1;
      const targets = alive.filter(D => (L >= foldLength ? whole || L === D.slots.length : whole && L === D.slots.length));
      for (let i = 0; i + L <= C.slots.length; i++) best = bestMatch(C.slots.slice(i, i + L), targets, themeBent, maxBend, best);
    }
    if (!best) { alive.push(C); continue; }
    const D = best.target;
    const fold = { from: C.id, name: C.entry.name, onto: D.id, ontoName: D.entry.name, landed: C.landed,
      length: best.win.length, of: C.slots.length, exact: best.exact, bent: best.bent,
      mirror: best.mir, reverse: best.rev, transpose: best.b, stretch: best.ratio,
      steps: C.slots.map(S => S.s), ontoSteps: D.slots.map(S => S.s), bentNotes: [], edge: null, leftover: [] };
    best.win.forEach((S, k) => {
      const mv = moveFor(S, k, best);
      move7.set(S, mv);
      S.themeFold = fold;
      if (mv.bent) fold.bentNotes.push({ step: S.s, onto: mv.to.s, bent: mv.bent });
    });
    // Notes of C outside the match: one alone at an edge joins as a bent note
    // when D has a note there; the others stack on the nearest matched note.
    const i0 = C.slots.indexOf(best.win[0]);
    const i1 = i0 + best.win.length - 1;
    for (const [rest, N, d] of [[C.slots.slice(0, i0).reverse(), C.slots[i0], -1], [C.slots.slice(i1 + 1), C.slots[i1], 1]]) {
      if (!rest.length) continue;
      const mv = rest.length === 1 ? edgeTarget(rest[0], N, d, move7.get(N), maxBend) : null;
      const L = best.win.length + 1, nb = best.bent + (mv && mv.bent ? 1 : 0);
      if (mv && D.slots.includes(mv.to) && (!mv.bent || (nb <= maxBent(L, best.ratio) && 2 * (L - nb) >= L))) {
        move7.set(rest[0], mv);
        rest[0].themeFold = fold;
        fold.bent += mv.bent ? 1 : 0;
        fold.edge = { step: rest[0].s, onto: mv.to.s, bent: mv.bent };
        if (mv.bent) fold.bentNotes.push({ step: rest[0].s, onto: mv.to.s, bent: mv.bent });
        continue;
      }
      for (const S of rest) { S.leftover = { fold, host: N }; fold.leftover.push(S.s); }
    }
    themeFolds.push(fold);
  }

  // Stop 8. Kinds of the slots still in place.
  const themeOf = new Map();
  for (const C of alive) for (const S of C.slots) themeOf.set(S, C);
  const kept8 = allSlots.filter(S => !moveAt(S, 7));
  const kindOf = S => (themeOf.has(S) ? 'theme' : S.leftover ? 'leftover' : S.found ? 'found' : stated(S.entry) ? 'cell' : 'residue');

  // Where each slot stacks at stop 8: a theme slot, a found slot, or nothing
  // (the residue marker).
  const hostSlot = new Map();
  for (const S of kept8) {
    const k = kindOf(S);
    if (k === 'theme' || k === 'found') hostSlot.set(S, S);
  }
  for (const S of kept8) {
    if (kindOf(S) === 'leftover') hostSlot.set(S, finalOf(S.leftover.host, 7).S);
  }

  // A short stated cell stacks on a note of the theme next to it in its own
  // definition (for example the last note of T = T9, [2] goes on T9). The note:
  // the cell's place in the theme's frame, then the theme note nearest in
  // time, then nearest in step.
  const recsByVoice = [];
  for (const rec of recs) (recsByVoice[rec.voice] ||= [])[rec.index] = rec;
  const anchorOf = S => {
    const n = S.first;
    const rec = recsByVoice[n.voice][n.index];
    const own = rec.a.owner;
    if (!own) return null;
    const inside = r => r && r.a.frames.some(f => f.kind === 'ref' && f.use === own.use);
    const list = recsByVoice[n.voice];
    const pick = r => {
      const rel = relate(r, own.use);
      if (!rel || !rel.a) return null;
      const AS = slotOfNote[r.note.id];
      const x = (S.s - rel.b) / rel.a;
      const ratio = AS.d / r.note.pos[1].d;
      return { AS, dt: (n.pos[1].t - r.note.pos[1].t) * ratio, dstep: x - AS.s };
    };
    for (let i = n.index - 1; i >= 0 && inside(list[i]); i--) {
      if (list[i].sounding && list[i].note.entry !== n.entry) return pick(list[i]);
    }
    for (let i = n.index + 1; i < list.length && inside(list[i]); i++) {
      if (list[i].sounding && list[i].note.entry !== n.entry) return pick(list[i]);
    }
    return null;
  };
  const nearestIn = (list, t, s) => {
    let best = null, bd = Infinity, bs = Infinity;
    for (const X of list) {
      const lt = X.t - list[0].t;
      const d = Math.max(0, lt - t, t - (lt + X.d));
      const ds = Math.abs(X.s - s);
      if (d < bd - EPS || (Math.abs(d - bd) < EPS && ds < bs - EPS)) { best = X; bd = d; bs = ds; }
    }
    return best;
  };
  const cellSlots = kept8.filter(S => kindOf(S) === 'cell');
  const anchors = new Map(cellSlots.map(S => [S, anchorOf(S)]).filter(([, a]) => a));
  for (let round = 0, changed = true; changed && round <= cellSlots.length; round++) {
    changed = false;
    for (const [S, a] of anchors) {
      if (hostSlot.has(S)) continue;
      const F = finalOf(a.AS, 7).S;
      const H = hostSlot.get(F);
      if (!H) continue;
      const C = themeOf.get(H);
      const target = C && F === H ? nearestIn(C.slots, (F.t - C.slots[0].t) + a.dt, F.s + a.dstep) : H;
      hostSlot.set(S, target);
      changed = true;
    }
  }

  // Lay a unit out: its slots in order, keeping the time between slots of one
  // entry less the slots that left it. Returns local times.
  function compact(list) {
    const inUnit = new Set(list);
    const local = new Map();
    let cursor = 0, prev = null;
    for (const S of list) {
      if (prev && prev.entry === S.entry) {
        let g = S.x - (prev.x + prev.w);
        for (const X of slotsOf.get(S.entry.id)) {
          if (X.t > prev.t + EPS && X.t < S.t - EPS && !inUnit.has(X)) g -= X.w;
        }
        cursor += Math.max(0, g);
      } else if (prev) cursor += gap / 2;
      local.set(S, cursor);
      cursor += S.w;
      prev = S;
    }
    return local;
  }

  // Place units side by side. A marker unit has no slots and one position.
  const MARKER = 0.5;
  function place(units) {
    let x = 0;
    const at = new Map();
    for (const U of units) {
      U.x = x;
      if (U.marker) {
        U.width = MARKER;
      } else {
        let lo = Infinity, hi = -Infinity;
        for (const [S, p] of U.local) { lo = Math.min(lo, p.t); hi = Math.max(hi, p.t + S.w); }
        U.width = hi - lo;
        for (const [S, p] of U.local) at.set(S, { t: x + p.t - lo, step: p.step, d: S.w, capped: S.capped, unit: U });
      }
      x += U.width + gap;
    }
    return at;
  }

  const unitFor = (kind, id, name, slots) => {
    const lt = compact(slots);
    const local = new Map(slots.map(S => [S, { t: lt.get(S), step: S.s }]));
    return { kind, id, name, slots, local };
  };

  // Stops 6 and 7: entries side by side, less the slots that moved.
  const layouts = {};
  for (const stop of [6, 7]) {
    const units = [];
    for (const E of entries) {
      const slots = slotsOf.get(E.id).filter(S => !moveAt(S, stop));
      if (slots.length) units.push(unitFor('entry', E.id, E.name, slots));
    }
    layouts[stop] = { units, at: place(units) };
  }

  // Stop 8: theme cells in source order, then found shapes outside themes,
  // then one residue marker.
  const units8 = [];
  const byOrder = (a, b) => entries.indexOf(a.entry) - entries.indexOf(b.entry) || a.slots[0].t - b.slots[0].t;
  for (const C of alive.slice().sort(byOrder)) {
    const U = unitFor('theme', C.id, C.entry.name, C.slots.slice());
    U.cell = C;
    units8.push(U);
  }
  for (const g of showFound ? found : []) {
    if (moveAt(g.rep.slots[0], 7) || kindOf(g.rep.slots[0]) !== 'found') continue;
    units8.push(unitFor('found', g.id, null, g.rep.slots.slice().sort((a, b) => a.t - b.t)));
  }
  const residueUnit = { kind: 'residue', id: 'residue', name: null, slots: [], local: new Map(), marker: true };
  const placeOf = S => {
    const F = finalOf(S, 7).S;
    const k = kindOf(F);
    if (k === 'theme' || (k === 'found' && showFound)) return { F, H: F, kind: k };
    const H = k === 'found' ? null : hostSlot.get(F);
    return H && (showFound || kindOf(H) !== 'found') ? { F, H, kind: 'attached' } : { F, H: null, kind: 'residue' };
  };
  const places = notes.map(n => placeOf(slotOfNote[n.id]));
  if (places.some(p => p.kind === 'residue')) units8.push(residueUnit);
  const at8 = place(units8);
  const residuePos = { t: residueUnit.x, step: 0, d: MARKER, unit: residueUnit };

  // Explained by: the program, unless a theme of the program folded onto
  // another theme, then by that fold (near, or repeat when exact).
  const foldOn = S => {
    for (let cur = S, g = 0; cur && g < 64; g++) {
      if (cur.themeFold) return cur.themeFold;
      if (cur.leftover) return cur.leftover.fold;
      const m = moveAt(cur, 7);
      if (!m) return null;
      cur = m.to;
    }
    return null;
  };
  const explainedOf = S => {
    if (stated(S.entry)) {
      const f = foldOn(S);
      return f ? (f.bent ? 'near' : 'repeat') : 'program';
    }
    return S.found ? 'repeat' : S.near ? 'near' : null;
  };

  const out = notes.map((n, k) => {
    const S = slotOfNote[n.id];
    const pl = places[k];
    const pos = [6, 7].map(stop => {
      const p = layouts[stop].at.get(finalOf(S, stop).S);
      return p.capped ? { t: p.t, step: p.step, d: p.d, capped: true } : { t: p.t, step: p.step, d: p.d };
    });
    const p8 = pl.H ? at8.get(pl.H) : residuePos;
    pos.push(p8.capped ? { t: p8.t, step: p8.step, d: p8.d, capped: true } : { t: p8.t, step: p8.step, d: p8.d });
    const owner = pl.F.entry.name ?? pl.F.entry.id;
    return { pos, bent: finalOf(S, 7).bent, explainedBy: explainedOf(S),
      // rep: a note of the slot this note sits on at stop 8, the theme's (or
      // found shape's) own note there. Stops 9 and 10 open the themes from it.
      fold8: { unit: p8.unit.id, kind: pl.kind, owner: pl.kind === 'attached' || pl.kind === 'residue' ? owner : null,
        rep: pl.H ? pl.H.first.id : null },
      unit6: layouts[6].at.get(finalOf(S, 6).S).unit, unit7: layouts[7].at.get(finalOf(S, 7).S).unit, unit8: p8.unit };
  });

  const explained = { program: 0, repeat: 0, near: 0, none: 0 };
  for (const o of out) explained[o.explainedBy ?? 'none']++;
  const tally = key => {
    const m = new Map();
    for (const o of out) m.set(o[key], (m.get(o[key]) || 0) + 1);
    return m;
  };
  const t6 = tally('unit6'), t7 = tally('unit7'), t8 = tally('unit8');
  const groupOwners = list => {
    const m = new Map();
    for (const o of list) m.set(o.fold8.owner, (m.get(o.fold8.owner) || 0) + 1);
    return [...m].map(([owner, notes]) => ({ owner, notes }));
  };
  const describe = (U, t) => ({ id: U.id, kind: U.kind, name: U.name, x: U.x, width: U.width,
    positions: U.marker ? 1 : U.slots.length, notes: t.get(U) || 0 });
  const units8Out = units8.map(U => {
    const mine = out.filter(o => o.unit8 === U);
    const att = mine.filter(o => o.fold8.kind === 'attached');
    const d = describe(U, t8);
    d.own = mine.length - att.length;
    d.attached = groupOwners(att);
    d.attachedNotes = att.length;
    return d;
  });
  const slotSummary = list => list.map(S => ({ entry: S.entry.id, t: S.t, step: S.s }));
  const residueNotes = out.filter(o => o.fold8.kind === 'residue');

  return {
    notes: out.map(o => ({ pos: o.pos, bent: o.bent, explainedBy: o.explainedBy, fold8: o.fold8, unit8: units8.indexOf(o.unit8) })),
    summary: {
      minLength,
      slots: allSlots.length,
      runs: runs.length,
      explained,
      attachedNotes: out.filter(o => o.fold8.kind === 'attached').length,
      units: { 6: layouts[6].units.map(U => describe(U, t6)), 7: layouts[7].units.map(U => describe(U, t7)), 8: units8Out },
      found: found.map(g => ({ id: g.id, length: g.length, count: g.occurrences.length,
        occurrences: g.occurrences.map(o => ({ entry: o.run.entry.id, slots: slotSummary(o.slots), rep: o === g.rep })) })),
      near: nearMatches.map(m => ({ kind: m.kind, theme: m.theme, notes: m.notes, bent: m.bent, mirror: m.mirror, reverse: m.reverse,
        transpose: m.transpose, stretch: m.stretch, from: m.slots[0].entry.id, slots: slotSummary(m.slots), bentNotes: m.bentNotes })),
      themeFolds: themeFolds.map(f => ({ ...f })),
      themes: units8Out.filter(u => u.kind !== 'residue'),
      residue: { positions: residueNotes.length ? 1 : 0, notes: residueNotes.length,
        unexplained: residueNotes.filter(o => o.explainedBy === null).length,
        cells: groupOwners(residueNotes.filter(o => o.explainedBy !== null)) },
    },
  };
}

return thematicFolds;
})();

// --- src/fold/model.js ---
(function () {
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
//   9  themes opened: each theme note goes to the stop 5 place of its slot's
//      own note, so a theme shows the innermost shapes it is made of
//  10  cells: as 9, on the cell level, where partial and edited statements of
//      a definition fold onto it (an edited note keeps its offset in cellBent),
//      and the pips that `@` put in the place of one pip stack on that pip
//      (note.split)
//  11  core only: the cell-level entries of the definitions named in
//      `// #core` (or options.core); the notes their hosts write stack on
//      them, and every other note is on one residue marker
//
// A note's owner is the innermost definition it passed through. Frames inside
// the owner are the definition's own body and always apply. Frames outside it
// place the instance, and the stops take them away. A pip changed by an
// operator that the fold cannot undo (exact: false) is "edited": its owner is
// the innermost definition outside that operator, and its value after the
// operator is used as its source.
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
// With `cells` (the cell level, stop 10) an edited pip can stay with its
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

function foldModel(trace, options = {}) {
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

  // Stop 9: the inward reduction again, inside the themes.
  const o9 = openThemes({ entryList, info }, rec => rec.a);
  notes.forEach((n, k) => {
    n.pos[9] = o9.pos[k];
    n.fold9 = o9.at[k];
  });

  // Stop 10: the cell level. A changed pip of an operator that made two pips
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
  const o10 = openThemes(cellLevel, rec => rec.cl);
  for (const rec of all) {
    if (!rec.sounding) continue;
    const n = rec.note;
    n.pos[10] = o10.pos[n.id];
    n.fold10 = o10.at[n.id];
    n.cell = cellLevel.info.get(rec).I.entry.id;
    n.cellBent = rec.cl.bend;
    if (rec.cl.split) n.split = { ...rec.cl.split };
  }

  // Stop 11: core only. `// #core A B` in the program, or options.core,
  // names the core definitions by hand.
  const o11 = coreOnly(cellLevel);
  notes.forEach((n, k) => {
    n.pos[11] = o11.pos[k];
    n.fold11 = o11.at[k];
  });

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
    positions: [null, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(s => (s === null ? null : distinct(n => pk(n, s)))),
    shapes: [instanceCount, instanceCount, instanceCount, instanceCount, distinct(n => n.voice + '|' + n.entry), entryList.length,
      th.summary.units[6].length, th.summary.units[7].length, th.summary.units[8].filter(u => u.kind !== 'residue').length,
      o9.units.filter(u => u.kind !== 'residue').length, o10.units.filter(u => u.kind !== 'residue').length,
      o11.units.filter(u => u.kind !== 'residue').length],
    pipsWritten: distinct(n => pk(n, 5)),
    entries: entryList.length,
    explained: th.summary.explained,
    attached: th.summary.attachedNotes,
    core: o11.counts,
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
    inward: { themed: o9.themed, units: { 9: o9.units, 10: o10.units, 11: o11.units }, core: o11.core },
    stops: ['heard', 'scale steps', 'no transposition', 'no mirror, reverse or stretch', 'no repetition', 'no nesting',
      'no unstated repeats', 'near-misses folded', 'themes only', 'themes opened', 'cells', 'core only'],
  };

  // Stop 11 shows the core only: the cell-level entries (stop 10) of the
  // definitions named in `// #core` or options.core. A name with no entry at
  // the cell level is listed in core.missing. Each note is one of three kinds:
  // - core: its cell is a core entry. It sits on its own slot of that entry.
  // - attached: not a core note, and its cell-level owner use is the host
  //   use of a core statement. Going outward from the core definition, the
  //   host is the first definition use whose definition writes notes of its
  //   own (is the cell-level owner of some note). The note stacks on the core
  //   note of that host use that is nearest in time (the earlier on a tie).
  // - residue: every other note, on one marker after the last core.
  // The themes of stop 8 play no part: the core is picked by hand.
  // Without a core, stop 11 is stop 10.
  function coreOnly(L) {
    const named = options.core ?? String((trace.directives && trace.directives.core) || '').split(/[\s,]+/).filter(Boolean);
    const names = [], missing = [];
    for (const name of named) {
      if (names.includes(name) || missing.includes(name)) continue;
      (L.entryList.some(E => E.name === name) ? names : missing).push(name);
    }
    const core = { names, missing };
    if (!names.length) {
      return { pos: notes.map(n => ({ ...n.pos[10] })), at: notes.map(n => ({ ...n.fold10 })), units: o10.units, core, counts: null };
    }
    const recs = all.filter(rec => rec.sounding);
    const entryOf = rec => L.info.get(rec).I.entry;
    const isCore = rec => names.includes(entryOf(rec).name);
    const chainOf = rec => rec.cl.chain || rec.cl.frames;
    // The key of a definition use: the voice and every frame from the use
    // outward (as in usesOf).
    const useKey = (rec, i) => rec.voice + '|' + chainOf(rec).slice(i).map(frameKey).join('/');
    const writes = new Set(recs.filter(rec => rec.cl.owner).map(rec => rec.cl.owner.name));
    const hostOf = new Map(); // core rec -> { key, name }
    const coreAt = new Map(); // host use key -> core recs in it
    for (const rec of recs) {
      if (!isCore(rec)) continue;
      const fr = chainOf(rec), o = fr.indexOf(rec.cl.owner);
      for (let i = o + 1; o >= 0 && i < fr.length; i++) {
        if (fr[i].kind !== 'ref' || !writes.has(fr[i].name)) continue;
        const key = useKey(rec, i);
        hostOf.set(rec, { key, name: fr[i].name });
        if (!coreAt.has(key)) coreAt.set(key, []);
        coreAt.get(key).push(rec);
        break;
      }
    }
    const units = [], unitOf = new Map();
    let x = 0;
    const add = (key, U) => { U.x = x; units.push(U); unitOf.set(key, U); x += U.width + gap; };
    for (const E of L.entryList) if (names.includes(E.name)) add(E, { kind: 'entry', id: E.id, name: E.name, count: E.count, width: E.shownLength });
    const own = rec => {
      const R = L.info.get(rec), U = unitOf.get(entryOf(rec));
      const p = { t: U.x + R.shownOff, step: z(rec.cl.body.s), d: R.shown };
      if (R.capped) p.capped = true;
      return { p, U };
    };
    const place = recs.map(rec => {
      if (isCore(rec)) return { kind: 'core', rec };
      const o = rec.cl.owner ? chainOf(rec).indexOf(rec.cl.owner) : -1;
      const list = o >= 0 && coreAt.get(useKey(rec, o));
      if (!list) return { kind: 'residue' };
      let best = null;
      for (const c of list) {
        const dt = Math.abs(c.t - rec.t), bt = best && Math.abs(best.t - rec.t);
        if (!best || dt < bt - EPS || (Math.abs(dt - bt) <= EPS && c.t < best.t)) best = c;
      }
      return { kind: 'attached', rec: best, host: rec.cl.owner.name };
    });
    let res = null;
    if (place.some(h => h.kind === 'residue')) {
      const r8 = th.summary.units[8].find(u => u.kind === 'residue');
      res = { kind: 'residue', id: 'residue', name: null, width: r8 ? r8.width : 0.5 };
      add('residue', res);
    }
    const at = [], counts = { stated: 0, bent: 0, split: 0, attached: 0, residue: 0 };
    const pos = place.map((h, k) => {
      let p, U;
      if (h.rec) ({ p, U } = own(h.rec));
      else { U = res; p = { t: U.x, step: 0, d: U.width }; }
      const n = notes[k];
      if (h.kind === 'core') {
        counts.stated++;
        if (n.split) counts.split++;
        else if (n.cellBent) counts.bent++;
      } else counts[h.kind]++;
      const a = { kind: h.kind, unit: U.id, entry: U.kind === 'entry' ? U.id : null };
      if (h.kind === 'attached') a.host = h.host;
      at.push(a);
      if (h.kind !== 'attached') (U.keys ||= new Set()).add(r9(p.t) + '|' + r9(p.step));
      U.notes = (U.notes || 0) + 1;
      if (h.kind === 'attached') U.attached = (U.attached || 0) + 1;
      return p;
    });
    for (const U of units) {
      U.positions = U.kind === 'residue' ? 1 : (U.keys ? U.keys.size : 0);
      delete U.keys;
    }
    return { pos, at, units, core, counts };
  }

  // Stops 9 and 10 open the themes of stop 8 again. A note that sits on a
  // theme at stop 8 goes to the place of its slot's own note (fold8.rep) in
  // a level of the dictionary L: the innermost level (stop 9) or the cell
  // level (stop 10). Only the entries that a theme reaches are shown, side by
  // side in source order with the stop 5 gap. Found units (showFound) follow
  // as at stop 8, then the residue marker. With no theme at stop 8, every
  // note opens in place and all entries are shown.
  function openThemes(L, A) {
    const recOf = [];
    for (const rec of all) if (rec.sounding) recOf[rec.note.id] = rec;
    const units8 = th.summary.units[8];
    const themed = units8.some(u => u.kind === 'theme');
    const host = notes.map((n, k) => {
      if (!themed) return { kind: 'entry', rec: recOf[k] };
      const u = units8[th.notes[k].unit8];
      if (u.kind === 'theme') return { kind: 'entry', rec: recOf[n.fold8.rep] };
      return { kind: u.kind, u };
    });
    const reached = new Set(host.filter(h => h.rec).map(h => L.info.get(h.rec).I.entry));
    const units = [], unitOf = new Map();
    let x = 0;
    const add = (key, U) => { U.x = x; units.push(U); unitOf.set(key, U); x += U.width + gap; };
    for (const E of L.entryList) if (reached.has(E)) add(E, { kind: 'entry', id: E.id, name: E.name, count: E.count, width: E.shownLength });
    for (const u of units8) if (u.kind === 'found' && host.some(h => h.u === u)) add(u, { kind: 'found', id: u.id, name: u.name, width: u.width, from: u.x });
    const res = units8.find(u => u.kind === 'residue');
    if (res && host.some(h => h.kind === 'residue')) add(res, { kind: 'residue', id: 'residue', name: null, width: res.width });
    const at = [];
    const pos = host.map((h, k) => {
      let p, U;
      if (h.rec) {
        const R = L.info.get(h.rec);
        U = unitOf.get(R.I.entry);
        p = { t: U.x + R.shownOff, step: z(A(h.rec).body.s), d: R.shown };
        if (R.capped) p.capped = true;
      } else if (h.kind === 'found') {
        const p8 = notes[k].pos[8];
        U = unitOf.get(h.u);
        p = { t: U.x + p8.t - U.from, step: p8.step, d: p8.d };
        if (p8.capped) p.capped = true;
      } else {
        U = unitOf.get(res);
        p = { t: U.x, step: 0, d: U.width };
      }
      at.push({ kind: h.kind, unit: U.id, entry: U.kind === 'entry' ? U.id : null });
      (U.keys ||= new Set()).add(r9(p.t) + '|' + r9(p.step));
      U.notes = (U.notes || 0) + 1;
      return p;
    });
    for (const U of units) {
      U.positions = U.kind === 'residue' ? 1 : U.keys.size;
      delete U.keys;
      delete U.from;
    }
    return { pos, at, units, themed };
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

})();


// === Exports ===
if (typeof module !== 'undefined' && module.exports) {
  module.exports = golden;
  module.exports.default = golden;
}
if (typeof globalThis !== 'undefined') globalThis.golden = golden;
if (typeof window !== 'undefined') window.golden = golden;
