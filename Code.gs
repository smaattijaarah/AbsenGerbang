/**
 * =========================================================================
 * GOOGLE APPS SCRIPT (GAS) - FAST ATTENDANCE BATCH RECEIVER & USER MANAGER
 * Pasang skrip ini pada script.google.com (Standalone Web App).
 * Mendukung penyimpanan kehadiran siswa dan data akun User/Admin.
 * =========================================================================
 */

// Konfigurasi Default
var DEFAULT_SPREADSHEET_ID = ""; // Dikosongkan jika script standalone dan ID dikirim dinamis dari scanner
var DEFAULT_SHEET_NAME = "Presensi_Masuk";
var USERS_SHEET_NAME = "Data_Pengguna";

/**
 * Helper untuk membersihkan dan mengekstrak ID Spreadsheet
 * Mendukung input berupa ID murni maupun URL lengkap Google Spreadsheet
 */
function sanitizeSpreadsheetId(idOrUrl) {
  if (!idOrUrl) return "";
  var str = idOrUrl.toString().trim();
  var match = str.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return str;
}

/**
 * Helper untuk membuka spreadsheet target
 */
function openTargetSpreadsheet(rawId) {
  var spreadsheetId = sanitizeSpreadsheetId(rawId || DEFAULT_SPREADSHEET_ID);
  if (spreadsheetId && spreadsheetId.length >= 10) {
    return SpreadsheetApp.openById(spreadsheetId);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Helper untuk memastikan sheet Data_Pengguna (User & Admin) tersedia
 */
function getOrCreateUsersSheet(ss) {
  var sheet = ss.getSheetByName(USERS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(USERS_SHEET_NAME);
    var headers = ["Username", "Nama Lengkap", "PIN", "Role", "Status", "Terakhir Diupdate"];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setBackground("#0f766e")
      .setFontColor("#ffffff");

    // Buat 2 akun default awal
    var nowStr = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");
    sheet.appendRow(["admin", "Administrator", "'123456", "admin", "Aktif", nowStr]);
    sheet.appendRow(["penjaga", "Penjaga Sekolah", "'1234", "petugas", "Aktif", nowStr]);
  }
  return sheet;
}

/**
 * Handle HTTP POST dari Aplikasi Scanner Fast Kiosk
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  // Kunci script maks 10 detik agar penulisan baris berurutan rapi tanpa bentrok
  var hasLock = lock.tryLock(10000);
  
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ status: "error", message: "No post data received" });
    }

    var data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return createJsonResponse({ status: "error", message: "Invalid JSON format" });
    }

    var action = data.action || "record";

    // 1. PING TEST & VERIFIKASI SPREADSHEET ID
    if (action === "ping") {
      var rawId = data.spreadsheetId || DEFAULT_SPREADSHEET_ID;
      var spreadsheetId = sanitizeSpreadsheetId(rawId);

      if (spreadsheetId && spreadsheetId.length >= 10) {
        try {
          var targetSs = SpreadsheetApp.openById(spreadsheetId);
          var sheetName = data.sheetName || DEFAULT_SHEET_NAME;
          var targetSheet = targetSs.getSheetByName(sheetName);
          var tabStatus = targetSheet ? "Tab '" + sheetName + "' siap" : "Tab '" + sheetName + "' akan otomatis dibuat saat scan";

          // Pastikan juga sheet Data_Pengguna tersedia
          var uSheet = getOrCreateUsersSheet(targetSs);
          var userCount = Math.max(0, uSheet.getLastRow() - 1);

          return createJsonResponse({
            status: "success",
            message: "Koneksi Berhasil! Terhubung ke: \"" + targetSs.getName() + "\" (" + tabStatus + ", " + userCount + " Akun Pengguna siap).",
            spreadsheetName: targetSs.getName(),
            sheetFound: !!targetSheet,
            userCount: userCount
          });
        } catch (ssErr) {
          return createJsonResponse({
            status: "error",
            message: "Web App GAS aktif, TETAPI gagal mengakses Spreadsheet (ID: " + spreadsheetId + "): " + ssErr.message + ". Pastikan ID benar dan file Spreadsheet telah dibagikan ke akun Google pemilik script ini sebagai Editor."
          });
        }
      }

      return createJsonResponse({
        status: "success",
        message: "Koneksi Google Apps Script Web App berhasil terhubung! (Masukkan ID Spreadsheet E-Absensi di aplikasi scanner untuk menghubungkan ke file tujuan)."
      });
    }

    // 2. BATCH RECORD ATTENDANCE
    if (action === "batch_record_attendance" || action === "record") {
      var records = data.records || [];
      if (!Array.isArray(records) || records.length === 0) {
        if (data.record) {
          records = [data.record];
        } else {
          return createJsonResponse({ status: "success", message: "Tidak ada antrean records", count: 0 });
        }
      }

      var ss;
      try {
        ss = openTargetSpreadsheet(data.spreadsheetId);
      } catch (openErr) {
        return createJsonResponse({
          status: "error",
          message: "Gagal membuka Spreadsheet target: " + openErr.message + ". Pastikan file dibagikan ke akun Google pembuat skrip sebagai Editor."
        });
      }

      if (!ss) {
        return createJsonResponse({ status: "error", message: "Spreadsheet tidak ditemukan." });
      }

      var sheetName = data.sheetName || DEFAULT_SHEET_NAME;
      var sheet = ss.getSheetByName(sheetName);

      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        var headers = [
          "ID Log",
          "Tanggal",
          "Jam Scan",
          "NISN",
          "Nama Siswa",
          "Kelas",
          "Status Kehadiran",
          "Status Kartu",
          "Poin Pelanggaran",
          "Petugas / Penjaga",
          "Metode Scan",
          "Timestamp Sync"
        ];
        sheet.appendRow(headers);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#0284c7").setFontColor("#ffffff");
      }

      var rowsToAppend = [];
      var syncTimeStr = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");

      for (var i = 0; i < records.length; i++) {
        var r = records[i];
        var cardStatus = r.withoutCard ? "Tidak Membawa Kartu" : "Membawa Kartu";
        rowsToAppend.push([
          r.id || ("REC_" + new Date().getTime() + "_" + i),
          r.date || Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd"),
          r.time || Utilities.formatDate(new Date(), "Asia/Jakarta", "HH:mm:ss"),
          r.nisn ? "'" + r.nisn : "",
          r.name || "",
          r.class || "",
          r.status || "Tepat Waktu",
          cardStatus,
          r.points || 0,
          r.guardName || "Penjaga Sekolah",
          r.source || "Scanner Kiosk",
          syncTimeStr
        ]);
      }

      if (rowsToAppend.length > 0) {
        var lastRow = sheet.getLastRow();
        var numCols = rowsToAppend[0].length;
        sheet.getRange(lastRow + 1, 1, rowsToAppend.length, numCols).setValues(rowsToAppend);
      }

      return createJsonResponse({
        status: "success",
        message: "Berhasil mencatat " + rowsToAppend.length + " presensi",
        count: rowsToAppend.length
      });
    }

    // 3. GET USERS FROM SPREADSHEET (DATA USER & ADMIN)
    if (action === "get_users") {
      var ss = openTargetSpreadsheet(data.spreadsheetId);
      var uSheet = getOrCreateUsersSheet(ss);
      var lastRow = uSheet.getLastRow();
      var users = [];

      if (lastRow > 1) {
        var values = uSheet.getRange(2, 1, lastRow - 1, 5).getValues();
        for (var i = 0; i < values.length; i++) {
          var row = values[i];
          var uName = String(row[0] || "").trim();
          if (uName) {
            users.push({
              username: uName,
              name: String(row[1] || uName).trim(),
              pin: String(row[2] || "").replace(/^'/, "").trim(),
              role: String(row[3] || "petugas").trim().toLowerCase(),
              status: String(row[4] || "Aktif").trim()
            });
          }
        }
      }

      return createJsonResponse({
        status: "success",
        users: users
      });
    }

    // 4. SAVE / UPDATE USER TO SPREADSHEET
    if (action === "save_user") {
      var ss = openTargetSpreadsheet(data.spreadsheetId);
      var uSheet = getOrCreateUsersSheet(ss);
      var user = data.user;
      if (!user || !user.username) {
        return createJsonResponse({ status: "error", message: "Data username wajib diisi" });
      }

      var targetUsername = String(user.username).trim();
      var lastRow = uSheet.getLastRow();
      var rowIndex = -1;

      if (lastRow > 1) {
        var usernames = uSheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (var i = 0; i < usernames.length; i++) {
          if (String(usernames[i][0]).toLowerCase() === targetUsername.toLowerCase()) {
            rowIndex = i + 2;
            break;
          }
        }
      }

      var nowStr = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");
      var pinStr = "'" + String(user.pin || "1234").trim();
      var roleStr = String(user.role || "petugas").toLowerCase();
      var statusStr = String(user.status || "Aktif");
      var nameStr = String(user.name || targetUsername).trim();

      if (rowIndex > 0) {
        uSheet.getRange(rowIndex, 1, 1, 6).setValues([[
          targetUsername, nameStr, pinStr, roleStr, statusStr, nowStr
        ]]);
      } else {
        uSheet.appendRow([targetUsername, nameStr, pinStr, roleStr, statusStr, nowStr]);
      }

      return createJsonResponse({
        status: "success",
        message: "Akun '" + targetUsername + "' (" + roleStr + ") berhasil disimpan ke Spreadsheet (" + USERS_SHEET_NAME + ")"
      });
    }

    // 5. DELETE USER FROM SPREADSHEET
    if (action === "delete_user") {
      var ss = openTargetSpreadsheet(data.spreadsheetId);
      var uSheet = getOrCreateUsersSheet(ss);
      var targetUsername = String(data.username || "").trim().toLowerCase();
      var lastRow = uSheet.getLastRow();

      if (lastRow > 1) {
        var usernames = uSheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (var i = 0; i < usernames.length; i++) {
          if (String(usernames[i][0]).toLowerCase() === targetUsername) {
            uSheet.deleteRow(i + 2);
            return createJsonResponse({
              status: "success",
              message: "Akun '" + targetUsername + "' berhasil dihapus dari Spreadsheet"
            });
          }
        }
      }

      return createJsonResponse({ status: "error", message: "User '" + targetUsername + "' tidak ditemukan di spreadsheet" });
    }

    // 6. AUTHENTICATE USER LANGSUNG KE SPREADSHEET
    if (action === "auth_user") {
      var ss = openTargetSpreadsheet(data.spreadsheetId);
      var uSheet = getOrCreateUsersSheet(ss);
      var reqUser = String(data.username || "").trim().toLowerCase();
      var reqPin = String(data.pin || "").trim();
      var lastRow = uSheet.getLastRow();

      if (lastRow > 1) {
        var values = uSheet.getRange(2, 1, lastRow - 1, 5).getValues();
        for (var i = 0; i < values.length; i++) {
          var row = values[i];
          var uName = String(row[0] || "").trim().toLowerCase();
          var uPin = String(row[2] || "").replace(/^'/, "").trim();
          var uStatus = String(row[4] || "Aktif").trim();

          if (uName === reqUser && uPin === reqPin) {
            if (uStatus.toLowerCase() === "nonaktif") {
              return createJsonResponse({ status: "error", message: "Akun ini berstatus nonaktif. Hubungi Admin." });
            }
            return createJsonResponse({
              status: "success",
              user: {
                username: String(row[0]),
                name: String(row[1] || row[0]),
                role: String(row[3] || "petugas").toLowerCase(),
                status: uStatus
              }
            });
          }
        }
      }

      return createJsonResponse({ status: "error", message: "Nama Pengguna atau PIN salah!" });
    }

    return createJsonResponse({ status: "error", message: "Action tidak dikenal: " + action });

  } catch (error) {
    return createJsonResponse({
      status: "error",
      message: error.toString()
    });
  } finally {
    if (hasLock) {
      lock.releaseLock();
    }
  }
}

/**
 * Handle HTTP GET (Untuk cek apakah URL aktif lewat browser)
 */
function doGet(e) {
  return createJsonResponse({
    status: "online",
    message: "Google Apps Script E-Absensi Receiver aktif dan siap menerima data.",
    time: Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss")
  });
}

/**
 * Helper untuk response JSON dengan CORS Header terbuka
 */
function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
