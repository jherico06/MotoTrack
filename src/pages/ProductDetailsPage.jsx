import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import BootstrapIcon from '../components/common/BootstrapIcon';
import { productDetailsStyles as styles } from '../styles/productDetailsPage.styles';
import { productService } from '../services/productService';
import { orderService } from '../services/orderService';
import { systemSettingsService } from '../services/systemSettingsService';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import {
  getProductSizeEntries,
  getSizePrice,
  getSizeStock,
  isSizeSoldOut,
  isProductSoldOut,
  productNeedsSizes,
  withSelectedSize,
} from '../utils/productSizes';
import {
  getColorImage,
  getProductColorEntries,
  isColorSoldOut,
  productHasColors,
  withSelectedColor,
} from '../utils/productColors';
import CartModal from '../components/modals/CartModal';
import CheckoutModal from '../components/modals/CheckoutModal';
import GCashPaymentModal from '../components/modals/GCashPaymentModal';
import ProductVariantPickerModal from '../components/modals/ProductVariantPickerModal';
import ToastNotification from '../components/common/ToastNotification';
import { getProductDetailImageUrl } from '../utils/imageUrl';
import { promoService } from '../services/promoService';
import { sanitizeCompareAtPrice, productHasCustomerRatings } from '../utils/productCatalog';

function StarRow({ rating = 0, size = 13 }) {
  const score = Math.max(0, Math.min(5, Number(rating) || 0));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const isFilled = score >= n - 0.5;
        return (
          <BootstrapIcon
            key={n}
            name={isFilled ? 'star-fill' : 'star'}
            size={size}
            color={isFilled ? '#F59E0B' : '#CBD5E1'}
          />
        );
      })}
    </View>
  );
}

function formatReviewDate(iso) {
  if (!iso) return 'Recent';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Recent';
  }
}

export default function ProductDetailsPage({
  product,
  onNavigateBack,
  onNavigateToStore,
  onNavigateToCart: _onNavigateToCart,
  onNavigateToWishlist: _onNavigateToWishlist,
  onNavigateToOrders,
  onNavigateToLogin,
}) {
  const { currentUser, setRedirectReason } = useAuth();
  const { addToCart, cartItemCount, toastMessage, showToast } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();

  // Variant Data
  const sizeEntries = useMemo(() => getProductSizeEntries(product), [product]);
  const colorEntries = useMemo(() => getProductColorEntries(product), [product]);
  const needsSize = productNeedsSizes(product);
  const needsColor = productHasColors(product);
  const productSoldOut = isProductSoldOut(product);

  const defaultSize = useMemo(() => {
    if (!product || !sizeEntries.length) return '';
    const available = sizeEntries.find((e) => !isSizeSoldOut(product, e.label));
    return available?.label || sizeEntries[0].label;
  }, [product, sizeEntries]);

  const defaultColor = useMemo(() => {
    if (!product || !colorEntries.length) return '';
    const available = colorEntries.find((e) => !isColorSoldOut(product, e.label));
    return available?.label || colorEntries[0].label;
  }, [product, colorEntries]);

  const [selectedColor, setSelectedColor] = useState(defaultColor);
  const [selectedSize, setSelectedSize] = useState(defaultSize);
  const [quantity, setQuantity] = useState(1);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [tickerSeconds, setTickerSeconds] = useState(1299);

  // Modals for Cart & Direct Checkout
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isGcashModalOpen, setIsGcashModalOpen] = useState(false);
  const [pendingGcashOrderData, setPendingGcashOrderData] = useState(null);
  const [buyNowItems, setBuyNowItems] = useState(null);

  // Variant Picker Modal (TikTok Shop style options sheet)
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [variantModalMode, setVariantModalMode] = useState('buy'); // 'buy' | 'cart'
  const [activePromo, setActivePromo] = useState(null);

  useEffect(() => {
    let active = true;
    promoService.getPromos().then((list) => {
      if (!active) return;
      const found = Array.isArray(list) ? list.find((p) => p.isActive) : null;
      setActivePromo(found || null);
    }).catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const [prevProductKey, setPrevProductKey] = useState(product?.id || product?.product_id);

  if ((product?.id || product?.product_id) !== prevProductKey) {
    setPrevProductKey(product?.id || product?.product_id);
    setSelectedSize(defaultSize);
    setSelectedColor(defaultColor);
    setQuantity(1);
  }

  // Load reviews from Supabase
  useEffect(() => {
    let active = true;
    const fetchReviews = async () => {
      if (!product?.id && !product?.product_id) return;
      setReviewsLoading(true);
      try {
        const list = await productService.getProductReviews(product.id || product.product_id);
        if (active) setReviews(Array.isArray(list) ? list : []);
      } catch {
        if (active) setReviews([]);
      } finally {
        if (active) setReviewsLoading(false);
      }
    };
    fetchReviews();
    return () => {
      active = false;
    };
  }, [product?.id, product?.product_id]);

  // Countdown timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTickerSeconds((prev) => (prev > 0 ? prev - 1 : 1800));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (totalSec) => {
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Delivery dates estimate: 3 to 5 days ahead
  const deliveryDates = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() + 3);
    const end = new Date();
    end.setDate(end.getDate() + 5);
    const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
    const startDay = start.getDate();
    const endDay = end.getDate();
    return `${startMonth} ${startDay}–${endDay}`;
  }, []);

  const isFav = product ? isWishlisted(product.id) : false;
  const sizeSoldOut = selectedSize ? isSizeSoldOut(product, selectedSize) : false;
  const colorSoldOut = selectedColor ? isColorSoldOut(product, selectedColor) : false;

  // Dynamic Price & Image preview based on selection
  const currentPrice = selectedSize ? getSizePrice(product, selectedSize) : Number(product?.price) || 0;

  // Genuine discount: only when admin set a real compare-at price (never the leftover ₱42,500 default)
  const rawOldPrice = sanitizeCompareAtPrice(product?.oldPrice, currentPrice);
  const hasValidOldPrice = Boolean(rawOldPrice);
  const originalPrice = hasValidOldPrice ? rawOldPrice : null;
  const discountPercent = hasValidOldPrice
    ? Math.min(99, Math.max(1, Math.round(((originalPrice - currentPrice) / originalPrice) * 100)))
    : null;

  // Rating & Review stats — only actual customer reviews, never the DB 5.0 default
  const reviewListCount = Array.isArray(reviews) ? reviews.length : 0;
  const hasRatings = productHasCustomerRatings(product, reviewListCount);
  const calculatedFromList =
    reviewListCount > 0
      ? reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0) / reviewListCount
      : 0;
  const finalRating = hasRatings ? calculatedFromList : 0;
  const totalReviewsCount = reviewListCount;
  const realSoldCount = Number(product?.sold || product?.sold_count || product?.sales_count || 0);

  const activeImage = getProductDetailImageUrl(
    (selectedColor && getColorImage(product, selectedColor)) || product?.image
  );

  // Available stock calculation
  const availableStock = selectedSize
    ? getSizeStock(product, selectedSize) ?? product?.stock ?? 20
    : Number(product?.stock) || 20;

  // ─── ADMIN FREE SHIPPING & TREND LOGIC ────────────────────────────────────
  // Only show free shipping if admin activated it or product explicitly has free shipping
  // ─── ADMIN FREE SHIPPING LOGIC ──────────────────────────────────────────
  // Only show free shipping if admin EXPLICITLY activated it in settings or promo
  const isFreeShippingActive = useMemo(() => {
    if (!product) return false;
    const settings = systemSettingsService.getSettings();
    const isEnabled = Boolean(settings?.freeShippingEnabled);
    const threshold = Number(settings?.freeShippingThreshold);
    const price = Number(currentPrice || product.price || 0);

    // Only active if explicitly toggled on by admin
    const adminFreeShippingOn = Boolean(
      isEnabled && (!threshold || threshold <= 0 || price >= threshold)
    );

    // Product-level free shipping explicitly declared on this item
    const productFreeShippingOn = Boolean(
      product.freeShipping === true ||
      product.free_shipping === true ||
      product.hasFreeShipping === true
    );

    return adminFreeShippingOn || productFreeShippingOn;
  }, [product, currentPrice]);

  // Only show on trend badge if product is on trend
  const isOnTrend = useMemo(() => {
    if (!product) return false;
    return Boolean(
      product.isTrend ||
      product.is_trend ||
      product.onTrend ||
      product.trend ||
      String(product.badge || '').toLowerCase().includes('trend') ||
      String(product.type || '').toLowerCase() === 'trending' ||
      String(product.type || '').toLowerCase() === 'trend'
    );
  }, [product]);

  if (!product) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ color: '#0F172A', fontSize: 16, fontWeight: '700', marginBottom: 16 }}>
            Product not found or unavailable
          </Text>
          <TouchableOpacity
            style={[styles.buyNowBtn, { paddingHorizontal: 24 }]}
            onPress={onNavigateBack || onNavigateToStore}
          >
            <Text style={styles.buyNowBtnTitle}>Return to Store</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Open variant picker modal for Add to Cart
  const handleAddToCartPress = () => {
    if (!currentUser) {
      setRedirectReason('Please sign in or create an account to add items to your cart.');
      onNavigateToLogin?.();
      return;
    }
    if (productSoldOut) {
      showToast('This item is currently sold out');
      return;
    }
    setVariantModalMode('cart');
    setIsVariantModalOpen(true);
  };

  // Open variant picker modal for Buy Now
  const handleBuyNowPress = () => {
    if (!currentUser) {
      setRedirectReason('Please sign in or create an account to complete your purchase.');
      onNavigateToLogin?.();
      return;
    }
    if (productSoldOut) {
      showToast('This item is currently sold out');
      return;
    }
    setVariantModalMode('buy');
    setIsVariantModalOpen(true);
  };

  // Confirmation from inside ProductVariantPickerModal
  const handleVariantModalConfirm = (configuredProduct, { size, color, quantity: chosenQty, mode }) => {
    setIsVariantModalOpen(false);
    if (size) setSelectedSize(size);
    if (color) setSelectedColor(color);
    if (chosenQty) setQuantity(chosenQty);

    if (mode === 'cart') {
      addToCart(configuredProduct, chosenQty, {
        size: size || '',
        color: color || '',
      });
      showToast(`Added ${chosenQty}x "${product.name?.slice(0, 22)}..." to cart!`);
    } else {
      // mode === 'buy': launch CheckoutModal directly
      setBuyNowItems([
        {
          product: configuredProduct,
          quantity: chosenQty,
          size: size || '',
          color: color || '',
        },
      ]);
      setIsCartOpen(false);
      setIsCheckoutOpen(true);
    }
  };

  // Checkout order placement
  const handleCompleteOrder = async (orderFormData) => {
    const { paymentMethod } = orderFormData;
    if (paymentMethod === 'GCash') {
      setPendingGcashOrderData(orderFormData);
      setIsCheckoutOpen(false);
      setIsGcashModalOpen(true);
      return;
    }
    await executeOrder(orderFormData);
  };

  const handleGcashPaymentSuccess = async (paymentReceipt) => {
    const orderData = {
      ...pendingGcashOrderData,
      gcashReference: paymentReceipt.referenceNumber,
      paymentMethod: 'GCash',
    };
    await executeOrder(orderData, 'Processing');
  };

  const executeOrder = async (orderFormData, overrideStatus = null) => {
    if (isPlacingOrder) return;
    setIsPlacingOrder(true);
    try {
      const itemsToOrder = buyNowItems || [
        {
          product: needsSize ? withSelectedSize(product, selectedSize) : product,
          quantity,
          size: selectedSize || '',
          color: selectedColor || '',
        },
      ];
      const subtotal = itemsToOrder.reduce(
        (sum, it) => sum + Number(it.product?.price || 0) * Number(it.quantity || 1),
        0
      );
      const fee = isFreeShippingActive ? 0 : 150;
      const total = subtotal + fee;

      const res = await orderService.createOrder({
        userId: currentUser?.user_id || currentUser?.id || null,
        customerId: currentUser?.customer_id || currentUser?.user_id || currentUser?.id || null,
        customerName: orderFormData.customerName,
        customerPhone: orderFormData.customerPhone,
        customerAddress: orderFormData.customerAddress,
        deliveryNotes: orderFormData.deliveryNotes,
        paymentMethod: orderFormData.paymentMethod,
        gcashNumber: orderFormData.gcashNumber,
        gcashReference: orderFormData.gcashReference,
        codChangeFor: orderFormData.codChangeFor,
        promoId: null,
        total: subtotal.toFixed(2),
        discountAmount: '0.00',
        shippingFee: fee,
        grandTotal: total.toFixed(2),
        items: itemsToOrder,
        channel: 'Mobile App',
        overrideStatus,
      });

      if (!res?.success) {
        showToast(res?.error || 'Could not place order. Please try again.');
        return;
      }

      setIsCheckoutOpen(false);
      setBuyNowItems(null);
      showToast('Order placed successfully! Tracking started.');
      if (onNavigateToOrders) {
        onNavigateToOrders();
      }
    } catch {
      showToast('Network error while placing order. Please try again.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  // Price formatting
  const priceIntStr = Math.floor(currentPrice).toLocaleString();
  const priceDecStr = (currentPrice % 1).toFixed(2).substring(1);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" translucent={false} />

      {/* Toast Notification */}
      <ToastNotification message={toastMessage} />

      {/* ─── TOP STICKY APP BAR ─── */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.topBarIconButton}
          onPress={onNavigateBack || onNavigateToStore}
          activeOpacity={0.8}
        >
          <BootstrapIcon name="chevron-left" size={18} color="#0F172A" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.topSearchPill}
          onPress={onNavigateToStore}
          activeOpacity={0.85}
        >
          <BootstrapIcon name="search" size={13} color="#64748B" />
          <Text style={styles.topSearchText} numberOfLines={1}>
            {product.name}
          </Text>
        </TouchableOpacity>

        <View style={styles.topBarRightActions}>
          <TouchableOpacity
            style={styles.topBarIconButton}
            onPress={() => {
              if (!currentUser) {
                setRedirectReason('Please sign in to view your shopping cart.');
                onNavigateToLogin?.();
              } else {
                setIsCartOpen(true);
              }
            }}
            activeOpacity={0.8}
          >
            <BootstrapIcon name="cart-fill" size={17} color="#0F172A" />
            {cartItemCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartItemCount > 99 ? '99+' : cartItemCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── MAIN SCROLLABLE PRODUCT CONTENT ─── */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── HERO GALLERY SHOWCASE ─── */}
        <View style={styles.heroContainer}>
          <Image source={{ uri: activeImage }} style={styles.heroImage} resizeMode="contain" />

          {/* Top Tag Pill */}
          <View style={styles.topTagPill}>
            <BootstrapIcon name="patch-check-fill" size={12} color="#1D4533" />
            <Text style={styles.topTagText}>Genuine MotoTrack Part</Text>
          </View>

          {/* Gallery Indicator */}
          <View style={styles.pageIndicatorPill}>
            <Text style={styles.pageIndicatorText}>
              {colorEntries.length > 1 ? `1/${colorEntries.length}` : '1/1'}
            </Text>
          </View>

          {/* Promotional Ribbon Strip — ONLY when admin/product free shipping is active */}
          {isFreeShippingActive && (
            <View style={styles.promoRibbon}>
              <View style={styles.promoRibbonLeft}>
                <View style={styles.promoBadgeHighlight}>
                  <Text style={styles.promoBadgeHighlightText}>FREE SHIPPING</Text>
                </View>
                <Text style={styles.promoRibbonText}>Free Shipping Activated</Text>
              </View>
              <Text style={styles.promoRibbonSubtext}>100% Authentic</Text>
            </View>
          )}
        </View>

        {/* ─── PRICING & PROMOTIONS ─── */}
        <View style={styles.priceCard}>
          <View style={styles.priceRow}>
            <Text style={styles.currencySymbol}>₱</Text>
            <Text style={styles.priceMainInteger}>{priceIntStr}</Text>
            <Text style={styles.priceMainDecimal}>{priceDecStr}</Text>
            {hasValidOldPrice && originalPrice && (
              <Text style={styles.priceOriginalText}>₱{originalPrice.toFixed(2)}</Text>
            )}
            {hasValidOldPrice && discountPercent && discountPercent > 0 && (
              <View style={styles.discountPercentBadge}>
                <Text style={styles.discountPercentText}>-{discountPercent}% OFF</Text>
              </View>
            )}
          </View>

          {/* PayLater / COD installment notice */}
          <TouchableOpacity style={styles.perkRow} activeOpacity={0.8}>
            <View style={styles.perkRowLeft}>
              <BootstrapIcon name="wallet2" size={14} color="#1D4533" />
              <Text style={styles.perkText}>Cash on Delivery & GCash Accepted</Text>
            </View>
            <BootstrapIcon name="chevron-right" size={12} color="#64748B" />
          </TouchableOpacity>

          {/* Promo Tag / Bonus Voucher — ONLY when admin has an active promo code */}
          {activePromo ? (
            <View style={styles.voucherTagRow}>
              <View style={styles.voucherTagPill}>
                <BootstrapIcon name="tag-fill" size={11} color="#B45309" />
                <Text style={styles.voucherTagText}>
                  Use code {activePromo.code} for {activePromo.discountPercent}% off
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => showToast(`Promo code ${activePromo.code} applied!`)}
                activeOpacity={0.8}
              >
                <Text style={styles.perkLinkText}>Claim &gt;</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {/* ─── PRODUCT TITLE & SOCIAL / STATS ─── */}
        <View style={styles.titleSection}>
          <View style={styles.titleHeaderRow}>
            <View style={styles.titleTextContainer}>
              <View style={styles.titleBadgeRow}>
                {/* On Trend Badge — ONLY when product is on trend */}
                {isOnTrend && (
                  <View style={styles.trendBadge}>
                    <Text style={styles.trendBadgeText}>ON TREND</Text>
                  </View>
                )}
                <View style={styles.categoryPill}>
                  <Text style={styles.categoryPillText}>
                    {product.brand ? `${product.brand} • ` : ''}
                    {product.category || 'Maintenance'}
                  </Text>
                </View>
              </View>

              <Text style={styles.productTitle}>{product.name}</Text>
            </View>

            <TouchableOpacity
              style={styles.wishlistBookmarkBtn}
              onPress={() => toggleWishlist(product.id)}
              activeOpacity={0.8}
            >
              <BootstrapIcon
                name={isFav ? 'heart-fill' : 'heart'}
                size={18}
                color={isFav ? '#EF4444' : '#64748B'}
              />
            </TouchableOpacity>
          </View>

          {/* Rating, Reviews & Stock Status Row */}
          <View style={styles.metaStatsRow}>
            {hasRatings ? (
              <>
                <View style={styles.ratingStarsPill}>
                  <StarRow rating={finalRating} size={12} />
                  <Text style={styles.ratingValueText}>
                    {finalRating.toFixed(1)}
                  </Text>
                </View>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.metaText}>
                  {totalReviewsCount} {totalReviewsCount === 1 ? 'review' : 'reviews'}
                </Text>
              </>
            ) : (
              <View style={styles.unratedPill}>
                <BootstrapIcon name="star" size={11} color="#94A3B8" />
                <Text style={styles.unratedText}>No ratings yet</Text>
              </View>
            )}

            {realSoldCount > 0 ? (
              <>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.metaText}>
                  {realSoldCount >= 1000
                    ? `${(realSoldCount / 1000).toFixed(1)}k sold`
                    : `${realSoldCount} sold`}
                </Text>
              </>
            ) : product.isNew ? (
              <>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.metaText}>New Arrival</Text>
              </>
            ) : null}

            <Text style={styles.metaDot}>•</Text>
            <View
              style={[
                styles.stockPill,
                productSoldOut || sizeSoldOut ? styles.stockPillSoldOut : styles.stockPillInStock,
              ]}
            >
              <Text
                style={[
                  styles.stockPillText,
                  { color: productSoldOut || sizeSoldOut ? '#EF4444' : '#059669' },
                ]}
              >
                {productSoldOut || sizeSoldOut ? 'Sold Out' : `In Stock (${availableStock})`}
              </Text>
            </View>
          </View>
        </View>

        {/* ─── SHIPPING & DELIVERY GUARANTEE CARD ─── */}
        <View style={styles.shippingCard}>
          <View style={styles.shippingHeaderRow}>
            <View style={styles.shippingIconWrap}>
              <BootstrapIcon name="truck" size={17} color="#1D4533" />
            </View>
            <View style={styles.shippingInfoColumn}>
              <Text style={styles.guaranteedDeliveryDate}>
                Guaranteed Delivery: {deliveryDates}
              </Text>
              <Text style={styles.guaranteeLateCouponNote}>
                Get at least ₱50 coupon if your order arrives late ⓘ
              </Text>

              <View style={styles.shippingCostRow}>
                <Text style={styles.shippingFeeLabel}>Shipping fee:</Text>
                {isFreeShippingActive ? (
                  <>
                    <Text style={styles.shippingFeeOriginal}>₱150.00</Text>
                    <Text style={styles.shippingFeeCurrent}>FREE</Text>
                  </>
                ) : (
                  <Text style={[styles.shippingFeeCurrent, { color: '#0F172A' }]}>₱150.00</Text>
                )}
              </View>

              {isFreeShippingActive ? (
                <Text style={styles.shippingPromoHighlight}>
                  Free shipping voucher applied to this item
                </Text>
              ) : null}
            </View>
          </View>

          {/* Expiring discount ticker — ONLY when free shipping is active */}
          {isFreeShippingActive && (
            <View style={styles.expiringDiscountTicker}>
              <View style={styles.tickerLeft}>
                <BootstrapIcon name="lightning-fill" size={12} color="#047857" />
                <Text style={styles.tickerText}>Flash free shipping discount is active</Text>
              </View>
              <Text style={styles.tickerCountdown}>{formatCountdown(tickerSeconds)}</Text>
            </View>
          )}
        </View>

        {/* ─── COLOR VARIANTS (IF ANY) ─── */}
        {colorEntries.length > 0 && (
          <View style={styles.sectionBox}>
            <TouchableOpacity
              style={styles.sectionBoxTitleRow}
              onPress={() => {
                setVariantModalMode('buy');
                setIsVariantModalOpen(true);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.sectionBoxTitle}>Select Color</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={styles.sectionBoxSub}>
                  {selectedColor || 'Choose a color option'}
                </Text>
                <BootstrapIcon name="chevron-right" size={12} color="#1D4533" />
              </View>
            </TouchableOpacity>
            <View style={styles.variantChipsWrap}>
              {colorEntries.map((color) => {
                const isSelected = selectedColor === color.label;
                const soldOut = isColorSoldOut(product, color.label);
                return (
                  <TouchableOpacity
                    key={color.label}
                    style={[
                      styles.variantChip,
                      isSelected && styles.variantChipSelected,
                      soldOut && styles.variantChipSoldOut,
                    ]}
                    onPress={() => {
                      if (soldOut) {
                        showToast(`Color ${color.label} is currently sold out`);
                        return;
                      }
                      setSelectedColor(color.label);
                    }}
                    activeOpacity={0.8}
                  >
                    {color.hex ? (
                      <View
                        style={[
                          styles.colorSwatchCircle,
                          { backgroundColor: color.hex },
                        ]}
                      />
                    ) : null}
                    <Text
                      style={[
                        styles.variantChipText,
                        isSelected && styles.variantChipTextSelected,
                      ]}
                    >
                      {color.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ─── SIZE VARIANTS (IF ANY) ─── */}
        {sizeEntries.length > 0 && (
          <View style={styles.sectionBox}>
            <TouchableOpacity
              style={styles.sectionBoxTitleRow}
              onPress={() => {
                setVariantModalMode('buy');
                setIsVariantModalOpen(true);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.sectionBoxTitle}>Select Size</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={styles.sectionBoxSub}>
                  {selectedSize || 'Choose a size specification'}
                </Text>
                <BootstrapIcon name="chevron-right" size={12} color="#1D4533" />
              </View>
            </TouchableOpacity>
            <View style={styles.variantChipsWrap}>
              {sizeEntries.map((size) => {
                const isSelected = selectedSize === size.label;
                const soldOut = isSizeSoldOut(product, size.label);
                return (
                  <TouchableOpacity
                    key={size.label}
                    style={[
                      styles.variantChip,
                      isSelected && styles.variantChipSelected,
                      soldOut && styles.variantChipSoldOut,
                    ]}
                    onPress={() => {
                      if (soldOut) {
                        showToast(`Size ${size.label} is currently sold out`);
                        return;
                      }
                      setSelectedSize(size.label);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.variantChipText,
                        isSelected && styles.variantChipTextSelected,
                      ]}
                    >
                      {size.label}
                    </Text>
                    {size.price ? (
                      <Text style={styles.variantChipPrice}>₱{Number(size.price).toFixed(0)}</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Quantity Stepper */}
            <View style={styles.quantityRow}>
              <Text style={styles.quantityLabel}>Quantity</Text>
              <View style={styles.quantityStepper}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  activeOpacity={0.7}
                >
                  <BootstrapIcon name="dash" size={14} color={quantity <= 1 ? '#94A3B8' : '#0F172A'} />
                </TouchableOpacity>

                <Text style={styles.stepperValueText}>{quantity}</Text>

                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => setQuantity((q) => Math.min(availableStock, q + 1))}
                  disabled={quantity >= availableStock}
                  activeOpacity={0.7}
                >
                  <BootstrapIcon
                    name="plus"
                    size={14}
                    color={quantity >= availableStock ? '#94A3B8' : '#0F172A'}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ─── SPECIFICATIONS & COMPATIBILITY ─── */}
        <View style={styles.sectionBox}>
          <View style={styles.sectionBoxTitleRow}>
            <Text style={styles.sectionBoxTitle}>Specifications</Text>
            <BootstrapIcon name="shield-check" size={15} color="#1D4533" />
          </View>

          <View style={styles.specRow}>
            <Text style={styles.specLabel}>Brand</Text>
            <Text style={styles.specValue}>{product.brand || 'MotoTrack Genuine'}</Text>
          </View>

          <View style={styles.specRow}>
            <Text style={styles.specLabel}>Category</Text>
            <Text style={styles.specValue}>{product.category || 'Performance Parts'}</Text>
          </View>

          <View style={styles.specRow}>
            <Text style={styles.specLabel}>Fitment / Compatibility</Text>
            <Text style={styles.specValue}>
              {product.compatibility || 'Universal / Standard Motorcycle Specs'}
            </Text>
          </View>

          <View style={styles.specRow}>
            <Text style={styles.specLabel}>Condition</Text>
            <Text style={styles.specValue}>Brand New, 100% Genuine</Text>
          </View>

          <View style={styles.specRow}>
            <Text style={styles.specLabel}>Warranty</Text>
            <Text style={styles.specValue}>7 Days Return • MotoTrack Quality Guarantee</Text>
          </View>

          {/* Key Features */}
          {Array.isArray(product.features) && product.features.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <Text style={[styles.sectionBoxTitle, { fontSize: 12, marginBottom: 6 }]}>
                Key Features
              </Text>
              {product.features.map((feat, idx) => (
                <View key={idx} style={styles.featureItem}>
                  <BootstrapIcon name="check2" size={14} color="#1D4533" />
                  <Text style={styles.featureText}>{feat}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Description */}
          <View style={{ marginTop: 12 }}>
            <Text style={[styles.sectionBoxTitle, { fontSize: 12, marginBottom: 4 }]}>
              Description
            </Text>
            <Text
              style={styles.descriptionText}
              numberOfLines={isDescriptionExpanded ? undefined : 3}
            >
              {product.description ||
                'Precision engineered high-performance motorcycle upgrade component. Certified for road safety, optimal durability, and high endurance performance.'}
            </Text>
            <TouchableOpacity
              onPress={() => setIsDescriptionExpanded((prev) => !prev)}
              style={{ marginTop: 6 }}
            >
              <Text style={styles.perkLinkText}>
                {isDescriptionExpanded ? 'Show Less' : 'Read More...'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── CUSTOMER REVIEWS SECTION ─── */}
        <View style={styles.sectionBox}>
          <View style={styles.sectionBoxTitleRow}>
            <Text style={styles.sectionBoxTitle}>Customer Reviews ({reviewListCount})</Text>
            {hasRatings ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <BootstrapIcon name="star-fill" size={12} color="#F59E0B" />
                <Text style={{ color: '#D97706', fontSize: 12, fontWeight: '800' }}>
                  {finalRating.toFixed(1)} / 5.0
                </Text>
              </View>
            ) : (
              <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '700' }}>
                Not yet rated
              </Text>
            )}
          </View>

          {reviewsLoading ? (
            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
              <ActivityIndicator color="#1D4533" />
            </View>
          ) : reviews.length === 0 ? (
            <View style={{ paddingVertical: 12, alignItems: 'center' }}>
              <Text style={{ color: '#64748B', fontSize: 12.5, textAlign: 'center' }}>
                No verified reviews yet. Be the first rider to review this part after delivery!
              </Text>
            </View>
          ) : (
            reviews.slice(0, 5).map((rev, rIdx) => (
              <View key={rev.id || rev.review_id || rIdx} style={styles.reviewItem}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewAuthor}>
                    {rev.customerName || rev.customer_name || 'Verified Rider'}
                  </Text>
                  <Text style={styles.reviewDate}>
                    {formatReviewDate(rev.createdAt || rev.created_at)}
                  </Text>
                </View>
                <StarRow rating={rev.rating || 5} size={11} />
                <Text style={styles.reviewComment}>
                  {rev.comment || 'Verified purchase — Excellent quality, fits perfectly.'}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* ─── STICKY BOTTOM ACTION BAR ─── */}
      <View style={styles.bottomBarContainer}>
        {/* Shop Icon Action */}
        <TouchableOpacity
          style={styles.iconActionBtn}
          onPress={onNavigateToStore}
          activeOpacity={0.7}
        >
          <BootstrapIcon name="shop" size={20} color="#64748B" />
          <Text style={styles.iconActionLabel}>Shop</Text>
        </TouchableOpacity>

        {/* Add to Cart Icon Button */}
        <TouchableOpacity
          style={[
            styles.addToCartIconBtn,
            (productSoldOut || sizeSoldOut) && styles.soldOutBtn,
          ]}
          disabled={productSoldOut || sizeSoldOut}
          onPress={handleAddToCartPress}
          activeOpacity={0.8}
        >
          <BootstrapIcon
            name="cart-plus"
            size={22}
            color={productSoldOut || sizeSoldOut ? '#94A3B8' : '#1D4533'}
          />
        </TouchableOpacity>

        {/* Big Buy Now Button */}
        <TouchableOpacity
          style={[
            styles.buyNowBtn,
            (productSoldOut || sizeSoldOut) && styles.soldOutBtn,
          ]}
          disabled={productSoldOut || sizeSoldOut}
          onPress={handleBuyNowPress}
          activeOpacity={0.88}
        >
          <Text
            style={[
              styles.buyNowBtnTitle,
              (productSoldOut || sizeSoldOut) && styles.soldOutBtnText,
            ]}
          >
            {productSoldOut || sizeSoldOut ? 'Sold Out' : 'Buy Now'}
          </Text>
          {!productSoldOut && !sizeSoldOut && (
            <Text style={styles.buyNowBtnSub}>
              {hasValidOldPrice ? 'Sale ' : ''}₱{currentPrice.toFixed(2)}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ─── MODALS ─── */}
      <CartModal
        visible={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onProceedToCheckout={() => {
          setIsCartOpen(false);
          setBuyNowItems(null);
          setIsCheckoutOpen(true);
        }}
      />

      <CheckoutModal
        visible={isCheckoutOpen}
        onClose={() => {
          if (!isPlacingOrder) {
            setIsCheckoutOpen(false);
            setBuyNowItems(null);
          }
        }}
        onCompleteOrder={handleCompleteOrder}
        isPlacingOrder={isPlacingOrder}
        overrideItems={
          buyNowItems || [
            {
              product: needsSize ? withSelectedSize(product, selectedSize) : product,
              quantity,
              size: selectedSize || '',
              color: selectedColor || '',
            },
          ]
        }
        overrideItemCount={quantity}
        overrideTotal={currentPrice * quantity + (isFreeShippingActive ? 0 : 150)}
      />

      <GCashPaymentModal
        visible={isGcashModalOpen}
        onClose={() => setIsGcashModalOpen(false)}
        onPaymentSuccess={handleGcashPaymentSuccess}
        amount={Number(currentPrice * quantity + (isFreeShippingActive ? 0 : 150)).toFixed(2)}
      />

      {/* ─── VARIANT PICKER MODAL (TIKTOK SHOP STYLE) ─── */}
      <ProductVariantPickerModal
        visible={isVariantModalOpen}
        product={product}
        mode={variantModalMode}
        selectedColor={selectedColor}
        selectedSize={selectedSize}
        quantity={quantity}
        onClose={() => setIsVariantModalOpen(false)}
        onConfirm={handleVariantModalConfirm}
        isFreeShippingActive={isFreeShippingActive}
        activePromo={activePromo}
      />
    </SafeAreaView>
  );
}
