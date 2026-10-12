import React, { useEffect, useMemo, useState } from 'react';
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
import { authService } from '../../services/auth/authService.js';
import { adminSecurityService } from '../../services/auth/adminSecurityService.js';

/**
 * Self-service account security for Store Administrators.
 * Allows changing login password and Admin Security PIN while unlocked.
 */
export default function AdminAccountSettingsModal({ visible, onClose, onSaved, showToast = () => {} }) {
  const { currentUser, updateProfile, changePassword } = useAuth();

  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPins, setShowPins] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const pwdStrength = useMemo(
    () => authService.validatePasswordStrength(newPassword),
    [newPassword]
  );

  useEffect(() => {
    if (!visible || !currentUser) return;
    setName(currentUser.name || currentUser.fullName || '');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setShowCurrentPwd(false);
    setShowNewPwd(false);
    setShowConfirmPwd(false);
    setShowPins(false);
    setError('');
    setSuccess('');
    adminSecurityService.fetchPinFromSupabase(currentUser).catch(() => {});
  }, [visible, currentUser]);

  const handleSave = async () => {
    setError('');
    setSuccess('');

    const cleanName = name.trim();
    if (!cleanName) {
      setError('Name is required.');
      return;
    }

    const changingPassword = Boolean(currentPassword || newPassword || confirmPassword);
    const changingPin = Boolean(currentPin || newPin || confirmPin);

    if (!changingPassword && !changingPin && cleanName === (currentUser?.name || currentUser?.fullName || '')) {
      setError('No changes to save.');
      return;
    }

    if (changingPassword) {
      if (!currentPassword) {
        setError('Enter your current password to set a new one.');
        return;
      }
      if (newPassword.length < 8) {
        setError('New password must be at least 8 characters.');
        return;
      }
      if (newPassword === currentPassword) {
        setError('New password cannot be the same as your current password.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('New password and confirmation do not match.');
        return;
      }
      if (pwdStrength?.score != null && pwdStrength.score < 40) {
        setError('Choose a stronger password (mix letters, numbers, and symbols).');
        return;
      }
    }

    if (changingPin) {
      if (!currentPin.trim()) {
        setError('Enter your current Admin PIN to set a new one.');
        return;
      }
      if (!/^\d{4,6}$/.test(newPin.trim())) {
        setError('New PIN must be 4 to 6 numeric digits.');
        return;
      }
      if (newPin.trim() !== confirmPin.trim()) {
        setError('New PIN and confirmation do not match.');
        return;
      }
      if (newPin.trim() === currentPin.trim()) {
        setError('New PIN cannot be the same as your current PIN.');
        return;
      }
    }

    setSaving(true);
    try {
      const parts = [];

      const profileRes = await updateProfile({ name: cleanName });
      if (!profileRes?.success) {
        setError(profileRes?.error || 'Could not update profile.');
        setSaving(false);
        return;
      }
      if (cleanName !== (currentUser?.name || currentUser?.fullName || '')) {
        parts.push('name');
      }

      if (changingPassword) {
        const pwdRes = await changePassword({
          currentPassword,
          newPassword,
        });
        if (!pwdRes?.success) {
          setError(pwdRes?.error || 'Name saved, but password could not be updated.');
          setSaving(false);
          return;
        }
        parts.push('password');
      }

      if (changingPin) {
        const pinRes = await adminSecurityService.setAdminPin(
          currentPin.trim(),
          newPin.trim(),
          currentUser
        );
        if (!pinRes?.success) {
          setError(
            pinRes?.error ||
              (parts.length
                ? 'Other changes saved, but PIN could not be updated.'
                : 'Could not update Admin PIN.')
          );
          setSaving(false);
          return;
        }
        parts.push('PIN');
      }

      const message =
        parts.length === 0
          ? 'Account already up to date.'
          : parts.length === 1
            ? `${parts[0].charAt(0).toUpperCase()}${parts[0].slice(1)} updated successfully.`
            : `Updated ${parts.join(', ').replace(/, ([^,]*)$/, ' and $1')}.`;

      setSuccess(message);
      showToast(`✓ ${message}`);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      onSaved?.(profileRes.user || currentUser);
    } catch (_e) {
      setError('Something went wrong while saving your account.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <View style={styles.titleRow}>
                <View style={styles.iconWrap}>
                  <BootstrapIcon name="shield-lock-fill" size={16} color="#1D4533" />
                </View>
                <Text style={styles.title}>Admin Account</Text>
              </View>
              <Text style={styles.subtitle}>
                Change your login password and Admin Security PIN. Only you can update these.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <BootstrapIcon name="x-lg" size={16} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Login email (read-only)</Text>
            <TextInput
              style={[styles.input, styles.inputReadonly]}
              value={currentUser?.email || ''}
              editable={false}
            />

            <Text style={styles.label}>Full name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Administrator name"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.section}>Change password</Text>
            <Text style={styles.hint}>Leave blank if you only want to update your PIN or name.</Text>

            <Text style={styles.label}>Current password</Text>
            <View style={styles.pwdWrap}>
              <TextInput
                style={styles.pwdInput}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showCurrentPwd}
                autoCapitalize="none"
                placeholder="Required only when changing password"
                placeholderTextColor="#94A3B8"
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowCurrentPwd((v) => !v)}>
                <BootstrapIcon name={showCurrentPwd ? 'eye-slash' : 'eye'} size={15} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>New password</Text>
            <View style={styles.pwdWrap}>
              <TextInput
                style={styles.pwdInput}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPwd}
                autoCapitalize="none"
                placeholder="Min. 8 characters"
                placeholderTextColor="#94A3B8"
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowNewPwd((v) => !v)}>
                <BootstrapIcon name={showNewPwd ? 'eye-slash' : 'eye'} size={15} color="#64748B" />
              </TouchableOpacity>
            </View>

            {newPassword.length > 0 ? (
              <View style={styles.strengthCard}>
                <Text style={styles.strengthLabel}>
                  Strength:{' '}
                  <Text style={{ color: pwdStrength.color, fontWeight: '900' }}>{pwdStrength.label}</Text>
                </Text>
                <View style={styles.strengthTrack}>
                  <View
                    style={[
                      styles.strengthFill,
                      { width: `${pwdStrength.score}%`, backgroundColor: pwdStrength.color },
                    ]}
                  />
                </View>
              </View>
            ) : null}

            <Text style={styles.label}>Confirm new password</Text>
            <View style={styles.pwdWrap}>
              <TextInput
                style={styles.pwdInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPwd}
                autoCapitalize="none"
                placeholder="Re-enter new password"
                placeholderTextColor="#94A3B8"
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirmPwd((v) => !v)}>
                <BootstrapIcon name={showConfirmPwd ? 'eye-slash' : 'eye'} size={15} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.section}>Change Admin Security PIN</Text>
            <Text style={styles.hint}>
              PIN locks the admin console after idle time. Must be 4–6 digits. Leave blank to keep current PIN.
            </Text>

            <View style={styles.pinToggleRow}>
              <Text style={styles.label}>PIN fields</Text>
              <TouchableOpacity
                style={styles.pinToggleBtn}
                onPress={() => setShowPins((v) => !v)}
                activeOpacity={0.8}
              >
                <BootstrapIcon name={showPins ? 'eye-slash' : 'eye'} size={13} color="#1D4533" />
                <Text style={styles.pinToggleText}>{showPins ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Current PIN</Text>
            <TextInput
              style={styles.input}
              value={currentPin}
              onChangeText={(v) => setCurrentPin(v.replace(/[^\d]/g, '').slice(0, 6))}
              secureTextEntry={!showPins}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="Current 4–6 digit PIN"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.label}>New PIN</Text>
            <TextInput
              style={styles.input}
              value={newPin}
              onChangeText={(v) => setNewPin(v.replace(/[^\d]/g, '').slice(0, 6))}
              secureTextEntry={!showPins}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="New 4–6 digit PIN"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.label}>Confirm new PIN</Text>
            <TextInput
              style={styles.input}
              value={confirmPin}
              onChangeText={(v) => setConfirmPin(v.replace(/[^\d]/g, '').slice(0, 6))}
              secureTextEntry={!showPins}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="Re-enter new PIN"
              placeholderTextColor="#94A3B8"
            />

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
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveText}>Save Changes</Text>
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
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  sheet: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '92%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0 18px 40px rgba(0,0,0,0.25)' },
      default: { elevation: 8 },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F3F7F6',
    borderWidth: 1,
    borderColor: '#C8DDD3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  subtitle: { fontSize: 12, color: '#64748B', marginTop: 6, lineHeight: 17 },
  body: { paddingHorizontal: 18, paddingTop: 14 },
  label: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 },
  section: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1D4533',
    marginTop: 10,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  hint: { fontSize: 11.5, color: '#64748B', marginBottom: 10, lineHeight: 16 },
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
  inputReadonly: { color: '#64748B', backgroundColor: '#F1F5F9' },
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
  strengthCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    marginBottom: 12,
  },
  strengthLabel: { fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 6 },
  strengthTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  strengthFill: { height: '100%', borderRadius: 999 },
  pinToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  pinToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F3F7F6',
  },
  pinToggleText: { fontSize: 11, fontWeight: '800', color: '#1D4533' },
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
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  cancelText: { color: '#64748B', fontWeight: '700' },
  saveBtn: {
    backgroundColor: '#1D4533',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 11,
    minWidth: 130,
    alignItems: 'center',
  },
  saveText: { color: '#FFFFFF', fontWeight: '800' },
});
