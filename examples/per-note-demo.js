#!/usr/bin/env node

/**
 * Per-Note Derivation Demo
 *
 * Shows per-note derivation DAGs built from AST analysis
 * NO MODIFICATIONS to core Crux needed!
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import golden from '../src/index.js';
import { PerNoteDerivationVisualizer } from '../src/per-note-visualization.js';
import { DerivationGraphBuilder } from '../src/derivation-graph-builder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Example showing clear multiple inheritance
const program = `
// Source motifs
A = [0, 2, 4]
B = [1, 3]

// Each final note derives from combinations of A and B
result = A * B

result
`;

console.log('Generating per-note derivation visualization...');
console.log();
console.log('Program:');
console.log(program);
console.log();

try {
  // Build derivation graph from AST (no core modifications!)
  const builder = new DerivationGraphBuilder(program, golden);
  const graphData = builder.build();

  console.log(`Final composition has ${graphData.pipDerivations.length} notes`);
  console.log();

  // Show derivation for first few notes
  console.log('Derivation examples:');
  graphData.pipDerivations.slice(0, 3).forEach(({ index, pip, derivation }) => {
    console.log(`  Note ${index} (step=${pip.step}, time=${pip.timeScale}):`);
    console.log(`    ${formatDerivation(derivation, 4)}`);
  });
  console.log();

  // Generate visualization
  const visualizer = new PerNoteDerivationVisualizer(graphData.finalMot, program);
  visualizer.setDerivationData(graphData); // Pass the graph data
  const html = visualizer.generateHTML();

  // Write to file
  const outputPath = path.join(__dirname, 'per-note-derivation.html');
  fs.writeFileSync(outputPath, html, 'utf8');

  console.log(`✓ Visualization generated: ${outputPath}`);
  console.log();
  console.log('Open per-note-derivation.html in your browser!');
  console.log();
  console.log('Features:');
  console.log('  • Piano roll showing all final notes');
  console.log('  • Click any note to see its derivation DAG');
  console.log('  • See which source pips were combined to create each note');
  console.log('  • Visualize multiple inheritance patterns');
  console.log('  • Built from AST - no core library modifications needed!');

} catch (error) {
  console.error('Error:', error.message);
  console.error(error.stack);
}

function formatDerivation(node, indent = 0) {
  const prefix = ' '.repeat(indent);
  let result = `${prefix}${node.type}`;

  if (node.type === 'source-pip') {
    result += ` [${node.data.step}|${node.data.timeScale}]`;
  } else if (node.type === 'operator') {
    result += ` (${node.data.operation})`;
  } else if (node.type === 'ref') {
    result += ` → ${node.data.varName}`;
  }

  if (node.children && node.children.length > 0) {
    result += '\n' + node.children.map(c => formatDerivation(c, indent + 2)).join('\n');
  }

  return result;
}
