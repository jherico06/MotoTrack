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
import { BootstrapIcon } from '../components';
import { useAuth } from '../context/AuthContext';

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
  onNavigateToSignUp,
  onNavigateToStore,
  redirectReason: propRedirectReason,
  initialMode = 'signin',
}) {
  const {
    login,
    demoCustomerLogin,
    adminLogin,
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
  const [isSignInLoading, setIsSignInLoading] = useState(false);

  // Sign Up Form State
  const [signUpStep, setSignUpStep] = useState(1); // 1 = Details + Password, 2 = 6-Digit OTP Verification
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPhone, setSignUpPhone] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('');
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [signUpError, setSignUpError] = useState('');
  const [signUpSuccessMsg, setSignUpSuccessMsg] = useState('');
  const [isSignUpLoading, setIsSignUpLoading] = useState(false);

  // OTP State
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [dispatchedOtp, setDispatchedOtp] = useState('');
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const otpInputRefs = useRef([]);

  // Password Strength State
  const passwordAnalysis = validatePasswordStrength ? validatePasswordStrength(signUpPassword) : {
    score: 0,
    strength: 'weak',
    label: 'Weak',
    color: '#DC2626',
    isStrong: false,
    criteria: { minLength: false, hasUppercase: false, hasLowercase: false, hasNumber: false, hasSpecial: false },
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
    if (!signInEmail.trim() || !signInPassword) {
      setSignInError('Please enter both email and password.');
      return;
    }

    setIsSignInLoading(true);
    const res = await login(signInEmail.trim(), signInPassword);
    setIsSignInLoading(false);

    if (!res.success) {
      setSignInError(res.error || 'Invalid email or password.');
      return;
    }

    onLoginSuccess?.(res.user);
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
    if (!passwordAnalysis.isStrong) {
      setSignUpError(passwordAnalysis.feedback || 'Please choose a strong password fulfilling all security requirements.');
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

    setDispatchedOtp(res.otpCode || '');
    setSignUpStep(2);
    setResendTimer(60);
    setCanResend(false);
    setOtpDigits(['', '', '', '', '', '']);
    setSignUpSuccessMsg(`Verification code sent to ${signUpEmail.trim()}`);
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
      setDispatchedOtp(res.otpCode || '');
      setResendTimer(60);
      setCanResend(false);
      setSignUpSuccessMsg(`New 6-digit code sent to ${signUpEmail.trim()}`);
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
        address: 'Metro Manila, Philippines',
        password: signUpPassword,
        isAdmin: false,
      },
    });
    setIsSignUpLoading(false);

    if (!res.success) {
      setSignUpError(res.error || 'Verification failed. Please check the code and try again.');
      return;
    }

    onLoginSuccess?.(res.user);
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
          <View style={authStyles.logoBadge}>
            <BootstrapIcon name="speedometer2" size={18} color="#FFFFFF" />
          </View>
          <Text style={authStyles.topBrandText}>
            Moto<Text style={{ color: '#56B9A1' }}>Track</Text>
          </Text>
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
          <ScrollView
            contentContainerStyle={authStyles.formScrollInner}
            showsVerticalScrollIndicator={false}
          >
            <Text style={authStyles.formHeading}>Sign In to MotoTrack</Text>
            <Text style={authStyles.mutedSubtext}>Enter your registered email and password</Text>

            {redirectReason ? (
              <View style={authStyles.infoBadge}>
                <BootstrapIcon name="info-circle" size={13} color="#0C6258" />
                <Text style={authStyles.infoBadgeText}>{redirectReason}</Text>
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
                <BootstrapIcon
                  name={showSignInPassword ? 'eye-slash' : 'eye'}
                  size={15}
                  color="#88A9A3"
                />
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

            {/* Fast Demo Shortcuts */}
            <View style={authStyles.fastLoginSection}>
              <Text style={authStyles.fastLoginTitle}>Quick Demo Access:</Text>
              <View style={authStyles.fastLoginRow}>
                <TouchableOpacity
                  style={authStyles.fastPill}
                  onPress={async () => {
                    const res = await demoCustomerLogin();
                    onLoginSuccess?.(res.user);
                  }}
                >
                  <Text style={authStyles.fastPillText}>⚡ Alex Rider (Customer)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={authStyles.fastPill}
                  onPress={async () => {
                    const res = await adminLogin();
                    onLoginSuccess?.(res.user);
                  }}
                >
                  <Text style={authStyles.fastPillText}>🛡️ Store Admin</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>

        {/* ─── RIGHT HALF: SIGN UP FORM WITH STRONG PASSWORD & OTP ─── */}
        <View style={[authStyles.formHalf, authStyles.rightFormHalf]}>
          <ScrollView
            contentContainerStyle={authStyles.formScrollInner}
            showsVerticalScrollIndicator={false}
          >
            {signUpStep === 1 ? (
              // ─── SIGN UP STEP 1: CREDENTIALS & STRONG PASSWORD ───
              <>
                <Text style={authStyles.formHeading}>Create Account</Text>
                <Text style={authStyles.mutedSubtext}>Join MotoTrack Pro Gear Community</Text>

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
                        <Text style={[authStyles.criteriaChipText, passwordAnalysis.criteria.minLength && authStyles.criteriaChipTextActive]}>
                          8+ Chars
                        </Text>
                      </View>
                      <View style={authStyles.criteriaChip}>
                        <BootstrapIcon
                          name={passwordAnalysis.criteria.hasUppercase ? 'check-circle-fill' : 'circle'}
                          size={10}
                          color={passwordAnalysis.criteria.hasUppercase ? '#10B981' : '#94A3B8'}
                        />
                        <Text style={[authStyles.criteriaChipText, passwordAnalysis.criteria.hasUppercase && authStyles.criteriaChipTextActive]}>
                          A-Z
                        </Text>
                      </View>
                      <View style={authStyles.criteriaChip}>
                        <BootstrapIcon
                          name={passwordAnalysis.criteria.hasLowercase ? 'check-circle-fill' : 'circle'}
                          size={10}
                          color={passwordAnalysis.criteria.hasLowercase ? '#10B981' : '#94A3B8'}
                        />
                        <Text style={[authStyles.criteriaChipText, passwordAnalysis.criteria.hasLowercase && authStyles.criteriaChipTextActive]}>
                          a-z
                        </Text>
                      </View>
                      <View style={authStyles.criteriaChip}>
                        <BootstrapIcon
                          name={passwordAnalysis.criteria.hasNumber ? 'check-circle-fill' : 'circle'}
                          size={10}
                          color={passwordAnalysis.criteria.hasNumber ? '#10B981' : '#94A3B8'}
                        />
                        <Text style={[authStyles.criteriaChipText, passwordAnalysis.criteria.hasNumber && authStyles.criteriaChipTextActive]}>
                          0-9
                        </Text>
                      </View>
                      <View style={authStyles.criteriaChip}>
                        <BootstrapIcon
                          name={passwordAnalysis.criteria.hasSpecial ? 'check-circle-fill' : 'circle'}
                          size={10}
                          color={passwordAnalysis.criteria.hasSpecial ? '#10B981' : '#94A3B8'}
                        />
                        <Text style={[authStyles.criteriaChipText, passwordAnalysis.criteria.hasSpecial && authStyles.criteriaChipTextActive]}>
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
                    We sent a 6-digit code to{' '}
                    <Text style={authStyles.otpEmailHighlight}>{signUpEmail}</Text>
                  </Text>
                </View>

                {/* Instant In-App Test Code Banner */}
                {dispatchedOtp ? (
                  <View style={authStyles.instantOtpBadge}>
                    <BootstrapIcon name="key-fill" size={13} color="#1D4ED8" />
                    <Text style={authStyles.instantOtpText}>
                      Security OTP:{' '}
                      <Text style={authStyles.instantOtpCode}>{dispatchedOtp}</Text>
                    </Text>
                  </View>
                ) : null}

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
                      style={[
                        authStyles.otpBox,
                        digit ? authStyles.otpBoxFilled : null,
                      ]}
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
          style={[
            authStyles.slidingOverlayPanel,
            { transform: [{ translateX: overlayTranslateX }] },
          ]}
        >
          <View style={botanicalStyles.organicBlob} />
          <BotanicalPotGraphic />

          <View style={authStyles.overlayContentBox}>
            <Text style={authStyles.overlayHeadingLine1}>
              {isSignUp ? 'Welcome Back!' : 'Hello Rider!'}
            </Text>
            <Text style={authStyles.overlayHeadingLine2}>
              {isSignUp ? 'To MotoTrack' : 'Welcome to MotoTrack'}
            </Text>

            <Text style={authStyles.overlaySubtext}>
              {isSignUp
                ? 'Already have an account? Sign in with your registered email and password'
                : 'Enter your personal details, verify your email with OTP, and start your track journey'}
            </Text>

            <TouchableOpacity
              style={authStyles.overlayGhostBtn}
              onPress={toggleMode}
              activeOpacity={0.85}
            >
              <Text style={authStyles.overlayGhostBtnText}>
                {isSignUp ? 'SIGN IN' : 'SIGN UP'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

      </View>
    </View>
  );
}

const botanicalStyles = StyleSheet.create({
  organicBlob: {
    position: 'absolute',
    top: -30,
    left: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#56B9A1',
    opacity: 0.7,
  },
  decorWrap: {
    position: 'absolute',
    right: 20,
    top: 20,
    alignItems: 'center',
    opacity: 0.9,
  },
  leafGroup: {
    alignItems: 'center',
    marginBottom: -4,
  },
  leftLeaf: {
    position: 'absolute',
    bottom: 16,
    left: -10,
    width: 10,
    height: 38,
    backgroundColor: '#56B9A1',
    borderRadius: 8,
    transform: [{ rotate: '-18deg' }],
  },
  centerLeaf: {
    width: 12,
    height: 52,
    backgroundColor: '#74C9B4',
    borderRadius: 8,
    zIndex: 2,
  },
  rightLeaf: {
    position: 'absolute',
    bottom: 14,
    right: -10,
    width: 10,
    height: 34,
    backgroundColor: '#48A48D',
    borderRadius: 8,
    transform: [{ rotate: '20deg' }],
  },
  potBody: {
    width: 32,
    height: 28,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
});

const authStyles = StyleSheet.create({
  pageWrapper: {
    flex: 1,
    backgroundColor: '#042F2E',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    minHeight: '100vh',
  },
  topNav: {
    width: '100%',
    maxWidth: 820,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  topBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#0C6258',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBrandText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  backStoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  backStoreBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#88A9A3',
  },
  cardContainer: {
    width: 820,
    minHeight: 520,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    position: 'relative',
    overflow: 'hidden',
    boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5)',
  },
  formHalf: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 410,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
  },
  leftFormHalf: {
    left: 0,
  },
  rightFormHalf: {
    right: 0,
  },
  formScrollInner: {
    paddingHorizontal: 32,
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formHeading: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0C6258',
    marginBottom: 4,
    textAlign: 'center',
  },
  mutedSubtext: {
    fontSize: 11.5,
    color: '#88A9A3',
    marginBottom: 14,
    textAlign: 'center',
  },
  inputWrap: {
    width: '100%',
    backgroundColor: '#F3F7F6',
    borderRadius: 20,
    height: 42,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
    outlineStyle: 'none',
  },
  forgotPasswordBtn: {
    alignSelf: 'flex-end',
    marginBottom: 10,
    marginTop: -4,
  },
  forgotPasswordText: {
    fontSize: 11.5,
    color: '#88A9A3',
    fontWeight: '600',
  },
  primaryTealBtn: {
    backgroundColor: '#0C6258',
    borderRadius: 22,
    paddingVertical: 11,
    paddingHorizontal: 36,
    marginTop: 6,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 14px rgba(12, 98, 88, 0.35)',
  },
  primaryTealBtnDisabled: {
    backgroundColor: '#94A3B8',
    boxShadow: 'none',
  },
  primaryTealBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  // Password Strength Meter
  strengthMeterBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  strengthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  strengthLabel: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
  },
  strengthBadge: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  meterTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 6,
  },
  meterFill: {
    height: '100%',
    borderRadius: 2,
  },
  criteriaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  criteriaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  criteriaChipText: {
    fontSize: 9.5,
    color: '#94A3B8',
    fontWeight: '500',
  },
  criteriaChipTextActive: {
    color: '#059669',
    fontWeight: '700',
  },

  // OTP Container & Inputs
  otpContainer: {
    width: '100%',
    alignItems: 'center',
  },
  otpBackBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  otpBackBtnText: {
    fontSize: 11.5,
    color: '#0C6258',
    fontWeight: '700',
  },
  otpHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  otpBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E6F4F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  otpSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 280,
  },
  otpEmailHighlight: {
    fontWeight: '800',
    color: '#0C6258',
  },
  instantOtpBadge: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    width: '100%',
  },
  instantOtpText: {
    fontSize: 11,
    color: '#1D4ED8',
    fontWeight: '600',
    flex: 1,
  },
  instantOtpCode: {
    fontWeight: '900',
    letterSpacing: 2,
    color: '#1E40AF',
  },
  otpBoxesRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 14,
  },
  otpBox: {
    width: 42,
    height: 48,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '900',
    color: '#0C6258',
    outlineStyle: 'none',
  },
  otpBoxFilled: {
    borderColor: '#0C6258',
    backgroundColor: '#FFFFFF',
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  resendText: {
    fontSize: 11.5,
    color: '#64748B',
  },
  resendLink: {
    fontSize: 11.5,
    color: '#0C6258',
    fontWeight: '800',
  },
  resendCountdown: {
    fontSize: 11.5,
    color: '#94A3B8',
    fontWeight: '700',
  },

  // Fast Login Section
  fastLoginSection: {
    marginTop: 14,
    width: '100%',
    alignItems: 'center',
  },
  fastLoginTitle: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '700',
    marginBottom: 6,
  },
  fastLoginRow: {
    flexDirection: 'row',
    gap: 8,
  },
  fastPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#F3F7F6',
    borderWidth: 1,
    borderColor: '#E2ECE9',
  },
  fastPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0C6258',
  },

  // Badges
  errorBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 10,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  errorBadgeText: {
    color: '#DC2626',
    fontSize: 11.5,
    fontWeight: '700',
    flex: 1,
  },
  infoBadge: {
    backgroundColor: '#E6F4F1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 10,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoBadgeText: {
    color: '#0C6258',
    fontSize: 11.5,
    fontWeight: '700',
    flex: 1,
  },
  successBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 10,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  successBadgeText: {
    color: '#065F46',
    fontSize: 11.5,
    fontWeight: '700',
    flex: 1,
  },

  // Sliding Overlay Panel
  slidingOverlayPanel: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 410,
    height: '100%',
    backgroundColor: '#0C6258',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 36,
    zIndex: 10,
    overflow: 'hidden',
  },
  overlayContentBox: {
    alignItems: 'center',
    textAlign: 'center',
    width: '100%',
    zIndex: 5,
  },
  overlayHeadingLine1: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 30,
  },
  overlayHeadingLine2: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: 10,
  },
  overlaySubtext: {
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
    maxWidth: 260,
  },
  overlayGhostBtn: {
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 32,
    paddingVertical: 9,
  },
  overlayGhostBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});
