import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { BootstrapIcon } from '../../common/BootstrapIcon.jsx';
import ExternalLink from '../../common/ExternalLink.jsx';
import { RIDER_STATUSES } from '../../../services/staff/riderService.js';
import { pickImageFromFile } from '../../../utils/imagePickerHelper.js';
import { fontFamily } from '../../../styles/typography.js';

const HELP_TOPICS = [
  {
    id: 'qr',
    icon: 'qr-code-scan',
    title: 'Scanning & confirming drop-offs',
    body: 'Use "Scan QR" on any active order card to verify the customer packing slip or order QR token. Once verified, confirm drop-off to immediately credit your delivery fee.',
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

/**
 * Palette aligned with MotoTrack Admin Dashboard (admin.web.styles.js / AdminSystemSettingsPanel.jsx).
 */
function getAdminStylePalette(isDark = false) {
  if (isDark) {
    return {
      isDark: true,
      orange: '#EA580C',
      orangeSoft: 'rgba(234, 88, 12, 0.15)',
      orangeBorder: 'rgba(234, 88, 12, 0.35)',
      orangeText: '#FB923C',
      charcoal: '#24272B',
      bgCanvas: '#111315',
      bgCard: '#18181B',
      bgStrip: '#202225',
      bgSub: '#202225',
      bgInput: '#141619',
      border: 'rgba(255, 255, 255, 0.08)',
      borderInput: 'rgba(255, 255, 255, 0.14)',
      textPrimary: '#F8FAFC',
      textSecondary: '#CBD5E1',
      textMuted: '#A1A1AA',
      textSubtle: '#71717A',
      successSoft: 'rgba(16, 185, 129, 0.14)',
      successBorder: 'rgba(16, 185, 129, 0.32)',
      successText: '#4ADE80',
      danger: '#F87171',
      dangerSoft: 'rgba(239, 68, 68, 0.14)',
      dangerBorder: 'rgba(239, 68, 68, 0.30)',
      dangerText: '#FCA5A5',
    };
  }
  return {
    isDark: false,
    orange: '#EA580C',
    orangeSoft: '#FFF7ED',
    orangeBorder: '#FED7AA',
    orangeText: '#EA580C',
    charcoal: '#24272B',
    bgCanvas: '#F3F4F6',
    bgCard: '#FFFFFF',
    bgStrip: '#F8F9FA',
    bgSub: '#F8FAFC',
    bgInput: '#FFFFFF',
    border: '#E4E4E7',
    borderInput: '#CBD5E1',
    textPrimary: '#0F172A',
    textSecondary: '#334155',
    textMuted: '#64748B',
    textSubtle: '#94A3B8',
    successSoft: '#DCFCE7',
    successBorder: '#86EFAC',
    successText: '#166534',
    danger: '#DC2626',
    dangerSoft: '#FEE2E2',
    dangerBorder: '#FECACA',
    dangerText: '#B91C1C',
  };
}

/**
 * Admin-style Section Header (matches AdminSystemSettingsPanel SectionHeader).
 */
function AdminSectionHeader({ icon, title, subtitle, rightSlot, palette }) {
  return (
    <View
      style={[
        styles.sectionStripHeader,
        {
          backgroundColor: palette.bgStrip,
          borderBottomColor: palette.border,
        },
      ]}
    >
      <View style={styles.sectionStripLeft}>
        <View
          style={[
            styles.sectionIconBox,
            { backgroundColor: palette.orangeSoft },
          ]}
        >
          <BootstrapIcon name={icon} size={18} color="#EA580C" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={[styles.sectionTitle, { color: palette.textPrimary }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[styles.sectionSubtitle, { color: palette.textMuted }]}
              numberOfLines={2}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {rightSlot || null}
    </View>
  );
}

/**
 * Admin-style Toggle Field Card (matches AdminSystemSettingsPanel ToggleSettingField).
 */
function AdminToggleTile({
  title,
  icon = 'gear',
  description,
  value,
  onToggle,
  palette,
}) {
  const isOn = Boolean(value);
  return (
    <View
      style={[
        styles.toggleTile,
        {
          backgroundColor: palette.bgCard,
          borderColor: palette.border,
        },
      ]}
    >
      <Text style={[styles.tileOverline, { color: palette.textMuted }]}>
        {title}
      </Text>

      <View style={styles.tileMainRow}>
        <View style={styles.tileIconTitle}>
          <View
            style={[
              styles.tileIconBadge,
              {
                backgroundColor: isOn ? palette.orangeSoft : palette.bgSub,
                borderColor: isOn ? palette.orangeBorder : palette.border,
              },
            ]}
          >
            <BootstrapIcon
              name={icon}
              size={15}
              color={isOn ? '#EA580C' : palette.textMuted}
            />
          </View>
          <Text
            style={[
              styles.tileStatusText,
              { color: palette.textPrimary },
            ]}
          >
            {isOn ? 'Enabled' : 'Disabled'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => onToggle?.(!isOn)}
          activeOpacity={0.85}
          accessibilityRole="switch"
          accessibilityState={{ checked: isOn }}
          accessibilityLabel={`${title} ${isOn ? 'enabled' : 'disabled'}`}
          style={[
            styles.switchTrack,
            {
              backgroundColor: isOn
                ? '#EA580C'
                : palette.isDark
                  ? '#3A4044'
                  : '#CBD5E1',
              alignItems: isOn ? 'flex-end' : 'flex-start',
            },
          ]}
        >
          <View style={styles.switchThumb} />
        </TouchableOpacity>
      </View>

      {description ? (
        <Text style={[styles.tileDesc, { color: palette.textMuted }]}>
          {description}
        </Text>
      ) : null}
    </View>
  );
}

export default function RiderAccountWebView({
  accountTab = 'profile',
  onChangeAccountTab,
  currentUser,
  riderProfile,
  riderId,
  availabilityStatus,
  onSelectAvailability,
  preferences,
  onUpdatePreference,
  isDarkMode = false,
  onToggleDarkMode,
  onSavePersonalInfo,
  onChangePassword,
  onLogout,
  onShowFeedback,
}) {
  const { width } = useWindowDimensions();
  const isCompact = width < 960;
  const isNarrow = width < 640;
  const palette = getAdminStylePalette(isDarkMode);

  // Personal Information Editor State
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [avatarUri, setAvatarUri] = useState('');
  const [emailConfirmPassword, setEmailConfirmPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileBanner, setProfileBanner] = useState(null);

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
    riderProfile?.name || currentUser?.name || currentUser?.fullName || 'Rider';
  const resolvedPhone = riderProfile?.phone || currentUser?.phone || '';
  const resolvedEmail = currentUser?.email || riderProfile?.email || '';
  const resolvedAddress =
    preferences?.homeAddress ||
    currentUser?.address ||
    riderProfile?.notes ||
    '';
  const resolvedAvatar =
    riderProfile?.avatar || currentUser?.avatar || currentUser?.photoUri || '';

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
        text: 'New rider photo staged. Click "Save Profile Changes" to apply.',
      });
    } else if (
      res?.error &&
      res.error !== 'No file selected' &&
      res.error !== 'Selection cancelled'
    ) {
      setProfileBanner({ type: 'error', text: res.error });
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

  const displayedAvatar = avatarUri || resolvedAvatar;
  const displayedName = fullName || resolvedName;
  const initialLetter = String(displayedName || 'R').charAt(0).toUpperCase();

  return (
    <View style={styles.container}>
      {/* ─── 1. ADMIN-STYLE TOP HEADER CARD (Matches AdminSystemSettingsPanel) ─── */}
      <View
        style={[
          styles.adminCard,
          styles.headerCardBody,
          {
            backgroundColor: palette.bgCard,
            borderColor: palette.border,
          },
        ]}
      >
        <View
          style={[
            styles.headerTopRow,
            isCompact && { flexDirection: 'column', alignItems: 'stretch' },
          ]}
        >
          {/* Left: Avatar + Identity + Admin Tag Pill */}
          <View style={styles.identityRow}>
            <View style={styles.avatarWrap}>
              {displayedAvatar ? (
                <Image
                  source={{ uri: displayedAvatar }}
                  style={[styles.avatarImage, { borderColor: '#EA580C' }]}
                />
              ) : (
                <View
                  style={[
                    styles.avatarFallback,
                    {
                      backgroundColor: '#24272B',
                      borderColor: '#EA580C',
                    },
                  ]}
                >
                  <Text style={styles.avatarFallbackText}>{initialLetter}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.cameraBtn,
                  {
                    backgroundColor: '#EA580C',
                    borderColor: palette.bgCard,
                  },
                ]}
                onPress={handlePickAvatar}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Update rider avatar"
              >
                <BootstrapIcon name="camera" size={11} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.titleTagRow}>
                <Text
                  style={[styles.pageTitle, { color: palette.textPrimary }]}
                  numberOfLines={1}
                >
                  {displayedName}
                </Text>
                <View
                  style={[
                    styles.adminTagBadge,
                    {
                      backgroundColor: palette.orangeSoft,
                      borderColor: palette.orangeBorder,
                    },
                  ]}
                >
                  <BootstrapIcon
                    name="patch-check-fill"
                    size={11}
                    color="#EA580C"
                  />
                  <Text style={styles.adminTagBadgeText}>Verified Rider</Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <Text
                  style={[styles.idText, { color: palette.textMuted }]}
                  numberOfLines={1}
                >
                  ID: {riderId ? String(riderId).toUpperCase() : 'RDR-MOTO'}
                </Text>
                <View style={styles.metaDot} />
                <View style={styles.metaItem}>
                  <BootstrapIcon
                    name="motorcycle"
                    size={13}
                    color={palette.textMuted}
                  />
                  <Text
                    style={[styles.metaText, { color: palette.textMuted }]}
                    numberOfLines={1}
                  >
                    {riderProfile?.vehicleInfo || 'Motorcycle'}
                    {riderProfile?.plateNumber
                      ? ` · Plate: ${riderProfile.plateNumber}`
                      : ''}
                  </Text>
                </View>
                <View style={styles.metaDot} />
                <View style={styles.metaItem}>
                  <BootstrapIcon name="star-fill" size={12} color="#F59E0B" />
                  <Text
                    style={[
                      styles.ratingText,
                      { color: palette.isDark ? '#FBBF24' : '#B45309' },
                    ]}
                  >
                    {Number(riderProfile?.rating || 5.0).toFixed(1)} Rating
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Right: Availability Status Control */}
          <View
            style={[
              styles.availabilityBox,
              {
                backgroundColor: palette.bgSub,
                borderColor: palette.border,
              },
              !isCompact && { minWidth: 340 },
            ]}
          >
            <Text style={[styles.tileOverline, { color: palette.textMuted }]}>
              Availability Status
            </Text>
            <View style={styles.availabilityPills}>
              {availabilityOptions.map((opt) => {
                const selected =
                  String(
                    availabilityStatus || RIDER_STATUSES.AVAILABLE
                  ).toLowerCase() === opt.toLowerCase();
                const dotColor =
                  opt === RIDER_STATUSES.AVAILABLE
                    ? '#16A34A'
                    : opt === RIDER_STATUSES.ON_DELIVERY
                      ? '#EA580C'
                      : palette.textSubtle;

                return (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.availPill,
                      {
                        backgroundColor: selected ? '#24272B' : palette.bgCard,
                        borderColor: selected ? '#24272B' : palette.border,
                      },
                    ]}
                    onPress={() => onSelectAvailability?.(opt)}
                    activeOpacity={0.82}
                  >
                    <View
                      style={[
                        styles.availDot,
                        { backgroundColor: selected ? '#EA580C' : dotColor },
                      ]}
                    />
                    <Text
                      style={[
                        styles.availPillText,
                        {
                          color: selected ? '#FFFFFF' : palette.textSecondary,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {opt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Admin-style Horizontal Divider */}
        <View
          style={[styles.cardDivider, { backgroundColor: palette.border }]}
        />

        {/* Admin-style Filter Pills Navigation (matches admin.styles.js filterPill / filterPillActive) */}
        <View
          style={[
            styles.pillsToolbar,
            isNarrow && { flexDirection: 'column', alignItems: 'stretch' },
          ]}
        >
          <View style={styles.filterPillsRow}>
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
                    styles.filterPill,
                    {
                      backgroundColor: active ? '#EA580C' : palette.bgCard,
                      borderColor: active ? '#EA580C' : palette.border,
                    },
                    isNarrow && { flex: 1, justifyContent: 'center' },
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
                      styles.filterPillText,
                      { color: active ? '#FFFFFF' : palette.textMuted },
                    ]}
                    numberOfLines={1}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[
              styles.logoutHeaderBtn,
              {
                backgroundColor: palette.dangerSoft,
                borderColor: palette.dangerBorder,
              },
            ]}
            onPress={onLogout}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Sign out of MotoTrack"
          >
            <BootstrapIcon
              name="box-arrow-right"
              size={14}
              color={palette.danger}
            />
            <Text style={[styles.logoutHeaderBtnText, { color: palette.danger }]}>
              Sign out of MotoTrack
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── MODULE 1: PROFILE (PERSONAL INFORMATION) ─── */}
      {accountTab === 'profile' ? (
        <View
          style={[
            styles.adminCard,
            styles.tableStyleCard,
            {
              backgroundColor: palette.bgCard,
              borderColor: palette.border,
            },
          ]}
        >
          <AdminSectionHeader
            icon="person-badge"
            title="Personal Information"
            subtitle="Keep your rider contact details accurate for dispatch and customers."
            palette={palette}
          />

          <View style={styles.cardBody}>
            <View
              style={[
                styles.formGrid,
                isNarrow && { flexDirection: 'column', gap: 14 },
              ]}
            >
              <View style={styles.formCol}>
                <Text style={[styles.fieldLabel, { color: palette.textMuted }]}>
                  Full Name
                </Text>
                <View
                  style={[
                    styles.inputWrap,
                    {
                      backgroundColor: palette.bgInput,
                      borderColor: palette.borderInput,
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

              <View style={styles.formCol}>
                <Text style={[styles.fieldLabel, { color: palette.textMuted }]}>
                  Mobile Number
                </Text>
                <View
                  style={[
                    styles.inputWrap,
                    {
                      backgroundColor: palette.bgInput,
                      borderColor: palette.borderInput,
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
            </View>

            <View
              style={[
                styles.formGrid,
                isNarrow && { flexDirection: 'column', gap: 14 },
              ]}
            >
              <View style={styles.formCol}>
                <Text style={[styles.fieldLabel, { color: palette.textMuted }]}>
                  Email Address
                </Text>
                <View
                  style={[
                    styles.inputWrap,
                    {
                      backgroundColor: palette.bgInput,
                      borderColor: palette.borderInput,
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
                <View style={styles.formCol}>
                  <Text style={[styles.fieldLabel, { color: palette.orangeText }]}>
                    Current Password (Required for Email Change)
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
                    <BootstrapIcon name="lock" size={15} color="#EA580C" />
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
              ) : (
                <View style={styles.formCol} />
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: palette.textMuted }]}>
                Home Address
              </Text>
              <View
                style={[
                  styles.inputWrap,
                  styles.textAreaWrap,
                  {
                    backgroundColor: palette.bgInput,
                    borderColor: palette.borderInput,
                  },
                ]}
              >
                <BootstrapIcon
                  name="house"
                  size={15}
                  color={palette.textMuted}
                  style={{ marginTop: 4 }}
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

            <View style={styles.actionsFooter}>
              <TouchableOpacity
                style={[
                  styles.addBtnPrimary,
                  { opacity: savingProfile ? 0.7 : 1 },
                  isNarrow && { width: '100%' },
                ]}
                disabled={savingProfile}
                onPress={handleSubmitProfile}
                activeOpacity={0.85}
              >
                {savingProfile ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <BootstrapIcon name="check2" size={15} color="#FFFFFF" />
                    <Text style={styles.addBtnPrimaryText}>
                      Save Profile Changes
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}

      {/* ─── MODULE 2: APP & ALERT PREFERENCES (Admin Toggle Tile Grid) ─── */}
      {accountTab === 'preferences' ? (
        <View
          style={[
            styles.adminCard,
            styles.tableStyleCard,
            {
              backgroundColor: palette.bgCard,
              borderColor: palette.border,
            },
          ]}
        >
          <AdminSectionHeader
            icon="sliders"
            title="App & Alert Preferences"
            subtitle="Control how MotoTrack notifies you while on the road."
            palette={palette}
          />

          <View style={styles.cardBody}>
            <View
              style={[
                styles.tilesGrid,
                isCompact && { flexDirection: 'column' },
              ]}
            >
              <AdminToggleTile
                icon="bell"
                title="Push & Dispatch Notifications"
                description="Instant alerts for new assigned deliveries and route changes."
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

              <AdminToggleTile
                icon="chat-dots"
                title="SMS Delivery Updates"
                description="Receive text alerts for urgent COD dispatches and customer notes."
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

              <AdminToggleTile
                icon="moon"
                title="Dark Mode"
                description="High-contrast charcoal interface for night riding."
                value={Boolean(isDarkMode)}
                onToggle={(val) => {
                  onToggleDarkMode?.(val);
                  onShowFeedback?.(`Dark mode ${val ? 'enabled' : 'disabled'}.`);
                }}
                palette={palette}
              />
            </View>
          </View>
        </View>
      ) : null}

      {/* ─── MODULE 3: SECURITY, 2FA & RIDER HELP CENTER ─── */}
      {accountTab === 'security' ? (
        <View
          style={[
            styles.securityLayout,
            isCompact && { flexDirection: 'column' },
          ]}
        >
          {/* Left Column: 2FA + Password Management */}
          <View style={styles.securityCol}>
            {/* Two-Step Verification Card */}
            <View
              style={[
                styles.adminCard,
                styles.tableStyleCard,
                {
                  backgroundColor: palette.bgCard,
                  borderColor: palette.border,
                },
              ]}
            >
              <AdminSectionHeader
                icon="shield-check"
                title="Two-Step Verification"
                subtitle="Protect your rider payouts and account with email OTP verification."
                palette={palette}
                rightSlot={
                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor: preferences?.twoFactorEnabled
                          ? palette.successSoft
                          : palette.bgSub,
                        borderColor: preferences?.twoFactorEnabled
                          ? palette.successBorder
                          : palette.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
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
                }
              />

              <View style={styles.cardBody}>
                <AdminToggleTile
                  icon="shield-lock"
                  title="Require 2-Step Login Verification"
                  description="Require email OTP verification when signing in on unrecognized devices."
                  value={Boolean(preferences?.twoFactorEnabled)}
                  onToggle={(val) =>
                    onUpdatePreference?.(
                      'twoFactorEnabled',
                      val,
                      `Two-step verification ${val ? 'enabled' : 'turned off'}.`
                    )
                  }
                  palette={palette}
                />
              </View>
            </View>

            {/* Password Management Card */}
            <View
              style={[
                styles.adminCard,
                styles.tableStyleCard,
                {
                  backgroundColor: palette.bgCard,
                  borderColor: palette.border,
                },
              ]}
            >
              <AdminSectionHeader
                icon="key"
                title="Password Management"
                subtitle="Use a strong password of at least 8 characters."
                palette={palette}
                rightSlot={
                  <TouchableOpacity
                    onPress={() => setShowPasswords((v) => !v)}
                    style={[
                      styles.quickOutlineBtn,
                      {
                        backgroundColor: palette.bgCard,
                        borderColor: palette.border,
                      },
                    ]}
                    activeOpacity={0.8}
                    accessibilityLabel={
                      showPasswords ? 'Hide passwords' : 'Show passwords'
                    }
                  >
                    <BootstrapIcon
                      name={showPasswords ? 'eye-slash' : 'eye'}
                      size={14}
                      color={palette.textSecondary}
                    />
                    <Text
                      style={[
                        styles.quickOutlineBtnText,
                        { color: palette.textSecondary },
                      ]}
                    >
                      {showPasswords ? 'Hide' : 'Show'}
                    </Text>
                  </TouchableOpacity>
                }
              />

              <View style={styles.cardBody}>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: palette.textMuted }]}>
                    Current Password
                  </Text>
                  <View
                    style={[
                      styles.inputWrap,
                      {
                        backgroundColor: palette.bgInput,
                        borderColor: palette.borderInput,
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
                  <Text style={[styles.fieldLabel, { color: palette.textMuted }]}>
                    New Password
                  </Text>
                  <View
                    style={[
                      styles.inputWrap,
                      {
                        backgroundColor: palette.bgInput,
                        borderColor: palette.borderInput,
                      },
                    ]}
                  >
                    <BootstrapIcon
                      name="key"
                      size={15}
                      color={palette.textMuted}
                    />
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
                  <Text style={[styles.fieldLabel, { color: palette.textMuted }]}>
                    Confirm New Password
                  </Text>
                  <View
                    style={[
                      styles.inputWrap,
                      {
                        backgroundColor: palette.bgInput,
                        borderColor: palette.borderInput,
                      },
                    ]}
                  >
                    <BootstrapIcon
                      name="key"
                      size={15}
                      color={palette.textMuted}
                    />
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

                <View style={styles.actionsFooter}>
                  <TouchableOpacity
                    style={[
                      styles.charcoalBtn,
                      { opacity: savingPassword ? 0.7 : 1 },
                      isNarrow && { width: '100%' },
                    ]}
                    disabled={savingPassword}
                    onPress={handleSubmitPassword}
                    activeOpacity={0.85}
                  >
                    {savingPassword ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <BootstrapIcon
                          name="shield-lock-fill"
                          size={14}
                          color="#FFFFFF"
                        />
                        <Text style={styles.addBtnPrimaryText}>
                          Update Password
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          {/* Right Column: Rider Help Center */}
          <View style={styles.securityCol}>
            <View
              style={[
                styles.adminCard,
                styles.tableStyleCard,
                {
                  backgroundColor: palette.bgCard,
                  borderColor: palette.border,
                },
              ]}
            >
              <AdminSectionHeader
                icon="life-preserver"
                title="Rider Help Center"
                subtitle="Quick answers and direct MotoTrack dispatch support."
                palette={palette}
              />

              <View style={styles.cardBody}>
                <View style={{ gap: 10 }}>
                  {HELP_TOPICS.map((topic) => {
                    const open = expandedTopic === topic.id;
                    return (
                      <TouchableOpacity
                        key={topic.id}
                        style={[
                          styles.helpAccordion,
                          {
                            backgroundColor: palette.bgSub,
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
                        activeOpacity={0.82}
                      >
                        <View style={styles.helpAccordionHead}>
                          <BootstrapIcon
                            name={topic.icon}
                            size={15}
                            color="#EA580C"
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

                <View
                  style={[
                    styles.supportActionsRow,
                    isNarrow && { flexDirection: 'column' },
                  ]}
                >
                  <ExternalLink href="tel:+639179990001" style={{ flex: 1 }}>
                    <View
                      style={[
                        styles.quickOutlineBtn,
                        styles.supportBtnFull,
                        {
                          borderColor: palette.border,
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
                          styles.quickOutlineBtnText,
                          { color: palette.textPrimary },
                        ]}
                      >
                        Call Dispatch
                      </Text>
                    </View>
                  </ExternalLink>

                  <ExternalLink
                    href="mailto:support@mototrack.com"
                    style={{ flex: 1 }}
                  >
                    <View
                      style={[
                        styles.quickOutlineBtn,
                        styles.supportBtnFull,
                        {
                          borderColor: palette.border,
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
                          styles.quickOutlineBtnText,
                          { color: palette.textPrimary },
                        ]}
                      >
                        Email Support
                      </Text>
                    </View>
                  </ExternalLink>
                </View>
              </View>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 20,
  },
  adminCard: {
    borderRadius: 16,
    borderWidth: 1,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
      },
    }),
  },
  tableStyleCard: {
    overflow: 'hidden',
  },
  headerCardBody: {
    padding: 22,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
  },
  identityRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minWidth: 0,
  },
  avatarWrap: {
    position: 'relative',
    flexShrink: 0,
  },
  avatarImage: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
  },
  avatarFallback: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontFamily: fontFamily.sans,
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cameraBtn: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  titleTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  pageTitle: {
    fontFamily: fontFamily.sans,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.25,
  },
  adminTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  adminTagBadgeText: {
    fontFamily: fontFamily.sans,
    fontSize: 10.5,
    fontWeight: '600',
    color: '#EA580C',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  idText: {
    fontFamily: fontFamily.sans,
    fontSize: 11.5,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontFamily: fontFamily.sans,
    fontSize: 12.5,
    fontWeight: '400',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#94A3B8',
  },
  ratingText: {
    fontFamily: fontFamily.sans,
    fontSize: 12.5,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  availabilityBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  tileOverline: {
    fontFamily: fontFamily.sans,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  availabilityPills: {
    flexDirection: 'row',
    gap: 6,
  },
  availPill: {
    flex: 1,
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  availDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  availPillText: {
    fontFamily: fontFamily.sans,
    fontSize: 12,
    fontWeight: '600',
  },
  cardDivider: {
    height: 1,
    marginVertical: 18,
  },
  pillsToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  filterPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  filterPillText: {
    fontFamily: fontFamily.sans,
    fontSize: 12.5,
    fontWeight: '600',
  },
  logoutHeaderBtn: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  logoutHeaderBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: 12.5,
    fontWeight: '700',
  },
  sectionStripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  sectionStripLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  sectionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sectionTitle: {
    fontFamily: fontFamily.sans,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontFamily: fontFamily.sans,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    marginTop: 1,
  },
  cardBody: {
    padding: 20,
    gap: 14,
  },
  formGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  formCol: {
    flex: 1,
    minWidth: 0,
  },
  fieldGroup: {
    gap: 0,
  },
  fieldLabel: {
    fontFamily: fontFamily.sans,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  textAreaWrap: {
    alignItems: 'flex-start',
    paddingVertical: 10,
    minHeight: 82,
  },
  inputField: {
    flex: 1,
    fontFamily: fontFamily.sans,
    fontSize: 13.5,
    fontWeight: '500',
    paddingVertical: 6,
    ...Platform.select({ web: { outlineStyle: 'none' } }),
  },
  textAreaInput: {
    paddingVertical: 0,
    minHeight: 56,
    textAlignVertical: 'top',
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  feedbackBannerText: {
    flex: 1,
    fontFamily: fontFamily.sans,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '500',
  },
  actionsFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 4,
  },
  addBtnPrimary: {
    backgroundColor: '#EA580C',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  charcoalBtn: {
    backgroundColor: '#24272B',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  addBtnPrimaryText: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tilesGrid: {
    flexDirection: 'row',
    gap: 14,
  },
  toggleTile: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 10,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px -2px rgba(0, 0, 0, 0.04)',
      },
    }),
  },
  tileMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  tileIconTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  tileIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tileStatusText: {
    fontFamily: fontFamily.sans,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  tileDesc: {
    fontFamily: fontFamily.sans,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '400',
  },
  switchTrack: {
    width: 48,
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 3,
    justifyContent: 'center',
    flexShrink: 0,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  securityLayout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 20,
  },
  securityCol: {
    flex: 1,
    gap: 20,
    minWidth: 0,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillText: {
    fontFamily: fontFamily.sans,
    fontSize: 11,
    fontWeight: '600',
  },
  quickOutlineBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  supportBtnFull: {
    minHeight: 42,
    borderRadius: 12,
  },
  quickOutlineBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: 12.5,
    fontWeight: '600',
  },
  helpAccordion: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  helpAccordionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  helpAccordionTitle: {
    flex: 1,
    fontFamily: fontFamily.sans,
    fontSize: 13,
    fontWeight: '600',
  },
  helpAccordionBody: {
    fontFamily: fontFamily.sans,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '400',
    marginTop: 8,
    paddingLeft: 25,
  },
  supportActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
});
