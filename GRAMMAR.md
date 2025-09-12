## Crux

This document describes the Crux grammar used to build and transform musical motifs as sequences of “pips” (step, timeScale, optional tag). You can concatenate motifs, repeat them, slice/rotate, combine them multiplicatively, and introduce ranges and choices.

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

### Motifs and values

- **Motif**: square-bracket list of values (comma-separated): `[Value, Value, ...]`
- **Value** can be:
  - **Pip**: `number` or `number:TimeScale` or a special tag.
    - `number` is the step (may be integer or float).
    - `TimeScale` after `:` is either a plain number or a fraction `n/d`.
      - Examples: `[0, 1:2] -> [0, 1:2]`, `[1:1/4] -> [1:0.25]`.
    - A single letter or `_` inside a motif is a tagged pip with step 0. Example: `[_] -> [:_0]`.
  - **Degree**: lowercase roman numerals `i, ii, iii, iv, v, vi, vii` represent scale degrees (symbolic). Example: `[iv]`.
  - **Range**: `a..b` expands inclusively to integer steps. Examples:
    - `[0..3] -> [0, 1, 2, 3]`
    - `[3..1] -> [3, 2, 1]`
  - **Choice**: `x | y | z` picks one option at evaluation time. Example: `[0 | 1 | 2] -> [0]` or `[1]` or `[2]`.

Notes:
- Floats are supported for steps and time scales. Fractions normalize to decimals in string output.
 

### Operators (left to right unless grouped)

In decreasing precedence (tighter binds higher):

1) **Postfix segment**: slicing applied to a motif result.
   - Forms:
     - `{start,end}`
     - `{start,}` (start to end)
     - `{,end}` (from start to end index)
     - `{start}` (single index to end)
     - `{}` (no slice)
   - Indices are numbers; negative indices count from end. End is exclusive.
   - Examples:
```text
[0, 1, 2, 3, 4] {-3,-1}   -> [2, 3]
[0, 1, 2, 3, 4] {1,}      -> [1, 2, 3, 4]
[0, 1, 2, 3, 4] 1{}       -> [4, 0, 1, 2, 3]
[0, 1, 2, 3, 4] -1{2}     -> [3, 4, 2]
```

2) **Repeat**: `N : Expr` repeats a motif `N` times (N must be a non-negative finite number).
```text
3:[1] -> [1, 1, 1]
```

3) **Combine pairs of motifs**:
   - `*` multiply-and-add (cartesian product-like):
     - For each value in the right motif, combine it with every value in the left motif.
     - Steps add; timeScales multiply.
     - If the right value has a negative timeScale, the left motif is reversed for that right value.
     - Example: `[1, 2, 3] * [0:-1] -> [3, 2, 1]`
   - `^` expand (multiply steps):
     - Same pairing as `*`, but steps multiply instead of add.
     - Example: `[0, 1] ^ [2] -> [0, 2]`, `[1, 2] ^ [2] -> [2, 4]`
   - `.` dot (tiled pairwise):
     - Pair each left value with the corresponding value from the right, tiling the right as needed.
   - `~` rotate:
     - For each value k in the right motif, rotate the left motif left by k (negative k rotates right), appending results in order.
     - Examples: `[0,1,2,3] ~ [-1] -> [3,0,1,2]`, `[0,1,2,3] ~ [1,2] -> [1,2,3,0, 2,3,0,1]`.
     - Numeric case behaves like `*` on a single pair each step (step add, timeScale multiply).
     - Tagged pips pass the left value through unchanged; tag `x` in either side is treated as a no-op for that position.
     - Example: `[0, 1, 2] . [10, 20] -> [10, 21, 12]`.

4) **Concatenation**:
   - Use `,` or juxtaposition (spaces/tabs, not newline) between expressions to concatenate motifs.
   - Examples: `[0, 1], [2, 3] -> [0, 1, 2, 3]`, `[0, 1] [2, 3] -> [0, 1, 2, 3]`.

5) **Grouping**: parentheses `(` `)` control evaluation order.
```text
([0, 1] ^ [2]) * [0] -> [0, 2]
```

### Precedence and associativity

From highest to lowest:
- Segment `{...}` (postfix)
- Repeat `N Expr`
- Multiplicative operators: `*`, `^`, `.` (left-associative)
- Concatenation: `,` and juxtaposition (left-associative)
- Parentheses can override as usual.

### Identifiers

- Names must start with a letter or `_`, followed by alphanumerics (`ident = (letter | "_") alnum*`).
- Referencing an unknown name is an error: “undeclared identifier: Name”.

### Errors and constraints

- Repeat count must be a non-negative finite number.
- Range endpoints must be finite numbers.
- Delta motifs support only simple numeric pips (no tags/ranges/choices inside semicolon form).
- Many operators require motifs; attempting to use a non-motif where a motif is required is an error.

### Mixed examples

```text
// Absolute list
[0, 1, 2, 3]                 -> [0, 1, 2, 3]

// Range example
([0..2]), [3:2]              -> [0, 1, 2, 3:2]

// Choices (result varies)
[0 | 1 | 2]                  -> one of [0], [1], [2]

// Specials
[_]                          -> [:_0]

// Concatenation (comma or plus)
[0, 1], [2, 3]               -> [0, 1, 2, 3]
[0, 1] + [2, 3]              -> [0, 1, 2, 3]

// Multiplicative family
[1, 2, 3] * [0:-1]           -> [3, 2, 1]
[1, 2] ^ [2]                 -> [2, 4]
[0, 1, 2] . [10, 20]         -> [10, 21, 12]

// Grouping
([0, 1] ^ [2]) * [0]         -> [0, 2]

// Assignment & reference
A = [0, 1]\nA, [2]           -> [0, 1, 2]

// Slicing and rotation
[0, 1, 2, 3, 4] {-3,-1}      -> [2, 3]
[0, 1, 2, 3, 4] {1,}         -> [1, 2, 3, 4]
// Rotation is via ~ operator
[0, 1, 2, 3] ~ [-1]          -> [3, 0, 1, 2]
[0, 1, 2, 3] ~ [1, 2]        -> [1, 2, 3, 0, 2, 3, 0, 1]
```

### Ohm-JS grammar (reference)

This is a lightly reformatted view of the core grammar implemented in `src/index.js`.

```text
Andy {
  Prog        = Stmt*
  Stmt        = AssignStmt | ExprStmt
  AssignStmt  = ident "=" Expr
  ExprStmt    = Expr

  Expr            = FollowedByExpr
  FollowedByExpr  = FollowedByExpr "," MulExpr
                 | FollowedByExpr MulExpr
                 | MulExpr

  MulExpr     = MulExpr "*" RepeatExpr
              | MulExpr "^" RepeatExpr
              | MulExpr "." RepeatExpr
              | MulExpr "~" RepeatExpr
              | RepeatExpr

  RepeatExpr  = number ":" PostfixExpr  -- repeat
              | PostfixExpr

  PostfixExpr = PostfixExpr Segment  -- segment
              | PriExpr

  PriExpr     = ident                -- ref
              | "[" MotifBody "]"  -- motif
              | "(" Expr ")"      -- parens

  Segment     = "{" SliceSpec "}"

  SliceSpec   = Index "," Index
              | Index ","
              | "," Index
              | Index
              |

  Index       = sign? digit+

  MotifBody   = ListOf<Value, ",">

  Value       = Choice
  Choice      = Choice "|" SingleValue  -- alt
              | SingleValue            -- single
  SingleValue = Range | Pip
  Range       = number ".." number
  Pip         = Special
              | number ":" TimeScale
              | number
              | roman
  roman       = "vii" | "iii" | "vi" | "iv" | "ii" | "v" | "i"
  TimeScale   = number "/" number
              | number
  Special     = specialChar
  specialChar = letter | "_"
  ident       = (letter | "_") alnum*
  number      = sign? digit+ ("." digit*)?
              | sign? digit* "." digit+
  sign        = "+" | "-"
}
```

### Implementation notes

- `*` and `^` iterate the right motif’s values; a negative timeScale on the right reverses the left motif for that right value.
- `.` tiles the right motif against the left; tags (e.g., `x`) result in pass-through of the left value at that position.
- Choices are resolved at evaluation time; ranges expand to integer pips before further processing.
- The string form shows decimal time scales (fractions are normalized).


