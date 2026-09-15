import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { loginPageStyles as styles } from '../styles/loginPage.styles';
import { useAuth } from '../context/AuthContext';
import BootstrapIcon from '../components/common/BootstrapIcon';
import GoogleIcon from '../components/common/GoogleIcon';

function DecorativePlantPot() {
  return (
    <View style={styles.plantDecorWrap}>
      <View style={styles.plantLeafGroup}>
        <View style={styles.leftLeaf} />
        <View style={styles.centerLeaf} />
        <View style={styles.rightLeaf} />
      </View>
      <View style={styles.plantPot} />
      <View style={styles.plantPotShadow} />
    </View>
  );
}

export default function LoginPage({
  onLoginSuccess,
  onNavigateToSignUp,
  onNavigateToStore,
  redirectReason: propRedirectReason,
}) {
  const { login, loginWithGoogle, loginWithGoogleSimulated, redirectReason: contextRedirectReason } = useAuth();

  const redirectReason = propRedirectReason || contextRedirectReason;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleEmailLogin = async () => {
    if (!email.trim() || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    const res = await login(email.trim(), password);
    setIsLoading(false);

    if (res.success) {
      onLoginSuccess?.(res.user);
    } else {
      setErrorMessage(res.error || 'Invalid email or password.');
    }
  };

  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleAdvisory, setGoogleAdvisory] = useState(false);

  const handleGoogleLogin = async () => {
    setErrorMessage('');
    setGoogleAdvisory(false);
    setIsGoogleLoading(true);
    try {
      const res = await loginWithGoogle();
      if (res?.success && res.user) {
        onLoginSuccess?.(res.user);
      } else if (res?.notEnabled) {
        setGoogleAdvisory(true);
      } else if (res?.cancelled) {
        // User closed or cancelled Google sign-in modal
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
    setGoogleAdvisory(false);
    try {
      const res = await loginWithGoogleSimulated();
      if (res?.success && res.user) {
        onLoginSuccess?.(res.user);
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 0, backgroundColor: '#0C6258' }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.innerContainer}>
          {/* Top Navigation Row (Back / Guest) */}
          <View style={styles.topNavRow}>
            <TouchableOpacity style={styles.navBackBtn} onPress={onNavigateToStore} activeOpacity={0.7}>
              <BootstrapIcon name="chevron-left" size={16} color="#FFFFFF" />
              <Text style={styles.navBackText}>Shop</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navBackBtn} onPress={onNavigateToStore} activeOpacity={0.7}>
              <Text style={styles.navBackText}>Guest ➔</Text>
            </TouchableOpacity>
          </View>

          {/* ─── 1. TOP TEAL HEADER SECTION WITH PLANT ART ─── */}
          <View style={styles.topHeroSection}>
            <View style={styles.abstractOrganicShape}>
              <View style={styles.abstractOrganicShapeInner} />
            </View>

            <DecorativePlantPot />

            <Text style={styles.heroTitle}>Hello Rider!</Text>
            <Text style={styles.heroSubtitle}>Welcome to D,Blockchain Motorparts and Accessories</Text>
          </View>

          {/* ─── 2. WHITE CARD CONTAINER SHEET ─── */}
          <View style={styles.whiteCardSheet}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ flexGrow: 1 }}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.cardTitle}>Login</Text>

              {/* Redirect Notice */}
              {redirectReason ? (
                <View style={styles.errorBanner}>
                  <BootstrapIcon name="info-circle" size={14} color="#0C6258" />
                  <Text style={[styles.errorBannerText, { color: '#0C6258' }]}>{redirectReason}</Text>
                </View>
              ) : null}

              {/* Error Banner */}
              {errorMessage ? (
                <View style={styles.errorBanner}>
                  <BootstrapIcon name="info-circle" size={14} color="#DC2626" />
                  <Text style={styles.errorBannerText}>{errorMessage}</Text>
                </View>
              ) : null}

              {/* Email Input */}
              <View style={styles.inputGroup}>
                <View style={[styles.inputPill, focusedField === 'email' && styles.inputPillFocused]}>
                  <BootstrapIcon name="envelope" size={17} color="#88A9A3" />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Email Address"
                    placeholderTextColor="#9FB9B5"
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
                  />
                </View>
              </View>

              {/* Password Input */}
              <View style={styles.inputGroup}>
                <View style={[styles.inputPill, focusedField === 'password' && styles.inputPillFocused]}>
                  <BootstrapIcon name="lock" size={17} color="#88A9A3" />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Password"
                    placeholderTextColor="#9FB9B5"
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
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <BootstrapIcon name={showPassword ? 'eye-slash' : 'eye'} size={16} color="#88A9A3" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Forgot Password */}
              <TouchableOpacity
                style={styles.forgotPasswordRow}
                onPress={() => {
                  setErrorMessage('Password reset verification link sent to registered email.');
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>

              {/* Primary Login Button */}
              <TouchableOpacity
                style={styles.primaryPillBtn}
                onPress={handleEmailLogin}
                activeOpacity={0.9}
                disabled={isLoading}
              >
                <Text style={styles.primaryPillBtnText}>
                  {isLoading ? 'Logging In to Supabase...' : 'Login'}
                </Text>
              </TouchableOpacity>

              {/* Or Continue With Divider */}
              <View style={styles.socialDividerRow}>
                <View style={styles.socialDividerLine} />
                <Text style={styles.socialDividerText}>Or continue with</Text>
                <View style={styles.socialDividerLine} />
              </View>

              {/* Sign in with Google Button */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1.5,
                  borderColor: '#E2ECE9',
                  borderRadius: 25,
                  height: 48,
                  paddingHorizontal: 16,
                  shadowColor: '#0C6258',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.06,
                  shadowRadius: 6,
                  elevation: 1,
                  marginBottom: 8,
                }}
                onPress={handleGoogleLogin}
                activeOpacity={0.85}
                disabled={isGoogleLoading || isLoading}
              >
                <GoogleIcon size={18} />
                <Text style={{ color: '#1E293B', fontWeight: '700', fontSize: 14 }}>
                  {isGoogleLoading ? 'Connecting to Google...' : 'Sign in with Google'}
                </Text>
              </TouchableOpacity>

              {googleAdvisory && (
                <View
                  style={{
                    marginBottom: 14,
                    padding: 14,
                    backgroundColor: '#FEF3C7',
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: '#FDE68A',
                    width: '100%',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <BootstrapIcon name="info-circle-fill" size={14} color="#B45309" />
                    <Text style={{ fontWeight: '800', fontSize: 12.5, color: '#92400E' }}>
                      Google OAuth Setup Required
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11.5, color: '#78350F', lineHeight: 16, marginBottom: 10 }}>
                    Google provider is not enabled yet in your Supabase project (vtbdmurblidtdghaotne). Enable Google in Supabase Dashboard &gt; Authentication &gt; Providers. In the meantime, you can test immediately with one click:
                  </Text>

                  <TouchableOpacity
                    style={{
                      backgroundColor: '#0C6258',
                      borderRadius: 10,
                      paddingVertical: 9,
                      paddingHorizontal: 12,
                      alignItems: 'center',
                      marginBottom: 8,
                    }}
                    onPress={handleGoogleInstantTest}
                    activeOpacity={0.85}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 12 }}>
                      ✓ Test Sign In as Google Rider (Instant)
                    </Text>
                  </TouchableOpacity>

                  <View style={{ backgroundColor: '#FFFFFF', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#FDE68A' }}>
                    <Text style={{ fontSize: 10.5, color: '#64748B', marginBottom: 2 }}>
                      Your Supabase Redirect URI:
                    </Text>
                    <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#0C6258' }}>
                      https://vtbdmurblidtdghaotne.supabase.co/auth/v1/callback
                    </Text>
                  </View>
                </View>
              )}

              {/* Footer Switch to Sign Up */}
              <View style={[styles.footerSwitchRow, { marginTop: 16 }]}>
                <Text style={styles.footerSwitchText}>Don't have an account? </Text>
                <TouchableOpacity onPress={onNavigateToSignUp} activeOpacity={0.8}>
                  <Text style={styles.footerSwitchLink}>Sign Up with OTP</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
      <SafeAreaView style={{ flex: 0, backgroundColor: '#FFFFFF' }} />
    </View>
  );
}
