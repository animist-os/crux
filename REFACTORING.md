# Scores → Crux → motivic refactoring

This system reads a score, writes it as literal Crux, and then searches for a
shorter Crux program that plays the same notes. The shorter program names the
motifs the music shares, across voices and across pieces. Every program it
returns has been run through the Crux interpreter and checked note for note
against the score.

The test bed is the music21 Bach chorale corpus in `disrupterbox/media/music_xml/bach`
(408 compressed MusicXML scores, 409 usable SATB chorales with the two `.xml`
files, 96,726 notes).

## Use

```sh
# Literal Crux, all four voices
node tools/score-to-crux.js ../media/music_xml/bach/bwv269.mxl --literal

# Refactored program (prints Crux; --json for the full report)
node tools/score-to-crux.js ../media/music_xml/bach/bwv269.mxl
node tools/score-to-crux.js corpus/midi_src/raw/bach-wtc1-fugue2-full.mid --streams auto

# Corpus benchmark, motif library, search study, worked examples
node tools/benchmark-chorales.js ../media/music_xml/bach --output corpus/chorale-benchmark.json
node tools/learn-library.js ../media/music_xml/bach --out corpus/chorale-library
node tools/search-study.js ../media/music_xml/bach --limit 24
node tools/make-chorale-examples.js ../media/music_xml/bach examples/chorales bwv269

# Atoms under operators: refactor with generators, and the corpus atom report
node tools/score-to-crux.js ../media/music_xml/bach/bwv269.mxl --generators --streams joint
node tools/atom-report.js ../media/music_xml/bach --out docs/atoms --example bwv269

# Kernels: a few shared mots that approximate the score, and their wiggle reach
node tools/fit-kernel.js ../media/music_xml/bach/bwv269.mxl --k1 2 --k2 0 --lossy 1 --out bwv269.kernel.crux
node tools/fit-kernel.js ../media/music_xml/bach/bwv269.mxl --voices S --sweep
```

Options for `score-to-crux.js`: `--lens diatonic|chromatic`, `--parts satb|all`,
`--repeats written|expand`, `--streams auto|joint|factored`, `--beam N`,
`--variants`, `--generators`.

The same pipeline in code:

```js
import { loadScore, scoreToVoices, voiceMetrics } from './src/score/index.js';
import { refactorVoices, learnLibrary } from './src/refactor/grammar.js';
import { motifReport } from './src/refactor/report.js';

const score = loadScore('bwv269.mxl');                 // MusicXML or MIDI
const converted = scoreToVoices(score, { lens: 'diatonic' });
const result = refactorVoices(converted.voices);       // { code, bits, saving, verified, ... }
```

## Pipeline

| module | job |
|---|---|
| `src/score/zip.js`, `src/score/xml.js` | Read `.mxl` containers and XML with Node built-ins. No new dependencies. |
| `src/score/musicxml.js` | MusicXML → **Score**: parts, spelled pitches, integer ticks, ties merged, chords and `<backup>` voices, fermatas, measures, meter, key, transposing parts, optional repeat expansion. |
| `src/score/midi.js` | MIDI → the same Score shape. Key from the file or a Krumhansl–Schmuckler estimate. Unnamed 4-track files are assigned SATB by pitch. |
| `src/score/to-crux.js` | Score → pips under a **pitch lens**, literal programs with directives, decoding back to MIDI, verification, metric facts (measure, beat, phrase ends). |
| `src/refactor/cost.js` | Description length of Crux **text** in bits. |
| `src/refactor/grammar.js` | The refactoring search, library learning, rendering, verification. |
| `src/refactor/generators.js` | Atoms under operators: the generator dictionary and the fan/cog factorizations. |
| `src/refactor/report.js` | Motif tables: where each motif occurs and how it is transformed. |

The MusicXML reader agrees with an independent reference on every part it can
read. The reference is the existing standard-library exporter
(`tools/export-bach-chorales.py`) widened from the soprano to all four named
parts. 1,625 of 1,625 parts match note for note in pitch, onset and duration. The
reference fails on 7 parts (2 scores with grace notes, 1 broken tie, 1 score with
no SATB parts). The new reader keeps the broken tie as two notes and drops grace
notes, with a warning for each.

All 409 chorales round-trip in both lenses. The literal program, run through the
interpreter and decoded to MIDI, equals the score.

## Pitch lenses

- **diatonic** (default). A step is a scale degree in the key-signature collection,
  counted by letter name from the tonic. A chromatic note is a half step, `k + 1/2`,
  meaning degree `k` raised a semitone. F♯ in C major is `7/2`. G♯ in A minor is
  `-1/2`. Every MIDI pitch has a code in every key, so the lens is lossless.
  7.0% of chorale notes are chromatic. None needs an enharmonic fallback.
- **chromatic**. A step is semitones from the tonic. It plays in Golden today with
  `#pitchRegime 12Tone`.

The tonic comes from the key signature most parts agree on and the soprano's
`<mode>`, placed between F♯3 and F4. The corpus needs both rules. In 101 scores
only the soprano says minor and the other parts say major, and three scores
give one part a different signature.
The diatonic lens is the better lens for motifs. The same corpus costs fewer bits
in it (see results), because a tonal sequence is an exact transposition in scale
degrees but not in semitones.

Golden rounds fractional steps down, so it plays `7/2` as F, not F♯.
`docs/golden-half-steps.md` proposed the patch. Golden now plays half steps (2026-11-16).

## The refactoring engine

A program is a set of streams (one per voice, or a pitch stream and a rhythm
stream per voice) plus named definitions. An item in a stream is a literal pip,
a reference to a definition, or a fan of references (`M * [0, -1, -2]`, a
sequence). A reference may transpose, invert (`m [0]`), reverse (`* [o | -1]`),
augment (`* [o | 2]`) or, optionally, edit single notes (`@ [@5 1]`).

One search step does the following.

1. **Mine.** Hash every window of 2 to 48 pips that starts and ends on item
   boundaries, in voices and in definition bodies. The hash is canonical under
   the allowed transformations, so windows that are transpositions, inversions or
   retrogrades of each other collide. Rolling hashes over interval tokens keep
   this linear in window count.
2. **Score.** For each class, choose non-overlapping occurrences and compute the
   bit gain of defining it once and referring to it everywhere. Adjacent
   occurrences are priced as a fan.
3. **Abstract.** Define the best class (its body written around its own register,
   usually starting at 0) and replace its occurrences.

Because windows may contain earlier references, definitions nest. A beam keeps
the best few programs at each step. Polishing then inlines definitions used
once, re-parses every stream optimally for the final dictionary by dynamic
programming, re-anchors bodies, and merges runs into fans. Each voice is written
relative to its own register, `(...) * [k]`.

**Streams.** A voice can be one joint stream, or a pitch stream combined with a
rhythm stream by cog-add: `(P) . (R)`. Pitch motifs then match regardless of
rhythm, and rhythm cells get their own definitions (`R1`, `R2`). `--streams auto`
keeps whichever is shorter.

**Constraints.** The analysis setting requires motifs to start on a beat and
forbids them to cross a fermata. It costs 0.8% of the literal bits against the
same search unconstrained, and makes the motif boundaries readable as music.

**Library.** `learnLibrary` runs one grammar over the voices of many chorales.
Definitions used in at least 3 pieces become a frozen library (`L1`, `L2`, …).
A new piece can then refer to them. Their text is paid once for the corpus.

## Cost model

`src/refactor/cost.js` prices the program text with a fixed prefix code. An
integer `n` costs 1 bit if zero, otherwise 1 sign bit plus an Elias-gamma code of
`|n|`. A fraction costs its numerator plus its denominator. A name costs
`log2(names + 1)`. An operator costs 4 bits. Brackets, commas and parentheses cost
1 bit each. Comments, directives and newlines are free.

The model sees only text, so programs from any method (the earlier
`findRepresentations`, this engine, or hand-written Crux) are compared on one
scale. "Saving" below is `1 − bits / literal bits`, where the literal program is
one bracketed mot per voice. "Beyond register" compares with the literal program
written relative to each voice's register, which removes the gain that comes
only from smaller numbers.

## Results

All 409 chorales, all four voices, every program verified against the score
(`corpus/chorale-benchmark.json`). The literal programs total 927,869 bits in the
diatonic lens and 1,010,811 in the chromatic lens.

| configuration | bits (total) | saving | beyond register | median ms |
|---|---|---|---|---|
| earlier search, `findRepresentations` (3 motifs) | 975,293 | −5.1% | | 359 |
| **default** (best of joint/factored streams, best of two transformation groups) | **587,951** | **36.6%** | **20.0%** | 630 |
| default with beam 4×4 | 586,921 | 36.7% | 20.1% | 2,069 |
| joint streams only | 594,330 | 35.9% | 19.1% | 181 |
| factored streams only | 621,010 | 33.1% | 15.5% | 490 |
| joint, all transformations only | 603,775 | 34.9% | 17.9% | 129 |
| joint, transposition only | 596,092 | 35.8% | 18.9% | 100 |
| analysis (joint, beat starts, no fermata crossing) | 602,452 | 35.1% | 18.0% | 86 |
| chromatic lens, default search | 649,520 | 35.7% of its own literal | 18.3% | 652 |

The default chooses factored streams for 80 of the 409 chorales. Per piece the
saving ranges from 18.9% to 62.4% (BWV 120.8-a).

### Search effort

24 chorales spread over the corpus, joint streams, default settings otherwise
(`tools/search-study.js`). Times were measured with another job sharing the
machine, so read them as relative.

| strategy | saving | bits vs greedy | ms per piece |
|---|---|---|---|
| greedy (default) | 36.9% | | 319 |
| beam 2×2 | 36.9% | −0.05% | 441 |
| beam 4×4 | 36.9% | −0.09% | 794 |
| beam 8×8 | 37.0% | −0.21% | 1,538 |
| 4 stochastic restarts | 37.1% | −0.27% | 1,117 |
| 16 stochastic restarts | 37.2% | −0.46% | 3,724 |
| no optimal re-parse | 36.7% | +0.25% | 258 |
| note-edit variants (`@`) | 36.9% | −0.08% | 300 |
| motifs of 3+ notes only | 34.8% | +3.3% | 237 |
| motifs of at most 16 notes | 36.6% | +0.5% | 189 |

Twelve times the search buys half a percent. The default already runs the
search twice, once with inversion and retrograde and once with transposition
only, and keeps the shorter program. That choice is worth more than any beam.
Two-note motifs are worth more than any search setting.

### Library learned from the corpus

The library was learned from 307 chorales and tested on the other 102 (every
fourth score by name).

| | per-piece programs | with the library |
|---|---|---|
| saving on the 102 held-out chorales | 36.6% | 46.0% |
| bits on the 102 held-out chorales | 147,336 | 125,370 |
| library size | | 543 entries, 19,836 bits |

The library shortens unseen chorales by 14.9%. Its own text pays for itself after
92 pieces. Learned from all 409 chorales, the library has 704 entries
(26,839 bits) and the whole corpus, library text included, comes to 44.9%
less than the literal programs (35.9% for per-piece programs alone).

The most widely shared entries are diminutions. Library learning uses
transposition only, so each entry keeps its direction.

| entry | notes | chorales (of 307) | what it is |
|---|---|---|---|
| `L1 = [0 \| 1/2, -1 \| 1/2]` | 2 | 300 | Two eighths stepping down. |
| `L2 = [0 \| 1/2, 1 \| 1/2]` | 2 | 300 | Two eighths stepping up. |
| `L3 = (L2 * [-1]), [1]` | 3 | 278 | Two rising eighths into a quarter (an ascending passing tone). |
| `L4 = (L1 * [1]), [-1]` | 3 | 277 | The same, descending. |
| `L5 = (L1 * [1]), (L1 * [-1])` | 4 | 207 | Four eighths in a descending scale. |
| `L6 = [0 \| 3/2, -1 \| 1/2]` | 2 | 204 | Dotted quarter, then an eighth a step lower. |
| `L10 = [-1/2 \| 1/2, 0]` | 2 | 154 | A raised degree resolving up a half step (a leading tone). |
| `L14 = [0 \| 1/4, -1 \| 1/4]` | 2 | 140 | Two sixteenths stepping down. |
| `L15 = [0 \| 1/2, -2 \| 1/2]` | 2 | 139 | Two eighths falling a third. |
| `L25 = L8, [3]` | 5 | 93 | A four-eighth rising run into a quarter. |

The longest entries are whole chorale tunes that Bach set more than once. One
43-note entry is shared by BWV 117.4, 177.4 and 251 (*Sei Lob und Ehr' dem
höchsten Gut*). A 25-note entry is the Passion chorale tune in BWV 244.15,
244.44, 244.54 and 270. A 37-note entry links BWV 136.6 and 89.6 (*Wo soll ich
fliehen hin*) with BWV 5.7 (*Auf meinen lieben Gott*). The titles differ but the
melody is the same, and the library found that on its own. The library file
names the pieces for every entry used by six or fewer.

### Contrast: imitative counterpoint

The same engine on two MIDI files from `corpus/midi_src/raw`, default settings
with beam 4×4 (`examples/chorales`).

| piece | literal bits | refactored bits | saving | streams |
|---|---|---|---|---|
| Invention No. 1, BWV 772 | 7,316 | 2,459 | 66.4% | factored |
| WTC I Fugue in C minor, BWV 847 | 11,749 | 4,517 | 61.6% | factored |
| median chorale (of 409) | | | 35.0% | joint |

In the invention the subject (`M3`, C–D–E–F–D–E–C as scale degrees) and its
melodic inversion (`M1`) become definitions, and the subject's entries become
transposed references. The MIDI file has one track, so its voices are mechanical
lanes split at overlaps, not the two hands.

## Atoms under operators

A 2- or 3-pip atom can be the source of a whole stretch of surface. Crux
operators carry it there. `[5, 4]/` is two eighths in one beat.
`[0, -1]/ * ([5] -> [-3])` is that atom placed on each step of a descending run.
`([5] -> [-3]) . [[0, -1]/, [0, 1]/]` decorates the same run with alternating
lower and upper neighbours. `--generators` lets the search write surface this
way (`src/refactor/generators.js`).

**The dictionary.** Bottom-up enumeration builds every expression of the form
"atom, operator, operand", and one more operator on top. Atoms have 1 to 3 pips
with steps −3 to 3. They come as even quarters, as uneven beats (`[a | 3, b]/`),
or as chromatic pairs (`[0, -1/2]/`). The operators are `/`, `|| [s]`, `* B`,
`-> [k]`, `.-> [k]`, `f [k]`, `l [n]`, `:k` and cog-add with nested
subdivisions. Expressions that make the same surface keep only the cheapest
text. The result is 273,092 distinct surfaces, built in about 6 seconds. A small
evaluator proposes the surfaces. 20,000 random entries were checked against the
interpreter with no mismatch, and every program is verified like any other.

**Factorizations.** Two more forms reach past the dictionary's 16-pip limit.
A fan writes a stretch as one atom transposed along a path (`atom * [path]`). A
cog writes it as a skeleton whose notes are each decorated by an atom
(`[skeleton] . [[0, -1]/]`, masks `[N]`, `[N, 0]`, `[0, N]`, `[N, M]`). When
the path or skeleton is itself in the dictionary, it is written as a generator
too.

**Results.** All 409 chorales, joint streams, every program verified
(`docs/atoms.md`).

| | bits | saving |
|---|---|---|
| literal | 927,869 | |
| motif search | 594,330 | 35.9% |
| motif search with generators | 552,132 | 40.5% |

Generators write 35.1% (33,977 of 96,726) of all notes. The atoms that matter most:

| atom (scale steps) | notes made | uses | chorales | commonest expressions |
|---|---|---|---|---|
| `0 -1` | 11,810 | 4,971 | 398 | `[0, -1]/` ×4290, `[0, -1]/ * [path]` ×425 |
| `0 1` | 8,955 | 3,876 | 400 | `[0, 1]/` ×3456, `[0, 1]/ * [path]` ×293 |
| `0 -2` | 1,983 | 921 | 287 | `[0, -2]/` ×871, `[0, -2]/ * [path]` ×12 |
| `0 -1/2` | 1,336 | 622 | 275 | `[0, -1/2]/` ×585, `[0, -1/2]/ * [path]` ×20 |
| `0 1 2` | 1,005 | 275 | 149 | `[0 \| 2, 1, 2]/` ×177, `[0, 1, 2 \| 2]/` ×37 |
| `0 0` | 996 | 213 | 129 | `[0, 0]/` ×82, `[0, 0] * [path]` ×21 |
| `0 -1 -2` | 944 | 251 | 153 | `[0 \| 2, -1, -2]/` ×150, `[0, -1, -2 \| 2]/` ×26 |
| `0` | 816 | 169 | 135 | `[0] -> [-3]` ×36, `[0] -> [3]` ×27 |
| `0 -3/2` | 782 | 380 | 208 | `[0, -3/2]/` ×364, `[0 \| 3, -3/2]/` ×8 |
| `0 2` | 778 | 336 | 196 | `[0, 2]/` ×312, `([0, 2] .-> [3, -3]) \|\| [1/2]` ×9 |
| `0 3/2` | 751 | 367 | 215 | `[0, 3/2]/` ×356, `[0, 3/2]/ * [path]` ×5 |
| `0 1/2` | 704 | 301 | 167 | `[0, 1/2]/` ×253, `[0, 1/2]/ * [path]` ×17 |
| `0 3` | 688 | 309 | 172 | `[0, 3]/` ×286, `([0, 3] .-> [-2]) \|\| [1/2]` ×3 |
| `0 -3` | 333 | 148 | 95 | `[0, -3]/` ×139, `([0, -3] .-> [-2, 3]) \|\| [1/2]` ×3 |

What the corpus says about atoms:

- **The beat-pair is the unit.** Two notes filling one beat (`[a, b]/`) make most
  generated surface. The step inside the pair is usually ±1, then −2, ±1/2 and
  ±3/2 (chromatic), 2 and 3.
- **Chromatic pairs are first-class.** `[0, -1/2]/`, `[0, 3/2]/` and `[0, 1/2]/`
  each appear in 167 to 275 chorales. These are leading tones and chromatic
  passing notes inside one beat.
- **Uneven beats come in two shapes.** `[0 | 2, 1, 2]/` and `[0 | 2, -1, -2]/`
  (an eighth and two sixteenths, rising or falling) are used 177 and 150 times.
  `[0 | 3, -1]/` (dotted eighth and sixteenth) is rarer.
- **Runs come from a single pip.** `[0] -> [k]` makes a scale run of k + 1 notes.
  `([0] -> [k]) || [1/2]` makes it in eighths.
- **Paths are short and irregular.** Fans of a pair along 2 or 3 steps are
  common (888 uses). Paths that are themselves generated are rare (21 uses in the
  corpus), because chorale skeletons seldom move in regular runs.

The compression gain is 4.6 points. The analytic gain is larger. A third of the
surface is now explained as a handful of atoms placed by operators, and the
report counts each atom in each role.

## Findings

- The earlier search (`findRepresentations`, up to 3 motifs) makes four-voice
  chorales 5% longer under this cost model, though it helps 222 of the 409. The
  new engine makes them 37% shorter. With the corpus library, unseen chorales
  come out 46% shorter.
- Most of the gain is short diminution figures shared by all four voices:
  eighth-note passing pairs, scale runs, the dotted figure, leading-tone
  resolutions. A chorale surface carries little long motivic repetition. Its
  regularity is harmony and voice leading, which a motif grammar does not model.
- Long repetition does appear. Bar-form chorales often write the repeated opening
  out (BWV 1.6). Then each voice reuses one long definition.
- Across harmonizations of one tune the sharing is large. In
  `examples/chorales/passion-chorale-family.crux` eight settings of *Herzlich tut
  mich verlangen* share the tune as nested definitions, and BWV 244.54 and BWV 270
  have identical soprano expressions.
- Bach's fugue and invention compress nearly twice as well as a chorale (62% and
  66% against a median of 35%), which is what a motif grammar should find in
  imitative music.
- The diatonic lens beats the chromatic lens in absolute bits.
- A larger transformation group makes the greedy search worse. With inversion
  and retrograde allowed, coincidental matches crowd out exact ones (34.9% against
  35.8% for transposition only). This holds for the invention and the fugue too.
  The default runs both and keeps the shorter program. Augmentation is off by
  default for the same reason.
- Separate pitch and rhythm streams lose on chorales, where most notes are
  quarters and a joint stream pays nothing for them. They win on the invention
  and the fugue.
- Interval (delta) literals would not help. In a 40-chorale sample, re-encoding
  every residual literal run as intervals cost 1.8% more than the
  register-relative absolute steps used now.
- Note-edit variants (`(M * [o]) @ [@i d]`) almost never pay. Each edit costs
  about 13 bits in current Crux syntax and near-repeats are rare in written-form
  chorales.

## How to explore the space of Crux programs

The programs that play a given surface form an infinite equivalence class. The
engine searches it with semantics-preserving rewrites, scored by description
length and checked by the interpreter. Six directions follow from the
measurements above.

1. **Better representations before more search.** Beam and restarts buy under
   half a percent. The library buys 15% on unseen pieces. The next gains will
   come from new kinds of abstraction, not from searching the current ones harder.
2. **Library learning across the corpus.** This is the step from compressing a
   piece to learning a vocabulary. It follows DreamCoder and Stitch-style
   abstraction learning. Two extensions are natural. Give library entries
   usage-weighted codes so common figures cost fewer bits. Learn from a mixed
   corpus (chorales, inventions, fugues) and compare the vocabularies.
3. **Templates with parameters (anti-unification).** The generator dictionary
   and the fan/cog factorizations are a first, enumerated version of this: an atom
   is the template, a path or skeleton is the argument. Crux macros have no
   parameters, but cog operators act like them. `T . [p1, p2, …]` and `R .j P` are
   templates applied to argument mots. Anti-unifying two near-repeats yields the
   template and the arguments. This generalizes the note-edit variants and would
   cover phrases that keep a rhythm and change pitches.
4. **Equality saturation (e-graphs).** Crux has algebraic identities:
   `(M * [a]) * [b] = M * [a + b]`, `M, M = M:2`, distribution of `*` over `,`,
   `m` and retrograde composition. An e-graph holds every program reachable by
   such rules at once and extracts the cheapest. It suits local algebra. It does
   not by itself discover motifs, so it complements the miner.
5. **Musical priors as part of the objective.** Bits alone accept coincidences,
   such as a bass figure explained as an inverted retrograde soprano fragment. A
   prior over boundaries (beats, fermatas), transformations and voice pairs turns
   the search toward analyses a musician would recognize. The constraint setting
   is a first, cheap version. An analysis should report a Pareto front of bits
   against such priors, not a single program.
6. **Proposal by a language model, verification by the interpreter.** A model
   can propose whole refactorings in Crux text, such as a Schenkerian reading of a
   phrase as a skeleton plus diminutions. The interpreter checks them and the cost
   model ranks them. Nothing unverified is ever accepted, so proposals can be bold.

The reduction view connects these. A chorale voice is a beat-level line plus
diminutions. The library already isolates the diminution vocabulary. Making the
beat-level line a first-class stream, with diminutions applied by cog-add with
nested mots (`skeleton . [0, [0, -1]/, 0]`), is the Crux form of Schenker's first
level and the next experiment worth running.

## Kernels: few mots, wide reach

The bits objective rewards short text. A program can be short and still be one
number per note. Wiggling a number in such a program moves one note. The kernel
targets a different goal. It is a small set of mots that approximates one chorale,
written with as few step numbers as possible, so that one number moves many notes.

`src/kernel/kernel.js` builds it in three steps.

1. Each voice is cut into beat figures. A note held across a beat stays whole.
2. The beat figures of all voices are clustered (weighted k-medoids on a time grid,
   optionally with inversion). Each figure becomes its nearest prototype `A1 ... Ak1`.
3. Phrases `R1 ...` are found on the sequence of figures. Exact transposing Re-Pair
   runs first. With `lossy`, approximate repeats follow: a run of figures is copied
   over a similar run anywhere in the piece when the numbers saved outweigh the extra
   error at the given price. Exact Re-Pair then runs again.

An optional middle level of measure shapes (`k2 > 0`) and a shared bass line
(`harmony`, which needs measure shapes) are available. Measure shapes reach the
Pareto front only below about 85% fit. A chorale phrase starts on a pickup, so
measure-sized units cut every phrase in two and its repeats are missed. Phrases found
on beat figures keep the pickup.

`fitKernel` plays the program through the interpreter and measures pitch fit, notes
fit and extra onsets on the time grid. `src/kernel/wiggle.js` raises every step
number by one, replays the program and counts the notes that move.

| chorale | notes | numbers for 90% pitch fit | numbers for every note exact |
|---|---|---|---|
| BWV 269, four voices | 225 | 94 | 130 |
| BWV 227.1, four voices | 279 | 83 | 116 |
| BWV 1.6, four voices | 344 | 93 | 140 |
| BWV 269, soprano | 46 | 23 | 34 |
| BWV 227.1, soprano | 59 | 24 | 36 |
| BWV 1.6, soprano | 70 | 26 | 27 |

The soprano shrinks less per note than the full texture. Most remaining numbers are
transpositions on the voice line, one per figure or phrase reference.
`examples/kernels/README.md` has the examples and the tables for six chorales.

## Crux notes found along the way

- Pipe-only pips lose their pipe-only status through operators. `[0, 1] .j
  [| 2, |]` keeps the steps, but `[0, 1] .j (R * [0 | 2])` replaces them with 0,
  and so does `R:2`. Rhythm motifs therefore cannot be applied with `.j`. The
  engine applies rhythm with cog-add `.` instead, which works because rhythm pips
  have step 0.
- `@` edits are expensive to write. `(X @ [@5 1])` costs an operator, brackets, an
  `@` and an index per edit.
- The parser reads `;` as a separator even inside a `//` comment. Comment lines
  in generated programs avoid it.
- `skeleton . [A, (B * [2]), (C m [0])]` works. Each reference inside the brackets
  becomes one nested element, laid over one skeleton pip and scaled by its duration.
- Directives `#lens`, `#tonicMidi` and `#keyFifths` are written by the converter
  and follow the existing directive rules. Golden ignores them today.

## Limits

- The cost model is a naive prefix code, not a trained probability model. It is
  the same for every method, which is what the comparisons need.
- The search is heuristic. It does not prove a program is the shortest.
- Repeats are read in written form by default, as the existing exporter does.
  `--repeats expand` plays them out, which makes bar-form chorales trivially
  repetitive.
- Grace notes are omitted (two scores). Velocity, articulation, lyrics and
  instrument parts outside SATB are ignored.
- The examples are derived from the music21 encodings. Check their terms before
  publishing the derived files in the public repository.
