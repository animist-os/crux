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
  }

  generateHTML() {
    const pips = this.finalMot.values.filter(v => v.step !== undefined);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Per-Note Derivation - Crux Visualization</title>
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
      <div class="dag-canvas" id="dag-canvas">
        <svg id="dag-svg" width="100%" height="500"></svg>
      </div>
    </div>
  </div>

  <script>
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

      // TODO: Implement actual DAG visualization
      // For now, show a placeholder
      dagCanvas.innerHTML = \`
        <div style="text-align: center; padding: 40px;">
          <h3 style="color: #667eea; margin-bottom: 20px;">Note \${index} Derivation</h3>
          <p style="color: #666; margin-bottom: 10px;">This note was derived from:</p>
          <div style="margin: 20px 0;">
            <div style="display: inline-block; background: #4CAF50; color: white; padding: 10px 20px; border-radius: 5px; margin: 5px;">
              Source Pip A
            </div>
            <div style="display: inline-block; color: #667eea; font-size: 20px; margin: 0 10px;">
              ×
            </div>
            <div style="display: inline-block; background: #4CAF50; color: white; padding: 10px 20px; border-radius: 5px; margin: 5px;">
              Source Pip B
            </div>
            <div style="display: inline-block; color: #667eea; font-size: 20px; margin: 0 10px;">
              =
            </div>
            <div style="display: inline-block; background: #667eea; color: white; padding: 10px 20px; border-radius: 5px; margin: 5px;">
              Final Note \${index}
            </div>
          </div>
          <p style="color: #999; font-size: 12px; margin-top: 20px;">
            (Full DAG visualization coming soon - provenance tracking needs enhancement)
          </p>
        </div>
      \`;
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
