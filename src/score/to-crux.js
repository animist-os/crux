// Score -> Crux pips under a pitch lens, literal program emission, and exact decoding.
import '../index.js';
import { selectVoices } from './musicxml.js';

const LETTERS = 'CDEFGAB';
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const DIATONIC_MODES = {
  Major: [0, 2, 4, 5, 7, 9, 11], Dorian: [0, 2, 3, 5, 7, 9, 10], Phrygian: [0, 1, 3, 5, 7, 8, 10],
  Lydian: [0, 2, 4, 6, 7, 9, 11], Mixolydian: [0, 2, 4, 5, 7, 9, 10], Minor: [0, 2, 3, 5, 7, 8, 10],
  Locrian: [0, 1, 3, 5, 6, 8, 10],
};
export const PITCH_LENSES = ['diatonic', 'chromatic'];

const near = (a, b) => Math.abs(a - b) < 1e-9;

/** Crux numbers have no exponent form; keep common rationals exact. */
export function cruxNumber(value) {
  if (Number.isInteger(value)) return String(value);
  for (let d = 2; d <= 4096; d++) {
    const n = Math.round(value * d);
    if (Math.abs(n / d - value) < 1e-12) return `${n}/${d}`;
  }
  return value.toFixed(12).replace(/0+$/, '').replace(/\.$/, '');
}

export function pipText(p) {
  const head = p.tag === 'r' ? 'r' : cruxNumber(p.step);
  return near(p.timeScale, 1) ? head : `${head} | ${cruxNumber(p.timeScale)}`;
}
export const literalText = pips => `[${pips.map(pipText).join(', ')}]`;

/** Alteration the key signature gives a letter (-1, 0, +1). */
export function keyAlter(fifths, letter) {
  const sharps = 'FCGDAEB', flats = 'BEADGCF';
  if (fifths > 0) return sharps.indexOf(letter) < fifths ? 1 : 0;
  if (fifths < 0) return flats.indexOf(letter) < -fifths ? -1 : 0;
  return 0;
}

/**
 * A pitch lens maps MIDI notes to Crux steps and back.
 * - chromatic: step = midi - tonicMidi (semitones). Plays in Golden with #pitchRegime 12Tone.
 * - diatonic: step = scale degree in the key-signature collection, counted by letter name
 *   from the tonic. A chromatic note is a half-integer step k + 1/2 = degree k raised a
 *   semitone (F# in C major = 3 1/2, also Gb). Every MIDI pitch has such a code, so the
 *   lens is MIDI-lossless; spelling is preserved except for enharmonic collisions.
 */
export function makeLens(name, key, tonicMidi) {
  if (name === 'chromatic') {
    return { name, tonicMidi, regime: '12Tone',
      encode: note => note.midi - tonicMidi,
      decode: step => {
        if (!Number.isInteger(step)) throw new Error(`Chromatic lens expects integer steps, got ${step}.`);
        return tonicMidi + step;
      } };
  }
  if (name !== 'diatonic') throw new Error(`Unknown pitch lens ${name}.`);
  const ti = LETTERS.indexOf(key.tonicLetter);
  const tonicAlter = keyAlter(key.fifths, key.tonicLetter);
  const tonicOctave = Math.floor((tonicMidi - LETTER_PC[key.tonicLetter] - tonicAlter) / 12) - 1;
  if (12 * (tonicOctave + 1) + LETTER_PC[key.tonicLetter] + tonicAlter !== tonicMidi) {
    throw new Error('tonicMidi is not the key tonic.');
  }
  const collection = degree => {
    const index = ti + degree;
    const letter = LETTERS[((index % 7) + 7) % 7];
    const octave = tonicOctave + Math.floor(index / 7);
    return 12 * (octave + 1) + LETTER_PC[letter] + keyAlter(key.fifths, letter);
  };
  const decode = step => {
    const twice = Math.round(step * 2);
    if (!near(twice / 2, step)) throw new Error(`Diatonic lens expects integer or half-integer steps, got ${step}.`);
    return twice % 2 === 0 ? collection(twice / 2) : collection((twice - 1) / 2) + 1;
  };
  const pcs = Array.from({ length: 7 }, (_, d) => ((collection(d) - tonicMidi) % 12 + 12) % 12);
  const regime = Object.entries(DIATONIC_MODES).find(([, set]) => set.every((pc, i) => pc === pcs[i]))?.[0] ?? '12Tone';
  return { name, tonicMidi, regime, collection, decode,
    encode: note => {
      let degree;
      if (note.spelling) {
        degree = 7 * (note.spelling.octave - tonicOctave) + LETTERS.indexOf(note.spelling.letter) - ti;
      } else {
        // No spelling (MIDI input): nearest collection degree at or below.
        degree = Math.floor((note.midi - tonicMidi) * 7 / 12);
        while (collection(degree + 1) <= note.midi) degree++;
        while (collection(degree) > note.midi) degree--;
      }
      const inflection = note.midi - collection(degree);
      const preferred = degree + inflection / 2;
      if (decode(preferred) === note.midi) return preferred;
      // Enharmonic collision (e.g. Fb against an E-F semitone): nearest code that decodes exactly.
      for (let k = 1; k < 16; k++) {
        for (const s of [preferred - k / 2, preferred + k / 2]) if (decode(s) === note.midi) return s;
      }
      throw new Error(`Cannot encode MIDI ${note.midi}.`);
    } };
}

/** Tonic reference near middle C: the tonic pitch from F#3 (54) to F4 (65). */
export function defaultTonicMidi(key) {
  const pc = key.tonicPc;
  return 60 + (pc > 5 ? pc - 12 : pc);
}

/** Time signature in effect at a tick, and the metric beat (dotted for compound meters). */
export function meterAt(score, tick) {
  let ts = score.timeSignatures[0] ?? { tick: 0, beats: 4, beatType: 4 };
  for (const t of score.timeSignatures) if (t.tick <= tick) ts = t;
  const unit = score.ppq * 4 / ts.beatType;
  const compound = ts.beatType === 8 && ts.beats % 3 === 0 && ts.beats > 3;
  return { ...ts, beatTicks: compound ? unit * 3 : unit };
}

/** Measure containing a tick, with the offset into it. */
export function measureAt(score, tick) {
  let lo = 0, hi = score.measures.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (score.measures[mid].tick <= tick) lo = mid; else hi = mid - 1;
  }
  const m = score.measures[lo];
  return { measure: m, offset: tick - m.tick };
}

/**
 * Score -> lanes of pips. Each lane has { role, name, pips, events } where events[i]
 * is the source note behind pips[i], or null for a rest pip. Gaps become rests.
 * Overlapping notes inside a part are split into extra lanes (first fit).
 */
export function scoreToVoices(score, options = {}) {
  const { parts = 'satb', lens: lensName = 'diatonic' } = options;
  if (!score.key && lensName === 'diatonic') throw new Error('Diatonic lens needs a key signature.');
  const key = score.key ?? { fifths: 0, mode: 'major', tonicPc: 0, tonicLetter: 'C' };
  const tonicMidi = options.tonicMidi ?? defaultTonicMidi(key);
  const lens = makeLens(lensName, key, tonicMidi);
  const lanes = [];
  for (const part of selectVoices(score, { parts })) {
    const partLanes = [];
    for (const note of [...part.notes].sort((a, b) => a.tick - b.tick || b.midi - a.midi)) {
      let lane = partLanes.find(l => l.end <= note.tick);
      if (!lane) {
        lane = { role: part.role, name: part.name, partId: part.id, laneIndex: partLanes.length, end: 0, pips: [], events: [] };
        partLanes.push(lane);
      }
      if (note.tick > lane.end) {
        lane.pips.push({ step: 0, timeScale: (note.tick - lane.end) / score.ppq, tag: 'r' });
        lane.events.push(null);
      }
      lane.pips.push({ step: lens.encode(note), timeScale: note.durationTicks / score.ppq });
      lane.events.push(note);
      lane.end = note.tick + note.durationTicks;
    }
    lanes.push(...partLanes);
  }
  return {
    lanes, voices: lanes.map(l => l.pips), lens,
    metadata: { id: score.id, title: score.title, ppq: score.ppq, lens: lens.name, pitchRegime: lens.regime,
      tonicMidi, tonicPc: key.tonicPc, keyFifths: key.fifths, mode: key.mode,
      voices: lanes.map(({ pips, events, end, ...info }) => info) },
  };
}

/** Directive header carrying everything needed to decode steps back to MIDI. */
export function directiveHeader(metadata) {
  return [
    `// ${metadata.title ?? metadata.id ?? 'score'}`,
    `// #pitchRegime ${metadata.pitchRegime}`,
    `// #tonic ${metadata.tonicPc}`,
    `// #tonicMidi ${metadata.tonicMidi}`,
    `// #lens ${metadata.lens}`,
    `// #keyFifths ${metadata.keyFifths}`,
  ].join('\n');
}

/** The literal (uncompressed) Crux program: one mot per voice. */
export function literalProgram(converted, { header = true } = {}) {
  const body = converted.lanes.map(l => `// ${l.role ?? l.name}\n${literalText(l.pips)}`).join('\n!\n');
  return header ? `${directiveHeader(converted.metadata)}\n${body}` : body;
}

/** Interpret Crux and decode every sounding pip to { voice, midi, tick, durationTicks }. */
export function decodeProgram(code, converted) {
  const sections = globalThis.golden.crux_interp(code).sections;
  return sections.map((section, voice) => {
    let time = 0;
    const events = [];
    for (const pip of section.values) {
      if (pip.diad || (pip.tag != null && pip.tag !== 'r')) throw new Error('Unexpected chord or tag in program output.');
      const durationTicks = pip.timeScale * converted.metadata.ppq;
      if (pip.tag !== 'r') events.push({ voice, midi: converted.lens.decode(pip.step), tick: Math.round(time), durationTicks: Math.round(durationTicks) });
      time += durationTicks;
    }
    return events;
  });
}

/** True when a Crux program reproduces every note of every lane exactly (MIDI, onset, duration). */
export function verifyAgainstScore(code, converted) {
  let decoded;
  try { decoded = decodeProgram(code, converted); } catch { return false; }
  if (decoded.length !== converted.lanes.length) return false;
  return converted.lanes.every((lane, v) => {
    const expected = lane.events.filter(Boolean);
    const got = decoded[v];
    return got.length === expected.length && got.every((e, i) =>
      e.midi === expected[i].midi && e.tick === expected[i].tick && e.durationTicks === expected[i].durationTicks);
  });
}

/**
 * Metric and phrase facts for each lane's pips: onset tick, measure number, beat
 * (1-based, fractional within the beat), onBeat, and phraseEnd (a fermata note).
 */
export function voiceMetrics(score, converted) {
  return converted.lanes.map(lane => {
    let tick = 0;
    return lane.pips.map((pip, i) => {
      const { measure } = measureAt(score, tick);
      let { offset } = measureAt(score, tick);
      const { beatTicks, beats, beatType } = meterAt(score, tick);
      const full = beats * score.ppq * 4 / beatType;
      const first = score.measures[0];
      const pickup = measure.durationTicks < full && (measure.index === 0 ||
        (measure.sourceIndex !== undefined && measure.sourceIndex === first.sourceIndex));
      if (pickup) offset += full - measure.durationTicks;
      const info = { tick, measure: measure.number, beat: 1 + offset / beatTicks, onBeat: offset % beatTicks === 0,
        phraseEnd: !!lane.events[i]?.fermata };
      tick += Math.round(pip.timeScale * score.ppq);
      return info;
    });
  });
}
