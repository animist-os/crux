# Reduction score, and a survey of the Inventions and the WTC fugues

## The score

`tools/reduction-score.js` scores any Crux program, hand-written or found by the
refactoring search.

```sh
node tools/reduction-score.js examples/bach-invention14.keylane.crux
```

| number | meaning |
|---|---|
| **saving** | `1 - bits / literalBits`. Bits are the description length of the program text (`src/refactor/cost.js`, the measure the refactoring search already uses). `literalBits` is the same music as one literal mot per voice, on its best grid. |
| **saving as written** | The same, with the literal in the program's own unit. This was the headline number before 2026-11-16. |
| **leverage** | Sounding notes per pip written in the source. Every number or rest in a mot counts, also operator arguments. |
| **reuse** | References to defined names per definition. |

Saving is the headline number. It rewards reuse and a short source on one
scale, and a reference that saves little is worth little. Leverage is the
plain-language companion: "one written pip makes N notes".

### The best grid

The literal baseline depends on the unit that lengths are counted in. Music in
sixteenth notes, written with a quarter-note unit, has `| 1/4` on almost every
pip. That literal is large, and a program looks better against it than it is.
For Invention 14 the literal is 9846 bits in quarter notes and 5919 bits on its
best grid.

For the best grid, the tool multiplies all lengths by one factor. It tries each
note length that occurs as the unit and keeps the smallest literal. With this
baseline:

- The score does not depend on `#quanta`.
- For the same music, a program with fewer bits always has a larger saving.
  The old number did not have this property. A version of Invention 14 on a
  sixteenth grid is 13% smaller than the quarter-note version, and the old
  number put it 10 points lower.
- A program that uses a poor unit pays for it. Set `#quanta` so that the most
  common note has length 1.

The old number was about 20 points too high for music in sixteenths. Chorales,
which move in quarter notes, do not change.

Reuse is reported but it is not a good score by itself. In this survey the
fugues that reduce worst have the highest reuse, because the search falls back
on two-note motifs that it uses a hundred times. A motif count does not say how
long the motifs are. Saving does.

A `// #keyLane` line is part of the program. Its bits and its entries are
counted.

Reference points:

| program | saving | saving as written | leverage | reuse |
|---|---|---|---|---|
| `examples/bach-invention08.urline.crux` (hand analysis, bars closed with `/`) | 60.6% | 78.0% | 3.25 | 1.8 |
| `examples/bach-invention14.urline.crux` (hand analysis, sixteenth grid) | 60.3% | 63.1% | 3.15 | 2.3 |
| `examples/bach-invention08.keylane.crux` (hand analysis, key lane) | 58.1% | 76.6% | 2.81 | 1.7 |
| Invention 14, search, lane encoding | 54.6% | | 3.38 | 3.8 |
| `examples/bach-invention14.keylane.v2.crux` (hand analysis, key lane) | 54.6% | 72.7% | 3.02 | 2.3 |
| `examples/bach-invention14.keylane.crux` (hand analysis, key lane) | 52.8% | 71.6% | 2.69 | 2.3 |
| `examples/bach-invention05.keylane.crux` (hand analysis, key lane) | 49.1% | 71.7% | 3.26 | 2.2 |
| `examples/bach-invention14.halfstep.crux` (hand analysis, half steps) | 43.8% | 65.8% | 1.95 | 2.6 |
| `examples/chorales/bwv269.compact.crux` (a chorale) | 43.0% | 43.0% | 1.30 | 6.0 |
| `examples/chorales/bach-invention1-full.analysis.crux` | 21.0% | 57.2% | 2.30 | 3.9 |

The hand analyses with a key lane are written in quarter notes. They would
score higher on a sixteenth grid, as the two `urline` files show.

## The survey

`tools/survey-kern.js` reads Humdrum `**kern` files, puts the music on its best
grid, runs the refactoring search (`streams: joint`, defaults) and scores the
result. Sources: `humdrum-tools/inventions` (15 scores) and
`humdrum-tools/bach-wtc-fugues` (48 scores). All 126 programs were run through
the interpreter and match the notes that the kern reader produced. The reader
itself was checked against a second reading only for Invention 14. This run is
from 2026-11-16. The note counts are the same as in the run before it.

```sh
node tools/survey-kern.js DIR_OF_KRN --out OUT_DIR
node tools/survey-kern.js --report OUT_DIR
```

Each score is refactored twice.

- **half**: accidentals in the voices as half steps.
- **lane**: integer steps only. The accidentals are assumed to come from a key
  lane. The lane's cost is added to the bits. The cost is an estimate from a
  greedy split into spans where each degree has one inflection ("lane spans").
  It is an upper bound: the entries are arbitrary 7-note states with raw
  durations, not key areas on a beat grid.

### What it shows

- The Inventions reduce best (mean saving 45% with half steps and 43% with a
  lane, lane leverage 2.6). WTC I is next (40% and 33%, 2.2), then WTC II (36%
  and 27%, 1.9).
- Sequence-driven pieces with one figure in constant motion come out on top:
  Inventions 8, 5, 14, 2 and 6, and the WTC I fugues in B-flat major (21),
  D major (5), G major (15) and E minor (10).
- The key lane helps where the chromatic notes follow the harmony. Invention 5
  goes from 52% to 60% and its leverage from 2.5 to 4.7. Invention 8 goes from
  52% to 60%. The WTC I E minor fugue goes from leverage 1.9 to 4.3, but its
  saving falls from 49% to 44%.
- With the estimated lane, the lane program is better than the half-step
  program in 10 of the 63 scores. It is more than 5 points worse in 38. The
  estimate is an upper bound and it did not get smaller with the new grid, so
  it now weighs more against the smaller programs. A hand-written lane in bar
  addresses costs much less: about 200 bits for Invention 14, against 478 for
  the estimate.
- The lane does not help chromatic or minor-key writing with many spans. For
  the WTC I fugues in F-sharp minor (14) and B-flat minor (22) and the WTC II
  fugues in E major (9) and G-sharp minor (18), the lane costs much more than
  it saves. Melodic minor and chromatic subjects need a per-voice or
  direction-aware rule.
- Slow stile antico fugues score worst: WTC I B-flat minor (22), WTC II E major
  (9) and C minor (2). They have long notes and few sequences.

### What the new grid changed

- The programs are smaller. The half-step programs have 17% fewer bits in
  total, and 57 of the 63 are smaller. Three are larger, because the search is
  greedy.
- The search makes fewer definitions and writes more pips. Mean lane leverage
  for the Inventions fell from 3.6 to 2.6. On a good grid a plain note is
  cheap, so a definition has to save more before it pays. Bits and leverage do
  not agree here. A reduction with much reuse is not always the one with the
  fewest bits.
- The order at the top is almost the same. Inventions 8, 5 and 14 and the WTC I
  B-flat major fugue are still the first four.

### Candidates for a hand analysis like Invention 14

1. Invention 5 in E-flat major. 60% with a lane. Lane leverage 4.7.
2. Invention 8 in F major. Canon at the octave. 60%, leverage 3.5.
3. WTC I Fugue 21 in B-flat major. 56%. Three voices, 18 lane spans.
4. Invention 2 in C minor. Strict canon. 53% with half steps, 51% with a lane.
5. WTC I Fugue 10 in E minor. Two voices. Leverage 4.3 with a lane.
6. WTC I Fugue 5 in D major and Fugue 15 in G major.

### Limits

- The kern reader is in the survey tool, not in `src/score`. It handles spine
  splits and joins, chords, ties and dotted and tuplet durations. It drops
  grace notes and reads the first key only. A chord or a split spine becomes
  an extra lane.
- The search is the default greedy one. A beam or a hand analysis can do
  better. For Invention 14 the hand analysis in quarter notes, with its real
  lane, has the same saving as the search with the estimated lane (54.6%). The
  hand analysis on a sixteenth grid is better (60.3%). The search has the
  higher leverage (3.4 against 3.2).
- The cost of the lane is an estimate in raw note lengths. It is not put on
  the best grid.
- Ornaments are not in these kern files.

### Full table

Sorted by saving with a key lane.

| rank | score | key | notes | chromatic | lane spans | saving (lane) | leverage (lane) | saving (half) | leverage (half) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | inven08 | F major | 598 | 7.4% | 14 | 59.7% | 3.50 | 51.6% | 2.36 |
| 2 | inven05 | Eb major | 734 | 11.0% | 25 | 59.7% | 4.68 | 52.1% | 2.47 |
| 3 | wtc1f21 | Bb major | 952 | 7.7% | 18 | 56.3% | 3.39 | 52.4% | 2.41 |
| 4 | inven14 | Bb major | 592 | 5.4% | 13 | 54.6% | 3.38 | 52.3% | 2.75 |
| 5 | inven02 | C minor | 635 | 10.6% | 22 | 51.1% | 2.75 | 53.1% | 2.02 |
| 6 | inven06 | E major | 547 | 10.2% | 25 | 50.2% | 2.58 | 52.6% | 2.09 |
| 7 | wtc1f05 | D major | 780 | 4.0% | 16 | 47.2% | 2.61 | 46.4% | 2.16 |
| 8 | wtc1f15 | G major | 1697 | 9.7% | 49 | 46.4% | 2.84 | 43.1% | 1.85 |
| 9 | wtc1f10 | E minor | 810 | 19.5% | 53 | 44.2% | 4.29 | 48.8% | 1.90 |
| 10 | inven15 | B minor | 477 | 11.7% | 13 | 43.7% | 1.98 | 43.6% | 1.63 |
| 11 | inven09 | F minor | 558 | 21.7% | 33 | 42.5% | 3.28 | 46.9% | 2.04 |
| 12 | inven12 | A major | 685 | 7.6% | 17 | 42.2% | 2.31 | 37.6% | 1.77 |
| 13 | wtc1f13 | F# major | 858 | 5.8% | 19 | 41.8% | 1.90 | 41.7% | 1.57 |
| 14 | inven01 | C major | 458 | 7.4% | 15 | 40.4% | 2.62 | 42.6% | 1.88 |
| 15 | wtc2f24 | B minor | 983 | 15.2% | 46 | 40.2% | 2.07 | 41.9% | 1.63 |
| 16 | inven03 | D major | 495 | 4.8% | 15 | 39.9% | 2.53 | 45.8% | 2.15 |
| 17 | wtc2f07 | Eb major | 707 | 5.9% | 28 | 38.5% | 2.00 | 47.2% | 1.79 |
| 18 | wtc1f03 | C# major | 1418 | 8.6% | 47 | 38.4% | 2.24 | 38.1% | 1.62 |
| 19 | wtc1f20 | A minor | 2204 | 12.5% | 90 | 38.4% | 2.07 | 41.5% | 1.75 |
| 20 | wtc1f02 | C minor | 754 | 15.1% | 45 | 38.2% | 2.39 | 46.5% | 1.65 |
| 21 | wtc1f06 | D minor | 718 | 19.1% | 45 | 36.9% | 2.80 | 39.1% | 1.73 |
| 22 | inven10 | G major | 439 | 3.9% | 8 | 36.8% | 1.78 | 42.7% | 1.56 |
| 23 | wtc1f23 | B major | 827 | 6.5% | 25 | 36.7% | 1.89 | 38.7% | 1.57 |
| 24 | inven04 | D minor | 443 | 11.7% | 16 | 36.4% | 2.10 | 40.0% | 1.67 |
| 25 | wtc2f01 | C major | 1035 | 5.4% | 35 | 36.3% | 2.21 | 43.1% | 1.99 |
| 26 | wtc1f01 | C major | 740 | 8.4% | 37 | 36.2% | 1.92 | 43.6% | 1.56 |
| 27 | wtc2f06 | D minor | 809 | 13.6% | 62 | 36.1% | 2.71 | 47.2% | 1.94 |
| 28 | wtc2f15 | G major | 693 | 8.2% | 23 | 34.7% | 1.90 | 35.5% | 1.51 |
| 29 | wtc1f19 | A major | 1182 | 7.8% | 53 | 34.7% | 1.79 | 40.4% | 1.49 |
| 30 | wtc2f12 | F minor | 1119 | 14.0% | 47 | 32.6% | 2.01 | 38.1% | 1.76 |
| 31 | wtc2f20 | A minor | 736 | 17.8% | 45 | 31.5% | 2.00 | 37.3% | 1.66 |
| 32 | wtc2f16 | G minor | 1662 | 13.0% | 68 | 31.3% | 1.65 | 35.3% | 1.43 |
| 33 | wtc2f13 | F# major | 1123 | 15.0% | 66 | 31.0% | 1.99 | 36.7% | 1.45 |
| 34 | wtc1f11 | F major | 670 | 6.4% | 26 | 30.6% | 2.16 | 39.9% | 1.76 |
| 35 | wtc1f17 | Ab major | 891 | 6.7% | 30 | 30.3% | 1.67 | 34.7% | 1.45 |
| 36 | wtc2f21 | Bb major | 964 | 8.8% | 45 | 30.3% | 2.48 | 37.9% | 2.03 |
| 37 | inven13 | A minor | 564 | 12.6% | 18 | 29.7% | 1.72 | 31.1% | 1.62 |
| 38 | wtc2f17 | Ab major | 1357 | 14.2% | 83 | 29.6% | 2.08 | 37.3% | 1.54 |
| 39 | wtc2f14 | F# minor | 1400 | 13.3% | 59 | 29.6% | 1.93 | 31.5% | 1.51 |
| 40 | wtc1f18 | G# minor | 805 | 16.3% | 47 | 29.4% | 1.63 | 38.1% | 1.42 |
| 41 | wtc1f04 | C# minor | 1326 | 13.0% | 72 | 29.2% | 2.06 | 39.2% | 1.72 |
| 42 | wtc1f09 | E major | 733 | 5.5% | 30 | 29.1% | 2.39 | 39.4% | 2.06 |
| 43 | inven11 | G minor | 568 | 16.2% | 43 | 28.5% | 2.37 | 42.0% | 1.67 |
| 44 | wtc1f16 | G minor | 754 | 12.2% | 38 | 28.4% | 1.95 | 35.7% | 1.68 |
| 45 | wtc1f24 | B minor | 1806 | 19.3% | 125 | 28.3% | 2.44 | 39.3% | 1.74 |
| 46 | wtc2f10 | E minor | 1439 | 16.6% | 82 | 28.3% | 2.03 | 37.1% | 1.65 |
| 47 | wtc2f23 | B major | 1319 | 10.8% | 67 | 26.4% | 1.67 | 37.1% | 1.38 |
| 48 | inven07 | E minor | 473 | 10.1% | 20 | 26.4% | 1.78 | 35.1% | 1.49 |
| 49 | wtc2f19 | A major | 754 | 11.8% | 47 | 24.5% | 2.23 | 32.5% | 1.54 |
| 50 | wtc1f07 | Eb major | 900 | 8.4% | 50 | 24.4% | 1.83 | 34.1% | 1.40 |
| 51 | wtc1f12 | F minor | 1319 | 19.4% | 90 | 22.3% | 1.95 | 33.7% | 1.41 |
| 52 | wtc2f22 | Bb minor | 1752 | 16.7% | 116 | 20.6% | 1.74 | 32.6% | 1.34 |
| 53 | wtc2f05 | D major | 880 | 7.7% | 42 | 19.7% | 1.64 | 32.8% | 1.44 |
| 54 | wtc2f11 | F major | 979 | 11.3% | 53 | 19.5% | 1.64 | 28.0% | 1.21 |
| 55 | wtc2f03 | C# major | 849 | 6.5% | 39 | 19.2% | 1.42 | 26.3% | 1.20 |
| 56 | wtc2f04 | C# minor | 1353 | 14.3% | 96 | 17.5% | 1.96 | 34.4% | 1.66 |
| 57 | wtc2f08 | D# minor | 1025 | 15.3% | 75 | 17.1% | 1.64 | 32.0% | 1.45 |
| 58 | wtc2f09 | E major | 750 | 7.3% | 47 | 16.9% | 1.43 | 34.0% | 1.33 |
| 59 | wtc1f08 | D# minor | 1385 | 12.1% | 91 | 16.3% | 1.72 | 33.0% | 1.48 |
| 60 | wtc1f14 | F# minor | 811 | 18.2% | 69 | 16.0% | 2.00 | 42.5% | 1.52 |
| 61 | wtc1f22 | Bb minor | 745 | 13.0% | 45 | 15.6% | 1.52 | 28.5% | 1.29 |
| 62 | wtc2f02 | C minor | 660 | 15.3% | 45 | 13.6% | 1.32 | 27.3% | 1.26 |
| 63 | wtc2f18 | G# minor | 1529 | 17.5% | 123 | 13.3% | 1.72 | 35.1% | 1.49 |
