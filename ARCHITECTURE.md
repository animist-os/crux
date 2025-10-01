# Crux Architecture

## Overview

Crux is a domain-specific language (DSL) for musical motif manipulation built on Ohm.js. This document describes the current architecture and module organization.

## Directory Structure

```
crux/
├── src/
│   ├── index.js           # Main entry point with all AST classes and interpreter
│   ├── grammar.js         # Ohm grammar definition (extracted)
│   ├── utils/
│   │   ├── provenance.js  # Pip/Mot relationship tracking (extracted)
│   │   ├── rng.js         # Seeded random number generation (extracted)
│   │   ├── seed.js        # Seed formatting utilities (extracted)
│   │   └── helpers.js     # General helper functions (extracted)
│   ├── core/              # Reserved for future extractions
│   └── ast/               # Reserved for future extractions
├── dist/
│   └── crux.cjs           # Bundled output for distribution
├── test/
│   └── grammar.test.js    # Test suite
├── build.js               # Build script
└── package.json
```

## Core Components

### 1. Grammar (`src/grammar.js`)
- Ohm.js grammar definition for the Crux DSL
- Defines syntax for motifs, operators, and expressions
- **Exports**: `g` (Ohm grammar object)

### 2. Provenance Tracking (`src/utils/provenance.js`)
- Tracks parent-child relationships between pips
- Maintains DAG of pip derivations for analysis tools
- **Exports**:
  - `_prov` - global provenance state
  - `_provAddEdge()` - adds pip parent relationship
  - `_provAddPipToMot()` - associates pip with mot
  - `FindAncestorPips()` - retrieves pip ancestry
  - `getCruxUUID()` - generates unique IDs

### 3. Random Number Generation (`src/utils/rng.js`)
- Seeded RNG using xorshift32 algorithm
- Deterministic random choices for reproducible results
- **Exports**:
  - `createSeededRng()` - creates RNG function from seed
  - `hashSeedTo32Bit()` - converts seed string to 32-bit integer
  - `warmUpRng()` - advances RNG state
  - `resolveRandNumToNumber()` - resolves random specs to numbers
  - `stringToSeed()` - converts string to numeric seed
  - `formatSeed4()` - formats seed as 4-char hex
  - `generateSeed4()` - generates random 4-char hex seed

### 4. Seed Utilities (`src/utils/seed.js`)
- Standalone seed formatting and generation
- **Exports**:
  - `stringToSeed()` - string to numeric seed conversion
  - `formatSeed4()` - 4-char hex formatting
  - `generateSeed4()` - random seed generation

### 5. Helper Utilities (`src/utils/helpers.js`)
- General utility functions
- **Exports**:
  - `stripLineComments()` - removes // comments preserving indices
  - `requireMot()` - validates Mot-like objects
  - `opKey()` - generates operator alias keys

### 6. Main Module (`src/index.js`)
Contains the core interpreter and all AST classes:

#### AST Node Classes
- `Prog` - top-level program
- `Assign` - variable assignment
- `OpAliasAssign` - operator alias definition
- `Ref` - variable reference
- `FollowedBy` - concatenation

#### Core Data Classes
- `Pip` - single note with step, timeScale, and tag
- `Mot` - motif (collection of pips)
- `NestedMot` - hierarchically subdivided motif
- `NestedMotExpr` - expression evaluated as nested motif

#### Binary Transform Operators
**Fan operators** (expand across RHS):
- `Mul` - multiply motifs
- `Expand` - elementwise step multiplication
- `Steps` - step sequence generation
- `JamOp` - value replacement
- `Mirror` - mirror around anchor
- `Lens` - sliding window
- `ConstraintOp` - filter by mask
- `RotateOp` - rotation
- `GlassOp` - Glass-style rhythmic interleaving
- `ReichOp` - Reich-style phasing
- `PaertOp` - Pärt tintinnabulation (quantize to triad)

**Cog operators** (per-position pairing):
- `Dot` - pair left with tiled right
- `DotExpand` - per-position expand
- `DotSteps` - per-position step sequence
- `DotJam` - per-position replacement
- `DotMirror` - per-position mirror
- `DotLens` - per-position rolling window
- `DotTie` - conditional tie with mask
- `DotConstraint` - per-position filter
- `DotRotate` - per-position rotation
- `DotZip` - interleave two motifs
- `DotGlass` - per-position Glass rhythms
- `DotReich` - per-position Reich phasing

#### Unary Operators
- `TieOp` - merge adjacent equal steps
- `SegmentTransform` - slice operator

#### Random Value Classes
- `Range` - inclusive numeric range
- `RandomRange` - random integer in range
- `RandomChoice` - random choice from list
- `RandomRefChoice` - random choice from mot references
- `RandomPip` - pip with random step
- `RandomPipChoiceFromPips` - choose from pip options
- `RangePipe` - deferred range with scaling

#### Special Classes
- `PadValue` - ellipsis pad marker
- `RepeatByCount` - multiply by random-length zero-mot
- `AliasCall` - custom operator invocation

#### Semantic Operations
- `parse` - AST construction from CST
- `collectRepeatSuffixRewrites` - find `:N` suffixes for desugaring
- `collectTs` - find all timescale positions in source

#### Analysis Functions
- `collectMotLeavesWithDepth()` - find leaf mots with transform depth
- `computeExprHeight()` - compute max transform height
- `computeMotDepthsFromRoot()` - convenience depth analysis
- `computeHeightFromLeaves()` - convenience height analysis
- `findAllTimescaleIndices()` - locate timescale literals
- `findNumericValueIndicesAtDepth()` - find pips at specific depth
- `findNumericValueIndicesAtDepthOrAbove()` - find pips at or above depth

#### Public API (exported via `golden`)
- `parse()` - parse source to AST
- `crux_interp()` - parse and evaluate source
- `CruxRewriteCurlySeeds()` - add @hhhh to unseeded curlies
- `CruxDesugarRepeats()` - rewrite `:N` to `* [0,0,...]`
- `FindAncestorPips()` - pip ancestry query
- All analysis functions listed above

## Build Process

The build process (`build.js`) bundles the modular source into a single CommonJS file:

1. Reads `src/index.js`
2. Removes ES6 `import` statements
3. Prepends ohm-js require statement
4. Outputs to `dist/crux.cjs`

The bundle is designed to be loaded in environments where `golden` is a pre-existing global object.

## Testing

Tests are in `test/grammar.test.js` using Node's built-in test runner:

```bash
npm test           # run tests
npm run build      # build bundle
npm run build:test # build and test
```

## Future Refactoring Considerations

The current architecture keeps most code in `src/index.js` to avoid circular dependency issues. Future refactoring could extract:

1. **AST classes** → `src/ast/` (operators, nodes, transforms)
2. **Core data types** → `src/core/` (Pip, Mot, Range classes)
3. **Semantic operations** → `src/semantics.js`
4. **Analysis functions** → `src/analysis.js`

However, this would require:
- Careful dependency injection to avoid circular imports
- Potentially refactoring the `golden` global object pattern
- Updating the build process to handle multiple entry points

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
| `p` | PaertOp | *(not implemented - no cog semantics)* |

## Design Patterns

### Evaluation Model
- Two-phase: parse → evaluate
- Environment (`Map`) stores variable bindings
- Motifs evaluated lazily during interpretation
- Random values resolved during evaluation using seeded RNG

### Provenance Tracking
- Optional DAG tracking (enabled by default)
- Each pip gets unique ID
- Tracks parent pips for operations
- Useful for music analysis and debugging

### Random Number Generation
- Deterministic by default (seeded)
- Seeds can be specified with `@hhhh` syntax
- Warmup phase for better randomness distribution
- Falls back to `Math.random` when no seed provided
