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

## Fewer stops, stable order (added 2026-11-17)

Status: built and tested, 2026-11-17. Change set 7. Not committed. Browser
check pending. See "Notes from the build (change set 7)".

### What Andy saw

From stop 8 to 9 to 10 little structure appears, and a group of notes goes
from left to right and back.

Measured on BWV 578:

- The group is `br` and `nugc` (87 notes). Their edited notes have no
  literal position, so the stop 9 layout sorts them to the right end, after
  A8. At stop 10 the split rule folds them onto `nug` and `b` at the left.
- 1660 of 1669 notes move between stops 8 and 9, most of them only because
  the shapes are packed again. CS is nearly all literal, so only the subject
  opens.
- Stop 10 folds everything to `nug`. Then the first focus level opens it
  again into `a`, `nugb`, `nugc`, `nugd`, and the last level folds it once
  more.

Decision (Andy, 2026-11-17): drop "themes opened" and, when the program has
`#core`, drop "cells" too. Keep shapes in place across stops.

### Stops

- Stops 0 to 8 do not change.
- With `#core` levels: stop 9 + i is level i. `stops.length` is 9 plus the
  number of levels. BWV 578 has 11 stops: 8 themes, 9 `a nugb nugc nugd`,
  10 `nug`.
- Without `#core` (or with the option `core: []`, which turns the directive
  off): one more stop, 9, "cells". It is what stop 10 is today (entries of
  the cell level that the themes reach, then the residue marker; all
  entries and no marker when stop 8 has no theme). `stops.length` is 10.
- "Themes opened" is gone: `pos[9]` as it is today, `fold9`, `openThemes`
  and its counts. Keep what the cell level and the levels need.

One structure for every stop after 8: `inward.levels[i]` and
`note.focus[i]` describe stop 9 + i. The cells stop is a level with
`kind: 'cells'`; its notes have `focus[0].kind` `cell` or `residue`. This
replaces `fold10` and `inward.units[9]`, `inward.units[10]`.

### Order and place

At each stop after 8, the shapes are laid out in the order they had at the
stop before, not in source order:

- The key of a shape is the smallest x of its shown notes at the stop
  before. Ties: source order.
- Cells stop: a shape starts at its key x when there is room, and
  otherwise right after the shape before it (the usual gap). So a shape
  that does not change stays where it is, and the shapes to the right of
  the subject do not slide when the subject gets smaller. The residue
  marker stays last, at its stop 8 place when there is room.
- Focus levels: the shown shapes are packed side by side from x = 0 in
  that order. The other notes are hidden where they are.

A note that was on the residue marker at stop 8 and is shown at a level
(the `nug` notes of `nugp`) does not count for the key of its shape, unless
the shape has no other notes.

### Hosts, report, docs

- Golden: `CruxFold.STOPS` is 9 (the fixed stops). Labels and buttons come
  from the model, as now. Check each use of stop numbers 9, 10 and 11 in
  `golden_crux_fold.js` and `golden_crux_fold_ui.js` (colour, opacity, bent
  mark, badges, cap marks).
- `fold-report.js`: rows follow `stops`. One list for each level.
- Guide 1.8 and the comment block of the BWV 578 example and its library
  copy (the stop numbers changed).

### Change set 7

- [x] stops: 9 + levels, or 10 with the cells stop; `core: []`
- [x] remove "themes opened"
- [x] one structure: `inward.levels`, `note.focus` for the cells stop too
- [x] order by the place at the stop before; cells stop keeps place
- [x] report, guide, example comments
- [x] tests: the old stop 9 tests go; the stop 10 tests become cells stop
      tests (with `core: []` where the program has a directive); a shape
      with edited notes stays between its neighbours; a shape that does not
      change keeps its x at the cells stop; the order at a focus level
- [x] rebuild; Golden fixed stops, tests

### Checks

- BWV 578 report rows 0 to 8 are the same as before this change set.
- BWV 578: 11 stops. Stop 9: 4 shapes, 30 positions, 273 shown, 1396
  hidden. Stop 10: `nug`, 4 positions, 210 core, 120 attached, 1339 hidden.
- BWV 578 with `core: []`: 10 stops. Stop 9: 18 shapes, 134 positions (the
  numbers of the old stop 10). From stop 8 to stop 9 the notes of link, K,
  U, U2, Qr, D4, D2, R4 and A8 do not move.
- crux 634 tests pass before; Golden 49.

### Notes from the build (change set 7)

- Stops: with `#core`, 9 + levels; without it (or with `core: []`, which
  already worked as "off" in the option parser), 10, the last one `cells`.
  `fold9`, `fold10`, `inward.units`, `openThemes` and the stop 9 counts are
  gone. `inward.themed` stays (the report and the cells stop use it).
- One structure: `inward.levels[i]` and `note.focus[i]` for stop 9 + i. The
  cells level has `kind: 'cells'`, `names: []`, `missing: []`, `hidden: 0`.
  Its notes have `focus[0].kind` `cell`, `residue`, or `found` (with
  `showFound`; the plan names only `cell` and `residue`). `entry` is null for
  found and residue notes. `inward.levels[i].units` are in layout order and
  each unit has `x`.
- Layout is one function, `layOut`, for every level. The level builders give
  each note a unit and a position from the start of the unit; `layOut` reads
  the keys from `pos[k - 1]`, orders and places the units, and then writes
  `pos[k]`, the unit counts and the focus entries. Hidden notes at the first
  focus level keep their stop 8 position.
- A unit with no key (no shown note at the stop before) takes the smallest
  x of all its notes there; this is the rule for a shape whose notes were
  all on the residue marker, applied to hidden notes too.
- BWV 578 with the directive: 11 stops. Stop 9: a 0-11, nugb 11.5-15.5,
  nugc 16-30, nugd 30.5-34.5 (the same order as the source here); 30
  positions, 273 shown, 1396 hidden. Stop 10: nug, 4 positions, 210 core,
  120 attached, 1339 hidden. From stop 8 to 9, 265 notes move (mean 33.7 in
  x); the hidden notes stay where they were. Before this change set: 1660,
  mean 45.5.
- BWV 578 with `core: []`: 10 stops; stop 9 has 18 shapes and 134
  positions. 1196 notes move from stop 8 to 9 (mean 11.2). link and the
  cells of the subject (nug 0, a 20, b 32, d 60) keep their key place; no
  shape changes order with another. K, U, U2, Qr, D4 and D2 move +1, and R4,
  A8 and the residue marker +4. Two causes:
  - CS is one shape at stop 8 (79-143, no gap inside). Its cells get the
    usual gap between them. Z is narrower at the cell level (its own unit is
    1, not CS's 0.5: width 4, not 8), but TR keeps its key (95), so the room
    that Z leaves is used before TR, not after it. P1 then starts at 111.5
    (+0.5) and P2 at 128 (+1); P2 ends at 144, past K's key 143.5.
  - D2 (`[0, -2, -4, -1 | 2, r | 3]`) is 8 wide at the cell level and 5 at
    stop 8: the cell level counts the trailing rest, stop 8 measures the
    notes. R4 then cannot start at 196.5.
  The rule is as written. Two changes would give 0 moves for these shapes:
  no gap between the cells of one stop 8 theme, and a cell unit's width
  measured from its notes (as stop 8 does). Not done: each is a new rule.
- Golden: `CruxFold.STOPS` is 9; `STOP_NAMES` and `STOP_LABELS` have 9
  entries. The labels of the stops after 8 come from `model.stops` (`cells`
  or the level names). `noteAlpha`, `bentMark`, `ownerAt` and `hiddenAt`
  read `focus` for every stop after 8: at the cells stop a residue note is
  dim, a cell note keeps its stop 7 bend plus `cellBent`, and a found or
  residue note keeps its stop 8 colour. `owner9`, `owner10`, `fold9` and
  `fold10` are gone from the view notes.
- Tests: crux 634 before, 635 after (5 stop 9 tests out; 6 order tests in,
  one of them for found units and the residue marker at the cells stop,
  which only the old stop 9 tests covered). Golden 49 before and after.

## Shown stops (added 2026-11-17)

Status: built and tested, 2026-11-17. Change set 8. Not committed. Browser
check pending. See "Notes from the build (change set 8)".

### What Andy asked

"Can we just get rid of 8, 9 and 5?" He was looking at the build before
change set 7 (13 buttons: 5 nesting, 8 themes, 9 opened, 10 cells, 11 a+,
12 nug). Change set 7 has removed "opened" already, and "cells" for a
program with `#core`. What is left to remove: "nesting" (5) and, for a
program with `#core`, "themes" (8).

### Rule

The model keeps its stops and their numbers (`pos[k]`, `stops[k]`, counts):
they are steps of the analysis, and later steps read earlier ones. What
changes is which of them the slider shows. The model gets

```
shown: [0, 1, 2, 3, 4, 6, 7, 9, 10]      BWV 578 with #core
shown: [0, 1, 2, 3, 4, 6, 7, 8, 9]       a program without #core
```

- Stop 5 (nesting) is never shown.
- Stop 8 (themes) is shown only when the program has no `#core` levels.
- Every stop after 8 is shown.

Option `shown` of `crux_fold` (an array of stop numbers) replaces the rule,
for tests and for later use. Numbers that the model does not have are left
out. Stop 0 is always first.

BWV 578 then has 9 buttons: heard, steps, transp., mirror, repeats, found,
near, a+, nug.

### "The stop before"

Two rules of the levels read the stop before: the order of the shapes (the
smallest x of a shape's shown notes at the stop before), and the place of a
hidden note (it keeps the position it had). Both must use the stop before
in `shown`, not stop k - 1. With `#core`, the first level comes after stop
7, so a hidden note stays at its stop 7 position and the shapes are ordered
by their stop 7 x. A note must never pass through the layout of a stop
that is not shown.

For a program without `#core` nothing changes here: stop 8 is shown, and
the cells stop reads it.

### Hosts and report

- Golden: the slider and the buttons run over `shown`. The slider value is
  a place in `shown` (0 to `shown.length - 1`); between two places the view
  moves each note from `pos[shown[i]]` to `pos[shown[i + 1]]`. A button
  shows its place and the label (`5 found`), so the numbers on screen have
  no holes. Everything that reads a stop number (`prepare`, frame, colour,
  opacity, bent mark, cap mark, hidden, counts text, `goTo`, the "found"
  button that speaks of stop 8) goes through `shown`. `CruxFold.STOPS` and
  `STOP_LABELS` stay as the fixed analysis stops.
- `fold-report.js`: the table keeps every stop of the model, with a mark on
  the rows that the slider does not show, and one line that lists `shown`.
- Guide 1.8: the difference between the stops of the model and the stops
  that are shown.

### Change set 8

- [x] `shown` by the rule; option `shown`
- [x] levels read the stop before in `shown` (order, hidden place)
- [x] report
- [x] tests: `shown` with and without `#core`; the option; a hidden note
      at the first level keeps its stop 7 position; with `#core`, no
      `pos[9]` equals a stop 8 position that differs from the note's stop
      7 position
- [x] guide
- [x] rebuild; Golden slider, buttons and helpers over `shown`; tests

### Checks

- BWV 578 report rows 0 to 8 are the same as before this change set. The
  rows of stops 9 and 10 keep their shapes and positions (4 and 30; 1 and
  4) and their shown, hidden, core and attached counts.
- BWV 578: `shown` is `[0, 1, 2, 3, 4, 6, 7, 9, 10]`.
- crux 635 tests pass before; Golden 49.

### Notes from the build (change set 8)

- `model.shown` is set by the rule, or by the option `shown`: numbers the
  model does not have are left out, the rest are sorted (the plan does not
  say; "the stop before" needs an order), and stop 0 is put first. A level
  of names that are all missing is still a level, so stop 8 is not shown
  there either.
- "The stop before" of stop k is the last shown stop under k
  (`stopBefore`). Stop 0 has no position in the model, so a list with no
  shown stop between 1 and k - 1 reads stop 1. The rule that a note on the
  residue marker does not count for the key of its shape now applies when
  the stop before is 8 (it was: when k is 9). At stop 7 those notes have
  their own positions.
- BWV 578: `shown` `[0, 1, 2, 3, 4, 6, 7, 9, 10]`; with `core: []`, `[0, 1,
  2, 3, 4, 6, 7, 8, 9]`. Report rows 0 to 10 are the same; stops 9 and 10
  keep their shapes, positions and counts. The order at stop 9 changes:
  nugc 0-14, a 14.5-25.5, nugb 26-30, nugd 30.5-34.5 (it was a, nugb, nugc,
  nugd), because at stop 7 a note of nugc lies left of every note of a.
  The 1396 hidden notes at stop 9 keep their stop 7 position. From stop 7
  to stop 9, 273 notes move (the shown ones); from stop 4 to stop 6, all
  1669. Without `#core` nothing after stop 8 changes.
- The fold report marks the rows of stops that are not shown with
  `(not shown)` at the end of the row, so the columns do not change, and
  lists `shown` under the table.
- Golden: `prepare` keeps `P`, `ext`, `names` and `labels` by stop of the
  model and adds `view.shown` (and `note.shown`). A slider value is a place.
  `span` gives the two shown stops around it; `frameAt`, `noteAlpha`,
  `bentMark`, `capMark` interpolate between them, and `countsAt`,
  `hiddenAt`, `ownerAt`, `unitBadges`, `stackCounts` read the stop at the
  nearest place (`stopAt`). `stopsOf` is the number of places. `buttonsOf`
  gives place, stop, label and name; the buttons show `place label`.
  `frameAt` also returns `a`, `b`, `k` (the stop at the nearest place) and
  `grid`; the UI uses `k` and `grid` where it compared the slider value
  with a stop (pitch colour at stop 0, the dimmer bars from stop 4, the
  beat grid and playhead to stop 2). `countsAt` returns `stop` (the place,
  for the "stop N: name" text) and `k`. A note without `shown` (one not made
  by `prepare`) shows every stop.
- The residue no longer dims on the way to stop 9 when stop 8 is not shown:
  the opacity goes from stop 7 to stop 9 directly.
- The "found" button changes only stop 8 and the cells stop. It is hidden
  when the slider does not show stop 8, and its title gives the place of
  stop 8 when it does.
- Tests: crux 635 before, 638 after (3 new; 4 changed: hidden notes keep
  their stop 7 position, and the stop 9 order of BWV 578). Golden 49
  before, 53 after. The older Golden tests fold with every stop shown
  (option `shown`), so their slider values are still stops of the model;
  4 new tests use the model's own list.

## Derived ladder (added 2026-11-17)

Status: built and tested, 2026-11-17. Change set 9. Not committed. Browser
check pending. See "Notes from the build (change set 9)".

### Purpose

Today the levels before the core are written by hand
(`// #core a nugb nugc nugd / nug`). The program already says which
definitions are made from the core. When the user names only the core, the
fold makes the levels.

Decision (Andy, 2026-11-17): `#core` with no slash derives the ladder. No
picker in the panel. Say it in the docs that a user reads.

### Directive and option

- `// #core nug` (names, no `/`): the names are the core, and the fold
  derives the levels before it.
- A value with a `/` is taken as written, as today. `// #core / nug` is the
  core alone, with no other level. Empty levels are dropped.
- Option `core`: an array of names (or a string with no `/`) derives; an
  array of arrays (or a string with `/`) is as written. `[]` is still
  "no core".
- Option `maxLevels` (default 4): the most levels before the core.

### The rule

Work at the cell level (as the core level does). The core notes are the
notes whose cell is a core entry, and the notes attached to them (the host
rule of the core level).

1. Ancestors. A definition is an ancestor when a core or attached note
   passed through it, outside the core definition.
2. Share. Of the notes that passed through a definition, the part that is
   core or attached. An ancestor with a share below 1/2 is not a level (a
   voice section holds the subject, but most of it is other material).
3. Wrappers. A definition is real when it writes a note of its own (a note
   whose cell-level owner is that definition), or when, going inward from
   it along its notes, the first real definitions (or cores) reached are
   two or more different ones. A definition that is not real is a wrapper:
   it shows nothing that the one real definition inside it does not show.
   Wrappers are not levels. (`ar` is `a` with a rhythm. `nugb`, `nugd`,
   `br` and `nugc` write no notes of their own at the cell level.)
4. Height. The height of a real ancestor is 1 plus the greatest height of
   the real ancestors inside it (0 when there are none; wrappers do not
   count).
5. Levels. One level for each height, the greatest height first, then the
   core. The names in a level are in source order. When there are more than
   `maxLevels` heights, keep the `maxLevels` nearest the core.

The derived levels are shape levels and a core level, built by the code
that builds written levels. Nothing else changes.

By hand, for BWV 578 with `// #core nug`, the real ancestors are `a`, `b`,
`d` (height 1) and `subject`, `nugp` (height 2), so the ladder is
`subject nugp / a b d / nug`. Check this against the build; report what the
rule gives.

### Data and report

- `inward.ladder = { derived, line }`. `line` is the directive value that
  gives the same levels when written out (`subject nugp / a b d / nug`), so
  a user can copy it into the program and change it. For a written ladder
  `derived` is false and `line` is the value as read.
- `fold-report.js` prints the line, and says when it was derived.
- Golden: no new control. If the panel has a place where it shows text
  about the program (the counts line), add the derived line there only if
  it fits without a layout change. If not, leave Golden as it is.

### Docs

Say how `#core` works, in plain words with the BWV 578 example, in each
place a user reads about directives or about the fold:

- crux: `README.md` and `GRAMMAR.md` where they list directives (if they
  do), the tutorial if it has a directive section, guide 1.6 and 1.8.
- The comment block of `examples/bach-bwv578.keylane.crux` and its library
  copy: keep the written ladder, and say in one or two lines that
  `// #core nug` alone would derive one. Use button names, not model stop
  numbers.
- disrupterbox: there is no user doc for the fold panel. Write
  `docs/crux-fold.md`, short: what the panel shows, the stops on the
  slider, `#theme`, `#core` (derived and written, `/ nug` for the core
  alone), what is hidden, the limits (only what the program states; a flat
  transcription has no ladder). Add one row for it to the documentation
  table in the project part of `CLAUDE.md` (below the FABLE-CORE END
  marker; do not touch anything above it). Mention it in `docs/golden.md`
  only if that file has a list of panels or of Crux features.

Plain, understated language. If `scripts/ste-lint.py` is there, run it on
the new doc.

### Change set 9

- [x] parse: no slash derives; `/ nug`; option forms; `maxLevels`
- [x] the rule: ancestors, share, wrappers, height, levels
- [x] `inward.ladder`, report
- [x] tests: a core inside one writer inside a combiner (two levels); a
      wrapper is skipped; an ancestor with a low share is left out;
      `maxLevels`; `/ A` gives the core alone; two cores; a written ladder
      is not changed; the derived `line`, written out, gives the same
      model
- [x] docs
- [x] rebuild; Golden tests

### Checks

- BWV 578 as it is (written ladder): the whole report is the same as
  before, but for the new ladder line.
- BWV 578 with `// #core nug` in place of the written line: report the
  ladder, each level's shapes, positions, shown and hidden notes. The core
  level keeps 210 core and 120 attached notes.
- crux 638 tests pass before; Golden 53.

### Notes from the build (change set 9)

- The rule is as written. BWV 578 with `// #core nug` gives
  `s6 p1 p3 p5 / subject nugp a4 / a b d / nug`, not the hand analysis
  `subject nugp / a b d / nug`. The hand analysis assumed that a voice
  section is mostly other material. Five are not: the pedal entries `p1`
  (share 0.83), `p3` (0.63) and `p5` (0.81) are `(ar, br, nugp)` and a few
  notes of their own; `s6` (0.62) holds `subject > [-4]`; `a4` (0.83) is
  `(ar \ 1) * [2]` and two notes. Each writes notes, so each is real. `p1`,
  `p3`, `p5` and `s6` hold `a`, `b`, `d` and `nugp` or `subject`: height 3.
  `a4` holds only `a`: height 2. Sections below 1/2: s1 0.38, s12 0.44,
  a1 0.47, t1 0.36, t5 0.42.
- Wrappers in BWV 578: `ar`, `nugb`, `br`, `nugc`, `nugd`. Real: `a`, `b`,
  `d` (height 1), `subject` (reaches `a`, `b`, `d`), `nugp` (writes
  `[1, -3]`; share 0.82; holds `b` through `nugc`), both height 2.
- BWV 578 derived: stop 9 `s6 p1 p3 p5`, 4 shapes, 180 positions, 180 shown,
  1489 hidden. Stop 10 `subject nugp a4`, 3 shapes, 64 positions, 278 shown,
  1391 hidden. Stop 11 `a b d`, 3 shapes (a x9, b x18, d x6), 28 positions,
  246 shown, 1423 hidden. Stop 12 `nug`, 4 positions, 210 core (33 bent, 12
  split), 120 attached (a 9, b 99, d 12), 1339 hidden: the same as the
  written ladder. The derived line written out gives the same model (source
  offsets aside).
- At `a b d`, 84 notes are hidden that the core level shows: the parts of
  the splits in `br` (36, attached) and `nugc` (36 attached, 12 core). A
  shape level reads the frames as written (analysePip with `named`), so a
  part of a split does not belong to `b` there; the rule reads the cell
  level. Not changed: "the derived levels are built by the
  code that builds written levels".
- Departures and readings:
  - Which frames a note passed through: the ref frames of its cell-level
    chain from its cell-level owner outward (for a part of a split, the chain
    through the replaced pip). Frames inside an edit that the cell level
    does not undo are not counted.
  - Wrappers: "going inward along its notes" walks all the notes through the
    definition, not only core and attached ones, and the realness of a
    definition is decided for any definition reached, not only ancestors.
  - Height counts only ancestors that are levels (share 1/2 or more, real),
    so no height is empty.
  - Source order: the place of the line `name =` in `trace.source`.
  - `inward.ladder.line` is rebuilt from the levels (names joined by a
    space, levels by ` / `), not copied from the directive. One level is
    written `/ nug`, so that writing the line out does not derive again.
    `inward.ladder` is null without `#core`.
  - Added: `inward.ladder.ancestors` (`{ name, share, real, height }`) when
    derived, and the report lists them under the ladder line. Without them
    the report cannot say why a definition is or is not a level.
- Other examples (core written at the top of a copy):
  - Invention 5, `// #core h`: `r3 r7 l6 / h`. `HH` (`h, [r], h * [1]`) is a
    wrapper. `SJ`, `AN` have share 0.39 (the rest of the subject is not
    `h`), so the levels are voice sections that are mostly `h`.
  - Invention 14 (v2), `// #core H`: `S r4 r6 r7 l6 l7 / T Tu Q r2 r5 l2 l5 /
    T9 X Y E U W V K / H`. Wrappers: `Hi`, `A`, `Y9`, `r1`, `l3`.
  - Invention 8, `// #core rn`: `l2 / S / b / rn`.
- Golden: no change but the rebuild and one comment. The bar has no place
  for the line without a layout change (the counts text is cut with an
  ellipsis). The stop text already gives the names of each level.
- Tests: crux 638 before, 647 after (9 new; 9 changed to the written form
  `// #core / A`, `{ core: [['A']] }`). Golden 53 before and after.


### After the build (main session, 2026-11-17)

The rule as planned gave `s6 p1 p3 p5 / subject nugp a4 / a b d / nug` for
BWV 578: voice passages that are mostly the subject became levels. Added
one rule: a definition that is used once is a passage and is not a level.
BWV 578 now gives `subject nugp / a b d / nug`. In a program that states
each shape once (the subject by itself), only definitions used twice are
levels.
