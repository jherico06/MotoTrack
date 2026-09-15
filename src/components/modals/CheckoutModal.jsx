import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon';
import { shopStyles as styles } from '../../styles/shop.styles';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { formatPHPhone } from './LiveOrderTrackingMapModal';

export default function CheckoutModal({ visible, onClose, onCompleteOrder, onOpenProfile }) {
  const { currentUser, updateProfile } = useAuth();
  const { cartItemCount, cartTotal, showToast } = useCart();

  // Delivery Notes & Payment State
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash on Delivery (COD)');
  const [gcashNumber, setGcashNumber] = useState(currentUser?.phone || '');
  const [gcashReference, setGcashReference] = useState(
    'MP-GCASH-' + Math.floor(100000 + Math.random() * 900000)
  );
  const [codChangeFor, setCodChangeFor] = useState('');

  // Inline Quick Address Editor (if user has missing address or wants quick edit)
  const [isEditingAddress, setIsEditingAddress] = useState(!currentUser?.address);
  const [inlineAddress, setInlineAddress] = useState(currentUser?.address || '');
  const [inlinePhone, setInlinePhone] = useState(currentUser?.phone || '');
  const [isSavingInline, setIsSavingInline] = useState(false);

  const customerName = currentUser?.name || currentUser?.fullName || currentUser?.email?.split('@')[0] || '';
  const customerPhone = currentUser?.phone || inlinePhone || '';
  const customerAddress = currentUser?.address || inlineAddress || '';

  const handleSaveInlineAddress = async () => {
    if (!inlineAddress.trim()) {
      showToast('Please enter a delivery address');
      return;
    }
    setIsSavingInline(true);
    try {
      const res = await updateProfile({
        address: inlineAddress.trim(),
        phone: inlinePhone.trim() || customerPhone,
      });
      if (res.success) {
        setIsEditingAddress(false);
        showToast('Delivery address updated in your Supabase profile');
      } else {
        showToast(res.error || 'Failed to update address in Supabase');
      }
    } catch (e) {
      showToast('Error updating profile address in Supabase');
    } finally {
      setIsSavingInline(false);
    }
  };

  const handleSubmit = () => {
    if (!customerAddress || customerAddress.trim().length < 5) {
      showToast('Please add a delivery address to your profile first');
      setIsEditingAddress(true);
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
        <View style={[styles.modalSheet, { maxHeight: '92%' }]}>
          {/* ─── HEADER ─── */}
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalTitle}>Express Checkout</Text>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
              <BootstrapIcon name="x-lg" size={14} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
            {/* ─── 1. PROFILE SAVED DELIVERY ADDRESS CARD (AUTOMATIC FROM PROFILE) ─── */}
            <View style={checkoutStyles.addressCardContainer}>
              <View style={checkoutStyles.addressCardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <BootstrapIcon name="geo-alt-fill" size={15} color="#0C6258" />
                  <Text style={checkoutStyles.addressCardTitle}>Delivery Destination</Text>
                </View>
                <TouchableOpacity
                  style={checkoutStyles.editProfileAddressBtn}
                  onPress={() => {
                    setInlineAddress(customerAddress);
                    setInlinePhone(customerPhone);
                    setIsEditingAddress(!isEditingAddress);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={checkoutStyles.editProfileAddressText}>
                    {isEditingAddress ? 'Cancel' : 'Edit in Profile'}
                  </Text>
                </TouchableOpacity>
              </View>

              {!isEditingAddress ? (
                <View style={checkoutStyles.addressDisplayWrap}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={checkoutStyles.addressRecipientName}>{customerName}</Text>
                    <Text style={checkoutStyles.addressPhoneText}>{formatPHPhone(customerPhone, false)}</Text>
                  </View>
                  <Text style={checkoutStyles.addressFullText}>{customerAddress}</Text>

                  <View style={checkoutStyles.profileSyncBadge}>
                    <BootstrapIcon name="shield-check" size={12} color="#0C6258" />
                    <Text style={checkoutStyles.profileSyncBadgeText}>
                      Linked directly to your user profile & live GPS map
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={checkoutStyles.inlineAddressForm}>
                  <Text style={checkoutStyles.inlineFormLabel}>Update Profile Delivery Address:</Text>
                  <TextInput
                    style={checkoutStyles.inlineInput}
                    value={inlineAddress}
                    onChangeText={setInlineAddress}
                    placeholder="Purok / Street, Barangay, City of Naga, Cebu, Philippines"
                    placeholderTextColor="#94A3B8"
                    multiline
                  />

                  <Text style={[checkoutStyles.inlineFormLabel, { marginTop: 6 }]}>Phone Number:</Text>
                  <TextInput
                    style={[checkoutStyles.inlineInput, { minHeight: 38 }]}
                    value={inlinePhone}
                    onChangeText={setInlinePhone}
                    placeholder="(+63) 965 829 4141"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                  />

                  <TouchableOpacity
                    style={checkoutStyles.inlineSaveBtn}
                    onPress={handleSaveInlineAddress}
                    disabled={isSavingInline}
                  >
                    {isSavingInline ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={checkoutStyles.inlineSaveBtnText}>Save Address to Profile</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* ─── 2. DELIVERY INSTRUCTIONS (OPTIONAL) ─── */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Delivery Instructions (Optional)</Text>
              <TextInput
                style={styles.formInput}
                value={deliveryNotes}
                onChangeText={setDeliveryNotes}
                placeholder="e.g. Leave at front porch, ring doorbell upon arrival..."
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* ─── 3. PAYMENT METHOD SELECTION ─── */}
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
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        backgroundColor: '#DCFCE7',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
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
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        backgroundColor: '#FFFFFF',
                        padding: 10,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: '#BBF7D0',
                        marginBottom: 8,
                      }}
                    >
                      <BootstrapIcon name="cash-coin" size={14} color="#16A34A" />
                      <Text style={{ fontSize: 11.5, color: '#166534', fontWeight: '700', flex: 1 }}>
                        Exact amount to prepare: ₱
                        {cartTotal.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </Text>
                    </View>
                    <View
                      style={{
                        backgroundColor: '#F3F7F6',
                        padding: 9,
                        borderRadius: 9,
                        borderWidth: 1,
                        borderColor: '#D1ECE6',
                        marginBottom: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <BootstrapIcon name="shield-lock-fill" size={13} color="#0C6258" />
                      <Text style={{ fontSize: 11, color: '#0C6258', fontWeight: '700', flex: 1 }}>
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
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        backgroundColor: '#007DFE',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <BootstrapIcon name="phone-fill" size={18} color="#FFFFFF" />
                    </View>
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.paymentOptionTitle}>GCash Express Pay</Text>
                        <View
                          style={{
                            backgroundColor: '#FDE68A',
                            paddingHorizontal: 6,
                            paddingVertical: 1.5,
                            borderRadius: 6,
                          }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '800', color: '#0C6258' }}>INSTANT</Text>
                        </View>
                      </View>
                      <Text style={styles.paymentOptionSub}>
                        Instant e-wallet payment with reference code
                      </Text>
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
                    <View
                      style={{
                        backgroundColor: '#FFFFFF',
                        padding: 12,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: '#D1ECE6',
                        marginBottom: 10,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 4,
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748B' }}>
                          OFFICIAL GCASH MERCHANT:
                        </Text>
                        <Text style={{ fontSize: 12, fontWeight: '900', color: '#0C6258' }}>
                          0917-582-9410
                        </Text>
                      </View>
                      <Text style={{ fontSize: 11, color: '#475569' }}>
                        Account Name: D,Blockchain Motorparts and Accessories
                      </Text>
                    </View>

                    <Text style={[styles.formLabel, { fontSize: 12, marginBottom: 4 }]}>
                      Your GCash Mobile Number *
                    </Text>
                    <TextInput
                      style={[
                        styles.formInput,
                        { fontSize: 13, backgroundColor: '#FFFFFF', marginBottom: 8 },
                      ]}
                      placeholder="09XX-XXX-XXXX"
                      placeholderTextColor="#94A3B8"
                      value={gcashNumber}
                      onChangeText={setGcashNumber}
                      keyboardType="phone-pad"
                    />

                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: '#F0FDF4',
                        padding: 8,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: '#BBF7D0',
                      }}
                    >
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

            {/* ─── 4. ORDER SUMMARY & TOTAL ─── */}
            <View
              style={{
                backgroundColor: '#F8FAFC',
                padding: 14,
                borderRadius: 14,
                marginVertical: 10,
                borderWidth: 1,
                borderColor: '#E2E8F0',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
                Order Summary ({cartItemCount} items)
              </Text>
              <Text style={{ fontSize: 18, fontWeight: '900', color: '#0C6258', marginTop: 4 }}>
                Total to Pay: ₱
                {cartTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
          </ScrollView>

          {/* ─── PLACE ORDER BUTTON ─── */}
          <TouchableOpacity
            style={[
              styles.checkoutBtn,
              { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
            ]}
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

const checkoutStyles = StyleSheet.create({
  addressCardContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  addressCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  addressCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  editProfileAddressBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#F3F7F6',
    borderWidth: 1,
    borderColor: '#D1ECE6',
  },
  editProfileAddressText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0C6258',
  },
  addressDisplayWrap: {
    paddingTop: 8,
    gap: 4,
  },
  addressRecipientName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  addressPhoneText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
  },
  addressFullText: {
    fontSize: 12.5,
    color: '#334155',
    lineHeight: 18,
    marginTop: 2,
  },
  profileSyncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    backgroundColor: '#F3F7F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  profileSyncBadgeText: {
    fontSize: 10.5,
    color: '#0C6258',
    fontWeight: '700',
  },
  inlineAddressForm: {
    paddingTop: 8,
    gap: 6,
  },
  inlineFormLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  inlineInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    fontSize: 12.5,
    color: '#0F172A',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  inlineSaveBtn: {
    backgroundColor: '#0C6258',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  inlineSaveBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
