// =========================================================================
// MotoTrack - Mobile Customer Reschedule Request Modal
// Native iOS/Android modal allowing customers to request a new appointment
// date & arrival slot or respond to an admin-proposed alternative schedule.
// Preserves original booking & downpayment while validating garage capacity.
// =========================================================================

import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { BootstrapIcon } from '../../common';
import {
  rescheduleService,
  STANDARD_TIME_SLOTS,
  RESCHEDULE_REASONS,
  RESCHEDULE_STATUS,
} from '../../../services/bookings/rescheduleService.js';

function getUpcomingOpenDates(count = 10) {
  const days = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  while (days.length < count) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() === 0) continue; // Closed Sundays
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    days.push({ iso, label });
  }
  return days;
}

export default function MobileRescheduleModal({
  visible,
  booking,
  onClose,
  onRescheduleSubmitted,
  showToast,
  isDarkMode = false,
}) {
  const bookingId = booking?.booking_id || booking?.id || '';
  const originalDate = (booking?.appointment_date || booking?.preferred_date || booking?.date || '').split('T')[0];
  const originalTime = booking?.time_slot || booking?.preferred_time || booking?.time || '09:00 AM - 10:30 AM';
  const bikeLabel =
    `${booking?.bike_brand || booking?.bikeBrand || ''} ${booking?.bike_model || booking?.bikeModel || ''}`.trim() ||
    'Motorcycle';
  const serviceTitle =
    booking?.service_title || booking?.package_name || booking?.serviceName || 'Service Package';

  const openDates = useMemo(() => getUpcomingOpenDates(10), []);
  const defaultDate = openDates[0]?.iso || '';

  const pendingReq = useMemo(
    () =>
      bookingId
        ? booking?.active_reschedule_request || rescheduleService.getPendingRequestForBooking(bookingId)
        : null,
    [booking, bookingId]
  );
  const isAlternativeSuggested = pendingReq?.status === RESCHEDULE_STATUS.ALTERNATIVE_SUGGESTED;

  const [requestedDate, setRequestedDate] = useState(defaultDate);
  const [requestedTimeSlot, setRequestedTimeSlot] = useState(STANDARD_TIME_SLOTS[0]);
  const [reason, setReason] = useState(RESCHEDULE_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [notes, setNotes] = useState('');
  const [respondNotes, setRespondNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setRequestedDate(defaultDate);
      setRequestedTimeSlot(STANDARD_TIME_SLOTS[0]);
      setReason(RESCHEDULE_REASONS[0]);
      setCustomReason('');
      setNotes('');
      setRespondNotes('');
    }
  }, [visible, bookingId, defaultDate]);

  const availability = useMemo(() => {
    if (!requestedDate || !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate.trim())) {
      return { available: false, reason: 'Select or enter a valid YYYY-MM-DD date (Mon–Sat).' };
    }
    return rescheduleService.validateSlotAvailability(requestedDate.trim(), requestedTimeSlot, bookingId);
  }, [requestedDate, requestedTimeSlot, bookingId]);

  if (!visible || !booking) return null;

  const handleSubmitRequest = async () => {
    if (!requestedDate || !availability.available) {
      showToast?.(availability.reason || 'Selected slot is unavailable.');
      return;
    }
    if (!requestedTimeSlot) {
      showToast?.('Please select an arrival time slot.');
      return;
    }

    const finalReason =
      reason === 'Other operational reason' && customReason.trim() ? customReason.trim() : reason;

    setIsSubmitting(true);
    try {
      const created = await rescheduleService.createCustomerRescheduleRequest({
        booking,
        requestedDate: requestedDate.trim(),
        requestedTimeSlot,
        reason: finalReason,
        notes: notes.trim(),
      });
      showToast?.('Reschedule request submitted for admin review.');
      onRescheduleSubmitted?.(created);
      onClose?.();
    } catch (err) {
      showToast?.(err?.message || 'Failed to submit reschedule request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRespondAlternative = async (accepted) => {
    if (!pendingReq?.id) return;
    setIsSubmitting(true);
    try {
      await rescheduleService.customerRespondToAlternative(pendingReq.id, {
        accepted,
        customerNotes: respondNotes.trim(),
      });
      showToast?.(
        accepted
          ? 'Alternative schedule accepted! Your new slot is confirmed.'
          : 'Original appointment retained.'
      );
      onRescheduleSubmitted?.();
      onClose?.();
    } catch (err) {
      showToast?.(err?.message || 'Failed to submit response.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sheetBg = isDarkMode ? '#1C1F23' : '#FFFFFF';
  const cardBg = isDarkMode ? '#14171A' : '#F8FAFC';
  const inputBg = isDarkMode ? '#111315' : '#F8FAFC';
  const borderCol = isDarkMode ? '#2B3035' : '#E2E8F0';
  const textPrimary = isDarkMode ? '#F9FAFB' : '#0F172A';
  const textMuted = isDarkMode ? '#94A3B8' : '#64748B';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{
          flex: 1,
          backgroundColor: 'rgba(15, 23, 42, 0.72)',
          justifyContent: 'flex-end',
        }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View
          style={{
            backgroundColor: sheetBg,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            maxHeight: '88%',
            borderTopWidth: 1,
            borderColor: borderCol,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 18,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: borderCol,
              backgroundColor: isDarkMode ? '#15191E' : '#FAFAFA',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: isDarkMode ? 'rgba(234, 88, 12, 0.16)' : '#FFF7ED',
                  borderWidth: 1,
                  borderColor: 'rgba(234, 88, 12, 0.3)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BootstrapIcon name="calendar2-range-fill" size={17} color="#EA580C" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: textPrimary }} numberOfLines={1}>
                  Reschedule Appointment
                </Text>
                <Text style={{ fontSize: 11.5, color: textMuted }} numberOfLines={1}>
                  #{bookingId} · {serviceTitle}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: isDarkMode ? '#23272B' : '#F1F5F9',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BootstrapIcon name="x-lg" size={14} color={textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ maxHeight: 540 }}
            contentContainerStyle={{ padding: 18, gap: 16 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Admin-proposed alternative response */}
            {isAlternativeSuggested ? (
              <View
                style={{
                  backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.12)' : '#FEF3C7',
                  borderWidth: 1.5,
                  borderColor: '#F59E0B',
                  borderRadius: 16,
                  padding: 14,
                  gap: 10,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <BootstrapIcon name="exclamation-diamond-fill" size={17} color="#D97706" />
                  <Text style={{ fontSize: 13.5, fontWeight: '700', color: isDarkMode ? '#FCD34D' : '#92400E', flex: 1 }}>
                    Workshop Proposed an Alternative Schedule
                  </Text>
                </View>

                <View
                  style={{
                    backgroundColor: sheetBg,
                    borderRadius: 12,
                    padding: 12,
                    gap: 6,
                    borderWidth: 1,
                    borderColor: 'rgba(245, 158, 11, 0.35)',
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 12, color: textMuted }}>Proposed Date</Text>
                    <Text style={{ fontSize: 12.5, fontWeight: '700', color: textPrimary }}>
                      {pendingReq.alternative_date}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 12, color: textMuted }}>Arrival Window</Text>
                    <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#EA580C' }}>
                      {pendingReq.alternative_time_slot}
                    </Text>
                  </View>
                  {pendingReq.alternative_reason ? (
                    <Text style={{ fontSize: 11.5, color: textMuted, marginTop: 4 }}>
                      Reason: {pendingReq.alternative_reason}
                    </Text>
                  ) : null}
                </View>

                <TextInput
                  placeholder="Optional reply note to workshop..."
                  placeholderTextColor={textMuted}
                  value={respondNotes}
                  onChangeText={setRespondNotes}
                  style={{
                    backgroundColor: inputBg,
                    borderWidth: 1,
                    borderColor: borderCol,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 9,
                    fontSize: 12.5,
                    color: textPrimary,
                  }}
                />

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => handleRespondAlternative(true)}
                    disabled={isSubmitting}
                    style={{
                      flex: 1,
                      backgroundColor: '#10B981',
                      paddingVertical: 11,
                      borderRadius: 10,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12.5 }}>
                      Accept Proposed
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleRespondAlternative(false)}
                    disabled={isSubmitting}
                    style={{
                      flex: 1,
                      backgroundColor: isDarkMode ? '#2B3035' : '#E2E8F0',
                      paddingVertical: 11,
                      borderRadius: 10,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 12.5 }}>
                      Keep Original
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {/* Current Active Summary */}
            <View
              style={{
                backgroundColor: cardBg,
                borderRadius: 14,
                padding: 14,
                borderWidth: 1,
                borderColor: borderCol,
                gap: 8,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: textMuted, letterSpacing: 0.5 }}>
                CURRENT ACTIVE APPOINTMENT
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, color: textMuted }}>Scheduled Date</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: textPrimary, marginTop: 2 }}>
                    {originalDate || '—'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, color: textMuted }}>Arrival Window</Text>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#EA580C', marginTop: 2 }}>
                    {originalTime}
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 12, color: textMuted }}>
                {bikeLabel} ({booking.plate_number || 'TEMP'})
              </Text>
            </View>

            {/* Downpayment notice */}
            <View
              style={{
                backgroundColor: isDarkMode ? 'rgba(56, 189, 248, 0.1)' : '#EFF6FF',
                borderWidth: 1,
                borderColor: isDarkMode ? 'rgba(56, 189, 248, 0.25)' : '#BFDBFE',
                borderRadius: 12,
                padding: 12,
                flexDirection: 'row',
                gap: 10,
                alignItems: 'flex-start',
              }}
            >
              <BootstrapIcon name="info-circle-fill" size={16} color="#0284C7" />
              <Text style={{ flex: 1, fontSize: 12, color: isDarkMode ? '#BAE6FD' : '#1E40AF', lineHeight: 17 }}>
                Operating hours: Mon–Sat, 9:00 AM – 6:00 PM. Your downpayment is preserved and your current slot stays reserved until approved.
              </Text>
            </View>

            {/* Quick Open Date Pills + Custom YYYY-MM-DD Input */}
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: textPrimary }}>
                Requested New Date <Text style={{ color: '#EA580C' }}>*</Text>
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {openDates.map((d) => {
                  const active = requestedDate === d.iso;
                  return (
                    <TouchableOpacity
                      key={d.iso}
                      onPress={() => setRequestedDate(d.iso)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: active ? '#EA580C' : borderCol,
                        backgroundColor: active
                          ? isDarkMode ? 'rgba(234, 88, 12, 0.2)' : '#FFF7ED'
                          : inputBg,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: active ? '700' : '600',
                          color: active ? '#EA580C' : textPrimary,
                        }}
                      >
                        {d.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TextInput
                value={requestedDate}
                onChangeText={setRequestedDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={textMuted}
                maxLength={10}
                style={{
                  backgroundColor: inputBg,
                  borderWidth: 1.5,
                  borderColor: borderCol,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                  fontSize: 13,
                  fontWeight: '600',
                  color: textPrimary,
                }}
              />
            </View>

            {/* Arrival Window */}
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: textPrimary }}>
                Preferred Arrival Window <Text style={{ color: '#EA580C' }}>*</Text>
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {STANDARD_TIME_SLOTS.map((slot) => {
                  const isSelected = requestedTimeSlot === slot;
                  return (
                    <TouchableOpacity
                      key={slot}
                      onPress={() => setRequestedTimeSlot(slot)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: isSelected ? '#EA580C' : borderCol,
                        backgroundColor: isSelected
                          ? isDarkMode ? 'rgba(234, 88, 12, 0.2)' : '#FFF7ED'
                          : inputBg,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: isSelected ? '700' : '500',
                          color: isSelected ? '#EA580C' : textPrimary,
                        }}
                      >
                        {slot}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Availability Pill */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                padding: 10,
                borderRadius: 10,
                backgroundColor: availability.available
                  ? isDarkMode ? 'rgba(16, 185, 129, 0.14)' : '#ECFDF5'
                  : isDarkMode ? 'rgba(239, 68, 68, 0.14)' : '#FEF2F2',
                borderWidth: 1,
                borderColor: availability.available ? '#10B981' : '#EF4444',
              }}
            >
              <BootstrapIcon
                name={availability.available ? 'check-circle-fill' : 'x-circle-fill'}
                size={15}
                color={availability.available ? '#10B981' : '#EF4444'}
              />
              <Text
                style={{
                  flex: 1,
                  fontSize: 12,
                  fontWeight: '600',
                  color: availability.available ? (isDarkMode ? '#34D399' : '#065F46') : '#DC2626',
                }}
              >
                {availability.available
                  ? `Slot is available on ${requestedDate} (${requestedTimeSlot})`
                  : availability.reason}
              </Text>
            </View>

            {/* Reason */}
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: textPrimary }}>
                Reason for Rescheduling <Text style={{ color: '#EA580C' }}>*</Text>
              </Text>
              {RESCHEDULE_REASONS.map((r) => {
                const isSelected = reason === r;
                return (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setReason(r)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingVertical: 8,
                      paddingHorizontal: 10,
                      borderRadius: 10,
                      backgroundColor: isSelected
                        ? isDarkMode ? 'rgba(234, 88, 12, 0.12)' : '#FFF7ED'
                        : 'transparent',
                      borderWidth: 1,
                      borderColor: isSelected ? 'rgba(234, 88, 12, 0.4)' : 'transparent',
                    }}
                  >
                    <View
                      style={{
                        width: 17,
                        height: 17,
                        borderRadius: 999,
                        borderWidth: 2,
                        borderColor: isSelected ? '#EA580C' : textMuted,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isSelected ? (
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 999,
                            backgroundColor: '#EA580C',
                          }}
                        />
                      ) : null}
                    </View>
                    <Text style={{ fontSize: 12.5, fontWeight: isSelected ? '600' : '400', color: textPrimary }}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              {reason === 'Other operational reason' ? (
                <TextInput
                  placeholder="Specify your reason..."
                  placeholderTextColor={textMuted}
                  value={customReason}
                  onChangeText={setCustomReason}
                  style={{
                    backgroundColor: inputBg,
                    borderWidth: 1,
                    borderColor: borderCol,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 9,
                    fontSize: 12.5,
                    color: textPrimary,
                  }}
                />
              ) : null}
            </View>

            {/* Additional Notes */}
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: textMuted }}>
                Additional Notes (Optional)
              </Text>
              <TextInput
                placeholder="Drop-off notes or timing details..."
                placeholderTextColor={textMuted}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                style={{
                  backgroundColor: inputBg,
                  borderWidth: 1,
                  borderColor: borderCol,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontSize: 12.5,
                  color: textPrimary,
                  minHeight: 68,
                  textAlignVertical: 'top',
                }}
              />
            </View>
          </ScrollView>

          {/* Footer */}
          <View
            style={{
              flexDirection: 'row',
              gap: 10,
              paddingHorizontal: 18,
              paddingTop: 12,
              paddingBottom: Platform.OS === 'ios' ? 28 : 16,
              borderTopWidth: 1,
              borderTopColor: borderCol,
              backgroundColor: isDarkMode ? '#15191E' : '#FAFAFA',
            }}
          >
            <TouchableOpacity
              onPress={onClose}
              disabled={isSubmitting}
              style={{
                paddingHorizontal: 18,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: isDarkMode ? '#23272B' : '#E2E8F0',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: textPrimary }}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmitRequest}
              disabled={isSubmitting || !availability.available}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: availability.available ? '#EA580C' : '#94A3B8',
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              {isSubmitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
              <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#FFFFFF' }}>
                Submit Reschedule Request
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
