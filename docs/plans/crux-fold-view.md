# Crux fold view

Status: PRs 1 to 3 and 8 done. PRs 4, 5 and 9 implemented with the browser
check pending. Written 2026-11-16.

## Purpose

A visualizer that shows how little a Crux program writes compared with what
it plays. One control runs the algebra backwards. At each stop the notes move
to show one thing that Crux factors out.

| Stop | Removed | What moves |
|---|---|---|
| 0 | nothing | Notes as heard |
| 1 | key lane, tonic, regime | Notes go to plain scale steps |
| 2 | transposition (`*`, `.` step part) | Each instance goes to its own step 0 |
| 3 | mirror, reverse, stretch | Variants take the shape of their source |
| 4 | repetition | Equal instances stack on one copy, with a count |
| 5 | nesting | Definitions split into their parts. Only literal pips stay |

Two linked views support it:

- A derivation strip under the roll, on the same time axis. One row per
  nesting level. Same colour for the same definition. Literal pips show as
  the bottom row (the residue).
- Counters for sounding notes, shapes left, pips written, and the numbers
  from `tools/reduction-score.js`.

Audience: Andy while he reduces a piece. A teaching aid for new users is a
later use of the same model.

## Decisions (Andy, 2026-11-16)

- The core is portable and lives in the crux repo. Golden and Wad are hosts.
- Stop 1 holds key lane, tonic and regime together.

## What the interpreter gives today

- `src/index.js` is a tree-walking evaluator. Each AST class has `eval(env)`.
- `Ref.eval` is the one place where a definition is used. A macro (`=`) is
  evaluated again at each use. An `:=` binding returns the stored mot.
- A pip has `sourcePos`, the offset of the literal it started from.
  `Pip.add` and `Pip.mul` keep the left operand's `sourcePos` and drop the
  right operand's.
- AST nodes other than literal pips do not store a source position.

This is not enough for the fold. The fold needs, for each output pip, the
definitions and operators it went through.

## Design

### 1. Trace (crux repo, additive)

A new entry point, `golden.crux_trace(source)`. `crux_interp` keeps its
signature and its result. Without the trace, the evaluator does no extra work.

Each output pip gets an `origin`: a linked list of frames. `origin` is the
outermost frame and `frame.next` the next inner one, so pips share their inner
frames. `golden.crux_trace_frames(pip)` gives them innermost first.

```
{ kind: 'lit', pos, step, ts, tag }                the literal pip
{ kind: 'ref', name, use, index, pos }             passed through definition `name`
{ kind: 'op',  op, app, arg, copy, index, exact }  passed through an operator
```

- `use` is a number unique to one evaluation of one reference, so all pips of
  one instance share it.
- `arg` is the right operand pip that applied (step and timeScale). `copy` is
  the fan index.
- `app` is unique to one evaluation of one operator. `reverse: true` marks a
  fan copy played backwards.
- `exact: true` means the operator keeps a one-to-one map from input pip to
  output pip, and the fold can undo it. First set: `*`, `.`, `m`, `||`, `^`,
  `:`, `,`. `: N` with a number parses as `* [0, ...]` and writes a `*` frame.
  `.` with a subdividing right side is not one-to-one and writes a generic
  frame.
- All other operators write one frame with `exact: false`. A pip that goes
  through unchanged gets `kept: true` and the fold treats the frame as absent.
  A changed pip gets `out` (its value after the operator). The view draws
  those pips as edited.
- A `_` global statement writes an `op: '_'` frame. The frames of its
  operators sit outside it, so they are the outermost frames of each voice.

As built: `Ref` stores its source offset (one constructor argument). Nothing
else in the evaluator changes. `crux_trace` (in `src/fold/trace.js`) wraps the
evaluator's `eval` methods and `Pip.mul`, `Pip.expand` and `Pip.withDiad` for
the length of one call, and takes them away after. Each wrapped `eval` records
the results of the evaluations it makes directly, so an operator knows its
operands without re-evaluating them. `crux_interp` does no extra work.
`index.js` exposes its classes as `golden._cruxInternals` for this.
`Math.random` is wrapped too, which is how the trace knows that a program
used a random choice without a seed.

### 2. Fold model (crux repo, no DOM)

`src/fold/model.js`: `foldModel(trace)` returns plain data. `golden.crux_fold(source)`
is `foldModel(crux_trace(source))`.

A note's owner is the innermost definition it passed through. Frames inside
the owner are the definition's body and always apply. Frames outside it place
the instance, and the stops remove them: stop 2 the step part of `*`, `.` and
`m`, stop 3 all of them (mirror, `^`, timeScale parts, reverse). At stop 3
each instance's notes are laid out in the definition's own order and
durations, from the instance's start. At stop 4 each note moves to the first
instance of its dictionary entry in the same voice. At stop 5 the entries sit
side by side in source order, in one layout for all voices. From stop 5 on a
width compares the notes of one shape only: each entry is scaled so that its
most common duration is 1, and no note is wider than `capWidth` (4). A note
cut by the cap is marked. The later folds still match on written durations.
Two instances are
one entry if they have the same owner and the same shape at stop 3. A note
changed by an operator with `exact: false` is edited. Its owner is the
innermost definition outside that operator.

- `instances`: a tree per voice. Each node is a definition use or a run of
  literal pips, with its time span, pip range and transform chain.
- `notes`: for each sounding pip, its position `(time, step)` at stops 1 to 5.
  Stop 0 is the host's job, because pitch is the host's job. The host adds
  regime, tonic and key lane inflection to the stop 1 position.
- `dictionary`: one entry per distinct shape, with its count and its slot in
  the folded layout. Entries with count 1 and no parent definition are residue.
- `counts`: notes, shapes and note positions left at each stop, pips written
  (positions at stop 5), leverage (notes per pip written).

### 3. Hosts

- Golden: as first built, a fold mode in the graphic Crux panel. Since part
  2, its own panel, `GoldenCruxFoldPanel` (`golden_crux_fold_panel.js`, spawn
  key `CruxFold`), which inherits `GoldenCruxPanel`. The view sits above the
  panel, as the ribbon does on the graphic panel. Hover on a note or strip
  segment selects the source text in the editor.
- Wad: `wadCrux.fold(source, seed, globalsJSON)` in `wad-api.js` returns the
  model as JSON. The view is Swift. Planned in the Wad repo after the Golden
  host works.

## PR sequence

1. [x] crux: trace. `crux_trace`, frames for `ref` and the exact operators,
   generic frame for the rest. Tests: for every file in `examples/`, the pips
   of `crux_trace` equal the pips of `crux_interp`. `crux_interp` output is
   unchanged.
2. [x] crux: fold model. Test on the Invention 14 subject: 59 notes fold to
   25 pips. Six uses of the turn stack on one shape.
3. [x] crux: `tools/fold-report.js` (text dump of the model for one program)
   and a section in `docs/crux-agent-guide.md`.
4. [~] Golden: fold mode with roll, slider and counters. Check with
   `ui-verify`. Implemented, browser check pending. Core in
   `modules/golden/golden_crux_fold.js` (node test next to it), view in
   `golden_crux_fold_ui.js`, a `fold` button on the ribbon.
5. [~] Golden: derivation strip and editor linking. Implemented, browser
   check pending.
6. [ ] Wad: bundle rebuild, `wadCrux.fold`, Swift view (own plan).
7. [ ] Optional: near-miss ghost. For a literal mot that is close to a
   transform of a definition, overlay the strict transform and mark the
   notes that differ.

PRs 1 to 3 are in the crux repo. They add API and change no existing
behaviour. Wad gets them only when its bundle is rebuilt.

## Later folds (added 2026-11-16)

Stops 1 to 5 undo only what the program states. On Invention 14 (v2) 96 note
positions are left at stop 5, and half of them are literal runs inside the
passages. Three more stops let the fold find relations that the program does
not state. They are analysis, so they live in the core (`src/fold/`).

| Stop | Removed | Rule |
|---|---|---|
| 6 | unstated exact repeats | Among the literal runs left at stop 5, find sub-runs that are equal under transpose, mirror, reverse and uniform stretch. Bit cost is ignored. Equal sub-runs stack on one copy. |
| 7 | near-misses | Match each run that is still alone to the closest transform of a theme cell. A match can have a few bent notes. Matched notes move onto the theme. A bent note keeps its offset as a mark. |
| 8 | all but the themes | Only theme cells stay. Notes that no theme explains go to a dimmed residue group. |

Decisions (Andy, 2026-11-16):

- Themes for stops 7 and 8 are the program's own definitions. Picking themes
  by hand comes later.
- A stop that separates rhythm from pitch is set aside for now.
- The fold view gets its own panel in Golden. It does not share the graphic
  Crux panel.

Rules to start from. They are a first attempt, to be tuned on real pieces:

- Stop 6: `minLength` option for the shortest sub-run that can fold, default
  3 notes. Longest and most frequent first. A note belongs to one sub-run.
- Stop 7: rhythm must match up to uniform stretch. At least half of the notes
  must match exactly. At most 1 bent note for runs of 4 notes or fewer, at
  most 2 for longer runs. A run can match a contiguous part of a theme.
- Stop 8: a theme is a program definition whose own literal run has 3 notes
  or more and that did not fold onto another theme at stop 6 or 7.
- `counts.explained` reports, for stop 8: notes explained by the program
  (stops 1 to 5), by found repeats (6), by near-misses (7), and not explained.

Model changes: `stops` and each note's `pos` grow to index 8. Stops 1 to 5
keep their values. Notes get `bent` (step offset, or 0) and `explainedBy`.

Rules as built (`src/fold/thematic.js`), after a first run on Invention 14:

- The unit of work is the stop 5 slot: one literal pip of one dictionary
  entry. Every note on a slot moves with it.
- A run is a sequence of slots of one entry that are next to each other in
  the source. A rest breaks a run, and so does a definition use between two
  literals.
- Stated: a definition used more than once. Its notes are explained by the
  program. A passage (a definition used once) is not stated.
- Changed, stop 6: a stated definition moves only as a whole run. A part of
  one can be the copy that stays, and it counts as an occurrence, but the
  fold does not cut the program's own cells apart. Without this rule, three
  notes of B's arpeggio moved onto a figure of thirds in N.
- Changed, stop 6: a shape of 3 notes needs 3 occurrences, or a mover that is
  a whole stated definition. Without this rule, r3 and l1 matched as a
  3-note retrograde inversion, which hid that l1 is B with one note bent.
- The copy that stays is in the most used stated definition, else the first.
- Changed, stop 7: a run of 3 notes needs an exact match (no bent note). With
  1 bent note out of 3, nearly any 3-note run matches some theme.
- Stop 7 ranks matches by exact notes, then by length, then by fewest bent
  notes. Exact matches of 3 notes against a theme are allowed here.
- Changed, stop 8: a theme must be stated, so passages are never themes.
- Added, stop 8: a stated cell that keeps fewer than 3 pips (for example the
  last note of T = T9, [2]) joins the theme next to it inside its own
  definition, in that theme's frame. T, Tu and the two edited notes of A sit
  after T9 as other endings. E, U, W, K and Q sit around H. A cell with no
  theme next to it (G) stays as its own small group.
- Found shapes whose kept copy is not in a theme stay as their own group at
  stop 8.

Second round (2026-11-16, after Andy saw it in the browser: stops 5 to 8 drew
about the same number of pips, 96, 82, 63, 62 on v2):

- Added, stop 7: themes fold onto themes. Theme cells (3 or more slots of a
  stated entry, next to each other, still in place) are ranked by the notes
  that land on them. Each tries to fold onto a cell ranked above it that is
  still a theme, by the near-miss rules. The match must cover all of the
  target, or all but one note of the theme that folds. A shared triad or
  three notes of a scale is not enough: without this rule B folded onto N
  through [-7, -5, -3]. A theme that folds stops being a theme. Its notes
  count as near-misses (repeats when exact).
- Added, stop 7: no note bends by more than 2 steps (a third). Without it a
  match bent an octave leap by 5 steps.
- Changed, stop 7: a run of 4 notes can have 2 bent notes when the durations
  are equal (no stretch). Approved by Andy. It catches r3 as a B variant.
- Added, stop 7: a single note left at the edge of a repeat or a near-miss
  joins it as a bent note, when the target has a note there with the same
  rhythm, that note is itself explained, and the match stays within the bent
  limits. Approved by Andy. On v2 no note qualifies: the candidates (l7's -8,
  r4's -2) bend by more than 2 steps.
- Changed, stop 7: it always needs 3 or more notes, whatever `minLength` is.
- Changed, stop 7: on a tie between transpositions, the smallest one.
- Changed, stop 8: each theme shows its own run only. A short stated cell
  stacks on one note of the theme next to it: its place in the theme's frame,
  then the theme note nearest in time, then nearest in step. So an ending
  stacks on the last note, a lead-in on the first. The notes of a theme that
  folded and that are left over stack on the nearest matched note. The model
  lists these as `attached` (owner and notes) for each theme.
- Changed, stop 8: the residue is one marker, one position at step 0. Notes
  no theme explains go there, and so do stated cells with no theme next to
  them (G on v2), which stay explained by the program.
  `counts.positions[8]` is the theme positions plus 1 for the marker.
- Known limit: a bare top-level literal with no operator gives each pip its
  own entry at stop 5, so stop 6 sees no runs in it. Wrap a passage in a
  definition.

## PR sequence, part 2

8. [x] crux: stops 6 to 8 in the fold model, with tests. `fold-report.js`
   prints the new stops and the explained counts.
9. [~] Golden: own panel for the fold view. Remove the hook from
   `golden_graphic_crux_ui.js`. Slider to stop 8, bent marks, residue group,
   explained counts. Implemented, browser check pending. The Crux panel menu
   has "Open in Fold Panel" (it copies the editor text, and does not run it).

## Open questions

- Decided (Andy, 2026-11-16): the fold model refuses programs with unseeded
  random choices. The host offers to freeze the seeds.
- Done as proposed: `_` global statements give one outer `op` frame per voice.
- Done as proposed: a diad is one note, and its notes move together.
- Where the folded dictionary sits: at the left of the roll (as in the
  sketch) or in its own panel. As built: in the roll. At stop 5 the voices
  merge into one lane and the entries sit side by side from the left.
