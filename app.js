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
  const liveDateMobileEl = document.getElementById('liveDateMobile');
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
  const resultClassTag = document.getElementById('resultClassTag');
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
      const isAdmin = (session.role === 'admin');
      const roleBadge = isAdmin ? ' (Admin)' : '';
      activeGuardNameEl.textContent = `Petugas: ${session.guardName}${roleBadge}`;

      // TOMBOL PENGATURAN HANYA DITAMPILKAN UNTUK AKUN ADMIN!
      if (btnOpenSettings) {
        if (isAdmin) {
          btnOpenSettings.classList.remove('hidden');
        } else {
          btnOpenSettings.classList.add('hidden');
        }
      }

      loginScreen.classList.add('hidden');
      mainApp.classList.remove('hidden');
    } else {
      loginScreen.classList.remove('hidden');
      mainApp.classList.add('hidden');
      if (btnOpenSettings) btnOpenSettings.classList.add('hidden');
      loginPin.value = '';
      setTimeout(() => {
        if (!loginUsername.value) loginUsername.focus();
        else loginPin.focus();
      }, 150);
    }
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = document.getElementById('btnLoginSubmit');
    const enteredUsername = loginUsername.value.trim();
    const enteredPin = loginPin.value.trim();

    if (!enteredUsername || !enteredPin) {
      showToast('Masukkan Nama Pengguna dan PIN terlebih dahulu.', 'warning');
      return;
    }

    btnSubmit.disabled = true;
    btnSubmit.style.opacity = '0.7';

    // 1. Cek lokal (offline-first & super cepat)
    let matchedUser = window.storageService.findUser(enteredUsername, enteredPin);

    // 2. Jika tidak ditemukan di lokal, coba verifikasi online ke Google Spreadsheet
    if (!matchedUser && navigator.onLine) {
      try {
        const onlineUser = await window.syncService.authenticateOnline(enteredUsername, enteredPin);
        if (onlineUser) {
          matchedUser = onlineUser;
        }
      } catch (_) {}
    }

    btnSubmit.disabled = false;
    btnSubmit.style.opacity = '1';

    if (matchedUser) {
      window.storageService.saveGuardSession(matchedUser);
      const roleTitle = matchedUser.role === 'admin' ? 'Administrator' : 'Petugas';
      showToast(`Selamat bertugas, ${matchedUser.name || matchedUser.username}! (${roleTitle})`, 'success');
      loginPin.value = '';
      checkAuth();
      // Sinkronkan daftar pengguna terbaru jika online
      if (navigator.onLine) {
        window.syncService.fetchUsersFromSpreadsheet().then(() => renderUserTableUI());
      }
    } else {
      showToast('Nama Pengguna atau PIN salah. Silakan periksa kembali.', 'error');
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
    const formattedDate = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
    liveDateEl.textContent = formattedDate;
    if (liveDateMobileEl) liveDateMobileEl.textContent = formattedDate;
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

    const cfgGuardPinEl = document.getElementById('cfgGuardPin');
    if (cfgGuardPinEl) cfgGuardPinEl.value = settings.guardPin || '1234';
    const cfgDefaultGuardNameEl = document.getElementById('cfgDefaultGuardName');
    if (cfgDefaultGuardNameEl) cfgDefaultGuardNameEl.value = settings.defaultGuardName || 'Penjaga Sekolah';
    renderUserTableUI();

    document.getElementById('cfgGasUrl').value = settings.gasUrl || '';
    document.getElementById('cfgSpreadsheetId').value = settings.spreadsheetId || '';
    document.getElementById('cfgSheetName').value = settings.sheetName || 'catatan_poin';

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
      else if (r.status === 'Terlambat' || r.status === 'Kesiangan') late++;
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
      const isLate = (r.status === 'Terlambat' || r.status === 'Kesiangan');
      const initial = (r.name || 'S').charAt(0).toUpperCase();

      let badges = '';
      if (r.withoutCard) {
        badges += `<span class="tag-label without-card">⚠️ Tanpa Kartu</span>`;
      }
      if (isLate) {
        badges += `<span class="tag-label late">⏰ Terlambat (+${r.points}p)</span>`;
      } else {
        badges += `<span class="tag-label ontime">✅ Tepat Waktu</span>`;
      }

      return `
        <li class="clean-student-item">
          <div class="student-identity">
            <div class="student-initial">${initial}</div>
            <div>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <div class="student-name-text" style="font-weight: 700; color: #f8fafc;">${r.name || 'Siswa'}</div>
                <span class="class-badge" style="background: rgba(14, 165, 233, 0.16); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.35); padding: 1px 7px; border-radius: 5px; font-size: 0.76rem; font-weight: 700;">Kelas: ${r.class || '-'}</span>
              </div>
              <div class="student-sub-text">
                <span>NISN: ${r.nisn}</span>
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

  function calculateLateMinutes(currentTimeStr, targetTimeStr) {
    try {
      const [ch, cm] = currentTimeStr.split(':').map(Number);
      const [th, tm] = (targetTimeStr || '07:00').split(':').map(Number);
      const diff = (ch * 60 + cm) - (th * 60 + tm);
      return Math.max(1, diff);
    } catch (_) {
      return 10;
    }
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
    const statusText = isLate ? 'Terlambat' : 'Tepat Waktu';
    const points = isLate ? (parseInt(settings.poinPelanggaran, 10) || 5) : 0;

    const tipe = isLate ? 'Pelanggaran' : 'Hadir';
    const keterangan = isLate 
      ? (settings.kategoriTerlambat || 'Terlambat hadir di kelas lebih dari 10 menit.') 
      : 'Tepat Waktu';

    const studentInfo = window.storageService.lookupStudent(cleanNisn);
    const guardSession = window.storageService.getGuardSession();
    const guardUsername = guardSession ? (guardSession.username || guardSession.guardName) : 'admin1';
    const guardName = guardSession ? guardSession.guardName : 'Penjaga';
    const waktuInput = `${todayStr} ${currentTimeStr}`;

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
      type: tipe,
      status: statusText,
      keterangan: keterangan,
      withoutCard: false,
      points: points,
      guardName: guardName,
      guardUsername: guardUsername,
      waktuInput: waktuInput,
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
      pointsText: isLate ? `⚠️ Pelanggaran Terlambat: +${points} Poin` : '',
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
      resultStatusTag.textContent = (info.status || 'TERLAMBAT').toUpperCase();
    } else if (info.type === 'late') {
      scanResultCard.classList.add('late-warning');
      resultIcon.textContent = '⏰';
      resultStatusTag.textContent = 'TERLAMBAT';
    } else {
      resultIcon.textContent = '✅';
      resultStatusTag.textContent = 'TEPAT WAKTU';
    }

    if (resultClassTag) {
      resultClassTag.textContent = `Kelas: ${info.class || '-'}`;
    }

    if (info.withoutCard) {
      resultCardStatusTag.classList.remove('hidden');
    } else {
      resultCardStatusTag.classList.add('hidden');
    }

    resultTimeText.textContent = getCurrentTimeString();
    resultStudentName.textContent = info.name || `Siswa (${info.nisn})`;
    resultSubInfo.innerHTML = `Kelas: <strong style="color: var(--cyan); font-weight: 700;">${info.class || '-'}</strong> • NISN: ${info.nisn}`;
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
    previewTimeStatus.textContent = isLate ? 'Terlambat' : 'Tepat Waktu';
    previewPoinLate.textContent = isLate ? `+${poinLate} Poin` : '0 Poin';
    previewPoinLate.className = `point-tag ${isLate ? 'warning' : 'ontime'}`;
    previewTotalPoints.textContent = `${totalPoin} Poin Pelanggaran`;

    const selectViolationCategory = document.getElementById('selectViolationCategory');
    if (selectViolationCategory) {
      const katTerlambat = settings.kategoriTerlambat || 'Terlambat hadir di kelas lebih dari 10 menit.';
      const katTanpaKartu = settings.kategoriTanpaKartu || 'Tidak membawa ID Card';
      const comboText = `${katTerlambat}. ${katTanpaKartu}`;

      selectViolationCategory.innerHTML = `
        <option value="${katTanpaKartu}">${katTanpaKartu}</option>
        <option value="${katTerlambat}">${katTerlambat}</option>
        <option value="${comboText}">${comboText}</option>
      `;

      if (isLate) {
        selectViolationCategory.value = comboText;
      } else {
        selectViolationCategory.value = katTanpaKartu;
      }
    }
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
    const statusText = isLate ? 'Terlambat' : 'Tepat Waktu';

    const poinCard = parseInt(settings.poinTanpaKartu, 10) || 5;
    const poinLate = isLate ? (parseInt(settings.poinPelanggaran, 10) || 5) : 0;
    const totalPoints = poinCard + poinLate;

    const selectViolationCategory = document.getElementById('selectViolationCategory');
    const tipe = 'Pelanggaran';
    const katTerlambat = settings.kategoriTerlambat || 'Terlambat hadir di kelas lebih dari 10 menit.';
    const katTanpaKartu = settings.kategoriTanpaKartu || 'Tidak membawa ID Card';
    const defaultKet = isLate ? `${katTerlambat}. ${katTanpaKartu}` : katTanpaKartu;
    const keterangan = selectViolationCategory && selectViolationCategory.value
      ? selectViolationCategory.value
      : defaultKet;

    const guardSession = window.storageService.getGuardSession();
    const guardUsername = guardSession ? (guardSession.username || guardSession.guardName) : 'admin1';
    const guardName = guardSession ? guardSession.guardName : 'Penjaga';
    const waktuInput = `${todayStr} ${currentTimeStr}`;

    window.soundEngine.playLate();

    const newRecord = {
      id: `manual_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      nisn: nisn,
      name: name,
      class: sClass,
      timestamp: now.getTime(),
      date: todayStr,
      time: currentTimeStr,
      type: tipe,
      status: statusText,
      keterangan: keterangan,
      withoutCard: true,
      points: totalPoints,
      guardName: guardName,
      guardUsername: guardUsername,
      waktuInput: waktuInput,
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
      pointsText: `⚠️ Tidak Bawa Kartu (+${poinCard}p)${isLate ? ` & Terlambat (+${poinLate}p)` : ''} = Total ${totalPoints} Poin`,
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

  function populatePointCategoryDropdowns() {
    const s = window.storageService.getSettings();
    const categories = window.storageService.getPointCategories();

    const selTerlambat = document.getElementById('cfgKategoriTerlambat');
    const selTanpaKartu = document.getElementById('cfgKategoriTanpaKartu');

    if (selTerlambat) {
      const defaultTerlambat = s.kategoriTerlambat || 'Terlambat hadir di kelas lebih dari 10 menit.';
      let optionsHtml = '';
      let foundDefault = false;

      categories.forEach(cat => {
        const isSelected = (cat.name === defaultTerlambat);
        if (isSelected) foundDefault = true;
        optionsHtml += `<option value="${cat.name}" data-points="${cat.points}" ${isSelected ? 'selected' : ''}>${cat.name} (${cat.points} Poin)</option>`;
      });

      if (!foundDefault) {
        optionsHtml = `<option value="${defaultTerlambat}" data-points="${s.poinPelanggaran || 5}" selected>${defaultTerlambat} (${s.poinPelanggaran || 5} Poin)</option>` + optionsHtml;
      }
      selTerlambat.innerHTML = optionsHtml;
    }

    if (selTanpaKartu) {
      const defaultTanpaKartu = s.kategoriTanpaKartu || 'Tidak membawa ID Card';
      let optionsHtml = '';
      let foundDefault = false;

      categories.forEach(cat => {
        const isSelected = (cat.name === defaultTanpaKartu);
        if (isSelected) foundDefault = true;
        optionsHtml += `<option value="${cat.name}" data-points="${cat.points}" ${isSelected ? 'selected' : ''}>${cat.name} (${cat.points} Poin)</option>`;
      });

      if (!foundDefault) {
        optionsHtml = `<option value="${defaultTanpaKartu}" data-points="${s.poinTanpaKartu || 5}" selected>${defaultTanpaKartu} (${s.poinTanpaKartu || 5} Poin)</option>` + optionsHtml;
      }
      selTanpaKartu.innerHTML = optionsHtml;
    }
  }

  function applySettingsUI() {
    const s = window.storageService.getSettings();
    if (displayBatasJamEl) displayBatasJamEl.textContent = s.jamMasuk || '07:00';
    if (displayToleransiEl) displayToleransiEl.textContent = s.jamToleransi || '07:15';
    if (displayPoinEl) displayPoinEl.textContent = s.poinPelanggaran || 5;
    if (displayPoinTanpaKartuEl) displayPoinTanpaKartuEl.textContent = s.poinTanpaKartu || 5;

    // Form inputs
    const inJamMasuk = document.getElementById('cfgJamMasuk');
    const inJamToleransi = document.getElementById('cfgJamToleransi');
    const inPoinPelanggaran = document.getElementById('cfgPoinPelanggaran');
    const inPoinTanpaKartu = document.getElementById('cfgPoinTanpaKartu');
    const inCooldown = document.getElementById('cfgCooldownScan');
    const inGasUrl = document.getElementById('cfgGasUrl');
    const inSpreadsheetId = document.getElementById('cfgSpreadsheetId');
    const inSheetName = document.getElementById('cfgSheetName');
    const inFbApiKey = document.getElementById('cfgFbApiKey');
    const inFbDatabaseUrl = document.getElementById('cfgFbDatabaseUrl');
    const inFbProjectId = document.getElementById('cfgFbProjectId');

    if (inJamMasuk) inJamMasuk.value = s.jamMasuk || '07:00';
    if (inJamToleransi) inJamToleransi.value = s.jamToleransi || '07:15';
    if (inPoinPelanggaran) inPoinPelanggaran.value = s.poinPelanggaran || 5;
    if (inPoinTanpaKartu) inPoinTanpaKartu.value = s.poinTanpaKartu || 5;
    if (inCooldown) inCooldown.value = s.cooldownMinutes || 30;
    if (inGasUrl) inGasUrl.value = s.gasUrl || '';
    if (inSpreadsheetId) inSpreadsheetId.value = s.spreadsheetId || '';
    if (inSheetName) inSheetName.value = s.sheetName || 'catatan_poin';
    if (inFbApiKey) inFbApiKey.value = s.fbApiKey || '';
    if (inFbDatabaseUrl) inFbDatabaseUrl.value = s.fbDatabaseUrl || '';
    if (inFbProjectId) inFbProjectId.value = s.fbProjectId || '';

    if (masterCountEl) {
      masterCountEl.textContent = Object.keys(window.storageService.getMasterStudents()).length;
    }

    populatePointCategoryDropdowns();
    renderUserTableUI();
  }

  // Change listener for point categories
  const selTerlambatEl = document.getElementById('cfgKategoriTerlambat');
  if (selTerlambatEl) {
    selTerlambatEl.addEventListener('change', () => {
      const opt = selTerlambatEl.selectedOptions[0];
      if (opt && opt.dataset.points) {
        const inPoin = document.getElementById('cfgPoinPelanggaran');
        if (inPoin) inPoin.value = opt.dataset.points;
      }
    });
  }

  const selTanpaKartuEl = document.getElementById('cfgKategoriTanpaKartu');
  if (selTanpaKartuEl) {
    selTanpaKartuEl.addEventListener('change', () => {
      const opt = selTanpaKartuEl.selectedOptions[0];
      if (opt && opt.dataset.points) {
        const inPoin = document.getElementById('cfgPoinTanpaKartu');
        if (inPoin) inPoin.value = opt.dataset.points;
      }
    });
  }

  // Button fetch point categories from konfigurasi_poin
  const btnFetchPointCategories = document.getElementById('btnFetchPointCategories');
  if (btnFetchPointCategories) {
    btnFetchPointCategories.addEventListener('click', async () => {
      btnFetchPointCategories.disabled = true;
      btnFetchPointCategories.textContent = '⏳ Memuat dari sheet...';
      try {
        const res = await window.syncService.fetchPointCategoriesFromSpreadsheet();
        if (res.success) {
          showToast(`Berhasil memuat ${res.count} kategori poin dari sheet '${res.sheetName}'!`, 'success');
          populatePointCategoryDropdowns();
        } else {
          showToast(res.message || 'Gagal memuat kategori poin dari spreadsheet.', 'error');
        }
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
      } finally {
        btnFetchPointCategories.disabled = false;
        btnFetchPointCategories.textContent = '🔄 Muat Kategori dari Sheet \'konfigurasi_poin\'';
      }
    });
  }

  btnOpenSettings.addEventListener('click', () => {
    const session = window.storageService.getGuardSession();
    if (session && session.role === 'admin') {
      applySettingsUI();
      settingsModal.classList.remove('hidden');
    } else {
      showToast('Akses ditolak: Menu Pengaturan hanya tersedia untuk akun Administrator.', 'error');
    }
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

    const cfgGuardPinEl = document.getElementById('cfgGuardPin');
    const cfgDefaultGuardNameEl = document.getElementById('cfgDefaultGuardName');
    const selTerlambat = document.getElementById('cfgKategoriTerlambat');
    const selTanpaKartu = document.getElementById('cfgKategoriTanpaKartu');

    const newSettings = {
      jamMasuk: document.getElementById('cfgJamMasuk').value,
      jamToleransi: document.getElementById('cfgJamToleransi').value,
      poinPelanggaran: parseInt(document.getElementById('cfgPoinPelanggaran').value, 10) || 5,
      poinTanpaKartu: parseInt(document.getElementById('cfgPoinTanpaKartu').value, 10) || 5,
      kategoriTerlambat: selTerlambat ? selTerlambat.value : 'Terlambat hadir di kelas lebih dari 10 menit.',
      kategoriTanpaKartu: selTanpaKartu ? selTanpaKartu.value : 'Tidak membawa ID Card',
      cooldownMinutes: parseInt(document.getElementById('cfgCooldownScan').value, 10) || 30,

      guardPin: cfgGuardPinEl ? cfgGuardPinEl.value.trim() : '1234',
      defaultGuardName: cfgDefaultGuardNameEl ? cfgDefaultGuardNameEl.value.trim() : 'Penjaga Sekolah',

      gasUrl: document.getElementById('cfgGasUrl').value.trim(),
      spreadsheetId: cleanSheetId,
      sheetName: document.getElementById('cfgSheetName').value.trim() || 'catatan_poin',

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

  const btnFetchStudentsSpreadsheet = document.getElementById('btnFetchStudentsSpreadsheet');
  if (btnFetchStudentsSpreadsheet) {
    btnFetchStudentsSpreadsheet.addEventListener('click', async () => {
      btnFetchStudentsSpreadsheet.disabled = true;
      btnFetchStudentsSpreadsheet.textContent = '⏳ Mengambil data siswa dari Spreadsheet...';
      try {
        const res = await window.syncService.fetchStudentsFromSpreadsheet();
        if (res.success) {
          showToast(`Berhasil menarik ${res.count} data siswa dari tab '${res.sheetName}'!`, 'success');
          applySettingsUI();
        } else {
          showToast(res.message || 'Gagal menarik data siswa dari spreadsheet.', 'error');
        }
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
      } finally {
        btnFetchStudentsSpreadsheet.disabled = false;
        btnFetchStudentsSpreadsheet.textContent = '📥 Tarik Data Siswa dari Spreadsheet (Otomatis)';
      }
    });
  }

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
    if (res.success) {
      window.syncService.fetchStudentsFromSpreadsheet().then(sRes => {
        if (sRes && sRes.success) {
          showToast(`Berhasil memuat ${sRes.count} data siswa dari tab '${sRes.sheetName}'!`, 'success');
          if (masterCountEl) masterCountEl.textContent = sRes.count;
        }
      });
      window.syncService.fetchPointCategoriesFromSpreadsheet().then(pRes => {
        if (pRes && pRes.success) {
          showToast(`Berhasil memuat ${pRes.count} kategori poin dari sheet '${pRes.sheetName}'!`, 'info');
          populatePointCategoryDropdowns();
        }
      });
    }
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

  // --- USER & ADMIN MANAGEMENT (GOOGLE SHEETS) ---
  function renderUserTableUI() {
    const tbody = document.getElementById('userListTableBody');
    if (!tbody) return;
    const users = window.storageService.getUsers();
    tbody.innerHTML = '';

    if (users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="padding: 12px; text-align: center; color: var(--text-dim);">Belum ada data akun terdaftar.</td></tr>`;
      return;
    }

    users.forEach(u => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
      const roleBadge = u.role === 'admin' 
        ? `<span style="background: rgba(139, 92, 246, 0.2); color: #c084fc; padding: 2px 7px; border-radius: 4px; font-weight: 600; font-size: 0.75rem;">ADMIN</span>`
        : `<span style="background: rgba(56, 189, 248, 0.15); color: var(--cyan); padding: 2px 7px; border-radius: 4px; font-weight: 600; font-size: 0.75rem;">PETUGAS</span>`;

      const statusColor = (u.status || 'Aktif') === 'Aktif' ? 'var(--emerald)' : 'var(--rose)';

      tr.innerHTML = `
        <td style="padding: 8px 10px; font-family: var(--font-mono); font-weight: 600;">${u.username}</td>
        <td style="padding: 8px 10px;">${u.name || '-'}</td>
        <td style="padding: 8px 10px;">${roleBadge}</td>
        <td style="padding: 8px 10px; color: ${statusColor}; font-weight: 500;">${u.status || 'Aktif'}</td>
        <td style="padding: 8px 10px; text-align: right;">
          <button type="button" class="btn-edit-user" data-username="${u.username}" style="background: transparent; border: none; color: var(--cyan); cursor: pointer; padding: 4px 6px; font-size: 0.8rem;">✏️ Edit</button>
          <button type="button" class="btn-delete-user" data-username="${u.username}" style="background: transparent; border: none; color: var(--rose); cursor: pointer; padding: 4px 6px; font-size: 0.8rem;">🗑️ Hapus</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Attach Edit listeners
    tbody.querySelectorAll('.btn-edit-user').forEach(btn => {
      btn.addEventListener('click', () => {
        const uname = btn.dataset.username;
        const u = window.storageService.getUsers().find(x => x.username === uname);
        if (u) {
          document.getElementById('uFormUsername').value = u.username;
          document.getElementById('uFormName').value = u.name || '';
          document.getElementById('uFormPin').value = u.pin || '';
          document.getElementById('uFormRole').value = u.role || 'petugas';
          document.getElementById('formUserTitle').textContent = `✏️ Edit Akun: ${u.username}`;
          document.getElementById('uFormPin').focus();
        }
      });
    });

    // Attach Delete listeners
    tbody.querySelectorAll('.btn-delete-user').forEach(btn => {
      btn.addEventListener('click', async () => {
        const uname = btn.dataset.username;
        const users = window.storageService.getUsers();
        const admins = users.filter(x => x.role === 'admin');
        const target = users.find(x => x.username === uname);

        if (target && target.role === 'admin' && admins.length <= 1) {
          showToast('Tidak dapat menghapus satu-satunya akun Administrator!', 'error');
          return;
        }

        if (confirm(`Yakin ingin menghapus akun "${uname}" dari spreadsheet?`)) {
          showToast(`Menghapus akun "${uname}"...`, 'info');
          const res = await window.syncService.deleteUserFromSpreadsheet(uname);
          showToast(res.message || 'Akun berhasil dihapus.', res.success ? 'success' : 'error');
          renderUserTableUI();
        }
      });
    });
  }

  const btnFetchUsers = document.getElementById('btnFetchUsersSpreadsheet');
  if (btnFetchUsers) {
    btnFetchUsers.addEventListener('click', async () => {
      btnFetchUsers.disabled = true;
      btnFetchUsers.textContent = 'Memuat...';
      const res = await window.syncService.fetchUsersFromSpreadsheet();
      btnFetchUsers.disabled = false;
      btnFetchUsers.textContent = '🔄 Tarik dari Spreadsheet';
      if (res.success) {
        showToast(`Berhasil memuat ${res.count} akun pengguna dari spreadsheet!`, 'success');
        renderUserTableUI();
      } else {
        showToast(`Gagal memuat: ${res.message}`, 'error');
      }
    });
  }

  const btnSaveUserSpreadsheet = document.getElementById('btnSaveUserSpreadsheet');
  if (btnSaveUserSpreadsheet) {
    btnSaveUserSpreadsheet.addEventListener('click', async () => {
      const username = document.getElementById('uFormUsername').value.trim();
      const name = document.getElementById('uFormName').value.trim() || username;
      const pin = document.getElementById('uFormPin').value.trim();
      const role = document.getElementById('uFormRole').value;

      if (!username) {
        showToast('Username wajib diisi!', 'warning');
        return;
      }
      if (!pin || pin.length < 3) {
        showToast('PIN minimal 3 karakter!', 'warning');
        return;
      }

      btnSaveUserSpreadsheet.disabled = true;
      btnSaveUserSpreadsheet.textContent = 'Menyimpan...';

      const userObj = { username, name, pin, role, status: 'Aktif' };
      const res = await window.syncService.saveUserToSpreadsheet(userObj);

      btnSaveUserSpreadsheet.disabled = false;
      btnSaveUserSpreadsheet.textContent = '💾 Simpan Akun ke Spreadsheet';

      showToast(res.message || 'Akun berhasil disimpan!', res.success ? 'success' : 'error');

      // Reset form
      document.getElementById('uFormUsername').value = '';
      document.getElementById('uFormName').value = '';
      document.getElementById('uFormPin').value = '';
      document.getElementById('uFormRole').value = 'petugas';
      document.getElementById('formUserTitle').textContent = '➕ Tambah / Edit Akun Pengguna';

      renderUserTableUI();
    });
  }

  const btnResetUserForm = document.getElementById('btnResetUserForm');
  if (btnResetUserForm) {
    btnResetUserForm.addEventListener('click', () => {
      document.getElementById('uFormUsername').value = '';
      document.getElementById('uFormName').value = '';
      document.getElementById('uFormPin').value = '';
      document.getElementById('uFormRole').value = 'petugas';
      document.getElementById('formUserTitle').textContent = '➕ Tambah / Edit Akun Pengguna';
    });
  }

  // Init
  checkAuth();
  applySettingsUI();
  renderAttendanceUI();

  // Auto-sync master data siswa & kategori poin dari Spreadsheet jika belum ada data di lokal
  setTimeout(async () => {
    try {
      const currentMaster = window.storageService.getMasterStudents();
      if (Object.keys(currentMaster).length === 0) {
        const sRes = await window.syncService.fetchStudentsFromSpreadsheet();
        if (sRes && sRes.success && masterCountEl) {
          masterCountEl.textContent = sRes.count;
        }
      }
      const currentCats = window.storageService.getPointCategories();
      if (!currentCats || currentCats.length <= 2) {
        const pRes = await window.syncService.fetchPointCategoriesFromSpreadsheet();
        if (pRes && pRes.success) {
          populatePointCategoryDropdowns();
        }
      }
    } catch (_) {}
  }, 1200);
});
