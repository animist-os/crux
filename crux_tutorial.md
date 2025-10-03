# Crux Tutorial

*Crux* is a domain specific language for algorithmic music composition.  There are two kinds of musical object, "pips" and "mots".

`pip` - a musical event (similar to note) expressed in terms of its relative displacement in pitch from an environmental "tonic"  or "root" pitch.   Pips also describe their relative duration as a "timeScale" value that is multiplied by a unit duration (or "quanta") which is also defined by the outer environment.

`mot` - a list of pips expressed in non-overlapping sequential order. A "mot" represents a sequential string of notes that make up a musical "voice" or "part".

Mots are represented with square braces, like so:

[0,1,2,3]

Any mot with non zero length can be rendered into notes.

You can concatenate mots, repeat them, slice/rotate, combine them multiplicatively, and introduce ranges and random choices. You can apply musical transforms on pips and mots. All operations can be applied in either a "fan" approach or a "cog" one.

`fan`: For each r in R, apply op to all of A, then concatenate. The lengths multiply

`cog`: Pair positions; RHS cycles as needed to cover LHS.




<br>
<br>

# Fundamentals


Here are 4 pips, stepping up the scale.
```text
[0, 1, 2, 4]
```
Here they are given different relative durations.   The step value is separated from the time value by a "|" pipe character.
```
[0 | 2, 1, 2 | 4, 3]
```
The relative durations can also be subdivisions.   "| 1/2" can be written "| /2"
```
[0 | /2, 1 | /2, 3 | 3/4, 4 | 3/2]
```
<br>
<br>

### Pipe forms for timeScale

Note that, like the step values, these timeScales are relative to the unit duration of the environment.


- `[0 | 2]`                      // step 0, timeScale 2
- `[0 | / 4]`                    // step 0, timeScale 0.25 (implicit numerator of 1)
- `[0 | 3 / 8]`                  // step 0, timeScale 0.375 (dotted quarter)
- `[| 8]`                        // pipe-only: step 0, timeScale 8
- `[| * {2,4}]`                  // pipe-only with random timeScale




<br>
<br>

# Building Blocks

## Ranges, random choices

```text
[0->3]                    // [0, 1, 2, 3]
```
```
[{0, 1, 2}, -2]          // random choice (one of the options)
```
```
[{ -2 ? 2 }]             // random integer in [-2, 2] inclusive
```
```
[{1 ? 6}] :16             // random integer changes within repeats
```
```
[{1 ? 6}@c0de] :16        // seeded random (always the same result for a given @seed)
```
```
[{0,2,5} | 2] :4         // random step with fixed timeScale
```
```
[1 -> 4 | / {2,4}] :4    // range with random per-element timeScale
```


<br>
<br>

## Rests
- `r`: rest (silence with duration)


```text
[0, r, 1, 2]
```
```
[0, r | /2, 1 | /2, 2]
```

When on the right hand side of a binary mot operator, the rest effectively trumps the step value

```
[0 -> 8] . [0, r]
```


<br>
<br>

## Repeats
Note that this unpacks to [0,0,0,0,0,0].
```text
[0] : 6
```
While this produces the same music surface, it unpacks to a different structure [0,0] * [0,0,0]
```
[0] : 2 : 3
```


<br>
<br>

## Nesting
Mots can be nested. By default, nested mots preserve unit duration (each pip maintains its timescale).
```
[0,[1,2],3]
```
```
[0,1,[2,[3,4,5,6]]]
```
```
[[0,0,0],5 | /2, 3 | /2]
```

To subdivide the time a nested mot's time, so that the nested mot occupies a single unit duration of the parental mot, use the `/` postfix operator:
```
[[0,1,2]]/
// Produces: [0 | /3, 1 | /3, 2 | /3]
```


<br>
<br>

## Variables

Assigning an expression to a variable makes the expression reusable.   Note that the assignment "freezes" any randomness in the expression.  If you want to keep the randomness alive, you can "unpack" the variables.

```
A = [0, 1]
A * [7]
```
```
A = [-1, 0, 1]
A * A
```
Here we use verbose variable names to illustrate a reverse-Schenker elaborating pattern.
```
schenkerNeighbor = [0, 0, 0 |/2, 1 | /2, 0]
basicNotes = [0, 1, 2 , 3]
(schenkerNeighbor * basicNotes t) * [3,0]
// (t)ie operator ties together adjacent same-pitch notes
```
Here we use the dot operator and nest the schenker embellisher in the RHS mot, which has the effect of subdividing coresponding LHS pip.
```
schenkerNeighbor = [0,1,0] * [|3]
A = [0,4,-1,5]
A . [0, schenkerNeighbor, 0, schenkerNeighbor]

```
This illustrates how assign to a variable "freezes" any random choices.    Note here that each random choice is made twice (once for each repeat in :2) but when A is repeated, no new random choices are made.    This may change if we pursue John and Alex's Lazy and Stupid policy.
```
A = [{-1 ? 2}, {4 ? 6}] :2
A : 4
```

<br>
<br>


# Fan vs Cog: Binary Mot Operator Types

- fan type: `*`, `^`, `->`, `m`, `l`, `c`, `j`, `g`, `r`, `p`
- cog type: `.`, `.^`, `.->`, `.m`, `.l`, `.t`, `.c`, `.j`, `.g`, `.r`, `.p`


<br>
<br>

# Basic Operators

## Add (fan)
```text
[0,1,2] * [1]
```
```
[0,1,2] * [1, -2]
```
Negative time scale reverses mot
```
[0,1,2] * [1, -2 | -1]
```

## Add (cog)
```
[0,1,2] . [5,-5]
```
```
([0,1,2]:4) . [5,-5]
```

<br>
<br>

## Multiply (fan)
Expands the size of the steps / intervals
```
[1,2,5] ^ [2]
```
Negative multiply value inverts the intervals
```
[1,2,3] ^ [-1]
```

## Multiply (cog)
```
([1,2] : 4) .^ [-2,2,3]
```


<br>
<br>

## Nested RHS subdivision

In cog operators (mainly useful with the "." operator) if the right-side element at a position is a nested mot literal, it coerces a subdivision of the left pip at that corresponding position, and then applies the same 1:1 cog operation as its unnested brethren.

The behavior with fan operators is more intuitive:
```
[0,-1,1,0] * [0,[7, 6], 2]
```

Nested mots now preserve unit duration by default (this is a recent change, if it makes you unhappy, you know who to call). If you want subdivision (timescale reduction), use the `/` postfix operator:
```
[0,-1,1,0] * [0,[7, 6]/, -1]
```

With the dot operator, nested mots preserve their timescales:
```
[0,4,2] . [0, [1,0], 0]
// Produces: [0, 5, 4, 2]
```

To subdivide the nested mot, use `/`:
```
[0,4,2] . [0, [1,0]/, 0]
// Produces: [0, 4 | /2, 5 | /2, 4 | /2, 4 | /2, 2]
```

Or use explicit timescales to preserve duration without subdivision:
```
[0,4,2] . [0, [1 | 2, 0 | 2], 0]
```


<br>
<br>

## Postfix Operators

### Subdivide `/`

The `/` postfix operator divides each pip's timescale by the mot length. It works on any expression:

```
[[0,1,2]]/
// Produces: [0 | /3, 1 | /3, 2 | /3]
```

```
[4->7]/
// Produces: [4 | /4, 5 | /4, 6 | /4, 7 | /4]
```

This is useful when you want to fit a mot into a single time unit while preserving relative durations.

### Zip Columns `z`

The `z` postfix operator performs round-robin interleaving on comma-separated expressions:

```
A = [0,0,0]
B = [1,1,1]
C = [2,2,2]
(A, B, C)z
// Produces: [0, 1, 2, 0, 1, 2, 0, 1, 2]
```

This is useful for creating interleaved patterns from multiple independent mots.


<br>
<br>

## Jam (fan)

Used to replace a value.   Can also pass the existing value through unchanged if no value is specified on one or both side of the pipe

```text
[0,1,2,3] j [7]           // set all steps to 7
```
```
[0, 1 | /4, 2] j [| 1]    // set all timescales to 1
```
```
[0,1,2,3] j [ | , 7]      // pass-through once then set all steps to 7
```

## Jam (cog)

```
[0,1,2,3] .j [0,7]
```
Jam cog is a way to apply a repetitive rhythmic pattern
```
[0, 1, 2, 3] .j [| 1, | /2 , | /2, |2]
```
```
([0, 1, 2, 3] :4) .j [| /4, | /4 , | /2, | 2]
```


<br>
<br>

## Fill / Steps (fan)

```text
[0,3] -> [2]              // [0,3, 1,4, 2,5]
```

## Fill / Steps (cog)

```
[0,3] .-> [2]             // [0,1,2, 3,4,5]
```


<br>
<br>


# Sequencing Operators

## Concatenate - use ","
```text
[0, 1], [2]
```
```
s0010 = [0,0,1,0]
s1100 = [1,1,0,0]

[{s0010, s1100}], [{s0010, s1100}], [{s0010, s1100}]:6
```

Note: adjacency does not cross newlines.

Using repeat to make 16 raandom choices
```
([0, 1], [2 -> -1]) : 16
```
```
[3,1] : {2,4,8}             // random repeat count (2 or 4 or 8)
```

## Concatenate Cog - use ".,"
Interleaves two mots - element-wise zip with no cycling.  If one mot is shorter than the other, the remainder is simply concatenated
```
[0,1,2] ., [9,8,7]
```

<br>
<br>

## Slice
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


<br>
<br>

## Rotate (fan)
```text
[0,1,2,3] ~ [-1]          // [3, 0, 1, 2]
```
```
[0,1,2,3] ~ [1]           // [1, 2, 3, 0]
```

## Rotate (cog)
```text
[0,1,2,3] .~ [1]          // [1, 2, 3, 0]
```
```
[0,1,2,3,4,5] .~ [1,-1]   // [1, 4, 3, 4, 5, 0] - cycles RHS
```


<br>
<br>

## Ellipsis padding in cog ops:
Inside a mot literal, appending `...` to a value marks it as a pad entry for cog operators. In cog context (e.g., with `.`), padding repeats that RHS value to cover the middle positions without cycling; any trailing RHS entries are right‑aligned to the end of the LHS:
   ```
   [0,1,2,3] . [4,0...]
   ```
Interior pad is supported:
   ```
   [0,1,2,3,4,5,6] . [7, 0..., 7]
   ```
Fan operators (`*`, `^`, `->`, etc.) ignore `...` (the value behaves as a single entry):
   ```
   [0,1,2] * [2, 3...] // behaves the same as [0,1,2] * [2,3]
   ```


<br>
<br>


# Transform Operators

## Mirror (fan)

```text
[0, 2, 4] m [2]           // [4, 2, 0]
```

## Mirror (cog)

```
[0, 2, 4] .m [1]          // [2, 0, -2]
```


<br>
<br>

## Lens (sliding windows) - fan

```text
[0,1,2,3] l [2]           // [0,1, 1,2, 2,3]
```
```
[0,1,2,3] l [-2]          // [2,3, 1,2, 0,1]
```

## Lens (cog)

```
[0,1,2] .l [2]            // [0,1, 1,2, 2,0]
```


<br>
<br>

## Tie (duration merge)
```text
[0 | /2, 0 | /2, 1] t        // [0 | 1, 1]
```
```
[0 | /2, 0 | /2, 0 | /2, 1] .t [1]
```


<br>
<br>

## Constraint (filter out pips by position)

"1" means keep, "0" means skip to next pip
```
[0, 1, 2, 3] c [1, 0, 1, 0]
```

```
[0, 1, 2, 3, 4] c [1, 0]
```


<br>
<br>


# Specialized Operators

These operators implement specific compositional techniques inspired by minimalist composers.

## Glass (fan)
Creates interleaved patterns with different rhythmic subdivisions (triplets for LHS, duplets for RHS). Inspired by Glass's minimalist style.

```text
[0,2,4] g [0,1]           // Interleave with triplet/duplet subdivision
```
```
[0,1,2,3] g [5]           // Each LHS element gets glass treatment with RHS
```

## Glass (cog)
Applies glass subdivision pattern element-wise

```text
[0,2,4] .g [0,1,2]        // Element-wise glass interleaving
```


<br>
<br>

## Reich (fan)
Creates phasing patterns with 1/4 note subdivisions. Inspired by Reich's phasing technique.

```text
[0,2,4] r [1,3]           // Reich phasing pattern
```
```
[0,1,2] r [5,6]           // All combinations with phasing subdivisions
```

## Reich (cog)
Cog-style Reich operation with varied durations (alternating 1/2, 1/4 pattern)

```text
[0,2,4] .r [1,3,5]        // Element-wise phasing with alternating durations
```


<br>
<br>

## Pärt (fan)
Arvo Pärt's tintinnabuli technique. LHS = melodic voice (M-voice), RHS = root note(s) for triad. Automatically generates T-voice (triadic voice) below each M-voice note using minor triad (root, minor 3rd, perfect 5th).

```text
[0,2,4,5] p [0]           // Tintinnabuli with C as root
```
```
[0,1,2,3,4] p [-7]        // Melodic line with triad voice based on root at -7
```


<br>
<br>

# Examples


Melodic elaboration
```text
A = [1 -> -1, -2 | / 2, -1 | / 2]
B = A * [0 | * 2]
B * A * [3, 6]
```

Nested mot
```
[[0,1], 2] * [1,-2,-1,0]
```
```
[0,[1, [2, 3]], 4]
```

Using variable to lock repeat random choices
```
A = ([{-4 ? 4}] j [|/2, |]): 4
A : 4
```

Haydn Op. 76
```
nug =  [1 | /2, -1 | /2, 0] * [0 | 3]
nug2 = nug . [1,1,4]
aun = [1 | 2, 0 | 2]

haydn = [-5] * [0 | 3/2, 1 | /2, 2, 1, 3, 2, 1 | /2, -1 | /2, 0, 5 -> 1, 2 | /2, 0 | /2, 4]

haydn2 = [-5] * [0 -> 2, 1, 2, nug ,5 -> 1, nug2  ] . [0 | 3/2,0 | /2,0,0,aun,0...]
```

Mozart Voi Che Sapete
```
mozNugB = [4,2]
mozB = mozNugB ^ [1,1,-1,-1]

[0, [0,0]] . [0, [0,0]]


mozNugA = [0,1,2,1]
mozNugA2 = [-3, -3, 0,2,0]
mozA = mozNugA ., mozNugA2 . [0, [0,0]] // ., is zip to interleave 2 mots into 1
```

Bach Cello Prelude
```
S = [9] * [0,1,0] . [[0,0],[0,0,0,0],[0,0]]
T = [4 -> 7] . [[0,0], [0,0], [0,0,0,0]]
B = [0]:10

woven = (B, T, S, T, S, T) z

woven . [0, 0, [0,-1,0], 0, 0, 0] 

```

<br>
<br>



# Experiments

## Schenkerian Elaboration Patterns

Nested mots on the RHS (right-hand-side) of the "cog" family of operators have the effect of coercing their corresponding left-hand pips into subdivisions so they can be operated on 1:1. For example:

```
[0,4,-1,2] . [0, [1,0], 3, 4]
```

This makes nested mots act like Schenkerian elaborators. They take a single pip on the left side and break it into 2 or more sub pips, each with its own displacement values for step and timescale.

Since nested mots now preserve unit duration by default, if you want the nested mot to preserve the total duration of the left pip, use explicit timescales:

```
[0,4,-1,2] . [0, [1 | 2,0 | 2], 3, 4]
```

We can use ellipses to pad the RHS with identity pips to prevent the clockwork "wrapping" that can happen with "cog" operators and make them simply map 1:1 with the LHS like this:

```
[0,4,-1,2,0,1,2,3,4,5] . [0, [1 | 2,0 | 2], 0...]
```

Each of these 5 expressions evaluates to the same musical surface, "Ah, vous dirai-je Maman".
Note, however, that each applies a different operator or series of operators to a different initial mot.
This means that each expression will produce a different variation when you wiggle its pips.

```
nay = [0,1,0] * [|3]  // schenker neighbor or injection
aun = [1, 0] * [|2]   // schenker anticipatory upper neighbor
aln = [-1, 0] * [|2]  // schenker anticipatory lower neighbor

twinkle = [0,4,5 -> 0]
twinkle2 = ([0, 4, 3 -> 0] . [0, nay, 0...])
twinkle3 = ([0, 5, 4 -> 0] . [0, aln, 0...])
twinkle4 = ([0, 4 -> 0] . [0, aun,0...] . [0, aln, 0...])
twinkle5 = ([0, 5 -> 0] . [0, aln,0...])


[-5,-5] * (twinkle, [r], twinkle2, [r], twinkle3, [r], twinkle4, [r], twinkle5)
```


<br>
<br>



# Cheatsheet

- Concatenate: `,`
- Cog-Concatenta '.,' interleaves two mots
- Repeat: `Expr : N`
- Slice: `start _ end` | `start _` | `_ end`
- Random pip from list: `{0, 2 | /4, -2}`
- Random pip from range; `{-7 ? 7}`
- Rest: `r`
- Add `*` (`.` is cog Add)
- Mult `^` (`.^` is cog Mult)
- Fill `->`
- Rotate: `~` (`.~` is cog Rotate)
- Lens `l` (`.l` is cog Lens)
- Jam `j` (`.j` is cog Jam, useful for mapping short patterns onto longer mots)
- Constrain `c` (`.c` is cog Constrain)
- Mirror `m` (`.m` is cog Mirror)
- Tie: `t` (`.t` is cog Tie)
- Glass: `g` (`.g` is cog Glass)
- Reich: `r` (`.r` is cog Reich)
- Pärt: `p` (`.p` is cog Pärt)
- Subdivide: `[[1,2]]/` (postfix `/` divides timescales by mot length)
- Zip/Interleave: `(A, B, C)z` (round-robin interleave)
- Variable:  `tuna = [-7,-5,2 | /2,1 | /2, 0 | 2]`
- All timescales to 1: `j [|1]`
- Decimate: `c [1,0]`
- Impose rhythm: `.j [|, | /2 , | /2]`


<br>
<br>
