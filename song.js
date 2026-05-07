// A short song played live by the Web Audio API.
// Key: A minor. Tempo: 96 BPM.
// Progression: Am  -  F  -  C  -  G   (i - VI - III - VII)
// Played as 4 bars * 4 repeats = ~30 seconds.

const BPM = 96;
const BEAT = 60 / BPM;
const STEP = BEAT / 4;          // 16th note
const BAR = BEAT * 4;
const TOTAL_BARS = 16;

let audioCtx = null;
let masterGain = null;
let analyser = null;
let scopeData = null;
let playing = false;

function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }

// ---------- Voices ----------

function kick(t) {
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(1.0, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
  o.connect(g).connect(masterGain);
  o.start(t);
  o.stop(t + 0.45);
}

function snare(t) {
  const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.2, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const noise = audioCtx.createBufferSource();
  noise.buffer = buf;
  const bp = audioCtx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1800;
  bp.Q.value = 0.7;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.6, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  noise.connect(bp).connect(g).connect(masterGain);
  noise.start(t);
  noise.stop(t + 0.2);

  // tonal body
  const o = audioCtx.createOscillator();
  const og = audioCtx.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(200, t);
  o.frequency.exponentialRampToValueAtTime(110, t + 0.1);
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(0.3, t + 0.005);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  o.connect(og).connect(masterGain);
  o.start(t);
  o.stop(t + 0.13);
}

function hat(t, open = false) {
  const dur = open ? 0.18 : 0.04;
  const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * dur, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const noise = audioCtx.createBufferSource();
  noise.buffer = buf;
  const hp = audioCtx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7000;
  const g = audioCtx.createGain();
  const peak = open ? 0.18 : 0.12;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  noise.connect(hp).connect(g).connect(masterGain);
  noise.start(t);
  noise.stop(t + dur);
}

function bass(t, midiNote, dur) {
  const o = audioCtx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.value = midi(midiNote);

  const sub = audioCtx.createOscillator();
  sub.type = 'sine';
  sub.frequency.value = midi(midiNote - 12);

  const f = audioCtx.createBiquadFilter();
  f.type = 'lowpass';
  f.Q.value = 6;
  f.frequency.setValueAtTime(300, t);
  f.frequency.exponentialRampToValueAtTime(900, t + 0.04);
  f.frequency.exponentialRampToValueAtTime(180, t + dur);

  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
  g.gain.setTargetAtTime(0.25, t + 0.05, 0.05);
  g.gain.setTargetAtTime(0.0001, t + dur - 0.02, 0.02);

  o.connect(f);
  sub.connect(f);
  f.connect(g).connect(masterGain);
  o.start(t);
  sub.start(t);
  o.stop(t + dur + 0.05);
  sub.stop(t + dur + 0.05);
}

function pad(t, midiNotes, dur) {
  // soft sustained chord pad with detuned saws
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.06, t + 0.6);
  g.gain.setTargetAtTime(0.0001, t + dur - 0.3, 0.15);

  const f = audioCtx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 1400;
  f.Q.value = 1;
  f.connect(g);
  g.connect(masterGain);

  for (const n of midiNotes) {
    for (const detune of [-7, 0, 7]) {
      const o = audioCtx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midi(n);
      o.detune.value = detune;
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
  }
}

function lead(t, midiNote, dur) {
  const o = audioCtx.createOscillator();
  o.type = 'square';
  o.frequency.value = midi(midiNote);

  const f = audioCtx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 2400;
  f.Q.value = 2;

  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
  g.gain.setTargetAtTime(0.12, t + 0.05, 0.08);
  g.gain.setTargetAtTime(0.0001, t + dur - 0.05, 0.04);

  // delay (one repeat)
  const delay = audioCtx.createDelay();
  delay.delayTime.value = STEP * 3;
  const fb = audioCtx.createGain();
  fb.gain.value = 0.35;
  const wet = audioCtx.createGain();
  wet.gain.value = 0.4;

  o.connect(f).connect(g).connect(masterGain);
  g.connect(delay);
  delay.connect(fb).connect(delay);
  delay.connect(wet).connect(masterGain);

  o.start(t);
  o.stop(t + dur + 0.1);
}

// ---------- Composition ----------

// MIDI: A2=45, F2=41, C3=48, G2=43
// Triads (root position close voicings, octave 4):
// Am: A4 C5 E5  (69, 72, 76)
// F:  F4 A4 C5  (65, 69, 72)
// C:  C5 E5 G5  (72, 76, 79)  (use C4 voicing 60 64 67 to keep low)
// G:  G4 B4 D5  (67, 71, 74)
const PROG = [
  { bassRoot: 45, chord: [69, 72, 76] }, // Am
  { bassRoot: 41, chord: [65, 69, 72] }, // F
  { bassRoot: 48, chord: [60, 64, 67] }, // C
  { bassRoot: 43, chord: [67, 71, 74] }, // G
];

// A minor pentatonic for the lead
const PENT = [69, 72, 74, 76, 79, 81, 84]; // A4..A5-ish

// 16-step bass pattern (1 per step, null = rest). Roots and octave hops.
const BASS_PATTERN = [
  0, null, 0, 0,    // 1 . 1 1
  null, 0, null, 12, // . 1 . +oct
  0, null, 0, 7,     // 1 . 1 +5th
  null, 0, 12, null, // . 1 +oct .
];

// Drum pattern (16 steps each)
const KICK   = [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,1];
const SNARE  = [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1];
const HAT    = [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1];
const HAT_OPEN_STEPS = [6, 14];

function scheduleSong(startTime) {
  const start = startTime + 0.05;

  for (let bar = 0; bar < TOTAL_BARS; bar++) {
    const barStart = start + bar * BAR;
    const chordIdx = bar % PROG.length;
    const { bassRoot, chord } = PROG[chordIdx];

    // pad: hold for the whole bar
    pad(barStart, chord, BAR * 0.95);

    // drums + bass per 16th step
    for (let step = 0; step < 16; step++) {
      const t = barStart + step * STEP;
      if (KICK[step])  kick(t);
      if (SNARE[step]) snare(t);
      if (HAT[step])   hat(t, HAT_OPEN_STEPS.includes(step));
      const off = BASS_PATTERN[step];
      if (off !== null && off !== undefined) {
        bass(t, bassRoot + off, STEP * 1.6);
      }
    }

    // lead: skip the first bar of each 4-bar phrase (build-up), then noodle
    if (bar % 4 !== 0) {
      const leadSteps = pickLeadPattern(bar);
      for (const [step, noteIdx, dur] of leadSteps) {
        lead(barStart + step * STEP, PENT[noteIdx], STEP * dur);
      }
    }
  }

  // tail: a final chord stab + crash (open hat) at the end
  const end = start + TOTAL_BARS * BAR;
  pad(end, [60, 64, 67, 72], 2.0);
  hat(end, true);
  kick(end);

  // schedule UI reset
  setTimeout(() => {
    playing = false;
    const btn = document.getElementById('play');
    btn.disabled = false;
    btn.textContent = 'Play again';
  }, (TOTAL_BARS * BAR + 2.5) * 1000);
}

function pickLeadPattern(bar) {
  // simple deterministic-ish phrase that varies by bar
  const phrases = [
    [[0,0,2],[2,2,1],[3,3,2],[6,4,1],[7,3,1],[10,2,2],[12,1,3]],
    [[0,2,1],[1,3,1],[2,4,2],[6,3,1],[8,2,1],[10,1,2],[12,0,3]],
    [[0,4,2],[2,3,1],[3,4,1],[5,5,2],[8,3,2],[12,2,3]],
    [[0,1,1],[1,2,1],[2,3,1],[3,4,1],[6,5,2],[10,4,1],[12,3,3]],
  ];
  return phrases[bar % phrases.length];
}

// ---------- Boot ----------

function ensureAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.7;
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  scopeData = new Uint8Array(analyser.fftSize);
  masterGain.connect(analyser);
  masterGain.connect(audioCtx.destination);
}

function drawScope() {
  const canvas = document.getElementById('scope');
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const render = () => {
    ctx.fillStyle = '#06070a';
    ctx.fillRect(0, 0, w, h);
    if (analyser) {
      analyser.getByteTimeDomainData(scopeData);
      ctx.lineWidth = 2;
      ctx.strokeStyle = playing ? '#4af' : '#2a4a6a';
      ctx.shadowColor = '#4af';
      ctx.shadowBlur = playing ? 10 : 0;
      ctx.beginPath();
      const step = w / scopeData.length;
      for (let i = 0; i < scopeData.length; i++) {
        const v = scopeData[i] / 128 - 1;
        const y = h / 2 + v * (h / 2) * 0.95;
        if (i === 0) ctx.moveTo(i * step, y);
        else ctx.lineTo(i * step, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else {
      ctx.strokeStyle = '#2a4a6a';
      ctx.beginPath();
      ctx.moveTo(0, h/2); ctx.lineTo(w, h/2);
      ctx.stroke();
    }
    requestAnimationFrame(render);
  };
  render();
}

document.getElementById('play').addEventListener('click', () => {
  ensureAudio();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  if (playing) return;
  playing = true;
  const btn = document.getElementById('play');
  btn.disabled = true;
  btn.textContent = 'Playing…';
  scheduleSong(audioCtx.currentTime);
});

drawScope();
