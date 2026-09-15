import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, SafeAreaView, RefreshControl } from 'react-native';
import { StatusBar } from 'expo-status-bar';

// ─── STYLES & DATA ──────────────────────────────────────────────────────────
import { shopStyles as styles } from '../styles/shop.styles';
import { MOTOR_PARTS } from '../data/motorParts';
import { productService } from '../services/productService';
import { databaseService } from '../services/databaseService';
import { orderService } from '../services/orderService';

// ─── CONTEXTS ───────────────────────────────────────────────────────────────
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';

// ─── COMPONENTS & MODALS ───────────────────────────────────────────────────
import {
  BootstrapIcon,
  BottomNavBar,
  ToastNotification,
  MobileHeader,
  HeroBanner,
  CategoryDropdown,
  FilterChips,
  ProductCard,
  FloatingCartBar,
  ProductSpecsModal,
  CartModal,
  CheckoutModal,
  ProfileModal,
  AccessDeniedModal,
  LiveOrderTrackingMapModal,
  GCashPaymentModal,
} from '../components';

export default function ShopPage({ onNavigateToScreen }) {
  // Contexts
  const { currentUser, setRedirectReason } = useAuth();
  const {
    cart,
    addToCart,
    clearCart,
    cartSubtotal,
    cartItemCount,
    discountAmount,
    cartTotal,
    appliedPromoId,
    toastMessage,
    showToast,
  } = useCart();
  const { wishlistCount } = useWishlist();

  // Local state
  const [productsList, setProductsList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [filterSort, setFilterSort] = useState('default');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals state
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isSpecsOpen, setIsSpecsOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAccessDeniedModalOpen, setIsAccessDeniedModalOpen] = useState(false);
  const [isLiveTrackingOpen, setIsLiveTrackingOpen] = useState(false);
  const [selectedOrderForTracking, setSelectedOrderForTracking] = useState(null);
  const [isGcashModalOpen, setIsGcashModalOpen] = useState(false);
  const [pendingGcashOrderData, setPendingGcashOrderData] = useState(null);

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
    refreshProducts();
    const unsubscribe = productService.subscribe((updated) => {
      if (Array.isArray(updated)) {
        setProductsList(updated);
      }
    });
    return () => unsubscribe();
  }, [refreshProducts]);

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

  // Add to cart with auth check
  const handleAddToCartAttempt = (product, qty = 1) => {
    if (!currentUser) {
      setRedirectReason('Please sign in or create an account to add items to your cart.');
      onNavigateToScreen?.('login');
      return;
    }
    addToCart(product, qty);
  };

  // Checkout attempt with auth check
  const handleProceedToCheckout = () => {
    if (!currentUser) {
      setIsCartOpen(false);
      setRedirectReason('Please sign in with your customer account to complete your checkout and delivery.');
      onNavigateToScreen?.('login');
      return;
    }
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

    // 2. Otherwise handle standard COD
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
      promoId: appliedPromoId || null,
      total: cartSubtotal.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      grandTotal: cartTotal.toFixed(2),
      items: cart,
      channel: 'Online Store',
      overrideStatus,
    });

    const placedOrder = res.order;
    clearCart();
    setIsCheckoutOpen(false);
    setSelectedOrderForTracking(placedOrder);
    setIsLiveTrackingOpen(true);
    showToast(
      isCOD
        ? '🎉 COD Order placed! Awaiting Store Admin verification.'
        : '🎉 GCash Payment Confirmed! Live order tracking active.'
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      {/* Toast Notification */}
      <ToastNotification message={toastMessage} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handlePullRefresh}
            colors={['#0C6258']}
            tintColor="#0C6258"
          />
        }
      >
        <View style={styles.maxContainer}>
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
            onOpenProfile={() => setIsProfileOpen(true)}
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

          {/* Category Dropdown */}
          <CategoryDropdown
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            productsList={productsList}
          />

          {/* Hero Promo Banner */}
          <HeroBanner onSelectCategory={(cat) => setSelectedCategory(cat)} showToast={showToast} />

          {/* Filter Chips Row with Category Dropdown */}
          <FilterChips
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            productsList={productsList}
            filterSort={filterSort}
            onSetFilterSort={setFilterSort}
            onResetFilters={() => {
              setSelectedCategory('All');
              setSearchQuery('');
              setFilterSort('all');
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
                  setSelectedProduct(prod);
                  setIsSpecsOpen(true);
                }}
                onAddToCart={handleAddToCartAttempt}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Floating Bottom Cart Bar for Mobile */}
      <FloatingCartBar onOpenCart={() => setIsCartOpen(true)} />

      {/* Persistent Bottom Navigation Bar for Mobile */}
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
          } else if (tab === 'Dashboard' || tab === 'Profile') {
            if (!currentUser) {
              setRedirectReason?.('Please sign in to access your Customer Dashboard.');
              onNavigateToScreen?.('login');
            } else {
              onNavigateToScreen?.('profile');
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
        onCustomizeWithPart={(prod) => onNavigateToScreen?.('customizer', { product: prod })}
      />

      <CartModal
        visible={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onProceedToCheckout={handleProceedToCheckout}
      />

      <CheckoutModal
        visible={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        onCompleteOrder={handleCompleteOrder}
        onOpenProfile={() => {
          setIsCheckoutOpen(false);
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
    </SafeAreaView>
  );
}
