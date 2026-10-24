import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { BootstrapIcon } from '../../../components/common';
import { useAuth } from '../../../context';

export default function ForceChangePasswordPage({ onCompleted, onLogout }) {
  const { currentUser, changePassword, validatePasswordStrength } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const analysis = useMemo(
    () => validatePasswordStrength?.(newPassword) || { isStrong: false, feedback: '' },
    [newPassword, validatePasswordStrength]
  );

  const handleSubmit = async () => {
    setError('');
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Please fill in all password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (!analysis.isStrong) {
      setError(analysis.feedback || 'Please choose a stronger password.');
      return;
    }
    setLoading(true);
    const res = await changePassword({
      currentPassword,
      newPassword,
    });
    setLoading(false);
    if (!res?.success) {
      setError(res?.error || 'Could not update password.');
      return;
    }
    onCompleted?.();
  };

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <View style={styles.badge}>
          <BootstrapIcon name="key-fill" size={22} color="#EA580C" />
        </View>
        <Text style={styles.title}>Change Temporary Password</Text>
        <Text style={styles.subtitle}>
          Hi {currentUser?.name || 'Staff'}, you must set a new password before continuing to your
          dashboard.
        </Text>

        <Text style={styles.label}>Current temporary password</Text>
        <TextInput
          style={styles.input}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          autoCapitalize="none"
          placeholder="Temporary password from email"
          placeholderTextColor="#94A3B8"
        />

        <Text style={styles.label}>New password</Text>
        <TextInput
          style={styles.input}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          autoCapitalize="none"
          placeholder="Create a strong password"
          placeholderTextColor="#94A3B8"
        />
        {newPassword ? (
          <Text style={[styles.hint, analysis.isStrong ? styles.hintOk : styles.hintWarn]}>
            {analysis.feedback}
          </Text>
        ) : null}

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
            <BootstrapIcon name="exclamation-circle" size={14} color="#DC2626" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.primaryBtn, loading && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryBtnText}>Update Password & Continue</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout} activeOpacity={0.8}>
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#181A1D',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 28,
    ...Platform.select({
      web: { boxShadow: '0 18px 50px rgba(0,0,0,0.28)' },
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 8,
      },
    }),
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: { fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#64748B', marginBottom: 20, lineHeight: 20 },
  label: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
    marginBottom: 12,
    backgroundColor: '#F8FAFC',
  },
  hint: { fontSize: 12, marginTop: -6, marginBottom: 10 },
  hintOk: { color: '#059669' },
  hintWarn: { color: '#D97706' },
  errorBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  errorText: { flex: 1, color: '#B91C1C', fontSize: 13, fontWeight: '600' },
  primaryBtn: {
    backgroundColor: '#EA580C',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.7 },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  logoutBtn: { alignItems: 'center', marginTop: 16 },
  logoutText: { color: '#64748B', fontWeight: '700', fontSize: 13 },
});
