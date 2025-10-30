/**
 * Per-Note Derivation Visualization
 *
 * Shows how each individual note is derived from source pips through operators.
 * This is the TRUE "multiple inheritance" visualization showing the DAG for each note.
 */

/**
 * Enhanced provenance that tracks the full derivation path
 */
class EnhancedProvenance {
  constructor(pip, operation, parents = [], sourceVariable = null) {
    this.pip = pip; // The pip this provenance describes
    this.operation = operation; // 'literal', 'mul', 'dot', 'expand', etc.
    this.parents = parents; // Array of parent provenances
    this.sourceVariable = sourceVariable; // Which variable this came from (e.g., 'A', 'B')
    this.id = generateProvenanceId();
  }

  /**
   * Get all leaf pips (source literals)
   */
  getLeafPips() {
    if (this.operation === 'literal' || this.parents.length === 0) {
      return [{
        pip: this.pip,
        source: this.sourceVariable,
        id: this.id
      }];
    }

    const leaves = [];
    for (const parent of this.parents) {
      if (parent) {
        leaves.push(...parent.getLeafPips());
      }
    }
    return leaves;
  }

  /**
   * Convert to DAG structure for visualization
   */
  toDAG() {
    const nodes = [];
    const edges = [];
    const visited = new Set();

    const traverse = (prov) => {
      if (!prov || visited.has(prov.id)) return;
      visited.add(prov.id);

      // Add this node
      nodes.push({
        id: prov.id,
        type: prov.operation === 'literal' ? 'source' : 'operator',
        operation: prov.operation,
        pip: prov.pip,
        sourceVariable: prov.sourceVariable,
        label: prov.operation === 'literal'
          ? `${prov.pip.step}|${prov.pip.timeScale}`
          : prov.operation
      });

      // Add edges to parents
      for (const parent of prov.parents) {
        if (parent) {
          edges.push({
            from: parent.id,
            to: prov.id
          });
          traverse(parent);
        }
      }
    };

    traverse(this);
    return { nodes, edges };
  }
}

/**
 * Piano Roll + Derivation DAG Visualizer
 */
class PerNoteDerivationVisualizer {
  constructor(finalMot, sourceCode = "") {
    this.finalMot = finalMot;
    this.sourceCode = sourceCode;
    this.width = 1400;
    this.height = 900;
    this.derivationData = null; // Set via setDerivationData()
  }

  setDerivationData(graphData) {
    this.derivationData = graphData;
  }

  generateHTML() {
    const pips = this.finalMot.values.filter(v => v.step !== undefined);

    // Version number for debugging
    const VERSION = 'v1.0.0-alpha-' + Date.now();

    // Serialize derivation data to JSON for embedding
    const derivationJSON = this.derivationData ? JSON.stringify(this.derivationData.pipDerivations) : 'null';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Per-Note Derivation - Crux Visualization ${VERSION}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 1600px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    h1 {
      font-size: 32px;
      margin-bottom: 10px;
    }
    .subtitle {
      font-size: 14px;
      opacity: 0.9;
    }

    /* Piano Roll Section */
    .piano-roll-section {
      padding: 30px;
      background: #f9f9f9;
      border-bottom: 3px solid #667eea;
    }
    .piano-roll-title {
      font-size: 18px;
      font-weight: bold;
      color: #667eea;
      margin-bottom: 15px;
      text-align: center;
    }
    .piano-roll {
      display: flex;
      gap: 5px;
      overflow-x: auto;
      padding: 20px;
      background: white;
      border-radius: 8px;
      min-height: 150px;
      align-items: flex-end;
    }
    .note-bar {
      min-width: 40px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 4px 4px 0 0;
      cursor: pointer;
      transition: all 0.2s;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      padding: 5px;
    }
    .note-bar:hover {
      transform: translateY(-5px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.5);
    }
    .note-bar.selected {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      transform: translateY(-5px);
      box-shadow: 0 6px 20px rgba(245, 87, 108, 0.6);
    }
    .note-label {
      color: white;
      font-size: 11px;
      font-weight: bold;
      text-align: center;
      writing-mode: vertical-rl;
      text-orientation: mixed;
    }
    .note-step {
      font-size: 14px;
      color: white;
      text-align: center;
      margin-top: 5px;
    }

    /* Derivation DAG Section */
    .derivation-section {
      padding: 30px;
      min-height: 500px;
    }
    .derivation-title {
      font-size: 18px;
      font-weight: bold;
      color: #667eea;
      margin-bottom: 20px;
      text-align: center;
    }
    .dag-canvas {
      width: 100%;
      min-height: 500px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      background: #fafafa;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #999;
      font-size: 16px;
    }

    /* Info panel */
    .info-panel {
      background: #f0f0f0;
      padding: 15px;
      margin: 20px 0;
      border-radius: 8px;
      border-left: 4px solid #667eea;
    }
    .info-panel h3 {
      color: #667eea;
      margin-bottom: 8px;
      font-size: 14px;
    }
    .info-panel p {
      color: #666;
      font-size: 13px;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Per-Note Derivation Visualization</h1>
      <p class="subtitle">Click any note to see how it was derived from source pips</p>
      <p style="font-size: 11px; opacity: 0.7; margin-top: 10px;">Version: ${VERSION}</p>
    </header>

    <div class="info-panel" style="margin: 20px 30px;">
      <h3>How to Use</h3>
      <p>
        • The <strong>piano roll</strong> shows all final notes in your composition<br>
        • <strong>Click any note</strong> to see its full derivation DAG below<br>
        • The DAG shows which source pips were combined by which operators to create that note<br>
        • Multiple inheritance is visible when a note derives from multiple sources
      </p>
    </div>

    <div class="piano-roll-section">
      <div class="piano-roll-title">Final Notes (Click to Select)</div>
      <div class="piano-roll" id="piano-roll">
        ${this.generatePianoRoll(pips)}
      </div>
    </div>

    <div class="derivation-section">
      <div class="derivation-title" id="dag-title">Select a note above to see its derivation</div>
      <div id="debug-info" style="background: #fff3cd; padding: 10px; margin: 10px 0; border-radius: 5px; font-family: monospace; font-size: 12px;"></div>
      <div class="dag-canvas" id="dag-canvas">
        <svg id="dag-svg" width="100%" height="500"></svg>
      </div>
    </div>
  </div>

  <script>
    // Embedded derivation data
    const DERIVATION_DATA = ${derivationJSON};

    console.log('VERSION: ${VERSION}');
    console.log('Derivation data loaded:', DERIVATION_DATA ? DERIVATION_DATA.length + ' notes' : 'null');
    if (DERIVATION_DATA && DERIVATION_DATA.length > 0) {
      console.log('First note derivation:', DERIVATION_DATA[0]);
    }

    // Show debug info on page
    const debugPanel = document.getElementById('debug-info');
    if (debugPanel) {
      debugPanel.innerHTML =
        'Debug: Derivation data: ' + (DERIVATION_DATA ? DERIVATION_DATA.length + ' notes loaded' : 'NO DATA') +
        ' | Version: ${VERSION}';
    }

    let selectedNote = null;

    function selectNote(index) {
      // Remove previous selection
      document.querySelectorAll('.note-bar').forEach(bar => {
        bar.classList.remove('selected');
      });

      // Select new note
      const noteBar = document.getElementById('note-' + index);
      if (noteBar) {
        noteBar.classList.add('selected');
        selectedNote = index;
        showDerivationDAG(index);
      }
    }

    function showDerivationDAG(index) {
      const dagTitle = document.getElementById('dag-title');
      dagTitle.textContent = 'Derivation DAG for Note ' + index;

      const dagCanvas = document.getElementById('dag-canvas');

      if (!DERIVATION_DATA || !DERIVATION_DATA[index]) {
        dagCanvas.innerHTML = '<div style="padding: 40px; text-align: center; color: #999;">No derivation data available</div>';
        return;
      }

      const derivation = DERIVATION_DATA[index].derivation;
      const pip = DERIVATION_DATA[index].pip;

      // Render the DAG
      const svg = renderDAG(derivation, pip, index);
      dagCanvas.innerHTML = svg;
    }

    function renderDAG(node, finalPip, noteIndex) {
      if (!node) return '<p>No derivation</p>';

      // Layout parameters
      const nodeWidth = 120;
      const nodeHeight = 50;
      const levelHeight = 100;
      const nodeGap = 20;

      // Compute layout (simple tree layout)
      const layout = computeTreeLayout(node, nodeWidth, nodeHeight, levelHeight, nodeGap);

      // Find bounds
      let minX = Infinity, maxX = -Infinity, maxY = -Infinity;
      layout.nodes.forEach(n => {
        minX = Math.min(minX, n.x);
        maxX = Math.max(maxX, n.x + nodeWidth);
        maxY = Math.max(maxY, n.y + nodeHeight);
      });

      const padding = 40;
      const width = (maxX - minX) + padding * 2;
      const height = maxY + padding * 2;

      // Render SVG
      let svg = \`<svg width="\${width}" height="\${height}" xmlns="http://www.w3.org/2000/svg">\`;

      // Render edges first
      svg += '<g class="edges">';
      layout.edges.forEach(edge => {
        const fromNode = layout.nodes.find(n => n.id === edge.from);
        const toNode = layout.nodes.find(n => n.id === edge.to);
        if (fromNode && toNode) {
          const x1 = fromNode.x - minX + padding + nodeWidth/2;
          const y1 = fromNode.y + padding + nodeHeight;
          const x2 = toNode.x - minX + padding + nodeWidth/2;
          const y2 = toNode.y + padding;
          svg += \`<line x1="\${x1}" y1="\${y1}" x2="\${x2}" y2="\${y2}"
                       stroke="#999" stroke-width="2" marker-end="url(#arrowhead)"/>\`;
        }
      });
      svg += '</g>';

      // Arrow marker
      svg += \`
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
            <polygon points="0 0, 10 3, 0 6" fill="#999" />
          </marker>
        </defs>
      \`;

      // Render nodes
      svg += '<g class="nodes">';
      layout.nodes.forEach(n => {
        const x = n.x - minX + padding;
        const y = n.y + padding;

        let fillColor = '#e0e0e0';
        let label = '';

        if (n.type === 'source-pip') {
          fillColor = '#4CAF50';
          label = \`[\${n.data.step}|\${n.data.timeScale}]\`;
        } else if (n.type === 'operator') {
          fillColor = '#FF9800';
          label = n.data.operation || n.data.symbol || '?';
        } else if (n.type === 'ref') {
          fillColor = '#2196F3';
          label = n.data.varName;
        }

        svg += \`
          <rect x="\${x}" y="\${y}" width="\${nodeWidth}" height="\${nodeHeight}"
                fill="\${fillColor}" stroke="#333" stroke-width="2" rx="5"/>
          <text x="\${x + nodeWidth/2}" y="\${y + nodeHeight/2 + 5}"
                text-anchor="middle" fill="white" font-weight="bold" font-size="14">\${label}</text>
        \`;
      });
      svg += '</g>';

      // Add final note at top
      svg += \`
        <rect x="\${(width - nodeWidth)/2}" y="10" width="\${nodeWidth}" height="\${nodeHeight}"
              fill="#667eea" stroke="#333" stroke-width="3" rx="5"/>
        <text x="\${width/2}" y="45" text-anchor="middle" fill="white" font-weight="bold" font-size="16">
          Note \${noteIndex}: \${finalPip.step}|\${finalPip.timeScale}
        </text>
      \`;

      svg += '</svg>';
      return svg;
    }

    function computeTreeLayout(node, nodeWidth, nodeHeight, levelHeight, nodeGap) {
      const nodes = [];
      const edges = [];
      const positions = new Map();

      // Assign levels (depth-first)
      function assignLevels(n, level = 0) {
        if (!n || positions.has(n.id)) return;
        positions.set(n.id, { level, node: n });
        if (n.children) {
          n.children.forEach(child => assignLevels(child, level + 1));
        }
      }
      assignLevels(node);

      // Group by level
      const levels = new Map();
      for (const [id, {level, node}] of positions.entries()) {
        if (!levels.has(level)) levels.set(level, []);
        levels.get(level).push({ id, node });
      }

      // Compute positions
      let currentX = 0;
      for (const [level, levelNodes] of Array.from(levels.entries()).sort((a,b) => b[0] - a[0])) {
        const y = level * levelHeight + 60;
        let x = currentX;

        levelNodes.forEach(({id, node: n}) => {
          nodes.push({
            id: id,
            type: n.type,
            data: n.data,
            x: x,
            y: y
          });

          // Add edges to children
          if (n.children) {
            n.children.forEach(child => {
              edges.push({ from: id, to: child.id });
            });
          }

          x += nodeWidth + nodeGap;
        });

        currentX = 0;
      }

      return { nodes, edges };
    }

    // Auto-select first note
    if (document.querySelector('.note-bar')) {
      selectNote(0);
    }
  </script>
</body>
</html>`;
  }

  generatePianoRoll(pips) {
    if (pips.length === 0) return '<p style="color: #999;">No notes to display</p>';

    // Calculate heights based on steps
    const minStep = Math.min(...pips.map(p => p.step));
    const maxStep = Math.max(...pips.map(p => p.step));
    const stepRange = maxStep - minStep + 1;

    return pips.map((pip, index) => {
      // Height based on pitch (step value)
      const normalizedStep = (pip.step - minStep) / (stepRange || 1);
      const height = 20 + normalizedStep * 80; // 20px to 100px

      // Width based on duration (timeScale)
      const width = Math.max(40, pip.timeScale * 30);

      return `
        <div class="note-bar"
             id="note-${index}"
             style="height: ${height}px; width: ${width}px;"
             onclick="selectNote(${index})"
             title="Note ${index}: step=${pip.step}, time=${pip.timeScale}">
          <span class="note-step">${pip.step}</span>
        </div>
      `;
    }).join('');
  }
}

// Export
export { EnhancedProvenance, PerNoteDerivationVisualizer };
