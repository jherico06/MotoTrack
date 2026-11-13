import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  BootstrapIcon,
  ToastNotification,
  UserProfileDropdown,
  UserProfileButton,
  BrandLogo,
  HeaderSearchWidget,
  NotificationDropdown,
  CustomerMobileNavDrawer,
} from '../../../components/common';
import { LiveOrderTrackingMapModal, ProductSpecsModal, CheckoutModal } from '../../../components/modals';
import CartPage from './CartPage.jsx';
import { createWishlistWebStyles } from '../../../styles/web/wishlistPage.web.styles.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useCart } from '../../../context/CartContext.jsx';
import { useWishlist } from '../../../context/WishlistContext.jsx';
import { useTheme } from '../../../context/ThemeContext.jsx';
import { resolveReorderLevel } from '../../../utils/inventoryHelpers.js';
import { notificationService } from '../../../services/notifications/notificationService.js';
import { productService } from '../../../services/products/productService.js';
import { productHasCustomerRatings } from '../../../utils/productCatalog.js';

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
  onNavigateToAppointments,
}) {
  const { width: windowWidth } = useWindowDimensions();
  const isTablet = windowWidth >= 768 && windowWidth < 1024;
  const { currentUser, logout, setRedirectReason } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const wStyles = useMemo(() => createWishlistWebStyles(isDarkMode), [isDarkMode]);
  const { addToCart, showToast, toastMessage, cartItemCount } = useCart();
  const {
    wishlist,
    toggleWishlist,
  } = useWishlist();

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const [unreadNotifCount, setUnreadNotifCount] = useState(() =>
    currentUser ? notificationService.getUnreadCount(currentUser) : 0
  );
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

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
  const productWishlistCount = wishlistedProducts.length;
  const totalWishlistValue = wishlistedProducts.reduce((sum, p) => sum + Number(p.price || 0), 0);
  const isWishlistEmpty = productWishlistCount === 0;

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

  const handleClearWishlist = () => {
    if (wishlistedProducts.length === 0) return;
    wishlistedProducts.forEach((product) => {
      toggleWishlist(product.id);
    });
    showToast('Saved catalog parts cleared.');
  };

  const pageSubtitle = useMemo(
    () =>
      `${productWishlistCount} saved catalog product${productWishlistCount === 1 ? '' : 's'} • Parts value: ₱${Number(totalWishlistValue || 0).toFixed(2)}`,
    [productWishlistCount, totalWishlistValue]
  );

  // Balanced grid columns: 1 column on <360px, 2 on mobile, 3 on tablet, 4 on desktop, 5 on wide
  const numColumns = windowWidth >= 1250 ? 5 : windowWidth >= 980 ? 4 : windowWidth >= 680 ? 3 : windowWidth < 360 ? 1 : 2;
  const gapSize = windowWidth < 480 ? 8 : windowWidth < 768 ? 10 : 14;
  const cardWidth = `calc(${100 / numColumns}% - ${((numColumns - 1) * gapSize) / numColumns}px)`;

  return (
    <View
      style={[
        wStyles.container,
        isDarkMode && { backgroundColor: '#121518' },
        Platform.OS === 'web' && { height: '100vh', maxHeight: '100vh', overflow: 'hidden' },
      ]}
      className={isDarkMode ? 'dark bg-[#11151A] min-h-screen' : 'bg-[#F3F4F6] min-h-screen'}
    >
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <ToastNotification message={toastMessage} />

      {/* ─── FULL-HEIGHT WISHLIST SCROLLVIEW (Scrollbar extends to top: 0 through header, matching ShopPage) ─── */}
      <ScrollView
        style={{
          flex: 1,
          width: '100%',
          ...(Platform.OS === 'web'
            ? { overflowY: 'scroll', overscrollBehavior: 'none', overscrollBehaviorY: 'none' }
            : {}),
        }}
        contentContainerStyle={wStyles.scrollContent}
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={true}
        scrollEventThrottle={16}
      >
        {/* ─── RESPONSIVE TOP STICKY NAVBAR ─── */}
        <View
          style={wStyles.headerWrapper}
          className="web-header"
          dataSet={{ webHeader: true }}
          accessibilityRole="header">
        <View
          style={[
            wStyles.headerInner,
            isTablet && { paddingHorizontal: 18, paddingVertical: 10, minHeight: 60, gap: 12 },
            windowWidth < 768 && { paddingHorizontal: 12, paddingVertical: 10, gap: 8, minHeight: 56 },
            windowWidth < 400 && { paddingHorizontal: 8, paddingVertical: 8, gap: 4 },
          ]}
        >
          {/* Left: Mobile Nav Toggle + Logo */}
          <View
            style={[
              wStyles.headerLeft,
              windowWidth < 768 && { gap: 8 },
              windowWidth < 400 && { gap: 4 },
            ]}
          >
            {windowWidth < 768 && (
              <TouchableOpacity
                style={wStyles.mobileNavToggleBtn}
                onPress={() => setIsMobileNavOpen(true)}
                activeOpacity={0.8}
                accessibilityLabel="Open Navigation Menu"
              >
                <BootstrapIcon name="list" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            )}
            {windowWidth >= 768 && (
              <TouchableOpacity
                style={[wStyles.logoWrap, isTablet && { marginRight: 4 }]}
                onPress={() => onNavigateToStore?.()}
                activeOpacity={0.8}
              >
                <BrandLogo size={windowWidth < 768 ? 28 : isTablet ? 30 : windowWidth < 1024 ? 32 : 42} textColor="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>

          {/* Center Navigation: Store & Repair (Desktop / Tablet only) */}
          {windowWidth >= 768 && (
            <View style={[wStyles.headerCenterNav, isTablet && { gap: 8 }]}>
              {/* Shop Button */}
              <TouchableOpacity
                className="main-nav-tab"
                style={[wStyles.headerCenterBtn, isTablet && { height: 34, paddingHorizontal: 10 }]}
                onPress={() => onNavigateToStore?.()}
                activeOpacity={0.8}
                title="Shop"
              >
                <Text style={[wStyles.headerCenterBtnText, isTablet && { fontSize: 13 }]}>Shop</Text>
              </TouchableOpacity>

              {/* Repair Button */}
              <TouchableOpacity
                className="main-nav-tab"
                style={[wStyles.headerCenterBtn, isTablet && { height: 34, paddingHorizontal: 9 }]}
                onPress={() => onNavigateToGarage?.()}
                activeOpacity={0.8}
                title="Book a Service"
              >
                <Text style={[wStyles.headerCenterBtnText, isTablet && { fontSize: 13 }]}>
                  {isTablet ? 'Book Service' : 'Book a Service'}
                </Text>
              </TouchableOpacity>



              {/* Customize Button */}
              <TouchableOpacity
                className="main-nav-tab"
                style={[wStyles.headerCenterBtn, isTablet && { height: 34, paddingHorizontal: 9 }]}
                onPress={() => {
                  if (onNavigateToCustomizer) onNavigateToCustomizer();
                  else if (onNavigateToCustomize) onNavigateToCustomize();
                }}
                activeOpacity={0.8}
                title="Customize"
              >
                <Text style={[wStyles.headerCenterBtnText, isTablet && { fontSize: 13 }]}>Customize</Text>
              </TouchableOpacity>

              {/* Garage Button */}
              <TouchableOpacity
                className="main-nav-tab"
                style={[wStyles.headerCenterBtn, isTablet && { height: 34, paddingHorizontal: 9 }]}
                onPress={() => onNavigateToProfile?.('garage')}
                activeOpacity={0.8}
                title="Garage"
              >
                <Text style={[wStyles.headerCenterBtnText, isTablet && { fontSize: 13 }]}>Garage</Text>
              </TouchableOpacity>

              {/* Orders Button */}
              <TouchableOpacity
                className="main-nav-tab"
                style={[wStyles.headerCenterBtn, isTablet && { height: 34, paddingHorizontal: 9 }]}
                onPress={() => onNavigateToOrders?.()}
                activeOpacity={0.8}
                title="Orders"
              >
                <Text style={[wStyles.headerCenterBtnText, isTablet && { fontSize: 13 }]}>Orders</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Right Header Actions */}
          <View
            style={[
              wStyles.headerActions,
              windowWidth < 768 && { gap: 6 },
              windowWidth < 400 && { gap: 4 },
            ]}
          >
            {/* Search Bar / Icon (Smooth appearance, placed before Wishlist) */}
            <HeaderSearchWidget
              onSearch={(query) => onNavigateToStore?.({ search: query })}
              isDark={isDarkMode}
            />

            {/* Saved Wishlist Button */}
            {windowWidth >= 768 && (<TouchableOpacity
              style={wStyles.navActionIconBtn}
              onPress={() => onNavigateToWishlist?.()}
              activeOpacity={0.8}
              title="Saved Wishlist"
            >
              <BootstrapIcon name="bookmark" size={16} color="#FFFFFF" />
              {productWishlistCount > 0 && (
                <View style={wStyles.navBadgeCircle}>
                  <Text style={wStyles.navBadgeText}>{productWishlistCount}</Text>
                </View>
              )}
            </TouchableOpacity>)}

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
                  else if (screen === 'profile') onNavigateToProfile?.(params?.tab || 'garage');
                  else if (screen === 'garage') onNavigateToGarage?.();
                }}
                currentUser={currentUser}
              />
            </View>

            {/* Cart Button */}
            {windowWidth >= 768 && (<TouchableOpacity
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
            </TouchableOpacity>)}

            {/* Auth: Sign In & Sign Up OR Logged In Profile */}
            {currentUser && windowWidth >= 768 ? (
              <View style={[wStyles.loggedInContainer, { position: 'relative' }]}>
                <UserProfileButton
                  currentUser={currentUser}
                  onPress={() => {
                    setIsNotifDropdownOpen(false);
                    setIsUserDropdownOpen(!isUserDropdownOpen);
                  }}
                  size={windowWidth < 400 ? 34 : 40}
                />

                <UserProfileDropdown
                  currentUser={currentUser}
                  isOpen={isUserDropdownOpen}
                  currentScreen="wishlist"
                  showDashboard={false}
                  onClose={() => setIsUserDropdownOpen(false)}
                  onNavigateToDashboard={() => onNavigateToProfile?.('garage')}
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
                  style={[
                    wStyles.signInHeaderBtn,
                    windowWidth < 640 && { paddingHorizontal: 10, paddingVertical: 6, gap: 4 },
                    windowWidth < 400 && { paddingHorizontal: 8, paddingVertical: 5 },
                    windowWidth < 360 && { width: 34, height: 34, paddingHorizontal: 0, paddingVertical: 0, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
                  ]}
                  onPress={() => onNavigateToLogin?.()}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon name="person" size={16} color="#FFFFFF" />
                  {windowWidth >= 360 && (
                    <Text style={[wStyles.signInHeaderBtnText, windowWidth < 400 && { fontSize: 12 }]}>Sign In</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* ─── WISHLIST CONTENT ─── */}
      <View style={[wStyles.maxContainer, windowWidth < 480 && { paddingHorizontal: 12, paddingTop: 12 }, windowWidth >= 480 && windowWidth < 768 && { paddingHorizontal: 16, paddingTop: 16 }]}>
          {/* Top Title & Batch Actions Bar */}
          <View style={wStyles.actionBar}>
            <View>
              <Text style={wStyles.pageTitle}>Saved Performance Wishlist</Text>
              <Text style={wStyles.pageSub}>{pageSubtitle}</Text>
            </View>

            {!isWishlistEmpty && (
              <View style={wStyles.actionBtnsGroup}>
                <TouchableOpacity
                  style={wStyles.clearWishlistBtn}
                  onPress={handleClearWishlist}
                  activeOpacity={0.8}
                >
                  <BootstrapIcon name="trash" size={13} color="#DC2626" />
                  <Text style={wStyles.clearWishlistBtnText}>Clear List</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={wStyles.moveAllBtn}
                  onPress={handleMoveAllToCart}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon name="cart-check-fill" size={14} color="#FFFFFF" />
                  <Text style={wStyles.moveAllBtnText}>Move All to Cart</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Empty State */}
          {isWishlistEmpty && (
            <View style={wStyles.emptyBox}>
              <View style={wStyles.emptyIconCircle}>
                <BootstrapIcon name="box-seam" size={32} color="#EA580C" />
              </View>
              <Text style={wStyles.emptyTitle}>No Saved Products Yet</Text>
              <Text style={wStyles.emptySub}>
                Browse our catalog of motorcycle parts and accessories and click the save bookmark icon to add items here.
              </Text>
              <TouchableOpacity
                style={wStyles.exploreStoreBtn}
                onPress={() => onNavigateToStore?.()}
                activeOpacity={0.85}
              >
                <BootstrapIcon name="cart-plus-fill" size={14} color="#FFFFFF" />
                <Text style={wStyles.exploreStoreBtnText}>Explore Shop Catalog</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Saved Products */}
          {wishlistedProducts.length > 0 ? (
            <View style={{ marginBottom: 28 }}>
              <View style={[wStyles.productGrid, { gap: gapSize }]}>
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
                        title="Remove from saved"
                      >
                        <BootstrapIcon name="bookmark-fill" size={13} color="#EA580C" />
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

                      {/* Price Row */}
                      <View style={wStyles.priceRow} className="flex flex-row items-baseline gap-1.5 mb-1.5">
                        <Text
                          style={wStyles.priceMainText}
                          className="text-[15px] font-semibold text-[#EA580C]"
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
                            className="text-[10px] font-semibold text-amber-700"
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

                      {/* Add to Cart Button */}
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
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Specs Modal */}
      <ProductSpecsModal
        visible={isSpecsOpen}
        product={selectedProductForSpecs}
        onClose={() => setIsSpecsOpen(false)}
        onAddToCart={(prod) => handleAddToCartSingle(prod)}
      />

      <CartPage
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
        onNavigateToStore={onNavigateToStore}
        onNavigateToGarage={onNavigateToGarage}
        onNavigateToCustomizer={onNavigateToCustomizer || onNavigateToCustomize}
        onNavigateToWishlist={onNavigateToWishlist}
        onNavigateToOrders={onNavigateToOrders}
        onNavigateToProfile={onNavigateToProfile}
        onNavigateToLogin={onNavigateToLogin}
        onNavigateToAdmin={onNavigateToAdmin}
        onLogout={onLogout}
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

      {/* Live Order Tracking Modal */}
      <LiveOrderTrackingMapModal
        visible={isLiveTrackingOpen}
        order={selectedOrderForTracking}
        onClose={() => setIsLiveTrackingOpen(false)}
        showToast={showToast}
      />
      {/* Mobile Customer Navigation Drawer */}
      <CustomerMobileNavDrawer
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
        currentScreen="wishlist"
        onNavigateToScreen={(screen, params) => {
          if (screen === 'shop') onNavigateToStore?.();
          else if (screen === 'garage') onNavigateToGarage?.();
          else if (screen === 'appointments') {
            if (onNavigateToAppointments) onNavigateToAppointments();
            else onNavigateToGarage?.({ tab: 'appointments' });
          }
          else if (screen === 'customizer') {
            if (onNavigateToCustomizer) onNavigateToCustomizer();
            else onNavigateToCustomize?.();
          }
          else if (screen === 'wishlist') { /* already here */ }
          else if (screen === 'profile') onNavigateToProfile?.(params?.tab || 'garage');
          else if (screen === 'login') onNavigateToLogin?.();
          else if (screen === 'admin') onNavigateToAdmin?.();
        }}
        unreadNotifCount={unreadNotifCount}
      />
    </View>
  );
}
