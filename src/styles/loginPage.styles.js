import { StyleSheet, Platform } from 'react-native';
import { ANDROID_TOP_INSET } from '../utils/safeArea.js';

export const loginPageStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E2227',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: '#1E2227',
    justifyContent: 'space-between',
  },

  // ─── TOP CHARCOAL HEADER SECTION ───
  topHeaderSection: {
    backgroundColor: '#1E2227',
    paddingTop: Platform.OS === 'ios' ? 52 : ANDROID_TOP_INSET + 12,
    paddingHorizontal: 24,
    paddingBottom: 26,
    position: 'relative',
    overflow: 'hidden',
  },

  // ─── MINIMAL CIRCULAR WHEEL-INSPIRED ORANGE GRAPHIC ───
  wheelGraphicWrap: {
    position: 'absolute',
    bottom: -32,
    left: -32,
    width: 148,
    height: 148,
    pointerEvents: 'none',
  },
  wheelOuterRing: {
    width: 148,
    height: 148,
    borderRadius: 74,
    borderWidth: 22,
    borderColor: '#C8531D',
    opacity: 0.55,
  },

  // ─── COMPACT TOP NAVIGATION (SHOP & GUEST) ───
  topNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    zIndex: 10,
  },
  navLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  navLinkText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
  },

  // ─── HEADER HEADINGS ───
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13.5,
    color: '#94A3B8',
    fontWeight: '400',
  },

  // ─── WHITE BOTTOM SHEET ───
  whiteCardSheet: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  sheetTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '400',
    marginBottom: 22,
  },

  // ─── ERROR BANNER ───
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  errorBannerText: {
    color: '#DC2626',
    fontSize: 12.5,
    fontWeight: '500',
    flex: 1,
    lineHeight: 17,
  },

  // ─── FORM INPUTS (PALE-GRAY PILL) ───
  inputGroup: {
    marginBottom: 12,
  },
  inputPill: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    height: 50,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inputPillFocused: {
    borderColor: '#EA580C',
    backgroundColor: '#FFFFFF',
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },

  // ─── REMEMBER ME & FORGOT PASSWORD ROW ───
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: 18,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#EA580C',
    borderColor: '#EA580C',
  },
  rememberText: {
    fontSize: 12.5,
    color: '#64748B',
    fontWeight: '500',
  },
  forgotPasswordText: {
    fontSize: 12.5,
    color: '#EA580C',
    fontWeight: '600',
  },

  // ─── PRIMARY FULL-WIDTH ORANGE BUTTON ───
  primaryBtn: {
    backgroundColor: '#EA580C',
    borderRadius: 14,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  btnArrowBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },

  // ─── SOCIAL DIVIDER ───
  socialDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  socialDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  socialDividerText: {
    color: '#94A3B8',
    fontSize: 11.5,
    fontWeight: '500',
    marginHorizontal: 12,
  },

  // ─── GOOGLE SIGN-IN BUTTON ───
  googleBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 18,
  },
  googleBtnText: {
    color: '#0F172A',
    fontSize: 13.5,
    fontWeight: '600',
  },

  // ─── GOOGLE ADVISORY / FALLBACK ───
  googleAdvisoryBox: {
    marginBottom: 14,
    padding: 12,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  googleAdvisoryTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 4,
  },
  googleAdvisoryText: {
    fontSize: 11,
    color: '#78350F',
    lineHeight: 15,
    marginBottom: 8,
  },
  googleInstantTestBtn: {
    backgroundColor: '#EA580C',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  googleInstantTestText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },

  // ─── FOOTER SWITCH ROW ───
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 6,
  },
  switchText: {
    fontSize: 12.5,
    color: '#64748B',
    fontWeight: '400',
  },
  switchLink: {
    fontSize: 12.5,
    color: '#EA580C',
    fontWeight: '700',
  },

  // ─── FORGOT PASSWORD MODAL ───
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 16,
  },

  // ─── BACKWARD COMPATIBILITY ALIASES ───
  innerContainer: {
    flex: 1,
    backgroundColor: '#1E2227',
    justifyContent: 'space-between',
  },
  topHeroSection: {
    backgroundColor: '#1E2227',
    paddingTop: Platform.OS === 'ios' ? 52 : ANDROID_TOP_INSET + 12,
    paddingHorizontal: 24,
    paddingBottom: 26,
    position: 'relative',
    overflow: 'hidden',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 13.5,
    color: '#94A3B8',
    fontWeight: '400',
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  primaryPillBtn: {
    backgroundColor: '#EA580C',
    borderRadius: 14,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  primaryPillBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  footerSwitchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 6,
  },
  footerSwitchText: {
    fontSize: 12.5,
    color: '#64748B',
    fontWeight: '400',
  },
  footerSwitchLink: {
    fontSize: 12.5,
    color: '#EA580C',
    fontWeight: '700',
  },
  rememberMeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  rememberCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rememberCheckboxChecked: {
    backgroundColor: '#EA580C',
    borderColor: '#EA580C',
  },
  rememberMeText: {
    fontSize: 12.5,
    color: '#64748B',
    fontWeight: '500',
  },
  forgotPasswordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: 18,
  },
  navBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  navBackText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
  },
});
