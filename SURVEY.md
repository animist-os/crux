# Crux Language Survey: Affordances and Limitations

This document analyzes what musical structures Crux enables, what it makes difficult, and what remains inexpressible within its current design.

---

## Core Strengths

### 1. Hierarchical Nesting

- `[[...]]` nested mots enable recursive subdivision
- Default unit-duration preservation—use `/` postfix for explicit subdivision
- Parentheses allow explicit precedence control
- Mot-within-mot syntax naturally maps to metric hierarchy
- Abbreviated nested mot syntax `[[...] ` for inline nesting

### 2. Rich Transformation Vocabulary

**Multiplicative family**: `*`, `^`, `.`, `.*`, `.^` (splay, expand, cog-wise variants)

**Rhythmic operators**:
- `/` subdivision
- `:` repetition (supports random counts via RandNum)
- `t` tie (postfix unary)
- `.t` cog tie
- `z` zip columns

**Contour operators**:
- `->` steps (fan)
- `.->` steps (cog)
- `m` mirror (fan)
- `.m` mirror (cog)
- `l` lens (fan)
- `.l` lens (cog)

**Minimalist operators**:
- `g`, `.g` Glass-inspired interleaving
- `r`, `.r` Reich-inspired phasing
- `p` Pärt tintinnabulation (fan only)

**Structural operators**:
- `c`, `.c` constraint (masking)
- `j`, `.j` jam (replacement)
- `~`, `.~` rotate (fan/cog)
- `.,` dotZip (element-wise interleaving without cycling)

### 3. Timescale Sophistication

- Fractional notation: `n|/d` or `n|*m`
- Pipe-only forms: `|`, `|/n`, `|*n` with special jam-passing behavior
- Random timescales in denominators: `0|/{2,3,4}` or `0|/{1->4}`
- Per-element specification via dot operators
- Negative timescales trigger reversal in fan operators

### 4. Randomness Integration

- Range syntax: `{0->7}` with position tracking
- Choice lists: `{0,2,4}` with optional `@seed`
- Ranges within curlies: `{0->5, 10->15}` picks from multiple ranges
- Fractions in curlies: `{1/2, 1/4, 3/4}` for random ratios
- References in curlies: `{a, b, c}` for random motif selection
- Curly-of-pips: `{0|, 1|/2, 2|*3}` for complex stochastic patterns
- RandNum support in repeat operator: `[0,1,2] : {3,4,5}`
- Seeded determinism with 4-hex-char seeds: `@c0de`
- Position-based warmup for improved randomness distribution

### 5. Operator Aliasing

```crux
splay = *
motif splay [1,2,3]
```

Enables domain-specific vocabulary building.

### 6. Multi-Section Programs

```crux
a = [0, 2, 4]
a * [0, 1]
!
a * [0, 2]
```

- Section separator `!` allows multiple independent outputs
- Assignments persist across sections within a program
- Returns array of section results

### 7. Pip-Level Control

- Pip repetition with RandNum: `[0: {2,3,4}]`
- Padding syntax `:` for cog operator alignment: `[7, 0:, 7]`
- Interior padding support for precise alignment control
- Inline mot multiplication: `[0, [1] * [2], 4]` or `[0, a * [1,2], 4]`

---

## Musical Affordances

### 1. Polymetric/Polytemporal Structures

```crux
[0,2,4] * [0|/3, 0|/2]  // simultaneous triplet & duplet
[0,1,2] : {3,4,5}       // random repetition counts
```

The timescale system makes irrational divisions natural, with stochastic duration control.

### 2. Schenkerian/Generative Hierarchies

```crux
[[0,2], [4,5]] * [0, 1]
[[0,1,2]]/              // explicit subdivision notation
```

Nested mots with multiplication create voice-leading graphs. Unit-duration default prevents unintended subdivisions.

### 3. Minimalist Processes

```crux
[0,1,2] g [3,4]     // Glass interleaving (fan)
[0,1,2] .g [3,4]    // Glass interleaving (cog)
[0,2,4] r [1,3,5]   // Reich phasing (fan)
[0,2,4] .r [1,3,5]  // Reich phasing (cog)
[0,1,2,3] p [0,2,4] // Pärt tintinnabulation
```

Dedicated operators encode compositional archetypes with fan/cog variants for flexible control.

### 4. Motivic Transformation Chains

```crux
theme = [0,2,4,5]
theme * [0,1,2] -> [1,2]  // transpose, then generate steps
theme ~ [1, 2, -1]        // multiple rotations
```

Named motifs plus operator chaining creates transformation networks. Left-to-right evaluation is predictable.

### 5. Rhythmic Variety via Dot-Operators

```crux
[0,2,4] .* [1|, 1|/2, 1|/4]  // different duration per pitch
[0,2,4] . [0, [1,0]/, 0]     // nested subdivision at position
[0,1,2] ., [9,8,7]           // interleave without cycling
```

Element-wise operations enable heterogeneous textures. Nested mot behavior in cog operators creates complex rhythmic subdivision.

### 6. Parametric Control via Randomness

```crux
melody = [0, {0->7}, 4, {-3->3}]@abc1
rhythm = [0|/{2,3,4}, 1|/{2,3,4}]@1234
count = [0,1,2] : {3->7}@beef
```

Controlled indeterminacy with reproducible seeds, supporting random ranges and fractions in multiple contexts.

### 7. Alignment Control

```crux
[0,1,2,3,4,5,6] . [7, 0:, 7]  // pad middle positions
[a,b,c,d] .* [x|, |:, z|]     // pass-through middle values
```

Padding syntax enables precise control over cog operator behavior without cycling.

---

## Limitations & Inexpressible Structures

### 1. Polyphonic Independence

**Status**: No native vertical stacking.

```crux
// Wanted: Voice 1 (4 notes) + Voice 2 (3 notes) sounding together
v1 = [0,2,4,5]
v2 = [7,9,11]

// Workaround with timescale 0 pips (simultaneity markers):
[0, 7|0, 2, 9|0, 4, 11|0, 5]  // sequential encoding
```

The `.,` (dotZip) operator partially helps by interleaving without cycling, but sequences remain fundamentally monophonic.

**Impact**: True counterpoint requires external sequencing or clever timescale-0 encoding.

---

### 2. Conditional/Branching Logic

**Status**: No `if/then/else` or pattern-matching.

```crux
// Wanted: "if motif contains step 0, apply mirror, else apply lens"
// Current: Must precompute branches manually or use sections

// Workaround with sections (but no programmatic selection):
theme m [5]
!
theme l [3]
```

**Impact**: Algorithmic composition techniques (L-systems, generative grammars) require external scaffolding.

---

### 3. Iteration/Recursion

**Status**: No loops or recursive definitions.

```crux
// Wanted: "repeat motif, transposing up by 1 each time, until step > 12"
// Current: Must manually enumerate with fixed or random bounds
[0,1,2] * [0,1,2,3,4,5,6,7,8,9,10,11,12]

// Random iteration counts exist but are still bounded:
[0,1,2] : {3->10}  // picks count randomly, but not conditional
```

The `:` repetition operator accepts RandNum, providing some dynamism, but no unbounded loops or recursion.

**Impact**: Open-ended processes can't be expressed; all iteration is bounded (fixed or randomly).

---

### 4. Dynamic Time-Warping

**Status**: No curves or functions for temporal transformation.

```crux
// Wanted: "slow down final 3 notes by 2x based on position"
// Current: Manual adjustment via dot operators
[0,2,4,5,7,9] .* [|, |, |, |*2, |*2, |*2]

// Padding helps make this more concise:
[0,2,4,5,7,9] .* [|:, |*2]  // pad early, scale late
```

**Impact**: No continuous curves (ritardando, accelerando), but manual control is ergonomic with pipe operators and padding.

---

### 5. Harmonic/Vertical Aggregation

**Status**: No chord primitive or native simultaneity.

```crux
// Wanted: "C major triad = {0, 4, 7} sounding at once"
// Current: Use timescale-0 pips as simultaneity markers
[0, 4|0, 7|0]  // semantically opaque
```

The language is fundamentally **monophonic** (one event stream).

**Impact**: Vertical harmony requires external chord interpretation. Simultaneity encoded via timescale-0 convention.

---

### 6. String/Symbol Manipulation

**Status**: No text processing; only numeric steps and tag `r`.

```crux
// Wanted: Map pitches to syllables ["do", "re", "mi"]
// Current: Only numeric steps and 'r' rest tag supported
```

**Impact**: Vocal music, lyrics, mnemonic systems, graphic scores need external layers.

---

### 7. Higher-Order Operations

**Status**: No first-class functions or `map`/`filter` abstractions.

```crux
// Wanted: map(mirror_around_C, [motif1, motif2, motif3])
// Current: Manual enumeration
motif1 m [0], motif2 m [0], motif3 m [0]

// Operator aliasing reduces verbosity but still requires enumeration:
mir = m
motif1 mir [0], motif2 mir [0], motif3 mir [0]
```

**Impact**: Bulk transformations over collections are verbose; no abstraction mechanisms.

---

### 8. Non-Integer Steps

**Status**: Float steps are syntactically valid but lack semantic grounding.

```crux
[0.5, 1.25, 2.75]      // parses fine
[{0.5, 1.5, 2.5}]      // random floats work
```

No built-in mapping to Hz, cents, or just intonation ratios.

**Impact**: Microtonal music requires external frequency tables. Grammar permits floats but doesn't interpret them.

---

### 9. External State/Side Effects

**Status**: Pure functional semantics—no I/O, no mutable state (by design).

```crux
// Wanted: "read MIDI file, transform, write back"
// Current: Crux is an expression language, not a program
```

Multi-section programs (`!`) provide multiple outputs, but no side effects or external communication.

**Impact**: Must embed Crux in a host environment (JavaScript, DAW, Max/MSP, etc.).

---

## Unwieldy Patterns

### 1. Long Sequences

```crux
[0->12]            // range syntax handles this well
[{0->12}: 3]       // repeat random range choice
```

**Status**: Well-handled. Ranges expand inline.

### 2. Deep Nesting

```crux
[[[[0,1]], [[2,3]]], [[[4,5]], [[6,7]]]]  // hard to read
```

**Mitigation**: Use named intermediate motifs:

```crux
a = [[0,1]]
b = [[2,3]]
c = [[4,5]]
d = [[6,7]]
[[a, b], [c, d]]
```

**Status**: Readability depends on naming discipline.

### 3. Asymmetric Transformations

```crux
// Wanted: Apply different operators to odd/even indices
// Workaround with padding:
[0,1,2,3,4,5] .* [|*2, |:, |*2]  // scale odds, pass evens
```

**Status**: Padding helps, but no true positional predicates (e.g., `if index % 2`).

---

## Summary

### Musical Structures Fostered

- ✅ Metric hierarchies (nested mots, subdivision, unit-duration control)
- ✅ Motivic development (transformation chains, operator aliasing)
- ✅ Polyrhythmic textures (timescale flexibility, random durations)
- ✅ Minimalist processes (dedicated fan/cog operators)
- ✅ Controlled indeterminacy (seeded randomness, ranges, fractions, references)
- ✅ Horizontal voice-leading (steps, mirror, lens in fan/cog)
- ✅ Multi-part forms (section separator `!`)
- ✅ Precise alignment control (padding syntax)
- ✅ Stochastic repetition (RandNum in `:` operator)

### Musical Structures Unwieldy or Inexpressible

- ❌ Simultaneous independent polyphony (fundamentally monophonic)
- ❌ Conditional/algorithmic composition logic (no `if/else`)
- ❌ Open-ended recursion/iteration (bounded only)
- ❌ Vertical harmony primitives (timescale-0 workaround required)
- ⚠️ Dynamic tempo curves (manual via dot operators, no functions)
- ⚠️ Microtonal precision (floats work, but no semantic mapping)
- ❌ Higher-order transformations (no `map`/`filter`/`reduce`)
- ❌ External I/O or state mutation (by design—pure functional)
- ❌ String/symbol manipulation (numeric only, single tag `r`)

---

## Design Exploration Questions

### High Priority (Feasible Extensions)

**1. Polyphony Primitive**: Should Crux introduce a vertical stacking operator?

- Syntax ideas: `[0,2,4] || [7,9]` (voice stacking), `<0,4,7>` (chord literal)
- Trade-off: Adds complexity but unlocks counterpoint and vertical harmony

**2. Conditional Expressions**: Would ternary notation fit the declarative model?

- Example: `theme ? (hasZero ? m : l) [5]`
- Requires: Predicate language (e.g., `hasZero`, `length > 3`, `contains(0)`)
- Alternative: Pattern matching on mot properties

**3. Higher-Order Operators**: Could aliasing extend to parameterized transformations?

- Example: `scale(factor) = .* [|*factor]` then `[0,2,4] scale(2)`
- This would add lambda-like abstraction to the language

**4. Time-Warping Functions**: Is a `warp` operator feasible?

- Example: `[0,2,4,5] warp [1, 1.2, 1.5, 2]` (apply curve to timescales)
- Or: `[0,2,4] warp linear(1, 2)` (named curve functions)
- Or: `[0,2,4] warp {linear, exponential, bezier}`

### Medium Priority (Semantic Clarifications)

**5. Microtone Semantics**: Should steps map explicitly to Hz, cents, or ratios?

- Current: `[0.5]` is valid but ambiguous (50 cents? 0.5 Hz? halfway between scale degrees?)
- Option A: `[0.5@hz]`, `[50@cents]`, `[3/2@ratio]` (typed literals)
- Option B: Global pragma `#microtone cents` at file start

**6. Chord Literals**: Worth the complexity?

- Pro: `<0,4,7>` clearer than `[0, 4|0, 7|0]`
- Con: Introduces new primary syntax, breaks monophonic model
- Alternative: Keep timescale-0 convention as idiomatic encoding

**7. Iteration with Exit Conditions**: Should `:` support predicates?

- Example: `[0,1,2] : while(maxStep < 12)` or `[0] * [0,1,2] : until(length > 10)`
- Requires: Runtime evaluation context and predicate sublanguage
- Trade-off: More expressive but adds significant complexity

### Low Priority (Breaking Changes or Scope Creep)

**8. Recursion**: Should named motifs support self-reference?

- Example: `fib = [0, 1, fib * [1,1]]` (with depth limit)
- Problem: Parsing complexity, unclear termination, evaluation order issues

**9. Multi-Value Returns**: Should operators return `(mot, metadata)` pairs?

- Use case: `[0,2,4] -> [3]` also outputs "transposition history"
- Trade-off: Breaks simple evaluation model, requires tuple unpacking syntax

**10. External Functions**: Allow FFI for custom operators?

- Example: `[0,2,4] | external("reverb", depth=0.5)`
- Problem: Breaks purity, platform-dependent, security concerns

---

## Conclusion

Crux has grown significantly expressive for:

- **Rhythmic complexity**: padding, random repeats, nested subdivisions
- **Operator versatility**: comprehensive fan/cog operator pairs
- **Stochastic control**: ranges, fractions, and references in random contexts
- **Formal structure**: multi-section programs with persistent environments

But it remains deliberately constrained in:

- **Control flow**: no conditionals or branching
- **Data types**: numeric only (plus single rest tag)
- **Polyphony**: monophonic event stream model
- **Abstraction**: no higher-order functions or recursion

These constraints keep the grammar **tractable**, **composable**, and **teachable**, at the cost of requiring external scaffolding for certain musical paradigms (counterpoint, algorithmic composition, spectral techniques).

The language excels as a **motivic transformation toolkit** embedded within larger compositional systems, rather than as a complete standalone composition environment.
