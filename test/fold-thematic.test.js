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
  // T9 is also used by itself, so T does not take it over and T's own [2] is a short cell.
  const m = fold([
    'H  = [0, 1, 2, 1, 0 | 2] || [1/8]',
    'T9 = H, ([4, 2, 7, 4] || [1/4])',
    'T  = T9, [2 | 1/4]',
    'T, (T * [3]), (T9 * [1]), (T9 * [2]), (T9 * [4])',
  ].join('\n'));
  const T9 = m.thematic.units[8].find(u => u.id === 'T9');
  const last = m.notes.filter(n => n.entry === 'T');
  assert.equal(last.length, 2);
  // T's [2] comes after T9, so it stacks on T9's last note (step 4). H is
  // never used by itself, so T9 is one shape of nine notes: four of 1/2,
  // then five of 1 (the unit is its most common duration, 1/4).
  for (const n of last) {
    assert.equal(n.pos[8].t, T9.x + 6);
    assert.equal(n.pos[8].step, 4);
    assert.equal(n.fold8.kind, 'attached');
    assert.equal(n.explainedBy, 'program');
  }
  assert.deepEqual(m.thematic.themes.map(t => [t.id, t.positions, t.attachedNotes]), [['T9', 9, 2]]);
  assert.deepEqual(m.thematic.themes[0].attached, [{ owner: 'T', notes: 2 }]);
  assert.equal(m.counts.positions[8], 9);
  assert.equal(m.counts.attached, 2);
});

test('fold 6-8: invariants on bach-invention14.keylane.v2.crux', () => {
  const m = fold(example('bach-invention14.keylane.v2.crux'));
  assert.equal(m.notes.length, 592);
  for (const n of m.notes) {
    assert.equal(n.pos.length, 10);
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
  assert.equal(m.stops.length, 10);
  assert.equal(m.counts.shapes.length, 10);
  // Every unit at stop 8 but the residue is a theme, a found shape or a stated cell.
  for (const u of m.thematic.units[8]) assert.ok(['theme', 'found', 'cell', 'residue'].includes(u.kind));
  assert.ok(m.thematic.themes.some(t => t.id === 'H'));
});

test('fold 6-8: two runs give equal models', () => {
  const src = example('bach-invention14.keylane.v2.crux');
  assert.deepEqual(fold(src), fold(src));
});

test('fold 7: a theme folds onto a theme ranked above it, with its bent note', () => {
  const m = fold('P = [0, 2, 1, 3, 4] || [1/4]\nQ = [5, 7, 6, 9, 9] || [1/4]\nP, P, P, Q, Q');
  assert.deepEqual(m.thematic.themeFolds.map(f => [f.from, f.onto, f.length, f.bent]), [['Q', 'P', 5, 1]]);
  assert.deepEqual(m.thematic.themeFolds[0].bentNotes, [{ step: 9, onto: 3, bent: 1 }]);
  const q = m.notes.slice(15);
  assert.ok(q.every(n => n.explainedBy === 'near'));
  assert.deepEqual(q.map(n => n.bent), [0, 0, 0, 1, 0, 0, 0, 0, 1, 0]);
  assert.deepEqual(m.counts.positions.slice(5, 9), [10, 10, 5, 5]);
  assert.deepEqual(m.thematic.themes.map(t => [t.id, t.notes]), [['P', 25]]);
});

test('fold 7: two themes need 5 notes in common, or an exact match of all of both', () => {
  // Four notes with one bent: not one theme.
  const bent = fold('P = [0, 2, 1, 3] || [1/4]\nQ = [5, 7, 6, 9] || [1/4]\nP, P, P, Q, Q');
  assert.equal(bent.thematic.themeFolds.length, 0);
  assert.deepEqual(bent.thematic.themes.map(t => t.id), ['P', 'Q']);
  const exact = fold('P = [0, 2, 1, 3] || [1/4]\nQ = [8, 6, 7, 5] || [1/4]\nP, P, P, Q, Q');
  // Four notes, exact (a mirror), all of both: one theme. Stop 6 finds it.
  assert.deepEqual(exact.thematic.themes.map(t => [t.id, t.notes]), [['P', 20]]);
  assert.ok(exact.notes.every(n => n.fold8.unit === 'P'));
  // A three-note theme does not fold onto a part of a long one.
  const part = fold('L = [0, 4, 2, 5, 3, 6, 1, 9] || [1/4]\nC = [0, 4, 2] || [1/4]\nL, L, L, (C * [10]), (C * [11])');
  assert.equal(part.thematic.themeFolds.length, 0);
  // Two bent notes are too many for two themes.
  const two = fold('P = [0, 2, 1, 3, 4, 6, 5] || [1/4]\nQ = [5, 7, 7, 8, 9, 12, 10] || [1/4]\nP, P, P, Q, Q');
  assert.equal(two.thematic.themeFolds.length, 0);
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
  assert.ok(p[8] <= 35, `stop 8 has ${p[8]} positions`);
  // Each theme shows its own run only, plus one residue marker.
  const units = m.thematic.units[8];
  assert.equal(p[8], units.reduce((n, u) => n + u.positions, 0));
  assert.equal(units.filter(u => u.kind === 'residue').length, 1);
  assert.equal(m.thematic.themes.find(t => t.id === 'H').positions, 5);
  // T9 lives inside T, so T owns its four notes and its own last note.
  assert.equal(m.thematic.themes.find(t => t.id === 'T').positions, 5);
  assert.equal(units.reduce((n, u) => n + u.notes, 0), 592);
  for (const f of m.thematic.themeFolds) assert.ok(f.length >= 3 && f.bent <= 2 && 2 * f.exact >= f.length);
  assert.ok(m.notes.every(n => Math.abs(n.bent) <= 2));
});

test('theme level: a theme built from parts that are never used alone is one shape', () => {
  const src = 'n = [0, 4, 2]\na = n, (n * [1]), [9]\nS = a, [5, 6]\nS, (S * [2]), (S * [4])';
  const m = fold(src);
  // Stop 5 keeps the innermost shapes: n, a's own note, S's own two notes.
  assert.equal(m.counts.positions[5], 6);
  assert.deepEqual([...new Set(m.notes.map(n => n.owner))], ['n', 'a', 'S']);
  // The later folds see S whole.
  assert.ok(m.notes.every(n => n.theme === 'S' && n.explainedBy === 'program'));
  assert.deepEqual(m.thematic.themes.map(t => [t.id, t.positions, t.notes]), [['S', 9, 27]]);
  assert.deepEqual(m.counts.positions.slice(6, 9), [9, 9, 9]);
  const first = m.notes.slice(0, 9);
  assert.deepEqual(first.map(n => n.pos[8].step), [0, 4, 2, 1, 5, 3, 9, 5, 6]);
  assert.deepEqual(first.map(n => n.pos[8].t - first[0].pos[8].t), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
});

test('theme level: a sequence of a shape is not a theme, the shape is', () => {
  const m = fold('D = [0, 1, 2, 1]\nDq = D * [4, 2, 0]\nDq, (Dq * [1]), (Dq * [3])');
  assert.deepEqual(m.thematic.themes.map(t => [t.id, t.positions, t.notes]), [['D', 4, 36]]);
});

test('theme level: a shape that is used freely stays apart from what holds it', () => {
  const src = [
    'X = [0, 1, 2, 3, 5]',
    'Y = [7, 5, 6, 4, 9]',
    'CS = X, Y',
    'CS, (CS * [1]), (X * [3]), (X * [5]), (X * [2]), (Y * [2]), (Y * [1]), (Y * [4])',
  ].join('\n');
  const free = fold(src);
  assert.deepEqual(free.thematic.themes.map(t => t.id), ['X', 'Y']);
  assert.equal(free.counts.positions[8], 10);
  // Picked by hand, in the program or as an option: CS is one shape, and X and Y fold onto it.
  for (const m of [fold('// #theme CS\n' + src), fold(src, { themes: ['CS'] })]) {
    assert.deepEqual(m.thematic.themes.map(t => [t.id, t.positions, t.notes]), [['CS', 10, 50]]);
    assert.deepEqual(m.thematic.themeFolds.map(f => [f.from, f.onto, f.length, f.bent]).sort(), [['X', 'CS', 5, 0], ['Y', 'CS', 5, 0]]);
    assert.equal(m.notes[0].theme, 'CS');
  }
  // A name that the program does not use is ignored.
  assert.deepEqual(fold(src, { themes: ['Nope'] }).thematic.themes.map(t => t.id), ['X', 'Y']);
});

test('fold 8: found repeats go to the residue unless showFound is set', () => {
  const src = 'P = [0, 2, 1, 3, 5, 7, 6, 8]\nP';
  const m = fold(src);
  assert.deepEqual(m.thematic.units[8].map(u => u.kind), ['residue']);
  assert.equal(m.counts.positions[8], 1);
  assert.ok(m.notes.every(n => n.fold8.kind === 'residue' && n.explainedBy === 'repeat'));
  assert.equal(m.thematic.residue.unexplained, 0);
  const shown = fold(src, { showFound: true });
  assert.deepEqual(shown.thematic.units[8].map(u => [u.kind, u.positions, u.notes]), [['found', 4, 8]]);
  assert.equal(shown.counts.positions[8], 4);
  // Stops 6 and 7 are the same either way.
  assert.deepEqual(m.notes.map(n => n.pos[7]), shown.notes.map(n => n.pos[7]));
});

test('fold 6: a second partial copy still stacks on the same stated shape', () => {
  // Both passages repeat a part of S. The longer one is found first and must not block the shorter one.
  const src = 'S = [0, 4, 2, 5, 3, 6, 1, 9, 7]\nS, (S * [1]), [20, 4, 2, 5, 3, 6, 1, 30], [40, 3, 6, 1, 9, 50]';
  const m = fold(src);
  const s = m.notes.slice(0, 9);
  const a = m.notes.slice(19, 25), b = m.notes.slice(27, 31);
  a.forEach((n, k) => assert.equal(at(n, 6), at(s[k + 1], 6)));
  b.forEach((n, k) => assert.equal(at(n, 6), at(s[k + 4], 6)));
});

// The cells stop (stop 9 when the program has no #core).

const cellsOf = m => m.inward.levels[0].units.map(u => [u.kind, u.id, u.positions, u.notes]);
// The BWV 578 example up to the line before `subject = ...`: its directives
// and the definitions the subject is made of.
const subjectLines = () => {
  const lines = example('bach-bwv578.keylane.crux').split('\n');
  return lines.slice(0, lines.findIndex(l => l.startsWith('subject =')));
};

test('cells: a partial statement (A \\ 1) joins the full entry', () => {
  const m = fold('A = [0, 4, 2, 1]\nT = A, (A \\ 1)\nT, (T * [2]), (T * [4])');
  assert.deepEqual(m.dictionary.map(e => e.id), ['A', 'A#2']);
  assert.equal(m.counts.positions[9], 4);
  assert.deepEqual(cellsOf(m), [['entry', 'A', 4, 21]]);
  assert.equal(m.inward.levels[0].units[0].count, 6);
  const [a, part] = [m.notes.slice(0, 4), m.notes.slice(4, 7)];
  part.forEach((n, k) => {
    assert.equal(n.entry, 'A#2');
    assert.equal(n.cell, 'A');
    assert.equal(at(n, 9), at(a[k], 9));
  });
  assert.ok(m.notes.every(n => n.cellBent === 0));
});

test('cells: an edited statement (A @ [@1 5]) is A with a bent note', () => {
  // The second copy is mirrored before the edit: the bend is taken back into A's frame.
  const m = fold('A = [0, 4, 2, 1]\nT = A, (A @ [@1 5]), ((A m [0]) @ [@1 5])\nT, (T * [2]), (T * [4])');
  const [a, ed, mir] = [m.notes.slice(0, 4), m.notes.slice(4, 8), m.notes.slice(8, 12)];
  assert.deepEqual(ed.map(n => n.step), [0, 9, 2, 1]);
  // Stops 3 to 5 do not change: the changed note is edited and T owns it.
  assert.equal(ed[1].edited, true);
  assert.equal(ed[1].owner, 'T');
  assert.equal(ed[1].cell, 'A');
  assert.equal(ed[1].cellBent, 5);
  assert.equal(mir[1].cellBent, -5);
  assert.ok([...ed, ...mir].every((n, k) => at(n, 9) === at(a[k % 4], 9)));
  assert.ok(m.notes.filter(n => !n.edited).every(n => n.cellBent === 0));
  assert.deepEqual(cellsOf(m), [['entry', 'A', 4, 36]]);
  assert.equal(m.counts.cellEdited, 0);
  assert.equal(m.counts.cellBent, 6);
  assert.equal(m.counts.edited, 6);
});

test('cells: reverse and rotate between the cell and the edit', () => {
  const m = fold('A = [0, 4, 2, 1]\nT = A, ((A * |-1) ~ -1 @[@3 -3])\nT, (T * [2]), (T * [4])');
  const ed = m.notes.slice(4, 8);
  // (A * |-1) ~ -1 is [0, 1, 2, 4]. The edit moves A's 4 (its note 1) down 3.
  assert.deepEqual(ed.map(n => n.step), [0, 1, 2, 1]);
  assert.deepEqual(ed.map(n => n.cellBent), [0, 0, 0, -3]);
  assert.equal(at(ed[3], 9), at(m.notes[1], 9));
  assert.equal(at(ed[0], 9), at(m.notes[0], 9));
  assert.deepEqual(cellsOf(m), [['entry', 'A', 4, 24]]);
});

test('cells: an edit that changes a duration stays edited', () => {
  const m = fold('A = [0, 4, 2, 1]\nT = A, (A @ [@1 5 | 2])\nT, (T * [2]), (T * [4])');
  const n = m.notes[5];
  assert.equal(n.cell, 'T');
  assert.equal(n.cellBent, 0);
  assert.equal(m.counts.cellEdited, 3);
  assert.deepEqual(cellsOf(m), [['entry', 'A', 4, 21], ['entry', 'T', 1, 3]]);
});

// Splits: `@` puts two pips in the place of one.
const splitOf = src => fold(`A = [0, 4, 2, 1]\nT = A, (${src})\nT, (T * [2]), (T * [4])`);

test('cells split: A @[@1 [0, 2]/] puts two parts on one slot of A', () => {
  const m = splitOf('A @ [@1 [0, 2]/]');
  const [a, ed] = [m.notes.slice(0, 4), m.notes.slice(4, 9)];
  assert.deepEqual(ed.map(n => n.step), [0, 4, 6, 2, 1]);
  const [p0, p1] = [ed[1], ed[2]];
  // Stops 3 to 5 do not change: T owns the parts.
  assert.ok(p0.edited && p0.owner === 'T' && p1.edited && p1.owner === 'T');
  assert.deepEqual([p0.cell, p1.cell], ['A', 'A']);
  assert.deepEqual([p0.split, p1.split], [{ part: 0, parts: 2 }, { part: 1, parts: 2 }]);
  assert.deepEqual([p0.cellBent, p1.cellBent], [0, 2]);
  // One slot: both parts sit on A's note 1, with its width.
  assert.equal(at(p0, 9), at(a[1], 9));
  assert.equal(at(p1, 9), at(a[1], 9));
  assert.equal(p0.pos[9].d, a[1].pos[9].d);
  assert.deepEqual(cellsOf(m), [['entry', 'A', 4, 27]]);
  assert.equal(m.inward.levels[0].units[0].count, 6);
  assert.deepEqual([m.counts.cellEdited, m.counts.cellBent, m.counts.cellSplit], [0, 0, 6]);
  assert.equal(m.counts.positions[9], 4);
  // Notes that are not parts have no split field.
  assert.ok(m.notes.filter(n => n !== p0 && n !== p1 && n.voice === 0 && n.index < 9 && n.index !== 5 && n.index !== 6).every(n => !('split' in n)));
});

test('cells split: a split seen through \\ 1 joins the full entry', () => {
  const m = splitOf('(A @ [@1 [0, 2]/]) \\ 1');
  const ed = m.notes.slice(4, 8);
  assert.deepEqual(ed.map(n => n.step), [0, 4, 6, 2]);
  assert.deepEqual(ed.map(n => n.cell), ['A', 'A', 'A', 'A']);
  assert.deepEqual(ed.map(n => n.cellBent), [0, 0, 2, 0]);
  assert.equal(at(ed[2], 9), at(m.notes[1], 9));
  assert.deepEqual(cellsOf(m), [['entry', 'A', 4, 24]]);
  assert.equal(m.counts.cellEdited, 0);
});

test('cells split: a split of a bent note adds the bend', () => {
  const m = splitOf('(A @ [@1 5]) @ [@1 [0, 2]/]');
  const [p0, p1] = m.notes.slice(5, 7);
  assert.deepEqual([p0.step, p1.step], [9, 11]);
  assert.deepEqual([p0.cellBent, p1.cellBent], [5, 7]);
  assert.equal(at(p0, 9), at(m.notes[1], 9));
  assert.deepEqual(cellsOf(m), [['entry', 'A', 4, 27]]);
  // Through a mirror, the bend is taken back into A's frame.
  const mir = splitOf('((A * [3]) m [1]) @ [@1 [0, 2]/]');
  assert.deepEqual(mir.notes.slice(5, 7).map(n => [n.step, n.cellBent]), [[-5, 0], [-3, -2]]);
  assert.deepEqual(cellsOf(mir), [['entry', 'A', 4, 27]]);
});

test('cells split: a split of a split stacks on the first replaced note', () => {
  const m = splitOf('(A @ [@1 [0, 2]/]) @ [@2 [0, 1]/]');
  const parts = m.notes.slice(5, 8);
  assert.deepEqual(parts.map(n => n.step), [4, 6, 7]);
  assert.deepEqual(parts.map(n => n.cellBent), [0, 2, 3]);
  // `split` describes the innermost `@`.
  assert.deepEqual(parts.map(n => n.split), [{ part: 0, parts: 2 }, { part: 1, parts: 2 }, { part: 1, parts: 2 }]);
  assert.ok(parts.every(n => at(n, 9) === at(m.notes[1], 9)));
  assert.deepEqual(cellsOf(m), [['entry', 'A', 4, 30]]);
});

test('cells split: parts whose durations do not add up stay edited', () => {
  const m = splitOf('A @ [@1 [0, 2]]');
  const [p0, p1] = m.notes.slice(5, 7);
  assert.deepEqual([p0.step, p1.step], [4, 6]);
  assert.deepEqual([p0.cell, p1.cell], ['T', 'T']);
  assert.ok(!p0.split && !p1.split && p0.cellBent === 0);
  assert.equal(m.counts.cellEdited, 6);
  assert.equal(m.counts.cellSplit, 0);
});

test('cells split: stops 0 to 8 do not read from', () => {
  for (const src of ['A @ [@1 [0, 2]/]', '(A @ [@1 5]) @ [@1 [0, 2]/]', '(A @ [@1 [0, 2]/]) @ [@2 [0, 1]/]']) {
    const code = `A = [0, 4, 2, 1]\nT = A, (${src})\nT, (T * [2]), (T * [4])`;
    const t = golden.crux_trace(code);
    const m = foldModel(t);
    // The same trace with every `from` taken away: the frames as before this rule.
    const seen = new Set();
    const strip = f => { for (; f && !seen.has(f); f = f.next) { seen.add(f); if (f.from) { strip(f.from.origin); delete f.from; } } };
    for (const mot of t.sections) for (const p of mot.values) strip(p.origin);
    const old = foldModel(t);
    assert.deepEqual(m.notes.map(n => n.pos.slice(0, 9)), old.notes.map(n => n.pos.slice(0, 9)), src);
    assert.deepEqual(m.counts.positions.slice(0, 9), old.counts.positions.slice(0, 9), src);
    assert.equal(old.counts.cellSplit, 0, src);
    assert.ok(m.counts.cellSplit > 0, src);
  }
});

test('cells: the BWV 578 subject is one nug entry of 4 positions', () => {
  const lines = subjectLines();
  const m = fold([...lines, 'subject = ar, d', 'subject'].join('\n'), { core: [] });
  assert.deepEqual(m.dictionary.map(e => `${e.id} x${e.count}`), ['nug x1', 'nug#2 x2', 'nug#3 x2', 'nugb x2', 'nugd x2', 'a x1', 'd x1']);
  assert.equal(m.counts.positions[5], 14);
  // No theme at stop 8: the cells stop opens every entry in place.
  assert.equal(m.inward.themed, false);
  assert.deepEqual(cellsOf(m), [['entry', 'nug', 4, 18], ['entry', 'a', 1, 1], ['entry', 'd', 2, 2]]);
  assert.equal(m.counts.positions[9], 7);
  // nugb and nugd change one note of nug each: bent notes at the cell level.
  assert.deepEqual(m.notes.filter(n => n.cellBent).map(n => [n.owner, n.cellBent]), [['nugb', -3], ['nugd', -2], ['nugb', -3], ['nugd', -2]]);
});

test('cells split: in the full BWV 578 subject br and nugc fold onto b and nug', () => {
  const lines = subjectLines();
  const m = fold([...lines, 'subject = ar, br, nugc, d', 'subject'].join('\n'), { core: [] });
  assert.equal(m.counts.notes, 41);
  // br splits the -3 at b's note 5; nugc splits b's notes 1 and 3 and nug's
  // bent note 1. b has four places now: the split -3 is one of them.
  assert.deepEqual(cellsOf(m), [['entry', 'nug', 4, 27], ['entry', 'a', 1, 1], ['entry', 'b', 4, 11], ['entry', 'd', 2, 2]]);
  assert.equal(m.counts.positions[9], 11);
  assert.equal(m.counts.cellSplit, 10);
  // Still edited: the three -3 notes that `.,` takes from its second operand.
  const edited = m.notes.filter(n => n.cell === 'b' && !n.split);
  assert.deepEqual(edited.map(n => n.step), [-3, -3, -3]);
  assert.equal(m.counts.cellEdited, 3);
  // nugc's split of nugb's bent note: the bend of the note plus the offset of the part.
  assert.deepEqual(m.notes.filter(n => n.cell === 'nug' && n.split).map(n => n.cellBent), [-3, -7]);
});

test('cells: BWV 578 positions fall from stop 8 to the cells stop, stops 0 to 8 unchanged', () => {
  const m = fold(example('bach-bwv578.keylane.crux'), { core: [] });
  const p = m.counts.positions;
  assert.deepEqual(p.slice(0, 9), [1669, 1669, 1669, 1665, 1053, 829, 467, 379, 164]);
  assert.deepEqual(m.counts.shapes.slice(0, 9), [259, 259, 259, 259, 118, 73, 56, 52, 11]);
  assert.ok(p[9] < p[8], p.join(' '));
  const nug = m.inward.levels[0].units.find(u => u.id === 'nug');
  assert.equal(nug.positions, 4);
  assert.ok(!m.inward.levels[0].units.some(u => /^nug[#bd]/.test(u.id)));
  for (const n of m.notes) assert.ok(n.pos[9] && Number.isFinite(n.pos[9].t) && Number.isFinite(n.pos[9].step) && Number.isFinite(n.pos[9].d));
});

// Stops 9 and on: focus levels. With one level, stop 9 is the core.

const coreUnits = (m, i = 0) => m.inward.levels[i].units.map(u => [u.kind, u.id, u.positions, u.notes, u.attached || 0]);
const kinds = (m, i) => m.notes.map(n => n.focus[i].kind);
// A is the core. B bends a note of A and writes no note of its own, so the
// host of the A in B is H, which writes [7]. S splits a note of A and writes
// [9]. Only H is a theme at stop 8.
const CORE_SRC = [
  '// #core A',
  'A = [0, 2, 1, 3]',
  'B = (A * [1]) @[@1 5]',
  'H = B, [7]',
  'S = (A @[@2 [0, 1]/]), [9]',
  'H, (H * [2]), S',
].join('\n');

test('focus: one level is the core stop', () => {
  const m = fold(CORE_SRC);
  assert.equal(m.stops.length, 10);
  assert.equal(m.stops[9], 'A');
  assert.deepEqual(m.inward.levels.map(L => [L.kind, L.names, L.missing]), [['core', ['A'], []]]);
  assert.equal(m.counts.shapes[9], 1);
  assert.equal(m.counts.positions[9], 4);
  assert.deepEqual(m.counts.core, { stated: 13, bent: 2, split: 2, attached: 3, hidden: 0 });
  assert.deepEqual(coreUnits(m), [['entry', 'A', 4, 16, 3]]);
  // A bent note and the parts of a split are core notes on their slot of A.
  const bent = m.notes.filter(n => n.cellBent && !n.split);
  assert.deepEqual(bent.map(n => [n.owner, n.focus[0].kind, at(n, 9)]), [['B', 'core', '1/2'], ['B', 'core', '1/2']]);
  const parts = m.notes.filter(n => n.split);
  assert.deepEqual(parts.map(n => [n.focus[0].kind, at(n, 9)]), [['core', '2/1'], ['core', '2/1']]);
  assert.ok(!('fold11' in m.notes[0]) && !('fold10' in m.notes[0]));
});

test('focus core: the host writes a literal of its own, which stacks on the nearest core note', () => {
  const m = fold(CORE_SRC);
  const att = m.notes.filter(n => n.focus[0].kind === 'attached');
  // H's [7] (twice) and S's [9]. Each follows the last note of A, at A's note 3.
  assert.deepEqual(att.map(n => [n.owner, n.focus[0].host, n.focus[0].entry, at(n, 9)]),
    [['H', 'H', 'A', '3/3'], ['H', 'H', 'A', '3/3'], ['S', 'S', 'A', '3/3']]);
  // Attached notes add no position.
  assert.equal(m.counts.positions[9], 4);
});

test('focus core: a definition that writes no notes is passed on the way to the host', () => {
  const m = fold(CORE_SRC);
  // B is between A and H. It is not a host: none of its notes is its own at the cell level.
  assert.ok(!m.notes.some(n => n.focus[0].host === 'B'));
  assert.ok(!m.notes.some(n => n.cell === 'B'));
  // Without the [7], H writes no notes either: the A in H has no host, and nothing attaches.
  const m2 = fold(CORE_SRC.replace('H = B, [7]', 'H = B'));
  assert.deepEqual(m2.notes.filter(n => n.focus[0].kind === 'attached').map(n => n.focus[0].host), ['S']);
});

test('focus core: a core note outside every theme is still core', () => {
  const m = fold(CORE_SRC);
  const s = m.notes.filter(n => n.fold8.kind === 'residue');
  assert.equal(s.length, 6);
  assert.deepEqual(s.map(n => n.focus[0].kind), ['core', 'core', 'core', 'core', 'core', 'attached']);
});

test('focus core: a note in no named shape is hidden and keeps its stop 8 position', () => {
  const m = fold(CORE_SRC.replace('H, (H * [2]), S', 'H, (H * [2]), S, [5, 6]'));
  const hid = m.notes.filter(n => n.focus[0].kind === 'hidden');
  assert.deepEqual(hid.map(n => n.step), [5, 6]);
  for (const n of hid) {
    assert.deepEqual(n.focus[0], { kind: 'hidden', unit: null, entry: null, host: null });
    assert.deepEqual(n.pos[9], { ...n.pos[8], hidden: true });
  }
  assert.equal(m.counts.core.hidden, 2);
  assert.equal(m.inward.levels[0].hidden, 2);
  // Counts do not count hidden notes: there is no residue marker.
  assert.equal(m.counts.positions[9], 4);
  assert.equal(m.counts.shapes[9], 1);
});

test('focus: a missing name is listed; a level of missing names hides every note', () => {
  const m = fold(CORE_SRC.replace('// #core A', '// #core B A Q'));
  assert.deepEqual(m.inward.levels[0].names, ['A']);
  assert.deepEqual(m.inward.levels[0].missing, ['B', 'Q']);
  assert.equal(m.stops[9], 'B A Q');
  assert.equal(m.counts.shapes[9], 1);
  const m2 = fold(CORE_SRC.replace('// #core A', '// #core B'));
  assert.deepEqual([m2.inward.levels[0].names, m2.inward.levels[0].missing], [[], ['B']]);
  assert.equal(m2.stops.length, 10);
  assert.deepEqual(m2.counts.core, { stated: 0, bent: 0, split: 0, attached: 0, hidden: m2.counts.notes });
  assert.equal(m2.counts.positions[9], 0);
  m2.notes.forEach(n => assert.deepEqual(n.pos[9], { ...n.pos[8], hidden: true }));
  // In a shape level, a name that no note passed through is missing.
  const m3 = fold(CORE_SRC.replace('// #core A', '// #core H Q / A'));
  assert.deepEqual([m3.inward.levels[0].names, m3.inward.levels[0].missing], [['H'], ['Q']]);
});

test('focus: no core gives 10 stops, the last the cells stop', () => {
  const m = fold(CORE_SRC.replace('// #core A\n', ''));
  assert.equal(m.stops.length, 10);
  assert.equal(m.counts.shapes.length, 10);
  assert.equal(m.counts.positions.length, 10);
  assert.deepEqual(m.inward.levels.map(L => L.kind), ['cells']);
  assert.equal(m.counts.core, null);
  m.notes.forEach(n => {
    assert.equal(n.pos.length, 10);
    assert.equal(n.focus.length, 1);
    assert.ok(['cell', 'residue'].includes(n.focus[0].kind));
  });
});

test('focus: the core option wins over the directive; arrays of arrays are levels', () => {
  const m = fold(CORE_SRC.replace('// #core A', '// #core Q'), { core: ['A'] });
  assert.deepEqual(m.inward.levels.map(L => L.names), [['A']]);
  assert.equal(m.counts.positions[9], 4);
  const m2 = fold(CORE_SRC, { core: [['H', 'S'], ['A']] });
  assert.deepEqual(m2.stops.slice(9), ['H S', 'A']);
  assert.deepEqual(m2.inward.levels.map(L => L.kind), ['shapes', 'core']);
  const m3 = fold(CORE_SRC, { core: 'H S / A' });
  assert.deepEqual(m3.stops.slice(9), ['H S', 'A']);
});

test('focus: the directive changes no stop before 9', () => {
  const a = fold(CORE_SRC.replace('// #core A', '// #core H S / A')), b = fold(CORE_SRC.replace('// #core A\n', ''));
  assert.deepEqual(a.counts.positions.slice(0, 9), b.counts.positions.slice(0, 9));
  assert.deepEqual(a.counts.shapes.slice(0, 9), b.counts.shapes.slice(0, 9));
  a.notes.forEach((n, k) => assert.deepEqual(n.pos.slice(0, 9), b.notes[k].pos.slice(0, 9)));
});

// Two levels. B is named in the first level and is inside H, also named
// there. `H \ 1` is a partial statement of H. [5, 6] belongs to no shape.
const LEVELS_SRC = [
  '// #core H B / A',
  'A = [0, 2, 1, 3]',
  'B = (A * [1]) @[@1 5]',
  'H = B, [7]',
  'S = (A @[@2 [0, 1]/]), [9]',
  'H, (H * [2]), S, B, (H \\ 1), [5, 6]',
].join('\n');

test('focus: two levels, shapes then core', () => {
  const m = fold(LEVELS_SRC);
  assert.equal(m.stops.length, 11);
  assert.deepEqual(m.stops.slice(9), ['H B', 'A']);
  assert.deepEqual(m.inward.levels.map(L => [L.kind, L.names, L.shown, L.attached, L.hidden]),
    [['shapes', ['H', 'B'], 18, 0, 8], ['core', ['A'], 24, 3, 2]]);
  // The entries are whole definitions, as written: H keeps its transposition
  // of A and its bent note. Its partial statement joins it.
  assert.deepEqual(coreUnits(m, 0), [['entry', 'B', 4, 4, 0], ['entry', 'H', 5, 14, 0]]);
  assert.equal(m.inward.levels[0].units[1].count, 3);
  const h = m.notes.filter(n => n.focus[0].unit === 'H' && n.voice === 0).slice(0, 5);
  assert.deepEqual(h.map(n => at(n, 9)), ['4.5/1', '5.5/8', '6.5/2', '7.5/4', '8.5/7']);
  assert.deepEqual(m.counts.shapes.slice(9), [2, 1]);
  assert.deepEqual(m.counts.positions.slice(9), [9, 4]);
  assert.deepEqual(m.counts.core, { stated: 21, bent: 4, split: 2, attached: 3, hidden: 2 });
  for (const n of m.notes) assert.ok(n.focus.length === 2 && n.focus.every(f => ['shape', 'core', 'attached', 'hidden'].includes(f.kind)));
});

test('focus: a named definition inside another named one of the same level belongs to the outer one', () => {
  const m = fold(LEVELS_SRC);
  // Every B inside H is H's. The B entry holds only the B stated by itself.
  const b = m.notes.filter(n => n.focus[0].unit === 'B');
  assert.equal(b.length, 4);
  // The B stated by itself comes after H, H * [2] and S (notes 0 to 15).
  assert.deepEqual(b.map(n => n.id), [16, 17, 18, 19]);
  assert.ok(m.notes.filter(n => n.owner === 'B' && n.focus[0].unit === 'H').length >= 2);
});

test('focus: a hidden note keeps its last position, at every level', () => {
  const m = fold(LEVELS_SRC);
  const lit = m.notes.filter(n => n.owner === null);
  assert.deepEqual(lit.map(n => n.step), [5, 6]);
  for (const n of lit) {
    assert.deepEqual(kindsOf(n), ['hidden', 'hidden']);
    assert.deepEqual(n.pos[9], { ...n.pos[8], hidden: true });
    assert.deepEqual(n.pos[10], n.pos[9]);
  }
});
const kindsOf = n => n.focus.map(f => f.kind);

test('focus: a note hidden at one level is attached at the next', () => {
  const m = fold(LEVELS_SRC);
  // S is not named in the first level. Its [9] is hidden there, then attached
  // to A (host S) at the core. Its A notes are hidden, then core.
  const s9 = m.notes.find(n => n.owner === 'S' && n.step === 9);
  assert.deepEqual(kindsOf(s9), ['hidden', 'attached']);
  assert.equal(s9.focus[1].host, 'S');
  assert.ok(s9.pos[9].hidden && !s9.pos[10].hidden);
  assert.equal(at(s9, 10), '3/3');
  const sA = m.notes.filter(n => n.focus[0].kind === 'hidden' && n.focus[1].kind === 'core');
  assert.equal(sA.length, 5);
  // H's [7] is a note of the shape H, then attached to A.
  assert.deepEqual(m.notes.filter(n => n.owner === 'H').map(kindsOf), [['shape', 'attached'], ['shape', 'attached']]);
  assert.deepEqual(kinds(m, 1).filter(k => k === 'hidden').length, 2);
});

test('focus: BWV 578 with #core a nugb nugc nugd / nug has 11 stops', () => {
  const src = example('bach-bwv578.keylane.crux');
  assert.ok(/^\/\/ #core a nugb nugc nugd \/ nug$/m.test(src));
  const m = fold(src), b = fold(src.replace(/^\/\/ #core .*\n/m, ''));
  assert.equal(b.stops.length, 10);
  assert.deepEqual(m.counts.positions.slice(0, 9), b.counts.positions.slice(0, 9));
  assert.deepEqual(m.counts.shapes.slice(0, 9), b.counts.shapes.slice(0, 9));
  m.notes.forEach((n, k) => assert.deepEqual(n.pos.slice(0, 9), b.notes[k].pos.slice(0, 9)));
  assert.equal(m.stops.length, 11);
  assert.deepEqual(m.stops.slice(9), ['a nugb nugc nugd', 'nug']);
  // Stop 9: the four shapes whole. Partial statements (ar \ 1, nugc \ 2) join them.
  assert.deepEqual(m.inward.levels[0].units.map(u => [u.id, u.positions]), [['a', 11], ['nugb', 4], ['nugc', 11], ['nugd', 4]]);
  assert.equal(m.counts.shapes[9], 4);
  assert.equal(m.counts.positions[9], 30);
  assert.equal(m.inward.levels[0].hidden, 1396);
  assert.equal(m.inward.levels[0].shown, 273);
  // Stop 10: nug, as the one-level core was.
  assert.equal(m.counts.shapes[10], 1);
  assert.equal(m.counts.positions[10], 4);
  assert.deepEqual(m.inward.levels[1].units.map(u => [u.kind, u.id, u.positions]), [['entry', 'nug', 4]]);
  const c = m.counts.core;
  assert.equal(c.stated + c.attached + c.hidden, m.counts.notes);
  assert.deepEqual(c, { stated: 210, bent: 33, split: 12, attached: 120, hidden: 1339 });
  // The hosts of nug are a, b and d.
  const hosts = new Set(m.notes.filter(n => n.focus[1].kind === 'attached').map(n => n.focus[1].host));
  assert.deepEqual([...hosts].sort(), ['a', 'b', 'd']);
});

// Stops after 8: order and place (docs/plans/crux-fold-inward.md, "Fewer
// stops, stable order").

test('order: no #core gives one cells stop; core [] turns the directive off', () => {
  const m = fold('A = [0, 4, 2, 1]\nT = A, (A \\ 1)\nT, (T * [2]), (T * [4])');
  assert.equal(m.stops.length, 10);
  assert.equal(m.stops[9], 'cells');
  assert.deepEqual(m.inward.levels.map(L => [L.kind, L.names, L.missing, L.hidden]), [['cells', [], [], 0]]);
  assert.ok(m.notes.every(n => n.pos.length === 10 && n.focus.length === 1 && n.focus[0].kind === 'cell'));
  assert.ok(m.notes.every(n => !('fold9' in n) && !('fold10' in n)));
  assert.ok(!('units' in m.inward));
  assert.equal(m.counts.core, null);
  const off = fold(CORE_SRC, { core: [] });
  assert.equal(off.stops.length, 10);
  assert.equal(off.inward.levels[0].kind, 'cells');
});

test('order: a shape that does not change keeps its x at the cells stop', () => {
  // T opens to c1 and c2, which are smaller than T. M is a theme by itself.
  const m = fold('// #theme T M\nc1 = [0, 2, 1]\nc2 = [4, 3, 5, 4]\nT = c1, (c1 * [3]), c2\nM = [6, 6, 9, 2, 2, 11] || [2]\nT, M, (T * [2]), (M * [1]), (T * [4]), (M * [2])');
  assert.deepEqual(m.thematic.units[8].map(u => [u.id, u.x, u.width]), [['T', 0, 10], ['M', 10.5, 6]]);
  assert.deepEqual(m.inward.levels[0].units.map(u => [u.id, u.x, u.width]), [['c1', 0, 3], ['c2', 6, 4], ['M', 10.5, 6]]);
  // M's notes and the notes of T that stay in place do not move.
  const M = m.notes.filter(n => n.fold8.unit === 'M');
  assert.equal(M.length, 18);
  M.forEach(n => assert.equal(at(n, 9), at(n, 8)));
  const moved = m.notes.filter(n => at(n, 9) !== at(n, 8));
  assert.ok(moved.every(n => n.fold8.unit === 'T' && n.owner === 'c1'));
  assert.equal(moved.length, 9);
});

test('order: a shape with edited notes stays between its neighbours', () => {
  // E's notes are all made by @, so it has no literal position. In source
  // order it would come last; at stop 8 it lies between c1 and c2.
  const m = fold('c1 = [0, 2, 1]\nE = [0, 1] @ [@0 [5, 6, 7], @1 [8, 9, 4]]\nc2 = [4, 3, 5, 4]\nT = c1, E, c2\nT, (T * [2]), (T * [4])');
  assert.equal(m.dictionary.find(e => e.id === 'E').litPos, null);
  assert.deepEqual(m.inward.levels[0].units.map(u => [u.id, u.x]), [['c1', 0], ['E', 3.5], ['c2', 10]]);
  // No note goes left of a note that was left of it at stop 8, in another shape.
  const first = m.notes.slice(0, 13);
  for (let k = 1; k < first.length; k++) assert.ok(first[k].pos[9].t > first[k - 1].pos[9].t, `note ${k}`);
});

test('order: a focus level lays its shapes out in the order of the stop before', () => {
  // A comes first in the source, B first in the theme H at stop 8.
  const m = fold('// #theme H\n// #core A B\nA = [0, 2, 1, 3]\nB = [5, 4, 3, 2]\nH = B, A\nH, (H * [2])');
  assert.deepEqual(m.dictionary.map(e => e.id), ['A', 'B']);
  assert.deepEqual(m.inward.levels[0].units.map(u => [u.id, u.x]), [['B', 0], ['A', 4.5]]);
  // Packed from 0: B's notes stay where they are, A's close the gap.
  m.notes.filter(n => n.owner === 'B').forEach(n => assert.equal(at(n, 9), at(n, 8)));
  // Two levels: the second takes its order from the first.
  const m2 = fold('// #theme H\n// #core B A / A B\nA = [0, 2, 1, 3]\nB = [5, 4, 3, 2]\nH = B, A\nH, (H * [2])');
  assert.deepEqual(m2.inward.levels.map(L => L.units.map(u => u.id)), [['B', 'A'], ['B', 'A']]);
});

test('order: BWV 578 without the core directive, the shapes right of CS keep their order', () => {
  const m = fold(example('bach-bwv578.keylane.crux'), { core: [] });
  assert.equal(m.stops.length, 10);
  assert.equal(m.counts.shapes[9], 18);
  assert.equal(m.counts.positions[9], 134);
  // The order of the stop 8 units holds at the cells stop.
  const from = new Map();
  for (const n of m.notes) if (n.fold8.kind !== 'residue') from.set(n.focus[0].unit, n.fold8.unit);
  const units8 = m.thematic.units[8].filter(u => u.kind !== 'residue').map(u => u.id);
  const order = m.inward.levels[0].units.filter(u => u.kind !== 'residue').map(u => units8.indexOf(from.get(u.id)));
  assert.deepEqual(order, order.slice().sort((x, y) => x - y));
  // link is in place, and so are the cells of the subject at their first note.
  m.notes.filter(n => n.fold8.unit === 'link').forEach(n => assert.equal(at(n, 9), at(n, 8)));
  const x = id => m.inward.levels[0].units.find(u => u.id === id).x;
  assert.deepEqual(['nug', 'a', 'b', 'd', 'link', 'tail'].map(x), [0, 20, 32, 60, 70.5, 79]);
});

test('order: at the cells stop found units and the residue marker keep their stop 8 place', () => {
  const src = 'M = [0, 3, 1, 2] || [1/4]\nM, (M * [3]), [9, 20, 15, 30, 10, 21, 16, 31, 11, 22, 17, 32], [0 | 1/2, 5 | 1/8, -3 | 1]';
  const m = fold(src, { showFound: true });
  assert.deepEqual(m.inward.levels[0].units.map(u => [u.kind, u.id, u.x, u.positions, u.notes]),
    [['entry', 'M', 0, 4, 8], ['found', 'F1', 4.5, 4, 12], ['residue', 'residue', 9, 1, 3]]);
  assert.deepEqual(m.notes.map(n => n.focus[0].kind), [...Array(8).fill('cell'), ...Array(12).fill('found'), ...Array(3).fill('residue')]);
  m.notes.forEach(n => assert.equal(at(n, 9), at(n, 8)));
  assert.equal(m.counts.shapes[9], 2);
  // Without showFound the found notes are residue at stop 8, and stay there.
  const r = fold(src);
  assert.deepEqual(r.inward.levels[0].units.map(u => [u.kind, u.id, u.positions]), [['entry', 'M', 4], ['residue', 'residue', 1]]);
  assert.ok(r.notes.filter(n => n.fold8.kind === 'residue').every(n => n.focus[0].kind === 'residue' && n.focus[0].entry === null));
});
