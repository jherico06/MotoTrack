import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { BootstrapIcon } from '../../../components/common/BootstrapIcon.jsx';
import { iosTokens } from '../theme/index.js';

/**
 * IosHeader (Apple Human Interface Guidelines)
 *
 * - Charcoal background (#24272B)
 * - Safe area top clearance
 * - Centered title / MotoTrack branding
 * - Transparent bordered search input with white text & clear button
 * - iOS-style badge counts and spring touch feedback
 */
export default function IosHeader({
  searchQuery = '',
  onSearchChange = () => {},
  cartCount = 0,
  wishlistCount = 0,
  onOpenCart = () => {},
  onNavigateToWishlist = () => {},
  onNavigateToStore = () => {},
  title = 'MotoTrack',
}) {
  return (
    <View style={styles.headerWrapper}>
      {/* Top Bar Row */}
      <View style={styles.topRow}>
        {/* Left: Brand Icon & Title */}
        <TouchableOpacity
          style={styles.brandRow}
          onPress={onNavigateToStore}
          activeOpacity={0.7}
        >
          <View style={styles.logoBadge}>
            <BootstrapIcon name="speedometer2" size={17} color="#EA580C" />
          </View>
          <View>
            <Text style={styles.brandTitle}>{title}</Text>
            <Text style={styles.brandSub}>Performance Parts & Studio</Text>
          </View>
        </TouchableOpacity>

        {/* Right Action Icons (Wishlist & Cart) */}
        <View style={styles.actionRow}>
          {/* Wishlist */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={onNavigateToWishlist}
            activeOpacity={0.65}
            accessibilityLabel="Wishlist"
          >
            <BootstrapIcon name="heart-fill" size={19} color="#FFFFFF" />
            {wishlistCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{wishlistCount > 99 ? '99+' : wishlistCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Cart */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={onOpenCart}
            activeOpacity={0.65}
            accessibilityLabel="Cart"
          >
            <BootstrapIcon name="bag-fill" size={19} color="#FFFFFF" />
            {cartCount > 0 && (
              <View style={[styles.badge, styles.badgeOrange]}>
                <Text style={styles.badgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* iOS Search Bar */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchInner}>
          <BootstrapIcon name="search" size={15} color="#FFFFFF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search parts, brands, or PMS..."
            placeholderTextColor="rgba(255, 255, 255, 0.65)"
            value={searchQuery}
            onChangeText={onSearchChange}
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => onSearchChange('')} activeOpacity={0.7}>
              <BootstrapIcon name="x-circle-fill" size={15} color="rgba(255, 255, 255, 0.65)" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrapper: {
    backgroundColor: '#24272B', // Sticky Charcoal
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(234, 88, 12, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(234, 88, 12, 0.3)',
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  brandSub: {
    fontSize: 10,
    color: '#94A3B8',
    letterSpacing: -0.1,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#24272B',
  },
  badgeOrange: {
    backgroundColor: '#EA580C',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  searchBarContainer: {
    width: '100%',
  },
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 12,
    height: 38,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    height: '100%',
    padding: 0,
  },
});
