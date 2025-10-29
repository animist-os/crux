#!/usr/bin/env node

/**
 * Quick Visualization Example
 *
 * A minimal example showing how to visualize a Crux program.
 * Run this file to generate a simple visualization.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { visualizeCruxProgram } from '../src/visualize-crux.js';
import golden from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define a simple Crux program
const program = `
// A simple musical phrase with derivation

// Base melody
melody = [0, 2, 4, 5, 7]

// Add harmony (thirds and fifths)
final = melody * [0, 2, 4]

final
`;

console.log('Generating visualization for:');
console.log(program);
console.log();

// Generate the visualization
const result = visualizeCruxProgram(
  program,
  golden,
  path.join(__dirname, 'quick-example.html'),
  'Quick Crux Visualization Example'
);

console.log(`✓ Visualization generated successfully!`);
console.log(`  File: ${result.htmlPath}`);
console.log(`  Pips: ${result.pipCount}`);
console.log();
console.log('Open quick-example.html in your browser to see the visualization.');
