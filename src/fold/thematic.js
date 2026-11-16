// Crux fold model, stops 6 to 8: relations that the program does not state.
//
//   6  unstated exact repeats: equal sub-runs stack on one copy
//   7  near-misses: runs that are still alone move onto a theme, with bent notes
//   8  themes only: every explained note sits on its theme, the rest is residue
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
// - A theme (stop 8) is a stated entry that keeps 3 or more of its own slots
//   after stops 6 and 7.

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

/**
 * notes:   the model's notes, with pos[1..5]
 * recs:    every pip of every voice (model.js), rec.note set for sounding pips
 * entries: dictionary entries in stop 5 layout order
 * relate(rec, use): { a, b } so that a step in rec's owner body maps to
 *          a * step + b in the body of the definition use `use`, or null
 */
export function thematicFolds({ notes, recs, entries, relate }, options = {}) {
  const minLength = options.minLength ?? 3;
  const themeLength = options.themeLength ?? 3;
  const gap = options.gap ?? 0.5;
  const maxBent = options.maxBent ?? (L => (L <= 3 ? 0 : L <= 4 ? 1 : 2));
  const stated = E => E.name != null && E.count >= 2;

  // Slots: one per stop 5 position.
  const firstInstance = new Map();
  const slotByKey = new Map();
  const slotOfNote = [];
  for (const n of notes) {
    if (!firstInstance.has(n.entry)) firstInstance.set(n.entry, n.instance);
    const p = n.pos[5];
    const key = n.entry + '|' + r6(p.t);
    let S = slotByKey.get(key);
    if (!S) {
      S = { id: slotByKey.size, key, entry: entries.find(E => E.id === n.entry), t: p.t, s: p.step, d: p.d,
        diad: n.diad, tag: n.tag, notes: [], first: null };
      slotByKey.set(key, S);
    }
    S.notes.push(n);
    if (!S.first && n.instance === firstInstance.get(n.entry)) S.first = n;
    slotOfNote[n.id] = S;
  }
  const slotsOf = new Map(entries.map(E => [E.id, []]));
  for (const S of slotByKey.values()) {
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
      cur.slots.push(S);
      S.run = cur;
    }
  }

  // Stop 6: unstated exact repeats. Longest first, then most frequent.
  const assigned = new Set();
  const move6 = new Map();
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
        o.slots.forEach((S, k) => {
          assigned.add(S);
          S.found = group;
          if (o !== rep) move6.set(o.c.seq[k].S, { to: rep.c.seq[k].S, bent: 0 });
        });
      }
      found.push(group);
    }
  }

  // Stop 7: near-misses against the program's own definitions.
  const themeCells = runs.filter(R => stated(R.entry) && R.slots.length >= minLength);
  const move7 = new Map();
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
        for (let L = seg.length; L >= minLength; L--) {
          for (let i = 0; i + L <= seg.length; i++) {
            const win = seg.slice(i, i + L);
            for (const C of themeCells) {
              for (let j = 0; j + L <= C.slots.length; j++) {
                const tw = C.slots.slice(j, j + L);
                for (const [mir, rev] of ORIENTS) {
                  const seq = orient(tw, mir, rev);
                  const ratio = win[0].d / seq[0].d;
                  if (!win.every((S, k) => near(S.d, seq[k].d * ratio))) continue;
                  const tally = new Map();
                  let b = null, exact = 0;
                  for (let k = 0; k < L; k++) {
                    const key = r6(win[k].s - seq[k].s);
                    const c = (tally.get(key) || 0) + 1;
                    tally.set(key, c);
                    if (c > exact) { exact = c; b = Number(key); }
                  }
                  const bent = L - exact;
                  if (bent > maxBent(L) || 2 * exact < L) continue;
                  if (!best || exact > best.exact || (exact === best.exact && (L > best.win.length ||
                      (L === best.win.length && bent < best.bent)))) {
                    best = { run: R, win, theme: C, seq, mir, rev, b, exact, bent, ratio };
                  }
                }
              }
            }
          }
        }
      }
    }
    if (!best) break;
    const match = { theme: best.theme.entry.id, name: best.theme.entry.name, notes: best.win.length, bent: best.bent,
      mirror: best.mir, reverse: best.rev, transpose: best.b, stretch: best.ratio, slots: best.win };
    best.win.forEach((S, k) => {
      const off = S.s - (best.seq[k].s + best.b);
      assigned.add(S);
      S.near = match;
      move7.set(S, { to: best.seq[k].S, bent: z(best.mir ? -off : off) });
    });
    nearMatches.push(match);
  }

  const moveAt = (S, stop) => (stop >= 6 && move6.get(S)) || (stop >= 7 && move7.get(S)) || null;
  const finalOf = (S, stop) => {
    let cur = S, bent = 0;
    for (let g = 0; g < 64; g++) {
      const m = moveAt(cur, stop);
      if (!m) break;
      bent += m.bent;
      cur = m.to;
    }
    return { S: cur, bent: z(bent) };
  };

  // Lay a unit out: its slots in order, keeping the time between slots of one
  // entry less the slots that left it. Returns local times.
  function compact(list) {
    const inUnit = new Set(list);
    const local = new Map();
    let cursor = 0, prev = null;
    for (const S of list) {
      if (prev && prev.entry === S.entry) {
        let g = S.t - (prev.t + prev.d);
        for (const X of slotsOf.get(S.entry.id)) {
          if (X.t > prev.t + EPS && X.t < S.t - EPS && !inUnit.has(X)) g -= X.d;
        }
        cursor += Math.max(0, g);
      } else if (prev) cursor += gap / 2;
      local.set(S, cursor);
      cursor += S.d;
      prev = S;
    }
    return local;
  }

  // Place units side by side. Each unit: { slots, local: Map slot -> { t, step } }.
  function place(units) {
    let x = 0;
    const at = new Map();
    for (const U of units) {
      let lo = Infinity, hi = -Infinity;
      for (const [S, p] of U.local) { lo = Math.min(lo, p.t); hi = Math.max(hi, p.t + S.d); }
      U.x = x;
      U.width = hi - lo;
      for (const [S, p] of U.local) at.set(S, { t: x + p.t - lo, step: p.step, d: S.d, unit: U });
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

  // Stop 8: themes, found shapes outside themes, short stated cells, residue.
  const unmoved = [...slotByKey.values()].filter(S => !moveAt(S, 7));
  const keep = new Map();
  for (const S of unmoved) keep.set(S.entry.id, (keep.get(S.entry.id) || 0) + 1);
  const isTheme = E => stated(E) && (keep.get(E.id) || 0) >= themeLength;
  const kindOf = new Map();
  for (const S of unmoved) {
    kindOf.set(S, isTheme(S.entry) ? 'theme' : S.found ? 'found' : stated(S.entry) ? 'cell' : 'residue');
  }

  // A short stated cell joins the theme next to it in its own definition, for
  // example the last note of T = T9, [2] goes after T9. Its step is written in
  // the theme's own frame.
  const recsByVoice = [];
  for (const rec of recs) (recsByVoice[rec.voice] ||= [])[rec.index] = rec;
  const attached = new Map(); // slot -> { anchor: slot, dt, dstep }
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
  const cells = unmoved.filter(S => kindOf.get(S) === 'cell');
  const anchors = new Map(cells.map(S => [S, anchorOf(S)]).filter(([, a]) => a));
  const hostOf = S => {
    const F = finalOf(S, 7).S;
    if (attached.has(F)) return attached.get(F).host;
    const k = kindOf.get(F);
    return k === 'theme' || k === 'found' ? F : null;
  };
  for (let round = 0, changed = true; changed && round < cells.length + 1; round++) {
    changed = false;
    for (const [S, a] of anchors) {
      if (attached.has(S)) continue;
      const F = finalOf(a.AS, 7).S;
      if (!hostOf(F)) continue;
      attached.set(S, { anchor: F, host: hostOf(F), dt: a.dt, dstep: a.dstep });
      changed = true;
    }
  }

  const units8 = [];
  const unitOfSlot = new Map();
  for (const E of entries) {
    const mine = unmoved.filter(S => S.entry === E);
    const themeSlots = mine.filter(S => kindOf.get(S) === 'theme');
    if (themeSlots.length) units8.push(unitFor('theme', E.id, E.name, themeSlots));
    for (const g of found) {
      if (g.rep.run.entry !== E || kindOf.get(g.rep.slots[0]) !== 'found') continue;
      units8.push(unitFor('found', g.id, null, g.rep.slots.slice().sort((a, b) => a.t - b.t)));
    }
    const loose = mine.filter(S => kindOf.get(S) === 'cell' && !attached.has(S));
    if (loose.length) units8.push(unitFor('cell', E.id, E.name, loose));
  }
  const residueSlots = unmoved.filter(S => kindOf.get(S) === 'residue')
    .sort((a, b) => entries.indexOf(a.entry) - entries.indexOf(b.entry) || a.t - b.t);
  for (const U of units8) for (const S of U.slots) unitOfSlot.set(S, U);
  // Attached slots, in the order they were attached (an anchor before its tail).
  for (const [S, a] of attached) {
    const U = unitOfSlot.get(a.anchor);
    const p = U.local.get(a.anchor);
    U.local.set(S, { t: p.t + a.dt, step: z(p.step + a.dstep) });
    U.slots.push(S);
    unitOfSlot.set(S, U);
  }
  if (residueSlots.length) {
    const R = unitFor('residue', 'residue', null, residueSlots);
    units8.push(R);
    for (const S of residueSlots) unitOfSlot.set(S, R);
  }
  layouts[8] = { units: units8, at: place(units8) };

  // Per note: positions at 6 to 8, bent, explained by.
  const explainedOf = S => (stated(S.entry) ? 'program' : S.found ? 'repeat' : S.near ? 'near' : null);
  const out = notes.map(n => {
    const S = slotOfNote[n.id];
    const pos = [6, 7, 8].map(stop => {
      const F = finalOf(S, stop).S;
      const p = layouts[stop].at.get(F);
      return { t: p.t, step: p.step, d: p.d };
    });
    return { pos, bent: finalOf(S, 7).bent, explainedBy: explainedOf(S), unit: layouts[8].at.get(finalOf(S, 8).S).unit };
  });

  const explained = { program: 0, repeat: 0, near: 0, none: 0 };
  for (const o of out) explained[o.explainedBy ?? 'none']++;
  const tally = new Map();
  for (const o of out) tally.set(o.unit, (tally.get(o.unit) || 0) + 1);
  const describe = U => ({ id: U.id, kind: U.kind, name: U.name, x: U.x, width: U.width, slots: U.slots.length });
  const slotSummary = list => list.map(S => ({ entry: S.entry.id, t: S.t, step: S.s }));

  return {
    notes: out,
    summary: {
      minLength,
      slots: slotByKey.size,
      runs: runs.length,
      explained,
      units: { 6: layouts[6].units.map(describe), 7: layouts[7].units.map(describe), 8: units8.map(U => ({ ...describe(U), notes: tally.get(U) || 0 })) },
      found: found.map(g => ({ id: g.id, length: g.length, count: g.occurrences.length,
        occurrences: g.occurrences.map(o => ({ entry: o.run.entry.id, slots: slotSummary(o.slots), rep: o === g.rep })) })),
      near: nearMatches.map(m => ({ theme: m.theme, notes: m.notes, bent: m.bent, mirror: m.mirror, reverse: m.reverse,
        transpose: m.transpose, stretch: m.stretch, from: m.slots[0].entry.id, slots: slotSummary(m.slots) })),
      themes: units8.filter(U => U.kind !== 'residue').map(U => ({ id: U.id, kind: U.kind, name: U.name, slots: U.slots.length, notes: tally.get(U) || 0 })),
      residue: { slots: residueSlots.length, notes: explained.none },
    },
  };
}
