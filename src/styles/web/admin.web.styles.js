import {
  adminStyles as baseAdminStyles,
  adminDarkStyles as baseAdminDarkStyles,
  getAdminStyles as baseGetAdminStyles,
  getAdminThemeTokens,
  createAdminStyles as baseCreateAdminStyles,
} from '../admin.styles.js';

const CHARCOAL = '#24272B'; // MotoTrack Charcoal brand color for table headers

function enhanceWithCharcoalTableHeaders(styles, isDark = false) {
  return {
    ...styles,
    tableHeaderRow: {
      ...styles.tableHeaderRow,
      backgroundColor: CHARCOAL,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#374151' : '#32373D',
    },
    tableHeaderCell: {
      ...styles.tableHeaderCell,
      color: '#CBD5E1', // High-contrast silver/slate for charcoal table headers
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
