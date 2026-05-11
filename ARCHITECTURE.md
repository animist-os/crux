# Crux Architecture

## Overview

Crux is a domain-specific language (DSL) for musical motif manipulation built on Ohm.js. This document describes the current source layout and module organization.

## Directory Structure

```
crux/
├── src/
│   ├── grammar.js         # Ohm grammar definition (~300 lines)
│   ├── index.js           # Interpreter, AST, public API (~4,000 lines)
│   ├── decompose.js       # Decomposition engine (~1,200 lines)
│   └── experiments.js     # Experimental / scratch code (not in default build)
├── dist/
│   └── crux.cjs           # Bundled CommonJS output
├── test/                  # node:test suite (10 files)
├── tools/                 # MIDI ↔ Crux conversion and corpus helpers
├── corpus/                # Curated MIDI sources + generators + YAML
├── scripts/               # Maintenance shell scripts
├── build.js               # Build script
└── package.json
```

## Current Architecture

The project uses a minimal modular structure with three source files participating in the build (`grammar.js`, `index.js`, `decompose.js`); `experiments.js` is intentionally left out of the bundle.

### 1. Grammar Module (`src/grammar.js`)

- Ohm.js grammar definition for the Crux DSL.
- Single export: `g` (Ohm grammar object).
- No dependencies on other Crux modules.

See `GRAMMAR.md` for the full rule reference.

### 2. Main Module (`src/index.js`)

The interpreter implementation.

#### AST / statement classes

- `Prog`, `FollowedBy` (comma concatenation)
- `EvalAssign` (`:=`), `MacroAssign` (`=`), `MacroBinding`, `OpAliasAssign`
- `Ref`, `GlobalPlaceholder`, `GlobalOpStmt`, `GlobalOpMarker`
- `AliasCall` (resolves aliased binary operators)

#### Core data classes

- `Pip` — single note (`step`, `timeScale`, `tag`, optional `diad` array of additional simultaneous steps)
- `Mot` — motif (collection of pips)
- `NestedMot`, `NestedMotExpr` — hierarchical grouping
- `AtIndexMot` — RHS payload for the `@` operator
- `PadValue`, `RepeatPip` — internal markers for `:` pad/repeat
- `Range`, `RandomRange`, `RandomChoice`, `RandomRefChoice`, `RandomMemberChoice`, `RandomPip`, `RandomPipChoiceFromPips`, `RangePipe` — range / random-value classes

#### Binary operator classes

Fan operators (expand across RHS):

- `Mul` (`*`), `Expand` (`^`), `Steps` (`->`)
- `JamOp` (`j`), `Mirror` (`m`), `Lens` (`l`), `ConstraintOp` (`c`)
- `RotateOp` (`~`), `GlassOp` (`g`), `ReichOp` (`r`), `PaertOp` (`p`), `FoldOp` (`f`)

Cog operators (per-position pairing, RHS cycles):

- `Dot` (`.` and `.*`), `DotExpand` (`.^`), `DotSteps` (`.->`)
- `DotJam` (`.j`), `DotMirror` (`.m`), `DotLens` (`.l`)
- `DotTie` (`.t`), `DotConstraint` (`.c`), `DotZip` (`.,`)
- `DotRotate` (`.~`), `DotGlass` (`.g`), `DotReich` (`.r`)

Other binary operators (own semantics, not fan/cog):

- `DisplaceOp` (`>`) — shift in time (delay with positive RHS, anticipation with negative)
- `MotTimeScaleOp` (`||`) — multiply every pip's timeScale
- `AtIndexOp` (`@`) — apply at specific indices
- `DiadOp` (`&`, pip-internal) — simultaneous pitches at one position

Parallel voices are not a binary operator — they live at the program level
via the `!N` section separator (see Section/Voice handling in `Prog.interp`).

#### Unary / postfix classes

- `TieOp` (`t`), `Subdivide` (`/`), `ZipColumns` (`z`)
- `RepeatByCount` (`: N`), `DropTransform` (`\ N`)

#### Utility functions (inline)

- Provenance tracking: `_provAddEdge`, `_provAddPipToMot`, `FindAncestorPips`, `golden.getCruxUUID`
- RNG: `createSeededRng`, `hashSeedTo32Bit`, `warmUpRng`, `resolveRandNumToNumber`
- Seed utilities: `stringToSeed`, `formatSeed4`, `generateSeed4`, `collectCurlySeedsFromAst`, `collectCurlySeedsFromSource`, `rewriteCurlySeeds`
- Arithmetic AST: `ArithAdd`, `ArithSub`, `ArithMul`, `ArithDiv`, `ArithNumber`, `MemberAccess`
- Helpers: `requireMot`, `opKey`, `instantiateOpNodeBySymbol`, `subdivide`, `derefMacro`, `wrapArithNode`

#### Semantic / public API (on `golden`)

- `golden.parse`, `golden.crux_interp`
- `golden.CruxRewriteCurlySeeds`, `golden.CruxDesugarRepeats`, `golden.CruxProgramInfo`
- `golden.collectMotLeavesWithDepth`, `golden.computeExprHeight`
- `golden.computeMotDepthsFromRoot`, `golden.computeHeightFromLeaves`
- `golden.findAllTimescaleIndices`, `golden.findNumericValueIndicesAtDepth`, `golden.findNumericValueIndicesAtDepthOrAbove`
- `golden.findPipAtPosition`, `golden.findAllPipsWithPositions`

### 3. Decomposition Module (`src/decompose.js`)

Decomposes a flat pip sequence into candidate Crux programs that reproduce it. See `DECOMPOSITION.md`.

- Decomposition AST: `DLiteral`, `DRange`, `DBinOp`, `DConcat`, `DRepeat`, `DRhythmMask`, `DAssign`, `DRef`, `DProgram`
- Discoverers: `discoverRanges`, `discoverRepeats`, `discoverProgressions`, `discoverKernels`, `discoverSteps`
- Public API: `golden.decompose`

### 4. Experimental Module (`src/experiments.js`)

Scratch / experimental code. Not included in the bundled output.

## Why This Structure?

### Design Decision: Minimal Extraction

- ✅ Grammar is in its own file — clean separation of syntax definition.
- ✅ Interpreter is one large file — avoids circular dependency issues between AST classes, semantic operations, and analysis functions.
- ✅ Decomposition is in its own file — depends on `index.js` only via the `golden` global and `golden.crux_interp`.
- ✅ Golden global pattern — all shared state (provenance, UUID, RNG, public API) hangs off `golden`.

### Why Not More Modules?

Further extraction has been deliberately avoided because:

1. **Tight coupling** — AST classes, semantic operations, and analysis functions are deeply interdependent.
2. **Golden global** — Provenance, RNG, UUID, and the public API all access `golden._prov`, `golden.getCruxUUID()`, etc.
3. **Circular dependencies** — Splitting `index.js` further would require dependency injection or significant refactoring.
4. **Working system** — Current structure keeps the entire test suite green.

## Build Process

`build.js` concatenates the three participating source files into a single CommonJS bundle:

1. Read `src/grammar.js`, `src/index.js`, `src/decompose.js`.
2. Strip ES6 `import` / `export` statements.
3. Prepend an `ohm-js` `require` shim.
4. Append CommonJS / global exports for `golden`.
5. Write `dist/crux.cjs`.

The bundle is designed to be loaded in environments where `golden` is a pre-existing global object.

## Testing

Tests use Node's built-in test runner.

```bash
npm test           # run tests
npm run build      # build bundle
npm run build:test # build and test
```

Test files in `test/`:

- `grammar.test.js` — DSL parsing and operator behavior (largest suite)
- `decompose.test.js` — decomposition engine
- `depth.test.js`, `program-info.test.js`, `interp-metadata.test.js` — analysis helpers
- `utils.test.js` — internal utilities
- `corpus.test.js`, `find-regime.test.js`, `midi-to-crux.test.js`, `roundtrip-midi.test.js` — corpus / MIDI pipeline

## Operator Classification

### Fan vs Cog Semantics

**Fan operators** apply the RHS to the entire LHS:
- For each RHS value, process all LHS values.
- Output length: `|LHS| × |RHS|`.
- Example: `[0,1,2] * [1,2]` → `[1,2,3,2,3,4]`.

**Cog operators** pair LHS and RHS positionally:
- Tile RHS to match LHS length, pair by index.
- Output length: `|LHS|`.
- Example: `[0,1,2] .* [1,2]` → `[1,3,3]`.

### Operator Symbols

| Symbol | Fan operator class | Cog operator class |
|--------|--------------------|--------------------|
| `*` / `.*` | `Mul` | `Dot` |
| `^` / `.^` | `Expand` | `DotExpand` |
| `->` / `.->` | `Steps` | `DotSteps` |
| `j` / `.j` | `JamOp` | `DotJam` |
| `m` / `.m` | `Mirror` | `DotMirror` |
| `l` / `.l` | `Lens` | `DotLens` |
| `t` (postfix) / `.t` | `TieOp` (unary) | `DotTie` |
| `c` / `.c` | `ConstraintOp` | `DotConstraint` |
| `~` / `.~` | `RotateOp` | `DotRotate` |
| `g` / `.g` | `GlassOp` | `DotGlass` |
| `r` / `.r` | `ReichOp` | `DotReich` |
| `.,` | — | `DotZip` |
| `p` | `PaertOp` | *(no cog version — semantically invalid)* |
| `f` | `FoldOp` | *(no cog version)* |

Other binary operators with their own semantics (not fan/cog):

| Symbol | Class | Role |
|--------|-------|------|
| `>` | `DisplaceOp` | Time displacement within one voice |
| `\|\|` | `MotTimeScaleOp` | Scale all pip durations |
| `@` | `AtIndexOp` | Apply at specific indices |
| `&` | `DiadOp` | Simultaneous pitches in one pip |
| `,` | `FollowedBy` | Concatenation |

Parallel voices use the section-level `!N` syntax rather than a binary
operator; each `!`-separated section becomes one voice in the arrangement.

`.~` is implemented and parsed but is **not** in the `OpSym` set, so it cannot currently be used in an operator alias (`name = .~` will fail).

## Design Patterns

### Evaluation Model

- Two-phase: parse → evaluate.
- Environment (`Map`) stores variable bindings.
- Motifs are evaluated lazily during interpretation.
- Random values are resolved during evaluation using seeded RNG.

### Provenance Tracking

- Optional DAG tracking (enabled by default via `golden._prov`).
- Each pip gets a unique ID from `golden.getCruxUUID()`.
- Tracks parent pips for operations.
- Useful for music analysis and debugging.

### Random Number Generation

- Deterministic by default (seeded xorshift32).
- Seeds can be specified with `$hhhh` syntax.
- Warmup phase for better randomness distribution.
- Falls back to `Math.random` when no seed is provided.

### Global State Pattern

- All code uses the `golden` global object.
- Provenance state: `golden._prov`.
- UUID counter: `golden._crux_uuid_cnt`.
- Public API: `golden.parse()`, `golden.crux_interp()`, etc.

## Future Refactoring Considerations

If the codebase grows significantly, potential extractions could include:

1. **AST classes** → `src/ast/` (operators, nodes, transforms)
2. **Core data types** → `src/core/` (Pip, Mot, Range classes)
3. **Semantic operations** → `src/semantics.js`
4. **Analysis functions** → `src/analysis.js`

These would require refactoring the `golden` global pattern, careful dependency injection to avoid circular imports, and possibly splitting the build process.

## Key Principles

1. **Simplicity over abstraction** — A few large files are easier to navigate than many small ones when classes are densely interdependent.
2. **Working code beats perfect structure.**
3. **Document trade-offs honestly** — Be explicit about the global-state pattern and why splitting hasn't happened.
4. **Pragmatic refactoring** — Only extract when it solves a real problem.
