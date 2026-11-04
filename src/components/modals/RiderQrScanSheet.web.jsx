import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  SafeAreaView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import jsQR from 'jsqr';
import BootstrapIcon from '../common/BootstrapIcon.jsx';

const decodeQr = typeof jsQR === 'function' ? jsQR : jsQR?.default;

/**
 * Web overlay for QR & Barcode scanning and verification for Riders.
 * Decodes video camera frames directly via HTML5 Canvas + jsQR,
 * supports QR Image/Photo file upload, instant 1-tap Target Order Quick Confirm,
 * and direct Order Number / Token text verification.
 */
export default function RiderQrScanSheet({ visible, order, onClose, onScanned }) {
  const [paste, setPaste] = useState('');
  const [camReady, setCamReady] = useState(false);
  const [camError, setCamError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [uploading, setUploading] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const lockedRef = useRef(false);
  const fileInputRef = useRef(null);

  const emitScan = useCallback(
    (value) => {
      const data = String(value || '').trim();
      if (!data || lockedRef.current) return;
      lockedRef.current = true;
      setScanning(true);
      stopCamera();
      onScanned?.(data);
    },
    [onScanned]
  );

  const stopCamera = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((t) => t.stop());
      } catch (_e) { }
      streamRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null;
        videoRef.current.remove();
      } catch (_e) { }
      videoRef.current = null;
    }
    setCamReady(false);
  }, []);

  // Web camera initialization & frame processing
  useEffect(() => {
    if (!visible) {
      lockedRef.current = false;
      setScanning(false);
      setPaste('');
      setCamError('');
      stopCamera();
      return undefined;
    }

    lockedRef.current = false;
    setScanning(false);
    setCamError('');

    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCamError('Live webcam is not supported in this environment. Use manual entry or photo upload below.');
      return undefined;
    }

    let isCancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });

        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const host = typeof document !== 'undefined' ? document.getElementById('web-rider-qr-video-host') : null;
        if (!host) return;

        const video = document.createElement('video');
        video.setAttribute('playsinline', 'true');
        video.muted = true;
        video.autoplay = true;
        video.style.width = '100%';
        video.style.height = '240px';
        video.style.objectFit = 'cover';
        video.style.borderRadius = '14px';
        video.style.backgroundColor = '#0B1220';
        video.srcObject = stream;
        host.innerHTML = '';
        host.appendChild(video);
        videoRef.current = video;

        await video.play();
        setCamReady(true);

        // Frame decoding canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        // BarcodeDetector fallback if native browser supports 1D/2D
        const Detector = typeof window !== 'undefined' ? window.BarcodeDetector : null;
        let nativeDetector = null;
        if (Detector) {
          try {
            nativeDetector = new Detector({
              formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a'],
            });
          } catch (_e) { }
        }

        // Poll video frames every 250ms
        timerRef.current = setInterval(async () => {
          if (!video || video.readyState < 2 || lockedRef.current) return;

          // 1. Try native BarcodeDetector first
          if (nativeDetector) {
            try {
              const codes = await nativeDetector.detect(video);
              const val = codes?.[0]?.rawValue;
              if (val) {
                emitScan(val);
                return;
              }
            } catch (_e) { }
          }

          // 2. Pure JS QR decoding via jsQR
          if (decodeQr && ctx) {
            try {
              const w = video.videoWidth || 640;
              const h = video.videoHeight || 480;
              canvas.width = w;
              canvas.height = h;
              ctx.drawImage(video, 0, 0, w, h);
              const imageData = ctx.getImageData(0, 0, w, h);
              const code = decodeQr(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'dontInvert',
              });
              if (code?.data) {
                emitScan(code.data);
                return;
              }
            } catch (_e) { }
          }
        }, 250);
      } catch (e) {
        setCamError(
          e?.name === 'NotAllowedError'
            ? 'Camera permission denied. Please allow camera access or use the quick confirm/manual entry below.'
            : e?.message || 'Webcam preview could not be opened.'
        );
      }
    })();

    return () => {
      isCancelled = true;
      stopCamera();
    };
  }, [visible, emitScan, stopCamera]);

  // Handle image upload from file system
  const handleImageUpload = (e) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    setUploading(true);
    setCamError('');

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = img.width;
          c.height = img.height;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const imgData = ctx.getImageData(0, 0, c.width, c.height);
          const qr = decodeQr ? decodeQr(imgData.data, imgData.width, imgData.height) : null;
          if (qr?.data) {
            emitScan(qr.data);
          } else {
            setCamError('No readable QR code found in this image. You can enter the Order # directly below.');
          }
        } catch (_err) {
          setCamError('Unable to analyze image. Please enter the Order # manually.');
        } finally {
          setUploading(false);
        }
      };
      img.onerror = () => {
        setCamError('Failed to load image file.');
        setUploading(false);
      };
      img.src = reader.result;
    };
    reader.onerror = () => {
      setCamError('Could not read image file.');
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  if (!visible) return null;

  const targetOrderId = order?.orderId || order?.order_id || '';
  const customerName = order?.customerName || order?.customer_name || 'Customer parcel';

  return (
    <View style={styles.overlay}>
      <SafeAreaView style={styles.safe}>
        {/* Top Header */}
        <View style={styles.topBar}>
          <View style={{ flex: 1 }}>
            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                <BootstrapIcon name="shield-check" size={11} color="#EA580C" />
                <Text style={styles.badgeText}>MOTOTRACK RIDER</Text>
              </View>
              {camReady ? (
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>WEBCAM ACTIVE</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.title}>Scan Order QR</Text>
            <Text style={styles.hint}>
              {targetOrderId
                ? `Confirming delivery for Order #${targetOrderId} (${customerName})`
                : "Point your webcam at customer's QR, upload a slip photo, or enter Order #."}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityRole="button">
            <BootstrapIcon name="x-lg" size={15} color="#E2E8F0" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Target Order 1-Tap Quick Confirm */}
          {targetOrderId ? (
            <View style={styles.targetBanner}>
              <View style={styles.targetIconWrap}>
                <BootstrapIcon name="box-seam" size={18} color="#EA580C" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.targetTitle}>Target: Order #{targetOrderId}</Text>
                <Text style={styles.targetSub}>{customerName}</Text>
              </View>
              <TouchableOpacity
                style={styles.quickConfirmBtn}
                onPress={() => emitScan(targetOrderId)}
                accessibilityRole="button"
              >
                <BootstrapIcon name="check-circle-fill" size={14} color="#FFFFFF" />
                <Text style={styles.quickConfirmText}>Quick Confirm</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Webcam Viewport */}
          <View style={styles.camCard}>
            <div
              id="web-rider-qr-video-host"
              style={{
                width: '100%',
                minHeight: '220px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              {!camReady && !camError ? (
                <View style={styles.loadingCam}>
                  <ActivityIndicator size="small" color="#EA580C" />
                  <Text style={styles.loadingCamText}>Starting webcam preview…</Text>
                </View>
              ) : null}
            </div>

            {camReady && !scanning ? (
              <View style={styles.scanReticle}>
                <View style={[styles.corner, styles.cTL]} />
                <View style={[styles.corner, styles.cTR]} />
                <View style={[styles.corner, styles.cBL]} />
                <View style={[styles.corner, styles.cBR]} />
                <Text style={styles.scanReticleText}>Align QR code with camera</Text>
              </View>
            ) : null}

            {scanning ? (
              <View style={styles.scanningCover}>
                <ActivityIndicator size="large" color="#EA580C" />
                <Text style={styles.scanningCoverText}>Verifying Order QR…</Text>
              </View>
            ) : null}
          </View>

          {camError ? (
            <View style={styles.camErrorBox}>
              <BootstrapIcon name="exclamation-circle-fill" size={14} color="#EF4444" />
              <Text style={styles.camErrorText}>{camError}</Text>
            </View>
          ) : null}

          {/* Image Upload Option */}
          <View style={styles.uploadCard}>
            <View style={styles.uploadInfo}>
              <BootstrapIcon name="image" size={18} color="#EA580C" />
              <View style={{ flex: 1 }}>
                <Text style={styles.uploadTitle}>Upload QR Image / Photo</Text>
                <Text style={styles.uploadSub}>Select a photo of customer's QR or parcel slip</Text>
              </View>
            </View>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleImageUpload}
            />
            <TouchableOpacity
              style={styles.uploadBtn}
              onPress={() => fileInputRef.current?.click()}
              disabled={uploading}
              accessibilityRole="button"
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <BootstrapIcon name="cloud-arrow-up-fill" size={14} color="#FFFFFF" />
                  <Text style={styles.uploadBtnText}>Choose File</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Manual Entry Block */}
          <View style={styles.manualCard}>
            <Text style={styles.label}>Manual Order Number, Tracking ID, or Link</Text>
            <TextInput
              style={styles.input}
              value={paste}
              onChangeText={setPaste}
              placeholder={
                targetOrderId
                  ? `e.g. ${targetOrderId} or paste link`
                  : 'e.g. ORD-ON-2026-00001 or paste link'
              }
              placeholderTextColor="#64748B"
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => {
                if (paste.trim()) emitScan(paste.trim());
              }}
            />
            <TouchableOpacity
              style={[styles.primaryBtn, !paste.trim() && styles.btnDisabled]}
              disabled={!paste.trim()}
              accessibilityRole="button"
              onPress={() => emitScan(paste.trim())}
            >
              <BootstrapIcon name="check2" size={16} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>Verify & Confirm Order</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} accessibilityRole="button">
            <Text style={styles.cancelBtnText}>Dismiss</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  safe: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#0F172A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    maxHeight: '92vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    gap: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(234, 88, 12, 0.35)',
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.8,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#34D399',
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  hint: {
    fontSize: 12.5,
    color: '#94A3B8',
    marginTop: 4,
    lineHeight: 17,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 18,
    gap: 14,
  },
  targetBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#EA580C',
    gap: 10,
  },
  targetIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: 'rgba(234, 88, 12, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  targetSub: {
    fontSize: 11.5,
    color: '#94A3B8',
    marginTop: 1,
  },
  quickConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EA580C',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 9,
  },
  quickConfirmText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  camCard: {
    position: 'relative',
    backgroundColor: '#090D16',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  loadingCam: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 24,
  },
  loadingCamText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  scanReticle: {
    position: 'absolute',
    top: 20,
    bottom: 20,
    left: 20,
    right: 20,
    pointerEvents: 'none',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 8,
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#EA580C',
  },
  cTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  cTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  cBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  cBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  scanReticleText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  scanningCover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  scanningCoverText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  camErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  camErrorText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  uploadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  uploadInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  uploadTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  uploadSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#334155',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  uploadBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  manualCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  label: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 44,
    color: '#FFFFFF',
    backgroundColor: '#090D16',
    fontSize: 14,
    fontWeight: '600',
  },
  primaryBtn: {
    backgroundColor: '#EA580C',
    borderRadius: 10,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  cancelBtn: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 13,
  },
});
