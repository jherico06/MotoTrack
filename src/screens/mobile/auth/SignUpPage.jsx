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
import { signUpPageStyles as styles } from '../../../styles/signUpPage.styles.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import BootstrapIcon from '../../../components/common/BootstrapIcon.jsx';

export default function SignUpPage({
  onSignUpSuccess,
  onLoginSuccess,
  onNavigateToLogin,
  onNavigateToStore,
}) {
  const { register } = useAuth();

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Field focus tracking
  const [focusedField, setFocusedField] = useState('');

  // State feedback
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Legal Modals
  const [activeLegalModal, setActiveLegalModal] = useState(null); // 'terms' | 'privacy' | null

  // Input refs for keyboard navigation
  const emailRef = useRef(null);
  const phoneRef = useRef(null);
  const addressRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);

  const handleSignUp = async () => {
    if (isLoading) return;
    setErrorMessage('');

    // Validations
    if (!name.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!phone.trim() || phone.trim().length < 7) {
      setErrorMessage('Please enter a valid contact phone number.');
      return;
    }
    if (!address.trim() || address.trim().length < 5) {
      setErrorMessage('Please enter your complete delivery address.');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await register({
        name: name.trim(),
        email: cleanEmail,
        phone: phone.trim(),
        address: address.trim(),
        password: password,
        isAdmin: false,
      });

      if (res.success && res.user) {
        if (onSignUpSuccess) {
          onSignUpSuccess(res.user);
        } else if (onLoginSuccess) {
          onLoginSuccess(res.user);
        }
      } else {
        setErrorMessage(res.error || 'Failed to create account. Please try again.');
      }
    } catch (err) {
      setErrorMessage('An unexpected error occurred: ' + (err.message || 'Please try again.'));
    } finally {
      setIsLoading(false);
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
            <Text style={styles.headerTitle}>Join the ride.</Text>
            <Text style={styles.headerSubtitle}>Motorparts made simple.</Text>
          </View>

          {/* ─── 2. WHITE BOTTOM SHEET WITH SOFTLY ROUNDED TOP CORNERS ─── */}
          <View style={styles.whiteCardSheet}>
            {/* Compact Back to login link */}
            <TouchableOpacity
              style={styles.sheetBackRow}
              onPress={onNavigateToLogin}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Back to login"
            >
              <BootstrapIcon name="chevron-left" size={13} color="#64748B" />
              <Text style={styles.sheetBackText}>Back to login</Text>
            </TouchableOpacity>

            <Text style={styles.sheetTitle}>Sign up</Text>
            <Text style={styles.sheetSubtitle}>Create your rider profile.</Text>

            {/* Error Banner */}
            {errorMessage ? (
              <View style={styles.errorBanner} accessibilityRole="alert">
                <BootstrapIcon name="info-circle" size={15} color="#DC2626" />
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
                <BootstrapIcon
                  name="person"
                  size={16}
                  color={focusedField === 'name' ? '#EA580C' : '#94A3B8'}
                />
                <TextInput
                  style={styles.textInput}
                  placeholder="Full name"
                  placeholderTextColor="#94A3B8"
                  value={name}
                  onChangeText={(t) => {
                    setName(t);
                    if (errorMessage) setErrorMessage('');
                  }}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField('')}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => emailRef.current?.focus()}
                  accessibilityLabel="Full name"
                />
              </View>
            </View>

            {/* 2. Email Address */}
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
                  ref={emailRef}
                  style={styles.textInput}
                  placeholder="Email address"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    if (errorMessage) setErrorMessage('');
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField('')}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => phoneRef.current?.focus()}
                  accessibilityLabel="Email address"
                />
              </View>
            </View>

            {/* 3. Phone Number */}
            <View style={styles.inputGroup}>
              <View
                style={[
                  styles.inputPill,
                  focusedField === 'phone' && styles.inputPillFocused,
                ]}
              >
                <BootstrapIcon
                  name="telephone"
                  size={16}
                  color={focusedField === 'phone' ? '#EA580C' : '#94A3B8'}
                />
                <TextInput
                  ref={phoneRef}
                  style={styles.textInput}
                  placeholder="Phone number"
                  placeholderTextColor="#94A3B8"
                  value={phone}
                  onChangeText={(t) => {
                    setPhone(t);
                    if (errorMessage) setErrorMessage('');
                  }}
                  keyboardType="phone-pad"
                  onFocus={() => setFocusedField('phone')}
                  onBlur={() => setFocusedField('')}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => addressRef.current?.focus()}
                  accessibilityLabel="Phone number"
                />
              </View>
            </View>

            {/* 4. Delivery Address */}
            <View style={styles.inputGroup}>
              <View
                style={[
                  styles.inputPill,
                  focusedField === 'address' && styles.inputPillFocused,
                ]}
              >
                <BootstrapIcon
                  name="geo-alt"
                  size={16}
                  color={focusedField === 'address' ? '#EA580C' : '#94A3B8'}
                />
                <TextInput
                  ref={addressRef}
                  style={styles.textInput}
                  placeholder="Delivery address"
                  placeholderTextColor="#94A3B8"
                  value={address}
                  onChangeText={(t) => {
                    setAddress(t);
                    if (errorMessage) setErrorMessage('');
                  }}
                  autoCapitalize="words"
                  onFocus={() => setFocusedField('address')}
                  onBlur={() => setFocusedField('')}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  accessibilityLabel="Delivery address"
                />
              </View>
            </View>

            {/* 5. Password */}
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
                  ref={passwordRef}
                  style={styles.textInput}
                  placeholder="Password"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={(t) => {
                    setPassword(t);
                    if (errorMessage) setErrorMessage('');
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField('')}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => confirmPasswordRef.current?.focus()}
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

            {/* 6. Confirm Password */}
            <View style={styles.inputGroup}>
              <View
                style={[
                  styles.inputPill,
                  focusedField === 'confirmPassword' && styles.inputPillFocused,
                ]}
              >
                <BootstrapIcon
                  name="lock"
                  size={16}
                  color={focusedField === 'confirmPassword' ? '#EA580C' : '#94A3B8'}
                />
                <TextInput
                  ref={confirmPasswordRef}
                  style={styles.textInput}
                  placeholder="Confirm password"
                  placeholderTextColor="#94A3B8"
                  value={confirmPassword}
                  onChangeText={(t) => {
                    setConfirmPassword(t);
                    if (errorMessage) setErrorMessage('');
                  }}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setFocusedField('confirmPassword')}
                  onBlur={() => setFocusedField('')}
                  returnKeyType="go"
                  onSubmitEditing={handleSignUp}
                  accessibilityLabel="Confirm password"
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  <BootstrapIcon
                    name={showConfirmPassword ? 'eye-slash' : 'eye'}
                    size={16}
                    color="#94A3B8"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Terms and Privacy policy notice */}
            <Text style={styles.termsText}>
              By continuing, you agree to the{' '}
              <Text
                style={styles.termsLink}
                onPress={() => setActiveLegalModal('terms')}
              >
                Terms
              </Text>{' '}
              and{' '}
              <Text
                style={styles.termsLink}
                onPress={() => setActiveLegalModal('privacy')}
              >
                Privacy Policy
              </Text>
              .
            </Text>

            {/* Single Full-Width Orange Primary Button */}
            <TouchableOpacity
              style={[styles.primaryBtn, isLoading && styles.primaryBtnDisabled]}
              onPress={handleSignUp}
              activeOpacity={0.85}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Sign up"
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>Sign up</Text>
                  <View style={styles.btnArrowBadge}>
                    <BootstrapIcon name="chevron-right" size={12} color="#FFFFFF" />
                  </View>
                </>
              )}
            </TouchableOpacity>

            {/* Footer Switch: Easy Switch between Login and Signup */}
            <View style={styles.switchRow}>
              <Text style={styles.switchText}>Already have an account? </Text>
              <TouchableOpacity
                onPress={onNavigateToLogin}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Log in"
              >
                <Text style={styles.switchLink}>Log in</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <SafeAreaView style={{ flex: 0, backgroundColor: '#FFFFFF' }} />

      {/* ─── TERMS & PRIVACY MODAL ─── */}
      <Modal
        visible={Boolean(activeLegalModal)}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveLegalModal(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setActiveLegalModal(null)}
        >
          <Pressable
            style={styles.modalSheet}
            onPress={(e) => e?.stopPropagation?.()}
          >
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>
                {activeLegalModal === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setActiveLegalModal(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <BootstrapIcon name="x-lg" size={14} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {activeLegalModal === 'terms' ? (
                <Text style={styles.modalBody}>
                  Welcome to MotoTrack. By using our platform, you agree to provide accurate rider
                  and vehicle information for part compatibility, safe maintenance scheduling, and
                  reliable order fulfillment. All genuine parts are backed by our authenticity
                  guarantee and standard return policies.
                </Text>
              ) : (
                <Text style={styles.modalBody}>
                  MotoTrack is committed to protecting your privacy. Your contact and delivery
                  details are used exclusively for order processing, logistics coordination, and
                  security alerts. We do not sell or distribute your personal information to third
                  parties.
                </Text>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => setActiveLegalModal(null)}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Got it</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
