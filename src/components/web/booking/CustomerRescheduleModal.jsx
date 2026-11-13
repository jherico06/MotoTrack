// =========================================================================
// MotoTrack - Customer Reschedule Request Modal
// Allows customers to request a new appointment date & time slot.
// Preserves original booking, payment records, and validates garage capacity.
// Also supports reviewing & accepting/rejecting admin-suggested alternative dates.
// =========================================================================

import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Modal, ActivityIndicator } from 'react-native';
import { BootstrapIcon } from '../../common';
import {
  rescheduleService,
  STANDARD_TIME_SLOTS,
  RESCHEDULE_REASONS,
  RESCHEDULE_STATUS,
} from '../../../services/bookings/rescheduleService.js';

export default function CustomerRescheduleModal({
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
  const bikeLabel = `${booking?.bike_brand || booking?.bikeBrand || ''} ${booking?.bike_model || booking?.bikeModel || ''}`.trim() || 'Motorcycle';
  const serviceTitle = booking?.service_title || booking?.package_name || booking?.serviceName || 'Service Package';

  // Check if there is an active alternative schedule suggested by Admin
  const pendingReq = bookingId ? rescheduleService.getPendingRequestForBooking(bookingId) : null;
  const isAlternativeSuggested = pendingReq?.status === RESCHEDULE_STATUS.ALTERNATIVE_SUGGESTED;

  // Form State
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    // If tomorrow is Sunday, skip to Monday
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);

  const [requestedDate, setRequestedDate] = useState(tomorrowStr);
  const [requestedTimeSlot, setRequestedTimeSlot] = useState(STANDARD_TIME_SLOTS[0]);
  const [reason, setReason] = useState(RESCHEDULE_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [respondNotes, setRespondNotes] = useState('');

  // Live Slot Availability Check
  const availability = useMemo(() => {
    if (!requestedDate) return { available: false, reason: 'Select a date' };
    return rescheduleService.validateSlotAvailability(requestedDate, requestedTimeSlot, bookingId);
  }, [requestedDate, requestedTimeSlot, bookingId]);

  if (!visible || !booking) return null;

  // Handle Submit Customer Request
  const handleSubmitRequest = async () => {
    if (!requestedDate) {
      showToast?.('Please choose a valid appointment date.');
      return;
    }
    if (!requestedTimeSlot) {
      showToast?.('Please select an arrival time slot.');
      return;
    }
    if (!availability.available) {
      showToast?.(availability.reason || 'Selected slot is unavailable.');
      return;
    }

    const finalReason = reason === 'Other operational reason' && customReason.trim()
      ? customReason.trim()
      : reason;

    setIsSubmitting(true);
    try {
      const created = await rescheduleService.createCustomerRescheduleRequest({
        booking,
        requestedDate,
        requestedTimeSlot,
        reason: finalReason,
        notes: notes.trim(),
      });
      showToast?.('✓ Reschedule request submitted for admin review!');
      onRescheduleSubmitted?.(created);
      onClose?.();
    } catch (err) {
      showToast?.(err.message || 'Failed to submit reschedule request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Accept or Reject Alternative Schedule Suggested by Admin
  const handleRespondAlternative = async (accepted) => {
    if (!pendingReq) return;
    setIsSubmitting(true);
    try {
      await rescheduleService.customerRespondToAlternative(pendingReq.id, {
        accepted,
        customerNotes: respondNotes.trim(),
      });
      showToast?.(
        accepted
          ? '✓ Alternative schedule accepted! Your new slot is locked in.'
          : 'Original appointment retained.'
      );
      onRescheduleSubmitted?.();
      onClose?.();
    } catch (err) {
      showToast?.(err.message || 'Failed to submit response.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const bgCard = isDarkMode ? '#1E2227' : '#FFFFFF';
  const textPrimary = isDarkMode ? '#F8FAFC' : '#0F172A';
  const textMuted = isDarkMode ? '#94A3B8' : '#64748B';
  const borderCol = isDarkMode ? 'rgba(255,255,255,0.1)' : '#E2E8F0';
  const inputBg = isDarkMode ? '#0F172A' : '#F8FAFC';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(15, 23, 42, 0.72)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 16,
          zIndex: 99999,
        }}
      >
        <View
          style={{
            backgroundColor: bgCard,
            borderRadius: 20,
            width: '100%',
            maxWidth: 640,
            maxHeight: '92vh',
            boxShadow: '0 20px 45px rgba(0,0,0,0.3)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            borderWidth: 1,
            borderColor: borderCol,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 22,
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderBottomColor: borderCol,
              backgroundColor: isDarkMode ? '#15191E' : '#FAFAFA',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  backgroundColor: 'rgba(234, 88, 12, 0.12)',
                  borderWidth: 1,
                  borderColor: 'rgba(234, 88, 12, 0.3)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BootstrapIcon name="calendar2-range-fill" size={18} color="#EA580C" />
              </View>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: textPrimary }}>
                  Reschedule Appointment
                </Text>
                <Text style={{ fontSize: 11.5, color: textMuted, fontWeight: '500' }}>
                  Booking #{bookingId} • {serviceTitle}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <BootstrapIcon name="x-lg" size={13} color={textMuted} />
            </TouchableOpacity>
          </View>

          {/* Modal Scroll Body */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 22, gap: 16 }}
            showsVerticalScrollIndicator
          >
            {/* Case 1: If Admin Proposed an Alternative Schedule */}
            {isAlternativeSuggested ? (
              <View
                style={{
                  backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.12)' : '#FEF3C7',
                  borderWidth: 1.5,
                  borderColor: '#F59E0B',
                  borderRadius: 14,
                  padding: 16,
                  gap: 12,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <BootstrapIcon name="exclamation-diamond-fill" size={18} color="#D97706" />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: isDarkMode ? '#FCD34D' : '#92400E' }}>
                    Workshop Proposed an Alternative Schedule
                  </Text>
                </View>

                <Text style={{ fontSize: 12.5, color: isDarkMode ? '#FDE68A' : '#78350F', lineHeight: 18 }}>
                  Due to workshop operational requirements, the garage proposed moving your appointment:
                </Text>

                <View
                  style={{
                    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                    borderRadius: 10,
                    padding: 12,
                    gap: 6,
                    borderWidth: 1,
                    borderColor: 'rgba(245, 158, 11, 0.3)',
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 12, color: textMuted }}>Proposed Date:</Text>
                    <Text style={{ fontSize: 12.5, fontWeight: '700', color: textPrimary }}>
                      {pendingReq.alternative_date}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 12, color: textMuted }}>Proposed Window:</Text>
                    <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#EA580C' }}>
                      {pendingReq.alternative_time_slot}
                    </Text>
                  </View>
                  {pendingReq.alternative_reason && (
                    <View style={{ marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: borderCol }}>
                      <Text style={{ fontSize: 11.5, color: textMuted, fontStyle: 'italic' }}>
                        Reason: {pendingReq.alternative_reason}
                      </Text>
                    </View>
                  )}
                </View>

                <TextInput
                  placeholder="Optional reply / note to workshop..."
                  placeholderTextColor={textMuted}
                  value={respondNotes}
                  onChangeText={setRespondNotes}
                  style={{
                    backgroundColor: inputBg,
                    borderWidth: 1,
                    borderColor: borderCol,
                    borderRadius: 8,
                    padding: 10,
                    fontSize: 12,
                    color: textPrimary,
                  }}
                />

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                  <TouchableOpacity
                    onPress={() => handleRespondAlternative(true)}
                    disabled={isSubmitting}
                    style={{
                      flex: 1,
                      backgroundColor: '#10B981',
                      paddingVertical: 10,
                      borderRadius: 10,
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12.5 }}>
                      ✓ Accept Proposed Schedule
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleRespondAlternative(false)}
                    disabled={isSubmitting}
                    style={{
                      flex: 1,
                      backgroundColor: isDarkMode ? '#334155' : '#E2E8F0',
                      paddingVertical: 10,
                      borderRadius: 10,
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 12.5 }}>
                      Decline & Keep Original
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {/* Current Active Appointment Summary Card */}
            <View
              style={{
                backgroundColor: isDarkMode ? '#15191E' : '#F8FAFC',
                borderRadius: 14,
                padding: 14,
                borderWidth: 1,
                borderColor: borderCol,
                gap: 8,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Current Active Appointment (Remains active until approved)
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
                <View>
                  <Text style={{ fontSize: 11, color: textMuted }}>Scheduled Date</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: textPrimary, marginTop: 1 }}>
                    {originalDate}
                  </Text>
                </View>
                <View>
                  <Text style={{ fontSize: 11, color: textMuted }}>Arrival Window</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#EA580C', marginTop: 1 }}>
                    {originalTime}
                  </Text>
                </View>
                <View>
                  <Text style={{ fontSize: 11, color: textMuted }}>Motorcycle</Text>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: textPrimary, marginTop: 1 }}>
                    {bikeLabel} ({booking.plate_number || 'TEMP'})
                  </Text>
                </View>
              </View>
            </View>

            {/* Notice Banner */}
            <View
              style={{
                backgroundColor: isDarkMode ? 'rgba(56, 189, 248, 0.1)' : '#EFF6FF',
                borderWidth: 1,
                borderColor: isDarkMode ? 'rgba(56, 189, 248, 0.25)' : '#BFDBFE',
                borderRadius: 10,
                padding: 12,
                flexDirection: 'row',
                gap: 10,
                alignItems: 'flex-start',
              }}
            >
              <BootstrapIcon name="info-circle-fill" size={16} color="#0284C7" style={{ marginTop: 2 }} />
              <Text style={{ flex: 1, fontSize: 11.5, color: isDarkMode ? '#BAE6FD' : '#1E40AF', lineHeight: 16 }}>
                Operating hours are <Text style={{ fontWeight: '700' }}>Monday to Saturday, 9:00 AM – 6:00 PM</Text>. Your advance downpayment is fully preserved. Your original slot remains reserved until the workshop approves your request.
              </Text>
            </View>

            {/* Requested Date */}
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: textPrimary }}>
                Requested New Date <Text style={{ color: '#EA580C' }}>*</Text>
              </Text>
              <TextInput
                type="date"
                min={tomorrowStr}
                value={requestedDate}
                onChangeText={setRequestedDate}
                onChange={(e) => setRequestedDate(e.target.value)}
                style={{
                  backgroundColor: inputBg,
                  borderWidth: 1.5,
                  borderColor: borderCol,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                  fontSize: 13,
                  color: textPrimary,
                  fontWeight: '600',
                  outlineStyle: 'none',
                }}
              />
              <Text style={{ fontSize: 11, color: textMuted }}>
                Sundays are closed for pit maintenance. Please select Mon–Sat.
              </Text>
            </View>

            {/* Requested Arrival Window */}
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: textPrimary }}>
                Select Preferred Arrival Window <Text style={{ color: '#EA580C' }}>*</Text>
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
                        borderRadius: 9,
                        borderWidth: 1.5,
                        borderColor: isSelected ? '#EA580C' : borderCol,
                        backgroundColor: isSelected
                          ? isDarkMode ? 'rgba(234, 88, 12, 0.18)' : '#FFF7ED'
                          : inputBg,
                        cursor: 'pointer',
                      }}
                      activeOpacity={0.8}
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

            {/* Live Availability Status Indicator */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                padding: 10,
                borderRadius: 9,
                backgroundColor: availability.available
                  ? isDarkMode ? 'rgba(16, 185, 129, 0.14)' : '#ECFDF5'
                  : isDarkMode ? 'rgba(239, 68, 68, 0.14)' : '#FEF2F2',
                borderWidth: 1,
                borderColor: availability.available ? '#10B981' : '#EF4444',
              }}
            >
              <BootstrapIcon
                name={availability.available ? 'check-circle-fill' : 'x-circle-fill'}
                size={14}
                color={availability.available ? '#10B981' : '#EF4444'}
              />
              <Text
                style={{
                  fontSize: 11.5,
                  fontWeight: '600',
                  color: availability.available ? (isDarkMode ? '#34D399' : '#065F46') : '#DC2626',
                }}
              >
                {availability.available
                  ? `Slot is available on ${requestedDate} (${requestedTimeSlot})`
                  : availability.reason}
              </Text>
            </View>

            {/* Reason for Rescheduling */}
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: textPrimary }}>
                Reason for Rescheduling <Text style={{ color: '#EA580C' }}>*</Text>
              </Text>
              <View style={{ gap: 6 }}>
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
                        paddingVertical: 7,
                        paddingHorizontal: 10,
                        borderRadius: 8,
                        backgroundColor: isSelected
                          ? isDarkMode ? 'rgba(234, 88, 12, 0.1)' : '#FFF7ED'
                          : 'transparent',
                        borderWidth: 1,
                        borderColor: isSelected ? 'rgba(234, 88, 12, 0.4)' : 'transparent',
                        cursor: 'pointer',
                      }}
                      activeOpacity={0.8}
                    >
                      <View
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 999,
                          borderWidth: 2,
                          borderColor: isSelected ? '#EA580C' : textMuted,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {isSelected && (
                          <View
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 999,
                              backgroundColor: '#EA580C',
                            }}
                          />
                        )}
                      </View>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: isSelected ? '600' : '400',
                          color: textPrimary,
                        }}
                      >
                        {r}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {reason === 'Other operational reason' && (
                <TextInput
                  placeholder="Please specify your reason..."
                  placeholderTextColor={textMuted}
                  value={customReason}
                  onChangeText={setCustomReason}
                  style={{
                    backgroundColor: inputBg,
                    borderWidth: 1,
                    borderColor: borderCol,
                    borderRadius: 8,
                    padding: 10,
                    fontSize: 12,
                    color: textPrimary,
                    marginTop: 4,
                  }}
                />
              )}
            </View>

            {/* Optional Additional Notes */}
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: textMuted }}>
                Additional Notes (Optional)
              </Text>
              <TextInput
                placeholder="Any special timing or motorcycle drop-off instructions..."
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
                  padding: 10,
                  fontSize: 12,
                  color: textPrimary,
                  minHeight: 64,
                  textAlignVertical: 'top',
                }}
              />
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 10,
              paddingHorizontal: 22,
              paddingVertical: 14,
              borderTopWidth: 1,
              borderTopColor: borderCol,
              backgroundColor: isDarkMode ? '#15191E' : '#FAFAFA',
            }}
          >
            <TouchableOpacity
              onPress={onClose}
              disabled={isSubmitting}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 9,
                borderRadius: 10,
                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#E2E8F0',
                cursor: 'pointer',
              }}
            >
              <Text style={{ fontSize: 12.5, fontWeight: '600', color: textPrimary }}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmitRequest}
              disabled={isSubmitting || !availability.available}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: 20,
                paddingVertical: 9,
                borderRadius: 10,
                backgroundColor: availability.available ? '#EA580C' : '#94A3B8',
                opacity: isSubmitting ? 0.7 : 1,
                cursor: availability.available ? 'pointer' : 'not-allowed',
                boxShadow: availability.available ? '0 4px 12px rgba(234, 88, 12, 0.3)' : 'none',
              }}
            >
              {isSubmitting && <ActivityIndicator size="small" color="#FFFFFF" />}
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>
                Submit Reschedule Request
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

