# Crux key lane

The key lane adds chromatic notes to a Crux program after the program is
interpreted. The voices hold integer scale steps only. One directive line
says which key is in force from each point in time. Golden reads that line
when it turns pips into notes.

The Crux parser is not changed. To the parser, the lane is a comment.

```
// #meter 3/4
// #keyLane 1 I, 7 V, 15 ii, 16 IV, 19 vi, 21 I, 22 vi+, 24 I, 26:-1 IV, 29 I
```

## Why

Crux treats all scale steps alike. That is what lets one mot be transposed,
inverted and reused. A chromatic note written into a voice (a half step such as
`11/2`) breaks this: the same shape in another key needs a different literal.

The key lane keeps inflection out of the voices, in the same way that the tonic
is applied after interpretation. In Bach's Invention No. 14 the right hand's
first three bars and the left hand's answer in bars 6 to 8 become one
expression, `S` and `S * [-3]`, when the accidentals move to the lane.

The lane is about absolute positions in the piece, so its notation is separate
from the mot notation, which is about relative offsets.

## Entries

The lane is a list of entries with commas between them. Each entry is a bar
address, a space, and a key or a note mark. A key holds until the next key.
The last key holds to the end. Before the first key the home scale holds.

Entries must be in time order. Two keys cannot share an address. A note mark
can share an address with a key or with a mark on another degree.

## Keys

A key is a Roman numeral for a degree of the home scale. The case gives the
mode.

| Entry | Meaning | In B-flat major |
|---|---|---|
| `I` | major key on the tonic | B-flat major (the home scale) |
| `IV`, `V` | upper case: major key on that degree | E-flat major, F major |
| `ii`, `vi` | lower case: harmonic minor on that degree | C minor, G minor |
| `ii+` | melodic minor: raised sixth and seventh | C melodic minor |
| `ii-` | natural minor: no raised notes | C natural minor |
| `ii~` | minor whose sixth and seventh follow the line (below) | C minor |
| `II` | major on a degree that is normally minor | C major |
| `v` | minor on a degree that is normally major | F minor |
| `bVI`, `#iv` | `b` or `#` in front: the tonic a semitone lower or higher | G-flat major, E minor |

A note keeps its degree number. It takes the inflection that the named key
gives that degree. For example, under `IV` in B-flat major every A becomes
A-flat.

In a minor home scale, `i-` is the home scale, `i` adds the raised seventh, and
`I` is the parallel major.

`+`, `-` and `~` go with lower case only. `IV+` and `IV~` are errors.

## A minor that follows the line

In a `~` key the sixth and seventh degrees (of that key) follow the melodic
line of the voice the note is in. Degrees 1 to 5 are as in any minor.

To decide, the host looks at the notes around it in the same voice. Call `a`
the next note whose step differs from this note, `b` the next note after `a`
whose step differs from `a`, and `p` the last note before this one whose
step differs from it. Rests and repeated notes are skipped.

- The seventh is raised (the leading tone), except in a falling line. It is
  lowered when `a` is one step below it and one of these is true:
  - `b` is one step below `a` (7-6-5), or there is no `b`.
  - `p` is one step above it (8-7-6) and `b` is not the seventh again. The
    turn 8-7-6-7 keeps the seventh raised.
- The sixth is lowered, except when it goes up to the seventh. It is raised
  when `a` is one step above it (6-7), or when `a` is the tonic above it and
  `b` is the seventh (6-8-7).
- With no following note (the last note of a voice, the extra steps of a
  diad) the seventh is raised and the sixth lowered: harmonic minor.

So 5-6-7-1 rises with E natural and F-sharp in G minor, 1-7-6-5 falls with
F natural and E-flat, and the lower neighbour 1-7-1 keeps F-sharp. In A
minor, the line C B A G F-sharp A G-sharp B (Invention 1, bar 13) comes out
as written: G natural by 8-7-6, F-sharp by 6-8-7.

The 8-7-6 and 6-8-7 cases were added in November 2026. They did not change
any note of the BWV 578 example.

## Note marks

A note mark gives one note its accidental. It is an accidental and a degree
of the home scale, counted from 1:

```
// #keyLane 1 i~, 31:2 III, 32:2 #6, 39:2 b2, 41:-1 III
```

| Mark | Meaning | In G harmonic minor |
|---|---|---|
| `#6` | the home form of degree 6, raised a semitone | E natural |
| `b2` | the home form of degree 2, lowered a semitone | A-flat |
| `n7` | the home form of degree 7, whatever the key says | F-sharp |

- The number is a degree of the home scale, as the Roman numerals are. An
  Arabic digit makes a mark. `#iv` is a key and `#4` is a mark.
- The mark replaces the key's inflection for that note. It is not added to it.
- A mark applies once: to the next note on its degree that starts at or after
  its address, in any voice and any octave. If several notes on that degree
  start at that same time, all of them take it. Later notes do not.
- A mark is not a key. It does not end the key in force.
- Two marks on the same degree at the same address are an error. So are
  `#8`, `#0` and `x3`.
- Marks are for the bar-address form only.

To find "the next note", the host binds the marks after it interprets the
program and before it renders notes. It collects the onsets of every sounding
note of every voice, diad steps included. A mark that no later note on its
degree takes does nothing, and Golden logs one `[Crux keyLane]` warning. A
lane that was never bound applies each mark only to notes that start exactly
at its address.

## Bar addresses

`#meter` gives the beats in a bar and the note value of a beat. Without it the
meter is 4/4. Bar 1 starts at time 0.

| Address | Meaning |
|---|---|
| `8` | the downbeat of bar 8 |
| `8:2` | bar 8, beat 2 |
| `8:2:3` | bar 8, beat 2, third sixteenth |
| `8:-1` | one beat before bar 8 |
| `8:-2` | two beats before bar 8 |
| `8:1:-2` | two sixteenths before beat 1 of bar 8: a half-beat pickup |
| `8:3:-1` | one sixteenth before beat 3 of bar 8 |

- Bars, beats and sixteenths count from one. `8:0` is an error.
- A negative number counts back from the start of what is to its left. `8:-1`
  is the beat before bar 8. It is not the last beat of bar 8.
- Only the last field can be negative.
- In 3/4, `8:-1` and `7:3` are the same point. A negative address means the
  same in every meter, so it is the better way to write a pickup.
- A sixteenth is a sixteenth note. In 6/8 a beat is an eighth note and holds
  two sixteenths.

## Rules

- The lane is global. It applies to every section, by note onset time. A note
  that starts under one key keeps that inflection until it ends.
- The lane needs a pitch regime with seven notes (Major, Minor, the modes,
  HarmonicMinor and so on). In other regimes it is ignored.
- `#keyLane` and `#meter` are matched without regard to letter case. If a
  program has more than one `#keyLane` line, the last one is used.
- Do not put `;` in the line. The parser splits statements on it, also in
  comments.
- If the lane has an error, Golden logs a `[Crux keyLane]` warning that names
  the entry, and plays the program without a lane.

## The first form

The first version of the lane is still read:

```
// #keyLane [0 | 3, 3 | 4, 0 | 21, 4 | 6]
```

It is a Crux mot. Each step is a local tonic as a scale degree (0 = home) and
each timeScale is a length in the voices' units. The mode is not written: the
key is major where the home scale has a major third above the degree, and
harmonic minor elsewhere. Degree 0 is always the home scale. Use the bar
address form for new programs. This form is useful for a short loop, because
Crux operators work in it: `[0 | 2, 4 | 2] : 4`.

## How Golden applies it

- `modules/golden/golden_crux_keylane.js` holds the logic as
  `golden.CruxKeyLane` (`fromCode`, `parse`, `parseAddress`, `parseNumeral`,
  `parseMark`, `areaInflections`, `inflectionAt`, `lineContexts`,
  `bindMarks`, `bindMots`, `motContexts`, `homeScale`). It has no DOM code.
- `inflectionAt(lane, time, step, home, ctx)` checks bound marks first, then
  the key. `ctx` is `{ next, next2, prev }`, the steps of `a`, `b` and `p` above. Only
  `~` keys use it. Without it they are harmonic minor.
- The Crux panel reads the lane from the program text each time the program is
  evaluated. It does this also when directives are not followed, because the
  lane is part of the pitch content. `buildNotes` binds the marks to the notes
  of all sections (`bindMots`) before it renders them.
- `golden.RenderMotToNotes` takes the lane as `options.keyLane`. It gives each
  note its voice's following notes (`motContexts`). A
  bar-addressed lane is timed in quarter notes, so it does not depend on
  `#quanta`. Each note gets an `inflection` property in semitones. `pitch`
  includes it. `rawStep` and `regimeStep` do not.
- The fold view's stop 0 does the same from its own model.
- `golden_notes.playNote` and the loop walker compute pitch again from
  `regimeStep` at play time. They add `note.inflection` there.
- They also add `golden.LiveDegreeOffset(regimeStep)`, which live
  controllers (the inversion hexagrid) set. It is independent of the lane.
  The older scale deformation (`#scaleDeformation`) was removed in November
  2026.

## Wad

Wad has the lane as a "Crux" track under Signature in Global Tracks. Each
entry is a Roman numeral at a position. Wad writes the lane into every Crux
program as its `// #keyLane` line, with bar numbers of the Wad project, and a
line edited by hand updates the track when the program is executed. Wad uses
its own meter map and does not write or read `#meter`. It does not read the
first form. Code: `Sources/Wad/CruxKeyLane.swift` in the Wad repo. Wad does
not yet read `~` keys or note marks.

## Examples

In the Crux example library, tag `baroque`: "Bach Invention 14 (key lane)",
"Bach Invention 5 (key lane)" and "Bach Invention 8 (key lane)". The same
programs are in `crux/examples/bach-inventionNN.keylane.crux`. All three
reproduce every accidental of the score. `crux/examples/bach-invention14.halfstep.crux`
is Invention 14 with the accidentals written as half steps.

"Bach Fugue BWV 578 (key lane)" is the Little Fugue in G minor, in
`crux/examples/bach-bwv578.keylane.crux`. Its lane has 22 keys, nine of them
`~` keys, and 10 note marks. It gives all 287 chromatic notes of the 1,669.

## Tests

```sh
node --test modules/golden/golden_crux_keylane.test.js
```

The tests cover addresses, numerals, `~` keys, note marks, both lane forms
and the four examples. For each example they apply the lane and compare every
pitch with a reference that was checked against the score. For BWV 578 the
reference is `crux/test/fixtures/bach-bwv578.semitones.crux`, in plain
semitones, because the half-step code cannot write a lowered note.

In the `crux` repo, `tools/key-lane.js` applies a lane without Golden:

```sh
node tools/key-lane.js examples/bach-invention14.keylane.crux --compare examples/bach-invention14.halfstep.crux
node tools/key-lane.js examples/bach-bwv578.keylane.crux --compare test/fixtures/bach-bwv578.semitones.crux --semitones
```

The tool reads the home scale from `#pitchRegime` (Major, Minor,
HarmonicMinor, MelodicMinor). `--semitones` prints and compares semitones
above the tonic.

The core is written twice, in that tool and in `golden_crux_keylane.js`, as
the same block of text. Keep them the same. One test compares the two.

## Limits

- One lane for all voices. A cross-relation, where two voices inflect the same
  degree differently at the same time, cannot be written.
- `+` is one fixed scale. For a line that rises raised and falls lowered,
  use a `~` key. The `~` rule looks only at the note before and the two notes
  after, in the same voice. Where a composer raises the sixth or seventh after
  a leap (other than 6-8-7), or coming down over dominant harmony, the rule is
  wrong. Use a note mark there.
- A single chromatic note that no key explains takes a note mark. A half step
  in the voice (`7/2`) also still works. Golden plays it as the degree below
  raised a semitone, on top of the key lane's inflection. Wad does the same
  (0.6.5).
- A note mark goes to the first note on its degree, in whichever voice. If
  another voice has that degree earlier in the beat, give the mark the exact
  address of the note.
- A piece that starts with an upbeat has no bar-zero address yet. Bar 1 is
  time 0.
- Triplet positions cannot be addressed.
- Absolute addresses do not follow a voice that is stretched, repeated or
  shifted. For looping material use the first form.
- The graphic Crux view shows steps and does not mark the inflection.
