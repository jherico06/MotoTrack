import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
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
  CategoryPills,
  FilterChips,
  ProductCard,
  FloatingCartBar,
  ProductSpecsModal,
  CartModal,
  CheckoutModal,
  ProfileModal,
  AccessDeniedModal,
  LiveOrderTrackingMapModal,
} from '../components';

export default function ShopPage({
  onNavigateToScreen,
}) {

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
    toastMessage,
    showToast,
  } = useCart();
  const { wishlistCount } = useWishlist();

  // Products & Filter state
  const [productsList, setProductsList] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSort, setFilterSort] = useState('all'); // 'all' | 'rating' | 'price-low' | 'price-high'
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modal states
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isSpecsOpen, setIsSpecsOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAccessDeniedModalOpen, setIsAccessDeniedModalOpen] = useState(false);
  const [selectedOrderForTracking, setSelectedOrderForTracking] = useState(null);
  const [isLiveTrackingOpen, setIsLiveTrackingOpen] = useState(false);

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
        selectedCategory === 'All' ||
        item.category.toLowerCase() === selectedCategory.toLowerCase();
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

    const res = await databaseService.createOrder({
      customerId: currentUser?.customer_id || null,
      customerName,
      customerPhone,
      customerAddress,
      paymentMethod,
      total: cartSubtotal.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      grandTotal: cartTotal.toFixed(2),
      itemsSummary: cart.map((i) => `${i.product.name} (x${i.quantity})`).join(', '),
      itemsCount: cartItemCount,
      items: cart,
    });

    const isCOD = (paymentMethod || '').toLowerCase().includes('cash') || (paymentMethod || '').includes('COD');
    const orderStatus = isCOD ? 'Pending Approval' : 'Processing';

    const newOrder = {
      order_id: res.order?.order_id || 'ord-' + Math.floor(10000 + Math.random() * 90000),
      id: res.order?.order_id || 'ord-' + Math.floor(10000 + Math.random() * 90000),
      customer_id: currentUser?.customer_id || 'cust-01',
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_address: customerAddress,
      delivery_notes: deliveryNotes,
      payment_method: paymentMethod,
      gcash_number: paymentMethod === 'GCash' ? gcashNumber : null,
      gcash_reference: gcashReference,
      cod_change_for: isCOD ? codChangeFor : null,
      total_amount: Number(cartSubtotal.toFixed(2)),
      discount_amount: Number(discountAmount.toFixed(2)),
      grand_total: Number(cartTotal.toFixed(2)),
      items_summary: cart.map((i) => `${i.product.name} (x${i.quantity})`).join(', '),
      items_count: cartItemCount,
      status: orderStatus,
      created_at: new Date().toISOString(),
      order_date: 'Today',
      estimated_delivery: isCOD ? 'Today (Awaiting COD Verification)' : 'Today (30-45 mins Express Courier)',
      tracking_number: 'MOTO-TRK-' + Math.floor(1000000 + Math.random() * 9000000),
      courier: 'MotoTrack Express SuperAir',
      items: cart.map((i) => ({
        product_id: i.product.id,
        name: i.product.name,
        brand: i.product.brand || 'MotoTrack',
        category: i.product.category || 'Gear',
        quantity: i.quantity,
        price: i.product.price,
        image: i.product.image,
      })),
    };

    // Save locally
    const existing = orderService.getLocalOrders();
    orderService.saveLocalOrders([newOrder, ...existing]);

    clearCart();
    setIsCheckoutOpen(false);
    setSelectedOrderForTracking(newOrder);
    setIsLiveTrackingOpen(true);
    showToast(isCOD ? '🎉 COD Order placed! Awaiting Store Admin verification.' : '🎉 Order placed successfully! Live tracking active.');
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
            onNavigateToWishlist={() => onNavigateToScreen?.('wishlist')}
            onNavigateToAdmin={() => onNavigateToScreen?.('admin')}
          />

          {/* Category Horizontal Pills */}
          <CategoryPills
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />

          {/* Hero Promo Banner */}
          <HeroBanner
            onSelectCategory={(cat) => setSelectedCategory(cat)}
            showToast={showToast}
          />

          {/* Filter Chips Row */}
          <FilterChips
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
            <Text style={styles.sectionCount}>
              {filteredProducts.length} items available
            </Text>
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
          } else if (tab === 'Garage') {
            onNavigateToScreen?.('garage');
          } else if (tab === 'Favorites') {
            onNavigateToScreen?.('wishlist');
          } else if (tab === 'Admin') {
            onNavigateToScreen?.('admin');
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

      {/* ─── MODALS ─── */}
      <ProductSpecsModal
        visible={isSpecsOpen}
        product={selectedProduct}
        onClose={() => setIsSpecsOpen(false)}
        onAddToCart={handleAddToCartAttempt}
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
      />

      <ProfileModal
        visible={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        onNavigateToOrders={() => onNavigateToScreen?.('orders')}
        onNavigateToWishlist={() => onNavigateToScreen?.('wishlist')}
        onNavigateToAdmin={() => onNavigateToScreen?.('admin')}
      />

      <AccessDeniedModal
        visible={isAccessDeniedModalOpen}
        onClose={() => setIsAccessDeniedModalOpen(false)}
        onNavigateToLogin={() => {
          setRedirectReason('Please sign in with your Store Administrator account.');
          onNavigateToScreen?.('login');
        }}
      />

      <LiveOrderTrackingMapModal
        visible={isLiveTrackingOpen}
        order={selectedOrderForTracking}
        onClose={() => setIsLiveTrackingOpen(false)}
        showToast={showToast}
      />
    </SafeAreaView>
  );
}
