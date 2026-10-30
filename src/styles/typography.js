/**
 * MOTOTRACK Typography System
 * 
 * Single source of truth for all typography standards across MOTOTRACK.
 * Font Family: Inter.
 * 
 * Standards:
 * - Page headers: 20px, weight 700
 * - Section headers: 16px, weight 700
 * - KPI figures: 28–32px, weight 800 (with tabular-nums)
 * - Card titles: 13–15px, weight 600–700
 * - Sidebar navigation: 13–14px, weight 500
 * - Active navigation items: 13–14px, weight 600
 * - Body text: 12–14px, weight 400
 * - Supporting descriptions: 11–12px, weight 400
 * - Small labels: 10–11px, weight 500
 * - Buttons and tabs: 12–14px, weight 600
 */

import { Platform } from 'react-native';

/**
 * Approved Font Family Stack — Inter.
 * System fallbacks are standard OS fallbacks only, no secondary brand fonts.
 */
export const fontFamily = {
  sans: Platform.select({
    web: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    default: 'Inter',
  }),
  // Weight-specific font names for Native platforms
  regular: Platform.select({
    web: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    default: 'Inter-Regular',
  }),
  medium: Platform.select({
    web: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    default: 'Inter-Medium',
  }),
  semiBold: Platform.select({
    web: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    default: 'Inter-SemiBold',
  }),
  bold: Platform.select({
    web: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    default: 'Inter-Bold',
  }),
  extraBold: Platform.select({
    web: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    default: 'Inter-Bold',
  }),
};

/**
 * Standard Font Weights
 */
export const fontWeights = {
  regular: '400',
  medium: '500',
  semiBold: '600',
  bold: '700',
  extraBold: '700',
};

/**
 * Standard Font Sizes (in px / pt)
 */
export const fontSizes = {
  smallLabel: 10.5,    // 10–11px
  supporting: 11.5,    // 11–12px
  body: 13,            // 12–14px
  sidebarNav: 13.5,    // 13–14px
  button: 13,          // 12–14px
  cardTitle: 14,       // 13–15px
  sectionHeader: 16,   // 16px
  pageHeader: 20,      // 20px
  kpiSm: 26,           // compact metrics
  kpi: 30,             // 28–32px default KPI
  kpiLg: 32,           // large hero KPI
};

/**
 * Standard Line Heights
 */
export const lineHeights = {
  smallLabel: 14,
  supporting: 16,
  body: 18,
  sidebarNav: 18,
  button: 18,
  cardTitle: 20,
  sectionHeader: 22,
  pageHeader: 26,
  kpi: 36,
  kpiLg: 38,
};

/**
 * Standard Letter Spacings
 */
export const letterSpacings = {
  tight: -0.5,
  snug: -0.25,
  normal: 0,
  wide: 0.25,
  wider: 0.5,
  caps: 0.8,
};

/**
 * Reusable Typography Token Presets for React Native StyleSheet.
 * Use these predefined presets across all dashboard components and screens.
 */
export const typography = {
  // Page headers: 20px, weight 700
  pageHeader: {
    fontFamily: fontFamily.sans,
    fontSize: fontSizes.pageHeader,
    lineHeight: lineHeights.pageHeader,
    fontWeight: fontWeights.bold,
    letterSpacing: letterSpacings.snug,
  },

  // Section headers: 16px, weight 600 (SemiBold)
  sectionHeader: {
    fontFamily: fontFamily.sans,
    fontSize: fontSizes.sectionHeader,
    lineHeight: lineHeights.sectionHeader,
    fontWeight: fontWeights.semiBold,
    letterSpacing: letterSpacings.snug,
  },

  // KPI figures: 28–30px, weight 700 with tabular numbers
  kpiFigure: {
    fontFamily: fontFamily.sans,
    fontSize: fontSizes.kpi,
    lineHeight: lineHeights.kpi,
    fontWeight: fontWeights.bold,
    letterSpacing: letterSpacings.tight,
    fontVariant: ['tabular-nums'],
  },

  kpiFigureCompact: {
    fontFamily: fontFamily.sans,
    fontSize: fontSizes.kpiSm,
    lineHeight: 32,
    fontWeight: fontWeights.bold,
    letterSpacing: letterSpacings.tight,
    fontVariant: ['tabular-nums'],
  },

  // Card titles: 13–15px, weight 600–700
  cardTitle: {
    fontFamily: fontFamily.sans,
    fontSize: fontSizes.cardTitle,
    lineHeight: lineHeights.cardTitle,
    fontWeight: fontWeights.semiBold,
    letterSpacing: letterSpacings.snug,
  },
  cardTitleBold: {
    fontFamily: fontFamily.sans,
    fontSize: fontSizes.cardTitle,
    lineHeight: lineHeights.cardTitle,
    fontWeight: fontWeights.bold,
    letterSpacing: letterSpacings.snug,
  },

  // Sidebar navigation: 13–14px, weight 500
  sidebarNav: {
    fontFamily: fontFamily.sans,
    fontSize: fontSizes.sidebarNav,
    lineHeight: lineHeights.sidebarNav,
    fontWeight: fontWeights.medium,
    letterSpacing: letterSpacings.normal,
  },

  // Active navigation items: 13–14px, weight 600
  sidebarNavActive: {
    fontFamily: fontFamily.sans,
    fontSize: fontSizes.sidebarNav,
    lineHeight: lineHeights.sidebarNav,
    fontWeight: fontWeights.semiBold,
    letterSpacing: letterSpacings.normal,
  },

  // Body text: 12–14px, weight 400
  body: {
    fontFamily: fontFamily.sans,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    fontWeight: fontWeights.regular,
    letterSpacing: letterSpacings.normal,
  },
  bodyMedium: {
    fontFamily: fontFamily.sans,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    fontWeight: fontWeights.medium,
    letterSpacing: letterSpacings.normal,
  },

  // Supporting descriptions: 11–12px, weight 400
  supporting: {
    fontFamily: fontFamily.sans,
    fontSize: fontSizes.supporting,
    lineHeight: lineHeights.supporting,
    fontWeight: fontWeights.regular,
    letterSpacing: letterSpacings.normal,
  },
  supportingMedium: {
    fontFamily: fontFamily.sans,
    fontSize: fontSizes.supporting,
    lineHeight: lineHeights.supporting,
    fontWeight: fontWeights.medium,
    letterSpacing: letterSpacings.normal,
  },

  // Small labels: 10–11px, weight 500 (e.g. metadata, badges, overlines)
  smallLabel: {
    fontFamily: fontFamily.sans,
    fontSize: fontSizes.smallLabel,
    lineHeight: lineHeights.smallLabel,
    fontWeight: fontWeights.medium,
    letterSpacing: letterSpacings.wide,
  },
  smallLabelCaps: {
    fontFamily: fontFamily.sans,
    fontSize: fontSizes.smallLabel,
    lineHeight: lineHeights.smallLabel,
    fontWeight: fontWeights.semiBold,
    letterSpacing: letterSpacings.caps,
    textTransform: 'uppercase',
  },

  // Buttons and tabs: 12–14px, weight 600
  button: {
    fontFamily: fontFamily.sans,
    fontSize: fontSizes.button,
    lineHeight: lineHeights.button,
    fontWeight: fontWeights.semiBold,
    letterSpacing: letterSpacings.wide,
  },
  tab: {
    fontFamily: fontFamily.sans,
    fontSize: fontSizes.button,
    lineHeight: lineHeights.button,
    fontWeight: fontWeights.semiBold,
    letterSpacing: letterSpacings.normal,
  },

  // Table styles
  tableHeader: {
    fontFamily: fontFamily.sans,
    fontSize: fontSizes.supporting,
    lineHeight: lineHeights.supporting,
    fontWeight: fontWeights.semiBold,
    letterSpacing: letterSpacings.caps,
    textTransform: 'uppercase',
  },
  tableCell: {
    fontFamily: fontFamily.sans,
    fontSize: 12.5,
    lineHeight: lineHeights.body,
    fontWeight: fontWeights.medium,
  },
  tableCellMuted: {
    fontFamily: fontFamily.sans,
    fontSize: fontSizes.supporting,
    lineHeight: lineHeights.supporting,
    fontWeight: fontWeights.regular,
  },

  // Currency & tabular figures
  currency: {
    fontFamily: fontFamily.sans,
    fontSize: fontSizes.sidebarNav,
    lineHeight: lineHeights.sidebarNav,
    fontWeight: fontWeights.semiBold,
    fontVariant: ['tabular-nums'],
  },
  currencyTotal: {
    fontFamily: fontFamily.sans,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: fontWeights.bold,
    letterSpacing: letterSpacings.snug,
    fontVariant: ['tabular-nums'],
  },
  currencyLg: {
    fontFamily: fontFamily.sans,
    fontSize: fontSizes.pageHeader,
    lineHeight: lineHeights.pageHeader,
    fontWeight: fontWeights.bold,
    letterSpacing: letterSpacings.snug,
    fontVariant: ['tabular-nums'],
  },
};

export default typography;
