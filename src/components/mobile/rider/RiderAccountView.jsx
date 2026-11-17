import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { BootstrapIcon } from '../../common/BootstrapIcon.jsx';
import ExternalLink from '../../common/ExternalLink.jsx';
import { RIDER_STATUSES } from '../../../services/staff/riderService.js';
import { pickImageFromFile } from '../../../utils/imagePickerHelper.js';
import { RIDER_FONT, cardShadowStyle, getInitials } from './riderTheme.js';

const HELP_TOPICS = [
  {
    id: 'qr',
    icon: 'qr-code-scan',
    title: 'Scanning & confirming drop-offs',
    body: 'Tap the racing-orange QR button or "Scan & confirm" on any active order card to scan the customer packing slip or order QR token. Once verified, confirm drop-off to immediately credit your delivery fee.',
  },
  {
    id: 'cod',
    icon: 'wallet2',
    title: 'COD collection & store remittance',
    body: 'Collect the exact COD total shown on the order card before handing over the parcel. Remit collected COD cash to the MotoTrack dispatch desk at end-of-shift.',
  },
  {
    id: 'gps',
    icon: 'geo-alt',
    title: 'Live GPS & route navigation',
    body: 'Keep location services enabled while marked "Out for Delivery" so MotoTrack dispatch and customers receive accurate arrival estimates.',
  },
];

function SettingToggleRow({
  icon,
  title,
  description,
  value,
  onToggle,
  palette,
  isLast = false,
}) {
  return (
    <TouchableOpacity
      style={[
        styles.toggleRow,
        !isLast && {
          borderBottomWidth: 1,
          borderBottomColor: palette.border,
        },
      ]}
      onPress={() => onToggle?.(!value)}
      activeOpacity={0.8}
      accessibilityRole="switch"
      accessibilityState={{ checked: Boolean(value) }}
      accessibilityLabel={title}
    >
      <View
        style={[
          styles.toggleIconBox,
          {
            backgroundColor: value ? palette.orangeSoft : palette.bgMuted,
          },
        ]}
      >
        <BootstrapIcon
          name={icon}
          size={16}
          color={value ? palette.orange : palette.textSecondary}
        />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[styles.toggleTitle, { color: palette.textPrimary }]}>
          {title}
        </Text>
        <Text style={[styles.toggleDesc, { color: palette.textMuted }]}>
          {description}
        </Text>
      </View>

      <View
        style={[
          styles.switchTrack,
          {
            backgroundColor: value
              ? palette.orange
              : palette.isDark
                ? '#3A4044'
                : '#D5D9DC',
          },
        ]}
      >
        <View
          style={[
            styles.switchThumb,
            value ? styles.switchThumbOn : styles.switchThumbOff,
          ]}
        />
      </View>
    </TouchableOpacity>
  );
}

export default function RiderAccountView({
  palette,
  accountTab = 'profile',
  onChangeAccountTab,
  currentUser,
  riderProfile,
  riderId,
  availabilityStatus,
  onSelectAvailability,
  preferences,
  onUpdatePreference,
  isDarkMode,
  onToggleDarkMode,
  onSavePersonalInfo,
  onChangePassword,
  onLogout,
  onShowFeedback,
}) {
  // Personal Information Editor State
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [avatarUri, setAvatarUri] = useState('');
  const [emailConfirmPassword, setEmailConfirmPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileBanner, setProfileBanner] = useState(null); // { type: 'success' | 'error', text }
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordBanner, setPasswordBanner] = useState(null);

  // Help Center Accordion State
  const [expandedTopic, setExpandedTopic] = useState('qr');

  const resolvedName =
    riderProfile?.name || currentUser?.name || 'Jherico Maurin';
  const resolvedPhone = riderProfile?.phone || currentUser?.phone || '';
  const resolvedEmail = currentUser?.email || riderProfile?.email || '';
  const resolvedAddress =
    preferences?.homeAddress ||
    currentUser?.address ||
    riderProfile?.notes ||
    '';
  const resolvedAvatar =
    riderProfile?.avatar || currentUser?.avatar || '';

  useEffect(() => {
    setFullName(resolvedName);
    setMobileNumber(resolvedPhone);
    setEmailAddress(resolvedEmail);
    setHomeAddress(resolvedAddress);
    setAvatarUri(resolvedAvatar);
    setEmailConfirmPassword('');
  }, [
    resolvedName,
    resolvedPhone,
    resolvedEmail,
    resolvedAddress,
    resolvedAvatar,
  ]);

  const emailChanged =
    emailAddress.trim().toLowerCase() !==
      String(resolvedEmail || '').trim().toLowerCase() &&
    Boolean(emailAddress.trim());

  const handlePickAvatar = async () => {
    const res = await pickImageFromFile();
    if (res?.success && res.uri) {
      setAvatarUri(res.uri);
      setProfileBanner({
        type: 'success',
        text: 'New rider photo staged. Tap "Save profile changes" to apply.',
      });
    }
  };

  const handleSubmitProfile = async () => {
    setProfileBanner(null);
    const cleanName = fullName.trim();
    const cleanPhone = mobileNumber.trim();
    const cleanEmail = emailAddress.trim().toLowerCase();
    const cleanAddress = homeAddress.trim();

    if (!cleanName) {
      setProfileBanner({
        type: 'error',
        text: 'Please enter your full name.',
      });
      return;
    }
    if (cleanPhone && cleanPhone.replace(/[^\d]/g, '').length < 8) {
      setProfileBanner({
        type: 'error',
        text: 'Please enter a valid mobile number.',
      });
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setProfileBanner({
        type: 'error',
        text: 'Please enter a valid email address.',
      });
      return;
    }
    if (emailChanged && !emailConfirmPassword.trim()) {
      setProfileBanner({
        type: 'error',
        text: 'Enter your current password to confirm changing your email address.',
      });
      return;
    }

    setSavingProfile(true);
    try {
      const result = await onSavePersonalInfo?.({
        name: cleanName,
        phone: cleanPhone,
        email: cleanEmail,
        emailChanged,
        currentPassword: emailConfirmPassword.trim(),
        address: cleanAddress,
        avatar: avatarUri,
      });

      if (!result?.success) {
        setProfileBanner({
          type: 'error',
          text: result?.error || 'Unable to save profile updates.',
        });
        return;
      }

      setEmailConfirmPassword('');
      setIsEditingProfile(false);
      const msg = 'Profile and personal details saved.';
      setProfileBanner({ type: 'success', text: msg });
      onShowFeedback?.(msg);
    } catch (_e) {
      setProfileBanner({
        type: 'error',
        text: 'Something went wrong while saving your profile.',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSubmitPassword = async () => {
    setPasswordBanner(null);
    if (!currentPassword.trim()) {
      setPasswordBanner({
        type: 'error',
        text: 'Enter your current password.',
      });
      return;
    }
    if (newPassword.trim().length < 8) {
      setPasswordBanner({
        type: 'error',
        text: 'New password must be at least 8 characters.',
      });
      return;
    }
    if (newPassword.trim() !== confirmPassword.trim()) {
      setPasswordBanner({
        type: 'error',
        text: 'New password and confirmation do not match.',
      });
      return;
    }

    setSavingPassword(true);
    try {
      const res = await onChangePassword?.({
        currentPassword: currentPassword.trim(),
        newPassword: newPassword.trim(),
      });
      if (!res?.success) {
        setPasswordBanner({
          type: 'error',
          text: res?.error || 'Could not update password.',
        });
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      const msg = 'Password updated successfully.';
      setPasswordBanner({ type: 'success', text: msg });
      onShowFeedback?.(msg);
    } catch (_e) {
      setPasswordBanner({
        type: 'error',
        text: 'Unable to update password right now.',
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const heroDisplayName = fullName || resolvedName || 'MotoTrack Rider';
  const heroInitials = getInitials(heroDisplayName);
  const heroOverline = `VERIFIED RIDER · ${riderId ? String(riderId).toUpperCase() : 'RDR-MOTO'}`;
  const heroSubtitleParts = [
    riderProfile?.vehicleInfo
      ? `${riderProfile.vehicleInfo}${riderProfile.plateNumber ? ` · ${riderProfile.plateNumber}` : ''}`
      : 'MotoTrack Delivery Rider',
    availabilityStatus || RIDER_STATUSES.AVAILABLE,
  ].filter(Boolean);

  const infoRows = [
    { label: 'Full name', value: heroDisplayName },
    { label: 'Phone', value: mobileNumber || 'Not set' },
    { label: 'Email', value: emailAddress || 'Not set' },
    { label: 'Address', value: homeAddress || 'Not set' },
  ];

  return (
    <View style={styles.container}>
      {/* 1. Customer-Style Dark Forest Hero Profile Card */}
      <View style={styles.heroProfileCard}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handlePickAvatar}
          accessibilityRole="button"
          accessibilityLabel="Update rider profile photo"
          style={styles.heroAvatarCircle}
        >
          {avatarUri || resolvedAvatar ? (
            <Image
              source={{ uri: avatarUri || resolvedAvatar }}
              style={styles.heroAvatarImg}
              resizeMode="cover"
            />
          ) : (
            <Text style={styles.heroAvatarInitials}>{heroInitials}</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.heroOverline} numberOfLines={1}>
          {heroOverline}
        </Text>

        <Text style={styles.heroName} numberOfLines={1}>
          {heroDisplayName}
        </Text>

        <Text style={styles.heroSubtitle} numberOfLines={1}>
          {heroSubtitleParts.join(' · ')}
        </Text>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            onChangeAccountTab?.('profile');
            setIsEditingProfile((prev) => !prev);
          }}
          style={styles.heroEditBtn}
        >
          <Text style={styles.heroEditBtnText}>
            {isEditingProfile ? 'Done editing' : 'Edit profile'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Account Tabs Segmented Control (Customer Segmented Pill Track) */}
      <View
        style={[
          styles.accountTabsTrack,
          { backgroundColor: palette.pillTrackBg || (palette.isDark ? '#1E2025' : '#EFECE6') },
        ]}
      >
        {[
          { id: 'profile', label: 'Profile', icon: 'person' },
          { id: 'preferences', label: 'Preferences', icon: 'sliders' },
          { id: 'security', label: 'Security & Help', icon: 'shield-check' },
        ].map((tab) => {
          const active = accountTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.accountTabBtn,
                active && [
                  styles.accountTabBtnActive,
                  { backgroundColor: palette.pillActiveBg || '#141D2E' },
                ],
              ]}
              onPress={() => onChangeAccountTab?.(tab.id)}
              activeOpacity={0.85}
            >
              <BootstrapIcon
                name={tab.icon}
                size={13}
                color={active ? '#FFFFFF' : palette.textMuted}
              />
              <Text
                style={[
                  styles.accountTabText,
                  {
                    color: active ? '#FFFFFF' : palette.textMuted,
                    fontWeight: active ? '600' : '500',
                  },
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ─── TAB 1: PERSONAL INFORMATION CARD (Customer Profile Style) ─── */}
      {accountTab === 'profile' ? (
        <View
          style={[
            styles.formCard,
            !palette.isDark && cardShadowStyle,
            {
              backgroundColor: palette.bgCard,
              borderColor: palette.border,
              paddingBottom: isEditingProfile ? 16 : 6,
            },
          ]}
        >
          <View
            style={[
              styles.personalInfoHeader,
              { marginBottom: isEditingProfile ? 10 : 6 },
            ]}
          >
            <Text style={[styles.cardHeading, { color: palette.textPrimary }]}>
              Personal information
            </Text>
            <TouchableOpacity
              style={[
                styles.editToggleBtn,
                {
                  borderColor: palette.borderStrong,
                  backgroundColor: isEditingProfile
                    ? palette.bgMuted
                    : palette.bgCard,
                },
              ]}
              onPress={() => setIsEditingProfile((prev) => !prev)}
              activeOpacity={0.75}
            >
              <Text
                style={[styles.editToggleText, { color: palette.textPrimary }]}
              >
                {isEditingProfile ? 'Cancel' : 'Edit'}
              </Text>
            </TouchableOpacity>
          </View>

          {!isEditingProfile ? (
            <View>
              {infoRows.map((row, idx) => (
                <View
                  key={row.label}
                  style={[
                    styles.infoRow,
                    idx < infoRows.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: palette.borderSubtle,
                    },
                  ]}
                >
                  <Text
                    style={[styles.infoRowLabel, { color: palette.textMuted }]}
                  >
                    {row.label}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.infoRowValue,
                      { color: palette.textPrimary },
                    ]}
                  >
                    {row.value}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <>
              <Text
                style={[styles.cardSubheading, { color: palette.textMuted }]}
              >
                Keep your rider contact details accurate for dispatch and customers.
              </Text>

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
              Full name
            </Text>
            <View
              style={[
                styles.inputWrap,
                {
                  backgroundColor: palette.bgInput,
                  borderColor: palette.borderStrong,
                },
              ]}
            >
              <BootstrapIcon
                name="person"
                size={15}
                color={palette.textMuted}
              />
              <TextInput
                style={[styles.inputField, { color: palette.textPrimary }]}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter your full name"
                placeholderTextColor={palette.textSubtle}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
              Mobile number
            </Text>
            <View
              style={[
                styles.inputWrap,
                {
                  backgroundColor: palette.bgInput,
                  borderColor: palette.borderStrong,
                },
              ]}
            >
              <BootstrapIcon
                name="telephone"
                size={15}
                color={palette.textMuted}
              />
              <TextInput
                style={[
                  styles.inputField,
                  {
                    color: palette.textPrimary,
                    fontVariant: ['tabular-nums'],
                  },
                ]}
                value={mobileNumber}
                onChangeText={setMobileNumber}
                keyboardType="phone-pad"
                placeholder="0917 123 4567"
                placeholderTextColor={palette.textSubtle}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
              Email address
            </Text>
            <View
              style={[
                styles.inputWrap,
                {
                  backgroundColor: palette.bgInput,
                  borderColor: palette.borderStrong,
                },
              ]}
            >
              <BootstrapIcon
                name="envelope"
                size={15}
                color={palette.textMuted}
              />
              <TextInput
                style={[styles.inputField, { color: palette.textPrimary }]}
                value={emailAddress}
                onChangeText={setEmailAddress}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="rider@mototrack.com"
                placeholderTextColor={palette.textSubtle}
              />
            </View>
          </View>

          {emailChanged ? (
            <View style={styles.fieldGroup}>
              <Text
                style={[styles.fieldLabel, { color: palette.orangeText }]}
              >
                Current password (required to change email)
              </Text>
              <View
                style={[
                  styles.inputWrap,
                  {
                    backgroundColor: palette.bgInput,
                    borderColor: palette.orangeBorder,
                  },
                ]}
              >
                <BootstrapIcon name="lock" size={15} color={palette.orange} />
                <TextInput
                  style={[styles.inputField, { color: palette.textPrimary }]}
                  value={emailConfirmPassword}
                  onChangeText={setEmailConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  placeholder="Verify current password"
                  placeholderTextColor={palette.textSubtle}
                />
              </View>
            </View>
          ) : null}

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
              Home address
            </Text>
            <View
              style={[
                styles.inputWrap,
                styles.textAreaWrap,
                {
                  backgroundColor: palette.bgInput,
                  borderColor: palette.borderStrong,
                },
              ]}
            >
              <BootstrapIcon
                name="house"
                size={15}
                color={palette.textMuted}
                style={{ marginTop: 3 }}
              />
              <TextInput
                style={[
                  styles.inputField,
                  styles.textAreaInput,
                  { color: palette.textPrimary },
                ]}
                value={homeAddress}
                onChangeText={setHomeAddress}
                multiline
                placeholder="Street, Barangay, City / Municipality"
                placeholderTextColor={palette.textSubtle}
              />
            </View>
          </View>

          {profileBanner ? (
            <View
              style={[
                styles.feedbackBanner,
                {
                  backgroundColor:
                    profileBanner.type === 'error'
                      ? palette.dangerSoft
                      : palette.successSoft,
                  borderColor:
                    profileBanner.type === 'error'
                      ? palette.dangerBorder
                      : palette.successBorder,
                },
              ]}
            >
              <BootstrapIcon
                name={
                  profileBanner.type === 'error'
                    ? 'exclamation-circle'
                    : 'check-circle-fill'
                }
                size={15}
                color={
                  profileBanner.type === 'error'
                    ? palette.dangerText
                    : palette.successText
                }
              />
              <Text
                style={[
                  styles.feedbackBannerText,
                  {
                    color:
                      profileBanner.type === 'error'
                        ? palette.dangerText
                        : palette.successText,
                  },
                ]}
              >
                {profileBanner.text}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[
              styles.primarySaveBtn,
              {
                backgroundColor: palette.orange,
                opacity: savingProfile ? 0.7 : 1,
              },
            ]}
            disabled={savingProfile}
            onPress={handleSubmitProfile}
            activeOpacity={0.85}
          >
            {savingProfile ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <BootstrapIcon name="check" size={16} color="#FFFFFF" />
                <Text style={styles.primarySaveBtnText}>
                  Save profile changes
                </Text>
              </>
            )}
          </TouchableOpacity>
            </>
          )}
        </View>
      ) : null}

      {/* ─── TAB 2: NOTIFICATION & DISPLAY PREFERENCES ─── */}
      {accountTab === 'preferences' ? (
        <View
          style={[
            styles.formCard,
            !palette.isDark && cardShadowStyle,
            {
              backgroundColor: palette.bgCard,
              borderColor: palette.border,
            },
          ]}
        >
          <Text style={[styles.cardHeading, { color: palette.textPrimary }]}>
            App & alert preferences
          </Text>
          <Text style={[styles.cardSubheading, { color: palette.textMuted }]}>
            Control how MotoTrack notifies you while on the road.
          </Text>

          <View style={styles.togglesList}>
            <SettingToggleRow
              icon="bell"
              title="Push & dispatch notifications"
              description="Instant alerts for new assigned deliveries and route changes"
              value={Boolean(preferences?.pushNotifications)}
              onToggle={(val) =>
                onUpdatePreference?.(
                  'pushNotifications',
                  val,
                  `Dispatch notifications ${val ? 'enabled' : 'muted'}.`
                )
              }
              palette={palette}
            />

            <SettingToggleRow
              icon="envelope"
              title="Email delivery updates"
              description="Receive email alerts for urgent COD dispatches and customer notes"
              value={Boolean(preferences?.emailUpdates ?? preferences?.smsUpdates)}
              onToggle={(val) =>
                onUpdatePreference?.(
                  'emailUpdates',
                  val,
                  `Email delivery updates ${val ? 'enabled' : 'disabled'}.`
                )
              }
              palette={palette}
            />

            <SettingToggleRow
              icon="moon"
              title="Dark mode"
              description="High-contrast charcoal interface for night riding"
              value={Boolean(isDarkMode)}
              onToggle={(val) => {
                onToggleDarkMode?.(val);
                onShowFeedback?.(
                  `Dark mode ${val ? 'enabled' : 'disabled'}.`
                );
              }}
              palette={palette}
              isLast
            />
          </View>
        </View>
      ) : null}

      {/* ─── TAB 3: SECURITY, 2FA & HELP CENTER ─── */}
      {accountTab === 'security' ? (
        <>
          {/* Two-Step Verification Card */}
          <View
            style={[
              styles.formCard,
              !palette.isDark && cardShadowStyle,
              {
                backgroundColor: palette.bgCard,
                borderColor: palette.border,
              },
            ]}
          >
            <View style={styles.twoFactorHead}>
              <Text
                style={[styles.cardHeading, { color: palette.textPrimary }]}
              >
                Two-step verification
              </Text>
              <View
                style={[
                  styles.twoFactorBadge,
                  {
                    backgroundColor: preferences?.twoFactorEnabled
                      ? palette.successSoft
                      : palette.bgMuted,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.twoFactorBadgeText,
                    {
                      color: preferences?.twoFactorEnabled
                        ? palette.successText
                        : palette.textMuted,
                    },
                  ]}
                >
                  {preferences?.twoFactorEnabled ? 'Protected' : 'Off'}
                </Text>
              </View>
            </View>

            <SettingToggleRow
              icon="shield-check"
              title="Require 2-step login verification"
              description="Protect your MotoTrack rider payouts and account with email OTP verification on new devices"
              value={Boolean(preferences?.twoFactorEnabled)}
              onToggle={(val) =>
                onUpdatePreference?.(
                  'twoFactorEnabled',
                  val,
                  `Two-step verification ${val ? 'enabled' : 'turned off'}.`
                )
              }
              palette={palette}
              isLast
            />
          </View>

          {/* Password Management Card */}
          <View
            style={[
              styles.formCard,
              !palette.isDark && cardShadowStyle,
              {
                backgroundColor: palette.bgCard,
                borderColor: palette.border,
              },
            ]}
          >
            <View style={styles.pwdHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.cardHeading, { color: palette.textPrimary }]}
                >
                  Password management
                </Text>
                <Text
                  style={[styles.cardSubheading, { color: palette.textMuted }]}
                >
                  Use a strong password of at least 8 characters.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowPasswords((v) => !v)}
                style={[
                  styles.eyeToggleBtn,
                  { backgroundColor: palette.bgMuted },
                ]}
                activeOpacity={0.75}
              >
                <BootstrapIcon
                  name={showPasswords ? 'eye-slash' : 'eye'}
                  size={15}
                  color={palette.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.fieldGroup}>
              <Text
                style={[styles.fieldLabel, { color: palette.textSecondary }]}
              >
                Current password
              </Text>
              <View
                style={[
                  styles.inputWrap,
                  {
                    backgroundColor: palette.bgInput,
                    borderColor: palette.borderStrong,
                  },
                ]}
              >
                <BootstrapIcon
                  name="lock"
                  size={15}
                  color={palette.textMuted}
                />
                <TextInput
                  style={[styles.inputField, { color: palette.textPrimary }]}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry={!showPasswords}
                  autoCapitalize="none"
                  placeholder="Enter current password"
                  placeholderTextColor={palette.textSubtle}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text
                style={[styles.fieldLabel, { color: palette.textSecondary }]}
              >
                New password
              </Text>
              <View
                style={[
                  styles.inputWrap,
                  {
                    backgroundColor: palette.bgInput,
                    borderColor: palette.borderStrong,
                  },
                ]}
              >
                <BootstrapIcon name="key" size={15} color={palette.textMuted} />
                <TextInput
                  style={[styles.inputField, { color: palette.textPrimary }]}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showPasswords}
                  autoCapitalize="none"
                  placeholder="Minimum 8 characters"
                  placeholderTextColor={palette.textSubtle}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text
                style={[styles.fieldLabel, { color: palette.textSecondary }]}
              >
                Confirm new password
              </Text>
              <View
                style={[
                  styles.inputWrap,
                  {
                    backgroundColor: palette.bgInput,
                    borderColor: palette.borderStrong,
                  },
                ]}
              >
                <BootstrapIcon name="key" size={15} color={palette.textMuted} />
                <TextInput
                  style={[styles.inputField, { color: palette.textPrimary }]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPasswords}
                  autoCapitalize="none"
                  placeholder="Re-enter new password"
                  placeholderTextColor={palette.textSubtle}
                />
              </View>
            </View>

            {passwordBanner ? (
              <View
                style={[
                  styles.feedbackBanner,
                  {
                    backgroundColor:
                      passwordBanner.type === 'error'
                        ? palette.dangerSoft
                        : palette.successSoft,
                    borderColor:
                      passwordBanner.type === 'error'
                        ? palette.dangerBorder
                        : palette.successBorder,
                  },
                ]}
              >
                <BootstrapIcon
                  name={
                    passwordBanner.type === 'error'
                      ? 'exclamation-circle'
                      : 'check-circle-fill'
                  }
                  size={15}
                  color={
                    passwordBanner.type === 'error'
                      ? palette.dangerText
                      : palette.successText
                  }
                />
                <Text
                  style={[
                    styles.feedbackBannerText,
                    {
                      color:
                        passwordBanner.type === 'error'
                          ? palette.dangerText
                          : palette.successText,
                    },
                  ]}
                >
                  {passwordBanner.text}
                </Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[
                styles.primarySaveBtn,
                {
                  backgroundColor: palette.charcoal,
                  opacity: savingPassword ? 0.7 : 1,
                },
              ]}
              disabled={savingPassword}
              onPress={handleSubmitPassword}
              activeOpacity={0.85}
            >
              {savingPassword ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primarySaveBtnText}>Update password</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Help Center Card */}
          <View
            style={[
              styles.formCard,
              !palette.isDark && cardShadowStyle,
              {
                backgroundColor: palette.bgCard,
                borderColor: palette.border,
              },
            ]}
          >
            <Text style={[styles.cardHeading, { color: palette.textPrimary }]}>
              Rider help center
            </Text>
            <Text style={[styles.cardSubheading, { color: palette.textMuted }]}>
              Quick answers and direct MotoTrack dispatch support.
            </Text>

            <View style={{ marginTop: 10, gap: 8 }}>
              {HELP_TOPICS.map((topic) => {
                const open = expandedTopic === topic.id;
                return (
                  <TouchableOpacity
                    key={topic.id}
                    style={[
                      styles.helpAccordion,
                      {
                        backgroundColor: palette.bgMuted,
                        borderColor: open
                          ? palette.orangeBorder
                          : palette.border,
                      },
                    ]}
                    onPress={() =>
                      setExpandedTopic((prev) =>
                        prev === topic.id ? '' : topic.id
                      )
                    }
                    activeOpacity={0.8}
                  >
                    <View style={styles.helpAccordionHead}>
                      <BootstrapIcon
                        name={topic.icon}
                        size={15}
                        color={palette.orange}
                      />
                      <Text
                        style={[
                          styles.helpAccordionTitle,
                          { color: palette.textPrimary },
                        ]}
                      >
                        {topic.title}
                      </Text>
                      <BootstrapIcon
                        name={open ? 'chevron-up' : 'chevron-down'}
                        size={14}
                        color={palette.textMuted}
                      />
                    </View>
                    {open ? (
                      <Text
                        style={[
                          styles.helpAccordionBody,
                          { color: palette.textSecondary },
                        ]}
                      >
                        {topic.body}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.supportActionsRow}>
              <ExternalLink href="tel:+639179990001" style={{ flex: 1 }}>
                <View
                  style={[
                    styles.supportBtn,
                    {
                      borderColor: palette.borderStrong,
                      backgroundColor: palette.bgCard,
                    },
                  ]}
                >
                  <BootstrapIcon
                    name="telephone"
                    size={14}
                    color={palette.textPrimary}
                  />
                  <Text
                    style={[
                      styles.supportBtnText,
                      { color: palette.textPrimary },
                    ]}
                  >
                    Call dispatch
                  </Text>
                </View>
              </ExternalLink>

              <ExternalLink
                href="mailto:support@mototrack.com"
                style={{ flex: 1 }}
              >
                <View
                  style={[
                    styles.supportBtn,
                    {
                      borderColor: palette.borderStrong,
                      backgroundColor: palette.bgCard,
                    },
                  ]}
                >
                  <BootstrapIcon
                    name="envelope"
                    size={14}
                    color={palette.textPrimary}
                  />
                  <Text
                    style={[
                      styles.supportBtnText,
                      { color: palette.textPrimary },
                    ]}
                  >
                    Email support
                  </Text>
                </View>
              </ExternalLink>
            </View>
          </View>
        </>
      ) : null}

      {/* Persistent Sign-Out Action */}
      <TouchableOpacity
        style={[
          styles.signOutBtn,
          {
            backgroundColor: palette.bgCard,
            borderColor: palette.dangerBorder,
          },
        ]}
        onPress={onLogout}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Sign out of MotoTrack"
      >
        <BootstrapIcon
          name="box-arrow-right"
          size={16}
          color={palette.danger}
        />
        <Text style={[styles.signOutBtnText, { color: palette.danger }]}>
          Sign out of MotoTrack
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 14,
  },
  heroProfileCard: {
    backgroundColor: '#152923',
    borderColor: '#1E3730',
    borderWidth: 1,
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  heroAvatarCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#EA580C',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatarImg: {
    width: '100%',
    height: '100%',
  },
  heroAvatarInitials: {
    fontFamily: RIDER_FONT,
    fontSize: 25,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  heroOverline: {
    fontFamily: RIDER_FONT,
    marginTop: 14,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#6BB39B',
    textTransform: 'uppercase',
  },
  heroName: {
    fontFamily: RIDER_FONT,
    marginTop: 5,
    fontSize: 21,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontFamily: RIDER_FONT,
    marginTop: 4,
    fontSize: 12.5,
    fontWeight: '400',
    color: '#B5C5BF',
    textAlign: 'center',
  },
  heroEditBtn: {
    marginTop: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEditBtnText: {
    fontFamily: RIDER_FONT,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#18181B',
  },
  personalInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editToggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  editToggleText: {
    fontFamily: RIDER_FONT,
    fontSize: 12,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 13,
  },
  infoRowLabel: {
    fontFamily: RIDER_FONT,
    fontSize: 13,
    fontWeight: '400',
  },
  infoRowValue: {
    fontFamily: RIDER_FONT,
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'right',
  },
  identityCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
  },
  identityTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarEditWrap: {
    position: 'relative',
  },
  cameraBadgeBtn: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  riderFullName: {
    fontFamily: RIDER_FONT,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700',
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  badgesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 999,
    borderWidth: 1,
  },
  verifiedBadgeText: {
    fontFamily: RIDER_FONT,
    fontSize: 11,
    fontWeight: '600',
  },
  riderIdPill: {
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 999,
  },
  riderIdPillText: {
    fontFamily: RIDER_FONT,
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 7,
  },
  vehicleText: {
    fontFamily: RIDER_FONT,
    fontSize: 12,
    fontWeight: '500',
    flexShrink: 1,
  },
  availabilityBlock: {
    marginTop: 14,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  availabilityCaption: {
    fontFamily: RIDER_FONT,
    fontSize: 10.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 9,
  },
  availabilityPillsRow: {
    flexDirection: 'row',
    gap: 7,
  },
  availPill: {
    flex: 1,
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 6,
  },
  availDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  availPillText: {
    fontFamily: RIDER_FONT,
    fontSize: 11.5,
    fontWeight: '600',
  },
  accountTabsTrack: {
    flexDirection: 'row',
    borderRadius: 9999,
    padding: 4,
    gap: 4,
  },
  accountTabBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 6,
  },
  accountTabBtnActive: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  accountTabText: {
    fontFamily: RIDER_FONT,
    fontSize: 12.5,
  },
  formCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
  },
  cardHeading: {
    fontFamily: RIDER_FONT,
    fontSize: 16.5,
    lineHeight: 22,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  cardSubheading: {
    fontFamily: RIDER_FONT,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '400',
    marginTop: 2,
  },
  fieldGroup: {
    marginTop: 13,
  },
  fieldLabel: {
    fontFamily: RIDER_FONT,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 13,
  },
  textAreaWrap: {
    alignItems: 'flex-start',
    paddingVertical: 10,
    minHeight: 74,
  },
  inputField: {
    flex: 1,
    fontFamily: RIDER_FONT,
    fontSize: 13.5,
    fontWeight: '400',
    paddingVertical: 8,
  },
  textAreaInput: {
    paddingVertical: 0,
    minHeight: 48,
    textAlignVertical: 'top',
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 14,
  },
  feedbackBannerText: {
    flex: 1,
    fontFamily: RIDER_FONT,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '500',
  },
  primarySaveBtn: {
    minHeight: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  primarySaveBtnText: {
    fontFamily: RIDER_FONT,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  togglesList: {
    marginTop: 10,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
  },
  toggleIconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleTitle: {
    fontFamily: RIDER_FONT,
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '600',
  },
  toggleDesc: {
    fontFamily: RIDER_FONT,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    marginTop: 2,
  },
  switchTrack: {
    width: 46,
    height: 27,
    borderRadius: 14,
    padding: 3,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
  },
  switchThumbOn: {
    alignSelf: 'flex-end',
  },
  switchThumbOff: {
    alignSelf: 'flex-start',
  },
  twoFactorHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  twoFactorBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  twoFactorBadgeText: {
    fontFamily: RIDER_FONT,
    fontSize: 11,
    fontWeight: '600',
  },
  pwdHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  eyeToggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpAccordion: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  helpAccordionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  helpAccordionTitle: {
    flex: 1,
    fontFamily: RIDER_FONT,
    fontSize: 13,
    fontWeight: '600',
  },
  helpAccordionBody: {
    fontFamily: RIDER_FONT,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '400',
    marginTop: 8,
  },
  supportActionsRow: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 12,
  },
  supportBtn: {
    minHeight: 42,
    borderRadius: 11,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  supportBtnText: {
    fontFamily: RIDER_FONT,
    fontSize: 12.5,
    fontWeight: '600',
  },
  signOutBtn: {
    minHeight: 48,
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 6,
  },
  signOutBtnText: {
    fontFamily: RIDER_FONT,
    fontSize: 13.5,
    fontWeight: '600',
  },
});

