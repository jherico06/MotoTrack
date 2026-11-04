import { StyleSheet, Platform } from 'react-native';
import { ANDROID_TOP_INSET } from '../utils/safeArea.js';

export const signUpPageStyles = StyleSheet.create({
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
    paddingBottom: 24,
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
    marginBottom: 16,
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
    paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },

  // ─── BACK TO LOGIN LINK IN SHEET ───
  sheetBackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  sheetBackText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
  },

  // ─── SHEET HEADINGS ───
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
    marginBottom: 18,
  },

  // ─── ERROR & SUCCESS BANNERS ───
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
  successBanner: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  successBannerText: {
    color: '#065F46',
    fontSize: 12.5,
    fontWeight: '500',
    flex: 1,
    lineHeight: 17,
  },

  // ─── FORM INPUTS (PALE-GRAY PILL) ───
  inputGroup: {
    marginBottom: 11,
  },
  inputPill: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    height: 48,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputPillFocused: {
    borderColor: '#EA580C',
    backgroundColor: '#FFFFFF',
  },
  textInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#0F172A',
    fontWeight: '500',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },

  // ─── TERMS & PRIVACY TEXT ───
  termsText: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 4,
    marginBottom: 14,
  },
  termsLink: {
    fontWeight: '600',
    color: '#334155',
  },

  // ─── PRIMARY FULL-WIDTH ORANGE BUTTON ───
  primaryBtn: {
    backgroundColor: '#EA580C',
    borderRadius: 14,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
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

  // ─── MODAL STYLES ───
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
    maxHeight: '80%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
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
  modalBody: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
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
    paddingBottom: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '400',
    marginBottom: 18,
  },
  backLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
    alignSelf: 'flex-start',
  },
  backLinkText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
  },
  primaryPillBtn: {
    backgroundColor: '#EA580C',
    borderRadius: 14,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  primaryPillBtnDisabled: {
    opacity: 0.7,
  },
  primaryPillBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
