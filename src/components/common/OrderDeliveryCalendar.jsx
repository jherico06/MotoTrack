import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import BootstrapIcon from './BootstrapIcon';
import { localYmd } from '../../utils/deliveryDate';

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

/**
 * OrderDeliveryCalendar — A sleek, compact delivery calendar inspired by the MotoTrack BookingCalendar UI.
 * Designed specifically for order management and fulfillment modals.
 *
 * Props:
 * - selectedDate: string (YYYY-MM-DD)
 * - onSelectDate: (dateStr: string) => void
 * - minDate: string (YYYY-MM-DD)
 * - isDarkMode: boolean
 */
export default function OrderDeliveryCalendar({
  selectedDate,
  onSelectDate,
  minDate,
  isDarkMode = false,
}) {
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => localYmd(today), [today]);

  const [viewDate, setViewDate] = useState(() => {
    if (selectedDate) {
      const parts = selectedDate.split('-');
      if (parts.length === 3) {
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
      }
    }
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

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
    const isPast = cutoff ? dateStr < cutoff : false;
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

  const handlePrevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  const handleJumpToToday = () => {
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
    if (onSelectDate) onSelectDate(todayStr);
  };

  return (
    <View
      style={[
        styles.container,
        isDarkMode && {
          backgroundColor: '#141A18',
          borderColor: '#2D3748',
        },
      ]}
    >
      {/* ── 1. Top Header Row: Nav + Month Title + Today Jump ── */}
      <View style={styles.headerRow}>
        <View style={styles.navGroup}>
          {/* Prev Month */}
          <TouchableOpacity
            onPress={handlePrevMonth}
            style={[styles.navBtn, isDarkMode && { backgroundColor: '#1C2422', borderColor: '#334155' }]}
            activeOpacity={0.7}
          >
            <BootstrapIcon name="chevron-left" size={11} color={isDarkMode ? '#CBD5E1' : '#1D4533'} />
          </TouchableOpacity>

          {/* Month & Year Title */}
          <Text
            style={[
              styles.monthTitle,
              isDarkMode && { color: '#F8FAFC' },
            ]}
          >
            {MONTH_NAMES[month]} {year}
          </Text>

          {/* Next Month */}
          <TouchableOpacity
            onPress={handleNextMonth}
            style={[styles.navBtn, isDarkMode && { backgroundColor: '#1C2422', borderColor: '#334155' }]}
            activeOpacity={0.7}
          >
            <BootstrapIcon name="chevron-right" size={11} color={isDarkMode ? '#CBD5E1' : '#1D4533'} />
          </TouchableOpacity>
        </View>

        {/* Quick jump to Current Month / Today */}
        <TouchableOpacity
          onPress={handleJumpToToday}
          style={[styles.todayBtn, isDarkMode && { backgroundColor: '#1C2422', borderColor: '#334155' }]}
          activeOpacity={0.75}
        >
          <Text style={[styles.todayBtnText, isDarkMode && { color: '#94A3B8' }]}>Today</Text>
        </TouchableOpacity>
      </View>

      {/* ── 2. Weekday Header Pills ── */}
      <View style={styles.weekdaysRow}>
        {DAY_HEADERS.map((dh, i) => {
          if (dh.isWeekend) {
            return (
              <View key={i} style={styles.weekendPill}>
                <Text numberOfLines={1} style={styles.weekendText}>
                  {dh.label}
                </Text>
              </View>
            );
          }

          return (
            <View key={i} style={styles.weekdayCol}>
              <Text style={[styles.weekdayText, isDarkMode && { color: '#94A3B8' }]}>
                {dh.short}
              </Text>
            </View>
          );
        })}
      </View>

      {/* ── 3. Date Grid ── */}
      <View style={styles.grid}>
        {weeks.map((week, wIdx) => (
          <View key={wIdx} style={styles.weekRow}>
            {week.map((cell, cIdx) => {
              if (cell.isEmpty) {
                return (
                  <View
                    key={cIdx}
                    style={[
                      styles.cell,
                      styles.emptyCell,
                      isDarkMode && { backgroundColor: '#1C2422', borderColor: '#2D3748' },
                    ]}
                  />
                );
              }

              const isSunday = cIdx === 0;
              const { isSelected, isToday, isPast } = cell;

              let cardBg = isDarkMode ? '#1E293B' : '#FFFFFF';
              let cardBorder = isDarkMode ? '#334155' : '#E2E8F0';
              let borderWidth = 1.2;
              let numColor = isDarkMode ? '#F1F5F9' : '#1E293B';
              let dotColor = '#10B981';
              let statusLabel = isSunday ? 'Rest' : 'Open';

              if (isSelected) {
                cardBg = isDarkMode ? '#1D4533' : '#E8F0EC';
                cardBorder = '#1D4533';
                borderWidth = 1.8;
                numColor = isDarkMode ? '#FFFFFF' : '#143325';
                dotColor = '#1D4533';
                statusLabel = 'Selected';
              } else if (isToday && !isSelected) {
                cardBg = isDarkMode ? '#064E3B' : '#F0FDF4';
                cardBorder = '#86EFAC';
                numColor = isDarkMode ? '#A7F3D0' : '#065F46';
                dotColor = '#10B981';
              } else if (isPast) {
                cardBg = isDarkMode ? '#141A18' : '#F8FAFC';
                cardBorder = isDarkMode ? '#1E293B' : '#F1F5F9';
                numColor = isDarkMode ? '#475569' : '#CBD5E1';
                statusLabel = '';
              }

              return (
                <TouchableOpacity
                  key={cIdx}
                  disabled={isPast}
                  onPress={() => onSelectDate?.(cell.dateStr)}
                  activeOpacity={0.75}
                  style={[
                    styles.cell,
                    {
                      backgroundColor: cardBg,
                      borderColor: cardBorder,
                      borderWidth,
                      opacity: isPast ? 0.35 : 1,
                    },
                  ]}
                >
                  {/* Top: Day Number + Status Dot / Coffee Cup */}
                  <View style={styles.cellTop}>
                    <Text
                      style={[
                        styles.dayNumber,
                        {
                          color: numColor,
                          fontWeight: isSelected || isToday ? '800' : '600',
                        },
                      ]}
                    >
                      {cell.day}
                    </Text>

                    {/* Status Dot */}
                    {!isPast && (
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: isSunday ? (isDarkMode ? '#64748B' : '#CBD5E1') : dotColor },
                        ]}
                      />
                    )}
                  </View>

                  {/* Bottom: "Open", "Selected", or "Rest" */}
                  {!isPast && (
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.cellStatus,
                        {
                          color: isSelected
                            ? (isDarkMode ? '#A7F3D0' : '#1D4533')
                            : (isDarkMode ? '#94A3B8' : '#64748B'),
                          fontWeight: isSelected ? '800' : '600',
                        },
                      ]}
                    >
                      {statusLabel}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    padding: 10,
    marginTop: 4,
    width: '100%',
    boxShadow: '0 4px 18px rgba(0,0,0,0.04)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  navGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    fontFamily: Platform.OS === 'web' ? 'Georgia, "Playfair Display", serif' : undefined,
    letterSpacing: -0.2,
  },
  todayBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  todayBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
  },
  weekdaysRow: {
    flexDirection: 'row',
    gap: 3,
    marginBottom: 4,
  },
  weekendPill: {
    flex: 1,
    paddingVertical: 3.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FEF08A',
    borderRadius: 8,
  },
  weekendText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#B45309',
    letterSpacing: 0.2,
  },
  weekdayCol: {
    flex: 1,
    paddingVertical: 3.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.3,
  },
  grid: {
    gap: 3,
  },
  weekRow: {
    flexDirection: 'row',
    gap: 3,
  },
  cell: {
    flex: 1,
    height: 38,
    borderRadius: 7,
    paddingHorizontal: 4,
    paddingVertical: 3,
    justifyContent: 'space-between',
  },
  emptyCell: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  cellTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayNumber: {
    fontSize: 10.5,
  },
  statusDot: {
    width: 4.5,
    height: 4.5,
    borderRadius: 2.5,
  },
  coffeeIcon: {
    fontSize: 8,
    lineHeight: 10,
  },
  cellStatus: {
    fontSize: 7.5,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
});
