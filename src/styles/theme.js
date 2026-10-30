/**
 * MotoTrack Charcoal + Racing Orange Design System
 * 
 * - Charcoal: #24272B — primary sidebar, dark navigation, headers, and dark UI sections.
 * - Racing Orange: #EA580C — primary buttons, active navigation, important icons, highlights, and chart accents.
 * - White: #FFFFFF — cards, modals, tables, and form backgrounds.
 * - Light Gray: #F3F4F6 — main page background and secondary content areas.
 * - Dark Text: #111827 — headings, labels, and primary text on light backgrounds.
 * - Muted Text: #6B7280 — descriptions, timestamps, and secondary information.
 * - Border Gray: #E5E7EB — card borders, dividers, table borders, and input outlines.
 */

export const colors = {
  // Brand Primary & Accents
  brand: '#24272B', // Charcoal
  charcoal: '#24272B',
  charcoalDark: '#1A1D20',
  charcoalLight: '#32373D',
  charcoalNav: '#24272B',

  racingOrange: '#EA580C',
  racingOrangeHover: '#C2410C',
  brandDark: '#1A1D20',
  brandLight: '#FFF7ED',
  brandMuted: '#FED7AA',

  // Accent (action buttons, highlights, selected items)
  accent: '#EA580C',
  accentSoft: '#FFF7ED',
  accentDark: '#C2410C',

  // Neutrals — surfaces
  bg: '#F3F4F6', // Light Gray
  bgSubtle: '#F3F4F6',
  bgMainAlt: '#F3F4F6',
  surface: '#FFFFFF', // White
  border: '#E5E7EB', // Border Gray
  borderStrong: '#D1D5DB',
  borderSoft: '#F3F4F6',

  // Neutrals — type
  text: '#111827', // Dark Text
  textSecondary: '#374151',
  textMuted: '#6B7280', // Muted Text
  textSubtle: '#9CA3AF',
  textChip: '#4B5563',

  // Status Colors (Section 6: Distinctive Order & Booking Statuses)
  // Pending: Amber background with dark amber text.
  statusPendingBg: '#FEF3C7',
  statusPendingText: '#92400E',
  // Approved: Green background with dark green text.
  statusApprovedBg: '#DCFCE7',
  statusApprovedText: '#166534',
  // In Progress: Light blue background with dark blue text.
  statusInProgressBg: '#E0F2FE',
  statusInProgressText: '#075985',
  // Completed: Light green background with dark green text.
  statusCompletedBg: '#DCFCE7',
  statusCompletedText: '#166534',
  // Rejected or Cancelled: Light red background with dark red text.
  statusCancelledBg: '#FEE2E2',
  statusCancelledText: '#991B1B',

  success: '#16A34A',
  successSoft: '#DCFCE7',
  successText: '#166534',
  warning: '#D97706',
  warningSoft: '#FEF3C7',
  warningText: '#92400E',
  warningSoftAlt: '#FEF3C7',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  dangerText: '#991B1B',
  info: '#2563EB',
  infoSoft: '#E0F2FE',
  infoSoftAlt: '#DBEAFE',
  infoAlt: '#1D4ED8',

  white: '#FFFFFF',
  black: '#000000',
};

/**
 * Semantic UI tokens for light/dark admin and shared views.
 */
export function getThemeTokens(isDark = false) {
  if (isDark) {
    return {
      isDark: true,
      // Surfaces — charcoal hierarchy
      bgMain: '#181A1D',
      bgCard: '#24272B',
      bgSub: '#1E2124',
      bgSubtle: '#1F2225',
      bgHover: '#2D3136',
      bgElevated: '#2E3237',
      border: '#374151',
      borderLight: '#2D3136',
      borderInput: '#374151',
      // Type
      textPrimary: '#F9FAFB',
      textSecondary: '#E5E7EB',
      textMuted: '#9CA3AF',
      textSubtle: '#6B7280',
      placeholder: '#6B7280',
      // Chrome
      sidebarBg: '#24272B',
      topBarBg: '#1E2124',
      inputBg: '#1E2124',
      modalBg: '#24272B',
      modalOverlay: 'rgba(0, 0, 0, 0.75)',
      cardShadow: '#000000',
      // Brand / accent — Racing Orange
      accent: '#EA580C',
      accentBrand: '#EA580C',
      accentBg: 'rgba(234, 88, 12, 0.18)',
      accentBorder: 'rgba(234, 88, 12, 0.42)',
      ctaBg: '#EA580C',
      ctaHover: '#C2410C',
      navActiveBg: '#EA580C',
      navActiveText: '#FFFFFF',
      navInactiveIcon: '#FFFFFF',
      navInactiveText: '#FFFFFF',
      // Table
      tableHeaderBg: '#1E2124',
      tableRowBg: '#24272B',
      tableRowAlt: '#1F2225',
      tableRowBorder: '#374151',
      tableRowHighlight: 'rgba(245, 158, 11, 0.12)',
      tableRowDanger: 'rgba(239, 68, 68, 0.12)',
      // Chips / badges
      chipBg: '#1E2124',
      chipBorder: '#374151',
      chipText: '#E5E7EB',
      badgeNeutralBg: '#1E2124',
      badgeNeutralText: '#9CA3AF',
      statusSuccessBg: 'rgba(22, 163, 74, 0.20)',
      statusSuccessText: '#4ADE80',
      statusWarningBg: 'rgba(245, 158, 11, 0.18)',
      statusWarningText: '#FBBF24',
      statusDangerBg: 'rgba(239, 68, 68, 0.20)',
      statusDangerText: '#F87171',
      statusInfoBg: 'rgba(14, 165, 233, 0.20)',
      statusInfoText: '#38BDF8',
      statusPurpleBg: 'rgba(167, 139, 250, 0.18)',
      statusPurpleText: '#C4B5FD',
      focusRing: 'rgba(234, 88, 12, 0.50)',
      money: '#EA580C',
    };
  }

  return {
    isDark: false,
    bgMain: colors.bg,
    bgCard: colors.surface,
    bgSub: colors.bg,
    bgSubtle: colors.bgSubtle,
    bgHover: colors.bg,
    bgElevated: colors.surface,
    border: colors.border,
    borderLight: colors.border,
    borderInput: colors.border,
    textPrimary: colors.text,
    textSecondary: colors.textSecondary,
    textMuted: colors.textMuted,
    textSubtle: colors.textSubtle,
    placeholder: colors.textSubtle,
    sidebarBg: '#24272B', // Charcoal sidebar
    topBarBg: colors.surface,
    inputBg: colors.surface,
    modalBg: colors.surface,
    modalOverlay: 'rgba(17, 24, 39, 0.60)',
    cardShadow: colors.text,
    accent: colors.accent,
    accentBrand: colors.accent,
    accentBg: colors.brandLight,
    accentBorder: colors.brandMuted,
    ctaBg: colors.accent,
    ctaHover: colors.accentDark,
    navActiveBg: '#EA580C', // Racing Orange selected item background
    navActiveText: '#FFFFFF',
    navInactiveIcon: '#FFFFFF', // White inactive navigation items
    navInactiveText: '#FFFFFF',
    tableHeaderBg: '#24272B', // Charcoal table header
    tableRowBg: colors.surface,
    tableRowAlt: '#F9FAFB',
    tableRowBorder: colors.border,
    tableRowHighlight: colors.statusPendingBg,
    tableRowDanger: colors.dangerSoft,
    chipBg: colors.surface,
    chipBorder: colors.border,
    chipText: colors.textChip,
    badgeNeutralBg: colors.bgSubtle,
    badgeNeutralText: colors.textChip,
    statusSuccessBg: colors.statusApprovedBg,
    statusSuccessText: colors.statusApprovedText,
    statusWarningBg: colors.statusPendingBg,
    statusWarningText: colors.statusPendingText,
    statusDangerBg: colors.statusCancelledBg,
    statusDangerText: colors.statusCancelledText,
    statusInfoBg: colors.statusInProgressBg,
    statusInfoText: colors.statusInProgressText,
    statusPurpleBg: '#F5F3FF',
    statusPurpleText: '#7C3AED',
    focusRing: 'rgba(234, 88, 12, 0.45)',
    money: colors.accent,
  };
}

export const fonts = {
  sans: 'Inter',
  regular: 'Inter',
  extraLight: 'Inter-ExtraLight',
  light: 'Inter-Light',
  medium: 'Inter-Medium',
  semiBold: 'Inter-SemiBold',
  bold: 'Inter-Bold',
  extraBold: 'Inter-Bold',
};

export {
  fontFamily,
  fontWeights,
  fontSizes,
  lineHeights,
  letterSpacings,
  typography,
} from './typography.js';

export default colors;
