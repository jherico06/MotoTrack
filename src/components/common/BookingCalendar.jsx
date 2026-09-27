import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Platform, useWindowDimensions } from 'react-native';
import BootstrapIcon from './BootstrapIcon';
import BookingSelect from './BookingSelect';

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
  isDarkMode = false,
  compact = false,
  showAdminControls = false,
  selectedTime,
  onSelectTime,
  timeSlots = DEFAULT_TIME_SLOTS,
  getTimeSlots,
}) {
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

  // Schedule View Mode: 'schedule' (clock) | 'offDuty' (coffee)
  const [activeMode, setActiveMode] = useState('schedule');
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
    if (activeMode === 'offDuty' && onToggleOffDuty) {
      onToggleOffDuty(cell.dateStr);
    } else {
      const info = getDayInfo ? getDayInfo(cell.dateStr) : {};
      onSelectDate?.(cell.dateStr);

      if (info.isFullyBooked) {
        setDismissedWarningDate(null);
        onFullyBookedSelected?.(cell.dateStr);
      }
    }
  };

  const handleResetMonth = () => {
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
    if (onResetToToday) onResetToToday();
  };

  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: isMobile ? 16 : 24,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        padding: isMobile ? 12 : 24,
        overflow: 'hidden',
        boxShadow: '0 8px 30px rgba(29, 69, 51, 0.05)',
      }}
    >
      {/* ── 1. Top Header Row ── */}
      <View
        style={{
          flexDirection: isMobile && showAdminControls ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: showAdminControls ? 'space-between' : 'flex-start',
          gap: 12,
          marginBottom: 16,
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
              backgroundColor: '#FFFFFF',
              borderWidth: 1.2,
              borderColor: '#E2E8F0',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            activeOpacity={0.7}
          >
            <BootstrapIcon name="chevron-left" size={12} color="#1D4533" />
          </TouchableOpacity>

          {/* Month & Year Title */}
          <Text
            style={{
              fontSize: isMobile ? 19 : 24,
              fontWeight: '800',
              color: '#0F172A',
              letterSpacing: -0.4,
              fontFamily: Platform.OS === 'web' ? 'Georgia, "Playfair Display", serif' : undefined,
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
              backgroundColor: '#FFFFFF',
              borderWidth: 1.2,
              borderColor: '#E2E8F0',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            activeOpacity={0.7}
          >
            <BootstrapIcon name="chevron-right" size={12} color="#1D4533" />
          </TouchableOpacity>

          {/* Mode Toggles (Admin only) */}
          {showAdminControls && (
            <>
              {/* Mode Toggle: Clock (Business / Schedule) */}
              <TouchableOpacity
                onPress={() => setActiveMode('schedule')}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: activeMode === 'schedule' ? '#1D4533' : '#E8F0EC',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  marginLeft: 4,
                }}
                activeOpacity={0.8}
                title="Business Schedule View"
              >
                <BootstrapIcon
                  name="clock-fill"
                  size={13}
                  color={activeMode === 'schedule' ? '#FFFFFF' : '#1D4533'}
                />
              </TouchableOpacity>

              {/* Mode Toggle: Coffee (Break / Off-duty) */}
              <TouchableOpacity
                onPress={() => setActiveMode('offDuty')}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: activeMode === 'offDuty' ? '#FEF3C7' : '#FFFBEB',
                  borderWidth: 1.2,
                  borderColor: activeMode === 'offDuty' ? '#F59E0B' : '#FDE68A',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                activeOpacity={0.8}
                title="Toggle Off-Duty Days"
              >
                <BootstrapIcon name="cup-hot-fill" size={13} color="#D97706" />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Right Side: Quick Action Icons & Status Legend (Admin only) */}
        {showAdminControls && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: isMobile ? 'flex-end' : 'center' }}>
            {/* Action: Ban / Block Date */}
            <TouchableOpacity
              onPress={() => onBlockDate?.(selectedDate)}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: '#FEF2F2',
                borderWidth: 1.2,
                borderColor: '#FCA5A5',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              activeOpacity={0.7}
              title="Block date slots"
            >
              <BootstrapIcon name="slash-circle" size={13} color="#DC2626" />
            </TouchableOpacity>

            {/* Action: Briefcase / Work Day */}
            <TouchableOpacity
              onPress={() => onEnableDate?.(selectedDate)}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: '#E8F0EC',
                borderWidth: 1.2,
                borderColor: '#1D4533',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              activeOpacity={0.7}
              title="Mark as active work day"
            >
              <BootstrapIcon name="briefcase-fill" size={13} color="#1D4533" />
            </TouchableOpacity>

            {/* Action: Reload / Reset to Today */}
            <TouchableOpacity
              onPress={handleResetMonth}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: '#FFFFFF',
                borderWidth: 1.2,
                borderColor: '#CBD5E1',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              activeOpacity={0.7}
              title="Reset to today"
            >
              <BootstrapIcon name="arrow-counterclockwise" size={13} color="#64748B" />
            </TouchableOpacity>

            {/* Legend dots pill */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 8,
                paddingVertical: 5,
                backgroundColor: '#F8FAFC',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#E2E8F0',
                marginLeft: 4,
              }}
            >
              {/* Open / Available (Teal) */}
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#1D4533' }} title="Available" />
              {/* Filling Up (Amber) */}
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#D97706' }} title="Reserved" />
              {/* Fully Booked (Red) */}
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#DC2626' }} title="Fully Booked" />
              {/* Star (Special/Holiday) */}
              <View
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: 3,
                  backgroundColor: '#8B5CF6',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Special Event / Holiday"
              >
                <BootstrapIcon name="star-fill" size={7} color="#FFFFFF" />
              </View>
            </View>
          </View>
        )}
      </View>

      {/* ── Fully Booked In-Calendar Notification Alert ── */}
      {showFullyBookedBanner && (
        <View
          style={{
            backgroundColor: '#FEF2F2',
            borderWidth: 1.5,
            borderColor: '#FCA5A5',
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
                backgroundColor: '#FEE2E2',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BootstrapIcon name="exclamation-octagon-fill" size={14} color="#DC2626" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#991B1B' }}>
                Notice: {selectedDate} is FULLY BOOKED!
              </Text>
              <Text style={{ fontSize: 11.5, color: '#B91C1C', marginTop: 1 }}>
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

      {/* ── 2. Weekday Headers ── */}
      <View style={{ flexDirection: 'row', gap: isMobile ? 4 : 8, marginBottom: 10 }}>
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
                  backgroundColor: '#FFFBEB',
                  borderWidth: 1.5,
                  borderColor: '#FEF08A',
                  borderRadius: 14,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: isMobile ? 9 : 11,
                    fontWeight: '800',
                    color: '#B45309',
                    letterSpacing: 0.3,
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
                  color: '#64748B',
                  letterSpacing: 0.4,
                }}
              >
                {dh.short}
              </Text>
            </View>
          );
        })}
      </View>

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
                      backgroundColor: '#FAFAFA',
                      borderWidth: 1.5,
                      borderColor: '#F3F4F6',
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

              const { isSelected, isToday, isPast } = cell;

              // Card styling fitting the MotoTrack Road Teal & Danger design system
              let cardBg = '#FFFFFF';
              let cardBorder = '#E2E8F0';
              let borderWidth = 1.5;
              let numColor = '#1E293B';

              if (isSelected) {
                if (isFullyBooked) {
                  // Selected Fully Booked Day: Distinct Red
                  cardBg = '#FEF2F2';
                  cardBorder = '#DC2626';
                  borderWidth = 2;
                  numColor = '#991B1B';
                } else {
                  // Selected Available Day: MotoTrack Road Teal
                  cardBg = '#E8F0EC';
                  cardBorder = '#1D4533';
                  borderWidth = 2;
                  numColor = '#143325';
                }
              } else if (isFullyBooked && !isPast) {
                // Unselected Fully Booked: Soft Rose Warning Tint
                cardBg = '#FFF1F2';
                cardBorder = '#FECDD3';
                numColor = '#9F1239';
              } else if (isSpecial) {
                cardBg = '#FAF5FF';
                cardBorder = '#DDD6FE';
                numColor = '#7C3AED';
              } else if (isHighlight || (isToday && !isSelected)) {
                cardBg = '#F0FDF4';
                cardBorder = '#86EFAC';
                numColor = '#065F46';
              } else if (isPast) {
                numColor = '#CBD5E1';
                cardBorder = '#F1F5F9';
              }

              // Status dot color
              let dotColor = '#1D4533'; // MotoTrack Road Teal for available
              if (isFullyBooked) dotColor = '#DC2626'; // Red for fully booked
              else if (bookingCount > 0) dotColor = '#D97706'; // Amber for reserved slots

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
                        fontWeight: isSelected || isSpecial || isToday || isFullyBooked ? '800' : '600',
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
                            backgroundColor: '#FEE2E2',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          title="Fully Booked"
                        >
                          <BootstrapIcon name="slash-circle-fill" size={isMobile ? 7 : 8.5} color="#DC2626" />
                        </View>
                      )}

                      {/* Coffee Cup Badge (Off-duty / Weekend) */}
                      {!isFullyBooked && isOffDuty && !isPast && (
                        <View
                          style={{
                            width: isMobile ? 12 : 15,
                            height: isMobile ? 12 : 15,
                            borderRadius: 4,
                            backgroundColor: '#FEF3C7',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <BootstrapIcon name="cup-hot-fill" size={isMobile ? 7 : 8.5} color="#D97706" />
                        </View>
                      )}

                      {/* Purple Star Badge (Holiday / Special) */}
                      {isSpecial && !isPast && (
                        <View
                          style={{
                            width: isMobile ? 12 : 15,
                            height: isMobile ? 12 : 15,
                            borderRadius: 4,
                            backgroundColor: '#F3E8FF',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <BootstrapIcon name="star-fill" size={isMobile ? 7 : 8.5} color="#7C3AED" />
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
                      {isFullyBooked ? (
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
                                fontWeight: '800',
                                color: '#FFFFFF',
                              }}
                            >
                              FULL
                            </Text>
                          </View>
                          <BootstrapIcon name="chevron-right" size={isMobile ? 7 : 9} color="#FFFFFF" />
                        </View>
                      ) : (
                        /* Selected Available Day: MotoTrack Road Teal Pill */
                        <View
                          style={{
                            backgroundColor: '#1D4533',
                            borderRadius: isMobile ? 5 : 7,
                            paddingHorizontal: isMobile ? 4 : 7,
                            paddingVertical: isMobile ? 2 : 4,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <BootstrapIcon name="camera-fill" size={isMobile ? 8 : 10} color="#FFFFFF" />
                            <Text
                              style={{
                                fontSize: isMobile ? 9 : 11,
                                fontWeight: '800',
                                color: '#FFFFFF',
                              }}
                            >
                              {bookingCount || 1}
                            </Text>
                          </View>
                          <BootstrapIcon name="chevron-right" size={isMobile ? 7 : 9} color="#FFFFFF" />
                        </View>
                      )}

                      {/* Secondary Strip */}
                      {!isMobile && (
                        <View
                          style={{
                            backgroundColor: isFullyBooked ? '#FEE2E2' : '#C8DDD3',
                            borderRadius: 5,
                            paddingVertical: 3,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <BootstrapIcon
                            name={isFullyBooked ? 'slash-circle' : 'tools'}
                            size={9}
                            color={isFullyBooked ? '#DC2626' : '#1D4533'}
                          />
                        </View>
                      )}
                    </View>
                  )}

                  {/* Non-selected day with bookings or fully booked */}
                  {!isSelected && isFullyBooked && !isPast && (
                    <View
                      style={{
                        backgroundColor: '#FEE2E2',
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
                      <BootstrapIcon name="slash-circle-fill" size={7} color="#DC2626" />
                      <Text style={{ fontSize: isMobile ? 7.5 : 8.5, fontWeight: '800', color: '#DC2626' }}>
                        FULL
                      </Text>
                    </View>
                  )}

                  {!isSelected && !isFullyBooked && bookingCount > 0 && !isPast && (
                    <View
                      style={{
                        backgroundColor: '#FEF3C7',
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
                    >
                      <BootstrapIcon name="tools" size={8} color="#92400E" />
                      <Text style={{ fontSize: 9, fontWeight: '800', color: '#92400E' }}>
                        {bookingCount}
                      </Text>
                    </View>
                  )}

                  {/* Faint day label (e.g. "Open") */}
                  {!isSelected && !isFullyBooked && bookingCount === 0 && dayLabel && !isPast && (
                    <Text
                      style={{
                        fontSize: isMobile ? 8 : 9.5,
                        color: '#94A3B8',
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
            borderTopColor: '#F1F5F9',
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
                  backgroundColor: '#E8F0EC',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BootstrapIcon name="clock-fill" size={13} color="#1D4533" />
              </View>
              <Text style={{ fontSize: isMobile ? 13 : 14, fontWeight: '800', color: '#0F172A' }}>
                Select Appointment Time Slot
              </Text>
            </View>

            {selectedTime ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  backgroundColor: '#E8F0EC',
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: '#A7F3D0',
                }}
              >
                <BootstrapIcon name="check-circle-fill" size={12} color="#1D4533" />
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#1D4533' }}>
                  {selectedTime}
                </Text>
              </View>
            ) : (
              <Text style={{ fontSize: 11.5, fontWeight: '600', color: '#94A3B8' }}>
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
                  backgroundColor: '#FFFFFF',
                  border: selectedTime ? '1.5px solid #1D4533' : '1.5px solid #CBD5E1',
                  borderRadius: 12,
                  padding: '12px 38px 12px 14px',
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: selectedTime ? '#0F172A' : '#64748B',
                  fontFamily: 'inherit',
                  outline: 'none',
                  cursor: 'pointer',
                  boxShadow: selectedTime ? '0 0 0 3px rgba(29, 69, 51, 0.1)' : '0 1px 3px rgba(0, 0, 0, 0.05)',
                  transition: 'all 0.2s ease',
                }}
              >
                {!selectedTime && (
                  <option value="" disabled>
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
                        color: isBooked ? '#94A3B8' : '#0F172A',
                        fontWeight: selectedTime === slotStr ? '800' : '600',
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
                <BootstrapIcon name="chevron-down" size={13} color="#1D4533" />
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
              accentColor="#1D4533"
            />
          )}
        </View>
      )}

      {/* ── 4. Bottom Status Bar (MotoTrack Theme) ── */}
      <View
        style={{
          marginTop: 16,
          backgroundColor: '#F0FDFA',
          borderRadius: 14,
          borderWidth: 1,
          borderColor: '#C8DDD3',
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
          <BootstrapIcon name="info-circle-fill" size={13} color="#1D4533" />
          <Text
            numberOfLines={2}
            style={{
              fontSize: isMobile ? 10.5 : 12,
              color: '#143325',
              lineHeight: 16,
            }}
          >
            Hours: <Text style={{ fontWeight: '800', color: '#1D4533' }}>9:00 AM – 6:00 PM</Text> (Mon – Sat). Tap any date to choose or view slot availability.
          </Text>
        </View>

        {/* Action Button: Road Teal pill with wrench and counter (Admin only) */}
        {showAdminControls && (
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: '#1D4533',
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
                fontWeight: '800',
                color: '#FFFFFF',
              }}
            >
              {offDutyCount || 1}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
