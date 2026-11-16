// Standard MIDI file -> normalized Score (same shape as musicxml.js produces).
// MIDI has no spelling, so the diatonic lens spells chromatic notes as raised degrees.
import pkg from '@tonejs/midi';
import { keyInfo, partRole } from './musicxml.js';
const { Midi } = pkg;

// Krumhansl-Kessler key profiles.
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function correlate(x, y) {
  const mx = x.reduce((a, b) => a + b) / 12, my = y.reduce((a, b) => a + b) / 12;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < 12; i++) { num += (x[i] - mx) * (y[i] - my); dx += (x[i] - mx) ** 2; dy += (y[i] - my) ** 2; }
  return num / Math.sqrt(dx * dy || 1);
}

/** Duration-weighted Krumhansl-Schmuckler key estimate -> { fifths, mode }. */
export function estimateKey(notes) {
  const hist = new Array(12).fill(0);
  for (const n of notes) hist[n.midi % 12] += n.durationTicks;
  let best = null;
  for (let tonic = 0; tonic < 12; tonic++) {
    for (const [mode, profile] of [['major', MAJOR], ['minor', MINOR]]) {
      const rotated = profile.map((_, i) => profile[(i - tonic + 12) % 12]);
      const r = correlate(hist, rotated);
      if (!best || r > best.r) best = { tonic, mode, r };
    }
  }
  const majorPc = best.mode === 'minor' ? (best.tonic + 3) % 12 : best.tonic;
  // Signature with the fewest accidentals for that major tonic.
  const candidates = [];
  for (let f = -6; f <= 6; f++) if (((f * 7) % 12 + 12) % 12 === majorPc) candidates.push(f);
  const fifths = candidates.sort((a, b) => Math.abs(a) - Math.abs(b))[0];
  return { fifths, mode: best.mode, confidence: best.r };
}

export function parseMidi(bytes, options = {}) {
  const midi = new Midi(bytes);
  const ppq = midi.header.ppq;
  if (!Number.isSafeInteger(ppq) || ppq <= 0) throw new Error('Expected PPQ MIDI timing.');
  const tracks = midi.tracks.filter(t => t.notes.length);
  if (!tracks.length) throw new Error('No notes in MIDI file.');
  const parts = tracks.map((t, i) => ({
    id: `T${midi.tracks.indexOf(t)}`, name: t.name || `Track ${i + 1}`, role: partRole(t.name), transposed: false,
    notes: t.notes.map(n => ({ tick: n.ticks, durationTicks: n.durationTicks, midi: n.midi, spelling: null,
      voice: '1', fermata: false, tieMerged: false, measureIndex: 0 }))
      .sort((a, b) => a.tick - b.tick || b.midi - a.midi),
  }));
  for (const p of parts) if (p.notes.some(n => n.durationTicks <= 0)) throw new Error('Zero-duration MIDI note.');
  // Unnamed four-part files: assign SATB by descending mean pitch.
  if (parts.length === 4 && parts.every(p => !p.role)) {
    const byPitch = [...parts].sort((a, b) => mean(b.notes) - mean(a.notes));
    byPitch.forEach((p, i) => { p.role = 'SATB'[i]; });
  }
  const sig = midi.header.keySignatures?.[0];
  let key;
  if (options.key) key = options.key;
  else if (sig) {
    // Tone.js names the signature by its major key (keySignatureKeys[sf + 7]) for
    // both scales, so the index in that list is the number of fifths.
    const order = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
    const index = order.indexOf(sig.key);
    key = index < 0 ? estimateKey(parts.flatMap(p => p.notes)) : { fifths: index - 7, mode: sig.scale === 'minor' ? 'minor' : 'major' };
  } else key = estimateKey(parts.flatMap(p => p.notes));
  const ts = midi.header.timeSignatures.map(t => ({ tick: t.ticks, beats: t.timeSignature[0], beatType: t.timeSignature[1] }));
  const end = Math.max(...parts.flatMap(p => p.notes.map(n => n.tick + n.durationTicks)));
  const beats = ts[0]?.beats ?? 4, beatType = ts[0]?.beatType ?? 4;
  const measureTicks = ppq * 4 * beats / beatType;
  const measures = [];
  for (let t = 0, i = 0; t < end; t += measureTicks, i++) measures.push({ index: i, number: String(i + 1), tick: t, durationTicks: measureTicks });
  return { format: 'midi', id: options.id ?? null, title: midi.header.name || options.id || null, ppq,
    key: keyInfo(key.fifths, key.mode), keyChanges: [], timeSignatures: ts.length ? ts : [{ tick: 0, beats: 4, beatType: 4 }],
    measures, parts, warnings: sig ? [] : [`key estimated (${key.mode}, ${key.fifths} fifths)`] };
}

const mean = notes => notes.reduce((n, x) => n + x.midi, 0) / notes.length;
