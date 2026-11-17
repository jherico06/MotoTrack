import React, { useMemo, useEffect, useState } from 'react';
import { useTheme } from '../../context/ThemeContext.jsx';
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
  const { isDarkMode } = useTheme();
  const styles = useMemo(() => getModalStyles(isDarkMode), [isDarkMode]);
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={styles.iconWrap}>
                <BootstrapIcon name="person-gear" size={17} color="#EA580C" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>My Account</Text>
                <Text style={styles.subtitle}>
                  Manage name, username, and password
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <BootstrapIcon name="x-lg" size={14} color="#64748B" />
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

function getRawModalStyles() {
  return {
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
    padding: 0,
  },
  sheet: {
    width: '100%',
    maxWidth: 600,
    maxHeight: '92%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    overflow: 'hidden',
    alignSelf: 'center',
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
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
  subtitle: { fontSize: 12, color: '#64748B', marginTop: 2, maxWidth: 320 },
  body: { paddingHorizontal: 18, paddingTop: 14 },
  label: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 },
  section: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EA580C',
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
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cancelText: { color: '#64748B', fontWeight: '700' },
  saveBtn: {
    backgroundColor: '#EA580C',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    minWidth: 130,
    alignItems: 'center',
  },
  saveText: { color: '#FFFFFF', fontWeight: '600' },
  };
}

function remapModalDark(obj) {
const DARK_BG = {
  '#FFFFFF': '#191A1D', '#F8FAFC': '#202124', '#F1F5F9': '#202124', '#FAFAFA': '#202124',
  '#FFF7ED': '#3A241B', '#FFFBEB': 'rgba(245, 185, 66, 0.14)', '#FEF3C7': 'rgba(245, 185, 66, 0.18)',
  '#FEF2F2': 'rgba(240, 68, 68, 0.14)', '#ECFDF5': 'rgba(0, 201, 141, 0.14)', '#EFF6FF': 'rgba(59, 130, 246, 0.14)',
  '#EA580C': '#FF5A00', '#1E293B': '#202124', '#0F172A': '#202124',
};
const DARK_BORDER = {
  '#E2E8F0': '#303236', '#E4E4E7': '#303236', '#E5E7EB': '#303236', '#CBD5E1': '#3A3B40', '#F1F5F9': '#292B2F',
  '#FED7AA': '#8A3D19', '#FDE68A': 'rgba(245, 185, 66, 0.35)', '#FECACA': 'rgba(240, 68, 68, 0.35)',
};
const DARK_TEXT = {
  '#0F172A': '#F5F5F5', '#111827': '#F5F5F5', '#18181B': '#F2F2F3', '#1E293B': '#F2F2F3',
  '#334155': '#F2F2F3', '#475569': '#A1A1AA', '#52525B': '#A1A1AA', '#64748B': '#A1A1AA', '#94A3B8': '#71717A',
  '#EA580C': '#FF5A00', '#DC2626': '#F04444', '#B45309': '#F5B942', '#92400E': '#F5B942',
};

  if (Array.isArray(obj)) return obj.map(remapModalDark);
  if (obj && typeof obj === 'object') {
    const out = {};
    Object.keys(obj).forEach((k) => {
      const v = obj[k];
      if (typeof v === 'string') {
        const u = v.toUpperCase();
        if (k === 'backgroundColor') out[k] = DARK_BG[u] || v;
        else if (k.toLowerCase().includes('bordercolor')) out[k] = DARK_BORDER[u] || v;
        else if (k === 'color') out[k] = DARK_TEXT[u] || v;
        else out[k] = v;
      } else out[k] = remapModalDark(v);
    });
    return out;
  }
  return obj;
}
let _lightModalStyles = null;
let _darkModalStyles = null;
function getModalStyles(isDark) {
  if (!_lightModalStyles) {
    const raw = getRawModalStyles();
    _lightModalStyles = StyleSheet.create(raw);
    _darkModalStyles = StyleSheet.create(remapModalDark(raw));
  }
  return isDark ? _darkModalStyles : _lightModalStyles;
}
