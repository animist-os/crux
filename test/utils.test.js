import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/index.js'; // Load the module to set up golden global

const {
  findAllTimescaleIndices,
  findNumericValueIndicesAtDepth,
  findNumericValueIndicesAtDepthOrAbove,
  computeMotDepthsFromRoot,
  computeHeightFromLeaves,
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
