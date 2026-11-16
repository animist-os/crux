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
  const residue = units[1];
  for (const n of odd) assert.ok(n.pos[8].t >= residue.x && n.pos[8].t < residue.x + residue.width);
  assert.deepEqual(m.counts.explained, { program: 8, repeat: 0, near: 4, none: 4 });
  assert.equal(m.counts.shapes[8], 1);
});

test('fold 8: a short stated cell joins the theme next to it', () => {
  const m = fold([
    'H  = [0, 1, 2, 1, 0 | 2] || [1/8]',
    'T9 = H, ([4, 2, 7, 4] || [1/4])',
    'T  = T9, [2 | 1/4]',
    'T, (T * [3])',
  ].join('\n'));
  const T9 = m.thematic.units[8].find(u => u.id === 'T9');
  const last = m.notes.filter(n => n.entry === 'T');
  assert.equal(last.length, 2);
  for (const n of last) {
    assert.equal(n.pos[8].t, T9.x + 1);
    assert.equal(n.pos[8].step, 2);
  }
  assert.deepEqual(m.thematic.themes.map(t => t.id), ['H', 'T9']);
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
