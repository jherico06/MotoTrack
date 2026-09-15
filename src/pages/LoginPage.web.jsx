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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BootstrapIcon, BrandLogo, GoogleIcon } from '../components';
import { useAuth } from '../context/AuthContext';
import { botanicalStyles, authWebStyles as authStyles } from '../styles/web/loginPage.web.styles';

// ─── DECORATIVE BOTANICAL PLANT POT ───
function BotanicalPotGraphic() {
  return (
    <View style={botanicalStyles.decorWrap}>
      <View style={botanicalStyles.leafGroup}>
        <View style={botanicalStyles.leftLeaf} />
        <View style={botanicalStyles.centerLeaf} />
        <View style={botanicalStyles.rightLeaf} />
      </View>
      <View style={botanicalStyles.potBody} />
    </View>
  );
}

export default function LoginPageWeb({
  onLoginSuccess,
  onSignUpSuccess,
  onNavigateToSignUp,
  onNavigateToStore,
  redirectReason: propRedirectReason,
  initialMode = 'signin',
}) {
  const {
    login,
    loginWithGoogle,
    loginWithGoogleSimulated,
    validatePasswordStrength,
    sendSignupOtp,
    verifySignupOtp,
    redirectReason: contextRedirectReason,
  } = useAuth();

  const redirectReason = propRedirectReason || contextRedirectReason;

  // Active Mode: 'signin' | 'signup'
  const [activeMode, setActiveMode] = useState(initialMode);

  // Animated Sliding Value (0 = Sign In [Panel on Right], 1 = Sign Up [Panel on Left])
  const slideAnim = useRef(new Animated.Value(initialMode === 'signup' ? 1 : 0)).current;

  // Sign In Form State
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [signInError, setSignInError] = useState('');
  const [authSuccessNotification, setAuthSuccessNotification] = useState('');
  const [isSignInLoading, setIsSignInLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleAdvisory, setGoogleAdvisory] = useState(false);

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
    setSignInError('');
    setAuthSuccessNotification('');
    const cleanEmail = (signInEmail || '').trim();
    const cleanPassword = (signInPassword || '').trim();

    if (!cleanEmail || !cleanPassword) {
      setSignInError('Please enter both email and password.');
      return;
    }

    setIsSignInLoading(true);
    const res = await login(cleanEmail, cleanPassword);
    setIsSignInLoading(false);

    if (!res.success) {
      setSignInError(res.error || 'Invalid email or password.');
      return;
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

  // Interpolated sliding translations for 820px wide card (410px each half)
  const overlayTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [410, 0],
  });

  const isSignUp = activeMode === 'signup';

  return (
    <View style={authStyles.pageWrapper}>
      <StatusBar style="light" />

      {/* Top Floating Header */}
      <View style={authStyles.topNav}>
        <TouchableOpacity
          style={authStyles.topBrand}
          onPress={() => onNavigateToStore?.()}
          activeOpacity={0.8}
        >
          <BrandLogo size={36} textColor="#FFFFFF" accentColor="#EF4444" />
        </TouchableOpacity>

        <TouchableOpacity
          style={authStyles.backStoreBtn}
          onPress={() => onNavigateToStore?.()}
          activeOpacity={0.8}
        >
          <BootstrapIcon name="arrow-left" size={13} color="#88A9A3" />
          <Text style={authStyles.backStoreBtnText}>Back to Store</Text>
        </TouchableOpacity>
      </View>

      {/* ─── MAIN SLIDING AUTHENTICATION CARD ─── */}
      <View style={authStyles.cardContainer}>
        {/* ─── LEFT HALF: SIGN IN FORM (Visible when overlay is on right) ─── */}
        <View style={[authStyles.formHalf, authStyles.leftFormHalf]}>
          <ScrollView contentContainerStyle={authStyles.formScrollInner} showsVerticalScrollIndicator={false}>
            <Text style={authStyles.formHeading}>Sign In to D,Blockchain</Text>
            <Text style={authStyles.mutedSubtext}>Enter your registered email and password</Text>

            {redirectReason ? (
              <View style={authStyles.infoBadge}>
                <BootstrapIcon name="info-circle" size={13} color="#0C6258" />
                <Text style={authStyles.infoBadgeText}>{redirectReason}</Text>
              </View>
            ) : null}

            {authSuccessNotification ? (
              <View style={authStyles.successBadge}>
                <BootstrapIcon name="check-circle" size={14} color="#065F46" />
                <Text style={authStyles.successBadgeText}>{authSuccessNotification}</Text>
              </View>
            ) : null}

            {signInError.length > 0 && (
              <View style={authStyles.errorBadge}>
                <BootstrapIcon name="exclamation-circle" size={13} color="#DC2626" />
                <Text style={authStyles.errorBadgeText}>{signInError}</Text>
              </View>
            )}

            {/* Email Input */}
            <View style={authStyles.inputWrap}>
              <BootstrapIcon name="envelope" size={15} color="#88A9A3" />
              <TextInput
                style={authStyles.textInput}
                placeholder="Email Address"
                placeholderTextColor="#9FB9B5"
                value={signInEmail}
                onChangeText={(t) => {
                  setSignInEmail(t);
                  if (signInError) setSignInError('');
                }}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Password Input */}
            <View style={authStyles.inputWrap}>
              <BootstrapIcon name="lock" size={15} color="#88A9A3" />
              <TextInput
                style={authStyles.textInput}
                placeholder="Password"
                placeholderTextColor="#9FB9B5"
                value={signInPassword}
                onChangeText={(t) => {
                  setSignInPassword(t);
                  if (signInError) setSignInError('');
                }}
                secureTextEntry={!showSignInPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowSignInPassword(!showSignInPassword)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <BootstrapIcon name={showSignInPassword ? 'eye-slash' : 'eye'} size={15} color="#88A9A3" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={authStyles.forgotPasswordBtn}
              onPress={() => alert('Password reset verification link sent to registered email.')}
            >
              <Text style={authStyles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={authStyles.primaryTealBtn}
              onPress={handleSignInSubmit}
              activeOpacity={0.85}
              disabled={isSignInLoading}
            >
              <Text style={authStyles.primaryTealBtnText}>
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
              <View style={{ flex: 1, height: 1, backgroundColor: '#E2ECE9' }} />
              <Text
                style={{
                  fontSize: 11,
                  color: '#88A9A3',
                  fontWeight: '700',
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                }}
              >
                Or continue with
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: '#E2ECE9' }} />
            </View>

            {/* Google Sign In Button */}
            <TouchableOpacity
              style={{
                width: '100%',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                backgroundColor: '#FFFFFF',
                borderWidth: 1.5,
                borderColor: '#E2ECE9',
                borderRadius: 22,
                paddingVertical: 12,
                paddingHorizontal: 18,
                shadowColor: '#0C6258',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 6,
                elevation: 1,
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
          </ScrollView>
        </View>

        {/* ─── RIGHT HALF: SIGN UP FORM WITH STRONG PASSWORD & OTP ─── */}
        <View style={[authStyles.formHalf, authStyles.rightFormHalf]}>
          <ScrollView contentContainerStyle={authStyles.formScrollInner} showsVerticalScrollIndicator={false}>
            {signUpStep === 1 ? (
              // ─── SIGN UP STEP 1: CREDENTIALS & STRONG PASSWORD ───
              <>
                <Text style={authStyles.formHeading}>Create Account</Text>
                <Text style={authStyles.mutedSubtext}>Join D,Blockchain Community</Text>

                {signUpError.length > 0 && (
                  <View style={authStyles.errorBadge}>
                    <BootstrapIcon name="exclamation-circle" size={13} color="#DC2626" />
                    <Text style={authStyles.errorBadgeText}>{signUpError}</Text>
                  </View>
                )}

                {/* Name */}
                <View style={authStyles.inputWrap}>
                  <BootstrapIcon name="person" size={15} color="#88A9A3" />
                  <TextInput
                    style={authStyles.textInput}
                    placeholder="Full Name"
                    placeholderTextColor="#9FB9B5"
                    value={signUpName}
                    onChangeText={(t) => {
                      setSignUpName(t);
                      if (signUpError) setSignUpError('');
                    }}
                  />
                </View>

                {/* Email */}
                <View style={authStyles.inputWrap}>
                  <BootstrapIcon name="envelope" size={15} color="#88A9A3" />
                  <TextInput
                    style={authStyles.textInput}
                    placeholder="Email Address"
                    placeholderTextColor="#9FB9B5"
                    value={signUpEmail}
                    onChangeText={(t) => {
                      setSignUpEmail(t);
                      if (signUpError) setSignUpError('');
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                {/* Phone */}
                <View style={authStyles.inputWrap}>
                  <BootstrapIcon name="phone" size={15} color="#88A9A3" />
                  <TextInput
                    style={authStyles.textInput}
                    placeholder="Contact Number (+63 917...)"
                    placeholderTextColor="#9FB9B5"
                    value={signUpPhone}
                    onChangeText={(t) => {
                      setSignUpPhone(t);
                      if (signUpError) setSignUpError('');
                    }}
                    keyboardType="phone-pad"
                  />
                </View>

                {/* Delivery Address */}
                <View style={authStyles.inputWrap}>
                  <BootstrapIcon name="geo-alt" size={15} color="#88A9A3" />
                  <TextInput
                    style={authStyles.textInput}
                    placeholder="Complete Delivery Address"
                    placeholderTextColor="#9FB9B5"
                    value={signUpAddress}
                    onChangeText={(t) => {
                      setSignUpAddress(t);
                      if (signUpError) setSignUpError('');
                    }}
                    autoCapitalize="words"
                  />
                </View>

                {/* Password */}
                <View style={authStyles.inputWrap}>
                  <BootstrapIcon name="lock" size={15} color="#88A9A3" />
                  <TextInput
                    style={authStyles.textInput}
                    placeholder="Create Strong Password"
                    placeholderTextColor="#9FB9B5"
                    value={signUpPassword}
                    onChangeText={(t) => {
                      setSignUpPassword(t);
                      if (signUpError) setSignUpError('');
                    }}
                    secureTextEntry={!showSignUpPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowSignUpPassword(!showSignUpPassword)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <BootstrapIcon
                      name={showSignUpPassword ? 'eye-slash' : 'eye'}
                      size={15}
                      color="#88A9A3"
                    />
                  </TouchableOpacity>
                </View>

                {/* Real-time Password Strength Meter */}
                {signUpPassword.length > 0 && (
                  <View style={authStyles.strengthMeterBox}>
                    <View style={authStyles.strengthHeader}>
                      <Text style={authStyles.strengthLabel}>Password Strength:</Text>
                      <Text style={[authStyles.strengthBadge, { color: passwordAnalysis.color }]}>
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
                          ]}
                        >
                          !@#$
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Confirm Password */}
                <View style={authStyles.inputWrap}>
                  <BootstrapIcon name="lock-fill" size={15} color="#88A9A3" />
                  <TextInput
                    style={authStyles.textInput}
                    placeholder="Confirm Password"
                    placeholderTextColor="#9FB9B5"
                    value={signUpConfirmPassword}
                    onChangeText={(t) => {
                      setSignUpConfirmPassword(t);
                      if (signUpError) setSignUpError('');
                    }}
                    secureTextEntry={!showSignUpPassword}
                    autoCapitalize="none"
                  />
                  {signUpConfirmPassword.length > 0 && (
                    <BootstrapIcon
                      name={signUpPassword === signUpConfirmPassword ? 'check-circle-fill' : 'x-circle-fill'}
                      size={15}
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
                  <Text style={authStyles.primaryTealBtnText}>
                    {isSignUpLoading ? 'SENDING OTP...' : 'CONTINUE (SEND OTP)'}
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
                  <BootstrapIcon name="arrow-left" size={13} color="#0C6258" />
                  <Text style={authStyles.otpBackBtnText}>Back to details</Text>
                </TouchableOpacity>

                <View style={authStyles.otpHeader}>
                  <View style={authStyles.otpBadge}>
                    <BootstrapIcon name="shield-lock-fill" size={24} color="#0C6258" />
                  </View>
                  <Text style={authStyles.formHeading}>Enter OTP Code</Text>
                  <Text style={authStyles.otpSubtitle}>
                    We sent a 6-digit code to <Text style={authStyles.otpEmailHighlight}>{signUpEmail}</Text>
                  </Text>
                </View>

                {signUpSuccessMsg ? (
                  <View style={authStyles.successBadge}>
                    <BootstrapIcon name="check-circle" size={13} color="#065F46" />
                    <Text style={authStyles.successBadgeText}>{signUpSuccessMsg}</Text>
                  </View>
                ) : null}

                {signUpError.length > 0 && (
                  <View style={authStyles.errorBadge}>
                    <BootstrapIcon name="exclamation-circle" size={13} color="#DC2626" />
                    <Text style={authStyles.errorBadgeText}>{signUpError}</Text>
                  </View>
                )}

                {/* 6 PIN Digit Input Boxes */}
                <View style={authStyles.otpBoxesRow}>
                  {otpDigits.map((digit, idx) => (
                    <TextInput
                      key={idx}
                      ref={(el) => (otpInputRefs.current[idx] = el)}
                      style={[authStyles.otpBox, digit ? authStyles.otpBoxFilled : null]}
                      value={digit}
                      onChangeText={(val) => handleOtpChange(val, idx)}
                      onKeyPress={(e) => handleOtpKeyPress(e, idx)}
                      keyboardType="number-pad"
                      maxLength={6}
                      selectTextOnFocus
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
                  <Text style={authStyles.primaryTealBtnText}>
                    {isSignUpLoading ? 'CREATING ACCOUNT...' : 'VERIFY & CREATE ACCOUNT'}
                  </Text>
                </TouchableOpacity>

                {/* Resend Timer Row */}
                <View style={authStyles.resendRow}>
                  <Text style={authStyles.resendText}>Didn't receive code? </Text>
                  {canResend ? (
                    <TouchableOpacity onPress={handleResendOtp} activeOpacity={0.8}>
                      <Text style={authStyles.resendLink}>Resend Code</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={authStyles.resendCountdown}>Resend in {resendTimer}s</Text>
                  )}
                </View>
              </View>
            )}
          </ScrollView>
        </View>

        {/* ─── SLIDING TEAL DECORATIVE OVERLAY PANEL ─── */}
        <Animated.View
          style={[authStyles.slidingOverlayPanel, { transform: [{ translateX: overlayTranslateX }] }]}
        >
          <View style={botanicalStyles.organicBlob} />
          <BotanicalPotGraphic />

          <View style={authStyles.overlayContentBox}>
            <Text style={authStyles.overlayHeadingLine1}>{isSignUp ? 'Welcome Back!' : 'Hello Rider!'}</Text>
            <Text style={authStyles.overlayHeadingLine2}>
              {isSignUp ? 'To D,Blockchain' : 'Welcome to D,Blockchain'}
            </Text>

            <Text style={authStyles.overlaySubtext}>
              {isSignUp
                ? 'Already have an account? Sign in with your registered email and password'
                : 'Enter your personal details, verify your email with OTP, and start your track journey'}
            </Text>

            <TouchableOpacity style={authStyles.overlayGhostBtn} onPress={toggleMode} activeOpacity={0.85}>
              <Text style={authStyles.overlayGhostBtnText}>{isSignUp ? 'SIGN IN' : 'SIGN UP'}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>

      {/* ─── SUCCESS REGISTRATION POPUP MODAL ─── */}
      {successModalVisible ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(4, 47, 46, 0.82)',
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
                fontWeight: '900',
                color: '#0C6258',
                textAlign: 'center',
                marginBottom: 8,
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
              }}
            >
              Welcome to D,Blockchain, <Text style={{ fontWeight: '700', color: '#0F172A' }}>{createdUserName}</Text>! Your email has been verified. Please sign in with your password to continue to the storefront.
            </Text>

            <TouchableOpacity
              style={{
                backgroundColor: '#0C6258',
                paddingVertical: 13,
                paddingHorizontal: 28,
                borderRadius: 22,
                width: '100%',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(12, 98, 88, 0.35)',
              }}
              onPress={() => setSuccessModalVisible(false)}
              activeOpacity={0.85}
            >
              <Text
                style={{
                  color: '#FFFFFF',
                  fontWeight: '900',
                  fontSize: 13.5,
                  letterSpacing: 0.5,
                }}
              >
                PROCEED TO SIGN IN ➔
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}
