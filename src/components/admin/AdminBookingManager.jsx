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
import ServiceQuotationPanel from './ServiceQuotationPanel';
import PickupQrScannerPanel from './PickupQrScannerPanel';
import { garageService } from '../../services/garageService';
import {
  FLEX_BOOKING_STATUS,
  normalizeBookingStatus,
  formatPhp,
} from '../../utils/serviceQuotation';

/** Workflow stages for admin (grouped, actionable) */
export const BOOKING_PIPELINE = [
  {
    id: 'review',
    label: 'Needs Review',
    icon: 'inbox',
    color: '#D97706',
    bg: '#FEF3C7',
    statuses: [FLEX_BOOKING_STATUS.PENDING_REVIEW, 'Pending'],
    nextHint: 'Approve or reject',
  },
  {
    id: 'inspect',
    label: 'Inspect & Quote',
    icon: 'search',
    color: '#7C3AED',
    bg: '#EDE9FE',
    statuses: [
      FLEX_BOOKING_STATUS.APPROVED,
      FLEX_BOOKING_STATUS.SCHEDULED,
      FLEX_BOOKING_STATUS.UNDER_INSPECTION,
      'Confirmed',
      'Inspection',
    ],
    nextHint: 'Inspect → build quotation',
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
      FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT,
      FLEX_BOOKING_STATUS.ADDITIONAL_APPROVAL_REQUIRED,
      'Estimate Pending',
    ],
    nextHint: 'Customer action pending',
  },
  {
    id: 'service',
    label: 'In Service',
    icon: 'tools',
    color: '#1D4533',
    bg: '#C8DDD3',
    statuses: [
      FLEX_BOOKING_STATUS.CONFIRMED,
      FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS,
      'In Progress',
    ],
    nextHint: 'Track work / actual hours',
  },
  {
    id: 'billing',
    label: 'Billing & Pickup',
    icon: 'cash-coin',
    color: '#059669',
    bg: '#D1FAE5',
    statuses: [
      FLEX_BOOKING_STATUS.SERVICE_COMPLETED,
      FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT,
      FLEX_BOOKING_STATUS.READY_FOR_PICKUP,
      'Service Done',
      'Paid',
    ],
    nextHint: 'Finalize / verify pickup',
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
      'Closed',
      'Completed',
      'Cancelled',
      'Rejected',
    ],
    nextHint: 'Closed archive',
  },
];

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

function primaryAction(booking) {
  const s = normalizeBookingStatus(booking?.status);
  const raw = String(booking?.status || '');
  if (s === FLEX_BOOKING_STATUS.PENDING_REVIEW || raw === 'Pending') {
    return { id: 'approve', label: 'Review & Approve', icon: 'check2-circle' };
  }
  if (s === FLEX_BOOKING_STATUS.APPROVED) {
    return { id: 'assign', label: 'Assign Mechanic', icon: 'person-plus' };
  }
  if (s === FLEX_BOOKING_STATUS.SCHEDULED) {
    return { id: 'inspect', label: 'Start Inspection', icon: 'search' };
  }
  if (s === FLEX_BOOKING_STATUS.UNDER_INSPECTION || raw === 'Inspection') {
    return { id: 'quote', label: 'Build Quotation', icon: 'receipt' };
  }
  if (
    s === FLEX_BOOKING_STATUS.QUOTATION_SENT ||
    s === FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL ||
    s === FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT
  ) {
    return { id: 'open', label: 'Waiting Customer', icon: 'hourglass-split' };
  }
  if (s === FLEX_BOOKING_STATUS.CONFIRMED || raw === 'Confirmed') {
    return { id: 'start', label: 'Start Service', icon: 'play-fill' };
  }
  if (s === FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS || raw === 'In Progress') {
    return { id: 'complete', label: 'Complete Service', icon: 'flag' };
  }
  if (s === FLEX_BOOKING_STATUS.ADDITIONAL_APPROVAL_REQUIRED) {
    return { id: 'open', label: 'Waiting Extra Approval', icon: 'exclamation-triangle' };
  }
  if (
    s === FLEX_BOOKING_STATUS.SERVICE_COMPLETED ||
    s === FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT ||
    raw === 'Service Done'
  ) {
    return { id: 'finalize', label: 'Finalize Billing', icon: 'cash-stack' };
  }
  if (s === FLEX_BOOKING_STATUS.READY_FOR_PICKUP || raw === 'Paid') {
    return { id: 'pickup', label: 'Verify Pickup QR', icon: 'qr-code' };
  }
  return { id: 'open', label: 'Open Details', icon: 'eye-fill' };
}

export default function AdminBookingManager({
  bookings = [],
  mechanics = [],
  onRefresh,
  onToast,
  onOpenLegacyModal,
  styles: parentStyles,
}) {
  const [pipelineFilter, setPipelineFilter] = useState('review');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [mechanicPick, setMechanicPick] = useState('');
  const [showPickup, setShowPickup] = useState(false);

  const toast = (m) => onToast?.(m);

  const counts = useMemo(() => {
    const map = { all: bookings.length };
    BOOKING_PIPELINE.forEach((stage) => {
      map[stage.id] = bookings.filter((b) => stageForBooking(b).id === stage.id).length;
    });
    return map;
  }, [bookings]);

  const attentionCount = (counts.review || 0) + (counts.inspect || 0) + (counts.billing || 0);

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
          b.mechanic,
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

  const activeMechanics = useMemo(
    () => (mechanics || []).filter((m) => m.isActive !== false && m.is_active !== false),
    [mechanics]
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
        await garageService.approveBooking(id, 'Pending Assignment', {
          flexible: true,
          mechanicId: null,
          approvedBy: 'admin',
        });
        toast(`Approved #${id} — assign a mechanic next`);
        setSelectedId(id);
      } else if (actionId === 'reject') {
        setRejectOpen(true);
        setSelectedId(id);
        return;
      } else if (actionId === 'assign') {
        const mech =
          activeMechanics.find((m) => m.id === mechanicPick) ||
          activeMechanics[0];
        if (!mech) {
          toast('No active mechanic available — open details to assign');
          setSelectedId(id);
          return;
        }
        await garageService.assignMechanicToBooking(id, mech, { schedule: true });
        toast(`Assigned ${mech.shortName || mech.name} • Status → Scheduled`);
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
      } else if (
        actionId === 'complete' ||
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
    setBusyId(selectedId);
    try {
      await garageService.rejectBooking(selectedId, rejectReason || 'Declined by advisor');
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
              : 'Queue is clear — no urgent actions'}
          </Text>
        </View>
        <TouchableOpacity style={s.refreshBtn} onPress={refresh} activeOpacity={0.85}>
          <BootstrapIcon name="arrow-clockwise" size={14} color="#1D4533" />
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
        {BOOKING_PIPELINE.map((stage) => {
          const on = pipelineFilter === stage.id;
          const n = counts[stage.id] || 0;
          return (
            <TouchableOpacity
              key={stage.id}
              style={[
                s.pipeChip,
                { borderColor: stage.color },
                on && { backgroundColor: stage.color },
                n > 0 && stage.id !== 'done' && !on && { backgroundColor: stage.bg },
              ]}
              onPress={() => setPipelineFilter(stage.id)}
            >
              <BootstrapIcon name={stage.icon} size={12} color={on ? '#FFF' : stage.color} />
              <Text style={[s.pipeChipText, { color: on ? '#FFF' : stage.color }]}>
                {stage.label}
              </Text>
              <View style={[s.badge, on && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                <Text style={[s.badgeText, on && { color: '#FFF' }]}>{n}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Search */}
      <View style={s.searchRow}>
        <BootstrapIcon name="search" size={14} color="#64748B" />
        <TextInput
          style={s.searchInput}
          placeholder="Search booking ID, customer, plate, bike…"
          placeholderTextColor="#94A3B8"
          value={search}
          onChangeText={setSearch}
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <BootstrapIcon name="x-circle" size={14} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      <View style={s.split}>
        {/* List */}
        <ScrollView style={s.listPane} contentContainerStyle={{ paddingBottom: 40 }}>
          {filtered.length === 0 ? (
            <View style={s.empty}>
              <BootstrapIcon name="calendar-x" size={28} color="#94A3B8" />
              <Text style={s.emptyTitle}>No bookings in this stage</Text>
              <Text style={s.emptySub}>Try another pipeline filter or clear search.</Text>
            </View>
          ) : (
            filtered.map((b) => {
              const id = b.booking_id || b.id;
              const stage = stageForBooking(b);
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
                    · {b.plate_number || b.bikePlate || '—'}
                  </Text>
                  <Text style={s.meta} numberOfLines={1}>
                    {b.appointment_date || b.preferred_date || b.date || '—'} ·{' '}
                    {b.time_slot || b.preferred_time || b.time || '—'}
                  </Text>
                  {b.current_stage ? (
                    <Text style={s.stageLine} numberOfLines={2}>
                      {b.current_stage}
                    </Text>
                  ) : null}
                  <View style={s.cardActions}>
                    <TouchableOpacity
                      style={[s.primaryBtn, { backgroundColor: stage.color }]}
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
              <BootstrapIcon name="grid-1x2-fill" size={32} color="#CBD5E1" />
              <Text style={s.emptyTitle}>Select a booking</Text>
              <Text style={s.emptySub}>
                Choose a card on the left to review, assign a mechanic, build a quotation, or verify pickup.
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
                    {statusLabel(selected.status)} · {stageForBooking(selected).nextHint}
                  </Text>
                </View>
                {onOpenLegacyModal && (
                  <TouchableOpacity
                    style={s.legacyBtn}
                    onPress={() => onOpenLegacyModal(selected)}
                  >
                    <BootstrapIcon name="pencil-square" size={13} color="#1D4533" />
                    <Text style={s.legacyBtnText}>Full form</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={s.infoGrid}>
                <InfoRow
                  label="Motorcycle"
                  value={`${selected.bike_brand || selected.bikeBrand || ''} ${selected.bike_model || selected.bikeModel || ''}`.trim() || '—'}
                />
                <InfoRow label="Plate" value={selected.plate_number || selected.bikePlate || '—'} />
                <InfoRow
                  label="Schedule"
                  value={`${selected.appointment_date || selected.preferred_date || selected.date || '—'} · ${selected.time_slot || selected.preferred_time || selected.time || '—'}`}
                />
                <InfoRow label="Phone" value={selected.customer_phone || selected.userPhone || '—'} />
                <InfoRow label="Service" value={selected.service_title || selected.serviceName || selected.category || '—'} />
                <InfoRow label="Mechanic" value={selected.mechanic || 'Unassigned'} />
                {(selected.estimated_service_total > 0 || selected.final_service_total > 0) && (
                  <InfoRow
                    label="Quoted / Final"
                    value={`${formatPhp(selected.estimated_service_total || 0)} / ${formatPhp(selected.final_service_total || selected.estimated_service_total || 0)}`}
                  />
                )}
                {selected.problem_description || selected.notes ? (
                  <InfoRow
                    label="Problem / Notes"
                    value={selected.problem_description || selected.notes}
                  />
                ) : null}
              </View>

              {/* Approve block for pending */}
              {(normalizeBookingStatus(selected.status) === FLEX_BOOKING_STATUS.PENDING_REVIEW ||
                selected.status === 'Pending') && (
                <View style={s.actionBlock}>
                  <Text style={s.blockTitle}>1. Assign mechanic & approve</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {activeMechanics.map((m) => (
                      <TouchableOpacity
                        key={m.id}
                        style={[
                          s.mechChip,
                          mechanicPick === m.id && s.mechChipOn,
                        ]}
                        onPress={() => setMechanicPick(m.id)}
                      >
                        <Text
                          style={[
                            s.mechChipText,
                            mechanicPick === m.id && { color: '#FFF' },
                          ]}
                        >
                          {m.shortName || m.name} · {formatPhp(m.hourlyRate ?? m.hourly_rate ?? 150)}/hr
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <TouchableOpacity
                      style={[s.primaryBtn, { flex: 1, backgroundColor: '#1D4533' }]}
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
                    placeholder="Schedule conflict, incomplete info…"
                  />
                  <TouchableOpacity style={[s.primaryBtn, { backgroundColor: '#DC2626' }]} onPress={confirmReject}>
                    <Text style={s.primaryBtnText}>Confirm Reject</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Quotation / billing */}
              <View style={s.actionBlock}>
                <Text style={s.blockTitle}>2. Quotation, labor & billing</Text>
                <ServiceQuotationPanel
                  booking={selected}
                  onToast={toast}
                  onUpdated={async () => {
                    await refresh();
                  }}
                />
              </View>

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

function InfoRow({ label, value }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  heroTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  heroSub: { fontSize: 13, color: '#64748B', marginTop: 2 },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1D4533',
    backgroundColor: '#FFFFFF',
  },
  refreshText: { color: '#1D4533', fontWeight: '700', fontSize: 12 },
  pipelineScroll: { flexGrow: 0, marginBottom: 10 },
  pipeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    marginRight: 8,
  },
  pipeChipOn: { backgroundColor: '#1D4533', borderColor: '#1D4533' },
  pipeChipText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  pipeChipTextOn: { color: '#FFFFFF' },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { fontSize: 11, fontWeight: '800', color: '#334155' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#0F172A', outlineStyle: 'none' },
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
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4,
    padding: 12,
    marginBottom: 10,
  },
  cardSelected: {
    borderColor: '#1D4533',
    backgroundColor: '#F0FDFA',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ref: { fontSize: 12, fontWeight: '800', color: '#1D4533' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusPillText: { fontSize: 10, fontWeight: '800' },
  customer: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginTop: 6 },
  meta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  stageLine: { fontSize: 11, color: '#1D4533', marginTop: 6, fontWeight: '600' },
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
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  rejectBtnText: { color: '#DC2626', fontWeight: '800', fontSize: 12 },
  empty: { padding: 32, alignItems: 'center' },
  emptyDetail: { padding: 40, alignItems: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: '#475569', marginTop: 8 },
  emptySub: { fontSize: 12, color: '#94A3B8', marginTop: 4, textAlign: 'center' },
  detailHeader: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  detailRef: { fontSize: 13, fontWeight: '800', color: '#1D4533' },
  detailCustomer: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  legacyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C8DDD3',
    height: 36,
  },
  legacyBtnText: { fontSize: 12, fontWeight: '700', color: '#1D4533' },
  infoGrid: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    gap: 6,
  },
  infoRow: { gap: 2 },
  infoLabel: { fontSize: 10, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase' },
  infoValue: { fontSize: 13, color: '#0F172A', fontWeight: '600' },
  actionBlock: {
    marginBottom: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  blockTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1D4533',
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  mechChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  mechChipOn: { backgroundColor: '#1D4533' },
  mechChipText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    fontSize: 14,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#1D4533',
    borderRadius: 9,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  secondaryBtnText: { color: '#1D4533', fontWeight: '700', fontSize: 13 },
});
