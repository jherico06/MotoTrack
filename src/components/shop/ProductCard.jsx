import React from 'react';
import { View, Text, TouchableOpacity, Image, useWindowDimensions } from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon';
import { shopStyles as styles } from '../../styles/shop.styles';
import { useWishlist } from '../../context/WishlistContext';

export default function ProductCard({
  product,
  onPress,
  onAddToCart,
}) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 700 && width < 1024;
  const isDesktop = width >= 1024;

  const { isWishlisted, toggleWishlist } = useWishlist();
  const isFav = isWishlisted(product.id);

  return (
    <TouchableOpacity
      style={[
        styles.productCard,
        isTablet && styles.productCardTablet,
        isDesktop && styles.productCardDesktop,
      ]}
      onPress={() => onPress?.(product)}
      activeOpacity={0.92}
    >
      {/* Product Image & Badges */}
      <View style={styles.productImageContainer}>
        <Image
          source={{ uri: product.image }}
          style={styles.productImg}
        />

        {/* Wishlist Heart Button */}
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
            size={15}
            color={isFav ? '#EF4444' : '#94A3B8'}
          />
        </TouchableOpacity>

        {/* Royal Blue Price Badge */}
        <View style={styles.priceBadgePill}>
          <Text style={styles.priceBadgeText}>₱{product.price?.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Product Details */}
      <View style={styles.productCardDetails}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 }}>
          <BootstrapIcon
            name="box-seam"
            size={11}
            color={product.stock <= 5 ? '#ef4444' : '#64748b'}
          />
          <Text
            style={[
              styles.stockCountText,
              product.stock <= 5 && styles.stockLowText,
              { marginBottom: 0 },
            ]}
          >
            {product.stock} Stocks Left
          </Text>
        </View>

        <View style={styles.ratingReviewRow}>
          <BootstrapIcon name="star-fill" size={11} color="#f59e0b" />
          <Text style={styles.ratingStarText}>
            {product.rating?.toFixed(1) || '5.0'}
          </Text>
          <Text style={styles.ratingCountText}>
            ({product.reviews || 0})
          </Text>
        </View>

        <Text style={styles.productTitle} numberOfLines={2}>
          {product.name}
        </Text>

        {/* Quick Add To Bag Button */}
        <TouchableOpacity
          style={{
            backgroundColor: '#F3F7F6',
            borderRadius: 12,
            paddingVertical: 7,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 8,
            borderWidth: 1,
            borderColor: '#D1ECE6',
            flexDirection: 'row',
            gap: 6,
          }}
          onPress={(e) => {
            e.stopPropagation?.();
            onAddToCart?.(product);
          }}
        >
          <BootstrapIcon name="bag-plus-fill" size={13} color="#0C6258" />
          <Text style={{ color: '#0C6258', fontSize: 12, fontWeight: '800' }}>
            Add to Bag
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}
