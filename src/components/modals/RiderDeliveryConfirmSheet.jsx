import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  Modal,
  ActivityIndicator,
  SafeAreaView,
  Platform,
} from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon.jsx';
import {
  describeRiderDeliveryDate,
  formatRiderDayLabel,
  formatExpectedDateRangeLabel,
  formatExpectedDateLabel,
} from '../../utils/deliveryDate.js';
import { useTheme } from '../../context/ThemeContext.jsx';

function formatPhpExact(amount) {
  const n = Number(amount) || 0;
  return `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function paymentLabel(delivery) {
  const method = String(delivery?.paymentMethod || delivery?.payment_method || '').trim();
  const status = String(delivery?.paymentStatus || delivery?.payment_status || '').trim();
  const isCod = /cod|cash\s*on\s*delivery/i.test(`${method} ${status}`);
  if (isCod) {
    if (/paid/i.test(status) && !/unpaid/i.test(status)) {
      return 'Paid (COD)';
    }
    return 'Unpaid (COD)';
  }
  if (/gcash/i.test(method) || /gcash/i.test(status)) {
    return 'Paid (GCash)';
  }
  if (status && method) return `${status} (${method})`;
  return status || method || 'Unpaid (COD)';
}

function shortPayment(delivery) {
  const method = String(delivery?.paymentMethod || delivery?.payment_method || '');
  const status = String(delivery?.paymentStatus || delivery?.payment_status || '');
  if (/cod|cash on delivery/i.test(`${method} ${status}`)) return 'COD';
  return status || method || '—';
}

function getDeliveryDateDisplay(delivery) {
  const start = delivery?.expectedDeliveryAt || delivery?.expected_delivery_at;
  const end = delivery?.expectedDeliveryEndAt || delivery?.expected_delivery_end_at;
  if (start) {
    const when = describeRiderDeliveryDate(start, end);
    if (when?.dateLabel) return when.dateLabel;
    const range = formatExpectedDateRangeLabel(start, end);
    if (range) return range;
    const single = formatExpectedDateLabel(start);
    if (single) return single;
  }
  if (delivery?.deliveryDate) return String(delivery.deliveryDate);
  if (delivery?.delivery_date) return String(delivery.delivery_date);

  // Clean fallback range matching standard delivery window
  const now = new Date();
  const startLabel = formatRiderDayLabel(now);
  const later = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);
  const endLabel = formatRiderDayLabel(later);
  return `${startLabel} – ${endLabel}`;
}

function Row({ label, value, isLast, isDark }) {
  return (
    <View style={[styles.row, isDark && styles.rowDark, isLast && styles.rowLast]}>
      <Text style={[styles.rowLabel, isDark && styles.rowLabelDark]}>{label}</Text>
      <Text style={[styles.rowValue, isDark && styles.rowValueDark]}>{value || '—'}</Text>
    </View>
  );
}

export default function RiderDeliveryConfirmSheet({
  visible,
  delivery,
  hintMismatch,
  confirming,
  error,
  success,
  proofPhoto,
  onPickProofPhoto,
  onClearProofPhoto,
  onCancel,
  onConfirm,
  onDone,
}) {
  const { isDarkMode } = useTheme();
  const isDark = Platform.OS === 'web' && isDarkMode;
  const cleanOrderId = String(
    delivery?.orderId || delivery?.order_id || success?.orderId || success?.order_id || '—'
  ).replace(/^#+/, '');
  const deliveredLabel = formatRiderDayLabel(success?.deliveredAt || new Date());
  const deliveryStatusText = String(
    delivery?.deliveryStatus || delivery?.status || 'Out for Delivery'
  ).trim();
  const effectiveProofPhoto =
    proofPhoto || delivery?.deliveryPhoto || delivery?.delivery_photo || null;
  const hasProofPhoto = Boolean(effectiveProofPhoto);

  return (
    <Modal
      visible={Boolean(visible)}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={success ? onDone : onCancel}
    >
      <SafeAreaView style={[styles.safe, isDark && styles.safeDark]}>
        {success ? (
          <View style={styles.successWrap}>
            <View style={[styles.successIcon, isDark && styles.successIconDark]}>
              <BootstrapIcon name="check-circle-fill" size={40} color={isDark ? '#00C98D' : '#10B981'} />
            </View>
            <Text style={[styles.successTitle, isDark && styles.successTitleDark]}>Delivery Confirmed</Text>
            <Text style={[styles.orderLine, isDark && styles.orderLineDark]}>Order #{cleanOrderId}</Text>
            <View style={[styles.card, isDark && styles.cardDark]}>
              <Row label="CUSTOMER" value={success.customerName || success.customer_name} isDark={isDark} />
              <Row label="DELIVERED" value={deliveredLabel} isDark={isDark} />
              <Row label="TOTAL" value={formatPhpExact(success.totalAmount ?? success.total_amount)} isDark={isDark} />
              <Row label="PAYMENT" value={shortPayment(success)} isLast isDark={isDark} />
            </View>
            <TouchableOpacity style={[styles.doneBtn, isDark && styles.doneBtnDark]} onPress={onDone} activeOpacity={0.85}>
              <Text style={styles.doneBtnText}>Back to Active Route</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={[styles.kicker, isDark && styles.kickerDark]}>CONFIRM DROP-OFF</Text>
            <Text style={[styles.title, isDark && styles.titleDark]}>Order #{cleanOrderId}</Text>
            <Text style={[styles.sub, isDark && styles.subDark]}>Review this delivery, then confirm only after the customer receives it.</Text>

            {hintMismatch ? (
              <View style={[styles.note, isDark && styles.noteDark]}>
                <BootstrapIcon name="info-circle" size={14} color={isDark ? '#60A5FA' : '#0284C7'} />
                <Text style={[styles.noteText, isDark && styles.noteTextDark]}>
                  This QR belongs to this order. Confirm only if this is the parcel you just delivered.
                </Text>
              </View>
            ) : null}

            {error ? (
              <View style={[styles.errorBox, isDark && styles.errorBoxDark]}>
                <Text style={[styles.errorText, isDark && styles.errorTextDark]}>{error}</Text>
              </View>
            ) : null}

            <View style={[styles.card, isDark && styles.cardDark]}>
              <Row
                label="CUSTOMER"
                value={delivery?.customerName || delivery?.customer_name}
                isDark={isDark}
              />
              <Row
                label="DELIVERY ADDRESS"
                value={
                  delivery?.customerAddress ||
                  delivery?.customer_address ||
                  delivery?.shipping_address ||
                  'No address on file'
                }
                isDark={isDark}
              />
              <Row
                label="TOTAL"
                value={formatPhpExact(delivery?.totalAmount ?? delivery?.total_amount ?? delivery?.total)}
                isDark={isDark}
              />
              <Row
                label="PAYMENT"
                value={paymentLabel(delivery)}
                isDark={isDark}
              />
              <Row
                label="DELIVERY DATE"
                value={getDeliveryDateDisplay(delivery)}
                isDark={isDark}
              />
              <Row
                label="STATUS"
                value={deliveryStatusText}
                isLast
                isDark={isDark}
              />
            </View>

            {/* Proof of Delivery Photo Card (Required before confirmation) */}
            <View style={[styles.proofCard, isDark && styles.cardDark]}>
              <View style={styles.proofHeaderRow}>
                <Text style={[styles.rowLabel, isDark && styles.rowLabelDark]}>
                  PROOF OF DELIVERY PHOTO *
                </Text>
                <View
                  style={[
                    styles.proofBadge,
                    hasProofPhoto ? styles.proofBadgeReady : styles.proofBadgeRequired,
                  ]}
                >
                  <Text
                    style={[
                      styles.proofBadgeText,
                      { color: hasProofPhoto ? '#059669' : '#EA580C' },
                    ]}
                  >
                    {hasProofPhoto ? 'Attached' : 'Required'}
                  </Text>
                </View>
              </View>

              {effectiveProofPhoto ? (
                <View style={styles.proofPreviewWrap}>
                  <Image
                    source={{ uri: effectiveProofPhoto }}
                    style={styles.proofImage}
                    resizeMode="cover"
                  />
                  <View style={styles.proofActionRow}>
                    <TouchableOpacity
                      style={[styles.proofChangeBtn, isDark && styles.cancelBtnDark]}
                      onPress={onPickProofPhoto}
                      disabled={confirming}
                      activeOpacity={0.8}
                    >
                      <BootstrapIcon name="camera" size={14} color={isDark ? '#F2F2F3' : '#0F172A'} />
                      <Text style={[styles.proofChangeText, isDark && styles.cancelBtnTextDark]}>
                        Change photo
                      </Text>
                    </TouchableOpacity>
                    {proofPhoto && typeof onClearProofPhoto === 'function' ? (
                      <TouchableOpacity
                        style={styles.proofRemoveBtn}
                        onPress={onClearProofPhoto}
                        disabled={confirming}
                        activeOpacity={0.8}
                      >
                        <BootstrapIcon name="trash" size={14} color="#DC2626" />
                        <Text style={styles.proofRemoveText}>Remove</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.proofDropzone, isDark && styles.proofDropzoneDark]}
                  onPress={onPickProofPhoto}
                  disabled={confirming}
                  activeOpacity={0.8}
                >
                  <View style={styles.proofCamCircle}>
                    <BootstrapIcon name="camera-fill" size={20} color="#EA580C" />
                  </View>
                  <Text style={[styles.proofDropTitle, isDark && styles.rowValueDark]}>
                    Attach proof of delivery photo
                  </Text>
                  <Text style={[styles.proofDropSub, isDark && styles.subDark]}>
                    Required before you can confirm this drop-off
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {!hasProofPhoto ? (
              <View style={styles.proofHintRow}>
                <BootstrapIcon name="exclamation-circle" size={13} color="#EA580C" />
                <Text style={styles.proofHintText}>
                  Please attach a proof of delivery photo to confirm delivery.
                </Text>
              </View>
            ) : null}

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.cancelBtn, isDark && styles.cancelBtnDark]}
                onPress={onCancel}
                disabled={confirming}
                activeOpacity={0.7}
              >
                <Text style={[styles.cancelBtnText, isDark && styles.cancelBtnTextDark]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  isDark && styles.confirmBtnDark,
                  (confirming || !hasProofPhoto) && styles.btnDisabled,
                ]}
                onPress={onConfirm}
                disabled={confirming || !hasProofPhoto}
                activeOpacity={0.85}
              >
                {confirming ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.confirmBtnText}>Confirm Delivery</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  kicker: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 6,
    letterSpacing: -0.5,
  },
  sub: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 6,
    lineHeight: 20,
  },
  card: {
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    paddingHorizontal: 20,
    paddingVertical: 4,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  row: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  rowValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 4,
    lineHeight: 22,
  },
  note: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#E0F2FE',
    borderRadius: 12,
    padding: 12,
    alignItems: 'flex-start',
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    color: '#0284C7',
    lineHeight: 18,
    fontWeight: '600',
  },
  errorBox: {
    marginTop: 14,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    alignItems: 'center',
  },
  cancelBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  cancelBtnText: {
    fontWeight: '700',
    color: '#0F172A',
    fontSize: 15,
  },
  confirmBtn: {
    flex: 1.35,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  proofCard: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  proofHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  proofBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  proofBadgeRequired: {
    backgroundColor: '#FFF7ED',
  },
  proofBadgeReady: {
    backgroundColor: '#ECFDF5',
  },
  proofBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  proofDropzone: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    paddingVertical: 20,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  proofDropzoneDark: {
    borderColor: '#334155',
    backgroundColor: '#202124',
  },
  proofCamCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  proofDropTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  proofDropSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  proofPreviewWrap: {
    gap: 10,
  },
  proofImage: {
    width: '100%',
    height: 180,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
  },
  proofActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  proofChangeBtn: {
    flex: 1,
    height: 40,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  proofChangeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  proofRemoveBtn: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  proofRemoveText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
  },
  proofHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 4,
  },
  proofHintText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#EA580C',
  },
  successWrap: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  successTitle: {
    marginTop: 16,
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  orderLine: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: '#EA580C',
  },
  doneBtn: {
    marginTop: 20,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  safeDark: {
    backgroundColor: '#111315',
  },
  kickerDark: {
    color: '#A1A1AA',
  },
  titleDark: {
    color: '#F5F5F5',
  },
  subDark: {
    color: '#A1A1AA',
  },
  cardDark: {
    backgroundColor: '#191A1D',
    borderColor: '#303236',
  },
  rowDark: {
    borderBottomColor: '#292B2F',
  },
  rowLabelDark: {
    color: '#71717A',
  },
  rowValueDark: {
    color: '#F2F2F3',
  },
  noteDark: {
    backgroundColor: 'rgba(59, 130, 246, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  noteTextDark: {
    color: '#60A5FA',
  },
  errorBoxDark: {
    backgroundColor: 'rgba(240, 68, 68, 0.14)',
    borderColor: 'rgba(240, 68, 68, 0.35)',
  },
  errorTextDark: {
    color: '#F87171',
  },
  cancelBtnDark: {
    backgroundColor: '#202124',
    borderColor: '#303236',
  },
  cancelBtnTextDark: {
    color: '#F2F2F3',
  },
  confirmBtnDark: {
    backgroundColor: '#FF5A00',
  },
  successIconDark: {
    backgroundColor: 'rgba(0, 201, 141, 0.14)',
  },
  successTitleDark: {
    color: '#F5F5F5',
  },
  orderLineDark: {
    color: '#FF5A00',
  },
  doneBtnDark: {
    backgroundColor: '#FF5A00',
  },
});
