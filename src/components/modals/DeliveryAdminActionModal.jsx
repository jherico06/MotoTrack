import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon';
import { deliveryService } from '../../services/deliveryService';

/**
 * Admin records a rider drop-off report, confirms delivery, or logs a delivery issue.
 */
export default function DeliveryAdminActionModal({
  visible,
  mode = 'rider_report',
  order,
  adminUser,
  onClose,
  onSuccess,
  showToast,
}) {
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const isMarkDelivered = mode === 'mark_delivered';
  const isIssue = mode === 'delivery_issue';
  const orderId = order?.order_id || order?.id;
  const riderName = order?.rider_name || 'the assigned rider';

  useEffect(() => {
    if (visible) {
      setNotes('');
      setBusy(false);
    }
  }, [visible, mode, orderId]);

  const handleSubmit = async () => {
    if ((isMarkDelivered || isIssue) && !String(notes || '').trim()) {
      showToast?.(
        isIssue
          ? 'Enter notes describing the delivery issue'
          : 'Enter a reason to confirm this order as delivered'
      );
      return;
    }
    setBusy(true);
    try {
      let res;
      if (isMarkDelivered) {
        res = await deliveryService.adminMarkDelivered({
          orderId,
          reason: notes.trim(),
          adminUser,
        });
      } else if (isIssue) {
        res = await deliveryService.markDeliveryIssue(orderId, adminUser, notes.trim());
      } else {
        res = await deliveryService.reportRiderDelivered({
          orderId,
          notes: notes.trim(),
          adminUser,
        });
      }
      if (!res.success) {
        showToast?.(res.error || 'Action failed');
        return;
      }
      showToast?.(
        isMarkDelivered
          ? 'Order confirmed as Delivered'
          : isIssue
            ? 'Marked as Delivery Issue — previous QR invalidated'
            : 'Marked Delivery Reported — review then Confirm Delivery'
      );
      onSuccess?.(res);
      onClose?.();
    } catch (e) {
      showToast?.(e?.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {isMarkDelivered
                ? 'Confirm Delivery'
                : isIssue
                  ? 'Delivery Issue'
                  : 'Mark Delivery Reported'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} disabled={busy}>
              <BootstrapIcon name="x-lg" size={14} color="#64748b" />
            </TouchableOpacity>
          </View>

          <Text style={styles.body}>
            {isMarkDelivered
              ? `Confirm delivery for order #${orderId}. This changes Delivery Reported → Delivered.`
              : isIssue
                ? `Flag a problem with order #${orderId}. The confirmation QR will be invalidated.`
                : `Record that ${riderName} confirmed drop-off for order #${orderId} (moves to Delivery Reported).`}
          </Text>
          <Text style={styles.sub}>
            {isMarkDelivered
              ? 'Review the rider report and optional photo first. A reason is required for the audit trail.'
              : isIssue
                ? 'After logging the issue you can reschedule and generate a new QR for the next attempt.'
                : 'Use this if the rider called instead of scanning the QR. The order becomes Delivery Reported until you Confirm Delivery.'}
          </Text>

          <Text style={styles.label}>
            {isMarkDelivered || isIssue ? 'Notes (required)' : 'Notes (optional)'}
          </Text>
          <TextInput
            style={styles.input}
            value={notes}
            onChangeText={setNotes}
            placeholder={
              isMarkDelivered
                ? 'e.g. Reviewed rider report and photo — customer received package'
                : isIssue
                  ? 'e.g. Customer not home / wrong address / damaged package'
                  : 'e.g. Juan called at 3:40 PM — left with customer'
            }
            placeholderTextColor="#94A3B8"
            multiline
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              isIssue && { backgroundColor: '#B45309' },
              busy && { opacity: 0.7 },
            ]}
            onPress={handleSubmit}
            disabled={busy}
            activeOpacity={0.9}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {isMarkDelivered
                  ? 'Confirm Delivery'
                  : isIssue
                    ? 'Mark Delivery Issue'
                    : 'Mark Delivery Reported'}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={onClose} disabled={busy} activeOpacity={0.85}>
            <Text style={styles.secondaryBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    ...Platform.select({
      web: { boxShadow: '0 20px 40px rgba(15,23,42,0.18)' },
      default: { elevation: 8 },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: { fontSize: 16, fontWeight: '800', color: '#0F172A', flex: 1, paddingRight: 8 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
  sub: { fontSize: 12.5, color: '#64748B', lineHeight: 18, marginBottom: 14 },
  label: { fontSize: 11, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 13.5,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    minHeight: 88,
    marginBottom: 14,
  },
  primaryBtn: {
    backgroundColor: '#0C6258',
    borderRadius: 12,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  secondaryBtn: {
    borderRadius: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  secondaryBtnText: { color: '#64748B', fontWeight: '700', fontSize: 13 },
});
