# Crux fold view: stops 9 and 10 (themes opened, cells)

Status: done, 2026-11-17. All three change sets built and tested; not committed. Browser check pending.
Parent plan: `docs/plans/crux-fold-view.md`. Read its sections "Later folds"
and "Theme level, found shapes, theme folds" first.

## Purpose

The fold view has two reductions on one slider. Stops 1 to 5 go inward: they
show what a shape is made of. Stops 6 to 8 go across: they show what the rest
of the piece takes from the themes. Stops 6 to 8 start again from the theme
level, so the inward reduction is lost at stop 6. In BWV 578 the subject folds
to `nug` and its fragments at stop 5 (in a program that holds only the
subject), but at stop 8 of the whole fugue the subject is 41 positions again.

Two more stops put the inward reduction after the reduction across:

- 9, themes opened: each theme of stop 8 folds to the innermost definitions it
  is made of. This is stop 5, applied inside the themes only.
- 10, cells: a partial statement of a cell (`nug \ 1`) and an edited statement
  (`nug ... @[@3 -3]`) fold onto the cell. An edited note keeps its offset as a
  bent note.

Stops 0 to 8 do not change. Their positions, counts and tests stay as they are.

## End state

- `foldModel` gives each note `pos[9]` and `pos[10]`. `counts.positions` and
  `counts.shapes` have entries for 9 and 10. `stops` has 11 names.
- `tools/fold-report.js` prints the two new rows and a short list of the cells
  at stop 10.
- The Golden fold panel has 11 stop buttons and draws stops 9 and 10.
- The BWV 578 example at stop 10 shows `nug` as one four-note shape, with the
  subject's other notes beside it.
- Guide section 1.8 describes the new stops.

## What exists (verified 2026-11-17)

Trace of `subject = ar, d` (21 notes), frames outermost first:

```
4  nug#2   subject < , < ar < . < a < , < ^ < \(kept) < nug@0 < lit 0
12 nug#3   ... nugd@0 < @(kept) < ~(kept) < * < nugb@2 < @(kept) < ~(kept) < * < nug@2 < lit 2
13 nugb E  ... nugd@1 < @(kept) < ~(kept) < * < nugb@3 < @(out 1) < ~(kept) < * < nug@1 < lit 4
15 nugd E  ... nugd@3 < @(out 0) < ~(kept) < * < nugb@1 < @(kept) < ~(kept) < * < nug@3 < lit 1
```

- A pip that a non-exact operator passed through has `kept: true`. Its owner
  is still `nug`, and `canon` is its index in `nug`. But `nug \ 1` makes an
  instance with three pips, so its signature is not the signature of `nug`
  and it becomes entry `nug#2`. The same holds for `nug#3` (the two pips of
  `nug` that `nugb` and `nugd` did not change).
- A pip that a non-exact operator changed has `out` (step and timeScale after
  the operator). `analysePip` makes it "edited": the owner is the innermost
  definition outside the operator (`nugb`, `nugd`). The frames inside the
  operator still lead to the literal in `nug`, with the index at each step.
- The whole fugue today: stop 5 has 73 shapes and 829 positions; stop 8 has 11
  shapes and 164 positions. The dictionary has `nug` x8, `nug#2` x17,
  `nug#3` x18, `nug#4` x12, `nug#5`, `nug#6`, `nugb` x21, `nugd` x12.
- `thematicFolds` works on slots (one per theme-level position). Every note
  on a slot moves with it. It returns `pos[6..8]`, `bent`, `explainedBy` and
  `fold8` for each note.

## Design

### Stop 9: themes opened

Rule: a slot that is in place at stop 8 as a theme slot moves to the stop 5
position of the note that owns it.

- `thematicFolds` adds to each note the slot it sits on at stop 8, as the id
  of one note of that slot that is the theme's own note (`fold8.rep`). For a
  note on the residue marker, `rep` is null.
- For a note with a `rep`, `pos[9]` is the innermost-level position of the
  `rep` note: entry slot and shown offset, as in `pos[5]`. Use the entries
  that at least one `rep` reaches, in source order, packed side by side with
  the same gap. Entries that no theme reaches are left out.
- The step at stop 9 is the `rep` note's body step, plus the note's `bent`.
- The residue marker stays one position, after the last entry. With
  `showFound`, found units stay as they are at stop 8, after the entries and
  before the marker.
- A cell attached to a theme note at stop 8 goes with that note.

The innermost level is the one `buildLevel` already makes for stops 3 to 5.
Do not build it again. Only the packing (which entries, their x) is new.

### Stop 10: cells

A third level, the cell level, made by `analysePip` with a new option and
`buildLevel` with one new rule.

1. Edited statements. A pip changed by a non-exact operator stays with the
   innermost definition (the same owner as a `kept` pip) when all of these
   hold:
   - the frames inside the operator lead to a literal through a definition
     (the frame has a `next`, and the chain has a `ref`);
   - the operator did not change the duration: `|out.ts|` is the duration
     that the inner frames give;
   - the pip is one pip for one pip (the operator did not split or merge it).
   Its body step is the literal's step, as for a kept pip. Its `bent` at the
   cell level is the step the operator gave, less the step the inner frames
   give, taken back into the owner's frame (divide by the sign or scale of
   the exact frames between the owner and the operator). A pip that fails a
   condition stays edited, as today.
   If two operators changed one pip, the outermost one gives the step. The
   bent value is the total.
2. Partial statements. An instance whose pips are a part of another entry
   of the same definition (same `canon`, body step, body duration and tag
   for each pip it has) is an instance of that entry. With rule 1 this makes
   `nug \ 1`, the kept pips of `nugb`, and the bent pips one entry, `nug`.
   When two full entries both hold the part, take the one with more pips,
   then the first in source order.
3. `pos[10]` is `pos[9]` with the cell level in place of the innermost
   level: the `rep` note's cell-level entry slot and offset. The step is the
   body step plus the bent values (cell level, then stop 7).

A note bent at the cell level is not "edited" for the stop 10 counts. Keep
`note.edited` as it is (it describes stops 3 to 5). Add `note.cellBent` (0
when not bent) and `note.cell` (the cell-level entry id).

Bent values at stop 7 are limited to 2 steps. The cell level has no limit:
the program states the edit, so the fold does not have to judge it.

### Names and counts

- `stops[9] = 'themes opened'`, `stops[10] = 'cells'`. Golden labels:
  `'opened'`, `'cells'`.
- `counts.shapes[9]`: entries shown at stop 9. `counts.shapes[10]`: entries
  shown at stop 10. The residue marker is not a shape, as at stop 8.
- `counts.positions` uses the same key as stops 5 to 8 (no voice).
- `explained` does not change.

### Hosts

- Golden: `STOPS = 11` and the labels in `golden_crux_fold.js`. Check each use
  of `STOPS` and of `pos[...]` there. Draw a note with `cellBent` at stop 10
  with the mark that stop 7 uses for a bent note. Check that 11 stop buttons
  fit the bar at the panel's usual width; shorten labels before changing the
  layout.
- Wad: no change. Its Crux bundle is a snapshot.

## Change sets

Git writes cannot run from the sandbox. Each change set ends with tests
green and a list of files for Andy to commit. Both repos have uncommitted
fold work from 2026-11-16; build on it and do not revert it.

1. crux: stop 9. `thematic.js` (`fold8.rep`), `model.js` (pos[9], counts,
   stops), `tools/fold-report.js`, tests in `test/fold-thematic.test.js`.
   About 200 lines.
   - [x] `rep` for theme, found and attached notes; null on the residue
   - [x] pos[9], counts, stops
   - [x] report rows
   - [x] tests: a small program with a theme made of two cells; BWV 578
         positions at stop 9 are fewer than at stop 8
2. crux: stop 10. `model.js` (`analysePip` option, partial rule in
   `buildLevel`, pos[10], `cell`, `cellBent`), report, tests, guide 1.8.
   About 300 lines.
   - [x] edited statements as bent notes, with the three conditions
   - [x] partial statements join the full entry
   - [x] pos[10], counts, report
   - [x] tests: `A \ 1`; `A @ [@1 5]`; `(A * |-1) ~ -1 @[@3 -3]` (reverse and
         rotate between the cell and the edit); an edit that changes a
         duration stays edited; the subject program gives one `nug` entry of
         4 positions
   - [x] guide 1.8
3. disrupterbox: rebuild the Crux bundle (`docs/crux-rebuild.md`), Golden
   stops and drawing, `golden_crux_fold.test.js`. About 100 lines.
   - [x] rebuild `crux/dist/` and `modules/golden/crux.js`
   - [x] `STOPS`, labels, bent mark at stop 10
   - [x] Golden fold tests

## Checks

- crux: `npm test` (600 pass before this work).
- Golden: the fold and key-lane tests (32 pass before this work).
- `node tools/fold-report.js examples/bach-bwv578.keylane.crux`: positions go
  down from stop 8 to 9 to 10. Rows 0 to 8 are the same as before.
- The report for a program that holds only the subject shows `nug` x1 with 4
  positions at the cell level.
- Browser check of the panel: after Andy restarts Doh. Not possible from the
  sandbox.

## Notes from the build

- At stops 9 and 10 a note stacks on its cell note at the cell note's step,
  as a bent note does at stops 7 and 8. `bent` and `cellBent` are marks, not
  positions. With the bend added to the step, the subject would show `nug`
  with 6 positions, not 4.
- `counts.shapes[9]` and `[10]` count found units (with `showFound`) as
  shapes, as stop 8 does.
- Each note also gets `fold9` and `fold10` (`kind`, `unit`, `entry`), and the
  model has `inward.units[9]` and `[10]` for labels. `counts.cellEdited` and
  `counts.cellBent` count the notes still edited and the notes bent at the
  cell level.
- "One pip for one pip": two changed pips of one operator application with
  the same operand index are a split.
- Golden: from stop 9 a note takes the colour of the definition it sits in
  (`CruxFold.ownerAt`). The panel draws no text on the canvas, so the bent
  mark (`bentMark`) is computed for stops 9 and 10 but not drawn, as at
  stop 7.

## Open questions

- A program with no themes (the subject by itself: stop 8 is one residue
  marker) has nothing to open at stops 9 and 10. Default for this work: when
  stop 8 has no theme, stops 9 and 10 use all the entries of stops 5 and of
  the cell level, with no residue marker. Report what this looks like.
- `br` and `nugc` change a pip to two pips (`@5 [4,3]/`). These stay edited
  under condition 3. A later rule can show them as a split of the cell note.
- Should stops 4 and 5 use the partial rule too? Not in this work.
