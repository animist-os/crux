import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/index.js';

function evalToString(input) {
  const prog = parse(input);
  const value = prog.interp();
  return value.toString();
}

test('absolute motif with commas', () => {
  assert.equal(evalToString('[0, 1, 2, 3]'), '[0, 1, 2, 3]');
});

// delta motif removed: semicolons have no meaning now

test('timeScale with underscore (plain number)', () => {
  assert.equal(evalToString('[0, 1_2]'), '[0, 1_2]');
});

test('timeScale with underscore (fraction)', () => {
  // 1/4 becomes 0.25 in toString
  assert.equal(evalToString('[0, 1_1/4]'), '[0, 1_0.25]');
});

test('range expands inclusively', () => {
  assert.equal(evalToString('[0->3]'), '[0, 1, 2, 3]');
  assert.equal(evalToString('[3->1]'), '[3, 2, 1]');
});

test('repeat sugar N: Expr (with and without spaces)', () => {
  assert.equal(evalToString('3:[1]'), '[1, 1, 1]');
  assert.equal(evalToString('3 : [1]'), '[1, 1, 1]');
});

test('followed-by concat via comma between Expr', () => {
  assert.equal(evalToString('[0, 1], [2, 3]'), '[0, 1, 2, 3]');
});

test.skip('juxtaposition concat between Expr', () => {
  assert.equal(evalToString('[0, 1] [2, 3]'), '[0, 1, 2, 3]');
});

test('mul combines steps and respects reverse when right has negative timeScale', () => {
  assert.equal(evalToString('[1, 2, 3] * [0_-1]'), '[3, 2, 1]');
});

test('expand multiplies steps elementwise', () => {
  assert.equal(evalToString('[1, 2] ^ [2]'), '[2, 4]');
});

test('dot pairs left with tiled right (numeric only)', () => {
  assert.equal(evalToString('[0, 1, 2] . [10, 20]'), '[10, 21, 12]');
});

test('parens for grouping (expand then add identity)', () => {
  assert.equal(evalToString('([0, 1] ^ [2]) * [0]'), '[0, 2]');
});

test('assignment and reference', () => {
  const program = 'A = [0, 1]\nA, [2]';
  assert.equal(evalToString(program), '[0, 1, 2]');
});

test('assignment then later expression with juxtaposition disabled across newline', () => {
  const program = 'A = [0, 1]\nA * A';
  assert.equal(evalToString(program), '[0, 1, 1, 2]');
});

test('choice picks one of the options', () => {
  const out = evalToString('[0 | 1 | 2]');
  // Should be a single element motif with one of 0,1,2
  assert.match(out, /^\[(0|1|2)\]$/);
});

test('special symbols stringify with tag prefix', () => {
  assert.equal(evalToString('[_]'), '[:_0]');
});

test('roman degrees parse and stringify', () => {
  const out = evalToString('[i, ii, iii, iv, v, vi, vii]');
  // stringify as roman tokens (degree pips)
  assert.equal(out, '[i, ii, iii, iv, v, vi, vii]');
});

test('degree add via * with numeric', () => {
  assert.equal(evalToString('[i, ii] * [1]'), '[ii, iii]');
});

test.skip('degree mul via ^ with numeric', () => {
  assert.equal(evalToString('[ii] ^ [2]'), '[iv]');
});

// delta form removed; mixed case adjusted accordingly (no semicolons)

// Segment (slice/rotate) tests
test('segment: slice with negative start and end', () => {
  assert.equal(evalToString('[0, 1, 2, 3, 4] {-3,-1}'), '[2, 3]');
});

test('segment: slice with start only to end', () => {
  assert.equal(evalToString('[0, 1, 2, 3, 4] {1,}'), '[1, 2, 3, 4]');
});

test('rotate operator ~ applies right rotations per right motif', () => {
  assert.equal(evalToString('[0, 1, 2, 3] ~ [-1]'), '[3, 0, 1, 2]');
  assert.equal(evalToString('[0, 1, 2, 3] ~ [1, 2]'), '[1, 2, 3, 0, 2, 3, 0, 1]');
});


