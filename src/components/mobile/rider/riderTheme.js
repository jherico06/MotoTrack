import { Platform } from 'react-native';
import { fontFamily } from '../../../styles/typography.js';

export const RIDER_BRAND = {
  name: 'MotoTrack',
  racingOrange: '#EA580C',
  racingOrangePressed: '#C2410C',
  racingOrangeSoft: '#FFF7ED',
  racingOrangeBorder: '#FED7AA',
  racingOrangeTextDark: '#C2410C',
  charcoal: '#141D2E',
  charcoalSoft: '#1E2534',
  charcoalMuted: '#334155',
};

export function getRiderPalette(isDark = false) {
  if (isDark) {
    return {
      isDark: true,
      orange: '#EA580C',
      orangePressed: '#C2410C',
      orangeSoft: 'rgba(234, 88, 12, 0.16)',
      orangeBorder: 'rgba(234, 88, 12, 0.36)',
      orangeText: '#FB923C',
      charcoal: '#EA580C',
      pillActiveBg: '#EA580C',
      pillTrackBg: '#1E2025',
      bgCanvas: '#121518',
      bgSheet: '#191C21',
      bgCard: '#191C21',
      bgMuted: '#22262C',
      bgInput: '#15181C',
      bgHeader: '#121518',
      headerBorder: 'transparent',
      headerText: '#F9FAFB',
      headerBtnBg: '#1C1F23',
      headerBtnBorder: '#2B3035',
      headerBtnIcon: '#F9FAFB',
      bgNav: '#181A20',
      bgAvatar: '#3B251C',
      avatarText: '#FDBA74',
      border: '#2B3035',
      borderStrong: '#383E46',
      borderSubtle: '#22262C',
      textPrimary: '#F9FAFB',
      textSecondary: '#CBD5E1',
      textMuted: '#94A3B8',
      textSubtle: '#64748B',
      completedBadgeBg: 'rgba(16, 185, 129, 0.16)',
      completedBadgeText: '#34D399',
      completedIconBg: 'rgba(16, 185, 129, 0.16)',
      completedIconColor: '#34D399',
      success: '#10B981',
      successSoft: 'rgba(16, 185, 129, 0.16)',
      successBorder: 'rgba(16, 185, 129, 0.35)',
      successText: '#34D399',
      danger: '#EF4444',
      dangerSoft: 'rgba(239, 68, 68, 0.16)',
      dangerBorder: 'rgba(239, 68, 68, 0.35)',
      dangerText: '#FCA5A5',
      scrim: 'rgba(8, 10, 12, 0.72)',
      shadowColor: '#000000',
    };
  }

  return {
    isDark: false,
    orange: '#EA580C',
    orangePressed: '#C2410C',
    orangeSoft: '#FFF7ED',
    orangeBorder: '#FED7AA',
    orangeText: '#EA580C',
    charcoal: '#141D2E',
    pillActiveBg: '#141D2E',
    pillTrackBg: '#EFECE6',
    bgCanvas: '#F7F5F0',
    bgSheet: '#FFFFFF',
    bgCard: '#FFFFFF',
    bgMuted: '#F5F3EE',
    bgInput: '#F9F8F5',
    bgHeader: '#F7F5F0',
    headerBorder: 'transparent',
    headerText: '#18181B',
    headerBtnBg: '#FFFFFF',
    headerBtnBorder: '#EDE9E0',
    headerBtnIcon: '#18181B',
    bgNav: '#181A20',
    bgAvatar: '#FFF1EB',
    avatarText: '#EA580C',
    border: '#EDE9E0',
    borderStrong: '#E2DDD3',
    borderSubtle: '#F3F1EC',
    textPrimary: '#18181B',
    textSecondary: '#475569',
    textMuted: '#64748B',
    textSubtle: '#94A3B8',
    completedBadgeBg: '#E8F7EE',
    completedBadgeText: '#0E7A4B',
    completedIconBg: '#E8F7EE',
    completedIconColor: '#0E7A4B',
    success: '#059669',
    successSoft: '#ECFDF5',
    successBorder: '#A7F3D0',
    successText: '#065F46',
    danger: '#DC2626',
    dangerSoft: '#FEF2F2',
    dangerBorder: '#FECACA',
    dangerText: '#B91C1C',
    scrim: 'rgba(15, 23, 42, 0.48)',
    shadowColor: '#0F172A',
  };
}

export const RIDER_FONTS = {
  regular: Platform.select({
    web: fontFamily.sans,
    default: 'GoogleSansFlex-Regular',
  }),
  medium: Platform.select({
    web: fontFamily.sans,
    default: 'GoogleSansFlex-Medium',
  }),
  semiBold: Platform.select({
    web: fontFamily.sans,
    default: 'GoogleSansFlex-SemiBold',
  }),
  bold: Platform.select({
    web: fontFamily.sans,
    default: 'GoogleSansFlex-Bold',
  }),
};

export const RIDER_FONT = RIDER_FONTS.regular;

/**
 * Returns platform-safe typography font properties for Rider mobile UI.
 * Native iOS/Android use explicit weight-mapped fontFamily names with no fontWeight
 * so Expo static fonts render true Medium/SemiBold/Bold weights instead of 400.
 */
export function riderFont(weight = '400') {
  const key = String(weight || '400').toLowerCase();
  let family = RIDER_FONTS.regular;
  let webWeight = '400';

  if (
    key === '700' ||
    key === '800' ||
    key === '900' ||
    key === 'bold' ||
    key === 'extrabold'
  ) {
    family = RIDER_FONTS.bold;
    webWeight = '700';
  } else if (key === '600' || key === 'semibold') {
    family = RIDER_FONTS.semiBold;
    webWeight = '600';
  } else if (key === '500' || key === 'medium') {
    family = RIDER_FONTS.medium;
    webWeight = '500';
  }

  return Platform.OS === 'web'
    ? { fontFamily: family, fontWeight: webWeight }
    : { fontFamily: family };
}

export const cardShadowStyle = Platform.select({
  ios: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  android: {
    elevation: 1,
  },
  default: {},
});

export function formatPhp(amount) {
  const n = Number(amount) || 0;
  return `₱${n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function formatPhpExact(amount) {
  const n = Number(amount) || 0;
  return `₱${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatOrderCode(orderId) {
  const clean = String(orderId || '')
    .trim()
    .replace(/^#+/, '');
  return clean || 'ORD-0000';
}

export function isDeliveredOrder(delivery) {
  const ds = String(delivery?.deliveryStatus || '').trim().toLowerCase();
  const os = String(delivery?.orderStatus || '').trim().toLowerCase();
  return ds === 'delivered' || os === 'delivered' || os === 'completed';
}

export function isCancelledOrder(delivery) {
  const ds = String(delivery?.deliveryStatus || '').trim().toLowerCase();
  const os = String(delivery?.orderStatus || '').trim().toLowerCase();
  return (
    ds.includes('cancel') ||
    os.includes('cancel') ||
    ds === 'refunded' ||
    os === 'refunded'
  );
}

/**
 * Returns true once an order has been marked as shipped / out for delivery
 * (or reached a post-shipped stage such as reported/delivered/failed).
 * Orders still in Pending Approval, Processing, Ready for Delivery, Assigned,
 * Accepted, or Rescheduled return false so riders see them as "Need to pick up".
 */
export function isOrderMarkedShipped(orderStatus, deliveryStatus) {
  const oRaw = String(orderStatus || '').trim().toLowerCase();
  const dRaw = String(deliveryStatus || '').trim().toLowerCase();

  if (oRaw) {
    return (
      oRaw === 'shipped' ||
      oRaw === 'in transit' ||
      oRaw.includes('transit') ||
      oRaw.includes('out') ||
      oRaw.includes('report') ||
      oRaw === 'delivered' ||
      oRaw === 'completed' ||
      oRaw.includes('fail') ||
      oRaw.includes('issue')
    );
  }

  return (
    dRaw === 'shipped' ||
    dRaw === 'in transit' ||
    dRaw.includes('transit') ||
    dRaw.includes('out') ||
    dRaw.includes('report') ||
    dRaw === 'delivered' ||
    dRaw === 'completed' ||
    dRaw.includes('fail') ||
    dRaw.includes('issue')
  );
}

/**
 * Reconciles a rider delivery card against the authoritative `orders.status`
 * so any order not yet marked as Shipped / Out for Delivery renders as
 * "Need to pick up".
 */
export function reconcileDeliveryWithOrderStatus(delivery, orderStatus) {
  if (!delivery) return delivery;
  const resolvedOrderStatus = String(
    orderStatus || delivery.orderStatus || ''
  ).trim();
  const oRaw = resolvedOrderStatus.toLowerCase();

  if (oRaw === 'delivered' || oRaw === 'completed') {
    return {
      ...delivery,
      orderStatus: resolvedOrderStatus,
      deliveryStatus: 'Delivered',
    };
  }
  if (oRaw.includes('cancel')) {
    return {
      ...delivery,
      orderStatus: resolvedOrderStatus,
      deliveryStatus: 'Cancelled',
    };
  }
  if (oRaw === 'refunded') {
    return {
      ...delivery,
      orderStatus: resolvedOrderStatus,
      deliveryStatus: 'Refunded',
    };
  }
  if (oRaw.includes('fail') || oRaw.includes('issue')) {
    return {
      ...delivery,
      orderStatus: resolvedOrderStatus,
      deliveryStatus: 'Delivery Failed',
    };
  }
  if (oRaw.includes('report')) {
    return {
      ...delivery,
      orderStatus: resolvedOrderStatus,
      deliveryStatus: 'Delivery Reported',
    };
  }
  if (!isOrderMarkedShipped(resolvedOrderStatus, delivery.deliveryStatus)) {
    return {
      ...delivery,
      ...(resolvedOrderStatus ? { orderStatus: resolvedOrderStatus } : {}),
      deliveryStatus: 'Need to pick up',
    };
  }
  return {
    ...delivery,
    ...(resolvedOrderStatus ? { orderStatus: resolvedOrderStatus } : {}),
  };
}

export function isNeedsPickupOrder(delivery) {
  if (isDeliveredOrder(delivery) || isCancelledOrder(delivery)) return false;
  const s = String(delivery?.deliveryStatus || '').trim().toLowerCase();
  if (s.includes('fail') || s.includes('issue') || s.includes('report')) {
    return false;
  }
  if (!isOrderMarkedShipped(delivery?.orderStatus, delivery?.deliveryStatus)) {
    return true;
  }
  if (!s) return true;
  if (
    s.includes('out') ||
    s.includes('shipped') ||
    s.includes('transit') ||
    s.includes('way')
  ) {
    return false;
  }
  return true;
}

export function isCodOrder(delivery) {
  const method = String(delivery?.paymentMethod || '').toLowerCase();
  const status = String(delivery?.paymentStatus || '').toLowerCase();
  return (
    method.includes('cod') ||
    method.includes('cash') ||
    status.includes('cod') ||
    status.includes('unpaid')
  );
}

export function getGreetingByHour(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function formatHeroDate(date = new Date()) {
  const days = [
    'SUNDAY',
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
  ];
  const months = [
    'JANUARY',
    'FEBRUARY',
    'MARCH',
    'APRIL',
    'MAY',
    'JUNE',
    'JULY',
    'AUGUST',
    'SEPTEMBER',
    'OCTOBER',
    'NOVEMBER',
    'DECEMBER',
  ];
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
}

export function getFirstName(fullName, fallback = 'Rider') {
  const clean = String(fullName || '')
    .split('(')[0]
    .trim();
  if (!clean) return fallback;
  return clean.split(/\s+/)[0] || fallback;
}

export function getInitials(fullName) {
  const clean = String(fullName || '')
    .split('(')[0]
    .trim();
  if (!clean) return 'MT';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatClock(date) {
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatActiveDeadlineLabel(delivery) {
  if (isCancelledOrder(delivery)) return 'Order cancelled';
  const raw = delivery?.expectedDeliveryEndAt || delivery?.expectedDeliveryAt;
  if (!raw) {
    if (isNeedsPickupOrder(delivery)) return 'Need to pick up · Store hub';
    const s = String(delivery?.deliveryStatus || '').toLowerCase();
    if (s.includes('out')) return 'Out for delivery today';
    return 'Today · Ready for drop-off';
  }
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return 'Scheduled today';

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const hasExplicitTime =
    dt.getHours() !== 0 || dt.getMinutes() !== 0 || String(raw).includes('T');
  const timePart = hasExplicitTime ? formatClock(dt) : '5:30 PM';

  if (isSameDay(dt, now)) {
    return `Today, ${timePart}`;
  }
  if (isSameDay(dt, tomorrow)) {
    return `Tomorrow, ${timePart}`;
  }
  const datePart = dt.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  return `${datePart}, ${timePart}`;
}

export function formatCompletedTimeLabel(delivery) {
  const raw = delivery?.deliveredAt;
  if (!raw) return 'Delivered';
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return 'Delivered';

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (isSameDay(dt, now)) {
    return `Delivered at ${formatClock(dt)}`;
  }
  if (isSameDay(dt, yesterday)) {
    return 'Delivered yesterday';
  }
  return `Delivered ${dt.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })}`;
}

export function getOrderStatusBadge(delivery, palette) {
  const s = String(delivery?.deliveryStatus || '').toLowerCase();
  if (isDeliveredOrder(delivery) || s === 'delivered') {
    return {
      label: 'Delivered',
      bg: palette.completedBadgeBg,
      text: palette.completedBadgeText,
      border: palette.border,
      isCompleted: true,
      isUrgent: false,
    };
  }
  if (isCancelledOrder(delivery)) {
    const isRefund = s === 'refunded' || String(delivery?.orderStatus || '').toLowerCase() === 'refunded';
    return {
      label: isRefund ? 'Refunded' : 'Cancelled',
      detailLabel: isRefund ? 'Refunded' : 'Cancelled',
      bg: palette.dangerSoft,
      text: palette.dangerText,
      border: palette.dangerBorder,
      isCompleted: true,
      isUrgent: false,
    };
  }
  if (s.includes('fail') || s.includes('issue')) {
    return {
      label: 'Delivery issue',
      bg: palette.dangerSoft,
      text: palette.dangerText,
      border: palette.dangerBorder,
      isCompleted: false,
      isUrgent: true,
    };
  }
  if (s.includes('report')) {
    return {
      label: 'Reported',
      bg: palette.orangeSoft,
      text: palette.orangeText,
      border: palette.orangeBorder,
      isCompleted: false,
      isUrgent: false,
    };
  }
  if (isNeedsPickupOrder(delivery)) {
    return {
      label: 'Need to pick up',
      detailLabel: delivery?.orderStatus || delivery?.deliveryStatus || 'Need to pick up',
      bg: palette.isDark ? 'rgba(245, 158, 11, 0.16)' : '#FEF3C7',
      text: palette.isDark ? '#FBBF24' : '#B45309',
      border: palette.isDark ? 'rgba(245, 158, 11, 0.35)' : '#FDE68A',
      isCompleted: false,
      isUrgent: true,
    };
  }
  if (s.includes('out') || s.includes('shipped') || s.includes('transit')) {
    return {
      label: 'Needs confirmation',
      detailLabel: 'Out for delivery',
      bg: palette.orangeSoft,
      text: palette.orangeText,
      border: palette.orangeBorder,
      isCompleted: false,
      isUrgent: true,
    };
  }
  return {
    label: 'Need to pick up',
    detailLabel: delivery?.deliveryStatus || 'Need to pick up',
    bg: palette.isDark ? 'rgba(245, 158, 11, 0.16)' : '#FEF3C7',
    text: palette.isDark ? '#FBBF24' : '#B45309',
    border: palette.isDark ? 'rgba(245, 158, 11, 0.35)' : '#FDE68A',
    isCompleted: false,
    isUrgent: true,
  };
}

