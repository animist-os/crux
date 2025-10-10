import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/index.js'; // Load the module to set up golden global

const { parse } = golden;

test('interp() returns sectionResults with metadata', () => {
  const prog = parse('[0, 1, 2]');
  const result = prog.interp();

  assert.ok(result.sections, 'Should have sectionResults');
  assert.ok(Array.isArray(result.sections), 'sectionResults should be an array');
  assert.equal(result.sections.length, 1, 'Should have one section');
  assert.equal(typeof result.pip_count, 'number', 'Should have pip_count');
  assert.equal(typeof result.pip_depth, 'number', 'Should have pip_depth');
  assert.equal(typeof result.duration, 'number', 'Should have duration');
});

test('interp() metadata for simple mot', () => {
  const prog = parse('[0, 1, 2, 3]');
  const result = prog.interp();

  assert.equal(result.pip_count, 4);
  assert.equal(result.pip_depth, 0);
  assert.equal(result.duration, 4);
  assert.equal(result.sections[0].toString(), '[0, 1, 2, 3]');
});

test('interp() metadata for binary operation', () => {
  const prog = parse('[0, 1] * [2, 3]');
  const result = prog.interp();

  assert.equal(result.pip_count, 4);
  assert.equal(result.pip_depth, 1);
  // Duration is the total duration of the evaluated result: [2,3,3,4] = 4 unit durations
  assert.equal(result.duration, 4);
});

test('interp() metadata with timescales', () => {
  const prog = parse('[0 | 2, 1 | /2, 2]');
  const result = prog.interp();

  assert.equal(result.pip_count, 3);
  assert.equal(result.pip_depth, 0);
  assert.equal(result.duration, 3.5); // 2 + 0.5 + 1
});

test('interp() metadata for multi-section program', () => {
  const prog = parse('[0, 1]\n!\n[2, 3, 4]');
  const result = prog.interp();

  assert.equal(result.sections.length, 2);
  assert.equal(result.sections[0].toString(), '[0, 1]');
  assert.equal(result.sections[1].toString(), '[2, 3, 4]');
  // Metadata is for the final section
  assert.equal(result.pip_count, 3);
  assert.equal(result.pip_depth, 0);
  // Duration is the max across all sections: max(2, 3) = 3
  assert.equal(result.duration, 3);
});

test('interp() metadata with variable assignments', () => {
  const prog = parse('A = [0, 1]\nB = [2, 3]\nA * B');
  const result = prog.interp();

  assert.equal(result.pip_count, 4);
  assert.equal(result.pip_depth, 1);
  // Duration is the total duration of the evaluated result
  assert.equal(result.duration, 4);
});

test('interp() metadata for nested operations', () => {
  const prog = parse('([0, 1] * [2, 3]) ^ [4, 5]');
  const result = prog.interp();

  assert.equal(result.pip_count, 6);
  assert.equal(result.pip_depth, 2);
  // Duration is the total duration of the evaluated result: 8 pips
  assert.equal(result.duration, 8);
});

test('interp() duration is max across all sections', () => {
  const prog = parse('[0, 1, 2, 3, 4]\n!\n[0, 1]\n!\n[0 | 2, 1 | 3]');
  const result = prog.interp();

  assert.equal(result.sections.length, 3);
  // Section durations: 5, 2, 5 (2+3)
  // Max should be 5
  assert.equal(result.duration, 5);
});

test('interp() preserves nondeterministic results', () => {
  // Test that each call produces potentially different random results
  const code = '[{1,2,3}]';
  const results = new Set();

  for (let i = 0; i < 20; i++) {
    const prog = parse(code);
    const result = prog.interp();
    results.add(result.sections[0].toString());
  }

  // Should have gotten at least 2 different results from random choice
  // (statistically very likely after 20 runs)
  assert.ok(results.size >= 2, `Expected multiple random results, got: ${[...results]}`);
});
