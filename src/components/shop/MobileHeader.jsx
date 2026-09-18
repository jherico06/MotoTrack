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
  isProfileDropdownOpen = false,
  onNavigateToLogin,
  onNavigateToNotifications,
  onNavigateToWishlist,
  onNavigateToAdmin,
  showSearch = true,
  searchPlaceholder = 'Search parts, gear, accessories...',
}) {
  const { currentUser } = useAuth();
  const { cartItemCount } = useCart();
  const { wishlistCount } = useWishlist();
  const [unreadNotifCount, setUnreadNotifCount] = useState(() =>
    notificationService.getUnreadCount(currentUser?.id)
  );

  useEffect(() => {
    const unsub = notificationService.subscribe(() => {
      setUnreadNotifCount(notificationService.getUnreadCount(currentUser?.id));
    });
    return () => unsub?.();
  }, [currentUser?.id]);

  return (
    <>
      <View style={styles.headerWrapper}>
        <View style={styles.headerRow}>
          {/* Left: User Avatar & Greeting or Sign In */}
          {currentUser ? (
            <TouchableOpacity style={styles.headerLeft} onPress={onOpenProfile} activeOpacity={0.75}>
              <View style={[styles.avatarWrap, isProfileDropdownOpen && { borderColor: '#0F172A' }]}>
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
                  {currentUser.role === 'admin' ? 'Administrator' : 'Welcome back,'}
                </Text>
                <View style={styles.greetingNameRow}>
                  <Text style={styles.userName}>{currentUser.name || currentUser.fullName}</Text>
                  <BootstrapIcon
                    name={isProfileDropdownOpen ? 'chevron-up' : 'chevron-down'}
                    size={10}
                    color="#64748B"
                    style={{ marginLeft: 3 }}
                  />
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
              onPress={onNavigateToLogin}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.avatarWrap,
                  { justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9' },
                ]}
              >
                <BootstrapIcon name="person" size={17} color="#0F172A" />
              </View>
              <View>
                <Text style={styles.greetingSub}>Welcome</Text>
                <Text style={[styles.userName, { color: '#0F172A', fontSize: 13.5 }]}>
                  Sign In / Register ➔
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Right: Notifications, Wishlist & Cart Bag (Minimalist Line Icons with Brand Colors) */}
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={onNavigateToNotifications}
              title="Notifications"
              activeOpacity={0.75}
            >
              <BootstrapIcon name="bell" size={17} color="#0C6258" />
              {unreadNotifCount > 0 && (
                <View style={[styles.cartBadgeDot, { backgroundColor: '#EF4444' }]}>
                  <Text style={styles.cartBadgeDotText}>
                    {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={onNavigateToWishlist}
              title="Saved Favorites"
              activeOpacity={0.75}
            >
              <BootstrapIcon name="heart" size={17} color="#EF4444" />
              {wishlistCount > 0 && (
                <View style={[styles.cartBadgeDot, { backgroundColor: '#EF4444' }]}>
                  <Text style={styles.cartBadgeDotText}>{wishlistCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={onOpenCart}
              title="Shopping Cart"
              activeOpacity={0.75}
            >
              <BootstrapIcon name="cart3" size={18} color="#0C6258" />
              {cartItemCount > 0 && (
                <View style={[styles.cartBadgeDot, { backgroundColor: '#0C6258' }]}>
                  <Text style={styles.cartBadgeDotText}>{cartItemCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Mobile Minimalist Search & Filter Bar */}
      {showSearch && (
        <View style={styles.searchSection}>
          <View style={styles.searchBarPill}>
            <BootstrapIcon name="search" size={15} color="#94A3B8" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder={searchPlaceholder}
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={onSearchChange}
            />
            {onCycleFilterSort && (
              <TouchableOpacity
                style={styles.filterBtnInside}
                onPress={onCycleFilterSort}
                activeOpacity={0.7}
              >
                <BootstrapIcon name="sliders" size={15} color="#64748B" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </>
  );
}
