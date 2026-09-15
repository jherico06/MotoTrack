import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon';
import { gcashPaymentService, GCASH_CONFIG } from '../../services/gcashPaymentService';

export default function GCashPaymentModal({
  visible,
  amount = 0,
  orderData,
  onClose,
  onPaymentSuccess,
  showToast = () => {},
}) {
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  // Multi-step GCash flow: 'phone' -> 'otp' -> 'mpin' -> 'review' -> 'receipt'
  const [step, setStep] = useState('phone');

  // User GCash state
  const [mobileNumber, setMobileNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [mpin, setMpin] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Payment result
  const [paymentResult, setPaymentResult] = useState(null);
  const [walletBalance, setWalletBalance] = useState(150000.0);

  // Pre-fill phone from orderData or user profile on mount
  useEffect(() => {
    if (visible) {
      setStep('phone');
      setErrorMessage('');
      setOtpCode('');
      setMpin('');
      setIsProcessing(false);
      setPaymentResult(null);

      const rawPhone = orderData?.customerPhone || '09658294141';
      const clean10 = rawPhone.replace(/[^0-9]/g, '').slice(-10);
      setMobileNumber(clean10 || '9658294141');

      setWalletBalance(gcashPaymentService.getWalletBalance());
    }
  }, [visible, orderData]);

  if (!visible) return null;

  const totalAmountFormatted = Number(amount || orderData?.grandTotal || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Step 1: Submit Mobile Number -> Send OTP
  const handleProceedFromPhone = async () => {
    const clean = mobileNumber.replace(/[^0-9]/g, '');
    if (clean.length < 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number (e.g. 9658294141).');
      return;
    }
    setErrorMessage('');
    setIsProcessing(true);

    try {
      const res = await gcashPaymentService.sendOtp(clean);
      if (res.success) {
        setStep('otp');
        setOtpCode(GCASH_CONFIG.DEFAULT_TEST_OTP); // Auto-populate test OTP in sandbox
        showToast(res.message);
      } else {
        setErrorMessage(res.error || 'Failed to send verification code');
      }
    } catch (e) {
      setErrorMessage('Network connection error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async () => {
    if (!otpCode.trim() || otpCode.trim().length < 6) {
      setErrorMessage('Please enter the 6-digit authentication code.');
      return;
    }
    setErrorMessage('');
    setIsProcessing(true);

    try {
      const res = await gcashPaymentService.verifyOtp(mobileNumber, otpCode);
      if (res.success) {
        setStep('mpin');
        setMpin(GCASH_CONFIG.DEFAULT_TEST_MPIN); // Auto-populate test MPIN in sandbox
      } else {
        setErrorMessage(res.error || 'Invalid code');
      }
    } catch (e) {
      setErrorMessage('Verification failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // Step 3: Verify MPIN
  const handleVerifyMpin = async () => {
    if (!mpin.trim() || mpin.trim().length < 4) {
      setErrorMessage('Please enter your 4-digit GCash MPIN.');
      return;
    }
    setErrorMessage('');
    setIsProcessing(true);

    try {
      const res = await gcashPaymentService.verifyMpin(mobileNumber, mpin);
      if (res.success) {
        setStep('review');
      } else {
        setErrorMessage(res.error || 'Incorrect MPIN');
      }
    } catch (e) {
      setErrorMessage('Authentication failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // Step 4: Authorize & Execute Payment
  const handleAuthorizePayment = async () => {
    setErrorMessage('');
    setIsProcessing(true);

    try {
      const res = await gcashPaymentService.processPayment({
        amount: Number(amount || orderData?.grandTotal || 0),
        mobileNumber: `+63 ${mobileNumber}`,
        referenceNumber: orderData?.gcashReference,
        orderId: orderData?.orderId || null,
      });

      if (res.success) {
        setPaymentResult(res);
        setWalletBalance(res.balance_after);
        setStep('receipt');
        showToast('GCash payment authorized successfully!');
      } else {
        setErrorMessage(res.error || 'Payment failed');
      }
    } catch (e) {
      setErrorMessage('Failed to complete payment transaction');
    } finally {
      setIsProcessing(false);
    }
  };

  // Step 5: Finish and Return Order to App
  const handleFinish = () => {
    onPaymentSuccess?.({
      referenceNumber: paymentResult?.reference_number || orderData?.gcashReference || 'MP-GCASH-982104',
      paidAmount: Number(amount || orderData?.grandTotal || 0),
      payerMobile: `+63 ${mobileNumber}`,
      paidAt: new Date().toISOString(),
    });
    onClose?.();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={gStyles.overlay}>
        <View style={[gStyles.container, isDesktop && gStyles.containerDesktop]}>
          {/* ─── 1. OFFICIAL GCASH HEADER & TEST MODE BADGE ─── */}
          <View style={gStyles.gcashHeader}>
            <View style={gStyles.gcashHeaderTop}>
              <View style={gStyles.gcashBrandRow}>
                <View style={gStyles.gcashLogoCircle}>
                  <Text style={gStyles.gcashLogoG}>G</Text>
                </View>
                <Text style={gStyles.gcashBrandTitle}>GCash</Text>
              </View>

              <View style={gStyles.sandboxBadge}>
                <Text style={gStyles.sandboxBadgeText}>TEST SANDBOX</Text>
              </View>
            </View>

            {/* Test Key Information Strip */}
            <View style={gStyles.testKeyStrip}>
              <BootstrapIcon name="key-fill" size={11} color="#007DFE" />
              <Text style={gStyles.testKeyText} numberOfLines={1}>
                Test Key: {GCASH_CONFIG.TEST_PUBLIC_KEY}
              </Text>
            </View>
          </View>

          {/* ─── 2. MERCHANT & AMOUNT BANNER ─── */}
          <View style={gStyles.merchantBanner}>
            <View>
              <Text style={gStyles.merchantLabel}>Merchant:</Text>
              <Text style={gStyles.merchantName}>{GCASH_CONFIG.MERCHANT_NAME}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={gStyles.merchantLabel}>Amount to Pay:</Text>
              <Text style={gStyles.merchantAmount}>₱{totalAmountFormatted}</Text>
            </View>
          </View>

          <ScrollView style={gStyles.bodyScroll} showsVerticalScrollIndicator={false}>
            {/* ─── ERROR BANNER (IF ANY) ─── */}
            {errorMessage ? (
              <View style={gStyles.errorCard}>
                <BootstrapIcon name="exclamation-circle" size={14} color="#DC2626" />
                <Text style={gStyles.errorCardText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* ─── STEP 1: MOBILE NUMBER INPUT ─── */}
            {step === 'phone' && (
              <View style={gStyles.stepWrap}>
                <Text style={gStyles.stepHeading}>Login to pay with GCash</Text>
                <Text style={gStyles.stepSub}>Enter your 10-digit GCash registered mobile number:</Text>

                <View style={gStyles.phoneInputRow}>
                  <View style={gStyles.countryCodeWrap}>
                    <Text style={gStyles.countryFlag}>🇵🇭</Text>
                    <Text style={gStyles.countryCodeText}>+63</Text>
                  </View>
                  <TextInput
                    style={gStyles.phoneTextInput}
                    value={mobileNumber}
                    onChangeText={setMobileNumber}
                    placeholder="9658294141"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </View>

                {/* Sandbox Helper Tip */}
                <View style={gStyles.sandboxTipCard}>
                  <BootstrapIcon name="shield-check" size={14} color="#007DFE" />
                  <Text style={gStyles.sandboxTipText}>
                    <Text style={{ fontWeight: '800' }}>Sandbox Mode Active:</Text> Any Philippine test number
                    works. OTP & MPIN will be auto-verified.
                  </Text>
                </View>

                <TouchableOpacity
                  style={gStyles.primaryGcashBtn}
                  onPress={handleProceedFromPhone}
                  disabled={isProcessing}
                  activeOpacity={0.88}
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={gStyles.primaryGcashBtnText}>Next</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={gStyles.cancelBtn} onPress={onClose}>
                  <Text style={gStyles.cancelBtnText}>Cancel and return to D,Blockchain</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ─── STEP 2: 6-DIGIT OTP AUTHENTICATION ─── */}
            {step === 'otp' && (
              <View style={gStyles.stepWrap}>
                <Text style={gStyles.stepHeading}>Enter Authentication Code</Text>
                <Text style={gStyles.stepSub}>
                  Sent via SMS to{' '}
                  <Text style={{ fontWeight: '800', color: '#0F172A' }}>+63 {mobileNumber}</Text>
                </Text>

                <TextInput
                  style={gStyles.otpInputBox}
                  value={otpCode}
                  onChangeText={setOtpCode}
                  placeholder="123456"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  maxLength={6}
                  textAlign="center"
                />

                {/* Sandbox Auto-Fill Helper */}
                <TouchableOpacity
                  style={gStyles.autofillChip}
                  onPress={() => setOtpCode(GCASH_CONFIG.DEFAULT_TEST_OTP)}
                >
                  <BootstrapIcon name="stars" size={12} color="#007DFE" />
                  <Text style={gStyles.autofillChipText}>
                    Test Sandbox OTP:{' '}
                    <Text style={{ fontWeight: '900' }}>{GCASH_CONFIG.DEFAULT_TEST_OTP}</Text> (Tap to
                    Auto-fill)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={gStyles.primaryGcashBtn}
                  onPress={handleVerifyOtp}
                  disabled={isProcessing}
                  activeOpacity={0.88}
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={gStyles.primaryGcashBtnText}>Submit Code</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={gStyles.cancelBtn} onPress={() => setStep('phone')}>
                  <Text style={gStyles.cancelBtnText}>Change mobile number</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ─── STEP 3: 4-DIGIT MPIN SECURITY ─── */}
            {step === 'mpin' && (
              <View style={gStyles.stepWrap}>
                <Text style={gStyles.stepHeading}>Enter your 4-Digit MPIN</Text>
                <Text style={gStyles.stepSub}>Enter your GCash security MPIN to proceed:</Text>

                <TextInput
                  style={gStyles.mpinInputBox}
                  value={mpin}
                  onChangeText={setMpin}
                  placeholder="••••"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={true}
                  keyboardType="numeric"
                  maxLength={4}
                  textAlign="center"
                />

                {/* Sandbox Auto-Fill Helper */}
                <TouchableOpacity
                  style={gStyles.autofillChip}
                  onPress={() => setMpin(GCASH_CONFIG.DEFAULT_TEST_MPIN)}
                >
                  <BootstrapIcon name="key-fill" size={12} color="#007DFE" />
                  <Text style={gStyles.autofillChipText}>
                    Test MPIN: <Text style={{ fontWeight: '900' }}>{GCASH_CONFIG.DEFAULT_TEST_MPIN}</Text>{' '}
                    (Tap to Auto-fill)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={gStyles.primaryGcashBtn}
                  onPress={handleVerifyMpin}
                  disabled={isProcessing}
                  activeOpacity={0.88}
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={gStyles.primaryGcashBtnText}>Next</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={gStyles.cancelBtn} onPress={() => setStep('otp')}>
                  <Text style={gStyles.cancelBtnText}>Back</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ─── STEP 4: REVIEW & CONFIRM PAYMENT ─── */}
            {step === 'review' && (
              <View style={gStyles.stepWrap}>
                <Text style={gStyles.stepHeading}>Review & Confirm Payment</Text>

                {/* Wallet Balance Card */}
                <View style={gStyles.walletBalanceCard}>
                  <View
                    style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <Text style={gStyles.walletCardLabel}>GCash Available Balance:</Text>
                    <Text style={gStyles.walletCardBalance}>
                      ₱{walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                  <View style={gStyles.walletAccountRow}>
                    <Text style={gStyles.walletAccountText}>Account: +63 {mobileNumber}</Text>
                    <View style={gStyles.verifiedBadge}>
                      <BootstrapIcon name="patch-check-fill" size={11} color="#16A34A" />
                      <Text style={gStyles.verifiedBadgeText}>VERIFIED</Text>
                    </View>
                  </View>
                </View>

                {/* Payment Breakdown Card */}
                <View style={gStyles.breakdownCard}>
                  <View style={gStyles.breakdownLine}>
                    <Text style={gStyles.breakdownLabel}>Order Subtotal</Text>
                    <Text style={gStyles.breakdownVal}>₱{totalAmountFormatted}</Text>
                  </View>
                  <View style={gStyles.breakdownLine}>
                    <Text style={gStyles.breakdownLabel}>Transaction Processing Fee</Text>
                    <Text style={[gStyles.breakdownVal, { color: '#16A34A' }]}>FREE (0.00)</Text>
                  </View>
                  <View
                    style={[
                      gStyles.breakdownLine,
                      { borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 8, marginTop: 4 },
                    ]}
                  >
                    <Text
                      style={[gStyles.breakdownLabel, { fontWeight: '900', color: '#0F172A', fontSize: 13 }]}
                    >
                      Total Amount
                    </Text>
                    <Text
                      style={[gStyles.breakdownVal, { fontWeight: '900', color: '#007DFE', fontSize: 16 }]}
                    >
                      ₱{totalAmountFormatted}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[gStyles.primaryGcashBtn, { backgroundColor: '#007DFE' }]}
                  onPress={handleAuthorizePayment}
                  disabled={isProcessing}
                  activeOpacity={0.88}
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={gStyles.primaryGcashBtnText}>PAY ₱{totalAmountFormatted}</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={gStyles.cancelBtn} onPress={onClose}>
                  <Text style={gStyles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ─── STEP 5: OFFICIAL GCASH RECEIPT (PAID & VERIFIED) ─── */}
            {step === 'receipt' && (
              <View style={gStyles.receiptWrap}>
                <View style={gStyles.successIconWrap}>
                  <BootstrapIcon name="check2" size={32} color="#FFFFFF" />
                </View>
                <Text style={gStyles.receiptPaidTitle}>Payment Successful!</Text>
                <Text style={gStyles.receiptPaidSub}>
                  You have successfully paid{' '}
                  <Text style={{ fontWeight: '800', color: '#0F172A' }}>₱{totalAmountFormatted}</Text> to{' '}
                  {GCASH_CONFIG.MERCHANT_NAME}.
                </Text>

                {/* Receipt Details Box */}
                <View style={gStyles.receiptBox}>
                  <View style={gStyles.receiptLine}>
                    <Text style={gStyles.receiptLabel}>Ref No.</Text>
                    <Text style={gStyles.receiptValBold}>
                      {paymentResult?.reference_number || 'MP-GCASH-982104'}
                    </Text>
                  </View>
                  <View style={gStyles.receiptLine}>
                    <Text style={gStyles.receiptLabel}>Merchant</Text>
                    <Text style={gStyles.receiptVal}>{GCASH_CONFIG.MERCHANT_NAME}</Text>
                  </View>
                  <View style={gStyles.receiptLine}>
                    <Text style={gStyles.receiptLabel}>Payer</Text>
                    <Text style={gStyles.receiptVal}>+63 {mobileNumber}</Text>
                  </View>
                  <View style={gStyles.receiptLine}>
                    <Text style={gStyles.receiptLabel}>Date & Time</Text>
                    <Text style={gStyles.receiptVal}>
                      {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })},{' '}
                      {new Date().toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={gStyles.receiptLine}>
                    <Text style={gStyles.receiptLabel}>Remaining Balance</Text>
                    <Text style={[gStyles.receiptVal, { color: '#16A34A', fontWeight: '800' }]}>
                      ₱{walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[gStyles.primaryGcashBtn, { backgroundColor: '#16A34A', marginTop: 16 }]}
                  onPress={handleFinish}
                  activeOpacity={0.88}
                >
                  <Text style={gStyles.primaryGcashBtnText}>Continue to Live Order Tracking</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const gStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  containerDesktop: {
    maxWidth: 440,
  },

  // 1. Header
  gcashHeader: {
    backgroundColor: '#007DFE',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
  },
  gcashHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gcashBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gcashLogoCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gcashLogoG: {
    fontSize: 16,
    fontWeight: '900',
    color: '#007DFE',
  },
  gcashBrandTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  sandboxBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sandboxBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000000',
  },
  testKeyStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 10,
  },
  testKeyText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#007DFE',
  },

  // 2. Merchant Banner
  merchantBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F0F7FF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  merchantLabel: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
  },
  merchantName: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 1,
  },
  merchantAmount: {
    fontSize: 17,
    fontWeight: '900',
    color: '#007DFE',
    marginTop: 1,
  },

  bodyScroll: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    maxHeight: 460,
  },

  // Error Card
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 12,
  },
  errorCardText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '700',
    flex: 1,
  },

  // Steps
  stepWrap: {
    gap: 12,
  },
  stepHeading: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  stepSub: {
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 18,
  },

  // Inputs
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  countryCodeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  countryFlag: {
    fontSize: 16,
  },
  countryCodeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  phoneTextInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 1,
  },

  otpInputBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#007DFE',
    borderRadius: 14,
    paddingVertical: 12,
    fontSize: 24,
    fontWeight: '900',
    color: '#007DFE',
    letterSpacing: 8,
    marginTop: 8,
  },

  mpinInputBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#007DFE',
    borderRadius: 14,
    paddingVertical: 12,
    fontSize: 28,
    fontWeight: '900',
    color: '#007DFE',
    letterSpacing: 12,
    marginTop: 8,
  },

  autofillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F0F7FF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  autofillChipText: {
    fontSize: 11.5,
    color: '#0369A1',
    fontWeight: '600',
  },

  sandboxTipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sandboxTipText: {
    fontSize: 11,
    color: '#475569',
    flex: 1,
    lineHeight: 16,
  },

  walletBalanceCard: {
    backgroundColor: '#F0F7FF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    gap: 6,
  },
  walletCardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
  },
  walletCardBalance: {
    fontSize: 15,
    fontWeight: '900',
    color: '#007DFE',
  },
  walletAccountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E0F2FE',
    paddingTop: 6,
    marginTop: 2,
  },
  walletAccountText: {
    fontSize: 11.5,
    color: '#64748B',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  verifiedBadgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#166534',
  },

  breakdownCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  breakdownLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  breakdownLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  breakdownVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },

  // Buttons
  primaryGcashBtn: {
    backgroundColor: '#007DFE',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#007DFE',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryGcashBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelBtnText: {
    fontSize: 12.5,
    color: '#64748B',
    fontWeight: '700',
  },

  // Receipt
  receiptWrap: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  successIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  receiptPaidTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  receiptPaidSub: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  receiptBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 10,
    gap: 8,
  },
  receiptLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  receiptLabel: {
    fontSize: 11.5,
    color: '#64748B',
  },
  receiptVal: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  receiptValBold: {
    fontSize: 12,
    fontWeight: '900',
    color: '#007DFE',
  },
});
