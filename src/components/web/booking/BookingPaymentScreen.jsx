// =========================================================================
// MotoTrack Customer Booking - Screen 5: Downpayment Checkout
// Matches payment gateway design: GCash, Maya, Bank Transfer with live deposit settlement
// =========================================================================

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { BootstrapIcon } from '../../common';
import { packageBookingStyles as styles } from '../../../styles/web/packageBooking.web.styles.js';
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
  const [selectedChannel, setSelectedChannel] = useState('GCash');
  const [bankRef, setBankRef] = useState('');
  const [isProcessingLocal, setIsProcessingLocal] = useState(false);

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

  const handlePay = async () => {
    if (selectedChannel === 'Bank Transfer' && !bankRef.trim()) {
      showToast?.('Please enter your bank transfer reference number.');
      return;
    }

    setIsProcessingLocal(true);
    try {
      const payerName = `${_firstName} ${_lastName}`.trim() || _currentUser?.name || _currentUser?.fullName || 'Guest Rider';
      const payerEmail = _email || _currentUser?.email || 'customer@mototrack.ph';
      const payerPhone = _mobileNumber || _currentUser?.phone || '0917-882-9102';

      // 1. Process payment via Xendit API & record transaction in Supabase
      const xenditRes = await xenditPaymentService.processBookingDownpayment({
        amount: calculatedDownpayment,
        paymentMethod: selectedChannel,
        description: `Downpayment for ${serviceTitle} (${bikeTitle})`,
        customerName: payerName,
        customerEmail: payerEmail,
        customerPhone: payerPhone,
      });

      const generatedRef =
        selectedChannel === 'Bank Transfer'
          ? bankRef.trim()
          : xenditRes?.transactionRef || xenditRes?.referenceNumber;

      await onCompletePayment?.({
        downpaymentPercent,
        downpaymentAmount: calculatedDownpayment,
        remainingBalance: calculatedRemainingBalance,
        paymentMethod: `${selectedChannel} (Xendit)`,
        paymentStatus: 'paid',
        depositPaid: true,
        transactionRef: generatedRef,
        xenditInvoiceId: xenditRes?.invoice?.invoiceId,
        xenditInvoiceUrl: xenditRes?.invoice?.invoiceUrl,
      });
    } catch (err) {
      console.error('[BookingPaymentScreen] Payment error:', err);
      showToast?.(err?.message || 'Payment processing failed. Please try again.');
    } finally {
      setIsProcessingLocal(false);
    }
  };

  const isBusy = isSubmitting || isProcessingLocal;

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
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: '#E4E4E7',
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
            Choose Payment Channel
          </Text>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              backgroundColor: '#ECFDF5',
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

        {/* ─── 3 PAYMENT CHANNEL CARDS ROW ─── */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {/* Channel 1: GCash */}
          <TouchableOpacity
            style={{
              flex: 1,
              minWidth: 200,
              backgroundColor: selectedChannel === 'GCash' ? '#EFF6FF' : '#FFFFFF',
              borderRadius: 14,
              borderWidth: selectedChannel === 'GCash' ? 2 : 1,
              borderColor: selectedChannel === 'GCash' ? '#2563EB' : '#E4E4E7',
              padding: 18,
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              shadowColor: selectedChannel === 'GCash' ? '#2563EB' : 'transparent',
              shadowOpacity: selectedChannel === 'GCash' ? 0.08 : 0,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
            }}
            onPress={() => setSelectedChannel('GCash')}
            activeOpacity={0.8}
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
              <Text style={{ fontSize: 22, fontWeight: '900', color: '#FFFFFF', lineHeight: 24 }}>
                G
              </Text>
            </View>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#18181B' }}>
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
          </TouchableOpacity>

          {/* Channel 2: Maya */}
          <TouchableOpacity
            style={{
              flex: 1,
              minWidth: 200,
              backgroundColor: selectedChannel === 'Maya' ? '#F0FDF4' : '#FFFFFF',
              borderRadius: 14,
              borderWidth: selectedChannel === 'Maya' ? 2 : 1,
              borderColor: selectedChannel === 'Maya' ? '#059669' : '#E4E4E7',
              padding: 18,
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              shadowColor: selectedChannel === 'Maya' ? '#059669' : 'transparent',
              shadowOpacity: selectedChannel === 'Maya' ? 0.08 : 0,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
            }}
            onPress={() => setSelectedChannel('Maya')}
            activeOpacity={0.8}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: '#00D632',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 10,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5 }}>
                maya
              </Text>
            </View>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#18181B' }}>
              Maya
            </Text>
            <Text style={{ fontSize: 12, color: '#71717A', marginTop: 2 }}>
              Maya App • QR Ph
            </Text>
            <View
              style={{
                marginTop: 8,
                backgroundColor: '#ECFDF5',
                paddingHorizontal: 8,
                paddingVertical: 2.5,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: '#A7F3D0',
              }}
            >
              <Text style={{ fontSize: 10.5, fontWeight: '600', color: '#059669' }}>
                via Xendit Gateway
              </Text>
            </View>
          </TouchableOpacity>

          {/* Channel 3: Bank Transfer */}
          <TouchableOpacity
            style={{
              flex: 1,
              minWidth: 200,
              backgroundColor: selectedChannel === 'Bank Transfer' ? '#FFFBEB' : '#FFFFFF',
              borderRadius: 14,
              borderWidth: selectedChannel === 'Bank Transfer' ? 2 : 1,
              borderColor: selectedChannel === 'Bank Transfer' ? '#D97706' : '#E4E4E7',
              padding: 18,
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              shadowColor: selectedChannel === 'Bank Transfer' ? '#D97706' : 'transparent',
              shadowOpacity: selectedChannel === 'Bank Transfer' ? 0.08 : 0,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
            }}
            onPress={() => setSelectedChannel('Bank Transfer')}
            activeOpacity={0.8}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: '#92400E',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 10,
              }}
            >
              <BootstrapIcon name="bank" size={20} color="#FFFFFF" />
            </View>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#18181B' }}>
              Bank Transfer
            </Text>
            <Text style={{ fontSize: 12, color: '#71717A', marginTop: 2 }}>
              BDO / BPI / UnionBank
            </Text>
            <View
              style={{
                marginTop: 8,
                backgroundColor: '#FFFBEB',
                paddingHorizontal: 8,
                paddingVertical: 2.5,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: '#FEF3C7',
              }}
            >
              <Text style={{ fontSize: 10.5, fontWeight: '600', color: '#D97706' }}>
                Online Banking / InstaPay
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ─── ACTIVE CHANNEL INTERACTIVE ACTION BOX ─── */}
        <View
          style={{
            marginTop: 18,
            backgroundColor: '#FAFAF9',
            borderRadius: 14,
            borderWidth: 1,
            borderColor: '#E4E4E7',
            padding: 20,
          }}
        >
          {selectedChannel === 'GCash' && (
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
                    <Text style={{ fontSize: 18, fontWeight: '900', color: '#FFFFFF' }}>G</Text>
                  </View>
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: '#18181B' }}>
                        Pay with GCash
                      </Text>
                      <View
                        style={{
                          backgroundColor: '#ECFDF5',
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 4,
                          borderWidth: 1,
                          borderColor: '#A7F3D0',
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#059669' }}>
                          Live Gateway In Use
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 12, color: '#52525B', marginTop: 2 }}>
                      Click below to open the secure GCash checkout to settle your {formatPhp(calculatedDownpayment)} deposit.
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
                  <BootstrapIcon name="lock-fill" size={11} color="#71717A" />
                  <Text style={{ fontSize: 11, color: '#71717A' }}>
                    256-Bit SSL Encrypted • Real-Time Supabase payment registration
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
                        Securing Pit Slot...
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
                <Text style={{ fontSize: 10.5, color: '#D97706', marginTop: 6, fontWeight: '500' }}>
                  ⚡ Settled via live simulated sandbox
                </Text>
              </View>
            </View>
          )}

          {selectedChannel === 'Maya' && (
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
                      backgroundColor: '#00D632',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '900', color: '#FFFFFF' }}>maya</Text>
                  </View>
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: '#18181B' }}>
                        Pay with Maya
                      </Text>
                      <View
                        style={{
                          backgroundColor: '#ECFDF5',
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 4,
                          borderWidth: 1,
                          borderColor: '#A7F3D0',
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#059669' }}>
                          Live Gateway In Use
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 12, color: '#52525B', marginTop: 2 }}>
                      Click below to scan Maya QR or open checkout to settle your {formatPhp(calculatedDownpayment)} deposit.
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
                  <BootstrapIcon name="lock-fill" size={11} color="#71717A" />
                  <Text style={{ fontSize: 11, color: '#71717A' }}>
                    256-Bit SSL Encrypted • Real-Time Supabase payment registration
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
                    backgroundColor: '#059669',
                    paddingVertical: 12,
                    paddingHorizontal: 22,
                    borderRadius: 8,
                    cursor: isBusy ? 'not-allowed' : 'pointer',
                    opacity: isBusy ? 0.75 : 1,
                    shadowColor: '#059669',
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
                        Securing Pit Slot...
                      </Text>
                    </>
                  ) : (
                    <>
                      <BootstrapIcon name="lock-fill" size={13} color="#FFFFFF" />
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>
                        Pay {formatPhp(calculatedDownpayment)} via Maya →
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                <Text style={{ fontSize: 10.5, color: '#D97706', marginTop: 6, fontWeight: '500' }}>
                  ⚡ Settled via live simulated sandbox
                </Text>
              </View>
            </View>
          )}

          {selectedChannel === 'Bank Transfer' && (
            <View style={{ gap: 14 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 16,
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: '#92400E',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <BootstrapIcon name="bank" size={18} color="#FFFFFF" />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: '#18181B' }}>
                          Pay with Bank Transfer
                        </Text>
                        <View
                          style={{
                            backgroundColor: '#FFFBEB',
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 4,
                            borderWidth: 1,
                            borderColor: '#FEF3C7',
                          }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#D97706' }}>
                            Direct Bank Transfer
                          </Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 12, color: '#52525B', marginTop: 2 }}>
                        Transfer to BDO (Acct: 0048-2819-4820 D'Blockchain Motorparts) or BPI (Acct: 2819-4920-11).
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Right Action Button */}
                <View style={{ alignItems: 'flex-end', minWidth: 200 }}>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      backgroundColor: '#1E2227',
                      paddingVertical: 12,
                      paddingHorizontal: 22,
                      borderRadius: 8,
                      cursor: isBusy ? 'not-allowed' : 'pointer',
                      opacity: isBusy ? 0.75 : 1,
                      shadowColor: '#000000',
                      shadowOpacity: 0.15,
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
                          Verifying...
                        </Text>
                      </>
                    ) : (
                      <>
                        <BootstrapIcon name="check-circle-fill" size={13} color="#FFFFFF" />
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>
                          Settle {formatPhp(calculatedDownpayment)} via Bank →
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <Text style={{ fontSize: 10.5, color: '#71717A', marginTop: 6, fontWeight: '500' }}>
                    ⚡ Verified upon receipt submission
                  </Text>
                </View>
              </View>

              {/* Reference input for bank transfer */}
              <View style={{ marginTop: 8, backgroundColor: '#FFFFFF', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#E4E4E7' }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#71717A', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  Bank Reference Number / Transaction Code *
                </Text>
                <TextInput
                  style={{
                    marginTop: 6,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: '#D4D4D8',
                    fontSize: 13,
                    color: '#18181B',
                    backgroundColor: '#FFFFFF',
                  }}
                  placeholder="e.g. BDO-9823419 or InstaPay Reference"
                  placeholderTextColor="#A1A1AA"
                  value={bankRef}
                  onChangeText={setBankRef}
                />
              </View>
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
              backgroundColor: '#FEF3C7',
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
            borderColor: '#E4E4E7',
            cursor: 'pointer',
          }}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <BootstrapIcon name="arrow-left" size={13} color="#18181B" />
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#18181B' }}>
            Back to Review
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
