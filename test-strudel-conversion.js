/**
 * Test script to verify Crux to Strudel conversion
 * Run with: node test-strudel-conversion.js
 */

import golden from './dist/crux.cjs';
import { cruxToStrudel } from './strudel-integration.js';

// Test cases
const testCases = [
  { code: '[0, 2, 4]', description: 'Simple ascending pattern' },
  { code: '[0, 3] -> [4]', description: 'Steps operator' },
  { code: '[0, r, 2, r]', description: 'Pattern with rests' },
  { code: '[0, 2, 4] * [0, 1]', description: 'Multiplication' },
];

console.log('🧪 Testing Crux to Strudel Conversion\n');

testCases.forEach((testCase, i) => {
  console.log(`${i + 1}. ${testCase.description}`);
  console.log(`   Crux: ${testCase.code}`);
  
  try {
    const result = golden.crux_interp(testCase.code);
    const strudelPattern = cruxToStrudel(result, { rootNote: 60 });
    console.log(`   Strudel: "${strudelPattern}"`);
    
    // Show MIDI notes
    const midiNotes = result.sections[0].values
      .filter(p => p.tag !== 'r')
      .map(p => 60 + p.step);
    console.log(`   MIDI notes: [${midiNotes.join(', ')}]`);
    console.log('');
  } catch (error) {
    console.error(`   ERROR: ${error.message}`);
    console.log('');
  }
});

console.log('✅ Conversion test complete!');

