/**
 * Organized Booking Details content for Admin Work Order modal.
 * Reuses ServiceQuotationPanel + PickupQrScannerPanel. Does not replace the modal shell.
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

function Section({ title, icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.sectionHeader} onPress={() => setOpen((v) => !v)} activeOpacity={0.8}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          {icon ? <BootstrapIcon name={icon} size={14} color="#1D4533" /> : null}
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        <BootstrapIcon name={open ? 'chevron-up' : 'chevron-down'} size={14} color="#64748B" />
      </TouchableOpacity>
      {open ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

function Row({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{String(value)}</Text>
    </View>
  );
}

const PLACEHOLDER_COLOR = '#94A3B8';

/** High-contrast field: always dark text on white so it stays readable in dark admin theme. */
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

function ActionBtn({ label, icon, onPress, disabled, danger, primary }) {
  return (
    <TouchableOpacity
      style={[
        styles.actionBtn,
        primary && styles.actionBtnPrimary,
        danger && styles.actionBtnDanger,
        disabled && styles.actionBtnDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      {icon ? (
        <BootstrapIcon name={icon} size={13} color={danger ? '#DC2626' : primary ? '#FFF' : '#1D4533'} />
      ) : null}
      <Text
        style={[
          styles.actionBtnText,
          primary && { color: '#FFF' },
          danger && { color: '#DC2626' },
          disabled && { color: '#94A3B8' },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
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
  const [busy, setBusy] = useState(false);
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
  const allowedNext = getAllowedNextStatuses(status);
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

  const assignMechanic = async ({ remove = false } = {}) => {
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
        const mech = selectedMech || activeMechanics[0];
        if (!mech) {
          toast('No active mechanic available');
          return;
        }
        await garageService.assignMechanicToBooking(id, mech, { schedule: true });
        setMechanicId(mech.id);
        toast(
          normalizeBookingStatus(booking.status) === FLEX_BOOKING_STATUS.APPROVED
            ? `Assigned ${mech.shortName || mech.name} • Status → Scheduled`
            : `Assigned ${mech.shortName || mech.name}`
        );
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
            ? `Service completed • Remaining ${formatPhp(fin.remaining)}`
            : 'Service completed • Ready for pickup'
        );
      } else if (next === FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS) {
        await garageService.startService(id);
        toast('Service started • Customer notified');
      } else {
        await garageService.updateBooking(id, {
          status: next,
          current_stage: statusLabel(next),
        });
        toast(`Status → ${statusLabel(next)}`);
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
      toast('Booking approved');
      await refresh();
    });
  };

  const reject = async () => {
    await withBusy(async () => {
      const id = booking.booking_id || booking.id;
      await garageService.rejectBooking(id, rejectReason || 'Declined by admin');
      toast('Booking rejected');
      await refresh();
    });
  };

  const reschedule = async () => {
    await withBusy(async () => {
      const id = booking.booking_id || booking.id;
      await garageService.rescheduleBooking(id, {
        preferredDate: rescheduleDate,
        preferredTime: rescheduleTime,
      });
      toast('Booking rescheduled');
      await refresh();
    });
  };

  const generateQr = async () => {
    await withBusy(async () => {
      const id = booking.booking_id || booking.id;
      const res = await serviceQuotationService.ensurePickupQr(id);
      if (!res.success) throw new Error(res.error || 'QR generation failed');
      toast(res.existing ? 'Pickup QR already exists' : 'Pickup QR generated');
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
      const current = normalizeBookingStatus(booking.status);
      if (
        current !== FLEX_BOOKING_STATUS.SCHEDULED &&
        current !== FLEX_BOOKING_STATUS.UNDER_INSPECTION
      ) {
        toast('Start inspection only after the mechanic is assigned (Scheduled).');
        return;
      }
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
      toast('Inspection saved');
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
      toast('Service progress updated');
      await refresh();
    });
  };

  if (!booking) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No booking selected</Text>
      </View>
    );
  }

  const quoteTotal = bookingQuotationTotal(booking);
  const payStatus = bookingPaymentStatus(booking);

  return (
    <View style={styles.wrap}>
      {/* Status + quick actions */}
      <View style={styles.statusBar}>
        <View style={[styles.statusPill, { backgroundColor: colors.bg }]}>
          <Text style={[styles.statusPillText, { color: colors.fg }]}>{statusLabel(status)}</Text>
        </View>
        <Text style={styles.payPill}>{payStatus}</Text>
        {busy ? <ActivityIndicator color="#1D4533" /> : null}
      </View>

      <View style={styles.quickActions}>
        {canAdminAction(status, 'approve') && (
          <ActionBtn label="Approve Booking" icon="check2-circle" primary onPress={approve} disabled={busy} />
        )}
        {canAdminAction(status, 'reject') && (
          <ActionBtn label="Reject Booking" icon="x-circle" danger onPress={reject} disabled={busy} />
        )}
        {canAdminAction(status, 'reschedule') && (
          <ActionBtn label="Reschedule" icon="calendar-event" onPress={reschedule} disabled={busy} />
        )}
        {canAdminAction(status, 'assign_mechanic') && (
          <ActionBtn label="Assign Mechanic" icon="person-plus" primary onPress={() => assignMechanic()} disabled={busy} />
        )}
        {canAdminAction(status, 'start_inspection') && (
          <ActionBtn
            label="Start Inspection"
            icon="search"
            onPress={() => setStatus(FLEX_BOOKING_STATUS.UNDER_INSPECTION)}
            disabled={busy}
          />
        )}
        {canAdminAction(status, 'start_service') && (
          <ActionBtn
            label="Start Service"
            icon="play-fill"
            primary
            onPress={() => setStatus(FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS)}
            disabled={busy}
          />
        )}
        {canAdminAction(status, 'complete_service') && (
          <ActionBtn
            label="Complete Service"
            icon="flag"
            onPress={() => setStatus(FLEX_BOOKING_STATUS.SERVICE_COMPLETED)}
            disabled={busy}
          />
        )}
        {canAdminAction(status, 'finalize_bill') && (
          <ActionBtn label="Finalize Bill" icon="receipt" onPress={finalizeBill} disabled={busy} />
        )}
        {canAdminAction(status, 'generate_qr') && (
          <ActionBtn label="Generate QR" icon="qr-code" primary onPress={generateQr} disabled={busy} />
        )}
      </View>

      {canAdminAction(status, 'reschedule') && (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <View style={{ flex: 1 }}>
            <ClearField
              label="Preferred date"
              placeholder="YYYY-MM-DD"
              value={rescheduleDate}
              onChangeText={setRescheduleDate}
            />
          </View>
          <View style={{ flex: 1 }}>
            <ClearField
              label="Preferred time"
              placeholder="e.g. 10:30 AM - 12:00 PM"
              value={rescheduleTime}
              onChangeText={setRescheduleTime}
            />
          </View>
        </View>
      )}

      {canAdminAction(status, 'reject') && (
        <View style={styles.rejectBox}>
          <ClearField
            label="Reject reason"
            placeholder="Optional reason shown to customer"
            value={rejectReason}
            onChangeText={setRejectReason}
          />
        </View>
      )}

      {/* Status is advanced only via diagram-gated quick actions above — no free-form chips */}
      <Section title="Booking Status" icon="signpost-2" defaultOpen={false}>
        <Text style={styles.hint}>
          Current: {statusLabel(status)}. Use the action buttons above to advance the workflow.
        </Text>
        {allowedNext.length > 0 ? (
          <Text style={[styles.hint, { marginTop: 6 }]}>
            Next allowed: {allowedNext.map((s) => statusLabel(s)).join(', ')}
          </Text>
        ) : (
          <Text style={[styles.hint, { marginTop: 6 }]}>Terminal status — no further transitions.</Text>
        )}
      </Section>

      <Section title="Booking Information" icon="bookmark" defaultOpen>
        <Row label="Booking ID" value={booking.booking_id || booking.id} />
        <Row label="Created" value={booking.created_at || booking.createdAt} />
        <Row
          label="Preferred date"
          value={booking.preferred_date || booking.appointment_date || booking.date}
        />
        <Row
          label="Preferred time"
          value={booking.preferred_time || booking.time_slot || booking.time}
        />
        <Row label="Service type" value={booking.service_type || booking.category || booking.service_title} />
        <Row label="Priority" value={booking.priority || 'Normal'} />
        <Row label="Status" value={statusLabel(status)} />
        <Row label="Quotation total" value={quoteTotal > 0 ? formatPhp(quoteTotal) : '—'} />
        <Row label="Payment status" value={payStatus} />
        {booking.info_request_notes ? (
          <Row label="Info requested" value={booking.info_request_notes} />
        ) : null}
      </Section>

      <Section title="Customer Information" icon="person" defaultOpen>
        <Row label="Name" value={booking.customer_name || booking.userName} />
        <Row label="Phone" value={booking.customer_phone || booking.userPhone} />
        <Row label="Email" value={booking.customer_email || booking.userEmail} />
        <Row label="Address" value={booking.customer_address || booking.address} />
      </Section>

      <Section title="Motorcycle Information" icon="bicycle" defaultOpen>
        <Row label="Brand" value={booking.bike_brand || booking.bikeBrand} />
        <Row label="Model" value={booking.bike_model || booking.bikeModel} />
        <Row label="Year" value={booking.bike_year || booking.year} />
        <Row label="Plate" value={booking.plate_number || booking.bikePlate || booking.bike_plate} />
        <Row label="Color" value={booking.bike_color || booking.color} />
        <Row label="Mileage" value={booking.odometer || booking.bikeOdo || booking.bike_odo} />
      </Section>

      <Section title="Customer Request" icon="chat-left-text" defaultOpen>
        <Row label="Requested service" value={booking.service_title || booking.package_name || booking.category} />
        <Row label="Problem" value={booking.problem_description || booking.repair_type} />
        <Row label="Notes" value={booking.notes} />
        {media.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            {media.map((url, i) => (
              <Image
                key={`${url}-${i}`}
                source={{ uri: getOptimizedImageUrl(url, { width: 160, quality: 60 }) }}
                style={styles.thumb}
              />
            ))}
          </ScrollView>
        )}
      </Section>

      <Section title="Mechanic Assignment" icon="person-badge" defaultOpen>
        <Text style={styles.hint}>No mechanic login — Admin assigns internally. Rate is snapshotted on quotation.</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
          {activeMechanics.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[styles.mechChip, mechanicId === m.id && styles.mechChipOn]}
              onPress={() => setMechanicId(m.id)}
            >
              <Text style={[styles.mechChipText, mechanicId === m.id && { color: '#FFF' }]}>
                {m.shortName || m.name} · {formatPhp(m.hourlyRate ?? m.hourly_rate ?? 150)}/hr
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Row label="Current mechanic" value={booking.mechanic || 'Unassigned'} />
        <Row
          label="Assignment date"
          value={booking.mechanic_assigned_at || booking.assigned_at || '—'}
        />
        <Row
          label="Assignment status"
          value={
            booking.mechanic_assignment_status ||
            (booking.mechanic_id || (booking.mechanic && !String(booking.mechanic).toLowerCase().includes('pending'))
              ? 'assigned'
              : 'unassigned')
          }
        />
        <Row
          label="Current hourly rate (roster)"
          value={
            selectedMech
              ? formatPhp(selectedMech.hourlyRate ?? selectedMech.hourly_rate)
              : booking.quoted_hourly_rate
                ? `${formatPhp(booking.quoted_hourly_rate)} (quoted snapshot)`
                : '—'
          }
        />
        <View style={styles.quickActions}>
          {canAdminAction(status, 'assign_mechanic') ? (
            <>
              <ActionBtn label="Assign Mechanic" icon="person-plus" primary onPress={() => assignMechanic()} disabled={busy} />
              <ActionBtn label="Change / Update" icon="arrow-repeat" onPress={() => assignMechanic()} disabled={busy} />
              <ActionBtn label="Remove Mechanic" icon="person-dash" danger onPress={() => assignMechanic({ remove: true })} disabled={busy} />
            </>
          ) : (
            <Text style={styles.hint}>
              Mechanic assignment is available at Approved or Scheduled.
            </Text>
          )}
        </View>
      </Section>

      <Section
        title="Inspection"
        icon="search"
        defaultOpen={
          normalized === FLEX_BOOKING_STATUS.UNDER_INSPECTION ||
          normalized === FLEX_BOOKING_STATUS.SCHEDULED
        }
      >
        <Row label="Inspection date" value={booking.inspection_started_at || booking.inspected_at} />
        <Row label="Assigned mechanic" value={booking.mechanic} />
        {normalized === FLEX_BOOKING_STATUS.APPROVED ? (
          <Text style={styles.hint}>Assign a mechanic first — inspection unlocks at Scheduled.</Text>
        ) : (
          <>
            <ClearField
              label="Motorcycle condition"
              placeholder="e.g. Fair / forks leaking / battery weak"
              value={insp.condition}
              onChangeText={(t) => setInsp((p) => ({ ...p, condition: t }))}
            />
            <ClearField
              label="Problems found"
              placeholder="Describe issues discovered during inspection"
              value={insp.findings}
              onChangeText={(t) => setInsp((p) => ({ ...p, findings: t }))}
              multiline
            />
            <ClearField
              label="Recommended repair"
              placeholder="Recommended repair work"
              value={insp.recommended}
              onChangeText={(t) => setInsp((p) => ({ ...p, recommended: t }))}
            />
            <ClearField
              label="Recommended parts"
              placeholder="Parts needed from inventory"
              value={insp.recommendedParts}
              onChangeText={(t) => setInsp((p) => ({ ...p, recommendedParts: t }))}
            />
            <ClearField
              label="Estimated labor hours"
              placeholder="e.g. 3 or 1.5"
              value={insp.estimatedHours}
              onChangeText={(t) => setInsp((p) => ({ ...p, estimatedHours: t }))}
              keyboardType="decimal-pad"
            />
            <ClearField
              label="Inspection notes"
              placeholder="Additional inspection notes"
              value={insp.notes}
              onChangeText={(t) => setInsp((p) => ({ ...p, notes: t }))}
            />
            {(canAdminAction(status, 'save_inspection') ||
              normalized === FLEX_BOOKING_STATUS.UNDER_INSPECTION ||
              normalized === FLEX_BOOKING_STATUS.SCHEDULED) && (
              <ActionBtn
                label="Save Inspection"
                icon="clipboard-check"
                primary
                onPress={saveInspection}
                disabled={busy}
              />
            )}
          </>
        )}
      </Section>

      <Section title="Labor · Parts · Other Charges · Quotation · Downpayment" icon="receipt" defaultOpen>
        <ServiceQuotationPanel
          booking={booking}
          onToast={toast}
          onUpdated={async () => {
            await refresh();
          }}
        />
      </Section>

      <Section
        title="Service Progress"
        icon="tools"
        defaultOpen={normalized === FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS}
      >
        <Row label="Service start" value={booking.service_started_at} />
        <Row label="Assigned mechanic" value={booking.mechanic} />
        <Row
          label="Estimated labor"
          value={
            booking.estimated_labor_hours != null
              ? `${booking.estimated_labor_hours} hrs · ${formatPhp(booking.estimated_labor_cost || 0)}`
              : '—'
          }
        />
        <ClearField
          label="Actual labor hours"
          placeholder="Does not overwrite estimate"
          value={actualHours}
          onChangeText={setActualHours}
          keyboardType="decimal-pad"
        />
        <ClearField
          label="Parts used / work performed"
          placeholder="Parts installed, work done, service notes"
          value={progressNotes}
          onChangeText={setProgressNotes}
          multiline
        />
        {canAdminAction(status, 'update_progress') && (
          <ActionBtn label="Update Service Progress" icon="save" primary onPress={saveProgress} disabled={busy} />
        )}
      </Section>

      <Section title="Final Bill & Payments" icon="cash-coin" defaultOpen={false}>
        <Row label="Estimated total" value={formatPhp(booking.estimated_service_total || 0)} />
        <Row label="Final service total" value={formatPhp(booking.final_service_total || quoteTotal)} />
        <Row label="Downpayment / amount paid" value={formatPhp(booking.amount_paid || booking.downpayment_amount || 0)} />
        <Row label="Remaining balance" value={formatPhp(booking.remaining_balance || 0)} />
        <Row label="Payment status" value={payStatus} />
        <Text style={styles.hint}>
          Customer pays via existing GCash flow. Admin finalize/send actions are in the Quotation section above.
        </Text>
      </Section>

      <Section title="Pickup / QR Verification" icon="qr-code" defaultOpen={normalized === FLEX_BOOKING_STATUS.READY_FOR_PICKUP}>
        <Row label="Pickup QR" value={booking.pickup_qr_token || 'Not generated yet'} />
        <Row label="Released at" value={booking.pickup_verified_at || booking.released_at} />
        <Row label="Released by" value={booking.pickup_released_by} />
        {canAdminAction(status, 'generate_qr') && !booking.pickup_qr_token ? (
          <ActionBtn label="Generate QR" icon="qr-code" primary onPress={generateQr} disabled={busy} />
        ) : null}
        <PickupQrScannerPanel
          onToast={toast}
          onCompleted={async () => {
            await refresh();
          }}
        />
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  empty: { padding: 24, alignItems: 'center' },
  emptyText: { color: '#94A3B8' },
  statusBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusPillText: { fontSize: 12, fontWeight: '800' },
  payPill: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#1D4533',
    backgroundColor: '#FFFFFF',
  },
  actionBtnPrimary: { backgroundColor: '#1D4533', borderColor: '#1D4533' },
  actionBtnDanger: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { fontSize: 12, fontWeight: '800', color: '#1D4533' },
  rejectBox: { marginBottom: 8 },
  fieldWrap: { marginBottom: 10 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 5,
    letterSpacing: 0.2,
  },
  section: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
  },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  sectionBody: { padding: 12, gap: 6 },
  row: { marginBottom: 4 },
  rowLabel: { fontSize: 10, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase' },
  rowValue: { fontSize: 13, color: '#0F172A', fontWeight: '600' },
  hint: { fontSize: 11, color: '#94A3B8', marginBottom: 4 },
  input: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
    // Web: prevent inherited dark-theme text from making value invisible
    outlineStyle: 'none',
  },
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
    paddingTop: 11,
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1.5,
    marginRight: 8,
    backgroundColor: '#FFF',
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
  thumb: { width: 88, height: 88, borderRadius: 8, marginRight: 8, backgroundColor: '#E2E8F0' },
});
