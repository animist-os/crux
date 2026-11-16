// ─── Crux player for Logic's Scripter ────────────────────────────────────
// Turns the CRUX program at the top of this script into MIDI, locked to
// Logic's transport. Each section (each `!`) is a voice; the program loops
// from bar 1 (Loop on) or plays once.
//
//   timeScale 1 = a quarter note (one beat)
//   step n      = the nth degree of the scale above the root (C major, middle C
//                 at Octave 4); negative steps go down, 7 is the octave.
//                 Fractional steps land between degrees, rounded to the nearest
//                 semitone (ties go down): 1/2 above C is C#.
//   r           = a rest; `&` chords play all their steps.

var NeedsTimingInfo = true;

var SCALE = [0, 2, 4, 5, 7, 9, 11];   // C major; change for another mode
var ROOT_PC = 0;                      // pitch class of step 0 (0 = C)

var PluginParameters = [
  { name: "Octave",   type: "lin", minValue: 0, maxValue: 8, numberOfSteps: 8, defaultValue: 4 },
  { name: "Gate",     type: "lin", unit: "%", minValue: 5, maxValue: 100, numberOfSteps: 95, defaultValue: 90 },
  { name: "Velocity", type: "lin", minValue: 1, maxValue: 127, numberOfSteps: 126, defaultValue: 96 },
  { name: "Channels", type: "menu", valueStrings: ["All on channel 1", "Voice n on channel n"], defaultValue: 0 },
  { name: "Loop",     type: "checkbox", defaultValue: 1 },
  { name: "Pass input through", type: "checkbox", defaultValue: 1 },
];

// ── the program, as timed events ──
// cruxEvents: [{ t, dur, steps: [..], voice }] in beats from the start, sorted by t.
var cruxEvents = [];
var cruxLength = 0;      // beats; the longest voice

function cruxCompile(source) {
  var result = golden.crux_interp(source);
  var events = [], length = 0;
  for (var v = 0; v < result.sections.length; v++) {
    var pips = result.sections[v].values || [];
    var t = 0;
    for (var i = 0; i < pips.length; i++) {
      var p = pips[i], dur = Math.abs(p.timeScale);
      if (!(dur > 0)) continue;
      if (!p.tag) events.push({ t: t, dur: dur, steps: p.diad ? [p.step].concat(p.diad) : [p.step], voice: v });
      t += dur;
    }
    if (t > length) length = t;
  }
  events.sort(function (a, b) { return a.t - b.t || a.voice - b.voice; });
  return { events: events, length: length, voices: result.sections.length };
}

function degreeToSemis(d) {
  var n = SCALE.length;
  var lo = Math.floor(d), frac = d - lo;
  var oct = Math.floor(lo / n), deg = lo - oct * n;
  var a = oct * 12 + SCALE[deg];
  if (frac === 0) return a;
  var b = deg + 1 < n ? oct * 12 + SCALE[deg + 1] : (oct + 1) * 12 + SCALE[0];
  return Math.ceil(a + frac * (b - a) - 0.5);       // round, ties down
}

try {
  var compiled = cruxCompile(CRUX);
  cruxEvents = compiled.events;
  cruxLength = compiled.length;
  Trace("Crux: " + compiled.voices + " voice(s), " + cruxEvents.length + " notes, " + cruxLength + " beats");
} catch (e) {
  Trace("Crux error: " + (e && e.message ? e.message : e));
}

// ── playback ──
var sounding = [];        // { pitch, channel, offBeat }
var lastBlockEnd = -1;

function sendOff(n, beat) {
  var off = new NoteOff();
  off.pitch = n.pitch; off.channel = n.channel; off.velocity = 0;
  if (beat == null) off.send(); else off.sendAtBeat(beat);
}
function allOff() {
  for (var i = 0; i < sounding.length; i++) sendOff(sounding[i]);
  sounding = [];
}

// Play the events whose start falls in [a, b) — song beats, 1 = bar 1.
function playSpan(a, b) {
  var L = cruxLength;
  if (!(L > 0) || !cruxEvents.length) return;
  var loop = GetParameter("Loop") >= 0.5;
  var gate = GetParameter("Gate") / 100;
  var vel = Math.round(GetParameter("Velocity"));
  var base = 12 * (GetParameter("Octave") + 1) + ROOT_PC;    // Octave 4 → C4 = 60
  var perVoice = GetParameter("Channels") >= 0.5;
  var pa = a - 1, pb = b - 1;                                 // beats since bar 1
  if (pb <= 0) return;
  var k = loop ? Math.floor(Math.max(pa, 0) / L) : 0;
  for (; k * L < pb; k++) {
    if (!loop && k > 0) break;
    var off0 = k * L;
    for (var i = 0; i < cruxEvents.length; i++) {
      var e = cruxEvents[i], t = off0 + e.t;
      if (t < pa) continue;
      if (t >= pb) break;
      var ch = perVoice ? Math.min(16, e.voice + 1) : 1;
      for (var s = 0; s < e.steps.length; s++) {
        var pitch = base + degreeToSemis(e.steps[s]);
        if (pitch < 0 || pitch > 127) continue;
        var on = new NoteOn();
        on.pitch = pitch; on.velocity = vel; on.channel = ch;
        on.sendAtBeat(t + 1);
        sounding.push({ pitch: pitch, channel: ch, offBeat: t + 1 + e.dur * gate });
      }
    }
  }
}

// Note-offs due before `b`.
function releaseUntil(b) {
  var keep = [];
  for (var i = 0; i < sounding.length; i++) {
    var n = sounding[i];
    if (n.offBeat < b) sendOff(n, n.offBeat); else keep.push(n);
  }
  sounding = keep;
}

function ProcessMIDI() {
  var info = GetTimingInfo();
  if (!info.playing) {
    if (sounding.length) allOff();
    lastBlockEnd = -1;
    return;
  }
  var a = info.blockStartBeat, b = info.blockEndBeat;
  if (lastBlockEnd >= 0 && Math.abs(a - lastBlockEnd) > 1e-3) allOff();   // located or jumped
  if (info.cycling && b > info.rightCycleBeat && a < info.rightCycleBeat) {
    // the block wraps around the cycle: play up to the right edge, then from the left
    var r = info.rightCycleBeat, l = info.leftCycleBeat;
    releaseUntil(r); playSpan(a, r);
    allOff();
    playSpan(l, l + (b - r)); releaseUntil(l + (b - r));
    lastBlockEnd = l + (b - r);
    return;
  }
  releaseUntil(b);
  playSpan(a, b);
  releaseUntil(b);      // very short notes that end inside this block
  lastBlockEnd = b;
}

function HandleMIDI(event) {
  if (GetParameter("Pass input through") >= 0.5) event.send();
}

function Reset() { allOff(); lastBlockEnd = -1; }
