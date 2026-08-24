import React, { useState, useRef, useEffect } from 'react';
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
import { signUpPageStyles as styles } from '../styles/signUpPage.styles';
import { useAuth } from '../context/AuthContext';
import BootstrapIcon from '../components/common/BootstrapIcon';

export default function SignUpPage({
  onSignUpSuccess,
  onNavigateToLogin,
  onNavigateToStore,
}) {
  const { validatePasswordStrength, sendSignupOtp, verifySignupOtp } = useAuth();

  // Step 1 = Form & Password, Step 2 = 6-Digit OTP Verification
  const [step, setStep] = useState(1);

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState('');

  // OTP State
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [dispatchedOtp, setDispatchedOtp] = useState('');
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const otpInputRefs = useRef([]);

  // UI state
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Dynamic Password Analysis
  const passwordAnalysis = validatePasswordStrength ? validatePasswordStrength(password) : {
    score: 0,
    strength: 'weak',
    label: 'Weak',
    color: '#DC2626',
    isStrong: false,
    criteria: { minLength: false, hasUppercase: false, hasLowercase: false, hasNumber: false, hasSpecial: false },
    feedback: 'Password must be at least 8 characters with upper, lower, number, and special character.',
  };

  // Resend Countdown
  useEffect(() => {
    let interval = null;
    if (step === 2 && resendTimer > 0) {
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
  }, [step, resendTimer]);

  // ─── STEP 1: SEND OTP ───
  const handleRequestOtp = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    if (!name.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!phone.trim()) {
      setErrorMessage('Please enter your contact phone number.');
      return;
    }
    if (!passwordAnalysis.isStrong) {
      setErrorMessage(passwordAnalysis.feedback || 'Please choose a strong password fulfilling all security requirements.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    const res = await sendSignupOtp({
      email: email.trim(),
      name: name.trim(),
    });
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to send OTP code.');
      return;
    }

    setDispatchedOtp(res.otpCode || '');
    setStep(2);
    setResendTimer(60);
    setCanResend(false);
    setOtpDigits(['', '', '', '', '', '']);
    setSuccessMessage(`Verification code sent to ${email.trim()}`);
  };

  // ─── RESEND OTP ───
  const handleResendOtp = async () => {
    if (!canResend) return;
    setErrorMessage('');
    setSuccessMessage('');

    setIsLoading(true);
    const res = await sendSignupOtp({
      email: email.trim(),
      name: name.trim(),
    });
    setIsLoading(false);

    if (res.success) {
      setDispatchedOtp(res.otpCode || '');
      setResendTimer(60);
      setCanResend(false);
      setSuccessMessage(`New code sent to ${email.trim()}`);
    } else {
      setErrorMessage(res.error || 'Failed to resend OTP.');
    }
  };

  // ─── OTP DIGIT INPUT ───
  const handleOtpChange = (text, index) => {
    const cleanText = text.replace(/[^0-9]/g, '');
    const newDigits = [...otpDigits];

    if (cleanText.length > 1) {
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

  // ─── STEP 2: VERIFY OTP & CREATE ACCOUNT IN SUPABASE ───
  const handleVerifyOtpAndCreate = async () => {
    setErrorMessage('');
    const fullOtp = otpDigits.join('');

    if (fullOtp.length < 6) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    const res = await verifySignupOtp({
      email: email.trim(),
      otp: fullOtp,
      registrationData: {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        address: 'Metro Manila, Philippines',
        password: password,
        isAdmin: false,
      },
    });
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Verification failed. Please check the code.');
      return;
    }

    onSignUpSuccess?.(res.user);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 0, backgroundColor: '#0C6258' }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.innerContainer}>
          {/* ─── TOP TEAL HEADER SECTION ─── */}
          <View style={styles.topHeroSection}>
            <View style={styles.abstractOrganicShape}>
              <View style={styles.abstractOrganicShapeInner} />
            </View>
          </View>

          {/* ─── WHITE CARD CONTAINER SHEET ─── */}
          <View style={styles.whiteCardSheet}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ flexGrow: 1 }}
              keyboardShouldPersistTaps="handled"
            >
              {step === 1 ? (
                // ─── STEP 1: REGISTRATION FORM ───
                <>
                  <TouchableOpacity
                    style={styles.backLinkRow}
                    onPress={onNavigateToLogin}
                    activeOpacity={0.8}
                  >
                    <BootstrapIcon name="arrow-left" size={14} color="#0C6258" />
                    <Text style={styles.backLinkText}>Back to login</Text>
                  </TouchableOpacity>

                  <Text style={styles.cardTitle}>Sign Up</Text>
                  <Text style={styles.cardSubtitle}>
                    Create your rider profile with strong password security
                  </Text>

                  {errorMessage ? (
                    <View style={styles.errorBanner}>
                      <BootstrapIcon name="info-circle" size={14} color="#DC2626" />
                      <Text style={styles.errorBannerText}>{errorMessage}</Text>
                    </View>
                  ) : null}

                  {/* 1. Full Name */}
                  <View style={styles.inputGroup}>
                    <View
                      style={[
                        styles.inputPill,
                        focusedField === 'name' && styles.inputPillFocused,
                      ]}
                    >
                      <BootstrapIcon name="person" size={17} color="#88A9A3" />
                      <TextInput
                        style={styles.textInput}
                        placeholder="Full Name"
                        placeholderTextColor="#9FB9B5"
                        value={name}
                        onChangeText={(t) => {
                          setName(t);
                          if (errorMessage) setErrorMessage('');
                        }}
                        onFocus={() => setFocusedField('name')}
                        onBlur={() => setFocusedField('')}
                      />
                    </View>
                  </View>

                  {/* 2. Email */}
                  <View style={styles.inputGroup}>
                    <View
                      style={[
                        styles.inputPill,
                        focusedField === 'email' && styles.inputPillFocused,
                      ]}
                    >
                      <BootstrapIcon name="envelope" size={17} color="#88A9A3" />
                      <TextInput
                        style={styles.textInput}
                        placeholder="Email Address"
                        placeholderTextColor="#9FB9B5"
                        value={email}
                        onChangeText={(t) => {
                          setEmail(t);
                          if (errorMessage) setErrorMessage('');
                        }}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        onFocus={() => setFocusedField('email')}
                        onBlur={() => setFocusedField('')}
                      />
                    </View>
                  </View>

                  {/* 3. Phone */}
                  <View style={styles.inputGroup}>
                    <View
                      style={[
                        styles.inputPill,
                        focusedField === 'phone' && styles.inputPillFocused,
                      ]}
                    >
                      <BootstrapIcon name="phone" size={17} color="#88A9A3" />
                      <TextInput
                        style={styles.textInput}
                        placeholder="Phone Number (+63 917...)"
                        placeholderTextColor="#9FB9B5"
                        value={phone}
                        onChangeText={(t) => {
                          setPhone(t);
                          if (errorMessage) setErrorMessage('');
                        }}
                        keyboardType="phone-pad"
                        onFocus={() => setFocusedField('phone')}
                        onBlur={() => setFocusedField('')}
                      />
                    </View>
                  </View>

                  {/* 4. Password */}
                  <View style={styles.inputGroup}>
                    <View
                      style={[
                        styles.inputPill,
                        focusedField === 'password' && styles.inputPillFocused,
                      ]}
                    >
                      <BootstrapIcon name="lock" size={17} color="#88A9A3" />
                      <TextInput
                        style={styles.textInput}
                        placeholder="Password"
                        placeholderTextColor="#9FB9B5"
                        value={password}
                        onChangeText={(t) => {
                          setPassword(t);
                          if (errorMessage) setErrorMessage('');
                        }}
                        secureTextEntry={!showPassword}
                        onFocus={() => setFocusedField('password')}
                        onBlur={() => setFocusedField('')}
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <BootstrapIcon
                          name={showPassword ? 'eye-slash' : 'eye'}
                          size={16}
                          color="#88A9A3"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Real-time Password Strength Meter */}
                  {password.length > 0 && (
                    <View style={styles.strengthMeterWrap}>
                      <View style={styles.strengthHeaderRow}>
                        <Text style={styles.strengthLabelText}>Password Security:</Text>
                        <Text style={[styles.strengthBadgeText, { color: passwordAnalysis.color }]}>
                          {passwordAnalysis.label} ({passwordAnalysis.score}%)
                        </Text>
                      </View>

                      <View style={styles.meterTrack}>
                        <View
                          style={[
                            styles.meterFill,
                            {
                              width: `${passwordAnalysis.score}%`,
                              backgroundColor: passwordAnalysis.color,
                            },
                          ]}
                        />
                      </View>

                      <View style={styles.criteriaGrid}>
                        <View style={styles.criteriaItem}>
                          <BootstrapIcon
                            name={passwordAnalysis.criteria.minLength ? 'check-circle-fill' : 'circle'}
                            size={11}
                            color={passwordAnalysis.criteria.minLength ? '#10B981' : '#94A3B8'}
                          />
                          <Text style={[styles.criteriaText, passwordAnalysis.criteria.minLength && styles.criteriaTextActive]}>
                            Minimum 8 characters
                          </Text>
                        </View>
                        <View style={styles.criteriaItem}>
                          <BootstrapIcon
                            name={passwordAnalysis.criteria.hasUppercase ? 'check-circle-fill' : 'circle'}
                            size={11}
                            color={passwordAnalysis.criteria.hasUppercase ? '#10B981' : '#94A3B8'}
                          />
                          <Text style={[styles.criteriaText, passwordAnalysis.criteria.hasUppercase && styles.criteriaTextActive]}>
                            Uppercase letter (A-Z)
                          </Text>
                        </View>
                        <View style={styles.criteriaItem}>
                          <BootstrapIcon
                            name={passwordAnalysis.criteria.hasLowercase ? 'check-circle-fill' : 'circle'}
                            size={11}
                            color={passwordAnalysis.criteria.hasLowercase ? '#10B981' : '#94A3B8'}
                          />
                          <Text style={[styles.criteriaText, passwordAnalysis.criteria.hasLowercase && styles.criteriaTextActive]}>
                            Lowercase letter (a-z)
                          </Text>
                        </View>
                        <View style={styles.criteriaItem}>
                          <BootstrapIcon
                            name={passwordAnalysis.criteria.hasNumber ? 'check-circle-fill' : 'circle'}
                            size={11}
                            color={passwordAnalysis.criteria.hasNumber ? '#10B981' : '#94A3B8'}
                          />
                          <Text style={[styles.criteriaText, passwordAnalysis.criteria.hasNumber && styles.criteriaTextActive]}>
                            Number (0-9)
                          </Text>
                        </View>
                        <View style={styles.criteriaItem}>
                          <BootstrapIcon
                            name={passwordAnalysis.criteria.hasSpecial ? 'check-circle-fill' : 'circle'}
                            size={11}
                            color={passwordAnalysis.criteria.hasSpecial ? '#10B981' : '#94A3B8'}
                          />
                          <Text style={[styles.criteriaText, passwordAnalysis.criteria.hasSpecial && styles.criteriaTextActive]}>
                            Special symbol (!@#$...)
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* 5. Confirm Password */}
                  <View style={styles.inputGroup}>
                    <View
                      style={[
                        styles.inputPill,
                        focusedField === 'confirmPassword' && styles.inputPillFocused,
                      ]}
                    >
                      <BootstrapIcon name="lock-fill" size={17} color="#88A9A3" />
                      <TextInput
                        style={styles.textInput}
                        placeholder="Confirm Password"
                        placeholderTextColor="#9FB9B5"
                        value={confirmPassword}
                        onChangeText={(t) => {
                          setConfirmPassword(t);
                          if (errorMessage) setErrorMessage('');
                        }}
                        secureTextEntry={!showPassword}
                        onFocus={() => setFocusedField('confirmPassword')}
                        onBlur={() => setFocusedField('')}
                      />
                      {confirmPassword.length > 0 && (
                        <BootstrapIcon
                          name={password === confirmPassword ? 'check-circle-fill' : 'x-circle-fill'}
                          size={16}
                          color={password === confirmPassword ? '#10B981' : '#DC2626'}
                        />
                      )}
                    </View>
                  </View>

                  {/* Continue Button */}
                  <TouchableOpacity
                    style={[
                      styles.primaryPillBtn,
                      (!passwordAnalysis.isStrong || isLoading) && styles.primaryPillBtnDisabled,
                    ]}
                    onPress={handleRequestOtp}
                    activeOpacity={0.9}
                    disabled={!passwordAnalysis.isStrong || isLoading}
                  >
                    <Text style={styles.primaryPillBtnText}>
                      {isLoading ? 'Sending Verification Code...' : 'Continue (Send OTP)'}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                // ─── STEP 2: OTP VERIFICATION SCREEN ───
                <>
                  <TouchableOpacity
                    style={styles.backLinkRow}
                    onPress={() => setStep(1)}
                    activeOpacity={0.8}
                  >
                    <BootstrapIcon name="arrow-left" size={14} color="#0C6258" />
                    <Text style={styles.backLinkText}>Edit registration details</Text>
                  </TouchableOpacity>

                  <View style={styles.otpHeroBox}>
                    <View style={styles.otpIconBadge}>
                      <BootstrapIcon name="shield-lock-fill" size={28} color="#0C6258" />
                    </View>
                    <Text style={styles.otpTitle}>Verify Your Email</Text>
                    <Text style={styles.otpSubtitle}>
                      We sent a 6-digit verification code to{' '}
                      <Text style={styles.otpTargetEmail}>{email}</Text>
                    </Text>
                  </View>

                  {/* Instant Test OTP Code Display */}
                  {dispatchedOtp ? (
                    <View style={styles.otpInstantCodeBanner}>
                      <BootstrapIcon name="key-fill" size={14} color="#1D4ED8" />
                      <Text style={styles.otpInstantCodeText}>
                        Security Code:{' '}
                        <Text style={styles.otpInstantCodeBold}>{dispatchedOtp}</Text>
                      </Text>
                    </View>
                  ) : null}

                  {successMessage ? (
                    <View style={styles.successBanner}>
                      <BootstrapIcon name="check-circle" size={14} color="#065F46" />
                      <Text style={styles.successBannerText}>{successMessage}</Text>
                    </View>
                  ) : null}

                  {errorMessage ? (
                    <View style={styles.errorBanner}>
                      <BootstrapIcon name="info-circle" size={14} color="#DC2626" />
                      <Text style={styles.errorBannerText}>{errorMessage}</Text>
                    </View>
                  ) : null}

                  {/* 6 Digit Input Boxes */}
                  <View style={styles.otpInputsRow}>
                    {otpDigits.map((digit, idx) => (
                      <TextInput
                        key={idx}
                        ref={(el) => (otpInputRefs.current[idx] = el)}
                        style={[
                          styles.otpDigitBox,
                          digit ? styles.otpDigitBoxActive : null,
                          styles.otpDigitText,
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

                  {/* Verify & Create Account Button */}
                  <TouchableOpacity
                    style={styles.primaryPillBtn}
                    onPress={handleVerifyOtpAndCreate}
                    activeOpacity={0.9}
                    disabled={isLoading}
                  >
                    <Text style={styles.primaryPillBtnText}>
                      {isLoading ? 'Creating Account in Supabase...' : 'Verify & Create Account'}
                    </Text>
                  </TouchableOpacity>

                  {/* Resend Row */}
                  <View style={styles.resendRow}>
                    <Text style={styles.resendText}>Didn't receive code? </Text>
                    {canResend ? (
                      <TouchableOpacity onPress={handleResendOtp} activeOpacity={0.8}>
                        <Text style={styles.resendBtnText}>Resend Code</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.resendBtnText}>Resend in {resendTimer}s</Text>
                    )}
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
      <SafeAreaView style={{ flex: 0, backgroundColor: '#FFFFFF' }} />
    </View>
  );
}
