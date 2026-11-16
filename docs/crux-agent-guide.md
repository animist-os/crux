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
- `dictionary`: one entry per distinct shape, with `count`, `pips`, `slot`
  (stop 5 position) and `residue` (no definition, used once).
- `instances`: one tree per voice. Nodes are definition uses (`ref`),
  operator copies (`op`) and runs of literal pips (`lit`), each with a time
  span, a pip range and `level` (the number of definitions above it).
- `counts`: `notes`, `pipsWritten`, `leverage`, and `shapes` and `positions`
  per stop.

A note changed by an operator with `exact: false` is `edited`. Its owner is
the innermost definition outside that operator.

`node tools/fold-report.js program.crux` prints the model as text.

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

### 2.3 Chromatic notes

There are three mechanisms. Know which one a file uses.

| Mechanism | Where | Status |
|---|---|---|
| **Half step** | In the voice. `k + 1/2` means degree k raised a semitone. `7/2` is F-sharp in C major. | A convention of the score converter. Both hosts round it down today, so it plays as the natural degree. |
| **Key lane** | A `// #keyLane` directive. Voices keep integer steps. | Golden (3.4) and Wad (4.3). |
| **Scale deformation** | Golden's `#scaleDeformation` and timeline: seven semitone offsets, one per degree. | Legacy. Intended for removal. Do not use it in new programs. |

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
| `modules/golden/golden_crux_global.js` | Legacy scale deformation and its timeline |
| `modules/golden/golden_graphic_crux_ui.js` | Graphic Crux panel |
| `modules/golden/golden_crux_fold.js`, `golden_crux_fold_ui.js` | Fold mode of the graphic panel (`golden.CruxFold`, see 1.8) |
| `docs/crux-key-lane.md`, `docs/crux-rebuild.md` | Topic documents |

### 3.3 Behaviour

- The panel runs a program on Cmd+Enter. Typing does not re-run it.
- A note's pitch is `48 + regime(step)`, with the tonic set by `#tonic`.
  Fractional steps round to the nearest integer, and exactly one half rounds
  down.
- Tag `r` is a rest. Tag `x` omits the pip without advancing time.
- Section 1 plays the panel's instrument target. Section N plays `Sampler-N`
  unless a `#target` line says otherwise.
- Directives the panel reads: `bpm`, `quanta`, `pitchRegime`, `tonic`,
  `tuning`, `loop`, `swing`, `seed`, `minVel`, `maxVel`, `minDur`,
  `metricPattern`, `eval`, `keyLane`, `scaleDeformation` (legacy), and per
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
- Addresses are `bar`, `bar:beat` or `bar:beat:sixteenth`, counted from one.
  A negative last field counts back: `8:-1` is one beat before bar 8, and
  `8:1:-2` is a half-beat pickup into bar 8. `#meter` defaults to 4/4.
- A note keeps its degree number and takes the inflection the key gives that
  degree. Voices must hold integer steps.
- It applies to all sections, by note onset time. It needs a seven-note regime.
- An older form, a mot of degrees and lengths (`[0 | 3, 3 | 4]`), is still
  read. Use the address form for new programs.
- `RenderMotToNotes` sets `note.inflection` in semitones. Playback adds it.
- Full description: `docs/crux-key-lane.md`. Check:
  `node --test modules/golden/golden_crux_keylane.test.js`.

### 3.5 Examples to read

In the example library, tag `baroque`: "Bach Invention 14 (key lane)",
"Bach Invention 5 (key lane)", "Bach Invention 8 (key lane)". The same programs
are in `crux/examples/`.

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
  meter map). Code: `Sources/Wad/CruxKeyLane.swift`.
- **Not in Wad:** half-step playback, scale deformation.
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
| **saving** | 1 - bits / literal bits. The headline number. | Hand analyses of Inventions 5, 8, 14: 72% to 77% |
| **leverage** | Sounding notes per pip written | 2.7 to 3.3 by hand, up to 6.2 by search |
| **reuse** | References per definition | Not a quality score by itself |

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
