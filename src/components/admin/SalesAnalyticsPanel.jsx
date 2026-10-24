import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  Platform,
} from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon.jsx';
import Skeleton, { StatCardSkeleton } from '../common/Skeleton.jsx';
import RevenueTrendChart from './RevenueTrendChart.jsx';
import BookingCategoryPieChart from './BookingCategoryPieChart.jsx';
import excelService from '../../services/inventory/excelService.js';
import {
  computeWeeklyKpiSeries,
  isRecognizedSalesOrder,
  recognizedOrderAmount,
} from '../../services/inventory/dashboardInsightsService.js';

function parseLocalDay(value, endOfDay = false) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    if (month < 0 || month > 11 || day < 1 || day > 31) return null;
    return endOfDay
      ? new Date(year, month, day, 23, 59, 59, 999)
      : new Date(year, month, day, 0, 0, 0, 0);
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const CATEGORY_NAMES = [
  'Engine & Transmission',
  'Tires & Wheels',
  'Braking System',
  'Suspension & Steering',
  'Electrical & Lights',
  'Exhaust & Intake',
  'Body & Frame Parts',
  'Oils & Lubricants',
  'Riding Gear & Helmets',
  'Maintenance',
  'Accessories',
];

const PERIOD_OPTIONS = [
  { key: 'today', label: 'Today' },
  { key: '7D', label: 'Last 7 Days' },
  { key: '30D', label: 'Last 30 Days' },
  { key: '3M', label: 'Last 3 Months' },
  { key: 'all', label: 'All Time' },
  { key: 'custom', label: 'Custom Range' },
];

/**
 * SalesAnalyticsPanel — Capstone-ready, professional automotive-retail sales telemetry dashboard.
 * Preserves all existing business logic, calculations, and reports while elevating the UI/UX.
 */
export default function SalesAnalyticsPanel({
  orders = [],
  products = [],
  garageBookings = [],
  usersList = [],
  suppliers = [],
  isDarkMode = false,
  isDesktop = true,
  currentUser,
  showToast = () => {},
  showAlert = () => {},
  setActiveNav = () => {},
  isLoading = false,
  error = null,
  onRetry,
}) {
  // ── State ──
  const [globalPeriod, setGlobalPeriod] = useState('30D');
  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const [chartPeriod, setChartPeriod] = useState('12W'); // '4W' | '12W' | '24W'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [appliedCustomRange, setAppliedCustomRange] = useState(null);

  const periodDropdownRef = useRef(null);
  const exportDropdownRef = useRef(null);

  // Close dropdowns on click outside (Web)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handleClickOutside = (e) => {
      if (
        periodDropdownRef.current &&
        !periodDropdownRef.current.contains(e.target)
      ) {
        setIsPeriodDropdownOpen(false);
      }
      if (
        exportDropdownRef.current &&
        !exportDropdownRef.current.contains(e.target)
      ) {
        setIsExportDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Theme tokens
  const theme = useMemo(() => {
    if (isDarkMode) {
      return {
        bg: '#181A1D',
        cardBg: '#24272B',
        cardBgSub: '#1E2124',
        border: '#374151',
        borderInput: '#374151',
        textPrimary: '#F8FAFC',
        textMuted: '#94A3B8',
        brandGreen: '#EA580C',
        brandGreenDark: '#EA580C',
        brandGreenLight: '#FB923C',
        cardShadow: '0 2px 6px rgba(0, 0, 0, 0.35)',
        chipBg: '#1E2124',
        progressTrack: '#374151',
        statusGreenBg: 'rgba(16, 185, 129, 0.15)',
        statusGreenText: '#34D399',
      };
    }
    return {
      bg: '#F3F4F6',
      cardBg: '#FFFFFF',
      cardBgSub: '#F9FAFB',
      border: '#E5E7EB',
      borderInput: '#CBD5E1',
      textPrimary: '#0F172A',
      textMuted: '#64748B',
      brandGreen: '#EA580C',
      brandGreenDark: '#EA580C',
      brandGreenLight: '#FB923C',
      cardShadow: '0 1px 3px rgba(15, 23, 42, 0.05), 0 1px 2px rgba(15, 23, 42, 0.03)',
      chipBg: '#F1F5F9',
      progressTrack: '#E5E7EB',
      statusGreenBg: '#ECFDF5',
      statusGreenText: '#065F46',
    };
  }, [isDarkMode]);

  // ── Global Date Range Order Filtering ──
  const filteredOrders = useMemo(() => {
    const all = Array.isArray(orders) ? orders : [];
    if (all.length === 0) return [];
    if (globalPeriod === 'all') return all;

    const now = new Date();

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (globalPeriod === 'today') {
      return all.filter((o) => {
        const raw = o.created_at || o.order_date || o.date;
        if (!raw) return false;
        const d = new Date(raw);
        return d >= startOfToday;
      });
    }

    if (globalPeriod === '7D') {
      const past7 = new Date(startOfToday);
      past7.setDate(past7.getDate() - 6);
      return all.filter((o) => {
        const raw = o.created_at || o.order_date || o.date;
        if (!raw) return false;
        const d = new Date(raw);
        return d >= past7;
      });
    }

    if (globalPeriod === '30D') {
      const past30 = new Date(startOfToday);
      past30.setDate(past30.getDate() - 29);
      return all.filter((o) => {
        const raw = o.created_at || o.order_date || o.date;
        if (!raw) return false;
        const d = new Date(raw);
        return d >= past30;
      });
    }

    if (globalPeriod === '3M') {
      const past90 = new Date(startOfToday);
      past90.setMonth(past90.getMonth() - 3);
      return all.filter((o) => {
        const raw = o.created_at || o.order_date || o.date;
        if (!raw) return false;
        const d = new Date(raw);
        return d >= past90;
      });
    }

    if (globalPeriod === 'custom' && appliedCustomRange) {
      const { start, end } = appliedCustomRange;
      return all.filter((o) => {
        const raw = o.created_at || o.order_date || o.date;
        if (!raw) return false;
        const d = new Date(raw);
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      });
    }

    return all;
  }, [orders, globalPeriod, appliedCustomRange]);

  // When global period is changed, gracefully hint matching chart resolution
  const handleSelectPeriod = (key) => {
    setGlobalPeriod(key);
    setIsPeriodDropdownOpen(false);
    if (key === 'today' || key === '7D' || key === '30D') {
      setChartPeriod('4W');
    } else if (key === '3M') {
      setChartPeriod('12W');
    } else if (key === 'all') {
      setChartPeriod('24W');
    }
  };

  const handleApplyCustomRange = () => {
    const s = parseLocalDay(customStartDate, false);
    const e = parseLocalDay(customEndDate, true);
    setAppliedCustomRange({ start: s, end: e });
    setIsPeriodDropdownOpen(false);
  };

  // ── Analytics Data Computations ──
  const analyticsData = useMemo(() => {
    // If the filtered order set is empty due to a restrictive period filter,
    // we strictly respect that (no fabricated metrics).
    const orderList = filteredOrders.filter(isRecognizedSalesOrder);
    const posOrders = orderList.filter((o) => o.channel === 'POS (In-Store)');
    const onlineOrders = orderList.filter((o) => o.channel !== 'POS (In-Store)');

    const totalRevenue = orderList.reduce((sum, o) => sum + recognizedOrderAmount(o), 0);
    const posRevenue = posOrders.reduce((sum, o) => sum + recognizedOrderAmount(o), 0);
    const onlineRevenue = onlineOrders.reduce((sum, o) => sum + recognizedOrderAmount(o), 0);

    const aov = orderList.length > 0 ? totalRevenue / orderList.length : 0;
    const totalItemsSold = orderList.reduce(
      (sum, o) =>
        sum + (Number(o.items_count) || (Array.isArray(o.items) ? o.items.length : 1)),
      0
    );

    // Category Revenue totals
    const categoryTotals = {};
    CATEGORY_NAMES.forEach((cat) => {
      categoryTotals[cat] = 0;
    });

    orderList.forEach((o) => {
      if (Array.isArray(o.items)) {
        o.items.forEach((it) => {
          const cat = it.category || 'Accessories';
          const lineTotal = (Number(it.price) || 0) * (Number(it.quantity) || 1);
          categoryTotals[cat] = (categoryTotals[cat] || 0) + lineTotal;
        });
      }
    });

    const categoryRegression = Object.keys(categoryTotals)
      .map((cat) => ({
        category: cat,
        totalRevenue: categoryTotals[cat] || 0,
      }))
      .filter((c) => c.totalRevenue > 0)
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Payment Methods breakdown
    const paymentBreakdown = { Cash: 0, GCash: 0 };
    orderList.forEach((o) => {
      const pm = (o.payment_method || '').toLowerCase();
      if (pm.includes('gcash') || pm.includes('wallet')) paymentBreakdown.GCash += 1;
      else paymentBreakdown.Cash += 1;
    });

    // Top Selling Products
    const productSales = {};
    orderList.forEach((o) => {
      if (Array.isArray(o.items)) {
        o.items.forEach((it) => {
          const key = it.name || 'Motorcycle Part';
          if (!productSales[key]) {
            productSales[key] = {
              name: key,
              brand: it.brand || 'MotoTrack',
              unitsSold: 0,
              revenue: 0,
            };
          }
          productSales[key].unitsSold += Number(it.quantity) || 1;
          productSales[key].revenue +=
            (Number(it.price) || 0) * (Number(it.quantity) || 1);
        });
      }
    });

    const topProducts = Object.values(productSales)
      .filter((tp) => {
        if (!tp.name || tp.name === 'Motorcycle Part') return false;
        if (Array.isArray(products) && products.length > 0) {
          return products.some(
            (p) =>
              (p.name || '').trim().toLowerCase() === tp.name.trim().toLowerCase()
          );
        }
        return true;
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((tp) => {
        const match = products?.find((p) => p.name === tp.name);
        return { ...tp, image_url: match ? match.image_url : null };
      });

    // Weekly revenue bars (from all historical orders or period count)
    let periodsCount = 12;
    if (chartPeriod === '4W') periodsCount = 4;
    else if (chartPeriod === '24W') periodsCount = 24;

    const trendBars = computeWeeklyKpiSeries(orders || [], periodsCount).map((bucket, index) => ({
      label: `W${index + 1}`,
      weekKey: bucket.key,
      revenue: Math.round(bucket.revenue),
    }));

    const hasRealTrend = trendBars.some((b) => b.revenue > 0);
    const maxBarRevenue = hasRealTrend
      ? Math.max(...trendBars.map((b) => b.revenue), 1)
      : 0;

    return {
      totalRevenue,
      posRevenue,
      onlineRevenue,
      totalOrders: orderList.length,
      posOrdersCount: posOrders.length,
      onlineOrdersCount: onlineOrders.length,
      aov,
      totalItemsSold,
      categoryTotals,
      categoryRegression,
      paymentBreakdown,
      topProducts,
      trendBars: hasRealTrend ? trendBars : [],
      maxBarRevenue,
      hasRealTrend,
    };
  }, [filteredOrders, orders, products, chartPeriod]);

  // ── Export Actions ──
  const handleExport = (format) => {
    setIsExportDropdownOpen(false);

    if (format === 'xlsx') {
      const res = excelService.exportComprehensiveBusinessReport({
        products,
        orders: filteredOrders,
        bookings: garageBookings,
        users: usersList,
        suppliers,
        analyticsData,
        period: globalPeriod,
        generatedBy: currentUser?.fullName || currentUser?.name || 'Administrator',
      });
      if (res.success) {
        showToast('✓ Master Business Report (.xlsx) downloaded successfully');
      } else {
        showAlert('Export Failed', res.error || 'Failed to export report.');
      }
    } else if (format === 'csv') {
      const res = excelService.exportAnalyticsCSV({
        orders: filteredOrders,
        period: globalPeriod,
      });
      if (res.success) {
        showToast('✓ Sales Analytics (.csv) exported successfully');
      } else {
        showAlert('Export Failed', res.error || 'Failed to export CSV.');
      }
    } else if (format === 'pdf') {
      if (typeof window !== 'undefined') {
        showToast('✓ Opening print preview for PDF report');
        setTimeout(() => {
          window.print();
        }, 300);
      }
    }
  };

  // Label for current period selector
  const activePeriodLabel = useMemo(() => {
    const found = PERIOD_OPTIONS.find((p) => p.key === globalPeriod);
    if (globalPeriod === 'custom' && appliedCustomRange) {
      const sStr = appliedCustomRange.start
        ? appliedCustomRange.start.toISOString().slice(0, 10)
        : '';
      const eStr = appliedCustomRange.end
        ? appliedCustomRange.end.toISOString().slice(0, 10)
        : '';
      return `${sStr || 'Start'} to ${eStr || 'End'}`;
    }
    return found ? found.label : 'Last 30 Days';
  }, [globalPeriod, appliedCustomRange]);

  // ── Render: Error State ──
  if (error) {
    return (
      <View
        style={{
          padding: 40,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.cardBg,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: theme.border,
          marginVertical: 20,
        }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <BootstrapIcon name="exclamation-circle-fill" size={24} color="#EF4444" />
        </View>
        <Text
          style={{
            fontSize: 18,
            fontWeight: '800',
            color: theme.textPrimary,
            marginBottom: 6,
          }}
        >
          Unable to load sales analytics
        </Text>
        <Text
          style={{
            fontSize: 13,
            color: theme.textMuted,
            textAlign: 'center',
            maxWidth: 380,
            lineHeight: 19,
            marginBottom: 18,
          }}
        >
          We couldn't retrieve the latest sales data. Please try again.
        </Text>
        {onRetry && (
          <TouchableOpacity
            onPress={onRetry}
            style={{
              paddingHorizontal: 18,
              paddingVertical: 9,
              borderRadius: 8,
              backgroundColor: theme.brandGreen,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>
              Retry
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // ── Render: Loading Skeletons ──
  if (isLoading) {
    return (
      <View style={{ gap: 20, paddingVertical: 12 }}>
        {/* KPI Skeletons */}
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          {[1, 2, 3, 4].map((i) => (
            <StatCardSkeleton
              key={i}
              style={{
                flex: 1,
                minWidth: isDesktop ? 220 : 150,
              }}
            />
          ))}
        </View>

        {/* Chart Skeleton */}
        <View
          style={{
            height: 380,
            backgroundColor: theme.cardBg,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 24,
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Skeleton width={180} height={20} borderRadius={6} />
            <Skeleton width={120} height={32} borderRadius={8} />
          </View>
          <Skeleton width="100%" height={260} borderRadius={10} />
        </View>

        {/* Grid Skeletons */}
        <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
          <View
            style={{
              flex: 1,
              minWidth: 320,
              height: 260,
              backgroundColor: theme.cardBg,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: theme.border,
              padding: 20,
              gap: 14,
            }}
          >
            <Skeleton width={140} height={18} borderRadius={4} />
            <Skeleton.Text lines={5} lineHeight={14} gap={10} />
          </View>
          <View
            style={{
              flex: 1,
              minWidth: 320,
              height: 260,
              backgroundColor: theme.cardBg,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: theme.border,
              padding: 20,
              gap: 14,
            }}
          >
            <Skeleton width={140} height={18} borderRadius={4} />
            <Skeleton.Text lines={5} lineHeight={14} gap={10} />
          </View>
        </View>
      </View>
    );
  }

  // POS sales percentage calculation
  const posSharePercent =
    analyticsData.totalRevenue > 0
      ? Math.round((analyticsData.posRevenue / analyticsData.totalRevenue) * 100)
      : 0;

  const onlineSharePercent =
    analyticsData.totalRevenue > 0
      ? Math.round((analyticsData.onlineRevenue / analyticsData.totalRevenue) * 100)
      : 0;

  return (
    <View style={{ gap: 20 }}>
      {/* ── 1. KPI Cards (Neutral borders, subtle shadows, consistent 14px radius) ── */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        {/* Card 1: Gross Sales Volume */}
        <View
          style={{
            flex: 1,
            minWidth: isDesktop ? 220 : 150,
            backgroundColor: theme.cardBg,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 18,
            boxShadow: theme.cardShadow,
            justifyContent: 'space-between',
            minHeight: 125,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                color: theme.textMuted,
              }}
            >
              GROSS SALES
            </Text>
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 7,
                backgroundColor: isDarkMode ? 'rgba(77, 184, 150, 0.15)' : '#ECFDF5',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BootstrapIcon
                name="graph-up-arrow"
                size={12}
                color={isDarkMode ? '#EA580C' : '#EA580C'}
              />
            </View>
          </View>
          <View style={{ marginVertical: 4 }}>
            <Text
              style={{
                fontSize: 26,
                fontWeight: '800',
                color: theme.textPrimary,
                letterSpacing: -0.5,
                fontVariant: ['tabular-nums'],
              }}
            >
              ₱{analyticsData.totalRevenue.toLocaleString()}
            </Text>
          </View>
          <Text
            style={{
              fontSize: 11.5,
              fontWeight: '500',
              color: theme.textMuted,
            }}
          >
            Excludes cancelled and refunded
          </Text>
        </View>

        {/* Card 2: Average Order Value (AOV) */}
        <View
          style={{
            flex: 1,
            minWidth: isDesktop ? 220 : 150,
            backgroundColor: theme.cardBg,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 18,
            boxShadow: theme.cardShadow,
            justifyContent: 'space-between',
            minHeight: 125,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                color: theme.textMuted,
              }}
            >
              AVERAGE ORDER VALUE
            </Text>
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 7,
                backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BootstrapIcon
                name="receipt"
                size={12}
                color={isDarkMode ? '#60A5FA' : '#2563EB'}
              />
            </View>
          </View>
          <View style={{ marginVertical: 4 }}>
            <Text
              style={{
                fontSize: 26,
                fontWeight: '800',
                color: theme.textPrimary,
                letterSpacing: -0.5,
                fontVariant: ['tabular-nums'],
              }}
            >
              ₱{Math.round(analyticsData.aov).toLocaleString()}
            </Text>
          </View>
          <Text
            style={{
              fontSize: 11.5,
              fontWeight: '500',
              color: theme.textMuted,
            }}
          >
            Per transaction average
          </Text>
        </View>

        {/* Card 3: Total Units Sold */}
        <View
          style={{
            flex: 1,
            minWidth: isDesktop ? 220 : 150,
            backgroundColor: theme.cardBg,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 18,
            boxShadow: theme.cardShadow,
            justifyContent: 'space-between',
            minHeight: 125,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                color: theme.textMuted,
              }}
            >
              TOTAL UNITS SOLD
            </Text>
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 7,
                backgroundColor: isDarkMode ? 'rgba(77, 184, 150, 0.15)' : '#ECFDF5',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BootstrapIcon
                name="box-seam"
                size={12}
                color={isDarkMode ? '#EA580C' : '#059669'}
              />
            </View>
          </View>
          <View style={{ marginVertical: 4 }}>
            <Text
              style={{
                fontSize: 26,
                fontWeight: '800',
                color: theme.textPrimary,
                letterSpacing: -0.5,
                fontVariant: ['tabular-nums'],
              }}
            >
              {analyticsData.totalItemsSold} Items
            </Text>
          </View>
          <Text
            style={{
              fontSize: 11.5,
              fontWeight: '500',
              color: theme.textMuted,
            }}
          >
            Across {analyticsData.totalOrders} total orders
          </Text>
        </View>

        {/* Card 4: POS In-Store Sales Share */}
        <View
          style={{
            flex: 1,
            minWidth: isDesktop ? 220 : 150,
            backgroundColor: theme.cardBg,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 18,
            boxShadow: theme.cardShadow,
            justifyContent: 'space-between',
            minHeight: 125,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                color: theme.textMuted,
              }}
            >
              POS SALES SHARE
            </Text>
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 7,
                backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.15)' : '#FFFBEB',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BootstrapIcon
                name="shop"
                size={12}
                color={isDarkMode ? '#FBBF24' : '#D97706'}
              />
            </View>
          </View>
          <View style={{ marginVertical: 4 }}>
            <Text
              style={{
                fontSize: 26,
                fontWeight: '800',
                color: theme.textPrimary,
                letterSpacing: -0.5,
                fontVariant: ['tabular-nums'],
              }}
            >
              {posSharePercent}%
            </Text>
          </View>
          <Text
            style={{
              fontSize: 11.5,
              fontWeight: '500',
              color: theme.textMuted,
            }}
          >
            ₱{analyticsData.posRevenue.toLocaleString()} in counter sales
          </Text>
        </View>
      </View>

      {/* ── Subheader / Toolbar: Global Date Range & Export ── */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          paddingVertical: 4,
          position: 'relative',
          zIndex: 100,
        }}
      >
        {/* Left: Global Date Range Selector */}
        <View
          ref={periodDropdownRef}
          style={{ position: 'relative', zIndex: 110 }}
        >
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: theme.cardBg,
              borderWidth: 1,
              borderColor: isPeriodDropdownOpen ? theme.brandGreen : theme.border,
              borderRadius: 10,
              paddingHorizontal: 13,
              paddingVertical: 8,
              boxShadow: theme.cardShadow,
            }}
            onPress={() => {
              setIsPeriodDropdownOpen(!isPeriodDropdownOpen);
              setIsExportDropdownOpen(false);
            }}
            activeOpacity={0.85}
          >
            <BootstrapIcon
              name="calendar3"
              size={13}
              color={theme.brandGreen}
            />
            <Text
              style={{
                fontSize: 12.5,
                fontWeight: '700',
                color: theme.textPrimary,
              }}
            >
              {activePeriodLabel}
            </Text>
            <BootstrapIcon
              name={isPeriodDropdownOpen ? 'chevron-up' : 'chevron-down'}
              size={11}
              color={theme.textMuted}
            />
          </TouchableOpacity>

          {/* Period Dropdown Menu */}
          {isPeriodDropdownOpen && (
            <View
              style={{
                position: 'absolute',
                top: 42,
                left: 0,
                width: 210,
                backgroundColor: theme.cardBg,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.border,
                padding: 6,
                zIndex: 120,
                boxShadow: isDarkMode
                  ? '0 10px 25px rgba(0, 0, 0, 0.5)'
                  : '0 8px 24px rgba(15, 23, 42, 0.12)',
              }}
            >
              {PERIOD_OPTIONS.map((opt) => {
                const isActive = globalPeriod === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                      backgroundColor: isActive
                        ? isDarkMode
                          ? '#1A2824'
                          : '#E8F5EE'
                        : 'transparent',
                    }}
                    onPress={() => handleSelectPeriod(opt.key)}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: isActive ? '700' : '500',
                        color: isActive ? theme.brandGreen : theme.textPrimary,
                      }}
                    >
                      {opt.label}
                    </Text>
                    {isActive && (
                      <BootstrapIcon
                        name="check-lg"
                        size={12}
                        color={theme.brandGreen}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}

              {/* Custom Date Range Inline Inputs */}
              {globalPeriod === 'custom' && (
                <View
                  style={{
                    borderTopWidth: 1,
                    borderTopColor: theme.border,
                    marginTop: 6,
                    paddingTop: 8,
                    gap: 6,
                  }}
                >
                  <Text style={{ fontSize: 10, color: theme.textMuted, fontWeight: '700' }}>
                    START DATE (YYYY-MM-DD)
                  </Text>
                  <TextInput
                    style={{
                      backgroundColor: theme.cardBgSub,
                      borderWidth: 1,
                      borderColor: theme.borderInput,
                      borderRadius: 6,
                      paddingHorizontal: 8,
                      paddingVertical: 5,
                      fontSize: 11,
                      color: theme.textPrimary,
                    }}
                    placeholder="2026-09-01"
                    placeholderTextColor={theme.textMuted}
                    value={customStartDate}
                    onChangeText={setCustomStartDate}
                  />
                  <Text style={{ fontSize: 10, color: theme.textMuted, fontWeight: '700' }}>
                    END DATE (YYYY-MM-DD)
                  </Text>
                  <TextInput
                    style={{
                      backgroundColor: theme.cardBgSub,
                      borderWidth: 1,
                      borderColor: theme.borderInput,
                      borderRadius: 6,
                      paddingHorizontal: 8,
                      paddingVertical: 5,
                      fontSize: 11,
                      color: theme.textPrimary,
                    }}
                    placeholder="2026-10-07"
                    placeholderTextColor={theme.textMuted}
                    value={customEndDate}
                    onChangeText={setCustomEndDate}
                  />
                  <TouchableOpacity
                    onPress={handleApplyCustomRange}
                    style={{
                      marginTop: 4,
                      backgroundColor: theme.brandGreen,
                      borderRadius: 6,
                      paddingVertical: 6,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
                      Apply Range
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Right: Export Report Button with Dropdown */}
        <View
          ref={exportDropdownRef}
          style={{ position: 'relative', zIndex: 110 }}
        >
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: isDarkMode ? '#EA580C' : '#EA580C',
              borderRadius: 10,
              paddingHorizontal: 13,
              paddingVertical: 8,
              boxShadow: '0 2px 6px rgba(234, 88, 12, 0.25)',
            }}
            onPress={() => {
              setIsExportDropdownOpen(!isExportDropdownOpen);
              setIsPeriodDropdownOpen(false);
            }}
            activeOpacity={0.85}
          >
            <BootstrapIcon name="download" size={13} color="#FFFFFF" />
            <Text
              style={{
                fontSize: 12.5,
                fontWeight: '700',
                color: '#FFFFFF',
              }}
            >
              Export Report
            </Text>
            <BootstrapIcon name="chevron-down" size={10} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Export Dropdown Menu */}
          {isExportDropdownOpen && (
            <View
              style={{
                position: 'absolute',
                top: 42,
                right: 0,
                width: 220,
                backgroundColor: theme.cardBg,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.border,
                padding: 6,
                zIndex: 120,
                boxShadow: isDarkMode
                  ? '0 10px 25px rgba(0, 0, 0, 0.5)'
                  : '0 8px 24px rgba(15, 23, 42, 0.12)',
              }}
            >
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                  borderRadius: 8,
                }}
                onPress={() => handleExport('xlsx')}
              >
                <BootstrapIcon name="file-earmark-excel-fill" size={15} color="#107C41" />
                <View>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.textPrimary }}>
                    Excel (.xlsx)
                  </Text>
                  <Text style={{ fontSize: 10, color: theme.textMuted }}>
                    Full master executive workbook
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                  borderRadius: 8,
                }}
                onPress={() => handleExport('csv')}
              >
                <BootstrapIcon name="file-earmark-spreadsheet" size={15} color="#2563EB" />
                <View>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.textPrimary }}>
                    CSV (.csv)
                  </Text>
                  <Text style={{ fontSize: 10, color: theme.textMuted }}>
                    Raw orders & revenue records
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                  borderRadius: 8,
                }}
                onPress={() => handleExport('pdf')}
              >
                <BootstrapIcon name="printer-fill" size={15} color="#DC2626" />
                <View>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.textPrimary }}>
                    Print / PDF (.pdf)
                  </Text>
                  <Text style={{ fontSize: 10, color: theme.textMuted }}>
                    Executive print summary
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* ── 2. Revenue Trend — Main Focus ── */}
      <RevenueTrendChart
        orders={orders}
        isDark={isDarkMode}
        isDesktop={isDesktop}
        title="Revenue Trend"
      />

      {/* ── 3. Middle Section: Service Bookings (Left) & Sales Channels / Payments (Right) ── */}
      <View
        style={{
          flexDirection: isDesktop ? 'row' : 'column',
          gap: 20,
          alignItems: 'stretch',
        }}
      >
        {/* Service Bookings Share (Left Column) */}
        <View style={{ flex: 1, minWidth: isDesktop ? 340 : '100%' }}>
          <BookingCategoryPieChart
            bookings={garageBookings}
            isDark={isDarkMode}
            isDesktop={isDesktop}
            style={{ height: '100%' }}
          />
        </View>

        {/* Sales Channels & Payment Breakdown (Right Column) */}
        <View
          style={{
            flex: 1,
            minWidth: isDesktop ? 340 : '100%',
            backgroundColor: theme.cardBg,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 20,
            boxShadow: theme.cardShadow,
            justifyContent: 'space-between',
          }}
        >
          {/* Channel Breakdown */}
          <View>
            <Text
              style={{
                fontSize: 15,
                fontWeight: '800',
                color: theme.textPrimary,
                letterSpacing: -0.2,
              }}
            >
              Sales Channel Distribution
            </Text>
            <Text
              style={{
                fontSize: 11.5,
                color: theme.textMuted,
                marginTop: 2,
                marginBottom: 16,
              }}
            >
              Online storefront vs Walk-in POS transactions
            </Text>

            {/* Online Store Bar */}
            <View style={{ marginBottom: 14 }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 5,
                }}
              >
                <Text
                  style={{
                    fontSize: 12.5,
                    fontWeight: '700',
                    color: theme.textPrimary,
                  }}
                >
                  Online Store
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text
                    style={{
                      fontSize: 12.5,
                      fontWeight: '800',
                      color: theme.textPrimary,
                    }}
                  >
                    ₱{analyticsData.onlineRevenue.toLocaleString()}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: isDarkMode ? '#EA580C' : '#EA580C',
                    }}
                  >
                    ({onlineSharePercent}%)
                  </Text>
                </View>
              </View>
              <View
                style={{
                  height: 8,
                  backgroundColor: theme.progressTrack,
                  borderRadius: 4,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    height: '100%',
                    width: `${onlineSharePercent}%`,
                    backgroundColor: isDarkMode ? '#EA580C' : '#EA580C',
                    borderRadius: 4,
                    transition: 'width 0.6s ease',
                  }}
                />
              </View>
            </View>

            {/* In-Store POS Bar */}
            <View style={{ marginBottom: 10 }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 5,
                }}
              >
                <Text
                  style={{
                    fontSize: 12.5,
                    fontWeight: '700',
                    color: theme.textPrimary,
                  }}
                >
                  In-Store POS
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text
                    style={{
                      fontSize: 12.5,
                      fontWeight: '800',
                      color: theme.textPrimary,
                    }}
                  >
                    ₱{analyticsData.posRevenue.toLocaleString()}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: theme.textMuted,
                    }}
                  >
                    ({posSharePercent}%)
                  </Text>
                </View>
              </View>
              <View
                style={{
                  height: 8,
                  backgroundColor: theme.progressTrack,
                  borderRadius: 4,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    height: '100%',
                    width: `${posSharePercent}%`,
                    backgroundColor: isDarkMode ? '#E0B35C' : '#D97706',
                    borderRadius: 4,
                    transition: 'width 0.6s ease',
                  }}
                />
              </View>
            </View>
          </View>

          {/* Payment Method Breakdown */}
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: theme.border,
              paddingTop: 16,
              marginTop: 10,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: '700',
                color: theme.textPrimary,
                marginBottom: 10,
              }}
            >
              Payment Method Breakdown
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {/* Cash Card */}
              <View
                style={{
                  flex: 1,
                  backgroundColor: theme.cardBgSub,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: theme.border,
                  padding: 12,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: theme.textMuted,
                    textTransform: 'uppercase',
                  }}
                >
                  Cash
                </Text>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '900',
                    color: theme.textPrimary,
                    marginTop: 2,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {analyticsData.paymentBreakdown.Cash || 0}
                </Text>
                <Text style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 1 }}>
                  orders
                </Text>
              </View>

              {/* GCash Card */}
              <View
                style={{
                  flex: 1,
                  backgroundColor: theme.cardBgSub,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: theme.border,
                  padding: 12,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: theme.textMuted,
                    textTransform: 'uppercase',
                  }}
                >
                  GCash
                </Text>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '900',
                    color: theme.textPrimary,
                    marginTop: 2,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {analyticsData.paymentBreakdown.GCash || 0}
                </Text>
                <Text style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 1 }}>
                  orders
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* ── 4. Bottom Section: Top Products (Left) & Category Revenue (Right) ── */}
      <View
        style={{
          flexDirection: isDesktop ? 'row' : 'column',
          gap: 20,
          alignItems: 'stretch',
        }}
      >
        {/* Top Products (Left Column) */}
        <View
          style={{
            flex: 1,
            minWidth: isDesktop ? 340 : '100%',
            backgroundColor: theme.cardBg,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 20,
            boxShadow: theme.cardShadow,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 16,
            }}
          >
            <View>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '800',
                  color: theme.textPrimary,
                  letterSpacing: -0.2,
                }}
              >
                Top Products
              </Text>
              <Text style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 2 }}>
                Best-performing products by sales revenue
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setActiveNav('products')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 10,
                paddingVertical: 5,
                backgroundColor: theme.chipBg,
                borderRadius: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 11.5,
                  fontWeight: '700',
                  color: isDarkMode ? '#EA580C' : '#EA580C',
                }}
              >
                View all →
              </Text>
            </TouchableOpacity>
          </View>

          {/* Ranked Product List */}
          {analyticsData.topProducts.length > 0 ? (
            <View style={{ gap: 14 }}>
              {analyticsData.topProducts.map((tp, idx) => {
                const maxRev = analyticsData.topProducts[0]?.revenue || 1;
                const barWidth = Math.max(6, (tp.revenue / maxRev) * 100);

                return (
                  <View key={idx}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 6,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                          flex: 1,
                        }}
                      >
                        {/* Rank Badge */}
                        <View
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 10,
                            backgroundColor: idx === 0 ? (isDarkMode ? '#EA580C' : '#EA580C') : theme.chipBg,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 10,
                              fontWeight: '800',
                              color: idx === 0 ? '#FFFFFF' : theme.textMuted,
                            }}
                          >
                            {idx + 1}
                          </Text>
                        </View>

                        {/* Thumbnail */}
                        <View
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 6,
                            backgroundColor: theme.chipBg,
                            overflow: 'hidden',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {tp.image_url ? (
                            <Image
                              source={{ uri: tp.image_url }}
                              style={{ width: '100%', height: '100%' }}
                            />
                          ) : (
                            <BootstrapIcon
                              name="box-seam"
                              size={13}
                              color={theme.textMuted}
                            />
                          )}
                        </View>

                        <Text
                          numberOfLines={1}
                          style={{
                            fontSize: 13,
                            fontWeight: '700',
                            color: theme.textPrimary,
                            flex: 1,
                          }}
                        >
                          {tp.name}
                        </Text>
                      </View>

                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: '800',
                          color: theme.textPrimary,
                          fontVariant: ['tabular-nums'],
                          marginLeft: 10,
                        }}
                      >
                        ₱{tp.revenue.toLocaleString()}
                      </Text>
                    </View>

                    {/* Subtle Horizontal Revenue Bar */}
                    <View
                      style={{
                        height: 5,
                        backgroundColor: theme.progressTrack,
                        borderRadius: 2.5,
                        overflow: 'hidden',
                      }}
                    >
                      <View
                        style={{
                          height: '100%',
                          width: `${barWidth}%`,
                          backgroundColor: isDarkMode ? '#EA580C' : '#107C41',
                          borderRadius: 2.5,
                          transition: 'width 0.6s ease',
                        }}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={{ paddingVertical: 28, alignItems: 'center' }}>
              <Text
                style={{
                  fontSize: 13,
                  color: theme.textMuted,
                  fontStyle: 'italic',
                }}
              >
                No sales data yet
              </Text>
              <Text style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 4 }}>
                There is not enough sales activity to display this report.
              </Text>
            </View>
          )}
        </View>

        {/* Category Revenue (Right Column) */}
        <View
          style={{
            flex: 1,
            minWidth: isDesktop ? 340 : '100%',
            backgroundColor: theme.cardBg,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 20,
            boxShadow: theme.cardShadow,
            justifyContent: 'space-between',
          }}
        >
          <View>
            <View style={{ marginBottom: 14 }}>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '800',
                  color: theme.textPrimary,
                  letterSpacing: -0.2,
                }}
              >
                Category Revenue
              </Text>
              <Text style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 2 }}>
                Observed sales totals by category
              </Text>
            </View>

            {/* Table Header */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingHorizontal: 12,
                paddingVertical: 10,
                backgroundColor: '#24272B',
                borderRadius: 8,
                borderBottomWidth: 1,
                borderBottomColor: isDarkMode ? '#374151' : '#32373D',
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: '#CBD5E1',
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  flex: 1.5,
                }}
              >
                Category
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: '#CBD5E1',
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  width: 90,
                  textAlign: 'right',
                }}
              >
                Revenue
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: '#CBD5E1',
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  width: 70,
                  textAlign: 'right',
                }}
              >
                Share
              </Text>
            </View>

            {/* Table Rows */}
            {analyticsData.categoryRegression.length > 0 ? (
              <View style={{ gap: 8 }}>
                {analyticsData.categoryRegression.map((catReg, idx) => {
                  const sharePct =
                    analyticsData.totalRevenue > 0
                      ? Math.round((catReg.totalRevenue / analyticsData.totalRevenue) * 100)
                      : 0;

                  return (
                    <View
                      key={idx}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: 6,
                      }}
                    >
                      <View style={{ flex: 1.5 }}>
                        <Text
                          style={{
                            fontSize: 12.5,
                            fontWeight: '700',
                            color: theme.textPrimary,
                          }}
                        >
                          {catReg.category}
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontSize: 12.5,
                          fontWeight: '800',
                          color: theme.textPrimary,
                          width: 90,
                          textAlign: 'right',
                          fontVariant: ['tabular-nums'],
                        }}
                      >
                        ₱{catReg.totalRevenue.toLocaleString()}
                      </Text>
                      <View
                        style={{
                          width: 70,
                          alignItems: 'flex-end',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '800',
                            color: isDarkMode ? '#EA580C' : '#EA580C',
                            fontVariant: ['tabular-nums'],
                          }}
                        >
                          {sharePct}%
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <Text
                  style={{
                    fontSize: 13,
                    color: theme.textMuted,
                    fontStyle: 'italic',
                  }}
                >
                  No sales data yet
                </Text>
                <Text style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 4 }}>
                  There is not enough sales activity to display this report.
                </Text>
              </View>
            )}
          </View>

          {/* Visual separation from Sales Forecast */}
          <View
            style={{
              marginTop: 18,
              paddingTop: 14,
              borderTopWidth: 1,
              borderTopColor: theme.border,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              backgroundColor: theme.cardBgSub,
              padding: 10,
              borderRadius: 8,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: theme.textPrimary,
                }}
              >
                Observed Sales vs. Forecast
              </Text>
              <Text
                style={{
                  fontSize: 10.5,
                  color: theme.textMuted,
                  marginTop: 1,
                  lineHeight: 14,
                }}
              >
                Demand predictions and safety-stock recommendations are modeled in Sales Forecast.
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setActiveNav('forecast')}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 6,
                backgroundColor: theme.chipBg,
              }}
            >
              <Text
                style={{
                  fontSize: 10.5,
                  fontWeight: '700',
                  color: isDarkMode ? '#EA580C' : '#EA580C',
                }}
              >
                Forecast →
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}
