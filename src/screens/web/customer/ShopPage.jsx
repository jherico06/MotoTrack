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
  CustomerMobileNavDrawer,
} from '../../../components/common';
import HeroBanner from '../../../components/shop/HeroBanner.jsx';
import CompatibilityIndicator from '../../../components/shop/CompatibilityIndicator.jsx';
import {
  compatibilityService,
  COMPAT_STATUS,
} from '../../../services/products/compatibilityService.js';
import { createShopWebStyles } from '../../../styles/web/shopPage.web.styles.js';

// Default motorcycle selection matching reference UI
const DEFAULT_SELECTED_BIKE = {
  brand: 'Suzuki',
  model: 'Smash 125',
  motorcycle_id: 'default-smash-125',
};

// Popular Philippines motorcycles for rapid fitment preview
const POPULAR_MOTORCYCLES = [
  { brand: 'Suzuki', model: 'Smash 125', motorcycle_id: 'pop-smash-125' },
  { brand: 'Yamaha', model: 'NMAX 155', motorcycle_id: 'pop-nmax-155' },
  { brand: 'Honda', model: 'Click 160', motorcycle_id: 'pop-click-160' },
  { brand: 'Honda', model: 'TMX 125', motorcycle_id: 'pop-tmx-125' },
  { brand: 'Yamaha', model: 'Sniper 150', motorcycle_id: 'pop-sniper-150' },
  { brand: 'Kawasaki', model: 'Ninja 400', motorcycle_id: 'pop-ninja-400' },
];

// 8 Category cards matching the reference UI
const SHOP_CATEGORIES = [
  {
    id: 'Helmets',
    name: 'Helmets',
    image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=300&q=80',
    icon: 'shield-shaded',
  },
  {
    id: 'Tires',
    name: 'Tires',
    image: 'https://images.unsplash.com/photo-1578844251758-2f71da64c96f?auto=format&fit=crop&w=300&q=80',
    icon: 'circle',
  },
  {
    id: 'Brakes',
    name: 'Brakes',
    image: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=300&q=80',
    icon: 'disc',
  },
  {
    id: 'Engine Parts',
    name: 'Engine Parts',
    image: 'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?auto=format&fit=crop&w=300&q=80',
    icon: 'gear-fill',
  },
  {
    id: 'Electrical',
    name: 'Electrical',
    image: 'https://images.unsplash.com/photo-1508974239320-0a029497e820?auto=format&fit=crop&w=300&q=80',
    icon: 'lightning-charge-fill',
  },
  {
    id: 'Accessories',
    name: 'Accessories',
    image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=300&q=80',
    icon: 'bag-fill',
  },
  {
    id: 'Lubricants',
    name: 'Lubricants',
    image: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=300&q=80',
    icon: 'droplet-fill',
  },
  {
    id: 'More',
    name: 'More',
    icon: 'grid-fill',
    isMore: true,
  },
];

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
  const [activeBike, setActiveBike] = useState(DEFAULT_SELECTED_BIKE);
  const [userBikes, setUserBikes] = useState([]);
  const [isBikeDropdownOpen, setIsBikeDropdownOpen] = useState(false);
  const [compatMap, setCompatMap] = useState(null);
  const [compatOnly, setCompatOnly] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState('');

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
            if (bike || (list && list[0])) {
              setActiveBike(bike || list[0]);
            }
          }
        } catch (_e) {
          if (alive) {
            setUserBikes([]);
          }
        }
      } else if (alive) {
        setUserBikes([]);
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
    if (
      userId &&
      bike.motorcycle_id &&
      !bike.motorcycle_id.startsWith('pop-') &&
      !bike.motorcycle_id.startsWith('default-')
    ) {
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
      const catLower = (item.category || '').toLowerCase();
      const selLower = selectedCategory.toLowerCase();
      let matchCategory = selectedCategory === 'All' || catLower === selLower;
      if (!matchCategory) {
        if (selLower === 'engine parts' && (catLower.includes('engine') || catLower === 'fuel system')) matchCategory = true;
        if (selLower === 'lubricants' && (catLower.includes('oil') || catLower.includes('maintenance') || catLower.includes('lubricant'))) matchCategory = true;
        if (selLower === 'tires' && (catLower.includes('tire') || catLower.includes('wheel'))) matchCategory = true;
        if (selLower === 'brakes' && catLower.includes('brake')) matchCategory = true;
        if (selLower === 'helmets' && (catLower.includes('helmet') || catLower.includes('gear'))) matchCategory = true;
        if (selLower === 'accessories' && (catLower.includes('access') || catLower.includes('body'))) matchCategory = true;
        if (selLower === 'electrical' && (catLower.includes('elect') || catLower.includes('battery'))) matchCategory = true;
      }
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

  // Balanced grid columns: 5 on desktop (>=1150px), 4 on laptop, 3 on tablet, 2 on mobile, 1 on small screens
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
  const gapSize = windowWidth < 480 ? 10 : windowWidth < 768 ? 12 : 14;
  const cardWidth = `calc(${100 / numColumns}% - ${((numColumns - 1) * gapSize) / numColumns}px)`;

  return (
    <View
      style={webStyles.container}
      className={isDarkMode ? 'dark bg-[#11151A] min-h-screen' : 'bg-[#F3F6FA] min-h-screen'}
    >
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <ToastNotification message={toastMessage} />

      {/* ─── FULL-HEIGHT STOREFRONT SCROLLVIEW (Scrollbar extends to top: 0 through header, matching Image 1) ─── */}
      <ScrollView
        style={{
          flex: 1,
          width: '100%',
          ...(Platform.OS === 'web' ? { overscrollBehavior: 'none', overscrollBehaviorY: 'none' } : {}),
        }}
        contentContainerStyle={webStyles.scrollContent}
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={true}
        scrollEventThrottle={16}
      >
        {/* ─── 1. FULL-WIDTH RESPONSIVE STICKY NAVBAR (Pinned at top: 0, hardware accelerated) ─── */}
        <View style={webStyles.headerWrapper}>
        <View style={[webStyles.headerInner, windowWidth < 768 && { paddingHorizontal: 12, paddingVertical: 10, gap: 8 }]}>
          {/* Left: Mobile Nav Toggle + Logo + Desktop Search */}
          <View style={webStyles.headerLeft}>
            {windowWidth < 768 && (
              <TouchableOpacity
                style={webStyles.mobileNavToggleBtn}
                onPress={() => setIsMobileNavOpen(true)}
                activeOpacity={0.8}
                accessibilityLabel="Open Navigation Menu"
              >
                <BootstrapIcon name="list" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={webStyles.logoWrap}
              onPress={() => {
                setSelectedCategory('All');
                setSearchQuery('');
              }}
              activeOpacity={0.8}
            >
              <BrandLogo size={windowWidth < 400 ? 28 : windowWidth < 768 ? 32 : 42} textColor="#FFFFFF" />
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
              {/* Shop Button (Active with Orange Underline Indicator) */}
              <TouchableOpacity
                className="main-nav-tab"
                style={[
                  webStyles.headerShopBtn,
                  {
                    borderBottomWidth: 2,
                    borderBottomColor: '#FF5A0A',
                    paddingBottom: 5,
                    borderRadius: 0,
                  },
                ]}
                onPress={() => {
                  setSelectedCategory('All');
                  setSearchQuery('');
                }}
                activeOpacity={0.8}
                title="Shop"
              >
                <Text style={[webStyles.headerShopBtnText, { color: '#FF5A0A', fontWeight: '800' }]}>
                  Shop
                </Text>
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

        {/* Dedicated Mobile Search Row */}
        {windowWidth < 768 && (
          <View style={webStyles.mobileSearchRow}>
            <View style={webStyles.mobileSearchInputWrap}>
              <BootstrapIcon name="search" size={14} color="#94A3B8" />
              <TextInput
                style={webStyles.mobileSearchInput}
                placeholder="Search products, brands, parts..."
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

      {/* ─── 2. MAIN STOREFRONT CONTENT ─── */}
      <View style={webStyles.maxContainer}>
          <HeroBanner
            onSelectCategory={setSelectedCategory}
            onNavigateToScreen={onNavigateToScreen}
            showToast={showToast}
          />

          {/* ─── 3. MOTORCYCLE COMPATIBILITY & SORTING TOOLBAR (Directly below Hero Banner) ─── */}
          <View style={[webStyles.toolbarRow, { marginTop: 12, marginBottom: 20 }]}>
            {/* Left Cluster: All Categories Dropdown, Motorcycle Dropdown & Compatible Only Toggle */}
            <View style={[webStyles.toolbarLeftGroup, { flexWrap: 'wrap', gap: 10 }]}>
              {/* 1. All Categories Dropdown */}
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
                    color={selectedCategory !== 'All' ? '#FF5A0A' : '#64748B'}
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
                    color={selectedCategory !== 'All' ? '#FF5A0A' : '#94A3B8'}
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
                                  <BootstrapIcon name="check-circle-fill" size={13} color="#FF5A0A" />
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

              {/* 2. Motorcycle Selector Dropdown (Initially displaying Suzuki Smash 125 with Orange Accent) */}
              <View style={webStyles.categoryDropdownContainer}>
                <TouchableOpacity
                  style={[
                    webStyles.categoryDropdownBtn,
                    {
                      borderColor: activeBike ? '#FF5A0A' : '#E2E8F0',
                      backgroundColor: activeBike ? (isDarkMode ? '#251D18' : '#FFF9F5') : (isDarkMode ? '#1C2229' : '#FFFFFF'),
                    },
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
                    color={activeBike ? '#FF5A0A' : '#64748B'}
                  />
                  <Text
                    style={[
                      webStyles.categoryDropdownBtnText,
                      activeBike && { color: '#FF5A0A', fontWeight: '800' },
                    ]}
                    numberOfLines={1}
                  >
                    {activeBike ? `${activeBike.brand} ${activeBike.model}` : 'Select Motorcycle'}
                  </Text>
                  <BootstrapIcon
                    name={isBikeDropdownOpen ? 'chevron-up' : 'chevron-down'}
                    size={12}
                    color={activeBike ? '#FF5A0A' : '#94A3B8'}
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
                    <View style={[webStyles.categoryDropdownMenu, { minWidth: 270 }]}>
                      <View
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 9,
                          borderBottomWidth: 1,
                          borderBottomColor: isDarkMode ? '#2D3742' : '#F1F5F9',
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
                          Motorcycle Fitment
                        </Text>
                      </View>
                      <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
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
                              <BootstrapIcon name="check-circle-fill" size={13} color="#FF5A0A" />
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

                        {/* Customer Garage Motorcycles */}
                        {userBikes.length > 0 && (
                          <>
                            <View
                              style={{
                                paddingHorizontal: 14,
                                paddingVertical: 5,
                                backgroundColor: isDarkMode ? '#171C22' : '#F8FAFC',
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 10,
                                  fontWeight: '800',
                                  color: '#94A3B8',
                                  textTransform: 'uppercase',
                                }}
                              >
                                My Garage Bikes
                              </Text>
                            </View>
                            {userBikes.map((b) => {
                              const isSelected =
                                activeBike?.motorcycle_id === b.motorcycle_id ||
                                (activeBike?.brand === b.brand && activeBike?.model === b.model);
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
                                        color="#FF5A0A"
                                      />
                                    ) : (
                                      <BootstrapIcon name="circle" size={9} color="#CBD5E1" />
                                    )}
                                    <Text
                                      style={[
                                        webStyles.categoryDropdownItemText,
                                        isSelected && webStyles.categoryDropdownItemTextActive,
                                      ]}
                                    >
                                      {b.brand} {b.model}
                                    </Text>
                                  </View>
                                </TouchableOpacity>
                              );
                            })}
                          </>
                        )}

                        {/* Popular Philippines Models (Suzuki Smash 125, NMAX, Click, etc.) */}
                        <View
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 5,
                            backgroundColor: isDarkMode ? '#171C22' : '#F8FAFC',
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 10,
                              fontWeight: '800',
                              color: '#94A3B8',
                              textTransform: 'uppercase',
                            }}
                          >
                            Popular Models
                          </Text>
                        </View>
                        {POPULAR_MOTORCYCLES.map((b) => {
                          const isSelected =
                            activeBike?.brand === b.brand && activeBike?.model === b.model;
                          return (
                            <TouchableOpacity
                              key={b.motorcycle_id}
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
                                    color="#FF5A0A"
                                  />
                                ) : (
                                  <BootstrapIcon name="circle" size={9} color="#CBD5E1" />
                                )}
                                <Text
                                  style={[
                                    webStyles.categoryDropdownItemText,
                                    isSelected && webStyles.categoryDropdownItemTextActive,
                                  ]}
                                >
                                  {b.brand} {b.model}
                                </Text>
                              </View>
                              {b.model === 'Smash 125' && (
                                <Text
                                  style={{
                                    fontSize: 9.5,
                                    fontWeight: '800',
                                    color: '#FF5A0A',
                                    backgroundColor: isDarkMode ? '#2B1E17' : '#FFF7ED',
                                    paddingHorizontal: 6,
                                    paddingVertical: 1,
                                    borderRadius: 4,
                                  }}
                                >
                                  Selected
                                </Text>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  </>
                )}
              </View>

              {/* 3. Compatible Only Toggle Filter Button */}
              {activeBike && (
                <TouchableOpacity
                  style={[
                    webStyles.categoryDropdownBtn,
                    compatOnly
                      ? {
                          backgroundColor: '#FF5A0A',
                          borderColor: '#FF5A0A',
                        }
                      : {
                          borderColor: '#E2E8F0',
                        },
                  ]}
                  onPress={() => setCompatOnly((v) => !v)}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon
                    name={compatOnly ? 'check-circle-fill' : 'shield-check'}
                    size={13}
                    color={compatOnly ? '#FFFFFF' : '#FF5A0A'}
                  />
                  <Text
                    style={[
                      webStyles.categoryDropdownBtnText,
                      compatOnly && { color: '#FFFFFF', fontWeight: '800' },
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
                    color={filterSort !== 'all' ? '#FF5A0A' : '#64748B'}
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
                    color={filterSort !== 'all' ? '#FF5A0A' : '#94A3B8'}
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
                    <View
                      style={[
                        webStyles.categoryDropdownMenu,
                        { right: 0, left: 'auto', minWidth: 160 },
                      ]}
                    >
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
                                color={isActive ? '#FF5A0A' : '#64748B'}
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
                            {isActive && <BootstrapIcon name="check" size={14} color="#FF5A0A" />}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                )}
              </View>
            </View>
          </View>

          {/* ─── 4. MOTORCYCLE CATEGORIES ROW (8 attractive cards matching reference UI) ─── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom: 4,
              width: windowWidth >= 1024 ? '100%' : 'auto',
            }}
            style={{ width: '100%', marginBottom: 28 }}
          >
            <View style={webStyles.categoryRowWrap}>
              {SHOP_CATEGORIES.map((cat) => {
                const isActive = selectedCategory.toLowerCase() === cat.name.toLowerCase();
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[webStyles.categoryCard, isActive && webStyles.categoryCardActive]}
                    onPress={() => {
                      if (cat.isMore) {
                        setIsCategoryDropdownOpen((prev) => !prev);
                      } else if (isActive) {
                        setSelectedCategory('All');
                      } else {
                        setSelectedCategory(cat.name);
                      }
                    }}
                    activeOpacity={0.85}
                  >
                    <View style={webStyles.categoryCardImgWrap}>
                      {cat.image ? (
                        <Image
                          source={{ uri: cat.image }}
                          style={webStyles.categoryCardImg}
                          resizeMode="contain"
                        />
                      ) : (
                        <BootstrapIcon
                          name={cat.icon || 'grid-fill'}
                          size={24}
                          color={isActive ? '#FF5A0A' : '#64748B'}
                        />
                      )}
                    </View>
                    <Text
                      style={[
                        webStyles.categoryCardLabel,
                        isActive && webStyles.categoryCardLabelActive,
                      ]}
                      numberOfLines={1}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* ─── 5. FEATURED PRODUCTS: TOP PICKS FOR YOUR RIDE ─── */}
          <View
            id="catalog-products-section"
            style={{
              marginBottom: 18,
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <View>
              <Text
                style={{
                  color: '#FF5A0A',
                  fontSize: 11,
                  fontWeight: '900',
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                  marginBottom: 4,
                }}
              >
                FEATURED PRODUCTS
              </Text>
              <Text
                style={{
                  fontSize: 26,
                  fontWeight: '900',
                  color: isDarkMode ? '#FFFFFF' : '#111827',
                  letterSpacing: -0.5,
                }}
              >
                Top Picks for Your Ride
              </Text>
              <Text style={{ fontSize: 13, color: '#64748B', marginTop: 3 }}>
                High-quality products from trusted brands. Built for performance, designed for riders.
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => {
                setSelectedCategory('All');
                setSearchQuery('');
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                paddingBottom: 4,
              }}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#FF5A0A', fontSize: 13, fontWeight: '800' }}>
                View All Products
              </Text>
              <BootstrapIcon name="arrow-right" size={13} color="#FF5A0A" />
            </TouchableOpacity>
          </View>

          {/* Product Multi-Column Grid */}
          <View style={[webStyles.productGrid, { gap: gapSize }]}>
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
              const hasDiscount =
                product.compare_at_price && Number(product.compare_at_price) > Number(product.price);
              const discountPercent = hasDiscount
                ? Math.round(
                    ((Number(product.compare_at_price) - Number(product.price)) /
                      Number(product.compare_at_price)) *
                      100
                  )
                : 0;

              return (
                <TouchableOpacity
                  key={product.id}
                  style={[webStyles.productCard, { width: cardWidth }]}
                  className={`${isDarkMode ? 'bg-[#1C2229] border-[#2D3742]' : 'bg-white border-slate-200/90'} rounded-2xl border shadow-sm overflow-hidden mb-3 cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1`}
                  onPress={() => {
                    setSelectedProduct(product);
                    setIsSpecsOpen(true);
                  }}
                  activeOpacity={0.92}
                >
                  {/* 1:1 Square Product Image */}
                  <View
                    style={webStyles.productImgContainer}
                    className={`w-full aspect-square ${isDarkMode ? 'bg-[#171C22]' : 'bg-slate-50'} relative overflow-hidden`}
                  >
                    <Image
                      source={{ uri: product.image }}
                      style={webStyles.productImg}
                      resizeMode="cover"
                      className="w-full h-full object-cover"
                    />

                    {/* Stock / Discount Pill Badge (Top-Left) */}
                    {hasDiscount ? (
                      <View style={webStyles.productCardDiscountBadge}>
                        <Text style={webStyles.productCardDiscountBadgeText}>-{discountPercent}%</Text>
                      </View>
                    ) : (
                      <View
                        style={[
                          webStyles.productCardStockBadge,
                          product.stock <= 0 && {
                            backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2',
                            borderColor: '#FCA5A5',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            webStyles.productCardStockBadgeText,
                            product.stock <= 0 && { color: '#DC2626' },
                          ]}
                        >
                          {product.stock <= 0 ? 'Sold Out' : 'In Stock'}
                        </Text>
                      </View>
                    )}

                    {/* Compatibility Indicator (Top-Left Overlay) */}
                    <CompatibilityIndicator
                      status={product.compatStatus}
                      bike={activeBike}
                      message={product.compatMessage}
                    />

                    {/* Wishlist Button (Top-Right) */}
                    <TouchableOpacity
                      style={webStyles.wishlistBtn}
                      className={`absolute top-2 right-2 w-8 h-8 rounded-full ${isDarkMode ? 'bg-[#171C22]/90' : 'bg-white/95'} items-center justify-center shadow-sm z-10 hover:scale-110 transition-transform`}
                      onPress={(e) => {
                        e?.stopPropagation?.();
                        toggleWishlist(product.id);
                      }}
                      activeOpacity={0.8}
                    >
                      <BootstrapIcon
                        name={isFav ? 'heart-fill' : 'heart'}
                        size={14}
                        color={isFav ? '#EF4444' : isDarkMode ? '#94A3B8' : '#64748B'}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Details */}
                  <View
                    style={webStyles.productDetails}
                    className={`p-3.5 ${isDarkMode ? 'bg-[#1C2229]' : 'bg-white'} flex flex-col justify-between flex-1`}
                  >
                    <View>
                      {/* Product Name */}
                      <Text
                        style={webStyles.productName}
                        numberOfLines={2}
                        className={`text-[13px] font-bold ${isDarkMode ? 'text-[#F9FAFB]' : 'text-slate-900'} leading-[18px] mb-1 h-[36px]`}
                      >
                        {product.name}
                      </Text>

                      {/* Brand / Motorcycle Fitment Label */}
                      <Text
                        style={webStyles.productCardFitmentText}
                        numberOfLines={1}
                      >
                        {product.compatStatus === COMPAT_STATUS.COMPATIBLE && activeBike
                          ? `✓ Fits ${activeBike.brand} ${activeBike.model}`
                          : product.brand || 'Universal Fit'}
                      </Text>

                      {/* Star Rating Row */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginVertical: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
                          {[1, 2, 3, 4, 5].map((s) => (
                            <BootstrapIcon
                              key={s}
                              name={s <= Math.round(Number(product.rating || 5)) ? 'star-fill' : 'star'}
                              size={10.5}
                              color="#F59E0B"
                            />
                          ))}
                        </View>
                        <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '500' }}>
                          ({product.reviews || 95})
                        </Text>
                      </View>

                      {/* Price Row: Peso sign and amount */}
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4, marginBottom: 4 }}>
                        {hasDiscount && (
                          <Text
                            style={{
                              fontSize: 12.5,
                              color: '#94A3B8',
                              textDecorationLine: 'line-through',
                              fontWeight: '500',
                            }}
                          >
                            ₱{Number(product.compare_at_price).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </Text>
                        )}
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: '900',
                            color: '#FF5A0A',
                          }}
                        >
                          ₱{Number(product.price).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </Text>
                      </View>
                    </View>

                    {/* Full-width Bright Orange Add to Cart Button */}
                    <TouchableOpacity
                      style={webStyles.productCardAddBtn}
                      onPress={(e) => {
                        e?.stopPropagation?.();
                        handleAddToCartAttempt(product, 1);
                      }}
                      activeOpacity={0.88}
                    >
                      <BootstrapIcon name="cart3" size={13} color="#FFFFFF" />
                      <Text style={webStyles.productCardAddBtnText}>Add to Cart</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* ─── 6. PROFESSIONAL SERVICE BANNER (Matching reference UI) ─── */}
        <View style={webStyles.serviceBannerWrap}>
          <View style={webStyles.serviceBannerInner}>
            {/* Left: Headline & Service CTAs */}
            <View style={webStyles.serviceBannerLeft}>
              <Text style={webStyles.serviceBannerEyebrow}>PROFESSIONAL SERVICES</Text>
              <Text style={webStyles.serviceBannerTitle}>Book Your Service Today</Text>
              <Text style={webStyles.serviceBannerSub}>
                Keep your motorcycle in top condition with our expert technicians and quality service.
              </Text>
              <View style={webStyles.serviceBannerBtns}>
                <TouchableOpacity
                  style={webStyles.serviceBannerPrimaryBtn}
                  onPress={() => onNavigateToScreen?.('garage')}
                  activeOpacity={0.88}
                >
                  <Text style={webStyles.serviceBannerPrimaryBtnText}>Book a Service</Text>
                  <BootstrapIcon name="arrow-right" size={13} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={webStyles.serviceBannerSecondaryBtn}
                  onPress={() => onNavigateToScreen?.('garage')}
                  activeOpacity={0.85}
                >
                  <Text style={webStyles.serviceBannerSecondaryBtnText}>View Service Packages</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Center: Popular Services with Orange Icons */}
            <View style={webStyles.serviceBannerCenter}>
              <Text style={webStyles.servicePopularTitle}>Popular Services</Text>
              <View style={webStyles.servicePopularList}>
                {[
                  { name: 'General Check-up', icon: 'wrench' },
                  { name: 'Oil Change', icon: 'droplet-fill' },
                  { name: 'Brake Service', icon: 'gear-fill' },
                  { name: 'Tire Change', icon: 'circle' },
                  { name: 'Chain & Sprocket', icon: 'link-45deg' },
                  { name: 'Tune Up', icon: 'tools' },
                ].map((srv) => (
                  <View key={srv.name} style={webStyles.servicePopularItem}>
                    <BootstrapIcon name={srv.icon} size={13} color="#FF5A0A" />
                    <Text style={webStyles.servicePopularItemText}>{srv.name}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Right: Expert Care accent card */}
            <View style={webStyles.serviceBannerRight}>
              <Image
                source={{
                  uri: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=600&q=80',
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  opacity: 0.35,
                  width: '100%',
                  height: '100%',
                }}
                resizeMode="cover"
              />
              <View style={{ zIndex: 2 }}>
                <Text style={webStyles.serviceBannerRightTitle}>
                  Expert Care{'\n'}
                  <Text style={{ color: '#FF5A0A' }}>for a Smoother Ride</Text>
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ─── 7. THREE PROMOTIONAL CARDS (Special Offer, Free Shipping, Genuine Parts) ─── */}
        <View style={webStyles.promoCardsRow}>
          {/* Card 1: Special Offer */}
          <View style={webStyles.promoCard}>
            <Image
              source={{
                uri: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=400&q=80',
              }}
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                bottom: 0,
                width: '45%',
                opacity: 0.32,
              }}
              resizeMode="cover"
            />
            <View style={{ zIndex: 2 }}>
              <Text style={webStyles.promoCardTag}>SPECIAL OFFER</Text>
              <Text style={webStyles.promoCardTitle}>Up to 20% Off on Helmets</Text>
              <Text style={webStyles.promoCardSub}>Ride safe, ride in style.</Text>
            </View>
            <TouchableOpacity
              style={webStyles.promoCardLink}
              onPress={() => setSelectedCategory('Helmets')}
              activeOpacity={0.85}
            >
              <Text style={webStyles.promoCardLinkText}>Shop Now</Text>
              <BootstrapIcon name="arrow-right" size={13} color="#FF5A0A" />
            </TouchableOpacity>
          </View>

          {/* Card 2: Free Shipping Nationwide */}
          <View style={webStyles.promoCard}>
            <Image
              source={{
                uri: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=400&q=80',
              }}
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                bottom: 0,
                width: '45%',
                opacity: 0.25,
              }}
              resizeMode="cover"
            />
            <View style={{ zIndex: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <BootstrapIcon name="truck" size={12} color="#FF5A0A" />
                <Text style={webStyles.promoCardTag}>FREE SHIPPING</Text>
              </View>
              <Text style={webStyles.promoCardTitle}>Free Shipping Nationwide</Text>
              <Text style={webStyles.promoCardSub}>For orders over ₱1,000</Text>
            </View>
            <TouchableOpacity
              style={webStyles.promoCardLink}
              onPress={() => {
                setSelectedCategory('All');
                showToast?.('Free shipping applied on orders over ₱1,000!');
              }}
              activeOpacity={0.85}
            >
              <Text style={webStyles.promoCardLinkText}>Shop Now</Text>
              <BootstrapIcon name="arrow-right" size={13} color="#FF5A0A" />
            </TouchableOpacity>
          </View>

          {/* Card 3: Genuine Parts Only */}
          <View style={webStyles.promoCard}>
            <Image
              source={{
                uri: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=400&q=80',
              }}
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                bottom: 0,
                width: '45%',
                opacity: 0.28,
              }}
              resizeMode="cover"
            />
            <View style={{ zIndex: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <BootstrapIcon name="gear-fill" size={12} color="#FF5A0A" />
                <Text style={webStyles.promoCardTag}>GENUINE PARTS ONLY</Text>
              </View>
              <Text style={webStyles.promoCardTitle}>Genuine Parts Only</Text>
              <Text style={webStyles.promoCardSub}>
                100% original and trusted brands for your peace of mind.
              </Text>
            </View>
            <TouchableOpacity
              style={webStyles.promoCardLink}
              onPress={() => handleOpenCompanyInfo('about')}
              activeOpacity={0.85}
            >
              <Text style={webStyles.promoCardLinkText}>Learn More</Text>
              <BootstrapIcon name="arrow-right" size={13} color="#FF5A0A" />
            </TouchableOpacity>
          </View>
        </View>
        </View>

        {/* ─── 8. FULL-WIDTH DARK CHARCOAL FOOTER (Flush with viewport) ─── */}
        <View style={webStyles.desktopFooter}>
          <View style={webStyles.footerInner}>
            <View style={webStyles.footerColumnsRow}>
              {/* Column 1: Brand Info & Tagline */}
              <View style={webStyles.footerBrandCol}>
                <TouchableOpacity
                  style={{ alignSelf: 'flex-start', marginBottom: 12 }}
                  onPress={() => {
                    setSelectedCategory('All');
                    setSearchQuery('');
                  }}
                  activeOpacity={0.85}
                >
                  <BrandLogo size={36} textColor="#FFFFFF" />
                </TouchableOpacity>
                <Text style={{ fontSize: 13, color: '#94A3B8', marginTop: 8, fontWeight: '500' }}>
                  Ride Better. Go Further.
                </Text>
              </View>

              {/* Column 2: Quick Links */}
              <View style={webStyles.footerCol}>
                <View style={webStyles.footerColTitleRow}>
                  <Text style={webStyles.footerColTitle}>Quick Links</Text>
                </View>
                <TouchableOpacity
                  style={webStyles.footerLinkItem}
                  activeOpacity={0.7}
                  onPress={() => {
                    setSelectedCategory('All');
                    setSearchQuery('');
                  }}
                >
                  <Text style={webStyles.footerLinkText}>Shop</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={webStyles.footerLinkItem}
                  activeOpacity={0.7}
                  onPress={() => onNavigateToScreen?.('garage')}
                >
                  <Text style={webStyles.footerLinkText}>Book a Service</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={webStyles.footerLinkItem}
                  activeOpacity={0.7}
                  onPress={() => onNavigateToScreen?.('customizer')}
                >
                  <Text style={webStyles.footerLinkText}>Customize</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={webStyles.footerLinkItem}
                  activeOpacity={0.7}
                  onPress={() => handleOpenCompanyInfo('about')}
                >
                  <Text style={webStyles.footerLinkText}>About Us</Text>
                </TouchableOpacity>
              </View>

              {/* Column 3: Customer Care */}
              <View style={webStyles.footerCol}>
                <View style={webStyles.footerColTitleRow}>
                  <Text style={webStyles.footerColTitle}>Customer Care</Text>
                </View>
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
                  onPress={() => handleOpenCompanyInfo('shipping')}
                >
                  <Text style={webStyles.footerLinkText}>Shipping & Delivery</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={webStyles.footerLinkItem}
                  activeOpacity={0.7}
                  onPress={() => handleOpenCompanyInfo('returns')}
                >
                  <Text style={webStyles.footerLinkText}>Returns & Refunds</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={webStyles.footerLinkItem}
                  activeOpacity={0.7}
                  onPress={() => handleOpenCompanyInfo('contact')}
                >
                  <Text style={webStyles.footerLinkText}>Contact Us</Text>
                </TouchableOpacity>
              </View>

              {/* Column 4: Stay Connected (Newsletter + Social Icons) */}
              <View style={[webStyles.footerCol, { minWidth: 260 }]}>
                <View style={webStyles.footerColTitleRow}>
                  <Text style={webStyles.footerColTitle}>Stay Connected</Text>
                </View>
                <Text style={{ fontSize: 12, color: '#94A3B8', marginBottom: 12 }}>
                  Get the latest updates, promos and more.
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                    paddingLeft: 12,
                    paddingRight: 4,
                    height: 40,
                    marginBottom: 16,
                  }}
                >
                  <TextInput
                    placeholder="Enter your email address"
                    placeholderTextColor="#94A3B8"
                    value={newsletterEmail}
                    onChangeText={setNewsletterEmail}
                    style={{
                      flex: 1,
                      color: '#FFFFFF',
                      fontSize: 12.5,
                      outlineStyle: 'none',
                      paddingVertical: 0,
                    }}
                  />
                  <TouchableOpacity
                    onPress={() => {
                      if (!newsletterEmail || !newsletterEmail.includes('@')) {
                        showToast?.('Please enter a valid email address');
                        return;
                      }
                      showToast?.('Thank you for subscribing to MotoTrack!');
                      setNewsletterEmail('');
                    }}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      backgroundColor: '#FF5A0A',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon name="arrow-right" size={13} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>

                {/* Social media icons */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {[
                    { icon: 'facebook', label: 'Facebook' },
                    { icon: 'instagram', label: 'Instagram' },
                    { icon: 'youtube', label: 'YouTube' },
                    { icon: 'tiktok', label: 'TikTok' },
                  ].map((soc) => (
                    <TouchableOpacity
                      key={soc.icon}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        borderWidth: 1,
                        borderColor: 'rgba(255, 255, 255, 0.12)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                      activeOpacity={0.75}
                      onPress={() => showToast?.(`Opening ${brandSettings?.storeName || 'MotoTrack'} ${soc.label}`)}
                    >
                      <BootstrapIcon name={soc.icon} size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Horizontal Divider Line */}
            <View style={webStyles.footerDivider} />

            {/* Bottom Bar: Copyright + Legal Links */}
            <View style={webStyles.footerBottomRow}>
              <Text style={webStyles.footerCopyrightText}>
                © 2025 {brandSettings?.storeName || 'MOTOTRACK'}. All rights reserved.
              </Text>

              <View style={webStyles.footerLegalLinksRow}>
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
                  <Text style={webStyles.footerLegalLinkText}>Privacy Policy</Text>
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

      {/* Mobile Customer Navigation Drawer */}
      <CustomerMobileNavDrawer
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
        currentScreen="shop"
        onNavigateToScreen={onNavigateToScreen}
        unreadNotifCount={unreadNotifCount}
      />
    </View>
  );
}
