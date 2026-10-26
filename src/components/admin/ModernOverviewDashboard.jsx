import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  Image,
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
  computeWeeklyProfitSeries,
  sparklinePath,
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

// Helper to format compact currency (e.g. ₱41k, ₱107k)
function formatCompactPhp(amount) {
  const num = Number(amount) || 0;
  if (num >= 1000000) return `₱${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `₱${(num / 1000).toFixed(1)}k`;
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
  suppliers = [],
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
  tokens = {},
}) {
  const { width: windowWidth } = useWindowDimensions();
  // Telemetry Granularity: 'daily' | 'weekly' | 'monthly'
  const [granularity, setGranularity] = useState('daily');
  // Interactive chart hover
  const [hoveredIndex, setHoveredIndex] = useState(null);
  // Table channel filter: 'all' | 'online' | 'pos' | 'pending'
  const [tableFilter, setTableFilter] = useState('all');
  const [tableFilterLayouts, setTableFilterLayouts] = useState({});

  // Brand Green Theme Palette
  const theme = useMemo(() => {
    if (isDarkMode) {
      return {
        bg: '#1E2124',
        cardBg: '#24272B',
        cardBorder: '#374151',
        textPrimary: '#F9FAFB',
        textMuted: '#9CA3AF',
        textSecondary: '#CBD5E1',
        brandGreen: '#EA580C',
        brandDarkGreen: '#24272B',
        pillBg: '#374151',
        pillActiveBg: '#EA580C',
        pillActiveText: '#FFFFFF',
        chartStroke: '#EA580C',
        chartGradStart: '#EA580C',
        chartGradEnd: 'rgba(234, 88, 12, 0.05)',
        avgLineColor: '#9CA3AF',
        sparklineStroke: '#EA580C',
        borderSubtle: '#374151',
        tableRowHover: '#2E3236',
        badgeGreenBg: 'rgba(34, 197, 94, 0.16)',
        badgeGreenText: '#4ADE80',
      };
    }
    return {
      bg: '#F3F4F6',
      cardBg: '#FFFFFF',
      cardBorder: '#E5E7EB',
      textPrimary: '#111827',
      textMuted: '#6B7280',
      textSecondary: '#374151',
      brandGreen: '#EA580C',
      brandDarkGreen: '#24272B',
      pillBg: '#F3F4F6',
      pillActiveBg: '#EA580C',
      pillActiveText: '#FFFFFF',
      chartStroke: '#EA580C',
      chartGradStart: '#EA580C',
      chartGradEnd: 'rgba(234, 88, 12, 0.05)',
      avgLineColor: '#9CA3AF',
      sparklineStroke: '#EA580C',
      borderSubtle: '#E5E7EB',
      tableRowHover: '#F9FAFB',
      badgeGreenBg: '#DCFCE7',
      badgeGreenText: '#166534',
    };
  }, [isDarkMode]);

  // Total sales
  const totalRevenue = Number(analyticsData.totalRevenue) || 0;
  const aov = Number.isFinite(Number(analyticsData.aov)) ? Number(analyticsData.aov) : 0;
  const weeklyKpis = useMemo(() => computeWeeklyKpiSeries(orders, 8), [orders]);
  const weeklyProfit = useMemo(
    () => computeWeeklyProfitSeries(orders, products, 8),
    [orders, products]
  );
  const orderSparkline = sparklinePath(weeklyKpis.map((bucket) => bucket.orders));
  const aovSparkline = sparklinePath(weeklyKpis.map((bucket) => bucket.aov));
  const profitSparkline = sparklinePath(weeklyProfit.map((bucket) => bucket.profit));

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

  // Process chart telemetry matching Wharf style with Green Gradient
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

    const padding = { top: 20, right: 0, bottom: 26, left: 34 };
    const chartW = 560;
    const chartH = 180;
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

  // Order Pipeline stage breakdown from canonical order statuses.
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

  // Revenue by channel from paid orders and collected/closed service bookings.
  const channelBreakdown = useMemo(() => {
    const byChannel = dashboardInsights?.salesByChannel || computeSalesByChannel(orders);
    const garage = (garageBookings || []).reduce((sum, booking) => sum + recognizedBookingRevenue(booking), 0);

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

  // Top sellers ranked by units actually sold on non-cancelled orders.
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

  // Same rule as the inventory page: low stock is above zero and at or below reorder level.
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
      {/* ─── 2. TOP SECTION: REVENUE GREEN GRADIENT CHART (LEFT) & 4 KPI CARDS (RIGHT) ─── */}
      <View
        style={{
          flexDirection: isDesktop ? 'row' : 'column',
          gap: 18,
          alignItems: 'stretch',
        }}
      >
        {/* LEFT COLUMN: REVENUE TREND CARD WITH GREEN GRADIENT */}
        <View
          style={{
            flex: isDesktop ? 1.55 : 1,
            backgroundColor: theme.cardBg,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.cardBorder,
            padding: 22,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
            justifyContent: 'space-between',
            alignSelf: 'stretch',
          }}
        >
          {/* Card Header & Telemetry Mode Filter (Daily | Weekly | Monthly) */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            {/* Left Header with Green Icon */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.16)' : 'rgba(234, 88, 12, 0.12)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BootstrapIcon
                  name="graph-up"
                  size={15}
                  color={theme.brandGreen}
                />
              </View>
              <View>
                <Text style={{ fontSize: 15, fontWeight: '700', color: theme.textPrimary }}>
                  Revenue
                </Text>
                <Text style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 1 }}>
                  {granularity === 'daily'
                    ? 'Daily telemetry (last 14 days)'
                    : granularity === 'weekly'
                    ? 'Weekly telemetry (last 8 weeks)'
                    : 'Monthly telemetry (last 6 months)'}
                </Text>
              </View>
            </View>

            {/* Right: Avg Tag + Daily / Weekly / Monthly Pills */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {chartTelemetry.avgRev > 0 && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 6,
                    backgroundColor: isDarkMode ? '#1E2923' : '#EDF2EE',
                  }}
                >
                  <View
                    style={{
                      width: 12,
                      height: 2,
                      borderTopWidth: 2,
                      borderTopColor: theme.avgLineColor,
                      borderStyle: 'dashed',
                    }}
                  />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: theme.brandGreen }}>
                    Avg: {formatCompactPhp(chartTelemetry.avgRev)}/
                    {granularity === 'daily' ? 'day' : granularity === 'weekly' ? 'wk' : 'mo'}
                  </Text>
                </View>
              )}

              {/* Capsule: Daily | Weekly | Monthly */}
              <View
                style={{
                  position: 'relative',
                  flexDirection: 'row',
                  backgroundColor: theme.pillBg,
                  borderRadius: 8,
                  padding: 3,
                  width: 220,
                }}
              >
                {/* Smooth animated active-state sliding indicator */}
                <View
                  style={{
                    position: 'absolute',
                    top: 3,
                    bottom: 3,
                    left: 3,
                    width: 'calc((100% - 6px) / 3)',
                    backgroundColor: theme.pillActiveBg || '#EA580C',
                    borderRadius: 6,
                    boxShadow: '0 1px 4px rgba(234, 88, 12, 0.35)',
                    transition: 'transform 220ms cubic-bezier(0.4, 0, 0.2, 1)',
                    transform:
                      granularity === 'daily'
                        ? 'translateX(0%)'
                        : granularity === 'weekly'
                        ? 'translateX(100%)'
                        : 'translateX(200%)',
                    pointerEvents: 'none',
                    zIndex: 0,
                  }}
                />
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
                      activeOpacity={0.85}
                      style={{
                        flex: 1,
                        paddingVertical: 5,
                        borderRadius: 6,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'transparent',
                        cursor: 'pointer',
                        zIndex: 1,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: isActive ? '700' : '600',
                          color: isActive ? theme.pillActiveText : theme.textMuted,
                          transition: 'color 200ms ease',
                        }}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Big Revenue Stat & Trend */}
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, marginVertical: 6 }}>
            <Text
              style={{
                fontSize: 32,
                fontWeight: '800',
                color: theme.textPrimary,
                letterSpacing: -0.8,
                fontVariant: ['tabular-nums'],
              }}
            >
              {formatPhp(totalRevenue)}
            </Text>
            <Text
              style={{
                fontSize: 12.5,
                fontWeight: '600',
                color: theme.textMuted,
              }}
            >
              Recognized sales
            </Text>
          </View>

          {/* Area Line Chart with GREEN GRADIENT */}
          <View style={{ width: '100%', height: 180, position: 'relative' }}>
            {Platform.OS === 'web' && (
              <svg
                width="100%"
                height="180"
                viewBox={`0 0 ${chartTelemetry.chartW} ${chartTelemetry.chartH}`}
                preserveAspectRatio="none"
                style={{ display: 'block', overflow: 'visible', userSelect: 'none' }}
              >
                <defs>
                  {/* Rich Emerald / Forest Green Gradient */}
                  <linearGradient id="motoGreenGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={theme.chartGradStart} stopOpacity={isDarkMode ? 0.40 : 0.45} />
                    <stop offset="65%" stopColor={theme.chartGradStart} stopOpacity={isDarkMode ? 0.15 : 0.12} />
                    <stop offset="100%" stopColor={theme.chartGradEnd} stopOpacity={0.01} />
                  </linearGradient>
                </defs>

                {/* Y-Axis Gridlines & Left Labels (Aligned flush to left) */}
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
                        stroke={isDarkMode ? 'rgba(255,255,255,0.06)' : '#EBF0ED'}
                        strokeWidth="1"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={0}
                        y={yPos - 5}
                        textAnchor="start"
                        fontSize="10"
                        fontWeight="600"
                        fill={isDarkMode ? '#64748B' : '#8A9E93'}
                      >
                        {formatCompactPhp(val)}
                      </text>
                    </g>
                  );
                })}

                {/* Dashed Average Line across entire width */}
                {chartTelemetry.avgRev > 0 && (
                  <line
                    x1={chartTelemetry.padding.left}
                    y1={chartTelemetry.avgY}
                    x2={chartTelemetry.chartW}
                    y2={chartTelemetry.avgY}
                    stroke={theme.avgLineColor}
                    strokeWidth="1.2"
                    strokeDasharray="4 4"
                  />
                )}

                {/* Filled Green Gradient Area (Starts at x=0, ends at x=chartW) */}
                <path d={chartTelemetry.areaPath} fill="url(#motoGreenGrad)" />

                {/* Main Dark Green Stroke Line */}
                <path
                  d={chartTelemetry.linePath}
                  fill="none"
                  stroke={theme.chartStroke}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* X-Axis Dates (Flush left at start, flush right at end) */}
                {chartTelemetry.points.map((pt, idx) => {
                  const isFirst = idx === 0;
                  const isLast = idx === chartTelemetry.points.length - 1;
                  const anchor = isFirst ? 'start' : isLast ? 'end' : 'middle';

                  let displayLabel = pt.label;
                  let isMilestone = isFirst;

                  if (granularity === 'daily') {
                    const d = pt.date instanceof Date ? pt.date : (pt.key ? new Date(pt.key) : null);
                    const prevPt = idx > 0 ? chartTelemetry.points[idx - 1] : null;
                    const prevDate = prevPt ? (prevPt.date instanceof Date ? prevPt.date : (prevPt.key ? new Date(prevPt.key) : null)) : null;
                    const dayNum = d ? d.getDate() : (pt.label ? pt.label.split(' ')[1] : idx + 1);
                    const isMonthChange = prevDate && d && prevDate.getMonth() !== d.getMonth();
                    const isMonthStart = dayNum === 1 || isMonthChange;
                    isMilestone = isFirst || isMonthStart;
                    displayLabel = isMilestone ? pt.label : String(dayNum);
                  }

                  return (
                    <text
                      key={`lbl-${idx}`}
                      x={pt.x}
                      y={chartTelemetry.baseline + 16}
                      textAnchor={anchor}
                      fontSize={isMilestone ? '9.5' : '9'}
                      fontWeight={isMilestone ? '700' : '500'}
                      fill={
                        isMilestone
                          ? (isDarkMode ? '#CBD5E1' : '#2C3E35')
                          : (isDarkMode ? '#64748B' : '#7D9287')
                      }
                    >
                      {displayLabel}
                    </text>
                  );
                })}

                {/* Interactive Points on Line */}
                {chartTelemetry.points.map((pt, idx) => {
                  const isLast = idx === chartTelemetry.points.length - 1;
                  const isHovered = hoveredIndex === idx;
                  return (
                    <g key={`hit-${idx}`}>
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={14}
                        fill="transparent"
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={() => setHoveredIndex(idx)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      />
                      {(isLast || isHovered) && (
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isHovered ? 5 : 3.5}
                          fill={theme.chartStroke}
                          stroke={isHovered ? '#FFFFFF' : theme.cardBg}
                          strokeWidth={2}
                          style={{ pointerEvents: 'none' }}
                        />
                      )}
                    </g>
                  );
                })}

                {/* Active Hover Tooltip Marker (Wharf Style) */}
                {activeHoverPoint && (
                  <g pointerEvents="none">
                    <line
                      x1={activeHoverPoint.x}
                      y1={chartTelemetry.padding.top}
                      x2={activeHoverPoint.x}
                      y2={chartTelemetry.baseline}
                      stroke={theme.chartStroke}
                      strokeWidth="1.2"
                      strokeDasharray="2 2"
                    />
                    <circle
                      cx={activeHoverPoint.x}
                      cy={activeHoverPoint.y}
                      r={5}
                      fill={theme.chartStroke}
                      stroke="#FFFFFF"
                      strokeWidth={2}
                    />
                    {(() => {
                      const ttW = 84;
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
                            rx="7"
                            fill={isDarkMode ? '#1E2124' : '#24272B'}
                          />
                          <text
                            x={ttX + ttW / 2}
                            y={ttY + 16}
                            textAnchor="middle"
                            fontSize="11"
                            fontWeight="800"
                            fill="#FFFFFF"
                          >
                            {formatPhp(activeHoverPoint.revenue)}
                          </text>
                          <text
                            x={ttX + ttW / 2}
                            y={ttY + 30}
                            textAnchor="middle"
                            fontSize="9.5"
                            fontWeight="500"
                            fill={isDarkMode ? '#94A3B8' : '#D1FAE5'}
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

          {/* Bottom 4 Metric Summary Stats */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTopWidth: 1,
              borderTopColor: theme.cardBorder,
              paddingTop: 12,
              marginTop: 4,
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            {/* 1. Period Total */}
            <View>
              <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textMuted, letterSpacing: 0.5 }}>
                PERIOD TOTAL
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: theme.textPrimary, marginTop: 2 }}>
                {formatPhp(chartTelemetry.totalRev)}
              </Text>
            </View>

            {/* 2. Period Average */}
            <View>
              <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textMuted, letterSpacing: 0.5 }}>
                PERIOD AVERAGE
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: theme.textPrimary, marginTop: 2 }}>
                {formatPhp(chartTelemetry.avgRev)}
                <Text style={{ fontSize: 11, fontWeight: '600', color: theme.textMuted }}>
                  /{granularity === 'daily' ? 'day' : granularity === 'weekly' ? 'wk' : 'mo'}
                </Text>
              </Text>
            </View>

            {/* 3. Peak Period */}
            <View>
              <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textMuted, letterSpacing: 0.5 }}>
                PEAK PERIOD
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: theme.textPrimary, marginTop: 2 }}>
                {formatPhp(chartTelemetry.peakRev)}
                <Text style={{ fontSize: 11, fontWeight: '600', color: theme.textMuted }}>
                  {' '}({chartTelemetry.peakLabel})
                </Text>
              </Text>
            </View>

            {/* 4. Orders in Period */}
            <View>
              <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textMuted, letterSpacing: 0.5 }}>
                ORDERS IN PERIOD
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: theme.textPrimary, marginTop: 2 }}>
                {chartTelemetry.totalOrders.toLocaleString()} {chartTelemetry.totalOrders === 1 ? 'order' : 'orders'}
              </Text>
            </View>
          </View>
        </View>

        {/* RIGHT COLUMN: 4 EXECUTIVE KPI CARDS (RESPONSIVE GRID) */}
        <View
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: windowWidth < 420 ? '1fr' : 'repeat(2, 1fr)',
            gridTemplateRows: isDesktop && windowWidth >= 420 ? 'repeat(2, 1fr)' : undefined,
            gap: 14,
            height: isDesktop ? '100%' : 'auto',
            alignSelf: 'stretch',
          }}
        >
          {/* Card 1: Orders (Original Info) */}
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
              padding: 16,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
              cursor: 'pointer',
              justifyContent: 'space-between',
              height: '100%',
              boxSizing: 'border-box',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    backgroundColor: theme.badgeGreenBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BootstrapIcon name="bag-check" size={13} color={theme.brandGreen} />
                </View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary }}>Orders</Text>
              </View>
              <BootstrapIcon name="chevron-right" size={11} color={theme.textMuted} />
            </View>

            <View style={{ marginVertical: 10 }}>
              <Text style={{ fontSize: 28, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.5, fontVariant: ['tabular-nums'] }}>
                {orderStats.total ? orderStats.total.toLocaleString() : orders.length.toLocaleString()}
              </Text>
              <Text style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 2 }}>
                {orderStats.delivered || 0} delivered
              </Text>
            </View>

            {/* Green Sparkline */}
            <View style={{ width: '100%', height: 20 }}>
              {Platform.OS === 'web' && (
                <svg width="100%" height="20" viewBox="0 0 100 20">
                  {orderSparkline ? (
                    <path
                      d={orderSparkline}
                      fill="none"
                      stroke={theme.sparklineStroke}
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  ) : null}
                </svg>
              )}
            </View>
          </TouchableOpacity>

          {/* Card 2: Net Profit & Margins (Original Info) */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setActiveNav('analytics')}
            style={{
              backgroundColor: theme.cardBg,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: theme.cardBorder,
              padding: 16,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
              cursor: 'pointer',
              justifyContent: 'space-between',
              height: '100%',
              boxSizing: 'border-box',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    backgroundColor: theme.badgeGreenBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BootstrapIcon name="graph-up-arrow" size={13} color={theme.brandGreen} />
                </View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary }}>Net Profit</Text>
              </View>
              <BootstrapIcon name="chevron-right" size={11} color={theme.textMuted} />
            </View>

            <View style={{ marginVertical: 10 }}>
              <Text style={{ fontSize: 28, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.5, fontVariant: ['tabular-nums'] }}>
                ₱{(profitOverview.soldProfit || 0).toLocaleString()}
              </Text>
              <Text style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 2 }}>
                <Text style={{ color: '#16A34A', fontWeight: '700' }}>{(profitOverview.soldMargin || 0).toFixed(1)}%</Text> margin
              </Text>
            </View>

            <View style={{ width: '100%', height: 20 }}>
              {Platform.OS === 'web' && (
                <svg width="100%" height="20" viewBox="0 0 100 20">
                  {profitSparkline ? (
                    <path
                      d={profitSparkline}
                      fill="none"
                      stroke={theme.sparklineStroke}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ) : null}
                </svg>
              )}
            </View>
          </TouchableOpacity>

          {/* Card 3: Running Low & Inventory (Original Info) */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              if ((invStats.lowStockCount || 0) > 0) setInvStockFilter('lowStock');
              else if ((invStats.outOfStockCount || 0) > 0) setInvStockFilter('outOfStock');
              else setInvStockFilter('All');
              setActiveNav('inventory');
            }}
            style={{
              backgroundColor: theme.cardBg,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: theme.cardBorder,
              padding: 16,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
              cursor: 'pointer',
              justifyContent: 'space-between',
              height: '100%',
              boxSizing: 'border-box',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    backgroundColor: isDarkMode ? '#331B1B' : '#FEE2E2',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BootstrapIcon name="boxes" size={13} color="#DC2626" />
                </View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary }}>Running low</Text>
              </View>
              <BootstrapIcon name="chevron-right" size={11} color={theme.textMuted} />
            </View>

            <View style={{ marginVertical: 10 }}>
              <Text style={{ fontSize: 28, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.5, fontVariant: ['tabular-nums'] }}>
                {(invStats.lowStockCount || 0) + (invStats.outOfStockCount || 0)}
              </Text>
              <Text style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 1 }}>
                {invStats.outOfStockCount || 0} out of stock, {invStats.lowStockCount || 0} below par
              </Text>
            </View>

            {/* Mini preview list of items */}
            <View style={{ gap: 4 }}>
              {runningLowItems.length > 0 ? (
                runningLowItems.map((item, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text numberOfLines={1} style={{ fontSize: 11, color: theme.textSecondary, flex: 1, marginRight: 6 }}>
                      {item.name}
                    </Text>
                    <Text
                      style={{
                        fontSize: 10.5,
                        fontWeight: '700',
                        color: item.isOut ? '#DC2626' : '#D97706',
                      }}
                    >
                      {item.isOut ? 'Out' : `${item.qty} left`}
                    </Text>
                  </View>
                ))
              ) : (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 11, color: theme.textSecondary }}>Stock levels optimal</Text>
                  <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#10B981' }}>Good</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          {/* Card 4: Average order (Original Info) */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setActiveNav('analytics')}
            style={{
              backgroundColor: theme.cardBg,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: theme.cardBorder,
              padding: 16,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
              cursor: 'pointer',
              justifyContent: 'space-between',
              height: '100%',
              boxSizing: 'border-box',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    backgroundColor: theme.badgeGreenBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BootstrapIcon name="wallet2" size={13} color={theme.brandGreen} />
                </View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary }}>Average order</Text>
              </View>
              <BootstrapIcon name="chevron-right" size={11} color={theme.textMuted} />
            </View>

            <View style={{ marginVertical: 10 }}>
              <Text style={{ fontSize: 28, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.5, fontVariant: ['tabular-nums'] }}>
                {formatPhp(aov)}
              </Text>
              <Text style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 2 }}>
                Recognized sales average
              </Text>
            </View>

            {/* Green Sparkline */}
            <View style={{ width: '100%', height: 20 }}>
              {Platform.OS === 'web' && (
                <svg width="100%" height="20" viewBox="0 0 100 20">
                  {aovSparkline ? (
                    <path
                      d={aovSparkline}
                      fill="none"
                      stroke={theme.sparklineStroke}
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  ) : null}
                </svg>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── 3. SALES PERFORMANCE ROW (EXECUTIVE BENCHMARKS) ─── */}
      <View
        style={{
          backgroundColor: theme.cardBg,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: theme.cardBorder,
          padding: 20,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <View>
            <Text style={{ fontSize: 16, fontWeight: '800', color: theme.textPrimary }}>
              Sales Performance
            </Text>
            <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
              Executive revenue telemetry and order benchmarks across operational periods
            </Text>
          </View>
          <TouchableOpacity onPress={() => setActiveNav('analytics')} style={{ cursor: 'pointer' }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: theme.brandGreen }}>
              View Analytics →
            </Text>
          </TouchableOpacity>
        </View>

        {/* 4 Sales Performance KPI Cards */}
        <View
          style={{
            display: 'grid',
            gridTemplateColumns: isDesktop ? 'repeat(4, 1fr)' : windowWidth < 420 ? '1fr' : 'repeat(2, 1fr)',
            gap: 14,
          }}
        >
          {/* Card 1: Today's Sales */}
          <View
            style={{
              padding: 14,
              borderRadius: 12,
              backgroundColor: isDarkMode ? '#1E2124' : '#F9FAFB',
              borderWidth: 1,
              borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#E5E7EB',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <BootstrapIcon name="calendar2-check" size={13} color={theme.brandGreen} />
              <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textSecondary }}>Today's Sales</Text>
            </View>
            <Text style={{ fontSize: 20, fontWeight: '800', color: theme.textPrimary, fontVariant: ['tabular-nums'] }}>
              {formatPhp(salesPerformance.todaySales || 0)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Text style={{ fontSize: 11, color: theme.textMuted }}>
                {salesPerformance.todayOrderCount || 0} orders
              </Text>
              {salesPerformance.todayCompare?.pct != null && (
                <Text
                  style={{
                    fontSize: 10.5,
                    fontWeight: '700',
                    color: salesPerformance.todayCompare.direction === 'down' ? '#EF4444' : '#16A34A',
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
              padding: 14,
              borderRadius: 12,
              backgroundColor: isDarkMode ? '#1E2124' : '#F9FAFB',
              borderWidth: 1,
              borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#E5E7EB',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <BootstrapIcon name="graph-up-arrow" size={13} color={theme.brandGreen} />
              <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textSecondary }}>This Week</Text>
            </View>
            <Text style={{ fontSize: 20, fontWeight: '800', color: theme.textPrimary, fontVariant: ['tabular-nums'] }}>
              {formatPhp(salesPerformance.weekSales || 0)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Text style={{ fontSize: 11, color: theme.textMuted }}>
                {salesPerformance.weekOrderCount || 0} orders
              </Text>
              {salesPerformance.weekCompare?.pct != null && (
                <Text
                  style={{
                    fontSize: 10.5,
                    fontWeight: '700',
                    color: salesPerformance.weekCompare.direction === 'down' ? '#EF4444' : '#16A34A',
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
              padding: 14,
              borderRadius: 12,
              backgroundColor: isDarkMode ? '#1E2124' : '#F9FAFB',
              borderWidth: 1,
              borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#E5E7EB',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <BootstrapIcon name="cash-stack" size={13} color={theme.brandGreen} />
              <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textSecondary }}>This Month</Text>
            </View>
            <Text style={{ fontSize: 20, fontWeight: '800', color: theme.textPrimary, fontVariant: ['tabular-nums'] }}>
              {formatPhp(salesPerformance.monthSales || 0)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Text style={{ fontSize: 11, color: theme.textMuted }}>
                {salesPerformance.monthOrderCount || 0} orders
              </Text>
              {salesPerformance.monthCompare?.pct != null && (
                <Text
                  style={{
                    fontSize: 10.5,
                    fontWeight: '700',
                    color: salesPerformance.monthCompare.direction === 'down' ? '#EF4444' : '#16A34A',
                  }}
                >
                  {salesPerformance.monthCompare.direction === 'down' ? '↘' : '↗'} {Math.abs(salesPerformance.monthCompare.pct)}%
                </Text>
              )}
            </View>
          </View>

          {/* Card 4: Action Required (Pending COD & Bookings) */}
          <View
            style={{
              padding: 14,
              borderRadius: 12,
              backgroundColor: isDarkMode ? '#1E2124' : '#F9FAFB',
              borderWidth: 1,
              borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#E5E7EB',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <BootstrapIcon name="clock-history" size={13} color="#D97706" />
              <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textSecondary }}>Action Required</Text>
            </View>
            <Text style={{ fontSize: 20, fontWeight: '800', color: theme.textPrimary, fontVariant: ['tabular-nums'] }}>
              {(orderStats.pendingCod || 0) + (bookingStats.pending || 0)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Text style={{ fontSize: 11, color: theme.textMuted }}>
                {orderStats.pendingCod || 0} COD · {bookingStats.pending || 0} Bookings
              </Text>
              {(orderStats.pendingCod > 0 || bookingStats.pending > 0) && (
                <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#D97706' }}>
                  Attention
                </Text>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* ─── 4. MIDDLE SECTION: 3 CARDS ROW (PIPELINE, CHANNELS, TOP SELLERS) ─── */}
      <View
        style={{
          flexDirection: isDesktop ? 'row' : 'column',
          gap: 18,
          alignItems: 'stretch',
        }}
      >
        {/* CARD 1: ORDER PIPELINE */}
        <View
          style={{
            flex: 1,
            backgroundColor: theme.cardBg,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.cardBorder,
            padding: 20,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
            justifyContent: 'space-between',
          }}
        >
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Text style={{ fontSize: 15, fontWeight: '700', color: theme.textPrimary }}>Order pipeline</Text>
                <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>Open orders by stage</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveNav('orders')} style={{ cursor: 'pointer' }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: theme.brandGreen }}>All orders</Text>
              </TouchableOpacity>
            </View>

            {/* Multi-segment stacked horizontal bar */}
            <View
              style={{
                height: 10,
                borderRadius: 5,
                backgroundColor: isDarkMode ? '#1F2225' : '#E5E7EB',
                flexDirection: 'row',
                overflow: 'hidden',
                marginVertical: 18,
                gap: 2,
              }}
            >
              {[
                { key: 'new', pct: orderPipeline.pctNew, color: '#F59E0B' },
                { key: 'packing', pct: orderPipeline.pctPacking, color: isDarkMode ? '#9CA3AF' : '#24272B' },
                { key: 'shipped', pct: orderPipeline.pctShipped, color: '#3B82F6' },
                { key: 'delivered', pct: orderPipeline.pctDelivered, color: '#EA580C' },
              ]
                .filter((segment) => segment.pct > 0)
                .map((segment) => (
                  <View
                    key={segment.key}
                    style={{ height: '100%', width: `${segment.pct}%`, backgroundColor: segment.color }}
                  />
                ))}
            </View>

            {/* 2x2 Grid of Statuses */}
            <View style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#F59E0B' }} />
                  <Text style={{ fontSize: 12, color: theme.textSecondary }}>New</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textPrimary, fontVariant: ['tabular-nums'] }}>
                  {orderPipeline.newCount}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: isDarkMode ? '#9CA3AF' : '#24272B' }} />
                  <Text style={{ fontSize: 12, color: theme.textSecondary }}>Packing</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textPrimary, fontVariant: ['tabular-nums'] }}>
                  {orderPipeline.packingCount}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#3B82F6' }} />
                  <Text style={{ fontSize: 12, color: theme.textSecondary }}>Shipped</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textPrimary, fontVariant: ['tabular-nums'] }}>
                  {orderPipeline.shippedCount}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#EA580C' }} />
                  <Text style={{ fontSize: 12, color: theme.textSecondary }}>Delivered</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textPrimary, fontVariant: ['tabular-nums'] }}>
                  {orderPipeline.deliveredCount}
                </Text>
              </View>
            </View>
          </View>

          <Text style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 18 }}>
            {orderPipeline.total === 0
              ? 'No orders in the pipeline'
              : orderPipeline.newCount > 0
                ? `${orderPipeline.newCount} pending confirmation`
                : 'All pipeline orders up to date'}
          </Text>
        </View>

        {/* CARD 2: REVENUE BY CHANNEL */}
        <View
          style={{
            flex: 1,
            backgroundColor: theme.cardBg,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.cardBorder,
            padding: 20,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
            justifyContent: 'space-between',
          }}
        >
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <View>
                <Text style={{ fontSize: 15, fontWeight: '700', color: theme.textPrimary }}>Revenue by channel</Text>
                <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>Multi-channel distribution</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveNav('analytics')} style={{ cursor: 'pointer' }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: theme.brandGreen }}>Reports</Text>
              </TouchableOpacity>
            </View>

            {/* Channels List with Racing Orange Progress Bars */}
            <View style={{ gap: 14 }}>
              {channelBreakdown.map((ch) => (
                <View key={ch.key}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={{ fontSize: 12.5, color: theme.textSecondary }}>{ch.label}</Text>
                    <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.textPrimary, fontVariant: ['tabular-nums'] }}>
                      {formatCompactPhp(ch.value)}
                    </Text>
                  </View>
                  <View
                    style={{
                      height: 5,
                      borderRadius: 2.5,
                      backgroundColor: isDarkMode ? '#1F2225' : '#E5E7EB',
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

        {/* CARD 3: TOP SELLERS */}
        <View
          style={{
            flex: 1,
            backgroundColor: theme.cardBg,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.cardBorder,
            padding: 20,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
            justifyContent: 'space-between',
          }}
        >
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <View>
                <Text style={{ fontSize: 15, fontWeight: '700', color: theme.textPrimary }}>Top sellers</Text>
                <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>Units sold across catalog</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveNav('products')} style={{ cursor: 'pointer' }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: theme.brandGreen }}>Catalogue</Text>
              </TouchableOpacity>
            </View>

            {/* Numbered Ranked List with Racing Orange Progress Bars */}
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
                      <Text style={{ fontSize: 11.5, color: theme.textMuted, width: 14, fontVariant: ['tabular-nums'] }}>{tp.rank}</Text>
                      <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '600', color: theme.textPrimary, flex: 1 }}>
                        {tp.name}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: theme.textPrimary, fontVariant: ['tabular-nums'] }}>
                      {tp.unitsSold.toLocaleString()}
                    </Text>
                  </View>
                  <View
                    style={{
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: isDarkMode ? '#1F2225' : '#E5E7EB',
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

      {/* ─── 5. WORKSHOP & SERVICE BOOKINGS PIE CHART ROW ─── */}
      <View
        style={{
          flexDirection: isDesktop ? 'row' : 'column',
          gap: 18,
          alignItems: 'stretch',
        }}
      >
        {/* SERVICE BOOKINGS PIE CHART */}
        <View style={{ flex: isDesktop ? 1.4 : 1 }}>
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
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
            }}
          />
        </View>

        {/* WORKSHOP STATUS & SERVICE HIGHLIGHTS */}
        <View
          style={{
            flex: 1,
            backgroundColor: theme.cardBg,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.cardBorder,
            padding: 20,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
            justifyContent: 'space-between',
          }}
        >
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <View>
                <Text style={{ fontSize: 15, fontWeight: '700', color: theme.textPrimary }}>
                  Workshop Appointments
                </Text>
                <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                  Live pit crew & service status
                </Text>
              </View>
              <TouchableOpacity onPress={() => setActiveNav('garage')} style={{ cursor: 'pointer' }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: theme.brandGreen }}>
                  Manage →
                </Text>
              </TouchableOpacity>
            </View>

            {/* Quick Service Stats */}
            <View style={{ gap: 12, marginVertical: 6 }}>
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
                  backgroundColor: isDarkMode ? '#1E2124' : '#F9FAFB',
                  borderWidth: 1,
                  borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#E5E7EB',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <BootstrapIcon name="calendar-check" size={16} color="#10B981" />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textPrimary }}>Completed Services</Text>
                </View>
                <Text style={{ fontSize: 15, fontWeight: '800', color: theme.textPrimary }}>
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
                  backgroundColor: isDarkMode ? '#1E2124' : '#F9FAFB',
                  borderWidth: 1,
                  borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#E5E7EB',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <BootstrapIcon name="tools" size={16} color="#3B82F6" />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textPrimary }}>Currently In Service</Text>
                </View>
                <Text style={{ fontSize: 15, fontWeight: '800', color: theme.textPrimary }}>
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
                  backgroundColor: isDarkMode ? '#1E2124' : '#F9FAFB',
                  borderWidth: 1,
                  borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#E5E7EB',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <BootstrapIcon name="clock-history" size={16} color="#D97706" />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textPrimary }}>Pending Review</Text>
                </View>
                <Text style={{ fontSize: 15, fontWeight: '800', color: theme.textPrimary }}>
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

      {/* ─── 6. BOTTOM SECTION: RECENT ORDERS & POS SALES TABLE (ORGANIZED LIKE IMAGE) ─── */}
      <View
        style={{
          backgroundColor: theme.cardBg,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: theme.cardBorder,
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
        }}
      >
        {/* Table Section Header with Filter Pills */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingVertical: 16,
            backgroundColor: '#24272B',
            borderBottomWidth: 1,
            borderBottomColor: isDarkMode ? '#374151' : '#32373D',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <View>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.2 }}>
              Recent Orders & POS Sales
            </Text>
            <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
              Transactions across online store and cashier POS, newest first
            </Text>
          </View>

          {/* Filter Pills matching Wharf table toolbar */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <View
              style={{
                position: 'relative',
                flexDirection: 'row',
                backgroundColor: isDarkMode ? '#1E2124' : '#1A1D20',
                borderRadius: 8,
                padding: 3,
                gap: 2,
                borderWidth: 1,
                borderColor: isDarkMode ? '#374151' : '#32373D',
              }}
            >
              {/* Smooth animated active-state sliding indicator matching exact button dimensions */}
              {tableFilterLayouts[tableFilter] && (
                <View
                  style={{
                    position: 'absolute',
                    top: 3,
                    bottom: 3,
                    left: tableFilterLayouts[tableFilter].x,
                    width: tableFilterLayouts[tableFilter].width,
                    backgroundColor: '#EA580C',
                    borderRadius: 6,
                    boxShadow: '0 1px 4px rgba(234, 88, 12, 0.35)',
                    transition:
                      'left 220ms cubic-bezier(0.4, 0, 0.2, 1), width 220ms cubic-bezier(0.4, 0, 0.2, 1)',
                    pointerEvents: 'none',
                    zIndex: 0,
                  }}
                />
              )}
              {[
                { key: 'all', label: 'All' },
                { key: 'online', label: 'Online Store' },
                { key: 'pos', label: 'POS In-Store' },
                { key: 'pending', label: 'Pending' },
              ].map((f) => {
                const isActive = tableFilter === f.key;
                const hasLayout = Boolean(tableFilterLayouts[tableFilter]);
                return (
                  <TouchableOpacity
                    key={f.key}
                    onPress={() => setTableFilter(f.key)}
                    onLayout={(e) => {
                      const { x, width } = e.nativeEvent.layout;
                      setTableFilterLayouts((prev) => {
                        if (prev[f.key]?.x === x && prev[f.key]?.width === width) return prev;
                        return { ...prev, [f.key]: { x, width } };
                      });
                    }}
                    activeOpacity={0.85}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 5,
                      borderRadius: 6,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: !hasLayout && isActive ? '#EA580C' : 'transparent',
                      cursor: 'pointer',
                      zIndex: 1,
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 12,
                        fontWeight: isActive ? '700' : '600',
                        color: isActive ? '#FFFFFF' : '#CBD5E1',
                        whiteSpace: 'nowrap',
                        transition: 'color 200ms ease',
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
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#EA580C' }}>
                View All ({orders.length}) →
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Clean Organized Table Rows (Retaining all original info!) */}
        {filteredOrders.length === 0 ? (
          <View style={{ paddingVertical: 48, alignItems: 'center', justifyContent: 'center' }}>
            <BootstrapIcon name="receipt" size={32} color={theme.textMuted} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: theme.textPrimary, marginTop: 10 }}>
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
              {/* Table Column Headers */}
              <View
                style={{
                  flexDirection: 'row',
                  paddingHorizontal: 20,
                  paddingVertical: 11,
                  backgroundColor: '#24272B',
                  borderBottomWidth: 1,
                  borderBottomColor: isDarkMode ? '#374151' : '#32373D',
                }}
              >
                <Text style={{ flex: 1.8, fontSize: 11.5, fontWeight: '700', color: '#CBD5E1', letterSpacing: 0.5, textTransform: 'uppercase' }}>Customer & Order</Text>
                <Text style={{ flex: 2.2, fontSize: 11.5, fontWeight: '700', color: '#CBD5E1', letterSpacing: 0.5, textTransform: 'uppercase' }}>Items & Qty</Text>
                <Text style={{ flex: 1.2, fontSize: 11.5, fontWeight: '700', color: '#CBD5E1', letterSpacing: 0.5, textTransform: 'uppercase' }}>Channel</Text>
                <Text style={{ flex: 1.3, fontSize: 11.5, fontWeight: '700', color: '#CBD5E1', letterSpacing: 0.5, textTransform: 'uppercase' }}>Payment & Total</Text>
                <Text style={{ flex: 1.3, fontSize: 11.5, fontWeight: '700', color: '#CBD5E1', textAlign: 'center', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  Status
                </Text>
              </View>

              {/* Scrollable Table Body (Like the Orders Table) */}
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
                const isInStore = rawChannel.includes('pos') || rawChannel.includes('in-store') || rawChannel.includes('walk-in') || (rawChannel.includes('store') && !rawChannel.includes('online'));
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

                let statusBg = isDarkMode ? '#1E2923' : '#F1F5F9';
                let statusFg = isDarkMode ? '#94A3B8' : '#334155';
                if (isPending) {
                  statusBg = isDarkMode ? 'rgba(245, 158, 11, 0.18)' : '#FEF3C7';
                  statusFg = isDarkMode ? '#FBBF24' : '#B45309';
                } else if (isProcessing || isReady) {
                  statusBg = isDarkMode ? 'rgba(56, 189, 248, 0.16)' : '#DBEAFE';
                  statusFg = isDarkMode ? '#7DD3FC' : '#1E3A5F';
                } else if (isShipped) {
                  statusBg = isDarkMode ? 'rgba(167, 139, 250, 0.16)' : '#EDE9FE';
                  statusFg = isDarkMode ? '#C4B5FD' : '#6D28D9';
                } else if (isDelivered) {
                  statusBg = isDarkMode ? 'rgba(34, 197, 94, 0.16)' : '#DCFCE7';
                  statusFg = isDarkMode ? '#4ADE80' : '#166534';
                } else if (isFailed || isCancelled) {
                  statusBg = isDarkMode ? 'rgba(239, 68, 68, 0.16)' : '#FEE2E2';
                  statusFg = isDarkMode ? '#FCA5A5' : '#B91C1C';
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
                        ? isDarkMode ? 'rgba(245, 158, 11, 0.05)' : '#FFFDF7'
                        : 'transparent',
                    }}
                  >
                    {/* Customer & Order */}
                    <View style={{ flex: 1.8, paddingRight: 10 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textPrimary }} numberOfLines={1}>
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
                      <Text style={{ fontSize: 12.5, fontWeight: '600', color: theme.textPrimary }} numberOfLines={1}>
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
                            ? (isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5')
                            : (isDarkMode ? 'rgba(37, 99, 235, 0.15)' : '#EFF6FF'),
                          borderColor: isInStore
                            ? (isDarkMode ? 'rgba(16, 185, 129, 0.3)' : '#A7F3D0')
                            : (isDarkMode ? 'rgba(37, 99, 235, 0.3)' : '#BFDBFE'),
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '700',
                            color: isInStore
                              ? (isDarkMode ? '#4ADE80' : '#059669')
                              : (isDarkMode ? '#60A5FA' : '#2563EB'),
                          }}
                        >
                          {displayChannel}
                        </Text>
                      </View>
                    </View>

                    {/* Payment & Total */}
                    <View style={{ flex: 1.3, paddingRight: 10 }}>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: theme.brandGreen }}>
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
                          borderRadius: isDelivered ? 6 : 999,
                          paddingHorizontal: isDelivered ? 12 : 10,
                          paddingVertical: 4,
                        }}
                      >
                        <Text
                          style={{
                            color: statusFg,
                            fontSize: 11,
                            fontWeight: '700',
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
 * Matches exact geometry of the live overview cards, charts, and recent orders table.
 */
export function ModernOverviewDashboardSkeleton({ isDarkMode = false, isDesktop = true }) {
  const { width: windowWidth } = useWindowDimensions();
  const baseColor = isDarkMode ? '#1E2824' : '#E2E8F0';
  const highlightColor = isDarkMode ? '#2A3A33' : '#F1F5F9';
  const cardBg = isDarkMode ? '#151D19' : '#FFFFFF';
  const cardBorder = isDarkMode ? '#23322B' : '#E5E8E5';

  return (
    <View style={{ width: '100%', gap: 20 }} role="status" aria-label="Loading dashboard metrics">
      {/* 1. TOP SECTION: Chart (Left) + 4 Stat Cards (Right) */}
      <View
        style={{
          flexDirection: isDesktop ? 'row' : 'column',
          gap: 18,
          alignItems: 'stretch',
        }}
      >
        {/* Left: Revenue Chart Card Skeleton */}
        <View
          style={{
            flex: isDesktop ? 1.55 : 1,
            backgroundColor: cardBg,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: cardBorder,
            padding: 22,
            gap: 16,
          }}
        >
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Skeleton circle size={32} baseColor={baseColor} highlightColor={highlightColor} />
              <View style={{ gap: 4 }}>
                <Skeleton width={120} height={16} baseColor={baseColor} highlightColor={highlightColor} />
                <Skeleton width={160} height={12} baseColor={baseColor} highlightColor={highlightColor} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Skeleton width={52} height={26} borderRadius={6} baseColor={baseColor} highlightColor={highlightColor} />
              <Skeleton width={52} height={26} borderRadius={6} baseColor={baseColor} highlightColor={highlightColor} />
              <Skeleton width={52} height={26} borderRadius={6} baseColor={baseColor} highlightColor={highlightColor} />
            </View>
          </View>

          {/* Big Revenue Stat */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 }}>
            <Skeleton width={180} height={34} borderRadius={6} baseColor={baseColor} highlightColor={highlightColor} />
            <Skeleton width={70} height={22} borderRadius={11} baseColor={baseColor} highlightColor={highlightColor} />
          </View>

          {/* Chart Shimmer Canvas */}
          <View style={{ height: 230, width: '100%', justifyContent: 'flex-end', paddingBottom: 10 }}>
            <Skeleton height={200} borderRadius={10} baseColor={baseColor} highlightColor={highlightColor} />
          </View>

          {/* Chart Footer Stats */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: cardBorder, paddingTop: 14 }}>
            {[1, 2, 3].map((k) => (
              <View key={k} style={{ gap: 4 }}>
                <Skeleton width={70} height={12} baseColor={baseColor} highlightColor={highlightColor} />
                <Skeleton width={90} height={18} baseColor={baseColor} highlightColor={highlightColor} />
              </View>
            ))}
          </View>
        </View>

        {/* Right: 4 KPI Cards Grid */}
        <View
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: windowWidth < 420 ? '1fr' : 'repeat(2, 1fr)',
            gridTemplateRows: isDesktop && windowWidth >= 420 ? 'repeat(2, 1fr)' : undefined,
            gap: 14,
            height: isDesktop ? '100%' : 'auto',
            alignSelf: 'stretch',
          }}
        >
          {[1, 2, 3, 4].map((k) => (
            <View
              key={k}
              style={{
                backgroundColor: cardBg,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: cardBorder,
                padding: 16,
                justifyContent: 'space-between',
                height: '100%',
                boxSizing: 'border-box',
                gap: 12,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Skeleton width={80} height={14} baseColor={baseColor} highlightColor={highlightColor} />
                <Skeleton circle size={28} baseColor={baseColor} highlightColor={highlightColor} />
              </View>
              <Skeleton width={110} height={26} baseColor={baseColor} highlightColor={highlightColor} />
              <View style={{ height: 32, width: '100%' }}>
                <Skeleton height={28} borderRadius={6} baseColor={baseColor} highlightColor={highlightColor} />
              </View>
              <Skeleton width={90} height={12} baseColor={baseColor} highlightColor={highlightColor} />
            </View>
          ))}
        </View>
      </View>

      {/* 2. MIDDLE SECTION: 2 Column Analytics Cards */}
      <View
        style={{
          flexDirection: isDesktop ? 'row' : 'column',
          gap: 18,
          alignItems: 'stretch',
        }}
      >
        {/* Left: Top Products */}
        <View
          style={{
            flex: 1,
            backgroundColor: cardBg,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: cardBorder,
            padding: 20,
            gap: 14,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Skeleton width={140} height={18} baseColor={baseColor} highlightColor={highlightColor} />
            <Skeleton width={70} height={14} baseColor={baseColor} highlightColor={highlightColor} />
          </View>
          {[1, 2, 3, 4, 5].map((k) => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 }}>
              <Skeleton width={20} height={16} baseColor={baseColor} highlightColor={highlightColor} />
              <Skeleton width={38} height={38} borderRadius={8} baseColor={baseColor} highlightColor={highlightColor} />
              <View style={{ flex: 1, gap: 5 }}>
                <Skeleton width="65%" height={14} baseColor={baseColor} highlightColor={highlightColor} />
                <Skeleton width="40%" height={10} baseColor={baseColor} highlightColor={highlightColor} />
              </View>
              <Skeleton width={60} height={16} baseColor={baseColor} highlightColor={highlightColor} />
            </View>
          ))}
        </View>

        {/* Right: Revenue Breakdown by Channel */}
        <View
          style={{
            flex: 1,
            backgroundColor: cardBg,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: cardBorder,
            padding: 20,
            gap: 16,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Skeleton width={160} height={18} baseColor={baseColor} highlightColor={highlightColor} />
            <Skeleton circle size={28} baseColor={baseColor} highlightColor={highlightColor} />
          </View>
          {[1, 2, 3, 4].map((k) => (
            <View key={k} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Skeleton width={110} height={14} baseColor={baseColor} highlightColor={highlightColor} />
                <Skeleton width={75} height={14} baseColor={baseColor} highlightColor={highlightColor} />
              </View>
              <Skeleton width="100%" height={10} borderRadius={5} baseColor={baseColor} highlightColor={highlightColor} />
            </View>
          ))}
        </View>
      </View>

      {/* 3. BOTTOM SECTION: Recent Orders Table Skeleton */}
      <View
        style={{
          backgroundColor: cardBg,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: cardBorder,
          padding: 20,
          gap: 16,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ gap: 4 }}>
            <Skeleton width={150} height={18} baseColor={baseColor} highlightColor={highlightColor} />
            <Skeleton width={200} height={12} baseColor={baseColor} highlightColor={highlightColor} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Skeleton width={65} height={28} borderRadius={6} baseColor={baseColor} highlightColor={highlightColor} />
            <Skeleton width={65} height={28} borderRadius={6} baseColor={baseColor} highlightColor={highlightColor} />
          </View>
        </View>

        <Skeleton.Table
          rows={6}
          columns={5}
          showHeader
          baseColor={baseColor}
          highlightColor={highlightColor}
        />
      </View>
    </View>
  );
}

ModernOverviewDashboard.Skeleton = ModernOverviewDashboardSkeleton;

