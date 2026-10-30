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
import { serviceQuotationService } from '../../services/bookings/serviceQuotationService.js';
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

export const BOOKING_FULFILLMENT_STEPS = [
  {
    key: 'pending',
    status: FLEX_BOOKING_STATUS.PENDING_REVIEW,
    label: 'Pending Review',
    shortLabel: 'Review',
  },
  {
    key: 'approved',
    status: FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT,
    label: 'Downpayment',
    shortLabel: 'Downpayment',
  },
  { key: 'scheduled', status: FLEX_BOOKING_STATUS.SCHEDULED, label: 'Scheduled', shortLabel: 'Scheduled' },
  {
    key: 'in_service',
    status: FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS,
    label: 'In Service',
    shortLabel: 'In Bay',
  },
  {
    key: 'service_completed',
    status: FLEX_BOOKING_STATUS.SERVICE_COMPLETED,
    label: 'Service Done',
    shortLabel: 'Completed',
  },
  {
    key: 'picked_up',
    status: FLEX_BOOKING_STATUS.COMPLETED,
    label: 'Handover / Released',
    shortLabel: 'Released',
  },
];

const STEP_INDEX = {
  [FLEX_BOOKING_STATUS.PENDING_REVIEW]: 0,
  Pending: 0,
  [FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT]: 1,
  [FLEX_BOOKING_STATUS.APPROVED]: 1,
  [FLEX_BOOKING_STATUS.CONFIRMED]: 2,
  [FLEX_BOOKING_STATUS.SCHEDULED]: 2,
  Confirmed: 2,
  [FLEX_BOOKING_STATUS.UNDER_INSPECTION]: 3,
  [FLEX_BOOKING_STATUS.ESTIMATE_SUBMITTED]: 3,
  [FLEX_BOOKING_STATUS.QUOTATION_SENT]: 3,
  [FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL]: 3,
  [FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS]: 3,
  [FLEX_BOOKING_STATUS.ADDITIONAL_APPROVAL_REQUIRED]: 3,
  'In Progress': 3,
  [FLEX_BOOKING_STATUS.SERVICE_COMPLETED]: 4,
  [FLEX_BOOKING_STATUS.FOR_FINAL_BILLING]: 4,
  [FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT]: 4,
  [FLEX_BOOKING_STATUS.FULLY_PAID]: 4,
  [FLEX_BOOKING_STATUS.READY_FOR_PICKUP]: 4,
  'Service Done': 4,
  [FLEX_BOOKING_STATUS.COMPLETED]: 5,
  Paid: 5,
  Closed: 5,
  [FLEX_BOOKING_STATUS.CANCELLED]: -1,
  [FLEX_BOOKING_STATUS.REJECTED]: -1,
  [FLEX_BOOKING_STATUS.CUSTOMER_DECLINED]: -1,
  [FLEX_BOOKING_STATUS.BOOKING_EXPIRED]: -1,
};

function getBookingStepStates(status) {
  const norm = normalizeBookingStatus(status);
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
  const basePrice = Number(booking?.pricePhp || booking?.labor_subtotal || 2500);
  const dpAmount = Number(
    booking?.downpayment_amount !== undefined ? booking.downpayment_amount : Math.round(basePrice * 0.2)
  );

  switch (norm) {
    case FLEX_BOOKING_STATUS.PENDING_REVIEW:
      return 'Customer submitted a new appointment request. Review requested services and approve to request the required downpayment or decline with a reason.';
    case FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT:
    case FLEX_BOOKING_STATUS.APPROVED:
      return `Booking is approved. Waiting for customer to settle the 20% downpayment (₱${dpAmount.toLocaleString()}) to confirm their bay schedule.`;
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
      return 'Service work is finished and payments are settled. The motorcycle is staged and ready for customer handover and QR verification.';
    case FLEX_BOOKING_STATUS.COMPLETED:
      return 'Customer verified handover and received their motorcycle. All services and payments are complete.';
    case FLEX_BOOKING_STATUS.REJECTED:
      return booking?.rejection_reason
        ? `Booking declined: "${booking.rejection_reason}"`
        : 'This booking request was declined by the administrator.';
    case FLEX_BOOKING_STATUS.CANCELLED:
      return 'This appointment was cancelled and will not proceed through fulfillment.';
    case FLEX_BOOKING_STATUS.BOOKING_EXPIRED:
      return 'The appointment expired and was cancelled automatically because the required downpayment was not received by the deadline.';
    default:
      return 'Review booking details and progress the service through each stage of fulfillment.';
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
    booking.downpayment_status === 'Paid' || booking.downpayment_paid || Number(booking.amount_paid || 0) > 0;
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

  if (norm === FLEX_BOOKING_STATUS.PENDING_REVIEW) {
    return {
      kind: 'approve',
      label: 'Approve Booking',
      icon: 'check2-circle',
      hint: 'Review requested services and approve to notify the customer and request their 20% downpayment.',
      needsConfirm: true,
      confirmTitle: 'Approve Service Appointment?',
      confirmBody:
        'This will approve the appointment and notify the customer to pay the required 20% downpayment.',
      secondaryReject: true,
    };
  }

  if (norm === FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT || norm === FLEX_BOOKING_STATUS.APPROVED) {
    if (isDpPaid) {
      return {
        kind: 'confirm_schedule',
        label: 'Confirm Bay Appointment',
        icon: 'calendar-check-fill',
        hint: `Downpayment of ₱${dpAmount.toLocaleString()} has been verified. Confirm the arrival schedule.`,
        needsConfirm: false,
        secondaryReschedule: true,
      };
    }
    return {
      kind: 'record_dp',
      label: 'Record Downpayment (Cash / In-Store)',
      icon: 'cash-stack',
      hint: 'Customer is prompted to pay downpayment via GCash. If paid in person, record it now to lock schedule.',
      infoBanner: `20% downpayment (₱${dpAmount.toLocaleString()}) required before bay schedule is locked.`,
      needsConfirm: true,
      confirmTitle: 'Record Downpayment as Paid?',
      confirmBody: `Mark downpayment of ₱${dpAmount.toLocaleString()} as received via cash/in-store payment?`,
      secondaryReschedule: true,
      secondaryReject: true,
    };
  }

  if (norm === FLEX_BOOKING_STATUS.CONFIRMED) {
    return {
      kind: 'schedule',
      label: 'Schedule Arrival Window',
      icon: 'calendar2-check-fill',
      hint: 'Downpayment is verified. Confirm the appointment date and arrival time window.',
      needsConfirm: false,
      secondaryReschedule: true,
    };
  }

  if (norm === FLEX_BOOKING_STATUS.SCHEDULED) {
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
      `20% Downpayment (₱${booking.downpayment_amount || 0}) paid via ${booking.downpayment_method || 'GCash'}`,
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

function WorkflowStepper({ status, tokens, isDark, isDesktop }) {
  const steps = useMemo(() => getBookingStepStates(status), [status]);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        minWidth: isDesktop ? '100%' : undefined,
      }}
    >
      {steps.map((step, idx) => {
        const done = step.state === 'done';
        const current = step.state === 'current';
        const failed = step.state === 'failed';
        const color = failed
          ? '#DC2626'
          : done
            ? isDark
              ? '#EA580C'
              : '#059669'
            : current
              ? getBookingStatusTone(step.status, isDark).color
              : tokens.textMuted || '#94A3B8';
        const bg = current
          ? getBookingStatusTone(step.status, isDark).bg
          : done
            ? isDark
              ? 'rgba(16, 185, 129, 0.12)'
              : '#ECFDF5'
            : isDark
              ? tokens.bgElevated || '#1E293B'
              : '#F8FAFC';
        return (
          <View key={step.key} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ alignItems: 'center', minWidth: isDesktop ? 96 : 84 }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: bg,
                  borderWidth: 1.5,
                  borderColor: color,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {done ? (
                  <BootstrapIcon name="check-lg" size={12} color={color} />
                ) : failed ? (
                  <BootstrapIcon name="x-lg" size={11} color={color} />
                ) : (
                  <View
                    style={{
                      width: current ? 10 : 6,
                      height: current ? 10 : 6,
                      borderRadius: 5,
                      backgroundColor: color,
                    }}
                  />
                )}
              </View>
              <Text
                style={{
                  fontSize: 10.5,
                  fontWeight: current ? '700' : '500',
                  color:
                    current || done
                      ? isDark
                        ? tokens.textPrimary
                        : '#0F172A'
                      : tokens.textMuted || '#64748B',
                  marginTop: 6,
                  textAlign: 'center',
                  maxWidth: 92,
                }}
                numberOfLines={2}
              >
                {step.shortLabel}
              </Text>
            </View>
            {idx < steps.length - 1 ? (
              <View
                style={{
                  width: isDesktop ? 22 : 14,
                  height: 2,
                  backgroundColor: done ? (isDark ? '#EA580C' : '#A7F3D0') : tokens.border || '#E2E8F0',
                  marginBottom: 20,
                }}
              />
            ) : null}
          </View>
        );
      })}
    </ScrollView>
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

  const status = booking?.status || '';
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
    booking?.downpayment_amount !== undefined ? booking.downpayment_amount : Math.round(basePrice * 0.2)
  );
  const quoteTotal = bookingQuotationTotal(booking);
  const finalTotal = Number(booking?.final_service_total || quoteTotal || basePrice);
  const isDpPaid =
    booking?.downpayment_status === 'Paid' ||
    booking?.downpayment_paid ||
    Number(booking?.amount_paid || 0) > 0;
  const remainingBalance = Math.max(0, finalTotal - (isDpPaid ? dpAmount : 0));
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

  const runPrimary = async () => {
    if (!primary || primary.disabled || !bookingId) return;

    const execute = async () => {
      await withBusy(async () => {
        if (primary.kind === 'approve') {
          const approvalTotal =
            isPmsFixed && serviceTotals.labor > 0
              ? serviceTotals.labor
              : Number(booking?.labor_subtotal ?? booking?.quoted_service_rate ?? 0) || 0;
          await garageService.approveBooking(bookingId, null, {
            flexible: true,
            approvedBy: 'admin',
            ...(approvalTotal > 0
              ? { estimatedServiceCost: approvalTotal, estimated_service_total: approvalTotal }
              : {}),
          });
          onToast?.('✓ Booking approved — customer notified for downpayment');
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
          SECTION 1: BOOKING STATUS & WORKFLOW STEPPER
      ────────────────────────────────────────────────────────────── */}
          <Section title="Booking Status" tokens={tokens} isDark={isDark}>
            <View
              style={{
                backgroundColor: tone.bg,
                borderWidth: 1,
                borderColor: tone.border,
                borderRadius: 10,
                padding: 13,
                marginBottom: 14,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text
                  style={{
                    fontSize: 10.5,
                    fontWeight: '700',
                    color: tone.color,
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                  }}
                >
                  Current Status
                </Text>
                {busy && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <ActivityIndicator size="small" color={tone.color} />
                    <Text style={{ fontSize: 11, color: tone.color, fontWeight: '600' }}>Updating…</Text>
                  </View>
                )}
              </View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: tone.color, marginTop: 4 }}>
                {statusLabel(status)}
              </Text>
              <Text
                style={{
                  fontSize: 12.5,
                  color: isDark ? tokens.textPrimary : '#0F172A',
                  marginTop: 6,
                  lineHeight: 18,
                }}
              >
                {explanation}
              </Text>
            </View>

            <Text
              style={{
                fontSize: 10.5,
                fontWeight: '600',
                color: tokens?.textMuted || '#64748B',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 8,
              }}
            >
              Progress
            </Text>
            <WorkflowStepper status={status} tokens={tokens} isDark={isDark} isDesktop={isDesktop} />
          </Section>

          {/* ─────────────────────────────────────────────────────────────
          SECTION 2: NEXT ACTION (GUIDED PRIMARY ACTION + CONTROLS)
      ────────────────────────────────────────────────────────────── */}
          <Section title="Next Action" tokens={tokens} isDark={isDark}>
            {primary?.infoBanner ? (
              <View
                style={{
                  backgroundColor: isDark ? 'rgba(217, 119, 6, 0.12)' : '#FFFBEB',
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(217, 119, 6, 0.3)' : '#FDE68A',
                  borderRadius: 8,
                  padding: 10,
                  marginBottom: 10,
                }}
              >
                <Text style={{ fontSize: 12.5, color: isDark ? '#E0B35C' : '#92400E', lineHeight: 18 }}>
                  ⚠ {primary.infoBanner}
                </Text>
              </View>
            ) : null}

            {primary?.hint ? (
              <Text
                style={{
                  fontSize: 13,
                  color: tokens?.textPrimary || '#0F172A',
                  marginBottom: 12,
                  lineHeight: 19,
                }}
              >
                {primary.hint}
              </Text>
            ) : null}

            {primary?.completeMessage ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
                <BootstrapIcon name="check-circle-fill" size={16} color={isDark ? '#EA580C' : '#059669'} />
                <Text style={{ fontSize: 13.5, fontWeight: '700', color: tokens?.textPrimary || '#0F172A' }}>
                  {primary.completeMessage}
                </Text>
              </View>
            ) : null}

            {primary?.blockedReason && !primary.label ? (
              <View
                style={{
                  backgroundColor: isDark ? 'rgba(220, 38, 38, 0.12)' : '#FEF2F2',
                  borderRadius: 8,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(220, 38, 38, 0.3)' : '#FECACA',
                }}
              >
                <Text style={{ fontSize: 12.5, fontWeight: '600', color: isDark ? '#F87171' : '#B91C1C' }}>
                  Cannot proceed
                </Text>
                <Text
                  style={{
                    fontSize: 12.5,
                    color: tokens?.textPrimary || '#0F172A',
                    marginTop: 4,
                    lineHeight: 18,
                  }}
                >
                  {primary.blockedReason}
                </Text>
              </View>
            ) : null}

            {/* Primary Action Button */}
            {primary?.label ? (
              <TouchableOpacity
                onPress={runPrimary}
                disabled={busy || primary.disabled}
                activeOpacity={0.85}
                style={{
                  backgroundColor: primary.disabled ? tokens?.border || '#CBD5E1' : '#EA580C',
                  borderRadius: 10,
                  paddingVertical: 13,
                  paddingHorizontal: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: busy ? 0.7 : 1,
                }}
              >
                <BootstrapIcon name={primary.icon || 'arrow-right-circle-fill'} size={15} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>
                  {busy ? 'Working…' : primary.label}
                </Text>
              </TouchableOpacity>
            ) : null}

            {/* Secondary Actions Toolbar */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: primary?.label ? 10 : 0 }}>
              {primary?.secondaryReject && (
                <TouchableOpacity
                  onPress={() => setShowRejectBox(true)}
                  style={[secondaryBtn, { borderColor: isDark ? 'rgba(180, 120, 120, 0.35)' : '#FECACA' }]}
                >
                  <BootstrapIcon name="x-circle" size={13} color="#DC2626" />
                  <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#DC2626' }}>Reject Booking</Text>
                </TouchableOpacity>
              )}

              {primary?.secondaryReschedule && (
                <TouchableOpacity onPress={() => setShowRescheduleBox(!showRescheduleBox)} style={secondaryBtn}>
                  <BootstrapIcon name="calendar-event" size={13} color={tokens?.textPrimary || '#0F172A'} />
                  <Text style={{ fontSize: 12.5, fontWeight: '600', color: tokens?.textPrimary || '#0F172A' }}>
                    Reschedule Date/Time
                  </Text>
                </TouchableOpacity>
              )}

              {primary?.secondaryInspection && (
                <TouchableOpacity
                  onPress={() => {
                    setStatus(FLEX_BOOKING_STATUS.UNDER_INSPECTION);
                    setActiveTab('inspection');
                  }}
                  style={secondaryBtn}
                >
                  <BootstrapIcon name="search" size={13} color={tokens?.textPrimary || '#0F172A'} />
                  <Text style={{ fontSize: 12.5, fontWeight: '600', color: tokens?.textPrimary || '#0F172A' }}>
                    Start Inspection First
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </Section>

          {/* ─────────────────────────────────────────────────────────────
          SECTION 3: BOOKING INFORMATION
      ────────────────────────────────────────────────────────────── */}
          <Section title="Booking Information" tokens={tokens} isDark={isDark}>
            <InfoGrid
              tokens={tokens}
              rows={[
                { label: 'Booking ID', value: bookingId, highlight: true },
                {
                  label: 'Appointment Date',
                  value: formatDateOnly(booking.preferred_date || booking.appointment_date || booking.date),
                },
                {
                  label: 'Time Window',
                  value: booking.preferred_time || booking.time_slot || booking.time || '10:30 AM - 12:00 PM',
                },
                {
                  label: 'Service Hub',
                  value: booking.branch?.replace('MotoTrack ', '') || "D'Blockchain Motorparts",
                },
                {
                  label: 'Booking Type',
                  value: isPmsFixed ? 'PMS (Fixed Rate)' : 'Repair (Quoted)',
                },
                {
                  label: 'Payment Status',
                  value: payStatus,
                  highlight: isDpPaid,
                },
                {
                  label: 'Downpayment',
                  value: isDpPaid
                    ? `₱${dpAmount.toLocaleString()} Paid`
                    : `₱${dpAmount.toLocaleString()} Required`,
                },
                {
                  label: 'Labor Subtotal',
                  value: formatPhp(serviceTotals.labor > 0 ? serviceTotals.labor : basePrice),
                  highlight: true,
                },
              ]}
            />
          </Section>

          {/* ─────────────────────────────────────────────────────────────
          SECTION 4: CUSTOMER INFORMATION
      ────────────────────────────────────────────────────────────── */}
          <Section title="Customer Information" tokens={tokens} isDark={isDark}>
            <InfoRow
              icon="person-fill"
              label="Customer Name"
              value={booking.customer_name || booking.userName || 'Walk-in Customer'}
              tokens={tokens}
            />
            <InfoRow
              icon="telephone-fill"
              label="Contact Phone"
              value={booking.customer_phone || booking.userPhone || 'None provided'}
              tokens={tokens}
            />
            <InfoRow
              icon="envelope-fill"
              label="Email Address"
              value={booking.customer_email || booking.userEmail || 'None provided'}
              tokens={tokens}
            />
            <InfoRow
              icon="geo-alt-fill"
              label="Service Hub / Address"
              value={
                booking.customer_address ||
                booking.address ||
                booking.branch ||
                "D'Blockchain Motorparts and Accessories"
              }
              tokens={tokens}
            />

            {booking.notes ? (
              <View
                style={{
                  marginTop: 6,
                  backgroundColor: isDark ? tokens.bgElevated || '#1E293B' : '#F8FAFC',
                  padding: 10,
                  borderRadius: 8,
                  borderLeftWidth: 3,
                  borderLeftColor: '#EA580C',
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: tokens.textMuted }}>Customer Remarks</Text>
                <Text
                  style={{
                    fontSize: 12.5,
                    color: isDark ? tokens.textPrimary : '#334155',
                    fontStyle: 'italic',
                    marginTop: 2,
                  }}
                >
                  "{booking.notes}"
                </Text>
              </View>
            ) : null}
          </Section>

          {/* ─────────────────────────────────────────────────────────────
          SECTION 5: MOTORCYCLE INFORMATION
      ────────────────────────────────────────────────────────────── */}
          <Section title="Motorcycle Information" tokens={tokens} isDark={isDark}>
            <InfoGrid
              tokens={tokens}
              rows={[
                {
                  label: 'Vehicle Model',
                  value:
                    `${booking.bike_brand || booking.bikeBrand || ''} ${booking.bike_model || booking.bikeModel || ''}`.trim() ||
                    'Honda ADV 160',
                  highlight: true,
                },
                {
                  label: 'License Plate',
                  value: booking.plate_number || booking.bikePlate || 'N/A–RJCX',
                },
                {
                  label: 'Engine Displacement',
                  value:
                    (booking.motorcycle_cc ?? booking.engine_cc ?? booking.cc)
                      ? `${booking.motorcycle_cc ?? booking.engine_cc ?? booking.cc} cc`
                      : '160 cc',
                },
                {
                  label: 'CC Category',
                  value: booking.cc_category_name || booking.cc_category || '150cc - 160cc',
                },
                {
                  label: 'Color & Year',
                  value: `${booking.bike_color || booking.color || 'Standard'} · ${booking.bike_year || booking.year || '2024'}`,
                },
                {
                  label: 'Current Odometer',
                  value: booking.odometer || booking.bikeOdo || '0 km',
                },
              ]}
            />

            {media.length > 0 ? (
              <View style={{ marginTop: 12 }}>
                <Text
                  style={{
                    fontSize: 10.5,
                    fontWeight: '700',
                    color: tokens.textMuted,
                    textTransform: 'uppercase',
                    marginBottom: 6,
                    letterSpacing: 0.5,
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
            ) : null}
          </Section>

          {/* ─────────────────────────────────────────────────────────────
          SECTION 6: REQUESTED SERVICES & PRICING
      ────────────────────────────────────────────────────────────── */}
          <Section
            title={`Requested Services ${lineItems.length > 0 ? `(${lineItems.length})` : ''}`}
            tokens={tokens}
            isDark={isDark}
          >
            {itemsLoading && lineItems.length === 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 }}>
                <ActivityIndicator size="small" color="#EA580C" />
                <Text style={{ fontSize: 12, color: tokens.textMuted }}>Loading service items...</Text>
              </View>
            ) : null}

            {lineItems.length > 0 ? (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: tokens.border || '#E2E8F0',
                  borderRadius: 8,
                  overflow: 'hidden',
                  marginBottom: 10,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    backgroundColor: isDark ? tokens.bgSub : '#F8FAFC',
                    paddingHorizontal: 10,
                    paddingVertical: 7,
                  }}
                >
                  <Text
                    style={{
                      flex: 2.2,
                      fontSize: 10.5,
                      fontWeight: '700',
                      color: tokens.textMuted,
                      textTransform: 'uppercase',
                    }}
                  >
                    Service
                  </Text>
                  <Text
                    style={{
                      flex: 1.2,
                      fontSize: 10.5,
                      fontWeight: '700',
                      color: tokens.textMuted,
                      textTransform: 'uppercase',
                    }}
                  >
                    Category
                  </Text>
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 10.5,
                      fontWeight: '700',
                      color: tokens.textMuted,
                      textAlign: 'right',
                      textTransform: 'uppercase',
                    }}
                  >
                    Rate
                  </Text>
                </View>
                {lineItems.map((item, idx) => (
                  <View
                    key={item.key || idx}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                      borderTopWidth: 1,
                      borderTopColor: tokens.border || '#F1F5F9',
                    }}
                  >
                    <View style={{ flex: 2.2 }}>
                      <Text style={{ fontSize: 12.5, fontWeight: '700', color: tokens.textPrimary || '#0F172A' }}>
                        {item.name}
                      </Text>
                      {item.isAdditional ? (
                        <Text style={{ fontSize: 10, color: '#EA580C', fontWeight: '600' }}>Additional Work</Text>
                      ) : null}
                    </View>
                    <Text style={{ flex: 1.2, fontSize: 11.5, color: tokens.textMuted }}>
                      {item.group || 'General'}
                    </Text>
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 12.5,
                        fontWeight: '600',
                        color: tokens.textPrimary,
                        textAlign: 'right',
                      }}
                    >
                      {formatPhp(item.rate || item.total)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={{ marginBottom: 10 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: tokens.textPrimary }}>
                  {booking.service_title || booking.package_name || 'Periodic Maintenance Service'}
                </Text>
              </View>
            )}

            {/* Pricing Summary */}
            <SummaryLine
              label="Labor Subtotal"
              value={formatPhp(serviceTotals.labor > 0 ? serviceTotals.labor : basePrice)}
              tokens={tokens}
            />
            {serviceTotals.parts > 0 ? (
              <SummaryLine label="Parts Estimate" value={formatPhp(serviceTotals.parts)} tokens={tokens} />
            ) : null}
            {serviceTotals.fees > 0 ? (
              <SummaryLine label="Additional Fees" value={formatPhp(serviceTotals.fees)} tokens={tokens} />
            ) : null}
            <SummaryLine label="Estimated Total" value={formatPhp(finalTotal)} tokens={tokens} isBold />
            {isDpPaid ? (
              <SummaryLine
                label="20% Downpayment (Paid)"
                value={`-₱${dpAmount.toLocaleString()}`}
                tokens={tokens}
                valueColor={isDark ? '#34D399' : '#059669'}
              />
            ) : null}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginTop: 8,
                paddingTop: 8,
                borderTopWidth: 1,
                borderTopColor: tokens.border || '#E2E8F0',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: tokens.textPrimary }}>
                Remaining Balance
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#EA580C' }}>
                ₱
                {remainingBalance.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
            </View>
          </Section>

          {/* ─────────────────────────────────────────────────────────────
          SECTION 7: SPECIALIZED WORKSHOP TOOLS (COLLAPSIBLE / TABS)
      ────────────────────────────────────────────────────────────── */}
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
                    { alignSelf: 'flex-start', backgroundColor: '#EA580C', borderColor: '#EA580C' },
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

      {/* Sticky Fixed Footer: Operational Actions */}
      <View style={styles.fixedFooter}>
        <TouchableOpacity
          onPress={onClose}
          style={styles.footerCloseBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.footerCloseText}>Close</Text>
        </TouchableOpacity>

        <View style={styles.footerActionsGroup}>
          {primary?.secondaryReject && (
            <TouchableOpacity
              onPress={() => setShowRejectBox(true)}
              disabled={busy}
              style={styles.footerRejectBtn}
              activeOpacity={0.8}
            >
              <BootstrapIcon name="x-circle" size={13} color="#DC2626" />
              <Text style={styles.footerRejectText}>Reject Booking</Text>
            </TouchableOpacity>
          )}

          {primary?.secondaryReschedule && (
            <TouchableOpacity
              onPress={() => setShowRescheduleBox(!showRescheduleBox)}
              disabled={busy}
              style={styles.footerRescheduleBtn}
              activeOpacity={0.8}
            >
              <BootstrapIcon name="calendar-event" size={13} color={tokens?.textPrimary || '#0F172A'} />
              <Text style={styles.footerRescheduleText}>Reschedule</Text>
            </TouchableOpacity>
          )}

          {primary?.label ? (
            <TouchableOpacity
              onPress={runPrimary}
              disabled={busy || primary.disabled}
              activeOpacity={0.85}
              style={[
                styles.footerPrimaryBtn,
                primary.disabled && styles.footerPrimaryBtnDisabled,
                busy && { opacity: 0.7 },
              ]}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <BootstrapIcon name={primary.icon || 'arrow-right-circle-fill'} size={14} color="#FFFFFF" />
              )}
              <Text style={styles.footerPrimaryText}>
                {busy ? 'Working…' : primary.label}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.footerTerminalBadge}>
              <Text style={styles.footerTerminalText}>
                {normalizeBookingStatus(status) === FLEX_BOOKING_STATUS.COMPLETED
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
      backgroundColor: isDark ? t.bgSub || '#0B1120' : '#F8FAFC',
    },
    scrollArea: {
      flex: 1,
    },
    scrollContent: {
      padding: 22,
      paddingBottom: 28,
    },
    fixedFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 12,
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
      backgroundColor: '#EA580C',
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
