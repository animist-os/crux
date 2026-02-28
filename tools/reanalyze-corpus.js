#!/usr/bin/env node

/**
 * Re-analyze corpus MIDI files to auto-detect pitchRegime and tonic,
 * then convert absolute MIDI note numbers to diatonic scale degrees.
 *
 * Reads each MIDI file, extracts pitch classes from the note numbers,
 * auto-detects the best pitchRegime and tonic via findRegime, then
 * converts each note to a diatonic step. Outputs updated YAML with
 * pitchRegime, tonic, and diatonic crux strings (including directive
 * comments).
 *
 * Usage:
 *   node tools/reanalyze-corpus.js [--dry-run] [--verbose]
 */

import fs from 'node:fs';
import { parse as parseYaml } from 'yaml';
import pkg from '@tonejs/midi';
const { Midi } = pkg;
import { findRegime, chromaticToDiatonic, computeTonicMidi } from './find-regime.js';
import {
  findBaseDuration,
  quantizeTimeScale,
  formatMot,
} from './midi-to-crux.js';

const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

const dryRun = process.argv.includes('--dry-run');
const verbose = process.argv.includes('--verbose');

// Read existing corpus metadata
const corpusPath = new URL('../corpus/melodies.yaml', import.meta.url).pathname;
const corpusYaml = fs.readFileSync(corpusPath, 'utf-8');
const corpus = parseYaml(corpusYaml);

let melodyCount = 0;
let problemCount = 0;
const results = [];

for (const melody of corpus.melodies) {
  const midiPath = new URL(`../corpus/midi_src/${melody.id}.mid`, import.meta.url).pathname;

  if (!fs.existsSync(midiPath)) {
    console.error(`WARNING: MIDI file not found for ${melody.id}`);
    continue;
  }

  const buffer = fs.readFileSync(midiPath);
  const midi = new Midi(buffer);

  // First track with notes
  const track = midi.tracks.find(t => t.notes.length > 0);
  if (!track || track.notes.length === 0) {
    console.error(`WARNING: No notes in MIDI for ${melody.id}`);
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

  // --- Determine pitchRegime and tonic ---
  // Use existing curated values from YAML when available; auto-detect otherwise.
  const midiNumbers = mono.map(n => n.midi);
  let pitchRegime, tonicPc, tonicMidi, confidence;

  if (melody.pitchRegime && melody.tonic != null) {
    pitchRegime = melody.pitchRegime;
    tonicMidi = melody.tonic;
    tonicPc = tonicMidi % 12;
    confidence = 'curated';
  } else {
    const pitchClasses = [...new Set(midiNumbers.map(n => n % 12))];
    const regimeResult = findRegime(pitchClasses);
    pitchRegime = regimeResult.pitchRegime;
    tonicPc = regimeResult.tonicPc;
    tonicMidi = computeTonicMidi(midiNumbers, tonicPc);
    confidence = regimeResult.confidence;
  }

  // Build diatonic pips
  const durations = mono.map(n => n.duration);
  const baseDuration = findBaseDuration(durations);

  const problems = [];
  const pips = [];

  for (let i = 0; i < mono.length; i++) {
    const note = mono[i];

    // Detect rest (gap before this note)
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
  // Build full crux string with directive comments
  const cruxString = `// #pitchRegime ${pitchRegime}\n// #tonic ${tonicPc}\n${cruxMot}`;

  melodyCount++;
  if (problems.length > 0) problemCount += problems.length;

  const result = {
    id: melody.id,
    pitchRegime,
    tonicPc,
    tonicMidi,
    confidence,
    crux: cruxString,
    cruxMot,
    problems,
    originalCrux: melody.crux,
  };
  results.push(result);

  // Summary
  const status = problems.length > 0 ? '  PROBLEMS' : '  OK';
  const rootNote = `${NOTE_NAMES[tonicPc]}${Math.floor(tonicMidi / 12) - 1}`;
  console.error(`${melody.id}: ${pitchRegime} tonic=${rootNote} (MIDI ${tonicMidi}) [${confidence}]${status}`);

  if (verbose || problems.length > 0) {
    const pcs = [...new Set(midiNumbers.map(n => n % 12))].sort((a, b) => a - b);
    console.error(`  PCs:      [${pcs.join(', ')}]`);
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

// Build the updated YAML by patching the original line by line.
// This preserves comments and formatting.
const yamlLines = corpusYaml.split('\n');
const resultMap = new Map(results.map(r => [r.id, r]));

const outLines = [];
let idx = 0;
while (idx < yamlLines.length) {
  const line = yamlLines[idx];

  // Match a list-item id line like "  - id: melody-name"
  const idMatch = line.match(/^(\s+-\s+)id:\s*(\S+)/);
  if (idMatch) {
    const prefix = idMatch[1]; // "  - " (includes the dash)
    const id = idMatch[2];
    const r = resultMap.get(id);
    // Field indent: replace leading "- " with spaces to get property indent
    const fieldIndent = prefix.replace(/-/, ' ');

    if (r) {
      outLines.push(line); // id line
      idx++;

      let emittedRegime = false;
      let emittedCrux = false;

      while (idx < yamlLines.length) {
        const cur = yamlLines[idx];

        // Detect next list item
        if (cur.match(/^\s+-\s+id:/)) break;

        // Detect section separator comment (but not inline notes)
        if (cur.match(/^\s+#\s*---/)) break;

        // Replace or skip old pitchRegime/tonic
        if (cur.match(/^\s+pitchRegime:/)) { idx++; continue; }
        if (cur.match(/^\s+tonic:\s+\d/)) { idx++; continue; }

        // Replace crux line and insert pitchRegime/tonic before it.
        // Also skip any block scalar continuation lines (indented deeper
        // than the crux: key itself).
        if (cur.match(/^\s+crux:/)) {
          const cruxIndent = cur.match(/^(\s+)/)[1].length;

          // Skip this line and any block scalar continuation lines
          idx++;
          while (idx < yamlLines.length) {
            const next = yamlLines[idx];
            // Continuation line: either empty or indented deeper than crux:
            const nextIndentMatch = next.match(/^(\s+)/);
            if (next.trim() === '') break; // blank line ends the block
            if (!nextIndentMatch || nextIndentMatch[1].length <= cruxIndent) break;
            idx++; // skip this continuation line
          }

          if (!emittedRegime) {
            outLines.push(`${fieldIndent}pitchRegime: ${r.pitchRegime}`);
            outLines.push(`${fieldIndent}tonic: ${r.tonicMidi}`);
            emittedRegime = true;
          }
          // Emit crux as block scalar with directive comments
          outLines.push(`${fieldIndent}crux: |`);
          for (const cruxLine of r.crux.split('\n')) {
            outLines.push(`${fieldIndent}  ${cruxLine}`);
          }
          emittedCrux = true;
          continue;
        }

        // Blank line = end of entry
        if (cur.trim() === '') {
          if (!emittedRegime) {
            outLines.push(`${fieldIndent}pitchRegime: ${r.pitchRegime}`);
            outLines.push(`${fieldIndent}tonic: ${r.tonicMidi}`);
            emittedRegime = true;
          }
          if (!emittedCrux) {
            outLines.push(`${fieldIndent}crux: |`);
            for (const cruxLine of r.crux.split('\n')) {
              outLines.push(`${fieldIndent}  ${cruxLine}`);
            }
            emittedCrux = true;
          }
          outLines.push(cur);
          idx++;
          break;
        }

        // Copy other lines (name, source, category, key, notes)
        outLines.push(cur);
        idx++;
      }
      continue;
    }
  }

  outLines.push(line);
  idx++;
}

const updatedYaml = outLines.join('\n');
fs.writeFileSync(corpusPath, updatedYaml);
console.error(`Wrote ${corpusPath}`);
