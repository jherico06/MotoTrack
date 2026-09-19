import { StyleSheet, Platform } from 'react-native';
import { ANDROID_TOP_INSET } from '../utils/safeArea';

export const signUpPageStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C6258',
  },
  innerContainer: {
    flex: 1,
    backgroundColor: '#0C6258',
    justifyContent: 'space-between',
  },

  // ─── TOP TEAL HEADER SECTION ───
  topHeroSection: {
    backgroundColor: '#0C6258',
    paddingTop: Platform.OS === 'ios' ? 44 : Math.max(24, ANDROID_TOP_INSET + 8),
    paddingHorizontal: 28,
    paddingBottom: 20,
    position: 'relative',
    minHeight: 110,
    justifyContent: 'center',
  },
  abstractOrganicShape: {
    position: 'absolute',
    top: -24,
    left: -24,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#56B9A1',
    opacity: 0.85,
  },
  abstractOrganicShapeInner: {
    position: 'absolute',
    top: 20,
    left: 20,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#0C6258',
  },

  // ─── WHITE CARD CONTAINER SHEET ───
  whiteCardSheet: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: Platform.OS === 'ios' ? 32 : 24,
    justifyContent: 'space-between',
  },

  backLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  backLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0C6258',
  },

  cardTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0C6258',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 18,
  },

  // ─── FORM INPUTS (PILL STYLE) ───
  inputGroup: {
    marginBottom: 12,
  },
  inputPill: {
    backgroundColor: '#F3F7F6',
    borderRadius: 25,
    height: 48,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  inputPillFocused: {
    borderColor: '#0C6258',
    backgroundColor: '#FFFFFF',
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },

  // ─── PASSWORD STRENGTH METER ───
  strengthMeterWrap: {
    marginTop: 4,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  strengthHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  strengthLabelText: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
  },
  strengthBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  meterTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 8,
  },
  meterFill: {
    height: '100%',
    borderRadius: 3,
  },
  criteriaGrid: {
    gap: 4,
  },
  criteriaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  criteriaText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  criteriaTextActive: {
    color: '#059669',
    fontWeight: '700',
  },

  // ─── OTP SCREEN STYLES ───
  otpHeroBox: {
    alignItems: 'center',
    marginVertical: 12,
  },
  otpIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E7F5F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  otpTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0C6258',
    marginBottom: 6,
    textAlign: 'center',
  },
  otpSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  otpTargetEmail: {
    fontWeight: '800',
    color: '#0C6258',
  },
  otpInputsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 20,
  },
  otpDigitBox: {
    width: 44,
    height: 52,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpDigitBoxActive: {
    borderColor: '#0C6258',
    backgroundColor: '#FFFFFF',
  },
  otpDigitText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0C6258',
    textAlign: 'center',
  },
  otpInstantCodeBanner: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 14,
    padding: 10,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  otpInstantCodeText: {
    fontSize: 12,
    color: '#1D4ED8',
    fontWeight: '600',
    flex: 1,
  },
  otpInstantCodeBold: {
    fontWeight: '900',
    letterSpacing: 2,
    color: '#1E40AF',
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    marginBottom: 8,
  },
  resendText: {
    fontSize: 12.5,
    color: '#64748B',
    fontWeight: '500',
  },
  resendBtnText: {
    fontSize: 12.5,
    color: '#0C6258',
    fontWeight: '800',
  },

  // ─── PRIMARY BUTTON ───
  primaryPillBtn: {
    backgroundColor: '#0C6258',
    borderRadius: 25,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: '#0C6258',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryPillBtnDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryPillBtnText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // ─── ERROR & INFO BANNER ───
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
  successBanner: {
    backgroundColor: '#D1FAE5',
    borderRadius: 14,
    padding: 10,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  successBannerText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
});
