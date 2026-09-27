import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  ActivityIndicator,
} from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon';
import { shopStyles as styles } from '../../styles/shop.styles';
import { productService } from '../../services/productService';
import { isProductSoldOut, productNeedsSizes } from '../../utils/productSizes';
import { productHasColors } from '../../utils/productColors';
import { sanitizeCompareAtPrice } from '../../utils/productCatalog';
import PlaceOrderModal from './PlaceOrderModal';

function StarRow({ rating, size = 14 }) {
  const score = Math.max(0, Math.min(5, Number(rating) || 0));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const isFilled = score >= n - 0.5;
        return (
          <BootstrapIcon
            key={n}
            name={isFilled ? 'star-fill' : 'star'}
            size={size}
            color={isFilled ? '#F59E0B' : '#CBD5E1'}
          />
        );
      })}
    </View>
  );
}

function formatReviewDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export default function ProductSpecsModal({
  visible,
  product,
  onClose,
  onAddToCart,
  onBuyNow,
}) {
  const productSoldOut = isProductSoldOut(product);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [orderMode, setOrderMode] = useState('buy');

  const handleClose = () => {
    setOrderModalOpen(false);
    onClose?.();
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!visible || !product?.id) {
        setReviews([]);
        return;
      }
      setReviewsLoading(true);
      try {
        const list = await productService.getProductReviews(product.id || product.product_id);
        if (!cancelled) setReviews(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setReviews([]);
      } finally {
        if (!cancelled) setReviewsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [visible, product?.id, product?.product_id]);

  if (!product) return null;

  const needsOptions = productNeedsSizes(product) || productHasColors(product);
  const displayPrice = Number(product.price) || 0;
  const compareAt = sanitizeCompareAtPrice(product.oldPrice, displayPrice);
  const avgReviewScore =
    reviews.length > 0
      ? reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0) / reviews.length
      : 0;

  const openOrderModal = (mode) => {
    if (productSoldOut) return;
    setOrderMode(mode);
    setOrderModalOpen(true);
  };

  const handleAddToCartPress = () => {
    if (productSoldOut) return;
    if (needsOptions) {
      openOrderModal('cart');
      return;
    }
    onAddToCart?.(product, 1, {});
    onClose?.();
  };

  const handleBuyNowPress = () => {
    if (productSoldOut) return;
    openOrderModal('buy');
  };

  const handleOrderConfirm = (finalProduct, options = {}) => {
    const size = options.size || finalProduct?.selectedSize || '';
    const color = options.color || finalProduct?.selectedColor || '';
    const payloadOpts = { size, color };
    if (options.mode === 'cart' || orderMode === 'cart') {
      onAddToCart?.(finalProduct, 1, payloadOpts);
    } else {
      onBuyNow?.(finalProduct, 1, payloadOpts);
    }
    setOrderModalOpen(false);
    onClose?.();
  };

  return (
    <>
      <Modal visible={visible && !orderModalOpen} transparent animationType="slide" onRequestClose={handleClose}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '92%' }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Product Details</Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={handleClose}>
                <BootstrapIcon name="x-lg" size={14} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: 520 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 8 }}
            >
              <Image source={{ uri: product.image }} style={styles.specImageBanner} />

              <Text style={styles.specTitle}>{product.name}</Text>

              <View style={styles.specBrandRow}>
                <View style={styles.specBrandBadge}>
                  <Text style={styles.specBrandText}>
                    {product.brand} • {product.category}
                  </Text>
                </View>
                {productSoldOut ? (
                  <View
                    style={{
                      backgroundColor: '#FEE2E2',
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#DC2626' }}>SOLD OUT</Text>
                  </View>
                ) : null}
              </View>

              {reviews.length > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <StarRow rating={avgReviewScore} size={15} />
                  <Text style={{ fontSize: 13, color: '#F59E0B', fontWeight: '800' }}>
                    {avgReviewScore.toFixed(1)}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '600' }}>
                    ({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})
                  </Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <BootstrapIcon name="star" size={13} color="#94A3B8" />
                  <Text style={{ fontSize: 12, color: '#94A3B8', fontWeight: '600' }}>
                    No ratings yet
                  </Text>
                </View>
              )}

              <View style={styles.specPriceRow}>
                <Text style={styles.specPriceMain}>₱{displayPrice.toFixed(2)}</Text>
                {compareAt ? (
                  <Text style={styles.specPriceOld}>₱{compareAt.toFixed(2)}</Text>
                ) : null}
              </View>

              <Text style={[styles.formLabel, { marginTop: 4 }]}>Description</Text>
              <Text style={styles.specDescription}>
                {product.description || 'No description available for this part.'}
              </Text>

              {product.features?.length ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.formLabel}>Key Features</Text>
                  {product.features.map((feat, idx) => (
                    <View key={idx} style={styles.featureBullet}>
                      <BootstrapIcon name="check2" size={14} color="#1D4533" />
                      <Text style={styles.featureBulletText}>{feat}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={{ marginTop: 16, marginBottom: 4 }}>
                <Text style={styles.formLabel}>Customer Reviews</Text>
                {reviewsLoading ? (
                  <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                    <ActivityIndicator color="#1D4533" />
                  </View>
                ) : reviews.length === 0 ? (
                  <View
                    style={{
                      marginTop: 8,
                      padding: 14,
                      borderRadius: 12,
                      backgroundColor: '#F8FAFC',
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                    }}
                  >
                    <Text style={{ fontSize: 13, color: '#64748B', fontWeight: '600' }}>
                      No customer comments yet. Be the first to review after your order is delivered.
                    </Text>
                  </View>
                ) : (
                  <View style={{ marginTop: 8, gap: 10 }}>
                    {reviews.map((rev) => (
                      <View
                        key={rev.id || rev.review_id}
                        style={{
                          padding: 12,
                          borderRadius: 12,
                          backgroundColor: '#F8FAFC',
                          borderWidth: 1,
                          borderColor: '#E2E8F0',
                        }}
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: 6,
                          }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>
                            {rev.customerName || rev.customer_name || 'Rider'}
                          </Text>
                          <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '600' }}>
                            {formatReviewDate(rev.createdAt || rev.created_at)}
                          </Text>
                        </View>
                        <StarRow rating={rev.rating} size={12} />
                        <Text
                          style={{
                            fontSize: 13,
                            color: '#334155',
                            marginTop: 8,
                            lineHeight: 19,
                          }}
                        >
                          {rev.comment || 'Verified purchase — no written comment.'}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <TouchableOpacity
                style={[
                  styles.checkoutBtn,
                  {
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    opacity: productSoldOut ? 0.5 : 1,
                  },
                ]}
                disabled={productSoldOut}
                onPress={handleAddToCartPress}
                activeOpacity={0.9}
              >
                <BootstrapIcon name="cart-plus-fill" size={14} color="#ffffff" />
                <Text style={styles.checkoutBtnText}>Add to Cart</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.checkoutBtn,
                  {
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    backgroundColor: '#FFFFFF',
                    borderWidth: 1.5,
                    borderColor: '#1D4533',
                    opacity: productSoldOut ? 0.5 : 1,
                  },
                ]}
                disabled={productSoldOut}
                onPress={handleBuyNowPress}
                activeOpacity={0.9}
              >
                <BootstrapIcon name="lightning-fill" size={14} color="#1D4533" />
                <Text style={[styles.checkoutBtnText, { color: '#1D4533' }]}>Buy Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <PlaceOrderModal
        visible={orderModalOpen}
        product={product}
        mode={orderMode}
        onClose={() => setOrderModalOpen(false)}
        onConfirm={handleOrderConfirm}
      />
    </>
  );
}
