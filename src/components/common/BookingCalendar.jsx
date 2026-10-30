import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Platform, useWindowDimensions } from 'react-native';
import BootstrapIcon from './BootstrapIcon.jsx';
import BookingSelect from './BookingSelect.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { appStorage } from '../../services/system/storageAdapter.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_HEADERS = [
  { short: 'SUN', isWeekend: true, label: 'SUN (WKND)' },
  { short: 'MON', isWeekend: false, label: 'MON' },
  { short: 'TUE', isWeekend: false, label: 'TUE' },
  { short: 'WED', isWeekend: false, label: 'WED' },
  { short: 'THU', isWeekend: false, label: 'THU' },
  { short: 'FRI', isWeekend: false, label: 'FRI' },
  { short: 'SAT', isWeekend: true, label: 'SAT (WKND)' },
];

const DEFAULT_TIME_SLOTS = [
  '09:00 AM - 10:30 AM',
  '10:30 AM - 12:00 PM',
  '01:30 PM - 03:00 PM',
  '03:00 PM - 04:30 PM',
  '04:30 PM - 06:00 PM',
];

/**
 * BookingCalendar — MotoTrack Road Teal design with fully booked selection and notifications.
 *
 * Props:
 * - selectedDate: string (YYYY-MM-DD)
 * - onSelectDate: (dateStr) => void
 * - onFullyBookedSelected: (dateStr) => void
 * - getDayInfo: (dateStr) => { bookingCount, isFullyBooked, isOffDuty, isSpecial, isHighlight, label }
 * - minDate: string (YYYY-MM-DD)
 * - statusBarText: string
 * - offDutyCount: number
 * - onToggleOffDuty: (dateStr) => void
 * - onResetToToday: () => void
 * - onBlockDate: (dateStr) => void
 * - onEnableDate: (dateStr) => void
 * - isDarkMode: boolean
 * - compact: boolean
 */
export default function BookingCalendar({
  selectedDate,
  onSelectDate,
  onFullyBookedSelected,
  getDayInfo,
  minDate,
  statusBarText = 'Hours: 9:00 AM – 6:00 PM (Mon – Sat). Tap any date to toggle off-duty or view slots.',
  offDutyCount = 1,
  onToggleOffDuty,
  onResetToToday,
  onBlockDate,
  onEnableDate,
  isDarkMode: propIsDarkMode,
  compact = false,
  showAdminControls = false,
  selectedTime,
  onSelectTime,
  timeSlots = DEFAULT_TIME_SLOTS,
  getTimeSlots,
  headerBg = '#24272B',
}) {
  let themeCtx = null;
  try {
    themeCtx = useTheme();
  } catch (_e) {}
  const isDark = propIsDarkMode !== undefined
    ? Boolean(propIsDarkMode)
    : Boolean(
        themeCtx?.isDarkMode ||
        (typeof document !== 'undefined' && document?.documentElement?.classList?.contains('dark')) ||
        (typeof appStorage !== 'undefined' && (
          appStorage.getItem('mototrack_admin_dark_mode') === 'true' ||
          appStorage.getItem('mototrack_customer_dark_mode') === 'true' ||
          appStorage.getItem('mototrack_theme_mode') === 'dark'
        ))
      );
  const { width } = useWindowDimensions();
  const isMobile = compact || width < 768;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const [viewDate, setViewDate] = useState(() => {
    if (selectedDate) {
      const parts = selectedDate.split('-');
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
    }
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const [dismissedWarningDate, setDismissedWarningDate] = useState(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  // Build grid cells
  const cells = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({
      day: daysInPrev - i,
      isCurrentMonth: false,
      dateStr: null,
      isEmpty: true,
    });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const cutoff = minDate || todayStr;
    const isPast = minDate !== null && cutoff ? dateStr < cutoff : false;
    cells.push({
      day: d,
      isCurrentMonth: true,
      dateStr,
      isPast,
      isSelected: dateStr === selectedDate,
      isToday: dateStr === todayStr,
    });
  }
  const remaining = (7 - (cells.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    cells.push({
      day: i,
      isCurrentMonth: false,
      dateStr: null,
      isEmpty: true,
    });
  }

  // Chunk into 7-day weeks
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  // Selected date info
  const selectedInfo = selectedDate && getDayInfo ? getDayInfo(selectedDate) : {};
  const isSelectedDateFullyBooked = selectedInfo?.isFullyBooked || false;
  const showFullyBookedBanner = isSelectedDateFullyBooked && dismissedWarningDate !== selectedDate;

  const handleCellPress = (cell) => {
    if (!cell.isCurrentMonth || !cell.dateStr) return;
    const info = getDayInfo ? getDayInfo(cell.dateStr) : {};
    onSelectDate?.(cell.dateStr);

    if (info.isFullyBooked) {
      setDismissedWarningDate(null);
      onFullyBookedSelected?.(cell.dateStr);
    }
  };

  const theme = useMemo(() => {
    if (isDark) {
      return {
        cardBg: '#24272B',
        cardBorder: '#374151',
        headerTitle: '#F8FAFC',
        subText: '#94A3B8',
        weekdayDefaultText: '#94A3B8',
        weekdayWeekendBg: '#2E2211',
        weekdayWeekendBorder: '#78350F',
        weekdayWeekendText: '#FBBF24',
        cellEmptyBg: '#1E2124',
        cellEmptyBorder: '#2E3236',
        cellDefaultBg: '#1E2124',
        cellDefaultBorder: '#32373D',
        cellDefaultText: '#F1F5F9',
        cellPastText: '#64748B',
        cellPastBorder: '#282C30',
        cellPastBg: '#181A1D',
        cellTodayBg: '#122B20',
        cellTodayBorder: '#10B981',
        cellTodayText: '#34D399',
        cellHighlightBg: '#1C2E24',
        cellHighlightBorder: '#059669',
        cellHighlightText: '#6EE7B7',
        cellSelectedBg: '#382215',
        cellSelectedBorder: '#EA580C',
        cellSelectedText: '#FFF7ED',
        cellFullyBookedBg: '#381417',
        cellFullyBookedBorder: '#991B1B',
        cellFullyBookedText: '#FCA5A5',
        cellSpecialBg: '#2A1B3D',
        cellSpecialBorder: '#7C3AED',
        cellSpecialText: '#DDD6FE',
        modeOffDutyBgActive: '#452A08',
        modeOffDutyBgInactive: '#261D13',
        modeOffDutyBorder: '#78350F',
        modeOffDutyText: '#FBBF24',
        blockBtnBg: '#381417',
        blockBtnBorder: '#991B1B',
        workBtnBg: '#382215',
        workBtnBorder: '#EA580C',
        resetBtnBg: '#1E2124',
        resetBtnBorder: '#374151',
        resetBtnText: '#94A3B8',
        legendDotsBg: '#1E2124',
        legendDotsBorder: '#374151',
        bannerFullBg: '#381417',
        bannerFullBorder: '#991B1B',
        bannerFullTitle: '#FCA5A5',
        bannerFullText: '#F87171',
        badgeFullBg: '#451417',
        badgeFullText: '#FCA5A5',
        badgeOffDutyBg: '#38250C',
        badgeSpecialBg: '#2F1B45',
        badgeReservedBg: '#3D280B',
        badgeReservedText: '#FCD34D',
        timeSectionBorder: '#374151',
        timeSectionTitle: '#F8FAFC',
        timeSelectBg: '#1E2124',
        timeSelectBorder: '#374151',
        timeSelectText: '#F8FAFC',
        timeSelectPlaceholder: '#94A3B8',
        statusBarBg: '#2B1E14',
        statusBarBorder: '#7C3712',
        statusBarText: '#FED7AA',
      };
    }
    return {
      cardBg: '#FFFFFF',
      cardBorder: '#E2E8F0',
      headerTitle: '#0F172A',
      subText: '#64748B',
      weekdayDefaultText: '#64748B',
      weekdayWeekendBg: '#FFFBEB',
      weekdayWeekendBorder: '#FEF08A',
      weekdayWeekendText: '#B45309',
      cellEmptyBg: '#FAFAFA',
      cellEmptyBorder: '#F3F4F6',
      cellDefaultBg: '#FFFFFF',
      cellDefaultBorder: '#E2E8F0',
      cellDefaultText: '#1E293B',
      cellPastText: '#CBD5E1',
      cellPastBorder: '#F1F5F9',
      cellPastBg: '#FAFAFA',
      cellTodayBg: '#F0FDF4',
      cellTodayBorder: '#86EFAC',
      cellTodayText: '#065F46',
      cellHighlightBg: '#F0FDF4',
      cellHighlightBorder: '#86EFAC',
      cellHighlightText: '#065F46',
      cellSelectedBg: '#FFF7ED',
      cellSelectedBorder: '#EA580C',
      cellSelectedText: '#143325',
      cellFullyBookedBg: '#FFF1F2',
      cellFullyBookedBorder: '#FECDD3',
      cellFullyBookedText: '#9F1239',
      cellSpecialBg: '#FAF5FF',
      cellSpecialBorder: '#DDD6FE',
      cellSpecialText: '#7C3AED',
      modeOffDutyBgActive: '#FEF3C7',
      modeOffDutyBgInactive: '#FFFBEB',
      modeOffDutyBorder: '#FDE68A',
      modeOffDutyText: '#D97706',
      blockBtnBg: '#FEF2F2',
      blockBtnBorder: '#FCA5A5',
      workBtnBg: '#FFF7ED',
      workBtnBorder: '#EA580C',
      resetBtnBg: '#FFFFFF',
      resetBtnBorder: '#CBD5E1',
      resetBtnText: '#64748B',
      legendDotsBg: '#F8FAFC',
      legendDotsBorder: '#E2E8F0',
      bannerFullBg: '#FEF2F2',
      bannerFullBorder: '#FCA5A5',
      bannerFullTitle: '#991B1B',
      bannerFullText: '#B91C1C',
      badgeFullBg: '#FEE2E2',
      badgeFullText: '#DC2626',
      badgeOffDutyBg: '#FEF3C7',
      badgeSpecialBg: '#F3E8FF',
      badgeReservedBg: '#FEF3C7',
      badgeReservedText: '#92400E',
      timeSectionBorder: '#F1F5F9',
      timeSectionTitle: '#0F172A',
      timeSelectBg: '#FFFFFF',
      timeSelectBorder: '#CBD5E1',
      timeSelectText: '#0F172A',
      timeSelectPlaceholder: '#64748B',
      statusBarBg: '#FFF7ED',
      statusBarBorder: '#FED7AA',
      statusBarText: '#143325',
    };
  }, [isDark]);

  const handleResetMonth = () => {
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
    if (onResetToToday) onResetToToday();
  };

  const isCharcoalHeader = !headerBg || headerBg === '#24272B' || headerBg.toLowerCase().includes('24272b') || headerBg.toLowerCase().includes('charcoal');

  return (
    <View
      style={{
        backgroundColor: theme.cardBg,
        borderRadius: isMobile ? 16 : 24,
        borderWidth: 1.5,
        borderColor: theme.cardBorder,
        overflow: 'hidden',
        boxShadow: isDark ? '0 8px 30px rgba(0, 0, 0, 0.35)' : '0 8px 30px rgba(0, 0, 0, 0.05)',
      }}
    >
      {/* ── Calendar Charcoal Header ── */}
      <View
        style={{
          backgroundColor: headerBg,
          paddingHorizontal: isMobile ? 12 : 24,
          paddingTop: isMobile ? 14 : 20,
          paddingBottom: isMobile ? 12 : 16,
          borderBottomWidth: 1,
          borderBottomColor: isDark ? '#374151' : '#32373D',
        }}
      >
        {/* ── 1. Top Header Row ── */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: 12,
            marginBottom: isMobile ? 12 : 16,
          }}
        >
          {/* Navigation & Month Title */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: isMobile ? 8 : 12, flexWrap: 'wrap' }}>
            {/* Prev Month */}
            <TouchableOpacity
              onPress={() => setViewDate(new Date(year, month - 1, 1))}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: isCharcoalHeader ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                borderWidth: isCharcoalHeader ? 1 : 0,
                borderColor: isCharcoalHeader ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              activeOpacity={0.7}
            >
              <BootstrapIcon name="chevron-left" size={12} color="#EA580C" />
            </TouchableOpacity>

            {/* Month & Year Title */}
            <Text
              style={{
                fontSize: isMobile ? 19 : 24,
                fontWeight: '600',
                color: isCharcoalHeader ? '#F8FAFC' : theme.headerTitle,
                letterSpacing: -0.4,
                fontFamily: Platform.OS === 'web' ? 'Inter, sans-serif' : undefined,
              }}
            >
              {MONTH_NAMES[month]} {year}
            </Text>

            {/* Next Month */}
            <TouchableOpacity
              onPress={() => setViewDate(new Date(year, month + 1, 1))}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: isCharcoalHeader ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                borderWidth: isCharcoalHeader ? 1 : 0,
                borderColor: isCharcoalHeader ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              activeOpacity={0.7}
            >
              <BootstrapIcon name="chevron-right" size={12} color="#EA580C" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 2. Weekday Headers ── */}
        <View style={{ flexDirection: 'row', gap: isMobile ? 4 : 8 }}>
          {DAY_HEADERS.map((dh, i) => {
            if (dh.isWeekend) {
              return (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    paddingVertical: isMobile ? 6 : 8,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isCharcoalHeader ? 'rgba(245, 158, 11, 0.16)' : theme.weekdayWeekendBg,
                    borderWidth: 1.5,
                    borderColor: isCharcoalHeader ? 'rgba(245, 158, 11, 0.45)' : theme.weekdayWeekendBorder,
                    borderRadius: 14,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: isMobile ? 9 : 11,
                      fontWeight: '600',
                      color: isCharcoalHeader ? '#FCD34D' : theme.weekdayWeekendText,
                      letterSpacing: 0.3,
                      fontFamily: Platform.OS === 'web' ? 'Inter, sans-serif' : undefined,
                    }}
                  >
                    {isMobile ? dh.short : dh.label}
                  </Text>
                </View>
              );
            }

            return (
              <View
                key={i}
                style={{
                  flex: 1,
                  paddingVertical: isMobile ? 6 : 8,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: isMobile ? 9.5 : 11.5,
                    fontWeight: '700',
                    color: isCharcoalHeader ? '#CBD5E1' : theme.weekdayDefaultText,
                    letterSpacing: 0.4,
                    fontFamily: Platform.OS === 'web' ? 'Inter, sans-serif' : undefined,
                  }}
                >
                  {dh.short}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* ── Calendar Body ── */}
      <View style={{ padding: isMobile ? 12 : 24 }}>
        {/* ── Fully Booked In-Calendar Notification Alert ── */}
        {showFullyBookedBanner && (
          <View
            style={{
              backgroundColor: theme.bannerFullBg,
              borderWidth: 1.5,
              borderColor: theme.bannerFullBorder,
              borderRadius: 12,
              padding: 12,
              marginBottom: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: isDark ? '#4D1518' : '#FEE2E2',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BootstrapIcon name="exclamation-octagon-fill" size={14} color="#DC2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.bannerFullTitle, fontFamily: Platform.OS === 'web' ? 'Inter, sans-serif' : undefined }}>
                  Notice: {selectedDate} is FULLY BOOKED!
                </Text>
                <Text style={{ fontSize: 11.5, color: theme.bannerFullText, marginTop: 1, fontFamily: Platform.OS === 'web' ? 'Inter, sans-serif' : undefined }}>
                  All pit bay slots and technicians are booked for this day. You may select another date or contact the shop.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setDismissedWarningDate(selectedDate)}
              style={{ padding: 4, cursor: 'pointer' }}
            >
              <BootstrapIcon name="x-lg" size={12} color="#DC2626" />
            </TouchableOpacity>
          </View>
        )}

        {/* ── 3. Date Grid ── */}
        <View style={{ gap: isMobile ? 6 : 8 }}>
        {weeks.map((week, wIdx) => (
          <View key={wIdx} style={{ flexDirection: 'row', gap: isMobile ? 4 : 8 }}>
            {week.map((cell, cIdx) => {
              if (cell.isEmpty) {
                return (
                  <View
                    key={cIdx}
                    style={{
                      flex: 1,
                      minHeight: isMobile ? 54 : 82,
                      borderRadius: isMobile ? 12 : 16,
                      backgroundColor: theme.cellEmptyBg,
                      borderWidth: 1.5,
                      borderColor: theme.cellEmptyBorder,
                    }}
                  />
                );
              }

              const isSunday = cIdx === 0;
              const isSaturday = cIdx === 6;

              const info = getDayInfo ? getDayInfo(cell.dateStr) : {};
              const bookingCount = info.bookingCount || 0;
              const isFullyBooked = info.isFullyBooked || false;
              const isOffDuty = info.isOffDuty ?? isSunday; // default Sunday off-duty
              const isSpecial = info.isSpecial || false;
              const isHighlight = info.isHighlight || false;
              const dayLabel = info.label || (cell.day === 7 ? 'Open' : null);
              const totalSlots = info.totalSlots ?? 5;
              const availableSlots = typeof info.availableSlots === 'number'
                ? info.availableSlots
                : isFullyBooked
                  ? 0
                  : Math.max(0, totalSlots - bookingCount);

              const { isSelected, isToday, isPast } = cell;

              // Card styling fitting the MotoTrack Road Teal & Danger design system
              let cardBg = theme.cellDefaultBg;
              let cardBorder = theme.cellDefaultBorder;
              let borderWidth = 1.5;
              let numColor = theme.cellDefaultText;

              if (isSelected) {
                if (isFullyBooked) {
                  // Selected Fully Booked Day: Distinct Red
                  cardBg = theme.cellFullyBookedBg;
                  cardBorder = '#DC2626';
                  borderWidth = 2;
                  numColor = theme.cellFullyBookedText;
                } else {
                  // Selected Available Day: MotoTrack Road Teal
                  cardBg = theme.cellSelectedBg;
                  cardBorder = theme.cellSelectedBorder;
                  borderWidth = 2;
                  numColor = theme.cellSelectedText;
                }
              } else if (isFullyBooked && !isPast) {
                // Unselected Fully Booked: Soft Rose Warning Tint
                cardBg = theme.cellFullyBookedBg;
                cardBorder = theme.cellFullyBookedBorder;
                numColor = theme.cellFullyBookedText;
              } else if (isSpecial) {
                cardBg = theme.cellSpecialBg;
                cardBorder = theme.cellSpecialBorder;
                numColor = theme.cellSpecialText;
              } else if (isHighlight || (isToday && !isSelected)) {
                cardBg = theme.cellTodayBg;
                cardBorder = theme.cellTodayBorder;
                numColor = theme.cellTodayText;
              } else if (isPast) {
                cardBg = theme.cellPastBg;
                cardBorder = theme.cellPastBorder;
                numColor = theme.cellPastText;
              }

              // Status dot color
              let dotColor = '#EA580C'; // MotoTrack Road Teal for available
              if (isFullyBooked) dotColor = '#DC2626'; // Red for fully booked
              else if (bookingCount > 0) dotColor = isDark ? '#F59E0B' : '#D97706'; // Amber for reserved slots

              return (
                <TouchableOpacity
                  key={cIdx}
                  disabled={isPast}
                  onPress={() => handleCellPress(cell)}
                  activeOpacity={0.75}
                  style={{
                    flex: 1,
                    minHeight: isMobile ? 54 : 82,
                    borderRadius: isMobile ? 12 : 16,
                    backgroundColor: cardBg,
                    borderWidth,
                    borderColor: cardBorder,
                    padding: isMobile ? 5 : 8,
                    justifyContent: 'space-between',
                    cursor: isPast ? 'not-allowed' : 'pointer',
                    position: 'relative',
                  }}
                >
                  {/* Top Row: Day Number + Status Indicators */}
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: isMobile ? 11 : 13,
                        fontWeight: isSelected || isSpecial || isToday || isFullyBooked ? '600' : '500',
                        color: numColor,
                      }}
                    >
                      {cell.day}
                    </Text>

                    {/* Right Indicators: Fully Booked Badge, Coffee Cup, Purple Star, Status Dot */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      {/* Fully Booked Icon Badge */}
                      {isFullyBooked && !isPast && (
                        <View
                          style={{
                            width: isMobile ? 12 : 15,
                            height: isMobile ? 12 : 15,
                            borderRadius: 4,
                            backgroundColor: theme.badgeFullBg,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          title="Fully Booked"
                        >
                          <BootstrapIcon name="slash-circle-fill" size={isMobile ? 7 : 8.5} color={isDark ? '#FCA5A5' : '#DC2626'} />
                        </View>
                      )}

                      {/* Coffee Cup Badge (Off-duty / Weekend) */}
                      {!isFullyBooked && isOffDuty && !isPast && (
                        <View
                          style={{
                            width: isMobile ? 12 : 15,
                            height: isMobile ? 12 : 15,
                            borderRadius: 4,
                            backgroundColor: theme.badgeOffDutyBg,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <BootstrapIcon name="cup-hot-fill" size={isMobile ? 7 : 8.5} color={theme.modeOffDutyText} />
                        </View>
                      )}

                      {/* Purple Star Badge (Holiday / Special) */}
                      {isSpecial && !isPast && (
                        <View
                          style={{
                            width: isMobile ? 12 : 15,
                            height: isMobile ? 12 : 15,
                            borderRadius: 4,
                            backgroundColor: theme.badgeSpecialBg,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <BootstrapIcon name="star-fill" size={isMobile ? 7 : 8.5} color={theme.cellSpecialText} />
                        </View>
                      )}

                      {/* Status Dot */}
                      {!isPast && (
                        <View
                          style={{
                            width: isMobile ? 5 : 6.5,
                            height: isMobile ? 5 : 6.5,
                            borderRadius: 4,
                            backgroundColor: dotColor,
                          }}
                        />
                      )}
                    </View>
                  </View>

                  {/* Card Content Body: Selected Pills or booking indicators */}
                  {isSelected && (
                    <View style={{ marginTop: isMobile ? 2 : 6, gap: isMobile ? 2 : 4 }}>
                      {isFullyBooked && (
                        /* Selected Fully Booked Pill */
                        <View
                          style={{
                            backgroundColor: '#DC2626',
                            borderRadius: isMobile ? 5 : 7,
                            paddingHorizontal: isMobile ? 4 : 6,
                            paddingVertical: isMobile ? 2 : 4,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <BootstrapIcon name="x-circle-fill" size={isMobile ? 8 : 10} color="#FFFFFF" />
                            <Text
                              style={{
                                fontSize: isMobile ? 8.5 : 10.5,
                                fontWeight: '600',
                                color: '#FFFFFF',
                              }}
                            >
                              FULL
                            </Text>
                          </View>
                          <BootstrapIcon name="chevron-right" size={isMobile ? 7 : 9} color="#FFFFFF" />
                        </View>
                      )}

                      {/* Strip with garage icon and available slots */}
                      <View
                        style={{
                          backgroundColor: isFullyBooked
                            ? (isDark ? '#4D1518' : '#FEE2E2')
                            : (isDark ? '#432311' : '#FED7AA'),
                          borderRadius: 6,
                          paddingVertical: 3,
                          paddingHorizontal: 5,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 3.5,
                        }}
                        title={isFullyBooked ? '0 slots available' : `${availableSlots} slots available`}
                      >
                        <BootstrapIcon
                          name={isFullyBooked ? 'slash-circle' : 'tools'}
                          size={isMobile ? 8 : 9}
                          color={isFullyBooked ? (isDark ? '#F87171' : '#DC2626') : '#EA580C'}
                        />
                        <Text
                          style={{
                            fontSize: isMobile ? 8 : 9.5,
                            fontWeight: '600',
                            color: isFullyBooked ? (isDark ? '#F87171' : '#DC2626') : '#EA580C',
                            fontVariant: ['tabular-nums'],
                          }}
                          numberOfLines={1}
                        >
                          {isFullyBooked ? '0' : availableSlots}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Non-selected day with bookings or fully booked */}
                  {!isSelected && isFullyBooked && !isPast && (
                    <View
                      style={{
                        backgroundColor: theme.badgeFullBg,
                        borderRadius: 6,
                        paddingHorizontal: 4,
                        paddingVertical: 2,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 2,
                        marginTop: 4,
                        alignSelf: 'stretch',
                      }}
                    >
                      <BootstrapIcon name="slash-circle-fill" size={7} color={isDark ? '#FCA5A5' : '#DC2626'} />
                      <Text style={{ fontSize: isMobile ? 7.5 : 8.5, fontWeight: '600', color: theme.cellFullyBookedText }}>
                        FULL
                      </Text>
                    </View>
                  )}

                  {!isSelected && !isFullyBooked && bookingCount > 0 && !isPast && (
                    <View
                      style={{
                        backgroundColor: theme.badgeReservedBg,
                        borderRadius: 6,
                        paddingHorizontal: 4,
                        paddingVertical: 2,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 3,
                        marginTop: 4,
                        alignSelf: 'stretch',
                      }}
                      title={`${availableSlots} slots available`}
                    >
                      <BootstrapIcon name="tools" size={8} color={theme.badgeReservedText} />
                      <Text style={{ fontSize: 9, fontWeight: '600', color: theme.badgeReservedText, fontVariant: ['tabular-nums'] }}>
                        {availableSlots}
                      </Text>
                    </View>
                  )}

                  {/* Faint day label (e.g. "Open") */}
                  {!isSelected && !isFullyBooked && bookingCount === 0 && dayLabel && !isPast && (
                    <Text
                      style={{
                        fontSize: isMobile ? 8 : 9.5,
                        color: theme.subText,
                        fontWeight: '600',
                        marginTop: 'auto',
                      }}
                    >
                      {dayLabel}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      {/* ── 3.5. Time Slot Selection Section ── */}
      {onSelectTime && (
        <View
          style={{
            marginTop: 18,
            paddingTop: 16,
            borderTopWidth: 1.5,
            borderTopColor: theme.timeSectionBorder,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: isDark ? '#2B1F16' : '#FFF7ED',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BootstrapIcon name="clock-fill" size={13} color="#EA580C" />
              </View>
              <Text style={{ fontSize: isMobile ? 13 : 14, fontWeight: '600', color: theme.timeSectionTitle }}>
                Select Appointment Time Slot
              </Text>
            </View>

            {selectedTime ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  backgroundColor: isDark ? '#2B1F16' : '#FFF7ED',
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: isDark ? '#EA580C' : '#A7F3D0',
                }}
              >
                <BootstrapIcon name="check-circle-fill" size={12} color="#EA580C" />
                <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#FB923C' : '#EA580C' }}>
                  {selectedTime}
                </Text>
              </View>
            ) : (
              <Text style={{ fontSize: 11.5, fontWeight: '600', color: theme.timeSelectPlaceholder }}>
                Select a time slot below
              </Text>
            )}
          </View>

          {/* Time Slot Dropdown with Chevron */}
          {Platform.OS === 'web' ? (
            <div style={{ position: 'relative', width: '100%' }}>
              <select
                value={selectedTime || ''}
                onChange={(e) => onSelectTime?.(e.target.value)}
                style={{
                  width: '100%',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  backgroundColor: theme.timeSelectBg,
                  border: selectedTime ? '1.5px solid #EA580C' : `1.5px solid ${theme.timeSelectBorder}`,
                  borderRadius: 12,
                  padding: '12px 38px 12px 14px',
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: selectedTime ? theme.timeSelectText : theme.timeSelectPlaceholder,
                  fontFamily: 'inherit',
                  outline: 'none',
                  cursor: 'pointer',
                  boxShadow: selectedTime ? '0 0 0 3px rgba(234, 88, 12, 0.2)' : (isDark ? '0 1px 3px rgba(0, 0, 0, 0.3)' : '0 1px 3px rgba(0, 0, 0, 0.05)'),
                  transition: 'all 0.2s ease',
                }}
              >
                {!selectedTime && (
                  <option value="" disabled style={{ backgroundColor: theme.timeSelectBg, color: theme.timeSelectPlaceholder }}>
                    Choose an appointment time slot...
                  </option>
                )}
                {(getTimeSlots ? getTimeSlots(selectedDate) : timeSlots).map((slot) => {
                  const slotStr = typeof slot === 'string' ? slot : slot.timeSlot;
                  const isBooked = typeof slot === 'object' ? !!slot.isBooked : false;
                  return (
                    <option
                      key={slotStr}
                      value={slotStr}
                      disabled={isBooked}
                      style={{
                        backgroundColor: theme.timeSelectBg,
                        color: isBooked ? (isDark ? '#64748B' : '#94A3B8') : theme.timeSelectText,
                        fontWeight: selectedTime === slotStr ? '600' : '500',
                      }}
                    >
                      {slotStr} {isBooked ? '— (Fully Booked)' : '— (Available)'}
                    </option>
                  );
                })}
              </select>
              <div
                style={{
                  position: 'absolute',
                  right: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <BootstrapIcon name="chevron-down" size={13} color="#EA580C" />
              </div>
            </div>
          ) : (
            <BookingSelect
              placeholder="Choose an appointment time slot..."
              value={selectedTime}
              options={(getTimeSlots ? getTimeSlots(selectedDate) : timeSlots).map((slot) => {
                const slotStr = typeof slot === 'string' ? slot : slot.timeSlot;
                const isBooked = typeof slot === 'object' ? !!slot.isBooked : false;
                return {
                  value: slotStr,
                  label: `${slotStr} ${isBooked ? '— (Fully Booked)' : '— (Available)'}`,
                  disabled: isBooked,
                };
              })}
              onChange={(val) => onSelectTime?.(val)}
              accentColor="#EA580C"
              isDarkMode={isDark}
            />
          )}
        </View>
      )}

      {/* ── 4. Bottom Status Bar (MotoTrack Theme) ── */}
      <View
        style={{
          marginTop: 16,
          backgroundColor: theme.statusBarBg,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: theme.statusBarBorder,
          paddingHorizontal: isMobile ? 10 : 16,
          paddingVertical: isMobile ? 8 : 10,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        {/* Info Text */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
          <BootstrapIcon name="info-circle-fill" size={13} color="#EA580C" />
          <Text
            numberOfLines={2}
            style={{
              fontSize: isMobile ? 10.5 : 12,
              color: theme.statusBarText,
              lineHeight: 16,
            }}
          >
            {statusBarText ? (
              statusBarText
            ) : (
              <>
                Hours: <Text style={{ fontWeight: '600', color: '#EA580C' }}>9:00 AM – 6:00 PM</Text> (Mon – Sat). Tap any date to choose or view slot availability.
              </>
            )}
          </Text>
        </View>

        {/* Action Button: Road Teal pill with wrench and counter (Admin only) */}
        {showAdminControls && (
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: '#EA580C',
              borderRadius: 20,
              paddingHorizontal: isMobile ? 10 : 14,
              paddingVertical: isMobile ? 5 : 7,
              cursor: 'pointer',
            }}
            activeOpacity={0.85}
          >
            <BootstrapIcon name="tools" size={isMobile ? 11 : 12} color="#FFFFFF" />
            <Text
              style={{
                fontSize: isMobile ? 11 : 12.5,
                fontWeight: '600',
                color: '#FFFFFF',
              }}
            >
              {offDutyCount || 1}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  </View>
);
}
