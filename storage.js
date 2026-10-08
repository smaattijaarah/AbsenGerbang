/**
 * Local Storage & Cache Manager
 * Offline-first, fast lookup, and student search for manual recording.
 */
class StorageService {
  constructor() {
    this.KEYS = {
      SETTINGS: 'fast_scanner_settings',
      ATTENDANCE: 'fast_scanner_attendance_today',
      MASTER_STUDENTS: 'fast_scanner_students_master',
      LAST_ACTIVE_DATE: 'fast_scanner_active_date',
      AUTH_SESSION: 'fast_scanner_guard_session',
      USERS: 'fast_scanner_app_users',
      POINT_CATEGORIES: 'fast_scanner_point_categories'
    };

    this.defaultSettings = {
      // Guard Security
      guardPin: '1234',
      defaultGuardName: 'Penjaga Sekolah',

      // Time & Violation Rules
      jamMasuk: '07:00',
      jamToleransi: '07:15',
      poinPelanggaran: 5,
      poinTanpaKartu: 5,
      kategoriTerlambat: 'Terlambat hadir di kelas lebih dari 10 menit.',
      kategoriTanpaKartu: 'Tidak membawa ID Card',
      cooldownMinutes: 30,
      soundEnabled: true,
      
      // Firebase
      fbApiKey: '',
      fbDatabaseUrl: '',
      fbProjectId: '',
      fbRootPath: 'presensi_harian',
      
      // Google Sheets / Apps Script
      gasUrl: '',
      spreadsheetId: '1zLU7R4rz2w-qLfHEauvE8s6Q6wYouMe52DBuznkZK74',
      sheetName: 'catatan_poin',
      syncInterval: 5
    };

    this.checkDayRollover();
  }

  getPointCategories() {
    try {
      const raw = localStorage.getItem(this.KEYS.POINT_CATEGORIES);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  savePointCategories(cats) {
    if (Array.isArray(cats)) {
      localStorage.setItem(this.KEYS.POINT_CATEGORIES, JSON.stringify(cats));
    }
  }

  getTodayString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  checkDayRollover() {
    const today = this.getTodayString();
    const lastDate = localStorage.getItem(this.KEYS.LAST_ACTIVE_DATE);
    if (lastDate && lastDate !== today) {
      localStorage.setItem(`fast_scanner_archive_${lastDate}`, localStorage.getItem(this.KEYS.ATTENDANCE) || '[]');
      localStorage.setItem(this.KEYS.ATTENDANCE, '[]');
    }
    localStorage.setItem(this.KEYS.LAST_ACTIVE_DATE, today);
  }

  // --- USER & ADMIN MANAGEMENT (CACHED FROM GOOGLE SHEETS) ---
  getUsers() {
    try {
      const raw = localStorage.getItem(this.KEYS.USERS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return [
      { username: 'admin', name: 'Administrator', pin: '123456', role: 'admin', status: 'Aktif' },
      { username: 'penjaga', name: 'Penjaga Sekolah', pin: '1234', role: 'petugas', status: 'Aktif' }
    ];
  }

  setUsers(usersList) {
    if (Array.isArray(usersList)) {
      localStorage.setItem(this.KEYS.USERS, JSON.stringify(usersList));
    }
  }

  findUser(username, pin) {
    const list = this.getUsers();
    const uClean = String(username || '').trim().toLowerCase();
    const pinClean = String(pin || '').trim();
    return list.find(u => 
      String(u.username || '').toLowerCase() === uClean && 
      String(u.pin || '').trim() === pinClean && 
      String(u.status || 'Aktif').toLowerCase() !== 'nonaktif'
    );
  }

  saveUserLocal(userObj) {
    const list = this.getUsers();
    const targetU = String(userObj.username || '').trim().toLowerCase();
    const idx = list.findIndex(u => String(u.username || '').toLowerCase() === targetU);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...userObj };
    } else {
      list.push(userObj);
    }
    this.setUsers(list);
  }

  deleteUserLocal(username) {
    const targetU = String(username || '').trim().toLowerCase();
    const list = this.getUsers().filter(u => String(u.username || '').toLowerCase() !== targetU);
    this.setUsers(list);
  }

  // --- AUTH SESSION ---
  getGuardSession() {
    try {
      const raw = sessionStorage.getItem(this.KEYS.AUTH_SESSION);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  saveGuardSession(userOrName) {
    let sessionData;
    if (typeof userOrName === 'object' && userOrName !== null) {
      sessionData = {
        username: userOrName.username || 'penjaga',
        guardName: userOrName.name || userOrName.username || 'Petugas',
        role: userOrName.role || 'petugas',
        loginTime: Date.now()
      };
    } else {
      sessionData = {
        username: 'penjaga',
        guardName: userOrName || 'Petugas',
        role: 'petugas',
        loginTime: Date.now()
      };
    }
    sessionStorage.setItem(this.KEYS.AUTH_SESSION, JSON.stringify(sessionData));
  }

  clearGuardSession() {
    sessionStorage.removeItem(this.KEYS.AUTH_SESSION);
  }

  // --- SETTINGS ---
  getSettings() {
    try {
      const raw = localStorage.getItem(this.KEYS.SETTINGS);
      if (!raw) return { ...this.defaultSettings };
      return { ...this.defaultSettings, ...JSON.parse(raw) };
    } catch (e) {
      return { ...this.defaultSettings };
    }
  }

  saveSettings(newSettings) {
    const merged = { ...this.getSettings(), ...newSettings };
    localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(merged));
    return merged;
  }

  // --- ATTENDANCE RECORDS ---
  getTodayRecords() {
    try {
      const raw = localStorage.getItem(this.KEYS.ATTENDANCE);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  saveTodayRecords(records) {
    localStorage.setItem(this.KEYS.ATTENDANCE, JSON.stringify(records));
  }

  addRecord(record) {
    const records = this.getTodayRecords();
    records.unshift(record);
    this.saveTodayRecords(records);
    return records;
  }

  updateRecordSyncStatus(recordId, target, status) {
    const records = this.getTodayRecords();
    const idx = records.findIndex(r => r.id === recordId);
    if (idx !== -1) {
      if (target === 'gas') records[idx].syncedToGas = status;
      if (target === 'firebase') records[idx].syncedToFirebase = status;
      this.saveTodayRecords(records);
    }
  }

  getPendingGasSync() {
    const records = this.getTodayRecords();
    return records.filter(r => !r.syncedToGas);
  }

  markGasSynced(recordIds) {
    const set = new Set(recordIds);
    const records = this.getTodayRecords();
    let changed = false;
    records.forEach(r => {
      if (set.has(r.id) && !r.syncedToGas) {
        r.syncedToGas = true;
        changed = true;
      }
    });
    if (changed) {
      this.saveTodayRecords(records);
    }
  }

  clearTodayRecords() {
    localStorage.setItem(this.KEYS.ATTENDANCE, '[]');
  }

  // --- MASTER STUDENTS (NISN -> { name, class }) ---
  getMasterStudents() {
    try {
      const raw = localStorage.getItem(this.KEYS.MASTER_STUDENTS);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  saveMasterStudents(map) {
    const normalized = { ...map };
    for (const k in map) {
      const clean = String(k).trim();
      const noZero = clean.replace(/^0+/, '');
      if (noZero && !normalized[noZero]) {
        normalized[noZero] = map[k];
      }
      if (clean.length === 9 && !clean.startsWith('0')) {
        normalized['0' + clean] = map[k];
      }
    }
    localStorage.setItem(this.KEYS.MASTER_STUDENTS, JSON.stringify(normalized));
  }

  lookupStudent(nisn) {
    const cleanNisn = String(nisn || '').trim();
    const master = this.getMasterStudents();
    if (master[cleanNisn]) {
      return master[cleanNisn];
    }
    
    // Fallback pencocokan format tanpa 0 di depan (contoh 0104020357 vs 104020357)
    const noLeading = cleanNisn.replace(/^0+/, '');
    if (noLeading && master[noLeading]) {
      return master[noLeading];
    }
    for (const k in master) {
      if (String(k).replace(/^0+/, '') === noLeading) {
        return master[k];
      }
    }

    return {
      name: `Siswa (${cleanNisn})`,
      class: 'Umum / Terdaftar',
      isDefault: true
    };
  }

  /**
   * Search master student by Name or NISN for autocomplete
   */
  searchStudents(query) {
    const q = String(query || '').toLowerCase().trim();
    if (!q) return [];

    const master = this.getMasterStudents();
    const results = [];

    for (const [nisn, info] of Object.entries(master)) {
      const name = (info.name || '').toLowerCase();
      const sClass = (info.class || '').toLowerCase();

      if (nisn.includes(q) || name.includes(q) || sClass.includes(q)) {
        results.push({
          nisn: nisn,
          name: info.name,
          class: info.class || '-'
        });
        if (results.length >= 8) break; // limit to 8 suggestions
      }
    }

    return results;
  }

  importCsvMaster(csvText) {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return 0;

    const master = this.getMasterStudents();
    let count = 0;

    let startIdx = 0;
    const firstLine = lines[0].toLowerCase();
    if (firstLine.includes('nisn') || firstLine.includes('nama')) {
      startIdx = 1;
    }

    for (let i = startIdx; i < lines.length; i++) {
      const parts = lines[i].split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
      if (parts.length >= 1 && parts[0]) {
        const nisn = parts[0];
        const name = parts[1] || `Siswa ${nisn}`;
        const studentClass = parts[2] || '-';
        master[nisn] = { name, class: studentClass };
        count++;
      }
    }

    this.saveMasterStudents(master);
    return count;
  }

  // --- EXPORT TO CSV ---
  exportTodayToCsv() {
    const records = this.getTodayRecords();
    if (records.length === 0) return null;

    const headers = [
      'ID Log',
      'NISN',
      'Nama Siswa',
      'Kelas',
      'Tanggal',
      'Jam Scan',
      'Status Waktu',
      'Bawa Kartu?',
      'Total Poin Pelanggaran',
      'Dicatat Oleh',
      'Status Sync'
    ];

    const rows = records.map(r => [
      `"${r.id}"`,
      `"${r.nisn}"`,
      `"${r.name || ''}"`,
      `"${r.class || ''}"`,
      `"${r.date}"`,
      `"${r.time}"`,
      `"${r.status}"`,
      r.withoutCard ? '"TIDAK_BAWA_KARTU"' : '"BAWA_KARTU"',
      r.points || 0,
      `"${r.guardName || 'Petugas'}"`,
      r.syncedToGas ? 'SUDAH_SYNC' : 'PENDING'
    ]);

    return [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  }
}

window.storageService = new StorageService();
