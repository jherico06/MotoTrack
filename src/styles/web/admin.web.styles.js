import {
  adminStyles as baseAdminStyles,
  adminDarkStyles as baseAdminDarkStyles,
  getAdminStyles as baseGetAdminStyles,
  getAdminThemeTokens,
  createAdminStyles as baseCreateAdminStyles,
} from '../admin.styles.js';

function enhanceWithCharcoalTableHeaders(styles, isDark = false) {
  return {
    ...styles,
    mainContentArea: {
      ...styles.mainContentArea,
      backgroundColor: isDark ? '#111315' : '#F3F4F6',
    },
    topContentBar: {
      ...styles.topContentBar,
      backgroundColor: isDark ? '#111315' : '#F3F4F6',
      borderBottomWidth: 0,
      borderBottomColor: 'transparent',
    },
    mainScroll: {
      ...styles.mainScroll,
      backgroundColor: isDark ? '#111315' : '#F3F4F6',
      paddingBottom: 32,
    },
    // ─── Unified table design (matches the Dashboard "Recent Orders & POS Sales" table) ───
    tableCard: {
      ...styles.tableCard,
      backgroundColor: isDark ? '#18181B' : '#FFFFFF',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E4E4E7',
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
    },
    tableHeaderRow: {
      ...styles.tableHeaderRow,
      paddingHorizontal: 20,
      paddingVertical: 11,
      backgroundColor: isDark ? '#202225' : '#F8F9FA',
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E4E4E7',
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
    tableRow: {
      ...styles.tableRow,
      paddingHorizontal: 20,
      paddingVertical: 13,
      minHeight: 56,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
      backgroundColor: 'transparent',
    },
  };
}

export const adminStyles = enhanceWithCharcoalTableHeaders(baseAdminStyles, false);
export const adminDarkStyles = enhanceWithCharcoalTableHeaders(baseAdminDarkStyles, true);
export const createAdminStyles = (isDark = false) =>
  enhanceWithCharcoalTableHeaders(baseCreateAdminStyles(isDark), isDark);
export const getAdminStyles = (isDark = false) => (isDark ? adminDarkStyles : adminStyles);
export const adminWebStyles = adminStyles;

export { getAdminThemeTokens };
export default adminStyles;
