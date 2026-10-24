import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { BootstrapIcon } from '../../../components/common/BootstrapIcon.jsx';
import { androidTokens } from '../theme/index.js';

/**
 * AndroidTopAppBar (Material Design 3 / M3)
 *
 * - Charcoal background (#24272B)
 * - Left-aligned M3 Title / Brand branding
 * - Rounded-28dp M3 search pill input
 * - Native Android ripple effects
 * - Material badge indicators for Cart & Wishlist
 */
export default function AndroidTopAppBar({
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
    <View style={styles.appBarWrapper}>
      {/* Top Headline Row */}
      <View style={styles.topRow}>
        <Pressable
          style={styles.brandRow}
          onPress={onNavigateToStore}
          android_ripple={{ color: 'rgba(255, 255, 255, 0.15)', borderless: true }}
        >
          <View style={styles.logoBadge}>
            <BootstrapIcon name="speedometer2" size={18} color="#EA580C" />
          </View>
          <View>
            <Text style={styles.brandTitle}>{title}</Text>
            <Text style={styles.brandSub}>Parts • Garage • AI Studio</Text>
          </View>
        </Pressable>

        {/* Action Icons */}
        <View style={styles.actionRow}>
          {/* Wishlist */}
          <Pressable
            style={styles.iconBtn}
            onPress={onNavigateToWishlist}
            android_ripple={{ color: 'rgba(255, 255, 255, 0.2)', borderless: true }}
            accessibilityLabel="Wishlist"
          >
            <BootstrapIcon name="heart-fill" size={20} color="#FFFFFF" />
            {wishlistCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{wishlistCount > 99 ? '99+' : wishlistCount}</Text>
              </View>
            )}
          </Pressable>

          {/* Cart */}
          <Pressable
            style={styles.iconBtn}
            onPress={onOpenCart}
            android_ripple={{ color: 'rgba(255, 255, 255, 0.2)', borderless: true }}
            accessibilityLabel="Cart"
          >
            <BootstrapIcon name="bag-fill" size={20} color="#FFFFFF" />
            {cartCount > 0 && (
              <View style={[styles.badge, styles.badgeOrange]}>
                <Text style={styles.badgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* M3 Search Pill Container (28dp radius) */}
      <View style={styles.searchContainer}>
        <View style={styles.searchPill}>
          <BootstrapIcon name="search" size={16} color="#FFFFFF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search parts, garage PMS, or models..."
            placeholderTextColor="rgba(255, 255, 255, 0.65)"
            value={searchQuery}
            onChangeText={onSearchChange}
          />
          {searchQuery ? (
            <Pressable
              onPress={() => onSearchChange('')}
              android_ripple={{ color: 'rgba(255, 255, 255, 0.2)', borderless: true }}
              style={styles.clearBtn}
            >
              <BootstrapIcon name="x" size={18} color="#FFFFFF" />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  appBarWrapper: {
    backgroundColor: '#24272B', // Sticky Charcoal
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    elevation: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(234, 88, 12, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(234, 88, 12, 0.3)',
  },
  brandTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  brandSub: {
    fontSize: 10.5,
    color: '#94A3B8',
    letterSpacing: 0.2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderRadius: 20,
  },
  badge: {
    position: 'absolute',
    top: 3,
    right: 3,
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
  searchContainer: {
    width: '100%',
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 28, // M3 Full Pill Shape
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 14,
    height: 42,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13.5,
    height: '100%',
    padding: 0,
  },
  clearBtn: {
    padding: 4,
  },
});
