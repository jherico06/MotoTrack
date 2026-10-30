import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { BootstrapIcon } from '../common';
import { garageService } from '../../services/bookings/garageService.js';

/**
 * BookingCategoryPieChart — Design matching modern donut chart with interactive hover telemetry.
 *
 * Displays live database service appointment demand across 3 core categories:
 * - Preventive Maintenance (PMS)
 * - Mechanical & Electrical Repair
 * - Customization & Tuning
 */
export default function BookingCategoryPieChart({
  bookings: propBookings,
  isDark = false,
  isDesktop = true,
  style,
}) {
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'active' | 'completed'
  const [hoveredCategory, setHoveredCategory] = useState(null);
  const [liveBookings, setLiveBookings] = useState(() => {
    if (Array.isArray(propBookings) && propBookings.length > 0) return propBookings;
    try {
      return garageService.getLocalBookings() || [];
    } catch {
      return [];
    }
  });
  const [syncing, setSyncing] = useState(false);

  // Sync with parent prop updates
  useEffect(() => {
    if (Array.isArray(propBookings)) {
      setLiveBookings(propBookings);
    }
  }, [propBookings]);

  // Subscribe to real-time database updates from garageService
  useEffect(() => {
    let isMounted = true;
    async function loadLatest() {
      try {
        setSyncing(true);
        const data = await garageService.getAllBookings();
        if (isMounted && Array.isArray(data)) {
          setLiveBookings(data);
        }
      } catch (err) {
        console.warn('BookingCategoryPieChart fetch error:', err);
      } finally {
        if (isMounted) setSyncing(false);
      }
    }
    loadLatest();

    const unsub = garageService.subscribeBookings((fresh) => {
      if (isMounted && Array.isArray(fresh)) {
        setLiveBookings(fresh);
      }
    });

    const handleStorageUpdate = (e) => {
      if (isMounted) {
        if (e && e.detail && Array.isArray(e.detail)) {
          setLiveBookings(e.detail);
        } else {
          try {
            setLiveBookings(garageService.getLocalBookings() || []);
          } catch {}
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('mototrack_bookings_updated', handleStorageUpdate);
      window.addEventListener('storage', handleStorageUpdate);
    }

    return () => {
      isMounted = false;
      unsub?.();
      if (typeof window !== 'undefined') {
        window.removeEventListener('mototrack_bookings_updated', handleStorageUpdate);
        window.removeEventListener('storage', handleStorageUpdate);
      }
    };
  }, []);

  // Manual refresh trigger
  const handleRefresh = async () => {
    try {
      setSyncing(true);
      const data = await garageService.getAllBookings();
      if (Array.isArray(data)) {
        setLiveBookings(data);
      }
    } catch (err) {
      console.warn('Refresh error:', err);
    } finally {
      setSyncing(false);
    }
  };

  // Theme colors
  const colors = useMemo(() => {
    if (isDark) {
      return {
        cardBg: '#141A18',
        border: '#272930',
        textPrimary: '#F8FAFC',
        textMuted: '#94A3B8',
        chipBg: '#1E293B',
        chipBorder: '#334155',
        hoverBg: 'rgba(255, 255, 255, 0.06)',
        hoverBorder: '#334155',
        emptyTrack: '#272930',
      };
    }
    return {
      cardBg: '#FFFFFF',
      border: '#E2E8F0',
      textPrimary: '#0F172A',
      textMuted: '#64748B',
      chipBg: '#F8FAFC',
      chipBorder: '#E2E8F0',
      hoverBg: '#F8FAFC',
      hoverBorder: '#E2E8F0',
      emptyTrack: '#E2E8F0',
    };
  }, [isDark]);

  // Filter live database bookings by status
  const filteredBookings = useMemo(() => {
    if (!Array.isArray(liveBookings)) return [];
    if (filterMode === 'active') {
      return liveBookings.filter((b) => {
        const s = String(b?.status || '').toLowerCase();
        return s === 'pending' || s === 'confirmed' || s === 'in progress' || s === 'inspection';
      });
    }
    if (filterMode === 'completed') {
      return liveBookings.filter((b) => {
        const s = String(b?.status || '').toLowerCase();
        return s === 'completed' || s === 'closed' || s === 'service done' || s === 'paid';
      });
    }
    return liveBookings;
  }, [liveBookings, filterMode]);

  // Categorize live database bookings across the 3 core categories
  const { stats, totalCount, leadingCategory } = useMemo(() => {
    let pmsCount = 0;
    let repairCount = 0;
    let customCount = 0;

    filteredBookings.forEach((b) => {
      if (!b) return;
      const cat = String(b.category || b.service_category || b.service_type || '').toLowerCase().trim();
      const sId = String(b.id || b.booking_id || b.service_id || '').toLowerCase();
      const title = String(b.service_title || b.service_name || b.title || b.package_name || '').toLowerCase();

      if (
        cat === 'pms' ||
        cat.includes('pms') ||
        sId.includes('-pms-') ||
        sId.includes('pms-') ||
        title.includes('pms') ||
        title.includes('preventive') ||
        title.includes('maintenance') ||
        title.includes('tune up') ||
        title.includes('oil change')
      ) {
        pmsCount++;
      } else if (
        cat === 'customization' ||
        cat === 'customize' ||
        cat.includes('custom') ||
        cat.includes('mod') ||
        cat.includes('tuning') ||
        sId.includes('-cust-') ||
        sId.includes('cust-') ||
        title.includes('custom') ||
        title.includes('exhaust') ||
        title.includes('dyno') ||
        title.includes('build')
      ) {
        customCount++;
      } else {
        repairCount++;
      }
    });

    const total = pmsCount + repairCount + customCount;

    // Palette matching the uploaded design reference (3 core service categories)
    const list = [
      {
        id: 'pms',
        label: 'Preventive Maintenance (PMS)',
        shortLabel: 'PMS',
        count: pmsCount,
        percentage: total > 0 ? Math.round((pmsCount / total) * 100) : 0,
        color: '#2563EB', // Blue
      },
      {
        id: 'repair',
        label: 'Mechanical & Electrical Repair',
        shortLabel: 'Repair',
        count: repairCount,
        percentage: total > 0 ? Math.round((repairCount / total) * 100) : 0,
        color: '#F43F5E', // Coral / Red
      },
      {
        id: 'custom',
        label: 'Customization & Tuning',
        shortLabel: 'Custom',
        count: customCount,
        percentage: total > 0 ? Math.round((customCount / total) * 100) : 0,
        color: '#10B981', // Emerald Green
      },
    ];

    // Ensure sum equals 100% when total > 0
    if (total > 0) {
      const sum = list.reduce((acc, it) => acc + it.percentage, 0);
      if (sum !== 100 && sum > 0) {
        const topItem = list.reduce((max, it) => (it.count > max.count ? it : max), list[0]);
        topItem.percentage += 100 - sum;
      }
    }

    const sortedByCount = [...list].sort((a, b) => b.count - a.count);
    const top = sortedByCount[0]?.count > 0 ? sortedByCount[0] : list[0];

    return {
      stats: list,
      totalCount: total,
      leadingCategory: top,
    };
  }, [filteredBookings]);

  // Non-zero stats for SVG arcs
  const activeSlices = useMemo(() => stats.filter((s) => s.count > 0), [stats]);

  // Compute SVG Donut Slices
  const slices = useMemo(() => {
    if (totalCount === 0 || activeSlices.length <= 1) return [];
    const cx = 100;
    const cy = 100;
    const rInner = 56;
    const rOuter = 88;

    let currentAngle = 0;
    return activeSlices.map((item) => {
      const sliceAngle = (item.count / totalCount) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + sliceAngle;
      currentAngle = endAngle;

      const path = describeDonutArc(cx, cy, rInner, rOuter, startAngle, endAngle);
      return {
        ...item,
        startAngle,
        endAngle,
        path,
      };
    });
  }, [activeSlices, totalCount]);

  // Active / displayed item in center hole
  const activeItem = hoveredCategory
    ? stats.find((s) => s.id === hoveredCategory) || null
    : totalCount > 0
    ? leadingCategory
    : null;

  // Smooth counter animation for center percentage (0% -> 100% over 1000ms on load)
  const targetPercentage = activeItem ? activeItem.percentage : 0;
  const [displayedPercent, setDisplayedPercent] = useState(0);

  useEffect(() => {
    let frameId;
    const startValue = displayedPercent;
    const endValue = targetPercentage;
    const duration = 1000;
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

    function animate(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (endValue - startValue) * ease);
      setDisplayedPercent(current);

      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      }
    }

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [targetPercentage]);

  return (
    <View
      style={[
        {
          backgroundColor: colors.cardBg,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 18,
          marginBottom: 0,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: isDark ? 0.2 : 0.03,
          shadowRadius: 6,
          elevation: 1,
          animation: 'dashboardCardFadeSlideUp 450ms cubic-bezier(0.16, 1, 0.3, 1) backwards',
          animationDelay: '0ms',
          transition: 'transform 180ms ease, box-shadow 180ms ease',
        },
        style,
      ]}
      onMouseEnter={(e) => {
        if (e?.currentTarget) e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        if (e?.currentTarget) e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Keyframe styles for smooth animations */}
      <style>{`
        @keyframes dashboardCardFadeSlideUp {
          0% {
            opacity: 0;
            transform: translateY(10px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes donutDrawSweep {
          0% {
            stroke-dashoffset: 452.39;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }
        @keyframes donutSlicePop {
          0% {
            opacity: 0;
            transform: scale(0.92);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes reloadSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>

      {/* Header Row */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <View style={{ flex: 1, minWidth: 160 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '600',
                color: colors.textPrimary,
                letterSpacing: -0.3,
              }}
            >
              Service Bookings Share
            </Text>

            {/* Live Indicator Badge */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.14)' : '#ECFDF5',
                paddingHorizontal: 8,
                paddingVertical: 3.5,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: isDark ? 'rgba(16, 185, 129, 0.28)' : '#A7F3D0',
              }}
            >
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 3.5,
                  backgroundColor: '#10B981',
                }}
              />
              <Text
                style={{
                  fontSize: 10.5,
                  fontWeight: '700',
                  color: isDark ? '#34D399' : '#065F46',
                }}
              >
                Live ({liveBookings.length})
              </Text>
            </View>

            {/* Sync Refresh Button with Hover Spin */}
            <TouchableOpacity
              onPress={handleRefresh}
              disabled={syncing}
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
                borderWidth: 1,
                borderColor: isDark ? '#334155' : '#E2E8F0',
                cursor: 'pointer',
                transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s ease',
                ...(syncing ? { animation: 'reloadSpin 0.9s linear infinite' } : {}),
              }}
              onMouseEnter={(e) => {
                if (!syncing && e?.currentTarget) e.currentTarget.style.transform = 'rotate(180deg) scale(1.08)';
              }}
              onMouseLeave={(e) => {
                if (!syncing && e?.currentTarget) e.currentTarget.style.transform = 'rotate(0deg) scale(1)';
              }}
              title="Sync with database"
            >
              {syncing ? (
                <ActivityIndicator size="small" color="#2563EB" />
              ) : (
                <BootstrapIcon name="arrow-repeat" size={11} color={colors.textMuted} />
              )}
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 3 }}>
            Appointment demand proportion by service category
          </Text>
        </View>

        {/* Filter Tabs: All / Active / Completed with Smooth Sliding Indicator */}
        <View
          style={{
            position: 'relative',
            flexDirection: 'row',
            backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
            borderRadius: 8,
            padding: 3,
            borderWidth: 1,
            borderColor: isDark ? '#334155' : '#E2E8F0',
            width: isDesktop ? 220 : '100%',
          }}
        >
          {/* Smooth animated active-state indicator */}
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
                filterMode === 'all'
                  ? 'translateX(0%)'
                  : filterMode === 'active'
                  ? 'translateX(100%)'
                  : 'translateX(200%)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
          {[
            { key: 'all', label: 'All' },
            { key: 'active', label: 'Active' },
            { key: 'completed', label: 'Completed' },
          ].map((tab) => {
            const active = filterMode === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
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
                onPress={() => setFilterMode(tab.key)}
                activeOpacity={0.85}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: active ? '#FFFFFF' : colors.textMuted,
                    transition: 'color 200ms ease',
                  }}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Main Content Area: Donut on Left, Clean Legend on Right */}
      <View
        style={{
          flexDirection: isDesktop ? 'row' : 'column',
          alignItems: 'center',
          justifyContent: isDesktop ? 'space-between' : 'center',
          gap: isDesktop ? 24 : 20,
          paddingVertical: 6,
          flex: 1,
        }}
      >
        {/* Left Side: SVG Donut with Center Telemetry */}
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <svg
              width={isDesktop ? 180 : 160}
              height={isDesktop ? 180 : 160}
              viewBox="0 0 200 200"
              style={{ display: 'block', overflow: 'visible' }}
            >
              {totalCount === 0 ? (
                // Empty state clean circular track
                <circle
                  cx="100"
                  cy="100"
                  r="72"
                  fill="none"
                  stroke={colors.emptyTrack}
                  strokeWidth="32"
                  style={{ transition: 'stroke 0.4s ease' }}
                />
              ) : activeSlices.length === 1 ? (
                // Single category has 100% of the bookings — smooth sweep drawing animation
                <circle
                  key={`single-${filterMode}-${activeSlices[0].id}`}
                  cx="100"
                  cy="100"
                  r="72"
                  fill="none"
                  stroke={activeSlices[0].color}
                  strokeWidth="32"
                  strokeDasharray="452.39"
                  strokeDashoffset="0"
                  transform="rotate(-90 100 100)"
                  style={{
                    cursor: 'pointer',
                    animation: 'donutDrawSweep 1s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                    transition: 'filter 0.25s ease, stroke 0.3s ease',
                    filter:
                      hoveredCategory === activeSlices[0].id
                        ? 'brightness(1.1) drop-shadow(0 0 10px rgba(37, 99, 235, 0.5))'
                        : 'none',
                  }}
                  onMouseEnter={() => setHoveredCategory(activeSlices[0].id)}
                  onMouseLeave={() => setHoveredCategory(null)}
                />
              ) : (
                // Multiple slices with separator gaps and spring scale on hover
                <g
                  key={`multi-${filterMode}-${slices.length}`}
                  style={{
                    transformOrigin: '100px 100px',
                    animation: 'donutSlicePop 0.85s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                  }}
                >
                  {slices.map((slice) => {
                    const isHovered = hoveredCategory === slice.id;
                    return (
                      <path
                        key={slice.id}
                        d={slice.path}
                        fill={slice.color}
                        stroke={colors.cardBg}
                        strokeWidth="3.5"
                        strokeLinejoin="round"
                        opacity={hoveredCategory && !isHovered ? 0.35 : 1}
                        style={{
                          cursor: 'pointer',
                          transformOrigin: '100px 100px',
                          transform: isHovered ? 'scale(1.045)' : 'scale(1)',
                          transition:
                            'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease, filter 0.25s ease',
                          filter: isHovered ? `drop-shadow(0 0 8px ${slice.color}66)` : 'none',
                        }}
                        onMouseEnter={() => setHoveredCategory(slice.id)}
                        onMouseLeave={() => setHoveredCategory(null)}
                        onClick={() =>
                          setHoveredCategory((prev) => (prev === slice.id ? null : slice.id))
                        }
                      />
                    );
                  })}
                </g>
              )}
            </svg>

            {/* Center Hole Telemetry: Animated percentage + category name */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                alignItems: 'center',
                justifyContent: 'center',
                width: isDesktop ? 100 : 90,
                height: isDesktop ? 100 : 90,
                borderRadius: isDesktop ? 50 : 45,
                transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                transform: hoveredCategory ? 'scale(1.05)' : 'scale(1)',
              }}
            >
              <Text
                style={{
                  fontSize: isDesktop ? 26 : 23,
                  fontWeight: '600',
                  color: colors.textPrimary,
                  letterSpacing: -0.6,
                  lineHeight: isDesktop ? 30 : 27,
                  fontVariant: ['tabular-nums'],
                  transition: 'color 0.2s ease',
                }}
              >
                {activeItem ? `${displayedPercent}%` : '0%'}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  fontSize: isDesktop ? 11.5 : 10.5,
                  fontWeight: '700',
                  color: colors.textMuted,
                  marginTop: 2,
                  textAlign: 'center',
                  paddingHorizontal: 4,
                  transition: 'color 0.2s ease',
                }}
              >
                {activeItem ? activeItem.shortLabel || activeItem.label : 'No Bookings'}
              </Text>
            </View>
          </View>
        </View>

        {/* Right Side: Clean Legend List with Smooth Interactive Hover */}
        <View
          style={{
            flex: 1,
            width: isDesktop ? 'auto' : '100%',
            minWidth: isDesktop ? 200 : '100%',
            gap: 4,
          }}
        >
          {stats.map((cat) => {
            const isHovered = hoveredCategory === cat.id;
            const formattedPercent = `${cat.percentage}%`;

            return (
              <TouchableOpacity
                key={cat.id}
                activeOpacity={0.85}
                onMouseEnter={() => setHoveredCategory(cat.id)}
                onMouseLeave={() => setHoveredCategory(null)}
                onPress={() =>
                  setHoveredCategory((prev) => (prev === cat.id ? null : cat.id))
                }
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 7,
                  paddingHorizontal: 10,
                  borderRadius: 8,
                  backgroundColor: isHovered ? colors.hoverBg : 'transparent',
                  borderWidth: 1,
                  borderColor: isHovered ? colors.hoverBorder : 'transparent',
                  cursor: 'pointer',
                  transition: 'transform 180ms ease, background-color 180ms ease, border-color 180ms ease',
                  transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
                }}
              >
                {/* 1. Circle Dot with Pulse Glow on Hover */}
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: cat.color,
                    marginRight: 10,
                    flexShrink: 0,
                    transition: 'transform 180ms ease',
                    transform: isHovered ? 'scale(1.15)' : 'scale(1)',
                  }}
                />

                {/* 2. Category Name */}
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 13,
                    fontWeight: isHovered ? '700' : '500',
                    color: colors.textPrimary,
                    flex: 1,
                    transition: 'color 0.15s ease',
                  }}
                >
                  {cat.label}
                </Text>

                {/* 3. Percentage */}
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: colors.textPrimary,
                    width: 44,
                    textAlign: 'right',
                    fontVariant: ['tabular-nums'],
                    transition: 'transform 0.2s ease',
                    transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                  }}
                >
                  {formattedPercent}
                </Text>

                {/* 4. Count Value */}
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: colors.textMuted,
                    width: 36,
                    textAlign: 'right',
                    marginLeft: 10,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {cat.count}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

/**
 * SVG Donut Arc Helper
 */
function describeDonutArc(cx, cy, rInner, rOuter, startAngle, endAngle) {
  const delta = Math.min(359.99, Math.max(0.01, endAngle - startAngle));
  const effectiveEnd = startAngle + delta;

  const startRad = (startAngle - 90) * (Math.PI / 180);
  const endRad = (effectiveEnd - 90) * (Math.PI / 180);

  const x1 = (cx + rOuter * Math.cos(startRad)).toFixed(2);
  const y1 = (cy + rOuter * Math.sin(startRad)).toFixed(2);
  const x2 = (cx + rOuter * Math.cos(endRad)).toFixed(2);
  const y2 = (cy + rOuter * Math.sin(endRad)).toFixed(2);

  const x3 = (cx + rInner * Math.cos(endRad)).toFixed(2);
  const y3 = (cy + rInner * Math.sin(endRad)).toFixed(2);
  const x4 = (cx + rInner * Math.cos(startRad)).toFixed(2);
  const y4 = (cy + rInner * Math.sin(startRad)).toFixed(2);

  const largeArcFlag = delta <= 180 ? '0' : '1';

  return [
    `M ${x1} ${y1}`,
    `A ${rOuter} ${rOuter} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${rInner} ${rInner} 0 ${largeArcFlag} 0 ${x4} ${y4}`,
    'Z',
  ].join(' ');
}
