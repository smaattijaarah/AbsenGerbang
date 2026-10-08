/**
 * Firebase Realtime Database Connector
 * Provides ultra-fast cloud storage (<50ms) to bypass Google Sheets write locks.
 */
class FirebaseService {
  constructor() {
    this.app = null;
    this.db = null;
    this.isConnected = false;
    this.statusListeners = [];
  }

  onStatusChange(cb) {
    this.statusListeners.push(cb);
  }

  notifyStatus(status, text) {
    this.statusListeners.forEach(fn => fn(status, text));
  }

  init() {
    const settings = window.storageService ? window.storageService.getSettings() : {};
    
    // Check if configuration exists
    if (!settings.fbApiKey || !settings.fbDatabaseUrl) {
      this.isConnected = false;
      this.notifyStatus('offline', 'Firebase: Belum Disetel');
      return false;
    }

    try {
      const config = {
        apiKey: settings.fbApiKey,
        databaseURL: settings.fbDatabaseUrl,
        projectId: settings.fbProjectId || undefined
      };

      if (!firebase.apps.length) {
        this.app = firebase.initializeApp(config);
      } else {
        this.app = firebase.app();
      }

      this.db = firebase.database();

      // Monitor connection status
      const connectedRef = this.db.ref('.info/connected');
      connectedRef.on('value', (snap) => {
        if (snap.val() === true) {
          this.isConnected = true;
          this.notifyStatus('online', 'Firebase: Terhubung');
        } else {
          this.isConnected = false;
          this.notifyStatus('offline', 'Firebase: Terputus');
        }
      });

      return true;
    } catch (e) {
      console.error('Firebase init error:', e);
      this.isConnected = false;
      this.notifyStatus('offline', 'Firebase: Error');
      return false;
    }
  }

  /**
   * Save scan record directly to Firebase in milliseconds
   */
  async saveScan(record) {
    if (!this.db) {
      const ok = this.init();
      if (!ok) return false;
    }

    try {
      const settings = window.storageService.getSettings();
      const rootPath = settings.fbRootPath || 'presensi_harian';
      const dateKey = record.date; // e.g. "2026-10-03"
      
      // Save under: presensi_harian/YYYY-MM-DD/recordId
      const targetRef = this.db.ref(`${rootPath}/${dateKey}/${record.id}`);
      
      const payload = {
        id: record.id,
        nisn: record.nisn,
        name: record.name,
        class: record.class,
        date: record.date,
        time: record.time,
        timestamp: record.timestamp,
        status: record.status,
        points: record.points || 0,
        syncedToGas: record.syncedToGas || false,
        source: 'scanner_kiosk'
      };

      await targetRef.set(payload);
      return true;
    } catch (err) {
      console.warn('Firebase save failed (will rely on local queue):', err);
      return false;
    }
  }

  /**
   * Test connection test with dummy ping
   */
  async testConnection() {
    try {
      if (!this.db) {
        const initialized = this.init();
        if (!initialized) throw new Error('Konfigurasi API Key atau Database URL belum diisi');
      }

      const testRef = this.db.ref('_system_health_check');
      await testRef.set({ ping: Date.now() });
      return { success: true, message: 'Koneksi ke Firebase Realtime Database Berhasil!' };
    } catch (e) {
      return { success: false, message: e.message || 'Gagal terhubung ke Firebase' };
    }
  }
}

window.firebaseService = new FirebaseService();
