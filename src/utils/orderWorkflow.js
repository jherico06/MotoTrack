/**
 * Order fulfillment workflow helpers for Admin Order Details modal.
 * Uses real ORDER_STATUSES / transition rules — no invented statuses.
 */

import {
  ORDER_STATUSES,
  canonicalizeStatus,
  isCodPaymentMethod,
} from '../services/orders/orderService.js';

/** Happy-path steps shown in the horizontal progress tracker */
export const FULFILLMENT_STEPS = [
  {
    key: 'pending',
    status: ORDER_STATUSES.PENDING_APPROVAL,
    label: 'Pending Approval',
    shortLabel: 'Pending',
  },
  {
    key: 'processing',
    status: ORDER_STATUSES.PROCESSING,
    label: 'Packing',
    shortLabel: 'Packing',
  },
  {
    key: 'ready',
    status: ORDER_STATUSES.READY,
    label: 'Ready for Delivery',
    shortLabel: 'Ready',
  },
  {
    key: 'out',
    status: ORDER_STATUSES.OUT,
    label: 'Out for Delivery',
    shortLabel: 'Shipped',
  },
  {
    key: 'reported',
    status: ORDER_STATUSES.REPORTED,
    label: 'Delivery Reported',
    shortLabel: 'Reported',
  },
  {
    key: 'delivered',
    status: ORDER_STATUSES.DELIVERED,
    label: 'Delivered',
    shortLabel: 'Delivered',
  },
];

const STEP_INDEX = {
  [ORDER_STATUSES.PENDING_APPROVAL]: 0,
  [ORDER_STATUSES.PROCESSING]: 1,
  [ORDER_STATUSES.READY]: 2,
  [ORDER_STATUSES.OUT]: 3,
  [ORDER_STATUSES.REPORTED]: 4,
  [ORDER_STATUSES.DELIVERED]: 5,
  // Side paths map onto nearest visible step for progress highlighting
  [ORDER_STATUSES.RESCHEDULED]: 2,
  [ORDER_STATUSES.FAILED]: 3,
  [ORDER_STATUSES.RETURN_REQUESTED]: 5,
  [ORDER_STATUSES.REFUNDED]: 5,
  [ORDER_STATUSES.CANCELLED]: -1,
};

export function getStatusExplanation(status) {
  const s = canonicalizeStatus(status);
  switch (s) {
    case ORDER_STATUSES.PENDING_APPROVAL:
      return 'Waiting for admin approval before the order can proceed to packing.';
    case ORDER_STATUSES.PROCESSING:
      return 'Order approved. Items are being prepared / packed for shipment.';
    case ORDER_STATUSES.READY:
      return 'Package is ready to be handed to the courier.';
    case ORDER_STATUSES.OUT:
      return 'Order has been handed to the courier and is in transit.';
    case ORDER_STATUSES.REPORTED:
      return 'Rider reported delivery. Confirm to mark the order as delivered.';
    case ORDER_STATUSES.DELIVERED:
      return 'Customer has received the order. Fulfillment is complete.';
    case ORDER_STATUSES.CANCELLED:
      return 'This order has been cancelled and cannot proceed through fulfillment.';
    case ORDER_STATUSES.FAILED:
      return 'A delivery issue was reported. Reschedule or resolve before continuing.';
    case ORDER_STATUSES.RESCHEDULED:
      return 'Delivery was rescheduled. Mark ready again when prepared for dispatch.';
    case ORDER_STATUSES.RETURN_REQUESTED:
      return 'Customer requested a return. Approve refund or reject the return.';
    case ORDER_STATUSES.REFUNDED:
      return 'Return approved and order refunded. No further fulfillment actions.';
    default:
      return 'Review order details and take the recommended next action.';
  }
}

export function getStatusTone(status, isDark = false) {
  const s = canonicalizeStatus(status);
  const tones = {
    [ORDER_STATUSES.PENDING_APPROVAL]: {
      bg: isDark ? 'rgba(217,119,6,0.15)' : '#FFFBEB',
      border: isDark ? 'rgba(217,119,6,0.35)' : '#FDE68A',
      color: isDark ? '#E0B35C' : '#B45309',
      icon: 'clock-fill',
    },
    [ORDER_STATUSES.PROCESSING]: {
      bg: isDark ? 'rgba(37,99,235,0.15)' : '#EFF6FF',
      border: isDark ? 'rgba(37,99,235,0.35)' : '#BFDBFE',
      color: isDark ? '#6BA8D4' : '#1D4ED8',
      icon: 'box-seam-fill',
    },
    [ORDER_STATUSES.READY]: {
      bg: isDark ? 'rgba(14,165,233,0.15)' : '#F0F9FF',
      border: isDark ? 'rgba(14,165,233,0.35)' : '#BAE6FD',
      color: isDark ? '#7DD3FC' : '#0369A1',
      icon: 'clipboard-check',
    },
    [ORDER_STATUSES.OUT]: {
      bg: isDark ? 'rgba(99,102,241,0.15)' : '#EEF2FF',
      border: isDark ? 'rgba(99,102,241,0.35)' : '#C7D2FE',
      color: isDark ? '#A5B4FC' : '#4338CA',
      icon: 'truck',
    },
    [ORDER_STATUSES.REPORTED]: {
      bg: isDark ? 'rgba(124,58,237,0.15)' : '#F5F3FF',
      border: isDark ? 'rgba(124,58,237,0.35)' : '#DDD6FE',
      color: isDark ? '#C4B5FD' : '#6D28D9',
      icon: 'clipboard-check',
    },
    [ORDER_STATUSES.DELIVERED]: {
      bg: isDark ? 'rgba(16,185,129,0.15)' : '#ECFDF5',
      border: isDark ? 'rgba(16,185,129,0.35)' : '#A7F3D0',
      color: isDark ? '#4DB896' : '#047857',
      icon: 'check-circle-fill',
    },
    [ORDER_STATUSES.CANCELLED]: {
      bg: isDark ? 'rgba(220,38,38,0.15)' : '#FEF2F2',
      border: isDark ? 'rgba(220,38,38,0.35)' : '#FECACA',
      color: isDark ? '#E07A7A' : '#DC2626',
      icon: 'x-circle-fill',
    },
    [ORDER_STATUSES.FAILED]: {
      bg: isDark ? 'rgba(220,38,38,0.15)' : '#FFF1F2',
      border: isDark ? 'rgba(220,38,38,0.35)' : '#FECDD3',
      color: isDark ? '#E07A7A' : '#BE123C',
      icon: 'exclamation-triangle-fill',
    },
    [ORDER_STATUSES.RESCHEDULED]: {
      bg: isDark ? 'rgba(217,119,6,0.15)' : '#FFF7ED',
      border: isDark ? 'rgba(217,119,6,0.35)' : '#FFEDD5',
      color: isDark ? '#E0B35C' : '#C2410C',
      icon: 'calendar-event-fill',
    },
    [ORDER_STATUSES.RETURN_REQUESTED]: {
      bg: isDark ? 'rgba(217,119,6,0.15)' : '#FFF7ED',
      border: isDark ? 'rgba(217,119,6,0.35)' : '#FED7AA',
      color: isDark ? '#E0B35C' : '#9A3412',
      icon: 'arrow-return-left',
    },
    [ORDER_STATUSES.REFUNDED]: {
      bg: isDark ? 'rgba(100,116,139,0.2)' : '#F1F5F9',
      border: isDark ? 'rgba(100,116,139,0.35)' : '#CBD5E1',
      color: isDark ? '#94A3B8' : '#475569',
      icon: 'cash',
    },
  };
  return (
    tones[s] || {
      bg: isDark ? 'rgba(100,116,139,0.2)' : '#F8FAFC',
      border: isDark ? 'rgba(100,116,139,0.35)' : '#E2E8F0',
      color: isDark ? '#94A3B8' : '#334155',
      icon: 'info-circle-fill',
    }
  );
}

export function getStepStates(status) {
  const s = canonicalizeStatus(status);
  const currentIdx = STEP_INDEX[s];
  const isCancelled = s === ORDER_STATUSES.CANCELLED;
  const isException = s === ORDER_STATUSES.FAILED || s === ORDER_STATUSES.RESCHEDULED;

  return FULFILLMENT_STEPS.map((step, idx) => {
    let state = 'upcoming'; // upcoming | current | done | failed
    if (isCancelled) {
      state = idx === 0 ? 'done' : 'failed';
    } else if (currentIdx == null || currentIdx < 0) {
      state = 'upcoming';
    } else if (idx < currentIdx) {
      state = 'done';
    } else if (idx === currentIdx) {
      state = isException && (s === ORDER_STATUSES.FAILED) ? 'failed' : 'current';
    } else {
      state = 'upcoming';
    }
    return { ...step, state, index: idx };
  });
}

function hasRider(order, deliveryDetail) {
  return Boolean(
    deliveryDetail?.rider_id ||
      deliveryDetail?.rider_name ||
      order?.rider_id ||
      order?.rider_name
  );
}

/**
 * Resolve the single primary next action for an order.
 * Secondary / danger actions are handled separately in the modal.
 */
export function resolvePrimaryAction(order, deliveryDetail = null) {
  if (!order) return null;
  const status = canonicalizeStatus(order.status);
  const riderAssigned = hasRider(order, deliveryDetail);
  const riderReported = Boolean(
    deliveryDetail?.rider_reported_delivered || status === ORDER_STATUSES.REPORTED
  );

  if (status === ORDER_STATUSES.CANCELLED) {
    return {
      id: 'cancelled',
      kind: 'none',
      label: null,
      disabled: true,
      blockedReason: order.cancel_reason
        ? `Cancelled: ${order.cancel_reason}`
        : 'This order can no longer proceed through the normal fulfillment workflow.',
    };
  }

  if (status === ORDER_STATUSES.REFUNDED) {
    return {
      id: 'refunded',
      kind: 'none',
      label: null,
      disabled: true,
      blockedReason: 'Order has been refunded. No further fulfillment actions.',
    };
  }

  if (status === ORDER_STATUSES.DELIVERED) {
    return {
      id: 'complete',
      kind: 'none',
      label: null,
      disabled: true,
      blockedReason: null,
      completeMessage: 'Order process is complete.',
    };
  }

  if (status === ORDER_STATUSES.PENDING_APPROVAL) {
    const isCod = isCodPaymentMethod(order.payment_method);
    return {
      id: 'approve',
      kind: 'approve',
      label: isCod ? 'Approve Order' : 'Approve Order',
      nextStatus: ORDER_STATUSES.PROCESSING,
      needsConfirm: true,
      confirmTitle: 'Approve Order?',
      confirmBody: `You are about to approve order ${order.order_id || order.id}. After approval, the order will move to Packing.`,
      confirmText: 'Approve Order',
      hint: isCod
        ? 'Verify recipient details for this COD order before approving.'
        : 'Approve to send this order to packing.',
    };
  }

  if (status === ORDER_STATUSES.PROCESSING) {
    return {
      id: 'mark_ready',
      kind: 'advance',
      label: 'Mark as Ready for Delivery',
      nextStatus: ORDER_STATUSES.READY,
      needsConfirm: true,
      confirmTitle: 'Mark Ready for Delivery?',
      confirmBody: `Order ${order.order_id || order.id} will move to Ready for Delivery.`,
      confirmText: 'Mark as Ready',
      hint: 'Confirm packing is finished before marking ready.',
    };
  }

  if (status === ORDER_STATUSES.RESCHEDULED) {
    return {
      id: 'mark_ready_reschedule',
      kind: 'advance',
      label: 'Mark as Ready for Delivery',
      nextStatus: ORDER_STATUSES.READY,
      needsConfirm: true,
      confirmTitle: 'Mark Ready for Delivery?',
      confirmBody: `Order ${order.order_id || order.id} was rescheduled and will move back to Ready for Delivery.`,
      confirmText: 'Mark as Ready',
      hint: 'Confirm the order is ready to be dispatched again.',
    };
  }

  if (status === ORDER_STATUSES.READY) {
    if (!riderAssigned) {
      return {
        id: 'assign_rider',
        kind: 'assign_rider',
        label: 'Assign Rider',
        needsConfirm: false,
        hint: 'Assign a courier before marking the order as shipped.',
        blockedReason: null,
      };
    }
    return {
      id: 'mark_shipped',
      kind: 'advance',
      label: 'Mark as Shipped',
      nextStatus: ORDER_STATUSES.OUT,
      needsConfirm: true,
      confirmTitle: 'Mark as Shipped?',
      confirmBody: `Order ${order.order_id || order.id} will move to Out for Delivery.`,
      confirmText: 'Mark as Shipped',
      hint: 'Hand the package to the assigned courier, then mark shipped.',
    };
  }

  if (status === ORDER_STATUSES.OUT) {
    if (riderReported) {
      return {
        id: 'confirm_delivery',
        kind: 'confirm_delivery',
        label: 'Confirm Delivery',
        needsConfirm: false,
        hint: 'Rider report received. Open confirmation to mark delivered.',
      };
    }
    return {
      id: 'await_report',
      kind: 'log_rider_report',
      label: 'Log Rider Report',
      needsConfirm: false,
      hint: 'Waiting for the rider to report delivery. You can log a report manually if needed.',
      infoBanner:
        'Shipped orders become Delivered only after a delivery report is confirmed — status cannot jump from Out for Delivery to Delivered.',
    };
  }

  if (status === ORDER_STATUSES.REPORTED) {
    return {
      id: 'confirm_delivery',
      kind: 'confirm_delivery',
      label: 'Confirm Delivery',
      needsConfirm: false,
      hint: 'Review proof of delivery, then confirm in the next step.',
    };
  }

  if (status === ORDER_STATUSES.FAILED) {
    return {
      id: 'reschedule',
      kind: 'advance',
      label: 'Reschedule Delivery',
      nextStatus: ORDER_STATUSES.RESCHEDULED,
      needsConfirm: true,
      confirmTitle: 'Reschedule Delivery?',
      confirmBody: `Order ${order.order_id || order.id} will move to Rescheduled.`,
      confirmText: 'Reschedule',
      hint: 'Resolve the delivery issue, then reschedule.',
    };
  }

  if (status === ORDER_STATUSES.RETURN_REQUESTED) {
    return {
      id: 'approve_refund',
      kind: 'return_approve',
      label: 'Approve Refund',
      needsConfirm: true,
      confirmTitle: 'Approve Refund?',
      confirmBody: `Approve the return and refund for order ${order.order_id || order.id}.`,
      confirmText: 'Approve Refund',
      hint: order.return_reason || 'Customer requested a return.',
      secondaryReturnReject: true,
    };
  }

  return null;
}

function formatWhen(isoOrDate) {
  if (!isoOrDate) return null;
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) {
    // Already a display string like "Oct 2, 2026"
    return String(isoOrDate);
  }
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Build activity timeline from real order + delivery history only.
 * No fabricated timestamps.
 */
export function buildOrderActivity(order, deliveryDetail = null, deliveryHistory = []) {
  if (!order) return [];
  const status = canonicalizeStatus(order.status);
  const items = [];

  const placedAt = order.created_at || order.order_date || null;
  items.push({
    id: 'placed',
    title: 'Order placed',
    when: formatWhen(placedAt),
    done: true,
    current: status === ORDER_STATUSES.PENDING_APPROVAL,
    by: null,
  });

  // History rows (newest first from service) — reverse for chronological
  const hist = [...(deliveryHistory || [])].sort(
    (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)
  );

  hist.forEach((h, idx) => {
    const title =
      h.action ||
      (h.new_status ? `Status → ${h.new_status}` : null) ||
      'Delivery update';
    items.push({
      id: `hist-${h.id || idx}`,
      title,
      when: formatWhen(h.created_at),
      done: true,
      current: false,
      by: h.performed_by || null,
      notes: h.notes || null,
    });
  });

  if (deliveryDetail?.rider_reported_at) {
    const already = items.some(
      (i) => i.when === formatWhen(deliveryDetail.rider_reported_at) && /report/i.test(i.title)
    );
    if (!already) {
      items.push({
        id: 'rider-report',
        title: 'Rider reported delivery',
        when: formatWhen(deliveryDetail.rider_reported_at),
        done: true,
        current: status === ORDER_STATUSES.REPORTED,
        by: deliveryDetail.rider_reported_by || deliveryDetail.rider_name || null,
        notes: deliveryDetail.rider_report_notes || null,
      });
    }
  }

  if (deliveryDetail?.admin_confirmed_at) {
    items.push({
      id: 'admin-confirm',
      title: 'Admin confirmed delivery',
      when: formatWhen(deliveryDetail.admin_confirmed_at),
      done: true,
      current: false,
      by: deliveryDetail.confirmed_by_admin || null,
      notes: deliveryDetail.admin_confirmed_reason || null,
    });
  }

  if (order.delivered_at && status === ORDER_STATUSES.DELIVERED) {
    const already = items.some((i) => /delivered/i.test(i.title) && i.when === formatWhen(order.delivered_at));
    if (!already) {
      items.push({
        id: 'delivered',
        title: 'Order delivered',
        when: formatWhen(order.delivered_at),
        done: true,
        current: false,
        by: null,
      });
    }
  }

  // Current in-progress marker when not terminal
  const terminal = [
    ORDER_STATUSES.DELIVERED,
    ORDER_STATUSES.CANCELLED,
    ORDER_STATUSES.REFUNDED,
  ].includes(status);
  if (!terminal) {
    const lastIsCurrent = items.some((i) => i.current);
    if (!lastIsCurrent) {
      items.push({
        id: 'current',
        title: canonicalizeStatus(order.status),
        when: null,
        done: false,
        current: true,
        by: null,
        inProgress: true,
      });
    }
  }

  if (status === ORDER_STATUSES.CANCELLED) {
    items.push({
      id: 'cancelled',
      title: 'Order cancelled',
      when: formatWhen(order.updated_at || order.cancelled_at),
      done: true,
      current: true,
      failed: true,
      by: null,
      notes: order.cancel_reason || null,
    });
  }

  return items;
}

export function canCancelOrder(status) {
  const s = canonicalizeStatus(status);
  return ![
    ORDER_STATUSES.DELIVERED,
    ORDER_STATUSES.CANCELLED,
    ORDER_STATUSES.REFUNDED,
    ORDER_STATUSES.RETURN_REQUESTED,
  ].includes(s);
}

export { ORDER_STATUSES, canonicalizeStatus, isCodPaymentMethod };
