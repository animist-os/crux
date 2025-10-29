#!/usr/bin/env node

/**
 * Dependency Graph Demo
 *
 * Shows a complex derivation chain to demonstrate the dependency graph
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { visualizeCruxProgram } from '../src/visualize-crux.js';
import golden from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Complex program with multiple levels of derivation
const program = `
// Level 0: Source motifs
bass = [0, 2, 4]
treble = [5, 7, 9]

// Level 1: Combine sources
harmony = bass * [0, 4]
melody = treble * [0, 2]

// Level 2: Transform combinations
phrase1 = harmony .* [1|1, 1|2]
phrase2 = melody .* [1|/2, 1|1]

// Level 3: Final composition
final = phrase1, phrase2

final
`;

console.log('Generating dependency graph visualization...');
console.log('This example shows a complex derivation chain:');
console.log('  Level 0: bass, treble (source motifs)');
console.log('  Level 1: harmony, melody (derived from sources)');
console.log('  Level 2: phrase1, phrase2 (derived from level 1)');
console.log('  Level 3: final (combines phrases)');
console.log();

const result = visualizeCruxProgram(
  program,
  golden,
  path.join(__dirname, 'dependency-graph-demo.html'),
  'Dependency Graph Demo - Complex Derivation Chain'
);

console.log(`✓ Visualization generated successfully!`);
console.log(`  File: ${result.htmlPath}`);
console.log(`  Variables: ${result.environment ? result.environment.size : 0}`);
console.log(`  Pips: ${result.pipCount}`);
console.log();
console.log('Open dependency-graph-demo.html to see the dependency graph!');
console.log('Switch to the "Dependency Graph" tab to see how variables derive from each other.');
