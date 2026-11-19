import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Modal,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BootstrapIcon } from '../../common/BootstrapIcon.jsx';
import { RIDER_STATUSES } from '../../../services/staff/riderService.js';
import { appStorage } from '../../../services/system/storageAdapter.js';
import { ANDROID_TOP_INSET } from '../../../utils/safeArea.js';
import { pickImageFromFile } from '../../../utils/imagePickerHelper.js';
import { riderFont, cardShadowStyle, getInitials } from './riderTheme.js';
import {
  RiderAppPreferencesCard,
  RiderSecuritySection,
  RiderHelpSupportSection,
} from './RiderSettingsSections.jsx';

const RIDER_HERO_BOTTOM_FADE_GRADIENT =
  'linear-gradient(to bottom, rgba(18, 21, 25, 0) 0%, rgba(18, 21, 25, 0.04) 16%, rgba(18, 21, 25, 0.14) 32%, rgba(18, 21, 25, 0.30) 46%, rgba(18, 21, 25, 0.52) 60%, rgba(18, 21, 25, 0.74) 72%, rgba(18, 21, 25, 0.90) 83%, rgba(18, 21, 25, 0.98) 92%, rgba(18, 21, 25, 1) 100%)';

function AccountDetailRow({
  icon,
  label,
  value,
  palette,
  dotColor = null,
  tabular = false,
  multiline = false,
  boldValue = false,
  isLast = false,
}) {
  return (
    <View
      style={[
        styles.infoRow,
        !isLast && {
          borderBottomWidth: 1,
          borderBottomColor: palette.borderSubtle,
        },
      ]}
    >
      <View style={[styles.infoIconBox, { backgroundColor: palette.bgMuted }]}>
        <BootstrapIcon name={icon} size={15} color={palette.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.infoRowLabel, { color: palette.textMuted }]}>
          {label}
        </Text>
        <View style={styles.infoValueRow}>
          {dotColor ? (
            <View style={[styles.availDot, { backgroundColor: dotColor }]} />
          ) : null}
          <Text
            numberOfLines={multiline ? 2 : 1}
            style={[
              styles.infoRowValue,
              boldValue && styles.infoRowValueBold,
              tabular && { fontVariant: ['tabular-nums'] },
              { color: palette.textPrimary },
            ]}
          >
            {value}
          </Text>
        </View>
      </View>
    </View>
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
  onCycleAvailability,
  unreadNotifCount = 0,
  deliveredCount = 0,
  activeCount = 0,
  weekEarnings = 0,
  onOpenNotifications,
  onOpenMenu,
  onOpenSettings,
  onNavigateMainTab,
  onScrollToSection,
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

  // Rider Cover Photo State
  const coverStorageKey = `mototrack_rider_cover_${currentUser?.id || riderId || 'guest'}`;
  const [riderCoverUri, setRiderCoverUri] = useState(() => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        const localCover = window.localStorage.getItem(coverStorageKey);
        if (localCover) return localCover;
      }
      return riderProfile?.coverPhoto || currentUser?.coverPhoto || currentUser?.cover_url || appStorage.getItem(coverStorageKey) || null;
    } catch (_e) {
      return null;
    }
  });
  const [coverImageFailed, setCoverImageFailed] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isViewingCoverModal, setIsViewingCoverModal] = useState(false);

  useEffect(() => {
    let active = true;
    const loadCover = async () => {
      try {
        const direct = riderProfile?.coverPhoto || currentUser?.coverPhoto || currentUser?.cover_url || null;
        if (direct) {
          if (active) {
            setCoverImageFailed(false);
            setRiderCoverUri(direct);
          }
          return;
        }
        const asyncVal = await AsyncStorage.getItem(coverStorageKey);
        if (asyncVal && active) {
          setCoverImageFailed(false);
          setRiderCoverUri(asyncVal);
          return;
        }
        const adapterVal = appStorage.getItem(coverStorageKey);
        if (adapterVal && active) {
          setCoverImageFailed(false);
          setRiderCoverUri(adapterVal);
        }
      } catch (_e) {}
    };
    loadCover();
    return () => {
      active = false;
    };
  }, [coverStorageKey, riderProfile?.coverPhoto, currentUser?.coverPhoto, currentUser?.cover_url]);

  const handleUploadCover = async () => {
    if (isUploadingCover) return;
    setIsUploadingCover(true);
    try {
      const res = await pickImageFromFile();
      if (res?.success && res.uri) {
        setCoverImageFailed(false);
        setRiderCoverUri(res.uri);
        try {
          await AsyncStorage.setItem(coverStorageKey, res.uri);
        } catch (_e) {}
        try {
          appStorage.setItem(coverStorageKey, res.uri);
        } catch (_e) {}
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
          try {
            window.localStorage.setItem(coverStorageKey, res.uri);
          } catch (_e) {}
        }
        onShowFeedback?.('Cover photo updated.');
      }
    } catch (_e) {
      onShowFeedback?.('Could not update cover photo. Please try a smaller image.', true);
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleRemoveCover = async () => {
    setRiderCoverUri(null);
    setCoverImageFailed(false);
    setIsViewingCoverModal(false);
    try {
      await AsyncStorage.removeItem(coverStorageKey);
    } catch (_e) {}
    try {
      appStorage.removeItem?.(coverStorageKey);
    } catch (_e) {}
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(coverStorageKey);
      } catch (_e) {}
    }
    onShowFeedback?.('Cover photo removed.');
  };

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
      onChangeAccountTab?.('profile');
      setIsEditingProfile(true);
      setProfileBanner({
        type: 'success',
        text: 'New rider photo staged. Tap "Save profile changes" to apply.',
      });
      setTimeout(() => onScrollToSection?.(220), 80);
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

  const heroDisplayName = fullName || resolvedName || 'MotoTrack Rider';
  const heroInitials = getInitials(heroDisplayName);
  const riderAvatarSrc = avatarUri || resolvedAvatar || null;
  const activeUploadedCover = !coverImageFailed ? riderCoverUri : null;
  const heroBackdropUri = activeUploadedCover || riderAvatarSrc;
  const heroBlurRadius = activeUploadedCover
    ? 0
    : Platform.select({ ios: 8, android: 5, default: 8 });
  const profileTopInset =
    Platform.OS === 'ios'
      ? Math.max(Number(Constants.statusBarHeight) || 0, 50)
      : ANDROID_TOP_INSET + 12;
  const heroHeight = profileTopInset + 242;
  const heroGlassBtnStyle = {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(20, 22, 26, 0.56)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  };
  const riderHandle = currentUser?.username
    ? `@${String(currentUser.username).replace(/^@/, '')}`
    : emailAddress
      ? `@${String(emailAddress).split('@')[0]}`
      : '@mototrack_rider';
  const riderHandleLine = `${riderHandle} · ${riderId ? String(riderId).toUpperCase() : 'RDR-MOTO'}`;
  const currentAvail = availabilityStatus || RIDER_STATUSES.AVAILABLE;
  const availDotColor =
    String(currentAvail).toLowerCase() === 'available'
      ? '#10B981'
      : String(currentAvail).toLowerCase().includes('delivery')
        ? '#EA580C'
        : '#94A3B8';

  const riderStats = [
    {
      label: 'Delivered',
      value: deliveredCount,
      onPress: () => onNavigateMainTab?.('orders'),
    },
    {
      label: 'Active',
      value: activeCount,
      onPress: () => onNavigateMainTab?.('orders'),
    },
    {
      label: 'This Week',
      value: `₱${Math.round(Number(weekEarnings) || 0).toLocaleString()}`,
      onPress: () => onNavigateMainTab?.('earnings'),
    },
  ];

  const personalInfoRows = [
    { icon: 'person', label: 'Full name', value: heroDisplayName },
    {
      icon: 'telephone',
      label: 'Mobile number',
      value: mobileNumber || 'Not set',
      tabular: true,
    },
    { icon: 'envelope', label: 'Email address', value: emailAddress || 'Not set' },
    {
      icon: 'house',
      label: 'Home address',
      value: homeAddress || 'Not set',
      multiline: true,
    },
  ];

  const fleetInfoRows = [
    {
      icon: 'tag',
      label: 'Rider ID',
      value: riderId ? String(riderId).toUpperCase() : 'RDR-MOTO',
      tabular: true,
      boldValue: true,
    },
    {
      icon: 'motorcycle',
      label: 'Assigned vehicle',
      value: riderProfile?.vehicleInfo
        ? `${riderProfile.vehicleInfo}${riderProfile.plateNumber ? ` · ${riderProfile.plateNumber}` : ''}`
        : 'MotoTrack Delivery Fleet',
    },
    {
      icon: 'check-circle',
      label: 'Duty status',
      value: currentAvail,
      dotColor: availDotColor,
      boldValue: true,
    },
  ];

  return (
    <View style={styles.container}>
      {/* 1. Customer-Style Full-Bleed Cover Hero Header */}
      <View
        style={{
          width: '100%',
          height: heroHeight,
          backgroundColor: '#121519',
          position: 'relative',
          overflow: 'hidden',
          justifyContent: 'space-between',
        }}
      >
        {heroBackdropUri ? (
          <Image
            key={String(heroBackdropUri).slice(0, 80)}
            source={{ uri: heroBackdropUri }}
            blurRadius={heroBlurRadius}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              zIndex: 0,
            }}
            resizeMode="cover"
            onError={() => {
              if (activeUploadedCover) setCoverImageFailed(true);
            }}
          />
        ) : (
          <View
            pointerEvents="none"
            style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: '#1E232A',
            }}
          />
        )}

        {/* Top Status-Bar Readability Scrim */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: profileTopInset + 56,
            zIndex: 1,
            backgroundImage:
              'linear-gradient(to bottom, rgba(12, 14, 18, 0.56) 0%, rgba(12, 14, 18, 0.24) 55%, rgba(12, 14, 18, 0) 100%)',
          }}
        />

        {/* Seamless Eased Charcoal Bottom Fade */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '72%',
            zIndex: 4,
            backgroundImage: RIDER_HERO_BOTTOM_FADE_GRADIENT,
          }}
        />

        {/* Tap Background Layer to View Full-Screen Cover Photo */}
        {heroBackdropUri ? (
          <TouchableOpacity
            activeOpacity={0.95}
            onPress={() => setIsViewingCoverModal(true)}
            accessibilityLabel="View cover photo"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 5,
            }}
          />
        ) : null}

        {/* Foreground Hero Controls & Rider Identity */}
        <View
          pointerEvents="box-none"
          style={{
            flex: 1,
            zIndex: 6,
            paddingTop: profileTopInset,
            paddingBottom: 24,
            paddingHorizontal: 16,
            justifyContent: 'space-between',
          }}
        >
          {/* Top Circular Glass Action Row */}
          <View
            pointerEvents="box-none"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  onChangeAccountTab?.('profile');
                  setIsEditingProfile((prev) => {
                    const next = !prev;
                    if (next) {
                      setTimeout(() => onScrollToSection?.(220), 80);
                    }
                    return next;
                  });
                }}
                accessibilityLabel="Edit rider profile"
                style={heroGlassBtnStyle}
              >
                <BootstrapIcon name="pencil" size={14} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleUploadCover}
                disabled={isUploadingCover}
                accessibilityLabel="Change cover photo"
                style={heroGlassBtnStyle}
              >
                {isUploadingCover ? (
                  <ActivityIndicator size="small" color="#FBBF24" />
                ) : (
                  <BootstrapIcon name="image" size={15} color="#FBBF24" />
                )}
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={onOpenNotifications}
                accessibilityLabel="Notifications"
                style={heroGlassBtnStyle}
              >
                <BootstrapIcon name="bell" size={15} color="#FFFFFF" />
                {unreadNotifCount > 0 ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: 7,
                      right: 8,
                      width: 7,
                      height: 7,
                      borderRadius: 3.5,
                      backgroundColor: '#EA580C',
                    }}
                  />
                ) : null}
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  if (onOpenSettings) {
                    onOpenSettings();
                  } else {
                    onChangeAccountTab?.('preferences');
                  }
                }}
                accessibilityLabel="Open rider settings"
                style={heroGlassBtnStyle}
              >
                <BootstrapIcon name="gear" size={15} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={onOpenMenu}
                accessibilityLabel="Rider quick menu"
                style={heroGlassBtnStyle}
              >
                <BootstrapIcon name="list" size={17} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Bottom Split: Left Name/Handle/Stats + Right Avatar */}
          <View
            pointerEvents="box-none"
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 14,
            }}
          >
            <View style={{ flex: 1, paddingBottom: 2 }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  onChangeAccountTab?.('profile');
                  setIsEditingProfile(true);
                  setTimeout(() => onScrollToSection?.(220), 80);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    ...riderFont('700'),
                    fontSize: 24,
                    lineHeight: 30,
                    color: '#FFFFFF',
                    letterSpacing: -0.4,
                    flexShrink: 1,
                    textShadowColor: 'rgba(0, 0, 0, 0.45)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 4,
                  }}
                >
                  {heroDisplayName}
                </Text>
                <BootstrapIcon name="caret-down-fill" size={11} color="#FFFFFF" />
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 3.5,
                    backgroundColor: availDotColor,
                    marginBottom: 8,
                    marginLeft: -2,
                  }}
                />
              </TouchableOpacity>

              <Text
                numberOfLines={1}
                style={{
                  ...riderFont('500'),
                  marginTop: 2,
                  fontSize: 13,
                  lineHeight: 18,
                  color: 'rgba(255, 255, 255, 0.82)',
                }}
              >
                {riderHandleLine}
              </Text>

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 22,
                  marginTop: 14,
                }}
              >
                {riderStats.map((stat) => (
                  <TouchableOpacity
                    key={stat.label}
                    activeOpacity={0.75}
                    onPress={stat.onPress}
                  >
                    <Text
                      style={{
                        ...riderFont('700'),
                        fontSize: 18,
                        lineHeight: 22,
                        color: '#FFFFFF',
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {stat.value}
                    </Text>
                    <Text
                      style={{
                        ...riderFont('500'),
                        fontSize: 12,
                        lineHeight: 15,
                        color: 'rgba(255, 255, 255, 0.76)',
                        marginTop: 2,
                      }}
                    >
                      {stat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Right Circular Avatar + Add Badge */}
            <View style={{ alignItems: 'center', position: 'relative' }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handlePickAvatar}
                accessibilityRole="button"
                accessibilityLabel="Update rider profile photo"
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: 42,
                  backgroundColor: '#FFFFFF',
                  padding: 2,
                  borderWidth: 1.5,
                  borderColor: 'rgba(255, 255, 255, 0.85)',
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.28,
                  shadowRadius: 8,
                  elevation: 5,
                }}
              >
                <View
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: 40,
                    backgroundColor: '#EA580C',
                    overflow: 'hidden',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {riderAvatarSrc ? (
                    <Image
                      source={{ uri: riderAvatarSrc }}
                      style={styles.heroAvatarImg}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text style={styles.heroAvatarInitials}>{heroInitials}</Text>
                  )}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handlePickAvatar}
                accessibilityLabel="Edit rider avatar"
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: -1,
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: '#EA580C',
                  borderWidth: 2,
                  borderColor: '#121519',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.28,
                  shadowRadius: 3,
                  elevation: 4,
                }}
              >
                <BootstrapIcon name="plus" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* Rounded Rider Profile Content Sheet */}
      <View
        style={{
          backgroundColor: palette.bgCanvas,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          marginTop: -12,
          paddingHorizontal: 16,
          paddingTop: 18,
          paddingBottom: 16,
          gap: 14,
        }}
      >

      {/* Availability Quick Selector */}
      <View
        style={[
          styles.availabilityBlock,
          {
            marginTop: 0,
            backgroundColor: palette.bgCard,
            borderColor: palette.border,
          },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <Text style={[styles.availabilityCaption, { color: palette.textMuted, marginBottom: 0 }]}>
            Duty status
          </Text>
          {typeof onCycleAvailability === 'function' ? (
            <TouchableOpacity onPress={onCycleAvailability} activeOpacity={0.75}>
              <Text style={[styles.quickToggleText, { color: palette.orange }]}>
                Quick toggle
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.availabilityPillsRow}>
          {[
            { status: RIDER_STATUSES.AVAILABLE, dot: '#10B981' },
            { status: RIDER_STATUSES.ON_DELIVERY, dot: '#EA580C' },
            { status: RIDER_STATUSES.OFF_DUTY, dot: '#94A3B8' },
          ].map((opt) => {
            const active = currentAvail === opt.status;
            return (
              <TouchableOpacity
                key={opt.status}
                onPress={() => onSelectAvailability?.(opt.status)}
                activeOpacity={0.8}
                style={[
                  styles.availPill,
                  {
                    backgroundColor: active
                      ? palette.isDark
                        ? '#232830'
                        : '#18181B'
                      : palette.bgMuted,
                    borderColor: active
                      ? palette.isDark
                        ? '#38404C'
                        : '#18181B'
                      : palette.border,
                  },
                ]}
              >
                <View style={[styles.availDot, { backgroundColor: opt.dot }]} />
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                  style={[
                    styles.availPillText,
                    active && styles.availPillTextActive,
                    { color: active ? '#FFFFFF' : palette.textSecondary },
                  ]}
                >
                  {opt.status}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
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
          { id: 'security', label: 'Security', icon: 'shield-check' },
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
                  active && styles.accountTabTextActive,
                  { color: active ? '#FFFFFF' : palette.textMuted },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ─── TAB 1: PERSONAL & FLEET INFORMATION CARDS ─── */}
      {accountTab === 'profile' ? (
        <>
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
              {personalInfoRows.map((row, idx) => (
                <AccountDetailRow
                  key={row.label}
                  icon={row.icon}
                  label={row.label}
                  value={row.value}
                  tabular={row.tabular}
                  multiline={row.multiline}
                  palette={palette}
                  isLast={idx === personalInfoRows.length - 1}
                />
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

        {!isEditingProfile ? (
          <View
            style={[
              styles.formCard,
              !palette.isDark && cardShadowStyle,
              {
                backgroundColor: palette.bgCard,
                borderColor: palette.border,
                paddingBottom: 6,
              },
            ]}
          >
            <View style={[styles.personalInfoHeader, { marginBottom: 6 }]}>
              <Text style={[styles.cardHeading, { color: palette.textPrimary }]}>
                Rider &amp; fleet details
              </Text>
              <View
                style={[
                  styles.fleetVerifiedBadge,
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
                    styles.fleetVerifiedText,
                    { color: palette.orangeText },
                  ]}
                >
                  Verified
                </Text>
              </View>
            </View>

            <View>
              {fleetInfoRows.map((row, idx) => (
                <AccountDetailRow
                  key={row.label}
                  icon={row.icon}
                  label={row.label}
                  value={row.value}
                  dotColor={row.dotColor}
                  tabular={row.tabular}
                  boldValue={row.boldValue}
                  palette={palette}
                  isLast={idx === fleetInfoRows.length - 1}
                />
              ))}
            </View>
          </View>
        ) : null}
        </>
      ) : null}

      {/* ─── TAB 2: NOTIFICATION & DISPLAY PREFERENCES ─── */}
      {accountTab === 'preferences' ? (
        <RiderAppPreferencesCard
          palette={palette}
          preferences={preferences}
          onUpdatePreference={onUpdatePreference}
          isDarkMode={isDarkMode}
          onToggleDarkMode={onToggleDarkMode}
          onShowFeedback={onShowFeedback}
          showDarkModeRow
        />
      ) : null}

      {/* ─── TAB 3: SECURITY, 2FA & HELP CENTER ─── */}
      {accountTab === 'security' ? (
        <>
          <RiderSecuritySection
            palette={palette}
            preferences={preferences}
            onUpdatePreference={onUpdatePreference}
            onChangePassword={onChangePassword}
            onShowFeedback={onShowFeedback}
          />
          <RiderHelpSupportSection palette={palette} />
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

      {/* Full-Screen Rider Cover Photo Viewer Modal */}
      {isViewingCoverModal && heroBackdropUri ? (
        <Modal
          visible={isViewingCoverModal}
          transparent
          animationType="fade"
          onRequestClose={() => setIsViewingCoverModal(false)}
        >
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: 'rgba(0, 0, 0, 0.88)',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 20,
            }}
            activeOpacity={1}
            onPress={() => setIsViewingCoverModal(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation?.()}
              style={{
                width: '100%',
                maxWidth: 420,
                backgroundColor: '#181A1D',
                borderRadius: 18,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.12)',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(255, 255, 255, 0.08)',
                }}
              >
                <Text style={{ fontSize: 15.5, ...riderFont('700'), color: '#F9FAFB' }}>
                  Cover Photo
                </Text>
                <TouchableOpacity
                  onPress={() => setIsViewingCoverModal(false)}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BootstrapIcon name="x-lg" size={13} color="#F9FAFB" />
                </TouchableOpacity>
              </View>

              <View style={{ width: '100%', height: 260, backgroundColor: '#0E1014' }}>
                <Image
                  source={{ uri: heroBackdropUri }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="contain"
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 10, padding: 14 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    height: 42,
                    borderRadius: 10,
                    backgroundColor: '#EA580C',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                  onPress={() => {
                    setIsViewingCoverModal(false);
                    handleUploadCover();
                  }}
                >
                  <BootstrapIcon name="image" size={14} color="#FFFFFF" />
                  <Text style={{ fontSize: 13.5, ...riderFont('700'), color: '#FFFFFF' }}>
                    Change Cover
                  </Text>
                </TouchableOpacity>

                {riderCoverUri ? (
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      height: 42,
                      borderRadius: 10,
                      backgroundColor: 'rgba(239, 68, 68, 0.16)',
                      borderWidth: 1,
                      borderColor: 'rgba(248, 113, 113, 0.36)',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                    onPress={handleRemoveCover}
                  >
                    <BootstrapIcon name="trash3" size={13} color="#FCA5A5" />
                    <Text style={{ fontSize: 13.5, ...riderFont('700'), color: '#FCA5A5' }}>
                      Remove
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  heroAvatarImg: {
    width: '100%',
    height: '100%',
  },
  heroAvatarInitials: {
    ...riderFont('700'),
    fontSize: 24,
    color: '#FFFFFF',
    letterSpacing: 0.5,
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
    ...riderFont('600'),
    fontSize: 12.5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  infoIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRowLabel: {
    ...riderFont('500'),
    fontSize: 11.5,
    lineHeight: 15,
    marginBottom: 2,
  },
  infoValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  infoRowValue: {
    ...riderFont('600'),
    fontSize: 14,
    lineHeight: 19,
    flexShrink: 1,
  },
  infoRowValueBold: {
    ...riderFont('700'),
  },
  fleetVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  fleetVerifiedText: {
    ...riderFont('700'),
    fontSize: 11,
  },
  availabilityBlock: {
    marginTop: 14,
    padding: 13,
    borderRadius: 18,
    borderWidth: 1,
  },
  availabilityCaption: {
    ...riderFont('700'),
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 9,
  },
  quickToggleText: {
    ...riderFont('600'),
    fontSize: 12,
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
    ...riderFont('600'),
    fontSize: 12,
  },
  availPillTextActive: {
    ...riderFont('700'),
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
    ...riderFont('500'),
    fontSize: 12.5,
  },
  accountTabTextActive: {
    ...riderFont('700'),
  },
  formCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
  },
  cardHeading: {
    ...riderFont('700'),
    fontSize: 16.5,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  cardSubheading: {
    ...riderFont('400'),
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 3,
  },
  fieldGroup: {
    marginTop: 13,
  },
  fieldLabel: {
    ...riderFont('600'),
    fontSize: 12,
    lineHeight: 16,
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
    ...riderFont('500'),
    fontSize: 14,
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
    ...riderFont('600'),
    fontSize: 12.5,
    lineHeight: 17,
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
    ...riderFont('700'),
    fontSize: 14.5,
    color: '#FFFFFF',
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
    ...riderFont('700'),
    fontSize: 14,
  },
});

