# Crux: a guide for agents

One file with what an agent needs to read, write and check Crux. It is
self-contained: copy it into any project that uses Crux.

- Part 1 is the language. It is the same everywhere.
- Part 2 is what a host does with the result. Pitch, tempo and sound are the
  host's job, not the language's.
- Parts 3 and 4 are the two hosts that exist: Golden (web) and Wad (macOS).
- Part 5 is how to work: transcribing, reducing, verifying, scoring.

Full grammar: `GRAMMAR.md` in the Crux repo (github.com/animist-os/crux).
Every example below was run through the interpreter on 2026-11-16.

## 1. The language

### 1.1 Vocabulary

| Word | Meaning |
|---|---|
| **pip** | One event: a `step` (a number), a `timeScale` (a duration factor, default 1) and an optional tag. |
| **mot** | An ordered list of pips, played one after another. Every expression evaluates to a mot. |
| **section** | One voice. Sections are separated by `!` and play together. |
| **program** | Definitions plus one or more sections. Its value is one mot per section. |
| **fan** | An operator that applies the left mot once per right value and concatenates. Lengths multiply. |
| **cog** | An operator that pairs positions. The right side cycles. The length stays that of the left side. |

A step is a relative pitch position, usually a scale degree. Crux does not know
what key or scale it is in. A timeScale is relative too: 1 is whatever unit
the host sets.

### 1.2 Syntax rules that cause most errors

- **One statement per line.** An expression cannot continue on the next line.
  For a long voice, define parts on separate lines and join them:
  `r1, r2, r3`.
- **`;` also ends a statement, even inside a `//` comment.** `[0, 1] // a; [9]`
  evaluates to `[9]`. Never put `;` in a comment.
- **Comments** start with `//` and run to the end of the line (or to a `;`).
- **Concatenation needs a comma.** `[0, 1], [2]`. Two mots side by side with a
  space is a syntax error.
- **`[1/4]` is a step of one quarter, not a duration.** A duration needs a
  pipe: `[1 | 1/4]` or `[1 | /4]`.
- **The value of a section is its last expression statement.** Earlier
  expression statements are discarded.
- **Names**: a single letter, or a letter or `_` followed by letters, digits or
  `_`. A bare `_` is reserved. An unknown name is an error. The letters
  `c f g j l m p r t z` are also operators and `r` is the rest, so prefer
  upper-case or longer names.
- **Parenthesise operator expressions inside a concatenation**:
  `A, (B * [2]), C`.

### 1.3 Pips and mots

```
[0, 1, 2]              three pips, timeScale 1 each
[0 | 2, 1 | 1/2]       timeScales 2 and 0.5
[0 | /4]               timeScale 1/4
[r]   [r | 2]          a rest; a rest of length 2
[0 -> 3]               range: [0, 1, 2, 3]
[0: 3, 1]              repeat a value inside a mot: [0, 0, 0, 1]
[0 & 4, 2]             diad: steps 0 and 4 sound together, then 2
[7/2]                  fractional step 3.5 (see half steps, 2.3)
[{0, 2, 5}]            random choice;  [{1 -> 6}] random integer
[{0, 2, 5}$beef]       seeded choice, the same every run
[[0, 1, 2]]/           nested mot, subdivided: three pips of 1/3
```

### 1.4 Programs, definitions, voices

```
A = [0, 2]             macro: the expression is substituted where A is used
B := [{0, 5}, 1]       evaluated once now; every use of B is the same mot
splay = *              operator alias

A * [0, 1]             voice 1  -> [0, 2, 1, 3]
!2                     next voice enters at time 2 (a leading rest)
A                      voice 2  -> [r | 2, 0, 2]
```

- `!` alone starts a voice at time 0. `!N` starts it at absolute time N.
- Definitions are shared by all sections.
- `_` means "each voice's output". A statement that contains `_` is applied to
  every voice after evaluation and adds no voice: `_ . [10]` transposes all
  voices by 10. Write `_ t`, not `_t`.

### 1.5 Operators

Postfix operators bind tightest, then binary operators (all left-associative),
then `,`, then assignment. When in doubt, add parentheses.

| Operator | Example | Result |
|---|---|---|
| `,` concatenate | `[0, 1], [2 \| 1/2, r]` | `[0, 1, 2 \| 1/2, r]` |
| `: N` repeat | `[0, 1, 2] : 2` | `[0, 1, 2, 0, 1, 2]` |
| `*` fan add (transpose) | `[0, 1, 2] * [0, 3]` | `[0, 1, 2, 3, 4, 5]` |
| `*` with negative timeScale (reverse) | `[0, 1, 2] * [0 \| -1]` | `[2, 1, 0]` |
| `*` with a timeScale (stretch) | `[0, 1, 2] * [0 \| 2]` | `[0 \| 2, 1 \| 2, 2 \| 2]` |
| `^` fan multiply steps | `[0, 1, 2] ^ [2]` | `[0, 2, 4]` |
| `.` cog add | `[0, 1, 2, 3] . [10, 20]` | `[10, 21, 12, 23]` |
| `m` mirror about a step | `[0, 2, 4] m [2]` | `[4, 2, 0]` |
| `\|\|` scale all durations | `[0, 1, 2] \|\| [1/2]` | three pips of 1/2 |
| `>` delay / trim | `[0, 1, 2] > [1]` | `[r, 0, 1, 2]` |
| `~` rotate | `[0, 1, 2, 3] ~ [1]` | `[1, 2, 3, 0]` |
| `\ N` drop from the end | `[0, 1, 2, 3] \ 1` | `[0, 1, 2]` |
| `c` keep by mask | `[0, 1, 2, 3] c [1, 0, 1, 0]` | `[0, 2]` |
| `f` fold (palindrome) | `[0, 1, 2] f [0]` | `[0, 1, 2, 2, 1, 0]` |
| `->` steps | `[0, 3] -> [2]` | `[0, 3, 1, 4, 2, 5]` |
| `j` jam (replace) | `[0, 1, 2, 3] j [0, 7]` | `[0, 0, 0, 0, 7, 7, 7, 7]` |
| `.j` cog jam (apply a rhythm) | `[0, 1, 2, 3] .j [\|, \| /2]` | `[0, 1 \| 1/2, 2, 3 \| 1/2]` |
| `@` edit at an index | `[0 -> 5] @ [@2 -7]` | `[0, 1, -5, 3, 4, 5]` |
| `t` tie equal neighbours | `[0, 0, 1]t` | `[0 \| 2, 1]` |
| `/` subdivide | `[[0, 1, 2]]/` | three pips of 1/3 |

Also available, see `GRAMMAR.md`: `.^`, `.,`, `.m`, `.l`, `.t`, `.c`, `.->`,
`.~`, `l` (lens), `g` and `r` (Glass and Reich patterns), `p` (Pärt), `z` (zip).

Facts worth remembering:

- With `*` and `.`, steps add and timeScales multiply. `A * [3]` is "A a
  fourth higher" in a seven-note scale. `A * [0, -1, -2]` is a falling sequence.
- Inversion is `A m [0]`, then transpose: `(A m [0]) * [4]`.
- There is no slice operator. Use
  `\ N`, `c` with a mask, or define the fragment by itself.
- A rhythm can be kept apart from pitches: `R = T ^ [0]` gives T's durations
  on step 0, and `[5, 6, 7] . R` puts new pitches on that rhythm.

### 1.6 Directives

A line `// #name value` is a directive. The parser treats it as a comment and
returns it beside the result. Any name is allowed. The host decides what it
means.

- If the value has two or more tokens and the last is a positive integer, the
  directive is scoped to that sampler: `// #preset Marimba 2`.
- `// #target SECTION SAMPLER` routes a section to a sampler.
- The last directive of a name wins.
- The fold view reads two global directives: `// #theme A B` (the themes of
  stops 6 to 8) and `// #core` (the focus levels, stops 9 and on). Both take
  definition names. `// #core nug` (names, no `/`) names the core, and the
  fold derives the levels before it (1.8, derived ladder). With a `/` the
  levels are as written and the last is the core: `// #core a nugb / nug`.
  `// #core / nug` is the core alone.
  By the rule above, a list whose last token is a positive integer is scoped
  to a sampler, and the fold does not see it. Definition names start with a
  letter, so this does not happen with names and `/` only.

### 1.7 Calling the interpreter

```js
const golden = require('./dist/crux.cjs');      // needs ohm-js
const result = golden.crux_interp(source);
```

`result.sections[i].values` is the list of pips of voice i. Each pip has
`step`, `timeScale`, `tag` (`'r'` for a rest, else null), `diad` (extra steps
or null) and `sourcePos`. The result also has `directives` (name to string),
`routing` (section to sampler, default N to N) and `samplers`. A syntax error
throws with "Line L, col C".

In ES modules: `import './src/index.js'` then `globalThis.golden.crux_interp`.

To share definitions between programs, a host can pass bindings in:

```js
const env = golden.crux_env('A = [0, 1, 2]');        // a Map of the source's bindings
const result = golden.crux_interp('A * [0, 7]', env); // A resolves from env
```

`crux_env(source, seedEnv)` evaluates a source for its assignments only and
returns the environment. `crux_interp(source, seedEnv)` copies `seedEnv`, so
the program's own assignments win and the caller's map is not changed. With no
`seedEnv`, `crux_interp` behaves as before. Lup's global Crux panel uses this.

### 1.8 Trace and fold

`golden.crux_trace(source)` returns the `crux_interp` result, with two more
fields (`trace: true`, `unseededRandom`) and an `origin` on each pip.
`crux_interp` itself is not changed. The code is in `src/fold/trace.js`.

`origin` is the outermost frame of a linked list. `frame.next` is the next
inner frame. `golden.crux_trace_frames(pip)` gives the frames as an array,
innermost first. The innermost frame is the literal, or an operator that made
a new pip from nothing the trace can follow.

```
{ kind: 'lit', pos, step, ts, tag }               the literal pip
{ kind: 'ref', name, use, index, pos }            passed through definition `name`
{ kind: 'op', op, app, copy, index, arg, exact }  passed through an operator
```

- `pos` is an offset in the source. For a reference it is the name at the
  place of use.
- `use` is the same for all pips of one evaluation of one reference. A macro
  used twice gives two `use` values. `app` does the same for one evaluation of
  an operator.
- `index` is the pip's place in the operand (op) or in the definition's value
  (ref). `copy` is the fan copy. `arg` is the right-hand pip that applied
  (`{ step, ts }`). `reverse: true` marks a copy played backwards.
- `exact: true` for `*`, `^`, `.`, `m`, `||`, `,` and `:` with a random count.
  `: N` with a number is `* [0, ...]` and writes a `*` frame. The fold can undo
  these.
- Every other operator writes one frame with `exact: false`. If the pip went
  through unchanged, the frame has `kept: true`. If not, it has `out`, the
  pip's step and timeScale after the operator.
- `@` only: a run of new pips (no operand index) between two pips whose
  operand index is known, or an end of the mot, took the place of the operand
  pips in the same gap. When the gap holds exactly one operand pip, each pip
  of the run has `from: { origin, index, part, parts }` on its `@` frame: the
  origin and index of the operand pip it replaced, its place in the run (from
  0) and the length of the run. `index` stays -1 and `next` does not change.
  `X @ [@5 [4, 3]/]` gives two pips with `from.index` 5. Two splits side by
  side (`@1 ..., @2 ...`) are one run over two operand pips: no `from`.
- A `_` global statement adds an `op: '_'` frame, with the frames of its
  operators outside it.

`golden.crux_fold(source)` (or `golden.crux_fold_model(trace)`, from
`src/fold/model.js`) turns a trace into plain data for a viewer. It throws if
the program has random choices without a seed.

- `notes`: one per sounding pip. `pos[1]` to `pos[5]` are `{ t, step, d }` at
  stops 1 to 5. Stop 0 is the host's: it adds regime, tonic and key lane to
  stop 1. `owner` is the innermost definition the note came through. `entry`
  is its dictionary entry, `instance` its instance, `litPos` and `refPos` are
  source offsets. A diad is one note with `diad` offsets.
- The stops: 1 scale steps; 2 transposition removed; 3 mirror, reverse and
  stretch removed; 4 equal instances stacked on the first in the voice; 5 one
  copy of each shape, side by side in source order (one layout for all voices).
- Widths from stop 5 on: `d` compares the notes of one shape only. Each shape
  is scaled so that its most common duration is 1, and no note is wider than
  `capWidth` (default 4, an option of `crux_fold`). A note cut by the cap has
  `capped: true` in that `pos`. Stops 1 to 4 keep the durations as played or
  as written. `dictionary[].slot.unit` is the written duration that became 1.
- `dictionary`: one entry per distinct shape, with `count`, `pips`, `slot`
  (stop 5 position) and `residue` (no definition, used once).
- `instances`: one tree per voice. Nodes are definition uses (`ref`),
  operator copies (`op`) and runs of literal pips (`lit`), each with a time
  span, a pip range and `level` (the number of definitions above it).
- `counts`: `notes`, `pipsWritten`, `leverage`, and `shapes` and `positions`
  per stop. `explained` gives `program`, `repeat`, `near` and `none`.

A note changed by an operator with `exact: false` is `edited`. Its owner is
the innermost definition outside that operator.

Stops 6 to 8 (`src/fold/thematic.js`) find what the program does not state.
They are analysis, and their rules will change.

They work at the theme level, not on the innermost definitions of stop 5:

- A definition that is never used by itself goes to the definition around it
  (if that one is used 3 times or more). A definition that is used mostly
  inside one larger definition goes to that one. So a subject built from
  small cells is one shape. A definition that is used freely (a turn that is
  in many themes) stays a shape by itself, and so does a shape under an
  operator that makes a sequence of it (`D * [4, 2, 0]`).
- `// #theme subject CS` in the program picks the themes by hand. So does the
  option `themes: ['subject', 'CS']`. The outermost named definition that a
  note passed through owns it.
- Each note has `theme`, the id of its shape at this level.

- 6: sub-runs of the stop 5 literal runs that are equal under transpose,
  mirror, reverse and uniform stretch stack on one copy (`minLength`, default
  3). A rest breaks a run.
- 7: a run that is still alone moves onto a part of a definition's own run
  when the rhythm matches and only a few notes differ, by 2 steps at most.
  Those notes keep their step offset in `bent`. Then themes fold onto themes
  by the same rules.
- 8: only themes stay, each as its own run (stated definitions that keep 3 or
  more of their own pips). Short stated cells stack on a theme note. The rest
  stacks on one residue marker.
  Repeats that stop 6 found outside the themes go to the residue too. The
  option `showFound: true` keeps them as units.
- A theme folds onto another theme (stop 7) on a match of 5 notes or more
  (`foldLength`) with one bent note at most. A shorter match must be exact
  and must be all of both themes.
- Each note gets `pos[6]` to `pos[8]`, `bent`, `explainedBy` (`'program'`,
  `'repeat'`, `'near'` or `null`) and `fold8` (where it sits at stop 8:
  `theme`, `found`, `attached` or `residue`). `thematic` lists the found
  repeats, the near-misses, the theme folds, the layout units of stops 6 to 8
  with their note counts, the themes with their attachments, and the residue.

After stop 8 there is one stop for each focus level of `// #core` (stops 9
and on): the levels as written, or the core and the levels derived from it.
Without `#core` there is one stop, 9, cells. The option `core` of
`crux_fold` wins over the directive: a string is read as the directive, an
array of names is the core and derives (as a value with no `/`), an array of
arrays is as written, and `[]` turns the directive off. The option
`maxLevels` (default 4) is the most derived levels before the core. The model has `9 + levels`
stops with `#core`, and 10 without.

The stops of the model and the stops a host shows are not the same list.
The model keeps every stop: `pos[k]`, `stops[k]` and the counts are steps of
the analysis, and later steps read earlier ones. `shown` lists the stops
that a host's slider shows, in order:

- Stop 5 (nesting) is never shown.
- Stop 8 (themes) is shown only when the program has no `#core` level.
- Every other stop is shown.

So BWV 578 with `#core` has 11 stops and `shown` `[0, 1, 2, 3, 4, 6, 7, 9,
10]`; without `#core` (or with `core: []`) it has 10 stops and `shown` `[0,
1, 2, 3, 4, 6, 7, 8, 9]`. The option `shown` of `crux_fold` (an array of
stop numbers) replaces the rule. Numbers the model does not have are left
out, the rest are sorted, and stop 0 is always first. A host numbers its
buttons by place in `shown`, so the numbers on screen have no holes, and
moves a note from `pos[shown[i]]` to `pos[shown[i + 1]]`.

"The stop before" a stop k after 8 is the last stop in `shown` under k, not
k - 1. So no note passes through the layout of a stop that is not shown.
With `#core` the first level comes after stop 7.

Every stop after 8 lays its shapes out in the order they had at the stop
before. The key of a shape is the smallest x of its notes that are shown at
the stop before; when the stop before is 8, a note on the residue marker
does not count, unless the shape has no other notes. Ties keep source order.

The cell level. A partial statement (`A \ 1`) joins the full entry of its
definition, and an edited statement (`A @ [@1 5]`) stays with the definition
as a bent note when the operator kept the duration, made one pip from one
pip, and the frames inside it lead to a literal through a definition.
`cellBent` is the bend in the definition's own frame (an operator such as
`m` between the definition and the edit changes its sign). The bend has no
limit: the program states it. An edit that changes a duration stays edited.

- Splits: a pip with `from` (`X @ [@5 [4, 3]/]`) is analysed as the pip it
  replaced (the frames of `from.origin`, the `@` as a kept frame, then the
  frames outside), and takes that pip's owner, canon and body. The parts of
  one split are one slot of the entry, with the replaced pip's width. Each
  part has `split: { part, parts }` and a `cellBent`: its step less the
  replaced pip's step at the `@`, in the owner's frame, plus the replaced
  pip's own bend. This holds when the parts' durations add up to the
  replaced pip's duration and the replaced pip has an owner inside the `@`;
  if not, the parts stay edited. A part that a later `@` splits again
  follows the same rule; `split` then describes the innermost `@`. A run of
  one pip (`parts: 1`) is a replacement: it is bent, with no `split`.
- Each note gets `cell` (its own cell-level entry) and `cellBent` (0 when
  not bent). `edited` does not change: it describes stops 3 to 5.
  `counts.cellEdited` counts the notes still edited at the cell level,
  `counts.cellBent` the bent notes that are not parts of a split, and
  `counts.cellSplit` the parts of a split.

The cells stop (stop 9, only without `#core`) opens the themes of stop 8 to
the cell level.

- `fold8.rep` is the id of a note of the slot a note sits on at stop 8: the
  theme's (or found shape's) own note there. It is `null` on the residue.
- A note on a theme goes to the cell-level place of its `rep` note. Only the
  entries that a theme reaches are shown. Attached cells go with their theme
  note. Found units (`showFound`) keep their stop 8 layout. The residue
  marker stays one position and comes last.
- A bent note stacks on its cell note, as at stops 7 and 8. The bend is a
  mark, not a position.
- Place: a shape starts at its key when there is room, and otherwise right
  after the shape before it (the stop 5 gap). So a shape that does not
  change stays where it is, and the shapes to the right of a theme that gets
  smaller do not slide. The residue marker stays at its stop 8 place when
  there is room.
- With no theme at stop 8, every note opens in place: all the entries, and
  no residue marker.
- Kinds: `cell`, `found` or `residue`.

Focus levels are structure that the analysis is about, named by hand or
derived from the core. `// #core a nugb nugc nugd / nug` names two levels,
one stop each, in order. The levels use only what the program states. They do not search for
other matches.

- A level before the last shows whole definitions, as written. A note
  belongs to the outermost named definition of the level that it passed
  through, so a named definition inside another named one of the level
  belongs to the outer one there. The entries come from the same rules as
  stop 5 (transposition, mirror, reverse and stretch removed, widths by the
  stop 5 rule), with the partial rule of the cell level: a partial
  statement (`ar \ 1`) joins its full entry. Kind: `shape`.
- The last level is the core. A core is a cell-level entry of a named
  definition. Kinds:
  - `core`: its `cell` is a core entry. It sits on its own slot of that
    entry. Bent notes and parts of a split are core notes.
  - `attached`: a note that is not a core note, written by the host of a
    core statement. From the core definition go outward: the first
    definition use whose definition writes notes of its own (is the
    cell-level owner of some note) is the host. A definition between them
    that writes no notes is passed. The note stacks on the core note of the
    same host use that is nearest in time (the earlier one on a tie), and
    adds no position. `focus[i].host` is the host's name.
- At every focus level a note that belongs to no named shape is `hidden`.
  It keeps its position of the stop before (stop 7 at the first level, by
  the rule), with `pos[k].hidden` true.
  Hosts fade it out on the way to the stop and draw nothing for it there.
  There is no residue marker. Counts at these stops do not count hidden
  notes.
- The themes of stop 8 play no part (the stop before the first level is 7,
  unless the option `shown` has 8). A core note that no theme reaches is
  still a core note.
- A name with no note in a shape level, or with no cell-level entry in the
  core level (a definition that writes no note of its own, such as `nugb`),
  is listed in `missing` for that level. A level whose names are all
  missing hides every note.
- Place: the shapes of a level are packed side by side from 0, with the
  stop 5 gap, in the order above.

The derived ladder (`// #core nug`, no `/`). The levels before the core
come from the definitions around it, at the cell level. The core notes and
the notes attached to them are those of the core level.

1. An ancestor is a definition that a core or attached note passed through,
   outside the core definition: the ref frames of the note's chain from its
   cell-level owner outward.
2. Share: of the notes that passed through it, the part that is core or
   attached. An ancestor with a share below 1/2 is not a level.
3. A definition is real when it writes a note of its own (it is a note's
   cell-level owner), or when, going inward from it along its notes, the
   first real definitions or cores reached are two or more different ones.
   Otherwise it is a wrapper (`ar` is `a` with a rhythm; `nugb`, `br`,
   `nugc`, `nugd` write no notes of their own at the cell level), and not a
   level.
4. A definition that is used once is a passage, not a shape that returns,
   and is not a level.
5. The height of a level ancestor is 1 plus the greatest height of the level
   ancestors inside it, or 1 when there are none.
6. One level for each height, the greatest first, then the core. Names in
   source order (the line `name =`). Past `maxLevels` heights, the ones
   nearest the core are kept.

The derived levels are built as written levels are. BWV 578 with `// #core
nug` gives `subject nugp / a b d / nug`. The pedal entries `p1`, `p3`,
`p5`, the soprano passage `s6` and the alto passage `a4` hold the subject or
part of it, and more than half of their notes are core or attached, but each
is used once, so rule 4 leaves them out. The core level is the same as with the written
line. A shape level reads the program as written, not at the cell level, so
it hides the parts of a split made outside the named definition (BWV 578 at
`a b d`: 84 notes that the core level shows).

`inward.ladder` is `{ derived, line }`, and `ancestors` when derived: `{
name, share, real, height }` for each ancestor, in source order (`height` is
null for one that is not a level). `line` is the directive value that gives
the same levels written out, `/ nug` for the core alone. Without `#core` it
is null.

One structure describes every stop after 8. Each note gets `pos[9 + i]` and
`focus[i] = { kind, unit, entry, host }` for level i (`unit`, `entry` and
`host` are null when they do not apply). `inward.levels[i]` is `{ names,
missing, kind: 'cells' | 'shapes' | 'core', units, shown, attached, hidden }`,
with the units in layout order; each unit has `x`, `width`, `positions`,
`notes` and (core) `attached`. `inward.themed` is false when stop 8 has no
theme. `stops[9 + i]` is the names of the level joined by a space, or
`cells`. `counts.core` is `{ stated, bent, split, attached, hidden }` for the
core level (`stated` counts all core notes; `bent` and `split` are parts of
it), or `null` without `#core`.

`node tools/fold-report.js program.crux [--min-length N]` prints the model as
text. Its stop table has every stop of the model, marks the stops that are
not shown, and lists `shown`. Under it is the `ladder` line, as written or
derived, and for a derived ladder each ancestor with its share, whether it
is real or a wrapper, and its height.

## 2. What a host must decide

Crux gives steps and timeScales. A host turns them into notes.

### 2.1 Time

timeScale 1 is one host unit. Both hosts use `// #quanta` with Tone.js note
values (`4n` a quarter, `8n` an eighth). Without the directive, Wad uses `8n`
and Golden's renderer falls back to `8n`. Set it in every program.

### 2.2 Pitch

Both hosts map an integer step to a pitch through a pitch regime (a scale) and
a tonic: pitch = 48 + tonic + regime(step). `// #pitchRegime Major`,
`// #tonic 10` (taken mod 12). Step 7 is the tonic an octave up in a
seven-note regime.

In Golden, `#pitchRegime` also takes a custom scale: semitones above the
tonic, ascending, from 0 to 11, such as `// #pitchRegime 0 1 3 5 6 8 11`.
Wad reads it too (0.6.5).

`#scaleDeformation` was removed from Golden in November 2026. Golden ignores
it and logs one warning. Use a key lane, a half step or a custom scale.

### 2.3 Chromatic notes

There are two mechanisms. Know which one a file uses.

| Mechanism | Where | Status |
|---|---|---|
| **Half step** | In the voice. `k + 1/2` means degree k raised a semitone. `7/2` is F-sharp in C major. | A convention of the score converter. Golden and Wad (0.6.5) play it as the degree below raised a semitone, added on top of any key lane. |
| **Key lane** | A `// #keyLane` directive. Voices keep integer steps. A note mark in the lane (`32:2 #6`) gives one note its accidental. | Golden (3.4) and Wad (4.3). Wad does not read `~` keys or note marks yet. |

The design intent: voices hold plain scale steps, so one mot can be transposed
and reused. Inflection is applied afterwards, like the tonic.

## 3. Golden (web, in disrupterbox)

### 3.1 How Crux gets in

- `crux/` is its own repository inside disrupterbox.
- `node build.js` in `crux/` writes `dist/crux.cjs`, `dist/crux.doh.js` and the
  generated Doh module `modules/golden/crux.js`. Never edit that file by hand.
- Golden code calls `golden.crux_interp`.

### 3.2 Files

| File | Role |
|---|---|
| `modules/golden/golden_crux.js` | `golden.RenderMotToNotes`: pips to notes |
| `modules/golden/golden_crux_ui.js` | The Crux panel: editor, directives, sections, playback |
| `modules/golden/golden_crux_keylane.js` | Key lane logic (`golden.CruxKeyLane`) |
| `modules/golden/golden_crux_examples.js` | `golden.AVAILABLE_CRUX_PROGRAMS`, the example library |
| `modules/golden/golden_crux_global.js` | Shared globals `golden.MomentaryTonic` and `golden.METRIC_STRONG_BEATS` |
| `modules/golden/golden_graphic_crux_ui.js` | Graphic Crux panel |
| `modules/golden/golden_crux_fold.js`, `golden_crux_fold_ui.js`, `golden_crux_fold_panel.js` | Fold panel: spawn `CruxFold`, or "Open in Fold Panel" in the Crux panel menu (`golden.CruxFold`, see 1.8) |
| `docs/crux-key-lane.md`, `docs/crux-rebuild.md` | Topic documents |

### 3.3 Behaviour

- The panel runs a program on Cmd+Enter. Typing does not re-run it.
- A note's pitch is `48 + regime(step)`, with the tonic set by `#tonic`.
  A step of exactly `k + 1/2` plays as degree k raised a semitone
  (`golden.CruxKeyLane.halfStep`). Other fractional steps round to the nearest
  integer.
- Tag `r` is a rest. Tag `x` omits the pip without advancing time.
- Section 1 plays the panel's instrument target. Section N plays `Sampler-N`
  unless a `#target` line says otherwise.
- Directives the panel reads: `bpm`, `quanta`, `pitchRegime`, `tonic`,
  `tuning`, `loop`, `swing`, `seed`, `minVel`, `maxVel`, `minDur`,
  `metricPattern`, `eval`, `keyLane`, and per
  section or sampler: `preset`, `octave`, `transposition`, `volume`, `reverb`,
  `delay`, `filterVerb`, `target`.
- `// #loop 20m` sets the loop length in bars of the transport's meter. In
  4/4, a piece of 80 quarter notes with `#quanta 4n` needs `#loop 20m`.
- A new Doh module, or a new dependency on one, needs a Doh server restart
  before the app loads again.

### 3.4 Key lane

```
// #meter 3/4
// #keyLane 1 I, 7 V, 15 ii, 16 IV, 26:-1 IV, 29 I
```

- Each entry is a bar address and a key. The key holds until the next entry.
- Keys are Roman numerals for degrees of the home scale: upper case major,
  lower case harmonic minor, `ii+` melodic minor, `ii-` natural minor, `bVI`
  or `#iv` for a tonic moved a semitone.
- `ii~` is a minor whose sixth and seventh follow the voice's line. The
  seventh is raised unless the line falls 7-6-5, or 8-7-6 without a turn back
  up to the seventh. The sixth is lowered unless it steps up to the seventh,
  or goes to it over the tonic (6-8-7). Repeated notes are skipped. With no
  following note it is harmonic minor.
- A note mark is an accidental and a home-scale degree from 1 to 7: `#6`
  raised, `b2` lowered, `n7` the home form. It applies once, to the next note
  on that degree at or after its address, in any voice (all notes on that
  degree at that onset). It replaces the key's inflection and does not end
  the key. An Arabic digit makes a mark: `#4` is a mark, `#iv` a key.
- Addresses are `bar`, `bar:beat` or `bar:beat:sixteenth`, counted from one.
  A negative last field counts back: `8:-1` is one beat before bar 8, and
  `8:1:-2` is a half-beat pickup into bar 8. `#meter` defaults to 4/4.
- A note keeps its degree number and takes the inflection the key gives that
  degree. Voices must hold integer steps.
- It applies to all sections, by note onset time. It needs a seven-note regime.
- An older form, a mot of degrees and lengths (`[0 | 3, 3 | 4]`), is still
  read. Use the address form for new programs.
- `RenderMotToNotes` sets `note.inflection` in semitones. Playback adds it.
  The panel binds note marks to the notes of all sections before it renders
  (`CruxKeyLane.bindMots`). A mark that no note takes logs one warning.
- Full description: `docs/crux-key-lane.md`. Check:
  `node --test modules/golden/golden_crux_keylane.test.js`.

### 3.5 Examples to read

In the example library, tag `baroque`: "Bach Invention 14 (key lane)",
"Bach Invention 5 (key lane)" and "Bach Invention 8 (key lane)". Two more use
`~` keys and note marks: "Bach Invention 1 (key lane)" and "Bach Fugue
BWV 578 (key lane)". The same programs are in `crux/examples/`.

## 4. Wad (macOS app, Swift)

Wad is a native DAW. The facts below are from its `DESIGN.md` and
`Support/crux/wad-api.js` at version 0.6.3, and the key lane added in 0.6.4.

### 4.1 How Crux gets in

- The interpreter runs in a JavaScriptCore context on a serial queue
  (`Sources/Wad/CruxEngine.swift`).
- The bundle is `Support/crux/crux-wad.js`: ohm-js, `crux/dist/crux.cjs`,
  Golden's example programs and `wad-api.js`.
- Rebuild: in the Crux repo run `node build.js --no-install`, then in Wad run
  `node Support/crux/build-wad-crux.mjs ~/Dev/disrupterbox`. For a change to
  `wad-api.js` alone, add `--api-only`.
- The bundle is a snapshot. A change in `crux/src` reaches Wad only after a
  rebuild.

### 4.2 The API

`wadCrux.interp(source, seed, maxPips, globalsJSON)` returns a JSON string.

- Success: `{ sections: [{ pips: [{ s, d, t, g, p }], text }], routing,
  samplers, directives, defs, uses }`. `s` step, `d` diad steps, `t`
  timeScale, `g` tag, `p` source offset of the pip (-1 if it came from a
  global).
- Failure: `{ error, pos }`, with `pos` an offset into the program's own text.
- `Math.random` is replaced by a generator seeded per region, so a project
  plays the same each time. `// #seed` overrides it.
- Limits: 4 seconds of execution, 5,000 pips per voice.
- Also: `wadCrux.definitions(source)`, `wadCrux.freezeRandoms(source, seed)`,
  `wadCrux.examples()`, `wadCrux.version()`.

### 4.3 Behaviour

- **Crux regions.** A Crux region is a MIDI region with a `crux` field. Its
  notes are a render of the pips, stored in the project. The pattern repeats
  from the region start and is cut at the region end.
- **Rendering is in Swift** (`CruxRender.swift`), not in JavaScript. timeScale
  1 is the `#quanta` value (default `8n`). Regimes are a port of Golden's
  (`Regime.swift`). Base pitch 48, `#tonic` mod 12. Steps of exactly one half
  round down. `r` rests, `x` omits, diads sound together.
- **Sections and tracks.** Section k renders to the k-th track from voice 1's,
  or to track T with `// #target k T`. In `// #octave -1 2` the last number is
  the section number.
- **Directives used:** `quanta`, `pitchRegime`, `tonic`, `octave`,
  `transposition`, `minVel`, `maxVel`, `seed`, `target`. **Ignored:** `bpm`,
  `swing`, `loop`, `eval` and sampler directives. Tempo and meter come from the
  project.
- **Project key.** With Follow Project Key on, each note takes the project's
  key at its start, and `#pitchRegime` and `#tonic` are ignored. Wad's key
  changes are stored by bar.
- **Project globals.** A top-level definition in one Crux program can be used
  in another. The using program runs the definition's text first, with its own
  seed. `defs` and `uses` in the result report this.
- **Patchbay.** Numbers in the source can be targets for cables. A cable
  rewrites the number and the program runs again.
- **Key lane.** A "Crux" track under Signature in Global Tracks holds the lane:
  a Roman numeral at each position. Wad writes it into every Crux program as
  its `// #keyLane` line, in the bar-address form, with project bar numbers.
  A hand-edited line updates the track at Execute. The home scale is the key
  the note is pitched in (the project key, or the program's own). Wad does not
  read the older `[degree | length]` form or `#meter` (it uses the project's
  meter map). It does not read `~` keys or note marks (3.4). Code:
  `Sources/Wad/CruxKeyLane.swift`.
- **Half steps and custom scales.** As in Golden: `Regime.halfStep` and
  `Regime.custom` in `Sources/Wad/Regime.swift`. A custom scale is named
  "Custom 0 1 3 5 6 8 11". An invalid list plays steps as semitones, like an
  unknown regime name; Golden ignores it with a warning.
- **Self-test:** `CruxSelfTest.swift`.

## 5. Working method

### 5.1 Writing a reduction of a piece

1. Get the notes from a trusted source (Humdrum kern, MusicXML or MIDI).
   `tools/score-to-crux.js` converts MusicXML and MIDI. `tools/survey-kern.js`
   reads kern.
2. Find the theme. Define it once, then express entries as transpositions
   (`T * [k]`) and inversions (`(T m [0]) * [k]`).
3. Split a theme into the parts that recur alone, for example a head and a
   tail, and build the theme from them.
4. Name recurring cells and use fans for sequences: `Q * [-3, -4, -5, -6]`.
5. Write each passage on its own line with a bar-number comment, then join the
   passages in the voice.
6. Keep voices in integer steps. Put accidentals in a key lane, or as half
   steps if the host has no lane.

### 5.2 Verify before you report

A program is not done until its interpreted output equals the source notes,
pip for pip: same step, same duration, rests in the same places. Merge
adjacent rests on both sides before comparing. Report the count of notes
checked. If accidentals come from a lane, check them as a separate count.

### 5.3 Score

```
node tools/reduction-score.js program.crux
```

| Number | Meaning | Reference |
|---|---|---|
| **saving** | 1 - bits / literal bits, with the literal on its best grid. The headline number. | Hand analyses of Inventions 5, 8, 14: 49% to 61% |
| **leverage** | Sounding notes per pip written | 2.7 to 3.3 by hand, up to 4.7 by search |
| **reuse** | References per definition | Not a quality score by itself |

The saving does not depend on `#quanta`, but the program's bits do. Set
`#quanta` so that the most common note has length 1. A program that writes
sixteenths as `| 1/4` is larger and scores lower.

`tools/survey-kern.js` runs the automatic search over a folder of kern files.
Results for the 15 Inventions and 48 WTC fugues are in
`docs/reduction-survey.md`. No score here is known to be optimal. Each is the
best found so far.

### 5.4 Checklist for a new program

- No `;` anywhere, also not in comments.
- Every statement on one line.
- Durations use `|`. Fractions without a pipe are steps.
- Operator expressions inside concatenations are in parentheses.
- Header directives say the regime, tonic and quanta the steps assume.
- Verified against the source, with the counts stated.
