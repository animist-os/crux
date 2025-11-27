import * as ohm from 'ohm-js';

export const g = ohm.grammar(String.raw`
  Crux {

    Prog
      = nls? ListOf<Section, SectionSep> trailingSpace

    trailingSpace = (nl | hspace | comment)*

    Section
      = nls* ListOf<Stmt, nls+>

    SectionSep
      = (nls | hspace | comment)* "!" (nls | hspace | comment)*

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
      | MulExpr "*" PostfixExpr  -- mul
      | MulExpr "^" PostfixExpr  -- expand
      | MulExpr "." PostfixExpr  -- dot
      | MulExpr "~" PostfixExpr  -- rotate
      | MulExpr ".~" PostfixExpr  -- dotRotate
      | MulExpr ident PostfixExpr -- aliasOp
      | MulExpr "@" PostfixExpr  -- atIndex
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
      = Pip                          -- pipAsMot
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

    ident = (letter | "_") (alnum | "_")+  -- withChars
          | letter                             -- single

    // Set of binary operator symbols that can be aliased
    OpSym
      = ".*" | ".^" | ".->" | ".j" | ".m" | ".l" | ".t" | ".c" | ".," | ".g" | ".r"
      | "->" | "j" | "m" | "l" | "c" | "g" | "r" | "p" | "*" | "^" | "." | "~" | "@"

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