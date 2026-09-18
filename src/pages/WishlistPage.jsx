import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  SafeAreaView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { wishlistStyles as styles } from '../styles/wishlistPage.styles';
import { wishlistService } from '../services/wishlistService';
import { BootstrapIcon, BottomNavBar, BrandLogo } from '../components/common';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { productService } from '../services/productService';
import { MOTOR_PARTS, CATEGORY_NAMES } from '../data/motorParts';

const CATEGORIES = CATEGORY_NAMES;

export default function WishlistPage({
  currentUser: propCurrentUser,
  productsList = [],
  onNavigateToStore,
  onNavigateToOrders,
  onNavigateToGarage,
  onNavigateToCustomizer,
  onNavigateToCustomize,
  onNavigateToLogin,
  onNavigateToProfile,
  onNavigateToAdmin,
  onAddToCart,
  onOpenCart,
  cartItemCount: propCartItemCount,
  cartTotal: propCartTotal,
  showToast: propShowToast,
}) {
  const auth = useAuth();
  const wishlistCtx = useWishlist();
  const cartCtx = useCart();

  const currentUser = propCurrentUser !== undefined ? propCurrentUser : auth?.currentUser;
  const cartItemCount = propCartItemCount !== undefined ? propCartItemCount : cartCtx?.cartItemCount || 0;
  const cartTotal = propCartTotal !== undefined ? propCartTotal : cartCtx?.cartTotal || 0;
  const showToast = propShowToast || cartCtx?.showToast || (() => {});
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 1024;
  const isTablet = windowWidth >= 700 && windowWidth < 1024;

  const [wishlistIds, setWishlistIds] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('default'); // 'default' | 'price-low' | 'price-high' | 'rating'
  const [selectedProductForSpecs, setSelectedProductForSpecs] = useState(null);
  const [isSpecsModalOpen, setIsSpecsModalOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  const handleBottomNavChange = (tab) => {
    if (tab === 'Home' || tab === 'Search') {
      onNavigateToStore?.();
    } else if (tab === 'Cart') {
      onNavigateToStore?.();
    } else if (tab === 'Wishlist' || tab === 'Favorites') {
      setSelectedCategory('All');
    } else if (tab === 'Dashboard' || tab === 'Profile') {
      if (!currentUser) {
        onNavigateToLogin?.();
      } else {
        onNavigateToProfile?.();
      }
    } else if (tab === 'Customize') {
      if (onNavigateToCustomizer) onNavigateToCustomizer();
      else if (onNavigateToCustomize) onNavigateToCustomize();
      else onNavigateToStore?.();
    } else if (tab === 'Garage') {
      onNavigateToGarage?.();
    } else if (tab === 'Orders') {
      onNavigateToOrders?.();
    } else if (tab === 'Admin') {
      if (currentUser?.role === 'admin') {
        onNavigateToAdmin?.();
      }
    }
  };

  const [catalogProducts, setCatalogProducts] = useState(
    Array.isArray(productsList) && productsList.length > 0 ? productsList : MOTOR_PARTS
  );

  // Load wishlist IDs on mount or when user changes
  const loadWishlist = () => {
    const ids = wishlistService.getWishlistIds(currentUser?.id || 'guest');
    setWishlistIds(Array.isArray(ids) ? ids : []);
  };

  useEffect(() => {
    loadWishlist();
    productService.getProducts().then((data) => {
      if (Array.isArray(data)) setCatalogProducts(data);
    });
    const unsubscribe = productService.subscribe((data) => {
      if (Array.isArray(data)) setCatalogProducts(data);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Wishlisted product objects from catalog
  const wishlistedProducts = useMemo(() => {
    const prods = Array.isArray(catalogProducts) ? catalogProducts : MOTOR_PARTS;
    const map = new Map(prods.map((p) => [p.id, p]));
    const uniqueIds = Array.from(new Set(wishlistIds || []));
    return uniqueIds.map((id) => map.get(id)).filter(Boolean);
  }, [wishlistIds, catalogProducts]);

  // Filtered and Sorted products
  const displayedProducts = useMemo(() => {
    let list = wishlistedProducts.filter((item) => {
      const matchCat =
        selectedCategory === 'All' || item.category.toLowerCase() === selectedCategory.toLowerCase();
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });

    if (sortBy === 'price-low') {
      list = [...list].sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-high') {
      list = [...list].sort((a, b) => b.price - a.price);
    } else if (sortBy === 'rating') {
      list = [...list].sort((a, b) => (b.rating || 5) - (a.rating || 5));
    }

    return list;
  }, [wishlistedProducts, selectedCategory, searchQuery, sortBy]);

  // Total value of saved items
  const totalWishlistValue = useMemo(() => {
    return wishlistedProducts.reduce((sum, p) => sum + (p.price || 0), 0);
  }, [wishlistedProducts]);

  // Handle Remove single item
  const handleRemove = (productId, productName) => {
    wishlistService.removeFromWishlist(currentUser?.id || 'guest', productId);
    if (wishlistCtx?.removeFromWishlist) {
      wishlistCtx.removeFromWishlist(productId);
    }
    setWishlistIds(wishlistService.getWishlistIds(currentUser?.id || 'guest'));
    showToast(`Removed "${productName.slice(0, 20)}..." from favorites`);
  };

  // Handle Add to Cart
  const handleAddToCart = (product) => {
    if (typeof onAddToCart === 'function') {
      onAddToCart(product, 1);
    } else if (cartCtx?.addToCart) {
      cartCtx.addToCart(product, 1);
    }
    showToast(`Added "${product.name.slice(0, 20)}..." to bag!`);
  };

  // Handle Move All to Cart
  const handleMoveAllToCart = () => {
    if (wishlistedProducts.length === 0) return;
    wishlistedProducts.forEach((p) => {
      if (typeof onAddToCart === 'function') {
        onAddToCart(p, 1);
      } else if (cartCtx?.addToCart) {
        cartCtx.addToCart(p, 1);
      }
    });
    showToast(`Added all ${wishlistedProducts.length} items to shopping bag!`);
  };

  // Handle Clear Wishlist
  const handleClearConfirm = () => {
    wishlistService.clearWishlist(currentUser?.id || 'guest');
    if (wishlistCtx?.clearWishlist) {
      wishlistCtx.clearWishlist();
    }
    setWishlistIds([]);
    setIsClearModalOpen(false);
    showToast('Favorites cleared');
  };

  // Determine grid column layout
  const getGridItemStyle = () => {
    if (windowWidth >= 1200) return styles.gridItemCol4;
    if (windowWidth >= 880) return styles.gridItemCol3;
    if (windowWidth >= 600) return styles.gridItemCol2;
    return styles.gridItemCol1;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      {/* ─── TOP NAVBAR (CROSS-PLATFORM) ─── */}
      <View style={styles.navbarWrapper}>
        <View style={[styles.maxContainer, styles.navbarInner]}>
          <View style={styles.logoRow}>
            <BrandLogo size={36} />
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.maxContainer}>
          {/* ─── HEADER & BREADCRUMB ─── */}
          <View style={styles.headerSection}>
            <View style={styles.breadcrumbRow}>
              <TouchableOpacity onPress={onNavigateToStore}>
                <Text style={styles.breadcrumbText}>Home</Text>
              </TouchableOpacity>
              <BootstrapIcon name="arrow-right" size={10} color="#94A3B8" />
              <Text style={[styles.breadcrumbText, styles.breadcrumbActive]}>Saved Wishlist</Text>
            </View>

            <View style={styles.titleRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <BootstrapIcon name="heart-fill" size={24} color="#EF4444" style={{ marginRight: 10 }} />
                <Text style={styles.pageTitle}>My Saved Wishlist</Text>
                <View style={styles.itemCountBadge}>
                  <Text style={styles.itemCountBadgeText}>
                    {wishlistedProducts.length} {wishlistedProducts.length === 1 ? 'item' : 'items'}
                  </Text>
                </View>
              </View>

              {wishlistedProducts.length > 0 && (
                <View style={styles.headerControls}>
                  <TouchableOpacity
                    style={styles.headerActionBtn}
                    onPress={handleMoveAllToCart}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon name="cart-check-fill" size={14} color="#FFFFFF" />
                    <Text style={styles.headerActionBtnText}>
                      Move All to Cart (${totalWishlistValue.toFixed(2)})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.headerSecondaryBtn}
                    onPress={() => setIsClearModalOpen(true)}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon name="trash3-fill" size={13} color="#EF4444" />
                    <Text style={styles.headerSecondaryBtnText}>Clear All</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* ─── SEARCH & CATEGORY TOOLBAR ─── */}
          {wishlistedProducts.length > 0 && (
            <View style={styles.toolbarCard}>
              <View style={styles.toolbarRow}>
                {/* Search in Wishlist */}
                <View style={styles.searchBox}>
                  <BootstrapIcon name="search" size={14} color="#94A3B8" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search in your saved favorites..."
                    placeholderTextColor="#94A3B8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  {searchQuery ? (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <BootstrapIcon name="x-lg" size={12} color="#64748B" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Sort dropdown pills */}
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {[
                    { id: 'default', label: 'Default' },
                    { id: 'price-low', label: 'Price: Low' },
                    { id: 'price-high', label: 'Price: High' },
                    { id: 'rating', label: 'Rating' },
                  ].map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.filterPill, sortBy === s.id && styles.filterPillActive]}
                      onPress={() => setSortBy(s.id)}
                    >
                      <Text style={[styles.filterPillText, sortBy === s.id && styles.filterPillTextActive]}>
                        {s.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Category Filter Pills */}
              <View style={{ marginTop: 12 }}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterPillsScroll}
                >
                  {CATEGORIES.map((cat) => {
                    const isActive = selectedCategory.toLowerCase() === cat.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.filterPill, isActive && styles.filterPillActive]}
                        onPress={() => setSelectedCategory(cat)}
                      >
                        <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          )}

          {/* ─── PRODUCT GRID OR EMPTY STATE ─── */}
          {wishlistedProducts.length === 0 ? (
            <View style={styles.emptyStateWrap}>
              <View style={styles.emptyIconWrap}>
                <BootstrapIcon name="heart" size={40} color="#EF4444" />
              </View>
              <Text style={styles.emptyTitle}>Your Wishlist is Empty</Text>
              <Text style={styles.emptySubtitle}>
                Explore our premium motorcycle spare parts, titanium racing exhausts, Brembo braking systems,
                and Öhlins suspension, then tap the heart icon to save your favorites here.
              </Text>
              <TouchableOpacity style={styles.emptyShopBtn} onPress={onNavigateToStore} activeOpacity={0.9}>
                <BootstrapIcon name="cart-fill" size={15} color="#FFFFFF" />
                <Text style={styles.emptyShopBtnText}>Explore Store Catalog</Text>
              </TouchableOpacity>
            </View>
          ) : displayedProducts.length === 0 ? (
            <View style={styles.emptyStateWrap}>
              <BootstrapIcon name="search" size={36} color="#94A3B8" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>No matching items found</Text>
              <Text style={styles.emptySubtitle}>
                No saved items match your filter "{selectedCategory}" or search query "{searchQuery}".
              </Text>
              <TouchableOpacity
                style={styles.headerSecondaryBtn}
                onPress={() => {
                  setSelectedCategory('All');
                  setSearchQuery('');
                  setSortBy('default');
                }}
              >
                <Text style={styles.headerSecondaryBtnText}>Reset Filters</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.grid}>
              {displayedProducts.map((product) => {
                const isOutOfStock = Number(product.stock || 0) <= 0;
                return (
                  <View key={product.id} style={[styles.productCard, getGridItemStyle()]}>
                    {/* Image & Badges */}
                    <View style={styles.imageWrap}>
                      <Image source={{ uri: product.image }} style={styles.productImage} />
                      {product.discount ? (
                        <View style={styles.discountBadge}>
                          <Text style={styles.badgePillText}>{product.discount}</Text>
                        </View>
                      ) : product.badge ? (
                        <View style={styles.badgePill}>
                          <Text style={styles.badgePillText}>{product.badge}</Text>
                        </View>
                      ) : null}

                      <TouchableOpacity
                        style={styles.removeIconBtn}
                        onPress={() => handleRemove(product.id, product.name)}
                        activeOpacity={0.8}
                        title="Remove from favorites"
                      >
                        <BootstrapIcon name="heart-fill" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>

                    {/* Card Body */}
                    <View style={styles.cardBody}>
                      <View style={styles.brandCategoryRow}>
                        <Text style={styles.brandText}>{product.brand}</Text>
                        <Text style={styles.categoryText}>{product.category}</Text>
                      </View>

                      <Text style={styles.productName} numberOfLines={2}>
                        {product.name}
                      </Text>

                      <View style={styles.ratingRow}>
                        <BootstrapIcon name="star-fill" size={12} color="#F59E0B" />
                        <Text style={styles.ratingText}>{(product.rating || 5.0).toFixed(1)}</Text>
                        <Text style={styles.reviewCountText}>({product.reviews || 0} reviews)</Text>
                      </View>

                      {/* Stock Indicator */}
                      <View style={styles.stockBadgeInStock}>
                        <BootstrapIcon
                          name={isOutOfStock ? 'x-lg' : 'check2'}
                          size={11}
                          color={isOutOfStock ? '#DC2626' : '#16A34A'}
                        />
                        <Text style={[styles.stockBadgeText, isOutOfStock && { color: '#DC2626' }]}>
                          {isOutOfStock ? 'Out of Stock' : `In Stock (${product.stock || 15} units)`}
                        </Text>
                      </View>

                      {/* Price Row */}
                      <View style={styles.priceRow}>
                        <Text style={styles.mainPrice}>₱{product.price.toFixed(2)}</Text>
                        {product.oldPrice && (
                          <Text style={styles.oldPrice}>₱{product.oldPrice.toFixed(2)}</Text>
                        )}
                      </View>

                      {/* Action Buttons */}
                      <View style={styles.cardActions}>
                        <TouchableOpacity
                          style={[styles.addToCartBtn, isOutOfStock && { backgroundColor: '#94A3B8' }]}
                          disabled={isOutOfStock}
                          onPress={() => handleAddToCart(product)}
                          activeOpacity={0.85}
                        >
                          <BootstrapIcon name="cart-plus-fill" size={13} color="#FFFFFF" />
                          <Text style={styles.addToCartBtnText}>
                            {isOutOfStock ? 'Sold Out' : 'Add to Cart'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.quickViewBtn}
                          onPress={() => {
                            setSelectedProductForSpecs(product);
                            setIsSpecsModalOpen(true);
                          }}
                          activeOpacity={0.8}
                          title="View specifications"
                        >
                          <BootstrapIcon name="eye" size={15} color="#475569" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ─── MOBILE BOTTOM FLOATING SUMMARY BAR ─── */}
      {wishlistedProducts.length > 0 && (
        <View style={styles.mobileFloatingBar}>
          <View>
            <Text style={styles.mobileSummaryText}>
              {wishlistedProducts.length} Saved {wishlistedProducts.length === 1 ? 'Item' : 'Items'}
            </Text>
            <Text style={styles.mobileSummaryTotal}>₱{totalWishlistValue.toFixed(2)}</Text>
          </View>

          <TouchableOpacity style={styles.mobileAddAllBtn} onPress={handleMoveAllToCart} activeOpacity={0.9}>
            <BootstrapIcon name="cart-check-fill" size={14} color="#FFFFFF" />
            <Text style={styles.mobileAddAllBtnText}>Move All to Cart</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ─── MODAL 1: PRODUCT SPECS QUICK VIEW MODAL ─── */}
      <Modal visible={isSpecsModalOpen} transparent animationType="slide">
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 16,
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 520,
              backgroundColor: '#FFFFFF',
              borderRadius: 24,
              padding: 20,
              maxHeight: '85%',
            }}
          >
            {selectedProductForSpecs && (
              <>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 14,
                  }}
                >
                  <Text style={{ fontSize: 18, fontWeight: '900', color: '#0F172A' }}>
                    Product Specifications
                  </Text>
                  <TouchableOpacity
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: '#F1F5F9',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                    onPress={() => setIsSpecsModalOpen(false)}
                  >
                    <BootstrapIcon name="x-lg" size={14} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ maxHeight: 380 }}>
                  <Image
                    source={{ uri: selectedProductForSpecs.image }}
                    style={{
                      width: '100%',
                      height: 200,
                      borderRadius: 14,
                      marginBottom: 14,
                      resizeMode: 'cover',
                    }}
                  />
                  <Text style={{ fontSize: 17, fontWeight: '800', color: '#0F172A', marginBottom: 4 }}>
                    {selectedProductForSpecs.name}
                  </Text>
                  <Text style={{ fontSize: 12.5, color: '#0C6258', fontWeight: '700', marginBottom: 10 }}>
                    {selectedProductForSpecs.brand} • {selectedProductForSpecs.category}
                  </Text>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: '#0F172A', marginBottom: 12 }}>
                    ₱{selectedProductForSpecs.price.toFixed(2)}
                  </Text>
                  <Text style={{ fontSize: 13.5, color: '#475569', lineHeight: 20, marginBottom: 14 }}>
                    {selectedProductForSpecs.description}
                  </Text>

                  {selectedProductForSpecs.features?.map((feat, idx) => (
                    <View
                      key={idx}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}
                    >
                      <BootstrapIcon name="check2" size={13} color="#0C6258" />
                      <Text style={{ fontSize: 13, color: '#334155' }}>{feat}</Text>
                    </View>
                  ))}
                </ScrollView>

                <TouchableOpacity
                  style={{
                    backgroundColor: '#0C6258',
                    paddingVertical: 12,
                    borderRadius: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    marginTop: 14,
                  }}
                  onPress={() => {
                    handleAddToCart(selectedProductForSpecs);
                    setIsSpecsModalOpen(false);
                  }}
                >
                  <BootstrapIcon name="cart-plus-fill" size={14} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>Add to Cart</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 2: CONFIRM CLEAR WISHLIST ─── */}
      <Modal visible={isClearModalOpen} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 420,
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              padding: 24,
              alignItems: 'center',
            }}
          >
            <BootstrapIcon name="trash3-fill" size={36} color="#EF4444" style={{ marginBottom: 12 }} />
            <Text style={{ fontSize: 18, fontWeight: '900', color: '#0F172A', marginBottom: 6 }}>
              Clear Your Saved Wishlist?
            </Text>
            <Text
              style={{
                fontSize: 13.5,
                color: '#64748B',
                textAlign: 'center',
                lineHeight: 20,
                marginBottom: 20,
              }}
            >
              This will remove all {wishlistedProducts.length} items from your favorites. You will need to
              re-add them from the catalog.
            </Text>

            <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#F1F5F9',
                  paddingVertical: 11,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
                onPress={() => setIsClearModalOpen(false)}
              >
                <Text style={{ color: '#475569', fontWeight: '700', fontSize: 13.5 }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#EF4444',
                  paddingVertical: 11,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
                onPress={handleClearConfirm}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13.5 }}>Yes, Clear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── PERSISTENT MOBILE BOTTOM NAVIGATION ─── */}
      <BottomNavBar
        activeTab="Wishlist"
        onTabChange={handleBottomNavChange}
        wishlistCount={wishlistedProducts.length}
        currentUser={currentUser}
      />
    </SafeAreaView>
  );
}
