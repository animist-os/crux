# Proposal: play diatonic half-steps in Golden

Implemented 2026-11-16, with one change from the patch below. Golden's
`playNote` rebuilds the pitch from `regimeStep` and adds `note.inflection`, so
the semitone is added to `inflection`, not to `rawStep`. The rule is
`golden.CruxKeyLane.halfStep` in `modules/golden/golden_crux_keylane.js`. It
adds to any key lane inflection. `crux_injector.js` is not loaded by any module
and was not changed. The text below is the original proposal.

## The problem

The chorale converter's **diatonic lens** writes pitches as scale degrees in the
key-signature collection. It writes a chromatic note as a half-integer:
`k + 1/2` means degree `k` raised a semitone. In C major, F♯ is `3 1/2` (written
`7/2`); in A minor, G♯ is `-1/2`. About 7% of the notes in the 409 chorales are
chromatic.

Golden rounds a fractional step down (`modules/golden/golden_crux.js`, about
line 55):

```js
let val = pip.step;
let step = (val - Math.floor(val) <= 0.5) ? Math.floor(val) : Math.ceil(val);
...
const rawStep = golden.RegimeStepToStep(step);
```

So `7/2` plays as F, not F♯. Every leading tone in a minor-key chorale comes out
natural.

## Proposed change

Treat an exact half-step as "the lower degree, raised a semitone". Every other
fractional step keeps its current rounding.

```js
let val = pip.step;
const base = Math.floor(val + 1e-9);
const half = Math.abs(val - base - 0.5) < 1e-9;      // k + 1/2
let step = half ? base : ((val - Math.floor(val) <= 0.5) ? Math.floor(val) : Math.ceil(val));
...
const rawStep = golden.RegimeStepToStep(step) + (half ? 1 : 0);
```

Diads go through the same conversion (`diadRawStep = golden.RegimeStepToStep(ds)`,
about line 133) and need the same two lines. `crux_injector.js` duplicates this
code (lines ~56 and ~83).

## Why this definition

- Every chromatic pitch gets a code. A diatonic collection never has a gap larger
  than a whole tone, so the note between two degrees is always "lower degree +
  1 semitone". The lens is MIDI-lossless for every key (tested for all 15
  key signatures × 2 modes × MIDI 30–90).
- Transposition by whole degrees keeps the meaning: `7/2 + 1 = 9/2` is "degree 4
  raised" (G♯ in C), a tonal sequence of the same chromatic inflection.
- The code fixes the pitch, not the spelling: F♯ and G♭ are both `7/2` in C.
  A lowered degree with a semitone below it (F♭ in C) has no half-step code and
  falls back to its enharmonic natural degree (E = `2`). None of the 96,726
  notes in the 409 chorales needs that fallback, and none has a double
  inflection.

In the 12Tone regime (`--lens chromatic`) nothing changes: steps are integers.
