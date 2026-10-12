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
 *
 * Dark mode: charcoal / graphite enterprise surfaces (not pure black).
 */
export function getThemeTokens(isDark = false) {
  if (isDark) {
    return {
      isDark: true,
      // Surfaces — charcoal hierarchy
      bgMain: '#0F1412',
      bgCard: '#151C19',
      bgSub: '#1A2320',
      bgSubtle: '#18201D',
      bgHover: '#1E2824',
      bgElevated: '#1C2622',
      border: '#26332E',
      borderLight: '#1F2A26',
      borderInput: '#2F3F39',
      // Type
      textPrimary: '#F5F7F6',
      textSecondary: '#E3E8E6',
      textMuted: '#AAB4B0',
      textSubtle: '#8A9591',
      placeholder: '#7E8A86',
      // Chrome
      sidebarBg: '#111715',
      topBarBg: '#151C19',
      inputBg: '#1A2320',
      modalBg: '#151C19',
      modalOverlay: 'rgba(8, 12, 10, 0.72)',
      cardShadow: '#000000',
      // Brand / accent — charcoal base with clear teal on important UI
      accent: '#2A8F6E',
      accentBrand: '#4DB896',
      accentBg: 'rgba(77, 184, 150, 0.14)',
      accentBorder: 'rgba(77, 184, 150, 0.38)',
      ctaBg: '#1F6B52',
      navActiveBg: '#1A2622',
      navInactiveIcon: '#AAB4B0',
      // Table
      tableHeaderBg: '#121A17',
      tableRowBg: '#151C19',
      tableRowAlt: '#181F1C',
      tableRowBorder: '#26332E',
      tableRowHighlight: 'rgba(245, 158, 11, 0.10)',
      tableRowDanger: 'rgba(239, 68, 68, 0.10)',
      // Chips / badges — soft fills, readable tinted labels
      chipBg: '#1A2320',
      chipBorder: '#2F3F39',
      chipText: '#E3E8E6',
      badgeNeutralBg: '#1A2320',
      badgeNeutralText: '#C5CEC9',
      statusSuccessBg: 'rgba(16, 185, 129, 0.16)',
      statusSuccessText: '#5FBF9A',
      statusWarningBg: 'rgba(245, 158, 11, 0.14)',
      statusWarningText: '#E0B35C',
      statusDangerBg: 'rgba(239, 68, 68, 0.14)',
      statusDangerText: '#E07A7A',
      statusInfoBg: 'rgba(56, 189, 248, 0.14)',
      statusInfoText: '#6BA8D4',
      statusPurpleBg: 'rgba(167, 139, 250, 0.14)',
      statusPurpleText: '#A78BDB',
      focusRing: 'rgba(77, 184, 150, 0.50)',
      money: '#5FBF9A',
    };
  }

  return {
    isDark: false,
    bgMain: colors.bgMainAlt,
    bgCard: colors.surface,
    bgSub: colors.bgMainAlt,
    bgSubtle: colors.bgSubtle,
    bgHover: '#F1F5F9',
    bgElevated: colors.surface,
    border: colors.border,
    borderLight: colors.bgSubtle,
    borderInput: colors.border,
    textPrimary: colors.text,
    textSecondary: colors.textSecondary,
    textMuted: colors.textMuted,
    textSubtle: colors.textSubtle,
    placeholder: colors.textSubtle,
    sidebarBg: '#1D4533',
    topBarBg: colors.surface,
    inputBg: colors.surface,
    modalBg: colors.surface,
    modalOverlay: 'rgba(15, 23, 42, 0.5)',
    cardShadow: colors.text,
    accent: colors.brand,
    accentBrand: colors.brand,
    accentBg: colors.brandLight,
    accentBorder: colors.brandMuted,
    ctaBg: colors.brand,
    navActiveBg: '#0F172A',
    navInactiveIcon: '#64748B',
    tableHeaderBg: '#F8FAF9',
    tableRowBg: colors.surface,
    tableRowAlt: colors.bgMainAlt,
    tableRowBorder: '#F0F3F1',
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
    statusPurpleBg: '#F5F3FF',
    statusPurpleText: '#7C3AED',
    focusRing: 'rgba(29, 69, 51, 0.45)',
    money: colors.brand,
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
