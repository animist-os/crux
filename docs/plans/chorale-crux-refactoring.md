# Plan: Bach chorales → Crux → motivic refactoring

Status (2026-10-25): phases 1 to 5 done, except 4d (skeleton + diminution streams) and 4e (generic-degree lens), which became proposals. Results and findings are in `REFACTORING.md`. Built by Claude (Opus, degraded-tier) overnight.

## End state

1. `src/score/`: a zero-dependency reader for MusicXML (`.mxl` and `.xml`) that
   produces a normalized **Score**: parts with spelled pitches, onsets and
   durations in integer ticks, ties merged, plus fermatas, measures, meter and key.
   MIDI is adapted into the same shape.
2. `src/score/to-crux.js`: Score → per-voice pips under a choice of **pitch lens**
   (`chromatic` = semitones from the tonic; `diatonic` = scale degrees in the key
   collection, with chromatic notes as half-integer inflections). Emits literal Crux
   with directives, decodes Crux back to note events, and verifies MIDI-exact
   round trips.
3. `src/refactor/`: a search engine that rewrites the literal program into a shorter
   Crux program sharing motifs across all four voices. Every candidate is
   verified by running it through the real interpreter.
4. A cost model (`src/refactor/cost.js`) measured on Crux **text**, so programs
   found by any method (the existing `findRepresentations`, the new engine, hand
   written) are compared on one scale.
5. CLI tools, a corpus benchmark over every SATB chorale, tests, example `.crux`
   files and a written report.

## Phases (each leaves `npm test` green)

1. Score model + MusicXML reader. Verify against all 408 corpus files, and against
   the soprano manifest of the existing exporter (`test/fixtures/bach`).
2. Pitch lenses + literal Crux + decoder + round trip (all voices, whole corpus).
3. Baseline: existing `findRepresentations` on 4 voices, in both lenses.
4. New engine, added in measured increments:
   a. text cost model (bits);
   b. hierarchical motif abstraction (motifs inside motifs), shared across voices,
      under transposition, inversion, retrograde and augmentation;
   c. sequence factoring (`M * [0, -1, -2]`) and repetition;
   d. Schenker level 1: beat skeleton + diminution figures (`skeleton @ [@i fig]`);
   e. generic-degree lens: match motifs on letter names; chromatic inflections
      carried by a sparse `@` layer;
   f. corpus-level library: motifs learned across chorales, cost amortized.
5. Benchmark, examples, report, fresh-context review.

## Decisions (flag for Andy)

- Written form is the default: repeats are read once, as the existing exporter
  does. `repeats: 'expand'` is available but makes bar-form chorales trivially
  compressible.
- Tonic = the key's tonic, from the signature most parts agree on and the
  soprano's `<mode>` (the corpus marks minor reliably only on the soprano). The
  first idea, the final bass note, was dropped: the encodings state the key.
- Golden rounds fractional steps down to the lower degree (`golden_crux.js`
  line ~55), so diatonic-lens output with chromatic inflections will not play
  correctly in Golden until a small patch is made. Chromatic-lens output plays
  today. No Golden code was changed; a proposed patch is in the report.
- No commits (not asked). New files only, plus additive npm scripts and a README section.
