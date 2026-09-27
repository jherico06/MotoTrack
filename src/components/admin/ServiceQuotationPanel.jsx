/**
 * Admin flexible service quotation builder.
 * Labor = hourly rate × hours (decimal OK). Parts snapshot prices from inventory.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { BootstrapIcon } from '../common';
import { serviceQuotationService } from '../../services/serviceQuotationService';
import { garageService } from '../../services/garageService';
import { productService } from '../../services/productService';
import {
  calcLaborCost,
  calcServiceTotals,
  calcDownpayment,
  formatPhp,
  formatLaborLine,
  FLEX_BOOKING_STATUS,
  normalizeBookingStatus,
} from '../../utils/serviceQuotation';
import { canAdminAction } from '../../utils/bookingWorkflow';

const FIELD_PROPS = {
  placeholderTextColor: '#94A3B8',
  selectionColor: '#1D4533',
  underlineColorAndroid: 'transparent',
};

export default function ServiceQuotationPanel({
  booking,
  onToast,
  onUpdated,
  style,
}) {
  const bookingId = booking?.booking_id || booking?.id;
  const statusNorm = normalizeBookingStatus(booking?.status);
  const canSendQuote = canAdminAction(booking?.status, 'send_quotation') ||
    canAdminAction(booking?.status, 'create_quotation') ||
    statusNorm === FLEX_BOOKING_STATUS.UNDER_INSPECTION;
  const canRecordActual = canAdminAction(booking?.status, 'update_progress') ||
    statusNorm === FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS;
  const canCreateAdditional = canAdminAction(booking?.status, 'create_additional');
  const canFinalize = canAdminAction(booking?.status, 'finalize_bill');
  const [mechanics, setMechanics] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [mechanicId, setMechanicId] = useState(booking?.mechanic_id || '');
  const [hourlyRate, setHourlyRate] = useState(String(booking?.quoted_hourly_rate || 150));
  const [estimatedHours, setEstimatedHours] = useState(
    String(booking?.estimated_labor_hours || '3')
  );
  const [actualHours, setActualHours] = useState(
    booking?.actual_labor_hours != null ? String(booking.actual_labor_hours) : ''
  );
  const [parts, setParts] = useState([]);
  const [otherCharges, setOtherCharges] = useState([]);
  const [discountType, setDiscountType] = useState('fixed');
  const [discountValue, setDiscountValue] = useState('0');
  const [downpaymentType, setDownpaymentType] = useState('percent');
  const [downpaymentPercent, setDownpaymentPercent] = useState('30');
  const [downpaymentFixed, setDownpaymentFixed] = useState('0');
  const [productSearch, setProductSearch] = useState('');
  const [otherDesc, setOtherDesc] = useState('');
  const [otherAmount, setOtherAmount] = useState('');
  const [addLaborHours, setAddLaborHours] = useState('0');
  const [addPartsAmount, setAddPartsAmount] = useState('0');
  const [addTitle, setAddTitle] = useState('Additional discovered work');

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [mechs, prods, quotation] = await Promise.all([
          garageService.fetchMechanics(),
          productService.getProducts?.() || Promise.resolve([]),
          serviceQuotationService.getQuotationForBooking(bookingId, { force: true }),
        ]);
        if (!mounted) return;
        setMechanics(Array.isArray(mechs) ? mechs.filter((m) => m.isActive !== false) : []);
        setProducts(Array.isArray(prods) ? prods : []);
        if (quotation) {
          setMechanicId(quotation.mechanic_id || '');
          setHourlyRate(String(quotation.hourly_rate ?? 150));
          setEstimatedHours(String(quotation.estimated_labor_hours ?? 3));
          if (quotation.actual_labor_hours != null) {
            setActualHours(String(quotation.actual_labor_hours));
          }
          setDiscountType(quotation.discount_type || 'fixed');
          setDiscountValue(String(quotation.discount_value || 0));
          setDownpaymentType(quotation.downpayment_type || 'percent');
          setDownpaymentPercent(String(quotation.downpayment_percent ?? 30));
          setDownpaymentFixed(String(quotation.downpayment_amount || 0));
          const qParts = (quotation.items || []).filter((i) => i.item_type === 'part');
          const qOther = (quotation.items || []).filter((i) => i.item_type !== 'part');
          setParts(
            qParts.map((i) => ({
              product_id: i.product_id,
              product_name: i.product_name,
              quantity: Number(i.quantity || 1),
              unit_price: Number(i.unit_price || 0),
            }))
          );
          setOtherCharges(
            qOther.map((i) => ({
              description: i.description || i.product_name,
              amount: Number(i.line_total || i.unit_price || 0),
            }))
          );
        } else if (mechs?.length && !mechanicId) {
          const first = mechs[0];
          setMechanicId(first.id);
          setHourlyRate(String(first.hourlyRate ?? first.hourly_rate ?? 150));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [bookingId]);

  const selectedMechanic = useMemo(
    () => mechanics.find((m) => m.id === mechanicId),
    [mechanics, mechanicId]
  );

  const partsTotal = useMemo(
    () => parts.reduce((s, p) => s + Number(p.quantity || 0) * Number(p.unit_price || 0), 0),
    [parts]
  );
  const otherTotal = useMemo(
    () => otherCharges.reduce((s, o) => s + Number(o.amount || 0), 0),
    [otherCharges]
  );

  const estimated = useMemo(() => {
    const totals = calcServiceTotals({
      hourlyRate: Number(hourlyRate || 0),
      laborHours: Number(estimatedHours || 0),
      partsTotal,
      otherChargesTotal: otherTotal,
      discountType,
      discountValue: Number(discountValue || 0),
    });
    const dp = calcDownpayment({
      totalAmount: totals.totalAmount,
      downpaymentType,
      downpaymentPercent: Number(downpaymentPercent || 0),
      downpaymentAmount: Number(downpaymentFixed || 0),
    });
    return { ...totals, ...dp };
  }, [
    hourlyRate,
    estimatedHours,
    partsTotal,
    otherTotal,
    discountType,
    discountValue,
    downpaymentType,
    downpaymentPercent,
    downpaymentFixed,
  ]);

  const actualPreview = useMemo(() => {
    if (actualHours === '') return null;
    return calcServiceTotals({
      hourlyRate: Number(hourlyRate || 0),
      laborHours: Number(actualHours || 0),
      partsTotal,
      otherChargesTotal: otherTotal,
      discountType,
      discountValue: Number(discountValue || 0),
    });
  }, [actualHours, hourlyRate, partsTotal, otherTotal, discountType, discountValue]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    const list = products.slice(0, 80);
    if (!q) return list.slice(0, 12);
    return list
      .filter((p) =>
        String(p.name || p.product_name || '')
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 12);
  }, [products, productSearch]);

  const toast = (msg) => onToast?.(msg);

  const onSelectMechanic = (mech) => {
    setMechanicId(mech.id);
    setHourlyRate(String(mech.hourlyRate ?? mech.hourly_rate ?? 150));
  };

  const addPart = (product) => {
    const price = Number(product.price ?? product.price_php ?? product.selling_price ?? 0);
    const name = product.name || product.product_name || 'Part';
    const id = product.product_id || product.id;
    setParts((prev) => {
      const existing = prev.find((p) => p.product_id === id);
      if (existing) {
        return prev.map((p) =>
          p.product_id === id ? { ...p, quantity: Number(p.quantity) + 1 } : p
        );
      }
      return [
        ...prev,
        { product_id: id, product_name: name, quantity: 1, unit_price: price },
      ];
    });
  };

  const addOtherCharge = () => {
    const amount = Number(otherAmount || 0);
    if (!otherDesc.trim() || amount <= 0) {
      toast('Enter other charge description and amount');
      return;
    }
    setOtherCharges((prev) => [...prev, { description: otherDesc.trim(), amount }]);
    setOtherDesc('');
    setOtherAmount('');
  };

  const buildItemsPayload = () => [
    ...parts.map((p) => ({
      item_type: 'part',
      product_id: p.product_id,
      product_name: p.product_name,
      quantity: p.quantity,
      unit_price: p.unit_price,
    })),
    ...otherCharges.map((o) => ({
      item_type: 'other',
      description: o.description,
      quantity: 1,
      unit_price: o.amount,
    })),
  ];

  const saveQuotation = async () => {
    if (!bookingId) return;
    setSaving(true);
    try {
      const result = await serviceQuotationService.upsertEstimatedQuotation(bookingId, {
        mechanic_id: mechanicId || null,
        mechanic_name: selectedMechanic?.shortName || selectedMechanic?.name || booking?.mechanic,
        hourly_rate: Number(hourlyRate || 0),
        estimated_labor_hours: Number(estimatedHours || 0),
        items: buildItemsPayload(),
        discount_type: discountType,
        discount_value: Number(discountValue || 0),
        downpayment_type: downpaymentType,
        downpayment_percent: Number(downpaymentPercent || 0),
        downpayment_amount: Number(downpaymentFixed || 0),
        status: 'draft',
      });
      if (!result.success) {
        toast(result.error || 'Failed to save quotation');
        return;
      }
      toast('Estimated quotation saved (prices snapshotted)');
      onUpdated?.(result.quotation);
    } finally {
      setSaving(false);
    }
  };

  const sendQuotation = async () => {
    setSaving(true);
    try {
      await saveQuotation();
      const result = await serviceQuotationService.sendQuotationToCustomer(bookingId, {
        customerId: booking?.customer_id,
        customerUserId: booking?.user_id || booking?.customer_id,
      });
      if (!result.success) {
        toast(result.error || 'Failed to send quotation');
        return;
      }
      toast('Quotation sent to customer');
      onUpdated?.(result.quotation);
    } finally {
      setSaving(false);
    }
  };

  const saveActualLabor = async () => {
    if (actualHours === '') {
      toast('Enter actual labor hours');
      return;
    }
    setSaving(true);
    try {
      const result = await serviceQuotationService.setActualLaborHours(
        bookingId,
        Number(actualHours),
        { hourlyRate: Number(hourlyRate || 0) }
      );
      if (!result.success) {
        toast(result.error || 'Failed to save actual labor');
        return;
      }
      toast(`Actual labor saved: ${formatPhp(result.actualLaborCost)}`);
      onUpdated?.(result);
    } finally {
      setSaving(false);
    }
  };

  const createAdditional = async () => {
    setSaving(true);
    try {
      const result = await serviceQuotationService.createAdditionalCharge(bookingId, {
        title: addTitle || 'Additional Work',
        additional_labor_hours: Number(addLaborHours || 0),
        hourly_rate: Number(hourlyRate || 0),
        parts_total: Number(addPartsAmount || 0),
        customerId: booking?.customer_id,
      });
      if (!result.success) {
        toast(result.error || 'Failed to create additional charge');
        return;
      }
      toast('Additional charge sent for customer approval');
      onUpdated?.(result.charge);
    } finally {
      setSaving(false);
    }
  };

  const finalizeBill = async () => {
    setSaving(true);
    try {
      const result = await serviceQuotationService.finalizeBilling(bookingId);
      if (!result.success) {
        toast(result.error || 'Finalize failed');
        return;
      }
      toast(
        result.remaining > 0
          ? `Final bill ${formatPhp(result.finalTotal)} • Remaining ${formatPhp(result.remaining)}`
          : `Final bill ${formatPhp(result.finalTotal)} • Ready for pickup`
      );
      onUpdated?.(result);
    } finally {
      setSaving(false);
    }
  };

  if (!bookingId) {
    return (
      <View style={[styles.wrap, style]}>
        <Text style={styles.muted}>Select a booking to build a quotation.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.wrap, styles.center, style]}>
        <ActivityIndicator color="#1D4533" />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.wrap, style]} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Service Quotation</Text>
      <Text style={styles.sub}>
        {bookingId} · {booking?.customer_name || 'Customer'} ·{' '}
        {[booking?.bike_brand, booking?.bike_model].filter(Boolean).join(' ')}
      </Text>

      <Text style={styles.section}>Assigned Mechanic (internal)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {mechanics.map((m) => (
          <TouchableOpacity
            key={m.id}
            style={[styles.chip, mechanicId === m.id && styles.chipActive]}
            onPress={() => onSelectMechanic(m)}
          >
            <Text style={[styles.chipText, mechanicId === m.id && styles.chipTextActive]}>
              {m.shortName || m.name} · {formatPhp(m.hourlyRate ?? m.hourly_rate ?? 150)}/hr
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.row}>
        <View style={styles.field}>
          <Text style={styles.label}>Hourly Rate (₱)</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={hourlyRate}
            onChangeText={setHourlyRate}
            placeholder="150"
            {...FIELD_PROPS}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Estimated Hours</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={estimatedHours}
            onChangeText={setEstimatedHours}
            placeholder="3"
            {...FIELD_PROPS}
          />
        </View>
      </View>
      <Text style={styles.calcLine}>
        ESTIMATED Labor: {formatLaborLine(estimatedHours, hourlyRate)}
      </Text>

      <Text style={styles.section}>Parts (inventory snapshot)</Text>
      <TextInput
        style={styles.input}
        placeholder="Search products…"
        value={productSearch}
        onChangeText={setProductSearch}
        {...FIELD_PROPS}
      />
      {filteredProducts.map((p) => (
        <TouchableOpacity key={p.product_id || p.id} style={styles.productRow} onPress={() => addPart(p)}>
          <Text style={styles.productName}>{p.name || p.product_name}</Text>
          <Text style={styles.productPrice}>
            {formatPhp(p.price ?? p.price_php ?? 0)} · Tap to add
          </Text>
        </TouchableOpacity>
      ))}
      {parts.map((p, idx) => (
        <View key={`${p.product_id}-${idx}`} style={styles.lineItem}>
          <Text style={styles.lineText}>
            {p.product_name} × {p.quantity} @ {formatPhp(p.unit_price)} ={' '}
            {formatPhp(p.quantity * p.unit_price)}
          </Text>
          <TouchableOpacity onPress={() => setParts((prev) => prev.filter((_, i) => i !== idx))}>
            <BootstrapIcon name="x-lg" size={14} color="#DC2626" />
          </TouchableOpacity>
        </View>
      ))}

      <Text style={styles.section}>Other Charges</Text>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, { flex: 2 }]}
          placeholder="Description"
          value={otherDesc}
          onChangeText={setOtherDesc}
          {...FIELD_PROPS}
        />
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="Amount"
          keyboardType="decimal-pad"
          value={otherAmount}
          onChangeText={setOtherAmount}
          {...FIELD_PROPS}
        />
        <TouchableOpacity style={styles.smallBtn} onPress={addOtherCharge}>
          <Text style={styles.smallBtnText}>Add</Text>
        </TouchableOpacity>
      </View>
      {otherCharges.map((o, idx) => (
        <View key={`o-${idx}`} style={styles.lineItem}>
          <Text style={styles.lineText}>
            {o.description}: {formatPhp(o.amount)}
          </Text>
          <TouchableOpacity onPress={() => setOtherCharges((prev) => prev.filter((_, i) => i !== idx))}>
            <BootstrapIcon name="x-lg" size={14} color="#DC2626" />
          </TouchableOpacity>
        </View>
      ))}

      <Text style={styles.section}>Discount</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.chip, discountType === 'fixed' && styles.chipActive]}
          onPress={() => setDiscountType('fixed')}
        >
          <Text style={styles.chipText}>Fixed ₱</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.chip, discountType === 'percent' && styles.chipActive]}
          onPress={() => setDiscountType('percent')}
        >
          <Text style={styles.chipText}>Percent %</Text>
        </TouchableOpacity>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          keyboardType="decimal-pad"
          value={discountValue}
          onChangeText={setDiscountValue}
          placeholder="0"
          {...FIELD_PROPS}
        />
      </View>

      <Text style={styles.section}>Downpayment</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.chip, downpaymentType === 'percent' && styles.chipActive]}
          onPress={() => setDownpaymentType('percent')}
        >
          <Text style={styles.chipText}>%</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.chip, downpaymentType === 'fixed' && styles.chipActive]}
          onPress={() => setDownpaymentType('fixed')}
        >
          <Text style={styles.chipText}>Fixed</Text>
        </TouchableOpacity>
        {downpaymentType === 'percent' ? (
          <TextInput
            style={[styles.input, { flex: 1 }]}
            keyboardType="decimal-pad"
            value={downpaymentPercent}
            onChangeText={setDownpaymentPercent}
            placeholder="30"
            {...FIELD_PROPS}
          />
        ) : (
          <TextInput
            style={[styles.input, { flex: 1 }]}
            keyboardType="decimal-pad"
            value={downpaymentFixed}
            onChangeText={setDownpaymentFixed}
            placeholder="0"
            {...FIELD_PROPS}
          />
        )}
      </View>

      <View style={styles.totalsBox}>
        <Text style={styles.totalsTitle}>ESTIMATED</Text>
        <Text style={styles.totalsLine}>Labor: {formatPhp(estimated.laborCost)}</Text>
        <Text style={styles.totalsLine}>Parts: {formatPhp(estimated.partsTotal)}</Text>
        <Text style={styles.totalsLine}>Other: {formatPhp(estimated.otherChargesTotal)}</Text>
        <Text style={styles.totalsLine}>Discount: −{formatPhp(estimated.discountAmount)}</Text>
        <Text style={styles.totalsTotal}>Total: {formatPhp(estimated.totalAmount)}</Text>
        <Text style={styles.totalsLine}>
          Required Downpayment: {formatPhp(estimated.downpaymentAmount)}
        </Text>
        <Text style={styles.totalsLine}>
          Remaining Estimated Balance: {formatPhp(estimated.remainingBalance)}
        </Text>
      </View>

      <View style={styles.actions}>
        {canSendQuote ? (
          <>
            <TouchableOpacity style={styles.btnSecondary} onPress={saveQuotation} disabled={saving}>
              <Text style={styles.btnSecondaryText}>Save Draft</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnPrimary} onPress={sendQuotation} disabled={saving}>
              <Text style={styles.btnPrimaryText}>Send Quotation to Customer</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.muted}>
            Quotation editing unlocks during Under Inspection.
          </Text>
        )}
      </View>

      <Text style={styles.section}>ACTUAL Labor (after service)</Text>
      {canRecordActual ? (
        <>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Actual hours (e.g. 4 or 1.5)"
              keyboardType="decimal-pad"
              value={actualHours}
              onChangeText={setActualHours}
              {...FIELD_PROPS}
            />
            <TouchableOpacity style={styles.smallBtn} onPress={saveActualLabor} disabled={saving}>
              <Text style={styles.smallBtnText}>Save Actual</Text>
            </TouchableOpacity>
          </View>
          {actualPreview && (
            <Text style={styles.calcLine}>
              ACTUAL Labor: {formatLaborLine(actualHours, hourlyRate)} · Draft final{' '}
              {formatPhp(actualPreview.totalAmount)}
            </Text>
          )}
          <Text style={styles.muted}>
            Estimated hours stay stored separately and are never overwritten by actual hours.
          </Text>
        </>
      ) : (
        <Text style={styles.muted}>
          Actual labor is recorded during Service In Progress.
          {actualHours ? ` Current actual: ${actualHours} hrs` : ''}
        </Text>
      )}

      {canCreateAdditional ? (
        <>
          <Text style={styles.section}>Additional Work (customer approval required)</Text>
          <TextInput
            style={styles.input}
            value={addTitle}
            onChangeText={setAddTitle}
            placeholder="Title"
            {...FIELD_PROPS}
          />
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Extra labor hrs"
              keyboardType="decimal-pad"
              value={addLaborHours}
              onChangeText={setAddLaborHours}
              {...FIELD_PROPS}
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Extra parts ₱"
              keyboardType="decimal-pad"
              value={addPartsAmount}
              onChangeText={setAddPartsAmount}
              {...FIELD_PROPS}
            />
          </View>
          <Text style={styles.calcLine}>
            Preview:{' '}
            {formatPhp(
              calcLaborCost(hourlyRate, addLaborHours) + Number(addPartsAmount || 0)
            )}
          </Text>
          <TouchableOpacity style={styles.btnSecondary} onPress={createAdditional} disabled={saving}>
            <Text style={styles.btnSecondaryText}>Create Additional Charge</Text>
          </TouchableOpacity>
        </>
      ) : null}

      {canFinalize ? (
        <TouchableOpacity style={[styles.btnPrimary, { marginTop: 16 }]} onPress={finalizeBill} disabled={saving}>
          <Text style={styles.btnPrimaryText}>Finalize Billing</Text>
        </TouchableOpacity>
      ) : null}

      {saving && (
        <View style={styles.savingRow}>
          <ActivityIndicator color="#1D4533" />
          <Text style={styles.muted}> Saving…</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#F8FAFC', borderRadius: 12 },
  content: { padding: 16, paddingBottom: 40 },
  center: { padding: 24, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  sub: { fontSize: 13, color: '#64748B', marginBottom: 12 },
  section: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#1D4533',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  chipRow: { flexGrow: 0, marginBottom: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    marginRight: 8,
  },
  chipActive: { backgroundColor: '#1D4533' },
  chipText: { fontSize: 12, color: '#334155', fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  field: { flex: 1 },
  label: { fontSize: 11, color: '#475569', marginBottom: 5, fontWeight: '800' },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 6,
    outlineStyle: 'none',
  },
  calcLine: { fontSize: 13, color: '#0F172A', fontWeight: '600', marginBottom: 6 },
  productRow: {
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  productName: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  productPrice: { fontSize: 12, color: '#64748B' },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  lineText: { fontSize: 13, color: '#334155', flex: 1 },
  smallBtn: {
    backgroundColor: '#1D4533',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  smallBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  totalsBox: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#C8DDD3',
  },
  totalsTitle: { fontWeight: '800', color: '#1D4533', marginBottom: 6 },
  totalsLine: { fontSize: 13, color: '#475569', marginBottom: 2 },
  totalsTotal: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginVertical: 6 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btnPrimary: {
    flex: 1,
    backgroundColor: '#1D4533',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  btnSecondary: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#1D4533',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  btnSecondaryText: { color: '#1D4533', fontWeight: '700', fontSize: 13 },
  muted: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
  savingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
});
