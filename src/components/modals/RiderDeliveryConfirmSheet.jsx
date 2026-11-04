import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon.jsx';
import {
  describeRiderDeliveryDate,
  formatRiderDayLabel,
  formatExpectedDateRangeLabel,
  formatExpectedDateLabel,
} from '../../utils/deliveryDate.js';

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

function Row({ label, value, isLast }) {
  return (
    <View style={[styles.row, isLast && styles.rowLast]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value || '—'}</Text>
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
  onCancel,
  onConfirm,
  onDone,
}) {
  const cleanOrderId = String(
    delivery?.orderId || delivery?.order_id || success?.orderId || success?.order_id || '—'
  ).replace(/^#+/, '');
  const deliveredLabel = formatRiderDayLabel(success?.deliveredAt || new Date());
  const deliveryStatusText = String(
    delivery?.deliveryStatus || delivery?.status || 'Out for Delivery'
  ).trim();

  return (
    <Modal
      visible={Boolean(visible)}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={success ? onDone : onCancel}
    >
      <SafeAreaView style={styles.safe}>
        {success ? (
          <View style={styles.successWrap}>
            <View style={styles.successIcon}>
              <BootstrapIcon name="check-circle-fill" size={40} color="#10B981" />
            </View>
            <Text style={styles.successTitle}>Delivery Confirmed</Text>
            <Text style={styles.orderLine}>Order #{cleanOrderId}</Text>
            <View style={styles.card}>
              <Row label="CUSTOMER" value={success.customerName || success.customer_name} />
              <Row label="DELIVERED" value={deliveredLabel} />
              <Row label="TOTAL" value={formatPhpExact(success.totalAmount ?? success.total_amount)} />
              <Row label="PAYMENT" value={shortPayment(success)} isLast />
            </View>
            <TouchableOpacity style={styles.doneBtn} onPress={onDone} activeOpacity={0.85}>
              <Text style={styles.doneBtnText}>Back to Active Route</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.kicker}>CONFIRM DROP-OFF</Text>
            <Text style={styles.title}>Order #{cleanOrderId}</Text>
            <Text style={styles.sub}>Review this delivery, then confirm only after the customer receives it.</Text>

            {hintMismatch ? (
              <View style={styles.note}>
                <BootstrapIcon name="info-circle" size={14} color="#0284C7" />
                <Text style={styles.noteText}>
                  This QR belongs to this order. Confirm only if this is the parcel you just delivered.
                </Text>
              </View>
            ) : null}

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.card}>
              <Row
                label="CUSTOMER"
                value={delivery?.customerName || delivery?.customer_name}
              />
              <Row
                label="DELIVERY ADDRESS"
                value={
                  delivery?.customerAddress ||
                  delivery?.customer_address ||
                  delivery?.shipping_address ||
                  'No address on file'
                }
              />
              <Row
                label="TOTAL"
                value={formatPhpExact(delivery?.totalAmount ?? delivery?.total_amount ?? delivery?.total)}
              />
              <Row
                label="PAYMENT"
                value={paymentLabel(delivery)}
              />
              <Row
                label="DELIVERY DATE"
                value={getDeliveryDateDisplay(delivery)}
              />
              <Row
                label="STATUS"
                value={deliveryStatusText}
                isLast
              />
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onCancel}
                disabled={confirming}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, confirming && styles.btnDisabled]}
                onPress={onConfirm}
                disabled={confirming}
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
    opacity: 0.7,
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
});
