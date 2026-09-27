/**
 * MotoTrack Road Teal — shared color palette for Shop, Admin, Rider, and web.
 * Prefer importing `colors` or `getThemeTokens()` instead of hardcoding hex.
 */

export const colors = {
  // Brand
  brand: '#1D4533',
  brandDark: '#143325',
  brandLight: '#E8F0EC',
  brandMuted: '#C8DDD3',

  // Accent (earnings / positive money)
  accent: '#10B981',
  accentSoft: '#ECFDF5',
  accentDark: '#059669',

  // Neutrals — surfaces
  bg: '#F6F8FA',
  bgSubtle: '#F1F5F9',
  bgMainAlt: '#F8FAFC',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  borderSoft: '#E8EEF2',

  // Neutrals — type
  text: '#0F172A',
  textSecondary: '#334155',
  textMuted: '#64748B',
  textSubtle: '#94A3B8',
  textChip: '#475569',

  // Status
  success: '#059669',
  successSoft: '#ECFDF5',
  successText: '#047857',
  warning: '#D97706',
  warningSoft: '#FFFBEB',
  warningText: '#B45309',
  warningSoftAlt: '#FEF3C7',
  danger: '#DC2626',
  dangerSoft: '#FEF2F2',
  dangerText: '#B91C1C',
  info: '#1D4ED8',
  infoSoft: '#EFF6FF',
  infoSoftAlt: '#DBEAFE',
  infoAlt: '#2563EB',

  white: '#FFFFFF',
  black: '#000000',
};

/**
 * Semantic UI tokens for light/dark admin (and future shared dark mode).
 * Maps palette colors into the shape used by admin.styles.js.
 */
export function getThemeTokens(isDark = false) {
  if (isDark) {
    return {
      isDark: true,
      bgMain: '#0E1311',
      bgCard: '#141A18',
      bgSub: '#1C2422',
      bgSubtle: '#18201E',
      border: 'rgba(255, 255, 255, 0.09)',
      borderLight: 'rgba(255, 255, 255, 0.05)',
      borderInput: 'rgba(255, 255, 255, 0.14)',
      textPrimary: '#F8FAFC',
      textSecondary: '#E2E8F0',
      textMuted: '#94A3B8',
      textSubtle: '#879791',
      sidebarBg: '#141A18',
      topBarBg: '#141A18',
      inputBg: '#1C2422',
      modalBg: '#141A18',
      modalOverlay: 'rgba(0, 0, 0, 0.78)',
      cardShadow: '#000000',
      accent: '#10B981',
      accentBrand: '#14B8A6',
      accentBg: 'rgba(16, 185, 129, 0.16)',
      accentBorder: 'rgba(20, 184, 166, 0.35)',
      tableHeaderBg: '#18211E',
      tableRowBg: 'transparent',
      tableRowBorder: 'rgba(255, 255, 255, 0.06)',
      tableRowHighlight: 'rgba(245, 158, 11, 0.10)',
      tableRowDanger: 'rgba(239, 68, 68, 0.10)',
      chipBg: '#1C2422',
      chipBorder: 'rgba(255, 255, 255, 0.12)',
      chipText: '#E2E8F0',
      badgeNeutralBg: '#1C2422',
      badgeNeutralText: '#CBD5E1',
      statusSuccessBg: 'rgba(16, 185, 129, 0.16)',
      statusSuccessText: '#34D399',
      statusWarningBg: 'rgba(245, 158, 11, 0.16)',
      statusWarningText: '#FBBF24',
      statusDangerBg: 'rgba(239, 68, 68, 0.16)',
      statusDangerText: '#F87171',
      statusInfoBg: 'rgba(56, 189, 248, 0.16)',
      statusInfoText: '#38BDF8',
    };
  }

  return {
    isDark: false,
    bgMain: colors.bgMainAlt,
    bgCard: colors.surface,
    bgSub: colors.bgMainAlt,
    bgSubtle: colors.bgSubtle,
    border: colors.border,
    borderLight: colors.bgSubtle,
    borderInput: colors.border,
    textPrimary: colors.text,
    textSecondary: colors.textSecondary,
    textMuted: colors.textMuted,
    textSubtle: colors.textSubtle,
    sidebarBg: colors.surface,
    topBarBg: colors.surface,
    inputBg: colors.surface,
    modalBg: colors.surface,
    modalOverlay: 'rgba(15, 23, 42, 0.5)',
    cardShadow: colors.text,
    accent: colors.brand,
    accentBrand: colors.brand,
    accentBg: colors.brandLight,
    accentBorder: colors.brandMuted,
    tableHeaderBg: '#F0F4FA',
    tableRowBg: colors.surface,
    tableRowBorder: colors.bgSubtle,
    tableRowHighlight: colors.warningSoft,
    tableRowDanger: colors.dangerSoft,
    chipBg: colors.surface,
    chipBorder: colors.border,
    chipText: colors.textChip,
    badgeNeutralBg: colors.bgSubtle,
    badgeNeutralText: colors.textChip,
    statusSuccessBg: colors.successSoft,
    statusSuccessText: colors.success,
    statusWarningBg: colors.warningSoft,
    statusWarningText: colors.warning,
    statusDangerBg: colors.dangerSoft,
    statusDangerText: colors.danger,
    statusInfoBg: colors.infoSoft,
    statusInfoText: colors.infoAlt,
  };
}

export const fonts = {
  sans: 'PlusJakartaSans',
  regular: 'PlusJakartaSans',
  extraLight: 'PlusJakartaSans-ExtraLight',
  light: 'PlusJakartaSans-Light',
  medium: 'PlusJakartaSans-Medium',
  semiBold: 'PlusJakartaSans-SemiBold',
  bold: 'PlusJakartaSans-Bold',
  extraBold: 'PlusJakartaSans-ExtraBold',
};

export default colors;
