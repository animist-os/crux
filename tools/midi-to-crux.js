#!/usr/bin/env node

/**
 * MIDI-to-Crux Converter
 *
 * Reads a standard MIDI file and outputs a flat Crux Mot string.
 * Converts absolute MIDI pitches to relative semitone steps and
 * absolute durations to timeScale ratios.
 *
 * Usage:
 *   node tools/midi-to-crux.js input.mid [--track N] [--no-quantize] [--verbose]
 */

import fs from 'node:fs';
import pkg from '@tonejs/midi';
const { Midi } = pkg;

// Common musical fractions for timeScale quantization
const SNAP_FRACTIONS = [
  1/4, 1/3, 1/2, 2/3, 3/4, 1, 4/3, 3/2, 2, 3, 4, 6, 8
];

/**
 * Convert absolute MIDI pitch numbers to relative semitone steps.
 * First note becomes step 0.
 */
export function pitchesToSteps(midiPitches) {
  if (midiPitches.length === 0) return [];
  const ref = midiPitches[0];
  return midiPitches.map(p => p - ref);
}

/**
 * Find the base duration (mode) from an array of durations.
 * Groups values within tolerance (5%) as equivalent.
 */
export function findBaseDuration(durations, tolerance = 0.05) {
  if (durations.length === 0) return 1;

  // Sort durations
  const sorted = [...durations].sort((a, b) => a - b);

  // Group by tolerance
  const groups = [];
  for (const d of sorted) {
    if (d <= 0) continue;
    const existing = groups.find(g => Math.abs(g.value - d) / g.value < tolerance);
    if (existing) {
      existing.count++;
      existing.sum += d;
    } else {
      groups.push({ value: d, count: 1, sum: d });
    }
  }

  if (groups.length === 0) return 1;

  // Return average of the most frequent group
  groups.sort((a, b) => b.count - a.count);
  return groups[0].sum / groups[0].count;
}

/**
 * Convert absolute durations to timeScale ratios relative to a base duration.
 */
export function durationsToTimeScales(durations, baseDuration = null) {
  if (durations.length === 0) return [];
  if (baseDuration === null) {
    baseDuration = findBaseDuration(durations);
  }
  return durations.map(d => d / baseDuration);
}

/**
 * Snap a raw timeScale ratio to the nearest clean musical fraction.
 * Returns the original value if no fraction is close enough.
 */
export function quantizeTimeScale(raw, tolerance = 0.1) {
  for (const frac of SNAP_FRACTIONS) {
    if (Math.abs(raw - frac) / frac < tolerance) {
      return frac;
    }
  }
  // Round to 2 decimal places as fallback
  return Math.round(raw * 100) / 100;
}

/**
 * Detect rests (gaps) between consecutive notes.
 * Returns an interleaved array of note and rest entries.
 */
export function detectRests(notes, baseDuration, threshold = 0.1) {
  if (notes.length === 0) return [];
  const result = [];
  const minGap = baseDuration * threshold;

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];

    // Check for gap before this note (except the first)
    if (i > 0) {
      const prev = notes[i - 1];
      const gap = note.time - (prev.time + prev.duration);
      if (gap > minGap) {
        result.push({ rest: true, duration: gap });
      }
    }

    result.push({ midi: note.midi, duration: note.duration, time: note.time });
  }

  return result;
}

/**
 * Format a timeScale value matching Pip.toString() conventions:
 *   ts === 1        → '' (omitted)
 *   ts === 1/N      → ' | /N'
 *   ts is integer   → ' | N'
 *   else            → ' | decimal'
 */
function formatTimeScale(ts) {
  ts = Math.abs(ts);
  if (ts === 1) return '';

  // Check if ts is 1/N for integer N
  const inv = 1 / ts;
  const invRounded = Math.round(inv);
  if (Math.abs(inv - invRounded) < 1e-10 && invRounded > 0) {
    return ` | /${invRounded}`;
  }

  // Integer timeScale
  if (Number.isInteger(ts)) {
    return ` | ${ts}`;
  }

  // Decimal fallback
  const str = Number(ts.toFixed(6)).toString().replace(/\.0+$/, '');
  return ` | ${str}`;
}

/**
 * Format an array of pip descriptors into a Crux Mot string.
 * Each pip: { step: number, timeScale: number, tag?: string }
 */
export function formatMot(pips) {
  const parts = pips.map(pip => {
    const stepStr = pip.tag === 'r' ? 'r' : String(pip.step);
    return stepStr + formatTimeScale(pip.timeScale);
  });
  return '[' + parts.join(', ') + ']';
}

/**
 * Convert a parsed Midi object to a Crux Mot string.
 */
export function midiToMot(buffer, options = {}) {
  const {
    track: trackIndex = null,
    quantize = true,
    restThreshold = 0.1,
    verbose = false,
  } = options;

  const midi = new Midi(buffer);

  // Select track
  let track;
  if (trackIndex !== null) {
    track = midi.tracks[trackIndex];
    if (!track) {
      throw new Error(`Track ${trackIndex} not found. MIDI has ${midi.tracks.length} track(s).`);
    }
  } else {
    // First track with notes
    track = midi.tracks.find(t => t.notes.length > 0);
    if (!track) {
      throw new Error('No tracks with notes found in MIDI file.');
    }
  }

  // Sort notes by time, then by pitch descending (take highest for polyphonic)
  const sorted = [...track.notes]
    .filter(n => n.duration > 0)
    .sort((a, b) => a.time - b.time || b.midi - a.midi);

  if (sorted.length === 0) {
    throw new Error('Selected track has no notes.');
  }

  // Monophonic extraction: remove overlapping notes (keep highest at each onset)
  const mono = [];
  for (const note of sorted) {
    if (mono.length === 0) {
      mono.push(note);
      continue;
    }
    const prev = mono[mono.length - 1];
    const prevEnd = prev.time + prev.duration;
    // If this note starts before the previous ends, skip it (polyphonic overlap)
    if (note.time < prevEnd - 0.001) {
      if (verbose) {
        process.stderr.write(`Skipping overlapping note: MIDI ${note.midi} at ${note.time.toFixed(3)}s\n`);
      }
      continue;
    }
    mono.push(note);
  }

  if (verbose) {
    process.stderr.write(`Track: ${track.name || '(unnamed)'}\n`);
    process.stderr.write(`Notes (monophonic): ${mono.length}\n`);
    process.stderr.write(`Notes:\n`);
    for (const n of mono) {
      process.stderr.write(`  MIDI ${n.midi} at ${n.time.toFixed(3)}s dur ${n.duration.toFixed(3)}s\n`);
    }
  }

  // Collect all durations for base duration calculation
  const allDurations = mono.map(n => n.duration);
  const baseDuration = findBaseDuration(allDurations);

  if (verbose) {
    process.stderr.write(`Base duration: ${baseDuration.toFixed(4)}s\n`);
  }

  // Detect rests
  const events = detectRests(mono, baseDuration, restThreshold);

  // Build pip descriptors
  const refPitch = mono[0].midi;
  const pips = events.map(ev => {
    if (ev.rest) {
      let ts = ev.duration / baseDuration;
      if (quantize) ts = quantizeTimeScale(ts);
      return { step: 0, timeScale: ts, tag: 'r' };
    }
    const step = ev.midi - refPitch;
    let ts = ev.duration / baseDuration;
    if (quantize) ts = quantizeTimeScale(ts);
    return { step, timeScale: ts };
  });

  return formatMot(pips);
}

/**
 * Read a MIDI file from disk and convert to Crux Mot string.
 */
export async function midiFileToMot(filePath, options = {}) {
  const buffer = fs.readFileSync(filePath);
  return midiToMot(buffer, options);
}

// CLI entry point — only run when invoked directly
const isMainModule = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/.*\//, ''));
const args = process.argv.slice(2);
if (isMainModule && args.length > 0 && !args[0].startsWith('--test')) {
  const file = args.find(a => !a.startsWith('--'));
  if (!file) {
    console.error('Usage: node tools/midi-to-crux.js input.mid [--track N] [--no-quantize] [--verbose]');
    process.exit(1);
  }

  const trackArg = args.indexOf('--track');
  const trackNum = trackArg >= 0 ? parseInt(args[trackArg + 1], 10) : null;
  const quantize = !args.includes('--no-quantize');
  const verbose = args.includes('--verbose');

  try {
    const result = await midiFileToMot(file, { track: trackNum, quantize, verbose });
    console.log(result);
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }
}
