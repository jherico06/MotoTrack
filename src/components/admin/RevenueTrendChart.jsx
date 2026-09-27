import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Platform, TouchableOpacity } from 'react-native';

/**
 * RevenueTrendChart — Unified with the Sales Forecast chart design system.
 * Features:
 * - Smooth area chart with #1D4533 Road Teal gradient
 * - Weekly average dashed benchmark line
 * - Interactive data point nodes with hover/click crosshair
 * - Floating tooltip showing exact currency value & performance vs. average
 * - Period selector tabs [4W, 12W, 24W]
 * - Legend with quick telemetry chips (Total, Average, Peak)
 */
export default function RevenueTrendChart({
  data = [],
  period = '12W',
  onPeriodChange,
  isDark = false,
  isDesktop = true,
  title = 'Revenue Trend',
  subtitle = 'Weekly revenue trends across online storefront & in-store POS channels',
}) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  // Theme tokens
  const colors = useMemo(() => {
    if (isDark) {
      return {
        cardBg: '#161820',
        border: '#272930',
        textPrimary: '#F8FAFC',
        textMuted: '#94A3B8',
        gridLine: '#334155',
        primary: '#1D4533',
        primarySoft: 'rgba(29, 69, 51, 0.45)',
        tabBg: '#1E293B',
        tabBorder: '#334155',
        chipBg: '#1E293B',
        tooltipBg: '#1E293B',
        tooltipBorder: '#334155',
      };
    }
    return {
      cardBg: '#FFFFFF',
      border: '#E2E8F0',
      textPrimary: '#0F172A',
      textMuted: '#64748B',
      gridLine: '#E2E8F0',
      primary: '#1D4533',
      primarySoft: 'rgba(29, 69, 51, 0.18)',
      tabBg: '#F1F5F9',
      tabBorder: '#E2E8F0',
      chipBg: '#F8FAFC',
      tooltipBg: '#FFFFFF',
      tooltipBorder: '#CBD5E1',
    };
  }, [isDark]);

  // Compute metrics and layout
  const {
    chartWidth,
    chartHeight,
    pad,
    points,
    maxRev,
    niceMax,
    yTicks,
    totalRev,
    avgRev,
    peakRev,
    peakLabel,
    avgY,
    linePath,
    areaPath,
  } = useMemo(() => {
    const rawList = Array.isArray(data) && data.length > 0 ? data : [];
    const len = Math.max(rawList.length, 2);

    // Calculate dynamic dimensions
    const cWidth = isDesktop ? Math.max(760, len * 58) : Math.max(560, len * 48);
    const cHeight = isDesktop ? 250 : 220;
    const padding = { top: 24, right: 28, bottom: 38, left: 62 };

    const gW = cWidth - padding.left - padding.right;
    const gH = cHeight - padding.top - padding.bottom;

    const revenues = rawList.map((d) => Number(d.revenue) || 0);
    const total = revenues.reduce((acc, v) => acc + v, 0);
    const avg = revenues.length > 0 ? total / revenues.length : 0;
    const max = Math.max(...revenues, 100);

    // Nice round tick numbers for Y-axis (e.g. 500, 1000, 1500, 2000)
    const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
    const ratio = max / magnitude;
    let factor = 1.2;
    if (ratio <= 1.2) factor = 1.5;
    else if (ratio <= 2) factor = 2.5;
    else if (ratio <= 5) factor = 6;
    else factor = 12;
    const roundedMax = Math.ceil((max * 1.1) / (magnitude / 2)) * (magnitude / 2) || 1000;

    // 5 ticks: 0%, 25%, 50%, 75%, 100%
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(roundedMax * f));

    // Peak calculation
    let peakVal = 0;
    let peakName = '—';
    rawList.forEach((d) => {
      const rev = Number(d.revenue) || 0;
      if (rev > peakVal) {
        peakVal = rev;
        peakName = d.label || '';
      }
    });

    // Map each data point to X, Y
    const pts = rawList.map((d, i) => {
      const x = padding.left + (i / Math.max(1, len - 1)) * gW;
      const rev = Number(d.revenue) || 0;
      const y = padding.top + gH - (rev / roundedMax) * gH;
      return {
        index: i,
        label: d.label || `W${i + 1}`,
        revenue: rev,
        x,
        y,
      };
    });

    // Average line Y coordinate
    const averageY = padding.top + gH - (avg / roundedMax) * gH;

    // Build smooth Bezier spline line and area paths
    let lPath = '';
    let aPath = '';
    if (pts.length > 0) {
      lPath = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i === 0 ? 0 : i - 1];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[i + 2 >= pts.length ? pts.length - 1 : i + 2];

        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;

        lPath += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
      }
      const baseline = padding.top + gH;
      aPath = `${lPath} L ${pts[pts.length - 1].x.toFixed(1)},${baseline.toFixed(1)} L ${pts[0].x.toFixed(1)},${baseline.toFixed(1)} Z`;
    }

    return {
      chartWidth: cWidth,
      chartHeight: cHeight,
      pad: padding,
      points: pts,
      maxRev: max,
      niceMax: roundedMax,
      yTicks: ticks,
      totalRev: total,
      avgRev: avg,
      peakRev: peakVal,
      peakLabel: peakName,
      avgY: averageY,
      linePath: lPath,
      areaPath: aPath,
    };
  }, [data, isDesktop]);

  const activePoint = hoveredIdx != null && points[hoveredIdx] ? points[hoveredIdx] : null;

  // Difference vs average
  const activeDiff = activePoint ? activePoint.revenue - avgRev : 0;
  const activeDiffPct =
    avgRev > 0 ? Math.round((Math.abs(activeDiff) / avgRev) * 100) : 0;

  return (
    <View
      style={{
        backgroundColor: colors.cardBg,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: colors.border,
        padding: 22,
        marginBottom: 24,
        shadowColor: isDark ? '#000000' : 'rgba(15, 23, 42, 0.08)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      {/* Card Header Row: Title & Period Tabs */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 14,
        }}
      >
        <View style={{ flex: 1, minWidth: 240 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: '800',
              color: colors.textPrimary,
              letterSpacing: -0.2,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: colors.textMuted,
              marginTop: 3,
              lineHeight: 17,
            }}
          >
            {subtitle}
          </Text>
        </View>

        {/* Period Tabs: 4W / 12W / 24W */}
        {onPeriodChange && (
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: colors.tabBg,
              borderRadius: 10,
              padding: 3,
              borderWidth: 1,
              borderColor: colors.tabBorder,
              gap: 4,
            }}
          >
            {['4W', '12W', '24W'].map((p) => {
              const active = period === p;
              return (
                <TouchableOpacity
                  key={p}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                    backgroundColor: active ? colors.primary : 'transparent',
                  }}
                  onPress={() => onPeriodChange(p)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={{
                      fontSize: 11.5,
                      fontWeight: '700',
                      color: active ? '#FFFFFF' : colors.textMuted,
                    }}
                  >
                    {p}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* Legend & Telemetry Bar */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          marginBottom: 16,
        }}
      >
        {/* Legend */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{
                width: 16,
                height: 3,
                borderRadius: 2,
                backgroundColor: colors.primary,
              }}
            />
            <Text style={{ fontSize: 11.5, fontWeight: '600', color: colors.textMuted }}>
              Actual Revenue
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{
                width: 16,
                height: 0,
                borderTopWidth: 2,
                borderTopColor: colors.textMuted,
                borderStyle: 'dashed',
              }}
            />
            <Text style={{ fontSize: 11.5, fontWeight: '600', color: colors.textMuted }}>
              Weekly Average (₱{Math.round(avgRev).toLocaleString()})
            </Text>
          </View>
        </View>

        {/* Quick Telemetry Summary Pills */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.chipBg,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 5,
            }}
          >
            <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '500' }}>
              Period Total:
            </Text>
            <Text style={{ fontSize: 11.5, fontWeight: '800', color: colors.textPrimary }}>
              ₱{totalRev.toLocaleString()}
            </Text>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.chipBg,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 5,
            }}
          >
            <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '500' }}>
              Peak:
            </Text>
            <Text style={{ fontSize: 11.5, fontWeight: '800', color: colors.primary }}>
              ₱{peakRev.toLocaleString()}{peakLabel ? ` (${peakLabel})` : ''}
            </Text>
          </View>
        </View>
      </View>

      {/* SVG Chart Container with ScrollView for responsiveness */}
      <View style={{ width: '100%', position: 'relative' }}>
        {/* Floating Tooltip */}
        {activePoint && Platform.OS === 'web' && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: Math.min(
                Math.max(activePoint.x - 70, 8),
                Math.max(chartWidth - 170, 8)
              ),
              top: Math.max(activePoint.y - 82, 6),
              zIndex: 30,
              backgroundColor: colors.tooltipBg,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 10,
              minWidth: 155,
              borderWidth: 1,
              borderColor: colors.tooltipBorder,
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
            }}
          >
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: 12.5,
                fontWeight: '800',
                marginBottom: 4,
              }}
            >
              Week {activePoint.index + 1} ({activePoint.label})
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: colors.primary,
                }}
              />
              <Text style={{ fontSize: 12, fontWeight: '500', color: colors.textMuted }}>
                Revenue:{' '}
                <Text style={{ fontWeight: '800', color: colors.primary }}>
                  ₱{activePoint.revenue.toLocaleString()}
                </Text>
              </Text>
            </View>
            <Text
              style={{
                fontSize: 10.5,
                fontWeight: '600',
                color:
                  activeDiff > 0
                    ? '#1D4533'
                    : activeDiff < 0
                    ? '#D97706'
                    : colors.textMuted,
              }}
            >
              {activeDiff > 0
                ? `▲ +₱${Math.round(activeDiff).toLocaleString()} (+${activeDiffPct}%) vs avg`
                : activeDiff < 0
                ? `▼ -₱${Math.round(Math.abs(activeDiff)).toLocaleString()} (-${activeDiffPct}%) vs avg`
                : 'Exactly at weekly average'}
            </Text>
          </View>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ width: '100%' }}
          contentContainerStyle={{ minWidth: '100%' }}
        >
          {Platform.OS === 'web' ? (
            <div style={{ width: '100%', minWidth: chartWidth, height: chartHeight }}>
              <svg
                width="100%"
                height={chartHeight}
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                preserveAspectRatio="none"
                style={{ display: 'block' }}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <defs>
                  <linearGradient id="revAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1D4533" stopOpacity={isDark ? 0.45 : 0.3} />
                    <stop offset="100%" stopColor="#1D4533" stopOpacity={0.0} />
                  </linearGradient>
                </defs>

                {/* Horizontal Gridlines and Y-axis Currency Labels */}
                {yTicks.map((tick, i) => {
                  const y = pad.top + (chartHeight - pad.top - pad.bottom) * (1 - tick / niceMax);
                  return (
                    <g key={`yt-${i}`}>
                      <line
                        x1={pad.left}
                        y1={y}
                        x2={chartWidth - pad.right}
                        y2={y}
                        stroke={colors.gridLine}
                        strokeWidth="1"
                        strokeDasharray={tick > 0 ? '4 4' : undefined}
                      />
                      <text
                        x={pad.left - 10}
                        y={y + 4}
                        textAnchor="end"
                        fontSize="11"
                        fill={colors.textMuted}
                        fontFamily="'Plus Jakarta Sans', sans-serif"
                        fontWeight="500"
                      >
                        ₱{tick.toLocaleString()}
                      </text>
                    </g>
                  );
                })}

                {/* Area Gradient Fill */}
                {areaPath ? <path d={areaPath} fill="url(#revAreaGradient)" /> : null}

                {/* Dashed Average Benchmark Line */}
                {avgY >= pad.top && avgY <= chartHeight - pad.bottom && (
                  <line
                    x1={pad.left}
                    y1={avgY}
                    x2={chartWidth - pad.right}
                    y2={avgY}
                    stroke={colors.textMuted}
                    strokeWidth="1.5"
                    strokeDasharray="5 4"
                    opacity="0.75"
                  />
                )}

                {/* Solid Spline Curve Line */}
                {linePath ? (
                  <path
                    d={linePath}
                    fill="none"
                    stroke={colors.primary}
                    strokeWidth="2.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null}

                {/* Active Hover Crosshair Vertical Line */}
                {activePoint && (
                  <line
                    x1={activePoint.x}
                    y1={pad.top}
                    x2={activePoint.x}
                    y2={chartHeight - pad.bottom}
                    stroke={colors.primary}
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    opacity="0.65"
                  />
                )}

                {/* Data Points and X-Axis Labels */}
                {points.map((p, idx) => {
                  const isHovered = hoveredIdx === idx;
                  return (
                    <g key={`pt-${idx}`}>
                      {/* Active Point Halo Ring */}
                      {isHovered && (
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r="12"
                          fill={colors.primary}
                          opacity="0.18"
                        />
                      )}

                      {/* Point Circle */}
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={isHovered ? 6 : 4.5}
                        fill={colors.primary}
                        stroke={colors.cardBg}
                        strokeWidth="2.5"
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={() => setHoveredIdx(idx)}
                        onClick={() => setHoveredIdx(idx)}
                      />

                      {/* X-Axis Week Label */}
                      <text
                        x={p.x}
                        y={chartHeight - 12}
                        textAnchor="middle"
                        fontSize="11"
                        fill={isHovered ? colors.primary : colors.textMuted}
                        fontWeight={isHovered ? '800' : '600'}
                        fontFamily="'Plus Jakarta Sans', sans-serif"
                      >
                        {p.label}
                      </text>
                    </g>
                  );
                })}

                {/* Invisible Hover Rectangles spanning each column for effortless hover */}
                {points.map((p, idx) => {
                  const colW =
                    (chartWidth - pad.left - pad.right) / Math.max(1, points.length - 1);
                  const xStart = idx === 0 ? pad.left : p.x - colW / 2;
                  const rectW =
                    idx === 0 || idx === points.length - 1 ? colW / 2 : colW;
                  return (
                    <rect
                      key={`hit-${idx}`}
                      x={xStart}
                      y={pad.top}
                      width={rectW}
                      height={chartHeight - pad.top - pad.bottom}
                      fill="transparent"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredIdx(idx)}
                      onClick={() => setHoveredIdx(idx)}
                    />
                  );
                })}
              </svg>
            </div>
          ) : (
            /* Native Fallback View */
            <View
              style={{
                width: chartWidth,
                height: chartHeight,
                flexDirection: 'row',
                alignItems: 'flex-end',
                paddingHorizontal: 8,
                paddingBottom: 28,
                gap: 6,
              }}
            >
              {points.map((p, idx) => {
                const barH = Math.max(8, (p.revenue / niceMax) * (chartHeight - 50));
                return (
                  <View
                    key={idx}
                    style={{ flex: 1, alignItems: 'center', minWidth: 24 }}
                  >
                    <Text
                      style={{
                        fontSize: 9,
                        color: colors.textMuted,
                        marginBottom: 4,
                        fontWeight: '700',
                      }}
                    >
                      ₱{Math.round(p.revenue / 1000)}k
                    </Text>
                    <View
                      style={{
                        width: '70%',
                        height: barH,
                        borderRadius: 6,
                        backgroundColor: colors.primary,
                      }}
                    />
                    <Text
                      style={{
                        fontSize: 10,
                        color: colors.textMuted,
                        marginTop: 6,
                        fontWeight: '600',
                      }}
                    >
                      {p.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}
