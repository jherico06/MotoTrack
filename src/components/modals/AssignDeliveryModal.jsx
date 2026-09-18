import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Image,
} from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon';
import { deliveryService } from '../../services/deliveryService';
import { riderService, RIDER_STATUSES, RIDER_ACCOUNT_STATUSES } from '../../services/riderService';
import { orderService } from '../../services/orderService';
import ExpectedDateField from '../common/ExpectedDateField';
import { addDaysDateInput, toDateInputValue } from '../../utils/deliveryDate';

export default function AssignDeliveryModal({
  visible,
  order,
  adminUser,
  onClose,
  onSuccess,
  showToast,
}) {
  const [riders, setRiders] = useState([]);
  const [selectedRiderId, setSelectedRiderId] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualContact, setManualContact] = useState('');
  const [notes, setNotes] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [alsoDispatch, setAlsoDispatch] = useState(true);
  const [loadingRiders, setLoadingRiders] = useState(false);
  const [extraOrders, setExtraOrders] = useState([]);
  const [extraSelected, setExtraSelected] = useState({});

  useEffect(() => {
    if (!visible || !order) return;
    setNotes('');
    setManualName('');
    setManualContact('');
    setManualMode(false);
    setExpectedDate(toDateInputValue(order.expected_delivery_at) || addDaysDateInput(1));
    setAlsoDispatch(true);
    setSelectedRiderId(order.rider_id || '');
    setLoadingRiders(true);
    riderService
      .fetchRiders()
      .then((list) => {
        const available = (list || []).filter(
          (r) =>
            (r.status || '').toLowerCase() !== RIDER_STATUSES.OFF_DUTY.toLowerCase() &&
            (r.accountStatus || RIDER_ACCOUNT_STATUSES.ACTIVE) !== RIDER_ACCOUNT_STATUSES.INACTIVE
        );
        setRiders(available);
        if (order.rider_id && available.some((r) => r.id === order.rider_id)) {
          setSelectedRiderId(order.rider_id);
        } else if (available.length === 1) {
          setSelectedRiderId(available[0].id);
        }
      })
      .finally(() => setLoadingRiders(false));

    const currentId = order?.order_id || order?.id;
    orderService
      .getAllOrders()
      .then((list) => {
        const extras = (list || []).filter((o) => {
          const id = o.order_id || o.id;
          const st = String(o.status || '').toLowerCase();
          return (
            id &&
            id !== currentId &&
            ['processing', 'ready for delivery', 'rescheduled'].includes(st)
          );
        });
        setExtraOrders(extras);
        setExtraSelected({});
      })
      .catch(() => {
        setExtraOrders([]);
        setExtraSelected({});
      });
  }, [visible, order]);

  const orderId = order?.order_id || order?.id;
  const selectedRider = riders.find((r) => r.id === selectedRiderId) || null;
  const canSubmit = manualMode
    ? Boolean(manualName.trim() && manualContact.trim())
    : Boolean(selectedRiderId && selectedRider);

  const handleSubmit = async () => {
    if (!canSubmit) {
      showToast?.(
        manualMode
          ? 'Enter rider name and contact number'
          : 'Select a registered rider or enter name & contact'
      );
      return;
    }
    if (!String(expectedDate || '').trim()) {
      showToast?.('Pick an expected delivery date');
      return;
    }
    setBusy(true);
    try {
      const extraIds = Object.keys(extraSelected).filter((id) => extraSelected[id]);
      const allIds = [orderId, ...extraIds.filter((id) => id && id !== orderId)];
      let lastAssign = null;
      let lastOut = null;

      for (const id of allIds) {
        const assignRes = await deliveryService.assignDelivery({
          orderId: id,
          riderId: manualMode ? null : selectedRiderId,
          riderName: manualMode ? manualName.trim() : undefined,
          riderContact: manualMode ? manualContact.trim() : undefined,
          notes: notes.trim(),
          expectedDate: expectedDate || null,
          adminUser,
        });
        if (!assignRes.success) {
          showToast?.(assignRes.error || `Failed to assign ${id}`);
          return;
        }
        lastAssign = assignRes;
        if (alsoDispatch) {
          const outRes = await deliveryService.markOutForDelivery(id, adminUser);
          if (!outRes.success) {
            showToast?.(outRes.error || `Assigned ${id}, but could not mark Out for Delivery`);
          } else {
            lastOut = outRes;
          }
        }
      }

      if (alsoDispatch && lastOut?.success) {
        showToast?.(
          allIds.length > 1
            ? `${allIds.length} orders assigned — share the rider dashboard link`
            : 'Rider assigned — Out for Delivery. Share the dashboard link.'
        );
        onSuccess?.(lastOut.delivery, {
          token: lastOut.token,
          confirmUrl: lastOut.confirmUrl,
          qrImageUrl: lastOut.qrImageUrl,
          expiresAt: lastOut.expiresAt,
        }, lastAssign?.riderAccess);
      } else {
        showToast?.(
          allIds.length > 1
            ? `${allIds.length} orders assigned to the rider`
            : 'Rider assigned — status Ready for Delivery'
        );
        onSuccess?.(lastAssign?.delivery, null, lastAssign?.riderAccess);
      }
      onClose?.();
    } catch (e) {
      showToast?.(e?.message || 'Delivery assignment failed');
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
            <Text style={styles.title}>Assign Delivery</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} disabled={busy}>
              <BootstrapIcon name="x-lg" size={14} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
            <Text style={styles.meta}>
              Order #{orderId} · {order?.customer_name || 'Customer'}
            </Text>
            <Text style={styles.address} numberOfLines={3}>
              {order?.customer_address || 'No address on file'}
            </Text>

            <Text style={styles.label}>Select Registered Rider *</Text>
            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => {
                setManualMode((v) => !v);
                if (!manualMode) setSelectedRiderId('');
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, manualMode && styles.checkboxOn]}>
                {manualMode ? <BootstrapIcon name="check" size={12} color="#fff" /> : null}
              </View>
              <Text style={styles.checkText}>Record rider name & contact only (no roster entry)</Text>
            </TouchableOpacity>

            {manualMode ? (
              <View style={{ gap: 8, marginBottom: 8 }}>
                <TextInput
                  style={styles.input}
                  value={manualName}
                  onChangeText={setManualName}
                  placeholder="Rider full name *"
                  placeholderTextColor="#94A3B8"
                />
                <TextInput
                  style={styles.input}
                  value={manualContact}
                  onChangeText={setManualContact}
                  placeholder="Rider phone / contact *"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                />
              </View>
            ) : loadingRiders ? (
              <ActivityIndicator color="#0C6258" style={{ marginVertical: 12 }} />
            ) : riders.length === 0 ? (
              <Text style={styles.emptyHint}>
                No riders on roster. Toggle “Record rider name & contact” above, or add staff under
                Admin → Riders.
              </Text>
            ) : (
              <View style={styles.riderList}>
                {riders.map((r) => {
                  const active = r.id === selectedRiderId;
                  return (
                    <TouchableOpacity
                      key={r.id}
                      style={[styles.riderCard, active && styles.riderCardActive]}
                      onPress={() => setSelectedRiderId(r.id)}
                      activeOpacity={0.85}
                    >
                      <Image source={{ uri: r.avatar }} style={styles.riderAvatar} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.riderName}>{r.name}</Text>
                        <Text style={styles.riderSub}>
                          {r.phone}
                          {r.vehicleInfo ? ` · ${r.vehicleInfo}` : ''}
                          {r.plateNumber ? ` · ${r.plateNumber}` : ''}
                        </Text>
                        <Text style={styles.riderStatus}>{r.status || 'Available'}</Text>
                      </View>
                      {active ? <BootstrapIcon name="check-circle-fill" size={18} color="#0C6258" /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {!manualMode && selectedRider ? (
              <View style={styles.summaryBox}>
                <Text style={styles.summaryTitle}>Assigned rider summary</Text>
                <Text style={styles.summaryLine}>{selectedRider.name}</Text>
                <Text style={styles.summaryLine}>{selectedRider.phone}</Text>
                {selectedRider.vehicleInfo ? (
                  <Text style={styles.summaryLine}>
                    {selectedRider.vehicleInfo}
                    {selectedRider.plateNumber ? ` · Plate ${selectedRider.plateNumber}` : ''}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <ExpectedDateField
              value={expectedDate}
              onChange={setExpectedDate}
              label="Expected delivery date"
              hint="This date is shown to the customer on order tracking."
            />

            <Text style={styles.label}>Delivery Notes</Text>
            <TextInput
              style={[styles.input, { minHeight: 72, textAlignVertical: 'top' }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Gate codes, landmarks, special instructions…"
              placeholderTextColor="#94A3B8"
              multiline
            />

            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => setAlsoDispatch((v) => !v)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, alsoDispatch && styles.checkboxOn]}>
                {alsoDispatch ? <BootstrapIcon name="check" size={12} color="#fff" /> : null}
              </View>
              <Text style={styles.checkText}>Also mark Out for Delivery now</Text>
            </TouchableOpacity>

            <Text style={styles.hint}>
              Dispatching generates a packing QR plus a temporary rider dashboard link. No rider account
              required. The dashboard shows every stop assigned to this rider.
            </Text>

            {extraOrders.length > 0 ? (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.label}>Also assign these orders to the same rider</Text>
                {extraOrders.slice(0, 8).map((o) => {
                  const id = o.order_id || o.id;
                  const on = Boolean(extraSelected[id]);
                  return (
                    <TouchableOpacity
                      key={id}
                      style={styles.checkRow}
                      onPress={() => setExtraSelected((prev) => ({ ...prev, [id]: !prev[id] }))}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.checkbox, on && styles.checkboxOn]}>
                        {on ? <BootstrapIcon name="check" size={12} color="#fff" /> : null}
                      </View>
                      <Text style={styles.checkText}>
                        #{id} · {o.customer_name || 'Customer'} · {o.status}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}
          </ScrollView>

          <TouchableOpacity
            style={[styles.primaryBtn, (busy || !canSubmit) && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={busy || !canSubmit}
            activeOpacity={0.9}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {alsoDispatch ? 'Assign & Dispatch' : 'Assign Delivery'}
              </Text>
            )}
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
    maxWidth: 440,
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
    marginBottom: 10,
  },
  title: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { fontSize: 13, fontWeight: '700', color: '#0C6258', marginBottom: 4 },
  address: { fontSize: 12, color: '#64748B', marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  emptyHint: {
    fontSize: 12.5,
    color: '#B45309',
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  riderList: { gap: 8, marginBottom: 8 },
  riderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#F8FAFC',
  },
  riderCardActive: {
    borderColor: '#0C6258',
    backgroundColor: '#ECFDF5',
  },
  riderAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E2E8F0' },
  riderName: { fontSize: 13.5, fontWeight: '800', color: '#0F172A' },
  riderSub: { fontSize: 11.5, color: '#64748B', marginTop: 2 },
  riderStatus: { fontSize: 10.5, fontWeight: '700', color: '#0C6258', marginTop: 2 },
  summaryBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
    marginBottom: 4,
  },
  summaryTitle: { fontSize: 11, fontWeight: '800', color: '#64748B', marginBottom: 4, textTransform: 'uppercase' },
  summaryLine: { fontSize: 12.5, color: '#334155', fontWeight: '600' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: '#0C6258', borderColor: '#0C6258' },
  checkText: { flex: 1, fontSize: 12.5, color: '#334155', fontWeight: '600' },
  hint: { fontSize: 11, color: '#94A3B8', marginTop: 12, lineHeight: 16 },
  primaryBtn: {
    marginTop: 14,
    backgroundColor: '#0C6258',
    borderRadius: 12,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
});
