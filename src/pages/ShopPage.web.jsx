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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

// ─── SERVICES & DATA ────────────────────────────────────────────────────────
import { MOTOR_PARTS } from '../data/motorParts';
import { productService } from '../services/productService';
import { databaseService } from '../services/databaseService';
import { orderService } from '../services/orderService';
import { notificationService } from '../services/notificationService';

// ─── CONTEXTS ───────────────────────────────────────────────────────────────
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';

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
} from '../components';
import { UserProfileDropdown, UserProfileButton, BrandLogo, NotificationDropdown } from '../components/common';
import HeroBanner from '../components/shop/HeroBanner';
import { shopWebStyles as webStyles } from '../styles/web/shopPage.web.styles';

export default function ShopPageWeb({ onNavigateToScreen }) {
  const { width: windowWidth } = useWindowDimensions();
  const { currentUser, logout, setRedirectReason } = useAuth();
  const {
    cart,
    addToCart,
    clearCart,
    cartSubtotal,
    cartItemCount,
    discountAmount,
    shippingFee,
    cartTotal,
    appliedPromoId,
    toastMessage,
    showToast,
  } = useCart();
  const { isWishlisted, toggleWishlist, wishlistCount } = useWishlist();

  // Products & Filter state
  const [productsList, setProductsList] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSort, setFilterSort] = useState('all');
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
  const [unreadNotifCount, setUnreadNotifCount] = useState(() => notificationService.getUnreadCount(currentUser?.id));

  const isBuyNowCheckout = Array.isArray(buyNowItems) && buyNowItems.length > 0;
  const checkoutItems = isBuyNowCheckout ? buyNowItems : cart;
  const checkoutSubtotal = useMemo(
    () => checkoutItems.reduce((sum, item) => sum + Number(item.product?.price || 0) * Number(item.quantity || 0), 0),
    [checkoutItems]
  );
  const checkoutShipping = isBuyNowCheckout ? 150 : shippingFee;
  const checkoutDiscount = isBuyNowCheckout ? 0 : discountAmount;
  const checkoutTotal = Math.max(0, checkoutSubtotal - checkoutDiscount) + Number(checkoutShipping || 0);
  const checkoutItemCount = useMemo(
    () => checkoutItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [checkoutItems]
  );

  useEffect(() => {
    const unsub = notificationService.subscribe(() => {
      setUnreadNotifCount(notificationService.getUnreadCount(currentUser?.id));
    });
    return () => unsub?.();
  }, []);

  // Load products & subscribe to real-time inventory
  useEffect(() => {
    productService.getProducts().then((data) => {
      if (Array.isArray(data)) setProductsList(data);
    });
    const unsubscribe = productService.subscribe((updated) => {
      if (Array.isArray(updated)) setProductsList(updated);
    });
    return () => unsubscribe();
  }, []);

  const categories = useMemo(() => {
    const prods = Array.isArray(productsList) ? productsList : [];
    const cats = ['All', ...new Set(prods.map((p) => p.category).filter(Boolean))];
    return cats;
  }, [productsList]);

  // Filtered & Sorted products list
  const filteredProducts = useMemo(() => {
    const prods = Array.isArray(productsList) ? productsList : [];
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

    if (filterSort === 'price-low') {
      list = [...list].sort((a, b) => a.price - b.price);
    } else if (filterSort === 'price-high') {
      list = [...list].sort((a, b) => b.price - a.price);
    } else if (filterSort === 'rating') {
      list = [...list].sort((a, b) => (b.rating || 5) - (a.rating || 5));
    }

    return list;
  }, [productsList, selectedCategory, searchQuery, filterSort]);

  const handleAddToCartAttempt = (product, qty = 1) => {
    if (!currentUser) {
      setRedirectReason('Please sign in to add performance items to your cart.');
      onNavigateToScreen?.('login');
      return;
    }
    addToCart(product, qty);
  };

  const handleBuyNowAttempt = (product, qty = 1) => {
    if (!currentUser) {
      setRedirectReason('Please sign in or create an account to buy this item.');
      onNavigateToScreen?.('login');
      return;
    }
    const stock = Number(product?.stock);
    if (Number.isFinite(stock) && stock <= 0) {
      showToast(`"${product.name?.slice(0, 20) || 'Item'}..." is out of stock`);
      return;
    }
    const quantity = Math.min(Math.max(1, qty), Number.isFinite(stock) ? stock : qty);
    setBuyNowItems([{ product, quantity }]);
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
        customerAddress,
        deliveryNotes,
        paymentMethod,
        gcashNumber,
        gcashReference,
        codChangeFor,
        promoId: isBuyNowCheckout ? null : appliedPromoId || null,
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
        clearCart();
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
              : paymentMethod === 'Credit / Debit Card' || (paymentMethod || '').toLowerCase().includes('card')
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
    <View style={webStyles.container} className="bg-slate-100 min-h-screen">
      <StatusBar style="dark" />
      <ToastNotification message={toastMessage} />

      {/* ─── 1. FULL-WIDTH DESKTOP STICKY NAVBAR ─── */}
      <View style={webStyles.headerWrapper}>
        <View style={webStyles.headerInner}>
          {/* Logo */}
          <TouchableOpacity
            style={webStyles.logoWrap}
            onPress={() => {
              setSelectedCategory('All');
              setSearchQuery('');
            }}
            activeOpacity={0.8}
          >
            <BrandLogo size={42} textColor="#FFFFFF" />
          </TouchableOpacity>

          {/* Center Navigation: AI Vision & Repair */}
          <View style={webStyles.headerCenterNav}>
            {/* Repair Button */}
            <TouchableOpacity
              style={webStyles.headerRepairBtn}
              onPress={() => onNavigateToScreen?.('garage')}
              activeOpacity={0.8}
              title="Book a Service"
            >
              <BootstrapIcon name="tools" size={16} color="#FFFFFF" />
              <Text style={webStyles.headerRepairBtnText}>Book a Service</Text>
            </TouchableOpacity>

            {/* Customize Button */}
            <TouchableOpacity
              style={webStyles.headerAiVisionBtn}
              onPress={() => onNavigateToScreen?.('customizer')}
              activeOpacity={0.85}
              title="Customize"
            >
              <BootstrapIcon name="magic" size={16} color="#FFFFFF" />
              <Text style={webStyles.headerAiVisionBtnText}>Customize</Text>
            </TouchableOpacity>
          </View>

          {/* Right Header Navigation & Actions */}
          <View style={webStyles.headerActions}>
            {/* Search Bar inside Header */}
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

            {/* Favorites Button (Icon Only with Badge) */}
            <TouchableOpacity
              style={webStyles.navActionIconBtn}
              onPress={() => onNavigateToScreen?.('wishlist')}
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
              >
                <BootstrapIcon name="bell" size={16} color="#FFFFFF" />
                {unreadNotifCount > 0 && (
                  <View style={webStyles.navBadgeCircle}>
                    <Text style={webStyles.navBadgeText}>{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</Text>
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
                  onClose={() => setIsProfileDropdownOpen(false)}
                  onNavigateToDashboard={(tab = 'overview') => onNavigateToScreen?.('profile', { tab })}
                  onNavigateToOrders={() => onNavigateToScreen?.('profile', { tab: 'orders' })}
                  onNavigateToProfile={() => onNavigateToScreen?.('profile')}
                  onNavigateToSettings={() => onNavigateToScreen?.('profile', { tab: 'settings' })}
                  onNavigateToNotifications={() => onNavigateToScreen?.('notifications')}
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
      <ScrollView
        contentContainerStyle={[webStyles.scrollContent, windowWidth < 768 && { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={true}
      >
        <View style={webStyles.maxContainer}>
          <HeroBanner onSelectCategory={setSelectedCategory} showToast={showToast} />
          
          {/* ─── CATEGORY DROPDOWN, SEARCH & SORTING TOOLBAR ─── */}
          <View style={webStyles.toolbarRow}>
            {/* Left Cluster: Category Dropdown & Relocated Search Bar */}
            <View style={webStyles.toolbarLeftGroup}>
              {/* Category Dropdown */}
              <View style={webStyles.categoryDropdownContainer}>
                <TouchableOpacity
                  style={[
                    webStyles.categoryDropdownBtn,
                    (isCategoryDropdownOpen || selectedCategory !== 'All') && webStyles.categoryDropdownBtnActive,
                  ]}
                  onPress={() => setIsCategoryDropdownOpen((prev) => !prev)}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon
                    name="grid-fill"
                    size={13}
                    color={selectedCategory !== 'All' ? '#0C6258' : '#64748B'}
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
                    color={selectedCategory !== 'All' ? '#0C6258' : '#94A3B8'}
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
                                  <BootstrapIcon name="check-circle-fill" size={13} color="#0C6258" />
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
            </View>

            {/* Sorting Dropdown */}
            <View style={webStyles.sortingGroup}>
              <View style={webStyles.categoryDropdownContainer}>
                <TouchableOpacity
                  style={[
                    webStyles.categoryDropdownBtn,
                    filterSort !== 'all' && webStyles.categoryDropdownBtnActive,
                  ]}
                  onPress={() => setIsSortDropdownOpen((prev) => !prev)}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon
                    name="sort-down"
                    size={13}
                    color={filterSort !== 'all' ? '#0C6258' : '#64748B'}
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
                    color={filterSort !== 'all' ? '#0C6258' : '#94A3B8'}
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
                                color={isActive ? '#0C6258' : '#64748B'}
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
                            {isActive && <BootstrapIcon name="check" size={14} color="#0C6258" />}
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
                {filteredProducts.length} items available
              </Text>
            </View>
          </View>

          {/* Product Multi-Column Grid */}
          <View style={webStyles.productGrid}>
            {filteredProducts.map((product) => {
              const isFav = isWishlisted(product.id);
              return (
                <TouchableOpacity
                  key={product.id}
                  style={[webStyles.productCard, { width: cardWidth }]}
                  className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden mb-2 cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
                  onPress={() => {
                    setSelectedProduct(product);
                    setIsSpecsOpen(true);
                  }}
                  activeOpacity={0.92}
                >
                  {/* 1:1 Square Product Image */}
                  <View style={webStyles.productImgContainer} className="w-full aspect-square bg-slate-100 relative overflow-hidden">
                    <Image source={{ uri: product.image }} style={webStyles.productImg} resizeMode="cover" className="w-full h-full object-cover" />

                    {/* Wishlist Button (Top-Right) */}
                    <TouchableOpacity
                      style={webStyles.wishlistBtn}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/95 items-center justify-center shadow-sm z-10 hover:scale-105 transition-transform"
                      onPress={(e) => {
                        e?.stopPropagation?.();
                        toggleWishlist(product.id);
                      }}
                      activeOpacity={0.8}
                    >
                      <BootstrapIcon
                        name={isFav ? 'heart-fill' : 'heart'}
                        size={13}
                        color={isFav ? '#EF4444' : '#64748B'}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Details - Compact Square Layout */}
                  <View style={webStyles.productDetails} className="p-2.5 bg-white flex flex-col justify-between">
                    {/* Product Name (2 Lines Max) */}
                    <Text style={webStyles.productName} numberOfLines={2} className="text-[12.5px] font-semibold text-slate-800 leading-[17px] mb-1 h-[34px]">
                      {product.name}
                    </Text>

                    {/* Price Row: Bold Teal Brand Color (matching app) */}
                    <View style={webStyles.priceRow} className="flex flex-row items-baseline gap-1.5 mb-1.5">
                      <Text style={webStyles.priceMainText} className="text-[15px] font-extrabold text-[#0C6258]">₱{product.price?.toFixed(2)}</Text>
                    </View>

                    {/* Tags Row: COD, Actual Stock & Rating */}
                    <View style={webStyles.tagsRow} className="flex flex-row items-center gap-1.5 mb-1.5 flex-wrap">
                      <View style={webStyles.codTag} className="bg-amber-100 px-1.5 py-0.5 rounded">
                        <Text style={webStyles.codTagText} className="text-[10px] font-extrabold text-amber-700">COD</Text>
                      </View>
                      <View style={webStyles.stockTag} className="bg-emerald-50 px-1.5 py-0.5 rounded">
                        <Text style={webStyles.stockTagText} className="text-[10px] font-bold text-emerald-700">
                          {product.stock <= 5 ? `Only ${product.stock} left` : `${product.stock} in stock`}
                        </Text>
                      </View>
                      <View style={[webStyles.ratingLeft, { marginLeft: 'auto' }]} className="flex flex-row items-center gap-1 ml-auto">
                        <BootstrapIcon name="star-fill" size={10} color="#F59E0B" />
                        <Text style={webStyles.ratingValText} className="text-[11.5px] font-bold text-amber-500">{product.rating?.toFixed(1) || '5.0'}</Text>
                        <Text style={webStyles.reviewCountText} className="text-[10.5px] text-slate-500 font-medium">({product.reviews || 0})</Text>
                      </View>
                    </View>

                    {/* Action buttons: Buy Now (First, Green) + Add to Cart (Second, Outline Icon Only) */}
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, alignItems: 'center' }}>
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          backgroundColor: '#0C6258',
                          borderRadius: 8,
                          paddingVertical: 7.5,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 5,
                          borderWidth: 1.5,
                          borderColor: '#0C6258',
                          cursor: 'pointer',
                        }}
                        className="bg-[#0C6258] hover:bg-[#094e46] rounded-lg py-2 flex flex-row items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        onPress={(e) => {
                          e?.stopPropagation?.();
                          handleBuyNowAttempt(product);
                        }}
                        activeOpacity={0.8}
                      >
                        <BootstrapIcon name="lightning-fill" size={12} color="#FFFFFF" />
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#FFFFFF' }} className="text-[11px] font-bold text-white">
                          Buy Now
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{
                          backgroundColor: '#FFFFFF',
                          borderRadius: 8,
                          paddingVertical: 7.5,
                          paddingHorizontal: 11,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 1.5,
                          borderColor: '#0C6258',
                          cursor: 'pointer',
                        }}
                        className="bg-white hover:bg-[#F3F7F6] rounded-lg py-2 px-3 flex flex-row items-center justify-center cursor-pointer border-[1.5px] border-[#0C6258] transition-colors"
                        onPress={(e) => {
                          e?.stopPropagation?.();
                          handleAddToCartAttempt(product);
                        }}
                        activeOpacity={0.8}
                        title="Add to Cart"
                      >
                        <BootstrapIcon name="cart3" size={13} color="#0C6258" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Desktop Footer with Trust Badges */}
          <View style={webStyles.desktopFooter}>
            <View style={webStyles.footerTopRow}>
              <View style={webStyles.footerBrandBlock}>
                <View>
                  <BrandLogo size={36} />
                </View>
              </View>

              <View style={webStyles.footerTrustGrid}>
                <View style={webStyles.trustItem}>
                  <BootstrapIcon name="shield-lock-fill" size={20} color="#0C6258" />
                  <View>
                    <Text style={webStyles.trustTitle}>256-Bit SSL Checkout</Text>
                    <Text style={webStyles.trustSub}>GCash, COD, Card & Crypto</Text>
                  </View>
                </View>
                <View style={webStyles.trustItem}>
                  <BootstrapIcon name="lightning-charge-fill" size={20} color="#0C6258" />
                  <View>
                    <Text style={webStyles.trustTitle}>Express Dispatch</Text>
                    <Text style={webStyles.trustSub}>Same-day track delivery</Text>
                  </View>
                </View>
                <View style={webStyles.trustItem}>
                  <BootstrapIcon name="patch-check-fill" size={20} color="#0C6258" />
                  <View>
                    <Text style={webStyles.trustTitle}>100% Authentic Parts</Text>
                    <Text style={webStyles.trustSub}>Factory warranty included</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={webStyles.footerBottomBar}>
              <Text style={{ fontSize: 12, color: '#94A3B8' }}>
                © 2026 MotoTrack Motorparts and Accessories. Official Performance Network. All rights reserved.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ─── MODALS ─── */}
      <ProductSpecsModal
        visible={isSpecsOpen}
        product={selectedProduct}
        onClose={() => setIsSpecsOpen(false)}
        onAddToCart={handleAddToCartAttempt}
        onBuyNow={handleBuyNowAttempt}
        onCustomizeWithPart={(prod) => onNavigateToScreen?.('customizer', { product: prod })}
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
            } else if (tab === 'Customize') {
              onNavigateToScreen?.('customizer');
            } else if (tab === 'Garage') {
              onNavigateToScreen?.('garage');
            } else if (tab === 'Orders') {
              onNavigateToScreen?.('orders');
            } else if (tab === 'Favorites') {
              onNavigateToScreen?.('wishlist');
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
