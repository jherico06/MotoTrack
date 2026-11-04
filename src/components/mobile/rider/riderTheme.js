import { Platform } from 'react-native';
import { fontFamily } from '../../../styles/typography.js';

export const RIDER_BRAND = {
  name: 'MotoTrack',
  racingOrange: '#FF4D00',
  racingOrangePressed: '#E04400',
  racingOrangeSoft: '#FFF1EB',
  racingOrangeBorder: '#FFD6C4',
  racingOrangeTextDark: '#C93B00',
  charcoal: '#202426',
  charcoalSoft: '#2C3134',
  charcoalMuted: '#3A4044',
};

export function getRiderPalette(isDark = false) {
  if (isDark) {
    return {
      isDark: true,
      orange: '#FF4D00',
      orangePressed: '#E04400',
      orangeSoft: 'rgba(255, 77, 0, 0.16)',
      orangeBorder: 'rgba(255, 77, 0, 0.36)',
      orangeText: '#FF6A2B',
      charcoal: '#202426',
      bgCanvas: '#141718',
      bgSheet: '#1B1F21',
      bgCard: '#202426',
      bgMuted: '#282D30',
      bgInput: '#181B1D',
      bgHeader: '#202426',
      headerBorder: '#2B3033',
      headerText: '#FFFFFF',
      headerBtnBg: '#282D30',
      headerBtnBorder: '#363C40',
      headerBtnIcon: '#FFFFFF',
      bgNav: '#202426',
      bgAvatar: '#3B251C',
      avatarText: '#FFB394',
      border: '#2F3538',
      borderStrong: '#3D4448',
      borderSubtle: '#262B2E',
      textPrimary: '#F5F6F7',
      textSecondary: '#C8CFD4',
      textMuted: '#8E979E',
      textSubtle: '#6E777E',
      completedBadgeBg: '#2B3033',
      completedBadgeText: '#D7DCE0',
      completedIconBg: '#2B3033',
      completedIconColor: '#F5F6F7',
      success: '#16A34A',
      successSoft: 'rgba(22, 163, 74, 0.18)',
      successBorder: 'rgba(22, 163, 74, 0.35)',
      successText: '#4ADE80',
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
    orange: '#FF4D00',
    orangePressed: '#E04400',
    orangeSoft: '#FFF1EB',
    orangeBorder: '#FFD6C4',
    orangeText: '#D13F00',
    charcoal: '#202426',
    bgCanvas: '#F7F6F3',
    bgSheet: '#FFFFFF',
    bgCard: '#FFFFFF',
    bgMuted: '#F3F4F5',
    bgInput: '#FFFFFF',
    bgHeader: '#202426', // Charcoal sticky header
    headerBorder: '#2E3438',
    headerText: '#FFFFFF',
    headerBtnBg: '#2C3134',
    headerBtnBorder: '#3A4044',
    headerBtnIcon: '#FFFFFF',
    bgNav: '#FFFFFF',
    bgAvatar: '#FAD6C4',
    avatarText: '#202426',
    border: '#E6E8EA',
    borderStrong: '#D5D9DC',
    borderSubtle: '#EFEFEF',
    textPrimary: '#202426',
    textSecondary: '#495055',
    textMuted: '#687076',
    textSubtle: '#8C949A',
    completedBadgeBg: '#EEF0F2',
    completedBadgeText: '#202426',
    completedIconBg: '#EEF0F2',
    completedIconColor: '#202426',
    success: '#15803D',
    successSoft: '#ECFDF3',
    successBorder: '#BBF7D0',
    successText: '#166534',
    danger: '#DC2626',
    dangerSoft: '#FEF2F2',
    dangerBorder: '#FECACA',
    dangerText: '#B91C1C',
    scrim: 'rgba(32, 36, 38, 0.52)',
    shadowColor: '#202426',
  };
}

export const RIDER_FONT = fontFamily.sans;

export const cardShadowStyle = Platform.select({
  ios: {
    shadowColor: '#202426',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  android: {
    elevation: 2,
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
  return String(delivery?.deliveryStatus || '').trim().toLowerCase() === 'delivered';
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
  const raw = delivery?.expectedDeliveryEndAt || delivery?.expectedDeliveryAt;
  if (!raw) {
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
  if (s === 'delivered') {
    return {
      label: 'Delivered',
      bg: palette.completedBadgeBg,
      text: palette.completedBadgeText,
      border: palette.border,
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
  if (s.includes('out')) {
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
    label: 'Needs confirmation',
    detailLabel: delivery?.deliveryStatus || 'Assigned',
    bg: palette.orangeSoft,
    text: palette.orangeText,
    border: palette.orangeBorder,
    isCompleted: false,
    isUrgent: true,
  };
}

