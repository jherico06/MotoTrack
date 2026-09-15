import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BootstrapIcon, ToastNotification, BottomNavBar, UserProfileDropdown, UserProfileButton, BrandLogo, NotificationDropdown } from '../components/common';
import { LiveOrderTrackingMapModal, ProductSpecsModal } from '../components/modals';
import { wishlistWebStyles as wStyles } from '../styles/web/wishlistPage.web.styles';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { notificationService } from '../services/notificationService';
import { MOTOR_PARTS } from '../data/motorParts';
import { productService } from '../services/productService';
import { orderService } from '../services/orderService';

export default function WishlistPageWeb({
  onNavigateToStore,
  onNavigateToOrders,
  onNavigateToGarage,
  onNavigateToCustomizer,
  onNavigateToCustomize,
  onNavigateToLogin,
  onNavigateToProfile,
  onNavigateToAdmin,
  onAddToCart,
  onLogout,
}) {
  const { width: windowWidth } = useWindowDimensions();
  const { currentUser, logout, setRedirectReason } = useAuth();
  const { addToCart, showToast, toastMessage, cartItemCount } = useCart();
  const { wishlist, toggleWishlist, clearWishlist, wishlistCount } = useWishlist();

  const [unreadNotifCount, setUnreadNotifCount] = useState(() => notificationService.getUnreadCount(currentUser?.id));
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);

  useEffect(() => {
    const unsub = notificationService.subscribe(() => {
      setUnreadNotifCount(notificationService.getUnreadCount(currentUser?.id));
    });
    return () => unsub?.();
  }, [currentUser]);

  const [catalogProducts, setCatalogProducts] = useState(MOTOR_PARTS);
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

  const prods = Array.isArray(catalogProducts) ? catalogProducts : MOTOR_PARTS;
  const wishlistedProducts = prods.filter((p) => wishlist[p.id]);
  const totalWishlistValue = wishlistedProducts.reduce((sum, p) => sum + (p.price || 0), 0);

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

  const numColumns = windowWidth >= 1200 ? 4 : windowWidth >= 800 ? 3 : 2;
  const gapSize = 16;
  const cardWidth = `calc(${100 / numColumns}% - ${((numColumns - 1) * gapSize) / numColumns}px)`;

  return (
    <View style={wStyles.container}>
      <StatusBar style="dark" />
      <ToastNotification message={toastMessage} />

      {/* ─── DESKTOP TOP STICKY NAVBAR ─── */}
      <View style={wStyles.headerWrapper}>
        <View style={wStyles.headerInner}>
          <TouchableOpacity
            style={wStyles.logoWrap}
            onPress={() => onNavigateToStore?.()}
            activeOpacity={0.8}
          >
            <BrandLogo size={40} textColor="#FFFFFF" />
          </TouchableOpacity>

          {/* Center Navigation: Store & Repair */}
          <View style={wStyles.headerCenterNav}>
            {/* Store Button */}
            <TouchableOpacity
              style={wStyles.headerCenterBtn}
              onPress={() => onNavigateToStore?.()}
              activeOpacity={0.85}
              title="Store"
            >
              <BootstrapIcon name="shop" size={16} color="#FFFFFF" />
              <Text style={wStyles.headerCenterBtnText}>Store</Text>
            </TouchableOpacity>

            {/* Repair Button */}
            <TouchableOpacity
              style={wStyles.headerCenterBtn}
              onPress={() => onNavigateToGarage?.()}
              activeOpacity={0.8}
              title="Book a Service"
            >
              <BootstrapIcon name="tools" size={16} color="#FFFFFF" />
              <Text style={wStyles.headerCenterBtnText}>Book a Service</Text>
            </TouchableOpacity>

            {/* Customize Button */}
            <TouchableOpacity
              style={wStyles.headerCenterBtn}
              onPress={() => {
                if (onNavigateToCustomizer) onNavigateToCustomizer();
                else if (onNavigateToCustomize) onNavigateToCustomize();
              }}
              activeOpacity={0.8}
              title="Customize"
            >
              <BootstrapIcon name="magic" size={16} color="#FFFFFF" />
              <Text style={wStyles.headerCenterBtnText}>Customize</Text>
            </TouchableOpacity>
          </View>

          {/* Right Header Actions */}
          <View style={wStyles.headerActions}>
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
                onNavigateToScreen={(screen) => {
                  if (screen === 'store') onNavigateToStore?.();
                  else if (screen === 'orders') onNavigateToOrders?.();
                }}
                currentUser={currentUser}
              />
            </View>

            {/* Cart Button */}
            <TouchableOpacity
              style={wStyles.navActionIconBtn}
              onPress={() => onNavigateToStore?.()}
              activeOpacity={0.85}
              title="Shopping Cart"
            >
              <BootstrapIcon name="bag" size={16} color="#FFFFFF" />
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
                  backgroundColor: 'rgba(12, 98, 88, 0.4)',
                  borderWidth: 1,
                  borderColor: '#0C6258',
                }}
                onPress={() => onNavigateToAdmin?.()}
                activeOpacity={0.8}
                title="Admin Panel"
              >
                <BootstrapIcon name="shield-lock-fill" size={16} color="#56B9A1" />
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
                  onClose={() => setIsUserDropdownOpen(false)}
                  onNavigateToDashboard={() => onNavigateToProfile?.('overview')}
                  onNavigateToOrders={() => onNavigateToOrders?.()}
                  onNavigateToProfile={() => onNavigateToProfile?.('profile')}
                  onNavigateToSettings={() => onNavigateToProfile?.('settings')}
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
      <ScrollView contentContainerStyle={wStyles.scrollContent} showsVerticalScrollIndicator={true}>
        <View style={wStyles.maxContainer}>
          {/* Top Title & Batch Actions Bar */}
          <View style={wStyles.actionBar}>
            <View>
              <Text style={wStyles.pageTitle}>Saved Performance Wishlist</Text>
              <Text style={wStyles.pageSub}>
                {wishlistedProducts.length} items saved • Total Value: ₱{totalWishlistValue.toFixed(2)}
              </Text>
            </View>

            {wishlistedProducts.length > 0 && (
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

                <TouchableOpacity
                  style={wStyles.moveAllBtn}
                  onPress={handleMoveAllToCart}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon name="bag-check-fill" size={14} color="#FFFFFF" />
                  <Text style={wStyles.moveAllBtnText}>Move All to Bag</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Grid or Empty View */}
          {wishlistedProducts.length === 0 ? (
            <View style={wStyles.emptyBox}>
              <BootstrapIcon name="heart" size={42} color="#94A3B8" />
              <Text style={wStyles.emptyTitle}>Your Wishlist is Empty</Text>
              <Text style={wStyles.emptySub}>
                Browse our high-performance racing parts catalog and tap the heart icon to save items.
              </Text>
              <TouchableOpacity
                style={wStyles.exploreStoreBtn}
                onPress={() => onNavigateToStore?.()}
                activeOpacity={0.85}
              >
                <BootstrapIcon name="bag-plus-fill" size={14} color="#FFFFFF" />
                <Text style={wStyles.exploreStoreBtnText}>Explore Performance Gear</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={wStyles.productGrid}>
              {wishlistedProducts.map((product) => (
                <View key={product.id} style={[wStyles.productCard, { width: cardWidth }]}>
                  <TouchableOpacity
                    style={wStyles.productImgWrap}
                    onPress={() => {
                      setSelectedProductForSpecs(product);
                      setIsSpecsOpen(true);
                    }}
                    activeOpacity={0.9}
                  >
                    <Image source={{ uri: product.image }} style={wStyles.productImg} resizeMode="cover" />

                    <TouchableOpacity
                      style={wStyles.removeFavBtn}
                      onPress={() => toggleWishlist(product.id)}
                      activeOpacity={0.8}
                    >
                      <BootstrapIcon name="heart-fill" size={14} color="#EF4444" />
                    </TouchableOpacity>

                    <View style={wStyles.pricePill}>
                      <Text style={wStyles.pricePillText}>₱{product.price?.toFixed(2)}</Text>
                    </View>
                  </TouchableOpacity>

                  <View style={wStyles.productDetails}>
                    <Text style={wStyles.productBrand}>{product.brand || 'D,Blockchain'}</Text>
                    <Text style={wStyles.productName} numberOfLines={2}>
                      {product.name}
                    </Text>
                    <Text style={wStyles.productCompat} numberOfLines={1}>
                      Fit: {product.compatibility || 'Universal'}
                    </Text>

                    <View style={wStyles.actionRow}>
                      <TouchableOpacity
                        style={wStyles.addToBagBtn}
                        onPress={() => handleAddToCartSingle(product)}
                        activeOpacity={0.85}
                      >
                        <BootstrapIcon name="bag-plus-fill" size={13} color="#0C6258" />
                        <Text style={wStyles.addToBagBtnText}>Add to Bag</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={wStyles.inspectBtn}
                        onPress={() => {
                          setSelectedProductForSpecs(product);
                          setIsSpecsOpen(true);
                        }}
                        activeOpacity={0.85}
                      >
                        <BootstrapIcon name="eye" size={14} color="#64748B" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Specs Modal */}
      <ProductSpecsModal
        visible={isSpecsOpen}
        product={selectedProductForSpecs}
        onClose={() => setIsSpecsOpen(false)}
        onAddToCart={(prod) => handleAddToCartSingle(prod)}
      />

      {/* Persistent Mobile Bottom Navigation Bar on smaller screens */}
      {windowWidth < 768 && (
        <BottomNavBar
          activeTab="Favorites"
          onTabChange={(tab) => {
            if (tab === 'Home') {
              onNavigateToStore?.();
            } else if (tab === 'Customize') {
              if (onNavigateToCustomizer) onNavigateToCustomizer();
              else if (onNavigateToCustomize) onNavigateToCustomize();
              else onNavigateToStore?.();
            } else if (tab === 'Garage') {
              onNavigateToGarage?.();
            } else if (tab === 'Orders') {
              onNavigateToOrders?.();
            } else if (tab === 'Favorites') {
              // already on wishlist
            } else if (tab === 'Admin') {
              if (currentUser?.role === 'admin') {
                onNavigateToAdmin?.();
              }
            } else if (tab === 'Profile') {
              if (!currentUser) {
                setRedirectReason('');
                onNavigateToLogin?.();
              } else {
                onNavigateToProfile?.();
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
