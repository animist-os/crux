// Crux fold model, stops 6 to 8: relations that the program does not state.
//
//   6  unstated exact repeats: equal sub-runs stack on one copy
//   7  near-misses: runs that are still alone move onto a theme cell, with
//      bent notes. Then themes fold onto themes.
//   8  themes only: each theme shows its own run. Short stated cells stack on
//      a note of a theme, and everything else stacks on one residue marker.
//
// Called from foldModel (model.js). It works on the stop 5 picture, where each
// position is one "slot": one literal pip of one dictionary entry. Every note
// on a slot moves with it. See docs/plans/crux-fold-view.md, "Later folds".
//
// Terms used here:
// - A run is a sequence of slots of one entry that are next to each other in
//   the source: no rest between them and no other definition use. A rest
//   breaks a run.
// - An entry is stated when it is a program definition used more than once.
//   Its notes are explained by the program. Passages (definitions used once)
//   and top-level literals are not stated.
// - A theme cell is 3 or more slots of a stated entry, next to each other in
//   one run, that are still in place after the near-misses.
// - A move takes a slot onto a target slot. It keeps the transform:
//   slot step = sign * (target step + bent) + b, sign -1 when mirrored.
//   Moves chain, and bents add up along the chain in the last target's frame.

const EPS = 1e-9;
const r6 = x => String(Math.round(x * 1e6) / 1e6 || 0);
const near = (a, b) => Math.abs(a - b) < 1e-6;
const z = x => (x === 0 ? 0 : x);
// mirror, reverse
const ORIENTS = [[false, false], [true, false], [false, true], [true, true]];

function orient(win, mir, rev) {
  const seq = rev ? win.slice().reverse() : win;
  return seq.map(S => ({
    S, s: mir ? -S.s : S.s, d: S.d, tag: S.tag,
    diad: S.diad ? S.diad.map(o => (mir ? -o : o)).sort((a, b) => a - b) : null,
  }));
}

// Shape key up to transposition and uniform stretch.
function shapeKey(seq) {
  const s0 = seq[0].s, d0 = seq[0].d;
  return seq.map(x => `${r6(x.s - s0)}:${r6(x.d / d0)}:${x.diad ? x.diad.map(r6).join('&') : ''}:${x.tag ?? ''}`).join(' ');
}

// The smallest key over the four orientations. seq[k].S is the slot at
// canonical index k, so two windows with the same key map slot to slot.
function canon(win) {
  let best = null;
  for (const [mir, rev] of ORIENTS) {
    const seq = orient(win, mir, rev);
    const key = shapeKey(seq);
    if (!best || key < best.key) best = { key, mir, rev, seq };
  }
  return best;
}

// The best match of `win` against an equal-length window of one of `targets`
// (each { slots }). Rhythm equal up to uniform stretch, at least half of the
// notes exact, at most maxBent(L, ratio) bent notes, and no note bent by more
// than maxBend steps. Ranked by exact notes, then length, then fewest bent
// notes; the first found wins a tie.
function bestMatch(win, targets, maxBent, maxBend, best = null) {
  const L = win.length;
  for (const T of targets) {
    for (let j = 0; j + L <= T.slots.length; j++) {
      const tw = T.slots.slice(j, j + L);
      if (tw.some(X => win.includes(X))) continue;
      for (const [mir, rev] of ORIENTS) {
        const seq = orient(tw, mir, rev);
        const ratio = win[0].d / seq[0].d;
        if (!win.every((S, k) => near(S.d, seq[k].d * ratio))) continue;
        // The transposition that keeps the most notes exact; on a tie, the
        // smallest one.
        const tally = new Map();
        let b = null, exact = 0;
        for (let k = 0; k < L; k++) {
          const key = r6(win[k].s - seq[k].s);
          tally.set(key, (tally.get(key) || 0) + 1);
        }
        for (const [key, c] of tally) {
          const x = Number(key);
          if (c > exact || (c === exact && Math.abs(x) < Math.abs(b))) { exact = c; b = x; }
        }
        const bent = L - exact;
        if (bent > maxBent(L, ratio) || 2 * exact < L) continue;
        if (!win.every((S, k) => Math.abs(S.s - seq[k].s - b) <= maxBend + EPS)) continue;
        if (!best || exact > best.exact || (exact === best.exact && (L > best.win.length ||
            (L === best.win.length && bent < best.bent)))) {
          best = { win, target: T, seq, mir, rev, b, exact, bent, ratio };
        }
      }
    }
  }
  return best;
}

// The move of win[k] in match m.
function moveFor(S, k, m) {
  const T = m.seq[k].S;
  const off = S.s - (m.seq[k].s + m.b);
  return { to: T, bent: z(m.mir ? -off : off), mir: m.mir, rev: m.rev, b: m.b };
}

// Slot X next to the target of a move from N, on the side of S.
// S sits at N's index + d in its own run.
function edgeTarget(S, N, d, m, maxBend) {
  const T = m.to;
  const X = T.run.slots[T.k + d * (m.rev ? -1 : 1)];
  if (!X || X === S || X === N) return null;
  if (!near(S.d * T.d, X.d * N.d)) return null;
  const sgn = m.mir ? -1 : 1;
  const b = N.s - sgn * (T.s + m.bent);
  const bent = z(sgn * (S.s - b) - X.s);
  if (Math.abs(bent) > maxBend + EPS) return null;
  return { to: X, bent, mir: m.mir, rev: m.rev, b };
}

/**
 * notes:   the model's notes, with pos[1..5]
 * recs:    every pip of every voice (model.js), rec.note set for sounding pips
 * entries: dictionary entries in stop 5 layout order
 * relate(rec, use): { a, b } so that a step in rec's owner body maps to
 *          a * step + b in the body of the definition use `use`, or null
 */
export function thematicFolds({ notes, recs, entries, relate, written }, options = {}) {
  const minLength = options.minLength ?? 3;
  // Stop 7 never matches fewer than 3 notes, whatever minLength is.
  const nearLength = Math.max(3, minLength);
  const themeLength = options.themeLength ?? 3;
  const gap = options.gap ?? 0.5;
  // A bent note moves at most a third (2 scale steps) from the theme.
  const maxBend = options.maxBend ?? 2;
  const stated = E => E.name != null && E.count >= 2;
  // 3 notes: exact only. 4 notes: 1 bent, or 2 when the durations are equal
  // (no stretch). Longer: 2.
  const maxBent = (L, ratio) => (L <= 3 ? 0 : L === 4 ? (near(ratio, 1) ? 2 : 1) : 2);

  // Slots: one per stop 5 position.
  const firstInstance = new Map();
  const slotByKey = new Map();
  const slotOfNote = [];
  for (const n of notes) {
    if (!firstInstance.has(n.entry)) firstInstance.set(n.entry, n.instance);
    // t and d are written durations: the folds match on them. x and w are
    // the shown layout of stop 5, which the layouts below keep.
    const shown = n.pos[5];
    const p = written ? written[n.id] : shown;
    const key = n.entry + '|' + r6(p.t);
    let S = slotByKey.get(key);
    if (!S) {
      S = { id: slotByKey.size, key, entry: entries.find(E => E.id === n.entry), t: p.t, s: shown.step, d: p.d,
        x: shown.t, w: shown.d, capped: !!shown.capped,
        diad: n.diad, tag: n.tag, notes: [], first: null };
      slotByKey.set(key, S);
    }
    S.notes.push(n);
    if (!S.first && n.instance === firstInstance.get(n.entry)) S.first = n;
    slotOfNote[n.id] = S;
  }
  const allSlots = [...slotByKey.values()];
  const slotsOf = new Map(entries.map(E => [E.id, []]));
  for (const S of allSlots) {
    S.first ||= S.notes[0];
    slotsOf.get(S.entry.id).push(S);
  }
  for (const list of slotsOf.values()) list.sort((a, b) => a.t - b.t);

  // Runs.
  const runs = [];
  for (const E of entries) {
    let cur = null;
    for (const S of slotsOf.get(E.id)) {
      const prev = cur && cur.slots[cur.slots.length - 1];
      const joined = prev && near(prev.t + prev.d, S.t) && prev.first.voice === S.first.voice &&
        Math.abs(prev.first.index - S.first.index) === 1;
      if (!joined) { cur = { order: runs.length, entry: E, slots: [] }; runs.push(cur); }
      S.k = cur.slots.length;
      cur.slots.push(S);
      S.run = cur;
    }
  }

  const move6 = new Map();
  const move7 = new Map();
  const moveAt = (S, stop) => (stop >= 6 && move6.get(S)) || (stop >= 7 && move7.get(S)) || null;
  const finalOf = (S, stop) => {
    let cur = S, bent = 0;
    for (let g = 0; g < 64; g++) {
      const m = moveAt(cur, stop);
      if (!m) break;
      bent = m.bent + (m.mir ? -bent : bent);
      cur = m.to;
    }
    return { S: cur, bent: z(bent) };
  };

  // Stop 6: unstated exact repeats. Longest first, then most frequent.
  const assigned = new Set();
  const found = [];
  const rank = o => (stated(o.run.entry) ? o.run.entry.count : 0);
  const maxRun = runs.reduce((m, R) => Math.max(m, R.slots.length), 0);
  for (let L = maxRun; L >= minLength; L--) {
    const byKey = new Map();
    for (const R of runs) {
      for (let i = 0; i + L <= R.slots.length; i++) {
        const win = R.slots.slice(i, i + L);
        if (win.some(S => assigned.has(S))) continue;
        const c = canon(win);
        let list = byKey.get(c.key);
        if (!list) byKey.set(c.key, (list = []));
        list.push({ run: R, start: i, slots: win, c });
      }
    }
    const keys = [...byKey.values()].filter(l => l.length >= 2).sort((a, b) => b.length - a.length);
    for (const list of keys) {
      const picked = [];
      const used = new Set();
      for (const o of list) {
        if (o.slots.some(S => assigned.has(S) || used.has(S))) continue;
        picked.push(o);
        o.slots.forEach(S => used.add(S));
      }
      if (picked.length < 2) continue;
      // The copy that stays: in the most used stated definition, else the first.
      const rep = picked.slice().sort((a, b) => rank(b) - rank(a))[0];
      // A stated definition moves only as a whole run: the fold does not cut
      // the program's own cells apart. A part of one can still be the copy
      // that stays, and it counts as an occurrence.
      const whole = o => o.slots.length === o.run.slots.length;
      const movers = picked.filter(o => o !== rep && (!stated(o.run.entry) || whole(o)));
      if (!movers.length) continue;
      // A short shape is weak evidence: it needs 3 occurrences, or a mover
      // that is a whole stated definition.
      if (L < 4 && picked.length < 3 && !movers.some(o => stated(o.run.entry))) continue;
      const kept = [rep, ...movers];
      const group = { id: 'F' + (found.length + 1), length: L, rep, occurrences: kept };
      for (const o of kept) {
        o.slots.forEach(S => { assigned.add(S); S.found = group; });
        if (o === rep) continue;
        const mir = o.c.mir !== rep.c.mir, rev = o.c.rev !== rep.c.rev;
        o.c.seq.forEach((x, k) => {
          const T = rep.c.seq[k].S;
          move6.set(x.S, { to: T, bent: 0, mir, rev, b: x.S.s - (mir ? -T.s : T.s) });
        });
      }
      found.push(group);
    }
  }

  // Stop 7, first part: runs that are still alone, onto stated cells.
  const statedRuns = runs.filter(R => stated(R.entry) && R.slots.length >= minLength);
  const nearMatches = [];
  const free = S => !assigned.has(S) && !stated(S.entry);
  for (;;) {
    let best = null;
    for (const R of runs) {
      if (stated(R.entry)) continue;
      const segs = [];
      let cur = [];
      for (const S of R.slots) {
        if (free(S)) cur.push(S);
        else { if (cur.length) segs.push(cur); cur = []; }
      }
      if (cur.length) segs.push(cur);
      for (const seg of segs) {
        for (let L = seg.length; L >= nearLength; L--) {
          for (let i = 0; i + L <= seg.length; i++) best = bestMatch(seg.slice(i, i + L), statedRuns, maxBent, maxBend, best);
        }
      }
    }
    if (!best) break;
    const match = { kind: 'run', theme: best.target.entry.id, name: best.target.entry.name, notes: best.win.length, bent: best.bent,
      mirror: best.mir, reverse: best.rev, transpose: best.b, stretch: best.ratio, slots: best.win, bentNotes: [] };
    best.win.forEach((S, k) => {
      const mv = moveFor(S, k, best);
      assigned.add(S);
      S.near = match;
      move7.set(S, mv);
      if (mv.bent) match.bentNotes.push({ step: S.s, bent: mv.bent });
    });
    nearMatches.push(match);
  }

  // Stop 7, second part: a single note left alone at the edge of a repeat or
  // a near-miss joins it as a bent note, when the target has a note there
  // with the same rhythm, that note is itself explained (stated or matched),
  // the bend is maxBend steps or less, and the match stays within the bent
  // limits with the note added.
  const edgeJoins = [];
  for (const R of runs) {
    if (stated(R.entry)) continue;
    R.slots.forEach((S, k) => {
      if (!free(S)) return;
      for (const d of [-1, 1]) {
        const N = R.slots[k - d], far = R.slots[k + d];
        if (!N || free(N) || !assigned.has(N) || (far && free(far))) continue;
        const m = move6.get(N) || move7.get(N);
        if (!m) continue;
        const mv = edgeTarget(S, N, d, m, maxBend);
        if (!mv || !(stated(mv.to.entry) || assigned.has(mv.to))) continue;
        const group = N.near ? N.near.slots : N.found.occurrences.find(o => o.slots.includes(N)).slots;
        const bentNow = N.near ? N.near.bent : 0;
        const L = group.length + 1, nb = bentNow + (mv.bent ? 1 : 0);
        if (mv.bent && (nb > maxBent(L, S.d / mv.to.d) || 2 * (L - nb) < L)) continue;
        edgeJoins.push({ S, mv });
        return;
      }
    });
  }
  for (const { S, mv } of edgeJoins) {
    const match = { kind: 'edge', theme: mv.to.entry.id, name: mv.to.entry.name, notes: 1, bent: mv.bent ? 1 : 0,
      mirror: mv.mir, reverse: mv.rev, transpose: mv.b, stretch: 1, slots: [S], bentNotes: mv.bent ? [{ step: S.s, bent: mv.bent }] : [] };
    assigned.add(S);
    S.near = match;
    move7.set(S, mv);
    nearMatches.push(match);
  }

  // Stop 7, third part: themes fold onto themes. Theme cells are ranked by
  // the notes that land on them so far. Each tries to fold onto a cell ranked
  // above it that is still a theme, by the same rules as a near-miss: whole
  // or a part of 3 or more notes on either side. The match must cover all of
  // the target, or all but one note of the theme that folds: a short common
  // fragment (a triad, three notes of a scale) does not make two themes one.
  const landed = new Map();
  for (const S of allSlots) {
    const F = finalOf(S, 7).S;
    landed.set(F, (landed.get(F) || 0) + S.notes.length);
  }
  const cells = [];
  for (const R of runs) {
    if (!stated(R.entry)) continue;
    let cur = [];
    const flush = () => { if (cur.length >= themeLength) cells.push({ entry: R.entry, slots: cur }); cur = []; };
    for (const S of R.slots) { if (!moveAt(S, 7)) cur.push(S); else flush(); }
    flush();
  }
  const cellsPerEntry = new Map();
  for (const C of cells) {
    const k = (cellsPerEntry.get(C.entry.id) || 0) + 1;
    cellsPerEntry.set(C.entry.id, k);
    C.id = C.entry.id + (k > 1 ? '.' + k : '');
    C.landed = C.slots.reduce((n, S) => n + (landed.get(S) || 0), 0);
  }
  const ranked = cells.slice().sort((a, b) => b.landed - a.landed ||
    entries.indexOf(a.entry) - entries.indexOf(b.entry) || a.slots[0].t - b.slots[0].t);
  const alive = [];
  const themeFolds = [];
  for (const C of ranked) {
    let best = null;
    for (let L = C.slots.length; L >= nearLength; L--) {
      const targets = alive.filter(D => L >= C.slots.length - 1 || L === D.slots.length);
      for (let i = 0; i + L <= C.slots.length; i++) best = bestMatch(C.slots.slice(i, i + L), targets, maxBent, maxBend, best);
    }
    if (!best) { alive.push(C); continue; }
    const D = best.target;
    const fold = { from: C.id, name: C.entry.name, onto: D.id, ontoName: D.entry.name, landed: C.landed,
      length: best.win.length, of: C.slots.length, exact: best.exact, bent: best.bent,
      mirror: best.mir, reverse: best.rev, transpose: best.b, stretch: best.ratio,
      steps: C.slots.map(S => S.s), ontoSteps: D.slots.map(S => S.s), bentNotes: [], edge: null, leftover: [] };
    best.win.forEach((S, k) => {
      const mv = moveFor(S, k, best);
      move7.set(S, mv);
      S.themeFold = fold;
      if (mv.bent) fold.bentNotes.push({ step: S.s, onto: mv.to.s, bent: mv.bent });
    });
    // Notes of C outside the match: one alone at an edge joins as a bent note
    // when D has a note there; the others stack on the nearest matched note.
    const i0 = C.slots.indexOf(best.win[0]);
    const i1 = i0 + best.win.length - 1;
    for (const [rest, N, d] of [[C.slots.slice(0, i0).reverse(), C.slots[i0], -1], [C.slots.slice(i1 + 1), C.slots[i1], 1]]) {
      if (!rest.length) continue;
      const mv = rest.length === 1 ? edgeTarget(rest[0], N, d, move7.get(N), maxBend) : null;
      const L = best.win.length + 1, nb = best.bent + (mv && mv.bent ? 1 : 0);
      if (mv && D.slots.includes(mv.to) && (!mv.bent || (nb <= maxBent(L, best.ratio) && 2 * (L - nb) >= L))) {
        move7.set(rest[0], mv);
        rest[0].themeFold = fold;
        fold.bent += mv.bent ? 1 : 0;
        fold.edge = { step: rest[0].s, onto: mv.to.s, bent: mv.bent };
        if (mv.bent) fold.bentNotes.push({ step: rest[0].s, onto: mv.to.s, bent: mv.bent });
        continue;
      }
      for (const S of rest) { S.leftover = { fold, host: N }; fold.leftover.push(S.s); }
    }
    themeFolds.push(fold);
  }

  // Stop 8. Kinds of the slots still in place.
  const themeOf = new Map();
  for (const C of alive) for (const S of C.slots) themeOf.set(S, C);
  const kept8 = allSlots.filter(S => !moveAt(S, 7));
  const kindOf = S => (themeOf.has(S) ? 'theme' : S.leftover ? 'leftover' : S.found ? 'found' : stated(S.entry) ? 'cell' : 'residue');

  // Where each slot stacks at stop 8: a theme slot, a found slot, or nothing
  // (the residue marker).
  const hostSlot = new Map();
  for (const S of kept8) {
    const k = kindOf(S);
    if (k === 'theme' || k === 'found') hostSlot.set(S, S);
  }
  for (const S of kept8) {
    if (kindOf(S) === 'leftover') hostSlot.set(S, finalOf(S.leftover.host, 7).S);
  }

  // A short stated cell stacks on a note of the theme next to it in its own
  // definition (for example the last note of T = T9, [2] goes on T9). The note:
  // the cell's place in the theme's frame, then the theme note nearest in
  // time, then nearest in step.
  const recsByVoice = [];
  for (const rec of recs) (recsByVoice[rec.voice] ||= [])[rec.index] = rec;
  const anchorOf = S => {
    const n = S.first;
    const rec = recsByVoice[n.voice][n.index];
    const own = rec.a.owner;
    if (!own) return null;
    const inside = r => r && r.a.frames.some(f => f.kind === 'ref' && f.use === own.use);
    const list = recsByVoice[n.voice];
    const pick = r => {
      const rel = relate(r, own.use);
      if (!rel || !rel.a) return null;
      const AS = slotOfNote[r.note.id];
      const x = (S.s - rel.b) / rel.a;
      const ratio = AS.d / r.note.pos[1].d;
      return { AS, dt: (n.pos[1].t - r.note.pos[1].t) * ratio, dstep: x - AS.s };
    };
    for (let i = n.index - 1; i >= 0 && inside(list[i]); i--) {
      if (list[i].sounding && list[i].note.entry !== n.entry) return pick(list[i]);
    }
    for (let i = n.index + 1; i < list.length && inside(list[i]); i++) {
      if (list[i].sounding && list[i].note.entry !== n.entry) return pick(list[i]);
    }
    return null;
  };
  const nearestIn = (list, t, s) => {
    let best = null, bd = Infinity, bs = Infinity;
    for (const X of list) {
      const lt = X.t - list[0].t;
      const d = Math.max(0, lt - t, t - (lt + X.d));
      const ds = Math.abs(X.s - s);
      if (d < bd - EPS || (Math.abs(d - bd) < EPS && ds < bs - EPS)) { best = X; bd = d; bs = ds; }
    }
    return best;
  };
  const cellSlots = kept8.filter(S => kindOf(S) === 'cell');
  const anchors = new Map(cellSlots.map(S => [S, anchorOf(S)]).filter(([, a]) => a));
  for (let round = 0, changed = true; changed && round <= cellSlots.length; round++) {
    changed = false;
    for (const [S, a] of anchors) {
      if (hostSlot.has(S)) continue;
      const F = finalOf(a.AS, 7).S;
      const H = hostSlot.get(F);
      if (!H) continue;
      const C = themeOf.get(H);
      const target = C && F === H ? nearestIn(C.slots, (F.t - C.slots[0].t) + a.dt, F.s + a.dstep) : H;
      hostSlot.set(S, target);
      changed = true;
    }
  }

  // Lay a unit out: its slots in order, keeping the time between slots of one
  // entry less the slots that left it. Returns local times.
  function compact(list) {
    const inUnit = new Set(list);
    const local = new Map();
    let cursor = 0, prev = null;
    for (const S of list) {
      if (prev && prev.entry === S.entry) {
        let g = S.x - (prev.x + prev.w);
        for (const X of slotsOf.get(S.entry.id)) {
          if (X.t > prev.t + EPS && X.t < S.t - EPS && !inUnit.has(X)) g -= X.w;
        }
        cursor += Math.max(0, g);
      } else if (prev) cursor += gap / 2;
      local.set(S, cursor);
      cursor += S.w;
      prev = S;
    }
    return local;
  }

  // Place units side by side. A marker unit has no slots and one position.
  const MARKER = 0.5;
  function place(units) {
    let x = 0;
    const at = new Map();
    for (const U of units) {
      U.x = x;
      if (U.marker) {
        U.width = MARKER;
      } else {
        let lo = Infinity, hi = -Infinity;
        for (const [S, p] of U.local) { lo = Math.min(lo, p.t); hi = Math.max(hi, p.t + S.w); }
        U.width = hi - lo;
        for (const [S, p] of U.local) at.set(S, { t: x + p.t - lo, step: p.step, d: S.w, capped: S.capped, unit: U });
      }
      x += U.width + gap;
    }
    return at;
  }

  const unitFor = (kind, id, name, slots) => {
    const lt = compact(slots);
    const local = new Map(slots.map(S => [S, { t: lt.get(S), step: S.s }]));
    return { kind, id, name, slots, local };
  };

  // Stops 6 and 7: entries side by side, less the slots that moved.
  const layouts = {};
  for (const stop of [6, 7]) {
    const units = [];
    for (const E of entries) {
      const slots = slotsOf.get(E.id).filter(S => !moveAt(S, stop));
      if (slots.length) units.push(unitFor('entry', E.id, E.name, slots));
    }
    layouts[stop] = { units, at: place(units) };
  }

  // Stop 8: theme cells in source order, then found shapes outside themes,
  // then one residue marker.
  const units8 = [];
  const byOrder = (a, b) => entries.indexOf(a.entry) - entries.indexOf(b.entry) || a.slots[0].t - b.slots[0].t;
  for (const C of alive.slice().sort(byOrder)) {
    const U = unitFor('theme', C.id, C.entry.name, C.slots.slice());
    U.cell = C;
    units8.push(U);
  }
  for (const g of found) {
    if (moveAt(g.rep.slots[0], 7) || kindOf(g.rep.slots[0]) !== 'found') continue;
    units8.push(unitFor('found', g.id, null, g.rep.slots.slice().sort((a, b) => a.t - b.t)));
  }
  const residueUnit = { kind: 'residue', id: 'residue', name: null, slots: [], local: new Map(), marker: true };
  const placeOf = S => {
    const F = finalOf(S, 7).S;
    const k = kindOf(F);
    if (k === 'theme' || k === 'found') return { F, H: F, kind: k };
    const H = hostSlot.get(F);
    return H ? { F, H, kind: 'attached' } : { F, H: null, kind: 'residue' };
  };
  const places = notes.map(n => placeOf(slotOfNote[n.id]));
  if (places.some(p => p.kind === 'residue')) units8.push(residueUnit);
  const at8 = place(units8);
  const residuePos = { t: residueUnit.x, step: 0, d: MARKER, unit: residueUnit };

  // Explained by: the program, unless a theme of the program folded onto
  // another theme, then by that fold (near, or repeat when exact).
  const foldOn = S => {
    for (let cur = S, g = 0; cur && g < 64; g++) {
      if (cur.themeFold) return cur.themeFold;
      if (cur.leftover) return cur.leftover.fold;
      const m = moveAt(cur, 7);
      if (!m) return null;
      cur = m.to;
    }
    return null;
  };
  const explainedOf = S => {
    if (stated(S.entry)) {
      const f = foldOn(S);
      return f ? (f.bent ? 'near' : 'repeat') : 'program';
    }
    return S.found ? 'repeat' : S.near ? 'near' : null;
  };

  const out = notes.map((n, k) => {
    const S = slotOfNote[n.id];
    const pl = places[k];
    const pos = [6, 7].map(stop => {
      const p = layouts[stop].at.get(finalOf(S, stop).S);
      return p.capped ? { t: p.t, step: p.step, d: p.d, capped: true } : { t: p.t, step: p.step, d: p.d };
    });
    const p8 = pl.H ? at8.get(pl.H) : residuePos;
    pos.push(p8.capped ? { t: p8.t, step: p8.step, d: p8.d, capped: true } : { t: p8.t, step: p8.step, d: p8.d });
    const owner = pl.F.entry.name ?? pl.F.entry.id;
    return { pos, bent: finalOf(S, 7).bent, explainedBy: explainedOf(S),
      fold8: { unit: p8.unit.id, kind: pl.kind, owner: pl.kind === 'attached' || pl.kind === 'residue' ? owner : null },
      unit6: layouts[6].at.get(finalOf(S, 6).S).unit, unit7: layouts[7].at.get(finalOf(S, 7).S).unit, unit8: p8.unit };
  });

  const explained = { program: 0, repeat: 0, near: 0, none: 0 };
  for (const o of out) explained[o.explainedBy ?? 'none']++;
  const tally = key => {
    const m = new Map();
    for (const o of out) m.set(o[key], (m.get(o[key]) || 0) + 1);
    return m;
  };
  const t6 = tally('unit6'), t7 = tally('unit7'), t8 = tally('unit8');
  const groupOwners = list => {
    const m = new Map();
    for (const o of list) m.set(o.fold8.owner, (m.get(o.fold8.owner) || 0) + 1);
    return [...m].map(([owner, notes]) => ({ owner, notes }));
  };
  const describe = (U, t) => ({ id: U.id, kind: U.kind, name: U.name, x: U.x, width: U.width,
    positions: U.marker ? 1 : U.slots.length, notes: t.get(U) || 0 });
  const units8Out = units8.map(U => {
    const mine = out.filter(o => o.unit8 === U);
    const att = mine.filter(o => o.fold8.kind === 'attached');
    const d = describe(U, t8);
    d.own = mine.length - att.length;
    d.attached = groupOwners(att);
    d.attachedNotes = att.length;
    return d;
  });
  const slotSummary = list => list.map(S => ({ entry: S.entry.id, t: S.t, step: S.s }));
  const residueNotes = out.filter(o => o.fold8.kind === 'residue');

  return {
    notes: out.map(o => ({ pos: o.pos, bent: o.bent, explainedBy: o.explainedBy, fold8: o.fold8 })),
    summary: {
      minLength,
      slots: allSlots.length,
      runs: runs.length,
      explained,
      attachedNotes: out.filter(o => o.fold8.kind === 'attached').length,
      units: { 6: layouts[6].units.map(U => describe(U, t6)), 7: layouts[7].units.map(U => describe(U, t7)), 8: units8Out },
      found: found.map(g => ({ id: g.id, length: g.length, count: g.occurrences.length,
        occurrences: g.occurrences.map(o => ({ entry: o.run.entry.id, slots: slotSummary(o.slots), rep: o === g.rep })) })),
      near: nearMatches.map(m => ({ kind: m.kind, theme: m.theme, notes: m.notes, bent: m.bent, mirror: m.mirror, reverse: m.reverse,
        transpose: m.transpose, stretch: m.stretch, from: m.slots[0].entry.id, slots: slotSummary(m.slots), bentNotes: m.bentNotes })),
      themeFolds: themeFolds.map(f => ({ ...f })),
      themes: units8Out.filter(u => u.kind !== 'residue'),
      residue: { positions: residueNotes.length ? 1 : 0, notes: residueNotes.length,
        unexplained: residueNotes.filter(o => o.explainedBy === null).length,
        cells: groupOwners(residueNotes.filter(o => o.explainedBy !== null)) },
    },
  };
}
