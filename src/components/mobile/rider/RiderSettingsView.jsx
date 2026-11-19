import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import { BootstrapIcon } from '../../common/BootstrapIcon.jsx';
import { systemSettingsService } from '../../../services/system/systemSettingsService.js';
import { riderFont, cardShadowStyle } from './riderTheme.js';
import {
  RiderAppPreferencesCard,
  RiderSecuritySection,
  RiderHelpSupportSection,
} from './RiderSettingsSections.jsx';

const APPEARANCE_CARDS = [
  {
    key: 'daylight',
    label: 'Daylight',
    subtitle: 'Crisp warm light mode',
    dark: false,
    swatchBg: '#F4F1EA',
    textColor: '#3F3A32',
    barColor: '#EA580C',
    footerBg: '#FFFFFF',
    footerText: '#18181B',
  },
  {
    key: 'darkroom',
    label: 'Darkroom',
    subtitle: 'Charcoal night riding',
    dark: true,
    swatchBg: '#1C1F23',
    textColor: '#F9FAFB',
    barColor: '#FB923C',
    footerBg: '#181B1F',
    footerText: '#F3F4F6',
  },
];

/**
 * Dedicated Rider Settings view accessible directly from the bottom navbar,
 * combining customer-aligned Appearance presets & Hub credentials with
 * dispatch alert preferences, account security, help center, and sign-out.
 */
export default function RiderSettingsView({
  palette,
  riderName,
  riderEmail,
  riderId,
  preferences,
  onUpdatePreference,
  isDarkMode,
  onToggleDarkMode,
  onChangePassword,
  onOpenAccountProfile,
  onLogout,
  onShowFeedback,
}) {
  const [storeSettings, setStoreSettings] = useState(() =>
    systemSettingsService.getSettings()
  );

  useEffect(() => {
    const unsub = systemSettingsService.subscribe((updated) => {
      if (updated) setStoreSettings(updated);
    });
    return unsub;
  }, []);

  const appVersion = Constants.expoConfig?.version || '';

  const hubCredentials = [
    {
      key: 'hub-location',
      icon: 'geo-alt',
      label: 'Dispatch Hub',
      value:
        storeSettings?.storeAddress || 'East Poblacion, City of Naga, Cebu',
    },
    {
      key: 'hub-hotline',
      icon: 'telephone',
      label: 'Dispatch Hotline',
      value: storeSettings?.contactPhone || '+63 917 882 9102',
      tabular: true,
    },
    {
      key: 'hub-hours',
      icon: 'clock',
      label: 'Dispatch Hours',
      value: `${storeSettings?.operatingDays || 'Mon – Sat'}: ${
        storeSettings?.openTime || '8:00 AM'
      } – ${storeSettings?.closeTime || '7:00 PM'} | Sun: By Appointment`,
      tabular: true,
    },
  ];

  return (
    <View style={styles.container}>
      {/* Appearance Preset Cards */}
      <View style={styles.sectionBlock}>
        <Text style={[styles.sectionEyebrow, { color: palette.textMuted }]}>
          APPEARANCE
        </Text>
        <View style={styles.themeCardsRow}>
          {APPEARANCE_CARDS.map((card) => {
            const isSelected = Boolean(isDarkMode) === card.dark;
            return (
              <TouchableOpacity
                key={card.key}
                activeOpacity={0.85}
                onPress={() => {
                  if (Boolean(isDarkMode) !== card.dark) {
                    onToggleDarkMode?.(card.dark);
                  }
                  onShowFeedback?.(`Appearance set to ${card.label}.`);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${card.label} appearance theme`}
                style={[
                  styles.themeCard,
                  !palette.isDark && cardShadowStyle,
                  {
                    borderWidth: isSelected ? 2 : 1,
                    borderColor: isSelected ? palette.orange : palette.border,
                    backgroundColor: palette.bgCard,
                  },
                ]}
              >
                <View
                  style={[
                    styles.themeSwatchTop,
                    { backgroundColor: card.swatchBg },
                  ]}
                >
                  <View style={styles.themeSwatchRow}>
                    <Text
                      style={[styles.themeAaText, { color: card.textColor }]}
                    >
                      Aa
                    </Text>
                    {isSelected ? (
                      <View style={styles.themeCheckBadge}>
                        <BootstrapIcon name="check" size={12} color="#FFFFFF" />
                      </View>
                    ) : null}
                  </View>
                  <View
                    style={[
                      styles.themeAccentBar,
                      { backgroundColor: card.barColor },
                    ]}
                  />
                </View>

                <View
                  style={[
                    styles.themeFooter,
                    {
                      backgroundColor: palette.isDark
                        ? '#181B1F'
                        : card.footerBg,
                      borderTopColor: palette.isDark ? '#262A30' : '#F1F5F9',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.themeFooterTitle,
                      isSelected && styles.themeFooterTitleActive,
                      {
                        color: palette.isDark ? '#F3F4F6' : card.footerText,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {card.label}
                  </Text>
                  <Text
                    style={[
                      styles.themeFooterSub,
                      { color: palette.textMuted },
                    ]}
                    numberOfLines={1}
                  >
                    {card.subtitle}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Notification & Alert Preferences */}
      <View style={styles.sectionBlock}>
        <Text style={[styles.sectionEyebrow, { color: palette.textMuted }]}>
          DISPATCH &amp; ALERTS
        </Text>
        <RiderAppPreferencesCard
          palette={palette}
          preferences={preferences}
          onUpdatePreference={onUpdatePreference}
          isDarkMode={isDarkMode}
          onToggleDarkMode={onToggleDarkMode}
          onShowFeedback={onShowFeedback}
          showDarkModeRow={false}
        />
      </View>

      {/* Dispatch Hub & Store Credentials */}
      <View style={styles.sectionBlock}>
        <Text style={[styles.sectionEyebrow, { color: palette.textMuted }]}>
          DISPATCH HUB &amp; HOURS
        </Text>
        <View
          style={[
            styles.credentialsCard,
            !palette.isDark && cardShadowStyle,
            {
              backgroundColor: palette.bgCard,
              borderColor: palette.border,
            },
          ]}
        >
          {hubCredentials.map((item) => (
            <View key={item.key} style={styles.credentialRow}>
              <View
                style={[
                  styles.credentialIconBox,
                  {
                    backgroundColor: palette.isDark ? '#2A1D15' : '#FFF7ED',
                    borderColor: palette.orangeBorder,
                  },
                ]}
              >
                <BootstrapIcon
                  name={item.icon}
                  size={16}
                  color={palette.orange}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.credentialLabel,
                    { color: palette.textMuted },
                  ]}
                >
                  {item.label}
                </Text>
                <Text
                  style={[
                    styles.credentialValue,
                    item.tabular && styles.tabularText,
                    { color: palette.textPrimary },
                  ]}
                >
                  {item.value}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Account Security & Password */}
      <View style={styles.sectionBlock}>
        <Text style={[styles.sectionEyebrow, { color: palette.textMuted }]}>
          SECURITY
        </Text>
        <RiderSecuritySection
          palette={palette}
          preferences={preferences}
          onUpdatePreference={onUpdatePreference}
          onChangePassword={onChangePassword}
          onShowFeedback={onShowFeedback}
        />
      </View>

      {/* Rider Help & Dispatch Support */}
      <View style={styles.sectionBlock}>
        <Text style={[styles.sectionEyebrow, { color: palette.textMuted }]}>
          HELP &amp; SUPPORT
        </Text>
        <RiderHelpSupportSection
          palette={palette}
          supportPhone={storeSettings?.contactPhone}
          supportEmail={storeSettings?.contactEmail}
        />
      </View>

      {/* Account Shortcut & Sign Out */}
      <View style={styles.sectionBlock}>
        <Text style={[styles.sectionEyebrow, { color: palette.textMuted }]}>
          ACCOUNT &amp; SESSION
        </Text>
        <TouchableOpacity
          style={[
            styles.accountShortcutCard,
            !palette.isDark && cardShadowStyle,
            {
              backgroundColor: palette.bgCard,
              borderColor: palette.border,
            },
          ]}
          onPress={onOpenAccountProfile}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel="Open rider profile and availability"
        >
          <View
            style={[
              styles.credentialIconBox,
              {
                backgroundColor: palette.orangeSoft,
                borderColor: palette.orangeBorder,
              },
            ]}
          >
            <BootstrapIcon name="person" size={16} color={palette.orange} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[styles.shortcutTitle, { color: palette.textPrimary }]}
            >
              Rider profile &amp; availability
            </Text>
            <Text
              style={[styles.shortcutSubtitle, { color: palette.textMuted }]}
              numberOfLines={1}
            >
              {`${riderName || 'MotoTrack Rider'} · ${
                riderEmail || riderId || 'Manage details & status'
              }`}
            </Text>
          </View>
          <BootstrapIcon
            name="chevron-right"
            size={15}
            color={palette.textMuted}
          />
        </TouchableOpacity>

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

        <Text style={[styles.versionCaption, { color: palette.textSubtle }]}>
          {`MotoTrack Rider${appVersion ? ` · v${appVersion}` : ''}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 18,
  },
  sectionBlock: {
    gap: 10,
  },
  sectionEyebrow: {
    ...riderFont('700'),
    fontSize: 11,
    letterSpacing: 1.1,
    paddingHorizontal: 2,
  },
  themeCardsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  themeCard: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
  },
  themeSwatchTop: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    minHeight: 70,
    justifyContent: 'space-between',
  },
  themeSwatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  themeAaText: {
    ...riderFont('700'),
    fontSize: 20,
    letterSpacing: -0.3,
  },
  themeCheckBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EA580C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeAccentBar: {
    width: 30,
    height: 4,
    borderRadius: 999,
    marginTop: 10,
  },
  themeFooter: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  themeFooterTitle: {
    ...riderFont('600'),
    fontSize: 13.5,
  },
  themeFooterTitleActive: {
    ...riderFont('700'),
  },
  themeFooterSub: {
    ...riderFont('400'),
    fontSize: 11.5,
    marginTop: 2,
  },
  credentialsCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  credentialRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  credentialIconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  credentialLabel: {
    ...riderFont('500'),
    fontSize: 11.5,
  },
  credentialValue: {
    ...riderFont('600'),
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: 2,
  },
  tabularText: {
    fontVariant: ['tabular-nums'],
  },
  accountShortcutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  shortcutTitle: {
    ...riderFont('600'),
    fontSize: 14,
    lineHeight: 19,
  },
  shortcutSubtitle: {
    ...riderFont('400'),
    fontSize: 12,
    marginTop: 2,
  },
  signOutBtn: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  signOutBtnText: {
    ...riderFont('700'),
    fontSize: 14,
  },
  versionCaption: {
    ...riderFont('500'),
    fontSize: 11.5,
    textAlign: 'center',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
});
