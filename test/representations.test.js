import test from 'node:test';
import assert from 'node:assert/strict';
import { findRepresentations, verifyRepresentation } from '../src/representations.js';

const voice = steps => steps.map(step => ({ step, timeScale: 1 }));
function check(voices, settings = {}) {
  const results = findRepresentations(voices, settings);
  assert.ok(results.length > 0);
  for (const [i, result] of results.entries()) {
    assert.equal(verifyRepresentation(result.code, voices), true, result.code);
    if (i) assert.ok(results[i - 1].score.total >= result.score.total);
    const covered = voices.map(v => new Set());
    for (const motif of result.motifs) {
      assert.ok(motif.occurrences.length >= 2);
      for (const occurrence of motif.occurrences) {
        for (let j = occurrence.start; j < occurrence.start + occurrence.length; j++) {
          assert.ok(!covered[occurrence.voice].has(j), 'Coverage must not double-count overlaps');
          covered[occurrence.voice].add(j);
        }
      }
    }
    assert.equal(result.score.coveredNotes, covered.reduce((sum, set) => sum + set.size, 0));
  }
  return results;
}

test('transposed reuse outranks a shorter literal program', () => {
  const result = check([voice([0, 2, 1, 5, 7, 6, 10, 12, 11])], { topK: 30 });
  assert.equal(result[0].motifs.length, 1);
  assert.equal(result[0].score.coverage, 1);
  assert.equal(result[0].score.definitionNotes, 3);
  const literal = result.find(r => r.kind === 'literal');
  assert.ok(literal);
  assert.ok(result[0].code.length > literal.code.length);
  assert.ok(result[0].score.total > literal.score.total);
});

test('a vocabulary of two distinct motifs improves over either motif alone', () => {
  const aa = [0, 2, 1, 4], bb = [20, 25, 23, 29];
  const voices = [voice([...aa, ...bb, ...aa, ...bb, ...aa, ...bb])];
  const options = { minMotifLength: 4, maxMotifLength: 4 };
  const single = check(voices, { ...options, maxVocabulary: 1 })[0];
  const multiple = check(voices, { ...options, maxVocabulary: 2 })[0];
  assert.equal(multiple.motifs.length, 2);
  assert.equal(multiple.score.coverage, 1);
  assert.ok(multiple.score.total > single.score.total);
});

test('inversion, retrograde, transposition and rhythmic scaling reconstruct exactly', () => {
  const aa = [0, 2, 1, 4].map((step, i) => ({ step, timeScale: [1, 0.5, 1.5, 2][i] }));
  const invert = aa.map(p => ({ step: 10 - p.step, timeScale: p.timeScale }));
  const retro = [...aa].reverse().map(p => ({ step: p.step + 15, timeScale: 2 * p.timeScale }));
  const best = check([[...aa, ...invert, ...retro]], { minMotifLength: 4, maxMotifLength: 4 })[0];
  assert.equal(best.score.coverage, 1);
  assert.ok(best.motifs[0].occurrences.some(o => o.inversion));
  assert.ok(best.motifs[0].occurrences.some(o => o.retrograde && o.timeScale === 2));
});

test('pitch factoring finds reuse with independently changing rhythm', () => {
  const steps = [0, 2, 1, 4, 5, 7, 6, 9, 10, 12, 11, 14];
  const durations = [1, 2, 1, 3, 2, 1, 3, 1, 3, 1, 1, 2];
  const best = check([steps.map((step, i) => ({ step, timeScale: durations[i] }))],
    { minMotifLength: 4, maxMotifLength: 4 })[0];
  assert.equal(best.kind, 'vocabulary-pitch');
  assert.equal(best.score.coverage, 1);
  assert.match(best.code, /\.j rhythm/);
  assert.ok(best.score.rhythmValues > 0);
});

test('rests are retained and never counted as motif notes', () => {
  const aa = voice([0, 3, 1, 5]);
  const rest = { step: 0, tag: 'r', timeScale: 2 / 3 };
  const best = check([[rest, ...aa, rest, ...aa, rest, ...aa]])[0];
  assert.equal(best.score.coveredNotes, 12);
  assert.equal(best.score.coverage, 1);
  assert.equal(verifyRepresentation('[0]', [[rest]]), false);
});

test('one vocabulary is shared across voices without concatenating their boundaries', () => {
  const best = check([voice([0, 2, 1, 4]), voice([5, 7, 6, 9]), voice([10, 12, 11, 14])])[0];
  assert.equal(best.motifs.length, 1);
  assert.equal(best.score.coverage, 1);
  assert.deepEqual(best.motifs[0].occurrences.map(o => o.voice), [0, 1, 2]);
});

test('late repetition is mined by reuse rather than initial position', () => {
  const intro = Array.from({ length: 30 }, (_, i) => i * i * i);
  const aa = [100, 102, 99, 104];
  const best = check([voice([...intro, ...aa, ...aa, ...aa])], { maxMotifs: 5 })[0];
  assert.ok(best.motifs.some(m => m.occurrences.length >= 3));
});

test('unstructured, short, and rest-only material retain a literal fallback', () => {
  for (const voices of [[voice([7])], [voice([0, 17, 43, 98])], [[{ step: 0, tag: 'r', timeScale: 1 / 3 }]]]) {
    assert.equal(check(voices)[0].kind, 'literal');
  }
});

test('deterministic ranking and configurable dictionary cost', () => {
  const voices = [voice([0, 2, 1, 5, 7, 6, 10, 12, 11])];
  assert.deepEqual(findRepresentations(voices), findRepresentations(voices));
  assert.equal(check(voices, { costs: { definition: 100 } })[0].kind, 'literal');
});

test('reject invalid inputs and search settings', () => {
  for (const input of [[], [[]], [[{ step: NaN }]], [[{ step: 0, timeScale: 0 }]], [[{ step: 0, tag: 'x' }]]]) {
    assert.throws(() => findRepresentations(input));
  }
  for (const settings of [{ topK: 0 }, { beamWidth: NaN }, { minMotifLength: 1 }, { costs: { literal: 0 } }]) {
    assert.throws(() => findRepresentations([voice([0, 1])], settings));
  }
});
