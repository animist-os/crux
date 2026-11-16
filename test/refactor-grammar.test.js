import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { refactorVoices, verifyProgram, applyTransform } from '../src/refactor/grammar.js';
import { programBits, tokenize, integerBits } from '../src/refactor/cost.js';
import { parseScore, scoreToVoices, verifyAgainstScore } from '../src/score/index.js';

const voice = (steps, ts = 1) => steps.map(step => ({ step, timeScale: ts }));
const check = (voices, settings) => {
  const r = refactorVoices(voices, settings);
  assert.equal(r.verified, true, r.code);
  assert.equal(verifyProgram(r.code, voices), true);
  assert.ok(r.bits <= r.anchoredBits + 1e-9, 'never worse than the anchored literal');
  // With a library, bits count only the piece's own text (the library is shared).
  if (!settings?.library) assert.ok(Math.abs(programBits(r.code).bits - r.bits) < 1e-9);
  else assert.ok(Math.abs(programBits(r.localCode, { external: settings.library.names, extraNames: settings.library.defs.size }).bits - r.bits) < 1e-9);
  return r;
};

test('cost model: integers, fractions, names, operators', () => {
  assert.equal(integerBits(0), 1);
  assert.equal(integerBits(1), 2);
  assert.equal(integerBits(-3), 4);
  assert.equal(integerBits(7), 6);
  assert.equal(programBits('[0, 1, 2]').bits, 11);
  assert.equal(programBits('[0 | 1/2]').bits, 1 + 1 + 2 + 4 + 2);
  const t = tokenize('M = [0, -1]\n(M m [0]) * [3 | -1]');
  assert.ok(t.some(x => x.type === 'id' && x.text === 'm'));
  assert.ok(t.some(x => x.type === 'num' && x.text === '-1'));
  assert.throws(() => programBits('[0] * Q'), /undefined name/);
  // Comments and directives are free.
  assert.equal(programBits('// #tonic 7\n[0, 1, 2] // note').bits, 11);
});

test('transforms compose as Crux evaluates them', () => {
  const pips = [{ step: 0, timeScale: 1 }, { step: 2, timeScale: 1 / 2 }, { step: 1, timeScale: 2 }];
  const t = { invert: true, retro: true, offset: 5, scale: 2 };
  const code = 'M = [0, 2 | 1/2, 1 | 2]\n(M m [0]) * [5 | -2]';
  assert.equal(verifyProgram(code, [applyTransform(pips, t)]), true);
});

test('transposed repetition becomes one motif with a fan of transpositions', () => {
  const cell = [0, 2, 1];
  const r = check([voice([0, 2, 4, 6, 1].flatMap(t => cell.map(x => x + t)))], { streams: 'joint' });
  assert.ok(r.defs >= 1);
  assert.match(r.code, /\* \[/);
  assert.ok(r.saving > 0.2, r.code);
});

test('motifs are shared across voices and nest', () => {
  const a = [0, 1, 2, 1, 3, 2], b = [4, 3, 4, 2, 0];
  const phrase = [...a, ...a.map(x => x + 3), ...b, ...a.map(x => x - 1)];
  const voices = [voice([...phrase, ...phrase]), voice([...phrase.map(x => x - 7), ...phrase.map(x => x - 5)]), voice(a.map(x => -x))];
  const r = check(voices, { streams: 'joint' });
  // The repeated phrase contains the shorter motif: a nested definition.
  const defs = r.code.split('\n').filter(l => /^M\d+ = /.test(l));
  assert.ok(defs.some(l => /M\d+/.test(l.split('=')[1])), r.code);
  assert.ok(r.saving > 0.4, r.code);
});

test('inversion and retrograde are used when they pay', () => {
  const m = [0, 2, 1, 4, 3, 7];
  const inv = m.map(x => 9 - x), retro = [...m].reverse().map(x => x + 2);
  const r = check([voice([...m, ...inv, ...retro, ...m])], { streams: 'joint' });
  assert.match(r.code, / m \[0\]|\| -1/);
});

test('rests, durations and factored pitch/rhythm streams verify', () => {
  const rhythm = [1, 1 / 2, 1 / 2, 2];
  const mk = (steps) => steps.map((step, i) => ({ step, timeScale: rhythm[i % 4] }));
  const v1 = [{ step: 0, timeScale: 3, tag: 'r' }, ...mk([0, 1, 2, 0, 5, 3, 4, 1, 2, 2, 3, 4])];
  const v2 = mk([4, 6, 1, 2, 0, 1, 2, 0, -3, -1, -5, 0]);
  for (const streams of ['joint', 'factored', 'auto']) check([v1, v2], { streams });
});

test('search effort: a wider beam is never worse than greedy', () => {
  const v = voice([0, 1, 2, 3, 1, 2, 3, 4, 0, 1, 2, 3, 5, 4, 3, 2, 1, 2, 3, 4, 0, 1, 2, 3]);
  const greedy = check([v], { streams: 'joint' });
  const beam = check([v], { streams: 'joint', beamWidth: 6, branching: 6 });
  assert.ok(beam.bits <= greedy.bits + 1e-9);
});

test('variant references (motif + at-index edits) verify', () => {
  const m = [0, 2, 4, 3, 2, 1, 2, 0];
  const variant = m.map((x, i) => (i === 5 ? x + 1 : x) + 3);
  const voices = [voice([...m, ...variant, ...m.map(x => x - 2), ...variant.map(x => x + 1), ...m.map(x => x + 4)])];
  const r = check(voices, { streams: 'joint', variants: true, beamWidth: 4, branching: 4 });
  assert.ok(r.saving > 0.15, r.code);
  // A variant reference renders as (M * [o]) @ [@i d] and the interpreter agrees.
  assert.equal(verifyProgram('M = [0, 2, 4, 3, 2, 1, 2, 0]\n(M * [3]) @ [@5 1]', [voice(variant)]), true);
});

const fixtures = path.join(import.meta.dirname, 'fixtures/bach');
test('Bach soprano fixtures refactor and round-trip to the exact MIDI notes', () => {
  for (const file of fs.readdirSync(fixtures).filter(f => f.endsWith('.mid'))) {
    const score = parseScore(fs.readFileSync(path.join(fixtures, file)), { id: file });
    const converted = scoreToVoices(score, { parts: 'all', lens: 'diatonic' });
    const r = check(converted.voices, {});
    assert.equal(verifyAgainstScore(r.code, converted), true, file);
    assert.ok(r.saving > 0, file);
  }
});

test('a corpus library is learned across pieces and reused on an unseen piece', async () => {
  const { learnLibrary } = await import('../src/refactor/grammar.js');
  const figure = [0, 1, 2, 1, 0, -1, 0], cadence = [4, 3, 2, 1, 0];
  const piece = (k) => [voice([...figure.map(x => x + k), 9, 7, ...cadence, ...figure.map(x => x - k), 3, ...cadence.map(x => x + 2)]),
    voice([k, k + 2, ...cadence.map(x => x - 7), ...figure.map(x => x - 5)])];
  const library = learnLibrary([1, 2, 3, 4].map(piece), { minPieces: 3 });
  assert.ok(library.defs.size >= 1, 'library should not be empty');
  assert.match(library.code, /^L1 = /m);
  const unseen = piece(6);
  const r = check(unseen, { streams: 'joint', library });
  assert.ok(r.libraryUses > 0, r.code);
  const plain = refactorVoices(unseen, { streams: 'joint' });
  assert.ok(r.bits < plain.bits, `${r.bits} vs ${plain.bits}`);
});

test('cost model reads a negative at-index value as a signed number', () => {
  assert.equal(programBits('[0, 1] @ [@1 -1]').bits, programBits('[0, 1] @ [@1 1]').bits);
});
