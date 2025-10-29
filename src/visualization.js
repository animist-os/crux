/**
 * Visual representation system for Crux notes, showing derivation from mots and pips
 *
 * This module provides multiple complementary views:
 * 1. Provenance Tree - Shows the operator hierarchy for each Pip
 * 2. Dependency Graph - Shows how variables derive from each other
 * 3. Timeline View - Musical notation with color-coded inheritance
 * 4. Interactive Inspector - Click any note to see its full derivation path
 */

// ============================================================================
// PROVENANCE TRACKING
// ============================================================================

/**
 * Provenance record for tracking how a Pip was created
 */
class Provenance {
  constructor(origin, parents = [], metadata = {}) {
    this.id = generateProvenanceId();
    this.origin = origin; // 'literal', 'mul', 'dot', 'expand', etc.
    this.parents = parents; // Array of parent Provenance objects
    this.metadata = metadata; // Additional info (operator name, variable name, etc.)
    this.timestamp = Date.now();
  }

  /**
   * Get the full derivation path as a tree
   */
  getDerivationTree() {
    return {
      id: this.id,
      origin: this.origin,
      metadata: this.metadata,
      parents: this.parents.map(p => p ? p.getDerivationTree() : null).filter(Boolean)
    };
  }

  /**
   * Get all ancestor provenances (flattened)
   */
  getAllAncestors() {
    const ancestors = new Set();
    const queue = [this];
    while (queue.length > 0) {
      const current = queue.shift();
      if (current && !ancestors.has(current.id)) {
        ancestors.add(current.id);
        queue.push(...current.parents.filter(Boolean));
      }
    }
    return Array.from(ancestors);
  }

  /**
   * Get depth of derivation tree
   */
  getDepth() {
    if (this.parents.length === 0) return 0;
    return 1 + Math.max(...this.parents.map(p => p ? p.getDepth() : 0));
  }
}

let _provenanceIdCounter = 1;
function generateProvenanceId() {
  return `prov_${_provenanceIdCounter++}`;
}

// ============================================================================
// VISUALIZATION GENERATORS
// ============================================================================

/**
 * Generate a dependency graph showing how variables relate
 */
class DependencyGraphVisualizer {
  constructor(environment, finalMot) {
    this.environment = environment;
    this.finalMot = finalMot;
    this.width = 1200;
    this.height = 800;
  }

  /**
   * Generate SVG representation
   */
  generateSVG() {
    const nodes = this.extractNodes();
    const edges = this.extractEdges(nodes);
    const layout = this.computeLayout(nodes, edges);

    let svg = `<svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">`;
    svg += '<defs>' + this.generateGradients() + '</defs>';
    svg += '<style>' + this.getStyles() + '</style>';

    // Draw edges first (behind nodes)
    svg += '<g class="edges">';
    for (const edge of edges) {
      svg += this.drawEdge(edge, layout);
    }
    svg += '</g>';

    // Draw nodes
    svg += '<g class="nodes">';
    for (const node of nodes) {
      svg += this.drawNode(node, layout);
    }
    svg += '</g>';

    svg += '</svg>';
    return svg;
  }

  extractNodes() {
    const nodes = [];
    const env = this.environment;

    // Extract all variable assignments
    if (env && env.bindings) {
      for (const [name, value] of env.bindings.entries()) {
        nodes.push({
          id: name,
          type: 'variable',
          name: name,
          value: value,
          pipCount: value && value.values ? value.values.length : 0
        });
      }
    } else if (env && env.size > 0) {
      // Handle plain Map
      for (const [name, value] of env.entries()) {
        nodes.push({
          id: name,
          type: 'variable',
          name: name,
          value: value,
          pipCount: value && value.values ? value.values.length : 0
        });
      }
    }

    return nodes;
  }

  extractEdges(nodes) {
    // TODO: Parse AST to determine which variables reference which others
    // For now, return empty array
    return [];
  }

  computeLayout(nodes, edges) {
    // Simple hierarchical layout
    const layout = {};
    const levels = this.assignLevels(nodes, edges);

    Object.keys(levels).forEach((level, levelIdx) => {
      const nodesInLevel = levels[level];
      const y = 100 + levelIdx * 150;
      const spacing = this.width / (nodesInLevel.length + 1);

      nodesInLevel.forEach((node, idx) => {
        layout[node.id] = {
          x: spacing * (idx + 1),
          y: y
        };
      });
    });

    return layout;
  }

  assignLevels(nodes, edges) {
    // Assign nodes to levels (0 = no dependencies, 1 = depends on level 0, etc.)
    const levels = { 0: nodes.map(n => n) };
    return levels;
  }

  drawNode(node, layout) {
    const pos = layout[node.id] || { x: 100, y: 100 };
    const r = 40;

    let svg = `<g class="node" data-node-id="${node.id}">`;
    svg += `<circle cx="${pos.x}" cy="${pos.y}" r="${r}" class="node-circle variable-node"/>`;
    svg += `<text x="${pos.x}" y="${pos.y}" class="node-label" text-anchor="middle" dominant-baseline="middle">${node.name}</text>`;
    svg += `<text x="${pos.x}" y="${pos.y + r + 15}" class="node-info" text-anchor="middle">${node.pipCount} pips</text>`;
    svg += '</g>';

    return svg;
  }

  drawEdge(edge, layout) {
    const from = layout[edge.from];
    const to = layout[edge.to];
    if (!from || !to) return '';

    return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" class="edge" marker-end="url(#arrowhead)"/>`;
  }

  generateGradients() {
    return `
      <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
        <polygon points="0 0, 10 3, 0 6" fill="#888" />
      </marker>
    `;
  }

  getStyles() {
    return `
      .node-circle {
        fill: #667eea;
        stroke: #764ba2;
        stroke-width: 3;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        transition: all 0.3s;
      }
      .node-circle:hover {
        fill: #764ba2;
        r: 45;
      }
      .node-label {
        fill: white;
        font-size: 16px;
        font-weight: bold;
        pointer-events: none;
      }
      .node-info {
        fill: #333;
        font-size: 12px;
        pointer-events: none;
      }
      .edge {
        stroke: #888;
        stroke-width: 2;
        fill: none;
      }
      .variable-node {
        fill: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      }
    `;
  }
}

/**
 * Generate a timeline view showing pips as notes on a musical staff
 */
class TimelineVisualizer {
  constructor(mot, title = "Timeline View") {
    this.mot = mot;
    this.title = title;
    this.width = 1400;
    this.height = 600;
    this.margin = { top: 60, right: 40, bottom: 60, left: 60 };
  }

  generateSVG() {
    const pips = this.mot.values.filter(v => v.step !== undefined);
    if (pips.length === 0) {
      return '<svg width="400" height="100"><text x="10" y="50">No pips to display</text></svg>';
    }

    // Calculate dimensions
    const totalTime = pips.reduce((sum, p) => sum + Math.abs(p.timeScale || 1), 0);
    const minStep = Math.min(...pips.map(p => p.step));
    const maxStep = Math.max(...pips.map(p => p.step));
    const stepRange = maxStep - minStep + 4; // Add padding

    let svg = `<svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">`;
    svg += '<style>' + this.getStyles() + '</style>';

    // Title
    svg += `<text x="${this.width/2}" y="30" class="title" text-anchor="middle">${this.title}</text>`;

    // Draw staff lines (like musical notation)
    svg += '<g class="staff">';
    for (let i = 0; i < 5; i++) {
      const y = this.margin.top + (this.height - this.margin.top - this.margin.bottom) * i / 4;
      svg += `<line x1="${this.margin.left}" y1="${y}" x2="${this.width - this.margin.right}" y2="${y}" class="staff-line"/>`;
    }
    svg += '</g>';

    // Draw pips
    svg += '<g class="pips">';
    let currentTime = 0;
    pips.forEach((pip, idx) => {
      svg += this.drawPip(pip, idx, currentTime, totalTime, minStep, stepRange);
      currentTime += Math.abs(pip.timeScale || 1);
    });
    svg += '</g>';

    // Draw time axis
    svg += this.drawTimeAxis(totalTime);

    // Draw pitch axis
    svg += this.drawPitchAxis(minStep, maxStep);

    svg += '</svg>';
    return svg;
  }

  drawPip(pip, index, currentTime, totalTime, minStep, stepRange) {
    const plotWidth = this.width - this.margin.left - this.margin.right;
    const plotHeight = this.height - this.margin.top - this.margin.bottom;

    // Calculate position
    const x = this.margin.left + (currentTime / totalTime) * plotWidth;
    const width = (Math.abs(pip.timeScale || 1) / totalTime) * plotWidth;

    // Invert y-axis so higher pitches are higher on screen
    const normalizedStep = (pip.step - minStep) / stepRange;
    const y = this.margin.top + plotHeight * (1 - normalizedStep);

    // Color based on index (shows temporal progression)
    const hue = (index / totalTime) * 360;
    const color = `hsl(${hue}, 70%, 60%)`;

    let svg = `<g class="pip" data-pip-index="${index}">`;

    // Rest vs. note
    if (pip.tag === 'r') {
      // Draw rest symbol
      svg += `<rect x="${x}" y="${y-10}" width="${width}" height="20" class="rest" fill="${color}" opacity="0.3"/>`;
      svg += `<text x="${x + width/2}" y="${y}" class="rest-label" text-anchor="middle">R</text>`;
    } else if (pip.tag === 'x') {
      // Omitted note
      svg += `<rect x="${x}" y="${y-10}" width="${width}" height="20" class="omitted" fill="none" stroke="${color}" stroke-dasharray="2,2"/>`;
    } else {
      // Normal note - draw as rounded rectangle
      svg += `<rect x="${x}" y="${y-15}" width="${Math.max(width, 3)}" height="30" rx="4" class="note" fill="${color}"/>`;

      // Add stem for longer notes
      if (width > 20) {
        svg += `<line x1="${x + width/2}" y1="${y-15}" x2="${x + width/2}" y2="${y-45}" class="stem" stroke="${color}"/>`;
      }

      // Show step number
      svg += `<text x="${x + width/2}" y="${y+5}" class="step-label" text-anchor="middle">${pip.step}</text>`;
    }

    // Tooltip on hover
    svg += `<title>Pip ${index}: step=${pip.step}, time=${pip.timeScale}, tag=${pip.tag || 'none'}</title>`;

    svg += '</g>';
    return svg;
  }

  drawTimeAxis(totalTime) {
    const y = this.height - this.margin.bottom + 30;
    let svg = `<line x1="${this.margin.left}" y1="${y}" x2="${this.width - this.margin.right}" y2="${y}" class="axis"/>`;
    svg += `<text x="${this.width/2}" y="${y + 25}" class="axis-label" text-anchor="middle">Time (beats)</text>`;

    // Add tick marks
    const ticks = 10;
    for (let i = 0; i <= ticks; i++) {
      const x = this.margin.left + (i / ticks) * (this.width - this.margin.left - this.margin.right);
      const timeValue = (i / ticks * totalTime).toFixed(1);
      svg += `<line x1="${x}" y1="${y-3}" x2="${x}" y2="${y+3}" class="tick"/>`;
      svg += `<text x="${x}" y="${y+15}" class="tick-label" text-anchor="middle">${timeValue}</text>`;
    }

    return svg;
  }

  drawPitchAxis(minStep, maxStep) {
    const x = this.margin.left - 10;
    const plotHeight = this.height - this.margin.top - this.margin.bottom;

    let svg = '';
    // Add pitch labels
    for (let step = minStep; step <= maxStep; step++) {
      const normalizedStep = (step - minStep) / (maxStep - minStep + 4);
      const y = this.margin.top + plotHeight * (1 - normalizedStep);
      svg += `<text x="${x}" y="${y}" class="pitch-label" text-anchor="end">${step}</text>`;
    }

    return svg;
  }

  getStyles() {
    return `
      .title {
        font-size: 24px;
        font-weight: bold;
        fill: #333;
      }
      .staff-line {
        stroke: #ddd;
        stroke-width: 1;
      }
      .note {
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
        transition: all 0.2s;
      }
      .note:hover {
        filter: drop-shadow(0 4px 8px rgba(0,0,0,0.4));
        transform: scale(1.05);
      }
      .rest {
        stroke: #999;
      }
      .rest-label {
        fill: #666;
        font-size: 10px;
        font-style: italic;
      }
      .omitted {
        stroke-width: 2;
      }
      .stem {
        stroke-width: 2;
      }
      .step-label {
        fill: white;
        font-size: 11px;
        font-weight: bold;
        pointer-events: none;
      }
      .axis {
        stroke: #333;
        stroke-width: 2;
      }
      .axis-label {
        fill: #333;
        font-size: 14px;
        font-weight: bold;
      }
      .tick {
        stroke: #333;
        stroke-width: 1;
      }
      .tick-label, .pitch-label {
        fill: #666;
        font-size: 11px;
      }
    `;
  }
}

/**
 * Generate a detailed provenance tree for a specific pip
 */
class ProvenanceTreeVisualizer {
  constructor(pip, index) {
    this.pip = pip;
    this.index = index;
    this.width = 800;
    this.height = 600;
    this.nodeRadius = 30;
  }

  generateSVG() {
    if (!this.pip.provenance) {
      return `<svg width="400" height="100"><text x="10" y="50">No provenance data for pip ${this.index}</text></svg>`;
    }

    const tree = this.pip.provenance.getDerivationTree();
    const layout = this.computeTreeLayout(tree);

    let svg = `<svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">`;
    svg += '<style>' + this.getStyles() + '</style>';

    // Title
    svg += `<text x="${this.width/2}" y="30" class="tree-title" text-anchor="middle">Derivation Tree for Pip ${this.index}</text>`;

    // Draw tree
    svg += '<g class="tree">';
    svg += this.drawTree(tree, layout);
    svg += '</g>';

    svg += '</svg>';
    return svg;
  }

  computeTreeLayout(tree) {
    // Simple tree layout algorithm
    const layout = {};
    const depth = tree.parents.length > 0 ? Math.max(...tree.parents.map(p => this.computeDepth(p))) + 1 : 0;

    const levelHeight = 80;

    const assignPositions = (node, level, positionInLevel, totalAtLevel) => {
      const x = this.width * (positionInLevel + 1) / (totalAtLevel + 1);
      const y = 80 + level * levelHeight;

      layout[node.id] = { x, y };

      if (node.parents.length > 0) {
        node.parents.forEach((parent, idx) => {
          assignPositions(parent, level + 1, idx, node.parents.length);
        });
      }
    };

    assignPositions(tree, 0, 0, 1);
    return layout;
  }

  computeDepth(node) {
    if (!node || node.parents.length === 0) return 0;
    return 1 + Math.max(...node.parents.map(p => this.computeDepth(p)));
  }

  drawTree(node, layout) {
    let svg = '';
    const pos = layout[node.id];

    // Draw edges to children first
    if (node.parents.length > 0) {
      node.parents.forEach(parent => {
        const parentPos = layout[parent.id];
        svg += `<line x1="${pos.x}" y1="${pos.y}" x2="${parentPos.x}" y2="${parentPos.y}" class="tree-edge"/>`;
      });
    }

    // Draw this node
    const colorMap = {
      'literal': '#4CAF50',
      'mul': '#2196F3',
      'dot': '#FF9800',
      'expand': '#9C27B0',
      'steps': '#F44336',
      'default': '#607D8B'
    };
    const color = colorMap[node.origin] || colorMap.default;

    svg += `<circle cx="${pos.x}" cy="${pos.y}" r="${this.nodeRadius}" class="tree-node" fill="${color}"/>`;
    svg += `<text x="${pos.x}" y="${pos.y}" class="tree-node-label" text-anchor="middle" dominant-baseline="middle">${node.origin}</text>`;

    // Recursively draw parents
    if (node.parents.length > 0) {
      node.parents.forEach(parent => {
        svg += this.drawTree(parent, layout);
      });
    }

    return svg;
  }

  getStyles() {
    return `
      .tree-title {
        font-size: 20px;
        font-weight: bold;
        fill: #333;
      }
      .tree-edge {
        stroke: #999;
        stroke-width: 2;
        fill: none;
      }
      .tree-node {
        stroke: #fff;
        stroke-width: 3;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
      }
      .tree-node-label {
        fill: white;
        font-size: 12px;
        font-weight: bold;
        pointer-events: none;
      }
    `;
  }
}

/**
 * Generate an interactive HTML page with all visualizations
 */
class InteractiveVisualizer {
  constructor(environment, finalMot, title = "Crux Visualization") {
    this.environment = environment;
    this.finalMot = finalMot;
    this.title = title;
  }

  generateHTML() {
    const dependencyGraph = new DependencyGraphVisualizer(this.environment, this.finalMot);
    const timeline = new TimelineVisualizer(this.finalMot);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.title}</title>
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
      font-size: 36px;
      margin-bottom: 10px;
    }
    .subtitle {
      font-size: 16px;
      opacity: 0.9;
    }
    .tabs {
      display: flex;
      background: #f5f5f5;
      border-bottom: 2px solid #ddd;
    }
    .tab {
      flex: 1;
      padding: 20px;
      text-align: center;
      cursor: pointer;
      font-weight: bold;
      transition: all 0.3s;
      border: none;
      background: none;
      font-size: 16px;
    }
    .tab:hover {
      background: #e0e0e0;
    }
    .tab.active {
      background: white;
      color: #667eea;
      border-bottom: 3px solid #667eea;
    }
    .tab-content {
      display: none;
      padding: 40px;
      animation: fadeIn 0.3s;
    }
    .tab-content.active {
      display: block;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .visualization {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 500px;
    }
    svg {
      border: 1px solid #eee;
      border-radius: 8px;
    }
    .info-panel {
      background: #f9f9f9;
      padding: 20px;
      border-radius: 8px;
      margin-top: 20px;
    }
    .info-panel h3 {
      color: #667eea;
      margin-bottom: 10px;
    }
    .pip-list {
      max-height: 400px;
      overflow-y: auto;
      margin-top: 15px;
    }
    .pip-item {
      padding: 10px;
      margin: 5px 0;
      background: white;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
      border-left: 4px solid #667eea;
    }
    .pip-item:hover {
      transform: translateX(5px);
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .pip-item .pip-index {
      font-weight: bold;
      color: #667eea;
    }
    .pip-item .pip-details {
      font-size: 14px;
      color: #666;
      margin-top: 5px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${this.title}</h1>
      <p class="subtitle">Interactive visualization of note derivation and composition</p>
    </header>

    <div class="tabs">
      <button class="tab active" onclick="showTab('timeline')">Timeline View</button>
      <button class="tab" onclick="showTab('dependency')">Dependency Graph</button>
      <button class="tab" onclick="showTab('inspector')">Inspector</button>
    </div>

    <div id="timeline-tab" class="tab-content active">
      <div class="visualization">
        ${timeline.generateSVG()}
      </div>
      <div class="info-panel">
        <h3>Timeline View</h3>
        <p>Shows the temporal progression of notes with color-coded derivation. Each note's color represents its position in the sequence.</p>
        <ul style="margin-top: 10px; margin-left: 20px;">
          <li><strong>Height</strong>: Pitch (step value)</li>
          <li><strong>Width</strong>: Duration (timeScale)</li>
          <li><strong>Color</strong>: Temporal progression (hue varies over time)</li>
        </ul>
      </div>
    </div>

    <div id="dependency-tab" class="tab-content">
      <div class="visualization">
        ${dependencyGraph.generateSVG()}
      </div>
      <div class="info-panel">
        <h3>Dependency Graph</h3>
        <p>Shows how variables and motifs derive from each other through operators.</p>
      </div>
    </div>

    <div id="inspector-tab" class="tab-content">
      <div class="info-panel">
        <h3>Pip Inspector</h3>
        <p>Click on any pip to see its detailed derivation tree.</p>
        <div class="pip-list">
          ${this.generatePipList()}
        </div>
      </div>
    </div>
  </div>

  <script>
    function showTab(tabName) {
      // Hide all tabs
      document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
      });
      document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
      });

      // Show selected tab
      document.getElementById(tabName + '-tab').classList.add('active');
      event.target.classList.add('active');
    }

    function inspectPip(index) {
      showTab('inspector');
      // TODO: Load provenance tree for selected pip
      console.log('Inspecting pip', index);
    }
  </script>
</body>
</html>`;
  }

  generatePipList() {
    const pips = this.finalMot.values.filter(v => v.step !== undefined);
    if (pips.length === 0) return '<p>No pips to display</p>';

    let html = '';
    pips.forEach((pip, idx) => {
      html += `
        <div class="pip-item" onclick="inspectPip(${idx})">
          <span class="pip-index">Pip ${idx}</span>
          <div class="pip-details">
            Step: ${pip.step}, TimeScale: ${pip.timeScale}, Tag: ${pip.tag || 'none'}
          </div>
        </div>
      `;
    });
    return html;
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export {
  Provenance,
  DependencyGraphVisualizer,
  TimelineVisualizer,
  ProvenanceTreeVisualizer,
  InteractiveVisualizer
};
