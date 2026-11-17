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

## Splits (added 2026-11-17)

Status: built and tested, 2026-11-17. Change set 4. Not committed. Browser
check pending. See "Notes from the build (change set 4)".

### What a split is

`X @[@5 [4, 3]/]` puts two pips in the place of pip 5 of X. Each new pip is
the old pip's step plus an offset (4, 3), and the two share the old pip's
duration. In BWV 578 `br` splits one pip of `b`, and `nugc` splits three
pips of `br`. These notes are edited at the cell level today: 13 of the 41
notes of the subject, and most of the 288 notes of the whole fugue.

Trace of the subject today (frames outermost first):

```
16 br E    ... br@5 < @(out 1|0.5)@-1
17 br E    ... br@6 < @(out 0|0.5)@-1
21 nugc E  ... nugc@1 < \(kept) < @(out -3|0.5)@-1
27 br E    ... nugc@7 < \(kept) < @(kept)@5 < br@5 < @(out 1|0.5)@-1
```

The `@` frame of a new pip has `index: -1` and no `next`. The trace does not
know which pip of the operand it replaced, so the fold cannot place it.

Note what the split pips replace. `b = nugb ., [-3]` puts the literal `-3`
between the notes of `nugb`. `br@5` and `nugc@1`, `nugc@3` split that `-3`.
Only `nugc@7` splits a note of `nug` (the bent one). So most splits fold onto
`b`, not onto `nug`.

### Trace: say what a new pip replaced

In `genericMap` (trace.js), for `@` only. The kept pips have a known operand
index. Take each run of output pips with no operand index that lies between
two kept pips (or an end of the mot). When exactly one operand pip lies in
the same gap, each pip of the run gets, on its `@` frame:

```
from: { origin, index, part, parts }
```

`origin` is the origin of the operand pip, `index` its index in the operand,
`part` the place of this pip in the run (from 0) and `parts` the length of
the run. `index` on the frame stays -1 and `next` stays as it is, so
`framesOf`, the theme level and stops 0 to 8 read the same frames as before.
A run of one pip gets `from` too (`parts: 1`): it is a replacement whose
operand is now known.

### Cell level: parts stack on the pip they replaced

For a pip whose changing frame has `from`, the cell level analyses the pip
it replaced, seen through the same outer frames: the frames outside the `@`,
then the `@` as a frame that kept the pip, then the frames of `from.origin`.
That gives the owner, `canon`, body step and body duration of the replaced
pip, by the rules that are there now (kept, bent or edited).

The pip then takes that owner, canon and body. It is a part of a split when:

- the durations of the parts of its run add up to the duration that the
  replaced pip has at the `@` (within 1e-6);
- the replaced pip, analysed this way, has an owner.

Its `cellBent` is its step after the `@`, less the step of the replaced pip
at the `@`, taken back into the owner's frame, plus the bend of the replaced
pip if it has one. Its note gets `split: { part, parts }`. A pip that fails
a condition stays edited, as today.

In `buildLevel` at the cell level, the parts of one split are one slot: one
key in the signature, one offset, and the width of the replaced pip. The
partial rule then sees `br` and `nugc` as statements of `b`.

The conditions of stop 10 for a bent note (duration kept, one pip for one
pip) do not apply to a part; the split rule replaces them for pips with
`from`. A `from` with `parts: 1` goes through the bent rule with the
operand now known.

A replaced pip that is itself a part of a split (a split of a split) follows
the same rule again. `split` then describes the innermost `@` only.

### Counts and report

- `counts.cellSplit`: notes that are parts of a split. `cellEdited` goes
  down by the same notes.
- The stop 10 cell list in `fold-report.js` adds "N split" beside "N bent".
- Golden: no drawing change. `bentMark` text for a part may add its place
  (for example `1/2`), but nothing draws it yet.

### Change set 4

crux: `trace.js` (`from`), `model.js` (cell level), `tools/fold-report.js`,
`test/trace.test.js`, `test/fold-thematic.test.js`, guide 1.8. Then rebuild
`dist/` and `modules/golden/crux.js`. About 200 lines.

- [x] trace: `from` on `@` frames, runs between kept pips
- [x] cell level: parts take the replaced pip's owner, canon and body
- [x] one slot for the parts of a split; partial rule over them
- [x] `split`, `cellSplit`, report
- [x] tests: `A @[@1 [0, 2]/]` (two parts on one slot of A); a split seen
      through `\ 1`; a split of a bent note; a replacement whose durations
      do not add up stays edited; the frames that `framesOf` gives are the
      same as before for these programs
- [x] guide 1.8 (frame `from`, note `split`)
- [x] rebuild, Golden tests

### Checks

- All rows for stops 0 to 9 in the BWV 578 report are the same as before
  this change set. Stop 10 positions go down or stay.
- The full subject (`subject = ar, br, nugc, d`, 41 notes): today the cell
  list is nug 4, a 1, b 3, d 2, br 2, nugc 6. After: no `br` and no `nugc`
  entry, 10 positions, 0 edited at the cell level.
- crux 611 tests pass before; Golden 45.

### Notes from the build (change set 4)

- The runs in `markReplaced` lie between pips with a known operand index:
  kept pips, and changed pips whose index the trace knows.
- The parts' durations are read from the output, and from the `from.origin`
  chains (a part that a later `@` splits again is not in the output). A
  split whose parts are not all there (a later `\` drops one) stays edited.
- A replaced pip whose owner is outside the `@` (`[0, 4] @ [@1 [0, 2]/]`
  with no definition inside) gives no split: the parts stay edited.
- `counts.cellBent` does not count parts of a split, so edited, bent and
  split are three separate counts.
- The old set of one-to-many frames in `model.js` is now `oneToMany`.
- Full subject: the cell list is nug 4, a 1, b 4, d 2: 11 positions, not 10.
  b has four places now: the `-3` at b's note 5, which br splits, is one of
  them. 3 notes stay edited, not 0: the `-3` pips that `.,` takes from its
  second operand (b's notes 1, 3 and 7). The split rule does not touch them.
- BWV 578: stop 10 goes from 20 shapes / 141 positions to 18 / 134. Rows 0
  to 9 are unchanged. Edited at the cell level: 288 to 204, all of them
  second-operand pips of `zip` (P1, P2, P3: 177) and `.,` (b: 27).

### Not in this work

- The four `-3` pips that `.,` puts in `b` come from one literal but are
  three or four positions. A rule for a literal that an operator repeats
  would make them one.
- Drawing the bent and split marks in the panel.

## Core (added 2026-11-17)

Status: built and tested, 2026-11-17. Change set 5. Not committed. Browser
check pending. See "Notes from the build (change set 5)".

### Purpose

Stop 10 of BWV 578 still shows 18 shapes. The fold has no more stated
relations to undo, and it cannot know which shape the analysis is about.
Andy names it by hand: `// #core nug`. One more stop shows the core only.

Decision (Andy, 2026-11-17): this stop uses only what the program states.
No search for unstated matches of the core.

### Directive

`// #core A B` names one or more definitions, as `#theme` does. The option
`core: ['A', 'B']` of `crux_fold` does the same and wins over the directive.
A core is the cell-level entry (stop 10) of a named definition. A name with
no entry at the cell level (a definition that writes no note of its own,
such as `nugb` or `subject`) is listed in `inward.core.missing` and is not
a core.

Mind the directive rule in guide 1.6: when the value has two or more tokens
and the last is a positive integer, the directive is scoped to a sampler.
Read `#core` the way `#theme` is read.

### Stop 11: core only

Each note is one of three kinds at stop 11 (`fold11.kind`):

- `core`: its cell (`note.cell`) is a core entry. It sits on its core slot,
  as at stop 10. Bent notes and parts of a split are core notes.
- `attached`: a note that is not a core note, written by the definition that
  holds a core statement. It stacks on a core note.
- `residue`: every other note. One residue marker, after the last core.

The attached rule. For a core note, go outward from its core definition
frame. The first definition use whose definition writes notes of its own
(some note has it as its cell-level owner) is the host use of that core
statement. A definition between them that writes no notes (`nugb`, `nugd`)
is passed. A note that is not a core note attaches when its cell-level
owner use is a host use. In BWV 578 the hosts are `a` (its `[0]`), `b` (the
`-3` pips and their split parts) and `d` (its `[4]` and `[1]`). `subject`
writes no notes, and a voice section is not a host because `a`, `b` or `d`
is found first.

An attached note stacks on the core note of the same host use that is
nearest in time (the earlier one on a tie), on that note's core slot and
step. It does not add a position.

A note on the residue marker at stop 10 stays residue when it is not a core
note and not a host note. A core note or host note that the themes of stop 8
did not reach (residue at stops 8 to 10) is `core` or `attached` at stop 11:
the core is picked by hand, so it does not depend on the theme analysis.

Layout: the core entries in source order, each with its stop 10 slot
layout, packed side by side with the usual gap. Then the residue marker.

Without a core (no directive, no option, or only missing names), stop 11 is
the same as stop 10 and `inward.core.names` is empty.

### Model, report, hosts

- `pos[11]`, `fold11: { kind, unit, entry }`, `stops[11] = 'core only'`.
- `inward.core = { names, missing }`, `inward.units[11]`.
- `counts.shapes[11]` (core entries), `counts.positions[11]`, and
  `counts.core = { stated, bent, split, attached, residue }` (`stated` is
  all core notes; `bent` and `split` are parts of it).
- `fold-report.js`: row 11, and a list: each core with its positions, notes,
  bent, split and attached, then the residue count.
- Golden: `STOPS = 12`, label `'core'`. Attached notes are drawn as the
  notes attached at stop 8 are. Residue notes as at stop 8.
- Add `// #core nug` to `examples/bach-bwv578.keylane.crux` (after the
  `#theme` line, and say what it does in the comment block; a comment about
  it must not start with `// #core`). The Golden library has a copy of this
  program in `modules/golden/golden_crux_examples.js` ("Bach Fugue BWV 578
  (key lane)"); change it the same way.
- Guide: 1.6 (directive) and 1.8.

### Change set 5

- [x] directive and option, `inward.core`
- [x] kinds, host rule, attachment target
- [x] pos[11], layout, counts, stops
- [x] report
- [x] tests: a core with a bent note and a split; a host with its own
      literal (attached); a definition that writes no notes between the
      core and the host; a missing name; no core (stop 11 equals stop 10);
      a core note outside every theme is still core
- [x] example and library entry
- [x] guide 1.6 and 1.8
- [x] rebuild; Golden `STOPS`, label, drawing, tests

### Checks

- BWV 578 report rows 0 to 10 are the same as before this change set (the
  added directive must not change them).
- BWV 578 at stop 11: one shape (`nug`), 5 positions (4 and the residue
  marker). Report the real counts of core, attached and residue notes.
- crux 620 tests pass before; Golden 45.

### Notes from the build (change set 5)

- A core note sits on its own slot of its cell-level entry (`note.cell`),
  not on the slot of its `fold8.rep` as at stop 10. The two differ for core
  notes that the themes did not reach: at stop 10 they are on the residue
  marker. In BWV 578 these are 6 notes (the `nug` notes inside `nugp`).
- A definition use is told apart by its voice and every frame from the use
  outward (the key `usesOf` uses). For a part of a split, the frames are
  the chain through the replaced pip.
- Each note gets `fold11.host` (the host's name) when attached.
  `inward.units[11]` gives `attached` per core unit. Without a core,
  `counts.core` is `null` and `fold11` and `pos[11]` are copies of
  `fold10` and `pos[10]`.
- BWV 578 at stop 11: `nug` x57, 4 positions, and the residue marker: 1
  shape, 5 positions. `counts.core`: stated 210 (33 bent, 12 split),
  attached 120 (a 9, b 99, d 12), residue 1339. b's 99: its 27 own `-3`
  pips and 72 parts of the splits of those pips in `br` and `nugc`. Of the
  core notes, 6 are outside every theme (`nug` in `nugp`), and so are 12
  attached notes (b's notes in `nugp`). Rows 0 to 10 are unchanged.
- Of the 274 notes on `nug` at stop 10, 70 are residue at stop 11: notes
  of other definitions (s7, tail, a5, t6 and others) that stops 6 and 7
  moved onto the subject, and `nugp`'s own `[1, -3]`.
- Golden: at stop 11 a core note takes the core's colour and an attached
  note its host's. Only a core note keeps a bent mark, its `cellBent`.
  The badge of a core unit shows its attached notes. Nothing is drawn as
  text on the canvas, as before.
- The BWV 578 tests in `test/fold-thematic.test.js` took the first 54
  lines of the example. The new directive and comment move the lines, so
  they now take the lines before `subject =`.


## Focus levels (added 2026-11-17)

Status: built and tested, 2026-11-17. Change set 6. Not committed. Browser
check pending. See "Notes from the build (change set 6)".

### Purpose

The step from stop 10 (18 shapes) to stop 11 (nug and a residue marker) is
too large. Andy wants intermediate structure that he picks by hand, and no
unrelated notes on screen while it shows:

- fold 11: `a`, `nugb`, `nugc`, `nugd`
- fold 12: `nug`

Decisions (Andy, 2026-11-17): the levels are named by hand. At these stops
the notes that belong to no named shape are hidden, not gathered on a
residue marker.

### Directive

`// #core` takes one or more levels, separated by `/`, in the order of the
stops:

```
// #core a nugb nugc nugd / nug
```

The option `core` of `crux_fold` takes the same as an array of arrays (an
array of names is one level, as today). One level is what change set 5
built, except for the hidden notes (below).

The stops are no longer a fixed number. A model has stops 0 to 10 and then
one stop for each level: `stops.length` is 11 plus the number of levels.
Without `#core` the last stop is 10. (Today stop 11 without a core is a
copy of stop 10. Remove that copy.)

### The last level: core

As change set 5: cell-level entries, bent notes and parts of a split are
`core`, host notes are `attached`. One change: a note that is neither is
`hidden`. There is no residue marker.

### The levels before the last: shapes

A level before the last shows whole definitions, as they are written.

- A note belongs to the outermost named definition of the level that it
  passed through. This is `analysePip` with a level that has only `named`
  (as `#theme` does), so `nugc` holds the `nugb` inside it, and the entry
  `nugb` holds only the statements of `nugb` that are in no other named
  definition.
- `buildLevel` (no partial rule) gives the entries and the slot layout, as
  for the theme level: one copy of each shape, transposition, mirror,
  reverse and stretch removed, widths by the stop 5 rule.
- A note that passed through no named definition of the level is `hidden`.
- A name that no note passed through goes to `missing` for that level.

Kinds at a level: `shape` (levels before the last), `core`, `attached`
(last level), `hidden` (all levels).

### Positions

- `pos[11 + i]` for level i. A shown note sits on its slot. The entries of
  the level are packed side by side in source order.
- A hidden note keeps the position it had at the stop before, and
  `pos[k].hidden` is true. The host fades it out on the way to the stop and
  draws nothing for it at the stop. A note hidden at one level and shown at
  the next fades in while it moves.
- Counts use shown notes only: `counts.positions[k]` and `counts.shapes[k]`
  do not count hidden notes.

### Data

- `note.focus[i] = { kind, unit, entry, host }` for level i. This replaces
  `fold11`.
- `inward.levels[i] = { names, missing, kind: 'shapes' | 'core', units,
  shown, attached, hidden }`. This replaces `inward.core` and
  `inward.units[11]`. `counts.core` stays and describes the last level,
  with `hidden` in place of `residue`.
- `stops[11 + i]`: the names of the level joined by a space.

### Report and hosts

- `fold-report.js`: one row for each level, and for each level its list of
  shapes (positions, notes, and for the last level bent, split, attached),
  then the number of hidden notes.
- Golden: the number of stops comes from the model, not from a constant.
  The stop buttons are made again when the program changes. The label of a
  level stop is its first name, with `+` when it has more names (`a+`,
  `nug`). `CruxFold.STOPS` can stay as the number of fixed stops (11). Check
  every use of it, of `STOP_LABELS`, and of the stop 11 helpers (colour,
  opacity, bent mark, badges). Hidden notes fade with the slider and are
  not hit by hover.
- Example and library copy: `// #core a nugb nugc nugd / nug`, and the
  comment block says what the levels are.
- Guide 1.6 and 1.8.

### Change set 6

- [x] directive with levels; option; `stops` length from the levels
- [x] shape levels: named level, entries, layout, hidden notes
- [x] last level: hidden in place of the residue marker
- [x] `focus`, `inward.levels`, counts
- [x] report
- [x] tests: two levels; a named definition inside another named one of the
      same level; a hidden note keeps its last position; a note hidden at
      one level and attached at the next; a missing name in a level; no
      core gives 11 stops; one level is the core stop
- [x] example, library copy, guide
- [x] rebuild; Golden stops from the model, labels, fading, tests

### Checks

- BWV 578 report rows 0 to 10 are the same as before this change set.
- BWV 578: 13 stops. Stop 11 has four shapes (`a`, `nugb`, `nugc`, `nugd`).
  Stop 12 has one shape, `nug`, 4 positions, 210 core and 120 attached
  notes as before, and 1339 hidden.
- crux 629 tests pass before; Golden 48.

### Notes from the build (change set 6)

- Departure: the shape levels use the partial rule of the cell level
  (`buildLevel(..., true)`), not "no partial rule". Without it BWV 578 at
  stop 11 has 7 entries: `a`, `a#2` (`subject > [-4]` in s6), `a#3`
  (`ar \ 1` in a4), `nugb`, `nugc`, `nugc#2` (`nugc \ 2` in nugp),
  `nugd`. Each extra entry is a partial statement that the program writes,
  so joining it keeps "one copy of each shape" and uses only what the
  program states. With it: four shapes.
- The directive is read as written: `/` is a token of its own or part of
  one, and the value stays global (its last token is a name, not a sampler
  index). The option `core` takes an array of names (one level), an array
  of arrays (levels) or a string (read as the directive).
- A level whose names are all missing is still a stop, and every note is
  hidden there. Change set 5 made stop 11 a copy of stop 10 in that case;
  that copy is gone, so the number of stops follows the directive.
- `focus[i]` always has `unit`, `entry` and `host` (null when they do
  not apply). `inward.levels[i].shown` counts every note that is not hidden
  (attached notes included).
- A hidden note's position is a copy of the stop before with `hidden: true`.
  Counts and the Golden extents (`ext`) skip hidden notes.
- BWV 578: stop 11 has a x9 (11 positions, 96 notes), nugb x9 (4, 36), nugc
  x9 (11, 93), nugd x12 (4, 48): 4 shapes, 30 positions, 1396 hidden.
  Stop 12: nug x57, 4 positions, 210 core (33 bent, 12 split), 120 attached,
  1339 hidden. 57 notes are hidden at stop 11 and attached at stop 12: b's
  27 own `-3` pips, 18 parts of br's split of a `-3` (br outside nugc),
  and d's 12 notes (`[4]`, `[1]`). No note is shown at stop 11 and hidden
  at stop 12. Rows 0 to 10 of the report are unchanged.
- Golden: `CruxFold.STOPS` is 11 (fixed stops). `prepare` gives
  `nStops`, `names` and `labels`; `stopsOf(view)` is used by
  `frameAt`, `countsAt`, `stackCounts` and `goTo`. The stop buttons
  and the slider range are set again on each sync. At a shape level a note
  takes its shape's colour and has no bent mark (the shape is as written).
  A hidden note keeps the colour of the stop before. The panel has no hover
  handler today; `hitTest` skips a rect with `hidden`, and the panel does
  not draw or light (playhead) a note whose alpha is 0.
