// Crux Decomposition Engine
// Given a flat evaluated mot, discover candidate Crux programs that produce it.

import './index.js';

// ============================================================================
// AST Node Types
// ============================================================================
// Each node implements toString() producing valid Crux syntax.
// Verification round-trips through golden.crux_interp().

class DLiteral {
  constructor(pips) {
    // pips: [{step, timeScale}]
    this.pips = pips;
  }
  toString() {
    const parts = this.pips.map(p => {
      const step = p.step;
      const ts = p.timeScale ?? 1;
      if (ts === 1) return `${step}`;
      // Negative timeScale signals retrograde in Mul/Expand operators.
      // Preserve the sign so round-trip verification works.
      const absTs = Math.abs(ts);
      const neg = ts < 0 ? '-' : '';
      if (absTs === 1) return `${step} | ${neg}1`;
      const inv = 1 / absTs;
      const invRounded = Math.round(inv);
      if (Math.abs(inv - invRounded) < 1e-10 && invRounded !== 0) {
        return `${step} | ${neg}/${invRounded}`;
      }
      const tsStr = Number.isInteger(absTs) ? String(absTs) : String(+absTs.toFixed(6)).replace(/\.0+$/, '');
      return `${step} | ${neg}${tsStr}`;
    });
    return '[' + parts.join(', ') + ']';
  }
  get isPrimary() { return true; }
}

class DRange {
  constructor(from, to) {
    this.from = from;
    this.to = to;
  }
  toString() {
    return `[${this.from}->${this.to}]`;
  }
  get isPrimary() { return true; }
}

class DBinOp {
  constructor(opStr, left, right) {
    this.opStr = opStr;
    this.left = left;
    this.right = right;
  }
  toString() {
    let l = this.left.isPrimary ? this.left.toString() : `(${this.left.toString()})`;
    const r = this.right.isPrimary ? this.right.toString() : `(${this.right.toString()})`;
    // .j after a bare ident fails to parse — wrap in parens
    if (this.opStr === '.j' && this.left instanceof DRef) {
      l = `(${l})`;
    }
    return `${l} ${this.opStr} ${r}`;
  }
  get isPrimary() { return false; }
}

class DConcat {
  constructor(parts) {
    // parts: AST[]
    this.parts = parts;
  }
  toString() {
    return this.parts.map(p => p.toString()).join(', ');
  }
  get isPrimary() { return false; }
}

class DRepeat {
  constructor(expr, count) {
    this.expr = expr;
    this.count = count;
  }
  toString() {
    const e = this.expr.isPrimary ? this.expr.toString() : `(${this.expr.toString()})`;
    return `${e} : ${this.count}`;
  }
  get isPrimary() { return false; }
}

class DRhythmMask {
  constructor(timeScales) {
    // timeScales: number[] — the timeScale values for each pip position
    this.timeScales = timeScales;
  }
  toString() {
    const parts = this.timeScales.map(ts => {
      ts = Math.abs(ts);
      if (ts === 1) return '|';
      const inv = 1 / ts;
      const invRounded = Math.round(inv);
      if (Math.abs(inv - invRounded) < 1e-10 && invRounded !== 0) {
        return `|/${invRounded}`;
      }
      const tsStr = Number.isInteger(ts) ? String(ts) : String(+ts.toFixed(6)).replace(/\.0+$/, '');
      return `|${tsStr}`;
    });
    return '[' + parts.join(', ') + ']';
  }
  get isPrimary() { return true; }
}

class DAssign {
  constructor(name, expr) {
    this.name = name;
    this.expr = expr;
  }
  toString() {
    return `${this.name} = ${this.expr.toString()}`;
  }
  get isPrimary() { return false; }
}

class DRef {
  constructor(name) {
    this.name = name;
  }
  toString() {
    return this.name;
  }
  get isPrimary() { return true; }
}

class DProgram {
  constructor(assignments, finalExpr) {
    // assignments: [{name, expr}] — variable assignments in order
    // finalExpr: AST node — the final expression that produces the output
    this.assignments = assignments;
    this.finalExpr = finalExpr;
  }
  toString() {
    const lines = this.assignments.map(a => `${a.name} = ${a.expr.toString()}`);
    lines.push(this.finalExpr.toString());
    return lines.join('\n');
  }
  get isPrimary() { return false; }
}


// ============================================================================
// Analyzers (Phase 1)
// ============================================================================

function analyzeIntervals(pips) {
  const deltas = [];
  const absDeltas = [];
  for (let i = 1; i < pips.length; i++) {
    const d = pips[i].step - pips[i - 1].step;
    deltas.push(d);
    absDeltas.push(Math.abs(d));
  }
  return { deltas, absDeltas };
}

function analyzeProgressions(pips, deltas) {
  // Find maximal contiguous runs where the delta is constant.
  // A run needs >= 3 pips (>= 2 deltas) to be interesting.
  const runs = [];
  if (deltas.length === 0) return runs;

  let runStart = 0;
  for (let i = 1; i <= deltas.length; i++) {
    if (i < deltas.length && deltas[i] === deltas[runStart]) continue;
    // Run of constant delta from runStart to i-1 (in delta-space)
    // which covers pip indices runStart to i (inclusive)
    const pipStart = runStart;
    const pipEnd = i; // inclusive index in pips
    const pipCount = pipEnd - pipStart + 1;
    if (pipCount >= 3) {
      runs.push({
        start: pipStart,
        end: pipEnd,        // inclusive pip index
        startVal: pips[pipStart].step,
        endVal: pips[pipEnd].step,
        delta: deltas[runStart],
        length: pipCount,
      });
    }
    runStart = i;
  }
  return runs;
}

function analyzeRepeats(pips) {
  // Check if the full sequence (or a prefix) repeats a shorter pattern.
  const len = pips.length;
  const results = [];

  for (let period = 1; period <= Math.floor(len / 2); period++) {
    let matches = true;
    for (let i = period; i < len; i++) {
      const ref = i % period;
      if (pips[i].step !== pips[ref].step ||
          Math.abs(pips[i].timeScale - pips[ref].timeScale) > 1e-10) {
        matches = false;
        break;
      }
    }
    if (matches) {
      const count = Math.floor(len / period);
      const remainder = len % period;
      results.push({
        period,
        count: remainder === 0 ? count : count,
        isTruncated: remainder !== 0,
        remainder,
      });
    }
  }
  return results;
}

function analyze(pips) {
  const { deltas, absDeltas } = analyzeIntervals(pips);
  const progressions = analyzeProgressions(pips, deltas);
  const repeats = analyzeRepeats(pips);
  return { deltas, absDeltas, progressions, repeats };
}


// ============================================================================
// Rhythm Factoring
// ============================================================================

function isUniformTs(pips) {
  if (pips.length === 0) return true;
  const ts0 = pips[0].timeScale;
  return pips.every(p => Math.abs(p.timeScale - ts0) < 1e-10);
}

function allTsOne(pips) {
  return pips.every(p => Math.abs(p.timeScale - 1) < 1e-10);
}

// Strip timeScales from pips, returning step-only pips (all ts=1).
function stripRhythm(pips) {
  return pips.map(p => ({ step: p.step, timeScale: 1 }));
}

// Extract the timeScale sequence from pips.
function extractRhythm(pips) {
  return pips.map(p => p.timeScale);
}

// Compress a rhythm mask into a compact AST node.
// Returns null if no compression found (use the full mask literal).
// Note: Only uniform masks (all same value) can be compressed, because .j
// tiles a shorter RHS across the LHS positions. Non-uniform repeating patterns
// can't use DRepeat because the : operator strips _pipeOnly flags from pips,
// breaking the .j step-preservation mechanism.
function compressRhythm(timeScales) {
  const len = timeScales.length;
  if (len === 0) return null;

  // Uniform: all same → single-element mask (tiles via .j)
  const ts0 = timeScales[0];
  if (timeScales.every(ts => Math.abs(ts - ts0) < 1e-10)) {
    return new DRhythmMask([ts0]);
  }

  // No compression found — non-uniform masks must use full literal
  return null;
}

// Build the rhythm expression for use in `.j rhythmExpr`.
function buildRhythmExpr(timeScales) {
  const compressed = compressRhythm(timeScales);
  if (compressed) return compressed;
  return new DRhythmMask(timeScales);
}


// ============================================================================
// Variable Hoisting
// ============================================================================
// Identifies repeated sub-expressions in a candidate AST and hoists them
// into named variable assignments. The goal is to reveal repetition and
// structural relationships — not to save characters. A hoist that costs
// characters but names a motif used three times is a clear win.

const MIN_HOIST_LEN = 5; // min toString() length to consider hoisting

// Variable names: aa, ab, ac, ... az, ba, bb, ...
// Two-char names avoid single-letter operator conflicts (j, m, l, c, g, r, p, t, z).
function generateVarName(index) {
  const first = String.fromCharCode(97 + Math.floor(index / 26));
  const second = String.fromCharCode(97 + (index % 26));
  return first + second;
}

// Walk every node in the AST tree, calling visitor(node) for each.
function walkAST(node, visitor) {
  visitor(node);
  if (node instanceof DBinOp) {
    walkAST(node.left, visitor);
    walkAST(node.right, visitor);
  } else if (node instanceof DConcat) {
    for (const part of node.parts) walkAST(part, visitor);
  } else if (node instanceof DRepeat) {
    walkAST(node.expr, visitor);
  } else if (node instanceof DProgram) {
    for (const a of node.assignments) walkAST(a.expr, visitor);
    walkAST(node.finalExpr, visitor);
  }
}

// Collect all sub-expressions and their occurrence counts.
// Returns Map<serialized_string, {count, node}>.
function collectSubExpressions(node) {
  const map = new Map();
  walkAST(node, (subNode) => {
    // Skip DRef nodes (already hoisted) and the root itself
    if (subNode instanceof DRef) return;
    if (subNode === node) return;
    const key = subNode.toString();
    if (key.length < MIN_HOIST_LEN) return;
    if (!map.has(key)) {
      map.set(key, { count: 0, node: subNode });
    }
    map.get(key).count++;
  });
  return map;
}

// Return a new AST with all nodes matching targetKey replaced by replacement.
function substituteAST(node, targetKey, replacement) {
  if (node.toString() === targetKey) return replacement;
  if (node instanceof DBinOp) {
    const newLeft = substituteAST(node.left, targetKey, replacement);
    const newRight = substituteAST(node.right, targetKey, replacement);
    if (newLeft === node.left && newRight === node.right) return node;
    return new DBinOp(node.opStr, newLeft, newRight);
  }
  if (node instanceof DConcat) {
    let changed = false;
    const newParts = node.parts.map(p => {
      const np = substituteAST(p, targetKey, replacement);
      if (np !== p) changed = true;
      return np;
    });
    return changed ? new DConcat(newParts) : node;
  }
  if (node instanceof DRepeat) {
    const newExpr = substituteAST(node.expr, targetKey, replacement);
    if (newExpr === node.expr) return node;
    return new DRepeat(newExpr, node.count);
  }
  if (node instanceof DProgram) {
    let changed = false;
    const newAssignments = node.assignments.map(a => {
      const newExpr = substituteAST(a.expr, targetKey, replacement);
      if (newExpr !== a.expr) { changed = true; return { ...a, expr: newExpr }; }
      return a;
    });
    const newFinal = substituteAST(node.finalExpr, targetKey, replacement);
    if (newFinal !== node.finalExpr) changed = true;
    return changed ? new DProgram(newAssignments, newFinal) : node;
  }
  return node;
}

// Evaluate a standalone Crux expression and return its pip values.
function evalExpr(code) {
  try {
    const result = golden.crux_interp(code);
    const mot = result.sections.at(-1);
    if (!mot?.values) return null;
    return mot.values.map(p => ({ step: p.step, timeScale: p.timeScale }));
  } catch { return null; }
}

// After hoisting, try to express variables in terms of each other.
// Detects transposition (aa * [N]) and retrograde (aa * [N | -1]).
// Returns the number of inter-variable relationships found.
function findVariableRelationships(assignments) {
  // Evaluate each variable's expression to get pip values
  const evalMap = new Map();
  for (const assign of assignments) {
    const pips = evalExpr(assign.expr.toString());
    if (pips) evalMap.set(assign.name, pips);
  }

  let count = 0;

  for (let i = 1; i < assignments.length; i++) {
    const laterPips = evalMap.get(assignments[i].name);
    if (!laterPips || laterPips.length === 0) continue;

    for (let j = 0; j < i; j++) {
      const earlierPips = evalMap.get(assignments[j].name);
      if (!earlierPips || earlierPips.length === 0) continue;
      if (earlierPips.length !== laterPips.length) continue;

      const earlierName = assignments[j].name;

      // Check transposition: later = earlier + constant offset
      const offset = laterPips[0].step - earlierPips[0].step;
      if (offset !== 0) {
        let isTransposition = true;
        for (let k = 0; k < earlierPips.length; k++) {
          if (laterPips[k].step - earlierPips[k].step !== offset) { isTransposition = false; break; }
          if (Math.abs(laterPips[k].timeScale - earlierPips[k].timeScale) > 1e-10) { isTransposition = false; break; }
        }
        if (isTransposition) {
          assignments[i].expr = new DBinOp('*', new DRef(earlierName),
            new DLiteral([{ step: offset, timeScale: 1 }]));
          assignments[i].derivedFrom = earlierName;
          count++;
          break;
        }
      }

      // Check retrograde: later = reverse(earlier) + offset
      const retroOffset = laterPips[0].step - earlierPips[earlierPips.length - 1].step;
      let isRetrograde = true;
      for (let k = 0; k < earlierPips.length; k++) {
        const rev = earlierPips.length - 1 - k;
        if (laterPips[k].step - earlierPips[rev].step !== retroOffset) { isRetrograde = false; break; }
        if (Math.abs(laterPips[k].timeScale - earlierPips[rev].timeScale) > 1e-10) { isRetrograde = false; break; }
      }
      if (isRetrograde) {
        assignments[i].expr = new DBinOp('*', new DRef(earlierName),
          new DLiteral([{ step: retroOffset, timeScale: -1 }]));
        assignments[i].derivedFrom = earlierName;
        count++;
        break;
      }
    }
  }

  return count;
}

// Attempt to hoist repeated sub-expressions into variables, then
// look for inter-variable relationships (transposition, retrograde).
// Returns {code, score, kind} or null if no hoisting was beneficial.
//
// Selection criterion: structural value = occurrences × expression length.
// This prioritizes naming motifs that appear many times and/or are
// non-trivial expressions, regardless of whether it saves characters.
function attemptHoist(node, targetPips, baseKind) {
  const assignments = [];
  let currentNode = node;
  let varIndex = 0;

  while (true) {
    const freqs = collectSubExpressions(currentNode);
    let bestKey = null;
    let bestValue = 0;
    let bestNode = null;
    let bestCount = 0;

    for (const [key, { count, node: exprNode }] of freqs) {
      if (count < 2) continue;
      // Structural value: how much repetition does naming this reveal?
      // More occurrences and longer expressions = more structure exposed.
      const value = count * key.length;
      if (value > bestValue) {
        bestValue = value;
        bestKey = key;
        bestNode = exprNode;
        bestCount = count;
      }
    }

    if (!bestKey) break;

    const name = generateVarName(varIndex);
    varIndex++;
    currentNode = substituteAST(currentNode, bestKey, new DRef(name));
    assignments.push({ name, expr: bestNode, uses: bestCount });
  }

  if (assignments.length === 0) return null;

  // Snapshot the hoisted-only version before trying relationships.
  const hoistOnlyAssignments = assignments.map(a => ({ ...a }));

  // Phase 2: try to express variables in terms of each other.
  // This reveals structural relationships between motifs.
  const relationships = findVariableRelationships(assignments);

  let program = new DProgram(assignments, currentNode);
  let code = program.toString();

  // Verify the full program round-trips correctly
  if (!verify(code, targetPips)) {
    if (relationships > 0) {
      // Relationship rewrites broke verification — fall back to hoist-only.
      const fallback = new DProgram(hoistOnlyAssignments, currentNode);
      const fallbackCode = fallback.toString();
      if (!verify(fallbackCode, targetPips)) return null;
      return {
        code: fallbackCode,
        score: scoreHoisted(fallbackCode, targetPips, hoistOnlyAssignments, 0),
        kind: baseKind,
      };
    }
    return null;
  }

  return {
    code,
    score: scoreHoisted(code, targetPips, assignments, relationships),
    kind: baseKind,
  };
}


// ============================================================================
// Discoverers (Phase 2)
// ============================================================================
// Discoverers operate on step-only pips (all ts=1). Rhythm is handled
// separately via factoring and recombined with .j in the main discover() flow.

function discoverRanges(pips, features) {
  const candidates = [];

  // Check if full sequence is a single range (all deltas = +1 or all = -1)
  if (features.deltas.length > 0) {
    const allSame = features.deltas.every(d => d === features.deltas[0]);
    if (allSame && (features.deltas[0] === 1 || features.deltas[0] === -1)) {
      candidates.push({
        node: new DRange(pips[0].step, pips[pips.length - 1].step),
        kind: 'range',
      });
    }
  }

  // Check for sub-ranges within progressions (delta = ±1, length >= 3)
  // Only if the full sequence isn't already a single range
  if (candidates.length === 0 && features.progressions.length > 0) {
    const unitRuns = features.progressions.filter(
      r => (r.delta === 1 || r.delta === -1) && r.length >= 3
    );
    // Only emit sub-range candidates if they cover a meaningful portion
    if (unitRuns.length > 0) {
      const parts = buildSegmentedCandidate(pips, unitRuns, (run) => {
        return new DRange(run.startVal, run.endVal);
      });
      if (parts && parts.length < pips.length) {
        candidates.push({
          node: parts.length === 1 ? parts[0] : new DConcat(parts),
          kind: 'range-segments',
        });
      }
    }
  }

  return candidates;
}

function discoverRepeats(pips, features) {
  const candidates = [];
  if (features.repeats.length === 0) return candidates;

  // Prefer the smallest period with an exact (non-truncated) repeat
  const exactRepeats = features.repeats.filter(r => !r.isTruncated && r.count >= 2);
  const truncatedRepeats = features.repeats.filter(r => r.isTruncated && r.count >= 2);

  for (const rep of exactRepeats) {
    const patternPips = pips.slice(0, rep.period);
    candidates.push({
      node: new DRepeat(new DLiteral(patternPips), rep.count),
      kind: 'repeat',
    });
  }

  // Truncated: full repeats + literal remainder
  for (const rep of truncatedRepeats) {
    const patternPips = pips.slice(0, rep.period);
    const remainderPips = pips.slice(rep.count * rep.period);
    candidates.push({
      node: new DConcat([
        new DRepeat(new DLiteral(patternPips), rep.count),
        new DLiteral(remainderPips),
      ]),
      kind: 'repeat-truncated',
    });
  }

  return candidates;
}

function discoverProgressions(pips, features) {
  const candidates = [];

  // Check for constant-value sequences (delta=0)
  if (features.deltas.length > 0 && features.deltas.every(d => d === 0)) {
    if (pips.length >= 2) {
      candidates.push({
        node: new DRepeat(new DLiteral([pips[0]]), pips.length),
        kind: 'constant-repeat',
      });
    }
  }

  // Check for non-unit arithmetic progressions covering the full sequence
  for (const run of features.progressions) {
    if (run.start !== 0 || run.end !== pips.length - 1) continue;
    if (run.delta === 1 || run.delta === -1 || run.delta === 0) continue;
    const count = run.length;
    const rangeEnd = count - 1;

    if (run.startVal === 0) {
      candidates.push({
        node: new DBinOp('^', new DRange(0, rangeEnd), new DLiteral([{ step: run.delta, timeScale: 1 }])),
        kind: 'progression',
      });
    } else {
      const scaled = new DBinOp('^', new DRange(0, rangeEnd), new DLiteral([{ step: run.delta, timeScale: 1 }]));
      candidates.push({
        node: new DBinOp('*', scaled, new DLiteral([{ step: run.startVal, timeScale: 1 }])),
        kind: 'progression',
      });
    }
  }

  // Sub-sequence progressions: build segmented candidate
  const nonUnitRuns = features.progressions.filter(
    r => r.delta !== 1 && r.delta !== -1 && r.delta !== 0 && r.length >= 3
  );
  if (nonUnitRuns.length > 0) {
    const parts = buildSegmentedCandidate(pips, nonUnitRuns, (run) => {
      const count = run.length;
      const rangeEnd = count - 1;
      if (run.startVal === 0) {
        return new DBinOp('^', new DRange(0, rangeEnd), new DLiteral([{ step: run.delta, timeScale: 1 }]));
      } else {
        const scaled = new DBinOp('^', new DRange(0, rangeEnd), new DLiteral([{ step: run.delta, timeScale: 1 }]));
        return new DBinOp('*', scaled, new DLiteral([{ step: run.startVal, timeScale: 1 }]));
      }
    });
    if (parts && parts.length < pips.length) {
      candidates.push({
        node: parts.length === 1 ? parts[0] : new DConcat(parts),
        kind: 'progression-segments',
      });
    }
  }

  return candidates;
}

// Helper: given runs that cover portions of pips, build a DConcat
// filling gaps with DLiteral. runNodeFn(run) returns the AST for that run.
function buildSegmentedCandidate(pips, runs, runNodeFn) {
  // Sort runs by start position
  const sorted = [...runs].sort((a, b) => a.start - b.start);

  // Remove overlapping runs (keep the longer one)
  const filtered = [];
  for (const run of sorted) {
    if (filtered.length === 0) {
      filtered.push(run);
    } else {
      const prev = filtered[filtered.length - 1];
      if (run.start <= prev.end) {
        // Overlap: keep the longer one
        if (run.length > prev.length) {
          filtered[filtered.length - 1] = run;
        }
      } else {
        filtered.push(run);
      }
    }
  }

  const parts = [];
  let cursor = 0;

  for (const run of filtered) {
    // Gap before this run
    if (run.start > cursor) {
      parts.push(new DLiteral(pips.slice(cursor, run.start)));
    }
    parts.push(runNodeFn(run));
    cursor = run.end + 1;
  }

  // Trailing gap
  if (cursor < pips.length) {
    parts.push(new DLiteral(pips.slice(cursor)));
  }

  return parts;
}

// ============================================================================
// Kernel Discovery
// ============================================================================
// Finds a short motif (the "kernel") and shows how the surface derives from
// transformations of it. Reveals thematic self-similarity — the generative
// heart of the material — even when the resulting program is longer than the literal.

const MIN_KERNEL_LEN = 3;
const MAX_KERNEL_LEN_CAP = 8;
const MAX_KERNEL_CANDIDATES = 50;
const MIN_KERNEL_COVERAGE = 0.4;
const KERNEL_TRANSFORM_COUNT = 3; // identity, transposition, retrograde (phase 1)

// Interval profile: the sequence of step deltas between adjacent pips.
// Two subsequences with the same profile are the same kernel modulo transposition.
function intervalProfile(pips) {
  const profile = [];
  for (let i = 1; i < pips.length; i++) {
    profile.push(pips[i].step - pips[i - 1].step);
  }
  return profile.join(',');
}

// Generate candidate kernels from the surface. Deduplicates by interval profile
// and weights toward earlier positions (the generating motif often appears first)
// and shorter lengths (more parsimonious).
function generateKernelCandidates(pips) {
  const maxLen = Math.min(MAX_KERNEL_LEN_CAP, Math.floor(pips.length / 2));
  if (maxLen < MIN_KERNEL_LEN) return [];

  const seen = new Map(); // intervalProfile -> true
  const candidates = [];

  for (let len = MIN_KERNEL_LEN; len <= maxLen; len++) {
    for (let start = 0; start <= pips.length - len; start++) {
      const sub = pips.slice(start, start + len);
      const profile = intervalProfile(sub);

      if (!seen.has(profile)) {
        seen.set(profile, true);
        // Weight: prefer earlier positions and shorter kernels
        const positionWeight = 1 / (1 + start);
        const parsimonyWeight = 1 / len;
        const weight = positionWeight * 0.7 + parsimonyWeight * 0.3;
        candidates.push({ pips: sub, startIndex: start, length: len, weight });
      }
    }
  }

  candidates.sort((a, b) => b.weight - a.weight);
  return candidates.slice(0, MAX_KERNEL_CANDIDATES);
}

// --- Transformation Matchers ---
// Each takes kernel K and target T (same length, step-only),
// returns {transform, params, buildAST(kernelRef)} or null.

function matchIdentity(K, T) {
  for (let i = 0; i < K.length; i++) {
    if (K[i].step !== T[i].step) return null;
  }
  return {
    transform: 'identity',
    params: {},
    buildAST: (ref) => ref,
  };
}

function matchTransposition(K, T) {
  const offset = T[0].step - K[0].step;
  if (offset === 0) return null; // that's identity
  for (let i = 1; i < K.length; i++) {
    if (T[i].step - K[i].step !== offset) return null;
  }
  return {
    transform: 'transposition',
    params: { offset },
    buildAST: (ref) => new DBinOp('*', ref, new DLiteral([{ step: offset, timeScale: 1 }])),
  };
}

function matchRetrograde(K, T) {
  const n = K.length;
  const offset = T[0].step - K[n - 1].step;
  for (let i = 0; i < n; i++) {
    if (T[i].step - K[n - 1 - i].step !== offset) return null;
  }
  return {
    transform: 'retrograde',
    params: { offset },
    buildAST: (ref) => new DBinOp('*', ref, new DLiteral([{ step: offset, timeScale: -1 }])),
  };
}

// Try all matchers in priority order, return first match.
function matchWindow(kernel, window) {
  return matchIdentity(kernel, window)
      || matchTransposition(kernel, window)
      || matchRetrograde(kernel, window)
      || null;
}

// Scan the surface for all windows that match the kernel under some transformation.
function findKernelMatches(kernel, surface) {
  const kLen = kernel.length;
  const matches = [];

  for (let i = 0; i <= surface.length - kLen; i++) {
    const window = surface.slice(i, i + kLen);
    const m = matchWindow(kernel, window);
    if (m) {
      matches.push({ start: i, end: i + kLen - 1, ...m });
    }
  }

  return matches;
}

// Greedy non-overlapping selection. Pick earliest match first among those
// at the best quality tier, mark pips as covered, repeat.
function selectCoverage(matches, surfaceLen) {
  // Sort by start position (prefer earlier matches for stable coverage)
  const sorted = [...matches].sort((a, b) => a.start - b.start);

  const covered = new Uint8Array(surfaceLen);
  const selected = [];

  for (const m of sorted) {
    let overlaps = false;
    for (let i = m.start; i <= m.end; i++) {
      if (covered[i]) { overlaps = true; break; }
    }
    if (overlaps) continue;

    for (let i = m.start; i <= m.end; i++) covered[i] = 1;
    selected.push(m);
  }

  const coveredCount = covered.reduce((sum, v) => sum + v, 0);
  return { selected, coverage: coveredCount / surfaceLen };
}

// Score a kernel candidate. Coverage dominates, structure rewards named variables,
// parsimony rewards shorter kernels, diversity rewards varied transforms.
function scoreKernel(coverage, kernelLength, uniqueTransforms, namedVarCount, surfaceLength) {
  const coverageScore = coverage;
  const parsimonyScore = 1 - (kernelLength / surfaceLength);
  const diversityScore = uniqueTransforms / KERNEL_TRANSFORM_COUNT;
  const structureScore = namedVarCount * 0.15;

  const total = coverageScore * 0.50
              + parsimonyScore * 0.10
              + diversityScore * 0.10
              + structureScore * 0.30;

  return { coverage: coverageScore, parsimony: parsimonyScore,
           diversity: diversityScore, structure: structureScore, total };
}

// Build a DProgram from the kernel, selected matches, and surface.
function buildKernelProgram(kernel, selected, surface) {
  const kernelName = 'nug';
  const kernelRef = new DRef(kernelName);
  const assignments = [];

  // First assignment: the kernel itself
  assignments.push({ name: kernelName, expr: new DLiteral(kernel) });

  // Group matches by transform signature (same transform+params = same variable)
  const groups = new Map();
  for (const m of selected) {
    const sig = m.transform + ':' + JSON.stringify(m.params);
    if (!groups.has(sig)) groups.set(sig, { matches: [], buildAST: m.buildAST, transform: m.transform });
    groups.get(sig).matches.push(m);
  }

  // Create a named variable for each non-identity group
  let varIndex = 0;
  const matchToRef = new Map();

  for (const [sig, group] of groups) {
    if (group.transform === 'identity') {
      for (const m of group.matches) matchToRef.set(m, kernelRef);
      continue;
    }

    const varName = generateVarName(varIndex++);
    const expr = group.buildAST(kernelRef);
    assignments.push({ name: varName, expr });

    const ref = new DRef(varName);
    for (const m of group.matches) matchToRef.set(m, ref);
  }

  // Build final expression: refs in surface order, with literal gaps
  const sortedMatches = [...selected].sort((a, b) => a.start - b.start);
  const parts = [];
  let cursor = 0;

  for (const m of sortedMatches) {
    if (m.start > cursor) {
      parts.push(new DLiteral(surface.slice(cursor, m.start)));
    }
    parts.push(matchToRef.get(m));
    cursor = m.end + 1;
  }

  if (cursor < surface.length) {
    parts.push(new DLiteral(surface.slice(cursor)));
  }

  const finalExpr = parts.length === 1 ? parts[0] : new DConcat(parts);
  return new DProgram(assignments, finalExpr);
}

// Main kernel discoverer. Called from discoverSteps().
function discoverKernels(pips, features) {
  const candidates = [];
  if (pips.length < 6) return candidates; // too short for kernel analysis

  const kernelCandidates = generateKernelCandidates(pips);

  for (const kc of kernelCandidates) {
    const matches = findKernelMatches(kc.pips, pips);
    if (matches.length < 2) continue; // need at least 2 occurrences

    const { selected, coverage } = selectCoverage(matches, pips.length);
    if (coverage < MIN_KERNEL_COVERAGE) continue;

    // Count unique transform types and named variables
    const uniqueTransforms = new Set(selected.map(m => m.transform)).size;
    const transformGroups = new Set(selected.map(m =>
      m.transform + ':' + JSON.stringify(m.params)));
    const hasIdentity = selected.some(m => m.transform === 'identity');
    // Named vars = kernel + non-identity groups
    const namedVarCount = 1 + (transformGroups.size - (hasIdentity ? 1 : 0));

    const kernelScore = scoreKernel(
      coverage, kc.length, uniqueTransforms, namedVarCount, pips.length);

    const program = buildKernelProgram(kc.pips, selected, pips);

    candidates.push({
      node: program,
      kind: 'kernel',
      kernelScore,
    });
  }

  // Sort by kernel score descending, return top 3
  candidates.sort((a, b) => b.kernelScore.total - a.kernelScore.total);
  return candidates.slice(0, 3);
}


// Run all step-only discoverers on a pip sequence.
function discoverSteps(pips, features) {
  const candidates = [];
  candidates.push(...discoverRanges(pips, features));
  candidates.push(...discoverRepeats(pips, features));
  candidates.push(...discoverProgressions(pips, features));
  candidates.push(...discoverKernels(pips, features));
  return candidates;
}

function discover(pips, features) {
  const candidates = [];

  // Always include the literal as a baseline (with original timeScales)
  candidates.push({ node: new DLiteral(pips), kind: 'literal' });

  if (allTsOne(pips)) {
    // All timeScales are 1: run discoverers directly, no factoring needed
    candidates.push(...discoverSteps(pips, features));
  } else {
    // Mixed timeScales: factor rhythm out, decompose steps, recombine with .j
    const stepPips = stripRhythm(pips);
    const rhythm = extractRhythm(pips);
    const stepFeatures = analyze(stepPips);

    // Discover on step-only sequence
    const stepCandidates = discoverSteps(stepPips, stepFeatures);

    // Build rhythm expression
    const rhythmExpr = buildRhythmExpr(rhythm);

    // For each step decomposition, wrap with .j rhythmExpr
    for (const sc of stepCandidates) {
      if (sc.node instanceof DProgram) {
        // DProgram can't be wrapped in DBinOp — add rhythm as a named
        // assignment and apply .j only to the final expression.
        const rhythmAssign = { name: 'rhythm', expr: rhythmExpr };
        const newFinal = new DBinOp('.j', sc.node.finalExpr, new DRef('rhythm'));
        const newProgram = new DProgram(
          [...sc.node.assignments, rhythmAssign],
          newFinal
        );
        candidates.push({
          node: newProgram,
          kind: sc.kind + '+rhythm',
          kernelScore: sc.kernelScore,
        });
      } else {
        candidates.push({
          node: new DBinOp('.j', sc.node, rhythmExpr),
          kind: sc.kind + '+rhythm',
        });
      }
    }

    // Also try: step literal .j compressed-rhythm (if rhythm compresses well)
    // This separates rhythm even when steps don't compress,
    // which can still be a win if the rhythm mask is very compact.
    const rhythmCompressed = compressRhythm(rhythm);
    if (rhythmCompressed) {
      const rhythmStr = rhythmCompressed.toString();
      const fullMaskStr = new DRhythmMask(rhythm).toString();
      // Only emit if the compressed rhythm is shorter than the full mask
      if (rhythmStr.length < fullMaskStr.length) {
        candidates.push({
          node: new DBinOp('.j', new DLiteral(stepPips), rhythmCompressed),
          kind: 'rhythm-factor',
        });
      }
    }

    // Also run discoverers on original pips (with timeScales) for repeat detection.
    // A sequence like [0|/2, 3|/2, 0|/2, 3|/2] repeats including its rhythm.
    candidates.push(...discoverRepeats(pips, features));
  }

  return candidates;
}


// ============================================================================
// Assembler (Phase 3)
// ============================================================================

function verify(code, targetPips) {
  try {
    const result = golden.crux_interp(code);
    const lastSection = result.sections[result.sections.length - 1];
    if (!lastSection || !lastSection.values) return false;
    const actual = lastSection.values;
    if (actual.length !== targetPips.length) return false;
    for (let i = 0; i < actual.length; i++) {
      if (actual[i].step !== targetPips[i].step) return false;
      if (Math.abs(actual[i].timeScale - targetPips[i].timeScale) > 1e-10) return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

// Measure compression of the step portion only (exclude .j rhythm mask).
function compressionOf(code, targetPips) {
  const jIndex = code.indexOf(' .j ');
  let codeLen, baseLen;
  if (jIndex !== -1) {
    codeLen = code.substring(0, jIndex).length;
    baseLen = new DLiteral(stripRhythm(targetPips)).toString().length;
  } else {
    codeLen = code.length;
    baseLen = new DLiteral(targetPips).toString().length;
  }
  return 1 - (codeLen / baseLen);
}

// Score a candidate without hoisting.
function score(code, targetPips) {
  const compression = compressionOf(code, targetPips);
  return {
    compression,
    structure: 0,
    total: compression,
  };
}

// Score a hoisted candidate. Structure dominates: each named variable
// reveals a reusable motif, and each additional use of that variable
// reveals repetition. This matters more than character savings.
//
// Inter-variable relationships (transposition, retrograde) are the
// highest-value structural insight — they show how motifs transform
// into each other. These are rewarded heavily.
function scoreHoisted(code, targetPips, assignments, relationships = 0) {
  const compression = compressionOf(code, targetPips);

  // Structure score: reward naming motifs and their reuse.
  // Base credit for extracting a variable (0.15), plus credit for
  // each additional use beyond the first two (the minimum for hoisting).
  let structure = 0;
  for (const { uses } of assignments) {
    structure += 0.15;                         // named a motif
    structure += (uses - 2) * 0.05;            // extra reuses beyond the pair
  }

  // Inter-variable relationships: a variable expressed as a transformation
  // of another variable is a major structural insight (e.g., ac = aa * [-2]
  // says "this motif is a transposition of that motif"). Reward heavily.
  structure += relationships * 0.40;

  return {
    compression,
    structure,
    total: compression + structure,
  };
}

function assemble(targetPips, candidates) {
  const results = [];

  for (const candidate of candidates) {
    const { node, kind } = candidate;
    const code = node.toString();
    if (verify(code, targetPips)) {
      let finalCode = code;
      let finalScore = score(code, targetPips);
      let finalKind = kind;

      if (kind.startsWith('kernel') && candidate.kernelScore) {
        // Kernel programs have their own variable structure — skip hoisting.
        // Use kernel-specific scoring that rewards coverage and structure.
        finalScore = {
          compression: compressionOf(code, targetPips),
          ...candidate.kernelScore,
        };
      } else if (kind !== 'literal') {
        // Attempt variable hoisting for non-literal, non-kernel candidates
        const hoisted = attemptHoist(node, targetPips, kind);
        if (hoisted) {
          finalCode = hoisted.code;
          finalScore = hoisted.score;
          finalKind = hoisted.kind;
        }
      }

      results.push({
        code: finalCode,
        score: finalScore,
        kind: finalKind,
      });
    }
  }

  // Sort by total score descending (higher compression = better)
  results.sort((a, b) => b.score.total - a.score.total);

  // Deduplicate by code string
  const seen = new Set();
  const deduped = results.filter(r => {
    if (seen.has(r.code)) return false;
    seen.add(r.code);
    return true;
  });

  // Extract rhythm masks into a named `rhythm` variable for readability.
  // This makes it easier to compare compressed code with the flattened literal
  // because both share the same `rhythm` reference.
  for (const result of deduped) {
    if (result.kind === 'literal') continue;
    if (result.kind.startsWith('kernel')) continue; // kernel programs handle rhythm internally
    const lines = result.code.split('\n');
    const lastLine = lines[lines.length - 1];
    const jIdx = lastLine.indexOf(' .j ');
    if (jIdx === -1) continue;

    const stepPart = lastLine.substring(0, jIdx);
    const rhythmPart = lastLine.substring(jIdx + 4);

    lines[lines.length - 1] = `rhythm = ${rhythmPart}`;
    lines.push(`${stepPart} .j rhythm`);
    const newCode = lines.join('\n');

    if (verify(newCode, targetPips)) {
      result.code = newCode;
    }
  }

  return { candidates: deduped };
}


// ============================================================================
// Public API
// ============================================================================

function normalizePips(input) {
  if (typeof input === 'string') {
    const result = golden.crux_interp(input);
    const lastSection = result.sections[result.sections.length - 1];
    if (!lastSection || !lastSection.values) return [];
    return lastSection.values.map(p => ({ step: p.step, timeScale: p.timeScale }));
  }
  if (Array.isArray(input)) {
    return input.map(p => ({ step: p.step, timeScale: p.timeScale ?? 1 }));
  }
  return [];
}

golden.decompose = function (input, options = {}) {
  const pips = normalizePips(input);
  if (pips.length === 0) return { candidates: [] };

  // Single-pip: not worth decomposing
  if (pips.length === 1) {
    const lit = new DLiteral(pips);
    return {
      candidates: [{ code: lit.toString(), score: { compression: 0, total: 0 }, kind: 'literal' }],
    };
  }

  const features = analyze(pips);
  const candidates = discover(pips, features);
  return assemble(pips, candidates);
};
