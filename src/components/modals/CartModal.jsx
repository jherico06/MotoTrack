import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, TextInput, Modal } from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon';
import { shopStyles as styles } from '../../styles/shop.styles';
import { useCart } from '../../context/CartContext';
import { promoService } from '../../services/promoService';

export default function CartModal({ visible, onClose, onProceedToCheckout }) {
  const {
    cart,
    updateCartQuantity,
    removeFromCart,
    cartItemCount,
    cartSubtotal,
    discountPercent,
    discountAmount,
    shippingFee,
    isFreeShipping,
    cartTotal,
    promoCode,
    setPromoCode,
    applyPromo,
    promoFeedback,
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

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <BootstrapIcon name="cart-fill" size={16} color="#0C6258" />
              <Text style={styles.modalTitle}>Your Cart ({cartItemCount} items)</Text>
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
              <BootstrapIcon name="x-lg" size={14} color="#64748b" />
            </TouchableOpacity>
          </View>

          {cart.length === 0 ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <BootstrapIcon name="cart-x" size={42} color="#94A3B8" style={{ marginBottom: 12 }} />
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>Your cart is empty</Text>
              <Text style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
                Browse our catalog and add motorcycle pro gear to your cart!
              </Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {cart.map(({ product, quantity }, cIdx) => (
                <View
                  key={product.id ? `cart-${product.id}` : `cart-item-${cIdx}`}
                  style={styles.cartItemRow}
                >
                  <Image source={{ uri: product.image }} style={styles.cartItemThumb} />
                  <View style={styles.cartItemInfo}>
                    <Text style={styles.cartItemTitle} numberOfLines={1}>
                      {product.name}
                    </Text>
                    <Text style={styles.cartItemBrand}>{product.brand}</Text>
                    <Text style={styles.cartItemPrice}>₱{(product.price * quantity).toFixed(2)}</Text>
                  </View>

                  <View style={styles.cartQtyControls}>
                    <TouchableOpacity
                      style={styles.cartQtyBtn}
                      onPress={() => updateCartQuantity(product.id, -1)}
                    >
                      <Text style={styles.cartQtyBtnText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.cartQtyNumber}>{quantity}</Text>
                    <TouchableOpacity
                      style={styles.cartQtyBtn}
                      onPress={() => updateCartQuantity(product.id, 1)}
                    >
                      <Text style={styles.cartQtyBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity onPress={() => removeFromCart(product.id)} style={{ padding: 6 }}>
                    <BootstrapIcon name="trash3-fill" size={14} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {cart.length > 0 && (
            <View style={styles.cartFooter}>
              {/* Available Active Promos */}
              {availablePromos.length > 0 && (
                <View style={{ marginBottom: 10 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 6, letterSpacing: 0.3 }}>
                    ACTIVE PROMOS (TAP TO APPLY):
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {availablePromos.map((p) => {
                      const isSelected = promoCode.trim().toUpperCase() === p.code;
                      const isFreeShip = p.description?.toLowerCase().includes('free shipping');
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
                            backgroundColor: isSelected ? '#0C6258' : '#F1F5F9',
                            borderColor: isSelected ? '#0C6258' : '#CBD5E1',
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
                            color={isSelected ? '#FFFFFF' : '#0C6258'}
                          />
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: '800',
                              color: isSelected ? '#FFFFFF' : '#0F172A',
                            }}
                          >
                            {p.code} ({p.discountPercent}% OFF{isFreeShip ? ' + Free Ship' : ''})
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Promo Code Input */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <TextInput
                  style={[styles.formInput, { flex: 1, marginBottom: 0 }]}
                  placeholder="Promo Code (e.g. SWIM30)"
                  placeholderTextColor="#94A3B8"
                  value={promoCode}
                  onChangeText={setPromoCode}
                  autoCapitalize="characters"
                />
                <TouchableOpacity
                  style={[styles.checkoutBtn, { marginTop: 0, paddingHorizontal: 16, height: 42 }]}
                  onPress={() => applyPromo(promoCode)}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>Apply</Text>
                </TouchableOpacity>
              </View>

              {promoFeedback?.text ? (
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: promoFeedback.isError ? '#DC2626' : '#16A34A',
                    marginBottom: 8,
                  }}
                >
                  {promoFeedback.text}
                </Text>
              ) : null}

              <View style={styles.cartSummaryRow}>
                <Text style={styles.cartSummaryLabel}>Subtotal</Text>
                <Text style={styles.cartSummaryValue}>₱{cartSubtotal.toFixed(2)}</Text>
              </View>

              {discountPercent > 0 && (
                <View style={styles.cartSummaryRow}>
                  <Text style={[styles.cartSummaryLabel, { color: '#16A34A' }]}>
                    Discount ({discountPercent}%)
                  </Text>
                  <Text style={[styles.cartSummaryValue, { color: '#16A34A' }]}>
                    -₱{discountAmount.toFixed(2)}
                  </Text>
                </View>
              )}

              <View style={styles.cartSummaryRow}>
                <Text style={styles.cartSummaryLabel}>Shipping</Text>
                <Text style={styles.cartSummaryValue}>
                  {isFreeShipping ? 'Free' : `₱${shippingFee.toFixed(2)}`}
                </Text>
              </View>

              <View style={styles.cartSummaryRow}>
                <Text style={styles.cartTotalLabel}>Total</Text>
                <Text style={styles.cartTotalValue}>₱{cartTotal.toFixed(2)}</Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.checkoutBtn,
                  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
                ]}
                onPress={onProceedToCheckout}
                activeOpacity={0.9}
              >
                <Text style={styles.checkoutBtnText}>Proceed to Checkout</Text>
                <BootstrapIcon name="arrow-right" size={14} color="#ffffff" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
