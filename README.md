# Crux

A tiny language for algorithmic music. Build phrases ("mots") from relative pitch/time events ("pips"), then transform and combine them with a small, composable operator set.

- Relative pitch (step) and duration (timeScale)
- Two mapping semantics for binary ops: **fan** (spread) and **cog** (tile)
- Concise sequencing: concatenation, postfix repeat and underscore slicing
- Musical transforms: steps, mirror, lens, tie, constraint, jam, rotate, Glass, Reich, Pärt

# Install

Right now, to install into golden:

```
npm run build:test
```

which can be invoked from the build button in Cursor.

This procudes dist/crux.cjs.   Copy the contents of this, starting at:

// === Grammar ===

and ending before the export at the bottom.

Change export const g    to     const g

And comment out:

const golden = {};
globalThis.golden = golden;


