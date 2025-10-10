import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/index.js'; // Load the module to set up golden global

const { CruxProgramInfo } = golden;

test('CruxProgramInfo - simple mot', () => {
  const info = CruxProgramInfo('[0, 1, 2, 3]');
  assert.equal(info.pip_count, 4);
  assert.equal(info.pip_depth, 0);
  assert.equal(info.duration, 4);
});

test('CruxProgramInfo - mot with timescales', () => {
  const info = CruxProgramInfo('[0 | 2, 1 | /2, 2]');
  assert.equal(info.pip_count, 3);
  assert.equal(info.pip_depth, 0);
  assert.equal(info.duration, 3.5); // 2 + 0.5 + 1
});

test('CruxProgramInfo - binary operation (mul)', () => {
  const info = CruxProgramInfo('[0, 1] * [2, 3]');
  // Two leaf mots at depth 1, each with 2 pips = 4 total
  assert.equal(info.pip_count, 4);
  assert.equal(info.pip_depth, 1);
  // Bottom-most mots are both at depth 1, first one encountered: [0,1] or [2,3]
  assert.ok(info.duration === 2 || info.duration === 2);
});

test('CruxProgramInfo - nested operations', () => {
  const info = CruxProgramInfo('([0, 1] * [2, 3]) ^ [4, 5]');
  // Depth 2: [0,1], [2,3], [4,5] = 6 pips total
  assert.equal(info.pip_count, 6);
  assert.equal(info.pip_depth, 2);
  // Bottom-most mots at depth 2 have 2 pips each with unit duration
  assert.equal(info.duration, 2);
});

test('CruxProgramInfo - with variable assignment', () => {
  const info = CruxProgramInfo('A = [0, 1]\nB = [2, 3]\nA * B');
  assert.equal(info.pip_count, 4);
  assert.equal(info.pip_depth, 1);
  assert.equal(info.duration, 2);
});

test('CruxProgramInfo - complex expression', () => {
  const info = CruxProgramInfo('[0, 1, 2] * [3, 4] ^ [5, 6, 7]');
  // Two leaf mots at depth 2: [3,4], [5,6,7] = 5 pips
  // [0,1,2] is at depth 1 as child of Mul = 3 pips
  // Total = 8 pips
  assert.equal(info.pip_count, 8);
  assert.equal(info.pip_depth, 2);
  // Bottom-most at depth 2, either [3,4] or [5,6,7]
  assert.ok(info.duration === 2 || info.duration === 3);
});

test('CruxProgramInfo - single pip', () => {
  const info = CruxProgramInfo('[5]');
  assert.equal(info.pip_count, 1);
  assert.equal(info.pip_depth, 0);
  assert.equal(info.duration, 1);
});

test('CruxProgramInfo - concatenation maintains depth', () => {
  const info = CruxProgramInfo('[0, 1], [2, 3]');
  // Concatenation doesn't increase depth (excludeConcat=true by default)
  assert.equal(info.pip_count, 4);
  assert.equal(info.pip_depth, 0);
  // Duration of first mot at depth 0
  assert.equal(info.duration, 2);
});

test('CruxProgramInfo - repeat operator', () => {
  const info = CruxProgramInfo('[1, 2] : 3');
  // [1,2] and a zero-mot [0,0,0] = 5 pips total
  assert.equal(info.pip_count, 5);
  assert.equal(info.pip_depth, 1); // RepeatByCount creates implicit Mul with depth
  // Bottom-most at depth 1, could be [1,2] (duration 2) or zero-mot [0,0,0] (duration 3)
  assert.ok(info.duration === 2 || info.duration === 3);
});
