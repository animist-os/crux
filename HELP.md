## Crux quick reference

### Operators (spread vs tile)
- Concatenation: `,` or juxtaposition — concatenate mots.
- Repeat: `N: Expr` — repeat a mot N times.
- Slice/segment: `{start,end}` `{start,}` `{,end}` `{start}` — slice/rotate section.
- Spread add: `*` — outer/cartesian combine; steps add, timeScales multiply (RHS ts < 0 reverses LHS for that r).
- Spread mul (expand): `^` — outer/cartesian with step multiply.
- Tile add: `.` or `.*` — elementwise add with RHS tiled.
- Tile mul: `.^` — elementwise multiply with RHS tiled.
- Rotate: `~` — for each k in RHS, rotate LHS by k and append.
- Steps (spread): `->` — for each k in RHS, emit LHS transposed by 0..k and concatenate.
- Steps (tile): `.->` — per-position run for each LHS value up to k (tiled).
- Neighbor (spread): `n` — each a becomes `[a, a+k, a]`, for each k in RHS; concat.
- Neighbor (tile): `.n` — interleave `[A] + [A+k] + [A]` with k tiled over A.
- Anticipatory neighbor (spread): `a` — each a becomes `[a+k, a]`; concat.

Notes
- Values: number (step), optional timescale with `*` or `/` (e.g., `1*2`, `1/4`), or a special tag (e.g., `r` rest).
- Range: `[x->y]` expands inclusively (integers).
- Choice: `[x | y | z]` chooses one option (seedable via mot seed).

### Simple examples

| Expression | Result |
|---|---|
| `[0, 1], [2]` | `[0, 1, 2]` |
| `3:[1]` | `[1, 1, 1]` |
| `[0, 1, 2] {1,}` | `[1, 2]` |
| `[1, 2, 3] * [0*-1]` | `[3, 2, 1]` |
| `[1, 2] ^ [2]` | `[2, 4]` |
| `[0, 1, 2] . [10, 20]` | `[10, 21, 12]` |
| `[1, 2] .^ [2]` | `[2, 4]` |
| `[0, 1, 2, 3] ~ [-1]` | `[3, 0, 1, 2]` |
| `[0, 3] -> [2]` | `[0, 3, 1, 4, 2, 5]` |
| `[0, 3] .-> [2]` | `[0, 1, 2, 3, 4, 3, 4, 5]` |
| `[0, 3] n [1]` | `[0, 1, 0, 3, 4, 3]` |
| `[0, 3] .n [1]` | `[0, 3, 1, 4, 0, 3]` |
| `[0] a [-1]` | `[-1, 0]` |

### Pedagogical examples

1) Spread vs tile mental model
```
[0, 1, 2] * [10, 20]  -> [10,11,12, 20,21,22]
[0, 1, 2] . [10, 20]  -> [10,21,12]
```

2) Columnar step expansion vs per-etym runs
```
// Spread: columns
[0, 3] -> [4] -> [0,3] + [1,4] + [2,5] + [3,6] + [4,7]
// Tile: per-etym
[0, 3] .-> [4] -> [0,1,2,3,4, 3,4,5,6,7]
```

3) Interleaving neighbor with tile
```
[0, 3] .n [1] -> [0, 3, 1, 4, 0, 3]
```

4) Combining steps and tile-mul
```
[0, 3] -> [4] .^ [1, -1] -> [0,1,2,3,4, 0,-1,-2,-3,-4]
```

5) Using rests and displacement-like tags (conceptual)
```
[a,b,c] . [:D0, x, 0] -> [a (rest), a,  b,  c]
// x omits a position, D inserts a rest span before continuing
```


