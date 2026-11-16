# Crux fold view

Status: PRs 1 to 3 done, PRs 4 and 5 implemented with the browser check
pending. Written 2026-11-16.

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
side by side in source order, in one layout for all voices. Two instances are
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

- Golden: a fold mode in the graphic Crux panel
  (`modules/golden/golden_graphic_crux_ui.js`). It reuses the lanes, colours
  and playhead of `CruxPipGraph`. Hover on a note or strip segment selects
  the source text in the editor.
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

## Open questions

- Decided (Andy, 2026-11-16): the fold model refuses programs with unseeded
  random choices. The host offers to freeze the seeds.
- Done as proposed: `_` global statements give one outer `op` frame per voice.
- Done as proposed: a diad is one note, and its notes move together.
- Where the folded dictionary sits: at the left of the roll (as in the
  sketch) or in its own panel. As built: in the roll. At stop 5 the voices
  merge into one lane and the entries sit side by side from the left.
