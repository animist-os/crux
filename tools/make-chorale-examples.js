#!/usr/bin/env node
// Write worked examples: literal and refactored Crux plus a motif report per score.
//
//   node tools/make-chorale-examples.js ../media/music_xml/bach examples/chorales bwv269 bwv1.6 ...
//   node tools/make-chorale-examples.js --family examples/chorales/o-haupt-family.crux DIR bwv244.54 bwv244.62 ...
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadScore, scoreToVoices, literalProgram, directiveHeader, verifyAgainstScore, voiceMetrics } from '../src/score/index.js';
import { refactorVoices, verifyProgram } from '../src/refactor/grammar.js';
import { motifReport } from '../src/refactor/report.js';
import { buildGenerators } from '../src/refactor/generators.js';

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  family: { type: 'string' }, library: { type: 'string' }, beam: { type: 'string' },
  generators: { type: 'boolean' }, 'only-atoms': { type: 'boolean' },
} });

function constraintsFor(score, converted) {
  return voiceMetrics(score, converted).map(m => ({ start: m.map(x => x.onBeat), cut: m.map((x, i) => i > 0 && m[i - 1].phraseEnd) }));
}

function locate(dir, id) {
  for (const ext of ['.mxl', '.xml', '.musicxml', '.mid', '.midi']) {
    const file = path.join(dir, id + ext);
    if (fs.existsSync(file)) return file;
  }
  if (fs.existsSync(id)) return id;
  throw new Error(`Score ${id} not found in ${dir}`);
}

const beam = values.beam ? Number(values.beam) : 4;
// --generators adds *.atoms.crux: the analysis program with atoms under operators.
const generators = values.generators || values['only-atoms'] ? buildGenerators() : null;
const titlesFile = path.join(import.meta.dirname, '../corpus/bach-chorale-titles.json');
const titles = fs.existsSync(titlesFile) ? JSON.parse(fs.readFileSync(titlesFile, 'utf8')).pieces : {};
const titleOf = score => titles[score.id]?.title ?? score.title ?? score.id;

if (values.family) {
  // Several pieces in one program: their voices are sections, each harmonization
  // entering after the previous one (!N), so motifs are shared across pieces.
  const [dir, ...ids] = positionals;
  const voices = [], labels = [], notes = [];
  let offset = 0;
  for (const id of ids) {
    const score = loadScore(locate(dir, id));
    const converted = scoreToVoices(score, { lens: 'diatonic' });
    const length = Math.max(...converted.voices.map(v => v.reduce((n, p) => n + p.timeScale, 0)));
    converted.voices.forEach((v, i) => {
      voices.push(offset ? [{ step: 0, timeScale: offset, tag: 'r' }, ...v] : v);
      labels.push(`${score.id} ${converted.lanes[i].role}`);
    });
    notes.push(`// ${score.id} (${titleOf(score)}): tonic pc ${converted.metadata.tonicPc}, ${converted.metadata.pitchRegime}, tonicMidi ${converted.metadata.tonicMidi}, enters at ${offset}`);
    offset += length;
  }
  const r = refactorVoices(voices, { streams: 'joint', voiceLabels: labels, offsets: true, beamWidth: beam, branching: beam });
  if (!r.verified || !verifyProgram(r.code, voices)) throw new Error('family program failed verification');
  const text = `// One Crux program for ${ids.length} harmonizations; each piece's voices are sections.\n` +
    `// Steps are scale degrees relative to each piece's own tonic (diatonic lens).\n${notes.join('\n')}\n` +
    `// ${Math.round(r.bits)} bits vs ${Math.round(r.literalBits)} literal (${(100 * r.saving).toFixed(1)}% smaller), ${r.defs} definitions\n${r.code}\n`;
  fs.writeFileSync(values.family, text);
  const metrics = voices.map(v => v.map(() => null));
  const report = motifReport(r, metrics, labels, { title: `Family: ${ids.join(', ')}`, voices });
  fs.writeFileSync(values.family.replace(/\.crux$/, '.motifs.md'), report.markdown);
  console.log(`${values.family}: ${Math.round(r.bits)} / ${Math.round(r.literalBits)} bits (${(100 * r.saving).toFixed(1)}%)`);
} else {
  const [dir, outDir, ...ids] = positionals;
  fs.mkdirSync(outDir, { recursive: true });
  for (const id of ids) {
    const score = loadScore(locate(dir, id));
    let parts = 'satb';
    if (score.parts.filter(p => p.role).length < 4) parts = 'all';
    const converted = scoreToVoices(score, { lens: 'diatonic', parts });
    const labels = converted.lanes.map(l => l.role ?? l.name);
    const literal = literalProgram(converted);
    const header = directiveHeader({ ...converted.metadata, title: `${score.id}: ${titleOf(score)}` });
    const metrics = voiceMetrics(score, converted);
    const constraints = score.format === 'musicxml' ? constraintsFor(score, converted) : null;
    const base = { voiceLabels: labels, beamWidth: beam, branching: beam };
    const runs = [];
    let analysis = null, compact = null;
    if (!values['only-atoms']) {
      analysis = refactorVoices(converted.voices, { ...base, streams: 'joint', constraints });
      compact = refactorVoices(converted.voices, { ...base, streams: 'auto' });
      runs.push(['analysis', analysis], ['compact', compact]);
    }
    if (generators) runs.push(['atoms', refactorVoices(converted.voices, { ...base, streams: 'joint', constraints, generators })]);
    for (const [name, r] of runs) {
      const code = `${header}\n// ${name}: ${Math.round(r.bits)} bits vs ${Math.round(r.literalBits)} literal ` +
        `(${(100 * r.saving).toFixed(1)}% smaller), ${r.defs} definitions, ${r.mode} streams\n${r.code}\n`;
      if (!verifyAgainstScore(code, converted)) throw new Error(`${id} ${name} failed verification`);
      fs.writeFileSync(path.join(outDir, `${score.id}.${name}.crux`), code);
    }
    if (values['only-atoms']) { console.log(`${score.id}: atoms ${Math.round(runs[0][1].bits)} bits`); continue; }
    fs.writeFileSync(path.join(outDir, `${score.id}.literal.crux`), literal + '\n');
    const report = motifReport(analysis, metrics, labels, { title: `${score.id}: ${titleOf(score)}`, voices: converted.voices });
    fs.writeFileSync(path.join(outDir, `${score.id}.motifs.md`), report.markdown +
      `\nThe compact program (no phrase/beat constraints) is ${Math.round(compact.bits)} bits (${(100 * compact.saving).toFixed(1)}% smaller, ${compact.mode} streams).\n`);
    console.log(`${score.id}: analysis ${Math.round(analysis.bits)}, compact ${Math.round(compact.bits)}, literal ${Math.round(analysis.literalBits)} bits`);
  }
}
