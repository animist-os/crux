#!/usr/bin/env node

/**
 * Extract the monophonic subject from a fugue MIDI file.
 *
 * In a fugue, the subject is stated solo before the second voice enters.
 * This tool detects the first polyphonic overlap and outputs only the
 * notes before that point as a Crux Mot string.
 *
 * Usage:
 *   node tools/extract-fugue-subject.js input.mid [--track N] [--verbose]
 */

import fs from 'node:fs';
import pkg from '@tonejs/midi';
const { Midi } = pkg;
import {
  findBaseDuration,
  quantizeTimeScale,
  formatMot,
} from './midi-to-crux.js';

const TOLERANCE = 0.05; // seconds — tolerate legato overlap in piano MIDI

function extractSubject(buffer, options = {}) {
  const { track: trackIndex = null, verbose = false } = options;

  const midi = new Midi(buffer);

  let track;
  if (trackIndex !== null) {
    track = midi.tracks[trackIndex];
  } else {
    track = midi.tracks.find(t => t.notes.length > 0);
  }
  if (!track || track.notes.length === 0) {
    throw new Error('No notes found.');
  }

  // Sort by time, then pitch
  const sorted = [...track.notes]
    .filter(n => n.duration > 0)
    .sort((a, b) => a.time - b.time || a.midi - b.midi);

  // Find where polyphony begins: the first note that starts before the previous note ends
  const mono = [sorted[0]];
  let cutoffTime = Infinity;

  for (let i = 1; i < sorted.length; i++) {
    const prev = mono[mono.length - 1];
    const prevEnd = prev.time + prev.duration;
    const note = sorted[i];

    if (note.time < prevEnd - TOLERANCE) {
      // Polyphony detected — second voice enters
      cutoffTime = note.time;
      if (verbose) {
        process.stderr.write(`Second voice enters at ${cutoffTime.toFixed(3)}s (MIDI ${note.midi})\n`);
      }
      break;
    }
    mono.push(note);
  }

  if (verbose) {
    process.stderr.write(`Subject: ${mono.length} notes, ends at ${(mono[mono.length - 1].time + mono[mono.length - 1].duration).toFixed(3)}s\n`);
    for (const n of mono) {
      process.stderr.write(`  MIDI ${n.midi} at ${n.time.toFixed(3)}s dur ${n.duration.toFixed(3)}s\n`);
    }
  }

  // Convert to Crux
  const refPitch = mono[0].midi;
  const durations = mono.map(n => n.duration);
  const baseDuration = findBaseDuration(durations);

  if (verbose) {
    process.stderr.write(`Base duration: ${baseDuration.toFixed(4)}s\n`);
  }

  // Build pips (detect rests from gaps)
  const pips = [];
  for (let i = 0; i < mono.length; i++) {
    const note = mono[i];

    // Rest before this note?
    if (i > 0) {
      const prev = mono[i - 1];
      const gap = note.time - (prev.time + prev.duration);
      if (gap > baseDuration * 0.1) {
        let ts = quantizeTimeScale(gap / baseDuration);
        pips.push({ step: 0, timeScale: ts, tag: 'r' });
      }
    }

    const step = note.midi - refPitch;
    let ts = quantizeTimeScale(note.duration / baseDuration);
    pips.push({ step, timeScale: ts });
  }

  return formatMot(pips);
}

// CLI
const args = process.argv.slice(2);
if (args.length > 0) {
  const file = args.find(a => !a.startsWith('--'));
  if (!file) {
    console.error('Usage: node tools/extract-fugue-subject.js input.mid [--track N] [--verbose]');
    process.exit(1);
  }
  const trackArg = args.indexOf('--track');
  const trackNum = trackArg >= 0 ? parseInt(args[trackArg + 1], 10) : null;
  const verbose = args.includes('--verbose');

  try {
    const buffer = fs.readFileSync(file);
    const result = extractSubject(buffer, { track: trackNum, verbose });
    console.log(result);
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }
}

export { extractSubject };
