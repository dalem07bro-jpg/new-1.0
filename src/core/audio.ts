// Procedural audio: all sound effects and the adaptive soundtrack are synthesized with WebAudio.
// No samples → tiny build, and every claim plays a chord that grows with the size of the loop.

const PENTA = [0, 2, 4, 7, 9]; // major pentatonic degrees
const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export interface MusicTheme {
  root: number; // midi note
  bpm: number;
  progression: number[][]; // chords as semitone offsets from root
  arp: 'up' | 'updown' | 'random';
  pad: OscillatorType;
  lead: OscillatorType;
}

export const THEMES: Record<string, MusicTheme> = {
  menu: { root: 57, bpm: 84, progression: [[0, 4, 7, 11], [5, 9, 12, 16], [2, 5, 9, 12], [7, 11, 14, 17]], arp: 'updown', pad: 'sine', lead: 'triangle' },
  meadows: { root: 60, bpm: 108, progression: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], arp: 'up', pad: 'triangle', lead: 'square' },
  marsh: { root: 55, bpm: 96, progression: [[0, 3, 7, 10], [5, 8, 12], [3, 7, 10], [7, 10, 14]], arp: 'updown', pad: 'sine', lead: 'triangle' },
  ruins: { root: 57, bpm: 112, progression: [[0, 3, 7], [8, 12, 15], [3, 7, 10], [10, 14, 17]], arp: 'random', pad: 'triangle', lead: 'square' },
  ember: { root: 52, bpm: 126, progression: [[0, 3, 7], [0, 3, 8], [5, 8, 12], [7, 11, 14]], arp: 'up', pad: 'sawtooth', lead: 'square' },
  hollow: { root: 50, bpm: 100, progression: [[0, 3, 7, 10], [1, 5, 8], [0, 3, 6], [10, 13, 17]], arp: 'random', pad: 'sawtooth', lead: 'triangle' },
  boss: { root: 48, bpm: 138, progression: [[0, 3, 7], [1, 4, 8], [0, 3, 7], [6, 10, 13]], arp: 'up', pad: 'sawtooth', lead: 'square' },
};

class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private vol = { master: 0.8, music: 0.55, sfx: 0.8 };
  private lastPlay: Record<string, number> = {};
  private fuseNode: { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode } | null = null;

  // music state
  private theme: MusicTheme | null = null;
  private nextNoteTime = 0;
  private step = 0;
  private schedTimer: number | null = null;
  intensity = 0; // 0..1 → adds layers
  private musicFilter!: BiquadFilterNode;

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const ctx = this.ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.musicBus = ctx.createGain();
    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 5200;
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.musicFilter);
    this.musicFilter.connect(this.master);
    this.master.connect(comp);
    comp.connect(ctx.destination);
    const len = ctx.sampleRate * 1.5;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
  }

  setVolumes(master: number, music: number, sfx: number) {
    this.vol = { master, music, sfx };
    this.applyVolumes();
  }
  private applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.vol.master;
    this.musicBus.gain.value = this.vol.music * 0.5;
    this.sfxBus.gain.value = this.vol.sfx * 0.7;
  }
  /** Muffle music (pause menu / level-up). */
  muffle(on: boolean) {
    if (!this.ctx) return;
    this.musicFilter.frequency.setTargetAtTime(on ? 700 : 5200, this.ctx.currentTime, 0.08);
  }

  private throttle(key: string, minGap: number) {
    const now = performance.now();
    if ((this.lastPlay[key] ?? 0) + minGap * 1000 > now) return false;
    this.lastPlay[key] = now;
    return true;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0, slideTo?: number, attack = 0.005, bus?: AudioNode) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(bus ?? this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol: number, filterType: BiquadFilterType, freq: number, when = 0, freqTo?: number, q = 1, bus?: AudioNode) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.setValueAtTime(freq, t);
    f.Q.value = q;
    if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(bus ?? this.sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  // ------------------------------------------------------------------ SFX
  swipe() {
    if (!this.ctx || !this.throttle('swipe', 0.05)) return;
    this.noise(0.14, 0.18, 'bandpass', 1800, 0, 600, 2);
  }
  hit() {
    if (!this.ctx || !this.throttle('hit', 0.035)) return;
    this.tone(180 + Math.random() * 60, 0.05, 'square', 0.05);
  }
  kill() {
    if (!this.ctx || !this.throttle('kill', 0.03)) return;
    this.noise(0.08, 0.12, 'highpass', 2500);
    this.tone(500 + Math.random() * 300, 0.06, 'triangle', 0.06);
  }
  shoot() {
    if (!this.ctx || !this.throttle('shoot', 0.06)) return;
    this.tone(900, 0.07, 'triangle', 0.05, 0, 1400);
  }
  boom() {
    if (!this.ctx || !this.throttle('boom', 0.08)) return;
    this.noise(0.35, 0.3, 'lowpass', 900, 0, 120);
    this.tone(90, 0.3, 'sine', 0.25, 0, 40);
  }
  private pickupStreak = 0;
  private pickupT = 0;
  pickup() {
    if (!this.ctx || !this.throttle('pickup', 0.025)) return;
    const now = performance.now();
    this.pickupStreak = now - this.pickupT < 400 ? Math.min(this.pickupStreak + 1, 14) : 0;
    this.pickupT = now;
    const deg = PENTA[this.pickupStreak % 5] + 12 * Math.floor(this.pickupStreak / 5);
    this.tone(midiToHz(79 + deg), 0.08, 'sine', 0.07);
  }
  pigment() {
    if (!this.ctx || !this.throttle('pig', 0.05)) return;
    this.tone(midiToHz(84), 0.1, 'triangle', 0.06);
    this.tone(midiToHz(91), 0.12, 'sine', 0.05, 0.04);
  }
  private captureCombo = 0;
  private captureT = 0;
  capture() {
    if (!this.ctx || !this.throttle('cap', 0.022)) return;
    const now = performance.now();
    this.captureCombo = now - this.captureT < 600 ? this.captureCombo + 1 : 0;
    this.captureT = now;
    const n = this.captureCombo;
    const deg = PENTA[n % 5] + 12 * Math.min(2, Math.floor(n / 5));
    this.tone(midiToHz(72 + deg), 0.12, 'triangle', 0.09);
    this.tone(midiToHz(72 + deg + 12), 0.06, 'sine', 0.04, 0.01);
  }
  /** Loop closed: chord arpeggio, more notes for bigger claims. */
  claim(cells: number, root = 60) {
    if (!this.ctx) return;
    const notes = Math.min(9, 2 + Math.floor(Math.log2(1 + cells / 25)));
    const chord = [0, 4, 7, 12, 16, 19, 24, 28, 31];
    for (let i = 0; i < notes; i++) {
      this.tone(midiToHz(root + chord[i]), 0.35 + i * 0.03, 'triangle', 0.08, i * 0.045);
      if (i % 2 === 0) this.tone(midiToHz(root + chord[i] + 12), 0.2, 'sine', 0.035, i * 0.045 + 0.01);
    }
    this.noise(0.4, 0.06 + Math.min(0.12, cells / 8000), 'highpass', 3000, 0, 8000);
    if (cells > 600) this.tone(midiToHz(root - 12), 0.8, 'sine', 0.18, 0, midiToHz(root - 12));
  }
  fuseStart() {
    if (!this.ctx || this.fuseNode) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2000;
    filter.Q.value = 3;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.05);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus);
    src.start();
    this.fuseNode = { src, filter, gain };
    this.tone(1200, 0.15, 'square', 0.06, 0, 2400);
  }
  fuseUpdate(danger: number) {
    if (!this.ctx || !this.fuseNode) return;
    this.fuseNode.filter.frequency.setTargetAtTime(1500 + danger * 4500, this.ctx.currentTime, 0.05);
  }
  fuseStop() {
    if (!this.ctx || !this.fuseNode) return;
    const n = this.fuseNode;
    this.fuseNode = null;
    n.gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.03);
    n.src.stop(this.ctx.currentTime + 0.2);
  }
  snap() {
    if (!this.ctx) return;
    this.tone(600, 0.45, 'sawtooth', 0.14, 0, 70);
    this.noise(0.5, 0.25, 'lowpass', 3000, 0, 200);
  }
  hurt() {
    if (!this.ctx || !this.throttle('hurt', 0.12)) return;
    this.tone(140, 0.18, 'square', 0.12, 0, 70);
  }
  dash() {
    if (!this.ctx) return;
    this.noise(0.18, 0.16, 'bandpass', 800, 0, 3000, 1.5);
  }
  special() {
    if (!this.ctx) return;
    [0, 7, 12, 19].forEach((d, i) => this.tone(midiToHz(67 + d), 0.3, 'square', 0.05, i * 0.03));
  }
  levelUp() {
    if (!this.ctx) return;
    [0, 4, 7, 12, 16, 19, 24].forEach((d, i) => this.tone(midiToHz(72 + d), 0.4, 'triangle', 0.08, i * 0.05));
  }
  select() {
    if (!this.ctx) return;
    this.tone(midiToHz(84), 0.08, 'triangle', 0.08);
    this.tone(midiToHz(91), 0.14, 'triangle', 0.07, 0.05);
  }
  uiMove() {
    if (!this.ctx || !this.throttle('ui', 0.03)) return;
    this.tone(midiToHz(79), 0.04, 'sine', 0.05);
  }
  uiBack() {
    if (!this.ctx) return;
    this.tone(midiToHz(72), 0.08, 'sine', 0.06, 0, midiToHz(67));
  }
  deny() {
    if (!this.ctx) return;
    this.tone(160, 0.12, 'square', 0.06);
  }
  bossRoar() {
    if (!this.ctx) return;
    this.tone(55, 1.4, 'sawtooth', 0.22, 0, 35, 0.2);
    this.tone(58, 1.4, 'sawtooth', 0.18, 0, 38, 0.2);
    this.noise(1.2, 0.2, 'lowpass', 400, 0, 80);
  }
  victory() {
    if (!this.ctx) return;
    const seq = [0, 4, 7, 12, 7, 12, 16, 19, 24];
    seq.forEach((d, i) => this.tone(midiToHz(64 + d), 0.5, 'triangle', 0.09, i * 0.09));
  }
  defeat() {
    if (!this.ctx) return;
    [12, 7, 3, 0].forEach((d, i) => this.tone(midiToHz(55 + d), 0.6, 'triangle', 0.09, i * 0.18));
  }
  eruption() {
    if (!this.ctx || !this.throttle('erupt', 0.3)) return;
    this.noise(0.6, 0.12, 'lowpass', 600, 0, 150);
  }
  shrine() {
    if (!this.ctx) return;
    [0, 7, 14, 21].forEach((d, i) => this.tone(midiToHz(76 + d), 0.6, 'sine', 0.07, i * 0.07));
  }

  // ------------------------------------------------------------------ Music
  playMusic(themeKey: string) {
    if (!this.ctx) return;
    const theme = THEMES[themeKey] ?? THEMES.menu;
    if (this.theme === theme) return;
    this.theme = theme;
    this.step = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    if (this.schedTimer === null) this.schedTimer = window.setInterval(() => this.schedule(), 25);
  }
  stopMusic() {
    this.theme = null;
    if (this.schedTimer !== null) {
      clearInterval(this.schedTimer);
      this.schedTimer = null;
    }
  }

  private schedule() {
    if (!this.ctx || !this.theme) return;
    const th = this.theme;
    const sixteenth = 60 / th.bpm / 4;
    while (this.nextNoteTime < this.ctx.currentTime + 0.12) {
      this.playStep(th, this.step, this.nextNoteTime - this.ctx.currentTime, sixteenth);
      this.nextNoteTime += sixteenth;
      this.step++;
    }
  }

  private playStep(th: MusicTheme, step: number, when: number, s16: number) {
    const bar = Math.floor(step / 16) % th.progression.length;
    const chord = th.progression[bar];
    const inBar = step % 16;
    const mb = this.musicBus;
    const inten = this.intensity;
    // pad on bar start
    if (inBar === 0) {
      for (const n of chord) this.tone(midiToHz(th.root + n), s16 * 16 * 0.98, th.pad, 0.03, when, undefined, 0.3, mb);
      // bass
      this.tone(midiToHz(th.root - 24 + chord[0]), s16 * 7, 'triangle', 0.13, when, undefined, 0.01, mb);
    }
    if (inBar === 8) this.tone(midiToHz(th.root - 24 + chord[0]), s16 * 7, 'triangle', 0.1, when, undefined, 0.01, mb);
    if (inten > 0.25 && (inBar === 6 || inBar === 14)) this.tone(midiToHz(th.root - 24 + chord[chord.length > 2 ? 2 : 1]), s16 * 2, 'triangle', 0.08, when, undefined, 0.01, mb);
    // arpeggio every 8th (every 16th at high intensity)
    const arpEvery = inten > 0.6 ? 1 : 2;
    if (inBar % arpEvery === 0) {
      const idx = inBar / arpEvery;
      const notes = [...chord, chord[0] + 12, chord[1] + 12];
      let n: number;
      if (th.arp === 'up') n = notes[idx % notes.length];
      else if (th.arp === 'updown') {
        const seq = [...notes, ...notes.slice(1, -1).reverse()];
        n = seq[idx % seq.length];
      } else n = notes[(idx * 7 + bar * 3) % notes.length];
      this.tone(midiToHz(th.root + 12 + n), s16 * 1.6, th.lead, 0.022 + inten * 0.012, when, undefined, 0.004, mb);
    }
    // percussion
    if (inten > 0.05) {
      if (inBar % 4 === 2) this.noise(0.03, 0.05, 'highpass', 7000, when, undefined, 1, mb);
      if (inBar === 0 || inBar === 8 || (inten > 0.5 && inBar === 10)) {
        this.tone(120, 0.12, 'sine', 0.22, when, 45, 0.002, mb);
      }
      if (inten > 0.35 && (inBar === 4 || inBar === 12)) this.noise(0.1, 0.08, 'bandpass', 1800, when, undefined, 0.8, mb);
    }
  }
}

export const audio = new AudioEngine();
