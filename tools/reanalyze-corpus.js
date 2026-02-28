#!/usr/bin/env node

/**
 * Generate melodies.yaml from MIDI files in corpus/midi_src/.
 *
 * Scans the midi_src directory for .mid files (ignoring subdirectories),
 * auto-detects pitchRegime and tonic from each file's pitch content,
 * converts notes to diatonic scale degrees, and writes the complete
 * melodies.yaml from scratch.
 *
 * Usage:
 *   node tools/reanalyze-corpus.js [--dry-run] [--verbose]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from '@tonejs/midi';
const { Midi } = pkg;
import { findRegime, chromaticToDiatonic, computeTonicMidi } from './find-regime.js';
import {
  findBaseDuration,
  quantizeTimeScale,
  formatMot,
} from './midi-to-crux.js';

const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

const CATEGORY_PREFIXES = {
  'bach':     'bach',
  'trance':   'edm',
  'acid':     'edm',
  'four-on':  'edm',
  'reich':    'minimalist',
  'glass':    'minimalist',
  'riley':    'minimalist',
  'dies':     'chant',
  'veni':     'chant',
  'ode':      'classical',
  'eine':     'classical',
  'fur':      'classical',
  'mozart':   'classical',
};

function inferCategory(id) {
  for (const [prefix, category] of Object.entries(CATEGORY_PREFIXES)) {
    if (id.startsWith(prefix)) return category;
  }
  return 'folk';
}

function titleCase(str) {
  return str.replace(/(^|\s)\S/g, c => c.toUpperCase());
}

const dryRun = process.argv.includes('--dry-run');
const verbose = process.argv.includes('--verbose');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const midiDir = path.join(__dirname, '..', 'corpus', 'midi_src');
const corpusPath = path.join(__dirname, '..', 'corpus', 'melodies.yaml');

// Scan midi_src/ for .mid files (skip directories and non-.mid files)
const midiFiles = fs.readdirSync(midiDir)
  .filter(f => f.endsWith('.mid') && fs.statSync(path.join(midiDir, f)).isFile())
  .sort();

if (midiFiles.length === 0) {
  console.error('No .mid files found in ' + midiDir);
  process.exit(1);
}

let melodyCount = 0;
let problemCount = 0;
const results = [];

for (const file of midiFiles) {
  const id = path.basename(file, '.mid').replace(/_/g, '-');
  const midiPath = path.join(midiDir, file);

  const buffer = fs.readFileSync(midiPath);
  const midi = new Midi(buffer);

  const track = midi.tracks.find(t => t.notes.length > 0);
  if (!track || track.notes.length === 0) {
    console.error(`WARNING: No notes in MIDI for ${id}`);
    continue;
  }

  // Sort by time, then pitch descending
  const sorted = [...track.notes]
    .filter(n => n.duration > 0)
    .sort((a, b) => a.time - b.time || b.midi - a.midi);

  // Monophonic extraction
  const mono = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = mono[mono.length - 1];
    const prevEnd = prev.time + prev.duration;
    if (sorted[i].time >= prevEnd - 0.001) {
      mono.push(sorted[i]);
    }
  }

  // Auto-detect pitchRegime and tonic from absolute MIDI numbers
  const midiNumbers = mono.map(n => n.midi);
  const pitchClasses = [...new Set(midiNumbers.map(n => n % 12))];
  const regimeResult = findRegime(pitchClasses);
  const pitchRegime = regimeResult.pitchRegime;
  const tonicPc = regimeResult.tonicPc;
  const tonicMidi = computeTonicMidi(midiNumbers, tonicPc);

  // Derive metadata from filename and detected regime/tonic
  const name = titleCase(id.replace(/-/g, ' '));
  const key = `${NOTE_NAMES[tonicPc]} ${pitchRegime}`;
  const category = inferCategory(id);

  // Build diatonic pips
  const durations = mono.map(n => n.duration);
  const baseDuration = findBaseDuration(durations);

  const problems = [];
  const pips = [];

  for (let i = 0; i < mono.length; i++) {
    const note = mono[i];

    if (i > 0) {
      const prev = mono[i - 1];
      const gap = note.time - (prev.time + prev.duration);
      if (gap > baseDuration * 0.1) {
        let ts = gap / baseDuration;
        ts = quantizeTimeScale(ts);
        pips.push({ step: 0, timeScale: ts, tag: 'r' });
      }
    }

    const chrOffset = note.midi - tonicMidi;
    const diatonicStep = chromaticToDiatonic(chrOffset, pitchRegime);

    let ts = note.duration / baseDuration;
    ts = quantizeTimeScale(ts);

    if (diatonicStep === null) {
      const noteName = NOTE_NAMES[((chrOffset % 12) + 12) % 12];
      problems.push(`MIDI ${note.midi} (${noteName}, offset ${chrOffset} from tonic) not in ${pitchRegime}`);
      pips.push({ step: chrOffset, timeScale: ts });
    } else {
      pips.push({ step: diatonicStep, timeScale: ts });
    }
  }

  const cruxMot = formatMot(pips);
  const cruxString = `// #pitchRegime ${pitchRegime}\n// #tonic ${tonicPc}\n${cruxMot}`;

  melodyCount++;
  if (problems.length > 0) problemCount += problems.length;

  results.push({
    id,
    name,
    source: '',
    category,
    key,
    pitchRegime,
    tonicMidi,
    tonicPc,
    confidence: regimeResult.confidence,
    crux: cruxString,
    cruxMot,
    notes: '',
    problems,
  });

  const status = problems.length > 0 ? '  PROBLEMS' : '  OK';
  const rootNote = `${NOTE_NAMES[tonicPc]}${Math.floor(tonicMidi / 12) - 1}`;
  console.error(`${id}: ${pitchRegime} tonic=${rootNote} (MIDI ${tonicMidi}) [${regimeResult.confidence}]${status}`);

  if (verbose || problems.length > 0) {
    console.error(`  PCs:      [${pitchClasses.sort((a, b) => a - b).join(', ')}]`);
    console.error(`  diatonic: ${cruxMot}`);
    if (problems.length > 0) {
      for (const p of problems) console.error(`  PROBLEM:  ${p}`);
    }
  }
}

console.error(`\n${melodyCount} melodies analyzed, ${problemCount} problems`);

if (dryRun) {
  console.error('(dry run — no files modified)');
  console.log(JSON.stringify(results, null, 2));
  process.exit(problemCount > 0 ? 1 : 0);
}

// Generate melodies.yaml from scratch
const yamlLines = [
  '# Crux Test Corpus: Monophonic Diatonic Melodies',
  '#',
  '# Auto-generated by tools/reanalyze-corpus.js from MIDI files in corpus/midi_src/.',
  '# Each melody is a flat Mot string with diatonic scale-degree steps',
  '# relative to the tonic (step 0 = tonic). The pitchRegime field specifies',
  '# the scale/mode, and tonic is the MIDI note number of the tonic pitch.',
  '#',
  '',
  'melodies:',
  '',
];

for (const r of results) {
  yamlLines.push(`  - id: ${r.id}`);
  yamlLines.push(`    name: "${r.name}"`);
  yamlLines.push(`    source: "${r.source}"`);
  yamlLines.push(`    category: ${r.category}`);
  yamlLines.push(`    key: "${r.key}"`);
  yamlLines.push(`    pitchRegime: ${r.pitchRegime}`);
  yamlLines.push(`    tonic: ${r.tonicMidi}`);
  yamlLines.push(`    crux: |`);
  for (const cruxLine of r.crux.split('\n')) {
    yamlLines.push(`      ${cruxLine}`);
  }
  yamlLines.push(`    notes: "${r.notes}"`);
  yamlLines.push('');
}

fs.writeFileSync(corpusPath, yamlLines.join('\n'));
console.error(`Wrote ${corpusPath}`);
