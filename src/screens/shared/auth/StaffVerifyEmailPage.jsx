import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { staffAccountApi } from '../../../services/staff/staffAccountApi.js';

const OTP_TTL_SEC = 5 * 60;

export default function StaffVerifyEmailPage({
  initialEmail = '',
  onVerified,
  onBackToLogin,
}) {
  const [email, setEmail] = useState(String(initialEmail || '').trim().toLowerCase());
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [expiresIn, setExpiresIn] = useState(OTP_TTL_SEC);
  const inputRefs = useRef([]);

  useEffect(() => {
    if (initialEmail) setEmail(String(initialEmail).trim().toLowerCase());
  }, [initialEmail]);

  useEffect(() => {
    if (expiresIn <= 0) return undefined;
    const t = setInterval(() => setExpiresIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [expiresIn]);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const t = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const otp = useMemo(() => otpDigits.join(''), [otpDigits]);
  const timerLabel = useMemo(() => {
    const m = String(Math.floor(expiresIn / 60)).padStart(2, '0');
    const s = String(expiresIn % 60).padStart(2, '0');
    return `${m}:${s}`;
  }, [expiresIn]);

  const handleOtpChange = (val, idx) => {
    const clean = String(val || '').replace(/\D/g, '');
    if (clean.length > 1) {
      const chars = clean.slice(0, 6).split('');
      const next = ['', '', '', '', '', ''];
      chars.forEach((c, i) => {
        next[i] = c;
      });
      setOtpDigits(next);
      const focusAt = Math.min(chars.length, 5);
      inputRefs.current[focusAt]?.focus?.();
      return;
    }
    const next = [...otpDigits];
    next[idx] = clean.slice(-1);
    setOtpDigits(next);
    if (clean && idx < 5) inputRefs.current[idx + 1]?.focus?.();
  };

  const handleOtpKeyPress = (e, idx) => {
    if (e.nativeEvent.key === 'Backspace' && !otpDigits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus?.();
    }
  };

  const handleVerify = async () => {
    setError('');
    setSuccess('');
    if (!email.includes('@')) {
      setError('Please enter the email address used for your staff account.');
      return;
    }
    if (otp.length !== 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }
    setLoading(true);
    const res = await staffAccountApi.verifyOtp({ email, otp });
    setLoading(false);
    if (!res.success) {
      setError(res.error || 'Invalid verification code. Please try again.');
      if (res.code === 'OTP_EXPIRED') setExpiresIn(0);
      return;
    }
    if (res.credentialsEmailed) {
      setSuccess(res.message || 'Email verified. Check your inbox for the temporary login password.');
    } else {
      setSuccess(
        res.message ||
          res.emailWarning ||
          'Email verified. If no password email arrived, check the API server console (dev mode) or ask admin to resend credentials.'
      );
    }
    onVerified?.(res);
  };

  const handleResend = async () => {
    setError('');
    setSuccess('');
    if (!email.includes('@')) {
      setError('Enter your staff email before requesting a new code.');
      return;
    }
    if (resendCooldown > 0) return;
    setLoading(true);
    const res = await staffAccountApi.resendOtpPublic({ email });
    setLoading(false);
    if (!res.success) {
      setError(res.error || 'Could not resend the code.');
      return;
    }
    setSuccess(res.message || 'A new verification code was sent.');
    setExpiresIn(OTP_TTL_SEC);
    setResendCooldown(60);
    setOtpDigits(['', '', '', '', '', '']);
  };

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <View style={styles.badge}>
          <BootstrapIcon name="shield-lock-fill" size={22} color="#EA580C" />
        </View>
        <Text style={styles.title}>Verify Your Email</Text>
        <Text style={styles.subtitle}>A verification code has been sent to:</Text>

        <TextInput
          style={styles.emailInput}
          value={email}
          onChangeText={(v) => setEmail(String(v || '').trim().toLowerCase())}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="staff@email.com"
          placeholderTextColor="#94A3B8"
        />

        <Text style={styles.label}>Enter the 6-digit code</Text>
        <View style={styles.otpRow}>
          {otpDigits.map((digit, idx) => (
            <TextInput
              key={idx}
              ref={(el) => {
                inputRefs.current[idx] = el;
              }}
              style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
              value={digit}
              onChangeText={(val) => handleOtpChange(val, idx)}
              onKeyPress={(e) => handleOtpKeyPress(e, idx)}
              keyboardType="number-pad"
              maxLength={6}
              selectTextOnFocus
            />
          ))}
        </View>

        <Text style={[styles.timer, expiresIn === 0 && styles.timerExpired]}>
          {expiresIn > 0 ? `Code expires in ${timerLabel}` : 'This verification code has expired.'}
        </Text>

        {error ? (
          <View style={styles.errorBox}>
            <BootstrapIcon name="exclamation-circle" size={14} color="#DC2626" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        {success ? (
          <View style={styles.successBox}>
            <BootstrapIcon name="check-circle" size={14} color="#065F46" />
            <Text style={styles.successText}>{success}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.primaryBtn, loading && styles.btnDisabled]}
          onPress={handleVerify}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryBtnText}>Verify Email</Text>
          )}
        </TouchableOpacity>

        <View style={styles.resendRow}>
          <Text style={styles.resendHint}>Didn&apos;t receive the code?</Text>
          {resendCooldown > 0 ? (
            <Text style={styles.resendWait}>Resend in {resendCooldown}s</Text>
          ) : (
            <TouchableOpacity onPress={handleResend} disabled={loading}>
              <Text style={styles.resendLink}>Resend Code</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={styles.backBtn} onPress={onBackToLogin} activeOpacity={0.8}>
          <BootstrapIcon name="arrow-left" size={14} color="#EA580C" />
          <Text style={styles.backBtnText}>Back to Login</Text>
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
    maxWidth: 440,
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
  title: { fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#64748B', marginBottom: 10 },
  emailInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '700',
    color: '#EA580C',
    marginBottom: 18,
    backgroundColor: '#F8FAFC',
  },
  label: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 10 },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  otpBox: {
    flex: 1,
    height: 52,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  otpBoxFilled: { borderColor: '#EA580C', backgroundColor: '#FFF7ED' },
  timer: { fontSize: 13, color: '#64748B', marginBottom: 14 },
  timerExpired: { color: '#DC2626', fontWeight: '700' },
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
  successBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  successText: { flex: 1, color: '#065F46', fontSize: 13, fontWeight: '600' },
  primaryBtn: {
    backgroundColor: '#EA580C',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.7 },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14, letterSpacing: 0.4 },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
  },
  resendHint: { color: '#64748B', fontSize: 13 },
  resendLink: { color: '#EA580C', fontWeight: '800', fontSize: 13 },
  resendWait: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
  },
  backBtnText: { color: '#EA580C', fontWeight: '700', fontSize: 13 },
});
