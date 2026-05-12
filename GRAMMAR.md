## Crux
https://github.com/animist-os/crux

This document describes the Crux grammar used to build and transform musical mots as sequences of "pips" (step, timeScale, optional tag). The pips within a mot represent a linear series of conriguous events. You can concatenate mots, repeat them, slice/rotate, combine them multiplicatively, and introduce ranges and choices.   You can apply low level schenker operations on pips and mots.  All operations can be applied in either a "fan" approach or a "cog" one.  

Fan (outer):  For each r in R, apply op to all of A, then concatenate.   The lengths multiply

Cog (elementwise): Pair positions; RHS cycles as needed to cover LHS.  Length will be the same as LHS (unless there are nested mots in RHS).

### Program

- **Program**: one or more sections separated by `!`. Each section is one parallel voice; the sections in a program play simultaneously as an arrangement. The program returns an array of the final statement value from each section, ordered by appearance.
- **Section**: A group of statements that share an environment. The `!` separator marks the boundary between sections (= voices).
- **Section separator**: `!` introduces the next voice. Bare `!` (and `!0`) means the voice enters at t=0 simultaneously with the prior voices. `!N` introduces the voice at absolute time N — measured from t=0 of the arrangement, not relative to the prior voice. Implemented by prepending a rest of duration N to the voice's resulting mot. Fractional offsets are allowed (`!1/2`). Negative offsets are not supported.
- **Statement**: either an assignment, an operator alias, or an expression.
- **Macro Assignment**: `Name = Expr` — stores the expression AST for later substitution (macro-like behavior). When referenced, the original expression structure is preserved and evaluated in place.
- **Evaluating Assignment**: `Name := Expr` — evaluates the expression immediately and stores the resulting Mot. The stored value is flattened and deterministic.
- **Operator Alias**: `Name = OpSym` (allows using custom names for operators)
- **Reference**: use a previously assigned `Name` in an expression.

#### Assignment Examples

Macro assignment (`=`) preserves expression structure for substitution:
```text
R = [[0,0], [0,0,0,0], 0, 0]
a = [0 -> 9] . R
```
is equivalent to:
```text
a = [0 -> 9] . [[0,0], [0,0,0,0], 0, 0]
```
The nested structure of `R` is preserved when used in the dot operator.

Evaluating assignment (`:=`) flattens the result:
```text
R := [[0,0], [0,0,0,0], 0, 0]
a = [0 -> 9] . R
```
Here `R` is evaluated to `[0, 0, 0, 0, 0, 0, 0, 0]` (flattened), so the nested structure is lost.

Example (single section, backward compatible):
```text
A = [0, 1]
A, [2]
```
Returns `[[0, 1, 2]]` (array with one section result).

Example (multiple voices, simultaneous entry):
```text
[0, 2, 4]
!
[5, 7, 9]
!
[10, 12, 14]
```
Returns `[[0, 2, 4], [5, 7, 9], [10, 12, 14]]` — three voices all entering at t=0.

Example (staggered entries with `!N`):
```text
A = [0, 2, 4]
A
!4
A
!8
A
```
Returns three voices: `[[0, 2, 4], [r | 4, 0, 2, 4], [r | 8, 0, 2, 4]]`. The second voice enters at t=4 (4 units after t=0), the third at t=8 — both absolute, both implemented as a leading rest of the given duration.

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
Returns `[[2, 3, 3, 4]]` (same fan-add behavior as `*` — for each r in `[2,3]`, add r to all of `[0,1]`).

### Mots and values

- **Mot**: square-bracket list of values (comma-separated): `[Value, Value, ...]`
- **Nested Mot**: double-bracket list for hierarchical grouping: `[[Value, Value, ...]]`
  - Nested mots now preserve unit duration by default (no automatic subdivision)
  - Use the `/` postfix operator to subdivide: `[[0,1,2]]/` → `[0|/3, 1|/3, 2|/3]`
  - Can be nested recursively: `[[[0,1],[2,3]]]`
- **Value** can be:
  - **Pip**: `number` optionally combined with a timeScale via a `|` pipe form, or a special tag.
    - `number` is the step (may be integer or float; fractions `n/d` are also accepted and normalize to a decimal step).
    - `TimeScale` is attached using the pipe forms documented under *Pipe forms* below — `value | ts`, `value | * factor`, `value | / divisor`.
      - Examples: `[0, 1 | 2] -> [0, 1 | 2]`, `[1 | /4] -> [1 | /4]`. (Note: `[1/4]` is also valid, but parses as a fractional **step** `0.25` with timeScale 1.)
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

**Postfix drop** `\`: drops N elements from the end (positive N) or start (negative N).
   - `Expr \ N` drops N elements from the end
   - `Expr \ -N` drops N elements from the start
   - N can be a number or RandNum (curly expression)
   - Examples:
```text
[0, 1, 2, 3, 4] \ 1         -> [0, 1, 2, 3]      // drop last 1
[0, 1, 2, 3, 4] \ 2         -> [0, 1, 2]         // drop last 2
[0, 1, 2, 3, 4] \ -1        -> [1, 2, 3, 4]      // drop first 1
[0, 1, 2, 3, 4] \ -2        -> [2, 3, 4]         // drop first 2
[0 -> 7] \ {1, 2}           -> [0..5] or [0..6] // random drop count
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
     - Example: `[1, 2, 3] * [0 | -1] -> [3, 2, 1]`
   - `^` fan-mul (expand steps):
     - Same outer pairing as `*`, but steps multiply instead of add.
     - Example: `[0, 1] ^ [2] -> [0, 2]`, `[1, 2] ^ [2] -> [2, 4]`
  - `.` or `.*` cog-add (elementwise add with cycling):
    - Pair each left value with the corresponding value from the right, cycling the right as needed.
    - Nested RHS subdivision: If the right-side element at a position is a nested mot literal, it coerces a subdivision of the left pip at that position: emit one pip per element of the nested group where each emitted pip uses `step = left.step + rhsNested.step` and `timeScale = left.timeScale * rhsNested.timeScale`. Tags combine (`r` carries through).
      - **Note**: Nested mots now preserve unit duration by default. Use the `/` postfix operator for subdivision.
      - Example (unit duration preserved): `[0,4,2] . [0, [1,0], 0] -> [0, 5, 4, 2]`.
      - Example (explicit timescales): `[0,4,2] . [0, [1 | 2, 0 | 2], 0] -> [0, 5, 4, 2]`.
      - Example (with subdivision): `[0,4,2] . [0, [1,0]/, 0] -> [0, 5 | /2, 4 | /2, 2]` (the nested `[1,0]/` subdivides position 1: left pip `4` combined with nested steps `[1, 0]` at half time gives `5|/2, 4|/2`).
    - Example: `[0, 1, 2] .* [10, 20] -> [10, 21, 12]` (same as using `.`)
  - '.,' cog-concatenate (element-wise zip with RHS cycling)
      - interleaves two mots by pairing each LHS element with a corresponding RHS element
      - RHS cycles/mod rotates: for each LHS position i, uses RHS[i % RHS.length]
      - iterates through all LHS elements, cycling through RHS elements as needed
      - Example `[0,1,2] ., [9,8,7] -> [0,9,1,8,2,7]`
      - Example `[0 -> 3] ., [-7] -> [0,-7,1,-7,2,-7,3,-7]` (RHS cycles)
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
     - Snaps LHS steps to nearest RHS scale degree (mod 7), avoiding unisons. Ties are broken by the lowest scale degree.
     - Example: `[0,1,2,3] p [0,2,4] -> [2, 0, 0, 2]` (0→2 nearest non-unison; 1→0 nearest; 2→0 skip unison, tie resolved low; 3→2 nearest, tie resolved low).
   - `f` fold (fan):
     - Concatenates the mot with its reverse, transposed by each RHS value. Steps add; timeScales multiply.
     - Creates palindrome/arch structures. Multiple RHS values produce multiple folds.
     - Examples:
```text
[0,1,2] f [0]          -> [0, 1, 2, 2, 1, 0]          // simple palindrome
[4,5,6] f [2]          -> [4, 5, 6, 8, 7, 6]          // fold with transposition
[0,1,2] f [0,1]        -> [0, 1, 2, 2, 1, 0, 3, 2, 1] // two folds (fan)
```
   - `>` displace (shift a mot forward or backward in time):
     - Positive RHS step: prepend a rest with timeScale equal to the step value.
     - Negative RHS step: trim from the front by that many time units (anticipation).
     - Zero: identity (no change).
     - Examples:
```text
[0, 1, 2] > [1]           -> [r, 0, 1, 2]           // delayed by 1 beat
[0, 1, 2] > [2]           -> [r | 2, 0, 1, 2]       // delayed by 2 beats
[0, 1, 2] > [1/2]         -> [r | /2, 0, 1, 2]      // delayed by half a beat
[0, 1, 2] > [-1]          -> [1, 2]                  // anticipation: first pip trimmed
[0 | 2, 1] > [-1]         -> [0, 1]                  // partial trim of first pip
```
   - `||` mot timeScale (scale all pip durations in a mot):
     - Multiplies every pip's timeScale by the RHS value.
     - RHS can be a number (step used as factor) or a pipe-only entry (timeScale used as factor).
     - Examples:
```text
[0, 1, 2] || [2]          -> [0 | 2, 1 | 2, 2 | 2]        // double-time
[0, 1, 2] || [1/2]        -> [0 | /2, 1 | /2, 2 | /2]     // half-time
[0, 1, 2] || [| 2]        -> [0 | 2, 1 | 2, 2 | 2]        // pipe-only form
[0 | 2, 1] || [3]         -> [0 | 6, 1 | 3]               // compounds with existing timeScale
[0, 1] || [2] || [3]      -> [0 | 6, 1 | 6]               // chains (left-assoc)
```
   - `@` at-index (apply transformations at specific positions without cycling):
     - Unlike `.` which cycles the RHS over the LHS, `@` applies transformations only at specified indices.
     - RHS uses the at-index mot syntax: `[@index value, @index value, ...]`
     - **Negative indices**: `@-1` is the last pip, `@-2` is second-to-last, etc.
     - **Multiple targets**: Comma-separate entries like `[@2 -7, @4 7]`.
     - **Length compensation**: All indices refer to the original mot positions. When a transformation changes length (e.g., subdivision), subsequent indices are automatically adjusted.
     - Examples:
```text
[0 -> 9] @ [@5 -7]                     -> [0, 1, 2, 3, 4, -2, 6, 7, 8, 9]     // index 5: 5+(-7)=-2
[0 -> 9] @ [@-1 -7]                    -> [0, 1, 2, 3, 4, 5, 6, 7, 8, 2]      // last pip: 9+(-7)=2
[0 -> 9] @ [@2 -7, @4 7]               -> [0, 1, -5, 3, 11, 5, 6, 7, 8, 9]    // multiple targets
[0 -> 9] @ [@5 [1,0,-1]/]              -> [0, 1, 2, 3, 4, 6|/3, 5|/3, 4|/3, 6, 7, 8, 9]  // subdivision at index 5
[0 -> 9] @ [@2 [1,0,-1], @5 -7]        -> [0, 1, 3, 2, 1, 3, 4, -2, 6, 7, 8, 9]  // @5 compensates for +2 length change at @2
```

3) **Voice composition** (`!`, top-level):
   - `!` separates sections; each section becomes a voice in the arrangement.
   - Bare `!` introduces the next voice at t=0 (simultaneous with prior voices).
   - `!N` introduces the next voice at absolute time N (measured from t=0 of the arrangement, not relative to the prior voice). `!0` is equivalent to bare `!`. Fractional offsets are allowed (`!1/2`); negative offsets are not.
   - Implemented by prepending a leading rest of duration N to the voice's evaluated mot. The voice's musical content is otherwise untouched.
   - Voices are independent in duration — no padding or truncation.
   - Examples:
```text
[0, 2, 4]
!
[5, 7, 9]                             -> two voices, both entering at t=0

A = [0, 2, 4]
A
!4
A
!8
A                                     -> three-voice canon, entries at 0, 4, 8
```

4) **Diads** (`&`, inside mots):
   - Creates simultaneous pitches at a single time position (chords).
   - `[0 & 4, 2 & 5]` — each pip has multiple steps sharing one timeScale.
   - Operators distribute over diad steps: `[0 & 4] . [1]` = `[1 & 5]`.
   - Three or more notes: `[0 & 4 & 7]`.
   - TimeScale comes from the left pip: `[0 | 2 & 4]` = step 0 and 4, both duration 2.
   - Examples:
```text
[0 & 4, 2 & 5, 4 & 7]                -> parallel thirds
[0 & 4 & 7, 2, 4]                    -> opening chord, then melody
[0 & 4] * [0, 1]                     -> [0 & 4, 1 & 5]
```

5) **Concatenation**:
   - Use `,` between expressions to concatenate mots.
   - Example: `[0, 1], [2, 3] -> [0, 1, 2, 3]`.
   - Note: Juxtaposition concatenation (space-separated expressions) is **not supported**; you must use explicit commas.

6) **Grouping**: parentheses `(` `)` control evaluation order.
```text
([0, 1] ^ [2]) * [0] -> [0, 2]
```

7) **Global placeholder** (`_`):
   - `_` is a placeholder meaning "each voice's output."
   - Any expression statement containing `_` is a **global op** — it does not contribute to its own voice's value, but is applied as a post-processing step to every voice after all voices have been evaluated. The `!N` voice offset is prepended *after* global ops, so a leading rest from `!N` is never transformed by `_`.
   - `_` participates in normal Crux expressions: it can appear on either side of binary ops and with postfix ops.
   - Multiple global op statements compose in declaration order (first applied first, result feeds into next).
   - A section containing only global ops produces no output.
   - `_` can appear in any section, alongside regular statements.
   - Note: `_` must be separated from postfix single-letter operators by a space (`_ t`, not `_t`) to avoid being parsed as an identifier.
   - Examples:
```text
// Apply a rhythm to all sections
[0, 1, 2, 3]
!
[7, 6, 5, 4]
!
_ .j [|, |/2, |/2]

// Repeat every section 3 times
[0, 1]
!
[2, 3]
!
_:3

// Transpose all sections by 10
[0, 1, 2]
!
[3, 4, 5]
!
_ . [10]                          -> sections become [10, 11, 12] and [13, 14, 15]

// Chain operations
(_ . [10]):2                      -> transpose then repeat

// Multiple global ops (compose in order)
_ . [10]
_ . [100]                         -> first add 10, then add 100

// Reference variables
R = [|, |/2, |/2]
[0, 1, 2]
!
[3, 4, 5]
!
_ .j R
```

### Precedence summary

From highest to lowest binding:
1. Postfix operators: drop (`\`), subdivide (`/`), zip (`z`), tie (`t`), repeat (`:`)
2. Binary operators: `.*`, `.^`, `.->`, `.j`, `.m`, `.l`, `.t`, `.c`, `.,`, `.g`, `.r`, `.~`, `->`, `j`, `m`, `l`, `c`, `g`, `r`, `p`, `f`, `*`, `^`, `.`, `~`, `@`, `>`, `||` (all left-associative)
3. Concatenation: `,` (left-associative)
4. Assignment: `=`, `:=`
5. Section/voice separator: `!`, `!N` (top-level only)

### Identifiers

- A name is either a single letter, or starts with a letter or `_` followed by one or more `(alnum | "_")` characters (`ident = (letter | "_") (alnum | "_")+ | letter`).
- A bare `_` is **not** an identifier — it's reserved as the global placeholder.
- Referencing an unknown name is an error: "undeclared identifier: Name".

### Errors and constraints

- Repeat count must be a non-negative finite number.
- Range endpoints must be finite numbers.
- Delta mots support only simple numeric pips (no tags/ranges/choices inside semicolon form).
- Many operators require mots; attempting to use a non-mot where a mot is required is an error.

### Directives

Lines of the form `// #name value...` are *directives* — convention-based
metadata extracted from comments and returned alongside the program's
sections. The Crux interpreter ignores them syntactically (they sit inside
comments) and the directive system is open: any `#name` is recognized.

**Sampler-scoping rule.** Tokens after `#name` are split on whitespace. If
there are two or more tokens **and** the last token is a positive integer
(matching `[1-9]\d*`), the directive is sampler-scoped: the trailing integer
is the sampler index, and the prior tokens (joined with spaces) are the
value. Otherwise the directive is global and the value is the full
post-name remainder.

Three names get structural treatment:

- `// #target SECTION SAMPLER` — routes section `SECTION` (1-based) to
  `Sampler-SAMPLER`. Out-of-range sections are recorded without error.
- `// #preset NAME SAMPLER` — preset name for `Sampler-SAMPLER`.
- `// #octave VALUE SAMPLER` — octave offset for `Sampler-SAMPLER`.

The latter two follow the generic sampler-scoping rule; they are not
special-cased beyond appearing in `samplers` rather than `directives`. Any
future directive that follows the same shape (e.g. `// #volume 0.7 2`,
`// #pan -0.5 3`) lands in `samplers` automatically.

**Output shape.** `golden.crux_interp(source)` returns the existing fields
plus:

```text
{
  routing:    { 1: 4, 2: 2, 3: 3, ... },   // sectionIndex -> samplerIndex
  samplers:   { 2: { preset: 'Marimba', octave: '-1' } },
  directives: { bpm: '90', ... },          // global, sampler-less
  ...
}
```

`routing` is populated for every section that exists. Sections without an
explicit `#target` get the default mapping `N -> N` (section 1 to Sampler-1,
etc.). Explicit `#target` entries for non-existent sections are kept as-is.

**Last-wins.** Duplicate directives (`#target 1 4` then `#target 1 7`)
overwrite — the last one in source order takes effect. This is intentional;
it lets you override a header directive from later in the file.

**Examples.**

```text
// #target 1 4              -> routing: { 1: 4 }
// #preset Marimba 2        -> samplers: { 2: { preset: 'Marimba' } }
// #octave -1 2             -> samplers: { 2: { octave: '-1' } }
// #bpm 90                  -> directives: { bpm: '90' }
// #preset Grand Piano      -> directives: { preset: 'Grand Piano' }  (no trailing int)
// #volume 0.7 3            -> samplers: { 3: { volume: '0.7' } }     (unknown name, same rule)
// #octave -1               -> directives: { octave: '-1' }           (one token; -1 is not positive)
```

Values are returned as raw strings; downstream renderers parse them however
they need. Crux itself only enforces the sampler-scoping rule and the
`#target` routing semantics.

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
[1, 2, 3] * [0 | -1]         -> [3, 2, 1]
[1, 2] ^ [2]                 -> [2, 4]
[0, 1, 2] . [10, 20]         -> [10, 21, 12]
[0, 1, 2] .* [10, 20]        -> [10, 21, 12]
[1, 2] .^ [2]                -> [2, 4]

// Grouping
([0, 1] ^ [2]) * [0]         -> [0, 2]

// Assignment & reference
A = [0, 1]\nA, [2]           -> [0, 1, 2]

// Drop and rotation
[0, 1, 2, 3, 4] \ 1            -> [0, 1, 2, 3]    // drop last 1
[0, 1, 2, 3, 4] \ -1           -> [1, 2, 3, 4]    // drop first 1
// Rotation is via ~ operator
[0, 1, 2, 3] ~ [-1]          -> [3, 0, 1, 2]
[0, 1, 2, 3] ~ [1, 2]        -> [1, 2, 3, 0, 2, 3, 0, 1]

// Displacement
[0, 1, 2] > [1]              -> [r, 0, 1, 2]
[0, 1, 2] > [1/2]            -> [r | /2, 0, 1, 2]
[0, 1, 2] > [-1]             -> [1, 2]

// Mot TimeScale
[0, 1, 2] || [2]             -> [0 | 2, 1 | 2, 2 | 2]
[0, 1, 2] || [1/2]           -> [0 | /2, 1 | /2, 2 | /2]

// Diads (pip-level chords)
[0 & 4, 2 & 5]               -> [0 & 4, 2 & 5]
[0 & 4] . [1]                -> [1 & 5]
[0 & 4] * [0, 1]             -> [0 & 4, 1 & 5]

// Voice composition (parallel voices via !)
[0, 1]
!
[2, 3]                       -> two voices, both entering at t=0
A = [0, 2, 4]
A
!4
A                            -> two-voice canon, second voice enters at t=4
```

### Ohm-JS grammar (reference)

This is the actual grammar implemented in `src/grammar.js`.

```text
Crux {

  Prog
    = nls? Section ProgRest* trailingSpace      -- withContent
    | nls? trailingSpace                         -- empty

  ProgRest
    = SectionSep Section

  trailingSpace = (nl | hspace | comment)*

  Section
    = nls* ListOf<Stmt, nls+>

  SectionSep
    = (nls | hspace | comment)* "!" SectionOffset? (nls | hspace | comment)*

  // Optional absolute-time offset on a section separator: !N introduces the
  // next section as a parallel voice entering at time N. Bare ! is !0.
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

  // Operator aliasing sugar, e.g.,  splay = *  -> [0,1] splay [1,2] == [0,1] * [1,2]
  OpAliasStmt
    = ident "=" OpSym

  ExprStmt
    = Expr

  Expr
    = FollowedByExpr

  FollowedByExpr
    = FollowedByExpr "," MulExpr   -- fby
    | MulExpr

  // Binary operators (lower precedence than postfix operators)
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
    | MulExpr "f" PostfixExpr      -- fold
    | MulExpr "*" PostfixExpr      -- mul
    | MulExpr "^" PostfixExpr      -- expand
    | MulExpr "." PostfixExpr      -- dot
    | MulExpr "~" PostfixExpr      -- rotate
    | MulExpr ".~" PostfixExpr     -- dotRotate
    | MulExpr ident PostfixExpr    -- aliasOp
    | MulExpr "@" PostfixExpr      -- atIndex
    | MulExpr ">" PostfixExpr      -- displace
    | MulExpr "||" PostfixExpr     -- motTimeScale
    | PostfixExpr

  // Postfix operators (tighter than binary; apply to immediate left operand)
  PostfixExpr
    = PostfixExpr "/"                            -- subdivide
    | PostfixExpr "z"                            -- zipColumns
    | PostfixExpr "t"                            -- tiePostfix
    | PostfixExpr hspaces? ":" hspaces? RandNum  -- repeatPostRand
    | PostfixExpr hspaces? ":" hspaces? number   -- repeatPost
    | PostfixExpr hspaces? "\\" hspaces? RandNum -- dropRand
    | PostfixExpr hspaces? "\\" hspaces? number  -- drop
    | PriExpr

  PriExpr
    = globalPlaceholder            -- globalPlaceholder
    | Pip                          -- pipAsMot
    | ident                        -- ref
    | "[[" NestedBody "]]"         -- nestedMot
    | "[" AtIndexList "]"          -- atIndexMot
    | "[" MotBody "]"              -- mot
    | number                       -- numAsMot
    | "(" Expr ")"                 -- parens
    | Curly                        -- curlyAsExpr

  AtIndexList
    = NonemptyListOf<AtIndexEntry, atIndexSep>

  atIndexSep = hspaces? "," hspaces?

  AtIndexEntry
    = "@" hspaces? index hspaces? SingleValue

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
  // Abbreviated nested mot that closes with a single ']' so it can be followed by more values inside the same mot
  NestedMotAbbrev = "[[" MotBody "]"

  MotBody
    = ListOf<Entry, ",">           -- absolute

  Entry
    = Value hspaces? ":" hspaces? RandNum  -- repeatPip
    | Value hspaces? ":"                   -- padPip
    | Value                                -- plain

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
    | ident hspaces? "*" hspaces? MotLiteral        -- inlineMulRefMot
    | "(" Expr ")"                                  -- exprInMot
    | ident                                         -- refInMot

  // Values that can appear on the right side of a diad &
  DiadValue
    = Pip
    | Range
    | Curly
    | CurlyPip
    | ident                                         -- refInDiad
    | "(" Expr ")"                                  -- exprInDiad

  Range
    = RandNum "->" RandNum         -- inclusive

  Pip
    = Range hspaces? "|" hspaces? TimeScale               -- rangeWithTimeMulPipeImplicit
    | Range hspaces? "|" hspaces? "/" hspaces? RandNum    -- rangeWithTimeDivPipe
    | Range                                               -- rangeNoTimeScale
    | StepValue hspaces? "|" hspaces? TimeScale           -- withTimeMulPipeImplicit
    | StepValue hspaces? "|" hspaces? "*" hspaces? RandNum -- withTimeMulPipe
    | StepValue hspaces? "|" hspaces? "/" hspaces? RandNum -- withTimeDivPipe
    | StepValue hspaces? "|"                              -- withPipeNoTs
    | "|" hspaces? TimeScale                              -- pipeOnlyTs
    | "|" hspaces? "*" hspaces? RandNum                   -- pipeOnlyMul
    | "|" hspaces? "/" hspaces? RandNum                   -- pipeOnlyDiv
    | "|"                                                 -- pipeBare
    | StepValue                                           -- noTimeScale
    | Special hspaces? "|" hspaces? TimeScale             -- specialWithTimeMulPipeImplicit
    | Special hspaces? "|" hspaces? "*" hspaces? RandNum  -- specialWithTimeMulPipe
    | Special hspaces? "|" hspaces? "/" hspaces? RandNum  -- specialWithTimeDivPipe
    | Special                                             -- special
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

  // Parenthesized arithmetic for use in numeric contexts (requires parens to avoid ambiguity)
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

  // Curly-of-pips: choose one full pip-like value
  CurlyPip
    = "{" ListOf<Pip, ","> "}" Seed?
  Curly
    = "{" CurlyBody "}" Seed?
  CurlyBody
    = ListOf<CurlyEntry, ",">      -- list
  CurlyEntry
    = Range              -- range
    | number "/" number  -- frac
    | number             -- num
    | MemberAccess       -- member
    | ident              -- ref

  MemberAccess
    = ident "." ident  -- prop

  Seed = "$" SeedChars
  SeedChars = seedChar+
  seedChar = letter | digit | "_"

  TimeScale
    = RandNum "/" RandNum  -- frac
    | RandNum              -- plain

  Special
    = specialChar

  // Special characters only match when NOT followed by alphanumeric
  // This allows identifiers like 'rr', 'rest', 'rhythm' to work
  specialChar
    = "r" ~alnum

  globalPlaceholder = "_" ~(alnum | "_")

  ident = (letter | "_") (alnum | "_")+  -- withChars
        | letter                          -- single

  // Set of binary operator symbols that can be aliased
  OpSym
    = ".*" | ".^" | ".->" | ".j" | ".m" | ".l" | ".t" | ".c" | ".," | ".g" | ".r"
    | "->" | "||" | ">" | "j" | "m" | "l" | "c" | "g" | "r" | "p" | "f" | "*" | "^" | "." | "~" | "@"

  number
    = sign? digit+ ("." digit+)?
    | sign? digit* "." digit+

  // Prevent a bare number from capturing the start of a range
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
```

### Implementation notes

- `*` and `^` iterate the right mot's values; a negative timeScale on the right reverses the left mot for that right value.
- `.` tiles the right mot against the left; nested mots in RHS can subdivide the corresponding LHS pip.
- Choices are resolved at evaluation time; ranges expand to integer pips before further processing.
- The string form shows decimal time scales (fractions are normalized).
- Only `r` is supported as a special character (rest). The `?` character is not currently implemented.
- All binary operators are left-associative.
- Whitespace (spaces and tabs) is allowed around operators for readability but is not required.


