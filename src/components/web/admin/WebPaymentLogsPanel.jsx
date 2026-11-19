import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import BootstrapIcon from '../../common/BootstrapIcon.jsx';
import { supabaseManager } from '../../../lib/supabase.js';
import { fontFamily } from '../../../styles/typography.js';
import {
  bookingPaymentStatus,
  bookingQuotationTotal,
  FLEX_BOOKING_STATUS,
  normalizeBookingStatus,
} from '../../../utils/bookingWorkflow.js';

const PAYMENTS_TTL_MS = 30000;
let paymentsCache = { at: 0, rows: [] };
let inflightPaymentsPromise = null;

const EXTENDED_PAYMENT_COLUMNS =
  'payment_id,order_id,booking_id,customer_id,payment_method,amount,reference_number,transaction_reference,gateway_transaction_id,payment_type,status,payment_date,created_at,verified_at,verified_by,received_by,notes,refund_amount,refund_status,refund_reason,refunded_at';
const CORE_PAYMENT_COLUMNS =
  'payment_id,order_id,booking_id,customer_id,payment_method,amount,reference_number,transaction_reference,payment_type,status,payment_date,created_at,verified_at,received_by,notes';

function formatPhp(amount) {
  const num = Number(amount) || 0;
  return `₱${num.toLocaleString(undefined, {
    minimumFractionDigits: num % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatShortDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function isGcashMethod(method) {
  return String(method || '').toLowerCase().includes('gcash');
}

function isCodMethod(method) {
  const lower = String(method || '').toLowerCase();
  return lower.includes('cod') || lower.includes('cash on delivery');
}

function extractBookingRefFromNotes(notes) {
  const match = String(notes || '').match(/BookingRef:\s*([A-Za-z0-9_-]+)/i);
  return match ? match[1] : null;
}

function normalizePaymentStatus(row) {
  const refundStatus = String(row?.refund_status || '').toLowerCase();
  if (Number(row?.refund_amount || 0) > 0 || refundStatus.includes('refunded')) {
    return refundStatus.includes('partial') ? 'Partially Refunded' : 'Refunded';
  }
  const raw = String(row?.status || '').trim().toLowerCase();
  if (raw === 'completed' || raw === 'paid' || raw === 'settled' || raw === 'verified') {
    return 'Completed';
  }
  if (raw === 'failed' || raw === 'expired' || raw === 'cancelled' || raw === 'void') {
    return 'Failed';
  }
  return 'Pending';
}

function isWithinDateRange(iso, rangeKey) {
  if (rangeKey === 'all') return true;
  if (!iso) return false;
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return false;
  const now = new Date();
  if (rangeKey === 'today') {
    return (
      dt.getFullYear() === now.getFullYear() &&
      dt.getMonth() === now.getMonth() &&
      dt.getDate() === now.getDate()
    );
  }
  const days = rangeKey === '7d' ? 7 : 30;
  return now.getTime() - dt.getTime() <= days * 24 * 60 * 60 * 1000;
}

function escapeCsvCell(value) {
  const str = String(value ?? '').replace(/"/g, '""');
  return `"${str}"`;
}

function triggerCsvDownload(filename, headers, rows) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return false;
  const csvLines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((r) => r.map(escapeCsvCell).join(',')),
  ];
  const blob = new Blob(['\uFEFF' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}

async function fetchPaymentRowsFromSupabase({ force = false } = {}) {
  if (!force) {
    if (paymentsCache.at > 0 && Date.now() - paymentsCache.at < PAYMENTS_TTL_MS) {
      return { rows: paymentsCache.rows, error: null };
    }
    if (inflightPaymentsPromise) {
      return inflightPaymentsPromise;
    }
  }

  const client = supabaseManager.getClient();
  if (!client) {
    return { rows: paymentsCache.rows || [], error: 'Supabase client unavailable — showing cached order & booking records.' };
  }

  inflightPaymentsPromise = (async () => {
    try {
      let { data, error } = await client
        .from('payments')
        .select(EXTENDED_PAYMENT_COLUMNS)
        .order('payment_date', { ascending: false })
        .limit(250);

      if (error && (error.code === '42703' || /column/i.test(String(error.message || '')))) {
        const retry = await client
          .from('payments')
          .select(CORE_PAYMENT_COLUMNS)
          .order('payment_date', { ascending: false })
          .limit(250);
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        return { rows: paymentsCache.rows || [], error: error.message || 'Unable to load payment records.' };
      }

      const safeRows = Array.isArray(data) ? data : [];
      paymentsCache = { at: Date.now(), rows: safeRows };
      return { rows: safeRows, error: null };
    } catch (err) {
      return { rows: paymentsCache.rows || [], error: err?.message || 'Unable to load payment records.' };
    } finally {
      inflightPaymentsPromise = null;
    }
  })();

  return inflightPaymentsPromise;
}

const LOG_CATEGORY_META = {
  online_gcash: {
    label: 'Online Order GCash',
    shortLabel: 'Online GCash',
    icon: 'phone-fill',
    color: '#0284C7',
    darkColor: '#38BDF8',
    bg: '#E0F2FE',
    darkBg: 'rgba(56, 189, 248, 0.14)',
  },
  downpayment: {
    label: 'Booking Downpayment',
    shortLabel: 'Downpayment',
    icon: 'calendar2-check-fill',
    color: '#EA580C',
    darkColor: '#FF5A00',
    bg: '#FFF7ED',
    darkBg: 'rgba(255, 90, 0, 0.16)',
  },
  final_balance: {
    label: 'Final Balance',
    shortLabel: 'Balance',
    icon: 'cash-stack',
    color: '#059669',
    darkColor: '#00C98D',
    bg: '#ECFDF5',
    darkBg: 'rgba(0, 201, 141, 0.15)',
  },
  cod_pos: {
    label: 'COD / POS / Other',
    shortLabel: 'COD / POS',
    icon: 'receipt',
    color: '#475569',
    darkColor: '#A1A1AA',
    bg: '#F1F5F9',
    darkBg: '#202124',
  },
};

function getStatusPillStyle(status, isDarkMode) {
  if (status === 'Completed' || status === 'Balance Paid' || status === 'Downpayment Paid' || status === 'GCash Paid') {
    return {
      label: status === 'Completed' ? 'Paid' : status,
      color: isDarkMode ? '#00C98D' : '#059669',
      dot: isDarkMode ? '#00C98D' : '#10B981',
      bg: isDarkMode ? 'rgba(0, 201, 141, 0.15)' : '#ECFDF5',
    };
  }
  if (status === 'Partially Refunded' || status === 'Refunded') {
    return {
      label: status,
      color: isDarkMode ? '#C4B5FD' : '#6D28D9',
      dot: isDarkMode ? '#C4B5FD' : '#7C3AED',
      bg: isDarkMode ? 'rgba(167, 139, 250, 0.16)' : '#F5F3FF',
    };
  }
  if (status === 'Balance Due' || status === 'Downpayment Unpaid' || status === 'Pending') {
    return {
      label: status,
      color: isDarkMode ? '#F5B942' : '#D97706',
      dot: isDarkMode ? '#F5B942' : '#F59E0B',
      bg: isDarkMode ? 'rgba(245, 185, 66, 0.15)' : '#FFFBEB',
    };
  }
  if (status === 'Failed' || status === 'Cancelled') {
    return {
      label: status,
      color: isDarkMode ? '#F04444' : '#DC2626',
      dot: isDarkMode ? '#F04444' : '#EF4444',
      bg: isDarkMode ? 'rgba(240, 68, 68, 0.15)' : '#FEF2F2',
    };
  }
  return {
    label: status || 'Pending',
    color: isDarkMode ? '#A1A1AA' : '#475569',
    dot: isDarkMode ? '#A1A1AA' : '#94A3B8',
    bg: isDarkMode ? '#202124' : '#F1F5F9',
  };
}

export default function WebPaymentLogsPanel({
  orders = [],
  garageBookings = [],
  usersList = [],
  isDarkMode = false,
  tokens = {},
  isDesktop = true,
  showToast = () => {},
  onOpenOrder,
  onOpenBooking,
}) {
  const [paymentRows, setPaymentRows] = useState(() => paymentsCache.rows || []);
  const [isLoading, setIsLoading] = useState(() => paymentsCache.at === 0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchWarning, setFetchWarning] = useState(null);

  // Sub-tabs: 'tracker' (who paid balance/downpayment/GCash) vs 'logs' (every payment row)
  const [activeSubTab, setActiveSubTab] = useState('logs');
  const [searchQuery, setSearchQuery] = useState('');
  const [logCategoryFilter, setLogCategoryFilter] = useState('all'); // all | online_gcash | downpayment | final_balance | cod_pos
  const [trackerFilter, setTrackerFilter] = useState('all'); // all | balance_due | balance_paid | dp_paid | dp_unpaid | online_gcash
  const [statusFilter, setStatusFilter] = useState('all'); // all | Completed | Pending | Refunded | Failed
  const [dateRangeFilter, setDateRangeFilter] = useState('all'); // all | today | 7d | 30d
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hoveredRowId, setHoveredRowId] = useState(null);
  const [selectedLogModal, setSelectedLogModal] = useState(null);

  const ITEMS_PER_PAGE = 15;

  const loadPayments = useCallback(async ({ force = false } = {}) => {
    if (force) setIsRefreshing(true);
    else if (paymentsCache.at === 0) setIsLoading(true);

    const { rows, error } = await fetchPaymentRowsFromSupabase({ force });
    setPaymentRows(rows);
    setFetchWarning(error);
    setIsLoading(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    loadPayments({ force: false });
  }, [loadPayments]);

  const { ordersById, bookingsById, usersById } = useMemo(() => {
    const oMap = new Map();
    for (const o of orders || []) {
      const id = o?.order_id || o?.id;
      if (id) oMap.set(String(id), o);
    }
    const bMap = new Map();
    for (const b of garageBookings || []) {
      const id = b?.booking_id || b?.id;
      if (id) bMap.set(String(id), b);
    }
    const uMap = new Map();
    for (const u of usersList || []) {
      [u?.id, u?.user_id, u?.customer_id].filter(Boolean).forEach((k) => {
        uMap.set(String(k), u);
      });
    }
    return { ordersById: oMap, bookingsById: bMap, usersById: uMap };
  }, [orders, garageBookings, usersList]);

  // ─── 1. BUILD UNIFIED PAYMENT TRANSACTION LOGS ───
  const transactionLogs = useMemo(() => {
    const seenOrderIds = new Set();
    const seenBookingTypes = new Set();
    const unified = [];

    for (const raw of paymentRows || []) {
      const orderId = raw?.order_id ? String(raw.order_id) : null;
      const fallbackBookingId = raw?.booking_id || extractBookingRefFromNotes(raw?.notes);
      const bookingId = fallbackBookingId ? String(fallbackBookingId) : null;

      const linkedOrder = orderId ? ordersById.get(orderId) || null : null;
      const linkedBooking = bookingId ? bookingsById.get(bookingId) || null : null;
      const linkedUser =
        (raw?.customer_id && usersById.get(String(raw.customer_id))) ||
        (linkedOrder?.customer_id && usersById.get(String(linkedOrder.customer_id))) ||
        (linkedBooking?.customer_id && usersById.get(String(linkedBooking.customer_id))) ||
        null;

      if (orderId) seenOrderIds.add(orderId);

      const rawType = String(raw?.payment_type || '').toUpperCase();
      const method = raw?.payment_method || linkedOrder?.payment_method || linkedBooking?.downpayment_method || 'Unknown';

      let categoryKey = 'cod_pos';
      if (rawType === 'DOWNPAYMENT') {
        categoryKey = 'downpayment';
      } else if (rawType === 'FINAL_PAYMENT') {
        categoryKey = 'final_balance';
      } else if (bookingId || linkedBooking) {
        const dpAmt = Number(linkedBooking?.downpayment_amount || 0);
        const amt = Number(raw?.amount || 0);
        categoryKey = dpAmt > 0 && Math.abs(amt - dpAmt) < 1 ? 'downpayment' : 'final_balance';
      } else if (orderId || linkedOrder) {
        const channelLower = String(linkedOrder?.channel || 'Online Store').toLowerCase();
        const isPos = channelLower.includes('pos');
        categoryKey = !isPos && isGcashMethod(method) ? 'online_gcash' : 'cod_pos';
      } else if (isGcashMethod(method)) {
        categoryKey = 'online_gcash';
      }

      if (bookingId) {
        seenBookingTypes.add(`${bookingId}::${categoryKey}`);
      }

      const normStatus = normalizePaymentStatus(raw);
      const customerName =
        linkedOrder?.customer_name ||
        linkedBooking?.customer_name ||
        linkedBooking?.userName ||
        linkedUser?.name ||
        linkedUser?.fullName ||
        'Walk-in / Customer';
      const customerPhone =
        linkedOrder?.customer_phone ||
        linkedBooking?.customer_phone ||
        linkedBooking?.userPhone ||
        linkedUser?.phone ||
        '';
      const customerEmail =
        linkedOrder?.customer_email ||
        linkedBooking?.customer_email ||
        linkedBooking?.userEmail ||
        linkedUser?.email ||
        '';

      const timestamp = raw?.payment_date || raw?.verified_at || raw?.created_at || linkedOrder?.order_date || linkedBooking?.created_at;
      const referenceDisplay =
        raw?.gateway_transaction_id ||
        raw?.transaction_reference ||
        raw?.reference_number ||
        linkedOrder?.gcash_reference ||
        linkedBooking?.downpayment_ref ||
        '—';

      unified.push({
        id: raw?.payment_id || `pay-${unified.length}`,
        paymentId: raw?.payment_id || '—',
        orderId,
        bookingId,
        linkedOrder,
        linkedBooking,
        categoryKey,
        paymentType: rawType || (orderId ? 'ORDER' : 'PAYMENT'),
        method,
        channel: linkedOrder?.channel || (bookingId ? 'Garage Service' : 'Online Store'),
        amount: Number(raw?.amount || 0),
        refundAmount: Number(raw?.refund_amount || 0),
        refundStatus: raw?.refund_status || null,
        refundReason: raw?.refund_reason || null,
        refundedAt: raw?.refunded_at || null,
        status: normStatus,
        rawStatus: raw?.status || normStatus,
        reference: referenceDisplay,
        referenceNumber: raw?.reference_number || null,
        transactionReference: raw?.transaction_reference || null,
        gatewayTransactionId: raw?.gateway_transaction_id || null,
        receivedBy: raw?.received_by || null,
        verifiedBy: raw?.verified_by || null,
        verifiedAt: raw?.verified_at || null,
        notes: raw?.notes || null,
        timestamp,
        customerName,
        customerPhone,
        customerEmail,
        source: 'db',
      });
    }

    // Reconcile Online Orders that don't yet appear in the fetched 250 payments rows
    for (const o of orders || []) {
      const oid = String(o?.order_id || o?.id || '');
      if (!oid || seenOrderIds.has(oid)) continue;

      const method = o?.payment_method || 'Cash on Delivery (COD)';
      const channel = o?.channel || 'Online Store';
      const isPos = String(channel).toLowerCase().includes('pos');
      const isGcash = isGcashMethod(method);
      const categoryKey = !isPos && isGcash ? 'online_gcash' : 'cod_pos';

      const orderStatusLower = String(o?.status || '').toLowerCase();
      let status = 'Completed';
      if (orderStatusLower.includes('refund')) status = 'Refunded';
      else if (orderStatusLower.includes('cancel') || orderStatusLower.includes('fail')) status = 'Failed';
      else if (isCodMethod(method) && orderStatusLower !== 'delivered') status = 'Pending';

      unified.push({
        id: `ord-sync-${oid}`,
        paymentId: `SYNC-${oid}`,
        orderId: oid,
        bookingId: null,
        linkedOrder: o,
        linkedBooking: null,
        categoryKey,
        paymentType: 'ORDER',
        method,
        channel,
        amount: Number(o?.grand_total ?? o?.total_amount ?? 0),
        refundAmount: 0,
        refundStatus: null,
        refundReason: null,
        refundedAt: null,
        status,
        rawStatus: status,
        reference: o?.gcash_reference || (isCodMethod(method) ? 'COD' : 'Order Record'),
        referenceNumber: o?.gcash_reference || null,
        transactionReference: null,
        gatewayTransactionId: null,
        receivedBy: isPos ? 'POS Cashier' : isGcash ? 'GCash Checkout' : 'COD Rider',
        verifiedBy: null,
        verifiedAt: status === 'Completed' ? o?.updated_at || o?.order_date : null,
        notes: o?.items_summary || 'Synchronized from order ledger',
        timestamp: o?.order_date || o?.created_at,
        customerName: o?.customer_name || 'Customer',
        customerPhone: o?.customer_phone || '',
        customerEmail: o?.customer_email || '',
        source: 'order_sync',
      });
    }

    // Reconcile paid booking downpayments/settlements not represented in the fetched 250 payments rows
    for (const b of garageBookings || []) {
      const bid = String(b?.booking_id || b?.id || '');
      if (!bid) continue;
      const dpPaid =
        String(b?.downpayment_status || '').toLowerCase() === 'paid' ||
        b?.downpayment_paid === true ||
        String(b?.payment_status || '').toUpperCase() === 'DOWNPAYMENT_PAID';
      const dpAmt = Number(b?.downpayment_amount || 0);
      if (dpPaid && dpAmt > 0 && !seenBookingTypes.has(`${bid}::downpayment`)) {
        unified.push({
          id: `bk-dp-sync-${bid}`,
          paymentId: `SYNC-DP-${bid}`,
          orderId: null,
          bookingId: bid,
          linkedOrder: null,
          linkedBooking: b,
          categoryKey: 'downpayment',
          paymentType: 'DOWNPAYMENT',
          method: b?.downpayment_method || 'GCash / Booking Deposit',
          channel: 'Garage Service',
          amount: dpAmt,
          refundAmount: Number(b?.refund_amount || 0),
          refundStatus: b?.refund_status || null,
          refundReason: null,
          refundedAt: b?.refunded_at || null,
          status: Number(b?.refund_amount || 0) > 0 ? 'Partially Refunded' : 'Completed',
          rawStatus: 'Completed',
          reference: b?.downpayment_ref || bid,
          referenceNumber: b?.downpayment_ref || null,
          transactionReference: null,
          gatewayTransactionId: null,
          receivedBy: 'Booking Record',
          verifiedBy: null,
          verifiedAt: b?.downpayment_paid_at || b?.updated_at || b?.created_at,
          notes: `${b?.package_name || b?.service_title || 'Service Booking'} downpayment`,
          timestamp: b?.downpayment_paid_at || b?.created_at,
          customerName: b?.customer_name || b?.userName || 'Customer',
          customerPhone: b?.customer_phone || b?.userPhone || '',
          customerEmail: b?.customer_email || b?.userEmail || '',
          source: 'booking_sync',
        });
      }
    }

    unified.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
    return unified;
  }, [paymentRows, orders, garageBookings, ordersById, bookingsById, usersById]);

  // ─── 2. BUILD CUSTOMER TRACKER ("WHO PAID BALANCE, DOWNPAYMENT & ONLINE GCASH") ───
  const customerTrackers = useMemo(() => {
    const paymentsByBooking = new Map();
    const paymentsByOrder = new Map();

    for (const log of transactionLogs) {
      if (log.bookingId) {
        if (!paymentsByBooking.has(log.bookingId)) paymentsByBooking.set(log.bookingId, []);
        paymentsByBooking.get(log.bookingId).push(log);
      }
      if (log.orderId) {
        if (!paymentsByOrder.has(log.orderId)) paymentsByOrder.set(log.orderId, []);
        paymentsByOrder.get(log.orderId).push(log);
      }
    }

    const items = [];

    // A. Booking trackers (Downpayment + Final Balance)
    for (const b of garageBookings || []) {
      const bid = String(b?.booking_id || b?.id || '');
      if (!bid) continue;

      const normStatus = normalizeBookingStatus(b?.status);
      const isNegative =
        normStatus === FLEX_BOOKING_STATUS.CANCELLED ||
        normStatus === FLEX_BOOKING_STATUS.REJECTED ||
        normStatus === FLEX_BOOKING_STATUS.CUSTOMER_DECLINED ||
        normStatus === FLEX_BOOKING_STATUS.BOOKING_EXPIRED;

      const bookingPays = paymentsByBooking.get(bid) || [];
      const completedPays = bookingPays.filter(
        (p) => p.status === 'Completed' || p.status === 'Partially Refunded'
      );
      const completedSum = completedPays.reduce((s, p) => s + Number(p.amount || 0), 0);

      const dpRows = bookingPays.filter((p) => p.categoryKey === 'downpayment');
      const finalRows = bookingPays.filter((p) => p.categoryKey === 'final_balance');

      const dpPaid =
        String(b?.downpayment_status || '').toLowerCase() === 'paid' ||
        b?.downpayment_paid === true ||
        dpRows.some((p) => p.status === 'Completed' || p.status === 'Partially Refunded');

      const dpRequiredAmt = Number(b?.downpayment_amount || 0);
      const isFlexible = b?.booking_mode === 'flexible';
      const dpUnpaid =
        !dpPaid &&
        !isNegative &&
        (String(b?.downpayment_status || '').toLowerCase() === 'required' ||
          normStatus === FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT ||
          normStatus === FLEX_BOOKING_STATUS.APPROVED ||
          (dpRequiredAmt > 0 && !isFlexible));

      const totalBill = Number(bookingQuotationTotal(b) || b?.total_amount || 0);
      const amountPaid = Math.max(
        Number(b?.amount_paid || 0),
        completedSum,
        dpPaid ? dpRequiredAmt : 0
      );

      const pStatUpper = String(bookingPaymentStatus(b) || '')
        .toUpperCase()
        .replace(/\s+/g, '_');

      const isExplicitlyFullyPaid =
        !isNegative &&
        (pStatUpper === 'FULLY_PAID' ||
          normStatus === FLEX_BOOKING_STATUS.FULLY_PAID ||
          normStatus === FLEX_BOOKING_STATUS.READY_FOR_PICKUP ||
          normStatus === FLEX_BOOKING_STATUS.COMPLETED ||
          (finalRows.some((p) => p.status === 'Completed') &&
            Number(b?.remaining_balance ?? 0) <= 0));

      const rawRemaining =
        b?.remaining_balance != null
          ? Math.max(0, Number(b.remaining_balance))
          : totalBill > 0
          ? Math.max(0, totalBill - amountPaid)
          : 0;
      const remainingBalance = isExplicitlyFullyPaid || isNegative ? 0 : rawRemaining;

      const balancePaid =
        !isNegative &&
        (isExplicitlyFullyPaid || (totalBill > 0 && amountPaid >= totalBill && remainingBalance <= 0));
      const balanceDue =
        !isNegative &&
        !balancePaid &&
        remainingBalance > 0 &&
        (dpPaid ||
          amountPaid > 0 ||
          normStatus === FLEX_BOOKING_STATUS.SERVICE_COMPLETED ||
          normStatus === FLEX_BOOKING_STATUS.FOR_FINAL_BILLING ||
          normStatus === FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT ||
          normStatus === FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS ||
          normStatus === FLEX_BOOKING_STATUS.SCHEDULED ||
          normStatus === FLEX_BOOKING_STATUS.CONFIRMED);

      let overallStatus = 'Pending';
      if (Number(b?.refund_amount || 0) > 0 || String(b?.refund_status || '').toLowerCase().includes('refund')) {
        overallStatus = 'Refunded';
      } else if (isNegative) {
        overallStatus = 'Cancelled';
      } else if (balancePaid) {
        overallStatus = 'Balance Paid';
      } else if (balanceDue) {
        overallStatus = 'Balance Due';
      } else if (dpPaid) {
        overallStatus = 'Downpayment Paid';
      } else if (dpUnpaid) {
        overallStatus = 'Downpayment Unpaid';
      }

      const lastPaidAt =
        bookingPays[0]?.timestamp ||
        b?.downpayment_paid_at ||
        b?.updated_at ||
        b?.created_at;

      const dpPayRow = dpRows[0] || null;
      const finalPayRow = finalRows[0] || null;
      const bikeText = [b?.bike_brand, b?.bike_model].filter(Boolean).join(' ');

      items.push({
        id: `trk-bk-${bid}`,
        trackerType: 'booking',
        refId: bid,
        linkedBooking: b,
        linkedOrder: null,
        customerName: b?.customer_name || b?.userName || 'Customer',
        customerPhone: b?.customer_phone || b?.userPhone || '',
        customerEmail: b?.customer_email || b?.userEmail || '',
        subtitle: `${b?.package_name || b?.service_title || 'Garage Service'}${bikeText ? ` • ${bikeText}` : ''}`,
        dpState: dpPaid ? 'paid' : dpUnpaid ? 'unpaid' : 'na',
        dpAmount: dpPayRow?.amount || dpRequiredAmt,
        dpMethod: dpPayRow?.method || b?.downpayment_method || null,
        dpRef: dpPayRow?.reference || b?.downpayment_ref || null,
        balanceState: balancePaid ? 'paid' : balanceDue ? 'due' : isNegative ? 'cancelled' : 'pending',
        finalPaidAmount: finalPayRow?.amount || Math.max(0, amountPaid - (dpPayRow?.amount || dpRequiredAmt)),
        finalMethod: finalPayRow?.method || null,
        finalRef: finalPayRow?.reference || null,
        totalBill,
        amountPaid,
        remainingBalance,
        overallStatus,
        timestamp: lastPaidAt,
        bookingPays,
      });
    }

    // B. Online Ordering GCash trackers
    for (const o of orders || []) {
      const oid = String(o?.order_id || o?.id || '');
      if (!oid) continue;

      const channel = o?.channel || 'Online Store';
      const method = o?.payment_method || '';
      const isPos = String(channel).toLowerCase().includes('pos');
      if (isPos || !isGcashMethod(method)) continue;

      const orderPays = paymentsByOrder.get(oid) || [];
      const orderPayRow = orderPays[0] || null;
      const orderStatusLower = String(o?.status || '').toLowerCase();
      const total = Number(o?.grand_total ?? o?.total_amount ?? 0);

      let overallStatus = 'GCash Paid';
      if (orderStatusLower.includes('refund')) overallStatus = 'Refunded';
      else if (orderStatusLower.includes('cancel')) overallStatus = 'Cancelled';
      else if (orderPayRow?.status === 'Pending') overallStatus = 'Pending';

      items.push({
        id: `trk-ord-${oid}`,
        trackerType: 'online_gcash',
        refId: oid,
        linkedBooking: null,
        linkedOrder: o,
        customerName: o?.customer_name || 'Customer',
        customerPhone: o?.customer_phone || '',
        customerEmail: o?.customer_email || '',
        subtitle: o?.items_summary || `Online Store Order (${o?.items_count || 1} item/s)`,
        dpState: 'na',
        dpAmount: 0,
        dpMethod: null,
        dpRef: null,
        balanceState: overallStatus === 'GCash Paid' ? 'paid' : 'pending',
        finalPaidAmount: overallStatus === 'GCash Paid' ? total : 0,
        finalMethod: method,
        finalRef: orderPayRow?.reference || o?.gcash_reference || '—',
        totalBill: total,
        amountPaid: overallStatus === 'GCash Paid' ? total : 0,
        remainingBalance: overallStatus === 'GCash Paid' ? 0 : total,
        overallStatus,
        timestamp: orderPayRow?.timestamp || o?.order_date || o?.created_at,
        bookingPays: orderPays,
      });
    }

    items.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
    return items;
  }, [garageBookings, orders, transactionLogs]);

  // ─── 3. EXECUTIVE KPI SUMMARIES ───
  const kpiStats = useMemo(() => {
    let totalCollected = 0;
    let verifiedCount = 0;
    let onlineGcashTotal = 0;
    let onlineGcashCount = 0;
    let downpaymentTotal = 0;
    let downpaymentPaidCount = 0;
    let finalBalanceTotal = 0;
    let finalBalanceCount = 0;

    for (const log of transactionLogs) {
      if (log.status !== 'Completed' && log.status !== 'Partially Refunded') continue;
      const net = Math.max(0, Number(log.amount || 0) - Number(log.refundAmount || 0));
      totalCollected += net;
      verifiedCount += 1;

      if (log.categoryKey === 'online_gcash') {
        onlineGcashTotal += net;
        onlineGcashCount += 1;
      } else if (log.categoryKey === 'downpayment') {
        downpaymentTotal += net;
        downpaymentPaidCount += 1;
      } else if (log.categoryKey === 'final_balance') {
        finalBalanceTotal += net;
        finalBalanceCount += 1;
      }
    }

    let unpaidDownpaymentCount = 0;
    let balancePaidTrackerCount = 0;
    let balanceDueCount = 0;
    let totalRemainingDue = 0;

    for (const trk of customerTrackers) {
      if (trk.trackerType !== 'booking') continue;
      if (trk.dpState === 'unpaid') unpaidDownpaymentCount += 1;
      if (trk.balanceState === 'paid') balancePaidTrackerCount += 1;
      if (trk.balanceState === 'due') {
        balanceDueCount += 1;
        totalRemainingDue += Number(trk.remainingBalance || 0);
      }
    }

    return {
      totalCollected,
      verifiedCount,
      onlineGcashTotal,
      onlineGcashCount,
      downpaymentTotal,
      downpaymentPaidCount,
      unpaidDownpaymentCount,
      finalBalanceTotal,
      finalBalanceCount,
      balancePaidTrackerCount,
      balanceDueCount,
      totalRemainingDue,
    };
  }, [transactionLogs, customerTrackers]);

  // ─── 4. FILTERED LISTS & PAGINATION ───
  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transactionLogs.filter((log) => {
      if (logCategoryFilter !== 'all' && log.categoryKey !== logCategoryFilter) return false;
      if (statusFilter !== 'all') {
        if (statusFilter === 'Refunded') {
          if (log.status !== 'Refunded' && log.status !== 'Partially Refunded') return false;
        } else if (log.status !== statusFilter) {
          return false;
        }
      }
      if (!isWithinDateRange(log.timestamp, dateRangeFilter)) return false;
      if (!q) return true;
      const haystack = [
        log.paymentId,
        log.orderId,
        log.bookingId,
        log.customerName,
        log.customerPhone,
        log.customerEmail,
        log.method,
        log.reference,
        log.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [transactionLogs, logCategoryFilter, statusFilter, dateRangeFilter, searchQuery]);

  const filteredTrackers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return customerTrackers.filter((trk) => {
      if (trackerFilter === 'balance_due' && trk.balanceState !== 'due') return false;
      if (trackerFilter === 'balance_paid' && !(trk.trackerType === 'booking' && trk.balanceState === 'paid')) return false;
      if (trackerFilter === 'dp_paid' && trk.dpState !== 'paid') return false;
      if (trackerFilter === 'dp_unpaid' && trk.dpState !== 'unpaid') return false;
      if (trackerFilter === 'online_gcash' && trk.trackerType !== 'online_gcash') return false;

      if (!isWithinDateRange(trk.timestamp, dateRangeFilter)) return false;
      if (!q) return true;
      const haystack = [
        trk.refId,
        trk.customerName,
        trk.customerPhone,
        trk.customerEmail,
        trk.subtitle,
        trk.dpRef,
        trk.finalRef,
        trk.overallStatus,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [customerTrackers, trackerFilter, dateRangeFilter, searchQuery]);

  const activeItems = activeSubTab === 'logs' ? filteredLogs : filteredTrackers;
  const totalPages = Math.max(1, Math.ceil(activeItems.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return activeItems.slice(start, start + ITEMS_PER_PAGE);
  }, [activeItems, safePage]);

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    dateRangeFilter !== 'all' ||
    (activeSubTab === 'logs'
      ? logCategoryFilter !== 'all' || statusFilter !== 'all'
      : trackerFilter !== 'all');

  const handleResetFilters = () => {
    setSearchQuery('');
    setLogCategoryFilter('all');
    setTrackerFilter('all');
    setStatusFilter('all');
    setDateRangeFilter('all');
    setCurrentPage(1);
  };

  const handleExportCsv = () => {
    const today = new Date().toISOString().slice(0, 10);
    if (activeSubTab === 'logs') {
      const ok = triggerCsvDownload(
        `mototrack_payment_logs_${today}.csv`,
        ['Payment ID', 'Date', 'Customer', 'Phone', 'Email', 'Category', 'Linked Ref', 'Method', 'Gateway / Ref #', 'Amount (PHP)', 'Refunded (PHP)', 'Status', 'Received By', 'Notes'],
        filteredLogs.map((l) => [
          l.paymentId,
          formatDateTime(l.timestamp),
          l.customerName,
          l.customerPhone,
          l.customerEmail,
          LOG_CATEGORY_META[l.categoryKey]?.label || l.paymentType,
          l.bookingId || l.orderId || '—',
          l.method,
          l.reference,
          l.amount,
          l.refundAmount || 0,
          l.status,
          l.receivedBy || l.verifiedBy || '—',
          l.notes || '',
        ])
      );
      if (ok) showToast(`Exported ${filteredLogs.length} payment log(s) to CSV`);
    } else {
      const ok = triggerCsvDownload(
        `mototrack_customer_payment_tracker_${today}.csv`,
        ['Type', 'Ref ID', 'Customer', 'Phone', 'Email', 'Service / Order', 'Downpayment Status', 'Downpayment (PHP)', 'Total Bill (PHP)', 'Total Paid (PHP)', 'Remaining Balance (PHP)', 'Overall Status', 'Reference', 'Updated'],
        filteredTrackers.map((t) => [
          t.trackerType === 'online_gcash' ? 'Online Order (GCash)' : 'Garage Booking',
          t.refId,
          t.customerName,
          t.customerPhone,
          t.customerEmail,
          t.subtitle,
          t.dpState === 'paid' ? 'Paid' : t.dpState === 'unpaid' ? 'Unpaid' : 'N/A',
          t.dpAmount || 0,
          t.totalBill || 0,
          t.amountPaid || 0,
          t.remainingBalance || 0,
          t.overallStatus,
          t.finalRef || t.dpRef || '—',
          formatDateTime(t.timestamp),
        ])
      );
      if (ok) showToast(`Exported ${filteredTrackers.length} customer payment tracker row(s) to CSV`);
    }
  };

  // Theme colors
  const surfaceBg = isDarkMode ? tokens.bgCard || '#191A1D' : '#FFFFFF';
  const surfaceElevated = isDarkMode ? tokens.bgElevated || '#202124' : '#FFFFFF';
  const inputBg = isDarkMode ? tokens.bgMain || '#111315' : '#F8FAFC';
  const borderCol = isDarkMode ? tokens.border || '#303236' : '#E5E7EB';
  const borderLightCol = isDarkMode ? tokens.borderLight || '#292B2F' : '#F1F5F9';
  const textPrimary = isDarkMode ? tokens.textPrimary || '#F2F2F3' : '#111827';
  const textSecondary = isDarkMode ? tokens.textSecondary || '#A1A1AA' : '#4B5563';
  const textMuted = isDarkMode ? tokens.textMuted || '#71717A' : '#6B7280';
  const brandAccent = isDarkMode ? '#FF5A00' : '#EA580C';

  return (
    <View style={{ paddingBottom: 28 }}>
      {/* Click-outside backdrop for dropdown menus */}
      {(isStatusDropdownOpen || isDateDropdownOpen) && (
        <TouchableOpacity
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99998,
            backgroundColor: 'transparent',
            cursor: 'default',
          }}
          onPress={() => {
            setIsStatusDropdownOpen(false);
            setIsDateDropdownOpen(false);
          }}
          activeOpacity={1}
        />
      )}

      {/* Optional Supabase fallback notice */}
      {fetchWarning && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 10,
            backgroundColor: isDarkMode ? 'rgba(245, 185, 66, 0.12)' : '#FFFBEB',
            borderWidth: 1,
            borderColor: isDarkMode ? 'rgba(245, 185, 66, 0.28)' : '#FDE68A',
            marginBottom: 14,
          }}
        >
          <BootstrapIcon name="exclamation-triangle" size={14} color={isDarkMode ? '#F5B942' : '#D97706'} />
          <Text style={{ flex: 1, fontFamily: fontFamily.sans, fontSize: 12, fontWeight: '500', color: isDarkMode ? '#F5B942' : '#92400E' }}>
            {fetchWarning}
          </Text>
        </View>
      )}

      {/* ─── 1. FOUR EXECUTIVE KPI SUMMARY CARDS ─── */}
      <View
        style={{
          flexDirection: isDesktop ? 'row' : 'column',
          gap: 14,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        {/* KPI 1: Total Collected */}
        <View
          style={{
            flex: 1,
            minWidth: 200,
            backgroundColor: surfaceBg,
            padding: 18,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: borderCol,
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontFamily: fontFamily.sans, fontSize: 13.5, fontWeight: '600', color: textSecondary }}>
              Total Collected
            </Text>
            <View
              style={{
                backgroundColor: isDarkMode ? 'rgba(0, 201, 141, 0.14)' : '#ECFDF5',
                paddingHorizontal: 8,
                paddingVertical: 2.5,
                borderRadius: 999,
              }}
            >
              <Text style={{ fontFamily: fontFamily.sans, fontSize: 10, fontWeight: '600', color: isDarkMode ? '#00C98D' : '#059669' }}>
                {kpiStats.verifiedCount} PAID
              </Text>
            </View>
          </View>
          <View style={{ marginVertical: 10 }}>
            <Text
              style={{
                fontFamily: fontFamily.sans,
                fontSize: 28,
                lineHeight: 34,
                fontWeight: '700',
                color: textPrimary,
                letterSpacing: -0.5,
                fontVariant: ['tabular-nums'],
              }}
            >
              {formatPhp(kpiStats.totalCollected)}
            </Text>
            <Text style={{ fontFamily: fontFamily.sans, fontSize: 11.5, fontWeight: '400', color: textMuted, marginTop: 3 }}>
              Verified payments across store & garage
            </Text>
          </View>
          <View style={{ height: 3, borderRadius: 2, backgroundColor: borderLightCol, overflow: 'hidden' }}>
            <View style={{ height: '100%', width: '78%', backgroundColor: isDarkMode ? '#00C98D' : '#059669', borderRadius: 2 }} />
          </View>
        </View>

        {/* KPI 2: Online Ordering GCash */}
        <View
          style={{
            flex: 1,
            minWidth: 200,
            backgroundColor: surfaceBg,
            padding: 18,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: borderCol,
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontFamily: fontFamily.sans, fontSize: 13.5, fontWeight: '600', color: textSecondary }}>
              Online Order GCash
            </Text>
            <View
              style={{
                backgroundColor: isDarkMode ? 'rgba(56, 189, 248, 0.14)' : '#E0F2FE',
                paddingHorizontal: 8,
                paddingVertical: 2.5,
                borderRadius: 999,
              }}
            >
              <Text style={{ fontFamily: fontFamily.sans, fontSize: 10, fontWeight: '600', color: isDarkMode ? '#38BDF8' : '#0284C7' }}>
                {kpiStats.onlineGcashCount} ORDERS
              </Text>
            </View>
          </View>
          <View style={{ marginVertical: 10 }}>
            <Text
              style={{
                fontFamily: fontFamily.sans,
                fontSize: 28,
                lineHeight: 34,
                fontWeight: '700',
                color: textPrimary,
                letterSpacing: -0.5,
                fontVariant: ['tabular-nums'],
              }}
            >
              {formatPhp(kpiStats.onlineGcashTotal)}
            </Text>
            <Text style={{ fontFamily: fontFamily.sans, fontSize: 11.5, fontWeight: '400', color: textMuted, marginTop: 3 }}>
              Paid online ordering GCash checkouts
            </Text>
          </View>
          <View style={{ height: 3, borderRadius: 2, backgroundColor: borderLightCol, overflow: 'hidden' }}>
            <View style={{ height: '100%', width: kpiStats.onlineGcashCount > 0 ? '68%' : '12%', backgroundColor: isDarkMode ? '#38BDF8' : '#0284C7', borderRadius: 2 }} />
          </View>
        </View>

        {/* KPI 3: Down Payments */}
        <View
          style={{
            flex: 1,
            minWidth: 200,
            backgroundColor: surfaceBg,
            padding: 18,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: borderCol,
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontFamily: fontFamily.sans, fontSize: 13.5, fontWeight: '600', color: textSecondary }}>
              Down Payments
            </Text>
            <View
              style={{
                backgroundColor: isDarkMode ? 'rgba(255, 90, 0, 0.16)' : '#FFF7ED',
                paddingHorizontal: 8,
                paddingVertical: 2.5,
                borderRadius: 999,
              }}
            >
              <Text style={{ fontFamily: fontFamily.sans, fontSize: 10, fontWeight: '600', color: brandAccent }}>
                {kpiStats.unpaidDownpaymentCount > 0 ? `${kpiStats.unpaidDownpaymentCount} UNPAID` : `${kpiStats.downpaymentPaidCount} PAID`}
              </Text>
            </View>
          </View>
          <View style={{ marginVertical: 10 }}>
            <Text
              style={{
                fontFamily: fontFamily.sans,
                fontSize: 28,
                lineHeight: 34,
                fontWeight: '700',
                color: textPrimary,
                letterSpacing: -0.5,
                fontVariant: ['tabular-nums'],
              }}
            >
              {formatPhp(kpiStats.downpaymentTotal)}
            </Text>
            <Text style={{ fontFamily: fontFamily.sans, fontSize: 11.5, fontWeight: '400', color: textMuted, marginTop: 3 }}>
              {kpiStats.downpaymentPaidCount} paid • {kpiStats.unpaidDownpaymentCount} awaiting deposit
            </Text>
          </View>
          <View style={{ height: 3, borderRadius: 2, backgroundColor: borderLightCol, overflow: 'hidden' }}>
            <View style={{ height: '100%', width: kpiStats.downpaymentPaidCount > 0 ? '64%' : '12%', backgroundColor: brandAccent, borderRadius: 2 }} />
          </View>
        </View>

        {/* KPI 4: Final & Remaining Balances */}
        <View
          style={{
            flex: 1,
            minWidth: 200,
            backgroundColor: surfaceBg,
            padding: 18,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: borderCol,
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontFamily: fontFamily.sans, fontSize: 13.5, fontWeight: '600', color: textSecondary }}>
              Final Balances
            </Text>
            <View
              style={{
                backgroundColor:
                  kpiStats.balanceDueCount > 0
                    ? isDarkMode ? 'rgba(245, 185, 66, 0.16)' : '#FFFBEB'
                    : isDarkMode ? 'rgba(0, 201, 141, 0.14)' : '#ECFDF5',
                paddingHorizontal: 8,
                paddingVertical: 2.5,
                borderRadius: 999,
              }}
            >
              <Text
                style={{
                  fontFamily: fontFamily.sans,
                  fontSize: 10,
                  fontWeight: '600',
                  color:
                    kpiStats.balanceDueCount > 0
                      ? isDarkMode ? '#F5B942' : '#D97706'
                      : isDarkMode ? '#00C98D' : '#059669',
                }}
              >
                {kpiStats.balanceDueCount > 0 ? `${kpiStats.balanceDueCount} DUE` : `${kpiStats.balancePaidTrackerCount} SETTLED`}
              </Text>
            </View>
          </View>
          <View style={{ marginVertical: 10 }}>
            <Text
              style={{
                fontFamily: fontFamily.sans,
                fontSize: 28,
                lineHeight: 34,
                fontWeight: '700',
                color: textPrimary,
                letterSpacing: -0.5,
                fontVariant: ['tabular-nums'],
              }}
            >
              {formatPhp(kpiStats.finalBalanceTotal)}
            </Text>
            <Text style={{ fontFamily: fontFamily.sans, fontSize: 11.5, fontWeight: '400', color: textMuted, marginTop: 3, fontVariant: ['tabular-nums'] }}>
              {kpiStats.balancePaidTrackerCount} fully paid • {formatPhp(kpiStats.totalRemainingDue)} due
            </Text>
          </View>
          <View style={{ height: 3, borderRadius: 2, backgroundColor: borderLightCol, overflow: 'hidden' }}>
            <View
              style={{
                height: '100%',
                width: kpiStats.balanceDueCount > 0 ? '58%' : '20%',
                backgroundColor: kpiStats.balanceDueCount > 0 ? (isDarkMode ? '#F5B942' : '#D97706') : (isDarkMode ? '#00C98D' : '#059669'),
                borderRadius: 2,
              }}
            />
          </View>
        </View>
      </View>

      {/* ─── 2. MODE SWITCHER & TOOLBAR ─── */}
      <View
        style={{
          backgroundColor: surfaceElevated,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: borderCol,
          padding: 14,
          marginBottom: 16,
          position: 'relative',
          zIndex: isStatusDropdownOpen || isDateDropdownOpen ? 99999 : 10,
        }}
      >
        {/* Top Mode Tabs + Quick Actions */}
        <View
          style={{
            flexDirection: isDesktop ? 'row' : 'column',
            alignItems: isDesktop ? 'center' : 'stretch',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 12,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: borderLightCol,
          }}
        >
          {/* Segmented View Toggle */}
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: inputBg,
              padding: 4,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: borderCol,
              alignSelf: isDesktop ? 'flex-start' : 'stretch',
              gap: 4,
            }}
          >
            <TouchableOpacity
              onPress={() => {
                setActiveSubTab('logs');
                setCurrentPage(1);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 7,
                backgroundColor: activeSubTab === 'logs' ? brandAccent : 'transparent',
                cursor: 'pointer',
              }}
              activeOpacity={0.85}
            >
              <BootstrapIcon
                name="receipt-cutoff"
                size={13}
                color={activeSubTab === 'logs' ? '#FFFFFF' : textSecondary}
              />
              <Text
                style={{
                  fontFamily: fontFamily.sans,
                  fontSize: 12.5,
                  fontWeight: '600',
                  color: activeSubTab === 'logs' ? '#FFFFFF' : textSecondary,
                  fontVariant: ['tabular-nums'],
                }}
              >
                Payment Logs ({transactionLogs.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setActiveSubTab('tracker');
                setCurrentPage(1);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 7,
                backgroundColor: activeSubTab === 'tracker' ? brandAccent : 'transparent',
                cursor: 'pointer',
              }}
              activeOpacity={0.85}
            >
              <BootstrapIcon
                name="person-check-fill"
                size={13}
                color={activeSubTab === 'tracker' ? '#FFFFFF' : textSecondary}
              />
              <Text
                style={{
                  fontFamily: fontFamily.sans,
                  fontSize: 12.5,
                  fontWeight: '600',
                  color: activeSubTab === 'tracker' ? '#FFFFFF' : textSecondary,
                  fontVariant: ['tabular-nums'],
                }}
              >
                Customer Balance & Deposit Tracker ({customerTrackers.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Right Toolbar Actions: Refresh + Export CSV */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <TouchableOpacity
              onPress={() => loadPayments({ force: true })}
              disabled={isRefreshing}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                height: 36,
                paddingHorizontal: 12,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: borderCol,
                backgroundColor: inputBg,
                cursor: 'pointer',
                opacity: isRefreshing ? 0.65 : 1,
              }}
              activeOpacity={0.8}
            >
              {isRefreshing ? (
                <ActivityIndicator size="small" color={brandAccent} />
              ) : (
                <BootstrapIcon name="arrow-clockwise" size={13} color={textSecondary} />
              )}
              <Text style={{ fontFamily: fontFamily.sans, fontSize: 12.5, fontWeight: '600', color: textSecondary }}>
                {isRefreshing ? 'Syncing...' : 'Refresh'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleExportCsv}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                height: 36,
                paddingHorizontal: 12,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: brandAccent,
                backgroundColor: surfaceBg,
                cursor: 'pointer',
              }}
              activeOpacity={0.8}
            >
              <BootstrapIcon name="download" size={12} color={brandAccent} />
              <Text style={{ fontFamily: fontFamily.sans, fontSize: 12.5, fontWeight: '600', color: brandAccent }}>
                Export CSV
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search + Dropdown Filters Row */}
        <View
          style={{
            flexDirection: isDesktop ? 'row' : 'column',
            alignItems: isDesktop ? 'center' : 'stretch',
            gap: 10,
            marginBottom: 12,
          }}
        >
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              backgroundColor: inputBg,
              borderWidth: 1,
              borderColor: borderCol,
              height: 40,
              borderRadius: 8,
              paddingHorizontal: 12,
            }}
          >
            <BootstrapIcon name="search" size={13} color={textMuted} />
            <TextInput
              style={{
                flex: 1,
                fontFamily: fontFamily.sans,
                fontSize: 13,
                color: textPrimary,
                outlineStyle: 'none',
              }}
              placeholder="Search customer, payment ID, reference #, order ID, or booking ID..."
              value={searchQuery}
              onChangeText={(txt) => {
                setSearchQuery(txt);
                setCurrentPage(1);
              }}
              placeholderTextColor={textMuted}
            />
            {Boolean(searchQuery) && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
              >
                <BootstrapIcon name="x-circle-fill" size={13} color={textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Status Dropdown (in Logs tab) */}
            {activeSubTab === 'logs' && (
              <View style={{ position: 'relative', zIndex: isStatusDropdownOpen ? 99999 : 10 }}>
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: inputBg,
                    borderWidth: 1,
                    borderColor: statusFilter !== 'all' ? brandAccent : borderCol,
                    height: 40,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    cursor: 'pointer',
                  }}
                  onPress={() => {
                    setIsStatusDropdownOpen((p) => !p);
                    setIsDateDropdownOpen(false);
                  }}
                  activeOpacity={0.8}
                >
                  <BootstrapIcon name="funnel" size={12} color={textMuted} />
                  <Text style={{ fontFamily: fontFamily.sans, fontSize: 12.5, fontWeight: '600', color: textPrimary }}>
                    Status:{' '}
                    {statusFilter === 'all'
                      ? 'All'
                      : statusFilter === 'Completed'
                      ? 'Paid'
                      : statusFilter}
                  </Text>
                  <BootstrapIcon name="chevron-down" size={11} color={textMuted} />
                </TouchableOpacity>

                {isStatusDropdownOpen && (
                  <View
                    style={{
                      position: 'absolute',
                      top: 44,
                      right: 0,
                      minWidth: 165,
                      backgroundColor: surfaceBg,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: borderCol,
                      padding: 6,
                      zIndex: 99999,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.16)',
                    }}
                  >
                    {[
                      { id: 'all', label: 'All Statuses' },
                      { id: 'Completed', label: 'Paid / Completed' },
                      { id: 'Pending', label: 'Pending' },
                      { id: 'Refunded', label: 'Refunded / Partial' },
                      { id: 'Failed', label: 'Failed / Cancelled' },
                    ].map((opt) => (
                      <TouchableOpacity
                        key={opt.id}
                        onPress={() => {
                          setStatusFilter(opt.id);
                          setCurrentPage(1);
                          setIsStatusDropdownOpen(false);
                        }}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 8,
                          borderRadius: 6,
                          backgroundColor:
                            statusFilter === opt.id
                              ? isDarkMode ? 'rgba(255, 90, 0, 0.16)' : '#FFF7ED'
                              : 'transparent',
                          cursor: 'pointer',
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: fontFamily.sans,
                            fontSize: 12.5,
                            fontWeight: statusFilter === opt.id ? '600' : '500',
                            color: statusFilter === opt.id ? brandAccent : textPrimary,
                          }}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Date Range Dropdown */}
            <View style={{ position: 'relative', zIndex: isDateDropdownOpen ? 99999 : 10 }}>
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: inputBg,
                  borderWidth: 1,
                  borderColor: dateRangeFilter !== 'all' ? brandAccent : borderCol,
                  height: 40,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  cursor: 'pointer',
                }}
                onPress={() => {
                  setIsDateDropdownOpen((p) => !p);
                  setIsStatusDropdownOpen(false);
                }}
                activeOpacity={0.8}
              >
                <BootstrapIcon name="calendar3" size={12} color={textMuted} />
                <Text style={{ fontFamily: fontFamily.sans, fontSize: 12.5, fontWeight: '600', color: textPrimary }}>
                  {dateRangeFilter === 'all'
                    ? 'All Time'
                    : dateRangeFilter === 'today'
                    ? 'Today'
                    : dateRangeFilter === '7d'
                    ? 'Last 7 Days'
                    : 'Last 30 Days'}
                </Text>
                <BootstrapIcon name="chevron-down" size={11} color={textMuted} />
              </TouchableOpacity>

              {isDateDropdownOpen && (
                <View
                  style={{
                    position: 'absolute',
                    top: 44,
                    right: 0,
                    minWidth: 150,
                    backgroundColor: surfaceBg,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: borderCol,
                    padding: 6,
                    zIndex: 99999,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.16)',
                  }}
                >
                  {[
                    { id: 'all', label: 'All Time' },
                    { id: 'today', label: 'Today' },
                    { id: '7d', label: 'Last 7 Days' },
                    { id: '30d', label: 'Last 30 Days' },
                  ].map((opt) => (
                    <TouchableOpacity
                      key={opt.id}
                      onPress={() => {
                        setDateRangeFilter(opt.id);
                        setCurrentPage(1);
                        setIsDateDropdownOpen(false);
                      }}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        borderRadius: 6,
                        backgroundColor:
                          dateRangeFilter === opt.id
                            ? isDarkMode ? 'rgba(255, 90, 0, 0.16)' : '#FFF7ED'
                            : 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: fontFamily.sans,
                          fontSize: 12.5,
                          fontWeight: dateRangeFilter === opt.id ? '600' : '500',
                          color: dateRangeFilter === opt.id ? brandAccent : textPrimary,
                        }}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {hasActiveFilters && (
              <TouchableOpacity
                onPress={handleResetFilters}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: isDarkMode ? 'rgba(240, 68, 68, 0.15)' : '#FEF2F2',
                  borderWidth: 1,
                  borderColor: isDarkMode ? 'rgba(240, 68, 68, 0.3)' : '#FECACA',
                  height: 40,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  cursor: 'pointer',
                }}
              >
                <BootstrapIcon name="arrow-counterclockwise" size={12} color={isDarkMode ? '#F04444' : '#DC2626'} />
                <Text style={{ fontFamily: fontFamily.sans, fontSize: 12.5, fontWeight: '600', color: isDarkMode ? '#F04444' : '#DC2626' }}>
                  Reset
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Quick Category Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {(activeSubTab === 'logs'
              ? [
                  { id: 'all', label: 'All Payments' },
                  { id: 'online_gcash', label: 'Online Ordering GCash' },
                  { id: 'downpayment', label: 'Down Payments' },
                  { id: 'final_balance', label: 'Final / Balance Payments' },
                  { id: 'cod_pos', label: 'COD & POS / Other' },
                ]
              : [
                  { id: 'all', label: 'All Tracked' },
                  { id: 'balance_due', label: `Balance Due (${kpiStats.balanceDueCount})` },
                  { id: 'balance_paid', label: `Balance Paid (${kpiStats.balancePaidTrackerCount})` },
                  { id: 'dp_paid', label: 'Downpayment Paid' },
                  { id: 'dp_unpaid', label: `Downpayment Unpaid (${kpiStats.unpaidDownpaymentCount})` },
                  { id: 'online_gcash', label: 'Online GCash Orders' },
                ]
            ).map((pill) => {
              const isSelected =
                activeSubTab === 'logs'
                  ? logCategoryFilter === pill.id
                  : trackerFilter === pill.id;
              return (
                <TouchableOpacity
                  key={pill.id}
                  onPress={() => {
                    if (activeSubTab === 'logs') setLogCategoryFilter(pill.id);
                    else setTrackerFilter(pill.id);
                    setCurrentPage(1);
                  }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6.5,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: isSelected ? brandAccent : borderCol,
                    backgroundColor: isSelected
                      ? isDarkMode ? 'rgba(255, 90, 0, 0.16)' : '#FFF7ED'
                      : inputBg,
                    cursor: 'pointer',
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={{
                      fontFamily: fontFamily.sans,
                      fontSize: 12,
                      fontWeight: isSelected ? '600' : '500',
                      color: isSelected ? brandAccent : textSecondary,
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {pill.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* ─── 3. MAIN TABLE / LIST CONTAINER ─── */}
      <View
        style={{
          backgroundColor: surfaceElevated,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: borderCol,
          overflow: 'hidden',
        }}
      >
        {/* Desktop Table Header */}
        {isDesktop && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 20,
              paddingVertical: 12,
              backgroundColor: isDarkMode ? '#202124' : '#24272B',
              borderBottomWidth: 1,
              borderBottomColor: isDarkMode ? '#303236' : '#32373D',
            }}
          >
            {activeSubTab === 'logs' ? (
              <>
                <Text style={{ flex: 1.5, fontFamily: fontFamily.sans, fontSize: 11, fontWeight: '600', color: '#CBD5E1', letterSpacing: 0.5 }}>
                  DATE & PAYMENT ID
                </Text>
                <Text style={{ flex: 1.5, fontFamily: fontFamily.sans, fontSize: 11, fontWeight: '600', color: '#CBD5E1', letterSpacing: 0.5 }}>
                  CUSTOMER
                </Text>
                <Text style={{ flex: 1.2, fontFamily: fontFamily.sans, fontSize: 11, fontWeight: '600', color: '#CBD5E1', letterSpacing: 0.5 }}>
                  PAYMENT TYPE
                </Text>
                <Text style={{ flex: 1.4, fontFamily: fontFamily.sans, fontSize: 11, fontWeight: '600', color: '#CBD5E1', letterSpacing: 0.5 }}>
                  METHOD & REFERENCE
                </Text>
                <Text style={{ flex: 0.9, fontFamily: fontFamily.sans, fontSize: 11, fontWeight: '600', color: '#CBD5E1', letterSpacing: 0.5, textAlign: 'right', paddingRight: 12 }}>
                  AMOUNT
                </Text>
                <Text style={{ flex: 0.9, fontFamily: fontFamily.sans, fontSize: 11, fontWeight: '600', color: '#CBD5E1', letterSpacing: 0.5 }}>
                  STATUS
                </Text>
                <Text style={{ width: 98, fontFamily: fontFamily.sans, fontSize: 11, fontWeight: '600', color: '#CBD5E1', letterSpacing: 0.5, textAlign: 'right' }}>
                  ACTION
                </Text>
              </>
            ) : (
              <>
                <Text style={{ flex: 1.7, fontFamily: fontFamily.sans, fontSize: 11, fontWeight: '600', color: '#CBD5E1', letterSpacing: 0.5 }}>
                  CUSTOMER & REFERENCE
                </Text>
                <Text style={{ flex: 1.3, fontFamily: fontFamily.sans, fontSize: 11, fontWeight: '600', color: '#CBD5E1', letterSpacing: 0.5 }}>
                  DOWNPAYMENT
                </Text>
                <Text style={{ flex: 1.3, fontFamily: fontFamily.sans, fontSize: 11, fontWeight: '600', color: '#CBD5E1', letterSpacing: 0.5 }}>
                  FINAL / GCASH PAYMENT
                </Text>
                <Text style={{ flex: 1.1, fontFamily: fontFamily.sans, fontSize: 11, fontWeight: '600', color: '#CBD5E1', letterSpacing: 0.5, textAlign: 'right', paddingRight: 12 }}>
                  PAID / BALANCE
                </Text>
                <Text style={{ flex: 1.0, fontFamily: fontFamily.sans, fontSize: 11, fontWeight: '600', color: '#CBD5E1', letterSpacing: 0.5 }}>
                  TRACKER STATUS
                </Text>
                <Text style={{ width: 115, fontFamily: fontFamily.sans, fontSize: 11, fontWeight: '600', color: '#CBD5E1', letterSpacing: 0.5, textAlign: 'right' }}>
                  ACTION
                </Text>
              </>
            )}
          </View>
        )}

        {/* Loading / Empty / Rows */}
        {isLoading ? (
          <View style={{ padding: 48, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <ActivityIndicator size="large" color={brandAccent} />
            <Text style={{ fontFamily: fontFamily.sans, fontSize: 13, fontWeight: '500', color: textMuted }}>
              Loading payment records...
            </Text>
          </View>
        ) : paginatedItems.length === 0 ? (
          <View style={{ padding: 48, alignItems: 'center', justifyContent: 'center' }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: inputBg,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <BootstrapIcon name="wallet2" size={24} color={textMuted} />
            </View>
            <Text style={{ fontFamily: fontFamily.sans, fontSize: 15, fontWeight: '600', color: textPrimary }}>
              No Payment Records Found
            </Text>
            <Text style={{ fontFamily: fontFamily.sans, fontSize: 12.5, color: textMuted, marginTop: 4, textAlign: 'center' }}>
              {hasActiveFilters
                ? 'No transactions or accounts match your current search and filter criteria.'
                : 'Completed online GCash orders, booking downpayments, and balance payments will appear here.'}
            </Text>
            {hasActiveFilters && (
              <TouchableOpacity
                onPress={handleResetFilters}
                style={{
                  marginTop: 14,
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 8,
                  backgroundColor: isDarkMode ? 'rgba(255, 90, 0, 0.16)' : '#FFF7ED',
                  borderWidth: 1,
                  borderColor: brandAccent,
                }}
              >
                <Text style={{ fontFamily: fontFamily.sans, fontSize: 12, fontWeight: '600', color: brandAccent }}>
                  Reset All Filters
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : activeSubTab === 'logs' ? (
          paginatedItems.map((log, index) => {
            const catMeta = LOG_CATEGORY_META[log.categoryKey] || LOG_CATEGORY_META.cod_pos;
            const statusMeta = getStatusPillStyle(log.status, isDarkMode);
            const isHovered = hoveredRowId === log.id;
            const isLast = index === paginatedItems.length - 1;

            return (
              <TouchableOpacity
                key={log.id}
                onPress={() => setSelectedLogModal(log)}
                onMouseEnter={() => setHoveredRowId(log.id)}
                onMouseLeave={() => setHoveredRowId(null)}
                activeOpacity={0.8}
                style={{
                  flexDirection: isDesktop ? 'row' : 'column',
                  alignItems: isDesktop ? 'center' : 'stretch',
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                  gap: isDesktop ? 0 : 10,
                  borderBottomWidth: isLast ? 0 : 1,
                  borderBottomColor: borderLightCol,
                  backgroundColor: isHovered
                    ? isDarkMode ? '#292B2F' : '#F8FAFC'
                    : 'transparent',
                  cursor: 'pointer',
                }}
              >
                {/* Col 1: Date & ID */}
                <View style={{ flex: isDesktop ? 1.5 : undefined, paddingRight: isDesktop ? 10 : 0 }}>
                  <Text style={{ fontFamily: fontFamily.sans, fontSize: 12.5, fontWeight: '600', color: textPrimary, fontVariant: ['tabular-nums'] }}>
                    {formatDateTime(log.timestamp)}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                    <Text style={{ fontFamily: fontFamily.sans, fontSize: 11, fontWeight: '500', color: textMuted, fontVariant: ['tabular-nums'] }}>
                      {log.paymentId}
                    </Text>
                    {(log.bookingId || log.orderId) && (
                      <View
                        style={{
                          paddingHorizontal: 6,
                          paddingVertical: 1.5,
                          borderRadius: 5,
                          backgroundColor: isDarkMode ? '#202124' : '#F1F5F9',
                          borderWidth: 1,
                          borderColor: borderCol,
                        }}
                      >
                        <Text style={{ fontFamily: fontFamily.sans, fontSize: 10, fontWeight: '600', color: textSecondary, fontVariant: ['tabular-nums'] }}>
                          {log.bookingId || log.orderId}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Col 2: Customer */}
                <View style={{ flex: isDesktop ? 1.5 : undefined, paddingRight: isDesktop ? 10 : 0 }}>
                  <Text numberOfLines={1} style={{ fontFamily: fontFamily.sans, fontSize: 13, fontWeight: '600', color: textPrimary }}>
                    {log.customerName}
                  </Text>
                  <Text numberOfLines={1} style={{ fontFamily: fontFamily.sans, fontSize: 11.5, fontWeight: '400', color: textMuted, marginTop: 2 }}>
                    {log.customerPhone || log.customerEmail || log.channel}
                  </Text>
                </View>

                {/* Col 3: Category */}
                <View style={{ flex: isDesktop ? 1.2 : undefined, paddingRight: isDesktop ? 10 : 0, alignItems: 'flex-start' }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      paddingHorizontal: 9,
                      paddingVertical: 4,
                      borderRadius: 999,
                      backgroundColor: isDarkMode ? catMeta.darkBg : catMeta.bg,
                    }}
                  >
                    <BootstrapIcon name={catMeta.icon} size={11} color={isDarkMode ? catMeta.darkColor : catMeta.color} />
                    <Text
                      style={{
                        fontFamily: fontFamily.sans,
                        fontSize: 10.5,
                        fontWeight: '600',
                        color: isDarkMode ? catMeta.darkColor : catMeta.color,
                      }}
                    >
                      {catMeta.label}
                    </Text>
                  </View>
                </View>

                {/* Col 4: Method & Reference */}
                <View style={{ flex: isDesktop ? 1.4 : undefined, paddingRight: isDesktop ? 10 : 0 }}>
                  <Text numberOfLines={1} style={{ fontFamily: fontFamily.sans, fontSize: 12.5, fontWeight: '500', color: textPrimary }}>
                    {log.method}
                  </Text>
                  <Text numberOfLines={1} style={{ fontFamily: fontFamily.sans, fontSize: 11, fontWeight: '400', color: textMuted, marginTop: 2, fontVariant: ['tabular-nums'] }}>
                    Ref: {log.reference}
                  </Text>
                </View>

                {/* Col 5: Amount */}
                <View style={{ flex: isDesktop ? 0.9 : undefined, paddingRight: isDesktop ? 12 : 0, alignItems: isDesktop ? 'flex-end' : 'flex-start' }}>
                  <Text style={{ fontFamily: fontFamily.sans, fontSize: 13.5, fontWeight: '700', color: textPrimary, fontVariant: ['tabular-nums'] }}>
                    {formatPhp(log.amount)}
                  </Text>
                  {log.refundAmount > 0 && (
                    <Text style={{ fontFamily: fontFamily.sans, fontSize: 10.5, fontWeight: '600', color: isDarkMode ? '#C4B5FD' : '#6D28D9', marginTop: 2, fontVariant: ['tabular-nums'] }}>
                      Refunded {formatPhp(log.refundAmount)}
                    </Text>
                  )}
                </View>

                {/* Col 6: Status */}
                <View style={{ flex: isDesktop ? 0.9 : undefined, alignItems: 'flex-start' }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      paddingHorizontal: 9,
                      paddingVertical: 3.5,
                      borderRadius: 999,
                      backgroundColor: statusMeta.bg,
                    }}
                  >
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusMeta.dot }} />
                    <Text style={{ fontFamily: fontFamily.sans, fontSize: 10.5, fontWeight: '600', color: statusMeta.color }}>
                      {statusMeta.label}
                    </Text>
                  </View>
                </View>

                {/* Col 7: Action */}
                <View style={{ width: isDesktop ? 98 : undefined, alignItems: isDesktop ? 'flex-end' : 'flex-start' }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      backgroundColor: isHovered ? brandAccent : inputBg,
                      borderWidth: 1,
                      borderColor: isHovered ? brandAccent : borderCol,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 7,
                    }}
                  >
                    <BootstrapIcon name="eye" size={12} color={isHovered ? '#FFFFFF' : textMuted} />
                    <Text style={{ fontFamily: fontFamily.sans, fontSize: 11.5, fontWeight: '600', color: isHovered ? '#FFFFFF' : textSecondary }}>
                      Details
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          /* Customer Balance & Deposit Tracker Rows */
          paginatedItems.map((trk, index) => {
            const statusMeta = getStatusPillStyle(trk.overallStatus, isDarkMode);
            const isHovered = hoveredRowId === trk.id;
            const isLast = index === paginatedItems.length - 1;

            return (
              <View
                key={trk.id}
                onMouseEnter={() => setHoveredRowId(trk.id)}
                onMouseLeave={() => setHoveredRowId(null)}
                style={{
                  flexDirection: isDesktop ? 'row' : 'column',
                  alignItems: isDesktop ? 'center' : 'stretch',
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                  gap: isDesktop ? 0 : 10,
                  borderBottomWidth: isLast ? 0 : 1,
                  borderBottomColor: borderLightCol,
                  backgroundColor: isHovered
                    ? isDarkMode ? '#292B2F' : '#F8FAFC'
                    : 'transparent',
                }}
              >
                {/* Col 1: Customer & Reference */}
                <View style={{ flex: isDesktop ? 1.7 : undefined, paddingRight: isDesktop ? 10 : 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text numberOfLines={1} style={{ fontFamily: fontFamily.sans, fontSize: 13, fontWeight: '600', color: textPrimary }}>
                      {trk.customerName}
                    </Text>
                    <View
                      style={{
                        paddingHorizontal: 6,
                        paddingVertical: 1.5,
                        borderRadius: 5,
                        backgroundColor:
                          trk.trackerType === 'online_gcash'
                            ? isDarkMode ? 'rgba(56, 189, 248, 0.14)' : '#E0F2FE'
                            : isDarkMode ? 'rgba(255, 90, 0, 0.14)' : '#FFF7ED',
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: fontFamily.sans,
                          fontSize: 10,
                          fontWeight: '600',
                          color:
                            trk.trackerType === 'online_gcash'
                              ? isDarkMode ? '#38BDF8' : '#0284C7'
                              : brandAccent,
                          fontVariant: ['tabular-nums'],
                        }}
                      >
                        {trk.refId}
                      </Text>
                    </View>
                  </View>
                  <Text numberOfLines={1} style={{ fontFamily: fontFamily.sans, fontSize: 11.5, color: textMuted, marginTop: 2 }}>
                    {trk.subtitle}
                  </Text>
                  {Boolean(trk.customerPhone || trk.customerEmail) && (
                    <Text numberOfLines={1} style={{ fontFamily: fontFamily.sans, fontSize: 11, color: textMuted, marginTop: 1 }}>
                      {[trk.customerPhone, trk.customerEmail].filter(Boolean).join(' • ')}
                    </Text>
                  )}
                </View>

                {/* Col 2: Downpayment */}
                <View style={{ flex: isDesktop ? 1.3 : undefined, paddingRight: isDesktop ? 10 : 0 }}>
                  {trk.trackerType === 'online_gcash' ? (
                    <Text style={{ fontFamily: fontFamily.sans, fontSize: 12, color: textMuted }}>
                      Full Checkout
                    </Text>
                  ) : trk.dpState === 'paid' ? (
                    <View>
                      <Text style={{ fontFamily: fontFamily.sans, fontSize: 12.5, fontWeight: '600', color: isDarkMode ? '#00C98D' : '#059669', fontVariant: ['tabular-nums'] }}>
                        Paid {formatPhp(trk.dpAmount)}
                      </Text>
                      <Text numberOfLines={1} style={{ fontFamily: fontFamily.sans, fontSize: 11, color: textMuted, marginTop: 2 }}>
                        {trk.dpMethod || 'Recorded'}{trk.dpRef ? ` • ${trk.dpRef}` : ''}
                      </Text>
                    </View>
                  ) : trk.dpState === 'unpaid' ? (
                    <View>
                      <Text style={{ fontFamily: fontFamily.sans, fontSize: 12.5, fontWeight: '600', color: isDarkMode ? '#F5B942' : '#D97706', fontVariant: ['tabular-nums'] }}>
                        Unpaid {trk.dpAmount > 0 ? formatPhp(trk.dpAmount) : ''}
                      </Text>
                      <Text style={{ fontFamily: fontFamily.sans, fontSize: 11, color: textMuted, marginTop: 2 }}>
                        Awaiting downpayment
                      </Text>
                    </View>
                  ) : (
                    <Text style={{ fontFamily: fontFamily.sans, fontSize: 12, color: textMuted }}>
                      Not required
                    </Text>
                  )}
                </View>

                {/* Col 3: Final / Online GCash Payment */}
                <View style={{ flex: isDesktop ? 1.3 : undefined, paddingRight: isDesktop ? 10 : 0 }}>
                  {trk.trackerType === 'online_gcash' ? (
                    <View>
                      <Text style={{ fontFamily: fontFamily.sans, fontSize: 12.5, fontWeight: '600', color: isDarkMode ? '#38BDF8' : '#0284C7', fontVariant: ['tabular-nums'] }}>
                        GCash {formatPhp(trk.totalBill)}
                      </Text>
                      <Text numberOfLines={1} style={{ fontFamily: fontFamily.sans, fontSize: 11, color: textMuted, marginTop: 2, fontVariant: ['tabular-nums'] }}>
                        Ref: {trk.finalRef || '—'}
                      </Text>
                    </View>
                  ) : trk.balanceState === 'paid' ? (
                    <View>
                      <Text style={{ fontFamily: fontFamily.sans, fontSize: 12.5, fontWeight: '600', color: isDarkMode ? '#00C98D' : '#059669', fontVariant: ['tabular-nums'] }}>
                        Settled {trk.finalPaidAmount > 0 ? formatPhp(trk.finalPaidAmount) : ''}
                      </Text>
                      <Text numberOfLines={1} style={{ fontFamily: fontFamily.sans, fontSize: 11, color: textMuted, marginTop: 2 }}>
                        {trk.finalMethod || 'Fully paid'}{trk.finalRef ? ` • ${trk.finalRef}` : ''}
                      </Text>
                    </View>
                  ) : trk.balanceState === 'due' ? (
                    <View>
                      <Text style={{ fontFamily: fontFamily.sans, fontSize: 12.5, fontWeight: '600', color: isDarkMode ? '#F5B942' : '#D97706', fontVariant: ['tabular-nums'] }}>
                        Due {formatPhp(trk.remainingBalance)}
                      </Text>
                      <Text style={{ fontFamily: fontFamily.sans, fontSize: 11, color: textMuted, marginTop: 2 }}>
                        Remaining balance unpaid
                      </Text>
                    </View>
                  ) : (
                    <Text style={{ fontFamily: fontFamily.sans, fontSize: 12, color: textMuted }}>
                      {trk.balanceState === 'cancelled' ? 'Cancelled' : 'Pending final bill'}
                    </Text>
                  )}
                </View>

                {/* Col 4: Paid / Balance Summary */}
                <View style={{ flex: isDesktop ? 1.1 : undefined, paddingRight: isDesktop ? 12 : 0, alignItems: isDesktop ? 'flex-end' : 'flex-start' }}>
                  <Text style={{ fontFamily: fontFamily.sans, fontSize: 13, fontWeight: '700', color: textPrimary, fontVariant: ['tabular-nums'] }}>
                    {formatPhp(trk.amountPaid)}
                    {trk.totalBill > 0 ? ` / ${formatPhp(trk.totalBill)}` : ''}
                  </Text>
                  <Text style={{ fontFamily: fontFamily.sans, fontSize: 11, color: textMuted, marginTop: 2, fontVariant: ['tabular-nums'] }}>
                    {formatShortDate(trk.timestamp)}
                  </Text>
                </View>

                {/* Col 5: Status */}
                <View style={{ flex: isDesktop ? 1.0 : undefined, alignItems: 'flex-start' }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      paddingHorizontal: 9,
                      paddingVertical: 3.5,
                      borderRadius: 999,
                      backgroundColor: statusMeta.bg,
                    }}
                  >
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusMeta.dot }} />
                    <Text style={{ fontFamily: fontFamily.sans, fontSize: 10.5, fontWeight: '600', color: statusMeta.color }}>
                      {statusMeta.label}
                    </Text>
                  </View>
                </View>

                {/* Col 6: Action */}
                <View style={{ width: isDesktop ? 115 : undefined, alignItems: isDesktop ? 'flex-end' : 'flex-start' }}>
                  <TouchableOpacity
                    onPress={() => {
                      if (trk.trackerType === 'online_gcash' && trk.linkedOrder && onOpenOrder) {
                        onOpenOrder(trk.linkedOrder);
                      } else if (trk.linkedBooking && onOpenBooking) {
                        onOpenBooking(trk.linkedBooking);
                      }
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      backgroundColor: inputBg,
                      borderWidth: 1,
                      borderColor: borderCol,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 7,
                      cursor: 'pointer',
                    }}
                    activeOpacity={0.8}
                  >
                    <BootstrapIcon name="arrow-up-right" size={12} color={brandAccent} />
                    <Text style={{ fontFamily: fontFamily.sans, fontSize: 11.5, fontWeight: '600', color: textPrimary }}>
                      {trk.trackerType === 'online_gcash' ? 'View Order' : 'View Booking'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}

        {/* Pagination Footer */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingVertical: 14,
            borderTopWidth: 1,
            borderTopColor: borderCol,
            backgroundColor: surfaceElevated,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <Text style={{ fontFamily: fontFamily.sans, fontSize: 12.5, color: textMuted, fontVariant: ['tabular-nums'] }}>
            {activeItems.length === 0
              ? 'Showing 0 of 0 records'
              : `Showing ${(safePage - 1) * ITEMS_PER_PAGE + 1}–${Math.min(safePage * ITEMS_PER_PAGE, activeItems.length)} of ${activeItems.length} records`}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <TouchableOpacity
              disabled={safePage <= 1}
              onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
              style={{
                width: 32,
                height: 32,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 7,
                borderWidth: 1,
                borderColor: borderCol,
                backgroundColor: inputBg,
                opacity: safePage <= 1 ? 0.45 : 1,
                cursor: safePage <= 1 ? 'not-allowed' : 'pointer',
              }}
            >
              <BootstrapIcon name="chevron-left" size={12} color={textPrimary} />
            </TouchableOpacity>

            {Array.from({ length: Math.min(7, totalPages) }, (_, idx) => {
              const startPage = Math.max(1, Math.min(safePage - 3, totalPages - 6));
              return startPage + idx;
            })
              .filter((p) => p >= 1 && p <= totalPages)
              .map((pageNum) => {
                const isActive = pageNum === safePage;
                return (
                  <TouchableOpacity
                    key={pageNum}
                    onPress={() => setCurrentPage(pageNum)}
                    style={{
                      minWidth: 32,
                      height: 32,
                      paddingHorizontal: 6,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 7,
                      backgroundColor: isActive ? brandAccent : inputBg,
                      borderWidth: 1,
                      borderColor: isActive ? brandAccent : borderCol,
                      cursor: 'pointer',
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: fontFamily.sans,
                        fontSize: 12,
                        fontWeight: isActive ? '600' : '500',
                        fontVariant: ['tabular-nums'],
                        color: isActive ? '#FFFFFF' : textPrimary,
                      }}
                    >
                      {pageNum}
                    </Text>
                  </TouchableOpacity>
                );
              })}

            <TouchableOpacity
              disabled={safePage >= totalPages}
              onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              style={{
                width: 32,
                height: 32,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 7,
                borderWidth: 1,
                borderColor: borderCol,
                backgroundColor: inputBg,
                opacity: safePage >= totalPages ? 0.45 : 1,
                cursor: safePage >= totalPages ? 'not-allowed' : 'pointer',
              }}
            >
              <BootstrapIcon name="chevron-right" size={12} color={textPrimary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ─── 4. PAYMENT TRANSACTION DETAIL MODAL ─── */}
      <Modal
        visible={Boolean(selectedLogModal)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedLogModal(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: isDarkMode ? 'rgba(0,0,0,0.75)' : 'rgba(15, 23, 42, 0.55)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 18,
          }}
        >
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            activeOpacity={1}
            onPress={() => setSelectedLogModal(null)}
          />
          {selectedLogModal && (
            <View
              style={{
                maxWidth: 560,
                width: '100%',
                backgroundColor: surfaceBg,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: borderCol,
                padding: 22,
                gap: 14,
              }}
            >
              {/* Modal Header */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: borderLightCol,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      backgroundColor: isDarkMode ? 'rgba(255, 90, 0, 0.16)' : '#FFF7ED',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <BootstrapIcon name="receipt-cutoff" size={18} color={brandAccent} />
                  </View>
                  <View>
                    <Text style={{ fontFamily: fontFamily.sans, fontSize: 16, fontWeight: '600', color: textPrimary }}>
                      Payment Receipt Details
                    </Text>
                    <Text style={{ fontFamily: fontFamily.sans, fontSize: 11.5, color: textMuted, fontVariant: ['tabular-nums'] }}>
                      {selectedLogModal.paymentId}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => setSelectedLogModal(null)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: inputBg,
                    cursor: 'pointer',
                  }}
                >
                  <BootstrapIcon name="x-lg" size={14} color={textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Amount Banner */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 14,
                  borderRadius: 12,
                  backgroundColor: inputBg,
                  borderWidth: 1,
                  borderColor: borderCol,
                }}
              >
                <View>
                  <Text style={{ fontFamily: fontFamily.sans, fontSize: 11, fontWeight: '600', color: textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {LOG_CATEGORY_META[selectedLogModal.categoryKey]?.label || 'Payment'}
                  </Text>
                  <Text style={{ fontFamily: fontFamily.sans, fontSize: 24, fontWeight: '700', color: textPrimary, marginTop: 2, fontVariant: ['tabular-nums'] }}>
                    {formatPhp(selectedLogModal.amount)}
                  </Text>
                </View>
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 999,
                    backgroundColor: getStatusPillStyle(selectedLogModal.status, isDarkMode).bg,
                  }}
                >
                  <Text style={{ fontFamily: fontFamily.sans, fontSize: 11.5, fontWeight: '600', color: getStatusPillStyle(selectedLogModal.status, isDarkMode).color }}>
                    {getStatusPillStyle(selectedLogModal.status, isDarkMode).label}
                  </Text>
                </View>
              </View>

              {/* Metadata Grid */}
              <View style={{ gap: 8 }}>
                {[
                  { label: 'Customer', value: selectedLogModal.customerName },
                  { label: 'Contact', value: [selectedLogModal.customerPhone, selectedLogModal.customerEmail].filter(Boolean).join(' • ') || '—' },
                  { label: 'Payment Method', value: selectedLogModal.method },
                  { label: 'Channel', value: selectedLogModal.channel },
                  { label: 'Reference / Invoice', value: selectedLogModal.reference },
                  { label: 'Linked Order / Booking', value: selectedLogModal.bookingId || selectedLogModal.orderId || '—' },
                  { label: 'Payment Date', value: formatDateTime(selectedLogModal.timestamp) },
                  ...(selectedLogModal.verifiedAt ? [{ label: 'Verified At', value: formatDateTime(selectedLogModal.verifiedAt) }] : []),
                  ...(selectedLogModal.receivedBy || selectedLogModal.verifiedBy
                    ? [{ label: 'Processed By', value: selectedLogModal.verifiedBy || selectedLogModal.receivedBy }]
                    : []),
                  ...(selectedLogModal.refundAmount > 0
                    ? [{ label: 'Refund Issued', value: `${formatPhp(selectedLogModal.refundAmount)} (${selectedLogModal.refundStatus || 'Refunded'})` }]
                    : []),
                  ...(selectedLogModal.notes ? [{ label: 'Notes', value: selectedLogModal.notes }] : []),
                ].map((row) => (
                  <View
                    key={row.label}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      gap: 12,
                      paddingVertical: 5,
                      borderBottomWidth: 1,
                      borderBottomColor: borderLightCol,
                    }}
                  >
                    <Text style={{ fontFamily: fontFamily.sans, fontSize: 12, fontWeight: '500', color: textMuted }}>
                      {row.label}
                    </Text>
                    <Text
                      style={{
                        flex: 1,
                        textAlign: 'right',
                        fontFamily: fontFamily.sans,
                        fontSize: 12.5,
                        fontWeight: '600',
                        color: textPrimary,
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {row.value}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Footer Actions */}
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
                {selectedLogModal.linkedOrder && onOpenOrder && (
                  <TouchableOpacity
                    onPress={() => {
                      const ord = selectedLogModal.linkedOrder;
                      setSelectedLogModal(null);
                      onOpenOrder(ord);
                    }}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 9,
                      borderRadius: 8,
                      backgroundColor: brandAccent,
                      cursor: 'pointer',
                    }}
                  >
                    <Text style={{ fontFamily: fontFamily.sans, fontSize: 12.5, fontWeight: '600', color: '#FFFFFF' }}>
                      Open Order Details
                    </Text>
                  </TouchableOpacity>
                )}
                {selectedLogModal.linkedBooking && onOpenBooking && (
                  <TouchableOpacity
                    onPress={() => {
                      const bk = selectedLogModal.linkedBooking;
                      setSelectedLogModal(null);
                      onOpenBooking(bk);
                    }}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 9,
                      borderRadius: 8,
                      backgroundColor: brandAccent,
                      cursor: 'pointer',
                    }}
                  >
                    <Text style={{ fontFamily: fontFamily.sans, fontSize: 12.5, fontWeight: '600', color: '#FFFFFF' }}>
                      Open Booking Details
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => setSelectedLogModal(null)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    borderRadius: 8,
                    backgroundColor: inputBg,
                    borderWidth: 1,
                    borderColor: borderCol,
                    cursor: 'pointer',
                  }}
                >
                  <Text style={{ fontFamily: fontFamily.sans, fontSize: 12.5, fontWeight: '600', color: textPrimary }}>
                    Close
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}
