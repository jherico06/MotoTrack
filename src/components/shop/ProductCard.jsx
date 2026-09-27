import React from 'react';
import { View, Text, TouchableOpacity, Image, useWindowDimensions } from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon';
import { shopStyles as styles } from '../../styles/shop.styles';
import { useWishlist } from '../../context/WishlistContext';
import { isProductSoldOut } from '../../utils/productSizes';
import { productHasCustomerRatings } from '../../utils/productCatalog';
import { getProductCardImageUrl } from '../../utils/imageUrl';

export default function ProductCard({ product, onPress }) {
  const { width } = useWindowDimensions();
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
  const displayPrice = Number(product.price) || 0;
  const hasRatings = productHasCustomerRatings(product);
  const imageUri = getProductCardImageUrl(product.image);

  return (
    <TouchableOpacity
      style={[
        styles.productCard,
        isMobile && { width: mobileCardWidth },
        isTablet && styles.productCardTablet,
        isDesktop && styles.productCardDesktop,
      ]}
      onPress={() => onPress?.(product)}
      activeOpacity={0.92}
    >
      <View style={styles.productImageContainer}>
        <Image source={{ uri: imageUri }} style={styles.productImg} />

        {soldOut ? (
          <View
            style={{
              position: 'absolute',
              left: 8,
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
          style={styles.wishlistToggleBtn}
          onPress={(e) => {
            e.stopPropagation?.();
            toggleWishlist(product.id);
          }}
          activeOpacity={0.8}
        >
          <BootstrapIcon
            name={isFav ? 'heart-fill' : 'heart'}
            size={13}
            color={isFav ? '#EF4444' : '#64748B'}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.productCardDetails}>
        {product.brand ? (
          <Text style={styles.productBrandText} numberOfLines={1}>
            {product.brand.toUpperCase()}
          </Text>
        ) : null}

        <Text style={styles.productTitle} numberOfLines={2}>
          {product.name}
        </Text>

        <View style={styles.priceRow}>
          <Text style={styles.priceMainText}>₱{displayPrice.toFixed(2)}</Text>
        </View>

        <View style={styles.metaMinimalRow}>
          {hasRatings ? (
            <View style={styles.ratingMinimal}>
              <BootstrapIcon name="star-fill" size={9.5} color="#F59E0B" />
              <Text style={styles.ratingValText}>{Number(product.rating).toFixed(1)}</Text>
              <Text style={styles.reviewCountText}>({product.reviews})</Text>
            </View>
          ) : (
            <View style={styles.ratingMinimal}>
              <BootstrapIcon name="star" size={9.5} color="#94A3B8" />
              <Text style={styles.unratedMinimalText}>No ratings yet</Text>
            </View>
          )}
          <Text style={styles.metaDotDivider}>•</Text>
          <Text style={styles.stockMinimalText}>
            {soldOut
              ? 'Sold out'
              : product.stock <= 5
                ? `Only ${product.stock} left`
                : `${product.stock} in stock`}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
