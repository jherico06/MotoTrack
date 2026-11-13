import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BootstrapIcon } from '../../../components/common/BootstrapIcon.jsx';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useTheme } from '../../../context/ThemeContext.jsx';
import { fontFamily } from '../../../styles/typography.js';

/**
 * Web Rider Portal Gate.
 * Riders access their account, deliveries, and dispatch tools exclusively via
 * the MotoTrack mobile app; the web rider dashboard is intentionally disabled.
 */
export default function RiderDashboardWeb({ onLogout }) {
  const { currentUser, logout } = useAuth();
  const { isDarkMode } = useTheme();

  const surface = {
    canvas: isDarkMode ? '#111315' : '#F3F4F6',
    card: isDarkMode ? '#18181B' : '#FFFFFF',
    strip: isDarkMode ? '#202225' : '#F8F9FA',
    border: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E4E4E7',
    text: isDarkMode ? '#F4F4F5' : '#18181B',
    muted: isDarkMode ? '#A1A1AA' : '#64748B',
    badgeBg: isDarkMode ? 'rgba(234, 88, 12, 0.16)' : '#FFF7ED',
    badgeBorder: isDarkMode ? 'rgba(234, 88, 12, 0.35)' : '#FED7AA',
  };

  const handleSignOut = () => {
    if (onLogout) {
      onLogout();
      return;
    }
    logout();
  };

  return (
    <View style={[styles.page, { backgroundColor: surface.canvas }]}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: surface.card,
            borderColor: surface.border,
          },
        ]}
      >
        <View
          style={[
            styles.cardHeader,
            {
              backgroundColor: surface.strip,
              borderBottomColor: surface.border,
            },
          ]}
        >
          <View
            style={[
              styles.iconBadge,
              {
                backgroundColor: surface.badgeBg,
                borderColor: surface.badgeBorder,
              },
            ]}
          >
            <BootstrapIcon name="phone-fill" size={20} color="#EA580C" />
          </View>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: '#EA580C' }]}>MOTOTRACK RIDER</Text>
            <Text style={[styles.headerTitle, { color: surface.text }]}>Mobile App Only</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={[styles.title, { color: surface.text }]}>
            Rider web access is disabled
          </Text>
          <Text style={[styles.description, { color: surface.muted }]}>
            Rider accounts, active deliveries, navigation, and account settings can only be
            accessed through the MotoTrack mobile app on iOS or Android.
          </Text>

          {currentUser?.email ? (
            <View
              style={[
                styles.accountPill,
                {
                  backgroundColor: surface.strip,
                  borderColor: surface.border,
                },
              ]}
            >
              <BootstrapIcon name="person-circle" size={16} color={surface.muted} />
              <Text style={[styles.accountText, { color: surface.text }]} numberOfLines={1}>
                Signed in as {currentUser.email}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleSignOut}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <BootstrapIcon name="box-arrow-right" size={16} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Sign out &amp; return to login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    minHeight: '100vh',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  headerTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    fontWeight: '700',
  },
  cardBody: {
    padding: 24,
    gap: 14,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
  },
  description: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 21,
  },
  accountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 2,
  },
  accountText: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: 13,
    fontWeight: '500',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EA580C',
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 6,
  },
  primaryButtonText: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
