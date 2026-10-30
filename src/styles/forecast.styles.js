import { StyleSheet } from 'react-native';

/**
 * MotoTrack Inventory Forecasting Dashboard Tokens
 * Based on the reference design: Clean Slate/White cards, soft borders, Inter typography
 */
export function getForecastTokens(isDark = false) {
  if (isDark) {
    return {
      isDark: true,
      background: '#121417',
      foreground: '#F9FAFB',
      card: '#1E2124',
      cardBorder: '#2E3236',
      cardForeground: '#F9FAFB',
      primary: '#EA580C',
      primarySoft: 'rgba(234, 88, 12, 0.14)',
      secondary: '#2E3236',
      muted: '#2E3236',
      mutedForeground: '#94A3B8',
      border: '#2E3236',
      borderSubtle: '#26292E',
      navActive: '#EA580C',
      navActiveText: '#FFFFFF',
      sky: '#38BDF8',
      blue: '#3B82F6',
      blueSoft: 'rgba(59, 130, 246, 0.16)',
      actualLine: '#3B82F6',
      trendLineColor: '#94A3B8',
      forecast: '#EA580C',
      forecastSoft: 'rgba(234, 88, 12, 0.14)',
      success: '#10B981',
      successSoft: 'rgba(16, 185, 129, 0.14)',
      danger: '#EF4444',
      warning: '#F59E0B',
      warningSoft: 'rgba(245, 158, 11, 0.14)',
      headerBg: '#1E2124',
      calloutBg: 'rgba(16, 185, 129, 0.08)',
      calloutBorder: 'rgba(16, 185, 129, 0.25)',
      darkBtnBg: '#0F172A',
      darkBtnText: '#FFFFFF',
    };
  }
  return {
    isDark: false,
    background: '#F8FAFC',
    foreground: '#0F172A',
    card: '#FFFFFF',
    cardBorder: '#E2E8F0',
    cardForeground: '#0F172A',
    primary: '#EA580C',
    primarySoft: 'rgba(234, 88, 12, 0.10)',
    secondary: '#F1F5F9',
    muted: '#F8FAFC',
    mutedForeground: '#64748B',
    border: '#E2E8F0',
    borderSubtle: '#F1F5F9',
    navActive: '#EA580C',
    navActiveText: '#FFFFFF',
    sky: '#0284C7',
    blue: '#2563EB',
    blueSoft: '#EFF6FF',
    actualLine: '#2563EB',
    trendLineColor: '#94A3B8',
    forecast: '#EA580C',
    forecastSoft: 'rgba(234, 88, 12, 0.10)',
    success: '#059669',
    successSoft: '#ECFDF5',
    danger: '#DC2626',
    warning: '#D97706',
    warningSoft: '#FFFBEB',
    headerBg: '#FFFFFF',
    calloutBg: '#F0FDF4',
    calloutBorder: '#DCFCE7',
    darkBtnBg: '#111827',
    darkBtnText: '#FFFFFF',
  };
}

export function createForecastStyles(isDark = false) {
  const t = getForecastTokens(isDark);

  return StyleSheet.create({
    root: {
      gap: 16,
      paddingBottom: 48,
    },

    /* ── Top Header Bar ── */
    topBackLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
      alignSelf: 'flex-start',
    },
    topBackText: {
      fontSize: 12.5,
      fontWeight: '500',
      color: t.mutedForeground,
    },
    pageHeaderRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 16,
      marginBottom: 2,
      position: 'relative',
      zIndex: 60,
    },
    headerTitleCol: {
      flex: 1,
      minWidth: 260,
    },
    pageTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
    },
    pageTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: t.foreground,
      letterSpacing: -0.3,
      lineHeight: 28,
    },
    pageSubtitle: {
      fontSize: 12.5,
      fontWeight: '400',
      color: t.mutedForeground,
      marginTop: 4,
      lineHeight: 18,
      maxWidth: 580,
    },
    headerActionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-end',
      gap: 12,
      position: 'relative',
      zIndex: 60,
    },
    controlGroup: {
      gap: 4,
    },
    controlGroupLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: t.mutedForeground,
      letterSpacing: 0.2,
    },
    selectBox: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.cardBorder,
      borderRadius: 9,
      paddingHorizontal: 12,
      paddingVertical: 8,
      minHeight: 40,
      minWidth: 140,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.03,
      shadowRadius: 2,
      elevation: 1,
    },
    productThumbnail: {
      width: 24,
      height: 24,
      borderRadius: 6,
      backgroundColor: isDark ? '#2E3236' : '#F1F5F9',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    selectBoxText: {
      fontSize: 12.5,
      fontWeight: '600',
      color: t.foreground,
    },
    darkGenerateBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      backgroundColor: t.darkBtnBg,
      borderRadius: 9,
      paddingHorizontal: 16,
      paddingVertical: 10,
      minHeight: 40,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 4,
      elevation: 2,
    },
    darkGenerateBtnText: {
      fontSize: 12.5,
      fontWeight: '600',
      color: t.darkBtnText,
      letterSpacing: 0.1,
    },
    orangeGenerateBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      backgroundColor: t.primary,
      borderRadius: 9,
      paddingHorizontal: 16,
      paddingVertical: 10,
      minHeight: 40,
      shadowColor: t.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 5,
      elevation: 2,
    },
    orangeGenerateBtnText: {
      fontSize: 12.5,
      fontWeight: '600',
      color: '#FFFFFF',
      letterSpacing: 0.1,
    },

    /* ── Row 2: 5 KPI Summary Cards ── */
    kpiRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      position: 'relative',
      zIndex: 1,
    },
    kpiCard: {
      flex: 1,
      minWidth: 180,
      backgroundColor: t.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: t.cardBorder,
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 1,
      justifyContent: 'space-between',
      minHeight: 110,
    },
    kpiCardMobile: {
      flexBasis: '100%',
      minWidth: '100%',
      minHeight: 'auto',
    },
    kpiTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8,
    },
    kpiIconSquare: {
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    kpiLabel: {
      fontSize: 11.5,
      fontWeight: '500',
      color: t.mutedForeground,
      flex: 1,
    },
    kpiValueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 6,
    },
    kpiValue: {
      fontSize: 26,
      lineHeight: 30,
      fontWeight: '700',
      color: t.foreground,
      letterSpacing: -0.4,
      fontVariant: ['tabular-nums'],
    },
    kpiUnit: {
      fontSize: 12.5,
      fontWeight: '400',
      color: t.mutedForeground,
    },
    kpiSubBadge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 7,
      paddingVertical: 2.5,
      borderRadius: 6,
      marginTop: 6,
    },
    kpiSubBadgeText: {
      fontSize: 11,
      fontWeight: '600',
    },
    kpiSubText: {
      fontSize: 11,
      color: t.mutedForeground,
      fontWeight: '400',
      marginTop: 4,
    },

    /* ── Cards General ── */
    card: {
      backgroundColor: t.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.cardBorder,
      padding: 18,
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 1,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 14,
      flexWrap: 'wrap',
    },
    cardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    cardTitle: {
      fontSize: 14.5,
      fontWeight: '700',
      color: t.foreground,
      letterSpacing: -0.2,
    },

    /* ── Middle Row: Chart (Left) + Forecast Details (Right) ── */
    middleRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 14,
    },
    chartCol: {
      flexGrow: 1,
      flexBasis: '64%',
      minWidth: 320,
    },
    detailsCol: {
      flexGrow: 1,
      flexBasis: '32%',
      minWidth: 280,
    },

    /* Chart Segmented Pill Tabs (Daily | Weekly | Monthly) */
    pillTabsRow: {
      flexDirection: 'row',
      backgroundColor: isDark ? '#2E3236' : '#F1F5F9',
      borderRadius: 8,
      padding: 3,
      gap: 2,
    },
    pillTab: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 6,
    },
    pillTabActive: {
      backgroundColor: t.primary,
    },
    pillTabText: {
      fontSize: 11.5,
      fontWeight: '600',
      color: t.mutedForeground,
    },
    pillTabTextActive: {
      color: '#FFFFFF',
    },

    /* Chart Legend */
    chartLegendRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 18,
      marginTop: 2,
      marginBottom: 8,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    legendSquare: {
      width: 9,
      height: 9,
      borderRadius: 2,
    },
    legendLine: {
      width: 14,
      height: 2,
      borderRadius: 1,
    },
    legendText: {
      fontSize: 11,
      fontWeight: '500',
      color: t.mutedForeground,
    },

    /* Key-Value Details Rows (Forecast Details & Inventory Analysis) */
    keyValueList: {
      gap: 10,
    },
    keyValueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: t.borderSubtle,
    },
    keyValueLabel: {
      fontSize: 12,
      fontWeight: '400',
      color: t.mutedForeground,
    },
    keyValueVal: {
      fontSize: 12.5,
      fontWeight: '600',
      color: t.foreground,
      fontVariant: ['tabular-nums'],
    },

    /* Callout Highlight Cards */
    calloutCard: {
      marginTop: 14,
      borderRadius: 10,
      padding: 14,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 10,
      alignItems: 'flex-start',
    },
    calloutTitle: {
      fontSize: 13,
      fontWeight: '700',
      marginBottom: 3,
    },
    calloutText: {
      fontSize: 11.5,
      lineHeight: 16,
      fontWeight: '400',
    },

    /* ── Bottom Row: 3 Equal-Width Columns ── */
    bottomRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 14,
    },
    bottomCol: {
      flex: 1,
      minWidth: 280,
    },

    /* Table Styles */
    tableHeaderRow: {
      flexDirection: 'row',
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderBottomWidth: 1,
      borderBottomColor: t.cardBorder,
      backgroundColor: isDark ? '#26292E' : '#F8FAFC',
      borderRadius: 6,
      marginBottom: 4,
    },
    tableHeaderCell: {
      fontSize: 11,
      fontWeight: '600',
      color: t.mutedForeground,
      textTransform: 'none',
      letterSpacing: 0.1,
    },
    tableDataRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 9,
      paddingHorizontal: 8,
      borderBottomWidth: 1,
      borderBottomColor: t.borderSubtle,
    },
    tableDataCell: {
      fontSize: 12,
      fontWeight: '500',
      color: t.foreground,
      fontVariant: ['tabular-nums'],
    },
    tableDataCellMuted: {
      fontSize: 12,
      fontWeight: '400',
      color: t.mutedForeground,
      fontVariant: ['tabular-nums'],
    },
    paginationBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 12,
      marginTop: 6,
      borderTopWidth: 1,
      borderTopColor: t.borderSubtle,
    },
    paginationCountText: {
      fontSize: 11.5,
      color: t.mutedForeground,
      fontWeight: '400',
    },
    paginationButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    paginationBtn: {
      width: 26,
      height: 26,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#26292E' : '#F1F5F9',
    },
    paginationBtnActive: {
      backgroundColor: t.primary,
    },
    paginationBtnText: {
      fontSize: 11.5,
      fontWeight: '600',
      color: t.foreground,
    },
    paginationBtnTextActive: {
      color: '#FFFFFF',
    },
    reorderBadge: {
      alignSelf: 'flex-start',
      marginTop: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.16)' : '#DCFCE7',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(16, 185, 129, 0.35)' : '#86EFAC',
    },
    reorderBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: isDark ? '#34D399' : '#15803D',
    },

    /* Trend & Insights items */
    insightItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingVertical: 7,
    },
    insightCircle: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    insightTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: t.foreground,
    },
    insightSub: {
      fontSize: 11.5,
      color: t.mutedForeground,
      marginTop: 2,
      lineHeight: 15,
    },
    sectionDivider: {
      height: 1,
      backgroundColor: t.cardBorder,
      marginVertical: 10,
    },
    subSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    subSectionTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: t.foreground,
    },

    /* Dropdown Menus */
    dropdownMenu: {
      position: 'absolute',
      top: '100%',
      right: 0,
      marginTop: 6,
      minWidth: 180,
      backgroundColor: t.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: t.cardBorder,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 20,
      zIndex: 1000,
      overflow: 'hidden',
    },
    dropdownItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: t.borderSubtle,
    },
    dropdownItemActive: {
      backgroundColor: isDark ? 'rgba(234, 88, 12, 0.14)' : '#FFF7ED',
    },
    dropdownItemText: {
      fontSize: 12.5,
      fontWeight: '500',
      color: t.foreground,
    },
  });
}

export function getForecastStyles(isDark = false) {
  return createForecastStyles(isDark);
}

export function getStockStatusColors(status, isDark = false) {
  const t = getForecastTokens(isDark);
  const map = {
    'Healthy Stock': {
      bg: isDark ? 'rgba(16,185,129,0.15)' : '#ECFDF5',
      text: isDark ? '#34D399' : '#047857',
      border: isDark ? 'rgba(16,185,129,0.3)' : '#A7F3D0',
      label: 'Stock Sufficient',
    },
    'Low Stock': {
      bg: isDark ? 'rgba(245,158,11,0.15)' : '#FFFBEB',
      text: isDark ? '#FBBF24' : '#B45309',
      border: isDark ? 'rgba(245,158,11,0.3)' : '#FDE68A',
      label: 'Reorder Soon',
    },
    'Critical Stock': {
      bg: isDark ? 'rgba(239,68,68,0.15)' : '#FEF2F2',
      text: isDark ? '#F87171' : '#B91C1C',
      border: isDark ? 'rgba(239,68,68,0.3)' : '#FECACA',
      label: 'Stockout Risk',
    },
    Overstocked: {
      bg: isDark ? 'rgba(59,130,246,0.15)' : '#EFF6FF',
      text: isDark ? '#60A5FA' : '#1D4ED8',
      border: isDark ? 'rgba(59,130,246,0.3)' : '#BFDBFE',
      label: 'Overstocked',
    },
    'Insufficient Data': {
      bg: t.muted,
      text: t.mutedForeground,
      border: t.border,
      label: 'Insufficient Data',
    },
  };
  return map[status] || map['Insufficient Data'];
}
