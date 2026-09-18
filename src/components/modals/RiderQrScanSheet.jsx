import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import BootstrapIcon from '../common/BootstrapIcon';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/**
 * Full-screen QR scanner for riders.
 * Prefers the system barcode scanner (reliable on Expo Go), falls back to CameraView.
 */
export default function RiderQrScanSheet({ visible, order, onClose, onScanned }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [paste, setPaste] = useState('');
  const [camError, setCamError] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [ready, setReady] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [usePreview, setUsePreview] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const lockedRef = useRef(false);
  const subRef = useRef(null);

  const emitScan = useCallback(
    (value) => {
      const data = String(value || '').trim();
      if (!data || lockedRef.current) return;
      lockedRef.current = true;
      setScanned(true);
      try {
        CameraView.dismissScanner?.();
      } catch (_e) {}
      onScanned?.(data);
    },
    [onScanned]
  );

  const startSystemScanner = useCallback(async () => {
    if (Platform.OS === 'web') return false;
    try {
      if (!CameraView.isModernBarcodeScannerAvailable) return false;

      subRef.current?.remove?.();
      subRef.current = CameraView.onModernBarcodeScanned((event) => {
        const data = event?.data || event?.nativeEvent?.data;
        emitScan(data);
      });

      await CameraView.launchScanner({
        barcodeTypes: ['qr'],
      });
      return true;
    } catch (e) {
      setCamError(e?.message || 'System scanner could not open. Trying in-app camera…');
      return false;
    }
  }, [emitScan]);

  const ensurePermissionAndScan = useCallback(async () => {
    setCamError('');
    setScanned(false);
    lockedRef.current = false;
    setCameraReady(false);

    let granted = Boolean(permission?.granted);
    if (!granted) {
      const res = await requestPermission();
      granted = Boolean(res?.granted);
    }
    if (!granted) {
      setCamError('Camera permission is needed to scan the order QR code.');
      setShowPaste(true);
      setUsePreview(false);
      return;
    }

    setReady(true);
    const opened = await startSystemScanner();
    if (!opened) {
      // Fall back to embedded CameraView preview (no overflow clipping).
      setUsePreview(true);
    } else {
      setUsePreview(false);
    }
  }, [permission?.granted, requestPermission, startSystemScanner]);

  useEffect(() => {
    if (!visible) {
      lockedRef.current = false;
      setScanned(false);
      setPaste('');
      setCamError('');
      setShowPaste(false);
      setReady(false);
      setUsePreview(false);
      setCameraReady(false);
      try {
        CameraView.dismissScanner?.();
      } catch (_e) {}
      subRef.current?.remove?.();
      subRef.current = null;
      return undefined;
    }

    ensurePermissionAndScan();

    return () => {
      try {
        CameraView.dismissScanner?.();
      } catch (_e) {}
      subRef.current?.remove?.();
      subRef.current = null;
    };
  }, [visible, ensurePermissionAndScan]);

  const handleBarcode = useCallback(
    (result) => {
      emitScan(result?.data);
    },
    [emitScan]
  );

  if (!visible) return null;

  const showCameraPreview =
    Platform.OS !== 'web' && ready && usePreview && Boolean(permission?.granted) && !scanned;

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Full-bleed camera — never clip with borderRadius/overflow or preview goes black */}
      {showCameraPreview ? (
        <CameraView
          style={styles.cameraFull}
          facing="back"
          active
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scanned ? undefined : handleBarcode}
          onCameraReady={() => setCameraReady(true)}
          onMountError={(e) => {
            const msg = e?.message || e?.nativeEvent?.message || 'Camera failed to start';
            setCamError(msg);
            setShowPaste(true);
            setUsePreview(false);
          }}
        />
      ) : (
        <View style={styles.cameraPlaceholder} />
      )}

      {/* Dark vignette so text stays readable over live camera */}
      <View style={styles.topShade} pointerEvents="none" />
      <View style={styles.bottomShade} pointerEvents="none" />

      <SafeAreaView style={styles.safe} pointerEvents="box-none">
        <View style={styles.topBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>MotoTrack Rider</Text>
            <Text style={styles.title}>Scan order QR</Text>
            <Text style={styles.hint}>
              {order?.orderId
                ? `Scan the packing label for order #${order.orderId}.`
                : 'Scan the customer packing-label QR.'}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityRole="button">
            <BootstrapIcon name="x-lg" size={16} color="#E2E8F0" />
          </TouchableOpacity>
        </View>

        <View style={styles.mid} pointerEvents="box-none">
          {showCameraPreview ? (
            <View style={styles.frame} pointerEvents="none">
              <Text style={styles.frameLabel}>
                {cameraReady ? 'Align QR inside the box' : 'Starting camera…'}
              </Text>
            </View>
          ) : (
            <View style={styles.centerCard}>
              {!ready ? <ActivityIndicator color="#FFFFFF" size="large" /> : null}
              <BootstrapIcon name="qr-code-scan" size={40} color="#5EEAD4" />
              <Text style={styles.centerTitle}>
                {Platform.OS === 'web'
                  ? 'Use paste on web'
                  : scanned
                    ? 'QR captured…'
                    : 'Camera scanner'}
              </Text>
              <Text style={styles.centerBody}>
                {Platform.OS === 'web'
                  ? 'Paste the packing-label link below. On a phone in Expo Go, the system camera scanner opens.'
                  : 'Tap the button below to open the device QR scanner.'}
              </Text>
              {Platform.OS !== 'web' ? (
                <TouchableOpacity style={styles.primaryBtn} onPress={ensurePermissionAndScan}>
                  <BootstrapIcon name="camera-fill" size={16} color="#FFFFFF" />
                  <Text style={styles.primaryBtnText}>Open camera scanner</Text>
                </TouchableOpacity>
              ) : null}
              {Platform.OS !== 'web' ? (
                <TouchableOpacity
                  style={styles.ghostCamBtn}
                  onPress={async () => {
                    const res = permission?.granted ? { granted: true } : await requestPermission();
                    if (!res?.granted && !permission?.granted) {
                      setCamError('Camera permission is needed.');
                      setShowPaste(true);
                      return;
                    }
                    setReady(true);
                    setUsePreview(true);
                  }}
                >
                  <Text style={styles.ghostCamBtnText}>Use in-app camera preview</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </View>

        {camError ? <Text style={styles.warn}>{camError}</Text> : null}

        <View style={styles.bottomPanel}>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => setShowPaste((v) => !v)}
            accessibilityRole="button"
          >
            <BootstrapIcon name="clipboard" size={14} color="#0C6258" />
            <Text style={styles.secondaryBtnText}>
              {showPaste ? 'Hide paste option' : 'Paste QR link instead'}
            </Text>
          </TouchableOpacity>

          {showPaste ? (
            <View style={styles.pasteBlock}>
              <Text style={styles.label}>Paste the QR link / token</Text>
              <TextInput
                style={styles.input}
                value={paste}
                onChangeText={setPaste}
                placeholder="Paste confirm link"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[styles.primaryBtn, !paste.trim() && { opacity: 0.55 }]}
                disabled={!paste.trim()}
                accessibilityRole="button"
                onPress={() => emitScan(paste.trim())}
              >
                <Text style={styles.primaryBtnText}>Verify this QR</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} accessibilityRole="button">
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: '#000000',
    width: SCREEN_W,
    height: SCREEN_H,
  },
  cameraFull: {
    ...StyleSheet.absoluteFillObject,
    width: SCREEN_W,
    height: SCREEN_H,
  },
  cameraPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0B1220',
  },
  topShade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 160,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  bottomShade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 220,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 16 : 8,
    paddingBottom: 12,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    color: '#5EEAD4',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', marginTop: 2 },
  hint: { fontSize: 13, color: '#E2E8F0', marginTop: 4, lineHeight: 18 },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(148,163,184,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mid: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  frame: {
    width: Math.min(260, SCREEN_W - 48),
    height: Math.min(260, SCREEN_W - 48),
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#5EEAD4',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 12,
    backgroundColor: 'transparent',
  },
  frameLabel: {
    color: '#E2E8F0',
    fontWeight: '700',
    fontSize: 13,
    backgroundColor: 'rgba(15,23,42,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: 'hidden',
  },
  centerCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: 'rgba(17,24,39,0.92)',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  centerTitle: { fontSize: 18, fontWeight: '900', color: '#F8FAFC', textAlign: 'center' },
  centerBody: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 19 },
  warn: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FCA5A5',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  bottomPanel: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 10 : 18,
    gap: 10,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
  },
  secondaryBtnText: { color: '#0C6258', fontWeight: '800', fontSize: 13 },
  pasteBlock: { gap: 8 },
  label: { fontSize: 12, fontWeight: '800', color: '#CBD5E1' },
  input: {
    borderWidth: 1.5,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 46,
    color: '#F8FAFC',
    backgroundColor: '#111827',
  },
  primaryBtn: {
    backgroundColor: '#0C6258',
    borderRadius: 14,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    width: '100%',
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800' },
  ghostCamBtn: { paddingVertical: 8 },
  ghostCamBtnText: { color: '#5EEAD4', fontWeight: '700', fontSize: 13 },
  cancelBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { color: '#94A3B8', fontWeight: '700', fontSize: 14 },
});
