# Crux

A tiny language for algorithmic music. Build phrases ("mots") from relative pitch/time events ("pips"), then transform and combine them with a small, composable operator set.

- Relative pitch (step) and duration (timeScale)
- Two mapping semantics for binary ops: **fan** (spread) and **cog** (tile)
- Concise sequencing: concatenation, postfix repeat and underscore slicing
- Musical transforms: steps, mirror, lens, tie, constraint, jam, rotate, Glass, Reich, Pärt
- **NEW:** Visual representation system showing note derivation and multiple inheritance

# Install

Inside disrupterbox:

git clone https://github.com/animist-os/crux.git

# Visualization

Crux now includes a powerful visualization system that shows how notes are derived from mots through operators, making complex multiple inheritance structures easy to understand.

## Quick Start

```bash
# Generate a quick visualization example
node examples/quick-viz-example.js

# Or run comprehensive demos
node examples/visualization-demo.js
```

Then open the generated HTML files in your browser to see interactive visualizations.

## Features

- **Timeline View**: Musical notation with color-coded temporal progression
- **Dependency Graph**: Shows how variables and motifs relate
- **Provenance Trees**: Detailed derivation trees for individual pips
- **Interactive Inspector**: Click any note to explore its derivation path
- **Multiple Views**: Compare different programs side-by-side

## Example

```javascript
const { visualizeCruxProgram } = require('./src/visualize-crux.js');
const crux = require('./src/index.js');

const program = `
  melody = [0, 2, 4, 5, 7]
  harmonized = melody * [0, 2, 4]
  harmonized
`;

visualizeCruxProgram(program, crux, 'output.html', 'My Visualization');
```

See [docs/VISUALIZATION.md](docs/VISUALIZATION.md) for complete documentation.

