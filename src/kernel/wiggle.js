// Wiggle reach: nudge each step number of a Crux program by +1 and count how
// much of the surface moves. A kernel is good to play with when a few numbers
// move a lot of music.
import '../index.js';

const strip = code => code.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
const run = code => globalThis.golden.crux_interp(code).sections
  .map(s => s.values.map(p => ({ s: p.tag === 'r' ? null : p.step, t: p.timeScale })));

/**
 * The step numbers of a program: every number that is not a duration (after
 * `|`), a voice offset (`!N`), a repeat count (`:N`) or an edit index (`@N`).
 * Returns { src, numbers: [{ index, text, value, def, line, column }] } where def
 * is the definition the number sits in (null on a voice line) and line is 1-based.
 */
export function stepNumbers(code) {
  const src = strip(code);
  const re = /(?<![\w.\/|])-?\d+(?:\/\d+)?/g;
  const out = [];
  let m;
  while ((m = re.exec(src))) {
    const before = src.slice(0, m.index).trimEnd();
    if (/[|!:@]$/.test(before)) continue;
    const lineStart = src.lastIndexOf('\n', m.index) + 1;
    const def = /^\s*([A-Za-z_]\w*)\s*=/.exec(src.slice(lineStart, m.index))?.[1] ?? null;
    const value = m[0].includes('/') ? Number(m[0].split('/')[0]) / Number(m[0].split('/')[1]) : Number(m[0]);
    const line = src.slice(0, m.index).split('\n').length;
    out.push({ index: m.index, text: m[0], value, def, line, column: m.index - lineStart });
  }
  return { src, numbers: out };
}

/**
 * For every step number: how many surface notes change (pitch or duration) and
 * in how many voices, when the number is raised by one.
 * Returns { notes, params: [{ text, def, line, column, moved, voices }], summary }.
 */
export function wiggleReach(code) {
  const { src, numbers } = stepNumbers(code);
  const base = run(src);
  const notes = base.reduce((n, v) => n + v.filter(p => p.s !== null).length, 0);
  const params = [];
  for (const p of numbers) {
    const mutated = src.slice(0, p.index) + String(p.value + 1) + src.slice(p.index + p.text.length);
    let out;
    try { out = run(mutated); } catch { continue; }
    let moved = 0, voices = 0;
    out.forEach((voice, i) => {
      const b = base[i] ?? [];
      let here = 0;
      for (let j = 0; j < Math.max(voice.length, b.length); j++) {
        const x = voice[j], y = b[j];
        if (!x || !y || x.s !== y.s || x.t !== y.t) here++;
      }
      moved += here; voices += here > 0;
    });
    params.push({ text: p.text, def: p.def, line: p.line, column: p.column, moved, voices });
  }
  const sorted = params.map(p => p.moved).sort((a, b) => b - a);
  const total = sorted.reduce((n, x) => n + x, 0);
  const median = sorted.length ? sorted[sorted.length >> 1] : 0;
  return {
    notes, params,
    summary: {
      params: params.length, notes, median, mean: params.length ? total / params.length : 0,
      max: sorted[0] ?? 0,
      wide: params.filter(p => p.moved >= 10).length,
      single: params.filter(p => p.moved <= 1).length,
      multiVoice: params.filter(p => p.voices >= 2).length,
    },
  };
}
