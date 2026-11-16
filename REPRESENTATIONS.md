# MIDI → ranked Crux explanations

This API looks for a small vocabulary whose transformations explain recurring
passages. A longer program can rank above a shorter one: the objective measures
reused note structure, not source-code length.

## Use

From the Crux directory:

```sh
npm run represent -- corpus/midi_src/frere-jacques.mid --pitch-regime auto --top-k 5
npm run represent -- input.mid --track 0 --pitch-regime Major --tonic-midi 60 --json
```

In Node, using imports relative to the Crux directory:

```js
import { midiFileToRepresentations, midiToRepresentations,
  representationToNotes } from './tools/midi-to-representations.js';

const candidates = await midiFileToRepresentations('melody.mid', {
  topK: 5,
  pitchRegime: 'auto',
  maxVocabulary: 3,
});

const best = candidates[0];
console.log(best.code, best.score, best.motifs);
const absoluteNotes = representationToNotes(best);
// Uploaded Buffer/Uint8Array: midiToRepresentations(bytes, options)
```

For an editor that already has evaluated pips, the search module has no MIDI or
filesystem dependency:

```js
import { findRepresentations } from './src/representations.js';
const candidates = findRepresentations([
  [{ step: 0, timeScale: 1 }, { step: 2, timeScale: 1 }, /* ... */],
  // Optional additional voices, each starting at arrangement time zero.
]);
```

Importing that module also registers `golden.findRepresentations`. It is a
separate API from `golden.decompose`, and is not included in the existing
concatenated CJS/Doh distribution by `build.js`; ESM consumers must import the
new module. Existing decomposer behavior is unchanged.

A simple result:

```crux
mot1 = [0, 2, 1]
mot1, (mot1 * [5 | 1]), (mot1 * [10 | 1])
```

This explains `[0, 2, 1, 5, 7, 6, 10, 12, 11]` as three applications of one
three-note motif. It scores above the shorter literal representation.

## Returned information

Each list item has:

- `code`: executable Crux, with `!` separating voices and named motifs shared
  across those voices. The MIDI adapter adds pitch-regime/tonic directives.
- `motifs`: seed expressions and their occurrences, with voice index, pip start
  index, length, transposition, inversion, retrograde, and duration multiplier.
  Start indexes include rest pips. In pitch-factored candidates, durations come
  from the voice's separate rhythm expression.
- `score`: total score, weighted cost, baseline cost, motif count, definition
  notes, covered notes, residual notes, reused notes, coverage, and rhythm values.
- `verified`: every returned candidate has passed interpretation against all
  source voices, including rest tags and durations.
- `metadata` (MIDI adapter): PPQ, absolute tonic MIDI number, pitch regime,
  inference confidence, tempo and meter maps, selected note count, and each
  voice's source track/channel/lane.

Keep `metadata` with the code to reconstruct absolute pitches and ticks. The
`#tonic` directive is only a pitch class; it does not preserve octave by itself.

## What the search does

1. Enumerate contiguous note windows, excluding rests from seeds. Index windows
   by equivalence under transposition, inversion, retrograde, and uniform duration
   scaling. Seeds can originate anywhere in any voice.
2. Retain motif families with at least two non-overlapping occurrences, ranked
   by potential reuse. The default pool is 64 motif families per search mode.
3. Run beam search over dictionaries of up to three motifs. For each dictionary,
   dynamic programming chooses a minimum-cost segmentation of every voice into
   motif applications and literal residuals. Matches compete for positions;
   overlapping windows cannot inflate coverage.
4. Remove motifs used fewer than twice in the chosen segmentation. Recompute the
   segmentation after removal. Never reward an unused or singly used variable.
5. Search both joint pitch/rhythm patterns and pitch patterns with rhythm
   factored through `.j`. Repeating rhythm masks cycle using cog semantics.
6. Render, rank, deduplicate, and verify every returned program through the actual
   Crux interpreter. The MIDI adapter additionally checks reconstructed absolute
   pitch/onset/duration events against every selected MIDI note.

Operators currently searched are `*` (transposition, retrograde, duration
scaling), `m` (inversion), concatenation, and `.j` (rhythm factoring). Seeds are
literal motifs. This does not yet search arbitrary Crux programs, nested motif
definitions, ornament removal, approximate matches, rotations, or interval
expansion. The alternatives are bounded-search candidates, **not a proof of
global optimality**. Dictionary search uses a beam; segmentation is exact only
for a fixed dictionary under its edge costs, before pruning singly used seeds.

## Scoring

Default cost units:

| Item | Cost |
| --- | ---: |
| Literal pip, including a rest | 1 |
| Pip in a motif definition | 1 |
| Additional cost per motif definition | 2 |
| Motif application | 0.35 |
| Operator in an application | 0.25 |
| Value in a factored rhythm mask | 0.2 |

```
cost = literal residual pips
     + motif definition pips + 2 × motif count
     + 0.35 × applications + 0.25 × application operators
     + 0.2 × factored rhythm values

score.total = (literal baseline cost − cost) / literal baseline cost
```

A literal has score zero. Higher is better. Coverage is the fraction of sounding
notes explained by motif applications; it includes each seed's first use.
`reusedNotes` subtracts the seed notes once, so coverage alone cannot make a long
memorized passage look maximally parsimonious. Adding variable names or gratuitous
operators incurs cost. Character count breaks ties only.

These weights are transparent heuristics, not trained probabilities or a formal
bit encoding. Rhythm factoring has its own explicit cost because pitch and
rhythm may reveal different structures. Tune these preferences through
`costs: { literal, definition, reference, operator, rhythm }`.

## MIDI policy and options

- Default: all note-bearing tracks, all notes. `track` selects a zero-based track
  in the parsed `@tonejs/midi` object. That library may split tracks by channel.
- Overlaps are split into non-overlapping lanes within each track, using the first
  available lane. No notes are dropped. This preserves polyphony but does **not**
  identify musical voices or guarantee that the top melody stays in one lane.
  For a melody analysis, select its track. `polyphony: 'reject'` rejects overlap.
- Timing uses ticks/PPQ, with one Crux unit per quarter note. Initial silence and
  every positive gap are represented as rests. No automatic quantization,
  articulation-gap removal, or note shortening occurs.
- Zero-duration notes are rejected explicitly. PPQ timing is required.
- Pitch defaults to `12Tone`, relative to the first selected note. `pitchRegime:
  'auto'` uses the existing pitch-class-set resolver, with a chromatic fallback.
  This is scale-fit inference, not harmonic/key analysis. `tonicMidi` sets an
  absolute reference; explicitly choosing a diatonic regime with no tonic uses C
  at or below the lowest note. Out-of-scale pitches in an explicit regime raise
  an error rather than being snapped.
- The symbolic output preserves note pitch, start, and duration. Velocity,
  instruments, pedals, and controllers are not modeled; tempo/meter maps are
  returned as metadata. This is not a byte-for-byte MIDI re-encoder.
- Numeric verification uses a tolerance of `1e-9` in Crux units and `1e-6` MIDI
  ticks in the adapter. Common fractions are emitted rationally.

Search defaults: `topK: 5`, `minMotifLength: 3`, `maxMotifLength: 12`,
`maxMotifs: 64`, `maxVocabulary: 3`, `beamWidth: 16`. The MIDI adapter defaults to
`maxNotes: 4096`; raise it intentionally or select a track for larger files.
Search is synchronous; use a worker when processing large inputs in an editor.
The list contains up to `topK` distinct verified programs, and can contain fewer.
The literal competes as a baseline but need not be in a truncated top-K result.

## Bach verification

The local scores are in `disrupterbox/media/music_xml/bach`. Eight small soprano
MIDI fixtures and a manifest of independent MusicXML-derived note events are in
`test/fixtures/bach`. These run with `npm test`; Python and the monorepo corpus
are not required for the checked-in tests.

The standard-library Python exporter selects the **named soprano part**, not
necessarily the first part (BWV 1.6 starts with a horn part). It merges ties and
reads written order, playing repeat signs once. It preserves source file hashes
and explicit export policy in the manifest. It rejects unsupported grace notes
and transposing parts instead of inventing performance details.

From the monorepo root, regenerate the fixtures or export the full local corpus:

```sh
python3 crux/tools/export-bach-chorales.py media/music_xml/bach crux/test/fixtures/bach \
  --ids bwv1.6 bwv2.6 bwv3.6 bwv4.8 bwv5.7 bwv6.6 bwv7.7 bwv8.6
python3 crux/tools/export-bach-chorales.py media/music_xml/bach /tmp/crux-bach-corpus
node crux/tools/benchmark-representations.js /tmp/crux-bach-corpus \
  --controls --output /tmp/crux-bach-report.json
```

Initial local benchmark (2026-09-04, Node 25.4.0; default search, `pitchRegime:
'auto'`, top 3):

| Measure | Result |
| --- | ---: |
| Soprano scores checked | 405 |
| Candidates matching XML-derived note events | 1,215 / 1,215 |
| Scores with a positive-scoring explanation | 405 / 405 |
| Mean top-candidate motif coverage | 66.6% |
| Mean coverage after pitch shuffling | 30.0% |
| Mean score, original / shuffled | 0.249 / 0.052 |
| Original scores higher than shuffled control | 402 / 405 |
| Median / p95 search time | 41 / 86 ms |

See `corpus/representation-benchmark.json` for per-piece results and skipped
source files. Two scores had grace notes and one lacked a named soprano. Variants in the local
corpus are retained; this is not a claim of 405 independent compositions.
Controls use one deterministic pitch shuffle per score, retaining rhythm and
pitch inventory. This is a sanity check for recurring structure, not expert
validation of phrase boundaries or an estimate of statistical significance.

The most useful next evaluation is a small set of human-preferred explanations:
use those to tune motif sizes and costs, and decide when longer phrase-level
reuse should outweigh common three-note fragments.
