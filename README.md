# Crux

A tiny language for algorithmic music. Build phrases ("mots") from relative pitch/time events ("pips"), then transform and combine them with a small, composable operator set.

- Relative pitch (step) and duration (timeScale), including fractional steps like `1/2`
- Two mapping semantics for binary ops: **fan** (spread) and **cog** (tile)
- Concise sequencing: concatenation, postfix repeat, drop and subdivide
- Musical transforms: steps, mirror, lens, tie, constraint, jam, rotate, fold, Glass, Reich, Pärt
- Parallel voices with `!`, chords with `&`

## Discover representations from MIDI

`npm run represent -- input.mid --pitch-regime auto --top-k 5`

Finds ranked explanations built from a small vocabulary of recurring motifs.
See [REPRESENTATIONS.md](REPRESENTATIONS.md) for the API, scoring, and Bach tests.

## Refactor scores (MusicXML or MIDI, all voices)

`node tools/score-to-crux.js chorale.mxl`

Converts every voice to Crux and searches for a shorter program built from shared,
nested motifs. Results on the 409 Bach chorales, the motif library learned from them,
and notes on searching the space of Crux programs are in [REFACTORING.md](REFACTORING.md).
Worked examples are in [examples/chorales](examples/chorales).

# Install

Inside disrupterbox:

git clone https://github.com/animist-os/crux.git
