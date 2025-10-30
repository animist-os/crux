# Per-Note Derivation Visualization Demo

This demo shows how each musical note in a Crux composition derives from source pips through operators.

## Quick Start

### 1. Generate the Visualization

```bash
cd /home/user/crux
node examples/per-note-demo.js
```

This creates `examples/per-note-derivation.html`

### 2. Open in Browser

**On Linux:**
```bash
xdg-open examples/per-note-derivation.html
```

**Or manually:**
- Navigate to `/home/user/crux/examples/`
- Double-click `per-note-derivation.html`
- Or drag the file into your browser

### 3. What You Should See

✅ **Version number** displayed in the header (format: `v1.0.0-alpha-[timestamp]`)
✅ **Source code** at the top showing the Crux program
✅ **Piano roll** showing all notes as colored bars
✅ **Debug panel** at bottom showing "X notes loaded"

### 4. How to Use

1. **Click any note** in the piano roll
2. **See the derivation DAG** appear below showing:
   - 🟢 Green boxes = Source pips (from original motifs like A, B)
   - 🟠 Orange boxes = Operators (*, .*, ^, etc.)
   - 🔵 Blue boxes = Variable references
   - 🟣 Purple boxes = Final note

Arrows show how source pips combine through operators to create each final note.

## Example Output

```
Program:
// Source motifs
A = [0, 2, 4]
B = [1, 3]

// Each final note derives from combinations of A and B
result = A * B

result

Final composition has 6 notes

Derivation examples:
  Note 0 (step=1, time=1):
    operator (mul)
      ref → A
        source-pip [0|1]
      ref → B
        source-pip [1|1]
```

## Troubleshooting

### "Page is blank" or "Old version showing"

1. **Check version number** in the header
2. **Hard refresh** your browser:
   - Chrome/Firefox: `Ctrl+Shift+R` (Linux) or `Cmd+Shift+R` (Mac)
   - Or clear cache and reload

3. **Regenerate the HTML**:
   ```bash
   rm examples/per-note-derivation.html
   node examples/per-note-demo.js
   ```

### "Debug panel says NO DATA"

- The derivation data didn't load properly
- Check browser console (F12) for JavaScript errors
- Regenerate the HTML file

### "Graph doesn't appear when clicking notes"

1. Open browser console (F12)
2. Click a note
3. Look for console messages showing which note was clicked
4. Report any error messages

## Technical Details

This visualization uses:
- **AST-based analysis** (no core library modifications)
- **DerivationGraphBuilder** to trace each note back through the expression tree
- **SVG rendering** in the browser for the DAG
- **Piano roll layout** for note display

See `/home/user/crux/docs/VISUALIZATION.md` for complete documentation.
