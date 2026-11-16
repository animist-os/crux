import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../src/index.js';
import { foldModel } from '../src/fold/model.js';

// Stops 6 to 8 of the fold model (src/fold/thematic.js).

const here = path.dirname(fileURLToPath(import.meta.url));
const example = name => fs.readFileSync(path.join(here, '..', 'examples', name), 'utf8');
const fold = (src, options) => foldModel(golden.crux_trace(src), options);
const at = (n, s) => `${n.pos[s].t}/${n.pos[s].step}`;

test('fold 6: an unstated transposed repeat stacks on its first copy', () => {
  const m = fold('P = [0, 2, 1, 3, 5, 7, 6, 8]\nP');
  const [a, b] = [m.notes.slice(0, 4), m.notes.slice(4)];
  assert.equal(m.counts.positions[5], 8);
  assert.equal(m.counts.positions[6], 4);
  b.forEach((n, k) => assert.equal(at(n, 6), at(a[k], 6)));
  assert.deepEqual(a.map(n => n.pos[6].step), [0, 2, 1, 3]);
  assert.ok(m.notes.every(n => n.explainedBy === 'repeat' && n.bent === 0));
  assert.equal(m.thematic.found.length, 1);
  assert.equal(m.thematic.found[0].length, 4);
});

test('fold 6: an unstated inversion stacks on its first copy', () => {
  const m = fold('P = [0, 1, 3, 6, 5, 4, 2, -1] || [1/2]\nP');
  const [a, b] = [m.notes.slice(0, 4), m.notes.slice(4)];
  b.forEach((n, k) => assert.equal(at(n, 6), at(a[k], 6)));
  assert.equal(m.counts.positions[6], 4);
  assert.equal(m.counts.explained.repeat, 8);
});

test('fold 6: minLength sets the shortest shape that can fold', () => {
  const m = fold('P = [0, 2, 1, 3, 5, 7, 6, 8]\nP', { minLength: 5 });
  assert.equal(m.counts.positions[6], 8);
  assert.equal(m.thematic.found.length, 0);
});

const NEAR = [
  'M = [0, 3, 1, 2] || [1/4]',
  'M, (M * [3]), [5, 8, 6, 8], [0 | 1/2, 5 | 1/8, -3 | 1, 9 | 1/3]',
].join('\n');

test('fold 7: a copy of a theme with one bent note moves onto the theme', () => {
  const m = fold(NEAR);
  const theme = m.notes.slice(0, 4);
  const copy = m.notes.slice(8, 12);
  assert.deepEqual(copy.map(n => n.pos[6].step), [5, 8, 6, 8], 'still apart at stop 6');
  copy.forEach((n, k) => {
    assert.equal(at(n, 7), at(theme[k], 7));
    assert.equal(at(n, 8), at(theme[k], 8));
    assert.equal(n.explainedBy, 'near');
  });
  // M * [5] would end on 7. The copy ends on 8: one step up.
  assert.deepEqual(copy.map(n => n.bent), [0, 0, 0, 1]);
  assert.equal(m.thematic.near.length, 1);
  assert.equal(m.thematic.near[0].theme, 'M');
  assert.equal(m.thematic.near[0].stretch, 4);
});

test('fold 8: a run that matches nothing goes to the residue', () => {
  const m = fold(NEAR);
  const odd = m.notes.slice(12);
  assert.ok(odd.every(n => n.explainedBy === null && n.bent === 0));
  const units = m.thematic.units[8];
  assert.deepEqual(units.map(u => [u.kind, u.id, u.notes]), [['theme', 'M', 12], ['residue', 'residue', 4]]);
  // The residue is one marker: all its notes on one position.
  assert.equal(new Set(odd.map(n => at(n, 8))).size, 1);
  assert.ok(odd.every(n => n.fold8.kind === 'residue'));
  assert.equal(m.counts.positions[8], 4 + 1);
  assert.deepEqual(m.thematic.residue, { positions: 1, notes: 4, unexplained: 4, cells: [] });
  assert.deepEqual(m.counts.explained, { program: 8, repeat: 0, near: 4, none: 4 });
  assert.equal(m.counts.shapes[8], 1);
});

test('fold 8: a short stated cell stacks on the nearest note of the theme next to it', () => {
  const m = fold([
    'H  = [0, 1, 2, 1, 0 | 2] || [1/8]',
    'T9 = H, ([4, 2, 7, 4] || [1/4])',
    'T  = T9, [2 | 1/4]',
    'T, (T * [3])',
  ].join('\n'));
  const T9 = m.thematic.units[8].find(u => u.id === 'T9');
  const last = m.notes.filter(n => n.entry === 'T');
  assert.equal(last.length, 2);
  // T's [2] comes after T9, so it stacks on T9's last note (step 4).
  for (const n of last) {
    // T9's own four pips are each one unit wide, so the last starts at 3.
    assert.equal(n.pos[8].t, T9.x + 3);
    assert.equal(n.pos[8].step, 4);
    assert.equal(n.fold8.kind, 'attached');
    assert.equal(n.explainedBy, 'program');
  }
  assert.deepEqual(m.thematic.themes.map(t => [t.id, t.positions, t.attachedNotes]), [['H', 5, 0], ['T9', 4, 2]]);
  assert.deepEqual(m.thematic.themes[1].attached, [{ owner: 'T', notes: 2 }]);
  assert.equal(m.counts.positions[8], 9);
  assert.equal(m.counts.attached, 2);
});

test('fold 6-8: invariants on bach-invention14.keylane.v2.crux', () => {
  const m = fold(example('bach-invention14.keylane.v2.crux'));
  assert.equal(m.notes.length, 592);
  for (const n of m.notes) {
    assert.equal(n.pos.length, 9);
    for (let s = 1; s <= 8; s++) {
      const p = n.pos[s];
      assert.ok(p && Number.isFinite(p.t) && Number.isFinite(p.step) && Number.isFinite(p.d), `note ${n.id} stop ${s}`);
    }
    assert.ok(Number.isFinite(n.bent));
    assert.ok(['program', 'repeat', 'near', null].includes(n.explainedBy));
  }
  const e = m.counts.explained;
  assert.equal(e.program + e.repeat + e.near + e.none, m.counts.notes);
  for (let s = 6; s <= 8; s++) assert.ok(m.counts.positions[s] <= m.counts.positions[s - 1], `stop ${s}`);
  assert.equal(m.counts.positions[5], 96);
  assert.equal(m.stops.length, 9);
  assert.equal(m.counts.shapes.length, 9);
  // Every unit at stop 8 but the residue is a theme, a found shape or a stated cell.
  for (const u of m.thematic.units[8]) assert.ok(['theme', 'found', 'cell', 'residue'].includes(u.kind));
  assert.ok(m.thematic.themes.some(t => t.id === 'H'));
});

test('fold 6-8: two runs give equal models', () => {
  const src = example('bach-invention14.keylane.v2.crux');
  assert.deepEqual(fold(src), fold(src));
});

test('fold 7: a theme folds onto a theme ranked above it, with its bent note', () => {
  const m = fold('P = [0, 2, 1, 3] || [1/4]\nQ = [5, 7, 6, 9] || [1/4]\nP, P, P, Q, Q');
  assert.deepEqual(m.thematic.themeFolds.map(f => [f.from, f.onto, f.length, f.bent]), [['Q', 'P', 4, 1]]);
  assert.deepEqual(m.thematic.themeFolds[0].bentNotes, [{ step: 9, onto: 3, bent: 1 }]);
  const q = m.notes.slice(12);
  assert.ok(q.every(n => n.explainedBy === 'near'));
  assert.deepEqual(q.map(n => n.bent), [0, 0, 0, 1, 0, 0, 0, 1]);
  assert.deepEqual(m.counts.positions.slice(5), [8, 8, 4, 4]);
  assert.deepEqual(m.thematic.themes.map(t => [t.id, t.notes]), [['P', 20]]);
});

test('fold 7: a short shared fragment does not make two themes one', () => {
  const m = fold('P = [0, 1, 2, 7, 9, 4] || [1/4]\nQ = [0, 1, 2, 8, -6, 12] || [1/4]\nP, P, Q, Q');
  assert.equal(m.thematic.themeFolds.length, 0);
  assert.deepEqual(m.thematic.themes.map(t => t.id), ['P', 'Q']);
});

test('fold 7: no note bends by more than 2 steps', () => {
  // R is P * [5] with its last note 3 steps off: only its first 3 notes match.
  const m = fold('P = [0, 2, 1, 3] || [1/4]\nR = [5, 7, 6, 11] || [1/4]\nP, P, R');
  assert.deepEqual(m.thematic.near.map(x => [x.kind, x.notes, x.bent]), [['run', 3, 0]]);
  assert.equal(m.notes[11].explainedBy, null);
  assert.ok(m.notes.every(n => Math.abs(n.bent) <= 2));
});

test('fold 7: a single note left at the edge of a repeat joins it as a bent note', () => {
  const m = fold('P = [0, 2, 1, 3, 4] || [1/4]\nR = [5, 7, 6, 8, 10] || [1/4]\nP, P, R');
  const r = m.notes.slice(10);
  assert.deepEqual(r.map(n => n.explainedBy), ['repeat', 'repeat', 'repeat', 'repeat', 'near']);
  assert.deepEqual(r.map(n => n.bent), [0, 0, 0, 0, 1]);
  assert.equal(at(r[4], 7), at(m.notes[4], 7));
  assert.deepEqual(m.thematic.near.map(x => x.kind), ['edge']);
  // Not when the note there is not explained itself.
  const solo = fold('R = [0, 2, 1, 3, 4, -9, 5, 7, 6, 8, 10] || [1/4]\nR');
  assert.equal(solo.thematic.near.length, 0);
});

test('fold 6-8: stops 6, 7 and 8 reduce the v2 picture', () => {
  const m = fold(example('bach-invention14.keylane.v2.crux'));
  const p = m.counts.positions;
  assert.ok(p[6] < p[5] && p[7] < p[6] && p[8] < p[7], p.join(' '));
  assert.ok(p[8] <= 25, `stop 8 has ${p[8]} positions`);
  // Each theme shows its own run only, plus one residue marker.
  const units = m.thematic.units[8];
  assert.equal(p[8], units.reduce((n, u) => n + u.positions, 0));
  assert.equal(units.filter(u => u.kind === 'residue').length, 1);
  assert.equal(m.thematic.themes.find(t => t.id === 'H').positions, 5);
  assert.equal(m.thematic.themes.find(t => t.id === 'T9').positions, 4);
  assert.equal(units.reduce((n, u) => n + u.notes, 0), 592);
  for (const f of m.thematic.themeFolds) assert.ok(f.length >= 3 && f.bent <= 2 && 2 * f.exact >= f.length);
  assert.ok(m.notes.every(n => Math.abs(n.bent) <= 2));
});
