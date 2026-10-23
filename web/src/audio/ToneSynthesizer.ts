/**
 * Clinical Web Audio Pure-Tone Synthesizer
 *
 * Implements persistent gated oscillator architecture for zero-click,
 * zero-latency continuous pitch gliding across the human hearing range (20 Hz - 20,000 Hz).
 * Complies strictly with AGENTS.md guidelines (zero external audio bloat, exponential gain envelopes).
 */

export class ToneSynthesizer {
  private static instance: ToneSynthesizer | null = null;

  private audioCtx: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private envelopeGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private safetyLimiter: DynamicsCompressorNode | null = null;

  private isPlaying = false;
  private currentFrequency = 1000.0; // Default 1 kHz reference tone
  private currentVolume = 0.8;
  private initialized = false;

  // Surgical procedural audio nodes
  private drillOsc: OscillatorNode | null = null;
  private drillGain: GainNode | null = null;
  private isDrilling = false;
  private emgOsc: OscillatorNode | null = null;
  private emgGain: GainNode | null = null;
  private isEMGAlarm = false;

  private static readonly GAIN_FLOOR = 0.0001; // Non-zero floor required for exponential ramps
  private static readonly MAX_SAFE_GAIN = 0.65; // Acoustic safety ceiling
  private static readonly ATTACK_SEC = 0.05; // 50ms smooth exponential attack
  private static readonly DECAY_SEC = 0.05; // 50ms smooth exponential decay
  private static readonly GLIDE_SEC = 0.035; // 35ms pitch gliding time constant

  private constructor() {
    // Lazy initialization on first user gesture
  }

  public static getInstance(): ToneSynthesizer {
    if (!ToneSynthesizer.instance) {
      ToneSynthesizer.instance = new ToneSynthesizer();
    }
    return ToneSynthesizer.instance;
  }

  /**
   * Lazily initializes the Web Audio graph on first user interaction.
   */
  private ensureAudioGraph(): boolean {
    if (this.initialized && this.audioCtx && this.oscillator && this.envelopeGain) {
      return true;
    }

    try {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) {
        console.warn('[ToneSynthesizer] Web Audio API is not supported in this browser.');
        return false;
      }

      this.audioCtx = new AudioCtxClass();

      // 1. Acoustic Safety Limiter (Prevents sudden ear-fatiguing transients)
      this.safetyLimiter = this.audioCtx.createDynamicsCompressor();
      this.safetyLimiter.threshold.setValueAtTime(-4.0, this.audioCtx.currentTime);
      this.safetyLimiter.knee.setValueAtTime(10.0, this.audioCtx.currentTime);
      this.safetyLimiter.ratio.setValueAtTime(12.0, this.audioCtx.currentTime);
      this.safetyLimiter.attack.setValueAtTime(0.003, this.audioCtx.currentTime);
      this.safetyLimiter.release.setValueAtTime(0.15, this.audioCtx.currentTime);

      // 2. Master Gain Ceiling
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.setValueAtTime(ToneSynthesizer.MAX_SAFE_GAIN, this.audioCtx.currentTime);

      // 3. Persistent Envelope Gate
      this.envelopeGain = this.audioCtx.createGain();
      this.envelopeGain.gain.setValueAtTime(ToneSynthesizer.GAIN_FLOOR, this.audioCtx.currentTime);

      // 4. Persistent Gated Sine Oscillator
      this.oscillator = this.audioCtx.createOscillator();
      this.oscillator.type = 'sine';
      this.oscillator.frequency.setValueAtTime(this.currentFrequency, this.audioCtx.currentTime);

      // Audio Graph Routing:
      // Oscillator -> Envelope Gain -> Safety Limiter -> Master Gain -> Audio Destination
      this.oscillator.connect(this.envelopeGain);
      this.envelopeGain.connect(this.safetyLimiter);
      this.safetyLimiter.connect(this.masterGain);
      this.masterGain.connect(this.audioCtx.destination);

      this.oscillator.start();
      this.initialized = true;
      return true;
    } catch (err) {
      console.warn('[ToneSynthesizer] Audio context initialization error:', err);
      return false;
    }
  }

  /**
   * Resumes the AudioContext if suspended by browser autoplay policy.
   */
  public async resumeContextIfNeeded(): Promise<void> {
    this.ensureAudioGraph();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume();
      } catch (err) {
        console.warn('[ToneSynthesizer] AudioContext resume failed:', err);
      }
    }
  }

  /**
   * Starts pure-tone playback with a 50ms click-free exponential attack envelope.
   */
  public async startTone(freqHz?: number, volume?: number): Promise<void> {
    await this.resumeContextIfNeeded();
    if (!this.ensureAudioGraph() || !this.audioCtx || !this.envelopeGain || !this.oscillator) {
      return;
    }

    if (volume !== undefined) {
      this.currentVolume = Math.max(0.0, Math.min(1.0, volume));
    }

    if (freqHz !== undefined) {
      this.setFrequency(freqHz, false);
    }

    const now = this.audioCtx.currentTime;
    const targetGain = Math.max(
      ToneSynthesizer.GAIN_FLOOR,
      Math.min(0.24, 0.22 * this.currentVolume)
    );

    this.envelopeGain.gain.cancelScheduledValues(now);
    this.envelopeGain.gain.setValueAtTime(Math.max(ToneSynthesizer.GAIN_FLOOR, this.envelopeGain.gain.value), now);
    this.envelopeGain.gain.exponentialRampToValueAtTime(targetGain, now + ToneSynthesizer.ATTACK_SEC);

    this.isPlaying = true;
  }

  /**
   * Stops pure-tone playback with a 50ms click-free exponential decay envelope.
   */
  public stopTone(): void {
    if (!this.initialized || !this.audioCtx || !this.envelopeGain) {
      this.isPlaying = false;
      return;
    }

    const now = this.audioCtx.currentTime;
    this.envelopeGain.gain.cancelScheduledValues(now);
    this.envelopeGain.gain.setValueAtTime(Math.max(ToneSynthesizer.GAIN_FLOOR, this.envelopeGain.gain.value), now);
    this.envelopeGain.gain.exponentialRampToValueAtTime(ToneSynthesizer.GAIN_FLOOR, now + ToneSynthesizer.DECAY_SEC);

    this.isPlaying = false;
  }

  /**
   * Toggles tone playback on or off.
   */
  public async toggleTone(freqHz?: number): Promise<boolean> {
    if (this.isPlaying) {
      this.stopTone();
      return false;
    } else {
      await this.startTone(freqHz);
      return true;
    }
  }

  /**
   * Convenience aliases for playback controls.
   */
  public async play(freqHz?: number): Promise<void> {
    await this.startTone(freqHz);
  }

  public pause(): void {
    this.stopTone();
  }

  /**
   * Smoothly glides the oscillator frequency to a new target without pitch artifacts.
   */
  public setFrequency(freqHz: number, glide = true): void {
    const clampedFreq = Math.max(20.0, Math.min(20000.0, freqHz));
    this.currentFrequency = clampedFreq;

    if (!this.initialized || !this.audioCtx || !this.oscillator) {
      return;
    }

    const now = this.audioCtx.currentTime;
    this.oscillator.frequency.cancelScheduledValues(now);

    if (glide && this.isPlaying) {
      this.oscillator.frequency.setValueAtTime(this.oscillator.frequency.value, now);
      this.oscillator.frequency.exponentialRampToValueAtTime(clampedFreq, now + ToneSynthesizer.GLIDE_SEC);
    } else {
      this.oscillator.frequency.setValueAtTime(clampedFreq, now);
    }
  }

  /**
   * Sets tone volume in [0.0, 1.0].
   */
  public setVolume(volume: number): void {
    this.currentVolume = Math.max(0.0, Math.min(1.0, volume));
    if (this.isPlaying && this.audioCtx && this.envelopeGain) {
      const now = this.audioCtx.currentTime;
      const targetGain = Math.max(
        ToneSynthesizer.GAIN_FLOOR,
        Math.min(0.24, 0.22 * this.currentVolume)
      );
      this.envelopeGain.gain.cancelScheduledValues(now);
      this.envelopeGain.gain.setValueAtTime(this.envelopeGain.gain.value, now);
      this.envelopeGain.gain.exponentialRampToValueAtTime(targetGain, now + 0.02);
    }
  }

  public getFrequency(): number {
    return this.currentFrequency;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Starts high-speed otologic drill whine (70,000 RPM pneumatic burr ~ 1,166.7 Hz).
   */
  public async startDrill(rpm = 70000): Promise<void> {
    await this.resumeContextIfNeeded();
    if (!this.ensureAudioGraph() || !this.audioCtx || !this.masterGain) return;
    if (this.isDrilling) return;

    try {
      const now = this.audioCtx.currentTime;
      const drillFreq = Math.max(200, Math.min(2000, (rpm / 60) * 1.0)); // ~1166.7 Hz

      this.drillGain = this.audioCtx.createGain();
      this.drillGain.gain.setValueAtTime(ToneSynthesizer.GAIN_FLOOR, now);

      this.drillOsc = this.audioCtx.createOscillator();
      this.drillOsc.type = 'triangle';
      this.drillOsc.frequency.setValueAtTime(drillFreq, now);

      this.drillOsc.connect(this.drillGain);
      this.drillGain.connect(this.masterGain);

      this.drillOsc.start(now);
      this.drillGain.gain.exponentialRampToValueAtTime(0.08, now + 0.04);
      this.isDrilling = true;
    } catch (err) {
      console.warn('[ToneSynthesizer] startDrill error:', err);
    }
  }

  /**
   * Stops otologic drill whine with a smooth 40ms decay.
   */
  public stopDrill(): void {
    if (!this.isDrilling || !this.audioCtx || !this.drillGain || !this.drillOsc) {
      this.isDrilling = false;
      return;
    }

    try {
      const now = this.audioCtx.currentTime;
      this.drillGain.gain.cancelScheduledValues(now);
      this.drillGain.gain.setValueAtTime(Math.max(ToneSynthesizer.GAIN_FLOOR, this.drillGain.gain.value), now);
      this.drillGain.gain.exponentialRampToValueAtTime(ToneSynthesizer.GAIN_FLOOR, now + 0.04);

      const osc = this.drillOsc;
      setTimeout(() => {
        try {
          osc.stop();
          osc.disconnect();
        } catch {
          // ignore
        }
      }, 50);
    } catch {
      // ignore
    }

    this.isDrilling = false;
    this.drillOsc = null;
    this.drillGain = null;
  }

  public getIsDrilling(): boolean {
    return this.isDrilling;
  }

  /**
   * Triggers facial nerve EMG neurotonic buzz/whine (180 Hz rapid pulse).
   */
  public async triggerEMGAlarm(freqHz = 180): Promise<void> {
    await this.resumeContextIfNeeded();
    if (!this.ensureAudioGraph() || !this.audioCtx || !this.masterGain) return;
    if (this.isEMGAlarm) return;

    try {
      const now = this.audioCtx.currentTime;
      this.emgGain = this.audioCtx.createGain();
      this.emgGain.gain.setValueAtTime(ToneSynthesizer.GAIN_FLOOR, now);

      this.emgOsc = this.audioCtx.createOscillator();
      this.emgOsc.type = 'sawtooth';
      this.emgOsc.frequency.setValueAtTime(freqHz, now);

      this.emgOsc.connect(this.emgGain);
      this.emgGain.connect(this.masterGain);

      this.emgOsc.start(now);
      this.emgGain.gain.exponentialRampToValueAtTime(0.12, now + 0.03);
      this.isEMGAlarm = true;
    } catch (err) {
      console.warn('[ToneSynthesizer] triggerEMGAlarm error:', err);
    }
  }

  /**
   * Stops facial nerve EMG alarm.
   */
  public stopEMGAlarm(): void {
    if (!this.isEMGAlarm || !this.audioCtx || !this.emgGain || !this.emgOsc) {
      this.isEMGAlarm = false;
      return;
    }

    try {
      const now = this.audioCtx.currentTime;
      this.emgGain.gain.cancelScheduledValues(now);
      this.emgGain.gain.setValueAtTime(Math.max(ToneSynthesizer.GAIN_FLOOR, this.emgGain.gain.value), now);
      this.emgGain.gain.exponentialRampToValueAtTime(ToneSynthesizer.GAIN_FLOOR, now + 0.04);

      const osc = this.emgOsc;
      setTimeout(() => {
        try {
          osc.stop();
          osc.disconnect();
        } catch {
          // ignore
        }
      }, 50);
    } catch {
      // ignore
    }

    this.isEMGAlarm = false;
    this.emgOsc = null;
    this.emgGain = null;
  }

  public getIsEMGAlarm(): boolean {
    return this.isEMGAlarm;
  }

  /**
   * Synthesizes basilar membrane rupture transient snap/pop on scalar translocation breach.
   */
  public async triggerRuptureSnap(): Promise<void> {
    await this.resumeContextIfNeeded();
    if (!this.ensureAudioGraph() || !this.audioCtx || !this.masterGain) return;

    try {
      const now = this.audioCtx.currentTime;
      const snapOsc = this.audioCtx.createOscillator();
      const snapGain = this.audioCtx.createGain();

      snapOsc.type = 'sine';
      snapOsc.frequency.setValueAtTime(90.0, now);
      snapOsc.frequency.exponentialRampToValueAtTime(25.0, now + 0.06);

      snapGain.gain.setValueAtTime(0.28, now);
      snapGain.gain.exponentialRampToValueAtTime(ToneSynthesizer.GAIN_FLOOR, now + 0.06);

      snapOsc.connect(snapGain);
      snapGain.connect(this.masterGain);

      snapOsc.start(now);
      snapOsc.stop(now + 0.07);
    } catch (err) {
      console.warn('[ToneSynthesizer] triggerRuptureSnap error:', err);
    }
  }

  public dispose(): void {
    this.stopDrill();
    this.stopEMGAlarm();
    if (this.oscillator) {
      try {
        this.oscillator.stop();
        this.oscillator.disconnect();
      } catch {
        // ignore
      }
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(() => {});
    }
    this.initialized = false;
    this.isPlaying = false;
    ToneSynthesizer.instance = null;
  }
}
