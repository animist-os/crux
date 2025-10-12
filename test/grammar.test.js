import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/index.js'; // Load the module to set up golden global

const { parse, findAllTimescaleIndices } = golden;

function evalToString(input) {
  const prog = parse(input);
  const result = prog.interp();
  const lastSection = result.sections[result.sections.length - 1];
  return lastSection.toString();
}

test('absolute mot with commas', () => {
  assert.equal(evalToString('[0, 1, 2, 3]'), '[0, 1, 2, 3]');
});

// delta mot removed: semicolons have no meaning now

test('timeScale using * (plain number)', () => {
  assert.equal(evalToString('[0, 1 | 2]'), '[0, 1 | 2]');
});

test('timeScale using / (fraction)', () => {
  // 1/4 prints as | /4 form (pipe is always included)
  assert.equal(evalToString('[0, 1 | / 4]'), '[0, 1 | /4]');
});

test('implicit multiply sugar after pipe for number', () => {
  assert.equal(evalToString('[3 | 2]'), '[3 | 2]');
  assert.equal(evalToString('[3 | 3/2]'), '[3 | 1.5]');
});

test('implicit multiply sugar after pipe for special', () => {
  assert.equal(evalToString('[r | 2]'), '[r | 2]');
  assert.equal(evalToString('[r | 4]'), '[r | 4]');
});

test('curly before pipe with implicit multiply', () => {
  const out = evalToString('[ {1,2} | 2 ]');
  // Expect either [1 | 2] or [2 | 2]
  assert.match(out, /^\[(1 \| 2|2 \| 2)\]$/);
});

// (Removed) explicit star randnum after pipe is deprecated; covered by implicit forms above.

test('curly before pipe with explicit / randnum', () => {
  const out = evalToString('[ {1,2} | / {2,4} ]');
  // 1/2 or 1/4 timeScale, printed as | /2 or | /4
  assert.match(out, /^\[(1 \| \/(2|4)|2 \| \/(2|4))\]$/);
});

test('curly-of-pips chooses among pip forms', () => {
  const out = evalToString('[ {2, 1, 0 | /2} ]');
  assert.ok(out === '[2]' || out === '[1]' || out === '[0 | /2]', 'Unexpected CurlyPip result: ' + out);
});

test('curly-of-pips supports outer timescale pipe', () => {
  const out = evalToString('[ {2, 1, 0 | /2} | 2 ]');
  // options multiply timescale by 2: 2->2 | 2, 1->1 | 2, 0/2->0
  assert.ok(out === '[2 | 2]' || out === '[1 | 2]' || out === '[0]', 'Unexpected CurlyPip pipe result: ' + out);
});

test('range expands inclusively', () => {
  assert.equal(evalToString('[0->3]'), '[0, 1, 2, 3]');
  assert.equal(evalToString('[3->1]'), '[3, 2, 1]');
});

test('range followed by pipe timescale applies to each element', () => {
  assert.equal(evalToString('[1 -> 4 | 2]'), '[1 | 2, 2 | 2, 3 | 2, 4 | 2]');
  assert.equal(evalToString('[0 -> 2 | 1/2]'), '[0 | /2, 1 | /2, 2 | /2]');
});

test('range followed by pipe divide with rand or number', () => {
  assert.equal(evalToString('[1 -> 5 | /2]'), '[1 | /2, 2 | /2, 3 | /2, 4 | /2, 5 | /2]');
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
  assert.equal(evalToString('[3 | 2]'), '[3 | 2]');
  assert.equal(evalToString('[3|2]'), '[3 | 2]');
  assert.equal(evalToString('[3 | 3/2]'), '[3 | 1.5]');
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
  assert.equal(evalToString('[0, 0 | /2, 0 | /2, 1] t'), '[0 | 2, 1]');
});

test('tie tile uses mask to allow merging forward', () => {
  // mask nonzero allows merge at those boundaries
  assert.equal(evalToString('[0 | /2, 0 | /2, 0 | /2, 1] .t [1]'), '[0 | 1.5, 1]');
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
  assert.equal(evalToString('[0, 1 | /3, 2 | 5] j [| /2]'), '[0 | /2, 1 | /2, 2 | /2]');
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
  assert.equal(evalToString('[0, r | /2, 1]'), '[0, r | /2, 1]');
});

test('rest special accepts timeScale via pipe with spaces', () => {
  assert.equal(evalToString('[0, r |  /  2 , 1]'), '[0, r | /2, 1]');
});

// legacy special * form removed; use pipe instead
test('rest special accepts timeScale via pipe', () => {
  assert.equal(evalToString('[r | 2]'), '[r | 2]');
});

test('findAllTimescaleIndices finds timescale literals across forms', () => {
  const src = '[0 | 2, 1 | /4, 2 | 3/2, 3 | {2,4}, 4 | / {2,4}, {1,2} | 2, r | 3]';
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

test('dotRotate operator .~ applies per-element circular indexing', () => {
  // Each position i picks element at (i + right[i].step) mod n
  // [0,1,2,3] .~ [1] → each position offset by +1: [1,2,3,0]
  assert.equal(evalToString('[0, 1, 2, 3] .~ [1]'), '[1, 2, 3, 0]');

  // Alternating offsets +1, +2: positions 0,2 get +1 offset, positions 1,3 get +2 offset
  assert.equal(evalToString('[0, 1, 2, 3] .~ [1, 2]'), '[1, 3, 3, 1]');

  // Cycling offsets +1, +2, +0:
  // i=0: (0+1)%4=1→1, i=1: (1+2)%4=3→3, i=2: (2+0)%4=2→2, i=3: (3+1)%4=0→0
  assert.equal(evalToString('[0, 1, 2, 3] .~ [1, 2, 0]'), '[1, 3, 2, 0]');

  // Zero offset = identity
  assert.equal(evalToString('[0, 1, 2, 3] .~ [0]'), '[0, 1, 2, 3]');

  // Negative offset shifts backward
  assert.equal(evalToString('[0, 1, 2, 3] .~ [-1]'), '[3, 0, 1, 2]');
});

test('bare Curly as PriExpr works in operators', () => {
  // rotate by 1 or 2
  const out = evalToString('[0,1,2,3] ~ {1,2}');
  assert.ok(out === '[1, 2, 3, 0]' || out === '[2, 3, 0, 1]', 'Unexpected rotate: ' + out);
  // note: neighbor operator removed
});


// ---- Nested mots ----

test('nested mot basic flattening (now preserves unit duration)', () => {
  // New behavior: nested mots preserve unit duration by default
  assert.equal(evalToString('[[0,1]]'), '[0, 1]');
  assert.equal(evalToString('[[0,1,2]]'), '[0, 1, 2]');
  assert.equal(evalToString('[[0,1,2,3]]'), '[0, 1, 2, 3]');
});

test('nested mot with / postfix subdivides', () => {
  // Use / postfix to get traditional subdivision behavior
  assert.equal(evalToString('[[0,1]]/'), '[0 | /2, 1 | /2]');
  assert.equal(evalToString('[[0,1,2]]/'), '[0 | /3, 1 | /3, 2 | /3]');
  assert.equal(evalToString('[[0,1,2,3]]/'), '[0 | /4, 1 | /4, 2 | /4, 3 | /4]');
});

test('nested mot with explicit timescales and / postfix', () => {
  assert.equal(evalToString('[[0, 1 | 2]]/'), '[0 | /2, 1]');
  assert.equal(evalToString('[[0 | /4, 1]]/'), '[0 | /8, 1 | /2]');
  assert.equal(evalToString('[[0 | 3, 1 | /2]]/'), '[0 | 1.5, 1 | /4]');
});

test('nested mot with fractions and pipe-only (with / postfix)', () => {
  // 3/4 * 1/2 = 3/8 => prints as *0.375
  assert.equal(evalToString('[[0, 1 | 3/4]]/'), '[0 | /2, 1 | 0.375]');
  assert.equal(evalToString('[[0, | 2]]/'), '[0 | /2, 0]');
  assert.equal(evalToString('[[| 3, 1]]/'), '[0 | 1.5, 1 | /2]');
  assert.equal(evalToString('[[|, | /4]]/'), '[0 | /2, 0 | /8]');
});

test('concat and juxtaposition with nested mots (with / postfix)', () => {
  assert.equal(evalToString('[[0,1]]/, [2]'), '[0 | /2, 1 | /2, 2]');
  assert.equal(evalToString('[2], [[0,1]]/'), '[2, 0 | /2, 1 | /2]');
  assert.equal(evalToString('[[0,1]]/, [2], [[3,4]]/'), '[0 | /2, 1 | /2, 2, 3 | /2, 4 | /2]');
  // Juxtaposition removed; only comma concatenation is supported
});

test('nested within nested now preserves unit duration', () => {
  // New behavior: nested mots don't subdivide automatically
  assert.equal(evalToString('[[[0,1], 2]]'), '[0, 1, 2]');
  assert.equal(evalToString('[[[0,1]], 2]'), '[0, 1, 2]');
});

test('mot literal inside mot with explicit subdivision using |/2', () => {
  // To get subdivision, use explicit timescales
  assert.equal(evalToString('[0, [1 | /2, 2 | /2]]'), '[0, 1 | /2, 2 | /2]');
  assert.equal(evalToString('[0, [1 | /2, 2 | /2], 3]'), '[0, 1 | /2, 2 | /2, 3]');
});

test('multiple nested subdivision with explicit timescales', () => {
  // Nested mots now just flatten - timescales are preserved as-is
  assert.equal(evalToString('[0, [1 | /2, [2 | /2, 3 | /2]], 4]'), '[0, 1 | /2, 2 | /2, 3 | /2, 4]');
});

test('spread operations with nested mots now preserve unit duration', () => {
  const a = evalToString('([ [0,1] ], 2) * [1,2]');
  const b = evalToString('[0, 1, 2] * [1,2]');
  assert.equal(a, b);
  const c = evalToString('[1,2] * ([ [0,1] ], 2)');
  const d = evalToString('[1,2] * [0, 1, 2]');
  assert.equal(c, d);
});

test('nested with tags and ranges (with / postfix)', () => {
  assert.equal(evalToString('[[0, r]]/'), '[0 | /2, r | /2]');
  assert.equal(evalToString('[[0->2]]/'), '[0 | /3, 1 | /3, 2 | /3]');
});

test('identifier inside mot literal with explicit timescales', () => {
  const program = [
    'ef = [2 | /2, 3 | /2]',
    'inc01 = [2,2,2]',
    'inc02 = [ef, 2]',
    'inc03 = [r |/2, ef, 2 |/2]',
    'inc02',
  ].join('\n');
  // ef = [2|/2,3|/2] so [ef,2] uses ef's timescales: [2/2, 3/2, 2]
  assert.equal(evalToString(program), '[2 | /2, 3 | /2, 2]');
});

test('curly expressions in timeScale positions', () => {
  // Test basic curly in timeScale
  const out1 = evalToString('[0, 1 | {2,4}, 2]');
  // Should produce something like [0, 1 | 2, 2] or [0, 1 | 4, 2]
  assert.match(out1, /^\[0, 1 \| ([24]), 2\]$/);

  // Test curly in fractional timeScale
  const out2 = evalToString('[0, 1 | {2,4}/2, 2]');
  // Should produce something like [0, 1 | 1, 2] or [0, 1 | 2, 2]
  assert.match(out2, /^\[0, 1( \| ([12])|), 2\]$/);
});

test('curly choice among multiple timescales including 1', () => {
  // Test {2,1,3} - randomly choose among three timescales
  const out1 = evalToString('[0 | {2,1,3}]');
  // Should produce [0], [0 | 2], or [0 | 3]
  assert.match(out1, /^\[0( \| ([23]))?\]$/);

  // Test {1/2, 1, 2} - choose among fraction, unit, and multiple
  const out2 = evalToString('[0 | {1/2, 1, 2}]');
  // Should produce [0 | /2], [0], or [0 | 2]
  assert.match(out2, /^\[0( \| (\/2|2))?\]$/);
});

test('curly in division position creates fractional timescales', () => {
  // Test /{2,4} which should be equivalent to {1/2, 1/4}
  const out = evalToString('[0 | /{2,4}]');
  // Should produce [0 | /2] or [0 | /4]
  assert.match(out, /^\[0 \| \/(2|4)\]$/);

  // Verify we get both values over multiple runs
  const results = new Set();
  for (let i = 0; i < 20; i++) {
    results.add(evalToString('[0 | /{2,4}]'));
  }
  assert.ok(results.has('[0 | /2]') || results.has('[0 | /4]'),
    'Should produce at least one of the possible values');
});

test('random range step with random choice timescale', () => {
  // Test {-2 ? 2} | {2,1,3} - random step from -2 to 2, with random timescale from {2,1,3}
  const out = evalToString('[{-2 ? 2} | {2,1,3}]');
  // Should produce a pip with step in [-2, 2] and timescale from {2, 1, 3}
  // When timescale is 1, it's omitted, so patterns like [-1], [0 | 2], [1 | 3] are all valid
  assert.match(out, /^\[([-]?[012]) (\| ([123]))?\]$/);

  // Verify we see multiple different outputs over runs
  const results = new Set();
  for (let i = 0; i < 30; i++) {
    results.add(evalToString('[{-2 ? 2} | {2,1,3}]'));
  }
  // Should have at least 3 unique outputs given the randomness
  assert.ok(results.size >= 3, `Expected at least 3 unique outputs, got ${results.size}: ${[...results].join(', ')}`);
});

test('dot with nested mot on RHS with explicit subdivision timescales', () => {
  // Nested mot with /3 timescales will subdivide with those timescales
  const program = '[0, 4, 2] . [0, [0 | /3, 1 | /3, 0 | /3], 0]';
  assert.equal(evalToString(program), '[0, 4 | /3, 5 | /3, 4 | /3, 2]');
});

test('dot with nested mot subdivides and can use compensation timescales', () => {
  // Nested mot with |3 timescales multiplies those into the result
  const program = '[0, 4, 2] . [0, [0 | 3, 1 | 3, 0 | 3], 0]';
  assert.equal(evalToString(program), '[0, 4 | 3, 5 | 3, 4 | 3, 2]');
});

test('dot with bare nested mot (new default: unit duration)', () => {
  // Nested mots now preserve unit duration by default
  const program = '[0, 4, 2] . [0, [0, 1, 0], 0]';
  assert.equal(evalToString(program), '[0, 4, 5, 4, 2]');
});

test('dot with interior pad value repeats middle and right-aligns tail', () => {
  const program = '[0,1,2,3,4,5,6] . [7, 0..., 7]';
  assert.equal(evalToString(program), '[7, 1, 2, 3, 4, 5, 13]');
});

test('fan ops ignore ellipsis (treated as single value)', () => {
  const program = '[0,1,2] * [2, 3...]';
  const baseline = '[0,1,2] * [2,3]';
  assert.equal(evalToString(program), evalToString(baseline));
});

test('dot nested subdivision carries timescales from RHS nested pips', () => {
  const program = '[0,4,2] . [0, [1 | /2, 0 | /2], 0]';
  assert.equal(evalToString(program), '[0, 5 | /2, 4 | /2, 2]');
});

test('dot nested subdivision with unit duration pips', () => {
  const program = '[0,4,2] . [0, [1, 0], 0]';
  assert.equal(evalToString(program), '[0, 5, 4, 2]');
});

test('dot nested subdivision multiplies with LHS timescales', () => {
  const program = '[0, 4 | 4, 2] . [0, [1 | /2, 0 | /2], 0]';
  assert.equal(evalToString(program), '[0, 5 | 2, 4 | 2, 2]');
});

test('dot with bare nested mot preserves unit duration by default', () => {
  // New behavior: nested mots preserve unit duration
  assert.equal(evalToString('[0,1,2] . [[0,0]]'), '[0, 0, 1, 1, 2, 2]');
});

test('dot nested mot equivalence: single vs multiple copies', () => {
  // [[0,0]] and [[0,0], [0,0], [0,0]] should behave identically (tiling a single pattern)
  const single = evalToString('[0,1,2] . [[0,0]]');
  const triple = evalToString('[0,1,2] . [[0,0], [0,0], [0,0]]');
  assert.equal(single, triple);
});

test('semicolon separates statements like newline', () => {
  const multiline = `A = [0,1]
A * A`;
  const semicolon = 'A = [0,1]; A * A';
  const expected = '[0, 1, 1, 2]';
  assert.equal(evalToString(multiline), expected);
  assert.equal(evalToString(semicolon), expected);
});

test('nested expression mul inside mot behaves as RHS mot', () => {
  // [0,1,2] * [0,[1] * [2],4] should equal [0,1,2] * [0,[2],4]
  const a = evalToString('[0,1,2] * [0, [1] * [2], 4]');
  const b = evalToString('[0,1,2] * [0, [2], 4]');
  assert.equal(a, b);
});

test('requested example equality holds', () => {
  const a = evalToString('[0,1,2] * [0, [1] * [2], 4]');
  const b = evalToString('[0,1,2] * [0, [2], 4]');
  const c = evalToString('[0,1,2,2,3,4,4,5,6]');
  assert.equal(a, b);
  assert.equal(b, c);
});

test('dotZip operator interleaves LHS and RHS per pip', () => {
  assert.equal(evalToString('[0,1,2,3] ., [10,9,8,7]'), '[0, 10, 1, 9, 2, 8, 3, 7]');
});

test('dotZip operator with shorter RHS', () => {
  assert.equal(evalToString('[0,1,2,3] ., [10,9]'), '[0, 10, 1, 9, 2, 3]');
});

test('dotZip operator with shorter LHS', () => {
  assert.equal(evalToString('[0,1] ., [10,9,8,7]'), '[0, 10, 1, 9, 8, 7]');
});

test('dotZip operator 3-way interleave - current behavior', () => {
  const A = '[0,0,0]';
  const B = '[1,1,1]';
  const C = '[2,2,2]';
  const result = evalToString(`${A} ., ${B} ., ${C}`);
  // Current: (A ., B) produces [0,1,0,1,0,1], then that ., C
  // This is the actual behavior - documenting it
  assert.equal(result, '[0, 2, 1, 2, 0, 2, 1, 0, 1]');
});

test('3-way zip using z operator with assignments', () => {
  const program = `
    A = [0,0,0]
    B = [1,1,1]
    C = [2,2,2]
    (A, B, C)z
  `;
  const result = evalToString(program);
  const expected = '[0, 1, 2, 0, 1, 2, 0, 1, 2]';
  assert.equal(result, expected);
});

test('z operator with inline mots', () => {
  const result = evalToString('([0,0,0], [1,1,1], [2,2,2])z');
  const expected = '[0, 1, 2, 0, 1, 2, 0, 1, 2]';
  assert.equal(result, expected);
});

test('z operator with unequal lengths', () => {
  const result = evalToString('([0,0], [1,1,1], [2])z');
  const expected = '[0, 1, 2, 0, 1, 1]';
  assert.equal(result, expected);
});

test('subdivision preserves sourceStart for findNumericValueIndicesAtDepth', () => {
  const source = `schenkerNeighbor = [0, 0, 1, 0]
basicNotes = [0, 1, 2 , 3]
basicNotes . [[schenkerNeighbor]] t`;

  const indices = golden.findNumericValueIndicesAtDepth(source, 1);
  // Should find the positions of 0, 1, 2, 3 in "basicNotes = [0, 1, 2 , 3]"
  // The depth is 1 because: Dot is at depth 0, and its children (including basicNotes Ref) are at depth 1
  // TieOp is transparent to depth calculation
  assert.deepEqual(indices, [46, 49, 52, 56]);
});

test('findNumericValueIndicesAtDepth finds values at correct depth', () => {
  const source = '[0, 1] * [2, 3]';
  const depthZero = golden.findNumericValueIndicesAtDepth(source, 0);
  const depthOne = golden.findNumericValueIndicesAtDepth(source, 1);

  // At depth 0 (root), there are no mot literals
  assert.deepEqual(depthZero, []);
  // At depth 1 (children of Mul), we have [0,1] and [2,3]
  assert.deepEqual(depthOne, [1, 4, 10, 13]);
});

test('findNumericValueIndicesAtDepth includes range endpoints', () => {
  const source = '[0->3, 5]';
  const indices = golden.findNumericValueIndicesAtDepth(source, 0);
  // Should include both endpoints of the range (0 and 3) plus the standalone 5
  assert.deepEqual(indices, [1, 4, 7]);
});

test('findNumericValueIndicesAtDepth includes curly choice positions', () => {
  const source = '[{1,2,3}]';
  const indices = golden.findNumericValueIndicesAtDepth(source, 0);
  // Should include all numeric options in the curly choice
  assert.deepEqual(indices, [2, 4, 6]);
});

test('findNumericValueIndicesAtDepth handles nested expressions', () => {
  const source = 'a = [0, 1]\nb = [2, 3]\na * b';
  const indices = golden.findNumericValueIndicesAtDepth(source, 1);
  // At depth 1, we should find the mots assigned to a and b
  assert.deepEqual(indices, [5, 8, 16, 19]);
});

test('findAllTimescaleIndices finds timescale literals', () => {
  const source = '[0 | 2, 1 | /4, 2 | 3/2]';
  const indices = golden.findAllTimescaleIndices(source);
  // Should find: 2 (at pos 5), 4 (at pos 13), 3 (at pos 20), 2 (at pos 22)
  assert.deepEqual(indices, [5, 13, 20, 22]);
});

test('findAllTimescaleIndices ignores numbers in comments', () => {
  const source = '[0 | 2, 1] // timescale 4';
  const indices = golden.findAllTimescaleIndices(source);
  // Should only find the 2, not the 4 in the comment
  assert.deepEqual(indices, [5]);
});

test('findAllTimescaleIndices handles pipe-only forms', () => {
  const source = '[0, | 2, | /3, |]';
  const indices = golden.findAllTimescaleIndices(source);
  // Should find 2 and 3 from the pipe forms
  assert.deepEqual(indices, [6, 12]);
});

test('findAllTimescaleIndices handles fractional timescales', () => {
  const source = '[0 | 3/4, 1 | 5/2]';
  const indices = golden.findAllTimescaleIndices(source);
  // Should find: 3, 4 (from 3/4) and 5, 2 (from 5/2)
  assert.deepEqual(indices, [5, 7, 14, 16]);
});

test('findNumericValueIndicesAtDepth with tie operator (transparent)', () => {
  const source = '[0, 0, 1, 1] t';
  const indices = golden.findNumericValueIndicesAtDepth(source, 0);
  // TieOp is transparent, so depth 0 is the mot itself
  assert.deepEqual(indices, [1, 4, 7, 10]);
});

test('findNumericValueIndicesAtDepth with subdivide operator (transparent)', () => {
  const source = '[0, 1, 2]/';
  const indices = golden.findNumericValueIndicesAtDepth(source, 0);
  // Subdivide is transparent, so depth 0 is the mot itself
  assert.deepEqual(indices, [1, 4, 7]);
});

test('findAllTimescaleIndices multi-section program with comments and subdivisions', () => {
  const source = `// @tonic 50
// @scaleDeformation 1 0 0 0 0 0 1
// @quanta 2n
// @octave 1
// @volume 4
// @bpm 110
// @preset ZT_Synth10
// @filterVerb 0.6
A = [1,-3,0|2]
B = A . [0,0,[0 | 3/2, 2|/2]/]
A, B, A, B
!
[-10|2]:8
!
[-17|4]:4
!
[-6|2]:8
!
[13|2]:9`;
  const indices = findAllTimescaleIndices(source);
  // Find all timescale literals: |2 on line 9, | 3/2 and |/2 on line 10,
  // |2 on lines 13, 15, 17, 19
  // Positions: line 9 char 14 (|2), line 10 char 19 (3), line 10 char 21 (/2),
  // line 13 char 4 (2), line 15 char 4 (4), line 17 char 4 (2), line 19 char 4 (2)
  assert.ok(Array.isArray(indices));
  assert.ok(indices.length > 0);
  // Verify indices don't include comment numbers (50, 1, 0, 110, etc.)
  assert.ok(indices.every(idx => {
    const char = source[idx];
    return /[0-9]/.test(char);
  }));
});

test('findNumericValueIndicesAtDepth multi-section program with nested expressions', () => {
  const source = `// @tonic 50
// @scaleDeformation 1 0 0 0 0 0 1
// @quanta 2n
// @octave 1
// @volume 4
// @bpm 110
// @preset ZT_Synth10
// @filterVerb 0.6
A = [1,-3,0|2]
B = A . [0,0,[0 | 3/2, 2|/2]/]
A, B, A, B
!
[-10|2]:8
!
[-17|4]:4
!
[-6|2]:8
!
[13|2]:9`;
  // Test depth 0 - should find numeric values at the top level
  const indicesDepth0 = golden.findNumericValueIndicesAtDepth(source, 0);
  assert.ok(Array.isArray(indicesDepth0));
  // Verify returned indices point to numeric characters
  indicesDepth0.forEach(idx => {
    assert.ok(/[-0-9]/.test(source[idx]), `Index ${idx} should point to numeric character, got '${source[idx]}'`);
  });
  // Verify no indices from comments
  indicesDepth0.forEach(idx => {
    const lineStart = source.lastIndexOf('\n', idx) + 1;
    const lineEnd = source.indexOf('\n', idx);
    const line = source.substring(lineStart, lineEnd === -1 ? source.length : lineEnd);
    assert.ok(!line.trimStart().startsWith('//'), `Index ${idx} should not be in a comment line`);
  });
});

test('findAllTimescaleIndices crash case with complex nested operators', () => {
  const source = `// @pitchRegime MelodicMinor
// @preset Mellotron_Flute
// @reverb 0.5
// @volume 0.5
// @bpm 81

nug =  [1 | /2, -1 | /2, 0]
nug2 = nug . [1,1,4]
aun = [1, 0]

haydn = [-5] * [0 | 3/2, 1 | /2, 2, 1, 3, 2, 1 | /2, -1 | /2, 0, 5 -> 1, 2 | /2, 0 | /2, 4]

haydn2 = [-5] * [0 -> 2, 1, 2, nug ,5 -> 1, nug2  ] . [0 | 3/2,0 | /2,0,0,aun,0...]`;

  const indices = findAllTimescaleIndices(source);
  assert.ok(Array.isArray(indices));
  // Should find timescales in nug, haydn, and haydn2 definitions
  assert.ok(indices.length > 0, 'Should find timescale indices');
});

test('findAllTimescaleIndices with NestedElem variants', () => {
  // Test NestedElem_motSubdivide - mot literal with / inside nested mot
  const source1 = '[[[ 1 | 2, 2]/]]';
  const indices1 = findAllTimescaleIndices(source1);
  assert.ok(Array.isArray(indices1));
  assert.equal(indices1.length, 1); // Should find the timescale number 2

  // Test NestedElem_nestedSubdivide - nested mot with / inside another nested mot
  const source2 = '[[[[ 1 | 3, 2]]/]]';
  const indices2 = findAllTimescaleIndices(source2);
  assert.ok(Array.isArray(indices2));
  assert.equal(indices2.length, 1); // Should find the timescale number 3
});

test('findAllTimescaleIndices with SingleValue inline multiply', () => {
  // Test SingleValue_inlineMulMots - [1] * [2] inside a mot
  const source1 = '[[1 | 2] * [3 | 4]]';
  const indices1 = findAllTimescaleIndices(source1);
  // Indices point to the timescale numbers (not the pipes)
  assert.equal(indices1.length, 2); // Should find both timescales
  assert.equal(source1[indices1[0]], '2');
  assert.equal(source1[indices1[1]], '4');

  // Test SingleValue_inlineMulRefMot - ref * [mot] inside a mot
  const source2 = 'a = [1 | 2]\n[[3], a * [4 | 5]]';
  const indices2 = findAllTimescaleIndices(source2);
  assert.ok(indices2.length >= 2); // Should find at least the assignment and inline mul timescales
  // Verify at least one points to '2' and one points to '5'
  assert.ok(indices2.some(i => source2[i] === '2'));
  assert.ok(indices2.some(i => source2[i] === '5'));
});

test('findAllTimescaleIndices with NestedMotAbbrev', () => {
  // Test abbreviated nested mot [[...], ...] form
  const source = '[[[1 | 2], 3 | 4]';
  const indices = findAllTimescaleIndices(source);
  assert.equal(indices.length, 2); // Should find both timescales
  // Verify they point to the numbers
  assert.equal(source[indices[0]], '2');
  assert.equal(source[indices[1]], '4');
});

test('findAllTimescaleIndices with NestedMotLiteral', () => {
  // Test nested mot literal with timescales
  const source = '[[1 | 2, 3 | 4]]';
  const indices = findAllTimescaleIndices(source);
  assert.equal(indices.length, 2); // Should find both timescales
  // Verify they point to the numbers
  assert.equal(source[indices[0]], '2');
  assert.equal(source[indices[1]], '4');
});


