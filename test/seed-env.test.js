// Host-supplied bindings: golden.crux_env and the seedEnv argument of
// golden.crux_interp. Hosts use these to share definitions between programs.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/index.js';

const steps = result => result.sections[0].values.map(p => p.step);

test('crux_env returns the bindings of a source', () => {
  const env = golden.crux_env('A = [0, 1, 2]\nB := [5, 7]');
  assert.ok(env instanceof Map);
  assert.deepEqual([...env.keys()].sort(), ['A', 'B']);
});

test('crux_interp resolves names from a seedEnv', () => {
  const env = golden.crux_env('A = [0, 1, 2]');
  assert.deepEqual(steps(golden.crux_interp('A * [0, 7]', env)), [0, 1, 2, 7, 8, 9]);
});

test('without a seedEnv the same name is undeclared', () => {
  assert.throws(() => golden.crux_interp('A * [0, 7]'));
});

test('a seedEnv gives the same result as the definition written in the program', () => {
  const env = golden.crux_env('A = [0, 2, 4]\nB := [1, 3]');
  for (const expr of ['A, B', 'A * B', 'B * A']) {
    const seeded = golden.crux_interp(expr, env);
    const inline = golden.crux_interp('A = [0, 2, 4]\nB := [1, 3]\n' + expr);
    assert.deepEqual(steps(seeded), steps(inline), expr);
    assert.equal(seeded.pip_count, inline.pip_count, expr + ' pip_count');
  }
});

test('a local definition wins and the caller\'s map is not changed', () => {
  const env = golden.crux_env('A = [0, 1, 2]');
  const before = [...env.keys()];
  assert.deepEqual(steps(golden.crux_interp('A = [9]\nC = [4]\nA, C', env)), [9, 4]);
  assert.deepEqual([...env.keys()], before);
});

test('crux_env layers a source over a seedEnv without changing it', () => {
  const base = golden.crux_env('A = [0, 1]');
  const env = golden.crux_env('B = A * [0, 7]', base);
  assert.deepEqual([...env.keys()].sort(), ['A', 'B']);
  assert.deepEqual([...base.keys()], ['A']);
  assert.deepEqual(steps(golden.crux_interp('B', env)), [0, 1, 7, 8]);
});

test('crux_interp with no seedEnv is unchanged', () => {
  const r = golden.crux_interp('[0, 1, 2] * [0, 7]');
  assert.deepEqual(steps(r), [0, 1, 2, 7, 8, 9]);
  assert.equal(r.pip_count > 0, true);
});
