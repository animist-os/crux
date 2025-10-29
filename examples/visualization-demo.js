#!/usr/bin/env node

/**
 * Demo of Crux Visualization System
 *
 * This demo shows how notes are derived from mots through various operators,
 * with compelling visual representations that make the multiple inheritance
 * structure easy to parse.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { visualizeCruxProgram, visualizeComparison } from '../src/visualize-crux.js';
import golden from '../src/index.js';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('='.repeat(70));
console.log('CRUX VISUALIZATION DEMO');
console.log('='.repeat(70));
console.log();

// ============================================================================
// DEMO 1: Simple Multiplication - Fan Operator
// ============================================================================

const demo1 = `
// Simple Melody Multiplication
// Shows how the * operator creates multiple versions

base = [0, 2, 4]        // C major triad
transpositions = [0, 5] // Root and 5th above

base * transpositions   // Fan mul: apply each transposition to entire base
// Result: [0,2,4, 5,7,9] - two versions of the triad
`;

console.log('Demo 1: Fan Multiplication (*)');
console.log('-------------------------------');
visualizeCruxProgram(
  demo1,
  golden,
  path.join(__dirname, 'demo1-fan-multiplication.html'),
  'Demo 1: Fan Multiplication - Deriving Notes from Multiple Mots'
);
console.log();

// ============================================================================
// DEMO 2: Elementwise Operations - Cog Operator
// ============================================================================

const demo2 = `
// Cog/Elementwise Operations
// Shows how .* tiles and pairs elements

melody = [0, 2, 4, 5, 7]
rhythm = [1|1, 1|2]      // Half note, whole note

melody .* rhythm         // Tile rhythm to match melody length
// Result: Each note gets alternating durations
// [0|1, 2|2, 4|1, 5|2, 7|1]
`;

console.log('Demo 2: Cog/Elementwise Operations (.*)');
console.log('----------------------------------------');
visualizeCruxProgram(
  demo2,
  golden,
  path.join(__dirname, 'demo2-cog-operations.html'),
  'Demo 2: Cog Operations - Tiling and Pairing'
);
console.log();

// ============================================================================
// DEMO 3: Complex Multiple Inheritance
// ============================================================================

const demo3 = `
// Complex Derivation with Multiple Operators
// Demonstrates multiple inheritance from different sources

// Source mots
A = [0, 2, 4]           // Root motif
B = [1, 2]              // Transposition pattern
C = [1|1, 1|/2, 1|/4]   // Rhythm pattern

// Layer 1: Apply transpositions
D = A * B               // Creates 6 notes: A transposed by each B

// Layer 2: Apply rhythms
E = D .* C              // Apply tiled rhythm pattern

// Layer 3: Add variation
F = E * [0, 7]          // Create two versions (root + 5th)

F                       // Final result shows complex derivation
`;

console.log('Demo 3: Complex Multiple Inheritance');
console.log('------------------------------------');
visualizeCruxProgram(
  demo3,
  golden,
  path.join(__dirname, 'demo3-multiple-inheritance.html'),
  'Demo 3: Multiple Inheritance - Complex Derivation Trees'
);
console.log();

// ============================================================================
// DEMO 4: Nested Structures
// ============================================================================

const demo4 = `
// Nested Structures and Subdivision
// Shows hierarchical composition

phrase1 = [0, 2, 4]
phrase2 = [5, 7, 9]

// Group phrases (no auto-subdivision)
combined = [[phrase1], [phrase2]]

// Apply subdivision
subdivided = combined /

// Result shows how nesting creates structure
subdivided
`;

console.log('Demo 4: Nested Structures and Subdivision');
console.log('------------------------------------------');
visualizeCruxProgram(
  demo4,
  golden,
  path.join(__dirname, 'demo4-nested-structures.html'),
  'Demo 4: Nested Structures - Hierarchical Composition'
);
console.log();

// ============================================================================
// DEMO 5: Comparison View - Different Operators
// ============================================================================

const comparisonPrograms = [
  {
    name: 'Fan Multiply (*)',
    code: '[0, 2, 4] * [0, 5]'
  },
  {
    name: 'Cog Multiply (.*)',
    code: '[0, 2, 4] .* [0, 5]'
  },
  {
    name: 'Fan Expand (^)',
    code: '[1, 2, 3] ^ [2, 3]'
  },
  {
    name: 'Cog Expand (.^)',
    code: '[1, 2, 3] .^ [2, 3]'
  },
  {
    name: 'Steps (->)',
    code: '[0, 4] -> [2, 1]'
  },
  {
    name: 'Mirror (m)',
    code: '[0, 2, 4, 5] m 4'
  }
];

console.log('Demo 5: Operator Comparison');
console.log('----------------------------');
visualizeComparison(
  comparisonPrograms,
  golden,
  path.join(__dirname, 'demo5-operator-comparison.html'),
  'Demo 5: Operator Comparison - How Different Operators Transform Mots'
);
console.log();

// ============================================================================
// DEMO 6: Musical Composition Example
// ============================================================================

const demo6 = `
// Musical Composition: Bach-inspired Sequence
// Shows practical musical application

// Define scale degrees
scale = [0, 2, 4, 5, 7, 9, 11]

// Ascending and descending patterns
up = [0->4]              // Steps from 0 to 4
down = [4->0] m 0        // Mirror of up

// Create phrase with rhythm
phrase = [[up], [down]] / .* [1|1, 1|/2]

// Harmonize: add thirds
harmonized = phrase * [0, 2]

// Final composition
harmonized
`;

console.log('Demo 6: Musical Composition Example');
console.log('-----------------------------------');
visualizeCruxProgram(
  demo6,
  golden,
  path.join(__dirname, 'demo6-musical-composition.html'),
  'Demo 6: Musical Composition - Bach-inspired Sequence'
);
console.log();

// ============================================================================
// DEMO 7: Provenance Depth Visualization
// ============================================================================

const demo7 = `
// Deep Derivation Chain
// Shows how derivation depth affects visualization

A = [0, 1, 2]
B = A * [0, 2]           // Depth 1
C = B * [0, 3]           // Depth 2
D = C .* [1|1, 1|/2]     // Depth 3
E = D * [0, 5]           // Depth 4

E                        // Final: 4 levels of derivation
`;

console.log('Demo 7: Deep Derivation Chain');
console.log('-----------------------------');
visualizeCruxProgram(
  demo7,
  golden,
  path.join(__dirname, 'demo7-deep-derivation.html'),
  'Demo 7: Deep Derivation - Multiple Levels of Transformation'
);
console.log();

console.log('='.repeat(70));
console.log('All demos generated successfully!');
console.log('='.repeat(70));
console.log();
console.log('Generated files:');
console.log('  - demo1-fan-multiplication.html');
console.log('  - demo2-cog-operations.html');
console.log('  - demo3-multiple-inheritance.html');
console.log('  - demo4-nested-structures.html');
console.log('  - demo5-operator-comparison.html');
console.log('  - demo6-musical-composition.html');
console.log('  - demo7-deep-derivation.html');
console.log();
console.log('Open any of these HTML files in a browser to see the visualizations!');
console.log();

// Optional: Start a live server
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Start a live visualization server? (y/n): ', async (answer) => {
  if (answer.toLowerCase() === 'y') {
    const { createVisualizationServer } = await import('../src/visualize-crux.js');
    const server = createVisualizationServer(3000);
    console.log('\nVisualization server started!');
    console.log('Press Ctrl+C to stop the server.');
  } else {
    console.log('\nDone! Enjoy exploring the visualizations.');
    rl.close();
  }
});
