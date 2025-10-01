# Crux

A tiny language for algorithmic music. Build phrases ("mots") from relative pitch/time events ("pips"), then transform and combine them with a small, composable operator set.

- Relative pitch (step) and duration (timeScale)
- Two mapping semantics for binary ops: **fan** (spread) and **cog** (tile)
- Concise sequencing: concatenation, postfix repeat and underscore slicing
- Musical transforms: steps, mirror, lens, tie, constraint, jam, rotate, Glass, Reich, Pärt

## Status

✅ **v1.0.0** - All tests passing (95/95), fully documented, production ready

## Install

```bash
npm install
npm test
```

## Quick Start

### Development (modular source)

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

### Production (bundled)

```js
// Assumes golden global object exists and ohm-js is loaded
global.golden = {};
require('./dist/crux.cjs');

const result = golden.crux_interp('[0,1,2] * [3]');
console.log(result.toString()); // [0, 3, 6]
```

## Build

```bash
npm run build      # Build bundle to dist/crux.cjs
npm run build:test # Build and run tests
```

## Core concepts

- Pip: step (integer/float), timeScale (defaults to 1). Example: `0`, `1/2`, `-3*4`.
- Mot: list of values: `[0, 1/2, -2]`.
- Tags (single letters) inside a mot:
  - `r`: rest, `x`: omit (tile ops/constraint), `D`: displace (insert rest time)
- Random: `?` ([-7,7]) and `a ? b` (inclusive integer range)

## Sequencing

- Concatenate: `[0, 1], [2]`
- Repeat (postfix): `[1] : 3  // [1, 1, 1]`
- Slice (postfix underscore):
  - `start _ end` (end exclusive), `start _`, `_ end`
  - `[0,1,2,3,4] -3 _ -1  // [2, 3]`

## Fan vs Cog Semantics

**Fan operators** apply RHS to entire LHS (output: `|LHS| × |RHS|`):
- `*`, `^`, `->`, `j`, `m`, `l`, `c`, `~`, `g`, `r`, `p`

**Cog operators** pair LHS with RHS per-position (output: `|LHS|`):
- `.*`, `.^`, `.->`, `.j`, `.m`, `.l`, `.t`, `.c`, `.~`, `.,`, `.g`, `.r`

Examples:
```text
[0,1,2] * [10,20]     → [10,11,12, 20,21,22]  # fan: all of LHS with each RHS
[0,1,2] .* [10,20]    → [10, 21, 12]          # cog: pair by position
[1,2] ^ [2]           → [2, 4]                # fan: elementwise multiply
[0,1,2,3] ~ [-1]      → [3, 0, 1, 2]          # fan: rotate all
[0,1,2,3] .~ [1,2]    → [1, 3]                # cog: rotate per-position
```

## Musical transforms

- Steps: `[0,3] -> [2]  // [0,3, 1,4, 2,5]`, `[0,3] .-> [2]  // [0,1,2, 3,4,5]`
- Neighbor/anticipation: `[0,3] n [1]`, `[0,3] .n [1]`, `[0] a [-1]`
- Mirror: `[0,2,4] m [2]`, `[0,2,4] .m [1]`
- Lens (windows): `[0,1,2,3] l [2]`, `[0,1,2] .l [2]`
- Tie: `[0,0/2,0/2,1] t  // [0*2, 1]`
- Jam: `[0,1,2,3] j [0,7]  // [0,0,0,0, 7,7,7,7]`, `[0,1,2,3] .j [0,7]  // [0,7,0,7]`
- Constraint: `[0,1,2,3] c [1,0,1,x]  // [0,2]`
// Filter removed; use jam with pipe-only entries to pass-through and override timeScale.

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



## Documentation

- **[crux_tutorial.md](crux_tutorial.md)** - Complete language tutorial
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture and design
- **[BUILD_SUMMARY.md](BUILD_SUMMARY.md)** - Build system guide
- **[REFACTORING_SUMMARY.md](REFACTORING_SUMMARY.md)** - Refactoring changelog
- **[PROJECT_STATUS.md](PROJECT_STATUS.md)** - Current project status

## Operators Reference

### Binary Transforms
| Operator | Fan | Cog | Description |
|----------|-----|-----|-------------|
| `*` / `.*` | Mul | Dot | Add steps, multiply timeScales |
| `^` / `.^` | Expand | DotExpand | Multiply steps |
| `->` / `.->` | Steps | DotSteps | Generate step sequences |
| `j` / `.j` | Jam | DotJam | Replace values |
| `m` / `.m` | Mirror | DotMirror | Mirror around anchor |
| `l` / `.l` | Lens | DotLens | Sliding/rolling window |
| `c` / `.c` | Constraint | DotConstraint | Filter by mask |
| `~` / `.~` | Rotate | DotRotate | Rotation |
| `g` / `.g` | Glass | DotGlass | Glass-style rhythms |
| `r` / `.r` | Reich | DotReich | Reich-style phasing |
| `p` | Paert | - | Pärt tintinnabulation |
| `.,` | - | DotZip | Interleave motifs |

### Unary Operators
- `t` - Tie (merge adjacent equal steps)
- `:N` - Repeat (multiply by N-length zero-mot)
- `_` - Slice (extract subsequence)

## Contributing

See [PROJECT_STATUS.md](PROJECT_STATUS.md) for guidelines.

## License

[Add license information]