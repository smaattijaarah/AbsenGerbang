/**
 * Main Application Orchestrator for School Guard Kiosk
 * Clean, focused, instant latency (< 15ms), with manual 'Without Card' recording.
 */
document.addEventListener('DOMContentLoaded', () => {
  // --- 1. DOM Elements ---
  const loginScreen = document.getElementById('loginScreen');
  const mainApp = document.getElementById('mainApp');
  const loginForm = document.getElementById('loginForm');
  const loginUsername = document.getElementById('loginUsername');
  const loginPin = document.getElementById('loginPin');
  const activeGuardNameEl = document.getElementById('activeGuardName');
  const btnLogout = document.getElementById('btnLogout');

  // Clocks & Header
  const liveTimeEl = document.getElementById('liveTime');
  const liveDateEl = document.getElementById('liveDate');
  const headerSyncStatus = document.getElementById('headerSyncStatus');
  const pendingSyncCountEl = document.getElementById('pendingSyncCount');
  const btnSoundToggle = document.getElementById('btnSoundToggle');
  const soundStatusEmoji = document.getElementById('soundStatusEmoji');
  const btnOpenSettings = document.getElementById('btnOpenSettings');

  // Scanner & Views
  const tabUsb = document.getElementById('tabUsb');
  const tabCamera = document.getElementById('tabCamera');
  const usbScannerView = document.getElementById('usbScannerView');
  const cameraScannerView = document.getElementById('cameraScannerView');
  const manualNisnInput = document.getElementById('manualNisnInput');
  const btnSwitchCamera = document.getElementById('btnSwitchCamera');
  const btnStopCamera = document.getElementById('btnStopCamera');

  // Rules Footer
  const displayBatasJamEl = document.getElementById('displayBatasJam');
  const displayToleransiEl = document.getElementById('displayToleransi');
  const displayPoinEl = document.getElementById('displayPoin');
  const displayPoinTanpaKartuEl = document.getElementById('displayPoinTanpaKartu');

  // Result Banner
  const scanResultCard = document.getElementById('scanResultCard');
  const resultIcon = document.getElementById('resultIcon');
  const resultStatusTag = document.getElementById('resultStatusTag');
  const resultCardStatusTag = document.getElementById('resultCardStatusTag');
  const resultTimeText = document.getElementById('resultTimeText');
  const resultStudentName = document.getElementById('resultStudentName');
  const resultSubInfo = document.getElementById('resultSubInfo');
  const resultPointsAlert = document.getElementById('resultPointsAlert');
  const resultSpeed = document.getElementById('resultSpeed');

  // Attendance List & Counters
  const countTotalEl = document.getElementById('countTotal');
  const countOnTimeEl = document.getElementById('countOnTime');
  const countLateEl = document.getElementById('countLate');
  const countWithoutCardEl = document.getElementById('countWithoutCard');
  const attendanceList = document.getElementById('attendanceList');
  const searchHistoryInput = document.getElementById('searchHistoryInput');

  // 'Without Card' Modal Elements
  const btnOpenManualWithoutCard = document.getElementById('btnOpenManualWithoutCard');
  const manualWithoutCardModal = document.getElementById('manualWithoutCardModal');
  const btnCloseWithoutCardModal = document.getElementById('btnCloseWithoutCardModal');
  const btnCancelWithoutCard = document.getElementById('btnCancelWithoutCard');
  const formWithoutCard = document.getElementById('formWithoutCard');
  const inputSearchStudent = document.getElementById('inputSearchStudent');
  const studentSuggestions = document.getElementById('studentSuggestions');
  const previewStudentName = document.getElementById('previewStudentName');
  const previewStudentDetails = document.getElementById('previewStudentDetails');
  const selectedNisn = document.getElementById('selectedNisn');
  const selectedName = document.getElementById('selectedName');
  const selectedClass = document.getElementById('selectedClass');
  const previewPoinTanpaKartu = document.getElementById('previewPoinTanpaKartu');
  const previewTimeStatus = document.getElementById('previewTimeStatus');
  const previewPoinLate = document.getElementById('previewPoinLate');
  const previewTotalPoints = document.getElementById('previewTotalPoints');

  // Settings Modal Elements
  const settingsModal = document.getElementById('settingsModal');
  const btnCloseSettings = document.getElementById('btnCloseSettings');
  const btnSaveSettings = document.getElementById('btnSaveSettings');
  const btnExportCsv = document.getElementById('btnExportCsv');
  const btnTestGas = document.getElementById('btnTestGas');
  const btnTestFirebase = document.getElementById('btnTestFirebase');
  const btnSaveMasterData = document.getElementById('btnSaveMasterData');
  const cfgCsvMasterInput = document.getElementById('cfgCsvMasterInput');
  const cfgCsvMasterText = document.getElementById('cfgCsvMasterText');
  const masterCountEl = document.getElementById('masterCount');
  const toastContainer = document.getElementById('toastContainer');

  let bannerTimeout = null;

  // --- 2. Authentication & Guard Session ---
  function checkAuth() {
    const session = window.storageService.getGuardSession();
    if (session && session.guardName) {
      activeGuardNameEl.textContent = `Petugas: ${session.guardName}`;
      loginScreen.classList.add('hidden');
      mainApp.classList.remove('hidden');
    } else {
      loginScreen.classList.remove('hidden');
      mainApp.classList.add('hidden');
      loginPin.value = '';
      setTimeout(() => loginPin.focus(), 150);
    }
  }

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const settings = window.storageService.getSettings();
    const enteredPin = loginPin.value.trim();
    const expectedPin = String(settings.guardPin || '1234').trim();

    if (enteredPin === expectedPin) {
      const name = loginUsername.value.trim() || 'Penjaga Sekolah';
      window.storageService.saveGuardSession(name);
      showToast(`Selamat bertugas, ${name}!`, 'success');
      checkAuth();
    } else {
      showToast('PIN yang Anda masukkan salah. Coba lagi.', 'error');
      loginPin.select();
    }
  });

  btnLogout.addEventListener('click', () => {
    if (confirm('Keluar dari pos presensi penjaga?')) {
      window.storageService.clearGuardSession();
      checkAuth();
      showToast('Anda telah keluar dari aplikasi.', 'info');
    }
  });

  // --- 3. Live Clock & Time Helper ---
  function getCurrentTimeString() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  function updateClock() {
    const now = new Date();
    liveTimeEl.textContent = getCurrentTimeString();

    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    liveDateEl.textContent = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  }
  setInterval(updateClock, 1000);
  updateClock();

  // Toast
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'warning') icon = '⚠️';
    if (type === 'error') icon = '❌';

    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // --- 4. Refresh Settings UI ---
  function applySettingsUI() {
    const settings = window.storageService.getSettings();
    displayBatasJamEl.textContent = settings.jamMasuk || '07:00';
    displayToleransiEl.textContent = settings.jamToleransi || '07:15';
    displayPoinEl.textContent = settings.poinPelanggaran || 5;
    displayPoinTanpaKartuEl.textContent = settings.poinTanpaKartu || 5;

    // Fill settings modal
    document.getElementById('cfgJamMasuk').value = settings.jamMasuk || '07:00';
    document.getElementById('cfgJamToleransi').value = settings.jamToleransi || '07:15';
    document.getElementById('cfgPoinPelanggaran').value = settings.poinPelanggaran || 5;
    document.getElementById('cfgPoinTanpaKartu').value = settings.poinTanpaKartu || 5;
    document.getElementById('cfgCooldownScan').value = settings.cooldownMinutes || 30;

    document.getElementById('cfgGuardPin').value = settings.guardPin || '1234';
    document.getElementById('cfgDefaultGuardName').value = settings.defaultGuardName || 'Penjaga Sekolah';

    document.getElementById('cfgGasUrl').value = settings.gasUrl || '';
    document.getElementById('cfgSpreadsheetId').value = settings.spreadsheetId || '';
    document.getElementById('cfgSheetName').value = settings.sheetName || 'Presensi_Masuk';

    document.getElementById('cfgFbApiKey').value = settings.fbApiKey || '';
    document.getElementById('cfgFbDatabaseUrl').value = settings.fbDatabaseUrl || '';
    document.getElementById('cfgFbProjectId').value = settings.fbProjectId || '';

    // Master student count
    const master = window.storageService.getMasterStudents();
    masterCountEl.textContent = Object.keys(master).length;

    // Sound
    if (window.soundEngine) {
      window.soundEngine.enabled = settings.soundEnabled !== false;
      soundStatusEmoji.textContent = window.soundEngine.enabled ? '🔊' : '🔇';
    }
  }

  // --- 5. Render Attendance List ---
  function renderAttendanceUI(filterQuery = '') {
    const records = window.storageService.getTodayRecords();
    
    let total = records.length;
    let onTime = 0;
    let late = 0;
    let withoutCard = 0;

    records.forEach(r => {
      if (r.withoutCard) withoutCard++;
      if (r.status === 'Tepat Waktu') onTime++;
      else if (r.status === 'Kesiangan') late++;
    });

    countTotalEl.textContent = total;
    countOnTimeEl.textContent = onTime;
    countLateEl.textContent = late;
    countWithoutCardEl.textContent = withoutCard;

    let filtered = records;
    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase();
      filtered = records.filter(r => 
        (r.nisn && r.nisn.toLowerCase().includes(q)) ||
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.class && r.class.toLowerCase().includes(q))
      );
    }

    if (filtered.length === 0) {
      attendanceList.innerHTML = `
        <li class="empty-notice">
          <span class="empty-emoji">📋</span>
          <p>${filterQuery ? 'Tidak ada siswa yang cocok dengan pencarian.' : 'Belum ada siswa yang hadir hari ini.'}</p>
          <small>Scan kartu atau catat manual untuk memulai.</small>
        </li>
      `;
      return;
    }

    attendanceList.innerHTML = filtered.map(r => {
      const isLate = r.status === 'Kesiangan';
      const initial = (r.name || 'S').charAt(0).toUpperCase();

      let badges = '';
      if (r.withoutCard) {
        badges += `<span class="tag-label without-card">⚠️ Tanpa Kartu</span>`;
      }
      if (isLate) {
        badges += `<span class="tag-label late">⏰ Kesiangan (+${r.points}p)</span>`;
      } else {
        badges += `<span class="tag-label ontime">✅ Tepat Waktu</span>`;
      }

      return `
        <li class="clean-student-item">
          <div class="student-identity">
            <div class="student-initial">${initial}</div>
            <div>
              <div class="student-name-text">${r.name || 'Siswa'}</div>
              <div class="student-sub-text">
                <span>NISN: ${r.nisn}</span> • ${r.class || '-'}
              </div>
            </div>
          </div>
          <div class="student-meta-right">
            <div class="scan-time-badge">${r.time}</div>
            <div style="display: flex; gap: 4px;">${badges}</div>
          </div>
        </li>
      `;
    }).join('');
  }

  // --- 6. Core Scan Execution ---
  function onCodeScanned(code, source = 'usb_hardware') {
    const startTime = performance.now();
    const cleanNisn = String(code || '').trim();
    if (!cleanNisn) return;

    const settings = window.storageService.getSettings();
    const records = window.storageService.getTodayRecords();
    const now = new Date();
    const currentTimeStr = getCurrentTimeString();
    const todayStr = window.storageService.getTodayString();

    // Prevent duplicate scan within cooldown window
    const cooldownMs = (parseInt(settings.cooldownMinutes, 10) || 30) * 60 * 1000;
    const existing = records.find(r => r.nisn === cleanNisn && (now.getTime() - r.timestamp < cooldownMs));

    if (existing) {
      window.soundEngine.playDuplicate();
      showResultBanner({
        nisn: cleanNisn,
        name: existing.name,
        class: existing.class,
        status: 'Sudah Absen',
        type: 'duplicate',
        withoutCard: existing.withoutCard,
        meta: `Sudah scan kehadiran pukul ${existing.time}`,
        pointsText: '',
        durationMs: Math.round(performance.now() - startTime)
      });
      return;
    }

    // Determine On-Time vs Late
    const toleransiLimit = (settings.jamToleransi || '07:15') + ':00';
    const isLate = currentTimeStr > toleransiLimit;
    const statusText = isLate ? 'Kesiangan' : 'Tepat Waktu';
    const points = isLate ? (parseInt(settings.poinPelanggaran, 10) || 5) : 0;

    const studentInfo = window.storageService.lookupStudent(cleanNisn);
    const guardSession = window.storageService.getGuardSession();
    const guardName = guardSession ? guardSession.guardName : 'Penjaga';

    // Play Audio
    if (isLate) {
      window.soundEngine.playLate();
    } else {
      window.soundEngine.playSuccess();
    }

    const newRecord = {
      id: `scan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      nisn: cleanNisn,
      name: studentInfo.name,
      class: studentInfo.class,
      timestamp: now.getTime(),
      date: todayStr,
      time: currentTimeStr,
      status: statusText,
      withoutCard: false,
      points: points,
      guardName: guardName,
      syncedToGas: false,
      syncedToFirebase: false,
      source: source
    };

    // Instant local save
    window.storageService.addRecord(newRecord);

    const execTimeMs = Math.round(performance.now() - startTime);

    // Show Result Banner
    showResultBanner({
      nisn: cleanNisn,
      name: studentInfo.name,
      class: studentInfo.class,
      status: statusText,
      type: isLate ? 'late' : 'ontime',
      withoutCard: false,
      meta: `Pukul ${currentTimeStr} • Kelas: ${studentInfo.class}`,
      pointsText: isLate ? `⚠️ Pelanggaran Kesiangan: +${points} Poin` : '',
      durationMs: execTimeMs
    });

    renderAttendanceUI(searchHistoryInput.value);

    // Save Firebase & Sync GAS
    window.firebaseService.saveScan(newRecord).then(ok => {
      if (ok) window.storageService.updateRecordSyncStatus(newRecord.id, 'firebase', true);
    });
    window.syncService.syncPendingToGas();
  }

  function showResultBanner(info) {
    if (bannerTimeout) clearTimeout(bannerTimeout);

    scanResultCard.classList.remove('hidden', 'late-warning', 'without-card-alert', 'duplicate-alert');

    if (info.type === 'duplicate') {
      scanResultCard.classList.add('duplicate-alert');
      resultIcon.textContent = '⚠️';
      resultStatusTag.textContent = 'SUDAH SCAN';
    } else if (info.withoutCard) {
      scanResultCard.classList.add('without-card-alert');
      resultIcon.textContent = '⚠️';
      resultStatusTag.textContent = info.status.toUpperCase();
    } else if (info.type === 'late') {
      scanResultCard.classList.add('late-warning');
      resultIcon.textContent = '⏰';
      resultStatusTag.textContent = 'KESIANGAN';
    } else {
      resultIcon.textContent = '✅';
      resultStatusTag.textContent = 'TEPAT WAKTU';
    }

    if (info.withoutCard) {
      resultCardStatusTag.classList.remove('hidden');
    } else {
      resultCardStatusTag.classList.add('hidden');
    }

    resultTimeText.textContent = getCurrentTimeString();
    resultStudentName.textContent = info.name;
    resultSubInfo.textContent = `NISN: ${info.nisn} • ${info.meta}`;
    resultPointsAlert.textContent = info.pointsText || '';
    resultSpeed.textContent = `${info.durationMs}ms`;

    bannerTimeout = setTimeout(() => {
      scanResultCard.classList.add('hidden');
    }, 5500);
  }

  // --- 7. Manual Recording: SISWA TIDAK MEMBAWA KARTU ---
  function updateWithoutCardPreview() {
    const settings = window.storageService.getSettings();
    const currentTimeStr = getCurrentTimeString();
    const toleransiLimit = (settings.jamToleransi || '07:15') + ':00';
    const isLate = currentTimeStr > toleransiLimit;

    const poinCard = parseInt(settings.poinTanpaKartu, 10) || 5;
    const poinLate = isLate ? (parseInt(settings.poinPelanggaran, 10) || 5) : 0;
    const totalPoin = poinCard + poinLate;

    previewPoinTanpaKartu.textContent = `+${poinCard} Poin`;
    previewTimeStatus.textContent = isLate ? 'Kesiangan' : 'Tepat Waktu';
    previewPoinLate.textContent = isLate ? `+${poinLate} Poin` : '0 Poin';
    previewPoinLate.className = `point-tag ${isLate ? 'warning' : 'ontime'}`;
    previewTotalPoints.textContent = `${totalPoin} Poin Pelanggaran`;
  }

  btnOpenManualWithoutCard.addEventListener('click', () => {
    inputSearchStudent.value = '';
    studentSuggestions.classList.add('hidden');
    selectedNisn.value = '';
    selectedName.value = '';
    selectedClass.value = '';
    previewStudentName.textContent = 'Pilih siswa dari pencarian di atas';
    previewStudentDetails.textContent = 'NISN: - • Kelas: -';

    updateWithoutCardPreview();
    manualWithoutCardModal.classList.remove('hidden');
    setTimeout(() => inputSearchStudent.focus(), 100);
  });

  btnCloseWithoutCardModal.addEventListener('click', () => {
    manualWithoutCardModal.classList.add('hidden');
  });
  btnCancelWithoutCard.addEventListener('click', () => {
    manualWithoutCardModal.classList.add('hidden');
  });

  // Autocomplete search
  inputSearchStudent.addEventListener('input', (e) => {
    const q = e.target.value.trim();
    if (q.length < 2) {
      studentSuggestions.classList.add('hidden');
      return;
    }

    const matches = window.storageService.searchStudents(q);
    if (matches.length === 0) {
      studentSuggestions.innerHTML = `
        <div class="suggestion-item" style="cursor: default; color: #94a3b8;">
          <span>Siswa tidak ditemukan di master data. Anda tetap bisa simpan manual dengan menekan Enter.</span>
        </div>
      `;
      studentSuggestions.classList.remove('hidden');
      return;
    }

    studentSuggestions.innerHTML = matches.map(s => `
      <div class="suggestion-item" data-nisn="${s.nisn}" data-name="${s.name}" data-class="${s.class}">
        <span class="sug-name">${s.name}</span>
        <span class="sug-meta">NISN: ${s.nisn} • ${s.class}</span>
      </div>
    `).join('');

    studentSuggestions.classList.remove('hidden');
  });

  // Suggestion item click
  studentSuggestions.addEventListener('click', (e) => {
    const item = e.target.closest('.suggestion-item');
    if (!item || !item.dataset.nisn) return;

    selectedNisn.value = item.dataset.nisn;
    selectedName.value = item.dataset.name;
    selectedClass.value = item.dataset.class;

    previewStudentName.textContent = item.dataset.name;
    previewStudentDetails.textContent = `NISN: ${item.dataset.nisn} • Kelas: ${item.dataset.class}`;

    inputSearchStudent.value = `${item.dataset.name} (${item.dataset.nisn})`;
    studentSuggestions.classList.add('hidden');
  });

  // Submit Without Card
  formWithoutCard.addEventListener('submit', (e) => {
    e.preventDefault();
    const startTime = performance.now();
    let nisn = selectedNisn.value.trim();
    let name = selectedName.value.trim();
    let sClass = selectedClass.value.trim();

    // If user typed custom NISN or name directly without selecting from dropdown
    if (!nisn) {
      const typed = inputSearchStudent.value.trim();
      if (!typed) {
        showToast('Ketik nama atau NISN siswa', 'warning');
        return;
      }
      // Check if typed string is numbers (NISN)
      if (/^\d+$/.test(typed)) {
        nisn = typed;
        const lookup = window.storageService.lookupStudent(nisn);
        name = lookup.name;
        sClass = lookup.class;
      } else {
        nisn = 'MANUAL_' + Date.now().toString().slice(-6);
        name = typed;
        sClass = 'Umum';
      }
    }

    const settings = window.storageService.getSettings();
    const now = new Date();
    const currentTimeStr = getCurrentTimeString();
    const todayStr = window.storageService.getTodayString();

    const toleransiLimit = (settings.jamToleransi || '07:15') + ':00';
    const isLate = currentTimeStr > toleransiLimit;
    const statusText = isLate ? 'Kesiangan' : 'Tepat Waktu';

    const poinCard = parseInt(settings.poinTanpaKartu, 10) || 5;
    const poinLate = isLate ? (parseInt(settings.poinPelanggaran, 10) || 5) : 0;
    const totalPoints = poinCard + poinLate;

    const guardSession = window.storageService.getGuardSession();
    const guardName = guardSession ? guardSession.guardName : 'Penjaga';

    window.soundEngine.playLate();

    const newRecord = {
      id: `manual_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      nisn: nisn,
      name: name,
      class: sClass,
      timestamp: now.getTime(),
      date: todayStr,
      time: currentTimeStr,
      status: statusText,
      withoutCard: true,
      points: totalPoints,
      guardName: guardName,
      syncedToGas: false,
      syncedToFirebase: false,
      source: 'manual_without_card'
    };

    window.storageService.addRecord(newRecord);
    manualWithoutCardModal.classList.add('hidden');

    const execTimeMs = Math.round(performance.now() - startTime);

    showResultBanner({
      nisn: nisn,
      name: name,
      class: sClass,
      status: statusText,
      type: 'without_card',
      withoutCard: true,
      meta: `Kelas: ${sClass} • Pukul ${currentTimeStr}`,
      pointsText: `⚠️ Tidak Bawa Kartu (+${poinCard}p)${isLate ? ` & Kesiangan (+${poinLate}p)` : ''} = Total ${totalPoints} Poin`,
      durationMs: execTimeMs
    });

    renderAttendanceUI(searchHistoryInput.value);
    showToast(`Presensi tanpa kartu atas nama ${name} berhasil dicatat!`, 'success');

    window.firebaseService.saveScan(newRecord).then(ok => {
      if (ok) window.storageService.updateRecordSyncStatus(newRecord.id, 'firebase', true);
    });
    window.syncService.syncPendingToGas();
  });

  // --- 8. Hardware USB Scanner & Camera ---
  const scanner = new window.ScannerEngine(onCodeScanned);

  tabUsb.addEventListener('click', () => {
    tabUsb.classList.add('active');
    tabCamera.classList.remove('active');
    usbScannerView.classList.remove('hidden');
    cameraScannerView.classList.add('hidden');
    scanner.stopCamera();
  });

  tabCamera.addEventListener('click', async () => {
    tabCamera.classList.add('active');
    tabUsb.classList.remove('active');
    usbScannerView.classList.add('hidden');
    cameraScannerView.classList.remove('hidden');

    try {
      await scanner.startCamera('qrReader');
    } catch (e) {
      showToast(e.message || 'Kamera tidak dapat diakses', 'error');
      tabUsb.click();
    }
  });

  btnSwitchCamera.addEventListener('click', () => scanner.switchCamera());
  btnStopCamera.addEventListener('click', () => tabUsb.click());

  // --- 9. Sync & Firebase Listeners ---
  window.firebaseService.init();

  async function triggerManualSync() {
    const isOnline = navigator.onLine;
    if (!isOnline) {
      const pending = window.storageService.getPendingGasSync();
      showToast(`Mode Offline: ${pending.length} data tersimpan aman di komputer ini dan tidak akan hilang. Data akan disinkronkan otomatis saat ada koneksi internet.`, 'warning');
      return;
    }

    const settings = window.storageService.getSettings();
    if (!settings.gasUrl) {
      showToast('URL Google Apps Script belum diisi di Pengaturan (⚙️). Silakan atur terlebih dahulu.', 'warning');
      return;
    }

    const pending = window.storageService.getPendingGasSync();
    if (pending.length === 0) {
      showToast('Semua data presensi hari ini sudah tersinkron ke Google Sheets!', 'success');
      return;
    }

    showToast(`Memulai sinkronisasi manual ${pending.length} data ke spreadsheet E-Absensi...`, 'info');
    const result = await window.syncService.syncPendingToGas(true);

    if (result.status === 'success') {
      const sheetName = settings.sheetName || 'Presensi_Masuk';
      showToast(`Sukses! ${result.count} data presensi telah masuk ke sheet "${sheetName}". Jam scan siswa asli tetap terjaga!`, 'success');
    } else if (result.status === 'gas_error') {
      showToast(`Gagal mencatat ke Spreadsheet: ${result.error}. Data tetap aman di antrean lokal.`, 'error');
    } else if (result.status === 'network_error') {
      showToast(`Gagal menghubungi Google Apps Script: ${result.error}. Data tetap aman di antrean lokal.`, 'error');
    }
  }

  // Click badge in header to trigger immediate manual sync
  headerSyncStatus.addEventListener('click', triggerManualSync);

  // Auto sync when re-gaining internet connection
  window.addEventListener('online', () => {
    showToast('Koneksi internet terhubung kembali! Menyinkronkan antrean data ke Google Sheets...', 'info');
    window.syncService.syncPendingToGas(true);
  });

  window.addEventListener('offline', () => {
    showToast('Koneksi internet terputus. Mode offline aktif (Scan tetap cepat, data aman tersimpan lokal).', 'warning');
    const pending = window.storageService.getPendingGasSync();
    headerSyncStatus.className = 'status-indicator offline';
    headerSyncStatus.innerHTML = `📡 Offline (${pending.length}) • Klik sync`;
  });

  window.syncService.onUpdate((stat) => {
    const isOnline = navigator.onLine;
    if (stat.isSyncing) {
      headerSyncStatus.className = 'status-indicator syncing';
      headerSyncStatus.innerHTML = `⏳ Syncing ke Sheets... (${stat.pendingCount})`;
    } else if (!isOnline) {
      headerSyncStatus.className = 'status-indicator offline';
      headerSyncStatus.innerHTML = `📡 Offline (${stat.pendingCount}) • Klik sync`;
    } else if (stat.pendingCount > 0) {
      headerSyncStatus.className = 'status-indicator pending';
      headerSyncStatus.innerHTML = `🔄 ${stat.pendingCount} Antrean • Klik sync`;
    } else {
      headerSyncStatus.className = 'status-indicator synced';
      headerSyncStatus.innerHTML = `☁️ Sheets: Tersinkron (0)`;
    }
  });

  window.syncService.startAutoSync();

  // --- 10. Sound Toggle ---
  btnSoundToggle.addEventListener('click', () => {
    const isNowOn = window.soundEngine.toggleSound();
    window.storageService.saveSettings({ soundEnabled: isNowOn });
    soundStatusEmoji.textContent = isNowOn ? '🔊' : '🔇';
    showToast(isNowOn ? 'Suara scanner diaktifkan' : 'Suara scanner dimatikan', 'info');
  });

  // Search History
  searchHistoryInput.addEventListener('input', (e) => {
    renderAttendanceUI(e.target.value);
  });

  // Settings Tabs & Modal
  const settingTabs = document.querySelectorAll('.setting-tab-btn');
  settingTabs.forEach(t => {
    t.addEventListener('click', () => {
      settingTabs.forEach(tab => tab.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      t.classList.add('active');
      const pane = document.getElementById(t.dataset.tab);
      if (pane) pane.classList.add('active');
    });
  });

  btnOpenSettings.addEventListener('click', () => {
    applySettingsUI();
    settingsModal.classList.remove('hidden');
  });
  btnCloseSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));

  // Helper untuk membersihkan dan mengekstrak ID Spreadsheet dari URL atau teks
  function extractSpreadsheetId(input) {
    if (!input) return '';
    const trimmed = input.trim();
    const match = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return match[1];
    }
    return trimmed;
  }

  const cfgSpreadsheetIdInput = document.getElementById('cfgSpreadsheetId');
  if (cfgSpreadsheetIdInput) {
    cfgSpreadsheetIdInput.addEventListener('input', () => {
      const extracted = extractSpreadsheetId(cfgSpreadsheetIdInput.value);
      if (extracted !== cfgSpreadsheetIdInput.value && extracted.length > 15) {
        cfgSpreadsheetIdInput.value = extracted;
      }
    });
  }

  btnSaveSettings.addEventListener('click', () => {
    const rawSheetId = document.getElementById('cfgSpreadsheetId').value;
    const cleanSheetId = extractSpreadsheetId(rawSheetId);
    if (cleanSheetId !== rawSheetId) {
      document.getElementById('cfgSpreadsheetId').value = cleanSheetId;
    }

    const newSettings = {
      jamMasuk: document.getElementById('cfgJamMasuk').value,
      jamToleransi: document.getElementById('cfgJamToleransi').value,
      poinPelanggaran: parseInt(document.getElementById('cfgPoinPelanggaran').value, 10) || 5,
      poinTanpaKartu: parseInt(document.getElementById('cfgPoinTanpaKartu').value, 10) || 5,
      cooldownMinutes: parseInt(document.getElementById('cfgCooldownScan').value, 10) || 30,

      guardPin: document.getElementById('cfgGuardPin').value.trim() || '1234',
      defaultGuardName: document.getElementById('cfgDefaultGuardName').value.trim() || 'Penjaga Sekolah',

      gasUrl: document.getElementById('cfgGasUrl').value.trim(),
      spreadsheetId: cleanSheetId,
      sheetName: document.getElementById('cfgSheetName').value.trim() || 'Presensi_Masuk',

      fbApiKey: document.getElementById('cfgFbApiKey').value.trim(),
      fbDatabaseUrl: document.getElementById('cfgFbDatabaseUrl').value.trim(),
      fbProjectId: document.getElementById('cfgFbProjectId').value.trim()
    };

    window.storageService.saveSettings(newSettings);
    applySettingsUI();
    window.firebaseService.init();
    window.syncService.startAutoSync();

    settingsModal.classList.add('hidden');
    showToast('Pengaturan berhasil disimpan!', 'success');
  });

  // Master Data CSV Import
  btnSaveMasterData.addEventListener('click', () => {
    const txt = cfgCsvMasterText.value;
    if (!txt.trim()) {
      showToast('Tempelkan teks data siswa CSV terlebih dahulu', 'warning');
      return;
    }
    const count = window.storageService.importCsvMaster(txt);
    cfgCsvMasterText.value = '';
    applySettingsUI();
    showToast(`Berhasil menyimpan ${count} data siswa ke memori!`, 'success');
  });

  cfgCsvMasterInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const count = window.storageService.importCsvMaster(evt.target.result);
      applySettingsUI();
      showToast(`Berhasil mengimpor ${count} siswa dari file CSV!`, 'success');
    };
    reader.readAsText(file);
  });

  // Export CSV
  btnExportCsv.addEventListener('click', () => {
    const csv = window.storageService.exportTodayToCsv();
    if (!csv) {
      showToast('Belum ada data hadir hari ini untuk diekspor', 'warning');
      return;
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Presensi_Siswa_${window.storageService.getTodayString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('File CSV berhasil diunduh', 'success');
  });

  // Tests
  btnTestGas.addEventListener('click', async () => {
    btnTestGas.textContent = 'Memeriksa...';
    btnTestGas.disabled = true;

    const rawSheetId = document.getElementById('cfgSpreadsheetId').value;
    const cleanSheetId = extractSpreadsheetId(rawSheetId);
    if (cleanSheetId !== rawSheetId) {
      document.getElementById('cfgSpreadsheetId').value = cleanSheetId;
    }

    window.storageService.saveSettings({
      gasUrl: document.getElementById('cfgGasUrl').value.trim(),
      spreadsheetId: cleanSheetId,
      sheetName: document.getElementById('cfgSheetName').value.trim()
    });
    const res = await window.syncService.testGasConnection();
    showToast(res.message, res.success ? 'success' : 'error');
    btnTestGas.textContent = '🧪 Test Koneksi E-Absensi';
    btnTestGas.disabled = false;
  });

  const btnSettingsManualSync = document.getElementById('btnSettingsManualSync');
  if (btnSettingsManualSync) {
    btnSettingsManualSync.addEventListener('click', async () => {
      const rawSheetId = document.getElementById('cfgSpreadsheetId').value;
      const cleanSheetId = extractSpreadsheetId(rawSheetId);
      if (cleanSheetId !== rawSheetId) {
        document.getElementById('cfgSpreadsheetId').value = cleanSheetId;
      }

      window.storageService.saveSettings({
        gasUrl: document.getElementById('cfgGasUrl').value.trim(),
        spreadsheetId: cleanSheetId,
        sheetName: document.getElementById('cfgSheetName').value.trim()
      });
      await triggerManualSync();
    });
  }

  btnTestFirebase.addEventListener('click', async () => {
    btnTestFirebase.textContent = 'Menghubungkan...';
    btnTestFirebase.disabled = true;
    window.storageService.saveSettings({
      fbApiKey: document.getElementById('cfgFbApiKey').value.trim(),
      fbDatabaseUrl: document.getElementById('cfgFbDatabaseUrl').value.trim(),
      fbProjectId: document.getElementById('cfgFbProjectId').value.trim()
    });
    const res = await window.firebaseService.testConnection();
    showToast(res.message, res.success ? 'success' : 'error');
    btnTestFirebase.textContent = 'Test Koneksi Firebase';
    btnTestFirebase.disabled = false;
  });

  // Init
  checkAuth();
  applySettingsUI();
  renderAttendanceUI();
});
