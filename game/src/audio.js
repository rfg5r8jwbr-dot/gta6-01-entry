// Solmar Heat — procedural sound, all WebAudio, no audio files.
// Engine hum, two-tone siren, gunshot noise, pickup blips, mission jingles
// and a simple bass music loop. Everything starts only after the first user
// gesture, and every call is guarded so a missing AudioContext never crashes.

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  // Create the context on first gesture. Safe to call repeatedly.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.startEngine();
      this.startSiren();
      this.startMusic();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  // Low engine drone whose pitch follows the car's speed (0..1).
  startEngine() {
    try {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    } catch {
      this.engineOsc = null;
    }
  }

  setEngine(level) {
    if (!this.engineOsc || !this.engineGain) return;
    try {
      this.engineOsc.frequency.setTargetAtTime(55 + level * 110, this.ctx.currentTime, 0.08);
      this.engineGain.gain.setTargetAtTime(level * 0.10, this.ctx.currentTime, 0.08);
    } catch {
      // Ignore audio errors.
    }
  }

  // Two-tone police siren, wailing while the player is wanted.
  startSiren() {
    try {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 1.4;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 220;
      lfo.connect(lfoGain);
      lfoGain.connect(this.sirenOsc.frequency);
      lfo.start();
    } catch {
      this.sirenOsc = null;
    }
  }

  setWanted(wanted) {
    if (!this.sirenGain) return;
    try {
      this.sirenGain.gain.setTargetAtTime(wanted ? 0.045 : 0, this.ctx.currentTime, 0.2);
    } catch {
      // Ignore audio errors.
    }
  }

  sirenBurst() {
    this.ensure();
    if (!this.ctx) return;
    this.setWanted(true);
  }

  // Short noise burst for a gunshot.
  gunshot(volume) {
    if (!this.ctx) return;
    try {
      const dur = 0.12;
      const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.5 * (volume ?? 1);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 2400;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start();
    } catch {
      // Ignore audio errors.
    }
  }

  // Dull thud for a crash.
  thud(volume) {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(90, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(38, this.ctx.currentTime + 0.14);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.4 * (volume ?? 1), this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.16);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.18);
    } catch {
      // Ignore audio errors.
    }
  }

  // Single UI blip.
  blip(freq) {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = freq || 660;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.13);
    } catch {
      // Ignore audio errors.
    }
  }

  // Little note sequences for mission events.
  jingle(kind) {
    if (!this.ctx) return;
    const tunes = {
      mission: [523, 659, 784],
      complete: [523, 659, 784, 1046],
      fare: [659, 784, 988],
      busted: [392, 330, 262],
      wasted: [330, 262, 196],
    };
    const notes = tunes[kind] || tunes.mission;
    try {
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const gain = this.ctx.createGain();
        const t = this.ctx.currentTime + i * 0.14;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(t);
        osc.stop(t + 0.25);
      });
    } catch {
      // Ignore audio errors.
    }
  }

  // A slow bass loop: Solmar's sunset groove, one note per beat.
  startMusic() {
    try {
      const bassline = [55, 0, 65.41, 0, 49, 0, 58.27, 0, 55, 0, 65.41, 0, 82.41, 73.42, 65.41, 49];
      this.musicTimer = window.setInterval(() => {
        if (!this.ctx || this.muted) return;
        const freq = bassline[this.musicStep % bassline.length];
        this.musicStep += 1;
        if (!freq) return;
        try {
          const osc = this.ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.value = freq;
          const gain = this.ctx.createGain();
          const t = this.ctx.currentTime;
          gain.gain.setValueAtTime(0.09, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
          osc.connect(gain);
          gain.connect(this.master);
          osc.start(t);
          osc.stop(t + 0.45);
        } catch {
          // Ignore audio errors.
        }
      }, 430);
    } catch {
      this.musicTimer = null;
    }
  }
}
