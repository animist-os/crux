import * as ohm from 'ohm-js';

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
