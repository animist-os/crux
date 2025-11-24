# Crux Integration for Strudel

This directory contains integration code to use Crux grammar within Strudel's live coding environment (nudel.cc).

## Files

- `strudel-integration.js` - Core conversion functions (library)
- `strudel-example.js` - Ready-to-use script with register() call

## Setup Instructions

### Option 1: Using in nudel.cc (Browser)

1. **Load Crux library first** - You'll need to make `crux.cjs` available. Options:
   - Host it on a server/CDN
   - Use a GitHub raw URL (if file is in repo)
   - Copy the content into Strudel's environment

2. **Load the integration script** in Strudel:
   ```javascript
   // First, load Crux (adjust URL to your crux.cjs location)
   await import("https://your-server.com/crux.cjs")
   
   // Then load the integration
   await import("https://your-server.com/strudel-example.js")
   ```

3. **Use it**:
   ```javascript
   crux("[0, 3] -> [4]").s("piano")
   crux("[0, 2, 4] * [0, 1]").s("sawtooth")
   ```

### Option 2: Manual Registration

If you prefer to copy-paste code directly into Strudel:

1. Load Crux library (ensure `golden` is available globally)

2. Copy the code from `strudel-example.js` into Strudel's code editor

3. Use the `crux()` function in your patterns

## Usage Examples

### Basic Usage

```javascript
// Simple pattern
crux("[0, 2, 4]").s("piano")

// With steps operator (generates [0, 3, 1, 4, 2, 5, 3, 6, 4, 7])
crux("[0, 3] -> [4]").s("sawtooth")

// With custom root note (default is MIDI 60 = C4)
crux("[0, 2, 4]", { rootNote: 48 }).s("piano")  // C3 as root

// Using note names instead of MIDI
crux("[0, 2, 4]", { outputFormat: 'note' }).s("piano")
```

### Advanced Patterns

```javascript
// Multiple sections (uses first section by default)
crux("[0, 2, 4] ! [5, 7, 9]").s("piano")

// With rests
crux("[0, r, 2, r]").s("piano")

// Complex transformations
crux("[0, 1, 2] * [0, 1]").s("sawtooth")
crux("[0, 2, 4] g [0, 1]").s("piano")  // Glass operator
```

## Options

The `crux()` function accepts an options object as the second parameter:

- `rootNote` (number, default: 60) - MIDI note number for step 0 (60 = C4)
- `outputFormat` (string, default: 'midi') - 'midi' or 'note'
- `octave` (number, default: 4) - Starting octave for note names (only used when outputFormat is 'note')

## How It Works

1. **Crux Evaluation**: The Crux code is parsed and evaluated using `golden.crux_interp()`
2. **Conversion**: The resulting Mot (collection of Pips) is converted to Strudel mini notation:
   - Each Pip's `step` (relative semitone) is converted to a MIDI note or note name
   - Each Pip's `timeScale` (duration) is converted to Strudel duration notation
   - Rests (tagged with 'r') are converted to Strudel's `~` rest notation
3. **Pattern Creation**: The converted string is returned as a Strudel pattern

## Notes

- Crux uses **relative steps** (semitone intervals from root)
- Crux uses **relative durations** (timeScale where 1 = whole note)
- The integration currently uses the **first section** of multi-section Crux programs
- Rests are supported via Crux's `r` tag
- Fractional steps are quantized to the nearest semitone, rounding .5 down

## Troubleshooting

**Error: "Crux library not loaded"**
- Make sure `crux.cjs` is loaded before the integration script
- Ensure `golden` is available in the global scope

**Patterns not working**
- Check that the Crux syntax is valid
- Verify that `register()` is available (should be in Strudel environment)
- Check browser console for detailed error messages

## Future Enhancements

Possible improvements:
- Support for multiple sections (return patterns array)
- Custom duration scaling
- Pattern stacking/chaining
- Direct Strudel Pattern object creation (instead of string conversion)

