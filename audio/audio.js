// audio/audio.js — Procedural audio engine
// Music: A minor / 128 BPM / evolving 4-bar loops / 5 progressive layers
// SFX:   8 one-shot sounds + ambient drone + engine hum

// ── MUSIC CONSTANTS (module-level for zero allocation in hot path) ───
const _BPM  = 128;
const _BEAT = 60 / _BPM;      // 0.46875 s
const _STEP = _BEAT / 4;      // 0.11719 s  (16th note)
const _BAR  = _STEP * 16;     // 1.875   s

// Equal-tempered note frequencies in Hz (A4 = 440)
const _N = {
  A1:55.00, B1:61.74,
  C2:65.41, D2:73.42, E2:82.41, F2:87.31, G2:98.00,
  A2:110.0, B2:123.47,
  C3:130.81, D3:146.83, E3:164.81, F3:174.61, G3:196.00,
  A3:220.0,  B3:246.94,
  C4:261.63, D4:293.66, E4:329.63, F4:349.23, G4:392.00,
  A4:440.0,  B4:493.88,
  C5:523.25, D5:587.33, E5:659.25, F5:698.46, G5:783.99,
  A5:880.0,  B5:987.77, C6:1046.5, D6:1174.66, E6:1318.51,
};

// Chord voicings: Am7 → Fmaj7 → Cmaj7 → Em7
// Chosen because i7–VI7–III7–VII7 feels both dark and melodic — perfect for space
const _CHORDS = [
  [_N.A3, _N.C4, _N.E4, _N.G4],  // Am7
  [_N.F3, _N.A3, _N.C4, _N.E4],  // Fmaj7
  [_N.C4, _N.E4, _N.G4, _N.B4],  // Cmaj7
  [_N.E3, _N.G3, _N.B3, _N.D4],  // Em7
];

// Bass line: root + 5th alternation (creates movement without complexity)
const _BASS_R = [_N.A2, _N.F2, _N.C3, _N.E2];  // roots
const _BASS_5 = [_N.E2, _N.C2, _N.G2, _N.B2];  // 5ths

// Lead melody — 4 bars × 8 notes (8th-note grid, null = rest)
// Design: bar1 sweeps up to A5 peak, bar2 rises back, bar3 floats high, bar4 resolves
const _MELODY = [
  [_N.E5, _N.G5, _N.A5, _N.G5, _N.E5, _N.D5, _N.C5, _N.A4],  // Am7
  [_N.C5, _N.D5, _N.E5, _N.C5, _N.A4, _N.C5, _N.F5, _N.E5],  // Fmaj7
  [_N.G5, _N.A5, _N.G5, _N.E5, _N.G5, _N.F5, _N.E5, _N.D5],  // Cmaj7
  [_N.B4, _N.C5, _N.D5, _N.E5, _N.D5, _N.C5, _N.B4, _N.A4],  // Em7
];

// Arpeggio — 16 16th notes per bar, ascending-then-descending through chord tones
const _ARP = [
  [_N.A4,_N.C5,_N.E5,_N.G5, _N.E5,_N.C5,_N.A4,_N.G4, _N.A4,_N.C5,_N.E5,_N.A5, _N.G5,_N.E5,_N.C5,_N.A4], // Am7
  [_N.F4,_N.A4,_N.C5,_N.E5, _N.C5,_N.A4,_N.F4,_N.E4, _N.F4,_N.A4,_N.C5,_N.F5, _N.E5,_N.C5,_N.A4,_N.F4], // Fmaj7
  [_N.C4,_N.E4,_N.G4,_N.B4, _N.G4,_N.E4,_N.C4,_N.B3, _N.C4,_N.E4,_N.G4,_N.C5, _N.B4,_N.G4,_N.E4,_N.C4], // Cmaj7
  [_N.E4,_N.G4,_N.B4,_N.D5, _N.B4,_N.G4,_N.E4,_N.D4, _N.E4,_N.G4,_N.B4,_N.E5, _N.D5,_N.B4,_N.G4,_N.E4], // Em7
];

const _CHORD_VARIANTS = [
  _CHORDS,
  [
    [_N.A3, _N.C4, _N.E4, _N.G4],
    [_N.F3, _N.A3, _N.C4, _N.E4],
    [_N.G3, _N.B3, _N.D4, _N.E4],
    [_N.E3, _N.G3, _N.B3, _N.D4],
  ],
  [
    [_N.A3, _N.C4, _N.E4, _N.G4],
    [_N.D3, _N.F3, _N.A3, _N.E4],
    [_N.F3, _N.A3, _N.C4, _N.E4],
    [_N.E3, _N.G3, _N.B3, _N.D4],
  ],
];

const _BASS_R_VARIANTS = [
  _BASS_R,
  [_N.A2, _N.F2, _N.G2, _N.E2],
  [_N.A2, _N.D2, _N.F2, _N.E2],
];
const _BASS_5_VARIANTS = [
  _BASS_5,
  [_N.E2, _N.C2, _N.D2, _N.B2],
  [_N.E2, _N.A1, _N.C2, _N.B2],
];

const _HOOK = [_N.A5, _N.C6, _N.E6, _N.C6];
const _MELODY_VARIANTS = [
  [
    [_N.E5, _N.G5, _HOOK[0], _HOOK[1], _HOOK[2], _HOOK[1], _N.G5, null],
    [_N.C5, _N.D5, _N.E5, _N.C5, _N.A4, _N.C5, _N.F5, _N.E5],
    [_N.G5, _N.A5, _N.G5, _N.E5, _N.G5, _N.F5, _N.E5, _N.D5],
    [_N.B4, _N.C5, _N.D5, _N.E5, _N.D5, _N.C5, _N.B4, _N.E5],
  ],
  [
    [_N.E5, _N.G5, _HOOK[0], _HOOK[1], _HOOK[2], _HOOK[1], _N.B5, null],
    [_N.C5, _N.D5, _N.E5, _N.G5, _N.A5, _N.G5, _N.F5, _N.E5],
    [_N.G5, _N.B5, _N.D6, _N.B5, _N.G5, _N.E5, _N.D5, null],
    [_N.B4, _N.C5, _N.E5, _N.G5, _N.E5, _N.D5, _N.B4, _N.G4],
  ],
  [
    [_N.E5, _N.G5, _HOOK[0], _HOOK[1], _HOOK[2], _HOOK[1], _N.G5, null],
    [_N.D5, _N.F5, _N.A5, _N.F5, _N.E5, _N.D5, _N.A4, null],
    [_N.F5, _N.A5, _N.C6, _N.A5, _N.F5, _N.E5, _N.C5, _N.A4],
    [_N.B4, _N.C5, _N.D5, _N.E5, _N.G5, _N.E5, _N.B4, _N.E5],
  ],
];

export class AudioManager {
  constructor() {
    this.ctx   = null;
    this.ready = false;
    this._pitch = 1.0;
    this._muted = false;
    // Ambient drone
    this._ambGain    = null;
    this._ambNodes   = [];
    this._ambPlaying = false;
    // Engine hum
    this._humGain    = null;
    this._humOsc     = null;
    this._humPlaying = false;
    // Music sequencer
    this._musicGain      = null;
    this._musicEcho      = null;  // echo/reverb send bus
    this._musicTimer     = null;
    this._musicPlaying   = false;
    this._musicStep      = 0;
    this._musicNextTime  = 0;
    this._musicIntensity = 0;     // 0..1 — unlocks layers progressively
    this._noiseBuffer    = null;
  }

  init() {
    if (this.ready) return;
    try {
      this.ctx   = new (window.AudioContext || window.webkitAudioContext)();
      this.ready = true;
    } catch (e) {}
  }

  _resume() { if (this.ctx?.state === 'suspended') this.ctx.resume(); }

  // Generic one-shot tone (used by SFX)
  _play(freq, type, dur, gain = 0.18, delay = 0) {
    if (!this.ctx || !this.ready || this._muted) return;
    this._resume();
    try {
      const t = this.ctx.currentTime + delay;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.connect(g); g.connect(this.ctx.destination);
      o.type = type;
      o.frequency.value = freq * this._pitch;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.start(t); o.stop(t + dur + 0.05);
    } catch (e) {}
  }

  setMute(muted) {
    this._muted = muted;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this._musicGain) this._musicGain.gain.setTargetAtTime(muted ? 0.001 : 0.70, t, 0.05);
    if (this._ambGain)   this._ambGain.gain.setTargetAtTime(muted ? 0.001 : 0.06,  t, 0.05);
    if (this._humGain && muted) this._humGain.gain.setTargetAtTime(0.001, t, 0.05);
  }

  getMuted() { return this._muted; }

  // ── AMBIENT SPACE DRONE ─────────────────────────────────────────────
  startAmbient() {
    if (!this.ctx || !this.ready || this._ambPlaying) return;
    this._resume();
    try {
      this._ambPlaying = true;
      this._ambGain = this.ctx.createGain();
      this._ambGain.gain.value = 0;
      this._ambGain.connect(this.ctx.destination);

      const bass = this.ctx.createOscillator();
      bass.type = 'sine'; bass.frequency.value = 55;
      const bassF = this.ctx.createBiquadFilter();
      bassF.type = 'lowpass'; bassF.frequency.value = 280; bassF.Q.value = 0.7;

      const harm = this.ctx.createOscillator();
      harm.type = 'sine'; harm.frequency.value = 82.5;
      const harmG = this.ctx.createGain(); harmG.gain.value = 0.28;

      const harm3 = this.ctx.createOscillator();
      harm3.type = 'sine'; harm3.frequency.value = 110;
      const harm3G = this.ctx.createGain(); harm3G.gain.value = 0.10;

      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.09;
      const lfoG = this.ctx.createGain(); lfoG.gain.value = 0.011;
      lfo.connect(lfoG); lfoG.connect(this._ambGain.gain);

      bass.connect(bassF); bassF.connect(this._ambGain);
      harm.connect(harmG); harmG.connect(this._ambGain);
      harm3.connect(harm3G); harm3G.connect(this._ambGain);

      bass.start(); harm.start(); harm3.start(); lfo.start();
      this._ambNodes = [bass, harm, harm3, lfo];
      this._ambGain.gain.linearRampToValueAtTime(0.06, this.ctx.currentTime + 2.5);
    } catch (e) {}
  }

  stopAmbient() {
    if (!this._ambGain || !this._ambPlaying) return;
    this._ambPlaying = false;
    try {
      const t = this.ctx.currentTime;
      this._ambGain.gain.setValueAtTime(this._ambGain.gain.value, t);
      this._ambGain.gain.linearRampToValueAtTime(0, t + 1.8);
      const nodes = this._ambNodes; this._ambNodes = [];
      setTimeout(() => { nodes.forEach(n => { try { n.stop(); } catch(e) {} }); }, 2000);
    } catch (e) {}
  }

  // ── ENGINE HUM ──────────────────────────────────────────────────────
  startEngineHum() {
    if (!this.ctx || !this.ready) return;
    if (this._humPlaying) {
      this._humPlaying = false;
      try { this._humOsc?.stop(); } catch(e) {}
      this._humGain = null; this._humOsc = null;
    }
    this._resume();
    try {
      this._humPlaying = true;
      this._humGain = this.ctx.createGain();
      this._humGain.gain.value = 0;
      this._humGain.connect(this.ctx.destination);
      this._humOsc = this.ctx.createOscillator();
      this._humOsc.type = 'sawtooth'; this._humOsc.frequency.value = 130;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass'; filter.frequency.value = 220; filter.Q.value = 1.8;
      this._humOsc.connect(filter); filter.connect(this._humGain);
      this._humOsc.start();
    } catch (e) {}
  }

  setEngineHum(thrustGlow) {
    if (!this._humGain || !this._humPlaying || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      this._humGain.gain.setTargetAtTime(Math.max(0, thrustGlow) * 0.08, t, 0.04);
      this._humOsc.frequency.setTargetAtTime((130 + thrustGlow * 95) * this._pitch, t, 0.04);
    } catch (e) {}
  }

  stopEngineHum() {
    if (!this._humGain || !this._humPlaying || !this.ctx) return;
    this._humPlaying = false;
    try {
      this._humGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
      const osc = this._humOsc; this._humGain = null; this._humOsc = null;
      setTimeout(() => { try { osc?.stop(); } catch(e) {} }, 500);
    } catch (e) {}
  }

  // ── MUSIC ENGINE ────────────────────────────────────────────────────
  // 5 progressive layers unlock as score (intensity) rises:
  //   0.00+ → kick + snare + hi-hat
  //   0.10+ → bass synth
  //   0.28+ → arpeggio (16th-note chord patterns)
  //   0.50+ → lead melody (the hook)
  //   0.72+ → pad chords (full lush atmosphere)

  _createNoiseBuffer() {
    // 2-second white noise buffer for all percussion
    const frames = Math.ceil(this.ctx.sampleRate * 2);
    const buf    = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  // Kick drum: sub-bass pitch sweep (160 → 42 Hz) with fast transient
  _kick(t, vol = 1.0) {
    if (!this.ctx || !this._musicGain) return;
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.connect(g); g.connect(this._musicGain);
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.10);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.62 * vol, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      o.start(t); o.stop(t + 0.25);
    } catch(e) {}
  }

  // Snare: bandpass noise burst + tonal click
  _snare(t) {
    if (!this.ctx || !this._musicGain || !this._noiseBuffer) return;
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = this._noiseBuffer;
      const bp  = this.ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 0.9;
      const g   = this.ctx.createGain();
      src.connect(bp); bp.connect(g); g.connect(this._musicGain);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.26, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      src.start(t); src.stop(t + 0.16);
      // Tonal snap — gives the snare its crack
      const snap = this.ctx.createOscillator();
      const sg   = this.ctx.createGain();
      snap.connect(sg); sg.connect(this._musicGain);
      snap.frequency.setValueAtTime(240, t);
      snap.frequency.exponentialRampToValueAtTime(90, t + 0.055);
      sg.gain.setValueAtTime(0.001, t);
      sg.gain.linearRampToValueAtTime(0.14, t + 0.003);
      sg.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      snap.start(t); snap.stop(t + 0.09);
    } catch(e) {}
  }

  // Hi-hat: highpass filtered noise, closed or open
  _hat(t, open = false) {
    if (!this.ctx || !this._musicGain || !this._noiseBuffer) return;
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = this._noiseBuffer;
      const hp  = this.ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 7500;
      const g   = this.ctx.createGain();
      src.connect(hp); hp.connect(g); g.connect(this._musicGain);
      const peak  = open ? 0.09 : 0.055;
      const decay = open ? 0.200 : 0.038;
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.001, t + decay);
      src.start(t); src.stop(t + decay + 0.01);
    } catch(e) {}
  }

  // Arpeggio: triangle wave — clear, bright, sits above bass
  _arp(t, freq, dur) {
    if (!this.ctx || !this._musicGain) return;
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle'; o.frequency.value = freq;
      o.connect(g); g.connect(this._musicGain);
      if (this._musicEcho) g.connect(this._musicEcho);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.040, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.001, t + Math.min(dur, 0.085));
      o.start(t); o.stop(t + Math.min(dur, 0.095));
    } catch(e) {}
  }

  // Bass synth: saw+tri mix through lowpass — warm and punchy
  _bass(t, freq, dur) {
    if (!this.ctx || !this._musicGain) return;
    try {
      const saw = this.ctx.createOscillator();
      const tri = this.ctx.createOscillator();
      const sawG = this.ctx.createGain();
      const triG = this.ctx.createGain();
      const filt = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      saw.type = 'sawtooth'; saw.frequency.value = freq;
      tri.type = 'triangle'; tri.frequency.value = freq;
      sawG.gain.value = 0.80; triG.gain.value = 0.20;
      filt.type = 'lowpass'; filt.frequency.value = 470; filt.Q.value = 1.4;
      saw.connect(sawG); tri.connect(triG);
      sawG.connect(filt); triG.connect(filt);
      filt.connect(g); g.connect(this._musicGain);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.30, t + 0.015);
      g.gain.setValueAtTime(0.22, t + dur - 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      saw.start(t); tri.start(t);
      saw.stop(t + dur + 0.01); tri.stop(t + dur + 0.01);
    } catch(e) {}
  }

  _lead(t, freq, dur) {
    if (!this.ctx || !this._musicGain) return;
    try {
      const o1 = this.ctx.createOscillator();
      const o2 = this.ctx.createOscillator();
      const lfo = this.ctx.createOscillator();
      const lfoG = this.ctx.createGain();
      const filt = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      o1.type = 'square'; o1.frequency.value = freq;
      o2.type = 'triangle'; o2.frequency.value = freq * 1.0029;
      lfo.frequency.value = 7.2;
      lfoG.gain.value = Math.min(freq * 0.012, 9);
      lfo.connect(lfoG); lfoG.connect(o1.frequency); lfoG.connect(o2.frequency);
      filt.type = 'lowpass'; filt.frequency.value = 2800; filt.Q.value = 2.1;
      o1.connect(filt); o2.connect(filt); filt.connect(g); g.connect(this._musicGain);
      if (this._musicEcho) filt.connect(this._musicEcho);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.072, t + 0.022);
      g.gain.setValueAtTime(0.052, t + dur - 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o1.start(t); o2.start(t); lfo.start(t);
      o1.stop(t + dur + 0.01); o2.stop(t + dur + 0.01); lfo.stop(t + dur + 0.01);
    } catch(e) {}
  }

  _pad(t, freq, dur) {
    if (!this.ctx || !this._musicGain) return;
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      o.connect(g); g.connect(this._musicGain);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.016, t + 0.50);
      g.gain.setValueAtTime(0.012, t + dur - 0.25);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.start(t); o.stop(t + dur + 0.01);

      if (this._noiseBuffer) {
        const n = this.ctx.createBufferSource();
        const f = this.ctx.createBiquadFilter();
        const ng = this.ctx.createGain();
        n.buffer = this._noiseBuffer;
        f.type = 'bandpass'; f.frequency.value = freq * 5.5; f.Q.value = 3.5;
        n.connect(f); f.connect(ng); ng.connect(this._musicGain);
        ng.gain.setValueAtTime(0.001, t);
        ng.gain.linearRampToValueAtTime(0.006, t + 0.65);
        ng.gain.exponentialRampToValueAtTime(0.001, t + dur);
        n.start(t); n.stop(t + dur + 0.01);
      }
    } catch(e) {}
  }

  _arpFromChord(t, chord, pos, phrase, dur) {
    const patterns = [
      [0,1,2,3,2,1,0,3, 0,1,2,0,3,2,1,0],
      [0,null,2,1,null,3,2,null, 0,null,3,1,null,2,3,null],
      [0,2,1,3,0,2,3,1, 0,2,1,3,0,2,3,1],
    ];
    const degree = patterns[phrase][pos];
    if (degree === null) return;
    const octave = phrase === 2 && (pos === 7 || pos === 15) ? 4 : 2;
    this._arp(t, chord[degree] * octave, dur);
  }

  _riser(t, dur = _BAR * 0.55) {
    if (!this.ctx || !this._musicGain || !this._noiseBuffer) return;
    try {
      const src = this.ctx.createBufferSource();
      const hp = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      src.buffer = this._noiseBuffer;
      src.playbackRate.value = 0.65;
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(550, t);
      hp.frequency.exponentialRampToValueAtTime(5200, t + dur);
      src.connect(hp); hp.connect(g); g.connect(this._musicGain);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.035, t + dur * 0.72);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.start(t); src.stop(t + dur + 0.02);
    } catch(e) {}
  }

  startMusic() {
    if (!this.ctx || !this.ready) return;
    // Clean up any previous session
    if (this._musicTimer) { clearInterval(this._musicTimer); this._musicTimer = null; }
    if (this._musicPlaying) this.stopMusic();
    this._resume();
    try {
      this._musicPlaying  = true;
      this._musicStep     = 0;
      this._musicNextTime = this.ctx.currentTime + 0.08;
      this._noiseBuffer   = this._createNoiseBuffer();

      // Master music bus
      this._musicGain = this.ctx.createGain();
      this._musicGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this._musicGain.gain.linearRampToValueAtTime(0.70, this.ctx.currentTime + 1.8);
      this._musicGain.connect(this.ctx.destination);

      // Rhythmic echo bus: 1-beat delay at 128BPM (0.46875s) with 20% feedback
      // Gives lead/arp a natural "space" without muddying percussion
      const echoDelay = this.ctx.createDelay(1.0);
      const echoFB    = this.ctx.createGain();
      const echoWet   = this.ctx.createGain();
      echoDelay.delayTime.value = _BEAT; // one beat delay = rhythmic echo
      echoFB.gain.value = 0.18;
      echoWet.gain.value = 0.16;
      echoDelay.connect(echoFB);
      echoFB.connect(echoDelay);
      echoDelay.connect(echoWet);
      echoWet.connect(this._musicGain);
      this._musicEcho = echoDelay;

      // Drum intro: 1 bar of drums only before full music locks in
      this._musicTimer = setInterval(() => this._scheduleMusic(), 80);
      this._scheduleMusic();
    } catch(e) {}
  }

  _scheduleMusic() {
    if (!this._musicPlaying || !this.ctx || !this._musicGain) return;
    const lookAhead = this.ctx.currentTime + 0.28;

    while (this._musicNextTime < lookAhead) {
      const step  = this._musicStep % 64;   // 64 steps = 4-bar loop
      const bar   = Math.floor(step / 16);  // chord index 0-3
      const pos   = step % 16;              // position in bar (16th notes)
      const t     = this._musicNextTime;
      const iv    = this._musicIntensity;   // 0..1
      const phrase = Math.floor(this._musicStep / 64) % _CHORD_VARIANTS.length;
      const globalBar = Math.floor(this._musicStep / 16);
      const chord = _CHORD_VARIANTS[phrase][bar];
      const bassR = _BASS_R_VARIANTS[phrase][bar];
      const bass5 = _BASS_5_VARIANTS[phrase][bar];
      const breathBar = globalBar % 4 === 1 || globalBar % 4 === 3;

      // ── LAYER 1: DRUMS (always active) ──────────────────────────────

      // Kick: beats 1 and 3 (positions 0 and 8)
      if (pos === 0 || pos === 8) this._kick(t);
      // Ghost kick on the "and" of 4 (pos 14) — drives into next bar
      if (pos === 14) this._kick(t, 0.30);

      // Snare: beats 2 and 4 (positions 4 and 12)
      if (pos === 4 || pos === 12) this._snare(t);

      // Hi-hat pattern: off-beat 8ths (2,6,10) + open on pos 10
      if (pos === 2 || pos === 6)                    this._hat(t, false);
      if (pos === 10)                                this._hat(t, true);   // open hat accent
      if (pos === 14)                                this._hat(t, false);
      // Dense 16th-note hats at higher intensity
      if (iv > 0.55 && !breathBar && (pos === 1 || pos === 3 || pos === 5 || pos === 7 ||
                        pos === 9 || pos === 11 || pos === 13 || pos === 15)) {
        this._hat(t, false); // fill all 16ths — drives energy at high score
      }

      // ── LAYER 2: BASS (unlocks at intensity 0.10 = score 20) ────────
      if (iv >= 0.10) {
        // Root on beat 1 (pos 0), 5th on beat 2 (pos 4), root on beat 3 (pos 8)
        // Adds a punchy walking feel
        if (pos === 0 || pos === 8)  this._bass(t, bassR, _STEP * 3.2);
        if (pos === 4)               this._bass(t, bass5, _STEP * 1.8);
        if (pos === 12)              this._bass(t, bassR, _STEP * 1.6);
      }

      // ── LAYER 3: ARPEGGIOS (unlocks at intensity 0.28 = score 56) ───
      if (iv >= 0.28) {
        const active = phrase === 0 || pos % 3 === 0 || (phrase === 2 && pos % 2 === 0);
        if (active) this._arpFromChord(t, chord, pos, phrase, _STEP * 0.72);
        if (pos >= 8 && pos <= 11 && bar === 0 && phrase !== 1) this._arp(t, _HOOK[pos - 8], _STEP * 0.58);
      }

      // ── LAYER 4: LEAD MELODY (unlocks at intensity 0.50 = score 100) ─
      if (iv >= 0.50 && pos % 2 === 0) {
        const melNote = _MELODY_VARIANTS[phrase][bar][pos >> 1]; // pos/2 = 8th-note index
        if (melNote) this._lead(t, melNote, _STEP * 1.75);
      }

      // ── LAYER 5: PAD CHORDS (unlocks at intensity 0.72 = score 144) ─
      // Plays the full 7th chord as sine pads, one chord per bar
      if (iv >= 0.72 && pos === 0) {
        chord.forEach((freq, i) => {
          this._pad(t + i * 0.018, freq * 2, _BAR);  // whole bar, octave up
        });
      }

      if (iv >= 0.35 && bar === 3 && pos === 8 && globalBar % 8 === 7) {
        this._riser(t);
      }

      this._musicNextTime += _STEP;
      this._musicStep++;
    }
  }

  stopMusic() {
    if (!this._musicPlaying) return;
    this._musicPlaying = false;
    if (this._musicTimer) { clearInterval(this._musicTimer); this._musicTimer = null; }
    this._musicEcho = null;
    try {
      const gain = this._musicGain;
      if (!gain) return;
      const t = this.ctx.currentTime;
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0, t + 1.2);
      setTimeout(() => { try { gain.disconnect(); } catch(e) {} }, 1400);
    } catch(e) {}
    this._musicGain = null;
  }

  // ── SFX ─────────────────────────────────────────────────────────────

  thrust() { this._play(140, 'sawtooth', 0.08, 0.10); }

  nearMiss(type) {
    this._play(90, 'sine', 0.14, 0.22);
    if (type === 'INSANE!!') {
      this._play(523, 'sine',     0.13, 0.28);
      this._play(659, 'sine',     0.12, 0.24, 0.08);
      this._play(784, 'sine',     0.14, 0.20, 0.16);
    } else if (type === 'PERFECT!') {
      this._play(523, 'triangle', 0.10, 0.22);
      this._play(659, 'triangle', 0.09, 0.17, 0.08);
    } else {
      this._play(440, 'triangle', 0.08, 0.15);
    }
  }

  meteorWarn() {
    this._play(160, 'sine', 0.12, 0.16);
    this._play(200, 'sine', 0.08, 0.12, 0.08);
  }

  death() {
    this._play(55,  'sawtooth', 0.30, 0.40);
    this._play(40,  'sawtooth', 0.35, 0.32, 0.08);
    this._play(80,  'sine',     0.20, 0.18, 0.16);
  }

  scoreTick() { this._play(480, 'triangle', 0.07, 0.12); }

  sectorUp(sector) {
    const base = Math.min(180 * Math.pow(1.08, sector - 1), 450);
    this._play(base,        'sine', 0.22, 0.20);
    this._play(base * 1.26, 'sine', 0.18, 0.18, 0.10);
    this._play(base * 1.50, 'sine', 0.22, 0.18, 0.22);
    this._play(base * 2.00, 'sine', 0.20, 0.26, 0.36);
  }

  milestone() {
    this._play(523,  'sine',     0.15, 0.20);
    this._play(659,  'sine',     0.13, 0.20, 0.08);
    this._play(784,  'triangle', 0.14, 0.22, 0.18);
    this._play(1047, 'sine',     0.18, 0.28, 0.30);
  }

  goldDodge() {
    this._play(880,  'sine', 0.16, 0.22);
    this._play(1108, 'sine', 0.14, 0.18, 0.06);
    this._play(1320, 'sine', 0.18, 0.20, 0.14);
    this._play(1760, 'sine', 0.14, 0.18, 0.24);
  }

  onFireActivate() {
    // Rising power chord — signals the ×2 moment viscerally
    this._play(220, 'sawtooth', 0.28, 0.38);
    this._play(330, 'sine',     0.22, 0.32, 0.06);
    this._play(440, 'sine',     0.26, 0.30, 0.14);
    this._play(660, 'sine',     0.30, 0.35, 0.24);
    this._play(880, 'sine',     0.24, 0.28, 0.36);
  }

  // Dynamic pitch and music intensity — both tied to score / 200 now
  setSpeedPitch(score) {
    this._pitch          = 1.0 + Math.min(score / 200, 1.0) * 0.10; // subtle pitch drift
    this._musicIntensity = Math.min(score / 200, 1.0);
  }
}
