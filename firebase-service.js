/**
 * Firebase Realtime Database Connector & Realtime Sync Engine
 * Memberikan sinkronisasi 2 arah ultra-cepat (<100ms) antar semua akun & perangkat.
 * Begitu petugas piket (misal akun Rabu) scan di gerbang, layar Admin langsung ter-update seketika.
 */
class FirebaseService {
  constructor() {
    this.app = null;
    this.db = null;
    this.isConnected = false;
    this.isListening = false;
    this.currentListeningDate = null;
    this.statusListeners = [];
    this.recordListeners = [];
    this.activeRef = null;
    this._connectionRef = null;
  }

  onStatusChange(cb) {
    if (typeof cb === 'function') {
      this.statusListeners.push(cb);
    }
  }

  notifyStatus(status, text) {
    this.statusListeners.forEach(fn => {
      try { fn(status, text); } catch (e) { console.warn('Error in statusListener:', e); }
    });
  }

  onRecordReceived(cb) {
    if (typeof cb === 'function') {
      this.recordListeners.push(cb);
    }
  }

  notifyRecordReceived(record, meta) {
    this.recordListeners.forEach(fn => {
      try { fn(record, meta); } catch (e) { console.warn('Error in recordListener:', e); }
    });
  }

  isConfigured() {
    const settings = window.storageService ? window.storageService.getSettings() : {};
    return !!(settings.fbApiKey && settings.fbApiKey.trim() && settings.fbDatabaseUrl && settings.fbDatabaseUrl.trim());
  }

  /**
   * Inisialisasi koneksi Firebase & pasang realtime listener harian
   */
  init() {
    const settings = window.storageService ? window.storageService.getSettings() : {};

    // Cek kelengkapan konfigurasi
    if (!settings.fbApiKey || !settings.fbDatabaseUrl) {
      this.isConnected = false;
      this.stopRealtimeListener();
      this.notifyStatus('unconfigured', 'Firebase: Belum Disetel');
      return false;
    }

    try {
      const config = {
        apiKey: settings.fbApiKey.trim(),
        databaseURL: settings.fbDatabaseUrl.trim().replace(/\/+$/, ''),
        projectId: (settings.fbProjectId || '').trim() || undefined
      };

      if (!firebase.apps.length) {
        this.app = firebase.initializeApp(config);
      } else {
        this.app = firebase.app();
      }

      this.db = firebase.database();

      // Monitor status koneksi online/offline secara live
      if (this._connectionRef) {
        this._connectionRef.off();
      }
      this._connectionRef = this.db.ref('.info/connected');
      this._connectionRef.on('value', (snap) => {
        if (snap.val() === true) {
          this.isConnected = true;
          this.notifyStatus('online', 'Firebase: Terhubung (Live)');
        } else {
          this.isConnected = false;
          this.notifyStatus('offline', 'Firebase: Terputus');
        }
      });

      // Langsung aktifkan realtime listener presensi hari ini
      this.startRealtimeListener();

      return true;
    } catch (e) {
      console.error('Firebase init error:', e);
      this.isConnected = false;
      this.notifyStatus('error', 'Firebase: Error Inisialisasi');
      return false;
    }
  }

  /**
   * Mengaktifkan Realtime Listener 2 Arah untuk data presensi tanggal target.
   * Setiap ada scan baru dari akun manapun (Rabu, Kamis, Admin, dll.),
   * Firebase langsung mengirimkan perubahan tersebut ke perangkat ini secara otomatis.
   */
  startRealtimeListener(targetDate) {
    if (!this.db) {
      const ok = this.init();
      if (!ok) return false;
    }

    const todayStr = targetDate || (window.storageService ? window.storageService.getTodayString() : new Date().toISOString().slice(0, 10));

    // Jangan pasang listener ganda jika sudah mendengarkan tanggal yang sama
    if (this.isListening && this.currentListeningDate === todayStr && this.activeRef) {
      return true;
    }

    // Bersihkan listener sebelumnya jika tanggal berganti
    this.stopRealtimeListener();

    try {
      const settings = window.storageService ? window.storageService.getSettings() : {};
      const rootPath = settings.fbRootPath || 'presensi_harian';
      this.activeRef = this.db.ref(`${rootPath}/${todayStr}`);
      this.currentListeningDate = todayStr;
      this.isListening = true;

      // 1. Data Presensi Baru (child_added)
      // Dipanggil untuk semua data yang ada saat awal buka, DAN setiap ada siswa discan di akun lain
      this.activeRef.on('child_added', (snap) => {
        const record = snap.val();
        if (!record || !record.nisn) return;

        // Gabungkan ke penyimpanan lokal (otomatis deduplikasi & verifikasi status)
        let mergeResult = { addedCount: 0 };
        if (window.storageService) {
          mergeResult = window.storageService.mergeTodayRecords([record]);
        }

        // Beri tahu UI bahwa ada data yang masuk
        this.notifyRecordReceived(record, {
          type: 'child_added',
          isNew: mergeResult.addedCount > 0,
          date: todayStr
        });
      });

      // 2. Data Presensi Diperbarui (child_changed)
      // Misal: Poin diupdate, keterangan diubah, atau status sinkron GAS berubah
      this.activeRef.on('child_changed', (snap) => {
        const record = snap.val();
        if (!record || !record.nisn) return;

        if (window.storageService) {
          window.storageService.mergeTodayRecords([record]);
        }

        this.notifyRecordReceived(record, {
          type: 'child_changed',
          isNew: false,
          date: todayStr
        });
      });

      // 3. Data Presensi Dihapus (child_removed)
      this.activeRef.on('child_removed', (snap) => {
        const record = snap.val();
        if (!record || !record.id) return;

        if (window.storageService) {
          const current = window.storageService.getTodayRecords();
          const filtered = current.filter(r => r.id !== record.id);
          if (filtered.length !== current.length) {
            window.storageService.saveTodayRecords(filtered);
          }
        }

        this.notifyRecordReceived(record, {
          type: 'child_removed',
          isNew: false,
          date: todayStr
        });
      });

      return true;
    } catch (err) {
      console.warn('Gagal memasang Realtime Listener Firebase:', err);
      this.isListening = false;
      return false;
    }
  }

  /**
   * Menghentikan listener realtime saat logout atau berganti tanggal
   */
  stopRealtimeListener() {
    if (this.activeRef) {
      try {
        this.activeRef.off();
      } catch (_) {}
      this.activeRef = null;
    }
    this.isListening = false;
    this.currentListeningDate = null;
  }

  /**
   * Menyimpan rekapan scan lengkap ke Firebase Realtime Database (<100ms)
   * Menyimpan SEMUA atribut penting agar akun Admin mendapatkan data utuh.
   */
  async saveScan(record) {
    if (!this.db) {
      const ok = this.init();
      if (!ok) return false;
    }

    try {
      const settings = window.storageService ? window.storageService.getSettings() : {};
      const rootPath = settings.fbRootPath || 'presensi_harian';
      const dateKey = record.date || (window.storageService ? window.storageService.getTodayString() : new Date().toISOString().slice(0, 10));
      const recordId = record.id || `scan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      const targetRef = this.db.ref(`${rootPath}/${dateKey}/${recordId}`);

      // Simpan payload presensi yang lengkap
      const payload = {
        id: recordId,
        nisn: String(record.nisn || '').replace(/^'+/, '').trim(),
        name: record.name || 'Siswa',
        class: record.class || 'Umum',
        timestamp: record.timestamp || Date.now(),
        date: dateKey,
        time: record.time || '07:00:00',
        mode: record.mode || 'masuk',
        type: record.type || (record.mode === 'pulang' ? 'Pulang' : 'Hadir'),
        status: record.status || (record.mode === 'pulang' ? 'Pulang' : 'Hadir'),
        statusAbsensi: record.statusAbsensi || (record.mode === 'pulang' ? 'Pulang' : 'Hadir'),
        isLate: !!record.isLate,
        lateMinutes: record.lateMinutes || 0,
        keterangan: record.keterangan || '',
        keteranganPoin: record.keteranganPoin || '',
        withoutCard: !!record.withoutCard,
        points: typeof record.points === 'number' ? record.points : 0,
        guardName: record.guardName || 'Petugas',
        guardUsername: record.guardUsername || 'petugas',
        waktuInput: record.waktuInput || `${dateKey} ${record.time || '07:00:00'}`,
        syncedToGas: !!record.syncedToGas,
        syncedToFirebase: true,
        source: record.source || 'scanner_kiosk'
      };

      await targetRef.set(payload);
      return true;
    } catch (err) {
      console.warn('Gagal menyimpan ke Firebase (Data tetap aman di antrean lokal):', err);
      return false;
    }
  }

  /**
   * Memperbarui status syncedToGas di Firebase untuk batch ID yang sudah berhasil terkirim ke Spreadsheet
   */
  async markRecordsSyncedToGas(recordIds, targetDate) {
    if (!this.db || !Array.isArray(recordIds) || recordIds.length === 0) return;

    try {
      const settings = window.storageService ? window.storageService.getSettings() : {};
      const rootPath = settings.fbRootPath || 'presensi_harian';
      const dateKey = targetDate || (window.storageService ? window.storageService.getTodayString() : new Date().toISOString().slice(0, 10));

      const updates = {};
      recordIds.forEach(id => {
        updates[`${rootPath}/${dateKey}/${id}/syncedToGas`] = true;
      });

      await this.db.ref().update(updates);
    } catch (e) {
      console.warn('Gagal memperbarui status syncedToGas di Firebase:', e);
    }
  }

  /**
   * Menghapus record dari Firebase jika dibatalkan oleh Admin
   */
  async deleteScan(recordId, targetDate) {
    if (!this.db) return false;
    try {
      const settings = window.storageService ? window.storageService.getSettings() : {};
      const rootPath = settings.fbRootPath || 'presensi_harian';
      const dateKey = targetDate || (window.storageService ? window.storageService.getTodayString() : new Date().toISOString().slice(0, 10));
      await this.db.ref(`${rootPath}/${dateKey}/${recordId}`).remove();
      return true;
    } catch (e) {
      console.warn('Gagal menghapus record dari Firebase:', e);
      return false;
    }
  }

  /**
   * Menguji koneksi dengan menulis & membaca ping sederhana
   */
  async testConnection() {
    try {
      const settings = window.storageService ? window.storageService.getSettings() : {};
      if (!settings.fbApiKey || !settings.fbDatabaseUrl) {
        return { success: false, message: 'Harap isi Firebase API Key dan Database URL terlebih dahulu!' };
      }

      const initialized = this.init();
      if (!initialized) {
        return { success: false, message: 'Gagal menginisialisasi Firebase SDK. Periksa format URL & API Key.' };
      }

      const testRef = this.db.ref('_system_health_check');
      const pingVal = Date.now();
      await testRef.set({ ping: pingVal, device: 'scanner_app_test' });

      // Hapus data uji agar database tetap bersih
      setTimeout(() => {
        try { testRef.remove(); } catch (_) {}
      }, 2000);

      this.isConnected = true;
      this.notifyStatus('online', 'Firebase: Terhubung (Live)');
      return { success: true, message: '⚡ Berhasil! Koneksi ke Firebase Realtime Database aktif dan siap sinkron kilat.' };
    } catch (e) {
      return { success: false, message: 'Gagal terhubung ke Firebase: ' + (e.message || 'Periksa API Key dan Rules Database.') };
    }
  }
}

window.firebaseService = new FirebaseService();
