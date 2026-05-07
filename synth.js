const MIN_NOTE = 36;
const MAX_NOTE = 84;
const MIN_CUTOFF = 120;
const MAX_CUTOFF = 8000;

const SCALES = {
  none:       null,
  chromatic:  [0,1,2,3,4,5,6,7,8,9,10,11],
  major:      [0,2,4,5,7,9,11],
  minor:      [0,2,3,5,7,8,10],
  pentatonic: [0,2,4,7,9],
  blues:      [0,3,5,6,7,10],
};

const KEYBOARD_NOTES = [
  { midi: 60, key: 'a', black: false }, // C4
  { midi: 61, key: 'w', black: true  },
  { midi: 62, key: 's', black: false },
  { midi: 63, key: 'e', black: true  },
  { midi: 64, key: 'd', black: false },
  { midi: 65, key: 'f', black: false },
  { midi: 66, key: 't', black: true  },
  { midi: 67, key: 'g', black: false },
  { midi: 68, key: 'y', black: true  },
  { midi: 69, key: 'h', black: false },
  { midi: 70, key: 'u', black: true  },
  { midi: 71, key: 'j', black: false },
  { midi: 72, key: 'k', black: false }, // C5
];

const params = {
  waveform: 'sawtooth',
  resonance: 8,
  glide: 0.05,
  lfoRate: 0,
  lfoDepth: 0,
  volume: 0.3,
  scale: 'major',
  cutoff: 2000,
};

let mode = 'pad'; // 'pad' | 'keys'

let audioCtx = null;
let masterGain = null;
let osc = null;
let filter = null;
let voiceGain = null;
let lfo = null;
let lfoGain = null;
let analyser = null;
let scopeData = null;
let playing = false;

const heldKeys = new Set();

function midiToFreq(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

function midiToName(m) {
  const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const oct = Math.floor(m / 12) - 1;
  return names[((m % 12) + 12) % 12] + oct;
}

function snapNote(midi) {
  const set = SCALES[params.scale];
  if (!set) return midi;
  const pc = ((midi % 12) + 12) % 12;
  let best = set[0], bestDist = 99;
  for (const s of set) {
    const d = Math.min((pc - s + 12) % 12, (s - pc + 12) % 12);
    if (d < bestDist) { bestDist = d; best = s; }
  }
  return Math.round(midi - pc + best);
}

function ensureAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  masterGain = audioCtx.createGain();
  masterGain.gain.value = params.volume;

  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  scopeData = new Uint8Array(analyser.fftSize);

  masterGain.connect(analyser);
  masterGain.connect(audioCtx.destination);

  filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = params.cutoff;
  filter.Q.value = params.resonance;

  voiceGain = audioCtx.createGain();
  voiceGain.gain.value = 0;

  osc = audioCtx.createOscillator();
  osc.type = params.waveform;
  osc.frequency.value = 220;

  lfo = audioCtx.createOscillator();
  lfo.frequency.value = params.lfoRate;
  lfoGain = audioCtx.createGain();
  lfoGain.gain.value = params.lfoDepth;
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);

  osc.connect(filter);
  filter.connect(voiceGain);
  voiceGain.connect(masterGain);

  osc.start();
  lfo.start();
}

function setPitch(midi) {
  ensureAudio();
  const freq = midiToFreq(midi);
  osc.frequency.setTargetAtTime(freq, audioCtx.currentTime, Math.max(0.0001, params.glide));
  document.getElementById('readout').textContent =
    `${midiToName(Math.round(midi)).padEnd(4)} ${freq.toFixed(1)}Hz  cut ${params.cutoff.toFixed(0)}Hz`;
}

function setCutoff(hz) {
  params.cutoff = hz;
  if (filter) filter.frequency.setTargetAtTime(hz, audioCtx.currentTime, 0.01);
}

function setFromXY(xNorm, yNorm) {
  ensureAudio();
  if (audioCtx.state === 'suspended') audioCtx.resume();

  const midiFloat = MIN_NOTE + xNorm * (MAX_NOTE - MIN_NOTE);
  const midi = SCALES[params.scale] ? snapNote(midiFloat) : midiFloat;
  const cutoff = MIN_CUTOFF * Math.pow(MAX_CUTOFF / MIN_CUTOFF, yNorm);

  setPitch(midi);
  setCutoff(cutoff);
}

function noteOn() {
  ensureAudio();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  if (playing) return;
  playing = true;
  const now = audioCtx.currentTime;
  voiceGain.gain.cancelScheduledValues(now);
  voiceGain.gain.setValueAtTime(voiceGain.gain.value, now);
  voiceGain.gain.linearRampToValueAtTime(1, now + 0.02);
  document.getElementById('pad').classList.add('active');
}

function noteOff() {
  if (!playing) return;
  playing = false;
  const now = audioCtx.currentTime;
  voiceGain.gain.cancelScheduledValues(now);
  voiceGain.gain.setValueAtTime(voiceGain.gain.value, now);
  voiceGain.gain.linearRampToValueAtTime(0, now + 0.08);
  document.getElementById('pad').classList.remove('active');
}

function bindPad() {
  const pad = document.getElementById('pad');
  const cursor = document.getElementById('cursor');

  const update = (clientX, clientY) => {
    const rect = pad.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    const yNorm = 1 - y;
    setFromXY(x, yNorm);
    pad.style.setProperty('--x', `${x * 100}%`);
    pad.style.setProperty('--y', `${y * 100}%`);
    cursor.style.left = `${x * 100}%`;
    cursor.style.top  = `${y * 100}%`;
  };

  let dragging = false;
  const onDown = (e) => {
    dragging = true;
    pad.setPointerCapture(e.pointerId);
    update(e.clientX, e.clientY);
    noteOn();
  };
  const onMove = (e) => { if (dragging) update(e.clientX, e.clientY); };
  const onUp = (e) => {
    if (!dragging) return;
    dragging = false;
    try { pad.releasePointerCapture(e.pointerId); } catch {}
    noteOff();
  };

  pad.addEventListener('pointerdown', onDown);
  pad.addEventListener('pointermove', onMove);
  pad.addEventListener('pointerup', onUp);
  pad.addEventListener('pointercancel', onUp);
  pad.addEventListener('pointerleave', () => { if (dragging) { dragging = false; noteOff(); } });
}

function buildKeyboard() {
  const kb = document.getElementById('keyboard');
  for (const note of KEYBOARD_NOTES) {
    const el = document.createElement('div');
    el.className = 'key' + (note.black ? ' black' : '');
    el.dataset.midi = String(note.midi);
    const label = document.createElement('span');
    label.textContent = note.key.toUpperCase();
    el.appendChild(label);

    const start = (e) => { e.preventDefault(); pressKey(note.midi); };
    const end   = (e) => { e.preventDefault(); releaseKey(note.midi); };

    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      start(e);
    });
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('pointerleave', (e) => { if (heldKeys.has(note.midi)) end(e); });

    kb.appendChild(el);
  }
}

function pressKey(midi) {
  if (heldKeys.has(midi)) return;
  heldKeys.add(midi);
  setPitch(midi);
  noteOn();
  const el = document.querySelector(`#keyboard [data-midi="${midi}"]`);
  if (el) el.classList.add('active');
}

function releaseKey(midi) {
  if (!heldKeys.has(midi)) return;
  heldKeys.delete(midi);
  const el = document.querySelector(`#keyboard [data-midi="${midi}"]`);
  if (el) el.classList.remove('active');

  if (heldKeys.size === 0) {
    noteOff();
  } else {
    // last-note priority: re-pitch to most recently still-held key
    const last = [...heldKeys].pop();
    setPitch(last);
  }
}

function bindKeyboardInput() {
  const keyMap = new Map(KEYBOARD_NOTES.map(n => [n.key, n.midi]));
  window.addEventListener('keydown', (e) => {
    if (mode !== 'keys' || e.repeat) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    const midi = keyMap.get(e.key.toLowerCase());
    if (midi !== undefined) pressKey(midi);
  });
  window.addEventListener('keyup', (e) => {
    const midi = keyMap.get(e.key.toLowerCase());
    if (midi !== undefined) releaseKey(midi);
  });
}

function bindControls() {
  const blurAfterUse = (el) => {
    el.addEventListener('pointerup', () => el.blur());
    el.addEventListener('change', () => el.blur());
  };

  const bindRange = (id, key, onChange) => {
    const input = document.getElementById(id);
    const out = document.getElementById(id + 'Val');
    input.addEventListener('input', () => {
      params[key] = parseFloat(input.value);
      out.textContent = input.value;
      if (onChange) onChange();
    });
    blurAfterUse(input);
  };

  const waveformSelect = document.getElementById('waveform');
  waveformSelect.addEventListener('change', (e) => {
    params.waveform = e.target.value;
    if (osc) osc.type = params.waveform;
  });
  blurAfterUse(waveformSelect);

  const scaleSelect = document.getElementById('scale');
  scaleSelect.addEventListener('change', (e) => {
    params.scale = e.target.value;
  });
  blurAfterUse(scaleSelect);
  bindRange('resonance', 'resonance', () => { if (filter) filter.Q.value = params.resonance; });
  bindRange('glide', 'glide');
  bindRange('lfoRate', 'lfoRate', () => { if (lfo) lfo.frequency.value = params.lfoRate; });
  bindRange('lfoDepth', 'lfoDepth', () => { if (lfoGain) lfoGain.gain.value = params.lfoDepth; });
  bindRange('volume', 'volume', () => { if (masterGain) masterGain.gain.value = params.volume; });
  bindRange('cutoff', 'cutoff', () => { if (filter) filter.frequency.setTargetAtTime(params.cutoff, audioCtx.currentTime, 0.01); });
}

function setMode(next) {
  if (mode === next) return;
  // release any held notes before switching
  for (const m of [...heldKeys]) releaseKey(m);
  if (playing) noteOff();

  mode = next;
  const padBtn = document.getElementById('modePad');
  const keysBtn = document.getElementById('modeKeys');
  const padWrap = document.getElementById('padWrap');
  const kb = document.getElementById('keyboard');
  const cutoffControl = document.getElementById('cutoffControl');
  const hint = document.getElementById('hint');

  if (mode === 'pad') {
    padBtn.classList.add('active');
    keysBtn.classList.remove('active');
    padWrap.classList.remove('hidden');
    kb.classList.add('hidden');
    cutoffControl.classList.add('hidden');
    hint.textContent = 'Click and drag on the pad — X controls pitch, Y controls filter cutoff';
  } else {
    keysBtn.classList.add('active');
    padBtn.classList.remove('active');
    padWrap.classList.add('hidden');
    kb.classList.remove('hidden');
    cutoffControl.classList.remove('hidden');
    hint.textContent = 'Click keys or use your computer keyboard: A W S E D F T G Y H U J K';
  }
}

function bindModeToggle() {
  document.getElementById('modePad').addEventListener('click', () => setMode('pad'));
  document.getElementById('modeKeys').addEventListener('click', () => setMode('keys'));
  // initial state: pad mode, hide cutoff slider since pad's Y controls it
  document.getElementById('cutoffControl').classList.add('hidden');
}

function drawScope() {
  const canvas = document.getElementById('scope');
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  const render = () => {
    ctx.fillStyle = '#06070a';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#1a1f2a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    if (analyser) {
      analyser.getByteTimeDomainData(scopeData);
      ctx.lineWidth = 2;
      ctx.strokeStyle = playing ? '#4af' : '#2a4a6a';
      ctx.shadowColor = '#4af';
      ctx.shadowBlur = playing ? 8 : 0;
      ctx.beginPath();
      const step = w / scopeData.length;
      for (let i = 0; i < scopeData.length; i++) {
        const v = scopeData[i] / 128 - 1;
        const y = h / 2 + v * (h / 2) * 0.9;
        if (i === 0) ctx.moveTo(i * step, y);
        else ctx.lineTo(i * step, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    requestAnimationFrame(render);
  };
  render();
}

bindPad();
buildKeyboard();
bindKeyboardInput();
bindControls();
bindModeToggle();
drawScope();
