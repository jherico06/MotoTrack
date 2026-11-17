// =========================================================================
// MotoTrack Customer Booking - Screen 5: Downpayment Checkout
// GCash-only payment gateway checkout via Xendit with live deposit settlement
// =========================================================================

import React, { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { BootstrapIcon } from '../../common';
import { getPackageBookingStyles } from '../../../styles/web/packageBooking.web.styles.js';
import { useTheme } from '../../../context/ThemeContext.jsx';
import { formatPhp } from '../../../utils/serviceQuotation.js';
import { GARAGE_BRANCHES } from '../../../services/bookings/garageService.js';
import { systemSettingsService } from '../../../services/system/systemSettingsService.js';
import { xenditPaymentService } from '../../../services/payments/xenditPaymentService.js';

function formatDisplayDate(dateStr) {
  if (!dateStr) return 'Selected Date';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default function BookingPaymentScreen({
  currentUser: _currentUser,
  firstName: _firstName = '',
  lastName: _lastName = '',
  mobileNumber: _mobileNumber = '',
  email: _email = '',
  selectedMotorcycle,
  selectedPackages = [],
  pricingData,
  preferredDate,
  preferredTimeSlot,
  downpaymentData,
  isSubmitting = false,
  onBack,
  onCompletePayment,
  showToast,
}) {
  const { isDarkMode } = useTheme();
  const styles = useMemo(() => getPackageBookingStyles(isDarkMode), [isDarkMode]);
  const [isProcessingLocal, setIsProcessingLocal] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [pendingInvoice, setPendingInvoice] = useState(null);
  const [paymentFeedback, setPaymentFeedback] = useState('');
  const [paymentFailed, setPaymentFailed] = useState(false);
  const attemptKeyRef = useRef(`bk-dp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const submittedRef = useRef(false);

  const subtotal = pricingData?.subtotal ?? 0;
  const adminSettings = systemSettingsService.getSettings();
  const adminPitPercent = Number.isFinite(Number(adminSettings?.downpaymentPercent))
    ? Number(adminSettings.downpaymentPercent)
    : 20;

  const downpaymentPercent = downpaymentData?.downpaymentPercent ?? adminPitPercent;
  const calculatedDownpayment =
    downpaymentData?.downpaymentAmount ??
    Math.round(subtotal * (downpaymentPercent / 100));
  const calculatedRemainingBalance =
    downpaymentData?.remainingBalance ??
    Math.max(0, subtotal - calculatedDownpayment);

  const serviceTitle =
    selectedPackages.map((p) => p.name).join(' + ') || 'Service Package';
  const bikeTitle = selectedMotorcycle
    ? `${selectedMotorcycle.brand || ''} ${selectedMotorcycle.model || ''}`.trim()
    : 'Motorcycle';

  const branch = GARAGE_BRANCHES[0] || {
    name: "D'Blockchain Motorparts and Accessories",
    address: 'Natalio B. Bacalso S National Hwy, South Poblacion, Naga, 6037 Cebu',
  };

  const openCheckoutTab = useCallback((url) => {
    if (!url || typeof window === 'undefined') return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const verifyCheckoutStatus = useCallback(
    async (invoiceId, { silentPending = false } = {}) => {
      if (!invoiceId || submittedRef.current) return;
      setIsVerifying(true);
      try {
        const res = await xenditPaymentService.verifyInvoicePayment(invoiceId);
        if (res?.paid) {
          submittedRef.current = true;
          setPaymentFailed(false);
          setPaymentFeedback('GCash payment verified via Xendit. Submitting your booking...');
          await onCompletePayment?.({
            downpaymentPercent,
            downpaymentAmount: calculatedDownpayment,
            remainingBalance: calculatedRemainingBalance,
            paymentMethod: 'GCash (Xendit)',
            paymentStatus: 'paid',
            depositPaid: true,
            transactionRef: res.invoiceId || invoiceId,
            referenceNumber: res.externalId || pendingInvoice?.externalId,
            xenditPaymentId: res.paymentId || pendingInvoice?.paymentId,
            xenditInvoiceId: res.invoiceId || invoiceId,
            xenditInvoiceUrl: res.invoiceUrl || pendingInvoice?.invoiceUrl,
          });
          return;
        }

        if (res?.expired || res?.paymentStatus === 'Failed') {
          setPaymentFailed(true);
          setPaymentFeedback('Xendit checkout expired or failed. Click Cancel and start a new payment.');
          return;
        }

        if (!silentPending) {
          setPaymentFailed(false);
          setPaymentFeedback(
            'Payment is still Pending in Xendit. Complete GCash checkout in the opened tab, then click Verify Payment.'
          );
        }
      } catch (err) {
        if (!silentPending) {
          setPaymentFeedback(err?.message || 'Could not verify Xendit payment status.');
        }
      } finally {
        setIsVerifying(false);
      }
    },
    [
      calculatedDownpayment,
      calculatedRemainingBalance,
      downpaymentPercent,
      onCompletePayment,
      pendingInvoice,
    ]
  );

  // Auto-verify once when user returns to this browser tab after paying in Xendit
  useEffect(() => {
    if (!pendingInvoice?.invoiceId || paymentFailed || typeof window === 'undefined') return undefined;
    const onFocus = () => {
      verifyCheckoutStatus(pendingInvoice.invoiceId, { silentPending: true });
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [pendingInvoice?.invoiceId, paymentFailed, verifyCheckoutStatus]);

  const handlePay = async () => {
    setIsProcessingLocal(true);
    setPaymentFailed(false);
    setPaymentFeedback('');
    try {
      const payerName =
        `${_firstName} ${_lastName}`.trim() || _currentUser?.name || _currentUser?.fullName || 'Guest Rider';
      const payerEmail = _email || _currentUser?.email || 'customer@mototrack.ph';
      const payerPhone = _mobileNumber || _currentUser?.phone || '09170000000';

      const invoice = await xenditPaymentService.createBookingCheckout({
        customerId: _currentUser?.customer_id || _currentUser?.id || null,
        amount: calculatedDownpayment,
        paymentType: 'DOWNPAYMENT',
        description: `Downpayment for ${serviceTitle} (${bikeTitle})`,
        customerName: payerName,
        customerEmail: payerEmail,
        customerPhone: payerPhone,
        idempotencyKey: attemptKeyRef.current,
      });

      if (invoice?.paid) {
        await verifyCheckoutStatus(invoice.invoiceId);
        return;
      }

      setPendingInvoice(invoice);
      openCheckoutTab(invoice.invoiceUrl);
      setPaymentFeedback(
        'GCash checkout opened in a new tab. Complete your payment there, then click Verify Payment.'
      );
    } catch (err) {
      console.error('[BookingPaymentScreen] Payment error:', err);
      const msg = err?.message || 'Could not start Xendit GCash checkout. Please try again.';
      setPaymentFeedback(msg);
      showToast?.(msg);
    } finally {
      setIsProcessingLocal(false);
    }
  };

  const handleResetCheckout = () => {
    submittedRef.current = false;
    attemptKeyRef.current = `bk-dp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setPendingInvoice(null);
    setPaymentFailed(false);
    setPaymentFeedback('');
  };

  const isBusy = isSubmitting || isProcessingLocal || isVerifying;

  return (
    <View style={{ width: '100%', maxWidth: 1040, marginHorizontal: 'auto', paddingBottom: 60 }}>
      {/* ─── PAGE HEADER ─── */}
      <View style={{ marginBottom: 24, alignItems: 'center', textAlign: 'center' }}>
        <Text style={[styles.pageTitle, { textAlign: 'center' }]}>
          Pay {downpaymentPercent}% Downpayment to Reserve Slot
        </Text>
        <Text style={[styles.pageSubtitle, { textAlign: 'center', maxWidth: 680 }]}>
          A {downpaymentPercent}% deposit ({formatPhp(calculatedDownpayment)}) is required to guarantee your dedicated workshop pit slot and reserve your booking in the admin ledger.
        </Text>
      </View>

      {/* ─── DARK RESERVATION ORDER SUMMARY CARD (MATCHES IMAGE) ─── */}
      <View
        style={{
          backgroundColor: '#1E2227',
          borderRadius: 16,
          paddingVertical: 22,
          paddingHorizontal: 26,
          marginBottom: 20,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.08)',
          shadowColor: '#000000',
          shadowOpacity: 0.15,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          {/* Left Column: Summary Details */}
          <View style={{ flex: 1, minWidth: 260 }}>
            <Text
              style={{
                fontSize: 10.5,
                fontWeight: '700',
                color: '#FDBA74',
                textTransform: 'uppercase',
                letterSpacing: 1,
                marginBottom: 4,
              }}
            >
              Reservation Order Summary
            </Text>
            <Text
              style={{
                fontSize: 19,
                fontWeight: '700',
                color: '#FFFFFF',
                letterSpacing: -0.2,
              }}
              numberOfLines={2}
            >
              {serviceTitle} — {bikeTitle}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 16,
                marginTop: 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <BootstrapIcon name="calendar3" size={13} color="#9CA3AF" />
                <Text style={{ fontSize: 12.5, color: '#D1D5DB' }}>
                  {formatDisplayDate(preferredDate)} • {preferredTimeSlot || 'Pending'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <BootstrapIcon name="geo-alt" size={13} color="#9CA3AF" />
                <Text style={{ fontSize: 12.5, color: '#D1D5DB' }} numberOfLines={1}>
                  {branch.name}, {branch.address}
                </Text>
              </View>
            </View>
          </View>

          {/* Right Column: Deposit Due Big Callout */}
          <View style={{ alignItems: 'flex-end', minWidth: 160 }}>
            <Text
              style={{
                fontSize: 10.5,
                fontWeight: '700',
                color: '#FDBA74',
                textTransform: 'uppercase',
                letterSpacing: 1,
                marginBottom: 4,
              }}
            >
              {downpaymentPercent}% Deposit Due Now
            </Text>
            <Text
              style={{
                fontSize: 32,
                fontWeight: '800',
                color: '#FDBA74',
                fontVariant: ['tabular-nums'],
                letterSpacing: -0.5,
              }}
            >
              {formatPhp(calculatedDownpayment)}
            </Text>
          </View>
        </View>
      </View>

      {/* ─── WHITE PAYMENT CARD CONTAINER (MATCHES IMAGE) ─── */}
      <View
        style={{
          backgroundColor: isDarkMode ? '#191A1D' : '#FFFFFF',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: isDarkMode ? '#303236' : '#E4E4E7',
          padding: 24,
          shadowColor: '#000000',
          shadowOpacity: 0.04,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 2 },
        }}
      >
        {/* Container Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: '#71717A',
              textTransform: 'uppercase',
              letterSpacing: 0.8,
            }}
          >
            Payment Method
          </Text>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              backgroundColor: isDarkMode ? 'rgba(0, 201, 141, 0.14)' : '#ECFDF5',
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: '#A7F3D0',
            }}
          >
            <BootstrapIcon name="shield-check" size={13} color="#059669" />
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#059669' }}>
              256-bit Verified SSL
            </Text>
          </View>
        </View>

        {/* ─── GCASH PAYMENT METHOD CARD ─── */}
        <View style={{ flexDirection: 'row' }}>
          <View
            style={{
              flex: 1,
              backgroundColor: '#EFF6FF',
              borderRadius: 14,
              borderWidth: 2,
              borderColor: '#2563EB',
              padding: 18,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#2563EB',
              shadowOpacity: 0.08,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: '#007DFE',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 10,
              }}
            >
              <Text style={{ fontSize: 22, fontWeight: '700', color: '#FFFFFF', lineHeight: 24 }}>
                G
              </Text>
            </View>
            <Text style={{ fontSize: 15, fontWeight: '700', color: isDarkMode ? '#F2F2F3' : '#18181B' }}>
              GCash
            </Text>
            <Text style={{ fontSize: 12, color: '#71717A', marginTop: 2 }}>
              QRPH / E-Wallet
            </Text>
            <View
              style={{
                marginTop: 8,
                backgroundColor: '#EFF6FF',
                paddingHorizontal: 8,
                paddingVertical: 2.5,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: '#DBEAFE',
              }}
            >
              <Text style={{ fontSize: 10.5, fontWeight: '600', color: '#2563EB' }}>
                via Xendit Gateway
              </Text>
            </View>
          </View>
        </View>

        {/* ─── GCASH INTERACTIVE ACTION BOX ─── */}
        <View
          style={{
            marginTop: 18,
            backgroundColor: '#FAFAF9',
            borderRadius: 14,
            borderWidth: 1,
            borderColor: isDarkMode ? '#303236' : '#E4E4E7',
            padding: 20,
          }}
        >
          {!pendingInvoice ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 16,
              }}
            >
              {/* Left Details */}
              <View style={{ flex: 1, minWidth: 260 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: '#007DFE',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 18, fontWeight: '700', color: '#FFFFFF' }}>G</Text>
                  </View>
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: isDarkMode ? '#F2F2F3' : '#18181B' }}>
                        Pay with GCash
                      </Text>
                      <View
                        style={{
                          backgroundColor: isDarkMode ? 'rgba(0, 201, 141, 0.14)' : '#ECFDF5',
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 4,
                          borderWidth: 1,
                          borderColor: '#A7F3D0',
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#059669' }}>
                          Xendit Verified
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 12, color: isDarkMode ? '#A1A1AA' : '#52525B', marginTop: 2 }}>
                      Opens secure Xendit GCash checkout to settle your {formatPhp(calculatedDownpayment)} deposit.
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
                  <BootstrapIcon name="lock-fill" size={11} color="#71717A" />
                  <Text style={{ fontSize: 11, color: '#71717A' }}>
                    Server-verified Xendit checkout • Recorded in Supabase payments ledger
                  </Text>
                </View>
              </View>

              {/* Right Action Button */}
              <View style={{ alignItems: 'flex-end', minWidth: 200 }}>
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    backgroundColor: '#1D4ED8',
                    paddingVertical: 12,
                    paddingHorizontal: 22,
                    borderRadius: 8,
                    cursor: isBusy ? 'not-allowed' : 'pointer',
                    opacity: isBusy ? 0.75 : 1,
                    shadowColor: '#1D4ED8',
                    shadowOpacity: 0.2,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 3 },
                  }}
                  disabled={isBusy}
                  onPress={handlePay}
                  activeOpacity={0.85}
                >
                  {isBusy ? (
                    <>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>
                        Creating Checkout...
                      </Text>
                    </>
                  ) : (
                    <>
                      <BootstrapIcon name="lock-fill" size={13} color="#FFFFFF" />
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>
                        Pay {formatPhp(calculatedDownpayment)} via GCash →
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                {paymentFeedback ? (
                  <Text style={{ fontSize: 11, color: '#DC2626', marginTop: 6, fontWeight: '500' }}>
                    {paymentFeedback}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <View style={{ flex: 1, minWidth: 240 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: isDarkMode ? '#F2F2F3' : '#18181B' }}>
                      {paymentFailed ? 'GCash Payment Expired / Failed' : 'Awaiting GCash Payment Verification'}
                    </Text>
                    <View
                      style={{
                        backgroundColor: paymentFailed ? '#FEF2F2' : '#FFFBEB',
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: paymentFailed ? '#FECACA' : '#FDE68A',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10.5,
                          fontWeight: '700',
                          color: paymentFailed ? '#DC2626' : '#B45309',
                        }}
                      >
                        {paymentFailed ? 'Failed' : 'Pending'}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 12, color: isDarkMode ? '#A1A1AA' : '#52525B', marginTop: 4 }}>
                    Ref: {pendingInvoice.externalId} • Amount: {formatPhp(calculatedDownpayment)}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  {!paymentFailed && (
                    <TouchableOpacity
                      onPress={() => openCheckoutTab(pendingInvoice.invoiceUrl)}
                      style={{
                        paddingVertical: 9,
                        paddingHorizontal: 14,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: '#BFDBFE',
                        backgroundColor: '#EFF6FF',
                        cursor: 'pointer',
                      }}
                    >
                      <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#1D4ED8' }}>
                        Open GCash Checkout
                      </Text>
                    </TouchableOpacity>
                  )}

                  {!paymentFailed && (
                    <TouchableOpacity
                      disabled={isBusy}
                      onPress={() => verifyCheckoutStatus(pendingInvoice.invoiceId)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        paddingVertical: 9,
                        paddingHorizontal: 16,
                        borderRadius: 8,
                        backgroundColor: '#EA580C',
                        cursor: isBusy ? 'not-allowed' : 'pointer',
                        opacity: isBusy ? 0.75 : 1,
                      }}
                    >
                      {isBusy ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
                      <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#FFFFFF' }}>
                        {isVerifying ? 'Verifying...' : 'Verify Payment'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    disabled={isSubmitting}
                    onPress={handleResetCheckout}
                    style={{
                      paddingVertical: 9,
                      paddingHorizontal: 12,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: isDarkMode ? '#303236' : '#E4E4E7',
                      backgroundColor: isDarkMode ? '#191A1D' : '#FFFFFF',
                      cursor: 'pointer',
                    }}
                  >
                    <Text style={{ fontSize: 12.5, fontWeight: '600', color: isDarkMode ? '#A1A1AA' : '#52525B' }}>
                      {paymentFailed ? 'Try Again' : 'Cancel'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {paymentFeedback ? (
                <Text
                  style={{
                    fontSize: 12,
                    color: paymentFailed ? '#DC2626' : '#B45309',
                    fontWeight: '500',
                  }}
                >
                  {paymentFeedback}
                </Text>
              ) : null}
            </View>
          )}
        </View>

        {/* ─── BOTTOM NOTICE BANNER (MATCHES IMAGE) ─── */}
        <View
          style={{
            backgroundColor: '#FFFBEB',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#FEF3C7',
            paddingVertical: 14,
            paddingHorizontal: 18,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            marginTop: 18,
          }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: isDarkMode ? 'rgba(245, 185, 66, 0.14)' : '#FEF3C7',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BootstrapIcon name="shield-check" size={14} color="#D97706" />
          </View>
          <Text style={{ flex: 1, fontSize: 12.5, color: '#92400E', lineHeight: 18 }}>
            All payments are secured with 256-bit encryption. Settle the {downpaymentPercent}% deposit of{' '}
            <Text style={{ fontWeight: '700' }}>{formatPhp(calculatedDownpayment)}</Text> to finalize and lock your workshop pit slot. Your digital pass and payment receipt will be generated immediately.
          </Text>
        </View>
      </View>

      {/* ─── NAVIGATION ROW ─── */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-start',
          alignItems: 'center',
          marginTop: 20,
        }}
      >
        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingVertical: 10,
            paddingHorizontal: 18,
            borderRadius: 8,
            backgroundColor: '#F4F4F5',
            borderWidth: 1,
            borderColor: isDarkMode ? '#303236' : '#E4E4E7',
            cursor: 'pointer',
          }}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <BootstrapIcon name="arrow-left" size={13} color="#18181B" />
          <Text style={{ fontSize: 13, fontWeight: '600', color: isDarkMode ? '#F2F2F3' : '#18181B' }}>
            Back to Review
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
