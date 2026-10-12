import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon.jsx';
import { aggregateSalesTrend } from '../../services/inventory/dashboardInsightsService.js';
import { useTheme } from '../../context/ThemeContext.jsx';

function formatPeso(n) {
  const v = Math.round(Number(n) || 0);
  return `₱${v.toLocaleString()}`;
}

function computeVisibleXLabels(points, gW, isDesktop) {
  const total = points.length;
  if (total === 0) return new Set();

  // On desktop with 16 or fewer points (such as the default 14-day daily telemetry)
  // or when each point has ample width (>= 40px), show all labels without skipping any dates
  const stepW = gW / Math.max(1, total - 1);
  if ((isDesktop && total <= 16) || stepW >= 40) {
    return new Set(points.map((_, i) => i));
  }

  const visible = new Set();
  const placedX = [];
  const minDistancePx = 36;

  // 1. Always prioritize active points with revenue or order activity (e.g. peak points like Oct 2)
  points.forEach((p, i) => {
    if (p.revenue > 0 || p.ordersCount > 0) {
      visible.add(i);
      placedX.push(p.x);
    }
  });

  // 2. Always try to include start (index 0) and end (index total - 1)
  [0, total - 1].forEach((idx) => {
    const px = points[idx].x;
    const collides = placedX.some((x) => Math.abs(x - px) < minDistancePx);
    if (!collides) {
      visible.add(idx);
      placedX.push(px);
    }
  });

  // 3. Stride across the remaining points to evenly distribute labels without overlapping
  const stride = Math.max(2, Math.ceil(minDistancePx / Math.max(1, stepW)));
  for (let i = 0; i < total; i += stride) {
    const px = points[i].x;
    const collides = placedX.some((x) => Math.abs(x - px) < minDistancePx);
    if (!collides) {
      visible.add(i);
      placedX.push(px);
    }
  }

  return visible;
}

function computeMonotoneCubicSpline(pts, padding, gH, baseline) {
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

  let lPath = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const step = dxs[i] / 3;

    const cp1x = p1.x + step;
    let cp1y = p1.y + m[i] * step;
    const cp2x = p2.x - step;
    let cp2y = p2.y - m[i + 1] * step;

    // Strictly clamp control points between padding.top and baseline
    cp1y = Math.min(baseline, Math.max(padding.top, cp1y));
    cp2y = Math.min(baseline, Math.max(padding.top, cp2y));

    lPath += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }

  const aPath = `${lPath} L ${pts[n - 1].x.toFixed(1)},${baseline.toFixed(1)} L ${pts[0].x.toFixed(1)},${baseline.toFixed(1)} Z`;
  return { linePath: lPath, areaPath: aPath };
}

/**
 * RevenueTrendChart — Unified modern revenue trend chart.
 * Matches the Dashboard Revenue Trend design system with Daily, Weekly, and Monthly views.
 */
export default function RevenueTrendChart({
  orders = [],
  data,
  granularity,
  onGranularityChange,
  isDark,
  isDesktop = true,
  title = 'Revenue Trend',
  subtitle,
  style,
}) {
  const themeContext = useTheme?.();
  const activeIsDark =
    isDark !== undefined && isDark !== null
      ? Boolean(isDark)
      : Boolean(themeContext?.isDarkMode);

  const [internalGranularity, setInternalGranularity] = useState('daily');
  const activeGranularity = granularity || internalGranularity;

  const handleGranularityChange = (g) => {
    if (typeof onGranularityChange === 'function') {
      onGranularityChange(g);
    }
    setInternalGranularity(g);
  };

  const chartData = useMemo(() => {
    if (Array.isArray(orders) && orders.length > 0) {
      return aggregateSalesTrend(orders, activeGranularity);
    }
    if (Array.isArray(data) && data.length > 0) {
      return data;
    }
    return aggregateSalesTrend([], activeGranularity);
  }, [orders, data, activeGranularity]);

  const [hoveredIdx, setHoveredIdx] = useState(null);
  const containerRef = useRef(null);
  const [measuredWidth, setMeasuredWidth] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const update = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth || containerRef.current.offsetWidth;
        if (w > 100) setMeasuredWidth(w);
      }
    };
    update();
    let ro;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = entry.contentRect.width;
          if (w > 100) setMeasuredWidth(w);
        }
      });
      ro.observe(containerRef.current);
    }
    window.addEventListener('resize', update);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  const chartWidth = measuredWidth > 150 ? measuredWidth : (isDesktop ? 860 : 420);
  const chartHeight = isDesktop ? 220 : 190;
  const padding = { top: 22, right: 28, bottom: 32, left: isDesktop ? 62 : 48 };

  const {
    points,
    roundedMax,
    yTicks,
    totalRev,
    avgRev,
    peakRev,
    peakLabel,
    totalOrders,
    avgY,
    baseline,
    linePath,
    areaPath,
    gW,
    gH,
    hasData,
  } = useMemo(() => {
    const rawList = Array.isArray(chartData) ? chartData : [];
    const len = Math.max(rawList.length, 2);
    const w = Math.max(10, chartWidth - padding.left - padding.right);
    const h = Math.max(10, chartHeight - padding.top - padding.bottom);
    const bLine = padding.top + h;

    const revenues = rawList.map((d) => Number(d.revenue) || 0);
    const total = revenues.reduce((acc, v) => acc + v, 0);
    const avg = revenues.length > 0 ? total / revenues.length : 0;
    const max = Math.max(...revenues, 100);
    const ordersCountSum = rawList.reduce((acc, d) => acc + (Number(d.ordersCount) || 0), 0);

    const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
    const rMax = Math.ceil((max * 1.15) / (magnitude / 2)) * (magnitude / 2) || 1000;
    const ticks = [0, 0.33, 0.66, 1].map((f) => Math.round(rMax * f));

    let pVal = 0;
    let pName = '—';
    rawList.forEach((d) => {
      const rev = Number(d.revenue) || 0;
      if (rev > pVal) {
        pVal = rev;
        pName = d.label || '';
      }
    });

    const pts = rawList.map((d, i) => {
      const x = padding.left + (i / Math.max(1, len - 1)) * w;
      const rev = Number(d.revenue) || 0;
      const y = padding.top + h - (rev / rMax) * h;
      return {
        index: i,
        label: d.label || '',
        fullLabel: d.fullLabel || d.label || '',
        revenue: rev,
        ordersCount: Number(d.ordersCount) || 0,
        x,
        y,
      };
    });

    const averageY = padding.top + h - (avg / rMax) * h;
    const paths = computeMonotoneCubicSpline(pts, padding, h, bLine);

    return {
      points: pts,
      roundedMax: rMax,
      yTicks: ticks,
      totalRev: total,
      avgRev: avg,
      peakRev: pVal,
      peakLabel: pName,
      totalOrders: ordersCountSum,
      avgY: averageY,
      baseline: bLine,
      linePath: paths.linePath,
      areaPath: paths.areaPath,
      gW: w,
      gH: h,
      hasData: revenues.some((v) => v > 0),
    };
  }, [chartData, chartWidth, chartHeight]);

  const visibleXLabels = useMemo(() => {
    return computeVisibleXLabels(points, gW, isDesktop);
  }, [points, gW, isDesktop]);

  const activePoint = hoveredIdx != null && points[hoveredIdx] ? points[hoveredIdx] : null;

  const resolvedSubtitle =
    subtitle ||
    (activeGranularity === 'daily'
      ? 'Daily telemetry (last 14 days)'
      : activeGranularity === 'weekly'
      ? 'Weekly telemetry (last 8 weeks)'
      : 'Monthly telemetry (last 6 months)');

  const periodSelector = (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: activeIsDark ? '#151C19' : '#F1F5F9',
        borderRadius: 9,
        padding: 3,
        borderWidth: 1,
        borderColor: activeIsDark ? '#26332E' : '#E2E8F0',
        gap: 3,
      }}
    >
      {[
        { id: 'daily', label: 'Daily' },
        { id: 'weekly', label: 'Weekly' },
        { id: 'monthly', label: 'Monthly' },
      ].map((tab) => {
        const active = activeGranularity === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            onPress={() => handleGranularityChange(tab.id)}
            activeOpacity={0.8}
            style={{
              paddingHorizontal: 11,
              paddingVertical: 5,
              borderRadius: 7,
              backgroundColor: active
                ? (activeIsDark ? '#10B981' : '#1D4533')
                : 'transparent',
            }}
          >
            <Text
              style={{
                fontSize: 11.5,
                fontWeight: active ? '700' : '600',
                color: active
                  ? '#FFFFFF'
                  : (activeIsDark ? '#AAB4B0' : '#64748B'),
              }}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <View
      ref={containerRef}
      style={[
        {
          backgroundColor: activeIsDark ? '#0F1412' : '#FFFFFF',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: activeIsDark ? '#26332E' : '#E2E8F0',
          padding: 20,
          marginBottom: 20,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: activeIsDark ? 0.25 : 0.03,
          shadowRadius: 4,
          elevation: 1,
        },
        style,
      ]}
    >
      {/* Chart Header */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: activeIsDark ? 'rgba(16, 185, 129, 0.16)' : 'rgba(29, 69, 51, 0.08)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BootstrapIcon
              name="graph-up"
              size={15}
              color={activeIsDark ? '#4ADE80' : '#1D4533'}
            />
          </View>
          <View>
            <Text
              style={{
                fontSize: 14,
                fontWeight: '800',
                color: activeIsDark ? '#F5F7F6' : '#0F172A',
                letterSpacing: 0.2,
              }}
            >
              {title}
            </Text>
            <Text style={{ fontSize: 11.5, color: activeIsDark ? '#AAB4B0' : '#64748B', marginTop: 1 }}>
              {resolvedSubtitle}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {avgRev > 0 && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: activeIsDark ? '#151C19' : '#F8FAFC',
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 7,
                borderWidth: 1,
                borderColor: activeIsDark ? '#26332E' : '#E2E8F0',
              }}
            >
              <View
                style={{
                  width: 12,
                  height: 2,
                  borderTopWidth: 2,
                  borderTopColor: activeIsDark ? '#4ADE80' : '#1D4533',
                  borderStyle: 'dashed',
                }}
              />
              <Text style={{ fontSize: 11, fontWeight: '600', color: activeIsDark ? '#AAB4B0' : '#64748B' }}>
                Avg: {formatPeso(avgRev)}/{activeGranularity === 'daily' ? 'day' : activeGranularity === 'weekly' ? 'wk' : 'mo'}
              </Text>
            </View>
          )}

          {periodSelector}
        </View>
      </View>

      {/* Main Chart Body */}
      {!hasData ? (
        <View style={{ paddingVertical: 40, alignItems: 'center', justifyContent: 'center' }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: activeIsDark ? '#151C19' : '#F8FAFC',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 10,
              borderWidth: 1,
              borderColor: activeIsDark ? '#26332E' : '#E2E8F0',
            }}
          >
            <BootstrapIcon name="bar-chart" size={20} color={activeIsDark ? '#AAB4B0' : '#64748B'} />
          </View>
          <Text style={{ fontSize: 13, fontWeight: '700', color: activeIsDark ? '#F5F7F6' : '#0F172A' }}>
            No sales recorded for this period
          </Text>
          <Text style={{ fontSize: 11.5, color: activeIsDark ? '#AAB4B0' : '#64748B', marginTop: 3 }}>
            Order transactions within this date range will appear here automatically.
          </Text>
        </View>
      ) : (
        <View style={{ width: '100%', height: chartHeight, position: 'relative' }}>
          {Platform.OS === 'web' ? (
            <svg
              width="100%"
              height={chartHeight}
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              style={{ display: 'block', overflow: 'visible', userSelect: 'none' }}
            >
              <defs>
                <linearGradient id="reportsRevTrendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={activeIsDark ? '#10B981' : '#1D4533'}
                    stopOpacity={activeIsDark ? 0.35 : 0.22}
                  />
                  <stop
                    offset="100%"
                    stopColor={activeIsDark ? '#10B981' : '#1D4533'}
                    stopOpacity={0.0}
                  />
                </linearGradient>
              </defs>

              {/* Horizontal Gridlines & Y-Axis Labels */}
              {yTicks.map((val, idx) => {
                const yPos = padding.top + gH - (val / roundedMax) * gH;
                return (
                  <g key={`ytick-${idx}`}>
                    <line
                      x1={padding.left}
                      y1={yPos}
                      x2={chartWidth - padding.right}
                      y2={yPos}
                      stroke={activeIsDark ? 'rgba(255, 255, 255, 0.06)' : '#E2E8F0'}
                      strokeWidth="1"
                      strokeDasharray={idx === 0 ? undefined : '3 3'}
                    />
                    <text
                      x={padding.left - 8}
                      y={yPos + 3.5}
                      textAnchor="end"
                      fontSize="10"
                      fontWeight="600"
                      fill={activeIsDark ? '#AAB4B0' : '#64748B'}
                      fontFamily="inherit"
                    >
                      ₱{val >= 1000 ? `${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k` : val}
                    </text>
                  </g>
                );
              })}

              {/* Average Benchmark Dashed Line */}
              {avgRev > 0 && avgY >= padding.top && avgY <= baseline && (
                <line
                  x1={padding.left}
                  y1={avgY}
                  x2={chartWidth - padding.right}
                  y2={avgY}
                  stroke={activeIsDark ? '#34D399' : '#1D4533'}
                  strokeWidth="1.2"
                  strokeDasharray="4 4"
                  strokeOpacity={0.7}
                />
              )}

              {/* Area Fill */}
              {areaPath ? <path d={areaPath} fill="url(#reportsRevTrendGrad)" /> : null}

              {/* Spline Line */}
              {linePath ? (
                <path
                  d={linePath}
                  fill="none"
                  stroke={activeIsDark ? '#34D399' : '#1D4533'}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}

              {/* Crosshair Line */}
              {activePoint ? (
                <line
                  x1={activePoint.x}
                  y1={padding.top}
                  x2={activePoint.x}
                  y2={baseline}
                  stroke={activeIsDark ? '#34D399' : '#1D4533'}
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                  strokeOpacity={0.8}
                />
              ) : null}

              {/* Interactive Data Point Nodes & Invisible Targets */}
              {points.map((p, i) => {
                const isHovered = hoveredIdx === i;
                const stepW = gW / Math.max(1, points.length - 1);
                const targetX = Math.max(0, p.x - stepW / 2);

                return (
                  <g key={`pt-${i}`}>
                    {/* Circle */}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={isHovered ? 6 : p.revenue > 0 ? 3.5 : 2}
                      fill={isHovered ? (activeIsDark ? '#34D399' : '#1D4533') : activeIsDark ? '#0F1412' : '#FFFFFF'}
                      stroke={activeIsDark ? '#34D399' : '#1D4533'}
                      strokeWidth={isHovered ? 2.5 : 2}
                      style={{ transition: 'all 0.15s ease' }}
                    />

                    {/* X-Axis Date Label */}
                    {(visibleXLabels.has(i) || isHovered) ? (
                      <text
                        x={p.x}
                        y={baseline + 18}
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight={isHovered ? '700' : '600'}
                        fill={isHovered ? (activeIsDark ? '#F5F7F6' : '#0F172A') : (activeIsDark ? '#AAB4B0' : '#64748B')}
                        fontFamily="inherit"
                      >
                        {p.label}
                      </text>
                    ) : null}

                    {/* Invisible Wide Capture Target */}
                    <rect
                      x={targetX}
                      y={padding.top}
                      width={stepW}
                      height={gH + 24}
                      fill="transparent"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredIdx(i)}
                      onMouseLeave={() => setHoveredIdx(null)}
                      onClick={() => setHoveredIdx(hoveredIdx === i ? null : i)}
                    />
                  </g>
                );
              })}
            </svg>
          ) : (
            <View style={{ height: 6, backgroundColor: activeIsDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
              <View
                style={{
                  height: '100%',
                  width: hasData ? '70%' : '10%',
                  backgroundColor: activeIsDark ? '#34D399' : '#1D4533',
                  borderRadius: 3,
                }}
              />
            </View>
          )}

          {/* Floating Tooltip */}
          {activePoint ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: Math.max(0, activePoint.y - 70),
                left: Math.min(
                  Math.max(10, activePoint.x - 70),
                  Math.max(10, chartWidth - 170)
                ),
                backgroundColor: activeIsDark ? '#151C19' : '#0F172A',
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35,
                shadowRadius: 8,
                elevation: 6,
                borderWidth: 1,
                borderColor: activeIsDark ? '#26332E' : 'rgba(255,255,255,0.1)',
                zIndex: 99,
                minWidth: 140,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '600', color: '#94A3B8' }}>
                {activePoint.fullLabel}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '800',
                  color: '#FFFFFF',
                  marginTop: 2,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {formatPeso(activePoint.revenue)}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, gap: 8 }}>
                <Text style={{ fontSize: 10, color: '#CBD5E1' }}>
                  {activePoint.ordersCount} order{activePoint.ordersCount === 1 ? '' : 's'}
                </Text>
                {avgRev > 0 && activePoint.revenue > 0 ? (
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '700',
                      color: activePoint.revenue >= avgRev ? '#4ADE80' : '#F87171',
                    }}
                  >
                    {activePoint.revenue >= avgRev ? '↑' : '↓'}{' '}
                    {Math.round((Math.abs(activePoint.revenue - avgRev) / avgRev) * 100)}% vs avg
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>
      )}

      {/* Telemetry Summary Bar */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 12,
          marginTop: 16,
          paddingTop: 14,
          borderTopWidth: 1,
          borderTopColor: activeIsDark ? '#26332E' : '#E2E8F0',
        }}
      >
        <View style={{ flex: 1, minWidth: 120 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: activeIsDark ? '#AAB4B0' : '#64748B', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Period Total
          </Text>
          <Text style={{ fontSize: 15, fontWeight: '800', color: activeIsDark ? '#F5F7F6' : '#0F172A', marginTop: 2, fontVariant: ['tabular-nums'] }}>
            {formatPeso(totalRev)}
          </Text>
        </View>

        <View style={{ flex: 1, minWidth: 120 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: activeIsDark ? '#AAB4B0' : '#64748B', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Period Average
          </Text>
          <Text style={{ fontSize: 15, fontWeight: '800', color: activeIsDark ? '#F5F7F6' : '#0F172A', marginTop: 2, fontVariant: ['tabular-nums'] }}>
            {formatPeso(avgRev)}{' '}
            <Text style={{ fontSize: 11, fontWeight: '600', color: activeIsDark ? '#AAB4B0' : '#64748B' }}>
              /{activeGranularity === 'daily' ? 'day' : activeGranularity === 'weekly' ? 'wk' : 'mo'}
            </Text>
          </Text>
        </View>

        <View style={{ flex: 1, minWidth: 120 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: activeIsDark ? '#AAB4B0' : '#64748B', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Peak Period
          </Text>
          <Text style={{ fontSize: 15, fontWeight: '800', color: activeIsDark ? '#F5F7F6' : '#0F172A', marginTop: 2, fontVariant: ['tabular-nums'] }}>
            {peakRev > 0 ? formatPeso(peakRev) : '₱0'}{' '}
            <Text style={{ fontSize: 11, fontWeight: '600', color: activeIsDark ? '#AAB4B0' : '#64748B' }}>
              ({peakLabel})
            </Text>
          </Text>
        </View>

        <View style={{ flex: 1, minWidth: 120 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: activeIsDark ? '#AAB4B0' : '#64748B', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Orders in Period
          </Text>
          <Text style={{ fontSize: 15, fontWeight: '800', color: activeIsDark ? '#F5F7F6' : '#0F172A', marginTop: 2, fontVariant: ['tabular-nums'] }}>
            {totalOrders} order{totalOrders === 1 ? '' : 's'}
          </Text>
        </View>
      </View>
    </View>
  );
}
