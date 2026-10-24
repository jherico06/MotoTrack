/**
 * Organized, high-readability Booking Details & Work Order Command Center for Admin Modal.
 * Structured with modern overview cards, contextual action bar, and segmented tabs.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { BootstrapIcon } from '../common';
import { getThemeTokens } from '../../styles/theme.js';
import ServiceQuotationPanel from './ServiceQuotationPanel.jsx';
import PickupQrScannerPanel from './PickupQrScannerPanel.jsx';
import { garageService } from '../../services/bookings/garageService.js';
import { serviceQuotationService } from '../../services/bookings/serviceQuotationService.js';
import { getOptimizedImageUrl } from '../../utils/imageUrl.js';
import { isPmsFixedBooking } from '../../utils/pmsCcPricing.js';
import {
  FLEX_BOOKING_STATUS,
  normalizeBookingStatus,
  getAllowedNextStatuses,
  canTransition,
  statusLabel,
  statusColor,
  formatPhp,
  bookingQuotationTotal,
  bookingPaymentStatus,
  canAdminAction,
} from '../../utils/bookingWorkflow.js';

function formatDateTime(val) {
  if (!val) return 'â€”';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return (
      d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }) +
      ' Â· ' +
      d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    );
  } catch {
    return String(val);
  }
}

function formatDateOnly(val) {
  if (!val) return 'â€”';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(val);
  }
}

/** Normalize service line items from either booking.service_line_items or booking_service_items rows. */
function normalizeLineItems(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(Boolean)
    .map((r, i) => {
      const qty = Number(r.quantity ?? 1) || 1;
      const rate = Number(r.laborRatePhp ?? r.labor_rate_php ?? r.laborRate ?? r.rate ?? 0) || 0;
      const total = Number(r.lineTotalPhp ?? r.line_total_php ?? r.lineTotal ?? rate * qty) || 0;
      return {
        key: String(r.id || r.serviceId || r.pms_service_id || `${r.serviceName || 'svc'}-${i}`),
        name: r.serviceName || r.service_name || r.name || 'Service',
        group: r.serviceGroup || r.service_group || r.group || '',
        qty,
        rate,
        total,
        isAdditional: Boolean(r.isAdditional ?? r.is_additional),
      };
    });
}

const DARK_STATUS_TONE = {
  '#D97706': 'Warning',
  '#C2410C': 'Warning',
  '#EA580C': 'Warning',
  '#B45309': 'Warning',
  '#EA580C': 'Success',
  '#16A34A': 'Success',
  '#059669': 'Success',
  '#0284C7': 'Info',
  '#7C3AED': 'Purple',
  '#4338CA': 'Purple',
  '#DC2626': 'Danger',
  '#B91C1C': 'Danger',
  '#991B1B': 'Danger',
};

function darkStatusColors(colors, t) {
  const tone = DARK_STATUS_TONE[String(colors?.fg || '').toUpperCase()];
  if (!tone) return { bg: t.bgSub, fg: t.textMuted, border: t.border };
  return { bg: t['status' + tone + 'Bg'], fg: t['status' + tone + 'Text'], border: t.accentBorder };
}

const LIGHT_TOKENS = getThemeTokens(false);
const DetailsThemeContext = createContext({
  t: LIGHT_TOKENS,
  isDark: false,
  styles: createStyles(LIGHT_TOKENS, false),
});

function ClearField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  style,
  ...rest
}) {
  const { t, isDark, styles } = useContext(DetailsThemeContext);
  return (
    <View style={styles.fieldWrap}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline, style]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={isDark ? t.placeholder : '#94A3B8'}
        multiline={multiline}
        keyboardType={keyboardType}
        underlineColorAndroid="transparent"
        selectionColor={isDark ? t.accentBrand : "#EA580C"}
        {...rest}
      />
    </View>
  );
}

function ActionBtn({ label, icon, onPress, disabled, danger, primary, outline }) {
  const { t, isDark, styles } = useContext(DetailsThemeContext);
  return (
    <TouchableOpacity
      style={[
        styles.actionBtn,
        primary && styles.actionBtnPrimary,
        danger && styles.actionBtnDanger,
        outline && styles.actionBtnOutline,
        disabled && styles.actionBtnDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      {icon ? (
        <BootstrapIcon
          name={icon}
          size={13}
          color={danger ? (isDark ? t.statusDangerText : '#DC2626') : primary ? '#FFFFFF' : (isDark ? t.accentBrand : '#EA580C')}
        />
      ) : null}
      <Text
        style={[
          styles.actionBtnText,
          primary && { color: '#FFFFFF' },
          danger && { color: (isDark ? t.statusDangerText : '#DC2626') },
          disabled && { color: (isDark ? t.textMuted : '#94A3B8') },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function InfoItem({ icon, label, value, highlight, badge }) {
  const { t, isDark, styles } = useContext(DetailsThemeContext);
  if (!value && value !== 0) return null;
  return (
    <View style={styles.infoItem}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {icon ? <BootstrapIcon name={icon} size={13} color={isDark ? t.textMuted : "#64748B"} /> : null}
        <Text style={styles.infoItemLabel}>{label}</Text>
      </View>
      {badge ? (
        <View style={styles.itemBadge}>{value}</View>
      ) : (
        <Text
          style={[styles.infoItemValue, highlight && { color: (isDark ? t.accentBrand : '#EA580C'), fontWeight: '800' }]}
          numberOfLines={2}
        >
          {String(value)}
        </Text>
      )}
    </View>
  );
}

function GridKvCell({ icon, label, value, highlight = false, badge = false }) {
  const { t, isDark, styles } = useContext(DetailsThemeContext);
  if (!value && value !== 0) return null;
  return (
    <View style={styles.gridKvCell}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 }}>
        {icon ? <BootstrapIcon name={icon} size={12} color={isDark ? t.textMuted : "#64748B"} /> : null}
        <Text style={styles.gridKvLabel}>{label}</Text>
      </View>
      {badge ? (
        <View style={styles.bikePlatePill}>
          <Text style={styles.bikePlateText}>{String(value)}</Text>
        </View>
      ) : (
        <Text
          style={[
            styles.gridKvValue,
            highlight && { color: (isDark ? t.accentBrand : '#EA580C'), fontWeight: '800' },
          ]}
          numberOfLines={2}
        >
          {String(value)}
        </Text>
      )}
    </View>
  );
}

// `mechanics` prop is accepted for backward compatibility but ignored (admin-only workflow).
function AdminBookingDetailsPanelInner({ booking, onToast, onBookingUpdated }) {
  const { t, isDark, styles } = useContext(DetailsThemeContext);
  const toast = (m) => onToast?.(m);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'quotation' | 'inspection'
  const [busy, setBusy] = useState(false);
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [showRescheduleBox, setShowRescheduleBox] = useState(false);

  const isPmsFixed = isPmsFixedBooking(booking);
  const [rejectReason, setRejectReason] = useState('');
  const [insp, setInsp] = useState({
    findings: booking?.inspection_notes || '',
    condition: '',
    recommended: '',
    recommendedParts: '',
    estimatedHours: String(booking?.estimated_labor_hours || ''),
    notes: '',
  });
  const [progressNotes, setProgressNotes] = useState(booking?.service_notes || '');
  const [actualHours, setActualHours] = useState(
    booking?.actual_labor_hours != null ? String(booking.actual_labor_hours) : ''
  );
  const [rescheduleDate, setRescheduleDate] = useState(
    booking?.preferred_date || booking?.appointment_date || ''
  );
  const [rescheduleTime, setRescheduleTime] = useState(
    booking?.preferred_time || booking?.time_slot || ''
  );

  const status = booking?.status || '';
  const normalized = normalizeBookingStatus(status);
  const isRejected =
    normalized === FLEX_BOOKING_STATUS.REJECTED || /reject/i.test(String(status || ''));
  const colors = isDark ? darkStatusColors(statusColor(status), t) : statusColor(status);
  const media = useMemo(() => {
    const raw = booking?.media_urls || booking?.photos || [];
    return Array.isArray(raw) ? raw.filter(Boolean) : [];
  }, [booking]);

  // PMS fixed-rate details (CC, CC category, selected service, quoted rate)
  const pmsInfo = useMemo(() => {
    if (!isPmsFixed) return null;
    const rate = Number(
      booking?.labor_subtotal ??
        booking?.quoted_service_rate ??
        booking?.estimated_service_total ??
        booking?.package_price ??
        0
    );
    const cc = booking?.motorcycle_cc ?? booking?.engine_cc ?? booking?.engineCc ?? booking?.cc;
    return {
      cc: cc != null && cc !== '' ? `${cc} cc` : 'â€”',
      ccCategory:
        booking?.cc_category_name ||
        booking?.ccCategoryName ||
        booking?.cc_category ||
        booking?.cc_category_id ||
        'â€”',
      service:
        booking?.pms_service_name ||
        booking?.pmsServiceName ||
        booking?.service_title ||
        booking?.package_name ||
        booking?.pms_service_id ||
        'â€”',
      rate,
    };
  }, [booking, isPmsFixed]);

  // Multi-service line items: prefer the booking payload, else load from booking_service_items.
  const bookingId = booking?.booking_id || booking?.id;
  const embeddedItems = useMemo(
    () => normalizeLineItems(booking?.service_line_items || booking?.serviceLineItems),
    [booking?.service_line_items, booking?.serviceLineItems]
  );
  const [fetchedItems, setFetchedItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (!bookingId || embeddedItems.length > 0) {
      setFetchedItems([]);
      setItemsLoading(false);
      return undefined;
    }
    setItemsLoading(true);
    Promise.resolve(garageService.fetchBookingServiceItems(bookingId))
      .then((rows) => {
        if (!cancelled) setFetchedItems(normalizeLineItems(rows));
      })
      .catch(() => {
        if (!cancelled) setFetchedItems([]);
      })
      .finally(() => {
        if (!cancelled) setItemsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bookingId, embeddedItems.length, booking?.updated_at]);

  const lineItems = embeddedItems.length > 0 ? embeddedItems : fetchedItems;
  const serviceTotals = useMemo(() => {
    const sumLabor = lineItems.filter((i) => !i.isAdditional).reduce((s, i) => s + i.total, 0);
    const labor = Number(
      booking?.labor_subtotal ?? booking?.quoted_service_rate ?? (lineItems.length ? sumLabor : 0)
    ) || 0;
    const parts = Number(booking?.parts_estimate ?? 0) || 0;
    const fees = Number(booking?.additional_fees_estimate ?? 0) || 0;
    const estimated =
      booking?.estimated_total != null && Number(booking.estimated_total) > 0
        ? Number(booking.estimated_total)
        : labor + parts + fees;
    return { labor, parts, fees, estimated };
  }, [booking, lineItems]);
  const isEstimateOnly = Boolean(booking?.is_estimate_only);

  const refresh = async (nextBooking) => {
    if (nextBooking) {
      onBookingUpdated?.(nextBooking);
      return;
    }
    const list = await garageService.fetchBookings();
    const id = booking?.booking_id || booking?.id;
    const found = Array.isArray(list)
      ? list.find((b) => b.booking_id === id || b.id === id)
      : null;
    onBookingUpdated?.(found || null, list);
  };

  const withBusy = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast(e?.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  // Admin-only workflow: confirm the appointment (CONFIRMED â†’ SCHEDULED), no mechanic needed.
  const scheduleAppointment = async () => {
    await withBusy(async () => {
      const id = booking.booking_id || booking.id;
      await garageService.scheduleAppointment(id, {
        preferredDate: booking.preferred_date || booking.appointment_date,
        preferredTime: booking.preferred_time || booking.time_slot,
        scheduledBy: 'admin',
      });
      toast('âœ“ Appointment scheduled â€¢ Rider notified');
      await refresh();
    });
  };

  const setStatus = async (next) => {
    if (!canTransition(status, next) && normalizeBookingStatus(status) !== next) {
      toast(`Cannot change from ${statusLabel(status)} to ${statusLabel(next)}`);
      return;
    }
    await withBusy(async () => {
      const id = booking.booking_id || booking.id;
      if (next === FLEX_BOOKING_STATUS.SERVICE_COMPLETED) {
        const fin = await serviceQuotationService.finalizeBilling(id);
        if (!fin.success) throw new Error(fin.error || 'Finalize failed');
        toast(
          fin.remaining > 0
            ? `Service completed â€¢ Remaining balance ${formatPhp(fin.remaining)}`
            : 'Service completed â€¢ Ready for pickup'
        );
      } else if (next === FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS) {
        await garageService.startService(id);
        toast('Service started in bay â€¢ Rider notified');
      } else {
        await garageService.updateBooking(id, {
          status: next,
          current_stage: statusLabel(next),
        });
        toast(`Status updated: ${statusLabel(next)}`);
      }
      await refresh();
    });
  };

  const approve = async () => {
    await withBusy(async () => {
      const id = booking.booking_id || booking.id;
      // No mechanic required. Quoted bookings (single PMS or multi-service) use the
      // labor subtotal / quoted service rate as the estimated total.
      const approvalTotal =
        isPmsFixed && pmsInfo?.rate > 0
          ? pmsInfo.rate
          : lineItems.length > 0 && serviceTotals.labor > 0
            ? serviceTotals.labor
            : Number(booking?.labor_subtotal ?? booking?.quoted_service_rate ?? 0) || 0;
      await garageService.approveBooking(id, null, {
        flexible: true,
        approvedBy: 'admin',
        ...(approvalTotal > 0
          ? { estimatedServiceCost: approvalTotal, estimated_service_total: approvalTotal }
          : {}),
      });
      toast('âœ“ Booking approved â€” downpayment required');
      await refresh();
    });
  };

  const reject = async () => {
    const reason = rejectReason.trim();
    if (!reason) {
      toast('Please enter a rejection reason');
      return;
    }
    await withBusy(async () => {
      const id = booking.booking_id || booking.id;
      await garageService.rejectBooking(id, reason);
      setShowRejectBox(false);
      setRejectReason('');
      toast('Booking declined');
      await refresh();
    });
  };

  const handleReschedule = async () => {
    if (!rescheduleDate || !rescheduleTime) {
      toast('Please enter both date and time window');
      return;
    }
    await withBusy(async () => {
      const id = booking.booking_id || booking.id;
      await garageService.rescheduleBooking(id, {
        preferredDate: rescheduleDate,
        preferredTime: rescheduleTime,
      });
      setShowRescheduleBox(false);
      toast('âœ“ Appointment rescheduled');
      await refresh();
    });
  };

  const generateQr = async () => {
    await withBusy(async () => {
      const id = booking.booking_id || booking.id;
      const res = await serviceQuotationService.ensurePickupQr(id);
      if (!res.success) throw new Error(res.error || 'QR generation failed');
      toast(res.existing ? 'Pickup QR already generated' : 'âœ“ Pickup QR generated');
      await refresh();
    });
  };

  const finalizeBill = async () => {
    await withBusy(async () => {
      const id = booking.booking_id || booking.id;
      const fin = await serviceQuotationService.finalizeBilling(id);
      if (!fin.success) throw new Error(fin.error || 'Finalize failed');
      toast(
        fin.remaining > 0
          ? `Final bill ${formatPhp(fin.finalTotal)} â€¢ Remaining ${formatPhp(fin.remaining)}`
          : `Final bill ${formatPhp(fin.finalTotal)} â€¢ Ready for pickup`
      );
      await refresh();
    });
  };

  const saveInspection = async () => {
    await withBusy(async () => {
      const id = booking.booking_id || booking.id;
      const inspectedAt = new Date().toISOString();
      await serviceQuotationService.recordInspection(id, {
        findings: [
          insp.condition && `Condition: ${insp.condition}`,
          insp.findings && `Problems: ${insp.findings}`,
          insp.recommended && `Recommended: ${insp.recommended}`,
          insp.recommendedParts && `Parts: ${insp.recommendedParts}`,
          insp.notes && `Notes: ${insp.notes}`,
        ]
          .filter(Boolean)
          .join('\n'),
        recommendedWork: insp.recommended,
        photos: media,
        inspectedBy: 'admin',
      });
      await garageService.updateBooking(id, {
        estimated_labor_hours: insp.estimatedHours ? Number(insp.estimatedHours) : booking.estimated_labor_hours,
        inspection_notes: [
          insp.condition && `Condition: ${insp.condition}`,
          insp.findings,
          insp.recommended && `Recommended: ${insp.recommended}`,
          insp.recommendedParts && `Parts: ${insp.recommendedParts}`,
          insp.notes,
        ]
          .filter(Boolean)
          .join('\n'),
        inspection_started_at: inspectedAt,
        status: FLEX_BOOKING_STATUS.UNDER_INSPECTION,
        current_stage: 'Inspection recorded',
      });
      toast('âœ“ Inspection details saved');
      await refresh();
    });
  };

  const saveProgress = async () => {
    await withBusy(async () => {
      const id = booking.booking_id || booking.id;
      const patch = {
        service_notes: progressNotes,
        status: FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS,
        current_stage: 'Service in progress',
      };
      if (actualHours !== '') {
        await serviceQuotationService.setActualLaborHours(id, Number(actualHours), {
          hourlyRate: booking.quoted_hourly_rate,
        });
      }
      await garageService.updateBooking(id, patch);
      toast('âœ“ Service progress logged');
      await refresh();
    });
  };

  if (!booking) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No booking details available</Text>
      </View>
    );
  }

  const quoteTotal = bookingQuotationTotal(booking);
  const payStatus = bookingPaymentStatus(booking);
  const basePrice = Number(
    isPmsFixed && pmsInfo?.rate > 0 ? pmsInfo.rate : booking.pricePhp || 2500
  );
  const dpAmount = Number(
    booking.downpayment_amount !== undefined
      ? booking.downpayment_amount
      : Math.round(basePrice * 0.2)
  );
  const remainingBalance = Math.max(0, (booking.final_service_total || quoteTotal || basePrice) - (booking.downpayment_paid ? dpAmount : 0));

  return (
    <View style={styles.wrap}>
      {/* â”€â”€â”€ 1. TOP STATUS & QUICK GLANCE BAR â”€â”€â”€ */}
      <View style={styles.topStatusStrip}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Status Badge */}
          <View style={[styles.statusBadge, { backgroundColor: colors.bg, borderColor: colors.border || colors.fg }]}>
            <BootstrapIcon
              name={
                normalized === FLEX_BOOKING_STATUS.APPROVED || normalized === FLEX_BOOKING_STATUS.CONFIRMED
                  ? 'check-circle-fill'
                  : normalized === FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS
                  ? 'gear-wide-connected'
                  : normalized === FLEX_BOOKING_STATUS.UNDER_INSPECTION
                  ? 'search'
                  : normalized === FLEX_BOOKING_STATUS.SERVICE_COMPLETED
                  ? 'flag-fill'
                  : normalized === FLEX_BOOKING_STATUS.READY_FOR_PICKUP
                  ? 'qr-code'
                  : 'hourglass-split'
              }
              size={12}
              color={colors.fg}
            />
            <Text style={[styles.statusBadgeText, { color: colors.fg }]}>
              {statusLabel(status)}
            </Text>
          </View>

          {/* Payment Pill */}
          <View style={styles.paymentPill}>
            <BootstrapIcon name="credit-card-2-front" size={11} color={isDark ? t.textSecondary : "#475569"} />
            <Text style={styles.paymentPillText}>
              {quoteTotal > 0 ? formatPhp(quoteTotal) : formatPhp(basePrice)} Â· {payStatus}
            </Text>
          </View>

          {/* Downpayment Badge */}
          <View
            style={[
              styles.dpBadge,
              booking.status === 'Cancelled' || normalized === FLEX_BOOKING_STATUS.CANCELLED
                ? styles.dpBadgeCancelled
                : booking.downpayment_status === 'Paid' || Number(booking.amount_paid || 0) > 0
                  ? styles.dpBadgePaid
                  : styles.dpBadgeCancelled,
            ]}
          >
            <BootstrapIcon
              name={
                booking.downpayment_status === 'Paid' || Number(booking.amount_paid || 0) > 0
                  ? 'shield-check'
                  : 'exclamation-triangle-fill'
              }
              size={11}
              color={
                booking.downpayment_status === 'Paid' || Number(booking.amount_paid || 0) > 0
                  ? (isDark ? t.statusSuccessText : '#166534')
                  : (isDark ? t.statusDangerText : '#DC2626')
              }
            />
            <Text
              style={[
                styles.dpBadgeText,
                {
                  color:
                    booking.downpayment_status === 'Paid' || Number(booking.amount_paid || 0) > 0
                      ? (isDark ? t.statusSuccessText : '#166534')
                      : (isDark ? t.statusDangerText : '#DC2626'),
                },
              ]}
            >
              {booking.status === 'Cancelled' || normalized === FLEX_BOOKING_STATUS.CANCELLED
                ? 'DP Forfeited'
                : booking.downpayment_status === 'Paid' || Number(booking.amount_paid || 0) > 0
                  ? `DP ${formatPhp(dpAmount)} Paid (${booking.downpayment_method || 'cash'})`
                  : normalized === FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT
                    ? `DP ${formatPhp(dpAmount)} Required`
                    : normalized === FLEX_BOOKING_STATUS.BOOKING_EXPIRED
                      ? 'Cancelled â€” DP deadline missed'
                    : `DP ${formatPhp(dpAmount)}`}
            </Text>
          </View>
          {normalized === FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT && booking.payment_deadline ? (
            <Text style={{ fontSize: 11, color: (isDark ? t.statusWarningText : '#EA580C'), fontWeight: '700', marginTop: 4 }}>
              Due by {new Date(booking.payment_deadline).toLocaleString()} Â· auto-cancels if unpaid
            </Text>
          ) : null}
        </View>

        {busy && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <ActivityIndicator size="small" color={isDark ? t.accentBrand : "#EA580C"} />
            <Text style={{ fontSize: 11.5, color: (isDark ? t.textMuted : '#64748B'), fontWeight: '600' }}>Updating...</Text>
          </View>
        )}
      </View>

      {/* â”€â”€â”€ 2. CONTEXTUAL ACTION TOOLBAR â”€â”€â”€ */}
      <View style={styles.actionToolbar}>
        {canAdminAction(status, 'approve') && (
          <ActionBtn label="Approve Booking" icon="check2-circle" primary onPress={approve} disabled={busy} />
        )}

        {canAdminAction(status, 'reject') && (
          <ActionBtn
            label="Reject Booking"
            icon="x-circle"
            danger
            onPress={() => setShowRejectBox(true)}
            disabled={busy}
          />
        )}

        {/* Pending Review is Approve / Reject only; Request Info stays for Needs Information. */}
        {canAdminAction(status, 'request_info') && !canAdminAction(status, 'approve') && (
          <ActionBtn
            label="Request Info"
            icon="chat-left-quote"
            outline
            onPress={async () => {
              const notes = rejectReason || 'Please provide more details about the motorcycle issue.';
              await withBusy(async () => {
                await garageService.requestBookingInfo(booking.booking_id || booking.id, notes);
                toast('Information requested from customer');
                await refresh();
              });
            }}
            disabled={busy}
          />
        )}

        {canAdminAction(status, 'reschedule') && (
          <ActionBtn
            label={showRescheduleBox ? 'Cancel Reschedule' : 'Reschedule'}
            icon="calendar-event"
            outline
            onPress={() => setShowRescheduleBox(!showRescheduleBox)}
            disabled={busy}
          />
        )}

        {canAdminAction(status, 'schedule') && (
          <ActionBtn
            label="Confirm Appointment"
            icon="calendar-check"
            primary
            onPress={scheduleAppointment}
            disabled={busy}
          />
        )}

        {/* Repair only: PMS fixed-rate bookings skip inspection/quotation. */}
        {!isPmsFixed && canAdminAction(status, 'start_inspection') && (
          <ActionBtn
            label="Start Inspection"
            icon="search"
            outline={canAdminAction(status, 'start_service')}
            primary={!canAdminAction(status, 'start_service')}
            onPress={() => {
              setStatus(FLEX_BOOKING_STATUS.UNDER_INSPECTION);
              setActiveTab('inspection');
            }}
            disabled={busy}
          />
        )}

        {(canAdminAction(status, 'start_service') || canAdminAction(status, 'mark_in_progress')) && (
          <ActionBtn
            label="Start Service"
            icon="play-fill"
            primary
            onPress={() => {
              setStatus(FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS);
              setActiveTab(isPmsFixed ? 'overview' : 'inspection');
            }}
            disabled={busy}
          />
        )}

        {canAdminAction(status, 'complete_service') && (
          <ActionBtn
            label="Complete Service"
            icon="flag"
            primary
            onPress={() => setStatus(FLEX_BOOKING_STATUS.SERVICE_COMPLETED)}
            disabled={busy}
          />
        )}

        {canAdminAction(status, 'finalize_bill') && (
          <ActionBtn
            label="Finalize Bill"
            icon="receipt"
            primary
            onPress={finalizeBill}
            disabled={busy}
          />
        )}

        {canAdminAction(status, 'generate_qr') && (
          <ActionBtn
            label="Generate Pickup QR"
            icon="qr-code"
            primary
            onPress={generateQr}
            disabled={busy}
          />
        )}
      </View>

      {canAdminAction(status, 'approve') ? (
        <Text style={{ fontSize: 11.5, color: isDark ? t.textMuted : '#64748B' }}>
          Approve to request the customer's downpayment, or reject with a reason (required, shown to the customer).
          No mechanic assignment is needed.
        </Text>
      ) : null}

      {isRejected ? (
        <View
          style={{
            backgroundColor: isDark ? t.statusDangerBg : '#FEF2F2',
            borderColor: isDark ? 'rgba(180, 120, 120, 0.28)' : '#FECACA',
            borderWidth: 1,
            borderRadius: 10,
            padding: 12,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '800', color: isDark ? t.statusDangerText : '#B91C1C', textTransform: 'uppercase' }}>
            Rejection Reason
          </Text>
          <Text style={{ fontSize: 13, fontWeight: '600', marginTop: 2, color: isDark ? t.textPrimary : '#7F1D1D' }}>
            {booking.rejection_reason || booking.rejection_notes || 'No reason recorded.'}
          </Text>
        </View>
      ) : null}

      {/* Reject reason dialog (reason is required) */}
      <Modal
        visible={showRejectBox}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRejectBox(false)}
      >
        <View style={styles.dialogBackdrop}>
          <View style={[styles.interactiveDrawer, styles.dialogCard]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <BootstrapIcon name="shield-exclamation" size={14} color={isDark ? t.statusDangerText : "#DC2626"} />
              <Text style={{ fontSize: 12.5, fontWeight: '800', color: (isDark ? t.statusDangerText : '#DC2626') }}>
                Decline Booking & Notify Customer
              </Text>
            </View>
            <ClearField
              label="Rejection Reason (required)"
              placeholder="e.g. Lift bays fully booked at 10 AM, please select an afternoon slot"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
            />
            <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <ActionBtn
                label="Cancel"
                outline
                onPress={() => setShowRejectBox(false)}
                disabled={busy}
              />
              <ActionBtn
                label="Confirm Decline"
                icon="x-circle"
                danger
                onPress={reject}
                disabled={busy || !rejectReason.trim()}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Inline Reschedule Drawer (only shown when Reschedule is pressed) */}
      {showRescheduleBox && (
        <View style={styles.interactiveDrawer}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <BootstrapIcon name="calendar2-check" size={14} color={isDark ? t.accentBrand : "#EA580C"} />
            <Text style={{ fontSize: 12.5, fontWeight: '800', color: (isDark ? t.accentBrand : '#EA580C') }}>
              Update Appointment Schedule
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <ClearField
                label="Preferred Date"
                placeholder="YYYY-MM-DD"
                value={rescheduleDate}
                onChangeText={setRescheduleDate}
              />
            </View>
            <View style={{ flex: 1 }}>
              <ClearField
                label="Preferred Time Window"
                placeholder="e.g. 10:30 AM - 12:00 PM"
                value={rescheduleTime}
                onChangeText={setRescheduleTime}
              />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <ActionBtn
              label="Cancel"
              outline
              onPress={() => setShowRescheduleBox(false)}
              disabled={busy}
            />
            <ActionBtn
              label="Save New Schedule"
              icon="check2"
              primary
              onPress={handleReschedule}
              disabled={busy}
            />
          </View>
        </View>
      )}

      {/* â”€â”€â”€ 3. ORGANIZED NAVIGATION TABS â”€â”€â”€ */}
      <View style={styles.tabBar}>
        {[
          { id: 'overview', label: 'Overview & Profile', icon: 'person-vcard' },
          // PMS fixed-rate bookings are already quoted: no quotation/inspection steps required.
          // ...but additional work found during service still needs the customer-approval flow.
          ...(isPmsFixed
            ? canAdminAction(status, 'create_additional') ||
              canAdminAction(status, 'review_additional') ||
              canAdminAction(status, 'send_additional')
              ? [{ id: 'quotation', label: 'Additional Work', icon: 'receipt' }]
              : []
            : [
                { id: 'quotation', label: 'Quotation & Billing', icon: 'receipt' },
                { id: 'inspection', label: 'Inspection & Release', icon: 'clipboard2-check' },
              ]),
        ].map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabButton, isSelected && styles.tabButtonActive]}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.8}
            >
              <BootstrapIcon
                name={tab.icon}
                size={13}
                color={isSelected ? (isDark ? t.accentBrand : '#EA580C') : (isDark ? t.textMuted : '#64748B')}
              />
              <Text style={[styles.tabButtonText, isSelected && styles.tabButtonTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* â”€â”€â”€ 4. TAB CONTENT â”€â”€â”€ */}
      {/* TAB 1: OVERVIEW & PROFILE */}
      {activeTab === 'overview' && (
        <View style={styles.cardsGrid}>
          {/* Card 0: Booking Information */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <BootstrapIcon name="journal-text" size={14} color={isDark ? t.accentBrand : "#EA580C"} />
              <Text style={styles.cardTitle}>Booking Information</Text>
            </View>
            <View style={styles.cardBody}>
              <View style={styles.twoColumnGrid}>
                <View style={styles.gridColumn}>
                  <GridKvCell icon="hash" label="Booking ID" value={bookingId} highlight />
                  <GridKvCell icon="flag" label="Status" value={statusLabel(status)} />
                </View>
                <View style={styles.gridColumn}>
                  <GridKvCell
                    icon="list-check"
                    label="Services Requested"
                    value={
                      lineItems.length > 0
                        ? `${lineItems.length} service${lineItems.length === 1 ? '' : 's'}`
                        : booking.service_title || booking.package_name || null
                    }
                  />
                  <GridKvCell
                    icon="cash-coin"
                    label="Labor Subtotal"
                    value={serviceTotals.labor > 0 ? formatPhp(serviceTotals.labor) : null}
                    highlight
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Card 1: Customer Profile */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <BootstrapIcon name="person-fill" size={14} color={isDark ? t.accentBrand : "#EA580C"} />
              <Text style={styles.cardTitle}>Customer Profile</Text>
            </View>
            <View style={styles.cardBody}>
              <View style={styles.twoColumnGrid}>
                <View style={styles.gridColumn}>
                  <GridKvCell
                    icon="person-badge"
                    label="Full Name"
                    value={booking.customer_name || booking.userName || 'Jherico Maurin'}
                    highlight
                  />
                  <GridKvCell
                    icon="telephone-fill"
                    label="Contact Phone"
                    value={booking.customer_phone || booking.userPhone || '09614904841'}
                  />
                  <GridKvCell
                    icon="envelope-fill"
                    label="Email Address"
                    value={booking.customer_email || booking.userEmail || 'jhericomaurin67@gmail.com'}
                  />
                </View>

                <View style={styles.gridColumn}>
                  <GridKvCell
                    icon="geo-alt-fill"
                    label="Service Hub / Address"
                    value={booking.customer_address || booking.address || booking.branch || 'D\'Blockchain Motorparts and Accessories'}
                  />
                  <GridKvCell
                    icon="clock-history"
                    label="Booking Placed On"
                    value={formatDateTime(booking.created_at || booking.createdAt)}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Card 2: Motorcycle Specs */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <BootstrapIcon name="bicycle" size={14} color={isDark ? t.accentBrand : "#EA580C"} />
              <Text style={styles.cardTitle}>Motorcycle Specs</Text>
            </View>
            <View style={styles.cardBody}>
              <View style={styles.twoColumnGrid}>
                <View style={styles.gridColumn}>
                  <GridKvCell
                    icon="speedometer2"
                    label="Vehicle Model"
                    value={`${booking.bike_brand || booking.bikeBrand || ''} ${booking.bike_model || booking.bikeModel || ''}`.trim() || 'Honda ADV 160'}
                    highlight
                  />
                  <GridKvCell
                    icon="card-heading"
                    label="License Plate"
                    value={booking.plate_number || booking.bikePlate || 'N/Aâ€“RJCX'}
                    badge
                  />
                </View>

                <View style={styles.gridColumn}>
                  <GridKvCell
                    icon="speedometer"
                    label="Current Odometer"
                    value={booking.odometer || booking.bikeOdo || '0 km'}
                  />
                  <GridKvCell
                    icon="speedometer2"
                    label="Engine CC"
                    value={
                      booking.motorcycle_cc ?? booking.engine_cc ?? booking.cc
                        ? `${booking.motorcycle_cc ?? booking.engine_cc ?? booking.cc} cc`
                        : null
                    }
                  />
                  <GridKvCell
                    icon="layers"
                    label="CC Category"
                    value={booking.cc_category_name || booking.cc_category || booking.cc_category_id || null}
                  />
                  <GridKvCell
                    icon="palette"
                    label="Color & Year"
                    value={`${booking.bike_color || booking.color || 'Standard'} â€¢ ${booking.bike_year || booking.year || '2024'}`}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Card 2b: PMS fixed-rate package (already quoted â€” no inspection/quotation needed) */}
          {(lineItems.length > 0 || itemsLoading || isPmsFixed) ? (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <BootstrapIcon name="tools" size={14} color={isDark ? t.accentBrand : "#EA580C"} />
                <Text style={styles.cardTitle}>
                  Requested Services{lineItems.length > 0 ? ` (${lineItems.length})` : ''}
                </Text>
              </View>
              <View style={styles.cardBody}>
                {itemsLoading && lineItems.length === 0 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <ActivityIndicator size="small" color={isDark ? t.accentBrand : '#EA580C'} />
                    <Text style={{ fontSize: 12, color: isDark ? t.textMuted : '#64748B' }}>Loading services...</Text>
                  </View>
                ) : null}

                {lineItems.length > 0 ? (
                  <View style={styles.svcTable}>
                    <View style={[styles.svcRow, styles.svcHeadRow]}>
                      <Text style={[styles.svcHeadText, { flex: 2.2 }]}>Service</Text>
                      <Text style={[styles.svcHeadText, { flex: 1.2 }]}>Group</Text>
                      <Text style={[styles.svcHeadText, { flex: 1, textAlign: 'right' }]}>Labor Rate</Text>
                      <Text style={[styles.svcHeadText, { flex: 1, textAlign: 'right' }]}>Line Total</Text>
                    </View>
                    {lineItems.map((item) => (
                      <View key={item.key} style={styles.svcRow}>
                        <View style={{ flex: 2.2 }}>
                          <Text style={styles.svcCell}>
                            {item.name}
                            {item.qty > 1 ? ` x${item.qty}` : ''}
                          </Text>
                          {item.isAdditional ? (
                            <Text style={styles.svcTag}>Additional work</Text>
                          ) : null}
                        </View>
                        <Text style={[styles.svcCellMuted, { flex: 1.2 }]}>{item.group || '-'}</Text>
                        <Text style={[styles.svcCell, { flex: 1, textAlign: 'right' }]}>{formatPhp(item.rate)}</Text>
                        <Text style={[styles.svcCell, { flex: 1, textAlign: 'right', fontWeight: '800' }]}>
                          {formatPhp(item.total)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : !itemsLoading ? (
                  <GridKvCell
                    icon="wrench-adjustable"
                    label="Selected Service"
                    value={pmsInfo?.service || booking.service_title || booking.package_name}
                    highlight
                  />
                ) : null}

                <View style={styles.svcTotals}>
                  <View style={styles.svcTotalRow}>
                    <Text style={styles.svcTotalLabel}>Labor subtotal</Text>
                    <Text style={styles.svcTotalValue}>{formatPhp(serviceTotals.labor)}</Text>
                  </View>
                  <View style={styles.svcTotalRow}>
                    <Text style={styles.svcTotalLabel}>Parts estimate</Text>
                    <Text style={styles.svcTotalValue}>{formatPhp(serviceTotals.parts)}</Text>
                  </View>
                  {serviceTotals.fees > 0 ? (
                    <View style={styles.svcTotalRow}>
                      <Text style={styles.svcTotalLabel}>Additional fees estimate</Text>
                      <Text style={styles.svcTotalValue}>{formatPhp(serviceTotals.fees)}</Text>
                    </View>
                  ) : null}
                  <View style={[styles.svcTotalRow, styles.svcGrandRow]}>
                    <Text style={[styles.svcTotalLabel, { fontWeight: '800' }]}>
                      {isEstimateOnly ? 'Estimated total' : 'Total'}
                    </Text>
                    <Text style={[styles.svcTotalValue, { color: isDark ? t.accentBrand : '#EA580C', fontSize: 14 }]}>
                      {formatPhp(serviceTotals.estimated)}
                    </Text>
                  </View>
                </View>

                {isEstimateOnly ? (
                  <Text style={styles.svcDisclaimer}>
                    ESTIMATE ONLY: prices are for the listed labor and may change. Parts are not included,
                    and any additional work found during service needs the customer's approval first.
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* Card 3: Appointment & Financials */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <BootstrapIcon name="calendar3" size={14} color={isDark ? t.accentBrand : "#EA580C"} />
              <Text style={styles.cardTitle}>Appointment & Financials</Text>
            </View>
            <View style={styles.cardBody}>
              {/* Subgroup 1: Appointment */}
              <View style={styles.subGroupHeader}>
                <BootstrapIcon name="calendar-event" size={12} color={isDark ? t.accentBrand : "#EA580C"} />
                <Text style={styles.subGroupTitle}>Appointment Details</Text>
              </View>
              <View style={styles.twoColumnGrid}>
                <View style={styles.gridColumn}>
                  <GridKvCell
                    icon="calendar-check"
                    label="Appointment Date"
                    value={formatDateOnly(booking.preferred_date || booking.appointment_date || booking.date)}
                  />
                  <GridKvCell
                    icon="clock"
                    label="Appointment Time"
                    value={booking.preferred_time || booking.time_slot || booking.time || '10:30 AM - 12:00 PM'}
                  />
                  <GridKvCell
                    icon="tools"
                    label="Service Type"
                    value={booking.package_name || booking.service_title || booking.category || 'PMS'}
                    highlight
                  />
                </View>

                <View style={styles.gridColumn}>
                  <GridKvCell
                    icon="tag"
                    label="Booking Type"
                    value={isPmsFixed ? 'PMS Â· Fixed Rate' : 'Repair Â· Quotation'}
                  />
                  {isPmsFixed && pmsInfo ? (
                    <GridKvCell
                      icon="cash-coin"
                      label="Quoted Fixed Rate"
                      value={formatPhp(pmsInfo.rate)}
                      highlight
                    />
                  ) : null}
                </View>
              </View>

              {/* Subgroup 2: Financials */}
              <View style={[styles.subGroupHeader, { marginTop: 14 }]}>
                <BootstrapIcon name="cash-stack" size={12} color={isDark ? t.accentBrand : "#EA580C"} />
                <Text style={styles.subGroupTitle}>Financial Information</Text>
              </View>
              <View style={styles.twoColumnGrid}>
                <View style={styles.gridColumn}>
                  <GridKvCell
                    icon="cash-coin"
                    label="Service Amount"
                    value={`â‚±${basePrice.toLocaleString()}`}
                    highlight
                  />
                  <GridKvCell
                    icon="shield-check"
                    label="Down Payment"
                    value={`â‚±${dpAmount.toLocaleString()} (Paid via ${booking.downpayment_method || 'GCash'})`}
                  />
                  <GridKvCell
                    icon="wallet2"
                    label="Remaining Balance"
                    value={`â‚±${remainingBalance.toLocaleString()}`}
                    highlight
                  />
                </View>

                <View style={styles.gridColumn}>
                  <GridKvCell
                    icon="credit-card"
                    label="Payment Method"
                    value={booking.downpayment_method || 'GCash'}
                  />
                  <GridKvCell
                    icon="check-circle"
                    label="Payment Status"
                    value={payStatus || '20% DP Paid'}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Card 4: Customer Request & Notes */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <BootstrapIcon name="chat-square-quote-fill" size={14} color={isDark ? t.accentBrand : "#EA580C"} />
              <Text style={styles.cardTitle}>Customer Request & Photos</Text>
            </View>
            <View style={styles.cardBody}>
              <GridKvCell
                icon="tag-fill"
                label="Fault / Problem Category"
                value={booking.problem_description || booking.repair_type || 'Periodic Maintenance Service'}
              />

              <View style={{ marginTop: 6 }}>
                <Text style={styles.gridKvLabel}>Rider's Stated Remarks / Notes:</Text>
                <View style={styles.quoteBlock}>
                  <Text style={styles.quoteText}>
                    {booking.notes ? `"${booking.notes}"` : 'No additional remarks provided by the customer.'}
                  </Text>
                </View>
              </View>

              {media.length > 0 ? (
                <View style={{ marginTop: 8 }}>
                  <Text style={[styles.gridKvLabel, { marginBottom: 6 }]}>
                    Attached Motorcycle Photos ({media.length}):
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {media.map((url, i) => (
                      <Image
                        key={`${url}-${i}`}
                        source={{ uri: getOptimizedImageUrl(url, { width: 160, quality: 60 }) }}
                        style={styles.thumb}
                        resizeMode="cover"
                      />
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </View>
          </View>

          {/* Card 5: Status / Timeline */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <BootstrapIcon name="clock-history" size={14} color={isDark ? t.accentBrand : "#EA580C"} />
              <Text style={styles.cardTitle}>Status & Timeline</Text>
            </View>
            <View style={styles.cardBody}>
              <View style={styles.twoColumnGrid}>
                <View style={styles.gridColumn}>
                  <GridKvCell icon="flag" label="Current Status" value={statusLabel(status)} highlight />
                  <GridKvCell icon="signpost-split" label="Current Stage" value={booking.current_stage} />
                  {isRejected ? (
                    <GridKvCell
                      icon="x-circle"
                      label="Rejection Reason"
                      value={booking.rejection_reason || booking.rejection_notes || 'No reason recorded.'}
                    />
                  ) : null}
                </View>
                <View style={styles.gridColumn}>
                  <GridKvCell icon="calendar-plus" label="Submitted" value={formatDateTime(booking.created_at || booking.createdAt)} />
                  <GridKvCell
                    icon="check2-circle"
                    label="Approved"
                    value={booking.approved_at ? formatDateTime(booking.approved_at) : null}
                  />
                  <GridKvCell
                    icon="play-circle"
                    label="Service Started"
                    value={booking.service_started_at ? formatDateTime(booking.service_started_at) : null}
                  />
                  <GridKvCell
                    icon="flag-fill"
                    label="Service Completed"
                    value={booking.service_completed_at ? formatDateTime(booking.service_completed_at) : null}
                  />
                </View>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* TAB 3: QUOTATION & BILLING */}
      {activeTab === 'quotation' && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <BootstrapIcon name="receipt-cutoff" size={14} color={isDark ? t.accentBrand : "#EA580C"} />
            <Text style={styles.cardTitle}>Detailed Quotation & Parts Itemization</Text>
          </View>
          <View style={[styles.cardBody, { padding: 8 }]}>
            <Text style={{ fontSize: 11.5, color: isDark ? t.textMuted : '#64748B', paddingHorizontal: 6 }}>
              Any additional work or charge found during service must be approved by the customer
              before it proceeds. The customer is notified and the work stays on hold until they respond.
            </Text>
            <ServiceQuotationPanel
              booking={booking}
              onToast={toast}
              onUpdated={async () => {
                await refresh();
              }}
            />
          </View>
        </View>
      )}

      {/* TAB 4: INSPECTION & PROGRESS */}
      {activeTab === 'inspection' && (
        <View style={{ gap: 14 }}>
          {/* Inspection Section */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <BootstrapIcon name="search" size={14} color={isDark ? t.accentBrand : "#EA580C"} />
              <Text style={styles.cardTitle}>Vehicle Inspection & Diagnostic Findings</Text>
            </View>
            <View style={styles.cardBody}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <ClearField
                    label="Overall Condition"
                    placeholder="e.g. Good / Forks leaking / Chain slack"
                    value={insp.condition}
                    onChangeText={(t) => setInsp((p) => ({ ...p, condition: t }))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <ClearField
                    label="Estimated Labor Hours"
                    placeholder="e.g. 1.5 or 2"
                    value={insp.estimatedHours}
                    onChangeText={(t) => setInsp((p) => ({ ...p, estimatedHours: t }))}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
              <ClearField
                label="Identified Problems & Symptoms"
                placeholder="Diagnostic observations found by technician..."
                value={insp.findings}
                onChangeText={(t) => setInsp((p) => ({ ...p, findings: t }))}
                multiline
              />
              <ClearField
                label="Recommended Repairs"
                placeholder="Recommended repairs / adjustments..."
                value={insp.recommended}
                onChangeText={(t) => setInsp((p) => ({ ...p, recommended: t }))}
              />
              <ClearField
                label="Parts Needed from Inventory"
                placeholder="e.g. Brake pads, Engine oil 10W-40, Oil filter..."
                value={insp.recommendedParts}
                onChangeText={(t) => setInsp((p) => ({ ...p, recommendedParts: t }))}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 }}>
                <ActionBtn
                  label="Save Inspection Findings"
                  icon="clipboard-check"
                  primary
                  onPress={saveInspection}
                  disabled={busy}
                />
              </View>
            </View>
          </View>

          {/* Service Progress Tracking */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <BootstrapIcon name="tools" size={14} color={isDark ? t.accentBrand : "#EA580C"} />
              <Text style={styles.cardTitle}>Service Progress & Work Executed</Text>
            </View>
            <View style={styles.cardBody}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <ClearField
                    label="Actual Labor Hours Spent"
                    placeholder="e.g. 2.0"
                    value={actualHours}
                    onChangeText={setActualHours}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
              <ClearField
                label="Service Notes / Replaced Parts"
                placeholder="Log work completed, torque settings, test-ride results..."
                value={progressNotes}
                onChangeText={setProgressNotes}
                multiline
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 }}>
                <ActionBtn
                  label="Update Service Progress"
                  icon="save"
                  primary
                  onPress={saveProgress}
                  disabled={busy}
                />
              </View>
            </View>
          </View>

          {/* Pickup QR & Verification */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <BootstrapIcon name="qr-code-scan" size={14} color={isDark ? t.accentBrand : "#EA580C"} />
              <Text style={styles.cardTitle}>Vehicle Release & QR Verification</Text>
            </View>
            <View style={styles.cardBody}>
              <InfoItem
                icon="qr-code"
                label="Pickup Token"
                value={booking.pickup_qr_token || 'Not generated yet'}
              />
              <InfoItem
                icon="check2-all"
                label="Released At"
                value={formatDateTime(booking.pickup_verified_at || booking.released_at)}
              />
              <View style={{ flexDirection: 'row', gap: 8, marginVertical: 8 }}>
                {!booking.pickup_qr_token && (
                  <ActionBtn
                    label="Generate Pickup QR"
                    icon="qr-code"
                    primary
                    onPress={generateQr}
                    disabled={busy}
                  />
                )}
              </View>
              <PickupQrScannerPanel
                onToast={toast}
                onCompleted={async () => {
                  await refresh();
                }}
              />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

export default function AdminBookingDetailsPanel({ isDarkMode = false, ...props }) {
  const value = useMemo(() => {
    const t = getThemeTokens(isDarkMode);
    return { t, isDark: isDarkMode, styles: createStyles(t, isDarkMode) };
  }, [isDarkMode]);
  return (
    <DetailsThemeContext.Provider value={value}>
      <AdminBookingDetailsPanelInner {...props} />
    </DetailsThemeContext.Provider>
  );
}

function createStyles(t, isDark) {
  return StyleSheet.create({
    wrap: { gap: 12 },
    empty: { padding: 32, alignItems: 'center' },
    emptyText: { color: isDark ? t.textMuted : '#94A3B8', fontSize: 13 },

    topStatusStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? t.bgSub : '#F8FAFC',
      borderRadius: 12,
      padding: 10,
      borderWidth: 1,
      borderColor: isDark ? t.border : '#E2E8F0',
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 4.5,
      borderRadius: 8,
      borderWidth: 1,
    },
    statusBadgeText: { fontSize: 12, fontWeight: '800' },
    paymentPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: isDark ? t.bgCard : '#FFFFFF',
      borderWidth: 1,
      borderColor: isDark ? t.borderInput : '#CBD5E1',
      paddingHorizontal: 9,
      paddingVertical: 4.5,
      borderRadius: 8,
    },
    paymentPillText: { fontSize: 11.5, fontWeight: '700', color: isDark ? t.textSecondary : '#334155' },
    dpBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 4.5,
      borderRadius: 8,
    },
    dpBadgePaid: { backgroundColor: isDark ? t.statusSuccessBg : '#F0FDF4', borderWidth: 1, borderColor: isDark ? t.accentBorder : '#BBF7D0' },
    dpBadgeCancelled: { backgroundColor: isDark ? t.statusDangerBg : '#FEF2F2', borderWidth: 1, borderColor: isDark ? 'rgba(180, 120, 120, 0.28)' : '#FECACA' },
    dpBadgeText: { fontSize: 11.5, fontWeight: '800' },

    actionToolbar: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 13,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1.5,
      borderColor: isDark ? t.accentBorder : '#EA580C',
      backgroundColor: isDark ? t.bgCard : '#FFFFFF',
    },
    actionBtnPrimary: {
      backgroundColor: isDark ? '#EA580C' : '#EA580C',
      borderColor: isDark ? '#EA580C' : '#EA580C',
    },
    actionBtnDanger: { borderColor: isDark ? 'rgba(180, 120, 120, 0.28)' : '#FECACA', backgroundColor: isDark ? t.statusDangerBg : '#FEF2F2' },
    actionBtnOutline: { borderColor: isDark ? t.borderInput : '#CBD5E1', backgroundColor: isDark ? t.bgCard : '#FFFFFF' },
    actionBtnDisabled: { opacity: 0.5 },
    actionBtnText: { fontSize: 12, fontWeight: '800', color: isDark ? t.accentBrand : '#EA580C' },

    dialogBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(15, 23, 42, 0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    },
    dialogCard: { width: '100%', maxWidth: 480 },
    interactiveDrawer: {
      backgroundColor: isDark ? t.bgSub : '#F8FAFC',
      borderRadius: 12,
      padding: 14,
      borderWidth: 1.5,
      borderColor: isDark ? t.borderInput : '#CBD5E1',
    },

    tabBar: {
      flexDirection: 'row',
      backgroundColor: isDark ? t.bgSub : '#F1F5F9',
      borderRadius: 12,
      padding: 4,
      gap: 4,
      borderWidth: 1,
      borderColor: isDark ? t.border : '#E2E8F0',
    },
    tabButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 9,
      paddingHorizontal: 8,
      borderRadius: 8,
    },
    tabButtonActive: {
      backgroundColor: isDark ? t.bgElevated : '#FFFFFF',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 2,
    },
    tabButtonText: { fontSize: 12, fontWeight: '700', color: isDark ? t.textMuted : '#64748B' },
    tabButtonTextActive: { color: isDark ? t.accentBrand : '#EA580C', fontWeight: '800' },

    cardsGrid: {
      gap: 14,
    },
    card: {
      backgroundColor: isDark ? t.bgCard : '#FFFFFF',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isDark ? t.border : '#E2E8F0',
      overflow: 'hidden',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.03,
      shadowRadius: 4,
      elevation: 1,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: isDark ? t.bgSub : '#F8FAFC',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? t.border : '#F1F5F9',
    },
    cardTitle: { fontSize: 13.5, fontWeight: '800', color: isDark ? t.textPrimary : '#0F172A', letterSpacing: -0.2 },
    cardBody: { padding: 16, gap: 10 },

    twoColumnGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    gridColumn: {
      flex: 1,
      minWidth: 240,
      gap: 10,
    },
    gridKvCell: {
      backgroundColor: isDark ? t.bgSub : '#F8FAFC',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderWidth: 1,
      borderColor: isDark ? t.border : '#F1F5F9',
    },
    gridKvLabel: {
      fontSize: 10,
      fontWeight: '800',
      color: isDark ? t.textMuted : '#64748B',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    gridKvValue: {
      fontSize: 13,
      fontWeight: '700',
      color: isDark ? t.textPrimary : '#0F172A',
    },
    subGroupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
      marginTop: 4,
      paddingBottom: 4,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? t.border : '#F1F5F9',
    },
    subGroupTitle: {
      fontSize: 11,
      fontWeight: '800',
      color: isDark ? t.textMuted : '#64748B',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    cardHeaderIconWrap: {
      width: 26,
      height: 26,
      borderRadius: 7,
      backgroundColor: isDark ? t.accentBg : '#FFF7ED',
      alignItems: 'center',
      justifyContent: 'center',
    },

    infoItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    infoItemLabel: { fontSize: 12, color: isDark ? t.textMuted : '#64748B', fontWeight: '600' },
    infoItemValue: { fontSize: 12.5, color: isDark ? t.textPrimary : '#0F172A', fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
    itemBadge: { alignItems: 'flex-end' },

    bikePlatePill: {
      backgroundColor: isDark ? t.bgSub : '#F1F5F9',
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: isDark ? t.borderInput : '#CBD5E1',
    },
    bikePlateText: { fontSize: 11, fontWeight: '800', color: isDark ? t.textPrimary : '#0F172A' },

    quoteBlock: {
      marginTop: 4,
      backgroundColor: isDark ? t.bgSub : '#F8FAFC',
      borderRadius: 8,
      padding: 10,
      borderLeftWidth: 3,
      borderLeftColor: isDark ? t.accentBrand : '#EA580C',
    },
    quoteText: { fontSize: 12.5, color: isDark ? t.textSecondary : '#334155', fontStyle: 'italic', lineHeight: 18 },

    svcTable: {
      borderWidth: 1,
      borderColor: isDark ? t.border : '#E2E8F0',
      borderRadius: 10,
      overflow: 'hidden',
    },
    svcRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderTopWidth: 1,
      borderTopColor: isDark ? t.border : '#F1F5F9',
    },
    svcHeadRow: { backgroundColor: isDark ? t.bgSub : '#F8FAFC', borderTopWidth: 0 },
    svcHeadText: {
      fontSize: 10,
      fontWeight: '800',
      color: isDark ? t.textMuted : '#64748B',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    svcCell: { fontSize: 12.5, fontWeight: '700', color: isDark ? t.textPrimary : '#0F172A' },
    svcCellMuted: { fontSize: 12, color: isDark ? t.textMuted : '#64748B' },
    svcTag: { fontSize: 10, fontWeight: '800', color: isDark ? t.statusWarningText : '#B45309', marginTop: 2 },
    svcTotals: { gap: 4, marginTop: 4 },
    svcTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    svcGrandRow: {
      marginTop: 4,
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: isDark ? t.border : '#E2E8F0',
    },
    svcTotalLabel: { fontSize: 12.5, color: isDark ? t.textSecondary : '#475569', fontWeight: '600' },
    svcTotalValue: { fontSize: 12.5, fontWeight: '800', color: isDark ? t.textPrimary : '#0F172A' },
    svcDisclaimer: {
      fontSize: 11.5,
      lineHeight: 16,
      color: isDark ? t.statusWarningText : '#92400E',
      backgroundColor: isDark ? t.statusWarningBg : '#FFFBEB',
      borderRadius: 8,
      padding: 10,
      fontWeight: '600',
    },

    thumb: { width: 88, height: 88, borderRadius: 8, backgroundColor: isDark ? t.bgSub : '#E2E8F0' },

    avatarCircle: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: isDark ? t.statusWarningBg : '#FEF3C7',
      alignItems: 'center',
      justifyContent: 'center',
    },

    rosterCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 10,
      borderRadius: 9,
      borderWidth: 1.5,
      borderColor: isDark ? t.border : '#E2E8F0',
      backgroundColor: isDark ? t.bgCard : '#FFFFFF',
    },
    rosterCardSelected: {
      borderColor: isDark ? t.accentBrand : '#EA580C',
      backgroundColor: isDark ? t.accentBg : '#F0FDF4',
    },
    rosterAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDark ? t.bgSub : '#F1F5F9',
      alignItems: 'center',
      justifyContent: 'center',
    },
    rosterName: { fontSize: 12.5, fontWeight: '700', color: isDark ? t.textPrimary : '#0F172A' },
    rosterSub: { fontSize: 11, color: isDark ? t.textMuted : '#64748B' },
    rosterAssignedPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: isDark ? t.statusSuccessBg : '#DCFCE7',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },

    fieldWrap: { marginBottom: 10 },
    fieldLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: isDark ? t.textSecondary : '#475569',
      marginBottom: 4,
    },
    input: {
      borderWidth: 1.5,
      borderColor: isDark ? t.borderInput : '#CBD5E1',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? t.textPrimary : '#0F172A',
      backgroundColor: isDark ? t.inputBg : '#FFFFFF',
      outlineStyle: 'none',
    },
    inputMultiline: {
      minHeight: 65,
      textAlignVertical: 'top',
    },
  });
}
