#!/usr/bin/env node
// Corpus benchmark: every SATB score in a MusicXML directory, several refactoring
// configurations, all measured in bits of Crux text (src/refactor/cost.js) and all
// verified note-for-note against the score.
//
//   node tools/benchmark-chorales.js ../media/music_xml/bach --output corpus/chorale-benchmark.json
//   node tools/benchmark-chorales.js DIR --limit 20 --configs grammar,baseline
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadScore, scoreToVoices, literalProgram, verifyAgainstScore, voiceMetrics } from '../src/score/index.js';
import { refactorVoices } from '../src/refactor/grammar.js';
import { findRepresentations } from '../src/representations.js';
import { programBits } from '../src/refactor/cost.js';

export const CONFIGS = {
  // The pre-existing bounded vocabulary search (REPRESENTATIONS.md), on all four voices.
  baseline: { lens: 'diatonic', run: voices => findRepresentations(voices, { topK: 1 })[0].code },
  // Defaults: best of joint/factored streams and of full/transposition-only transforms.
  default: { lens: 'diatonic', settings: {} },
  joint: { lens: 'diatonic', settings: { streams: 'joint' } },
  factored: { lens: 'diatonic', settings: { streams: 'factored' } },
  chromatic: { lens: 'chromatic', settings: {} },
  'all transforms': { lens: 'diatonic', settings: { streams: 'joint', transforms: 'given' } },
  'transposition only': { lens: 'diatonic', settings: { streams: 'joint', inversion: false, retrograde: false } },
  beam4: { lens: 'diatonic', settings: { beamWidth: 4, branching: 4 } },
  // Musically constrained: motifs start on beats and never cross a fermata.
  analysis: { lens: 'diatonic', settings: { streams: 'joint' }, constrained: true },
};

/** Phrase/beat constraints for the analysis configuration. */
export function analysisConstraints(score, converted) {
  return voiceMetrics(score, converted).map(m => ({ start: m.map(x => x.onBeat), cut: m.map((x, i) => i > 0 && m[i - 1].phraseEnd) }));
}

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  configs: { type: 'string' }, limit: { type: 'string' }, output: { type: 'string' }, repeats: { type: 'string' },
} });
if (positionals.length !== 1) throw new Error('Usage: node tools/benchmark-chorales.js DIR [--configs a,b] [--limit N] [--output file.json] [--repeats written|expand]');
const dir = positionals[0];
const names = values.configs ? values.configs.split(',') : Object.keys(CONFIGS);
for (const n of names) if (!CONFIGS[n]) throw new Error(`Unknown config ${n}; known: ${Object.keys(CONFIGS).join(', ')}`);
const limit = values.limit ? Number(values.limit) : Infinity;
const files = fs.readdirSync(dir).filter(f => /\.(mxl|xml|musicxml)$/i.test(f)).sort().slice(0, limit);

const rows = [], skipped = [];
const lensCache = new Map();
for (const file of files) {
  let score;
  try { score = loadScore(path.join(dir, file), { repeats: values.repeats ?? 'written' }); }
  catch (error) { skipped.push({ file, reason: error.message }); continue; }
  const row = { id: score.id, notes: 0, configs: {} };
  try {
    for (const name of names) {
      const config = CONFIGS[name];
      if (!lensCache.has(config.lens)) lensCache.set(config.lens, scoreToVoices(score, { lens: config.lens }));
      const converted = lensCache.get(config.lens);
      row.notes = converted.voices.flat().filter(p => p.tag !== 'r').length;
      const literal = literalProgram(converted, { header: false });
      const literalBits = programBits(literal).bits;
      const t0 = performance.now();
      let code, extra = {};
      if (config.run) code = config.run(converted.voices);
      else {
        const settings = config.constrained ? { ...config.settings, constraints: analysisConstraints(score, converted) } : config.settings;
        const r = refactorVoices(converted.voices, settings);
        code = r.code;
        extra = { definitions: r.defs, streams: r.mode, anchoredBits: r.anchoredBits };
      }
      const milliseconds = performance.now() - t0;
      const bits = programBits(code).bits;
      row.configs[name] = { bits, literalBits, saving: 1 - bits / literalBits, milliseconds,
        verified: verifyAgainstScore(code, converted), ...extra };
    }
  } catch (error) { skipped.push({ file, reason: error.message }); lensCache.clear(); continue; }
  lensCache.clear();
  rows.push(row);
  if (rows.length % 25 === 0) process.stderr.write(`${rows.length}/${files.length} ${row.id}\n`);
}

const summary = {};
for (const name of names) {
  const rs = rows.map(r => r.configs[name]).filter(Boolean);
  const sum = key => rs.reduce((n, r) => n + r[key], 0);
  const ms = rs.map(r => r.milliseconds).sort((a, b) => a - b);
  summary[name] = {
    pieces: rs.length, verified: rs.filter(r => r.verified).length,
    meanSaving: sum('saving') / rs.length, pooledSaving: 1 - sum('bits') / sum('literalBits'),
    totalBits: sum('bits'), literalBits: sum('literalBits'),
    medianMs: ms[ms.length >> 1], p95Ms: ms[Math.floor(ms.length * 0.95)],
    ...(rs[0]?.anchoredBits !== undefined ? { anchoredBits: sum('anchoredBits'), savingVsAnchored: 1 - sum('bits') / sum('anchoredBits') } : {}),
    ...(rs[0]?.streams ? { factoredChosen: rs.filter(r => r.streams === 'factored').length } : {}),
  };
}
const report = { date: new Date().toISOString(), node: process.version, source: dir, repeats: values.repeats ?? 'written',
  configs: Object.fromEntries(names.map(n => [n, CONFIGS[n].settings ?? 'findRepresentations topK 1'])),
  summary, skipped, rows };
if (values.output) fs.writeFileSync(values.output, JSON.stringify(report, null, 1) + '\n');
console.error('');
console.table(Object.fromEntries(Object.entries(summary).map(([k, s]) => [k, {
  pieces: s.pieces, verified: s.verified, 'mean saving %': (100 * s.meanSaving).toFixed(1),
  'pooled saving %': (100 * s.pooledSaving).toFixed(1), 'total kbit': (s.totalBits / 1000).toFixed(1), 'vs anchored %': s.savingVsAnchored === undefined ? '' : (100 * s.savingVsAnchored).toFixed(1),
  'median ms': Math.round(s.medianMs) }])));
