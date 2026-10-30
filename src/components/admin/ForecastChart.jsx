import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Platform } from 'react-native';
import { getForecastTokens } from '../../styles/forecast.styles.js';

/**
 * Historical Demand & Forecast Chart
 * Matches the reference design:
 * - Blue solid line + dots: Actual Sales (#2563EB)
 * - Orange dashed line + dots: Forecast (#EA580C)
 * - Gray dashed line: Simple Linear Regression Line (Y = a + bX)
 * - Vertical dashed separator: "Forecast Period"
 * - Clean Y-axis grid lines (0, 50, 100, 150, 200...)
 * - Subsampled, human-readable X-axis tick labels (no clutter or overlap)
 * - Interactive hover guideline & detailed tooltip
 */
export default function ForecastChart({
  chartPoints = [],
  trendLine = [],
  isDark = false,
  height = 280,
  periodType = 'month',
}) {
  const t = getForecastTokens(isDark);
  const actualColor = '#2563EB';
  const forecastColor = '#EA580C';
  const regressionColor = '#94A3B8';
  const gridColor = isDark ? '#2E3236' : '#F1F5F9';

  const [hover, setHover] = useState(null);

  const {
    width,
    points,
    trendPts,
    maxY,
    yTicks,
    pad,
    dividerX,
    visibleTicks,
    pointRadius,
    strokeW,
  } = useMemo(() => {
    const n = Math.max(chartPoints.length, 2);
    // Dynamic width allocation giving each point sufficient horizontal space
    const stepPx = n > 50 ? 14 : n > 25 ? 24 : 48;
    const w = Math.max(700, Math.min(1400, n * stepPx));
    const padLocal = { top: 26, right: 36, bottom: 40, left: 46 };
    const gW = w - padLocal.left - padLocal.right;
    const gH = height - padLocal.top - padLocal.bottom;

    const allValues = [
      ...chartPoints.map((p) => p.actual).filter((v) => v != null),
      ...chartPoints.map((p) => p.forecast).filter((v) => v != null),
      ...trendLine.map((p) => p.y).filter((v) => v != null),
      1,
    ];
    const rawMax = Math.max(...allValues);

    // Calculate clean, rounded Y-axis ticks like 0, 50, 100, 150, 200 or 0, 5, 10, 15, 20
    let step = 50;
    if (rawMax <= 20) step = 5;
    else if (rawMax <= 50) step = 10;
    else if (rawMax <= 100) step = 25;
    else if (rawMax <= 250) step = 50;
    else if (rawMax <= 500) step = 100;
    else step = Math.ceil(rawMax / 4 / 50) * 50;

    const maxTicksCount = 4;
    const topTick = Math.max(step * maxTicksCount, Math.ceil(rawMax / step) * step);
    const ticks = [];
    for (let val = 0; val <= topTick; val += step) {
      ticks.push(val);
    }
    const max = topTick || 1;
    const lastX = chartPoints[chartPoints.length - 1]?.x || n;

    const toXY = (xIndex, y) => {
      const x = padLocal.left + ((xIndex - 1) / Math.max(1, lastX - 1)) * gW;
      const yy = padLocal.top + gH - (Math.max(0, y) / max) * gH;
      return { x, y: yy };
    };

    const mapped = chartPoints.map((p, idx) => ({
      ...p,
      idx,
      actualPt: p.actual != null ? toXY(p.x, p.actual) : null,
      forecastPt: p.forecast != null ? toXY(p.x, p.forecast) : null,
      fittedPt: p.fitted != null ? toXY(p.x, p.fitted) : null,
    }));

    const firstForecast = mapped.find((p) => p.forecast != null && p.actual == null);
    const lastActual = [...mapped].reverse().find((p) => p.actual != null);
    let sepX = null;
    if (firstForecast?.forecastPt && lastActual?.actualPt) {
      sepX = (lastActual.actualPt.x + firstForecast.forecastPt.x) / 2;
    } else if (firstForecast?.forecastPt) {
      sepX = firstForecast.forecastPt.x;
    }

    // Adaptive circle radius: dense series (daily/weekly) have small radii to prevent blob clusters
    const pRadius = n > 50 ? 1.5 : n > 25 ? 2.5 : 4;
    const sWidth = n > 50 ? 1 : n > 25 ? 1.5 : 2;

    // Subsample X-axis ticks to a max of 6 to 8 nicely spaced ticks across the canvas
    let selectedIndices = [];
    if (mapped.length <= 8) {
      selectedIndices = mapped.map((_, i) => i);
    } else {
      const targetCount = Math.max(4, Math.min(8, Math.floor(gW / 85)));
      const stepIdx = (mapped.length - 1) / (targetCount - 1);
      const set = new Set();
      set.add(0);
      for (let i = 1; i < targetCount - 1; i += 1) {
        set.add(Math.round(i * stepIdx));
      }
      set.add(mapped.length - 1);
      selectedIndices = Array.from(set).sort((a, b) => a - b);
    }

    const visibleTicksList = selectedIndices
      .map((idx) => mapped[idx])
      .filter(Boolean)
      .map((p, tickOrder, arr) => {
        const xPos = (p.actualPt || p.forecastPt)?.x ?? padLocal.left;
        const prev = tickOrder > 0 ? arr[tickOrder - 1] : null;
        const labelParts = getCleanXAxisLabel(p, periodType, prev);
        return {
          ...labelParts,
          x: xPos,
          key: `tick-${p.key || p.x || tickOrder}`,
        };
      });

    return {
      width: w,
      points: mapped,
      trendPts: trendLine.map((p) => toXY(p.x, p.y)),
      maxY: max,
      yTicks: ticks,
      pad: padLocal,
      dividerX: sepX,
      visibleTicks: visibleTicksList,
      pointRadius: pRadius,
      strokeW: sWidth,
    };
  }, [chartPoints, trendLine, height, periodType]);

  const poly = (pts) => pts.map((p) => `${p.x},${p.y}`).join(' ');

  const actualPath = points.filter((p) => p.actualPt).map((p) => p.actualPt);
  const forecastPath = points.filter((p) => p.forecastPt).map((p) => p.forecastPt);
  // Bridge the last actual point to the first forecast point so the line is continuous
  const forecastBridge =
    actualPath.length && forecastPath.length
      ? [actualPath[actualPath.length - 1], ...forecastPath]
      : forecastPath;

  const baselineY = height - pad.bottom;

  const onHoverPoint = (p, chartX, chartY) => {
    if (!p) {
      setHover(null);
      return;
    }
    const actual = p.actual != null ? p.actual : null;
    const forecast = p.forecast != null ? p.forecast : null;
    const fitted = p.fitted != null ? p.fitted : null;
    setHover({
      title: formatTooltipDate(p, periodType),
      label: p.label || (periodType === 'month' ? `Month ${p.x}` : `Period ${p.x}`),
      periodNum: p.x,
      actual,
      forecast,
      fitted,
      x: chartX,
      y: chartY,
    });
  };

  const svg = (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block', overflow: 'visible' }}
      onMouseLeave={() => setHover(null)}
    >
      {/* Horizontal Y-axis gridlines & tick values */}
      {yTicks.map((tick) => {
        const y = pad.top + (height - pad.top - pad.bottom) * (1 - tick / maxY);
        return (
          <g key={`yt-${tick}`}>
            <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke={gridColor} strokeWidth="1" />
            <text
              x={pad.left - 10}
              y={y + 4}
              textAnchor="end"
              fontSize="11"
              fontWeight="400"
              fill={t.mutedForeground}
            >
              {tick}
            </text>
          </g>
        );
      })}

      {/* Units label at top of Y-axis */}
      <text
        x={pad.left - 10}
        y={pad.top - 8}
        textAnchor="end"
        fontSize="11"
        fontWeight="500"
        fill={t.mutedForeground}
      >
        Units
      </text>

      {/* Regression Line: Light gray dashed line spanning across */}
      {trendPts.length > 1 && (
        <polyline
          points={poly(trendPts)}
          fill="none"
          stroke={regressionColor}
          strokeWidth="1.75"
          strokeDasharray="5 4"
          opacity="0.85"
        />
      )}

      {/* Vertical separator & Top Dimension Line: Forecast Period */}
      {dividerX != null && dividerX < width - pad.right && (
        <g>
          {/* Vertical dashed separator */}
          <line
            x1={dividerX}
            y1={pad.top}
            x2={dividerX}
            y2={baselineY}
            stroke={regressionColor}
            strokeWidth="1.25"
            strokeDasharray="3 3"
            opacity="0.8"
          />

          {/* Top bracket / dimension line across forecast horizon */}
          {(() => {
            const rightEdge = width - pad.right;
            const midX = (dividerX + rightEdge) / 2;
            const lineY = pad.top + 8;
            return (
              <g>
                <line
                  x1={dividerX + 2}
                  y1={lineY}
                  x2={midX - 44}
                  y2={lineY}
                  stroke={regressionColor}
                  strokeWidth="1"
                  opacity="0.75"
                />
                <polygon
                  points={`${dividerX + 4},${lineY} ${dividerX + 9},${lineY - 3} ${dividerX + 9},${lineY + 3}`}
                  fill={regressionColor}
                  opacity="0.75"
                />
                <text
                  x={midX}
                  y={lineY + 3.5}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="500"
                  fill={t.mutedForeground}
                >
                  Forecast Period
                </text>
                <line
                  x1={midX + 44}
                  y1={lineY}
                  x2={rightEdge - 2}
                  y2={lineY}
                  stroke={regressionColor}
                  strokeWidth="1"
                  opacity="0.75"
                />
                <polygon
                  points={`${rightEdge - 4},${lineY} ${rightEdge - 9},${lineY - 3} ${rightEdge - 9},${lineY + 3}`}
                  fill={regressionColor}
                  opacity="0.75"
                />
              </g>
            );
          })()}
        </g>
      )}

      {/* Solid Blue Line: Actual historical sales */}
      {actualPath.length > 1 && (
        <polyline
          points={poly(actualPath)}
          fill="none"
          stroke={actualColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Dashed Orange Line: Forecast demand */}
      {forecastBridge.length > 1 && (
        <polyline
          points={poly(forecastBridge)}
          fill="none"
          stroke={forecastColor}
          strokeWidth="2.25"
          strokeDasharray="5 4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Hover Guideline crosshair line */}
      {hover && hover.x != null && (
        <line
          x1={hover.x}
          y1={pad.top}
          x2={hover.x}
          y2={baselineY}
          stroke={regressionColor}
          strokeWidth="1.25"
          strokeDasharray="3 3"
          opacity="0.8"
        />
      )}

      {/* Data points */}
      {points.map((p) => {
        const isForecast = p.forecast != null && p.actual == null;
        const isHovered = hover && hover.periodNum === p.x;
        const r = isHovered ? Math.max(pointRadius + 2.5, 5.5) : pointRadius;

        return (
          <g key={p.key || p.x}>
            {/* Actual Sales Dots (Blue) */}
            {p.actualPt && (
              <circle
                cx={p.actualPt.x}
                cy={p.actualPt.y}
                r={r}
                fill={actualColor}
                stroke={isHovered ? '#FFFFFF' : t.card}
                strokeWidth={isHovered ? 2 : strokeW}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => onHoverPoint(p, p.actualPt.x, p.actualPt.y)}
                onClick={() => onHoverPoint(p, p.actualPt.x, p.actualPt.y)}
              />
            )}

            {/* Forecast Dots (Orange) */}
            {p.forecastPt && isForecast && (
              <circle
                cx={p.forecastPt.x}
                cy={p.forecastPt.y}
                r={r}
                fill={forecastColor}
                stroke={isHovered ? '#FFFFFF' : t.card}
                strokeWidth={isHovered ? 2 : strokeW}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => onHoverPoint(p, p.forecastPt.x, p.forecastPt.y)}
                onClick={() => onHoverPoint(p, p.forecastPt.x, p.forecastPt.y)}
              />
            )}
          </g>
        );
      })}

      {/* Subsampled, Clean X-axis tick labels (No overlap, spacious, easy to read) */}
      {visibleTicks.map((tick) => {
        return (
          <g key={tick.key}>
            {/* Small vertical tick line */}
            <line
              x1={tick.x}
              y1={baselineY}
              x2={tick.x}
              y2={baselineY + 4}
              stroke={isDark ? '#3E444B' : '#CBD5E1'}
              strokeWidth="1"
            />
            {/* Primary label: Month or Month Day */}
            <text
              x={tick.x}
              y={height - 20}
              textAnchor="middle"
              fontSize="11"
              fill={t.mutedForeground}
              fontWeight="500"
            >
              {tick.primary}
            </text>
            {/* Secondary label: Year */}
            {tick.secondary ? (
              <text
                x={tick.x}
                y={height - 7}
                textAnchor="middle"
                fontSize="9.5"
                fill={isDark ? '#64748B' : '#94A3B8'}
                fontWeight="400"
              >
                {tick.secondary}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );

  return (
    <View style={{ width: '100%', position: 'relative' }}>
      {/* Tooltip on hover */}
      {hover && Platform.OS === 'web' && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: Math.min(Math.max((hover.x || 0) + 14, 10), Math.max(width - 220, 10)),
            top: Math.max((hover.y || 0) - 85, 6),
            zIndex: 40,
            backgroundColor: isDark ? '#1E2124' : '#FFFFFF',
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 9,
            minWidth: 160,
            borderWidth: 1,
            borderColor: isDark ? '#2E3236' : '#E2E8F0',
            boxShadow: '0 6px 18px rgba(15, 23, 42, 0.14)',
          }}
        >
          <Text
            style={{
              color: t.foreground,
              fontSize: 12,
              fontWeight: '700',
              marginBottom: 4,
            }}
          >
            {hover.title || hover.label}
          </Text>

          {hover.actual != null && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: actualColor }} />
              <Text style={{ fontSize: 11.5, color: t.mutedForeground }}>
                Actual Sales: <Text style={{ fontWeight: '600', color: t.foreground }}>{hover.actual} units</Text>
              </Text>
            </View>
          )}

          {hover.forecast != null && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: forecastColor }} />
              <Text style={{ fontSize: 11.5, color: t.mutedForeground }}>
                Forecast: <Text style={{ fontWeight: '600', color: forecastColor }}>{hover.forecast} units</Text>
              </Text>
            </View>
          )}

          {hover.fitted != null && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 2, backgroundColor: regressionColor }} />
              <Text style={{ fontSize: 11, color: t.mutedForeground }}>
                Trend Line: <Text style={{ fontWeight: '500', color: t.foreground }}>{hover.fitted} units</Text>
              </Text>
            </View>
          )}
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ width: '100%' }}>
        <div style={{ width, height }}>{svg}</div>
      </ScrollView>
    </View>
  );
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getCleanXAxisLabel(point, periodType, prevPoint) {
  const dateStr = point.date || point.forecastDate;
  const prevDateStr = prevPoint?.date || prevPoint?.forecastDate;

  let year = '';
  let month = '';
  let day = '';

  if (dateStr && String(dateStr).includes('-')) {
    const parts = String(dateStr).split('-');
    year = parts[0] || '';
    const mNum = parseInt(parts[1], 10);
    month = MONTH_NAMES[mNum - 1] || parts[1] || '';
    if (parts[2]) {
      day = String(parseInt(parts[2], 10));
    }
  }

  let prevYear = '';
  if (prevDateStr && String(prevDateStr).includes('-')) {
    prevYear = String(prevDateStr).split('-')[0] || '';
  }

  const showYear = Boolean(year && (prevPoint == null || year !== prevYear));

  if (periodType === 'month') {
    if (month) {
      return {
        primary: month,
        secondary: showYear ? year : '',
      };
    }
    if (point.label && !point.label.startsWith('Month ')) {
      const parts = point.label.trim().split(' ');
      return {
        primary: parts[0] || 'Jan',
        secondary: parts[1] || (showYear ? year : ''),
      };
    }
    const mIdx = (point.x - 1) % 12;
    const calcYear = 2025 + Math.floor((point.x - 1) / 12);
    return {
      primary: MONTH_NAMES[mIdx] || 'Jan',
      secondary: String(calcYear),
    };
  }

  if (periodType === 'week') {
    if (month && day) {
      return {
        primary: `${month} ${day}`,
        secondary: showYear ? year : '',
      };
    }
    if (month) {
      return {
        primary: month,
        secondary: showYear ? year : '',
      };
    }
    return {
      primary: `W${point.x}`,
      secondary: showYear ? year : '',
    };
  }

  // Daily
  if (month && day) {
    return {
      primary: `${month} ${day}`,
      secondary: showYear ? year : '',
    };
  }
  if (point.label && !point.label.startsWith('Day ')) {
    return {
      primary: point.label,
      secondary: showYear ? year : '',
    };
  }
  return {
    primary: `D${point.x}`,
    secondary: showYear ? year : '',
  };
}

function formatTooltipDate(p, periodType) {
  const dateStr = p.date || p.forecastDate;
  if (!dateStr) return p.label || `Period ${p.x}`;
  const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00Z' : ''));
  if (Number.isNaN(d.getTime())) return p.label || String(dateStr);

  if (periodType === 'day') {
    return d.toLocaleDateString('en-US', {
      timeZone: 'UTC',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  if (periodType === 'week') {
    return `Week of ${d.toLocaleDateString('en-US', {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`;
  }
  return d.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  });
}
