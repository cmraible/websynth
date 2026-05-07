# WebSynth

A browser-based subtractive synthesizer built with the Web Audio API. No build step, no dependencies — just an HTML file and a JavaScript file.

**Live demo:** [synth.chrisraible.com](https://synth.chrisraible.com)

## What it does

WebSynth is a small monophonic synth modeled after the classic analog signal flow:

```
Oscillator → Lowpass Filter → Amplifier → Speakers
                  ↑
                LFO (pitch modulation)
```

Pick a waveform, sculpt it with the filter, add some movement with the LFO, and play with one of two controllers.

## Controllers

- **XY Pad** — drag to play. X = pitch, Y = filter cutoff. Optional scale snapping (major, minor, pentatonic, blues) keeps you in tune.
- **Keyboard** — click the on-screen piano keys, or use your computer keyboard: `A W S E D F T G Y H U J K`.

A live oscilloscope above the controller shows the waveform you're producing in real time.

## Controls

Every control has a `?` icon next to its label with a short explanation. The full list:

| Control     | What it does                                                                 |
| ----------- | ---------------------------------------------------------------------------- |
| Waveform    | Sine, square, sawtooth, or triangle oscillator                               |
| Cutoff      | Lowpass filter cutoff frequency (keyboard mode only — XY pad's Y controls it) |
| Resonance   | Emphasis at the filter's cutoff — high values give that squelchy/acid quality |
| Glide       | Portamento time when sliding between notes                                   |
| LFO Rate    | Speed of pitch modulation                                                    |
| LFO Depth   | Amount of pitch modulation (vibrato → siren as you turn it up)               |
| Scale Snap  | Forces the XY pad to land on notes in a chosen scale                         |
| Volume      | Master output level                                                          |

## Running locally

```bash
git clone git@github.com:cmraible/websynth.git
cd websynth
python3 -m http.server 8000
# open http://localhost:8000
```

That's it. There's nothing to install.

## How it works

The synth lives in [`synth.js`](./synth.js) and uses the standard Web Audio building blocks:

- `OscillatorNode` for the sound source
- `BiquadFilterNode` (lowpass) for tone-shaping
- A second `OscillatorNode` routed through a `GainNode` into the main oscillator's `frequency` parameter — that's the LFO
- `GainNode`s for envelope and master volume
- `AnalyserNode` feeding a `<canvas>` for the oscilloscope

The XY pad reads pointer events; the keyboard maps physical keys to MIDI note numbers and uses last-note priority for monophonic glide between held keys.

## Deployment

Hosted on [Cloudflare Pages](https://pages.cloudflare.com), connected to this repository — every push to `main` auto-deploys.

## License

MIT
