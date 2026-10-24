/**
 * MotoTrack Android Theme System (Material Design 3 / M3)
 *
 * Implements Material Design 3 specifications:
 * - Tonal surface containers and color roles
 * - Material elevation tokens (Level 0 to Level 5)
 * - M3 Shapes (Small 8dp, Medium 12dp, Large 16dp, Extra Large 28dp, Full 9999dp)
 * - Native Android ripple effects
 * - Material Top App Bar & M3 80dp Navigation Bar with active pill container
 * - Edge-to-edge support with Android system navigation bar insets
 */

export const androidTokens = {
  colors: {
    // Brand & M3 Primary Roles
    primary: '#EA580C',          // Racing Orange
    onPrimary: '#FFFFFF',
    primaryContainer: 'rgba(249, 115, 22, 0.12)', // M3 Pill active container
    onPrimaryContainer: '#C2410C',

    // Secondary & Tertiary
    secondary: '#24272B',        // Charcoal
    onSecondary: '#FFFFFF',
    secondaryContainer: '#334155',
    onSecondaryContainer: '#F8FAFC',

    tertiary: '#0284C7',
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#E0F2FE',

    // M3 Surface Tonal Palette (Light)
    surface: '#FEFBFF',
    surfaceDim: '#DED8E1',
    surfaceBright: '#FEFBFF',
    surfaceContainerLowest: '#FFFFFF',
    surfaceContainerLow: '#F7F2FA',
    surfaceContainer: '#F3EDF7',
    surfaceContainerHigh: '#ECE6F0',
    surfaceContainerHighest: '#E6E0E9',

    // App Specific Surfaces
    bgHeader: '#24272B',         // Charcoal sticky header
    bgApp: '#F8FAFC',
    card: '#FFFFFF',
    outline: '#79747E',
    outlineVariant: '#E2E8F0',

    // M3 Surface Tonal Palette (Dark Mode)
    dark: {
      surface: '#141218',
      surfaceDim: '#141218',
      surfaceBright: '#3B383E',
      surfaceContainerLowest: '#0F0D13',
      surfaceContainerLow: '#1D1B20',
      surfaceContainer: '#211F26',
      surfaceContainerHigh: '#2B2930',
      surfaceContainerHighest: '#36343B',
      card: '#1E293B',
      bgHeader: '#1A1D20',
      bgApp: '#0F172A',
      outlineVariant: '#334155',
    },

    // Typography
    textPrimary: '#1D1B20',
    textSecondary: '#49454F',
    textMuted: '#64748B',
    textOnDark: '#FFFFFF',

    // Feedback
    ripple: 'rgba(249, 115, 22, 0.14)',
    rippleNeutral: 'rgba(15, 23, 42, 0.08)',

    // Status
    success: '#16A34A',
    successContainer: '#DCFCE7',
    warning: '#D97706',
    warningContainer: '#FEF3C7',
    error: '#BA1A1A',
    errorContainer: '#FFDAD6',
  },

  // M3 Elevation Tokens (DP and Android Elevation property)
  elevation: {
    level0: 0,
    level1: 1,
    level2: 3,
    level3: 6,
    level4: 8,
    level5: 12,
  },

  // M3 Shape Scale
  shapes: {
    none: 0,
    extraSmall: 4,
    small: 8,
    medium: 12,
    large: 16,
    extraLarge: 28,
    full: 9999,
  },

  // Insets & Spacing
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    topAppBarHeight: 64,
    navBarHeight: 76,
    fabSize: 56,
  },

  // M3 Typography Scale (Plus Jakarta Sans with Material standard line-heights)
  typography: {
    displayLarge: {
      fontSize: 32,
      fontWeight: '800',
      lineHeight: 40,
    },
    headlineMedium: {
      fontSize: 22,
      fontWeight: '700',
      lineHeight: 28,
    },
    titleLarge: {
      fontSize: 20,
      fontWeight: '700',
      lineHeight: 26,
    },
    titleMedium: {
      fontSize: 16,
      fontWeight: '600',
      lineHeight: 24,
      letterSpacing: 0.15,
    },
    titleSmall: {
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 20,
      letterSpacing: 0.1,
    },
    bodyLarge: {
      fontSize: 15,
      fontWeight: '400',
      lineHeight: 22,
      letterSpacing: 0.25,
    },
    bodyMedium: {
      fontSize: 13,
      fontWeight: '400',
      lineHeight: 18,
      letterSpacing: 0.25,
    },
    labelLarge: {
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 20,
      letterSpacing: 0.1,
    },
    labelMedium: {
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
      letterSpacing: 0.5,
    },
    labelSmall: {
      fontSize: 11,
      fontWeight: '600',
      lineHeight: 14,
      letterSpacing: 0.5,
    },
  },
};
