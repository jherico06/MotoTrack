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
import { serviceQuotationService } from '../../services/bookings/serviceQuotationService.js';
import { garageService } from '../../services/bookings/garageService.js';
import { productService } from '../../services/products/productService.js';
import {
  calcLaborCost,
  calcServiceTotals,
  calcDownpayment,
  formatPhp,
  formatLaborLine,
  FLEX_BOOKING_STATUS,
  normalizeBookingStatus,
} from '../../utils/serviceQuotation.js';
import { canAdminAction } from '../../utils/bookingWorkflow.js';
import { isPmsFixedBooking } from '../../utils/pmsCcPricing.js';
import { getThemeTokens } from '../../styles/theme.js';
import ServiceReceiptModal from '../modals/ServiceReceiptModal.jsx';

function getFieldProps(t, isDark) {
  return {
    placeholderTextColor: isDark ? t.placeholder : '#94A3B8',
    selectionColor: isDark ? t.accentBrand : '#EA580C',
    underlineColorAndroid: 'transparent',
  };
}

export default function ServiceQuotationPanel({
  booking,
  onToast,
  onUpdated,
  style,
  isDarkMode = false,
}) {
  const t = useMemo(() => getThemeTokens(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => createStyles(t, isDarkMode), [t, isDarkMode]);
  const fieldProps = useMemo(() => getFieldProps(t, isDarkMode), [t, isDarkMode]);
  const bookingId = booking?.booking_id || booking?.id;
  const statusNorm = normalizeBookingStatus(booking?.status);
  const canSendQuote =
    canAdminAction(booking?.status, 'send_quotation') ||
    canAdminAction(booking?.status, 'create_quotation') ||
    canAdminAction(booking?.status, 'review_estimate') ||
    statusNorm === FLEX_BOOKING_STATUS.UNDER_INSPECTION ||
    statusNorm === FLEX_BOOKING_STATUS.ESTIMATE_SUBMITTED;
  const canRecordActual =
    canAdminAction(booking?.status, 'update_progress') ||
    statusNorm === FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS;
  const canCreateAdditional =
    canAdminAction(booking?.status, 'create_additional') ||
    canAdminAction(booking?.status, 'review_additional') ||
    canAdminAction(booking?.status, 'send_additional');
  const canFinalize = canAdminAction(booking?.status, 'finalize_bill');
  const canRecordPayment = canAdminAction(booking?.status, 'record_payment');
  const isPmsFixed = isPmsFixedBooking(booking);
  const [mechanics, setMechanics] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mechanicEstimate, setMechanicEstimate] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [receiptVisible, setReceiptVisible] = useState(false);
  const [receiptSnapshot, setReceiptSnapshot] = useState(null);

  const [mechanicId, setMechanicId] = useState(booking?.mechanic_id || '');
  const [hourlyRate, setHourlyRate] = useState(String(booking?.quoted_hourly_rate || 150));
  const [serviceRate, setServiceRate] = useState(
    String(
      booking?.quoted_service_rate ||
        booking?.package_price ||
        booking?.estimated_service_total ||
        ''
    )
  );
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
        const [mechs, prods, quotation, estimate] = await Promise.all([
          garageService.fetchMechanics(),
          productService.getProducts?.() || Promise.resolve([]),
          serviceQuotationService.getQuotationForBooking(bookingId, {
            force: true,
            preferType: 'customer',
          }),
          serviceQuotationService.getMechanicEstimate(bookingId, { force: true }),
        ]);
        if (!mounted) return;
        setMechanics(Array.isArray(mechs) ? mechs.filter((m) => m.isActive !== false) : []);
        setProducts(Array.isArray(prods) ? prods : []);
        setMechanicEstimate(estimate || null);
        const source = quotation || estimate;
        if (source) {
          setMechanicId(source.mechanic_id || '');
          setHourlyRate(String(source.hourly_rate ?? 150));
          if (source.labor_cost != null && Number(source.hourly_rate || 0) <= 0) {
            setServiceRate(String(source.labor_cost));
          } else if (booking?.quoted_service_rate != null) {
            setServiceRate(String(booking.quoted_service_rate));
          }
          setEstimatedHours(String(source.estimated_labor_hours ?? 3));
          if (source.actual_labor_hours != null) {
            setActualHours(String(source.actual_labor_hours));
          }
          setDiscountType(source.discount_type || 'fixed');
          setDiscountValue(String(source.discount_value || 0));
          setDownpaymentType(source.downpayment_type || 'percent');
          setDownpaymentPercent(String(source.downpayment_percent ?? 30));
          setDownpaymentFixed(String(source.downpayment_amount || 0));
          const qParts = (source.items || []).filter((i) => i.item_type === 'part');
          const qOther = (source.items || []).filter((i) => i.item_type !== 'part');
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
      hourlyRate: isPmsFixed ? 0 : Number(hourlyRate || 0),
      laborHours: isPmsFixed ? 0 : Number(estimatedHours || 0),
      laborCost: isPmsFixed ? Number(serviceRate || 0) : undefined,
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
    isPmsFixed,
    serviceRate,
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
    if (isPmsFixed) {
      return calcServiceTotals({
        laborCost: Number(serviceRate || 0),
        partsTotal,
        otherChargesTotal: otherTotal,
        discountType,
        discountValue: Number(discountValue || 0),
      });
    }
    if (actualHours === '') return null;
    return calcServiceTotals({
      hourlyRate: Number(hourlyRate || 0),
      laborHours: Number(actualHours || 0),
      partsTotal,
      otherChargesTotal: otherTotal,
      discountType,
      discountValue: Number(discountValue || 0),
    });
  }, [
    isPmsFixed,
    serviceRate,
    actualHours,
    hourlyRate,
    partsTotal,
    otherTotal,
    discountType,
    discountValue,
  ]);

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
    // Pricing uses fixed service rates / booking quote — not per-mechanic hourly rates.
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

  const persistQuotationPayload = async () => {
    return serviceQuotationService.upsertCustomerQuotation(bookingId, {
      mechanic_id: mechanicId || null,
      mechanic_name: selectedMechanic?.shortName || selectedMechanic?.name || booking?.mechanic,
      hourly_rate: isPmsFixed ? 0 : Number(hourlyRate || 0),
      estimated_labor_hours: isPmsFixed ? 0 : Number(estimatedHours || 0),
      fixed_service_rate: isPmsFixed ? Number(serviceRate || 0) : undefined,
      items: buildItemsPayload(),
      discount_type: discountType,
      discount_value: Number(discountValue || 0),
      downpayment_type: downpaymentType,
      downpayment_percent: Number(downpaymentPercent || 0),
      downpayment_amount: Number(downpaymentFixed || 0),
      source_quotation_id: mechanicEstimate?.quotation_id || null,
      status: 'draft',
      created_by: 'admin',
    });
  };

  const saveQuotation = async () => {
    if (!bookingId) return;
    setSaving(true);
    try {
      const result = await persistQuotationPayload();
      if (!result.success) {
        toast(result.error || 'Failed to save quotation');
        return;
      }
      toast(isPmsFixed ? 'Service rate & parts saved' : 'Customer quotation saved');
      onUpdated?.(result.quotation);
    } finally {
      setSaving(false);
    }
  };

  const sendQuotation = async () => {
    setSaving(true);
    try {
      const saved = await persistQuotationPayload();
      if (!saved.success) {
        toast(saved.error || 'Failed to save quotation');
        return;
      }
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
      const saved = await persistQuotationPayload();
      if (!saved.success) {
        toast(saved.error || 'Could not save service rate / parts before finalize');
        return;
      }
      const result = await serviceQuotationService.finalizeBilling(bookingId);
      if (!result.success) {
        toast(result.error || 'Finalize failed');
        return;
      }
      toast(
        result.remaining > 0
          ? `Receipt generated ${formatPhp(result.finalTotal)} • Remaining ${formatPhp(result.remaining)} • Customer notified`
          : `Receipt generated ${formatPhp(result.finalTotal)} • Customer notified • Ready for pickup`
      );
      setReceiptSnapshot({
        booking: {
          ...booking,
          final_service_total: result.finalTotal,
          remaining_balance: result.remaining,
          actual_labor_cost: result.laborCost,
          parts_total: result.partsTotal,
          other_charges_total: result.otherChargesTotal,
        },
        quotation: {
          ...(saved.quotation || {}),
          labor_cost: result.laborCost,
          parts_total: result.partsTotal,
          other_charges_total: result.otherChargesTotal,
          additional_charges_total: result.additionalChargesTotal,
          total_amount: result.finalTotal,
          remaining_balance: result.remaining,
          items: buildItemsPayload().map((i, idx) => ({
            ...i,
            line_total:
              i.item_type === 'part'
                ? Number(i.quantity || 1) * Number(i.unit_price || 0)
                : Number(i.unit_price || 0),
            sort_order: idx,
          })),
        },
      });
      setReceiptVisible(true);
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
        <ActivityIndicator color={isDarkMode ? t.accentBrand : '#EA580C'} />
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

      {mechanicEstimate ? (
        <View style={styles.estimateBox}>
          <Text style={styles.estimateTitle}>Previous Estimate (read-only)</Text>
          <Text style={styles.sub}>
            {mechanicEstimate.mechanic_name || 'Legacy estimate'} ·{' '}
            {formatPhp(mechanicEstimate.total_amount)} · submitted{' '}
            {mechanicEstimate.status || 'submitted'}
          </Text>
          <Text style={styles.muted}>
            Labor {formatLaborLine(mechanicEstimate.estimated_labor_hours, mechanicEstimate.hourly_rate)} ·
            Parts {formatPhp(mechanicEstimate.parts_total)} · Other{' '}
            {formatPhp(mechanicEstimate.other_charges_total)}
          </Text>
          <Text style={styles.muted}>
            Adjust below to create the customer quotation. The previous estimate is never overwritten.
          </Text>
        </View>
      ) : null}

      {/* Admin sets service rate + inventory products for parts/other */}
      {isPmsFixed ? (
        <View style={styles.field}>
          <Text style={styles.label}>Service Rate (₱) — fixed catalog / adjustable</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={serviceRate}
            onChangeText={setServiceRate}
            placeholder="0"
            {...fieldProps}
          />
          <Text style={styles.calcLine}>Service labor (fixed): {formatPhp(Number(serviceRate || 0))}</Text>
          <Text style={styles.muted}>
            Add inventory products below for parts replaced or other shop charges. Customer is notified when you finalize and generate the receipt.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.row}>
            <View style={styles.field}>
              <Text style={styles.label}>Hourly Rate (₱)</Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                value={hourlyRate}
                onChangeText={setHourlyRate}
                placeholder="150"
                {...fieldProps}
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
                {...fieldProps}
              />
            </View>
          </View>
          <Text style={styles.calcLine}>
            ESTIMATED Labor: {formatLaborLine(estimatedHours, hourlyRate)}
          </Text>
        </>
      )}

      <Text style={styles.section}>Parts (inventory products replaced)</Text>
      <TextInput
        style={styles.input}
        placeholder="Search products…"
        value={productSearch}
        onChangeText={setProductSearch}
        {...fieldProps}
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
            <BootstrapIcon name="x-lg" size={14} color={isDarkMode ? t.statusDangerText : '#DC2626'} />
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
          {...fieldProps}
        />
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="Amount"
          keyboardType="decimal-pad"
          value={otherAmount}
          onChangeText={setOtherAmount}
          {...fieldProps}
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
            <BootstrapIcon name="x-lg" size={14} color={isDarkMode ? t.statusDangerText : '#DC2626'} />
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
          {...fieldProps}
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
            {...fieldProps}
          />
        ) : (
          <TextInput
            style={[styles.input, { flex: 1 }]}
            keyboardType="decimal-pad"
            value={downpaymentFixed}
            onChangeText={setDownpaymentFixed}
            placeholder="0"
            {...fieldProps}
          />
        )}
      </View>

      <View style={styles.totalsBox}>
        <Text style={styles.totalsTitle}>ESTIMATED SUMMARY</Text>

        <View style={styles.tableHeaderRow}>
          <Text style={styles.colHeaderLeft}>DESCRIPTION</Text>
          <Text style={styles.colHeaderRight}>SUBTOTAL</Text>
        </View>
        <View style={styles.tableHeaderDivider} />

        <View style={styles.tableRow}>
          <Text style={styles.tableRowLabel}>Labor</Text>
          <Text style={styles.tableRowValue}>{formatPhp(estimated.laborCost)}</Text>
        </View>

        <View style={styles.tableRow}>
          <Text style={styles.tableRowLabel}>Parts</Text>
          <Text style={styles.tableRowValue}>{formatPhp(estimated.partsTotal)}</Text>
        </View>

        <View style={styles.tableRow}>
          <Text style={styles.tableRowLabel}>Other Charges</Text>
          <Text style={styles.tableRowValue}>{formatPhp(estimated.otherChargesTotal)}</Text>
        </View>

        <View style={styles.tableRow}>
          <Text style={styles.tableRowLabel}>Discount</Text>
          <Text style={[styles.tableRowValue, Number(estimated.discountAmount) > 0 && { color: isDarkMode ? t.statusDangerText : '#DC2626' }]}>
            −{formatPhp(estimated.discountAmount)}
          </Text>
        </View>

        <View style={styles.tableTotalDivider} />

        <View style={styles.tableTotalRow}>
          <Text style={styles.totalsTotalLabel}>Total</Text>
          <Text style={styles.totalsTotalValue}>{formatPhp(estimated.totalAmount)}</Text>
        </View>

        <View style={styles.breakdownSubBox}>
          <View style={styles.tableRow}>
            <Text style={styles.tableSubLabel}>Required Downpayment</Text>
            <Text style={styles.tableSubValueDp}>{formatPhp(estimated.downpaymentAmount)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableSubLabel}>Remaining Estimated Balance</Text>
            <Text style={styles.tableSubValueRem}>{formatPhp(estimated.remainingBalance)}</Text>
          </View>
        </View>
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
            Quotation editing unlocks once the admin starts the inspection (Repair bookings).
          </Text>
        )}
      </View>

      {canRecordPayment ? (
        <View style={{ marginTop: 16, gap: 8 }}>
          <Text style={styles.section}>Manual Payment Recording</Text>
          <Text style={styles.muted}>
            Record Cash or Other payments received at the shop. GCash gateway is not enabled yet.
          </Text>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.chip, payMethod === 'cash' && styles.chipActive]}
              onPress={() => setPayMethod('cash')}
            >
              <Text style={styles.chipText}>Cash</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, payMethod === 'other' && styles.chipActive]}
              onPress={() => setPayMethod('other')}
            >
              <Text style={styles.chipText}>Other</Text>
            </TouchableOpacity>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Amount ₱"
              keyboardType="decimal-pad"
              value={payAmount}
              onChangeText={setPayAmount}
              {...fieldProps}
            />
          </View>
          <TextInput
            style={styles.input}
            placeholder="Reference / receipt # (optional)"
            value={payRef}
            onChangeText={setPayRef}
            {...fieldProps}
          />
          <TextInput
            style={styles.input}
            placeholder="Notes (optional)"
            value={payNotes}
            onChangeText={setPayNotes}
            {...fieldProps}
          />
          <TouchableOpacity
            style={styles.btnPrimary}
            disabled={saving}
            onPress={async () => {
              setSaving(true);
              try {
                const paymentType =
                  statusNorm === FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT
                    ? 'DOWNPAYMENT'
                    : 'FINAL_PAYMENT';
                const amt =
                  Number(payAmount) ||
                  (paymentType === 'DOWNPAYMENT'
                    ? Number(booking?.downpayment_amount || 0)
                    : Number(booking?.remaining_balance || 0));
                const res = await serviceQuotationService.recordBookingPayment({
                  bookingId,
                  customerId: booking?.customer_id,
                  amount: amt,
                  paymentType,
                  paymentMethod: payMethod,
                  transactionReference: payRef || undefined,
                  receivedBy: 'admin',
                  notes: payNotes || undefined,
                });
                if (!res.success) {
                  toast(res.error || 'Payment failed');
                  return;
                }
                toast(`${paymentType === 'DOWNPAYMENT' ? 'Downpayment' : 'Payment'} recorded`);
                setPayAmount('');
                setPayRef('');
                setPayNotes('');
                onUpdated?.(res);
              } finally {
                setSaving(false);
              }
            }}
          >
            <Text style={styles.btnPrimaryText}>
              Record{' '}
              {statusNorm === FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT
                ? 'Downpayment'
                : 'Final Payment'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

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
              {...fieldProps}
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
            {...fieldProps}
          />
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Extra labor hrs"
              keyboardType="decimal-pad"
              value={addLaborHours}
              onChangeText={setAddLaborHours}
              {...fieldProps}
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Extra parts ₱"
              keyboardType="decimal-pad"
              value={addPartsAmount}
              onChangeText={setAddPartsAmount}
              {...fieldProps}
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
          <Text style={styles.btnPrimaryText}>Finalize & Generate Receipt</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={[styles.btnSecondary, { marginTop: 10 }]}
        onPress={() => {
          setReceiptSnapshot({
            booking,
            quotation: {
              labor_cost: estimated.laborCost,
              parts_total: partsTotal,
              other_charges_total: otherTotal,
              total_amount: estimated.totalAmount,
              discount_amount: estimated.discountAmount,
              remaining_balance: estimated.remainingBalance,
              items: buildItemsPayload().map((i, idx) => ({
                ...i,
                line_total:
                  i.item_type === 'part'
                    ? Number(i.quantity || 1) * Number(i.unit_price || 0)
                    : Number(i.unit_price || 0),
                sort_order: idx,
              })),
            },
          });
          setReceiptVisible(true);
        }}
      >
        <Text style={styles.btnSecondaryText}>Preview Service Receipt</Text>
      </TouchableOpacity>

      {saving && (
        <View style={styles.savingRow}>
          <ActivityIndicator color={isDarkMode ? t.accentBrand : '#EA580C'} />
          <Text style={styles.muted}> Saving…</Text>
        </View>
      )}

      <ServiceReceiptModal
        visible={receiptVisible}
        onClose={() => setReceiptVisible(false)}
        booking={receiptSnapshot?.booking || booking}
        quotation={receiptSnapshot?.quotation}
        isDarkMode={isDarkMode}
      />
    </ScrollView>
  );
}

function createStyles(t, isDark) {
  return StyleSheet.create({
    wrap: { backgroundColor: isDark ? t.bgSub : '#F8FAFC', borderRadius: 12 },
    content: { padding: 16, paddingBottom: 40 },
    center: { padding: 24, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 18, fontWeight: '700', color: isDark ? t.textPrimary : '#0F172A' },
    sub: { fontSize: 13, color: isDark ? t.textMuted : '#64748B', marginBottom: 12 },
    section: {
      marginTop: 16,
      marginBottom: 8,
      fontSize: 13,
      fontWeight: '700',
      color: isDark ? t.accentBrand : '#EA580C',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    chipRow: { flexGrow: 0, marginBottom: 8 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: isDark ? t.bgElevated : '#E2E8F0',
      borderRadius: 8,
      marginRight: 8,
    },
    chipActive: { backgroundColor: isDark ? '#EA580C' : '#EA580C' },
    chipText: { fontSize: 12, color: isDark ? t.textSecondary : '#334155', fontWeight: '600' },
    chipTextActive: { color: '#FFFFFF' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    field: { flex: 1 },
    label: { fontSize: 11, color: isDark ? t.textSecondary : '#475569', marginBottom: 5, fontWeight: '800' },
    input: {
      backgroundColor: isDark ? t.bgCard : '#FFFFFF',
      borderWidth: 1.5,
      borderColor: isDark ? t.borderInput : '#CBD5E1',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 11,
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? t.textPrimary : '#0F172A',
      marginBottom: 6,
      outlineStyle: 'none',
    },
    calcLine: { fontSize: 13, color: isDark ? t.textPrimary : '#0F172A', fontWeight: '600', marginBottom: 6 },
    productRow: {
      backgroundColor: isDark ? t.bgCard : '#FFFFFF',
      padding: 10,
      borderRadius: 8,
      marginBottom: 6,
      borderWidth: 1,
      borderColor: isDark ? t.border : '#E2E8F0',
    },
    productName: { fontSize: 13, fontWeight: '600', color: isDark ? t.textPrimary : '#0F172A' },
    productPrice: { fontSize: 12, color: isDark ? t.textMuted : '#64748B' },
    lineItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
    },
    lineText: { fontSize: 13, color: isDark ? t.textSecondary : '#334155', flex: 1 },
    smallBtn: {
      backgroundColor: isDark ? '#EA580C' : '#EA580C',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 8,
    },
    smallBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
    totalsBox: {
      marginTop: 14,
      backgroundColor: isDark ? t.bgCard : '#FFFFFF',
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: isDark ? t.accentBorder : '#C8DDD3',
      shadowColor: isDark ? '#000000' : '#0F172A',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 2,
    },
    totalsTitle: {
      fontWeight: '800',
      fontSize: 12.5,
      letterSpacing: 0.8,
      color: isDark ? t.accentBrand : '#EA580C',
      marginBottom: 12,
    },
    tableHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingBottom: 4,
    },
    colHeaderLeft: {
      fontSize: 11,
      fontWeight: '700',
      color: isDark ? t.textMuted : '#94A3B8',
      letterSpacing: 0.6,
    },
    colHeaderRight: {
      fontSize: 11,
      fontWeight: '700',
      color: isDark ? t.textMuted : '#94A3B8',
      letterSpacing: 0.6,
    },
    tableHeaderDivider: {
      height: 1,
      backgroundColor: isDark ? t.border : '#E2E8F0',
      marginBottom: 10,
      marginTop: 4,
    },
    tableRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
    },
    tableRowLabel: {
      fontSize: 13.5,
      color: isDark ? t.textSecondary : '#475569',
      fontWeight: '500',
    },
    tableRowValue: {
      fontSize: 13.5,
      color: isDark ? t.textPrimary : '#0F172A',
      fontWeight: '600',
    },
    tableTotalDivider: {
      height: 1.5,
      backgroundColor: isDark ? t.borderInput : '#CBD5E1',
      marginTop: 10,
      marginBottom: 10,
    },
    tableTotalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 2,
    },
    totalsTotalLabel: {
      fontSize: 15.5,
      fontWeight: '800',
      color: isDark ? t.textPrimary : '#0F172A',
    },
    totalsTotalValue: {
      fontSize: 17,
      fontWeight: '800',
      color: isDark ? t.money : '#EA580C',
    },
    breakdownSubBox: {
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: isDark ? t.border : '#F1F5F9',
      gap: 4,
    },
    tableSubLabel: {
      fontSize: 12.5,
      color: isDark ? t.textMuted : '#64748B',
      fontWeight: '500',
    },
    tableSubValueDp: {
      fontSize: 13,
      color: isDark ? t.statusWarningText : '#D97706',
      fontWeight: '700',
    },
    tableSubValueRem: {
      fontSize: 13,
      color: isDark ? t.money : '#EA580C',
      fontWeight: '700',
    },
    actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
    btnPrimary: {
      flex: 1,
      backgroundColor: isDark ? '#EA580C' : '#EA580C',
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
    },
    btnPrimaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
    btnSecondary: {
      flex: 1,
      backgroundColor: isDark ? t.bgCard : '#FFFFFF',
      borderWidth: 1,
      borderColor: isDark ? t.accentBorder : '#EA580C',
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
      marginTop: 8,
    },
    btnSecondaryText: { color: isDark ? t.accentBrand : '#EA580C', fontWeight: '700', fontSize: 13 },
    muted: { fontSize: 12, color: isDark ? t.textMuted : '#94A3B8', marginTop: 4 },
    savingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
    estimateBox: {
      backgroundColor: isDark ? t.statusPurpleBg : '#EEF2FF',
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(150, 145, 165, 0.28)' : '#C7D2FE',
      marginBottom: 12,
      gap: 4,
    },
    estimateTitle: { fontSize: 13, fontWeight: '800', color: isDark ? t.statusPurpleText : '#4338CA' },
  });
}
