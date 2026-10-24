import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { authService } from '../../services/auth/authService.js';
import { pickImageFromFile } from '../../utils/imagePickerHelper.js';

/**
 * AdminProfileLogsPanel
 *
 * Administrator profile & security credentials management.
 * Activity & audit logs are managed in the dedicated Activity Logs module.
 */
export default function AdminProfileLogsPanel({
  isDarkMode = false,
  tokens = {},
  showToast = () => {},
  showConfirm = () => {},
  isDesktop = true,
  onNavigate = () => {},
}) {
  const { currentUser, updateProfile, changeEmail, changePassword } = useAuth();

  // Active sub-tab: 'profile' | 'security'
  const [activeTab, setActiveTab] = useState('profile');

  // ── Profile Form State ──
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');

  // ── Security: Email State ──
  const [newEmail, setNewEmail] = useState('');
  const [emailCurrentPassword, setEmailCurrentPassword] = useState('');
  const [showEmailCurrentPwd, setShowEmailCurrentPwd] = useState(false);
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [emailErrorMsg, setEmailErrorMsg] = useState('');
  const [emailSuccessMsg, setEmailSuccessMsg] = useState('');

  // ── Security: Password State ──
  const [pwdCurrentPassword, setPwdCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwdCurrent, setShowPwdCurrent] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [pwdErrorMsg, setPwdErrorMsg] = useState('');
  const [pwdSuccessMsg, setPwdSuccessMsg] = useState('');

  // Password validation analysis
  const pwdStrength = useMemo(() => {
    return authService.validatePasswordStrength(newPassword);
  }, [newPassword]);

  // Sync state with currentUser
  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || currentUser.fullName || '');
      setPhone(currentUser.phone || '');
    }
  }, [currentUser]);

  // ── Actions ──

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      showToast('Please enter your full name');
      return;
    }
    setIsSavingProfile(true);
    setProfileSuccessMsg('');
    try {
      const res = await updateProfile({
        name: name.trim(),
        phone: phone.trim(),
      });
      if (res?.success !== false) {
        setProfileSuccessMsg('Profile details saved successfully.');
        showToast('✓ Profile updated successfully');
        setTimeout(() => setProfileSuccessMsg(''), 4000);
      } else {
        showToast(res.error || 'Failed to update profile');
      }
    } catch (_e) {
      showToast('Error updating profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePickAvatar = async () => {
    setIsUploadingAvatar(true);
    try {
      const res = await pickImageFromFile({ aspect: [1, 1], quality: 0.85 });
      if (res?.success && res.uri) {
        await updateProfile({ avatar: res.uri });
        showToast('✓ Profile photo updated successfully');
      } else if (res?.error && res.error !== 'Selection cancelled') {
        showToast(res.error);
      }
    } catch (_e) {
      showToast('Failed to select image');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setIsUploadingAvatar(true);
    try {
      await updateProfile({ avatar: null });
      showToast('Avatar removed');
    } catch (_e) {
      showToast('Failed to remove avatar');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleChangeEmail = async () => {
    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setEmailErrorMsg('Please enter a valid new email address.');
      return;
    }
    if (cleanEmail === (currentUser.email || '').toLowerCase()) {
      setEmailErrorMsg('New email cannot be identical to your current email.');
      return;
    }
    if (!emailCurrentPassword) {
      setEmailErrorMsg('Please enter your current password to authorize email change.');
      return;
    }

    setIsChangingEmail(true);
    setEmailErrorMsg('');
    setEmailSuccessMsg('');
    try {
      const res = await changeEmail({
        newEmail: cleanEmail,
        currentPassword: emailCurrentPassword,
      });
      if (res.success) {
        setEmailSuccessMsg(`Email successfully updated to ${cleanEmail}.`);
        showToast('✓ Email address changed successfully');
        setNewEmail('');
        setEmailCurrentPassword('');
      } else {
        setEmailErrorMsg(res.error || 'Failed to update email address.');
      }
    } catch (_e) {
      setEmailErrorMsg('Error changing email. Please check your password.');
    } finally {
      setIsChangingEmail(false);
    }
  };

  const handleChangePassword = async () => {
    if (!pwdCurrentPassword) {
      setPwdErrorMsg('Please enter your current password.');
      return;
    }
    if (!newPassword) {
      setPwdErrorMsg('Please enter a new password.');
      return;
    }
    if (newPassword.length < 8) {
      setPwdErrorMsg('New password must be at least 8 characters.');
      return;
    }
    if (newPassword === pwdCurrentPassword) {
      setPwdErrorMsg('New password cannot be identical to your current password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdErrorMsg('New passwords do not match. Please verify.');
      return;
    }

    setIsChangingPassword(true);
    setPwdErrorMsg('');
    setPwdSuccessMsg('');
    try {
      const res = await changePassword({
        currentPassword: pwdCurrentPassword,
        newPassword: newPassword,
      });
      if (res.success) {
        setPwdSuccessMsg('Password updated successfully.');
        showToast('✓ Password updated successfully');
        setPwdCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPwdErrorMsg(res.error || 'Current password appears incorrect.');
      }
    } catch (_e) {
      setPwdErrorMsg('Error updating password. Verification failed.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Color tokens
  const cardBg = isDarkMode ? tokens.bgElevated || '#131A17' : '#FFFFFF';
  const cardBorder = isDarkMode ? tokens.borderInput || '#23322B' : '#E2E8F0';
  const textPrimary = isDarkMode ? tokens.textPrimary || '#F8FAFC' : '#0F172A';
  const textMuted = isDarkMode ? tokens.textMuted || '#94A3B8' : '#64748B';
  const inputBg = isDarkMode ? '#17221E' : '#FFFFFF';
  const inputBorder = isDarkMode ? '#2D4037' : '#E2E8F0';
  const brandGreen = isDarkMode ? tokens.accentBrand || '#34D399' : '#EA580C';

  return (
    <View style={styles.container}>
      {/* ─── 1. PROFILE SUMMARY HERO CARD ─── */}
      <View style={[styles.heroCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <View style={styles.heroLayout}>
          {/* Left Avatar & Identity */}
          <View style={styles.heroLeft}>
            <View style={styles.avatarWrap}>
              <View style={[styles.avatarBox, { backgroundColor: isDarkMode ? '#1E2D27' : '#F1F5F9' }]}>
                {currentUser?.avatar &&
                !currentUser.avatar.includes('photo-1535713875002') &&
                !currentUser.avatar.includes('photo-1534528741775') &&
                !currentUser.avatar.includes('ui-avatars.com') ? (
                  <Image source={{ uri: currentUser.avatar || currentUser.photoUri }} style={styles.avatarImg} />
                ) : (
                  <BootstrapIcon name="person-circle" size={46} color={brandGreen} />
                )}
              </View>
              <View style={styles.avatarOnlineDot} />
            </View>

            <View style={{ flex: 1, minWidth: 200 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text style={[styles.heroName, { color: textPrimary }]}>
                  {currentUser?.name || currentUser?.fullName || 'Store Administrator'}
                </Text>
                <View style={styles.roleBadge}>
                  <BootstrapIcon name="shield-lock-fill" size={11} color="#065F46" />
                  <Text style={styles.roleBadgeText}>Store Administrator</Text>
                </View>
                <View style={[styles.sessionBadge, { backgroundColor: isDarkMode ? 'rgba(234, 88, 12, 0.15)' : '#ECFDF5' }]}>
                  <BootstrapIcon name="check-circle-fill" size={11} color="#10B981" />
                  <Text style={[styles.sessionBadgeText, { color: '#059669' }]}>Verified Session</Text>
                </View>
              </View>

              <Text style={[styles.heroEmail, { color: textMuted }]}>{currentUser?.email || 'admin@mototrack.ph'}</Text>

              {/* Grouped Profile Photo Actions */}
              <View style={styles.avatarBtnRow}>
                <TouchableOpacity
                  style={[styles.photoActionBtn, { borderColor: cardBorder, backgroundColor: isDarkMode ? '#1B2621' : '#F8FAFC' }]}
                  onPress={handlePickAvatar}
                  disabled={isUploadingAvatar}
                  activeOpacity={0.75}
                >
                  {isUploadingAvatar ? (
                    <ActivityIndicator size="small" color={brandGreen} />
                  ) : (
                    <>
                      <BootstrapIcon name="camera-fill" size={12} color={isDarkMode ? brandGreen : '#EA580C'} />
                      <Text style={[styles.photoActionBtnText, { color: isDarkMode ? brandGreen : '#EA580C' }]}>
                        Upload Photo
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {currentUser?.avatar ? (
                  <TouchableOpacity
                    style={[styles.photoActionBtn, { borderColor: '#FEE2E2', backgroundColor: isDarkMode ? '#2D1616' : '#FEF2F2' }]}
                    onPress={handleRemoveAvatar}
                    disabled={isUploadingAvatar}
                    activeOpacity={0.75}
                  >
                    <BootstrapIcon name="trash" size={12} color="#DC2626" />
                    <Text style={[styles.photoActionBtnText, { color: '#DC2626' }]}>Remove</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>

          {/* Right Status Indicators */}
          <View style={[styles.heroRightStats, { borderColor: cardBorder, backgroundColor: isDarkMode ? '#0F1412' : '#F8FAFC' }]}>
            <View style={styles.statCell}>
              <Text style={[styles.statValue, { color: brandGreen, fontSize: 13.5 }]}>
                {currentUser?.role === 'admin' ? 'Store Administrator' : 'Administrator'}
              </Text>
              <Text style={[styles.statLabel, { color: textMuted }]}>Administrative Role</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: cardBorder }]} />
            <View style={styles.statCell}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' }} />
                <Text style={[styles.statValue, { color: '#059669', fontSize: 13.5 }]}>Active</Text>
              </View>
              <Text style={[styles.statLabel, { color: textMuted }]}>Security Status</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: cardBorder }]} />
            <View style={styles.statCell}>
              <Text style={[styles.statValue, { color: textPrimary, fontSize: 13.5 }]}>Supabase</Text>
              <Text style={[styles.statLabel, { color: textMuted }]}>Auth Sync</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ─── 2. TAB NAVIGATION ─── */}
      <View style={styles.tabBarWrapper}>
        <View style={[styles.tabBar, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'profile' && styles.tabBtnActive]}
            onPress={() => setActiveTab('profile')}
            activeOpacity={0.85}
          >
            <BootstrapIcon
              name="person-badge-fill"
              size={14}
              color={activeTab === 'profile' ? '#FFFFFF' : textMuted}
            />
            <Text style={[styles.tabBtnText, activeTab === 'profile' && styles.tabBtnTextActive]}>
              Profile Information
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'security' && styles.tabBtnActive]}
            onPress={() => setActiveTab('security')}
            activeOpacity={0.85}
          >
            <BootstrapIcon
              name="shield-lock-fill"
              size={14}
              color={activeTab === 'security' ? '#FFFFFF' : textMuted}
            />
            <Text style={[styles.tabBtnText, activeTab === 'security' && styles.tabBtnTextActive]}>
              Security & Credentials
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── 3. TAB 1: PROFILE INFORMATION ─── */}
      {activeTab === 'profile' && (
        <View style={styles.tabContent}>
          <View style={[styles.panelCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            {/* Header */}
            <View style={styles.panelHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.panelIconCircle, { backgroundColor: isDarkMode ? '#1E2D27' : '#FFF7ED' }]}>
                  <BootstrapIcon name="person-lines-fill" size={16} color={brandGreen} />
                </View>
                <View>
                  <Text style={[styles.panelTitle, { color: textPrimary }]}>Administrator Identity</Text>
                  <Text style={[styles.panelSubtitle, { color: textMuted }]}>
                    Update your full name, contact phone number, and administrator profile details.
                  </Text>
                </View>
              </View>
            </View>

            {profileSuccessMsg ? (
              <View style={styles.bannerSuccess}>
                <BootstrapIcon name="check-circle-fill" size={14} color="#059669" />
                <Text style={styles.bannerSuccessText}>{profileSuccessMsg}</Text>
              </View>
            ) : null}

            {/* Responsive Form Grid */}
            <View style={styles.formRow}>
              {/* Left Column: Personal Meta */}
              <View style={styles.formCol}>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: textPrimary }]}>Full Name *</Text>
                  <View style={[styles.fieldInputWrap, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                    <BootstrapIcon name="person" size={14} color={textMuted} style={styles.fieldInputIcon} />
                    <TextInput
                      style={[styles.fieldTextInput, { color: textPrimary }]}
                      placeholder="e.g. Jherico Maurin"
                      placeholderTextColor={textMuted}
                      value={name}
                      onChangeText={setName}
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: textPrimary }]}>Contact Phone</Text>
                  <View style={[styles.fieldInputWrap, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                    <BootstrapIcon name="telephone" size={14} color={textMuted} style={styles.fieldInputIcon} />
                    <TextInput
                      style={[styles.fieldTextInput, { color: textPrimary }]}
                      placeholder="e.g. 0917 123 4567"
                      placeholderTextColor={textMuted}
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>
              </View>

              {/* Right Column: Account & Security Overview */}
              <View style={styles.formCol}>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: textPrimary }]}>Primary Login Email</Text>
                  <View
                    style={[
                      styles.fieldInputWrap,
                      { backgroundColor: isDarkMode ? '#131A17' : '#F8FAFC', borderColor: inputBorder },
                    ]}
                  >
                    <BootstrapIcon name="envelope" size={14} color={textMuted} style={styles.fieldInputIcon} />
                    <TextInput
                      style={[styles.fieldTextInput, { color: textPrimary, fontWeight: '600' }]}
                      value={currentUser?.email || 'admin@mototrack.ph'}
                      editable={false}
                    />
                    <TouchableOpacity
                      onPress={() => setActiveTab('security')}
                      style={{ paddingHorizontal: 8, paddingVertical: 4 }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 11.5, fontWeight: '700', color: brandGreen }}>Change</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: textPrimary }]}>Administrative Role</Text>
                  <View
                    style={[
                      styles.fieldInputWrap,
                      { backgroundColor: isDarkMode ? '#131A17' : '#F8FAFC', borderColor: inputBorder },
                    ]}
                  >
                    <BootstrapIcon name="shield-lock" size={14} color={brandGreen} style={styles.fieldInputIcon} />
                    <TextInput
                      style={[styles.fieldTextInput, { color: textPrimary, fontWeight: '600' }]}
                      value="Store Administrator (Full Permissions)"
                      editable={false}
                    />
                    <View style={styles.readOnlyLockPill}>
                      <BootstrapIcon name="lock-fill" size={10} color="#64748B" />
                      <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#64748B' }}>Fixed</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* Footer with Save Profile */}
            <View style={[styles.panelFooter, { borderTopColor: cardBorder }]}>
              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={handleSaveProfile}
                disabled={isSavingProfile}
                activeOpacity={0.85}
              >
                {isSavingProfile ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <BootstrapIcon name="check2" size={15} color="#FFFFFF" />
                    <Text style={styles.primaryActionBtnText}>Save Profile Details</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ─── 4. TAB 2: SECURITY & CREDENTIALS ─── */}
      {activeTab === 'security' && (
        <View style={styles.tabContent}>
          {/* Card 1: Change Email Address */}
          <View style={[styles.panelCard, { backgroundColor: cardBg, borderColor: cardBorder, marginBottom: 18 }]}>
            <View style={styles.panelHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.panelIconCircle, { backgroundColor: isDarkMode ? '#132838' : '#F0F9FF' }]}>
                  <BootstrapIcon name="envelope-at-fill" size={16} color="#0284C7" />
                </View>
                <View>
                  <Text style={[styles.panelTitle, { color: textPrimary }]}>Update Primary Email</Text>
                  <Text style={[styles.panelSubtitle, { color: textMuted }]}>
                    Current login email: <Text style={{ fontWeight: '700', color: textPrimary }}>{currentUser?.email}</Text>
                  </Text>
                </View>
              </View>
            </View>

            {emailSuccessMsg ? (
              <View style={styles.bannerSuccess}>
                <BootstrapIcon name="check-circle-fill" size={14} color="#059669" />
                <Text style={styles.bannerSuccessText}>{emailSuccessMsg}</Text>
              </View>
            ) : null}
            {emailErrorMsg ? (
              <View style={styles.bannerError}>
                <BootstrapIcon name="exclamation-circle-fill" size={14} color="#DC2626" />
                <Text style={styles.bannerErrorText}>{emailErrorMsg}</Text>
              </View>
            ) : null}

            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: textPrimary }]}>New Email Address *</Text>
                  <View style={[styles.fieldInputWrap, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                    <BootstrapIcon name="envelope" size={14} color={textMuted} style={styles.fieldInputIcon} />
                    <TextInput
                      style={[styles.fieldTextInput, { color: textPrimary }]}
                      placeholder="e.g. jherico.admin@mototrack.ph"
                      placeholderTextColor={textMuted}
                      value={newEmail}
                      onChangeText={setNewEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                </View>
              </View>

              <View style={styles.formCol}>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: textPrimary }]}>Current Password to Authorize *</Text>
                  <View style={[styles.fieldInputWrap, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                    <BootstrapIcon name="lock" size={14} color={textMuted} style={styles.fieldInputIcon} />
                    <TextInput
                      style={[styles.fieldTextInput, { color: textPrimary }]}
                      placeholder="Enter current password"
                      placeholderTextColor={textMuted}
                      value={emailCurrentPassword}
                      onChangeText={setEmailCurrentPassword}
                      secureTextEntry={!showEmailCurrentPwd}
                    />
                    <TouchableOpacity
                      onPress={() => setShowEmailCurrentPwd((p) => !p)}
                      style={styles.eyeBtn}
                      activeOpacity={0.7}
                    >
                      <BootstrapIcon
                        name={showEmailCurrentPwd ? 'eye-slash' : 'eye'}
                        size={14}
                        color={textMuted}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            <View style={[styles.panelFooter, { borderTopColor: cardBorder }]}>
              <TouchableOpacity
                style={[styles.primaryActionBtn, { backgroundColor: '#0284C7' }]}
                onPress={handleChangeEmail}
                disabled={isChangingEmail}
                activeOpacity={0.85}
              >
                {isChangingEmail ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <BootstrapIcon name="arrow-repeat" size={14} color="#FFFFFF" />
                    <Text style={styles.primaryActionBtnText}>Update Email Address</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Card 2: Change Password */}
          <View style={[styles.panelCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.panelHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.panelIconCircle, { backgroundColor: isDarkMode ? '#1E2D27' : '#ECFDF5' }]}>
                  <BootstrapIcon name="key-fill" size={16} color={brandGreen} />
                </View>
                <View>
                  <Text style={[styles.panelTitle, { color: textPrimary }]}>Change Password</Text>
                  <Text style={[styles.panelSubtitle, { color: textMuted }]}>
                    Strengthen your administrative account security with a robust password.
                  </Text>
                </View>
              </View>
            </View>

            {pwdSuccessMsg ? (
              <View style={styles.bannerSuccess}>
                <BootstrapIcon name="check-circle-fill" size={14} color="#059669" />
                <Text style={styles.bannerSuccessText}>{pwdSuccessMsg}</Text>
              </View>
            ) : null}
            {pwdErrorMsg ? (
              <View style={styles.bannerError}>
                <BootstrapIcon name="exclamation-circle-fill" size={14} color="#DC2626" />
                <Text style={styles.bannerErrorText}>{pwdErrorMsg}</Text>
              </View>
            ) : null}

            <View style={styles.formRow}>
              {/* Current Password Field (Full Width) */}
              <View style={{ width: '100%' }}>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: textPrimary }]}>Current Password *</Text>
                  <View style={[styles.fieldInputWrap, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                    <BootstrapIcon name="lock" size={14} color={textMuted} style={styles.fieldInputIcon} />
                    <TextInput
                      style={[styles.fieldTextInput, { color: textPrimary }]}
                      placeholder="Enter current password"
                      placeholderTextColor={textMuted}
                      value={pwdCurrentPassword}
                      onChangeText={setPwdCurrentPassword}
                      secureTextEntry={!showPwdCurrent}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPwdCurrent((p) => !p)}
                      style={styles.eyeBtn}
                      activeOpacity={0.7}
                    >
                      <BootstrapIcon name={showPwdCurrent ? 'eye-slash' : 'eye'} size={14} color={textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* 2-Column: New & Confirm Password */}
              <View style={styles.formCol}>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: textPrimary }]}>New Password *</Text>
                  <View style={[styles.fieldInputWrap, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                    <BootstrapIcon name="key" size={14} color={textMuted} style={styles.fieldInputIcon} />
                    <TextInput
                      style={[styles.fieldTextInput, { color: textPrimary }]}
                      placeholder="Min. 8 characters"
                      placeholderTextColor={textMuted}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry={!showNewPwd}
                    />
                    <TouchableOpacity
                      onPress={() => setShowNewPwd((p) => !p)}
                      style={styles.eyeBtn}
                      activeOpacity={0.7}
                    >
                      <BootstrapIcon name={showNewPwd ? 'eye-slash' : 'eye'} size={14} color={textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={styles.formCol}>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: textPrimary }]}>Confirm New Password *</Text>
                  <View style={[styles.fieldInputWrap, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                    <BootstrapIcon name="check2-circle" size={14} color={textMuted} style={styles.fieldInputIcon} />
                    <TextInput
                      style={[styles.fieldTextInput, { color: textPrimary }]}
                      placeholder="Re-enter new password"
                      placeholderTextColor={textMuted}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirmPwd}
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirmPwd((p) => !p)}
                      style={styles.eyeBtn}
                      activeOpacity={0.7}
                    >
                      <BootstrapIcon
                        name={showConfirmPwd ? 'eye-slash' : 'eye'}
                        size={14}
                        color={textMuted}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Password Strength Indicator */}
              {newPassword ? (
                <View style={{ width: '100%' }}>
                  <View style={[styles.strengthBox, { backgroundColor: isDarkMode ? '#131A17' : '#F8FAFC', borderColor: inputBorder }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: textMuted }}>Password Strength:</Text>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: pwdStrength?.color || '#DC2626' }}>
                        {pwdStrength?.label || 'Weak'}
                      </Text>
                    </View>

                    <View style={[styles.strengthTrack, { backgroundColor: isDarkMode ? '#23322B' : '#E2E8F0' }]}>
                      <View
                        style={[
                          styles.strengthFill,
                          {
                            width: `${pwdStrength?.score || 15}%`,
                            backgroundColor: pwdStrength?.color || '#DC2626',
                          },
                        ]}
                      />
                    </View>

                    {/* Requirements Pills */}
                    <View style={styles.reqGrid}>
                      <View style={styles.reqItem}>
                        <BootstrapIcon
                          name={pwdStrength?.minLength ? 'check-circle-fill' : 'circle'}
                          size={11}
                          color={pwdStrength?.minLength ? '#10B981' : textMuted}
                        />
                        <Text style={[styles.reqText, { color: pwdStrength?.minLength ? textPrimary : textMuted }]}>
                          8+ characters
                        </Text>
                      </View>
                      <View style={styles.reqItem}>
                        <BootstrapIcon
                          name={pwdStrength?.hasUppercase ? 'check-circle-fill' : 'circle'}
                          size={11}
                          color={pwdStrength?.hasUppercase ? '#10B981' : textMuted}
                        />
                        <Text style={[styles.reqText, { color: pwdStrength?.hasUppercase ? textPrimary : textMuted }]}>
                          Uppercase letter
                        </Text>
                      </View>
                      <View style={styles.reqItem}>
                        <BootstrapIcon
                          name={pwdStrength?.hasLowercase ? 'check-circle-fill' : 'circle'}
                          size={11}
                          color={pwdStrength?.hasLowercase ? '#10B981' : textMuted}
                        />
                        <Text style={[styles.reqText, { color: pwdStrength?.hasLowercase ? textPrimary : textMuted }]}>
                          Lowercase letter
                        </Text>
                      </View>
                      <View style={styles.reqItem}>
                        <BootstrapIcon
                          name={pwdStrength?.hasNumber ? 'check-circle-fill' : 'circle'}
                          size={11}
                          color={pwdStrength?.hasNumber ? '#10B981' : textMuted}
                        />
                        <Text style={[styles.reqText, { color: pwdStrength?.hasNumber ? textPrimary : textMuted }]}>
                          Number
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              ) : null}
            </View>

            <View style={[styles.panelFooter, { borderTopColor: cardBorder }]}>
              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={handleChangePassword}
                disabled={isChangingPassword}
                activeOpacity={0.85}
              >
                {isChangingPassword ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <BootstrapIcon name="shield-check" size={15} color="#FFFFFF" />
                    <Text style={styles.primaryActionBtnText}>Update Password</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 40,
  },

  // ─── 1. HERO CARD ───
  heroCard: {
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  heroLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
  },
  heroLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
    minWidth: 280,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarBox: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarOnlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  heroName: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
  },
  sessionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  sessionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  heroEmail: {
    fontSize: 12.5,
    marginTop: 2,
  },
  avatarBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 9,
  },
  photoActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
    cursor: 'pointer',
  },
  photoActionBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
  },

  heroRightStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  statCell: {
    alignItems: 'center',
    minWidth: 70,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 10.5,
    marginTop: 2,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 24,
  },

  // ─── 2. TAB BAR ───
  tabBarWrapper: {
    marginBottom: 16,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 5,
    borderRadius: 11,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    cursor: 'pointer',
  },
  tabBtnActive: {
    backgroundColor: '#EA580C',
  },
  tabBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
  },

  // ─── 3. PANELS & CARDS ───
  tabContent: {
    width: '100%',
  },
  panelCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  panelHeader: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
  },
  panelIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  panelSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  panelFooter: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },

  formRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 16,
  },
  formCol: {
    flex: 1,
    minWidth: 260,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 5,
  },
  fieldInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 11,
    height: 42,
  },
  fieldInputIcon: {
    marginRight: 8,
  },
  fieldTextInput: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    outlineStyle: 'none',
  },
  readOnlyLockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  eyeBtn: {
    padding: 6,
    cursor: 'pointer',
  },

  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 6,
    borderWidth: 1,
    cursor: 'pointer',
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '700',
  },

  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EA580C',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
    cursor: 'pointer',
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12.5,
  },

  bannerSuccess: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerSuccessText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },
  bannerError: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerErrorText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991B1B',
  },

  strengthBox: {
    marginTop: 6,
    marginBottom: 14,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  strengthTrack: {
    height: 5,
    borderRadius: 2.5,
    overflow: 'hidden',
  },
  strengthFill: {
    height: '100%',
  },
  reqGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  reqItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reqText: {
    fontSize: 11,
  },

});
