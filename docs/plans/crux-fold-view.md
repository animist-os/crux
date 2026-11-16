# Crux fold view

Status: plan, not started. Written 2026-11-16.

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

Each output pip gets an `origin`: a linked list of frames, innermost first.

```
{ kind: 'lit', pos }                          the literal pip
{ kind: 'ref', name, use, index, pos }        passed through definition `name`
{ kind: 'op',  op, arg, copy, index, exact }  passed through an operator
```

- `use` is a number unique to one evaluation of one reference, so all pips of
  one instance share it.
- `arg` is the right operand pip that applied (step and timeScale). `copy` is
  the fan index.
- `exact: true` means the operator keeps a one-to-one map from input pip to
  output pip, and the fold can undo it. First set: `*`, `.`, `m`, `||`, `^`,
  `:`, `,`.
- All other operators write one frame with `exact: false`. The view draws
  those pips as edited, and does not animate them.

Changes needed: `Ref` stores its source offset. `Pip.add`, `Pip.mul` and
`Pip.clone` carry `origin`. `Ref.eval` and the exact operators add frames
when the trace is on.

### 2. Fold model (crux repo, no DOM)

`src/fold/model.js`: `foldModel(trace)` returns plain data.

- `instances`: a tree per voice. Each node is a definition use or a run of
  literal pips, with its time span, pip range and transform chain.
- `notes`: for each sounding pip, its position `(time, step)` at stops 1 to 5.
  Stop 0 is the host's job, because pitch is the host's job. The host adds
  regime, tonic and key lane inflection to the stop 1 position.
- `dictionary`: one entry per distinct shape, with its count and its slot in
  the folded layout. Entries with count 1 and no parent definition are residue.
- `counts`: notes, shapes left at each stop, pips written.

### 3. Hosts

- Golden: a fold mode in the graphic Crux panel
  (`modules/golden/golden_graphic_crux_ui.js`). It reuses the lanes, colours
  and playhead of `CruxPipGraph`. Hover on a note or strip segment selects
  the source text in the editor.
- Wad: `wadCrux.fold(source, seed, globalsJSON)` in `wad-api.js` returns the
  model as JSON. The view is Swift. Planned in the Wad repo after the Golden
  host works.

## PR sequence

1. [ ] crux: trace. `crux_trace`, frames for `ref` and the exact operators,
   generic frame for the rest. Tests: for every file in `examples/`, the pips
   of `crux_trace` equal the pips of `crux_interp`. `crux_interp` output is
   unchanged.
2. [ ] crux: fold model. Test on the Invention 14 subject: 59 notes fold to
   25 pips. Six uses of the turn stack on one shape.
3. [ ] crux: `tools/fold-report.js` (text dump of the model for one program)
   and a section in `docs/crux-agent-guide.md`.
4. [ ] Golden: fold mode with roll, slider and counters. Check with
   `ui-verify`.
5. [ ] Golden: derivation strip and editor linking.
6. [ ] Wad: bundle rebuild, `wadCrux.fold`, Swift view (own plan).
7. [ ] Optional: near-miss ghost. For a literal mot that is close to a
   transform of a definition, overlay the strict transform and mark the
   notes that differ.

PRs 1 to 3 are in the crux repo. They add API and change no existing
behaviour. Wad gets them only when its bundle is rebuilt.

## Open questions

- Random choices: the trace needs a fixed seed, or the view changes on each
  run. Proposal: the model refuses unseeded programs, and the host offers to
  freeze the seeds.
- `_` global statements apply after the voices are evaluated. Proposal: one
  outer `op` frame per voice.
- Diads: one pip, several notes. Proposal: the notes move together.
- Where the folded dictionary sits: at the left of the roll (as in the
  sketch) or in its own panel.
