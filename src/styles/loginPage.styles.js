import { StyleSheet, Platform } from 'react-native';
import { ANDROID_TOP_INSET } from '../utils/safeArea.js';

export const loginPageStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#24272B',
  },
  innerContainer: {
    flex: 1,
    backgroundColor: '#24272B',
    justifyContent: 'space-between',
  },

  // ─── TOP DECORATIVE ART & HERO ───
  topHeroSection: {
    backgroundColor: '#24272B',
    paddingTop: 8,
    paddingHorizontal: 28,
    paddingBottom: 22,
    position: 'relative',
    minHeight: 125,
    justifyContent: 'center',
  },
  abstractOrganicShape: {
    position: 'absolute',
    top: -24,
    left: -24,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#EA580C',
    opacity: 0.25,
  },
  abstractOrganicShapeInner: {
    position: 'absolute',
    top: 20,
    left: 20,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#24272B',
  },

  heroTitle: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
  },

  // ─── DECORATIVE PLANT POT GRAPHIC ───
  plantDecorWrap: {
    position: 'absolute',
    right: 28,
    bottom: -18,
    alignItems: 'center',
    zIndex: 20,
  },
  plantLeafGroup: {
    alignItems: 'center',
    marginBottom: -6,
  },
  leftLeaf: {
    position: 'absolute',
    bottom: 24,
    left: -14,
    width: 15,
    height: 58,
    backgroundColor: '#EA580C',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    transform: [{ rotate: '-18deg' }],
  },
  centerLeaf: {
    width: 18,
    height: 80,
    backgroundColor: '#EA580C',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    marginBottom: -8,
    zIndex: 2,
  },
  rightLeaf: {
    position: 'absolute',
    bottom: 22,
    right: -14,
    width: 15,
    height: 54,
    backgroundColor: '#FB923C',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    transform: [{ rotate: '20deg' }],
  },
  plantPot: {
    width: 48,
    height: 44,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  plantPotShadow: {
    width: 52,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
    marginTop: 3,
  },

  // ─── WHITE CARD CONTAINER SHEET ───
  whiteCardSheet: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: Platform.OS === 'ios' ? 32 : 24,
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 20,
    letterSpacing: -0.3,
  },

  // ─── FORM INPUTS (PILL STYLE) ───
  inputGroup: {
    marginBottom: 14,
  },
  inputPill: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    height: 48,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputPillFocused: {
    borderColor: '#EA580C',
    backgroundColor: '#FFFFFF',
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },

  forgotPasswordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -4,
    marginBottom: 18,
  },
  forgotPasswordText: {
    fontSize: 12.5,
    color: '#EA580C',
    fontWeight: '600',
  },
  rememberMeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rememberCheckbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
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
    color: '#475569',
    fontWeight: '600',
  },

  // ─── PRIMARY BUTTON ───
  primaryPillBtn: {
    backgroundColor: '#EA580C',
    borderRadius: 10,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryPillBtnText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // ─── SOCIAL LOGIN SECTION ───
  socialDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 18,
    gap: 10,
  },
  socialDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  socialDividerText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },

  socialButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginBottom: 16,
  },
  socialIconBtn: {
    width: 48,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },

  // ─── FOOTER SWITCH LINK ───
  footerSwitchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  footerSwitchText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  footerSwitchLink: {
    fontSize: 13,
    color: '#EA580C',
    fontWeight: '800',
  },

  // ─── DEMO SHORTCUTS & ALERTS ───
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderRadius: 14,
    padding: 10,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorBannerText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  demoPillsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  demoPillBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
  },
  demoPillText: {
    fontSize: 11.5,
    color: '#EA580C',
    fontWeight: '700',
  },

  // Top Nav (Back / Guest)
  topNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 52 : ANDROID_TOP_INSET + 12,
    paddingBottom: 6,
    zIndex: 30,
  },
  navBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  navBackText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    fontWeight: '700',
  },
});
