/**
 * MotoTrack Road Teal — shared color palette for Shop, Admin, Rider, and web.
 * Prefer importing `colors` or `getThemeTokens()` instead of hardcoding hex.
 */

export const colors = {
  // Brand
  brand: '#0C6258',
  brandDark: '#084A43',
  brandLight: '#E7F5F3',
  brandMuted: '#D1ECE6',

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
      bgMain: '#0B0F19',
      bgCard: '#111827',
      bgSub: '#1E293B',
      bgSubtle: '#182234',
      border: 'rgba(255, 255, 255, 0.08)',
      borderLight: 'rgba(255, 255, 255, 0.05)',
      borderInput: 'rgba(255, 255, 255, 0.12)',
      textPrimary: '#F8FAFC',
      textSecondary: '#E2E8F0',
      textMuted: colors.textSubtle,
      textSubtle: colors.textMuted,
      sidebarBg: '#111827',
      topBarBg: '#111827',
      inputBg: '#1E293B',
      modalBg: '#111827',
      modalOverlay: 'rgba(0, 0, 0, 0.75)',
      cardShadow: colors.black,
      accent: colors.brand,
      accentBrand: colors.brand,
      accentBg: 'rgba(12, 98, 88, 0.15)',
      accentBorder: 'rgba(12, 98, 88, 0.3)',
      tableHeaderBg: '#162032',
      tableRowBg: 'transparent',
      tableRowBorder: 'rgba(255, 255, 255, 0.05)',
      tableRowHighlight: 'rgba(245, 158, 11, 0.08)',
      tableRowDanger: 'rgba(239, 68, 68, 0.08)',
      chipBg: '#1E293B',
      chipBorder: '#334155',
      chipText: colors.textSubtle,
      badgeNeutralBg: '#1E293B',
      badgeNeutralText: colors.borderStrong,
      statusSuccessBg: 'rgba(16, 185, 129, 0.12)',
      statusSuccessText: '#34D399',
      statusWarningBg: 'rgba(245, 158, 11, 0.12)',
      statusWarningText: '#FBBF24',
      statusDangerBg: 'rgba(239, 68, 68, 0.12)',
      statusDangerText: '#F87171',
      statusInfoBg: 'rgba(59, 130, 246, 0.12)',
      statusInfoText: '#60A5FA',
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
  sans: 'Manrope',
  regular: 'Manrope',
  extraLight: 'Manrope-ExtraLight',
  light: 'Manrope-Light',
  medium: 'Manrope-Medium',
  semiBold: 'Manrope-SemiBold',
  bold: 'Manrope-Bold',
  extraBold: 'Manrope-ExtraBold',
};

export default colors;
