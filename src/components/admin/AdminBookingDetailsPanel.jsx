/**
 * Organized, high-readability Booking Details & Work Order Command Center for Admin Modal.
 * Structured with modern overview cards, contextual action bar, and segmented tabs.
 */
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { BootstrapIcon } from '../common';
import ServiceQuotationPanel from './ServiceQuotationPanel';
import PickupQrScannerPanel from './PickupQrScannerPanel';
import { garageService } from '../../services/garageService';
import { serviceQuotationService } from '../../services/serviceQuotationService';
import { getOptimizedImageUrl } from '../../utils/imageUrl';
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
} from '../../utils/bookingWorkflow';

function formatDateTime(val) {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return (
      d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }) +
      ' · ' +
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
  if (!val) return '—';
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

const PLACEHOLDER_COLOR = '#94A3B8';

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
  return (
    <View style={styles.fieldWrap}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline, style]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={PLACEHOLDER_COLOR}
        multiline={multiline}
        keyboardType={keyboardType}
        underlineColorAndroid="transparent"
        selectionColor="#1D4533"
        {...rest}
      />
    </View>
  );
}

function ActionBtn({ label, icon, onPress, disabled, danger, primary, outline }) {
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
          color={danger ? '#DC2626' : primary ? '#FFFFFF' : '#1D4533'}
        />
      ) : null}
      <Text
        style={[
          styles.actionBtnText,
          primary && { color: '#FFFFFF' },
          danger && { color: '#DC2626' },
          disabled && { color: '#94A3B8' },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function InfoItem({ icon, label, value, highlight, badge }) {
  if (!value && value !== 0) return null;
  return (
    <View style={styles.infoItem}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {icon ? <BootstrapIcon name={icon} size={13} color="#64748B" /> : null}
        <Text style={styles.infoItemLabel}>{label}</Text>
      </View>
      {badge ? (
        <View style={styles.itemBadge}>{value}</View>
      ) : (
        <Text
          style={[styles.infoItemValue, highlight && { color: '#1D4533', fontWeight: '800' }]}
          numberOfLines={2}
        >
          {String(value)}
        </Text>
      )}
    </View>
  );
}

function GridKvCell({ icon, label, value, highlight = false, badge = false }) {
  if (!value && value !== 0) return null;
  return (
    <View style={styles.gridKvCell}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 }}>
        {icon ? <BootstrapIcon name={icon} size={12} color="#64748B" /> : null}
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
            highlight && { color: '#1D4533', fontWeight: '800' },
          ]}
          numberOfLines={2}
        >
          {String(value)}
        </Text>
      )}
    </View>
  );
}

export default function AdminBookingDetailsPanel({
  booking,
  mechanics = [],
  onToast,
  onBookingUpdated,
  tokens = {},
  isDarkMode = false,
}) {
  const toast = (m) => onToast?.(m);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'mechanic' | 'quotation' | 'inspection'
  const [busy, setBusy] = useState(false);
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [showRescheduleBox, setShowRescheduleBox] = useState(false);

  const [mechanicId, setMechanicId] = useState(booking?.mechanic_id || '');
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
  const colors = statusColor(status);
  const media = useMemo(() => {
    const raw = booking?.media_urls || booking?.photos || [];
    return Array.isArray(raw) ? raw.filter(Boolean) : [];
  }, [booking]);

  const activeMechanics = useMemo(
    () => (mechanics || []).filter((m) => m.isActive !== false && m.is_active !== false),
    [mechanics]
  );
  const selectedMech = activeMechanics.find((m) => m.id === mechanicId);

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

  const assignMechanic = async ({ remove = false, mechOverride = null } = {}) => {
    await withBusy(async () => {
      const id = booking.booking_id || booking.id;
      if (remove) {
        await garageService.updateBooking(id, {
          mechanic: 'Pending Assignment',
          mechanic_id: null,
          mechanic_assigned_at: null,
          mechanic_assignment_status: 'unassigned',
          current_stage: 'Mechanic unassigned',
        });
        setMechanicId('');
        toast('Mechanic removed');
      } else {
        const mech = mechOverride || selectedMech || activeMechanics[0];
        if (!mech) {
          toast('No active mechanic available');
          return;
        }
        await garageService.assignMechanicToBooking(id, mech, {
          schedule: true,
          preferredDate: booking.preferred_date || booking.appointment_date,
          preferredTime: booking.preferred_time || booking.time_slot,
          startTime: booking.preferred_time || booking.time_slot || '09:00',
          estimatedDurationMinutes: booking.estimated_duration_minutes || 90,
          assignedBy: 'admin',
        });
        setMechanicId(mech.id);
        toast(`Assigned ${mech.shortName || mech.name} to bay`);
      }
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
            ? `Service completed • Remaining balance ${formatPhp(fin.remaining)}`
            : 'Service completed • Ready for pickup'
        );
      } else if (next === FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS) {
        await garageService.startService(id);
        toast('Service started in bay • Rider notified');
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
      const mech = selectedMech || activeMechanics.find((m) => m.id === booking.mechanic_id);
      await garageService.approveBooking(id, mech?.name || 'Pending Assignment', {
        flexible: true,
        mechanicId: mech?.id || null,
        approvedBy: 'admin',
      });
      toast('✓ Booking approved — downpayment required');
      await refresh();
    });
  };

  const reject = async () => {
    await withBusy(async () => {
      const id = booking.booking_id || booking.id;
      await garageService.rejectBooking(id, rejectReason || 'Declined by admin');
      setShowRejectBox(false);
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
      toast('✓ Appointment rescheduled');
      await refresh();
    });
  };

  const generateQr = async () => {
    await withBusy(async () => {
      const id = booking.booking_id || booking.id;
      const res = await serviceQuotationService.ensurePickupQr(id);
      if (!res.success) throw new Error(res.error || 'QR generation failed');
      toast(res.existing ? 'Pickup QR already generated' : '✓ Pickup QR generated');
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
          ? `Final bill ${formatPhp(fin.finalTotal)} • Remaining ${formatPhp(fin.remaining)}`
          : `Final bill ${formatPhp(fin.finalTotal)} • Ready for pickup`
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
        inspectedBy: selectedMech?.name || booking.mechanic || 'admin',
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
        mechanic: selectedMech?.name || booking.mechanic,
        mechanic_id: selectedMech?.id || booking.mechanic_id,
        status: FLEX_BOOKING_STATUS.UNDER_INSPECTION,
        current_stage: 'Inspection recorded',
      });
      toast('✓ Inspection details saved');
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
          hourlyRate: booking.quoted_hourly_rate || selectedMech?.hourly_rate || selectedMech?.hourlyRate,
        });
      }
      await garageService.updateBooking(id, patch);
      toast('✓ Service progress logged');
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
  const basePrice = Number(booking.pricePhp || 2500);
  const dpAmount = Number(
    booking.downpayment_amount !== undefined
      ? booking.downpayment_amount
      : Math.round(basePrice * 0.2)
  );
  const remainingBalance = Math.max(0, (booking.final_service_total || quoteTotal || basePrice) - (booking.downpayment_paid ? dpAmount : 0));

  return (
    <View style={styles.wrap}>
      {/* ─── 1. TOP STATUS & QUICK GLANCE BAR ─── */}
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
            <BootstrapIcon name="credit-card-2-front" size={11} color="#475569" />
            <Text style={styles.paymentPillText}>
              {quoteTotal > 0 ? formatPhp(quoteTotal) : formatPhp(basePrice)} · {payStatus}
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
                  ? '#166534'
                  : '#DC2626'
              }
            />
            <Text
              style={[
                styles.dpBadgeText,
                {
                  color:
                    booking.downpayment_status === 'Paid' || Number(booking.amount_paid || 0) > 0
                      ? '#166534'
                      : '#DC2626',
                },
              ]}
            >
              {booking.status === 'Cancelled' || normalized === FLEX_BOOKING_STATUS.CANCELLED
                ? 'DP Forfeited'
                : booking.downpayment_status === 'Paid' || Number(booking.amount_paid || 0) > 0
                  ? `DP ${formatPhp(dpAmount)} Paid (${booking.downpayment_method || 'cash'})`
                  : normalized === FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT
                    ? `DP ${formatPhp(dpAmount)} Required`
                    : `DP ${formatPhp(dpAmount)}`}
            </Text>
          </View>
        </View>

        {busy && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <ActivityIndicator size="small" color="#1D4533" />
            <Text style={{ fontSize: 11.5, color: '#64748B', fontWeight: '600' }}>Updating...</Text>
          </View>
        )}
      </View>

      {/* ─── 2. CONTEXTUAL ACTION TOOLBAR ─── */}
      <View style={styles.actionToolbar}>
        {canAdminAction(status, 'approve') && (
          <ActionBtn label="Approve Booking" icon="check2-circle" primary onPress={approve} disabled={busy} />
        )}

        {canAdminAction(status, 'reject') && (
          <ActionBtn
            label={showRejectBox ? 'Close Reject Form' : 'Reject Booking'}
            icon="x-circle"
            danger
            onPress={() => setShowRejectBox(!showRejectBox)}
            disabled={busy}
          />
        )}

        {canAdminAction(status, 'request_info') && (
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

        {canAdminAction(status, 'assign_mechanic') && (
          <ActionBtn
            label="Assign Mechanic"
            icon="person-plus"
            primary={!canAdminAction(status, 'approve')}
            outline={canAdminAction(status, 'approve')}
            onPress={() => {
              setActiveTab('mechanic');
            }}
            disabled={busy}
          />
        )}

        {canAdminAction(status, 'start_inspection') && (
          <ActionBtn
            label="Start Bay Inspection"
            icon="search"
            primary
            onPress={() => {
              setStatus(FLEX_BOOKING_STATUS.UNDER_INSPECTION);
              setActiveTab('inspection');
            }}
            disabled={busy}
          />
        )}

        {canAdminAction(status, 'start_service') && (
          <ActionBtn
            label="Start Service in Bay"
            icon="play-fill"
            primary
            onPress={() => {
              setStatus(FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS);
              setActiveTab('inspection');
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

      {/* Inline Reject Drawer (only shown when Reject is pressed) */}
      {showRejectBox && (
        <View style={styles.interactiveDrawer}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <BootstrapIcon name="shield-exclamation" size={14} color="#DC2626" />
            <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#DC2626' }}>
              Decline Booking & Notify Customer
            </Text>
          </View>
          <ClearField
            label="Rejection Reason"
            placeholder="e.g. Lift bays fully booked at 10 AM, please select an afternoon slot"
            value={rejectReason}
            onChangeText={setRejectReason}
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
              disabled={busy}
            />
          </View>
        </View>
      )}

      {/* Inline Reschedule Drawer (only shown when Reschedule is pressed) */}
      {showRescheduleBox && (
        <View style={styles.interactiveDrawer}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <BootstrapIcon name="calendar2-check" size={14} color="#1D4533" />
            <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#1D4533' }}>
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

      {/* ─── 3. ORGANIZED NAVIGATION TABS ─── */}
      <View style={styles.tabBar}>
        {[
          { id: 'overview', label: 'Overview & Profile', icon: 'person-vcard' },
          { id: 'mechanic', label: 'Technician & Bay', icon: 'wrench-adjustable' },
          { id: 'quotation', label: 'Quotation & Billing', icon: 'receipt' },
          { id: 'inspection', label: 'Inspection & Release', icon: 'clipboard2-check' },
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
                color={isSelected ? '#1D4533' : '#64748B'}
              />
              <Text style={[styles.tabButtonText, isSelected && styles.tabButtonTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ─── 4. TAB CONTENT ─── */}
      {/* TAB 1: OVERVIEW & PROFILE */}
      {activeTab === 'overview' && (
        <View style={styles.cardsGrid}>
          {/* Card 1: Customer Profile */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <BootstrapIcon name="person-fill" size={14} color="#1D4533" />
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
              <BootstrapIcon name="bicycle" size={14} color="#1D4533" />
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
                    value={booking.plate_number || booking.bikePlate || 'N/A–RJCX'}
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
                    icon="palette"
                    label="Color & Year"
                    value={`${booking.bike_color || booking.color || 'Standard'} • ${booking.bike_year || booking.year || '2024'}`}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Card 3: Appointment & Financials */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <BootstrapIcon name="calendar3" size={14} color="#1D4533" />
              <Text style={styles.cardTitle}>Appointment & Financials</Text>
            </View>
            <View style={styles.cardBody}>
              {/* Subgroup 1: Appointment */}
              <View style={styles.subGroupHeader}>
                <BootstrapIcon name="calendar-event" size={12} color="#1D4533" />
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
                    icon="person-gear"
                    label="Assigned Technician"
                    value={booking.mechanic && !String(booking.mechanic).toLowerCase().includes('pending') ? booking.mechanic : 'Master Tech Jayson'}
                  />
                  <GridKvCell
                    icon="segmented-nav"
                    label="Pit Bay"
                    value={booking.bay_name || booking.pit_bay || 'Bay 1'}
                  />
                </View>
              </View>

              {/* Subgroup 2: Financials */}
              <View style={[styles.subGroupHeader, { marginTop: 14 }]}>
                <BootstrapIcon name="cash-stack" size={12} color="#1D4533" />
                <Text style={styles.subGroupTitle}>Financial Information</Text>
              </View>
              <View style={styles.twoColumnGrid}>
                <View style={styles.gridColumn}>
                  <GridKvCell
                    icon="cash-coin"
                    label="Service Amount"
                    value={`₱${basePrice.toLocaleString()}`}
                    highlight
                  />
                  <GridKvCell
                    icon="shield-check"
                    label="Down Payment"
                    value={`₱${dpAmount.toLocaleString()} (Paid via ${booking.downpayment_method || 'GCash'})`}
                  />
                  <GridKvCell
                    icon="wallet2"
                    label="Remaining Balance"
                    value={`₱${remainingBalance.toLocaleString()}`}
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
              <BootstrapIcon name="chat-square-quote-fill" size={14} color="#1D4533" />
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
        </View>
      )}

      {/* TAB 2: MECHANIC & BAY */}
      {activeTab === 'mechanic' && (
        <View style={{ gap: 14 }}>
          {/* Current Technician Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <BootstrapIcon name="person-gear" size={14} color="#1D4533" />
              <Text style={styles.cardTitle}>Currently Assigned Technician</Text>
            </View>
            <View style={styles.cardBody}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={styles.avatarCircle}>
                    <BootstrapIcon name="wrench" size={16} color="#1D4533" />
                  </View>
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>
                      {booking.mechanic || 'Pending Assignment'}
                    </Text>
                    <Text style={{ fontSize: 11.5, color: '#64748B' }}>
                      {selectedMech
                        ? `${selectedMech.specialization} · ₱${Number(selectedMech.hourlyRate ?? selectedMech.hourly_rate ?? 150).toLocaleString()}/hr`
                        : 'No technician assigned to this lift bay yet'}
                    </Text>
                  </View>
                </View>
                {booking.mechanic && (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnDanger, { paddingVertical: 6, paddingHorizontal: 10 }]}
                    onPress={() => assignMechanic({ remove: true })}
                    disabled={busy}
                  >
                    <BootstrapIcon name="person-dash" size={12} color="#DC2626" />
                    <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#DC2626' }}>Unassign</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={{ flexDirection: 'row', gap: 16, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                <InfoItem
                  icon="calendar-event"
                  label="Assignment Timestamp"
                  value={formatDateTime(booking.mechanic_assigned_at || booking.assigned_at)}
                />
                <InfoItem
                  icon="check-circle"
                  label="Assignment Status"
                  value={booking.mechanic_id || booking.mechanic ? 'Assigned' : 'Unassigned'}
                />
              </View>
            </View>
          </View>

          {/* Active Mechanics Roster Selector */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <BootstrapIcon name="people-fill" size={14} color="#1D4533" />
              <Text style={styles.cardTitle}>Select from Technician Roster</Text>
            </View>
            <View style={styles.cardBody}>
              <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 10 }}>
                Choose a certified garage mechanic to assign or reassign to this work order:
              </Text>
              {activeMechanics.length === 0 ? (
                <View style={{ padding: 14, backgroundColor: '#F8FAFC', borderRadius: 8, alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, color: '#64748B' }}>
                    No certified mechanics registered yet. You can add mechanics in the Mechanics tab.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  {activeMechanics.map((m) => {
                    const isCurrent =
                      mechanicId === m.id ||
                      (booking.mechanic && booking.mechanic.toLowerCase().includes(m.name.toLowerCase()));
                    const rate = m.hourlyRate ?? m.hourly_rate ?? 150;
                    return (
                      <TouchableOpacity
                        key={m.id}
                        style={[
                          styles.rosterCard,
                          isCurrent && styles.rosterCardSelected,
                        ]}
                        onPress={() => {
                          setMechanicId(m.id);
                          assignMechanic({ mechOverride: m });
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View
                            style={[
                              styles.rosterAvatar,
                              isCurrent && { backgroundColor: '#1D4533' },
                            ]}
                          >
                            <BootstrapIcon
                              name="person-fill"
                              size={14}
                              color={isCurrent ? '#FFFFFF' : '#1D4533'}
                            />
                          </View>
                          <View>
                            <Text
                              style={[
                                styles.rosterName,
                                isCurrent && { color: '#1D4533', fontWeight: '800' },
                              ]}
                            >
                              {m.name}
                            </Text>
                            <Text style={styles.rosterSub}>
                              {m.specialization || 'Certified Tech'} · ₱{Number(rate).toLocaleString()}/hour
                            </Text>
                          </View>
                        </View>
                        {isCurrent ? (
                          <View style={styles.rosterAssignedPill}>
                            <BootstrapIcon name="check-circle-fill" size={12} color="#1D4533" />
                            <Text style={{ fontSize: 11, fontWeight: '800', color: '#1D4533' }}>Assigned</Text>
                          </View>
                        ) : (
                          <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#2563EB' }}>
                            Tap to Assign
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        </View>
      )}

      {/* TAB 3: QUOTATION & BILLING */}
      {activeTab === 'quotation' && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <BootstrapIcon name="receipt-cutoff" size={14} color="#1D4533" />
            <Text style={styles.cardTitle}>Detailed Quotation & Parts Itemization</Text>
          </View>
          <View style={[styles.cardBody, { padding: 8 }]}>
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
              <BootstrapIcon name="search" size={14} color="#1D4533" />
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
              <BootstrapIcon name="tools" size={14} color="#1D4533" />
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
              <BootstrapIcon name="qr-code-scan" size={14} color="#1D4533" />
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

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { color: '#94A3B8', fontSize: 13 },

  topStatusStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 8,
  },
  paymentPillText: { fontSize: 11.5, fontWeight: '700', color: '#334155' },
  dpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 8,
  },
  dpBadgePaid: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0' },
  dpBadgeCancelled: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
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
    borderColor: '#1D4533',
    backgroundColor: '#FFFFFF',
  },
  actionBtnPrimary: { backgroundColor: '#1D4533', borderColor: '#1D4533' },
  actionBtnDanger: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  actionBtnOutline: { borderColor: '#CBD5E1', backgroundColor: '#FFFFFF' },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { fontSize: 12, fontWeight: '800', color: '#1D4533' },

  interactiveDrawer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabButtonText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  tabButtonTextActive: { color: '#1D4533', fontWeight: '800' },

  cardsGrid: {
    gap: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cardTitle: { fontSize: 13.5, fontWeight: '800', color: '#0F172A', letterSpacing: -0.2 },
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
  },
  gridKvValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  subGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    marginTop: 4,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  subGroupTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardHeaderIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: '#E8F0EC',
    alignItems: 'center',
    justifyContent: 'center',
  },

  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoItemLabel: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  infoItemValue: { fontSize: 12.5, color: '#0F172A', fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  itemBadge: { alignItems: 'flex-end' },

  bikePlatePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  bikePlateText: { fontSize: 11, fontWeight: '800', color: '#0F172A' },

  quoteBlock: {
    marginTop: 4,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#1D4533',
  },
  quoteText: { fontSize: 12.5, color: '#334155', fontStyle: 'italic', lineHeight: 18 },

  thumb: { width: 88, height: 88, borderRadius: 8, backgroundColor: '#E2E8F0' },

  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FEF3C7',
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
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  rosterCardSelected: {
    borderColor: '#1D4533',
    backgroundColor: '#F0FDF4',
  },
  rosterAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rosterName: { fontSize: 12.5, fontWeight: '700', color: '#0F172A' },
  rosterSub: { fontSize: 11, color: '#64748B' },
  rosterAssignedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },

  fieldWrap: { marginBottom: 10 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
    outlineStyle: 'none',
  },
  inputMultiline: {
    minHeight: 65,
    textAlignVertical: 'top',
  },
});
