# Crux in Logic's Scripter

`dist/crux-scripter.js` is one script that runs a Crux program as a MIDI FX
in Logic, locked to the transport.

The script is a build output and is not in the repository. Build it first:
`npm run build:scripter` (see Rebuilding below).

1. On a software-instrument track, add **MIDI FX → Scripter**.
2. Open the Script Editor, select all, paste `dist/crux-scripter.js`, then press **Run Script**.
3. Press Play. The program plays from bar 1 and loops. With Loop off it plays once.

Edit the program between the backticks at the top of the script, then press
Run Script again. It can't contain a backtick (`` ` ``).

- `timeScale` 1 is a quarter note.
- Steps are degrees of C major. Step 0 is C at the Octave knob (4 = middle C),
  7 is the next octave up, and negative steps go down. Fractional steps fall
  between degrees, so 1/2 above C is C#.
- `r` is a rest. `&` chords play every step.
- Each section (`!`) is a voice. Set Channels to "Voice n on channel n" to
  send each voice to its own MIDI channel.
- Knobs: Octave, Gate (% of each note's length), Velocity, Channels, Loop,
  Pass input through.
- Random values are rolled once, when you press Run Script.
- Errors show in Scripter's console.

To change the scale, edit `SCALE` and `ROOT_PC` in `scripter/player.js`, or in
the pasted script.

## Rebuilding

```
npm run build              # if src/ changed
npm run build:scripter     # or: node scripter/build-scripter.js my-program.crux
```

`build:scripter` writes `dist/crux-scripter.js`. It contains the program, then
ohm-js and `dist/crux.cjs` wrapped in their own scope, then `scripter/player.js`.
