


TODOs:

* understand time
  - 1 is 8th note
  - .5 is qtr note
  - .25 is whole
  - (why not the other way around, i.e., 2 is qtr note, 4 is whole note, etc.?)

* should the * operator be written as concatenation?
  - if it's the most used thing, maybe?
  - i.e., instead of "A * B" we would write "A B"

* the > operator
  - should it have lower or higher precedence than the * operator?
  - how will we represent time-shifted motifs?
  - (maybe Motif can have a timeShift field that's 0 by default?)
  - how do time shifts behave wrt the * operator?

* write the function that takes a motif and a "frame of reference" (key and unit of time)
  ... and turns it into actual notes (MIDI?)
  (could be a method in Motif)

* think about unifying pips and motifs

    1 === [1]

    [1, [2, 3], 7] ==> [1, 2/2, 3/2, 7]
    [1, [2, 3, 4], 7] ==> [1, 2/3, 3/3, 4/3, 7]
    [1, [2, 3, 4, 5], 7] ==> [1, 2/4, 3/4, 4/4, 5/4, 7]

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

    [0, 1, 2] x [_, 0] ===> [_, _, _, 0, 1, 2]
    [_, 0] x [0, 1, 2] ===> [_, 0, _, 1, _, 2]
    [_, 0, 0] x [0, 1, 2] ===> [_, 0, 0, _, 1, 1, _, 2, 2]

    [0, 1, 2] . [_, 0, 0] ===> [_, 1, 2]
    [0, 1, 2] . [0, _, 0] ===> [0, _, 2]
    [0, 1, 2] . [0, _] ===> [0, _]
    [0, 1, 2, 3] . [0, 0, 0] => [0, 1, 2]
    [0, 1, 2, 3] . [-1, 1, 3] => [-1, 2, 5]

    rotate operator?

    shift left operator?

    shift right operator?



    f([0, 1, 2]) ===> [_, 1, 2, 1, _, 2, 1, 2, _]

    [0, 1, 2] x [X, 0] ===> [0, 1, 2]

    [X, 0] x [0, 1, 2] ===> [X, 0, X, 1, X, 2]

    [X, 0, X, 1, X, 2] * [0, 1, 2] ===> [X, 0, X, 1, X, 2, X, 1, X, 2, X, 3, X, 2, X, 3, X, 4]

    [0, 1, 2] * [X, 0, X, 1, X, 2] ===> [0, 1, 2, 1, 2, 3, 2, 3, 4]


    [3, 4] > 1 === [_/8, 3, 4]
    [...xs[...n], ...xs[(n+5)...]
    [1, 2], ([3, 4] > 1)

  9/.5
    [9]/.5
    [1, 2/.5]/.5 -> [1/.5, 2/.25]
    [1, [2, 3]/.5, 4]/2 ==> [1, 2/.5, 3/.5, 4]/2















  * dot (tiled add)

    [a, b, c] . [d, e] === [a + d, e + b, c + d]

    2nd motif "loops" as needed
    
    could have alt flavor that truncates but we should have different set of slice / rotate / shift / truncate ops?


  * repeat

    4[a] === [a, a, a, a]

    of course:
    
    [a] * [0, 0, 0, 0] === [a, a, a, a] so it's just a sugar?   

    could also be a way to avoid needing parens here: 

    [b, c] * ([a] * [0, 0, 0, 0]) sugars to [b, c] * 4[a]


  * reverse


    [a, b, c] * [0 / -1] === [c, b, a]

    [a, b, c] * [0 / 2] === [a / 2, b / 2, c / 2]

    [a, b, c] * [1 / -1] === [c+1, b+1, a+1]

    [a, b, c] * [1 / -4] === [c+1 / 4, b+1 / 4, a+1 / 4]

* % padding

    timeScale notation that pads to next boundary 
        [0, r % 4] makes an r that pads out the 3 unit durs we need to make 4
        [0, r, 1, %8] gives us [0,r,1,0,0,0,0]

    does this % notaiton have any meaing when on the right side?


    [0, 1] * [2 %4] ????

    I guess the % COULD be sugar for whatever tiscale gets us to the padded end?




  * & for diads

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



  ? for ranged random inclusive

    4[0, -1?1] ~= [0, 1, 0, -1, 0, -1, 0, 0]


  | for random choice

     [1 | 2, 0] ~= [1, 0]

    4[0 | 1 | 2] ~= [2, 0, 1, 1]
    
    N.B. the random operators suggests a need for optional seedability of the rng


  ... for serial choice inclusive

    [0...3] === [0, 1, 2, 3]
    2[4...6] === [4, 5, 6, 4, 5 6]


  * schenker ops

    step [0, 3] === [0,1,2,3]
    neighbor [0] === [0, 1, 0] or [0, -1, 0] 
    how can we express ...
      a_neighbor[0] => [-1/2, 0/2] — anticipatory lower neighbor, subdividing the time span (very schenker)
      m_neighboor[0] / (1 / 3) => [0, -1, 0] 


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

      {?, +4} means random insk, duration 4 or {?-4, +4}  TBD





  * maybe curly bracket for slice rotate etc

    [a, b, c, d, e] {-3,-1} === [c, d, e]
    [a, b, c, d, e] {1,} === [b, c, d, e]
    [a, b, c, d, e] 1{} === [e, a, b, c, d]
    [a, b, c, d, e] -1{2} === [d, e, c] chop off first 2 then rotate left 1

    think about a way for this to "lens" through live mutations, instead of simply repeating
    A = [a, b, c, d] -1{1,} ===  [c, d, b]
    4A === [c, d, b, c, d, b, c, d, b, c, d, b]  

    BUT

    how could we let the rotation keep happening on each iteration of the outer 4 operator to get the more musically interesting

        4$A === [c, d, b,  d, b, c,  b, c, d,  c, d, b]

      instead of

        4A === [c, d, b,  c, d, b,  c, d, b,  c, d, b]  


    some ops could recompute each iteration, how to determine which ones you want?
    maybe left assigning to a variable "freezes" it, otherwise it always recomputes, but the the reductive bracket operators might need to be an exception

    4$A === [c, d, b, d, b, c, b, c, d, c, d, b]
    


    * degrees

    [i, iii, v] - chord elements in functional harmony (the i is the root of our current chord)  NOTE that these remain unreified throughout the parse and interp processes.   they remain iii, not abs pitch values.   so you end up in the flattened interp with things like iii - 2, 1,

    scaffolding can be provided with chords or can be dynamically managed at playback time?

    I, Iii, IV are scale degrees from regime tonic.   I8 means tonic at octave 8

    [iv, 1,] * [0, 2] === [iv, 1,   iv + 2, 1 + 2 ]

    spread is tricky — the roman numberals dont move during spread?   also [0, 1] ^ [iv] is invalid?    we could coerce iv to 3 (steps)




  * questions

    I've implemented "x" and "r" as tags, maybe better to just let those be non-numeric values for step
    and watch for them in the evals

    "r" doesn't seem to work as expected when its in the second expression



    semicolons to represent left-to-right deltas within the motif?

      [0; 1; 1; 1]   ===   [0, 1, 2, 3]
      [0, 3, 4, 0]   ===   [0; 3; 1; -4]
    

    NOTE -- 2 questions -- could INSTEAD just have this

        [0, >1, >1, >-2] === [0, 1, 2, 0]
 
    is there value in 

        [>1, 1] which means the first "1" is a delta from whatever step preceded it so that:

        4[>1] === [0,1,2,3] -- this is HALF BAKED but handy


  * Encoding Beethoven's 5th (mod duration, rotation operator, ditto vs rest)

    to get beethoven's 5th to be more concise we could introduce duration modding for motifs, so they round up to nearest bar

    [r, 0,0,0,-2, r, r, r] * [0, -1] * [3]

    becomes

    [r, 0,0,0,-2] * [0, -1] * [3]

    more precise requires our rot

    [0,0,0,-2] 3{} === [r, r, r, 0, 0, 0, -2] which pads to [r, r, r, 0, 0, 0, -2, ditto]
    
    so we get

    [0,0,0,-2] 3{} * [0, -1] * [3]







