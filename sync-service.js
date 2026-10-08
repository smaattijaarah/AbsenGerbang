/**
 * Background Sync Service to Google Apps Script (GAS) & Google Sheets
 * Runs in parallel without ever blocking the scanner UI or audio feedback.
 */
class SyncService {
  constructor() {
    this.isSyncing = false;
    this.timerId = null;
    this.listeners = [];
  }

  onUpdate(cb) {
    this.listeners.push(cb);
  }

  notifyUpdate(status) {
    this.listeners.forEach(fn => fn(status));
  }

  startAutoSync() {
    this.stopAutoSync();
    const settings = window.storageService.getSettings();
    const intervalSec = Math.max(3, parseInt(settings.syncInterval, 10) || 5);

    // Initial check
    this.syncPendingToGas();

    this.timerId = setInterval(() => {
      this.syncPendingToGas();
    }, intervalSec * 1000);
  }

  stopAutoSync() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * Sync pending records to Google Apps Script Web App
   * @param {boolean} all - if true, loops until all pending records are sent
   */
  async syncPendingToGas(all = false) {
    if (this.isSyncing) return { status: 'already_running' };

    const initialPending = window.storageService.getPendingGasSync();
    this.notifyUpdate({ pendingCount: initialPending.length, isSyncing: false });

    if (initialPending.length === 0) return { status: 'empty', count: 0 };

    const settings = window.storageService.getSettings();
    if (!settings.gasUrl || !settings.gasUrl.startsWith('http')) {
      return { status: 'no_url', count: initialPending.length };
    }

    this.isSyncing = true;
    let totalSynced = 0;

    try {
      while (true) {
        const currentPending = window.storageService.getPendingGasSync();
        if (currentPending.length === 0) break;

        this.notifyUpdate({ pendingCount: currentPending.length, isSyncing: true });

        // Send max 25 records per batch for fast and reliable processing
        const batch = currentPending.slice(0, 25);
        const idsToMark = batch.map(b => b.id);

        const payload = {
          action: 'batch_record_attendance',
          spreadsheetId: settings.spreadsheetId || '',
          sheetName: settings.sheetName || 'Presensi_Masuk',
          records: batch
        };

        // Kirim via POST dengan Blob text/plain murni agar tidak memicu CORS preflight OPTIONS
        const blob = new Blob([JSON.stringify(payload)], { type: 'text/plain' });
        const response = await fetch(settings.gasUrl, {
          method: 'POST',
          body: blob,
          redirect: 'follow'
        });

        if (response.ok) {
          let result = {};
          try {
            result = await response.json();
          } catch (_) {
            result = { status: 'success' };
          }

          if (result.status === 'success' || result.success) {
            window.storageService.markGasSynced(idsToMark);
            totalSynced += idsToMark.length;
          } else {
            console.warn('GAS responded with non-success:', result);
            return { status: 'gas_error', error: result.message || 'Gagal menyimpan ke spreadsheet', count: totalSynced };
          }
        } else {
          console.warn('GAS HTTP response not OK:', response.status);
          break;
        }

        // If not running full flush, process one batch per interval
        if (!all) break;
      }

      return { status: 'success', count: totalSynced };
    } catch (err) {
      // In case of CORS or offline error, records remain safely in local storage queue
      console.warn('Network error while syncing to GAS (data aman, akan dicoba lagi):', err.message);
      return { status: 'network_error', error: err.message, count: totalSynced };
    } finally {
      this.isSyncing = false;
      const remaining = window.storageService.getPendingGasSync();
      this.notifyUpdate({ pendingCount: remaining.length, isSyncing: false });
    }
  }

  /**
   * Quick Ping Test to GAS Web App & Verify Spreadsheet Connection
   * Menggunakan GET terlebih dahulu (100% bebas dari blokir CORS preflight)
   */
  async testGasConnection() {
    const settings = window.storageService.getSettings();
    if (!settings.gasUrl) {
      return { success: false, message: 'URL Web App GAS belum diisi.' };
    }

    const cleanUrl = settings.gasUrl.trim();
    if (!cleanUrl.startsWith('http')) {
      return { success: false, message: 'URL Web App harus diawali dengan https://' };
    }
    if (cleanUrl.endsWith('/dev')) {
      return { 
        success: false, 
        message: 'URL Anda berakhiran /dev. Web App untuk publik HARUS berakhiran /exec (salin dari New Deployment).' 
      };
    }

    const rawId = settings.spreadsheetId || '';
    const cleanId = rawId.match(/\/d\/([a-zA-Z0-9_-]+)/) ? rawId.match(/\/d\/([a-zA-Z0-9_-]+)/)[1] : rawId.trim();
    const sheetName = settings.sheetName || 'Presensi_Masuk';

    // 1. Coba tes via GET terlebih dahulu (Sangat aman dari blokir CORS preflight browser)
    try {
      const getUrl = new URL(cleanUrl);
      getUrl.searchParams.set('action', 'ping');
      if (cleanId) getUrl.searchParams.set('spreadsheetId', cleanId);
      getUrl.searchParams.set('sheetName', sheetName);
      getUrl.searchParams.set('_t', Date.now());

      const res = await fetch(getUrl.toString(), {
        method: 'GET',
        redirect: 'follow',
        cache: 'no-cache'
      });

      if (res.ok) {
        const data = await res.json();
        if (data.status === 'error') {
          return { success: false, message: data.message || 'Gagal membuka Spreadsheet target' };
        }
        return { success: true, message: data.message || 'Koneksi ke Web App GAS Berhasil!' };
      }
    } catch (getErr) {
      console.warn('GET ping failed, trying POST fallback:', getErr.message);
    }

    // 2. Fallback POST menggunakan Blob text/plain murni
    try {
      const testPayload = {
        action: 'ping',
        spreadsheetId: cleanId,
        sheetName: sheetName,
        timestamp: Date.now()
      };

      const blob = new Blob([JSON.stringify(testPayload)], { type: 'text/plain' });

      const res = await fetch(cleanUrl, {
        method: 'POST',
        body: blob,
        redirect: 'follow'
      });

      if (!res.ok) {
        return { success: false, message: `Server mengembalikan status HTTP ${res.status}` };
      }

      const data = await res.json();
      if (data.status === 'error') {
        return { success: false, message: data.message || 'Gagal terhubung ke Spreadsheet target' };
      }

      return { success: true, message: data.message || 'Koneksi ke Web App GAS Berhasil!' };
    } catch (e) {
      return { 
        success: false, 
        message: `Gagal memanggil GAS: ${e.message}. Pastikan URL berakhiran /exec dan skrip di-deploy dengan akun Gmail biasa (bebas blokir domain).` 
      };
    }
  }

  /**
   * Ambil daftar User & Admin dari tab Data_Pengguna di Spreadsheet
   */
  async fetchUsersFromSpreadsheet() {
    const settings = window.storageService.getSettings();
    if (!settings.gasUrl) {
      return { success: false, message: 'URL Web App GAS belum diisi.' };
    }

    const cleanUrl = settings.gasUrl.trim();
    const rawId = settings.spreadsheetId || '';
    const cleanId = rawId.match(/\/d\/([a-zA-Z0-9_-]+)/) ? rawId.match(/\/d\/([a-zA-Z0-9_-]+)/)[1] : rawId.trim();

    // 1. Coba via GET terlebih dahulu
    try {
      const getUrl = new URL(cleanUrl);
      getUrl.searchParams.set('action', 'get_users');
      getUrl.searchParams.set('spreadsheetId', cleanId);
      getUrl.searchParams.set('_t', Date.now());

      const res = await fetch(getUrl.toString(), { method: 'GET', redirect: 'follow', cache: 'no-cache' });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.users)) {
          window.storageService.setUsers(data.users);
          return { success: true, count: data.users.length, users: data.users };
        }
      }
    } catch (_) {}

    // 2. Fallback via POST
    try {
      const payload = {
        action: 'get_users',
        spreadsheetId: cleanId
      };
      const blob = new Blob([JSON.stringify(payload)], { type: 'text/plain' });
      const res = await fetch(cleanUrl, {
        method: 'POST',
        body: blob,
        redirect: 'follow'
      });
      const data = await res.json();
      if (data.status === 'success' && Array.isArray(data.users)) {
        window.storageService.setUsers(data.users);
        return { success: true, count: data.users.length, users: data.users };
      }
      return { success: false, message: data.message || 'Gagal memuat pengguna dari spreadsheet.' };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Tarik master data siswa dari Spreadsheet (Tab Data_Siswa / Siswa)
   */
  async fetchStudentsFromSpreadsheet() {
    const settings = window.storageService.getSettings();
    if (!settings.gasUrl) {
      return { success: false, message: 'URL Web App GAS belum diisi.' };
    }

    const cleanUrl = settings.gasUrl.trim();
    const rawId = settings.spreadsheetId || '';
    const cleanId = rawId.match(/\/d\/([a-zA-Z0-9_-]+)/) ? rawId.match(/\/d\/([a-zA-Z0-9_-]+)/)[1] : rawId.trim();

    // 1. Coba via GET
    try {
      const getUrl = new URL(cleanUrl);
      getUrl.searchParams.set('action', 'get_students');
      getUrl.searchParams.set('spreadsheetId', cleanId);
      getUrl.searchParams.set('_t', Date.now());

      const res = await fetch(getUrl.toString(), { method: 'GET', redirect: 'follow', cache: 'no-cache' });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.students)) {
          const map = {};
          data.students.forEach(s => {
            if (s.nisn) map[s.nisn] = { name: s.name, class: s.class };
          });
          window.storageService.saveMasterStudents(map);
          return { success: true, count: data.students.length, sheetName: data.sheetName };
        } else if (data.status === 'not_found') {
          return { success: false, notFound: true, message: data.message };
        }
      }
    } catch (_) {}

    // 2. Fallback via POST
    try {
      const payload = { action: 'get_students', spreadsheetId: cleanId };
      const blob = new Blob([JSON.stringify(payload)], { type: 'text/plain' });
      const res = await fetch(cleanUrl, { method: 'POST', body: blob, redirect: 'follow' });
      const data = await res.json();
      if (data.status === 'success' && Array.isArray(data.students)) {
        const map = {};
        data.students.forEach(s => {
          if (s.nisn) map[s.nisn] = { name: s.name, class: s.class };
        });
        window.storageService.saveMasterStudents(map);
        return { success: true, count: data.students.length, sheetName: data.sheetName };
      }
      return { success: false, message: data.message || 'Gagal memuat data siswa dari spreadsheet.' };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Tarik daftar kategori poin pelanggaran dari sheet 'konfigurasi_poin' di Spreadsheet
   */
  async fetchPointCategoriesFromSpreadsheet() {
    const settings = window.storageService.getSettings();
    if (!settings.gasUrl) {
      return { success: false, message: 'URL Web App GAS belum diisi.' };
    }

    const cleanUrl = settings.gasUrl.trim();
    const rawId = settings.spreadsheetId || '';
    const cleanId = rawId.match(/\/d\/([a-zA-Z0-9_-]+)/) ? rawId.match(/\/d\/([a-zA-Z0-9_-]+)/)[1] : rawId.trim();

    // 1. GET
    try {
      const getUrl = new URL(cleanUrl);
      getUrl.searchParams.set('action', 'get_point_categories');
      getUrl.searchParams.set('spreadsheetId', cleanId);
      getUrl.searchParams.set('_t', Date.now());

      const res = await fetch(getUrl.toString(), { method: 'GET', redirect: 'follow', cache: 'no-cache' });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.categories) && data.categories.length > 0) {
          window.storageService.savePointCategories(data.categories);
          return { success: true, count: data.categories.length, categories: data.categories, sheetName: data.sheetName };
        }
      }
    } catch (_) {}

    // 2. POST Fallback
    try {
      const payload = { action: 'get_point_categories', spreadsheetId: cleanId };
      const blob = new Blob([JSON.stringify(payload)], { type: 'text/plain' });
      const res = await fetch(cleanUrl, { method: 'POST', body: blob, redirect: 'follow' });
      const data = await res.json();
      if (data.status === 'success' && Array.isArray(data.categories) && data.categories.length > 0) {
        window.storageService.savePointCategories(data.categories);
        return { success: true, count: data.categories.length, categories: data.categories, sheetName: data.sheetName };
      }
      return { success: false, message: data.message || 'Gagal memuat kategori poin dari sheet konfigurasi_poin' };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Simpan atau update User ke tab Data_Pengguna di Spreadsheet
   */
  async saveUserToSpreadsheet(user) {
    const settings = window.storageService.getSettings();
    if (!settings.gasUrl) {
      window.storageService.saveUserLocal(user);
      return { success: true, offline: true, message: 'Tersimpan di memori lokal (offline).' };
    }

    try {
      const payload = {
        action: 'save_user',
        spreadsheetId: settings.spreadsheetId || '',
        user: user
      };
      const blob = new Blob([JSON.stringify(payload)], { type: 'text/plain' });
      const res = await fetch(settings.gasUrl, {
        method: 'POST',
        body: blob,
        redirect: 'follow'
      });
      const data = await res.json();
      if (data.status === 'success') {
        window.storageService.saveUserLocal(user);
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message || 'Gagal menyimpan ke spreadsheet.' };
    } catch (e) {
      window.storageService.saveUserLocal(user);
      return { success: true, offline: true, message: 'Tersimpan di cache lokal (gagal online: ' + e.message + ')' };
    }
  }

  /**
   * Hapus User dari tab Data_Pengguna di Spreadsheet
   */
  async deleteUserFromSpreadsheet(username) {
    const settings = window.storageService.getSettings();
    if (!settings.gasUrl) {
      window.storageService.deleteUserLocal(username);
      return { success: true, message: 'Dihapus dari memori lokal.' };
    }

    try {
      const payload = {
        action: 'delete_user',
        spreadsheetId: settings.spreadsheetId || '',
        username: username
      };
      const blob = new Blob([JSON.stringify(payload)], { type: 'text/plain' });
      const res = await fetch(settings.gasUrl, {
        method: 'POST',
        body: blob,
        redirect: 'follow'
      });
      const data = await res.json();
      if (data.status === 'success') {
        window.storageService.deleteUserLocal(username);
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message };
    } catch (e) {
      window.storageService.deleteUserLocal(username);
      return { success: true, message: 'Dihapus dari cache lokal.' };
    }
  }

  /**
   * Coba otentikasi online langsung ke spreadsheet
   */
  async authenticateOnline(username, pin) {
    const settings = window.storageService.getSettings();
    if (!settings.gasUrl) return null;

    try {
      const payload = {
        action: 'auth_user',
        spreadsheetId: settings.spreadsheetId || '',
        username: username,
        pin: pin
      };
      const blob = new Blob([JSON.stringify(payload)], { type: 'text/plain' });
      const res = await fetch(settings.gasUrl, {
        method: 'POST',
        body: blob,
        redirect: 'follow'
      });
      const data = await res.json();
      if (data.status === 'success' && data.user) {
        window.storageService.saveUserLocal(data.user);
        return data.user;
      }
    } catch (_) {}
    return null;
  }

  /**
   * Tarik pengaturan jadwal & poin dari sheet 'konfigurasi' di Spreadsheet
   */
  async fetchSettingsFromSpreadsheet() {
    const settings = window.storageService.getSettings();
    if (!settings.gasUrl) return { success: false, message: 'URL GAS belum diisi' };

    const cleanUrl = settings.gasUrl.trim();
    const rawId = settings.spreadsheetId || '';
    const cleanId = rawId.match(/\/d\/([a-zA-Z0-9_-]+)/) ? rawId.match(/\/d\/([a-zA-Z0-9_-]+)/)[1] : rawId.trim();

    // 1. Coba via GET
    try {
      const getUrl = new URL(cleanUrl);
      getUrl.searchParams.set('action', 'get_settings');
      if (cleanId) getUrl.searchParams.set('spreadsheetId', cleanId);
      getUrl.searchParams.set('_t', Date.now());

      const res = await fetch(getUrl.toString(), { method: 'GET', redirect: 'follow', cache: 'no-cache' });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' && data.settings) {
          window.storageService.saveSettings(data.settings);
          return { success: true, settings: data.settings };
        }
      }
    } catch (_) {}

    // 2. Fallback via POST
    try {
      const payload = { action: 'get_settings', spreadsheetId: cleanId };
      const blob = new Blob([JSON.stringify(payload)], { type: 'text/plain' });
      const res = await fetch(cleanUrl, { method: 'POST', body: blob, redirect: 'follow' });
      const data = await res.json();
      if (data.status === 'success' && data.settings) {
        window.storageService.saveSettings(data.settings);
        return { success: true, settings: data.settings };
      }
      return { success: false, message: data.message || 'Gagal memuat pengaturan dari spreadsheet.' };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Simpan pengaturan jadwal & poin secara permanen ke sheet 'konfigurasi' di Spreadsheet
   */
  async saveSettingsToSpreadsheet(newSettings) {
    const settings = window.storageService.getSettings();
    if (!settings.gasUrl) {
      return { success: true, offline: true, message: 'Tersimpan lokal (URL GAS belum diisi).' };
    }

    const cleanUrl = settings.gasUrl.trim();
    const rawId = settings.spreadsheetId || '';
    const cleanId = rawId.match(/\/d\/([a-zA-Z0-9_-]+)/) ? rawId.match(/\/d\/([a-zA-Z0-9_-]+)/)[1] : rawId.trim();

    try {
      const payload = {
        action: 'save_settings',
        spreadsheetId: cleanId,
        settings: newSettings
      };
      const blob = new Blob([JSON.stringify(payload)], { type: 'text/plain' });
      const res = await fetch(cleanUrl, { method: 'POST', body: blob, redirect: 'follow' });
      const data = await res.json();
      if (data.status === 'success') {
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message || 'Gagal menyimpan ke spreadsheet.' };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Buat atau pastikan sheet 'Pengaturan_Scanner' dan 'Data_Pengguna' tersedia di Spreadsheet
   */
  async initSheetsInSpreadsheet() {
    const settings = window.storageService.getSettings();
    if (!settings.gasUrl) {
      return { success: false, message: 'URL Web App Google Apps Script belum diisi!' };
    }

    const cleanUrl = settings.gasUrl.trim();
    const rawId = settings.spreadsheetId || '';
    const cleanId = rawId.match(/\/d\/([a-zA-Z0-9_-]+)/) ? rawId.match(/\/d\/([a-zA-Z0-9_-]+)/)[1] : rawId.trim();

    // 1. Coba via POST
    try {
      const payload = {
        action: 'init_sheets',
        spreadsheetId: cleanId
      };
      const blob = new Blob([JSON.stringify(payload)], { type: 'text/plain' });
      const res = await fetch(cleanUrl, { method: 'POST', body: blob, redirect: 'follow' });
      const data = await res.json();
      if (data.status === 'success') {
        return { success: true, message: data.message };
      }
      if (data.message && data.message.includes('Action tidak dikenal')) {
        return {
          success: false,
          needsDeploy: true,
          message: 'Web App Google Apps Script masih menjalankan kode versi lama. Buka script.google.com > ganti kode dengan e-absensi.gs terbaru > Simpan > Deploy Versi Baru (New Version).'
        };
      }
      return { success: false, message: data.message || 'Gagal membuat sheet di spreadsheet.' };
    } catch (_) {}

    // 2. Coba fallback via GET
    try {
      const getUrl = new URL(cleanUrl);
      getUrl.searchParams.set('action', 'init_sheets');
      if (cleanId) getUrl.searchParams.set('spreadsheetId', cleanId);
      getUrl.searchParams.set('_t', Date.now());
      const res = await fetch(getUrl.toString(), { method: 'GET', redirect: 'follow', cache: 'no-cache' });
      const data = await res.json();
      if (data.status === 'success') {
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message || 'Gagal membuat sheet di spreadsheet.' };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }
}

window.syncService = new SyncService();
