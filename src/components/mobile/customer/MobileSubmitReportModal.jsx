import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { BootstrapIcon } from '../../common/BootstrapIcon.jsx';
import { ratingsReportsService } from '../../../services/feedback/ratingsReportsService.js';
import { useCart } from '../../../context/CartContext.jsx';
import { useTheme } from '../../../context/ThemeContext.jsx';
import { fontFamily, fontWeights } from '../../../styles/typography.js';

const REPORT_CATEGORIES_LIST = [
  { id: 'service_quality', label: 'Service Quality', icon: 'tools', color: '#8B5CF6' },
  { id: 'mechanic_experience', label: 'Mechanic Experience', icon: 'person-badge', color: '#F59E0B' },
  { id: 'product_quality', label: 'Product Quality', icon: 'box-seam', color: '#3B82F6' },
  { id: 'delivery', label: 'Delivery & Shipping', icon: 'truck', color: '#10B981' },
  { id: 'order_issues', label: 'Order Issues', icon: 'receipt', color: '#EF4444' },
  { id: 'payment_issues', label: 'Payment Issues', icon: 'credit-card', color: '#EC4899' },
  { id: 'general_feedback', label: 'General Feedback', icon: 'chat-square-text', color: '#64748B' },
];

export default function MobileSubmitReportModal({
  visible = false,
  currentUser = null,
  recentOrders = [],
  recentBookings = [],
  initialOrder = null,
  onClose = () => {},
  onSubmitSuccess = () => {},
  isDarkMode: isDarkProp,
}) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;
  const { showToast } = useCart();
  const { isDarkMode: themeDark = false } = useTheme?.() || {};
  const isDarkMode = typeof isDarkProp === 'boolean' ? isDarkProp : Boolean(themeDark);
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);

  const [selectedCategory, setSelectedCategory] = useState('general_feedback');
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const [selectedTxType, setSelectedTxType] = useState('general');
  const [selectedTxId, setSelectedTxId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Explicit height prevents flex: 1 ScrollView inside native bottom sheets from collapsing to 0px
  const sheetHeight = Math.round(windowHeight * (isDesktop ? 0.82 : 0.85));

  useEffect(() => {
    if (visible && initialOrder) {
      setSelectedTxType('order');
      setSelectedTxId(initialOrder.order_id || initialOrder.id || '');
      setSelectedCategory('order_issues');
    } else if (visible && !initialOrder) {
      setSelectedTxType('general');
      setSelectedTxId('');
    }
    if (visible) {
      setErrorMsg('');
    }
  }, [initialOrder, visible]);

  if (!visible) return null;

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
    <Modal
      visible={visible}
      transparent
      animationType={isDesktop ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.backdrop, isDesktop ? styles.backdropDesktop : styles.backdropMobile]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={onClose}
          />
          <View
            style={[
              styles.modalCard,
              isDesktop ? styles.modalCardDesktop : styles.modalCardMobile,
              { height: sheetHeight },
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.headerIconWrap}>
                  <BootstrapIcon name="chat-square-text-fill" size={16} color="#EA580C" />
                </View>
                <View style={styles.headerTextWrap}>
                  <Text style={styles.headerTitle} numberOfLines={1}>
                    Feedback & Experience Report
                  </Text>
                  <Text style={styles.headerSub} numberOfLines={1}>
                    Help us improve your MotoTrack experience
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                activeOpacity={0.75}
                accessibilityLabel="Close report modal"
              >
                <BootstrapIcon name="x-lg" size={14} color={isDarkMode ? '#A1A1AA' : '#64748B'} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              {errorMsg ? (
                <View style={styles.errorBanner}>
                  <BootstrapIcon
                    name="exclamation-circle-fill"
                    size={14}
                    color={isDarkMode ? '#F04444' : '#DC2626'}
                  />
                  <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
              ) : null}

              {/* 1. Category Selector */}
              <Text style={styles.label}>WHAT IS THIS REGARDING? *</Text>
              <View style={styles.categoryGrid}>
                {REPORT_CATEGORIES_LIST.map((cat) => {
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.catPill,
                        isSelected && {
                          borderColor: cat.color,
                          backgroundColor: cat.color + (isDarkMode ? '26' : '15'),
                        },
                      ]}
                      onPress={() => setSelectedCategory(cat.id)}
                      activeOpacity={0.8}
                    >
                      <BootstrapIcon
                        name={cat.icon}
                        size={13}
                        color={isSelected ? cat.color : isDarkMode ? '#A1A1AA' : '#64748B'}
                      />
                      <Text
                        style={[
                          styles.catPillText,
                          isSelected && { color: cat.color, fontWeight: fontWeights.semiBold },
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
                <View style={styles.ratingHeaderRow}>
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
                        color={star <= rating ? '#F59E0B' : isDarkMode ? '#333A42' : '#CBD5E1'}
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
                      <Text
                        style={[
                          styles.txTabText,
                          selectedTxType === 'general' && styles.txTabTextActive,
                        ]}
                      >
                        General
                      </Text>
                    </TouchableOpacity>

                    {recentOrders.length > 0 && (
                      <TouchableOpacity
                        style={[styles.txTab, selectedTxType === 'order' && styles.txTabActive]}
                        onPress={() => {
                          setSelectedTxType('order');
                          if (recentOrders[0]) {
                            setSelectedTxId(recentOrders[0].order_id || recentOrders[0].id);
                          }
                        }}
                      >
                        <Text
                          style={[
                            styles.txTabText,
                            selectedTxType === 'order' && styles.txTabTextActive,
                          ]}
                        >
                          Order ({recentOrders.length})
                        </Text>
                      </TouchableOpacity>
                    )}

                    {recentBookings.length > 0 && (
                      <TouchableOpacity
                        style={[styles.txTab, selectedTxType === 'booking' && styles.txTabActive]}
                        onPress={() => {
                          setSelectedTxType('booking');
                          if (recentBookings[0]) {
                            setSelectedTxId(recentBookings[0].booking_id || recentBookings[0].id);
                          }
                        }}
                      >
                        <Text
                          style={[
                            styles.txTabText,
                            selectedTxType === 'booking' && styles.txTabTextActive,
                          ]}
                        >
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
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={styles.itemPickTitle} numberOfLines={1}>
                                #{oid}
                              </Text>
                              <Text style={styles.itemPickSub} numberOfLines={1}>
                                {o.items_summary || o.itemsSummary || 'Order package'}
                              </Text>
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
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={styles.itemPickTitle} numberOfLines={1}>
                                {b.service_title || b.serviceName || 'PMS Service'}
                              </Text>
                              <Text style={styles.itemPickSub} numberOfLines={1}>
                                #{bid}
                              </Text>
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
                multiline
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
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (isDarkMode) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: isDarkMode ? 'rgba(2, 6, 23, 0.72)' : 'rgba(15, 23, 42, 0.6)',
    },
    backdropDesktop: {
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    backdropMobile: {
      justifyContent: 'flex-end',
      alignItems: 'stretch',
      padding: 0,
    },
    modalCard: {
      width: '100%',
      backgroundColor: isDarkMode ? '#191A1D' : '#FFFFFF',
      overflow: 'hidden',
      flexDirection: 'column',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDarkMode ? 0.45 : 0.15,
      shadowRadius: 24,
      elevation: 8,
      borderWidth: 1,
      borderColor: isDarkMode ? '#303236' : '#E2E8F0',
    },
    modalCardDesktop: {
      maxWidth: 620,
      maxHeight: '88%',
      borderRadius: 24,
    },
    modalCardMobile: {
      maxWidth: '100%',
      maxHeight: '92%',
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? '#303236' : '#E2E8F0',
      backgroundColor: isDarkMode ? '#191A1D' : '#FFFFFF',
    },
    headerLeft: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    headerIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: isDarkMode ? 'rgba(234, 88, 12, 0.16)' : '#FFF7ED',
      borderWidth: isDarkMode ? 1 : 0,
      borderColor: isDarkMode ? 'rgba(251, 146, 60, 0.35)' : 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    headerTextWrap: {
      flex: 1,
      minWidth: 0,
    },
    headerTitle: {
      fontFamily: fontFamily.sans,
      fontSize: 16,
      fontWeight: fontWeights.semiBold,
      color: isDarkMode ? '#F2F2F3' : '#0F172A',
      letterSpacing: -0.2,
    },
    headerSub: {
      fontFamily: fontFamily.sans,
      fontSize: 11.5,
      color: '#94A3B8',
      marginTop: 2,
    },
    closeBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: isDarkMode ? '#202124' : '#F1F5F9',
      borderWidth: isDarkMode ? 1 : 0,
      borderColor: isDarkMode ? '#303236' : 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    scrollArea: {
      flex: 1,
      backgroundColor: isDarkMode ? '#191A1D' : '#FFFFFF',
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 28,
    },
    label: {
      fontFamily: fontFamily.sans,
      fontSize: 10.5,
      fontWeight: fontWeights.semiBold,
      color: isDarkMode ? '#A1A1AA' : '#475569',
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
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDarkMode ? '#303236' : '#E2E8F0',
      backgroundColor: isDarkMode ? '#18181B' : '#F8FAFC',
    },
    catPillText: {
      fontFamily: fontFamily.sans,
      fontSize: 12,
      fontWeight: fontWeights.medium,
      color: isDarkMode ? '#F2F2F3' : '#334155',
    },
    ratingSection: {
      marginBottom: 16,
      backgroundColor: isDarkMode ? '#18181B' : '#F8FAFC',
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: isDarkMode ? '#303236' : '#E2E8F0',
    },
    ratingHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    clearRatingText: {
      fontFamily: fontFamily.sans,
      fontSize: 11,
      color: '#94A3B8',
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
    },
    ratingHint: {
      fontFamily: fontFamily.sans,
      fontSize: 12,
      fontWeight: fontWeights.semiBold,
      color: isDarkMode ? '#F5B942' : '#D97706',
      marginLeft: 6,
    },
    txSection: {
      marginBottom: 16,
    },
    txTabs: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 8,
    },
    txTab: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: isDarkMode ? '#202124' : '#F1F5F9',
    },
    txTabActive: {
      backgroundColor: '#EA580C',
    },
    txTabText: {
      fontFamily: fontFamily.sans,
      fontSize: 11.5,
      fontWeight: fontWeights.medium,
      color: isDarkMode ? '#A1A1AA' : '#475569',
    },
    txTabTextActive: {
      color: '#FFFFFF',
      fontWeight: fontWeights.semiBold,
    },
    selectorWrap: {
      borderWidth: 1,
      borderColor: isDarkMode ? '#303236' : '#E2E8F0',
      borderRadius: 8,
      overflow: 'hidden',
    },
    itemPickRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 10,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? '#303236' : '#F1F5F9',
      backgroundColor: isDarkMode ? '#18181B' : '#FFFFFF',
    },
    itemPickRowSelected: {
      backgroundColor: isDarkMode ? 'rgba(234, 88, 12, 0.14)' : '#FFF7ED',
    },
    itemPickTitle: {
      fontFamily: fontFamily.sans,
      fontSize: 12,
      fontWeight: fontWeights.semiBold,
      color: isDarkMode ? '#F2F2F3' : '#0F172A',
    },
    itemPickSub: {
      fontFamily: fontFamily.sans,
      fontSize: 11,
      color: '#94A3B8',
    },
    itemPickStatus: {
      fontFamily: fontFamily.sans,
      fontSize: 10.5,
      fontWeight: fontWeights.semiBold,
      color: isDarkMode ? '#00C98D' : '#059669',
    },
    textArea: {
      fontFamily: fontFamily.sans,
      fontSize: 13,
      color: isDarkMode ? '#F2F2F3' : '#0F172A',
      backgroundColor: isDarkMode ? '#18181B' : '#F8FAFC',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: isDarkMode ? '#333A42' : '#CBD5E1',
      padding: 12,
      minHeight: 110,
      textAlignVertical: 'top',
      marginBottom: 8,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 10,
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: Platform.OS === 'ios' ? 28 : 16,
      borderTopWidth: 1,
      borderTopColor: isDarkMode ? '#303236' : '#E2E8F0',
      backgroundColor: isDarkMode ? '#191A1D' : '#FFFFFF',
    },
    cancelBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: isDarkMode ? '#202124' : '#F1F5F9',
      borderWidth: isDarkMode ? 1 : 0,
      borderColor: isDarkMode ? '#303236' : 'transparent',
    },
    cancelBtnText: {
      fontFamily: fontFamily.sans,
      fontSize: 13,
      fontWeight: fontWeights.semiBold,
      color: isDarkMode ? '#A1A1AA' : '#475569',
    },
    submitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: '#EA580C',
    },
    submitBtnText: {
      fontFamily: fontFamily.sans,
      fontSize: 13,
      fontWeight: fontWeights.semiBold,
      color: '#FFFFFF',
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 10,
      borderRadius: 8,
      backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.14)' : '#FEF2F2',
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(248, 113, 113, 0.35)' : '#FECACA',
      marginBottom: 14,
    },
    errorText: {
      fontFamily: fontFamily.sans,
      fontSize: 12,
      color: isDarkMode ? '#FCA5A5' : '#DC2626',
      flex: 1,
    },
  });
