import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { BootstrapIcon } from '../../common/BootstrapIcon.jsx';
import ExternalLink from '../../common/ExternalLink.jsx';
import { RIDER_STATUSES } from '../../../services/staff/riderService.js';
import { pickImageFromFile } from '../../../utils/imagePickerHelper.js';
import { RiderAvatar } from './RiderHeaderAndMenus.jsx';
import { RIDER_FONT, cardShadowStyle } from './riderTheme.js';

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

  const availabilityOptions = [
    RIDER_STATUSES.AVAILABLE,
    RIDER_STATUSES.ON_DELIVERY,
    RIDER_STATUSES.OFF_DUTY,
  ];

  return (
    <View style={styles.container}>
      {/* Rider Identity & Availability Hero Card */}
      <View
        style={[
          styles.identityCard,
          !palette.isDark && cardShadowStyle,
          {
            backgroundColor: palette.bgCard,
            borderColor: palette.border,
          },
        ]}
      >
        <View style={styles.identityTopRow}>
          <View style={styles.avatarEditWrap}>
            <RiderAvatar
              uri={avatarUri || resolvedAvatar}
              name={fullName || resolvedName}
              size={62}
              palette={palette}
            />
            <TouchableOpacity
              style={[
                styles.cameraBadgeBtn,
                {
                  backgroundColor: palette.orange,
                  borderColor: palette.bgCard,
                },
              ]}
              onPress={handlePickAvatar}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Update rider avatar"
            >
              <BootstrapIcon name="camera" size={12} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1 }}>
            <View style={styles.nameBadgeRow}>
              <Text
                style={[styles.riderFullName, { color: palette.textPrimary }]}
                numberOfLines={1}
              >
                {fullName || resolvedName}
              </Text>
            </View>

            <View style={styles.badgesWrap}>
              <View
                style={[
                  styles.verifiedBadge,
                  {
                    backgroundColor: palette.orangeSoft,
                    borderColor: palette.orangeBorder,
                  },
                ]}
              >
                <BootstrapIcon
                  name="patch-check-fill"
                  size={12}
                  color={palette.orange}
                />
                <Text
                  style={[
                    styles.verifiedBadgeText,
                    { color: palette.orangeText },
                  ]}
                >
                  Verified Rider
                </Text>
              </View>

              <View
                style={[
                  styles.riderIdPill,
                  { backgroundColor: palette.bgMuted },
                ]}
              >
                <Text
                  style={[
                    styles.riderIdPillText,
                    { color: palette.textSecondary },
                  ]}
                >
                  ID: {riderId ? String(riderId).toUpperCase() : 'RDR-MOTO'}
                </Text>
              </View>
            </View>

            {riderProfile?.vehicleInfo ? (
              <View style={styles.vehicleRow}>
                <BootstrapIcon
                  name="motorcycle"
                  size={13}
                  color={palette.textMuted}
                />
                <Text
                  style={[styles.vehicleText, { color: palette.textMuted }]}
                  numberOfLines={1}
                >
                  {riderProfile.vehicleInfo}
                  {riderProfile.plateNumber
                    ? ` · ${riderProfile.plateNumber}`
                    : ''}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Availability Status Control */}
        <View
          style={[
            styles.availabilityBlock,
            {
              backgroundColor: palette.bgMuted,
              borderColor: palette.border,
            },
          ]}
        >
          <Text
            style={[styles.availabilityCaption, { color: palette.textMuted }]}
          >
            Availability status
          </Text>
          <View style={styles.availabilityPillsRow}>
            {availabilityOptions.map((opt) => {
              const selected =
                String(availabilityStatus || RIDER_STATUSES.AVAILABLE).toLowerCase() ===
                opt.toLowerCase();
              const dotColor =
                opt === RIDER_STATUSES.AVAILABLE
                  ? '#16A34A'
                  : opt === RIDER_STATUSES.ON_DELIVERY
                    ? palette.orange
                    : palette.textSubtle;

              return (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.availPill,
                    {
                      backgroundColor: selected
                        ? palette.charcoal
                        : palette.bgCard,
                      borderColor: selected
                        ? palette.charcoal
                        : palette.borderStrong,
                    },
                  ]}
                  onPress={() => onSelectAvailability?.(opt)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.availDot,
                      {
                        backgroundColor: selected ? '#FF4D00' : dotColor,
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.availPillText,
                      {
                        color: selected ? '#FFFFFF' : palette.textSecondary,
                      },
                    ]}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      {/* Account Tabs Segmented Control */}
      <View
        style={[
          styles.accountTabsTrack,
          { backgroundColor: palette.isDark ? palette.bgCard : '#ECEEF0' },
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
                  { backgroundColor: palette.bgSheet },
                ],
              ]}
              onPress={() => onChangeAccountTab?.(tab.id)}
              activeOpacity={0.8}
            >
              <BootstrapIcon
                name={tab.icon}
                size={13}
                color={active ? palette.orange : palette.textMuted}
              />
              <Text
                style={[
                  styles.accountTabText,
                  {
                    color: active ? palette.textPrimary : palette.textMuted,
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

      {/* ─── TAB 1: PERSONAL INFORMATION EDITOR ─── */}
      {accountTab === 'profile' ? (
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
            Personal information
          </Text>
          <Text style={[styles.cardSubheading, { color: palette.textMuted }]}>
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
              icon="chat-dots"
              title="SMS delivery updates"
              description="Receive text alerts for urgent COD dispatches and customer notes"
              value={Boolean(preferences?.smsUpdates)}
              onToggle={(val) =>
                onUpdatePreference?.(
                  'smsUpdates',
                  val,
                  `SMS delivery updates ${val ? 'enabled' : 'disabled'}.`
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
    paddingTop: 14,
    gap: 14,
  },
  identityCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 15,
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
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    letterSpacing: -0.2,
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
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  verifiedBadgeText: {
    fontFamily: RIDER_FONT,
    fontSize: 11,
    fontWeight: '600',
  },
  riderIdPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
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
    padding: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  availabilityCaption: {
    fontFamily: RIDER_FONT,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  availabilityPillsRow: {
    flexDirection: 'row',
    gap: 7,
  },
  availPill: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
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
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  accountTabBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 6,
  },
  accountTabBtnActive: {
    shadowColor: '#202426',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  accountTabText: {
    fontFamily: RIDER_FONT,
    fontSize: 12,
  },
  formCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 15,
  },
  cardHeading: {
    fontFamily: RIDER_FONT,
    fontSize: 15.5,
    lineHeight: 21,
    fontWeight: '600',
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
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 12,
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
    borderRadius: 11,
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
    borderRadius: 12,
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

