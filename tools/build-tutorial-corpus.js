#!/usr/bin/env node
// Generate static, lazily loaded tutorial data from exported Bach MIDI fixtures.
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { midiToRepresentations, midiToVoices } from './midi-to-representations.js';
import { findRepresentations, verifyRepresentation } from '../src/representations.js';

const { positionals } = parseArgs({ allowPositionals: true });
if (positionals.length !== 2) throw new Error('Usage: node tools/build-tutorial-corpus.js exported-midi-directory output-directory');
const [source, output] = positionals;
const manifest = JSON.parse(await fs.readFile(path.join(source, 'manifest.json'), 'utf8'));
const catalogue = JSON.parse(await fs.readFile(new URL('../corpus/bach-chorale-titles.json', import.meta.url), 'utf8'));
const index = { version: 1, title: 'Bach chorale melodies',
  titleSource: catalogue.source,
  engineSha256: createHash('sha256').update(await fs.readFile(new URL('../src/representations.js', import.meta.url))).digest('hex'),
  description: 'Soprano melodies in written order, with ties joined and repeat signs played once.',
  search: { topK: 3, pitchRegime: 'auto', maxVocabulary: 3, minMotifLength: 3,
    maxMotifLength: 12, maxMotifs: 64, beamWidth: 16,
    costs: { literal: 1, definition: 2, reference: 0.35, operator: 0.25, rhythm: 0.2 } },
  skipped: manifest.skipped, pieces: [] };
await fs.mkdir(output, { recursive: true });
for (const piece of manifest.pieces) {
  if (!/^bwv[\w.-]+$/.test(piece.id)) throw new Error(`Invalid corpus id: ${piece.id}`);
  const bytes = await fs.readFile(path.join(source, `${piece.id}.mid`));
  const candidates = midiToRepresentations(bytes, index.search);
  const { voices, metadata } = midiToVoices(bytes, index.search);
  const maxLength = Math.max(...voices.map(v => v.length)) + 1;
  const literal = findRepresentations(voices, { topK: 1, minMotifLength: maxLength, maxMotifLength: maxLength })[0];
  const originalCode = `// #pitchRegime ${metadata.pitchRegime}\n// #tonic ${metadata.tonicMidi % 12}\n${literal.code}`;
  if (!verifyRepresentation(originalCode, voices)) throw new Error(`${piece.id}: invalid original`);
  const catalogueLabel = 'BWV ' + piece.id.slice(3);
  const titleInfo = catalogue.pieces[piece.id] || catalogue.pieces[piece.id.replace(/-[a-z]+$/i, '')];
  const title = titleInfo?.title || 'Chorale melody';
  const best = candidates[0];
  const summary = { id: piece.id, title, catalogueLabel, aliases: titleInfo?.aliases || [],
    named: Boolean(titleInfo), noteCount: metadata.noteCount,
    pitchRegime: metadata.pitchRegime, tonicMidi: metadata.tonicMidi,
    coverage: best.score.coverage, score: best.score.total, motifCount: best.motifs.length };
  const data = { ...summary, metadata, sourceFile: piece.sourceFile, sourceSha256: piece.sourceSha256,
    notes: piece.notes, originalCode, candidates: candidates.map(({ metadata: ignored, ...candidate }) => candidate) };
  await fs.writeFile(path.join(output, `${piece.id}.json`), JSON.stringify(data) + '\n');
  index.pieces.push(summary);
}
index.pieces.sort((a, b) => a.title.localeCompare(b.title, 'de', { sensitivity: 'base' }) || a.id.localeCompare(b.id, undefined, { numeric: true }));
// Publish the index last so interrupted generation never advertises absent files.
await fs.writeFile(path.join(output, 'index.json'), JSON.stringify(index, null, 2) + '\n');
console.log(`Generated ${index.pieces.length} tutorial pieces with ${index.search.topK} leading representations each.`);
