# Crux

A tiny language for algorithmic music. Build phrases ("mots") from relative pitch/time events ("pips"), then transform and combine them with a small, composable operator set.

- Relative pitch (step) and duration (timeScale)
- Two mapping semantics for binary ops: spread and tile
- Concise sequencing: concatenation, postfix repeat and underscore slicing
- Musical transforms: steps, neighbor, mirror, lens, tie, constraint, filter, rotate


## Install

```bash
npm install
npm test
```

## Quick start

Evaluate a program in Node:

```js
import { parse } from './src/index.js';

const program = `
A = [0, 1]
A, [2]
`;

const prog = parse(program);
const result = prog.interp();
console.log(result.toString()); // [0, 1, 2]
```

## Core concepts

- Pip: step (integer/float), timeScale (defaults to 1). Example: `0`, `1/2`, `-3*4`.
- Mot: list of values: `[0, 1/2, -2]`.
- Tags (single letters) inside a mot:
  - `r`: rest, `x`: omit (tile ops/constraint), `D`: displace (insert rest time)
- Random: `?` ([-7,7]) and `a ? b` (inclusive integer range)

## Sequencing

- Concatenate: `[0, 1], [2]` or `[0, 1] [2]`
- Repeat (postfix): `[1] : 3  // [1, 1, 1]`
- Slice (postfix underscore):
  - `start _ end` (end exclusive), `start _`, `_ end`
  - `[0,1,2,3,4] -3 _ -1  // [2, 3]`

## Spread vs tile

- Spread family: `*`, `^`, `->`, `n`, `m`, `l`, `t`, `c`, `f`
- Tile family: `.`, `.^`, `.->`, `.n`, `.m`, `.l`, `.t`, `.c`, `.f`

Examples
```text
[0,1,2] * [10,20]     -> [10,11,12, 20,21,22]
[1,2] ^ [2]           -> [2, 4]
[0,1,2] . [10,20]     -> [10, 21, 12]
[0,1,2,3] ~ [-1]      -> [3, 0, 1, 2]
```

## Musical transforms

- Steps: `[0,3] -> [2]  // [0,3, 1,4, 2,5]`, `[0,3] .-> [2]  // [0,1,2, 3,4,5]`
- Neighbor/anticipation: `[0,3] n [1]`, `[0,3] .n [1]`, `[0] a [-1]`
- Mirror: `[0,2,4] m [2]`, `[0,2,4] .m [1]`
- Lens (windows): `[0,1,2,3] l [2]`, `[0,1,2] .l [2]`
- Tie: `[0,0/2,0/2,1] t  // [0*2, 1]`
- Constraint: `[0,1,2,3] c [1,0,1,x]  // [0,2]`
- Filter: `[0*2,1/4,2] f [T]  // reset durations`, `[0,1/3,2*5] f [T/2]`

## Tag behavior (tile ops)

- `x` on RHS: omit position; on LHS: pass-through left
- `D` on RHS: insert a rest (scaled), then the original left
- `r` on either side: produce a rest (time multiplied)
- Unknown tags: pass-through left

Displace in spread
```text
[0, 1] * [D/2]  -> [:r0/2,0, :r1/2,1]
```

## Examples

```text
// Concise phrase
([0,1,2,3] 1 _) : 2         -> [1,2,3, 1,2,3]

// Call and response
A = [0, 3]
A -> [4]
A .-> [4]

// Neighbor + transpose
A = [0, 1, 0]
B = A n [1]
B . [0, -12]
```



### WIP - Core

- Pip: step (integer/float) | timeScale (defaults to 1). Example: `0`, `-2`, `3 | 1/2`; `r` = rest
- Mot: list of values: `[0, 1/2, -2]`.

- Spread Add: `[0, 1, 2 | 3] * [3, -1] // [3, 4, 5 | 3, -1, 0, 1 | 3]`
- Tiled Add: `[0, 1, 2] .* [3, -1] // [3, 0, 5] `
- Concatenate: `[0, 1], [2]` or `[0, 1] [2]`
- Repeat (postfix): `[1] : 3  // [1, 1, 1]`