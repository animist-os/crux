#!/usr/bin/env node

/**
 * Dependency Graph Demo
 *
 * Shows a complex musical composition with multiple inheritance patterns
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { visualizeCruxProgram } from '../src/visualize-crux.js';
import golden from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Complex musical composition with rich dependency patterns
const program = `
// === Level 0: Musical Building Blocks ===
// Basic intervals
root = [0]
third = [4]
fifth = [7]
octave = [12]

// Scale degrees
majorScale = [0, 2, 4, 5, 7, 9, 11]
minorScale = [0, 2, 3, 5, 7, 8, 10]

// === Level 1: Chords and Intervals ===
// Major triad from intervals
majorTriad = root, third, fifth
minorTriad = root, [3], fifth

// Extended harmony
majorSeventh = majorTriad, [11]
dominantSeventh = majorTriad, [10]

// Transpositions
rootPosition = majorTriad * [0]
firstInversion = majorTriad * [0, 12]
secondInversion = majorTriad * [0, 12, 24]

// === Level 2: Melodic Patterns ===
// Arpeggios from chords
ascendingArp = majorTriad * [0, 12, 24]
descendingArp = ascendingArp m 0

// Scale-based melodies
majorMelody = majorScale * [0, 12]
minorMelody = minorScale * [0, -12]

// Rhythmic variations
quickArp = ascendingArp .* [1|/4]
slowChords = rootPosition .* [1|4]

// === Level 3: Harmonic Combinations ===
// Combining different chord voicings
voicings = rootPosition, firstInversion, secondInversion

// Melody with harmony
harmonizedMelody = majorMelody * [0, 4, 7]
countermelody = minorMelody * [12]

// Creating tension and release
tension = dominantSeventh * [7]
resolution = majorSeventh * [0]

// === Level 4: Phrases ===
// Combining multiple elements
phraseA = harmonizedMelody, quickArp
phraseB = voicings, slowChords
phraseC = tension, resolution

// Cross-dependencies
development = phraseA * [0, 5]
recapitulation = phraseA, phraseB

// === Level 5: Sections ===
intro = quickArp, slowChords
verse = phraseA, countermelody
chorus = phraseB, harmonizedMelody
bridge = tension, development

// === Level 6: Final Composition ===
composition = intro, verse, chorus, verse, bridge, chorus

composition
`;

console.log('Generating complex dependency graph visualization...');
console.log();
console.log('This example shows a rich musical composition structure with:');
console.log('  - 30+ variables across 7 hierarchical levels');
console.log('  - Multiple inheritance patterns (diamond dependencies)');
console.log('  - Cross-level references');
console.log('  - Different operator types (*, .*, m, etc.)');
console.log();
console.log('Musical structure:');
console.log('  Level 0: Musical building blocks (intervals, scales)');
console.log('  Level 1: Chords and transpositions');
console.log('  Level 2: Melodic patterns and rhythms');
console.log('  Level 3: Harmonic combinations');
console.log('  Level 4: Musical phrases');
console.log('  Level 5: Structural sections');
console.log('  Level 6: Final composition');
console.log();

const result = visualizeCruxProgram(
  program,
  golden,
  path.join(__dirname, 'dependency-graph-demo.html'),
  'Complex Dependency Graph - Musical Composition Structure'
);

console.log(`✓ Visualization generated successfully!`);
console.log(`  File: ${result.htmlPath}`);
console.log(`  Variables: ${result.environment ? result.environment.size : 0}`);
console.log(`  Pips: ${result.pipCount}`);
console.log();
console.log('Open dependency-graph-demo.html to see the full dependency graph!');
console.log('The dependency graph shows the complete composition hierarchy.');

