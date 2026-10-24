/**
 * MotoTrack iOS Theme System (Apple Human Interface Guidelines)
 *
 * Implements Apple HIG visual tokens:
 * - Clean system backgrounds (#F2F2F7 in light, #000000 / #1C1C1E in dark)
 * - Translucent blur backdrops and frosted surfaces
 * - Smooth iOS border radiuses (10pt inputs, 14-16pt cards, 20pt grouped sections)
 * - Soft ambient iOS drop shadows
 * - San Francisco / Plus Jakarta Sans typography with tight tracking
 * - System brand colors: Charcoal (#24272B) + Racing Orange (#EA580C)
 */

export const iosTokens = {
  colors: {
    // Brand
    brandPrimary: '#24272B', // Charcoal
    brandAccent: '#EA580C',  // Racing Orange
    brandAccentDark: '#EA580C',
    brandAccentSubtle: '#FFF7ED',
    brandAccentMuted: '#FED7AA',

    // iOS System Backgrounds (Light)
    bgSystem: '#F2F2F7',     // iOS secondary system background
    bgCard: '#FFFFFF',       // Grouped card background
    bgElevated: '#FFFFFF',
    bgHeader: '#24272B',     // Sticky charcoal header
    bgHeaderTranslucent: 'rgba(36, 39, 43, 0.95)',
    bgFrosted: 'rgba(255, 255, 255, 0.85)',
    bgSubtle: '#F8F9FA',
    bgInput: '#E5E5EA',

    // iOS System Backgrounds (Dark Mode)
    dark: {
      bgSystem: '#000000',
      bgCard: '#1C1C1E',
      bgElevated: '#2C2C2E',
      bgHeader: '#1A1D20',
      bgHeaderTranslucent: 'rgba(26, 29, 32, 0.95)',
      bgFrosted: 'rgba(28, 28, 30, 0.85)',
      bgSubtle: '#1C1C1E',
      bgInput: '#2C2C2E',
    },

    // Typography
    textPrimary: '#000000',
    textSecondary: '#3C3C43',
    textTertiary: '#8E8E93',
    textMuted: '#8E8E93',
    textOnDark: '#FFFFFF',

    // Separators & Borders
    separator: 'rgba(60, 60, 67, 0.18)', // Standard iOS hairline separator
    separatorOpaque: '#E5E5EA',
    border: '#E5E5EA',
    borderLight: 'rgba(60, 60, 67, 0.12)',

    // System Status
    success: '#34C759',
    successBg: '#E8F9EE',
    warning: '#FF9500',
    warningBg: '#FFF4E5',
    danger: '#FF3B30',
    dangerBg: '#FFEBEA',
    info: '#007AFF',
    infoBg: '#E5F1FF',
  },

  // iOS Corner Radius Scale (Smooth Squircle-like proportions)
  radius: {
    button: 12,
    chip: 20,
    input: 10,
    card: 16,
    cardGrouped: 20,
    modal: 24,
    sheet: 28,
  },

  // iOS Shadows (Soft, wide-radius ambient shadows)
  shadows: {
    subtle: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 1,
    },
    card: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07,
      shadowRadius: 8,
      elevation: 2,
    },
    floating: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 4,
    },
    bottomBar: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: -1 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 3,
    },
  },

  // Insets & Spacing
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    tabBarHeight: 52,
    tabBarBottomPadding: 28, // Safe area home indicator
    headerHeight: 56,
  },

  // Typography Scale (Plus Jakarta Sans with iOS tracking)
  typography: {
    largeTitle: {
      fontSize: 28,
      fontWeight: '800',
      letterSpacing: -0.4,
      lineHeight: 34,
    },
    title1: {
      fontSize: 22,
      fontWeight: '700',
      letterSpacing: -0.3,
      lineHeight: 28,
    },
    title2: {
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: -0.2,
      lineHeight: 24,
    },
    headline: {
      fontSize: 16,
      fontWeight: '600',
      letterSpacing: -0.2,
      lineHeight: 22,
    },
    body: {
      fontSize: 14,
      fontWeight: '400',
      letterSpacing: -0.1,
      lineHeight: 20,
    },
    callout: {
      fontSize: 13,
      fontWeight: '500',
      letterSpacing: 0,
      lineHeight: 18,
    },
    subhead: {
      fontSize: 12,
      fontWeight: '500',
      letterSpacing: 0,
      lineHeight: 16,
    },
    footnote: {
      fontSize: 11,
      fontWeight: '400',
      letterSpacing: 0,
      lineHeight: 14,
    },
    caption: {
      fontSize: 10,
      fontWeight: '500',
      letterSpacing: 0.2,
      lineHeight: 13,
    },
  },
};
