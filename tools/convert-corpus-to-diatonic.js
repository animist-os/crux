#!/usr/bin/env node

/**
 * One-time conversion tool: convert corpus melodies from chromatic (12Tone)
 * steps to diatonic scale-degree steps, adding pitchRegime and tonic fields.
 *
 * Reads melodies.yaml, converts each melody, writes the result to stdout.
 *
 * Usage:
 *   node tools/convert-corpus-to-diatonic.js [--dry-run]
 */

import fs from 'node:fs';
import { chromaticToDiatonic, diatonicToChromatic, REGIME_PITCH_CLASSES } from './find-regime.js';

// Manual mapping: each melody's key → { pitchRegime, tonicPc, tonicMidi }
// We determine the correct regime for each melody based on its key and
// the chromatic intervals actually used.
const MELODY_REGIMES = {
  // FOLK
  'mary-had-a-little-lamb': { pitchRegime: 'Major', tonicPc: 0, tonicMidi: 48 },
  'twinkle-twinkle':        { pitchRegime: 'Major', tonicPc: 0, tonicMidi: 48 },
  'frere-jacques':          { pitchRegime: 'Major', tonicPc: 0, tonicMidi: 48 },
  'greensleeves':           { pitchRegime: 'HarmonicMinor', tonicPc: 9, tonicMidi: 57 },
  'scarborough-fair':       { pitchRegime: 'Dorian', tonicPc: 2, tonicMidi: 50 },
  'amazing-grace':          { pitchRegime: 'Pentatonic', tonicPc: 7, tonicMidi: 55 },
  'auld-lang-syne':         { pitchRegime: 'Pentatonic', tonicPc: 7, tonicMidi: 55 },
  'sakura':                 { pitchRegime: 'Minor', tonicPc: 9, tonicMidi: 57 },  // uses A minor-ish phrygian subset
  'when-the-saints':        { pitchRegime: 'Major', tonicPc: 0, tonicMidi: 48 },

  // BACH
  'bach-invention1':        { pitchRegime: 'Major', tonicPc: 0, tonicMidi: 48 },
  'bach-wtc1-fugue2':       { pitchRegime: 'Minor', tonicPc: 0, tonicMidi: 48 },
  'bach-wtc1-fugue1':       { pitchRegime: 'Major', tonicPc: 0, tonicMidi: 48 },
  'bach-cello-prelude':     { pitchRegime: 'Major', tonicPc: 7, tonicMidi: 55 },
  'bach-art-of-fugue':      { pitchRegime: 'HarmonicMinor', tonicPc: 2, tonicMidi: 50 },
  'bach-little-fugue':      { pitchRegime: 'HarmonicMinor', tonicPc: 7, tonicMidi: 55 },
  'bach-passacaglia':       { pitchRegime: 'Minor', tonicPc: 0, tonicMidi: 48 },
  'bach-wtc1-fugue16':      { pitchRegime: 'Minor', tonicPc: 7, tonicMidi: 55 },
  'bach-wtc1-fugue21':      { pitchRegime: 'Major', tonicPc: 10, tonicMidi: 58 },
  'bach-wtc2-fugue5':       { pitchRegime: 'Major', tonicPc: 2, tonicMidi: 50 },
  'bach-goldberg-bass':     { pitchRegime: 'Major', tonicPc: 7, tonicMidi: 55 },
  'bach-invention4':        { pitchRegime: 'Minor', tonicPc: 2, tonicMidi: 50 },
  'bach-invention8':        { pitchRegime: 'Major', tonicPc: 5, tonicMidi: 53 },

  // CLASSICAL
  'ode-to-joy':             { pitchRegime: 'Major', tonicPc: 2, tonicMidi: 50 },
  'eine-kleine-theme':      { pitchRegime: 'Major', tonicPc: 7, tonicMidi: 55 },
  'fur-elise':              { pitchRegime: 'Minor', tonicPc: 9, tonicMidi: 57 },
  'mozart-k545':            { pitchRegime: 'Major', tonicPc: 0, tonicMidi: 48 },

  // CHANT
  'dies-irae':              { pitchRegime: 'Minor', tonicPc: 2, tonicMidi: 50 },
  'veni-creator':           { pitchRegime: 'Dorian', tonicPc: 2, tonicMidi: 50 },

  // EDM
  'acid-bassline-303':      { pitchRegime: 'Minor', tonicPc: 9, tonicMidi: 57 },
  'four-on-the-floor':      { pitchRegime: 'Major', tonicPc: 0, tonicMidi: 48 },
  'trance-arp':             { pitchRegime: 'Minor', tonicPc: 9, tonicMidi: 57 },

  // MINIMALIST
  'reich-clapping':         { pitchRegime: 'Major', tonicPc: 0, tonicMidi: 48 },
  'glass-arpeggio':         { pitchRegime: 'Major', tonicPc: 0, tonicMidi: 48 },
  'riley-in-c-motif':       { pitchRegime: 'Major', tonicPc: 0, tonicMidi: 48 },
};


/**
 * Parse step values from a crux Mot string.
 * Returns array of { step: number|null, raw: string }
 * where step is the numeric step value (null for rests)
 * and raw is the original token.
 */
function parseCruxSteps(crux) {
  // Strip outer brackets
  const inner = crux.trim().replace(/^\[/, '').replace(/\]$/, '');

  // Split by comma
  const tokens = inner.split(',').map(t => t.trim());

  return tokens.map(token => {
    // Split on | to separate step from timeScale
    const parts = token.split('|').map(p => p.trim());
    const stepPart = parts[0];
    const tsPart = parts.length > 1 ? parts.slice(1).join('|').trim() : null;

    if (stepPart === 'r') {
      return { step: null, isRest: true, tsPart, raw: token };
    }

    const step = parseFloat(stepPart);
    if (isNaN(step)) {
      return { step: null, isRest: false, tsPart, raw: token, error: `unparseable: ${stepPart}` };
    }

    return { step, isRest: false, tsPart, raw: token };
  });
}

/**
 * Rebuild a crux Mot string from parsed tokens with converted steps.
 */
function rebuildCrux(tokens) {
  const parts = tokens.map(t => {
    if (t.isRest) {
      return t.tsPart ? `r | ${t.tsPart}` : 'r';
    }
    if (t.error) {
      return t.raw; // pass through unparseable tokens
    }
    const stepStr = Number.isInteger(t.newStep) ? String(t.newStep) : t.newStep.toString();
    return t.tsPart ? `${stepStr} | ${t.tsPart}` : stepStr;
  });
  return '[' + parts.join(', ') + ']';
}

/**
 * Convert a crux string from chromatic steps to diatonic steps.
 */
function convertCruxString(crux, regime) {
  const tokens = parseCruxSteps(crux);
  const problems = [];

  for (const t of tokens) {
    if (t.isRest || t.error || t.step === null) {
      t.newStep = t.step;
      continue;
    }

    const diatonic = chromaticToDiatonic(t.step, regime);
    if (diatonic === null) {
      problems.push(`step ${t.step} is not in ${regime} scale`);
      t.newStep = t.step; // leave as-is
    } else {
      t.newStep = diatonic;
    }
  }

  return { crux: rebuildCrux(tokens), problems };
}


// --- Verification ---

/**
 * Verify that a diatonic crux string converts back to the original chromatic steps.
 */
function verifyCrux(originalCrux, diatonicCrux, regime) {
  const origTokens = parseCruxSteps(originalCrux);
  const diaTokens = parseCruxSteps(diatonicCrux);

  if (origTokens.length !== diaTokens.length) {
    return `token count mismatch: ${origTokens.length} vs ${diaTokens.length}`;
  }

  for (let i = 0; i < origTokens.length; i++) {
    const orig = origTokens[i];
    const dia = diaTokens[i];

    if (orig.isRest !== dia.isRest) {
      return `token ${i}: rest mismatch`;
    }
    if (orig.isRest) continue;

    const chromatic = diatonicToChromatic(dia.step, regime);
    if (chromatic !== orig.step) {
      return `token ${i}: diatonic ${dia.step} → chromatic ${chromatic}, expected ${orig.step}`;
    }
  }

  return null; // all good
}


// --- Main ---

const dryRun = process.argv.includes('--dry-run');
const verbose = process.argv.includes('--verbose');

const yamlText = fs.readFileSync('corpus/melodies.yaml', 'utf-8');

// Process each melody
const lines = yamlText.split('\n');
const results = [];
let currentId = null;
let melodyCount = 0;
let problemCount = 0;

for (const [id, config] of Object.entries(MELODY_REGIMES)) {
  // Find the crux line for this melody
  const cruxPattern = new RegExp(`id:\\s*${id}\\b`);
  let foundIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(cruxPattern)) {
      foundIdx = i;
      break;
    }
  }

  if (foundIdx === -1) {
    console.error(`WARNING: melody ${id} not found in YAML`);
    continue;
  }

  // Find the crux line
  let cruxIdx = -1;
  for (let j = foundIdx; j < Math.min(foundIdx + 10, lines.length); j++) {
    if (lines[j].match(/^\s+crux:/)) {
      cruxIdx = j;
      break;
    }
  }

  if (cruxIdx === -1) {
    console.error(`WARNING: no crux line found for ${id}`);
    continue;
  }

  // Extract crux value
  const cruxMatch = lines[cruxIdx].match(/crux:\s*"(.+)"/);
  if (!cruxMatch) {
    console.error(`WARNING: can't parse crux line for ${id}: ${lines[cruxIdx]}`);
    continue;
  }

  const originalCrux = cruxMatch[1];
  const { crux: diatonicCrux, problems } = convertCruxString(originalCrux, config.pitchRegime);

  // Verify round-trip
  const verifyError = verifyCrux(originalCrux, diatonicCrux, config.pitchRegime);

  melodyCount++;

  if (verbose || problems.length > 0 || verifyError) {
    console.error(`\n--- ${id} (${config.pitchRegime} tonic=${config.tonicPc}) ---`);
    console.error(`  original:  ${originalCrux}`);
    console.error(`  diatonic:  ${diatonicCrux}`);
    if (problems.length > 0) {
      console.error(`  PROBLEMS:  ${problems.join('; ')}`);
      problemCount += problems.length;
    }
    if (verifyError) {
      console.error(`  VERIFY:    ${verifyError}`);
      problemCount++;
    }
  }

  results.push({ id, config, originalCrux, diatonicCrux, problems, verifyError });
}

console.error(`\n${melodyCount} melodies processed, ${problemCount} problems`);

if (dryRun) {
  console.error('(dry run — no files modified)');
  process.exit(problemCount > 0 ? 1 : 0);
}
