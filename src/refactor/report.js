// Human-readable motif report for a refactored program: what each definition is,
// where it occurs (voice, measure.beat), and under which transformation.
import { renderState, locateOccurrences } from './grammar.js';
import { cruxNumber } from '../score/to-crux.js';

const fmtBeat = b => Number.isInteger(b) ? String(b) : String(Math.round(b * 1000) / 1000);

function describeTransform(t) {
  const parts = [];
  if (t.invert) parts.push('inverted');
  if (t.retro) parts.push('retrograde');
  if (Math.abs(t.scale - 1) > 1e-9) parts.push(`×${cruxNumber(t.scale)} time`);
  if (t.edits?.length) parts.push(`${t.edits.length} note${t.edits.length > 1 ? 's' : ''} varied`);
  return { text: parts.join(', ') };
}

/** Scale degree of a diatonic-lens step: 4.5 -> '♯5̂'. Chromatic lens: semitones. */
export function degreeName(step, lens = 'diatonic') {
  if (lens !== 'diatonic') return `${step >= 0 ? '+' : ''}${step}st`;
  const base = Math.floor(step);
  const deg = ((base % 7) + 7) % 7 + 1;
  return `${step !== base ? '♯' : ''}${deg}̂`;
}

/**
 * result: refactorVoices() output; metrics: voiceMetrics() (or nulls); labels: voice names.
 * Returns { markdown, motifs: [{ name, code, length, uses, voices, places }] }.
 */
export function motifReport(result, metrics, labels, { title = '', voices = null, lens = 'diatonic' } = {}) {
  const { names } = renderState(result.state, result.layout);
  const occurrences = locateOccurrences(result.state, result.layout);
  const codeLines = new Map(result.code.split('\n').filter(l => /^[MRL]\d+ = /.test(l)).map(l => [l.split(' = ')[0], l.split(' = ').slice(1).join(' = ')]));
  const motifs = [];
  for (const [id, name] of names) {
    const occ = occurrences.filter(o => o.def === id);
    if (!occ.length) continue;
    const length = occ[0].length;
    const places = occ.map(o => {
      const m = metrics[o.voice]?.[o.start];
      const where = m ? `${labels[o.voice]} m${m.measure} b${fmtBeat(m.beat)}` : `${labels[o.voice]} note ${o.start + 1}`;
      const d = describeTransform(o.t);
      const pip = voices?.[o.voice]?.[o.start];
      const on = pip && pip.tag !== 'r' && o.stream !== 'rhythm' ? degreeName(pip.step, lens) : '';
      return { voice: labels[o.voice], stream: o.stream, measure: m?.measure, beat: m?.beat, nested: o.nested,
        where, startsOn: on, how: d.text };
    });
    motifs.push({ name, code: codeLines.get(name) ?? '', length, uses: occ.length,
      voices: [...new Set(places.map(p => p.voice))], places, library: result.state.defs.get(id).frozen === true });
  }
  motifs.sort((a, b) => b.uses * b.length - a.uses * a.length);
  const lines = [];
  if (title) lines.push(`# ${title}`, '');
  lines.push(`${Math.round(result.bits)} bits vs ${Math.round(result.literalBits)} for the literal program ` +
    `(${(100 * result.saving).toFixed(1)}% smaller; ${(100 * result.savingVsAnchored).toFixed(1)}% beyond writing each voice in its own register). ` +
    `${motifs.length} motifs, ${result.mode} streams.`, '');
  const shared = motifs.filter(m => m.voices.length > 1);
  lines.push(`${shared.length} of ${motifs.length} motifs are shared between voices.`, '');
  lines.push('| motif | notes | uses | voices | definition | where (voice, measure, beat; first scale degree) |', '|---|---|---|---|---|---|');
  for (const m of motifs) {
    const where = m.places.slice(0, 12).map(p => `${p.where}${p.startsOn ? ` on ${p.startsOn}` : ''}${p.how ? ` (${p.how})` : ''}${p.stream === 'rhythm' ? ' [rhythm]' : ''}`).join('; ') + (m.places.length > 12 ? `; … ${m.places.length - 12} more` : '');
    const voiceList = m.voices.length > 6 ? `${m.voices.length} voices` : m.voices.join(' ');
    lines.push(`| ${m.name}${m.library ? ' (library)' : ''} | ${m.length} | ${m.uses} | ${voiceList} | \`${m.code.replace(/\|/g, '\\|')}\` | ${where} |`);
  }
  // Coverage: share of each voice's notes inside some top-level motif use.
  lines.push('', '| voice | notes | in motifs |', '|---|---|---|');
  result.layout.forEach((entry, v) => {
    const total = metrics[v]?.length ?? 0;
    const covered = new Set();
    for (const o of occurrences) if (o.voice === v && !o.nested && o.stream !== 'rhythm') for (let i = o.start; i < o.start + o.length; i++) covered.add(i);
    lines.push(`| ${labels[v]} | ${total} | ${total ? (100 * covered.size / total).toFixed(0) : 0}% |`);
  });
  return { markdown: lines.join('\n') + '\n', motifs };
}
