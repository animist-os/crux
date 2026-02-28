#!/usr/bin/env node

/**
 * Pitch regime resolver and chromatic↔diatonic step converter.
 *
 * Given a set of pitch classes (chromatic values 0-11), finds the
 * pitchRegime name and tonic that best explains them.
 *
 * Also provides conversion between chromatic semitone steps (12 per octave)
 * and diatonic scale-degree steps (N per octave, where N = scale length).
 *
 * Usage:
 *   node tools/find-regime.js 0 2 4 5 7 9 11
 *   node tools/find-regime.js --tonic 9 9 11 0 2 4 5 7
 */

// Canonical pitch class sets for each regime.
// Copied from golden_pitch_regime.js (modules/golden/golden_pitch_regime.js).
const REGIME_PITCH_CLASSES = {
  'Major':               [0, 2, 4, 5, 7, 9, 11],
  'Minor':               [0, 2, 3, 5, 7, 8, 10],
  'Dorian':              [0, 2, 3, 5, 7, 9, 10],
  'Phrygian':            [0, 1, 3, 5, 7, 8, 10],
  'Lydian':              [0, 2, 4, 6, 7, 9, 11],
  'Mixolydian':          [0, 2, 4, 5, 7, 9, 10],
  'Locrian':             [0, 1, 3, 5, 6, 8, 10],
  'HarmonicMinor':       [0, 2, 3, 5, 7, 8, 11],
  'MelodicMinor':        [0, 2, 3, 5, 7, 9, 11],
  'Pentatonic':          [0, 2, 4, 7, 9],
  'PhrygianDom':         [0, 1, 4, 5, 7, 8, 10],
  'HungarianMinor':      [0, 2, 3, 6, 7, 8, 11],
  'BluesMaj':            [0, 2, 3, 4, 7, 9],
  'BluesMin':            [0, 3, 5, 6, 7, 10],
  'WholeTone':           [0, 2, 4, 6, 8, 10],
  'Octatonic':           [0, 1, 3, 4, 6, 7, 9, 10],
  'Byzantine':           [0, 1, 4, 5, 7, 8, 11],
  'DoubleHarmonicMajor': [0, 1, 4, 5, 7, 8, 11],
  'DoubleHarmonicMinor': [0, 1, 3, 6, 7, 8, 11],
  'Messiaen3rdMode':     [0, 2, 3, 4, 6, 7, 8, 10, 11],
};

// Preferred order when multiple regimes match the same set of pitch classes.
// Standard diatonic modes first, then common variants, then exotic scales.
const REGIME_PREFERENCE = [
  'Major', 'Minor', 'Dorian', 'Mixolydian', 'Lydian', 'Phrygian',
  'HarmonicMinor', 'MelodicMinor',
  'Pentatonic',
  'Locrian', 'PhrygianDom', 'HungarianMinor',
  'BluesMaj', 'BluesMin', 'WholeTone', 'Octatonic',
  'Byzantine', 'DoubleHarmonicMajor', 'DoubleHarmonicMinor',
  'Messiaen3rdMode',
];

const NOTE_NAMES = ['C', 'C#/Db', 'D', 'D#/Eb', 'E', 'F', 'F#/Gb', 'G', 'G#/Ab', 'A', 'A#/Bb', 'B'];

/**
 * Given an array of pitch classes (0-11), find the pitchRegime and tonic
 * that best explain them.
 *
 * @param {number[]} pitchClasses - chromatic pitch classes (0-11), any order
 * @param {number|null} preferredTonic - if given, try this tonic PC first
 * @returns {{ pitchRegime: string, tonicPc: number, scaleLength: number, confidence: string, allMatches: Array }}
 *   confidence: 'exact' = input PCs exactly match a regime
 *               'subset' = input PCs are a subset of a regime
 *               '12Tone' = no match, fallback
 */
function findRegime(pitchClasses, preferredTonic = null) {
  // Deduplicate and normalize to 0-11
  const pcs = [...new Set(pitchClasses.map(pc => ((pc % 12) + 12) % 12))].sort((a, b) => a - b);

  if (pcs.length === 0) {
    return { pitchRegime: '12Tone', tonicPc: 0, scaleLength: 12, confidence: '12Tone', allMatches: [] };
  }

  // Build tonic candidates: preferred first, then input PCs in order, then all 12
  const tonicCandidates = [];
  if (preferredTonic !== null) {
    tonicCandidates.push(((preferredTonic % 12) + 12) % 12);
  }
  for (const pc of pcs) {
    if (!tonicCandidates.includes(pc)) tonicCandidates.push(pc);
  }
  for (let i = 0; i < 12; i++) {
    if (!tonicCandidates.includes(i)) tonicCandidates.push(i);
  }

  const allMatches = [];

  // Phase 1: exact matches (input count == regime size)
  // Iterate regimes first so the preference order dominates over tonic order.
  for (const regime of REGIME_PREFERENCE) {
    const regimePcs = REGIME_PITCH_CLASSES[regime];
    if (regimePcs.length !== pcs.length) continue;

    for (const tonic of tonicCandidates) {
      const intervals = pcs.map(pc => ((pc - tonic) % 12 + 12) % 12).sort((a, b) => a - b);
      if (intervals.every((v, i) => v === regimePcs[i])) {
        allMatches.push({ pitchRegime: regime, tonicPc: tonic, scaleLength: regimePcs.length, confidence: 'exact' });
      }
    }
  }

  if (allMatches.length > 0) {
    // If a preferred tonic was given, prioritize matches using that tonic
    if (preferredTonic !== null) {
      const normalizedPref = ((preferredTonic % 12) + 12) % 12;
      const onPreferred = allMatches.filter(m => m.tonicPc === normalizedPref);
      if (onPreferred.length > 0) {
        return { ...onPreferred[0], allMatches };
      }
    }
    const best = allMatches[0];
    return { ...best, allMatches };
  }

  // Phase 2: subset matches (input PCs are a subset of a regime)
  // Prefer smaller scales (tighter fit) first, then regime preference order
  const subsetMatches = [];

  for (const tonic of tonicCandidates) {
    const intervals = new Set(pcs.map(pc => ((pc - tonic) % 12 + 12) % 12));

    for (const regime of REGIME_PREFERENCE) {
      const regimePcSet = new Set(REGIME_PITCH_CLASSES[regime]);
      if ([...intervals].every(i => regimePcSet.has(i))) {
        subsetMatches.push({
          pitchRegime: regime,
          tonicPc: tonic,
          scaleLength: REGIME_PITCH_CLASSES[regime].length,
          confidence: 'subset',
        });
      }
    }
  }

  if (subsetMatches.length > 0) {
    // Sort: prefer smallest scale that contains all PCs, then regime preference
    subsetMatches.sort((a, b) => {
      if (a.scaleLength !== b.scaleLength) return a.scaleLength - b.scaleLength;
      return REGIME_PREFERENCE.indexOf(a.pitchRegime) - REGIME_PREFERENCE.indexOf(b.pitchRegime);
    });

    // If a preferred tonic was given, prioritize subset matches using that tonic
    if (preferredTonic !== null) {
      const normalizedPref = ((preferredTonic % 12) + 12) % 12;
      const onPreferred = subsetMatches.filter(m => m.tonicPc === normalizedPref);
      if (onPreferred.length > 0) {
        return { ...onPreferred[0], allMatches: subsetMatches };
      }
    }

    const best = subsetMatches[0];
    return { ...best, allMatches: subsetMatches };
  }

  // Phase 3: no match — 12Tone fallback
  return {
    pitchRegime: '12Tone',
    tonicPc: pcs[0],
    scaleLength: 12,
    confidence: '12Tone',
    allMatches: [],
  };
}


/**
 * Convert a chromatic semitone step to a diatonic scale-degree step.
 *
 * @param {number} chromaticStep - signed semitone offset from tonic
 * @param {string} regime - pitchRegime name (key into REGIME_PITCH_CLASSES)
 * @returns {number|null} diatonic step, or null if chromaticStep is not in the scale
 */
function chromaticToDiatonic(chromaticStep, regime) {
  if (regime === '12Tone' || regime === '24Tone') return chromaticStep;

  const pcs = REGIME_PITCH_CLASSES[regime];
  if (!pcs) return null;
  const scaleLen = pcs.length;

  // Handle negative and positive steps uniformly
  // octave: how many full chromatic octaves from 0
  const octave = Math.floor(chromaticStep / 12);
  const pcInOctave = ((chromaticStep % 12) + 12) % 12;

  const idx = pcs.indexOf(pcInOctave);
  if (idx === -1) return null; // not in scale

  return octave * scaleLen + idx;
}

/**
 * Convert a diatonic scale-degree step to a chromatic semitone step.
 *
 * @param {number} diatonicStep - signed scale-degree offset from tonic
 * @param {string} regime - pitchRegime name (key into REGIME_PITCH_CLASSES)
 * @returns {number} chromatic semitone step
 */
function diatonicToChromatic(diatonicStep, regime) {
  if (regime === '12Tone' || regime === '24Tone') return diatonicStep;

  const pcs = REGIME_PITCH_CLASSES[regime];
  if (!pcs) throw new Error(`Unknown regime: ${regime}`);
  const scaleLen = pcs.length;

  const octave = Math.floor(diatonicStep / scaleLen);
  const degreeInOctave = ((diatonicStep % scaleLen) + scaleLen) % scaleLen;

  return octave * 12 + pcs[degreeInOctave];
}


/**
 * Compute a concrete tonic MIDI number from an array of MIDI note numbers
 * and a tonic pitch class (0-11).
 *
 * Places the tonic at or below the lowest note in the melody so that all
 * chromatic offsets (midiNote - tonicMidi) are non-negative.
 *
 * @param {number[]} midiNumbers - absolute MIDI note numbers
 * @param {number} tonicPc - pitch class of the tonic (0-11)
 * @returns {number} tonicMidi
 */
function computeTonicMidi(midiNumbers, tonicPc) {
  const lowest = Math.min(...midiNumbers);
  // Place tonicPc at or below the lowest note
  const pcDiff = ((lowest % 12) - tonicPc + 12) % 12;
  return lowest - pcDiff;
}

/**
 * Convert an array of absolute MIDI note numbers to diatonic scale-degree
 * steps relative to a given tonic and regime.
 *
 * @param {number[]} midiNumbers - absolute MIDI note numbers
 * @param {string} regime - pitchRegime name
 * @param {number} tonicMidi - concrete tonic MIDI number
 * @returns {(number|null)[]} diatonic steps (null where a note is not in the scale)
 */
function midiNotesToDiatonic(midiNumbers, regime, tonicMidi) {
  return midiNumbers.map(midi => chromaticToDiatonic(midi - tonicMidi, regime));
}


// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const isMainModule = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/.*\//, ''));
const args = process.argv.slice(2);

if (isMainModule && args.length > 0) {
  let preferredTonic = null;
  let pcs = [];

  const tonicIdx = args.indexOf('--tonic');
  if (tonicIdx >= 0) {
    preferredTonic = parseInt(args[tonicIdx + 1], 10);
    pcs = args.filter((a, i) => !a.startsWith('--') && i !== tonicIdx + 1).map(Number);
  } else {
    pcs = args.filter(a => !a.startsWith('--')).map(Number);
  }

  if (pcs.some(isNaN)) {
    console.error('Usage: node tools/find-regime.js [--tonic N] <pitch-classes...>');
    console.error('  pitch classes are chromatic values 0-11');
    process.exit(1);
  }

  const result = findRegime(pcs, preferredTonic);

  console.log(`pitchRegime: ${result.pitchRegime}`);
  console.log(`tonicPc:     ${result.tonicPc} (${NOTE_NAMES[result.tonicPc]})`);
  console.log(`scaleLength: ${result.scaleLength}`);
  console.log(`confidence:  ${result.confidence}`);

  if (args.includes('--verbose') && result.allMatches.length > 1) {
    console.log(`\nAll matches:`);
    for (const m of result.allMatches.slice(0, 10)) {
      console.log(`  ${m.pitchRegime} tonic=${NOTE_NAMES[m.tonicPc]} (${m.confidence})`);
    }
  }
}

export {
  REGIME_PITCH_CLASSES,
  REGIME_PREFERENCE,
  findRegime,
  chromaticToDiatonic,
  diatonicToChromatic,
  computeTonicMidi,
  midiNotesToDiatonic,
};
