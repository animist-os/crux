# Crux Examples

This directory contains example Crux compositions demonstrating various musical techniques and styles.

## Balinese Gamelan (balinese-gamelan.crux)

A multi-section composition demonstrating the polyrhythmic and interlocking patterns characteristic of Balinese gamelan music.

### Key Concepts Demonstrated

#### 1. Kotekan (Interlocking Patterns)
Gamelan uses two complementary parts:
- **Polos**: The lower, "on-beat" pattern
- **Sangsih**: The upper, "off-beat" pattern

These interlock to create a single, complex melodic line. Example:
```crux
polos = [0, 3, 5, 3]
sangsih = [5, 7, 8, 7]
(polos, sangsih)z  // Interleave using zip operator
```

#### 2. Colotomic Structure
Gamelan uses gongs of different sizes to mark time:
- **Gong**: Largest, marks major cycles (every 8-16 beats)
- **Kempur**: Medium, marks mid-cycles (every 4-8 beats)
- **Kempli**: Small, steady time-keeper (every 1-2 beats)

#### 3. Polyrhythms
Multiple simultaneous rhythmic cycles of different lengths:
```crux
// 3 against 4 polyrhythm
melody_3 = [0, 5, 7] : 4    // Pattern of 3, repeated 4 times = 12 beats
melody_4 = [0, 3, 5, 8] : 3  // Pattern of 4, repeated 3 times = 12 beats
```

#### 4. Scale
Traditional pelog scale approximated as: `[0, 1, 3, 5, 7, 8, 10]`

#### 5. Gilak
Fast, syncopated pattern using rests (`r`) and interlocking:
```crux
polos_gilak = [0, r, 5, r, 3, r, 5, r]
sangsih_gilak = [r, 5, r, 8, r, 5, r, 7]
```

#### 6. Kebyar
"To flare up" - explosive, dramatic opening style with sudden dynamic shifts.

### Running the Examples

Each section is separated by `!` and produces independent output. To run:

```javascript
import { parseAndEvaluate } from './dist/index.js';

const code = fs.readFileSync('examples/balinese-gamelan.crux', 'utf8');
const result = parseAndEvaluate(code);

// result is an array of outputs, one per section
result.forEach((section, i) => {
  console.log(`Section ${i + 1}:`, section.map(pip => pip.toString()));
});
```

### Musical Notes

- Time scales use `|*n` (multiply) or `|/n` (divide) notation
- The `z` operator zips columns (round-robin interleaving)
- The `.` operator does element-wise (cog) operations
- The `*` operator does fan/cartesian operations
- Rests are indicated with `r`

### Further Exploration

Try modifying:
- Scale degrees to explore different pelog or slendro tunings
- Time scales to speed up or slow down patterns
- Interlocking patterns to create new kotekan
- Polyrhythmic ratios (try 5:7, 4:9, etc.)
