# Crux Tutorial

Crux

Crux is a domain specific language for algorithmic music composition.

"Pips" are musical events (notes) expressed in terms of their relative displacement in pitch from an environmental "tonic" pitch. They carry a relative timeScale (defaults to 1). They are typically assembled into a "Mot" which is a list of pips expressed in non-overlapping sequential order. A "Mot" represents a sequential string of notes that make up a musical "voice" or "part".

You can concatenate mots, repeat them, slice/rotate, combine them multiplicatively, and introduce ranges and random choices. You can apply musical transforms on pips and mots. All operations can be applied in either a "spread" approach or a "tiled" one.

- Spread (outer): For each r in R, apply op to all of A, then concatenate. The lengths multiply

- Tile (elementwise): Pair positions; RHS tiles as needed.

This document walks you interactively through the Crux grammar.

### Program

- **Program**: one or more statements. The final statement’s value is the result.
- **Statement**: either an assignment or an expression.
- **Assignment**: `Name = Expr`
- **Reference**: use a previously assigned `Name` in an expression.


## Fundamentals

```text
[0, 1, 2, 4]                 // four pips, unit duration
```
```
[0, 1 | 2, 3 | /2, 4 | 3/2]  // four pips, with different relative durations
```

## Two mapping semantics

- Spread family: `*`, `^`, `->`, `m`, `l`, `c`, `j`
- Tile family: `.`, `.^`, `.->`, `.m`, `.l`, `.t`, `.c`, `.j`

### Add vs multiply
```text
[0,1,2] * [1]              // [1, 2, 3]
```
```
[0,1,2] * [1, -2]          // [0,1,2,-2,-1,0]
```
```
[1,2] ^ [2]               // [2, 4]
```
```
[0,1,2] . [5,-5]         // [5, -4, 7]
```
```
[1,2] : 4 .^ [-2,2,3]          // [-2, 4, 3, -4, 2, 6, -2, 4]
```

Jam (replace or pass-through)
```text
[0,1,2,3] j [7]           // [7, 7, 7, 7]
```
```
[0,1,2,3] .j [0,7]        // [0, 7, 0, 7]
```
```
[0, 1/4, 2] j [| 1]       // reset durations -> [0, 1, 2]
```
```
[0, 1, 2, 3] .j [| 1, | /2 , | /2, |2]        // apply a rhythm -> [0, 1, 2]
```
```
[0, 1, 2, 3] :4 .j [| /4, | /4 , | /2, | 2]  // apply a rhythm
```
```
[0,1,2,3] j [ | , 7]      // pass-through then 7s
```


## Ranges, choices, random

```text
[0->3]                    // [0, 1, 2, 3]
```
```
[{0, 1, 2}]               // random choice (one of the options)
```
```
[?]                       // bare random integer in [-7, 7]
```
```
[{ -2 ? 2 }]               // random integer in [-2, 2] inclusive
```
```
[{1 ? 6}] :16              // random integer changes within repeats
```
```
[{1 ? 6}@c0de] :16        // seeded random (stable per seed)
```
```
[{0,2,5} | 2]             // random step with fixed timeScale
```
```
[1 -> 4 | / {2,4}]        // range with random per-element divide
```

## Tags
- `r`: rest (silence with duration)
- `x`: omit (drops the position in tile ops and constraint)

```text
[0, r, 1, 2]
```
```
[0, 1, x, 3]
```
```
[0, 1, x]                 // x is meaningful in tile ops / constraint
```

## Variables

Assigning an expression to a variable makes the expression reusable.   Note that the assignment "freezes" any randomness in the expression.  If you want to keep the randomness alive, you can "unpack" the variables.

```
A = [0, 1]
A * [7]                 // [7, 8]
```
```
A = [-1, 0, 1]
A * A                   // [-2,-1,0,-1,0,1,0,1,2]
```
```
schenkerNeighbor = [0, 0, 1, 0]
basicNotes = [0, 1, 2 , 3]
schenkerNeighbor * basicNotes t
```
```
A = [{-1 ? 2}, {4 ? 6}] :2
A : 4
```

## Sequencing

Concatenate - use either "," or adjacency
```text
[0, 1], [2]             // [0, 1, 2]
```
```
[0, 1] [2, 3]           // [0, 1, 2, 3] -- may be deprecated to require commas
```
Note: adjacency does not cross newlines.

Repeat
```text
[1] : 3                   // [1, 1, 1]
```
```
([0, 1] [2]) : 2          // [0,1,2, 0,1,2]
```
```
[3,1] : {2,4}             // random repeat count (2 or 4)
```

Slice
```text
[0,1,2,3,4] -3 _ -1       // [2, 3]
```
```
[0,1,2,3,4] 1 _           // [1, 2, 3, 4]
```
```
[0,1,2,3,4] _ 3           // [0, 1, 2]
```
```
[0 -> 8] 3 _ {5,7}        // end index can be random from a list
```


Rotate
```text
[0,1,2,3] ~ [-1]          // [3, 0, 1, 2]
```

### Steps

```text
[0,3] -> [2]              // [0,3, 1,4, 2,5]
```
```
[0,3] .-> [2]             // [0,1,2, 3,4,5]
```

### Mirror

```text
[0, 2, 4] m [2]           // [4, 2, 0]
```
```
[0, 2, 4] .m [1]          // [2, 0, -2]
```

### Lens (sliding windows)

```text
[0,1,2,3] l [2]           // [0,1, 1,2, 2,3]
```
```
[0,1,2,3] l [-2]          // [2,3, 1,2, 0,1]
```
```
[0,1,2] .l [2]            // [0,1, 1,2, 2,0]
```

### Tie (duration merge)
```text
[0 | /2, 0 | /2, 1] t        // [0 | 1, 1]
```
```
[0 | /2, 0 | /2, 0 | /2, 1] .t [1]
```

### Constraint (keep/omit)
```text
[0,1,2,3] c [1,0,1,x]     // [0, 2]
[0,1,2,3] .c [1,0,1,x]    // [0, 2]
```

### Jam (replace/override)
```text
[0,1,2,3] j [0, 7]        // [0,0,0,0, 7,7,7,7]
```
```
[0,1,2,3] .j [0, 7]       // [0, 7, 0, 7]
```
```
[0 | 2, 1 | /4, 2] j [|]       // reset durations -> [0, 1, 2]
```
```
[0, 1, 2] j [| /2]        // halve durations -> [0 | /2, 1 | /2, 2 | /2]
```

## Tag behavior in tile ops

- `x` (RHS): omit position
- `x` (LHS): pass-through left
- `r` (either): produce rest (time multiplied)
- Unknown tags: pass-through left

```text
[0,1,2] . [x, 10]         // [0, 12]
```

## Examples


Melodic elaboration
```text
A = [0, 1, 0]
B = A -> [1]
B . [0, -12]
```

Call and response
```text
A = [0, 3]
A -> [4]
A .-> [4]
```

Windowed motifs
```text
A = [0,1,2,3]
A l [3]
```

Slice + repeat
```text
([0,1,2,3] 1 _) : 2
```

## Cheatsheet

- Concatenate: `,` or juxtaposition
- Repeat: `Expr : N` (N can be random via `{...}`)
- Slice: `start _ end` | `start _` | `_ end`
- Spread: `*`, `^`, `->`, `m`, `l`, `c`, `j`
- Tile: `.`, `.^`, `.->`, `.m`, `.l`, `.t`, `.c`, `.j`
- Rotate: `~`
- Tie: postfix `t`, tile `.t [mask]`
- Random pips: `?`; Curly random: `{a ? b}`, `{a,b,...}` with optional `@seed`
- Pipe duration: `value | ts`, `| * {..}`, `| / {..}`
- Tags: `r`, `x`

