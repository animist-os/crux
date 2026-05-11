# Crux Examples

Each `.crux` file in this directory is a complete, runnable Crux program.

## Voice composition

A Crux program is one or more voices that play simultaneously. The `!`
separator introduces a new voice, optionally with an absolute entry offset
`!N` (in time units, measured from t=0). Bare `!` is equivalent to `!0`.

| File | Topic |
|------|-------|
| `voice-offset.crux` | Three-voice canon with staggered entries |
| `fugal-exposition.crux` | SATB-style fugal exposition with tonal answers |
| `canon-with-transformations.crux` | Per-voice timescale transforms inside a canon |
| `balinese-gamelan.crux` | Layered gamelan composition (gong, kempur, kempli, gangsa kotekan) |

## Temporal operators on a single voice

These demonstrate `>` (displace) and `||` (mot timescale), which transform a
mot's content. They are independent of `!N` and operate within one voice.

| File | Topic |
|------|-------|
| `displace.crux` | Basic delay via a leading rest |
| `displace-fractional.crux` | Half-beat displacement for swing or phase |
| `displace-anticipation.crux` | Negative displacement: trim from the front |
| `mot-timescale.crux` | Augmentation and diminution |
| `polyrhythm.crux` | Same figure at different speeds |

## Running

```javascript
import { parseAndEvaluate } from './dist/index.js';
import fs from 'fs';

const code = fs.readFileSync('examples/voice-offset.crux', 'utf8');
const result = parseAndEvaluate(code);

// result.sections is an array of mots, one per voice.
result.sections.forEach((voice, i) => {
  console.log(`Voice ${i + 1}:`, voice.toString());
});
```

## Key syntax referenced in these examples

- `[ ... ]` is a mot; entries are pips with optional `| timescale` and tags
- `r` is a rest
- `*` fan-transpose, `.` cog-add elementwise, `,` concatenate
- `z` postfix zips columns (round-robin interleave) within one voice
- `||` scales every pip's duration in a mot
- `>` displaces a mot in time (delay with positive N, anticipation with negative)
- `!` separates voices; `!N` enters the next voice at absolute time N
