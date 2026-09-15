import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, TextInput, Modal } from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon';
import { shopStyles as styles } from '../../styles/shop.styles';
import { useCart } from '../../context/CartContext';

export default function CartModal({ visible, onClose, onProceedToCheckout }) {
  const {
    cart,
    updateCartQuantity,
    removeFromCart,
    cartItemCount,
    cartSubtotal,
    discountPercent,
    discountAmount,
    cartTotal,
    promoCode,
    setPromoCode,
    applyPromo,
    promoFeedback,
  } = useCart();

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <BootstrapIcon name="bag-fill" size={16} color="#0C6258" />
              <Text style={styles.modalTitle}>Your Cart ({cartItemCount} items)</Text>
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
              <BootstrapIcon name="x-lg" size={14} color="#64748b" />
            </TouchableOpacity>
          </View>

          {cart.length === 0 ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <BootstrapIcon name="bag-x" size={40} color="#94A3B8" style={{ marginBottom: 12 }} />
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>Your cart is empty</Text>
              <Text style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
                Browse our catalog and add motorcycle pro gear to your bag!
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
