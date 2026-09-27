import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Modal } from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon';
import { shopStyles as styles } from '../../styles/shop.styles';
import {
  getProductSizeEntries,
  getSizePrice,
  getSizeStock,
  isProductSoldOut,
  isSizeSoldOut,
  productNeedsSizes,
  withSelectedSize,
} from '../../utils/productSizes';
import {
  getColorImage,
  getProductColorEntries,
  isColorSoldOut,
  productHasColors,
  withSelectedColor,
} from '../../utils/productColors';

/**
 * Buy Now / Add to Cart options modal — size & color selection + Place Order / Add to Cart.
 * Selecting a color swaps the product preview image when that color has its own photo.
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

  useEffect(() => {
    if (!visible || !product) return;
    const sizes = getProductSizeEntries(product);
    const firstSize = sizes.find((e) => !isSizeSoldOut(product, e.label));
    setSelectedSize(firstSize?.label || (sizes.length === 1 ? sizes[0].label : ''));

    const colors = getProductColorEntries(product);
    const firstColor = colors.find((e) => !isColorSoldOut(product, e.label));
    setSelectedColor(firstColor?.label || (colors.length === 1 ? colors[0].label : ''));
  }, [visible, product]);

  if (!product) return null;

  const sizeSoldOut = selectedSize ? isSizeSoldOut(product, selectedSize) : false;
  const colorSoldOut = selectedColor ? isColorSoldOut(product, selectedColor) : false;

  const canConfirm =
    !productSoldOut &&
    (!needsSize || (Boolean(selectedSize) && !sizeSoldOut)) &&
    (!needsColor || (Boolean(selectedColor) && !colorSoldOut));

  const displayPrice = selectedSize
    ? getSizePrice(product, selectedSize)
    : Number(product.price) || 0;

  const previewImage =
    (selectedColor && getColorImage(product, selectedColor)) || product.image;

  const handleConfirm = () => {
    if (!canConfirm) return;
    let finalProduct = needsSize ? withSelectedSize(product, selectedSize) : { ...product };
    if (selectedColor) {
      finalProduct = withSelectedColor(finalProduct, selectedColor);
    }
    onConfirm?.(finalProduct, {
      size: selectedSize || '',
      color: selectedColor || '',
      mode,
    });
  };

  const isBuy = mode === 'buy';
  const title = isBuy ? 'Place Order' : 'Add to Cart';
  const confirmLabel = isBuy
    ? productSoldOut || sizeSoldOut || colorSoldOut
      ? 'Unavailable'
      : 'Place Order'
    : 'Add to Cart';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { maxHeight: '90%' }]}>
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalTitle}>{title}</Text>
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

            {productSoldOut ? (
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
                            borderColor: soldOut ? '#FECACA' : active ? '#1D4533' : '#E2E8F0',
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
                            color: soldOut ? '#991B1B' : active ? '#1D4533' : '#0F172A',
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
                          borderColor: soldOut ? '#FECACA' : active ? '#1D4533' : '#E2E8F0',
                          backgroundColor: soldOut ? '#FEF2F2' : active ? '#1D4533' : '#F8FAFC',
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
                            color: soldOut ? '#DC2626' : active ? '#CCFBF1' : '#1D4533',
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

            {!needsSize && !needsColor ? (
              <Text style={{ fontSize: 13, color: '#64748B', marginTop: 8, fontWeight: '600' }}>
                Ready to {isBuy ? 'place your order' : 'add this item to your cart'}.
              </Text>
            ) : null}
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
                  backgroundColor: canConfirm ? '#1D4533' : '#94A3B8',
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
