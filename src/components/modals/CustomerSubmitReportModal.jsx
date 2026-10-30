import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon.jsx';
import { ratingsReportsService, REPORT_CATEGORIES } from '../../services/feedback/ratingsReportsService.js';
import { useCart } from '../../context/CartContext.jsx';

export default function CustomerSubmitReportModal({
  visible = false,
  currentUser = null,
  recentOrders = [],
  recentBookings = [],
  initialOrder = null,
  onClose = () => {},
  onSubmitSuccess = () => {},
}) {
  const { showToast } = useCart();
  const [selectedCategory, setSelectedCategory] = useState('general_feedback');
  const [rating, setRating] = useState(0); // 0 = no rating provided
  const [message, setMessage] = useState('');
  const [selectedTxType, setSelectedTxType] = useState('general');
  const [selectedTxId, setSelectedTxId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (initialOrder && visible) {
      setSelectedTxType('order');
      setSelectedTxId(initialOrder.order_id || initialOrder.id || '');
      setSelectedCategory('order_issues');
    }
  }, [initialOrder, visible]);

  if (!visible) return null;

  const categoriesList = [
    { id: 'service_quality', label: 'Service Quality', icon: 'tools', color: '#8B5CF6' },
    { id: 'mechanic_experience', label: 'Mechanic Experience', icon: 'person-badge', color: '#F59E0B' },
    { id: 'product_quality', label: 'Product Quality', icon: 'box-seam', color: '#3B82F6' },
    { id: 'delivery', label: 'Delivery & Shipping', icon: 'truck', color: '#10B981' },
    { id: 'order_issues', label: 'Order Issues', icon: 'receipt', color: '#EF4444' },
    { id: 'payment_issues', label: 'Payment Issues', icon: 'credit-card', color: '#EC4899' },
    { id: 'general_feedback', label: 'General Feedback', icon: 'chat-square-text', color: '#64748B' },
  ];

  const handleSubmit = async () => {
    if (!message.trim()) {
      setErrorMsg('Please describe your feedback or the issue you experienced.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      let refTitle = '';
      if (selectedTxType === 'order' && selectedTxId) {
        const ord = recentOrders.find((o) => o.order_id === selectedTxId || o.id === selectedTxId);
        refTitle = ord?.items_summary || `Order #${selectedTxId}`;
      } else if (selectedTxType === 'booking' && selectedTxId) {
        const bk = recentBookings.find((b) => b.booking_id === selectedTxId || b.id === selectedTxId);
        refTitle = bk?.service_title || `Booking #${selectedTxId}`;
      }

      const res = await ratingsReportsService.submitCustomerReport({
        customerName: currentUser?.name || currentUser?.fullName || 'Rider',
        customerEmail: currentUser?.email || null,
        customerId: currentUser?.id || currentUser?.user_id || null,
        rating: rating > 0 ? rating : null,
        category: selectedCategory,
        message: message.trim(),
        transactionType: selectedTxType,
        transactionId: selectedTxId || null,
        transactionDetails: {
          ref_title: refTitle,
        },
      });

      if (res.success) {
        showToast?.('Thank you! Your feedback/report has been submitted for admin review.');
        setMessage('');
        setRating(0);
        setSelectedTxId('');
        onSubmitSuccess?.();
        onClose?.();
      } else {
        setErrorMsg(res.error || 'Failed to submit report. Please try again.');
      }
    } catch (e) {
      setErrorMsg(e?.message || 'An error occurred while submitting.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalCard}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <View style={styles.headerIconWrap}>
                    <BootstrapIcon name="chat-square-text-fill" size={16} color="#EA580C" />
                  </View>
                  <View>
                    <Text style={styles.headerTitle}>Feedback & Experience Report</Text>
                    <Text style={styles.headerSub}>Help us improve your MotoTrack experience</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.75}>
                  <BootstrapIcon name="x-lg" size={14} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
                {errorMsg ? (
                  <View style={styles.errorBanner}>
                    <BootstrapIcon name="exclamation-circle-fill" size={14} color="#DC2626" />
                    <Text style={styles.errorText}>{errorMsg}</Text>
                  </View>
                ) : null}

                {/* 1. Category Selector */}
                <Text style={styles.label}>WHAT IS THIS REGARDING? *</Text>
                <View style={styles.categoryGrid}>
                  {categoriesList.map((cat) => {
                    const isSelected = selectedCategory === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.catPill,
                          isSelected && { borderColor: cat.color, backgroundColor: cat.color + '15' },
                        ]}
                        onPress={() => setSelectedCategory(cat.id)}
                        activeOpacity={0.8}
                      >
                        <BootstrapIcon
                          name={cat.icon}
                          size={13}
                          color={isSelected ? cat.color : '#64748B'}
                        />
                        <Text
                          style={[
                            styles.catPillText,
                            isSelected && { color: cat.color, fontWeight: '600' },
                          ]}
                        >
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* 2. Star Rating (Optional) */}
                <View style={styles.ratingSection}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.label}>STAR RATING (OPTIONAL)</Text>
                    {rating > 0 && (
                      <TouchableOpacity onPress={() => setRating(0)}>
                        <Text style={styles.clearRatingText}>Clear</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <TouchableOpacity
                        key={star}
                        onPress={() => setRating(star)}
                        style={styles.starTouch}
                        activeOpacity={0.7}
                      >
                        <BootstrapIcon
                          name={star <= rating ? 'star-fill' : 'star'}
                          size={24}
                          color={star <= rating ? '#D97706' : '#CBD5E1'}
                        />
                      </TouchableOpacity>
                    ))}
                    <Text style={styles.ratingHint}>
                      {rating === 1 && '1.0 - Poor'}
                      {rating === 2 && '2.0 - Fair'}
                      {rating === 3 && '3.0 - Good'}
                      {rating === 4 && '4.0 - Great'}
                      {rating === 5 && '5.0 - Excellent'}
                      {rating === 0 && 'Tap to rate'}
                    </Text>
                  </View>
                </View>

                {/* 3. Related Transaction (Optional) */}
                {(recentOrders.length > 0 || recentBookings.length > 0) && (
                  <View style={styles.txSection}>
                    <Text style={styles.label}>ASSOCIATED ORDER OR SERVICE (OPTIONAL)</Text>
                    <View style={styles.txTabs}>
                      <TouchableOpacity
                        style={[styles.txTab, selectedTxType === 'general' && styles.txTabActive]}
                        onPress={() => {
                          setSelectedTxType('general');
                          setSelectedTxId('');
                        }}
                      >
                        <Text style={[styles.txTabText, selectedTxType === 'general' && styles.txTabTextActive]}>
                          General
                        </Text>
                      </TouchableOpacity>

                      {recentOrders.length > 0 && (
                        <TouchableOpacity
                          style={[styles.txTab, selectedTxType === 'order' && styles.txTabActive]}
                          onPress={() => {
                            setSelectedTxType('order');
                            if (recentOrders[0]) setSelectedTxId(recentOrders[0].order_id || recentOrders[0].id);
                          }}
                        >
                          <Text style={[styles.txTabText, selectedTxType === 'order' && styles.txTabTextActive]}>
                            Order ({recentOrders.length})
                          </Text>
                        </TouchableOpacity>
                      )}

                      {recentBookings.length > 0 && (
                        <TouchableOpacity
                          style={[styles.txTab, selectedTxType === 'booking' && styles.txTabActive]}
                          onPress={() => {
                            setSelectedTxType('booking');
                            if (recentBookings[0]) setSelectedTxId(recentBookings[0].booking_id || recentBookings[0].id);
                          }}
                        >
                          <Text style={[styles.txTabText, selectedTxType === 'booking' && styles.txTabTextActive]}>
                            Service Booking ({recentBookings.length})
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {selectedTxType === 'order' && (
                      <View style={styles.selectorWrap}>
                        {recentOrders.slice(0, 4).map((o) => {
                          const oid = o.order_id || o.id;
                          const isSel = selectedTxId === oid;
                          return (
                            <TouchableOpacity
                              key={oid}
                              style={[styles.itemPickRow, isSel && styles.itemPickRowSelected]}
                              onPress={() => setSelectedTxId(oid)}
                            >
                              <BootstrapIcon
                                name={isSel ? 'check-circle-fill' : 'circle'}
                                size={14}
                                color={isSel ? '#EA580C' : '#94A3B8'}
                              />
                              <View style={{ flex: 1 }}>
                                <Text style={styles.itemPickTitle}>#{oid}</Text>
                                <Text style={styles.itemPickSub}>{o.items_summary || 'Order package'}</Text>
                              </View>
                              <Text style={styles.itemPickStatus}>{o.status}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}

                    {selectedTxType === 'booking' && (
                      <View style={styles.selectorWrap}>
                        {recentBookings.slice(0, 4).map((b) => {
                          const bid = b.booking_id || b.id;
                          const isSel = selectedTxId === bid;
                          return (
                            <TouchableOpacity
                              key={bid}
                              style={[styles.itemPickRow, isSel && styles.itemPickRowSelected]}
                              onPress={() => setSelectedTxId(bid)}
                            >
                              <BootstrapIcon
                                name={isSel ? 'check-circle-fill' : 'circle'}
                                size={14}
                                color={isSel ? '#EA580C' : '#94A3B8'}
                              />
                              <View style={{ flex: 1 }}>
                                <Text style={styles.itemPickTitle}>{b.service_title || 'PMS Service'}</Text>
                                <Text style={styles.itemPickSub}>#{bid}</Text>
                              </View>
                              <Text style={styles.itemPickStatus}>{b.status}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                )}

                {/* 4. Message Textarea */}
                <Text style={styles.label}>YOUR MESSAGE / EXPERIENCE DETAILS *</Text>
                <TextInput
                  style={styles.textArea}
                  placeholder="Describe your experience, what went well, or what problem occurred in detail..."
                  placeholderTextColor="#94A3B8"
                  multiline={true}
                  numberOfLines={5}
                  value={message}
                  onChangeText={setMessage}
                />
              </ScrollView>

              {/* Footer */}
              <View style={styles.footer}>
                <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.8}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitBtn, (!message.trim() || isSubmitting) && { opacity: 0.6 }]}
                  onPress={handleSubmit}
                  disabled={!message.trim() || isSubmitting}
                  activeOpacity={0.85}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <BootstrapIcon name="send-fill" size={13} color="#FFFFFF" />
                      <Text style={styles.submitBtnText}>Submit to MotoTrack</Text>
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
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  headerSub: {
    fontFamily: 'Inter',
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    padding: 20,
    flex: 1,
  },
  label: {
    fontFamily: 'Inter',
    fontSize: 10.5,
    fontWeight: '600',
    color: '#475569',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    cursor: 'pointer',
  },
  catPillText: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '500',
    color: '#334155',
  },
  ratingSection: {
    marginBottom: 16,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  clearRatingText: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: '#64748B',
    textDecorationLine: 'underline',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  starTouch: {
    padding: 2,
    cursor: 'pointer',
  },
  ratingHint: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '600',
    color: '#D97706',
    marginLeft: 6,
  },
  txSection: {
    marginBottom: 16,
  },
  txTabs: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  txTab: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    backgroundColor: '#F1F5F9',
  },
  txTabActive: {
    backgroundColor: '#EA580C',
  },
  txTabText: {
    fontFamily: 'Inter',
    fontSize: 11.5,
    fontWeight: '500',
    color: '#475569',
  },
  txTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  selectorWrap: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    overflow: 'hidden',
  },
  itemPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  itemPickRowSelected: {
    backgroundColor: '#FFF7ED',
  },
  itemPickTitle: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  itemPickSub: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: '#64748B',
  },
  itemPickStatus: {
    fontFamily: 'Inter',
    fontSize: 10.5,
    fontWeight: '600',
    color: '#059669',
  },
  textArea: {
    fontFamily: 'Inter',
    fontSize: 12.5,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 12,
    minHeight: 110,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  cancelBtnText: {
    fontFamily: 'Inter',
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 6,
    backgroundColor: '#EA580C',
  },
  submitBtnText: {
    fontFamily: 'Inter',
    fontSize: 12.5,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 14,
  },
  errorText: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: '#DC2626',
    flex: 1,
  },
});

