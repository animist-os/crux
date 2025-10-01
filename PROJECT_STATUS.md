# Crux Project Status

**Last Updated**: 2025-09-30
**Version**: 1.0.0
**Status**: ✅ Stable - All tests passing

## Quick Stats

- **Test Suite**: 95/95 passing (1 intentionally skipped)
- **Bundle Size**: 95.95 KB (CommonJS)
- **Source Files**: 9 modules
- **Total Lines**: ~3,350 (excluding tests/docs)
- **Operators**: 23 binary transforms + 3 unary
- **Documentation**: 4 comprehensive guides

## Project Structure

```
crux/
├── src/
│   ├── index.js              # Main interpreter (2,950 lines)
│   ├── grammar.js            # Ohm grammar (221 lines)
│   └── utils/
│       ├── provenance.js     # Pip tracking (59 lines)
│       ├── rng.js            # Random generation (109 lines)
│       ├── seed.js           # Seed utilities (28 lines)
│       └── helpers.js        # Helpers (21 lines)
├── test/
│   └── grammar.test.js       # 96 tests
├── dist/
│   ├── crux.cjs              # Bundle (95.95 KB)
│   └── README.md             # Distribution guide
├── docs/
│   ├── ARCHITECTURE.md       # System architecture
│   ├── BUILD_SUMMARY.md      # Build system guide
│   ├── REFACTORING_SUMMARY.md # Refactoring changelog
│   └── PROJECT_STATUS.md     # This file
├── build.js                  # Build script
├── package.json              # NPM config
└── crux_tutorial.md          # Language tutorial
```

## Recent Work Completed

### Bug Fixes
- ✅ Removed duplicate semantic actions
- ✅ Added missing operator handlers for glass/reich/paert
- ✅ Fixed BINARY_TRANSFORMS set
- ✅ Completed operator alias support
- ✅ **Added missing `.~` (dotRotate) operator**

### Refactoring
- ✅ Extracted grammar to separate module
- ✅ Extracted provenance tracking utilities
- ✅ Extracted RNG utilities
- ✅ Extracted seed utilities
- ✅ Extracted helper functions
- ✅ Created modular directory structure

### Build System
- ✅ Implemented build script for bundling
- ✅ Created distribution bundle (CommonJS)
- ✅ Added npm scripts (test, build, build:test)
- ✅ Verified bundle works in target environment

### Documentation
- ✅ ARCHITECTURE.md - Complete system overview
- ✅ BUILD_SUMMARY.md - Build system guide
- ✅ REFACTORING_SUMMARY.md - Change log
- ✅ PROJECT_STATUS.md - Current status
- ✅ Updated inline code comments

## Language Features

### Core Concepts
- **Pip**: Single note with step, timeScale, and tag
- **Mot**: Motif (collection of pips)
- **Operators**: Transform motifs (23 binary + 3 unary)
- **Random Values**: Seeded for reproducibility
- **Nested Mots**: Hierarchical subdivision
- **Provenance**: DAG tracking of pip relationships

### Operator Types

#### Fan Operators (expand across RHS)
- `*` Mul - multiply motifs
- `^` Expand - elementwise step multiplication
- `->` Steps - step sequence generation
- `j` Jam - value replacement
- `m` Mirror - mirror around anchor
- `l` Lens - sliding window
- `c` Constraint - filter by mask
- `~` Rotate - rotation
- `g` Glass - rhythmic interleaving
- `r` Reich - phasing patterns
- `p` Paert - tintinnabulation

#### Cog Operators (per-position pairing)
- `.*` Dot - pair with tiled RHS
- `.^` DotExpand - per-position expand
- `.->` DotSteps - per-position steps
- `.j` DotJam - per-position replacement
- `.m` DotMirror - per-position mirror
- `.l` DotLens - rolling window
- `.t` DotTie - conditional tie
- `.c` DotConstraint - per-position filter
- `.~` DotRotate - per-position rotation
- `.,` DotZip - interleave motifs
- `.g` DotGlass - per-position Glass
- `.r` DotReich - per-position Reich

#### Unary Operators
- `t` Tie - merge adjacent equal steps
- `:N` Repeat - multiply by zero-mot
- `_` Slice - extract subsequence

### Special Features
- **Operator Aliases**: Define custom operators
- **Random Seeds**: `@hhhh` syntax for reproducibility
- **Nested Subdivision**: `[[...]]` for hierarchical timing
- **Pipe Syntax**: `|` for timeScale specification
- **Curly Choice**: `{a,b,c}` for random selection
- **Range Syntax**: `a->b` for inclusive sequences

## API Reference

### Core Functions
```javascript
// Parse and evaluate
golden.parse(source)           // → AST
golden.crux_interp(source)     // → Mot

// Analysis
golden.computeMotDepthsFromRoot(source, options)
golden.computeHeightFromLeaves(source, options)
golden.findAllTimescaleIndices(source)
golden.findNumericValueIndicesAtDepth(source, depth, options)
golden.findNumericValueIndicesAtDepthOrAbove(source, minDepth, options)

// Utilities
golden.CruxRewriteCurlySeeds(input)  // Add @hhhh to unseeded curlies
golden.CruxDesugarRepeats(input)     // Rewrite :N to * [0,0,...]
golden.FindAncestorPips(pip)         // Get pip ancestry
```

## Build & Test Commands

```bash
npm test           # Run test suite
npm run build      # Build bundle
npm run build:test # Build and test
```

## Integration Example

```javascript
// In your environment (with ohm-js loaded)
global.golden = {};
require('./dist/crux.cjs');

// Use the API
const result = golden.crux_interp('[0,1,2] * [3]');
console.log(result.toString()); // [0, 3, 6]
```

## Known Limitations

1. **Global Object Pattern**: Uses `golden` global - not ideal for modern JS
2. **No Type Definitions**: TypeScript users lack autocomplete
3. **Monolithic Core**: AST classes still in single file
4. **No Plugin System**: Custom operators require core changes
5. **No Language Server**: Limited IDE integration

## Future Enhancements (Potential)

### Short Term
- [ ] Add TypeScript type definitions
- [ ] Create VSCode extension with syntax highlighting
- [ ] Add more test coverage for edge cases
- [ ] Performance profiling and optimization

### Medium Term
- [ ] Language server protocol (LSP) implementation
- [ ] Visual debugger for motif transformations
- [ ] Export to MIDI/MusicXML
- [ ] Interactive playground/REPL

### Long Term
- [ ] Plugin system for custom operators
- [ ] Compile to WebAssembly for performance
- [ ] Full AST refactoring with visitor pattern
- [ ] Streaming evaluation for real-time performance

## Dependencies

### Runtime
- `ohm-js` ^17.2.0 (peer dependency)

### Development
- Node.js v24.1.0+ (for built-in test runner)

## Browser Compatibility

The generated bundle (`dist/crux.cjs`) is CommonJS format. For browser usage:
- Use a bundler (webpack, rollup, esbuild) to convert to ES modules
- Or load ohm-js and crux.cjs via script tags with module shim

## Performance Characteristics

- **Parse Time**: O(n) for source length n
- **Evaluation**: Depends on operator chain depth
- **Memory**: Proportional to motif size and nesting depth
- **RNG**: Deterministic with negligible overhead

### Benchmarks (Rough Estimates)
- Simple expression: <1ms parse + eval
- Complex nested: <10ms parse + eval
- 100-pip motif: <5ms to evaluate
- Full test suite: ~600ms

## Version History

### 1.0.0 (Current)
- ✅ Complete operator coverage
- ✅ Modular architecture
- ✅ Build system
- ✅ Comprehensive documentation
- ✅ All tests passing

### Previous (Unversioned)
- Initial monolithic implementation
- Basic operator support
- Some bugs and missing features

## Contributing Guidelines

If extending this project:

1. **Run tests** before and after changes: `npm test`
2. **Update tests** for new features
3. **Rebuild bundle** after changes: `npm run build`
4. **Update docs** (especially ARCHITECTURE.md)
5. **Check bundle size** - keep under 100KB if possible
6. **Maintain test coverage** - all features should be tested

## Support & Contact

This is a personal project. For questions or issues:
- Review documentation in `/docs`
- Check test suite for usage examples
- Refer to `crux_tutorial.md` for language guide

## License

[License information not specified - add as needed]

---

**Status**: ✅ **Production Ready**
**Confidence**: High - all tests passing, comprehensive documentation
**Maintenance**: Active - recently refactored and documented
**Recommendation**: Ready for integration into larger systems
