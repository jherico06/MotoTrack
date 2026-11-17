import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, TextInput, Modal, useWindowDimensions } from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon.jsx';
import { shopStyles as styles } from '../../styles/shop.styles.js';
import { useCart } from '../../context/CartContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { promoService } from '../../services/products/promoService.js';

export default function CartModal({ visible, onClose, onProceedToCheckout, isDarkMode: isDarkProp }) {
  const { isDarkMode: themeDark } = useTheme();
  const isDarkMode = typeof isDarkProp === 'boolean' ? isDarkProp : Boolean(themeDark);
  const { width: windowWidth } = useWindowDimensions();
  const {
    cart,
    updateCartQuantity,
    removeFromCart,
    cartItemCount,
    selectedCartItems,
    selectedCartItemCount,
    selectedCartSubtotal,
    selectedDiscountAmount,
    selectedShippingFee,
    selectedCartTotal,
    isAllSelected,
    isItemSelected,
    toggleSelectItem,
    toggleSelectAll,
    discountPercent,
    isFreeShipping,
    appliedPromoMeta,
    promoCode,
    setPromoCode,
    applyPromo,
    promoFeedback,
    showToast,
    shippingRate,
  } = useCart();

  const [availablePromos, setAvailablePromos] = useState([]);

  useEffect(() => {
    if (visible) {
      promoService.getPromos().then((all) => {
        const active = (all || []).filter((p) => p.isActive);
        setAvailablePromos(active);
      });
    }
  }, [visible]);

  const hasSelectedItems = selectedCartItems.length > 0;

  const handleCheckoutPress = () => {
    if (!hasSelectedItems) {
      showToast?.('Please select at least one item to proceed to checkout');
      return;
    }
    onProceedToCheckout?.(selectedCartItems);
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
            isDarkMode && {
              backgroundColor: '#181B1F',
              borderWidth: 1,
              borderColor: '#282D34',
            },
            isDesktop && {
              borderRadius: 24,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: '90%',
              maxWidth: 580,
              alignSelf: 'center',
              boxShadow: isDarkMode ? '0 24px 60px rgba(0, 0, 0, 0.55)' : '0 20px 60px rgba(0, 0, 0, 0.25)',
            },
            windowWidth < 400 && { paddingHorizontal: 12, paddingTop: 16, paddingBottom: 24 },
          ]}
        >
          <View style={styles.modalHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: isDarkMode ? 'rgba(234, 88, 12, 0.16)' : '#FFF7ED',
                  borderWidth: 1,
                  borderColor: isDarkMode ? 'rgba(234, 88, 12, 0.35)' : '#FED7AA',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BootstrapIcon name="cart-fill" size={16} color={isDarkMode ? '#FB923C' : '#EA580C'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { fontWeight: '700' }, isDarkMode && { color: '#F8FAFC' }]}>
                  Your Cart
                </Text>
                <Text style={{ fontSize: 12, color: isDarkMode ? '#A1A1AA' : '#64748B', marginTop: 1 }}>
                  {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'} in your bag
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.modalCloseBtn, isDarkMode && { backgroundColor: '#252A30' }]}
              onPress={onClose}
            >
              <BootstrapIcon name="x-lg" size={14} color={isDarkMode ? '#A1A1AA' : '#64748B'} />
            </TouchableOpacity>
          </View>

          {cart.length === 0 ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <BootstrapIcon name="cart-x" size={42} color={isDarkMode ? '#71717A' : '#94A3B8'} style={{ marginBottom: 12 }} />
              <Text style={{ fontSize: 16, fontWeight: '700', color: isDarkMode ? '#F2F2F3' : '#0F172A' }}>
                Your cart is empty
              </Text>
              <Text style={{ fontSize: 13, color: isDarkMode ? '#A1A1AA' : '#64748B', marginTop: 4 }}>
                Browse our catalog and add motorcycle pro gear to your cart!
              </Text>
            </View>
          ) : (
            <>
              {/* ─── SELECT ALL ROW ─── */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 10,
                  paddingHorizontal: 4,
                  borderBottomWidth: 1,
                  borderBottomColor: isDarkMode ? '#303236' : '#F1F5F9',
                  marginBottom: 6,
                }}
              >
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                  onPress={toggleSelectAll}
                  activeOpacity={0.7}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      borderWidth: 1.8,
                      borderColor: isAllSelected ? '#EA580C' : isDarkMode ? '#333A42' : '#CBD5E1',
                      backgroundColor: isAllSelected ? '#EA580C' : isDarkMode ? '#14181D' : '#FFFFFF',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isAllSelected && <BootstrapIcon name="check" size={15} color="#FFFFFF" />}
                  </View>
                  <Text style={{ fontSize: 13.5, fontWeight: '700', color: isDarkMode ? '#F2F2F3' : '#0F172A' }}>
                    Select All ({cart.length})
                  </Text>
                </TouchableOpacity>

                {hasSelectedItems ? (
                  <View
                    style={{
                      backgroundColor: isDarkMode ? 'rgba(234, 88, 12, 0.16)' : '#FFF7ED',
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 12,
                    }}
                  >
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: isDarkMode ? '#FB923C' : '#EA580C' }}>
                      {selectedCartItems.length} selected ({selectedCartItemCount} {selectedCartItemCount === 1 ? 'unit' : 'units'})
                    </Text>
                  </View>
                ) : (
                  <Text style={{ fontSize: 12, color: isDarkMode ? '#71717A' : '#94A3B8', fontWeight: '500' }}>
                    0 selected
                  </Text>
                )}
              </View>

              <ScrollView style={{ maxHeight: 'min(380px, calc(80vh - 220px))' }} showsVerticalScrollIndicator={false}>
                {cart.map(({ product, quantity, size }, cIdx) => {
                  const lineSize = size || product.selectedSize || '';
                  const isChecked = isItemSelected(product.id, lineSize);
                  return (
                    <View
                      key={product.id ? `cart-${product.id}-${lineSize || cIdx}` : `cart-item-${cIdx}`}
                      style={[
                        styles.cartItemRow,
                        isDarkMode && { borderBottomColor: '#282D34' },
                        windowWidth < 380 && { gap: 8 },
                        !isChecked && { opacity: 0.72 },
                      ]}
                    >
                      {/* Selection Checkbox */}
                      <TouchableOpacity
                        style={{
                          paddingRight: 2,
                          paddingVertical: 6,
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                        onPress={() => toggleSelectItem(product.id, lineSize)}
                        activeOpacity={0.7}
                      >
                        <View
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 6,
                            borderWidth: 1.8,
                            borderColor: isChecked ? '#EA580C' : isDarkMode ? '#333A42' : '#CBD5E1',
                            backgroundColor: isChecked ? '#EA580C' : isDarkMode ? '#14181D' : '#FFFFFF',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {isChecked && <BootstrapIcon name="check" size={15} color="#FFFFFF" />}
                        </View>
                      </TouchableOpacity>

                      <Image
                        source={{ uri: product.image }}
                        style={[
                          styles.cartItemThumb,
                          isDarkMode && { backgroundColor: '#252A30' },
                          windowWidth < 380 && { width: 48, height: 48 },
                        ]}
                      />
                      <View style={styles.cartItemInfo}>
                        <Text
                          style={[styles.cartItemTitle, isDarkMode && { color: '#F8FAFC' }]}
                          numberOfLines={1}
                        >
                          {product.name}
                        </Text>
                        <Text style={[styles.cartItemBrand, isDarkMode && { color: '#94A3B8' }]}>
                          {product.brand}
                          {lineSize ? ` · Size ${lineSize}` : ''}
                        </Text>
                        <Text
                          style={[
                            styles.cartItemPrice,
                            { fontWeight: '700' },
                            isDarkMode && { color: '#FB923C' },
                          ]}
                        >
                          ₱{(product.price * quantity).toFixed(2)}
                        </Text>
                      </View>

                      <View style={styles.cartQtyControls}>
                        <TouchableOpacity
                          style={[styles.cartQtyBtn, isDarkMode && { backgroundColor: '#252A30' }]}
                          onPress={() => updateCartQuantity(product.id, -1, lineSize)}
                        >
                          <Text
                            style={[
                              styles.cartQtyBtnText,
                              { fontWeight: '700' },
                              isDarkMode && { color: '#F8FAFC' },
                            ]}
                          >
                            -
                          </Text>
                        </TouchableOpacity>
                        <Text
                          style={[
                            styles.cartQtyNumber,
                            { fontWeight: '700' },
                            isDarkMode && { color: '#F8FAFC' },
                          ]}
                        >
                          {quantity}
                        </Text>
                        <TouchableOpacity
                          style={[styles.cartQtyBtn, isDarkMode && { backgroundColor: '#252A30' }]}
                          onPress={() => updateCartQuantity(product.id, 1, lineSize)}
                        >
                          <Text
                            style={[
                              styles.cartQtyBtnText,
                              { fontWeight: '700' },
                              isDarkMode && { color: '#F8FAFC' },
                            ]}
                          >
                            +
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        onPress={() => removeFromCart(product.id, lineSize)}
                        style={{ padding: 6 }}
                      >
                        <BootstrapIcon name="trash3-fill" size={14} color={isDarkMode ? '#F04444' : '#EF4444'} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
            </>
          )}

          {cart.length > 0 && (
            <View style={[styles.cartFooter, isDarkMode && { borderTopColor: '#282D34' }]}>
              {/* Available Active Promos */}
              {availablePromos.length > 0 && (
                <View style={{ marginBottom: 10 }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: isDarkMode ? '#A1A1AA' : '#64748B',
                      marginBottom: 6,
                      letterSpacing: 0.3,
                    }}
                  >
                    ACTIVE PROMOS (TAP TO APPLY):
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {availablePromos.map((p) => {
                      const isSelected = promoCode.trim().toUpperCase() === p.code;
                      const isFreeShip = p.promoType === 'FREE_SHIPPING';
                      const label = isFreeShip
                        ? `${p.code} (Free Ship)`
                        : `${p.code} (${p.discountPercent}% OFF)`;
                      return (
                        <TouchableOpacity
                          key={p.code}
                          onPress={() => {
                            setPromoCode(p.code);
                            applyPromo(p.code);
                          }}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 5,
                            backgroundColor: isSelected ? '#EA580C' : isDarkMode ? '#202124' : '#F1F5F9',
                            borderColor: isSelected ? '#EA580C' : isDarkMode ? '#333A42' : '#CBD5E1',
                            borderWidth: 1,
                            borderRadius: 12,
                            paddingHorizontal: 9,
                            paddingVertical: 5,
                          }}
                          activeOpacity={0.8}
                        >
                          <BootstrapIcon
                            name={isSelected ? 'check-circle-fill' : 'ticket-perforated-fill'}
                            size={11}
                            color={isSelected ? '#FFFFFF' : isDarkMode ? '#FB923C' : '#EA580C'}
                          />
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: '500',
                              color: isSelected ? '#FFFFFF' : isDarkMode ? '#A1A1AA' : '#0F172A',
                            }}
                          >
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Promo Code Input */}
              <View style={{ marginBottom: 4 }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: isDarkMode ? '#A1A1AA' : '#64748B',
                    marginBottom: 6,
                  }}
                >
                  Promo Code
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                  <TextInput
                    style={[
                      styles.formInput,
                      { flex: 1, marginBottom: 0 },
                      isDarkMode && {
                        backgroundColor: '#14181D',
                        borderColor: '#333A42',
                        color: '#F8FAFC',
                      },
                    ]}
                    placeholder="Enter promo code..."
                    placeholderTextColor="#94A3B8"
                    value={promoCode}
                    onChangeText={setPromoCode}
                    autoCapitalize="characters"
                  />
                  <TouchableOpacity
                    style={[styles.checkoutBtn, { marginTop: 0, paddingHorizontal: 16, height: 42 }]}
                    onPress={() => applyPromo(promoCode)}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 13 }}>Apply</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {promoFeedback?.text ? (
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: promoFeedback.isError
                      ? isDarkMode ? '#F04444'
                        : '#DC2626'
                      : isDarkMode ? '#00C98D'
                        : '#16A34A',
                    marginBottom: 8,
                  }}
                >
                  {promoFeedback.text}
                </Text>
              ) : null}

              <View style={styles.cartSummaryRow}>
                <Text style={[styles.cartSummaryLabel, isDarkMode && { color: '#94A3B8' }]}>Subtotal</Text>
                <Text style={[styles.cartSummaryValue, isDarkMode && { color: '#F8FAFC' }]}>
                  ₱{selectedCartSubtotal.toFixed(2)}
                </Text>
              </View>

              {selectedDiscountAmount > 0 && (
                <View style={styles.cartSummaryRow}>
                  <Text style={[styles.cartSummaryLabel, { color: isDarkMode ? '#00C98D' : '#16A34A' }]}>
                    {appliedPromoMeta?.code || promoCode || 'Promo'}
                    {discountPercent > 0 ? ` −${discountPercent}%` : ''}
                  </Text>
                  <Text style={[styles.cartSummaryValue, { color: isDarkMode ? '#00C98D' : '#16A34A' }]}>
                    −₱{selectedDiscountAmount.toFixed(2)}
                  </Text>
                </View>
              )}

              <View style={styles.cartSummaryRow}>
                <Text style={[styles.cartSummaryLabel, isDarkMode && { color: '#94A3B8' }]}>Shipping</Text>
                <Text style={[styles.cartSummaryValue, isDarkMode && { color: '#F8FAFC' }]}>
                  {selectedCartItems.length === 0
                    ? '₱0.00'
                    : `₱${(isFreeShipping ? shippingRate : selectedShippingFee).toFixed(2)}`}
                </Text>
              </View>

              {isFreeShipping && selectedCartItems.length > 0 && (
                <View style={styles.cartSummaryRow}>
                  <Text style={[styles.cartSummaryLabel, { color: isDarkMode ? '#00C98D' : '#16A34A' }]}>
                    Free Shipping
                  </Text>
                  <Text style={[styles.cartSummaryValue, { color: isDarkMode ? '#00C98D' : '#16A34A' }]}>
                    −₱{Number(shippingRate || 0).toFixed(2)}
                  </Text>
                </View>
              )}

              <View style={styles.cartSummaryRow}>
                <Text style={[styles.cartTotalLabel, { fontWeight: '700' }, isDarkMode && { color: '#F8FAFC' }]}>
                  Total
                </Text>
                <Text
                  style={[styles.cartTotalValue, { fontWeight: '700' }, isDarkMode && { color: '#FB923C' }]}
                >
                  ₱{selectedCartTotal.toFixed(2)}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.checkoutBtn,
                  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
                  !hasSelectedItems && { opacity: 0.5, backgroundColor: isDarkMode ? '#333A42' : '#94A3B8' },
                ]}
                onPress={handleCheckoutPress}
                activeOpacity={0.9}
              >
                <Text style={styles.checkoutBtnText}>
                  {hasSelectedItems
                    ? `Proceed to Checkout (${selectedCartItemCount})`
                    : 'Select Items to Checkout'}
                </Text>
                <BootstrapIcon name="arrow-right" size={14} color="#ffffff" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
