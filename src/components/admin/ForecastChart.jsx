import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Platform } from 'react-native';
import { getForecastTokens } from '../../styles/forecast.styles';

/**
 * Figma-matched forecast chart:
 * teal area (actual) + dashed gray trend + violet dashed forecast + Forecast divider
 */
export default function ForecastChart({
  chartPoints = [],
  trendLine = [],
  isDark = false,
  height = 280,
  periodType = 'week',
}) {
  const t = getForecastTokens(isDark);
  const [hover, setHover] = useState(null);

  const { width, points, trendPts, maxY, pad, forecastStartX } = useMemo(() => {
    const n = Math.max(chartPoints.length, 2);
    const w = Math.max(680, n * 72);
    const padLocal = { top: 20, right: 28, bottom: 36, left: 40 };
    const gW = w - padLocal.left - padLocal.right;
    const gH = height - padLocal.top - padLocal.bottom;

    const values = [
      ...chartPoints.map((p) => p.actual).filter((v) => v != null),
      ...chartPoints.map((p) => p.forecast).filter((v) => v != null),
      ...trendLine.map((p) => p.y),
      1,
    ];
    const max = Math.max(...values) * 1.2 || 1;
    const lastX = chartPoints[chartPoints.length - 1]?.x || n;

    const toXY = (xIndex, y) => {
      const x = padLocal.left + ((xIndex - 1) / Math.max(1, lastX - 1)) * gW;
      const yy = padLocal.top + gH - (Math.max(0, y) / max) * gH;
      return { x, y: yy };
    };

    const mapped = chartPoints.map((p) => ({
      ...p,
      actualPt: p.actual != null ? toXY(p.x, p.actual) : null,
      forecastPt: p.forecast != null ? toXY(p.x, p.forecast) : null,
      fittedPt: p.fitted != null ? toXY(p.x, p.fitted) : null,
    }));

    const firstForecast = mapped.find((p) => p.forecast != null);
    const lastActual = [...mapped].reverse().find((p) => p.actual != null);
    const dividerX =
      firstForecast?.forecastPt?.x ??
      (lastActual?.actualPt ? lastActual.actualPt.x + 8 : null);

    return {
      width: w,
      points: mapped,
      trendPts: trendLine.map((p) => toXY(p.x, p.y)),
      maxY: max,
      pad: padLocal,
      forecastStartX: dividerX,
    };
  }, [chartPoints, trendLine, height]);

  const poly = (pts) => pts.map((p) => `${p.x},${p.y}`).join(' ');

  const areaPath = (pts, baselineY) => {
    if (!pts.length) return '';
    const top = pts.map((p) => `${p.x},${p.y}`).join(' ');
    const last = pts[pts.length - 1];
    const first = pts[0];
    return `M ${first.x},${baselineY} L ${top.replace(/ /g, ' L ')} L ${last.x},${baselineY} Z`;
  };

  const actualPath = points.filter((p) => p.actualPt).map((p) => p.actualPt);
  const forecastPath = points.filter((p) => p.forecastPt).map((p) => p.forecastPt);
  const forecastBridge =
    actualPath.length && forecastPath.length
      ? [actualPath[actualPath.length - 1], ...forecastPath]
      : forecastPath;

  const baselineY = height - pad.bottom;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxY * f));

  const onHoverPoint = (p, chartX, chartY) => {
    if (!p) {
      setHover(null);
      return;
    }
    const actual = p.actual;
    const fitted = p.fitted != null ? p.fitted : null;
    const forecast = p.forecast != null ? p.forecast : null;
    const title = shortLabel(p.label, p.x, periodType);
    setHover({
      title,
      actual: actual != null ? Math.round(actual * 100) / 100 : null,
      fitted: fitted != null ? Math.round(fitted * 100) / 100 : null,
      forecast: forecast != null ? Math.round(forecast * 100) / 100 : null,
      isForecastPoint: forecast != null && actual == null,
      x: chartX,
      y: chartY,
    });
  };

  const handlePointEnter = (p) => {
    const pt = p.actualPt || p.forecastPt;
    onHoverPoint(p, pt?.x ?? 0, pt?.y ?? 0);
  };

  const svg = (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block' }}
      onMouseLeave={() => setHover(null)}
    >
      <defs>
        <linearGradient id="actualAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={t.primary} stopOpacity={isDark ? 0.45 : 0.35} />
          <stop offset="100%" stopColor={t.primary} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="forecastAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={t.forecast} stopOpacity={isDark ? 0.35 : 0.28} />
          <stop offset="100%" stopColor={t.forecast} stopOpacity="0" />
        </linearGradient>
      </defs>

      {yTicks.map((tick, i) => {
        const y = pad.top + (height - pad.top - pad.bottom) * (1 - tick / maxY);
        return (
          <g key={`yt-${i}`}>
            <line
              x1={pad.left}
              y1={y}
              x2={width - pad.right}
              y2={y}
              stroke={t.border}
              strokeWidth="1"
            />
            <text x={pad.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill={t.mutedForeground}>
              {tick}
            </text>
          </g>
        );
      })}

      {actualPath.length > 1 && (
        <path d={areaPath(actualPath, baselineY)} fill="url(#actualAreaGrad)" />
      )}
      {forecastBridge.length > 1 && (
        <path d={areaPath(forecastBridge, baselineY)} fill="url(#forecastAreaGrad)" />
      )}

      {trendPts.length > 1 && (
        <polyline
          points={poly(trendPts)}
          fill="none"
          stroke={t.mutedForeground}
          strokeWidth="1.75"
          strokeDasharray="5 4"
          opacity="0.75"
        />
      )}

      {actualPath.length > 1 && (
        <polyline points={poly(actualPath)} fill="none" stroke={t.primary} strokeWidth="2.5" />
      )}

      {forecastBridge.length > 1 && (
        <polyline
          points={poly(forecastBridge)}
          fill="none"
          stroke={t.forecast}
          strokeWidth="2.5"
          strokeDasharray="7 5"
        />
      )}

      {forecastStartX != null && (
        <g>
          <line
            x1={forecastStartX}
            y1={pad.top}
            x2={forecastStartX}
            y2={baselineY}
            stroke={t.mutedForeground}
            strokeWidth="1.25"
            strokeDasharray="4 4"
            opacity="0.7"
          />
          <text
            x={forecastStartX + 6}
            y={pad.top + 12}
            fontSize="10"
            fontWeight="700"
            fill={t.mutedForeground}
          >
            Forecast →
          </text>
        </g>
      )}

      {points.map((p) => (
        <g key={p.key || p.x}>
          {p.actualPt && (
            <circle
              cx={p.actualPt.x}
              cy={p.actualPt.y}
              r="5"
              fill={t.primary}
              stroke={t.card}
              strokeWidth="2.5"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => handlePointEnter(p)}
              onClick={() => handlePointEnter(p)}
            />
          )}
          {p.forecastPt && (
            <circle
              cx={p.forecastPt.x}
              cy={p.forecastPt.y}
              r="5"
              fill={t.forecast}
              stroke={t.card}
              strokeWidth="2.5"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => handlePointEnter(p)}
              onClick={() => handlePointEnter(p)}
            />
          )}
          <text
            x={(p.actualPt || p.forecastPt)?.x || 0}
            y={height - 12}
            textAnchor="middle"
            fontSize="10"
            fill={t.mutedForeground}
            fontWeight="600"
          >
            {shortLabel(p.label, p.x, periodType)}
          </text>
        </g>
      ))}
    </svg>
  );

  return (
    <View style={{ width: '100%', position: 'relative' }}>
      {hover && Platform.OS === 'web' && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: Math.min(Math.max((hover.x || 0) + 14, 8), Math.max(width - 200, 8)),
            top: Math.max((hover.y || 0) - 72, 4),
            zIndex: 20,
            backgroundColor: isDark ? '#161820' : '#FFFFFF',
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 10,
            minWidth: 168,
            borderWidth: 1,
            borderColor: isDark ? '#272930' : '#E5E7EB',
            // web shadow
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
          }}
        >
          <Text
            style={{
              color: isDark ? '#E8EAF0' : '#111318',
              fontSize: 12.5,
              fontWeight: '800',
              marginBottom: 8,
            }}
          >
            {hover.title}
          </Text>

          {hover.actual != null && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: t.primary,
                }}
              />
              <Text style={{ color: isDark ? '#C4C6D4' : '#4B5563', fontSize: 12, fontWeight: '500' }}>
                Actual Sales:{' '}
                <Text style={{ fontWeight: '800', color: isDark ? '#E8EAF0' : '#111318' }}>
                  {formatUnits(hover.actual)}
                </Text>
              </Text>
            </View>
          )}

          {hover.fitted != null && !hover.isForecastPoint && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: t.mutedForeground,
                }}
              />
              <Text style={{ color: isDark ? '#C4C6D4' : '#4B5563', fontSize: 12, fontWeight: '500' }}>
                Regression Trend:{' '}
                <Text style={{ fontWeight: '800', color: isDark ? '#E8EAF0' : '#111318' }}>
                  {formatUnits(hover.fitted)}
                </Text>
              </Text>
            </View>
          )}

          {(hover.isForecastPoint || (hover.forecast != null && hover.actual == null)) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: t.forecast,
                }}
              />
              <Text style={{ color: isDark ? '#C4C6D4' : '#4B5563', fontSize: 12, fontWeight: '500' }}>
                Forecast:{' '}
                <Text style={{ fontWeight: '800', color: isDark ? '#E8EAF0' : '#111318' }}>
                  {formatUnits(hover.forecast)}
                </Text>
              </Text>
            </View>
          )}
        </View>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator style={{ width: '100%' }}>
        {Platform.OS === 'web' ? (
          <div style={{ width, height }}>{svg}</div>
        ) : (
          <View style={{ width, height }}>
            <NativeBarFallback
              points={points}
              height={height}
              width={width}
              tokens={t}
              maxY={maxY}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function formatUnits(value) {
  if (value == null || value === '—') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const rounded = Math.round(n * 100) / 100;
  const text = Number.isInteger(rounded) ? String(rounded) : String(rounded);
  return `${text} units`;
}

function shortLabel(label, x, periodType) {
  if (!label) return periodType === 'month' ? `M${x}` : `Wk ${x}`;
  if (label.startsWith('Week ')) return `Wk ${label.replace('Week ', '')}`;
  return label.length > 8 ? label.slice(0, 7) : label;
}

function NativeBarFallback({ points, height, width, tokens, maxY }) {
  const barW = Math.max(18, width / Math.max(points.length, 1) - 12);
  return (
    <View
      style={{
        width,
        height,
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 8,
        paddingBottom: 28,
        gap: 6,
      }}
    >
      {points.map((p) => {
        const val = p.actual != null ? p.actual : p.forecast || 0;
        const h = Math.max(4, (val / maxY) * (height - 48));
        const color = p.forecast != null ? tokens.forecast : tokens.primary;
        return (
          <View key={p.key || p.x} style={{ width: barW, alignItems: 'center' }}>
            <Text style={{ fontSize: 9, color: tokens.mutedForeground, marginBottom: 4 }}>
              {Math.round(val)}
            </Text>
            <View style={{ width: barW * 0.7, height: h, borderRadius: 6, backgroundColor: color }} />
            <Text
              style={{ fontSize: 9, color: tokens.mutedForeground, marginTop: 6 }}
              numberOfLines={1}
            >
              {shortLabel(p.label, p.x, 'week')}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
