We are expressing notes as delta values -- as displacements in BOTH pitch and time.   The value of this is that it lets you turtles-all-the-way down musical structures.  You can zoom out from the note level, to tiny figures, then out further to phrases, to sections, to pieces.   All these things can have the same fundamentail pitch and time properties expressed in the same way.



POLYPHONY

voices should derive from other voices, no grand martrix — crux is about relative relationships / deltas

a second voice is a  copy with variations

the issue with diad's actually suggests a whole new mot

maybe add an anchor option to pip (or mot) that means it dervices its ptche from a named mot


do we even need tagging? 




SCHENKER OPS

    step [0, 3] === [0,1,2,3]
    neighbor [0] === [0, 1, 0] or [0, -1, 0] 
    how can we express
      a_neighbor[0] => [-1/2, 0/2] — anticipatory lower neighbor, subdividing the time span (very schenker)
      m_neighboor[0] / (1 / 3) => [0, -1, 0] 

  it seems meaningful to apply schenker neghbor ops to entire mots:  
  
    A = [0, 3] neighbor_op === [0,3, 1, 4, 0, 3]  (this seems closer to "." semantics)
  
    B = [0, 3] neighbor_op === [0, 1, 0, 3, 4, 3]  (this seems closer to "*" semantics)

  or maybe neighbor op is a special case of a more general insertion op

    [0, 3] insertion_op [-1] === [0, -1, 0, 3, 2, 3]

    [0, 3] insertion_op [4] === [0, 4, 0, 3, 7, 3]

    "dot" version

    [0, 3] .insertion_op [4] === [0, 3] + [4, 7] + [0, 3] === [0, 3, 4, 7, 0, 3]

  anticipatory neighbor feels like displacement.  in a way so does repetition

   [0] === [-1, 0]
 
   2: [0]

   [0] displace [-1] === [-1, 0]

   3:[0] === [0,0,0] 

   8:[0] displ [noop, noop, -1]   == [0,0,-1,0,0,0,0,0,0,0,0]
   8:[0] displ [noop, -1]         == [0,-1,0, 0,0,0,0,0,0,0]
   8:[0] displ [-1]               == [-1, 0,0,0,0,0,0,0,0]

   displace aka prepend

   can we get at the sense of borrowing / paying back?

   

  Steps
  
    [0, 3] .-> [4] === [0,1,2,3,4, 3,4,5,6,7]

    [0, 3] -> [4] ===  [0, 3] + [1, 4] + [2, 5] + [3, 6] + [4, 7] ===  [0, 3, 1, 4, 2, 5, 3, 6, 4, 7]

    [1,2,3,4] ~ [1, -1] === [2,3,4,1] + [4,1,2,3]

    [1,2,3,4] .~ [1, -1] === ????

    NOTE ALSO if we have dot-ish version of "^" we could do

    [0, 3] -> [4] .^ [1, -1] === [0,1,2,3,4, -3,-4,-5,-6,-7]

    [0, 3] -> [4] .^ [1, -1] . [0, 3] === [0,1,2,3,4, 0,-1,-2,-3,-4]


    Is it bad that we can get to this two ways or sensible?   No, it's cool, and in fact while their pips are identical, the second version gives you another pip value to manipulate

      [0, 3] -> [4] 
      
    is same as
      [0] -> [4] * [0, 3]



    THIS means we could replace

      [0 -> 4] with [0] -> [4]

    downside is in order to do 

      [0, 1 -> 5, 2]  we need [0,1,2] .-> [noop, 5, noop]

    but is that actually worse?


  A 
  
  ALT -- in the same way that "..." modifies individual pips, we could have schenker ops that expand individual pips.    different because they expand them but better to think of them as sugar or compressed expression

  [0 ln, 1] === [0, -1, 0, 1]

  [0, 1] n [-1] === [0, -1, 0, 1, 0, 1]

  [0, 1] n [r, 1] === [0, 1, 2, 1]  ("r" is a schenker noop)

  this also increases the pressure on having dot vs mul application of Expr2 onto Expr1




  SEGMENTATION

We h ave implemented this curly brace notation but it feels wrong.    

 maybe curly bracket for slice rotate etc

    [a, b, c, d, e] {-3,-1} === [c, d, e]
    [a, b, c, d, e] {1,} === [b, c, d, e]
    [a, b, c, d, e] 1{} === [e, a, b, c, d]
    [a, b, c, d, e] -1{2} === [d, e, c] chop off first 2 then rotate left 1

    think about a way for this to "lens" through live mutations, instead of simply repeating
    A = [a, b, c, d] -1{1,} ===  [c, d, b]
    4A === [c, d, b, c, d, b, c, d, b, c, d, b]  

    BUT

    how could we let the rotation keep happening on each iteration of the outer 4 operator to get the more musically interesting -- this is like my "walking window" idea.

        4$A === [c, d, b,  d, b, c,  b, c, d,  c, d, b]

      instead of

        4A === [c, d, b,  c, d, b,  c, d, b,  c, d, b]  


    some ops could recompute each iteration, how to determine which ones you want?
    maybe left assigning to a variable "freezes" it, otherwise it always recomputes, but the the reductive bracket operators might need to be an exception

        4$A === [c, d, b, d, b, c, b, c, d, c, d, b]
    
      TBD old syntax notes


  POLYPHONY

    how do we get to polyphony?   to be pure about this, all voices should derive from an Ur voice.

      1) develop the idea of a "voice" which is like Program?
      2) If we name voices, we can have notation to track them
          really?   would have to render them, then express them as a flattened array, then match somehow to our slots...which might be a many to one mapping so not really useful?

      Any place in the structure where we leave wiggle room, we brute force all options and choose the one with the best leaf-level harmonic score


    ALT

      There's a simpler thing to try first.  It's a bit of a hack, but we define one voice to be the cantus firmus.    Any other spans will lazily evaluate i, ii, iii, iv against the cantus firmus pip at that moment.   we carry the roman nums through all the evalauations, and only make into pitches during render.  And actually I guess the roman nums represent the step that the mot uses as its foundation, which defaults to i, which is precisely how things work now.  All we're doing is allowing those anchor degrees resolve differently over time against a cantus firmus

      by default, all pips have a "i", but they can be spcificially overriden by their mot.  how do we handle multiple nested mots with different degrees?  we COULD just add them like ints, this might work...

    how can we express a "walking window" through a mot?   this should be part of the {} slicing and rotating operators

    "r" and "x" are working but may not be right.    seems like if we had a displacement idea, carried alongside timeScale, they both get applied at the same lazy point of note-rendering and neither chages the linear relationships (except negative timescale but even then linearity is preserved)

    think about tension and release, and the idea that displacements must be "paid back" conceptually if not structurally.

    where are we on unifying pips and mots?  I think we might need the separation for things like % and reverse

    I've implemented "x" and "r" as tags, maybe better to just let those be non-numeric values for step
    and watch for them in the evals

    "r" doesn't seem to work as expected when it.s in the second expression


    semicolons to represent left-to-right deltas within the mot?

      [0; 1; 1; 1]   ===   [0, 1, 2, 3]
      [0, 3, 4, 0]   ===   [0; 3; 1; -4]
    

    NOTE -- 2 questions -- could INSTEAD just have this

        [0, >1, >1, >-2] === [0, 1, 2, 0] -- might be better so we can mix and match step types
 
    is there value in 

        [>1, 1] which means the first "1" is a delta from whatever step preceded it so that:

        4[>1] === [0,1,2,3] -- this is HALF BAKED but handy
        A = 4[>1]
        A A === [0,1,2,3,4,5,6,7]








TODOs:

* REPAIR THIS  [0...2 : 1/4] === [0:1/4, 1:1/4, 2:1/4]


* should the * operator be written as concatenation?
  - if it's the most used thing, maybe?
  - i.e., instead of "A * B" we would write "A B"

* the > operator
  - should it have lower or higher precedence than the * operator?
  - how will we represent time-shifted mots?
  - (maybe Mot can have a timeShift field that's 0 by default?)
  - how do time shifts behave wrt the * operator?


* think about unifying pips and mots

    1 === [1]

    # NOTE: Nested mots now preserve unit duration by default.
    # Use the / postfix operator for subdivision:
    [1, [2, 3], 7] ==> [1, 2, 3, 7]  # unit duration preserved
    [1, [2, 3]/, 7] ==> [1, 2/2, 3/2, 7]  # subdivision with /
    [1, [2, 3, 4]/, 7] ==> [1, 2/3, 3/3, 4/3, 7]
    [1, [2, 3, 4, 5]/, 7] ==> [1, 2/4, 3/4, 4/4, 5/4, 7]

    [1, 2, 3] === [[1], [2], [3]]
    [1, [2, 3], 7] === [[1], [2, 3], [7]]
    [1, [2, 3], 7], [8] === [1, [2, 3], 7, 8]
    [1, [2, 3], 7], 8 === [1, [2, 3], 7, 8]
    [[1, [2, 3], 7], 8] ===

    [1, [2, 3], 7], 8 === [1, [2, 3], 7], [8] === [1, [2, 3], 7, 8]
    A, B

    [1, 2, 7], [8] === [1, 2, 7, 8]

    [1, 2, 7]/2, [8] === [1/2, 2/2, 7/2, 8]
    [1, 2, 7]/2, [8]/3 === ???

    A = [1, 2, 3]/3
    B = [4, 5]/7
    [A, B]
    [...A, ...B]

    [0, 1, 2] x [..., 0] ===> [..., ..., ..., 0, 1, 2]
    [..., 0] x [0, 1, 2] ===> [..., 0, ..., 1, ..., 2]
    [..., 0, 0] x [0, 1, 2] ===> [..., 0, 0, ..., 1, 1, ..., 2, 2]

    [0, 1, 2] . [..., 0, 0] ===> [..., 1, 2]
    [0, 1, 2] . [0, ..., 0] ===> [0, ..., 2]
    [0, 1, 2] . [0, ...] ===> [0, ...]
    [0, 1, 2, 3] . [0, 0, 0] => [0, 1, 2]
    [0, 1, 2, 3] . [-1, 1, 3] => [-1, 2, 5]

    rotate operator?

    shift left operator?

    shift right operator?


    f([0, 1, 2]) ===> [..., 1, 2, 1, ..., 2, 1, 2, ...]

    [0, 1, 2] x [X, 0] ===> [0, 1, 2]

    [X, 0] x [0, 1, 2] ===> [X, 0, X, 1, X, 2]

    [X, 0, X, 1, X, 2] * [0, 1, 2] ===> [X, 0, X, 1, X, 2, X, 1, X, 2, X, 3, X, 2, X, 3, X, 4]

    [0, 1, 2] * [X, 0, X, 1, X, 2] ===> [0, 1, 2, 1, 2, 3, 2, 3, 4]


    [3, 4] > 1 === [.../8, 3, 4]
    [...xs[...n], ...xs[(n+5)...]
    [1, 2], ([3, 4] > 1)

  9/.5
    [9]/.5
    [1, 2/.5]/.5 -> [1/.5, 2/.25]
    [1, [2, 3]/.5, 4]/2 ==> [1, 2/.5, 3/.5, 4]/2







  * dot (tiled add)

    [a, b, c] . [d, e] === [a + d, e + b, c + d]

    2nd mot "loops" as needed
    
    could have alt flavor that truncates but we should have different set of slice / rotate / shift / truncate ops?


  * repeat

      4[a] === [a, a, a, a]

    NOTE:
    
      [a] * [0, 0, 0, 0] === [a, a, a, a] so it's just a sugar?   

    could also be a way to avoid needing parens here: 

      [b, c] * ([a] * [0, 0, 0, 0]) sugars to [b, c] * 4[a]


  * reverse & timescale


    [a, b, c] * [0 / -1] === [c, b, a]

    [a, b, c] * [0 / 2] === [a / 2, b / 2, c / 2]

    [a, b, c] * [1 / -1] === [c+1, b+1, a+1]

    [a, b, c] * [1 / -4] === [c+1 / 4, b+1 / 4, a+1 / 4]

* % padding TODO

    timeScale notation that pads to next boundary 
        [0, r % 4] makes an r that pads out the 3 unit durs we need to make 4
        [0, r, 1, %8] gives us [0,r,1,0,0,0,0]

    does this % notaiton have any meaing when on the right side?


    [0, 1] * [2 %4] ????

    I guess the % COULD be sugar for whatever tiscale gets us to the padded end?




  * & for diads TODO

    [a & b, c] 

    [a & b, c] * [0, 1] === [a + b, c, a * 1 + b * 1, c * 1]

    [a & b, c] * [e & f,] ]=== [a * e + a * c + b * e + b * f, e  * c + f * c, e + f]

    [a & b & c, 1] * [0, 1] == [a & b & c, 1, a+1 & b+1 & c+1, 2]


  * x for ommision - noop for mul BUT cool for dot

    4[a, b] * [c, x] results in the same thing as  4[a, b] * [c]

    4[a, b] . [x, d, e] == [xa, db, ea, xb, da, eb, xa, db] == [db, ea, da, eb, db]


  * r for rest - ommision without splicing time

      [a,b,c] * [e, r, g] === [a + e, b + e, c + e, r, r, r, a + g, b + g, c + g]

      [a,b,c] . [e, r, g] === [a + e, r,  g + c]

  * D for displacement (or delay) -  no ommision, inserting time  TODO -- how do we get simple offset.  delay / anticipation?

      [a,b,c] * [e, D, g] === [a + e, b + e, c + e, r, a, r, b, r, c, a + g, b + h, c + g]

      [a,b,c] . [e, D, g] === [a + e, r, b,  g + c]

      [a,b,c] . [e, D / 2, g] === [a + e, r / 2, b,  g + c]



  ? for ranged random inclusive TODO

    4[0, -1?1] ~= [0, 1, 0, -1, 0, -1, 0, 0]


  || for random choice

     [1 || 2, 0] ~= [1, 0]

    4[0 || 1 || 2] ~= [2, 0, 1, 1]
    
    N.B. the random operators suggests a need for optional seedability of the rng


  ... for serial choice inclusive

    [0...3] === [0, 1, 2, 3]
    2[4...6] === [4, 5, 6, 4, 5 6]


  * subdivision

    [a, [b, c]] == [a, b/2, c/2] (Tidal sugar)

    [a, [b, c] / (1/2)] === [a, b, c] (needlessly obtuse illustration of the time scaling + subdivision relationship)

    4[a, b, c] . [0, 0 / 2] === [a, b/2, c, a/2, b, c/2, a, b/2, c, a/2, b, c/2] -- 6/8!


  * grouping / order of operations

    
    [{a, b}, c] * 8[0] === [a, c, b, c, a, c, b, c]

    maybe time-operators are concatenative? 

    OR maybe concatenative operators fire BEFORE the others

    and/or order of operataions is what we use parens to control, default is always L to R regardless of operator type

      A = [0, 1] * [3, 4, 5]
      B = [1, 2] * A

      is same as:

      B = [1, 2] * ([0, 1] * [3, 4, 5])






    * degrees

    [i, iii, v] - chord elements in functional harmony (the i is the root of our current chord)  NOTE that these remain unreified throughout the parse and interp processes.   they remain iii, not abs pitch values.   so you end up in the flattened interp with things like iii - 2, 1,

    scaffolding can be provided with chords or can be dynamically managed at playback time?

    I, Iii, IV are scale degrees from regime tonic.   I8 means tonic at octave 8

    [iv, 1,] * [0, 2] === [iv, 1,   iv + 2, 1 + 2 ]

    spread is tricky — the roman numberals dont move during spread?   also [0, 1] ^ [iv] is invalid?    we could coerce iv to 3 (steps)






  * Encoding Beethoven's 5th (mod duration, rotation operator, ditto vs rest)

    to get beethoven's 5th to be more concise we could introduce duration modding for mots, so they round up to nearest bar

    [r, 0,0,0,-2, r, r, r] * [0, -1] * [3]

    becomes

    [r, 0,0,0,-2] * [0, -1] * [3]

    more precise requires our rot

    [0,0,0,-2] 3{} === [r, r, r, 0, 0, 0, -2] which pads to [r, r, r, 0, 0, 0, -2, ditto]
    
    so we get

    [0,0,0,-2] 3{} * [0, -1] * [3]



TODO:

diads / extra voices
[0, -1 & 1 * 3, -2 & 0]



two flavors of dot, * and ^ (currently we have implemented *

think about | vs ? to solve dealer’s choice at ffirst vs random






