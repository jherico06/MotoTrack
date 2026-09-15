import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
  Animated,
  Easing,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon';
import { adminSecurityService } from '../../services/adminSecurityService';

export default function AdminPinLockScreen({
  visible = true,
  onUnlockSuccess,
  onNavigateToStore,
  adminUser = null,
}) {
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  // PIN Input State
  const [pin, setPin] = useState('');
  const [showDigits, setShowDigits] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(3);

  // Change PIN Modal State (when current PIN is known)
  const [isChangePinOpen, setIsChangePinOpen] = useState(false);
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [changePinError, setChangePinError] = useState('');
  const [changePinSuccess, setChangePinSuccess] = useState('');
  const [isSavingPin, setIsSavingPin] = useState(false);

  // Forgot PIN Modal State (when PIN is forgotten, verified with account password)
  const [isForgotPinOpen, setIsForgotPinOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotPassword, setForgotPassword] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotNewPin, setForgotNewPin] = useState('');
  const [forgotConfirmPin, setForgotConfirmPin] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [isForgotSubmitting, setIsForgotSubmitting] = useState(false);

  // Hidden/Target TextInput ref for keyboard capture
  const inputRef = useRef(null);

  // Shake animation for error
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Pulsing animation for shield glow
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;

    // Refresh PIN from Supabase on popup open
    adminSecurityService.fetchPinFromSupabase(adminUser).catch(() => {});

    // Set default email for forgot PIN modal
    if (adminUser?.email) {
      setForgotEmail(adminUser.email);
    } else {
      setForgotEmail('admin@mototrack.com');
    }

    // Focus input on mount / popup open
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 150);

    // Continuous subtle pulsing shield animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.06,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    return () => clearTimeout(timer);
  }, [visible, adminUser]);

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 3, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleFailedAttempt = () => {
    const nextLeft = attemptsLeft - 1;
    setAttemptsLeft(nextLeft);
    setPin('');
    triggerShake();

    if (nextLeft > 0) {
      setErrorMessage(`Incorrect Security PIN. ${nextLeft} attempt${nextLeft === 1 ? '' : 's'} remaining.`);
      inputRef.current?.focus();
    } else {
      setErrorMessage(
        '⛔ 3 incorrect attempts reached. Please use "Forgot PIN" to reset your PIN with your admin password.'
      );
    }
  };

  const checkPinDirect = async (inputPin) => {
    if (attemptsLeft <= 0) {
      setErrorMessage(
        '⛔ Maximum attempts exceeded. Please click "Forgot PIN" below to verify your admin account and reset your PIN.'
      );
      triggerShake();
      return;
    }

    if (adminSecurityService.verifyPinSync(inputPin, adminUser)) {
      setIsVerifying(true);
      setTimeout(() => {
        setIsVerifying(false);
        setPin('');
        setAttemptsLeft(3);
        onUnlockSuccess?.();
      }, 200);
      return;
    }

    // Try async verification with Supabase
    setIsVerifying(true);
    const res = await adminSecurityService.verifyPin(inputPin, adminUser);
    setIsVerifying(false);

    if (res.success) {
      setPin('');
      setAttemptsLeft(3);
      onUnlockSuccess?.();
    } else {
      handleFailedAttempt();
    }
  };

  const handleVerify = async () => {
    if (attemptsLeft <= 0) {
      setIsForgotPinOpen(true);
      return;
    }
    if (!pin) {
      setErrorMessage('Please enter your 4-digit Admin PIN.');
      triggerShake();
      return;
    }
    await checkPinDirect(pin);
  };

  const handleChangePinSubmit = async () => {
    setChangePinError('');
    setChangePinSuccess('');

    if (!currentPinInput.trim()) {
      setChangePinError('Please enter your current Admin PIN.');
      return;
    }
    if (!newPinInput.trim() || newPinInput.length < 4 || newPinInput.length > 6) {
      setChangePinError('New PIN must be 4 to 6 numeric digits.');
      return;
    }
    if (newPinInput !== confirmPinInput) {
      setChangePinError('New PIN and Confirm PIN do not match.');
      return;
    }

    setIsSavingPin(true);
    const res = await adminSecurityService.setAdminPin(currentPinInput, newPinInput, adminUser);
    setIsSavingPin(false);

    if (res.success) {
      setChangePinSuccess('PIN updated and synced to Supabase database!');
      setTimeout(() => {
        setIsChangePinOpen(false);
        setCurrentPinInput('');
        setNewPinInput('');
        setConfirmPinInput('');
        setChangePinSuccess('');
      }, 1500);
    } else {
      setChangePinError(res.error || 'Failed to update PIN.');
    }
  };

  const handleForgotPinSubmit = async () => {
    setForgotError('');
    setForgotSuccess('');

    if (!forgotEmail.trim() || !forgotPassword) {
      setForgotError('Please enter both your admin email and password.');
      return;
    }
    if (!forgotNewPin.trim() || forgotNewPin.length < 4 || forgotNewPin.length > 6) {
      setForgotError('New PIN must be 4 to 6 numeric digits.');
      return;
    }
    if (forgotNewPin !== forgotConfirmPin) {
      setForgotError('New PIN and Confirm PIN do not match.');
      return;
    }

    setIsForgotSubmitting(true);
    const res = await adminSecurityService.resetPinWithPassword({
      email: forgotEmail.trim(),
      password: forgotPassword,
      newPin: forgotNewPin.trim(),
      user: adminUser,
    });
    setIsForgotSubmitting(false);

    if (res.success) {
      setForgotSuccess('Admin PIN successfully reset and verified with Supabase!');
      setAttemptsLeft(3);
      setErrorMessage('');
      setTimeout(() => {
        setIsForgotPinOpen(false);
        setForgotPassword('');
        setForgotNewPin('');
        setForgotConfirmPin('');
        setForgotSuccess('');
        onUnlockSuccess?.();
      }, 1500);
    } else {
      setForgotError(res.error || 'Failed to verify admin password.');
    }
  };

  // 4 Main PIN Display Digits (or up to pin length)
  const pinDisplayLength = Math.max(4, pin.length);
  const pinSlots = Array.from({ length: pinDisplayLength });
  const isLockedOut = attemptsLeft <= 0;

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onNavigateToStore}>
      <View style={styles.modalOverlay}>
        {/* Hidden TextInput capturing real keystrokes & mobile keyboards */}
        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          value={pin}
          editable={!isLockedOut}
          onChangeText={(text) => {
            if (isLockedOut) return;
            const clean = text.replace(/[^0-9]/g, '').slice(0, 6);
            setErrorMessage('');
            setPin(clean);
            if (clean.length === 4) {
              checkPinDirect(clean);
            }
          }}
          keyboardType="numeric"
          maxLength={6}
          autoFocus={!isLockedOut}
          onSubmitEditing={handleVerify}
        />

        {/* Centered Modal Card */}
        <Animated.View style={[styles.card, { transform: [{ translateX: shakeAnim }] }]}>
          {/* Top Header Row with Return to Store Button & Supabase Badge */}
          <View style={styles.cardHeaderRow}>
            <TouchableOpacity
              style={styles.backToStoreBtn}
              onPress={() => {
                adminSecurityService.lockSession();
                onNavigateToStore?.();
              }}
              activeOpacity={0.8}
            >
              <BootstrapIcon name="arrow-left" size={13} color="#475569" />
              <Text style={styles.backToStoreText}>Return to Store</Text>
            </TouchableOpacity>

            <View style={styles.supabaseBadge}>
              <View style={styles.liveGreenDot} />
              <Text style={styles.supabaseBadgeText}>Supabase Synced</Text>
            </View>
          </View>

          {/* Shield Icon Graphic */}
          <Animated.View
            style={[
              styles.shieldCircle,
              isLockedOut && styles.shieldCircleLocked,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <View style={[styles.shieldInner, isLockedOut && styles.shieldInnerLocked]}>
              <BootstrapIcon
                name={isLockedOut ? 'lock-fill' : 'shield-lock-fill'}
                size={32}
                color={isLockedOut ? '#DC2626' : '#0C6258'}
              />
            </View>
          </Animated.View>

          {/* Title & Subtitle */}
          <Text style={styles.title}>Admin PIN Verification</Text>
          <Text style={styles.subtitle}>
            {isLockedOut
              ? 'Security lockout active due to 3 incorrect attempts. Please verify your admin password to reset your PIN.'
              : 'Enter your authorized 4-digit PIN to access the Store Administrator Dashboard.'}
          </Text>

          {/* Error Alert Box */}
          {errorMessage.length > 0 && (
            <View style={[styles.errorBox, isLockedOut && styles.errorBoxLocked]}>
              <BootstrapIcon
                name={isLockedOut ? 'shield-slash-fill' : 'exclamation-circle-fill'}
                size={14}
                color="#DC2626"
              />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* PIN Digit Slot Indicators (Disabled if locked out) */}
          <TouchableOpacity
            style={[styles.pinSlotsRow, isLockedOut && { opacity: 0.5 }]}
            onPress={() => {
              if (!isLockedOut) inputRef.current?.focus();
            }}
            activeOpacity={isLockedOut ? 1 : 0.95}
          >
            {pinSlots.map((_, index) => {
              const hasDigit = index < pin.length;
              const isCurrent = index === pin.length && !isLockedOut;
              const digitValue = pin[index];

              return (
                <View
                  key={index}
                  style={[
                    styles.pinSlot,
                    hasDigit && styles.pinSlotFilled,
                    isCurrent && styles.pinSlotActive,
                    isLockedOut && { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
                  ]}
                >
                  {hasDigit ? (
                    showDigits ? (
                      <Text style={[styles.pinDigitText, isLockedOut && { color: '#DC2626' }]}>
                        {digitValue}
                      </Text>
                    ) : (
                      <View style={[styles.pinDot, isLockedOut && { backgroundColor: '#DC2626' }]} />
                    )
                  ) : (
                    <View style={styles.pinDotEmpty} />
                  )}
                </View>
              );
            })}

            {/* Toggle Reveal Digits */}
            {!isLockedOut && (
              <TouchableOpacity
                style={styles.revealEyeBtn}
                onPress={() => setShowDigits((prev) => !prev)}
                activeOpacity={0.7}
              >
                <BootstrapIcon name={showDigits ? 'eye-slash-fill' : 'eye-fill'} size={18} color="#64748B" />
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          {/* Attempts Remaining Badge */}
          {!isLockedOut && attemptsLeft < 3 && (
            <View style={styles.attemptsIndicatorRow}>
              <BootstrapIcon name="shield-exclamation" size={13} color="#0C6258" />
              <Text style={styles.attemptsIndicatorText}>
                {attemptsLeft} attempt{attemptsLeft === 1 ? '' : 's'} remaining before lockout
              </Text>
            </View>
          )}

          {/* Primary Action Button: Unlock or Reset */}
          {isLockedOut ? (
            <TouchableOpacity
              style={[styles.unlockBtn, { backgroundColor: '#DC2626' }]}
              onPress={() => {
                setForgotError('');
                setForgotSuccess('');
                setIsForgotPinOpen(true);
              }}
              activeOpacity={0.85}
            >
              <BootstrapIcon name="key-fill" size={15} color="#FFFFFF" />
              <Text style={styles.unlockBtnText}>FORGOT PIN? RESET VIA PASSWORD</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.unlockBtn, isVerifying && { opacity: 0.85 }]}
              onPress={handleVerify}
              activeOpacity={0.85}
              disabled={isVerifying}
            >
              {isVerifying ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <BootstrapIcon name="unlock-fill" size={15} color="#FFFFFF" />
              )}
              <Text style={styles.unlockBtnText}>
                {isVerifying ? 'VERIFYING PIN...' : 'UNLOCK ADMIN DASHBOARD'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Footer Actions & Settings */}
          <View style={styles.cardFooter}>
            <TouchableOpacity
              style={styles.changePinLink}
              onPress={() => {
                setForgotError('');
                setForgotSuccess('');
                setIsForgotPinOpen(true);
              }}
              activeOpacity={0.7}
            >
              <BootstrapIcon name="question-circle-fill" size={13} color="#0C6258" />
              <Text style={styles.changePinLinkText}>Forgot PIN?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.changePinLink}
              onPress={() => {
                setChangePinError('');
                setChangePinSuccess('');
                setIsChangePinOpen(true);
              }}
              activeOpacity={0.7}
            >
              <BootstrapIcon name="key-fill" size={13} color="#64748B" />
              <Text style={[styles.changePinLinkText, { color: '#64748B' }]}>Change PIN</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ─── MODAL 1: FORGOT PIN (RECOVERY VIA ADMIN PASSWORD) ─── */}
        <Modal
          visible={isForgotPinOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsForgotPinOpen(false)}
        >
          <View style={styles.nestedModalBackdrop}>
            <View style={styles.changePinModalBox}>
              <View style={styles.changePinModalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View
                    style={[styles.changePinIconWrap, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}
                  >
                    <BootstrapIcon name="shield-lock-fill" size={18} color="#DC2626" />
                  </View>
                  <View>
                    <Text style={styles.changePinModalTitle}>Forgot Security PIN?</Text>
                    <Text style={styles.changePinModalSub}>Verify admin password to reset PIN</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsForgotPinOpen(false)}>
                  <BootstrapIcon name="x-lg" size={14} color="#64748B" />
                </TouchableOpacity>
              </View>

              {forgotError.length > 0 && (
                <View style={styles.errorBox}>
                  <BootstrapIcon name="exclamation-circle-fill" size={13} color="#DC2626" />
                  <Text style={styles.errorText}>{forgotError}</Text>
                </View>
              )}

              {forgotSuccess.length > 0 && (
                <View style={[styles.errorBox, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                  <BootstrapIcon name="check-circle-fill" size={13} color="#10B981" />
                  <Text style={[styles.errorText, { color: '#047857' }]}>{forgotSuccess}</Text>
                </View>
              )}

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Admin Email Address</Text>
                <TextInput
                  style={styles.formInput}
                  value={forgotEmail}
                  onChangeText={setForgotEmail}
                  placeholder="admin@mototrack.com"
                  placeholderTextColor="#94A3B8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Admin Account Password</Text>
                <View style={{ position: 'relative', justifyContent: 'center' }}>
                  <TextInput
                    style={[styles.formInput, { paddingRight: 40 }]}
                    value={forgotPassword}
                    onChangeText={setForgotPassword}
                    placeholder="Enter your admin account password"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showForgotPassword}
                  />
                  <TouchableOpacity
                    style={{ position: 'absolute', right: 12 }}
                    onPress={() => setShowForgotPassword((prev) => !prev)}
                  >
                    <BootstrapIcon
                      name={showForgotPassword ? 'eye-slash' : 'eye'}
                      size={16}
                      color="#64748B"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Set New 4-Digit PIN</Text>
                <TextInput
                  style={styles.formInput}
                  value={forgotNewPin}
                  onChangeText={setForgotNewPin}
                  placeholder="Enter new 4-digit PIN"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  secureTextEntry
                  maxLength={6}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Confirm New 4-Digit PIN</Text>
                <TextInput
                  style={styles.formInput}
                  value={forgotConfirmPin}
                  onChangeText={setForgotConfirmPin}
                  placeholder="Re-enter new 4-digit PIN"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  secureTextEntry
                  maxLength={6}
                />
              </View>

              <View style={styles.modalActionsRow}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setIsForgotPinOpen(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSaveBtn, isForgotSubmitting && { opacity: 0.8 }]}
                  onPress={handleForgotPinSubmit}
                  activeOpacity={0.85}
                  disabled={isForgotSubmitting}
                >
                  {isForgotSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalSaveText}>Verify & Reset PIN</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ─── MODAL 2: CHANGE ADMIN PIN (WHEN CURRENT PIN IS KNOWN) ─── */}
        <Modal
          visible={isChangePinOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsChangePinOpen(false)}
        >
          <View style={styles.nestedModalBackdrop}>
            <View style={styles.changePinModalBox}>
              <View style={styles.changePinModalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={styles.changePinIconWrap}>
                    <BootstrapIcon name="shield-lock" size={18} color="#0C6258" />
                  </View>
                  <View>
                    <Text style={styles.changePinModalTitle}>Change Security PIN</Text>
                    <Text style={styles.changePinModalSub}>Syncs directly to Supabase cloud</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsChangePinOpen(false)}>
                  <BootstrapIcon name="x-lg" size={14} color="#64748B" />
                </TouchableOpacity>
              </View>

              {changePinError.length > 0 && (
                <View style={styles.errorBox}>
                  <BootstrapIcon name="exclamation-circle-fill" size={13} color="#DC2626" />
                  <Text style={styles.errorText}>{changePinError}</Text>
                </View>
              )}

              {changePinSuccess.length > 0 && (
                <View style={[styles.errorBox, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                  <BootstrapIcon name="check-circle-fill" size={13} color="#10B981" />
                  <Text style={[styles.errorText, { color: '#047857' }]}>{changePinSuccess}</Text>
                </View>
              )}

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Current Admin PIN</Text>
                <TextInput
                  style={styles.formInput}
                  value={currentPinInput}
                  onChangeText={setCurrentPinInput}
                  placeholder="Enter current 4-digit PIN"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  secureTextEntry
                  maxLength={6}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>New 4 to 6-Digit PIN</Text>
                <TextInput
                  style={styles.formInput}
                  value={newPinInput}
                  onChangeText={setNewPinInput}
                  placeholder="Enter new numeric PIN"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  secureTextEntry
                  maxLength={6}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Confirm New PIN</Text>
                <TextInput
                  style={styles.formInput}
                  value={confirmPinInput}
                  onChangeText={setConfirmPinInput}
                  placeholder="Re-enter new numeric PIN"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  secureTextEntry
                  maxLength={6}
                />
              </View>

              <View style={styles.modalActionsRow}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setIsChangePinOpen(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSaveBtn, isSavingPin && { opacity: 0.8 }]}
                  onPress={handleChangePinSubmit}
                  activeOpacity={0.85}
                  disabled={isSavingPin}
                >
                  {isSavingPin ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalSaveText}>Save & Sync</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(6px)' } : {}),
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 99999,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
    top: -100,
    left: -100,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 22,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 24,
  },
  cardHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backToStoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  backToStoreText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  supabaseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3F7F6',
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#D1ECE6',
  },
  liveGreenDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  supabaseBadgeText: {
    color: '#0C6258',
    fontSize: 11.5,
    fontWeight: '800',
  },
  shieldCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F3F7F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#D1ECE6',
    marginBottom: 14,
    shadowColor: '#0C6258',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  shieldCircleLocked: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  shieldInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  shieldInnerLocked: {
    backgroundColor: '#FEE2E2',
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 6,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 14,
    marginBottom: 16,
    width: '100%',
  },
  errorBoxLocked: {
    backgroundColor: '#FFF1F2',
    borderColor: '#F87171',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  pinSlotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 18,
    position: 'relative',
  },
  pinSlot: {
    width: 52,
    height: 58,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinSlotFilled: {
    borderColor: '#0C6258',
    backgroundColor: '#F3F7F6',
  },
  pinSlotActive: {
    borderColor: '#0C6258',
    backgroundColor: '#F3F7F6',
    shadowColor: '#0C6258',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  pinDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#0C6258',
  },
  pinDotEmpty: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#CBD5E1',
  },
  pinDigitText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0C6258',
  },
  revealEyeBtn: {
    padding: 8,
    marginLeft: 4,
  },
  attemptsIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 16,
    backgroundColor: '#F3F7F6',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1ECE6',
  },
  attemptsIndicatorText: {
    color: '#0C6258',
    fontSize: 11.5,
    fontWeight: '700',
  },
  unlockBtn: {
    backgroundColor: '#0C6258',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 16,
    shadowColor: '#0C6258',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  unlockBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cardFooter: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  changePinLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  changePinLinkText: {
    color: '#0C6258',
    fontSize: 12.5,
    fontWeight: '800',
  },

  // ─── NESTED MODAL (LIGHT PALETTE) ───
  nestedModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  changePinModalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 28,
  },
  changePinModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  changePinIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F3F7F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1ECE6',
  },
  changePinModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  changePinModalSub: {
    fontSize: 12,
    color: '#64748B',
  },
  modalCloseBtn: {
    padding: 6,
  },
  formGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#0F172A',
    fontSize: 14,
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  modalCancelText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  modalSaveBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: '#0C6258',
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
