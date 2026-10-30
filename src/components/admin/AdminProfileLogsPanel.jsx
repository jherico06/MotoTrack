import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { BootstrapIcon } from '../common/BootstrapIcon.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { authService } from '../../services/auth/authService.js';
import { adminSecurityService } from '../../services/auth/adminSecurityService.js';
import { pickImageFromFile } from '../../utils/imagePickerHelper.js';

/**
 * Helper to compute user initials for the avatar squircle
 */
function getInitials(name) {
  if (!name || typeof name !== 'string') return 'AD';
  const clean = name.trim();
  if (!clean) return 'AD';
  const parts = clean.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

/**
 * AdminProfileLogsPanel
 *
 * Modern executive administrator profile & security credentials management.
 * Designed to provide a clean, high-clarity settings interface with instant
 * profile updates, session telemetry, and role verification.
 */
export default function AdminProfileLogsPanel({
  isDarkMode = false,
  tokens = {},
  showToast = () => {},
  showConfirm: _showConfirm = () => {},
  isDesktop = true,
  onNavigate: _onNavigate = () => {},
}) {
  const { currentUser, updateProfile, changeEmail, changePassword } = useAuth();

  // Active sub-tab: 'profile' | 'security'
  const [activeTab, setActiveTab] = useState('profile');

  // ── Profile Form State ──
  const [name, setName] = useState(() => currentUser?.name || currentUser?.fullName || '');
  const [phone, setPhone] = useState(() => currentUser?.phone || '');
  const [prevUserId, setPrevUserId] = useState(() => currentUser?.id || currentUser?.user_id || null);
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

  // ── Security: Admin PIN State ──
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPins, setShowPins] = useState(false);
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [pinErrorMsg, setPinErrorMsg] = useState('');
  const [pinSuccessMsg, setPinSuccessMsg] = useState('');
  const [pinMeta, setPinMeta] = useState(() => adminSecurityService.getPinMetadata(currentUser));

  // Sync state when currentUser is loaded asynchronously or switches
  const currentUserId = currentUser?.id || currentUser?.user_id || null;
  if (currentUserId && currentUserId !== prevUserId) {
    setPrevUserId(currentUserId);
    setName(currentUser?.name || currentUser?.fullName || '');
    setPhone(currentUser?.phone || '');
    setPinMeta(adminSecurityService.getPinMetadata(currentUser));
  }

  // Password validation analysis
  const pwdStrength = useMemo(() => {
    return authService.validatePasswordStrength(newPassword);
  }, [newPassword]);

  // Async load fresh PIN metadata from Supabase
  useEffect(() => {
    let isMounted = true;
    if (currentUser) {
      adminSecurityService
        .getPinStatus(currentUser)
        .then((meta) => {
          if (isMounted && meta) setPinMeta(meta);
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
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

  const handleChangePin = async () => {
    setPinErrorMsg('');
    setPinSuccessMsg('');

    const cleanCurrent = currentPin.trim();
    const cleanNew = newPin.trim();
    const cleanConfirm = confirmPin.trim();

    if (!cleanCurrent) {
      setPinErrorMsg('Please enter your current Admin PIN.');
      return;
    }
    if (!/^\d{4,6}$/.test(cleanNew)) {
      setPinErrorMsg('New PIN must be 4 to 6 numeric digits (0–9).');
      return;
    }
    if (cleanNew !== cleanConfirm) {
      setPinErrorMsg('New PIN and confirmation do not match.');
      return;
    }
    if (cleanNew === cleanCurrent) {
      setPinErrorMsg('New PIN cannot be identical to your current PIN.');
      return;
    }

    setIsChangingPin(true);
    try {
      const res = await adminSecurityService.setAdminPin(cleanCurrent, cleanNew, currentUser);
      if (res?.success) {
        setPinMeta(adminSecurityService.getPinMetadata(currentUser));
        setPinSuccessMsg('Admin Security PIN updated! The previous PIN is now disabled.');
        showToast('✓ Admin Security PIN updated successfully');
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
      } else {
        setPinErrorMsg(res?.error || 'Failed to update Admin Security PIN.');
      }
    } catch (_e) {
      setPinErrorMsg('Error updating Admin Security PIN.');
    } finally {
      setIsChangingPin(false);
    }
  };

  // Color tokens
  const cardBg = isDarkMode ? tokens.bgElevated || '#131A17' : '#FFFFFF';
  const cardBorder = isDarkMode ? tokens.borderInput || '#23322B' : '#E2E8F0';
  const textPrimary = isDarkMode ? tokens.textPrimary || '#F8FAFC' : '#0F172A';
  const textMuted = isDarkMode ? tokens.textMuted || '#94A3B8' : '#64748B';
  const inputBg = isDarkMode ? '#17221E' : '#FFFFFF';
  const inputBorder = isDarkMode ? '#2D4037' : '#CBD5E1';

  const displayName = name || currentUser?.name || currentUser?.fullName || 'Jherico Maurin';
  const displayEmail = currentUser?.email || 'jhericomaurin615@gmail.com';
  const initials = getInitials(displayName);

  const hasCustomAvatar =
    currentUser?.avatar &&
    !currentUser.avatar.includes('photo-1535713875002') &&
    !currentUser.avatar.includes('photo-1534528741775') &&
    !currentUser.avatar.includes('ui-avatars.com');

  return (
    <View style={styles.container}>
      {/* ─────────────────────────────────────────────────────────────
          1. TOP PROFILE SUMMARY HERO CARD (Matching Screenshot)
      ────────────────────────────────────────────────────────────── */}
      <View style={[styles.heroCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <View style={styles.heroLayout}>
          {/* Left Avatar & Identity */}
          <View style={styles.heroLeft}>
            {/* Squircle Avatar with Green Verified Badge */}
            <View style={styles.avatarContainer}>
              <View style={[styles.avatarSquircle, { backgroundColor: isDarkMode ? '#1E293B' : '#2D3748' }]}>
                {hasCustomAvatar ? (
                  <Image source={{ uri: currentUser.avatar }} style={styles.avatarImg} resizeMode="cover" />
                ) : (
                  <Text style={styles.avatarInitialsText}>{initials}</Text>
                )}
              </View>
              {/* Green Verified Checkmark Badge */}
              <View style={styles.verifiedCheckBadge}>
                <BootstrapIcon name="check" size={13} color="#FFFFFF" />
              </View>
            </View>

            {/* Name, Role Pill, Email, and Action Buttons */}
            <View style={styles.identityDetailsWrap}>
              <View style={styles.nameAndRoleRow}>
                <Text style={[styles.heroName, { color: textPrimary }]}>{displayName}</Text>
                <View style={styles.storeAdminPill}>
                  <BootstrapIcon name="shield-check" size={13} color="#059669" />
                  <Text style={styles.storeAdminPillText}>Store administrator</Text>
                </View>
              </View>

              <Text style={[styles.heroEmail, { color: textMuted }]}>{displayEmail}</Text>

              {/* Action Buttons: Change Photo & Remove */}
              <View style={styles.avatarBtnRow}>
                <TouchableOpacity
                  style={[
                    styles.changePhotoBtn,
                    {
                      borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                      backgroundColor: isDarkMode ? '#1B2621' : '#FFFFFF',
                    },
                  ]}
                  onPress={handlePickAvatar}
                  disabled={isUploadingAvatar}
                  activeOpacity={0.75}
                >
                  {isUploadingAvatar ? (
                    <ActivityIndicator size="small" color="#EA580C" />
                  ) : (
                    <>
                      <BootstrapIcon
                        name="camera"
                        size={13}
                        color={isDarkMode ? tokens.textPrimary : '#0F172A'}
                      />
                      <Text
                        style={[
                          styles.changePhotoBtnText,
                          { color: isDarkMode ? tokens.textPrimary : '#0F172A' },
                        ]}
                      >
                        Change photo
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {hasCustomAvatar && (
                  <TouchableOpacity
                    style={styles.removePhotoBtn}
                    onPress={handleRemoveAvatar}
                    disabled={isUploadingAvatar}
                    activeOpacity={0.75}
                  >
                    <BootstrapIcon name="trash" size={13} color="#DC2626" />
                    <Text style={styles.removePhotoBtnText}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {/* Right Status / Telemetry Box (3 Columns) */}
          <View
            style={[
              styles.heroRightStats,
              {
                borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                backgroundColor: isDarkMode ? '#0F1412' : '#FFFFFF',
              },
            ]}
          >
            {/* Col 1: ACCESS LEVEL */}
            <View style={styles.statCell}>
              <Text style={styles.statLabel}>ACCESS LEVEL</Text>
              <Text style={[styles.statValue, { color: textPrimary }]}>Full permissions</Text>
              <Text style={[styles.statSubtext, { color: textMuted }]}>Store administrator</Text>
            </View>

            <View
              style={[styles.statDivider, { backgroundColor: isDarkMode ? tokens.borderInput : '#E2E8F0' }]}
            />

            {/* Col 2: SESSION */}
            <View style={styles.statCell}>
              <Text style={styles.statLabel}>SESSION</Text>
              <View style={styles.sessionValueRow}>
                <View style={styles.sessionActiveDot} />
                <Text style={styles.sessionActiveText}>Active</Text>
              </View>
              <Text style={[styles.statSubtext, { color: textMuted }]}>Verified device</Text>
            </View>

            <View
              style={[styles.statDivider, { backgroundColor: isDarkMode ? tokens.borderInput : '#E2E8F0' }]}
            />

            {/* Col 3: AUTH PROVIDER */}
            <View style={styles.statCell}>
              <Text style={styles.statLabel}>AUTH PROVIDER</Text>
              <Text style={[styles.statValue, { color: textPrimary }]}>Supabase</Text>
              <Text style={[styles.statSubtext, { color: textMuted }]}>Synced automatically</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ─────────────────────────────────────────────────────────────
          2. TWO-COLUMN LAYOUT: SETTINGS SIDEBAR + MAIN CONTENT
      ────────────────────────────────────────────────────────────── */}
      <View style={[styles.mainLayoutRow, { flexDirection: isDesktop ? 'row' : 'column' }]}>
        {/* ─── LEFT COLUMN: SETTINGS NAV CARD ─── */}
        <View
          style={[
            styles.settingsNavCard,
            {
              width: isDesktop ? 290 : '100%',
              backgroundColor: cardBg,
              borderColor: cardBorder,
            },
          ]}
        >
          <Text style={styles.settingsNavHeader}>SETTINGS</Text>

          <View style={styles.settingsNavList}>
            {/* Nav Item 1: Profile information */}
            <TouchableOpacity
              style={[styles.navItemBtn, activeTab === 'profile' && styles.navItemBtnActive]}
              onPress={() => setActiveTab('profile')}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.navIconBox,
                  activeTab === 'profile' ? styles.navIconBoxActive : styles.navIconBoxInactive,
                ]}
              >
                <BootstrapIcon
                  name={activeTab === 'profile' ? 'person-fill' : 'person'}
                  size={16}
                  color={activeTab === 'profile' ? '#FFFFFF' : '#64748B'}
                />
              </View>

              <View style={styles.navTextWrap}>
                <Text
                  style={[
                    styles.navItemTitle,
                    { color: textPrimary },
                    activeTab === 'profile' && styles.navItemTitleActive,
                  ]}
                >
                  Profile information
                </Text>
                <Text style={[styles.navItemSubtitle, { color: textMuted }]}>Name and contact details</Text>
              </View>

              <BootstrapIcon
                name="chevron-right"
                size={12}
                color={activeTab === 'profile' ? '#EA580C' : '#94A3B8'}
              />
            </TouchableOpacity>

            {/* Nav Item 2: Security & credentials */}
            <TouchableOpacity
              style={[styles.navItemBtn, activeTab === 'security' && styles.navItemBtnActive]}
              onPress={() => setActiveTab('security')}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.navIconBox,
                  activeTab === 'security' ? styles.navIconBoxActive : styles.navIconBoxInactive,
                ]}
              >
                <BootstrapIcon
                  name={activeTab === 'security' ? 'shield-lock-fill' : 'shield-lock'}
                  size={16}
                  color={activeTab === 'security' ? '#FFFFFF' : '#64748B'}
                />
              </View>

              <View style={styles.navTextWrap}>
                <Text
                  style={[
                    styles.navItemTitle,
                    { color: textPrimary },
                    activeTab === 'security' && styles.navItemTitleActive,
                  ]}
                >
                  Security & credentials
                </Text>
                <Text style={[styles.navItemSubtitle, { color: textMuted }]}>Email and password</Text>
              </View>

              <BootstrapIcon
                name="chevron-right"
                size={12}
                color={activeTab === 'security' ? '#EA580C' : '#94A3B8'}
              />
            </TouchableOpacity>
          </View>

          {/* Bottom Security Guarantee Badge */}
          <View style={[styles.navBottomDivider, { backgroundColor: cardBorder }]} />
          <View style={styles.securityPledgeRow}>
            <BootstrapIcon name="shield-check" size={18} color="#059669" />
            <View style={{ flex: 1 }}>
              <Text style={styles.securityPledgeTitle}>Your account is secure</Text>
              <Text style={styles.securityPledgeSubtitle}>Credentials are encrypted and protected.</Text>
            </View>
          </View>
        </View>

        {/* ─── RIGHT COLUMN: MAIN CONTENT CARD ─── */}
        <View style={{ flex: 1, width: '100%' }}>
          {/* TAB 1: PROFILE INFORMATION */}
          {activeTab === 'profile' && (
            <View style={[styles.mainContentCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              {profileSuccessMsg ? (
                <View style={styles.bannerSuccess}>
                  <BootstrapIcon name="check-circle-fill" size={14} color="#059669" />
                  <Text style={styles.bannerSuccessText}>{profileSuccessMsg}</Text>
                </View>
              ) : null}

              {/* ── Section 1: Personal information ── */}
              <View style={styles.sectionHeaderRow}>
                <View style={styles.peachSectionIconBox}>
                  <BootstrapIcon name="person" size={18} color="#EA580C" />
                </View>
                <View>
                  <Text style={[styles.sectionTitle, { color: textPrimary }]}>Personal information</Text>
                  <Text style={[styles.sectionSubtitle, { color: textMuted }]}>
                    Keep your profile details accurate and up to date.
                  </Text>
                </View>
              </View>

              {/* Form Input Row (2 Columns) */}
              <View style={[styles.formGridRow, { flexDirection: isDesktop ? 'row' : 'column' }]}>
                {/* Full Name */}
                <View style={styles.formGridCol}>
                  <Text style={[styles.fieldLabel, { color: textPrimary }]}>
                    Full name <Text style={{ color: '#EA580C' }}>*</Text>
                  </Text>
                  <View
                    style={[
                      styles.fieldInputWrap,
                      {
                        backgroundColor: inputBg,
                        borderColor: inputBorder,
                      },
                    ]}
                  >
                    <BootstrapIcon name="person" size={16} color="#94A3B8" style={{ marginRight: 10 }} />
                    <TextInput
                      style={[styles.fieldTextInput, { color: textPrimary }]}
                      value={name}
                      onChangeText={setName}
                      placeholder="Jherico Maurin"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>

                {/* Contact Phone */}
                <View style={styles.formGridCol}>
                  <Text style={[styles.fieldLabel, { color: textPrimary }]}>Contact phone</Text>
                  <View
                    style={[
                      styles.fieldInputWrap,
                      {
                        backgroundColor: inputBg,
                        borderColor: inputBorder,
                      },
                    ]}
                  >
                    <BootstrapIcon name="telephone" size={15} color="#94A3B8" style={{ marginRight: 10 }} />
                    <TextInput
                      style={[styles.fieldTextInput, { color: textPrimary }]}
                      value={phone}
                      onChangeText={setPhone}
                      placeholder="e.g. 0917 123 4567"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                  <Text style={styles.fieldHelperText}>
                    Used only for account recovery and urgent alerts.
                  </Text>
                </View>
              </View>

              {/* Horizontal Divider */}
              <View style={[styles.sectionDivider, { backgroundColor: cardBorder }]} />

              {/* ── Section 2: Administrative access ── */}
              <View style={styles.sectionHeaderRow}>
                <View style={styles.greenSectionIconBox}>
                  <BootstrapIcon name="shield-check" size={18} color="#10B981" />
                </View>
                <View>
                  <Text style={[styles.sectionTitle, { color: textPrimary }]}>Administrative access</Text>
                  <Text style={[styles.sectionSubtitle, { color: textMuted }]}>
                    Your role is managed by the account owner.
                  </Text>
                </View>
              </View>

              {/* Role Card Box */}
              <View
                style={[
                  styles.roleCardBox,
                  {
                    backgroundColor: isDarkMode ? '#17221E' : '#F8FAFC',
                    borderColor: cardBorder,
                  },
                ]}
              >
                <View style={styles.roleCardLeft}>
                  <View style={styles.roleIconCircle}>
                    <BootstrapIcon name="shield-check" size={18} color="#059669" />
                  </View>
                  <View style={styles.roleTextWrap}>
                    <Text style={styles.roleCardHeaderLabel}>CURRENT ROLE</Text>
                    <Text style={[styles.roleCardTitle, { color: textPrimary }]}>Store administrator</Text>
                    <Text style={[styles.roleCardDesc, { color: textMuted }]}>
                      Full access to store operations, customers, reports, and settings.
                    </Text>
                  </View>
                </View>

                {/* Locked Pill Badge */}
                <View
                  style={[
                    styles.lockedBadge,
                    {
                      backgroundColor: isDarkMode ? tokens.borderInput : '#F1F5F9',
                      borderColor: cardBorder,
                    },
                  ]}
                >
                  <BootstrapIcon name="lock-fill" size={12} color="#64748B" />
                  <Text style={styles.lockedBadgeText}>Locked</Text>
                </View>
              </View>

              {/* ── Bottom Footer with Save Changes Button ── */}
              <View style={[styles.footerActionRow, { borderTopColor: cardBorder }]}>
                <Text style={styles.footerNoteText}>Changes apply to your administrator profile only.</Text>

                <TouchableOpacity
                  style={styles.saveChangesBtn}
                  onPress={handleSaveProfile}
                  disabled={isSavingProfile}
                  activeOpacity={0.85}
                >
                  {isSavingProfile ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <BootstrapIcon name="check" size={18} color="#FFFFFF" />
                      <Text style={styles.saveChangesBtnText}>Save changes</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* TAB 2: SECURITY & CREDENTIALS */}
          {activeTab === 'security' && (
            <View style={[styles.mainContentCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              {/* ── Section A: Administrator Email ── */}
              <View style={styles.sectionHeaderRow}>
                <View style={styles.peachSectionIconBox}>
                  <BootstrapIcon name="envelope-fill" size={17} color="#EA580C" />
                </View>
                <View>
                  <Text style={[styles.sectionTitle, { color: textPrimary }]}>Administrator Email</Text>
                  <Text style={[styles.sectionSubtitle, { color: textMuted }]}>
                    Update your verified login email address for administrative notifications.
                  </Text>
                </View>
              </View>

              {emailErrorMsg ? (
                <View style={styles.bannerError}>
                  <BootstrapIcon name="exclamation-circle-fill" size={14} color="#DC2626" />
                  <Text style={styles.bannerErrorText}>{emailErrorMsg}</Text>
                </View>
              ) : null}
              {emailSuccessMsg ? (
                <View style={styles.bannerSuccess}>
                  <BootstrapIcon name="check-circle-fill" size={14} color="#059669" />
                  <Text style={styles.bannerSuccessText}>{emailSuccessMsg}</Text>
                </View>
              ) : null}

              <View style={[styles.formGridRow, { flexDirection: isDesktop ? 'row' : 'column' }]}>
                {/* Current Email Display */}
                <View style={styles.formGridCol}>
                  <Text style={[styles.fieldLabel, { color: textPrimary }]}>Current verified email</Text>
                  <View
                    style={[
                      styles.fieldInputWrap,
                      {
                        backgroundColor: isDarkMode ? '#131A17' : '#F8FAFC',
                        borderColor: cardBorder,
                      },
                    ]}
                  >
                    <BootstrapIcon
                      name="check-circle-fill"
                      size={15}
                      color="#10B981"
                      style={{ marginRight: 10 }}
                    />
                    <Text style={{ flex: 1, fontSize: 13.5, color: textPrimary, fontWeight: '600' }}>
                      {displayEmail}
                    </Text>
                    <View style={styles.verifiedSmallPill}>
                      <Text style={styles.verifiedSmallPillText}>Verified</Text>
                    </View>
                  </View>
                </View>

                {/* New Email Input */}
                <View style={styles.formGridCol}>
                  <Text style={[styles.fieldLabel, { color: textPrimary }]}>New email address</Text>
                  <View
                    style={[styles.fieldInputWrap, { backgroundColor: inputBg, borderColor: inputBorder }]}
                  >
                    <BootstrapIcon name="envelope" size={15} color="#94A3B8" style={{ marginRight: 10 }} />
                    <TextInput
                      style={[styles.fieldTextInput, { color: textPrimary }]}
                      value={newEmail}
                      onChangeText={setNewEmail}
                      placeholder="admin@newdomain.com"
                      placeholderTextColor="#94A3B8"
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                </View>
              </View>

              {newEmail ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={[styles.fieldLabel, { color: textPrimary }]}>
                    Authorize change with current password
                  </Text>
                  <View
                    style={[styles.fieldInputWrap, { backgroundColor: inputBg, borderColor: inputBorder }]}
                  >
                    <BootstrapIcon name="lock" size={15} color="#94A3B8" style={{ marginRight: 10 }} />
                    <TextInput
                      style={[styles.fieldTextInput, { color: textPrimary }]}
                      value={emailCurrentPassword}
                      onChangeText={setEmailCurrentPassword}
                      placeholder="Enter current password"
                      placeholderTextColor="#94A3B8"
                      secureTextEntry={!showEmailCurrentPwd}
                    />
                    <TouchableOpacity
                      onPress={() => setShowEmailCurrentPwd(!showEmailCurrentPwd)}
                      style={{ padding: 6 }}
                    >
                      <BootstrapIcon
                        name={showEmailCurrentPwd ? 'eye-slash' : 'eye'}
                        size={15}
                        color="#94A3B8"
                      />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={[styles.actionSubmitBtn, { alignSelf: 'flex-start', marginTop: 12 }]}
                    onPress={handleChangeEmail}
                    disabled={isChangingEmail}
                    activeOpacity={0.85}
                  >
                    {isChangingEmail ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.actionSubmitBtnText}>Confirm Email Update</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* Horizontal Divider */}
              <View style={[styles.sectionDivider, { backgroundColor: cardBorder }]} />

              {/* ── Section B: Administrator Password ── */}
              <View style={styles.sectionHeaderRow}>
                <View style={styles.peachSectionIconBox}>
                  <BootstrapIcon name="key-fill" size={17} color="#EA580C" />
                </View>
                <View>
                  <Text style={[styles.sectionTitle, { color: textPrimary }]}>Account Password</Text>
                  <Text style={[styles.sectionSubtitle, { color: textMuted }]}>
                    Ensure your account uses a strong, unique password to prevent unauthorized console access.
                  </Text>
                </View>
              </View>

              {pwdErrorMsg ? (
                <View style={styles.bannerError}>
                  <BootstrapIcon name="exclamation-circle-fill" size={14} color="#DC2626" />
                  <Text style={styles.bannerErrorText}>{pwdErrorMsg}</Text>
                </View>
              ) : null}
              {pwdSuccessMsg ? (
                <View style={styles.bannerSuccess}>
                  <BootstrapIcon name="check-circle-fill" size={14} color="#059669" />
                  <Text style={styles.bannerSuccessText}>{pwdSuccessMsg}</Text>
                </View>
              ) : null}

              <View style={{ gap: 12, marginTop: 4 }}>
                {/* Current Password */}
                <View>
                  <Text style={[styles.fieldLabel, { color: textPrimary }]}>Current password</Text>
                  <View
                    style={[styles.fieldInputWrap, { backgroundColor: inputBg, borderColor: inputBorder }]}
                  >
                    <BootstrapIcon name="lock" size={15} color="#94A3B8" style={{ marginRight: 10 }} />
                    <TextInput
                      style={[styles.fieldTextInput, { color: textPrimary }]}
                      value={pwdCurrentPassword}
                      onChangeText={setPwdCurrentPassword}
                      placeholder="Enter current password"
                      placeholderTextColor="#94A3B8"
                      secureTextEntry={!showPwdCurrent}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPwdCurrent(!showPwdCurrent)}
                      style={{ padding: 6 }}
                    >
                      <BootstrapIcon name={showPwdCurrent ? 'eye-slash' : 'eye'} size={15} color="#94A3B8" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* New Password & Confirm Password Row */}
                <View style={[styles.formGridRow, { flexDirection: isDesktop ? 'row' : 'column' }]}>
                  <View style={styles.formGridCol}>
                    <Text style={[styles.fieldLabel, { color: textPrimary }]}>New password</Text>
                    <View
                      style={[styles.fieldInputWrap, { backgroundColor: inputBg, borderColor: inputBorder }]}
                    >
                      <BootstrapIcon
                        name="shield-lock"
                        size={15}
                        color="#94A3B8"
                        style={{ marginRight: 10 }}
                      />
                      <TextInput
                        style={[styles.fieldTextInput, { color: textPrimary }]}
                        value={newPassword}
                        onChangeText={setNewPassword}
                        placeholder="At least 8 characters"
                        placeholderTextColor="#94A3B8"
                        secureTextEntry={!showNewPwd}
                      />
                      <TouchableOpacity onPress={() => setShowNewPwd(!showNewPwd)} style={{ padding: 6 }}>
                        <BootstrapIcon name={showNewPwd ? 'eye-slash' : 'eye'} size={15} color="#94A3B8" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.formGridCol}>
                    <Text style={[styles.fieldLabel, { color: textPrimary }]}>Confirm new password</Text>
                    <View
                      style={[styles.fieldInputWrap, { backgroundColor: inputBg, borderColor: inputBorder }]}
                    >
                      <BootstrapIcon
                        name="shield-lock"
                        size={15}
                        color="#94A3B8"
                        style={{ marginRight: 10 }}
                      />
                      <TextInput
                        style={[styles.fieldTextInput, { color: textPrimary }]}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        placeholder="Confirm password"
                        placeholderTextColor="#94A3B8"
                        secureTextEntry={!showConfirmPwd}
                      />
                      <TouchableOpacity
                        onPress={() => setShowConfirmPwd(!showConfirmPwd)}
                        style={{ padding: 6 }}
                      >
                        <BootstrapIcon
                          name={showConfirmPwd ? 'eye-slash' : 'eye'}
                          size={15}
                          color="#94A3B8"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Password Strength Meter */}
                {newPassword ? (
                  <View
                    style={[
                      styles.strengthMeterBox,
                      { backgroundColor: isDarkMode ? '#1A221E' : '#F8FAFC', borderColor: cardBorder },
                    ]}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 6,
                      }}
                    >
                      <Text style={{ fontSize: 11.5, fontWeight: '700', color: textPrimary }}>
                        Password Strength
                      </Text>
                      <Text style={{ fontSize: 11.5, fontWeight: '700', color: pwdStrength.color }}>
                        {pwdStrength.label}
                      </Text>
                    </View>
                    <View style={styles.strengthTrack}>
                      <View
                        style={[
                          styles.strengthFill,
                          {
                            width: `${(pwdStrength.score / 5) * 100}%`,
                            backgroundColor: pwdStrength.color,
                          },
                        ]}
                      />
                    </View>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[styles.actionSubmitBtn, { alignSelf: 'flex-start', marginTop: 8 }]}
                  onPress={handleChangePassword}
                  disabled={isChangingPassword}
                  activeOpacity={0.85}
                >
                  {isChangingPassword ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.actionSubmitBtnText}>Update Password</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Horizontal Divider */}
              <View style={[styles.sectionDivider, { backgroundColor: cardBorder }]} />

              {/* ── Section C: Admin Security PIN ── */}
              <View style={styles.sectionHeaderRow}>
                <View style={styles.peachSectionIconBox}>
                  <BootstrapIcon name="grid-3x3-gap-fill" size={17} color="#EA580C" />
                </View>
                <View>
                  <Text style={[styles.sectionTitle, { color: textPrimary }]}>Admin Security PIN</Text>
                  <Text style={[styles.sectionSubtitle, { color: textMuted }]}>
                    4 to 6 digit security PIN required for sensitive supervisor overrides and cashier
                    adjustments.
                    {pinMeta?.hasCustomPin ? ' • Custom PIN active' : ' • Default PIN in use'}
                  </Text>
                </View>
              </View>

              {pinErrorMsg ? (
                <View style={styles.bannerError}>
                  <BootstrapIcon name="exclamation-circle-fill" size={14} color="#DC2626" />
                  <Text style={styles.bannerErrorText}>{pinErrorMsg}</Text>
                </View>
              ) : null}
              {pinSuccessMsg ? (
                <View style={styles.bannerSuccess}>
                  <BootstrapIcon name="check-circle-fill" size={14} color="#059669" />
                  <Text style={styles.bannerSuccessText}>{pinSuccessMsg}</Text>
                </View>
              ) : null}

              <View style={[styles.formGridRow, { flexDirection: isDesktop ? 'row' : 'column' }]}>
                {/* Current PIN */}
                <View style={styles.formGridCol}>
                  <Text style={[styles.fieldLabel, { color: textPrimary }]}>Current Admin PIN</Text>
                  <View
                    style={[styles.fieldInputWrap, { backgroundColor: inputBg, borderColor: inputBorder }]}
                  >
                    <BootstrapIcon name="lock" size={15} color="#94A3B8" style={{ marginRight: 10 }} />
                    <TextInput
                      style={[styles.fieldTextInput, { color: textPrimary }]}
                      value={currentPin}
                      onChangeText={setCurrentPin}
                      placeholder="e.g. 2026"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      maxLength={6}
                      secureTextEntry={!showPins}
                    />
                  </View>
                </View>

                {/* New PIN */}
                <View style={styles.formGridCol}>
                  <Text style={[styles.fieldLabel, { color: textPrimary }]}>New 4–6 Digit PIN</Text>
                  <View
                    style={[styles.fieldInputWrap, { backgroundColor: inputBg, borderColor: inputBorder }]}
                  >
                    <BootstrapIcon name="key" size={15} color="#94A3B8" style={{ marginRight: 10 }} />
                    <TextInput
                      style={[styles.fieldTextInput, { color: textPrimary }]}
                      value={newPin}
                      onChangeText={setNewPin}
                      placeholder="New PIN digits"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      maxLength={6}
                      secureTextEntry={!showPins}
                    />
                  </View>
                </View>

                {/* Confirm PIN */}
                <View style={styles.formGridCol}>
                  <Text style={[styles.fieldLabel, { color: textPrimary }]}>Confirm New PIN</Text>
                  <View
                    style={[styles.fieldInputWrap, { backgroundColor: inputBg, borderColor: inputBorder }]}
                  >
                    <BootstrapIcon name="check2" size={15} color="#94A3B8" style={{ marginRight: 10 }} />
                    <TextInput
                      style={[styles.fieldTextInput, { color: textPrimary }]}
                      value={confirmPin}
                      onChangeText={setConfirmPin}
                      placeholder="Repeat new PIN"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      maxLength={6}
                      secureTextEntry={!showPins}
                    />
                  </View>
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }}>
                <TouchableOpacity
                  style={[styles.actionSubmitBtn, { alignSelf: 'flex-start' }]}
                  onPress={handleChangePin}
                  disabled={isChangingPin}
                  activeOpacity={0.85}
                >
                  {isChangingPin ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.actionSubmitBtnText}>Save Security PIN</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setShowPins(!showPins)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8 }}
                >
                  <BootstrapIcon name={showPins ? 'eye-slash' : 'eye'} size={14} color="#64748B" />
                  <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '600' }}>
                    {showPins ? 'Hide PIN digits' : 'Show digits'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 20,
    width: '100%',
  },

  // ── 1. Hero Card Styles ──
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.05)',
  },
  heroLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 20,
  },
  heroLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    flex: 1,
    minWidth: 320,
  },
  avatarContainer: {
    position: 'relative',
    width: 76,
    height: 76,
  },
  avatarSquircle: {
    width: 76,
    height: 76,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 76,
    height: 76,
  },
  avatarInitialsText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  verifiedCheckBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#10B981',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  identityDetailsWrap: {
    flex: 1,
    gap: 4,
  },
  nameAndRoleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  heroName: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  storeAdminPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 20,
  },
  storeAdminPillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#059669',
  },
  heroEmail: {
    fontSize: 13.5,
    fontWeight: '500',
  },
  avatarBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  changePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    cursor: 'pointer',
  },
  changePhotoBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  removePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    cursor: 'pointer',
  },
  removePhotoBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#DC2626',
  },

  heroRightStats: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  statCell: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    minWidth: 110,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 13.5,
    fontWeight: '700',
    marginTop: 3,
  },
  statSubtext: {
    fontSize: 11,
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 38,
  },
  sessionValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  sessionActiveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  sessionActiveText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#059669',
  },

  // ── 2. Two-Column Layout ──
  mainLayoutRow: {
    gap: 20,
    width: '100%',
  },

  // ── Settings Sidebar Card ──
  settingsNavCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.04)',
    alignSelf: 'flex-start',
  },
  settingsNavHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  settingsNavList: {
    gap: 8,
  },
  navItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
    cursor: 'pointer',
  },
  navItemBtnActive: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  navIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconBoxActive: {
    backgroundColor: '#EA580C',
  },
  navIconBoxInactive: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  navTextWrap: {
    flex: 1,
  },
  navItemTitle: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  navItemTitleActive: {
    color: '#0F172A',
    fontWeight: '700',
  },
  navItemSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },

  navBottomDivider: {
    height: 1,
    marginVertical: 16,
  },
  securityPledgeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 4,
  },
  securityPledgeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  securityPledgeSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 15,
  },

  // ── Main Content Card ──
  mainContentCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 26,
    boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.04)',
    width: '100%',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 18,
  },
  peachSectionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greenSectionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 12.5,
    marginTop: 2,
  },

  formGridRow: {
    gap: 18,
    width: '100%',
  },
  formGridCol: {
    flex: 1,
    minWidth: 240,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 6,
  },
  fieldInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 13,
    height: 44,
  },
  fieldTextInput: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '500',
    outlineStyle: 'none',
  },
  fieldHelperText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 5,
  },
  sectionDivider: {
    height: 1,
    marginVertical: 24,
  },

  // ── Administrative Access Role Card ──
  roleCardBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  roleCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
    minWidth: 260,
  },
  roleIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleTextWrap: {
    flex: 1,
  },
  roleCardHeaderLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  roleCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  roleCardDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  lockedBadgeText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },

  // ── Footer Action Row ──
  footerActionRow: {
    marginTop: 32,
    paddingTop: 18,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 14,
  },
  footerNoteText: {
    fontSize: 12,
    color: '#64748B',
  },
  saveChangesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#EA580C',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 10,
    cursor: 'pointer',
  },
  saveChangesBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  actionSubmitBtn: {
    backgroundColor: '#EA580C',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
    cursor: 'pointer',
  },
  actionSubmitBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },

  verifiedSmallPill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  verifiedSmallPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },

  strengthMeterBox: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  strengthTrack: {
    height: 5,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  strengthFill: {
    height: '100%',
    borderRadius: 3,
  },

  bannerSuccess: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bannerSuccessText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#065F46',
  },
  bannerError: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bannerErrorText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#991B1B',
  },
});
