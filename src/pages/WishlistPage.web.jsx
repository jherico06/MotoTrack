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
import { BootstrapIcon, ToastNotification, ProductSpecsModal, BottomNavBar } from '../components';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { MOTOR_PARTS } from '../data/motorParts';
import { productService } from '../services/productService';

export default function WishlistPageWeb({
  onNavigateToStore,
  onNavigateToOrders,
  onNavigateToGarage,
  onNavigateToLogin,
  onNavigateToProfile,
  onNavigateToAdmin,
  onAddToCart,
}) {
  const { width: windowWidth } = useWindowDimensions();
  const { currentUser } = useAuth();
  const { addToCart, showToast, toastMessage } = useCart();
  const { wishlist, toggleWishlist, clearWishlist, wishlistCount } = useWishlist();

  const [catalogProducts, setCatalogProducts] = useState(MOTOR_PARTS);
  const [selectedProductForSpecs, setSelectedProductForSpecs] = useState(null);
  const [isSpecsOpen, setIsSpecsOpen] = useState(false);

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
  const cardWidth = `${(100 / numColumns) - 1.5}%`;

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
            <View style={wStyles.logoIconBadge}>
              <BootstrapIcon name="speedometer2" size={20} color="#FFFFFF" />
            </View>
            <Text style={wStyles.logoText}>
              Moto<Text style={{ color: '#0C6258' }}>Track</Text>
              <Text style={{ fontSize: 11, color: '#64748B' }}> WISHLIST</Text>
            </Text>
          </TouchableOpacity>

          <View style={wStyles.headerNavLinks}>
            <TouchableOpacity
              style={wStyles.navLinkBtn}
              onPress={() => onNavigateToStore?.()}
              activeOpacity={0.8}
            >
              <BootstrapIcon name="bag-check" size={14} color="#64748B" />
              <Text style={wStyles.navLinkBtnText}>Storefront</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={wStyles.navLinkBtn}
              onPress={() => onNavigateToOrders?.()}
              activeOpacity={0.8}
            >
              <BootstrapIcon name="receipt" size={14} color="#64748B" />
              <Text style={wStyles.navLinkBtnText}>Orders</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={wStyles.navLinkBtn}
              onPress={() => onNavigateToGarage?.()}
              activeOpacity={0.8}
            >
              <BootstrapIcon name="tools" size={14} color="#64748B" />
              <Text style={wStyles.navLinkBtnText}>Pitstop</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[wStyles.navLinkBtn, { backgroundColor: '#F3F7F6', borderWidth: 1, borderColor: '#D1ECE6', paddingHorizontal: 12, borderRadius: 10 }]}
              onPress={() => onNavigateToAdmin?.()}
              activeOpacity={0.8}
            >
              <BootstrapIcon name="shield-lock-fill" size={13} color="#0C6258" />
              <Text style={[wStyles.navLinkBtnText, { color: '#0C6258', fontWeight: '800' }]}>Admin</Text>
            </TouchableOpacity>

            {currentUser ? (
              <TouchableOpacity
                style={wStyles.userPill}
                onPress={() => onNavigateToProfile?.()}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80' }}
                  style={wStyles.userAvatar}
                />
                <Text style={wStyles.userNameText}>{currentUser.name}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={wStyles.signInBtn}
                onPress={() => onNavigateToLogin?.()}
                activeOpacity={0.85}
              >
                <Text style={wStyles.signInBtnText}>Sign In</Text>
              </TouchableOpacity>
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
                    <Text style={wStyles.productBrand}>{product.brand || 'MotoTrack'}</Text>
                    <Text style={wStyles.productName} numberOfLines={2}>{product.name}</Text>
                    <Text style={wStyles.productCompat} numberOfLines={1}>Fit: {product.compatibility || 'Universal'}</Text>

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
            } else if (tab === 'Garage') {
              onNavigateToGarage?.();
            } else if (tab === 'Favorites') {
              // already on wishlist
            } else if (tab === 'Admin') {
              onNavigateToAdmin?.();
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
    </View>
  );
}

const wStyles = StyleSheet.create({
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
  },
  logoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  },
  headerNavLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  navLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  navLinkBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  userPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 12,
    paddingVertical: 4,
    paddingLeft: 4,
    borderRadius: 20,
    backgroundColor: '#F3F7F6',
    borderWidth: 1,
    borderColor: '#D1ECE6',
  },
  userAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  userNameText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#042F2E',
  },
  signInBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#0F172A',
  },
  signInBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
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
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    flexWrap: 'wrap',
    gap: 16,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
  },
  pageSub: {
    fontSize: 13.5,
    color: '#64748B',
    marginTop: 2,
  },
  actionBtnsGroup: {
    flexDirection: 'row',
    gap: 10,
  },
  clearWishlistBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
  },
  clearWishlistBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#DC2626',
  },
  moveAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: '#0C6258',
  },
  moveAllBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  emptyBox: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 14,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    maxWidth: 400,
    textAlign: 'center',
    marginBottom: 20,
  },
  exploreStoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0C6258',
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 14,
  },
  exploreStoreBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  productImgWrap: {
    width: '100%',
    height: 180,
    backgroundColor: '#F1F5F9',
    position: 'relative',
  },
  productImg: {
    width: '100%',
    height: '100%',
  },
  removeFavBtn: {
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
  productBrand: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  productName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 18,
    marginVertical: 4,
    minHeight: 36,
  },
  productCompat: {
    fontSize: 11.5,
    color: '#64748B',
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addToBagBtn: {
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
  addToBagBtnText: {
    color: '#0C6258',
    fontSize: 12.5,
    fontWeight: '800',
  },
  inspectBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
