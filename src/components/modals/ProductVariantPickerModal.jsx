import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  SafeAreaView,
  Alert,
} from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon';
import { variantModalStyles as styles } from '../../styles/productVariantPickerModal.styles';
import {
  getProductColorEntries,
  getColorImage,
  isColorSoldOut,
  productHasColors,
  withSelectedColor,
} from '../../utils/productColors';
import {
  getProductSizeEntries,
  getSizePrice,
  getSizeStock,
  isProductSoldOut,
  isSizeSoldOut,
  productNeedsSizes,
  withSelectedSize,
} from '../../utils/productSizes';
import { sanitizeCompareAtPrice } from '../../utils/productCatalog';

export default function ProductVariantPickerModal({
  visible,
  product,
  mode = 'buy', // 'buy' | 'cart'
  selectedColor: propSelectedColor = '',
  selectedSize: propSelectedSize = '',
  quantity: propQuantity = 1,
  onClose,
  onConfirm,
  isFreeShippingActive = false,
  activePromo = null,
}) {
  const colorEntries = useMemo(() => getProductColorEntries(product), [product]);
  const sizeEntries = useMemo(() => getProductSizeEntries(product), [product]);
  const needsColor = productHasColors(product);
  const needsSize = productNeedsSizes(product);
  const productSoldOut = isProductSoldOut(product);

  // Local selection state inside the modal (allows picking before confirming)
  const [internalColor, setInternalColor] = useState(propSelectedColor);
  const [internalSize, setInternalSize] = useState(propSelectedSize);
  const [internalQty, setInternalQty] = useState(propQuantity || 1);
  const [validationError, setValidationError] = useState('');

  // Selected values (fallback to prop or first in-stock option if none)
  const activeColor = internalColor || propSelectedColor || (colorEntries.length === 1 ? colorEntries[0].label : '');
  const activeSize = internalSize || propSelectedSize || (sizeEntries.length === 1 ? sizeEntries[0].label : '');

  // Dynamic price calculation based on selected size
  const currentPrice = activeSize
    ? getSizePrice(product, activeSize)
    : Number(product?.price) || 0;

  // Genuine discount: only a real admin compare-at, never the leftover ₱42,500 default
  const rawOldPrice = sanitizeCompareAtPrice(product?.oldPrice, currentPrice);
  const hasValidOldPrice = Boolean(rawOldPrice);
  const originalPrice = hasValidOldPrice ? rawOldPrice : null;
  const discountPercent = hasValidOldPrice
    ? Math.min(99, Math.max(1, Math.round(((originalPrice - currentPrice) / originalPrice) * 100)))
    : null;

  // Active preview image (swaps when tapping a color card)
  const activeImage = (activeColor && getColorImage(product, activeColor)) || product?.image;

  // Stock availability
  const currentStock = activeSize
    ? getSizeStock(product, activeSize) ?? product?.stock ?? 20
    : Number(product?.stock) || 20;

  const sizeSoldOut = activeSize ? isSizeSoldOut(product, activeSize) : false;
  const colorSoldOut = activeColor ? isColorSoldOut(product, activeColor) : false;
  const isVariantSoldOut = productSoldOut || sizeSoldOut || colorSoldOut || currentStock <= 0;

  // Price formatting
  const priceIntStr = Math.floor(currentPrice).toLocaleString();
  const priceDecStr = (currentPrice % 1).toFixed(2).substring(1);

  // Stepper handlers
  const handleDecQty = () => {
    setInternalQty((prev) => Math.max(1, prev - 1));
  };
  const handleIncQty = () => {
    setInternalQty((prev) => Math.min(Math.max(1, currentStock), prev + 1));
  };

  const handleSelectColor = (label) => {
    if (isColorSoldOut(product, label)) return;
    setInternalColor(label);
    setValidationError('');
  };

  const handleSelectSize = (label) => {
    if (isSizeSoldOut(product, label)) return;
    setInternalSize(label);
    setValidationError('');
  };

  const handleShowSizeGuide = () => {
    const category = product?.category || 'Motorcycle Parts';
    Alert.alert(
      'Fitment & Size Guide',
      `Product: ${product?.name || 'Part'}\nCategory: ${category}\n\n• For Tires & Rims: Verify wheel rim diameter and tire width.\n• For Exhaust & Performance: Universal or specific model fitment.\n• Contact MotoTrack certified technicians if unsure about compatibility.`
    );
  };

  const handleConfirmPress = () => {
    if (productSoldOut) return;

    if (needsColor && !activeColor) {
      setValidationError('Please select a color option');
      return;
    }

    if (needsSize && !activeSize) {
      setValidationError('Please select a size specification');
      return;
    }

    if (isVariantSoldOut) {
      setValidationError('The selected option is currently sold out');
      return;
    }

    let configured = { ...product };
    if (activeSize) {
      configured = withSelectedSize(configured, activeSize);
    }
    if (activeColor) {
      configured = withSelectedColor(configured, activeColor);
    }

    onConfirm?.(configured, {
      size: activeSize,
      color: activeColor,
      quantity: internalQty,
      mode,
    });
  };

  if (!product) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.backdropTouchable}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.modalSheet}>
          {/* Subtle drag handle */}
          <View style={styles.dragHandleBar} />

          {/* ─── MODAL HEADER ─── */}
          <View style={styles.sheetHeader}>
            {/* Product Thumbnail (swaps dynamically with selected color) */}
            <View style={styles.productThumbnailContainer}>
              <Image
                source={{ uri: activeImage }}
                style={styles.productThumbnail}
                resizeMode="contain"
              />
            </View>

            {/* Price & Badges */}
            <View style={styles.headerInfo}>
              <View style={styles.priceRow}>
                {hasValidOldPrice && discountPercent && discountPercent > 0 && (
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountBadgeText}>-{discountPercent}%</Text>
                  </View>
                )}
                <Text style={styles.priceCurrency}>₱</Text>
                <Text style={styles.priceInteger}>{priceIntStr}</Text>
                <Text style={styles.priceDecimal}>{priceDecStr}</Text>
                {hasValidOldPrice && originalPrice && (
                  <Text style={styles.priceOriginal}>₱{originalPrice.toFixed(2)}</Text>
                )}
              </View>

              {/* Perks Row — ONLY when genuine free shipping or active promo exists */}
              {(isFreeShippingActive || activePromo) && (
                <View style={styles.perksRow}>
                  {isFreeShippingActive && (
                    <View style={styles.freeShippingBadge}>
                      <BootstrapIcon name="truck" size={10} color="#1D4533" />
                      <Text style={styles.freeShippingBadgeText}>Free shipping</Text>
                    </View>
                  )}
                  {activePromo && (
                    <View style={styles.bonusBadge}>
                      <Text style={styles.bonusBadgeText}>
                        Code {activePromo.code} ({activePromo.discountPercent}% OFF)
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Selected summary */}
              <Text style={styles.selectedVariantSummary} numberOfLines={1}>
                {activeColor && activeSize
                  ? `Selected: ${activeColor} • ${activeSize}`
                  : activeColor
                  ? `Selected: ${activeColor}`
                  : activeSize
                  ? `Selected: ${activeSize}`
                  : 'Please select an option'}
              </Text>
            </View>

            {/* Close Button */}
            <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.8}>
              <BootstrapIcon name="x-lg" size={13} color="#0F172A" />
            </TouchableOpacity>
          </View>

          {/* ─── SCROLLABLE OPTIONS ─── */}
          <ScrollView
            style={styles.scrollBody}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            {/* Validation alert banner */}
            {validationError ? (
              <View
                style={{
                  backgroundColor: '#FEF2F2',
                  borderWidth: 1,
                  borderColor: '#FECACA',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  marginTop: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <BootstrapIcon name="exclamation-circle-fill" size={14} color="#EF4444" />
                <Text style={{ color: '#DC2626', fontSize: 12, fontWeight: '700' }}>
                  {validationError}
                </Text>
              </View>
            ) : null}

            {/* ─── COLOR SELECTION GRID (TIKTOK SHOP STYLE) ─── */}
            {colorEntries.length > 0 && (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Color</Text>
                  {activeColor ? (
                    <Text style={styles.sectionSub}>{activeColor}</Text>
                  ) : (
                    <Text style={{ fontSize: 12, color: '#DC2626', fontWeight: '700' }}>Required</Text>
                  )}
                </View>

                <View style={styles.colorGrid}>
                  {colorEntries.map((col) => {
                    const isSelected = activeColor === col.label;
                    const soldOut = isColorSoldOut(product, col.label);
                    const colImg = getColorImage(product, col.label);

                    return (
                      <View key={col.label} style={styles.colorCardCol}>
                        <TouchableOpacity
                          style={[
                            styles.colorCard,
                            isSelected && styles.colorCardSelected,
                            soldOut && styles.colorCardSoldOut,
                          ]}
                          disabled={soldOut}
                          onPress={() => handleSelectColor(col.label)}
                          activeOpacity={0.85}
                        >
                          {/* Image preview with expand icon */}
                          <View style={styles.colorCardImageContainer}>
                            <Image
                              source={{ uri: colImg }}
                              style={styles.colorCardImage}
                              resizeMode="contain"
                            />
                            {isSelected && (
                              <View style={styles.colorCardSelectedBadge}>
                                <BootstrapIcon name="check" size={12} color="#FFFFFF" />
                              </View>
                            )}
                          </View>

                          {/* Dark footer bar with color name */}
                          <View
                            style={[
                              styles.colorCardFooter,
                              isSelected && styles.colorCardFooterSelected,
                            ]}
                          >
                            <Text style={styles.colorCardLabel} numberOfLines={1}>
                              {col.label}
                            </Text>
                            {soldOut ? (
                              <Text style={styles.colorCardSub}>Sold out</Text>
                            ) : isSelected ? (
                              <Text style={styles.colorCardSub}>Selected</Text>
                            ) : null}
                          </View>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ─── SIZE SELECTION CHIPS ─── */}
            {sizeEntries.length > 0 && (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Size</Text>
                  <TouchableOpacity
                    style={styles.sizeGuideLink}
                    onPress={handleShowSizeGuide}
                    activeOpacity={0.8}
                  >
                    <BootstrapIcon name="rulers" size={12} color="#1D4533" />
                    <Text style={styles.sizeGuideText}>Size guide</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.sizeWrap}>
                  {sizeEntries.map((sz) => {
                    const isSelected = activeSize === sz.label;
                    const soldOut = isSizeSoldOut(product, sz.label);
                    const sizePrice = getSizePrice(product, sz.label);
                    const priceDiff = sizePrice - Number(product.price || 0);

                    return (
                      <TouchableOpacity
                        key={sz.label}
                        disabled={soldOut}
                        onPress={() => handleSelectSize(sz.label)}
                        style={[
                          styles.sizeChip,
                          isSelected && styles.sizeChipSelected,
                          soldOut && styles.sizeChipSoldOut,
                        ]}
                        activeOpacity={0.85}
                      >
                        <Text
                          style={[
                            styles.sizeChipText,
                            isSelected && styles.sizeChipTextSelected,
                            soldOut && { textDecorationLine: 'line-through', color: '#94A3B8' },
                          ]}
                        >
                          {sz.label}
                        </Text>
                        {soldOut ? (
                          <Text style={[styles.sizeChipPrice, { color: '#EF4444' }]}>Sold out</Text>
                        ) : priceDiff !== 0 ? (
                          <Text
                            style={[
                              styles.sizeChipPrice,
                              isSelected && styles.sizeChipPriceSelected,
                            ]}
                          >
                            ₱{sizePrice.toLocaleString()}
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ─── QUANTITY ROW ─── */}
            <View style={styles.quantityRow}>
              <View style={styles.quantityLeft}>
                <Text style={styles.quantityLabel}>Quantity</Text>
                <Text style={styles.stockAvailableText}>
                  {isVariantSoldOut ? 'Out of stock' : `${currentStock} in stock`}
                </Text>
              </View>

              <View style={styles.stepperContainer}>
                <TouchableOpacity
                  style={[styles.stepperBtn, (internalQty <= 1 || isVariantSoldOut) && styles.stepperBtnDisabled]}
                  onPress={handleDecQty}
                  disabled={internalQty <= 1 || isVariantSoldOut}
                  activeOpacity={0.8}
                >
                  <BootstrapIcon name="dash" size={14} color="#0F172A" />
                </TouchableOpacity>

                <Text style={styles.stepperValue}>{internalQty}</Text>

                <TouchableOpacity
                  style={[
                    styles.stepperBtn,
                    (internalQty >= currentStock || isVariantSoldOut) && styles.stepperBtnDisabled,
                  ]}
                  onPress={handleIncQty}
                  disabled={internalQty >= currentStock || isVariantSoldOut}
                  activeOpacity={0.8}
                >
                  <BootstrapIcon name="plus" size={14} color="#0F172A" />
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>

          {/* ─── STICKY BOTTOM CONFIRM BUTTON ─── */}
          <SafeAreaView edges={['bottom']} style={styles.stickyFooter}>
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                isVariantSoldOut && styles.confirmBtnDisabled,
              ]}
              disabled={isVariantSoldOut}
              onPress={handleConfirmPress}
              activeOpacity={0.9}
            >
              <Text style={styles.confirmBtnTitle}>
                {isVariantSoldOut
                  ? 'Currently Sold Out'
                  : mode === 'buy'
                  ? 'Buy now'
                  : 'Add to Cart'}
              </Text>
              {!isVariantSoldOut && (
                <Text style={styles.confirmBtnSub}>
                  ₱{(currentPrice * internalQty).toFixed(2)}
                  {isFreeShippingActive ? ' | Free shipping' : ''}
                </Text>
              )}
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}
