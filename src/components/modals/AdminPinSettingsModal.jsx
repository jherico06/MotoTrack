import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { BootstrapIcon } from '../common';
import { useAuth } from '../../context';
import { adminSecurityService } from '../../services/auth/adminSecurityService.js';

/**
 * Dedicated modal for managing the Store Administrator Security PIN.
 * Separated from Change Password so admins can manage their console lock PIN independently.
 */
export default function AdminPinSettingsModal({
  visible,
  onClose,
  onSaved,
  onSwitchToPassword,
  showToast = () => { },
}) {
  const { currentUser } = useAuth();

  // 'change' (using current PIN) | 'reset' (using admin account password)
  const [mode, setMode] = useState('change');

  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPins, setShowPins] = useState(false);

  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPwd, setShowAdminPwd] = useState(false);

  const [pinMeta, setPinMeta] = useState(() => adminSecurityService.getPinMetadata(currentUser));
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setMode('change');
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setShowPins(false);
    setAdminPassword('');
    setShowAdminPwd(false);
    setError('');
    setSuccess('');
    setPinMeta(adminSecurityService.getPinMetadata(currentUser));
    adminSecurityService
      .getPinStatus(currentUser)
      .then((meta) => {
        if (meta) setPinMeta(meta);
      })
      .catch(() => { });
  }, [visible, currentUser?.id, currentUser?.user_id]);

  const handleSavePin = async () => {
    setError('');
    setSuccess('');

    const cleanNew = newPin.trim();
    const cleanConfirm = confirmPin.trim();

    if (mode === 'change') {
      const cleanCurrent = currentPin.trim();
      if (!cleanCurrent) {
        setError('Please enter your current Admin PIN.');
        return;
      }
      if (!/^\d{4,6}$/.test(cleanNew)) {
        setError('New PIN must be 4 to 6 numeric digits (0–9).');
        return;
      }
      if (cleanNew !== cleanConfirm) {
        setError('New PIN and confirmation do not match.');
        return;
      }
      if (cleanNew === cleanCurrent) {
        setError('New PIN cannot be the same as your current PIN.');
        return;
      }

      setSaving(true);
      try {
        const res = await adminSecurityService.setAdminPin(cleanCurrent, cleanNew, currentUser);
        if (!res?.success) {
          setError(res?.error || 'Could not update Admin Security PIN.');
          setSaving(false);
          return;
        }
        const updatedMeta = adminSecurityService.getPinMetadata(currentUser);
        setPinMeta(updatedMeta);
        const msg = 'Admin Security PIN updated! The previous PIN is now disabled.';
        setSuccess(msg);
        showToast('✓ Admin Security PIN updated successfully.');
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
        onSaved?.(updatedMeta);
      } catch (_e) {
        setError('Something went wrong while updating your Admin PIN.');
      } finally {
        setSaving(false);
      }
    } else {
      // Reset mode using Admin Account Password
      if (!adminPassword) {
        setError('Please enter your admin account login password to authorize PIN reset.');
        return;
      }
      if (!/^\d{4,6}$/.test(cleanNew)) {
        setError('New PIN must be 4 to 6 numeric digits (0–9).');
        return;
      }
      if (cleanNew !== cleanConfirm) {
        setError('New PIN and confirmation do not match.');
        return;
      }

      setSaving(true);
      try {
        const res = await adminSecurityService.resetPinWithPassword({
          email: currentUser?.email || 'admin@mototrack.com',
          password: adminPassword,
          newPin: cleanNew,
          user: currentUser,
        });
        if (!res?.success) {
          setError(res?.error || 'Password verification failed. Could not reset PIN.');
          setSaving(false);
          return;
        }
        const updatedMeta = adminSecurityService.getPinMetadata(currentUser);
        setPinMeta(updatedMeta);
        const msg = 'Admin Security PIN reset and synced to Supabase!';
        setSuccess(msg);
        showToast('✓ Admin Security PIN reset successfully.');
        setAdminPassword('');
        setNewPin('');
        setConfirmPin('');
        setMode('change');
        onSaved?.(updatedMeta);
      } catch (_e) {
        setError('Something went wrong while resetting your Admin PIN.');
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <View style={styles.titleRow}>
                <View style={styles.iconWrap}>
                  <BootstrapIcon name="shield-lock-fill" size={17} color="#EA580C" />
                </View>
                <Text style={styles.title}>Admin Security PIN</Text>
              </View>
              <Text style={styles.subtitle}>
                Change your 4 to 6-digit console lock PIN. Replaces the default given PIN for security.
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <BootstrapIcon name="x-lg" size={14} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            {/* Security Status Banner */}
            <View
              style={[
                styles.pinStatusBanner,
                pinMeta?.isDefaultPin ? styles.pinStatusBannerWarn : styles.pinStatusBannerCustom,
              ]}
            >
              <BootstrapIcon
                name={pinMeta?.isDefaultPin ? 'shield-exclamation' : 'shield-check'}
                size={16}
                color={pinMeta?.isDefaultPin ? '#B45309' : '#059669'}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.pinStatusTitle,
                    { color: pinMeta?.isDefaultPin ? '#92400E' : '#065F46' },
                  ]}
                >
                  {pinMeta?.isDefaultPin
                    ? `Default Given PIN Active (${pinMeta?.defaultPin || '2026'})`
                    : `Custom Security PIN Active (${pinMeta?.pinLength || 4} digits)`}
                </Text>
                <Text
                  style={[
                    styles.pinStatusDesc,
                    { color: pinMeta?.isDefaultPin ? '#B45309' : '#047857' },
                  ]}
                >
                  {pinMeta?.isDefaultPin
                    ? 'Your console is using the default given PIN (2026). Set a new private PIN below to disable 2026.'
                    : 'Your custom Security PIN is active and the default given PIN (2026) is disabled.'}
                </Text>
              </View>
              {mode === 'change' &&
                pinMeta?.isDefaultPin &&
                currentPin !== (pinMeta?.defaultPin || '2026') ? (
                <TouchableOpacity
                  style={styles.fillGivenPinBtn}
                  onPress={() => setCurrentPin(pinMeta?.defaultPin || '2026')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.fillGivenPinText}>Use 2026</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Mode Switcher: Know Current PIN vs Forgot PIN */}
            <View style={styles.pinToggleRow}>
              <Text style={styles.sectionTitle}>
                {mode === 'change' ? 'Change PIN with Current PIN' : 'Reset PIN with Admin Password'}
              </Text>
              <TouchableOpacity
                style={styles.pinToggleBtn}
                onPress={() => setShowPins((v) => !v)}
                activeOpacity={0.8}
              >
                <BootstrapIcon name={showPins ? 'eye-slash' : 'eye'} size={13} color="#EA580C" />
                <Text style={styles.pinToggleText}>{showPins ? 'Hide PIN' : 'Show PIN'}</Text>
              </TouchableOpacity>
            </View>

            {mode === 'change' ? (
              <>
                <Text style={styles.label}>
                  {pinMeta?.isDefaultPin ? 'Current Given PIN (Default: 2026)' : 'Current Admin PIN'}
                </Text>
                <TextInput
                  style={styles.input}
                  value={currentPin}
                  onChangeText={(v) => setCurrentPin(v.replace(/[^\d]/g, '').slice(0, 6))}
                  secureTextEntry={!showPins}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoComplete="off"
                  placeholder={
                    pinMeta?.isDefaultPin
                      ? 'Enter given PIN (2026)'
                      : 'Enter current 4–6 digit PIN'
                  }
                  placeholderTextColor="#94A3B8"
                />
              </>
            ) : (
              <>
                <Text style={styles.label}>Admin Login Password (to verify identity)</Text>
                <View style={styles.pwdWrap}>
                  <TextInput
                    style={styles.pwdInput}
                    value={adminPassword}
                    onChangeText={setAdminPassword}
                    secureTextEntry={!showAdminPwd}
                    autoCapitalize="none"
                    placeholder="Enter your admin login password"
                    placeholderTextColor="#94A3B8"
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowAdminPwd((v) => !v)}
                  >
                    <BootstrapIcon
                      name={showAdminPwd ? 'eye-slash' : 'eye'}
                      size={15}
                      color="#64748B"
                    />
                  </TouchableOpacity>
                </View>
              </>
            )}

            <Text style={styles.label}>New Security PIN (4–6 digits)</Text>
            <TextInput
              style={styles.input}
              value={newPin}
              onChangeText={(v) => setNewPin(v.replace(/[^\d]/g, '').slice(0, 6))}
              secureTextEntry={!showPins}
              keyboardType="number-pad"
              maxLength={6}
              autoComplete="off"
              placeholder="Enter new 4–6 digit PIN"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.label}>Confirm New Security PIN</Text>
            <TextInput
              style={styles.input}
              value={confirmPin}
              onChangeText={(v) => setConfirmPin(v.replace(/[^\d]/g, '').slice(0, 6))}
              secureTextEntry={!showPins}
              keyboardType="number-pad"
              maxLength={6}
              autoComplete="off"
              placeholder="Re-enter new 4–6 digit PIN"
              placeholderTextColor="#94A3B8"
            />

            {/* Secondary Link: Forgot Current PIN / Back to Current PIN */}
            <View style={styles.helperLinksRow}>
              <TouchableOpacity
                onPress={() => {
                  setError('');
                  setSuccess('');
                  setMode((prev) => (prev === 'change' ? 'reset' : 'change'));
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.helperLinkText}>
                  {mode === 'change'
                    ? 'Forgot current PIN? Reset using Admin Password'
                    : '← Back to Change with Current PIN'}
                </Text>
              </TouchableOpacity>

              {onSwitchToPassword ? (
                <TouchableOpacity onPress={onSwitchToPassword} activeOpacity={0.7}>
                  <Text style={styles.switchModalText}>Change Login Password →</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <BootstrapIcon name="exclamation-circle-fill" size={14} color="#B91C1C" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            {success ? (
              <View style={styles.successBox}>
                <BootstrapIcon name="check-circle-fill" size={14} color="#065F46" />
                <Text style={styles.successText}>{success}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.7 }]}
              onPress={handleSavePin}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveText}>
                  {mode === 'change' ? 'Update Security PIN' : 'Verify & Reset PIN'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  sheet: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '92%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  subtitle: { fontSize: 12, color: '#64748B', marginTop: 2, lineHeight: 17 },
  body: { paddingHorizontal: 20, paddingTop: 16 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EA580C',
    letterSpacing: 0.2,
  },
  label: { fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 6 },
  pinStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  pinStatusBannerWarn: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  pinStatusBannerCustom: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  pinStatusTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  pinStatusDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  fillGivenPinBtn: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  fillGivenPinText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
  },
  pinToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  pinToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  pinToggleText: { fontSize: 11, fontWeight: '600', color: '#EA580C' },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 12,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  pwdWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    marginBottom: 12,
    paddingRight: 4,
  },
  pwdInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: '#0F172A',
  },
  eyeBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  helperLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
    marginBottom: 12,
  },
  helperLinkText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#EA580C',
  },
  switchModalText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  errorText: { color: '#B91C1C', fontSize: 13, fontWeight: '600', flex: 1 },
  successBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  successText: { color: '#065F46', fontSize: 13, fontWeight: '600', flex: 1 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cancelText: { color: '#64748B', fontWeight: '600' },
  saveBtn: {
    backgroundColor: '#EA580C',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    minWidth: 150,
    alignItems: 'center',
  },
  saveText: { color: '#FFFFFF', fontWeight: '600' },
});

