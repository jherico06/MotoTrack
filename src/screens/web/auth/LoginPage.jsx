import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Easing,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BootstrapIcon, BrandLogo, GoogleIcon } from '../../../components';
import { useAuth } from '../../../context/AuthContext.jsx';
import { systemSettingsService } from '../../../services/system/systemSettingsService.js';
import { appStorage } from '../../../services/system/storageAdapter.js';
import { fontFamily } from '../../../styles/typography.js';
import { botanicalStyles, authWebStyles as authStyles } from '../../../styles/web/loginPage.web.styles.js';

const REMEMBER_EMAIL_KEY = 'mototrack_remember_login_email';

export default function LoginPageWeb({
  onLoginSuccess,
  onSignUpSuccess,
  onNavigateToSignUp,
  onNavigateToStore,
  initialMode = 'signin',
  initialStaffVerifyEmail = '',
}) {
  const {
    login,
    loginWithGoogle,
    loginWithGoogleSimulated,
    validatePasswordStrength,
    sendSignupOtp,
    verifySignupOtp,
    requestPasswordResetOtp,
    confirmPasswordResetOtp,
  } = useAuth();

  // Active Mode: 'signin' | 'signup'
  const [activeMode, setActiveMode] = useState(initialMode);

  // Animated Sliding Value (0 = Sign In [Panel on Right], 1 = Sign Up [Panel on Left])
  const [slideAnim] = useState(() => new Animated.Value(initialMode === 'signup' ? 1 : 0));

  // Sign In Form State
  const [signInEmail, setSignInEmail] = useState(() => {
    try {
      return appStorage.getItem(REMEMBER_EMAIL_KEY) || '';
    } catch {
      return '';
    }
  });
  const [signInPassword, setSignInPassword] = useState('');
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [signInError, setSignInError] = useState('');
  const [authSuccessNotification, setAuthSuccessNotification] = useState('');
  const [brandSettings, setBrandSettings] = useState(() => systemSettingsService.getSettings());
  const [focusedField, setFocusedField] = useState(null);

  useEffect(() => {
    const unsub = systemSettingsService.subscribe(setBrandSettings);
    return unsub;
  }, []);

  // Suppress native Edge / Chromium password reveal icon to prevent duplicate eye icons
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const styleId = 'mototrack-hide-native-password-reveal';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
          input::-ms-reveal,
          input::-ms-clear {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
            visibility: hidden !important;
            pointer-events: none !important;
          }
          input::-webkit-contacts-auto-fill-button,
          input::-webkit-credentials-auto-fill-button {
            visibility: hidden !important;
            display: none !important;
            pointer-events: none !important;
            height: 0 !important;
            width: 0 !important;
            margin: 0 !important;
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);
  const [isSignInLoading, setIsSignInLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleAdvisory, setGoogleAdvisory] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    try {
      return Boolean(appStorage.getItem(REMEMBER_EMAIL_KEY));
    } catch {
      return false;
    }
  });

  // Sign Up Form State
  const [signUpStep, setSignUpStep] = useState(1); // 1 = Details + Password, 2 = 6-Digit OTP Verification
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPhone, setSignUpPhone] = useState('');
  const [signUpAddress, setSignUpAddress] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('');
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [signUpError, setSignUpError] = useState('');
  const [signUpSuccessMsg, setSignUpSuccessMsg] = useState('');
  const [isSignUpLoading, setIsSignUpLoading] = useState(false);

  // OTP State
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const otpInputRefs = useRef([]);

  // Forgot Password Modal State
  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1 = Request OTP, 2 = Enter OTP + New Password
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotInfo, setForgotInfo] = useState('');

  const handleOpenForgotPassword = () => {
    setForgotEmail(signInEmail.trim());
    setForgotStep(1);
    setForgotOtp('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setForgotError('');
    setForgotInfo('');
    setForgotModalVisible(true);
  };

  const handleRequestForgotOtp = async () => {
    setForgotError('');
    setForgotInfo('');
    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setForgotError('Please enter a valid registered email address.');
      return;
    }
    setForgotLoading(true);
    try {
      const res = await requestPasswordResetOtp?.({ email: cleanEmail });
      if (!res?.success) {
        setForgotError(res?.error || 'Could not send password reset code.');
        return;
      }
      setForgotStep(2);
      setForgotInfo(res.message || `A 6-digit password reset code has been sent to ${cleanEmail}.`);
    } catch (err) {
      setForgotError(err?.message || 'Could not send password reset code.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleConfirmForgotPassword = async () => {
    setForgotError('');
    const cleanEmail = forgotEmail.trim().toLowerCase();
    const cleanOtp = forgotOtp.replace(/\D/g, '').slice(0, 6);
    if (cleanOtp.length !== 6) {
      setForgotError('Please enter the 6-digit verification code sent to your email.');
      return;
    }
    const analysis = validatePasswordStrength ? validatePasswordStrength(forgotNewPassword) : null;
    if (analysis && !analysis.isStrong) {
      setForgotError(
        analysis.feedback ||
          'New password must be at least 8 characters with uppercase, lowercase, number, and symbol.'
      );
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('New password and confirmation do not match.');
      return;
    }
    setForgotLoading(true);
    try {
      const res = await confirmPasswordResetOtp?.({
        email: cleanEmail,
        otp: cleanOtp,
        newPassword: forgotNewPassword,
      });
      if (!res?.success) {
        setForgotError(res?.error || 'Password reset failed.');
        return;
      }
      setForgotModalVisible(false);
      setSignInEmail(cleanEmail);
      setSignInPassword('');
      setAuthSuccessNotification(
        res.message || 'Password reset complete! You can now sign in with your new password.'
      );
    } catch (err) {
      setForgotError(err?.message || 'Password reset failed.');
    } finally {
      setForgotLoading(false);
    }
  };

  // Input Refs for smooth keyboard traversal & enter-to-submit
  const signInEmailRef = useRef(null);
  const signInPasswordRef = useRef(null);
  const signUpNameRef = useRef(null);
  const signUpEmailRef = useRef(null);
  const signUpPhoneRef = useRef(null);
  const signUpAddressRef = useRef(null);
  const signUpPasswordRef = useRef(null);
  const signUpConfirmPasswordRef = useRef(null);

  // Password Strength State
  const passwordAnalysis = validatePasswordStrength
    ? validatePasswordStrength(signUpPassword)
    : {
        score: 0,
        strength: 'weak',
        label: 'Weak',
        color: '#DC2626',
        isStrong: false,
        criteria: {
          minLength: false,
          hasUppercase: false,
          hasLowercase: false,
          hasNumber: false,
          hasSpecial: false,
        },
        feedback: 'Password must be at least 8 characters with upper, lower, number, and special character.',
      };

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: activeMode === 'signup' ? 1 : 0,
      duration: 500,
      easing: Easing.bezier(0.65, 0, 0.35, 1),
      useNativeDriver: false,
    }).start();
  }, [activeMode]);

  // Resend OTP countdown timer
  useEffect(() => {
    let interval = null;
    if (signUpStep === 2 && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [signUpStep, resendTimer]);

  const toggleMode = () => {
    setSignInError('');
    setSignUpError('');
    setSignUpSuccessMsg('');
    setActiveMode((prev) => (prev === 'signup' ? 'signin' : 'signup'));
  };

  // ─── 1. SIGN IN HANDLER (CONNECTED TO SUPABASE) ───
  const handleSignInSubmit = async () => {
    if (isSignInLoading) return;
    setSignInError('');
    setAuthSuccessNotification('');
    const cleanEmail = (signInEmail || '').trim();
    const cleanPassword = (signInPassword || '').trim();

    if (!cleanEmail || !cleanPassword) {
      setSignInError('Please enter your email or username and password.');
      return;
    }

    setIsSignInLoading(true);
    const res = await login(cleanEmail, cleanPassword);
    setIsSignInLoading(false);

    if (!res.success) {
      setSignInError(res.error || 'Invalid email or password.');
      return;
    }

    try {
      if (rememberMe) {
        appStorage.setItem(REMEMBER_EMAIL_KEY, cleanEmail);
      } else {
        appStorage.removeItem(REMEMBER_EMAIL_KEY);
      }
    } catch {
      /* ignore */
    }

    if (onLoginSuccess) {
      onLoginSuccess(res.user);
    } else {
      onNavigateToStore?.();
    }
  };

  const handleGoogleSignIn = async () => {
    setSignInError('');
    setGoogleAdvisory(false);
    setIsGoogleLoading(true);
    try {
      const res = await loginWithGoogle();
      if (res?.success && res.user) {
        if (onLoginSuccess) {
          onLoginSuccess(res.user);
        } else {
          onNavigateToStore?.();
        }
      } else if (res?.redirecting) {
        // Browser is redirecting to Google OAuth
      } else if (res?.notEnabled) {
        setGoogleAdvisory(true);
      } else if (res?.cancelled) {
        // User cancelled or closed prompt
      } else if (res?.error) {
        setSignInError(res.error);
      }
    } catch (err) {
      setSignInError('Google sign in error: ' + (err?.message || 'Unknown error'));
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
        if (onLoginSuccess) {
          onLoginSuccess(res.user);
        } else {
          onNavigateToStore?.();
        }
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // ─── 2. SIGN UP STEP 1: SEND OTP (WITH STRONG PASSWORD VALIDATION) ───
  const handleRequestOtp = async () => {
    if (isSignUpLoading) return;
    setSignUpError('');
    setSignUpSuccessMsg('');

    if (!signUpName.trim()) {
      setSignUpError('Please enter your full name.');
      return;
    }
    if (!signUpEmail.trim() || !signUpEmail.includes('@')) {
      setSignUpError('Please enter a valid email address.');
      return;
    }
    if (!signUpPhone.trim()) {
      setSignUpError('Please enter your contact phone number.');
      return;
    }
    if (!signUpAddress.trim()) {
      setSignUpError('Please enter your delivery address.');
      return;
    }
    if (!passwordAnalysis.isStrong) {
      setSignUpError(
        passwordAnalysis.feedback || 'Please choose a strong password fulfilling all security requirements.'
      );
      return;
    }
    if (signUpPassword !== signUpConfirmPassword) {
      setSignUpError('Passwords do not match. Please verify your password confirmation.');
      return;
    }

    setIsSignUpLoading(true);
    const res = await sendSignupOtp({
      email: signUpEmail.trim(),
      name: signUpName.trim(),
    });
    setIsSignUpLoading(false);

    if (!res.success) {
      setSignUpError(res.error || 'Failed to send verification code. Please try again.');
      return;
    }

    setSignUpStep(2);
    setResendTimer(60);
    setCanResend(false);
    setOtpDigits(['', '', '', '', '', '']);
    setSignUpSuccessMsg(`Verification code sent to ${signUpEmail.trim()}. Please check your Gmail.`);
  };

  // ─── 3. RESEND OTP ───
  const handleResendOtp = async () => {
    if (!canResend) return;
    setSignUpError('');
    setSignUpSuccessMsg('');

    setIsSignUpLoading(true);
    const res = await sendSignupOtp({
      email: signUpEmail.trim(),
      name: signUpName.trim(),
    });
    setIsSignUpLoading(false);

    if (res.success) {
      setResendTimer(60);
      setCanResend(false);
      setSignUpSuccessMsg(`New 6-digit code sent to ${signUpEmail.trim()}. Please check your Gmail.`);
    } else {
      setSignUpError(res.error || 'Failed to resend code.');
    }
  };

  // ─── 4. OTP DIGIT INPUT HANDLING ───
  const handleOtpChange = (text, index) => {
    const cleanText = text.replace(/[^0-9]/g, '');
    const newDigits = [...otpDigits];

    if (cleanText.length > 1) {
      // Pasted full code
      const pasted = cleanText.slice(0, 6).split('');
      for (let i = 0; i < 6; i++) {
        newDigits[i] = pasted[i] || '';
      }
      setOtpDigits(newDigits);
      if (otpInputRefs.current[5]) {
        otpInputRefs.current[5].focus();
      }
      return;
    }

    newDigits[index] = cleanText;
    setOtpDigits(newDigits);

    // Auto-advance to next input
    if (cleanText && index < 5 && otpInputRefs.current[index + 1]) {
      otpInputRefs.current[index + 1].focus();
    }
  };

  const handleOtpKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otpDigits[index] && index > 0) {
      if (otpInputRefs.current[index - 1]) {
        otpInputRefs.current[index - 1].focus();
      }
    }
  };

  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [createdUserName, setCreatedUserName] = useState('');

  // ─── 5. SIGN UP STEP 2: VERIFY OTP & CREATE ACCOUNT IN SUPABASE ───
  const handleVerifyOtpAndCreate = async () => {
    if (isSignUpLoading) return;
    setSignUpError('');
    const fullOtp = otpDigits.join('');

    if (fullOtp.length < 6) {
      setSignUpError('Please enter all 6 digits of the verification code.');
      return;
    }

    setIsSignUpLoading(true);
    const res = await verifySignupOtp({
      email: signUpEmail.trim(),
      otp: fullOtp,
      registrationData: {
        name: signUpName.trim(),
        email: signUpEmail.trim(),
        phone: signUpPhone.trim(),
        address: signUpAddress.trim(),
        password: signUpPassword,
        isAdmin: false,
      },
    });
    setIsSignUpLoading(false);

    if (!res.success) {
      setSignUpError(res.error || 'Verification failed. Please check the code and try again.');
      return;
    }

    // Direct navigation straight to the storefront
    if (onLoginSuccess) {
      onLoginSuccess(res.user);
    } else if (onSignUpSuccess) {
      onSignUpSuccess(res.user);
    } else {
      onNavigateToStore?.();
    }
  };

  const { width: windowWidth } = useWindowDimensions();
  const isMobile = windowWidth < 768;
  const halfWidth = Math.round(windowWidth * 0.5);

  // Interpolated sliding translations for full-screen split-screen layout (half-width slide)
  const overlayTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [halfWidth, 0],
  });

  const isSignUp = activeMode === 'signup';

  const signInFormContent = (
    <>
      {/* MotoTrack Brand Logo */}
      <View style={authStyles.modalTopLogo}>
        <BrandLogo size={42} textColor="#181A1D" accentColor="#EA580C" />
      </View>

      <Text style={[authStyles.formHeading, { fontFamily: fontFamily.sans }]}>
        Sign In to {brandSettings.storeName || 'MotoTrack'}
      </Text>

      {authSuccessNotification ? (
        <View style={authStyles.successBadge}>
          <BootstrapIcon name="check-circle" size={14} color="#065F46" />
          <Text style={[authStyles.successBadgeText, { fontFamily: fontFamily.sans }]}>
            {authSuccessNotification}
          </Text>
        </View>
      ) : null}

      {signInError.length > 0 && (
        <View style={authStyles.errorBadge}>
          <BootstrapIcon name="exclamation-circle" size={13} color="#DC2626" />
          <Text style={[authStyles.errorBadgeText, { fontFamily: fontFamily.sans }]}>{signInError}</Text>
        </View>
      )}

      {/* Email / Username Input */}
      <View style={[authStyles.inputWrap, focusedField === 'signInEmail' && authStyles.inputWrapFocused]}>
        <BootstrapIcon
          name="envelope"
          size={16}
          color={focusedField === 'signInEmail' ? '#EA580C' : '#64748B'}
        />
        <TextInput
          ref={signInEmailRef}
          style={[authStyles.textInput, { fontFamily: fontFamily.sans }]}
          placeholder="Email or username"
          placeholderTextColor="#64748B"
          value={signInEmail}
          onChangeText={(t) => {
            setSignInEmail(t);
            if (signInError) setSignInError('');
          }}
          onFocus={() => setFocusedField('signInEmail')}
          onBlur={() => setFocusedField(null)}
          keyboardType="email-address"
          autoCapitalize="none"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => {
            if (signInPassword.trim()) {
              handleSignInSubmit();
            } else {
              signInPasswordRef.current?.focus();
            }
          }}
        />
      </View>

      {/* Password Input */}
      <View style={[authStyles.inputWrap, focusedField === 'signInPassword' && authStyles.inputWrapFocused]}>
        <BootstrapIcon
          name="lock"
          size={16}
          color={focusedField === 'signInPassword' ? '#EA580C' : '#64748B'}
        />
        <TextInput
          ref={signInPasswordRef}
          style={[authStyles.textInput, { fontFamily: fontFamily.sans }]}
          placeholder="Password"
          placeholderTextColor="#64748B"
          value={signInPassword}
          onChangeText={(t) => {
            setSignInPassword(t);
            if (signInError) setSignInError('');
          }}
          onFocus={() => setFocusedField('signInPassword')}
          onBlur={() => setFocusedField(null)}
          secureTextEntry={!showSignInPassword}
          autoCapitalize="none"
          returnKeyType="go"
          onSubmitEditing={handleSignInSubmit}
        />
        <TouchableOpacity
          onPress={() => setShowSignInPassword(!showSignInPassword)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ cursor: 'pointer' }}
        >
          <BootstrapIcon
            name={showSignInPassword ? 'eye-slash' : 'eye'}
            size={16}
            color={focusedField === 'signInPassword' ? '#EA580C' : '#64748B'}
          />
        </TouchableOpacity>
      </View>

      {/* Remember Me & Forgot Password */}
      <View style={authStyles.rememberForgotRow}>
        <TouchableOpacity
          style={authStyles.rememberMeBtn}
          onPress={() => setRememberMe((prev) => !prev)}
          activeOpacity={0.8}
        >
          <View style={[authStyles.rememberCheckbox, rememberMe && authStyles.rememberCheckboxChecked]}>
            {rememberMe ? <BootstrapIcon name="check" size={12} color="#FFFFFF" /> : null}
          </View>
          <Text style={[authStyles.rememberMeText, { fontFamily: fontFamily.sans }]}>Remember me</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={authStyles.forgotPasswordBtn}
          onPress={handleOpenForgotPassword}
          activeOpacity={0.8}
        >
          <Text style={[authStyles.forgotPasswordText, { fontFamily: fontFamily.sans }]}>
            Forgot Password?
          </Text>
        </TouchableOpacity>
      </View>

      {/* Orange Login Button */}
      <TouchableOpacity
        style={authStyles.primaryTealBtn}
        onPress={handleSignInSubmit}
        activeOpacity={0.85}
        disabled={isSignInLoading}
      >
        <Text style={[authStyles.primaryTealBtnText, { fontFamily: fontFamily.sans }]}>
          {isSignInLoading ? 'LOGGING IN...' : 'LOGIN TO ACCOUNT'}
        </Text>
      </TouchableOpacity>

      {/* Or Continue With Google */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          width: '100%',
          marginVertical: 18,
          gap: 12,
        }}
      >
        <View style={{ flex: 1, height: 1, backgroundColor: '#E2E8F0' }} />
        <Text
          style={{
            fontSize: 11,
            color: '#94A3B8',
            fontWeight: '700',
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            fontFamily: fontFamily.sans,
          }}
        >
          Or continue with
        </Text>
        <View style={{ flex: 1, height: 1, backgroundColor: '#E2E8F0' }} />
      </View>

      {/* Google Sign In Button */}
      <TouchableOpacity
        style={{
          width: '100%',
          height: 48,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          backgroundColor: '#FFFFFF',
          borderWidth: 1.5,
          borderColor: '#94A3B8',
          borderRadius: 12,
          paddingVertical: 12,
          paddingHorizontal: 18,
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)',
          cursor: 'pointer',
        }}
        onPress={handleGoogleSignIn}
        activeOpacity={0.85}
        disabled={isGoogleLoading || isSignInLoading}
      >
        <GoogleIcon size={18} />
        <Text
          style={{
            color: '#1E293B',
            fontWeight: '700',
            fontSize: 13.5,
            letterSpacing: 0.2,
            fontFamily: fontFamily.sans,
          }}
        >
          {isGoogleLoading ? 'Connecting to Google...' : 'Sign in with Google'}
        </Text>
      </TouchableOpacity>

      {googleAdvisory && (
        <View
          style={{
            marginTop: 14,
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
            <Text
              style={{ fontWeight: '600', fontSize: 12.5, color: '#92400E', fontFamily: fontFamily.sans }}
            >
              Google OAuth Setup Required
            </Text>
          </View>
          <Text
            style={{
              fontSize: 11.5,
              color: '#78350F',
              lineHeight: 16,
              marginBottom: 10,
              fontFamily: fontFamily.sans,
            }}
          >
            Google provider is not enabled yet in your Supabase project (vtbdmurblidtdghaotne). Enable Google
            in Supabase Dashboard &gt; Authentication &gt; Providers. In the meantime, you can test
            immediately with one click:
          </Text>

          <TouchableOpacity
            style={{
              backgroundColor: '#EA580C',
              borderRadius: 10,
              paddingVertical: 9,
              paddingHorizontal: 12,
              alignItems: 'center',
              marginBottom: 8,
              cursor: 'pointer',
            }}
            onPress={handleGoogleInstantTest}
            activeOpacity={0.85}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 12, fontFamily: fontFamily.sans }}>
              ✓ Test Sign In as Google Rider (Instant)
            </Text>
          </TouchableOpacity>

          <View
            style={{
              backgroundColor: '#FFFFFF',
              padding: 8,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#FDE68A',
            }}
          >
            <Text style={{ fontSize: 10.5, color: '#64748B', marginBottom: 2, fontFamily: fontFamily.sans }}>
              Your Supabase Redirect URI:
            </Text>
            <Text
              style={{ fontSize: 10.5, fontWeight: '700', color: '#EA580C', fontFamily: fontFamily.sans }}
            >
              https://vtbdmurblidtdghaotne.supabase.co/auth/v1/callback
            </Text>
          </View>
        </View>
      )}
    </>
  );

  const signUpFormContent = (
    <>
      {/* MotoTrack Brand Logo */}
      <View style={authStyles.modalTopLogo}>
        <BrandLogo size={42} textColor="#181A1D" accentColor="#EA580C" />
      </View>

      {signUpStep === 1 ? (
        // ─── SIGN UP STEP 1: CREDENTIALS & STRONG PASSWORD ───
        <>
          <Text style={[authStyles.formHeading, { fontFamily: fontFamily.sans }]}>Create Account</Text>
          <Text style={[authStyles.mutedSubtext, { fontFamily: fontFamily.sans }]}>
            Join {brandSettings.storeName || 'MotoTrack'} Community
          </Text>

          {signUpError.length > 0 && (
            <View style={authStyles.errorBadge}>
              <BootstrapIcon name="exclamation-circle" size={13} color="#DC2626" />
              <Text style={[authStyles.errorBadgeText, { fontFamily: fontFamily.sans }]}>{signUpError}</Text>
            </View>
          )}

          {/* Name */}
          <View style={[authStyles.inputWrap, focusedField === 'signUpName' && authStyles.inputWrapFocused]}>
            <BootstrapIcon
              name="person"
              size={16}
              color={focusedField === 'signUpName' ? '#EA580C' : '#64748B'}
            />
            <TextInput
              ref={signUpNameRef}
              style={[authStyles.textInput, { fontFamily: fontFamily.sans }]}
              placeholder="Full Name"
              placeholderTextColor="#64748B"
              value={signUpName}
              onChangeText={(t) => {
                setSignUpName(t);
                if (signUpError) setSignUpError('');
              }}
              onFocus={() => setFocusedField('signUpName')}
              onBlur={() => setFocusedField(null)}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => signUpEmailRef.current?.focus()}
            />
          </View>

          {/* Email */}
          <View style={[authStyles.inputWrap, focusedField === 'signUpEmail' && authStyles.inputWrapFocused]}>
            <BootstrapIcon
              name="envelope"
              size={16}
              color={focusedField === 'signUpEmail' ? '#EA580C' : '#64748B'}
            />
            <TextInput
              ref={signUpEmailRef}
              style={[authStyles.textInput, { fontFamily: fontFamily.sans }]}
              placeholder="Email Address"
              placeholderTextColor="#64748B"
              value={signUpEmail}
              onChangeText={(t) => {
                setSignUpEmail(t);
                if (signUpError) setSignUpError('');
              }}
              onFocus={() => setFocusedField('signUpEmail')}
              onBlur={() => setFocusedField(null)}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => signUpPhoneRef.current?.focus()}
            />
          </View>

          {/* Phone */}
          <View style={[authStyles.inputWrap, focusedField === 'signUpPhone' && authStyles.inputWrapFocused]}>
            <BootstrapIcon
              name="phone"
              size={16}
              color={focusedField === 'signUpPhone' ? '#EA580C' : '#64748B'}
            />
            <TextInput
              ref={signUpPhoneRef}
              style={[authStyles.textInput, { fontFamily: fontFamily.sans }]}
              placeholder="Contact Number (+63 917...)"
              placeholderTextColor="#64748B"
              value={signUpPhone}
              onChangeText={(t) => {
                setSignUpPhone(t);
                if (signUpError) setSignUpError('');
              }}
              onFocus={() => setFocusedField('signUpPhone')}
              onBlur={() => setFocusedField(null)}
              keyboardType="phone-pad"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => signUpAddressRef.current?.focus()}
            />
          </View>

          {/* Delivery Address */}
          <View
            style={[authStyles.inputWrap, focusedField === 'signUpAddress' && authStyles.inputWrapFocused]}
          >
            <BootstrapIcon
              name="geo-alt"
              size={16}
              color={focusedField === 'signUpAddress' ? '#EA580C' : '#64748B'}
            />
            <TextInput
              ref={signUpAddressRef}
              style={[authStyles.textInput, { fontFamily: fontFamily.sans }]}
              placeholder="Complete Delivery Address"
              placeholderTextColor="#64748B"
              value={signUpAddress}
              onChangeText={(t) => {
                setSignUpAddress(t);
                if (signUpError) setSignUpError('');
              }}
              onFocus={() => setFocusedField('signUpAddress')}
              onBlur={() => setFocusedField(null)}
              autoCapitalize="words"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => signUpPasswordRef.current?.focus()}
            />
          </View>

          {/* Password */}
          <View
            style={[authStyles.inputWrap, focusedField === 'signUpPassword' && authStyles.inputWrapFocused]}
          >
            <BootstrapIcon
              name="lock"
              size={16}
              color={focusedField === 'signUpPassword' ? '#EA580C' : '#64748B'}
            />
            <TextInput
              ref={signUpPasswordRef}
              style={[authStyles.textInput, { fontFamily: fontFamily.sans }]}
              placeholder="Create Strong Password"
              placeholderTextColor="#64748B"
              value={signUpPassword}
              onChangeText={(t) => {
                setSignUpPassword(t);
                if (signUpError) setSignUpError('');
              }}
              onFocus={() => setFocusedField('signUpPassword')}
              onBlur={() => setFocusedField(null)}
              secureTextEntry={!showSignUpPassword}
              autoCapitalize="none"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => signUpConfirmPasswordRef.current?.focus()}
            />
            <TouchableOpacity
              onPress={() => setShowSignUpPassword(!showSignUpPassword)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ cursor: 'pointer' }}
            >
              <BootstrapIcon
                name={showSignUpPassword ? 'eye-slash' : 'eye'}
                size={16}
                color={focusedField === 'signUpPassword' ? '#EA580C' : '#64748B'}
              />
            </TouchableOpacity>
          </View>

          {/* Real-time Password Strength Meter */}
          {signUpPassword.length > 0 && (
            <View style={authStyles.strengthMeterBox}>
              <View style={authStyles.strengthHeader}>
                <Text style={[authStyles.strengthLabel, { fontFamily: fontFamily.sans }]}>
                  Password Strength:
                </Text>
                <Text
                  style={[
                    authStyles.strengthBadge,
                    { color: passwordAnalysis.color, fontFamily: fontFamily.sans },
                  ]}
                >
                  {passwordAnalysis.label} ({passwordAnalysis.score}%)
                </Text>
              </View>
              <View style={authStyles.meterTrack}>
                <View
                  style={[
                    authStyles.meterFill,
                    {
                      width: `${passwordAnalysis.score}%`,
                      backgroundColor: passwordAnalysis.color,
                    },
                  ]}
                />
              </View>
              <View style={authStyles.criteriaRow}>
                <View style={authStyles.criteriaChip}>
                  <BootstrapIcon
                    name={passwordAnalysis.criteria.minLength ? 'check-circle-fill' : 'circle'}
                    size={10}
                    color={passwordAnalysis.criteria.minLength ? '#10B981' : '#94A3B8'}
                  />
                  <Text
                    style={[
                      authStyles.criteriaChipText,
                      passwordAnalysis.criteria.minLength && authStyles.criteriaChipTextActive,
                      { fontFamily: fontFamily.sans },
                    ]}
                  >
                    8+ Chars
                  </Text>
                </View>
                <View style={authStyles.criteriaChip}>
                  <BootstrapIcon
                    name={passwordAnalysis.criteria.hasUppercase ? 'check-circle-fill' : 'circle'}
                    size={10}
                    color={passwordAnalysis.criteria.hasUppercase ? '#10B981' : '#94A3B8'}
                  />
                  <Text
                    style={[
                      authStyles.criteriaChipText,
                      passwordAnalysis.criteria.hasUppercase && authStyles.criteriaChipTextActive,
                      { fontFamily: fontFamily.sans },
                    ]}
                  >
                    A-Z
                  </Text>
                </View>
                <View style={authStyles.criteriaChip}>
                  <BootstrapIcon
                    name={passwordAnalysis.criteria.hasLowercase ? 'check-circle-fill' : 'circle'}
                    size={10}
                    color={passwordAnalysis.criteria.hasLowercase ? '#10B981' : '#94A3B8'}
                  />
                  <Text
                    style={[
                      authStyles.criteriaChipText,
                      passwordAnalysis.criteria.hasLowercase && authStyles.criteriaChipTextActive,
                      { fontFamily: fontFamily.sans },
                    ]}
                  >
                    a-z
                  </Text>
                </View>
                <View style={authStyles.criteriaChip}>
                  <BootstrapIcon
                    name={passwordAnalysis.criteria.hasNumber ? 'check-circle-fill' : 'circle'}
                    size={10}
                    color={passwordAnalysis.criteria.hasNumber ? '#10B981' : '#94A3B8'}
                  />
                  <Text
                    style={[
                      authStyles.criteriaChipText,
                      passwordAnalysis.criteria.hasNumber && authStyles.criteriaChipTextActive,
                      { fontFamily: fontFamily.sans },
                    ]}
                  >
                    0-9
                  </Text>
                </View>
                <View style={authStyles.criteriaChip}>
                  <BootstrapIcon
                    name={passwordAnalysis.criteria.hasSpecial ? 'check-circle-fill' : 'circle'}
                    size={10}
                    color={passwordAnalysis.criteria.hasSpecial ? '#10B981' : '#94A3B8'}
                  />
                  <Text
                    style={[
                      authStyles.criteriaChipText,
                      passwordAnalysis.criteria.hasSpecial && authStyles.criteriaChipTextActive,
                      { fontFamily: fontFamily.sans },
                    ]}
                  >
                    !@#$
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Confirm Password */}
          <View
            style={[
              authStyles.inputWrap,
              focusedField === 'signUpConfirmPassword' && authStyles.inputWrapFocused,
            ]}
          >
            <BootstrapIcon
              name="lock-fill"
              size={16}
              color={focusedField === 'signUpConfirmPassword' ? '#EA580C' : '#64748B'}
            />
            <TextInput
              ref={signUpConfirmPasswordRef}
              style={[authStyles.textInput, { fontFamily: fontFamily.sans }]}
              placeholder="Confirm Password"
              placeholderTextColor="#64748B"
              value={signUpConfirmPassword}
              onChangeText={(t) => {
                setSignUpConfirmPassword(t);
                if (signUpError) setSignUpError('');
              }}
              onFocus={() => setFocusedField('signUpConfirmPassword')}
              onBlur={() => setFocusedField(null)}
              secureTextEntry={!showSignUpPassword}
              autoCapitalize="none"
              returnKeyType="go"
              onSubmitEditing={handleRequestOtp}
            />
            {signUpConfirmPassword.length > 0 && (
              <BootstrapIcon
                name={signUpPassword === signUpConfirmPassword ? 'check-circle-fill' : 'x-circle-fill'}
                size={16}
                color={signUpPassword === signUpConfirmPassword ? '#10B981' : '#DC2626'}
              />
            )}
          </View>

          <TouchableOpacity
            style={[
              authStyles.primaryTealBtn,
              (!passwordAnalysis.isStrong || isSignUpLoading) && authStyles.primaryTealBtnDisabled,
            ]}
            onPress={handleRequestOtp}
            activeOpacity={0.85}
            disabled={!passwordAnalysis.isStrong || isSignUpLoading}
          >
            <Text style={[authStyles.primaryTealBtnText, { fontFamily: fontFamily.sans }]}>
              {isSignUpLoading ? 'SENDING...' : 'CONTINUE'}
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        // ─── SIGN UP STEP 2: 6-DIGIT OTP VERIFICATION ───
        <View style={authStyles.otpContainer}>
          <TouchableOpacity
            style={authStyles.otpBackBtn}
            onPress={() => setSignUpStep(1)}
            activeOpacity={0.8}
          >
            <BootstrapIcon name="arrow-left" size={13} color="#EA580C" />
            <Text style={[authStyles.otpBackBtnText, { fontFamily: fontFamily.sans }]}>Back to details</Text>
          </TouchableOpacity>

          <View style={authStyles.otpHeader}>
            <View style={authStyles.otpBadge}>
              <BootstrapIcon name="shield-lock-fill" size={24} color="#EA580C" />
            </View>
            <Text style={[authStyles.formHeading, { fontFamily: fontFamily.sans }]}>Enter OTP Code</Text>
            <Text style={[authStyles.otpSubtitle, { fontFamily: fontFamily.sans }]}>
              We sent a 6-digit code to <Text style={authStyles.otpEmailHighlight}>{signUpEmail}</Text>
            </Text>
          </View>

          {signUpSuccessMsg ? (
            <View style={authStyles.successBadge}>
              <BootstrapIcon name="check-circle" size={13} color="#065F46" />
              <Text style={[authStyles.successBadgeText, { fontFamily: fontFamily.sans }]}>
                {signUpSuccessMsg}
              </Text>
            </View>
          ) : null}

          {signUpError.length > 0 && (
            <View style={authStyles.errorBadge}>
              <BootstrapIcon name="exclamation-circle" size={13} color="#DC2626" />
              <Text style={[authStyles.errorBadgeText, { fontFamily: fontFamily.sans }]}>{signUpError}</Text>
            </View>
          )}

          {/* 6 PIN Digit Input Boxes */}
          <View style={authStyles.otpBoxesRow}>
            {otpDigits.map((digit, idx) => (
              <TextInput
                key={idx}
                ref={(el) => (otpInputRefs.current[idx] = el)}
                style={[
                  authStyles.otpBox,
                  digit ? authStyles.otpBoxFilled : null,
                  { fontFamily: fontFamily.sans },
                ]}
                value={digit}
                onChangeText={(val) => handleOtpChange(val, idx)}
                onKeyPress={(e) => handleOtpKeyPress(e, idx)}
                keyboardType="number-pad"
                maxLength={6}
                selectTextOnFocus
                returnKeyType={idx === 5 ? 'go' : 'next'}
                onSubmitEditing={handleVerifyOtpAndCreate}
              />
            ))}
          </View>

          {/* Verify & Complete Button */}
          <TouchableOpacity
            style={authStyles.primaryTealBtn}
            onPress={handleVerifyOtpAndCreate}
            activeOpacity={0.85}
            disabled={isSignUpLoading}
          >
            <Text style={[authStyles.primaryTealBtnText, { fontFamily: fontFamily.sans }]}>
              {isSignUpLoading ? 'CREATING ACCOUNT...' : 'VERIFY & CREATE ACCOUNT'}
            </Text>
          </TouchableOpacity>

          {/* Resend Timer Row */}
          <View style={authStyles.resendRow}>
            <Text style={[authStyles.resendText, { fontFamily: fontFamily.sans }]}>
              Didn't receive code?{' '}
            </Text>
            {canResend ? (
              <TouchableOpacity onPress={handleResendOtp} activeOpacity={0.8}>
                <Text style={[authStyles.resendLink, { fontFamily: fontFamily.sans }]}>Resend Code</Text>
              </TouchableOpacity>
            ) : (
              <Text style={[authStyles.resendCountdown, { fontFamily: fontFamily.sans }]}>
                Resend in {resendTimer}s
              </Text>
            )}
          </View>
        </View>
      )}
    </>
  );

  const renderSuccessModal = () => {
    if (!successModalVisible) return null;
    return (
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(24, 26, 29, 0.85)',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 999,
          padding: 20,
        }}
      >
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 24,
            padding: 32,
            maxWidth: 440,
            width: '100%',
            alignItems: 'center',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.35)',
            borderWidth: 1.5,
            borderColor: '#E2E8F0',
          }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: '#D1FAE5',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <BootstrapIcon name="check-circle-fill" size={34} color="#059669" />
          </View>

          <Text
            style={{
              fontSize: 22,
              fontWeight: '600',
              color: '#EA580C',
              textAlign: 'center',
              marginBottom: 8,
              fontFamily: fontFamily.sans,
            }}
          >
            Account Created!
          </Text>

          <Text
            style={{
              fontSize: 13.5,
              color: '#64748B',
              textAlign: 'center',
              lineHeight: 20,
              marginBottom: 24,
              fontFamily: fontFamily.sans,
            }}
          >
            Welcome to {brandSettings.storeName || 'MotoTrack'},{' '}
            <Text style={{ fontWeight: '700', color: '#0F172A' }}>{createdUserName}</Text>! Your email has
            been verified. Please sign in with your password to continue to the storefront.
          </Text>

          <TouchableOpacity
            style={{
              backgroundColor: '#EA580C',
              paddingVertical: 13,
              paddingHorizontal: 28,
              borderRadius: 10,
              width: '100%',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(234, 88, 12, 0.35)',
              cursor: 'pointer',
            }}
            onPress={() => setSuccessModalVisible(false)}
            activeOpacity={0.85}
          >
            <Text
              style={{
                color: '#FFFFFF',
                fontWeight: '600',
                fontSize: 13.5,
                letterSpacing: 0.5,
                fontFamily: fontFamily.sans,
              }}
            >
              PROCEED TO SIGN IN ➔
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderForgotPasswordModal = () => {
    if (!forgotModalVisible) return null;
    const forgotPwdAnalysis = validatePasswordStrength
      ? validatePasswordStrength(forgotNewPassword)
      : { isStrong: forgotNewPassword.length >= 8, score: 100, color: '#10B981', label: 'Strong' };

    return (
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(24, 26, 29, 0.85)',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 999,
          padding: 20,
        }}
      >
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 24,
            padding: 32,
            maxWidth: 460,
            width: '100%',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.35)',
            borderWidth: 1.5,
            borderColor: '#E2E8F0',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 14,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: '#FFF7ED',
                  borderWidth: 1,
                  borderColor: '#FED7AA',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <BootstrapIcon name="key-fill" size={18} color="#EA580C" />
              </View>
              <View>
                <Text
                  style={{ fontSize: 18, fontWeight: '700', color: '#0F172A', fontFamily: fontFamily.sans }}
                >
                  Account Password Recovery
                </Text>
                <Text style={{ fontSize: 12, color: '#64748B', fontFamily: fontFamily.sans }}>
                  {forgotStep === 1
                    ? 'Step 1 of 2 — Verify registered email'
                    : 'Step 2 of 2 — Enter OTP & new password'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setForgotModalVisible(false)}
              style={{ padding: 6, cursor: 'pointer' }}
              activeOpacity={0.7}
            >
              <BootstrapIcon name="x-lg" size={16} color="#64748B" />
            </TouchableOpacity>
          </View>

          {forgotInfo ? (
            <View style={[authStyles.successBadge, { marginBottom: 12 }]}>
              <BootstrapIcon name="check-circle-fill" size={14} color="#059669" />
              <Text style={[authStyles.successBadgeText, { fontFamily: fontFamily.sans }]}>{forgotInfo}</Text>
            </View>
          ) : null}

          {forgotError ? (
            <View style={[authStyles.errorBadge, { marginBottom: 12 }]}>
              <BootstrapIcon name="exclamation-circle" size={14} color="#DC2626" />
              <Text style={[authStyles.errorBadgeText, { fontFamily: fontFamily.sans }]}>{forgotError}</Text>
            </View>
          ) : null}

          {forgotStep === 1 ? (
            <>
              <Text
                style={{
                  fontSize: 13,
                  color: '#475569',
                  lineHeight: 19,
                  marginBottom: 14,
                  fontFamily: fontFamily.sans,
                }}
              >
                Enter your registered account or administrator email address. We will send a 6-digit
                verification code to reset your password.
              </Text>

              <View style={[authStyles.inputWrap, { marginBottom: 18 }]}>
                <BootstrapIcon name="envelope" size={16} color="#64748B" />
                <TextInput
                  style={[authStyles.textInput, { fontFamily: fontFamily.sans }]}
                  placeholder="Registered Email Address"
                  placeholderTextColor="#64748B"
                  value={forgotEmail}
                  onChangeText={(t) => {
                    setForgotEmail(t);
                    if (forgotError) setForgotError('');
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="go"
                  onSubmitEditing={handleRequestForgotOtp}
                />
              </View>

              <TouchableOpacity
                style={[authStyles.primaryTealBtn, forgotLoading && authStyles.primaryTealBtnDisabled]}
                onPress={handleRequestForgotOtp}
                disabled={forgotLoading}
                activeOpacity={0.85}
              >
                <Text style={[authStyles.primaryTealBtnText, { fontFamily: fontFamily.sans }]}>
                  {forgotLoading ? 'SENDING CODE...' : 'SEND 6-DIGIT RECOVERY CODE'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={[authStyles.inputWrap, { marginBottom: 12 }]}>
                <BootstrapIcon name="shield-lock" size={16} color="#EA580C" />
                <TextInput
                  style={[
                    authStyles.textInput,
                    { fontFamily: fontFamily.sans, letterSpacing: 3, fontWeight: '700' },
                  ]}
                  placeholder="6-Digit OTP Code"
                  placeholderTextColor="#64748B"
                  value={forgotOtp}
                  onChangeText={(t) => {
                    setForgotOtp(t.replace(/\D/g, '').slice(0, 6));
                    if (forgotError) setForgotError('');
                  }}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>

              <View style={[authStyles.inputWrap, { marginBottom: 12 }]}>
                <BootstrapIcon name="lock" size={16} color="#64748B" />
                <TextInput
                  style={[authStyles.textInput, { fontFamily: fontFamily.sans }]}
                  placeholder="New Strong Password"
                  placeholderTextColor="#64748B"
                  value={forgotNewPassword}
                  onChangeText={(t) => {
                    setForgotNewPassword(t);
                    if (forgotError) setForgotError('');
                  }}
                  secureTextEntry={!showForgotPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowForgotPassword(!showForgotPassword)}
                  style={{ cursor: 'pointer' }}
                >
                  <BootstrapIcon name={showForgotPassword ? 'eye-slash' : 'eye'} size={16} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={[authStyles.inputWrap, { marginBottom: 16 }]}>
                <BootstrapIcon name="lock-fill" size={16} color="#64748B" />
                <TextInput
                  style={[authStyles.textInput, { fontFamily: fontFamily.sans }]}
                  placeholder="Confirm New Password"
                  placeholderTextColor="#64748B"
                  value={forgotConfirmPassword}
                  onChangeText={(t) => {
                    setForgotConfirmPassword(t);
                    if (forgotError) setForgotError('');
                  }}
                  secureTextEntry={!showForgotPassword}
                  autoCapitalize="none"
                  returnKeyType="go"
                  onSubmitEditing={handleConfirmForgotPassword}
                />
              </View>

              <TouchableOpacity
                style={[
                  authStyles.primaryTealBtn,
                  (!forgotPwdAnalysis.isStrong || forgotLoading) && authStyles.primaryTealBtnDisabled,
                ]}
                onPress={handleConfirmForgotPassword}
                disabled={!forgotPwdAnalysis.isStrong || forgotLoading}
                activeOpacity={0.85}
              >
                <Text style={[authStyles.primaryTealBtnText, { fontFamily: fontFamily.sans }]}>
                  {forgotLoading ? 'UPDATING PASSWORD...' : 'VERIFY OTP & RESET PASSWORD'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setForgotStep(1);
                  setForgotError('');
                }}
                style={{ marginTop: 12, alignItems: 'center', cursor: 'pointer' }}
                activeOpacity={0.75}
              >
                <Text
                  style={{ fontSize: 12.5, color: '#EA580C', fontWeight: '600', fontFamily: fontFamily.sans }}
                >
                  ← Back / Resend code to {forgotEmail}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  // ─── RESPONSIVE LAYOUT: MOBILE VIEW (< 768px) ───
  if (isMobile) {
    return (
      <View style={authStyles.mobilePageWrapper}>
        <StatusBar style="dark" />
        <ScrollView
          contentContainerStyle={authStyles.mobileScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Bar with Back to Store */}
          <View style={authStyles.mobileTopBar}>
            <TouchableOpacity
              style={authStyles.mobileBackBtn}
              onPress={() => onNavigateToStore?.()}
              activeOpacity={0.8}
            >
              <BootstrapIcon name="arrow-left" size={13} color="#475569" />
              <Text style={[authStyles.mobileBackBtnText, { fontFamily: fontFamily.sans }]}>
                Back to Store
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Container (Full Width up to 480px) */}
          <View style={authStyles.mobileFormCard}>{isSignUp ? signUpFormContent : signInFormContent}</View>

          {/* Compact Charcoal Welcome / Sign-Up / Sign-In Section */}
          <View style={authStyles.mobileWelcomeSection}>
            <View style={authStyles.mobileOrganicBlob} />
            <Text style={[authStyles.mobileWelcomeTitle, { fontFamily: fontFamily.sans }]}>
              {isSignUp ? 'Welcome Back!' : 'Hello!'}
            </Text>
            <Text style={[authStyles.mobileWelcomeSubtitle, { fontFamily: fontFamily.sans }]}>
              {isSignUp
                ? `To ${brandSettings.storeName || 'MotoTrack'}`
                : `Welcome to ${brandSettings.storeName || 'MotoTrack'}`}
            </Text>
            <Text style={[authStyles.mobileWelcomeText, { fontFamily: fontFamily.sans }]}>
              {isSignUp
                ? 'Already have an account? Sign in with your registered email and password.'
                : 'Enter your personal details, verify your email with OTP, and start your track journey.'}
            </Text>
            <TouchableOpacity style={authStyles.overlayGhostBtn} onPress={toggleMode} activeOpacity={0.85}>
              <Text style={[authStyles.overlayGhostBtnText, { fontFamily: fontFamily.sans }]}>
                {isSignUp ? 'SIGN IN' : 'SIGN UP'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[authStyles.modalFooterCopyright, { fontFamily: fontFamily.sans }]}>
            © 2026 {brandSettings.storeName || 'MotoTrack'}. All Rights Reserved.
          </Text>
        </ScrollView>

        {renderSuccessModal()}
        {renderForgotPasswordModal()}
      </View>
    );
  }

  // ─── FULL-SCREEN SPLIT-SCREEN LAYOUT: DESKTOP & TABLET (>= 768px) ───
  return (
    <View style={authStyles.pageWrapper}>
      <StatusBar style="light" />

      {/* ─── FULL-SCREEN SPLIT CONTAINER ─── */}
      <View style={authStyles.cardContainer}>
        {/* ─── LEFT PANEL (50%): SIGN IN FORM ─── */}
        <View style={[authStyles.formHalf, authStyles.leftFormHalf]}>
          <ScrollView
            style={{ width: '100%' }}
            contentContainerStyle={authStyles.formScrollInner}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {signInFormContent}
            <Text style={[authStyles.modalFooterCopyright, { fontFamily: fontFamily.sans }]}>
              © 2026 {brandSettings.storeName || 'MotoTrack'}. All Rights Reserved.
            </Text>
          </ScrollView>
        </View>

        {/* ─── RIGHT PANEL (50%): SIGN UP FORM WITH STRONG PASSWORD & OTP ─── */}
        <View style={[authStyles.formHalf, authStyles.rightFormHalf]}>
          <ScrollView
            style={{ width: '100%' }}
            contentContainerStyle={authStyles.formScrollInner}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {signUpFormContent}
            <Text style={[authStyles.modalFooterCopyright, { fontFamily: fontFamily.sans }]}>
              © 2026 {brandSettings.storeName || 'MotoTrack'}. All Rights Reserved.
            </Text>
          </ScrollView>
        </View>

        {/* ─── SLIDING CHARCOAL WELCOME OVERLAY PANEL (50%) ─── */}
        <Animated.View
          style={[authStyles.slidingOverlayPanel, { transform: [{ translateX: overlayTranslateX }] }]}
        >
          {/* Back to Store button placed on charcoal panel */}
          <TouchableOpacity
            style={[
              authStyles.overlayStoreBtn,
              isSignUp ? { left: 40, right: undefined } : { right: 40, left: undefined },
            ]}
            onPress={() => onNavigateToStore?.()}
            activeOpacity={0.8}
          >
            <BootstrapIcon name="arrow-left" size={14} color="#FFFFFF" />
            <Text style={[authStyles.overlayStoreBtnText, { fontFamily: fontFamily.sans }]}>
              Back to Store
            </Text>
          </TouchableOpacity>

          <View style={botanicalStyles.organicBlob} />

          <View style={authStyles.overlayContentBox}>
            <Text style={[authStyles.overlayHeadingLine1, { fontFamily: fontFamily.sans }]}>
              {isSignUp ? 'Welcome Back!' : 'Hello!'}
            </Text>
            <Text style={[authStyles.overlayHeadingLine2, { fontFamily: fontFamily.sans }]}>
              {isSignUp
                ? `To ${brandSettings.storeName || 'MotoTrack'}`
                : `Welcome to ${brandSettings.storeName || 'MotoTrack'}`}
            </Text>

            <Text style={[authStyles.overlaySubtext, { fontFamily: fontFamily.sans }]}>
              {isSignUp
                ? 'Already have an account? Sign in with your registered email and password'
                : 'Enter your personal details, verify your email with OTP, and start your track journey'}
            </Text>

            <TouchableOpacity style={authStyles.overlayGhostBtn} onPress={toggleMode} activeOpacity={0.85}>
              <Text style={[authStyles.overlayGhostBtnText, { fontFamily: fontFamily.sans }]}>
                {isSignUp ? 'SIGN IN' : 'SIGN UP'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>

      {/* ─── SUCCESS REGISTRATION POPUP MODAL ─── */}
      {renderSuccessModal()}
      {renderForgotPasswordModal()}
    </View>
  );
}
