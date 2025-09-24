## Crux

This document describes the Crux grammar used to build and transform musical mots as sequences of “pips” (step, timeScale, optional tag). You can concatenate mots, repeat them, slice/rotate, combine them multiplicatively, and introduce ranges and choices.   You can apply low level schenker operations on pips and mots.  All operations can be applied in either a "spread" approach or a "tiled" one.  

Spread (outer):  For each r in R, apply op to all of A, then concatenate.   The lengths multiply

Tile (elementwise): Pair positions; RHS tiles as needed.  

### Program

- **Program**: one or more statements. The final statement’s value is the result.
- **Statement**: either an assignment or an expression.
- **Assignment**: `Name = Expr`
- **Reference**: use a previously assigned `Name` in an expression.

Example:
```text
A = [0, 1]
A, [2]
```
Evaluates to `[0, 1, 2]`.

### Mots and values

- **Mot**: square-bracket list of values (comma-separated): `[Value, Value, ...]`
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
  - **Random Range**: `{a ? b}` picks a random integer between a and b (inclusive). Example: `[{-2 ? 2}] -> [-2]` to `[2]`.
  - **Seeded Random**: `{a ? b}@seed` provides deterministic randomness. Example: `[{1 ? 6}@c0de]`.

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
  - `x`: omit (drops position in tile operations and constraint)
  - Other letters: pass-through behavior in dot operations
- **Curly expressions**: Standalone `{...}` expressions are treated as single random-step pips.
 

### Operators (left to right unless grouped)

In decreasing precedence (tighter binds higher):

1) **Postfix slice**: slicing applied to a mot result.
   - Forms:
     - `start _ end` (spaces optional around `_`)
     - `start _` (start to end)
     - `_ end` (from start to end index)
   - Indices are numbers; negative indices count from end. End is exclusive.
   - Examples:
```text
[0, 1, 2, 3, 4] -3 _ -1   -> [2, 3]
[0, 1, 2, 3, 4] 1 _       -> [1, 2, 3, 4]
[0, 1, 2, 3, 4] _ 3       -> [0, 1, 2]
```

2) **Repeat**: `Expr : N` repeats a mot `N` times (N must be a non-negative finite number).
```text
[1] : 3 -> [1, 1, 1]
```

3) **Combine pairs of mots**:
   - `*` spread-add (cartesian/outer application):
     - For each value in the right mot, combine it with every value in the left mot; concatenate.
     - Steps add; timeScales multiply.
     - If the right value has a negative timeScale, the left mot is reversed for that right value.
     - Example: `[1, 2, 3] * [0*-1] -> [3, 2, 1]`
   - `^` spread-mul (expand steps):
     - Same outer pairing as `*`, but steps multiply instead of add.
     - Example: `[0, 1] ^ [2] -> [0, 2]`, `[1, 2] ^ [2] -> [2, 4]`
   - `.` or `.*` tile-add (elementwise/zip with tiling):
     - Pair each left value with the corresponding value from the right, tiling the right as needed.
     - Example: `[0, 1, 2] .* [10, 20] -> [10, 21, 12]` (same as using `.`)
   - `.^` tile-mul (elementwise expand):
     - Same tiling as `.`, but steps multiply instead of add.
     - Example: `[1, 2] .^ [2] -> [2, 4]`
   - `j` jam (spread) / `.j` (tile):
     - Replace steps/timeScales with RHS values; pipe-only `|` entries pass through left.
   - `m` mirror (spread) / `.m` (tile):
     - Reflect steps around anchor k: `a -> 2k - a`.
   - `l` lens (spread) / `.l` (tile):
     - Sliding window emission; spread uses window size over whole mot; tile uses per-position window size.
   - `t` tie (postfix, unary) / `.t` (tile):
     - Postfix `t` merges adjacent equal-step pips by adding timeScales.
     - Tile `.t` uses RHS mask to allow merges forward.
   - `c` constraint (spread) / `.c` (tile):
     - Keep/omit by mask (nonzero keeps; tag `x` omits); timeScales multiply.
   - `->` steps (spread):
     - For each right value `k`, output the left mot transposed by all integers from 0 to `k` (sign supported), concatenated.
     - Example: `[0, 3] -> [4] -> [0, 3, 1, 4, 2, 5, 3, 6, 4, 7]`
   - `.->` steps (tile):
     - For each position `i`, expand `left[i]` into a run up to `right[i%|right|]`.
     - Example: `[0, 3] .-> [4] -> [0, 1, 2, 3, 4, 3, 4, 5, 6, 7]`
   - `~` rotate:
     - For each value k in the right mot, rotate the left mot left by k (negative k rotates right), appending results in order.
     - Examples: `[0,1,2,3] ~ [-1] -> [3,0,1,2]`, `[0,1,2,3] ~ [1,2] -> [1,2,3,0, 2,3,0,1]`.
     - Numeric case behaves like `*` on a single pair each step (step add, timeScale multiply).
     - Tagged pips pass the left value through unchanged; tag `x` in either side is treated as a no-op for that position.
     - Example: `[0, 1, 2, 3] ~ [-1] -> [3, 0, 1, 2]`, `[0, 1, 2, 3] ~ [1, 2] -> [1, 2, 3, 0, 2, 3, 0, 1]`.

4) **Concatenation**:
   - Use `,` or juxtaposition (spaces/tabs, not newline) between expressions to concatenate mots.
   - Examples: `[0, 1], [2, 3] -> [0, 1, 2, 3]`, `[0, 1] [2, 3] -> [0, 1, 2, 3]`.

5) **Grouping**: parentheses `(` `)` control evaluation order.
```text
([0, 1] ^ [2]) * [0] -> [0, 2]
```

### Precedence and associativity

From highest to lowest:
- Slice (postfix): `start _ end`, `start _`, `_ end`
- Repeat `Expr : N` (postfix)
- Tie `t` (postfix, unary)
- Multiplicative operators: `.*`, `.^`, `.->`, `.j`, `.m`, `.l`, `.t`, `.c`, `->`, `j`, `m`, `l`, `c`, `*`, `^`, `.`, `~` (left-associative)
- Concatenation: `,` and juxtaposition (left-associative)

Note: Concatenation by adjacency (juxtaposition) works only on the same line, not across newlines.

### Identifiers

- Names must start with a letter or `_`, followed by alphanumerics (`ident = (letter | "_") alnum*`).
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
[{-2 ? 2}]                   -> random integer from -2 to 2
[{1 ? 6}@c0de]               -> seeded random (deterministic)

// Concatenation (comma or juxtaposition)
[0, 1], [2, 3]               -> [0, 1, 2, 3]
[0, 1] [2, 3]                -> [0, 1, 2, 3]

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
[0, 1, 2, 3, 4] -3 _ -1      -> [2, 3]
[0, 1, 2, 3, 4] 1 _          -> [1, 2, 3, 4]
// Rotation is via ~ operator
[0, 1, 2, 3] ~ [-1]          -> [3, 0, 1, 2]
[0, 1, 2, 3] ~ [1, 2]        -> [1, 2, 3, 0, 2, 3, 0, 1]
```

### Ohm-JS grammar (reference)

This is a lightly reformatted view of the core grammar implemented in `src/index.js`.

```text
Crux {
  Prog        = ListOf<Stmt, nls> nls?
  Stmt        = AssignStmt | ExprStmt
  AssignStmt  = ident "=" Expr
  ExprStmt    = Expr

  Expr            = FollowedByExpr
  FollowedByExpr  = FollowedByExpr "," TieExpr
                 | FollowedByExpr TieExpr
                 | TieExpr

  TieExpr     = TieExpr "t"          -- tiePostfix
              | MulExpr

  MulExpr     = MulExpr ".*" AppendExpr
              | MulExpr ".^" AppendExpr
              | MulExpr ".->" AppendExpr
              | MulExpr ".j" AppendExpr
              | MulExpr ".m" AppendExpr
              | MulExpr ".l" AppendExpr
              | MulExpr ".t" AppendExpr
              | MulExpr ".c" AppendExpr
              | MulExpr "->" AppendExpr
              | MulExpr "j" AppendExpr
              | MulExpr "m" AppendExpr
              | MulExpr "l" AppendExpr
              | MulExpr "c" AppendExpr
              | MulExpr "*" AppendExpr
              | MulExpr "^" AppendExpr
              | MulExpr "." AppendExpr
              | MulExpr "~" AppendExpr
              | AppendExpr

  AppendExpr  = AppendExpr ":" RandNum  -- repeatPostRand
              | AppendExpr ":" number   -- repeatPost
              | AppendExpr SliceOp      -- slice
              | PostfixExpr

  PostfixExpr = PriExpr

  PriExpr     = ident                -- ref
              | "[" MotBody "]"      -- mot
              | "(" Expr ")"          -- parens
              | Curly                 -- curlyAsExpr

  SliceOp     = SliceIndex "_" SliceIndex  -- both
              | SliceIndex "_"             -- startOnly
              | "_" SliceIndex             -- endOnly
              | "_" SliceIndex             -- endOnlyTight

  SliceIndex  = RandNum  -- rand
              | Index   -- num
  Index       = sign? digit+

  MotBody     = ListOf<Value, ",">

  Value       = SingleValue
  SingleValue = Pip | Range | Curly
  Range       = RandNum "->" RandNum
  
  Pip         = number "|" TimeScale              -- withTimeMulPipeImplicit
              | number "|" "*" RandNum           -- withTimeMulPipe
              | number "|" "/" RandNum           -- withTimeDivPipe
              | number "|"                       -- withPipeNoTs
              | "|" TimeScale                    -- pipeOnlyTs
              | "|" "*" RandNum                  -- pipeOnlyMul
              | "|" "/" RandNum                  -- pipeOnlyDiv
              | "|"                             -- pipeBare
              | PlainNumber                     -- noTimeScale
              | Special "|" TimeScale           -- specialWithTimeMulPipeImplicit
              | Special "|" "*" RandNum         -- specialWithTimeMulPipe
              | Special "|" "/" RandNum         -- specialWithTimeDivPipe
              | Special                        -- special
              | Range "|" TimeScale            -- rangeWithTimeMulPipeImplicit
              | Range "|" "/" RandNum           -- rangeWithTimeDivPipe
              | Curly "|" TimeScale            -- curlyWithTimeMulPipeImplicit
              | Curly "|" "*" RandNum          -- curlyWithTimeMulPipe
              | Curly "|" "/" RandNum          -- curlyWithTimeDivPipe

  RandNum     = Curly | number
  Curly       = "{" CurlyBody "}" Seed?
  CurlyBody   = number "?" number     -- range
              | ListOf<CurlyEntry, ",">  -- list
  CurlyEntry  = number  -- num
              | ident   -- ref
  Seed        = "@" SeedChars
  SeedChars   = seedChar+
  seedChar    = letter | digit | "_"

  TimeScale   = number "/" number
              | number
  Special     = specialChar
  specialChar = letter | "?"
  ident       = (letter | "_") alnum*
  number      = sign? digit+ ("." digit*)?
              | sign? digit* "." digit+
  PlainNumber = number ~ (hspaces? "->")
  sign        = "+" | "-"
  hspace      = " " | "\t"
  hspaces     = hspace+
  space       := hspace
  nl          = "\r\n" | "\n" | "\r"
  nls         = nl+
}
```

### Implementation notes

- `*` and `^` iterate the right mot’s values; a negative timeScale on the right reverses the left mot for that right value.
- `.` tiles the right mot against the left; tags (e.g., `x`) result in pass-through of the left value at that position.
- Choices are resolved at evaluation time; ranges expand to integer pips before further processing.
- The string form shows decimal time scales (fractions are normalized).


