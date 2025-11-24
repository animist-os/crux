## Crux quick reference

### Program Structure
- **Sections**: Use `!` to separate sections. Each section returns its final mot value. Program returns an array of all section results.
- **Operator Aliasing**: `name = operator` — assign custom names to operators (e.g., `splay = *`).
- **Assignments**: Variables persist across sections within the same program.

### Operators (fan vs cog)
- Concatenation: `,` — concatenate mots.
- Repeat: `Expr : N` — repeat a mot N times, unpacks to a fan add followed by an identity mot of length N
- Subdivide: `/` (postfix) — divide each pip's timeScale by mot length.
- Zip: `z` (postfix) — round-robin interleave comma-separated expressions.
- Slice: `start ... end`, `start ...`, `... end` — slice section.
- Spread add: `*` — outer/cartesian combine; steps add, timeScales multiply (RHS ts < 0 reverses LHS for that r).
- Spread mul (expand): `^` — outer/cartesian with step multiply.
- Tile add: `.` or `.*` — elementwise add with RHS cycled.
- Tile mul: `.^` — elementwise multiply with RHS cycled.
- Tile zip: `.,` — elementwise interleave with RHS cycling (RHS mod/rotates through LHS length).
- Rotate: `~` (fan), `.~` (cog) — rotate LHS by k positions for each k in RHS.
- Jam: `j` (fan), `.j` (cog) — replace steps/timeScales with RHS; `|` entries pass through.
- Steps (fan): `->` — for each k in RHS, emit LHS transposed by 0..k and concatenate.
- Steps (cog): `.->` — per-position run for each LHS value up to k (cycled).
- Mirror: `m` (fan), `.m` (cog) — reflect steps around anchor k.
- Lens: `l` (fan), `.l` (cog) — sliding window emission.
- Tie: `t` (postfix unary), `.t` (cog) — `t` merges adjacent equal-step pips; `.t` uses mask.
- Constraint: `c` (fan), `.c` (cog) — keep/omit via mask; timeScales multiply.
- Glass: `g` (fan), `.g` (cog) — Glass-inspired minimalist rhythmic patterns.
- Reich: `r` (fan), `.r` (cog) — Reich-inspired phasing patterns.
- Pärt: `p` (fan) — Pärt-inspired tintinnabulation with octave equivalence.



Pips:

* Range: `[0->3] === [0, 1, 2, 3]`
* Random Choice: `[{0, 1, 2}] === one of [0] [1] [2]`
* Random Range: `[{-2 -> 2}] === random integer from -2 to 2`
* Fractional steps: `[1/2, -3/4]` emits `[0.5, -0.75]`
* Tags (character pips): `r` (rest)

### Binary Mot Operators

| Operator | Example | Result |
|---|---|---|
| Concatenate `,` | `[0, 1], [2]` | `[0, 1, 2]` |
| Repeat `Expr : N` | `[1] : 3` | `[1, 1, 1]` |
| Subdivide `/` | `[[0,1,2]]/` | `[0\|/3, 1\|/3, 2\|/3]` |
| Zip `z` | `([0,0,0], [1,1,1])z` | `[0,1,0,1,0,1]` |
| Spread add `*` | `[1,2,3] * [0*-1]` | `[3, 2, 1]` |
| Spread mul `^` | `[1, 2] ^ [2]` | `[2, 4]` |
| Tile add `.` | `[0,1,2] . [10,20]` | `[10, 21, 12]` |
| Tile add `.*` | `[0,1,2] .* [10,20]` | `[10, 21, 12]` |
| Tile mul `.^` | `[1,2] .^ [2]` | `[2, 4]` |
| Tile zip `.,` | `[0,1,2] ., [9,8,7]` | `[0,9,1,8,2,7]` |
| Rotate (fan) `~` | `[0,1,2,3] ~ [-1]` | `[3, 0, 1, 2]` |
| Rotate (cog) `.~` | `[0,1,2,3] .~ [1,2]` | `[1, 3, 0, 1]` |
| Steps (fan) `->` | `[0, 3] -> [2]` | `[0, 3, 1, 4, 2, 5]` |
| Steps (cog) `.->` | `[0, 3] .-> [2]` | `[0,1,2,3,4, 3,4,5]` |
| Mirror (fan) `m` | `[0, 2, 4] m [2]` | `[4, 2, 0]` |
| Mirror (cog) `.m` | `[0, 2, 4] .m [1]` | `[2, 0, -2]` |
| Lens (fan) `l` | `[0,1,2,3] l [2]` | `[0,1, 1,2, 2,3]` |
| Lens (cog) `.l` | `[0,1,2] .l [2]` | `[0,1, 1,2, 2,0]` |
| Jam (fan) `j` | `[0,1,2,3] j [0,7]` | `[0,0,0,0, 7,7,7,7]` |
| Jam (cog) `.j` | `[0,1,2,3] .j [0,7]` | `[0,7,0,7]` |
| Tie (postfix) `t` | `[0, 0\|/2, 0\|/2, 1] t` | `[0, 1]` |
| Tie (cog) `.t` | `[0\|/2, 0\|/2, 0\|/2, 1] .t [1]` | `[0, 1]` |
| Constraint (fan) `c` | `[0,1,2,3] c [1,0,1,0]` | `[0, 2]` |
| Glass (fan) `g` | `[0,1] g [2,3]` | `[0\|/3, 1\|/3, 2\|/2, 3\|/2]` |
| Glass (cog) `.g` | `[0,1] .g [2,3]` | `[0\|/3, 2\|/2, 1\|/3, 3\|/2]` |
| Reich (fan) `r` | `[0,1] r [2,3]` | `[0\|/4, 1\|/4, 2\|/4, 3\|/4]` |
| Reich (cog) `.r` | `[0,1] .r [2,3]` | `[0\|/2, 2, 1\|/4, 3\|/2]` |
| Pärt (fan) `p` | `[0,1,2,3] p [0,2,4]` | `[4, 0, 2, 2]` |
| Slice `start ... end` | `[0,1,2,3,4] -3 ... -1` | `[2, 3]` |



### All RNG-bearing syntax, with examples

- **Curly random range `{a -> b}`**: inclusive integer
```text
[{1 -> 6}]           // d6
[{-2 -> 2}]
```

- **Curly random choice `{a, b, c, ...}`**
```text
[{0, 2, 5}]
```

- **Seeded curly (deterministic per seed) `$hhhh`**
```text
[{1 -> 6}$c0de]
[{0,2,5}$beef]
```

- **Random endpoints in ranges**:
```text
[{0 -> 2} -> 4]
[1 -> {2, 4}]
[{0 -> 1} -> {3, 5}]
```

- **Random timeScale for numeric pip via pipe**
```text
[3 | * {2,4}]       // multiply duration by 2 or 4
[3 | / {2,4}]       // divide duration by 2 or 4
```

- **Random step from curly + timeScale via pipe**
```text
[{1,2} | 2]                 // fixed ts
[{1,2} | * {2,4}]           // random ts
[{1 -> 4}$cafe | / {2,4}$babe]  // both seeded
```

- **Random timeScale for special/tagged pips (e.g., rest `r`)**
```text
[r | * {2,4}]
[r | / {2,4}]
```

- **Range with random per-element divide timeScale**
```text
[1 -> 5 | / {2,4}]
```

- **Range with fixed multiply timeScale (non-random, shown for context)**
```text
[1 -> 4 | 2]
```

- **Bare curly as a value (random-step pip)**
```text
[{0,1,2}]          // picks a single step; timeScale 1
[{1 -> 6}]         // same; random in 1..6
```

- Note: You can combine these forms inside larger expressions (concat, fan/cog ops, etc.). RNG is used wherever a `Curly` or `Choice (||)` appears, and wherever a `RandNum` is accepted after a pipe.

- If you need determinism for a specific random choice or range, add `$hhhh` to that curly expression.

- In the current grammar, use curly syntax `{...}` for random choices, and reserve single `|` for timeScale piping.
