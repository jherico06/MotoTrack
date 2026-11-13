/**
 * Admin Booking Details & Work Order Command Center.
 * Guided fulfillment workflow: Booking Status -> Workflow Stepper -> Next Action -> Information Sections -> Activity Timeline.
 * Mirrors the executive layout and control flow of the Order Details Management Modal.
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
import { BootstrapIcon } from '../common/BootstrapIcon.jsx';
import { getThemeTokens } from '../../styles/theme.js';
import ServiceQuotationPanel from './ServiceQuotationPanel.jsx';
import PickupQrScannerPanel from './PickupQrScannerPanel.jsx';
import { garageService } from '../../services/bookings/garageService.js';
import { rescheduleService, ADMIN_RESCHEDULE_REASONS, STANDARD_TIME_SLOTS } from '../../services/bookings/rescheduleService.js';
import { serviceQuotationService } from '../../services/bookings/serviceQuotationService.js';
import { systemSettingsService } from '../../services/system/systemSettingsService.js';
import { getOptimizedImageUrl } from '../../utils/imageUrl.js';
import { isPmsFixedBooking } from '../../utils/pmsCcPricing.js';
import {
  FLEX_BOOKING_STATUS,
  normalizeBookingStatus,
  canTransition,
  statusLabel,
  formatPhp,
  bookingQuotationTotal,
  bookingPaymentStatus,
} from '../../utils/bookingWorkflow.js';

// ── 1. LIFECYCLE STEPS & STATUS HELPERS ──

export const DEFAULT_PIT_MECHANICS = [
  {
    id: 'mech-01',
    name: 'Master Tech Marco De Guzman',
    shortName: 'Marco',
    specialization: 'Diagnostic & Engine Overhaul',
    experience: '8+ Years Master Tech',
    bay: 'Bay 1 (Master Diagnostic Cell)',
    rating: 4.9,
    status: 'Available',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'mech-02',
    name: 'Senior Tech Bryan Santos',
    shortName: 'Bryan',
    specialization: 'CVT Tuning & Major PMS',
    experience: '6 Years Track & Street Specialist',
    bay: 'Bay 2 (Express PMS Bay)',
    rating: 4.8,
    status: 'Available',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'mech-03',
    name: 'Tech Arnel Villanueva',
    shortName: 'Arnel',
    specialization: 'ECU Diagnostics & Electrical',
    experience: '5 Years High-Tech Diagnostics',
    bay: 'Bay 3 (Precision Bay)',
    rating: 4.9,
    status: 'Available',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
  },
];

export const BOOKING_FULFILLMENT_STEPS = [
  {
    key: 'pending',
    status: FLEX_BOOKING_STATUS.PENDING_REVIEW,
    label: 'Review',
    shortLabel: 'Review',
  },
  {
    key: 'in_service',
    status: FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS,
    label: 'In bay',
    shortLabel: 'In bay',
  },
  {
    key: 'complete',
    status: FLEX_BOOKING_STATUS.COMPLETED,
    label: 'Complete',
    shortLabel: 'Complete',
  },
];

const STEP_INDEX = {
  [FLEX_BOOKING_STATUS.PENDING_REVIEW]: 0,
  Pending: 0,
  'Pending Review': 0,
  [FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT]: 0,
  [FLEX_BOOKING_STATUS.APPROVED]: 0,
  [FLEX_BOOKING_STATUS.RESERVED]: 0,
  Reserved: 0,
  [FLEX_BOOKING_STATUS.CONFIRMED]: 0,
  [FLEX_BOOKING_STATUS.SCHEDULED]: 0,
  Confirmed: 0,
  Scheduled: 0,
  [FLEX_BOOKING_STATUS.UNDER_INSPECTION]: 1,
  [FLEX_BOOKING_STATUS.ESTIMATE_SUBMITTED]: 1,
  [FLEX_BOOKING_STATUS.QUOTATION_SENT]: 1,
  [FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL]: 1,
  [FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS]: 1,
  [FLEX_BOOKING_STATUS.ADDITIONAL_APPROVAL_REQUIRED]: 1,
  'In Progress': 1,
  'In Service': 1,
  [FLEX_BOOKING_STATUS.SERVICE_COMPLETED]: 2,
  [FLEX_BOOKING_STATUS.FOR_FINAL_BILLING]: 2,
  [FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT]: 2,
  [FLEX_BOOKING_STATUS.FULLY_PAID]: 2,
  [FLEX_BOOKING_STATUS.READY_FOR_PICKUP]: 2,
  'Service Done': 2,
  [FLEX_BOOKING_STATUS.COMPLETED]: 2,
  Completed: 2,
  Paid: 2,
  Closed: 2,
  [FLEX_BOOKING_STATUS.CANCELLED]: -1,
  [FLEX_BOOKING_STATUS.REJECTED]: -1,
  [FLEX_BOOKING_STATUS.CUSTOMER_DECLINED]: -1,
  [FLEX_BOOKING_STATUS.BOOKING_EXPIRED]: -1,
};

function getBookingStepStates(status) {
  const norm = normalizeBookingStatus(status);
  const currentStepIndex = STEP_INDEX[norm] != null ? STEP_INDEX[norm] : (STEP_INDEX[status] ?? 0);
  const currentIdx = STEP_INDEX[norm] != null ? STEP_INDEX[norm] : (STEP_INDEX[status] ?? 0);
  const isCancelled =
    norm === FLEX_BOOKING_STATUS.CANCELLED ||
    norm === FLEX_BOOKING_STATUS.REJECTED ||
    norm === FLEX_BOOKING_STATUS.CUSTOMER_DECLINED ||
    norm === FLEX_BOOKING_STATUS.BOOKING_EXPIRED;

  return BOOKING_FULFILLMENT_STEPS.map((step, idx) => {
    let state = 'upcoming';
    if (isCancelled) {
      state = idx === 0 ? 'done' : 'failed';
    } else if (currentIdx == null || currentIdx < 0) {
      state = 'upcoming';
    } else if (idx < currentIdx) {
      state = 'done';
    } else if (idx === currentIdx) {
      state = 'current';
    } else {
      state = 'upcoming';
    }
    return { ...step, state, index: idx };
  });
}

function getBookingStatusExplanation(status, booking) {
  const norm = normalizeBookingStatus(status);
  const currentStepIndex = STEP_INDEX[norm] != null ? STEP_INDEX[norm] : (STEP_INDEX[status] ?? 0);
  const basePrice = Number(booking?.pricePhp || booking?.labor_subtotal || 2500);
  const rawBookingPercent = Number(
    booking?.downpayment_percent ??
    booking?.downpaymentPercent ??
    booking?.downpayment_percentage
  );
  const rawDp = Number(booking?.downpayment_amount ?? booking?.amount_paid);
  const rawTotal = Number(booking?.final_service_total || booking?.pricePhp || booking?.labor_subtotal || basePrice);
  const dpPercent = Number.isFinite(rawBookingPercent) && rawBookingPercent > 0
    ? rawBookingPercent
    : (rawTotal > 0 && rawDp > 0 ? Math.round((rawDp / rawTotal) * 100) : Number(systemSettingsService.getSettings()?.downpaymentPercent || 20));
  const dpAmount = Number(
    booking?.downpayment_amount !== undefined && booking?.downpayment_amount !== null
      ? booking.downpayment_amount
      : Math.round(basePrice * (dpPercent / 100))
  );

  switch (norm) {
    case FLEX_BOOKING_STATUS.PENDING_REVIEW:
      return 'Customer submitted a new appointment request. Review requested services and approve to request the required downpayment or decline with a reason.';
    case FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT:
    case FLEX_BOOKING_STATUS.APPROVED:
      return `Booking is approved. Waiting for customer to settle the ${dpPercent}% downpayment (₱${dpAmount.toLocaleString()}) to confirm their bay schedule.`;
    case FLEX_BOOKING_STATUS.RESERVED:
      return `Downpayment of ₱${dpAmount.toLocaleString()} has been paid and verified. The pit bay slot is reserved for the customer pending technician allocation / bay check-in.`;
    case FLEX_BOOKING_STATUS.CONFIRMED:
      return 'Downpayment has been verified. The appointment date and arrival time window are confirmed for the customer.';
    case FLEX_BOOKING_STATUS.SCHEDULED:
      return 'Appointment is officially scheduled on the garage calendar. When the motorcycle arrives at the workshop, move it to the service bay to begin work.';
    case FLEX_BOOKING_STATUS.UNDER_INSPECTION:
      return 'Technicians are performing diagnostic check and physical inspection of the motorcycle to confirm required labor and replacement parts.';
    case FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS:
      return 'Motorcycle is currently mounted in the service bay with technicians executing scheduled maintenance and repairs.';
    case FLEX_BOOKING_STATUS.SERVICE_COMPLETED:
    case FLEX_BOOKING_STATUS.FOR_FINAL_BILLING:
      return 'All service items are completed. Review final labor, replacement parts, and remaining customer balance before releasing.';
    case FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT:
      return 'Final service invoice is prepared. Awaiting collection of remaining balance prior to customer motorcycle release.';
    case FLEX_BOOKING_STATUS.READY_FOR_PICKUP:
      return 'Motorcycle service and road test verification are completed. Customer has been notified that the vehicle is ready for release.';
    case FLEX_BOOKING_STATUS.COMPLETED:
      return 'Work order fulfilled, bike released to customer, and full payment settled.';
    case FLEX_BOOKING_STATUS.CANCELLED:
      return 'Booking was cancelled.';
    case FLEX_BOOKING_STATUS.REJECTED:
      return 'Booking request was declined by workshop administrator.';
    default:
      return 'Active workshop service request.';
  }
}
function getBookingStatusTone(status, isDark = false) {
  const norm = normalizeBookingStatus(status);
  switch (norm) {
    case FLEX_BOOKING_STATUS.PENDING_REVIEW:
    case FLEX_BOOKING_STATUS.NEEDS_INFORMATION:
      return {
        bg: isDark ? 'rgba(217, 119, 6, 0.15)' : '#FFFBEB',
        border: isDark ? 'rgba(217, 119, 6, 0.35)' : '#FDE68A',
        color: isDark ? '#E0B35C' : '#B45309',
        icon: 'clock-fill',
      };
    case FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT:
    case FLEX_BOOKING_STATUS.APPROVED:
      return {
        bg: isDark ? 'rgba(234, 88, 12, 0.15)' : '#FFF7ED',
        border: isDark ? 'rgba(234, 88, 12, 0.35)' : '#FED7AA',
        color: isDark ? '#FB923C' : '#C2410C',
        icon: 'credit-card-2-front-fill',
      };
    case FLEX_BOOKING_STATUS.RESERVED:
      return {
        bg: isDark ? 'rgba(16, 185, 129, 0.16)' : '#ECFDF5',
        border: isDark ? 'rgba(16, 185, 129, 0.35)' : '#A7F3D0',
        color: isDark ? '#34D399' : '#047857',
        icon: 'bookmark-check-fill',
      };
    case FLEX_BOOKING_STATUS.CONFIRMED:
    case FLEX_BOOKING_STATUS.SCHEDULED:
      return {
        bg: isDark ? 'rgba(2, 132, 199, 0.15)' : '#F0F9FF',
        border: isDark ? 'rgba(2, 132, 199, 0.35)' : '#BAE6FD',
        color: isDark ? '#38BDF8' : '#0284C7',
        icon: 'calendar-check-fill',
      };
    case FLEX_BOOKING_STATUS.UNDER_INSPECTION:
    case FLEX_BOOKING_STATUS.ESTIMATE_SUBMITTED:
    case FLEX_BOOKING_STATUS.QUOTATION_SENT:
      return {
        bg: isDark ? 'rgba(124, 58, 237, 0.15)' : '#F5F3FF',
        border: isDark ? 'rgba(124, 58, 237, 0.35)' : '#DDD6FE',
        color: isDark ? '#C4B5FD' : '#6D28D9',
        icon: 'search',
      };
    case FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS:
    case FLEX_BOOKING_STATUS.ADDITIONAL_APPROVAL_REQUIRED:
      return {
        bg: isDark ? 'rgba(37, 99, 235, 0.15)' : '#EFF6FF',
        border: isDark ? 'rgba(37, 99, 235, 0.35)' : '#BFDBFE',
        color: isDark ? '#60A5FA' : '#1D4ED8',
        icon: 'gear-wide-connected',
      };
    case FLEX_BOOKING_STATUS.SERVICE_COMPLETED:
    case FLEX_BOOKING_STATUS.FOR_FINAL_BILLING:
    case FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT:
      return {
        bg: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
        border: isDark ? 'rgba(16, 185, 129, 0.35)' : '#A7F3D0',
        color: isDark ? '#34D399' : '#059669',
        icon: 'receipt',
      };
    case FLEX_BOOKING_STATUS.READY_FOR_PICKUP:
      return {
        bg: isDark ? 'rgba(13, 148, 136, 0.15)' : '#F0FDFA',
        border: isDark ? 'rgba(13, 148, 136, 0.35)' : '#99F6E4',
        color: isDark ? '#2DD4BF' : '#0D9488',
        icon: 'qr-code-scan',
      };
    case FLEX_BOOKING_STATUS.COMPLETED:
    case FLEX_BOOKING_STATUS.FULLY_PAID:
      return {
        bg: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
        border: isDark ? 'rgba(16, 185, 129, 0.35)' : '#A7F3D0',
        color: isDark ? '#34D399' : '#047857',
        icon: 'check-circle-fill',
      };
    case FLEX_BOOKING_STATUS.REJECTED:
    case FLEX_BOOKING_STATUS.CANCELLED:
    case FLEX_BOOKING_STATUS.CUSTOMER_DECLINED:
    case FLEX_BOOKING_STATUS.BOOKING_EXPIRED:
      return {
        bg: isDark ? 'rgba(220, 38, 38, 0.15)' : '#FEF2F2',
        border: isDark ? 'rgba(220, 38, 38, 0.35)' : '#FECACA',
        color: isDark ? '#F87171' : '#DC2626',
        icon: 'x-circle-fill',
      };
    default:
      return {
        bg: isDark ? 'rgba(100, 116, 139, 0.2)' : '#F8FAFC',
        border: isDark ? 'rgba(100, 116, 139, 0.35)' : '#E2E8F0',
        color: isDark ? '#94A3B8' : '#475569',
        icon: 'info-circle-fill',
      };
  }
}

function resolveBookingPrimaryAction(booking) {
  if (!booking) return null;
  const norm = normalizeBookingStatus(booking.status);
  const isDpPaid =
    booking.downpayment_status === 'Paid' ||
    booking.downpayment_status === 'Settled' ||
    booking.downpayment_paid === true ||
    booking.deposit_paid === true ||
    Number(booking.amount_paid || 0) > 0 ||
    booking.payment_status === 'DOWNPAYMENT_PAID' ||
    booking.payment_status === 'FULLY_PAID' ||
    Boolean(booking.downpayment_paid_at) ||
    !booking.is_walk_in;
  const basePrice = Number(booking.pricePhp || booking.labor_subtotal || 2500);
  const dpAmount = Number(
    booking.downpayment_amount !== undefined ? booking.downpayment_amount : Math.round(basePrice * 0.2)
  );
  const quoteTotal = bookingQuotationTotal(booking);
  const finalTotal = Number(booking.final_service_total || quoteTotal || basePrice);
  const remaining = Math.max(0, finalTotal - (isDpPaid ? dpAmount : 0));

  if (
    norm === FLEX_BOOKING_STATUS.CANCELLED ||
    norm === FLEX_BOOKING_STATUS.REJECTED ||
    norm === FLEX_BOOKING_STATUS.BOOKING_EXPIRED
  ) {
    return {
      kind: 'none',
      label: null,
      disabled: true,
      blockedReason:
        norm === FLEX_BOOKING_STATUS.REJECTED
          ? booking.rejection_reason
            ? `Booking declined: "${booking.rejection_reason}"`
            : 'This booking was declined.'
          : 'This booking has been cancelled and cannot proceed through fulfillment.',
    };
  }

  if (norm === FLEX_BOOKING_STATUS.COMPLETED) {
    return {
      kind: 'none',
      label: null,
      disabled: true,
      completeMessage: 'Service booking process is complete. Motorcycle released to owner.',
    };
  }

  if (
    norm === FLEX_BOOKING_STATUS.PENDING_REVIEW ||
    norm === FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT ||
    norm === FLEX_BOOKING_STATUS.APPROVED ||
    norm === FLEX_BOOKING_STATUS.RESERVED
  ) {
    return {
      kind: 'approve',
      label: 'Approve booking',
      icon: 'check2-circle',
      hint: 'Customer has submitted their appointment. Review requested services and approve to confirm.',
      needsConfirm: true,
      confirmTitle: 'Approve Service Appointment?',
      confirmBody: 'Approve this appointment and confirm the scheduled time slot for the customer?',
      secondaryReject: true,
      secondaryReschedule: true,
    };
  }

  if (norm === FLEX_BOOKING_STATUS.CONFIRMED || norm === FLEX_BOOKING_STATUS.SCHEDULED) {
    return {
      kind: 'start_service',
      label: 'Start Service in Bay',
      icon: 'play-circle-fill',
      hint: 'Motorcycle and customer have arrived at the garage. Move motorcycle to bay to begin work.',
      needsConfirm: true,
      confirmTitle: 'Start Service in Bay?',
      confirmBody: 'Confirm vehicle has arrived and technician is starting work in the service bay.',
      secondaryReschedule: true,
      secondaryInspection: !isPmsFixedBooking(booking),
    };
  }

  if (norm === FLEX_BOOKING_STATUS.UNDER_INSPECTION) {
    return {
      kind: 'complete_inspection',
      label: 'Complete Inspection & Start Service',
      icon: 'check2-circle',
      hint: 'Inspection findings recorded. Proceed with service work in the bay.',
      needsConfirm: true,
      confirmTitle: 'Complete Inspection?',
      confirmBody: 'Proceed with approved service items in the service bay?',
    };
  }

  if (
    norm === FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS ||
    norm === FLEX_BOOKING_STATUS.ADDITIONAL_APPROVAL_REQUIRED
  ) {
    return {
      kind: 'complete_service',
      label: 'Mark Service Completed',
      icon: 'flag-fill',
      hint: 'All mechanical repairs and service procedures are finished. Finalize work order and calculate balance.',
      needsConfirm: true,
      confirmTitle: 'Mark Service Completed?',
      confirmBody: 'Confirm all service tasks are finished. This will calculate the final billing.',
    };
  }

  if (
    norm === FLEX_BOOKING_STATUS.SERVICE_COMPLETED ||
    norm === FLEX_BOOKING_STATUS.FOR_FINAL_BILLING ||
    norm === FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT
  ) {
    if (remaining > 0) {
      return {
        kind: 'finalize_bill',
        label: 'Collect Balance & Issue Pickup QR',
        icon: 'receipt',
        hint: `Remaining balance of ₱${remaining.toLocaleString()} due from customer. Verify settlement to generate pickup QR.`,
        infoBanner: `Customer has an outstanding balance of ₱${remaining.toLocaleString()} for completed services.`,
        needsConfirm: true,
        confirmTitle: 'Finalize Billing & Record Balance?',
        confirmBody: `Confirm remaining balance of ₱${remaining.toLocaleString()} is settled and generate customer pickup token?`,
      };
    }
    return {
      kind: 'generate_qr',
      label: 'Generate Pickup QR Token',
      icon: 'qr-code',
      hint: 'Service is completed and fully paid. Generate pickup verification QR code.',
      needsConfirm: false,
    };
  }

  if (norm === FLEX_BOOKING_STATUS.READY_FOR_PICKUP) {
    return {
      kind: 'verify_pickup',
      label: 'Complete Handover & Release Vehicle',
      icon: 'check-circle-fill',
      hint: 'Customer is on-site to claim motorcycle. Verify handover and complete work order.',
      needsConfirm: true,
      confirmTitle: 'Release Motorcycle to Owner?',
      confirmBody:
        'Confirm motorcycle has been handed over to the customer in verified operational condition.',
    };
  }

  return {
    kind: 'none',
    label: null,
    disabled: true,
  };
}

function buildBookingActivity(booking) {
  if (!booking) return [];
  const events = [];
  const add = (id, label, detail, date, icon = 'circle-fill', tone = '#64748B') => {
    if (date) {
      events.push({ id, label, detail, date, icon, tone });
    }
  };

  add(
    'created',
    'Booking Request Placed',
    `Submitted by ${booking.customer_name || 'Customer'}`,
    booking.created_at || booking.createdAt,
    'calendar-plus-fill',
    '#0284C7'
  );

  if (booking.approved_at) {
    add(
      'approved',
      'Booking Approved',
      'Approved by admin · Downpayment requested',
      booking.approved_at,
      'check-circle-fill',
      '#059669'
    );
  }

  if (
    booking.downpayment_paid ||
    booking.downpayment_status === 'Paid' ||
    Number(booking.amount_paid || 0) > 0
  ) {
    add(
      'dp_paid',
      'Downpayment Verified',
      `${(booking.downpayment_percent ?? (booking.final_service_total && booking.downpayment_amount ? Math.round((booking.downpayment_amount / booking.final_service_total) * 100) : (systemSettingsService.getSettings()?.downpaymentPercent || 20)))}% Downpayment (₱${(booking.downpayment_amount || 0).toLocaleString()}) paid via ${booking.downpayment_method || 'Online (GCash / Card)'}`,
      booking.downpayment_paid_at || booking.approved_at,
      'shield-check',
      '#059669'
    );
  }

  if (booking.scheduled_at || booking.appointment_date) {
    add(
      'scheduled',
      'Bay Appointment Confirmed',
      `Scheduled for ${booking.preferred_date || booking.appointment_date} · ${booking.preferred_time || booking.time_slot || '10:30 AM'}`,
      booking.scheduled_at,
      'calendar-check-fill',
      '#0284C7'
    );
  }

  if (booking.inspection_started_at) {
    add(
      'inspection',
      'Vehicle Inspection Recorded',
      booking.inspection_notes ? `Notes: ${booking.inspection_notes}` : 'Initial diagnostic recorded',
      booking.inspection_started_at,
      'search',
      '#7C3AED'
    );
  }

  if (booking.service_started_at) {
    add(
      'in_service',
      'Service Started in Bay',
      'Motorcycle mounted on service lift',
      booking.service_started_at,
      'gear-wide-connected',
      '#2563EB'
    );
  }

  if (booking.service_completed_at) {
    add(
      'completed_work',
      'Service Work Completed',
      `Final service bill: ₱${booking.final_service_total || booking.estimated_service_total || 0}`,
      booking.service_completed_at,
      'receipt',
      '#059669'
    );
  }

  if (booking.pickup_token_generated_at || booking.pickup_qr_code) {
    add(
      'pickup_ready',
      'Pickup QR Token Issued',
      'Customer notified motorcycle is ready for collection',
      booking.pickup_token_generated_at,
      'qr-code',
      '#0D9488'
    );
  }

  if (booking.completed_at || normalizeBookingStatus(booking.status) === FLEX_BOOKING_STATUS.COMPLETED) {
    add(
      'handover',
      'Vehicle Released to Owner',
      'Customer verified handover · Work order completed',
      booking.completed_at,
      'check-circle-fill',
      '#059669'
    );
  }

  if (booking.rejection_reason || normalizeBookingStatus(booking.status) === FLEX_BOOKING_STATUS.REJECTED) {
    add(
      'rejected',
      'Booking Declined',
      booking.rejection_reason || 'Declined by admin',
      booking.updated_at,
      'x-circle-fill',
      '#DC2626'
    );
  }

  if (normalizeBookingStatus(booking.status) === FLEX_BOOKING_STATUS.CANCELLED) {
    add(
      'cancelled',
      'Booking Cancelled',
      booking.cancellation_reason || 'Cancelled',
      booking.updated_at,
      'x-circle-fill',
      '#DC2626'
    );
  }

  return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

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

function normalizeLineItems(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(Boolean).map((r, i) => {
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

// ── 2. REUSABLE SECTION & DISPLAY COMPONENTS ──

function Section({ title, right, children, tokens, isDark, style }) {
  return (
    <View
      style={[
        {
          backgroundColor: isDark ? tokens.bgSub || tokens.bgCard : '#FFFFFF',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: tokens.border || '#E2E8F0',
          padding: 14,
          marginBottom: 12,
        },
        style,
      ]}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: children ? 12 : 0,
          gap: 8,
        }}
      >
        <Text
          style={{
            fontSize: 11.5,
            fontWeight: '600',
            color: tokens.textMuted || '#64748B',
            textTransform: 'uppercase',
            letterSpacing: 0.55,
          }}
        >
          {title}
        </Text>
        {right || null}
      </View>
      {children}
    </View>
  );
}

function WorkflowStepper({ status, tokens, isDark }) {
  const steps = useMemo(() => getBookingStepStates(status), [status]);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        paddingVertical: 2,
      }}
    >
      {steps.map((step, idx) => {
        const done = step.state === 'done';
        const current = step.state === 'current';
        const failed = step.state === 'failed';

        // Matching BookingProgressIndicator.jsx exactly:
        // Active: #EA580C orange circle with white number
        // Completed: #1E2227 charcoal circle with white check
        // Upcoming: #F4F4F5 with #E4E4E7 border and #71717A text
        const circleBg = current
          ? '#EA580C'
          : done
            ? '#1E2227'
            : failed
              ? '#DC2626'
              : isDark
                ? tokens.bgElevated
                : '#F4F4F5';

        const circleBorder = current
          ? '#EA580C'
          : done
            ? '#1E2227'
            : failed
              ? '#DC2626'
              : isDark
                ? tokens.border
                : '#E4E4E7';

        const numColor = current || done || failed
          ? '#FFFFFF'
          : isDark
            ? tokens.textMuted
            : '#71717A';

        const labelColor = current
          ? (isDark ? '#F97316' : '#18181B')
          : done
            ? (isDark ? '#F1F5F9' : '#27272A')
            : failed
              ? '#DC2626'
              : isDark
                ? tokens.textMuted
                : '#71717A';

        return (
          <React.Fragment key={step.key}>
            {/* Inline Node: Circle and Label side-by-side matching BookingProgressIndicator */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 }}>
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: circleBg,
                  borderWidth: 1,
                  borderColor: circleBorder,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {done ? (
                  <BootstrapIcon name="check" size={13} color="#FFFFFF" />
                ) : failed ? (
                  <BootstrapIcon name="x" size={13} color="#FFFFFF" />
                ) : (
                  <Text
                    style={{
                      fontSize: 11.5,
                      fontWeight: '700',
                      color: numColor,
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {idx + 1}
                  </Text>
                )}
              </View>
              <Text
                style={{
                  fontSize: 12.5,
                  fontWeight: current ? '700' : done ? '600' : '500',
                  color: labelColor,
                }}
              >
                {step.shortLabel}
              </Text>
            </View>

            {/* Connecting Divider Line matching BookingProgressIndicator */}
            {idx < steps.length - 1 && (
              <View
                style={{
                  flex: 1,
                  height: 1.5,
                  backgroundColor: done ? '#1E2227' : (isDark ? tokens.border : '#E4E4E7'),
                  marginHorizontal: 12,
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

function InfoGrid({ rows, tokens }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {rows.map((r) => (
        <View key={r.label} style={{ minWidth: 140, flex: 1 }}>
          <Text
            style={{
              fontSize: 10.5,
              fontWeight: '700',
              color: tokens.textMuted || '#64748B',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {r.label}
          </Text>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '700',
              color: r.highlight ? '#EA580C' : tokens.textPrimary || '#0F172A',
              marginTop: 3,
            }}
          >
            {r.value || '—'}
          </Text>
        </View>
      ))}
    </View>
  );
}

function InfoRow({ icon, label, value, tokens }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text
        style={{
          fontSize: 10.5,
          fontWeight: '700',
          color: tokens.textMuted || '#64748B',
          textTransform: 'uppercase',
          marginBottom: 3,
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 7 }}>
        <BootstrapIcon name={icon} size={13} color={tokens.textMuted || '#64748B'} style={{ marginTop: 2 }} />
        <Text
          style={{
            fontSize: 13,
            fontWeight: '600',
            color: tokens.textPrimary || '#0F172A',
            flex: 1,
            lineHeight: 18,
          }}
        >
          {value || '—'}
        </Text>
      </View>
    </View>
  );
}

function SummaryLine({ label, value, tokens, valueColor, isBold = false }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
      <Text
        style={{ fontSize: 12.5, color: tokens.textMuted || '#64748B', fontWeight: isBold ? '600' : '400' }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 12.5,
          fontWeight: isBold ? '700' : '600',
          color: valueColor || tokens.textPrimary || '#0F172A',
        }}
      >
        {value}
      </Text>
    </View>
  );
}

// ── 3. MAIN INNER PANEL ──

const DetailsThemeContext = createContext(null);

function AdminBookingDetailsPanelInner({
  booking,
  onClose = () => { },
  onDeleteBooking,
  onToast = () => { },
  onBookingUpdated = () => { },
  showConfirm,
  isDesktop = true,
}) {
  const { t: tokens, isDark, styles } = useContext(DetailsThemeContext);
  const [busy, setBusy] = useState(false);
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [showRescheduleBox, setShowRescheduleBox] = useState(false);
  const [activeTab, setActiveTab] = useState('none'); // 'none' | 'quotation' | 'inspection' | 'scanner'

  const [rejectReason, setRejectReason] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState(
    booking?.preferred_date || booking?.appointment_date || ''
  );
  const [rescheduleTime, setRescheduleTime] = useState(booking?.preferred_time || booking?.time_slot || '');

  const [insp, setInsp] = useState({
    findings: booking?.inspection_notes || '',
    condition: '',
    recommended: '',
    recommendedParts: '',
    estimatedHours: String(booking?.estimated_labor_hours || ''),
  });
  const [progressNotes, setProgressNotes] = useState(booking?.service_notes || '');
  const [actualHours, setActualHours] = useState(
    booking?.actual_labor_hours != null ? String(booking.actual_labor_hours) : ''
  );

  const [mechanicsList, setMechanicsList] = useState(() => {
    const fromStorage = garageService.getMechanics();
    return Array.isArray(fromStorage) && fromStorage.length > 0 ? fromStorage : DEFAULT_PIT_MECHANICS;
  });
  const [selectedMechanic, setSelectedMechanic] = useState(null);
  const [allBookings, setAllBookings] = useState(() => garageService.getLocalBookings());

  useEffect(() => {
    garageService.fetchMechanics({ force: true })
      .then((mechs) => {
        if (Array.isArray(mechs) && mechs.length > 0) setMechanicsList(mechs);
      })
      .catch(() => {});
    garageService.getAllBookings()
      .then((bks) => {
        if (Array.isArray(bks) && bks.length > 0) setAllBookings(bks);
      })
      .catch(() => {});
  }, [booking?.booking_id, booking?.id]);

  const preferredDate = booking?.preferred_date || booking?.appointment_date || booking?.date || '';
  const preferredTime = booking?.preferred_time || booking?.time_slot || booking?.time || '09:00 AM';

  const displayMechanics = useMemo(() => {
    const list = mechanicsList && mechanicsList.length > 0 ? mechanicsList : DEFAULT_PIT_MECHANICS;
    return list.map((mech) => {
      const mechName = mech.name || mech.shortName || '';
      const mechId = mech.id;
      const conflict = allBookings.find((b) => {
        const bId = b.booking_id || b.id;
        const curId = booking?.booking_id || booking?.id;
        if (bId === curId) return false;
        const bStatus = normalizeBookingStatus(b.status);
        if (
          bStatus === FLEX_BOOKING_STATUS.CANCELLED ||
          bStatus === FLEX_BOOKING_STATUS.REJECTED ||
          bStatus === FLEX_BOOKING_STATUS.COMPLETED
        ) {
          return false;
        }
        const bMech = b.mechanic || '';
        const bMechId = b.mechanic_id;
        const isSameMech =
          (bMechId && mechId && String(bMechId) === String(mechId)) ||
          (mechName && bMech && (bMech.toLowerCase().includes(mechName.toLowerCase().split(' ')[0]) || mechName.toLowerCase().includes(bMech.toLowerCase().split(' ')[0])));
        if (!isSameMech) return false;

        const bDate = String(b.preferred_date || b.appointment_date || b.date || '').split('T')[0];
        const reqDate = String(preferredDate).split('T')[0];
        if (bDate && reqDate && bDate !== reqDate) return false;

        const bTime = String(b.preferred_time || b.time_slot || b.time || '').toLowerCase();
        const reqTime = String(preferredTime).toLowerCase();
        const timeConflict = bTime && reqTime && (bTime.includes(reqTime.slice(0, 5)) || reqTime.includes(bTime.slice(0, 5)));
        return Boolean(timeConflict);
      });

      const isCurrentAssigned = Boolean(
        booking?.mechanic &&
        (booking.mechanic === mechName || booking.mechanic.includes(mech.shortName || mechName))
      );

      return {
        ...mech,
        isAvailable: !conflict,
        isCurrentAssigned,
        conflictBooking: conflict ? (conflict.booking_id || conflict.id) : null,
      };
    });
  }, [mechanicsList, allBookings, preferredDate, preferredTime, booking?.booking_id, booking?.id, booking?.mechanic]);

  const handleAssignMechanic = async (mech) => {
    if (!mech || !bookingId) return;
    await withBusy(async () => {
      await garageService.updateBooking(bookingId, {
        mechanic: mech.name,
        mechanic_id: mech.id,
        mechanic_assigned_at: new Date().toISOString(),
        mechanic_assignment_status: 'assigned',
        current_stage: `Appointment Confirmed • Assigned to ${mech.name}`,
      });
      onToast?.(`✓ Assigned to ${mech.name}`);
      await refresh();
    });
  };

  const [sysSettings, setSysSettings] = useState(() => systemSettingsService.getSettings());

  useEffect(() => {
    const unsub = systemSettingsService.subscribe((updated) => {
      if (updated) setSysSettings(updated);
    });
    return unsub;
  }, []);

  const adminPitPercent = useMemo(() => {
    if (sysSettings?.requireDownpayment === false) return 0;
    const p = Number(sysSettings?.downpaymentPercent);
    return Number.isFinite(p) && p >= 0 && p <= 100 ? p : 20;
  }, [sysSettings]);

  const downpaymentPercent = useMemo(() => {
    const rawBookingPercent = Number(
      booking?.downpayment_percent ??
      booking?.downpaymentPercent ??
      booking?.downpayment_percentage
    );
    if (Number.isFinite(rawBookingPercent) && rawBookingPercent > 0 && rawBookingPercent <= 100) {
      return rawBookingPercent;
    }
    const rawDp = Number(booking?.downpayment_amount ?? booking?.amount_paid);
    const rawTotal = Number(booking?.final_service_total || booking?.pricePhp || booking?.labor_subtotal || 0);
    if (rawTotal > 0 && rawDp > 0) {
      const ratio = Math.round((rawDp / rawTotal) * 100);
      if (ratio > 0 && ratio <= 100) {
        return ratio;
      }
    }
    return adminPitPercent;
  }, [booking, adminPitPercent]);

  const remainingPercent = Math.max(0, 100 - downpaymentPercent);
  const status = booking?.status || '';
  const norm = normalizeBookingStatus(status);
  const currentStepIndex = STEP_INDEX[norm] != null ? STEP_INDEX[norm] : (STEP_INDEX[status] ?? 0);
  const tone = useMemo(() => getBookingStatusTone(status, isDark), [status, isDark]);
  const explanation = useMemo(() => getBookingStatusExplanation(status, booking), [status, booking]);
  const primary = useMemo(() => resolveBookingPrimaryAction(booking), [booking]);
  const activity = useMemo(() => buildBookingActivity(booking), [booking]);

  const bookingId = booking?.booking_id || booking?.id;
  const isPmsFixed = isPmsFixedBooking(booking);

  // Line items
  const embeddedItems = useMemo(
    () => normalizeLineItems(booking?.service_line_items || booking?.serviceLineItems),
    [booking?.service_line_items, booking?.serviceLineItems]
  );
  const [fetchedItems, setFetchedItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(() => Boolean(bookingId && embeddedItems.length === 0));

  useEffect(() => {
    let cancelled = false;
    if (!bookingId || embeddedItems.length > 0) {
      return undefined;
    }
    Promise.resolve(garageService.fetchBookingServiceItems(bookingId))
      .then((rows) => {
        if (!cancelled) {
          setFetchedItems(normalizeLineItems(rows));
          setItemsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFetchedItems([]);
          setItemsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [bookingId, embeddedItems.length, booking?.updated_at]);

  const lineItems = embeddedItems.length > 0 ? embeddedItems : fetchedItems;
  const serviceTotals = useMemo(() => {
    const sumLabor = lineItems.filter((i) => !i.isAdditional).reduce((s, i) => s + i.total, 0);
    const labor =
      Number(booking?.labor_subtotal ?? booking?.quoted_service_rate ?? (lineItems.length ? sumLabor : 0)) ||
      0;
    const parts = Number(booking?.parts_estimate ?? 0) || 0;
    const fees = Number(booking?.additional_fees_estimate ?? 0) || 0;
    const estimated =
      booking?.estimated_total != null && Number(booking.estimated_total) > 0
        ? Number(booking.estimated_total)
        : labor + parts + fees;
    return { labor, parts, fees, estimated };
  }, [booking, lineItems]);

  const basePrice = Number(
    isPmsFixed && serviceTotals.labor > 0 ? serviceTotals.labor : booking?.pricePhp || 2500
  );
  const dpAmount = Number(
    booking?.downpayment_amount !== undefined && booking?.downpayment_amount !== null
      ? booking.downpayment_amount
      : Math.round(basePrice * (downpaymentPercent / 100))
  );
  const quoteTotal = bookingQuotationTotal(booking);
  const finalTotal = Number(booking?.final_service_total || quoteTotal || basePrice);
  const isDpPaid =
    booking?.downpayment_status === 'Paid' ||
    booking?.downpayment_status === 'Settled' ||
    booking?.downpayment_paid === true ||
    booking?.deposit_paid === true ||
    Number(booking?.amount_paid || 0) > 0 ||
    booking?.payment_status === 'DOWNPAYMENT_PAID' ||
    booking?.payment_status === 'FULLY_PAID' ||
    Boolean(booking?.downpayment_paid_at) ||
    !booking?.is_walk_in;
  const remainingBalance = Math.max(0, finalTotal - (Number(dpAmount) > 0 ? dpAmount : (isDpPaid ? dpAmount : 0)));
  const payStatus = bookingPaymentStatus(booking);

  const media = useMemo(() => {
    const raw = booking?.media_urls || booking?.photos || [];
    return Array.isArray(raw) ? raw.filter(Boolean) : [];
  }, [booking]);

  const refresh = async (nextBooking) => {
    if (nextBooking) {
      onBookingUpdated?.(nextBooking);
      return;
    }
    const list = await garageService.fetchBookings();
    const id = booking?.booking_id || booking?.id;
    const found = Array.isArray(list) ? list.find((b) => b.booking_id === id || b.id === id) : null;
    onBookingUpdated?.(found || null, list);
  };

  const withBusy = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      onToast?.(e?.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (next) => {
    if (!canTransition(status, next) && normalizeBookingStatus(status) !== next) {
      onToast?.(`Cannot change from ${statusLabel(status)} to ${statusLabel(next)}`);
      return;
    }
    await withBusy(async () => {
      const id = booking.booking_id || booking.id;
      if (next === FLEX_BOOKING_STATUS.SERVICE_COMPLETED) {
        const fin = await serviceQuotationService.finalizeBilling(id);
        if (!fin.success) throw new Error(fin.error || 'Finalize failed');
        onToast?.(
          fin.remaining > 0
            ? `Service completed · Remaining balance ${formatPhp(fin.remaining)}`
            : 'Service completed · Ready for pickup'
        );
      } else if (next === FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS) {
        await garageService.startService(id);
        onToast?.('Service started in bay · Rider notified');
      } else {
        await garageService.updateBooking(id, {
          status: next,
          current_stage: statusLabel(next),
        });
        onToast?.(`Status updated: ${statusLabel(next)}`);
      }
      await refresh();
    });
  };

  const handleRecordDownpayment = async () => {
    if (!bookingId) return;
    await withBusy(async () => {
      await garageService.updateBooking(bookingId, {
        downpayment_status: 'Paid',
        downpayment_paid: true,
        deposit_paid: true,
        amount_paid: dpAmount,
        downpayment_method: 'Cash / In-Store',
        downpayment_paid_at: new Date().toISOString(),
        current_stage: 'Downpayment verified by admin',
      });
      onToast?.(`✓ Downpayment of ₱${dpAmount.toLocaleString()} recorded as Paid. You can now approve this booking.`);
      await refresh();
    });
  };

  const runPrimary = async () => {
    if (!primary || primary.disabled || !bookingId) return;

    const execute = async () => {
      await withBusy(async () => {
        if (primary.kind === 'approve') {
          const approvalTotal =
            isPmsFixed && serviceTotals.labor > 0
              ? serviceTotals.labor
              : Number(booking?.labor_subtotal ?? booking?.quoted_service_rate ?? 0) || 0;
          const chosenMech =
            selectedMechanic ||
            displayMechanics.find((m) => m.isCurrentAssigned) ||
            displayMechanics.find((m) => m.isAvailable) ||
            null;
          await garageService.approveBooking(bookingId, chosenMech?.name || null, {
            flexible: true,
            approvedBy: 'admin',
            isAlreadyPaid: true,
            mechanicId: chosenMech?.id || null,
            mechanicName: chosenMech?.name || null,
            customerEmail: booking?.customer_email || booking?.userEmail || booking?.email,
            customerName: booking?.customer_name,
            ...(approvalTotal > 0
              ? { estimatedServiceCost: approvalTotal, estimated_service_total: approvalTotal }
              : {}),
          });
          onToast?.(
            chosenMech?.name
              ? `✓ Booking approved & assigned to ${chosenMech.name} · Customer notified by email`
              : '✓ Booking approved · Customer notified by email'
          );
        } else if (primary.kind === 'record_dp') {
          await garageService.updateBooking(bookingId, {
            downpayment_status: 'Paid',
            downpayment_paid: true,
            amount_paid: dpAmount,
            downpayment_method: 'Cash / In-Store',
            downpayment_paid_at: new Date().toISOString(),
            status: FLEX_BOOKING_STATUS.CONFIRMED,
            current_stage: 'Downpayment verified',
          });
          onToast?.('✓ Downpayment recorded · Appointment confirmed');
        } else if (primary.kind === 'confirm_schedule' || primary.kind === 'schedule') {
          await garageService.scheduleAppointment(bookingId, {
            preferredDate: booking.preferred_date || booking.appointment_date,
            preferredTime: booking.preferred_time || booking.time_slot,
            scheduledBy: 'admin',
          });
          onToast?.('✓ Appointment confirmed & scheduled');
        } else if (primary.kind === 'start_service') {
          await garageService.startService(bookingId);
          onToast?.('✓ Motorcycle in bay · Service started');
        } else if (primary.kind === 'complete_inspection') {
          await garageService.updateBooking(bookingId, {
            status: FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS,
            current_stage: 'Inspection completed, in service',
          });
          onToast?.('✓ Inspection completed · Work starting');
        } else if (primary.kind === 'complete_service') {
          await setStatus(FLEX_BOOKING_STATUS.SERVICE_COMPLETED);
        } else if (primary.kind === 'finalize_bill') {
          const fin = await serviceQuotationService.finalizeBilling(bookingId);
          if (!fin.success) throw new Error(fin.error || 'Finalize billing failed');
          await serviceQuotationService.ensurePickupQr(bookingId);
          await garageService.updateBooking(bookingId, {
            status: FLEX_BOOKING_STATUS.READY_FOR_PICKUP,
            current_stage: 'Ready for customer pickup',
            payment_status: 'FULLY_PAID',
            remaining_balance: 0,
          });
          onToast?.('✓ Billing finalized & Pickup QR issued');
        } else if (primary.kind === 'generate_qr') {
          const res = await serviceQuotationService.ensurePickupQr(bookingId);
          if (!res.success) throw new Error(res.error || 'Pickup QR generation failed');
          await garageService.updateBooking(bookingId, {
            status: FLEX_BOOKING_STATUS.READY_FOR_PICKUP,
            current_stage: 'Ready for customer pickup',
          });
          onToast?.('✓ Pickup QR generated · Customer notified');
        } else if (primary.kind === 'verify_pickup') {
          await garageService.updateBooking(bookingId, {
            status: FLEX_BOOKING_STATUS.COMPLETED,
            current_stage: 'Motorcycle released to owner',
            completed_at: new Date().toISOString(),
            pickup_verified_at: new Date().toISOString(),
          });
          onToast?.('✓ Motorcycle released · Work order completed');
        }
        await refresh();
      });
    };

    if (primary.needsConfirm && showConfirm) {
      showConfirm({
        title: primary.confirmTitle || 'Confirm action?',
        message: primary.confirmBody || 'Continue with this booking status change?',
        itemName: bookingId ? `Booking #${bookingId}` : undefined,
        confirmText: primary.label || 'Confirm',
        cancelText: 'Cancel',
        type: primary.kind === 'approve' ? 'success' : 'warning',
        confirmIcon: 'check-circle-fill',
        onConfirm: execute,
      });
      return;
    }

    await execute();
  };

  const handleRejectBooking = async () => {
    const reason = rejectReason.trim();
    if (!reason) {
      onToast?.('Please enter a rejection reason for the customer');
      return;
    }
    await withBusy(async () => {
      await garageService.rejectBooking(bookingId, reason);
      setShowRejectBox(false);
      setRejectReason('');
      onToast?.('Booking declined');
      await refresh();
    });
  };

  const handleRescheduleBooking = async () => {
    if (!rescheduleDate || !rescheduleTime) {
      onToast?.('Please enter both date and time window');
      return;
    }
    await withBusy(async () => {
      await garageService.rescheduleBooking(bookingId, {
        preferredDate: rescheduleDate,
        preferredTime: rescheduleTime,
      });
      setShowRescheduleBox(false);
      onToast?.('✓ Appointment rescheduled');
      await refresh();
    });
  };

  const saveInspectionData = async () => {
    await withBusy(async () => {
      const inspectedAt = new Date().toISOString();
      await serviceQuotationService.recordInspection(bookingId, {
        findings: [
          insp.condition && `Condition: ${insp.condition}`,
          insp.findings && `Problems: ${insp.findings}`,
          insp.recommended && `Recommended: ${insp.recommended}`,
          insp.recommendedParts && `Parts: ${insp.recommendedParts}`,
        ]
          .filter(Boolean)
          .join('\n'),
        recommendedWork: insp.recommended,
        photos: media,
        inspectedBy: 'admin',
      });
      await garageService.updateBooking(bookingId, {
        estimated_labor_hours: insp.estimatedHours
          ? Number(insp.estimatedHours)
          : booking.estimated_labor_hours,
        inspection_notes: [
          insp.condition && `Condition: ${insp.condition}`,
          insp.findings,
          insp.recommended && `Recommended: ${insp.recommended}`,
          insp.recommendedParts && `Parts: ${insp.recommendedParts}`,
        ]
          .filter(Boolean)
          .join('\n'),
        inspection_started_at: inspectedAt,
        status: FLEX_BOOKING_STATUS.UNDER_INSPECTION,
        current_stage: 'Inspection recorded',
      });
      onToast?.('✓ Inspection findings recorded');
      await refresh();
    });
  };

  const saveProgressData = async () => {
    await withBusy(async () => {
      const patch = {
        service_notes: progressNotes,
        status: FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS,
        current_stage: 'Service in progress',
      };
      if (actualHours !== '') {
        await serviceQuotationService.setActualLaborHours(bookingId, Number(actualHours), {
          hourlyRate: booking.quoted_hourly_rate,
        });
      }
      await garageService.updateBooking(bookingId, patch);
      onToast?.('✓ Service progress logged');
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

  const secondaryBtn = {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens?.border || '#E2E8F0',
    backgroundColor: isDark ? tokens?.bgElevated || tokens?.bgCard : '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.wrap}>
          {/* ─────────────────────────────────────────────────────────────
          PROCESS TRACKER PILL (EXACTLY MATCHING CUSTOMER BOOKING UI)
      ────────────────────────────────────────────────────────────── */}
          <View
            style={{
              backgroundColor: isDark ? tokens.bgCard : '#FFFFFF',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: isDark ? tokens.border : '#E4E4E7',
              paddingHorizontal: 16,
              paddingVertical: 10,
              shadowColor: '#000000',
              shadowOpacity: 0.02,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 1 },
              elevation: 1,
              marginBottom: 12,
            }}
          >
            <WorkflowStepper status={status} tokens={tokens} isDark={isDark} />
          </View>

          {/* ─────────────────────────────────────────────────────────────
          CENTERED TITLE & SUBTITLE (EXACTLY MATCHING CUSTOMER BOOKING UI)
      ────────────────────────────────────────────────────────────── */}
          <View style={{ alignItems: 'center', marginBottom: 12, paddingHorizontal: 12 }}>
            <Text
              style={{
                fontSize: 22,
                fontWeight: '700',
                color: isDark ? tokens.textPrimary : '#18181B',
                textAlign: 'center',
                letterSpacing: -0.5,
              }}
            >
              {statusLabel(status)}
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: isDark ? tokens.textMuted : '#71717A',
                textAlign: 'center',
                maxWidth: 640,
                lineHeight: 21,
                marginTop: 6,
              }}
            >
              {norm === FLEX_BOOKING_STATUS.PENDING_REVIEW || status === 'Pending'
                ? 'Review the requested service and customer details before approving this booking.'
                : explanation}
            </Text>
          </View>

          {/* ─────────────────────────────────────────────────────────────
          ROW 1: SIDE-BY-SIDE CARDS (CLEAN, ORGANIZED, AIRY UI)
          RIDER & VEHICLE SPECIFICATIONS + SCHEDULE & SERVICE DELIVERABLES
      ────────────────────────────────────────────────────────────── */}
          <View
            style={{
              flexDirection: isDesktop ? 'row' : 'column',
              gap: 16,
              marginBottom: 16,
            }}
          >
            {/* ─── CARD 1: RIDER & MOTORCYCLE PROFILE ─── */}
            <View
              style={{
                flex: 1,
                backgroundColor: isDark ? tokens.bgCard : '#FFFFFF',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: isDark ? tokens.border : '#E4E4E7',
                padding: 18,
                shadowColor: '#000000',
                shadowOpacity: 0.03,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 2 },
                justifyContent: 'space-between',
              }}
            >
              {/* Card Header: Orange icon circle + Customer Name (Left), DP Settled Pill (Right) */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  marginBottom: 14,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1, minWidth: 0 }}>
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      backgroundColor: '#FFF7ED',
                      borderWidth: 1,
                      borderColor: '#FED7AA',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <BootstrapIcon name="person" size={16} color="#EA580C" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: '700',
                        color: isDark ? tokens.textMuted : '#71717A',
                        textTransform: 'uppercase',
                        letterSpacing: 0.7,
                      }}
                    >
                      RIDER & VEHICLE
                    </Text>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: '700',
                        color: isDark ? tokens.textPrimary : '#18181B',
                        marginTop: 1,
                      }}
                      numberOfLines={1}
                    >
                      {booking.customer_name || booking.userName || 'Walk-in Customer'}
                    </Text>
                  </View>
                </View>

                <View
                  style={{
                    backgroundColor: '#ECFDF5',
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: '#A7F3D0',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <BootstrapIcon name="check-circle-fill" size={11} color="#059669" />
                  <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#047857', fontVariant: ['tabular-nums'] }}>
                    {isDpPaid ? `DP Paid (₱${dpAmount.toLocaleString()})` : `₱${dpAmount.toLocaleString()} Required`}
                  </Text>
                </View>
              </View>

              {/* Hairline Divider */}
              <View style={{ height: 1, backgroundColor: isDark ? tokens.border : '#F4F4F5', marginBottom: 14 }} />

              {/* Clean, Organized Key-Value Grid */}
              <View style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <View style={{ flex: 1, minWidth: 120 }}>
                    <Text style={{ fontSize: 10.5, fontWeight: '600', color: isDark ? tokens.textMuted : '#71717A', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Contact Phone
                    </Text>
                    <Text style={{ fontSize: 13.5, fontWeight: '600', color: isDark ? tokens.textPrimary : '#18181B', marginTop: 3, fontVariant: ['tabular-nums'] }} numberOfLines={1}>
                      {booking.customer_phone || booking.userPhone || 'None provided'}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 120 }}>
                    <Text style={{ fontSize: 10.5, fontWeight: '600', color: isDark ? tokens.textMuted : '#71717A', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Payment Method
                    </Text>
                    <Text style={{ fontSize: 13.5, fontWeight: '600', color: isDark ? tokens.textPrimary : '#18181B', marginTop: 3 }} numberOfLines={1}>
                      {booking.downpayment_channel || booking.downpayment_method || booking.payment_method || 'Online (GCash / Card)'}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <View style={{ flex: 1, minWidth: 120 }}>
                    <Text style={{ fontSize: 10.5, fontWeight: '600', color: isDark ? tokens.textMuted : '#71717A', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Motorcycle Model
                    </Text>
                    <Text style={{ fontSize: 13.5, fontWeight: '600', color: isDark ? tokens.textPrimary : '#18181B', marginTop: 3 }} numberOfLines={1}>
                      {booking.motorcycle_model || booking.bike_model || booking.vehicle || 'Honda ADV 160'}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 120 }}>
                    <Text style={{ fontSize: 10.5, fontWeight: '600', color: isDark ? tokens.textMuted : '#71717A', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Plate Number
                    </Text>
                    <Text style={{ fontSize: 13.5, fontWeight: '600', color: isDark ? tokens.textPrimary : '#18181B', marginTop: 3 }} numberOfLines={1}>
                      {booking.motorcycle_plate || booking.plate_number || booking.plate || 'N/A-RJCX'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* ─── CARD 2: SCHEDULE & DELIVERABLES ─── */}
            <View
              style={{
                flex: 1,
                backgroundColor: isDark ? tokens.bgCard : '#FFFFFF',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: isDark ? tokens.border : '#E4E4E7',
                padding: 18,
                shadowColor: '#000000',
                shadowOpacity: 0.03,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 2 },
                justifyContent: 'space-between',
              }}
            >
              {/* Card Header: Orange icon circle + Service Title (Left), Price Pill (Right) */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  marginBottom: 14,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1, minWidth: 0 }}>
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      backgroundColor: '#FFF7ED',
                      borderWidth: 1,
                      borderColor: '#FED7AA',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <BootstrapIcon name="calendar3" size={16} color="#EA580C" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: '700',
                        color: isDark ? tokens.textMuted : '#71717A',
                        textTransform: 'uppercase',
                        letterSpacing: 0.7,
                      }}
                    >
                      SCHEDULE & DELIVERABLES
                    </Text>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: '700',
                        color: isDark ? tokens.textPrimary : '#18181B',
                        marginTop: 1,
                      }}
                      numberOfLines={1}
                    >
                      {booking.package_name || booking.service_title || (isPmsFixed ? 'Major Tune Up' : 'General Service')}
                    </Text>
                  </View>
                </View>

                <View
                  style={{
                    backgroundColor: '#FFF7ED',
                    paddingHorizontal: 11,
                    paddingVertical: 5,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: '#FED7AA',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15.5,
                      fontWeight: '700',
                      color: '#EA580C',
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    ₱{finalTotal.toLocaleString()}
                  </Text>
                </View>
              </View>

              {/* Hairline Divider */}
              <View style={{ height: 1, backgroundColor: isDark ? tokens.border : '#F4F4F5', marginBottom: 14 }} />

              {/* Clean, Organized Key-Value Grid */}
              <View style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <View style={{ flex: 1.1, minWidth: 140 }}>
                    <Text style={{ fontSize: 10.5, fontWeight: '600', color: isDark ? tokens.textMuted : '#71717A', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Appointment Schedule
                    </Text>
                    <Text style={{ fontSize: 13.5, fontWeight: '600', color: isDark ? tokens.textPrimary : '#18181B', marginTop: 3 }} numberOfLines={1}>
                      {booking.preferred_date || booking.appointment_date || booking.date
                        ? `${formatDateOnly(booking.preferred_date || booking.appointment_date || booking.date)} • ${booking.preferred_time || booking.time_slot || booking.time || '09:00 AM'}`
                        : 'Not scheduled'}
                    </Text>
                  </View>
                  <View style={{ flex: 0.9, minWidth: 110 }}>
                    <Text style={{ fontSize: 10.5, fontWeight: '600', color: isDark ? tokens.textMuted : '#71717A', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Service Category
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                      <View
                        style={{
                          backgroundColor: '#EFF6FF',
                          paddingHorizontal: 7,
                          paddingVertical: 2,
                          borderRadius: 4,
                          borderWidth: 1,
                          borderColor: '#DBEAFE',
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '600', color: '#2563EB' }} numberOfLines={1}>
                          {booking.category === 'PMS' ? 'Tune-Up & Maintenance' : (booking.category || 'PMS Package')}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <View style={{ flex: 1.1, minWidth: 140 }}>
                    <Text style={{ fontSize: 10.5, fontWeight: '600', color: isDark ? tokens.textMuted : '#71717A', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Workshop Pit Bay
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? tokens.textPrimary : '#18181B', marginTop: 3 }} numberOfLines={1}>
                      {booking.branch?.replace('MotoTrack ', '') || "D'Blockchain Motorparts"}
                    </Text>
                    <Text style={{ fontSize: 11, color: isDark ? tokens.textMuted : '#71717A', marginTop: 1 }} numberOfLines={1}>
                      South Poblacion, Naga, 6037 Cebu
                    </Text>
                  </View>
                  <View style={{ flex: 0.9, minWidth: 110 }}>
                    <Text style={{ fontSize: 10.5, fontWeight: '600', color: isDark ? tokens.textMuted : '#71717A', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Duration & Bay
                    </Text>
                    <Text style={{ fontSize: 13.5, fontWeight: '600', color: isDark ? tokens.textPrimary : '#18181B', marginTop: 3 }} numberOfLines={1}>
                      25–35 mins • Bay 1
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* ─── CARD: PREFERRED SCHEDULE & MECHANIC ALLOCATION REVIEW ─── */}
          <View
            style={{
              backgroundColor: isDark ? tokens.bgCard : '#FFFFFF',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: isDark ? tokens.border : '#E4E4E7',
              padding: 18,
              marginBottom: 16,
              shadowColor: '#000000',
              shadowOpacity: 0.03,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
            }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 10,
                marginBottom: 14,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 220 }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: isDark ? 'rgba(234, 88, 12, 0.15)' : '#FFF7ED',
                    borderWidth: 1,
                    borderColor: '#FED7AA',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BootstrapIcon name="tools" size={15} color="#EA580C" />
                </View>
                <View>
                  <Text
                    style={{
                      fontSize: 10.5,
                      fontWeight: '700',
                      color: isDark ? tokens.textMuted : '#71717A',
                      textTransform: 'uppercase',
                      letterSpacing: 0.6,
                    }}
                  >
                    PREFERRED SCHEDULE & MECHANIC ALLOCATION
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '700',
                      color: isDark ? tokens.textPrimary : '#18181B',
                      marginTop: 1,
                    }}
                  >
                    Technician Availability for Requested Slot
                  </Text>
                </View>
              </View>

              {/* Customer Requested Slot Pill */}
              <View
                style={{
                  backgroundColor: '#EFF6FF',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: '#BFDBFE',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <BootstrapIcon name="calendar-event-fill" size={12} color="#2563EB" />
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#1D4ED8' }}>
                  {preferredDate ? formatDateOnly(preferredDate) : 'Preferred Date'} • {preferredTime}
                </Text>
              </View>
            </View>

            {/* Hairline Divider */}
            <View style={{ height: 1, backgroundColor: isDark ? tokens.border : '#F4F4F5', marginBottom: 14 }} />

            {/* Sub-heading / Instruction */}
            <Text
              style={{
                fontSize: 12,
                color: isDark ? tokens.textMuted : '#71717A',
                marginBottom: 12,
              }}
            >
              Review active pit bay technicians below to confirm who is free during the customer's preferred slot ({preferredTime}). Tap to assign technician before approving.
            </Text>

            {/* Mechanics Grid */}
            <View style={{ gap: 10 }}>
              {displayMechanics.map((mech) => {
                const isSelected = selectedMechanic
                  ? selectedMechanic.id === mech.id
                  : mech.isCurrentAssigned;

                return (
                  <View
                    key={mech.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 12,
                      borderRadius: 12,
                      borderWidth: isSelected ? 2 : 1,
                      borderColor: isSelected
                        ? '#EA580C'
                        : isDark
                        ? tokens.border
                        : '#E4E4E7',
                      backgroundColor: isSelected
                        ? isDark
                          ? 'rgba(234, 88, 12, 0.1)'
                          : '#FFF7ED'
                        : isDark
                        ? 'rgba(255, 255, 255, 0.02)'
                        : '#FAFAFA',
                      gap: 12,
                    }}
                  >
                    {/* Left: Avatar + Details */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 200 }}>
                      <Image
                        source={{ uri: mech.avatar }}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: '#E4E4E7',
                        }}
                      />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text
                            style={{
                              fontSize: 13.5,
                              fontWeight: '700',
                              color: isDark ? tokens.textPrimary : '#18181B',
                            }}
                            numberOfLines={1}
                          >
                            {mech.name}
                          </Text>
                          {isSelected && (
                            <View
                              style={{
                                backgroundColor: '#EA580C',
                                paddingHorizontal: 6,
                                paddingVertical: 1.5,
                                borderRadius: 10,
                              }}
                            >
                              <Text style={{ fontSize: 9.5, fontWeight: '700', color: '#FFFFFF' }}>
                                ASSIGNED
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text
                          style={{
                            fontSize: 11.5,
                            color: isDark ? tokens.textMuted : '#71717A',
                            marginTop: 1,
                          }}
                          numberOfLines={1}
                        >
                          {mech.specialization} • {mech.bay || 'Pit Bay'}
                        </Text>
                      </View>
                    </View>

                    {/* Middle: Live Availability Pill */}
                    <View style={{ alignItems: 'flex-end', minWidth: 150 }}>
                      {mech.isAvailable ? (
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 5,
                            backgroundColor: '#ECFDF5',
                            paddingHorizontal: 9,
                            paddingVertical: 3.5,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: '#A7F3D0',
                          }}
                        >
                          <BootstrapIcon name="check-circle-fill" size={11} color="#059669" />
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#047857' }}>
                            Free & Available
                          </Text>
                        </View>
                      ) : (
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 5,
                            backgroundColor: '#FEF2F2',
                            paddingHorizontal: 9,
                            paddingVertical: 3.5,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: '#FECACA',
                          }}
                        >
                          <BootstrapIcon name="slash-circle-fill" size={11} color="#DC2626" />
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#B91C1C' }}>
                            Busy ({mech.conflictBooking || 'In Bay'})
                          </Text>
                        </View>
                      )}
                      <Text
                        style={{
                          fontSize: 10,
                          color: isDark ? tokens.textMuted : '#A1A1AA',
                          marginTop: 2,
                        }}
                      >
                        {mech.isAvailable ? `Available at ${preferredTime}` : `Conflicting slot at ${preferredTime}`}
                      </Text>
                    </View>

                    {/* Right: Select Action */}
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedMechanic(mech);
                        if (booking?.mechanic !== mech.name && (norm === FLEX_BOOKING_STATUS.CONFIRMED || norm === FLEX_BOOKING_STATUS.SCHEDULED)) {
                          handleAssignMechanic(mech);
                        }
                      }}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 8,
                        backgroundColor: isSelected
                          ? '#EA580C'
                          : mech.isAvailable
                          ? isDark
                            ? 'rgba(255, 255, 255, 0.08)'
                            : '#F4F4F5'
                          : isDark
                          ? 'rgba(255, 255, 255, 0.03)'
                          : '#FAFAFA',
                        borderWidth: 1,
                        borderColor: isSelected
                          ? '#EA580C'
                          : isDark
                          ? tokens.border
                          : '#E4E4E7',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 80,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11.5,
                          fontWeight: '700',
                          color: isSelected ? '#FFFFFF' : mech.isAvailable ? (isDark ? tokens.textPrimary : '#18181B') : '#A1A1AA',
                        }}
                      >
                        {isSelected ? 'Selected' : mech.isAvailable ? 'Assign' : 'Conflict'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>

            {/* Active Assignment Status Note */}
            <View
              style={{
                marginTop: 14,
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: isDark ? tokens.border : '#F4F4F5',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                <BootstrapIcon name="info-circle" size={13} color="#EA580C" />
                <Text style={{ fontSize: 11.5, color: isDark ? tokens.textMuted : '#71717A' }}>
                  Technician assigned to this service:{' '}
                  <Text style={{ fontWeight: '700', color: isDark ? tokens.textPrimary : '#18181B' }}>
                    {selectedMechanic?.name || booking?.mechanic || 'Pit Bay Dispatch upon arrival'}
                  </Text>
                </Text>
              </View>
              {selectedMechanic && selectedMechanic.name !== booking?.mechanic && (
                <TouchableOpacity
                  onPress={() => handleAssignMechanic(selectedMechanic)}
                  style={{
                    backgroundColor: '#EA580C',
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                    borderRadius: 6,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFFFFF' }}>
                    Save Assignment
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* ─── CARD 3: ESTIMATED SUMMARY (EXECUTIVE CHARCOAL COLOR SCHEME) ─── */}
          <View
            style={{
              backgroundColor: '#1E2227',
              borderRadius: 16,
              padding: 20,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.08)',
              shadowColor: '#000000',
              shadowOpacity: 0.15,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
            }}
          >
            {/* Header: ESTIMATED SUMMARY matching Reference */}
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: '#EA580C',
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                marginBottom: 12,
              }}
            >
              ESTIMATED SUMMARY
            </Text>

            {/* Table Header: DESCRIPTION & SUBTOTAL */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: 4,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: '#9CA3AF',
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                }}
              >
                DESCRIPTION
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: '#9CA3AF',
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                }}
              >
                SUBTOTAL
              </Text>
            </View>

            {/* Hairline Divider */}
            <View
              style={{
                height: 1,
                backgroundColor: 'rgba(255, 255, 255, 0.10)',
                marginTop: 4,
                marginBottom: 10,
              }}
            />

            {/* Row: Labor */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 5,
              }}
            >
              <Text style={{ fontSize: 13.5, color: '#D4D4D8', fontWeight: '500' }}>Labor</Text>
              <Text
                style={{
                  fontSize: 13.5,
                  color: '#FFFFFF',
                  fontWeight: '600',
                  fontVariant: ['tabular-nums'],
                }}
              >
                {formatPhp(serviceTotals.labor > 0 ? serviceTotals.labor : finalTotal)}
              </Text>
            </View>

            {/* Row: Parts */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 5,
              }}
            >
              <Text style={{ fontSize: 13.5, color: '#D4D4D8', fontWeight: '500' }}>Parts</Text>
              <Text
                style={{
                  fontSize: 13.5,
                  color: '#FFFFFF',
                  fontWeight: '600',
                  fontVariant: ['tabular-nums'],
                }}
              >
                {formatPhp(serviceTotals.parts || 0)}
              </Text>
            </View>

            {/* Row: Other Charges */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 5,
              }}
            >
              <Text style={{ fontSize: 13.5, color: '#D4D4D8', fontWeight: '500' }}>Other Charges</Text>
              <Text
                style={{
                  fontSize: 13.5,
                  color: '#FFFFFF',
                  fontWeight: '600',
                  fontVariant: ['tabular-nums'],
                }}
              >
                {formatPhp(serviceTotals.fees || 0)}
              </Text>
            </View>

            {/* Row: Discount */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 5,
              }}
            >
              <Text style={{ fontSize: 13.5, color: '#D4D4D8', fontWeight: '500' }}>Discount</Text>
              <Text
                style={{
                  fontSize: 13.5,
                  color: Number(booking?.discount_amount || booking?.discount_php || 0) > 0 ? '#F87171' : '#FFFFFF',
                  fontWeight: '600',
                  fontVariant: ['tabular-nums'],
                }}
              >
                {Number(booking?.discount_amount || booking?.discount_php || 0) > 0
                  ? `−${formatPhp(Number(booking.discount_amount || booking.discount_php))}`
                  : '−₱0'}
              </Text>
            </View>

            {/* Total Divider */}
            <View
              style={{
                height: 1,
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
                marginTop: 10,
                marginBottom: 10,
              }}
            />

            {/* Total Row */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 3,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>Total</Text>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: '#EA580C',
                  fontVariant: ['tabular-nums'],
                }}
              >
                {formatPhp(finalTotal)}
              </Text>
            </View>

            {/* Sub-Box: Required Downpayment & Remaining Estimated Balance */}
            <View
              style={{
                marginTop: 10,
                paddingTop: 10,
                borderTopWidth: 1,
                borderTopColor: 'rgba(255, 255, 255, 0.08)',
                gap: 6,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: 3,
                }}
              >
                <Text style={{ fontSize: 13, color: '#A1A1AA', fontWeight: '500' }}>
                  {isDpPaid ? 'Downpayment (Paid)' : 'Required Downpayment'}
                </Text>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '700',
                    color: '#EA580C',
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {formatPhp(dpAmount)}
                </Text>
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: 3,
                }}
              >
                <Text style={{ fontSize: 13, color: '#A1A1AA', fontWeight: '500' }}>
                  Remaining Estimated Balance
                </Text>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '700',
                    color: '#EA580C',
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {formatPhp(remainingBalance)}
                </Text>
              </View>
            </View>
          </View>
          {/* Customer Special Notes if present */}
          {Boolean(booking.notes || booking.customer_notes) && (
            <View
              style={{
                backgroundColor: isDark ? tokens.bgCard : '#FFFFFF',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: isDark ? tokens.border : '#E4E4E7',
                padding: 18,
                marginBottom: 16,
              }}
            >
              <Text
                style={{
                  fontSize: 10.5,
                  fontWeight: '700',
                  color: isDark ? tokens.textMuted : '#71717A',
                  textTransform: 'uppercase',
                  letterSpacing: 0.8,
                  marginBottom: 8,
                }}
              >
                Customer Special Requests & Notes
              </Text>
              <View
                style={{
                  padding: 12,
                  backgroundColor: isDark ? tokens.bgSub : '#FAFAF9',
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: isDark ? tokens.border : '#F4F4F5',
                }}
              >
                <Text style={{ fontSize: 13, color: isDark ? tokens.textPrimary : '#334155', fontStyle: 'italic', lineHeight: 19 }}>
                  "{booking.notes || booking.customer_notes}"
                </Text>
              </View>
            </View>
          )}

          {/* Attached Motorcycle Photos if present */}
          {media.length > 0 && (
            <View
              style={{
                backgroundColor: isDark ? tokens.bgCard : '#FFFFFF',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: isDark ? tokens.border : '#E4E4E7',
                padding: 18,
                marginBottom: 16,
              }}
            >
              <Text
                style={{
                  fontSize: 10.5,
                  fontWeight: '700',
                  color: isDark ? tokens.textMuted : '#71717A',
                  textTransform: 'uppercase',
                  letterSpacing: 0.8,
                  marginBottom: 10,
                }}
              >
                Attached Motorcycle Photos ({media.length})
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {media.map((url, i) => (
                  <Image
                    key={`${url}-${i}`}
                    source={{ uri: getOptimizedImageUrl(url, { width: 160, quality: 60 }) }}
                    style={{
                      width: 88,
                      height: 88,
                      borderRadius: 8,
                      backgroundColor: isDark ? tokens.bgSub : '#E2E8F0',
                    }}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
            </View>
          )}
          {/* ─────────────────────────────────────────────────────────────
          SECTION 7: SPECIALIZED WORKSHOP TOOLS (Only shown in Step 2 "In bay" & beyond)
      ────────────────────────────────────────────────────────────── */}
          {currentStepIndex >= 1 && (
            <Section title="Workshop Tools & Advanced Itemization" tokens={tokens} isDark={isDark}>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: activeTab !== 'none' ? 12 : 0,
              }}
            >
              <TouchableOpacity
                style={[
                  secondaryBtn,
                  activeTab === 'quotation' && {
                    backgroundColor: isDark ? '#EA580C' : '#FFF7ED',
                    borderColor: '#EA580C',
                  },
                ]}
                onPress={() => setActiveTab(activeTab === 'quotation' ? 'none' : 'quotation')}
              >
                <BootstrapIcon
                  name="receipt-cutoff"
                  size={13}
                  color={activeTab === 'quotation' ? (isDark ? '#FFF' : '#EA580C') : tokens.textPrimary}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: activeTab === 'quotation' ? (isDark ? '#FFF' : '#EA580C') : tokens.textPrimary,
                  }}
                >
                  {activeTab === 'quotation' ? 'Hide Quotation Editor' : 'Quotation & Parts Itemization'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  secondaryBtn,
                  activeTab === 'inspection' && {
                    backgroundColor: isDark ? '#EA580C' : '#FFF7ED',
                    borderColor: '#EA580C',
                  },
                ]}
                onPress={() => setActiveTab(activeTab === 'inspection' ? 'none' : 'inspection')}
              >
                <BootstrapIcon
                  name="search"
                  size={13}
                  color={activeTab === 'inspection' ? (isDark ? '#FFF' : '#EA580C') : tokens.textPrimary}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: activeTab === 'inspection' ? (isDark ? '#FFF' : '#EA580C') : tokens.textPrimary,
                  }}
                >
                  {activeTab === 'inspection' ? 'Hide Inspection Form' : 'Inspection & Diagnostics'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  secondaryBtn,
                  activeTab === 'scanner' && {
                    backgroundColor: isDark ? '#EA580C' : '#FFF7ED',
                    borderColor: '#EA580C',
                  },
                ]}
                onPress={() => setActiveTab(activeTab === 'scanner' ? 'none' : 'scanner')}
              >
                <BootstrapIcon
                  name="qr-code-scan"
                  size={13}
                  color={activeTab === 'scanner' ? (isDark ? '#FFF' : '#EA580C') : tokens.textPrimary}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: activeTab === 'scanner' ? (isDark ? '#FFF' : '#EA580C') : tokens.textPrimary,
                  }}
                >
                  {activeTab === 'scanner' ? 'Hide QR Scanner' : 'Pickup QR Scanner'}
                </Text>
              </TouchableOpacity>

              {onDeleteBooking ? (
                <TouchableOpacity
                  style={[
                    secondaryBtn,
                    {
                      borderColor: isDark ? 'rgba(220, 38, 38, 0.4)' : '#FECACA',
                      backgroundColor: isDark ? 'rgba(220, 38, 38, 0.1)' : '#FEF2F2',
                      marginLeft: isDesktop ? 'auto' : 0,
                    },
                  ]}
                  onPress={() => onDeleteBooking(bookingId)}
                >
                  <BootstrapIcon name="trash" size={13} color="#DC2626" />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#DC2626' }}>
                    Delete Work Order
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Tab Sub-Panel: Quotation */}
            {activeTab === 'quotation' && (
              <View style={{ paddingTop: 8, borderTopWidth: 1, borderTopColor: tokens.border || '#E2E8F0' }}>
                <ServiceQuotationPanel
                  booking={booking}
                  onToast={onToast}
                  onUpdated={async () => {
                    await refresh();
                  }}
                />
              </View>
            )}

            {/* Tab Sub-Panel: Inspection */}
            {activeTab === 'inspection' && (
              <View
                style={{ paddingTop: 8, borderTopWidth: 1, borderTopColor: tokens.border || '#E2E8F0', gap: 10 }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: tokens.textPrimary }}>
                  Vehicle Inspection & Diagnostics
                </Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: tokens.textMuted, marginBottom: 3 }}>Condition</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. Good / Forks leaking / Chain slack"
                      placeholderTextColor="#94A3B8"
                      value={insp.condition}
                      onChangeText={(v) => setInsp((p) => ({ ...p, condition: v }))}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: tokens.textMuted, marginBottom: 3 }}>
                      Estimated Labor Hours
                    </Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. 1.5"
                      placeholderTextColor="#94A3B8"
                      value={insp.estimatedHours}
                      onChangeText={(v) => setInsp((p) => ({ ...p, estimatedHours: v }))}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
                <View>
                  <Text style={{ fontSize: 11, color: tokens.textMuted, marginBottom: 3 }}>
                    Problems Identified
                  </Text>
                  <TextInput
                    style={[styles.textInput, { minHeight: 55 }]}
                    placeholder="Diagnostic findings..."
                    placeholderTextColor="#94A3B8"
                    value={insp.findings}
                    onChangeText={(v) => setInsp((p) => ({ ...p, findings: v }))}
                    multiline
                  />
                </View>
                <TouchableOpacity
                  onPress={saveInspectionData}
                  disabled={busy}
                  style={[
                    secondaryBtn,
                    { alignSelf: 'flex-start', backgroundColor: '#1E2227',
      borderWidth: 1,
      borderColor: '#373C42', borderColor: '#EA580C' },
                  ]}
                >
                  <BootstrapIcon name="check2" size={13} color="#FFF" />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#FFF' }}>Save Inspection</Text>
                </TouchableOpacity>

                <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: tokens.border }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: tokens.textPrimary }}>
                    Service Execution Progress
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: tokens.textMuted, marginBottom: 3 }}>
                        Actual Labor Hours
                      </Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="e.g. 2.0"
                        placeholderTextColor="#94A3B8"
                        value={actualHours}
                        onChangeText={setActualHours}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                  <View style={{ marginTop: 6 }}>
                    <Text style={{ fontSize: 11, color: tokens.textMuted, marginBottom: 3 }}>Service Notes</Text>
                    <TextInput
                      style={[styles.textInput, { minHeight: 55 }]}
                      placeholder="Work completed notes..."
                      placeholderTextColor="#94A3B8"
                      value={progressNotes}
                      onChangeText={setProgressNotes}
                      multiline
                    />
                  </View>
                  <TouchableOpacity
                    onPress={saveProgressData}
                    disabled={busy}
                    style={[
                      secondaryBtn,
                      {
                        alignSelf: 'flex-start',
                        marginTop: 8,
                        backgroundColor: '#EA580C',
                        borderColor: '#EA580C',
                      },
                    ]}
                  >
                    <BootstrapIcon name="save" size={13} color="#FFF" />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#FFF' }}>Save Progress</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Tab Sub-Panel: QR Scanner */}
            {activeTab === 'scanner' && (
              <View style={{ paddingTop: 8, borderTopWidth: 1, borderTopColor: tokens.border || '#E2E8F0' }}>
                <PickupQrScannerPanel
                  onToast={onToast}
                  onCompleted={async () => {
                    await refresh();
                  }}
                />
              </View>
            )}
          </Section>
          )}
          {/* ─────────────────────────────────────────────────────────────
          SECTION 8: BOOKING ACTIVITY & AUDIT TIMELINE
      ────────────────────────────────────────────────────────────── */}
          <Section title="Booking Activity" tokens={tokens} isDark={isDark}>
            {activity.length === 0 ? (
              <Text style={{ fontSize: 13, color: tokens.textMuted }}>No activity recorded yet.</Text>
            ) : (
              activity.map((ev, idx) => (
                <View
                  key={ev.id || idx}
                  style={{
                    flexDirection: 'row',
                    gap: 12,
                    paddingBottom: idx < activity.length - 1 ? 14 : 4,
                    position: 'relative',
                  }}
                >
                  {/* Connector line */}
                  {idx < activity.length - 1 ? (
                    <View
                      style={{
                        position: 'absolute',
                        left: 11,
                        top: 22,
                        bottom: 0,
                        width: 2,
                        backgroundColor: tokens.border || '#E2E8F0',
                      }}
                    />
                  ) : null}

                  {/* Event Icon */}
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: isDark ? 'rgba(100, 116, 139, 0.2)' : '#F1F5F9',
                      borderWidth: 1.5,
                      borderColor: ev.tone || tokens.textMuted,
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 2,
                    }}
                  >
                    <BootstrapIcon name={ev.icon || 'check'} size={11} color={ev.tone || tokens.textPrimary} />
                  </View>

                  {/* Event Content */}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: tokens.textPrimary }}>
                        {ev.label}
                      </Text>
                      <Text style={{ fontSize: 11, color: tokens.textMuted }}>{formatDateTime(ev.date)}</Text>
                    </View>
                    <Text style={{ fontSize: 12, color: tokens.textMuted, marginTop: 2 }}>{ev.detail}</Text>
                  </View>
                </View>
              ))
            )}
          </Section>
        </View>
      </ScrollView>

      {/* Sticky Fixed Footer: Operational Actions (Restored Original Positioning) */}
      <View
        style={[
          styles.fixedFooter,
          {
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 8,
          },
        ]}
      >
        {primary?.secondaryReject ? (
          <TouchableOpacity
            onPress={() => setShowRejectBox(true)}
            disabled={busy}
            style={{
              paddingVertical: 7,
              paddingHorizontal: 12,
              borderRadius: 8,
              cursor: 'pointer',
            }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 13.5, fontWeight: '600', color: '#DC2626' }}>
              Reject booking
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={onClose}
            style={[styles.footerCloseBtn, { paddingVertical: 7, paddingHorizontal: 14 }]}
            activeOpacity={0.7}
          >
            <Text style={[styles.footerCloseText, { fontSize: 13 }]}>Close</Text>
          </TouchableOpacity>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {primary?.secondaryReschedule && (
            <TouchableOpacity
              onPress={() => setShowRescheduleBox(!showRescheduleBox)}
              disabled={busy}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: isDark ? '#373C42' : '#CBD5E1',
                backgroundColor: isDark ? '#24272B' : '#F8FAFC',
                cursor: 'pointer',
              }}
              activeOpacity={0.8}
            >
              <BootstrapIcon name="calendar-event" size={13} color={isDark ? tokens?.textPrimary : '#0F172A'} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? tokens?.textPrimary : '#0F172A' }}>
                Reschedule
              </Text>
            </TouchableOpacity>
          )}

          {primary?.label ? (
            <TouchableOpacity
              onPress={runPrimary}
              disabled={busy || primary.disabled}
              activeOpacity={0.85}
              style={[
                styles.footerPrimaryBtn,
                {
                  paddingHorizontal: 20,
                  paddingVertical: 8,
                  borderRadius: 8,
                  backgroundColor: '#1E2227',
                  borderWidth: 1,
                  borderColor: '#373C42',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 7,
                  cursor: 'pointer',
                  shadowColor: '#000000',
                  shadowOpacity: 0.15,
                  shadowRadius: 4,
                  shadowOffset: { width: 0, height: 2 },
                },
                primary.disabled && styles.footerPrimaryBtnDisabled,
                busy && { opacity: 0.7 },
              ]}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <BootstrapIcon name={primary.icon || 'check2-circle'} size={14} color="#FFFFFF" />
              )}
              <Text style={{ fontSize: 13.5, fontWeight: '600', color: '#FFFFFF' }}>
                {busy ? 'Working…' : primary.label}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.footerTerminalBadge, { paddingVertical: 5, paddingHorizontal: 10 }]}>
              <Text style={[styles.footerTerminalText, { fontSize: 12 }]}>
                {norm === FLEX_BOOKING_STATUS.COMPLETED
                  ? '✓ Handover Completed'
                  : 'No further action required'}
              </Text>
            </View>
          )}
        </View>
      </View>
      {/* ─────────────────────────────────────────────────────────────
          MODAL: REJECT BOOKING REASON PROMPT
      ────────────────────────────────────────────────────────────── */}
      <Modal
        visible={showRejectBox}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRejectBox(false)}
      >
        <View style={styles.dialogBackdrop}>
          <View style={styles.dialogCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <BootstrapIcon name="shield-exclamation" size={16} color="#DC2626" />
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#DC2626' }}>
                Decline Booking Request
              </Text>
            </View>
            <Text style={{ fontSize: 12.5, color: tokens?.textMuted || '#64748B', marginBottom: 8 }}>
              Please provide a clear reason. This will be shown directly to the customer.
            </Text>
            <TextInput
              style={[styles.textInput, { minHeight: 70 }]}
              placeholder="e.g. Bay fully booked at requested time, please choose an afternoon slot"
              placeholderTextColor="#94A3B8"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
            />
            <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <TouchableOpacity onPress={() => setShowRejectBox(false)} style={secondaryBtn} disabled={busy}>
                <Text style={{ fontSize: 12.5, fontWeight: '600', color: tokens.textPrimary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleRejectBooking}
                disabled={busy || !rejectReason.trim()}
                style={[secondaryBtn, { backgroundColor: '#DC2626', borderColor: '#DC2626' }]}
              >
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#FFF' }}>
                  {busy ? 'Declining…' : 'Confirm Decline'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────
          MODAL: RESCHEDULE APPOINTMENT
      ────────────────────────────────────────────────────────────── */}
      <Modal
        visible={showRescheduleBox}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRescheduleBox(false)}
      >
        <View style={styles.dialogBackdrop}>
          <View style={styles.dialogCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <BootstrapIcon name="calendar-event" size={16} color="#EA580C" />
              <Text
                style={{ fontSize: 14, fontWeight: '700', color: isDark ? tokens.textPrimary : '#0F172A' }}
              >
                Reschedule Service Appointment
              </Text>
            </View>
            <View style={{ gap: 10 }}>
              <View>
                <Text style={{ fontSize: 11.5, fontWeight: '600', color: tokens.textMuted, marginBottom: 3 }}>
                  Preferred Date (YYYY-MM-DD)
                </Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94A3B8"
                  value={rescheduleDate}
                  onChangeText={setRescheduleDate}
                />
              </View>
              <View>
                <Text style={{ fontSize: 11.5, fontWeight: '600', color: tokens.textMuted, marginBottom: 3 }}>
                  Arrival Time Window
                </Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 10:30 AM - 12:00 PM"
                  placeholderTextColor="#94A3B8"
                  value={rescheduleTime}
                  onChangeText={setRescheduleTime}
                />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
              <TouchableOpacity
                onPress={() => setShowRescheduleBox(false)}
                style={secondaryBtn}
                disabled={busy}
              >
                <Text style={{ fontSize: 12.5, fontWeight: '600', color: tokens.textPrimary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleRescheduleBooking}
                disabled={busy || !rescheduleDate || !rescheduleTime}
                style={[secondaryBtn, { backgroundColor: '#EA580C', borderColor: '#EA580C' }]}
              >
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#FFF' }}>
                  {busy ? 'Saving…' : 'Save New Schedule'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── 4. EXPORT ROOT WRAPPER ──

export default function AdminBookingDetailsPanel({ isDarkMode = false, tokens: externalTokens, ...props }) {
  const value = useMemo(() => {
    const t = externalTokens || getThemeTokens(isDarkMode);
    return { t, isDark: isDarkMode, styles: createStyles(t, isDarkMode) };
  }, [isDarkMode, externalTokens]);

  return (
    <DetailsThemeContext.Provider value={value}>
      <AdminBookingDetailsPanelInner {...props} />
    </DetailsThemeContext.Provider>
  );
}

// ── 5. STYLES ──

function createStyles(t, isDark) {
  return StyleSheet.create({
    container: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      backgroundColor: isDark ? (t.bgCard || '#0B1120') : '#FFFFFF',
    },
    scrollArea: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 12,
    },
    fixedFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 8,
      borderTopWidth: 1,
      borderTopColor: isDark ? t.border || '#334155' : '#E2E8F0',
      backgroundColor: isDark ? t.bgCard || '#1E293B' : '#FFFFFF',
      gap: 10,
      flexWrap: 'wrap',
    },
    footerCloseBtn: {
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDark ? t.border || '#334155' : '#CBD5E1',
      backgroundColor: isDark ? t.bgElevated || '#0F172A' : '#FFFFFF',
      cursor: 'pointer',
    },
    footerCloseText: {
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? t.textPrimary : '#334155',
    },
    footerActionsGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap',
    },
    footerRejectBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 68, 68, 0.4)' : '#FECACA',
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2',
      cursor: 'pointer',
    },
    footerRejectText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#DC2626',
    },
    footerRescheduleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDark ? t.border || '#334155' : '#CBD5E1',
      backgroundColor: isDark ? t.bgElevated || '#0F172A' : '#FFFFFF',
      cursor: 'pointer',
    },
    footerRescheduleText: {
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? t.textPrimary : '#0F172A',
    },
    footerPrimaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 18,
      paddingVertical: 9,
      borderRadius: 8,
      backgroundColor: '#1E2227',
      borderWidth: 1,
      borderColor: '#373C42',
      cursor: 'pointer',
    },
    footerPrimaryBtnDisabled: {
      backgroundColor: isDark ? t.border || '#334155' : '#CBD5E1',
      cursor: 'not-allowed',
    },
    footerPrimaryText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    footerTerminalBadge: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ECFDF5',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#A7F3D0',
    },
    footerTerminalText: {
      fontSize: 12.5,
      fontWeight: '600',
      color: isDark ? '#34D399' : '#047857',
    },
    wrap: { gap: 12 },
    empty: { padding: 32, alignItems: 'center' },
    emptyText: { color: isDark ? t.textMuted : '#94A3B8', fontSize: 13 },

    textInput: {
      backgroundColor: isDark ? t.inputBg || '#1E293B' : '#FFFFFF',
      borderWidth: 1,
      borderColor: isDark ? t.borderInput || '#334155' : '#CBD5E1',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 13,
      color: isDark ? t.textPrimary : '#0F172A',
      outlineStyle: 'none',
    },

    dialogBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(15, 23, 42, 0.6)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    },
    dialogCard: {
      width: '100%',
      maxWidth: 480,
      backgroundColor: isDark ? t.bgCard || '#1E293B' : '#FFFFFF',
      borderRadius: 14,
      padding: 20,
      borderWidth: 1,
      borderColor: isDark ? t.border || '#334155' : '#E2E8F0',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 6,
    },
  });
}
