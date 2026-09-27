/**
 * Customer-facing service booking card.
 * Progress timeline, booking/motorcycle/request details, quotation breakdown,
 * accept/decline, downpayment + final payment (existing GCash flow), additional work
 * approval, final bill, payments list, and pickup QR.
 *
 * Read-only for admin data — customers can only respond/pay for their own booking.
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
} from 'react-native';
import { serviceQuotationService } from '../../services/serviceQuotationService';
import { GCashPaymentModal } from '../modals';
import BootstrapIcon from './BootstrapIcon';
import { getOptimizedImageUrl } from '../../utils/imageUrl';
import {
  formatPhp,
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

function Section({ title, icon, children, defaultOpen = true, badge }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.sectionHead} onPress={() => setOpen((v) => !v)} activeOpacity={0.8}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          {icon ? <BootstrapIcon name={icon} size={13} color="#1D4533" /> : null}
          <Text style={styles.sectionTitle}>{title}</Text>
          {badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <BootstrapIcon name={open ? 'chevron-up' : 'chevron-down'} size={13} color="#94A3B8" />
      </TouchableOpacity>
      {open ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

export default function CustomerServiceBookingCard({
  booking,
  onToast,
  onUpdated,
  style,
  defaultExpanded = false,
}) {
  const bookingId = booking?.booking_id || booking?.id;
  const status = normalizeBookingStatus(booking?.status);
  const colors = statusColor(status);

  const [expanded, setExpanded] = useState(defaultExpanded);
  const [quotation, setQuotation] = useState(null);
  const [charges, setCharges] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState(0);
  const [payType, setPayType] = useState('DOWNPAYMENT');

  const toast = (m) => onToast?.(m);

  // Load quotation (cache-first with force on status change) + charges + authoritative payments
  const reload = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      const [q, ch, pays] = await Promise.all([
        serviceQuotationService.getQuotationForBooking(bookingId, { force: true }),
        serviceQuotationService.listAdditionalCharges(bookingId),
        serviceQuotationService.getBookingPayments(bookingId, { force: true }),
      ]);
      setQuotation(q);
      setCharges(Array.isArray(ch) ? ch : []);
      setPayments(Array.isArray(pays) ? pays : []);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    if (expanded) reload();
  }, [reload, status, expanded]);

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

  const parts = (quotation?.items || []).filter((i) => i.item_type === 'part');
  const others = (quotation?.items || []).filter((i) => i.item_type !== 'part');

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
    .filter((p) => p.payment_type === 'DOWNPAYMENT' && p.status === 'Completed')
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const paidSoFar = Number(booking?.amount_paid || 0) || downpaymentPaid;

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
      const res = await serviceQuotationService.respondToQuotation(bookingId, accepted, {
        customerId: booking?.customer_id,
        customerUserId: booking?.user_id || booking?.customer_id,
      });
      if (!res.success) {
        toast(res.error || 'Could not update quotation');
        return;
      }
      toast(accepted ? 'Quotation accepted — please pay the downpayment' : 'Quotation declined');
      onUpdated?.(res);
      await reload();
    });

  const openPay = (type) => {
    const amount =
      type === 'DOWNPAYMENT'
        ? Number(quotation?.downpayment_amount || booking?.downpayment_amount || 0)
        : remaining;
    if (amount <= 0) {
      toast('No amount due');
      return;
    }
    setPayType(type);
    setPayAmount(amount);
    setPayOpen(true);
  };

  const onPaymentSuccess = (receipt) =>
    withBusy(async () => {
      const res = await serviceQuotationService.recordBookingPayment({
        bookingId,
        customerId: booking?.customer_id,
        amount: payAmount,
        paymentType: payType,
        paymentMethod: 'GCash',
        transactionReference:
          receipt?.referenceNumber || receipt?.reference || `GCASH-${Date.now()}`,
        status: 'Completed',
      });
      setPayOpen(false);
      if (!res.success) {
        toast(res.error || 'Payment could not be recorded');
        return;
      }
      toast(
        payType === 'DOWNPAYMENT'
          ? 'Downpayment received — booking confirmed'
          : 'Final payment received — ready for pickup'
      );
      onUpdated?.(res);
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

  return (
    <View style={[styles.card, style]}>
      {/* Header */}
      <TouchableOpacity style={styles.header} onPress={() => setExpanded((v) => !v)} activeOpacity={0.85}>
        <View style={{ flex: 1 }}>
          <Text style={styles.ref}>REF: {bookingId}</Text>
          <Text style={styles.title}>{booking?.service_title || booking?.package_name || 'Service Booking'}</Text>
          <Text style={styles.meta}>
            {bikeLabel || 'Motorcycle'}
            {plate ? ` · ${plate}` : ''}
          </Text>
          <Text style={styles.meta}>
            Requested {booking?.preferred_date || booking?.appointment_date || '—'} ·{' '}
            {booking?.preferred_time || booking?.time_slot || '—'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <View style={[styles.statusPill, { backgroundColor: colors.bg }]}>
            <Text style={[styles.statusText, { color: colors.fg }]}>{customerStatusLabel(status)}</Text>
          </View>
          {finalTotal > 0 ? <Text style={styles.headTotal}>{formatPhp(finalTotal)}</Text> : null}
          <BootstrapIcon name={expanded ? 'chevron-up' : 'chevron-down'} size={13} color="#94A3B8" />
        </View>
      </TouchableOpacity>

      {booking?.current_stage ? <Text style={styles.stage}>{booking.current_stage}</Text> : null}

      {/* Pending review helper */}
      {status === FLEX_BOOKING_STATUS.PENDING_REVIEW ? (
        <View style={styles.noteBox}>
          <Text style={styles.noteText}>
            Your service request has been submitted. Our admin will review your request and provide a
            quotation. No payment is required yet.
          </Text>
        </View>
      ) : null}

      {booking?.info_request_notes ? (
        <View style={styles.warnBox}>
          <Text style={styles.warnTitle}>Shop needs more info</Text>
          <Text style={styles.noteText}>{booking.info_request_notes}</Text>
        </View>
      ) : null}

      {/* Action prompts always visible even when collapsed */}
      {showQuotationActions && !expanded ? (
        <TouchableOpacity style={styles.ctaBtn} onPress={() => setExpanded(true)}>
          <Text style={styles.ctaText}>Review Quotation</Text>
        </TouchableOpacity>
      ) : null}
      {showDownpayment && !expanded ? (
        <TouchableOpacity style={styles.ctaBtn} onPress={() => setExpanded(true)}>
          <Text style={styles.ctaText}>Pay Downpayment</Text>
        </TouchableOpacity>
      ) : null}
      {showFinalPay && !expanded ? (
        <TouchableOpacity style={styles.ctaBtn} onPress={() => setExpanded(true)}>
          <Text style={styles.ctaText}>View Final Bill</Text>
        </TouchableOpacity>
      ) : null}
      {showPickup && !expanded ? (
        <TouchableOpacity style={styles.ctaBtn} onPress={() => setExpanded(true)}>
          <Text style={styles.ctaText}>Show Pickup QR</Text>
        </TouchableOpacity>
      ) : null}

      {!expanded ? null : (
        <View style={{ marginTop: 10, gap: 10 }}>
          {/* Progress */}
          <Section title="Service Progress" icon="list-check">
            {progress.map((s) => (
              <View key={s.key} style={styles.stepRow}>
                <BootstrapIcon
                  name={s.done ? 'check-circle-fill' : 'circle'}
                  size={14}
                  color={s.done ? '#1D4533' : '#CBD5E1'}
                />
                <Text style={[styles.stepText, s.done && styles.stepDone]}>{s.label}</Text>
              </View>
            ))}
          </Section>

          {/* Details */}
          <Section title="Booking Details" icon="bookmark" defaultOpen={false}>
            <KV label="Booking ID" value={bookingId} />
            <KV label="Service type" value={booking?.service_type || booking?.category} />
            <KV label="Requested date" value={booking?.preferred_date || booking?.appointment_date} />
            <KV label="Requested time" value={booking?.preferred_time || booking?.time_slot} />
            <KV label="Status" value={customerStatusLabel(status)} />
            <KV label="Booked on" value={fmtDate(booking?.created_at || booking?.createdAt)} />
            {booking?.mechanic && !String(booking.mechanic).toLowerCase().includes('pending') ? (
              <KV label="Assigned mechanic" value={booking.mechanic} />
            ) : null}
          </Section>

          <Section title="Motorcycle" icon="bicycle" defaultOpen={false}>
            <KV label="Brand" value={booking?.bike_brand || booking?.bikeBrand} />
            <KV label="Model" value={booking?.bike_model || booking?.bikeModel} />
            <KV label="Year" value={booking?.bike_year || booking?.year} />
            <KV label="Plate number" value={plate} />
            <KV label="Mileage" value={booking?.odometer || booking?.bikeOdo || booking?.bike_odo} />
          </Section>

          <Section title="Your Service Request" icon="chat-left-text" defaultOpen={false}>
            <KV label="Requested service" value={booking?.service_title || booking?.package_name} />
            <KV label="Problem description" value={booking?.problem_description || booking?.repair_type} />
            <KV label="Notes" value={booking?.notes} />
            {media.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
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

          {/* Quotation */}
          {quotation ? (
            <Section
              title="Quotation"
              icon="receipt"
              badge={quotation.status === 'accepted' ? 'Accepted' : quotation.status === 'declined' ? 'Declined' : null}
            >
              <Text style={styles.subhead}>Labor</Text>
              <Line
                label={`${formatPhp(quotation.hourly_rate)}/hour × ${Number(quotation.estimated_labor_hours || 0)} hrs`}
                value={formatPhp(quotation.labor_cost ?? calcLaborCost(quotation.hourly_rate, quotation.estimated_labor_hours))}
              />

              {parts.length > 0 ? (
                <>
                  <Text style={styles.subhead}>Parts</Text>
                  {parts.map((i) => (
                    <Line
                      key={i.item_id}
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
                      key={i.item_id}
                      label={i.description || i.product_name || 'Charge'}
                      value={formatPhp(i.line_total)}
                    />
                  ))}
                </>
              ) : null}

              <View style={styles.divider} />
              <Line label="Labor" value={formatPhp(quotation.labor_cost ?? 0)} />
              <Line label="Parts" value={formatPhp(quotation.parts_total ?? 0)} />
              <Line label="Other charges" value={formatPhp(quotation.other_charges_total ?? 0)} />
              {Number(quotation.discount_amount) > 0 ? (
                <Line label="Discount" value={formatPhp(quotation.discount_amount)} negative />
              ) : null}
              <View style={styles.divider} />
              <Line label="Estimated Total" value={formatPhp(quotation.total_amount)} bold />
              <Line
                label={`Required downpayment${
                  quotation.downpayment_type === 'percent' && quotation.downpayment_percent
                    ? ` (${Number(quotation.downpayment_percent)}%)`
                    : ''
                }`}
                value={formatPhp(quotation.downpayment_amount)}
              />
              <Line label="Remaining after downpayment" value={formatPhp(quotation.remaining_balance)} />

              {showQuotationActions ? (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.btnDecline}
                    onPress={() => respondQuotation(false)}
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
              ) : null}
            </Section>
          ) : !loading && status !== FLEX_BOOKING_STATUS.PENDING_REVIEW ? (
            <Text style={styles.muted}>Quotation will appear here after inspection.</Text>
          ) : null}

          {/* Downpayment */}
          {showDownpayment ? (
            <Section title="Downpayment" icon="cash-coin">
              <Line label="Service total" value={formatPhp(quotation?.total_amount || booking?.estimated_service_total)} />
              {quotation?.downpayment_type === 'percent' && quotation?.downpayment_percent ? (
                <Line label="Downpayment" value={`${Number(quotation.downpayment_percent)}%`} />
              ) : null}
              <Line
                label="Required downpayment"
                value={formatPhp(quotation?.downpayment_amount || booking?.downpayment_amount)}
                bold
              />
              <Line label="Payment method" value="GCash" />
              <Line label="Payment status" value={booking?.downpayment_status || 'Unpaid'} />
              <TouchableOpacity style={styles.btnPay} onPress={() => openPay('DOWNPAYMENT')} disabled={busy}>
                <Text style={styles.btnPayText}>
                  Pay Downpayment {formatPhp(quotation?.downpayment_amount || booking?.downpayment_amount)}
                </Text>
              </TouchableOpacity>
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
              <Line label="Downpayment paid" value={formatPhp(paidSoFar)} negative />
              <View style={styles.divider} />
              <Line label="Remaining Balance" value={formatPhp(remaining)} bold />
              {showFinalPay && remaining > 0 ? (
                <TouchableOpacity style={styles.btnPay} onPress={() => openPay('FINAL_PAYMENT')} disabled={busy}>
                  <Text style={styles.btnPayText}>Pay Remaining Balance {formatPhp(remaining)}</Text>
                </TouchableOpacity>
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
        </View>
      )}

      <GCashPaymentModal
        visible={payOpen}
        amount={payAmount}
        orderData={{
          orderId: bookingId,
          grandTotal: payAmount,
          customerPhone: booking?.customer_phone,
        }}
        onClose={() => setPayOpen(false)}
        onPaymentSuccess={onPaymentSuccess}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  ref: { fontSize: 11, fontWeight: '800', color: '#1D4533', letterSpacing: 0.3 },
  title: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginTop: 2 },
  meta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  headTotal: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  statusPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '800' },
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
    marginTop: 10,
    backgroundColor: '#1D4533',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  ctaText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
  section: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
  },
  sectionTitle: { fontSize: 12.5, fontWeight: '800', color: '#0F172A' },
  sectionBody: { padding: 12, gap: 4 },
  badge: { backgroundColor: '#C8DDD3', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#1D4533' },
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
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 2 },
  lineLabel: { fontSize: 13, color: '#475569', flex: 1 },
  lineValue: { fontSize: 13, color: '#0F172A', fontWeight: '600' },
  lineBold: { fontWeight: '800', fontSize: 14, color: '#0F172A' },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 6 },
  muted: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
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
});
