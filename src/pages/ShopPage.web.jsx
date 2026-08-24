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
} from '../components';

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
    cartTotal,
    toastMessage,
    showToast,
  } = useCart();
  const { isWishlisted, toggleWishlist, wishlistCount } = useWishlist();

  // Products & Filter state
  const [productsList, setProductsList] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSort, setFilterSort] = useState('all');

  // Modal states
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isSpecsOpen, setIsSpecsOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAccessDeniedModalOpen, setIsAccessDeniedModalOpen] = useState(false);
  const [selectedOrderForTracking, setSelectedOrderForTracking] = useState(null);
  const [isLiveTrackingOpen, setIsLiveTrackingOpen] = useState(false);

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

  const handleAddToCartAttempt = (product, qty = 1) => {
    if (!currentUser) {
      setRedirectReason('Please sign in to add performance items to your cart.');
      onNavigateToScreen?.('login');
      return;
    }
    addToCart(product, qty);
  };

  const handleProceedToCheckout = () => {
    if (!currentUser) {
      setIsCartOpen(false);
      setRedirectReason('Please sign in to complete your checkout and delivery.');
      onNavigateToScreen?.('login');
      return;
    }
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

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

    const existing = orderService.getLocalOrders();
    orderService.saveLocalOrders([newOrder, ...existing]);

    clearCart();
    setIsCheckoutOpen(false);
    setSelectedOrderForTracking(newOrder);
    setIsLiveTrackingOpen(true);
    showToast(isCOD ? '🎉 COD Order placed! Awaiting Store Admin verification.' : '🎉 Order placed successfully! Live tracking active.');
  };

  // Determine grid columns
  const numColumns = windowWidth >= 1200 ? 4 : windowWidth >= 800 ? 3 : 2;
  const cardWidth = `${(100 / numColumns) - 1.5}%`;

  return (
    <View style={webStyles.container}>
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
            <View style={webStyles.logoIconBadge}>
              <BootstrapIcon name="speedometer2" size={20} color="#FFFFFF" />
            </View>
            <Text style={webStyles.logoText}>
              Moto<Text style={webStyles.logoAccent}>Track</Text>
              <Text style={webStyles.logoSubText}> PRO GEAR</Text>
            </Text>
          </TouchableOpacity>

          {/* Desktop Wide Search Input */}
          <View style={webStyles.searchContainer}>
            <BootstrapIcon name="search" size={15} color="#94A3B8" />
            <TextInput
              style={webStyles.searchInput}
              placeholder="Search high-performance parts, Akrapovič exhausts, Brembo calipers..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <BootstrapIcon name="x-circle-fill" size={15} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Right Header Navigation & Actions */}
          <View style={webStyles.headerActions}>
            <TouchableOpacity
              style={webStyles.navLinkBtn}
              onPress={() => onNavigateToScreen?.('garage')}
              activeOpacity={0.8}
            >
              <BootstrapIcon name="tools" size={14} color="#0C6258" />
              <Text style={webStyles.navLinkBtnText}>Pitstop & Garage</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={webStyles.navLinkBtn}
              onPress={() => onNavigateToScreen?.('wishlist')}
              activeOpacity={0.8}
            >
              <BootstrapIcon name="heart-fill" size={14} color="#EF4444" />
              <Text style={webStyles.navLinkBtnText}>Wishlist ({wishlistCount})</Text>
            </TouchableOpacity>

            {/* Cart Button */}
            <TouchableOpacity
              style={webStyles.cartSummaryBtn}
              onPress={() => setIsCartOpen(true)}
              activeOpacity={0.85}
            >
              <BootstrapIcon name="bag-check-fill" size={15} color="#FFFFFF" />
              <Text style={webStyles.cartSummaryBtnText}>₱{cartTotal.toFixed(2)}</Text>
              {cartItemCount > 0 && (
                <View style={webStyles.cartBadgeCircle}>
                  <Text style={webStyles.cartBadgeCountText}>{cartItemCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Auth: Sign In & Sign Up OR Logged In Profile */}
            {currentUser ? (
              <View style={webStyles.loggedInContainer}>
                <TouchableOpacity
                  style={webStyles.userProfileHeaderBtn}
                  onPress={() => setIsProfileOpen(true)}
                  activeOpacity={0.85}
                >
                  <Image
                    source={{
                      uri:
                        currentUser.avatar ||
                        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
                    }}
                    style={webStyles.userAvatarImg}
                  />
                  <Text style={webStyles.userProfileName} numberOfLines={1}>
                    {currentUser.name || 'Account'}
                  </Text>
                  <BootstrapIcon name="chevron-down" size={12} color="#64748B" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={webStyles.signOutHeaderBtn}
                  onPress={logout}
                  title="Sign Out"
                  activeOpacity={0.8}
                >
                  <BootstrapIcon name="box-arrow-right" size={14} color="#EF4444" />
                </TouchableOpacity>
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
                  <BootstrapIcon name="box-arrow-in-right" size={14} color="#FFFFFF" />
                  <Text style={webStyles.signInHeaderBtnText}>Sign In</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={webStyles.signUpHeaderBtn}
                  onPress={() => {
                    setRedirectReason('');
                    onNavigateToScreen?.('signup');
                  }}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon name="person-plus-fill" size={14} color="#0C6258" />
                  <Text style={webStyles.signUpHeaderBtnText}>Sign Up</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* ─── 2. MAIN STOREFRONT CONTENT ─── */}
      <ScrollView contentContainerStyle={[webStyles.scrollContent, windowWidth < 768 && { paddingBottom: 100 }]} showsVerticalScrollIndicator={true}>
        <View style={webStyles.maxContainer}>

          {/* Wide Hero Showcase Banner */}
          <View style={webStyles.heroBanner}>
            <View style={webStyles.heroBannerLeft}>
              <View style={webStyles.heroBadge}>
                <View style={webStyles.pulseDot} />
                <Text style={webStyles.heroBadgeText}>2026 Factory Racing Edition</Text>
              </View>
              <Text style={webStyles.heroHeading}>
                ENGINEERED FOR THE FASTEST RIDERS ON EARTH.
              </Text>
              <Text style={webStyles.heroSubtext}>
                Track-tested titanium slip-on exhausts, Brembo radial master cylinders, and FIM-homologated carbon helmets. Free courier shipping on orders over ₱150.
              </Text>
              <View style={webStyles.heroCtaRow}>
                <TouchableOpacity
                  style={webStyles.heroCtaPrimary}
                  onPress={() => {
                    setSelectedCategory('Exhaust');
                    showToast('Filtered to Titanium Racing Exhausts!');
                  }}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon name="bag-check-fill" size={14} color="#0F172A" />
                  <Text style={webStyles.heroCtaPrimaryText}>Shop Akrapovič Exhausts</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={webStyles.heroCtaSecondary}
                  onPress={() => onNavigateToScreen?.('garage')}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon name="calendar-check-fill" size={14} color="#FFFFFF" />
                  <Text style={webStyles.heroCtaSecondaryText}>Book Pit Bay Tuning</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={webStyles.heroBannerRight}>
              <Image
                source={{ uri: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80' }}
                style={webStyles.heroProductImg}
                resizeMode="cover"
              />
            </View>
          </View>

          {/* Category Filter Pills & Sorting Toolbar */}
          <View style={webStyles.toolbarRow}>
            {/* Category Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={webStyles.categoryPillsScroll}>
              <View style={webStyles.categoryPillsRow}>
                {categories.map((cat) => {
                  const isActive = selectedCategory.toLowerCase() === cat.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[webStyles.catPill, isActive && webStyles.catPillActive]}
                      onPress={() => setSelectedCategory(cat)}
                      activeOpacity={0.8}
                    >
                      <Text style={[webStyles.catPillText, isActive && webStyles.catPillTextActive]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Sorting Pills */}
            <View style={webStyles.sortingGroup}>
              <TouchableOpacity
                style={[webStyles.sortBtn, filterSort === 'rating' && webStyles.sortBtnActive]}
                onPress={() => setFilterSort(prev => prev === 'rating' ? 'all' : 'rating')}
              >
                <BootstrapIcon name="star-fill" size={12} color={filterSort === 'rating' ? '#0C6258' : '#64748B'} />
                <Text style={[webStyles.sortBtnText, filterSort === 'rating' && webStyles.sortBtnTextActive]}>Top Rated</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[webStyles.sortBtn, filterSort === 'price-low' && webStyles.sortBtnActive]}
                onPress={() => setFilterSort(prev => prev === 'price-low' ? 'all' : 'price-low')}
              >
                <BootstrapIcon name="sort-numeric-down" size={12} color={filterSort === 'price-low' ? '#0C6258' : '#64748B'} />
                <Text style={[webStyles.sortBtnText, filterSort === 'price-low' && webStyles.sortBtnTextActive]}>Price: Low</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[webStyles.sortBtn, filterSort === 'price-high' && webStyles.sortBtnActive]}
                onPress={() => setFilterSort(prev => prev === 'price-high' ? 'all' : 'price-high')}
              >
                <BootstrapIcon name="sort-numeric-up" size={12} color={filterSort === 'price-high' ? '#0C6258' : '#64748B'} />
                <Text style={[webStyles.sortBtnText, filterSort === 'price-high' && webStyles.sortBtnTextActive]}>Price: High</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Section Header */}
          <View style={webStyles.catalogHeaderRow}>
            <View>
              <Text style={webStyles.catalogTitle}>
                {selectedCategory === 'All' ? 'All Pro Performance Gear' : `${selectedCategory} Collection`}
              </Text>
              <Text style={webStyles.catalogSub}>
                Showing {filteredProducts.length} high-spec components dyno-matched for track & street
              </Text>
            </View>
          </View>

          {/* Product Multi-Column Grid */}
          <View style={webStyles.productGrid}>
            {filteredProducts.map((product) => {
              const isFav = isWishlisted(product.id);
              return (
                <View key={product.id} style={[webStyles.productCard, { width: cardWidth }]}>
                  <TouchableOpacity
                    style={webStyles.productImgContainer}
                    onPress={() => {
                      setSelectedProduct(product);
                      setIsSpecsOpen(true);
                    }}
                    activeOpacity={0.9}
                  >
                    <Image source={{ uri: product.image }} style={webStyles.productImg} resizeMode="cover" />

                    {/* Stock Badge */}
                    <View style={webStyles.stockBadge}>
                      <BootstrapIcon name="box-seam" size={11} color="#475569" />
                      <Text style={webStyles.stockBadgeText}>{product.stock} in stock</Text>
                    </View>

                    {/* Wishlist Button */}
                    <TouchableOpacity
                      style={webStyles.wishlistBtn}
                      onPress={() => toggleWishlist(product.id)}
                      activeOpacity={0.8}
                    >
                      <BootstrapIcon
                        name={isFav ? 'heart-fill' : 'heart'}
                        size={14}
                        color={isFav ? '#EF4444' : '#94A3B8'}
                      />
                    </TouchableOpacity>

                    {/* Price Pill */}
                    <View style={webStyles.pricePill}>
                      <Text style={webStyles.pricePillText}>₱{product.price?.toFixed(2)}</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Details */}
                  <View style={webStyles.productDetails}>
                    <View style={webStyles.ratingRow}>
                      <BootstrapIcon name="star-fill" size={12} color="#F59E0B" />
                      <Text style={webStyles.ratingVal}>{product.rating?.toFixed(1) || '5.0'}</Text>
                      <Text style={webStyles.reviewCount}>({product.reviews || 0} reviews)</Text>
                      <Text style={webStyles.brandTag}>• {product.brand}</Text>
                    </View>

                    <Text style={webStyles.productName} numberOfLines={2}>
                      {product.name}
                    </Text>

                    <Text style={webStyles.compatibilityText} numberOfLines={1}>
                      Fit: {product.compatibility || 'Universal Fit'}
                    </Text>

                    <View style={webStyles.cardActionRow}>
                      <TouchableOpacity
                        style={webStyles.quickAddBtn}
                        onPress={() => handleAddToCartAttempt(product)}
                        activeOpacity={0.85}
                      >
                        <BootstrapIcon name="bag-plus-fill" size={13} color="#0C6258" />
                        <Text style={webStyles.quickAddBtnText}>Add to Bag</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={webStyles.specsInspectBtn}
                        onPress={() => {
                          setSelectedProduct(product);
                          setIsSpecsOpen(true);
                        }}
                        activeOpacity={0.85}
                      >
                        <BootstrapIcon name="eye" size={14} color="#64748B" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Desktop Footer with Trust Badges */}
          <View style={webStyles.desktopFooter}>
            <View style={webStyles.footerTopRow}>
              <View style={webStyles.footerBrandBlock}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <BootstrapIcon name="speedometer2" size={22} color="#0C6258" />
                  <Text style={{ fontSize: 20, fontWeight: '900', color: '#0F172A' }}>
                    Moto<Text style={{ color: '#0C6258' }}>Track</Text> Pro Corse
                  </Text>
                </View>
                <Text style={{ fontSize: 13, color: '#64748B', maxWidth: 360, lineHeight: 20 }}>
                  High-performance motorcycle racing components, certified dyno calibration, and professional pitstop garage services.
                </Text>
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
                © 2026 MotoTrack Superbike Pro Shop. Official Performance Network. All rights reserved.
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

      {/* Persistent Mobile Bottom Navigation Bar on smaller screens */}
      {windowWidth < 768 && (
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
      )}
    </View>
  );
}

const webStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    position: 'sticky',
    top: 0,
    zIndex: 1000,
    boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05)',
  },
  headerInner: {
    maxWidth: 1360,
    marginHorizontal: 'auto',
    width: '100%',
    paddingHorizontal: 24,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
  },
  logoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    textDecorationLine: 'none',
  },
  logoIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#0C6258',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  logoAccent: {
    color: '#0C6258',
  },
  logoSubText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 1,
  },
  searchContainer: {
    flex: 1,
    maxWidth: 480,
    height: 42,
    backgroundColor: '#F1F5F9',
    borderRadius: 21,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#0F172A',
    outlineStyle: 'none',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  navLinkBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  adminPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F3F7F6',
    borderWidth: 1,
    borderColor: '#D1ECE6',
  },
  adminPillBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0C6258',
  },
  cartSummaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#0C6258',
    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
  },
  cartSummaryBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  loggedInContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userProfileHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 4,
    paddingRight: 12,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  userAvatarImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  userProfileName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    maxWidth: 120,
  },
  signOutHeaderBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  signInHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#0F172A',
  },
  signInHeaderBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  signUpHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#F3F7F6',
    borderWidth: 1,
    borderColor: '#0C6258',
  },
  signUpHeaderBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0C6258',
  },
  scrollContent: {
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  maxContainer: {
    maxWidth: 1360,
    marginHorizontal: 'auto',
    width: '100%',
  },
  heroBanner: {
    backgroundColor: '#0F172A',
    borderRadius: 24,
    overflow: 'hidden',
    flexDirection: 'row',
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#1E293B',
    boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.4)',
  },
  heroBannerLeft: {
    flex: 1.2,
    padding: 40,
    justifyContent: 'center',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    borderWidth: 1,
    borderColor: '#0C6258',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#38BDF8',
  },
  heroBadgeText: {
    color: '#A7F3D0',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroHeading: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 38,
    letterSpacing: -0.5,
    marginBottom: 14,
  },
  heroSubtext: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 22,
    maxWidth: 520,
    marginBottom: 24,
  },
  heroCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroCtaPrimary: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroCtaPrimaryText: {
    color: '#0F172A',
    fontSize: 13.5,
    fontWeight: '800',
  },
  heroCtaSecondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroCtaSecondaryText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  heroBannerRight: {
    flex: 1,
    minHeight: 280,
  },
  heroProductImg: {
    width: '100%',
    height: '100%',
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 16,
  },
  categoryPillsScroll: {
    flex: 1,
  },
  categoryPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  catPillActive: {
    backgroundColor: '#0C6258',
    borderColor: '#0C6258',
  },
  catPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  catPillTextActive: {
    color: '#FFFFFF',
  },
  sortingGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sortBtnActive: {
    borderColor: '#0C6258',
    backgroundColor: '#F3F7F6',
  },
  sortBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748B',
  },
  sortBtnTextActive: {
    color: '#0C6258',
  },
  catalogHeaderRow: {
    marginBottom: 16,
  },
  catalogTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },
  catalogSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 40,
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  },
  productImgContainer: {
    width: '100%',
    height: 180,
    backgroundColor: '#F1F5F9',
    position: 'relative',
  },
  productImg: {
    width: '100%',
    height: '100%',
  },
  stockBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stockBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  wishlistBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
  },
  pricePill: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: '#0C6258',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pricePillText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  productDetails: {
    padding: 14,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  ratingVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  reviewCount: {
    fontSize: 11,
    color: '#94A3B8',
  },
  brandTag: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  productName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 18,
    marginBottom: 4,
    minHeight: 36,
  },
  compatibilityText: {
    fontSize: 11.5,
    color: '#64748B',
    marginBottom: 12,
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickAddBtn: {
    flex: 1,
    backgroundColor: '#F3F7F6',
    borderWidth: 1,
    borderColor: '#D1ECE6',
    borderRadius: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  quickAddBtnText: {
    color: '#0C6258',
    fontSize: 12.5,
    fontWeight: '800',
  },
  specsInspectBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  desktopFooter: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    borderRadius: 24,
    padding: 36,
    marginTop: 20,
  },
  footerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 40,
    flexWrap: 'wrap',
    paddingBottom: 28,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  footerBrandBlock: {
    flex: 1,
    minWidth: 280,
  },
  footerTrustGrid: {
    flex: 2,
    flexDirection: 'row',
    gap: 24,
    flexWrap: 'wrap',
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  trustTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  trustSub: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  footerBottomBar: {
    paddingTop: 20,
    alignItems: 'center',
  },
});
