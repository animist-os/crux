import * as ohm from 'ohm-js';

export const g = ohm.grammar(String.raw`
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
      | MulExpr zipOp PostfixExpr  -- zip

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
  // These apply to their immediate left operand.
  // Postfix z only applies when no operand follows; "A z B" is the binary zip in MulExpr.
  PostfixExpr
      = PostfixExpr "/"                          -- subdivide
      | PostfixExpr zipOp ~PriExpr               -- zipColumns
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
      | ~(Pip valueEnd) MotNum
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

    // ---- Arithmetic with names, inside a mot only ----
    // Inside [ ... ] a value may be arithmetic on numbers and on names bound
    // to a single number, with no parentheses needed:
    //   [P - 1 | 2, P * 2]   [P -> P - 1]   [2 * (P + 1)]
    // Outside a mot, * and -> stay mot operators (T * 2 is fan-add, T -> 2
    // is steps), so none of these rules are reachable from PriExpr.
    //
    // P * 2 can also be read as a mot expression. stepOrExpr keeps both
    // readings: arithmetic when every name is a single number, the mot
    // expression when a name holds a longer mot, so [(b1 * -2)] still works.
    MotNum
      = RefRange hspaces? "|" hspaces? TimeScale             -- rangeWithTimeMulPipeImplicit
      | RefRange hspaces? "|" hspaces? "/" hspaces? RandNum  -- rangeWithTimeDivPipe
      | RefRange &valueEnd                                   -- rangeNoTimeScale
      | &(MulExpr valueEnd) RefStep &valueEnd                -- stepOrExpr
      | RefStep hspaces? "|" hspaces? TimeScale              -- withTimeMulPipeImplicit
      | RefStep hspaces? "|" hspaces? "*" hspaces? RandNum   -- withTimeMulPipe
      | RefStep hspaces? "|" hspaces? "/" hspaces? RandNum   -- withTimeDivPipe
      | RefStep &valueEnd                                    -- step

    // A lone name is left to refInMot, so [a] still splices the mot a.
    RefStep
      = ~(ident valueEnd) RefArithExpr

    RefRange
      = RefRangeEnd "->" RefRangeEnd

    RefRangeEnd
      = RefArithExpr
      | RandNum

    // Identifier used where a number is expected. Must evaluate to one pip.
    NumRef
      = ident

    RefArithExpr
      = RefArithExpr hspaces? "+" hspaces? RefArithMulExpr  -- add
      | RefArithExpr hspaces? "-" hspaces? RefArithMulExpr  -- sub
      | RefArithMulExpr

    RefArithMulExpr
      = RefArithMulExpr hspaces? "*" hspaces? RefArithPrimary  -- mul
      | RefArithMulExpr hspaces? "/" hspaces? RefArithPrimary  -- div
      | RefArithPrimary

    RefArithPrimary
      = "(" hspaces? RefArithExpr hspaces? ")"  -- parens
      | MemberAccess
      | NumRef
      | number

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
      = RefRange  -- range
      | number "/" number  -- frac
      | number  -- num
      | MemberAccess  -- member
      | ident   -- ref

    MemberAccess
      = ident "." memberProp  -- prop

    // Only known properties, so x . y stays a tile-add of two mots.
    memberProp = "length" ~(letter | digit | "_")

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

    // The zip operator letter. Lexical, so "zeta" stays a name.
    zipOp = "z" ~(alnum | "_")

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

    // What may follow a value inside a mot
    valueEnd = "," | "]" | "&" | ":"

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