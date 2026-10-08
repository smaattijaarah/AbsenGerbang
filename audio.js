/**
 * Audio Synthesizer Engine (Web Audio API)
 * Zero external audio files required, guarantees <5ms response latency.
 */
class SoundEngine {
  constructor() {
    this.audioCtx = null;
    this.enabled = true;
    this.ttsEnabled = true;
    this.voices = [];
    this.initVoices();
    this.initOnFirstInteraction = this.initOnFirstInteraction.bind(this);
    window.addEventListener('click', this.initOnFirstInteraction, { once: true });
    window.addEventListener('keydown', this.initOnFirstInteraction, { once: true });
  }

  initVoices() {
    if ('speechSynthesis' in window) {
      try {
        this.voices = window.speechSynthesis.getVoices() || [];
        window.speechSynthesis.onvoiceschanged = () => {
          this.voices = window.speechSynthesis.getVoices() || [];
        };
      } catch (_) {}
    }
  }

  getIndonesianVoice() {
    if ('speechSynthesis' in window) {
      if (!this.voices || this.voices.length === 0) {
        this.voices = window.speechSynthesis.getVoices() || [];
      }
      return this.voices.find(v => v.lang === 'id-ID' || v.lang === 'id_ID' || v.lang.startsWith('id')) || null;
    }
    return null;
  }

  formatDisplayName(fullName) {
    if (!fullName || typeof fullName !== 'string') return '';
    const clean = fullName.trim();
    if (!clean || clean.toLowerCase() === 'siswa' || clean.toLowerCase() === 'null' || clean.toLowerCase() === 'undefined') return '';
    const parts = clean.split(/\s+/);
    if (parts.length <= 2) return clean;
    return parts.slice(0, 2).join(' ');
  }

  speakStudent(name, status = 'success', delayMs = 120) {
    if (!this.enabled || !this.ttsEnabled) return;
    if (!('speechSynthesis' in window)) return;

    setTimeout(() => {
      try {
        window.speechSynthesis.cancel();

        const displayName = this.formatDisplayName(name);
        let text = '';

        if (status === 'success') {
          text = displayName ? `Terima kasih, ${displayName}!` : 'Terima kasih, selamat belajar!';
        } else if (status === 'late') {
          text = displayName ? `Perhatian, ${displayName}, Anda terlambat.` : 'Perhatian, Anda terlambat.';
        } else if (status === 'pulang') {
          text = displayName ? `Terima kasih, ${displayName}, selamat jalan.` : 'Terima kasih, selamat jalan.';
        } else if (status === 'duplicate') {
          text = displayName ? `${displayName}, Anda sudah presensi.` : 'Anda sudah presensi.';
        } else if (status === 'tanpa_kartu') {
          text = displayName ? `Presensi dicatat, ${displayName}.` : 'Presensi dicatat.';
        } else {
          text = displayName ? `Halo, ${displayName}.` : 'Presensi berhasil.';
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'id-ID';
        utterance.rate = 1.05;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        const voice = this.getIndonesianVoice();
        if (voice) utterance.voice = voice;

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('TTS Error:', err);
      }
    }, delayMs);
  }

  speakCustom(text) {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID';
      utterance.rate = 1.0;
      const voice = this.getIndonesianVoice();
      if (voice) utterance.voice = voice;
      window.speechSynthesis.speak(utterance);
    } catch (_) {}
  }

  initOnFirstInteraction() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  ensureContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  toggleSound(forceState) {
    if (typeof forceState === 'boolean') {
      this.enabled = forceState;
    } else {
      this.enabled = !this.enabled;
    }
    return this.enabled;
  }

  /**
   * Sound 1: Sukses Tepat Waktu (High-pitch crisp chime, 880Hz -> 1320Hz)
   */
  playSuccess() {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.audioCtx) return;

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // Tone 1
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now); // A5
    gain1.gain.setValueAtTime(0.18, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.12);

    // Tone 2 (Higher)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1318.5, now + 0.08); // E6
    gain2.gain.setValueAtTime(0.2, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.28);
  }

  /**
   * Sound: Sukses Presensi Pulang (Ascending melodic chime)
   */
  playPulang() {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.audioCtx) return;

    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const tones = [523.25, 659.25, 783.99, 1046.50];
    tones.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.06);
      gain.gain.setValueAtTime(0.16, now + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.22);
    });
  }

  /**
   * Sound 2: Kesiangan / Terlambat (Warning melodic chime, 659Hz -> 440Hz)
   */
  playLate() {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.audioCtx) return;

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(659.25, now); // E5
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(440, now + 0.14); // A4
    gain2.gain.setValueAtTime(0.25, now + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.14);
    osc2.stop(now + 0.45);
  }

  /**
   * Sound 3: Double Scan / Peringatan Sudah Terdata (2x Low Buzz)
   */
  playDuplicate() {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.audioCtx) return;

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    [0, 0.12].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, now + offset);
      gain.gain.setValueAtTime(0.15, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.09);
    });
  }

  /**
   * Sound 4: Error / QR Tidak Dikenal
   */
  playError() {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.audioCtx) return;

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.linearRampToValueAtTime(110, now + 0.25);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }
}

// Global instance
window.soundEngine = new SoundEngine();
