import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/index.js';

function evalToString(input) {
  const prog = parse(input);
  const value = prog.interp();
  return value.toString();
}

test('absolute mot with commas', () => {
  assert.equal(evalToString('[0, 1, 2, 3]'), '[0, 1, 2, 3]');
});

// delta mot removed: semicolons have no meaning now

test('timeScale using * (plain number)', () => {
  assert.equal(evalToString('[0, 1 | * 2]'), '[0, 1*2]');
});

test('timeScale using / (fraction)', () => {
  // 1/4 prints as /4 form
  assert.equal(evalToString('[0, 1 | / 4]'), '[0, 1/4]');
});

test('range expands inclusively', () => {
  assert.equal(evalToString('[0->3]'), '[0, 1, 2, 3]');
  assert.equal(evalToString('[3->1]'), '[3, 2, 1]');
});

test('repeat postfix Expr : N (with and without spaces)', () => {
  assert.equal(evalToString('[1] : 3'), '[1, 1, 1]');
  assert.equal(evalToString('[1]  :  3'), '[1, 1, 1]');
});

test('followed-by concat via comma between Expr', () => {
  assert.equal(evalToString('[0, 1], [2, 3]'), '[0, 1, 2, 3]');
});

test('juxtaposition concat between Expr', () => {
  assert.equal(evalToString('[0, 1] [2, 3]'), '[0, 1, 2, 3]');
});

test('adjacency does not cross newlines', () => {
  const program = '[0, 1]\n[2, 3]';
  assert.equal(evalToString(program), '[2, 3]');
});

test('trailing blank line is ignored', () => {
  const program = '[0, r, 1, 2]\n';
  assert.equal(evalToString(program), '[0, :r0, 1, 2]');
});

test('mul combines steps and respects reverse when right has negative timeScale', () => {
  assert.equal(evalToString('[1, 2, 3] * [0 * -1]'), '[3, 2, 1]');
});

test('expand multiplies steps elementwise', () => {
  assert.equal(evalToString('[1, 2] ^ [2]'), '[2, 4]');
});

test('dot pairs left with tiled right (numeric only)', () => {
  assert.equal(evalToString('[0, 1, 2] . [10, 20]'), '[10, 21, 12]');
});

test('dotStar alias pairs left with tiled right', () => {
  assert.equal(evalToString('[0, 1, 2] .* [10, 20]'), '[10, 21, 12]');
});

test('dotExpand tiles right and multiplies steps', () => {
  assert.equal(evalToString('[1, 2] .^ [2]'), '[2, 4]');
});

test('steps spread operator builds columnar runs', () => {
  assert.equal(evalToString('[0, 3] -> [4]'), '[0, 3, 1, 4, 2, 5, 3, 6, 4, 7]');
});

test('dotSteps tile operator builds per-pip runs', () => {
  assert.equal(evalToString('[0, 3] .-> [4]'), '[0, 1, 2, 3, 4, 3, 4, 5, 6, 7]');
});

test('neighbor spread expands each pip locally', () => {
  assert.equal(evalToString('[0, 3] n [1]'), '[0, 1, 0, 3, 4, 3]');
});

test('neighbor tile inserts per-position neighbor', () => {
  assert.equal(evalToString('[0, 3] .n [1]'), '[0, 3, 1, 4, 0, 3]');
});

test('anticipatory neighbor prepends neighbor then original', () => {
  assert.equal(evalToString('[0] a [-1]'), '[-1, 0]');
});

test('mirror spread around anchor', () => {
  assert.equal(evalToString('[0, 2, 4] m [2]'), '[4, 2, 0]');
});

test('mirror tile per-position', () => {
  assert.equal(evalToString('[0, 2, 4] .m [1]'), '[2, 0, -2]');
});

test('lens spread sliding window size', () => {
  // window size 2: [0,1] [1,2] [2,3]
  assert.equal(evalToString('[0, 1, 2, 3] l [2]'), '[0, 1, 1, 2, 2, 3]');
});

test('lens spread negative size reverses window order', () => {
  assert.equal(evalToString('[0, 1, 2, 3] l [-2]'), '[2, 3, 1, 2, 0, 1]');
});

test('lens tile rolling window per-position', () => {
  // window size 2 starting at each position (wrap)
  assert.equal(evalToString('[0, 1, 2] .l [2]'), '[0, 1, 1, 2, 2, 0]');
});

test('tie spread merges equal steps by adding timeScale', () => {
  assert.equal(evalToString('[0, 0/2, 0/2, 1] t [0]'), '[0*2, 1]');
});

test('tie tile uses mask to allow merging forward', () => {
  // mask nonzero allows merge at those boundaries
  assert.equal(evalToString('[0/2, 0/2, 0/2, 1] .t [1]'), '[0*1.5, 1]');
});

test('constraint keeps where mask nonzero and not x', () => {
  assert.equal(evalToString('[0, 1, 2, 3] c [1, 0, 1, x]'), '[0, 2]');
});

test('random tag bare ? uses default range [-7,7]', () => {
  const out = evalToString('[0, ?, 2]');
  // Expect shape [0, rnd, 2] where rnd integer and |rnd| <= 7
  const m = out.match(/^\[(\-?\d+), (\-?\d+), (\-?\d+)\]$/);
  assert.ok(m, 'Output shape mismatch: ' + out);
  const rnd = parseInt(m[2], 10);
  assert.ok(Number.isInteger(rnd) && rnd >= -7 && rnd <= 7, 'rnd out of range: ' + rnd);
});

test('random ranged a ? b bounds the integer range', () => {
  const out = evalToString('[0, {-2 ? 2}, 3]');
  const m = out.match(/^\[(\-?\d+), (\-?\d+), (\-?\d+)\]$/);
  assert.ok(m, 'Output shape mismatch: ' + out);
  const rnd = parseInt(m[2], 10);
  assert.ok(Number.isInteger(rnd) && rnd >= -2 && rnd <= 2, 'rnd out of range: ' + rnd);
});

test('range endpoints support curly choice', () => {
  // choose from 0..2 then build range -1 -> k
  const out = evalToString('[-1 -> {0, 1, 2}]');
  // Expect one of: [-1], [-1, 0], [-1, 0, 1]
  assert.match(out, /^\[(\-1|\-1, 0|\-1, 0, 1)\]$/);
});

test('filter spread resets all timeScales with T', () => {
  assert.equal(evalToString('[0*2, 1/4, 2] f [T]'), '[0, 1, 2]');
});

test('filter spread resets steps with S', () => {
  assert.equal(evalToString('[0, 1/2, 2/4] f [S]'), '[0, 0/2, 0/4]');
});

test('filter tile per-position T,S masks', () => {
  assert.equal(evalToString('[0*2, 1/4, 2*3] .f [T, S]'), '[0, 0/4, 2*3]');
});

test('filter T/2 sets timeScale to specific value', () => {
  assert.equal(evalToString('[0, 1/3, 2*5] f [T/2]'), '[0/2, 1/2, 2/2]');
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

test('choice picks one of the options (curly)', () => {
  const out = evalToString('[{0, 1, 2}]');
  // Should be a single element mot with one of 0,1,2
  assert.match(out, /^\[(0|1|2)\]$/);
});

// '_' tag removed

test('rest special accepts timeScale using / (fraction)', () => {
  assert.equal(evalToString('[0, r/2, 1]'), '[0, :r0/2, 1]');
});

test('rest special accepts timeScale with spaces around operator', () => {
  assert.equal(evalToString('[0, r / 2, 1]'), '[0, :r0/2, 1]');
});

test('rest special accepts timeScale using * (plain number)', () => {
  assert.equal(evalToString('[r*2]'), '[:r0*2]');
});

// roman degrees removed

test.skip('degree mul via ^ with numeric', () => {
  assert.equal(evalToString('[ii] ^ [2]'), '[iv]');
});

// delta form removed; mixed case adjusted accordingly (no semicolons)

// Segment (slice/rotate) tests
test('slice operator both: start _ end with negatives', () => {
  assert.equal(evalToString('[0, 1, 2, 3, 4] -3 _ -1'), '[2, 3]');
});

test('slice operator startOnly: start _', () => {
  assert.equal(evalToString('[0, 1, 2, 3, 4] 1 _'), '[1, 2, 3, 4]');
});

test('slice operator endOnly: _ end', () => {
  assert.equal(evalToString('[0, 1, 2, 3, 4] _ 3'), '[0, 1, 2]');
});

test('rotate operator ~ applies right rotations per right mot', () => {
  assert.equal(evalToString('[0, 1, 2, 3] ~ [-1]'), '[3, 0, 1, 2]');
  assert.equal(evalToString('[0, 1, 2, 3] ~ [1, 2]'), '[1, 2, 3, 0, 2, 3, 0, 1]');
});


