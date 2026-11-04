import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import BootstrapIcon from '../../../components/common/BootstrapIcon.jsx';
import BrandLogo from '../../../components/common/BrandLogo.jsx';
import ToastNotification from '../../../components/common/ToastNotification.jsx';
import CustomerMobileNavDrawer from '../../../components/common/CustomerMobileNavDrawer.jsx';
import UserProfileDropdown from '../../../components/common/UserProfileDropdown.jsx';
import UserProfileButton from '../../../components/common/UserProfileButton.jsx';
import NotificationDropdown from '../../../components/common/NotificationDropdown.jsx';
import CompatibilityIndicator from '../../../components/shop/CompatibilityIndicator.jsx';
import CartModal from '../../../components/modals/CartModal.jsx';
import CheckoutModal from '../../../components/modals/CheckoutModal.jsx';
import GCashPaymentModal from '../../../components/modals/GCashPaymentModal.jsx';
import ProductVariantPickerModal from '../../../components/modals/ProductVariantPickerModal.jsx';

import { productService } from '../../../services/products/productService.js';
import { orderService } from '../../../services/orders/orderService.js';
import { systemSettingsService } from '../../../services/system/systemSettingsService.js';
import { motorcycleService } from '../../../services/products/motorcycleService.js';
import { compatibilityService, COMPAT_STATUS } from '../../../services/products/compatibilityService.js';
import { promoService } from '../../../services/products/promoService.js';

import { useAuth } from '../../../context/AuthContext.jsx';
import { useCart } from '../../../context/CartContext.jsx';
import { useWishlist } from '../../../context/WishlistContext.jsx';
import { useTheme } from '../../../context/ThemeContext.jsx';

import {
  getProductSizeEntries,
  getSizePrice,
  getSizeStock,
  isSizeSoldOut,
  isProductSoldOut,
  productNeedsSizes,
  withSelectedSize,
} from '../../../utils/productSizes.js';
import {
  getColorImage,
  getProductColorEntries,
  isColorSoldOut,
  productHasColors,
  withSelectedColor,
} from '../../../utils/productColors.js';
import { getProductDetailImageUrl } from '../../../utils/imageUrl.js';
import { sanitizeCompareAtPrice, productHasCustomerRatings } from '../../../utils/productCatalog.js';

function StarRow({ rating = 0, size = 14 }) {
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

export default function ProductDetailsPageWeb({
  product: initialProduct,
  onNavigateBack,
  onNavigateToStore,
  onNavigateToWishlist,
  onNavigateToOrders,
  onNavigateToLogin,
  onRequireLogin,
  onNavigateToScreen,
}) {
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 1024;
  const isTablet = windowWidth >= 768 && windowWidth < 1024;
  const isMobile = windowWidth < 768;
  const isSmallMobile = windowWidth < 400;

  const { currentUser, logout, setRedirectReason } = useAuth();
  const { addToCart, cartItemCount, cartTotal, toastMessage, showToast } = useCart();
  const { isWishlisted, toggleWishlist, wishlistCount } = useWishlist();
  const { isDarkMode, toggleDarkMode, tokens } = useTheme();

  // Navigation state
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isGcashModalOpen, setIsGcashModalOpen] = useState(false);
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [variantModalMode, setVariantModalMode] = useState('cart');

  // Order & Buy Now State
  const [buyNowItems, setBuyNowItems] = useState(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [pendingGcashOrderData, setPendingGcashOrderData] = useState(null);

  // Full product object
  const [product, setProduct] = useState(initialProduct || null);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);

  // Registered Bikes & Active Bike for Compatibility
  const userBikes = useMemo(() => {
    return motorcycleService.getMotorcycles(currentUser) || [];
  }, [currentUser]);

  const [activeBike, setActiveBike] = useState(() => {
    return userBikes.find((b) => b.is_primary) || userBikes[0] || null;
  });

  // Variant selections
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');

  // Fetch updated product data and reviews
  useEffect(() => {
    let cancelled = false;
    if (initialProduct?.id || initialProduct?.product_id) {
      const pid = initialProduct.id || initialProduct.product_id;
      setReviewsLoading(true);
      Promise.all([
        productService.getProductById(pid),
        productService.getProductReviews(pid),
      ])
        .then(([prodRes, revRes]) => {
          if (!cancelled) {
            if (prodRes) setProduct((prev) => ({ ...prev, ...prodRes }));
            if (Array.isArray(revRes)) setReviews(revRes);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setReviewsLoading(false);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [initialProduct]);

  // Sizes & Colors
  const sizeEntries = useMemo(() => getProductSizeEntries(product), [product]);
  const needsSize = useMemo(() => productNeedsSizes(product), [product]);
  const colorEntries = useMemo(() => getProductColorEntries(product), [product]);
  const hasColors = useMemo(() => productHasColors(product), [product]);

  useEffect(() => {
    if (sizeEntries.length > 0 && !selectedSize) {
      const firstAvailable = sizeEntries.find((s) => !isSizeSoldOut(product, s.name));
      setSelectedSize(firstAvailable?.name || sizeEntries[0]?.name || '');
    }
  }, [sizeEntries, product, selectedSize]);

  useEffect(() => {
    if (colorEntries.length > 0 && !selectedColor) {
      const firstAvailable = colorEntries.find((c) => !isColorSoldOut(product, c.name));
      setSelectedColor(firstAvailable?.name || colorEntries[0]?.name || '');
    }
  }, [colorEntries, product, selectedColor]);

  // Compatibility resolution
  const compatStatus = useMemo(() => {
    if (!product || !activeBike) return COMPAT_STATUS.UNIVERSAL;
    return compatibilityService.checkCompatibility(product, activeBike);
  }, [product, activeBike]);

  // Price & Inventory calculations
  const productSoldOut = isProductSoldOut(product);
  const currentPrice = selectedSize ? getSizePrice(product, selectedSize) : Number(product?.price) || 0;
  const rawOldPrice = sanitizeCompareAtPrice(product?.oldPrice || product?.compare_at_price, currentPrice);
  const originalPrice = rawOldPrice || null;
  const discountPercent = originalPrice
    ? Math.min(99, Math.max(1, Math.round(((originalPrice - currentPrice) / originalPrice) * 100)))
    : null;

  const availableStock = selectedSize
    ? getSizeStock(product, selectedSize) ?? product?.stock ?? 20
    : Number(product?.stock) || 20;

  const activeImage = getProductDetailImageUrl(
    (selectedColor && getColorImage(product, selectedColor)) || product?.image
  );

  const reviewListCount = Array.isArray(reviews) ? reviews.length : 0;
  const hasRatings = productHasCustomerRatings(product, reviewListCount);
  const avgReviewScore =
    reviewListCount > 0
      ? reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0) / reviewListCount
      : 0;

  const isFav = product?.id ? isWishlisted(product.id) : false;

  // Promos
  const [promoFreeShipping, setPromoFreeShipping] = useState(false);
  const [freeShippingPromoId, setFreeShippingPromoId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (product) {
      const pid = product.id || product.product_id;
      promoService
        .findApplicableFreeShipping(
          [{ product: { id: pid, price: currentPrice }, quantity: 1 }],
          150
        )
        .then((match) => {
          if (!cancelled && match) {
            setPromoFreeShipping(true);
            setFreeShippingPromoId(match.promoId || null);
          }
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [product, currentPrice]);

  const isFreeShippingActive = useMemo(() => {
    if (!product) return false;
    const settings = systemSettingsService.getSettings();
    const isEnabled = Boolean(settings?.freeShippingEnabled);
    const threshold = Number(settings?.freeShippingThreshold);
    const adminFreeShippingOn = Boolean(
      isEnabled && (!threshold || threshold <= 0 || currentPrice >= threshold)
    );
    const productFreeShippingOn = Boolean(product.freeShipping || product.free_shipping);
    return adminFreeShippingOn || productFreeShippingOn || promoFreeShipping;
  }, [product, currentPrice, promoFreeShipping]);

  // Actions
  const handleAddToCart = () => {
    if (productSoldOut) {
      showToast('This item is currently sold out');
      return;
    }
    let configuredProduct = product;
    if (needsSize && selectedSize) {
      configuredProduct = withSelectedSize(configuredProduct, selectedSize);
    }
    if (hasColors && selectedColor) {
      configuredProduct = withSelectedColor(configuredProduct, selectedColor);
    }
    const warn =
      compatStatus === COMPAT_STATUS.INCOMPATIBLE && activeBike
        ? `⚠ This part is not marked as compatible with your ${compatibilityService.bikeLabel(activeBike)}.`
        : null;

    addToCart(configuredProduct, quantity, {
      size: selectedSize || '',
      color: selectedColor || '',
      compatWarning: warn,
    });
    showToast(`Added ${quantity}x "${product.name?.slice(0, 24)}..." to cart!`);
  };

  const handleBuyNow = () => {
    if (!currentUser) {
      if (typeof onRequireLogin === 'function') {
        onRequireLogin({
          title: 'Sign In to Buy',
          message: 'Please sign in or create an account to proceed directly to checkout.',
          actionLabel: 'Sign In to Buy',
          feature: 'order',
        });
      } else {
        setRedirectReason('Please sign in or create an account to complete your purchase.');
        onNavigateToLogin?.();
      }
      return;
    }
    if (productSoldOut) {
      showToast('This item is currently sold out');
      return;
    }
    let configuredProduct = product;
    if (needsSize && selectedSize) {
      configuredProduct = withSelectedSize(configuredProduct, selectedSize);
    }
    if (hasColors && selectedColor) {
      configuredProduct = withSelectedColor(configuredProduct, selectedColor);
    }
    setBuyNowItems([
      {
        product: configuredProduct,
        quantity,
        size: selectedSize || '',
        color: selectedColor || '',
      },
    ]);
    setIsCheckoutOpen(true);
  };

  const handleCompleteOrder = async (orderFormData) => {
    if (orderFormData.paymentMethod === 'GCash') {
      setPendingGcashOrderData(orderFormData);
      setIsCheckoutOpen(false);
      setIsGcashModalOpen(true);
      return;
    }
    await executeOrder(orderFormData);
  };

  const executeOrder = async (orderFormData, overrideStatus = null) => {
    if (isPlacingOrder) return;
    setIsPlacingOrder(true);
    try {
      const itemsToOrder = buyNowItems || [
        {
          product: needsSize ? withSelectedSize(product, selectedSize) : product,
          quantity: Math.max(1, Number(quantity) || 1),
          size: selectedSize || '',
          color: selectedColor || '',
        },
      ];
      const subtotal = itemsToOrder.reduce(
        (sum, it) => sum + Number(it.product?.price || 0) * Math.max(1, Number(it.quantity) || 1),
        0
      );
      const fee = isFreeShippingActive ? 0 : 150;
      const total = subtotal + fee;

      const res = await orderService.createOrder({
        userId: currentUser?.user_id || currentUser?.id || null,
        customerId: currentUser?.customer_id || currentUser?.user_id || currentUser?.id || null,
        customerName: orderFormData.customerName,
        customerPhone: orderFormData.customerPhone,
        customerEmail: currentUser?.email || null,
        customerAddress: orderFormData.customerAddress,
        deliveryNotes: orderFormData.deliveryNotes,
        paymentMethod: orderFormData.paymentMethod,
        gcashNumber: orderFormData.gcashNumber,
        gcashReference: orderFormData.gcashReference,
        codChangeFor: orderFormData.codChangeFor,
        promoId: isFreeShippingActive ? freeShippingPromoId || null : null,
        total: subtotal.toFixed(2),
        discountAmount: '0.00',
        shippingFee: fee,
        grandTotal: total.toFixed(2),
        items: itemsToOrder,
        channel: 'Web Store',
        overrideStatus,
      });

      if (!res?.success) {
        showToast(res?.error || 'Could not place order. Please try again.');
        return;
      }
      setIsCheckoutOpen(false);
      setBuyNowItems(null);
      showToast('🎉 Order placed successfully! Check your orders.');
      onNavigateToOrders?.();
    } catch {
      showToast('Network error while placing order. Please try again.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  if (!product) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <ActivityIndicator size="large" color="#EA580C" />
        <Text style={{ marginTop: 12, fontSize: 14, color: '#64748B' }}>Loading product details...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: isDarkMode ? '#11151A' : '#F3F4F6', maxWidth: '100vw', overflowX: 'hidden' }}>
      <StatusBar style="light" />
      <ToastNotification message={toastMessage} />

      {/* ─── STICKY HEADER ─── */}
      <View
        style={{
          backgroundColor: '#1E2227',
          position: 'sticky',
          top: 0,
          left: 0,
          right: 0,
          width: '100%',
          zIndex: 1000,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255, 255, 255, 0.08)',
          boxShadow: 'none',
        }}
        className="web-header"
        dataSet={{ webHeader: true }}
        accessibilityRole="header"
      >
        <View
          style={{
            maxWidth: 1360,
            marginHorizontal: 'auto',
            width: '100%',
            paddingHorizontal: isMobile ? (isSmallMobile ? 8 : 12) : 24,
            paddingVertical: isMobile ? 10 : 12,
            minHeight: isMobile ? 56 : 66,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: isMobile ? 6 : 16,
          }}
        >
          {/* Left: Mobile Nav Toggle + Logo */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: isSmallMobile ? 4 : 8 }}>
            {isMobile && (
              <TouchableOpacity
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() => setIsMobileNavOpen(true)}
                activeOpacity={0.8}
                accessibilityLabel="Open Navigation Menu"
              >
                <BootstrapIcon name="list" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            )}

            {!isMobile && (
              <TouchableOpacity
                onPress={onNavigateToStore}
                activeOpacity={0.8}
                style={{ flexDirection: 'row', alignItems: 'center' }}
              >
                <BrandLogo size={isTablet ? 32 : 40} textColor="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>

          {/* Center Nav: Desktop/Tablet */}
          {!isMobile && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {[
                { id: 'shop', label: 'Shop', active: true, onPress: onNavigateToStore },
                { id: 'garage', label: 'Book a Service', onPress: () => onNavigateToScreen?.('garage') },
                { id: 'appointments', label: 'Appointments', onPress: () => onNavigateToScreen?.('appointments') },
                { id: 'customizer', label: 'Customize', onPress: () => onNavigateToScreen?.('customizer') },
                { id: 'orders', label: 'Orders', onPress: onNavigateToOrders },
              ].map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    borderRadius: 10,
                    backgroundColor: item.active ? '#EA580C' : 'transparent',
                  }}
                  onPress={item.onPress}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 13, fontWeight: item.active ? '700' : '600', color: '#FFFFFF' }}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Right Header Actions */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: isSmallMobile ? 4 : 8 }}>
            {/* Wishlist */}
            {windowWidth >= 768 && (<TouchableOpacity
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
              onPress={onNavigateToWishlist}
              activeOpacity={0.8}
            >
              <BootstrapIcon name="heart" size={16} color="#FFFFFF" />
              {wishlistCount > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    top: -3,
                    right: -3,
                    backgroundColor: '#EF4444',
                    borderRadius: 999,
                    minWidth: 16,
                    height: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 3,
                  }}
                >
                  <Text style={{ fontSize: 9, fontWeight: '700', color: '#FFFFFF' }}>{wishlistCount}</Text>
                </View>
              )}
            </TouchableOpacity>)}

            {/* Cart Button */}
            {windowWidth >= 768 && (<TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: '#EA580C',
                paddingHorizontal: isMobile ? 10 : 14,
                paddingVertical: 7,
                borderRadius: 10,
              }}
              onPress={() => setIsCartOpen(true)}
              activeOpacity={0.85}
            >
              <BootstrapIcon name="cart3" size={16} color="#FFFFFF" />
              {!isMobile && (
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>Cart</Text>
              )}
              {cartItemCount > 0 && (
                <View
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 999,
                    minWidth: 18,
                    height: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 4,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#EA580C' }}>{cartItemCount}</Text>
                </View>
              )}
            </TouchableOpacity>)}

            {/* Auth */}
            {currentUser && !isMobile ? (
              <UserProfileButton
                currentUser={currentUser}
                onPress={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                size={36}
              />
            ) : (
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: isSmallMobile ? 8 : 12,
                  paddingVertical: 7,
                  borderRadius: 10,
                  backgroundColor: 'rgba(255, 255, 255, 0.12)',
                }}
                onPress={onNavigateToLogin}
                activeOpacity={0.85}
              >
                <BootstrapIcon name="person-fill" size={14} color="#FFFFFF" />
                {!isSmallMobile && (
                  <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#FFFFFF' }}>Sign In</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* ─── MAIN CONTENT SCROLLVIEW ─── */}
      <ScrollView
        style={{ flex: 1, width: '100%' }}
        contentContainerStyle={{
          paddingBottom: isMobile ? 100 : 60,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            maxWidth: 1360,
            marginHorizontal: 'auto',
            width: '100%',
            paddingHorizontal: isMobile ? (isSmallMobile ? 12 : 16) : 24,
            paddingTop: isMobile ? 14 : 24,
          }}
        >
          {/* Breadcrumbs Row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
            <TouchableOpacity onPress={onNavigateToStore} activeOpacity={0.7}>
              <Text style={{ fontSize: 12.5, fontWeight: '500', color: isDarkMode ? '#94A3B8' : '#64748B' }}>Store</Text>
            </TouchableOpacity>
            <BootstrapIcon name="chevron-right" size={10} color="#94A3B8" />
            {product.category && (
              <>
                <Text style={{ fontSize: 12.5, fontWeight: '500', color: isDarkMode ? '#94A3B8' : '#64748B' }}>
                  {product.category}
                </Text>
                <BootstrapIcon name="chevron-right" size={10} color="#94A3B8" />
              </>
            )}
            <Text
              style={{ fontSize: 12.5, fontWeight: '600', color: isDarkMode ? '#F8FAFC' : '#0F172A', maxWidth: 280 }}
              numberOfLines={1}
            >
              {product.name}
            </Text>
          </View>

          {/* ─── 2-COLUMN DESKTOP / STACKED MOBILE LAYOUT ─── */}
          <View
            style={{
              flexDirection: isDesktop ? 'row' : 'column',
              alignItems: 'flex-start',
              gap: isDesktop ? 36 : 24,
              width: '100%',
            }}
          >
            {/* ── LEFT COLUMN: PRODUCT IMAGE GALLERY ── */}
            <View
              style={{
                width: isDesktop ? '48%' : '100%',
                position: isDesktop ? 'sticky' : 'relative',
                top: isDesktop ? 86 : 0,
              }}
            >
              {/* Main Showcase Image Card */}
              <View
                style={{
                  width: '100%',
                  aspectRatio: 1,
                  backgroundColor: isDarkMode ? '#1C2229' : '#FFFFFF',
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: isDarkMode ? '#2D3742' : '#E2E8F0',
                  overflow: 'hidden',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
                }}
              >
                {activeImage ? (
                  <Image
                    source={{ uri: activeImage }}
                    style={{ width: '90%', height: '90%' }}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                    <BootstrapIcon name="box-seam" size={54} color="#94A3B8" />
                    <Text style={{ fontSize: 13, color: '#94A3B8', marginTop: 8 }}>No image available</Text>
                  </View>
                )}

                {/* Compatibility Indicator (Top-Left) */}
                <View style={{ position: 'absolute', top: 12, left: 12, zIndex: 4 }}>
                  <CompatibilityIndicator
                    status={compatStatus}
                    bike={activeBike}
                    message={product.compatMessage}
                  />
                </View>

                {/* Wishlist Button (Top-Right) */}
                <TouchableOpacity
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: isDarkMode ? 'rgba(30, 34, 38, 0.9)' : 'rgba(255, 255, 255, 0.95)',
                    borderWidth: 1,
                    borderColor: isDarkMode ? '#2D3742' : '#E2E8F0',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                    zIndex: 4,
                  }}
                  onPress={() => toggleWishlist(product.id)}
                  activeOpacity={0.8}
                >
                  <BootstrapIcon
                    name={isFav ? 'heart-fill' : 'heart'}
                    size={16}
                    color={isFav ? '#EF4444' : '#64748B'}
                  />
                </TouchableOpacity>

                {/* Sold Out / Discount Ribbon */}
                {productSoldOut ? (
                  <View
                    style={{
                      position: 'absolute',
                      bottom: 12,
                      left: 12,
                      backgroundColor: '#DC2626',
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>SOLD OUT</Text>
                  </View>
                ) : discountPercent ? (
                  <View
                    style={{
                      position: 'absolute',
                      bottom: 12,
                      left: 12,
                      backgroundColor: '#EA580C',
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
                      SAVE {discountPercent}%
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Color Image Thumbnails (if available) */}
              {colorEntries.length > 1 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 }}>
                  {colorEntries.map((c) => {
                    const isSelected = selectedColor === c.name;
                    const cImg = getColorImage(product, c.name) || product.image;
                    return (
                      <TouchableOpacity
                        key={c.name}
                        style={{
                          width: 60,
                          height: 60,
                          borderRadius: 12,
                          backgroundColor: '#FFFFFF',
                          borderWidth: isSelected ? 2 : 1,
                          borderColor: isSelected ? '#EA580C' : '#E2E8F0',
                          padding: 4,
                          overflow: 'hidden',
                        }}
                        onPress={() => setSelectedColor(c.name)}
                        activeOpacity={0.8}
                      >
                        <Image source={{ uri: cImg }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Genuine Parts & Free Shipping Badges */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  marginTop: 18,
                  padding: 14,
                  backgroundColor: isDarkMode ? '#1C2229' : '#FFFFFF',
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: isDarkMode ? '#2D3742' : '#E2E8F0',
                  flexWrap: 'wrap',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <BootstrapIcon name="patch-check-fill" size={16} color="#EA580C" />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: isDarkMode ? '#E2E8F0' : '#334155' }}>
                    100% Genuine MotoTrack Part
                  </Text>
                </View>
                {isFreeShippingActive && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <BootstrapIcon name="truck" size={15} color="#16A34A" />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#16A34A' }}>Free Delivery Eligible</Text>
                  </View>
                )}
              </View>
            </View>

            {/* ── RIGHT COLUMN: DETAILS, SELECTIONS & ACTIONS ── */}
            <View style={{ width: isDesktop ? '52%' : '100%', flex: 1 }}>
              <View
                style={{
                  backgroundColor: isDarkMode ? '#1C2229' : '#FFFFFF',
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: isDarkMode ? '#2D3742' : '#E2E8F0',
                  padding: isMobile ? (isSmallMobile ? 14 : 18) : 26,
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
                }}
              >
                {/* Brand & Category */}
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: '#EA580C',
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    marginBottom: 6,
                  }}
                >
                  {product.brand ? `${product.brand} · ` : ''}{product.category || 'Motorcycle Part'}
                </Text>

                {/* Product Name */}
                <Text
                  style={{
                    fontSize: isMobile ? 18 : 22,
                    fontWeight: '700',
                    color: isDarkMode ? '#F8FAFC' : '#0F172A',
                    lineHeight: isMobile ? 24 : 30,
                    marginBottom: 12,
                  }}
                >
                  {product.name}
                </Text>

                {/* Ratings & Sold line */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
                  {hasRatings ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <StarRow rating={avgReviewScore} size={14} />
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#F59E0B' }}>
                        {avgReviewScore.toFixed(1)}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#64748B' }}>
                        ({reviewListCount} {reviewListCount === 1 ? 'review' : 'reviews'})
                      </Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <BootstrapIcon name="star" size={13} color="#94A3B8" />
                      <Text style={{ fontSize: 12, color: '#94A3B8' }}>No ratings yet</Text>
                    </View>
                  )}
                  <Text style={{ color: '#CBD5E1' }}>•</Text>
                  <Text
                    style={{
                      fontSize: 12.5,
                      fontWeight: '600',
                      color: productSoldOut ? '#DC2626' : availableStock <= 5 ? '#D97706' : '#16A34A',
                    }}
                  >
                    {productSoldOut
                      ? 'Out of stock'
                      : availableStock <= 5
                      ? `Only ${availableStock} left in stock`
                      : `${availableStock} units available`}
                  </Text>
                </View>

                {/* Price Display */}
                <View
                  style={{
                    backgroundColor: isDarkMode ? '#15191E' : '#FFF7ED',
                    borderRadius: 14,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: isDarkMode ? '#2D3742' : '#FED7AA',
                    marginBottom: 20,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <Text
                      style={{
                        fontSize: isMobile ? 24 : 28,
                        fontWeight: '700',
                        color: '#EA580C',
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      ₱{currentPrice.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                    {originalPrice ? (
                      <Text
                        style={{
                          fontSize: 16,
                          color: '#94A3B8',
                          textDecorationLine: 'line-through',
                          fontVariant: ['tabular-nums'],
                        }}
                      >
                        ₱{originalPrice.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={{ fontSize: 11.5, color: '#64748B', marginTop: 4 }}>
                    Tax included · Fast shipping available nationwide
                  </Text>
                </View>

                {/* Motorcycle Fitment Checker */}
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: isDarkMode ? '#2D3742' : '#E2E8F0',
                    borderRadius: 14,
                    padding: 14,
                    marginBottom: 20,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                    Compatibility Check
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <BootstrapIcon name="motorcycle" size={16} color="#EA580C" />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: isDarkMode ? '#F8FAFC' : '#1E293B' }}>
                        {activeBike ? `${activeBike.brand} ${activeBike.model}` : 'All Motorcycles'}
                      </Text>
                    </View>
                    <View
                      style={{
                        backgroundColor:
                          compatStatus === COMPAT_STATUS.COMPATIBLE
                            ? '#DCFCE7'
                            : compatStatus === COMPAT_STATUS.INCOMPATIBLE
                            ? '#FEE2E2'
                            : '#F1F5F9',
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 6,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '700',
                          color:
                            compatStatus === COMPAT_STATUS.COMPATIBLE
                              ? '#166534'
                              : compatStatus === COMPAT_STATUS.INCOMPATIBLE
                              ? '#991B1B'
                              : '#475569',
                        }}
                      >
                        {compatStatus === COMPAT_STATUS.COMPATIBLE
                          ? '100% Guaranteed Fit'
                          : compatStatus === COMPAT_STATUS.INCOMPATIBLE
                          ? 'Not Compatible'
                          : 'Universal Fit'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Size Variants (if applicable) */}
                {sizeEntries.length > 0 && (
                  <View style={{ marginBottom: 18 }}>
                    <Text style={{ fontSize: 12.5, fontWeight: '700', color: isDarkMode ? '#F8FAFC' : '#1E293B', marginBottom: 8 }}>
                      Select Size: {selectedSize}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {sizeEntries.map((s) => {
                        const isSelected = selectedSize === s.name;
                        const isSoldOut = isSizeSoldOut(product, s.name);
                        return (
                          <TouchableOpacity
                            key={s.name}
                            style={{
                              paddingHorizontal: 14,
                              paddingVertical: 8,
                              borderRadius: 10,
                              backgroundColor: isSelected ? '#EA580C' : isDarkMode ? '#1E242B' : '#F8FAFC',
                              borderWidth: 1.5,
                              borderColor: isSelected ? '#EA580C' : isDarkMode ? '#333D48' : '#CBD5E1',
                              opacity: isSoldOut ? 0.45 : 1,
                            }}
                            disabled={isSoldOut}
                            onPress={() => setSelectedSize(s.name)}
                            activeOpacity={0.8}
                          >
                            <Text
                              style={{
                                fontSize: 12.5,
                                fontWeight: '700',
                                color: isSelected ? '#FFFFFF' : isDarkMode ? '#F8FAFC' : '#1E293B',
                              }}
                            >
                              {s.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Color Variants (if applicable) */}
                {colorEntries.length > 0 && (
                  <View style={{ marginBottom: 18 }}>
                    <Text style={{ fontSize: 12.5, fontWeight: '700', color: isDarkMode ? '#F8FAFC' : '#1E293B', marginBottom: 8 }}>
                      Select Color: {selectedColor}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {colorEntries.map((c) => {
                        const isSelected = selectedColor === c.name;
                        return (
                          <TouchableOpacity
                            key={c.name}
                            style={{
                              paddingHorizontal: 14,
                              paddingVertical: 8,
                              borderRadius: 10,
                              backgroundColor: isSelected ? '#EA580C' : isDarkMode ? '#1E242B' : '#F8FAFC',
                              borderWidth: 1.5,
                              borderColor: isSelected ? '#EA580C' : isDarkMode ? '#333D48' : '#CBD5E1',
                            }}
                            onPress={() => setSelectedColor(c.name)}
                            activeOpacity={0.8}
                          >
                            <Text
                              style={{
                                fontSize: 12.5,
                                fontWeight: '700',
                                color: isSelected ? '#FFFFFF' : isDarkMode ? '#F8FAFC' : '#1E293B',
                              }}
                            >
                              {c.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Quantity Stepper */}
                <View style={{ marginBottom: 22 }}>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: isDarkMode ? '#F8FAFC' : '#1E293B', marginBottom: 8 }}>
                    Quantity
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: isDarkMode ? '#15191E' : '#F8FAFC',
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: isDarkMode ? '#2D3742' : '#CBD5E1',
                      }}
                    >
                      <TouchableOpacity
                        style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}
                        onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                        disabled={quantity <= 1}
                      >
                        <BootstrapIcon name="dash" size={16} color={quantity <= 1 ? '#94A3B8' : '#EA580C'} />
                      </TouchableOpacity>
                      <Text
                        style={{
                          minWidth: 36,
                          textAlign: 'center',
                          fontSize: 14,
                          fontWeight: '700',
                          color: isDarkMode ? '#F8FAFC' : '#0F172A',
                          fontVariant: ['tabular-nums'],
                        }}
                      >
                        {quantity}
                      </Text>
                      <TouchableOpacity
                        style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}
                        onPress={() => setQuantity((q) => Math.min(availableStock, q + 1))}
                        disabled={quantity >= availableStock}
                      >
                        <BootstrapIcon name="plus" size={16} color={quantity >= availableStock ? '#94A3B8' : '#EA580C'} />
                      </TouchableOpacity>
                    </View>
                    <Text style={{ fontSize: 12, color: '#64748B' }}>
                      Max {availableStock} per customer
                    </Text>
                  </View>
                </View>

                {/* Purchase Action Buttons */}
                <View style={{ flexDirection: isSmallMobile ? 'column' : 'row', gap: 12, marginBottom: 20 }}>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: isDarkMode ? '#1E293B' : '#FFF7ED',
                      borderWidth: 1.5,
                      borderColor: '#EA580C',
                      borderRadius: 12,
                      paddingVertical: 13,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      opacity: productSoldOut ? 0.5 : 1,
                    }}
                    onPress={handleAddToCart}
                    disabled={productSoldOut}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon name="cart-plus-fill" size={16} color="#EA580C" />
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#EA580C' }}>Add to Cart</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: '#EA580C',
                      borderRadius: 12,
                      paddingVertical: 13,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      boxShadow: '0 4px 14px rgba(234, 88, 12, 0.35)',
                      opacity: productSoldOut ? 0.5 : 1,
                    }}
                    onPress={handleBuyNow}
                    disabled={productSoldOut}
                    activeOpacity={0.9}
                  >
                    <BootstrapIcon name="lightning-fill" size={15} color="#FFFFFF" />
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>Buy Now</Text>
                  </TouchableOpacity>
                </View>

                {/* Description */}
                <View style={{ borderTopWidth: 1, borderTopColor: isDarkMode ? '#2D3742' : '#F1F5F9', paddingTop: 18, marginTop: 4 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: isDarkMode ? '#F8FAFC' : '#1E293B', marginBottom: 8 }}>
                    Product Description
                  </Text>
                  <Text style={{ fontSize: 13, color: isDarkMode ? '#94A3B8' : '#475569', lineHeight: 20 }}>
                    {product.description || 'High-performance genuine replacement part crafted for maximum durability and track reliability.'}
                  </Text>
                </View>

                {/* Key Features List (if available) */}
                {Array.isArray(product.features) && product.features.length > 0 && (
                  <View style={{ marginTop: 16 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#F8FAFC' : '#1E293B', marginBottom: 8 }}>
                      Key Features
                    </Text>
                    {product.features.map((feat, idx) => (
                      <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <BootstrapIcon name="check-circle-fill" size={13} color="#16A34A" />
                        <Text style={{ fontSize: 12.5, color: isDarkMode ? '#CBD5E1' : '#334155' }}>{feat}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Customer Reviews Section */}
                <View style={{ borderTopWidth: 1, borderTopColor: isDarkMode ? '#2D3742' : '#F1F5F9', paddingTop: 20, marginTop: 18 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: isDarkMode ? '#F8FAFC' : '#1E293B' }}>
                      Customer Reviews ({reviewListCount})
                    </Text>
                    {hasRatings && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <BootstrapIcon name="star-fill" size={13} color="#F59E0B" />
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#F59E0B' }}>
                          {avgReviewScore.toFixed(1)} / 5.0
                        </Text>
                      </View>
                    )}
                  </View>

                  {reviewsLoading ? (
                    <ActivityIndicator color="#EA580C" style={{ paddingVertical: 14 }} />
                  ) : reviews.length === 0 ? (
                    <View style={{ padding: 14, borderRadius: 12, backgroundColor: isDarkMode ? '#15191E' : '#F8FAFC', borderWidth: 1, borderColor: isDarkMode ? '#2D3742' : '#E2E8F0', alignItems: 'center' }}>
                      <Text style={{ fontSize: 12.5, color: '#94A3B8' }}>No reviews yet. Be the first to review this product!</Text>
                    </View>
                  ) : (
                    <View style={{ gap: 10 }}>
                      {reviews.slice(0, 5).map((rev, idx) => (
                        <View
                          key={rev.id || idx}
                          style={{
                            padding: 12,
                            borderRadius: 12,
                            backgroundColor: isDarkMode ? '#15191E' : '#F8FAFC',
                            borderWidth: 1,
                            borderColor: isDarkMode ? '#2D3742' : '#E2E8F0',
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <Text style={{ fontSize: 12.5, fontWeight: '700', color: isDarkMode ? '#F8FAFC' : '#1E293B' }}>
                              {rev.customer_name || rev.user_name || 'Verified Rider'}
                            </Text>
                            <Text style={{ fontSize: 11, color: '#94A3B8' }}>
                              {formatReviewDate(rev.created_at)}
                            </Text>
                          </View>
                          <StarRow rating={rev.rating || 5} size={12} />
                          {rev.comment ? (
                            <Text style={{ fontSize: 12, color: isDarkMode ? '#94A3B8' : '#475569', marginTop: 6, lineHeight: 18 }}>
                              {rev.comment}
                            </Text>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ─── STICKY MOBILE BOTTOM BAR (for instant Purchase) ─── */}
      {isMobile && (
        <View
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: isDarkMode ? '#1C2229' : '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: isDarkMode ? '#2D3742' : '#E2E8F0',
            paddingHorizontal: isSmallMobile ? 10 : 16,
            paddingVertical: 10,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.1)',
            zIndex: 900,
          }}
        >
          <View>
            <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '600' }}>Total Price</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#EA580C', fontVariant: ['tabular-nums'] }}>
              ₱{(currentPrice * quantity).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={{
                backgroundColor: isDarkMode ? '#242F3E' : '#FFF7ED',
                borderWidth: 1.5,
                borderColor: '#EA580C',
                paddingHorizontal: isSmallMobile ? 12 : 16,
                paddingVertical: 10,
                borderRadius: 10,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
              onPress={handleAddToCart}
              disabled={productSoldOut}
            >
              <BootstrapIcon name="cart-plus" size={15} color="#EA580C" />
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#EA580C' }}>Cart</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                backgroundColor: '#EA580C',
                paddingHorizontal: isSmallMobile ? 14 : 20,
                paddingVertical: 10,
                borderRadius: 10,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
              onPress={handleBuyNow}
              disabled={productSoldOut}
            >
              <BootstrapIcon name="lightning-fill" size={14} color="#FFFFFF" />
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#FFFFFF' }}>Buy Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ─── MODALS ─── */}
      <CartModal
        visible={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onProceedToCheckout={() => {
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        }}
      />

      <CheckoutModal
        visible={isCheckoutOpen}
        onClose={() => {
          setIsCheckoutOpen(false);
          setBuyNowItems(null);
        }}
        onCompleteOrder={handleCompleteOrder}
        isPlacingOrder={isPlacingOrder}
        overrideItems={buyNowItems}
        overrideItemCount={buyNowItems ? buyNowItems.reduce((acc, it) => acc + (it.quantity || 1), 0) : null}
        overrideTotal={
          buyNowItems
            ? buyNowItems.reduce((acc, it) => acc + (it.product?.price || 0) * (it.quantity || 1), 0) +
              (isFreeShippingActive ? 0 : 150)
            : null
        }
      />

      <GCashPaymentModal
        visible={isGcashModalOpen}
        onClose={() => setIsGcashModalOpen(false)}
        onPaymentSuccess={async (receipt) => {
          setIsGcashModalOpen(false);
          if (pendingGcashOrderData) {
            await executeOrder(
              {
                ...pendingGcashOrderData,
                gcashReference: receipt.referenceNumber,
                paymentMethod: 'GCash',
              },
              'Processing'
            );
          }
        }}
      />

      <CustomerMobileNavDrawer
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
        currentScreen="shop"
        onNavigateToScreen={(screen, params) => {
          if (screen === 'shop') onNavigateToStore?.();
          else if (screen === 'garage') onNavigateToScreen?.('garage');
          else if (screen === 'customizer') onNavigateToScreen?.('customizer');
          else if (screen === 'wishlist') onNavigateToWishlist?.();
          else if (screen === 'profile' || screen === 'orders' || screen === 'notifications') {
            onNavigateToOrders?.();
          } else if (screen === 'login') onNavigateToLogin?.();
        }}
      />
    </View>
  );
}

