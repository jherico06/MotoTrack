import {
  adminStyles as baseAdminStyles,
  adminDarkStyles as baseAdminDarkStyles,
  getAdminThemeTokens as baseGetAdminThemeTokens,
  createAdminStyles as baseCreateAdminStyles,
} from '../admin.styles.js';

/**
 * Web admin dark palette — unified MotoTrack Global Dark Mode tokens
 * (app/header #111315, sidebar/content #18181B, cards #191A1D, secondary/inputs #202124,
 * primary border #303236, secondary border #292B2F, input border #3A3B40).
 */
export const ADMIN_DARK_COLOR_MAP = {
  // charcoal (theme.js dark tokens)
  '#181A1D': '#111315',
  '#24272B': '#191A1D',
  '#1E2124': '#202124',
  '#1F2225': '#202124',
  '#2D3136': '#292B2F',
  '#2E3237': '#292B2F',
  '#374151': '#303236',
  '#F9FAFB': '#F5F5F5',
  '#E5E7EB': '#F2F2F3',
  '#9CA3AF': '#A1A1AA',
  '#6B7280': '#71717A',
  // legacy zinc
  '#18181B': '#191A1D',
  '#202225': '#202124',
  '#1C1C1F': '#202124',
  '#27272A': '#202124',
  '#2E2E33': '#303236',
  '#3F3F46': '#3A3B40',
  '#F4F4F5': '#F2F2F3',
  '#D4D4D8': '#A1A1AA',
  // slate
  '#0A0F1D': '#111315',
  '#0F172A': '#191A1D',
  '#1E293B': '#202124',
  '#334155': '#3A3B40',
  '#475569': '#52525B',
  '#64748B': '#71717A',
  '#94A3B8': '#A1A1AA',
  '#CBD5E1': '#A1A1AA',
  '#E2E8F0': '#F2F2F3',
  '#F1F5F9': '#F2F2F3',
  '#F8FAFC': '#F5F5F5',
  // legacy blue-charcoal
  '#121518': '#111315',
  '#1C2025': '#191A1D',
  '#181B1F': '#18181B',
  '#1E2227': '#202124',
  '#252A30': '#292B2F',
  '#282D34': '#303236',
  '#202429': '#202124',
  '#1E1E22': '#202124',
  '#272A2E': '#292B2F',
  '#14171A': '#111315',
  '#15191E': '#191A1D',
  '#1E1919': '#191A1D',
  '#AAB4B0': '#A1A1AA',
  // green-tinted neutral surfaces
  '#132A26': '#202124',
  '#142826': '#202124',
  '#141A18': '#191A1D',
  '#0E1311': '#111315',
  '#1F4742': '#3A3B40',
  '#151C19': '#202124',
  '#26332E': '#303236',
  // accent harmonization
  '#EA580C': '#FF5A00',
  '#F97316': '#FF5A00',
  '#C2410C': '#E95000',
};

const remapColor = (value) => {
  if (typeof value !== 'string') return value;
  const mapped = ADMIN_DARK_COLOR_MAP[value.toUpperCase()];
  return mapped || value;
};

function remapDeep(obj) {
  if (Array.isArray(obj)) return obj.map(remapDeep);
  if (obj && typeof obj === 'object') {
    const out = {};
    Object.keys(obj).forEach((k) => {
      out[k] = remapDeep(obj[k]);
    });
    return out;
  }
  return remapColor(obj);
}

const ZINC_DARK_TOKEN_OVERRIDES = {
  bgMain: '#111315',
  bgContent: '#18181B',
  bgCard: '#191A1D',
  bgSub: '#202124',
  bgSubtle: '#202124',
  bgHover: '#292B2F',
  bgElevated: '#202124',
  border: '#303236',
  borderLight: '#292B2F',
  divider: '#303236',
  borderInput: '#3A3B40',
  textPrimary: '#F2F2F3',
  textHeading: '#F5F5F5',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',
  textDisabled: '#52525B',
  textSubtle: '#71717A',
  placeholder: '#71717A',
  sidebarBg: '#18181B',
  topBarBg: '#18181B',
  inputBg: '#202124',
  modalBg: '#191A1D',
  accent: '#FF5A00',
  accentBrand: '#FF5A00',
  accentBg: '#3A241B',
  accentBorder: '#8A3D19',
  ctaBg: '#FF5A00',
  ctaHover: '#E95000',
  navActiveBg: '#FF5A00',
  money: '#FF5A00',
  tableHeaderBg: '#202124',
  tableRowBg: '#191A1D',
  tableRowAlt: '#202124',
  tableRowBorder: '#303236',
  chipBg: '#202124',
  chipBorder: '#303236',
  chipText: '#F2F2F3',
  badgeNeutralBg: '#202124',
  badgeNeutralText: '#A1A1AA',
  statusSuccessBg: 'rgba(0, 201, 141, 0.15)',
  statusSuccessText: '#00C98D',
  statusWarningBg: 'rgba(245, 185, 66, 0.15)',
  statusWarningText: '#F5B942',
  statusDangerBg: 'rgba(240, 68, 68, 0.15)',
  statusDangerText: '#F04444',
  statusInfoBg: 'rgba(59, 130, 246, 0.15)',
  statusInfoText: '#3B82F6',
  focusRing: 'rgba(255, 90, 0, 0.50)',
};

export const getAdminThemeTokens = (isDark = false) => {
  const base = baseGetAdminThemeTokens(isDark);
  return isDark ? { ...base, ...ZINC_DARK_TOKEN_OVERRIDES } : base;
};

function enhanceWithCharcoalTableHeaders(rawStyles, isDark = false) {
  const styles = isDark ? remapDeep(rawStyles) : rawStyles;
  return {
    ...styles,
    mainContentArea: {
      ...styles.mainContentArea,
      backgroundColor: isDark ? '#111315' : '#F3F4F6',
    },
    topContentBar: {
      ...styles.topContentBar,
      backgroundColor: isDark ? '#18181B' : '#FFFFFF',
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#303236' : '#E4E4E7',
    },
    mainScroll: {
      ...styles.mainScroll,
      backgroundColor: isDark ? '#111315' : '#F3F4F6',
      paddingBottom: 32,
    },
    // ─── Unified table design (matches the Dashboard "Recent Orders & POS Sales" table) ───
    tableCard: {
      ...styles.tableCard,
      backgroundColor: isDark ? '#191A1D' : '#FFFFFF',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDark ? '#303236' : '#E4E4E7',
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
    },
    tableHeaderRow: {
      ...styles.tableHeaderRow,
      paddingHorizontal: 20,
      paddingVertical: 11,
      backgroundColor: isDark ? '#202124' : '#F8F9FA',
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#303236' : '#E4E4E7',
    },
    tableHeaderCell: {
      ...styles.tableHeaderCell,
      fontSize: 11,
      lineHeight: 16,
      fontWeight: '600',
      color: isDark ? '#A1A1AA' : '#71717A',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    searchInputBox: {
      ...styles.searchInputBox,
      height: 40,
      borderRadius: 8,
    },
    addBtnPrimary: {
      ...styles.addBtnPrimary,
      borderRadius: 8,
    },
    quickStoreBtn: {
      ...styles.quickStoreBtn,
      borderRadius: 8,
    },
    tableRow: {
      ...styles.tableRow,
      paddingHorizontal: 20,
      paddingVertical: 13,
      minHeight: 56,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#292B2F' : '#F1F5F9',
      backgroundColor: 'transparent',
    },
    ...(isDark
      ? {
          formInput: {
            ...styles.formInput,
            backgroundColor: '#202124',
            borderColor: '#3A3B40',
            color: '#F2F2F3',
          },
          posCheckoutBtnDisabled: {
            ...styles.posCheckoutBtnDisabled,
            backgroundColor: '#202124',
            borderWidth: 1,
            borderColor: '#303236',
            shadowOpacity: 0,
            opacity: 0.72,
          },
          garageBadgeCount: {
            ...styles.garageBadgeCount,
            backgroundColor: '#202124',
          },
          mechanicAvatar: {
            ...styles.mechanicAvatar,
            backgroundColor: '#202124',
          },
        }
      : {}),
  };
}

export const adminStyles = enhanceWithCharcoalTableHeaders(baseAdminStyles, false);
export const adminDarkStyles = enhanceWithCharcoalTableHeaders(baseAdminDarkStyles, true);
export const createAdminStyles = (isDark = false) =>
  enhanceWithCharcoalTableHeaders(baseCreateAdminStyles(isDark), isDark);
export const getAdminStyles = (isDark = false) => (isDark ? adminDarkStyles : adminStyles);
export const adminWebStyles = adminStyles;

export default adminStyles;
