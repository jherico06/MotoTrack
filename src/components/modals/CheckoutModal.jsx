import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal } from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon';
import { shopStyles as styles } from '../../styles/shop.styles';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';

export default function CheckoutModal({
  visible,
  onClose,
  onCompleteOrder,
}) {
  const { currentUser } = useAuth();
  const { cartItemCount, cartTotal, showToast } = useCart();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash on Delivery (COD)');
  const [gcashNumber, setGcashNumber] = useState('0917-582-9410');
  const [gcashReference, setGcashReference] = useState(
    'MP-GCASH-' + Math.floor(100000 + Math.random() * 900000)
  );
  const [codChangeFor, setCodChangeFor] = useState('');

  // Pre-fill fields when user is authenticated
  useEffect(() => {
    if (currentUser) {
      setCustomerName(currentUser.name || currentUser.fullName || '');
      setCustomerPhone(currentUser.phone || '');
      setCustomerAddress(currentUser.address || '');
    }
  }, [currentUser]);

  const handleSubmit = () => {
    if (!customerName.trim() || !customerAddress.trim()) {
      showToast('Please provide recipient name and delivery address');
      return;
    }

    if (paymentMethod === 'GCash' && !gcashNumber.trim()) {
      showToast('Please provide your GCash mobile number');
      return;
    }

    onCompleteOrder?.({
      customerName,
      customerPhone,
      customerAddress,
      deliveryNotes,
      paymentMethod,
      gcashNumber,
      gcashReference,
      codChangeFor,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalTitle}>Express Checkout</Text>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
              <BootstrapIcon name="x-lg" size={14} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Full Name *</Text>
              <TextInput
                style={styles.formInput}
                value={customerName}
                onChangeText={setCustomerName}
                placeholder="Alex Rider"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Phone Number *</Text>
              <TextInput
                style={styles.formInput}
                value={customerPhone}
                onChangeText={setCustomerPhone}
                placeholder="(+63) 965 829 4141 / 09XX-XXX-XXXX"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Shipping Address *</Text>
              <TextInput
                style={styles.formInput}
                value={customerAddress}
                onChangeText={setCustomerAddress}
                placeholder="Purok / Street, Barangay, City, Province, Philippines"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Delivery Instructions / Notes</Text>
              <TextInput
                style={styles.formInput}
                value={deliveryNotes}
                onChangeText={setDeliveryNotes}
                placeholder="e.g. Ring doorbell, leave at guard house..."
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* ─── PAYMENT METHOD SELECTION ─── */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Payment Method *</Text>
              <Text style={{ fontSize: 11.5, color: '#64748B', marginBottom: 8 }}>
                Choose your preferred payment method for this order:
              </Text>

              {/* Option 1: Cash on Delivery (COD) */}
              <TouchableOpacity
                style={[
                  styles.paymentOptionCard,
                  paymentMethod === 'Cash on Delivery (COD)' && styles.paymentOptionCardActive,
                ]}
                onPress={() => setPaymentMethod('Cash on Delivery (COD)')}
                activeOpacity={0.85}
              >
                <View style={styles.paymentOptionCardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' }}>
                      <BootstrapIcon name="cash-stack" size={18} color="#16A34A" />
                    </View>
                    <View>
                      <Text style={styles.paymentOptionTitle}>Cash on Delivery (COD)</Text>
                      <Text style={styles.paymentOptionSub}>Pay cash to courier upon doorstep delivery</Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.paymentRadioDot,
                      paymentMethod === 'Cash on Delivery (COD)' && styles.paymentRadioDotActive,
                    ]}
                  >
                    {paymentMethod === 'Cash on Delivery (COD)' && <View style={styles.paymentRadioInner} />}
                  </View>
                </View>

                {paymentMethod === 'Cash on Delivery (COD)' && (
                  <View style={styles.paymentDetailsDrawer}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#BBF7D0', marginBottom: 8 }}>
                      <BootstrapIcon name="cash-coin" size={14} color="#16A34A" />
                      <Text style={{ fontSize: 11.5, color: '#166534', fontWeight: '700', flex: 1 }}>
                        Exact amount to prepare: ₱{cartTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                    </View>
                    <View style={{ backgroundColor: '#FEF3C7', padding: 9, borderRadius: 9, borderWidth: 1, borderColor: '#FDE68A', marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <BootstrapIcon name="shield-lock-fill" size={13} color="#D97706" />
                      <Text style={{ fontSize: 11, color: '#92400E', fontWeight: '700', flex: 1 }}>
                        COD orders require Store Admin verification before dispatch.
                      </Text>
                    </View>
                    <TextInput
                      style={[styles.formInput, { fontSize: 12.5, backgroundColor: '#FFFFFF' }]}
                      placeholder="Need change for? (e.g. ₱5,000 / ₱1,000 - optional)"
                      placeholderTextColor="#94A3B8"
                      value={codChangeFor}
                      onChangeText={setCodChangeFor}
                    />
                  </View>
                )}
              </TouchableOpacity>

              {/* Option 2: GCash Payment */}
              <TouchableOpacity
                style={[
                  styles.paymentOptionCard,
                  paymentMethod === 'GCash' && styles.paymentOptionCardActive,
                ]}
                onPress={() => setPaymentMethod('GCash')}
                activeOpacity={0.85}
              >
                <View style={styles.paymentOptionCardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#007DFE', alignItems: 'center', justifyContent: 'center' }}>
                      <BootstrapIcon name="phone-fill" size={18} color="#FFFFFF" />
                    </View>
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.paymentOptionTitle}>GCash Express Pay</Text>
                        <View style={{ backgroundColor: '#D1ECE6', paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 6 }}>
                          <Text style={{ fontSize: 10, fontWeight: '800', color: '#0C6258' }}>INSTANT</Text>
                        </View>
                      </View>
                      <Text style={styles.paymentOptionSub}>Instant e-wallet payment with reference code</Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.paymentRadioDot,
                      paymentMethod === 'GCash' && styles.paymentRadioDotActive,
                    ]}
                  >
                    {paymentMethod === 'GCash' && <View style={styles.paymentRadioInner} />}
                  </View>
                </View>

                {paymentMethod === 'GCash' && (
                  <View style={styles.paymentDetailsDrawer}>
                    <View style={{ backgroundColor: '#FFFFFF', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#D1ECE6', marginBottom: 10 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748B' }}>OFFICIAL GCASH MERCHANT:</Text>
                        <Text style={{ fontSize: 12, fontWeight: '900', color: '#0C6258' }}>0917-582-9410</Text>
                      </View>
                      <Text style={{ fontSize: 11, color: '#475569' }}>Account Name: MotoTrack Official PH</Text>
                    </View>

                    <Text style={[styles.formLabel, { fontSize: 12, marginBottom: 4 }]}>Your GCash Mobile Number *</Text>
                    <TextInput
                      style={[styles.formInput, { fontSize: 13, backgroundColor: '#FFFFFF', marginBottom: 8 }]}
                      placeholder="09XX-XXX-XXXX"
                      placeholderTextColor="#94A3B8"
                      value={gcashNumber}
                      onChangeText={setGcashNumber}
                      keyboardType="phone-pad"
                    />

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F0FDF4', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#BBF7D0' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <BootstrapIcon name="check-circle-fill" size={13} color="#16A34A" />
                        <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#166534' }}>
                          Reference: {gcashReference}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          setGcashReference('MP-GCASH-' + Math.floor(100000 + Math.random() * 900000));
                          showToast('Generated fresh GCash reference code');
                        }}
                      >
                        <BootstrapIcon name="arrow-clockwise" size={13} color="#16A34A" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View
              style={{
                backgroundColor: '#F8FAFC',
                padding: 14,
                borderRadius: 14,
                marginVertical: 10,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
                Order Summary ({cartItemCount} items)
              </Text>
              <Text style={{ fontSize: 18, fontWeight: '900', color: '#0C6258', marginTop: 4 }}>
                Total to Pay: ${cartTotal.toFixed(2)}
              </Text>
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[styles.checkoutBtn, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }]}
            onPress={handleSubmit}
            activeOpacity={0.9}
          >
            <Text style={styles.checkoutBtnText}>Place Order Now</Text>
            <BootstrapIcon name="arrow-right" size={14} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
