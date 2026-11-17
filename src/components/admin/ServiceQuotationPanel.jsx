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
import { getAdminThemeTokens as getThemeTokens } from '../../styles/web/admin.web.styles.js';
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
    <View style={[styles.wrap, style]}>
      <View style={styles.content}>
        <View style={styles.headerBlock}>
          <Text style={styles.title}>Service Quotation</Text>
          <Text style={styles.sub}>
            {bookingId} · {booking?.customer_name || 'Customer'} ·{' '}
            {[booking?.bike_brand, booking?.bike_model].filter(Boolean).join(' ')}
          </Text>
        </View>

        {mechanicEstimate ? (
          <View style={styles.estimateBox}>
            <Text style={styles.estimateTitle}>Previous Estimate (read-only)</Text>
            <Text style={styles.sub}>
              {mechanicEstimate.mechanic_name || 'Legacy estimate'} ·{' '}
              {formatPhp(mechanicEstimate.total_amount)} · {mechanicEstimate.status || 'submitted'}
            </Text>
            <Text style={styles.muted}>
              Labor {formatLaborLine(mechanicEstimate.estimated_labor_hours, mechanicEstimate.hourly_rate)} ·
              Parts {formatPhp(mechanicEstimate.parts_total)} · Other{' '}
              {formatPhp(mechanicEstimate.other_charges_total)}
            </Text>
          </View>
        ) : null}

        {/* Service Labor / Rate Card */}
        <View style={styles.card}>
          <Text style={styles.sectionFirst}>Service Rate</Text>
          {isPmsFixed ? (
            <View style={styles.field}>
              <Text style={styles.label}>Fixed Service Rate (₱)</Text>
              <TextInput
                style={[styles.input, styles.tabular]}
                keyboardType="decimal-pad"
                value={serviceRate}
                onChangeText={setServiceRate}
                placeholder="0"
                {...fieldProps}
              />
              <View style={styles.inlineMetaRow}>
                <Text style={styles.calcLine}>
                  Labor subtotal: {formatPhp(Number(serviceRate || 0))}
                </Text>
                <Text style={styles.helperInline}>Fixed package fee</Text>
              </View>
            </View>
          ) : (
            <View style={styles.field}>
              <View style={styles.row}>
                <View style={styles.fieldHalf}>
                  <Text style={styles.label}>Hourly Rate (₱)</Text>
                  <TextInput
                    style={[styles.input, styles.tabular]}
                    keyboardType="decimal-pad"
                    value={hourlyRate}
                    onChangeText={setHourlyRate}
                    placeholder="150"
                    {...fieldProps}
                  />
                </View>
                <View style={styles.fieldHalf}>
                  <Text style={styles.label}>Estimated Hours</Text>
                  <TextInput
                    style={[styles.input, styles.tabular]}
                    keyboardType="decimal-pad"
                    value={estimatedHours}
                    onChangeText={setEstimatedHours}
                    placeholder="3"
                    {...fieldProps}
                  />
                </View>
              </View>
              <Text style={styles.calcLine}>
                Estimated Labor: {formatLaborLine(estimatedHours, hourlyRate)}
              </Text>
            </View>
          )}
        </View>

        {/* Parts Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionFirst}>Parts Replaced</Text>
            {parts.length > 0 ? (
              <Text style={styles.countBadge}>{parts.length} selected</Text>
            ) : null}
          </View>
          <View style={styles.searchWrap}>
            <BootstrapIcon
              name="search"
              size={13}
              color={isDarkMode ? t.placeholder : '#94A3B8'}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search inventory parts..."
              value={productSearch}
              onChangeText={setProductSearch}
              {...fieldProps}
            />
            {productSearch ? (
              <TouchableOpacity onPress={() => setProductSearch('')}>
                <BootstrapIcon name="x-circle-fill" size={14} color="#94A3B8" />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.productGrid}>
            {filteredProducts.slice(0, productSearch.trim() ? 8 : 6).map((p) => {
              const pid = p.product_id || p.id;
              const added = parts.find((x) => x.product_id === pid);
              return (
                <TouchableOpacity
                  key={pid}
                  style={[styles.productCard, added && styles.productCardAdded]}
                  onPress={() => addPart(p)}
                  activeOpacity={0.75}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.productName} numberOfLines={1}>
                      {p.name || p.product_name}
                    </Text>
                    <Text style={styles.productPrice}>
                      {formatPhp(p.price ?? p.price_php ?? 0)}
                    </Text>
                  </View>
                  <View style={[styles.addPill, added && styles.addPillActive]}>
                    <Text style={[styles.addPillText, added && styles.addPillTextActive]}>
                      {added ? `+${added.quantity}` : '+ Add'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {parts.length > 0 ? (
            <View style={styles.selectedList}>
              {parts.map((p, idx) => (
                <View key={`${p.product_id}-${idx}`} style={styles.lineItem}>
                  <Text style={styles.lineText} numberOfLines={1}>
                    {p.product_name} × {p.quantity}
                  </Text>
                  <Text style={styles.lineAmount}>
                    {formatPhp(p.quantity * p.unit_price)}
                  </Text>
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => setParts((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    <BootstrapIcon
                      name="x-lg"
                      size={12}
                      color={isDarkMode ? t.statusDangerText : '#DC2626'}
                    />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* Other Charges, Discount & Downpayment Card */}
        <View style={styles.card}>
          <Text style={styles.sectionFirst}>Other Charges</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 2, marginBottom: 0 }]}
              placeholder="Charge description"
              value={otherDesc}
              onChangeText={setOtherDesc}
              {...fieldProps}
            />
            <TextInput
              style={[styles.input, styles.tabular, { flex: 1, marginBottom: 0 }]}
              placeholder="₱ Amount"
              keyboardType="decimal-pad"
              value={otherAmount}
              onChangeText={setOtherAmount}
              {...fieldProps}
            />
            <TouchableOpacity style={styles.smallBtn} onPress={addOtherCharge}>
              <Text style={styles.smallBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
          {otherCharges.length > 0 ? (
            <View style={styles.selectedList}>
              {otherCharges.map((o, idx) => (
                <View key={`o-${idx}`} style={styles.lineItem}>
                  <Text style={styles.lineText}>{o.description}</Text>
                  <Text style={styles.lineAmount}>{formatPhp(o.amount)}</Text>
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => setOtherCharges((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    <BootstrapIcon
                      name="x-lg"
                      size={12}
                      color={isDarkMode ? t.statusDangerText : '#DC2626'}
                    />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.cardDivider} />

          <View style={styles.row}>
            <View style={styles.fieldHalf}>
              <Text style={styles.sectionInline}>Discount</Text>
              <View style={styles.rowCompact}>
                <TouchableOpacity
                  style={[styles.chip, discountType === 'fixed' && styles.chipActive]}
                  onPress={() => setDiscountType('fixed')}
                >
                  <Text
                    style={[
                      styles.chipText,
                      discountType === 'fixed' && styles.chipTextActive,
                    ]}
                  >
                    Fixed ₱
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, discountType === 'percent' && styles.chipActive]}
                  onPress={() => setDiscountType('percent')}
                >
                  <Text
                    style={[
                      styles.chipText,
                      discountType === 'percent' && styles.chipTextActive,
                    ]}
                  >
                    %
                  </Text>
                </TouchableOpacity>
                <TextInput
                  style={[styles.input, styles.tabular, { flex: 1, marginBottom: 0 }]}
                  keyboardType="decimal-pad"
                  value={discountValue}
                  onChangeText={setDiscountValue}
                  placeholder="0"
                  {...fieldProps}
                />
              </View>
            </View>

            <View style={styles.fieldHalf}>
              <Text style={styles.sectionInline}>Downpayment Policy</Text>
              <View style={styles.rowCompact}>
                <TouchableOpacity
                  style={[styles.chip, downpaymentType === 'percent' && styles.chipActive]}
                  onPress={() => setDownpaymentType('percent')}
                >
                  <Text
                    style={[
                      styles.chipText,
                      downpaymentType === 'percent' && styles.chipTextActive,
                    ]}
                  >
                    %
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, downpaymentType === 'fixed' && styles.chipActive]}
                  onPress={() => setDownpaymentType('fixed')}
                >
                  <Text
                    style={[
                      styles.chipText,
                      downpaymentType === 'fixed' && styles.chipTextActive,
                    ]}
                  >
                    Fixed
                  </Text>
                </TouchableOpacity>
                {downpaymentType === 'percent' ? (
                  <TextInput
                    style={[styles.input, styles.tabular, { flex: 1, marginBottom: 0 }]}
                    keyboardType="decimal-pad"
                    value={downpaymentPercent}
                    onChangeText={setDownpaymentPercent}
                    placeholder="30"
                    {...fieldProps}
                  />
                ) : (
                  <TextInput
                    style={[styles.input, styles.tabular, { flex: 1, marginBottom: 0 }]}
                    keyboardType="decimal-pad"
                    value={downpaymentFixed}
                    onChangeText={setDownpaymentFixed}
                    placeholder="0"
                    {...fieldProps}
                  />
                )}
              </View>
            </View>
          </View>
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
            <Text style={[styles.tableRowValue, styles.tabular]}>
              {formatPhp(estimated.laborCost)}
            </Text>
          </View>

          <View style={styles.tableRow}>
            <Text style={styles.tableRowLabel}>Parts</Text>
            <Text style={[styles.tableRowValue, styles.tabular]}>
              {formatPhp(estimated.partsTotal)}
            </Text>
          </View>

          <View style={styles.tableRow}>
            <Text style={styles.tableRowLabel}>Other Charges</Text>
            <Text style={[styles.tableRowValue, styles.tabular]}>
              {formatPhp(estimated.otherChargesTotal)}
            </Text>
          </View>

          <View style={styles.tableRow}>
            <Text style={styles.tableRowLabel}>Discount</Text>
            <Text
              style={[
                styles.tableRowValue,
                styles.tabular,
                Number(estimated.discountAmount) > 0 && {
                  color: isDarkMode ? t.statusDangerText : '#F87171',
                },
              ]}
            >
              −{formatPhp(estimated.discountAmount)}
            </Text>
          </View>

          <View style={styles.tableTotalDivider} />

          <View style={styles.tableTotalRow}>
            <Text style={styles.totalsTotalLabel}>Total</Text>
            <Text style={[styles.totalsTotalValue, styles.tabular]}>
              {formatPhp(estimated.totalAmount)}
            </Text>
          </View>

          <View style={styles.breakdownSubBox}>
            <View style={styles.tableRow}>
              <Text style={styles.tableSubLabel}>Required Downpayment</Text>
              <Text style={[styles.tableSubValueDp, styles.tabular]}>
                {formatPhp(estimated.downpaymentAmount)}
              </Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableSubLabel}>Remaining Estimated Balance</Text>
              <Text style={[styles.tableSubValueRem, styles.tabular]}>
                {formatPhp(estimated.remainingBalance)}
              </Text>
            </View>
          </View>
        </View>

        {canSendQuote ? (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.btnSecondary} onPress={saveQuotation} disabled={saving}>
              <Text style={styles.btnSecondaryText}>Save Draft</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnPrimary} onPress={sendQuotation} disabled={saving}>
              <Text style={styles.btnPrimaryText}>Send Quotation</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {canRecordPayment ? (
          <View style={[styles.card, { marginTop: 12 }]}>
            <Text style={styles.sectionFirst}>Counter Payment Recording</Text>
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.chip, payMethod === 'cash' && styles.chipActive]}
                onPress={() => setPayMethod('cash')}
              >
                <Text
                  style={[styles.chipText, payMethod === 'cash' && styles.chipTextActive]}
                >
                  Cash
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, payMethod === 'other' && styles.chipActive]}
                onPress={() => setPayMethod('other')}
              >
                <Text
                  style={[styles.chipText, payMethod === 'other' && styles.chipTextActive]}
                >
                  Other
                </Text>
              </TouchableOpacity>
              <TextInput
                style={[styles.input, styles.tabular, { flex: 1, marginBottom: 0 }]}
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

        {!isPmsFixed ? (
          <View style={[styles.card, { marginTop: 12 }]}>
            <Text style={styles.sectionFirst}>Actual Labor</Text>
            {canRecordActual ? (
              <>
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, styles.tabular, { flex: 1, marginBottom: 0 }]}
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
                {actualPreview ? (
                  <Text style={styles.calcLine}>
                    Actual Labor: {formatLaborLine(actualHours, hourlyRate)} · Final{' '}
                    {formatPhp(actualPreview.totalAmount)}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={styles.muted}>
                Available during Service In Progress.
                {actualHours ? ` Current actual: ${actualHours} hrs` : ''}
              </Text>
            )}
          </View>
        ) : null}

        {canCreateAdditional ? (
          <View style={[styles.card, { marginTop: 12 }]}>
            <Text style={styles.sectionFirst}>Additional Work</Text>
            <TextInput
              style={styles.input}
              value={addTitle}
              onChangeText={setAddTitle}
              placeholder="Title"
              {...fieldProps}
            />
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.tabular, { flex: 1, marginBottom: 0 }]}
                placeholder="Extra labor hrs"
                keyboardType="decimal-pad"
                value={addLaborHours}
                onChangeText={setAddLaborHours}
                {...fieldProps}
              />
              <TextInput
                style={[styles.input, styles.tabular, { flex: 1, marginBottom: 0 }]}
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
              <Text style={styles.btnSecondaryText}>Send Additional Charge</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.btnSecondary}
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
            <Text style={styles.btnSecondaryText}>Preview Receipt</Text>
          </TouchableOpacity>

          {canFinalize ? (
            <TouchableOpacity style={styles.btnPrimary} onPress={finalizeBill} disabled={saving}>
              <Text style={styles.btnPrimaryText}>Finalize & Generate Receipt</Text>
            </TouchableOpacity>
          ) : null}
        </View>

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
      </View>
    </View>
  );
}

function createStyles(t, isDark) {
  return StyleSheet.create({
    wrap: {
      backgroundColor: 'transparent',
    },
    content: { paddingTop: 12, paddingBottom: 4, gap: 4 },
    center: { padding: 24, alignItems: 'center', justifyContent: 'center' },
    headerBlock: { marginBottom: 10 },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: isDark ? t.textPrimary : '#0F172A',
      letterSpacing: -0.2,
    },
    sub: { fontSize: 12.5, color: isDark ? t.textMuted : '#64748B', marginTop: 2 },
    card: {
      backgroundColor: 'transparent',
      borderTopWidth: 1,
      borderTopColor: isDark ? t.border : '#F1F5F9',
      paddingVertical: 14,
      gap: 8,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    sectionFirst: {
      fontSize: 11.5,
      fontWeight: '700',
      color: isDark ? t.accentBrand : '#EA580C',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    sectionInline: {
      fontSize: 11,
      fontWeight: '700',
      color: isDark ? t.textSecondary : '#475569',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: 6,
    },
    countBadge: {
      fontSize: 11,
      fontWeight: '600',
      color: isDark ? t.accentBrand : '#EA580C',
      backgroundColor: isDark ? 'rgba(234, 88, 12, 0.14)' : '#FFF7ED',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      overflow: 'hidden',
    },
    cardDivider: {
      height: 1,
      backgroundColor: isDark ? t.border : '#F1F5F9',
      marginVertical: 6,
    },
    tabular: { fontVariant: ['tabular-nums'] },
    chip: {
      paddingHorizontal: 11,
      paddingVertical: 8,
      backgroundColor: isDark ? t.bgElevated : '#F1F5F9',
      borderWidth: 1,
      borderColor: isDark ? t.border : '#E2E8F0',
      borderRadius: 8,
    },
    chipActive: { backgroundColor: '#EA580C', borderColor: '#EA580C' },
    chipText: { fontSize: 12, color: isDark ? t.textSecondary : '#334155', fontWeight: '600' },
    chipTextActive: { color: '#FFFFFF' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    rowCompact: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    field: { width: '100%' },
    fieldHalf: { flex: 1, minWidth: 0 },
    label: {
      fontSize: 11.5,
      color: isDark ? t.textSecondary : '#475569',
      marginBottom: 5,
      fontWeight: '500',
    },
    input: {
      backgroundColor: isDark ? t.bgSub : '#FFFFFF',
      borderWidth: 1,
      borderColor: isDark ? t.borderInput : '#CBD5E1',
      borderRadius: 9,
      paddingHorizontal: 11,
      paddingVertical: 8,
      fontSize: 13.5,
      fontWeight: '600',
      color: isDark ? t.textPrimary : '#0F172A',
      marginBottom: 6,
      outlineStyle: 'none',
    },
    inlineMetaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 2,
    },
    calcLine: {
      fontSize: 12.5,
      color: isDark ? t.textPrimary : '#0F172A',
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    helperInline: { fontSize: 11.5, color: isDark ? t.textMuted : '#64748B' },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: isDark ? t.bgSub : '#FFFFFF',
      borderWidth: 1,
      borderColor: isDark ? t.borderInput : '#CBD5E1',
      borderRadius: 9,
      paddingHorizontal: 11,
      paddingVertical: 7,
    },
    searchInput: {
      flex: 1,
      fontSize: 13,
      fontWeight: '500',
      color: isDark ? t.textPrimary : '#0F172A',
      paddingVertical: 2,
      outlineStyle: 'none',
    },
    productGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    productCard: {
      width: '48.8%',
      minWidth: 170,
      flexGrow: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      backgroundColor: isDark ? t.bgSub : '#FFFFFF',
      paddingHorizontal: 11,
      paddingVertical: 9,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: isDark ? t.border : '#E2E8F0',
    },
    productCardAdded: {
      borderColor: '#EA580C',
      backgroundColor: isDark ? 'rgba(234, 88, 12, 0.08)' : '#FFF7ED',
    },
    productName: { fontSize: 12.5, fontWeight: '600', color: isDark ? t.textPrimary : '#0F172A' },
    productPrice: {
      fontSize: 11.5,
      fontWeight: '500',
      color: isDark ? t.textMuted : '#64748B',
      marginTop: 1,
      fontVariant: ['tabular-nums'],
    },
    addPill: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: isDark ? t.bgCard : '#FFFFFF',
      borderWidth: 1,
      borderColor: isDark ? t.border : '#CBD5E1',
    },
    addPillActive: {
      backgroundColor: '#EA580C',
      borderColor: '#EA580C',
    },
    addPillText: { fontSize: 11, fontWeight: '600', color: isDark ? t.textPrimary : '#334155' },
    addPillTextActive: { color: '#FFFFFF' },
    selectedList: {
      marginTop: 6,
      borderTopWidth: 1,
      borderTopColor: isDark ? t.border : '#F1F5F9',
      paddingTop: 4,
    },
    lineItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 7,
      paddingHorizontal: 2,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? t.border : '#F1F5F9',
    },
    lineText: { fontSize: 12.5, fontWeight: '500', color: isDark ? t.textSecondary : '#1E293B', flex: 1 },
    lineAmount: {
      fontSize: 12.5,
      fontWeight: '600',
      color: isDark ? t.textPrimary : '#0F172A',
      fontVariant: ['tabular-nums'],
    },
    removeBtn: { padding: 4 },
    smallBtn: {
      backgroundColor: '#EA580C',
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 8,
    },
    smallBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 12.5 },
    totalsBox: {
      backgroundColor: isDark ? '#202124' : '#F8FAFC',
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
    },
    totalsTitle: {
      fontWeight: '700',
      fontSize: 11.5,
      letterSpacing: 0.8,
      color: '#EA580C',
      marginBottom: 10,
    },
    tableHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingBottom: 4,
    },
    colHeaderLeft: {
      fontSize: 10.5,
      fontWeight: '600',
      color: isDark ? '#A1A1AA' : '#64748B',
      letterSpacing: 0.6,
    },
    colHeaderRight: {
      fontSize: 10.5,
      fontWeight: '600',
      color: isDark ? '#A1A1AA' : '#64748B',
      letterSpacing: 0.6,
    },
    tableHeaderDivider: {
      height: 1,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.10)' : '#E2E8F0',
      marginBottom: 8,
      marginTop: 4,
    },
    tableRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 3.5,
    },
    tableRowLabel: { fontSize: 13, color: isDark ? '#D4D4D8' : '#475569', fontWeight: '500' },
    tableRowValue: { fontSize: 13, color: isDark ? '#FFFFFF' : '#0F172A', fontWeight: '600' },
    tableTotalDivider: {
      height: 1,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
      marginTop: 8,
      marginBottom: 8,
    },
    tableTotalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 2,
    },
    totalsTotalLabel: { fontSize: 15, fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A' },
    totalsTotalValue: { fontSize: 16.5, fontWeight: '700', color: '#EA580C' },
    breakdownSubBox: {
      marginTop: 9,
      paddingTop: 9,
      borderTopWidth: 1,
      borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
      gap: 3,
    },
    tableSubLabel: { fontSize: 12, color: isDark ? '#A1A1AA' : '#64748B', fontWeight: '500' },
    tableSubValueDp: {
      fontSize: 12.5,
      color: isDark ? '#F5B942' : '#B45309',
      fontWeight: '600',
    },
    tableSubValueRem: {
      fontSize: 12.5,
      color: isDark ? '#FB923C' : '#EA580C',
      fontWeight: '600',
    },
    actions: { flexDirection: 'row', gap: 10, marginTop: 2 },
    btnPrimary: {
      flex: 1,
      backgroundColor: '#EA580C',
      paddingVertical: 11,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnPrimaryText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },
    btnSecondary: {
      flex: 1,
      backgroundColor: isDark ? t.bgCard : '#FFFFFF',
      borderWidth: 1,
      borderColor: isDark ? t.accentBorder : '#CBD5E1',
      paddingVertical: 11,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnSecondaryText: { color: isDark ? t.textPrimary : '#1E293B', fontWeight: '600', fontSize: 13 },
    muted: { fontSize: 12, color: isDark ? t.textMuted : '#64748B' },
    savingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
    estimateBox: {
      backgroundColor: isDark ? t.statusPurpleBg : '#EEF2FF',
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(150, 145, 165, 0.28)' : '#C7D2FE',
      gap: 3,
    },
    estimateTitle: { fontSize: 13, fontWeight: '600', color: isDark ? t.statusPurpleText : '#4338CA' },
  });
}
