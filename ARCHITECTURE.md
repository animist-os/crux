# Crux Architecture

## Overview

Crux is a domain-specific language (DSL) for musical motif manipulation built on Ohm.js. This document describes the current architecture and module organization.

## Directory Structure

```
crux/
├── src/
│   ├── index.js           # Main implementation (2,757 lines)
│   └── grammar.js         # Ohm grammar definition (222 lines)
├── dist/
│   └── crux.cjs           # Bundled output (96KB)
├── test/
│   ├── grammar.test.js    # Main test suite (96 tests)
│   └── depth.test.js      # Depth analysis tests
├── build.js               # Build script
├── package.json           # NPM configuration
└── docs/                  # Documentation
```

## Current Architecture

The project uses a **minimal modular structure** with only two source files:

### 1. Grammar Module (`src/grammar.js` - 222 lines)
- Ohm.js grammar definition for the Crux DSL
- Defines complete syntax for motifs, operators, and expressions
- **Single export**: `g` (Ohm grammar object)
- **Independent** - no dependencies on other modules

### 2. Main Module (`src/index.js` - 2,757 lines)
Contains the complete interpreter implementation:

#### AST Node Classes
- `Prog`, `Assign`, `OpAliasAssign`, `Ref`, `FollowedBy`

#### Core Data Classes
- `Pip` - single note (step, timeScale, tag)
- `Mot` - motif (collection of pips)
- `NestedMot` - hierarchically subdivided motif
- `NestedMotExpr` - expression evaluated as nested motif
- `PadValue` - ellipsis pad marker

#### Binary Transform Operators (23 total)

**Fan operators** (expand across RHS):
- `Mul`, `Expand`, `Steps`, `JamOp`, `Mirror`, `Lens`
- `ConstraintOp`, `RotateOp`, `GlassOp`, `ReichOp`, `PaertOp`

**Cog operators** (per-position pairing):
- `Dot`, `DotExpand`, `DotSteps`, `DotJam`, `DotMirror`, `DotLens`
- `DotTie`, `DotConstraint`, `DotRotate`, `DotZip`, `DotGlass`, `DotReich`

#### Unary Operators
- `TieOp`, `SegmentTransform`, `RepeatByCount`

#### Random Value Classes
- `Range`, `RandomRange`, `RandomChoice`, `RandomRefChoice`
- `RandomPip`, `RandomPipChoiceFromPips`, `RangePipe`

#### Utility Functions (inline)
- **Provenance tracking**: `_provAddEdge()`, `_provAddPipToMot()`, `FindAncestorPips()`, `getCruxUUID()`
- **RNG**: `createSeededRng()`, `hashSeedTo32Bit()`, `warmUpRng()`, `resolveRandNumToNumber()`
- **Seed utilities**: `stringToSeed()`, `formatSeed4()`, `generateSeed4()`
- **Helpers**:  `requireMot()`, `opKey()`, `instantiateOpNodeBySymbol()`

#### Semantic Operations
- `parse` - AST construction from CST
- `collectRepeatSuffixRewrites` - find `:N` suffixes for desugaring
- `collectTs` - find all timescale positions in source

#### Analysis Functions
- `collectMotLeavesWithDepth()`, `computeExprHeight()`
- `computeMotDepthsFromRoot()`, `computeHeightFromLeaves()`
- `findAllTimescaleIndices()`, `findNumericValueIndicesAtDepth()`

#### Public API (via `golden` global)
All functions above are exposed through the `golden` object for external use.

## Why This Structure?

### Design Decision: Minimal Extraction

The project uses a **deliberately minimal** modular structure:

✅ **Only grammar is extracted** - Clear separation of syntax definition
✅ **All implementation in one file** - Avoids circular dependency issues
✅ **No intermediate abstractions** - Simpler build process
✅ **Golden global pattern** - All code accesses shared state directly

### Why Not More Modules?

Further extraction was **intentionally avoided** because:

1. **Tight coupling** - AST classes, semantic operations, and analysis functions are deeply interdependent
2. **Golden global** - Provenance, RNG, and UUID functions all access `golden._prov`, `golden.getCruxUUID()`, etc.
3. **Circular dependencies** - Would require complex dependency injection or major refactoring
4. **Working system** - Current structure has 100% test coverage and works reliably

### Benefits of Current Approach

- ✅ **Simple** - Two files, minimal imports
- ✅ **Maintainable** - Everything in one place when debugging
- ✅ **Performant** - No module loading overhead
- ✅ **Tested** - All 95 tests passing
- ✅ **Documented** - Clear architecture, no hidden complexity

## Build Process

The build process (`build.js`) bundles the modular source into a single CommonJS file:

1. Read `src/grammar.js`
2. Read `src/index.js`
3. Remove ES6 import/export statements
4. Prepend ohm-js require statement
5. Concatenate: grammar + implementation
6. Output to `dist/crux.cjs` (96KB)

The bundle is designed to be loaded in environments where `golden` is a pre-existing global object.

## Testing

Tests use Node's built-in test runner:

```bash
npm test           # run tests
npm run build      # build bundle
npm run build:test # build and test
```

**Test Coverage**: 95/95 passing (1 intentionally skipped)

## Operator Classification

### Fan vs Cog Semantics

**Fan operators** apply the RHS to the entire LHS:
- For each RHS value, process all LHS values
- Output length: `|LHS| × |RHS|`
- Example: `[0,1,2] * [1,2]` → `[1,2,3,2,4,6]`

**Cog operators** pair LHS and RHS positionally:
- Tile RHS to match LHS length, pair by index
- Output length: `|LHS|`
- Example: `[0,1,2] .* [1,2]` → `[0,2,2]`

### Operator Symbols

| Symbol | Fan Operator | Cog Operator |
|--------|-------------|--------------|
| `*` / `.*` | Mul | Dot |
| `^` / `.^` | Expand | DotExpand |
| `->` / `.->` | Steps | DotSteps |
| `j` / `.j` | JamOp | DotJam |
| `m` / `.m` | Mirror | DotMirror |
| `l` / `.l` | Lens | DotLens |
| `t` / `.t` | TieOp (unary) | DotTie |
| `c` / `.c` | ConstraintOp | DotConstraint |
| `~` / `.~` | RotateOp | DotRotate |
| `.,` | - | DotZip |
| `g` / `.g` | GlassOp | DotGlass |
| `r` / `.r` | ReichOp | DotReich |
| `p` | PaertOp | *(no cog version - semantically invalid)* |

## Design Patterns

### Evaluation Model
- Two-phase: parse → evaluate
- Environment (`Map`) stores variable bindings
- Motifs evaluated lazily during interpretation
- Random values resolved during evaluation using seeded RNG

### Provenance Tracking
- Optional DAG tracking (enabled by default via `golden._prov`)
- Each pip gets unique ID from `golden.getCruxUUID()`
- Tracks parent pips for operations
- Useful for music analysis and debugging

### Random Number Generation
- Deterministic by default (seeded xorshift32)
- Seeds can be specified with `$hhhh` syntax
- Warmup phase for better randomness distribution
- Falls back to `Math.random` when no seed provided

### Global State Pattern
- All code uses `golden` global object
- Provenance state: `golden._prov`
- UUID counter: `golden._crux_uuid_cnt`
- Public API: `golden.parse()`, `golden.crux_interp()`, etc.

## Future Refactoring Considerations

If the codebase grows significantly, potential extractions could include:

1. **AST classes** → `src/ast/` (operators, nodes, transforms)
2. **Core data types** → `src/core/` (Pip, Mot, Range classes)
3. **Semantic operations** → `src/semantics.js`
4. **Analysis functions** → `src/analysis.js`

However, this would require:
- ❌ Refactoring the `golden` global object pattern
- ❌ Careful dependency injection to avoid circular imports
- ❌ Potentially splitting the build process
- ❌ More complex module resolution

**Current recommendation**: Keep the minimal two-file structure unless the project grows beyond 5,000 lines or requires plugin extensibility.

## Key Principles

1. **Simplicity over abstraction** - Two files are easier to navigate than 20
2. **Working code beats perfect structure** - 100% test coverage matters more than module purity
3. **Document trade-offs** - Be honest about architectural compromises
4. **Pragmatic refactoring** - Only extract when it solves a real problem
