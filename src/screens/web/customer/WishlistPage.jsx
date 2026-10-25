import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  useWindowDimensions,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  BootstrapIcon,
  ToastNotification,
  BottomNavBar,
  UserProfileDropdown,
  UserProfileButton,
  BrandLogo,
  NotificationDropdown,
} from '../../../components/common';
import { LiveOrderTrackingMapModal, ProductSpecsModal, CartModal, CheckoutModal, BookInstallationModal } from '../../../components/modals';
import { createWishlistWebStyles, wishlistWebStyles } from '../../../styles/web/wishlistPage.web.styles.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useCart } from '../../../context/CartContext.jsx';
import { useWishlist } from '../../../context/WishlistContext.jsx';
import { useTheme } from '../../../context/ThemeContext.jsx';
import { resolveReorderLevel } from '../../../utils/inventoryHelpers.js';
import { notificationService } from '../../../services/notifications/notificationService.js';
import { productService } from '../../../services/products/productService.js';
import { orderService } from '../../../services/orders/orderService.js';
import { productHasCustomerRatings } from '../../../utils/productCatalog.js';
import { aiCustomizerService } from '../../../services/ai/aiCustomizerService.js';
import { GARAGE_BRANCHES, TIME_SLOTS } from '../../../services/bookings/garageService.js';
import { promoService } from '../../../services/products/promoService.js';

export default function WishlistPageWeb({
  onNavigateToStore,
  onNavigateToOrders,
  onNavigateToGarage,
  onNavigateToCustomizer,
  onNavigateToCustomize,
  onNavigateToLogin,
  onNavigateToProfile,
  onNavigateToAdmin,
  onNavigateToWishlist,
  onAddToCart,
  onLogout,
}) {
  const { width: windowWidth } = useWindowDimensions();
  const { currentUser, logout, setRedirectReason } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const wStyles = useMemo(() => createWishlistWebStyles(isDarkMode), [isDarkMode]);
  const { addToCart, showToast, toastMessage, cartItemCount } = useCart();
  const {
    wishlist,
    toggleWishlist,
    clearWishlist,
    wishlistCount,
    customizations,
    removeCustomizationFromWishlist,
  } = useWishlist();

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [bookingTarget, setBookingTarget] = useState(null);
  const [bookingBranch, setBookingBranch] = useState(
    () => GARAGE_BRANCHES?.[0]?.name || "D'Blockchain Motorparts"
  );
  const [bookingTimeSlot, setBookingTimeSlot] = useState(() => TIME_SLOTS?.[1] || '10:30 AM - 12:00 PM');
  const [bookingPhone, setBookingPhone] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingFreeInstall, setBookingFreeInstall] = useState(null);

  const [unreadNotifCount, setUnreadNotifCount] = useState(() =>
    currentUser ? notificationService.getUnreadCount(currentUser) : 0
  );
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);

  useEffect(() => {
    const unsub = notificationService.subscribe(() => {
      setUnreadNotifCount(
        currentUser ? notificationService.getUnreadCount(currentUser) : 0
      );
    });
    return () => unsub?.();
  }, [currentUser?.id, currentUser?.customer_id, currentUser?.email]);

  const [catalogProducts, setCatalogProducts] = useState([]);
  const [selectedProductForSpecs, setSelectedProductForSpecs] = useState(null);
  const [isSpecsOpen, setIsSpecsOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isLiveTrackingOpen, setIsLiveTrackingOpen] = useState(false);
  const [selectedOrderForTracking, setSelectedOrderForTracking] = useState(null);

  useEffect(() => {
    productService.getProducts().then((data) => {
      if (Array.isArray(data)) setCatalogProducts(data);
    });
    const unsubscribe = productService.subscribe((data) => {
      if (Array.isArray(data)) setCatalogProducts(data);
    });
    return () => unsubscribe();
  }, []);

  const prods = Array.isArray(catalogProducts) ? catalogProducts : [];
  const wishlistedProducts = prods.filter((p) => Boolean(wishlist?.[p.id]));
  const aiInstalls = Array.isArray(customizations) ? customizations : [];
  const totalWishlistValue = wishlistedProducts.reduce((sum, p) => sum + Number(p.price || 0), 0);
  const isWishlistEmpty = wishlistedProducts.length === 0 && aiInstalls.length === 0;

  const openInstallBooking = async (entry) => {
    if (!currentUser) {
      setRedirectReason?.('Please sign in to book installation.');
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

  const handleMoveAllToCart = () => {
    if (wishlistedProducts.length === 0) return;
    wishlistedProducts.forEach((p) => {
      if (typeof onAddToCart === 'function') {
        onAddToCart(p, 1);
      } else if (addToCart) {
        addToCart(p, 1);
      }
    });
    showToast(`Added ${wishlistedProducts.length} saved items to your shopping bag!`);
  };

  const handleAddToCartSingle = (product) => {
    if (typeof onAddToCart === 'function') {
      onAddToCart(product, 1);
    } else if (addToCart) {
      addToCart(product, 1);
    }
  };

  // Balanced grid columns: not too big, not too small
  const numColumns = windowWidth >= 1250 ? 5 : windowWidth >= 980 ? 4 : windowWidth >= 680 ? 3 : 2;
  const gapSize = 16;
  const cardWidth = `calc(${100 / numColumns}% - ${((numColumns - 1) * gapSize) / numColumns}px)`;

  return (
    <View style={[wStyles.container, isDarkMode && { backgroundColor: '#0F1412' }]} className={isDarkMode ? "bg-[#0F1412] min-h-screen" : "bg-slate-100 min-h-screen"}>
      <StatusBar style={isDarkMode ? "light" : "dark"} />
      <ToastNotification message={toastMessage} />

      {/* ─── FULL-HEIGHT WISHLIST SCROLLVIEW (Scrollbar extends to top: 0 through header, matching Image 1) ─── */}
      <ScrollView
        style={{
          flex: 1,
          width: '100%',
          ...(Platform.OS === 'web' ? { overscrollBehavior: 'none', overscrollBehaviorY: 'none' } : {}),
        }}
        contentContainerStyle={wStyles.scrollContent}
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={true}
        scrollEventThrottle={16}
      >
        {/* ─── RESPONSIVE TOP STICKY NAVBAR ─── */}
        <View style={wStyles.headerWrapper}>
        <View style={[wStyles.headerInner, windowWidth < 768 && { paddingHorizontal: 16, paddingVertical: 10, gap: 10 }]}>
          {/* Left: Logo */}
          <View style={wStyles.headerLeft}>
            <TouchableOpacity
              style={wStyles.logoWrap}
              onPress={() => onNavigateToStore?.()}
              activeOpacity={0.8}
            >
              <BrandLogo size={windowWidth < 768 ? 32 : 42} textColor="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Center Navigation: Store & Repair (Desktop / Tablet only) */}
          {windowWidth >= 768 && (
            <View style={wStyles.headerCenterNav}>
              {/* Shop Button */}
              <TouchableOpacity
                className="main-nav-tab"
                style={wStyles.headerCenterBtn}
                onPress={() => onNavigateToStore?.()}
                activeOpacity={0.8}
                title="Shop"
              >
                <Text style={wStyles.headerCenterBtnText}>Shop</Text>
              </TouchableOpacity>

              {/* Repair Button */}
              <TouchableOpacity
                className="main-nav-tab"
                style={wStyles.headerCenterBtn}
                onPress={() => onNavigateToGarage?.()}
                activeOpacity={0.8}
                title="Book a Service"
              >
                <Text style={wStyles.headerCenterBtnText}>Book a Service</Text>
              </TouchableOpacity>

              {/* Customize Button */}
              <TouchableOpacity
                className="main-nav-tab"
                style={wStyles.headerCenterBtn}
                onPress={() => {
                  if (onNavigateToCustomizer) onNavigateToCustomizer();
                  else if (onNavigateToCustomize) onNavigateToCustomize();
                }}
                activeOpacity={0.8}
                title="Customize"
              >
                <Text style={wStyles.headerCenterBtnText}>Customize</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Right Header Actions */}
          <View style={[wStyles.headerActions, windowWidth < 768 && { gap: 8 }]}>
            {/* Favorites Button */}
            <TouchableOpacity
              style={wStyles.navActionIconBtn}
              onPress={() => onNavigateToWishlist?.()}
              activeOpacity={0.8}
              title="Favorites"
            >
              <BootstrapIcon name="heart" size={16} color="#FFFFFF" />
              {wishlistCount > 0 && (
                <View style={wStyles.navBadgeCircle}>
                  <Text style={wStyles.navBadgeText}>{wishlistCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Notifications Button */}
            <View style={{ position: 'relative' }}>
              <TouchableOpacity
                style={wStyles.navActionIconBtn}
                onPress={() => {
                  setIsUserDropdownOpen(false);
                  setIsNotifDropdownOpen((prev) => !prev);
                }}
                activeOpacity={0.8}
                title="Notifications"
                dataSet={{ notificationButton: true }}
                {...(Platform.OS === 'web' ? { 'data-notification-button': 'true' } : {})}
              >
                <BootstrapIcon name="bell" size={16} color="#FFFFFF" />
                {unreadNotifCount > 0 && (
                  <View style={wStyles.navBadgeCircle}>
                    <Text style={wStyles.navBadgeText}>{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <NotificationDropdown
                isOpen={isNotifDropdownOpen}
                onClose={() => setIsNotifDropdownOpen(false)}
                onNavigateToScreen={(screen, params) => {
                  if (screen === 'store' || screen === 'shop') onNavigateToStore?.();
                  else if (screen === 'orders') onNavigateToOrders?.();
                  else if (screen === 'notifications') onNavigateToProfile?.('notifications');
                  else if (screen === 'profile') onNavigateToProfile?.(params?.tab || 'overview');
                  else if (screen === 'garage') onNavigateToGarage?.();
                }}
                currentUser={currentUser}
              />
            </View>

            {/* Cart Button */}
            <TouchableOpacity
              style={wStyles.navActionIconBtn}
              onPress={() => setIsCartOpen(true)}
              activeOpacity={0.85}
              title="Shopping Cart"
            >
              <BootstrapIcon name="cart3" size={17} color="#FFFFFF" />
              {cartItemCount > 0 && (
                <View style={wStyles.navBadgeCircle}>
                  <Text style={wStyles.navBadgeText}>{cartItemCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Admin Badge */}
            {currentUser?.role === 'admin' && (
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: 'transparent',
                  borderWidth: 0,
                  borderColor: 'transparent',
                }}
                onPress={() => onNavigateToAdmin?.()}
                activeOpacity={0.8}
                title="Admin Panel"
              >
                <BootstrapIcon name="shield-lock-fill" size={16} color="#EA580C" />
              </TouchableOpacity>
            )}

            {/* Auth: Sign In & Sign Up OR Logged In Profile */}
            {currentUser ? (
              <View style={[wStyles.loggedInContainer, { position: 'relative' }]}>
                <UserProfileButton
                  currentUser={currentUser}
                  onPress={() => {
                    setIsNotifDropdownOpen(false);
                    setIsUserDropdownOpen(!isUserDropdownOpen);
                  }}
                  size={40}
                />

                <UserProfileDropdown
                  currentUser={currentUser}
                  isOpen={isUserDropdownOpen}
                  currentScreen="wishlist"
                  showDashboard={true}
                  onClose={() => setIsUserDropdownOpen(false)}
                  onNavigateToDashboard={() => onNavigateToProfile?.('overview')}
                  onNavigateToOrders={() => onNavigateToOrders?.()}
                  onNavigateToProfile={(tab = 'profile') => onNavigateToProfile?.(typeof tab === 'string' ? tab : 'profile')}
                  onNavigateToSettings={() => onNavigateToProfile?.('settings')}
                  onNavigateToWishlist={() => onNavigateToWishlist?.()}
                  onNavigateToAdmin={() => onNavigateToAdmin?.()}
                  onLogout={() => {
                    if (onLogout) {
                      onLogout();
                    } else {
                      logout?.();
                      showToast?.('Logged out successfully');
                      onNavigateToStore?.();
                    }
                  }}
                  isDark={isDarkMode}
                  onToggleDarkMode={toggleDarkMode}
                />
              </View>
            ) : (
              <View style={wStyles.authButtonsRow}>
                <TouchableOpacity
                  style={wStyles.signInHeaderBtn}
                  onPress={() => onNavigateToLogin?.()}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon name="person" size={16} color="#FFFFFF" />
                  <Text style={wStyles.signInHeaderBtnText}>Sign In</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* ─── WISHLIST CONTENT ─── */}
      <View style={wStyles.maxContainer}>
          {/* Top Title & Batch Actions Bar */}
          <View style={wStyles.actionBar}>
            <View>
              <Text style={wStyles.pageTitle}>Saved Performance Wishlist</Text>
              <Text style={wStyles.pageSub}>
                {wishlistCount} saved • {aiInstalls.length} AI installs • Parts value: ₱
                {Number(totalWishlistValue || 0).toFixed(2)}
              </Text>
            </View>

            {!isWishlistEmpty && (
              <View style={wStyles.actionBtnsGroup}>
                <TouchableOpacity
                  style={wStyles.clearWishlistBtn}
                  onPress={() => {
                    clearWishlist();
                    showToast('Wishlist cleared.');
                  }}
                  activeOpacity={0.8}
                >
                  <BootstrapIcon name="trash" size={13} color="#DC2626" />
                  <Text style={wStyles.clearWishlistBtnText}>Clear List</Text>
                </TouchableOpacity>

                {wishlistedProducts.length > 0 ? (
                  <TouchableOpacity
                    style={wStyles.moveAllBtn}
                    onPress={handleMoveAllToCart}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon name="cart-check-fill" size={14} color="#FFFFFF" />
                    <Text style={wStyles.moveAllBtnText}>Move All to Cart</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
          </View>

          {/* AI Installation Previews */}
          {aiInstalls.length > 0 ? (
            <View style={{ marginBottom: 28 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '800',
                  color: isDarkMode ? '#E2E8F0' : '#0F172A',
                  marginBottom: 6,
                }}
              >
                AI Installation Previews
              </Text>
              <Text
                style={{
                  fontSize: 12.5,
                  color: isDarkMode ? '#94A3B8' : '#64748B',
                  marginBottom: 14,
                }}
              >
                Saved from Install Studio — book shop installation for these builds.
              </Text>
              <View style={wStyles.productGrid}>
                {aiInstalls.map((entry) => (
                  <View
                    key={entry.id || entry.customizationId}
                    style={[wStyles.productCard, { width: cardWidth }]}
                  >
                    <View style={wStyles.productImgWrap}>
                      {entry.previewImageUrl ? (
                        <Image
                          source={{ uri: entry.previewImageUrl }}
                          style={wStyles.productImg}
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          style={{
                            flex: 1,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#F1F5F9',
                          }}
                        >
                          <BootstrapIcon name="image" size={28} color="#94A3B8" />
                        </View>
                      )}
                      <TouchableOpacity
                        style={wStyles.removeFavBtn}
                        onPress={() => {
                          removeCustomizationFromWishlist(entry.id || entry.customizationId);
                          showToast('Removed AI preview from wishlist.');
                        }}
                        activeOpacity={0.8}
                      >
                        <BootstrapIcon name="heart-fill" size={13} color="#EF4444" />
                      </TouchableOpacity>
                      <View
                        style={{
                          position: 'absolute',
                          left: 8,
                          bottom: 8,
                          backgroundColor: 'rgba(29,69,51,0.92)',
                          borderRadius: 6,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                        }}
                      >
                        <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '800' }}>
                          AI INSTALL
                        </Text>
                      </View>
                    </View>
                    <View style={wStyles.productDetails}>
                      <Text style={wStyles.productName} numberOfLines={2}>
                        {entry.name || entry.title || 'AI Installation Preview'}
                      </Text>
                      <Text
                        style={{ fontSize: 11, color: '#64748B', marginBottom: 8 }}
                        numberOfLines={1}
                      >
                        {(entry.items || []).map((i) => i.name).filter(Boolean).join(', ') ||
                          'Custom part install'}
                      </Text>
                      <TouchableOpacity
                        style={wStyles.addToCartBtn}
                        onPress={() => openInstallBooking(entry)}
                        activeOpacity={0.85}
                      >
                        <BootstrapIcon name="calendar-check" size={13} color="#FFFFFF" />
                        <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>
                          Book Installation
                        </Text>
                      </TouchableOpacity>
                      {(entry.productIds || []).length > 0 ? (
                        <TouchableOpacity
                          style={{
                            marginTop: 8,
                            borderWidth: 1,
                            borderColor: '#EA580C',
                            borderRadius: 8,
                            paddingVertical: 8,
                            alignItems: 'center',
                          }}
                          onPress={() => {
                            const first = prods.find((p) =>
                              (entry.productIds || []).includes(String(p.id))
                            );
                            if (first) handleAddToCartSingle(first);
                            else showToast('Part added via Install Studio wishlist.');
                          }}
                          activeOpacity={0.85}
                        >
                          <Text style={{ color: '#EA580C', fontSize: 12, fontWeight: '700' }}>
                            Add Part to Cart
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Grid or Empty View */}
          {isWishlistEmpty ? (
            <View style={wStyles.emptyBox}>
              <BootstrapIcon name="heart" size={42} color="#94A3B8" />
              <Text style={wStyles.emptyTitle}>Your Wishlist is Empty</Text>
              <Text style={wStyles.emptySub}>
                Save catalog parts with the heart icon, or save AI installation previews from Install
                Studio.
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                <TouchableOpacity
                  style={wStyles.exploreStoreBtn}
                  onPress={() => onNavigateToStore?.()}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon name="cart-plus-fill" size={14} color="#FFFFFF" />
                  <Text style={wStyles.exploreStoreBtnText}>Explore Parts</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[wStyles.exploreStoreBtn, { backgroundColor: '#0F172A' }]}
                  onPress={() => onNavigateToCustomizer?.() || onNavigateToCustomize?.()}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon name="stars" size={14} color="#FFFFFF" />
                  <Text style={wStyles.exploreStoreBtnText}>Open Install Studio</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : wishlistedProducts.length > 0 ? (
            <View style={wStyles.productGrid}>
              {wishlistedProducts.map((product) => (
                <TouchableOpacity
                  key={product.id}
                  style={[wStyles.productCard, { width: cardWidth }]}
                  className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden mb-2 cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
                  onPress={() => {
                    setSelectedProductForSpecs(product);
                    setIsSpecsOpen(true);
                  }}
                  activeOpacity={0.92}
                >
                  {/* 1:1 Square Product Image */}
                  <View
                    style={wStyles.productImgWrap}
                    className="w-full aspect-square bg-slate-100 relative overflow-hidden"
                  >
                    <Image
                      source={{ uri: product.image }}
                      style={wStyles.productImg}
                      resizeMode="cover"
                      className="w-full h-full object-cover"
                    />

                    {/* Wishlist Remove Button */}
                    <TouchableOpacity
                      style={wStyles.removeFavBtn}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/95 items-center justify-center shadow-sm z-10 hover:scale-105 transition-transform"
                      onPress={(e) => {
                        e?.stopPropagation?.();
                        toggleWishlist(product.id);
                      }}
                      activeOpacity={0.8}
                    >
                      <BootstrapIcon name="heart-fill" size={13} color="#EF4444" />
                    </TouchableOpacity>
                  </View>

                  {/* Details - Compact Square Layout */}
                  <View
                    style={wStyles.productDetails}
                    className="p-2.5 bg-white flex flex-col justify-between"
                  >
                    {/* Product Name (2 Lines Max) */}
                    <Text
                      style={wStyles.productName}
                      numberOfLines={2}
                      className="text-[12.5px] font-semibold text-slate-800 leading-[17px] mb-1 h-[34px]"
                    >
                      {product.name}
                    </Text>

                    {/* Price Row: Bold Teal Brand Color (matching app) */}
                    <View style={wStyles.priceRow} className="flex flex-row items-baseline gap-1.5 mb-1.5">
                      <Text
                        style={wStyles.priceMainText}
                        className="text-[15px] font-extrabold text-[#EA580C]"
                      >
                        ₱{Number(product.price || 0).toFixed(2)}
                      </Text>
                    </View>

                    {/* Tags Row: COD, Actual Stock & Rating */}
                    <View
                      style={wStyles.tagsRow}
                      className="flex flex-row items-center gap-1.5 mb-1.5 flex-wrap"
                    >
                      <View style={wStyles.codTag} className="bg-amber-100 px-1.5 py-0.5 rounded">
                        <Text
                          style={wStyles.codTagText}
                          className="text-[10px] font-extrabold text-amber-700"
                        >
                          COD
                        </Text>
                      </View>
                      <View style={wStyles.stockTag} className="bg-emerald-50 px-1.5 py-0.5 rounded">
                        <Text style={wStyles.stockTagText} className="text-[10px] font-bold text-emerald-700">
                          {product.stock <= 0
                            ? 'Sold out'
                            : product.stock <= resolveReorderLevel(product, 5)
                              ? `Only ${product.stock} left`
                              : `${product.stock} in stock`}
                        </Text>
                      </View>
                      {productHasCustomerRatings(product) ? (
                        <View
                          style={[wStyles.ratingLeft, { marginLeft: 'auto' }]}
                          className="flex flex-row items-center gap-1 ml-auto"
                        >
                          <BootstrapIcon name="star-fill" size={10} color="#F59E0B" />
                          <Text
                            style={wStyles.ratingValText}
                            className="text-[11.5px] font-bold text-amber-500"
                          >
                            {Number(product.rating).toFixed(1)}
                          </Text>
                          <Text
                            style={wStyles.reviewCountText}
                            className="text-[10.5px] text-slate-500 font-medium"
                          >
                            ({product.reviews})
                          </Text>
                        </View>
                      ) : (
                        <View
                          style={[wStyles.ratingLeft, { marginLeft: 'auto' }]}
                          className="flex flex-row items-center gap-1 ml-auto"
                        >
                          <BootstrapIcon name="star" size={10} color="#94A3B8" />
                          <Text
                            style={wStyles.reviewCountText}
                            className="text-[10.5px] text-slate-500 font-medium"
                          >
                            No ratings yet
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Add to Cart Button with matching App Solid Teal style */}
                    <TouchableOpacity
                      style={wStyles.addToCartBtn}
                      className="bg-[#EA580C] hover:bg-[#094e46] rounded-lg py-2 flex flex-row items-center justify-center gap-1.5 mt-1.5 transition-colors cursor-pointer"
                      onPress={(e) => {
                        e?.stopPropagation?.();
                        handleAddToCartSingle(product);
                      }}
                      activeOpacity={0.8}
                    >
                      <BootstrapIcon name="cart3" size={13} color="#FFFFFF" />
                      <Text style={wStyles.addToCartBtnText} className="text-xs font-bold text-white">
                        Add to Cart
                      </Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Book Installation from AI wishlist preview */}
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

      {/* Specs Modal */}
      <ProductSpecsModal
        visible={isSpecsOpen}
        product={selectedProductForSpecs}
        onClose={() => setIsSpecsOpen(false)}
        onAddToCart={(prod) => handleAddToCartSingle(prod)}
      />

      <CartModal
        visible={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onProceedToCheckout={() => {
          if (!currentUser) {
            setIsCartOpen(false);
            setRedirectReason('Please sign in to complete your checkout.');
            onNavigateToLogin?.();
            return;
          }
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        }}
      />

      <CheckoutModal
        visible={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        onCompleteOrder={() => {
          setIsCheckoutOpen(false);
          showToast('Order placed successfully!');
          onNavigateToOrders?.();
        }}
        onOpenProfile={() => {
          setIsCheckoutOpen(false);
          onNavigateToProfile?.('profile');
        }}
      />

      {/* Persistent Mobile Bottom Navigation Bar on smaller screens */}
      {windowWidth < 768 && (
        <BottomNavBar
          activeTab="Favorites"
          onTabChange={(tab) => {
            if (tab === 'Home') {
              onNavigateToStore?.();
            } else if (tab === 'Services') {
              onNavigateToGarage?.();
            } else if (tab === 'Customize') {
              if (onNavigateToCustomizer) onNavigateToCustomizer();
              else if (onNavigateToCustomize) onNavigateToCustomize();
              else onNavigateToStore?.();
            } else if (tab === 'Garage') {
              if (!currentUser) {
                setRedirectReason?.('Please sign in to access your motorcycle garage fleet.');
                onNavigateToLogin?.();
              } else {
                onNavigateToProfile?.('garage');
              }
            } else if (tab === 'Orders') {
              onNavigateToOrders?.();
            } else if (tab === 'Wishlist' || tab === 'Favorites') {
              // already on wishlist
            } else if (tab === 'More') {
              if (!currentUser) {
                setRedirectReason('');
                onNavigateToLogin?.();
              } else {
                onNavigateToProfile?.('menu');
              }
            } else if (tab === 'Dashboard') {
              if (!currentUser) {
                setRedirectReason('');
                onNavigateToLogin?.();
              } else {
                onNavigateToProfile?.('overview');
              }
            } else if (tab === 'Bookings') {
              if (!currentUser) {
                setRedirectReason('');
                onNavigateToLogin?.();
              } else {
                onNavigateToProfile?.('bookings');
              }
            } else if (tab === 'Notifications') {
              onNavigateToProfile?.('notifications');
            } else if (tab === 'Admin') {
              if (currentUser?.role === 'admin') {
                onNavigateToAdmin?.();
              }
            } else if (tab === 'Profile') {
              if (!currentUser) {
                setRedirectReason('');
                onNavigateToLogin?.();
              } else {
                onNavigateToProfile?.('profile');
              }
            }
          }}
          wishlistCount={wishlistCount}
          currentUser={currentUser}
        />
      )}

      {/* Live Order Tracking Modal */}
      <LiveOrderTrackingMapModal
        visible={isLiveTrackingOpen}
        order={selectedOrderForTracking}
        onClose={() => setIsLiveTrackingOpen(false)}
        showToast={showToast}
      />
    </View>
  );
}
