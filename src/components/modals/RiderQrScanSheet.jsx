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
  Animated,
  Easing,
  Modal,
  Linking,
  KeyboardAvoidingView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import BootstrapIcon from '../common/BootstrapIcon.jsx';
import { parseDeliveryQrPayload, sameOrderIdentifier } from '../../utils/orderIdentifier.js';

/**
 * Minimal full-screen QR scanner for MotoTrack riders (native iOS / Android via expo-camera).
 *
 * Long-distance scanning strategy (expo-camera SDK 58):
 * - `autofocus="off"` = continuous autofocus ("focus automatically when needed").
 *   `"on"` would focus once and lock, which breaks scanning as the rider moves.
 * - Highest practical resolution: Android's barcode analyzer already runs on
 *   `HIGHEST_AVAILABLE_STRATEGY`; on iOS the session uses the full-resolution `Photo` preset.
 * - Native detectors (ML Kit / AVFoundation) scan the full frame continuously, so small
 *   codes outside the guide frame are still decoded.
 * - Auto-zoom sweep: while nothing is decoded, zoom steps 1× → 1.5× → 2× → 3× and back,
 *   which enlarges distant codes for the detector. Auto-zoom is capped at ~3× (manual at ~4×)
 *   so digital zoom never degrades the image beyond what the decoder can use.
 *
 * Props: `{ visible, order, onClose, onScanned }`. Once a valid MotoTrack QR or parcel barcode
 * is detected, the scanner locks out duplicate frames, briefly flashes "QR code detected!",
 * and automatically invokes `onScanned(raw)` so `RiderDashboard` can verify the order and open
 * the `RiderDeliveryConfirmSheet` order confirmation modal.
 */

const COLORS = {
  bg: '#FFFFFF',
  charcoal: '#24272B',
  text: '#111827',
  muted: '#6B7280',
  line: '#E5E7EB',
  soft: '#F3F4F6',
  orange: '#EA580C',
  success: '#059669',
  warn: '#B45309',
  danger: '#DC2626',
  preview: '#111315',
};

// Preserves compatibility with existing order QR codes and packing-label barcodes.
const BARCODE_SETTINGS = {
  barcodeTypes: ['qr', 'code128', 'code39', 'code93', 'ean13', 'ean8', 'upc_a', 'upc_e'],
};

// Approximate optical magnification steps shown to the user.
const ZOOM_STEPS = [1, 1.5, 2, 3, 4];
const AUTO_ZOOM_MAX_STEP = 3; // auto sweep stops at ~3× to keep the image sharp
const AUTO_ZOOM_DWELL_MS = 2200; // time per zoom step (lets autofocus settle)
const UNREADABLE_AFTER_MS = 9000; // roughly one full auto-zoom sweep
const INVALID_REPEAT_MS = 2500; // ignore the same non-MotoTrack code for this long
const INVALID_RESET_MS = 3000;

// expo-camera `zoom` is 0–1 of the device's max zoom, mapped differently per platform:
//   Android (CameraX): ratio = zoom × maxZoomRatio  → linear
//   iOS (AVFoundation): factor = (maxFactor / wideFactor) ^ zoom → exponential
// The device maximum is not exposed, so typical values are assumed.
const ANDROID_ASSUMED_MAX_ZOOM_RATIO = 8;
const IOS_ASSUMED_ZOOM_RANGE = 30;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function zoomPropForMagnification(mag) {
  if (!mag || mag <= 1) return 0;
  if (Platform.OS === 'ios') {
    return clamp(Math.log(mag) / Math.log(IOS_ASSUMED_ZOOM_RANGE), 0, 1);
  }
  return clamp(mag / ANDROID_ASSUMED_MAX_ZOOM_RATIO, 0, 1);
}

function formatZoom(mag) {
  return `${Number.isInteger(mag) ? mag.toFixed(0) : mag.toFixed(1)}×`;
}

function isUsablePayload(parsed) {
  return Boolean(parsed) && parsed.kind !== 'invalid' && parsed.kind !== 'empty';
}

const STATUS_COPY = {
  searching: { text: 'Searching for QR code...', icon: null, color: COLORS.charcoal },
  detected: { text: 'QR code detected!', icon: 'check-circle-fill', color: COLORS.success },
  unreadable: {
    text: 'Unable to read QR code. Move closer or adjust focus.',
    icon: 'exclamation-circle',
    color: COLORS.warn,
  },
  invalid: {
    text: 'This is not a MotoTrack order QR code.',
    icon: 'exclamation-circle-fill',
    color: COLORS.danger,
  },
};

export default function RiderQrScanSheet({
  visible,
  order,
  orderId: orderIdProp,
  customerName: customerNameProp,
  onClose,
  onScanned,
  onScan,
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [camError, setCamError] = useState('');
  const [status, setStatus] = useState('searching'); // searching | unreadable | invalid | detected
  const [result, setResult] = useState(null); // { raw, parsed }
  const [submitting, setSubmitting] = useState(false);
  const [zoomStep, setZoomStep] = useState(0);
  const [autoZoom, setAutoZoom] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [paste, setPaste] = useState('');
  const [manualError, setManualError] = useState('');
  const [previewBox, setPreviewBox] = useState({ width: 0, height: 0 });

  const lockedRef = useRef(false); // blocks duplicate detections
  const submittedRef = useRef(false); // blocks duplicate submissions to the backend
  const autoEmitTimerRef = useRef(null);
  const emitScannedRef = useRef(onScanned || onScan);
  emitScannedRef.current = onScanned || onScan;
  const lastInvalidRef = useRef({ raw: '', at: 0 });
  const permissionAskedRef = useRef(false);
  const scanAnim = useRef(new Animated.Value(0)).current;

  const clearAutoEmitTimer = useCallback(() => {
    if (autoEmitTimerRef.current) {
      clearTimeout(autoEmitTimerRef.current);
      autoEmitTimerRef.current = null;
    }
  }, []);

  const isWeb = Platform.OS === 'web';
  const hasPermission = Boolean(permission?.granted);
  const isDetected = status === 'detected';
  const cameraSupported = !isWeb && !camError;
  const cameraLive = Boolean(visible) && cameraSupported && hasPermission && !isDetected && !submitting;
  const scanningActive = cameraLive && cameraReady;

  // Fresh session every time the scanner opens; the camera unmounts (and is released) on close.
  useEffect(() => {
    clearAutoEmitTimer();
    if (!visible) {
      permissionAskedRef.current = false;
      return undefined;
    }
    lockedRef.current = false;
    submittedRef.current = false;
    lastInvalidRef.current = { raw: '', at: 0 };
    setStatus('searching');
    setResult(null);
    setSubmitting(false);
    setZoomStep(0);
    setAutoZoom(true);
    setTorchOn(false);
    setManualOpen(false);
    setPaste('');
    setManualError('');
    setCamError('');
    setCameraReady(false);
    return () => clearAutoEmitTimer();
  }, [visible, clearAutoEmitTimer]);

  // Ask for camera permission once per opening.
  useEffect(() => {
    if (!visible || isWeb || !permission) return;
    if (!permission.granted && permission.canAskAgain && !permissionAskedRef.current) {
      permissionAskedRef.current = true;
      requestPermission().catch(() => {});
    }
  }, [visible, isWeb, permission, requestPermission]);

  // Animated orange scanning line.
  useEffect(() => {
    if (!scanningActive) {
      scanAnim.stopAnimation();
      scanAnim.setValue(0);
      return undefined;
    }
    const useNativeDriver = Platform.OS !== 'web';
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver,
        }),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scanningActive, scanAnim]);

  // Automatic zoom sweep while no code has been decoded (stops on manual zoom).
  useEffect(() => {
    if (!scanningActive || !autoZoom) return undefined;
    const id = setInterval(() => {
      setZoomStep((s) => (s >= AUTO_ZOOM_MAX_STEP ? 0 : s + 1));
    }, AUTO_ZOOM_DWELL_MS);
    return () => clearInterval(id);
  }, [scanningActive, autoZoom]);

  // Guidance when nothing is readable after a full sweep.
  useEffect(() => {
    if (!scanningActive || status !== 'searching') return undefined;
    const id = setTimeout(() => {
      setStatus((s) => (s === 'searching' ? 'unreadable' : s));
    }, UNREADABLE_AFTER_MS);
    return () => clearTimeout(id);
  }, [scanningActive, status]);

  // A non-MotoTrack code message clears itself and scanning continues.
  useEffect(() => {
    if (status !== 'invalid') return undefined;
    const id = setTimeout(() => {
      setStatus((s) => (s === 'invalid' ? 'searching' : s));
    }, INVALID_RESET_MS);
    return () => clearTimeout(id);
  }, [status]);

  const handleBarcodeScanned = useCallback(
    (event) => {
      if (lockedRef.current) return;
      const raw = String(event?.data ?? event?.nativeEvent?.data ?? '').trim();
      if (!raw) return;

      const parsed = parseDeliveryQrPayload(raw);
      if (!isUsablePayload(parsed)) {
        const now = Date.now();
        const last = lastInvalidRef.current;
        if (last.raw === raw && now - last.at < INVALID_REPEAT_MS) return;
        lastInvalidRef.current = { raw, at: now };
        setStatus('invalid');
        return;
      }

      lockedRef.current = true;
      setTorchOn(false);
      setResult({ raw, parsed });
      setStatus('detected');
      clearAutoEmitTimer();
      autoEmitTimerRef.current = setTimeout(() => {
        autoEmitTimerRef.current = null;
        if (submittedRef.current) return;
        submittedRef.current = true;
        setSubmitting(true);
        emitScannedRef.current?.(raw);
      }, 180);
    },
    [clearAutoEmitTimer]
  );

  const handleConfirm = useCallback(() => {
    if (!result?.raw || submittedRef.current) return;
    clearAutoEmitTimer();
    submittedRef.current = true;
    setSubmitting(true);
    emitScannedRef.current?.(result.raw);
  }, [result, clearAutoEmitTimer]);

  const handleScanAgain = useCallback(() => {
    if (submittedRef.current) return;
    clearAutoEmitTimer();
    lockedRef.current = false;
    lastInvalidRef.current = { raw: '', at: 0 };
    setResult(null);
    setStatus('searching');
    setCameraReady(false);
    setZoomStep(0);
    setAutoZoom(true);
  }, [clearAutoEmitTimer]);

  const handleManualSubmit = useCallback(
    (value) => {
      const raw = String(value || '').trim();
      if (!raw || submittedRef.current) return;
      const parsed = parseDeliveryQrPayload(raw);
      if (!isUsablePayload(parsed)) {
        setManualError('Enter a valid order number, tracking ID, or delivery link.');
        return;
      }
      clearAutoEmitTimer();
      submittedRef.current = true;
      lockedRef.current = true;
      setManualError('');
      setSubmitting(true);
      emitScannedRef.current?.(raw);
    },
    [clearAutoEmitTimer]
  );

  const changeZoom = useCallback((delta) => {
    setAutoZoom(false);
    setZoomStep((s) => clamp(s + delta, 0, ZOOM_STEPS.length - 1));
    setStatus((s) => (s === 'unreadable' ? 'searching' : s));
  }, []);

  const handlePermissionPress = useCallback(() => {
    if (permission && !permission.canAskAgain) {
      Linking.openSettings?.().catch(() => {});
      return;
    }
    requestPermission().catch(() => {});
  }, [permission, requestPermission]);

  const handleClose = useCallback(() => {
    clearAutoEmitTimer();
    onClose?.();
  }, [clearAutoEmitTimer, onClose]);

  const handleRequestClose = useCallback(() => {
    if (manualOpen) {
      setManualOpen(false);
      return;
    }
    handleClose();
  }, [manualOpen, handleClose]);

  const targetOrderId = order?.orderId || order?.order_id || orderIdProp || '';
  const customerName = order?.customerName || order?.customer_name || customerNameProp || '';
  const zoomMag = ZOOM_STEPS[zoomStep];
  const shortSide = Math.min(previewBox.width, previewBox.height) || 260;
  const frameSize = Math.round(clamp(shortSide * 0.66, 160, 280));
  const laserTranslateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [6, Math.max(8, frameSize - 8)],
  });

  const parsed = result?.parsed;
  const orderMismatch = Boolean(
    targetOrderId && parsed?.orderId && !sameOrderIdentifier(targetOrderId, parsed.orderId)
  );

  const renderPreview = () => {
    if (isDetected && parsed) {
      return (
        <View style={styles.resultWrap}>
          <View style={styles.resultIcon}>
            <BootstrapIcon name="check-circle-fill" size={34} color={COLORS.success} />
          </View>
          <Text style={styles.resultTitle}>QR code detected!</Text>
          {parsed.orderId ? (
            <>
              <Text style={styles.resultLabel}>Order</Text>
              <Text style={styles.resultValue} numberOfLines={2}>
                #{parsed.orderId}
              </Text>
            </>
          ) : null}
          {parsed.token ? (
            <Text style={styles.resultMeta}>Secure delivery confirmation code</Text>
          ) : null}
          {orderMismatch ? (
            <Text style={styles.resultWarn}>
              This code does not match order #{targetOrderId}.
            </Text>
          ) : null}
        </View>
      );
    }

    if (submitting) {
      return (
        <View style={styles.stateWrap}>
          <ActivityIndicator color={COLORS.orange} />
          <Text style={styles.stateBody}>Verifying order…</Text>
        </View>
      );
    }

    if (!cameraSupported) {
      return (
        <View style={styles.stateWrap}>
          <BootstrapIcon name="camera-fill" size={28} color={COLORS.muted} />
          <Text style={styles.stateTitle}>Camera unavailable</Text>
          <Text style={styles.stateBody}>
            {camError || 'Live scanning is not available here. Enter the code manually instead.'}
          </Text>
        </View>
      );
    }

    if (!permission) {
      return (
        <View style={styles.stateWrap}>
          <ActivityIndicator color={COLORS.orange} />
          <Text style={styles.stateBody}>Starting camera…</Text>
        </View>
      );
    }

    if (!hasPermission) {
      return (
        <View style={styles.stateWrap}>
          <BootstrapIcon name="camera-fill" size={28} color={COLORS.charcoal} />
          <Text style={styles.stateTitle}>Camera access needed</Text>
          <Text style={styles.stateBody}>Allow camera access to scan order QR codes.</Text>
          <TouchableOpacity
            style={styles.stateBtn}
            onPress={handlePermissionPress}
            accessibilityRole="button"
            accessibilityLabel={permission.canAskAgain ? 'Allow camera access' : 'Open settings'}
          >
            <Text style={styles.stateBtnText}>
              {permission.canAskAgain ? 'Allow camera' : 'Open settings'}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          // 'off' = continuous autofocus in expo-camera SDK 58 ('on' focuses once and locks).
          autofocus="off"
          zoom={zoomPropForMagnification(zoomMag)}
          enableTorch={torchOn}
          animateShutter={false}
          {...(Platform.OS === 'ios' ? { pictureSize: 'Photo' } : null)}
          barcodeScannerSettings={BARCODE_SETTINGS}
          onBarcodeScanned={cameraLive ? handleBarcodeScanned : undefined}
          onCameraReady={() => setCameraReady(true)}
          onMountError={(e) => {
            const msg = e?.message || e?.nativeEvent?.message || 'The camera could not be started.';
            setCamError(msg);
          }}
        />

        <View style={styles.frameLayer} pointerEvents="none">
          <View style={{ width: frameSize, height: frameSize }}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            {scanningActive ? (
              <Animated.View
                style={[styles.laser, { transform: [{ translateY: laserTranslateY }] }]}
              />
            ) : null}
          </View>
        </View>

        {!cameraReady ? (
          <View style={styles.loadingLayer} pointerEvents="none">
            <ActivityIndicator color="#FFFFFF" />
          </View>
        ) : null}
      </>
    );
  };

  const statusCopy = submitting
    ? { text: 'Verifying order…', icon: null, color: COLORS.charcoal }
    : STATUS_COPY[status] || STATUS_COPY.searching;
  const showStatus = submitting || isDetected || cameraLive;

  return (
    <Modal
      visible={Boolean(visible)}
      animationType="fade"
      transparent={false}
      onRequestClose={handleRequestClose}
      statusBarTranslucent
    >
      {visible ? (
        <SafeAreaView style={styles.root}>
          <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.flex}>
                <Text style={styles.title}>Scan QR Code</Text>
                <Text style={styles.subtitle}>Position the QR code within the camera.</Text>
                {targetOrderId ? (
                  <Text style={styles.orderHint} numberOfLines={1}>
                    Order #{targetOrderId}
                    {customerName ? ` · ${customerName}` : ''}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={handleClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Close scanner"
              >
                <BootstrapIcon name="x-lg" size={16} color={COLORS.charcoal} />
              </TouchableOpacity>
            </View>

          {/* Camera preview */}
          <View
            style={[styles.preview, (isDetected || !cameraLive) && styles.previewLight]}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              setPreviewBox((prev) =>
                prev.width === width && prev.height === height ? prev : { width, height }
              );
            }}
          >
            {renderPreview()}
          </View>

          {/* Scanning status */}
          {showStatus ? (
            <View style={styles.statusRow} accessibilityLiveRegion="polite">
              {submitting ? (
                <ActivityIndicator size="small" color={COLORS.orange} />
              ) : statusCopy.icon ? (
                <BootstrapIcon name={statusCopy.icon} size={15} color={statusCopy.color} />
              ) : (
                <View style={styles.statusDot} />
              )}
              <Text style={[styles.statusText, { color: statusCopy.color }]}>{statusCopy.text}</Text>
            </View>
          ) : null}

          {/* Controls / result actions */}
          <View style={styles.footer}>
            {isDetected ? (
              <>
                <TouchableOpacity
                  style={[styles.primaryBtn, submitting && styles.btnDisabled]}
                  onPress={handleConfirm}
                  disabled={submitting}
                  accessibilityRole="button"
                  accessibilityLabel="Confirm scanned QR code"
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Confirm</Text>
                  )}
                </TouchableOpacity>
                {!submitting ? (
                  <TouchableOpacity
                    style={styles.textBtn}
                    onPress={handleScanAgain}
                    accessibilityRole="button"
                  >
                    <Text style={styles.textBtnText}>Scan again</Text>
                  </TouchableOpacity>
                ) : null}
              </>
            ) : (
              <>
                {cameraLive ? (
                  <View style={styles.controlsRow}>
                    <View style={styles.controlSpacer} />
                    <View style={styles.zoomGroup}>
                      <TouchableOpacity
                        style={[styles.zoomBtn, zoomStep === 0 && styles.btnDisabled]}
                        onPress={() => changeZoom(-1)}
                        disabled={zoomStep === 0}
                        accessibilityRole="button"
                        accessibilityLabel="Zoom out"
                      >
                        <BootstrapIcon name="dash-lg" size={18} color={COLORS.charcoal} />
                      </TouchableOpacity>
                      <View style={styles.zoomValueWrap}>
                        <Text style={styles.zoomValue}>{formatZoom(zoomMag)}</Text>
                        {autoZoom ? <Text style={styles.zoomAuto}>Auto</Text> : null}
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.zoomBtn,
                          zoomStep === ZOOM_STEPS.length - 1 && styles.btnDisabled,
                        ]}
                        onPress={() => changeZoom(1)}
                        disabled={zoomStep === ZOOM_STEPS.length - 1}
                        accessibilityRole="button"
                        accessibilityLabel="Zoom in"
                      >
                        <BootstrapIcon name="plus-lg" size={18} color={COLORS.charcoal} />
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      style={[styles.torchBtn, torchOn && styles.torchBtnOn]}
                      onPress={() => setTorchOn((v) => !v)}
                      disabled={!cameraReady}
                      accessibilityRole="button"
                      accessibilityLabel={torchOn ? 'Turn flashlight off' : 'Turn flashlight on'}
                    >
                      <BootstrapIcon
                        name={torchOn ? 'lightning-charge-fill' : 'lightning-charge'}
                        size={18}
                        color={torchOn ? '#FFFFFF' : COLORS.charcoal}
                      />
                    </TouchableOpacity>
                  </View>
                ) : null}

                {manualOpen || !cameraSupported ? (
                  <View style={styles.manualWrap}>
                    <TextInput
                      style={styles.input}
                      value={paste}
                      onChangeText={(v) => {
                        setPaste(v);
                        if (manualError) setManualError('');
                      }}
                      placeholder={targetOrderId ? `e.g. ${targetOrderId}` : 'Order number or delivery link'}
                      placeholderTextColor="#9CA3AF"
                      autoCapitalize="characters"
                      autoCorrect={false}
                      returnKeyType="done"
                      editable={!submitting}
                      onSubmitEditing={() => handleManualSubmit(paste)}
                    />
                    {manualError ? <Text style={styles.manualError}>{manualError}</Text> : null}
                    <TouchableOpacity
                      style={[styles.primaryBtn, (!paste.trim() || submitting) && styles.btnDisabled]}
                      disabled={!paste.trim() || submitting}
                      onPress={() => handleManualSubmit(paste)}
                      accessibilityRole="button"
                    >
                      {submitting ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.primaryBtnText}>Verify code</Text>
                      )}
                    </TouchableOpacity>
                    {targetOrderId && !submitting ? (
                      <TouchableOpacity
                        style={styles.textBtn}
                        onPress={() => handleManualSubmit(targetOrderId)}
                        accessibilityRole="button"
                      >
                        <Text style={styles.textBtnText}>
                          Confirm order #{targetOrderId} without scanning
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}

                {cameraSupported && !submitting ? (
                  <TouchableOpacity
                    style={styles.textBtn}
                    onPress={() => setManualOpen((v) => !v)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.textBtnText}>
                      {manualOpen ? 'Hide manual entry' : 'Enter code manually'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </>
            )}
          </View>
        </KeyboardAvoidingView>
        </SafeAreaView>
      ) : null}
    </Modal>
  );
}

const CORNER = 28;
const CORNER_W = 3;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.25,
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    color: COLORS.muted,
    marginTop: 2,
  },
  orderHint: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: COLORS.charcoal,
    marginTop: 6,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: {
    flex: 1,
    minHeight: 200,
    marginHorizontal: 16,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: COLORS.preview,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewLight: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  frameLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: '#FFFFFF',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_W,
    borderLeftWidth: CORNER_W,
    borderTopLeftRadius: 14,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_W,
    borderRightWidth: CORNER_W,
    borderTopRightRadius: 14,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_W,
    borderLeftWidth: CORNER_W,
    borderBottomLeftRadius: 14,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_W,
    borderRightWidth: CORNER_W,
    borderBottomRightRadius: 14,
  },
  laser: {
    position: 'absolute',
    top: 0,
    left: 10,
    right: 10,
    height: 2,
    borderRadius: 1,
    backgroundColor: COLORS.orange,
  },
  loadingLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.preview,
  },
  stateWrap: {
    alignItems: 'center',
    paddingHorizontal: 28,
    gap: 8,
    maxWidth: 340,
  },
  stateTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 4,
    textAlign: 'center',
  },
  stateBody: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    color: COLORS.muted,
    textAlign: 'center',
  },
  stateBtn: {
    marginTop: 8,
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: COLORS.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  resultWrap: {
    alignItems: 'center',
    paddingHorizontal: 24,
    maxWidth: 360,
  },
  resultIcon: {
    marginBottom: 10,
  },
  resultTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 14,
  },
  resultLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: COLORS.muted,
  },
  resultValue: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 2,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  resultMeta: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: COLORS.charcoal,
    marginTop: 8,
    textAlign: 'center',
  },
  resultWarn: {
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '500',
    color: COLORS.warn,
    marginTop: 10,
    textAlign: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 14,
    minHeight: 34,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.orange,
  },
  statusText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    textAlign: 'center',
    flexShrink: 1,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 8 : 16,
    gap: 6,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  controlSpacer: {
    width: 48,
    height: 48,
  },
  zoomGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.soft,
    borderRadius: 999,
    padding: 4,
  },
  zoomBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomValueWrap: {
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomValue: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    color: COLORS.text,
    fontVariant: ['tabular-nums'],
  },
  zoomAuto: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: COLORS.orange,
  },
  torchBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  torchBtnOn: {
    backgroundColor: COLORS.orange,
  },
  manualWrap: {
    gap: 8,
    marginTop: 4,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    backgroundColor: COLORS.bg,
  },
  manualError: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: COLORS.danger,
  },
  primaryBtn: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: COLORS.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  textBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  textBtnText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: COLORS.muted,
    textAlign: 'center',
  },
});
