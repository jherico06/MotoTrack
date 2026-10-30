import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { BootstrapIcon } from '../common';
import { useAuth } from '../../context';
import { authService } from '../../services/auth/authService.js';

/**
 * Self-service account & password modal for Store Administrators.
 * Separated from Admin Security PIN management so password and PIN have independent modals.
 */
export default function AdminAccountSettingsModal({
  visible,
  onClose,
  onSaved,
  onSwitchToPin,
  showToast = () => {},
}) {
  const { currentUser, updateProfile, changeEmail, changePassword } = useAuth();

  const [prevVisible, setPrevVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  // Sync form state when modal becomes visible (standard React pattern without effect cascade)
  if (visible && !prevVisible) {
    setPrevVisible(true);
    setEmail(currentUser?.email || '');
    setName(currentUser?.name || currentUser?.fullName || '');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPwd(false);
    setShowNewPwd(false);
    setShowConfirmPwd(false);
    setError('');
    setSuccess('');
  } else if (!visible && prevVisible) {
    setPrevVisible(false);
  }

  const pwdStrength = useMemo(
    () => authService.validatePasswordStrength(newPassword),
    [newPassword]
  );

  const handleSave = async () => {
    setError('');
    setSuccess('');

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('A valid login email address is required.');
      return;
    }
    if (!cleanName) {
      setError('Name is required.');
      return;
    }

    const originalEmail = (currentUser?.email || '').trim().toLowerCase();
    const originalName = (currentUser?.name || currentUser?.fullName || '').trim();
    const changingEmail = cleanEmail !== originalEmail;
    const changingName = cleanName !== originalName;
    const changingPassword = Boolean( newPassword || confirmPassword );

    if (!changingEmail && !changingName && !changingPassword) {
      setError('No changes to save. Update your email, full name, or enter a new password.');
      return;
    }

    if (changingEmail && !currentPassword) {
      setError('Enter your current password to authorize changing your login email.');
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
      if (!pwdStrength?.isStrong) {
        setError(
          pwdStrength?.feedback ||
            'Choose a strong password (min. 8 characters with uppercase, lowercase, number, and symbol).'
        );
        return;
      }
    }

    setSaving(true);
    try {
      const parts = [];
      let updatedUser = currentUser;

      if (changingName) {
        const profileRes = await updateProfile({ name: cleanName });
        if (!profileRes?.success) {
          setError(profileRes?.error || 'Could not update profile.');
          setSaving(false);
          return;
        }
        updatedUser = profileRes.user || updatedUser;
        parts.push('name');
      }

      if (changingEmail) {
        const emailRes = await changeEmail({
          newEmail: cleanEmail,
          currentPassword,
        });
        if (!emailRes?.success) {
          setError(emailRes?.error || 'Email could not be updated.');
          setSaving(false);
          return;
        }
        updatedUser = emailRes.user || updatedUser;
        parts.push('email');
      }

      if (changingPassword) {
        const pwdRes = await changePassword({
          currentPassword,
          newPassword,
        });
        if (!pwdRes?.success) {
          setError(pwdRes?.error || 'Password could not be updated.');
          setSaving(false);
          return;
        }
        parts.push('password');
      }

      const message =
        parts.length === 0
          ? 'Account already up to date.'
          : parts.length === 1
            ? `${parts[0].charAt(0).toUpperCase()}${parts[0].slice(1)} updated successfully.`
            : `Updated ${parts.join(' and ')}.`;

      setSuccess(message);
      showToast(`✓ ${message}`);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onSaved?.(updatedUser);
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
                  <BootstrapIcon name="key-fill" size={17} color="#EA580C" />
                </View>
                <Text style={styles.title}>Change Password & Account</Text>
              </View>
              <Text style={styles.subtitle}>
                Update your administrator display name and login password.
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <BootstrapIcon name="x-lg" size={14} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Login email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="admin@mototrack.com"
              placeholderTextColor="#94A3B8"
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
            <Text style={styles.hint}>
              Enter your current login password and choose a new password (min. 8 characters).
            </Text>

            <Text style={styles.label}>Current password</Text>
            <View style={styles.pwdWrap}>
              <TextInput
                style={styles.pwdInput}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showCurrentPwd}
                autoCapitalize="none"
                placeholder="Enter current login password"
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
                  <Text style={{ color: pwdStrength.color, fontWeight: '600' }}>{pwdStrength.label}</Text>
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

            {onSwitchToPin ? (
              <View style={styles.switchRow}>
                <TouchableOpacity onPress={onSwitchToPin} activeOpacity={0.7}>
                  <Text style={styles.switchLinkText}>
                    Want to update your console lock PIN? Open Admin Security PIN →
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

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
                <Text style={styles.saveText}>Save Password</Text>
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
    maxWidth: 500,
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
  label: { fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 6 },
  section: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EA580C',
    marginTop: 6,
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
  strengthLabel: { fontSize: 11, fontWeight: '600', color: '#475569', marginBottom: 6 },
  strengthTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  strengthFill: { height: '100%', borderRadius: 999 },
  switchRow: {
    marginTop: 2,
    marginBottom: 12,
  },
  switchLinkText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#EA580C',
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
    minWidth: 140,
    alignItems: 'center',
  },
  saveText: { color: '#FFFFFF', fontWeight: '600' },
});
