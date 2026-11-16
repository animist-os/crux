// Score input: MusicXML (.mxl/.xml/.musicxml) and standard MIDI, as one normalized Score.
import fs from 'node:fs';
import path from 'node:path';
import { parseMusicXml } from './musicxml.js';
import { parseMidi } from './midi.js';

export { parseMusicXml, selectVoices, keyInfo, partRole } from './musicxml.js';
export { parseMidi, estimateKey } from './midi.js';
export * from './to-crux.js';

/** Detect the format from bytes: zip (mxl), XML text, or MIDI header. */
export function detectFormat(bytes) {
  const b = Buffer.from(bytes);
  if (b.length >= 4 && b.toString('latin1', 0, 4) === 'MThd') return 'midi';
  if (b.length >= 4 && b.readUInt32LE(0) === 0x04034b50) return 'musicxml';
  const head = b.toString('utf8', 0, Math.min(b.length, 2048));
  if (/<score-(partwise|timewise)/.test(head) || /^\s*(<\?xml|<!DOCTYPE)/.test(head)) return 'musicxml';
  throw new Error('Unrecognized score format (expected MusicXML or MIDI).');
}

/** Parse score bytes of any supported format. */
export function parseScore(bytes, options = {}) {
  const format = options.format ?? detectFormat(bytes);
  if (format === 'musicxml') return parseMusicXml(bytes, options);
  if (format === 'midi') return parseMidi(bytes, options);
  throw new Error(`Unsupported format ${format}.`);
}

export function loadScore(file, options = {}) {
  const id = options.id ?? path.basename(file).replace(/\.(mxl|xml|musicxml|midi?|mid)$/i, '');
  return parseScore(fs.readFileSync(file), { ...options, id });
}
