import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { parseMusicXml, selectVoices, keyInfo, performanceOrder } from '../src/score/musicxml.js';
import { parseXml, children } from '../src/score/xml.js';
import { readZip } from '../src/score/zip.js';
import { parseScore, detectFormat, scoreToVoices, literalProgram, verifyAgainstScore, makeLens, keyAlter } from '../src/score/index.js';

// A small hand-written SATB score: G major, 4/4, pickup-free, two measures.
// Soprano has a tie across the barline, an accidental (C#), and a fermata;
// alto has a rest; tenor uses two voices via <backup>; bass has eighth notes.
const pitched = (step, alter, octave, duration, inner = '') =>
  `<note><pitch><step>${step}</step>${alter ? `<alter>${alter}</alter>` : ''}<octave>${octave}</octave></pitch><duration>${duration}</duration>${inner}</note>`;
const rest = duration => `<note><rest/><duration>${duration}</duration></note>`;
const attrs = '<attributes><divisions>2</divisions><key><fifths>1</fifths><mode>major</mode></key><time><beats>4</beats><beat-type>4</beat-type></time></attributes>';
const part = (id, m1, m2) => `<part id="${id}"><measure number="1">${attrs}${m1}</measure><measure number="2">${m2}</measure></part>`;
export const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.0">
  <work><work-title>Sample &amp; test</work-title></work>
  <part-list>
    <score-part id="P1"><part-name>Soprano</part-name></score-part>
    <score-part id="P2"><part-name>Alto</part-name></score-part>
    <score-part id="P3"><part-name>Tenor</part-name></score-part>
    <score-part id="P4"><part-name>Bass</part-name></score-part>
  </part-list>
  <!-- comment -->
  ${part('P1',
    pitched('G', 0, 4, 2) + pitched('A', 0, 4, 2) + pitched('B', 0, 4, 2) + pitched('C', 1, 5, 2, '<tie type="start"/>'),
    pitched('C', 1, 5, 2, '<tie type="stop"/>') + pitched('D', 0, 5, 2) + pitched('D', 0, 5, 4, '<notations><fermata/></notations>'))}
  ${part('P2',
    pitched('D', 0, 4, 4) + rest(2) + pitched('G', 0, 4, 2),
    pitched('F', 1, 4, 4) + pitched('F', 1, 4, 4, '<notations><fermata/></notations>'))}
  ${part('P3',
    pitched('B', 0, 3, 8, '<voice>1</voice>') + '<backup><duration>8</duration></backup>' + pitched('G', 0, 3, 8, '<voice>2</voice>'),
    pitched('A', 0, 3, 8))}
  ${part('P4',
    pitched('G', 0, 2, 1) + pitched('A', 0, 2, 1) + pitched('B', 0, 2, 2) + pitched('E', 0, 3, 4),
    pitched('D', 0, 3, 8))}
</score-partwise>`;

/** Minimal ZIP writer for tests (deflate), producing a .mxl container. */
export function makeMxl(xml, name = 'score.xml') {
  const files = [
    ['META-INF/container.xml', `<?xml version="1.0"?><container><rootfiles><rootfile full-path="${name}"/></rootfiles></container>`],
    [name, xml],
  ];
  const locals = [], centrals = [];
  let offset = 0;
  for (const [fileName, text] of files) {
    const data = Buffer.from(text, 'utf8');
    const packed = deflateRawSync(data);
    const nameBytes = Buffer.from(fileName);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 6); central.writeUInt16LE(8, 10);
    central.writeUInt32LE(packed.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, packed);
    centrals.push(central, nameBytes);
    offset += 30 + nameBytes.length + packed.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

test('XML parser handles entities, comments, DOCTYPE and nesting', () => {
  const doc = parseXml('<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "b">]><a k="1&amp;2"><!-- c --><b>x &lt; y</b><b/><![CDATA[<raw>]]></a>');
  const a = doc.children[0];
  assert.equal(a.attrs.k, '1&2');
  assert.equal(children(a, 'b').length, 2);
  assert.equal(children(a, 'b')[0].text, 'x < y');
  assert.equal(a.text, '<raw>');
  assert.throws(() => parseXml('<a><b></a>'), /Mismatched/);
  assert.throws(() => parseXml('<a>x<![CDATA[oops</a>'), /Unterminated/);
  assert.throws(() => parseXml('<a><!-- open'), /Unterminated/);
});

test('ZIP reader inflates a compressed MusicXML container', () => {
  const entries = readZip(makeMxl(SAMPLE));
  assert.ok(entries.has('META-INF/container.xml'));
  assert.equal(entries.get('score.xml').toString('utf8'), SAMPLE);
  assert.equal(detectFormat(makeMxl(SAMPLE)), 'musicxml');
  assert.equal(detectFormat(Buffer.from(SAMPLE)), 'musicxml');
});

test('MusicXML parse: parts, ties, chords/backup, rests, fermatas, key and meter', () => {
  for (const bytes of [Buffer.from(SAMPLE), makeMxl(SAMPLE)]) {
    const score = parseMusicXml(bytes, { id: 'sample' });
    assert.equal(score.title, 'Sample & test');
    assert.equal(score.ppq, 2);
    assert.deepEqual(score.key, { fifths: 1, mode: 'major', tonicPc: 7, tonicLetter: 'G' });
    assert.deepEqual(score.timeSignatures, [{ tick: 0, beats: 4, beatType: 4 }]);
    assert.equal(score.measures.length, 2);
    assert.equal(score.measures[1].tick, 8);
    const [s, a, t, b] = selectVoices(score);
    assert.deepEqual(s.notes.map(n => [n.midi, n.tick, n.durationTicks]),
      [[67, 0, 2], [69, 2, 2], [71, 4, 2], [73, 6, 4], [74, 10, 2], [74, 12, 4]]);
    assert.equal(s.notes[3].tieMerged, true);
    assert.deepEqual(s.notes[3].spelling, { letter: 'C', alter: 1, octave: 5 });
    assert.equal(s.notes[5].fermata, true);
    assert.deepEqual(a.notes.map(n => n.tick), [0, 6, 8, 12]);
    assert.deepEqual(t.notes.map(n => [n.midi, n.tick]), [[59, 0], [55, 0], [57, 8]]);
    assert.deepEqual(b.notes.map(n => n.durationTicks), [1, 1, 2, 4, 8]);
  }
});

test('performance order expands repeats and numbered endings', () => {
  const el = (tag, attrs = {}, kids = []) => ({ tag, attrs, children: kids, text: '' });
  const m = (...barlines) => el('measure', {}, barlines);
  const bar = (...kids) => el('barline', {}, kids);
  const fwd = el('repeat', { direction: 'forward' }), back = el('repeat', { direction: 'backward' });
  const ending = (number, type) => el('ending', { number, type });
  // |: 0 1 | [1. 2 :| [2. 3 ] | 4   (each ending opens on its left barline, closes on its right)
  const measures = [m(bar(fwd)), m(), m(bar(ending('1', 'start')), bar(ending('1', 'stop'), back)),
    m(bar(ending('2', 'start')), bar(ending('2', 'discontinue'))), m()];
  assert.deepEqual(performanceOrder(measures), [0, 1, 2, 0, 1, 3, 4]);
  // A three-measure first ending: its middle measure carries no <ending> element.
  const long = [m(), m(bar(ending('1', 'start'))), m(), m(bar(ending('1', 'stop'), back)),
    m(bar(ending('2', 'start')), bar(ending('2', 'stop'))), m()];
  assert.deepEqual(performanceOrder(long), [0, 1, 2, 3, 0, 4, 5]);
  // After the last ending, a later :| repeats from the measure after it.
  const later = [m(), m(bar(ending('1', 'start')), bar(ending('1', 'stop'), back)),
    m(bar(ending('2', 'start')), bar(ending('2', 'stop'))), m(), m(bar(back)), m()];
  assert.deepEqual(performanceOrder(later), [0, 1, 0, 2, 3, 4, 3, 4, 5]);
  // Plain repeat from the start, then a second repeated section.
  const plain = [m(), m(bar(back)), m(bar(fwd)), m(bar(back)), m()];
  assert.deepEqual(performanceOrder(plain), [0, 1, 0, 1, 2, 3, 2, 3, 4]);
});

test('key signatures, letters and tonic for every key', () => {
  assert.equal(keyInfo(-3, 'minor').tonicLetter, 'C');
  assert.equal(keyInfo(-3, 'major').tonicLetter, 'E');
  assert.equal(keyInfo(4, 'minor').tonicLetter, 'C'); // C# minor (letter C, sharp from the signature)
  assert.equal(keyInfo(4, 'minor').tonicPc, 1);
  assert.deepEqual([keyInfo(0, 'dorian').tonicLetter, keyInfo(0, 'dorian').tonicPc], ['D', 2]);
  assert.deepEqual([keyInfo(-1, 'mixolydian').tonicLetter, keyInfo(-1, 'mixolydian').tonicPc], ['C', 0]);
  assert.equal(keyAlter(2, 'C'), 1);
  assert.equal(keyAlter(2, 'G'), 0);
  assert.equal(keyAlter(-2, 'E'), -1);
});

test('diatonic lens: spelled degrees, half-step inflections, MIDI-lossless in every key', () => {
  const c = makeLens('diatonic', keyInfo(0, 'major'), 60);
  const spell = (letter, alter, octave) => ({ midi: 12 * (octave + 1) + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[letter] + alter, spelling: { letter, alter, octave } });
  assert.equal(c.encode(spell('G', 0, 4)), 4);
  assert.equal(c.encode(spell('F', 1, 4)), 3.5);
  assert.equal(c.encode(spell('B', -1, 4)), 5.5);
  assert.equal(c.encode(spell('C', 0, 5)), 7);
  assert.equal(c.encode(spell('B', 0, 3)), -1);
  assert.equal(c.decode(3.5), 66);
  // Fb collides with E (a semitone pair); it is coded exactly as E.
  assert.equal(c.decode(c.encode(spell('F', -1, 4))), 64);
  for (let fifths = -7; fifths <= 7; fifths++) for (const mode of ['major', 'minor']) {
    const key = keyInfo(fifths, mode);
    const tonic = 60 + (key.tonicPc > 5 ? key.tonicPc - 12 : key.tonicPc);
    const lens = makeLens('diatonic', key, tonic);
    for (let midi = 30; midi <= 90; midi++) {
      assert.equal(lens.decode(lens.encode({ midi })), midi, `${fifths} ${mode} ${midi}`);
      for (const letter of 'CDEFGAB') for (const alter of [-1, 0, 1]) {
        const octave = Math.floor((midi - ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[letter] + alter)) / 12) - 1;
        const n = spell(letter, alter, octave);
        if (n.midi === midi) assert.equal(lens.decode(lens.encode(n)), midi);
      }
    }
  }
  const chrom = makeLens('chromatic', keyInfo(1, 'major'), 55);
  assert.equal(chrom.encode({ midi: 67 }), 12);
  assert.equal(chrom.decode(-3), 52);
});

test('Score -> literal Crux round-trips every voice exactly, in both lenses', () => {
  const score = parseScore(makeMxl(SAMPLE), { id: 'sample' });
  for (const lens of ['diatonic', 'chromatic']) {
    const converted = scoreToVoices(score, { lens });
    assert.equal(converted.lanes.length, 5); // tenor's second voice becomes its own lane
    assert.deepEqual(converted.lanes.map(l => l.role), ['S', 'A', 'T', 'T', 'B']);
    const code = literalProgram(converted);
    assert.match(code, /#lens/);
    assert.equal(verifyAgainstScore(code, converted), true);
    // A one-note change must fail verification.
    assert.equal(verifyAgainstScore(code.replace('[', '[9, '), converted), false);
  }
  const diatonic = scoreToVoices(score, { lens: 'diatonic' });
  assert.deepEqual(diatonic.voices[0].map(p => p.step), [7, 8, 9, 10.5, 11, 11]);
  assert.equal(diatonic.voices[1][1].tag, 'r');
});

// The local corpus is optional (the monorepo layout puts it at ../media/music_xml/bach).
const corpusDir = path.resolve(import.meta.dirname, '../../media/music_xml/bach');
test('real chorales agree with the independent soprano fixture manifest', { skip: !fs.existsSync(corpusDir) && 'corpus not present' }, () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'fixtures/bach/manifest.json'), 'utf8'));
  for (const piece of manifest.pieces) {
    const score = parseMusicXml(fs.readFileSync(path.join(corpusDir, piece.sourceFile)));
    const soprano = selectVoices(score)[0];
    const scale = 480 / score.ppq;
    assert.deepEqual(soprano.notes.map(n => ({ midi: n.midi, ticks: n.tick * scale, durationTicks: n.durationTicks * scale })), piece.notes, piece.id);
    for (const lens of ['diatonic', 'chromatic']) {
      const converted = scoreToVoices(score, { lens });
      assert.equal(verifyAgainstScore(literalProgram(converted), converted), true, `${piece.id} ${lens}`);
    }
  }
});

test('MIDI input: key signature with minor scale, tracks become parts', async () => {
  const { default: pkg } = await import('@tonejs/midi');
  const midi = new pkg.Midi();
  midi.header.keySignatures.push({ key: 'C', scale: 'minor', ticks: 0 }); // A minor (no accidentals)
  const track = midi.addTrack();
  track.name = 'Soprano';
  [69, 71, 72, 68, 69].forEach((m, i) => track.addNote({ midi: m, ticks: i * midi.header.ppq, durationTicks: midi.header.ppq }));
  const score = parseScore(Buffer.from(midi.toArray()), { id: 'tiny' });
  assert.equal(score.format, 'midi');
  assert.deepEqual([score.key.fifths, score.key.mode, score.key.tonicLetter], [0, 'minor', 'A']);
  const converted = scoreToVoices(score, { parts: 'all', lens: 'diatonic' });
  assert.deepEqual(converted.voices[0].map(p => p.step), [7, 8, 9, 13 / 2, 7]); // A4 is degree 7 above A3; G#4 is the raised 7th
  assert.equal(verifyAgainstScore(literalProgram(converted), converted), true);
});

test('key: soprano mode wins, signature by majority (corpus encoding quirks)', () => {
  const withKeys = (keys) => SAMPLE.replace(/<key><fifths>1<\/fifths><mode>major<\/mode><\/key>/g, () => keys.shift());
  // Soprano says minor, the others say major (101 corpus scores look like this).
  let score = parseMusicXml(Buffer.from(withKeys(['<key><fifths>0</fifths><mode>minor</mode></key>',
    '<key><fifths>0</fifths><mode>major</mode></key>', '<key><fifths>0</fifths></key>', '<key><fifths>0</fifths><mode>major</mode></key>'])));
  assert.deepEqual([score.key.mode, score.key.tonicLetter], ['minor', 'A']);
  // Soprano signature disagrees with the other three: the majority wins, with a warning.
  score = parseMusicXml(Buffer.from(withKeys(['<key><fifths>0</fifths></key>', '<key><fifths>-2</fifths></key>',
    '<key><fifths>-2</fifths></key>', '<key><fifths>-2</fifths></key>'])));
  assert.equal(score.key.fifths, -2);
  assert.ok(score.warnings.some(w => /disagree/.test(w)));
});
