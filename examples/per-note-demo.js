#!/usr/bin/env node

/**
 * Per-Note Derivation Demo
 *
 * Shows the NEW visualization - per-note derivation DAGs
 * Click any note to see which source pips and operators created it
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import golden from '../src/index.js';
import { PerNoteDerivationVisualizer } from '../src/per-note-visualization.js';

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
  // Evaluate the program
  const result = golden.crux_interp(program);
  const finalMot = result.sections && result.sections.length > 0
    ? result.sections[result.sections.length - 1]
    : result;

  console.log(`Final composition has ${finalMot.values ? finalMot.values.length : 0} notes`);
  console.log();

  // Generate visualization
  const visualizer = new PerNoteDerivationVisualizer(finalMot, program);
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
  console.log();
  console.log('Note: Full DAG visualization requires enhanced provenance tracking');
  console.log('      (coming in next iteration)');

} catch (error) {
  console.error('Error:', error.message);
}
