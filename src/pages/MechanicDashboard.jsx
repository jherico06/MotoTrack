/**
 * Mechanic Dashboard — assigned garage jobs only.
 * Mechanics inspect, estimate, record work, request extra work, and submit completion.
 * They cannot record payments, send customer quotations, or release motorcycles.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { BootstrapIcon } from '../components/common';
import { useAuth } from '../context/AuthContext';
import { mechanicBookingService } from '../services/mechanicBookingService.js';
import { serviceQuotationService } from '../services/serviceQuotationService.js';
import {
  FLEX_BOOKING_STATUS,
  normalizeBookingStatus,
  formatPhp,
  calcLaborCost,
} from '../utils/serviceQuotation.js';
import {
  statusLabel,
  statusColor,
  canMechanicAction,
} from '../utils/bookingWorkflow.js';

const FILTERS = [
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'inspection', label: 'In Inspection' },
  { id: 'estimate', label: 'Awaiting Estimate' },
  { id: 'service', label: 'In Service' },
  { id: 'completed', label: 'Completed' },
];

const INSPECTION_CHECKLIST = [
  { key: 'general', label: 'General condition' },
  { key: 'odometer', label: 'Odometer' },
  { key: 'brakes', label: 'Brakes' },
  { key: 'tires', label: 'Tires' },
  { key: 'engine', label: 'Engine' },
  { key: 'fluids', label: 'Fluids' },
  { key: 'battery', label: 'Battery' },
  { key: 'lights', label: 'Lights' },
];

const SERVICE_PROGRESS_STEPS = [
  { key: 'started', label: 'Service Started', min: 1 },
  { key: 'repair', label: 'Repair / Maintenance', min: 25 },
  { key: 'parts', label: 'Parts Installation', min: 50 },
  { key: 'qc', label: 'Quality Check', min: 75 },
  { key: 'done', label: 'Service Completed', min: 100 },
];

function isSameDay(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const t = new Date();
  return (
    d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate()
  );
}

export default function MechanicDashboard({ onLogout }) {
  const { currentUser } = useAuth();
  const [mechanic, setMechanic] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('today');
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [findings, setFindings] = useState('');
  const [recommended, setRecommended] = useState('');
  const [condition, setCondition] = useState('');
  const [safety, setSafety] = useState('');
  const [checklist, setChecklist] = useState({});
  const [odometerReading, setOdometerReading] = useState('');
  const [estHours, setEstHours] = useState('2');
  const [partsNote, setPartsNote] = useState('');
  const [partsCost, setPartsCost] = useState('0');
  const [otherCost, setOtherCost] = useState('0');
  const [progressPct, setProgressPct] = useState(25);
  const [actualHours, setActualHours] = useState('');
  const [serviceNotes, setServiceNotes] = useState('');
  const [addTitle, setAddTitle] = useState('');
  const [addHours, setAddHours] = useState('1');
  const [addParts, setAddParts] = useState('0');
  const [addDesc, setAddDesc] = useState('');

  const showToast = (m) => {
    setToast(m);
    setTimeout(() => setToast(''), 2800);
  };

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const userId = currentUser?.user_id || currentUser?.id;
      const mech = await mechanicBookingService.getMechanicForUser(userId, { force: true });
      setMechanic(mech);
      if (!mech?.id) {
        setBookings([]);
        return;
      }
      const list = await mechanicBookingService.listAssignedBookings(mech.id, { force: true });
      setBookings(Array.isArray(list) ? list : []);
    } catch (e) {
      showToast(e?.message || 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const now = Date.now();
    return bookings.filter((b) => {
      const s = normalizeBookingStatus(b.status);
      const start = b.appointment_start || b.preferred_date || b.appointment_date;
      if (filter === 'today') return isSameDay(start) || isSameDay(b.created_at);
      if (filter === 'upcoming') {
        const t = start ? new Date(start).getTime() : 0;
        return t >= now && s === FLEX_BOOKING_STATUS.SCHEDULED;
      }
      if (filter === 'inspection') return s === FLEX_BOOKING_STATUS.UNDER_INSPECTION;
      if (filter === 'estimate') {
        return s === FLEX_BOOKING_STATUS.UNDER_INSPECTION || s === FLEX_BOOKING_STATUS.SCHEDULED;
      }
      if (filter === 'service') {
        return (
          s === FLEX_BOOKING_STATUS.CONFIRMED ||
          s === FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS ||
          s === FLEX_BOOKING_STATUS.ADDITIONAL_APPROVAL_REQUIRED
        );
      }
      if (filter === 'completed') {
        return [
          FLEX_BOOKING_STATUS.SERVICE_COMPLETED,
          FLEX_BOOKING_STATUS.FOR_FINAL_BILLING,
          FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT,
          FLEX_BOOKING_STATUS.READY_FOR_PICKUP,
          FLEX_BOOKING_STATUS.COMPLETED,
        ].includes(s);
      }
      return true;
    });
  }, [bookings, filter]);

  const selected = useMemo(
    () => bookings.find((b) => (b.booking_id || b.id) === selectedId) || null,
    [bookings, selectedId]
  );

  const rate = Number(mechanic?.hourlyRate ?? mechanic?.hourly_rate ?? selected?.quoted_hourly_rate ?? 150);
  const estLabor = calcLaborCost(rate, Number(estHours || 0));

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
      await reload();
    } catch (e) {
      showToast(e?.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const startInspection = () =>
    run(async () => {
      const res = await mechanicBookingService.startInspection(
        selected.booking_id || selected.id,
        mechanic.id,
        { actorId: currentUser?.user_id || currentUser?.id }
      );
      if (!res.success) throw new Error(res.error);
      showToast('Inspection started');
    });

  const saveInspection = () =>
    run(async () => {
      const checklistSummary = INSPECTION_CHECKLIST.map((item) => {
        const v = checklist[item.key];
        if (item.key === 'odometer') {
          return `${item.label}: ${odometerReading || 'not recorded'}`;
        }
        return `${item.label}: ${v === 'ok' ? 'OK' : v === 'issue' ? 'Issue found' : 'Not checked'}`;
      }).join('\n');
      const res = await mechanicBookingService.saveInspection(
        selected.booking_id || selected.id,
        mechanic.id,
        {
          findings,
          recommendedWork: recommended,
          condition: condition || checklistSummary,
          safetyConcerns: safety,
          checklist,
          odometer: odometerReading,
          inspectionChecklist: checklistSummary,
        },
        { actorId: currentUser?.user_id || currentUser?.id }
      );
      if (!res.success) throw new Error(res.error);
      showToast('Inspection saved');
    });

  const submitEstimate = () =>
    run(async () => {
      const items = [];
      if (Number(partsCost) > 0) {
        items.push({
          item_type: 'part',
          product_name: partsNote || 'Recommended parts',
          quantity: 1,
          unit_price: Number(partsCost),
          description: partsNote,
        });
      }
      const res = await mechanicBookingService.submitEstimate(
        selected.booking_id || selected.id,
        mechanic.id,
        {
          estimatedLaborHours: Number(estHours || 0),
          hourlyRate: rate,
          otherChargesTotal: Number(otherCost || 0),
          items,
          notes: recommended || findings,
        },
        { actorId: currentUser?.user_id || currentUser?.id }
      );
      if (!res.success) throw new Error(res.error);
      showToast(`Estimate submitted • ${formatPhp(res.estimate?.total_amount)}`);
      setSelectedId(null);
    });

  const startService = () =>
    run(async () => {
      const res = await mechanicBookingService.startService(
        selected.booking_id || selected.id,
        mechanic.id,
        { actorId: currentUser?.user_id || currentUser?.id }
      );
      if (!res.success) throw new Error(res.error);
      showToast('Service started');
    });

  const saveProgress = () =>
    run(async () => {
      const res = await mechanicBookingService.recordWorkProgress(
        selected.booking_id || selected.id,
        mechanic.id,
        {
          actualLaborHours: actualHours ? Number(actualHours) : undefined,
          serviceNotes,
          progress: progressPct,
        },
        { actorId: currentUser?.user_id || currentUser?.id }
      );
      if (!res.success) throw new Error(res.error);
      showToast('Work progress saved');
    });

  const requestExtra = () =>
    run(async () => {
      if (!addTitle.trim()) throw new Error('Title required for additional work');
      const res = await mechanicBookingService.requestAdditionalWork(
        selected.booking_id || selected.id,
        mechanic.id,
        {
          title: addTitle,
          description: addDesc,
          laborHours: Number(addHours || 0),
          hourlyRate: rate,
          partsTotal: Number(addParts || 0),
        },
        { actorId: currentUser?.user_id || currentUser?.id }
      );
      if (!res.success) throw new Error(res.error);
      showToast('Additional work submitted for admin review');
      setAddTitle('');
      setAddDesc('');
    });

  const completeService = () =>
    run(async () => {
      const res = await mechanicBookingService.submitServiceCompletion(
        selected.booking_id || selected.id,
        mechanic.id,
        {
          actualLaborHours: Number(actualHours || selected.actual_labor_hours || estHours || 0),
          serviceNotes,
        },
        { actorId: currentUser?.user_id || currentUser?.id }
      );
      if (!res.success) throw new Error(res.error);
      showToast('Service marked complete — admin will finalize billing');
      setSelectedId(null);
    });

  if (loading && !mechanic) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator color="#1D4533" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!mechanic) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.emptyBox}>
          <BootstrapIcon name="wrench" size={28} color="#94A3B8" />
          <Text style={styles.emptyTitle}>Mechanic account not linked</Text>
          <Text style={styles.emptySub}>
            Ask an admin to link your login to a mechanic roster entry.
          </Text>
          <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
            <Text style={styles.logoutText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerEyebrow}>MECHANIC DASHBOARD</Text>
          <Text style={styles.headerTitle}>{mechanic.shortName || mechanic.name}</Text>
          <Text style={styles.headerSub}>
            {mechanic.bay || 'Pit Bay'} · {formatPhp(rate)}/hr
          </Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <BootstrapIcon name="box-arrow-right" size={14} color="#1D4533" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {toast ? (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.id}
            style={[styles.chip, filter === f.id && styles.chipOn]}
            onPress={() => setFilter(f.id)}
          >
            <Text style={[styles.chipText, filter === f.id && styles.chipTextOn]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor="#1D4533" />}
      >
        <Text style={styles.sectionLabel}>Today&apos;s Jobs · {filtered.length}</Text>

        {filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptySub}>No bookings in this filter.</Text>
          </View>
        ) : (
          filtered.map((b) => {
            const id = b.booking_id || b.id;
            const colors = statusColor(b.status);
            const open = selectedId === id;
            return (
              <View key={id} style={styles.card}>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedId(open ? null : id);
                    setFindings(b.inspection_notes || '');
                    setActualHours(b.actual_labor_hours != null ? String(b.actual_labor_hours) : '');
                    setServiceNotes(b.service_notes || '');
                    setChecklist(b.inspection_checklist || {});
                    setOdometerReading(
                      b.inspection_odometer != null ? String(b.inspection_odometer) : b.odometer || ''
                    );
                    setProgressPct(Number(b.service_progress || 25));
                  }}
                  activeOpacity={0.85}
                >
                  <View style={styles.cardTop}>
                    <Text style={styles.cardId}>#{id}</Text>
                    <View style={[styles.pill, { backgroundColor: colors.bg }]}>
                      <Text style={[styles.pillText, { color: colors.fg }]}>
                        {statusLabel(b.status)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.cardBike}>
                    {b.bike_brand || ''} {b.bike_model || ''} · {b.plate_number || b.bikePlate || ''}
                  </Text>
                  <Text style={styles.cardMeta}>
                    {b.service_type || b.category || 'Service'} ·{' '}
                    {b.preferred_time || b.time_slot || '—'} ·{' '}
                    {String(b.preferred_date || b.appointment_date || '').slice(0, 10)}
                  </Text>
                  <Text style={styles.cardProblem} numberOfLines={2}>
                    {b.problem_description || b.notes || 'No problem description'}
                  </Text>
                </TouchableOpacity>

                {open ? (
                  <View style={styles.detail}>
                    <Text style={styles.detailLabel}>Customer</Text>
                    <Text style={styles.detailValue}>{b.customer_name || '—'}</Text>
                    <Text style={styles.detailLabel}>Problem</Text>
                    <Text style={styles.detailValue}>{b.problem_description || b.notes || '—'}</Text>

                    {canMechanicAction(b.status, 'start_inspection') ? (
                      <TouchableOpacity
                        style={styles.primaryBtn}
                        onPress={startInspection}
                        disabled={busy}
                      >
                        <Text style={styles.primaryBtnText}>Start Inspection</Text>
                      </TouchableOpacity>
                    ) : null}

                    {canMechanicAction(b.status, 'save_inspection') ||
                    canMechanicAction(b.status, 'submit_estimate') ? (
                      <View style={{ gap: 8, marginTop: 8 }}>
                        <Text style={styles.formTitle}>Motorcycle Check</Text>
                        {INSPECTION_CHECKLIST.map((item) => (
                          <View key={item.key} style={styles.checkRow}>
                            <Text style={styles.checkLabel}>{item.label}</Text>
                            {item.key === 'odometer' ? (
                              <TextInput
                                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                                placeholder="Odometer reading"
                                keyboardType="numeric"
                                value={odometerReading}
                                onChangeText={setOdometerReading}
                              />
                            ) : (
                              <View style={styles.checkActions}>
                                {['ok', 'issue'].map((val) => {
                                  const on = checklist[item.key] === val;
                                  return (
                                    <TouchableOpacity
                                      key={val}
                                      style={[styles.checkChip, on && styles.checkChipOn]}
                                      onPress={() =>
                                        setChecklist((prev) => ({ ...prev, [item.key]: val }))
                                      }
                                    >
                                      <Text style={[styles.checkChipText, on && styles.checkChipTextOn]}>
                                        {val === 'ok' ? 'OK' : 'Issue'}
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            )}
                          </View>
                        ))}

                        <Text style={styles.formTitle}>Problems Found</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Describe problems discovered during inspection"
                          value={findings}
                          onChangeText={setFindings}
                          multiline
                        />
                        <TextInput
                          style={styles.input}
                          placeholder="Overall motorcycle condition"
                          value={condition}
                          onChangeText={setCondition}
                        />
                        <TextInput
                          style={styles.input}
                          placeholder="Safety concerns"
                          value={safety}
                          onChangeText={setSafety}
                        />
                        <TextInput
                          style={styles.input}
                          placeholder="Recommended work"
                          value={recommended}
                          onChangeText={setRecommended}
                          multiline
                        />
                        <TouchableOpacity
                          style={styles.secondaryBtn}
                          onPress={saveInspection}
                          disabled={busy}
                        >
                          <Text style={styles.secondaryBtnText}>Save Inspection</Text>
                        </TouchableOpacity>

                        <Text style={styles.formTitle}>Labor Estimate</Text>
                        <View style={styles.row}>
                          <TextInput
                            style={[styles.input, { flex: 1 }]}
                            placeholder="Hours"
                            keyboardType="decimal-pad"
                            value={estHours}
                            onChangeText={setEstHours}
                          />
                          <Text style={styles.calcHint}>
                            {estHours || 0} × {formatPhp(rate)} = {formatPhp(estLabor)}
                          </Text>
                        </View>
                        <Text style={styles.formTitle}>Recommended Parts</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Part name / description"
                          value={partsNote}
                          onChangeText={setPartsNote}
                        />
                        <View style={styles.row}>
                          <TextInput
                            style={[styles.input, { flex: 1 }]}
                            placeholder="Parts ₱"
                            keyboardType="decimal-pad"
                            value={partsCost}
                            onChangeText={setPartsCost}
                          />
                          <TextInput
                            style={[styles.input, { flex: 1 }]}
                            placeholder="Other ₱"
                            keyboardType="decimal-pad"
                            value={otherCost}
                            onChangeText={setOtherCost}
                          />
                        </View>
                        <TouchableOpacity
                          style={styles.primaryBtn}
                          onPress={submitEstimate}
                          disabled={busy}
                        >
                          <Text style={styles.primaryBtnText}>
                            Create Quotation (
                            {formatPhp(estLabor + Number(partsCost || 0) + Number(otherCost || 0))})
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}

                    {canMechanicAction(b.status, 'start_service') ? (
                      <TouchableOpacity
                        style={styles.primaryBtn}
                        onPress={startService}
                        disabled={busy}
                      >
                        <Text style={styles.primaryBtnText}>Start Service</Text>
                      </TouchableOpacity>
                    ) : null}

                    {canMechanicAction(b.status, 'update_progress') ||
                    canMechanicAction(b.status, 'complete_service') ||
                    canMechanicAction(b.status, 'create_additional') ? (
                      <View style={{ gap: 8, marginTop: 8 }}>
                        <Text style={styles.formTitle}>Service Progress</Text>
                        {SERVICE_PROGRESS_STEPS.map((step) => {
                          const done = progressPct >= step.min;
                          const current =
                            progressPct >= step.min &&
                            (SERVICE_PROGRESS_STEPS.find((s) => s.min > progressPct)?.min == null
                              ? step.min === 100
                              : progressPct <
                                (SERVICE_PROGRESS_STEPS.find((s) => s.min > step.min)?.min || 999));
                          return (
                            <TouchableOpacity
                              key={step.key}
                              style={styles.progressStepRow}
                              onPress={() => setProgressPct(step.min)}
                            >
                              <View
                                style={[
                                  styles.progressDot,
                                  done && styles.progressDotDone,
                                  current && styles.progressDotCurrent,
                                ]}
                              />
                              <Text
                                style={[
                                  styles.progressStepText,
                                  done && styles.progressStepDone,
                                  current && styles.progressStepCurrent,
                                ]}
                              >
                                {step.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                        <TextInput
                          style={styles.input}
                          placeholder="Actual labor hours"
                          keyboardType="decimal-pad"
                          value={actualHours}
                          onChangeText={setActualHours}
                        />
                        <TextInput
                          style={styles.input}
                          placeholder="Service notes / work performed"
                          value={serviceNotes}
                          onChangeText={setServiceNotes}
                          multiline
                        />
                        <TouchableOpacity
                          style={styles.secondaryBtn}
                          onPress={saveProgress}
                          disabled={busy}
                        >
                          <Text style={styles.secondaryBtnText}>Save Progress</Text>
                        </TouchableOpacity>

                        <Text style={styles.formTitle}>Additional Work Required</Text>
                        <Text style={styles.detailValue}>
                          Customer approval is required before extra work proceeds.
                        </Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Title"
                          value={addTitle}
                          onChangeText={setAddTitle}
                        />
                        <TextInput
                          style={styles.input}
                          placeholder="Reason / description"
                          value={addDesc}
                          onChangeText={setAddDesc}
                        />
                        <View style={styles.row}>
                          <TextInput
                            style={[styles.input, { flex: 1 }]}
                            placeholder="Extra hours"
                            keyboardType="decimal-pad"
                            value={addHours}
                            onChangeText={setAddHours}
                          />
                          <TextInput
                            style={[styles.input, { flex: 1 }]}
                            placeholder="Parts ₱"
                            keyboardType="decimal-pad"
                            value={addParts}
                            onChangeText={setAddParts}
                          />
                        </View>
                        <TouchableOpacity
                          style={styles.secondaryBtn}
                          onPress={requestExtra}
                          disabled={busy}
                        >
                          <Text style={styles.secondaryBtnText}>Request Customer Approval</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.primaryBtn}
                          onPress={completeService}
                          disabled={busy}
                        >
                          <Text style={styles.primaryBtnText}>Complete Service</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}

                    <Text style={[styles.detailLabel, { marginTop: 10 }]}>
                      Payments & quotation are admin-only. You cannot record customer payments.
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerEyebrow: { fontSize: 10, fontWeight: '800', color: '#059669', letterSpacing: 0.8 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  headerSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#C8DDD3',
    backgroundColor: '#F0FDF4',
  },
  logoutText: { fontSize: 12, fontWeight: '700', color: '#1D4533' },
  toast: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#1D4533',
    borderRadius: 10,
    padding: 10,
  },
  toastText: { color: '#FFF', fontSize: 12.5, fontWeight: '600' },
  filterRow: { maxHeight: 48, marginTop: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipOn: { backgroundColor: '#1D4533', borderColor: '#1D4533' },
  chipText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  chipTextOn: { color: '#FFFFFF' },
  sectionLabel: { fontSize: 13, fontWeight: '800', color: '#334155', marginBottom: 4 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardId: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  pillText: { fontSize: 10, fontWeight: '800' },
  cardBike: { fontSize: 14, fontWeight: '700', color: '#1D4533', marginTop: 6 },
  cardMeta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  cardProblem: { fontSize: 12.5, color: '#475569', marginTop: 6 },
  detail: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 4,
  },
  detailLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', marginTop: 4 },
  detailValue: { fontSize: 13, color: '#334155' },
  formTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginTop: 8 },
  input: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#FFF',
  },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  calcHint: { fontSize: 12, fontWeight: '700', color: '#1D4533', flex: 1 },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: '#1D4533',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
  secondaryBtn: {
    marginTop: 4,
    backgroundColor: '#C8DDD3',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#1D4533', fontWeight: '800', fontSize: 12.5 },
  emptyBox: { alignItems: 'center', padding: 28, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: '#334155' },
  emptySub: { fontSize: 13, color: '#64748B', textAlign: 'center' },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  checkLabel: { fontSize: 12.5, fontWeight: '600', color: '#334155', width: 120 },
  checkActions: { flexDirection: 'row', gap: 6 },
  checkChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  checkChipOn: { backgroundColor: '#1D4533', borderColor: '#1D4533' },
  checkChipText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  checkChipTextOn: { color: '#FFFFFF' },
  progressStepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  progressDotDone: { backgroundColor: '#059669', borderColor: '#059669' },
  progressDotCurrent: { backgroundColor: '#1D4533', borderColor: '#1D4533' },
  progressStepText: { fontSize: 13, color: '#94A3B8', fontWeight: '600' },
  progressStepDone: { color: '#059669' },
  progressStepCurrent: { color: '#1D4533', fontWeight: '800' },
});
