import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import ExpectedDateField from './ExpectedDateField';
import { deliveryService } from '../../services/deliveryService';
import { addDaysDateInput, toDateInputValue } from '../../utils/deliveryDate';

export default function ExpectedDeliveryEditor({
  orderId,
  currentIso,
  adminUser,
  onSaved,
  showToast,
}) {
  const [date, setDate] = useState(() => toDateInputValue(currentIso) || addDaysDateInput(1));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDate(toDateInputValue(currentIso) || addDaysDateInput(1));
  }, [currentIso, orderId]);

  const handleSave = async () => {
    if (!orderId) return;
    setBusy(true);
    try {
      const res = await deliveryService.updateExpectedDelivery(orderId, date, adminUser);
      if (!res.success) {
        showToast?.(res.error || 'Could not save expected date');
        return;
      }
      showToast?.(`Expected delivery set to ${date}`);
      onSaved?.(res);
    } catch (e) {
      showToast?.(e?.message || 'Could not save expected date');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <ExpectedDateField
        value={date}
        onChange={setDate}
        label="Expected delivery date"
        hint="Shown on the customer tracking page."
      />
      <TouchableOpacity
        style={[styles.saveBtn, busy && { opacity: 0.7 }]}
        onPress={handleSave}
        disabled={busy}
        activeOpacity={0.85}
      >
        {busy ? (
          <ActivityIndicator color="#0C6258" />
        ) : (
          <Text style={styles.saveBtnText}>Save expected date</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4, marginBottom: 4 },
  saveBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  saveBtnText: { color: '#0C6258', fontWeight: '800', fontSize: 12 },
});
