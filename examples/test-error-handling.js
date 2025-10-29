#!/usr/bin/env node

/**
 * Test error handling with intentionally broken syntax
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { visualizeCruxProgram } from '../src/visualize-crux.js';
import golden from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Testing error handling...\n');

// Test 1: Wrong comment syntax
console.log('Test 1: Using # instead of //');
console.log('--------------------------------');
const badComments = `
melody = [0, 2, 4]  # This is wrong
melody
`;

visualizeCruxProgram(
  badComments,
  golden,
  path.join(__dirname, 'test1.html'),
  'Test 1: Bad Comments'
);

// Test 2: Wrong timescale syntax
console.log('\nTest 2: Bare timescale without step');
console.log('------------------------------------');
const badTimescale = `
rhythm = [1, /2, /4]
rhythm
`;

visualizeCruxProgram(
  badTimescale,
  golden,
  path.join(__dirname, 'test2.html'),
  'Test 2: Bad Timescale'
);

// Test 3: Correct syntax (should work)
console.log('\nTest 3: Correct syntax');
console.log('----------------------');
const goodSyntax = `
melody = [0, 2, 4]  // This is correct
rhythm = [1|1, 1|/2]
melody .* rhythm
`;

visualizeCruxProgram(
  goodSyntax,
  golden,
  path.join(__dirname, 'test3.html'),
  'Test 3: Good Syntax'
);

console.log('\nDone testing error handling!');
