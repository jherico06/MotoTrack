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
  useWindowDimensions,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { wishlistStyles as styles } from '../../../styles/wishlistPage.styles.js';
import { wishlistService } from '../../../services/products/wishlistService.js';
import { BootstrapIcon, BottomNavBar, BrandLogo } from '../../../components/common';
import { BookInstallationModal } from '../../../components/modals';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useWishlist } from '../../../context/WishlistContext.jsx';
import { useCart } from '../../../context/CartContext.jsx';
import { useTheme } from '../../../context/ThemeContext.jsx';
import { productService } from '../../../services/products/productService.js';
import { promoService } from '../../../services/products/promoService.js';
import { CATEGORY_NAMES } from '../../../data/motorParts.js';
import { getRatedScore, productHasCustomerRatings, sanitizeCompareAtPrice } from '../../../utils/productCatalog.js';
import { aiCustomizerService } from '../../../services/ai/aiCustomizerService.js';
import { GARAGE_BRANCHES, TIME_SLOTS } from '../../../services/bookings/garageService.js';

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
  onOpenCart: _onOpenCart,
  cartItemCount: _cartItemCount,
  cartTotal: _cartTotal,
  showToast: propShowToast,
  onNavigateToProductDetails,
  onNavigateToScreen,
}) {
  const auth = useAuth();
  const wishlistCtx = useWishlist();
  const cartCtx = useCart();
  const { isDarkMode = false } = useTheme?.() || {};

  const currentUser = propCurrentUser !== undefined ? propCurrentUser : auth?.currentUser;
  const showToast = propShowToast || cartCtx?.showToast || (() => {});
  const { width: windowWidth } = useWindowDimensions();

  const userId = currentUser?.id || 'guest';
  const [prevUserId, setPrevUserId] = useState(userId);
  const [wishlistIds, setWishlistIds] = useState(() => {
    const ids = wishlistService.getWishlistIds(userId);
    return Array.isArray(ids) ? ids : [];
  });

  if (prevUserId !== userId) {
    setPrevUserId(userId);
    const ids = wishlistService.getWishlistIds(userId);
    setWishlistIds(Array.isArray(ids) ? ids : []);
  }

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('default'); // 'default' | 'price-low' | 'price-high' | 'rating'
  const [selectedProductForSpecs, setSelectedProductForSpecs] = useState(null);
  const [isSpecsModalOpen, setIsSpecsModalOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const aiInstalls = Array.isArray(wishlistCtx?.customizations) ? wishlistCtx.customizations : [];
  const [bookingTarget, setBookingTarget] = useState(null);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingBranch, setBookingBranch] = useState(
    () => GARAGE_BRANCHES?.[0]?.name || "D'Blockchain Motorparts"
  );
  const [bookingTimeSlot, setBookingTimeSlot] = useState(() => TIME_SLOTS?.[1] || '10:30 AM - 12:00 PM');
  const [bookingPhone, setBookingPhone] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingFreeInstall, setBookingFreeInstall] = useState(null);

  const handleBottomNavChange = (tab) => {
    if (tab === 'Home' || tab === 'Search') {
      onNavigateToStore?.();
    } else if (tab === 'Cart') {
      onNavigateToStore?.();
    } else if (tab === 'Wishlist' || tab === 'Favorites') {
      setSelectedCategory('All');
    } else if (tab === 'More') {
      if (!currentUser) {
        onNavigateToLogin?.();
      } else {
        onNavigateToProfile?.('menu');
      }
    } else if (tab === 'Dashboard') {
      if (!currentUser) {
        onNavigateToLogin?.();
      } else {
        onNavigateToProfile?.('overview');
      }
    } else if (tab === 'Bookings') {
      if (!currentUser) {
        onNavigateToLogin?.();
      } else {
        onNavigateToProfile?.('bookings');
      }
    } else if (tab === 'Notifications') {
      onNavigateToProfile?.('notifications');
    } else if (tab === 'Profile') {
      if (!currentUser) {
        onNavigateToLogin?.();
      } else {
        onNavigateToProfile?.('profile');
      }
    } else if (tab === 'Services') {
      onNavigateToGarage?.();
    } else if (tab === 'Customize') {
      if (onNavigateToCustomizer) onNavigateToCustomizer();
      else if (onNavigateToCustomize) onNavigateToCustomize();
      else onNavigateToStore?.();
    } else if (tab === 'Garage') {
      onNavigateToProfile?.('garage');
    } else if (tab === 'Orders') {
      onNavigateToOrders?.();
    } else if (tab === 'Admin') {
      if (currentUser?.role === 'admin') {
        onNavigateToAdmin?.();
      }
    }
  };

  const [catalogProducts, setCatalogProducts] = useState(
    Array.isArray(productsList) ? productsList : []
  );

  useEffect(() => {
    productService.getProducts().then((data) => {
      if (Array.isArray(data)) setCatalogProducts(data);
    });
    const unsubscribe = productService.subscribe((data) => {
      if (Array.isArray(data)) setCatalogProducts(data);
    });
    return () => unsubscribe();
  }, []);

  // Wishlisted product objects from catalog
  const wishlistedProducts = useMemo(() => {
    const prods = Array.isArray(catalogProducts) ? catalogProducts : [];
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
      list = [...list].sort((a, b) => getRatedScore(b) - getRatedScore(a));
    }

    return list;
  }, [wishlistedProducts, selectedCategory, searchQuery, sortBy]);

  // Total value of saved items
  const totalWishlistValue = useMemo(() => {
    return wishlistedProducts.reduce((sum, p) => sum + Number(p.price || 0), 0);
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

  const openInstallBooking = async (entry) => {
    if (!currentUser) {
      showToast('Please sign in to book installation.');
      onNavigateToLogin?.();
      return;
    }
    setBookingTarget(entry);
    setBookingPhone(currentUser?.phone || '');
    setBookingNotes('');
    const pids = (entry.productIds || []).map(String);
    try {
      const match = await promoService.findApplicableFreeInstallation(pids);
      setBookingFreeInstall(match);
    } catch {
      setBookingFreeInstall(null);
    }
  };

  const confirmInstallBooking = async () => {
    if (!bookingTarget) return;
    if (!bookingPhone.trim()) {
      showToast('Please enter your contact phone number');
      return;
    }
    setBookingBusy(true);
    try {
      const moto = bookingTarget.motorcycle || {};
      const selectedParts = (bookingTarget.items || [])
        .map((it) => ({
          id: it.productId || it.product_id || it.id,
          product_id: it.productId || it.product_id || it.id,
          name: it.name || it.product_name,
          price: Number(it.price) || 0,
          brand: it.brand || '',
        }))
        .filter((p) => p.id);

      const booking = await aiCustomizerService.bookCustomizationService({
        customizationData: {
          customizationId: bookingTarget.customizationId || bookingTarget.id,
          bikeName:
            bookingTarget.name ||
            [moto.brand, moto.model].filter(Boolean).join(' ') ||
            'Motorcycle',
          bikeBrand: moto.brand || 'Motorcycle',
          bikeModel: moto.model || '',
          motorcycleId: moto.motorcycle_id || moto.motorcycleId || null,
          selectedParts,
          partsTotalUsd: selectedParts.reduce((s, p) => s + Number(p.price || 0), 0),
          generatedImage: bookingTarget.previewImageUrl,
        },
        branchName: bookingBranch,
        appointmentDate: 'Tomorrow',
        timeSlot: bookingTimeSlot,
        customerName: currentUser?.name || 'Rider',
        customerPhone: bookingPhone.trim(),
        plateNumber: moto.plate_number || 'Pending Plate',
        notes: bookingNotes,
        currentUser,
      });

      setBookingTarget(null);
      const feeMsg = booking?.installationFeeWaived ? ' Free installation applied!' : '';
      showToast(`🏁 Installation booked! Ticket #${booking?.id || booking?.booking_id}.${feeMsg}`);
      onNavigateToGarage?.();
    } catch (err) {
      showToast(err?.message || 'Could not book installation.');
    } finally {
      setBookingBusy(false);
    }
  };

  // Determine grid column layout with responsive 2-column mobile support
  const getGridItemStyle = () => {
    if (windowWidth >= 1200) return styles.gridItemCol4;
    if (windowWidth >= 880) return styles.gridItemCol3;
    const isMobile = windowWidth < 700;
    const hPad = windowWidth < 380 ? 12 : 16;
    const cardGap = isMobile ? 10 : 16;
    if (isMobile) {
      return {
        width: Math.floor((windowWidth - hPad * 2 - cardGap) / 2),
      };
    }
    return styles.gridItemCol2;
  };

  return (
    <SafeAreaView style={[styles.safeArea, isDarkMode && { backgroundColor: '#24272B' }]}>
      <StatusBar style="light" translucent backgroundColor="transparent" />

      {/* ─── 1. NATIVE MOBILE APP HEADER ─── */}
      <View style={[styles.appHeaderRow, isDarkMode && { backgroundColor: '#24272B' }]}>
        <Text style={styles.appHeaderTitle}>My Wishlist</Text>
      </View>

      <ScrollView
        style={[styles.container, isDarkMode && { backgroundColor: '#121518' }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.maxContainer}>
          {/* ─── HEADER & BREADCRUMB ─── */}
          <View style={styles.headerSection}>
            <View style={styles.breadcrumbRow}>
              <TouchableOpacity onPress={onNavigateToStore}>
                <Text style={[styles.breadcrumbText, isDarkMode && { color: '#94A3B8' }]}>Home</Text>
              </TouchableOpacity>
              <BootstrapIcon name="arrow-right" size={10} color={isDarkMode ? '#64748B' : '#94A3B8'} />
              <Text style={[styles.breadcrumbText, styles.breadcrumbActive]}>Saved Wishlist</Text>
            </View>

            <View style={styles.titleRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <BootstrapIcon name="heart-fill" size={24} color="#EF4444" style={{ marginRight: 10 }} />
                <Text style={[styles.pageTitle, isDarkMode && { color: '#F9FAFB' }]}>My Saved Wishlist</Text>
                <View style={[styles.itemCountBadge, isDarkMode && { backgroundColor: '#23272B' }]}>
                  <Text style={[styles.itemCountBadgeText, isDarkMode && { color: '#E2E8F0' }]}>
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
            <View style={[styles.toolbarCard, isDarkMode && { backgroundColor: '#1C1F23', borderColor: '#2B3035' }]}>
              <View style={styles.toolbarRow}>
                {/* Search in Wishlist */}
                <View style={[styles.searchBox, isDarkMode && { backgroundColor: '#23272B', borderColor: '#2B3035' }]}>
                  <BootstrapIcon name="search" size={14} color={isDarkMode ? '#64748B' : '#94A3B8'} />
                  <TextInput
                    style={[styles.searchInput, isDarkMode && { color: '#F9FAFB' }]}
                    placeholder="Search in your saved favorites..."
                    placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  {searchQuery ? (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <BootstrapIcon name="x-lg" size={12} color={isDarkMode ? '#94A3B8' : '#64748B'} />
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
                      style={[
                        styles.filterPill,
                        sortBy === s.id && styles.filterPillActive,
                        sortBy !== s.id && isDarkMode && { backgroundColor: '#23272B', borderColor: '#2B3035' },
                      ]}
                      onPress={() => setSortBy(s.id)}
                    >
                      <Text
                        style={[
                          styles.filterPillText,
                          sortBy === s.id && styles.filterPillTextActive,
                          sortBy !== s.id && isDarkMode && { color: '#E2E8F0' },
                        ]}
                      >
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
                        style={[
                          styles.filterPill,
                          isActive && styles.filterPillActive,
                          !isActive && isDarkMode && { backgroundColor: '#23272B', borderColor: '#2B3035' },
                        ]}
                        onPress={() => setSelectedCategory(cat)}
                      >
                        <Text
                          style={[
                            styles.filterPillText,
                            isActive && styles.filterPillTextActive,
                            !isActive && isDarkMode && { color: '#E2E8F0' },
                          ]}
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          )}

          {/* ─── AI INSTALL PREVIEWS ─── */}
          {aiInstalls.length > 0 ? (
            <View style={{ marginBottom: 18 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 10 }}>
                AI Installation Previews
              </Text>
              {aiInstalls.map((entry) => (
                <View
                  key={entry.id || entry.customizationId}
                  style={{
                    flexDirection: 'row',
                    gap: 12,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    borderRadius: 12,
                    padding: 10,
                    marginBottom: 10,
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  {entry.previewImageUrl ? (
                    <Image
                      source={{ uri: entry.previewImageUrl }}
                      style={{ width: 88, height: 72, borderRadius: 8, backgroundColor: '#F1F5F9' }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 88,
                        height: 72,
                        borderRadius: 8,
                        backgroundColor: '#F1F5F9',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <BootstrapIcon name="image" size={22} color="#94A3B8" />
                    </View>
                  )}
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }} numberOfLines={2}>
                      {entry.name || entry.title || 'AI Install Preview'}
                    </Text>
                    <TouchableOpacity
                      style={{
                        backgroundColor: '#EA580C',
                        borderRadius: 8,
                        paddingVertical: 8,
                        alignItems: 'center',
                      }}
                      onPress={() => openInstallBooking(entry)}
                      activeOpacity={0.85}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <BootstrapIcon name="calendar-check" size={13} color="#FFFFFF" />
                        <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800' }}>
                          Book Installation
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {(entry.productIds || []).length > 0 ? (
                      <TouchableOpacity
                        style={{
                          borderWidth: 1,
                          borderColor: '#EA580C',
                          borderRadius: 8,
                          paddingVertical: 7,
                          alignItems: 'center',
                        }}
                        onPress={() => {
                          const first = catalogProducts.find((p) =>
                            (entry.productIds || []).includes(String(p.id))
                          );
                          if (first) {
                            if (typeof onAddToCart === 'function') onAddToCart(first, 1);
                            else if (cartCtx?.addToCart) cartCtx.addToCart(first, 1);
                            showToast(`Added ${first.name} to cart`);
                          } else {
                            showToast('Part added via Install Studio wishlist.');
                          }
                        }}
                        activeOpacity={0.85}
                      >
                        <Text style={{ color: '#EA580C', fontSize: 11.5, fontWeight: '700' }}>
                          Add Part to Cart
                        </Text>
                      </TouchableOpacity>
                    ) : null}

                    <TouchableOpacity
                      onPress={() => {
                        wishlistCtx?.removeCustomizationFromWishlist?.(
                          entry.id || entry.customizationId
                        );
                        showToast('Removed AI preview');
                      }}
                      style={{ alignSelf: 'flex-start', paddingVertical: 2 }}
                    >
                      <Text style={{ fontSize: 11, color: '#DC2626', fontWeight: '700' }}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {/* ─── PRODUCT GRID OR EMPTY STATE ─── */}
          {wishlistedProducts.length === 0 && aiInstalls.length === 0 ? (
            <View style={[styles.emptyStateWrap, isDarkMode && { backgroundColor: '#1C1F23', borderColor: '#2B3035' }]}>
              <View style={[styles.emptyIconWrap, isDarkMode && { backgroundColor: '#2B1A1A' }]}>
                <BootstrapIcon name="heart" size={40} color="#EF4444" />
              </View>
              <Text style={[styles.emptyTitle, isDarkMode && { color: '#F9FAFB' }]}>Your Wishlist is Empty</Text>
              <Text style={[styles.emptySubtitle, isDarkMode && { color: '#94A3B8' }]}>
                Save catalog parts with the heart icon, or save AI installation previews from Install
                Studio.
              </Text>
              <TouchableOpacity style={styles.emptyShopBtn} onPress={onNavigateToStore} activeOpacity={0.9}>
                <BootstrapIcon name="cart-fill" size={15} color="#FFFFFF" />
                <Text style={styles.emptyShopBtnText}>Explore Store Catalog</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.emptyShopBtn, { backgroundColor: '#0F172A', marginTop: 10 }]}
                onPress={() => onNavigateToCustomizer?.() || onNavigateToCustomize?.()}
                activeOpacity={0.9}
              >
                <BootstrapIcon name="stars" size={15} color="#FFFFFF" />
                <Text style={styles.emptyShopBtnText}>Open Install Studio</Text>
              </TouchableOpacity>
            </View>
          ) : wishlistedProducts.length === 0 ? null : displayedProducts.length === 0 ? (
            <View style={[styles.emptyStateWrap, isDarkMode && { backgroundColor: '#1C1F23', borderColor: '#2B3035' }]}>
              <BootstrapIcon name="search" size={36} color={isDarkMode ? '#64748B' : '#94A3B8'} style={{ marginBottom: 12 }} />
              <Text style={[styles.emptyTitle, isDarkMode && { color: '#F9FAFB' }]}>No matching items found</Text>
              <Text style={[styles.emptySubtitle, isDarkMode && { color: '#94A3B8' }]}>
                No saved items match your filter "{selectedCategory}" or search query "{searchQuery}".
              </Text>
              <TouchableOpacity
                style={[styles.headerSecondaryBtn, isDarkMode && { backgroundColor: '#23272B', borderColor: '#2B3035' }]}
                onPress={() => {
                  setSelectedCategory('All');
                  setSearchQuery('');
                  setSortBy('default');
                }}
              >
                <Text style={[styles.headerSecondaryBtnText, isDarkMode && { color: '#E2E8F0' }]}>Reset Filters</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.grid, windowWidth < 700 && { gap: 10 }]}>
              {displayedProducts.map((product) => {
                const isOutOfStock = Number(product.stock || 0) <= 0;
                const compareAt = sanitizeCompareAtPrice(product.oldPrice, product.price);
                return (
                  <View
                    key={product.id}
                    style={[
                      styles.productCard,
                      getGridItemStyle(),
                      isDarkMode && { backgroundColor: '#1C1F23', borderColor: '#2B3035' },
                    ]}
                  >
                    {/* Image & Badges */}
                    <TouchableOpacity
                      style={[styles.imageWrap, isDarkMode && { backgroundColor: '#14171A' }]}
                      activeOpacity={0.9}
                      onPress={() => {
                        if (onNavigateToProductDetails) {
                          onNavigateToProductDetails(product);
                        } else if (onNavigateToScreen) {
                          onNavigateToScreen('product-details', { product });
                        } else {
                          setSelectedProductForSpecs(product);
                          setIsSpecsModalOpen(true);
                        }
                      }}
                    >
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
                        style={[
                          styles.removeIconBtn,
                          isDarkMode && { backgroundColor: 'rgba(30, 34, 38, 0.9)', borderColor: '#2B3035' },
                        ]}
                        onPress={(e) => {
                          e?.stopPropagation?.();
                          handleRemove(product.id, product.name);
                        }}
                        activeOpacity={0.8}
                        title="Remove from favorites"
                      >
                        <BootstrapIcon name="heart-fill" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </TouchableOpacity>

                    {/* Card Body */}
                    <View style={[styles.cardBody, isDarkMode && { backgroundColor: '#1C1F23' }]}>
                      <View style={styles.brandCategoryRow}>
                        <Text style={[styles.brandText, isDarkMode && { color: '#94A3B8' }]}>{product.brand}</Text>
                        <Text style={[styles.categoryText, isDarkMode && { color: '#64748B' }]}>{product.category}</Text>
                      </View>

                      <TouchableOpacity
                        onPress={() => {
                          if (onNavigateToProductDetails) {
                            onNavigateToProductDetails(product);
                          } else if (onNavigateToScreen) {
                            onNavigateToScreen('product-details', { product });
                          } else {
                            setSelectedProductForSpecs(product);
                            setIsSpecsModalOpen(true);
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.productName, isDarkMode && { color: '#F9FAFB' }]} numberOfLines={2}>
                          {product.name}
                        </Text>
                      </TouchableOpacity>

                      <View style={styles.ratingRow}>
                        {productHasCustomerRatings(product) ? (
                          <>
                            <BootstrapIcon name="star-fill" size={12} color="#F59E0B" />
                            <Text style={styles.ratingText}>{Number(product.rating).toFixed(1)}</Text>
                            <Text style={styles.reviewCountText}>({product.reviews} reviews)</Text>
                          </>
                        ) : (
                          <>
                            <BootstrapIcon name="star" size={12} color="#94A3B8" />
                            <Text style={[styles.reviewCountText, { color: '#94A3B8' }]}>No ratings yet</Text>
                          </>
                        )}
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
                        <Text style={styles.mainPrice}>₱{Number(product.price || 0).toFixed(2)}</Text>
                        {compareAt ? (
                          <Text style={styles.oldPrice}>₱{Number(compareAt || 0).toFixed(2)}</Text>
                        ) : null}
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
                            if (onNavigateToProductDetails) {
                              onNavigateToProductDetails(product);
                            } else if (onNavigateToScreen) {
                              onNavigateToScreen('product-details', { product });
                            } else {
                              setSelectedProductForSpecs(product);
                              setIsSpecsModalOpen(true);
                            }
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
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              width: '100%',
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingHorizontal: 20,
              paddingTop: 18,
              paddingBottom: Platform.OS === 'ios' ? 30 : 16,
              maxHeight: '85%',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.15,
              shadowRadius: 16,
              elevation: 20,
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
                    paddingBottom: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: '#F1F5F9',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        backgroundColor: '#FFF7ED',
                        borderWidth: 1,
                        borderColor: '#FED7AA',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <BootstrapIcon name="box-seam-fill" size={16} color="#EA580C" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16.5, fontWeight: '800', color: '#0F172A' }}>
                        Product Specifications
                      </Text>
                      <Text style={{ fontSize: 12, color: '#64748B', marginTop: 1 }}>
                        Quick preview & parts details
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: '#F1F5F9',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                    onPress={() => setIsSpecsModalOpen(false)}
                  >
                    <BootstrapIcon name="x-lg" size={14} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
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
                  <Text style={{ fontSize: 12.5, color: '#EA580C', fontWeight: '700', marginBottom: 10 }}>
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
                      <BootstrapIcon name="check2" size={13} color="#EA580C" />
                      <Text style={{ fontSize: 13, color: '#334155' }}>{feat}</Text>
                    </View>
                  ))}
                </ScrollView>

                <TouchableOpacity
                  style={{
                    backgroundColor: '#EA580C',
                    paddingVertical: 13,
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
                  <BootstrapIcon name="cart-plus-fill" size={15} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>Add to Cart</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 2: CONFIRM CLEAR WISHLIST ─── */}
      <Modal visible={isClearModalOpen} transparent animationType="slide">
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              width: '100%',
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingHorizontal: 20,
              paddingTop: 24,
              paddingBottom: Platform.OS === 'ios' ? 34 : 20,
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.15,
              shadowRadius: 16,
              elevation: 20,
            }}
          >
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: '#FEF2F2',
                borderWidth: 1.5,
                borderColor: '#FEE2E2',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 14,
              }}
            >
              <BootstrapIcon name="trash3-fill" size={24} color="#EF4444" />
            </View>
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
                paddingHorizontal: 12,
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
                  paddingVertical: 13,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() => setIsClearModalOpen(false)}
              >
                <Text style={{ color: '#475569', fontWeight: '700', fontSize: 13.5 }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#EF4444',
                  paddingVertical: 13,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={handleClearConfirm}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13.5 }}>Yes, Clear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── BOOK INSTALLATION MODAL FOR AI PREVIEWS ─── */}
      <BookInstallationModal
        visible={Boolean(bookingTarget)}
        onClose={() => !bookingBusy && setBookingTarget(null)}
        previewImageUri={bookingTarget?.previewImageUrl || bookingTarget?.preview_image_url}
        motorcycle={bookingTarget?.motorcycle}
        bikeTitle={
          bookingTarget?.motorcycle
            ? `${bookingTarget.motorcycle.brand || ''} ${bookingTarget.motorcycle.model || ''}`.trim()
            : ''
        }
        serviceName={bookingTarget?.name || bookingTarget?.title || 'AI Custom Installation'}
        laborFeePhp={3250}
        freeInstallPromo={bookingFreeInstall}
        branches={GARAGE_BRANCHES}
        selectedBranch={bookingBranch}
        onSelectBranch={setBookingBranch}
        timeSlots={TIME_SLOTS}
        selectedTimeSlot={bookingTimeSlot}
        onSelectTimeSlot={setBookingTimeSlot}
        phone={bookingPhone}
        onChangePhone={setBookingPhone}
        notes={bookingNotes}
        onChangeNotes={setBookingNotes}
        onConfirm={confirmInstallBooking}
        busy={bookingBusy}
      />

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
