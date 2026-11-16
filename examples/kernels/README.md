# Kernels

A kernel is a small set of mots that approximates one chorale. Every file here is
plain Crux and plays in the interpreter. The `.json` beside each file gives the fit,
the numbers per level, and the reach of every step number (how many notes move when
it goes up by one), widest first. Its line numbers point into the `.crux` file.

A kernel has three levels.

- **Beat figures**, such as `A2 = [0 | 2]` or `A3 = [0 | 3/2, -1 | 1/2]`. A note held
  across a beat stays one note. The figures are a codebook of `k1` prototypes chosen by
  weighted k-medoids on a time grid (24 slots per quarter). Each beat of the music
  becomes its nearest prototype.
- **Phrases**, such as `R5 = R3, (R1 * [2]), (R2 * [2]), (A1 * [3]), (R1 * [2]), A2`.
  Repeats are found on the sequence of beat figures, so a phrase that starts on a
  pickup is found whole. Exact repeats come first. With `--lossy P`, a near-repeat is
  then replaced by a copy of the source when the numbers it saves outweigh the error,
  at P numbers per quarter note of extra error.
- **Voice lines**, such as `(R4 * [7]), (R5 * [7]), (A1 * [9, 9])`.

"Numbers" counts the step numbers written in the program, which is what a person can
wiggle. The literal program has one number per note.

## Examples

| file | notes | numbers | pitch fit | notes fit | every note exact |
|---|---|---|---|---|---|
| `bwv269.soprano.approx` | 46 | 23 | 90.5% | 82.6% | |
| `bwv269.soprano.exact` | 46 | 34 | 100% | 100% | yes |
| `bwv269.approx` | 225 | 94 | 91.9% | 80.9% | |
| `bwv269.exact` | 225 | 130 | 100% | 100% | yes |
| `bwv227.1.soprano.approx` | 59 | 25 | 97.4% | 88.1% | |
| `bwv227.1.soprano.exact` | 59 | 36 | 100% | 100% | yes |
| `bwv227.1.approx` | 279 | 92 | 95.1% | 89.2% | |
| `bwv227.1.exact` | 279 | 116 | 100% | 100% | yes |
| `bwv1.6.soprano.exact` | 70 | 27 | 100% | 100% | yes |

The BWV 269 soprano at 23 numbers is two figures (a quarter and a half note), six
phrases and a voice line of eleven references. It drops the dotted rhythms, which is
most of its error. `R5` is the end of the first phrase and the whole second phrase.
The chorale closes with nearly the same music, so the last reference is `R5` again.

## How far a chorale shrinks

Numbers needed to reach a pitch fit, from the Pareto front of `--sweep` (k1 from 2 to
32, measure shapes on or off, inversion on or off, lossy price none, 2, 1, 0.5 or
0.25). The exact column is the smallest kernel that reproduces every note in MIDI
pitch, onset and duration. Per-note figures are in brackets.

All four voices:

| chorale | notes | 80% | 90% | 95% | exact |
|---|---|---|---|---|---|
| BWV 269 | 225 | 72 (0.32) | 94 (0.42) | 112 (0.50) | 130 (0.58) |
| BWV 227.1 | 279 | 66 (0.24) | 83 (0.30) | 92 (0.33) | 116 (0.42) |
| BWV 1.6 | 344 | 85 (0.25) | 93 (0.27) | 106 (0.31) | 140 (0.41) |
| BWV 10.7 | 206 | 62 (0.30) | 87 (0.42) | 99 (0.48) | 116 (0.56) |
| BWV 244.62 | 198 | 81 (0.41) | 91 (0.46) | 101 (0.51) | 130 (0.66) |
| BWV 140.7 | 276 | 90 (0.33) | 114 (0.41) | 130 (0.47) | |

Soprano alone:

| chorale | notes | 80% | 90% | 95% | exact |
|---|---|---|---|---|---|
| BWV 269 | 46 | 20 (0.43) | 23 (0.50) | 27 (0.59) | 34 (0.74) |
| BWV 227.1 | 59 | 20 (0.34) | 24 (0.41) | 25 (0.42) | 36 (0.61) |
| BWV 1.6 | 70 | 24 (0.34) | 26 (0.37) | 26 (0.37) | 27 (0.39) |
| BWV 10.7 | 43 | 17 (0.40) | 17 (0.40) | 17 (0.40) | 21 (0.49) |
| BWV 244.62 | 45 | 26 (0.58) | 31 (0.69) | 32 (0.71) | 40 (0.89) |
| BWV 140.7 | 62 | 28 (0.45) | 28 (0.45) | 33 (0.53) | 41 (0.66) |

BWV 140.7 has many distinct beat figures. Its four voices need k1 = 256 to come out
exact, so the sweep does not reach it.

## Regenerate

```sh
B=../media/music_xml/bach; E=examples/kernels
node tools/fit-kernel.js $B/bwv269.mxl --voices S --k1 2 --k2 0 --lossy 0.5 --out $E/bwv269.soprano.approx.kernel.crux
node tools/fit-kernel.js $B/bwv269.mxl --voices S --k1 4 --k2 0 --invert --out $E/bwv269.soprano.exact.kernel.crux
node tools/fit-kernel.js $B/bwv269.mxl --k1 2 --k2 0 --lossy 1 --out $E/bwv269.approx.kernel.crux
node tools/fit-kernel.js $B/bwv269.mxl --k1 16 --k2 0 --out $E/bwv269.exact.kernel.crux
node tools/fit-kernel.js $B/bwv227.1.mxl --voices S --k1 2 --k2 0 --out $E/bwv227.1.soprano.approx.kernel.crux
node tools/fit-kernel.js $B/bwv227.1.mxl --voices S --k1 8 --k2 0 --invert --out $E/bwv227.1.soprano.exact.kernel.crux
node tools/fit-kernel.js $B/bwv227.1.mxl --k1 4 --k2 0 --lossy 0.5 --out $E/bwv227.1.approx.kernel.crux
node tools/fit-kernel.js $B/bwv227.1.mxl --k1 16 --k2 0 --out $E/bwv227.1.exact.kernel.crux
node tools/fit-kernel.js $B/bwv1.6.mxl --voices S --k1 2 --k2 0 --out $E/bwv1.6.soprano.exact.kernel.crux
node tools/fit-kernel.js $B/bwv269.mxl --sweep
node tools/fit-kernel.js $B/bwv269.mxl --sweep --voices S
```
