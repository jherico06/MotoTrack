import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Modal } from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon.jsx';
import { shopStyles as styles } from '../../styles/shop.styles.js';
import {
  getProductSizeEntries,
  getSizePrice,
  getSizeStock,
  isProductSoldOut,
  isSizeSoldOut,
  productNeedsSizes,
  withSelectedSize,
} from '../../utils/productSizes.js';
import {
  getColorImage,
  getProductColorEntries,
  isColorSoldOut,
  productHasColors,
  withSelectedColor,
} from '../../utils/productColors.js';

/**
 * Buy Now / Add to Cart options modal — size, color, quantity + Place Order / Add to Cart.
 */
export default function PlaceOrderModal({
  visible,
  product,
  mode = 'buy', // 'buy' | 'cart'
  onClose,
  onConfirm,
}) {
  const sizeEntries = useMemo(() => getProductSizeEntries(product), [product]);
  const colorEntries = useMemo(() => getProductColorEntries(product), [product]);
  const needsSize = productNeedsSizes(product);
  const needsColor = productHasColors(product);
  const productSoldOut = isProductSoldOut(product);

  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!visible || !product) return;
    const sizes = getProductSizeEntries(product);
    const firstSize = sizes.find((e) => !isSizeSoldOut(product, e.label));
    setSelectedSize(firstSize?.label || (sizes.length === 1 ? sizes[0].label : ''));

    const colors = getProductColorEntries(product);
    const firstColor = colors.find((e) => !isColorSoldOut(product, e.label));
    setSelectedColor(firstColor?.label || (colors.length === 1 ? colors[0].label : ''));
    setQuantity(1);
  }, [visible, product]);

  const availableStock = useMemo(() => {
    if (!product) return 0;
    if (selectedSize) {
      const sized = getSizeStock(product, selectedSize);
      if (sized != null) return Math.max(0, Number(sized) || 0);
    }
    return Math.max(0, Number(product?.stock) || 0);
  }, [product, selectedSize]);

  const maxQty = Math.max(1, availableStock || 1);

  useEffect(() => {
    setQuantity((prev) => Math.min(Math.max(1, prev), maxQty));
  }, [maxQty, selectedSize]);

  if (!product) return null;

  const sizeSoldOut = selectedSize ? isSizeSoldOut(product, selectedSize) : false;
  const colorSoldOut = selectedColor ? isColorSoldOut(product, selectedColor) : false;

  const canConfirm =
    !productSoldOut &&
    availableStock > 0 &&
    (!needsSize || (Boolean(selectedSize) && !sizeSoldOut)) &&
    (!needsColor || (Boolean(selectedColor) && !colorSoldOut));

  const displayPrice = selectedSize
    ? getSizePrice(product, selectedSize)
    : Number(product.price) || 0;

  const previewImage =
    (selectedColor && getColorImage(product, selectedColor)) || product.image;

  const handleConfirm = () => {
    if (!canConfirm) return;
    const qty = Math.min(Math.max(1, Number(quantity) || 1), maxQty);
    let finalProduct = needsSize ? withSelectedSize(product, selectedSize) : { ...product };
    if (selectedColor) {
      finalProduct = withSelectedColor(finalProduct, selectedColor);
    }
    onConfirm?.(finalProduct, {
      size: selectedSize || '',
      color: selectedColor || '',
      quantity: qty,
      mode,
    });
  };

  const isBuy = mode === 'buy';
  const title = isBuy ? 'Place Order' : 'Add to Cart';
  const lineTotal = Number(displayPrice) * Math.max(1, quantity);
  const confirmLabel = isBuy
    ? productSoldOut || sizeSoldOut || colorSoldOut || availableStock <= 0
      ? 'Unavailable'
      : `Place Order · ₱${lineTotal.toFixed(2)}`
    : `Add ${quantity} to Cart · ₱${lineTotal.toFixed(2)}`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { maxHeight: '90%' }]}>
          <View style={styles.modalHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: '#FFF7ED',
                  borderWidth: 1,
                  borderColor: '#FED7AA',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BootstrapIcon
                  name={mode === 'buy' ? 'lightning-fill' : 'cart-plus-fill'}
                  size={16}
                  color="#EA580C"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{title}</Text>
                <Text style={{ fontSize: 12, color: '#64748B', marginTop: 1 }}>
                  Configure color, size, and quantity
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
              <BootstrapIcon name="x-lg" size={14} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
            <Image
              key={previewImage}
              source={{ uri: previewImage }}
              style={styles.specImageBanner}
            />
            <Text style={styles.specTitle}>{product.name}</Text>
            <Text style={{ fontSize: 13, color: '#64748B', fontWeight: '600', marginBottom: 8 }}>
              {product.brand} • {product.category}
              {selectedColor ? ` • ${selectedColor}` : ''}
            </Text>

            <View style={styles.specPriceRow}>
              <Text style={styles.specPriceMain}>₱{Number(displayPrice).toFixed(2)}</Text>
            </View>

            {productSoldOut || availableStock <= 0 ? (
              <View
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: '#FEE2E2',
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 8,
                  marginBottom: 10,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#DC2626' }}>SOLD OUT</Text>
              </View>
            ) : null}

            {needsColor ? (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.formLabel}>Select Color *</Text>
                <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 6 }}>
                  Tap a color to preview the product in that finish.
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
                  {colorEntries.map((entry) => {
                    const soldOut = isColorSoldOut(product, entry.label);
                    const active = selectedColor === entry.label;
                    return (
                      <TouchableOpacity
                        key={entry.label}
                        disabled={soldOut}
                        onPress={() => setSelectedColor(entry.label)}
                        style={{
                          alignItems: 'center',
                          width: 76,
                          opacity: soldOut ? 0.55 : 1,
                        }}
                        activeOpacity={0.85}
                      >
                        <View
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            backgroundColor: entry.hex || '#CBD5E1',
                            borderWidth: active ? 3 : 1.5,
                            borderColor: soldOut ? '#FECACA' : active ? '#EA580C' : '#E2E8F0',
                            overflow: 'hidden',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {entry.image ? (
                            <Image
                              source={{ uri: entry.image }}
                              style={{ width: '100%', height: '100%' }}
                              resizeMode="cover"
                            />
                          ) : null}
                        </View>
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '800',
                            marginTop: 6,
                            textAlign: 'center',
                            color: soldOut ? '#991B1B' : active ? '#EA580C' : '#0F172A',
                            textDecorationLine: soldOut ? 'line-through' : 'none',
                          }}
                          numberOfLines={2}
                        >
                          {entry.label}
                        </Text>
                        {soldOut ? (
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#DC2626' }}>
                            Sold Out
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {needsColor && !selectedColor ? (
                  <Text style={{ fontSize: 12, color: '#DC2626', marginTop: 6, fontWeight: '600' }}>
                    Choose a color to continue.
                  </Text>
                ) : null}
              </View>
            ) : null}

            {needsSize ? (
              <View style={{ marginTop: 14 }}>
                <Text style={styles.formLabel}>Select Size *</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                  {sizeEntries.map((entry) => {
                    const soldOut = isSizeSoldOut(product, entry.label);
                    const active = selectedSize === entry.label;
                    const units = getSizeStock(product, entry.label);
                    return (
                      <TouchableOpacity
                        key={entry.label}
                        disabled={soldOut}
                        onPress={() => setSelectedSize(entry.label)}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 10,
                          borderWidth: 1.5,
                          borderColor: soldOut ? '#FECACA' : active ? '#EA580C' : '#E2E8F0',
                          backgroundColor: soldOut ? '#FEF2F2' : active ? '#EA580C' : '#F8FAFC',
                          minWidth: 112,
                          opacity: soldOut ? 0.75 : 1,
                        }}
                        activeOpacity={0.85}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '800',
                            color: soldOut ? '#991B1B' : active ? '#FFFFFF' : '#0F172A',
                            textDecorationLine: soldOut ? 'line-through' : 'none',
                          }}
                        >
                          {entry.label}
                        </Text>
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '700',
                            marginTop: 2,
                            color: soldOut ? '#DC2626' : active ? '#FED7AA' : '#EA580C',
                          }}
                        >
                          {soldOut ? 'Sold Out' : `₱${Number(entry.price || 0).toLocaleString()}`}
                        </Text>
                        {!soldOut && units <= 5 ? (
                          <Text
                            style={{
                              fontSize: 10,
                              fontWeight: '600',
                              marginTop: 2,
                              color: active ? '#99F6E4' : '#B45309',
                            }}
                          >
                            Only {units} left
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {needsSize && !selectedSize ? (
                  <Text style={{ fontSize: 12, color: '#DC2626', marginTop: 6, fontWeight: '600' }}>
                    Choose an available size to continue.
                  </Text>
                ) : null}
              </View>
            ) : null}

            {/* Quantity stepper */}
            <View
              style={{
                marginTop: 16,
                marginBottom: 8,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#F8FAFC',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#E2E8F0',
                paddingHorizontal: 14,
                paddingVertical: 12,
              }}
            >
              <View>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>Quantity</Text>
                <Text style={{ fontSize: 11.5, color: '#64748B', fontWeight: '600', marginTop: 2 }}>
                  {availableStock > 0 ? `${availableStock} in stock` : 'Out of stock'}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TouchableOpacity
                  onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1 || availableStock <= 0}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    backgroundColor: quantity <= 1 ? '#E2E8F0' : '#FFFFFF',
                    borderWidth: 1.5,
                    borderColor: '#CBD5E1',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: quantity <= 1 ? 0.55 : 1,
                  }}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon name="dash" size={14} color="#0F172A" />
                </TouchableOpacity>

                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '900',
                    color: '#0F172A',
                    minWidth: 28,
                    textAlign: 'center',
                  }}
                >
                  {quantity}
                </Text>

                <TouchableOpacity
                  onPress={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                  disabled={quantity >= maxQty || availableStock <= 0}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    backgroundColor: quantity >= maxQty ? '#E2E8F0' : '#FFFFFF',
                    borderWidth: 1.5,
                    borderColor: '#CBD5E1',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: quantity >= maxQty ? 0.55 : 1,
                  }}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon name="plus" size={14} color="#0F172A" />
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>

          <View style={{ marginTop: 12, gap: 8 }}>
            <TouchableOpacity
              style={[
                styles.checkoutBtn,
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  backgroundColor: canConfirm ? '#EA580C' : '#94A3B8',
                  opacity: canConfirm ? 1 : 0.55,
                },
              ]}
              disabled={!canConfirm}
              onPress={handleConfirm}
              activeOpacity={0.9}
            >
              <BootstrapIcon
                name={isBuy ? 'bag-check-fill' : 'cart-plus-fill'}
                size={15}
                color="#FFFFFF"
              />
              <Text style={styles.checkoutBtnText}>{confirmLabel}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              style={{
                paddingVertical: 10,
                alignItems: 'center',
              }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#64748B' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
