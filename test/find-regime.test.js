import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REGIME_PITCH_CLASSES,
  findRegime,
  chromaticToDiatonic,
  diatonicToChromatic,
  computeTonicMidi,
  midiNotesToDiatonic,
} from '../tools/find-regime.js';


// --- findRegime ---

test('findRegime: C major (7 white-note PCs)', () => {
  const r = findRegime([0, 2, 4, 5, 7, 9, 11]);
  assert.equal(r.pitchRegime, 'Major');
  assert.equal(r.tonicPc, 0);
  assert.equal(r.confidence, 'exact');
});

test('findRegime: A minor with tonic hint', () => {
  const r = findRegime([9, 11, 0, 2, 4, 5, 7], 9);
  assert.equal(r.pitchRegime, 'Minor');
  assert.equal(r.tonicPc, 9);
  assert.equal(r.confidence, 'exact');
});

test('findRegime: D Dorian with tonic hint', () => {
  const r = findRegime([0, 2, 4, 5, 7, 9, 11], 2);
  assert.equal(r.pitchRegime, 'Dorian');
  assert.equal(r.tonicPc, 2);
  assert.equal(r.confidence, 'exact');
});

test('findRegime: G Mixolydian with tonic hint', () => {
  const r = findRegime([0, 2, 4, 5, 7, 9, 11], 7);
  assert.equal(r.pitchRegime, 'Mixolydian');
  assert.equal(r.tonicPc, 7);
  assert.equal(r.confidence, 'exact');
});

test('findRegime: A harmonic minor', () => {
  const r = findRegime([9, 11, 0, 2, 4, 5, 8]);
  assert.equal(r.pitchRegime, 'HarmonicMinor');
  assert.equal(r.tonicPc, 9);
  assert.equal(r.confidence, 'exact');
});

test('findRegime: C pentatonic (5 PCs)', () => {
  const r = findRegime([0, 2, 4, 7, 9]);
  assert.equal(r.pitchRegime, 'Pentatonic');
  assert.equal(r.tonicPc, 0);
  assert.equal(r.scaleLength, 5);
  assert.equal(r.confidence, 'exact');
});

test('findRegime: whole tone (6 PCs)', () => {
  const r = findRegime([0, 2, 4, 6, 8, 10]);
  assert.equal(r.pitchRegime, 'WholeTone');
  assert.equal(r.tonicPc, 0);
  assert.equal(r.scaleLength, 6);
  assert.equal(r.confidence, 'exact');
});

test('findRegime: octatonic (8 PCs)', () => {
  const r = findRegime([0, 1, 3, 4, 6, 7, 9, 10]);
  assert.equal(r.pitchRegime, 'Octatonic');
  assert.equal(r.scaleLength, 8);
  assert.equal(r.confidence, 'exact');
});

test('findRegime: subset — C minor triad found in some scale', () => {
  const r = findRegime([0, 3, 7]);
  assert.equal(r.confidence, 'subset');
  // All input PCs should be in the matched regime relative to the found tonic
  const regimePcs = new Set(REGIME_PITCH_CLASSES[r.pitchRegime]);
  assert.ok([0, 3, 7].every(pc => regimePcs.has(((pc - r.tonicPc) % 12 + 12) % 12)),
    `PCs [0,3,7] should all be in ${r.pitchRegime} on ${r.tonicPc}`);
});

test('findRegime: subset with tonic hint resolves correctly', () => {
  // [0, 3, 7] with tonic=0 should find Minor (or similar) on C
  const r = findRegime([0, 3, 7], 0);
  assert.equal(r.confidence, 'subset');
  assert.equal(r.tonicPc, 0);
  const regimePcs = new Set(REGIME_PITCH_CLASSES[r.pitchRegime]);
  assert.ok([0, 3, 7].every(pc => regimePcs.has(pc)));
});

test('findRegime: all 12 PCs → 12Tone fallback', () => {
  const r = findRegime([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.equal(r.pitchRegime, '12Tone');
  assert.equal(r.confidence, '12Tone');
});

test('findRegime: empty input', () => {
  const r = findRegime([]);
  assert.equal(r.pitchRegime, '12Tone');
  assert.equal(r.confidence, '12Tone');
});

test('findRegime: single PC', () => {
  const r = findRegime([5]);
  // Should return some match (subset)
  assert.ok(r.pitchRegime);
  assert.ok(['exact', 'subset'].includes(r.confidence));
});

test('findRegime: F# major (non-zero tonic)', () => {
  // F# major = [6, 8, 10, 11, 1, 3, 5]
  const r = findRegime([6, 8, 10, 11, 1, 3, 5]);
  assert.equal(r.pitchRegime, 'Major');
  assert.equal(r.tonicPc, 6);
  assert.equal(r.confidence, 'exact');
});

test('findRegime: Bb minor (flat key)', () => {
  // Bb = 10, minor = [0,2,3,5,7,8,10] → PCs from Bb: [10, 0, 1, 3, 5, 6, 8]
  const r = findRegime([10, 0, 1, 3, 5, 6, 8], 10);
  assert.equal(r.pitchRegime, 'Minor');
  assert.equal(r.tonicPc, 10);
  assert.equal(r.confidence, 'exact');
});

test('findRegime: allMatches contains multiple modes for diatonic set', () => {
  const r = findRegime([0, 2, 4, 5, 7, 9, 11]);
  assert.ok(r.allMatches.length >= 7, 'should find all 7 diatonic modes');
  const regimeNames = r.allMatches.map(m => m.pitchRegime);
  assert.ok(regimeNames.includes('Major'));
  assert.ok(regimeNames.includes('Minor'));
  assert.ok(regimeNames.includes('Dorian'));
});


// --- chromaticToDiatonic ---

test('chromaticToDiatonic: Major scale steps', () => {
  // Major: [0, 2, 4, 5, 7, 9, 11]
  assert.equal(chromaticToDiatonic(0, 'Major'), 0);   // unison
  assert.equal(chromaticToDiatonic(2, 'Major'), 1);   // M2 → step 1
  assert.equal(chromaticToDiatonic(4, 'Major'), 2);   // M3 → step 2
  assert.equal(chromaticToDiatonic(5, 'Major'), 3);   // P4 → step 3
  assert.equal(chromaticToDiatonic(7, 'Major'), 4);   // P5 → step 4
  assert.equal(chromaticToDiatonic(9, 'Major'), 5);   // M6 → step 5
  assert.equal(chromaticToDiatonic(11, 'Major'), 6);  // M7 → step 6
  assert.equal(chromaticToDiatonic(12, 'Major'), 7);  // octave → step 7
  assert.equal(chromaticToDiatonic(14, 'Major'), 8);  // M9 → step 8
});

test('chromaticToDiatonic: negative steps in Major', () => {
  assert.equal(chromaticToDiatonic(-1, 'Major'), -1);  // leading tone below
  assert.equal(chromaticToDiatonic(-5, 'Major'), -3);  // P4 below → step -3
  assert.equal(chromaticToDiatonic(-7, 'Major'), -4);  // P5 below → step -4
  assert.equal(chromaticToDiatonic(-12, 'Major'), -7); // octave below
});

test('chromaticToDiatonic: Minor scale', () => {
  // Minor: [0, 2, 3, 5, 7, 8, 10]
  assert.equal(chromaticToDiatonic(0, 'Minor'), 0);
  assert.equal(chromaticToDiatonic(3, 'Minor'), 2);   // m3 → step 2
  assert.equal(chromaticToDiatonic(7, 'Minor'), 4);   // P5 → step 4
  assert.equal(chromaticToDiatonic(10, 'Minor'), 6);  // m7 → step 6
});

test('chromaticToDiatonic: not in scale returns null', () => {
  assert.equal(chromaticToDiatonic(1, 'Major'), null);  // C# not in C major
  assert.equal(chromaticToDiatonic(6, 'Major'), null);  // F# not in C major
});

test('chromaticToDiatonic: 12Tone passthrough', () => {
  assert.equal(chromaticToDiatonic(7, '12Tone'), 7);
  assert.equal(chromaticToDiatonic(-3, '12Tone'), -3);
});

test('chromaticToDiatonic: Pentatonic (5-note scale)', () => {
  // Pentatonic: [0, 2, 4, 7, 9]
  assert.equal(chromaticToDiatonic(0, 'Pentatonic'), 0);
  assert.equal(chromaticToDiatonic(2, 'Pentatonic'), 1);
  assert.equal(chromaticToDiatonic(4, 'Pentatonic'), 2);
  assert.equal(chromaticToDiatonic(7, 'Pentatonic'), 3);
  assert.equal(chromaticToDiatonic(9, 'Pentatonic'), 4);
  assert.equal(chromaticToDiatonic(12, 'Pentatonic'), 5);  // octave = 5 in pentatonic
});

test('chromaticToDiatonic: HarmonicMinor', () => {
  // HarmonicMinor: [0, 2, 3, 5, 7, 8, 11]
  assert.equal(chromaticToDiatonic(11, 'HarmonicMinor'), 6);   // raised 7th
  assert.equal(chromaticToDiatonic(-1, 'HarmonicMinor'), -1);  // leading tone below
});


// --- diatonicToChromatic ---

test('diatonicToChromatic: Major scale degrees', () => {
  assert.equal(diatonicToChromatic(0, 'Major'), 0);   // unison
  assert.equal(diatonicToChromatic(1, 'Major'), 2);   // step 1 → M2
  assert.equal(diatonicToChromatic(2, 'Major'), 4);   // step 2 → M3
  assert.equal(diatonicToChromatic(3, 'Major'), 5);   // step 3 → P4
  assert.equal(diatonicToChromatic(4, 'Major'), 7);   // step 4 → P5
  assert.equal(diatonicToChromatic(5, 'Major'), 9);   // step 5 → M6
  assert.equal(diatonicToChromatic(6, 'Major'), 11);  // step 6 → M7
  assert.equal(diatonicToChromatic(7, 'Major'), 12);  // step 7 → octave
});

test('diatonicToChromatic: negative steps in Major', () => {
  assert.equal(diatonicToChromatic(-1, 'Major'), -1);   // -1 → leading tone below (B below C)
  assert.equal(diatonicToChromatic(-3, 'Major'), -5);   // -3 → P4 below
  assert.equal(diatonicToChromatic(-7, 'Major'), -12);  // -7 → octave below
});

test('diatonicToChromatic: Minor scale degrees', () => {
  assert.equal(diatonicToChromatic(0, 'Minor'), 0);
  assert.equal(diatonicToChromatic(2, 'Minor'), 3);   // step 2 → m3
  assert.equal(diatonicToChromatic(4, 'Minor'), 7);   // step 4 → P5
  assert.equal(diatonicToChromatic(6, 'Minor'), 10);  // step 6 → m7
});

test('diatonicToChromatic: 12Tone passthrough', () => {
  assert.equal(diatonicToChromatic(7, '12Tone'), 7);
  assert.equal(diatonicToChromatic(-3, '12Tone'), -3);
});

test('diatonicToChromatic: Pentatonic', () => {
  assert.equal(diatonicToChromatic(0, 'Pentatonic'), 0);
  assert.equal(diatonicToChromatic(3, 'Pentatonic'), 7);   // step 3 → P5
  assert.equal(diatonicToChromatic(5, 'Pentatonic'), 12);  // step 5 → octave
  assert.equal(diatonicToChromatic(-1, 'Pentatonic'), -3);  // step -1 → m3 below
});


// --- Round-trip: chromatic → diatonic → chromatic ---

test('round-trip: Major scale steps survive conversion', () => {
  const regime = 'Major';
  const pcs = REGIME_PITCH_CLASSES[regime];
  // Test two octaves up and one down
  for (let oct = -1; oct <= 2; oct++) {
    for (let i = 0; i < pcs.length; i++) {
      const chromatic = oct * 12 + pcs[i];
      const diatonic = chromaticToDiatonic(chromatic, regime);
      const backToChromatic = diatonicToChromatic(diatonic, regime);
      assert.equal(backToChromatic, chromatic,
        `round-trip failed for chromatic=${chromatic} (oct=${oct}, degree=${i})`);
    }
  }
});

test('round-trip: Minor scale steps survive conversion', () => {
  const regime = 'Minor';
  const pcs = REGIME_PITCH_CLASSES[regime];
  for (let oct = -1; oct <= 2; oct++) {
    for (let i = 0; i < pcs.length; i++) {
      const chromatic = oct * 12 + pcs[i];
      const diatonic = chromaticToDiatonic(chromatic, regime);
      const backToChromatic = diatonicToChromatic(diatonic, regime);
      assert.equal(backToChromatic, chromatic,
        `round-trip failed for chromatic=${chromatic}`);
    }
  }
});

test('round-trip: all regimes survive conversion for in-scale notes', () => {
  for (const [regime, pcs] of Object.entries(REGIME_PITCH_CLASSES)) {
    for (let oct = -1; oct <= 1; oct++) {
      for (let i = 0; i < pcs.length; i++) {
        const chromatic = oct * 12 + pcs[i];
        const diatonic = chromaticToDiatonic(chromatic, regime);
        assert.ok(diatonic !== null, `${regime}: chromatic ${chromatic} should be in scale`);
        const back = diatonicToChromatic(diatonic, regime);
        assert.equal(back, chromatic, `${regime}: round-trip failed for chromatic=${chromatic}`);
      }
    }
  }
});


// --- MelodicMinor correctness ---

test('MelodicMinor: pitch classes are standard ascending melodic minor', () => {
  // Ascending melodic minor: W H W W W W H = [0, 2, 3, 5, 7, 9, 11]
  assert.deepEqual(REGIME_PITCH_CLASSES['MelodicMinor'], [0, 2, 3, 5, 7, 9, 11]);
});

test('chromaticToDiatonic: MelodicMinor has perfect 4th at degree 3', () => {
  // Degree 3 of melodic minor should be a perfect 4th (5 semitones)
  assert.equal(chromaticToDiatonic(5, 'MelodicMinor'), 3);
  // Tritone (6) should NOT be in the scale
  assert.equal(chromaticToDiatonic(6, 'MelodicMinor'), null);
});

test('diatonicToChromatic: MelodicMinor degree 3 → 5 semitones', () => {
  assert.equal(diatonicToChromatic(3, 'MelodicMinor'), 5);
});

test('findRegime: detects MelodicMinor (C melodic minor)', () => {
  const r = findRegime([0, 2, 3, 5, 7, 9, 11]);
  // Could match Minor or MelodicMinor depending on which is tried first
  // Both share 6 of 7 PCs; the exact set matches MelodicMinor
  assert.equal(r.confidence, 'exact');
  // Verify the matched regime contains all input PCs
  const regimePcs = REGIME_PITCH_CLASSES[r.pitchRegime];
  const intervals = [0, 2, 3, 5, 7, 9, 11].map(pc => ((pc - r.tonicPc) % 12 + 12) % 12).sort((a, b) => a - b);
  assert.deepEqual(intervals, regimePcs);
});


// --- computeTonicMidi ---

test('computeTonicMidi: tonic at lowest note', () => {
  assert.equal(computeTonicMidi([60, 62, 64], 0), 60);
});

test('computeTonicMidi: tonic below lowest note', () => {
  // Lowest is E4 (64), tonic C → C4 (60)
  assert.equal(computeTonicMidi([64, 67, 72], 0), 60);
});

test('computeTonicMidi: tonic just below when PC is one above', () => {
  // Lowest is C4 (60), tonic B (pc=11) → B3 (59)
  assert.equal(computeTonicMidi([60, 64, 67], 11), 59);
});

test('computeTonicMidi: single note', () => {
  assert.equal(computeTonicMidi([67], 7), 67);
});


// --- midiNotesToDiatonic ---

test('midiNotesToDiatonic: simple C major', () => {
  const result = midiNotesToDiatonic([60, 62, 64, 65, 67], 'Major', 60);
  assert.deepEqual(result, [0, 1, 2, 3, 4]);
});

test('midiNotesToDiatonic: null for out-of-scale note', () => {
  const result = midiNotesToDiatonic([60, 61], 'Major', 60);
  assert.equal(result[0], 0);
  assert.equal(result[1], null);
});
