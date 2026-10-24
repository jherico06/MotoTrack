/**
 * Organized Admin Service Booking Manager
 * Pipeline stages + attention queue + one-click next actions.
 * Preserves legacy package bookings alongside flexible workflow.
 */
import React, { useMemo, useState } from 'react';
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
import { getThemeTokens } from '../../styles/theme.js';
import ServiceQuotationPanel from './ServiceQuotationPanel.jsx';
import PickupQrScannerPanel from './PickupQrScannerPanel.jsx';
import { garageService } from '../../services/bookings/garageService.js';
import { serviceQuotationService } from '../../services/bookings/serviceQuotationService.js';
import { isPmsFixedBooking } from '../../utils/pmsCcPricing.js';
import {
  FLEX_BOOKING_STATUS,
  normalizeBookingStatus,
  formatPhp,
} from '../../utils/serviceQuotation.js';

/** Workflow stages for admin (grouped, actionable) â€” payment after approve */
export const BOOKING_PIPELINE = [
  {
    id: 'review',
    label: 'Needs Review',
    icon: 'inbox',
    color: '#D97706',
    bg: '#FEF3C7',
    statuses: [FLEX_BOOKING_STATUS.PENDING_REVIEW, FLEX_BOOKING_STATUS.NEEDS_INFORMATION, 'Pending'],
    nextHint: 'Approve, reject, or request info',
  },
  {
    id: 'payment',
    label: 'Payment Required',
    icon: 'cash-coin',
    color: '#EA580C',
    bg: '#FFEDD5',
    statuses: [FLEX_BOOKING_STATUS.APPROVED, FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT],
    nextHint: 'Record downpayment',
  },
  {
    id: 'schedule',
    label: 'Schedule',
    icon: 'calendar-check',
    color: '#0284C7',
    bg: '#E0F2FE',
    statuses: [FLEX_BOOKING_STATUS.CONFIRMED],
    nextHint: 'Confirm the appointment',
  },
  {
    id: 'inspect',
    label: 'Scheduled / Quote',
    icon: 'search',
    color: '#7C3AED',
    bg: '#EDE9FE',
    statuses: [
      FLEX_BOOKING_STATUS.SCHEDULED,
      FLEX_BOOKING_STATUS.UNDER_INSPECTION,
      FLEX_BOOKING_STATUS.ESTIMATE_SUBMITTED,
      'Confirmed',
      'Inspection',
    ],
    nextHint: 'Start service (PMS) or inspect â†’ quotation (Repair)',
  },
  {
    id: 'waiting_customer',
    label: 'Waiting Customer',
    icon: 'hourglass-split',
    color: '#0284C7',
    bg: '#E0F2FE',
    statuses: [
      FLEX_BOOKING_STATUS.QUOTATION_SENT,
      FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL,
      FLEX_BOOKING_STATUS.ADDITIONAL_APPROVAL_REQUIRED,
      'Estimate Pending',
    ],
    nextHint: 'Customer quotation / extra work decision',
  },
  {
    id: 'service',
    label: 'In Service',
    icon: 'tools',
    color: '#EA580C',
    bg: '#C8DDD3',
    statuses: [FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS, 'In Progress'],
    nextHint: 'Track work / actual hours',
  },
  {
    id: 'billing',
    label: 'Billing & Pickup',
    icon: 'cash-stack',
    color: '#059669',
    bg: '#D1FAE5',
    statuses: [
      FLEX_BOOKING_STATUS.SERVICE_COMPLETED,
      FLEX_BOOKING_STATUS.FOR_FINAL_BILLING,
      FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT,
      FLEX_BOOKING_STATUS.FULLY_PAID,
      FLEX_BOOKING_STATUS.READY_FOR_PICKUP,
      'Service Done',
      'Paid',
    ],
    nextHint: 'Record balance / verify pickup',
  },
  {
    id: 'done',
    label: 'Completed',
    icon: 'check-circle-fill',
    color: '#64748B',
    bg: '#F1F5F9',
    statuses: [
      FLEX_BOOKING_STATUS.COMPLETED,
      FLEX_BOOKING_STATUS.REJECTED,
      FLEX_BOOKING_STATUS.CANCELLED,
      FLEX_BOOKING_STATUS.CUSTOMER_DECLINED,
      FLEX_BOOKING_STATUS.BOOKING_EXPIRED,
      'Closed',
      'Completed',
      'Cancelled',
      'Rejected',
    ],
    nextHint: 'Closed archive',
  },
];

const DARK_STAGE_TONE = {
  review: 'Warning',
  payment: 'Warning',
  schedule: 'Info',
  inspect: 'Purple',
  waiting_customer: 'Info',
  service: 'Success',
  billing: 'Success',
};

function stageTheme(stage, t, isDark) {
  if (!isDark) return stage;
  const tone = DARK_STAGE_TONE[stage.id];
  if (!tone) return { ...stage, color: t.textMuted, bg: t.bgSub };
  return { ...stage, color: t['status' + tone + 'Text'], bg: t['status' + tone + 'Bg'] };
}

function stageForBooking(booking) {
  const status = booking?.status || '';
  const normalized = normalizeBookingStatus(status);
  for (const stage of BOOKING_PIPELINE) {
    if (
      stage.statuses.includes(status) ||
      stage.statuses.includes(normalized) ||
      stage.statuses.some((s) => String(s).toLowerCase() === String(status).toLowerCase())
    ) {
      return stage;
    }
  }
  return BOOKING_PIPELINE[0];
}

function statusLabel(status) {
  return String(status || 'Unknown').replace(/_/g, ' ');
}

/** Multi-service summary for list cards: count, truncated names, labor subtotal. */
function serviceSummary(booking) {
  const items = Array.isArray(booking?.service_line_items) ? booking.service_line_items : [];
  const ids = Array.isArray(booking?.service_ids)
    ? booking.service_ids
    : Array.isArray(booking?.selected_service_ids)
      ? booking.selected_service_ids
      : [];
  const names = items.map((i) => i?.serviceName || i?.service_name).filter(Boolean);
  const count = items.length || ids.length || (booking?.service_title || booking?.package_name ? 1 : 0);
  let label = names.length
    ? names.slice(0, 2).join(', ') + (names.length > 2 ? ` +${names.length - 2} more` : '')
    : String(booking?.service_title || booking?.package_name || '');
  if (label.length > 60) label = `${label.slice(0, 57)}...`;
  const labor = Number(booking?.labor_subtotal ?? booking?.quoted_service_rate ?? 0) || 0;
  return { count, label, labor };
}

function primaryAction(booking) {
  const s = normalizeBookingStatus(booking?.status);
  const raw = String(booking?.status || '');
  if (s === FLEX_BOOKING_STATUS.PENDING_REVIEW || raw === 'Pending' || s === FLEX_BOOKING_STATUS.NEEDS_INFORMATION) {
    return { id: 'approve', label: 'Review Booking', icon: 'check2-circle' };
  }
  if (s === FLEX_BOOKING_STATUS.APPROVED || s === FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT) {
    return { id: 'finalize', label: 'Record Downpayment', icon: 'cash-coin' };
  }
  if (s === FLEX_BOOKING_STATUS.CONFIRMED) {
    return { id: 'schedule', label: 'Confirm Appointment', icon: 'calendar-check' };
  }
  if (s === FLEX_BOOKING_STATUS.SCHEDULED) {
    // PMS fixed-rate is already quoted â†’ go straight to service; Repair is inspected + quoted first.
    return isPmsFixedBooking(booking)
      ? { id: 'start', label: 'Start Service', icon: 'play-fill' }
      : { id: 'inspect', label: 'Start Inspection', icon: 'search' };
  }
  if (s === FLEX_BOOKING_STATUS.UNDER_INSPECTION || raw === 'Inspection') {
    return { id: 'open', label: 'Inspect & Quote', icon: 'search' };
  }
  if (s === FLEX_BOOKING_STATUS.ESTIMATE_SUBMITTED) {
    return { id: 'quote', label: 'Review Quotation', icon: 'receipt' };
  }
  if (
    s === FLEX_BOOKING_STATUS.QUOTATION_SENT ||
    s === FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL
  ) {
    return { id: 'open', label: 'Waiting Customer', icon: 'hourglass-split' };
  }
  if (s === FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS || raw === 'In Progress') {
    return { id: 'complete', label: 'Complete Service', icon: 'flag' };
  }
  if (s === FLEX_BOOKING_STATUS.ADDITIONAL_APPROVAL_REQUIRED) {
    return { id: 'open', label: 'Waiting Extra Approval', icon: 'exclamation-triangle' };
  }
  if (
    s === FLEX_BOOKING_STATUS.SERVICE_COMPLETED ||
    s === FLEX_BOOKING_STATUS.FOR_FINAL_BILLING ||
    s === FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT ||
    raw === 'Service Done'
  ) {
    return { id: 'finalize', label: 'Finalize Billing', icon: 'cash-stack' };
  }
  if (s === FLEX_BOOKING_STATUS.FULLY_PAID) {
    return { id: 'pickup', label: 'Release for Pickup', icon: 'box-arrow-up' };
  }
  if (s === FLEX_BOOKING_STATUS.READY_FOR_PICKUP || raw === 'Paid') {
    return { id: 'pickup', label: 'Scan Pickup QR', icon: 'qr-code' };
  }
  return { id: 'open', label: 'Open Details', icon: 'eye-fill' };
}

export default function AdminBookingManager({
  bookings = [],
  // `mechanics` prop is ignored (admin-only workflow); kept so existing callers don't break.
  onRefresh,
  onToast,
  onOpenLegacyModal,
  styles: parentStyles,
  isDarkMode = false,
}) {
  const t = useMemo(() => getThemeTokens(isDarkMode), [isDarkMode]);
  const s = useMemo(() => createStyles(t, isDarkMode), [t, isDarkMode]);
  const [pipelineFilter, setPipelineFilter] = useState('review');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showPickup, setShowPickup] = useState(false);

  const toast = (m) => onToast?.(m);

  const counts = useMemo(() => {
    const map = { all: bookings.length };
    BOOKING_PIPELINE.forEach((stage) => {
      map[stage.id] = bookings.filter((b) => stageForBooking(b).id === stage.id).length;
    });
    return map;
  }, [bookings]);

  const attentionCount =
    (counts.review || 0) +
    (counts.payment || 0) +
    (counts.schedule || 0) +
    (counts.inspect || 0) +
    (counts.billing || 0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookings
      .filter((b) => {
        const stage = stageForBooking(b);
        if (pipelineFilter !== 'all' && stage.id !== pipelineFilter) return false;
        if (!q) return true;
        const hay = [
          b.booking_id,
          b.id,
          b.customer_name,
          b.userName,
          b.customer_phone,
          b.bike_brand,
          b.bike_model,
          b.plate_number,
          b.bikePlate,
          b.service_title,
          b.status,
          // PMS fixed-rate fields (CC category / selected service) are searchable
          b.cc_category_name,
          b.cc_category_id,
          b.pms_service_name,
          b.pms_service_id,
          b.motorcycle_cc,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        const ta = new Date(a.created_at || a.createdAt || 0).getTime();
        const tb = new Date(b.created_at || b.createdAt || 0).getTime();
        return tb - ta;
      });
  }, [bookings, pipelineFilter, search]);

  const selected = useMemo(
    () =>
      bookings.find(
        (b) => (b.booking_id || b.id) === selectedId
      ) || null,
    [bookings, selectedId]
  );

  const refresh = async () => {
    const list = await garageService.fetchBookings();
    onRefresh?.(list);
  };

  const runAction = async (booking, actionId) => {
    const id = booking.booking_id || booking.id;
    setBusyId(id);
    try {
      if (actionId === 'approve') {
        // No mechanic required. PMS fixed bookings use their already-quoted rate.
        const pmsRate = isPmsFixedBooking(booking)
          ? Number(
              booking.labor_subtotal ??
                booking.quoted_service_rate ??
                booking.estimated_service_total ??
                booking.package_price ??
                0
            )
          : Number(booking.labor_subtotal ?? booking.quoted_service_rate ?? 0) || 0;
        await garageService.approveBooking(id, null, {
          flexible: true,
          approvedBy: 'admin',
          ...(pmsRate > 0 ? { estimatedServiceCost: pmsRate, estimated_service_total: pmsRate } : {}),
        });
        toast(`Approved #${id} â€” awaiting downpayment`);
        setSelectedId(id);
      } else if (actionId === 'reject') {
        setRejectOpen(true);
        setSelectedId(id);
        return;
      } else if (actionId === 'schedule') {
        await garageService.scheduleAppointment(id, {
          preferredDate: booking.preferred_date || booking.appointment_date,
          preferredTime: booking.preferred_time || booking.time_slot,
          scheduledBy: 'admin',
        });
        toast(`Appointment confirmed for #${id} â€¢ Status â†’ Scheduled`);
        setSelectedId(id);
      } else if (actionId === 'inspect') {
        await garageService.updateBooking(id, {
          status: FLEX_BOOKING_STATUS.UNDER_INSPECTION,
          inspection_started_at: new Date().toISOString(),
          current_stage: 'Under inspection',
        });
        toast(`Inspection started for #${id}`);
        setSelectedId(id);
      } else if (actionId === 'start') {
        await garageService.startService(id);
        toast(`Service started for #${id}`);
      } else if (actionId === 'complete') {
        const fin = await serviceQuotationService.finalizeBilling(id);
        if (!fin?.success) throw new Error(fin?.error || 'Finalize failed');
        toast(
          fin.remaining > 0
            ? `Service completed â€¢ Remaining balance ${formatPhp(fin.remaining)}`
            : 'Service completed â€¢ Ready for pickup'
        );
        setSelectedId(id);
      } else if (
        actionId === 'finalize' ||
        actionId === 'quote' ||
        actionId === 'open'
      ) {
        setSelectedId(id);
      } else if (actionId === 'pickup') {
        setSelectedId(id);
        setShowPickup(true);
      }
      await refresh();
    } catch (e) {
      toast(e?.message || 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  const confirmReject = async () => {
    if (!selectedId) return;
    if (!rejectReason.trim()) {
      toast('Please enter a rejection reason');
      return;
    }
    setBusyId(selectedId);
    try {
      await garageService.rejectBooking(selectedId, rejectReason.trim());
      toast(`Rejected #${selectedId}`);
      setRejectOpen(false);
      setRejectReason('');
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={s.root}>
      {/* Header summary */}
      <View style={s.hero}>
        <View style={{ flex: 1 }}>
          <Text style={s.heroTitle}>Service Booking Desk</Text>
          <Text style={s.heroSub}>
            {attentionCount > 0
              ? `${attentionCount} booking${attentionCount === 1 ? '' : 's'} need your attention`
              : 'Queue is clear â€” no urgent actions'}
          </Text>
        </View>
        <TouchableOpacity style={s.refreshBtn} onPress={refresh} activeOpacity={0.85}>
          <BootstrapIcon name="arrow-clockwise" size={14} color={isDarkMode ? t.accentBrand : '#EA580C'} />
          <Text style={s.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Pipeline chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.pipelineScroll}>
        <TouchableOpacity
          style={[s.pipeChip, pipelineFilter === 'all' && s.pipeChipOn]}
          onPress={() => setPipelineFilter('all')}
        >
          <Text style={[s.pipeChipText, pipelineFilter === 'all' && s.pipeChipTextOn]}>
            All ({counts.all})
          </Text>
        </TouchableOpacity>
        {BOOKING_PIPELINE.map((rawStage) => {
          const stage = stageTheme(rawStage, t, isDarkMode);
          const on = pipelineFilter === stage.id;
          const n = counts[stage.id] || 0;
          const onChipText = isDarkMode ? t.textPrimary : '#FFF';
          return (
            <TouchableOpacity
              key={stage.id}
              style={[
                s.pipeChip,
                { borderColor: stage.color },
                on && { backgroundColor: isDarkMode ? t.bgElevated : stage.color },
                n > 0 && stage.id !== 'done' && !on && { backgroundColor: stage.bg },
              ]}
              onPress={() => setPipelineFilter(stage.id)}
            >
              <BootstrapIcon name={stage.icon} size={12} color={on ? onChipText : stage.color} />
              <Text style={[s.pipeChipText, { color: on ? onChipText : stage.color }]}>
                {stage.label}
              </Text>
              <View style={[s.badge, on && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                <Text style={[s.badgeText, on && { color: onChipText }]}>{n}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Search */}
      <View style={s.searchRow}>
        <BootstrapIcon name="search" size={14} color={isDarkMode ? t.textMuted : '#64748B'} />
        <TextInput
          style={s.searchInput}
          placeholder="Search booking ID, customer, plate, bikeâ€¦"
          placeholderTextColor={isDarkMode ? t.placeholder : '#94A3B8'}
          value={search}
          onChangeText={setSearch}
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <BootstrapIcon name="x-circle" size={14} color={isDarkMode ? t.placeholder : '#94A3B8'} />
          </TouchableOpacity>
        )}
      </View>

      <View style={s.split}>
        {/* List */}
        <ScrollView style={s.listPane} contentContainerStyle={{ paddingBottom: 40 }}>
          {filtered.length === 0 ? (
            <View style={s.empty}>
              <BootstrapIcon name="calendar-x" size={28} color={isDarkMode ? t.placeholder : '#94A3B8'} />
              <Text style={s.emptyTitle}>No bookings in this stage</Text>
              <Text style={s.emptySub}>Try another pipeline filter or clear search.</Text>
            </View>
          ) : (
            filtered.map((b) => {
              const id = b.booking_id || b.id;
              const stage = stageTheme(stageForBooking(b), t, isDarkMode);
              const action = primaryAction(b);
              const isSel = selectedId === id;
              const isBusy = busyId === id;
              return (
                <TouchableOpacity
                  key={id}
                  style={[s.card, isSel && s.cardSelected, { borderLeftColor: stage.color }]}
                  onPress={() => {
                    setSelectedId(id);
                    setShowPickup(false);
                    setRejectOpen(false);
                  }}
                  activeOpacity={0.9}
                >
                  <View style={s.cardTop}>
                    <Text style={s.ref}>{id}</Text>
                    <View style={[s.statusPill, { backgroundColor: stage.bg }]}>
                      <Text style={[s.statusPillText, { color: stage.color }]}>
                        {statusLabel(b.status)}
                      </Text>
                    </View>
                  </View>
                  <Text style={s.customer}>{b.customer_name || b.userName || 'Customer'}</Text>
                  <Text style={s.meta} numberOfLines={1}>
                    {[b.bike_brand || b.bikeBrand, b.bike_model || b.bikeModel]
                      .filter(Boolean)
                      .join(' ') || 'Motorcycle'}{' '}
                    Â· {b.plate_number || b.bikePlate || 'â€”'}
                  </Text>
                  <Text style={s.meta} numberOfLines={1}>
                    {b.appointment_date || b.preferred_date || b.date || 'â€”'} Â·{' '}
                    {b.time_slot || b.preferred_time || b.time || 'â€”'}
                  </Text>
                  {(() => {
                    const sum = serviceSummary(b);
                    if (!sum.count && !sum.label) return null;
                    return (
                      <Text style={s.meta} numberOfLines={2}>
                        {sum.count > 0 ? `${sum.count} service${sum.count === 1 ? '' : 's'}` : 'Services'}
                        {sum.label ? ` · ${sum.label}` : ''}
                        {sum.labor > 0 ? ` · Labor ${formatPhp(sum.labor)}` : ''}
                      </Text>
                    );
                  })()}
                  {b.current_stage ? (
                    <Text style={s.stageLine} numberOfLines={2}>
                      {b.current_stage}
                    </Text>
                  ) : null}
                  <View style={s.cardActions}>
                    <TouchableOpacity
                      style={[s.primaryBtn, { backgroundColor: isDarkMode ? '#EA580C' : stage.color }]}
                      onPress={() => runAction(b, action.id)}
                      disabled={!!isBusy}
                    >
                      {isBusy ? (
                        <ActivityIndicator color="#FFF" size="small" />
                      ) : (
                        <>
                          <BootstrapIcon name={action.icon} size={12} color="#FFF" />
                          <Text style={s.primaryBtnText}>{action.label}</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    {(normalizeBookingStatus(b.status) === FLEX_BOOKING_STATUS.PENDING_REVIEW ||
                      b.status === 'Pending') && (
                      <TouchableOpacity
                        style={s.rejectBtn}
                        onPress={() => runAction(b, 'reject')}
                      >
                        <Text style={s.rejectBtnText}>Reject</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

        {/* Detail pane */}
        <ScrollView style={s.detailPane} contentContainerStyle={{ paddingBottom: 48 }}>
          {!selected ? (
            <View style={s.emptyDetail}>
              <BootstrapIcon name="grid-1x2-fill" size={32} color={isDarkMode ? t.textSubtle : '#CBD5E1'} />
              <Text style={s.emptyTitle}>Select a booking</Text>
              <Text style={s.emptySub}>
                Choose a card on the left to review, schedule, build a quotation, or verify pickup.
              </Text>
            </View>
          ) : (
            <>
              <View style={s.detailHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.detailRef}>{selected.booking_id || selected.id}</Text>
                  <Text style={s.detailCustomer}>
                    {selected.customer_name || selected.userName}
                  </Text>
                  <Text style={s.meta}>
                    {statusLabel(selected.status)} Â· {stageForBooking(selected).nextHint}
                  </Text>
                </View>
                {onOpenLegacyModal && (
                  <TouchableOpacity
                    style={s.legacyBtn}
                    onPress={() => onOpenLegacyModal(selected)}
                  >
                    <BootstrapIcon name="pencil-square" size={13} color={isDarkMode ? t.accentBrand : '#EA580C'} />
                    <Text style={s.legacyBtnText}>Full form</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={s.infoGrid}>
                <InfoRow s={s}
                  label="Motorcycle"
                  value={`${selected.bike_brand || selected.bikeBrand || ''} ${selected.bike_model || selected.bikeModel || ''}`.trim() || 'â€”'}
                />
                <InfoRow s={s} label="Plate" value={selected.plate_number || selected.bikePlate || 'â€”'} />
                <InfoRow s={s}
                  label="Schedule"
                  value={`${selected.appointment_date || selected.preferred_date || selected.date || 'â€”'} Â· ${selected.time_slot || selected.preferred_time || selected.time || 'â€”'}`}
                />
                <InfoRow s={s} label="Phone" value={selected.customer_phone || selected.userPhone || 'â€”'} />
                <InfoRow s={s} label="Service" value={selected.service_title || selected.serviceName || selected.category || 'â€”'} />
                {!isPmsFixedBooking(selected) && serviceSummary(selected).labor > 0 && (
                  <InfoRow s={s} label="Labor Subtotal" value={formatPhp(serviceSummary(selected).labor)} />
                )}
                {selected.rejection_reason && /reject/i.test(String(selected.status || '')) ? (
                  <InfoRow s={s} label="Rejection Reason" value={selected.rejection_reason} />
                ) : null}
                {isPmsFixedBooking(selected) && (
                  <>
                    <InfoRow s={s} label="Booking Type" value="PMS Â· Fixed Rate" />
                    <InfoRow
                      s={s}
                      label="Motorcycle CC"
                      value={
                        selected.motorcycle_cc ?? selected.engine_cc ?? selected.cc
                          ? `${selected.motorcycle_cc ?? selected.engine_cc ?? selected.cc} cc`
                          : 'â€”'
                      }
                    />
                    <InfoRow
                      s={s}
                      label="CC Category"
                      value={selected.cc_category_name || selected.cc_category || selected.cc_category_id || 'â€”'}
                    />
                    <InfoRow
                      s={s}
                      label="PMS Service"
                      value={selected.pms_service_name || selected.service_title || selected.pms_service_id || 'â€”'}
                    />
                    <InfoRow
                      s={s}
                      label="Quoted Fixed Rate"
                      value={formatPhp(
                        selected.labor_subtotal ?? selected.quoted_service_rate ?? selected.estimated_service_total ?? selected.package_price ?? 0
                      )}
                    />
                  </>
                )}
                {(selected.estimated_service_total > 0 || selected.final_service_total > 0) && (
                  <InfoRow s={s}
                    label="Quoted / Final"
                    value={`${formatPhp(selected.estimated_service_total || 0)} / ${formatPhp(selected.final_service_total || selected.estimated_service_total || 0)}`}
                  />
                )}
                {selected.problem_description || selected.notes ? (
                  <InfoRow s={s}
                    label="Problem / Notes"
                    value={selected.problem_description || selected.notes}
                  />
                ) : null}
              </View>

              {/* Approve block for pending */}
              {(normalizeBookingStatus(selected.status) === FLEX_BOOKING_STATUS.PENDING_REVIEW ||
                selected.status === 'Pending') && (
                <View style={s.actionBlock}>
                  <Text style={s.blockTitle}>1. Review & approve</Text>
                  <Text style={s.meta}>
                    No mechanic assignment needed - the admin handles scheduling, service, and billing.
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <TouchableOpacity
                      style={[s.primaryBtn, { flex: 1, backgroundColor: isDarkMode ? '#EA580C' : '#EA580C' }]}
                      onPress={() => runAction(selected, 'approve')}
                    >
                      <Text style={s.primaryBtnText}>Approve Booking</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.rejectBtn}
                      onPress={() => {
                        setRejectOpen(true);
                      }}
                    >
                      <Text style={s.rejectBtnText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {rejectOpen && (
                <View style={s.actionBlock}>
                  <Text style={s.blockTitle}>Reject reason</Text>
                  <TextInput
                    style={s.input}
                    value={rejectReason}
                    onChangeText={setRejectReason}
                    placeholder="Schedule conflict, incomplete infoâ€¦"
                    placeholderTextColor={isDarkMode ? t.placeholder : undefined}
                  />
                  <TouchableOpacity style={[s.primaryBtn, { backgroundColor: isDarkMode ? '#5A3A3A' : '#DC2626' }]} onPress={confirmReject}>
                    <Text style={s.primaryBtnText}>Confirm Reject</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Quotation / billing — PMS fixed-rate bookings are already quoted, so skip it */}
              {isPmsFixedBooking(selected) ? (
                <View style={s.actionBlock}>
                  <Text style={s.blockTitle}>2. Fixed-rate quote</Text>
                  <Text style={s.meta}>
                    Quoted at {formatPhp(
                      selected.quoted_service_rate ?? selected.estimated_service_total ?? selected.package_price ?? 0
                    )} — no inspection or quotation required.
                  </Text>
                </View>
              ) : (
                <View style={s.actionBlock}>
                  <Text style={s.blockTitle}>2. Quotation, labor & billing</Text>
                  <ServiceQuotationPanel
                    booking={selected}
                    isDarkMode={isDarkMode}
                    onToast={toast}
                    onUpdated={async () => {
                      await refresh();
                    }}
                  />
                </View>
              )}

              {/* Pickup */}
              <View style={s.actionBlock}>
                <Text style={s.blockTitle}>3. Pickup verification</Text>
                <TouchableOpacity
                  style={s.secondaryBtn}
                  onPress={() => setShowPickup((v) => !v)}
                >
                  <Text style={s.secondaryBtnText}>
                    {showPickup ? 'Hide pickup scanner' : 'Open pickup QR scanner'}
                  </Text>
                </TouchableOpacity>
                {showPickup && (
                  <PickupQrScannerPanel
                    isDarkMode={isDarkMode}
                    onToast={toast}
                    onCompleted={async () => {
                      await refresh();
                      setShowPickup(false);
                    }}
                  />
                )}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

function InfoRow({ s, label, value }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
}

function createStyles(t, isDark) {
  return StyleSheet.create({
    root: { flex: 1 },
    hero: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 12,
    },
    heroTitle: { fontSize: 20, fontWeight: '800', color: isDark ? t.textPrimary : '#0F172A' },
    heroSub: { fontSize: 13, color: isDark ? t.textMuted : '#64748B', marginTop: 2 },
    refreshBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: isDark ? t.accentBorder : '#EA580C',
      backgroundColor: isDark ? t.bgCard : '#FFFFFF',
    },
    refreshText: { color: isDark ? t.accentBrand : '#EA580C', fontWeight: '700', fontSize: 12 },
    pipelineScroll: { flexGrow: 0, marginBottom: 10 },
    pipeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: isDark ? t.chipBorder : '#E2E8F0',
      backgroundColor: isDark ? t.chipBg : '#FFFFFF',
      marginRight: 8,
    },
    pipeChipOn: isDark
      ? { backgroundColor: '#EA580C', borderColor: t.accentBorder }
      : { backgroundColor: '#EA580C', borderColor: '#EA580C' },
    pipeChipText: { fontSize: 12, fontWeight: '700', color: isDark ? t.chipText : '#475569' },
    pipeChipTextOn: { color: isDark ? t.textPrimary : '#FFFFFF' },
    badge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: isDark ? t.bgSub : '#F1F5F9',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
    },
    badgeText: { fontSize: 11, fontWeight: '800', color: isDark ? t.textSecondary : '#334155' },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: isDark ? t.inputBg : '#FFFFFF',
      borderWidth: 1,
      borderColor: isDark ? t.borderInput : '#E2E8F0',
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 12,
    },
    searchInput: { flex: 1, fontSize: 14, color: isDark ? t.textPrimary : '#0F172A', outlineStyle: 'none' },
    split: {
      flexDirection: 'row',
      gap: 14,
      minHeight: 560,
      alignItems: 'stretch',
    },
    listPane: {
      flex: 0.95,
      maxWidth: 420,
      minWidth: 300,
    },
    detailPane: {
      flex: 1.4,
      backgroundColor: isDark ? t.bgCard : '#FFFFFF',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isDark ? t.border : '#E2E8F0',
      padding: 14,
    },
    card: {
      backgroundColor: isDark ? t.bgCard : '#FFFFFF',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? t.border : '#E2E8F0',
      borderLeftWidth: 4,
      padding: 12,
      marginBottom: 10,
    },
    cardSelected: {
      borderColor: isDark ? t.accentBrand : '#EA580C',
      backgroundColor: isDark ? t.accentBg : '#FFF7ED',
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    ref: { fontSize: 12, fontWeight: '800', color: isDark ? t.accentBrand : '#EA580C' },
    statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    statusPillText: { fontSize: 10, fontWeight: '800' },
    customer: { fontSize: 15, fontWeight: '800', color: isDark ? t.textPrimary : '#0F172A', marginTop: 6 },
    meta: { fontSize: 12, color: isDark ? t.textMuted : '#64748B', marginTop: 2 },
    stageLine: { fontSize: 11, color: isDark ? t.accentBrand : '#EA580C', marginTop: 6, fontWeight: '600' },
    cardActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 9,
      paddingHorizontal: 12,
      borderRadius: 9,
      flex: 1,
    },
    primaryBtnText: { color: '#FFF', fontWeight: '800', fontSize: 12 },
    rejectBtn: {
      paddingVertical: 9,
      paddingHorizontal: 12,
      borderRadius: 9,
      backgroundColor: isDark ? t.statusDangerBg : '#FEF2F2',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(180, 120, 120, 0.28)' : '#FECACA',
    },
    rejectBtnText: { color: isDark ? t.statusDangerText : '#DC2626', fontWeight: '800', fontSize: 12 },
    empty: { padding: 32, alignItems: 'center' },
    emptyDetail: { padding: 40, alignItems: 'center' },
    emptyTitle: { fontSize: 15, fontWeight: '800', color: isDark ? t.textSecondary : '#475569', marginTop: 8 },
    emptySub: { fontSize: 12, color: isDark ? t.textMuted : '#94A3B8', marginTop: 4, textAlign: 'center' },
    detailHeader: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    detailRef: { fontSize: 13, fontWeight: '800', color: isDark ? t.accentBrand : '#EA580C' },
    detailCustomer: { fontSize: 18, fontWeight: '800', color: isDark ? t.textPrimary : '#0F172A' },
    legacyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDark ? t.accentBorder : '#C8DDD3',
      height: 36,
    },
    legacyBtnText: { fontSize: 12, fontWeight: '700', color: isDark ? t.accentBrand : '#EA580C' },
    infoGrid: {
      backgroundColor: isDark ? t.bgSub : '#F8FAFC',
      borderRadius: 10,
      padding: 10,
      marginBottom: 12,
      gap: 6,
    },
    infoRow: { gap: 2 },
    infoLabel: { fontSize: 10, fontWeight: '800', color: isDark ? t.textMuted : '#94A3B8', textTransform: 'uppercase' },
    infoValue: { fontSize: 13, color: isDark ? t.textPrimary : '#0F172A', fontWeight: '600' },
    actionBlock: {
      marginBottom: 14,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: isDark ? t.border : '#F1F5F9',
    },
    blockTitle: {
      fontSize: 12,
      fontWeight: '800',
      color: isDark ? t.accentBrand : '#EA580C',
      textTransform: 'uppercase',
      marginBottom: 8,
      letterSpacing: 0.3,
    },
    mechChip: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: isDark ? t.bgSub : '#F1F5F9',
      marginRight: 8,
    },
    mechChipOn: { backgroundColor: isDark ? '#EA580C' : '#EA580C' },
    mechChipText: { fontSize: 12, fontWeight: '700', color: isDark ? t.textSecondary : '#334155' },
    input: {
      borderWidth: 1,
      borderColor: isDark ? t.borderInput : '#E2E8F0',
      borderRadius: 8,
      padding: 10,
      marginBottom: 8,
      fontSize: 14,
      ...(isDark ? { color: t.textPrimary, backgroundColor: t.inputBg } : null),
    },
    secondaryBtn: {
      borderWidth: 1,
      borderColor: isDark ? t.accentBorder : '#EA580C',
      borderRadius: 9,
      paddingVertical: 10,
      alignItems: 'center',
      marginBottom: 8,
    },
    secondaryBtnText: { color: isDark ? t.accentBrand : '#EA580C', fontWeight: '700', fontSize: 13 },
  });
}
