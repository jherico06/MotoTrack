import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image } from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon';
import { shopStyles as styles } from '../../styles/shop.styles';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { notificationService } from '../../services/notificationService';

export default function MobileHeader({
  searchQuery,
  onSearchChange,
  filterSort,
  onCycleFilterSort,
  onOpenCart,
  onOpenProfile,
  onNavigateToLogin,
  onNavigateToNotifications,
  onNavigateToWishlist,
  onNavigateToAdmin,
}) {
  const { currentUser } = useAuth();
  const { cartItemCount } = useCart();
  const { wishlistCount } = useWishlist();
  const [unreadNotifCount, setUnreadNotifCount] = useState(() => notificationService.getUnreadCount(currentUser?.id));

  useEffect(() => {
    const unsub = notificationService.subscribe(() => {
      setUnreadNotifCount(notificationService.getUnreadCount(currentUser?.id));
    });
    return () => unsub?.();
  }, []);

  return (
    <>
      <View style={styles.headerWrapper}>
        <View style={styles.headerRow}>
          {/* Left: User Avatar & Greeting or Sign In */}
          {currentUser ? (
            <TouchableOpacity style={styles.headerLeft} onPress={onOpenProfile} activeOpacity={0.8}>
              <View style={styles.avatarWrap}>
                <Image
                  source={{
                    uri:
                      currentUser.avatar ||
                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
                  }}
                  style={styles.avatarImg}
                />
              </View>
              <View style={styles.userGreetingWrap}>
                <Text style={styles.greetingSub}>
                  {currentUser.role === 'admin' ? 'Store Admin' : 'Welcome Back'}
                </Text>
                <View style={styles.greetingNameRow}>
                  <Text style={styles.userName}>{currentUser.name || currentUser.fullName}</Text>
                  {currentUser.role === 'admin' && (
                    <BootstrapIcon
                      name="shield-lock-fill"
                      size={12}
                      color="#0C6258"
                      style={{ marginLeft: 4 }}
                    />
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              onPress={onNavigateToLogin}
            >
              <View
                style={[
                  styles.avatarWrap,
                  { justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F7F6' },
                ]}
              >
                <BootstrapIcon name="person-fill" size={18} color="#0C6258" />
              </View>
              <View>
                <Text style={styles.greetingSub}>Guest Visitor</Text>
                <Text style={[styles.userName, { color: '#0C6258', fontSize: 14 }]}>
                  Sign In / Register ➔
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Right: Notifications, Wishlist & Cart Bag */}
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={onNavigateToNotifications}
              title="Notifications"
              activeOpacity={0.8}
            >
              <BootstrapIcon name="bell-fill" size={15} color="#0C6258" />
              {unreadNotifCount > 0 && (
                <View style={[styles.cartBadgeDot, { backgroundColor: '#E11D48' }]}>
                  <Text style={styles.cartBadgeDotText}>{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={onNavigateToWishlist}
              title="Saved Favorites"
              activeOpacity={0.8}
            >
              <BootstrapIcon name="heart" size={16} color="#ef4444" />
              {wishlistCount > 0 && (
                <View style={styles.cartBadgeDot}>
                  <Text style={styles.cartBadgeDotText}>{wishlistCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={onOpenCart}
              title="Shopping Bag"
              activeOpacity={0.8}
            >
              <BootstrapIcon name="bag-fill" size={16} color="#0f172a" />
              {cartItemCount > 0 && (
                <View style={styles.cartBadgeDot}>
                  <Text style={styles.cartBadgeDotText}>{cartItemCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Mobile Search & Filter Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBarPill}>
          <BootstrapIcon name="search" size={14} color="#94A3B8" style={{ marginRight: 6 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search Product"
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={onSearchChange}
          />
          <TouchableOpacity style={styles.filterBtnInside} onPress={onCycleFilterSort}>
            <BootstrapIcon name="sliders" size={14} color="#64748b" />
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}
