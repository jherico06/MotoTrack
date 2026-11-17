import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, useWindowDimensions } from 'react-native';
import BootstrapIcon from '../../common/BootstrapIcon.jsx';
import { shopStyles as styles } from '../../../styles/shop.styles.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useCart } from '../../../context/CartContext.jsx';
import { useWishlist } from '../../../context/WishlistContext.jsx';
import { useTheme } from '../../../context/ThemeContext.jsx';
import { notificationService } from '../../../services/notifications/notificationService.js';

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
  showSearch = true,
  searchPlaceholder = 'Search parts, gear, accessories...',
}) {
  const { width } = useWindowDimensions();
  const isSmallMobile = width < 380;
  const { currentUser } = useAuth();
  const { cartItemCount } = useCart();
  const { wishlistCount } = useWishlist();
  const { isDarkMode = false } = useTheme?.() || {};
  const [unreadNotifCount, setUnreadNotifCount] = useState(() =>
    currentUser?.id ? notificationService.getUnreadCount(currentUser?.id) : 0
  );

  useEffect(() => {
    const unsub = notificationService.subscribe(() => {
      setUnreadNotifCount(
        currentUser?.id ? notificationService.getUnreadCount(currentUser?.id) : 0
      );
    });
    return () => unsub?.();
  }, [currentUser?.id]);

  const headerBg = isDarkMode ? '#24272B' : '#F7F5F0';
  const headerBorder = isDarkMode ? '#1A1D20' : '#EDE9E0';
  const primaryTextColor = isDarkMode ? '#FFFFFF' : '#0F172A';
  const subTextColor = isDarkMode ? '#94A3B8' : '#64748B';
  const iconColor = isDarkMode ? '#FFFFFF' : '#0F172A';

  return (
    <View
      style={[
        styles.mobileHeaderRoot,
        {
          backgroundColor: headerBg,
          borderBottomColor: headerBorder,
          ...(isDarkMode
            ? {}
            : {
                shadowOpacity: 0.03,
                elevation: 1,
              }),
        },
      ]}
    >
      <View style={[styles.mobileHeaderInner, { paddingHorizontal: isSmallMobile ? 12 : 14 }]}>
        <View style={styles.headerWrapper}>
          <View style={[styles.headerRow, isSmallMobile && { gap: 6 }]}>
            {/* Left: User Avatar & Greeting or Sign In */}
            {currentUser ? (
              <TouchableOpacity style={styles.headerLeft} onPress={onOpenProfile} activeOpacity={0.75}>
                <View
                  style={[
                    styles.avatarWrap,
                    !isDarkMode && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
                  ]}
                >
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
                  <Text style={[styles.greetingSub, { color: subTextColor }]}>
                    {currentUser.role === 'admin' ? 'Administrator' : 'Welcome back,'}
                  </Text>
                  <View style={styles.greetingNameRow}>
                    <Text style={[styles.userName, { color: primaryTextColor }]}>
                      {currentUser.name || currentUser.fullName}
                    </Text>
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
                    {
                      justifyContent: 'center',
                      alignItems: 'center',
                      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : '#FFFFFF',
                      borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.25)' : '#E2E8F0',
                    },
                  ]}
                >
                  <BootstrapIcon name="person" size={17} color={isDarkMode ? '#FFFFFF' : '#475569'} />
                </View>
                <View>
                  <Text style={[styles.greetingSub, { color: subTextColor }]}>Welcome</Text>
                  <Text style={[styles.userName, { color: '#EA580C', fontSize: 13.5 }]}>
                    Sign In / Register ➔
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Right: Notifications, Wishlist & Cart Bag */}
            <View style={[styles.headerRight, isSmallMobile && { gap: 6 }]}>
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={onNavigateToNotifications}
                title="Notifications"
                activeOpacity={0.75}
              >
                <BootstrapIcon name="bell" size={18} color={iconColor} />
                {unreadNotifCount > 0 && (
                  <View style={[styles.cartBadgeDot, { backgroundColor: '#EF4444', borderColor: headerBg }]}>
                    <Text style={styles.cartBadgeDotText}>
                      {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={onNavigateToWishlist}
                title="Saved Wishlist"
                activeOpacity={0.75}
              >
                <BootstrapIcon name="bookmark" size={18} color={iconColor} />
                {wishlistCount > 0 && (
                  <View style={[styles.cartBadgeDot, { backgroundColor: '#EA580C', borderColor: headerBg }]}>
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
                <BootstrapIcon name="cart3" size={19} color={iconColor} />
                {cartItemCount > 0 && (
                  <View style={[styles.cartBadgeDot, { backgroundColor: '#EF4444', borderColor: headerBg }]}>
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
            <View
              style={[
                styles.searchBarPill,
                !isDarkMode && {
                  backgroundColor: '#FFFFFF',
                  borderColor: '#E2E8F0',
                },
              ]}
            >
              <BootstrapIcon
                name="search"
                size={15}
                color={isDarkMode ? '#FFFFFF' : '#64748B'}
                style={{ marginRight: 8 }}
              />
              <TextInput
                style={[styles.searchInput, !isDarkMode && { color: '#0F172A' }]}
                placeholder={searchPlaceholder}
                placeholderTextColor={isDarkMode ? 'rgba(255, 255, 255, 0.45)' : '#94A3B8'}
                value={searchQuery}
                onChangeText={onSearchChange}
              />
              {onCycleFilterSort && (
                <TouchableOpacity
                  style={styles.filterBtnInside}
                  onPress={onCycleFilterSort}
                  activeOpacity={0.7}
                >
                  <BootstrapIcon name="sliders" size={16} color={isDarkMode ? '#FFFFFF' : '#475569'} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
