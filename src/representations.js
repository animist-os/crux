// Bounded vocabulary search. No filesystem or MIDI dependency: usable by an editor.
import './index.js';

const near = (a, b) => Math.abs(a - b) < 1e-9;

// Crux numbers cannot use exponent notation. Preserve common rational durations.
function reprNumber(value) {
  if (Number.isInteger(value)) return String(value);
  for (let d = 2; d <= 1024; d++) {
    const n = Math.round(value * d);
    if (Math.abs(n / d - value) < 1e-12) return `${n}/${d}`;
  }
  return value.toFixed(12).replace(/0+$/, '').replace(/\.$/, '');
}

function reprLiteral(pips) {
  return '[' + pips.map(p => (p.tag === 'r' ? 'r' : reprNumber(p.step)) +
    (p.timeScale === 1 ? '' : ` | ${reprNumber(p.timeScale)}`)).join(', ') + ']';
}

function reprNormalize(voices) {
  if (!Array.isArray(voices) || !voices.length) throw new Error('Expected non-empty voices.');
  return voices.map(voice => {
    if (!Array.isArray(voice) || !voice.length) throw new Error('Each voice must contain pips.');
    return voice.map(p => {
      const ts = p.timeScale ?? 1;
      if (!Number.isFinite(p.step) || !Number.isFinite(ts) || ts <= 0 ||
          (p.tag != null && p.tag !== 'r')) {
        throw new Error('Expected finite steps, positive timeScales, and optional rest tags.');
      }
      return { step: p.tag === 'r' ? 0 : p.step, timeScale: ts, tag: p.tag ?? null };
    });
  });
}

function reprTransform(seed, target, mode) {
  for (const reverse of [false, true]) {
    for (const invert of [false, true]) {
      const sign = invert ? -1 : 1;
      const source = reverse ? [...seed].reverse() : seed;
      const offset = target[0].step - sign * source[0].step;
      const scale = mode === 'pitch' ? 1 : target[0].timeScale / source[0].timeScale;
      if (source.every((p, i) => near(sign * p.step + offset, target[i].step) &&
          (mode === 'pitch' || near(p.timeScale * scale, target[i].timeScale)))) {
        return { reverse, invert, offset, scale,
          operators: Number(invert) + Number(reverse || offset !== 0 || !near(scale, 1)) };
      }
    }
  }
  return null;
}

// Equivalent windows share a canonical key under inversion, reversal,
// transposition, and (in joint mode) uniform duration scaling.
function reprKey(window, mode) {
  const keys = [];
  for (const reverse of [false, true]) {
    const source = reverse ? [...window].reverse() : window;
    for (const sign of [1, -1]) {
      keys.push(source.map(p => `${(sign * (p.step - source[0].step)).toFixed(8)}:${
        mode === 'pitch' ? 1 : (p.timeScale / source[0].timeScale).toFixed(8)}`).join(';'));
    }
  }
  return keys.sort()[0];
}

function reprMine(voices, mode, options) {
  const groups = new Map();
  voices.forEach((voice, voiceIndex) => {
    for (let length = options.minMotifLength; length <= Math.min(options.maxMotifLength, voice.length); length++) {
      for (let start = 0; start + length <= voice.length; start++) {
        const window = voice.slice(start, start + length);
        if (window.some(p => p.tag === 'r')) continue;
        const key = reprKey(window, mode);
        let group = groups.get(key);
        if (!group) {
          group = { seed: window.map(p => ({ ...p, timeScale: mode === 'pitch' ? 1 : p.timeScale })), matches: [] };
          groups.set(key, group);
        }
        const transform = reprTransform(group.seed, window, mode);
        // Quantized keys only index candidates; matching and the interpreter verify them.
        if (transform) group.matches.push({ voice: voiceIndex, start, length, ...transform });
      }
    }
  });
  const pool = [];
  for (const group of groups.values()) {
    let count = 0;
    const ends = new Map();
    for (const m of group.matches) {
      if (m.start >= (ends.get(m.voice) ?? 0)) {
        count++;
        ends.set(m.voice, m.start + m.length);
      }
    }
    if (count < 2) continue;
    group.potential = (count - 1) * group.seed.length;
    pool.push(group);
  }
  pool.sort((a, b) => b.potential - a.potential || a.seed.length - b.seed.length);
  return pool.slice(0, options.maxMotifs).map((g, id) => ({ ...g, id }));
}

// Exact shortest path for a FIXED vocabulary. Literal edges preserve every pip;
// motif edges compete at each position, so overlaps cannot inflate coverage.
function reprCover(voices, vocabulary, costs) {
  return voices.map((voice, voiceIndex) => {
    const starts = Array.from({ length: voice.length }, () => []);
    for (const motif of vocabulary) {
      for (const match of motif.matches) {
        if (match.voice === voiceIndex) starts[match.start].push({ ...match, motif: motif.id });
      }
    }
    const dp = Array(voice.length + 1).fill(0);
    const edges = Array(voice.length);
    for (let i = voice.length - 1; i >= 0; i--) {
      dp[i] = costs.literal + dp[i + 1];
      edges[i] = { voice: voiceIndex, start: i, length: 1, motif: null };
      for (const match of starts[i]) {
        const cost = costs.reference + costs.operator * match.operators + dp[i + match.length];
        if (cost < dp[i] - 1e-10) {
          dp[i] = cost;
          edges[i] = match;
        }
      }
    }
    const selected = [];
    for (let i = 0; i < voice.length; i += edges[i].length) selected.push(edges[i]);
    return { selected, cost: dp[0] };
  });
}

function reprEvaluate(voices, vocabulary, costs) {
  let covers = reprCover(voices, vocabulary, costs);
  // A named seed must actually be reused in the non-overlapping explanation.
  // Prune singletons, then recompute coverage without them.
  while (true) {
    const uses = new Map();
    for (const { selected } of covers) for (const edge of selected) {
      if (edge.motif !== null) uses.set(edge.motif, (uses.get(edge.motif) ?? 0) + 1);
    }
    const kept = vocabulary.filter(m => (uses.get(m.id) ?? 0) >= 2);
    if (kept.length === vocabulary.length) break;
    vocabulary = kept;
    covers = reprCover(voices, vocabulary, costs);
  }
  const definitionNotes = vocabulary.reduce((n, m) => n + m.seed.length, 0);
  const cost = covers.reduce((n, c) => n + c.cost, 0) +
    definitionNotes * costs.literal + vocabulary.length * costs.definition;
  return { vocabulary, covers, cost, definitionNotes };
}

function reprRhythm(voice) {
  const values = voice.map(p => p.timeScale);
  // Cog jam cycles the RHS, including incomplete final repetitions.
  let period = values.length;
  for (let p = 1; p < values.length; p++) {
    if (values.every((v, i) => near(v, values[i % p]))) { period = p; break; }
  }
  return { code: '[' + values.slice(0, period).map(v => `|${reprNumber(v)}`).join(', ') + ']', period };
}

function reprExpression(name, edge) {
  let expr = edge.invert ? `(${name} m [0])` : name;
  if (edge.reverse || edge.offset !== 0 || !near(edge.scale, 1)) {
    expr = `(${expr} * [${reprNumber(edge.offset)} | ${reprNumber(edge.reverse ? -edge.scale : edge.scale)}])`;
  }
  return expr;
}

function reprRender(voices, state, mode, options) {
  const names = new Map(state.vocabulary.map((m, i) => [m.id, `mot${i + 1}`]));
  const motifs = state.vocabulary.map(m => ({
    name: names.get(m.id), code: reprLiteral(m.seed), noteCount: m.seed.length,
    occurrences: state.covers.flatMap(c => c.selected).filter(e => e.motif === m.id).map(e => ({
      voice: e.voice, start: e.start, length: e.length,
      transpose: e.offset, inversion: e.invert, retrograde: e.reverse, timeScale: e.scale,
    })),
  }));
  const definitions = motifs.map(m => `${m.name} = ${m.code}`);
  let rhythmValues = 0;
  const sections = state.covers.map(({ selected }, voiceIndex) => {
    const voice = voices[voiceIndex];
    const parts = [];
    let literals = [];
    const flush = () => {
      if (literals.length) parts.push(reprLiteral(literals));
      literals = [];
    };
    for (const edge of selected) {
      if (edge.motif === null) {
        const pip = voice[edge.start];
        literals.push(mode === 'pitch' ? { ...pip, timeScale: 1 } : pip);
      } else {
        flush();
        parts.push(reprExpression(names.get(edge.motif), edge));
      }
    }
    flush();
    let expr = parts.join(', ');
    if (mode === 'pitch' && voice.some(p => p.timeScale !== 1)) {
      const rhythm = reprRhythm(voice);
      rhythmValues += rhythm.period;
      const name = `rhythm${voiceIndex + 1}`;
      definitions.push(`${name} = ${rhythm.code}`);
      expr = `(${expr}) .j ${name}`;
    }
    return expr;
  });
  const code = [...definitions, sections.join('\n!\n')].join('\n');
  const totalPips = voices.reduce((n, v) => n + v.length, 0);
  const noteCount = voices.flat().filter(p => p.tag !== 'r').length;
  const coveredNotes = motifs.reduce((n, m) => n + m.noteCount * m.occurrences.length, 0);
  const cost = state.cost + rhythmValues * options.costs.rhythm;
  const baselineCost = totalPips * options.costs.literal;
  return { code, kind: motifs.length ? `vocabulary-${mode}` : 'literal', motifs,
    score: { total: (baselineCost - cost) / baselineCost, cost, baselineCost,
      coverage: noteCount ? coveredNotes / noteCount : 0, coveredNotes,
      residualNotes: noteCount - coveredNotes, definitionNotes: state.definitionNotes,
      motifCount: motifs.length, reusedNotes: coveredNotes - state.definitionNotes,
      rhythmValues },
    verified: false };
}

/** Verify all voices, pitches, rest tags and durations through the real interpreter. */
export function verifyRepresentation(code, voices) {
  try {
    const sections = globalThis.golden.crux_interp(code).sections;
    return sections.length === voices.length && sections.every((section, i) =>
      section.values.length === voices[i].length && section.values.every((p, j) => {
        const expected = voices[i][j];
        return (p.tag ?? null) === (expected.tag ?? null) &&
          (expected.tag === 'r' || near(p.step, expected.step)) && near(p.timeScale, expected.timeScale ?? 1);
      }));
  } catch { return false; }
}

/**
 * Rank Crux explanations for one or more voices of {step,timeScale,tag?} pips.
 * Higher score means more reuse after paying for vocabulary and applications.
 * Beam search is heuristic over dictionaries; it does not prove global optimality.
 */
export function findRepresentations(input, settings = {}) {
  const voices = reprNormalize(input);
  const options = { topK: 5, minMotifLength: 3, maxMotifLength: 12, maxMotifs: 64,
    maxVocabulary: 3, beamWidth: 16, ...settings,
    costs: { literal: 1, definition: 2, reference: 0.35, operator: 0.25, rhythm: 0.2, ...settings.costs } };
  for (const name of ['topK', 'minMotifLength', 'maxMotifLength', 'maxMotifs', 'maxVocabulary', 'beamWidth']) {
    if (!Number.isSafeInteger(options[name]) || options[name] < 1) throw new Error(`${name} must be a positive integer.`);
  }
  if (options.minMotifLength < 2 || options.maxMotifLength < options.minMotifLength) {
    throw new Error('Motif lengths must satisfy 2 <= minMotifLength <= maxMotifLength.');
  }
  for (const [name, value] of Object.entries(options.costs)) {
    if (!Number.isFinite(value) || value < 0 || (name === 'literal' && value === 0)) {
      throw new Error(`Invalid cost: ${name}`);
    }
  }
  const baseline = reprRender(voices, reprEvaluate(voices, [], options.costs), 'joint', options);
  const results = [baseline];
  for (const mode of ['joint', 'pitch']) {
    const pool = reprMine(voices, mode, options);
    let beam = [reprEvaluate(voices, [], options.costs)];
    const visited = new Set(['']);
    for (let depth = 1; depth <= options.maxVocabulary; depth++) {
      const expanded = [];
      for (const state of beam) for (const motif of pool) {
        if (state.vocabulary.some(m => m.id === motif.id)) continue;
        const vocabulary = [...state.vocabulary, motif].sort((a, b) => a.id - b.id);
        const key = vocabulary.map(m => m.id).join(',');
        if (visited.has(key)) continue;
        visited.add(key);
        const next = reprEvaluate(voices, vocabulary, options.costs);
        if (next.vocabulary.length !== depth) continue;
        expanded.push(next);
      }
      expanded.sort((a, b) => a.cost - b.cost);
      beam = expanded.slice(0, options.beamWidth);
      results.push(...beam.map(state => reprRender(voices, state, mode, options)));
      if (!beam.length) break;
    }
  }
  results.sort((a, b) => b.score.total - a.score.total || a.code.length - b.code.length || a.code.localeCompare(b.code));
  const seen = new Set();
  const verified = [];
  for (const candidate of results) {
    if (seen.has(candidate.code)) continue;
    seen.add(candidate.code);
    if (!verifyRepresentation(candidate.code, voices)) continue;
    candidate.verified = true;
    verified.push(candidate);
    if (verified.length === options.topK) break;
  }
  if (!verified.length) throw new Error('Could not represent input at Crux numeric precision.');
  return verified;
}

globalThis.golden.findRepresentations = findRepresentations;
