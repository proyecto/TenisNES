/**
 * @file tennisAudio.ts
 * @description Native Web Audio API procedural sound engine & synthesized umpire commentary for TenisNES.
 *
 * ## Features:
 * - Procedural racket hit synthesis (resonant string bed ping + transient snap + velocity-scaled volume).
 * - Grass surface ball bounce acoustic modeling (damped low-frequency turf impact).
 * - Net tape collision rattle (high-tension cord metallic vibrations).
 * - Procedural Centre Court crowd applause & ovation generator (filtered noise grains).
 * - Wimbledon broadcast electronic umpire chimes & Web Speech API vocal calls.
 * - Zero external assets or network requests required; works offline and lag-free.
 */

export type ShotSoundType = 'serve' | 'smash' | 'flat' | 'topspin' | 'slice' | 'lob' | 'drive' | 'backhand';
export type CheerIntensity = 'applause' | 'roar' | 'polite';
export type UmpireToneType = 'fault' | 'double_fault' | 'out' | 'net' | 'ace' | 'game' | 'deuce' | 'let';

class TennisAudioEngine {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted: boolean = false;
  private volume: number = 0.8;
  private initialized: boolean = false;

  constructor() {
    // AudioContext will be initialized or resumed on the first user interaction
    if (typeof window !== 'undefined') {
      const unlockAudio = () => {
        this.ensureContext();
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
      };
      window.addEventListener('click', unlockAudio, { passive: true });
      window.addEventListener('keydown', unlockAudio, { passive: true });
    }
  }

  /**
   * Initializes or resumes the AudioContext safely.
   */
  public ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) return null;

        this.audioCtx = new AudioContextClass();
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.audioCtx.currentTime);
        this.masterGain.connect(this.audioCtx.destination);
        this.initialized = true;
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }

      return this.audioCtx;
    } catch {
      return null;
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : this.volume, this.audioCtx.currentTime);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.masterGain && this.audioCtx && !this.muted) {
      this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
    }
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public getVolume(): number {
    return this.volume;
  }

  /**
   * Plays a procedurally synthesized tennis racket strike sound.
   * Modulates resonance, transient crack, and pitch based on stroke type and ball speed.
   */
  public playRacketHit(shotType: ShotSoundType = 'flat', speedKmh: number = 130): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const t = ctx.currentTime;
    const speedRatio = Math.min(1.5, Math.max(0.7, speedKmh / 140));

    // 1. String-bed harmonic membrane resonance (Oscillator)
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();

    let startFreq = 220;
    let endFreq = 110;
    let duration = 0.08;

    if (shotType === 'smash' || shotType === 'serve') {
      startFreq = 290 * speedRatio;
      endFreq = 95;
      duration = 0.11;
    } else if (shotType === 'slice') {
      startFreq = 340;
      endFreq = 180;
      duration = 0.06;
    } else if (shotType === 'lob') {
      startFreq = 380;
      endFreq = 210;
      duration = 0.09;
    }

    osc.type = shotType === 'smash' ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration);

    oscGain.gain.setValueAtTime(0.7 * speedRatio, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + duration);

    // 2. Crisp string friction transient (Filtered White Noise Burst)
    const noiseLength = shotType === 'slice' ? 0.05 : 0.025;
    const bufferSize = Math.floor(ctx.sampleRate * noiseLength);
    if (bufferSize > 0) {
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = shotType === 'slice' ? 'highpass' : 'bandpass';
      filter.frequency.setValueAtTime(shotType === 'slice' ? 2400 : 3200, t);
      filter.Q.setValueAtTime(2.5, t);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.55 * speedRatio, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + noiseLength);

      noiseSource.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.masterGain);

      noiseSource.start(t);
      noiseSource.stop(t + noiseLength);
    }
  }

  /**
   * Plays a grass court bounce sound: soft, damped low-frequency turf impact.
   */
  public playBallBounce(surface: 'grass' | 'stand' = 'grass'): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (surface === 'stand') {
      // Wood / plastic stands impact
      osc.type = 'square';
      osc.frequency.setValueAtTime(280, t);
      osc.frequency.exponentialRampToValueAtTime(90, t + 0.07);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    } else {
      // Soft grass court bounce
      osc.type = 'sine';
      osc.frequency.setValueAtTime(115, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.05);
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    }

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.08);
  }

  /**
   * Plays a net tape collision sound: taut nylon cord vibration & rattle.
   */
  public playNetHit(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const t = ctx.currentTime;
    const duration = 0.12;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(460, t);
    osc1.frequency.exponentialRampToValueAtTime(160, t + duration);

    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(820, t);
    osc2.frequency.exponentialRampToValueAtTime(240, t + duration);

    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + duration);
    osc2.stop(t + duration);
  }

  /**
   * Plays procedural Centre Court crowd applause & cheer ovation.
   */
  public playCrowdCheer(intensity: CheerIntensity = 'applause'): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const t = ctx.currentTime;
    const duration = intensity === 'roar' ? 2.5 : intensity === 'applause' ? 1.6 : 1.0;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    if (bufferSize <= 0) return;

    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);

    // Multi-grain applause simulation
    for (let i = 0; i < bufferSize; i++) {
      const timeSec = i / ctx.sampleRate;
      // Envelope: smooth swell and graceful decay
      const envelope = Math.sin((Math.PI * timeSec) / duration) * Math.exp(-timeSec / (duration * 0.9));
      // Random grain bursts simulating individual claps
      const granularBurst = 0.6 + 0.4 * Math.sin(timeSec * 32 + Math.sin(timeSec * 73));
      data[i] = (Math.random() * 2 - 1) * envelope * granularBurst;
    }

    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1100, t);
    filter.Q.setValueAtTime(1.2, t);

    const gain = ctx.createGain();
    const peakVolume = intensity === 'roar' ? 0.45 : intensity === 'applause' ? 0.3 : 0.18;
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(peakVolume, t + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    source.start(t);
    source.stop(t + duration);
  }

  /**
   * Plays Wimbledon broadcast electronic umpire decision chimes.
   */
  public playUmpireTone(type: UmpireToneType): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const t = ctx.currentTime;

    if (type === 'ace' || type === 'game') {
      // Ascending triumphant dual chime (D5 -> A5)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';

      osc1.frequency.setValueAtTime(587.33, t); // D5
      osc1.frequency.setValueAtTime(880.0, t + 0.12); // A5

      osc2.frequency.setValueAtTime(880.0, t); // A5
      osc2.frequency.setValueAtTime(1174.66, t + 0.12); // D6

      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.masterGain);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 0.4);
      osc2.stop(t + 0.4);
    } else if (type === 'out' || type === 'fault' || type === 'double_fault') {
      // Crisp descending alert buzzer/tone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.linearRampToValueAtTime(210, t + 0.14);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.15);
    } else if (type === 'net' || type === 'let') {
      // Wimbledon Let double-beep alert
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(659.25, t); // E5
      osc.frequency.setValueAtTime(0, t + 0.06);
      osc.frequency.setValueAtTime(659.25, t + 0.1);

      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.23);
    }
  }

  /**
   * Vocalizes official Wimbledon umpire announcements via Web Speech API.
   * Runs in English with British umpire cadence if supported by the browser.
   */
  public speakUmpireCall(callText: string): void {
    if (this.muted) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    try {
      window.speechSynthesis.cancel(); // Cancel any lingering utterances
      const utterance = new SpeechSynthesisUtterance(callText);
      utterance.lang = 'en-GB';
      utterance.rate = 1.05;
      utterance.pitch = 0.95;
      utterance.volume = this.volume;

      const voices = window.speechSynthesis.getVoices();
      const britishVoice = voices.find((v) => v.lang.startsWith('en-GB') || v.name.includes('British') || v.name.includes('UK'));
      if (britishVoice) {
        utterance.voice = britishVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch {
      // Speech synthesis error or restriction - silently ignore
    }
  }
}

export const tennisAudio = new TennisAudioEngine();
