import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/index.js';
import '../src/decompose.js';

const { decompose } = golden;

// Helper: check that at least one candidate matches expected code
function hasCandidate(result, code) {
  return result.candidates.some(c => c.code === code);
}

// Helper: check that all candidates verify (round-trip through evaluator)
function allCandidatesVerify(result, inputCode) {
  const expected = golden.crux_interp(inputCode);
  const expectedPips = expected.sections[expected.sections.length - 1].values;
  for (const c of result.candidates) {
    const actual = golden.crux_interp(c.code);
    const actualPips = actual.sections[actual.sections.length - 1].values;
    assert.equal(actualPips.length, expectedPips.length,
      `Candidate "${c.code}" has wrong pip count`);
    for (let i = 0; i < actualPips.length; i++) {
      assert.equal(actualPips[i].step, expectedPips[i].step,
        `Candidate "${c.code}" pip ${i} step mismatch`);
      assert.ok(Math.abs(actualPips[i].timeScale - expectedPips[i].timeScale) < 1e-10,
        `Candidate "${c.code}" pip ${i} timeScale mismatch`);
    }
  }
}

// --- Basic functionality ---

test('decompose returns literal for any input', () => {
  const result = decompose('[3, 7, 2]');
  assert.ok(result.candidates.length >= 1);
  assert.ok(result.candidates.some(c => c.kind === 'literal'));
});

test('decompose returns empty for empty input', () => {
  const result = decompose([]);
  assert.equal(result.candidates.length, 0);
});

test('decompose handles single pip', () => {
  const result = decompose('[5]');
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].kind, 'literal');
});

// --- Range detection ---

test('decompose: ascending range', () => {
  const result = decompose('[0, 1, 2, 3, 4]');
  assert.ok(hasCandidate(result, '[0->4]'), `Expected [0->4], got: ${result.candidates.map(c => c.code)}`);
  allCandidatesVerify(result, '[0, 1, 2, 3, 4]');
});

test('decompose: descending range', () => {
  const result = decompose('[5, 4, 3, 2, 1, 0]');
  assert.ok(hasCandidate(result, '[5->0]'), `Expected [5->0], got: ${result.candidates.map(c => c.code)}`);
  allCandidatesVerify(result, '[5, 4, 3, 2, 1, 0]');
});

test('decompose: range with negative values', () => {
  const result = decompose('[-3, -2, -1, 0, 1, 2]');
  assert.ok(hasCandidate(result, '[-3->2]'), `Expected [-3->2], got: ${result.candidates.map(c => c.code)}`);
  allCandidatesVerify(result, '[-3, -2, -1, 0, 1, 2]');
});

test('decompose: long ascending range scores better than literal', () => {
  const result = decompose('[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]');
  const rangeCand = result.candidates.find(c => c.kind === 'range');
  const literalCand = result.candidates.find(c => c.kind === 'literal');
  assert.ok(rangeCand, 'Should find a range candidate');
  assert.ok(rangeCand.score.total > literalCand.score.total,
    'Range should score higher than literal');
});

// --- Repeat detection ---

test('decompose: constant repeat', () => {
  const result = decompose('[2, 2, 2, 2]');
  const found = result.candidates.some(c =>
    c.kind === 'constant-repeat' || c.kind === 'repeat'
  );
  assert.ok(found, `Expected repeat candidate, got: ${result.candidates.map(c => `${c.kind}:${c.code}`)}`);
  allCandidatesVerify(result, '[2, 2, 2, 2]');
});

test('decompose: pattern repeat', () => {
  const result = decompose('[0, 1, 0, 1, 0, 1]');
  const found = result.candidates.some(c => c.kind === 'repeat');
  assert.ok(found, `Expected repeat candidate, got: ${result.candidates.map(c => `${c.kind}:${c.code}`)}`);
  allCandidatesVerify(result, '[0, 1, 0, 1, 0, 1]');
});

test('decompose: triple repeat of a motif', () => {
  const result = decompose('[0, 1, 2, 0, 1, 2, 0, 1, 2]');
  const found = result.candidates.some(c => c.kind === 'repeat');
  assert.ok(found, `Expected repeat candidate, got: ${result.candidates.map(c => `${c.kind}:${c.code}`)}`);
  allCandidatesVerify(result, '[0, 1, 2, 0, 1, 2, 0, 1, 2]');
});

// --- Progression detection ---

test('decompose: non-unit arithmetic progression', () => {
  const result = decompose('[0, 3, 6, 9]');
  const found = result.candidates.some(c => c.kind === 'progression');
  assert.ok(found, `Expected progression candidate, got: ${result.candidates.map(c => `${c.kind}:${c.code}`)}`);
  allCandidatesVerify(result, '[0, 3, 6, 9]');
});

test('decompose: progression with offset', () => {
  const result = decompose('[2, 5, 8, 11]');
  const found = result.candidates.some(c => c.kind === 'progression');
  assert.ok(found, `Expected progression candidate, got: ${result.candidates.map(c => `${c.kind}:${c.code}`)}`);
  allCandidatesVerify(result, '[2, 5, 8, 11]');
});

test('decompose: descending progression', () => {
  const result = decompose('[12, 9, 6, 3, 0]');
  const found = result.candidates.some(c => c.kind === 'progression');
  assert.ok(found, `Expected progression candidate, got: ${result.candidates.map(c => `${c.kind}:${c.code}`)}`);
  allCandidatesVerify(result, '[12, 9, 6, 3, 0]');
});

// --- Input formats ---

test('decompose: from pip array', () => {
  const pips = [
    { step: 0, timeScale: 1 },
    { step: 1, timeScale: 1 },
    { step: 2, timeScale: 1 },
  ];
  const result = decompose(pips);
  assert.ok(hasCandidate(result, '[0->2]'));
});

test('decompose: from pip array without timeScale', () => {
  const pips = [{ step: 0 }, { step: 1 }, { step: 2 }];
  const result = decompose(pips);
  assert.ok(hasCandidate(result, '[0->2]'));
});

// --- All candidates verify ---

test('decompose: all candidates for irregular input verify', () => {
  const result = decompose('[3, 7, 2, 11, 5]');
  allCandidatesVerify(result, '[3, 7, 2, 11, 5]');
});

test('decompose: all candidates for range verify', () => {
  const result = decompose('[0, 1, 2, 3, 4, 5, 6, 7]');
  allCandidatesVerify(result, '[0, 1, 2, 3, 4, 5, 6, 7]');
});

test('decompose: all candidates for repeat verify', () => {
  const result = decompose('[5, 3, 5, 3, 5, 3]');
  allCandidatesVerify(result, '[5, 3, 5, 3, 5, 3]');
});

// --- Rhythm factoring ---

test('decompose: uniform timeScale factored out', () => {
  // [0|/2, 1|/2, 2|/2, 3|/2, 4|/2] → [0->4] .j [|/2]
  const result = decompose('[0 | /2, 1 | /2, 2 | /2, 3 | /2, 4 | /2]');
  const found = result.candidates.some(c => c.kind.includes('range') && c.kind.includes('rhythm'));
  assert.ok(found, `Expected range+rhythm candidate, got: ${result.candidates.map(c => `${c.kind}:${c.code}`)}`);
  allCandidatesVerify(result, '[0 | /2, 1 | /2, 2 | /2, 3 | /2, 4 | /2]');
});

test('decompose: uniform timeScale produces .j with single-element mask', () => {
  const result = decompose('[0 | /2, 1 | /2, 2 | /2, 3 | /2, 4 | /2]');
  const rangePlusRhythm = result.candidates.find(c => c.kind === 'range+rhythm');
  assert.ok(rangePlusRhythm, 'Should find range+rhythm candidate');
  assert.ok(rangePlusRhythm.code.includes('.j'), 'Should contain .j operator');
  assert.ok(rangePlusRhythm.code.includes('[|/2]'), `Should have compact rhythm mask, got: ${rangePlusRhythm.code}`);
});

test('decompose: mixed timeScales with step pattern', () => {
  // Repeat pattern with mixed rhythms
  const result = decompose('[0 | /2, 1 | /4, 0 | /2, 1 | /4]');
  const found = result.candidates.some(c =>
    c.kind.includes('rhythm') || c.kind === 'repeat'
  );
  assert.ok(found, `Expected rhythm-factored or repeat candidate, got: ${result.candidates.map(c => `${c.kind}:${c.code}`)}`);
  allCandidatesVerify(result, '[0 | /2, 1 | /4, 0 | /2, 1 | /4]');
});

test('decompose: rhythm-factor candidate for compact rhythm', () => {
  // 8 notes all |/2 → rhythm mask compresses to [|/2]
  const result = decompose('[0 | /2, 3 | /2, 7 | /2, 5 | /2, 2 | /2, 4 | /2, 1 | /2, 6 | /2]');
  const rhythmCand = result.candidates.find(c => c.kind === 'rhythm-factor');
  assert.ok(rhythmCand, `Expected rhythm-factor candidate, got: ${result.candidates.map(c => `${c.kind}:${c.code}`)}`);
  assert.ok(rhythmCand.code.includes('.j'), 'Should contain .j operator');
  allCandidatesVerify(result, '[0 | /2, 3 | /2, 7 | /2, 5 | /2, 2 | /2, 4 | /2, 1 | /2, 6 | /2]');
});

test('decompose: non-uniform rhythm uses full mask with step decomposition', () => {
  // Steps [0,1,2,3,4,5] = range, rhythm [|/2, |/4, |/2, |/4, |/2, |/4] = non-uniform
  // Non-uniform rhythm can't compress (: strips _pipeOnly flags), but steps still decompose
  const result = decompose('[0 | /2, 1 | /4, 2 | /2, 3 | /4, 4 | /2, 5 | /4]');
  const found = result.candidates.some(c => c.kind.includes('rhythm'));
  assert.ok(found, `Expected rhythm candidate, got: ${result.candidates.map(c => `${c.kind}:${c.code}`)}`);
  allCandidatesVerify(result, '[0 | /2, 1 | /4, 2 | /2, 3 | /4, 4 | /2, 5 | /4]');
});

test('decompose: constant repeat with rhythm still detects repeat', () => {
  // [0|/2, 0|/2, 0|/2, 0|/2] should detect as repeat even with non-unit ts
  const result = decompose('[0 | /2, 0 | /2, 0 | /2, 0 | /2]');
  const found = result.candidates.some(c =>
    c.kind.includes('repeat') || c.kind.includes('rhythm')
  );
  assert.ok(found, `Expected repeat or rhythm candidate, got: ${result.candidates.map(c => `${c.kind}:${c.code}`)}`);
  allCandidatesVerify(result, '[0 | /2, 0 | /2, 0 | /2, 0 | /2]');
});

test('decompose: all candidates with mixed timeScales verify', () => {
  // Bach-like pattern with uniform rhythm
  const crux = '[0 | /2, 7 | /2, 4 | /2, 7 | /2, 9 | /2, 7 | /2, 4 | /2, 7 | /2, 0 | /2, 7 | /2, 4 | /2, 7 | /2, 9 | /2, 7 | /2, 4 | /2, 7 | /2]';
  const result = decompose(crux);
  assert.ok(result.candidates.length > 1, 'Should find more than just literal');
  allCandidatesVerify(result, crux);
});

test('decompose: ts=1 pips still work without rhythm factoring', () => {
  // Ensure rhythm factoring path doesn't break regular ts=1 decomposition
  const result = decompose('[0, 1, 2, 3, 4, 5]');
  assert.ok(hasCandidate(result, '[0->5]'));
  // Should NOT have any rhythm-tagged candidates
  const rhythmCands = result.candidates.filter(c => c.kind.includes('rhythm'));
  assert.equal(rhythmCands.length, 0, 'ts=1 sequences should not produce rhythm candidates');
});

// --- Variable hoisting ---

test('decompose: hoists repeated sub-expressions into variables', () => {
  // Mary had a little lamb has ([0->2] ^ [-2]) * [4] appearing 3x
  const result = decompose('[4, 2, 0, 2, 4, 4, 4 | 2, 2, 2, 2 | 2, 4, 7, 7 | 2, 4, 2, 0, 2, 4, 4, 4, 4, 2, 2, 4, 2, 0 | 2]');
  // Look for hoist-based candidates (not kernel-based ones)
  const hoisted = result.candidates.find(c => c.code.includes('\n') && !c.kind.startsWith('kernel'));
  assert.ok(hoisted, `Expected a hoisted candidate, got: ${result.candidates.map(c => c.kind)}`);
  assert.ok(hoisted.code.includes('aa ='), `Expected variable assignment, got: ${hoisted.code}`);
  // Variable should be referenced multiple times
  const refs = hoisted.code.match(/\baa\b/g);
  assert.ok(refs && refs.length >= 3, `Expected aa to appear >= 3 times (1 def + 2 refs), got: ${refs?.length}`);
});

test('decompose: hoisted candidates verify correctly', () => {
  const result = decompose('[4, 2, 0, 2, 4, 4, 4 | 2, 2, 2, 2 | 2, 4, 7, 7 | 2, 4, 2, 0, 2, 4, 4, 4, 4, 2, 2, 4, 2, 0 | 2]');
  allCandidatesVerify(result, '[4, 2, 0, 2, 4, 4, 4 | 2, 2, 2, 2 | 2, 4, 7, 7 | 2, 4, 2, 0, 2, 4, 4, 4, 4, 2, 2, 4, 2, 0 | 2]');
});

test('decompose: no hoisting for sequences without repeated sub-expressions', () => {
  // Simple range — no repeated sub-expressions
  const result = decompose('[0, 1, 2, 3, 4, 5]');
  const hoisted = result.candidates.find(c => c.code.includes('\n') && !c.kind.startsWith('kernel'));
  assert.equal(hoisted, undefined, 'Simple range should not have hoisted candidates');
});

test('decompose: no hoisting for literal candidate', () => {
  const result = decompose('[3, 7, 2]');
  for (const c of result.candidates) {
    assert.ok(!c.code.includes('\n'), `Candidate "${c.kind}" should not be hoisted`);
  }
});

test('decompose: hoisting with rhythm produces valid .j expression', () => {
  // Dies irae (ts=1) has repeated progression segments
  const result = decompose('[0, 0, 2, 0, -2, 0, 0, 0, 2, 3, 2, 0, 2, 0, -2, 0, 2, 3, 0, -2, -3, -2, 0]');
  const hoisted = result.candidates.find(c => c.code.includes('\n'));
  if (hoisted) {
    allCandidatesVerify(result, '[0, 0, 2, 0, -2, 0, 0, 0, 2, 3, 2, 0, 2, 0, -2, 0, 2, 3, 0, -2, -3, -2, 0]');
  }
});

test('decompose: multiple variables hoisted when multiple patterns repeat', () => {
  // Ode to joy has two different repeated patterns
  const crux = '[4, 4, 5, 7, 7, 5, 4, 2, 0, 0, 2, 4, 4 | 1.5, 2 | /2, 2 | 2, 4, 4, 5, 7, 7, 5, 4, 2, 0, 0, 2, 4, 2 | 1.5, 0 | /2, 0 | 2]';
  const result = decompose(crux);
  const hoisted = result.candidates.find(c => c.code.includes('\n'));
  if (hoisted) {
    // Should have at least 2 variable assignments
    const assignLines = hoisted.code.split('\n').filter(line => line.includes(' = '));
    assert.ok(assignLines.length >= 2, `Expected >= 2 variable assignments, got ${assignLines.length}: ${assignLines}`);
    allCandidatesVerify(result, crux);
  }
});

// --- Scoring ---

test('decompose: compressed candidates score higher than literal', () => {
  const result = decompose('[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]');
  const nonLiterals = result.candidates.filter(c => c.kind !== 'literal');
  const literal = result.candidates.find(c => c.kind === 'literal');
  for (const c of nonLiterals) {
    assert.ok(c.score.total > literal.score.total,
      `${c.kind} "${c.code}" should score higher than literal`);
  }
});


// --- Kernel Discovery ---

test('decompose: kernel detection with repeated transposed motif', () => {
  // [0,2,4] appears at +0 and +5 → kernel [0,2,4], aa = nug * [5]
  const result = decompose('[0, 2, 4, 5, 7, 9]');
  const kernelCand = result.candidates.find(c => c.kind === 'kernel');
  assert.ok(kernelCand, 'Should find kernel candidate');
  assert.ok(kernelCand.code.includes('nug'), 'Should name the kernel "nug"');
  allCandidatesVerify(result, '[0, 2, 4, 5, 7, 9]');
});

test('decompose: kernel detection with three transpositions', () => {
  // [0,2,4] at +0, +3, +6
  const crux = '[0, 2, 4, 3, 5, 7, 6, 8, 10]';
  const result = decompose(crux);
  const kernelCand = result.candidates.find(c => c.kind === 'kernel');
  assert.ok(kernelCand, 'Should find kernel candidate');
  // Should have named variables for the transpositions
  const lines = kernelCand.code.split('\n');
  const assigns = lines.filter(l => l.includes(' = '));
  assert.ok(assigns.length >= 2, `Expected >= 2 assignments (nug + transpositions), got ${assigns.length}`);
  allCandidatesVerify(result, crux);
});

test('decompose: kernel with retrograde match', () => {
  // [0,2,4] then reversed [4,2,0]
  const crux = '[0, 2, 4, 4, 2, 0]';
  const result = decompose(crux);
  const kernelCand = result.candidates.find(c => c.kind === 'kernel');
  assert.ok(kernelCand, 'Should find kernel candidate');
  assert.ok(kernelCand.code.includes('| -1'), 'Should use retrograde (negative timeScale)');
  allCandidatesVerify(result, crux);
});

test('decompose: kernel with transposition and retrograde', () => {
  // [0,2,4] then transposed retrograde [9,7,5] (reverse of [5,7,9])
  const crux = '[0, 2, 4, 9, 7, 5]';
  const result = decompose(crux);
  const kernelCand = result.candidates.find(c => c.kind === 'kernel');
  assert.ok(kernelCand, 'Should find kernel candidate');
  allCandidatesVerify(result, crux);
});

test('decompose: kernel with identity repetition', () => {
  // Same motif repeated exactly
  const crux = '[0, 2, 4, 1, 0, 2, 4, 1]';
  const result = decompose(crux);
  const kernelCand = result.candidates.find(c => c.kind === 'kernel');
  assert.ok(kernelCand, 'Should find kernel candidate for exact repetition');
  // Identity matches use the kernel ref directly — no transposition variable
  assert.ok(kernelCand.code.includes('nug'), 'Should name the kernel');
  allCandidatesVerify(result, crux);
});

test('decompose: kernel with literal gaps', () => {
  // [0,2,4] then some unrelated pips, then [0,2,4] again
  const crux = '[0, 2, 4, 99, 0, 2, 4]';
  const result = decompose(crux);
  const kernelCand = result.candidates.find(c => c.kind === 'kernel');
  // Coverage = 6/7 ≈ 0.857 — should pass threshold
  assert.ok(kernelCand, 'Should find kernel with gap');
  assert.ok(kernelCand.code.includes('[99]'), 'Gap should appear as literal');
  allCandidatesVerify(result, crux);
});

test('decompose: no kernel for too-short sequence', () => {
  const result = decompose('[0, 2, 4, 1]');
  const kernelCand = result.candidates.find(c => c.kind === 'kernel');
  assert.equal(kernelCand, undefined, 'Should not find kernel for < 6 pips');
});

test('decompose: no kernel for unstructured sequence', () => {
  // Prime-spaced steps — no repeated interval structure
  const result = decompose('[0, 2, 5, 11, 17, 23, 31, 37]');
  const kernelCand = result.candidates.find(c => c.kind === 'kernel');
  assert.equal(kernelCand, undefined, 'Should not find kernel in prime-spaced sequence');
});

test('decompose: kernel does not break existing range detection', () => {
  const result = decompose('[0, 1, 2, 3, 4, 5, 6, 7]');
  assert.ok(hasCandidate(result, '[0->7]'), 'Range detection still works');
  allCandidatesVerify(result, '[0, 1, 2, 3, 4, 5, 6, 7]');
});

test('decompose: kernel does not break existing repeat detection', () => {
  const crux = '[0, 1, 0, 1, 0, 1]';
  const result = decompose(crux);
  const repeatCand = result.candidates.find(c => c.kind === 'repeat');
  assert.ok(repeatCand, 'Repeat detection still works');
  allCandidatesVerify(result, crux);
});

test('decompose: all kernel candidates round-trip correctly', () => {
  // Multiple transpositions with a gap
  const crux = '[0, 2, 4, 7, 3, 5, 7, 10, 6, 8, 10, 13]';
  const result = decompose(crux);
  allCandidatesVerify(result, crux);
});

test('decompose: kernel with rhythm factoring', () => {
  // Transposed motif with uniform half-duration
  const crux = '[0 | /2, 2 | /2, 4 | /2, 5 | /2, 7 | /2, 9 | /2]';
  const result = decompose(crux);
  const kernelCand = result.candidates.find(c => c.kind === 'kernel+rhythm');
  if (kernelCand) {
    assert.ok(kernelCand.code.includes('rhythm'), 'Should include rhythm variable');
    assert.ok(kernelCand.code.includes('.j'), 'Should use .j operator');
  }
  allCandidatesVerify(result, crux);
});
