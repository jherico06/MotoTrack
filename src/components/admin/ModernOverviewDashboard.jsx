import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { BootstrapIcon, Skeleton } from '../common';
import BookingCategoryPieChart from './BookingCategoryPieChart.jsx';
import {
  aggregateSalesTrend,
  computeProductPerformance,
  computeSalesByChannel,
  computeSalesPerformance,
  computeWeeklyKpiSeries,
} from '../../services/inventory/dashboardInsightsService.js';
import { canonicalizeStatus, ORDER_STATUSES } from '../../services/orders/orderService.js';
import { isLowStock, isOutOfStock } from '../../utils/inventoryHelpers.js';
import {
  bookingPaymentStatus,
  bookingQuotationTotal,
  FLEX_BOOKING_STATUS,
  normalizeBookingStatus,
} from '../../utils/bookingWorkflow.js';

// Helper to format currency
function formatPhp(amount) {
  const num = Math.round(Number(amount) || 0);
  return `₱${num.toLocaleString()}`;
}

// Helper to format compact currency (e.g. ₱15k, ₱10k, ₱5k, ₱0)
function formatCompactPhp(amount) {
  const num = Number(amount) || 0;
  if (num >= 1000000) return `₱${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `₱${Math.round(num / 1000)}k`;
  return `₱${Math.round(num)}`;
}

const PIPELINE_NEW = new Set([ORDER_STATUSES.PENDING_APPROVAL]);
const PIPELINE_PACKING = new Set([ORDER_STATUSES.PROCESSING, ORDER_STATUSES.READY]);
const PIPELINE_SHIPPED = new Set([
  ORDER_STATUSES.OUT,
  ORDER_STATUSES.REPORTED,
  ORDER_STATUSES.FAILED,
  ORDER_STATUSES.RESCHEDULED,
]);
const PIPELINE_DELIVERED = new Set([ORDER_STATUSES.DELIVERED, ORDER_STATUSES.RETURN_REQUESTED]);
const PIPELINE_EXCLUDED = new Set([ORDER_STATUSES.CANCELLED, ORDER_STATUSES.REFUNDED]);

const BOOKING_REVENUE_EXCLUDED = new Set([
  FLEX_BOOKING_STATUS.CANCELLED,
  FLEX_BOOKING_STATUS.REJECTED,
  FLEX_BOOKING_STATUS.CUSTOMER_DECLINED,
  FLEX_BOOKING_STATUS.BOOKING_EXPIRED,
]);
const BOOKING_REVENUE_SETTLED = new Set([
  FLEX_BOOKING_STATUS.COMPLETED,
  FLEX_BOOKING_STATUS.FULLY_PAID,
  FLEX_BOOKING_STATUS.READY_FOR_PICKUP,
]);

function bookingBill(booking) {
  const quoted = bookingQuotationTotal(booking);
  if (quoted > 0) return quoted;
  return Number(booking?.total_amount) || 0;
}

/** Cash collected, or the closed job total when a finished booking has no amount_paid. */
function recognizedBookingRevenue(booking) {
  const status = normalizeBookingStatus(booking?.status);
  const paid = Number(booking?.amount_paid) || 0;
  const downpayment =
    booking?.downpayment_status === 'Paid' || booking?.downpayment_paid
      ? Number(booking?.downpayment_amount) || 0
      : 0;
  const collected = Math.max(paid, downpayment);
  if (BOOKING_REVENUE_EXCLUDED.has(status)) return collected;
  const payment = String(bookingPaymentStatus(booking) || '')
    .toUpperCase()
    .replace(/\s+/g, '_');
  const settled =
    payment === 'FULLY_PAID' ||
    payment === 'PAID' ||
    payment === 'COMPLETED' ||
    BOOKING_REVENUE_SETTLED.has(status);
  if (settled) return Math.max(collected, bookingBill(booking));
  return collected;
}

function sharePct(value, maxVal) {
  const amount = Number(value) || 0;
  if (amount <= 0 || maxVal <= 0) return 0;
  return Math.min(100, Math.max(6, (amount / maxVal) * 100));
}

// Compute monotone cubic spline paths for smooth SVG chart
function computeSplinePaths(pts, padding, gH, baseline) {
  const n = pts.length;
  if (n === 0) return { linePath: '', areaPath: '' };
  if (n === 1) {
    const l = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
    return { linePath: l, areaPath: '' };
  }

  const dxs = [];
  const dys = [];
  const slopes = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x;
    const dy = pts[i + 1].y - pts[i].y;
    dxs.push(dx);
    dys.push(dy);
    slopes.push(dx !== 0 ? dy / dx : 0);
  }

  const m = new Array(n);
  m[0] = slopes[0];
  m[n - 1] = slopes[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (slopes[i - 1] * slopes[i] <= 0) {
      m[i] = 0;
    } else {
      m[i] = (slopes[i - 1] + slopes[i]) / 2;
    }
  }

  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(slopes[i]) < 1e-6) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const alpha = m[i] / slopes[i];
      const beta = m[i + 1] / slopes[i];
      const dist = alpha * alpha + beta * beta;
      if (dist > 9) {
        const tau = 3 / Math.sqrt(dist);
        m[i] = tau * alpha * slopes[i];
        m[i + 1] = tau * beta * slopes[i];
      }
    }
  }

  let linePath = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const dx = p1.x - p0.x;
    const cp1x = p0.x + dx / 3;
    const cp1y = p0.y + (m[i] * dx) / 3;
    const cp2x = p1.x - dx / 3;
    const cp2y = p1.y - (m[i + 1] * dx) / 3;
    linePath += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`;
  }

  const lastPt = pts[n - 1];
  const firstPt = pts[0];
  const areaPath = `${linePath} L ${lastPt.x.toFixed(1)},${baseline.toFixed(1)} L ${firstPt.x.toFixed(1)},${baseline.toFixed(1)} Z`;

  return { linePath, areaPath };
}

export default function ModernOverviewDashboard({
  isLoading = false,
  orders = [],
  products = [],
  garageBookings = [],
  _suppliers = [],
  analyticsData = {},
  orderStats = {},
  invStats = {},
  profitOverview = {},
  bookingStats = {},
  dashboardInsights = {},
  setActiveNav = () => {},
  openOrderModal = () => {},
  setOrderStatusFilter = () => {},
  setInvStockFilter = () => {},
  setBookingStatusFilter = () => {},
  isDarkMode = false,
  isDesktop = true,
  _tokens = {},
}) {
  const { width: windowWidth } = useWindowDimensions();
  // Telemetry Granularity: 'daily' | 'weekly' | 'monthly'
  const [granularity, setGranularity] = useState('daily');
  // Interactive chart hover
  const [hoveredIndex, setHoveredIndex] = useState(null);
  // Table channel filter: 'all' | 'online' | 'pos' | 'pending'
  const [tableFilter, setTableFilter] = useState('all');

  // Refined Clean Palette matching reference design
  const theme = useMemo(() => {
    if (isDarkMode) {
      return {
        bg: '#111315',
        cardBg: '#18181B',
        cardBorder: 'rgba(255, 255, 255, 0.08)',
        textPrimary: '#F4F4F5',
        textMuted: '#A1A1AA',
        textSecondary: '#D4D4D8',
        brandGreen: '#EA580C',
        brandDarkGreen: '#18181B',
        pillBg: '#27272A',
        pillActiveBg: '#3F3F46',
        pillActiveText: '#FFFFFF',
        pillInactiveText: '#A1A1AA',
        chartStroke: '#EA580C',
        chartGradStart: '#EA580C',
        chartGradEnd: 'rgba(234, 88, 12, 0.02)',
        avgLineColor: '#71717A',
        sparklineStroke: '#EA580C',
        borderSubtle: 'rgba(255, 255, 255, 0.08)',
        tableRowHover: '#27272A',
        badgeGreenBg: 'rgba(16, 185, 129, 0.15)',
        badgeGreenText: '#34D399',
        badgeGreenBorder: 'rgba(52, 211, 153, 0.25)',
      };
    }
    return {
      bg: '#F8F9FA',
      cardBg: '#FFFFFF',
      cardBorder: '#E4E4E7',
      textPrimary: '#18181B',
      textMuted: '#71717A',
      textSecondary: '#52525B',
      brandGreen: '#EA580C',
      brandDarkGreen: '#18181B',
      pillBg: '#F4F4F5',
      pillActiveBg: '#FFFFFF',
      pillActiveText: '#18181B',
      pillInactiveText: '#71717A',
      chartStroke: '#EA580C',
      chartGradStart: '#EA580C',
      chartGradEnd: 'rgba(234, 88, 12, 0.02)',
      avgLineColor: '#A1A1AA',
      sparklineStroke: '#EA580C',
      borderSubtle: '#F1F5F9',
      tableRowHover: '#FAFAFA',
      badgeGreenBg: '#ECFDF5',
      badgeGreenText: '#059669',
      badgeGreenBorder: '#A7F3D0',
    };
  }, [isDarkMode]);

  // Total sales
  const totalRevenue = Number(analyticsData.totalRevenue) || 0;
  const aov = Number.isFinite(Number(analyticsData.aov)) ? Number(analyticsData.aov) : 0;
  const weeklyKpis = useMemo(() => computeWeeklyKpiSeries(orders, 8), [orders]);

  // Orders mini vertical bars (6 bars matching reference image: gray bars with 2 orange bars on right)
  const orderBars = useMemo(() => {
    const series = (weeklyKpis || []).map((b) => Number(b.orders) || 0);
    const max = Math.max(1, ...series);
    if (series.length === 0) {
      return [35, 50, 40, 65, 80, 100];
    }
    return series.slice(-6).map((val) => Math.max(20, Math.round((val / max) * 100)));
  }, [weeklyKpis]);

  // Sales Performance metrics
  const salesPerformance = useMemo(() => {
    if (dashboardInsights?.salesPerformance) {
      return dashboardInsights.salesPerformance;
    }
    return computeSalesPerformance(orders);
  }, [dashboardInsights, orders]);

  // Aggregate Sales Trend telemetry
  const trendBuckets = useMemo(() => {
    return aggregateSalesTrend(orders, granularity);
  }, [orders, granularity]);

  // Process chart telemetry with smooth Orange Spline
  const chartTelemetry = useMemo(() => {
    const rawList = trendBuckets || [];
    const len = rawList.length;

    let totalRev = 0;
    let totalOrders = 0;
    let peakRev = 0;
    let peakLabel = '—';

    rawList.forEach((b) => {
      const rev = Number(b.revenue) || 0;
      totalRev += rev;
      totalOrders += Number(b.ordersCount) || 0;
      if (rev > peakRev) {
        peakRev = rev;
        peakLabel = b.label || '';
      }
    });

    const avgRev = len > 0 ? totalRev / len : 0;
    const maxRev = Math.max(100, ...rawList.map((r) => Number(r.revenue) || 0));
    const roundedMax = Math.ceil((maxRev * 1.25) / 50) * 50;

    const padding = { top: 20, right: 16, bottom: 26, left: 42 };
    const chartW = 760;
    const chartH = 210;
    const gW = chartW - padding.left - padding.right;
    const gH = chartH - padding.top - padding.bottom;
    const baseline = padding.top + gH;

    const points = rawList.map((d, i) => {
      const x = padding.left + (i / Math.max(1, len - 1)) * gW;
      const rev = Number(d.revenue) || 0;
      const y = padding.top + gH - (rev / roundedMax) * gH;
      return {
        ...d,
        index: i,
        revenue: rev,
        ordersCount: Number(d.ordersCount) || 0,
        x,
        y,
      };
    });

    const paths = computeSplinePaths(points, padding, gH, baseline);
    const avgY = padding.top + gH - (avgRev / roundedMax) * gH;
    const yTicks = [0, 0.33, 0.66, 1].map((f) => Math.round(roundedMax * f));

    return {
      points,
      roundedMax,
      yTicks,
      totalRev,
      avgRev,
      peakRev,
      peakLabel,
      totalOrders,
      avgY,
      linePath: paths.linePath,
      areaPath: paths.areaPath,
      padding,
      chartW,
      chartH,
      gW,
      gH,
      baseline,
    };
  }, [trendBuckets]);

  // Order Pipeline stage breakdown from canonical order statuses
  const orderPipeline = useMemo(() => {
    let newCount = 0;
    let packingCount = 0;
    let shippedCount = 0;
    let deliveredCount = 0;

    (orders || []).forEach((o) => {
      const status = canonicalizeStatus(o.status);
      if (PIPELINE_EXCLUDED.has(status)) return;
      if (PIPELINE_NEW.has(status)) newCount += 1;
      else if (PIPELINE_PACKING.has(status)) packingCount += 1;
      else if (PIPELINE_SHIPPED.has(status)) shippedCount += 1;
      else if (PIPELINE_DELIVERED.has(status)) deliveredCount += 1;
    });

    const total = newCount + packingCount + shippedCount + deliveredCount;
    const share = (count) => (total > 0 ? (count / total) * 100 : 0);

    return {
      newCount,
      packingCount,
      shippedCount,
      deliveredCount,
      total,
      pctNew: share(newCount),
      pctPacking: share(packingCount),
      pctShipped: share(shippedCount),
      pctDelivered: share(deliveredCount),
    };
  }, [orders]);

  // Revenue by channel from paid orders and collected/closed service bookings
  const channelBreakdown = useMemo(() => {
    const byChannel = dashboardInsights?.salesByChannel || computeSalesByChannel(orders);
    const garage = (garageBookings || []).reduce(
      (sum, booking) => sum + recognizedBookingRevenue(booking),
      0
    );

    const channels = [
      { key: 'webshop', label: 'Online Store', value: Number(byChannel.online) || 0 },
      { key: 'pos', label: 'POS (In-Store Cashier)', value: Number(byChannel.pos) || 0 },
      { key: 'garage', label: 'Garage & Services', value: garage },
    ];

    const maxVal = Math.max(0, ...channels.map((c) => c.value));
    return channels.map((c) => ({
      ...c,
      pct: sharePct(c.value, maxVal),
    }));
  }, [dashboardInsights, orders, garageBookings]);

  // Top sellers ranked by units actually sold on non-cancelled orders
  const topSellersList = useMemo(() => {
    const { bestSelling } = computeProductPerformance(orders, products, { topLimit: 200 });
    const catalogNames = new Set(
      (products || []).map((p) => String(p.name || '').trim().toLowerCase()).filter(Boolean)
    );
    const ranked = bestSelling
      .filter((p) => catalogNames.size === 0 || catalogNames.has(String(p.name || '').trim().toLowerCase()))
      .sort((a, b) => (b.unitsSold || 0) - (a.unitsSold || 0) || (b.revenue || 0) - (a.revenue || 0))
      .slice(0, 5);
    const maxUnits = Math.max(0, ...ranked.map((p) => Number(p.unitsSold) || 0));

    return ranked.map((p, idx) => ({
      rank: idx + 1,
      name: p.name,
      image_url: p.image_url,
      unitsSold: Number(p.unitsSold) || 0,
      revenue: Number(p.revenue) || 0,
      pct: sharePct(p.unitsSold, maxUnits),
    }));
  }, [orders, products]);

  // Low stock alert preview
  const runningLowItems = useMemo(() => {
    const list = (products || []).filter((p) => isOutOfStock(p) || isLowStock(p, 5));

    return list.slice(0, 3).map((p) => {
      const qty = Number(p.stock_quantity ?? p.stock ?? 0);
      return {
        id: p.id || p.product_id,
        name: p.name,
        isOut: qty <= 0,
        qty,
      };
    });
  }, [products]);

  // Filtered recent orders for the organized table
  const filteredOrders = useMemo(() => {
    let list = orders || [];
    if (tableFilter === 'online') {
      list = list.filter((o) => o.channel !== 'POS (In-Store)');
    } else if (tableFilter === 'pos') {
      list = list.filter((o) => o.channel === 'POS (In-Store)');
    } else if (tableFilter === 'pending') {
      list = list.filter((o) => {
        const st = String(o.status || '').toLowerCase();
        return st.includes('pending') || st.includes('approval');
      });
    }
    return list.slice(0, 50);
  }, [orders, tableFilter]);

  const activeHoverPoint = hoveredIndex != null ? chartTelemetry.points[hoveredIndex] : null;

  if (isLoading) {
    return <ModernOverviewDashboardSkeleton isDarkMode={isDarkMode} isDesktop={isDesktop} />;
  }

  return (
    <View
      style={[
        { width: '100%', gap: 20 },
        Platform.OS === 'web' && { animation: 'mototrack-fade-in 0.22s cubic-bezier(0.16, 1, 0.3, 1)' },
      ]}
      className={Platform.OS === 'web' ? 'mototrack-content-fade-in' : undefined}
    >
      {/* ─── ROW 1: 4 EXECUTIVE KPI CARDS (EXACT ARRANGEMENT FROM SCREENSHOT) ─── */}
      <View
        style={{
          display: 'grid',
          gridTemplateColumns: isDesktop
            ? 'repeat(4, 1fr)'
            : windowWidth < 640
            ? '1fr'
            : 'repeat(2, 1fr)',
          gap: 16,
          alignItems: 'stretch',
        }}
      >
        {/* KPI 1: REVENUE */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setActiveNav('analytics')}
          style={{
            backgroundColor: theme.cardBg,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.cardBorder,
            padding: 20,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
            justifyContent: 'space-between',
            cursor: 'pointer',
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 13, fontWeight: '500', color: theme.textMuted }}>Revenue</Text>
            <View
              style={{
                backgroundColor: theme.badgeGreenBg,
                paddingHorizontal: 8,
                paddingVertical: 2.5,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: theme.badgeGreenBorder,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '600', color: theme.badgeGreenText }}>
                +12.4%
              </Text>
            </View>
          </View>

          <View style={{ marginVertical: 12 }}>
            <Text
              style={{
                fontSize: 28,
                fontWeight: '600',
                color: theme.textPrimary,
                letterSpacing: -0.6,
                fontVariant: ['tabular-nums'],
              }}
            >
              {formatPhp(totalRevenue)}
            </Text>
            <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 3 }}>
              Recognized sales
            </Text>
          </View>

          {/* Smooth Wave SVG Sparkline */}
          <View style={{ width: '100%', height: 28, marginTop: 4 }}>
            {Platform.OS === 'web' && (
              <svg width="100%" height="28" viewBox="0 0 140 28" preserveAspectRatio="none">
                <path
                  d="M 0,22 Q 35,26 60,14 T 120,8 T 140,4"
                  fill="none"
                  stroke="#EA580C"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </View>
        </TouchableOpacity>

        {/* KPI 2: ORDERS */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            setOrderStatusFilter('All');
            setActiveNav('orders');
          }}
          style={{
            backgroundColor: theme.cardBg,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.cardBorder,
            padding: 20,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
            justifyContent: 'space-between',
            cursor: 'pointer',
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 13, fontWeight: '500', color: theme.textMuted }}>Orders</Text>
            <View
              style={{
                backgroundColor: theme.badgeGreenBg,
                paddingHorizontal: 8,
                paddingVertical: 2.5,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: theme.badgeGreenBorder,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '600', color: theme.badgeGreenText }}>
                +8.2%
              </Text>
            </View>
          </View>

          <View style={{ marginVertical: 12 }}>
            <Text
              style={{
                fontSize: 28,
                fontWeight: '600',
                color: theme.textPrimary,
                letterSpacing: -0.6,
                fontVariant: ['tabular-nums'],
              }}
            >
              {(orderStats.total || orders.length).toLocaleString()}
            </Text>
            <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 3 }}>
              {orderStats.delivered || 0} delivered
            </Text>
          </View>

          {/* Mini Bar Sparkline matching screenshot */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: 4,
              height: 26,
              width: '45%',
              marginTop: 6,
            }}
          >
            {orderBars.map((h, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: `${h}%`,
                  backgroundColor: i >= 4 ? '#EA580C' : isDarkMode ? '#3F3F46' : '#E4E4E7',
                  borderRadius: 2,
                }}
              />
            ))}
          </View>
        </TouchableOpacity>

        {/* KPI 3: NET PROFIT */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setActiveNav('analytics')}
          style={{
            backgroundColor: theme.cardBg,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.cardBorder,
            padding: 20,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
            justifyContent: 'space-between',
            cursor: 'pointer',
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 13, fontWeight: '500', color: theme.textMuted }}>Net profit</Text>
            <View
              style={{
                backgroundColor: theme.badgeGreenBg,
                paddingHorizontal: 8,
                paddingVertical: 2.5,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: theme.badgeGreenBorder,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '600', color: theme.badgeGreenText }}>
                +9.1%
              </Text>
            </View>
          </View>

          <View style={{ marginVertical: 12 }}>
            <Text
              style={{
                fontSize: 28,
                fontWeight: '600',
                color: theme.textPrimary,
                letterSpacing: -0.6,
                fontVariant: ['tabular-nums'],
              }}
            >
              {formatPhp(profitOverview.soldProfit || 0)}
            </Text>
            <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 3 }}>
              {(profitOverview.soldMargin || 0).toFixed(1)}% margin
            </Text>
          </View>

          {/* Horizontal Orange Active Indicator Line with Gray Track */}
          <View
            style={{
              height: 3,
              borderRadius: 2,
              backgroundColor: isDarkMode ? '#27272A' : '#F4F4F5',
              overflow: 'hidden',
              marginTop: 22,
            }}
          >
            <View
              style={{
                height: '100%',
                width: `${Math.min(100, Math.max(15, profitOverview.soldMargin || 75))}%`,
                backgroundColor: '#EA580C',
                borderRadius: 2,
              }}
            />
          </View>
        </TouchableOpacity>

        {/* KPI 4: AVG ORDER */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setActiveNav('analytics')}
          style={{
            backgroundColor: theme.cardBg,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.cardBorder,
            padding: 20,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
            justifyContent: 'space-between',
            cursor: 'pointer',
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 13, fontWeight: '500', color: theme.textMuted }}>Avg. order</Text>
            <View
              style={{
                backgroundColor: isDarkMode ? '#27272A' : '#F4F4F5',
                paddingHorizontal: 8,
                paddingVertical: 2.5,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: theme.borderSubtle,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '500', color: theme.textMuted }}>
                This month
              </Text>
            </View>
          </View>

          <View style={{ marginVertical: 12 }}>
            <Text
              style={{
                fontSize: 28,
                fontWeight: '600',
                color: theme.textPrimary,
                letterSpacing: -0.6,
                fontVariant: ['tabular-nums'],
              }}
            >
              {formatPhp(aov)}
            </Text>
            <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 3 }}>
              Per completed order
            </Text>
          </View>

          {/* Horizontal Dark Gray / Zinc Indicator with Light Track */}
          <View
            style={{
              height: 3,
              borderRadius: 2,
              backgroundColor: isDarkMode ? '#27272A' : '#F4F4F5',
              overflow: 'hidden',
              marginTop: 22,
            }}
          >
            <View
              style={{
                height: '100%',
                width: '60%',
                backgroundColor: isDarkMode ? '#52525B' : '#A1A1AA',
                borderRadius: 2,
              }}
            />
          </View>
        </TouchableOpacity>
      </View>

      {/* ─── ROW 2: REVENUE OVERVIEW (LEFT, SPAN 3) & ORDER PIPELINE (RIGHT, SPAN 1) ─── */}
      <View
        style={{
          display: 'grid',
          gridTemplateColumns: isDesktop ? 'repeat(4, 1fr)' : '1fr',
          gap: 16,
          alignItems: 'stretch',
        }}
      >
        {/* LEFT: REVENUE OVERVIEW SPLINE CHART CARD */}
        <View
          style={{
            gridColumn: isDesktop ? 'span 3' : 'span 1',
            minWidth: 0,
            backgroundColor: theme.cardBg,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.cardBorder,
            padding: 22,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
            justifyContent: 'space-between',
            alignSelf: 'stretch',
          }}
        >
          {/* Header Row: Title & Capsule Filter */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: theme.textPrimary, letterSpacing: -0.2 }}>
                Revenue overview
              </Text>
              <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                Sales performance over time
              </Text>
            </View>

            {/* Clean Capsule: Daily | Weekly | Monthly */}
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: theme.pillBg,
                borderRadius: 8,
                padding: 3,
                gap: 2,
                borderWidth: 1,
                borderColor: theme.borderSubtle,
              }}
            >
              {[
                { key: 'daily', label: 'Daily' },
                { key: 'weekly', label: 'Weekly' },
                { key: 'monthly', label: 'Monthly' },
              ].map((item) => {
                const isActive = granularity === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    onPress={() => setGranularity(item.key)}
                    activeOpacity={0.8}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 5,
                      borderRadius: 6,
                      backgroundColor: isActive ? theme.pillActiveBg : 'transparent',
                      boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.06)' : undefined,
                      cursor: 'pointer',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: isActive ? '600' : '500',
                        color: isActive ? theme.pillActiveText : theme.pillInactiveText,
                      }}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Area Line Chart with Orange Curve & Area */}
          <View style={{ width: '100%', height: 210, position: 'relative' }}>
            {Platform.OS === 'web' && (
              <svg
                width="100%"
                height="210"
                viewBox={`0 0 ${chartTelemetry.chartW} ${chartTelemetry.chartH}`}
                preserveAspectRatio="none"
                style={{ display: 'block', overflow: 'visible', userSelect: 'none' }}
              >
                <defs>
                  {/* Clean Orange Gradient tapering to transparent */}
                  <linearGradient id="motoOverviewOrangeGradExact" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#EA580C" stopOpacity={isDarkMode ? 0.28 : 0.22} />
                    <stop offset="70%" stopColor="#EA580C" stopOpacity={isDarkMode ? 0.08 : 0.04} />
                    <stop offset="100%" stopColor="#EA580C" stopOpacity={0.0} />
                  </linearGradient>
                </defs>

                {/* Y-Axis Gridlines & Left Labels */}
                {chartTelemetry.yTicks.map((val, idx) => {
                  const yPos =
                    chartTelemetry.padding.top +
                    chartTelemetry.gH -
                    (val / chartTelemetry.roundedMax) * chartTelemetry.gH;
                  return (
                    <g key={`ytick-${idx}`}>
                      <line
                        x1={chartTelemetry.padding.left}
                        y1={yPos}
                        x2={chartTelemetry.chartW}
                        y2={yPos}
                        stroke={isDarkMode ? 'rgba(255,255,255,0.06)' : '#F1F5F9'}
                        strokeWidth="1"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={0}
                        y={yPos + 4}
                        textAnchor="start"
                        fontSize="10"
                        fontWeight="500"
                        fill={isDarkMode ? '#71717A' : '#A1A1AA'}
                      >
                        {formatCompactPhp(val)}
                      </text>
                    </g>
                  );
                })}

                {/* Filled Orange Gradient Area */}
                <path d={chartTelemetry.areaPath} fill="url(#motoOverviewOrangeGradExact)" />

                {/* Main Curve Stroke Line */}
                <path
                  d={chartTelemetry.linePath}
                  fill="none"
                  stroke="#EA580C"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Circle marker on latest point (matching screenshot) */}
                {chartTelemetry.points.length > 0 && (() => {
                  const lastPt = chartTelemetry.points[chartTelemetry.points.length - 1];
                  return (
                    <g key="last-point-marker">
                      <circle
                        cx={lastPt.x}
                        cy={lastPt.y}
                        r={4.5}
                        fill="#EA580C"
                        stroke="#FFFFFF"
                        strokeWidth={2}
                      />
                    </g>
                  );
                })()}

                {/* X-Axis Dates */}
                {chartTelemetry.points.map((pt, idx) => {
                  const isFirst = idx === 0;
                  const isLast = idx === chartTelemetry.points.length - 1;
                  const anchor = isFirst ? 'start' : isLast ? 'end' : 'middle';
                  const displayLabel = pt.label;

                  return (
                    <text
                      key={`lbl-${idx}`}
                      x={pt.x}
                      y={chartTelemetry.baseline + 16}
                      textAnchor={anchor}
                      fontSize="10"
                      fontWeight="500"
                      fill={isDarkMode ? '#71717A' : '#A1A1AA'}
                    >
                      {displayLabel}
                    </text>
                  );
                })}

                {/* Interactive Hit Areas */}
                {chartTelemetry.points.map((pt, idx) => {
                  return (
                    <circle
                      key={`hit-${idx}`}
                      cx={pt.x}
                      cy={pt.y}
                      r={14}
                      fill="transparent"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    />
                  );
                })}

                {/* Hover Tooltip */}
                {activeHoverPoint && (
                  <g pointerEvents="none">
                    <line
                      x1={activeHoverPoint.x}
                      y1={chartTelemetry.padding.top}
                      x2={activeHoverPoint.x}
                      y2={chartTelemetry.baseline}
                      stroke="#EA580C"
                      strokeWidth="1.2"
                      strokeDasharray="2 2"
                    />
                    <circle
                      cx={activeHoverPoint.x}
                      cy={activeHoverPoint.y}
                      r={5}
                      fill="#EA580C"
                      stroke="#FFFFFF"
                      strokeWidth={2}
                    />
                    {(() => {
                      const ttW = 90;
                      const ttH = 38;
                      const ttX = Math.min(
                        chartTelemetry.chartW - ttW,
                        Math.max(chartTelemetry.padding.left, activeHoverPoint.x - ttW / 2)
                      );
                      const ttY = Math.max(2, activeHoverPoint.y - ttH - 8);
                      return (
                        <g>
                          <rect
                            x={ttX}
                            y={ttY}
                            width={ttW}
                            height={ttH}
                            rx="8"
                            fill={isDarkMode ? '#27272A' : '#18181B'}
                          />
                          <text
                            x={ttX + ttW / 2}
                            y={ttY + 16}
                            textAnchor="middle"
                            fontSize="11.5"
                            fontWeight="600"
                            fill="#FFFFFF"
                          >
                            {formatPhp(activeHoverPoint.revenue)}
                          </text>
                          <text
                            x={ttX + ttW / 2}
                            y={ttY + 30}
                            textAnchor="middle"
                            fontSize="10"
                            fontWeight="400"
                            fill="#A1A1AA"
                          >
                            {activeHoverPoint.label}
                          </text>
                        </g>
                      );
                    })()}
                  </g>
                )}
              </svg>
            )}
          </View>
        </View>

        {/* RIGHT: ORDER PIPELINE CARD (EXACT MATCH TO SCREENSHOT) */}
        <View
          style={{
            gridColumn: 'span 1',
            minWidth: 0,
            backgroundColor: theme.cardBg,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.cardBorder,
            padding: 22,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
            justifyContent: 'space-between',
          }}
        >
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: theme.textPrimary, letterSpacing: -0.2 }}>
                  Order pipeline
                </Text>
                <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                  Open orders by stage
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setActiveNav('orders')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, cursor: 'pointer' }}
              >
                <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#EA580C' }}>All orders</Text>
                <BootstrapIcon name="arrow-right" size={12} color="#EA580C" />
              </TouchableOpacity>
            </View>

            {/* Big Total Orders Stat */}
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginVertical: 18 }}>
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: '700',
                  color: theme.textPrimary,
                  letterSpacing: -0.6,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {orderPipeline.total}
              </Text>
              <Text style={{ fontSize: 13, color: theme.textMuted }}>Total orders</Text>
            </View>

            {/* Multi-segment horizontal bar matching screenshot */}
            <View
              style={{
                height: 8,
                borderRadius: 4,
                backgroundColor: isDarkMode ? '#27272A' : '#F4F4F5',
                flexDirection: 'row',
                overflow: 'hidden',
                marginBottom: 24,
                gap: 2,
              }}
            >
              {[
                { key: 'new', pct: orderPipeline.pctNew, color: '#EA580C' },
                { key: 'packing', pct: orderPipeline.pctPacking, color: isDarkMode ? '#A1A1AA' : '#27272A' },
                { key: 'shipped', pct: orderPipeline.pctShipped, color: '#3B82F6' },
                { key: 'delivered', pct: orderPipeline.pctDelivered, color: isDarkMode ? '#52525B' : '#D4D4D8' },
              ]
                .filter((segment) => segment.pct > 0)
                .map((segment) => (
                  <View
                    key={segment.key}
                    style={{
                      height: '100%',
                      width: `${segment.pct}%`,
                      backgroundColor: segment.color,
                      borderRadius: 2,
                    }}
                  />
                ))}
            </View>

            {/* Clean stage breakdown list */}
            <View style={{ gap: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#EA580C' }} />
                  <Text style={{ fontSize: 13, color: theme.textSecondary }}>New</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textPrimary, fontVariant: ['tabular-nums'] }}>
                  {orderPipeline.newCount}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isDarkMode ? '#A1A1AA' : '#27272A' }} />
                  <Text style={{ fontSize: 13, color: theme.textSecondary }}>Processing</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textPrimary, fontVariant: ['tabular-nums'] }}>
                  {orderPipeline.packingCount}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isDarkMode ? '#52525B' : '#D4D4D8' }} />
                  <Text style={{ fontSize: 13, color: theme.textSecondary }}>Delivered</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textPrimary, fontVariant: ['tabular-nums'] }}>
                  {orderPipeline.deliveredCount}
                </Text>
              </View>
            </View>
          </View>

          <View style={{ height: 1 }} />
        </View>
      </View>

      {/* ─── ROW 3: SALES PERFORMANCE BENCHMARKS (EXECUTIVE ROW) ─── */}
      <View
        style={{
          backgroundColor: theme.cardBg,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: theme.cardBorder,
          padding: 22,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <View>
            <Text style={{ fontSize: 16, fontWeight: '700', color: theme.textPrimary, letterSpacing: -0.2 }}>
              Sales Performance
            </Text>
            <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
              Executive revenue telemetry and order benchmarks across operational periods
            </Text>
          </View>
          <TouchableOpacity onPress={() => setActiveNav('analytics')} style={{ cursor: 'pointer' }}>
            <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#EA580C' }}>
              View Analytics →
            </Text>
          </TouchableOpacity>
        </View>

        {/* 4 Performance KPI Cards */}
        <View
          style={{
            display: 'grid',
            gridTemplateColumns: isDesktop
              ? 'repeat(4, 1fr)'
              : windowWidth < 640
              ? '1fr'
              : 'repeat(2, 1fr)',
            gap: 14,
          }}
        >
          {/* Card 1: Today's Sales */}
          <View
            style={{
              padding: 16,
              borderRadius: 12,
              backgroundColor: isDarkMode ? '#202225' : '#FAFAFA',
              borderWidth: 1,
              borderColor: theme.borderSubtle,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <BootstrapIcon name="calendar2-check" size={14} color="#EA580C" />
              <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textSecondary }}>Today's Sales</Text>
            </View>
            <Text style={{ fontSize: 20, fontWeight: '600', color: theme.textPrimary, fontVariant: ['tabular-nums'] }}>
              {formatPhp(salesPerformance.todaySales || 0)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Text style={{ fontSize: 11.5, color: theme.textMuted }}>
                {salesPerformance.todayOrderCount || 0} orders
              </Text>
              {salesPerformance.todayCompare?.pct != null && (
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '600',
                    color: salesPerformance.todayCompare.direction === 'down' ? '#EF4444' : '#10B981',
                  }}
                >
                  {salesPerformance.todayCompare.direction === 'down' ? '↘' : '↗'} {Math.abs(salesPerformance.todayCompare.pct)}%
                </Text>
              )}
            </View>
          </View>

          {/* Card 2: This Week's Sales */}
          <View
            style={{
              padding: 16,
              borderRadius: 12,
              backgroundColor: isDarkMode ? '#202225' : '#FAFAFA',
              borderWidth: 1,
              borderColor: theme.borderSubtle,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <BootstrapIcon name="graph-up-arrow" size={14} color="#EA580C" />
              <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textSecondary }}>This Week</Text>
            </View>
            <Text style={{ fontSize: 20, fontWeight: '600', color: theme.textPrimary, fontVariant: ['tabular-nums'] }}>
              {formatPhp(salesPerformance.weekSales || 0)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Text style={{ fontSize: 11.5, color: theme.textMuted }}>
                {salesPerformance.weekOrderCount || 0} orders
              </Text>
              {salesPerformance.weekCompare?.pct != null && (
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '600',
                    color: salesPerformance.weekCompare.direction === 'down' ? '#EF4444' : '#10B981',
                  }}
                >
                  {salesPerformance.weekCompare.direction === 'down' ? '↘' : '↗'} {Math.abs(salesPerformance.weekCompare.pct)}%
                </Text>
              )}
            </View>
          </View>

          {/* Card 3: This Month's Sales */}
          <View
            style={{
              padding: 16,
              borderRadius: 12,
              backgroundColor: isDarkMode ? '#202225' : '#FAFAFA',
              borderWidth: 1,
              borderColor: theme.borderSubtle,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <BootstrapIcon name="cash-stack" size={14} color="#EA580C" />
              <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textSecondary }}>This Month</Text>
            </View>
            <Text style={{ fontSize: 20, fontWeight: '600', color: theme.textPrimary, fontVariant: ['tabular-nums'] }}>
              {formatPhp(salesPerformance.monthSales || 0)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Text style={{ fontSize: 11.5, color: theme.textMuted }}>
                {salesPerformance.monthOrderCount || 0} orders
              </Text>
              {salesPerformance.monthCompare?.pct != null && (
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '600',
                    color: salesPerformance.monthCompare.direction === 'down' ? '#EF4444' : '#10B981',
                  }}
                >
                  {salesPerformance.monthCompare.direction === 'down' ? '↘' : '↗'} {Math.abs(salesPerformance.monthCompare.pct)}%
                </Text>
              )}
            </View>
          </View>

          {/* Card 4: Action Required */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              if ((invStats.lowStockCount || 0) > 0 || (invStats.outOfStockCount || 0) > 0) {
                setInvStockFilter('lowStock');
                setActiveNav('inventory');
              } else if (orderStats.pendingCod > 0) {
                setOrderStatusFilter('Pending Approval');
                setActiveNav('orders');
              } else if (bookingStats.pending > 0) {
                setBookingStatusFilter('Pending');
                setActiveNav('garage');
              }
            }}
            style={{
              padding: 16,
              borderRadius: 12,
              backgroundColor: isDarkMode ? '#202225' : '#FAFAFA',
              borderWidth: 1,
              borderColor: theme.borderSubtle,
              cursor: 'pointer',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <BootstrapIcon name="clock-history" size={14} color="#F59E0B" />
                <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textSecondary }}>Action Required</Text>
              </View>
              {(orderStats.pendingCod > 0 || bookingStats.pending > 0 || (invStats.lowStockCount || 0) > 0) && (
                <View
                  style={{
                    backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7',
                    paddingHorizontal: 6,
                    paddingVertical: 1.5,
                    borderRadius: 4,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#D97706' }}>Action</Text>
                </View>
              )}
            </View>
            <Text style={{ fontSize: 20, fontWeight: '600', color: theme.textPrimary, fontVariant: ['tabular-nums'] }}>
              {(orderStats.pendingCod || 0) + (bookingStats.pending || 0) + ((invStats.lowStockCount || 0) + (invStats.outOfStockCount || 0))}
            </Text>
            <View style={{ gap: 2, marginTop: 4 }}>
              <Text style={{ fontSize: 11.5, color: theme.textMuted }}>
                {orderStats.pendingCod || 0} COD · {bookingStats.pending || 0} Bookings · {(invStats.lowStockCount || 0) + (invStats.outOfStockCount || 0)} Low Stock
              </Text>
              {runningLowItems.length > 0 && (
                <Text numberOfLines={1} style={{ fontSize: 10.5, color: '#D97706', fontWeight: '500' }}>
                  ⚠️ {runningLowItems[0].name} ({runningLowItems[0].isOut ? 'Out of stock' : `${runningLowItems[0].qty} left`})
                </Text>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── ROW 4: WORKSHOP & SERVICE BOOKINGS ─── */}
      <View
        style={{
          flexDirection: isDesktop ? 'row' : 'column',
          gap: 18,
          alignItems: 'stretch',
        }}
      >
        {/* SERVICE BOOKINGS PIE CHART */}
        <View style={{ flex: isDesktop ? 1.35 : 1 }}>
          <BookingCategoryPieChart
            bookings={garageBookings}
            isDark={isDarkMode}
            isDesktop={isDesktop}
            style={{
              width: '100%',
              marginBottom: 0,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: theme.cardBorder,
              backgroundColor: theme.cardBg,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
            }}
          />
        </View>

        {/* WORKSHOP STATUS CARD */}
        <View
          style={{
            flex: 1,
            backgroundColor: theme.cardBg,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.cardBorder,
            padding: 22,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
            justifyContent: 'space-between',
          }}
        >
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: theme.textPrimary, letterSpacing: -0.2 }}>
                  Workshop Appointments
                </Text>
                <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                  Live pit crew & service bay status
                </Text>
              </View>
              <TouchableOpacity onPress={() => setActiveNav('garage')} style={{ cursor: 'pointer' }}>
                <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#EA580C' }}>
                  Manage →
                </Text>
              </TouchableOpacity>
            </View>

            {/* Quick Service Stats */}
            <View style={{ gap: 10, marginVertical: 6 }}>
              <TouchableOpacity
                onPress={() => {
                  setBookingStatusFilter('Completed');
                  setActiveNav('garage');
                }}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 12,
                  borderRadius: 10,
                  backgroundColor: isDarkMode ? '#202225' : '#FAFAFA',
                  borderWidth: 1,
                  borderColor: theme.borderSubtle,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <BootstrapIcon name="calendar-check" size={16} color="#10B981" />
                  <Text style={{ fontSize: 13, fontWeight: '500', color: theme.textPrimary }}>Completed Services</Text>
                </View>
                <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textPrimary, fontVariant: ['tabular-nums'] }}>
                  {bookingStats.completed || 0}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setBookingStatusFilter('In Progress');
                  setActiveNav('garage');
                }}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 12,
                  borderRadius: 10,
                  backgroundColor: isDarkMode ? '#202225' : '#FAFAFA',
                  borderWidth: 1,
                  borderColor: theme.borderSubtle,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <BootstrapIcon name="tools" size={16} color="#3B82F6" />
                  <Text style={{ fontSize: 13, fontWeight: '500', color: theme.textPrimary }}>Currently In Service</Text>
                </View>
                <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textPrimary, fontVariant: ['tabular-nums'] }}>
                  {bookingStats.inProgress || 0}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setBookingStatusFilter('Pending');
                  setActiveNav('garage');
                }}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 12,
                  borderRadius: 10,
                  backgroundColor: isDarkMode ? '#202225' : '#FAFAFA',
                  borderWidth: 1,
                  borderColor: theme.borderSubtle,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <BootstrapIcon name="clock-history" size={16} color="#F59E0B" />
                  <Text style={{ fontSize: 13, fontWeight: '500', color: theme.textPrimary }}>Pending Review</Text>
                </View>
                <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textPrimary, fontVariant: ['tabular-nums'] }}>
                  {bookingStats.pending || 0}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 10 }}>
            {bookingStats.total || 0} total bookings recorded in database
          </Text>
        </View>
      </View>

      {/* ─── ROW 5: REVENUE BY CHANNEL & TOP SELLERS ─── */}
      <View
        style={{
          flexDirection: isDesktop ? 'row' : 'column',
          gap: 18,
          alignItems: 'stretch',
        }}
      >
        {/* CARD 1: REVENUE BY CHANNEL */}
        <View
          style={{
            flex: 1,
            backgroundColor: theme.cardBg,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.cardBorder,
            padding: 22,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
            justifyContent: 'space-between',
          }}
        >
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: theme.textPrimary, letterSpacing: -0.2 }}>
                  Revenue by channel
                </Text>
                <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                  Multi-channel distribution
                </Text>
              </View>
              <TouchableOpacity onPress={() => setActiveNav('analytics')} style={{ cursor: 'pointer' }}>
                <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#EA580C' }}>Reports</Text>
              </TouchableOpacity>
            </View>

            {/* Channels List with Progress Bars */}
            <View style={{ gap: 14 }}>
              {channelBreakdown.map((ch) => (
                <View key={ch.key}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={{ fontSize: 12.5, color: theme.textSecondary }}>{ch.label}</Text>
                    <Text style={{ fontSize: 12.5, fontWeight: '600', color: theme.textPrimary, fontVariant: ['tabular-nums'] }}>
                      {formatCompactPhp(ch.value)}
                    </Text>
                  </View>
                  <View
                    style={{
                      height: 5,
                      borderRadius: 2.5,
                      backgroundColor: isDarkMode ? '#27272A' : '#F4F4F5',
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        height: '100%',
                        width: `${ch.pct}%`,
                        backgroundColor: '#EA580C',
                        borderRadius: 2.5,
                      }}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
          <View style={{ height: 1 }} />
        </View>

        {/* CARD 2: TOP SELLERS */}
        <View
          style={{
            flex: 1,
            backgroundColor: theme.cardBg,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.cardBorder,
            padding: 22,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
            justifyContent: 'space-between',
          }}
        >
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: theme.textPrimary, letterSpacing: -0.2 }}>
                  Top sellers
                </Text>
                <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                  Units sold across catalog
                </Text>
              </View>
              <TouchableOpacity onPress={() => setActiveNav('products')} style={{ cursor: 'pointer' }}>
                <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#EA580C' }}>Catalogue</Text>
              </TouchableOpacity>
            </View>

            {/* Numbered Ranked List */}
            <View style={{ gap: 10 }}>
              {topSellersList.length === 0 ? (
                <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>
                  No catalog units sold yet
                </Text>
              ) : null}
              {topSellersList.map((tp) => (
                <View key={`${tp.rank}-${tp.name}`}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, paddingRight: 8 }}>
                      <Text style={{ fontSize: 11.5, color: theme.textMuted, width: 14, fontVariant: ['tabular-nums'] }}>
                        {tp.rank}
                      </Text>
                      <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '500', color: theme.textPrimary, flex: 1 }}>
                        {tp.name}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textPrimary, fontVariant: ['tabular-nums'] }}>
                      {tp.unitsSold.toLocaleString()}
                    </Text>
                  </View>
                  <View
                    style={{
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: isDarkMode ? '#27272A' : '#F4F4F5',
                      overflow: 'hidden',
                      marginLeft: 22,
                    }}
                  >
                    <View
                      style={{
                        height: '100%',
                        width: `${tp.pct}%`,
                        backgroundColor: '#EA580C',
                        borderRadius: 2,
                      }}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
          <View style={{ height: 1 }} />
        </View>
      </View>

      {/* ─── ROW 6: RECENT ORDERS & POS SALES TABLE ─── */}
      <View
        style={{
          backgroundColor: theme.cardBg,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: theme.cardBorder,
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
        }}
      >
        {/* Table Header with Filter Pills */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingVertical: 16,
            backgroundColor: theme.cardBg,
            borderBottomWidth: 1,
            borderBottomColor: theme.cardBorder,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <View>
            <Text style={{ fontSize: 16, fontWeight: '700', color: theme.textPrimary, letterSpacing: -0.2 }}>
              Recent Orders & POS Sales
            </Text>
            <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
              Transactions across online store and cashier POS, newest first
            </Text>
          </View>

          {/* Filter Pills */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: theme.pillBg,
                borderRadius: 8,
                padding: 3,
                gap: 2,
                borderWidth: 1,
                borderColor: theme.borderSubtle,
              }}
            >
              {[
                { key: 'all', label: 'All' },
                { key: 'online', label: 'Online Store' },
                { key: 'pos', label: 'POS In-Store' },
                { key: 'pending', label: 'Pending' },
              ].map((f) => {
                const isActive = tableFilter === f.key;
                return (
                  <TouchableOpacity
                    key={f.key}
                    onPress={() => setTableFilter(f.key)}
                    activeOpacity={0.8}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 5,
                      borderRadius: 6,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isActive ? theme.pillActiveBg : 'transparent',
                      boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.06)' : undefined,
                      cursor: 'pointer',
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 12,
                        fontWeight: isActive ? '600' : '500',
                        color: isActive ? theme.pillActiveText : theme.pillInactiveText,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              onPress={() => setActiveNav('orders')}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                cursor: 'pointer',
              }}
            >
              <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#EA580C' }}>
                View All ({orders.length}) →
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Organized Table Rows */}
        {filteredOrders.length === 0 ? (
          <View style={{ paddingVertical: 48, alignItems: 'center', justifyContent: 'center' }}>
            <BootstrapIcon name="receipt" size={32} color={theme.textMuted} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textPrimary, marginTop: 10 }}>
              No Transactions Found
            </Text>
            <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>
              No orders matched the selected filter.
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ width: '100%' }}
            contentContainerStyle={{ minWidth: isDesktop ? '100%' : 750 }}
          >
            <View style={{ width: '100%' }}>
              {/* Clean Table Column Headers */}
              <View
                style={{
                  flexDirection: 'row',
                  paddingHorizontal: 20,
                  paddingVertical: 11,
                  backgroundColor: isDarkMode ? '#202225' : '#F8F9FA',
                  borderBottomWidth: 1,
                  borderBottomColor: theme.cardBorder,
                }}
              >
                <Text style={{ flex: 1.8, fontSize: 11, fontWeight: '600', color: theme.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  Customer & Order
                </Text>
                <Text style={{ flex: 2.2, fontSize: 11, fontWeight: '600', color: theme.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  Items & Qty
                </Text>
                <Text style={{ flex: 1.2, fontSize: 11, fontWeight: '600', color: theme.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  Channel
                </Text>
                <Text style={{ flex: 1.3, fontSize: 11, fontWeight: '600', color: theme.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  Payment & Total
                </Text>
                <Text style={{ flex: 1.3, fontSize: 11, fontWeight: '600', color: theme.textMuted, textAlign: 'center', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  Status
                </Text>
              </View>

              {/* Scrollable Table Body */}
              <ScrollView
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                nestedScrollEnabled={true}
                dataSet={{ tableScroll: 'true' }}
                style={{
                  maxHeight: 520,
                  width: '100%',
                  ...(Platform.OS === 'web' ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : {}),
                }}
                contentContainerStyle={{ flexGrow: 1 }}
              >
                {filteredOrders.map((o, idx) => {
                  const displayOrderId = o.order_id || o.id || `ORD-ON-2026-${String(idx + 1).padStart(5, '0')}`;
                  const rawChannel = String(o.channel || '').toLowerCase();
                  const isInStore =
                    rawChannel.includes('pos') ||
                    rawChannel.includes('in-store') ||
                    rawChannel.includes('walk-in') ||
                    (rawChannel.includes('store') && !rawChannel.includes('online'));
                  const displayChannel = isInStore ? 'In Store' : 'Online Store';
                  const st = (o.status || 'Pending Approval').toLowerCase();
                  const isPending = st.includes('pending') || st.includes('approval');
                  const isProcessing = st === 'processing';
                  const isReady = st === 'ready for delivery';
                  const isShipped = st === 'shipped' || st === 'in transit' || st === 'out for delivery';
                  const isDelivered = st === 'delivered' || st === 'completed';
                  const isCancelled = st === 'cancelled' || st === 'canceled';
                  const isFailed = st === 'delivery failed' || st === 'delivery issue' || st === 'failed';
                  const isCOD =
                    (o.payment_method || '').toLowerCase().includes('cash') ||
                    (o.payment_method || '').includes('COD');

                  const statusLabel = isPending
                    ? 'Pending'
                    : isProcessing
                    ? 'Processing'
                    : isReady
                    ? 'Ready'
                    : isShipped
                    ? 'Out for Delivery'
                    : isDelivered
                    ? 'Delivered'
                    : isCancelled
                    ? 'Cancelled'
                    : isFailed
                    ? 'Delivery failed'
                    : 'Processing';

                  let statusBg = isDarkMode ? '#27272A' : '#F4F4F5';
                  let statusFg = isDarkMode ? '#A1A1AA' : '#52525B';
                  if (isPending) {
                    statusBg = isDarkMode ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7';
                    statusFg = isDarkMode ? '#FBBF24' : '#B45309';
                  } else if (isProcessing || isReady) {
                    statusBg = isDarkMode ? 'rgba(56, 189, 248, 0.15)' : '#EFF6FF';
                    statusFg = isDarkMode ? '#38BDF8' : '#1D4ED8';
                  } else if (isShipped) {
                    statusBg = isDarkMode ? 'rgba(167, 139, 250, 0.15)' : '#F3E8FF';
                    statusFg = isDarkMode ? '#C084FC' : '#7E22CE';
                  } else if (isDelivered) {
                    statusBg = isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5';
                    statusFg = isDarkMode ? '#34D399' : '#059669';
                  } else if (isFailed || isCancelled) {
                    statusBg = isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2';
                    statusFg = isDarkMode ? '#F87171' : '#B91C1C';
                  }

                  const itemsSummary =
                    o.items_summary ||
                    (o.items && o.items.length > 0
                      ? o.items.map((it) => `${it.quantity || 1}x ${it.name}`).join(', ')
                      : 'Motorcycle Parts');
                  const itemCount = o.items_count || (o.items ? o.items.length : 1);
                  const orderTotal = Number(o.grand_total) || Number(o.total_amount) || 0;

                  return (
                    <TouchableOpacity
                      key={displayOrderId || idx}
                      onPress={() => openOrderModal(o)}
                      activeOpacity={0.7}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 20,
                        paddingVertical: 13,
                        borderBottomWidth: idx === filteredOrders.length - 1 ? 0 : 1,
                        borderBottomColor: theme.borderSubtle,
                        cursor: 'pointer',
                        backgroundColor: isPending
                          ? isDarkMode
                            ? 'rgba(245, 158, 11, 0.04)'
                            : '#FFFDF7'
                          : 'transparent',
                      }}
                    >
                      {/* Customer & Order */}
                      <View style={{ flex: 1.8, paddingRight: 10 }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textPrimary }} numberOfLines={1}>
                          {o.customer_name || 'Walk-in Customer'}
                        </Text>
                        <Text
                          style={{
                            fontSize: 11.5,
                            color: theme.textMuted,
                            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                            marginTop: 2,
                          }}
                          numberOfLines={1}
                        >
                          {displayOrderId}
                        </Text>
                      </View>

                      {/* Items & Qty */}
                      <View style={{ flex: 2.2, paddingRight: 10 }}>
                        <Text style={{ fontSize: 12.5, fontWeight: '500', color: theme.textPrimary }} numberOfLines={1}>
                          {itemsSummary}
                        </Text>
                        <Text style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 2 }}>
                          {itemCount} item{itemCount === 1 ? '' : 's'}
                        </Text>
                      </View>

                      {/* Channel */}
                      <View style={{ flex: 1.2, paddingRight: 8 }}>
                        <View
                          style={{
                            alignSelf: 'flex-start',
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 6,
                            borderWidth: 1,
                            backgroundColor: isInStore
                              ? isDarkMode
                                ? 'rgba(16, 185, 129, 0.12)'
                                : '#ECFDF5'
                              : isDarkMode
                              ? 'rgba(37, 99, 235, 0.12)'
                              : '#EFF6FF',
                            borderColor: isInStore
                              ? isDarkMode
                                ? 'rgba(16, 185, 129, 0.25)'
                                : '#A7F3D0'
                              : isDarkMode
                              ? 'rgba(37, 99, 235, 0.25)'
                              : '#BFDBFE',
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: '600',
                              color: isInStore
                                ? isDarkMode
                                  ? '#34D399'
                                  : '#059669'
                                : isDarkMode
                                ? '#60A5FA'
                                : '#2563EB',
                            }}
                          >
                            {displayChannel}
                          </Text>
                        </View>
                      </View>

                      {/* Payment & Total */}
                      <View style={{ flex: 1.3, paddingRight: 10 }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textPrimary, fontVariant: ['tabular-nums'] }}>
                          ₱{orderTotal.toLocaleString()}
                        </Text>
                        <Text style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 1 }}>
                          {isCOD ? 'COD' : o.payment_method || 'Online'}
                          {o.cod_change_for ? ` · Chg ₱${Number(o.cod_change_for).toLocaleString()}` : ''}
                        </Text>
                      </View>

                      {/* Status */}
                      <View style={{ flex: 1.3, alignItems: 'center' }}>
                        <View
                          style={{
                            backgroundColor: statusBg,
                            borderRadius: 999,
                            paddingHorizontal: 10,
                            paddingVertical: 3.5,
                          }}
                        >
                          <Text
                            style={{
                              color: statusFg,
                              fontSize: 11,
                              fontWeight: '600',
                            }}
                          >
                            {statusLabel}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </ScrollView>
        )}
      </View>
    </View>
  );
}

/**
 * ModernOverviewDashboardSkeleton
 * Full-fidelity shimmer skeleton placeholder for the Modern Overview Dashboard.
 * Matches exact geometry of the 4 KPI cards and chart row.
 */
export function ModernOverviewDashboardSkeleton({ isDarkMode = false, isDesktop = true }) {
  const { width: windowWidth } = useWindowDimensions();
  const baseColor = isDarkMode ? '#27272A' : '#E4E4E7';
  const highlightColor = isDarkMode ? '#3F3F46' : '#F4F4F5';
  const cardBg = isDarkMode ? '#18181B' : '#FFFFFF';
  const cardBorder = isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E4E4E7';

  return (
    <View style={{ width: '100%', gap: 20 }} role="status" aria-label="Loading dashboard metrics">
      {/* 1. Top 4 KPI Cards Skeleton */}
      <View
        style={{
          display: 'grid',
          gridTemplateColumns: isDesktop
            ? 'repeat(4, 1fr)'
            : windowWidth < 640
            ? '1fr'
            : 'repeat(2, 1fr)',
          gap: 16,
        }}
      >
        {[1, 2, 3, 4].map((k) => (
          <View
            key={k}
            style={{
              backgroundColor: cardBg,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: cardBorder,
              padding: 20,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Skeleton width={60} height={14} baseColor={baseColor} highlightColor={highlightColor} />
              <Skeleton width={45} height={20} borderRadius={10} baseColor={baseColor} highlightColor={highlightColor} />
            </View>
            <Skeleton width={120} height={30} borderRadius={6} baseColor={baseColor} highlightColor={highlightColor} />
            <Skeleton width={90} height={12} baseColor={baseColor} highlightColor={highlightColor} />
            <Skeleton width="100%" height={24} borderRadius={4} baseColor={baseColor} highlightColor={highlightColor} />
          </View>
        ))}
      </View>

      {/* 2. Spline Chart + Pipeline Skeleton */}
      <View
        style={{
          display: 'grid',
          gridTemplateColumns: isDesktop ? 'repeat(4, 1fr)' : '1fr',
          gap: 16,
          alignItems: 'stretch',
        }}
      >
        <View
          style={{
            gridColumn: isDesktop ? 'span 3' : 'span 1',
            minWidth: 0,
            backgroundColor: cardBg,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: cardBorder,
            padding: 22,
            gap: 16,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ gap: 4 }}>
              <Skeleton width={140} height={18} baseColor={baseColor} highlightColor={highlightColor} />
              <Skeleton width={180} height={12} baseColor={baseColor} highlightColor={highlightColor} />
            </View>
            <Skeleton width={160} height={30} borderRadius={8} baseColor={baseColor} highlightColor={highlightColor} />
          </View>
          <Skeleton height={210} borderRadius={8} baseColor={baseColor} highlightColor={highlightColor} />
        </View>

        <View
          style={{
            gridColumn: 'span 1',
            minWidth: 0,
            backgroundColor: cardBg,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: cardBorder,
            padding: 22,
            gap: 14,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Skeleton width={120} height={18} baseColor={baseColor} highlightColor={highlightColor} />
            <Skeleton width={70} height={14} baseColor={baseColor} highlightColor={highlightColor} />
          </View>
          <Skeleton width={80} height={30} baseColor={baseColor} highlightColor={highlightColor} />
          <Skeleton height={8} borderRadius={4} baseColor={baseColor} highlightColor={highlightColor} />
          <View style={{ gap: 10, marginTop: 8 }}>
            {[1, 2, 3, 4].map((s) => (
              <View key={s} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Skeleton width={70} height={14} baseColor={baseColor} highlightColor={highlightColor} />
                <Skeleton width={30} height={14} baseColor={baseColor} highlightColor={highlightColor} />
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

ModernOverviewDashboard.Skeleton = ModernOverviewDashboardSkeleton;
