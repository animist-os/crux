import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../src/index.js';
import { foldModel } from '../src/fold/model.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const example = name => fs.readFileSync(path.join(here, '..', 'examples', name), 'utf8');
const fold = (src, options) => foldModel(golden.crux_trace(src), options);
const key = p => `${p.t}/${p.step}`;
const soundingCount = src => golden.crux_interp(src).sections.reduce((n, s) => n + s.values.filter(p => p.tag !== 'r').length, 0);

// The subject of Invention 14, with the definitions from
// examples/bach-invention14.keylane.crux, as a one-voice program.
const SUBJECT = [
  'H  = [0, 1, 2, 1, 0 | 2] || [1/8]',
  'T9 = H, ([4, 2, 7, 4] || [1/4])',
  'T  = T9, [2 | 1/4]',
  'Hi = H m [0]',
  'A  = Hi, ([-4, -2, -7, -5, -6] || [1/4])',
  'Y9 = Hi, ([-4, -2, -6, -4] || [1/4])',
  'Y  = Y9, [-8 | 1/4]',
  'X  = H, ([5, 3, 7, 5, 9] || [1/4])',
  'S  = T, (A * [4]), (T * [-4]), Y, (X * [-6]), (T9 * [-3])',
  'S',
].join('\n');

test('fold: Invention 14 subject, 59 notes fold to 25 pips', () => {
  const m = fold(SUBJECT);
  assert.equal(m.counts.notes, 59);
  assert.equal(m.counts.pipsWritten, 25);
  assert.equal(m.counts.positions[1], 59);
  assert.equal(m.counts.positions[4], 25);
  assert.equal(m.counts.positions[5], 25);
  const ids = m.dictionary.map(e => `${e.id}x${e.count}`);
  assert.deepEqual(ids, ['Hx6', 'T9x3', 'Tx2', 'Ax1', 'Y9x1', 'Yx1', 'Xx1']);
});

test('fold: the six uses of the turn (H and Hi) stack on one shape at stop 4', () => {
  const m = fold(SUBJECT);
  const turn = m.notes.filter(n => n.entry === 'H');
  assert.equal(turn.length, 30);
  assert.equal(new Set(turn.map(n => n.instance)).size, 6);
  assert.equal(new Set(turn.map(n => key(n.pos[3]))).size, 30, 'still apart at stop 3');
  assert.equal(new Set(turn.map(n => key(n.pos[4]))).size, 5, 'one shape at stop 4');
  // The inverted turns (Hi, inside A and Y) are upright from stop 3 on.
  const inA = turn.filter(n => n.index >= 10 && n.index < 15);
  assert.deepEqual(inA.map(n => n.pos[1].step), [4, 3, 2, 3, 4]);
  assert.deepEqual(inA.map(n => n.pos[2].step), [0, -1, -2, -1, 0]);
  assert.deepEqual(inA.map(n => n.pos[3].step), [0, 1, 2, 1, 0]);
});

test('fold: stop 2 puts each instance at its own step 0, keeping time', () => {
  const m = fold(SUBJECT);
  const tStar4 = m.notes.filter(n => n.index >= 20 && n.index < 30); // T * [-4]
  for (const n of tStar4) {
    assert.equal(n.pos[2].t, n.pos[1].t);
    assert.equal(n.pos[2].step, n.pos[1].step + 4);
  }
});

test('fold: stop 1 equals the interpreted steps and times', () => {
  const src = example('bach-invention14.keylane.crux');
  const m = fold(src);
  const r = golden.crux_interp(src);
  for (const n of m.notes) {
    const p = r.sections[n.voice].values[n.index];
    assert.equal(n.pos[1].step, p.step);
    assert.equal(n.pos[1].d, Math.abs(p.timeScale));
  }
});

for (const name of ['bach-invention14.keylane.crux', 'bach-invention14.keylane.v2.crux']) {
  test(`fold: invariants on ${name}`, () => {
    const src = example(name);
    const m = fold(src);
    assert.equal(m.counts.notes, soundingCount(src));
    assert.equal(m.notes.length, m.counts.notes);
    for (const n of m.notes) {
      for (let s = 1; s <= 5; s++) {
        const p = n.pos[s];
        assert.ok(p && Number.isFinite(p.t) && Number.isFinite(p.step) && Number.isFinite(p.d), `note ${n.id} stop ${s}`);
      }
    }
    // Folding never adds positions.
    for (let s = 2; s <= 5; s++) assert.ok(m.counts.positions[s] <= m.counts.positions[s - 1], `stop ${s}`);
    assert.equal(m.dictionary.reduce((n, e) => n + e.count, 0), new Set(m.notes.map(n => n.instance)).size);
    assert.ok(m.dictionary.find(e => e.name === 'H').count > 6);
  });
}

test('fold: v2 marks the notes that @ changes as edited', () => {
  const m = fold(example('bach-invention14.keylane.v2.crux'));
  assert.ok(m.counts.edited > 0);
  for (const n of m.notes.filter(x => x.edited)) assert.equal(n.owner, 'A');
});

test('fold: refuses unseeded random choices, accepts seeded ones', () => {
  assert.throws(() => fold('[{1 -> 6}, 2]'), /seed/);
  const m = fold('[{1 -> 6}$c0de, 2]');
  assert.equal(m.counts.notes, 2);
  assert.throws(() => foldModel(golden.crux_interp('[0]')), /crux_trace/);
});

test('fold: diads move together', () => {
  const m = fold('D = [0 & 2, 1 & 4]\nD, (D * [3])');
  assert.equal(m.counts.notes, 4);
  const [a, , c] = m.notes;
  assert.deepEqual(a.diad, [2]);
  assert.deepEqual(c.diad, [2]);
  assert.equal(c.pos[4].step, a.pos[4].step);
  assert.equal(c.pos[4].t, a.pos[4].t);
});

test('fold: a global statement is one outer transform per voice', () => {
  const m = fold('M = [0, 1]\nM\n!\nM * [2]\n_ * [7]');
  const [v0, v1] = [0, 1].map(v => m.notes.filter(n => n.voice === v));
  assert.deepEqual(v0.map(n => n.pos[1].step), [7, 8]);
  assert.deepEqual(v1.map(n => n.pos[1].step), [9, 10]);
  for (const n of [...v0, ...v1]) assert.equal(n.pos[2].step, n.pos[3].step);
  assert.equal(m.dictionary.length, 1);
  assert.equal(m.dictionary[0].count, 2);
});

test('fold: instance tree nests definitions and keeps literal runs as leaves', () => {
  const m = fold(SUBJECT);
  const [root] = m.instances;
  const S = root.children[0];
  assert.equal(S.kind, 'ref');
  assert.equal(S.name, 'S');
  assert.equal(S.notes, 59);
  const T = S.children[0];
  assert.equal(T.name, 'T');
  assert.deepEqual(T.children.map(c => c.name || c.kind), ['T9', 'lit']);
  // T9 = H, ([4, 2, 7, 4] || [1/4]): the stretch is a node over its literal run.
  assert.deepEqual(T.children[0].children.map(c => c.name || c.op), ['H', '||']);
  assert.equal(T.children[0].children[1].children[0].kind, 'lit');
  assert.deepEqual([S.level, T.level, T.children[0].level, T.children[0].children[0].level], [1, 2, 3, 4]);
  assert.equal(SUBJECT.slice(T.pos, T.pos + 1), 'T');
});

test('fold: from stop 5 a width compares the notes of one shape only', () => {
  // A in halves, B in ones with one long note, and a top-level run with a held note.
  const m = fold([
    'A = [0, 1, 2, 1] || [1/2]',
    'B = [0, 3, 2, 1 | 5]',
    'A, B, (A * [2]), (B * [1]), [7 | 24, 6, 5]',
  ].join('\n'));
  const of = id => m.notes.filter(n => n.entry === id);
  const A = of('A').slice(0, 4), B = of('B').slice(0, 4);
  // Stops 3 and 4 keep written durations, at their place in the piece.
  assert.deepEqual(A.map(n => n.pos[4].d), [0.5, 0.5, 0.5, 0.5]);
  assert.deepEqual(B.map(n => n.pos[4].d), [1, 1, 1, 5]);
  for (const s of [5, 6, 7, 8]) {
    // The same width for the common duration of each shape.
    assert.deepEqual(A.map(n => n.pos[s].d), [1, 1, 1, 1], `A at stop ${s}`);
    // Ratios inside a shape stay, up to the cap of 4.
    assert.deepEqual(B.map(n => n.pos[s].d), [1, 1, 1, 4], `B at stop ${s}`);
    assert.deepEqual(B.map(n => !!n.pos[s].capped), [false, false, false, true]);
  }
  const run = m.notes.slice(-3);
  assert.deepEqual(run.map(n => n.pos[5].d), [4, 1, 1]);
  assert.equal(run[0].pos[5].capped, true);
  assert.equal(run[1].pos[5].t, run[0].pos[5].t + 4);
  // Shapes do not overlap at stop 5.
  const slots = m.dictionary.map(e => e.slot).sort((a, b) => a.x - b.x);
  slots.forEach((sl, k) => { if (k) assert.ok(sl.x >= slots[k - 1].x + slots[k - 1].width); });
  assert.equal(m.dictionary.find(e => e.id === 'A').slot.unit, 0.5);
  // A wider cap is an option.
  const wide = fold('B = [0, 3, 2, 1 | 5]\nB, (B * [1])', { capWidth: 8 });
  assert.deepEqual(wide.notes.slice(0, 4).map(n => n.pos[5].d), [1, 1, 1, 5]);
});
