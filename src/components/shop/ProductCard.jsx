import React from 'react';
import { View, Text, TouchableOpacity, Image, useWindowDimensions } from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon';
import { shopStyles as styles } from '../../styles/shop.styles';
import { useWishlist } from '../../context/WishlistContext';

export default function ProductCard({ product, onPress, onAddToCart, onBuyNow }) {
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
      {/* 1:1 Square Product Image */}
      <View style={styles.productImageContainer}>
        <Image source={{ uri: product.image }} style={styles.productImg} />

        {/* Minimalist Line Wishlist Heart Button (Top-Right) */}
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

      {/* Product Details - Minimalist E-Commerce Layout */}
      <View style={styles.productCardDetails}>
        {/* Brand/Category Subtle Tag */}
        {product.brand ? (
          <Text style={styles.productBrandText} numberOfLines={1}>
            {product.brand.toUpperCase()}
          </Text>
        ) : null}

        {/* Product Name (2 Lines Max) */}
        <Text style={styles.productTitle} numberOfLines={2}>
          {product.name}
        </Text>

        {/* Price: Clean Bold Charcoal */}
        <View style={styles.priceRow}>
          <Text style={styles.priceMainText}>₱{product.price?.toFixed(2)}</Text>
        </View>

        {/* Clean Single-Line Meta: Rating & Stock */}
        <View style={styles.metaMinimalRow}>
          <View style={styles.ratingMinimal}>
            <BootstrapIcon name="star-fill" size={9.5} color="#F59E0B" />
            <Text style={styles.ratingValText}>{product.rating?.toFixed(1) || '5.0'}</Text>
            <Text style={styles.reviewCountText}>({product.reviews || 0})</Text>
          </View>
          <Text style={styles.metaDotDivider}>•</Text>
          <Text style={styles.stockMinimalText}>
            {product.stock <= 5 ? `Only ${product.stock} left` : `${product.stock} in stock`}
          </Text>
        </View>

        {/* Action buttons: Buy Now (First, Green) + Add to Cart (Second, Outline Icon Only) */}
        <View style={styles.productActionRow}>
          <TouchableOpacity
            style={styles.buyNowBtn}
            onPress={(e) => {
              e.stopPropagation?.();
              onBuyNow?.(product);
            }}
            activeOpacity={0.8}
          >
            <BootstrapIcon name="lightning-fill" size={12} color="#FFFFFF" />
            <Text style={styles.buyNowBtnText}>Buy Now</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addToCartIconBtn}
            onPress={(e) => {
              e.stopPropagation?.();
              onAddToCart?.(product);
            }}
            activeOpacity={0.8}
            accessibilityLabel="Add to Cart"
          >
            <BootstrapIcon name="cart3" size={13} color="#0C6258" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}
