## Crux quick reference

### Operators (spread vs tile)
- Concatenation: `,` or juxtaposition — concatenate mots.
- Repeat: `Expr : N` — repeat a mot N times.
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


Etyms:

* Range: `[0->3] -> [0, 1, 2, 3]`
* Choice: `[0 | 1 | 2] -> one of [0] [1] [2]`
* Tags (character etyms): `r` (rest), `x` (omit in tile), `D` (displace tag)

