import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, SafeAreaView, RefreshControl, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';

// ─── STYLES & DATA ──────────────────────────────────────────────────────────
import { shopStyles as styles } from '../styles/shop.styles';
import { productService } from '../services/productService';
import { orderService } from '../services/orderService';

// ─── CONTEXTS ───────────────────────────────────────────────────────────────
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { productNeedsSizes, withSelectedSize, isSizeSoldOut } from '../utils/productSizes';
import { getRatedScore } from '../utils/productCatalog';

// ─── COMPONENTS & MODALS ───────────────────────────────────────────────────
import {
  BottomNavBar,
  ToastNotification,
  MobileHeader,
  UserProfileDropdown,
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
} from '../components';

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
    appliedPromoId,
    toastMessage,
    showToast,
  } = useCart();
  const { wishlistCount } = useWishlist();

  const { width } = useWindowDimensions();
  const isSmallMobile = width < 380;

  // Local state
  const [productsList, setProductsList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [filterSort, setFilterSort] = useState('default');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [priceFilter, setPriceFilter] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals state
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isSpecsOpen, setIsSpecsOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
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
  const checkoutShipping = isBuyNowCheckout ? 150 : selectedShippingFee;
  const checkoutDiscount = isBuyNowCheckout ? 0 : selectedDiscountAmount;
  const checkoutTotal = isBuyNowCheckout
    ? Math.max(0, checkoutSubtotal - checkoutDiscount) + Number(checkoutShipping || 0)
    : selectedCartTotal;
  const checkoutItemCount = isBuyNowCheckout
    ? buyNowItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
    : selectedCartItemCount;

  // Load products from DB or fallback
  const refreshProducts = useCallback(async () => {
    const data = await productService.getProducts();
    if (Array.isArray(data)) {
      setProductsList(data);
    }
  }, []);

  const handlePullRefresh = async () => {
    setIsRefreshing(true);
    await refreshProducts();
    setIsRefreshing(false);
    showToast('Catalog refreshed from Supabase');
  };

  useEffect(() => {
    productService.getProducts().then((data) => {
      if (Array.isArray(data)) {
        setProductsList(data);
      }
    });
    const unsubscribe = productService.subscribe((updated) => {
      if (Array.isArray(updated)) {
        setProductsList(updated);
      }
    });
    return () => unsubscribe();
  }, []);

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

    // Sorting
    if (priceFilter === 'price-low' || filterSort === 'price-low') {
      list = [...list].sort((a, b) => a.price - b.price);
    } else if (priceFilter === 'price-high' || filterSort === 'price-high') {
      list = [...list].sort((a, b) => b.price - a.price);
    } else if (ratingFilter === 'sort-rating' || filterSort === 'rating') {
      list = [...list].sort((a, b) => getRatedScore(b) - getRatedScore(a));
    }

    return list;
  }, [productsList, selectedCategory, searchQuery, filterSort, ratingFilter, priceFilter]);

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
    addToCart(product, qty, { size });
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />

      {/* Toast Notification */}
      <ToastNotification message={toastMessage} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handlePullRefresh}
            colors={['#1D4533']}
            tintColor="#1D4533"
          />
        }
      >
        <View style={[styles.maxContainer, { paddingHorizontal: isSmallMobile ? 12 : 14 }]}>
          {/* Mobile Top Header */}
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
            isProfileDropdownOpen={isProfileDropdownOpen}
            onOpenProfile={() => setIsProfileDropdownOpen((prev) => !prev)}
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

          {/* Hero Promo Banner */}
          <HeroBanner onSelectCategory={(cat) => setSelectedCategory(cat)} showToast={showToast} />

          {/* Filter Chips Row with Category, Rating, Price, and Reset Dropdowns */}
          <FilterChips
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            productsList={productsList}
            filterSort={filterSort}
            onSetFilterSort={setFilterSort}
            ratingFilter={ratingFilter}
            onSetRatingFilter={setRatingFilter}
            priceFilter={priceFilter}
            onSetPriceFilter={setPriceFilter}
            onResetFilters={() => {
              setSelectedCategory('All');
              setSearchQuery('');
              setFilterSort('default');
              setRatingFilter('all');
              setPriceFilter('all');
              showToast('Reset all filters');
            }}
          />

          {/* Section Title */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Featured Products</Text>
            <Text style={styles.sectionCount}>{filteredProducts.length} items available</Text>
          </View>

          {/* Multi-Column Product Grid */}
          <View style={styles.productGrid}>
            {filteredProducts.map((product, pIdx) => (
              <ProductCard
                key={product.id ? `prod-${product.id}` : `prod-${pIdx}`}
                product={product}
                onPress={(prod) => {
                  if (onNavigateToScreen) {
                    onNavigateToScreen('product-details', { product: prod });
                  } else {
                    setSelectedProduct(prod);
                    setIsSpecsOpen(true);
                  }
                }}
              />
            ))}
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
              © 2026 MotoTrack Motorparts & Accessories. Official Performance Network.
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
          } else if (tab === 'Customize') {
            onNavigateToScreen?.('customizer');
          } else if (tab === 'Garage') {
            onNavigateToScreen?.('garage');
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

      {/* ─── USER PROFILE DROPDOWN MENU (MOBILE) ─── */}
      <UserProfileDropdown
        currentUser={currentUser}
        isOpen={isProfileDropdownOpen}
        onClose={() => setIsProfileDropdownOpen(false)}
        isMobile={true}
        align="left"
        onNavigateToDashboard={(tab = 'overview') => onNavigateToScreen?.('profile', { tab })}
        onNavigateToOrders={() => onNavigateToScreen?.('orders')}
        onNavigateToProfile={() => onNavigateToScreen?.('profile')}
        onNavigateToSettings={() => {
          setIsProfileDropdownOpen(false);
          setIsProfileOpen(true);
        }}
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
