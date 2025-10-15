import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/index.js'; // Load the module to set up golden global

const {
  findAllTimescaleIndices,
  findNumericValueIndicesAtDepth,
  findNumericValueIndicesAtDepthOrAbove,
  computeMotDepthsFromRoot,
  computeHeightFromLeaves,
  findPipAtPosition,
  findAllPipsWithPositions,
} = golden;

// ===================================================================
// Tests for findAllTimescaleIndices
// ===================================================================

test('findAllTimescaleIndices: basic timescale detection', () => {
  const src = '[1|2, 3|4]';
  const indices = findAllTimescaleIndices(src);
  assert.deepEqual(indices, [src.indexOf('2'), src.indexOf('4')]);
  assert.deepEqual(indices.map(i => src[i]), ['2', '4']);
});

test('findAllTimescaleIndices: with leading whitespace', () => {
  const src = '   [1|2, 3|4]';
  const indices = findAllTimescaleIndices(src);
  assert.deepEqual(indices, [src.indexOf('2'), src.indexOf('4')]);
  assert.deepEqual(indices.map(i => src[i]), ['2', '4']);
});

test('findAllTimescaleIndices: with trailing whitespace', () => {
  const src = '[1|2, 3|4]   ';
  const indices = findAllTimescaleIndices(src);
  assert.deepEqual(indices, [src.indexOf('2'), src.indexOf('4')]);
  assert.deepEqual(indices.map(i => src[i]), ['2', '4']);
});

test('findAllTimescaleIndices: with leading and trailing whitespace', () => {
  const src = '   [1|2, 3|4]   ';
  const indices = findAllTimescaleIndices(src);
  assert.deepEqual(indices, [src.indexOf('2'), src.indexOf('4')]);
  assert.deepEqual(indices.map(i => src[i]), ['2', '4']);
});

test('findAllTimescaleIndices: with comments before section separator', () => {
  const src = 'x = [1|2]\n// comment\n!\ny = [3|4]';
  const indices = findAllTimescaleIndices(src);
  assert.deepEqual(indices, [src.indexOf('2'), src.indexOf('4')]);
  assert.deepEqual(indices.map(i => src[i]), ['2', '4']);
});

test('findAllTimescaleIndices: with trailing comments', () => {
  const src = '[1|2, 3|4]\n// trailing comment';
  const indices = findAllTimescaleIndices(src);
  assert.deepEqual(indices, [src.indexOf('2'), src.indexOf('4')]);
  assert.deepEqual(indices.map(i => src[i]), ['2', '4']);
});

test('findAllTimescaleIndices: fractional timescales', () => {
  const src = '[1|3/2, 5|7/11]';
  const indices = findAllTimescaleIndices(src);
  // Should find both numerator and denominator positions
  assert.ok(indices.includes(src.indexOf('3')));
  assert.ok(indices.includes(src.indexOf('2')));
  assert.ok(indices.includes(src.indexOf('7')));
  assert.ok(indices.includes(src.indexOf('11')));
  assert.deepEqual(indices.map(i => src[i]), ['3', '2', '7', '1']); // '1' is first digit of '11'
});

test('findAllTimescaleIndices: pipe-only forms', () => {
  const src = '[0 | 2, 1 | 3]';
  const indices = findAllTimescaleIndices(src);
  assert.deepEqual(indices, [src.indexOf('2'), src.lastIndexOf('3')]);
  assert.deepEqual(indices.map(i => src[i]), ['2', '3']);
});

test('findAllTimescaleIndices: nested mots with timescales', () => {
  const src = '[[1|2], [3|4]]';
  const indices = findAllTimescaleIndices(src);
  assert.deepEqual(indices, [src.indexOf('2'), src.indexOf('4')]);
  assert.deepEqual(indices.map(i => src[i]), ['2', '4']);
});

test('findAllTimescaleIndices: empty code', () => {
  const indices = findAllTimescaleIndices('');
  assert.deepEqual(indices, []);
});

test('findAllTimescaleIndices: no timescales', () => {
  const indices = findAllTimescaleIndices('[0, 1, 2, 3]');
  assert.deepEqual(indices, []);
});

// ===================================================================
// Tests for findNumericValueIndicesAtDepth
// ===================================================================

test('findNumericValueIndicesAtDepth: basic range endpoints', () => {
  const src = '[0->5]';
  const indices = findNumericValueIndicesAtDepth(src, 0);
  assert.deepEqual(indices, [src.indexOf('0'), src.indexOf('5')]);
  assert.deepEqual(indices.map(i => src[i]), ['0', '5']);
});

test('findNumericValueIndicesAtDepth: random choice positions', () => {
  const src = '[{1,2,3}]';
  const indices = findNumericValueIndicesAtDepth(src, 0);
  assert.deepEqual(indices, [src.indexOf('1'), src.indexOf('2'), src.indexOf('3')]);
  assert.deepEqual(indices.map(i => src[i]), ['1', '2', '3']);
});

test('findNumericValueIndicesAtDepth: with leading whitespace', () => {
  const src = '  [0->5, {1,2}]';
  const indices = findNumericValueIndicesAtDepth(src, 0);
  assert.deepEqual(indices, [src.indexOf('0'), src.indexOf('5'), src.indexOf('1'), src.indexOf('2')]);
  assert.deepEqual(indices.map(i => src[i]), ['0', '5', '1', '2']);
});

test('findNumericValueIndicesAtDepth: with trailing whitespace', () => {
  const src = '[0->5, {1,2}]  ';
  const indices = findNumericValueIndicesAtDepth(src, 0);
  assert.deepEqual(indices, [src.indexOf('0'), src.indexOf('5'), src.indexOf('1'), src.indexOf('2')]);
  assert.deepEqual(indices.map(i => src[i]), ['0', '5', '1', '2']);
});

test('findNumericValueIndicesAtDepth: with comments', () => {
  const src = '// comment\n[0->5, {1,2}]';
  const indices = findNumericValueIndicesAtDepth(src, 0);
  assert.deepEqual(indices, [src.indexOf('0'), src.indexOf('5'), src.indexOf('1'), src.indexOf('2')]);
  assert.deepEqual(indices.map(i => src[i]), ['0', '5', '1', '2']);
});

test('findNumericValueIndicesAtDepth: multi-section with comments before separator', () => {
  const src = 'x = [0->1]\n// comment\n!\ny = [2->3]';
  const indicesDepth0 = findNumericValueIndicesAtDepth(src, 0);
  // Last section has depth 0
  assert.deepEqual(indicesDepth0, [src.indexOf('2'), src.lastIndexOf('3')]);
  assert.deepEqual(indicesDepth0.map(i => src[i]), ['2', '3']);
});

test('findNumericValueIndicesAtDepth: negative numbers in range', () => {
  const src = '[1 -> -2]';
  const indices = findNumericValueIndicesAtDepth(src, 0);
  // Should find '1' and the start of '-2' (which is the '-' sign)
  // Note: The parser captures the position where the number token starts
  const expected = [src.indexOf('1'), src.indexOf('-2')];
  assert.deepEqual(indices, expected);
  assert.deepEqual(indices.map(i => src[i]), ['1', '-']);
});

test('findNumericValueIndicesAtDepth: empty result for wrong depth', () => {
  const src = '[0->5]';
  const indices = findNumericValueIndicesAtDepth(src, 5);
  assert.deepEqual(indices, []);
});

// ===================================================================
// Tests for findNumericValueIndicesAtDepthOrAbove
// ===================================================================

test('findNumericValueIndicesAtDepthOrAbove: aggregates multiple depths', () => {
  const src = '[0->1] * [2->3]';
  const indices = findNumericValueIndicesAtDepthOrAbove(src, 1);
  // Should include both mots at depth 1
  assert.deepEqual(indices, [
    src.indexOf('0'),
    src.indexOf('1'),
    src.indexOf('2'),
    src.lastIndexOf('3')
  ]);
});

test('findNumericValueIndicesAtDepthOrAbove: with whitespace', () => {
  const src = '  [0->1] * [2->3]  ';
  const indices = findNumericValueIndicesAtDepthOrAbove(src, 1);
  assert.deepEqual(indices, [
    src.indexOf('0'),
    src.indexOf('1'),
    src.indexOf('2'),
    src.lastIndexOf('3')
  ]);
});

test('findNumericValueIndicesAtDepthOrAbove: includes range endpoints at all depths', () => {
  const src = '[0->1] * [2->3], [4->5]';
  // "OrAbove" means shallower or equal depth (closer to root)
  // With minDepth=1, we get depth 0 and depth 1 (all depths <= 1)
  const indices = findNumericValueIndicesAtDepthOrAbove(src, 1);
  // Should include all range endpoints at depths 0 and 1
  // Note: This function only returns positions for ranges and random choices, not plain numbers
  assert.ok(indices.length > 0);
  // Verify we got all the range endpoints
  const expected = [
    src.indexOf('0'),
    src.indexOf('1'),
    src.indexOf('2'),
    src.lastIndexOf('3'),
    src.lastIndexOf('4'),
    src.lastIndexOf('5')
  ];
  assert.deepEqual(indices, expected);
});

// ===================================================================
// Tests for computeMotDepthsFromRoot
// ===================================================================

test('computeMotDepthsFromRoot: with leading whitespace', () => {
  const src = '  [0, 1] * [2]';
  const result = computeMotDepthsFromRoot(src);
  assert.equal(result.length, 2);
  assert.equal(result[0].depth, 1);
  assert.equal(result[1].depth, 1);
});

test('computeMotDepthsFromRoot: with trailing whitespace', () => {
  const src = '[0, 1] * [2]  ';
  const result = computeMotDepthsFromRoot(src);
  assert.equal(result.length, 2);
  assert.equal(result[0].depth, 1);
  assert.equal(result[1].depth, 1);
});

test('computeMotDepthsFromRoot: with comments', () => {
  const src = '// comment\n[0, 1] * [2]';
  const result = computeMotDepthsFromRoot(src);
  assert.equal(result.length, 2);
  assert.equal(result[0].depth, 1);
  assert.equal(result[1].depth, 1);
});

test('computeMotDepthsFromRoot: multi-section with comments before separator', () => {
  const src = 'x = [1]\n// comment\n!\ny = [2] * [3]';
  const result = computeMotDepthsFromRoot(src);
  // Last section determines result
  assert.equal(result.length, 2);
  assert.equal(result[0].depth, 1);
  assert.equal(result[1].depth, 1);
});

// ===================================================================
// Tests for computeHeightFromLeaves
// ===================================================================

test('computeHeightFromLeaves: with leading whitespace', () => {
  const src = '  [0] * [1] ^ [2]';
  const height = computeHeightFromLeaves(src);
  assert.equal(height, 2);
});

test('computeHeightFromLeaves: with trailing whitespace', () => {
  const src = '[0] * [1] ^ [2]  ';
  const height = computeHeightFromLeaves(src);
  assert.equal(height, 2);
});

test('computeHeightFromLeaves: with comments', () => {
  const src = '// comment\n[0] * [1] ^ [2]';
  const height = computeHeightFromLeaves(src);
  assert.equal(height, 2);
});

test('computeHeightFromLeaves: multi-section with comments before separator', () => {
  const src = 'x = [1]\n// comment\n!\ny = [0] * [1] ^ [2]';
  const height = computeHeightFromLeaves(src);
  assert.equal(height, 2);
});

// ===================================================================
// Comprehensive edge case tests
// ===================================================================

test('comprehensive: user example with comments before section separator', () => {
  const src = `S = [9] * [0,1,0] . [[0,0],[0,0,0,0],[0,0]]
T = [4 -> 7] . [[0,0], [0,0], [0,0,0,0]]
B = [0] * [1, 1, 1, 0, 0, 1, 0, 1, 1, 1]

woven = (B, T, S, T, S, T) z

woven . [0, 0, [0,-1,0], 0, 0, 0]


// @preset Mellotron_Flute
// @octave -2
// @reverb 0.2
// @bpm 120

!
B * [15|4]`;

  // All utility functions should work without crashing
  const timescales = findAllTimescaleIndices(src);
  assert.ok(timescales.length > 0);

  const indicesDepth0 = findNumericValueIndicesAtDepth(src, 0);
  assert.ok(Array.isArray(indicesDepth0));

  const indicesDepth1 = findNumericValueIndicesAtDepth(src, 1);
  assert.ok(Array.isArray(indicesDepth1));

  const depths = computeMotDepthsFromRoot(src);
  assert.ok(depths.length > 0);

  const height = computeHeightFromLeaves(src);
  assert.ok(typeof height === 'number');
});

test('comprehensive: mixed whitespace and comments', () => {
  const src = `

  // Leading comment

  [1|2, 3|4]

  // Trailing comment

  `;

  const timescales = findAllTimescaleIndices(src);
  assert.equal(timescales.length, 2);
  assert.deepEqual(timescales.map(i => src[i]), ['2', '4']);
});

// ===================================================================
// Tests for semicolon handling
// ===================================================================

test('semicolon: findAllTimescaleIndices with semicolon separator', () => {
  const src = 'x = [0]; y = [1|2]';
  const indices = findAllTimescaleIndices(src);
  assert.deepEqual(indices, [src.indexOf('2')]);
  assert.deepEqual(indices.map(i => src[i]), ['2']);
});

test('semicolon: findAllTimescaleIndices with spaces around semicolon', () => {
  const src = 'x = [0]  ;  y = [3|4, 5|6]';
  const indices = findAllTimescaleIndices(src);
  assert.deepEqual(indices, [src.indexOf('4'), src.lastIndexOf('6')]);
  assert.deepEqual(indices.map(i => src[i]), ['4', '6']);
});

test('semicolon: findAllTimescaleIndices with multiple semicolons', () => {
  const src = 'a = [1|2]; b = [3|4]; c = [5|6]';
  const indices = findAllTimescaleIndices(src);
  assert.equal(indices.length, 3);
  assert.deepEqual(indices.map(i => src[i]), ['2', '4', '6']);
});

test('semicolon: findNumericValueIndicesAtDepth with semicolon', () => {
  const src = 'x = [0]; y = [1->5, {2,3}]';
  const indices = findNumericValueIndicesAtDepth(src, 0);
  const expected = [src.indexOf('1'), src.indexOf('5'), src.indexOf('2'), src.lastIndexOf('3')];
  assert.deepEqual(indices, expected);
  assert.deepEqual(indices.map(i => src[i]), ['1', '5', '2', '3']);
});

test('semicolon: findNumericValueIndicesAtDepth with spaces around semicolon', () => {
  const src = 'x = [0]  ;  y = [1->5]';
  const indices = findNumericValueIndicesAtDepth(src, 0);
  assert.deepEqual(indices, [src.indexOf('1'), src.indexOf('5')]);
  assert.deepEqual(indices.map(i => src[i]), ['1', '5']);
});

test('semicolon: findNumericValueIndicesAtDepthOrAbove', () => {
  const src = 'x = [0->1]; y = [2->3] * [4->5]';
  const indices = findNumericValueIndicesAtDepthOrAbove(src, 1);
  // Should get the mul's operands at depth 1
  assert.ok(indices.includes(src.indexOf('2')));
  assert.ok(indices.includes(src.lastIndexOf('3')));
  assert.ok(indices.includes(src.indexOf('4')));
  assert.ok(indices.includes(src.lastIndexOf('5')));
});

test('semicolon: computeMotDepthsFromRoot', () => {
  const src = 'x = [1]; y = [2] * [3]';
  const result = computeMotDepthsFromRoot(src);
  // Last statement determines result
  assert.equal(result.length, 2);
  assert.equal(result[0].depth, 1);
  assert.equal(result[1].depth, 1);
});

test('semicolon: computeHeightFromLeaves', () => {
  const src = 'x = [1]; y = [0] * [1] ^ [2]';
  const height = computeHeightFromLeaves(src);
  assert.equal(height, 2);
});

test('semicolon: mixed with comments', () => {
  const src = 'x = [1|2]; // comment\ny = [3|4]';
  const indices = findAllTimescaleIndices(src);
  assert.equal(indices.length, 2);
  assert.deepEqual(indices.map(i => src[i]), ['2', '4']);
});

test('semicolon: leading whitespace and semicolon', () => {
  const src = '  x = [1|2]; y = [3|4]';
  const indices = findAllTimescaleIndices(src);
  assert.equal(indices.length, 2);
  assert.deepEqual(indices.map(i => src[i]), ['2', '4']);
});

test('semicolon: trailing whitespace and semicolon', () => {
  const src = 'x = [1|2]; y = [3|4]  ';
  const indices = findAllTimescaleIndices(src);
  assert.equal(indices.length, 2);
  assert.deepEqual(indices.map(i => src[i]), ['2', '4']);
});

// ===================================================================
// Tests for findPipAtPosition
// ===================================================================

test('findPipAtPosition: finds exact pip position', () => {
  const src = '[1, 2, 3]';
  const result = findPipAtPosition(src, src.indexOf('2'));
  assert.ok(result);
  assert.equal(result.pip.step, 2);
  assert.equal(result.position, src.indexOf('2'));
});

test('findPipAtPosition: finds pip in simple mot', () => {
  const src = '[5, 10, 15]';
  const result = findPipAtPosition(src, src.indexOf('10'));
  assert.ok(result);
  assert.equal(result.pip.step, 10);
  assert.equal(src[result.position], '1'); // First char of '10'
});

test('findPipAtPosition: finds closest pip before position', () => {
  const src = '[1, 2, 3]';
  // Position between '2' and ','
  const pos = src.indexOf('2') + 1;
  const result = findPipAtPosition(src, pos);
  assert.ok(result);
  assert.equal(result.pip.step, 2);
});

test('findPipAtPosition: handles negative numbers', () => {
  const src = '[-5, 1, 3]';
  const result = findPipAtPosition(src, src.indexOf('-5'));
  assert.ok(result);
  assert.equal(result.pip.step, -5);
});

test('findPipAtPosition: handles ranges', () => {
  const src = '[1->5]';
  const result = findPipAtPosition(src, src.indexOf('1'));
  assert.ok(result);
  assert.equal(result.pip.step, 1);
});

test('findPipAtPosition: handles whitespace and comments', () => {
  const src = '  [1, 2] // comment';
  const result = findPipAtPosition(src, src.indexOf('2'));
  assert.ok(result);
  assert.equal(result.pip.step, 2);
});

test('findPipAtPosition: handles semicolons', () => {
  const src = 'x = [1, 2]; y = [3, 4]';
  const result = findPipAtPosition(src, src.indexOf('3'));
  assert.ok(result);
  assert.equal(result.pip.step, 3);
});

test('findPipAtPosition: returns null when no pip at position', () => {
  const src = '[1, 2, 3]';
  const result = findPipAtPosition(src, 0); // Before first pip
  assert.equal(result, null);
});

test('findPipAtPosition: handles section separators with comments', () => {
  const src = 'x = [1, 2]\n// comment\n!\ny = [3, 4]';
  const result = findPipAtPosition(src, src.indexOf('3'));
  assert.ok(result);
  assert.equal(result.pip.step, 3);
});

// ===================================================================
// Tests for findAllPipsWithPositions
// ===================================================================

test('findAllPipsWithPositions: returns all pips with positions', () => {
  const src = '[1, 2, 3]';
  const results = findAllPipsWithPositions(src);
  assert.equal(results.length, 3);
  assert.equal(results[0].pip.step, 1);
  assert.equal(results[1].pip.step, 2);
  assert.equal(results[2].pip.step, 3);
  assert.equal(results[0].position, src.indexOf('1'));
  assert.equal(results[1].position, src.indexOf('2'));
  assert.equal(results[2].position, src.indexOf('3'));
});

test('findAllPipsWithPositions: includes depth information', () => {
  const src = '[1, 2] g [3, 4]';
  const results = findAllPipsWithPositions(src);
  assert.ok(results.every(r => typeof r.depth === 'number'));
  // All pips at same depth in this case
  assert.ok(results.every(r => r.depth === results[0].depth));
});

test('findAllPipsWithPositions: includes motPath for structural tracking', () => {
  const src = '[1, 2, 3]';
  const results = findAllPipsWithPositions(src);
  assert.ok(results.every(r => typeof r.motPath === 'string'));
  assert.ok(results[0].motPath.includes('values[0]'));
  assert.ok(results[1].motPath.includes('values[1]'));
  assert.ok(results[2].motPath.includes('values[2]'));
});

test('findAllPipsWithPositions: handles ranges', () => {
  const src = '[1->3]';
  const results = findAllPipsWithPositions(src);
  assert.ok(results.length >= 2); // At least start and end positions
  assert.ok(results.some(r => r.rangeStart));
  assert.ok(results.some(r => r.rangeEnd));
});

test('findAllPipsWithPositions: handles negative numbers', () => {
  const src = '[-5, 1, 3]';
  const results = findAllPipsWithPositions(src);
  assert.equal(results[0].pip.step, -5);
  assert.equal(results[0].position, src.indexOf('-5'));
});

test('findAllPipsWithPositions: handles whitespace', () => {
  const src = '  [1, 2, 3]  ';
  const results = findAllPipsWithPositions(src);
  assert.equal(results.length, 3);
  assert.equal(results[0].position, src.indexOf('1'));
});

test('findAllPipsWithPositions: handles comments', () => {
  const src = '[1, 2] // comment\n!\n[3, 4]';
  const results = findAllPipsWithPositions(src);
  assert.ok(results.length >= 4);
  assert.ok(results.some(r => r.pip && r.pip.step === 1));
  assert.ok(results.some(r => r.pip && r.pip.step === 3));
});

test('findAllPipsWithPositions: handles semicolons', () => {
  const src = 'x = [1, 2]; y = [3, 4]';
  const results = findAllPipsWithPositions(src);
  assert.ok(results.length >= 4);
  const positions = results.map(r => r.position);
  assert.ok(positions.includes(src.indexOf('1')));
  assert.ok(positions.includes(src.indexOf('3')));
});

test('findAllPipsWithPositions: results are sorted by position', () => {
  const src = '[5, 1, 10, 2]';
  const results = findAllPipsWithPositions(src);
  for (let i = 1; i < results.length; i++) {
    assert.ok(results[i].position >= results[i-1].position);
  }
});

test('findAllPipsWithPositions: handles multiple sections', () => {
  const src = '[1, 2]\n!\n[3, 4]';
  const results = findAllPipsWithPositions(src);
  assert.ok(results.length >= 4);
  assert.ok(results.some(r => r.pip && r.pip.step === 1));
  assert.ok(results.some(r => r.pip && r.pip.step === 4));
});

// ===================================================================
// Tests for plain numeric pip position tracking
// ===================================================================

test('findNumericValueIndicesAtDepth: includes plain numeric pips', () => {
  const src = '[1, 2, 3]';
  const indices = findNumericValueIndicesAtDepth(src, 0);
  assert.equal(indices.length, 3);
  assert.deepEqual(indices, [src.indexOf('1'), src.indexOf('2'), src.indexOf('3')]);
  assert.deepEqual(indices.map(i => src[i]), ['1', '2', '3']);
});

test('findNumericValueIndicesAtDepth: includes negative plain numeric pips', () => {
  const src = '[-5, 1, 3, 1]';
  const indices = findNumericValueIndicesAtDepth(src, 0);
  assert.equal(indices.length, 4);
  assert.ok(indices.includes(src.indexOf('-5')));
  assert.ok(indices.includes(src.indexOf('1')));
  assert.ok(indices.includes(src.indexOf('3')));
});

test('findNumericValueIndicesAtDepth: plain pips in complex expression', () => {
  const src = 'A = [-3, 1, 7, 1] g [2, 10]';
  const indices = findNumericValueIndicesAtDepth(src, 1);
  // Should find all numeric pips at depth 1 (children of g operation)
  assert.ok(indices.length >= 4);
  assert.ok(indices.includes(src.indexOf('-3')));
  assert.ok(indices.includes(src.indexOf('7')));
});

test('findNumericValueIndicesAtDepth: plain pips with operations', () => {
  const src = 'A = [-3, 1, 7, 1] g [2, 10] j [| 1, | /2, | /2]';
  // The g and j operations create depth 2 (two binary transforms)
  const indices = findNumericValueIndicesAtDepth(src, 2);
  assert.ok(indices.length >= 4);
  // Check that plain numeric pips from the first mot are found
  assert.ok(indices.includes(src.indexOf('-3')));
  assert.ok(indices.includes(src.indexOf('1')));
  assert.ok(indices.includes(src.indexOf('7')));
});

test('findNumericValueIndicesAtDepth: user example case', () => {
  const src = `A = [-3, 1, 7, 1] g [2, 10] j [| 1, | /2, | /2] .j [| 1, | /2, | /2]
A * [0, 0, 0, 0, 0]
!
[r,r,r,r,r,r], A * [7] * [0, 0, 0]`;

  // Should find pips in the final section
  const indices = findNumericValueIndicesAtDepth(src, 2);
  assert.ok(indices.length > 0, 'Should find some numeric pips at depth 2');

  // Should find the 7 in "A * [7]"
  const sevenPos = src.lastIndexOf('7'); // Last 7 in the string
  assert.ok(indices.includes(sevenPos), 'Should include position of 7 in [7]');
});

test('findNumericValueIndicesAtDepth: excludes tagged pips like r', () => {
  const src = '[r, 1, 2, r, 3]';
  const indices = findNumericValueIndicesAtDepth(src, 0);
  // Should only find 1, 2, 3 (not r)
  assert.equal(indices.length, 3);
  assert.ok(indices.includes(src.indexOf('1')));
  assert.ok(indices.includes(src.indexOf('2')));
  assert.ok(indices.includes(src.indexOf('3')));
  assert.ok(!indices.some(i => src[i] === 'r'));
});

test('findNumericValueIndicesAtDepthOrAbove: includes plain numeric pips', () => {
  const src = '[1, 2] g [3, 4]';
  const indices = findNumericValueIndicesAtDepthOrAbove(src, 1);
  // Should find pips at depth 0 and 1
  assert.ok(indices.length >= 4);
  assert.ok(indices.includes(src.indexOf('1')));
  assert.ok(indices.includes(src.indexOf('2')));
  assert.ok(indices.includes(src.indexOf('3')));
  assert.ok(indices.includes(src.indexOf('4')));
});

test('findNumericValueIndicesAtDepth: plain pips mixed with ranges', () => {
  const src = '[1, 2->5, 7]';
  const indices = findNumericValueIndicesAtDepth(src, 0);
  // Should find plain pip 1, 7, and range endpoints 2, 5
  assert.equal(indices.length, 4);
  assert.ok(indices.includes(src.indexOf('1')));
  assert.ok(indices.includes(src.indexOf('2')));
  assert.ok(indices.includes(src.indexOf('5')));
  assert.ok(indices.includes(src.indexOf('7')));
});

test('findNumericValueIndicesAtDepth: plain pips with timescales', () => {
  const src = '[1|2, 3|4, 5]';
  const indices = findNumericValueIndicesAtDepth(src, 0);
  // Should find the step values (1, 3, 5) not the timescales
  assert.equal(indices.length, 3);
  assert.ok(indices.includes(src.indexOf('1')));
  assert.ok(indices.includes(src.indexOf('3')));
  assert.ok(indices.includes(src.indexOf('5')));
});
