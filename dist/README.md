# Crux Distribution Bundle

This directory contains the bundled, distributable version of Crux.

## Files

- **`crux.cjs`** - Complete Crux implementation (CommonJS format)
  - Size: ~95 KB
  - Requires: `ohm-js` as a peer dependency

## Usage

###  Node.js (CommonJS)

```javascript
// Requires ohm-js to be installed
const golden = require('./dist/crux.cjs');

const result = golden.crux_interp('[0,1,2] * [3]');
console.log(result.toString()); // [3, 4, 5]
```

### Your Environment (Runtime Loading)

Since you load code at runtime, simply:

1. Ensure `ohm-js` is available in your environment
2. Load/execute `crux.cjs`
3. The `golden` object will have all Crux functions attached

## Available Functions

The `golden` object includes:

- `golden.parse(source)` - Parse Crux source code
- `golden.crux_interp(source)` - Parse and evaluate Crux code
- `golden.FindAncestorPips(pip)` - Get provenance ancestors
- `golden.collectMotLeavesWithDepth(root, env, opts)` - Depth analysis
- `golden.computeExprHeight(root, env, opts)` - Height analysis
- `golden.findAllTimescaleIndices(source)` - Find timescale positions
- `golden.findNumericValueIndicesAtDepth(source, depth, opts)` - Find numeric values
- `golden.CruxRewriteCurlySeeds(source)` - Add seeds to curly randoms
- `golden.CruxDesugarRepeats(source)` - Desugar `:N` syntax

## Building

To rebuild the bundle:

```bash
npm run build
```

The build script (`build.js`) reads `src/index.js` and creates `dist/crux.cjs`.

## Dependencies

- **ohm-js** (^17.2.1) - Required at runtime, loaded via `require('ohm-js')`

## Notes

- The bundle is **CommonJS** format (`.cjs` extension) to ensure compatibility
- All Crux functionality is included in this single file
- Provenance tracking, RNG utilities, and analysis functions are all bundled
- The modular source files (`src/grammar.js`, `src/utils/*`) are combined during build
