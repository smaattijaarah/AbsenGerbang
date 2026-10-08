/**
 * Dual-Mode Scanner Engine
 * Supports:
 * 1. High-Speed USB/Bluetooth HID Barcode Scanners (Global listener, zero-click)
 * 2. Mobile/Laptop Camera QR Reader (Html5Qrcode)
 */
class ScannerEngine {
  constructor(onScanCallback) {
    this.onScan = onScanCallback;
    this.html5QrCode = null;
    this.currentCameraId = null;
    this.cameras = [];
    this.isCameraRunning = false;
    this.lastScanTime = 0;
    this.scanThrottleMs = 1200; // prevent multi-read of the same frame

    // USB Scanner buffer variables
    this.buffer = '';
    this.lastKeystrokeTime = 0;
    this.maxCharIntervalMs = 70; // USB scanners output characters rapidly (<50ms)

    this.initUsbListener();
  }

  /**
   * Listen to high-speed keystrokes from USB Hardware Scanners
   */
  initUsbListener() {
    window.addEventListener('keydown', (e) => {
      // Ignore if user is typing in settings modal or search box
      const activeEl = document.activeElement;
      const isInput = activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        activeEl.isContentEditable
      );

      // If active element is the manual scanner input, let Enter handle it
      if (activeEl && activeEl.id === 'manualNisnInput') {
        if (e.key === 'Enter') {
          e.preventDefault();
          const val = activeEl.value.trim();
          if (val) {
            activeEl.value = '';
            this.handleScanResult(val, 'usb_manual');
          }
        }
        return;
      }

      // If user is typing in another input (e.g., search or settings), don't intercept
      if (isInput) return;

      const now = Date.now();
      const charInterval = now - this.lastKeystrokeTime;
      this.lastKeystrokeTime = now;

      // Handle Enter (Scanner usually terminates with Enter)
      if (e.key === 'Enter') {
        if (this.buffer.length >= 3) {
          e.preventDefault();
          const scannedCode = this.buffer.trim();
          this.buffer = '';
          this.handleScanResult(scannedCode, 'usb_hardware');
        } else {
          this.buffer = '';
        }
        return;
      }

      // If interval between keystrokes was too long (> 200ms), reset buffer
      if (charInterval > 200) {
        this.buffer = '';
      }

      // Only accumulate printable characters
      if (e.key.length === 1) {
        this.buffer += e.key;
      }
    });
  }

  handleScanResult(code, source = 'unknown') {
    const now = Date.now();
    if (now - this.lastScanTime < 500) {
      // Drop bounce scans within 500ms
      return;
    }
    this.lastScanTime = now;

    // Clean code (remove leading/trailing symbols or newline if any)
    const clean = code.replace(/[\r\n\t]/g, '').trim();
    if (!clean) return;

    if (this.onScan) {
      this.onScan(clean, source);
    }
  }

  /**
   * Initialize Camera QR Scanner using Html5Qrcode
   */
  async startCamera(elementId = 'qrReader') {
    if (typeof Html5Qrcode === 'undefined') {
      throw new Error('Library Html5Qrcode belum dimuat');
    }

    try {
      this.html5QrCode = new Html5Qrcode(elementId);
      this.cameras = await Html5Qrcode.getCameras();

      if (!this.cameras || this.cameras.length === 0) {
        throw new Error('Tidak ada kamera yang ditemukan pada perangkat ini');
      }

      // Prefer back camera (environment) if available
      let selectedCam = this.cameras.find(c => 
        c.label.toLowerCase().includes('back') || 
        c.label.toLowerCase().includes('belakang') ||
        c.label.toLowerCase().includes('rear')
      ) || this.cameras[0];

      this.currentCameraId = selectedCam.id;

      const config = {
        fps: 15,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      };

      await this.html5QrCode.start(
        this.currentCameraId,
        config,
        (decodedText) => {
          this.handleScanResult(decodedText, 'camera');
        },
        () => {
          // ignore frame errors
        }
      );

      this.isCameraRunning = true;
      return true;
    } catch (err) {
      this.isCameraRunning = false;
      throw err;
    }
  }

  async stopCamera() {
    if (this.html5QrCode && this.isCameraRunning) {
      try {
        await this.html5QrCode.stop();
        this.html5QrCode.clear();
      } catch (e) {
        console.warn('Error stopping camera:', e);
      }
      this.isCameraRunning = false;
    }
  }

  async switchCamera() {
    if (!this.isCameraRunning || this.cameras.length <= 1) return;

    const currentIdx = this.cameras.findIndex(c => c.id === this.currentCameraId);
    const nextIdx = (currentIdx + 1) % this.cameras.length;
    this.currentCameraId = this.cameras[nextIdx].id;

    await this.stopCamera();
    await this.startCamera();
  }
}

window.ScannerEngine = ScannerEngine;
