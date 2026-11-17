import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../src/index.js';
import '../src/fold/trace.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const examplesDir = path.join(here, '..', 'examples');

function crux(file) {
  const out = [];
  for (const e of fs.readdirSync(file, { withFileTypes: true })) {
    const p = path.join(file, e.name);
    if (e.isDirectory()) out.push(...crux(p));
    else if (e.name.endsWith('.crux')) out.push(p);
  }
  return out.sort();
}

const plain = p => ({ step: p.step, timeScale: p.timeScale, tag: p.tag ?? null, diad: p.diad ?? null });
const plainSections = r => r.sections.map(m => m.values.map(plain));
const frames = p => golden.crux_trace_frames(p);
const label = f => (f.kind === 'lit' ? `lit@${f.pos}` : f.kind === 'ref' ? `${f.name}[${f.index}]` : `${f.op}${f.exact ? '' : '?'}`);
const chain = p => frames(p).map(label).join(' > ');

test('trace: pips equal crux_interp for every example without unseeded random choices', (t) => {
  let compared = 0, skipped = 0;
  for (const file of crux(examplesDir)) {
    const src = fs.readFileSync(file, 'utf8');
    let interp;
    try { interp = golden.crux_interp(src); } catch { skipped++; continue; } // not a runnable program
    const traced = golden.crux_trace(src);
    if (traced.unseededRandom) { skipped++; continue; }
    assert.deepEqual(plainSections(traced), plainSections(interp), path.basename(file));
    for (const m of traced.sections) {
      for (const p of m.values) {
        if (p.tag === 'r' && !p.origin) continue; // voice entry rest added after evaluation
        assert.ok(p.origin, `${path.basename(file)}: pip without origin`);
        // A chain ends at a literal, or at a non-exact operator that made a new pip.
        const inner = frames(p)[0];
        assert.ok(inner.kind === 'lit' || (inner.kind === 'op' && !inner.exact && inner.next === null),
          `${path.basename(file)}: chain ends at ${inner.kind} ${inner.op}`);
      }
    }
    compared++;
  }
  t.diagnostic(`compared ${compared}, skipped ${skipped}`);
  assert.ok(compared >= 10, `compared ${compared}, skipped ${skipped}`);
});

test('trace: crux_interp result is unchanged after a trace', () => {
  const src = 'H = [0, 1, 2] || [1/2]\nH * [0, 4]';
  const before = golden.crux_interp(src);
  golden.crux_trace(src);
  const after = golden.crux_interp(src);
  assert.deepEqual(plainSections(after), plainSections(before));
  for (const p of after.sections[0].values) assert.equal('origin' in p, false);
  assert.deepEqual(Object.keys(after).sort(), Object.keys(before).sort());
  assert.equal(golden._cruxInternals.Mul.prototype.eval, before.constructor && golden._cruxInternals.Mul.prototype.eval);
});

test('trace: result carries the crux_interp fields', () => {
  const src = '[0, 1]\n!\n[2, 3, 4]';
  const t = golden.crux_trace(src);
  const r = golden.crux_interp(src);
  for (const k of Object.keys(r)) assert.ok(k in t, k);
  assert.equal(t.trace, true);
  assert.equal(t.unseededRandom, false);
});

test('trace: literal and nested references', () => {
  const src = 'A = [0, 1]\nB = A, [5]\nB';
  const t = golden.crux_trace(src);
  const v = t.sections[0].values;
  assert.equal(chain(v[0]), `lit@${src.indexOf('0, 1')} > A[0] > , > B[0]`);
  assert.equal(chain(v[1]), `lit@${src.indexOf('1]')} > A[1] > , > B[1]`);
  assert.equal(chain(v[2]), `lit@${src.indexOf('5')} > , > B[2]`);
  const refB = frames(v[0])[3];
  assert.equal(refB.kind, 'ref');
  assert.equal(refB.name, 'B');
  assert.equal(refB.pos, src.lastIndexOf('B'));
  const refA = frames(v[0])[1];
  assert.equal(refA.pos, src.indexOf('A, [5]'));
});

test('trace: a macro used twice gives two use ids', () => {
  const t = golden.crux_trace('H = [0, 1]\nH, (H * [3])');
  const v = t.sections[0].values;
  const uses = v.map(p => frames(p).find(f => f.kind === 'ref').use);
  assert.equal(uses[0], uses[1]);
  assert.equal(uses[2], uses[3]);
  assert.notEqual(uses[0], uses[2]);
  const mul = frames(v[2]).find(f => f.op === '*');
  assert.deepEqual(mul.arg, { step: 3, ts: 1 });
  assert.equal(mul.exact, true);
});

test('trace: fan with two operands, one reversed', () => {
  const t = golden.crux_trace('[0, 1, 2] * [4, 7 | -1]');
  const v = t.sections[0].values;
  assert.deepEqual(v.map(p => p.step), [4, 5, 6, 9, 8, 7]);
  const ops = v.map(p => frames(p).find(f => f.op === '*'));
  assert.deepEqual(ops.map(f => f.copy), [0, 0, 0, 1, 1, 1]);
  assert.deepEqual(ops.map(f => f.index), [0, 1, 2, 2, 1, 0]);
  assert.deepEqual(ops.map(f => !!f.reverse), [false, false, false, true, true, true]);
  assert.equal(ops[0].app, ops[5].app);
  // The literal under a reversed copy is the one at the recorded index.
  assert.equal(frames(v[3])[0].step, 2);
});

test('trace: mirror records its anchor', () => {
  const t = golden.crux_trace('[0, 1, 3] m [2]');
  const v = t.sections[0].values;
  assert.deepEqual(v.map(p => p.step), [4, 3, 1]);
  const f = frames(v[2]).find(x => x.op === 'm');
  assert.deepEqual(f.arg, { step: 2, ts: 1 });
  assert.equal(f.index, 2);
  assert.equal(f.exact, true);
});

test('trace: dot, stretch, expand and repeat are exact', () => {
  const v = golden.crux_trace('(([0, 1] . [2, 3]) || [2]) ^ [2]').sections[0].values;
  assert.deepEqual(v.map(p => [p.step, p.timeScale]), [[4, 2], [8, 2]]);
  assert.equal(chain(v[1]), `lit@6 > . > || > ^`);
  assert.deepEqual(frames(v[1])[1].arg, { step: 3, ts: 1 });
  assert.deepEqual(frames(v[1])[2].arg, { step: 0, ts: 2 });
  const r = golden.crux_trace('[0, 1] : 3').sections[0].values;
  assert.equal(r.length, 6);
  // `: 3` with a number parses as `* [0, 0, 0]`: one copy per repeat.
  assert.deepEqual(r.map(p => frames(p).find(f => f.op === '*').copy), [0, 0, 1, 1, 2, 2]);
  assert.ok(r.every(p => frames(p).filter(f => f.kind === 'op').length === 1), 'repeat writes one frame, not two');
});

test('trace: a non-exact operator writes one frame with exact false', () => {
  const v = golden.crux_trace('[0, 1, 2, 3] @ [@2 5]').sections[0].values;
  const ops = v.map(p => frames(p).filter(f => f.kind === 'op'));
  assert.ok(ops.every(o => o.length === 1 && o[0].op === '@' && o[0].exact === false));
  assert.deepEqual(ops.map(o => !!o[0].kept), [true, true, false, true]);
  assert.deepEqual(ops[2][0].out, { step: v[2].step, ts: v[2].timeScale });
  assert.equal(frames(v[2])[0].kind, 'lit');
});

test('trace: new @ pips in the place of one operand pip carry from', () => {
  const src = '[0, 1, 2, 3] @ [@2 [0, 2]/]';
  const v = golden.crux_trace(src).sections[0].values;
  assert.deepEqual(v.map(p => [p.step, p.timeScale]), [[0, 1], [1, 1], [2, 0.5], [4, 0.5], [3, 1]]);
  // The frames are as before: one `@` frame, index -1, no next.
  assert.deepEqual(v.map(chain), [`lit@1 > @?`, `lit@4 > @?`, '@?', '@?', `lit@10 > @?`]);
  const [a, b] = [v[2].origin, v[3].origin];
  for (const f of [a, b]) {
    assert.equal(f.index, -1);
    assert.equal(f.next, null);
    assert.deepEqual(Object.keys(f).sort(), ['app', 'arg', 'copy', 'exact', 'from', 'index', 'kept', 'kind', 'next', 'op', 'out']);
  }
  assert.deepEqual([a.from.index, a.from.part, a.from.parts], [2, 0, 2]);
  assert.deepEqual([b.from.index, b.from.part, b.from.parts], [2, 1, 2]);
  assert.equal(a.from.origin, b.from.origin);
  const replaced = golden.crux_trace_frames({ origin: a.from.origin });
  assert.equal(replaced.length, 1);
  assert.deepEqual([replaced[0].kind, replaced[0].step, replaced[0].pos], ['lit', 2, src.indexOf('2,')]);
  // Kept pips have no from.
  assert.ok(!('from' in v[0].origin) && !('from' in v[4].origin));
});

test('trace: a run of new @ pips over two operand pips has no from', () => {
  const v = golden.crux_trace('[0, 1, 2, 3] @ [@1 [0, 2]/, @2 [0, 1]/]').sections[0].values;
  assert.equal(v.length, 6);
  assert.ok(v.every(p => !('from' in p.origin)));
});

test('trace: global statements add one outer frame per voice', () => {
  const t = golden.crux_trace('[0, 1]\n!\n[2]\n_ * [7]');
  for (const m of t.sections) {
    for (const p of m.values) {
      const ops = frames(p).filter(f => f.kind === 'op').map(f => f.op);
      assert.deepEqual(ops, ['_', '*']);
    }
  }
});

test('trace: unseeded random choice is flagged, seeded is not', () => {
  assert.equal(golden.crux_trace('[{1, 2, 3}]').unseededRandom, true);
  assert.equal(golden.crux_trace('[0, 1, 2]').unseededRandom, false);
});
