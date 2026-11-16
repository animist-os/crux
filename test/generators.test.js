import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/index.js';
import { buildGenerators, validateGenerators, genText, genBits, surfaceKey, generatorCandidates, specText, specPips, shiftSpec } from '../src/refactor/generators.js';
import { refactorVoices, verifyProgram } from '../src/refactor/grammar.js';
import { programBits } from '../src/refactor/cost.js';

// Level one only keeps the test fast; the evaluator is the same at level two.
const dict = buildGenerators({ levels: 1 });
const run = steps => steps.map(([step, timeScale = 1]) => ({ step, timeScale }));
const interp = text => globalThis.golden.crux_interp(text).sections[0].values.map(p => [p.step, p.timeScale]);

test('dictionary entries reproduce their surfaces through the interpreter', () => {
  assert.ok(dict.size > 10000);
  assert.deepEqual(validateGenerators(dict, { sample: 1500, seed: 3 }), []);
  const two = buildGenerators({ levels: 2, level2MaxLength: 4 });
  assert.deepEqual(validateGenerators(two, { sample: 1500, seed: 4 }), []);
});

test('the cheapest expression wins and its bit count is exact', () => {
  const g = dict.entries.get(surfaceKey(run([[0, 1 / 2], [-1, 1 / 2]])));
  assert.equal(genText(g, 5), '[5, 4]/');
  assert.equal(genBits(g, 5), programBits('[5, 4]/').bits);
  const scale = dict.entries.get(surfaceKey(run([[0], [1], [2], [3]])));
  assert.deepEqual(interp(genText(scale, 2)), [[2, 1], [3, 1], [4, 1], [5, 1]]);
  assert.ok(genBits(scale, 0) < programBits('[0, 1, 2, 3]').bits);
  // Uneven beat: dotted eighth and sixteenth.
  const dotted = dict.entries.get(surfaceKey(run([[0, 3 / 4], [-1, 1 / 4]])));
  assert.equal(genText(dotted, 0), '[0 | 3, -1]/');
});

test('surfaces that do not start on 0 are placed correctly', () => {
  for (const g of [...dict.entries.values()].filter(x => x.pips[0].s !== 0).slice(0, 50)) {
    const text = genText(g, 3 - g.pips[0].s);
    assert.deepEqual(interp(text).map(p => p[0]), g.pips.map(p => p.s - g.pips[0].s + 3), text);
  }
});

test('fan and cog factorizations generate long stretches from a 2-pip atom', () => {
  // Four beats of falling eighth pairs on a descending skeleton.
  const v = run([[5, .5], [4, .5], [4, .5], [3, .5], [3, .5], [2, .5], [2, .5], [1, .5]]);
  const cands = generatorCandidates(v, 0, dict)[0];
  const cog = cands.find(c => c.spec.type === 'cog' && c.length === 8);
  // The skeleton 5 4 3 2 is itself generated: a run from one pip.
  assert.equal(specText(cog.spec), '([5] -> [-3]) . [[0, -1]/]');
  const fan = cands.find(c => c.spec.type === 'fan' && c.length === 8);
  assert.equal(specText(fan.spec), '[0, -1]/ * ([5] -> [-3])');
  for (const c of cands) {
    const want = v.slice(0, c.length).map(p => [p.step, p.timeScale]);
    assert.deepEqual(interp(specText(c.spec)), want, specText(c.spec));
    assert.deepEqual(specPips(c.spec).map(p => [p.step, p.timeScale]), want);
    // Shifting a spec transposes its text.
    assert.deepEqual(interp(specText(shiftSpec(c.spec, 2), 2)), want);
  }
});

test('refactoring with generators verifies and is not longer', () => {
  const voices = [
    run([[7], [6, .5], [5, .5], [4], [3, .5], [4, .5], [5], [4, .5], [3, .5], [2, 2]]),
    run([[0], [-1], [-2, .5], [-3, .5], [-4, .5], [-5, .5], [-3, 2], r(1), [0, .5], [1, .5], [2]]),
  ].map(v => v.map(p => p.step === 'r' ? { step: 0, timeScale: p.timeScale, tag: 'r' } : p));
  const plain = refactorVoices(voices, { streams: 'joint' });
  const gens = refactorVoices(voices, { streams: 'joint', generators: dict });
  assert.equal(gens.verified, true, gens.code);
  assert.equal(verifyProgram(gens.code, voices), true);
  assert.ok(gens.bits <= plain.bits + 1e-9, `${gens.bits} vs ${plain.bits}`);
  assert.match(gens.code, /\]\//); // at least one subdivided atom
  assert.ok(Math.abs(programBits(gens.code).bits - gens.bits) < 1e-9);
});

function r(t) { return ['r', t]; }
