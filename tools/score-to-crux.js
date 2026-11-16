#!/usr/bin/env node
// Score (MusicXML .mxl/.xml or MIDI) -> Crux, literal and refactored.
//
//   node tools/score-to-crux.js chorale.mxl                  refactored program
//   node tools/score-to-crux.js chorale.mxl --literal        literal program only
//   node tools/score-to-crux.js chorale.mxl --json           full report
//
// Options: --lens diatonic|chromatic   --parts satb|all   --repeats written|expand
//          --streams auto|joint|factored   --beam N   --variants   --out file.crux
//          --generators   (atoms under operators: `[a, b]/`, `atom * path`, `skeleton . [atom/]`)
import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { loadScore, scoreToVoices, literalProgram, directiveHeader, verifyAgainstScore } from '../src/score/index.js';
import { refactorVoices } from '../src/refactor/grammar.js';
import { programBits } from '../src/refactor/cost.js';
import { buildGenerators } from '../src/refactor/generators.js';

export function convertScoreFile(file, options = {}) {
  const score = loadScore(file, { repeats: options.repeats ?? 'written' });
  let parts = options.parts ?? 'satb';
  if (parts === 'satb' && score.parts.filter(p => p.role).length < 4) parts = 'all';
  const converted = scoreToVoices(score, { parts, lens: options.lens ?? 'diatonic' });
  const labels = converted.lanes.map(l => l.role ?? l.name);
  const literal = literalProgram(converted);
  const literalOk = verifyAgainstScore(literal, converted);
  const report = { file, title: score.title, key: score.key, warnings: score.warnings,
    metadata: converted.metadata, literal, literalVerified: literalOk,
    literalBits: programBits(literal).bits };
  if (options.literalOnly) return report;
  const settings = { voiceLabels: labels, streams: options.streams ?? 'auto' };
  if (options.beam) Object.assign(settings, { beamWidth: options.beam, branching: options.beam });
  if (options.variants) settings.variants = true;
  if (options.generators) settings.generators = buildGenerators();
  const t0 = performance.now();
  const result = refactorVoices(converted.voices, settings);
  const code = `${directiveHeader(converted.metadata)}\n` +
    `// refactored: ${Math.round(result.bits)} bits vs ${Math.round(result.literalBits)} literal ` +
    `(${(100 * result.saving).toFixed(1)}% smaller), ${result.defs} definitions, ${result.mode} streams\n${result.code}`;
  return { ...report, code, bits: result.bits, saving: result.saving, savingVsAnchored: result.savingVsAnchored,
    anchoredBits: result.anchoredBits, definitions: result.defs, streams: result.mode,
    verified: result.verified && verifyAgainstScore(code, converted),
    milliseconds: performance.now() - t0 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { values, positionals } = parseArgs({ allowPositionals: true, options: {
      lens: { type: 'string' }, parts: { type: 'string' }, repeats: { type: 'string' },
      streams: { type: 'string' }, beam: { type: 'string' }, variants: { type: 'boolean' }, generators: { type: 'boolean' },
      literal: { type: 'boolean' }, json: { type: 'boolean' }, out: { type: 'string' }, help: { type: 'boolean' },
    } });
    if (values.help || positionals.length !== 1) {
      console.log('Usage: node tools/score-to-crux.js score.(mxl|xml|mid) [--lens diatonic|chromatic] [--parts satb|all] [--repeats written|expand] [--streams auto|joint|factored] [--beam N] [--variants] [--generators] [--literal] [--json] [--out file.crux]');
      process.exit(values.help ? 0 : 1);
    }
    const report = convertScoreFile(positionals[0], { lens: values.lens, parts: values.parts, repeats: values.repeats,
      streams: values.streams, beam: values.beam ? Number(values.beam) : 0, variants: values.variants,
      generators: values.generators, literalOnly: values.literal });
    const text = values.json ? JSON.stringify(report, null, 2) : (values.literal ? report.literal : report.code);
    if (values.out) fs.writeFileSync(values.out, text + '\n'); else console.log(text);
    if (!(values.literal ? report.literalVerified : report.verified)) {
      console.error('warning: output failed verification against the score');
      process.exitCode = 2;
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
