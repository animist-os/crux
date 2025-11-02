# Crux → Strudel Integration Summary

## What Was Created

I've created an integration that allows you to use Crux grammar within Strudel's live coding environment. Here's what you have:

### Files

1. **`strudel-integration.js`** - Core conversion library
   - Converts Crux Mot/Pip structures to Strudel mini notation
   - Handles MIDI notes, durations, and rests
   - Can be imported as a module

2. **`strudel-example.js`** - Ready-to-use Strudel integration
   - Includes `register()` call to create `crux()` function
   - All conversion functions included inline
   - Copy-paste ready for Strudel environment

3. **`STRUDEL_INTEGRATION.md`** - Complete documentation
   - Setup instructions
   - Usage examples
   - Troubleshooting guide

4. **`test-strudel-conversion.js`** - Test script
   - Verifies conversion works correctly
   - Can be run locally: `node test-strudel-conversion.js`

## How It Works

The integration uses Strudel's `register()` function to create a custom hook:

```javascript
register({
  crux: (code, options) => {
    // 1. Parse and evaluate Crux code
    const result = golden.crux_interp(code);
    
    // 2. Convert to Strudel notation
    return cruxToStrudel(result, options);
  }
});
```

## Conversion Details

- **Steps**: Crux relative steps → MIDI note numbers (or note names)
- **Durations**: Crux timeScale → Strudel duration notation (`/2`, `/4`, `[1/3]`, etc.)
- **Rests**: Crux `r` tag → Strudel `~` rest notation
- **Root Note**: Configurable via options (default: MIDI 60 = C4)

## Usage

```javascript
// After loading the integration
crux("[0, 2, 4]").s("piano")
crux("[0, 3] -> [4]").s("sawtooth")
crux("[0, r, 2]", { rootNote: 48 }).s("piano")
```

## Next Steps

1. **Host the files** - Make `crux.cjs` and `strudel-example.js` available via HTTP
2. **Load in Strudel** - Import both files in nudel.cc
3. **Start coding** - Use `crux()` function in your Strudel patterns!

## Notes

- Currently uses the first section of multi-section Crux programs
- Each Pip's step is relative to the root note (not cumulative)
- Supports both MIDI note numbers and note names
- All common duration fractions are supported

See `STRUDEL_INTEGRATION.md` for complete documentation.

