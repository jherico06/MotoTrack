import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import BootstrapIcon from './BootstrapIcon.jsx';
import { getThemeTokens } from '../../styles/theme.js';
import {
  CALENDAR_MONTH_NAMES,
  CALENDAR_WEEKDAYS,
  addDaysYmd,
  buildMonthCalendarWeeks,
  endOfMonthYmd,
  formatPromoDateDisplay,
  parseYmd,
  startOfNextMonthYmd,
  toLocalYmd,
} from '../../utils/promoDate.js';

const BRAND = '#EA580C';

/**
 * Compact interactive calendar + preset picker for start/end date ranges.
 */
export default function DateRangeCalendarPicker({
  activeField = 'startDate',
  onActiveFieldChange,
  startDate = '',
  endDate = '',
  onSelectDate,
  onClearEndDate,
  onClose,
  isDarkMode = false,
}) {
  const tokens = useMemo(() => getThemeTokens(isDarkMode), [isDarkMode]);
  const todayYmd = useMemo(() => toLocalYmd(), []);

  const seedDateStr = activeField === 'endDate' ? endDate || startDate : startDate || endDate;
  const [viewMonth, setViewMonth] = useState(() => {
    const parsed = parseYmd(seedDateStr) || new Date();
    return new Date(parsed.getFullYear(), parsed.getMonth(), 1);
  });

  useEffect(() => {
    const target = parseYmd(activeField === 'endDate' ? endDate || startDate : startDate);
    if (target) {
      setViewMonth(new Date(target.getFullYear(), target.getMonth(), 1));
    }
  }, [activeField, startDate, endDate]);

  const year = viewMonth.getFullYear();
  const monthIndex = viewMonth.getMonth();
  const minDate = activeField === 'endDate' && parseYmd(startDate) ? startDate : '';

  const weeks = useMemo(
    () =>
      buildMonthCalendarWeeks(year, monthIndex, {
        startDate,
        endDate,
        minDate,
        todayYmd,
      }),
    [year, monthIndex, startDate, endDate, minDate, todayYmd]
  );

  const quickPresets = useMemo(() => {
    if (activeField === 'startDate') {
      return [
        { label: 'Today', dateStr: todayYmd },
        { label: 'Tomorrow', dateStr: addDaysYmd(todayYmd, 1) },
        { label: '1st Next Month', dateStr: startOfNextMonthYmd(todayYmd) },
      ];
    }
    const anchor = parseYmd(startDate) ? startDate : todayYmd;
    return [
      { label: '+7 Days', dateStr: addDaysYmd(anchor, 7) },
      { label: '+14 Days', dateStr: addDaysYmd(anchor, 14) },
      { label: '+30 Days', dateStr: addDaysYmd(anchor, 30) },
      { label: 'End of Month', dateStr: endOfMonthYmd(anchor) },
    ];
  }, [activeField, startDate, todayYmd]);

  const styles = useMemo(() => buildStyles(tokens, isDarkMode), [tokens, isDarkMode]);

  const shiftMonth = (deltaMonths) => {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + deltaMonths, 1));
  };

  const handleJumpToday = () => {
    const now = new Date();
    setViewMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    if (activeField === 'startDate' || !minDate || todayYmd >= minDate) {
      onSelectDate?.(activeField, todayYmd);
    }
  };

  return (
    <View style={styles.card}>
      {/* Active Field Target Tabs + Close */}
      <View style={styles.topBar}>
        <View style={styles.modeTabs}>
          <TouchableOpacity
            style={[styles.modeTab, activeField === 'startDate' && styles.modeTabActive]}
            onPress={() => onActiveFieldChange?.('startDate')}
            activeOpacity={0.8}
          >
            <Text style={[styles.modeTabEyebrow, activeField === 'startDate' && styles.modeTabEyebrowActive]}>
              START
            </Text>
            <Text style={[styles.modeTabValue, activeField === 'startDate' && styles.modeTabValueActive]}>
              {formatPromoDateDisplay(startDate) || 'Pick start'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeTab, activeField === 'endDate' && styles.modeTabActive]}
            onPress={() => onActiveFieldChange?.('endDate')}
            activeOpacity={0.8}
          >
            <Text style={[styles.modeTabEyebrow, activeField === 'endDate' && styles.modeTabEyebrowActive]}>
              END
            </Text>
            <Text style={[styles.modeTabValue, activeField === 'endDate' && styles.modeTabValueActive]}>
              {formatPromoDateDisplay(endDate) || 'Optional'}
            </Text>
          </TouchableOpacity>
        </View>

        {onClose ? (
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={onClose}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Close date picker"
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Quick Presets */}
      <View style={styles.presetsRow}>
        {quickPresets.map((preset) => {
          const currentVal = activeField === 'startDate' ? startDate : endDate;
          const isActive = currentVal === preset.dateStr;
          return (
            <TouchableOpacity
              key={preset.label}
              style={[styles.presetChip, isActive && styles.presetChipActive]}
              onPress={() => onSelectDate?.(activeField, preset.dateStr)}
              activeOpacity={0.8}
            >
              <Text style={[styles.presetChipText, isActive && styles.presetChipTextActive]}>
                {preset.label}
              </Text>
            </TouchableOpacity>
          );
        })}

        {activeField === 'endDate' && endDate ? (
          <TouchableOpacity
            style={styles.clearChip}
            onPress={() => onClearEndDate?.()}
            activeOpacity={0.8}
          >
            <BootstrapIcon name="x" size={12} color={isDarkMode ? '#FCA5A5' : '#DC2626'} />
            <Text style={styles.clearChipText}>No Expiry</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Month & Year Navigation */}
      <View style={styles.monthHeader}>
        <View style={styles.monthNavGroup}>
          <TouchableOpacity
            style={styles.navIconBtn}
            onPress={() => shiftMonth(-1)}
            activeOpacity={0.75}
            accessibilityLabel="Previous month"
          >
            <BootstrapIcon
              name="chevron-left"
              size={14}
              color={isDarkMode ? tokens.textSecondary : '#475569'}
            />
          </TouchableOpacity>

          <Text style={styles.monthLabel}>
            {CALENDAR_MONTH_NAMES[monthIndex]} {year}
          </Text>

          <TouchableOpacity
            style={styles.navIconBtn}
            onPress={() => shiftMonth(1)}
            activeOpacity={0.75}
            accessibilityLabel="Next month"
          >
            <BootstrapIcon
              name="chevron-right"
              size={14}
              color={isDarkMode ? tokens.textSecondary : '#475569'}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.todayBtn}
          onPress={handleJumpToday}
          activeOpacity={0.8}
        >
          <Text style={styles.todayBtnText}>Today</Text>
        </TouchableOpacity>
      </View>

      {/* Weekday Labels */}
      <View style={styles.weekdaysRow}>
        {CALENDAR_WEEKDAYS.map((day) => (
          <View key={day} style={styles.weekdayCell}>
            <Text style={styles.weekdayText}>{day}</Text>
          </View>
        ))}
      </View>

      {/* Calendar Grid */}
      <View style={styles.grid}>
        {weeks.map((week, wIdx) => (
          <View key={`wk-${wIdx}`} style={styles.weekRow}>
            {week.map((cell) => {
              if (cell.isEmpty) {
                return <View key={cell.key} style={styles.dayCellSpacer} />;
              }

              return (
                <TouchableOpacity
                  key={cell.key}
                  disabled={cell.isDisabled}
                  onPress={() => onSelectDate?.(activeField, cell.dateStr)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={cell.dateStr}
                  style={[
                    styles.dayCell,
                    cell.isInRange && styles.dayCellInRange,
                    cell.isToday && !cell.isSelected && styles.dayCellToday,
                    cell.isSelected && styles.dayCellSelected,
                    cell.isDisabled && styles.dayCellDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      cell.isInRange && styles.dayTextInRange,
                      cell.isToday && !cell.isSelected && styles.dayTextToday,
                      cell.isSelected && styles.dayTextSelected,
                      cell.isDisabled && styles.dayTextDisabled,
                    ]}
                  >
                    {cell.day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

function buildStyles(tokens, isDark) {
  const border = isDark ? 'rgba(255,255,255,0.12)' : '#E2E8F0';
  const surface = isDark ? tokens.bgSub : '#FFFFFF';
  const surfaceSub = isDark ? '#181B20' : '#F8FAFC';
  const textPrimary = isDark ? tokens.textPrimary : '#0F172A';
  const textMuted = isDark ? tokens.textMuted : '#64748B';

  return StyleSheet.create({
    card: {
      marginTop: 4,
      backgroundColor: surface,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(234, 88, 12, 0.4)' : '#FED7AA',
      padding: 12,
      gap: 10,
      ...(Platform.OS === 'web'
        ? {
            boxShadow: isDark
              ? '0 8px 24px rgba(0,0,0,0.38)'
              : '0 8px 20px rgba(15, 23, 42, 0.08)',
          }
        : {}),
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    modeTabs: {
      flex: 1,
      flexDirection: 'row',
      gap: 6,
    },
    modeTab: {
      flex: 1,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: border,
      backgroundColor: surfaceSub,
      gap: 1,
    },
    modeTabActive: {
      borderColor: BRAND,
      backgroundColor: isDark ? 'rgba(234, 88, 12, 0.14)' : '#FFF7ED',
    },
    modeTabEyebrow: {
      fontSize: 9.5,
      fontWeight: '600',
      letterSpacing: 0.5,
      color: textMuted,
    },
    modeTabEyebrowActive: {
      color: BRAND,
    },
    modeTabValue: {
      fontSize: 12,
      fontWeight: '600',
      color: textPrimary,
      fontVariant: ['tabular-nums'],
    },
    modeTabValueActive: {
      color: isDark ? '#FDBA74' : '#9A3412',
    },
    doneBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: BRAND,
    },
    doneBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    presetsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    presetChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: border,
      backgroundColor: surfaceSub,
    },
    presetChipActive: {
      borderColor: BRAND,
      backgroundColor: isDark ? 'rgba(234, 88, 12, 0.18)' : '#FFF7ED',
    },
    presetChipText: {
      fontSize: 11.5,
      fontWeight: '500',
      color: textMuted,
    },
    presetChipTextActive: {
      color: BRAND,
      fontWeight: '600',
    },
    clearChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 68, 68, 0.35)' : '#FECACA',
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2',
    },
    clearChipText: {
      fontSize: 11.5,
      fontWeight: '600',
      color: isDark ? '#FCA5A5' : '#DC2626',
    },
    monthHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 2,
    },
    monthNavGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    navIconBtn: {
      width: 28,
      height: 28,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: border,
      backgroundColor: surfaceSub,
      alignItems: 'center',
      justifyContent: 'center',
    },
    monthLabel: {
      minWidth: 126,
      textAlign: 'center',
      fontSize: 13.5,
      fontWeight: '600',
      color: textPrimary,
      letterSpacing: -0.1,
    },
    todayBtn: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: border,
      backgroundColor: surfaceSub,
    },
    todayBtnText: {
      fontSize: 11.5,
      fontWeight: '600',
      color: BRAND,
    },
    weekdaysRow: {
      flexDirection: 'row',
      gap: 4,
    },
    weekdayCell: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 2,
    },
    weekdayText: {
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 0.4,
      color: textMuted,
    },
    grid: {
      gap: 4,
    },
    weekRow: {
      flexDirection: 'row',
      gap: 4,
    },
    dayCellSpacer: {
      flex: 1,
      height: 34,
    },
    dayCell: {
      flex: 1,
      height: 34,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'transparent',
    },
    dayCellInRange: {
      backgroundColor: isDark ? 'rgba(234, 88, 12, 0.16)' : '#FFF7ED',
      borderColor: isDark ? 'rgba(234, 88, 12, 0.30)' : '#FED7AA',
    },
    dayCellToday: {
      borderColor: isDark ? 'rgba(234, 88, 12, 0.55)' : '#FDBA74',
    },
    dayCellSelected: {
      backgroundColor: BRAND,
      borderColor: BRAND,
    },
    dayCellDisabled: {
      opacity: 0.3,
    },
    dayText: {
      fontSize: 12.5,
      fontWeight: '500',
      color: textPrimary,
      fontVariant: ['tabular-nums'],
    },
    dayTextInRange: {
      color: isDark ? '#FDBA74' : '#9A3412',
      fontWeight: '600',
    },
    dayTextToday: {
      color: BRAND,
      fontWeight: '600',
    },
    dayTextSelected: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
    dayTextDisabled: {
      color: textMuted,
    },
  });
}

