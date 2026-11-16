// MusicXML (.mxl / .xml) -> normalized Score. Node built-ins only.
//
// Score shape (all times are integer ticks at score.ppq ticks per quarter note):
// {
//   format: 'musicxml', id, title, ppq,
//   key: { fifths, mode, tonicPc, tonicLetter } | null,
//   keyChanges: [{ tick, fifths, mode }],
//   timeSignatures: [{ tick, beats, beatType }],
//   measures: [{ index, number, tick, durationTicks }],
//   parts: [{ id, name, role, transposed, notes: [Note] }],
//   warnings: [string],
// }
// Note: { tick, durationTicks, midi, spelling: { letter, alter, octave }, voice,
//         fermata, tieMerged, measureIndex }
import { readZip } from './zip.js';
import { parseXml, child, children, textOf, descendants, select } from './xml.js';

const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const lcm = (a, b) => a / gcd(a, b) * b;

/** Extract the score XML text from compressed (.mxl) or plain MusicXML bytes. */
export function musicXmlText(bytes) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (buffer.readUInt32LE(0) !== 0x04034b50) return buffer.toString('utf8');
  const entries = readZip(buffer);
  const container = entries.get('META-INF/container.xml');
  let name = null;
  if (container) {
    const rootfile = descendants(parseXml(container), 'rootfile')[0];
    name = rootfile?.attrs['full-path'] ?? null;
  }
  name ??= [...entries.keys()].find(n => !n.startsWith('META-INF/') && /\.(xml|musicxml)$/i.test(n));
  if (!name || !entries.has(name)) throw new Error('Compressed MusicXML has no root score file.');
  return entries.get(name).toString('utf8');
}

/** Infer a voice role from a part name (Soprano/Alto/Tenor/Bass, several languages). */
export function partRole(name) {
  const n = (name ?? '').toLowerCase();
  if (/^(sopran|soprano|cantus|discant|treble)/.test(n)) return 'S';
  if (/^(alt|alto|contralto)/.test(n)) return 'A';
  if (/^(tenor|tenore)/.test(n)) return 'T';
  if (/^(bass|basso|bassus)/.test(n)) return 'B';
  return null;
}

/**
 * Parse MusicXML bytes into a Score.
 * options.repeats: 'written' (default; each written measure once) or 'expand'
 *   (performed order: repeat barlines and first/second endings).
 * options.graceNotes: 'omit' (default, warned) or 'reject'.
 */
export function parseMusicXml(bytes, options = {}) {
  const { repeats = 'written', graceNotes = 'omit', id = null } = options;
  if (!['written', 'expand'].includes(repeats)) throw new Error("repeats must be 'written' or 'expand'.");
  if (!['omit', 'reject'].includes(graceNotes)) throw new Error("graceNotes must be 'omit' or 'reject'.");
  const doc = parseXml(musicXmlText(bytes));
  const root = doc.children.find(c => c.tag === 'score-partwise');
  if (!root) {
    if (doc.children.some(c => c.tag === 'score-timewise')) throw new Error('score-timewise MusicXML is not supported.');
    throw new Error('Not a MusicXML score-partwise document.');
  }
  const warnings = [];
  const title = textOf(child(root, 'work'), 'work-title') ?? textOf(root, 'movement-title') ?? id;
  const partInfo = new Map(select(root, 'part-list/score-part').map(p => [p.attrs.id, textOf(p, 'part-name', '')]));

  // Common tick resolution: least common multiple of every <divisions> value.
  let ppq = 1;
  for (const d of descendants(root, 'divisions')) {
    const value = Number(d.text.trim());
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`Invalid <divisions> ${d.text}.`);
    ppq = lcm(ppq, value);
  }

  const parts = [], parsedParts = [];
  for (const partEl of children(root, 'part')) {
    const parsed = parsePart(partEl, ppq, repeats, graceNotes, warnings);
    const name = partInfo.get(partEl.attrs.id) ?? partEl.attrs.id;
    parts.push({ id: partEl.attrs.id, name, role: partRole(name), transposed: parsed.transposed, notes: parsed.notes });
    parsedParts.push(parsed);
  }
  if (!parts.length) throw new Error('MusicXML score has no parts.');
  // Measure map and meter: the soprano if named, else the first concert-pitch part.
  let refIndex = parts.findIndex(p => p.role === 'S');
  if (refIndex < 0) refIndex = Math.max(0, parts.findIndex(p => !p.transposed));
  const reference = parsedParts[refIndex];
  parsedParts.forEach((p, i) => {
    const differs = p.measures.length !== reference.measures.length ||
      p.measures.some((m, j) => m.tick !== reference.measures[j].tick);
    if (differs) warnings.push(`measure layout of part ${parts[i].id} differs from part ${parts[refIndex].id}`);
  });
  // Key: the signature most concert-pitch parts agree on (encodings sometimes
  // disagree), with the mode from whichever parts state one.
  const votes = new Map(), modes = new Map();
  parsedParts.forEach((p, i) => {
    const k = p.keys[0];
    if (!k || parts[i].transposed) return;
    votes.set(k.fifths, (votes.get(k.fifths) ?? 0) + 1 + (i === refIndex ? 0.5 : 0));
    if (k.mode) modes.set(`${k.fifths}|${k.mode}`, (modes.get(`${k.fifths}|${k.mode}`) ?? 0) + 1);
  });
  const fifths = [...votes].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (votes.size > 1) warnings.push(`parts disagree on the key signature; using ${fifths} fifths`);
  // The music21 chorale encodings state the mode reliably only on the soprano
  // (101 scores mark it minor there and major on the other parts), so the
  // reference part's mode wins when it is stated.
  const refKey = reference.keys[0];
  const mode = (refKey?.mode && refKey.fifths === fifths) ? refKey.mode
    : [...modes].filter(([id]) => id.startsWith(`${fifths}|`)).sort((a, b) => b[1] - a[1])[0]?.[0].split('|')[1] ?? 'major';
  const firstKey = fifths === undefined ? null : { fifths, mode };
  return {
    format: 'musicxml', id, title, ppq,
    key: firstKey ? keyInfo(firstKey.fifths, firstKey.mode) : null,
    keyChanges: reference.keys,
    timeSignatures: reference.times,
    measures: reference.measures,
    parts,
    warnings,
  };
}

const MODE_DEGREE = { major: 0, ionian: 0, dorian: 1, phrygian: 2, lydian: 3, mixolydian: 4, minor: 5, aeolian: 5, locrian: 6 };
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];

export function keyInfo(fifths, mode) {
  const name = (mode ?? 'major').toLowerCase();
  const degree = MODE_DEGREE[name] ?? 0;
  const majorPc = ((fifths * 7) % 12 + 12) % 12;
  const tonicPc = (majorPc + MAJOR_SCALE[degree]) % 12;
  // Letter of the major tonic: walk the circle of fifths from C on letters.
  const fifthLetters = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
  const majorLetter = fifthLetters[(((fifths + 1) % 7) + 7) % 7];
  const letters = 'CDEFGAB';
  const tonicLetter = letters[(letters.indexOf(majorLetter) + degree) % 7];
  return { fifths, mode: name in MODE_DEGREE ? name : 'major', tonicPc, tonicLetter };
}

/** Measure order in performance: repeat barlines and numbered endings. */
export function performanceOrder(measures) {
  // Ending numbers apply from an ending's start through its stop/discontinue,
  // which may sit on a later measure (or the right barline of the same one).
  const endingOf = [], endsEnding = [];
  let active = null;
  measures.forEach((m, i) => {
    const endings = children(m, 'barline').map(b => child(b, 'ending')).filter(Boolean);
    const start = endings.find(e => e.attrs.type === 'start');
    if (start) active = String(start.attrs.number).split(/[,\s]+/).filter(Boolean).map(Number);
    endingOf[i] = active;
    endsEnding[i] = endings.some(e => e.attrs.type === 'stop' || e.attrs.type === 'discontinue');
    if (endsEnding[i]) active = null;
  });
  const order = [];
  const exhausted = new Set();
  let i = 0, start = 0, pass = 1, guard = 0;
  while (i < measures.length) {
    if (++guard > measures.length * 20) throw new Error('Repeat structure does not terminate.');
    const barlines = children(measures[i], 'barline');
    const repeat = direction => barlines.map(b => child(b, 'repeat')).find(r => r?.attrs.direction === direction);
    if (repeat('forward') && i !== start) { start = i; pass = 1; }
    const numbers = endingOf[i];
    if (numbers && !numbers.includes(pass)) { i++; continue; }
    order.push(i);
    const backward = repeat('backward');
    if (backward && !exhausted.has(i)) {
      const times = Number(backward.attrs.times ?? 2);
      if (pass < times) { pass++; i = start; continue; }
      exhausted.add(i);
    }
    // After a repeat is done, or after the last ending, a new section starts.
    if (backward || (numbers && endsEnding[i])) { start = i + 1; pass = 1; }
    i++;
  }
  return order;
}

function parsePart(partEl, ppq, repeats, graceNotes, warnings) {
  const measureEls = children(partEl, 'measure');
  const order = repeats === 'expand' ? performanceOrder(measureEls) : measureEls.map((_, i) => i);
  const notes = [];
  const measures = [];
  const keys = [];
  const times = [];
  const activeTies = new Map();
  let divisions = null;
  let transpose = { chromatic: 0, octave: 0 };
  let transposed = false;
  let measureStart = 0;
  for (const measureIndex of order) {
    const m = measureEls[measureIndex];
    let cursor = measureStart, end = measureStart, lastOnset = measureStart;
    for (const item of m.children) {
      if (item.tag === 'attributes') {
        const d = textOf(item, 'divisions');
        if (d !== null) divisions = Number(d);
        const key = child(item, 'key');
        if (key && textOf(key, 'fifths') !== null) {
          // Keep a missing <mode> as null: many encodings state it on one part only.
          const entry = { tick: cursor, fifths: Number(textOf(key, 'fifths')), mode: textOf(key, 'mode') };
          const prev = keys[keys.length - 1];
          if (!prev || prev.fifths !== entry.fifths || (entry.mode && prev.mode !== entry.mode)) keys.push(entry);
        }
        const time = child(item, 'time');
        if (time && textOf(time, 'beats') !== null) {
          const entry = { tick: cursor, beats: Number(textOf(time, 'beats')), beatType: Number(textOf(time, 'beat-type')) };
          const prev = times[times.length - 1];
          if (!prev || prev.beats !== entry.beats || prev.beatType !== entry.beatType) times.push(entry);
        }
        const tr = child(item, 'transpose');
        if (tr) {
          transpose = { chromatic: Number(textOf(tr, 'chromatic', '0')), octave: Number(textOf(tr, 'octave-change', '0')) };
          transposed = transpose.chromatic !== 0 || transpose.octave !== 0;
        }
        continue;
      }
      if (!['note', 'backup', 'forward'].includes(item.tag)) continue;
      if (item.tag === 'note' && child(item, 'grace')) {
        if (graceNotes === 'reject') throw new Error('Grace notes need an explicit performance policy.');
        warnings.push(`grace note omitted in part ${partEl.attrs.id}, measure ${m.attrs.number}`);
        continue;
      }
      if (divisions === null) throw new Error('Missing <divisions> before first timed element.');
      const durationText = textOf(item, 'duration');
      if (durationText === null) {
        if (item.tag === 'note' && child(item, 'cue')) continue;
        throw new Error(`Missing duration in measure ${m.attrs.number}.`);
      }
      const isCue = item.tag === 'note' && !!child(item, 'cue');
      const duration = Number(durationText) * (ppq / divisions);
      if (!Number.isSafeInteger(duration)) throw new Error('Non-integer tick duration.');
      if (item.tag === 'backup') { cursor -= duration; continue; }
      if (item.tag === 'forward') { cursor += duration; end = Math.max(end, cursor); continue; }
      const isChord = !!child(item, 'chord');
      const onset = isChord ? lastOnset : cursor;
      if (!isChord) { lastOnset = onset; cursor += duration; }
      end = Math.max(end, onset + duration);
      const notations = children(item, 'notations');
      const fermata = notations.some(n => child(n, 'fermata'));
      if (isCue) { warnings.push(`cue note treated as silence in part ${partEl.attrs.id}, measure ${m.attrs.number}`); continue; }
      if (child(item, 'rest')) {
        if (fermata) notes.push({ rest: true, tick: onset, durationTicks: duration, fermata: true, measureIndex: measures.length });
        continue;
      }
      if (duration <= 0) throw new Error(`Zero-duration note in measure ${m.attrs.number}.`);
      const pitch = child(item, 'pitch');
      if (!pitch) throw new Error(`Unpitched note in measure ${m.attrs.number}.`);
      const alter = Number(textOf(pitch, 'alter', '0'));
      if (!Number.isInteger(alter)) throw new Error('Microtonal alteration is not supported.');
      const letter = textOf(pitch, 'step');
      const octave = Number(textOf(pitch, 'octave'));
      const written = 12 * (octave + 1) + LETTER_PC[letter] + alter;
      const midi = written + transpose.chromatic + 12 * transpose.octave;
      const voice = textOf(item, 'voice', '1');
      const tieTypes = new Set(children(item, 'tie').map(t => t.attrs.type));
      const key = `${voice}:${midi}`;
      if (tieTypes.has('stop') && activeTies.has(key) &&
          activeTies.get(key).tick + activeTies.get(key).durationTicks !== onset) {
        warnings.push(`tie in part ${partEl.attrs.id}, measure ${m.attrs.number} does not connect; kept as separate notes`);
        activeTies.delete(key);
      }
      if (tieTypes.has('stop') && activeTies.has(key)) {
        const note = activeTies.get(key);
        note.durationTicks += duration;
        note.tieMerged = true;
        note.fermata ||= fermata;
        activeTies.delete(key);
        if (tieTypes.has('start')) activeTies.set(key, note);
        continue;
      }
      if (tieTypes.has('stop')) warnings.push(`tie stop without start in part ${partEl.attrs.id}, measure ${m.attrs.number}`);
      const note = { tick: onset, durationTicks: duration, midi, spelling: { letter, alter, octave },
        voice, fermata, tieMerged: false, measureIndex: measures.length };
      notes.push(note);
      if (tieTypes.has('start')) activeTies.set(key, note);
    }
    measures.push({ index: measures.length, number: m.attrs.number, sourceIndex: measureIndex,
      tick: measureStart, durationTicks: end - measureStart });
    measureStart = end;
  }
  if (activeTies.size) warnings.push(`unterminated tie in part ${partEl.attrs.id}`);
  const sounding = notes.filter(n => !n.rest).sort((a, b) => a.tick - b.tick || b.midi - a.midi);
  // Fermatas on rests are kept as phrase markers on the part.
  const restFermatas = notes.filter(n => n.rest).map(n => ({ tick: n.tick, endTick: n.tick + n.durationTicks }));
  sounding.restFermatas = restFermatas;
  return { notes: sounding, measures, keys, times, transposed };
}

/** Choose the SATB parts of a score (by role), or all parts if roles are absent. */
export function selectVoices(score, { parts = 'satb' } = {}) {
  if (parts === 'all') return score.parts;
  if (Array.isArray(parts)) return parts.map(p => {
    const found = typeof p === 'number' ? score.parts[p] : score.parts.find(x => x.id === p || x.name === p || x.role === p);
    if (!found) throw new Error(`Part ${p} not found.`);
    return found;
  });
  if (parts !== 'satb') throw new Error("parts must be 'satb', 'all', or an array.");
  const chosen = ['S', 'A', 'T', 'B'].map(role => score.parts.find(p => p.role === role)).filter(Boolean);
  if (chosen.length < 4) throw new Error(`Score lacks named SATB parts (found ${chosen.map(p => p.name).join(', ') || 'none'}).`);
  return chosen;
}
