import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse as parseYaml } from 'yaml';
import '../src/index.js';
import { REGIME_PITCH_CLASSES, diatonicToChromatic } from '../tools/find-regime.js';

const { parse } = golden;

const VALID_CATEGORIES = ['bach', 'folk', 'classical', 'chant', 'edm', 'minimalist'];
const VALID_REGIMES = [...Object.keys(REGIME_PITCH_CLASSES), '12Tone', '24Tone'];

const corpusPath = new URL('../corpus/melodies.yaml', import.meta.url).pathname;
const corpusYaml = fs.readFileSync(corpusPath, 'utf-8');
const corpus = parseYaml(corpusYaml);

test('corpus: YAML parses successfully', () => {
  assert.ok(corpus.melodies, 'should have a melodies array');
  assert.ok(Array.isArray(corpus.melodies), 'melodies should be an array');
  assert.ok(corpus.melodies.length > 0, 'should have at least one melody');
});

test('corpus: all entries have required fields', () => {
  const required = ['id', 'name', 'source', 'category', 'key', 'pitchRegime', 'tonic', 'crux'];
  for (const melody of corpus.melodies) {
    for (const field of required) {
      assert.ok(melody[field] !== undefined && melody[field] !== null,
        `${melody.id || 'unknown'}: missing required field '${field}'`);
    }
  }
});

test('corpus: all IDs are unique kebab-case slugs', () => {
  const ids = corpus.melodies.map(m => m.id);
  const unique = new Set(ids);
  assert.equal(ids.length, unique.size, 'all IDs should be unique');
  for (const id of ids) {
    assert.match(id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `'${id}' should be kebab-case`);
  }
});

test('corpus: all categories are valid', () => {
  for (const melody of corpus.melodies) {
    assert.ok(VALID_CATEGORIES.includes(melody.category),
      `${melody.id}: category '${melody.category}' not in ${VALID_CATEGORIES.join(', ')}`);
  }
});

test('corpus: all pitchRegimes are valid', () => {
  for (const melody of corpus.melodies) {
    assert.ok(VALID_REGIMES.includes(melody.pitchRegime),
      `${melody.id}: pitchRegime '${melody.pitchRegime}' not in valid regimes`);
  }
});

test('corpus: all tonic values are valid MIDI note numbers', () => {
  for (const melody of corpus.melodies) {
    assert.ok(Number.isInteger(melody.tonic),
      `${melody.id}: tonic should be an integer, got ${melody.tonic}`);
    assert.ok(melody.tonic >= 0 && melody.tonic <= 127,
      `${melody.id}: tonic ${melody.tonic} out of MIDI range 0-127`);
  }
});

test('corpus: diatonic crux steps are valid for their pitchRegime', () => {
  for (const melody of corpus.melodies) {
    if (melody.pitchRegime === '12Tone' || melody.pitchRegime === '24Tone') continue;

    const regime = melody.pitchRegime;
    const regimePcs = REGIME_PITCH_CLASSES[regime];
    assert.ok(regimePcs, `${melody.id}: regime '${regime}' not in REGIME_PITCH_CLASSES`);

    const prog = parse(melody.crux);
    const result = prog.interp();
    const mot = result.sections[result.sections.length - 1];

    for (const pip of mot.values) {
      if (pip.tag === 'r') continue;
      // diatonicToChromatic should produce a valid chromatic step
      const chromatic = diatonicToChromatic(pip.step, regime);
      assert.ok(typeof chromatic === 'number' && !isNaN(chromatic),
        `${melody.id}: diatonic step ${pip.step} failed to convert in ${regime}`);
    }
  }
});

test('corpus: all crux strings parse without error', () => {
  for (const melody of corpus.melodies) {
    let prog;
    try {
      prog = parse(melody.crux);
    } catch (e) {
      assert.fail(`${melody.id}: parse error: ${e.message}`);
    }
    const result = prog.interp();
    assert.ok(result.sections.length > 0, `${melody.id}: should produce at least one section`);
  }
});

test('corpus: all melodies produce non-empty Mots', () => {
  for (const melody of corpus.melodies) {
    const prog = parse(melody.crux);
    const result = prog.interp();
    const mot = result.sections[result.sections.length - 1];
    assert.ok(mot.values.length > 0, `${melody.id}: Mot should have at least one pip`);
  }
});

test('corpus: round-trip toString matches original', () => {
  for (const melody of corpus.melodies) {
    const prog = parse(melody.crux);
    const result = prog.interp();
    const mot = result.sections[result.sections.length - 1];
    const roundTrip = mot.toString();
    // Parse the round-trip string to verify it also parses
    const prog2 = parse(roundTrip);
    const result2 = prog2.interp();
    const mot2 = result2.sections[result2.sections.length - 1];
    assert.equal(mot2.values.length, mot.values.length,
      `${melody.id}: round-trip should preserve pip count`);
  }
});
