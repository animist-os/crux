# Crux Visualization System

A compelling and attractive visual representation system for Crux notes that shows how each note is derived from mots and pips through operators, making complex multiple inheritance easy to parse.

## Overview

The Crux visualization system provides multiple complementary views to help you understand how musical notes are composed and transformed:

1. **Timeline View** - Musical notation showing notes with color-coded temporal progression
2. **Dependency Graph** - Shows how variables and motifs relate to each other
3. **Provenance Tree** - Detailed derivation tree for individual pips
4. **Interactive Inspector** - Click any note to explore its full derivation path

## Architecture

### Provenance Tracking

Every `Pip` (individual note) now includes provenance information that tracks:

- **Origin**: How it was created (`literal`, `mul`, `dot`, `expand`, `steps`, etc.)
- **Parents**: The source pips that were combined to create it
- **Metadata**: Additional information (operator names, variable names, etc.)
- **Derivation Tree**: Full hierarchical tree showing all ancestors

```javascript
// Example: A pip created by multiplying two pips
const pip1 = new Pip(0, 1, null, null, new Provenance('literal', [], {}));
const pip2 = new Pip(2, 1, null, null, new Provenance('literal', [], {}));
const result = pip1.mul(pip2);
// result.provenance tracks that it came from mul(pip1, pip2)
```

### Visual Components

#### 1. Timeline Visualizer

Shows notes as a musical timeline with:
- **X-axis**: Time (measured in beats/timeScale)
- **Y-axis**: Pitch (step values)
- **Color**: Temporal progression (hue varies throughout the piece)
- **Width**: Duration (timeScale)
- **Height**: Visual emphasis

**Features:**
- Staff lines like musical notation
- Hover tooltips showing pip details
- Color gradients showing flow
- Rest and omitted note markers

#### 2. Dependency Graph Visualizer

Shows how variables derive from each other:
- **Nodes**: Variable assignments (A, B, C, etc.)
- **Edges**: Derivation relationships
- **Size**: Number of pips in each mot
- **Layout**: Hierarchical (dependencies flow downward)

**Features:**
- Interactive node highlighting
- Gradient fills for visual appeal
- Drop shadows for depth
- Clean hierarchical layout

#### 3. Provenance Tree Visualizer

Shows the detailed operator tree for a single pip:
- **Root**: The final pip
- **Branches**: Parent pips that were combined
- **Leaves**: Original literal values
- **Colors**: Different color per operator type

**Color Coding:**
- `literal`: Green (#4CAF50)
- `mul`: Blue (#2196F3)
- `dot`: Orange (#FF9800)
- `expand`: Purple (#9C27B0)
- `steps`: Red (#F44336)

#### 4. Interactive Visualizer

Combines all views into a single interactive HTML page with:
- Tabbed interface for switching views
- Click-to-inspect functionality
- Responsive design
- Beautiful gradient styling

## Usage

### Quick Start

```javascript
const { visualizeCruxProgram } = require('./src/visualize-crux.js');
const crux = require('./src/index.js');

const program = `
A = [0, 2, 4]
B = A * [0, 5]
B
`;

visualizeCruxProgram(
  program,
  crux,
  'output.html',
  'My Crux Visualization'
);
```

This generates a complete interactive HTML file showing all visualizations.

### API Reference

#### `visualizeCruxProgram(sourceCode, cruxRuntime, outputPath, title)`

Generate a complete interactive visualization.

**Parameters:**
- `sourceCode` (string): The Crux program to visualize
- `cruxRuntime` (object): The Crux runtime module
- `outputPath` (string): Where to write the HTML file
- `title` (string): Title for the visualization page

**Returns:**
```javascript
{
  htmlPath: string,      // Path to generated file
  environment: Map,      // Variable bindings
  finalMot: Mot,        // The evaluated result
  pipCount: number      // Number of pips in result
}
```

#### `generateTimelineSVG(mot, title)`

Generate just the timeline SVG.

**Parameters:**
- `mot` (Mot): The motif to visualize
- `title` (string): Title for the visualization

**Returns:** SVG string

#### `generateDependencyGraphSVG(environment, finalMot)`

Generate just the dependency graph SVG.

**Parameters:**
- `environment` (Map): Variable bindings from evaluation
- `finalMot` (Mot): The final evaluated motif

**Returns:** SVG string

#### `generateProvenanceTreeSVG(pip, index)`

Generate provenance tree for a specific pip.

**Parameters:**
- `pip` (Pip): The pip to analyze
- `index` (number): Index of the pip (for labeling)

**Returns:** SVG string

#### `visualizeComparison(programs, cruxRuntime, outputPath, title)`

Generate a side-by-side comparison of multiple programs.

**Parameters:**
- `programs` (array): Array of `{name, code}` objects
- `cruxRuntime` (object): The Crux runtime module
- `outputPath` (string): Where to write the HTML file
- `title` (string): Title for the comparison page

**Returns:**
```javascript
{
  htmlPath: string,
  programCount: number
}
```

### Running Demos

The `examples/visualization-demo.js` file contains comprehensive examples:

```bash
cd crux
node examples/visualization-demo.js
```

This generates 7 different visualization examples:

1. **Fan Multiplication** - Shows how `*` creates multiple versions
2. **Cog Operations** - Shows how `.*` tiles and pairs elements
3. **Multiple Inheritance** - Complex derivation with multiple operators
4. **Nested Structures** - Hierarchical composition and subdivision
5. **Operator Comparison** - Side-by-side comparison of different operators
6. **Musical Composition** - Practical Bach-inspired example
7. **Deep Derivation** - Multiple levels of transformation

Each demo generates an HTML file you can open in any browser.

## Design Philosophy

### Visual Clarity

The visualization system prioritizes **visual clarity** through:

1. **Color Coding**: Different colors for different operator types
2. **Hierarchical Layout**: Dependencies flow naturally top-to-bottom
3. **Whitespace**: Generous spacing prevents visual clutter
4. **Typography**: Clear labels and readable fonts
5. **Shadows**: Depth cues help distinguish layers

### Multiple Inheritance Representation

Crux's operators create complex multiple inheritance structures where a single note may derive from many source notes. The visualization handles this through:

1. **Provenance Trees**: Show the full derivation hierarchy
2. **Color Gradients**: Visual continuity across transformations
3. **Temporal Layout**: Timeline view shows sequential relationships
4. **Interactive Inspection**: Click any note to see its full lineage

### Attractive Design

The system uses modern web design principles:

- **Gradient backgrounds**: Purple/blue gradients (#667eea → #764ba2)
- **Smooth animations**: Hover effects and transitions
- **Drop shadows**: Depth and dimensionality
- **Rounded corners**: Friendly, modern appearance
- **Responsive layout**: Works on different screen sizes

## Technical Details

### Provenance Class

```javascript
class Provenance {
  constructor(origin, parents = [], metadata = {}) {
    this.id = generateProvenanceId();
    this.origin = origin;
    this.parents = parents;
    this.metadata = metadata;
    this.timestamp = Date.now();
  }

  getDerivationTree()    // Returns tree structure
  getAllAncestors()      // Returns flattened ancestors
  getDepth()            // Returns tree depth
}
```

### Pip Enhancement

The `Pip` class now includes:

```javascript
class Pip {
  constructor(step, timeScale, tag, sourcePos, provenance) {
    // ... existing fields ...
    this.provenance = provenance;  // New field
  }

  mul(that) {
    // Creates provenance record tracking the multiplication
    const provenance = this._createProvenance('mul', [this.provenance, that.provenance], {
      operation: 'add steps, multiply timeScales',
      leftStep: this.step,
      rightStep: that.step
    });
    return new Pip(/* ... */, provenance);
  }
}
```

### SVG Generation

All visualizations use SVG for:
- **Scalability**: Sharp at any size
- **Interactivity**: Easy to add hover effects, tooltips, click handlers
- **Styling**: CSS-based styling with classes
- **Embedding**: Can be easily embedded in HTML

## Examples

### Example 1: Simple Multiplication

```javascript
A = [0, 2, 4]
B = [0, 5]
C = A * B
```

**Visual representation:**
- Timeline shows 6 notes (3 × 2 from fan multiplication)
- First 3 notes are A transposed by B[0]
- Next 3 notes are A transposed by B[1]
- Color gradient flows across all 6 notes
- Inspector shows each note derives from specific A and B elements

### Example 2: Complex Derivation

```javascript
A = [0, 2, 4]
B = A * [0, 5]           # 6 notes
C = B .* [1, /2]         # 6 notes with varying durations
D = C * [0, 7]           # 12 notes (two versions)
```

**Visual representation:**
- Timeline shows 12 notes with varying widths (durations)
- Provenance trees show 3-4 levels of derivation
- Each final note traces back through D→C→B→A
- Color coding distinguishes operator types at each level

## Customization

### Custom Colors

Modify the color schemes in the visualizer classes:

```javascript
// In TimelineVisualizer.drawPip():
const hue = (index / totalTime) * 360;  // Full spectrum
const color = `hsl(${hue}, 70%, 60%)`;

// Or use custom palette:
const palette = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'];
const color = palette[index % palette.length];
```

### Custom Layouts

Extend the layout algorithms:

```javascript
class CustomDependencyGraph extends DependencyGraphVisualizer {
  computeLayout(nodes, edges) {
    // Your custom layout algorithm
    return customLayout;
  }
}
```

### Export Formats

While the system primarily generates HTML/SVG, you can export to other formats:

```javascript
// Save SVG to file
const svg = generateTimelineSVG(mot);
fs.writeFileSync('timeline.svg', svg);

// Convert to PNG using a library like sharp or puppeteer
const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.setContent(html);
await page.screenshot({ path: 'visualization.png' });
```

## Future Enhancements

Potential additions to the visualization system:

1. **Animation**: Animate the evaluation process step-by-step
2. **Audio Playback**: Hear the music while seeing the visualization
3. **3D Visualization**: Use WebGL for 3D derivation trees
4. **Live Editing**: Edit code and see visualization update in real-time
5. **Export to DAW**: Generate MIDI or MusicXML for use in DAWs
6. **Collaborative Mode**: Multiple users exploring the same visualization
7. **VR/AR Support**: Immersive visualization in virtual reality

## Troubleshooting

### Provenance Not Showing

If provenance data is missing:

```javascript
// Ensure Provenance is loaded globally
global.Provenance = require('./visualization.js').Provenance;

// Re-evaluate your program
const result = crux.golden.crux(sourceCode);
```

### Large Programs

For programs with hundreds of pips:

1. Use filtering to show only relevant parts
2. Increase SVG dimensions for better clarity
3. Use pagination or virtual scrolling
4. Consider using canvas instead of SVG for performance

### Browser Compatibility

The visualizations use modern web features:
- SVG 2.0
- CSS Grid
- CSS Gradients
- ES6 JavaScript

Tested on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

To extend the visualization system:

1. Add new visualizer classes in `src/visualization.js`
2. Implement the `generateSVG()` or `generateHTML()` method
3. Add helper methods for layout, styling, etc.
4. Create demo examples in `examples/visualization-demo.js`
5. Update this documentation

## License

Same as Crux core - see main LICENSE file.

## Credits

Designed and implemented for the Crux musical composition language.

Visual design inspired by:
- Modern data visualization libraries (D3.js, Vega)
- Musical notation software (MuseScore, Finale)
- Graph visualization tools (Graphviz, Gephi)
