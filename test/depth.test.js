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
  const src = '([0, 1, 2] -2 _) * [3] : 5';
  const ds = motDepths(src);
  // RepeatByCount evaluates to Mul, creating nested structure:
  // (inner_mul) * zero-mot, where inner_mul = ([0,1,2] -2 _) * [3]
  assert.deepEqual(ds, [
    { str: '[0, 1, 2]', depth: 2 },
    { str: '[3]', depth: 2 },
    { str: '[0, 0, 0, 0, 0]', depth: 1 },
  ]);
});

test('height from leaves: chain has height 2', () => {
  const src = '[0] * [1] ^ [2]';
  const h = computeHeightFromLeaves(src);
  assert.equal(h, 2);
});

test('indices at depth: numeric-only detection with concat returns source starts', () => {
  const src = '[0, 1] * [2], [r, 3, ?]';
  // Compute expected starts by direct string search
  const pos0 = src.indexOf('0');
  const pos1 = src.indexOf('1');
  const pos2 = src.indexOf('2]'); // use the digit 2 in the second mot
  const pos3 = src.indexOf('3');
  assert.ok(pos0 >= 0 && pos1 > pos0 && pos2 > pos1 && pos3 > pos2);
  // Depth 1: flattened indices from both mots
  assert.deepEqual(findNumericValueIndicesAtDepth(src, 1), [pos0, pos1, pos2]);
  // Depth 0: flattened indices from trailing mot
  assert.deepEqual(findNumericValueIndicesAtDepth(src, 0), [pos3]);
});

test('indices at depth or above: aggregates depth 1 and 0 layers', () => {
  const src = '[0, 1] * [2], [r, 3, ?]';
  const pos0 = src.indexOf('0');
  const pos1 = src.indexOf('1');
  const pos2 = src.indexOf('2]') - 0;
  const pos3 = src.indexOf('3');
  const out = findNumericValueIndicesAtDepthOrAbove(src, 1);
  // Should include all indices: first two mots (depth 1) and last (depth 0)
  assert.deepEqual(out, [pos0, pos1, pos2, pos3]);
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
  const src = 'foo = [0, 1] * [2]\nbar = foo * [3]';
  const ds = motDepths(src); // from final statement
  // Leaves in order: [0,1] (depth 2), [2] (depth 2), [3] (depth 1)
  assert.deepEqual(ds, [
    { str: '[0, 1]', depth: 2 },
    { str: '[2]', depth: 2 },
    { str: '[3]', depth: 1 },
  ]);
  const h = computeHeightFromLeaves(src);
  assert.equal(h, 2);
  // Source positions at depth 2: flattened [pos0, pos1, pos2] from the first line
  const pos0 = src.indexOf('0');
  const pos1 = src.indexOf('1');
  const pos2 = src.indexOf('2]') - 0; // digit '2' in first line
  assert.deepEqual(findNumericValueIndicesAtDepth(src, 2), [pos0, pos1, pos2]);
});


