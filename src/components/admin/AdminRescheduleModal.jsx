// =========================================================================
// MotoTrack - Admin Reschedule Review & Management Modal
// Provides complete availability validation, 3 operational actions:
// 1. Approve Reschedule (with bay & technician assignment)
// 2. Reject Reschedule (with required admin reason)
// 3. Suggest Another Schedule (alternative proposal to customer)
// Preserves original booking, payments, and full audit history.
// =========================================================================

import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Modal, ActivityIndicator } from 'react-native';
import { BootstrapIcon } from '../common';
import {
  rescheduleService,
  STANDARD_TIME_SLOTS,
  ADMIN_RESCHEDULE_REASONS,
  RESCHEDULE_STATUS,
} from '../../services/bookings/rescheduleService.js';
import { garageService } from '../../services/bookings/garageService.js';

export default function AdminRescheduleModal({
  visible,
  request,
  onClose,
  onRequestUpdated,
  showToast,
  isDarkMode = false,
  adminName = 'Workshop Admin',
}) {
  if (!request) return null;

  const bookingId = request.booking_id;
  const allBookings = garageService.getLocalBookings();
  const booking = allBookings.find((b) => (b.id || b.booking_id) === bookingId) || {};

  // Action Tabs inside Modal: 'review' | 'reject' | 'suggest_alternative'
  const [activeActionTab, setActiveActionTab] = useState('review');

  // Approve Fields
  const [assignedMechanic, setAssignedMechanic] = useState(booking.mechanic || 'Pending Assignment');
  const [assignedBay, setAssignedBay] = useState(booking.bay_number || 'Bay 1');
  const [adminNotes, setAdminNotes] = useState('');

  // Reject Fields
  const [rejectionReason, setRejectionReason] = useState(ADMIN_RESCHEDULE_REASONS[0]);
  const [customRejectionReason, setCustomRejectionReason] = useState('');

  // Suggest Alternative Fields
  const [altDate, setAltDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [altTimeSlot, setAltTimeSlot] = useState(STANDARD_TIME_SLOTS[0]);
  const [altReason, setAltReason] = useState(ADMIN_RESCHEDULE_REASONS[2]);

  const [isProcessing, setIsProcessing] = useState(false);

  // Live Availability Validation for Requested Slot
  const requestedValidation = useMemo(() => {
    return rescheduleService.validateSlotAvailability(
      request.requested_date,
      request.requested_time_slot,
      bookingId
    );
  }, [request.requested_date, request.requested_time_slot, bookingId]);

  // Live Availability Validation for Alternative Slot
  const altValidation = useMemo(() => {
    return rescheduleService.validateSlotAvailability(altDate, altTimeSlot, bookingId);
  }, [altDate, altTimeSlot, bookingId]);

  // Handlers
  const handleApprove = async () => {
    if (!requestedValidation.available) {
      showToast?.(`Cannot approve: ${requestedValidation.reason}`);
      return;
    }
    setIsProcessing(true);
    try {
      await rescheduleService.approveRescheduleRequest(request.id, {
        adminName,
        mechanic: assignedMechanic,
        bay: assignedBay,
        adminNotes: adminNotes.trim(),
      });
      showToast?.(`✓ Reschedule approved! Booking #${bookingId} updated to ${request.requested_date}.`);
      onRequestUpdated?.();
      onClose?.();
    } catch (err) {
      showToast?.(err.message || 'Failed to approve reschedule request.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    const reasonText = rejectionReason === 'Other operational issue' && customRejectionReason.trim()
      ? customRejectionReason.trim()
      : rejectionReason;

    if (!reasonText || !reasonText.trim()) {
      showToast?.('Please specify a rejection reason.');
      return;
    }

    setIsProcessing(true);
    try {
      await rescheduleService.rejectRescheduleRequest(request.id, {
        adminName,
        reason: reasonText.trim(),
      });
      showToast?.(`Reschedule request #${request.id} rejected. Original appointment retained.`);
      onRequestUpdated?.();
      onClose?.();
    } catch (err) {
      showToast?.(err.message || 'Failed to reject reschedule request.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSuggestAlternative = async () => {
    if (!altValidation.available) {
      showToast?.(`Cannot propose alternative: ${altValidation.reason}`);
      return;
    }

    setIsProcessing(true);
    try {
      await rescheduleService.suggestAlternativeSchedule(request.id, {
        adminName,
        alternativeDate: altDate,
        alternativeTimeSlot: altTimeSlot,
        reason: altReason,
      });
      showToast?.(`✓ Alternative schedule proposed to ${request.customer_name}. Awaiting customer response.`);
      onRequestUpdated?.();
      onClose?.();
    } catch (err) {
      showToast?.(err.message || 'Failed to suggest alternative schedule.');
    } finally {
      setIsProcessing(false);
    }
  };

  const bgCard = isDarkMode ? '#1E2227' : '#FFFFFF';
  const textPrimary = isDarkMode ? '#F8FAFC' : '#0F172A';
  const textMuted = isDarkMode ? '#94A3B8' : '#64748B';
  const borderCol = isDarkMode ? 'rgba(255,255,255,0.1)' : '#E2E8F0';
  const inputBg = isDarkMode ? '#0F172A' : '#F8FAFC';

  const isPending = request.status === RESCHEDULE_STATUS.PENDING_REVIEW || request.status === RESCHEDULE_STATUS.ALTERNATIVE_SUGGESTED;

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
            maxWidth: 720,
            maxHeight: '94vh',
            boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
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
                <BootstrapIcon name="arrow-repeat" size={18} color="#EA580C" />
              </View>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: textPrimary }}>
                    Review Reschedule Request
                  </Text>
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 6,
                      backgroundColor: isPending
                        ? 'rgba(245, 158, 11, 0.16)'
                        : request.status === 'Approved'
                          ? 'rgba(16, 185, 129, 0.16)'
                          : 'rgba(239, 68, 68, 0.16)',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '700',
                        color: isPending
                          ? '#D97706'
                          : request.status === 'Approved'
                            ? '#059669'
                            : '#DC2626',
                      }}
                    >
                      {request.status}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 11.5, color: textMuted, fontWeight: '500' }}>
                  Request #{request.id} • Booking #{bookingId}
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

          {/* Action Tabs Selector */}
          {isPending && (
            <View
              style={{
                flexDirection: 'row',
                paddingHorizontal: 22,
                paddingVertical: 8,
                gap: 8,
                borderBottomWidth: 1,
                borderBottomColor: borderCol,
                backgroundColor: isDarkMode ? '#191E24' : '#F1F5F9',
              }}
            >
              <TouchableOpacity
                onPress={() => setActiveActionTab('review')}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderRadius: 8,
                  backgroundColor: activeActionTab === 'review' ? (isDarkMode ? '#242B33' : '#FFFFFF') : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: activeActionTab === 'review' ? '700' : '500',
                    color: activeActionTab === 'review' ? '#EA580C' : textMuted,
                  }}
                >
                  1. Review & Approve
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveActionTab('suggest_alternative')}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderRadius: 8,
                  backgroundColor: activeActionTab === 'suggest_alternative' ? (isDarkMode ? '#242B33' : '#FFFFFF') : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: activeActionTab === 'suggest_alternative' ? '700' : '500',
                    color: activeActionTab === 'suggest_alternative' ? '#EA580C' : textMuted,
                  }}
                >
                  2. Suggest Alternative
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveActionTab('reject')}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderRadius: 8,
                  backgroundColor: activeActionTab === 'reject' ? (isDarkMode ? '#242B33' : '#FFFFFF') : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: activeActionTab === 'reject' ? '700' : '500',
                    color: activeActionTab === 'reject' ? '#DC2626' : textMuted,
                  }}
                >
                  3. Decline Request
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Modal Scroll Content */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 22, gap: 16 }}
            showsVerticalScrollIndicator
          >
            {/* Grid Comparison: Original vs Requested Appointment */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
              {/* Original Appointment Card */}
              <View
                style={{
                  flex: 1,
                  minWidth: 280,
                  backgroundColor: isDarkMode ? '#15191E' : '#F8FAFC',
                  borderRadius: 14,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: borderCol,
                  gap: 8,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <BootstrapIcon name="calendar-event" size={14} color="#64748B" />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: textMuted, textTransform: 'uppercase' }}>
                    Original Appointment
                  </Text>
                </View>

                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: textPrimary }}>
                    {request.original_date}
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: textMuted }}>
                    Window: {request.original_time_slot}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: textMuted, marginTop: 4 }}>
                    Technician: <Text style={{ fontWeight: '600', color: textPrimary }}>{request.original_mechanic || 'Pending'}</Text>
                  </Text>
                  <Text style={{ fontSize: 11.5, color: textMuted }}>
                    Pit Bay: <Text style={{ fontWeight: '600', color: textPrimary }}>{request.original_bay || 'Bay 1'}</Text>
                  </Text>
                  <Text style={{ fontSize: 11.5, color: textMuted }}>
                    Downpayment: <Text style={{ fontWeight: '700', color: '#10B981' }}>₱{Number(booking.downpayment_amount || 0).toLocaleString()} (Paid)</Text>
                  </Text>
                </View>
              </View>

              {/* Requested Appointment Card */}
              <View
                style={{
                  flex: 1,
                  minWidth: 280,
                  backgroundColor: isDarkMode ? 'rgba(234, 88, 12, 0.08)' : '#FFF7ED',
                  borderRadius: 14,
                  padding: 14,
                  borderWidth: 1.5,
                  borderColor: isDarkMode ? 'rgba(234, 88, 12, 0.3)' : '#FDBA74',
                  gap: 8,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <BootstrapIcon name="arrow-right-circle-fill" size={14} color="#EA580C" />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#EA580C', textTransform: 'uppercase' }}>
                    Requested New Appointment
                  </Text>
                </View>

                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: textPrimary }}>
                    {request.requested_date}
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#EA580C' }}>
                    Window: {request.requested_time_slot}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: textMuted, marginTop: 4 }}>
                    Reason: <Text style={{ fontWeight: '600', color: textPrimary }}>{request.reason}</Text>
                  </Text>
                  {request.notes ? (
                    <Text style={{ fontSize: 11.5, color: textMuted }}>
                      Customer Notes: <Text style={{ fontStyle: 'italic', color: textPrimary }}>"{request.notes}"</Text>
                    </Text>
                  ) : null}
                  <Text style={{ fontSize: 11.5, color: textMuted }}>
                    Requested by: <Text style={{ fontWeight: '600', color: textPrimary }}>{request.requested_by === 'customer' ? 'Customer' : 'Workshop Admin'}</Text>
                  </Text>
                </View>
              </View>
            </View>

            {/* Availability Validation Panel */}
            <View
              style={{
                backgroundColor: requestedValidation.available
                  ? isDarkMode ? 'rgba(16, 185, 129, 0.1)' : '#ECFDF5'
                  : isDarkMode ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2',
                borderWidth: 1,
                borderColor: requestedValidation.available ? '#10B981' : '#EF4444',
                borderRadius: 12,
                padding: 14,
                gap: 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <BootstrapIcon
                  name={requestedValidation.available ? 'shield-check' : 'exclamation-octagon-fill'}
                  size={16}
                  color={requestedValidation.available ? '#10B981' : '#EF4444'}
                />
                <Text
                  style={{
                    fontSize: 12.5,
                    fontWeight: '700',
                    color: requestedValidation.available ? (isDarkMode ? '#34D399' : '#065F46') : '#DC2626',
                  }}
                >
                  Availability Validation: {requestedValidation.available ? 'PASSED — Slot Confirmed Available' : 'CONFLICT DETECTED'}
                </Text>
              </View>

              <Text style={{ fontSize: 11.5, color: textMuted, lineHeight: 16 }}>
                {requestedValidation.available
                  ? `Workshop capacity on ${request.requested_date} (${request.requested_time_slot}) has open pit bays. Mon–Sat operating hours respected. Approving will automatically lock this slot and free up the previous slot.`
                  : requestedValidation.reason}
              </Text>
            </View>

            {/* TAB 1: Review & Approve Form */}
            {activeActionTab === 'review' && isPending && (
              <View style={{ gap: 12, paddingTop: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: textPrimary }}>
                  Operational Assignments & Notes
                </Text>

                <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                  <View style={{ flex: 1, minWidth: 200, gap: 4 }}>
                    <Text style={{ fontSize: 11.5, fontWeight: '600', color: textMuted }}>
                      Assigned Technician
                    </Text>
                    <TextInput
                      value={assignedMechanic}
                      onChangeText={setAssignedMechanic}
                      placeholder="e.g. Master Tech Marco"
                      placeholderTextColor={textMuted}
                      style={{
                        backgroundColor: inputBg,
                        borderWidth: 1,
                        borderColor: borderCol,
                        borderRadius: 8,
                        padding: 9,
                        fontSize: 12,
                        color: textPrimary,
                      }}
                    />
                  </View>

                  <View style={{ flex: 1, minWidth: 200, gap: 4 }}>
                    <Text style={{ fontSize: 11.5, fontWeight: '600', color: textMuted }}>
                      Designated Pit Bay
                    </Text>
                    <TextInput
                      value={assignedBay}
                      onChangeText={setAssignedBay}
                      placeholder="e.g. Bay 1 (Heavy Lift)"
                      placeholderTextColor={textMuted}
                      style={{
                        backgroundColor: inputBg,
                        borderWidth: 1,
                        borderColor: borderCol,
                        borderRadius: 8,
                        padding: 9,
                        fontSize: 12,
                        color: textPrimary,
                      }}
                    />
                  </View>
                </View>

                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 11.5, fontWeight: '600', color: textMuted }}>
                    Approval Notes for Customer (Optional)
                  </Text>
                  <TextInput
                    value={adminNotes}
                    onChangeText={setAdminNotes}
                    placeholder="e.g. Bay 1 has been allocated. Please arrive 10 minutes early."
                    placeholderTextColor={textMuted}
                    style={{
                      backgroundColor: inputBg,
                      borderWidth: 1,
                      borderColor: borderCol,
                      borderRadius: 8,
                      padding: 9,
                      fontSize: 12,
                      color: textPrimary,
                    }}
                  />
                </View>
              </View>
            )}

            {/* TAB 2: Suggest Alternative Form */}
            {activeActionTab === 'suggest_alternative' && isPending && (
              <View style={{ gap: 12, paddingTop: 4 }}>
                <View
                  style={{
                    backgroundColor: isDarkMode ? 'rgba(234, 88, 12, 0.1)' : '#FFF7ED',
                    borderRadius: 10,
                    padding: 12,
                    gap: 6,
                    borderWidth: 1,
                    borderColor: 'rgba(234, 88, 12, 0.3)',
                  }}
                >
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#EA580C' }}>
                    Propose Alternative Date & Time
                  </Text>
                  <Text style={{ fontSize: 11.5, color: textMuted }}>
                    The proposed alternative will be sent to the customer for review. The original appointment will remain active until the customer formally accepts.
                  </Text>
                </View>

                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 11.5, fontWeight: '600', color: textMuted }}>
                    Proposed Alternative Date
                  </Text>
                  <TextInput
                    type="date"
                    value={altDate}
                    onChangeText={setAltDate}
                    onChange={(e) => setAltDate(e.target.value)}
                    style={{
                      backgroundColor: inputBg,
                      borderWidth: 1,
                      borderColor: borderCol,
                      borderRadius: 8,
                      padding: 9,
                      fontSize: 12,
                      color: textPrimary,
                    }}
                  />
                </View>

                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 11.5, fontWeight: '600', color: textMuted }}>
                    Proposed Arrival Window
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {STANDARD_TIME_SLOTS.map((slot) => {
                      const isSelected = altTimeSlot === slot;
                      return (
                        <TouchableOpacity
                          key={slot}
                          onPress={() => setAltTimeSlot(slot)}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 6,
                            borderWidth: 1,
                            borderColor: isSelected ? '#EA580C' : borderCol,
                            backgroundColor: isSelected ? 'rgba(234, 88, 12, 0.16)' : inputBg,
                            cursor: 'pointer',
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: isSelected ? '700' : '500', color: isSelected ? '#EA580C' : textPrimary }}>
                            {slot}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 11.5, fontWeight: '600', color: textMuted }}>
                    Reason for Alternative Proposal
                  </Text>
                  <TextInput
                    value={altReason}
                    onChangeText={setAltReason}
                    placeholder="e.g. Master technician Marco is scheduled on this day."
                    placeholderTextColor={textMuted}
                    style={{
                      backgroundColor: inputBg,
                      borderWidth: 1,
                      borderColor: borderCol,
                      borderRadius: 8,
                      padding: 9,
                      fontSize: 12,
                      color: textPrimary,
                    }}
                  />
                </View>
              </View>
            )}

            {/* TAB 3: Reject Form */}
            {activeActionTab === 'reject' && isPending && (
              <View style={{ gap: 12, paddingTop: 4 }}>
                <View
                  style={{
                    backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2',
                    borderRadius: 10,
                    padding: 12,
                    gap: 6,
                    borderWidth: 1,
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                  }}
                >
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#DC2626' }}>
                    Decline Reschedule Request
                  </Text>
                  <Text style={{ fontSize: 11.5, color: textMuted }}>
                    Declining keeps the original appointment date ({request.original_date} {request.original_time_slot}) completely unchanged. You must provide a reason that will be sent to the customer.
                  </Text>
                </View>

                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 11.5, fontWeight: '600', color: textMuted }}>
                    Select Rejection Reason <Text style={{ color: '#DC2626' }}>*</Text>
                  </Text>
                  {ADMIN_RESCHEDULE_REASONS.map((r) => {
                    const isSelected = rejectionReason === r;
                    return (
                      <TouchableOpacity
                        key={r}
                        onPress={() => setRejectionReason(r)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                          paddingVertical: 6,
                          paddingHorizontal: 8,
                          borderRadius: 6,
                          backgroundColor: isSelected ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
                          cursor: 'pointer',
                        }}
                      >
                        <BootstrapIcon
                          name={isSelected ? 'record-circle-fill' : 'circle'}
                          size={13}
                          color={isSelected ? '#DC2626' : textMuted}
                        />
                        <Text style={{ fontSize: 12, color: textPrimary }}>{r}</Text>
                      </TouchableOpacity>
                    );
                  })}

                  {rejectionReason === 'Other operational issue' && (
                    <TextInput
                      value={customRejectionReason}
                      onChangeText={setCustomRejectionReason}
                      placeholder="Specify custom reason..."
                      placeholderTextColor={textMuted}
                      style={{
                        backgroundColor: inputBg,
                        borderWidth: 1,
                        borderColor: borderCol,
                        borderRadius: 8,
                        padding: 9,
                        fontSize: 12,
                        color: textPrimary,
                        marginTop: 4,
                      }}
                    />
                  )}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer Actions */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 22,
              paddingVertical: 14,
              borderTopWidth: 1,
              borderTopColor: borderCol,
              backgroundColor: isDarkMode ? '#15191E' : '#FAFAFA',
            }}
          >
            <TouchableOpacity
              onPress={onClose}
              disabled={isProcessing}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 9,
                borderRadius: 10,
                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#E2E8F0',
                cursor: 'pointer',
              }}
            >
              <Text style={{ fontSize: 12.5, fontWeight: '600', color: textPrimary }}>
                Close
              </Text>
            </TouchableOpacity>

            {isPending && (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {activeActionTab === 'review' && (
                  <TouchableOpacity
                    onPress={handleApprove}
                    disabled={isProcessing || !requestedValidation.available}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      paddingHorizontal: 18,
                      paddingVertical: 9,
                      borderRadius: 10,
                      backgroundColor: requestedValidation.available ? '#10B981' : '#94A3B8',
                      cursor: requestedValidation.available ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {isProcessing && <ActivityIndicator size="small" color="#FFFFFF" />}
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>
                      Approve & Update Schedule
                    </Text>
                  </TouchableOpacity>
                )}

                {activeActionTab === 'suggest_alternative' && (
                  <TouchableOpacity
                    onPress={handleSuggestAlternative}
                    disabled={isProcessing || !altValidation.available}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      paddingHorizontal: 18,
                      paddingVertical: 9,
                      borderRadius: 10,
                      backgroundColor: '#EA580C',
                      cursor: altValidation.available ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {isProcessing && <ActivityIndicator size="small" color="#FFFFFF" />}
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>
                      Send Proposal to Customer
                    </Text>
                  </TouchableOpacity>
                )}

                {activeActionTab === 'reject' && (
                  <TouchableOpacity
                    onPress={handleReject}
                    disabled={isProcessing}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      paddingHorizontal: 18,
                      paddingVertical: 9,
                      borderRadius: 10,
                      backgroundColor: '#DC2626',
                      cursor: 'pointer',
                    }}
                  >
                    {isProcessing && <ActivityIndicator size="small" color="#FFFFFF" />}
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>
                      Decline & Keep Original
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

