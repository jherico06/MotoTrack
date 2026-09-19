import { StyleSheet } from 'react-native';

/** Figma Make — Sales Forecasting Dashboard Design tokens */
export function getForecastTokens(isDark = false) {
  if (isDark) {
    return {
      isDark: true,
      background: '#0d0f12',
      foreground: '#e8eaf0',
      card: '#161820',
      cardForeground: '#e8eaf0',
      primary: '#14b8a6',
      primarySoft: 'rgba(20, 184, 166, 0.12)',
      secondary: '#1e2028',
      muted: '#1e2028',
      mutedForeground: '#7b7e8e',
      border: '#272930',
      navActive: '#f0f1f5',
      navActiveText: '#111318',
      sky: '#38bdf8',
      violet: '#a78bfa',
      amber: '#fbbf24',
      forecast: '#8b5cf6',
      success: '#34d399',
      danger: '#f87171',
      warning: '#fbbf24',
    };
  }
  return {
    isDark: false,
    background: '#f5f6fa',
    foreground: '#111318',
    card: '#ffffff',
    cardForeground: '#111318',
    primary: '#0f766e',
    primarySoft: 'rgba(15, 118, 110, 0.08)',
    secondary: '#f4f5f7',
    muted: '#f0f1f5',
    mutedForeground: '#6b7280',
    border: '#e5e7eb',
    navActive: '#111318',
    navActiveText: '#ffffff',
    sky: '#0ea5e9',
    violet: '#8b5cf6',
    amber: '#f59e0b',
    forecast: '#7c3aed',
    success: '#059669',
    danger: '#dc2626',
    warning: '#d97706',
  };
}

export function createForecastStyles(isDark = false) {
  const t = getForecastTokens(isDark);

  return StyleSheet.create({
    root: {
      gap: 20,
      paddingBottom: 40,
    },

    /* ── Page header ── */
    pageHeader: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 16,
      marginBottom: 4,
    },
    pageTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: t.foreground,
      letterSpacing: -0.4,
      lineHeight: 28,
    },
    pageSubtitle: {
      fontSize: 13,
      color: t.mutedForeground,
      marginTop: 6,
      lineHeight: 19,
      maxWidth: 480,
    },
    controlsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
    },
    controlBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
      minHeight: 38,
    },
    controlBtnText: {
      fontSize: 12.5,
      fontWeight: '600',
      color: t.foreground,
    },
    generateBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      backgroundColor: t.navActive,
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 10,
      minHeight: 38,
    },
    generateBtnText: {
      fontSize: 12.5,
      fontWeight: '700',
      color: t.navActiveText,
    },

    /* ── Summary cards ── */
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 14,
    },
    statCard: {
      flexGrow: 1,
      flexBasis: '22%',
      minWidth: 160,
      backgroundColor: t.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      borderLeftWidth: 4,
      padding: 20,
    },
    statCardMobile: {
      flexBasis: '100%',
      minWidth: '100%',
    },
    statLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: t.mutedForeground,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginBottom: 10,
    },
    statValue: {
      fontSize: 28,
      fontWeight: '800',
      color: t.foreground,
      letterSpacing: -0.6,
      lineHeight: 32,
    },
    statUnit: {
      fontSize: 14,
      fontWeight: '600',
      color: t.mutedForeground,
    },
    statSub: {
      fontSize: 12,
      color: t.mutedForeground,
      marginTop: 6,
    },

    /* ── Cards ── */
    card: {
      backgroundColor: t.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      padding: 20,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 16,
      flexWrap: 'wrap',
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: t.foreground,
      letterSpacing: -0.2,
    },
    cardSubtitle: {
      fontSize: 12,
      color: t.mutedForeground,
      marginTop: 3,
      lineHeight: 17,
    },

    /* ── Period tabs (4W / 12W / 24W) ── */
    periodTabs: {
      flexDirection: 'row',
      backgroundColor: t.secondary,
      borderRadius: 10,
      padding: 3,
      borderWidth: 1,
      borderColor: t.border,
    },
    periodTab: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    periodTabActive: {
      backgroundColor: t.navActive,
    },
    periodTabText: {
      fontSize: 11.5,
      fontWeight: '700',
      color: t.mutedForeground,
    },
    periodTabTextActive: {
      color: t.navActiveText,
    },

    legendRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
      marginTop: 14,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    legendLine: {
      width: 16,
      height: 3,
      borderRadius: 2,
    },
    legendText: {
      fontSize: 11.5,
      fontWeight: '600',
      color: t.mutedForeground,
    },

    /* ── Two-column: regression + stock ── */
    splitRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 14,
    },
    splitMain: {
      flexGrow: 1,
      flexBasis: '55%',
      minWidth: 280,
    },
    splitSide: {
      flexGrow: 1,
      flexBasis: 260,
      minWidth: 260,
      maxWidth: 340,
    },

    equationBox: {
      backgroundColor: t.muted,
      borderRadius: 10,
      padding: 16,
      borderWidth: 1,
      borderColor: t.border,
      marginBottom: 14,
    },
    equationLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: t.mutedForeground,
      letterSpacing: 1.1,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    equationText: {
      fontSize: 22,
      fontWeight: '800',
      color: t.primary,
      letterSpacing: -0.4,
      fontVariant: ['tabular-nums'],
    },
    equationHint: {
      fontSize: 11,
      color: t.mutedForeground,
      marginTop: 6,
    },
    metaGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    metaItem: {
      minWidth: 110,
      flexGrow: 1,
      backgroundColor: t.secondary,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: t.border,
    },
    metaLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: t.mutedForeground,
      letterSpacing: 0.9,
      textTransform: 'uppercase',
      marginBottom: 5,
    },
    metaValue: {
      fontSize: 15,
      fontWeight: '800',
      color: t.foreground,
      fontVariant: ['tabular-nums'],
    },
    predictedBox: {
      marginTop: 14,
      backgroundColor: t.primarySoft,
      borderRadius: 10,
      padding: 14,
      borderWidth: 1,
      borderColor: t.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    predictedLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: t.primary,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    predictedValue: {
      fontSize: 20,
      fontWeight: '800',
      color: t.primary,
      fontVariant: ['tabular-nums'],
    },

    /* ── Stock optimization flow ── */
    stockHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    flowStep: {
      backgroundColor: t.secondary,
      borderRadius: 10,
      padding: 14,
      borderWidth: 1,
      borderColor: t.border,
    },
    flowStepHighlight: {
      backgroundColor: t.primarySoft,
      borderColor: t.primary,
      borderWidth: 1.5,
    },
    flowLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: t.mutedForeground,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    flowValue: {
      fontSize: 20,
      fontWeight: '800',
      color: t.foreground,
      fontVariant: ['tabular-nums'],
    },
    flowArrow: {
      alignItems: 'center',
      paddingVertical: 6,
    },
    flowArrowText: {
      fontSize: 11,
      fontWeight: '600',
      color: t.mutedForeground,
    },
    safetyNote: {
      fontSize: 11.5,
      fontWeight: '600',
      color: t.mutedForeground,
      textAlign: 'center',
      paddingVertical: 4,
    },
    safetyRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      alignItems: 'center',
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: t.border,
    },
    safetyInput: {
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.card,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 7,
      minWidth: 64,
      color: t.foreground,
      fontWeight: '700',
      fontSize: 13,
      fontVariant: ['tabular-nums'],
    },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.secondary,
    },
    chipActive: {
      backgroundColor: t.navActive,
      borderColor: t.navActive,
    },
    chipText: {
      fontSize: 11,
      fontWeight: '700',
      color: t.mutedForeground,
    },
    chipTextActive: {
      color: t.navActiveText,
    },

    /* ── Status pills ── */
    statusPill: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
    },
    statusPillText: {
      fontSize: 11,
      fontWeight: '700',
    },

    /* ── Table ── */
    tableHeader: {
      flexDirection: 'row',
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
      backgroundColor: t.secondary,
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
    },
    tableHeaderText: {
      fontSize: 10,
      fontWeight: '700',
      color: t.mutedForeground,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    tableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 13,
      paddingHorizontal: 10,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    tableRowActive: {
      backgroundColor: t.primarySoft,
    },
    tableCell: {
      fontSize: 12.5,
      color: t.mutedForeground,
      fontWeight: '500',
      fontVariant: ['tabular-nums'],
    },
    tableCellBold: {
      fontSize: 13,
      color: t.foreground,
      fontWeight: '700',
    },
    productCard: {
      backgroundColor: t.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      padding: 14,
      marginBottom: 10,
      gap: 8,
    },
    productCardActive: {
      borderColor: t.primary,
      backgroundColor: t.primarySoft,
    },

    emptyState: {
      padding: 28,
      alignItems: 'center',
      gap: 8,
    },
    emptyText: {
      fontSize: 13,
      color: t.mutedForeground,
      textAlign: 'center',
      lineHeight: 19,
    },

    historyRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
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
      label: 'In Stock',
    },
    'Low Stock': {
      bg: isDark ? 'rgba(245,158,11,0.15)' : '#FFFBEB',
      text: isDark ? '#FBBF24' : '#B45309',
      border: isDark ? 'rgba(245,158,11,0.3)' : '#FDE68A',
      label: 'Low Stock',
    },
    'Critical Stock': {
      bg: isDark ? 'rgba(239,68,68,0.15)' : '#FEF2F2',
      text: isDark ? '#F87171' : '#B91C1C',
      border: isDark ? 'rgba(239,68,68,0.3)' : '#FECACA',
      label: 'Critical',
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
      label: 'No Data',
    },
  };
  return map[status] || map['Insufficient Data'];
}
