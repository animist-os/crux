#!/usr/bin/env node
// Key lane: chromatic inflection as post-processing. The Crux parser is not changed.
//
//   node tools/key-lane.js program.crux                      print each voice with inflections applied
//   node tools/key-lane.js program.crux --compare other.crux check against a half-step program
//
// The program holds integer scale steps only. One directive comment carries the key lane:
//
//   // #meter 3/4
//   // #keyLane 1 I, 7 V, 15 ii, 16 IV, 25:1:-2 IV, 29 I
//
// Each entry is a bar address and a key as a Roman numeral (upper case major, lower case
// harmonic minor, "+" melodic minor, "-" natural minor). The first form, a mot of scale
// degrees and lengths, is still read: // #keyLane [0 | 3, 3 | 4]. Full description:
// disrupterbox docs/crux-key-lane.md. Output uses the half-step code of the diatonic lens:
// degree + 1/2 is the degree raised a semitone.
import fs from 'node:fs';
import '../src/index.js';

// ---- key lane core (the same text is in crux/tools/key-lane.js; keep them the same) ----
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11];
const MELODIC_MINOR = [0, 2, 3, 5, 7, 9, 11];
const NATURAL_MINOR = [0, 2, 3, 5, 7, 8, 10];
const NUMERALS = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'];
const EPS = 1e-9;
const mod = (n, m) => ((n % m) + m) % m;

// "3/4" -> { beats: 3, unit: 4 }. No text -> 4/4. Bad text -> null.
function parseMeter(text) {
    if (text == null || String(text).trim() === '') return { beats: 4, unit: 4 };
    const m = /^(\d+)\s*\/\s*(\d+)$/.exec(String(text).trim());
    if (!m || Number(m[1]) < 1 || Number(m[2]) < 1) return null;
    return { beats: Number(m[1]), unit: Number(m[2]) };
}

// "IV", "ii", "ii+", "ii-", "bVI" -> a key area, or null.
// Upper case: major. Lower case: harmonic minor, "+" melodic, "-" natural.
function parseNumeral(text) {
    const m = /^([b#]?)([IViv]+)([+-]?)$/.exec(text);
    if (!m) return null;
    const key = NUMERALS.indexOf(m[2].toLowerCase());
    const upper = m[2] === m[2].toUpperCase(), lower = m[2] === m[2].toLowerCase();
    if (key < 0 || (!upper && !lower) || (upper && m[3])) return null;
    const local = upper ? MAJOR : m[3] === '+' ? MELODIC_MINOR : m[3] === '-' ? NATURAL_MINOR : HARMONIC_MINOR;
    return { key, local, alter: m[1] === 'b' ? -1 : m[1] === '#' ? 1 : 0, name: text };
}

// "7", "7:3", "8:-1", "8:1:-2" -> quarter notes from the start of bar 1, or { err }.
// Bars, beats and sixteenths count from one. A negative last field counts back
// from the start of the bar (or beat) to its left.
function parseAddress(text, meter) {
    const fields = text.split(':');
    if (fields.length < 1 || fields.length > 3 || !fields.every(f => /^-?\d+$/.test(f))) return { err: `"${text}" is not a bar address.` };
    const [bar, beat, six] = fields.map(Number);
    if (fields.some(f => Number(f) === 0)) return { err: `"${text}": bars, beats and sixteenths count from one.` };
    if (bar < 0 || (fields.length === 3 && beat < 0)) return { err: `"${text}": only the last field can be negative.` };
    const beatQ = 4 / meter.unit, barQ = meter.beats * beatQ;
    if (beat > meter.beats) return { err: `"${text}": the meter has ${meter.beats} beats.` };
    let t = (bar - 1) * barQ;
    if (beat !== undefined) t += beat > 0 ? (beat - 1) * beatQ : beat * beatQ;
    if (six !== undefined) t += six > 0 ? (six - 1) * 0.25 : six * 0.25;
    if (t < -EPS) return { err: `"${text}" is before bar 1.` };
    return { quarters: Math.max(0, t) };
}

// Semitone inflection of each home degree in the key area on degree `key`,
// by the first rule: major where the home scale has a major third above the
// degree, harmonic minor elsewhere, and degree 0 unchanged. Used by the
// [degree | length] form. Null when the home scale is not seven notes.
function inflections(key, home = MAJOR) {
    if (!Array.isArray(home) || home.length !== 7) return null;
    const k = mod(key, 7);
    if (k === 0) return [0, 0, 0, 0, 0, 0, 0];
    const third = mod(home[(k + 2) % 7] - home[k], 12);
    return areaInflections({ key: k, local: third === 4 ? MAJOR : HARMONIC_MINOR, alter: 0 }, home);
}

// The same for one parsed key area.
function areaInflections(area, home = MAJOR) {
    if (!Array.isArray(home) || home.length !== 7) return null;
    if (area.rule) return inflections(area.key, home);
    const v = [0, 0, 0, 0, 0, 0, 0];
    if (area.home) return v;
    const k = mod(area.key, 7);
    for (let j = 0; j < 7; j++) {
        const d = (k + j) % 7;
        v[d] = mod(area.local[j] + home[k] + (area.alter || 0) - home[d] + 6, 12) - 6;
    }
    return v;
}

// Lane text -> { spans, unit, form } or { err }. `interp` runs Crux text.
//   address form  "1 I, 7 V, 8:-1 ii"   unit 'quarter' (quarter notes from bar 1)
//   mot form      "[0 | 3, 3 | 4]"      unit 'crux'    (the voices' timeScale units)
function parseLane(text, options = {}) {
    const source = String(text).trim();
    if (source.startsWith('[')) {
        let values;
        try {
            const sections = options.interp(source).sections;
            if (sections.length !== 1) return { err: 'The key lane must be one mot.' };
            values = sections[0].values;
        } catch (e) {
            return { err: 'The key lane did not parse: ' + String((e && e.message) || e).split('\n')[0] };
        }
        const spans = [];
        let t = 0;
        for (const p of values) {
            const dur = Math.abs(p.timeScale);
            if (p.tag || !Number.isInteger(p.step)) return { err: 'Key lane entries must be integer scale degrees.' };
            if (!(dur > 0)) return { err: 'Key lane entries need a positive length.' };
            spans.push({ start: t, end: t + dur, key: p.step, rule: true });
            t += dur;
        }
        if (!spans.length) return { err: 'The key lane is empty.' };
        return { spans, unit: 'crux', form: 'mot' };
    }
    const meter = options.meter || { beats: 4, unit: 4 };
    const spans = [];
    for (const raw of source.split(',')) {
        const m = /^(\S+)\s+(\S+)$/.exec(raw.trim());
        if (!m) return { err: `Key lane entry "${raw.trim()}" should be an address and a key, as in "7 V".` };
        const at = parseAddress(m[1], meter);
        if (at.err) return at;
        const area = parseNumeral(m[2]);
        if (!area) return { err: `"${m[2]}" is not a key. Use Roman numerals: IV, ii, ii+, ii-, bVI.` };
        const last = spans[spans.length - 1];
        if (last && at.quarters <= last.start + EPS) return { err: `Key lane entry "${raw.trim()}" is not later than the entry before it.` };
        if (last) last.end = at.quarters;
        spans.push({ start: at.quarters, end: Infinity, ...area });
    }
    if (!spans.length) return { err: 'The key lane is empty.' };
    if (spans[0].start > EPS) spans.unshift({ start: 0, end: spans[0].start, home: true, name: '(home)' });
    return { spans, unit: 'quarter', form: 'address', meter };
}

// The key area in force at `time` (in the lane's unit). The last one holds.
function spanAt(lane, time) {
    const spans = lane.spans;
    let lo = 0, hi = spans.length - 1;
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (spans[mid].start <= time + EPS) lo = mid; else hi = mid - 1;
    }
    return spans[lo];
}

// Semitones to add to scale step `step` at `time` (in the lane's unit).
function inflectionAt(lane, time, step, home = MAJOR) {
    if (!lane || !Number.isInteger(step)) return 0;
    const area = spanAt(lane, time);
    const tag = home.join(',');
    if (area._home !== tag) { area._v = areaInflections(area, home); area._home = tag; }
    return area._v ? area._v[mod(step, 7)] : 0;
}

// A directive's value from program text (the last one wins), or null. Names
// are matched without regard to case.
function directive(code, name) {
    if (typeof code !== 'string') return null;
    const re = new RegExp('^\\s*//\\s*#' + name + '\\s+(.+?)\\s*$', 'gim');
    let text = null, m;
    while ((m = re.exec(code))) text = m[1];
    return text;
}

// Tone.js note value -> quarter notes: "4n" 1, "8n" 0.5, "8t" 1/3, "4n." 1.5, "1m" one bar.
function quantaQuarters(text, meter = { beats: 4, unit: 4 }) {
    const m = /^(\d+)([nmt])(\.?)$/.exec(String(text || '').trim());
    if (!m) return null;
    const n = Number(m[1]);
    let q = m[2] === 'm' ? n * meter.beats * 4 / meter.unit : m[2] === 't' ? (4 / n) * 2 / 3 : 4 / n;
    if (m[3]) q *= 1.5;
    return q;
}

// Program text -> parsed lane, { err }, or null when the program has none.
function laneFromCode(code, interp) {
    const text = directive(code, 'keyLane');
    if (!text) return null;
    const meter = parseMeter(directive(code, 'meter'));
    if (!meter) return { err: 'The #meter directive should look like 3/4.' };
    return parseLane(text, { meter, interp });
}
// ---- end of key lane core ----

const interp = source => globalThis.golden.crux_interp(source);
export { parseMeter, parseNumeral, parseAddress, inflections, areaInflections, parseLane, spanAt, inflectionAt, quantaQuarters, directive };

export function readLane(code) {
  const lane = laneFromCode(code, interp);
  if (!lane) throw new Error('No "// #keyLane" directive found.');
  if (lane.err) throw new Error(lane.err);
  return lane;
}

/** Interpret the program and apply the lane to every voice. Home scale: major. */
export function applyKeyLane(code, home = MAJOR) {
  const lane = readLane(code);
  const meter = lane.meter || parseMeter(directive(code, 'meter')) || { beats: 4, unit: 4 };
  // Quarter notes per timeScale unit, for a lane addressed in bars.
  const perUnit = lane.unit === 'quarter' ? (quantaQuarters(directive(code, 'quanta') || '8n', meter) ?? 0.5) : 1;
  return interp(code).sections.map(section => {
    let t = 0;
    return section.values.map(p => {
      const at = t * perUnit;
      t += Math.abs(p.timeScale);
      if (p.tag === 'r') return { step: 0, timeScale: Math.abs(p.timeScale), tag: 'r' };
      if (!Number.isInteger(p.step)) throw new Error(`Key-lane programs use integer steps, got ${p.step}.`);
      const inf = inflectionAt(lane, at, p.step, home);
      return { step: p.step + inf / 2, timeScale: Math.abs(p.timeScale), semitones: inf };
    });
  });
}

function mergeRests(pips) {
  const out = [];
  for (const p of pips) {
    const last = out[out.length - 1];
    if (p.tag === 'r' && last?.tag === 'r') last.timeScale += p.timeScale;
    else out.push({ ...p });
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [file, flag, other] = process.argv.slice(2);
  const voices = applyKeyLane(fs.readFileSync(file, 'utf8'));
  if (flag === '--compare') {
    const expected = interp(fs.readFileSync(other, 'utf8')).sections.map(s => mergeRests(s.values));
    let bad = expected.length === voices.length ? 0 : 1, inflected = 0;
    voices.forEach((voice, v) => {
      const got = mergeRests(voice), exp = expected[v] ?? [];
      if (got.length !== exp.length) bad++;
      got.forEach((p, j) => {
        const e = exp[j];
        if (!p.tag && !Number.isInteger(p.step)) inflected++;
        if (!e || (p.tag ?? null) !== (e.tag ?? null) || Math.abs(p.timeScale - e.timeScale) > 1e-9 ||
            (!p.tag && Math.abs(p.step - e.step) > 1e-9)) {
          if (bad++ < 5) console.log(`voice ${v + 1} pip ${j}: got ${p.tag ?? p.step}, expected ${e?.tag ?? e?.step}`);
        }
      });
    });
    console.log(bad ? `FAILED: ${bad} differences` : `MATCH: ${voices.length} voices, ${inflected} inflected notes`);
    process.exit(bad ? 1 : 0);
  }
  const text = p => (p.tag === 'r' ? 'r' : String(p.step)) + (p.timeScale === 1 ? '' : ` | ${p.timeScale}`);
  console.log(voices.map(v => `[${v.map(text).join(', ')}]`).join('\n!\n'));
}
