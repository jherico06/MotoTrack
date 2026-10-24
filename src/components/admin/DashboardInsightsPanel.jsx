/**
 * Compact overview insights: sales performance, inventory health,
 * action required, sales by channel, product performance.
 * Preserves MotoTrack admin visual language.
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { BootstrapIcon } from '../common';
import { aggregateSalesTrend } from '../../services/inventory/dashboardInsightsService.js';

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

function CompareBadge({ compare, isDark, tokens }) {
  if (!compare) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
        <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : tokens.textMuted }}>Not available</Text>
      </View>
    );
  }

  // Case 1: Unavailable
  if (compare.isUnavailable || (compare.pct == null && !compare.isNewBaseline)) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
        <View
          style={{
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 6,
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0',
          }}
        >
          <Text style={{ fontSize: 10.5, fontWeight: '700', color: isDark ? '#94A3B8' : tokens.textMuted }}>N/A</Text>
        </View>
        <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : tokens.textMuted }}>
          {compare.message || 'Not available'}
        </Text>
      </View>
    );
  }

  // Case 2: No sales in previous period (previous was 0, current > 0)
  if (compare.isNewBaseline) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
        <View
          style={{
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 6,
            backgroundColor: isDark ? 'rgba(22, 163, 74, 0.16)' : '#ECFDF5',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(74, 222, 128, 0.35)' : '#A7F3D0',
          }}
        >
          <Text style={{ fontSize: 10.5, fontWeight: '700', color: isDark ? '#4ADE80' : '#059669' }}>
            ↑ Active
          </Text>
        </View>
        <Text style={{ fontSize: 11, fontWeight: '500', color: isDark ? '#94A3B8' : tokens.textMuted }}>
          No sales in previous period
        </Text>
      </View>
    );
  }

  // Case 3: Both zero (no prior sales and no current sales)
  if (compare.noPrior || (compare.pct === 0 && compare.direction === 'neutral')) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
        <View
          style={{
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 6,
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0',
          }}
        >
          <Text style={{ fontSize: 10.5, fontWeight: '700', color: isDark ? '#94A3B8' : tokens.textMuted }}>
            — 0%
          </Text>
        </View>
        <Text style={{ fontSize: 11, fontWeight: '500', color: isDark ? '#94A3B8' : tokens.textMuted }}>
          {compare.label}
        </Text>
      </View>
    );
  }

  // Case 4: Normal positive or negative
  const isUp = compare.direction === 'up';
  const isDown = compare.direction === 'down';
  const badgeBg = isUp
    ? (isDark ? 'rgba(22, 163, 74, 0.16)' : '#ECFDF5')
    : isDown
    ? (isDark ? 'rgba(220, 38, 38, 0.16)' : '#FEF2F2')
    : (isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9');
  const badgeBorder = isUp
    ? (isDark ? 'rgba(74, 222, 128, 0.35)' : '#A7F3D0')
    : isDown
    ? (isDark ? 'rgba(248, 113, 113, 0.35)' : '#FECACA')
    : (isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0');
  const badgeColor = isUp
    ? (isDark ? '#4ADE80' : '#059669')
    : isDown
    ? (isDark ? '#F87171' : '#DC2626')
    : (isDark ? '#94A3B8' : tokens.textMuted);
  const arrow = isUp ? '↑' : isDown ? '↓' : '—';
  const formattedPct = `${arrow} ${Math.abs(compare.pct)}%`;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
      <View
        style={{
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 6,
          backgroundColor: badgeBg,
          borderWidth: 1,
          borderColor: badgeBorder,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Text style={{ fontSize: 10.5, fontWeight: '700', color: badgeColor }}>
          {formattedPct}
        </Text>
      </View>
      <Text style={{ fontSize: 11, fontWeight: '500', color: isDark ? '#94A3B8' : tokens.textMuted }}>
        {compare.label}
      </Text>
    </View>
  );
}

function SectionCard({ title, subtitle, actionLabel, onAction, headerRight, children, tokens, isDark, style }) {
  return (
    <View
      style={[
        {
          backgroundColor: isDark ? '#0F1412' : '#FFFFFF',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: isDark ? (tokens?.border || '#26332E') : (tokens?.border || '#E2E8F0'),
          padding: 20,
          marginBottom: 0,
          flex: 1,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: isDark ? 0.25 : 0.04,
          shadowRadius: 4,
          elevation: 1,
        },
        style,
      ]}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <View style={{ flex: 1, minWidth: 200 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '800',
              color: isDark ? '#F8FAFC' : tokens.textPrimary,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
            }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : tokens.textMuted, marginTop: 3 }}>{subtitle}</Text>
          ) : null}
        </View>
        {headerRight ? headerRight : null}
        {actionLabel && onAction ? (
          <TouchableOpacity
            onPress={onAction}
            activeOpacity={0.8}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 8,
              backgroundColor: isDark ? '#1A2320' : '#F1F5F9',
            }}
          >
            <Text style={{ fontSize: 11.5, fontWeight: '700', color: isDark ? '#F5F7F6' : '#475569' }}>
              {actionLabel}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function SalesMetricCard({
  iconName,
  iconColor,
  iconBg,
  label,
  value,
  sublabel,
  compare,
  tokens,
  isDark,
}) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 170,
        backgroundColor: isDark ? '#0F1412' : '#FFFFFF',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: isDark ? (tokens?.border || '#26332E') : '#E2E8F0',
        padding: 16,
        justifyContent: 'space-between',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: isDark ? 0.25 : 0.03,
        shadowRadius: 4,
        elevation: 1,
      }}
    >
      <View>
        {/* Top row: subtle icon container on left, optional count on right */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: iconBg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BootstrapIcon name={iconName} size={15} color={iconColor} />
          </View>
          {sublabel ? (
            <View
              style={{
                paddingHorizontal: 7,
                paddingVertical: 2,
                borderRadius: 6,
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F8FAFC',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
              }}
            >
              <Text style={{ fontSize: 10.5, fontWeight: '600', color: isDark ? '#94A3B8' : tokens.textMuted }}>
                {sublabel}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Metric Label */}
        <Text
          style={{
            fontSize: 11,
            fontWeight: '700',
            color: isDark ? '#94A3B8' : tokens.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            marginTop: 12,
          }}
        >
          {label}
        </Text>

        {/* Main Currency Value */}
        <Text
          style={{
            fontSize: 22,
            fontWeight: '800',
            color: isDark ? '#F8FAFC' : tokens.textPrimary,
            marginTop: 4,
            fontVariant: ['tabular-nums'],
            fontFamily: Platform.select({ web: "'Plus Jakarta Sans', sans-serif", default: undefined }),
            letterSpacing: -0.4,
          }}
        >
          {value}
        </Text>
      </View>

      {/* Comparison Trend Indicator */}
      <CompareBadge compare={compare} isDark={isDark} tokens={tokens} />
    </View>
  );
}

function SalesRevenueTrendChart({
  data = [],
  granularity = 'daily',
  isDark = false,
  isDesktop = true,
  tokens,
}) {
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
    const rawList = Array.isArray(data) ? data : [];
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
  }, [data, chartWidth, chartHeight]);

  const visibleXLabels = useMemo(() => {
    return computeVisibleXLabels(points, gW, isDesktop);
  }, [points, gW, isDesktop]);

  const activePoint = hoveredIdx != null && points[hoveredIdx] ? points[hoveredIdx] : null;

  return (
    <View
      ref={containerRef}
      style={{
        backgroundColor: isDark ? '#0F1412' : '#F8FAFC',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: isDark ? (tokens?.border || '#26332E') : '#E2E8F0',
        padding: 16,
        marginTop: 6,
      }}
    >
      {/* Chart Subheader */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.16)' : 'rgba(234, 88, 12, 0.12)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BootstrapIcon
              name="graph-up"
              size={13}
              color={isDark ? '#4ADE80' : '#EA580C'}
            />
          </View>
          <View>
            <Text
              style={{
                fontSize: 12.5,
                fontWeight: '800',
                color: isDark ? '#F8FAFC' : tokens.textPrimary,
                letterSpacing: 0.2,
              }}
            >
              Revenue Trend
            </Text>
            <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : tokens.textMuted }}>
              {granularity === 'daily'
                ? 'Daily telemetry (last 14 days)'
                : granularity === 'weekly'
                ? 'Weekly telemetry (last 8 weeks)'
                : 'Monthly telemetry (last 6 months)'}
            </Text>
          </View>
        </View>

        {avgRev > 0 && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: isDark ? '#151C19' : '#FFFFFF',
              paddingHorizontal: 9,
              paddingVertical: 4,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: isDark ? (tokens?.border || '#26332E') : '#E2E8F0',
            }}
          >
            <View
              style={{
                width: 12,
                height: 2,
                borderTopWidth: 2,
                borderTopColor: isDark ? '#4ADE80' : '#EA580C',
                borderStyle: 'dashed',
              }}
            />
            <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#94A3B8' : tokens.textMuted }}>
              Avg: {formatPeso(avgRev)}/{granularity === 'daily' ? 'day' : granularity === 'weekly' ? 'wk' : 'mo'}
            </Text>
          </View>
        )}
      </View>

      {/* Main Chart Body — zero revenue still draws the baseline and date axis */}
      <View style={{ width: '100%', height: chartHeight, position: 'relative' }}>
          {Platform.OS === 'web' ? (
            <svg
              width="100%"
              height={chartHeight}
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              style={{ display: 'block', overflow: 'visible', userSelect: 'none' }}
            >
              <defs>
                <linearGradient id="salesTrendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="#EA580C"
                    stopOpacity={isDark ? 0.35 : 0.22}
                  />
                  <stop
                    offset="100%"
                    stopColor="#EA580C"
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
                      stroke={isDark ? 'rgba(255, 255, 255, 0.06)' : '#E2E8F0'}
                      strokeWidth="1"
                      strokeDasharray={idx === 0 ? undefined : '3 3'}
                    />
                    <text
                      x={padding.left - 8}
                      y={yPos + 3.5}
                      textAnchor="end"
                      fontSize="10"
                      fontWeight="600"
                      fill={isDark ? '#94A3B8' : tokens.textMuted}
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
                  stroke={isDark ? '#34D399' : '#EA580C'}
                  strokeWidth="1.2"
                  strokeDasharray="4 4"
                  strokeOpacity={0.7}
                />
              )}

              {/* Area Fill */}
              {areaPath ? <path d={areaPath} fill="url(#salesTrendGrad)" /> : null}

              {/* Spline Line */}
              {linePath ? (
                <path
                  d={linePath}
                  fill="none"
                  stroke={isDark ? '#34D399' : '#EA580C'}
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
                  stroke={isDark ? '#34D399' : '#EA580C'}
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
                    {(isHovered || p.revenue > 0 || i === points.length - 1) && (
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={isHovered ? 6 : 3.5}
                        fill={
                          isHovered || p.revenue <= 0
                            ? (isDark ? '#34D399' : '#EA580C')
                            : (isDark ? '#0F1412' : '#FFFFFF')
                        }
                        stroke={isDark ? '#34D399' : '#EA580C'}
                        strokeWidth={isHovered ? 2.5 : 2}
                        style={{ transition: 'all 0.15s ease' }}
                      />
                    )}

                    {/* X-Axis Date Label */}
                    {(visibleXLabels.has(i) || isHovered) ? (
                      <text
                        x={p.x}
                        y={baseline + 18}
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight={isHovered ? '700' : '600'}
                        fill={isHovered ? (isDark ? '#F8FAFC' : tokens.textPrimary) : (isDark ? '#94A3B8' : tokens.textMuted)}
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
            <View style={{ height: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
              <View
                style={{
                  height: '100%',
                  width: hasData ? '70%' : '10%',
                  backgroundColor: isDark ? '#34D399' : '#EA580C',
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
                backgroundColor: isDark ? '#151C19' : '#0F172A',
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35,
                shadowRadius: 8,
                elevation: 6,
                borderWidth: 1,
                borderColor: isDark ? (tokens?.border || '#26332E') : 'rgba(255,255,255,0.1)',
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

      {/* Telemetry Summary Bar */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 12,
          marginTop: 14,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
        }}
      >
        <View style={{ flex: 1, minWidth: 120 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: isDark ? '#94A3B8' : tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Period Total
          </Text>
          <Text style={{ fontSize: 15, fontWeight: '800', color: isDark ? '#F8FAFC' : tokens.textPrimary, marginTop: 2, fontVariant: ['tabular-nums'] }}>
            {formatPeso(totalRev)}
          </Text>
        </View>

        <View style={{ flex: 1, minWidth: 120 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: isDark ? '#94A3B8' : tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Period Average
          </Text>
          <Text style={{ fontSize: 15, fontWeight: '800', color: isDark ? '#F8FAFC' : tokens.textPrimary, marginTop: 2, fontVariant: ['tabular-nums'] }}>
            {formatPeso(avgRev)}{' '}
            <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#94A3B8' : tokens.textMuted }}>
              /{granularity === 'daily' ? 'day' : granularity === 'weekly' ? 'wk' : 'mo'}
            </Text>
          </Text>
        </View>

        <View style={{ flex: 1, minWidth: 120 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: isDark ? '#94A3B8' : tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Peak Period
          </Text>
          <Text style={{ fontSize: 15, fontWeight: '800', color: isDark ? '#F8FAFC' : tokens.textPrimary, marginTop: 2, fontVariant: ['tabular-nums'] }}>
            {peakRev > 0 ? formatPeso(peakRev) : '₱0'}{' '}
            <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#94A3B8' : tokens.textMuted }}>
              ({peakLabel})
            </Text>
          </Text>
        </View>

        <View style={{ flex: 1, minWidth: 120 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: isDark ? '#94A3B8' : tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Orders in Period
          </Text>
          <Text style={{ fontSize: 15, fontWeight: '800', color: isDark ? '#F8FAFC' : tokens.textPrimary, marginTop: 2, fontVariant: ['tabular-nums'] }}>
            {totalOrders} order{totalOrders === 1 ? '' : 's'}
          </Text>
        </View>
      </View>
    </View>
  );
}

function HealthRow({ label, count, color, tokens, isDark }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : tokens.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
        <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? '#F8FAFC' : tokens.textPrimary }}>{label}</Text>
      </View>
      <Text style={{ fontSize: 15, fontWeight: '800', color: isDark ? '#F8FAFC' : tokens.textPrimary, fontVariant: ['tabular-nums'] }}>
        {count}
      </Text>
    </View>
  );
}

function ChannelBar({ label, amount, pct, color, tokens, isDark }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#F8FAFC' : tokens.textPrimary }}>{label}</Text>
        <Text style={{ fontSize: 13, fontWeight: '800', color: isDark ? '#F8FAFC' : tokens.textPrimary, fontVariant: ['tabular-nums'] }}>
          {formatPeso(amount)}{'  '}
          <Text style={{ fontWeight: '700', color: isDark ? '#94A3B8' : tokens.textMuted }}>{pct}%</Text>
        </Text>
      </View>
      <View
        style={{
          height: 8,
          borderRadius: 4,
          backgroundColor: isDark ? '#1A2320' : '#F1F5F9',
          overflow: 'hidden',
        }}
      >
        <View style={{ height: '100%', width: `${Math.max(2, pct)}%`, backgroundColor: color, borderRadius: 4 }} />
      </View>
    </View>
  );
}

function ProductRow({ item, tokens, isDark, tone = 'good' }) {
  const accent = tone === 'good' ? (isDark ? '#4ADE80' : '#10B981') : isDark ? '#FBBF24' : '#D97706';
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : tokens.border,
        gap: 10,
      }}
    >
      <View style={{ width: 4, height: 28, borderRadius: 2, backgroundColor: accent }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#F8FAFC' : tokens.textPrimary }} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : tokens.textMuted, marginTop: 1 }}>
          {item.unitsSold} units · {formatPeso(item.revenue)}
        </Text>
      </View>
    </View>
  );
}

/**
 * @param {object} props
 * @param {object} props.insights - from buildDashboardInsights
 * @param {Array} [props.orders] - raw orders array (optional fallback)
 * @param {function} props.onNavigate - (navKey, opts?) => void
 * @param {boolean} props.isDesktop
 * @param {boolean} props.isDarkMode
 * @param {object} props.tokens
 */
export default function DashboardInsightsPanel({
  insights,
  orders,
  onNavigate,
  isDesktop = true,
  isDarkMode = false,
  tokens,
}) {
  const isDark = Boolean(isDarkMode);
  const [chartGranularity, setChartGranularity] = useState('daily');

  if (!insights || !tokens) return null;

  const sp = insights.salesPerformance || {};
  const inv = insights.inventoryHealth || {};
  const ch = insights.salesByChannel || {};
  const pp = insights.productPerformance || { bestSelling: [], slowMoving: [] };
  const actions = insights.actionRequired || [];

  const trendData = useMemo(() => {
    if (insights?.revenueTrends?.[chartGranularity]) {
      return insights.revenueTrends[chartGranularity];
    }
    const orderList = orders || insights?.orders || [];
    return aggregateSalesTrend(orderList, chartGranularity);
  }, [insights, orders, chartGranularity]);

  const periodSelector = (
    <View
      style={{
        position: 'relative',
        flexDirection: 'row',
        backgroundColor: isDarkMode ? '#151C19' : '#F1F5F9',
        borderRadius: 9,
        padding: 3,
        borderWidth: 1,
        borderColor: isDarkMode ? (tokens?.border || '#26332E') : '#E2E8F0',
        width: isDesktop ? 220 : '100%',
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
          backgroundColor: '#EA580C',
          borderRadius: 6,
          boxShadow: '0 1px 4px rgba(234, 88, 12, 0.35)',
          transition: 'transform 220ms cubic-bezier(0.4, 0, 0.2, 1)',
          transform:
            chartGranularity === 'daily'
              ? 'translateX(0%)'
              : chartGranularity === 'weekly'
              ? 'translateX(100%)'
              : 'translateX(200%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      {[
        { id: 'daily', label: 'Daily' },
        { id: 'weekly', label: 'Weekly' },
        { id: 'monthly', label: 'Monthly' },
      ].map((tab) => {
        const active = chartGranularity === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            onPress={() => setChartGranularity(tab.id)}
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
                fontSize: 11.5,
                fontWeight: active ? '700' : '600',
                color: active
                  ? '#FFFFFF'
                  : (isDarkMode ? '#94A3B8' : '#64748B'),
                transition: 'color 200ms ease',
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
    <View style={{ marginBottom: 24, gap: 16 }}>
      {/* A. Sales Performance Summary */}
      <SectionCard
        title="Sales Performance"
        subtitle="Compare revenue metrics and track order performance across periods"
        headerRight={periodSelector}
        tokens={tokens}
        isDark={isDarkMode}
      >
        {/* 4 Redesigned Sales KPI Cards */}
        <View
          style={{
            flexDirection: isDesktop ? 'row' : 'column',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <SalesMetricCard
            label="Today's Sales"
            value={formatPeso(sp.todaySales)}
            sublabel={`${sp.todayOrderCount || 0} order${sp.todayOrderCount === 1 ? '' : 's'}`}
            compare={sp.todayCompare}
            iconName="calendar2-check"
            iconBg={isDarkMode ? 'rgba(22, 163, 74, 0.16)' : '#ECFDF5'}
            iconColor={isDarkMode ? '#4ADE80' : '#059669'}
            tokens={tokens}
            isDark={isDarkMode}
          />
          <SalesMetricCard
            label="This Week's Sales"
            value={formatPeso(sp.weekSales)}
            sublabel={`${sp.weekOrderCount || 0} order${sp.weekOrderCount === 1 ? '' : 's'}`}
            compare={sp.weekCompare}
            iconName="graph-up-arrow"
            iconBg={isDarkMode ? 'rgba(37, 99, 235, 0.16)' : '#F0F9FF'}
            iconColor={isDarkMode ? '#60A5FA' : '#0284C7'}
            tokens={tokens}
            isDark={isDarkMode}
          />
          <SalesMetricCard
            label="This Month's Sales"
            value={formatPeso(sp.monthSales)}
            sublabel={`${sp.monthOrderCount || 0} order${sp.monthOrderCount === 1 ? '' : 's'}`}
            compare={sp.monthCompare}
            iconName="cash-stack"
            iconBg={isDarkMode ? 'rgba(124, 58, 237, 0.16)' : '#EEF2FF'}
            iconColor={isDarkMode ? '#A78BFA' : '#4F46E5'}
            tokens={tokens}
            isDark={isDarkMode}
          />
          <SalesMetricCard
            label="Average Order Value"
            value={formatPeso(sp.averageOrderValue)}
            sublabel={`${sp.totalOrderCount || (orders?.length || 0)} orders`}
            compare={sp.aovCompare}
            iconName="receipt"
            iconBg={isDarkMode ? 'rgba(217, 119, 6, 0.16)' : '#FFFBEB'}
            iconColor={isDarkMode ? '#FBBF24' : '#D97706'}
            tokens={tokens}
            isDark={isDarkMode}
          />
        </View>

        {/* Revenue Trend Chart */}
        <SalesRevenueTrendChart
          data={trendData}
          granularity={chartGranularity}
          isDark={isDarkMode}
          isDesktop={isDesktop}
          tokens={tokens}
        />
      </SectionCard>

      {/* B + C + D row */}
      <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 16, alignItems: 'stretch' }}>
        <SectionCard
          title="Inventory Health"
          subtitle="Stock status across catalog"
          actionLabel="View Inventory →"
          onAction={() => onNavigate?.('inventory')}
          tokens={tokens}
          isDark={isDarkMode}
          style={{ minWidth: isDesktop ? 220 : '100%' }}
        >
          <HealthRow label="Healthy Stock" count={inv.healthy || 0} color="#10B981" tokens={tokens} isDark={isDarkMode} />
          <HealthRow label="Low Stock" count={inv.low || 0} color="#D97706" tokens={tokens} isDark={isDarkMode} />
          <HealthRow label="Out of Stock" count={inv.out || 0} color="#DC2626" tokens={tokens} isDark={isDarkMode} />
          <HealthRow label="Overstocked" count={inv.overstocked || 0} color="#2563EB" tokens={tokens} isDark={isDarkMode} />
        </SectionCard>

        <SectionCard
          title="Action Required"
          subtitle="Items that need admin attention"
          tokens={tokens}
          isDark={isDarkMode}
          style={{ flex: 1.2, minWidth: isDesktop ? 260 : '100%' }}
        >
          {actions.length === 0 ? (
            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
              <BootstrapIcon name="check-circle-fill" size={22} color={isDarkMode ? '#4ADE80' : '#10B981'} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#F8FAFC' : tokens.textPrimary, marginTop: 8 }}>
                All clear
              </Text>
              <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : tokens.textMuted, marginTop: 2, textAlign: 'center' }}>
                No critical inventory or order actions right now.
              </Text>
            </View>
          ) : (
            actions.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() =>
                  onNavigate?.(item.nav, {
                    filter: item.filter,
                    productId: item.productId,
                  })
                }
                activeOpacity={0.75}
                style={{
                  flexDirection: 'row',
                  gap: 10,
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : tokens.border,
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: item.color,
                    marginTop: 5,
                  }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#F8FAFC' : tokens.textPrimary }}>
                    {item.title}
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: item.color, marginTop: 3 }}>
                    {item.actionLabel}
                  </Text>
                </View>
                <BootstrapIcon name="chevron-right" size={14} color={isDark ? '#94A3B8' : tokens.textMuted} />
              </TouchableOpacity>
            ))
          )}
        </SectionCard>

        <SectionCard
          title="Sales by Channel"
          subtitle="Online Store vs POS Cashier"
          tokens={tokens}
          isDark={isDarkMode}
          style={{ minWidth: isDesktop ? 220 : '100%' }}
        >
          {(ch.total || 0) <= 0 ? (
            <Text style={{ fontSize: 13, color: isDark ? '#94A3B8' : tokens.textMuted }}>No sales recorded yet.</Text>
          ) : (
            <>
              <ChannelBar
                label="Online Store"
                amount={ch.online}
                pct={ch.onlinePct}
                color={isDarkMode ? '#4ADE80' : '#059669'}
                tokens={tokens}
                isDark={isDarkMode}
              />
              <ChannelBar
                label="POS Cashier"
                amount={ch.pos}
                pct={ch.posPct}
                color={isDarkMode ? '#60A5FA' : '#2563EB'}
                tokens={tokens}
                isDark={isDarkMode}
              />
              <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : tokens.textMuted, marginTop: 4 }}>
                Total {formatPeso(ch.total)}
              </Text>
            </>
          )}
        </SectionCard>
      </View>

      {/* E. Product Performance */}
      <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 16 }}>
        <SectionCard
          title="Best Selling Products"
          subtitle="Highest revenue from fulfilled sales"
          actionLabel="View products →"
          onAction={() => onNavigate?.('products')}
          tokens={tokens}
          isDark={isDarkMode}
        >
          {(!pp.bestSelling || pp.bestSelling.length === 0) ? (
            <Text style={{ fontSize: 13, color: isDark ? '#94A3B8' : tokens.textMuted }}>No product sales yet.</Text>
          ) : (
            pp.bestSelling.map((item) => (
              <ProductRow key={`best-${item.productId || item.name}`} item={item} tokens={tokens} isDark={isDarkMode} tone="good" />
            ))
          )}
        </SectionCard>

        <SectionCard
          title="Slow-Moving Products"
          subtitle="Low units sold — review promo or pricing"
          actionLabel="View forecast →"
          onAction={() => onNavigate?.('forecast')}
          tokens={tokens}
          isDark={isDarkMode}
        >
          {(!pp.slowMoving || pp.slowMoving.length === 0) ? (
            <Text style={{ fontSize: 13, color: isDark ? '#94A3B8' : tokens.textMuted }}>
              Not enough catalog history to identify slow movers.
            </Text>
          ) : (
            pp.slowMoving.map((item) => (
              <ProductRow key={`slow-${item.productId || item.name}`} item={item} tokens={tokens} isDark={isDarkMode} tone="warn" />
            ))
          )}
        </SectionCard>
      </View>
    </View>
  );
}

/** Build SVG sparkline path from real weekly revenue bars */
export function buildSparklinePath(bars = [], width = 320, height = 96) {
  if (!bars.length) return { line: '', area: '' };
  const max = Math.max(...bars, 1);
  const step = width / Math.max(bars.length - 1, 1);
  const pts = bars.map((v, i) => {
    const x = i * step;
    const y = height - 12 - (v / max) * (height - 28);
    return { x, y };
  });
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
  const area = `${line} L ${width},${height} L 0,${height} Z`;
  return { line, area, last: pts[pts.length - 1] };
}
