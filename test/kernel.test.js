import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseScore, scoreToVoices, verifyAgainstScore } from '../src/score/index.js';
import { buildKernel, buildKernelMany, fitKernel, inducePhrases, invertGrid, gridDistance, kMedoids, chunkVoice, timeline } from '../src/kernel/kernel.js';
import { stepNumbers, wiggleReach } from '../src/kernel/wiggle.js';

const fixtures = path.join(import.meta.dirname, 'fixtures/bach');
const files = fs.readdirSync(fixtures).filter(f => f.endsWith('.mid')).sort();
const load = file => {
  const score = parseScore(fs.readFileSync(path.join(fixtures, file)), { id: file });
  return { score, converted: scoreToVoices(score, { parts: 'all', lens: 'diatonic' }) };
};

test('a large enough kernel reproduces the score exactly', () => {
  for (const file of files.slice(0, 4)) {
    const { score, converted } = load(file);
    const k = buildKernel(score, converted, { k1: 64, k2: 256 });
    const fit = fitKernel(k.code, converted);
    assert.equal(fit.pitch, 1, file);
    assert.equal(fit.notes, 1, file);
    assert.equal(fit.extra, 0, file);
    assert.equal(verifyAgainstScore(k.code, converted), true, file);
  }
});

test('smaller codebooks use fewer numbers and fit less', () => {
  const { score, converted } = load(files[0]);
  const big = buildKernel(score, converted, { k1: 64, k2: 256 });
  const small = buildKernel(score, converted, { k1: 2, k2: 4 });
  assert.ok(small.controls.total < big.controls.total);
  const fit = fitKernel(small.code, converted);
  assert.ok(fit.pitch < 1 && fit.pitch > 0.2);
  // The controls are exactly the step numbers written in the program.
  assert.equal(small.controls.total, stepNumbers(small.code).numbers.length);
});

test('harmony mode reads every voice off one shared line', () => {
  const { score, converted } = load(files[1]);
  const k = buildKernel(score, converted, { k1: 64, k2: 256, harmony: true });
  assert.match(k.code, /^H = \[/m);
  assert.match(k.code, /^H \. \[/m);
  // Notes tied over a barline are struck again, so pitch is exact and onsets nearly so.
  assert.equal(fitKernel(k.code, converted).pitch, 1);
});

test('inversion lets one prototype stand for a figure and its mirror image', () => {
  const g = { pitch: [0, 0, 1, 2, null], onset: Uint8Array.from([1, 0, 1, 1, 0]), length: 5 };
  const items = [{ key: 'up', weight: 3, grid: g }, { key: 'down', weight: 1, grid: invertGrid(g) }];
  const { medoids, assign } = kMedoids(items, 1, { invert: true });
  assert.equal(medoids.length, 1);
  assert.equal(assign.get('up').proto, assign.get('down').proto);
  assert.notEqual(assign.get('up').inv, assign.get('down').inv);
  assert.equal(gridDistance(g, invertGrid(invertGrid(g))), 0);
  // The rendered (X m [0]) form is what the interpreter plays.
  const { score, converted } = load(files[2]);
  const k = buildKernel(score, converted, { k1: 3, k2: 6, invert: true });
  assert.ok(fitKernel(k.code, converted).pitch > 0);
});

test('phrases are lossless and transpose', () => {
  const units = [[0, 1, 0, 1, 2].map((proto, i) => ({ proto, offset: [0, 2, 3, 5, 7][i] })), [{ proto: 0, offset: 10 }, { proto: 1, offset: 12 }]];
  const { rules, seqs } = inducePhrases(units, 'B');
  assert.equal(rules.length, 1);
  assert.deepEqual(rules[0].body.map(t => [t.sym, t.rel]), [['B1', 0], ['B2', 2]]);
  assert.deepEqual(seqs[0].map(t => [t.sym, t.offset]), [['R1', 0], ['R1', 3], ['B3', 7]]);
  assert.deepEqual(seqs[1].map(t => [t.sym, t.offset]), [['R1', 10]]);
});

test('figures do not split a note held across a beat', () => {
  const segs = timeline([{ step: 0, timeScale: 2 }, { step: 1, timeScale: 1 }, { step: 2, timeScale: 1 }]);
  const chunks = chunkVoice(segs, [0, 48, 72], 96);
  assert.deepEqual(chunks.map(c => [c.a, c.b, c.offset]), [[0, 48, 0], [48, 72, 1], [72, 96, 2]]);
});

test('one kernel for several pieces shares its mots, and staggered entries line up', () => {
  const pieces = files.slice(0, 3).map(f => ({ ...load(f), label: f }));
  const k = buildKernelMany(pieces, { k1: 64, k2: 256, stagger: true });
  assert.match(k.code, /^!\d+/m);
  const fit = fitKernel(k.code, k.voices, { enters: k.enters });
  assert.equal(fit.pitch, 1);
  assert.equal(fit.notes, 1);
});

test('wiggle reach counts the notes each step number moves', () => {
  const code = 'A = [0, 1]\n// comment with numbers 3 4\n(A * [0, 5]), [2 | 2]';
  const { numbers } = stepNumbers(code);
  assert.deepEqual(numbers.map(n => [n.text, n.def]), [['0', 'A'], ['1', 'A'], ['0', null], ['5', null], ['2', null]]);
  const w = wiggleReach(code);
  assert.deepEqual(w.params.map(p => p.moved), [2, 2, 2, 2, 1]);
  assert.equal(w.notes, 5);
});

test('approximate repeats trade numbers for error at a price', () => {
  const { score, converted } = load(files[3]);
  const exact = buildKernel(score, converted, { k1: 64, k2: 0 });
  const strict = buildKernel(score, converted, { k1: 64, k2: 0, lossy: 1000 });
  const loose = buildKernel(score, converted, { k1: 64, k2: 0, lossy: 0.1 });
  // A high price takes no copy that adds error.
  assert.equal(fitKernel(strict.code, converted).pitch, fitKernel(exact.code, converted).pitch);
  assert.ok(strict.controls.total <= exact.controls.total);
  // A low price writes fewer numbers and gets more wrong.
  assert.ok(loose.controls.total < exact.controls.total);
  assert.ok(fitKernel(loose.code, converted).pitch < 1);
});

test('without measure shapes, a phrase that starts on a pickup repeats exactly', () => {
  // Two identical phrases, each starting on beat 4 of a 4/4 measure.
  const phrase = [[2, 1], [4, 2], [3, 1], [2, 2], [1, 2]];
  const pips = [[0, 3], ...phrase, ...phrase, [0, 1]].map(([step, timeScale]) => ({ step, timeScale }));
  const ppq = 480, measures = Array.from({ length: 5 }, (_, i) => ({ index: i, tick: i * 4 * ppq, durationTicks: 4 * ppq }));
  const score = { ppq, measures, timeSignatures: [{ tick: 0, beats: 4, beatType: 4 }] };
  const converted = { voices: [pips], lanes: [{ role: 'S' }] };
  const k = buildKernel(score, converted, { k1: 16, k2: 0 });
  assert.equal(fitKernel(k.code, converted).pitch, 1);
  assert.match(k.code, /^R\d+ = .*\n[\s\S]*R\d+[\s\S]*R\d+/m);
  assert.ok(k.controls.total < pips.length);
});
