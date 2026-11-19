import React, { useState } from 'react';
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
import { riderFont, cardShadowStyle } from './riderTheme.js';

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

/**
 * Reusable interactive switch row used across Rider Account Preferences,
 * Settings, and Security cards.
 */
export function RiderSettingToggleRow({
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

/**
 * Shared Notification & Display Preferences card shared by both the Settings
 * tab and Account > Preferences tab.
 */
export function RiderAppPreferencesCard({
  palette,
  preferences,
  onUpdatePreference,
  isDarkMode,
  onToggleDarkMode,
  onShowFeedback,
  heading = 'App & alert preferences',
  subheading = 'Control how MotoTrack notifies you while on the road.',
  showDarkModeRow = true,
}) {
  const rows = [
    {
      key: 'pushNotifications',
      icon: 'bell',
      title: 'Push & dispatch notifications',
      description: 'Instant alerts for new assigned deliveries and route changes',
      value: preferences?.pushNotifications !== false,
      onToggle: (val) =>
        onUpdatePreference?.(
          'pushNotifications',
          val,
          `Dispatch notifications ${val ? 'enabled' : 'muted'}.`
        ),
    },
    {
      key: 'soundNotification',
      icon: 'bell-fill',
      title: 'Sound notifications',
      description: 'Audible chime when dispatch jobs or order updates arrive',
      value: preferences?.soundNotification !== false,
      onToggle: (val) =>
        onUpdatePreference?.(
          'soundNotification',
          val,
          `Sound notifications ${val ? 'enabled' : 'muted'}.`
        ),
    },
    {
      key: 'vibration',
      icon: 'sliders',
      title: 'Vibration alerts',
      description: 'Haptic feedback for incoming assignments and QR scan locks',
      value: preferences?.vibration !== false,
      onToggle: (val) =>
        onUpdatePreference?.(
          'vibration',
          val,
          `Vibration alerts ${val ? 'enabled' : 'turned off'}.`
        ),
    },
    {
      key: 'emailUpdates',
      icon: 'envelope',
      title: 'Email delivery updates',
      description: 'Receive email alerts for urgent COD dispatches and customer notes',
      value: Boolean(preferences?.emailUpdates ?? preferences?.smsUpdates),
      onToggle: (val) =>
        onUpdatePreference?.(
          'emailUpdates',
          val,
          `Email delivery updates ${val ? 'enabled' : 'disabled'}.`
        ),
    },
  ];

  if (showDarkModeRow) {
    rows.push({
      key: 'darkMode',
      icon: 'moon',
      title: 'Dark mode',
      description: 'High-contrast charcoal interface for night riding',
      value: Boolean(isDarkMode),
      onToggle: (val) => {
        onToggleDarkMode?.(val);
        onShowFeedback?.(`Dark mode ${val ? 'enabled' : 'disabled'}.`);
      },
    });
  }

  return (
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
        {heading}
      </Text>
      <Text style={[styles.cardSubheading, { color: palette.textMuted }]}>
        {subheading}
      </Text>

      <View style={styles.togglesList}>
        {rows.map((row, idx) => (
          <RiderSettingToggleRow
            key={row.key}
            icon={row.icon}
            title={row.title}
            description={row.description}
            value={row.value}
            onToggle={row.onToggle}
            palette={palette}
            isLast={idx === rows.length - 1}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * Shared Two-Step Verification & Password Management cards.
 */
export function RiderSecuritySection({
  palette,
  preferences,
  onUpdatePreference,
  onChangePassword,
  onShowFeedback,
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordBanner, setPasswordBanner] = useState(null);

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

  const passwordFields = [
    {
      label: 'Current password',
      icon: 'lock',
      value: currentPassword,
      onChangeText: setCurrentPassword,
      placeholder: 'Enter current password',
    },
    {
      label: 'New password',
      icon: 'key',
      value: newPassword,
      onChangeText: setNewPassword,
      placeholder: 'Minimum 8 characters',
    },
    {
      label: 'Confirm new password',
      icon: 'key',
      value: confirmPassword,
      onChangeText: setConfirmPassword,
      placeholder: 'Re-enter new password',
    },
  ];

  return (
    <>
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
          <Text style={[styles.cardHeading, { color: palette.textPrimary }]}>
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

        <RiderSettingToggleRow
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
            <Text style={[styles.cardHeading, { color: palette.textPrimary }]}>
              Password management
            </Text>
            <Text style={[styles.cardSubheading, { color: palette.textMuted }]}>
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
            accessibilityLabel={
              showPasswords ? 'Hide passwords' : 'Show passwords'
            }
          >
            <BootstrapIcon
              name={showPasswords ? 'eye-slash' : 'eye'}
              size={15}
              color={palette.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {passwordFields.map((field) => (
          <View key={field.label} style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
              {field.label}
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
                name={field.icon}
                size={15}
                color={palette.textMuted}
              />
              <TextInput
                style={[styles.inputField, { color: palette.textPrimary }]}
                value={field.value}
                onChangeText={field.onChangeText}
                secureTextEntry={!showPasswords}
                autoCapitalize="none"
                placeholder={field.placeholder}
                placeholderTextColor={palette.textSubtle}
              />
            </View>
          </View>
        ))}

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
    </>
  );
}

/**
 * Shared Rider Help Center FAQ accordions & direct dispatch contact actions.
 */
export function RiderHelpSupportSection({
  palette,
  supportPhone = '+639179990001',
  supportEmail = 'support@mototrack.com',
}) {
  const [expandedTopic, setExpandedTopic] = useState('qr');
  const dialTarget = String(supportPhone || '+639179990001').replace(
    /[^\d+]/g,
    ''
  );
  const mailTarget = String(supportEmail || 'support@mototrack.com').trim();

  return (
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

      <View style={styles.helpTopicsStack}>
        {HELP_TOPICS.map((topic) => {
          const open = expandedTopic === topic.id;
          return (
            <TouchableOpacity
              key={topic.id}
              style={[
                styles.helpAccordion,
                {
                  backgroundColor: palette.bgMuted,
                  borderColor: open ? palette.orangeBorder : palette.border,
                },
              ]}
              onPress={() =>
                setExpandedTopic((prev) => (prev === topic.id ? '' : topic.id))
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
        <ExternalLink href={`tel:${dialTarget}`} style={{ flex: 1 }}>
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
              style={[styles.supportBtnText, { color: palette.textPrimary }]}
            >
              Call dispatch
            </Text>
          </View>
        </ExternalLink>

        <ExternalLink href={`mailto:${mailTarget}`} style={{ flex: 1 }}>
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
              style={[styles.supportBtnText, { color: palette.textPrimary }]}
            >
              Email support
            </Text>
          </View>
        </ExternalLink>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    ...riderFont('600'),
    fontSize: 14,
    lineHeight: 19,
  },
  toggleDesc: {
    ...riderFont('400'),
    fontSize: 12,
    lineHeight: 16,
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
    ...riderFont('700'),
    fontSize: 11.5,
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
  inputField: {
    flex: 1,
    ...riderFont('500'),
    fontSize: 14,
    paddingVertical: 8,
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
  helpTopicsStack: {
    marginTop: 10,
    gap: 8,
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
    ...riderFont('600'),
    fontSize: 13.5,
  },
  helpAccordionBody: {
    ...riderFont('400'),
    fontSize: 12.5,
    lineHeight: 18,
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
    ...riderFont('600'),
    fontSize: 13,
  },
});
