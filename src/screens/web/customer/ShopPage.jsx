import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

// ─── SERVICES & DATA ────────────────────────────────────────────────────────
import { productService } from '../../../services/products/productService.js';
import { databaseService } from '../../../services/system/databaseService.js';
import { orderService } from '../../../services/orders/orderService.js';
import { notificationService } from '../../../services/notifications/notificationService.js';
import { systemSettingsService } from '../../../services/system/systemSettingsService.js';

// ─── CONTEXTS ───────────────────────────────────────────────────────────────
import { useAuth } from '../../../context/AuthContext.jsx';
import { useCart } from '../../../context/CartContext.jsx';
import { useWishlist } from '../../../context/WishlistContext.jsx';
import { useTheme } from '../../../context/ThemeContext.jsx';
import { productNeedsSizes, withSelectedSize, isSizeSoldOut } from '../../../utils/productSizes.js';
import { resolveReorderLevel } from '../../../utils/inventoryHelpers.js';
import { getRatedScore, productHasCustomerRatings } from '../../../utils/productCatalog.js';

// ─── COMPONENTS & MODALS ───────────────────────────────────────────────────
import {
  BootstrapIcon,
  BottomNavBar,
  ToastNotification,
  ProductSpecsModal,
  CartModal,
  CheckoutModal,
  ProfileModal,
  AccessDeniedModal,
  LiveOrderTrackingMapModal,
  GCashPaymentModal,
  CompanyInfoModal,
} from '../../../components';
import {
  UserProfileDropdown,
  UserProfileButton,
  BrandLogo,
  NotificationDropdown,
  ProductCardSkeleton,
} from '../../../components/common';
import HeroBanner from '../../../components/shop/HeroBanner.jsx';
import CompatibilityIndicator from '../../../components/shop/CompatibilityIndicator.jsx';
import {
  compatibilityService,
  COMPAT_STATUS,
} from '../../../services/products/compatibilityService.js';
import { createShopWebStyles } from '../../../styles/web/shopPage.web.styles.js';

export default function ShopPageWeb({ onNavigateToScreen, onNavigateToWishlist: propOnNavigateToWishlist }) {
  const handleNavigateToWishlist = propOnNavigateToWishlist || (() => onNavigateToScreen?.('wishlist'));
  const { isDarkMode, toggleDarkMode, tokens } = useTheme();
  const webStyles = useMemo(() => createShopWebStyles(isDarkMode), [isDarkMode]);
  const { width: windowWidth } = useWindowDimensions();
  const { currentUser, logout, setRedirectReason } = useAuth();
  const {
    cart,
    addToCart,
    clearCart,
    removeSelectedFromCart,
    selectedCartItems,
    selectedCartItemCount,
    selectedCartSubtotal,
    selectedDiscountAmount,
    selectedShippingFee,
    selectedCartTotal,
    cartItemCount,
    cartTotal,
    cartSubtotal,
    discountAmount,
    shippingFee,
    shippingRate,
    isFreeShipping,
    appliedPromoId,
    toastMessage,
    showToast,
  } = useCart();
  const { isWishlisted, toggleWishlist, wishlistCount } = useWishlist();

  // Products & Filter state
  const [productsList, setProductsList] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSort, setFilterSort] = useState('all');
  const [buyNowFreeShipping, setBuyNowFreeShipping] = useState(false);
  const [buyNowFreeShippingPromoId, setBuyNowFreeShippingPromoId] = useState(null);
  const [activeBike, setActiveBike] = useState(null);
  const [userBikes, setUserBikes] = useState([]);
  const [isBikeDropdownOpen, setIsBikeDropdownOpen] = useState(false);
  const [compatMap, setCompatMap] = useState(null);
  const [compatOnly, setCompatOnly] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);

  // Modal states
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isSpecsOpen, setIsSpecsOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);
  const [isAccessDeniedModalOpen, setIsAccessDeniedModalOpen] = useState(false);
  const [selectedOrderForTracking, setSelectedOrderForTracking] = useState(null);
  const [isLiveTrackingOpen, setIsLiveTrackingOpen] = useState(false);
  const [isGcashModalOpen, setIsGcashModalOpen] = useState(false);
  const [pendingGcashOrderData, setPendingGcashOrderData] = useState(null);
  const [buyNowItems, setBuyNowItems] = useState(null);
  const [unreadNotifCount, setUnreadNotifCount] = useState(() =>
    currentUser ? notificationService.getUnreadCount(currentUser) : 0
  );
  const [isCompanyInfoOpen, setIsCompanyInfoOpen] = useState(false);
  const [companyInfoTab, setCompanyInfoTab] = useState('about');
  const [brandSettings, setBrandSettings] = useState(() => systemSettingsService.getSettings());

  useEffect(() => {
    const unsub = systemSettingsService.subscribe(setBrandSettings);
    return unsub;
  }, []);

  const handleOpenCompanyInfo = (tab = 'about') => {
    setCompanyInfoTab(tab);
    setIsCompanyInfoOpen(true);
  };

  const isBuyNowCheckout = Array.isArray(buyNowItems) && buyNowItems.length > 0;
  const checkoutItems = isBuyNowCheckout ? buyNowItems : selectedCartItems;
  const checkoutSubtotal = isBuyNowCheckout
    ? buyNowItems.reduce((sum, item) => sum + Number(item.product?.price || 0) * Number(item.quantity || 0), 0)
    : selectedCartSubtotal;
  const checkoutShipping = isBuyNowCheckout
    ? buyNowFreeShipping
      ? 0
      : Number(shippingRate || 150)
    : selectedShippingFee;
  const checkoutDiscount = isBuyNowCheckout ? 0 : selectedDiscountAmount;
  const checkoutTotal = isBuyNowCheckout
    ? Math.max(0, checkoutSubtotal - checkoutDiscount) + Number(checkoutShipping || 0)
    : selectedCartTotal;
  const checkoutItemCount = isBuyNowCheckout
    ? buyNowItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
    : selectedCartItemCount;

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!isBuyNowCheckout) {
        setBuyNowFreeShipping(false);
        setBuyNowFreeShippingPromoId(null);
        return;
      }
      try {
        const { promoService } = await import('../../../services/products/promoService.js');
        const match = await promoService.findApplicableFreeShipping(
          buyNowItems,
          Number(shippingRate || 150)
        );
        if (!cancelled) {
          setBuyNowFreeShipping(Boolean(match));
          setBuyNowFreeShippingPromoId(match?.promoId || null);
        }
      } catch {
        if (!cancelled) {
          setBuyNowFreeShipping(false);
          setBuyNowFreeShippingPromoId(null);
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [isBuyNowCheckout, buyNowItems, shippingRate]);

  useEffect(() => {
    const unsub = notificationService.subscribe(() => {
      setUnreadNotifCount(
        currentUser ? notificationService.getUnreadCount(currentUser) : 0
      );
    });
    return () => unsub?.();
  }, [currentUser?.id, currentUser?.customer_id, currentUser?.email]);

  // Load products & subscribe to real-time inventory
  useEffect(() => {
    let alive = true;
    productService
      .getProducts()
      .then((data) => {
        if (alive && Array.isArray(data)) setProductsList(data);
      })
      .finally(() => {
        if (alive) setIsLoadingProducts(false);
      });
    const unsubscribe = productService.subscribe((updated) => {
      if (alive && Array.isArray(updated)) {
        setProductsList(updated);
        setIsLoadingProducts(false);
      }
    });
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, []);

  // One cached compatibility matrix and customer motorcycles list for the whole shop
  useEffect(() => {
    let alive = true;
    (async () => {
      const map = await compatibilityService.getCompatibilityMap();
      if (alive) setCompatMap(map);
      const userId = currentUser?.id || currentUser?.user_id || currentUser?.customer_id;
      if (userId) {
        try {
          const [bike, list] = await Promise.all([
            compatibilityService.getActiveMotorcycle(userId),
            compatibilityService.listCustomerMotorcycles(userId),
          ]);
          if (alive) {
            setUserBikes(list || []);
            setActiveBike(bike || (list && list[0]) || null);
          }
        } catch (_e) {
          if (alive) {
            setUserBikes([]);
            setActiveBike(null);
          }
        }
      } else if (alive) {
        setUserBikes([]);
        setActiveBike(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [currentUser?.id, currentUser?.user_id, currentUser?.customer_id]);

  const handleSelectBike = async (bike) => {
    setIsBikeDropdownOpen(false);
    if (!bike) {
      setActiveBike(null);
      setCompatOnly(false);
      showToast('Showing parts for all motorcycles');
      return;
    }
    setActiveBike(bike);
    const userId = currentUser?.id || currentUser?.user_id || currentUser?.customer_id;
    if (userId && bike.motorcycle_id) {
      try {
        await compatibilityService.setActiveMotorcycle(bike.motorcycle_id, userId);
      } catch (_e) {}
    }
    showToast(`${bike.brand} ${bike.model} selected`);
  };

  const categories = useMemo(() => {
    const prods = Array.isArray(productsList) ? productsList : [];
    const cats = ['All', ...new Set(prods.map((p) => p.category).filter(Boolean))];
    return cats;
  }, [productsList]);

  // Filtered & Sorted products list (+ optional compatible-only filter)
  const filteredProducts = useMemo(() => {
    const prods = Array.isArray(productsList) ? productsList : [];
    const map = compatMap || new Map();
    let list = prods.filter((item) => {
      const matchCategory =
        selectedCategory === 'All' || item.category.toLowerCase() === selectedCategory.toLowerCase();
      const query = searchQuery.toLowerCase().trim();
      const matchSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.brand.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query);

      return matchCategory && matchSearch;
    });

    list = compatibilityService.annotateProducts(list, activeBike, map);

    if (compatOnly && activeBike) {
      list = list.filter((p) => p.compatStatus === COMPAT_STATUS.COMPATIBLE);
    }

    if (filterSort === 'price-low') {
      list = [...list].sort((a, b) => a.price - b.price);
    } else if (filterSort === 'price-high') {
      list = [...list].sort((a, b) => b.price - a.price);
    } else if (filterSort === 'rating') {
      list = [...list].sort((a, b) => getRatedScore(b) - getRatedScore(a));
    }

    return list;
  }, [productsList, selectedCategory, searchQuery, filterSort, activeBike, compatMap, compatOnly]);

  const handleAddToCartAttempt = (product, qty = 1, options = {}) => {
    if (!currentUser) {
      setRedirectReason('Please sign in to add performance items to your cart.');
      onNavigateToScreen?.('login');
      return;
    }
    const size = options.size || product?.selectedSize || '';
    if (productNeedsSizes(product) && !size) {
      setSelectedProduct(product);
      setIsSpecsOpen(true);
      showToast('Select a size for this product');
      return;
    }
    if (size && isSizeSoldOut(product, size)) {
      setSelectedProduct(product);
      setIsSpecsOpen(true);
      showToast(`Size ${size} is sold out`);
      return;
    }
    const warn =
      product.compatStatus === COMPAT_STATUS.INCOMPATIBLE && activeBike
        ? `⚠ This part is not marked as compatible with your ${compatibilityService.bikeLabel(activeBike)}.`
        : null;
    addToCart(product, qty, { size, compatWarning: warn });
  };

  const handleBuyNowAttempt = (product, qty = 1, options = {}) => {
    if (!currentUser) {
      setRedirectReason('Please sign in or create an account to buy this item.');
      onNavigateToScreen?.('login');
      return;
    }
    const size = options.size || product?.selectedSize || '';
    if (productNeedsSizes(product) && !size) {
      setSelectedProduct(product);
      setIsSpecsOpen(true);
      showToast('Select a size for this product');
      return;
    }
    if (size && isSizeSoldOut(product, size)) {
      setSelectedProduct(product);
      setIsSpecsOpen(true);
      showToast(`Size ${size} is sold out`);
      return;
    }
    const stock = Number(product?.stock);
    if (Number.isFinite(stock) && stock <= 0) {
      showToast(`"${product.name?.slice(0, 20) || 'Item'}..." is out of stock`);
      return;
    }
    const quantity = Math.min(Math.max(1, qty), Number.isFinite(stock) ? stock : qty);
    const sizedProduct = size ? withSelectedSize(product, size) : product;
    setBuyNowItems([{ product: sizedProduct, quantity, size }]);
    setIsCartOpen(false);
    setIsSpecsOpen(false);
    setIsCheckoutOpen(true);
  };

  const handleProceedToCheckout = () => {
    if (!currentUser) {
      setIsCartOpen(false);
      setRedirectReason('Please sign in to complete your checkout and delivery.');
      onNavigateToScreen?.('login');
      return;
    }
    if (selectedCartItems.length === 0) {
      showToast('Please select at least one item to checkout');
      return;
    }
    setBuyNowItems(null);
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  const handleCompleteOrder = async (orderFormData) => {
    const { paymentMethod } = orderFormData;

    // 1. If GCash is selected, launch GCash Interactive Test Gateway Portal
    if (paymentMethod === 'GCash') {
      setPendingGcashOrderData(orderFormData);
      setIsCheckoutOpen(false);
      setIsGcashModalOpen(true);
      return;
    }

    // 2. Card / PayPal — prepaid path (demo confirmation, no COD approval)
    const prepaid =
      paymentMethod === 'Credit / Debit Card' ||
      paymentMethod === 'PayPal' ||
      (paymentMethod || '').toLowerCase().includes('card') ||
      (paymentMethod || '').toLowerCase().includes('paypal');

    if (prepaid) {
      await executeCreateOrder(orderFormData, 'Processing');
      return;
    }

    // 3. Otherwise handle standard COD
    await executeCreateOrder(orderFormData);
  };

  const handleGcashPaymentSuccess = async (paymentReceipt) => {
    const orderData = {
      ...pendingGcashOrderData,
      gcashReference: paymentReceipt.referenceNumber,
      paymentMethod: 'GCash',
    };
    await executeCreateOrder(orderData, 'Processing');
  };

  const executeCreateOrder = async (orderFormData, overrideStatus = null) => {
    if (isPlacingOrder) return { success: false };

    const {
      customerName,
      customerPhone,
      customerAddress,
      deliveryNotes,
      paymentMethod,
      gcashNumber,
      gcashReference,
      codChangeFor,
    } = orderFormData;

    const isCOD =
      (paymentMethod || '').toLowerCase().includes('cash') || (paymentMethod || '').includes('COD');

    setIsPlacingOrder(true);
    try {
      const res = await orderService.createOrder({
        userId: currentUser?.user_id || currentUser?.id || null,
        customerId: currentUser?.customer_id || currentUser?.user_id || currentUser?.id || null,
        customerName,
        customerPhone,
        customerEmail: currentUser?.email || null,
        customerAddress,
        deliveryNotes,
        paymentMethod,
        gcashNumber,
        gcashReference,
        codChangeFor,
        promoId: isBuyNowCheckout
          ? buyNowFreeShipping
            ? buyNowFreeShippingPromoId || null
            : null
          : appliedPromoId || null,
        total: checkoutSubtotal.toFixed(2),
        discountAmount: checkoutDiscount.toFixed(2),
        shippingFee: Number(checkoutShipping || 0),
        grandTotal: checkoutTotal.toFixed(2),
        items: checkoutItems,
        channel: 'Online Store',
        overrideStatus,
      });

      if (!res?.success) {
        showToast(res?.error || 'Could not place order. Please try again.');
        return res;
      }

      const placedOrder = res.order;
      if (isBuyNowCheckout) {
        setBuyNowItems(null);
      } else {
        removeSelectedFromCart();
      }
      setIsCheckoutOpen(false);
      setIsGcashModalOpen(false);
      setSelectedOrderForTracking(placedOrder);
      setIsLiveTrackingOpen(true);
      showToast(
        !res.supabaseSynced
          ? '📦 Order saved offline — will sync when connection is back.'
          : isCOD
            ? '🎉 COD Order placed! Awaiting Store Admin verification.'
            : paymentMethod === 'PayPal'
              ? '🎉 PayPal payment confirmed! Live order tracking active.'
              : paymentMethod === 'Credit / Debit Card' ||
                  (paymentMethod || '').toLowerCase().includes('card')
                ? '🎉 Card payment confirmed! Live order tracking active.'
                : '🎉 GCash Payment Confirmed! Live order tracking active.'
      );
      return res;
    } catch (e) {
      console.warn('[ShopPage] place order failed:', e);
      showToast('Could not place order. Please try again.');
      return { success: false, error: e?.message || 'Order failed' };
    } finally {
      setIsPlacingOrder(false);
    }
  };

  // Balanced grid columns: not too big, not too small
  const numColumns = windowWidth >= 1250 ? 5 : windowWidth >= 980 ? 4 : windowWidth >= 680 ? 3 : 2;
  const gapSize = 16;
  const cardWidth = `calc(${100 / numColumns}% - ${((numColumns - 1) * gapSize) / numColumns}px)`;

  return (
    <View style={webStyles.container} className={isDarkMode ? 'dark bg-[#0F1412] min-h-screen' : 'bg-slate-100 min-h-screen'}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <ToastNotification message={toastMessage} />

      {/* ─── FULL-HEIGHT STOREFRONT SCROLLVIEW (Scrollbar extends to top: 0 through header, matching Image 1) ─── */}
      <ScrollView
        style={{
          flex: 1,
          width: '100%',
          ...(Platform.OS === 'web' ? { overscrollBehavior: 'none', overscrollBehaviorY: 'none' } : {}),
        }}
        contentContainerStyle={[webStyles.scrollContent, windowWidth < 768 && { paddingBottom: 100 }]}
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={true}
        scrollEventThrottle={16}
      >
        {/* ─── 1. FULL-WIDTH RESPONSIVE STICKY NAVBAR (Pinned at top: 0, hardware accelerated) ─── */}
        <View style={webStyles.headerWrapper}>
        <View style={[webStyles.headerInner, windowWidth < 768 && { paddingHorizontal: 16, paddingVertical: 10, gap: 10 }]}>
          {/* Left: Logo + Desktop Search */}
          <View style={webStyles.headerLeft}>
            <TouchableOpacity
              style={webStyles.logoWrap}
              onPress={() => {
                setSelectedCategory('All');
                setSearchQuery('');
              }}
              activeOpacity={0.8}
            >
              <BrandLogo size={windowWidth < 768 ? 32 : 42} textColor="#FFFFFF" />
            </TouchableOpacity>

            {/* Search Bar centered between MOTOTRACK and Shop */}
            {windowWidth >= 768 && (
              <View style={webStyles.headerSearchSlot}>
                <View style={webStyles.navSearchContainer}>
                  <BootstrapIcon name="search" size={14} color="#94A3B8" />
                  <TextInput
                    style={webStyles.navSearchInput}
                    placeholder="Search products, brands..."
                    placeholderTextColor="#94A3B8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                      <BootstrapIcon name="x-circle-fill" size={14} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </View>

          {/* Center Navigation: Shop, Book a Service, Customize (Desktop / Tablet only) */}
          {windowWidth >= 768 && (
            <View style={webStyles.headerCenterNav}>
              {/* Shop Button (Active) */}
              <TouchableOpacity
                className="main-nav-tab"
                style={webStyles.headerShopBtn}
                onPress={() => {
                  setSelectedCategory('All');
                  setSearchQuery('');
                }}
                activeOpacity={0.8}
                title="Shop"
              >
                <Text style={webStyles.headerShopBtnText}>Shop</Text>
              </TouchableOpacity>

              {/* Repair Button */}
              <TouchableOpacity
                className="main-nav-tab"
                style={webStyles.headerRepairBtn}
                onPress={() => onNavigateToScreen?.('garage')}
                activeOpacity={0.8}
                title="Book a Service"
              >
                <Text style={webStyles.headerRepairBtnText}>Book a Service</Text>
              </TouchableOpacity>

              {/* Customize Button */}
              <TouchableOpacity
                className="main-nav-tab"
                style={webStyles.headerAiVisionBtn}
                onPress={() => onNavigateToScreen?.('customizer')}
                activeOpacity={0.85}
                title="Customize"
              >
                <Text style={webStyles.headerAiVisionBtnText}>Customize</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Right Header Navigation & Actions */}
          <View style={[webStyles.headerActions, windowWidth < 768 && { gap: 8 }]}>
            {/* Favorites Button (Icon Only with Badge) */}
            <TouchableOpacity
              style={webStyles.navActionIconBtn}
              onPress={handleNavigateToWishlist}
              activeOpacity={0.8}
              title="Favorites"
            >
              <BootstrapIcon name="heart" size={16} color="#FFFFFF" />
              {wishlistCount > 0 && (
                <View style={webStyles.navBadgeCircle}>
                  <Text style={webStyles.navBadgeText}>{wishlistCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Notifications Button */}
            <View style={{ position: 'relative' }}>
              <TouchableOpacity
                style={webStyles.navActionIconBtn}
                onPress={() => {
                  setIsProfileDropdownOpen(false);
                  setIsNotifDropdownOpen((prev) => !prev);
                }}
                activeOpacity={0.8}
                title="Notifications"
                dataSet={{ notificationButton: true }}
                {...(Platform.OS === 'web' ? { 'data-notification-button': 'true' } : {})}
              >
                <BootstrapIcon name="bell" size={16} color="#FFFFFF" />
                {unreadNotifCount > 0 && (
                  <View style={webStyles.navBadgeCircle}>
                    <Text style={webStyles.navBadgeText}>
                      {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              <NotificationDropdown
                isOpen={isNotifDropdownOpen}
                onClose={() => setIsNotifDropdownOpen(false)}
                onNavigateToScreen={onNavigateToScreen}
                currentUser={currentUser}
              />
            </View>

            {/* Cart Button (Icon Only with Badge) */}
            <TouchableOpacity
              style={webStyles.navActionIconBtn}
              onPress={() => setIsCartOpen(true)}
              activeOpacity={0.85}
              title="Shopping Cart"
            >
              <BootstrapIcon name="cart3" size={17} color="#FFFFFF" />
              {cartItemCount > 0 && (
                <View style={webStyles.navBadgeCircle}>
                  <Text style={webStyles.navBadgeText}>{cartItemCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Auth: Sign In & Sign Up OR Logged In Profile */}
            {currentUser ? (
              <View style={[webStyles.loggedInContainer, { position: 'relative' }]}>
                <UserProfileButton
                  currentUser={currentUser}
                  onPress={() => {
                    setIsNotifDropdownOpen(false);
                    setIsProfileDropdownOpen(!isProfileDropdownOpen);
                  }}
                  size={40}
                />

                <UserProfileDropdown
                  currentUser={currentUser}
                  isOpen={isProfileDropdownOpen}
                  currentScreen="shop"
                  showDashboard={true}
                  isDark={isDarkMode}
                  onToggleDarkMode={toggleDarkMode}
                  onClose={() => setIsProfileDropdownOpen(false)}
                  onNavigateToDashboard={(tab = 'overview') => onNavigateToScreen?.('profile', { tab })}
                  onNavigateToOrders={() => onNavigateToScreen?.('profile', { tab: 'orders' })}
                  onNavigateToProfile={(tab = 'profile') => onNavigateToScreen?.('profile', { tab: typeof tab === 'string' ? tab : 'profile' })}
                  onNavigateToSettings={() => onNavigateToScreen?.('profile', { tab: 'settings' })}
                  onNavigateToNotifications={() => onNavigateToScreen?.('profile', { tab: 'notifications' })}
                  onNavigateToWishlist={handleNavigateToWishlist}
                  onNavigateToScreen={(screen, params) => onNavigateToScreen?.(screen, params)}
                  onNavigateToAdmin={() => {
                    if (currentUser?.role === 'admin') {
                      onNavigateToScreen?.('admin');
                    } else {
                      setIsAccessDeniedModalOpen(true);
                    }
                  }}
                  onLogout={() => {
                    logout();
                    showToast('Logged out successfully');
                  }}
                />
              </View>
            ) : (
              <View style={webStyles.authButtonsRow}>
                <TouchableOpacity
                  style={webStyles.signInHeaderBtn}
                  onPress={() => {
                    setRedirectReason('');
                    onNavigateToScreen?.('login');
                  }}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon name="person" size={16} color="#FFFFFF" />
                  <Text style={webStyles.signInHeaderBtnText}>Sign In</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* ─── 2. MAIN STOREFRONT CONTENT ─── */}
      <View style={webStyles.maxContainer}>
          <HeroBanner onSelectCategory={setSelectedCategory} showToast={showToast} />

          {/* ─── CATEGORY, MOTORCYCLE SELECTOR & SORTING TOOLBAR ─── */}
          <View style={[webStyles.toolbarRow, { marginTop: 16 }]}>
            {/* Left Cluster: Category Dropdown, Motorcycle Dropdown & Compatibility Filter */}
            <View style={[webStyles.toolbarLeftGroup, { flexWrap: 'wrap', gap: 10 }]}>
              {/* 1. Category Dropdown */}
              <View style={webStyles.categoryDropdownContainer}>
                <TouchableOpacity
                  style={[
                    webStyles.categoryDropdownBtn,
                    (isCategoryDropdownOpen || selectedCategory !== 'All') &&
                      webStyles.categoryDropdownBtnActive,
                  ]}
                  onPress={() => {
                    setIsBikeDropdownOpen(false);
                    setIsSortDropdownOpen(false);
                    setIsCategoryDropdownOpen((prev) => !prev);
                  }}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon
                    name="grid-fill"
                    size={13}
                    color={selectedCategory !== 'All' ? '#EA580C' : '#64748B'}
                  />
                  <Text
                    style={[
                      webStyles.categoryDropdownBtnText,
                      selectedCategory !== 'All' && webStyles.categoryDropdownBtnTextActive,
                    ]}
                  >
                    {selectedCategory === 'All' ? 'All Categories' : selectedCategory}
                  </Text>
                  <BootstrapIcon
                    name={isCategoryDropdownOpen ? 'chevron-up' : 'chevron-down'}
                    size={12}
                    color={selectedCategory !== 'All' ? '#EA580C' : '#94A3B8'}
                  />
                </TouchableOpacity>

                {/* Dropdown Floating Menu */}
                {isCategoryDropdownOpen && (
                  <>
                    <TouchableOpacity
                      style={webStyles.dropdownBackdrop}
                      onPress={() => setIsCategoryDropdownOpen(false)}
                      activeOpacity={1}
                    />
                    <View style={webStyles.categoryDropdownMenu}>
                      <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
                        {categories.map((cat) => {
                          const isActive = selectedCategory.toLowerCase() === cat.toLowerCase();
                          const count =
                            cat === 'All'
                              ? (productsList || []).length
                              : (productsList || []).filter(
                                  (p) => p.category?.toLowerCase() === cat.toLowerCase()
                                ).length;

                          return (
                            <TouchableOpacity
                              key={cat}
                              style={[
                                webStyles.categoryDropdownItem,
                                isActive && webStyles.categoryDropdownItemActive,
                              ]}
                              onPress={() => {
                                setSelectedCategory(cat);
                                setIsCategoryDropdownOpen(false);
                              }}
                              activeOpacity={0.8}
                            >
                              <View style={webStyles.categoryDropdownItemLeft}>
                                {isActive ? (
                                  <BootstrapIcon name="check-circle-fill" size={13} color="#EA580C" />
                                ) : (
                                  <BootstrapIcon name="circle" size={9} color="#CBD5E1" />
                                )}
                                <Text
                                  style={[
                                    webStyles.categoryDropdownItemText,
                                    isActive && webStyles.categoryDropdownItemTextActive,
                                  ]}
                                >
                                  {cat}
                                </Text>
                              </View>
                              <Text
                                style={[
                                  webStyles.categoryDropdownBadge,
                                  isActive && webStyles.categoryDropdownBadgeActive,
                                ]}
                              >
                                {count}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  </>
                )}
              </View>

              {/* 2. Motorcycle Selector Dropdown (Aligned with Category) */}
              <View style={webStyles.categoryDropdownContainer}>
                <TouchableOpacity
                  style={[
                    webStyles.categoryDropdownBtn,
                    (isBikeDropdownOpen || activeBike) && webStyles.categoryDropdownBtnActive,
                  ]}
                  onPress={() => {
                    setIsCategoryDropdownOpen(false);
                    setIsSortDropdownOpen(false);
                    setIsBikeDropdownOpen((prev) => !prev);
                  }}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon
                    name="scooter"
                    size={14}
                    color={activeBike ? '#EA580C' : '#64748B'}
                  />
                  <Text
                    style={[
                      webStyles.categoryDropdownBtnText,
                      activeBike && webStyles.categoryDropdownBtnTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {activeBike ? `${activeBike.brand} ${activeBike.model}` : 'My Motorcycle'}
                  </Text>
                  <BootstrapIcon
                    name={isBikeDropdownOpen ? 'chevron-up' : 'chevron-down'}
                    size={12}
                    color={activeBike ? '#EA580C' : '#94A3B8'}
                  />
                </TouchableOpacity>

                {/* Motorcycle Dropdown Floating Menu */}
                {isBikeDropdownOpen && (
                  <>
                    <TouchableOpacity
                      style={webStyles.dropdownBackdrop}
                      onPress={() => setIsBikeDropdownOpen(false)}
                      activeOpacity={1}
                    />
                    <View style={[webStyles.categoryDropdownMenu, { minWidth: 260 }]}>
                      <View
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 9,
                          borderBottomWidth: 1,
                          borderBottomColor: '#F1F5F9',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '800',
                            color: '#64748B',
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                          }}
                        >
                          My Motorcycle
                        </Text>
                      </View>
                      <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
                        {/* Option: All Motorcycles (No filter) */}
                        <TouchableOpacity
                          style={[
                            webStyles.categoryDropdownItem,
                            !activeBike && webStyles.categoryDropdownItemActive,
                          ]}
                          onPress={() => handleSelectBike(null)}
                          activeOpacity={0.8}
                        >
                          <View style={webStyles.categoryDropdownItemLeft}>
                            {!activeBike ? (
                              <BootstrapIcon name="check-circle-fill" size={13} color="#EA580C" />
                            ) : (
                              <BootstrapIcon name="circle" size={9} color="#CBD5E1" />
                            )}
                            <Text
                              style={[
                                webStyles.categoryDropdownItemText,
                                !activeBike && webStyles.categoryDropdownItemTextActive,
                              ]}
                            >
                              All Motorcycles (No Filter)
                            </Text>
                          </View>
                        </TouchableOpacity>

                        {userBikes.length === 0 ? (
                          <View style={{ padding: 14, alignItems: 'center' }}>
                            <Text style={{ fontSize: 12, color: '#64748B', textAlign: 'center' }}>
                              {currentUser
                                ? 'No motorcycles found in your garage.'
                                : 'Sign in to select your registered motorcycle.'}
                            </Text>
                            {currentUser && (
                              <Text
                                style={{
                                  fontSize: 11,
                                  color: '#059669',
                                  fontWeight: '700',
                                  marginTop: 4,
                                }}
                              >
                                Add your bike in Customer Garage
                              </Text>
                            )}
                          </View>
                        ) : (
                          userBikes.map((b) => {
                            const isSelected = activeBike?.motorcycle_id
                              ? activeBike.motorcycle_id === b.motorcycle_id
                              : activeBike?.brand === b.brand && activeBike?.model === b.model;

                            return (
                              <TouchableOpacity
                                key={b.motorcycle_id || `${b.brand}-${b.model}`}
                                style={[
                                  webStyles.categoryDropdownItem,
                                  isSelected && webStyles.categoryDropdownItemActive,
                                ]}
                                onPress={() => handleSelectBike(b)}
                                activeOpacity={0.8}
                              >
                                <View style={webStyles.categoryDropdownItemLeft}>
                                  {isSelected ? (
                                    <BootstrapIcon
                                      name="check-circle-fill"
                                      size={13}
                                      color="#EA580C"
                                    />
                                  ) : (
                                    <BootstrapIcon name="circle" size={9} color="#CBD5E1" />
                                  )}
                                  <View>
                                    <Text
                                      style={[
                                        webStyles.categoryDropdownItemText,
                                        isSelected && webStyles.categoryDropdownItemTextActive,
                                      ]}
                                    >
                                      {b.brand} {b.model}
                                    </Text>
                                    {b.nickname ? (
                                      <Text style={{ fontSize: 10.5, color: '#94A3B8' }}>
                                        {b.nickname}
                                      </Text>
                                    ) : null}
                                  </View>
                                </View>
                                {b.is_primary ? (
                                  <Text
                                    style={[
                                      webStyles.categoryDropdownBadge,
                                      webStyles.categoryDropdownBadgeActive,
                                      { fontSize: 10 },
                                    ]}
                                  >
                                    Default
                                  </Text>
                                ) : null}
                              </TouchableOpacity>
                            );
                          })
                        )}
                      </ScrollView>
                    </View>
                  </>
                )}
              </View>

              {/* 3. Compatible with My Motorcycle Filter Toggle */}
              {activeBike && (
                <TouchableOpacity
                  style={[
                    webStyles.categoryDropdownBtn,
                    compatOnly && {
                      backgroundColor: '#EA580C',
                      borderColor: '#EA580C',
                    },
                  ]}
                  onPress={() => setCompatOnly((v) => !v)}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon
                    name={compatOnly ? 'check-circle-fill' : 'shield-check'}
                    size={13}
                    color={compatOnly ? '#FFFFFF' : '#EA580C'}
                  />
                  <Text
                    style={[
                      webStyles.categoryDropdownBtnText,
                      compatOnly && { color: '#FFFFFF' },
                    ]}
                  >
                    Compatible Only
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Sorting Dropdown */}
            <View style={webStyles.sortingGroup}>
              <View style={webStyles.categoryDropdownContainer}>
                <TouchableOpacity
                  style={[
                    webStyles.categoryDropdownBtn,
                    filterSort !== 'all' && webStyles.categoryDropdownBtnActive,
                  ]}
                  onPress={() => {
                    setIsCategoryDropdownOpen(false);
                    setIsBikeDropdownOpen(false);
                    setIsSortDropdownOpen((prev) => !prev);
                  }}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon
                    name="sort-down"
                    size={13}
                    color={filterSort !== 'all' ? '#EA580C' : '#64748B'}
                  />
                  <Text
                    style={[
                      webStyles.categoryDropdownBtnText,
                      filterSort !== 'all' && webStyles.categoryDropdownBtnTextActive,
                    ]}
                  >
                    {filterSort === 'all'
                      ? 'Sort By'
                      : filterSort === 'rating'
                        ? 'Top Rated'
                        : filterSort === 'price-low'
                          ? 'Price: Low'
                          : 'Price: High'}
                  </Text>
                  <BootstrapIcon
                    name={isSortDropdownOpen ? 'chevron-up' : 'chevron-down'}
                    size={12}
                    color={filterSort !== 'all' ? '#EA580C' : '#94A3B8'}
                  />
                </TouchableOpacity>

                {/* Dropdown Floating Menu */}
                {isSortDropdownOpen && (
                  <>
                    <TouchableOpacity
                      style={webStyles.dropdownBackdrop}
                      onPress={() => setIsSortDropdownOpen(false)}
                      activeOpacity={1}
                    />
                    <View style={[webStyles.categoryDropdownMenu, { right: 0, left: 'auto', minWidth: 160 }]}>
                      {[
                        { id: 'all', label: 'Default', icon: 'dash-lg' },
                        { id: 'rating', label: 'Top Rated', icon: 'star-fill' },
                        { id: 'price-low', label: 'Price: Low', icon: 'sort-numeric-down' },
                        { id: 'price-high', label: 'Price: High', icon: 'sort-numeric-up' },
                      ].map((option) => {
                        const isActive = filterSort === option.id;
                        return (
                          <TouchableOpacity
                            key={option.id}
                            style={[
                              webStyles.categoryDropdownItem,
                              isActive && webStyles.categoryDropdownItemActive,
                            ]}
                            onPress={() => {
                              setFilterSort(option.id);
                              setIsSortDropdownOpen(false);
                            }}
                            activeOpacity={0.8}
                          >
                            <View style={webStyles.categoryDropdownItemLeft}>
                              <BootstrapIcon
                                name={option.icon}
                                size={12}
                                color={isActive ? '#EA580C' : '#64748B'}
                              />
                              <Text
                                style={[
                                  webStyles.categoryDropdownItemText,
                                  isActive && webStyles.categoryDropdownItemTextActive,
                                ]}
                              >
                                {option.label}
                              </Text>
                            </View>
                            {isActive && <BootstrapIcon name="check" size={14} color="#EA580C" />}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                )}
              </View>
            </View>
          </View>

          {/* Section Header */}
          <View style={webStyles.catalogHeaderRow}>
            <View>
              <Text style={webStyles.catalogTitle}>
                {selectedCategory === 'All' ? 'Featured Products' : `${selectedCategory} Collection`}
              </Text>
              <Text style={webStyles.catalogSub}>
                {isLoadingProducts ? 'Loading catalog items...' : `${filteredProducts.length} items available`}
              </Text>
            </View>
          </View>

          {/* Product Multi-Column Grid */}
          <View style={webStyles.productGrid}>
            {isLoadingProducts ? (
              [1, 2, 3, 4, 5, 6, 7, 8].map((k) => (
                <ProductCardSkeleton key={k} width={cardWidth} />
              ))
            ) : filteredProducts.length === 0 ? (
              <View style={{ width: '100%', padding: 48, alignItems: 'center', justifyContent: 'center' }}>
                <BootstrapIcon name="box-seam" size={38} color={isDarkMode ? '#AAB4B0' : '#94A3B8'} />
                <Text
                  style={{
                    marginTop: 12,
                    fontSize: 15,
                    fontWeight: '700',
                    color: isDarkMode ? '#F5F7F6' : '#0F172A',
                  }}
                >
                  No Products Found
                </Text>
                <Text
                  style={{
                    marginTop: 4,
                    fontSize: 13,
                    color: isDarkMode ? '#AAB4B0' : '#64748B',
                    textAlign: 'center',
                    maxWidth: 420,
                  }}
                >
                  {searchQuery
                    ? `No products found matching "${searchQuery}". Try adjusting your keywords.`
                    : 'No products are currently available in this category.'}
                </Text>
              </View>
            ) : (
              filteredProducts.map((product) => {
              const isFav = isWishlisted(product.id);
              return (
                <TouchableOpacity
                  key={product.id}
                  style={[webStyles.productCard, { width: cardWidth }]}
                  className={`${isDarkMode ? 'bg-[#151C19] border-[#26332E]' : 'bg-white border-slate-200/90'} rounded-xl border shadow-sm overflow-hidden mb-2 cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}
                  onPress={() => {
                    setSelectedProduct(product);
                    setIsSpecsOpen(true);
                  }}
                  activeOpacity={0.92}
                >
                  {/* 1:1 Square Product Image */}
                  <View
                    style={webStyles.productImgContainer}
                    className={`w-full aspect-square ${isDarkMode ? 'bg-[#131A17]' : 'bg-slate-100'} relative overflow-hidden`}
                  >
                    <Image
                      source={{ uri: product.image }}
                      style={webStyles.productImg}
                      resizeMode="cover"
                      className="w-full h-full object-cover"
                    />

                    {/* Compatibility Indicator (Top-Left) */}
                    <CompatibilityIndicator
                      status={product.compatStatus}
                      bike={activeBike}
                      message={product.compatMessage}
                    />

                    {/* Wishlist Button (Top-Right) */}
                    <TouchableOpacity
                      style={webStyles.wishlistBtn}
                      className={`absolute top-2 right-2 w-7 h-7 rounded-full ${isDarkMode ? 'bg-[#1A2320]/95' : 'bg-white/95'} items-center justify-center shadow-sm z-10 hover:scale-105 transition-transform`}
                      onPress={(e) => {
                        e?.stopPropagation?.();
                        toggleWishlist(product.id);
                      }}
                      activeOpacity={0.8}
                    >
                      <BootstrapIcon
                        name={isFav ? 'heart-fill' : 'heart'}
                        size={13}
                        color={isFav ? '#EF4444' : isDarkMode ? '#AAB4B0' : '#64748B'}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Details - Compact Square Layout */}
                  <View
                    style={webStyles.productDetails}
                    className={`p-2.5 ${isDarkMode ? 'bg-[#151C19]' : 'bg-white'} flex flex-col justify-between`}
                  >
                    {/* Product Name (2 Lines Max) */}
                    <Text
                      style={webStyles.productName}
                      numberOfLines={2}
                      className={`text-[12.5px] font-semibold ${isDarkMode ? 'text-[#F5F7F6]' : 'text-slate-800'} leading-[17px] mb-1 h-[34px]`}
                    >
                      {product.name}
                    </Text>

                    {/* Price Row: Bold Teal Brand Color (matching app) */}
                    <View style={webStyles.priceRow} className="flex flex-row items-baseline gap-1.5 mb-1.5">
                      <Text
                        style={webStyles.priceMainText}
                        className={`text-[15px] font-extrabold ${isDarkMode ? 'text-[#EA580C]' : 'text-[#EA580C]'}`}
                      >
                        ₱{product.price?.toFixed(2)}
                      </Text>
                    </View>

                    {/* Tags Row: COD, Actual Stock & Rating */}
                    <View
                      style={webStyles.tagsRow}
                      className="flex flex-row items-center gap-1.5 mb-1.5 flex-wrap"
                    >
                      <View style={webStyles.codTag} className="bg-amber-100 px-1.5 py-0.5 rounded">
                        <Text
                          style={webStyles.codTagText}
                          className="text-[10px] font-extrabold text-amber-700"
                        >
                          COD
                        </Text>
                      </View>
                      <View style={webStyles.stockTag} className="bg-emerald-50 px-1.5 py-0.5 rounded">
                        <Text
                          style={webStyles.stockTagText}
                          className="text-[10px] font-bold text-emerald-700"
                        >
                          {product.stock <= 0
                            ? 'Sold out'
                            : product.stock <= resolveReorderLevel(product, 5)
                              ? `Only ${product.stock} left`
                              : `${product.stock} in stock`}
                        </Text>
                      </View>
                      {productHasCustomerRatings(product) ? (
                        <View
                          style={[webStyles.ratingLeft, { marginLeft: 'auto' }]}
                          className="flex flex-row items-center gap-1 ml-auto"
                        >
                          <BootstrapIcon name="star-fill" size={10} color="#F59E0B" />
                          <Text
                            style={webStyles.ratingValText}
                            className="text-[11.5px] font-bold text-amber-500"
                          >
                            {Number(product.rating).toFixed(1)}
                          </Text>
                          <Text
                            style={webStyles.reviewCountText}
                            className="text-[10.5px] text-slate-500 font-medium"
                          >
                            ({product.reviews})
                          </Text>
                        </View>
                      ) : (
                        <View
                          style={[webStyles.ratingLeft, { marginLeft: 'auto' }]}
                          className="flex flex-row items-center gap-1 ml-auto"
                        >
                          <BootstrapIcon name="star" size={10} color="#94A3B8" />
                          <Text
                            style={webStyles.reviewCountText}
                            className="text-[10.5px] text-slate-500 font-medium"
                          >
                            No ratings yet
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
        </View>

        {/* ─── FULL-WIDTH FOOTER (Flush: No Space Left/Right/Bottom, No Radius) ─── */}
        <View style={[webStyles.desktopFooter, windowWidth < 768 && { paddingBottom: 88 }]}>
          <View style={webStyles.footerInner}>
            <View style={webStyles.footerColumnsRow}>
              {/* Column 1: Brand Info, Contact & Social Links */}
              <View style={webStyles.footerBrandCol}>
                <TouchableOpacity
                  style={{ alignSelf: 'flex-start', marginBottom: 20 }}
                  onPress={() => {
                    setSelectedCategory('All');
                    setSearchQuery('');
                  }}
                  activeOpacity={0.85}
                >
                  <BrandLogo size={36} textColor="#FFFFFF" />
                </TouchableOpacity>

                {/* Contact: Email */}
                <TouchableOpacity
                  style={webStyles.footerContactRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    const email =
                      brandSettings?.contactEmail ||
                      `support@${(brandSettings?.storeName || 'mototrack').toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
                    try {
                      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                        navigator.clipboard.writeText(email);
                      }
                    } catch (e) {}
                    showToast?.(`Copied ${email} to clipboard`);
                  }}
                >
                  <BootstrapIcon name="envelope-fill" size={15} color="#EA580C" />
                  <Text style={webStyles.footerContactText}>
                    {brandSettings?.contactEmail ||
                      `support@${(brandSettings?.storeName || 'mototrack').toLowerCase().replace(/[^a-z0-9]/g, '')}.com`}
                  </Text>
                </TouchableOpacity>

                {/* Contact: Phone */}
                <TouchableOpacity
                  style={webStyles.footerContactRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    const phone = brandSettings?.contactPhone || '1800-3232-8686';
                    try {
                      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                        navigator.clipboard.writeText(phone);
                      }
                    } catch (e) {}
                    showToast?.(`Copied hotline ${phone} to clipboard`);
                  }}
                >
                  <BootstrapIcon name="telephone-fill" size={15} color="#EA580C" />
                  <Text style={webStyles.footerContactText}>
                    {brandSettings?.contactPhone || '1800-3232-8686'}
                  </Text>
                </TouchableOpacity>

                {/* Social media icons underneath */}
                <View style={webStyles.footerSocialRow}>
                  <TouchableOpacity
                    style={webStyles.footerSocialBtn}
                    activeOpacity={0.75}
                    onPress={() => showToast?.(`Opening ${brandSettings?.storeName || 'MotoTrack'} Facebook`)}
                  >
                    <BootstrapIcon name="facebook" size={16} color="#EA580C" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={webStyles.footerSocialBtn}
                    activeOpacity={0.75}
                    onPress={() => showToast?.(`Opening ${brandSettings?.storeName || 'MotoTrack'} Instagram`)}
                  >
                    <BootstrapIcon name="instagram" size={16} color="#EA580C" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={webStyles.footerSocialBtn}
                    activeOpacity={0.75}
                    onPress={() => showToast?.(`Opening ${brandSettings?.storeName || 'MotoTrack'} YouTube`)}
                  >
                    <BootstrapIcon name="youtube" size={16} color="#EA580C" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Column 2: PRODUCTS */}
              <View style={webStyles.footerCol}>
                <View style={webStyles.footerColTitleRow}>
                  <BootstrapIcon name="box-seam" size={14} color="#EA580C" style={webStyles.footerColIcon} />
                  <Text style={webStyles.footerColTitle}>PRODUCTS</Text>
                </View>

                <TouchableOpacity
                  style={webStyles.footerLinkItem}
                  activeOpacity={0.7}
                  onPress={() => {
                    setSelectedCategory('All');
                    setSearchQuery('');
                  }}
                >
                  <Text style={webStyles.footerLinkText}>All Parts</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={webStyles.footerLinkItem}
                  activeOpacity={0.7}
                  onPress={() => setSelectedCategory('Brakes')}
                >
                  <Text style={webStyles.footerLinkText}>Brake Systems</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={webStyles.footerLinkItem}
                  activeOpacity={0.7}
                  onPress={() => setSelectedCategory('Engine')}
                >
                  <Text style={webStyles.footerLinkText}>Engine & Exhaust</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={webStyles.footerLinkItem}
                  activeOpacity={0.7}
                  onPress={() => setSelectedCategory('Tires')}
                >
                  <Text style={webStyles.footerLinkText}>Tires & Wheels</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={webStyles.footerLinkItem}
                  activeOpacity={0.7}
                  onPress={() => setSelectedCategory('Helmets')}
                >
                  <Text style={webStyles.footerLinkText}>Rider Gear</Text>
                </TouchableOpacity>
              </View>

              {/* Column 3: SERVICES */}
              <View style={webStyles.footerCol}>
                <View style={webStyles.footerColTitleRow}>
                  <BootstrapIcon name="tools" size={14} color="#EA580C" style={webStyles.footerColIcon} />
                  <Text style={webStyles.footerColTitle}>SERVICES</Text>
                </View>

                <TouchableOpacity
                  style={webStyles.footerLinkItem}
                  activeOpacity={0.7}
                  onPress={() => onNavigateToScreen?.('garage')}
                >
                  <Text style={webStyles.footerLinkText}>PMS Maintenance</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={webStyles.footerLinkItem}
                  activeOpacity={0.7}
                  onPress={() => onNavigateToScreen?.('garage')}
                >
                  <Text style={webStyles.footerLinkText}>Mechanical Repair</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={webStyles.footerLinkItem}
                  activeOpacity={0.7}
                  onPress={() => onNavigateToScreen?.('garage')}
                >
                  <Text style={webStyles.footerLinkText}>Pit Bay Booking</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={webStyles.footerLinkItem}
                  activeOpacity={0.7}
                  onPress={() => onNavigateToScreen?.('customizer')}
                >
                  <Text style={webStyles.footerLinkText}>AI Customizer Studio</Text>
                </TouchableOpacity>
              </View>

              {/* Column 4: COMPANY & HELP */}
              <View style={webStyles.footerCol}>
                <View style={webStyles.footerColTitleRow}>
                  <BootstrapIcon name="building" size={14} color="#EA580C" style={webStyles.footerColIcon} />
                  <Text style={webStyles.footerColTitle}>COMPANY</Text>
                </View>

                <TouchableOpacity
                  style={webStyles.footerLinkItem}
                  activeOpacity={0.7}
                  onPress={() => handleOpenCompanyInfo('about')}
                >
                  <Text style={webStyles.footerLinkText}>About Us</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={webStyles.footerLinkItem}
                  activeOpacity={0.7}
                  onPress={() => handleOpenCompanyInfo('contact')}
                >
                  <Text style={webStyles.footerLinkText}>Contact Us</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={webStyles.footerLinkItem}
                  activeOpacity={0.7}
                  onPress={() => handleOpenCompanyInfo('about')}
                >
                  <Text style={webStyles.footerLinkText}>FAQ</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={webStyles.footerLinkItem}
                  activeOpacity={0.7}
                  onPress={() => handleOpenCompanyInfo('contact')}
                >
                  <Text style={webStyles.footerLinkText}>Help Center</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={webStyles.footerLinkItem}
                  activeOpacity={0.7}
                  onPress={() => onNavigateToScreen?.('orders')}
                >
                  <Text style={webStyles.footerLinkText}>Track Order</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Horizontal Divider Line */}
            <View style={webStyles.footerDivider} />

            {/* Bottom Row */}
            <View style={webStyles.footerBottomRow}>
              <Text style={webStyles.footerCopyrightText}>
                © 2026 {brandSettings?.storeName || 'MotoTrack'}. All Rights Reserved.
              </Text>

              <View style={webStyles.footerLegalLinksRow}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => handleOpenCompanyInfo('privacy')}
                >
                  <Text style={webStyles.footerLegalLinkText}>Privacy Policy</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => handleOpenCompanyInfo('terms')}
                >
                  <Text style={webStyles.footerLegalLinkText}>Terms of Service</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => handleOpenCompanyInfo('privacy')}
                >
                  <Text style={webStyles.footerLegalLinkText}>Cookie Policy</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ─── MODALS ─── */}
      <CompanyInfoModal
        visible={isCompanyInfoOpen}
        initialTab={companyInfoTab}
        onClose={() => setIsCompanyInfoOpen(false)}
        showToast={showToast}
      />

      <ProductSpecsModal
        visible={isSpecsOpen}
        product={selectedProduct}
        onClose={() => setIsSpecsOpen(false)}
        onAddToCart={handleAddToCartAttempt}
        onBuyNow={handleBuyNowAttempt}
      />

      <CartModal
        visible={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onProceedToCheckout={handleProceedToCheckout}
      />

      <CheckoutModal
        visible={isCheckoutOpen}
        onClose={() => {
          if (isPlacingOrder) return;
          setIsCheckoutOpen(false);
          setBuyNowItems(null);
        }}
        onCompleteOrder={handleCompleteOrder}
        isPlacingOrder={isPlacingOrder}
        overrideItemCount={isBuyNowCheckout ? checkoutItemCount : null}
        overrideTotal={isBuyNowCheckout ? checkoutTotal : null}
        overrideItems={isBuyNowCheckout ? checkoutItems : null}
        onOpenProfile={() => {
          setIsCheckoutOpen(false);
          setBuyNowItems(null);
          setIsProfileOpen(true);
        }}
      />

      <ProfileModal
        visible={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        onNavigateToOrders={() => onNavigateToScreen?.('profile', { tab: 'orders' })}
        onNavigateToWishlist={() => onNavigateToScreen?.('wishlist')}
        onNavigateToAdmin={() => {
          if (currentUser?.role === 'admin') {
            onNavigateToScreen?.('admin');
          } else {
            setIsAccessDeniedModalOpen(true);
          }
        }}
        showToast={showToast}
      />

      <AccessDeniedModal
        visible={isAccessDeniedModalOpen}
        onClose={() => setIsAccessDeniedModalOpen(false)}
        onNavigateToLogin={() => {
          setRedirectReason('Please sign in with your Store Administrator account.');
          onNavigateToScreen?.('login');
        }}
        onNavigateToAdmin={() => onNavigateToScreen?.('admin')}
      />

      <LiveOrderTrackingMapModal
        visible={isLiveTrackingOpen}
        order={selectedOrderForTracking}
        onClose={() => setIsLiveTrackingOpen(false)}
        showToast={showToast}
      />

      <GCashPaymentModal
        visible={isGcashModalOpen}
        amount={cartTotal}
        orderData={pendingGcashOrderData}
        onClose={() => setIsGcashModalOpen(false)}
        onPaymentSuccess={handleGcashPaymentSuccess}
        showToast={showToast}
      />

      {/* Persistent Mobile Bottom Navigation Bar on smaller screens */}
      {windowWidth < 768 && (
        <BottomNavBar
          activeTab="Home"
          onTabChange={(tab) => {
            if (tab === 'Home') {
              setSelectedCategory('All');
              setSearchQuery('');
            } else if (tab === 'Services') {
              onNavigateToScreen?.('garage');
            } else if (tab === 'Customize') {
              onNavigateToScreen?.('customizer');
            } else if (tab === 'Garage') {
              if (!currentUser) {
                setRedirectReason?.('Please sign in to access your motorcycle garage fleet.');
                onNavigateToScreen?.('login');
              } else {
                onNavigateToScreen?.('profile', { tab: 'garage' });
              }
            } else if (tab === 'Orders') {
              onNavigateToScreen?.('orders');
            } else if (tab === 'Wishlist' || tab === 'Favorites') {
              onNavigateToScreen?.('wishlist');
            } else if (tab === 'More') {
              if (!currentUser) {
                setRedirectReason('Please sign in to access your Customer Dashboard.');
                onNavigateToScreen?.('login');
              } else {
                onNavigateToScreen?.('profile', { tab: 'menu' });
              }
            } else if (tab === 'Dashboard') {
              if (!currentUser) {
                setRedirectReason('Please sign in to access your Customer Dashboard.');
                onNavigateToScreen?.('login');
              } else {
                onNavigateToScreen?.('profile', { tab: 'overview' });
              }
            } else if (tab === 'Bookings') {
              if (!currentUser) {
                setRedirectReason('Please sign in to view your pit bookings.');
                onNavigateToScreen?.('login');
              } else {
                onNavigateToScreen?.('profile', { tab: 'bookings' });
              }
            } else if (tab === 'Notifications') {
              onNavigateToScreen?.('profile', { tab: 'notifications' });
            } else if (tab === 'Admin') {
              if (currentUser?.role === 'admin') {
                onNavigateToScreen?.('admin');
              } else {
                setIsAccessDeniedModalOpen(true);
              }
            } else if (tab === 'Profile') {
              if (!currentUser) {
                setRedirectReason('');
                onNavigateToScreen?.('login');
              } else {
                setIsProfileOpen(true);
              }
            }
          }}
          wishlistCount={wishlistCount}
          currentUser={currentUser}
        />
      )}
    </View>
  );
}
