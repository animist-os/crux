# Crux Decomposition Engine

Notes on the design and development of `src/decompose.js` and the corpus pipeline.

## Purpose

The decomposer takes a flat evaluated Mot (a sequence of Pips with step and timeScale values) and discovers candidate Crux programs that reproduce it. The goal is not minimal character count — it's to reveal musical structure: repeated motifs, scalar runs, transpositions, and rhythmic patterns.

## Architecture

### Three-Phase Pipeline

1. **Analyze** — Extract features from the pip sequence: intervals, progressions (constant-delta runs), and repeats (periodic patterns).
2. **Discover** — Generate candidate AST programs from features. Each discoverer targets a different structural pattern.
3. **Assemble** — Verify candidates via round-trip through `golden.crux_interp()`, score them, attempt variable hoisting and relationship detection, then sort and deduplicate.

### AST Node Types

| Node | Output | Use |
|------|--------|-----|
| `DLiteral` | `[0, 1, 2]` | Raw pip sequence |
| `DRange` | `[0->4]` | Ascending/descending scalar runs |
| `DBinOp` | `expr * [N]` | Binary operators (`.j`, `*`, `^`) |
| `DConcat` | `a, b, c` | Sequencing multiple expressions |
| `DRepeat` | `expr : N` | Repeat N times |
| `DRhythmMask` | `[\|, \|2, \|/2]` | TimeScale-only pips for `.j` |
| `DAssign` | `aa = expr` | Variable assignment |
| `DRef` | `aa` | Variable reference |
| `DProgram` | Multi-line | Assignments + final expression |

### Discoverers

- **Ranges** — Detect ±1 step runs (ascending/descending scales). Full-sequence ranges or segmented with literal gaps.
- **Repeats** — Detect periodic repetition of a sub-pattern. Exact and truncated variants.
- **Progressions** — Constant-delta arithmetic sequences (non-unit). Full-sequence or segmented.

### Rhythm Factoring

When a pip sequence has non-uniform timeScales, the engine:
1. Strips rhythm to get step-only pips (all ts=1)
2. Runs discoverers on the step-only sequence
3. Builds a rhythm mask from the original timeScales
4. Recombines via `.j`: `stepExpr .j rhythmMask`

The rhythm mask is extracted into a named `rhythm` variable for readability. The flattened comment in the corpus output also uses `.j rhythm` so the step structure is directly comparable.

## Scoring

Scoring combines compression (character reduction of step expression vs. literal) with structure (named motifs and relationships).

### Compression

Measures only the step expression (left of `.j`), compared against a step-only literal baseline. Rhythm masks are excluded since they're boilerplate reconstruction of timeScales.

### Structure Score

Each hoisted variable earns +0.15 (a named motif). Each additional use beyond the minimum two earns +0.05 (revealed repetition). Inter-variable relationships earn +0.40 each (structural insight).

```
total = compression + structure
```

Structure dominates by design. A program that costs more characters but names three motifs and shows one is a transposition of another scores higher than a shorter program that reveals nothing.

## Variable Hoisting

After a candidate is verified, the engine searches for repeated sub-expressions in the AST:
1. Walk the AST, collect all sub-expression strings and their occurrence counts.
2. Select by structural value: `occurrences * expression_length`. This prioritizes naming motifs that appear many times and/or are non-trivial, regardless of character savings.
3. Substitute the most valuable repeated sub-expression with a named variable (`aa`, `ab`, `ac`, ...).
4. Repeat until no more hoistable sub-expressions remain.

`MIN_HOIST_LEN = 5` — sub-expressions shorter than 5 characters aren't considered.

## Inter-Variable Relationships

After hoisting, the engine tries to express later variables in terms of earlier ones:

- **Transposition**: If `ab` is `aa` shifted by a constant step offset, rewrite as `ab = aa * [offset]`.
- **Retrograde**: If `ab` is `aa` reversed (with optional transposition), rewrite as `ab = aa * [offset | -1]`.

This is the highest-value structural insight. Example from Frere Jacques:
```
aa = [0->2]       // do-re-mi
ab = aa * [2]      // mi-fa-sol (same motif, transposed up 2 steps)
```

If relationship rewrites break verification (the rewritten program doesn't produce the same output), the engine falls back to the hoist-only version.

## Corpus Pipeline

### Source of Truth

**MIDI files** in `corpus/midi_src/` are the source of truth for pitch and rhythm. These are manually curated and corrected against published scores.

**Metadata** in `corpus/melodies.yaml` (name, source, category, key, pitchRegime, tonic, notes) is maintained by hand. The `crux:` block is regenerated from MIDI on each pipeline run.

### Files

- `corpus/midi_src/*.mid` — Curated MIDI files (source of truth for notes/rhythm).
- `corpus/melodies.yaml` — Metadata + derived diatonic Crux notation.
- `corpus/melodies_decomposed.yaml` — Generated. Each melody gets a `decompositions` array of scored candidates.
- `modules/golden/golden_crux_corpus.js` — Generated Doh.Module for the GoldenCruxPanel examples browser.

### Generation Steps

```
corpus/midi_src/*.mid                           (source of truth)
    ↓ reanalyze-corpus.js
corpus/melodies.yaml                            (metadata + derived crux)
    ↓ generate_decomposed.js
corpus/melodies_decomposed.yaml                 (scored decomposition candidates)
    ↓ generate_crux_corpus.js
modules/golden/golden_crux_corpus.js            (loadable Doh.Module)
```

All three steps are run via `scripts/update_crux_corpus.sh`. Supports `--dry-run` (step 1 only, no writes) and `--verbose`.

### Directives

Each program includes Crux directive comments:
```
// #pitchRegime Major
// #tonic 0
```
These are parsed by `golden.CruxExtractDirectives()` and tell the player what scale and root pitch to use. The tonic value is stored as pitch class (0-11, i.e., `tonic % 12`).

### Output Format

For melodies with rhythm factoring, the generated program looks like:
```
// Frere Jacques — flattened: [0, 1, 2, 0, 0, 1, 2, 0, ...] .j rhythm
// #pitchRegime Major
// #tonic 0
aa = [0->2]
ab = aa * [2]
ac = [5->2]
rhythm = [|, |, |, |, |, |, |, |, |, |, |2, ...]
(aa, [0], aa, [0], ab, ab, [4], ac, [0, 4], ac, [0, 0, -3, 0, 0, -3, 0]) .j rhythm
```

The flattened comment strips timeScales to show step-only values, making it easy to compare the compressed step expression against the original.

## Current Results (34 melodies)

- 31 melodies produce non-literal decompositions
- 14 melodies produce hoisted variables
- 3 melodies have inter-variable relationships (transposition):
  - **frere-jacques**: `ab = aa * [2]`
  - **ode-to-joy**: `ac = aa * [-2]`
  - **trance-arp**: `ac = aa * [4]`, `ad = aa * [7]`
- 49 total corpus program entries (some melodies produce multiple candidate decompositions)

## Supporting Tools

- `tools/reanalyze-corpus.js` — Reads MIDI files + YAML metadata, converts to diatonic Crux, patches YAML in place. First step of the pipeline. Uses curated pitchRegime/tonic from YAML; auto-detects if absent.
- `tools/find-regime.js` — Maps pitchRegime names to pitch class sets. Provides `chromaticToDiatonic()` and `diatonicToChromatic()` for converting between scale-degree steps and chromatic semitones.
- `tools/midi-to-crux.js` — Low-level MIDI-to-Crux utilities: `findBaseDuration()`, `quantizeTimeScale()`, `formatMot()`.
- `tools/generate-corpus-midi.js` — Generates MIDI files from YAML (reverse direction, for audition after YAML edits).
- `test/corpus.test.js` — Validates corpus YAML structure, pitchRegime/tonic values, crux parsing, and round-trip consistency.

## Design Principles

1. **Structure over compression.** Naming a motif used three times is more valuable than saving characters. The scoring reflects this.
2. **Relationships are the biggest win.** Showing that one motif is a transposition of another reveals deep musical structure. These are rewarded heavily (+0.40 per relationship).
3. **Rhythm is factored out.** The `.j` operator separates step content from timeScale content. This isolates the melodic structure for analysis while preserving rhythmic accuracy.
4. **Every candidate is verified.** Round-trip through `golden.crux_interp()` ensures the decomposed program produces exactly the same pips as the original.
5. **Hoisting reveals, it doesn't optimize.** There is no minimum character savings threshold. If a sub-expression appears twice and is at least 5 characters, it gets a name.
