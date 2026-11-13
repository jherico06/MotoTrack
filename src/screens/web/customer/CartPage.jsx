import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  BootstrapIcon,
  ToastNotification,
  UserProfileDropdown,
  UserProfileButton,
  BrandLogo,
  HeaderSearchWidget,
  NotificationDropdown,
  CustomerMobileNavDrawer,
} from '../../../components/common';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useCart } from '../../../context/CartContext.jsx';
import { useWishlist } from '../../../context/WishlistContext.jsx';
import { useTheme } from '../../../context/ThemeContext.jsx';
import { promoService } from '../../../services/products/promoService.js';
import { productService } from '../../../services/products/productService.js';
import { notificationService } from '../../../services/notifications/notificationService.js';
import { isProductSoldOut } from '../../../utils/productSizes.js';
import { resolveReorderLevel } from '../../../utils/inventoryHelpers.js';
import { productHasCustomerRatings } from '../../../utils/productCatalog.js';
import { createShopWebStyles } from '../../../styles/web/shopPage.web.styles.js';
import { ProductSpecsModal } from '../../../components/modals';
import { useWebSavedWishlistCount } from '../../../components/web/useWebSavedWishlistCount.js';

export default function CartPageWeb({
  visible = true,
  onClose,
  onProceedToCheckout,
  onNavigateToStore,
  onNavigateToGarage,
  onNavigateToCustomizer,
  onNavigateToWishlist,
  onNavigateToOrders,
  onNavigateToProfile,
  onNavigateToLogin,
  onNavigateToAdmin,
  onNavigateToScreen,
  onLogout,
}) {
  const { width: windowWidth } = useWindowDimensions();
  const isMobile = windowWidth < 768;
  const isTablet = windowWidth >= 768 && windowWidth < 1024;
  const isDesktop = windowWidth >= 1024;

  const { currentUser, logout } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const {
    cart,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    removeSelectedFromCart,
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
  const savedWishlistCount = useWebSavedWishlistCount(wishlist);

  const [availablePromos, setAvailablePromos] = useState([]);
  const [suggestedProducts, setSuggestedProducts] = useState([]);
  const [selectedProductForSpecs, setSelectedProductForSpecs] = useState(null);
  const [isSpecsOpen, setIsSpecsOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(() =>
    currentUser ? notificationService.getUnreadCount(currentUser) : 0
  );

  const cStyles = useMemo(() => createCartPageStyles(isDarkMode), [isDarkMode]);
  const shopStyles = useMemo(() => createShopWebStyles(isDarkMode), [isDarkMode]);

  const numColumns =
    windowWidth >= 1150
      ? 5
      : windowWidth >= 920
        ? 4
        : windowWidth >= 680
          ? 3
          : windowWidth < 360
            ? 1
            : 2;
  const gapSize = windowWidth < 480 ? 10 : windowWidth < 1024 ? 12 : 14;
  const cardWidth = `calc(${100 / numColumns}% - ${((numColumns - 1) * gapSize) / numColumns}px)`;

  useEffect(() => {
    const unsub = notificationService.subscribe(() => {
      setUnreadNotifCount(
        currentUser ? notificationService.getUnreadCount(currentUser) : 0
      );
    });
    return () => unsub?.();
  }, [currentUser?.id, currentUser?.customer_id, currentUser?.email]);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    promoService
      .getActivePromos()
      .then((active) => {
        if (!alive) return;
        setAvailablePromos(Array.isArray(active) ? active : []);
      })
      .catch(() => {});

    productService
      .getProducts()
      .then((list) => {
        if (!alive || !Array.isArray(list)) return;
        const inStock = list.filter((p) => !isProductSoldOut(p)).slice(0, 5);
        setSuggestedProducts(inStock);
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, [visible]);

  // Automatically apply active non-expired percent-off promo to eligible cart items
  useEffect(() => {
    if (!visible || selectedCartItems.length === 0 || availablePromos.length === 0) return;
    if (appliedPromoMeta?.code) return;
    let cancelled = false;
    (async () => {
      const percentPromos = availablePromos.filter((p) => p.promoType === 'PERCENT_OFF');
      for (const p of percentPromos) {
        if (cancelled) return;
        try {
          const res = await promoService.validatePromo(p.code, {
            cartItems: selectedCartItems,
            shippingFee: shippingRate,
          });
          if (!cancelled && res?.valid) {
            setPromoCode(p.code);
            await applyPromo(p.code);
            break;
          }
        } catch (_e) {}
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, selectedCartItems, availablePromos, appliedPromoMeta?.code]);

  // Sync browser URL with ?screen=cart when open so it behaves as its own page
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !visible) return;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('screen') !== 'cart') {
        url.searchParams.set('screen', 'cart');
        window.history.pushState({ cartPage: true }, '', url.pathname + url.search);
      }
    } catch (_e) {}

    const handlePopState = () => {
      try {
        const u = new URL(window.location.href);
        if (u.searchParams.get('screen') !== 'cart') {
          onClose?.();
        }
      } catch (_e) {}
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [visible]);

  const restoreUrlAndClose = (targetScreen = null) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.get('screen') === 'cart') {
          if (targetScreen && targetScreen !== 'shop') {
            url.searchParams.set('screen', targetScreen);
          } else {
            url.searchParams.delete('screen');
          }
          window.history.pushState({}, '', url.pathname + (url.search ? url.search : ''));
        }
      } catch (_e) {}
    }
    onClose?.();
  };

  const navigateFromCart = (screen, params = null) => {
    restoreUrlAndClose(screen);
    if (screen === 'shop' || screen === 'store') {
      if (onNavigateToStore) onNavigateToStore(params);
      else onNavigateToScreen?.('shop', params);
      return;
    }
    if (screen === 'garage') {
      if (onNavigateToGarage) onNavigateToGarage(params);
      else onNavigateToScreen?.('garage', params);
      return;
    }
    if (screen === 'customizer') {
      if (onNavigateToCustomizer) onNavigateToCustomizer(params);
      else onNavigateToScreen?.('customizer', params);
      return;
    }
    if (screen === 'wishlist') {
      if (onNavigateToWishlist) onNavigateToWishlist();
      else onNavigateToScreen?.('wishlist');
      return;
    }
    if (screen === 'orders') {
      if (onNavigateToOrders) onNavigateToOrders();
      else if (onNavigateToProfile) onNavigateToProfile('orders');
      else onNavigateToScreen?.('orders');
      return;
    }
    if (screen === 'profile') {
      if (onNavigateToProfile) onNavigateToProfile(params?.tab || 'garage');
      else onNavigateToScreen?.('profile', params);
      return;
    }
    if (screen === 'login') {
      if (onNavigateToLogin) onNavigateToLogin();
      else onNavigateToScreen?.('login');
      return;
    }
    if (screen === 'admin') {
      if (onNavigateToAdmin) onNavigateToAdmin();
      else onNavigateToScreen?.('admin');
      return;
    }
    onNavigateToScreen?.(screen, params);
  };

  if (!visible) return null;

  const hasSelectedItems = selectedCartItems.length > 0;

  const handleCheckoutPress = () => {
    if (!hasSelectedItems) {
      showToast?.('Please select at least one item to proceed to checkout');
      return;
    }
    onProceedToCheckout?.(selectedCartItems);
  };

  const formatPhpAmount = (val) =>
    `₱${Number(val || 0).toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const getActiveProductPromo = (product) => {
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
  };

  return (
    <View
      style={cStyles.pageOverlay}
      className={isDarkMode ? 'dark bg-[#11151A] min-h-screen' : 'bg-[#F3F4F6] min-h-screen'}
    >
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <ToastNotification message={toastMessage} />

      <ScrollView
        style={{
          flex: 1,
          width: '100%',
          ...(Platform.OS === 'web'
            ? { overflowY: 'scroll', overscrollBehavior: 'none', overscrollBehaviorY: 'none' }
            : {}),
        }}
        contentContainerStyle={cStyles.scrollContent}
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={true}
        scrollEventThrottle={16}
      >
        {/* ─── STICKY TOP NAVBAR ─── */}
        <View
          style={cStyles.headerWrapper}
          className="web-header"
          dataSet={{ webHeader: true }}
          accessibilityRole="header"
        >
          <View
            style={[
              cStyles.headerInner,
              isTablet && { paddingHorizontal: 18, paddingVertical: 10, minHeight: 60, gap: 12 },
              isMobile && { paddingHorizontal: 12, paddingVertical: 10, gap: 8, minHeight: 56 },
              windowWidth < 400 && { paddingHorizontal: 8, paddingVertical: 8, gap: 4 },
            ]}
          >
            {/* Left: Mobile Nav Toggle + Logo */}
            <View
              style={[
                cStyles.headerLeft,
                isMobile && { gap: 8 },
                windowWidth < 400 && { gap: 4 },
              ]}
            >
              {isMobile && (
                <TouchableOpacity
                  style={cStyles.mobileNavToggleBtn}
                  onPress={() => setIsMobileNavOpen(true)}
                  activeOpacity={0.8}
                  accessibilityLabel="Open Navigation Menu"
                >
                  <BootstrapIcon name="list" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              )}
              {!isMobile && (
                <TouchableOpacity
                  style={[cStyles.logoWrap, isTablet && { marginRight: 4 }]}
                  onPress={() => navigateFromCart('shop')}
                  activeOpacity={0.8}
                >
                  <BrandLogo
                    size={windowWidth < 768 ? 28 : isTablet ? 30 : windowWidth < 1024 ? 32 : 42}
                    textColor="#FFFFFF"
                  />
                </TouchableOpacity>
              )}
            </View>

            {/* Center Navigation */}
            {!isMobile && (
              <View style={[cStyles.headerCenterNav, isTablet && { gap: 8 }]}>
                <TouchableOpacity
                  className="main-nav-tab"
                  style={[cStyles.headerCenterBtn, isTablet && { height: 34, paddingHorizontal: 10 }]}
                  onPress={() => navigateFromCart('shop')}
                  activeOpacity={0.8}
                  title="Shop"
                >
                  <Text style={[cStyles.headerCenterBtnText, isTablet && { fontSize: 13 }]}>Shop</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="main-nav-tab"
                  style={[cStyles.headerCenterBtn, isTablet && { height: 34, paddingHorizontal: 9 }]}
                  onPress={() => navigateFromCart('garage')}
                  activeOpacity={0.8}
                  title="Book a Service"
                >
                  <Text style={[cStyles.headerCenterBtnText, isTablet && { fontSize: 13 }]}>
                    {isTablet ? 'Book Service' : 'Book a Service'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="main-nav-tab"
                  style={[cStyles.headerCenterBtn, isTablet && { height: 34, paddingHorizontal: 9 }]}
                  onPress={() => navigateFromCart('customizer')}
                  activeOpacity={0.8}
                  title="Customize"
                >
                  <Text style={[cStyles.headerCenterBtnText, isTablet && { fontSize: 13 }]}>Customize</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="main-nav-tab"
                  style={[cStyles.headerCenterBtn, isTablet && { height: 34, paddingHorizontal: 9 }]}
                  onPress={() => navigateFromCart('profile', { tab: 'garage' })}
                  activeOpacity={0.8}
                  title="Garage"
                >
                  <Text style={[cStyles.headerCenterBtnText, isTablet && { fontSize: 13 }]}>Garage</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="main-nav-tab"
                  style={[cStyles.headerCenterBtn, isTablet && { height: 34, paddingHorizontal: 9 }]}
                  onPress={() => navigateFromCart('orders')}
                  activeOpacity={0.8}
                  title="Orders"
                >
                  <Text style={[cStyles.headerCenterBtnText, isTablet && { fontSize: 13 }]}>Orders</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Right Header Actions */}
            <View
              style={[
                cStyles.headerActions,
                isMobile && { gap: 6 },
                windowWidth < 400 && { gap: 4 },
              ]}
            >
              <HeaderSearchWidget
                onSearch={(query) => navigateFromCart('shop', { search: query })}
                isDark={isDarkMode}
              />

              {!isMobile && (
                <TouchableOpacity
                  style={cStyles.navActionIconBtn}
                  onPress={() => navigateFromCart('wishlist')}
                  activeOpacity={0.8}
                  title="Saved Wishlist"
                >
                  <BootstrapIcon name="bookmark" size={16} color="#FFFFFF" />
                  {savedWishlistCount > 0 && (
                    <View style={cStyles.navBadgeCircle}>
                      <Text style={cStyles.navBadgeText}>{savedWishlistCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}

              {/* Notifications */}
              <View style={{ position: 'relative' }}>
                <TouchableOpacity
                  style={cStyles.navActionIconBtn}
                  onPress={() => {
                    setIsUserDropdownOpen(false);
                    setIsNotifDropdownOpen((prev) => !prev);
                  }}
                  activeOpacity={0.8}
                  title="Notifications"
                >
                  <BootstrapIcon name="bell" size={16} color="#FFFFFF" />
                  {unreadNotifCount > 0 && (
                    <View style={cStyles.navBadgeCircle}>
                      <Text style={cStyles.navBadgeText}>
                        {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                <NotificationDropdown
                  isOpen={isNotifDropdownOpen}
                  onClose={() => setIsNotifDropdownOpen(false)}
                  onNavigateToScreen={(screen, params) => {
                    setIsNotifDropdownOpen(false);
                    navigateFromCart(screen, params);
                  }}
                  currentUser={currentUser}
                />
              </View>

              {/* Cart Button */}
              {!isMobile && (
                <TouchableOpacity
                  style={cStyles.navActionIconBtn}
                  activeOpacity={0.8}
                  title="Shopping Cart"
                >
                  <BootstrapIcon name="cart3" size={17} color="#FFFFFF" />
                  {cartItemCount > 0 && (
                    <View style={cStyles.navBadgeCircle}>
                      <Text style={cStyles.navBadgeText}>{cartItemCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}

              {/* User Profile / Sign In */}
              {currentUser && !isMobile ? (
                <View style={[cStyles.loggedInContainer, { position: 'relative' }]}>
                  <UserProfileButton
                    currentUser={currentUser}
                    onPress={() => {
                      setIsNotifDropdownOpen(false);
                      setIsUserDropdownOpen((prev) => !prev);
                    }}
                    size={40}
                  />
                  <UserProfileDropdown
                    currentUser={currentUser}
                    isOpen={isUserDropdownOpen}
                    currentScreen="cart"
                    showDashboard={false}
                    onClose={() => setIsUserDropdownOpen(false)}
                    onNavigateToDashboard={() => navigateFromCart('profile', { tab: 'garage' })}
                    onNavigateToOrders={() => navigateFromCart('orders')}
                    onNavigateToProfile={(tab = 'profile') =>
                      navigateFromCart('profile', { tab: typeof tab === 'string' ? tab : 'profile' })
                    }
                    onNavigateToSettings={() => navigateFromCart('profile', { tab: 'settings' })}
                    onNavigateToWishlist={() => navigateFromCart('wishlist')}
                    onNavigateToAdmin={() => navigateFromCart('admin')}
                    onLogout={() => {
                      restoreUrlAndClose('shop');
                      if (onLogout) onLogout();
                      else logout?.();
                    }}
                    isDark={isDarkMode}
                    onToggleDarkMode={toggleDarkMode}
                  />
                </View>
              ) : !currentUser ? (
                <TouchableOpacity
                  style={cStyles.signInHeaderBtn}
                  onPress={() => navigateFromCart('login')}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon name="person" size={16} color="#FFFFFF" />
                  <Text style={cStyles.signInHeaderBtnText}>Sign In</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>

        {/* ─── MAIN CART PAGE CONTENT ─── */}
        <View
          style={[
            cStyles.maxContainer,
            isMobile && { paddingHorizontal: 14, paddingTop: 16 },
          ]}
        >
          {/* ─── EMPTY CART STATE ─── */}
          {cart.length === 0 ? (
            <View>
              <View style={cStyles.emptyStateCard}>
                <View style={cStyles.emptyIconCircle}>
                  <BootstrapIcon name="cart-x" size={32} color="#EA580C" />
                </View>
                <Text style={cStyles.emptyTitle}>Your cart is empty</Text>
                <Text style={cStyles.emptySub}>
                  Browse our catalog and add genuine motorcycle parts, lubricants, and riding gear to your bag.
                </Text>

                <View style={cStyles.emptyActionsRow}>
                  <TouchableOpacity
                    style={cStyles.primaryExploreBtn}
                    onPress={() => restoreUrlAndClose('shop')}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon name="bag-plus-fill" size={14} color="#FFFFFF" />
                    <Text style={cStyles.primaryExploreBtnText}>Browse Parts Catalog</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={cStyles.secondaryExploreBtn}
                    onPress={() => navigateFromCart('wishlist')}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon
                      name="bookmark"
                      size={14}
                      color={isDarkMode ? '#F8FAFC' : '#1E293B'}
                    />
                    <Text style={cStyles.secondaryExploreBtnText}>
                      View Saved Wishlist{savedWishlistCount > 0 ? ` (${savedWishlistCount})` : ''}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Trust Highlights inside Empty State */}
                <View style={cStyles.emptyTrustRow}>
                  <View style={cStyles.emptyTrustItem}>
                    <BootstrapIcon name="shield-check" size={15} color="#EA580C" />
                    <Text style={cStyles.emptyTrustText}>100% Genuine Parts</Text>
                  </View>
                  <View style={cStyles.emptyTrustItem}>
                    <BootstrapIcon name="truck" size={15} color="#EA580C" />
                    <Text style={cStyles.emptyTrustText}>Fast Tracked Delivery</Text>
                  </View>
                  <View style={cStyles.emptyTrustItem}>
                    <BootstrapIcon name="tools" size={15} color="#EA580C" />
                    <Text style={cStyles.emptyTrustText}>Verified Bike Fitment</Text>
                  </View>
                </View>
              </View>

              {/* Recommended In-Stock Parts */}
              {suggestedProducts.length > 0 && (
                <View style={cStyles.suggestedSection}>
                  <View style={cStyles.suggestedHeaderRow}>
                    <View>
                      <Text style={cStyles.sectionHeaderText}>Popular Gear & Parts</Text>
                      <Text style={cStyles.sectionSubText}>
                        Quick-add top-rated motorcycle essentials directly to your cart
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => restoreUrlAndClose('shop')}
                      activeOpacity={0.75}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#EA580C' }}>
                        View All Catalog
                      </Text>
                      <BootstrapIcon name="arrow-right" size={13} color="#EA580C" />
                    </TouchableOpacity>
                  </View>

                  <View style={[shopStyles.productGrid, { gap: gapSize }]}>
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
                        product.compare_at_price &&
                        Number(product.compare_at_price) > basePrice;
                      const hasDiscount = hasCompareDiscount || promoPct > 0;
                      const displayPrice =
                        promoPct > 0
                          ? basePrice * (1 - promoPct / 100)
                          : basePrice;
                      const comparePrice =
                        promoPct > 0
                          ? basePrice
                          : Number(product.compare_at_price || 0);
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

                      return (
                        <TouchableOpacity
                          key={product.id}
                          style={[
                            shopStyles.productCard,
                            { width: cardWidth },
                            isDarkMode && {
                              backgroundColor: '#1C1F23',
                              borderColor: '#2B3035',
                            },
                          ]}
                          className="cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1"
                          onPress={() => {
                            setSelectedProductForSpecs(product);
                            setIsSpecsOpen(true);
                          }}
                          activeOpacity={0.92}
                        >
                          {/* 1:1 Square Product Image (Without Compatibility Check Badge) */}
                          <View
                            style={[
                              shopStyles.productImgContainer,
                              isDarkMode && { backgroundColor: '#14171A' },
                            ]}
                          >
                            <Image
                              source={{ uri: product.image }}
                              style={shopStyles.productImg}
                              resizeMode="cover"
                            />

                            {/* Sold Out or Discount Badge */}
                            {soldOut ? (
                              <View
                                style={{
                                  position: 'absolute',
                                  left: 8,
                                  top: 8,
                                  backgroundColor: '#DC2626',
                                  paddingHorizontal: 7,
                                  paddingVertical: 2.5,
                                  borderRadius: 6,
                                  zIndex: 4,
                                }}
                              >
                                <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>
                                  SOLD OUT
                                </Text>
                              </View>
                            ) : hasDiscount ? (
                              <View style={shopStyles.productCardDiscountBadge}>
                                <Text style={shopStyles.productCardDiscountBadgeText}>
                                  -{itemDiscountPercent}%
                                </Text>
                              </View>
                            ) : null}

                            {/* Wishlist Button (Top-Right) */}
                            <TouchableOpacity
                              style={[
                                shopStyles.wishlistBtn,
                                isDarkMode && {
                                  backgroundColor: 'rgba(30, 34, 38, 0.9)',
                                  borderColor: '#2B3035',
                                },
                              ]}
                              onPress={(e) => {
                                e?.stopPropagation?.();
                                toggleWishlist(product.id);
                              }}
                              activeOpacity={0.8}
                              title={isFav ? 'Saved to Wishlist' : 'Save to Wishlist'}
                            >
                              <BootstrapIcon
                                name={isFav ? 'bookmark-fill' : 'bookmark'}
                                size={13}
                                color={isFav ? '#EA580C' : isDarkMode ? '#94A3B8' : '#64748B'}
                              />
                            </TouchableOpacity>
                          </View>

                          {/* Details */}
                          <View
                            style={[
                              shopStyles.productDetails,
                              isDarkMode && { backgroundColor: '#1C1F23' },
                            ]}
                          >
                            {/* Brand Name (Top of details, uppercase) */}
                            {product.brand ? (
                              <Text
                                style={[
                                  shopStyles.productBrandText,
                                  isDarkMode && { color: '#94A3B8' },
                                ]}
                                numberOfLines={1}
                              >
                                {product.brand.toUpperCase()}
                              </Text>
                            ) : null}

                            {/* Product Name */}
                            <Text
                              style={[
                                shopStyles.productName,
                                isDarkMode && { color: '#F9FAFB' },
                              ]}
                              numberOfLines={2}
                            >
                              {product.name}
                            </Text>

                            {/* Price Row */}
                            <View style={shopStyles.priceRow}>
                              <Text style={shopStyles.priceMainText}>
                                ₱{displayPrice.toFixed(2)}
                              </Text>
                              {hasDiscount && comparePrice > displayPrice && (
                                <Text style={shopStyles.priceOldText}>
                                  ₱{Number(comparePrice).toFixed(2)}
                                </Text>
                              )}
                            </View>

                            {/* Star Rating & In-Stock Line */}
                            <View style={shopStyles.metaMinimalRow}>
                              {hasRatings ? (
                                <View style={shopStyles.ratingMinimal}>
                                  <BootstrapIcon name="star-fill" size={9.5} color="#F59E0B" />
                                  <Text
                                    style={[
                                      shopStyles.ratingValText,
                                      isDarkMode && { color: '#CBD5E1' },
                                    ]}
                                  >
                                    {Number(product.rating || 5).toFixed(1)}
                                  </Text>
                                  <Text
                                    style={[
                                      shopStyles.reviewCountText,
                                      isDarkMode && { color: '#94A3B8' },
                                    ]}
                                  >
                                    ({product.reviews || 0})
                                  </Text>
                                </View>
                              ) : (
                                <View style={shopStyles.ratingMinimal}>
                                  <BootstrapIcon
                                    name="star"
                                    size={9.5}
                                    color={isDarkMode ? '#64748B' : '#94A3B8'}
                                  />
                                  <Text
                                    style={[
                                      shopStyles.unratedMinimalText,
                                      isDarkMode && { color: '#94A3B8' },
                                    ]}
                                  >
                                    No ratings yet
                                  </Text>
                                </View>
                              )}
                              <Text
                                style={[
                                  shopStyles.metaDotDivider,
                                  isDarkMode && { color: '#475569' },
                                ]}
                              >
                                •
                              </Text>
                              <Text
                                style={[
                                  shopStyles.stockMinimalText,
                                  soldOut && { color: '#DC2626' },
                                  isDarkMode && !soldOut && { color: '#34D399' },
                                ]}
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
            /* ─── TWO-COLUMN POPULATED CART LAYOUT ─── */
            <View
              style={[
                cStyles.cartLayoutRow,
                !isDesktop && { flexDirection: 'column' },
              ]}
            >
              {/* LEFT COLUMN: Cart Items List */}
              <View style={cStyles.cartItemsColumn}>
                {/* Select All Header Bar */}
                <View style={cStyles.selectAllBar}>
                  <TouchableOpacity
                    style={cStyles.selectAllTouch}
                    onPress={toggleSelectAll}
                    activeOpacity={0.75}
                  >
                    <View
                      style={[
                        cStyles.checkboxBox,
                        isAllSelected && cStyles.checkboxBoxChecked,
                      ]}
                    >
                      {isAllSelected && (
                        <BootstrapIcon name="check" size={14} color="#FFFFFF" />
                      )}
                    </View>
                    <Text style={cStyles.selectAllLabel}>
                      Select All ({cart.length} {cart.length === 1 ? 'item' : 'items'})
                    </Text>
                  </TouchableOpacity>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Text style={cStyles.selectedCountText}>
                      {hasSelectedItems
                        ? `${selectedCartItems.length} selected`
                        : '0 selected'}
                    </Text>

                    <View style={cStyles.toolbarDivider} />

                    <TouchableOpacity
                      style={cStyles.clearCartBtn}
                      onPress={() => {
                        clearCart?.();
                        showToast?.('Cart cleared');
                      }}
                      activeOpacity={0.7}
                    >
                      <BootstrapIcon
                        name="trash3"
                        size={13}
                        color={isDarkMode ? '#94A3B8' : '#64748B'}
                      />
                      <Text style={cStyles.clearCartBtnText}>Clear Cart</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Cart Line Item Cards */}
                <View style={cStyles.itemsListStack}>
                  {cart.map(({ product, quantity, size }, cIdx) => {
                    const lineSize = size || product.selectedSize || '';
                    const isChecked = isItemSelected(product.id, lineSize);
                    const itemPromo = getActiveProductPromo(product);
                    const itemPromoPct = Number(itemPromo?.discountPercent || 0);
                    const baseUnitPrice = Number(product.price || 0);
                    const effectiveUnitPrice =
                      itemPromoPct > 0
                        ? baseUnitPrice * (1 - itemPromoPct / 100)
                        : baseUnitPrice;
                    const lineTotal = effectiveUnitPrice * Number(quantity || 1);
                    const saved = isWishlisted?.(product.id);

                    return (
                      <View
                        key={
                          product.id
                            ? `cart-page-${product.id}-${lineSize || cIdx}`
                            : `cart-page-item-${cIdx}`
                        }
                        style={[
                          cStyles.cartItemCard,
                          !isChecked && { opacity: 0.65 },
                        ]}
                      >
                        <View
                          style={[
                            cStyles.cartItemMainRow,
                            isMobile && { alignItems: 'flex-start' },
                          ]}
                        >
                          {/* Checkbox */}
                          <TouchableOpacity
                            style={cStyles.itemCheckboxWrap}
                            onPress={() => toggleSelectItem(product.id, lineSize)}
                            activeOpacity={0.7}
                          >
                            <View
                              style={[
                                cStyles.checkboxBox,
                                isChecked && cStyles.checkboxBoxChecked,
                              ]}
                            >
                              {isChecked && (
                                <BootstrapIcon name="check" size={14} color="#FFFFFF" />
                              )}
                            </View>
                          </TouchableOpacity>

                          {/* Product Image */}
                          <View style={cStyles.itemThumbContainer}>
                            <Image
                              source={{ uri: product.image }}
                              style={cStyles.itemThumb}
                              resizeMode="cover"
                            />
                          </View>

                          {/* Product Info */}
                          <View style={cStyles.itemDetailsCol}>
                            <View style={cStyles.itemMetaTopRow}>
                              <Text style={cStyles.itemBrandText} numberOfLines={1}>
                                {product.brand || 'MOTOTRACK'}
                                {product.category ? ` · ${product.category}` : ''}
                                {lineSize ? ` · Size ${lineSize}` : ''}
                              </Text>
                            </View>

                            <Text style={cStyles.itemTitleText} numberOfLines={2}>
                              {product.name}
                            </Text>

                            <View style={cStyles.itemUnitPriceRow}>
                              <Text style={cStyles.itemUnitPriceText}>
                                {formatPhpAmount(effectiveUnitPrice)}
                                {quantity > 1 ? ' each' : ''}
                              </Text>
                              {itemPromoPct > 0 && (
                                <>
                                  <Text
                                    style={[
                                      cStyles.itemUnitPriceText,
                                      { textDecorationLine: 'line-through', opacity: 0.6 },
                                    ]}
                                  >
                                    {formatPhpAmount(baseUnitPrice)}
                                  </Text>
                                  <Text style={cStyles.itemPromoDiscountTag}>
                                    −{Math.round(itemPromoPct)}%
                                  </Text>
                                </>
                              )}
                            </View>
                          </View>

                          {/* Right Side: Quantity Controls + Line Subtotal + Actions */}
                          <View
                            style={[
                              cStyles.itemRightCol,
                              isMobile && {
                                width: '100%',
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginTop: 12,
                                paddingTop: 12,
                                borderTopWidth: 1,
                                borderTopColor: isDarkMode ? '#262D35' : '#F1F5F9',
                              },
                            ]}
                          >
                            <Text style={cStyles.itemLineTotalText}>
                              {formatPhpAmount(lineTotal)}
                            </Text>

                            <View style={cStyles.itemControlsRow}>
                              <View style={cStyles.qtyControlGroup}>
                                <TouchableOpacity
                                  style={cStyles.qtyStepBtn}
                                  onPress={() =>
                                    updateCartQuantity(product.id, -1, lineSize)
                                  }
                                  activeOpacity={0.75}
                                >
                                  <BootstrapIcon
                                    name="dash"
                                    size={14}
                                    color={isDarkMode ? '#E2E8F0' : '#0F172A'}
                                  />
                                </TouchableOpacity>

                                <Text style={cStyles.qtyValueText}>{quantity}</Text>

                                <TouchableOpacity
                                  style={cStyles.qtyStepBtn}
                                  onPress={() =>
                                    updateCartQuantity(product.id, 1, lineSize)
                                  }
                                  activeOpacity={0.75}
                                >
                                  <BootstrapIcon
                                    name="plus"
                                    size={14}
                                    color={isDarkMode ? '#E2E8F0' : '#0F172A'}
                                  />
                                </TouchableOpacity>
                              </View>

                              {/* Save to Wishlist button */}
                              <TouchableOpacity
                                style={cStyles.iconActionBtn}
                                onPress={() => toggleWishlist?.(product.id)}
                                title={saved ? 'Saved in Wishlist' : 'Save to Wishlist'}
                                activeOpacity={0.75}
                              >
                                <BootstrapIcon
                                  name={saved ? 'bookmark-fill' : 'bookmark'}
                                  size={14}
                                  color={saved ? '#EA580C' : '#94A3B8'}
                                />
                              </TouchableOpacity>

                              {/* Remove from Cart button */}
                              <TouchableOpacity
                                style={cStyles.iconActionBtn}
                                onPress={() => removeFromCart(product.id, lineSize)}
                                title="Remove item"
                                activeOpacity={0.75}
                              >
                                <BootstrapIcon
                                  name="trash3"
                                  size={14}
                                  color="#94A3B8"
                                />
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* RIGHT COLUMN: Order Summary */}
              <View
                style={[
                  cStyles.summaryColumn,
                  !isDesktop && { width: '100%' },
                ]}
              >
                <View style={cStyles.summaryCard}>
                  <Text style={cStyles.summaryTitle}>Order Summary</Text>

                  <View style={cStyles.summaryDivider} />

                  {/* Financial Breakdown */}
                  <View style={cStyles.summaryLineRow}>
                    <Text style={cStyles.summaryLineLabel}>
                      Subtotal ({selectedCartItemCount}{' '}
                      {selectedCartItemCount === 1 ? 'item' : 'items'})
                    </Text>
                    <Text style={cStyles.summaryLineValue}>
                      {formatPhpAmount(selectedCartSubtotal)}
                    </Text>
                  </View>

                  {selectedDiscountAmount > 0 && (
                    <View style={cStyles.summaryLineRow}>
                      <Text style={[cStyles.summaryLineLabel, { color: '#16A34A' }]}>
                        Promo Discount
                        {discountPercent > 0 ? ` (−${discountPercent}%)` : ''}
                      </Text>
                      <Text style={[cStyles.summaryLineValue, { color: '#16A34A' }]}>
                        −{formatPhpAmount(selectedDiscountAmount)}
                      </Text>
                    </View>
                  )}

                  <View style={cStyles.summaryLineRow}>
                    <Text style={cStyles.summaryLineLabel}>Shipping</Text>
                    <Text style={cStyles.summaryLineValue}>
                      {selectedCartItems.length === 0
                        ? '₱0.00'
                        : formatPhpAmount(
                            isFreeShipping ? shippingRate : selectedShippingFee
                          )}
                    </Text>
                  </View>

                  {isFreeShipping && selectedCartItems.length > 0 && (
                    <View style={cStyles.summaryLineRow}>
                      <Text style={[cStyles.summaryLineLabel, { color: '#16A34A' }]}>
                        Free Shipping Promo
                      </Text>
                      <Text style={[cStyles.summaryLineValue, { color: '#16A34A' }]}>
                        −{formatPhpAmount(shippingRate || 0)}
                      </Text>
                    </View>
                  )}

                  <View style={cStyles.summaryDivider} />

                  <View style={cStyles.summaryTotalRow}>
                    <Text style={cStyles.summaryTotalLabel}>Total</Text>
                    <Text style={cStyles.summaryTotalValue}>
                      {formatPhpAmount(selectedCartTotal)}
                    </Text>
                  </View>

                  {/* Checkout CTA */}
                  <TouchableOpacity
                    style={[
                      cStyles.checkoutPrimaryBtn,
                      !hasSelectedItems && cStyles.checkoutPrimaryBtnDisabled,
                    ]}
                    onPress={handleCheckoutPress}
                    activeOpacity={0.9}
                  >
                    <Text style={cStyles.checkoutPrimaryBtnText}>
                      {hasSelectedItems
                        ? `Proceed to Checkout (${selectedCartItemCount})`
                        : 'Select Items to Checkout'}
                    </Text>
                    <BootstrapIcon name="arrow-right" size={15} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Product Specs Modal */}
      <ProductSpecsModal
        visible={isSpecsOpen}
        product={selectedProductForSpecs}
        onClose={() => setIsSpecsOpen(false)}
        onAddToCart={(prod, qty = 1, opts = {}) => addToCart(prod, qty, opts)}
      />

      {/* Mobile Nav Drawer */}
      <CustomerMobileNavDrawer
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
        currentScreen="cart"
        onNavigateToScreen={(screen, params) => {
          setIsMobileNavOpen(false);
          navigateFromCart(screen, params);
        }}
        unreadNotifCount={unreadNotifCount}
      />
    </View>
  );
}

function createCartPageStyles(isDark = false) {
  return StyleSheet.create({
    pageOverlay: {
      flex: 1,
      width: '100%',
      maxWidth: '100vw',
      overflowX: 'hidden',
      minHeight: '100%',
      backgroundColor: isDark ? '#11151A' : '#F3F4F6',
      ...(Platform.OS === 'web'
        ? {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 900,
          }
        : {}),
    },
    scrollContent: {
      paddingTop: 0,
      paddingBottom: 56,
      paddingHorizontal: 0,
    },
    headerWrapper: {
      backgroundColor: isDark ? '#181B1F' : '#1E2227',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      position: 'sticky',
      top: 0,
      left: 0,
      right: 0,
      width: '100%',
      maxWidth: '100vw',
      alignSelf: 'stretch',
      zIndex: 1000,
      boxShadow: 'none',
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.08)',
      minHeight: 67,
      transform: 'translateZ(0)',
      WebkitTransform: 'translateZ(0)',
      willChange: 'transform',
      boxSizing: 'border-box',
    },
    headerInner: {
      maxWidth: 1360,
      marginHorizontal: 'auto',
      width: '100%',
      paddingHorizontal: 24,
      paddingVertical: 12,
      minHeight: 66,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 20,
      boxSizing: 'border-box',
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: 16,
      flexShrink: 0,
    },
    mobileNavToggleBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: 'rgba(255, 255, 255, 0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      marginRight: 6,
    },
    logoWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      textDecorationLine: 'none',
      flexShrink: 0,
      cursor: 'pointer',
    },
    headerCenterNav: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
    },
    headerCenterBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 38,
      gap: 7,
      paddingHorizontal: 12,
      borderRadius: 6,
      cursor: 'pointer',
      backgroundColor: 'transparent',
      flexShrink: 0,
    },
    headerCenterBtnText: {
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 20,
      color: 'rgba(255, 255, 255, 0.85)',
      whiteSpace: 'nowrap',
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 12,
      flexShrink: 0,
    },
    navActionIconBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: 'transparent',
      borderWidth: 0,
      borderColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      cursor: 'pointer',
    },
    navBadgeCircle: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: '#EF4444',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
      borderWidth: 2,
      borderColor: '#24272B',
      zIndex: 10,
    },
    navBadgeText: {
      color: '#FFFFFF',
      fontSize: 9.5,
      fontWeight: '600',
      lineHeight: 12,
    },
    loggedInContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    signInHeaderBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.45)',
      flexShrink: 0,
      cursor: 'pointer',
    },
    signInHeaderBtnText: {
      fontSize: 13.5,
      fontWeight: '600',
      color: '#FFFFFF',
      whiteSpace: 'nowrap',
    },
    maxContainer: {
      maxWidth: 1360,
      marginHorizontal: 'auto',
      width: '100%',
      paddingHorizontal: 24,
      paddingTop: 22,
    },
    breadcrumbRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 18,
      flexWrap: 'wrap',
      gap: 10,
    },
    backToShopBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: isDark ? '#1C2127' : '#FFFFFF',
      borderWidth: 1,
      borderColor: isDark ? '#2B323B' : '#E2E8F0',
      cursor: 'pointer',
    },
    backToShopText: {
      fontSize: 12.5,
      fontWeight: '600',
      color: isDark ? '#E2E8F0' : '#334155',
    },
    breadcrumbTrail: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    breadcrumbMuted: {
      fontSize: 12,
      fontWeight: '400',
      color: '#64748B',
    },
    breadcrumbActive: {
      fontSize: 12,
      fontWeight: '600',
      color: isDark ? '#F8FAFC' : '#0F172A',
    },
    pageHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 20,
      flexWrap: 'wrap',
      gap: 14,
    },
    pageHeaderIconBox: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(234, 88, 12, 0.14)' : '#FFF7ED',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(234, 88, 12, 0.35)' : '#FED7AA',
      alignItems: 'center',
      justifyContent: 'center',
    },
    pageTitle: {
      fontSize: 20,
      fontWeight: '700',
      lineHeight: 26,
      letterSpacing: -0.25,
      color: isDark ? '#F8FAFC' : '#0F172A',
    },
    pageSub: {
      fontSize: 13,
      fontWeight: '400',
      lineHeight: 18,
      color: isDark ? '#94A3B8' : '#64748B',
      marginTop: 2,
      fontVariant: ['tabular-nums'],
    },
    headerBatchActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap',
    },
    secondaryBatchBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: isDark ? '#1C2127' : '#FFFFFF',
      borderWidth: 1,
      borderColor: isDark ? '#2B323B' : '#E2E8F0',
      cursor: 'pointer',
    },
    clearCartBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 4,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: 'transparent',
      cursor: 'pointer',
    },
    clearCartBtnText: {
      fontSize: 12.5,
      fontWeight: '500',
      color: isDark ? '#94A3B8' : '#64748B',
    },
    emptyStateCard: {
      backgroundColor: 'transparent',
      paddingVertical: 36,
      paddingHorizontal: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
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
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '600',
      lineHeight: 22,
      color: isDark ? '#F8FAFC' : '#0F172A',
      marginBottom: 6,
    },
    emptySub: {
      fontSize: 13,
      fontWeight: '400',
      lineHeight: 19,
      color: isDark ? '#94A3B8' : '#64748B',
      textAlign: 'center',
      maxWidth: 440,
      marginBottom: 22,
    },
    emptyActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      flexWrap: 'wrap',
      marginBottom: 28,
    },
    primaryExploreBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: '#EA580C',
      paddingHorizontal: 18,
      paddingVertical: 11,
      borderRadius: 10,
      cursor: 'pointer',
    },
    primaryExploreBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    secondaryExploreBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: isDark ? '#222831' : '#F8FAFC',
      borderWidth: 1,
      borderColor: isDark ? '#2E3642' : '#CBD5E1',
      paddingHorizontal: 16,
      paddingVertical: 11,
      borderRadius: 10,
      cursor: 'pointer',
    },
    secondaryExploreBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? '#F8FAFC' : '#1E293B',
    },
    emptyTrustRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
      flexWrap: 'wrap',
      paddingTop: 20,
      borderTopWidth: 1,
      borderTopColor: isDark ? '#262D35' : '#F1F5F9',
      width: '100%',
      maxWidth: 640,
    },
    emptyTrustItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    emptyTrustText: {
      fontSize: 12,
      fontWeight: '500',
      color: isDark ? '#94A3B8' : '#64748B',
    },
    suggestedSection: {
      marginTop: 4,
    },
    suggestedHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
      flexWrap: 'wrap',
      gap: 8,
    },
    sectionHeaderText: {
      fontSize: 16,
      fontWeight: '600',
      lineHeight: 22,
      color: isDark ? '#F8FAFC' : '#0F172A',
    },
    sectionSubText: {
      fontSize: 12,
      fontWeight: '400',
      color: isDark ? '#94A3B8' : '#64748B',
      marginTop: 2,
    },
    suggestedGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 14,
    },
    suggestedCard: {
      backgroundColor: isDark ? '#181C22' : '#FFFFFF',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isDark ? '#262D35' : '#E2E8F0',
      overflow: 'hidden',
    },
    suggestedThumbWrap: {
      width: '100%',
      height: 140,
      backgroundColor: isDark ? '#12151A' : '#F8FAFC',
    },
    suggestedThumb: {
      width: '100%',
      height: '100%',
    },
    suggestedBody: {
      padding: 12,
    },
    suggestedBrand: {
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: '#64748B',
      marginBottom: 2,
    },
    suggestedTitle: {
      fontSize: 13.5,
      fontWeight: '600',
      lineHeight: 19,
      color: isDark ? '#F8FAFC' : '#0F172A',
      marginBottom: 6,
    },
    suggestedPrice: {
      fontSize: 14,
      fontWeight: '700',
      color: '#EA580C',
      fontVariant: ['tabular-nums'],
      marginBottom: 10,
    },
    suggestedAddBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: '#EA580C',
      paddingVertical: 8,
      borderRadius: 8,
      cursor: 'pointer',
    },
    suggestedAddBtnText: {
      fontSize: 12.5,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    cartLayoutRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 22,
    },
    cartItemsColumn: {
      flex: 1,
      width: '100%',
      minWidth: 0,
    },
    selectAllBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? '#181C22' : '#FFFFFF',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? '#262D35' : '#E2E8F0',
      paddingHorizontal: 18,
      paddingVertical: 12,
      marginBottom: 12,
    },
    selectAllTouch: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      cursor: 'pointer',
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
      color: isDark ? '#F8FAFC' : '#0F172A',
    },
    selectedCountText: {
      fontSize: 12.5,
      fontWeight: '500',
      color: isDark ? '#94A3B8' : '#64748B',
      fontVariant: ['tabular-nums'],
    },
    toolbarDivider: {
      width: 1,
      height: 14,
      backgroundColor: isDark ? '#262D35' : '#E2E8F0',
    },
    itemsListStack: {
      gap: 12,
    },
    cartItemCard: {
      backgroundColor: isDark ? '#181C22' : '#FFFFFF',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isDark ? '#262D35' : '#E2E8F0',
      paddingHorizontal: 18,
      paddingVertical: 16,
    },
    cartItemMainRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      flexWrap: 'wrap',
    },
    itemCheckboxWrap: {
      paddingVertical: 6,
      paddingRight: 2,
      cursor: 'pointer',
    },
    itemThumbContainer: {
      width: 80,
      height: 80,
      borderRadius: 10,
      backgroundColor: isDark ? '#11151A' : '#F8FAFC',
      borderWidth: 1,
      borderColor: isDark ? '#262D35' : '#F1F5F9',
      overflow: 'hidden',
      flexShrink: 0,
    },
    itemThumb: {
      width: '100%',
      height: '100%',
    },
    itemDetailsCol: {
      flex: 1,
      minWidth: 180,
    },
    itemMetaTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    itemBrandText: {
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: isDark ? '#94A3B8' : '#64748B',
    },
    itemTitleText: {
      fontSize: 14.5,
      fontWeight: '600',
      lineHeight: 20,
      color: isDark ? '#F8FAFC' : '#0F172A',
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
      fontWeight: '400',
      color: isDark ? '#94A3B8' : '#64748B',
      fontVariant: ['tabular-nums'],
    },
    itemPromoDiscountTag: {
      fontSize: 11.5,
      fontWeight: '600',
      color: '#16A34A',
      fontVariant: ['tabular-nums'],
    },
    itemRightCol: {
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 10,
    },
    itemLineTotalText: {
      fontSize: 15,
      fontWeight: '700',
      color: isDark ? '#F8FAFC' : '#0F172A',
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
      borderColor: isDark ? '#2B323B' : '#E2E8F0',
      borderRadius: 8,
      height: 34,
      overflow: 'hidden',
    },
    qtyStepBtn: {
      width: 32,
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
    },
    qtyValueText: {
      minWidth: 28,
      textAlign: 'center',
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? '#F8FAFC' : '#0F172A',
      fontVariant: ['tabular-nums'],
    },
    iconActionBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
    },
    summaryColumn: {
      width: 380,
      flexShrink: 0,
    },
    summaryCard: {
      backgroundColor: isDark ? '#181C22' : '#FFFFFF',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDark ? '#262D35' : '#E2E8F0',
      padding: 22,
    },
    summaryTitle: {
      fontSize: 16,
      fontWeight: '600',
      lineHeight: 22,
      color: isDark ? '#F8FAFC' : '#0F172A',
      marginBottom: 2,
    },
    promoSection: {
      marginBottom: 14,
    },
    promoSectionLabel: {
      fontSize: 10.5,
      fontWeight: '600',
      letterSpacing: 0.4,
      color: isDark ? '#94A3B8' : '#64748B',
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
      gap: 6,
      backgroundColor: isDark ? '#11151A' : '#F8FAFC',
      borderWidth: 1,
      borderColor: isDark ? '#2B323B' : '#CBD5E1',
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      cursor: 'pointer',
    },
    promoChipSelected: {
      backgroundColor: '#EA580C',
      borderColor: '#EA580C',
    },
    promoChipText: {
      fontSize: 11.5,
      fontWeight: '500',
      color: isDark ? '#E2E8F0' : '#0F172A',
    },
    promoInputBlock: {
      marginBottom: 4,
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
      borderColor: isDark ? '#2B323B' : '#CBD5E1',
      borderRadius: 8,
      paddingHorizontal: 12,
      fontSize: 13,
      color: isDark ? '#F8FAFC' : '#0F172A',
    },
    promoApplyBtn: {
      backgroundColor: isDark ? '#262D35' : '#1E2227',
      paddingHorizontal: 16,
      height: 40,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
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
      backgroundColor: isDark ? '#262D35' : '#F1F5F9',
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
      fontWeight: '400',
      color: isDark ? '#94A3B8' : '#64748B',
    },
    summaryLineValue: {
      fontSize: 13.5,
      fontWeight: '600',
      color: isDark ? '#F8FAFC' : '#0F172A',
      fontVariant: ['tabular-nums'],
    },
    summaryTotalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 18,
    },
    summaryTotalLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: isDark ? '#F8FAFC' : '#0F172A',
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
      cursor: 'pointer',
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

