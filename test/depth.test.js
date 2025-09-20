import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeMotDepthsFromRoot,
  computeHeightFromLeaves,
  findNumericValueIndicesAtDepth,
} from '../src/index.js';

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

test('postfix repeat and slice do not affect binary depth', () => {
  const src = '([0, 1, 2] -2 _) * [3] : 5';
  const ds = motDepths(src);
  assert.deepEqual(ds, [
    { str: '[0, 1, 2]', depth: 1 },
    { str: '[3]', depth: 1 },
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
  // Depth 1: two mots => positions [[pos0,pos1], [pos2]]
  assert.deepEqual(findNumericValueIndicesAtDepth(src, 1), [[pos0, pos1], [pos2]]);
  // Depth 0: trailing mot => positions [[pos3]]
  assert.deepEqual(findNumericValueIndicesAtDepth(src, 0), [[pos3]]);
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
  // Source positions at depth 2: [[pos0,pos1], [pos2]] from the first line
  const pos0 = src.indexOf('0');
  const pos1 = src.indexOf('1');
  const pos2 = src.indexOf('2]') - 0; // digit '2' in first line
  assert.deepEqual(findNumericValueIndicesAtDepth(src, 2), [[pos0, pos1], [pos2]]);
});


