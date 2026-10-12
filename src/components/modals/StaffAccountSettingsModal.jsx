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

/**
 * Self-service account editor for Rider / Mechanic.
 * Admin cannot change these credentials after account creation.
 */
export default function StaffAccountSettingsModal({ visible, onClose, onSaved }) {
  const { currentUser, updateProfile, changePassword } = useAuth();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !currentUser) return;
    setName(currentUser.name || '');
    setUsername(currentUser.username || currentUser.email || '');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess('');
  }, [visible, currentUser]);

  const handleSave = async () => {
    setError('');
    setSuccess('');
    const cleanName = name.trim();
    const cleanUsername = username.trim().toLowerCase();
    if (!cleanName) {
      setError('Name is required.');
      return;
    }
    if (!cleanUsername || cleanUsername.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (!/^[a-z0-9._@+-]+$/i.test(cleanUsername)) {
      setError('Username may only contain letters, numbers, and . _ @ + -');
      return;
    }

    const changingPassword = Boolean(newPassword || confirmPassword || currentPassword);
    if (changingPassword) {
      if (!currentPassword) {
        setError('Enter your current password to set a new one.');
        return;
      }
      if (newPassword.length < 8) {
        setError('New password must be at least 8 characters.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('New password and confirmation do not match.');
        return;
      }
    }

    setSaving(true);
    try {
      const profileRes = await updateProfile({
        name: cleanName,
        username: cleanUsername,
      });
      if (!profileRes?.success) {
        setError(profileRes?.error || 'Could not update profile.');
        setSaving(false);
        return;
      }

      if (changingPassword) {
        const pwdRes = await changePassword({
          currentPassword,
          newPassword,
        });
        if (!pwdRes?.success) {
          setError(pwdRes?.error || 'Profile saved, but password could not be updated.');
          setSaving(false);
          return;
        }
      }

      setSuccess(
        changingPassword
          ? 'Name, username, and password updated.'
          : 'Name and username updated.'
      );
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
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
            <View>
              <Text style={styles.title}>My Account</Text>
              <Text style={styles.subtitle}>
                Only you can change your name, username, and password.
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
              placeholder="Your name"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              placeholder="Login username"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.section}>Change password (optional)</Text>
            <Text style={styles.label}>Current password</Text>
            <TextInput
              style={styles.input}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              autoCapitalize="none"
              placeholder="Required only when changing password"
              placeholderTextColor="#94A3B8"
            />
            <Text style={styles.label}>New password</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoCapitalize="none"
              placeholder="Min. 8 characters"
              placeholderTextColor="#94A3B8"
            />
            <Text style={styles.label}>Confirm new password</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              placeholder="Re-enter new password"
              placeholderTextColor="#94A3B8"
            />

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            {success ? (
              <View style={styles.successBox}>
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
    maxWidth: 440,
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
  title: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  subtitle: { fontSize: 12, color: '#64748B', marginTop: 4, maxWidth: 320 },
  body: { paddingHorizontal: 18, paddingTop: 14 },
  label: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 },
  section: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1D4533',
    marginTop: 8,
    marginBottom: 10,
    letterSpacing: 0.3,
  },
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
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  errorText: { color: '#B91C1C', fontSize: 13, fontWeight: '600' },
  successBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  successText: { color: '#065F46', fontSize: 13, fontWeight: '600' },
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
