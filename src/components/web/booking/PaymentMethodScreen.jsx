// =========================================================================
// MotoTrack Customer Booking - Screen 6: Payment Method Selection
// Supports GCash, Credit/Debit Card, and Cash with business rules & drawer
// =========================================================================

import React from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { BootstrapIcon } from '../../common';
import { packageBookingStyles as styles } from '../../../styles/web/packageBooking.web.styles.js';
import { formatPhp } from '../../../utils/serviceQuotation.js';

export default function PaymentMethodScreen({
  paymentMethod,
  setPaymentMethod,
  gcashNumber,
  setGcashNumber,
  gcashReference,
  setGcashReference,
  cardData,
  setCardData,
  pricingData,
  onBack,
  onContinue,
  showToast,
}) {
  const downpaymentAmount = pricingData?.downpaymentAmount ?? 0;
  const totalAmount = pricingData?.subtotal ?? 0;

  const handleGenerateFreshGcashRef = () => {
    const newRef = 'MP-GCASH-' + Math.floor(100000 + Math.random() * 900000);
    setGcashReference(newRef);
    showToast?.('Generated fresh GCash reference code');
  };

  const isPaymentValid = () => {
    if (!paymentMethod) return false;
    if (paymentMethod === 'GCash') {
      return Boolean(gcashNumber && gcashNumber.trim().length >= 10);
    }
    if (paymentMethod === 'Credit/Debit Card') {
      return Boolean(
        cardData.name?.trim() &&
        cardData.number?.replace(/\s/g, '').length >= 14 &&
        cardData.expiry?.trim()
      );
    }
    if (paymentMethod === 'Cash') {
      return true;
    }
    return false;
  };

  return (
    <View>
      <View style={{ marginBottom: 28, alignItems: 'center', textAlign: 'center' }}>
        <Text style={[styles.pageTitle, { textAlign: 'center' }]}>Select Payment Method</Text>
        <Text style={[styles.pageSubtitle, { textAlign: 'center', maxWidth: 640 }]}>
          Choose your payment method. An initial 20% reservation fee secures your technician and bay allocation.
        </Text>
      </View>

      {/* ─── PAYMENT OPTION 1: GCASH ─── */}
      <View
        style={[
          styles.paymentCard,
          paymentMethod === 'GCash' && styles.paymentCardActive,
        ]}
        onClick={() => setPaymentMethod('GCash')}
      >
        <View style={styles.paymentCardHeader}>
          <View style={styles.paymentTitleRow}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: '#007DFE',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BootstrapIcon name="wallet2" size={18} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.paymentTitle}>GCash Instant Pay</Text>
              <Text style={styles.paymentSubtext}>
                Pay 20% downpayment ({formatPhp(downpaymentAmount)}) instantly via GCash e-wallet
              </Text>
            </View>
          </View>

          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              borderWidth: 2,
              borderColor: paymentMethod === 'GCash' ? '#EA580C' : '#CBD5E1',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {paymentMethod === 'GCash' && (
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#EA580C' }} />
            )}
          </View>
        </View>

        {paymentMethod === 'GCash' && (
          <View style={styles.paymentDrawer}>
            <View
              style={{
                backgroundColor: '#EFF6FF',
                borderWidth: 1,
                borderColor: '#DBEAFE',
                borderRadius: 8,
                padding: 12,
                marginBottom: 12,
              }}
            >
              <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#1E40AF', textTransform: 'uppercase' }}>
                Official GCash Merchant:
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E3A8A', marginTop: 2 }}>
                D'Blockchain Motorparts / MotoTrack Central Pit
              </Text>
              <Text style={{ fontSize: 12, color: '#3B82F6', marginTop: 1 }}>
                GCash Mobile: 0917 882 9102
              </Text>
            </View>

            <View style={{ marginBottom: 10 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#334155', marginBottom: 4 }}>
                Your GCash Mobile Number *
              </Text>
              <TextInput
                style={{
                  height: 38,
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: '#CBD5E1',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  fontSize: 13,
                  color: '#0F172A',
                }}
                placeholder="09XX XXX XXXX"
                placeholderTextColor="#94A3B8"
                value={gcashNumber}
                onChangeText={setGcashNumber}
                keyboardType="phone-pad"
              />
            </View>

            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#334155' }}>
                  GCash Reference Code
                </Text>
                <TouchableOpacity onPress={handleGenerateFreshGcashRef}>
                  <Text style={{ fontSize: 11, color: '#EA580C', fontWeight: '600', cursor: 'pointer' }}>
                    Generate New Code
                  </Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={{
                  height: 38,
                  backgroundColor: '#F8FAFC',
                  borderWidth: 1,
                  borderColor: '#CBD5E1',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  fontSize: 13,
                  fontWeight: '600',
                  color: '#0F172A',
                }}
                value={gcashReference}
                onChangeText={setGcashReference}
              />
            </View>
          </View>
        )}
      </View>

      {/* ─── PAYMENT OPTION 2: CREDIT / DEBIT CARD ─── */}
      <View
        style={[
          styles.paymentCard,
          paymentMethod === 'Credit/Debit Card' && styles.paymentCardActive,
        ]}
        onClick={() => setPaymentMethod('Credit/Debit Card')}
      >
        <View style={styles.paymentCardHeader}>
          <View style={styles.paymentTitleRow}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: '#1E2227',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BootstrapIcon name="credit-card-fill" size={18} color="#EA580C" />
            </View>
            <View>
              <Text style={styles.paymentTitle}>Credit or Debit Card</Text>
              <Text style={styles.paymentSubtext}>
                Visa, Mastercard, or JCB • Secure tokenized reservation
              </Text>
            </View>
          </View>

          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              borderWidth: 2,
              borderColor: paymentMethod === 'Credit/Debit Card' ? '#EA580C' : '#CBD5E1',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {paymentMethod === 'Credit/Debit Card' && (
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#EA580C' }} />
            )}
          </View>
        </View>

        {paymentMethod === 'Credit/Debit Card' && (
          <View style={styles.paymentDrawer}>
            <View style={{ marginBottom: 10 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#334155', marginBottom: 4 }}>
                Cardholder Full Name *
              </Text>
              <TextInput
                style={{
                  height: 38,
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: '#CBD5E1',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  fontSize: 13,
                  color: '#0F172A',
                }}
                placeholder="Name on card"
                placeholderTextColor="#94A3B8"
                value={cardData.name}
                onChangeText={(val) => setCardData({ ...cardData, name: val })}
              />
            </View>

            <View style={{ marginBottom: 10 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#334155', marginBottom: 4 }}>
                Card Number *
              </Text>
              <TextInput
                style={{
                  height: 38,
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: '#CBD5E1',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  fontSize: 13,
                  color: '#0F172A',
                }}
                placeholder="4111 2222 3333 4444"
                placeholderTextColor="#94A3B8"
                value={cardData.number}
                onChangeText={(val) => setCardData({ ...cardData, number: val })}
                maxLength={19}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#334155', marginBottom: 4 }}>
                  Expiry (MM/YY) *
                </Text>
                <TextInput
                  style={{
                    height: 38,
                    backgroundColor: '#FFFFFF',
                    borderWidth: 1,
                    borderColor: '#CBD5E1',
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    fontSize: 13,
                    color: '#0F172A',
                  }}
                  placeholder="MM/YY"
                  placeholderTextColor="#94A3B8"
                  value={cardData.expiry}
                  onChangeText={(val) => setCardData({ ...cardData, expiry: val })}
                  maxLength={5}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#334155', marginBottom: 4 }}>
                  CVV / CVC *
                </Text>
                <TextInput
                  style={{
                    height: 38,
                    backgroundColor: '#FFFFFF',
                    borderWidth: 1,
                    borderColor: '#CBD5E1',
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    fontSize: 13,
                    color: '#0F172A',
                  }}
                  placeholder="123"
                  placeholderTextColor="#94A3B8"
                  value={cardData.cvv}
                  onChangeText={(val) => setCardData({ ...cardData, cvv: val })}
                  maxLength={4}
                  secureTextEntry={true}
                />
              </View>
            </View>
          </View>
        )}
      </View>

      {/* ─── PAYMENT OPTION 3: CASH OVER THE COUNTER ─── */}
      <View
        style={[
          styles.paymentCard,
          paymentMethod === 'Cash' && styles.paymentCardActive,
        ]}
        onClick={() => setPaymentMethod('Cash')}
      >
        <View style={styles.paymentCardHeader}>
          <View style={styles.paymentTitleRow}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: '#16A34A',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BootstrapIcon name="cash-stack" size={18} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.paymentTitle}>Cash Upon Arrival (Counter Check-In)</Text>
              <Text style={styles.paymentSubtext}>
                No upfront digital payment. Pay at shop reception upon vehicle drop-off
              </Text>
            </View>
          </View>

          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              borderWidth: 2,
              borderColor: paymentMethod === 'Cash' ? '#EA580C' : '#CBD5E1',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {paymentMethod === 'Cash' && (
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#EA580C' }} />
            )}
          </View>
        </View>

        {paymentMethod === 'Cash' && (
          <View style={styles.paymentDrawer}>
            <View
              style={{
                backgroundColor: '#F0FDF4',
                borderWidth: 1,
                borderColor: '#DCFCE7',
                borderRadius: 8,
                padding: 12,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <BootstrapIcon name="info-circle-fill" size={14} color="#16A34A" />
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#166534' }}>
                  Cash Payment Policy
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: '#15803D', lineHeight: 17 }}>
                Full service amount ({formatPhp(totalAmount)}) is payable upon check-in at our Naga Central branch. Please arrive 15 minutes before your scheduled time slot to retain your technician reservation.
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* ─── NAVIGATION BUTTONS ─── */}
      <View style={styles.navButtonsRow}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          activeOpacity={0.8}
        >
          <BootstrapIcon name="arrow-left" size={14} color="#334155" />
          <Text style={styles.backBtnText}>Back to Schedule</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.primaryBtn,
            !isPaymentValid() && styles.primaryBtnDisabled,
          ]}
          disabled={!isPaymentValid()}
          onPress={onContinue}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>Next: Review Booking</Text>
          <BootstrapIcon name="arrow-right" size={14} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
