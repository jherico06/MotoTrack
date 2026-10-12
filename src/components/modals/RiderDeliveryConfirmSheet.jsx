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
import { colors } from '../../styles/theme.js';
import { describeRiderDeliveryDate, formatRiderDayLabel } from '../../utils/deliveryDate.js';

function formatPhpExact(amount) {
  const n = Number(amount) || 0;
  return `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function paymentLabel(delivery) {
  const method = String(delivery?.paymentMethod || '');
  const status = String(delivery?.paymentStatus || '');
  if (/cod|cash on delivery/i.test(method) || /cod/i.test(status)) {
    return status || 'Unpaid (COD)';
  }
  return status || method || '—';
}

function shortPayment(delivery) {
  const method = String(delivery?.paymentMethod || '');
  const status = String(delivery?.paymentStatus || '');
  if (/cod|cash on delivery/i.test(`${method} ${status}`)) return 'COD';
  return status || method || '—';
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
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
  const when = describeRiderDeliveryDate(delivery?.expectedDeliveryAt, delivery?.expectedDeliveryEndAt);
  const deliveredLabel = formatRiderDayLabel(success?.deliveredAt || new Date());

  return (
    <Modal visible={Boolean(visible)} animationType="slide" onRequestClose={success ? onDone : onCancel}>
      <SafeAreaView style={styles.safe}>
        {success ? (
          <View style={styles.successWrap}>
            <View style={styles.successIcon}>
              <BootstrapIcon name="check-circle-fill" size={36} color={colors.success} />
            </View>
            <Text style={styles.successTitle}>Delivery Confirmed</Text>
            <Text style={styles.orderLine}>Order #{success.orderId}</Text>
            <View style={styles.card}>
              <Row label="Customer" value={success.customerName} />
              <Row label="Delivered" value={deliveredLabel} />
              <Row label="Amount" value={formatPhpExact(success.totalAmount)} />
              <Row label="Payment" value={shortPayment(success)} />
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={onDone} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Back to Active Route</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.kicker}>Confirm drop-off</Text>
            <Text style={styles.title}>Order #{delivery?.orderId || '—'}</Text>
            <Text style={styles.sub}>Review this delivery, then confirm only after the customer receives it.</Text>

            {hintMismatch ? (
              <View style={styles.note}>
                <BootstrapIcon name="info-circle" size={14} color={colors.info} />
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
              <Row label="Customer" value={delivery?.customerName} />
              <Row label="Delivery address" value={delivery?.customerAddress || 'No address on file'} />
              <Row label="Total" value={formatPhpExact(delivery?.totalAmount)} />
              <Row label="Payment" value={paymentLabel(delivery)} />
              <Row label="Delivery date" value={when?.dateLabel || 'Not scheduled'} />
              {when?.timeLabel ? <Row label="Scheduled" value={when.timeLabel} /> : null}
              <Row label="Status" value={delivery?.deliveryStatus || '—'} />
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onCancel}
                disabled={confirming}
                activeOpacity={0.85}
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
                  <ActivityIndicator color={colors.white} />
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
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { padding: 20, paddingBottom: 36, maxWidth: 560, width: '100%', alignSelf: 'center' },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.brand,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, marginTop: 6 },
  sub: { fontSize: 14, color: colors.textMuted, marginTop: 6, lineHeight: 20 },
  card: {
    marginTop: 16,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  row: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  rowValue: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 4, lineHeight: 22 },
  note: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.infoSoft,
    borderRadius: 12,
    padding: 12,
    alignItems: 'flex-start',
  },
  noteText: { flex: 1, fontSize: 13, color: colors.info, lineHeight: 18, fontWeight: '600' },
  errorBox: {
    marginTop: 14,
    backgroundColor: colors.dangerSoft,
    borderRadius: 12,
    padding: 12,
  },
  errorText: { color: colors.dangerText, fontWeight: '700', fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancelBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  cancelBtnText: { fontWeight: '800', color: colors.textSecondary, fontSize: 15 },
  confirmBtn: {
    flex: 1.4,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: { color: colors.white, fontWeight: '800', fontSize: 15 },
  btnDisabled: { opacity: 0.7 },
  successWrap: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  successTitle: {
    marginTop: 16,
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  orderLine: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: colors.brand,
  },
  primaryBtn: {
    marginTop: 20,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: colors.white, fontWeight: '800', fontSize: 15 },
});
