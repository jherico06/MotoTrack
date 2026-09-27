import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { BootstrapIcon } from '../common';
import { garageService } from '../../services/garageService';

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
        color: '#1E75D8', // Blue
      },
      {
        id: 'repair',
        label: 'Mechanical & Electrical Repair',
        shortLabel: 'Repair',
        count: repairCount,
        percentage: total > 0 ? Math.round((repairCount / total) * 100) : 0,
        color: '#FA5C4F', // Coral / Red
      },
      {
        id: 'custom',
        label: 'Customization & Tuning',
        shortLabel: 'Customization',
        count: customCount,
        percentage: total > 0 ? Math.round((customCount / total) * 100) : 0,
        color: '#4CAF50', // Green
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

  return (
    <View
      style={[
        {
          backgroundColor: colors.cardBg,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 20,
          marginBottom: 20,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.2 : 0.04,
          shadowRadius: 8,
          elevation: 2,
        },
        style,
      ]}
    >
      {/* Header Row */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 16,
        }}
      >
        <View style={{ flex: 1, minWidth: 160 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <Text
              style={{
                fontSize: 15.5,
                fontWeight: '800',
                color: colors.textPrimary,
                letterSpacing: -0.2,
              }}
            >
              Service Bookings Share
            </Text>

            {/* Live Indicator Badge */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7',
                paddingHorizontal: 7,
                paddingVertical: 2,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#BBF7D0',
              }}
            >
              <View
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 2.5,
                  backgroundColor: '#10B981',
                }}
              />
              <Text
                style={{
                  fontSize: 9.5,
                  fontWeight: '700',
                  color: isDark ? '#34D399' : '#15803D',
                }}
              >
                Live ({liveBookings.length})
              </Text>
            </View>

            {/* Sync Refresh Button */}
            <TouchableOpacity
              onPress={handleRefresh}
              disabled={syncing}
              style={{ padding: 3, cursor: 'pointer' }}
              title="Sync with database"
            >
              {syncing ? (
                <ActivityIndicator size="small" color="#1E75D8" />
              ) : (
                <BootstrapIcon name="arrow-repeat" size={12} color={colors.textMuted} />
              )}
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 2 }}>
            Appointment demand proportion by service category
          </Text>
        </View>

        {/* Filter Tabs: All Time / Active Queue / Completed */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: colors.chipBg,
            borderRadius: 8,
            padding: 2.5,
            borderWidth: 1,
            borderColor: colors.chipBorder,
            gap: 2,
          }}
        >
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
                  paddingHorizontal: 9,
                  paddingVertical: 4,
                  borderRadius: 6,
                  backgroundColor: active ? (isDark ? '#1E293B' : '#0F172A') : 'transparent',
                  cursor: 'pointer',
                }}
                onPress={() => setFilterMode(tab.key)}
                activeOpacity={0.85}
              >
                <Text
                  style={{
                    fontSize: 10.5,
                    fontWeight: '700',
                    color: active ? '#FFFFFF' : colors.textMuted,
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
          gap: isDesktop ? 20 : 20,
          paddingVertical: 4,
          flex: 1,
        }}
      >
        {/* Left Side: SVG Donut with Center Telemetry matching reference */}
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <svg
              width="190"
              height="190"
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
                />
              ) : activeSlices.length === 1 ? (
                // Single category has 100% of the bookings
                <circle
                  cx="100"
                  cy="100"
                  r="72"
                  fill="none"
                  stroke={activeSlices[0].color}
                  strokeWidth="32"
                  style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                  onMouseEnter={() => setHoveredCategory(activeSlices[0].id)}
                  onMouseLeave={() => setHoveredCategory(null)}
                />
              ) : (
                // Multiple slices with separator gaps
                slices.map((slice) => {
                  const isHovered = hoveredCategory === slice.id;
                  return (
                    <path
                      key={slice.id}
                      d={slice.path}
                      fill={slice.color}
                      stroke={colors.cardBg}
                      strokeWidth="3"
                      strokeLinejoin="round"
                      opacity={hoveredCategory && !isHovered ? 0.35 : 1}
                      style={{
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={() => setHoveredCategory(slice.id)}
                      onMouseLeave={() => setHoveredCategory(null)}
                      onClick={() =>
                        setHoveredCategory((prev) => (prev === slice.id ? null : slice.id))
                      }
                    />
                  );
                })
              )}
            </svg>

            {/* Center Hole Telemetry: Big percentage + category name */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                alignItems: 'center',
                justifyContent: 'center',
                width: 104,
                height: 104,
                borderRadius: 52,
              }}
            >
              <Text
                style={{
                  fontSize: 30,
                  fontWeight: '900',
                  color: colors.textPrimary,
                  letterSpacing: -1,
                  lineHeight: 34,
                }}
              >
                {activeItem ? `${String(activeItem.percentage).padStart(2, '0')}%` : '00%'}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 11.5,
                  fontWeight: '600',
                  color: colors.textMuted,
                  marginTop: 2,
                  textAlign: 'center',
                  paddingHorizontal: 4,
                }}
              >
                {activeItem ? activeItem.shortLabel || activeItem.label : 'No Bookings'}
              </Text>
            </View>
          </View>
        </View>

        {/* Right Side: Clean Legend List exactly styled after the reference image */}
        <View
          style={{
            flex: 1,
            width: isDesktop ? 'auto' : '100%',
            minWidth: isDesktop ? 190 : '100%',
            gap: 4,
          }}
        >
          {stats.map((cat) => {
            const isHovered = hoveredCategory === cat.id;
            const formattedPercent = `${String(cat.percentage).padStart(2, '0')}%`;

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
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: 6,
                  backgroundColor: isHovered ? colors.hoverBg : 'transparent',
                  borderWidth: 1,
                  borderColor: isHovered ? colors.hoverBorder : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {/* 1. Circle Dot */}
                <View
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: cat.color,
                    marginRight: 10,
                    flexShrink: 0,
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
                  }}
                >
                  {cat.label}
                </Text>

                {/* 3. Percentage */}
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '800',
                    color: colors.textPrimary,
                    width: 42,
                    textAlign: 'right',
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {formattedPercent}
                </Text>

                {/* 4. Count Value */}
                <Text
                  style={{
                    fontSize: 12.5,
                    fontWeight: '500',
                    color: colors.textMuted,
                    width: 44,
                    textAlign: 'right',
                    marginLeft: 12,
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
