import React from 'react';
import { View, Text, TouchableOpacity, Image, useWindowDimensions } from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon.jsx';
import { shopStyles as styles } from '../../styles/shop.styles.js';
import { useWishlist } from '../../context/WishlistContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { isProductSoldOut } from '../../utils/productSizes.js';
import { productHasCustomerRatings } from '../../utils/productCatalog.js';
import { getProductCardImageUrl } from '../../utils/imageUrl.js';
import CompatibilityIndicator from './CompatibilityIndicator.jsx';
import { resolveReorderLevel } from '../../utils/inventoryHelpers.js';

export default function ProductCard({ product, bike, onPress }) {
  const { width } = useWindowDimensions();
  const { isDarkMode = false } = useTheme?.() || {};
  const isTablet = width >= 700 && width < 1024;
  const isDesktop = width >= 1024;
  const isMobile = width < 700;

  // Exact 2-column mathematical width for mobile to ensure zero line wrapping or overflow
  const horizontalPadding = width < 380 ? 12 : 14;
  const cardGap = 10;
  const mobileCardWidth = isMobile
    ? Math.floor((width - horizontalPadding * 2 - cardGap) / 2)
    : undefined;

  const { isWishlisted, toggleWishlist } = useWishlist();
  const isFav = isWishlisted(product.id);
  const soldOut = isProductSoldOut(product);
  const lowStock =
    !soldOut && Number(product.stock) > 0 && Number(product.stock) <= resolveReorderLevel(product, 5);
  const displayPrice = Number(product.price) || 0;
  const hasRatings = productHasCustomerRatings(product);
  const imageUri = getProductCardImageUrl(product.image);
  const compatMessage = product.compatMessage;
  const compatStatus = product.compatStatus;

  return (
    <TouchableOpacity
      style={[
        styles.productCard,
        isMobile && { width: mobileCardWidth },
        isTablet && styles.productCardTablet,
        isDesktop && styles.productCardDesktop,
        isDarkMode && {
          backgroundColor: '#1C1F23',
          borderColor: '#2B3035',
        },
      ]}
      onPress={() => onPress?.(product)}
      activeOpacity={0.92}
    >
      <View style={[styles.productImageContainer, isDarkMode && { backgroundColor: '#14171A' }]}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.productImg} />
        ) : (
          <View style={{ flex: 1, width: '100%', height: 160, alignItems: 'center', justifyContent: 'center', backgroundColor: isDarkMode ? '#14171A' : '#F8FAFC' }}>
            <BootstrapIcon name="box-seam" size={36} color={isDarkMode ? '#475569' : '#CBD5E1'} />
          </View>
        )}

        {/* Compatibility Indicator (Top-Left) */}
        <CompatibilityIndicator
          status={compatStatus}
          bike={bike}
          message={compatMessage}
        />

        {soldOut ? (
          <View
            style={{
              position: 'absolute',
              left: (compatStatus === 'compatible' || compatStatus === 'incompatible') ? 38 : 8,
              top: 8,
              backgroundColor: '#DC2626',
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 8,
              zIndex: 2,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>SOLD OUT</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[
            styles.wishlistToggleBtn,
            isDarkMode && { backgroundColor: 'rgba(30, 34, 38, 0.9)', borderColor: '#2B3035' },
          ]}
          onPress={(e) => {
            e.stopPropagation?.();
            toggleWishlist(product.id);
          }}
          activeOpacity={0.8}
        >
          <BootstrapIcon
            name={isFav ? 'heart-fill' : 'heart'}
            size={13}
            color={isFav ? '#EF4444' : (isDarkMode ? '#94A3B8' : '#64748B')}
          />
        </TouchableOpacity>
      </View>

      <View style={[styles.productCardDetails, isDarkMode && { backgroundColor: '#1C1F23' }]}>
        {product.brand ? (
          <Text style={[styles.productBrandText, isDarkMode && { color: '#94A3B8' }]} numberOfLines={1}>
            {product.brand.toUpperCase()}
          </Text>
        ) : null}

        <Text style={[styles.productTitle, isDarkMode && { color: '#F9FAFB' }]} numberOfLines={2}>
          {product.name}
        </Text>

        <View style={styles.priceRow}>
          <Text style={styles.priceMainText}>₱{displayPrice.toFixed(2)}</Text>
        </View>

        <View style={styles.metaMinimalRow}>
          {hasRatings ? (
            <View style={styles.ratingMinimal}>
              <BootstrapIcon name="star-fill" size={9.5} color="#F59E0B" />
              <Text style={[styles.ratingValText, isDarkMode && { color: '#CBD5E1' }]}>{Number(product.rating).toFixed(1)}</Text>
              <Text style={[styles.reviewCountText, isDarkMode && { color: '#94A3B8' }]}>({product.reviews})</Text>
            </View>
          ) : (
            <View style={styles.ratingMinimal}>
              <BootstrapIcon name="star" size={9.5} color={isDarkMode ? '#64748B' : '#94A3B8'} />
              <Text style={[styles.unratedMinimalText, isDarkMode && { color: '#94A3B8' }]}>No ratings yet</Text>
            </View>
          )}
          <Text style={[styles.metaDotDivider, isDarkMode && { color: '#475569' }]}>•</Text>
          <Text style={[styles.stockMinimalText, isDarkMode && { color: '#94A3B8' }]}>
            {soldOut
              ? 'Sold out'
              : lowStock
                ? `Only ${product.stock} left`
                : `${product.stock} in stock`}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
