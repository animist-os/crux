# Chorale examples

Each score below was converted from MusicXML (or MIDI) to Crux and then refactored.
Every `.crux` file here was checked note for note against the score by running it
through the Crux interpreter.

For each score there are four files.

- `*.literal.crux` is the converter's output. Each voice is one mot.
- `*.analysis.crux` is the refactored program with musical constraints. Motifs start
  on a beat and never cross a fermata.
- `*.compact.crux` is the shortest program the search found, without constraints.
  It may split the voices into a pitch stream and a rhythm stream, `(P) . (R)`.
- `*.atoms.crux` is the analysis program written with atoms under operators
  (`--generators`): `[5, 4]/`, `[0, -1]/ * [path]`, `[skeleton] . [[0, -1]/]`.
- `*.motifs.md` lists every motif in the analysis program, with where it occurs
  (voice, measure, beat), the scale degree it starts on, and its transformation.

Steps are scale degrees in the key signature, counted from the tonic (`#tonicMidi`).
A half step such as `7/2` is the lower degree raised a semitone (F♯ in C major).
Durations are in quarter notes. Each voice is wrapped `(...) * [k]`, which places
it in its own register. `k = 7` is the tonic an octave up.

| file | piece | why it is here |
|---|---|---|
| `bwv269.*` | Aus meines Herzens Grunde | Riemenschneider No. 1. A Roman-numeral analysis of it ships with the corpus (`choraleAnalyses/riemenschneider001.rntxt`). |
| `bwv1.6.*` | Wie schön leuchtet der Morgenstern | The opening phrases repeat in full (written out), so each voice reuses one long definition. |
| `bwv10.7.*` | Meine Seel’ erhebt den Herren | Slow-moving, with many half notes. |
| `bwv244.62.*` | O Haupt voll Blut und Wunden (St Matthew Passion) | A minor-key chorale. Its leading tones show up as half steps. |
| `bwv227.1.*` | Jesu, meine Freude | |
| `bwv140.7.*` | Wachet auf, ruft uns die Stimme | |
| `bwv227.1.with-library.crux`, `bwv244.17.with-library.crux` | Two chorales held out of library learning | Each is written against the motif library learned from 307 other chorales (`corpus/chorale-library.crux`). The library entries used come first. BWV 227.1 drops from 1,413 to 1,156 bits of its own text, BWV 244.17 from 1,120 to 835. |
| `passion-chorale-family.*` | Eight harmonizations of one tune (BWV 244.44, 244.54, 244.62, 248.5, 270, 271, 161.6, 153.5) | One program holds all 32 voices. Each harmonization enters after the last (`!N`). The tune becomes shared definitions. Two sopranos are the same expression. |
| `bach-invention1-full.*` | Invention No. 1, BWV 772 (MIDI) | Contrast: imitative counterpoint compresses far more than a chorale. |
| `bach-wtc1-fugue2-full.*` | WTC I Fugue in C minor, BWV 847 (MIDI) | Contrast: fugue subject entries. |

Regenerate with:

```sh
node tools/make-chorale-examples.js ../media/music_xml/bach examples/chorales bwv269 bwv1.6 bwv10.7 bwv244.62 bwv227.1 bwv140.7
node tools/make-chorale-examples.js corpus/midi_src/raw examples/chorales bach-invention1-full bach-wtc1-fugue2-full
node tools/make-chorale-examples.js --family examples/chorales/passion-chorale-family.crux --beam 2 \
  ../media/music_xml/bach bwv244.44 bwv244.54 bwv244.62 bwv248.5 bwv270 bwv271 bwv161.6 bwv153.5
node tools/make-chorale-examples.js --only-atoms ../media/music_xml/bach examples/chorales bwv269 bwv1.6 bwv10.7 bwv244.62 bwv227.1 bwv140.7
node tools/make-chorale-examples.js --only-atoms corpus/midi_src/raw examples/chorales bach-invention1-full bach-wtc1-fugue2-full
node tools/learn-library.js ../media/music_xml/bach --out corpus/chorale-library --example bwv227.1 --example bwv244.17
# then copy corpus/chorale-library.bwv227.1.crux and .bwv244.17.crux here as *.with-library.crux
```

Golden does not yet play half steps. It rounds `7/2` down to the natural degree.
See `docs/golden-half-steps.md` for a small proposed patch.
