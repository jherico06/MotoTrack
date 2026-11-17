import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  StyleSheet,
  SafeAreaView,
  Modal,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BootstrapIcon, ToastNotification } from '../../../components/common';
import { ProductSpecsModal } from '../../../components/modals';
import { useCart } from '../../../context/CartContext.jsx';
import { useWishlist } from '../../../context/WishlistContext.jsx';
import { useTheme } from '../../../context/ThemeContext.jsx';
import { promoService } from '../../../services/products/promoService.js';
import { productService } from '../../../services/products/productService.js';
import { isProductSoldOut } from '../../../utils/productSizes.js';
import { resolveReorderLevel } from '../../../utils/inventoryHelpers.js';
import { productHasCustomerRatings } from '../../../utils/productCatalog.js';
import { ANDROID_STATUSBAR_TOP, ANDROID_BOTTOM_INSET } from '../../../utils/safeArea.js';

function resolveProductImage(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (raw.startsWith('data:')) return raw;
  if (raw.includes('/storage/v1/render/image/public/')) {
    return raw.replace('/storage/v1/render/image/public/', '/storage/v1/object/public/').split('?')[0];
  }
  return raw;
}

function formatPhpAmount(val) {
  return `₱${Number(val || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function MobileCartPage({
  visible = true,
  onClose,
  onProceedToCheckout,
  onNavigateToStore,
  onNavigateToWishlist,
  onBuyNow,
}) {
  const { width: windowWidth } = useWindowDimensions();
  const isCompact = windowWidth < 380;
  const horizontalPad = isCompact ? 12 : 16;
  const gridGap = 10;
  const suggestedCardWidth = Math.floor((windowWidth - horizontalPad * 2 - gridGap) / 2);

  const { isDarkMode = false } = useTheme?.() || {};
  const {
    cart,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
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
    toastMessage,
    shippingRate,
  } = useCart();
  const { wishlist, isWishlisted, toggleWishlist } = useWishlist();

  const savedWishlistCount = useMemo(
    () => Object.values(wishlist || {}).filter(Boolean).length,
    [wishlist]
  );

  const [availablePromos, setAvailablePromos] = useState([]);
  const [suggestedProducts, setSuggestedProducts] = useState([]);
  const [selectedProductForSpecs, setSelectedProductForSpecs] = useState(null);
  const [isSpecsOpen, setIsSpecsOpen] = useState(false);

  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);

  useEffect(() => {
    if (!visible) return;
    let alive = true;

    promoService
      .getActivePromos()
      .then((active) => {
        if (alive) setAvailablePromos(Array.isArray(active) ? active : []);
      })
      .catch(() => {});

    productService
      .getProducts()
      .then((list) => {
        if (!alive || !Array.isArray(list)) return;
        const inStock = list.filter((p) => !isProductSoldOut(p)).slice(0, 6);
        setSuggestedProducts(inStock);
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, [visible]);

  // Auto-apply eligible percent-off promo (matching Web CartPage behavior)
  useEffect(() => {
    if (!visible || selectedCartItems.length === 0 || availablePromos.length === 0) return;
    if (appliedPromoMeta?.code) return;
    let cancelled = false;
    (async () => {
      const percentPromos = availablePromos.filter((p) => p?.promoType === 'PERCENT_OFF');
      for (const p of percentPromos) {
        if (cancelled) return;
        try {
          const res = await promoService.validatePromo(p.code, {
            cartItems: selectedCartItems,
            shippingFee: shippingRate,
          });
          if (!cancelled && res?.valid) {
            setPromoCode?.(p.code);
            await applyPromo?.(p.code);
            break;
          }
        } catch (_e) {}
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, selectedCartItems, availablePromos, appliedPromoMeta?.code, applyPromo, setPromoCode, shippingRate]);

  const getActiveProductPromo = useCallback(
    (product) => {
      if (!product || !Array.isArray(availablePromos) || availablePromos.length === 0) return null;
      const pid = String(product.id || product.product_id || '');
      const matching = availablePromos.filter((p) => {
        if (!p || !p.isActive || p.promoType !== 'PERCENT_OFF') return false;
        const pct = Number(p.discountPercent || 0);
        if (pct <= 0) return false;
        if (p.appliesTo === 'ALL_PRODUCTS') return true;
        return (p.productIds || []).map(String).includes(pid);
      });
      if (matching.length === 0) return null;
      return matching.reduce((best, cur) =>
        Number(cur.discountPercent || 0) > Number(best.discountPercent || 0) ? cur : best
      );
    },
    [availablePromos]
  );

  const hasSelectedItems = selectedCartItems.length > 0;

  const handleBackToShop = () => {
    if (onClose) onClose();
    else onNavigateToStore?.();
  };

  const handleOpenWishlist = () => {
    onClose?.();
    onNavigateToWishlist?.();
  };

  const handleCheckoutPress = () => {
    if (!hasSelectedItems) {
      showToast?.('Please select at least one item to proceed to checkout');
      return;
    }
    onProceedToCheckout?.(selectedCartItems);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      transparent={false}
      onRequestClose={handleBackToShop}
    >
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style={isDarkMode ? 'light' : 'light'} backgroundColor="#1E2227" />
        <ToastNotification message={toastMessage} />

        {/* ─── STICKY TOP PAGE NAVBAR (Matches Web Header Aesthetic) ─── */}
        <View style={styles.topHeader}>
          <View style={styles.topHeaderInner}>
            <TouchableOpacity
              style={styles.headerBackBtn}
              onPress={handleBackToShop}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Back to Shop"
            >
              <BootstrapIcon name="arrow-left" size={18} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.headerTitleGroup}>
              <Text style={styles.headerTitle}>Your Cart</Text>
              <Text style={styles.headerSubtitle}>
                {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.headerActionBtn}
              onPress={handleOpenWishlist}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Saved Wishlist"
            >
              <BootstrapIcon name="bookmark" size={17} color="#FFFFFF" />
              {savedWishlistCount > 0 && (
                <View style={styles.headerBadgeCircle}>
                  <Text style={styles.headerBadgeText}>
                    {savedWishlistCount > 99 ? '99+' : savedWishlistCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: horizontalPad },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Breadcrumb Strip (Matches Web CartPage) */}
          <View style={styles.breadcrumbRow}>
            <TouchableOpacity
              style={styles.backToShopBtn}
              onPress={handleBackToShop}
              activeOpacity={0.8}
            >
              <BootstrapIcon
                name="arrow-left"
                size={13}
                color={isDarkMode ? '#F2F2F3' : '#334155'}
              />
              <Text style={styles.backToShopText}>Back to Shop</Text>
            </TouchableOpacity>

            <View style={styles.breadcrumbTrail}>
              <Text style={styles.breadcrumbMuted}>Shop</Text>
              <BootstrapIcon name="chevron-right" size={10} color="#94A3B8" />
              <Text style={styles.breadcrumbActive}>Cart</Text>
            </View>
          </View>

          {/* ─── EMPTY CART STATE ─── */}
          {cart.length === 0 ? (
            <View>
              <View style={styles.emptyStateCard}>
                <View style={styles.emptyIconCircle}>
                  <BootstrapIcon name="cart-x" size={32} color="#EA580C" />
                </View>
                <Text style={styles.emptyTitle}>Your cart is empty</Text>
                <Text style={styles.emptySub}>
                  Browse our catalog and add genuine motorcycle parts, lubricants, and riding gear to your bag.
                </Text>

                <View style={styles.emptyActionsCol}>
                  <TouchableOpacity
                    style={styles.primaryExploreBtn}
                    onPress={handleBackToShop}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon name="bag-plus-fill" size={14} color="#FFFFFF" />
                    <Text style={styles.primaryExploreBtnText}>Browse Parts Catalog</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryExploreBtn}
                    onPress={handleOpenWishlist}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon
                      name="bookmark"
                      size={14}
                      color={isDarkMode ? '#F2F2F3' : '#1E293B'}
                    />
                    <Text style={styles.secondaryExploreBtnText}>
                      View Saved Wishlist{savedWishlistCount > 0 ? ` (${savedWishlistCount})` : ''}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Trust Highlights */}
                <View style={styles.emptyTrustRow}>
                  <View style={styles.emptyTrustItem}>
                    <BootstrapIcon name="shield-check" size={14} color="#EA580C" />
                    <Text style={styles.emptyTrustText}>100% Genuine Parts</Text>
                  </View>
                  <View style={styles.emptyTrustItem}>
                    <BootstrapIcon name="truck" size={14} color="#EA580C" />
                    <Text style={styles.emptyTrustText}>Fast Tracked Delivery</Text>
                  </View>
                  <View style={styles.emptyTrustItem}>
                    <BootstrapIcon name="tools" size={14} color="#EA580C" />
                    <Text style={styles.emptyTrustText}>Verified Bike Fitment</Text>
                  </View>
                </View>
              </View>

              {/* Recommended In-Stock Parts (Matches Web Popular Gear & Parts) */}
              {suggestedProducts.length > 0 && (
                <View style={styles.suggestedSection}>
                  <View style={styles.suggestedHeaderRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sectionHeaderText}>Popular Gear & Parts</Text>
                      <Text style={styles.sectionSubText}>
                        Quick-add top-rated motorcycle essentials directly to your cart
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={handleBackToShop}
                      activeOpacity={0.75}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    >
                      <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#EA580C' }}>
                        View All
                      </Text>
                      <BootstrapIcon name="arrow-right" size={12} color="#EA580C" />
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.suggestedGrid, { gap: gridGap }]}>
                    {suggestedProducts.map((product) => {
                      const isFav = isWishlisted(product.id);
                      const soldOut = isProductSoldOut(product);
                      const lowStock =
                        !soldOut &&
                        Number(product.stock) > 0 &&
                        Number(product.stock) <= resolveReorderLevel(product, 5);
                      const basePrice = Number(product.price) || 0;
                      const activePromo = getActiveProductPromo(product);
                      const promoPct = Number(activePromo?.discountPercent || 0);
                      const hasCompareDiscount =
                        product.compare_at_price && Number(product.compare_at_price) > basePrice;
                      const hasDiscount = hasCompareDiscount || promoPct > 0;
                      const displayPrice =
                        promoPct > 0 ? basePrice * (1 - promoPct / 100) : basePrice;
                      const comparePrice =
                        promoPct > 0 ? basePrice : Number(product.compare_at_price || 0);
                      const itemDiscountPercent =
                        promoPct > 0
                          ? Math.round(promoPct)
                          : hasCompareDiscount
                            ? Math.round(
                                ((Number(product.compare_at_price) - basePrice) /
                                  Number(product.compare_at_price)) *
                                  100
                              )
                            : 0;
                      const hasRatings = productHasCustomerRatings(product);
                      const imgUri = resolveProductImage(product.image || product.imageUrl);

                      return (
                        <TouchableOpacity
                          key={product.id}
                          style={[styles.productCard, { width: suggestedCardWidth }]}
                          onPress={() => {
                            setSelectedProductForSpecs(product);
                            setIsSpecsOpen(true);
                          }}
                          activeOpacity={0.9}
                        >
                          <View style={styles.productImgWrap}>
                            {imgUri ? (
                              <Image
                                source={{ uri: imgUri }}
                                style={styles.productImg}
                                resizeMode="cover"
                              />
                            ) : (
                              <View style={styles.productImgPlaceholder}>
                                <BootstrapIcon
                                  name="box-seam"
                                  size={28}
                                  color={isDarkMode ? '#475569' : '#CBD5E1'}
                                />
                              </View>
                            )}

                            {soldOut ? (
                              <View style={styles.soldOutBadge}>
                                <Text style={styles.badgeTagText}>SOLD OUT</Text>
                              </View>
                            ) : hasDiscount && itemDiscountPercent > 0 ? (
                              <View style={styles.discountBadge}>
                                <Text style={styles.badgeTagText}>-{itemDiscountPercent}%</Text>
                              </View>
                            ) : null}

                            <TouchableOpacity
                              style={styles.wishlistBookmarkBtn}
                              onPress={(e) => {
                                e?.stopPropagation?.();
                                toggleWishlist?.(product.id);
                              }}
                              activeOpacity={0.8}
                              accessibilityLabel={isFav ? 'Remove from Wishlist' : 'Save to Wishlist'}
                            >
                              <BootstrapIcon
                                name={isFav ? 'bookmark-fill' : 'bookmark'}
                                size={13}
                                color={isFav ? '#EA580C' : isDarkMode ? '#A1A1AA' : '#64748B'}
                              />
                            </TouchableOpacity>
                          </View>

                          <View style={styles.productDetails}>
                            {product.brand ? (
                              <Text style={styles.productBrandText} numberOfLines={1}>
                                {String(product.brand).toUpperCase()}
                              </Text>
                            ) : null}
                            <Text style={styles.productNameText} numberOfLines={2}>
                              {product.name}
                            </Text>
                            <View style={styles.productPriceRow}>
                              <Text style={styles.productPriceMain}>₱{displayPrice.toFixed(2)}</Text>
                              {hasDiscount && comparePrice > displayPrice && (
                                <Text style={styles.productPriceOld}>
                                  ₱{Number(comparePrice).toFixed(2)}
                                </Text>
                              )}
                            </View>
                            <View style={styles.productMetaRow}>
                              {hasRatings ? (
                                <View style={styles.productRatingRow}>
                                  <BootstrapIcon name="star-fill" size={10} color="#F59E0B" />
                                  <Text style={styles.productRatingVal}>
                                    {Number(product.rating || 5).toFixed(1)}
                                  </Text>
                                  <Text style={styles.productReviewCount}>
                                    ({product.reviews || 0})
                                  </Text>
                                </View>
                              ) : (
                                <View style={styles.productRatingRow}>
                                  <BootstrapIcon
                                    name="star"
                                    size={10}
                                    color={isDarkMode ? '#71717A' : '#94A3B8'}
                                  />
                                  <Text style={styles.productReviewCount}>No ratings yet</Text>
                                </View>
                              )}
                              <Text style={styles.metaDot}>•</Text>
                              <Text
                                style={[
                                  styles.productStockText,
                                  soldOut && { color: '#DC2626' },
                                ]}
                                numberOfLines={1}
                              >
                                {soldOut
                                  ? 'Sold out'
                                  : lowStock
                                    ? `Only ${product.stock} left`
                                    : `${product.stock} in stock`}
                              </Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          ) : (
            /* ─── POPULATED CART PAGE ─── */
            <View style={{ gap: 16 }}>
              {/* Select All Header Bar */}
              <View style={styles.selectAllBar}>
                <TouchableOpacity
                  style={styles.selectAllTouch}
                  onPress={toggleSelectAll}
                  activeOpacity={0.75}
                >
                  <View style={[styles.checkboxBox, isAllSelected && styles.checkboxBoxChecked]}>
                    {isAllSelected && <BootstrapIcon name="check" size={14} color="#FFFFFF" />}
                  </View>
                  <Text style={styles.selectAllLabel}>
                    Select All ({cart.length} {cart.length === 1 ? 'item' : 'items'})
                  </Text>
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={styles.selectedCountText}>
                    {hasSelectedItems ? `${selectedCartItems.length} selected` : '0 selected'}
                  </Text>
                  <View style={styles.toolbarDivider} />
                  <TouchableOpacity
                    style={styles.clearCartBtn}
                    onPress={() => {
                      clearCart?.();
                      showToast?.('Cart cleared');
                    }}
                    activeOpacity={0.75}
                  >
                    <BootstrapIcon
                      name="trash3"
                      size={13}
                      color={isDarkMode ? '#A1A1AA' : '#64748B'}
                    />
                    <Text style={styles.clearCartBtnText}>Clear</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Cart Items Stack */}
              <View style={styles.itemsListStack}>
                {cart.map(({ product, quantity, size }, cIdx) => {
                  const lineSize = size || product.selectedSize || '';
                  const isChecked = isItemSelected(product.id, lineSize);
                  const itemPromo = getActiveProductPromo(product);
                  const itemPromoPct = Number(itemPromo?.discountPercent || 0);
                  const baseUnitPrice = Number(product.price || 0);
                  const effectiveUnitPrice =
                    itemPromoPct > 0 ? baseUnitPrice * (1 - itemPromoPct / 100) : baseUnitPrice;
                  const lineTotal = effectiveUnitPrice * Number(quantity || 1);
                  const saved = isWishlisted?.(product.id);
                  const thumbUri = resolveProductImage(product.image || product.imageUrl);

                  return (
                    <View
                      key={product.id ? `cart-page-${product.id}-${lineSize || cIdx}` : `cart-item-${cIdx}`}
                      style={[styles.cartItemCard, !isChecked && { opacity: 0.65 }]}
                    >
                      <View style={styles.cartItemTopRow}>
                        {/* Checkbox */}
                        <TouchableOpacity
                          style={styles.itemCheckboxWrap}
                          onPress={() => toggleSelectItem(product.id, lineSize)}
                          activeOpacity={0.7}
                        >
                          <View
                            style={[styles.checkboxBox, isChecked && styles.checkboxBoxChecked]}
                          >
                            {isChecked && <BootstrapIcon name="check" size={14} color="#FFFFFF" />}
                          </View>
                        </TouchableOpacity>

                        {/* Thumbnail */}
                        <TouchableOpacity
                          style={styles.itemThumbContainer}
                          onPress={() => {
                            setSelectedProductForSpecs(product);
                            setIsSpecsOpen(true);
                          }}
                          activeOpacity={0.85}
                        >
                          {thumbUri ? (
                            <Image
                              source={{ uri: thumbUri }}
                              style={styles.itemThumb}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={styles.productImgPlaceholder}>
                              <BootstrapIcon name="box-seam" size={22} color="#94A3B8" />
                            </View>
                          )}
                        </TouchableOpacity>

                        {/* Info */}
                        <View style={styles.itemDetailsCol}>
                          <Text style={styles.itemBrandText} numberOfLines={1}>
                            {product.brand || 'MOTOTRACK'}
                            {product.category ? ` · ${product.category}` : ''}
                            {lineSize ? ` · Size ${lineSize}` : ''}
                          </Text>

                          <Text style={styles.itemTitleText} numberOfLines={2}>
                            {product.name}
                          </Text>

                          <View style={styles.itemUnitPriceRow}>
                            <Text style={styles.itemUnitPriceText}>
                              {formatPhpAmount(effectiveUnitPrice)}
                              {quantity > 1 ? ' each' : ''}
                            </Text>
                            {itemPromoPct > 0 && (
                              <>
                                <Text
                                  style={[
                                    styles.itemUnitPriceText,
                                    { textDecorationLine: 'line-through', opacity: 0.6 },
                                  ]}
                                >
                                  {formatPhpAmount(baseUnitPrice)}
                                </Text>
                                <Text style={styles.itemPromoDiscountTag}>
                                  −{Math.round(itemPromoPct)}%
                                </Text>
                              </>
                            )}
                          </View>
                        </View>
                      </View>

                      {/* Bottom Controls Row (Matches Web Responsive Stacked Layout) */}
                      <View style={styles.cartItemBottomRow}>
                        <Text style={styles.itemLineTotalText}>{formatPhpAmount(lineTotal)}</Text>

                        <View style={styles.itemControlsRow}>
                          <View style={styles.qtyControlGroup}>
                            <TouchableOpacity
                              style={styles.qtyStepBtn}
                              onPress={() => updateCartQuantity(product.id, -1, lineSize)}
                              activeOpacity={0.75}
                            >
                              <BootstrapIcon
                                name="dash"
                                size={14}
                                color={isDarkMode ? '#F2F2F3' : '#0F172A'}
                              />
                            </TouchableOpacity>
                            <Text style={styles.qtyValueText}>{quantity}</Text>
                            <TouchableOpacity
                              style={styles.qtyStepBtn}
                              onPress={() => updateCartQuantity(product.id, 1, lineSize)}
                              activeOpacity={0.75}
                            >
                              <BootstrapIcon
                                name="plus"
                                size={14}
                                color={isDarkMode ? '#F2F2F3' : '#0F172A'}
                              />
                            </TouchableOpacity>
                          </View>

                          <TouchableOpacity
                            style={styles.iconActionBtn}
                            onPress={() => toggleWishlist?.(product.id)}
                            activeOpacity={0.75}
                            accessibilityLabel={saved ? 'Saved in Wishlist' : 'Save to Wishlist'}
                          >
                            <BootstrapIcon
                              name={saved ? 'bookmark-fill' : 'bookmark'}
                              size={15}
                              color={saved ? '#EA580C' : '#94A3B8'}
                            />
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.iconActionBtn}
                            onPress={() => removeFromCart(product.id, lineSize)}
                            activeOpacity={0.75}
                            accessibilityLabel="Remove item"
                          >
                            <BootstrapIcon name="trash3" size={15} color="#94A3B8" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Order Summary Card (Matches Web Order Summary + Promo Vouchers) */}
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Order Summary</Text>

                {availablePromos.length > 0 && (
                  <View style={styles.promoSection}>
                    <Text style={styles.promoSectionLabel}>AVAILABLE PROMOS</Text>
                    <View style={styles.promoChipsWrap}>
                      {availablePromos.map((p) => {
                        const isSelected = appliedPromoMeta?.code === p.code;
                        return (
                          <TouchableOpacity
                            key={p.id || p.code}
                            style={[styles.promoChip, isSelected && styles.promoChipSelected]}
                            onPress={() => {
                              setPromoCode?.(p.code);
                              applyPromo?.(p.code);
                            }}
                            activeOpacity={0.8}
                          >
                            <BootstrapIcon
                              name="tag-fill"
                              size={11}
                              color={isSelected ? '#FFFFFF' : '#EA580C'}
                            />
                            <Text
                              style={[
                                styles.promoChipText,
                                isSelected && { color: '#FFFFFF', fontWeight: '700' },
                              ]}
                            >
                              {p.code}
                              {p.promoType === 'FREE_SHIPPING'
                                ? ' · Free Ship'
                                : p.discountPercent
                                  ? ` · −${p.discountPercent}%`
                                  : ''}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                <View style={styles.promoInputBlock}>
                  <View style={styles.promoInputRow}>
                    <TextInput
                      style={styles.promoTextInput}
                      placeholder="Enter promo code"
                      placeholderTextColor={isDarkMode ? '#71717A' : '#94A3B8'}
                      value={promoCode}
                      onChangeText={setPromoCode}
                      autoCapitalize="characters"
                    />
                    <TouchableOpacity
                      style={styles.promoApplyBtn}
                      onPress={() => applyPromo?.(promoCode)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.promoApplyBtnText}>Apply</Text>
                    </TouchableOpacity>
                  </View>
                  {promoFeedback ? (
                    <Text
                      style={[
                        styles.promoFeedbackText,
                        { color: appliedPromoMeta ? '#16A34A' : '#DC2626' },
                      ]}
                    >
                      {promoFeedback}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.summaryDivider} />

                <View style={styles.summaryLineRow}>
                  <Text style={styles.summaryLineLabel}>
                    Subtotal ({selectedCartItemCount}{' '}
                    {selectedCartItemCount === 1 ? 'item' : 'items'})
                  </Text>
                  <Text style={styles.summaryLineValue}>
                    {formatPhpAmount(selectedCartSubtotal)}
                  </Text>
                </View>

                {selectedDiscountAmount > 0 && (
                  <View style={styles.summaryLineRow}>
                    <Text style={[styles.summaryLineLabel, { color: '#16A34A' }]}>
                      Promo Discount{discountPercent > 0 ? ` (−${discountPercent}%)` : ''}
                    </Text>
                    <Text style={[styles.summaryLineValue, { color: '#16A34A' }]}>
                      −{formatPhpAmount(selectedDiscountAmount)}
                    </Text>
                  </View>
                )}

                <View style={styles.summaryLineRow}>
                  <Text style={styles.summaryLineLabel}>Shipping</Text>
                  <Text style={styles.summaryLineValue}>
                    {selectedCartItems.length === 0
                      ? '₱0.00'
                      : formatPhpAmount(isFreeShipping ? shippingRate : selectedShippingFee)}
                  </Text>
                </View>

                {isFreeShipping && selectedCartItems.length > 0 && (
                  <View style={styles.summaryLineRow}>
                    <Text style={[styles.summaryLineLabel, { color: '#16A34A' }]}>
                      Free Shipping Promo
                    </Text>
                    <Text style={[styles.summaryLineValue, { color: '#16A34A' }]}>
                      −{formatPhpAmount(shippingRate || 0)}
                    </Text>
                  </View>
                )}

                <View style={styles.summaryDivider} />

                <View style={styles.summaryTotalRow}>
                  <Text style={styles.summaryTotalLabel}>Total</Text>
                  <Text style={styles.summaryTotalValue}>
                    {formatPhpAmount(selectedCartTotal)}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.checkoutPrimaryBtn,
                    !hasSelectedItems && styles.checkoutPrimaryBtnDisabled,
                  ]}
                  onPress={handleCheckoutPress}
                  activeOpacity={0.9}
                >
                  <Text style={styles.checkoutPrimaryBtnText}>
                    {hasSelectedItems
                      ? `Proceed to Checkout (${selectedCartItemCount})`
                      : 'Select Items to Checkout'}
                  </Text>
                  <BootstrapIcon name="arrow-right" size={15} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Product Specs Modal for inspecting & quick-adding suggested/cart items */}
        <ProductSpecsModal
          visible={isSpecsOpen}
          product={selectedProductForSpecs}
          onClose={() => setIsSpecsOpen(false)}
          onAddToCart={(prod, qty = 1, opts = {}) => addToCart(prod, qty, opts)}
          onBuyNow={
            onBuyNow
              ? (prod, qty = 1, opts = {}) => {
                  setIsSpecsOpen(false);
                  onClose?.();
                  onBuyNow(prod, qty, opts);
                }
              : undefined
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

function createStyles(isDark = false) {
  const BG = isDark ? '#11151A' : '#F3F4F6';
  const SURFACE = isDark ? '#181C22' : '#FFFFFF';
  const BORDER = isDark ? '#262B33' : '#E2E8F0';
  const SUBTLE_BORDER = isDark ? '#20242B' : '#F1F5F9';
  const INK = isDark ? '#F2F2F3' : '#0F172A';
  const MUTED = isDark ? '#A1A1AA' : '#64748B';

  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: '#1E2227',
    },
    topHeader: {
      backgroundColor: '#1E2227',
      paddingTop: Platform.OS === 'android' ? ANDROID_STATUSBAR_TOP : 0,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    },
    topHeaderInner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 12,
      minHeight: 56,
      gap: 12,
    },
    headerBackBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: 'rgba(255, 255, 255, 0.10)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitleGroup: {
      flex: 1,
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: -0.2,
    },
    headerSubtitle: {
      fontSize: 11.5,
      color: 'rgba(255, 255, 255, 0.65)',
      marginTop: 1,
      fontVariant: ['tabular-nums'],
    },
    headerActionBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: 'rgba(255, 255, 255, 0.10)',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    headerBadgeCircle: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: '#EA580C',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
      borderWidth: 2,
      borderColor: '#1E2227',
    },
    headerBadgeText: {
      color: '#FFFFFF',
      fontSize: 9.5,
      fontWeight: '700',
    },
    scrollView: {
      flex: 1,
      backgroundColor: BG,
    },
    scrollContent: {
      paddingTop: 14,
      paddingBottom: 36 + (Platform.OS === 'android' ? ANDROID_BOTTOM_INSET : 0),
    },
    breadcrumbRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    backToShopBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: SURFACE,
      borderWidth: 1,
      borderColor: BORDER,
    },
    backToShopText: {
      fontSize: 12.5,
      fontWeight: '600',
      color: isDark ? '#F2F2F3' : '#334155',
    },
    breadcrumbTrail: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    breadcrumbMuted: {
      fontSize: 12,
      color: MUTED,
    },
    breadcrumbActive: {
      fontSize: 12,
      fontWeight: '600',
      color: INK,
    },
    emptyStateCard: {
      backgroundColor: SURFACE,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: BORDER,
      paddingVertical: 28,
      paddingHorizontal: 18,
      alignItems: 'center',
      marginBottom: 22,
    },
    emptyIconCircle: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: isDark ? 'rgba(234, 88, 12, 0.14)' : '#FFF7ED',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(234, 88, 12, 0.3)' : '#FED7AA',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: INK,
      marginBottom: 6,
    },
    emptySub: {
      fontSize: 13,
      lineHeight: 19,
      color: MUTED,
      textAlign: 'center',
      marginBottom: 20,
    },
    emptyActionsCol: {
      width: '100%',
      gap: 10,
      marginBottom: 22,
    },
    primaryExploreBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: '#EA580C',
      paddingVertical: 12,
      borderRadius: 10,
    },
    primaryExploreBtnText: {
      fontSize: 13.5,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    secondaryExploreBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: isDark ? '#222831' : '#F8FAFC',
      borderWidth: 1,
      borderColor: isDark ? '#2E3642' : '#CBD5E1',
      paddingVertical: 11,
      borderRadius: 10,
    },
    secondaryExploreBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? '#F2F2F3' : '#1E293B',
    },
    emptyTrustRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: SUBTLE_BORDER,
      width: '100%',
    },
    emptyTrustItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    emptyTrustText: {
      fontSize: 11.5,
      fontWeight: '500',
      color: MUTED,
    },
    suggestedSection: {
      marginTop: 2,
    },
    suggestedHeaderRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 14,
      gap: 10,
    },
    sectionHeaderText: {
      fontSize: 16,
      fontWeight: '700',
      color: INK,
    },
    sectionSubText: {
      fontSize: 12,
      color: MUTED,
      marginTop: 2,
    },
    suggestedGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    productCard: {
      backgroundColor: SURFACE,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: BORDER,
      overflow: 'hidden',
    },
    productImgWrap: {
      width: '100%',
      aspectRatio: 1,
      backgroundColor: isDark ? '#14171A' : '#F8FAFC',
      position: 'relative',
      overflow: 'hidden',
    },
    productImg: {
      width: '100%',
      height: '100%',
    },
    productImgPlaceholder: {
      flex: 1,
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#14171A' : '#F8FAFC',
    },
    discountBadge: {
      position: 'absolute',
      left: 8,
      top: 8,
      backgroundColor: '#EA580C',
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 6,
    },
    soldOutBadge: {
      position: 'absolute',
      left: 8,
      top: 8,
      backgroundColor: '#DC2626',
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 6,
    },
    badgeTagText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '700',
    },
    wishlistBookmarkBtn: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: isDark ? 'rgba(30, 34, 38, 0.9)' : 'rgba(255, 255, 255, 0.94)',
      borderWidth: 1,
      borderColor: BORDER,
      alignItems: 'center',
      justifyContent: 'center',
    },
    productDetails: {
      padding: 10,
      gap: 4,
    },
    productBrandText: {
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 0.4,
      color: MUTED,
    },
    productNameText: {
      fontSize: 12.5,
      fontWeight: '600',
      lineHeight: 17,
      color: INK,
      minHeight: 34,
    },
    productPriceRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 6,
    },
    productPriceMain: {
      fontSize: 14,
      fontWeight: '700',
      color: '#EA580C',
      fontVariant: ['tabular-nums'],
    },
    productPriceOld: {
      fontSize: 11,
      color: MUTED,
      textDecorationLine: 'line-through',
      fontVariant: ['tabular-nums'],
    },
    productMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 2,
    },
    productRatingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    productRatingVal: {
      fontSize: 10.5,
      fontWeight: '600',
      color: isDark ? '#CBD5E1' : '#334155',
    },
    productReviewCount: {
      fontSize: 10,
      color: MUTED,
    },
    metaDot: {
      fontSize: 10,
      color: MUTED,
    },
    productStockText: {
      fontSize: 10,
      fontWeight: '600',
      color: isDark ? '#34D399' : '#059669',
      flexShrink: 1,
    },
    selectAllBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: SURFACE,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: BORDER,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    selectAllTouch: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    checkboxBox: {
      width: 20,
      height: 20,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: isDark ? '#475569' : '#CBD5E1',
      backgroundColor: isDark ? '#11151A' : '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxBoxChecked: {
      borderColor: '#EA580C',
      backgroundColor: '#EA580C',
    },
    selectAllLabel: {
      fontSize: 13.5,
      fontWeight: '600',
      color: INK,
    },
    selectedCountText: {
      fontSize: 12,
      fontWeight: '500',
      color: MUTED,
      fontVariant: ['tabular-nums'],
    },
    toolbarDivider: {
      width: 1,
      height: 14,
      backgroundColor: BORDER,
    },
    clearCartBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 2,
    },
    clearCartBtnText: {
      fontSize: 12.5,
      fontWeight: '500',
      color: MUTED,
    },
    itemsListStack: {
      gap: 12,
    },
    cartItemCard: {
      backgroundColor: SURFACE,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: BORDER,
      padding: 14,
    },
    cartItemTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    itemCheckboxWrap: {
      paddingTop: 4,
      paddingRight: 2,
    },
    itemThumbContainer: {
      width: 76,
      height: 76,
      borderRadius: 10,
      backgroundColor: isDark ? '#11151A' : '#F8FAFC',
      borderWidth: 1,
      borderColor: SUBTLE_BORDER,
      overflow: 'hidden',
    },
    itemThumb: {
      width: '100%',
      height: '100%',
    },
    itemDetailsCol: {
      flex: 1,
    },
    itemBrandText: {
      fontSize: 10.5,
      fontWeight: '600',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: MUTED,
      marginBottom: 3,
    },
    itemTitleText: {
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 19,
      color: INK,
      marginBottom: 4,
    },
    itemUnitPriceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    itemUnitPriceText: {
      fontSize: 12.5,
      color: MUTED,
      fontVariant: ['tabular-nums'],
    },
    itemPromoDiscountTag: {
      fontSize: 11.5,
      fontWeight: '600',
      color: '#16A34A',
      fontVariant: ['tabular-nums'],
    },
    cartItemBottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: SUBTLE_BORDER,
    },
    itemLineTotalText: {
      fontSize: 15,
      fontWeight: '700',
      color: INK,
      fontVariant: ['tabular-nums'],
    },
    itemControlsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    qtyControlGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#11151A' : '#F8FAFC',
      borderWidth: 1,
      borderColor: isDark ? '#303236' : '#E2E8F0',
      borderRadius: 8,
      height: 34,
      overflow: 'hidden',
    },
    qtyStepBtn: {
      width: 32,
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    qtyValueText: {
      minWidth: 28,
      textAlign: 'center',
      fontSize: 13,
      fontWeight: '600',
      color: INK,
      fontVariant: ['tabular-nums'],
    },
    iconActionBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    summaryCard: {
      backgroundColor: SURFACE,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: BORDER,
      padding: 18,
    },
    summaryTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: INK,
      marginBottom: 12,
    },
    promoSection: {
      marginBottom: 12,
    },
    promoSectionLabel: {
      fontSize: 10.5,
      fontWeight: '600',
      letterSpacing: 0.4,
      color: MUTED,
      marginBottom: 8,
    },
    promoChipsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    promoChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: isDark ? '#11151A' : '#F8FAFC',
      borderWidth: 1,
      borderColor: isDark ? '#303236' : '#CBD5E1',
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    promoChipSelected: {
      backgroundColor: '#EA580C',
      borderColor: '#EA580C',
    },
    promoChipText: {
      fontSize: 11.5,
      fontWeight: '500',
      color: INK,
    },
    promoInputBlock: {
      marginBottom: 2,
    },
    promoInputRow: {
      flexDirection: 'row',
      gap: 8,
    },
    promoTextInput: {
      flex: 1,
      height: 40,
      backgroundColor: isDark ? '#11151A' : '#F8FAFC',
      borderWidth: 1,
      borderColor: isDark ? '#303236' : '#CBD5E1',
      borderRadius: 8,
      paddingHorizontal: 12,
      fontSize: 13,
      color: INK,
    },
    promoApplyBtn: {
      backgroundColor: isDark ? '#262B33' : '#1E2227',
      paddingHorizontal: 16,
      height: 40,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    promoApplyBtnText: {
      fontSize: 12.5,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    promoFeedbackText: {
      fontSize: 12,
      fontWeight: '600',
      marginTop: 8,
    },
    summaryDivider: {
      height: 1,
      backgroundColor: SUBTLE_BORDER,
      marginVertical: 14,
    },
    summaryLineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    summaryLineLabel: {
      fontSize: 13,
      color: MUTED,
    },
    summaryLineValue: {
      fontSize: 13.5,
      fontWeight: '600',
      color: INK,
      fontVariant: ['tabular-nums'],
    },
    summaryTotalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    summaryTotalLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: INK,
    },
    summaryTotalValue: {
      fontSize: 20,
      fontWeight: '700',
      color: '#EA580C',
      fontVariant: ['tabular-nums'],
      letterSpacing: -0.3,
    },
    checkoutPrimaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: '#EA580C',
      height: 46,
      borderRadius: 10,
    },
    checkoutPrimaryBtnDisabled: {
      backgroundColor: '#94A3B8',
      opacity: 0.65,
    },
    checkoutPrimaryBtnText: {
      fontSize: 13.5,
      fontWeight: '600',
      color: '#FFFFFF',
    },
  });
}
