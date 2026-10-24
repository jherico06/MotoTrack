import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, SafeAreaView, RefreshControl, useWindowDimensions, TouchableOpacity, Modal, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';

// ─── STYLES & DATA ──────────────────────────────────────────────────────────
import { shopStyles as styles } from '../../../styles/shop.styles.js';
import { productService } from '../../../services/products/productService.js';
import { orderService } from '../../../services/orders/orderService.js';
import { systemSettingsService } from '../../../services/system/systemSettingsService.js';

// ─── CONTEXTS ───────────────────────────────────────────────────────────────
import { useAuth } from '../../../context/AuthContext.jsx';
import { useCart } from '../../../context/CartContext.jsx';
import { useWishlist } from '../../../context/WishlistContext.jsx';
import { useTheme } from '../../../context/ThemeContext.jsx';
import { productNeedsSizes, withSelectedSize, isSizeSoldOut } from '../../../utils/productSizes.js';
import { getRatedScore } from '../../../utils/productCatalog.js';

// ─── COMPONENTS & MODALS ───────────────────────────────────────────────────
import {
  BottomNavBar,
  ToastNotification,
  MobileHeader,
  HeroBanner,
  FilterChips,
  ProductCard,
  ProductSpecsModal,
  CartModal,
  CheckoutModal,
  ProfileModal,
  AccessDeniedModal,
  LiveOrderTrackingMapModal,
  GCashPaymentModal,
  CompanyInfoModal,
} from '../../../components';
import { BootstrapIcon } from '../../../components/common';
import {
  compatibilityService,
  COMPAT_STATUS,
} from '../../../services/products/compatibilityService.js';
import { motorcycleService } from '../../../services/products/motorcycleService.js';

export default function ShopPage({ onNavigateToScreen }) {
  // Contexts
  const { currentUser, setRedirectReason, logout } = useAuth();
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
  const { wishlistCount } = useWishlist();
  const { isDarkMode = false } = useTheme?.() || {};

  const { width } = useWindowDimensions();
  const isSmallMobile = width < 380;

  // Local state
  const [productsList, setProductsList] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [brandSettings, setBrandSettings] = useState(() =>
    typeof systemSettingsService?.getSettings === 'function'
      ? systemSettingsService.getSettings()
      : {}
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [filterSort, setFilterSort] = useState('default');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [priceFilter, setPriceFilter] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeBike, setActiveBike] = useState(null);
  const [userBikes, setUserBikes] = useState([]);
  const [isBikeModalOpen, setIsBikeModalOpen] = useState(false);
  const [compatMap, setCompatMap] = useState(null);
  const [compatOnly, setCompatOnly] = useState(false);
  const [buyNowFreeShipping, setBuyNowFreeShipping] = useState(false);
  const [buyNowFreeShippingPromoId, setBuyNowFreeShippingPromoId] = useState(null);

  // Modals state
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isSpecsOpen, setIsSpecsOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAccessDeniedModalOpen, setIsAccessDeniedModalOpen] = useState(false);
  const [isCompanyInfoOpen, setIsCompanyInfoOpen] = useState(false);
  const [companyInfoTab, setCompanyInfoTab] = useState('about');

  const handleOpenCompanyInfo = (tab = 'about') => {
    setCompanyInfoTab(tab);
    setIsCompanyInfoOpen(true);
  };
  const [isLiveTrackingOpen, setIsLiveTrackingOpen] = useState(false);
  const [selectedOrderForTracking, setSelectedOrderForTracking] = useState(null);
  const [isGcashModalOpen, setIsGcashModalOpen] = useState(false);
  const [pendingGcashOrderData, setPendingGcashOrderData] = useState(null);
  const [buyNowItems, setBuyNowItems] = useState(null); // null = use cart; array = buy-now checkout

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

  // Load products from DB or fallback
  const refreshProducts = useCallback(async () => {
    setIsLoadingProducts(true);
    try {
      const data = await productService.getProducts();
      if (Array.isArray(data)) {
        setProductsList(data);
      }
    } finally {
      setIsLoadingProducts(false);
    }
  }, []);

  const handlePullRefresh = async () => {
    setIsRefreshing(true);
    await refreshProducts();
    setIsRefreshing(false);
    showToast('Catalog refreshed from Supabase');
  };

  useEffect(() => {
    let alive = true;
    productService
      .getProducts()
      .then((data) => {
        if (alive && Array.isArray(data)) {
          setProductsList(data);
        }
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
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (typeof systemSettingsService?.subscribe === 'function') {
      const unsub = systemSettingsService.subscribe((settings) => {
        if (settings) setBrandSettings(settings);
      });
      return () => unsub?.();
    }
  }, []);

  const loadUserBikes = useCallback(async () => {
    const userId = currentUser?.id || currentUser?.user_id || currentUser?.customer_id;
    const customerEmail = currentUser?.email || '';

    try {
      if (userId) {
        await motorcycleService.syncFromSupabase?.(userId, customerEmail);
      }
    } catch (_e) {}

    let bikes = [];
    if (userId || customerEmail) {
      bikes =
        motorcycleService.getMotorcycles(
          userId,
          currentUser?.customerId || currentUser?.customer_id,
          customerEmail
        ) || [];
    } else {
      bikes = motorcycleService.getMotorcycles() || [];
    }

    let validBikes = Array.isArray(bikes) ? bikes.filter((m) => m && m.brand && m.model) : [];

    // Fallback: If currentUser has bikeBrand & bikeModel on profile but not in customer_motorcycles
    if (currentUser?.bikeBrand && currentUser?.bikeModel) {
      const alreadyHas = validBikes.some(
        (b) =>
          b.brand?.toLowerCase() === currentUser.bikeBrand.toLowerCase() &&
          b.model?.toLowerCase() === currentUser.bikeModel.toLowerCase()
      );
      if (!alreadyHas) {
        validBikes.unshift({
          motorcycle_id: 'profile-moto',
          id: 'profile-moto',
          brand: currentUser.bikeBrand,
          model: currentUser.bikeModel,
          plate_number: currentUser.bikePlate || 'N/A',
          is_primary: true,
          nickname: 'Registered Motorcycle',
        });
      }
    }

    setUserBikes(validBikes);

    // Pick active bike: keep current if valid, else pick primary or first registered
    setActiveBike((prev) => {
      if (
        prev &&
        validBikes.some(
          (b) =>
            (b.motorcycle_id && b.motorcycle_id === prev.motorcycle_id) ||
            (b.brand === prev.brand && b.model === prev.model)
        )
      ) {
        return prev;
      }
      return validBikes.find((b) => b.is_primary) || validBikes[0] || null;
    });
  }, [currentUser]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const map = await compatibilityService.getCompatibilityMap();
      if (alive) setCompatMap(map);
      await loadUserBikes();
    })();

    const unsub = motorcycleService.subscribe(() => {
      if (alive) loadUserBikes();
    });

    return () => {
      alive = false;
      unsub?.();
    };
  }, [loadUserBikes]);

  // Filtered & Sorted products list
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

      // Rating filter — unrated products are 0, not a fake 5.0
      let matchRating = true;
      const itemRating = getRatedScore(item);
      if (ratingFilter === '5') matchRating = itemRating >= 5.0;
      else if (ratingFilter === '4.5') matchRating = itemRating >= 4.5;
      else if (ratingFilter === '4') matchRating = itemRating >= 4.0;

      // Price filter range
      let matchPrice = true;
      const p = Number(item.price || 0);
      if (priceFilter === 'under-1000') matchPrice = p < 1000;
      else if (priceFilter === '1000-5000') matchPrice = p >= 1000 && p <= 5000;
      else if (priceFilter === 'above-5000') matchPrice = p > 5000;

      return matchCategory && matchSearch && matchRating && matchPrice;
    });

    list = compatibilityService.annotateProducts(list, activeBike, map);
    if (compatOnly && activeBike) {
      list = list.filter((p) => p.compatStatus === COMPAT_STATUS.COMPATIBLE);
    }

    // Sorting
    if (priceFilter === 'price-low' || filterSort === 'price-low') {
      list = [...list].sort((a, b) => a.price - b.price);
    } else if (priceFilter === 'price-high' || filterSort === 'price-high') {
      list = [...list].sort((a, b) => b.price - a.price);
    } else if (ratingFilter === 'sort-rating' || filterSort === 'rating') {
      list = [...list].sort((a, b) => getRatedScore(b) - getRatedScore(a));
    }

    return list;
  }, [
    productsList,
    selectedCategory,
    searchQuery,
    filterSort,
    ratingFilter,
    priceFilter,
    activeBike,
    compatMap,
    compatOnly,
  ]);

  // Add to cart with auth check
  const handleAddToCartAttempt = (product, qty = 1, options = {}) => {
    if (!currentUser) {
      setRedirectReason('Please sign in or create an account to add items to your cart.');
      onNavigateToScreen?.('login');
      return;
    }
    const size = options.size || product?.selectedSize || '';
    if (productNeedsSizes(product) && !size) {
      if (onNavigateToScreen) {
        onNavigateToScreen('product-details', { product });
      } else {
        setSelectedProduct(product);
        setIsSpecsOpen(true);
      }
      showToast('Select a size for this product');
      return;
    }
    if (size && isSizeSoldOut(product, size)) {
      if (onNavigateToScreen) {
        onNavigateToScreen('product-details', { product });
      } else {
        setSelectedProduct(product);
        setIsSpecsOpen(true);
      }
      showToast(`Size ${size} is sold out`);
      return;
    }
    const warn =
      product.compatStatus === COMPAT_STATUS.INCOMPATIBLE && activeBike
        ? `⚠ This part is not marked as compatible with your ${compatibilityService.bikeLabel(activeBike)}.`
        : null;
    addToCart(product, qty, { size, compatWarning: warn });
  };

  // Buy Now — skip cart, go straight to checkout (login required)
  const handleBuyNowAttempt = (product, qty = 1, options = {}) => {
    if (!currentUser) {
      setRedirectReason('Please sign in or create an account to buy this item.');
      onNavigateToScreen?.('login');
      return;
    }
    const size = options.size || product?.selectedSize || '';
    if (productNeedsSizes(product) && !size) {
      if (onNavigateToScreen) {
        onNavigateToScreen('product-details', { product });
      } else {
        setSelectedProduct(product);
        setIsSpecsOpen(true);
      }
      showToast('Select a size for this product');
      return;
    }
    if (size && isSizeSoldOut(product, size)) {
      if (onNavigateToScreen) {
        onNavigateToScreen('product-details', { product });
      } else {
        setSelectedProduct(product);
        setIsSpecsOpen(true);
      }
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

  // Checkout attempt with auth check
  const handleProceedToCheckout = () => {
    if (!currentUser) {
      setIsCartOpen(false);
      setRedirectReason('Please sign in with your customer account to complete your checkout and delivery.');
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

  // Place order
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

  const handleSelectBike = (bike) => {
    setActiveBike(bike);
    if (!bike) {
      setCompatOnly(false);
    }
    setIsBikeModalOpen(false);
    showToast(bike ? `Selected ${bike.brand} ${bike.model}` : 'Cleared motorcycle filter');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" translucent backgroundColor="transparent" />

      {/* Toast Notification */}
      <ToastNotification message={toastMessage} />

      {/* Fixed Sticky Mobile Header (Charcoal Background) */}
      <MobileHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filterSort={filterSort}
        onCycleFilterSort={() => {
          setFilterSort((prev) =>
            prev === 'all' ? 'price-low' : prev === 'price-low' ? 'rating' : 'all'
          );
        }}
        onOpenCart={() => {
          if (!currentUser) {
            setRedirectReason('Please sign in to view and manage your shopping cart.');
            onNavigateToScreen?.('login');
          } else {
            setIsCartOpen(true);
          }
        }}
        onOpenProfile={() => {
          if (!currentUser) {
            setRedirectReason('Please sign in to access your account.');
            onNavigateToScreen?.('login');
          } else {
            onNavigateToScreen?.('profile', { tab: 'menu' });
          }
        }}
        onNavigateToLogin={() => {
          setRedirectReason('');
          onNavigateToScreen?.('login');
        }}
        onNavigateToNotifications={() => onNavigateToScreen?.('notifications')}
        onNavigateToWishlist={() => onNavigateToScreen?.('wishlist')}
        onNavigateToAdmin={() => {
          if (currentUser?.role === 'admin') {
            onNavigateToScreen?.('admin');
          } else {
            setIsAccessDeniedModalOpen(true);
          }
        }}
      />

      <ScrollView
        style={[styles.container, isDarkMode && { backgroundColor: '#121518' }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handlePullRefresh}
            colors={['#EA580C']}
            tintColor="#EA580C"
          />
        }
      >
        <View style={[styles.maxContainer, { paddingHorizontal: isSmallMobile ? 12 : 14 }]}>
          {/* Hero Promo Banner */}
          <HeroBanner onSelectCategory={(cat) => setSelectedCategory(cat)} showToast={showToast} />

          {/* Filter Chips Row: Category, Motorcycle Selector & Compatibility Filter Aligned */}
          <FilterChips
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            productsList={productsList}
            activeBike={activeBike}
            onOpenBikeModal={() => setIsBikeModalOpen(true)}
            compatOnly={compatOnly}
            onToggleCompatOnly={() => {
              if (!activeBike) {
                showToast('Select a motorcycle to filter compatible parts');
                setIsBikeModalOpen(true);
              } else {
                setCompatOnly((v) => !v);
              }
            }}
          />

          {/* Motorcycle Selection Bottom Sheet Modal (Mobile) */}
          <Modal
            visible={isBikeModalOpen}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setIsBikeModalOpen(false)}
          >
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'flex-end' }}
              activeOpacity={1}
              onPress={() => setIsBikeModalOpen(false)}
            >
              <TouchableOpacity
                activeOpacity={1}
                style={{
                  backgroundColor: isDarkMode ? '#1C1F23' : '#FFFFFF',
                  borderTopLeftRadius: 28,
                  borderTopRightRadius: 28,
                  paddingHorizontal: 16,
                  paddingTop: 16,
                  paddingBottom: Platform.OS === 'ios' ? 28 : 16,
                  maxHeight: '75%',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: -4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 16,
                  elevation: 20,
                }}
              >
                {/* ─── MODAL HEADER ─── */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBottom: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: isDarkMode ? '#2B3035' : '#F1F5F9',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        backgroundColor: isDarkMode ? '#2B1A0A' : '#FFF7ED',
                        borderWidth: 1,
                        borderColor: isDarkMode ? '#43230A' : '#FED7AA',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <BootstrapIcon name="scooter" size={16} color="#EA580C" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16.5, fontWeight: '800', color: isDarkMode ? '#F9FAFB' : '#0F172A' }}>
                        Select Active Motorcycle
                      </Text>
                      <Text style={{ fontSize: 12, color: isDarkMode ? '#94A3B8' : '#64748B', marginTop: 1 }}>
                        Filter parts by your registered motorcycle ({userBikes.length} registered)
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => setIsBikeModalOpen(false)}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: isDarkMode ? '#23272B' : '#F1F5F9',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    activeOpacity={0.7}
                  >
                    <BootstrapIcon name="x-lg" size={14} color={isDarkMode ? '#94A3B8' : '#64748B'} />
                  </TouchableOpacity>
                </View>

                {/* ─── LIST OF MOTORCYCLES ─── */}
                <ScrollView showsVerticalScrollIndicator={false} style={{ marginVertical: 10 }}>
                  {/* Option: All Motorcycles (No Filter) */}
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 11,
                      paddingHorizontal: 12,
                      borderRadius: 14,
                      marginBottom: 8,
                      backgroundColor: !activeBike ? (isDarkMode ? '#2B1A0A' : '#FFF7ED') : (isDarkMode ? '#23272B' : '#F8FAFC'),
                      borderWidth: 1,
                      borderColor: !activeBike ? '#EA580C' : (isDarkMode ? '#2B3035' : '#E2E8F0'),
                    }}
                    onPress={() => handleSelectBike(null)}
                    activeOpacity={0.75}
                  >
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        backgroundColor: !activeBike ? '#EA580C' : (isDarkMode ? '#1C1F23' : '#F3F4F6'),
                        borderWidth: 1,
                        borderColor: !activeBike ? '#EA580C' : (isDarkMode ? '#2B3035' : '#E5E7EB'),
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 10,
                      }}
                    >
                      <BootstrapIcon
                        name="grid-fill"
                        size={14}
                        color={!activeBike ? '#FFFFFF' : (isDarkMode ? '#94A3B8' : '#64748B')}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 13.5,
                          fontWeight: !activeBike ? '800' : '700',
                          color: !activeBike ? '#EA580C' : (isDarkMode ? '#F9FAFB' : '#1E293B'),
                        }}
                      >
                        All Motorcycles (No Filter)
                      </Text>
                      <Text style={{ fontSize: 11, color: isDarkMode ? '#94A3B8' : '#64748B', marginTop: 1 }}>
                        Browse entire catalog without compatibility restrictions
                      </Text>
                    </View>
                    {!activeBike && (
                      <BootstrapIcon name="check-circle-fill" size={16} color="#EA580C" />
                    )}
                  </TouchableOpacity>

                  {userBikes.length === 0 ? (
                    <View style={{ padding: 24, alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center' }}>
                        {currentUser
                          ? 'No motorcycles found in your garage.'
                          : 'Sign in to select your registered motorcycle.'}
                      </Text>
                      {currentUser && (
                        <TouchableOpacity
                          style={{
                            marginTop: 12,
                            backgroundColor: '#EA580C',
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            borderRadius: 12,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                          }}
                          onPress={() => {
                            setIsBikeModalOpen(false);
                            onNavigateToScreen?.('profile', { tab: 'garage' });
                          }}
                          activeOpacity={0.8}
                        >
                          <BootstrapIcon name="plus-lg" size={13} color="#FFFFFF" />
                          <Text style={{ fontSize: 12.5, color: '#FFFFFF', fontWeight: '800' }}>
                            Register Motorcycle in Garage
                          </Text>
                        </TouchableOpacity>
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
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingVertical: 11,
                            paddingHorizontal: 12,
                            borderRadius: 14,
                            marginBottom: 8,
                            backgroundColor: isSelected ? (isDarkMode ? '#2B1A0A' : '#FFF7ED') : (isDarkMode ? '#23272B' : '#F8FAFC'),
                            borderWidth: 1,
                            borderColor: isSelected ? '#EA580C' : (isDarkMode ? '#2B3035' : '#E2E8F0'),
                          }}
                          onPress={() => handleSelectBike(b)}
                          activeOpacity={0.75}
                        >
                          <View
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 10,
                              backgroundColor: isSelected ? '#EA580C' : (isDarkMode ? '#1C1F23' : '#F3F4F6'),
                              borderWidth: 1,
                              borderColor: isSelected ? '#EA580C' : (isDarkMode ? '#2B3035' : '#E5E7EB'),
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginRight: 10,
                            }}
                          >
                            <BootstrapIcon
                              name="scooter"
                              size={15}
                              color={isSelected ? '#FFFFFF' : (isDarkMode ? '#94A3B8' : '#64748B')}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontSize: 13.5,
                                fontWeight: isSelected ? '800' : '700',
                                color: isSelected ? '#EA580C' : (isDarkMode ? '#F9FAFB' : '#1E293B'),
                              }}
                            >
                              {b.brand} {b.model} {b.year ? `(${b.year})` : ''}
                            </Text>
                            <Text style={{ fontSize: 11, color: isDarkMode ? '#94A3B8' : '#64748B', marginTop: 1 }}>
                              {b.nickname ? `"${b.nickname}" • ` : ''}
                              {b.engine_displacement ? `${b.engine_displacement}cc` : 'Verified Bike'}
                            </Text>
                          </View>
                          {b.is_primary ? (
                            <View
                              style={{
                                backgroundColor: isSelected ? (isDarkMode ? '#43230A' : '#FFEDD5') : (isDarkMode ? '#064E3B' : '#DCFCE7'),
                                paddingHorizontal: 8,
                                paddingVertical: 2.5,
                                borderRadius: 8,
                                marginRight: 6,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 10,
                                  fontWeight: '800',
                                  color: isSelected ? '#EA580C' : (isDarkMode ? '#34D399' : '#15803D'),
                                }}
                              >
                                Primary
                              </Text>
                            </View>
                          ) : null}
                          {isSelected && (
                            <BootstrapIcon name="check-circle-fill" size={16} color="#EA580C" />
                          )}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>

                {/* ─── FOOTER ACTIONS ─── */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingTop: 12,
                    borderTopWidth: 1,
                    borderTopColor: isDarkMode ? '#2B3035' : '#F1F5F9',
                  }}
                >
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 14,
                      backgroundColor: isDarkMode ? '#23272B' : '#F1F5F9',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onPress={() => {
                      setIsBikeModalOpen(false);
                      onNavigateToScreen?.('profile', { tab: 'garage' });
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#E2E8F0' : '#334155' }}>
                      Manage Garage
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 14,
                      backgroundColor: '#EA580C',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onPress={() => setIsBikeModalOpen(false)}
                    activeOpacity={0.85}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFFFFF' }}>
                      Apply Filter
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>

          {/* Section Title */}
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, isDarkMode && { color: '#F9FAFB' }]}>
              {selectedCategory === 'All' ? 'Featured Products' : `${selectedCategory} Collection`}
            </Text>
            <Text style={[styles.sectionCount, isDarkMode && { color: '#94A3B8' }]}>
              {isLoadingProducts ? 'Loading catalog items...' : `${filteredProducts.length} items available`}
            </Text>
          </View>

          {/* Multi-Column Product Grid */}
          <View style={styles.productGrid}>
            {filteredProducts.length === 0 && !isLoadingProducts ? (
              <View style={{ width: '100%', paddingVertical: 40, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }}>
                <BootstrapIcon name="box-seam" size={38} color={isDarkMode ? '#64748B' : '#94A3B8'} />
                <Text
                  style={{
                    marginTop: 12,
                    fontSize: 15,
                    fontWeight: '700',
                    color: isDarkMode ? '#F9FAFB' : '#0F172A',
                  }}
                >
                  No Products Found
                </Text>
                <Text
                  style={{
                    marginTop: 4,
                    fontSize: 13,
                    color: isDarkMode ? '#94A3B8' : '#64748B',
                    textAlign: 'center',
                    maxWidth: 320,
                  }}
                >
                  {searchQuery
                    ? `No products found matching "${searchQuery}". Try adjusting your keywords.`
                    : 'No products are currently available in this category.'}
                </Text>
              </View>
            ) : (
              filteredProducts.map((product, pIdx) => (
                <ProductCard
                  key={product.id ? `prod-${product.id}` : `prod-${pIdx}`}
                  product={product}
                  bike={activeBike}
                  onPress={(prod) => {
                    if (onNavigateToScreen) {
                      onNavigateToScreen('product-details', { product: prod });
                    } else {
                      setSelectedProduct(prod);
                      setIsSpecsOpen(true);
                    }
                  }}
                />
              ))
            )}
          </View>

          {/* Mobile Footer with Company Links & Copyright */}
          <View style={{ alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              <TouchableOpacity onPress={() => handleOpenCompanyInfo('about')} style={{ paddingVertical: 4, paddingHorizontal: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569' }}>About Us</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 11, color: '#CBD5E1' }}>•</Text>
              <TouchableOpacity onPress={() => handleOpenCompanyInfo('contact')} style={{ paddingVertical: 4, paddingHorizontal: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569' }}>Contact</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 11, color: '#CBD5E1' }}>•</Text>
              <TouchableOpacity onPress={() => handleOpenCompanyInfo('terms')} style={{ paddingVertical: 4, paddingHorizontal: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569' }}>Terms of Service</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 11, color: '#CBD5E1' }}>•</Text>
              <TouchableOpacity onPress={() => handleOpenCompanyInfo('privacy')} style={{ paddingVertical: 4, paddingHorizontal: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569' }}>Privacy Policy</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center' }}>
              © 2026 {brandSettings?.storeName || 'MotoTrack Motorparts & Accessories'}. Official Performance Network.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Persistent Bottom Navigation Bar for Mobile */}
      <BottomNavBar
        activeTab="Home"
        onTabChange={(tab) => {
          if (tab === 'Home') {
            setSelectedCategory('All');
            setSearchQuery('');
          } else if (tab === 'Search') {
            setSelectedCategory('All');
            setSearchQuery('');
          } else if (tab === 'Cart') {
            if (!currentUser) {
              setRedirectReason?.('Please sign in to view and manage your shopping cart.');
              onNavigateToScreen?.('login');
            } else {
              setIsCartOpen(true);
            }
          } else if (tab === 'Wishlist' || tab === 'Favorites') {
            onNavigateToScreen?.('wishlist');
          } else if (tab === 'More') {
            if (!currentUser) {
              setRedirectReason?.('Please sign in to access your Customer Dashboard.');
              onNavigateToScreen?.('login');
            } else {
              onNavigateToScreen?.('profile', { tab: 'menu' });
            }
          } else if (tab === 'Dashboard') {
            if (!currentUser) {
              setRedirectReason?.('Please sign in to access your Customer Dashboard.');
              onNavigateToScreen?.('login');
            } else {
              onNavigateToScreen?.('profile', { tab: 'overview' });
            }
          } else if (tab === 'Bookings') {
            if (!currentUser) {
              setRedirectReason?.('Please sign in to view your pit bookings.');
              onNavigateToScreen?.('login');
            } else {
              onNavigateToScreen?.('profile', { tab: 'bookings' });
            }
          } else if (tab === 'Notifications') {
            onNavigateToScreen?.('notifications');
          } else if (tab === 'Profile') {
            if (!currentUser) {
              setRedirectReason?.('Please sign in to access your Customer Profile.');
              onNavigateToScreen?.('login');
            } else {
              onNavigateToScreen?.('profile', { tab: 'profile' });
            }
          } else if (tab === 'Services') {
            onNavigateToScreen?.('garage');
          } else if (tab === 'Customize') {
            onNavigateToScreen?.('customizer');
          } else if (tab === 'Garage') {
            onNavigateToScreen?.('profile', { tab: 'garage' });
          } else if (tab === 'Orders') {
            onNavigateToScreen?.('orders');
          } else if (tab === 'Admin') {
            if (currentUser?.role === 'admin') {
              onNavigateToScreen?.('admin');
            } else {
              setIsAccessDeniedModalOpen(true);
            }
          }
        }}
        wishlistCount={wishlistCount}
        currentUser={currentUser}
      />

      {/* ─── MODALS ─── */}
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

      <CompanyInfoModal
        visible={isCompanyInfoOpen}
        initialTab={companyInfoTab}
        onClose={() => setIsCompanyInfoOpen(false)}
        showToast={showToast}
      />
    </SafeAreaView>
  );
}
