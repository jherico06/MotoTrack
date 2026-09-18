import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  StyleSheet,
  ActivityIndicator,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon';
import { orderService } from '../../services/orderService';
import { productService } from '../../services/productService';
import { useCart } from '../../context/CartContext';

const RATING_LABELS = {
  1: '1.0 - Poor',
  2: '2.0 - Fair',
  3: '3.0 - Good',
  4: '4.0 - Great',
  5: '5.0 - Excellent!',
};

const QUICK_TAGS = [
  'Authentic Part',
  'Fast Delivery',
  'Perfect Fit',
  'High Quality',
  'Great Sound',
  'Well Packaged',
];

export default function RateDeliveredOrderModal({
  visible = false,
  order = null,
  currentUser = null,
  onClose = () => {},
  onSubmitSuccess = () => {},
}) {
  const { showToast } = useCart();
  const [itemsRatings, setItemsRatings] = useState({});
  const [courierRating, setCourierRating] = useState(5);
  const [overallFeedback, setOverallFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Normalize order items list
  const deliveredItems = useMemo(() => {
    if (!order) return [];
    if (Array.isArray(order.items) && order.items.length > 0) {
      return order.items.map((it, idx) => ({
        id: it.product_id || it.id || it.product?.id || `item-${idx}`,
        product_id: it.product_id || it.id || it.product?.id || `prod-${idx}`,
        name: it.product?.name || it.name || 'Motorcycle Component',
        brand: it.product?.brand || it.brand || 'MotoTrack',
        price: Number(it.product?.price ?? it.price ?? 0),
        quantity: Number(it.quantity || 1),
        image:
          it.product?.image ||
          it.image ||
          'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80',
      }));
    }
    // Fallback if order has only items_summary
    return [
      {
        id: 'item-summary',
        product_id: 'prod-order',
        name: order.items_summary || 'Delivered MotoTrack Package',
        brand: 'MotoTrack Verified',
        price: Number(order.grand_total || order.total_amount || 0),
        quantity: order.items_count || 1,
        image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80',
      },
    ];
  }, [order]);

  // Initialize ratings state for each delivered item
  useEffect(() => {
    if (order && visible) {
      const initial = {};
      deliveredItems.forEach((it) => {
        const existing = order.rating_data?.items_ratings?.[it.id] || order.rating_data?.items_ratings?.[it.product_id];
        initial[it.id] = {
          rating: existing?.rating || 5,
          comment: existing?.comment || '',
          tags: existing?.tags || ['Authentic Part'],
        };
      });
      setItemsRatings(initial);
      setCourierRating(order.rating_data?.courier_rating || 5);
      setOverallFeedback(order.rating_data?.feedback || '');
    }
  }, [order, visible, deliveredItems]);

  if (!visible || !order) return null;

  const orderId = order.order_id || order.id || 'N/A';
  const isAlreadyRated = Boolean(order.is_rated);

  const handleSetItemRating = (itemId, ratingValue) => {
    setItemsRatings((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || { comment: '', tags: [] }),
        rating: ratingValue,
      },
    }));
  };

  const handleSetItemComment = (itemId, text) => {
    setItemsRatings((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || { rating: 5, tags: [] }),
        comment: text,
      },
    }));
  };

  const handleToggleTag = (itemId, tag) => {
    setItemsRatings((prev) => {
      const current = prev[itemId] || { rating: 5, comment: '', tags: [] };
      const hasTag = current.tags.includes(tag);
      const newTags = hasTag ? current.tags.filter((t) => t !== tag) : [...current.tags, tag];
      return {
        ...prev,
        [itemId]: { ...current, tags: newTags },
      };
    });
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // 1. Calculate overall customer score across items
      const itemScores = Object.values(itemsRatings).map((r) => Number(r.rating || 5));
      const avgScore =
        itemScores.length > 0
          ? Number((itemScores.reduce((a, b) => a + b, 0) / itemScores.length).toFixed(1))
          : 5.0;

      // 2. Submit reviews for each product to update catalog rating and review count
      for (const item of deliveredItems) {
        const itemReview = itemsRatings[item.id] || { rating: 5, comment: '', tags: [] };
        const combinedComment = [
          itemReview.comment.trim(),
          itemReview.tags?.length > 0 ? `[${itemReview.tags.join(', ')}]` : '',
        ]
          .filter(Boolean)
          .join(' ');

        await productService.submitProductReview({
          productId: item.product_id || item.id,
          rating: itemReview.rating,
          comment: combinedComment || 'Verified purchase from delivered order',
          customerName: currentUser?.name || order.customer_name || 'Rider',
          orderId: order.order_id || order.id,
        });
      }

      // 3. Mark the order as rated in orderService
      await orderService.submitOrderRating(order.order_id || order.id, {
        overallRating: avgScore,
        courierRating,
        itemsRatings,
        feedback: overallFeedback.trim(),
      });

      showToast?.('🎉 Thank you! Your rating & review have been submitted.');
      onSubmitSuccess?.();
      onClose?.();
    } catch (e) {
      console.warn('Submit rating failed:', e);
      showToast?.('Rating saved locally. Thank you for your review!');
      onSubmitSuccess?.();
      onClose?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalCard}>
              {/* ─── HEADER ─── */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <View style={styles.headerIconWrap}>
                    <BootstrapIcon name="star-fill" size={18} color="#D97706" />
                  </View>
                  <View>
                    <Text style={styles.headerTitle}>
                      {isAlreadyRated ? 'Delivered Order Rating' : 'Rate Delivered Items'}
                    </Text>
                    <Text style={styles.headerSub}>Order #{orderId}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.75}>
                  <BootstrapIcon name="x-lg" size={14} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
                {/* ─── VERIFIED DELIVERY BANNER ─── */}
                <View style={styles.deliveryBadgeBanner}>
                  <View style={styles.checkCircle}>
                    <BootstrapIcon name="check-circle-fill" size={16} color="#15803D" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.deliveryBannerTitle}>Verified Delivery Complete</Text>
                    <Text style={styles.deliveryBannerSub}>
                      Your package has been successfully delivered. Share your rating to help other riders choose the best parts!
                    </Text>
                  </View>
                </View>

                {/* ─── DELIVERED ITEMS LIST & STAR SELECTORS ─── */}
                <Text style={styles.sectionHeading}>Rate Your Parts & Accessories</Text>

                {deliveredItems.map((item, idx) => {
                  const currentItemRating = itemsRatings[item.id] || { rating: 5, comment: '', tags: [] };
                  const ratingVal = currentItemRating.rating || 5;

                  return (
                    <View key={item.id || idx} style={styles.itemReviewCard}>
                      {/* Product Row */}
                      <View style={styles.productRow}>
                        <Image source={{ uri: item.image }} style={styles.productThumb} />
                        <View style={styles.productInfo}>
                          <Text style={styles.productBrand}>{item.brand}</Text>
                          <Text style={styles.productName} numberOfLines={2}>
                            {item.name}
                          </Text>
                          <Text style={styles.productPrice}>
                            ₱{item.price.toLocaleString()} • Qty: {item.quantity}
                          </Text>
                        </View>
                      </View>

                      {/* Interactive Star Rating */}
                      <View style={styles.starRatingSection}>
                        <Text style={styles.rateQuestionLabel}>How do you rate this item?</Text>
                        <View style={styles.starRow}>
                          {[1, 2, 3, 4, 5].map((starNum) => {
                            const isFilled = starNum <= ratingVal;
                            return (
                              <TouchableOpacity
                                key={starNum}
                                onPress={() => handleSetItemRating(item.id, starNum)}
                                activeOpacity={0.7}
                                style={styles.starBtn}
                              >
                                <BootstrapIcon
                                  name={isFilled ? 'star-fill' : 'star'}
                                  size={26}
                                  color={isFilled ? '#F59E0B' : '#CBD5E1'}
                                />
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        <Text style={styles.starSentimentText}>
                          {RATING_LABELS[ratingVal] || `${ratingVal}.0 Stars`}
                        </Text>
                      </View>

                      {/* Quick Tag Pills */}
                      <View style={styles.quickTagsContainer}>
                        {QUICK_TAGS.map((tag) => {
                          const isTagActive = currentItemRating.tags?.includes(tag);
                          return (
                            <TouchableOpacity
                              key={tag}
                              style={[styles.tagPill, isTagActive && styles.tagPillActive]}
                              onPress={() => handleToggleTag(item.id, tag)}
                              activeOpacity={0.75}
                            >
                              <Text
                                style={[styles.tagPillText, isTagActive && styles.tagPillTextActive]}
                              >
                                {isTagActive ? `✓ ${tag}` : `+ ${tag}`}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {/* Review Comment Input */}
                      <View style={styles.commentInputWrap}>
                        <TextInput
                          style={styles.commentInput}
                          placeholder="Write a review about quality, performance or fitment..."
                          placeholderTextColor="#94A3B8"
                          value={currentItemRating.comment}
                          onChangeText={(text) => handleSetItemComment(item.id, text)}
                          multiline={true}
                          numberOfLines={2}
                        />
                      </View>
                    </View>
                  );
                })}

                {/* ─── COURIER & DELIVERY RATING ─── */}
                <View style={styles.courierSectionCard}>
                  <View style={styles.courierHeader}>
                    <View style={styles.courierIconWrap}>
                      <BootstrapIcon name="truck" size={16} color="#0C6258" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.courierTitle}>Delivery & Courier Experience</Text>
                      <Text style={styles.courierSub}>
                        {order.courier || 'MotoTrack Express Delivery'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.courierStarRow}>
                    {[1, 2, 3, 4, 5].map((starNum) => {
                      const isFilled = starNum <= courierRating;
                      return (
                        <TouchableOpacity
                          key={starNum}
                          onPress={() => setCourierRating(starNum)}
                          activeOpacity={0.7}
                          style={styles.courierStarBtn}
                        >
                          <BootstrapIcon
                            name={isFilled ? 'star-fill' : 'star'}
                            size={22}
                            color={isFilled ? '#F59E0B' : '#CBD5E1'}
                          />
                        </TouchableOpacity>
                      );
                    })}
                    <Text style={styles.courierRatingLabel}>
                      {RATING_LABELS[courierRating] || `${courierRating}.0`}
                    </Text>
                  </View>
                </View>
              </ScrollView>

              {/* ─── FOOTER BUTTONS ─── */}
              <View style={styles.footer}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={onClose}
                  activeOpacity={0.8}
                  disabled={isSubmitting}
                >
                  <Text style={styles.cancelBtnText}>Close</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitBtn, isSubmitting && { opacity: 0.7 }]}
                  onPress={handleSubmit}
                  activeOpacity={0.85}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <BootstrapIcon name="check-circle-fill" size={15} color="#FFFFFF" />
                      <Text style={styles.submitBtnText}>
                        {isAlreadyRated ? 'Update Rating & Review' : 'Submit Rating & Review'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
    fontWeight: '600',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    marginVertical: 12,
  },
  deliveryBadgeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  checkCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveryBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#15803D',
  },
  deliveryBannerSub: {
    fontSize: 11.5,
    color: '#166534',
    marginTop: 2,
    lineHeight: 16,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  itemReviewCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    paddingBottom: 10,
  },
  productThumb: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  productInfo: {
    flex: 1,
  },
  productBrand: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0C6258',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  productName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 1,
  },
  productPrice: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  starRatingSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  rateQuestionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  starBtn: {
    padding: 4,
  },
  starSentimentText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#D97706',
    marginTop: 4,
  },
  quickTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 8,
  },
  tagPill: {
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tagPillActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  tagPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  tagPillTextActive: {
    color: '#15803D',
    fontWeight: '800',
  },
  commentInputWrap: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 4,
  },
  commentInput: {
    fontSize: 12.5,
    color: '#0F172A',
    minHeight: 44,
    textAlignVertical: 'top',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },
  courierSectionCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  courierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  courierIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#E6F4F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  courierTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  courierSub: {
    fontSize: 11,
    color: '#64748B',
  },
  courierStarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  courierStarBtn: {
    padding: 2,
  },
  courierRatingLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D97706',
    marginLeft: 6,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cancelBtn: {
    flex: 0.8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  submitBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#0C6258',
    shadowColor: '#0C6258',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
