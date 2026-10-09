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
          if (typeof window.onVoicesLoaded === 'function') {
            window.onVoicesLoaded(this.voices);
          }
        };
      } catch (_) {}
    }
  }

  getAvailableVoices() {
    if ('speechSynthesis' in window) {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) this.voices = v;
    }
    return this.voices || [];
  }

  getIndonesianVoice() {
    const list = this.getAvailableVoices();
    if (!list || list.length === 0) return null;

    // 1. Cek preferensi yang disimpan pengguna
    let preferredURI = '';
    try {
      const s = (window.storageService && typeof window.storageService.getSettings === 'function')
        ? window.storageService.getSettings()
        : null;
      if (s && s.ttsVoiceURI) preferredURI = s.ttsVoiceURI;
    } catch (_) {}

    if (preferredURI) {
      const userSelected = list.find(v => v.voiceURI === preferredURI || v.name === preferredURI);
      if (userSelected) return userSelected;
    }

    // 2. Cari semua suara yang berbahasa Indonesia atau memiliki label Indonesia
    const idVoices = list.filter(v => {
      const lang = (v.lang || '').toLowerCase().replace(/_/g, '-');
      const name = (v.name || '').toLowerCase();
      return lang.startsWith('id') || name.includes('indonesia') || name.includes('bahasa indonesia');
    });

    if (idVoices.length > 0) {
      // Prioritas 1: Suara Alami Microsoft (Edge Natural - Gadis / Ardi - sangat fasih & mirip manusia asli)
      const natural = idVoices.find(v => {
        const name = (v.name || '').toLowerCase();
        return name.includes('natural') || name.includes('gadis') || name.includes('ardi');
      });
      if (natural) return natural;

      // Prioritas 2: Suara Google Bahasa Indonesia (di Chrome)
      const google = idVoices.find(v => (v.name || '').toLowerCase().includes('google'));
      if (google) return google;

      // Prioritas 3: Suara Indonesia pertama yang tersedia
      return idVoices[0];
    }

    // 3. Cadangan: Suara Melayu (ms-MY) jika Windows/Browser tidak memiliki suara id-ID sama sekali.
    // Fonetik bahasa Melayu sangat mirip dengan Indonesia, melafalkan "Muhammad" dengan benar "Mu-ham-mad", bukan "memet".
    const msVoices = list.filter(v => {
      const lang = (v.lang || '').toLowerCase().replace(/_/g, '-');
      const name = (v.name || '').toLowerCase();
      return lang.startsWith('ms') || name.includes('melayu') || name.includes('malay');
    });
    if (msVoices.length > 0) {
      return msVoices[0];
    }

    // 4. Fallback: Suara default browser
    return null;
  }

  toTitleCase(str) {
    if (!str) return '';
    return str.replace(/\b\w+/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
  }

  normalizeIndonesianName(rawName) {
    if (!rawName || typeof rawName !== 'string') return '';
    let name = rawName.trim();

    // Jika nama ditulis dengan HURUF BESAR SEMUA (ALL CAPS), ubah ke Title Case
    // agar engine TTS membacanya sebagai kata utuh, bukan mengeja huruf satu per satu (akronim)
    if (name === name.toUpperCase()) {
      name = this.toTitleCase(name);
    }

    // Perluas singkatan umum nama siswa agar pelafalan TTS terdengar fasih & lengkap
    name = name.replace(/\b(m|muh|moh|moch|mhd)\.\s*/gi, 'Muhammad ');
    name = name.replace(/\b(muhamad)\b/gi, 'Muhammad');
    name = name.replace(/\b(abd)\.\s*/gi, 'Abdul ');
    name = name.replace(/\b(ahmd|ahm)\.\s*/gi, 'Ahmad ');

    return name.trim();
  }

  formatDisplayName(fullName) {
    if (!fullName || typeof fullName !== 'string') return '';
    const clean = fullName.trim();
    if (!clean || clean.toLowerCase() === 'siswa' || clean.toLowerCase() === 'null' || clean.toLowerCase() === 'undefined') return '';
    
    // Normalisasi singkatan & bentuk kapital
    const normalized = this.normalizeIndonesianName(clean);
    const parts = normalized.split(/\s+/);
    if (parts.length <= 2) return normalized;
    return parts.slice(0, 2).join(' ');
  }

  speakStudent(name, status = 'success', delayMs = 120) {
    if (!this.enabled || !this.ttsEnabled) return;
    if (!('speechSynthesis' in window)) return;

    setTimeout(() => {
      try {
        window.speechSynthesis.cancel();

        const s = (window.storageService && typeof window.storageService.getSettings === 'function') 
          ? window.storageService.getSettings() 
          : {};
        const tplMasuk = s.ttsTemplateMasuk || 'Terima kasih, {nama}!';
        const tplLate = s.ttsTemplateTerlambat || 'Perhatian, {nama}, Anda terlambat.';
        const tplPulang = s.ttsTemplatePulang || 'Terima kasih, {nama}, selamat jalan.';

        const displayName = this.formatDisplayName(name);
        let text = '';

        if (status === 'success') {
          text = displayName ? tplMasuk.replace('{nama}', displayName) : 'Terima kasih, selamat belajar!';
        } else if (status === 'late') {
          text = displayName ? tplLate.replace('{nama}', displayName) : 'Perhatian, Anda terlambat.';
        } else if (status === 'pulang') {
          text = displayName ? tplPulang.replace('{nama}', displayName) : 'Terima kasih, selamat jalan.';
        } else if (status === 'duplicate') {
          text = displayName ? `${displayName}, Anda sudah presensi.` : 'Anda sudah presensi.';
        } else if (status === 'tanpa_kartu') {
          text = displayName ? `Presensi dicatat, ${displayName}.` : 'Presensi dicatat.';
        } else {
          text = displayName ? `Halo, ${displayName}.` : 'Presensi berhasil.';
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'id-ID';
        
        // Atur kecepatan bicara (0.92 - 0.96 menghasilkan artikulasi kata yang jauh lebih jelas dan tidak terburu-buru)
        const customSpeed = parseFloat(s.ttsSpeed);
        utterance.rate = (!isNaN(customSpeed) && customSpeed >= 0.7 && customSpeed <= 1.5) ? customSpeed : 0.95;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        const voice = this.getIndonesianVoice();
        if (voice) {
          utterance.voice = voice;
          if (voice.lang) utterance.lang = voice.lang;
        }

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
      
      const s = (window.storageService && typeof window.storageService.getSettings === 'function') 
        ? window.storageService.getSettings() 
        : {};
      const customSpeed = parseFloat(s.ttsSpeed);
      utterance.rate = (!isNaN(customSpeed) && customSpeed >= 0.7 && customSpeed <= 1.5) ? customSpeed : 0.95;
      
      const voice = this.getIndonesianVoice();
      if (voice) {
        utterance.voice = voice;
        if (voice.lang) utterance.lang = voice.lang;
      }
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
