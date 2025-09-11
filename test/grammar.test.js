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

test('delta motif with semicolons', () => {
  assert.equal(evalToString('[0; 1; 1; -2]'), '[0, 1, 2, 0]');
});

test('delta motif preserves timeScale on items', () => {
  // first value has timescale 2, deltas add steps cumulatively
  assert.equal(evalToString('[0:2; 1; 1]'), '[0:2, 1:2, 2:2]');
});

test('timeScale with colon (plain number)', () => {
  assert.equal(evalToString('[0, 1:2]'), '[0, 1:2]');
});

test('timeScale with colon (fraction)', () => {
  // 1/4 becomes 0.25 in toString
  assert.equal(evalToString('[0, 1:1/4]'), '[0, 1:0.25]');
});

test('range expands inclusively', () => {
  assert.equal(evalToString('[0...3]'), '[0, 1, 2, 3]');
  assert.equal(evalToString('[3...1]'), '[3, 2, 1]');
});

test('repeat sugar N[expr]', () => {
  assert.equal(evalToString('3[1]'), '[1, 1, 1]');
});

test('followed-by concat via comma between Expr', () => {
  assert.equal(evalToString('[0, 1], [2, 3]'), '[0, 1, 2, 3]');
});

test('mul combines steps and respects reverse when right has negative timeScale', () => {
  assert.equal(evalToString('[1, 2, 3] * [0:-1]'), '[3, 2, 1]');
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

test('choice picks one of the options', () => {
  const out = evalToString('[0 | 1 | 2]');
  // Should be a single element motif with one of 0,1,2
  assert.match(out, /^\[(0|1|2)\]$/);
});

test('special symbols stringify with tag prefix', () => {
  assert.equal(evalToString('[_]'), '[:_0]');
});

test('mixed: delta, range, colon timescale together', () => {
  // [0...2] => [0,1,2]; then delta [; 1; -2] relative to last absolute
  assert.equal(evalToString('([0...2]), [0; 1; -2], [3:2]'), '[0, 1, 2, 0, 1, -1, 3:2]');
});


