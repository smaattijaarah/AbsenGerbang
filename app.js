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

    // 1. Cek lokal (offline-first, periksa password, hari piket, dan batas 2 perangkat)
    let loginResult = window.storageService.validateUserLogin(enteredUsername, enteredPin);

    // 2. Jika tidak ditemukan di lokal dan sedang online, verifikasi ke Spreadsheet
    if (!loginResult.success && loginResult.reason === 'not_found' && navigator.onLine) {
      try {
        const onlineRes = await window.syncService.authenticateOnline(enteredUsername, enteredPin);
        if (onlineRes && onlineRes.success && onlineRes.user) {
          loginResult = window.storageService.validateUserLogin(enteredUsername, enteredPin);
        } else if (onlineRes && !onlineRes.success && onlineRes.message) {
          loginResult = { success: false, message: onlineRes.message };
        }
      } catch (_) {}
    }

    btnSubmit.disabled = false;
    btnSubmit.style.opacity = '1';

    if (loginResult.success && loginResult.user) {
      const matchedUser = loginResult.user;
      window.storageService.saveGuardSession(matchedUser);
      const roleTitle = matchedUser.role === 'admin' ? 'Administrator' : 'Petugas';
      showToast(`Selamat bertugas, ${matchedUser.name || matchedUser.username}! (${roleTitle})`, 'success');
      loginPin.value = '';
      checkAuth();
      // Sinkronkan daftar pengguna & simpan pendaftaran perangkat ke Spreadsheet jika online
      if (navigator.onLine) {
        window.syncService.saveUserToSpreadsheet(matchedUser).then(() => {
          window.syncService.fetchUsersFromSpreadsheet().then(() => renderUserTableUI());
        });
      }
    } else {
      showToast(loginResult.message || 'Nama Pengguna atau PIN salah. Silakan periksa kembali.', 'error');
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
    let pulang = 0;
    let withoutCard = 0;

    records.forEach(r => {
      if (r.withoutCard) withoutCard++;
      if (r.status === 'Tepat Waktu') onTime++;
      else if (r.status === 'Terlambat' || r.status === 'Kesiangan') late++;
      else if (r.status === 'Pulang' || r.type === 'Pulang') pulang++;
    });

    const countPulangEl = document.getElementById('countPulang');
    if (countPulangEl) countPulangEl.textContent = pulang;

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




  // --- Presence Mode Switching (Masuk vs Pulang) ---
  const btnModeMasuk = document.getElementById('btnModeMasuk');
  const btnModePulang = document.getElementById('btnModePulang');
  const pillModeMasuk = document.getElementById('pillModeMasuk');
  const pillModePulang = document.getElementById('pillModePulang');
  const subModeMasuk = document.getElementById('subModeMasuk');
  const subModePulang = document.getElementById('subModePulang');

  function updateScanModeUI() {
    const mode = window.storageService.getScanMode();
    const s = window.storageService.getSettings();

    if (btnModeMasuk && btnModePulang) {
      if (mode === 'pulang') {
        btnModeMasuk.classList.remove('active');
        btnModePulang.classList.add('active');
        if (pillModeMasuk) { pillModeMasuk.className = 'mode-status-pill off'; pillModeMasuk.textContent = 'Non-Aktif'; }
        if (pillModePulang) { pillModePulang.className = 'mode-status-pill on'; pillModePulang.textContent = 'Aktif (0 Poin)'; }
      } else {
        btnModeMasuk.classList.add('active');
        btnModePulang.classList.remove('active');
        if (pillModeMasuk) { pillModeMasuk.className = 'mode-status-pill on'; pillModeMasuk.textContent = 'Aktif'; }
        if (pillModePulang) { pillModePulang.className = 'mode-status-pill off'; pillModePulang.textContent = 'Bebas Poin'; }
      }
    }

    if (subModeMasuk) {
      subModeMasuk.textContent = `Buka: ${s.jamMasukMulai || '06:00'} • Batas: ${s.jamToleransi || '06:40'} • Tutup: ${s.jamMasukSelesai || '08:00'}`;
    }
    if (subModePulang) {
      subModePulang.textContent = `Mulai: ${s.jamPulangMulai || '15:00'} • Tutup: ${s.jamPulangSelesai || '18:00'} (0 Poin)`;
    }

    // Update status badge di atas scanner
    const scannerModeIndicatorText = document.getElementById('scannerModeIndicatorText');
    const statusDotPulse = document.querySelector('.status-dot-pulse');
    if (scannerModeIndicatorText) {
      if (mode === 'pulang') {
        scannerModeIndicatorText.textContent = 'Mode: Keluar (0 Poin)';
        if (statusDotPulse) {
          statusDotPulse.style.background = '#818cf8';
          statusDotPulse.style.boxShadow = '0 0 8px #818cf8';
        }
      } else {
        scannerModeIndicatorText.textContent = 'Mode: Masuk';
        if (statusDotPulse) {
          statusDotPulse.style.background = '#10b981';
          statusDotPulse.style.boxShadow = '0 0 8px #10b981';
        }
      }
    }

    // Rules footer update
    const rfItem1 = document.getElementById('rfItem1');
    const rfItem2 = document.getElementById('rfItem2');
    const rfItem3 = document.getElementById('rfItem3');
    const rfItem4 = document.getElementById('rfItem4');

    if (rfItem1 && rfItem2 && rfItem3 && rfItem4) {
      if (mode === 'pulang') {
        rfItem1.innerHTML = `Buka Pulang: <strong>${s.jamPulangMulai || '15:00'}</strong>`;
        rfItem2.innerHTML = `Tutup: <strong>${s.jamPulangSelesai || '18:00'}</strong>`;
        rfItem3.innerHTML = `Aturan Poin: <strong>0 Poin</strong>`;
        rfItem4.innerHTML = `Status: <strong style="color: #818cf8;">Bebas Sanksi</strong>`;
      } else {
        rfItem1.innerHTML = `Buka Masuk: <strong>${s.jamMasukMulai || '06:00'}</strong>`;
        rfItem2.innerHTML = `Toleransi: <strong>${s.jamToleransi || '06:40'}</strong>`;
        rfItem3.innerHTML = `Tutup: <strong>${s.jamMasukSelesai || '08:00'}</strong>`;
        rfItem4.innerHTML = `Terlambat: <strong>${s.poinPelanggaran || 1}</strong> Poin`;
      }
    }
  }

  if (btnModeMasuk) {
    btnModeMasuk.addEventListener('click', () => {
      window.storageService.saveScanMode('masuk');
      updateScanModeUI();
      showToast('🌅 Mode aktif: Presensi Masuk', 'info');
    });
  }

  if (btnModePulang) {
    btnModePulang.addEventListener('click', () => {
      window.storageService.saveScanMode('pulang');
      updateScanModeUI();
      showToast('🌇 Mode aktif: Presensi Keluar', 'info');
    });
  }

  function onCodeScanned(code, source = 'usb_hardware') {
    const startTime = performance.now();
    const cleanNisn = String(code || '').trim();
    if (!cleanNisn) return;

    const settings = window.storageService.getSettings();
    const records = window.storageService.getTodayRecords();
    const now = new Date();
    const currentTimeStr = getCurrentTimeString();
    const curHM = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const todayStr = window.storageService.getTodayString();
    const mode = window.storageService.getScanMode(); // 'masuk' or 'pulang'

    const studentInfo = window.storageService.lookupStudent(cleanNisn);
    const guardSession = window.storageService.getGuardSession();
    const guardUsername = guardSession ? (guardSession.username || guardSession.guardName) : 'admin1';
    const guardName = guardSession ? guardSession.guardName : 'Penjaga';
    const waktuInput = `${todayStr} ${currentTimeStr}`;

    // ==========================================
    // 1. VALIDASI JADWAL & STATUS: MODE PULANG
    // ==========================================
    if (mode === 'pulang') {
      const jamBukaPulang = settings.jamPulangMulai || '15:00';
      const jamTutupPulang = settings.jamPulangSelesai || '18:00';

      // Cek sebelum jam buka pulang
      if (curHM < jamBukaPulang) {
        window.soundEngine.playDuplicate();
        showResultBanner({
          nisn: cleanNisn,
          name: studentInfo.name,
          class: studentInfo.class,
          status: 'Belum Dibuka',
          type: 'late',
          withoutCard: false,
          meta: `Presensi Pulang baru dibuka pukul ${jamBukaPulang} WIB!`,
          pointsText: 'Belum waktunya pulang',
          durationMs: Math.round(performance.now() - startTime)
        });
        return;
      }

      // Cek setelah jam tutup pulang
      if (curHM > jamTutupPulang) {
        window.soundEngine.playDuplicate();
        showResultBanner({
          nisn: cleanNisn,
          name: studentInfo.name,
          class: studentInfo.class,
          status: 'Presensi Selesai',
          type: 'late',
          withoutCard: false,
          meta: `Presensi Pulang telah berakhir pukul ${jamTutupPulang} WIB.`,
          pointsText: 'Jadwal pulang telah lewat',
          durationMs: Math.round(performance.now() - startTime)
        });
        return;
      }

      // Cegah scan pulang 2x sehari (1 Hari 1x Pulang)
      if (settings.lockOncePerDay !== false) {
        const alreadyPulang = records.find(r => r.nisn === cleanNisn && (r.mode === 'pulang' || r.type === 'Pulang'));
        if (alreadyPulang) {
          window.soundEngine.playDuplicate();
          window.soundEngine.speakStudent(alreadyPulang.name || studentInfo.name, 'duplicate');
          showResultBanner({
            nisn: cleanNisn,
            name: alreadyPulang.name,
            class: alreadyPulang.class,
            status: 'Sudah Pulang',
            type: 'duplicate',
            withoutCard: alreadyPulang.withoutCard,
            meta: `Siswa sudah presensi pulang hari ini pukul ${alreadyPulang.time} WIB`,
            pointsText: '',
            durationMs: Math.round(performance.now() - startTime)
          });
          return;
        }
      }

      // Pulang Berhasil: Selalu Tepat & 0 Poin
      window.soundEngine.playPulang();
      window.soundEngine.speakStudent(studentInfo.name, 'pulang');

      const newRecord = {
        id: `scan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        nisn: cleanNisn,
        name: studentInfo.name,
        class: studentInfo.class,
        timestamp: now.getTime(),
        date: todayStr,
        time: currentTimeStr,
        mode: 'pulang',
        type: 'Pulang',
        status: 'Pulang',
        keterangan: 'Presensi Pulang Sekolah',
        withoutCard: false,
        points: 0,
        guardName: guardName,
        guardUsername: guardUsername,
        waktuInput: waktuInput,
        syncedToGas: false,
        syncedToFirebase: false,
        source: source
      };

      window.storageService.addRecord(newRecord);
      const execTimeMs = Math.round(performance.now() - startTime);

      showResultBanner({
        nisn: cleanNisn,
        name: studentInfo.name,
        class: studentInfo.class,
        status: 'Presensi Pulang',
        type: 'ontime',
        withoutCard: false,
        meta: `Pukul ${currentTimeStr} • Bebas Poin (0 Poin)`,
        pointsText: '🏠 Selamat Pulang!',
        durationMs: execTimeMs
      });

      renderAttendanceUI(searchHistoryInput.value);
      window.firebaseService.saveScan(newRecord).then(ok => {
        if (ok) window.storageService.updateRecordSyncStatus(newRecord.id, 'firebase', true);
      });
      window.syncService.syncPendingToGas();
      return;
    }

    // ==========================================
    // 2. VALIDASI JADWAL & STATUS: MODE MASUK
    // ==========================================
    const jamBukaMasuk = settings.jamMasukMulai || '06:00';
    const jamToleransi = settings.jamToleransi || '06:40';
    const jamTutupMasuk = settings.jamMasukSelesai || '08:00';

    // Cek sebelum jam buka masuk
    if (curHM < jamBukaMasuk) {
      window.soundEngine.playDuplicate();
      showResultBanner({
        nisn: cleanNisn,
        name: studentInfo.name,
        class: studentInfo.class,
        status: 'Belum Dibuka',
        type: 'late',
        withoutCard: false,
        meta: `Presensi Masuk baru dibuka pukul ${jamBukaMasuk} WIB!`,
        pointsText: 'Belum jam buka presensi',
        durationMs: Math.round(performance.now() - startTime)
      });
      return;
    }

    // Cek setelah jam tutup masuk
    if (curHM > jamTutupMasuk) {
      window.soundEngine.playDuplicate();
      showResultBanner({
        nisn: cleanNisn,
        name: studentInfo.name,
        class: studentInfo.class,
        status: 'Presensi Ditutup',
        type: 'late',
        withoutCard: false,
        meta: `Gerbang Presensi Masuk sudah ditutup pukul ${jamTutupMasuk} WIB!`,
        pointsText: 'Waktu presensi masuk berakhir',
        durationMs: Math.round(performance.now() - startTime)
      });
      return;
    }

    // Cegah scan masuk 2x sehari (1 Hari 1x Masuk)
    if (settings.lockOncePerDay !== false) {
      const alreadyMasuk = records.find(r => r.nisn === cleanNisn && (r.mode === 'masuk' || (!r.mode && r.type !== 'Pulang')));
      if (alreadyMasuk) {
        window.soundEngine.playDuplicate();
        window.soundEngine.speakStudent(alreadyMasuk.name || studentInfo.name, 'duplicate');
        showResultBanner({
          nisn: cleanNisn,
          name: alreadyMasuk.name,
          class: alreadyMasuk.class,
          status: 'Sudah Absen Masuk',
          type: 'duplicate',
          withoutCard: alreadyMasuk.withoutCard,
          meta: `Siswa sudah presensi masuk hari ini pukul ${alreadyMasuk.time} WIB`,
          pointsText: '',
          durationMs: Math.round(performance.now() - startTime)
        });
        return;
      }
    }

    // Tentukan Tepat Waktu vs Terlambat
    const isLate = (curHM > jamToleransi);
    const statusText = isLate ? 'Terlambat' : 'Tepat Waktu';
    const points = isLate ? (parseInt(settings.poinPelanggaran, 10) || 1) : 0;
    const tipe = isLate ? 'Pelanggaran' : 'Hadir';
    const keterangan = isLate 
      ? (settings.kategoriTerlambat || 'Terlambat hadir di sekolah lebih dari 10 menit.') 
      : 'Tepat Waktu';

    // Play Audio
    if (isLate) {
      window.soundEngine.playLate();
      window.soundEngine.speakStudent(studentInfo.name, 'late');
    } else {
      window.soundEngine.playSuccess();
      window.soundEngine.speakStudent(studentInfo.name, 'success');
    }

    const newRecord = {
      id: `scan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      nisn: cleanNisn,
      name: studentInfo.name,
      class: studentInfo.class,
      timestamp: now.getTime(),
      date: todayStr,
      time: currentTimeStr,
      mode: 'masuk',
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

    window.storageService.addRecord(newRecord);
    const execTimeMs = Math.round(performance.now() - startTime);

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
      resultStatusTag.textContent = (info.status || 'SUDAH SCAN').toUpperCase();
      resultStatusTag.style.background = '';
    } else if (info.status === 'Pulang' || info.status === 'Presensi Pulang') {
      resultIcon.textContent = '🏠';
      resultStatusTag.textContent = 'PULANG (0 POIN)';
      resultStatusTag.style.background = 'linear-gradient(135deg, #6366f1, #4f46e5)';
    } else if (info.withoutCard) {
      scanResultCard.classList.add('without-card-alert');
      resultIcon.textContent = '⚠️';
      resultStatusTag.textContent = (info.status || 'TERLAMBAT').toUpperCase();
      resultStatusTag.style.background = '';
    } else if (info.type === 'late') {
      scanResultCard.classList.add('late-warning');
      resultIcon.textContent = '⏰';
      resultStatusTag.textContent = 'TERLAMBAT';
      resultStatusTag.style.background = '';
    } else {
      resultIcon.textContent = '✅';
      resultStatusTag.textContent = 'TEPAT WAKTU';
      resultStatusTag.style.background = '';
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

    const mode = window.storageService.getScanMode();
    const isPulang = (mode === 'pulang');

    const toleransiLimit = (settings.jamToleransi || '06:40') + ':00';
    const isLate = currentTimeStr > toleransiLimit;

    let statusText = isLate ? 'Terlambat' : 'Tepat Waktu';
    let tipe = 'Pelanggaran';
    let totalPoints = (parseInt(settings.poinTanpaKartu, 10) || 2) + (isLate ? (parseInt(settings.poinPelanggaran, 10) || 1) : 0);
    let keterangan = isLate ? `${settings.kategoriTerlambat || 'Terlambat hadir di sekolah lebih dari 10 menit.'}. ${settings.kategoriTanpaKartu || 'Tidak Membawa ID Card/Kartu Pelajar'}` : (settings.kategoriTanpaKartu || 'Tidak Membawa ID Card/Kartu Pelajar');

    if (isPulang) {
      statusText = 'Pulang';
      tipe = 'Pulang';
      totalPoints = 0;
      keterangan = 'Presensi Pulang (Tanpa Kartu)';
      window.soundEngine.playPulang();
      window.soundEngine.speakStudent(name, 'pulang');
    } else {
      window.soundEngine.playLate();
      window.soundEngine.speakStudent(name, 'tanpa_kartu');
    }

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
    const inJamMasukMulai = document.getElementById('cfgJamMasukMulai');
    const inJamToleransi = document.getElementById('cfgJamToleransi');
    const inJamMasukSelesai = document.getElementById('cfgJamMasukSelesai');
    const inJamPulangMulai = document.getElementById('cfgJamPulangMulai');
    const inJamPulangSelesai = document.getElementById('cfgJamPulangSelesai');
    const inLockOnce = document.getElementById('cfgLockOncePerDay');

    if (inJamMasukMulai) inJamMasukMulai.value = s.jamMasukMulai || '06:00';
    if (inJamToleransi) inJamToleransi.value = s.jamToleransi || '06:40';
    if (inJamMasukSelesai) inJamMasukSelesai.value = s.jamMasukSelesai || '08:00';
    if (inJamPulangMulai) inJamPulangMulai.value = s.jamPulangMulai || '15:00';
    if (inJamPulangSelesai) inJamPulangSelesai.value = s.jamPulangSelesai || '18:00';
    if (inLockOnce) inLockOnce.checked = (s.lockOncePerDay !== false);

    const inTts = document.getElementById('cfgTtsEnabled');
    if (inTts) inTts.checked = (s.ttsEnabled !== false);
    if (window.soundEngine) {
      window.soundEngine.ttsEnabled = (s.ttsEnabled !== false);
    }

    const inTtsTemplateMasuk = document.getElementById('cfgTtsTemplateMasuk');
    const inTtsTemplateTerlambat = document.getElementById('cfgTtsTemplateTerlambat');
    const inTtsTemplatePulang = document.getElementById('cfgTtsTemplatePulang');
    if (inTtsTemplateMasuk) inTtsTemplateMasuk.value = s.ttsTemplateMasuk || 'Terima kasih, {nama}!';
    if (inTtsTemplateTerlambat) inTtsTemplateTerlambat.value = s.ttsTemplateTerlambat || 'Perhatian, {nama}, Anda terlambat.';
    if (inTtsTemplatePulang) inTtsTemplatePulang.value = s.ttsTemplatePulang || 'Terima kasih, {nama}, selamat jalan.';

    const inPoinPelanggaran = document.getElementById('cfgPoinPelanggaran');
    const inPoinTanpaKartu = document.getElementById('cfgPoinTanpaKartu');
    const inCooldown = document.getElementById('cfgCooldownScan');
    const inGasUrl = document.getElementById('cfgGasUrl');
    const inSpreadsheetId = document.getElementById('cfgSpreadsheetId');
    const inSheetName = document.getElementById('cfgSheetName');
    const inFbApiKey = document.getElementById('cfgFbApiKey');
    const inFbDatabaseUrl = document.getElementById('cfgFbDatabaseUrl');
    const inFbProjectId = document.getElementById('cfgFbProjectId');

    if (inPoinPelanggaran) inPoinPelanggaran.value = s.poinPelanggaran || 1;
    if (inPoinTanpaKartu) inPoinTanpaKartu.value = s.poinTanpaKartu || 2;
    if (inCooldown) inCooldown.value = s.cooldownMinutes || 1;
    if (inGasUrl) inGasUrl.value = s.gasUrl || '';
    if (inSpreadsheetId) inSpreadsheetId.value = s.spreadsheetId || '';
    if (inSheetName) inSheetName.value = s.sheetName || 'catatan_poin';
    if (inFbApiKey) inFbApiKey.value = s.fbApiKey || '';
    if (inFbDatabaseUrl) inFbDatabaseUrl.value = s.fbDatabaseUrl || '';
    if (inFbProjectId) inFbProjectId.value = s.fbProjectId || '';

    if (masterCountEl) {
      masterCountEl.textContent = Object.keys(window.storageService.getMasterStudents()).length;
    }

    updateScanModeUI();
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

  btnSaveSettings.addEventListener('click', async () => {
    const rawSheetId = document.getElementById('cfgSpreadsheetId').value;
    const cleanSheetId = extractSpreadsheetId(rawSheetId);
    if (cleanSheetId !== rawSheetId) {
      document.getElementById('cfgSpreadsheetId').value = cleanSheetId;
    }

    const cfgGuardPinEl = document.getElementById('cfgGuardPin');
    const cfgDefaultGuardNameEl = document.getElementById('cfgDefaultGuardName');
    const selTerlambat = document.getElementById('cfgKategoriTerlambat');
    const selTanpaKartu = document.getElementById('cfgKategoriTanpaKartu');

    const inJamMasukMulai = document.getElementById('cfgJamMasukMulai');
    const inJamMasukSelesai = document.getElementById('cfgJamMasukSelesai');
    const inJamPulangMulai = document.getElementById('cfgJamPulangMulai');
    const inJamPulangSelesai = document.getElementById('cfgJamPulangSelesai');
    const inLockOnce = document.getElementById('cfgLockOncePerDay');

    const newSettings = {
      jamMasukMulai: inJamMasukMulai ? inJamMasukMulai.value : '06:00',
      jamMasuk: inJamMasukMulai ? inJamMasukMulai.value : '06:00',
      jamToleransi: document.getElementById('cfgJamToleransi').value || '06:40',
      jamMasukSelesai: inJamMasukSelesai ? inJamMasukSelesai.value : '08:00',
      jamPulangMulai: inJamPulangMulai ? inJamPulangMulai.value : '15:00',
      jamPulangSelesai: inJamPulangSelesai ? inJamPulangSelesai.value : '18:00',
      lockOncePerDay: inLockOnce ? inLockOnce.checked : true,
      poinPelanggaran: parseInt(document.getElementById('cfgPoinPelanggaran').value, 10) || 1,
      poinTanpaKartu: parseInt(document.getElementById('cfgPoinTanpaKartu').value, 10) || 2,
      kategoriTerlambat: selTerlambat ? selTerlambat.value : 'Terlambat hadir di kelas lebih dari 10 menit.',
      kategoriTanpaKartu: selTanpaKartu ? selTanpaKartu.value : 'Tidak membawa ID Card',
      cooldownMinutes: parseInt(document.getElementById('cfgCooldownScan').value, 10) || 30,
      ttsEnabled: document.getElementById('cfgTtsEnabled') ? document.getElementById('cfgTtsEnabled').checked : true,
      ttsTemplateMasuk: document.getElementById('cfgTtsTemplateMasuk') ? document.getElementById('cfgTtsTemplateMasuk').value.trim() : 'Terima kasih, {nama}!',
      ttsTemplateTerlambat: document.getElementById('cfgTtsTemplateTerlambat') ? document.getElementById('cfgTtsTemplateTerlambat').value.trim() : 'Perhatian, {nama}, Anda terlambat.',
      ttsTemplatePulang: document.getElementById('cfgTtsTemplatePulang') ? document.getElementById('cfgTtsTemplatePulang').value.trim() : 'Terima kasih, {nama}, selamat jalan.',

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

    if (!newSettings.gasUrl) {
      showToast('⚠️ URL Web App belum diisi! Pengaturan HANYA tersimpan di browser ini. Isi URL Web App agar tersimpan permanen di Spreadsheet.', 'warning');
      settingsModal.classList.add('hidden');
      return;
    }

    btnSaveSettings.disabled = true;
    btnSaveSettings.textContent = 'Menyimpan ke Spreadsheet...';

    const res = await window.syncService.saveSettingsToSpreadsheet(newSettings);
    btnSaveSettings.disabled = false;
    btnSaveSettings.textContent = 'Simpan Pengaturan';
    settingsModal.classList.add('hidden');

    if (res && res.success && !res.offline) {
      showToast('✅ Berhasil! Pengaturan jadwal & poin tersimpan SELAMANYA di sheet Pengaturan_Scanner!', 'success');
    } else {
      showToast('⚠️ Pengaturan tersimpan di browser, tetapi gagal menulis ke spreadsheet: ' + (res.message || 'Cek URL Web App'), 'error');
    }
  });

  const btnTestVoice = document.getElementById('btnTestVoice');
  if (btnTestVoice) {
    btnTestVoice.addEventListener('click', () => {
      if (window.soundEngine) {
        window.soundEngine.playSuccess();
        window.soundEngine.speakStudent('Budi Santoso', 'success', 150);
      }
    });
  }

  const btnInitSheets = document.getElementById('btnInitSheets');
  if (btnInitSheets) {
    btnInitSheets.addEventListener('click', async () => {
      const gasUrl = document.getElementById('cfgGasUrl').value.trim();
      const sheetId = document.getElementById('cfgSpreadsheetId').value.trim();
      if (!gasUrl) {
        showToast('Isi URL Web App Google Apps Script terlebih dahulu!', 'warning');
        return;
      }
      window.storageService.saveSettings({ gasUrl, spreadsheetId: sheetId });

      btnInitSheets.disabled = true;
      btnInitSheets.textContent = '⏳ Membuat sheet di Spreadsheet...';
      try {
        const res = await window.syncService.initSheetsInSpreadsheet();
        if (res.success) {
          showToast('✅ Berhasil! Sheet "Pengaturan_Scanner" dan "Data_Pengguna" telah dibuat di Google Sheets!', 'success');
          await window.syncService.fetchSettingsFromSpreadsheet();
          await window.syncService.fetchUsersFromSpreadsheet();
          applySettingsUI();
        } else {
          showToast(res.message || 'Gagal membuat sheet di spreadsheet.', 'error');
        }
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
      } finally {
        btnInitSheets.disabled = false;
        btnInitSheets.textContent = '🛠️ Buat Sheet Pengaturan & Data Pengguna di Spreadsheet';
      }
    });
  }

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

  const btnSyncMasterFromSheets = document.getElementById('btnSyncMasterFromSheets');
  if (btnSyncMasterFromSheets) {
    btnSyncMasterFromSheets.addEventListener('click', async () => {
      btnSyncMasterFromSheets.disabled = true;
      btnSyncMasterFromSheets.textContent = '⏳ Menarik Data Siswa & Poin...';
      try {
        // Save URL first if typed
        const gasUrl = document.getElementById('cfgGasUrl').value.trim();
        const sheetId = document.getElementById('cfgSpreadsheetId').value.trim();
        if (gasUrl) {
          window.storageService.saveSettings({ gasUrl: gasUrl, spreadsheetId: sheetId });
        }

        const sRes = await window.syncService.fetchStudentsFromSpreadsheet();
        const pRes = await window.syncService.fetchPointCategoriesFromSpreadsheet();
        const cfgRes = await window.syncService.fetchSettingsFromSpreadsheet();

        let msg = '';
        if (sRes.success) msg += `✓ ${sRes.count} Siswa dimuat. `;
        if (pRes.success) msg += `✓ ${pRes.count} Kategori Poin dimuat. `;
        if (cfgRes.success) msg += `✓ Pengaturan jadwal & poin tersinkron.`;

        if (sRes.success || pRes.success || cfgRes.success) {
          showToast(`Sukses sinkronisasi! ${msg}`, 'success');
          applySettingsUI();
        } else {
          showToast(sRes.message || pRes.message || cfgRes.message || 'Gagal menarik data dari spreadsheet.', 'error');
        }
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
      } finally {
        btnSyncMasterFromSheets.disabled = false;
        btnSyncMasterFromSheets.textContent = '📥 Tarik Data Siswa & Kategori Poin dari Spreadsheet';
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
      window.syncService.fetchSettingsFromSpreadsheet().then(cRes => {
        if (cRes && cRes.success) {
          showToast('Pengaturan jadwal & poin otomatis dimuat dari spreadsheet!', 'info');
          applySettingsUI();
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
      const userDevices = Array.isArray(u.devices) ? u.devices : (typeof u.devices === 'string' && u.devices ? u.devices.split(',').filter(Boolean) : []);
      const devCount = userDevices.length;
      const devBadge = devCount >= 2 
        ? `<span style="background: rgba(239, 68, 68, 0.2); color: #f87171; padding: 2px 6px; border-radius: 4px; font-weight: 600; font-size: 0.75rem;" title="Maksimal 2 perangkat tercapai">2/2 Terkunci</span>`
        : `<span style="background: rgba(16, 185, 129, 0.15); color: #34d399; padding: 2px 6px; border-radius: 4px; font-weight: 600; font-size: 0.75rem;">${devCount}/2 HP</span>`;

      const dayText = u.allowedDays || 'Semua Hari';

      tr.innerHTML = `
        <td style="padding: 8px 10px; font-family: var(--font-mono); font-weight: 600;">${u.username}</td>
        <td style="padding: 8px 10px;">${u.name || '-'}</td>
        <td style="padding: 8px 10px;">${roleBadge}</td>
        <td style="padding: 8px 10px; font-size: 0.8rem; color: #cbd5e1;">${dayText}</td>
        <td style="padding: 8px 10px;">${devBadge}</td>
        <td style="padding: 8px 10px; color: ${statusColor}; font-weight: 500;">${u.status || 'Aktif'}</td>
        <td style="padding: 8px 10px; text-align: right; white-space: nowrap;">
          <button type="button" class="btn-reset-dev" data-username="${u.username}" title="Reset perangkat terdaftar" style="background: transparent; border: none; color: #fbbf24; cursor: pointer; padding: 4px 6px; font-size: 0.8rem;">🔄 Reset HP</button>
          <button type="button" class="btn-edit-user" data-username="${u.username}" style="background: transparent; border: none; color: var(--cyan); cursor: pointer; padding: 4px 6px; font-size: 0.8rem;">✏️ Edit</button>
          <button type="button" class="btn-delete-user" data-username="${u.username}" style="background: transparent; border: none; color: var(--rose); cursor: pointer; padding: 4px 6px; font-size: 0.8rem;">🗑️ Hapus</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Attach Reset Device listeners
    tbody.querySelectorAll('.btn-reset-dev').forEach(btn => {
      btn.addEventListener('click', async () => {
        const uname = btn.dataset.username;
        if (confirm(`Reset daftar perangkat untuk akun "${uname}"?\n\nSetelah di-reset, akun ini dapat login dari HP/Laptop baru (maksimal 2 perangkat lagi).`)) {
          showToast(`Mereset perangkat untuk "${uname}"...`, 'info');
          const res = await window.syncService.resetUserDevicesInSpreadsheet(uname);
          showToast(res.message || 'Perangkat berhasil di-reset.', res.success ? 'success' : 'info');
          renderUserTableUI();
        }
      });
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
          const selDays = document.getElementById('uFormAllowedDays');
          if (selDays) selDays.value = u.allowedDays || 'Semua Hari';
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
      const allowedDays = document.getElementById('uFormAllowedDays') ? document.getElementById('uFormAllowedDays').value : 'Semua Hari';

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

      // Pertahankan data perangkat jika akun sedang diedit
      const existingUser = window.storageService.getUsers().find(x => x.username.toLowerCase() === username.toLowerCase());
      const devices = existingUser ? (existingUser.devices || []) : [];

      const userObj = { username, name, pin, role, status: 'Aktif', allowedDays, devices };
      const res = await window.syncService.saveUserToSpreadsheet(userObj);

      btnSaveUserSpreadsheet.disabled = false;
      btnSaveUserSpreadsheet.textContent = '💾 Simpan Akun ke Spreadsheet';

      if (res.success && !res.offline) {
        showToast('✅ Akun "' + username + '" berhasil tersimpan SELAMANYA di sheet Data_Pengguna di Spreadsheet!', 'success');
      } else if (res.offline) {
        showToast('⚠️ Akun tersimpan di browser saja (Isi URL Web App agar tersimpan permanen di Spreadsheet).', 'warning');
      } else {
        showToast(res.message || 'Gagal menyimpan akun ke spreadsheet', 'error');
      }

      // Reset form
      document.getElementById('uFormUsername').value = '';
      document.getElementById('uFormName').value = '';
      document.getElementById('uFormPin').value = '';
      document.getElementById('uFormRole').value = 'petugas';
      if (document.getElementById('uFormAllowedDays')) document.getElementById('uFormAllowedDays').value = 'Semua Hari';
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
      if (document.getElementById('uFormAllowedDays')) document.getElementById('uFormAllowedDays').value = 'Semua Hari';
      document.getElementById('formUserTitle').textContent = '➕ Tambah / Edit Akun Pengguna';
    });
  }

  // Tombol Salin Link Siap Pakai
  const btnCopyQuickLink = document.getElementById('btnCopyQuickLink');
  if (btnCopyQuickLink) {
    btnCopyQuickLink.addEventListener('click', () => {
      const s = window.storageService.getSettings();
      if (!s.gasUrl) {
        showToast('Isi URL Web App terlebih dahulu sebelum menyalin link!', 'warning');
        return;
      }
      const baseUrl = window.location.origin + window.location.pathname;
      const shareUrl = `${baseUrl}?gasUrl=${encodeURIComponent(s.gasUrl)}&sheetId=${encodeURIComponent(s.spreadsheetId || '')}`;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareUrl).then(() => {
          showToast('📋 Link siap pakai berhasil disalin ke clipboard! Buka link ini di browser/HP lain.', 'success');
        }).catch(() => {
          prompt('Salin link siap pakai ini dan buka di browser lain:', shareUrl);
        });
      } else {
        prompt('Salin link siap pakai ini dan buka di browser lain:', shareUrl);
      }
    });
  }

  // Auto-detect config from URL parameters (e.g. ?gasUrl=https://script.google.com/.../exec)
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const paramGasUrl = urlParams.get('gasUrl');
    const paramSheetId = urlParams.get('sheetId');
    if (paramGasUrl) {
      const updates = { gasUrl: decodeURIComponent(paramGasUrl).trim() };
      if (paramSheetId) updates.spreadsheetId = decodeURIComponent(paramSheetId).trim();
      window.storageService.saveSettings(updates);
      showToast('✓ Konfigurasi Google Sheets berhasil diimpor otomatis dari Link!', 'success');
    }
  } catch (_) {}

  // Init
  checkAuth();
  applySettingsUI();
  renderAttendanceUI();

  // Auto-sync pengaturan jadwal/poin, data siswa & kategori dari Spreadsheet jika ada koneksi
  setTimeout(async () => {
    try {
      const s = window.storageService.getSettings();
      if (s.gasUrl) {
        const cRes = await window.syncService.fetchSettingsFromSpreadsheet();
        if (cRes && cRes.success) {
          applySettingsUI();
        }
      }
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
