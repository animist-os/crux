import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/index.js'; // Load the module to set up golden global

const {
  computeMotDepthsFromRoot,
  computeHeightFromLeaves,
  findNumericValueIndicesAtDepth,
  findNumericValueIndicesAtDepthOrAbove,
} = golden;

function motDepths(source, options) {
  return computeMotDepthsFromRoot(source, options).map(({ mot, depth }) => ({ str: mot.toString(), depth }));
}

test('depths: simple multiplication', () => {
  const src = '[0, 1] * [2]';
  const ds = motDepths(src);
  // Expect two leaves, both depth 1
  assert.deepEqual(ds, [
    { str: '[0, 1]', depth: 1 },
    { str: '[2]', depth: 1 },
  ]);
});

test('depths: left-associative chain [0] * [1] ^ [2]', () => {
  const src = '[0] * [1] ^ [2]';
  const ds = motDepths(src);
  // ([0]*[1]) ^ [2] => [0] and [1] at depth 2, [2] at depth 1
  assert.deepEqual(ds, [
    { str: '[0]', depth: 2 },
    { str: '[1]', depth: 2 },
    { str: '[2]', depth: 1 },
  ]);
});

test('concatenation does not increase depth', () => {
  const src = '[0] * [1], [2]';
  const ds = motDepths(src);
  assert.deepEqual(ds, [
    { str: '[0]', depth: 1 },
    { str: '[1]', depth: 1 },
    { str: '[2]', depth: 0 },
  ]);
});

test('postfix :N multiplies zero-mot and does not affect binary depth', () => {
  const src = '([0, 1, 2] -2 …) * [3] : 5';
  const ds = motDepths(src);
  // With corrected precedence, : binds tighter than *, so this parses as:
  // ([0, 1, 2] -2 …) * ([3] : 5)
  // The :5 creates a Mul of [3] with zero-mot, both at depth 2 under the outer *
  assert.deepEqual(ds, [
    { str: '[0, 1, 2]', depth: 1 },
    { str: '[3]', depth: 2 },
    { str: '[0, 0, 0, 0, 0]', depth: 2 },
  ]);
});

test('height from leaves: chain has height 2', () => {
  const src = '[0] * [1] ^ [2]';
  const h = computeHeightFromLeaves(src);
  assert.equal(h, 2);
});

test('indices at depth: numeric-only detection with concat returns range endpoints', () => {
  const src = '[0->1, {2,3}] * [4->5], [r, {6,7,8}]';
  // Compute expected starts by direct string search
  const pos0 = src.indexOf('0');
  const pos1 = src.indexOf('1');
  const pos2 = src.indexOf('2');
  const pos3 = src.indexOf('3');
  const pos4 = src.indexOf('4');
  const pos5 = src.indexOf('5');
  const pos6 = src.indexOf('6');
  const pos7 = src.indexOf('7');
  const pos8 = src.indexOf('8');
  // Depth 1: flattened indices from both mots (ranges and random choices)
  assert.deepEqual(findNumericValueIndicesAtDepth(src, 1), [pos0, pos1, pos2, pos3, pos4, pos5]);
  // Depth 0: flattened indices from trailing mot (random choice only)
  assert.deepEqual(findNumericValueIndicesAtDepth(src, 0), [pos6, pos7, pos8]);
});

test('indices at depth or above: aggregates depth 1 and 0 layers', () => {
  const src = '[0->1, {2,3}] * [4->5], [r, {6,7}]';
  const pos0 = src.indexOf('0');
  const pos1 = src.indexOf('1');
  const pos2 = src.indexOf('2');
  const pos3 = src.indexOf('3');
  const pos4 = src.indexOf('4');
  const pos5 = src.indexOf('5');
  const pos6 = src.indexOf('6');
  const pos7 = src.indexOf('7');
  const out = findNumericValueIndicesAtDepthOrAbove(src, 1);
  // Should include all indices: first two mots (depth 1) and last (depth 0)
  assert.deepEqual(out, [pos0, pos1, pos2, pos3, pos4, pos5, pos6, pos7]);
});

test('indices include endpoints of a range inside a mot', () => {
  const src = '[1 -> -2,2,3, 5]';
  const idxs = findNumericValueIndicesAtDepthOrAbove(src, 0);
  // Expect the positions of the two range endpoints '1' and '-2'
  const a = src.indexOf('1');
  const b = src.indexOf('-2');
  assert.ok(idxs.includes(a), 'Missing start index of range');
  assert.ok(idxs.includes(b), 'Missing end index of range');
});

test('indices include numeric entries inside curly choice', () => {
  const src = '[{4,8},2,3, 5]';
  const idxs = findNumericValueIndicesAtDepthOrAbove(src, 0);
  const p4 = src.indexOf('4');
  const p8 = src.indexOf('8');
  assert.ok(idxs.includes(p4), 'Missing index of 4 in curly');
  assert.ok(idxs.includes(p8), 'Missing index of 8 in curly');
});

test('references inline for depth and height by default', () => {
  const src = 'foo = [0->1, {2,3}] * [4->5]\nbar = foo * [{6,7}]';
  const leaves = computeMotDepthsFromRoot(src); // from final statement
  // Leaves in order: [0->1, {2,3}] (depth 2), [4->5] (depth 2), [{6,7}] (depth 1)
  assert.equal(leaves.length, 3);
  assert.equal(leaves[0].depth, 2);
  assert.equal(leaves[1].depth, 2);
  assert.equal(leaves[2].depth, 1);

  const h = computeHeightFromLeaves(src);
  assert.equal(h, 2);
  // Source positions at depth 2: flattened from the first line
  const pos0 = src.indexOf('0');
  const pos1 = src.indexOf('1');
  const pos2 = src.indexOf('2');
  const pos3 = src.indexOf('3');
  const pos4 = src.indexOf('4');
  const pos5 = src.indexOf('5');
  assert.deepEqual(findNumericValueIndicesAtDepth(src, 2), [pos0, pos1, pos2, pos3, pos4, pos5]);
});


