import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { loginPageStyles as styles } from '../../../styles/loginPage.styles.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { appStorage } from '../../../services/system/storageAdapter.js';
import BootstrapIcon from '../../../components/common/BootstrapIcon.jsx';
import GoogleIcon from '../../../components/common/GoogleIcon.jsx';

const REMEMBER_EMAIL_KEY = 'mototrack_remember_login_email';

export default function LoginPage({
  onLoginSuccess,
  onNavigateToSignUp,
  onNavigateToStore,
}) {
  const { login, loginWithGoogle, loginWithGoogleSimulated, requestPasswordResetOtp } = useAuth();

  const [email, setEmail] = useState(() => {
    try {
      return appStorage.getItem(REMEMBER_EMAIL_KEY) || '';
    } catch {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    try {
      return Boolean(appStorage.getItem(REMEMBER_EMAIL_KEY));
    } catch {
      return false;
    }
  });

  // Google OAuth state
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleAdvisory, setGoogleAdvisory] = useState(null);

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState({ type: '', text: '' });

  const passwordInputRef = useRef(null);

  const handleEmailLogin = async () => {
    if (isLoading) return;
    if (!email.trim() || !password) {
      setErrorMessage('Please enter your email or username and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    const res = await login(email.trim(), password);
    setIsLoading(false);

    if (res.success) {
      try {
        if (rememberMe) {
          appStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
        } else {
          appStorage.removeItem(REMEMBER_EMAIL_KEY);
        }
      } catch {
        /* ignore */
      }
      onLoginSuccess?.(res.user);
    } else {
      setErrorMessage(res.error || 'Invalid email or password.');
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMessage('');
    setGoogleAdvisory(null);
    setIsGoogleLoading(true);
    try {
      const res = await loginWithGoogle();
      if (res?.success && res.user) {
        onLoginSuccess?.(res.user);
      } else if (res?.notEnabled) {
        setGoogleAdvisory({
          title: 'Google OAuth Setup Required',
          message:
            'Google OAuth provider is not enabled in your Supabase project. You can enable it in Supabase Dashboard → Authentication → Providers, or use instant test sign in.',
          showInstantTest: true,
        });
      } else if (res?.redirectConfigNeeded || res?.cancelled) {
        setGoogleAdvisory({
          title: 'Supabase Redirect URL Required',
          message:
            'Google sign-in completed, but Supabase blocked the redirect back into Expo Go. To fix: add "exp://**" to your Supabase Redirect URLs.',
          showInstantTest: true,
        });
        if (res?.error) {
          setErrorMessage(res.error);
        }
      } else if (res?.error) {
        setErrorMessage(res.error);
      }
    } catch (err) {
      setErrorMessage('Google sign in error: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleGoogleInstantTest = async () => {
    setIsGoogleLoading(true);
    setGoogleAdvisory(null);
    setErrorMessage('');
    try {
      const res = await loginWithGoogleSimulated();
      if (res?.success && res.user) {
        onLoginSuccess?.(res.user);
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSendPasswordReset = async () => {
    const targetEmail = forgotEmail.trim() || email.trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      setForgotMessage({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }

    setForgotLoading(true);
    setForgotMessage({ type: '', text: '' });
    try {
      if (requestPasswordResetOtp) {
        const res = await requestPasswordResetOtp({ email: targetEmail });
        if (res.success) {
          setForgotMessage({
            type: 'success',
            text: res.message || `Password reset link sent to ${targetEmail}. Check your inbox.`,
          });
        } else {
          setForgotMessage({ type: 'error', text: res.error || 'Failed to send reset link.' });
        }
      } else {
        setForgotMessage({
          type: 'success',
          text: `Password reset instructions sent to ${targetEmail}. Check your inbox.`,
        });
      }
    } catch (err) {
      setForgotMessage({ type: 'error', text: err.message || 'Something went wrong.' });
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ─── 1. DARK CHARCOAL HEADER SECTION ─── */}
          <View style={styles.topHeaderSection}>
            {/* Minimal circular wheel-inspired orange graphic */}
            <View style={styles.wheelGraphicWrap}>
              <View style={styles.wheelOuterRing} />
            </View>

            {/* Compact Top Navigation (Shop & Guest) */}
            <View style={styles.topNavRow}>
              <TouchableOpacity
                style={styles.navLink}
                onPress={onNavigateToStore}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Return to Shop"
              >
                <BootstrapIcon name="chevron-left" size={13} color="#94A3B8" />
                <Text style={styles.navLinkText}>Shop</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navLink}
                onPress={onNavigateToStore}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Browse as Guest"
              >
                <Text style={styles.navLinkText}>Guest</Text>
                <BootstrapIcon name="chevron-right" size={13} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* Bold, clean header titles */}
            <Text style={styles.headerTitle}>Welcome back.</Text>
            <Text style={styles.headerSubtitle}>Motorparts made simple.</Text>
          </View>

          {/* ─── 2. WHITE BOTTOM SHEET WITH SOFTLY ROUNDED TOP CORNERS ─── */}
          <View style={styles.whiteCardSheet}>
            <Text style={styles.sheetTitle}>Log in</Text>
            <Text style={styles.sheetSubtitle}>Access your orders and saved parts.</Text>

            {/* Error Banner */}
            {errorMessage ? (
              <View style={styles.errorBanner} accessibilityRole="alert">
                <BootstrapIcon name="info-circle" size={15} color="#DC2626" />
                <Text style={styles.errorBannerText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Email or Username Input */}
            <View style={styles.inputGroup}>
              <View
                style={[
                  styles.inputPill,
                  focusedField === 'email' && styles.inputPillFocused,
                ]}
              >
                <BootstrapIcon
                  name="envelope"
                  size={16}
                  color={focusedField === 'email' ? '#EA580C' : '#94A3B8'}
                />
                <TextInput
                  style={styles.textInput}
                  placeholder="Email or username"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errorMessage) setErrorMessage('');
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField('')}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => {
                    if (password.trim()) {
                      handleEmailLogin();
                    } else {
                      passwordInputRef.current?.focus();
                    }
                  }}
                  accessibilityLabel="Email or username"
                />
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <View
                style={[
                  styles.inputPill,
                  focusedField === 'password' && styles.inputPillFocused,
                ]}
              >
                <BootstrapIcon
                  name="lock"
                  size={16}
                  color={focusedField === 'password' ? '#EA580C' : '#94A3B8'}
                />
                <TextInput
                  ref={passwordInputRef}
                  style={styles.textInput}
                  placeholder="Password"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errorMessage) setErrorMessage('');
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField('')}
                  returnKeyType="go"
                  onSubmitEditing={handleEmailLogin}
                  accessibilityLabel="Password"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <BootstrapIcon
                    name={showPassword ? 'eye-slash' : 'eye'}
                    size={16}
                    color="#94A3B8"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Remember Me & Forgot Password Row */}
            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={styles.rememberRow}
                onPress={() => setRememberMe((prev) => !prev)}
                activeOpacity={0.8}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: rememberMe }}
                accessibilityLabel="Remember me"
              >
                <View
                  style={[
                    styles.checkbox,
                    rememberMe && styles.checkboxChecked,
                  ]}
                >
                  {rememberMe ? (
                    <BootstrapIcon name="check" size={11} color="#FFFFFF" />
                  ) : null}
                </View>
                <Text style={styles.rememberText}>Remember me</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setForgotEmail(email);
                  setForgotMessage({ type: '', text: '' });
                  setShowForgotModal(true);
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Forgot password"
              >
                <Text style={styles.forgotPasswordText}>Forgot password?</Text>
              </TouchableOpacity>
            </View>

            {/* Single Full-Width Orange Primary Button */}
            <TouchableOpacity
              style={[styles.primaryBtn, isLoading && styles.primaryBtnDisabled]}
              onPress={handleEmailLogin}
              activeOpacity={0.85}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Log in"
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>Log in</Text>
                  <View style={styles.btnArrowBadge}>
                    <BootstrapIcon name="chevron-right" size={12} color="#FFFFFF" />
                  </View>
                </>
              )}
            </TouchableOpacity>

            {/* Social Divider */}
            <View style={styles.socialDividerRow}>
              <View style={styles.socialDividerLine} />
              <Text style={styles.socialDividerText}>or continue with</Text>
              <View style={styles.socialDividerLine} />
            </View>

            {/* Sign in with Google Button */}
            <TouchableOpacity
              style={styles.googleBtn}
              onPress={handleGoogleLogin}
              activeOpacity={0.85}
              disabled={isGoogleLoading || isLoading}
              accessibilityRole="button"
              accessibilityLabel="Continue with Google"
            >
              {isGoogleLoading ? (
                <ActivityIndicator size="small" color="#EA580C" />
              ) : (
                <>
                  <GoogleIcon size={18} />
                  <Text style={styles.googleBtnText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Google OAuth Advisory / Test Mode */}
            {googleAdvisory ? (
              <View style={styles.googleAdvisoryBox}>
                <Text style={styles.googleAdvisoryTitle}>{googleAdvisory.title}</Text>
                <Text style={styles.googleAdvisoryText}>{googleAdvisory.message}</Text>
                {googleAdvisory.showInstantTest ? (
                  <TouchableOpacity
                    style={styles.googleInstantTestBtn}
                    onPress={handleGoogleInstantTest}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.googleInstantTestText}>
                      ✓ Test Sign In as Rider (Instant)
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            {/* Footer Switch: Easy Switch between Login and Signup */}
            <View style={styles.switchRow}>
              <Text style={styles.switchText}>New to MotoTrack? </Text>
              <TouchableOpacity
                onPress={onNavigateToSignUp}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Create an account"
              >
                <Text style={styles.switchLink}>Create an account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <SafeAreaView style={{ flex: 0, backgroundColor: '#FFFFFF' }} />

      {/* ─── FORGOT PASSWORD MODAL ─── */}
      <Modal
        visible={showForgotModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowForgotModal(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setShowForgotModal(false)}
        >
          <Pressable
            style={styles.modalSheet}
            onPress={(e) => e?.stopPropagation?.()}
          >
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Reset Password</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowForgotModal(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <BootstrapIcon name="x-lg" size={14} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Enter your registered MotoTrack email to receive password reset instructions.
            </Text>

            {forgotMessage.text ? (
              <View
                style={[
                  styles.errorBanner,
                  forgotMessage.type === 'success' && {
                    backgroundColor: '#ECFDF5',
                    borderColor: '#A7F3D0',
                  },
                ]}
              >
                <BootstrapIcon
                  name={forgotMessage.type === 'success' ? 'check-circle' : 'info-circle'}
                  size={15}
                  color={forgotMessage.type === 'success' ? '#059669' : '#DC2626'}
                />
                <Text
                  style={[
                    styles.errorBannerText,
                    forgotMessage.type === 'success' && { color: '#065F46' },
                  ]}
                >
                  {forgotMessage.text}
                </Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <View style={styles.inputPill}>
                <BootstrapIcon name="envelope" size={16} color="#94A3B8" />
                <TextInput
                  style={styles.textInput}
                  placeholder="name@example.com"
                  placeholderTextColor="#94A3B8"
                  value={forgotEmail}
                  onChangeText={setForgotEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, forgotLoading && styles.primaryBtnDisabled]}
              onPress={handleSendPasswordReset}
              activeOpacity={0.85}
              disabled={forgotLoading}
            >
              {forgotLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>Send Reset Link</Text>
              )}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
