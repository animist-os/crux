#!/usr/bin/env node
// Survey Humdrum **kern scores for how well they reduce to Crux.
//
//   node tools/survey-kern.js DIR_OF_KRN --out OUT_DIR [--only id1,id2] [--budget SECONDS]
//   node tools/survey-kern.js --report OUT_DIR            print the ranked table (markdown)
//
// For each score: read the kern spines into monophonic lanes, run the refactoring
// search twice, and score both programs with tools/reduction-score.js.
//
//   half  accidentals written in the voices as half steps (the diatonic lens)
// Before the search, all lengths are multiplied by one factor (the best grid of
// tools/reduction-score.js), so the search does not pay for fractions.
//
//   lane  integer scale steps only. The accidentals are assumed to come from a
//         key lane. Its cost is estimated from a greedy split of the piece into
//         spans in which each degree has one inflection, and is added to the bits.
//
// Results are cached per score in OUT_DIR (id.json, id.half.crux, id.lane.crux), so a
// run that is cut short continues where it stopped. --budget stops starting new
// scores after that many seconds.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import '../src/index.js';
import { programBits } from '../src/refactor/cost.js';
import { refactorVoices } from '../src/refactor/grammar.js';
import { reductionScore, literalOnBestGrid } from './reduction-score.js';

const L = 'CDEFGAB';
/** One **kern file -> lanes of pips in both encodings, plus the greedy key-lane split. */
export function parseKernFile(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  let cols = null, nextLane = 0, key = null, sig = null, graces = 0, doubles = 0;
  const lanes = new Map(); // id -> [{t, dur, letterIdx, oct, alter}]
  const open = new Map();  // lane id -> last note (for ties)
  const push = (id, n) => { if (!lanes.has(id)) lanes.set(id, []); lanes.get(id).push(n); };
  for (const raw of lines) {
    if (!raw || raw.startsWith('!')) continue;
    const toks = raw.split('\t');
    if (raw.startsWith('**')) { cols = toks.map(t => t === '**kern' ? { id: `v${nextLane++}`, t: 0, kern: true } : { kern: false, t: 0 }); continue; }
    if (!cols) continue;
    if (raw.startsWith('*')) {
      const out = [];
      for (let i = 0; i < toks.length; i++) {
        const c = cols[i], tk = toks[i];
        if (!c) continue;
        if (tk === '*^') { out.push(c, { id: `${c.id}s${nextLane++}`, t: c.t, kern: c.kern }); }
        else if (tk === '*v') { out.push(c); while (toks[i + 1] === '*v') i++; }
        else if (tk === '*-') { /* drop */ }
        else {
          if (c.kern && !key) { const m = /^\*([A-Ga-g])([-#]?):/.exec(tk); if (m) key = { letter: m[1].toUpperCase(), minor: m[1] === m[1].toLowerCase(), alter: m[2] === '-' ? -1 : m[2] === '#' ? 1 : 0 }; }
          if (c.kern && !sig) { const m = /^\*k\[([^\]]*)\]/.exec(tk); if (m) { sig = {}; for (const a of m[1].matchAll(/([a-g])([-#])/g)) sig[a[1].toUpperCase()] = a[2] === '-' ? -1 : 1; } }
          out.push(c);
        }
      }
      cols = out; continue;
    }
    if (raw.startsWith('=')) continue;
    toks.forEach((tk, i) => {
      const c = cols[i];
      if (!c || !c.kern || tk === '.' || tk === '') return;
      const parts = tk.split(' ');
      let adv = 0;
      parts.forEach((p, pi) => {
        if (p.includes('q')) { graces++; return; }
        const m = /(\d+)(%\d+)?(\.*)/.exec(p);
        if (!m) return;
        let dur = m[1] === '0' ? 8 : 4 / Number(m[1]);
        if (m[2]) dur *= Number(m[2].slice(1));
        let add = dur; for (const _ of m[3]) { add /= 2; dur += add; }
        if (pi === 0) adv = dur;
        const pm = /([a-gA-G]+)([-#n]*)/.exec(p.replace(/^[^a-gA-Gr]*/, ''));
        if (!pm || /r/.test(p.replace(/[^a-gA-Gr]/g, '')) && !pm) return;
        if (/^\[?[\d.%]+r/.test(p.replace(/[{}()\[\]]/g, m0 => m0 === '[' ? '[' : ''))) return; // rest
        const ch = pm[1][0], n = pm[1].length, upper = ch === ch.toUpperCase();
        const oct = upper ? 4 - n : 3 + n;
        const alter = (pm[2].match(/#/g) || []).length - (pm[2].match(/-/g) || []).length;
        const id = pi === 0 ? c.id : `${c.id}c${pi}`;
        const cont = p.includes('_') || p.includes(']');
        const last = open.get(id);
        if (cont && last && last.letterIdx === L.indexOf(ch.toUpperCase()) && last.oct === oct && Math.abs(last.t + last.dur - c.t) < 1e-9) { last.dur += dur; return; }
        const note = { t: c.t, dur, letterIdx: L.indexOf(ch.toUpperCase()), oct, alter };
        push(id, note); open.set(id, note);
      });
      c.t += adv;
    });
  }
  if (!key) throw new Error('no key');
  sig = sig || {};
  const ti = L.indexOf(key.letter);
  const total = Math.max(...[...lanes.values()].map(v => Math.max(...v.map(n => n.t + n.dur))));
  const voicesHalf = [], voicesInt = [], events = [];
  for (const [id, notes] of lanes) {
    notes.sort((a, b) => a.t - b.t);
    const half = [], int = [];
    let end = 0;
    for (const n of notes) {
      if (n.t < end - 1e-9) continue; // overlap inside a lane: drop (rare)
      if (n.t > end + 1e-9) { half.push({ step: 0, timeScale: n.t - end, tag: 'r' }); int.push({ step: 0, timeScale: n.t - end, tag: 'r' }); }
      const d = 7 * (n.oct - 4) + n.letterIdx - ti, inf = n.alter - (sig[L[n.letterIdx]] ?? 0);
      if (Math.abs(inf) > 1) doubles++;
      half.push({ step: d + inf / 2, timeScale: n.dur }); int.push({ step: d, timeScale: n.dur });
      events.push({ t: n.t, deg: ((d % 7) + 7) % 7, inf });
      end = n.t + n.dur;
    }
    voicesHalf.push(half); voicesInt.push(int);
  }
  events.sort((a, b) => a.t - b.t);
  let spans = 1, map = {}, start = 0;
  const segs = [], states = new Map();
  const close = end => { const key = JSON.stringify(Object.entries(map).filter(([, v]) => v).sort()); if (!states.has(key)) states.set(key, states.size); segs.push(`${states.get(key)} | ${Math.round((end - start) * 96)}/96`); };
  for (const e of events) { if (e.deg in map && map[e.deg] !== e.inf) { close(e.t); start = e.t; spans++; map = {}; } map[e.deg] = e.inf; }
  close(total);
  const laneText = `[${segs.join(', ')}]`, laneStates = states.size;
  return { laneText, laneStates, key, voicesHalf, voicesInt, notes: events.length, chromatic: events.filter(e => e.inf).length, laneSpans: spans, total, graces, doubles, lanes: lanes.size };
}

function surveyOne(file, outDir) {
  const id = path.basename(file).replace(/\.krn$/, '');
  const k = parseKernFile(file);
  const row = { id, key: k.key.letter + (k.key.alter < 0 ? 'b' : k.key.alter > 0 ? '#' : '') + (k.key.minor ? ' minor' : ' major'),
    lanes: k.lanes, notes: k.notes, chromatic: k.chromatic, laneSpans: k.laneSpans, laneStates: k.laneStates,
    laneBits: Math.round(programBits(k.laneText).bits), graces: k.graces, doubleInflections: k.doubles };
  // Put the music on its best grid before the search, so the most common note
  // length is written without a fraction. The score uses the same grid.
  const gridFactor = literalOnBestGrid(k.voicesHalf).gridFactor;
  row.gridFactor = gridFactor;
  for (const [name, raw] of [['half', k.voicesHalf], ['lane', k.voicesInt]]) {
    const voices = raw.map(v => v.map(p => ({ ...p, timeScale: p.timeScale * gridFactor })));
    const r = refactorVoices(voices, { streams: 'joint' });
    row[name] = { verified: r.verified, ...reductionScore(r.code) };
    fs.writeFileSync(path.join(outDir, `${id}.${name}.crux`), r.code + '\n');
  }
  // The lane program's saving, with the lane's own bits, against the half-step literal.
  row.laneSaving = 1 - (row.lane.bits + row.laneBits) / row.half.literalBits;
  fs.writeFileSync(path.join(outDir, `${id}.json`), JSON.stringify(row));
  return row;
}

function report(outDir) {
  const rows = fs.readdirSync(outDir).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(outDir, f), 'utf8')));
  for (const r of rows) r.laneSaving ??= 1 - (r.lane.bits + r.laneBits) / r.half.literalBits;
  rows.sort((a, b) => b.laneSaving - a.laneSaving);
  const pct = x => (100 * x).toFixed(1);
  const lines = ['| rank | score | key | notes | chromatic | lane spans | saving (lane) | leverage (lane) | saving (half) | leverage (half) |', '|---|---|---|---|---|---|---|---|---|---|'];
  rows.forEach((r, i) => lines.push(`| ${i + 1} | ${r.id} | ${r.key} | ${r.notes} | ${pct(r.chromatic / r.notes)}% | ${r.laneSpans} | ${pct(r.laneSaving)}% | ${r.lane.leverage.toFixed(2)} | ${pct(r.half.saving)}% | ${r.half.leverage.toFixed(2)} |`));
  return lines.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    out: { type: 'string' }, only: { type: 'string' }, budget: { type: 'string' }, report: { type: 'string' } } });
  if (values.report) console.log(report(values.report));
  else {
    if (positionals.length !== 1 || !values.out) throw new Error('Usage: node tools/survey-kern.js DIR --out OUT_DIR [--only ids] [--budget seconds]');
    fs.mkdirSync(values.out, { recursive: true });
    const only = values.only ? new Set(values.only.split(',')) : null;
    const started = Date.now(), budget = values.budget ? Number(values.budget) * 1000 : Infinity;
    for (const f of fs.readdirSync(positionals[0]).filter(f => f.endsWith('.krn')).sort()) {
      const id = f.replace(/\.krn$/, '');
      if (only && !only.has(id)) continue;
      if (fs.existsSync(path.join(values.out, `${id}.json`))) continue;
      if (Date.now() - started > budget) { console.log('budget reached, run again to continue'); break; }
      try {
        const r = surveyOne(path.join(positionals[0], f), values.out);
        console.log(`${id}: lane ${(100 * r.laneSaving).toFixed(1)}% x${r.lane.leverage.toFixed(2)}, half ${(100 * r.half.saving).toFixed(1)}% x${r.half.leverage.toFixed(2)}${r.half.verified && r.lane.verified ? '' : '  NOT VERIFIED'}`);
      } catch (error) { console.log(`${id}: failed, ${error.message}`); }
    }
  }
}
