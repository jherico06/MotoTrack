import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Image,
  useWindowDimensions,
} from 'react-native';
import { BootstrapIcon } from '../common/BootstrapIcon.jsx';
import DeliveryLocationPicker from '../common/DeliveryLocationPicker.jsx';
import { shopStyles as styles } from '../../styles/shop.styles.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCart } from '../../context/CartContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { formatPHPhone } from './LiveOrderTrackingMapModal.jsx';
import { parseLatLng } from '../../utils/geo.js';

export default function CheckoutModal({
  visible,
  onClose,
  onCompleteOrder,
  onOpenProfile,
  isPlacingOrder = false,
  overrideItemCount = null,
  overrideTotal = null,
  overrideItems = null,
  isDarkMode: isDarkProp,
}) {
  const { width: windowWidth } = useWindowDimensions();
  const { isDarkMode: themeDark } = useTheme();
  const isDarkMode = typeof isDarkProp === 'boolean' ? isDarkProp : Boolean(themeDark);
  const checkoutStyles = useMemo(() => createCheckoutStyles(isDarkMode), [isDarkMode]);

  const sheetBg = isDarkMode ? '#191A1D' : '#FFFFFF';
  const subBg = isDarkMode ? '#18181B' : '#F8FAFC';
  const elevatedBg = isDarkMode ? '#202124' : '#F1F5F9';
  const borderCol = isDarkMode ? '#303236' : '#E2E8F0';
  const inputBorderCol = isDarkMode ? '#333A42' : '#CBD5E1';
  const textPrimary = isDarkMode ? '#F2F2F3' : '#0F172A';
  const textSecondary = isDarkMode ? '#A1A1AA' : '#475569';
  const textMuted = isDarkMode ? '#A1A1AA' : '#64748B';
  const brandAccent = isDarkMode ? '#FB923C' : '#EA580C';
  const { currentUser, updateProfile } = useAuth();
  const {
    cart,
    cartItemCount,
    cartTotal,
    selectedCartItems,
    selectedCartItemCount,
    selectedCartSubtotal,
    selectedDiscountAmount,
    selectedShippingFee,
    selectedCartTotal,
    shippingRate,
    isFreeShipping,
    discountPercent,
    appliedPromoMeta,
    showToast,
  } = useCart();

  const activeCartItems = selectedCartItems && selectedCartItems.length > 0 ? selectedCartItems : cart;
  const activeCartCount = selectedCartItems && selectedCartItems.length > 0 ? selectedCartItemCount : cartItemCount;
  const activeCartTotal = selectedCartItems && selectedCartItems.length > 0 ? selectedCartTotal : cartTotal;
  const activeSubtotal =
    selectedCartItems && selectedCartItems.length > 0
      ? selectedCartSubtotal
      : activeCartItems.reduce(
          (sum, item) => sum + Number(item.product?.price || 0) * Number(item.quantity || 1),
          0
        );
  const activeDiscount =
    selectedCartItems && selectedCartItems.length > 0 ? selectedDiscountAmount : 0;
  const activeShipping =
    selectedCartItems && selectedCartItems.length > 0
      ? selectedShippingFee
      : activeCartItems.length > 0
        ? isFreeShipping
          ? 0
          : shippingRate
        : 0;

  const displayItemCount = overrideItemCount != null ? overrideItemCount : activeCartCount;
  const displayTotal = overrideTotal != null ? overrideTotal : activeCartTotal;
  const displayItems = Array.isArray(overrideItems) && overrideItems.length > 0
    ? overrideItems
    : (Array.isArray(activeCartItems) ? activeCartItems : []);

  // When override items are provided (Buy Now), derive summary from those items
  const overrideSubtotal =
    Array.isArray(overrideItems) && overrideItems.length > 0
      ? overrideItems.reduce(
          (sum, item) => sum + Number(item.product?.price || 0) * Number(item.quantity || 1),
          0
        )
      : null;
  const summarySubtotal = overrideSubtotal != null ? overrideSubtotal : activeSubtotal;
  const summaryDiscount = overrideSubtotal != null ? 0 : activeDiscount;
  const summaryShipping =
    overrideTotal != null && overrideSubtotal != null
      ? Math.max(0, Number(overrideTotal) - Number(overrideSubtotal))
      : activeShipping;
  const summaryFreeShipping =
    overrideTotal != null
      ? Number(overrideTotal) <= Number(overrideSubtotal || 0) + 0.001
      : isFreeShipping;

  // Delivery Notes & Payment State
  const [deliveryNotes, setDeliveryNotes] = useState(
    currentUser?.deliveryNotes || currentUser?.delivery_notes || ''
  );
  const [paymentMethod, setPaymentMethod] = useState('Cash on Delivery (COD)');
  const [gcashNumber, setGcashNumber] = useState(currentUser?.phone || '');
  const [gcashReference, setGcashReference] = useState(
    'MP-GCASH-' + Math.floor(100000 + Math.random() * 900000)
  );
  const [codChangeFor, setCodChangeFor] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inline Quick Address Editor (if user has missing address or wants quick edit)
  const savedUserCoords = parseLatLng(
    currentUser?.latitude ?? currentUser?.delivery_lat,
    currentUser?.longitude ?? currentUser?.delivery_lng
  );
  const [isEditingAddress, setIsEditingAddress] = useState(!currentUser?.address);
  const [inlineAddress, setInlineAddress] = useState(currentUser?.address || '');
  const [inlinePhone, setInlinePhone] = useState(currentUser?.phone || '');
  const [inlineLat, setInlineLat] = useState(savedUserCoords?.lat ?? null);
  const [inlineLng, setInlineLng] = useState(savedUserCoords?.lng ?? null);
  const [inlineCoordError, setInlineCoordError] = useState('');
  const [isSavingInline, setIsSavingInline] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const coords = parseLatLng(
      currentUser?.latitude ?? currentUser?.delivery_lat,
      currentUser?.longitude ?? currentUser?.delivery_lng
    );
    setInlineAddress(currentUser?.address || '');
    setInlinePhone(currentUser?.phone || '');
    setInlineLat(coords?.lat ?? null);
    setInlineLng(coords?.lng ?? null);
    setInlineCoordError('');
    setDeliveryNotes((prev) => prev || currentUser?.deliveryNotes || currentUser?.delivery_notes || '');
  }, [
    visible,
    currentUser?.address,
    currentUser?.phone,
    currentUser?.latitude,
    currentUser?.longitude,
    currentUser?.delivery_lat,
    currentUser?.delivery_lng,
    currentUser?.deliveryNotes,
    currentUser?.delivery_notes,
  ]);

  const customerName = currentUser?.name || currentUser?.fullName || currentUser?.email?.split('@')[0] || '';
  const customerPhone = currentUser?.phone || inlinePhone || '';
  const customerAddress = currentUser?.address || inlineAddress || '';
  const activeDeliveryCoords = parseLatLng(inlineLat, inlineLng) || savedUserCoords;
  const busy = isSubmitting || isPlacingOrder;

  const handleSaveInlineAddress = async () => {
    if (!inlineAddress.trim()) {
      showToast('Please enter a delivery address');
      return;
    }
    const validPin = parseLatLng(inlineLat, inlineLng);
    if (!validPin) {
      const msg = 'Please drop a pin on your house on the map before saving.';
      setInlineCoordError(msg);
      showToast(msg);
      return;
    }
    setInlineCoordError('');
    setIsSavingInline(true);
    try {
      const res = await updateProfile({
        address: inlineAddress.trim(),
        phone: inlinePhone.trim() || customerPhone,
        latitude: validPin.lat,
        longitude: validPin.lng,
        delivery_lat: validPin.lat,
        delivery_lng: validPin.lng,
        deliveryNotes: deliveryNotes.trim(),
        delivery_notes: deliveryNotes.trim(),
      });
      if (res.success) {
        setIsEditingAddress(false);
        showToast('Delivery address and map pin saved to your profile');
      } else {
        showToast(res.error || 'Failed to update address in Supabase');
      }
    } catch (e) {
      showToast('Error updating profile address in Supabase');
    } finally {
      setIsSavingInline(false);
    }
  };

  const handleSubmit = async () => {
    if (busy) return;

    if (!customerAddress || customerAddress.trim().length < 5) {
      showToast('Please add a delivery address to your profile first');
      setIsEditingAddress(true);
      return;
    }

    if (paymentMethod === 'GCash' && !gcashNumber.trim()) {
      showToast('Please provide your GCash mobile number');
      return;
    }

    setIsSubmitting(true);
    try {
      await onCompleteOrder?.({
        customerName,
        customerPhone,
        customerAddress,
        deliveryNotes,
        deliveryLat: activeDeliveryCoords?.lat ?? null,
        deliveryLng: activeDeliveryCoords?.lng ?? null,
        paymentMethod,
        gcashNumber,
        gcashReference,
        codChangeFor,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDesktop = windowWidth >= 768;

  return (
    <Modal visible={visible} transparent animationType={isDesktop ? 'fade' : 'slide'} onRequestClose={onClose}>
      <View
        style={[
          styles.modalOverlay,
          isDarkMode && { backgroundColor: 'rgba(2, 6, 23, 0.72)' },
          isDesktop && {
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          },
        ]}
      >
        <TouchableOpacity
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={[
            styles.modalSheet,
            { maxHeight: '92%', backgroundColor: sheetBg, borderColor: borderCol },
            isDarkMode && { borderWidth: 1 },
            isDesktop && {
              borderRadius: 24,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxWidth: 640,
              alignSelf: 'center',
              boxShadow: isDarkMode
                ? '0 20px 60px rgba(0, 0, 0, 0.55)'
                : '0 20px 60px rgba(0, 0, 0, 0.25)',
            },
            windowWidth < 400 && { paddingHorizontal: 12, paddingTop: 16, paddingBottom: 24 },
          ]}
        >
          {/* ─── HEADER ─── */}
          <View style={[styles.modalHeaderRow, isDarkMode && { borderBottomColor: borderCol }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: isDarkMode ? 'rgba(234, 88, 12, 0.16)' : '#FFF7ED',
                  borderWidth: 1,
                  borderColor: isDarkMode ? 'rgba(251, 146, 60, 0.35)' : '#FED7AA',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BootstrapIcon name="bag-check-fill" size={16} color={brandAccent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: textPrimary }]}>Express Checkout</Text>
                <Text style={{ fontSize: 12, color: textMuted, marginTop: 1 }}>
                  Review items, shipping, and payment
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.modalCloseBtn,
                isDarkMode && { backgroundColor: elevatedBg, borderWidth: 1, borderColor: borderCol },
              ]}
              onPress={onClose}
            >
              <BootstrapIcon name="x-lg" size={14} color={textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 'calc(88vh - 140px)' }} showsVerticalScrollIndicator={false}>
            {/* ─── 1. PROFILE SAVED DELIVERY ADDRESS CARD (AUTOMATIC FROM PROFILE) ─── */}
            <View style={checkoutStyles.addressCardContainer}>
              <View style={checkoutStyles.addressCardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <BootstrapIcon name="geo-alt-fill" size={15} color={brandAccent} />
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
                    <BootstrapIcon
                      name={activeDeliveryCoords ? 'check-circle-fill' : 'exclamation-triangle-fill'}
                      size={12}
                      color={activeDeliveryCoords ? '#16A34A' : '#D97706'}
                    />
                    <Text style={checkoutStyles.profileSyncBadgeText}>
                      {activeDeliveryCoords
                        ? `Pinned on map (${activeDeliveryCoords.lat.toFixed(5)}, ${activeDeliveryCoords.lng.toFixed(5)})`
                        : 'No house pin saved yet — tap "Edit in Profile" to drop your exact pin'}
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

                  <Text style={[checkoutStyles.inlineFormLabel, { marginTop: 8 }]}>
                    Pin Exact House Location on Map *:
                  </Text>
                  <DeliveryLocationPicker
                    latitude={inlineLat}
                    longitude={inlineLng}
                    addressText={inlineAddress}
                    isDarkMode={isDarkMode}
                    height={210}
                    errorText={inlineCoordError}
                    onLocationChange={({ lat, lng }) => {
                      setInlineLat(lat);
                      setInlineLng(lng);
                      setInlineCoordError('');
                    }}
                  />

                  <TouchableOpacity
                    style={checkoutStyles.inlineSaveBtn}
                    onPress={handleSaveInlineAddress}
                    disabled={isSavingInline}
                  >
                    {isSavingInline ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={checkoutStyles.inlineSaveBtnText}>Save Address & Pin to Profile</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* ─── 2. ORDERED PRODUCTS & DESCRIPTIONS ─── */}
            {displayItems.length > 0 && (
              <View style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <BootstrapIcon name="box-seam-fill" size={14} color={brandAccent} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: textPrimary }}>
                      Items in this Order ({displayItemCount})
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: brandAccent }}>
                    ₱{displayTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>

                <View style={{ gap: 8 }}>
                  {displayItems.map((item, idx) => {
                    const prod = item.product || item;
                    const qty = item.quantity || prod.quantity || 1;
                    const name = prod.name || prod.title || 'Motorcycle Part';
                    const brand = prod.brand || '';
                    const description = prod.description || prod.desc || 'Genuine high-performance motorcycle component.';
                    const image = prod.image || prod.img || '';
                    const itemPrice = Number(prod.price || 0);

                    return (
                      <View
                        key={prod.id ? `checkout-item-${prod.id}-${idx}` : `checkout-item-${idx}`}
                        style={{
                          flexDirection: 'row',
                          gap: 10,
                          backgroundColor: subBg,
                          borderRadius: 12,
                          padding: 10,
                          borderWidth: 1,
                          borderColor: borderCol,
                        }}
                      >
                        {image ? (
                          <Image
                            source={{ uri: image }}
                            style={{
                              width: 52,
                              height: 52,
                              borderRadius: 8,
                              backgroundColor: isDarkMode ? '#14181D' : '#FFFFFF',
                              borderWidth: 1,
                              borderColor: borderCol,
                            }}
                            resizeMode="cover"
                          />
                        ) : (
                          <View
                            style={{
                              width: 52,
                              height: 52,
                              borderRadius: 8,
                              backgroundColor: isDarkMode ? 'rgba(234, 88, 12, 0.16)' : '#FFF7ED',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <BootstrapIcon name="box-seam" size={18} color={brandAccent} />
                          </View>
                        )}

                        <View style={{ flex: 1, justifyContent: 'center' }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                            <Text style={{ fontSize: 12.5, fontWeight: '600', color: textPrimary, flex: 1 }} numberOfLines={1}>
                              {name}
                            </Text>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: brandAccent }}>
                              ₱{(itemPrice * qty).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </Text>
                          </View>

                          {brand ? (
                            <Text style={{ fontSize: 10.5, fontWeight: '700', color: textMuted, marginTop: 1 }}>
                              {brand}{prod.category ? ` • ${prod.category}` : ''}
                            </Text>
                          ) : null}

                          {description ? (
                            <Text
                              style={{
                                fontSize: 11,
                                color: textSecondary,
                                marginTop: 3,
                                lineHeight: 15,
                              }}
                              numberOfLines={2}
                            >
                              {description}
                            </Text>
                          ) : null}

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 }}>
                            <View style={{ backgroundColor: elevatedBg, paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 4 }}>
                              <Text style={{ fontSize: 10, fontWeight: '700', color: isDarkMode ? '#F2F2F3' : '#334155' }}>
                                Qty: {qty}
                              </Text>
                            </View>
                            <Text style={{ fontSize: 10.5, color: textMuted }}>
                              ₱{itemPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })} each
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ─── 3. LANDMARK / DELIVERY NOTES ─── */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: textPrimary }]}>Landmark / delivery notes</Text>
              <TextInput
                style={[
                  styles.formInput,
                  isDarkMode && {
                    backgroundColor: subBg,
                    borderColor: inputBorderCol,
                    color: textPrimary,
                  },
                ]}
                value={deliveryNotes}
                onChangeText={setDeliveryNotes}
                placeholder="e.g. blue gate, beside the sari-sari store"
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* ─── 3. PAYMENT METHOD SELECTION ─── */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: textPrimary }]}>Payment Method *</Text>
              <Text style={{ fontSize: 11.5, color: textMuted, marginBottom: 8 }}>
                Choose your preferred payment method for this order:
              </Text>

              {/* Option 1: Cash on Delivery (COD) */}
              <TouchableOpacity
                style={[
                  styles.paymentOptionCard,
                  isDarkMode && { backgroundColor: subBg, borderColor: borderCol },
                  paymentMethod === 'Cash on Delivery (COD)' && [
                    styles.paymentOptionCardActive,
                    isDarkMode && {
                      backgroundColor: 'rgba(234, 88, 12, 0.12)',
                      borderColor: '#EA580C',
                    },
                  ],
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
                        backgroundColor: isDarkMode ? 'rgba(22, 163, 74, 0.18)' : '#DCFCE7',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <BootstrapIcon name="cash-stack" size={18} color={isDarkMode ? '#00C98D' : '#16A34A'} />
                    </View>
                    <View>
                      <Text style={[styles.paymentOptionTitle, { color: textPrimary }]}>
                        Cash on Delivery (COD)
                      </Text>
                      <Text style={[styles.paymentOptionSub, { color: textMuted }]}>
                        Pay cash to courier upon doorstep delivery
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.paymentRadioDot,
                      isDarkMode && { borderColor: '#475569' },
                      paymentMethod === 'Cash on Delivery (COD)' && styles.paymentRadioDotActive,
                    ]}
                  >
                    {paymentMethod === 'Cash on Delivery (COD)' && <View style={styles.paymentRadioInner} />}
                  </View>
                </View>

                {paymentMethod === 'Cash on Delivery (COD)' && (
                  <View style={[styles.paymentDetailsDrawer, isDarkMode && { borderTopColor: borderCol }]}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        backgroundColor: isDarkMode ? 'rgba(22, 163, 74, 0.14)' : '#FFFFFF',
                        padding: 10,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: isDarkMode ? 'rgba(74, 222, 128, 0.3)' : '#BBF7D0',
                        marginBottom: 8,
                      }}
                    >
                      <BootstrapIcon name="cash-coin" size={14} color={isDarkMode ? '#00C98D' : '#16A34A'} />
                      <Text style={{ fontSize: 11.5, color: isDarkMode ? '#86EFAC' : '#166534', fontWeight: '700', flex: 1 }}>
                        Exact amount to prepare: ₱
                        {displayTotal.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </Text>
                    </View>
                    <View
                      style={{
                        backgroundColor: isDarkMode ? 'rgba(234, 88, 12, 0.12)' : '#F3F7F6',
                        padding: 9,
                        borderRadius: 9,
                        borderWidth: 1,
                        borderColor: isDarkMode ? 'rgba(251, 146, 60, 0.3)' : '#C8DDD3',
                        marginBottom: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <BootstrapIcon name="shield-lock-fill" size={13} color={brandAccent} />
                      <Text style={{ fontSize: 11, color: brandAccent, fontWeight: '700', flex: 1 }}>
                        COD orders require Store Admin verification before dispatch.
                      </Text>
                    </View>
                    <TextInput
                      style={[
                        styles.formInput,
                        {
                          fontSize: 12.5,
                          backgroundColor: isDarkMode ? '#14181D' : '#FFFFFF',
                          borderColor: inputBorderCol,
                          color: textPrimary,
                        },
                      ]}
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
                  isDarkMode && { backgroundColor: subBg, borderColor: borderCol },
                  paymentMethod === 'GCash' && [
                    styles.paymentOptionCardActive,
                    isDarkMode && {
                      backgroundColor: 'rgba(234, 88, 12, 0.12)',
                      borderColor: '#EA580C',
                    },
                  ],
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
                        <Text style={[styles.paymentOptionTitle, { color: textPrimary }]}>GCash Express Pay</Text>
                        <View
                          style={{
                            backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.2)' : '#FDE68A',
                            paddingHorizontal: 6,
                            paddingVertical: 1.5,
                            borderRadius: 6,
                          }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '600', color: brandAccent }}>INSTANT</Text>
                        </View>
                      </View>
                      <Text style={[styles.paymentOptionSub, { color: textMuted }]}>
                        Instant e-wallet payment with reference code
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.paymentRadioDot,
                      isDarkMode && { borderColor: '#475569' },
                      paymentMethod === 'GCash' && styles.paymentRadioDotActive,
                    ]}
                  >
                    {paymentMethod === 'GCash' && <View style={styles.paymentRadioInner} />}
                  </View>
                </View>

                {paymentMethod === 'GCash' && (
                  <View style={[styles.paymentDetailsDrawer, isDarkMode && { borderTopColor: borderCol }]}>
                    <View
                      style={{
                        backgroundColor: isDarkMode ? '#14181D' : '#FFFFFF',
                        padding: 12,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: isDarkMode ? borderCol : '#C8DDD3',
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
                        <Text style={{ fontSize: 11, fontWeight: '600', color: textMuted }}>
                          OFFICIAL GCASH MERCHANT:
                        </Text>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: brandAccent }}>
                          0917-582-9410
                        </Text>
                      </View>
                      <Text style={{ fontSize: 11, color: textSecondary }}>
                        Account Name: MotoTrack Motorparts and Accessories
                      </Text>
                    </View>

                    <Text style={[styles.formLabel, { fontSize: 12, marginBottom: 4, color: textPrimary }]}>
                      Your GCash Mobile Number *
                    </Text>
                    <TextInput
                      style={[
                        styles.formInput,
                        {
                          fontSize: 13,
                          backgroundColor: isDarkMode ? '#14181D' : '#FFFFFF',
                          borderColor: inputBorderCol,
                          color: textPrimary,
                          marginBottom: 8,
                        },
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
                        backgroundColor: isDarkMode ? 'rgba(22, 163, 74, 0.14)' : '#F0FDF4',
                        padding: 8,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: isDarkMode ? 'rgba(74, 222, 128, 0.3)' : '#BBF7D0',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <BootstrapIcon name="check-circle-fill" size={13} color={isDarkMode ? '#00C98D' : '#16A34A'} />
                        <Text style={{ fontSize: 11.5, fontWeight: '700', color: isDarkMode ? '#86EFAC' : '#166534' }}>
                          Reference: {gcashReference}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          setGcashReference('MP-GCASH-' + Math.floor(100000 + Math.random() * 900000));
                          showToast('Generated fresh GCash reference code');
                        }}
                      >
                        <BootstrapIcon name="arrow-clockwise" size={13} color={isDarkMode ? '#00C98D' : '#16A34A'} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* ─── 4. ORDER SUMMARY & TOTAL ─── */}
            <View
              style={{
                backgroundColor: subBg,
                padding: 14,
                borderRadius: 14,
                marginVertical: 10,
                borderWidth: 1,
                borderColor: borderCol,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: textPrimary, marginBottom: 8 }}>
                Order Summary ({displayItemCount} {displayItemCount === 1 ? 'item' : 'items'})
              </Text>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 12.5, color: textMuted, fontWeight: '600' }}>Subtotal</Text>
                <Text style={{ fontSize: 12.5, color: textPrimary, fontWeight: '700' }}>
                  ₱{Number(summarySubtotal || 0).toFixed(2)}
                </Text>
              </View>

              {summaryDiscount > 0 ? (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 12.5, color: isDarkMode ? '#00C98D' : '#16A34A', fontWeight: '700' }}>
                    {appliedPromoMeta?.code || 'Discount'}
                    {discountPercent > 0 ? ` −${discountPercent}%` : ''}
                  </Text>
                  <Text style={{ fontSize: 12.5, color: isDarkMode ? '#00C98D' : '#16A34A', fontWeight: '700' }}>
                    −₱{Number(summaryDiscount).toFixed(2)}
                  </Text>
                </View>
              ) : null}

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 12.5, color: textMuted, fontWeight: '600' }}>Shipping</Text>
                <Text style={{ fontSize: 12.5, color: textPrimary, fontWeight: '700' }}>
                  ₱{Number(summaryFreeShipping ? shippingRate || 150 : summaryShipping || 0).toFixed(2)}
                </Text>
              </View>

              {summaryFreeShipping ? (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 12.5, color: isDarkMode ? '#00C98D' : '#16A34A', fontWeight: '700' }}>
                    ✓ Free Shipping
                  </Text>
                  <Text style={{ fontSize: 12.5, color: isDarkMode ? '#00C98D' : '#16A34A', fontWeight: '700' }}>
                    −₱{Number(shippingRate || 150).toFixed(2)}
                  </Text>
                </View>
              ) : null}

              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: borderCol,
                  marginTop: 8,
                  paddingTop: 8,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: textPrimary }}>Total to Pay</Text>
                <Text style={{ fontSize: 18, fontWeight: '700', color: brandAccent }}>
                  ₱
                  {Number(displayTotal).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* ─── PLACE ORDER BUTTON ─── */}
          <TouchableOpacity
            style={[
              styles.checkoutBtn,
              { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
              busy && { opacity: 0.7 },
            ]}
            onPress={handleSubmit}
            activeOpacity={0.9}
            disabled={busy}
          >
            {busy ? (
              <>
                <ActivityIndicator size="small" color="#ffffff" />
                <Text style={styles.checkoutBtnText}>Placing Order...</Text>
              </>
            ) : (
              <>
                <Text style={styles.checkoutBtnText}>Place Order Now</Text>
                <BootstrapIcon name="arrow-right" size={14} color="#ffffff" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const createCheckoutStyles = (isDarkMode) =>
  StyleSheet.create({
    addressCardContainer: {
      backgroundColor: isDarkMode ? '#18181B' : '#F8FAFC',
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: isDarkMode ? '#303236' : '#E2E8F0',
      marginBottom: 14,
    },
    addressCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? '#303236' : '#EDF2F7',
    },
    addressCardTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: isDarkMode ? '#F2F2F3' : '#0F172A',
    },
    editProfileAddressBtn: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      backgroundColor: isDarkMode ? 'rgba(234, 88, 12, 0.14)' : '#F3F7F6',
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(251, 146, 60, 0.35)' : '#C8DDD3',
    },
    editProfileAddressText: {
      fontSize: 11,
      fontWeight: '600',
      color: isDarkMode ? '#FB923C' : '#EA580C',
    },
    addressDisplayWrap: {
      paddingTop: 8,
      gap: 4,
    },
    addressRecipientName: {
      fontSize: 13.5,
      fontWeight: '600',
      color: isDarkMode ? '#F2F2F3' : '#0F172A',
    },
    addressPhoneText: {
      fontSize: 12.5,
      fontWeight: '600',
      color: '#94A3B8',
    },
    addressFullText: {
      fontSize: 12.5,
      color: isDarkMode ? '#A1A1AA' : '#334155',
      lineHeight: 18,
      marginTop: 2,
    },
    profileSyncBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 6,
      backgroundColor: isDarkMode ? 'rgba(234, 88, 12, 0.12)' : '#F3F7F6',
      borderWidth: isDarkMode ? 1 : 0,
      borderColor: isDarkMode ? 'rgba(251, 146, 60, 0.28)' : 'transparent',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    profileSyncBadgeText: {
      fontSize: 10.5,
      color: isDarkMode ? '#FB923C' : '#EA580C',
      fontWeight: '700',
    },
    inlineAddressForm: {
      paddingTop: 8,
      gap: 6,
    },
    inlineFormLabel: {
      fontSize: 11.5,
      fontWeight: '700',
      color: isDarkMode ? '#A1A1AA' : '#475569',
    },
    inlineInput: {
      backgroundColor: isDarkMode ? '#14181D' : '#FFFFFF',
      borderRadius: 10,
      padding: 10,
      borderWidth: 1,
      borderColor: isDarkMode ? '#333A42' : '#CBD5E1',
      fontSize: 12.5,
      color: isDarkMode ? '#F2F2F3' : '#0F172A',
      minHeight: 60,
      textAlignVertical: 'top',
    },
    inlineSaveBtn: {
      backgroundColor: '#EA580C',
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: 'center',
      marginTop: 4,
    },
    inlineSaveBtnText: {
      fontSize: 12.5,
      fontWeight: '600',
      color: '#FFFFFF',
    },
  });
