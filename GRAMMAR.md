## Crux
https://github.com/animist-os/crux

This document describes the Crux grammar used to build and transform musical mots as sequences of "pips" (step, timeScale, optional tag). The pips within a mot represent a linear series of conriguous events. You can concatenate mots, repeat them, slice/rotate, combine them multiplicatively, and introduce ranges and choices.   You can apply low level schenker operations on pips and mots.  All operations can be applied in either a "fan" approach or a "cog" one.  

Fan (outer):  For each r in R, apply op to all of A, then concatenate.   The lengths multiply

Cog (elementwise): Pair positions; RHS cycles as needed to cover LHS.  Length will be the same as LHS (unless there are nested mots in RHS).

### Program

- **Program**: one or more sections separated by `!`. Each section contains one or more statements separated by newlines. The program returns an array of the final statement value from each section.
- **Section**: A group of statements that share an environment. The `!` separator marks the boundary between sections.
- **Statement**: either an assignment, an operator alias, or an expression.
- **Assignment**: `Name = Expr`
- **Operator Alias**: `Name = OpSym` (allows using custom names for operators)
- **Reference**: use a previously assigned `Name` in an expression.

Example (single section, backward compatible):
```text
A = [0, 1]
A, [2]
```
Returns `[[0, 1, 2]]` (array with one section result).

Example (multiple sections):
```text
[0, 2, 4]
!
[5, 7, 9]
!
[10, 12, 14]
```
Returns `[[0, 2, 4], [5, 7, 9], [10, 12, 14]]` (array with three section results).

Example (sections with shared environment):
```text
a = [0, 2, 4]
a * [0, 1]
!
a * [0, 2]
```
Returns `[[0, 2, 4, 1, 3, 5], [0, 2, 4, 2, 4, 6]]` (assignments persist across sections).

Example with operator aliasing:
```text
splay = *
[0, 1] splay [2, 3]
```
Returns `[[0, 1, 2, 3]]`.

### Mots and values

- **Mot**: square-bracket list of values (comma-separated): `[Value, Value, ...]`
- **Nested Mot**: double-bracket list for hierarchical grouping: `[[Value, Value, ...]]`
  - Nested mots now preserve unit duration by default (no automatic subdivision)
  - Use the `/` postfix operator to subdivide: `[[0,1,2]]/` → `[0|/3, 1|/3, 2|/3]`
  - Can be nested recursively: `[[[0,1],[2,3]]]`
- **Value** can be:
  - **Pip**: `number` optionally combined with a timeScale using `*` (multiply) or `/` (divide), or a special tag.
    - `number` is the step (may be integer or float).
    - `TimeScale` is either a plain number or a fraction `n/d`, combined with `*` or `/`.
      - Examples: `[0, 1*2] -> [0, 1*2]`, `[1/4] -> [1/4]`.
    - A single letter inside a mot is a tagged pip with step 0.
  - **Range**: `a->b` expands inclusively to integer steps. Examples:
    - `[0->3] -> [0, 1, 2, 3]`
    - `[3->1] -> [3, 2, 1]`
  - **Curly**: `{a, b, c, ...}` picks one option at evaluation time. Example: `[{0, 1, 2}] -> [0]` or `[1]` or `[2]`.
  - **Random Range**: `{a -> b}` picks a random integer between a and b (inclusive). Example: `[{-2 -> 2}] -> [-2]` to `[2]`.
  - **Seeded Random**: `{a -> b}$seed` provides deterministic randomness. Example: `[{1 -> 6}$c0de]`.

Notes:
- Floats are supported for steps and time scales. Fractions normalize to decimals in string output.
- **Pipe forms**: Use `|` to specify timeScale after a value:
  - `value | timescale` (implicit multiply)
  - `value | * factor` (explicit multiply)
  - `value | / divisor` (explicit divide)
  - `| timescale` (pipe-only, resets step to 0)
  - `| * factor` (pipe-only multiply)
  - `| / divisor` (pipe-only divide)
- **Tags**: Single letters create tagged pips:
  - `r`: rest (silence with duration)
  - Other single letters can be used as identifiers or in special contexts
- **Curly expressions**: Standalone `{...}` expressions are treated as single random-step pips.
- **Curly contents**: Can contain:
  - Numbers: `{1, 2, 3}`
  - Ranges: `{0 -> 5, 10 -> 15}`
  - Fractions: `{1/2, 1/4, 3/4}`
  - References: `{a, b, c}` (where a, b, c are previously assigned values)
 - **Pip repetition and padding**:
   - **Repetition**: Inside a mot literal, appending `: N` to a value repeats it N times: `[0: 3] -> [0, 0, 0]`. Works with timescales: `[-2|/2 : 4] -> [-2|/2, -2|/2, -2|/2, -2|/2]`.
   - **Padding**: Appending `:` (without N) marks a value as a pad entry for cog operators. In cog context (e.g., with `.`), padding repeats that RHS value to cover the middle positions without cycling; any trailing RHS entries are right‑aligned to the end of the LHS.
   - Interior pad is supported: `[0,1,2,3,4,5,6] . [7, 0:, 7] -> [7, 1, 2, 3, 4, 5, 13]`.
   - Fan operators (`*`, `^`, `->`, etc.) ignore `:` (the value behaves as a single entry): `[0,1,2] * [2, 3:] == [0,1,2] * [2,3]`.
 

### Operators

Operators are left-associative unless otherwise noted.

**Precedence** (from highest to lowest):

1) **Postfix operators** (bind tightest to their left operand)

**Postfix slice**: slicing applied to a mot result.
   - Forms:
     - `start … end` (spaces optional around `…`)
     - `start …` (start to end)
     - `… end` (from start to end index)
   - Indices are numbers; negative indices count from end. End is exclusive.
   - Examples:
```text
[0, 1, 2, 3, 4] -3 … -1   -> [2, 3]
[0, 1, 2, 3, 4] 1 …       -> [1, 2, 3, 4]
[0, 1, 2, 3, 4] … 3       -> [0, 1, 2]
```

**Postfix subdivide** `/`: divides each pip's timescale by the mot length.
   - Works on any expression, not just nested mots
   - Examples:
```text
[[0,1,2]]/               -> [0 | /3, 1 | /3, 2 | /3]
[4->7]/                  -> [4 | /4, 5 | /4, 6 | /4, 7 | /4]
```

**Postfix zip columns** `z`: round-robin interleaving of comma-separated expressions.
   - Takes multiple mots and interleaves them element by element
   - Example:
```text
(A, B, C)z where A=[0,0,0], B=[1,1,1], C=[2,2,2]  -> [0, 1, 2, 0, 1, 2, 0, 1, 2]
```

**Postfix tie** `t`: merges adjacent equal-step pips by adding timeScales.
```text
[0, 0, 1]t -> [0*2, 1]
```

**Repeat**: `Expr : N` repeats a mot `N` times (N must be a non-negative finite number or RandNum).
```text
[1] : 3 -> [1, 1, 1]
[1] : {2, 3, 4} -> [1, 1] or [1, 1, 1] or [1, 1, 1, 1]
```

2) **Binary operators** (combine mots, all left-associative)
   - `*` fan-add (cartesian/outer application):
     - For each value in the right mot, combine it with every value in the left mot; concatenate.
     - Steps add; timeScales multiply.
     - If the right value has a negative timeScale, the left mot is reversed for that right value.
     - Example: `[1, 2, 3] * [0*-1] -> [3, 2, 1]`
   - `^` fan-mul (expand steps):
     - Same outer pairing as `*`, but steps multiply instead of add.
     - Example: `[0, 1] ^ [2] -> [0, 2]`, `[1, 2] ^ [2] -> [2, 4]`
  - `.` or `.*` cog-add (elementwise add with cycling):
    - Pair each left value with the corresponding value from the right, cycling the right as needed.
    - Nested RHS subdivision: If the right-side element at a position is a nested mot literal, it coerces a subdivision of the left pip at that position: emit one pip per element of the nested group where each emitted pip uses `step = left.step + rhsNested.step` and `timeScale = left.timeScale * rhsNested.timeScale`. Tags combine (`r` carries through).
      - **Note**: Nested mots now preserve unit duration by default. Use the `/` postfix operator for subdivision.
      - Example (unit duration preserved): `[0,4,2] . [0, [1,0], 0] -> [0, 5, 4, 2]`.
      - Example (explicit timescales): `[0,4,2] . [0, [1 | 2, 0 | 2], 0] -> [0, 5, 4, 2]`.
      - Example (with subdivision): `[0,4,2] . [0, [1,0]/, 0] -> [0, 4 | /2, 5 | /2, 4 | /2, 4 | /2, 2]`.
    - Example: `[0, 1, 2] .* [10, 20] -> [10, 21, 12]` (same as using `.`)
  - '.,' cog-concatenate (element-wise zip with no cycling)
      - interleaves two mots
      - if one is shorter than the other, the remainder is simply concatenated
      - Example `[0,1,2] ., [9,8,7] -> [0,9,1,8,2,7]
   - `.^` cog-mul (elementwise expand):
     - Same cycling as `.`, but steps multiply instead of add.
     - Example: `[1, 2] .^ [2] -> [2, 4]`
   - `j` jam (fan) / `.j` (cog):
     - Replace steps/timeScales with RHS values; pipe-only `|` entries pass through left.
   - `m` mirror (fan) / `.m` (cog):
     - Reflect steps around anchor k: `a -> 2k - a`.
   - `l` lens (fan) / `.l` (cog):
     - Sliding window emission; fan uses window size over whole mot; cog uses per-position window size.
   - `t` tie (postfix, unary) / `.t` (cog):
     - Postfix `t` merges adjacent equal-step pips by adding timeScales.
     - Cog `.t` uses RHS mask to allow merges forward.
   - `c` constraint (fan) / `.c` (cog):
     - Keep/omit by mask (nonzero keeps; tag `x` omits); timeScales multiply.
   - `->` steps (fan):
     - For each right value `k`, output the left mot transposed by all integers from 0 to `k` (sign supported), concatenated.
     - Example: `[0, 3] -> [4] -> [0, 3, 1, 4, 2, 5, 3, 6, 4, 7]`
   - `.->` steps (cog):
     - For each position `i`, expand `left[i]` into a run up to `right[i%|right|]`.
     - Example: `[0, 3] .-> [4] -> [0, 1, 2, 3, 4, 3, 4, 5, 6, 7]`
   - `~` rotate (fan) / `.~` (cog):
     - Fan: For each value k in the right mot, rotate the left mot left by k (negative k rotates right), appending results in order.
     - Cog: Apply rotation per-position using RHS values cyclically.
     - Examples: `[0,1,2,3] ~ [-1] -> [3,0,1,2]`, `[0,1,2,3] ~ [1,2] -> [1,2,3,0, 2,3,0,1]`.
   - `g` glass (fan) / `.g` (cog):
     - Glass-inspired minimalist interleaving with different rhythmic subdivisions.
     - Fan: LHS gets triplet subdivision (1/3), RHS gets duplet subdivision (1/2).
     - Cog: Alternates between left (triplet) and right (duplet) subdivision element-wise.
   - `r` reich (fan) / `.r` (cog):
     - Reich-inspired phasing patterns with repeated cycles.
     - Fan: Cycles through both sets with 1/4 note subdivision.
     - Cog: Alternates durations (1/2, 1/4 for left; 1, 1/2 for right).
   - `p` paert (fan):
     - Pärt-inspired tintinnabulation operator with octave equivalence.
     - Snaps LHS steps to nearest RHS scale degree (mod 7), avoiding unisons.
     - Example: `[0,1,2,3] p [0,2,4] -> [4,0,2,2]` (0→4 down to avoid unison, 1→0, 2→2, 3→2).

3) **Concatenation**:
   - Use `,` between expressions to concatenate mots.
   - Example: `[0, 1], [2, 3] -> [0, 1, 2, 3]`.
   - Note: Juxtaposition concatenation (space-separated expressions) is **not supported**; you must use explicit commas.

4) **Grouping**: parentheses `(` `)` control evaluation order.
```text
([0, 1] ^ [2]) * [0] -> [0, 2]
```

### Precedence summary

From highest to lowest binding:
1. Postfix operators: slice (`…`), subdivide (`/`), zip (`z`), tie (`t`), repeat (`:`)
2. Binary operators: `.*`, `.^`, `.->`, `.j`, `.m`, `.l`, `.t`, `.c`, `.,`, `.g`, `.r`, `.~`, `->`, `j`, `m`, `l`, `c`, `g`, `r`, `p`, `*`, `^`, `.`, `~` (all left-associative)
3. Concatenation: `,` (left-associative)
4. Assignment and section separators: `=`, `!`

### Identifiers

- Names must start with a letter or `…`, followed by alphanumerics (`ident = (letter | "_") alnum*`).
- Referencing an unknown name is an error: “undeclared identifier: Name”.

### Errors and constraints

- Repeat count must be a non-negative finite number.
- Range endpoints must be finite numbers.
- Delta mots support only simple numeric pips (no tags/ranges/choices inside semicolon form).
- Many operators require mots; attempting to use a non-mot where a mot is required is an error.

### Mixed examples

```text
// Absolute list
[0, 1, 2, 3]                 -> [0, 1, 2, 3]

// Range example
([0->2]), [3*2]              -> [0, 1, 2, 3*2]

// Random choices (result varies)
[{0, 1, 2}]                  -> one of [0], [1], [2]
[{-2 -> 2}]                  -> random integer from -2 to 2
[{1 -> 6}$c0de]              -> seeded random (deterministic)

// Concatenation (comma only)
[0, 1], [2, 3]               -> [0, 1, 2, 3]

// Multiplicative family
[1, 2, 3] * [0*-1]           -> [3, 2, 1]
[1, 2] ^ [2]                 -> [2, 4]
[0, 1, 2] . [10, 20]         -> [10, 21, 12]
[0, 1, 2] .* [10, 20]        -> [10, 21, 12]
[1, 2] .^ [2]                -> [2, 4]

// Grouping
([0, 1] ^ [2]) * [0]         -> [0, 2]

// Assignment & reference
A = [0, 1]\nA, [2]           -> [0, 1, 2]

// Slicing and rotation
[0, 1, 2, 3, 4] -3 … -1      -> [2, 3]
[0, 1, 2, 3, 4] 1 …          -> [1, 2, 3, 4]
// Rotation is via ~ operator
[0, 1, 2, 3] ~ [-1]          -> [3, 0, 1, 2]
[0, 1, 2, 3] ~ [1, 2]        -> [1, 2, 3, 0, 2, 3, 0, 1]
```

### Ohm-JS grammar (reference)

This is the actual grammar implemented in `src/grammar.js`.

```text
Crux {
  Prog
    = nls? ListOf<Section, SectionSep> trailingSpace

  trailingSpace = (nl | hspace | comment)*

  Section
    = nls* ListOf<Stmt, nls+>

  SectionSep
    = (nls | hspace | comment)* "!" (nls | hspace | comment)*

  Stmt
    = AssignStmt
    | OpAliasStmt
    | ExprStmt

  AssignStmt
    = ident "=" Expr

  OpAliasStmt
    = ident "=" OpSym

  ExprStmt
    = Expr

  Expr
    = FollowedByExpr

  FollowedByExpr
    = FollowedByExpr "," MulExpr   -- fby
    | MulExpr

  MulExpr
    = MulExpr ".*" PostfixExpr     -- dotStar
    | MulExpr ".^" PostfixExpr     -- dotExpand
    | MulExpr ".->" PostfixExpr    -- dotSteps
    | MulExpr ".j" PostfixExpr     -- dotJam
    | MulExpr ".m" PostfixExpr     -- dotMirror
    | MulExpr ".l" PostfixExpr     -- dotLens
    | MulExpr ".t" PostfixExpr     -- dotTie
    | MulExpr ".c" PostfixExpr     -- dotConstraint
    | MulExpr ".," PostfixExpr     -- dotZip
    | MulExpr ".g" PostfixExpr     -- dotGlass
    | MulExpr ".r" PostfixExpr     -- dotReich
    | MulExpr "->" PostfixExpr     -- steps
    | MulExpr "j" PostfixExpr      -- jam
    | MulExpr "m" PostfixExpr      -- mirror
    | MulExpr "l" PostfixExpr      -- lens
    | MulExpr "c" PostfixExpr      -- constraint
    | MulExpr "g" PostfixExpr      -- glass
    | MulExpr "r" PostfixExpr      -- reich
    | MulExpr "p" PostfixExpr      -- paert
    | MulExpr "*" PostfixExpr      -- mul
    | MulExpr "^" PostfixExpr      -- expand
    | MulExpr "." PostfixExpr      -- dot
    | MulExpr "~" PostfixExpr      -- rotate
    | MulExpr ".~" PostfixExpr     -- dotRotate
    | MulExpr ident PostfixExpr    -- aliasOp
    | PostfixExpr

  PostfixExpr
    = PostfixExpr "/"                          -- subdivide
    | PostfixExpr "z"                          -- zipColumns
    | PostfixExpr "t"                          -- tiePostfix
    | PostfixExpr hspaces? ":" hspaces? RandNum  -- repeatPostRand
    | PostfixExpr hspaces? ":" hspaces? number   -- repeatPost
    | PostfixExpr hspaces? SliceOp               -- slice
    | PriExpr

  PriExpr
    = ident                        -- ref
    | "[[" NestedBody "]]"         -- nestedMot
    | "[" MotBody "]"              -- mot
    | number                       -- numAsMot
    | "(" Expr ")"                 -- parens
    | Curly                        -- curlyAsExpr

  NestedBody
    = ListOf<NestedElem, ",">      -- nestedAbsolute

  NestedElem
    = MotLiteral "/"               -- motSubdivide
    | NestedMotLiteral "/"         -- nestedSubdivide
    | SingleValue                  -- single
    | MotLiteral                   -- mot
    | NestedMotLiteral             -- nested

  MotLiteral = "[" MotBody "]"
  NestedMotLiteral = "[[" NestedBody "]]"
  NestedMotAbbrev = "[[" MotBody "]"

  SliceOp
    = SliceIndex hspaces? "…" hspaces? SliceIndex   -- both
    | SliceIndex hspaces? "…"                       -- startOnly
    | "…" hspaces? SliceIndex                       -- endOnly
    | "…" SliceIndex                                -- endOnlyTight

  SliceIndex
    = RandNum  -- rand
    | Index    -- num

  Index = sign? digit+

  MotBody
    = ListOf<Entry, ",">           -- absolute

  Entry
    = Value hspaces? ":" hspaces? RandNum  -- repeatPip
    | Value hspaces? ":"                   -- padPip
    | Value                                -- plain

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
    | ident hspaces? "*" hspaces? MotLiteral        -- inlineMulRefMot
    | "(" Expr ")"                                  -- exprInMot
    | ident                                         -- refInMot

  Range
    = RandNum "->" RandNum         -- inclusive

  Pip
    = number hspaces? "|" hspaces? TimeScale              -- withTimeMulPipeImplicit
    | number hspaces? "|" hspaces? "*" hspaces? RandNum  -- withTimeMulPipe
    | number hspaces? "|" hspaces? "/" hspaces? RandNum  -- withTimeDivPipe
    | number hspaces? "|"                                 -- withPipeNoTs
    | "|" hspaces? TimeScale                              -- pipeOnlyTs
    | "|" hspaces? "*" hspaces? RandNum                   -- pipeOnlyMul
    | "|" hspaces? "/" hspaces? RandNum                   -- pipeOnlyDiv
    | "|"                                                 -- pipeBare
    | PlainNumber                                         -- noTimeScale
    | Special hspaces? "|" hspaces? TimeScale             -- specialWithTimeMulPipeImplicit
    | Special hspaces? "|" hspaces? "*" hspaces? RandNum -- specialWithTimeMulPipe
    | Special hspaces? "|" hspaces? "/" hspaces? RandNum -- specialWithTimeDivPipe
    | Special                                             -- special
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

  CurlyPip
    = "{" ListOf<Pip, ","> "}" Seed?
  Curly
    = "{" CurlyBody "}" Seed?
  CurlyBody
    = ListOf<CurlyEntry, ",">      -- list
  CurlyEntry
    = Range          -- range
    | number "/" number  -- frac
    | number         -- num
    | ident          -- ref

  Seed = "$" SeedChars
  SeedChars = seedChar+
  seedChar = letter | digit | "_"

  TimeScale
    = RandNum "/" RandNum  -- frac
    | RandNum              -- plain

  Special
    = specialChar

  specialChar
    = "r"

  ident = (letter | "_") alnum+  -- withChars
        | letter                 -- single

  OpSym
    = ".*" | ".^" | ".->" | ".j" | ".m" | ".l" | ".t" | ".c" | ".," | ".g" | ".r" | ".~"
    | "->" | "j" | "m" | "l" | "c" | "g" | "r" | "p" | "*" | "^" | "." | "~"

  number
    = sign? digit+ ("." digit+)?
    | sign? digit* "." digit+

  PlainNumber
    = number ~ (hspaces? "->")

  sign = "+" | "-"

  hspace = " " | "\t"
  hspaces = hspace+

  comment = "//" (~nl any)*

  space := hspace | comment

  nl = "\r\n" | "\n" | "\r"
  nls = nl+
}
```

### Implementation notes

- `*` and `^` iterate the right mot's values; a negative timeScale on the right reverses the left mot for that right value.
- `.` tiles the right mot against the left; nested mots in RHS can subdivide the corresponding LHS pip.
- Choices are resolved at evaluation time; ranges expand to integer pips before further processing.
- The string form shows decimal time scales (fractions are normalized).
- Only `r` is supported as a special character (rest). The `?` character is not currently implemented.
- All binary operators are left-associative.
- Whitespace (spaces and tabs) is allowed around operators for readability but is not required.


