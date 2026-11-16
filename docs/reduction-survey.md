# Reduction score, and a survey of the Inventions and the WTC fugues

## The score

`tools/reduction-score.js` scores any Crux program, hand-written or found by the
refactoring search.

```sh
node tools/reduction-score.js examples/bach-invention14.keylane.crux
```

| number | meaning |
|---|---|
| **saving** | `1 - bits / literalBits`. Bits are the description length of the program text (`src/refactor/cost.js`, the measure the refactoring search already uses). `literalBits` is the same music as one literal mot per voice. |
| **leverage** | Sounding notes per pip written in the source. Every number or rest in a mot counts, also operator arguments. |
| **reuse** | References to defined names per definition. |

Saving is the headline number. It rewards reuse and a short source on one
scale, and a reference that saves little is worth little. Leverage is the
plain-language companion: "one written pip makes N notes".

Reuse is reported but it is not a good score by itself. In this survey the
fugues that reduce worst have the highest reuse, because the search falls back
on two-note motifs that it uses a hundred times. A motif count does not say how
long the motifs are. Saving does.

A `// #keyLane` line is part of the program. Its bits and its entries are
counted.

Reference points:

| program | saving | leverage | reuse |
|---|---|---|---|
| `examples/bach-invention14.keylane.crux` (hand analysis, key lane) | 72.2% | 2.69 | 2.3 |
| `examples/bach-invention14.halfstep.crux` (hand analysis, half steps) | 65.8% | 1.95 | 2.6 |
| Invention 14, search, lane encoding | 70.4% | 3.70 | 3.6 |
| `examples/chorales/bach-invention1-full.analysis.crux` | 57.2% | 2.30 | 3.9 |
| `examples/chorales/bwv269.compact.crux` (a chorale) | 43.0% | 1.30 | 6.0 |

## The survey

`tools/survey-kern.js` reads Humdrum `**kern` files, runs the refactoring
search (`streams: joint`, defaults) and scores the result. Sources:
`humdrum-tools/inventions` (15 scores) and `humdrum-tools/bach-wtc-fugues`
(48 scores). All 126 programs were run through the interpreter and match the
notes that the kern reader produced. The reader itself was checked against a
second reading only for Invention 14.

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

- The Inventions reduce best (mean lane saving 62%, leverage 3.6). WTC I is
  next (51%, 2.8), then WTC II (45%, 2.4).
- Sequence-driven pieces with one figure in constant motion come out on top:
  Inventions 5, 8, 14 and 2, and the WTC I fugues in B-flat major (21),
  E minor (10), D major (5) and G major (15).
- The key lane helps most where the chromatic notes follow the harmony:
  Invention 5 goes from 66% to 75% and its leverage from 3.3 to 6.2. The WTC I
  E minor fugue goes from leverage 3.1 to 5.9.
- The lane does not help chromatic or minor-key writing with many spans. For
  the WTC I fugues in F-sharp minor (14) and B-flat minor (22) and the WTC II
  fugues in E major (9) and G-sharp minor (18), the lane costs more than it
  saves. Melodic minor and chromatic subjects need a per-voice or
  direction-aware rule.
- Slow stile antico fugues score worst: WTC I B-flat minor (22), WTC II E major
  (9) and C minor (2). They have long notes and few sequences.

### Candidates for a hand analysis like Invention 14

1. Invention 5 in E-flat major. Best score of all. Lane leverage 6.2.
2. Invention 8 in F major. Canon at the octave. 74%, leverage 5.1.
3. WTC I Fugue 21 in B-flat major. 71%. Three voices, 18 lane spans.
4. Invention 2 in C minor. Strict canon. 68% in both encodings.
5. WTC I Fugue 10 in E minor. Two voices. Leverage 5.9 with a lane.
6. WTC I Fugue 5 in D major and Fugue 15 in G major.

### Limits

- The kern reader is in the survey tool, not in `src/score`. It handles spine
  splits and joins, chords, ties and dotted and tuplet durations. It drops
  grace notes and reads the first key only. A chord or a split spine becomes
  an extra lane.
- The search is the default greedy one. A beam or a hand analysis can do
  better. The hand analysis of Invention 14 beats the search on saving with
  half steps removed (72.2% with its real lane against 70.4% with the estimated
  lane), and loses on leverage.
- Ornaments are not in these kern files.

### Full table

Sorted by saving with a key lane.

| rank | score | key | notes | chromatic | lane spans | saving (lane) | leverage (lane) | saving (half) | leverage (half) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | inven05 | Eb major | 734 | 11.0% | 25 | 74.8% | 6.22 | 66.0% | 3.26 |
| 2 | inven08 | F major | 598 | 7.4% | 14 | 74.3% | 5.07 | 65.4% | 3.15 |
| 3 | wtc1f21 | Bb major | 952 | 7.7% | 18 | 71.2% | 4.18 | 66.8% | 3.28 |
| 4 | inven14 | Bb major | 592 | 5.4% | 13 | 70.4% | 3.70 | 67.6% | 2.95 |
| 5 | inven02 | C minor | 635 | 10.6% | 22 | 68.4% | 4.38 | 67.3% | 3.41 |
| 6 | wtc1f10 | E minor | 810 | 19.5% | 53 | 67.0% | 5.87 | 63.7% | 3.09 |
| 7 | wtc1f05 | D major | 780 | 4.0% | 16 | 66.0% | 2.69 | 64.7% | 2.26 |
| 8 | wtc1f15 | G major | 1697 | 9.7% | 49 | 64.3% | 3.68 | 58.2% | 2.55 |
| 9 | inven09 | F minor | 558 | 21.7% | 33 | 63.0% | 4.23 | 60.5% | 2.67 |
| 10 | inven12 | A major | 685 | 7.6% | 17 | 62.9% | 3.44 | 57.0% | 2.51 |
| 11 | inven03 | D major | 495 | 4.8% | 15 | 62.6% | 3.51 | 62.5% | 2.81 |
| 12 | inven01 | C major | 458 | 7.4% | 15 | 61.8% | 3.14 | 57.1% | 2.30 |
| 13 | inven04 | D minor | 443 | 11.7% | 16 | 60.7% | 3.06 | 56.6% | 2.27 |
| 14 | wtc2f01 | C major | 1035 | 5.4% | 35 | 59.8% | 2.94 | 60.5% | 2.48 |
| 15 | inven06 | E major | 547 | 10.2% | 25 | 59.6% | 2.96 | 59.5% | 2.42 |
| 16 | wtc1f03 | C# major | 1418 | 8.6% | 47 | 59.5% | 3.14 | 55.0% | 2.40 |
| 17 | inven10 | G major | 439 | 3.9% | 8 | 58.6% | 2.91 | 57.2% | 2.45 |
| 18 | wtc1f13 | F# major | 858 | 5.8% | 19 | 56.6% | 2.53 | 53.7% | 2.18 |
| 19 | wtc1f09 | E major | 733 | 5.5% | 30 | 56.4% | 2.82 | 60.6% | 2.48 |
| 20 | wtc2f24 | B minor | 983 | 15.2% | 46 | 56.2% | 2.92 | 53.4% | 2.15 |
| 21 | wtc1f11 | F major | 670 | 6.4% | 26 | 56.1% | 2.82 | 58.1% | 2.38 |
| 22 | inven15 | B minor | 477 | 11.7% | 13 | 56.0% | 2.58 | 55.5% | 2.36 |
| 23 | wtc1f20 | A minor | 2204 | 12.5% | 90 | 55.7% | 3.01 | 54.1% | 2.32 |
| 24 | wtc1f06 | D minor | 718 | 19.1% | 45 | 55.5% | 3.09 | 53.0% | 2.14 |
| 25 | wtc2f12 | F minor | 1119 | 14.0% | 47 | 55.4% | 2.98 | 55.1% | 2.57 |
| 26 | inven11 | G minor | 568 | 16.2% | 43 | 55.3% | 3.36 | 57.0% | 2.34 |
| 27 | wtc1f02 | C minor | 754 | 15.1% | 45 | 54.9% | 2.86 | 57.0% | 2.31 |
| 28 | wtc2f21 | Bb major | 964 | 8.8% | 45 | 53.6% | 2.51 | 56.3% | 2.16 |
| 29 | wtc2f19 | A major | 754 | 11.8% | 47 | 53.6% | 2.92 | 52.9% | 2.20 |
| 30 | wtc1f23 | B major | 827 | 6.5% | 25 | 53.4% | 2.54 | 52.1% | 2.15 |
| 31 | wtc2f15 | G major | 693 | 8.2% | 23 | 52.6% | 2.29 | 50.8% | 1.96 |
| 32 | wtc2f17 | Ab major | 1357 | 14.2% | 83 | 52.5% | 2.86 | 53.2% | 2.15 |
| 33 | wtc2f20 | A minor | 736 | 17.8% | 45 | 52.4% | 2.35 | 53.6% | 1.95 |
| 34 | inven13 | A minor | 564 | 12.6% | 18 | 52.2% | 2.79 | 48.9% | 2.19 |
| 35 | wtc1f01 | C major | 740 | 8.4% | 37 | 51.6% | 2.53 | 52.7% | 1.95 |
| 36 | wtc2f06 | D minor | 809 | 13.6% | 62 | 51.1% | 2.89 | 56.9% | 2.34 |
| 37 | wtc1f17 | Ab major | 891 | 6.7% | 30 | 50.5% | 2.31 | 50.7% | 1.96 |
| 38 | inven07 | E minor | 473 | 10.1% | 20 | 49.7% | 2.35 | 50.3% | 2.01 |
| 39 | wtc2f14 | F# minor | 1400 | 13.3% | 59 | 48.4% | 2.45 | 46.5% | 1.91 |
| 40 | wtc2f04 | C# minor | 1353 | 14.3% | 96 | 48.1% | 3.04 | 53.1% | 2.39 |
| 41 | wtc1f16 | G minor | 754 | 12.2% | 38 | 47.9% | 2.32 | 49.4% | 1.91 |
| 42 | wtc2f16 | G minor | 1662 | 13.0% | 68 | 47.9% | 2.22 | 48.2% | 1.84 |
| 43 | wtc1f24 | B minor | 1806 | 19.3% | 125 | 47.9% | 3.04 | 52.9% | 2.30 |
| 44 | wtc2f10 | E minor | 1439 | 16.6% | 82 | 46.3% | 2.64 | 48.9% | 2.10 |
| 45 | wtc1f07 | Eb major | 900 | 8.4% | 50 | 45.4% | 2.51 | 47.5% | 2.00 |
| 46 | wtc1f12 | F minor | 1319 | 19.4% | 90 | 44.3% | 2.47 | 49.1% | 2.02 |
| 47 | wtc1f19 | A major | 1182 | 7.8% | 53 | 44.3% | 2.36 | 46.1% | 1.96 |
| 48 | wtc2f23 | B major | 1319 | 10.8% | 67 | 43.3% | 2.26 | 48.0% | 1.97 |
| 49 | wtc2f11 | F major | 979 | 11.3% | 53 | 42.6% | 2.15 | 42.9% | 1.69 |
| 50 | wtc2f13 | F# major | 1123 | 15.0% | 66 | 42.1% | 2.26 | 44.2% | 1.77 |
| 51 | wtc2f05 | D major | 880 | 7.7% | 42 | 42.0% | 2.23 | 47.8% | 1.94 |
| 52 | wtc1f18 | G# minor | 805 | 16.3% | 47 | 41.5% | 1.83 | 44.4% | 1.57 |
| 53 | wtc1f04 | C# minor | 1326 | 13.0% | 72 | 39.9% | 2.15 | 47.7% | 1.89 |
| 54 | wtc1f14 | F# minor | 811 | 18.2% | 69 | 39.5% | 2.68 | 53.3% | 2.27 |
| 55 | wtc2f07 | Eb major | 707 | 5.9% | 28 | 38.5% | 2.00 | 47.2% | 1.79 |
| 56 | wtc1f08 | D# minor | 1385 | 12.1% | 91 | 37.1% | 2.23 | 46.1% | 1.96 |
| 57 | wtc2f03 | C# major | 849 | 6.5% | 39 | 36.1% | 1.64 | 37.2% | 1.48 |
| 58 | wtc2f08 | D# minor | 1025 | 15.3% | 75 | 34.8% | 2.32 | 42.5% | 1.82 |
| 59 | wtc2f22 | Bb minor | 1752 | 16.7% | 116 | 33.7% | 1.77 | 44.3% | 1.46 |
| 60 | wtc2f18 | G# minor | 1529 | 17.5% | 123 | 31.3% | 2.28 | 44.1% | 1.93 |
| 61 | wtc2f02 | C minor | 660 | 15.3% | 45 | 29.4% | 1.74 | 35.2% | 1.55 |
| 62 | wtc2f09 | E major | 750 | 7.3% | 47 | 16.9% | 1.43 | 34.0% | 1.33 |
| 63 | wtc1f22 | Bb minor | 745 | 13.0% | 45 | 15.6% | 1.52 | 28.5% | 1.29 |
