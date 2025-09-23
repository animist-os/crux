## Crux quick reference

### Operators (spread vs tile)
- Concatenation: `,` or juxtaposition — concatenate mots.
- Repeat: `Expr : N` — repeat a mot N times, unpacks to a spread add followed by an identity mot of length N
- Slice: `start _ end`, `start _`, `_ end` — slice section.
- Spread add: `*` — outer/cartesian combine; steps add, timeScales multiply (RHS ts < 0 reverses LHS for that r).
- Spread mul (expand): `^` — outer/cartesian with step multiply.
- Tile add: `.` or `.*` — elementwise add with RHS tiled.
- Tile mul: `.^` — elementwise multiply with RHS tiled.
- Rotate: `~` — for each k in RHS, rotate LHS by k and append.
- Mirror: `m` (spread), `.m` (tile) — reflect steps around anchor k.
- Lens: `l` (spread), `.l` (tile) — sliding window emission.
- Tie: `t` (spread), `.t` (tile) — merge equal steps by adding timeScales; tile uses mask.
- Constraint: `c` (spread), `.c` (tile) — keep/omit via mask; timeScales multiply.
- Filter: `f` (spread), `.f` (tile) — reset components: `T` timeScale->1 (or set via `T/2`), `S` step->0.
- Steps (spread): `->` — for each k in RHS, emit LHS transposed by 0..k and concatenate.
- Steps (tile): `.->` — per-position run for each LHS value up to k (tiled).

- Neighbor (spread): `n` — each a becomes `[a, a+k, a]`, for each k in RHS; concat.
- Neighbor (tile): `.n` — interleave `[A] + [A+k] + [A]` with k tiled over A.
- Anticipatory neighbor (spread): `a` — each a becomes `[a+k, a]`; concat.

### Binary Mot Operators

| Operator | Example | Result |
|---|---|---|
| Concatenate `,` | `[0, 1], [2]` | `[0, 1, 2]` |
| Concatenate (juxtapose) | `[0, 1] [2, 3]` | `[0, 1, 2, 3]` |
| Repeat `Expr : N` | `[1] : 3` | `[1, 1, 1]` |
| Spread add `*` | `[1,2,3] * [0*-1]` | `[3, 2, 1]` |
| Spread mul `^` | `[1, 2] ^ [2]` | `[2, 4]` |
| Tile add `.` | `[0,1,2] . [10,20]` | `[10, 21, 12]` |
| Tile add `.*` | `[0,1,2] .* [10,20]` | `[10, 21, 12]` |
| Tile mul `.^` | `[1,2] .^ [2]` | `[2, 4]` |
| Rotate `~` | `[0,1,2,3] ~ [-1]` | `[3, 0, 1, 2]` |
| Steps (spread) `->` | `[0, 3] -> [2]` | `[0, 3, 1, 4, 2, 5]` |
| Steps (tile) `.->` | `[0, 3] .-> [2]` | `[0,1,2,3,4, 3,4,5]` |
| Neighbor (spread) `n` | `[0, 3] n [1]` | `[0,1,0, 3,4,3]` |
| Neighbor (tile) `.n` | `[0, 3] .n [1]` | `[0, 3, 1, 4, 0, 3]` |
| Anticipatory neighbor `a` | `[0] a [-1]` | `[-1, 0]` |
| Mirror (spread) `m` | `[0, 2, 4] m [2]` | `[4, 2, 0]` |
| Mirror (tile) `.m` | `[0, 2, 4] .m [1]` | `[2, 0, -2]` |
| Lens (spread) `l` | `[0,1,2,3] l [2]` | `[0,1, 1,2, 2,3]` |
| Lens (tile) `.l` | `[0,1,2] .l [2]` | `[0,1, 1,2, 2,0]` |
| Tie (spread) `t` | `[0, 0/2, 0/2, 1] t [0]` | `[0*2, 1]` |
| Tie (tile) `.t` | `[0/2, 0/2, 0/2, 1] .t [1]` | `[0*1.5, 1]` |
| Constraint (spread) `c` | `[0,1,2,3] c [1,0,1,0]` | `[0, 2]` |
| Filter (spread) `f` | `[0*2, 1/4, 2] f [T]` | `[0, 1, 2]` |
| Filter (tile) `.f` | `[0*2, 1/4, 2*3] .f [T, S]` | `[0, 0/4, 2*3]` |
| Filter time-target `f` | `[0, 1/3, 2*5] f [T/2]` | `[0/2, 1/2, 2/2]` |
| Slice `start _ end` | `[0,1,2,3,4] -3 _ -1` | `[2, 3]` |


Pips:

* Range: `[0->3] -> [0, 1, 2, 3]`
* Choice: `[0 || 1 || 2] -> one of [0] [1] [2]`
* Tags (character pips): `r` (rest), `x` (omit in tile), `D` (displace tag)


### All RNG-bearing syntax, with examples

- **Bare random pip `?`**: random integer step in [-7, 7]
```text
[?]
[0, ?, 2]
```

- **Curly random range `{a ? b}`**: inclusive integer
```text
[{1 ? 6}]           // d6
[{-2 ? 2}]
```

- **Curly random choice `{a, b, c, ...}`**
```text
[{0, 2, 5}]
```

- **Seeded curly (deterministic per seed) `@hhhh`**
```text
[{1 ? 6}@c0de]
[{0,2,5}@beef]
```

- **Choice expression `x || y || z`**: picks one option at eval time
```text
[0 || 1 || 2]
[[0->2] || 10]      // can mix ranges (expanded) and pips
```

- **Random endpoints in ranges**:
```text
[{0 ? 2} -> 4]
[1 -> {2, 4}]
[{0 ? 1} -> {3, 5}]
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
[{1 ? 4}@cafe | / {2,4}@babe]  // both seeded
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
[{1 ? 6}]          // same; random in 1..6
```

- **Bare `?` with timeScale**
```text
[? | 2]
[? | / {2,4}]
```

- **Seeding helper (rewrite any `{...}` lacking a seed)**
```js
// JS API:
// rewriteCurlySeeds("A = [{1,2}]")  -> "A = [{1,2}@1a2b]"
```

- Note: You can combine these forms inside larger expressions (concat, spread/tile ops, etc.). RNG is used wherever a `Curly`, `?`, or `Choice (||)` appears, and wherever a `RandNum` is accepted after a pipe.

- If you need determinism for a specific random choice or range, add `@hhhh` to that curly expression. Choices written with `||` use the program’s RNG (non-seeded per-choice).

- In tests/docs, some older examples show `|` for choices; in the current grammar, use `||` for choices, and reserve single `|` for timeScale piping.

- - -
- Added a concise catalog of every RNG syntax in the grammar with minimal examples, including seeded curly, choice `||`, random endpoints, and random timeScale after `|`.