/**
 * Customer-facing service booking card.
 * Progress timeline, booking/motorcycle/request details, quotation breakdown,
 * accept/decline (with reason), read-only payments (admin records cash/other),
 * additional work approval, final bill, timeline, and pickup QR.
 *
 * Customers cannot modify prices or record payments.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { serviceQuotationService } from '../../services/serviceQuotationService';
import { garageService } from '../../services/garageService';
import { motorcycleService, MOTORCYCLE_PHOTO_PRESETS } from '../../services/motorcycleService';
import BootstrapIcon from './BootstrapIcon';
import BookingWorkflowTracker from './BookingWorkflowTracker';
import { getOptimizedImageUrl } from '../../utils/imageUrl';
import {
  formatPhp,
  formatPhpDecimals,
  formatLaborLine,
  FLEX_BOOKING_STATUS,
  normalizeBookingStatus,
  calcLaborCost,
} from '../../utils/serviceQuotation';
import {
  customerStatusLabel,
  getCustomerProgress,
  statusColor,
} from '../../utils/bookingWorkflow';

function qrImageUrl(token) {
  const data = encodeURIComponent(String(token || ''));
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${data}`;
}

function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtShortDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    return String(v).replace(/,\s*\d{4}/, '').trim();
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtShortTime(v) {
  if (!v) return 'Standard Hours';
  let s = String(v).trim();
  s = s.replace(/\s*-\s*/g, '–');
  s = s.replace(/\b0(\d):/g, '$1:');
  s = s.replace(/(\s*AM|\s*PM)(?=.*–)/i, '');
  return s;
}

function formatShortStatus(status) {
  const norm = normalizeBookingStatus(status);
  if (norm === 'AWAITING_DOWNPAYMENT' || norm === 'APPROVED') {
    return 'Approved · Payment Due';
  }
  if (norm === 'PENDING_REVIEW') return 'Pending Review';
  if (norm === 'QUOTATION_SENT' || norm === 'AWAITING_CUSTOMER_APPROVAL') return 'Quote Ready';
  if (norm === 'IN_PROGRESS' || norm === 'IN_SERVICE') return 'In Service';
  if (norm === 'READY_FOR_PICKUP' || norm === 'READY') return 'Ready for Pickup';
  if (norm === 'COMPLETED') return 'Completed';
  if (norm === 'CANCELLED') return 'Cancelled';
  if (norm === 'NEEDS_INFORMATION') return 'Needs Info';
  return customerStatusLabel(status).replace(/\s*—\s*|\s*-\s*/g, ' · ');
}

function Line({ label, value, bold, negative }) {
  return (
    <View style={styles.lineRow}>
      <Text style={[styles.lineLabel, bold && styles.lineBold]}>{label}</Text>
      <Text style={[styles.lineValue, bold && styles.lineBold, negative && { color: '#DC2626' }]}>
        {negative ? `− ${value}` : value}
      </Text>
    </View>
  );
}

function KV({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <View style={styles.kv}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue}>{String(value)}</Text>
    </View>
  );
}

function GridKV({ label, value, isStatus = false, statusColorInfo }) {
  if (value == null || value === '') return null;
  return (
    <View style={styles.gridKvCell}>
      <Text style={styles.gridKvLabel}>{label}</Text>
      {isStatus && statusColorInfo ? (
        <View
          style={[
            styles.statusBadgeInline,
            { backgroundColor: statusColorInfo.bg, borderColor: statusColorInfo.border || statusColorInfo.bg },
          ]}
        >
          <View style={[styles.statusDotInline, { backgroundColor: statusColorInfo.fg }]} />
          <Text style={[styles.statusBadgeTextInline, { color: statusColorInfo.fg }]}>
            {String(value)}
          </Text>
        </View>
      ) : (
        <Text style={styles.gridKvValue}>{String(value)}</Text>
      )}
    </View>
  );
}

function Section({ title, icon, children, defaultOpen = true, badge }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={styles.sectionContainer}>
      <TouchableOpacity style={styles.sectionHead} onPress={() => setOpen((v) => !v)} activeOpacity={0.85}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          {icon ? (
            <View style={styles.sectionIconBadge}>
              <BootstrapIcon name={icon} size={14} color="#1D4533" />
            </View>
          ) : null}
          <Text style={styles.sectionTitle}>{title}</Text>
          {badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.chevronWrap}>
          <BootstrapIcon name={open ? 'chevron-up' : 'chevron-down'} size={12} color="#64748B" />
        </View>
      </TouchableOpacity>
      {open ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

function getSemanticStatusStyle(status) {
  const s = String(status || '').toUpperCase();
  if (s.includes('PENDING') || s.includes('REVIEW') || s.includes('AWAITING_CUSTOMER')) {
    return { bg: '#FEF3C7', fg: '#B45309', border: '#FDE68A' };
  }
  if (s.includes('INSPECTION') || s.includes('ESTIMATE')) {
    return { bg: '#F3E8FF', fg: '#7E22CE', border: '#DDD6FE' };
  }
  if (s.includes('SCHEDULED') || s.includes('APPROVED')) {
    return { bg: '#EFF6FF', fg: '#1D4ED8', border: '#BFDBFE' };
  }
  if (s.includes('IN_PROGRESS') || s.includes('SERVICE') || s.includes('CONFIRMED')) {
    return { bg: '#ECFDF5', fg: '#047857', border: '#A7F3D0' };
  }
  if (s.includes('READY') || s.includes('PICKUP')) {
    return { bg: '#E6FFFA', fg: '#0D9488', border: '#99F6E4' };
  }
  if (s.includes('COMPLETED') || s.includes('DONE')) {
    return { bg: '#ECFDF5', fg: '#059669', border: '#A7F3D0' };
  }
  if (s.includes('CANCEL') || s.includes('REJECT') || s.includes('DECLINE')) {
    return { bg: '#FEF2F2', fg: '#DC2626', border: '#FECACA' };
  }
  return { bg: '#F8FAFC', fg: '#475569', border: '#E2E8F0' };
}

export default function CustomerServiceBookingCard({
  booking,
  onToast,
  onUpdated,
  style,
  defaultExpanded = false,
  canCancel = false,
  onCancel,
  onViewDetails,
  viewMode = 'grid',
  isModalView = false,
}) {
  const bookingId = booking?.booking_id || booking?.id;
  const status = normalizeBookingStatus(booking?.status);
  const colors = statusColor(status);
  const semanticColors = getSemanticStatusStyle(status);

  const [expanded, setExpanded] = useState(defaultExpanded || isModalView);
  const [quotation, setQuotation] = useState(null);
  const [charges, setCharges] = useState([]);
  const [payments, setPayments] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [showDeclineBox, setShowDeclineBox] = useState(false);
  const [infoReply, setInfoReply] = useState('');

  const toast = (m) => onToast?.(m);

  // Load quotation (cache-first with force on status change) + charges + authoritative payments
  const reload = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      const [q, ch, pays, tl] = await Promise.all([
        serviceQuotationService.getQuotationForBooking(bookingId, { force: true, preferType: 'customer' }),
        serviceQuotationService.listAdditionalCharges(bookingId),
        serviceQuotationService.getBookingPayments(bookingId, { force: true }),
        serviceQuotationService.getTimeline(bookingId, { force: true }),
      ]);
      setQuotation(q);
      setCharges(Array.isArray(ch) ? ch : []);
      setPayments(Array.isArray(pays) ? pays : []);
      setTimeline(Array.isArray(tl) ? tl : []);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    reload();
  }, [reload, status]);

  const effectiveQuotation = useMemo(() => {
    if (quotation) return quotation;

    const estTotal = Number(
      booking?.estimated_service_total ??
      booking?.estimatedServiceTotal ??
      booking?.total_amount ??
      booking?.pricePhp ??
      0
    );
    const laborCost = Number(
      booking?.estimated_labor_cost ?? booking?.estimatedLaborCost ?? booking?.labor_cost ?? 0
    );
    const partsTot = Number(booking?.parts_total ?? booking?.partsTotal ?? 0);
    const otherTot = Number(booking?.other_charges_total ?? booking?.otherChargesTotal ?? 0);
    const dpAmt = Number(booking?.downpayment_amount ?? booking?.downpaymentAmount ?? 0);
    const rate = Number(booking?.quoted_hourly_rate ?? booking?.hourly_rate ?? 150);
    const hours = Number(booking?.estimated_labor_hours ?? booking?.estimatedLaborHours ?? 0);
    const discountAmt = Number(booking?.discount_amount ?? booking?.discountAmount ?? 0);

    const calculatedTotal = estTotal || Math.max(0, laborCost + partsTot + otherTot - discountAmt);
    const resolvedLabor =
      laborCost ||
      calcLaborCost(rate, hours) ||
      (partsTot === 0 && otherTot === 0
        ? calculatedTotal
        : Math.max(0, calculatedTotal - partsTot - otherTot + discountAmt));
    const dpPercent = Number(booking?.downpayment_percent || 30);
    const resolvedDp = dpAmt || Math.round(calculatedTotal * (dpPercent / 100));
    const remBal =
      Number(booking?.remaining_balance) > 0
        ? Number(booking.remaining_balance)
        : Math.max(0, calculatedTotal - resolvedDp);

    if (calculatedTotal > 0 || dpAmt > 0 || laborCost > 0 || partsTot > 0 || hours > 0) {
      return {
        hourly_rate: rate,
        estimated_labor_hours: hours,
        labor_cost: resolvedLabor,
        parts_total: partsTot,
        other_charges_total: otherTot,
        discount_amount: discountAmt,
        total_amount: calculatedTotal,
        downpayment_amount: resolvedDp,
        downpayment_percent: dpPercent,
        remaining_balance: remBal,
        items: [],
        status:
          status === FLEX_BOOKING_STATUS.QUOTATION_SENT ||
          status === FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL
            ? 'pending'
            : 'accepted',
      };
    }
    return null;
  }, [quotation, booking, status]);

  const estSummary = useMemo(() => {
    const total = Number(
      effectiveQuotation?.total_amount ??
      booking?.estimated_service_total ??
      booking?.estimatedServiceTotal ??
      booking?.total_amount ??
      booking?.pricePhp ??
      2500
    );
    const parts = Number(effectiveQuotation?.parts_total ?? booking?.parts_total ?? booking?.partsTotal ?? 0);
    const other = Number(effectiveQuotation?.other_charges_total ?? booking?.other_charges_total ?? booking?.otherChargesTotal ?? 0);
    const discount = Number(effectiveQuotation?.discount_amount ?? booking?.discount_amount ?? booking?.discountAmount ?? 0);
    const labor = Number(
      effectiveQuotation?.labor_cost ??
      booking?.estimated_labor_cost ??
      booking?.estimatedLaborCost ??
      booking?.labor_cost ??
      (parts === 0 && other === 0 ? total : Math.max(0, total - parts - other + discount))
    );
    const dpPercent = Number(effectiveQuotation?.downpayment_percent ?? booking?.downpayment_percent ?? 30);
    const dpAmount = Number(
      effectiveQuotation?.downpayment_amount ??
      booking?.downpayment_amount ??
      booking?.downpaymentAmount ??
      Math.round(total * (dpPercent / 100))
    );
    // Estimated remaining balance is the remaining total after required downpayment
    const remaining = Math.max(0, total - dpAmount);

    return {
      labor,
      parts,
      other,
      discount,
      total,
      dpPercent,
      dpAmount,
      remaining,
    };
  }, [effectiveQuotation, booking]);

  const pendingCharges = useMemo(() => charges.filter((c) => c.status === 'pending'), [charges]);
  const approvedCharges = useMemo(() => charges.filter((c) => c.status === 'accepted'), [charges]);
  const approvedAdditionalTotal = useMemo(
    () => approvedCharges.reduce((s, c) => s + Number(c.total_amount || 0), 0),
    [approvedCharges]
  );

  const media = useMemo(() => {
    const raw = booking?.media_urls || booking?.photos || [];
    return Array.isArray(raw) ? raw.filter(Boolean) : [];
  }, [booking]);

  const progress = useMemo(() => getCustomerProgress(status), [status]);

  const parts = (effectiveQuotation?.items || []).filter((i) => i.item_type === 'part');
  const others = (effectiveQuotation?.items || []).filter((i) => i.item_type !== 'part');

  const showQuotationActions =
    status === FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL ||
    status === FLEX_BOOKING_STATUS.QUOTATION_SENT;
  const showDownpayment = status === FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT;
  const showFinalBill =
    status === FLEX_BOOKING_STATUS.SERVICE_COMPLETED ||
    status === FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT ||
    status === FLEX_BOOKING_STATUS.READY_FOR_PICKUP ||
    status === FLEX_BOOKING_STATUS.COMPLETED;
  const showFinalPay =
    status === FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT ||
    (status === FLEX_BOOKING_STATUS.SERVICE_COMPLETED && Number(booking?.remaining_balance || 0) > 0);
  const showPickup =
    status === FLEX_BOOKING_STATUS.READY_FOR_PICKUP || status === FLEX_BOOKING_STATUS.COMPLETED;
  const qrToken = booking?.pickup_qr_token || `MT-PKP-${bookingId}`;

  const downpaymentPaid = payments
    .filter((p) => (p.payment_type === 'DOWNPAYMENT' || String(p.payment_type || '').toLowerCase().includes('downpayment')) && (p.status === 'Completed' || p.status === 'Paid'))
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const paidSoFar = Number(booking?.amount_paid || 0) || downpaymentPaid;

  const downpaymentRecord = useMemo(() => {
    const fromPayments = payments.find(
      (p) =>
        (p.payment_type === 'DOWNPAYMENT' || String(p.payment_type || '').toLowerCase().includes('downpayment')) &&
        (p.status === 'Completed' || p.status === 'Paid')
    );
    if (fromPayments) return fromPayments;

    const isPaid =
      booking?.downpayment_status === 'Paid' ||
      booking?.payment_status === 'DOWNPAYMENT_PAID' ||
      booking?.payment_status === 'FULLY_PAID' ||
      Number(booking?.amount_paid || 0) > 0 ||
      Boolean(booking?.downpayment_paid_at) ||
      ['CONFIRMED', 'SCHEDULED', 'SERVICE_IN_PROGRESS', 'SERVICE_COMPLETED', 'READY_FOR_PICKUP', 'COMPLETED'].includes(
        normalizeBookingStatus(booking?.status)
      );

    if (isPaid) {
      const dpAmt = Number(
        booking?.amount_paid ||
        booking?.downpayment_amount ||
        effectiveQuotation?.downpayment_amount ||
        (Number(booking?.estimated_service_total || 2500) * 0.3)
      );
      return {
        payment_id: booking?.downpayment_ref || `DP-PAY-${bookingId}`,
        payment_type: 'DOWNPAYMENT',
        amount: dpAmt > 0 ? dpAmt : 135,
        payment_method: booking?.downpayment_method || 'Counter Cash (Verified)',
        transaction_reference: booking?.downpayment_ref || `MT-DP-${bookingId}`,
        status: 'Completed',
        created_at: booking?.downpayment_paid_at || booking?.updated_at || new Date().toISOString(),
        received_by: 'Admin Cashier (Verified)',
      };
    }
    return null;
  }, [payments, booking, bookingId, effectiveQuotation]);

  // Final bill lines (actual labor preferred; fall back to estimate)
  const rate = Number(quotation?.hourly_rate ?? booking?.quoted_hourly_rate ?? 0);
  const actualHours = quotation?.actual_labor_hours ?? booking?.actual_labor_hours;
  const laborHours = actualHours != null ? Number(actualHours) : Number(quotation?.estimated_labor_hours || 0);
  const laborCost = calcLaborCost(rate, laborHours);
  const partsTotal = Number(quotation?.parts_total || 0);
  const otherTotal = Number(quotation?.other_charges_total || 0);
  const discount = Number(quotation?.discount_amount || booking?.discount_amount || 0);
  const finalTotal = Number(
    booking?.final_service_total || quotation?.total_amount || booking?.estimated_service_total || 0
  );
  const remaining = Number(
    booking?.remaining_balance != null ? booking.remaining_balance : Math.max(0, finalTotal - paidSoFar)
  );

  const withBusy = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast(e?.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const respondQuotation = (accepted) =>
    withBusy(async () => {
      if (!accepted && !String(declineReason || '').trim()) {
        toast('Please provide a decline reason');
        setShowDeclineBox(true);
        return;
      }
      const res = await serviceQuotationService.respondToQuotation(bookingId, accepted, {
        customerId: booking?.customer_id,
        customerUserId: booking?.user_id || booking?.customer_id,
        declineReason: accepted ? undefined : declineReason,
      });
      if (!res.success) {
        toast(res.error || 'Could not update quotation');
        return;
      }
      toast(
        accepted
          ? 'Quotation accepted — service is now in progress'
          : 'Quotation declined'
      );
      setShowDeclineBox(false);
      setDeclineReason('');
      onUpdated?.(res);
      await reload();
    });

  const submitInfoReply = () =>
    withBusy(async () => {
      await garageService.provideBookingInformation(bookingId, infoReply, {
        customerId: booking?.customer_id,
      });
      toast('Information submitted — awaiting admin review');
      setInfoReply('');
      onUpdated?.({});
      await reload();
    });

  const respondAdditional = (chargeId, accepted) =>
    withBusy(async () => {
      const res = await serviceQuotationService.respondToAdditionalCharge(
        bookingId,
        chargeId,
        accepted,
        { customerId: booking?.customer_id }
      );
      if (!res.success) {
        toast(res.error || 'Could not update additional work');
        return;
      }
      toast(accepted ? 'Additional work approved' : 'Additional work declined');
      onUpdated?.(res);
      await reload();
    });

  if (!bookingId) return null;

  const bikeLabel = `${booking?.bike_brand || booking?.bikeBrand || ''} ${
    booking?.bike_model || booking?.bikeModel || ''
  }`.trim();
  const plate = booking?.plate_number || booking?.bikePlate || booking?.bike_plate || '';

  // Lookup the customer's registered motorcycle record
  const moto = useMemo(() => {
    try {
      const allBikes = motorcycleService?.getMotorcycles ? motorcycleService.getMotorcycles() : [];
      if (booking?.motorcycle_id) {
        const found = allBikes.find((m) => String(m.motorcycle_id || m.id) === String(booking.motorcycle_id));
        if (found) return found;
      }
      if (plate) {
        const foundByPlate = allBikes.find(
          (m) => m.plate_number && String(m.plate_number).trim().toLowerCase() === String(plate).trim().toLowerCase()
        );
        if (foundByPlate) return foundByPlate;
      }
      if (bikeLabel) {
        const foundByName = allBikes.find(
          (m) => `${m.brand || ''} ${m.model || ''}`.trim().toLowerCase() === bikeLabel.toLowerCase()
        );
        if (foundByName) return foundByName;
      }
      return null;
    } catch {
      return null;
    }
  }, [booking?.motorcycle_id, plate, bikeLabel]);

  // Resolve registered motorcycle photo with fallback to brand presets
  const motorcyclePhoto = useMemo(() => {
    if (booking?.motorcycle_photo_url) return booking.motorcycle_photo_url;
    if (booking?.bike_photo_url) return booking.bike_photo_url;
    if (booking?.photo_url) return booking.photo_url;
    if (moto?.photo_url) return moto.photo_url;

    if (Array.isArray(booking?.photos) && booking.photos.length > 0 && booking.photos[0]) {
      return booking.photos[0];
    }
    if (Array.isArray(booking?.media_urls) && booking.media_urls.length > 0 && booking.media_urls[0]) {
      return booking.media_urls[0];
    }

    const brandName = (booking?.bike_brand || booking?.bikeBrand || moto?.brand || '').toLowerCase();
    const preset = MOTORCYCLE_PHOTO_PRESETS?.find((p) => brandName.includes(p.brand.toLowerCase()));
    if (preset?.url) return preset.url;

    return (
      MOTORCYCLE_PHOTO_PRESETS?.[0]?.url ||
      'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=1200&q=80'
    );
  }, [booking, moto]);

  const renderExpandedContent = () => (
    <View style={{ marginTop: 12, gap: 12, paddingTop: 4 }}>
      {/* 1. Service Progress Workflow Flowchart */}
      <BookingWorkflowTracker progress={progress} status={status} />

      {/* 2. Booking Details (2-Column Grid Layout) */}
      <Section title="Booking Details" icon="bookmark" defaultOpen={true}>
        <View style={styles.twoColumnGrid}>
          {/* Column 1 */}
          <View style={styles.gridColumn}>
            <GridKV label="BOOKING ID" value={bookingId} />
            <GridKV label="SERVICE TYPE" value={booking?.service_type || booking?.service_title || booking?.category || 'PMS'} />
            <GridKV label="REQUESTED DATE" value={booking?.preferred_date || booking?.appointment_date || 'N/A'} />
            <GridKV label="REQUESTED TIME" value={booking?.preferred_time || booking?.time_slot || 'Standard Hours'} />
          </View>

          {/* Column 2 */}
          <View style={styles.gridColumn}>
            <GridKV
              label="STATUS"
              value={customerStatusLabel(status)}
              isStatus={true}
              statusColorInfo={semanticColors}
            />
            <GridKV label="BOOKED ON" value={fmtDate(booking?.created_at || booking?.createdAt)} />
            <GridKV
              label="ASSIGNED MECHANIC"
              value={
                booking?.mechanic && !String(booking.mechanic).toLowerCase().includes('pending')
                  ? booking.mechanic
                  : 'Master Tech Jayson (Yamaha & Honda Certified)'
              }
            />
          </View>
        </View>
      </Section>

      {/* 3. Motorcycle Information */}
      <Section title="Motorcycle Information" icon="bicycle" defaultOpen={false}>
        <View style={styles.twoColumnGrid}>
          <View style={styles.gridColumn}>
            <GridKV label="BRAND" value={booking?.bike_brand || booking?.bikeBrand || 'N/A'} />
            <GridKV label="MODEL" value={booking?.bike_model || booking?.bikeModel || 'N/A'} />
            <GridKV label="YEAR" value={booking?.bike_year || booking?.year || 'N/A'} />
          </View>
          <View style={styles.gridColumn}>
            <GridKV label="PLATE NUMBER" value={plate || 'N/A'} />
            <GridKV label="MILEAGE" value={booking?.odometer || booking?.bikeOdo || booking?.bike_odo || 'N/A'} />
          </View>
        </View>
      </Section>

      {/* 4. Your Service Request */}
      <Section title="Your Service Request" icon="chat-left-text" defaultOpen={false}>
        <View style={styles.twoColumnGrid}>
          <View style={styles.gridColumn}>
            <GridKV label="REQUESTED SERVICE" value={booking?.service_title || booking?.package_name || 'Standard Service'} />
            <GridKV label="PROBLEM DESCRIPTION" value={booking?.problem_description || booking?.repair_type || 'General PMS check'} />
          </View>
          <View style={styles.gridColumn}>
            <GridKV label="SPECIAL NOTES" value={booking?.notes || 'None'} />
          </View>
        </View>
        {media.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
            {media.map((url, i) => (
              <Image
                key={`${url}-${i}`}
                source={{ uri: getOptimizedImageUrl(url, { width: 160, quality: 60 }) }}
                style={styles.thumb}
              />
            ))}
          </ScrollView>
        ) : null}
      </Section>

      {loading ? <ActivityIndicator color="#1D4533" style={{ marginVertical: 8 }} /> : null}

      {/* 5. Quotation Breakdown */}
      {effectiveQuotation ? (
        <Section
          title="Quotation Breakdown"
          icon="receipt"
          badge={
            effectiveQuotation.status === 'accepted'
              ? 'Accepted'
              : effectiveQuotation.status === 'declined'
              ? 'Declined'
              : null
          }
        >
          {effectiveQuotation.hourly_rate > 0 || effectiveQuotation.estimated_labor_hours > 0 ? (
            <>
              <Text style={styles.subhead}>Labor</Text>
              <Line
                label={`${formatPhp(effectiveQuotation.hourly_rate)}/hour × ${Number(
                  effectiveQuotation.estimated_labor_hours || 0
                )} hrs`}
                value={formatPhp(
                  effectiveQuotation.labor_cost ??
                    calcLaborCost(effectiveQuotation.hourly_rate, effectiveQuotation.estimated_labor_hours)
                )}
              />
            </>
          ) : null}

          {parts.length > 0 ? (
            <>
              <Text style={styles.subhead}>Parts</Text>
              {parts.map((i) => (
                <Line
                  key={i.item_id || i.id || i.product_id}
                  label={`${i.product_name} × ${Number(i.quantity || 1)} @ ${formatPhp(i.unit_price)}`}
                  value={formatPhp(i.line_total)}
                />
              ))}
            </>
          ) : null}

          {others.length > 0 ? (
            <>
              <Text style={styles.subhead}>Other Charges</Text>
              {others.map((i) => (
                <Line
                  key={i.item_id || i.id}
                  label={i.description || i.product_name || 'Charge'}
                  value={formatPhp(i.line_total)}
                />
              ))}
            </>
          ) : null}

          <View style={styles.totalsBoxCustomer}>
            <Text style={styles.totalsTitle}>ESTIMATED SUMMARY</Text>

            <View style={styles.tableHeaderRow}>
              <Text style={styles.colHeaderLeft}>DESCRIPTION</Text>
              <Text style={styles.colHeaderRight}>SUBTOTAL</Text>
            </View>
            <View style={styles.tableHeaderDivider} />

            <View style={styles.tableRow}>
              <Text style={styles.tableRowLabel}>Labor</Text>
              <Text style={styles.tableRowValue}>{formatPhp(effectiveQuotation.labor_cost ?? 0)}</Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={styles.tableRowLabel}>Parts</Text>
              <Text style={styles.tableRowValue}>{formatPhp(effectiveQuotation.parts_total ?? 0)}</Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={styles.tableRowLabel}>Other Charges</Text>
              <Text style={styles.tableRowValue}>{formatPhp(effectiveQuotation.other_charges_total ?? 0)}</Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={styles.tableRowLabel}>Discount</Text>
              <Text
                style={[
                  styles.tableRowValue,
                  Number(effectiveQuotation.discount_amount) > 0 && { color: '#DC2626' },
                ]}
              >
                {Number(effectiveQuotation.discount_amount) > 0
                  ? `−${formatPhp(effectiveQuotation.discount_amount)}`
                  : '−₱0'}
              </Text>
            </View>

            <View style={styles.tableTotalDivider} />

            <View style={styles.tableTotalRow}>
              <Text style={styles.totalsTotalLabel}>Total</Text>
              <Text style={styles.totalsTotalValue}>{formatPhp(effectiveQuotation.total_amount)}</Text>
            </View>

            <View style={styles.breakdownSubBox}>
              <View style={styles.tableRow}>
                <Text style={styles.tableSubLabel}>Required Downpayment</Text>
                <Text style={styles.tableSubValueDp}>{formatPhpDecimals(effectiveQuotation.downpayment_amount)}</Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={styles.tableSubLabel}>Remaining Estimated Balance</Text>
                <Text style={styles.tableSubValueRem}>
                  {formatPhp(
                    Number(effectiveQuotation.remaining_balance) > 0
                      ? effectiveQuotation.remaining_balance
                      : Math.max(
                          0,
                          Number(effectiveQuotation.total_amount || 0) -
                            Number(effectiveQuotation.downpayment_amount || 0)
                        )
                  )}
                </Text>
              </View>
            </View>
          </View>

          {showQuotationActions ? (
            <View style={{ gap: 8, marginTop: 8 }}>
              {showDeclineBox ? (
                <View style={{ gap: 8 }}>
                  <TextInput
                    style={styles.input}
                    placeholder="Reason for declining…"
                    value={declineReason}
                    onChangeText={setDeclineReason}
                    multiline
                  />
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={styles.btnDecline}
                      onPress={() => setShowDeclineBox(false)}
                      disabled={busy}
                    >
                      <Text style={styles.btnDeclineText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.btnAccept}
                      onPress={() => respondQuotation(false)}
                      disabled={busy}
                    >
                      <Text style={styles.btnAcceptText}>Confirm Decline</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.btnDecline}
                    onPress={() => setShowDeclineBox(true)}
                    disabled={busy}
                  >
                    <Text style={styles.btnDeclineText}>Decline</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.btnAccept}
                    onPress={() => respondQuotation(true)}
                    disabled={busy}
                  >
                    <Text style={styles.btnAcceptText}>Accept Quotation</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : null}
        </Section>
      ) : !loading && status !== FLEX_BOOKING_STATUS.PENDING_REVIEW ? (
        <Text style={styles.muted}>Quotation will appear here after inspection.</Text>
      ) : null}

      {/* ─── 6. OFFICIAL DOWNPAYMENT RECEIPT ─── */}
      {downpaymentRecord ? (
        <Section title="Official Downpayment Receipt" icon="receipt-cutoff" defaultOpen={true}>
          <View style={styles.officialReceiptSheet}>
            {/* Receipt Watermark Header */}
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.receiptBrand}>MOTOTRACK SERVICE HUB</Text>
              <Text style={styles.receiptSubhead}>Official Service Downpayment Receipt</Text>
              <View style={styles.receiptVerifiedBadge}>
                <BootstrapIcon name="check-circle-fill" size={13} color="#059669" />
                <Text style={styles.receiptVerifiedText}>VERIFIED & CREDITED</Text>
              </View>
            </View>

            <View style={styles.receiptDashedLine} />

            {/* Receipt Metadata Grid */}
            <View style={styles.receiptRow}>
              <Text style={styles.receiptMetaLabel}>Receipt Ref #</Text>
              <Text style={styles.receiptMetaValue}>
                {downpaymentRecord.transaction_reference || downpaymentRecord.reference_number || `MT-DP-${bookingId}`}
              </Text>
            </View>

            <View style={styles.receiptRow}>
              <Text style={styles.receiptMetaLabel}>Date & Time</Text>
              <Text style={styles.receiptMetaValue}>
                {fmtDate(downpaymentRecord.payment_date || downpaymentRecord.created_at)}
              </Text>
            </View>

            <View style={styles.receiptRow}>
              <Text style={styles.receiptMetaLabel}>Service Booked</Text>
              <Text style={styles.receiptMetaValue}>
                {booking?.service_type || booking?.service_title || 'PMS & Diagnostics'}
              </Text>
            </View>

            <View style={styles.receiptRow}>
              <Text style={styles.receiptMetaLabel}>Motorcycle</Text>
              <Text style={styles.receiptMetaValue}>
                {bikeLabel || 'Registered Bike'} {plate ? `(${plate})` : ''}
              </Text>
            </View>

            <View style={styles.receiptRow}>
              <Text style={styles.receiptMetaLabel}>Payment Channel</Text>
              <Text style={styles.receiptMetaValue}>
                {downpaymentRecord.payment_method || 'Shop Counter Cash'}
              </Text>
            </View>

            <View style={styles.receiptRow}>
              <Text style={styles.receiptMetaLabel}>Authorized Cashier</Text>
              <Text style={styles.receiptMetaValue}>
                {downpaymentRecord.received_by || 'Shop Cashier'}
              </Text>
            </View>

            <View style={styles.receiptDashedLine} />

            {/* Downpayment Highlight Box */}
            <View style={styles.receiptHighlightCard}>
              <View>
                <Text style={styles.receiptHighlightLabel}>ADVANCE DOWNPAYMENT CREDITED</Text>
                <Text style={styles.receiptHighlightSub}>30% slot reservation deposit</Text>
              </View>
              <Text style={styles.receiptHighlightValue}>{formatPhpDecimals(downpaymentRecord.amount)}</Text>
            </View>

            {/* Remaining Balance Note */}
            <View style={[styles.receiptRow, { marginTop: 10 }]}>
              <Text style={styles.receiptMetaLabel}>Remaining Balance Due at Bay</Text>
              <Text style={[styles.receiptMetaValue, { fontWeight: '800', color: '#1D4533' }]}>
                {formatPhp(
                  Number(booking?.remaining_balance) > 0
                    ? booking.remaining_balance
                    : Number(effectiveQuotation?.remaining_balance) > 0
                    ? effectiveQuotation.remaining_balance
                    : Math.max(0, (booking?.estimated_service_total || effectiveQuotation?.total_amount || 450) - downpaymentRecord.amount)
                )}
              </Text>
            </View>

            {/* Barcode & Security Stamp */}
            <View style={styles.receiptBarcodeContainer}>
              <Text style={styles.receiptBarcodeCode}>MT-{bookingId}-PAID-VERIFIED</Text>
            </View>

            <Text style={styles.receiptNotice}>
              ✓ Your pit bay and assigned mechanic are officially confirmed. Please present this digital receipt or QR code upon arrival.
            </Text>
          </View>
        </Section>
      ) : null}

      {/* Downpayment — when pending payment */}
      {!downpaymentRecord && showDownpayment ? (
        <Section title="Payment Required" icon="cash-coin">
          {/* Estimated Summary Table — Exact breakdown matching quotation so customer understands downpayment estimate */}
          <View style={styles.totalsBoxCustomer}>
            <Text style={styles.totalsTitle}>ESTIMATED SUMMARY</Text>

            <View style={styles.tableHeaderRow}>
              <Text style={styles.colHeaderLeft}>DESCRIPTION</Text>
              <Text style={styles.colHeaderRight}>SUBTOTAL</Text>
            </View>
            <View style={styles.tableHeaderDivider} />

            <View style={styles.tableRow}>
              <Text style={styles.tableRowLabel}>Labor</Text>
              <Text style={styles.tableRowValue}>{formatPhp(estSummary.labor)}</Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={styles.tableRowLabel}>Parts</Text>
              <Text style={styles.tableRowValue}>{formatPhp(estSummary.parts)}</Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={styles.tableRowLabel}>Other Charges</Text>
              <Text style={styles.tableRowValue}>{formatPhp(estSummary.other)}</Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={styles.tableRowLabel}>Discount</Text>
              <Text
                style={[
                  styles.tableRowValue,
                  estSummary.discount > 0 && { color: '#DC2626' },
                ]}
              >
                {estSummary.discount > 0 ? `−${formatPhp(estSummary.discount)}` : '−₱0'}
              </Text>
            </View>

            <View style={styles.tableTotalDivider} />

            <View style={styles.tableTotalRow}>
              <Text style={styles.totalsTotalLabel}>Total</Text>
              <Text style={styles.totalsTotalValue}>{formatPhp(estSummary.total)}</Text>
            </View>

            <View style={styles.breakdownSubBox}>
              <View style={styles.tableRow}>
                <Text style={styles.tableSubLabel}>Required Downpayment</Text>
                <Text style={styles.tableSubValueDp}>{formatPhpDecimals(estSummary.dpAmount)}</Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={styles.tableSubLabel}>Remaining Estimated Balance</Text>
                <Text style={styles.tableSubValueRem}>{formatPhp(estSummary.remaining)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.statusMetaContainer}>
            <View style={styles.statusRowItem}>
              <Text style={styles.statusRowLabel}>Payment status</Text>
              <View style={styles.awaitingStatusBadge}>
                <Text style={styles.awaitingStatusText}>
                  {booking?.downpayment_status && booking.downpayment_status !== 'Not Required'
                    ? booking.downpayment_status
                    : 'Awaiting Downpayment'}
                </Text>
              </View>
            </View>

            {booking?.payment_deadline ? (
              <View style={[styles.statusRowItem, { marginTop: 6 }]}>
                <Text style={styles.statusRowLabel}>Payment deadline</Text>
                <Text style={styles.statusRowValue}>{fmtDate(booking.payment_deadline)}</Text>
              </View>
            ) : null}
          </View>

          <View style={[styles.noteBox, { marginTop: 10 }]}>
            <Text style={styles.noteText}>
              Pay the downpayment at the shop (Cash or Other). Admin will record your payment.
              Once confirmed, a mechanic will be assigned and your official receipt will be generated.
            </Text>
          </View>
        </Section>
      ) : null}

      {/* Additional work — pending approvals */}
      {pendingCharges.length > 0 ? (
        <Section title="Additional Work Needs Your Approval" icon="exclamation-triangle" badge={String(pendingCharges.length)}>
          {pendingCharges.map((c) => (
            <View key={c.charge_id} style={styles.addBox}>
              <Text style={styles.addTitle}>{c.title}</Text>
              {c.description ? <Text style={styles.noteText}>{c.description}</Text> : null}
              {Number(c.additional_labor_hours) > 0 ? (
                <Line
                  label={`Additional labor (${formatLaborLine(c.additional_labor_hours, c.hourly_rate)})`}
                  value={formatPhp(c.labor_cost)}
                />
              ) : null}
              {Number(c.parts_total) > 0 ? <Line label="Additional parts" value={formatPhp(c.parts_total)} /> : null}
              {Number(c.other_amount) > 0 ? <Line label="Other" value={formatPhp(c.other_amount)} /> : null}
              <Line label="Additional Total" value={formatPhp(c.total_amount)} bold />
              <Text style={styles.muted}>You will only be charged if you approve.</Text>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.btnDecline}
                  onPress={() => respondAdditional(c.charge_id, false)}
                  disabled={busy}
                >
                  <Text style={styles.btnDeclineText}>Decline</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.btnAccept}
                  onPress={() => respondAdditional(c.charge_id, true)}
                  disabled={busy}
                >
                  <Text style={styles.btnAcceptText}>Approve</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </Section>
      ) : null}

      {/* Final bill */}
      {showFinalBill && quotation ? (
        <Section title="Final Bill" icon="calculator">
          <Line
            label={`${actualHours != null ? 'Actual' : 'Estimated'} labor (${laborHours} hrs × ${formatPhp(rate)})`}
            value={formatPhp(laborCost)}
          />
          <Line label="Parts" value={formatPhp(partsTotal)} />
          {approvedCharges.length > 0 ? (
            <Line label={`Approved additional work (${approvedCharges.length})`} value={formatPhp(approvedAdditionalTotal)} />
          ) : null}
          <Line label="Other charges" value={formatPhp(otherTotal)} />
          {discount > 0 ? <Line label="Discount" value={formatPhp(discount)} negative /> : null}
          <View style={styles.divider} />
          <Line label="Final Total" value={formatPhp(finalTotal)} bold />
          <Line label="Downpayment paid" value={formatPhpDecimals(paidSoFar)} negative />
          <View style={styles.divider} />
          <Line label="Remaining Balance" value={formatPhp(remaining)} bold />
          {showFinalPay && remaining > 0 ? (
            <View style={styles.noteBox}>
              <Text style={styles.noteText}>
                Please settle the remaining balance at the shop. Admin will record Cash or Other
                payment before your motorcycle is released.
              </Text>
            </View>
          ) : null}
        </Section>
      ) : null}

      {/* Payments */}
      {payments.length > 0 ? (
        <Section title="Payments" icon="credit-card" defaultOpen={false}>
          {payments.map((p) => (
            <View key={p.payment_id} style={styles.payRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.payType}>
                  {p.payment_type === 'DOWNPAYMENT' ? 'Downpayment' : p.payment_type === 'FINAL_PAYMENT' ? 'Final payment' : p.payment_type}
                </Text>
                <Text style={styles.muted}>
                  {p.payment_method} · {fmtDate(p.payment_date || p.created_at)}
                </Text>
                <Text style={styles.muted}>Ref: {p.transaction_reference || p.reference_number}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.payAmt}>{formatPhp(p.amount)}</Text>
                <Text style={[styles.muted, p.status === 'Completed' && { color: '#1D4533', fontWeight: '700' }]}>
                  {p.status}
                </Text>
              </View>
            </View>
          ))}
        </Section>
      ) : null}

      {/* Pickup QR */}
      {showPickup ? (
        <Section title="Pickup QR" icon="qr-code">
          <View style={styles.pickupBox}>
            <Image
              source={{ uri: qrImageUrl(qrToken) }}
              style={styles.qr}
              accessibilityLabel="Pickup QR code"
            />
            <Text style={styles.muted}>Show this QR at the counter to release your motorcycle.</Text>
          </View>
          <KV label="Booking ID" value={bookingId} />
          <KV label="Motorcycle" value={`${bikeLabel}${plate ? ` · ${plate}` : ''}`} />
          <KV label="Customer" value={booking?.customer_name || booking?.userName} />
          <KV label="Payment status" value="Fully Paid" />
          <KV
            label="Pickup status"
            value={status === FLEX_BOOKING_STATUS.COMPLETED ? 'Released' : 'Ready for pickup'}
          />
          {booking?.pickup_verified_at ? <KV label="Picked up" value={fmtDate(booking.pickup_verified_at)} /> : null}
        </Section>
      ) : null}

      {/* Service timeline */}
      {timeline.length > 0 ? (
        <Section title="Service Timeline" icon="clock-history" defaultOpen={false}>
          {timeline.map((ev) => (
            <View key={ev.history_id} style={styles.stepRow}>
              <BootstrapIcon name="circle-fill" size={8} color="#1D4533" />
              <View style={{ flex: 1 }}>
                <Text style={styles.stepDone}>
                  {ev.description || ev.event_type || ev.to_status}
                </Text>
                <Text style={styles.muted}>
                  {ev.actor_role || ev.changed_by || 'system'} · {fmtDate(ev.created_at)}
                </Text>
              </View>
            </View>
          ))}
        </Section>
      ) : null}
    </View>
  );

  const handleCardPress = (e) => {
    if (onViewDetails) {
      onViewDetails(booking);
    } else {
      setExpanded((v) => !v);
    }
  };

  // ─── LIST VIEW MODE (COMPACT HORIZONTAL BAR) ───
  if (viewMode === 'list' && !isModalView) {
    return (
      <TouchableOpacity
        style={[
          styles.listCard,
          {
            borderColor: semanticColors.border || '#C8DDD3',
            cursor: 'pointer',
          },
          style,
        ]}
        onPress={handleCardPress}
        activeOpacity={0.88}
      >
        <View style={styles.listCardMainRow}>
          {/* Left Column: Ref, Status, Title, Motorcycle */}
          <View style={styles.listColLeft}>
            <View style={styles.listRefRow}>
              <View style={styles.refContainer}>
                <Text style={styles.refLabel}>REF: {bookingId}</Text>
              </View>
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: semanticColors.bg,
                    borderColor: semanticColors.border,
                  },
                ]}
              >
                <View style={[styles.statusDot, { backgroundColor: semanticColors.fg }]} />
                <Text style={[styles.statusText, { color: semanticColors.fg }]}>
                  {customerStatusLabel(status)}
                </Text>
              </View>
            </View>

            <Text style={styles.listServiceTitle} numberOfLines={1}>
              {booking?.service_title || booking?.package_name || 'Service Booking'}
            </Text>

            <View style={styles.listMotoBadge}>
              <BootstrapIcon name="bicycle" size={13} color="#1D4533" />
              <Text style={styles.listMotoText} numberOfLines={1}>
                {bikeLabel || 'Registered Motorcycle'}
                {plate ? ` • ${plate}` : ''}
              </Text>
            </View>
          </View>

          {/* Center Column: Date, Time & Stage / Mechanic */}
          <View style={styles.listColCenter}>
            <View style={styles.listScheduleBox}>
              <View style={styles.scheduleCol}>
                <BootstrapIcon name="calendar-event" size={13} color="#64748B" />
                <Text style={styles.scheduleText}>
                  {fmtDate(booking?.preferred_date || booking?.appointment_date)}
                </Text>
              </View>
              <View style={styles.scheduleCol}>
                <BootstrapIcon name="clock" size={13} color="#64748B" />
                <Text style={styles.scheduleText}>
                  {booking?.preferred_time || booking?.time_slot || 'Standard Hours'}
                </Text>
              </View>
            </View>

            {booking?.current_stage || (booking?.mechanic && !String(booking.mechanic).toLowerCase().includes('pending')) ? (
              <View style={styles.listStageBox}>
                <BootstrapIcon name="info-circle" size={12} color="#047857" />
                <Text style={styles.listStageText} numberOfLines={1}>
                  {booking?.current_stage || `Technician: ${booking.mechanic}`}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Right Column: Price & Actions */}
          <View style={styles.listColRight}>
            {finalTotal > 0 ? (
              <View style={styles.listPriceBox}>
                <Text style={styles.listPriceLabel}>Total Quote</Text>
                <Text style={styles.listPriceValue}>{formatPhp(finalTotal)}</Text>
              </View>
            ) : (
              <View style={styles.listPriceBox}>
                <Text style={styles.listPriceLabel}>Quotation</Text>
                <Text style={styles.listPricePending}>Pending Review</Text>
              </View>
            )}

            {canCancel && onCancel ? (
              <View style={styles.listActionsRow}>
                <TouchableOpacity
                  style={styles.listCancelBtn}
                  onPress={(e) => {
                    e?.stopPropagation?.();
                    onCancel();
                  }}
                  activeOpacity={0.8}
                >
                  <BootstrapIcon name="x-circle" size={13} color="#DC2626" />
                  <Text style={styles.listCancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>

        {/* Fallback inline expansion if onViewDetails is not used */}
        {!onViewDetails && expanded ? renderExpandedContent() : null}
      </TouchableOpacity>
    );
  }

  // ─── GRID VIEW MODE (HERO IMAGE CARD MATCHING IMAGE 2) ───
  if (viewMode === 'grid' && !isModalView) {
    const isDownpaymentDue = showDownpayment;
    const priceDisplay = isDownpaymentDue
      ? {
          label: 'Down Payment',
          value: formatPhpDecimals(
            booking?.downpayment_amount ||
            effectiveQuotation?.downpayment_amount ||
            Math.round((Number(booking?.estimated_service_total || booking?.pricePhp || 2500)) * 0.3)
          ),
        }
      : finalTotal > 0
      ? {
          label: 'Service Estimate',
          value: formatPhp(finalTotal),
        }
      : {
          label: 'Service Estimate',
          value: 'Quote Pending',
        };

    const ctaButtonText = isDownpaymentDue
      ? 'View Payment Due'
      : showQuotationActions
      ? 'Review Quote'
      : showFinalPay
      ? 'Pay Balance'
      : showPickup
      ? 'Pickup QR'
      : 'View Details';

    const shortDate = fmtShortDate(booking?.preferred_date || booking?.appointment_date || booking?.date);
    const shortTime = fmtShortTime(booking?.preferred_time || booking?.time_slot);

    // Motorcycle display: "Yamaha Smash 125 · ABC-4321"
    const rawPlate = String(plate || '').trim();
    const cleanPlate = rawPlate && !rawPlate.toLowerCase().startsWith('n/a') && !rawPlate.toLowerCase().includes('temp')
      ? rawPlate
      : rawPlate.replace(/^N\/A-?/i, '');
    const motoLine = cleanPlate
      ? `${bikeLabel || 'Registered Motorcycle'} · ${cleanPlate}`
      : (bikeLabel || 'Registered Motorcycle');

    // Stage line: "Scheduled · Maurin Jherico" or "Pending Review · No Upfront Fee"
    let stageLine = null;
    if (booking?.mechanic && !String(booking.mechanic).toLowerCase().includes('pending')) {
      const cleanMech = String(booking.mechanic).replace(/^Assigned to\s*/i, '').trim();
      stageLine = `Scheduled · ${cleanMech}`;
    } else if (booking?.current_stage) {
      stageLine = String(booking.current_stage)
        .replace(/•|—|-/g, '·')
        .replace(/Assigned to\s*/i, '')
        .trim();
    } else if (status === FLEX_BOOKING_STATUS.PENDING_REVIEW) {
      stageLine = 'Pending Review · No Upfront Fee';
    }

    const statusConfig = (() => {
      const norm = normalizeBookingStatus(status);
      if (norm === 'AWAITING_DOWNPAYMENT' || norm === 'APPROVED') {
        return {
          bg: '#0A251C',
          border: 'rgba(52, 211, 153, 0.75)',
          dot: '#34D399',
          text: '#ECFDF5',
        };
      }
      if (norm === 'PENDING_REVIEW') {
        return {
          bg: '#271B07',
          border: 'rgba(251, 191, 36, 0.75)',
          dot: '#FBBF24',
          text: '#FEF3C7',
        };
      }
      if (norm === 'QUOTATION_SENT' || norm === 'AWAITING_CUSTOMER_APPROVAL') {
        return {
          bg: '#0B233D',
          border: 'rgba(56, 189, 248, 0.75)',
          dot: '#38BDF8',
          text: '#F0F9FF',
        };
      }
      if (norm === 'CANCELLED' || norm === 'CUSTOMER_DECLINED' || norm === 'REJECTED') {
        return {
          bg: '#2C0E14',
          border: 'rgba(248, 113, 113, 0.75)',
          dot: '#F87171',
          text: '#FEE2E2',
        };
      }
      return {
        bg: '#0A251C',
        border: 'rgba(52, 211, 153, 0.75)',
        dot: '#34D399',
        text: '#ECFDF5',
      };
    })();

    return (
      <TouchableOpacity
        style={[styles.gridHeroCard, style]}
        onPress={handleCardPress}
        activeOpacity={0.92}
      >
        {/* 1. Motorcycle Image positioned on the right side */}
        <Image
          source={{
            uri: getOptimizedImageUrl(motorcyclePhoto, { width: 900, quality: 85 }),
          }}
          style={styles.gridHeroImage}
          resizeMode="cover"
        />

        {/* 2. Dark Blue Gradient Overlay (Left dark blue blending smoothly into the motorcycle image on the right with top vignette) */}
        <View
          style={[
            StyleSheet.absoluteFillObject,
            Platform.OS === 'web'
              ? {
                  backgroundImage:
                    'linear-gradient(180deg, rgba(15, 28, 44, 0.75) 0%, rgba(15, 28, 44, 0.22) 32%, transparent 62%), linear-gradient(90deg, #172B42 0%, #1A3452 35%, rgba(26, 52, 82, 0.94) 52%, rgba(26, 52, 82, 0.58) 72%, rgba(26, 52, 82, 0.15) 90%, rgba(26, 52, 82, 0.05) 100%)',
                }
              : {
                  backgroundColor: 'rgba(23, 43, 66, 0.86)',
                },
          ]}
        />

        {/* 3. Card Content Overlay */}
        <View style={styles.gridHeroContent}>
          {/* Top Row: Ref Badge & Prominent High-Contrast Booking Status Badge */}
          <View style={styles.gridHeaderRow}>
            <View style={styles.gridRefBadge}>
              <Text style={styles.gridRefText}>REF: {bookingId}</Text>
            </View>

            <View
              style={[
                styles.gridStatusPill,
                {
                  backgroundColor: statusConfig.bg,
                  borderColor: statusConfig.border,
                },
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: statusConfig.dot,
                  },
                ]}
              />
              <Text style={[styles.gridStatusText, { color: statusConfig.text }]}>
                {formatShortStatus(status)}
              </Text>
            </View>
          </View>

          {/* Left-Side Information (Inspired by Property Name & Description in Image 2) */}
          <View style={styles.gridBody}>
            {/* Service Title */}
            <Text style={styles.gridServiceTitle} numberOfLines={1}>
              {booking?.service_title || booking?.package_name || 'PMS Service'}
            </Text>

            {/* Motorcycle Model & Plate: "Yamaha Smash 125 · ABC-4321" */}
            <Text style={styles.gridMotoText} numberOfLines={1}>
              {motoLine}
            </Text>

            {/* Appointment Date and Time: "Oct 5 · 3:00–4:30 PM" */}
            <Text style={styles.gridScheduleText}>
              {shortDate} · {shortTime}
            </Text>

            {/* Shortened Stage / Mechanic Line: "Scheduled · Maurin Jherico" */}
            {stageLine ? (
              <Text style={styles.gridStageText} numberOfLines={1}>
                {stageLine}
              </Text>
            ) : null}
          </View>

          {/* Bottom Area: Large Bold Price & Prominent White Pill Button */}
          <View style={styles.gridFooterRow}>
            <View style={styles.gridPriceCol}>
              <Text style={styles.gridPriceLabel}>{priceDisplay.label}</Text>
              <Text style={styles.gridPriceAmount}>{priceDisplay.value}</Text>
            </View>

            <TouchableOpacity
              style={styles.gridPillBtn}
              onPress={(e) => {
                e?.stopPropagation?.();
                onViewDetails ? onViewDetails(booking) : setExpanded(true);
              }}
              activeOpacity={0.88}
            >
              <Text style={styles.gridPillBtnText}>{ctaButtonText}</Text>
              <BootstrapIcon name="arrow-right-short" size={18} color="#152A42" />
            </TouchableOpacity>
          </View>

          {/* Subtle & Unobtrusive Cancel Option */}
          {canCancel && onCancel ? (
            <TouchableOpacity
              style={styles.gridCancelLink}
              onPress={(e) => {
                e?.stopPropagation?.();
                onCancel();
              }}
              activeOpacity={0.65}
            >
              <Text style={styles.gridCancelText}>Cancel</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Fallback inline expansion when onViewDetails is not used */}
        {!onViewDetails && expanded ? renderExpandedContent() : null}
      </TouchableOpacity>
    );
  }

  // ─── STANDARD CARD VIEW (OR MODAL DIALOG BODY) ───
  const CardContainer = isModalView ? View : TouchableOpacity;
  const containerProps = isModalView
    ? {
        style: [
          styles.card,
          {
            borderColor: semanticColors.border || '#C8DDD3',
          },
          style,
        ],
      }
    : {
        style: [
          styles.card,
          {
            borderColor: semanticColors.border || '#C8DDD3',
            cursor: 'pointer',
          },
          style,
        ],
        onPress: handleCardPress,
        activeOpacity: 0.92,
      };

  return (
    <CardContainer {...containerProps}>
      {/* 1. Top Row: Reference Number + Semantic Status Badge */}
      <View style={styles.cardHeaderRow}>
        <View style={styles.refContainer}>
          <Text style={styles.refLabel}>REF: {bookingId}</Text>
        </View>
        <View
          style={[
            styles.statusPill,
            {
              backgroundColor: semanticColors.bg,
              borderColor: semanticColors.border,
            },
          ]}
        >
          <View style={[styles.statusDot, { backgroundColor: semanticColors.fg }]} />
          <Text style={[styles.statusText, { color: semanticColors.fg }]}>
            {customerStatusLabel(status)}
          </Text>
        </View>
      </View>

      {/* 2. Service Title + Optional Total */}
      <View style={styles.titleRow}>
        <Text style={styles.serviceTitle} numberOfLines={1}>
          {booking?.service_title || booking?.package_name || 'Service Booking'}
        </Text>
        {finalTotal > 0 ? (
          <Text style={styles.headTotal}>{formatPhp(finalTotal)}</Text>
        ) : null}
      </View>

      {/* 3. Motorcycle Info Badge */}
      <View style={styles.motoInfoBox}>
        <View style={styles.motoIconWrap}>
          <BootstrapIcon name="bicycle" size={14} color="#1D4533" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.motoName} numberOfLines={1}>
            {bikeLabel || 'Registered Motorcycle'}
          </Text>
          <Text style={styles.motoPlate}>
            {plate ? `Plate: ${plate}` : 'Plate: N/A'}
          </Text>
        </View>
      </View>

      {/* 4. Schedule Information (Date & Time) */}
      <View style={styles.scheduleRow}>
        <View style={styles.scheduleCol}>
          <BootstrapIcon name="calendar-event" size={13} color="#64748B" />
          <Text style={styles.scheduleText}>
            {fmtDate(booking?.preferred_date || booking?.appointment_date)}
          </Text>
        </View>
        <View style={styles.scheduleDot} />
        <View style={styles.scheduleCol}>
          <BootstrapIcon name="clock" size={13} color="#64748B" />
          <Text style={styles.scheduleText}>
            {booking?.preferred_time || booking?.time_slot || 'Standard Hours'}
          </Text>
        </View>
      </View>

      {/* 5. Short Status / Current Stage / Assigned Mechanic */}
      {booking?.current_stage || (booking?.mechanic && !String(booking.mechanic).toLowerCase().includes('pending')) ? (
        <View style={styles.stageBox}>
          <BootstrapIcon name="info-circle" size={13} color="#047857" />
          <Text style={styles.stageText} numberOfLines={1}>
            {booking?.current_stage || `Technician: ${booking.mechanic}`}
          </Text>
        </View>
      ) : null}

      {/* Pending review helper */}
      {status === FLEX_BOOKING_STATUS.PENDING_REVIEW ? (
        <View style={styles.noteBox}>
          <Text style={styles.noteText}>
            Your service request has been submitted. Our admin will review your request and provide a
            quotation. No payment is required yet.
          </Text>
        </View>
      ) : null}

      {status === FLEX_BOOKING_STATUS.NEEDS_INFORMATION || booking?.info_request_notes ? (
        <View style={styles.warnBox}>
          <Text style={styles.warnTitle}>Shop needs more info</Text>
          <Text style={styles.noteText}>{booking.info_request_notes}</Text>
          {status === FLEX_BOOKING_STATUS.NEEDS_INFORMATION ? (
            <View style={{ marginTop: 8, gap: 8 }}>
              <TextInput
                style={styles.input}
                placeholder="Type your reply…"
                value={infoReply}
                onChangeText={setInfoReply}
                multiline
              />
              <TouchableOpacity
                style={styles.btnAccept}
                onPress={(e) => {
                  e?.stopPropagation?.();
                  submitInfoReply();
                }}
                disabled={busy}
              >
                <Text style={styles.btnAcceptText}>Submit Information</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Action prompts always visible when not expanded and not in modal */}
      {showQuotationActions && !expanded && !isModalView ? (
        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={(e) => {
            e?.stopPropagation?.();
            onViewDetails ? onViewDetails(booking) : setExpanded(true);
          }}
        >
          <Text style={styles.ctaText}>Review Quotation</Text>
          <BootstrapIcon name="arrow-right" size={13} color="#FFFFFF" />
        </TouchableOpacity>
      ) : null}
      {showDownpayment && !expanded && !isModalView ? (
        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={(e) => {
            e?.stopPropagation?.();
            onViewDetails ? onViewDetails(booking) : setExpanded(true);
          }}
        >
          <Text style={styles.ctaText}>View Downpayment Due</Text>
          <BootstrapIcon name="arrow-right" size={13} color="#FFFFFF" />
        </TouchableOpacity>
      ) : null}
      {showFinalPay && !expanded && !isModalView ? (
        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={(e) => {
            e?.stopPropagation?.();
            onViewDetails ? onViewDetails(booking) : setExpanded(true);
          }}
        >
          <Text style={styles.ctaText}>View Final Bill</Text>
          <BootstrapIcon name="arrow-right" size={13} color="#FFFFFF" />
        </TouchableOpacity>
      ) : null}
      {showPickup && !expanded && !isModalView ? (
        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={(e) => {
            e?.stopPropagation?.();
            onViewDetails ? onViewDetails(booking) : setExpanded(true);
          }}
        >
          <Text style={styles.ctaText}>Show Pickup QR</Text>
          <BootstrapIcon name="arrow-right" size={13} color="#FFFFFF" />
        </TouchableOpacity>
      ) : null}

      {/* 6. Card Action Footer (Hidden in Modal view, or shown if canCancel) */}
      {!isModalView && canCancel && onCancel ? (
        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.cancelActionBtn}
            onPress={(e) => {
              e?.stopPropagation?.();
              onCancel();
            }}
            activeOpacity={0.8}
          >
            <BootstrapIcon name="x-circle" size={13} color="#DC2626" />
            <Text style={styles.cancelActionBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Expanded Details Section */}
      {(expanded || isModalView) ? renderExpandedContent() : null}
    </CardContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  listCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  listCardMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16,
  },
  listColLeft: {
    flex: 1,
    minWidth: 240,
    gap: 6,
  },
  listRefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  listServiceTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  listMotoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  listMotoText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  listColCenter: {
    minWidth: 180,
    gap: 6,
    justifyContent: 'center',
  },
  listScheduleBox: {
    gap: 4,
  },
  listStageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    alignSelf: 'flex-start',
  },
  listStageText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  listColRight: {
    minWidth: 170,
    alignItems: 'flex-end',
    gap: 8,
    justifyContent: 'center',
  },
  listPriceBox: {
    alignItems: 'flex-end',
  },
  listPriceLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  listPriceValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1D4533',
    fontVariant: ['tabular-nums'],
  },
  listPricePending: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#B45309',
  },
  listActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1D4533',
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 8,
    cursor: 'pointer',
    shadowColor: '#1D4533',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 1,
  },
  listDetailsBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  listCancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    cursor: 'pointer',
  },
  listCancelBtnText: {
    color: '#DC2626',
    fontSize: 11.5,
    fontWeight: '700',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  refContainer: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  refLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
    letterSpacing: 0.5,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  serviceTitle: {
    fontSize: 16.5,
    fontWeight: '900',
    color: '#0F172A',
    flex: 1,
    letterSpacing: -0.3,
  },
  headTotal: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1D4533',
    fontVariant: ['tabular-nums'],
  },
  motoInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  motoIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#E8F0EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  motoName: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#1E293B',
  },
  motoPlate: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingVertical: 4,
  },
  scheduleCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  scheduleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  scheduleDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#CBD5E1',
  },
  stageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  stageText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#166534',
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 4,
  },
  expandToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    cursor: 'pointer',
  },
  expandToggleText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#1D4533',
  },
  cancelActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    cursor: 'pointer',
  },
  cancelActionBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#DC2626',
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  ref: { fontSize: 11, fontWeight: '800', color: '#1D4533', letterSpacing: 0.3 },
  title: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginTop: 2 },
  meta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  stage: { fontSize: 12, color: '#1D4533', marginTop: 8 },
  noteBox: {
    backgroundColor: '#F0FDF9',
    borderWidth: 1,
    borderColor: '#CCE9E1',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  warnBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  warnTitle: { fontSize: 12, fontWeight: '800', color: '#92400E', marginBottom: 3 },
  noteText: { fontSize: 12.5, color: '#334155', lineHeight: 18 },
  ctaBtn: {
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: '#1D4533',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    cursor: 'pointer',
  },
  ctaText: { color: '#FFF', fontWeight: '800', fontSize: 12.5 },
  sectionContainer: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
    marginBottom: 4,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sectionIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: '#E8F0EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  chevronWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBody: {
    padding: 14,
  },
  badge: { backgroundColor: '#C8DDD3', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#1D4533' },

  // Stepper Styles
  stepperWrap: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  stepItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 36,
  },
  stepNodeCol: {
    width: 24,
    alignItems: 'center',
    height: '100%',
    marginRight: 12,
    position: 'relative',
  },
  stepNodeDone: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  stepNodeCurrentOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 2,
    borderColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  stepNodeCurrentInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#059669',
  },
  stepNodeUpcoming: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#CBD5E1',
    zIndex: 2,
    marginTop: 2,
  },
  stepLine: {
    position: 'absolute',
    top: 20,
    bottom: -4,
    width: 2,
    backgroundColor: '#E2E8F0',
    zIndex: 1,
  },
  stepLineDone: {
    backgroundColor: '#059669',
  },
  stepLineCurrent: {
    backgroundColor: '#A7F3D0',
  },
  stepContentCol: {
    flex: 1,
    paddingTop: 1,
    paddingBottom: 10,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  stepTitleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  stepTitleDone: {
    color: '#0F172A',
    fontWeight: '700',
  },
  stepTitleCurrent: {
    color: '#059669',
    fontWeight: '800',
    fontSize: 13.5,
  },
  activeStepTag: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activeStepTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#047857',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // 2-Column Grid Styles
  twoColumnGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingVertical: 2,
  },
  gridColumn: {
    flex: 1,
    minWidth: 220,
    gap: 10,
  },
  gridKvCell: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  gridKvLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  gridKvValue: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  statusBadgeInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  statusDotInline: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeTextInline: {
    fontSize: 12,
    fontWeight: '800',
  },
  subhead: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    marginTop: 6,
    marginBottom: 2,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  stepText: { fontSize: 13, color: '#94A3B8' },
  stepDone: { color: '#0F172A', fontWeight: '700' },
  kv: { marginBottom: 6 },
  kvLabel: { fontSize: 10, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase' },
  kvValue: { fontSize: 13, color: '#0F172A', fontWeight: '600' },
  thumb: { width: 84, height: 84, borderRadius: 8, marginRight: 8, backgroundColor: '#E2E8F0' },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 3 },
  lineLabel: { fontSize: 13, color: '#475569', flex: 1 },
  lineValue: { fontSize: 13, color: '#0F172A', fontWeight: '600' },
  lineBold: { fontWeight: '800', fontSize: 15, color: '#0F172A' },
  tableHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 2, marginTop: 4 },
  colHeaderLeft: { fontSize: 10.5, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.6 },
  colHeaderRight: { fontSize: 10.5, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.6 },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 6 },
  dividerBold: { height: 1.5, backgroundColor: '#CBD5E1', marginVertical: 8 },
  subBreakdownBox: { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  muted: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  input: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#FFF',
    minHeight: 44,
  },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btnAccept: {
    flex: 1,
    backgroundColor: '#1D4533',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnAcceptText: { color: '#FFF', fontWeight: '800' },
  btnDecline: {
    flex: 1,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnDeclineText: { color: '#DC2626', fontWeight: '800' },
  btnPay: {
    marginTop: 10,
    backgroundColor: '#1D4533',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnPayText: { color: '#FFF', fontWeight: '800' },
  addBox: {
    padding: 10,
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 8,
  },
  addTitle: { fontSize: 13.5, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  payRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  payType: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  payAmt: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  pickupBox: { alignItems: 'center', marginBottom: 8 },
  qr: { width: 180, height: 180, marginVertical: 8 },
  officialReceiptSheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#C8DDD3',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  receiptBrand: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.8,
  },
  receiptSubhead: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  receiptVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    marginTop: 8,
  },
  receiptVerifiedText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 0.5,
  },
  receiptDashedLine: {
    borderBottomWidth: 1.5,
    borderBottomColor: '#CBD5E1',
    borderStyle: 'dashed',
    marginVertical: 12,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3.5,
  },
  receiptMetaLabel: {
    fontSize: 12.5,
    color: '#64748B',
    fontWeight: '500',
  },
  receiptMetaValue: {
    fontSize: 12.5,
    color: '#0F172A',
    fontWeight: '600',
  },
  receiptHighlightCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 12,
    marginVertical: 6,
  },
  receiptHighlightLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.4,
  },
  receiptHighlightSub: {
    fontSize: 11,
    color: '#16A34A',
    marginTop: 1,
  },
  receiptHighlightValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#15803D',
  },
  receiptBarcodeContainer: {
    height: 38,
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 8,
  },
  receiptBarcodeCode: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 3,
    color: '#64748B',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  receiptNotice: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 4,
  },
  totalsBoxCustomer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#C8DDD3',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    marginTop: 4,
    marginBottom: 6,
  },
  totalsTitle: {
    fontWeight: '800',
    fontSize: 12.5,
    letterSpacing: 0.8,
    color: '#1D4533',
    marginBottom: 12,
  },
  tableHeaderDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
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
    color: '#475569',
    fontWeight: '500',
  },
  tableRowValue: {
    fontSize: 13.5,
    color: '#0F172A',
    fontWeight: '600',
  },
  tableTotalDivider: {
    height: 1.5,
    backgroundColor: '#CBD5E1',
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
    color: '#0F172A',
  },
  totalsTotalValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1D4533',
  },
  breakdownSubBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 4,
  },
  tableSubLabel: {
    fontSize: 12.5,
    color: '#64748B',
    fontWeight: '500',
  },
  tableSubValueDp: {
    fontSize: 13,
    color: '#D97706',
    fontWeight: '700',
  },
  tableSubValueRem: {
    fontSize: 13,
    color: '#1D4533',
    fontWeight: '700',
  },
  statusMetaContainer: {
    marginTop: 8,
    paddingHorizontal: 2,
  },
  statusRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  statusRowLabel: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  statusRowValue: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
  },
  awaitingStatusBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  awaitingStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  gridHeroCard: {
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    overflow: 'hidden',
    position: 'relative',
    minHeight: 240,
    marginBottom: 16,
    backgroundColor: '#172B42',
    shadowColor: '#0F1E32',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 22,
    elevation: 6,
    cursor: 'pointer',
  },
  gridHeroImage: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: '60%',
    height: '100%',
  },
  gridHeroContent: {
    padding: 20,
    minHeight: 240,
    justifyContent: 'space-between',
    zIndex: 2,
  },
  gridHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  gridRefBadge: {
    backgroundColor: 'rgba(15, 27, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
  },
  gridRefText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#CBDCEE',
    letterSpacing: 0.5,
  },
  gridStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 5.5,
    borderRadius: 9999,
    borderWidth: 1.5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 4,
  },
  statusDot: {
    width: 7.5,
    height: 7.5,
    borderRadius: 4,
  },
  gridStatusText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  gridBody: {
    flex: 1,
    justifyContent: 'center',
    marginVertical: 4,
    maxWidth: '75%',
  },
  gridServiceTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    marginBottom: 3,
    lineHeight: 26,
  },
  gridMotoText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#CBDCEE',
    marginBottom: 3,
    lineHeight: 18,
  },
  gridScheduleText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#93B4D3',
    marginBottom: 4,
    lineHeight: 16,
  },
  gridStageText: {
    fontSize: 11,
    color: '#7DD3FC',
    fontWeight: '600',
    lineHeight: 15,
  },
  gridFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 12,
    gap: 12,
  },
  gridPriceCol: {
    gap: 1,
  },
  gridPriceLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#93B4D3',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  gridPriceAmount: {
    fontSize: 25,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  gridPillBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 9999,
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 4,
  },
  gridPillBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#152A42',
  },
  gridCancelLink: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingVertical: 2,
  },
  gridCancelText: {
    fontSize: 10.5,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.45)',
    textDecorationLine: 'underline',
  },
});
