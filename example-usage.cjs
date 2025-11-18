#!/usr/bin/env node
// Example of using the bundled Crux distribution

const golden = require('./dist/crux.cjs');

console.log('🎵 Crux Musical Motif DSL - Example Usage\n');

// Example 1: Basic multiplication
console.log('1️⃣  Basic: [0,1,2] * [3]');
const ex1 = golden.crux_interp('[0,1,2] * [3]');
console.log('   Result:', ex1.toString());
console.log('');

// Example 2: Glass operator (minimalist interleaving)
console.log('2️⃣  Glass: [0,2,4] g [0,1]');
const ex2 = golden.crux_interp('[0,2,4] g [0,1]');
console.log('   Result:', ex2.toString());
console.log('');

// Example 3: Random with seed (reproducible)
console.log('3️⃣  Random: [{1 ? 6}$cafe] :8');
const ex3 = golden.crux_interp('[{1 ? 6}$cafe] :8');
console.log('   Result:', ex3.toString());
console.log('');

// Example 4: Nested subdivision
console.log('4️⃣  Nested: [0,[1,2],3]');
const ex4 = golden.crux_interp('[0,[1,2],3]');
console.log('   Result:', ex4.toString());
console.log('');

// Example 5: Steps operator
console.log('5️⃣  Steps: [0,3] -> [2]');
const ex5 = golden.crux_interp('[0,3] -> [2]');
console.log('   Result:', ex5.toString());
console.log('');

// Example 6: Using analysis functions
console.log('6️⃣  Analysis: Depth computation');
const depths = golden.computeMotDepthsFromRoot('[0,1] * [2,3]');
console.log('   Depths:', depths.map(d => `depth=${d.depth}, pips=${d.mot.values.length}`));
console.log('');

// Example 7: Twinkle Twinkle Little Star (from tutorial)
console.log('7️⃣  Music: Twinkle Twinkle (Ah, vous dirai-je Maman)');
const twinkle = golden.crux_interp('[0,4,5 -> 0]');
console.log('   Motif:', twinkle.toString());
console.log('');

console.log('✨ All examples completed successfully!');
console.log('');
console.log('📚 For more examples, see crux_tutorial.md');
console.log('🔧 To modify Crux, edit src/index.js and run: npm run build');
