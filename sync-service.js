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

        // Google Apps Script doPost is best sent with text/plain to prevent CORS preflight OPTIONS rejection
        const response = await fetch(settings.gasUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          },
          body: JSON.stringify(payload),
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
   */
  async testGasConnection() {
    const settings = window.storageService.getSettings();
    if (!settings.gasUrl) {
      return { success: false, message: 'URL Web App GAS belum diisi.' };
    }

    try {
      const testPayload = {
        action: 'ping',
        spreadsheetId: settings.spreadsheetId || '',
        sheetName: settings.sheetName || 'Presensi_Masuk',
        timestamp: Date.now()
      };

      const res = await fetch(settings.gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(testPayload),
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
        message: `Gagal memanggil GAS: ${e.message}. Pastikan Web App di-deploy dengan akses 'Anyone' (Siapa saja).` 
      };
    }
  }
}

window.syncService = new SyncService();
