import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/index.js'; // Load the module to set up golden global

const { parse, findAllTimescaleIndices } = golden;

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

test('implicit multiply sugar after pipe for number', () => {
  assert.equal(evalToString('[3 | 2]'), '[3*2]');
  assert.equal(evalToString('[3 | 3/2]'), '[3*1.5]');
});

test('implicit multiply sugar after pipe for special', () => {
  assert.equal(evalToString('[r | 2]'), '[r*2]');
  assert.equal(evalToString('[r | 4]'), '[r*4]');
});

test('curly before pipe with implicit multiply', () => {
  const out = evalToString('[ {1,2} | 2 ]');
  // Expect either [1*2] or [2*2]
  assert.match(out, /^\[(1\*2|2\*2)\]$/);
});

test('curly before pipe with explicit * randnum', () => {
  // Right randnum picks factor 2 or 4, multiply the duration
  const out = evalToString('[ {1,2} | * {2,4} ]');
  assert.match(out, /^\[(1\*2|1\*4|2\*2|2\*4)\]$/);
});

test('curly before pipe with explicit / randnum', () => {
  const out = evalToString('[ {1,2} | / {2,4} ]');
  // 1/2 or 1/4 timeScale, printed as /2 or /4
  assert.match(out, /^\[(1\/(2|4)|2\/(2|4))\]$/);
});

test('range expands inclusively', () => {
  assert.equal(evalToString('[0->3]'), '[0, 1, 2, 3]');
  assert.equal(evalToString('[3->1]'), '[3, 2, 1]');
});

test('range followed by pipe timescale applies to each element', () => {
  assert.equal(evalToString('[1 -> 4 | 2]'), '[1*2, 2*2, 3*2, 4*2]');
  assert.equal(evalToString('[0 -> 2 | 1/2]'), '[0/2, 1/2, 2/2]');
});

test('range followed by pipe divide with rand or number', () => {
  assert.equal(evalToString('[1 -> 5 | /2]'), '[1/2, 2/2, 3/2, 4/2, 5/2]');
});

test(':N multiplies by a zero-mot of length N', () => {
  // :4 is sugar for * [0,0,0,0]
  const left = evalToString('[1] : 4');
  const right = evalToString('[1] * [0,0,0,0]');
  assert.equal(left, right);
});

test(':N accepts RandNum and resolves per repetition without seed', () => {
  // Random length 2 or 4; replicated twice should be either length 4 or 8
  const out = evalToString('[3,1] : {2,4} : {2,4}');
  const ok = out === evalToString('[3,1] * [0,0] * [0,0]') ||
             out === evalToString('[3,1] * [0,0] * [0,0,0,0]') ||
             out === evalToString('[3,1] * [0,0,0,0] * [0,0]') ||
             out === evalToString('[3,1] * [0,0,0,0] * [0,0,0,0]');
  assert.ok(ok, 'Unexpected :{..} expansion: ' + out);
});

test('implicit multiply after pipe still parses with whitespace', () => {
  assert.equal(evalToString('[3 | 2]'), '[3*2]');
  assert.equal(evalToString('[3|2]'), '[3*2]');
  assert.equal(evalToString('[3 | 3/2]'), '[3*1.5]');
});

test('repeat postfix Expr : N multiplies zero-mot (with and without spaces)', () => {
  assert.equal(evalToString('[1] : 4'), evalToString('[1] * [0,0,0,0]'));
  assert.equal(evalToString('[1]  :  4'), evalToString('[1] * [0,0,0,0]'));
});

test('followed-by concat via comma between Expr', () => {
  assert.equal(evalToString('[0, 1], [2, 3]'), '[0, 1, 2, 3]');
});

test('comma concat between Expr', () => {
  assert.equal(evalToString('[0, 1], [2, 3]'), '[0, 1, 2, 3]');
});

test('adjacency does not cross newlines', () => {
  const program = '[0, 1]\n[2, 3]';
  assert.equal(evalToString(program), '[2, 3]');
});

test('trailing blank line is ignored', () => {
  const program = '[0, r, 1, 2]\n';
  assert.equal(evalToString(program), '[0, r, 1, 2]');
});

test('mul combines steps and respects reverse when right has negative timeScale', () => {
  assert.equal(evalToString('[1, 2, 3] * [0 | -1]'), '[3, 2, 1]');
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

// neighbor and anticip operators removed

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

test('tie postfix merges equal steps by adding timeScale', () => {
  assert.equal(evalToString('[0, 0 | /2, 0 | /2, 1] t'), '[0*2, 1]');
});

test('tie tile uses mask to allow merging forward', () => {
  // mask nonzero allows merge at those boundaries
  assert.equal(evalToString('[0 | /2, 0 | /2, 0 | /2, 1] .t [1]'), '[0*1.5, 1]');
});

test('jam spread replaces values with RHS, one block per RHS value', () => {
  assert.equal(evalToString('[0,1,2,3] j [7]'), '[7, 7, 7, 7]');
  assert.equal(evalToString('[0,1,2,3] j [0, 7]'), '[0, 0, 0, 0, 7, 7, 7, 7]');
});

test('jam tile replaces per-position using tiled RHS', () => {
  assert.equal(evalToString('[0,1,2,3] .j [0, 7]'), '[0, 7, 0, 7]');
});

test('jam pass-through via pipe marker in RHS', () => {
  assert.equal(evalToString('[0,1,2,3] j [ | , 7]'), '[0, 1, 2, 3, 7, 7, 7, 7]');
  assert.equal(evalToString('[0,1,2,3] .j [ | , 7]'), '[0, 7, 2, 7]');
});

test('constraint keeps where mask nonzero (no special x tag)', () => {
  assert.equal(evalToString('[0, 1, 2, 3] c [1, 0, 1, 0]'), '[0, 2]');
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
  // choose from 0..2 then build range -1 -> k (inclusive)
  const out = evalToString('[-1 -> {0, 1, 2}]');
  // Accept k ∈ {0,1,2}: [-1], [-1,0], [-1,0,1], or [-1,0,1,2]
  assert.match(out, /^\[(\-1|\-1, 0|\-1, 0, 1|\-1, 0, 1, 2)\]$/);
});

test('jam can reset durations via pass-through with timeScale', () => {
  assert.equal(evalToString('[0 | 2, 1 | /4, 2] j [|]'), '[0, 1, 2]');
  assert.equal(evalToString('[0, 1 | /3, 2 | *5] j [| /2]'), '[0/2, 1/2, 2/2]');
});

test('parens for grouping (expand then add identity)', () => {
  assert.equal(evalToString('([0, 1] ^ [2]) * [0]'), '[0, 2]');
});

test('assignment and reference', () => {
  const program = 'A = [0, 1]\nA, [2]';
  assert.equal(evalToString(program), '[0, 1, 2]');
});

test('operator alias statement and usage', () => {
  const program = 'splay = *\n[0,1] splay [1,2,3]';
  const aliased = evalToString(program);
  const baseline = evalToString('[0,1] * [1,2,3]');
  assert.equal(aliased, baseline);
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

test('curly refs choose a mot by name and inline it', () => {
  const program = 'A = [0, 1]\nB = [3, 4]\nC = [{A,B}]\nC';
  const out = evalToString(program);
  assert.match(out, /^\[(0, 1|3, 4)\]$/);
});

test('curly refs followed by :N multiplies by zero-mot', () => {
  const out = evalToString('A = [0, 1]\nB = [3, 4]\n[{A,B}]:4');
  // Accept re-rolling per repetition: any sequence of four pairs, each pair either [0,1] or [3,4]
  const pairStr = (a, b) => `[${a}, ${b}]`;
  const pairs = [[0,1],[3,4]];
  const options = [];
  for (const p1 of pairs) for (const p2 of pairs) for (const p3 of pairs) for (const p4 of pairs) {
    const seq = `[${[...p1, ...p2, ...p3, ...p4].join(', ')}]`;
    options.push(seq);
  }
  assert.ok(options.includes(out), 'Unexpected curly ref :N result: ' + out);
});

// '_' tag removed

test('rest special accepts timeScale via pipe using / (fraction)', () => {
  assert.equal(evalToString('[0, r | /2, 1]'), '[0, r/2, 1]');
});

test('rest special accepts timeScale via pipe with spaces', () => {
  assert.equal(evalToString('[0, r |  /  2 , 1]'), '[0, r/2, 1]');
});

// legacy special * form removed; use pipe instead
test('rest special accepts timeScale via pipe', () => {
  assert.equal(evalToString('[r | 2]'), '[r*2]');
});

test('findAllTimescaleIndices finds timescale literals across forms', () => {
  const src = '[0 | 2, 1 | /4, 2 | 3/2, 3 | * {2,4}, 4 | / {2,4}, {1,2} | 2, r | 3]';
  const idxs = findAllTimescaleIndices(src);
  // Should include the starts of: 2 (in *2), 4 (in /4), 3 and 2 (in 3/2),
  // 2 and 4 in curly after *, 2 and 4 in curly after /, 2 after pipe implicit, and 3 after pipe for special
  const expectedTokens = ['2', '4', '3', '2', '2', '4', '2', '4', '2', '3'];
  for (const tok of expectedTokens) {
    assert.ok(idxs.some(i => src.slice(i).startsWith(tok)), 'Missing timescale token: ' + tok);
  }
});

test('chained :N multiplies zero-mots and associates left', () => {
  const result = evalToString('[-1, 0] * [0, -1] :2 :4');
  const expected = evalToString('[-1, 0] * [0, -1] * [0, 0] * [0, 0, 0, 0]');
  assert.equal(result, expected, 'Chained :N should multiply by zero-mots');
});

test('chained :N on simple Mot replicates then replicates again', () => {
  const result = evalToString('[3,1] :2 :3');
  const expected = evalToString('[3,1] * [0,0] * [0,0,0]');
  assert.equal(result, expected);
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

test('slice end is randomly chosen from curly list', () => {
  // [0->8] expands to [0,1,2,3,4,5,6,7,8]; slicing 3..{5,7} with exclusive end yields [3,4] or [3,4,5,6]
  const out = evalToString('[0 -> 8] 3 _ {5,7}');
  assert.ok(out === '[3, 4]' || out === '[3, 4, 5, 6]', 'Unexpected slice: ' + out);
});

test('rotate operator ~ applies right rotations per right mot', () => {
  assert.equal(evalToString('[0, 1, 2, 3] ~ [-1]'), '[3, 0, 1, 2]');
  assert.equal(evalToString('[0, 1, 2, 3] ~ [1, 2]'), '[1, 2, 3, 0, 2, 3, 0, 1]');
});

test('bare Curly as PriExpr works in operators', () => {
  // rotate by 1 or 2
  const out = evalToString('[0,1,2,3] ~ {1,2}');
  assert.ok(out === '[1, 2, 3, 0]' || out === '[2, 3, 0, 1]', 'Unexpected rotate: ' + out);
  // note: neighbor operator removed
});


// ---- Nested mots ----

test('nested mot basic flattening', () => {
  assert.equal(evalToString('[[0,1]]'), '[0/2, 1/2]');
  assert.equal(evalToString('[[0,1,2]]'), '[0/3, 1/3, 2/3]');
  assert.equal(evalToString('[[0,1,2,3]]'), '[0/4, 1/4, 2/4, 3/4]');
});

test('nested mot with explicit timescales', () => {
  assert.equal(evalToString('[[0, 1 | 2]]'), '[0/2, 1]');
  assert.equal(evalToString('[[0 | /4, 1]]'), '[0/8, 1/2]');
  assert.equal(evalToString('[[0 | 3, 1 | /2]]'), '[0*1.5, 1/4]');
});

test('nested mot with fractions and pipe-only', () => {
  // 3/4 * 1/2 = 3/8 => prints as *0.375
  assert.equal(evalToString('[[0, 1 | 3/4]]'), '[0/2, 1*0.375]');
  assert.equal(evalToString('[[0, | 2]]'), '[0/2, 0]');
  assert.equal(evalToString('[[| 3, 1]]'), '[0*1.5, 1/2]');
  assert.equal(evalToString('[[|, | /4]]'), '[0/2, 0/8]');
});

test('concat and juxtaposition with nested mots', () => {
  assert.equal(evalToString('[[0,1]], [2]'), '[0/2, 1/2, 2]');
  assert.equal(evalToString('[2], [[0,1]]'), '[2, 0/2, 1/2]');
  assert.equal(evalToString('[[0,1]], [2], [[3,4]]'), '[0/2, 1/2, 2, 3/2, 4/2]');
  // Juxtaposition removed; only comma concatenation is supported
});

test('nested within nested', () => {
  assert.equal(evalToString('[[[0,1], 2]]'), '[0/3, 1/3, 2/3]');
  assert.equal(evalToString('[[[0,1]], 2]'), '[0/2, 1/2, 2]');
});

test('spread operations with nested mots', () => {
  const a = evalToString('([ [0,1] ], 2) * [1,2]');
  const b = evalToString('[0 | /2, 1 | /2, 2] * [1,2]');
  assert.equal(a, b);
  const c = evalToString('[1,2] * ([ [0,1] ], 2)');
  const d = evalToString('[1,2] * [0 | /2, 1 | /2, 2]');
  assert.equal(c, d);
});

test('nested with tags and ranges', () => {
  assert.equal(evalToString('[[0, r]]'), '[0/2, r/2]');
  assert.equal(evalToString('[[0->2]]'), '[0/3, 1/3, 2/3]');
});

test('parse basic bang avoid', () => {
  const out = evalToString('[!{0,6}]');
  assert.equal(out, '[!{0,6}]');
});

test('bang avoid with pipe timescale', () => {
  assert.equal(evalToString('[!{0,6} | 2]'), '[!{0,6}*2]');
  assert.equal(evalToString('[!{0,6} | /2]'), '[!{0,6}/2]');
});

test('bang avoid in mul on right', () => {
  assert.equal(evalToString('[3] * [ !{0,6} ]'), '[!{0,6} + 3]');
});

test('bang avoid combine both sides', () => {
  assert.equal(evalToString('[ !{0,6} ] * [ !{3,7} ]'), '[!{0,3,6,7}]');
});

test('bang avoid in expand', () => {
  assert.equal(evalToString('[ !{0,6} ] ^ [2]'), '[!{0,6}]');
});

test('bang avoid parse fails on non-number interval', () => {
  assert.throws(() => parse('[!{0,a}]'), /digit/);
});


test('identifier inside mot literal subdivides referenced motif', () => {
  const program = [
    'ef = [2,3]',
    'inc01 = [2,2,2]',
    'inc02 = [ef,2]',
    'inc03 = [r |/2, ef, 2 |/2]',
    'inc02',
  ].join('\n');
  // ef = [2,3] so [ef,2] should subdivide ef: [2/2, 3/2, 2]
  assert.equal(evalToString(program), '[2/2, 3/2, 2]');
});


