import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Platform,
  useWindowDimensions,
  Modal,
  Linking,
} from 'react-native';
import { BootstrapIcon } from '../common';
import { useTheme } from '../../context/ThemeContext.jsx';
import { garageService, TIME_SLOTS as DEFAULT_TIME_SLOTS } from '../../services/bookings/garageService.js';
import { systemSettingsService } from '../../services/system/systemSettingsService.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Shop pin location (triangulated from the Street View storefront frames)
const SHOP_LAT = 10.20672;
const SHOP_LNG = 123.75685;

const GOOGLE_STREET_VIEW_URL =
  'https://www.google.com/maps/@10.2066654,123.7569248,3a,75y,310h,90t/data=!3m6!1e1!3m4!1s1lF1W3G6qtLGnhLCbeyNKw!2e0!7i16384!8i8192';

const GOOGLE_STREET_VIEW_EMBED_URL =
  'https://www.google.com/maps/embed?pb=!4v1700000000000!6m8!1m7!1s1lF1W3G6qtLGnhLCbeyNKw!2m2!1d10.2066654!2d123.7569248!3f310!4f0!5f0.78';

function formatSelectedFullDate(dateStr) {
  if (!dateStr) return 'Select a date from calendar';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * MotoTrack Book Installation Modal
 * Clean, organized, and spacious motorcycle installation booking experience.
 * Features:
 * - Enlarged modal width (840px max) with side-by-side calendar and slot layout on desktop
 * - Full interactive monthly calendar with month navigation and weekday headers (identical to booking)
 * - Real-time slot availability per selected date
 * - Compact workshop pitstop bay card
 * - Organized contact information & notes
 * - Fixed footer with itemized product & labor fee breakdown
 */
export default function BookInstallationModal({
  visible = false,
  onClose,
  previewImageUri = null,
  motorcycle = null,
  bikeTitle = '',
  serviceName = '',
  laborFeePhp = 3250,
  partsCostPhp = 0,
  freeInstallPromo = null,
  downpaymentPercent: customDownpaymentPercent = null,
  branches = [],
  selectedBranch = '',
  onSelectBranch,
  selectedDate = '',
  onSelectDate,
  timeSlots = [],
  selectedTimeSlot = '',
  onSelectTimeSlot,
  phone = '',
  onChangePhone,
  notes = '',
  onChangeNotes,
  onConfirm,
  onWishlist,
  busy = false,
  errorMessage = '',
}) {
  const { isDarkMode } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const width = windowWidth;
  const isMobile = windowWidth < 640;
  const isDesktop = windowWidth >= 768;

  // Local state for inline validation warning
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [hoveredSlot, setHoveredSlot] = useState(null);

  // Minimum allowed date: Tomorrow (lead time = 1 day)
  const minBookingDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    if (d.getDay() === 0) d.setDate(d.getDate() + 1); // skip Sunday if tomorrow is Sunday
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const [internalDate, setInternalDate] = useState(minBookingDate);
  const effectiveDate = selectedDate || internalDate || minBookingDate;

  // Month state for calendar view
  const [currentMonthDate, setCurrentMonthDate] = useState(() => {
    const targetDate = selectedDate || minBookingDate;
    const d = new Date(targetDate + 'T00:00:00');
    if (!isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), 1);
    return new Date();
  });

  // Sync calendar month when selected date changes externally
  useEffect(() => {
    if (effectiveDate) {
      const d = new Date(effectiveDate + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        setCurrentMonthDate((prev) => {
          if (d.getFullYear() !== prev.getFullYear() || d.getMonth() !== prev.getMonth()) {
            return new Date(d.getFullYear(), d.getMonth(), 1);
          }
          return prev;
        });
      }
    }
  }, [effectiveDate]);

  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
  const prevMonthName = MONTH_NAMES[(month + 11) % 12];
  const nextMonthName = MONTH_NAMES[(month + 1) % 12];

  const minYear = parseInt(minBookingDate.slice(0, 4), 10);
  const minMonth = parseInt(minBookingDate.slice(5, 7), 10) - 1;
  const canGoPrev = year > minYear || (year === minYear && month > minMonth);

  const handlePrevMonth = () => {
    if (!canGoPrev) return;
    setCurrentMonthDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(new Date(year, month + 1, 1));
  };

  const handleDateSelect = (dateStr) => {
    if (!dateStr) return;
    setInternalDate(dateStr);
    onSelectDate?.(dateStr);
  };

  // Calendar cells generation (Monday is col 0, Sunday is col 6)
  const calendarCells = useMemo(() => {
    const firstDayRaw = new Date(year, month, 1).getDay(); // Sunday=0, Monday=1
    const firstDayCol = (firstDayRaw + 6) % 7; // Monday=0 ... Sunday=6
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells = [];

    // Leading days from previous month
    for (let i = firstDayCol - 1; i >= 0; i--) {
      cells.push({
        key: `prev-${i}`,
        day: daysInPrevMonth - i,
        isCurrentMonth: false,
        dateStr: null,
        isSelectable: false,
      });
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = (firstDayCol + d - 1) % 7;
      const isSunday = dayOfWeek === 6;
      const isBeforeMin = dateStr < minBookingDate;
      const dayInfo = garageService.getDaySlotAvailability(dateStr);
      const isFullyBooked = Boolean(dayInfo?.isFullyBooked);
      const isSelectable = !isSunday && !isBeforeMin && !isFullyBooked;
      const isSelected = dateStr === effectiveDate;

      cells.push({
        key: `cur-${d}`,
        day: d,
        isCurrentMonth: true,
        dateStr,
        dayOfWeek,
        isSunday,
        isBeforeMin,
        isFullyBooked,
        isSelectable,
        isSelected,
      });
    }

    // Trailing days to fill the week
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      cells.push({
        key: `next-${i}`,
        day: i,
        isCurrentMonth: false,
        dateStr: null,
        isSelectable: false,
      });
    }

    return cells;
  }, [year, month, minBookingDate, effectiveDate]);

  // Compute real-time slot availability for the selected date
  const slotAvailability = useMemo(() => {
    try {
      if (!effectiveDate) return {};
      const res = garageService.getDaySlotAvailability(effectiveDate);
      const map = {};
      (res?.slotsData || res?.slots || []).forEach((s) => {
        map[s.timeSlot] = Boolean(s.isBooked);
      });
      return map;
    } catch {
      return {};
    }
  }, [effectiveDate, visible]);

  const effectiveSlots = timeSlots && timeSlots.length > 0 ? timeSlots : DEFAULT_TIME_SLOTS;

  const morningSlots = useMemo(() => {
    return effectiveSlots.filter((slot) => /AM/i.test(slot.split('-')[0]));
  }, [effectiveSlots]);

  const afternoonSlots = useMemo(() => {
    return effectiveSlots.filter((slot) => !/AM/i.test(slot.split('-')[0]));
  }, [effectiveSlots]);

  // Auto-select first available time slot if selected is booked on new date
  useEffect(() => {
    if (!selectedTimeSlot || slotAvailability[selectedTimeSlot]) {
      const firstAvail = effectiveSlots.find((s) => !slotAvailability[s]);
      if (firstAvail && firstAvail !== selectedTimeSlot) {
        onSelectTimeSlot?.(firstAvail);
      }
    }
  }, [effectiveDate, slotAvailability, selectedTimeSlot, effectiveSlots, onSelectTimeSlot]);

  // Brand Palette
  const BRAND = '#EA580C';
  const HEADER_DARK = isDarkMode ? '#181B1F' : '#1E2227';
  const SURFACE = isDarkMode ? '#141816' : '#FFFFFF';
  const CARD_BG = isDarkMode ? '#1A211D' : '#F8FAFC';
  const CARD_BORDER = isDarkMode ? '#27342D' : '#E2E8F0';
  const INK = isDarkMode ? '#F8FAFC' : '#0F172A';
  const MUTED = isDarkMode ? '#94A3B8' : '#64748B';
  const SUBTLE = isDarkMode ? '#64748B' : '#94A3B8';

  // Pitstop Garage Rule Downpayment Settings
  const adminSettings = useMemo(() => {
    try {
      return systemSettingsService.getSettings() || {};
    } catch {
      return {};
    }
  }, []);

  const downpaymentPercent = useMemo(() => {
    if (customDownpaymentPercent != null && Number.isFinite(Number(customDownpaymentPercent))) {
      return Math.min(100, Math.max(0, Number(customDownpaymentPercent)));
    }
    if (adminSettings?.requireDownpayment === false) return 0;
    const parsed = Number(adminSettings?.downpaymentPercent);
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : 20;
  }, [adminSettings, customDownpaymentPercent]);

  const effectiveLaborFee = freeInstallPromo ? 0 : (laborFeePhp ?? 3250);
  const totalEstimate = Math.max(0, (partsCostPhp || 0) + effectiveLaborFee);
  const downpaymentAmount = Math.round(totalEstimate * (downpaymentPercent / 100));
  const remainingBalance = Math.max(0, totalEstimate - downpaymentAmount);

  // Payment channel for reservation downpayment (default: GCash)
  const [paymentChannel, setPaymentChannel] = useState('GCash');

  // Workshop interactive map mode: 'street' | 'map' | 'satellite'
  const [mapMode, setMapMode] = useState('street');

  const satelliteMapHtml = useMemo(() => {
    const lat = SHOP_LAT;
    const lng = SHOP_LNG;
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * { box-sizing: border-box; }
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #0F172A; }
    .shop-pin {
      background: #EA580C;
      border: 3px solid #FFFFFF;
      border-radius: 50% 50% 50% 0;
      width: 34px;
      height: 34px;
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.45);
      cursor: pointer;
    }
    .shop-pin-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #FFFFFF;
    }
    .leaflet-popup-content-wrapper {
      border-radius: 10px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: true, attributionControl: false }).setView([${lat}, ${lng}], 19);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19
    }).addTo(map);

    var pin = L.divIcon({
      className: '',
      html: '<div style="position:relative;width:34px;height:34px;"><div class="shop-pin" title="D\\'Blockchain Motorparts"><div class="shop-pin-dot"></div></div></div>',
      iconSize: [34, 34],
      iconAnchor: [17, 42],
      popupAnchor: [0, -42]
    });

    L.marker([${lat}, ${lng}], { icon: pin }).addTo(map)
      .bindPopup("<b>D'Blockchain Motorparts</b><br/>109 Natalio B. Bacalso S National Hwy, Naga<br/><span style='color:#EA580C;font-size:11px;font-weight:700;'>📍 Official Installation Pit Bays</span>")
      .openPopup();
  </script>
</body>
</html>`;
  }, []);

  const roadMapHtml = useMemo(() => {
    const lat = SHOP_LAT;
    const lng = SHOP_LNG;
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * { box-sizing: border-box; }
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #F8FAFC; }
    .shop-pin {
      background: #EA580C;
      border: 3px solid #FFFFFF;
      border-radius: 50% 50% 50% 0;
      width: 34px;
      height: 34px;
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.45);
      cursor: pointer;
    }
    .shop-pin-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #FFFFFF;
    }
    .leaflet-popup-content-wrapper {
      border-radius: 10px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: true, attributionControl: false }).setView([${lat}, ${lng}], 18);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    var pin = L.divIcon({
      className: '',
      html: '<div style="position:relative;width:34px;height:34px;"><div class="shop-pin" title="D\\'Blockchain Motorparts"><div class="shop-pin-dot"></div></div></div>',
      iconSize: [34, 34],
      iconAnchor: [17, 42],
      popupAnchor: [0, -42]
    });

    L.marker([${lat}, ${lng}], { icon: pin }).addTo(map)
      .bindPopup("<b>D'Blockchain Motorparts</b><br/>109 Natalio B. Bacalso S National Hwy, Naga<br/><span style='color:#EA580C;font-size:11px;font-weight:700;'>📍 Official Installation Pit Bays</span>")
      .openPopup();
  </script>
</body>
</html>`;
  }, []);

  const handleOpenGoogleMaps = () => {
    if (typeof window !== 'undefined' && window.open) {
      window.open(GOOGLE_STREET_VIEW_URL, '_blank', 'noopener,noreferrer');
    } else {
      Linking.openURL(GOOGLE_STREET_VIEW_URL).catch(() => {});
    }
  };

  // Derived display strings
  const displayBike =
    bikeTitle ||
    motorcycle?.nickname ||
    motorcycle?.name ||
    [motorcycle?.year, motorcycle?.brand, motorcycle?.model].filter(Boolean).join(' ') ||
    'Registered Motorcycle';

  const displayService =
    serviceName ||
    'Custom Parts Installation';

  const isPhoneValid = Boolean(phone && phone.trim().length >= 7);
  const showPhoneError = phoneTouched && !isPhoneValid;

  const handlePhoneBlur = () => {
    setPhoneTouched(true);
  };

  const handleConfirmPress = () => {
    setPhoneTouched(true);
    if (!isPhoneValid) return;
    onConfirm?.({
      date: effectiveDate,
      timeSlot: selectedTimeSlot,
      branch: selectedBranch,
      phone,
      notes,
      downpaymentPercent,
      downpaymentAmount,
      remainingBalance,
      paymentMethod: paymentChannel,
      totalEstimate,
    });
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={Platform.OS === 'web' ? 'fade' : 'slide'}
      onRequestClose={() => !busy && onClose?.()}
    >
      <View
        style={[
          styles.overlay,
          isDesktop ? styles.overlayDesktop : styles.overlayMobile,
        ]}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => !busy && onClose?.()}
        />

        <View
          style={[
            styles.sheet,
            isDesktop ? styles.sheetDesktop : styles.sheetMobile,
            {
              backgroundColor: SURFACE,
              borderColor: CARD_BORDER,
              maxWidth: isDesktop ? 900 : '100%',
            },
          ]}
        >
          {/* ─── 1. FIXED HEADER (MINIMALIST) ─── */}
          <View
            style={[
              styles.header,
              {
                borderBottomColor: CARD_BORDER,
                backgroundColor: isDarkMode ? '#141816' : '#FFFFFF',
              },
            ]}
          >
            <View style={styles.headerTitleRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.headerTitle, { color: INK }]}>Book Installation</Text>
                <Text style={[styles.headerSubtitle, { color: MUTED }]}>
                  Select your service schedule, workshop pit bay, and contact details.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.closeButton,
                {
                  backgroundColor: isDarkMode ? '#1E2822' : '#F8FAFC',
                  borderColor: CARD_BORDER,
                },
              ]}
              onPress={() => !busy && onClose?.()}
              disabled={busy}
              activeOpacity={0.7}
              accessibilityLabel="Close installation booking modal"
            >
              <BootstrapIcon name="x-lg" size={12} color={MUTED} />
            </TouchableOpacity>
          </View>

          {/* ─── 2. SCROLLABLE CONTENT BODY ─── */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
          >
            {/* Inline Error Alert */}
            {errorMessage ? (
              <View style={styles.errorAlert}>
                <BootstrapIcon name="exclamation-triangle-fill" size={15} color="#DC2626" />
                <Text style={styles.errorAlertText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* ─── UNIFIED HERO SUMMARY (MINIMALIST) ─── */}
            <View
              style={[
                styles.unifiedSummaryCard,
                {
                  backgroundColor: isDarkMode ? '#18201B' : '#F8FAFC',
                  borderColor: CARD_BORDER,
                },
              ]}
            >
              <View style={styles.unifiedSummaryRow}>
                {/* 1. Bike & Service Thumbnail + Details */}
                <View style={styles.summaryBikeGroup}>
                  {previewImageUri ? (
                    <View
                      style={[
                        styles.imageThumb,
                        {
                          backgroundColor: isDarkMode ? '#101714' : '#FFFFFF',
                          borderColor: CARD_BORDER,
                        },
                      ]}
                    >
                      <Image
                        source={{ uri: previewImageUri }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="contain"
                      />
                    </View>
                  ) : null}

                  <View style={{ flex: 1, minWidth: 160 }}>
                    <Text style={[styles.serviceTitle, { color: INK }]} numberOfLines={1}>
                      {displayService}
                    </Text>
                    <View style={styles.bikeModelRow}>
                      <BootstrapIcon name="bicycle" size={12} color={BRAND} />
                      <Text style={[styles.bikeModelText, { color: MUTED }]} numberOfLines={1}>
                        {displayBike}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* 2. Price & Itemization */}
                <View style={styles.summaryPriceGroup}>
                  {freeInstallPromo ? (
                    <View style={styles.freeBadge}>
                      <BootstrapIcon name="tag-fill" size={11} color="#059669" />
                      <Text style={styles.freeBadgeText}>FREE INSTALL</Text>
                    </View>
                  ) : (
                    <>
                      <Text style={[styles.priceAmount, { color: INK }]}>
                        ₱{Number(totalEstimate).toLocaleString('en-US')}
                      </Text>
                      <Text style={[styles.priceSublabel, { color: MUTED }]}>
                        {downpaymentPercent > 0 ? (
                          <>
                            <Text style={{ color: BRAND, fontWeight: '700' }}>
                              ₱{Number(downpaymentAmount).toLocaleString()} ({downpaymentPercent}% Deposit)
                            </Text>
                            {' • '}
                          </>
                        ) : null}
                        Parts ₱{Number(partsCostPhp || 0).toLocaleString()} + Labor ₱{Number(effectiveLaborFee).toLocaleString()}
                      </Text>
                    </>
                  )}
                </View>
              </View>
            </View>

            {/* ─── SCHEDULE & TIME SLOTS (SIDE-BY-SIDE MINIMALIST) ─── */}
            <View style={styles.scheduleRowContainer}>
              {/* LEFT: FULL MONTH CALENDAR CARD (MINIMALIST APPLE/STRIPE STYLE) */}
              <View
                style={[
                  styles.calendarCard,
                  {
                    backgroundColor: isDarkMode ? '#181E1A' : '#FFFFFF',
                    borderColor: CARD_BORDER,
                  },
                ]}
              >
                {/* Minimalist Calendar Header with Chevron Switcher */}
                <View style={styles.calendarHeader}>
                  <Text style={[styles.calendarMonthTitle, { color: INK }]}>
                    {MONTH_NAMES[month]} {year}
                  </Text>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <TouchableOpacity
                      onPress={handlePrevMonth}
                      disabled={!canGoPrev}
                      style={[
                        styles.navChevronBtn,
                        {
                          borderColor: CARD_BORDER,
                          backgroundColor: isDarkMode ? '#222B26' : '#FFFFFF',
                          opacity: canGoPrev ? 1 : 0.35,
                        },
                      ]}
                      activeOpacity={0.7}
                      accessibilityLabel="Previous month"
                    >
                      <BootstrapIcon name="chevron-left" size={11} color={INK} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handleNextMonth}
                      style={[
                        styles.navChevronBtn,
                        {
                          borderColor: CARD_BORDER,
                          backgroundColor: isDarkMode ? '#222B26' : '#FFFFFF',
                        },
                      ]}
                      activeOpacity={0.7}
                      accessibilityLabel="Next month"
                    >
                      <BootstrapIcon name="chevron-right" size={11} color={INK} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Calendar Body: Weekdays & Grid */}
                <View style={{ padding: 12 }}>
                  {/* Weekday Row */}
                  <View style={styles.weekdaysRow}>
                    {WEEKDAY_NAMES.map((wName) => (
                      <View key={wName} style={styles.weekdayCell}>
                        <Text style={[styles.weekdayText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                          {wName}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Day Cells Grid (Minimalist Borderless Numbers) */}
                  <View style={styles.daysGrid}>
                    {calendarCells.map((cell) => {
                      if (!cell.isCurrentMonth) {
                        return (
                          <View key={cell.key} style={styles.dayCellDimmed}>
                            <Text style={{ fontSize: 12, color: isDarkMode ? '#334155' : '#E2E8F0' }}>
                              {cell.day}
                            </Text>
                          </View>
                        );
                      }

                      const isSelectable = cell.isSelectable;
                      const isSelected = cell.isSelected;
                      const isSunday = cell.isSunday;

                      return (
                        <TouchableOpacity
                          key={cell.key}
                          onPress={() => isSelectable && handleDateSelect(cell.dateStr)}
                          disabled={!isSelectable}
                          activeOpacity={0.7}
                          style={styles.dayCellWrapper}
                        >
                          <View
                            style={[
                              styles.dayCircle,
                              isSelected && {
                                backgroundColor: BRAND,
                              },
                            ]}
                          >
                            <Text
                              style={{
                                fontSize: 12.5,
                                fontWeight: isSelected ? '700' : isSelectable ? '600' : '400',
                                color: isSelected
                                  ? '#FFFFFF'
                                  : isSelectable
                                    ? INK
                                    : isDarkMode
                                      ? '#475569'
                                      : '#CBD5E1',
                              }}
                            >
                              {cell.day}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Minimalist Footnote */}
                <View style={styles.calendarFootnote}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: BRAND }} />
                    <Text style={{ fontSize: 10, fontWeight: '500', color: MUTED }}>Selected</Text>
                  </View>
                  <Text style={{ fontSize: 10, color: SUBTLE }}>•</Text>
                  <Text style={{ fontSize: 10, fontWeight: '500', color: MUTED }}>Mon–Sat available</Text>
                  <Text style={{ fontSize: 10, color: SUBTLE }}>•</Text>
                  <Text style={{ fontSize: 10, fontWeight: '400', color: SUBTLE }}>Sun closed</Text>
                </View>
              </View>

              {/* RIGHT: LIVE BOOKING TIME & AVAILABILITY CARD (MINIMALIST) */}
              <View
                style={[
                  styles.timeSlotsCard,
                  {
                    backgroundColor: isDarkMode ? '#181E1A' : '#FFFFFF',
                    borderColor: CARD_BORDER,
                  },
                ]}
              >
                {/* Header */}
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 14.5, fontWeight: '700', color: INK, letterSpacing: -0.2 }}>
                    Live Booking Time & Availability
                  </Text>
                  <Text style={{ fontSize: 11.5, fontWeight: '500', color: MUTED, marginTop: 2 }}>
                    {formatSelectedFullDate(effectiveDate)}
                  </Text>
                </View>

                {/* Morning Session Slots */}
                {morningSlots.length > 0 && (
                  <View style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                      <BootstrapIcon name="sun" size={11} color={MUTED} />
                      <Text style={{ fontSize: 10, fontWeight: '700', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Morning Sessions (8:00 AM – 12:00 PM)
                      </Text>
                    </View>
                    {morningSlots.map((slot) => {
                      const isSelected = selectedTimeSlot === slot;
                      const isBooked = Boolean(slotAvailability[slot]);
                      return (
                        <TouchableOpacity
                          key={slot}
                          style={[
                            styles.minimalSlotRow,
                            {
                              backgroundColor: isSelected
                                ? (isDarkMode ? '#221E1A' : '#FFFBF5')
                                : (isDarkMode ? '#1A211D' : '#FFFFFF'),
                              borderColor: isSelected
                                ? BRAND
                                : isBooked
                                  ? (isDarkMode ? '#202824' : '#F1F5F9')
                                  : (isDarkMode ? '#27342D' : '#E2E8F0'),
                              borderWidth: isSelected ? 1.5 : 1,
                              opacity: isBooked ? 0.45 : 1,
                            },
                          ]}
                          disabled={isBooked || busy}
                          onPress={() => !isBooked && onSelectTimeSlot?.(slot)}
                          activeOpacity={0.8}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                            <View
                              style={{
                                width: 7,
                                height: 7,
                                borderRadius: 3.5,
                                backgroundColor: isSelected ? BRAND : isBooked ? '#CBD5E1' : '#10B981',
                              }}
                            />
                            <Text
                              style={{
                                fontSize: 12.5,
                                fontWeight: isSelected ? '700' : '600',
                                color: isSelected ? BRAND : isBooked ? '#94A3B8' : INK,
                                fontVariant: ['tabular-nums'],
                                letterSpacing: -0.1,
                              }}
                            >
                              {slot}
                            </Text>
                          </View>

                          {isSelected ? (
                            <View style={styles.selectedPillMinimal}>
                              <BootstrapIcon name="check-lg" size={11} color="#FFFFFF" />
                              <Text style={styles.selectedPillText}>Selected</Text>
                            </View>
                          ) : isBooked ? (
                            <Text style={{ fontSize: 11, fontWeight: '500', color: '#94A3B8' }}>Full</Text>
                          ) : (
                            <View style={[styles.selectPillMinimal, { borderColor: CARD_BORDER }]}>
                              <Text style={[styles.selectPillText, { color: MUTED }]}>Select</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* Afternoon Session Slots */}
                {afternoonSlots.length > 0 && (
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6, marginTop: 2 }}>
                      <BootstrapIcon name="sun-fill" size={11} color={MUTED} />
                      <Text style={{ fontSize: 10, fontWeight: '700', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Afternoon Sessions (1:30 PM – 6:00 PM)
                      </Text>
                    </View>
                    {afternoonSlots.map((slot) => {
                      const isSelected = selectedTimeSlot === slot;
                      const isBooked = Boolean(slotAvailability[slot]);
                      return (
                        <TouchableOpacity
                          key={slot}
                          style={[
                            styles.minimalSlotRow,
                            {
                              backgroundColor: isSelected
                                ? (isDarkMode ? '#221E1A' : '#FFFBF5')
                                : (isDarkMode ? '#1A211D' : '#FFFFFF'),
                              borderColor: isSelected
                                ? BRAND
                                : isBooked
                                  ? (isDarkMode ? '#202824' : '#F1F5F9')
                                  : (isDarkMode ? '#27342D' : '#E2E8F0'),
                              borderWidth: isSelected ? 1.5 : 1,
                              opacity: isBooked ? 0.45 : 1,
                            },
                          ]}
                          disabled={isBooked || busy}
                          onPress={() => !isBooked && onSelectTimeSlot?.(slot)}
                          activeOpacity={0.8}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                            <View
                              style={{
                                width: 7,
                                height: 7,
                                borderRadius: 3.5,
                                backgroundColor: isSelected ? BRAND : isBooked ? '#CBD5E1' : '#10B981',
                              }}
                            />
                            <Text
                              style={{
                                fontSize: 12.5,
                                fontWeight: isSelected ? '700' : '600',
                                color: isSelected ? BRAND : isBooked ? '#94A3B8' : INK,
                                fontVariant: ['tabular-nums'],
                                letterSpacing: -0.1,
                              }}
                            >
                              {slot}
                            </Text>
                          </View>

                          {isSelected ? (
                            <View style={styles.selectedPillMinimal}>
                              <BootstrapIcon name="check-lg" size={11} color="#FFFFFF" />
                              <Text style={styles.selectedPillText}>Selected</Text>
                            </View>
                          ) : isBooked ? (
                            <Text style={{ fontSize: 11, fontWeight: '500', color: '#94A3B8' }}>Full</Text>
                          ) : (
                            <View style={[styles.selectPillMinimal, { borderColor: CARD_BORDER }]}>
                              <Text style={[styles.selectPillText, { color: MUTED }]}>Select</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>

            {/* ─── PAYMENT TERMS & DOWNPAYMENT CARD (MATCHES BOOKING) ─── */}
            <View
              style={[
                styles.downpaymentCardMinimal,
                {
                  backgroundColor: isDarkMode ? '#181E1A' : '#FFFFFF',
                  borderColor: CARD_BORDER,
                },
              ]}
            >
              <View style={styles.downpaymentHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <View
                    style={[
                      styles.downpaymentIconBadge,
                      {
                        backgroundColor: isDarkMode ? '#2A2016' : '#FFF7ED',
                        borderColor: isDarkMode ? '#4D3016' : '#FFEDD5',
                      },
                    ]}
                  >
                    <BootstrapIcon name="credit-card-2-front" size={13} color={BRAND} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.downpaymentHeading, { color: INK }]}>
                      Payment Terms & Reservation Downpayment
                    </Text>
                    <Text style={[styles.downpaymentSub, { color: MUTED }]}>
                      Pitstop Garage Rule: {downpaymentPercent}% reservation deposit required to lock workshop bay
                    </Text>
                  </View>
                </View>

                <View style={[styles.pitRuleBadge, { borderColor: isDarkMode ? '#4D3016' : '#FED7AA' }]}>
                  <BootstrapIcon name="shield-check" size={10} color={BRAND} />
                  <Text style={styles.pitRuleBadgeText}>{downpaymentPercent}% Pit Rule Split</Text>
                </View>
              </View>

              {/* Split Cards: Down Payment vs Remaining Balance */}
              <View style={styles.downpaymentSplitRow}>
                {/* Box 1: Down Payment Due Now */}
                <View
                  style={[
                    styles.downpaymentBox,
                    {
                      backgroundColor: isDarkMode ? '#221B14' : '#FFF7ED',
                      borderColor: isDarkMode ? '#7C3411' : '#FDBA74',
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.downpaymentBoxLabel, { color: BRAND }]}>
                      {downpaymentPercent === 100 ? 'FULL PAYMENT' : `${downpaymentPercent}% DOWN PAYMENT`}
                    </Text>
                    <Text style={[styles.downpaymentBoxSub, { color: isDarkMode ? '#CBD5E1' : '#7C2D12' }]}>
                      Due upon confirmation • Pit Rule
                    </Text>
                  </View>
                  <Text style={[styles.downpaymentBoxAmount, { color: BRAND }]}>
                    ₱{Number(downpaymentAmount).toLocaleString('en-US')}
                  </Text>
                </View>

                {/* Box 2: Remaining Balance at Workshop */}
                <View
                  style={[
                    styles.downpaymentBox,
                    {
                      backgroundColor: isDarkMode ? '#1B231F' : '#F8FAFC',
                      borderColor: CARD_BORDER,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.downpaymentBoxLabel, { color: isDarkMode ? '#E2E8F0' : '#334155' }]}>
                      REMAINING BALANCE ({100 - downpaymentPercent}%)
                    </Text>
                    <Text style={[styles.downpaymentBoxSub, { color: MUTED }]}>
                      Payable at workshop after installation
                    </Text>
                  </View>
                  <Text style={[styles.downpaymentBoxAmount, { color: INK }]}>
                    ₱{Number(remainingBalance).toLocaleString('en-US')}
                  </Text>
                </View>
              </View>

              {/* Deposit Payment Method Selector */}
              <View style={styles.paymentMethodSection}>
                <Text style={[styles.paymentMethodTitle, { color: INK }]}>
                  Choose Deposit Payment Method:
                </Text>

                <View style={styles.paymentMethodRow}>
                  {[
                    { id: 'GCash', icon: 'phone', label: 'GCash' },
                    { id: 'Maya', icon: 'credit-card', label: 'Maya' },
                    { id: 'Pay at Workshop', icon: 'shop', label: 'Pay at Workshop' },
                  ].map((method) => {
                    const isSelected = paymentChannel === method.id;
                    return (
                      <TouchableOpacity
                        key={method.id}
                        onPress={() => setPaymentChannel(method.id)}
                        disabled={busy}
                        activeOpacity={0.75}
                        style={[
                          styles.paymentMethodChip,
                          {
                            backgroundColor: isSelected
                              ? (isDarkMode ? '#2A1F17' : '#FFF7ED')
                              : (isDarkMode ? '#1B231F' : '#FFFFFF'),
                            borderColor: isSelected ? BRAND : CARD_BORDER,
                            borderWidth: isSelected ? 1.5 : 1,
                          },
                        ]}
                      >
                        <BootstrapIcon
                          name={method.icon}
                          size={12}
                          color={isSelected ? BRAND : MUTED}
                        />
                        <Text
                          style={[
                            styles.paymentMethodChipText,
                            {
                              color: isSelected ? BRAND : INK,
                              fontWeight: isSelected ? '700' : '500',
                            },
                          ]}
                        >
                          {method.label}
                        </Text>
                        {isSelected ? (
                          <BootstrapIcon name="check-circle-fill" size={12} color={BRAND} />
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* ─── 4. WORKSHOP LOCATION & INTERACTIVE MAP (MATCHING BOOKING) ─── */}
            <View
              style={[
                styles.workshopMapCard,
                {
                  backgroundColor: isDarkMode ? '#181E1A' : '#FFFFFF',
                  borderColor: CARD_BORDER,
                },
              ]}
            >
              <View
                style={[
                  styles.workshopMapContentRow,
                  isDesktop ? styles.workshopMapContentRowDesktop : styles.workshopMapContentRowMobile,
                ]}
              >
                {/* ── LEFT COLUMN: WORKSHOP DETAILS & CONTACT ── */}
                <View
                  style={[
                    styles.workshopInfoCol,
                    { flex: isDesktop ? 1 : undefined, width: isDesktop ? undefined : '100%' },
                  ]}
                >
                  <View>
                    {/* Workshop Header Title */}
                    <Text style={[styles.workshopTitleText, { color: INK }]}>
                      {"D'Blockchain Motorparts & Accessories"}
                    </Text>

                    {/* Address with red pin */}
                    <View style={styles.workshopAddressRow}>
                      <BootstrapIcon name="geo-alt-fill" size={13} color="#EF4444" />
                      <Text style={[styles.workshopAddressText, { color: isDarkMode ? '#CBD5E1' : '#3F3F46' }]}>
                        109 Natalio B. Bacalso S National Hwy, City of Naga, Cebu, 6037
                      </Text>
                    </View>

                    {/* Information Specs Box (Hours, Landmark, Hotline) */}
                    <View
                      style={[
                        styles.workshopSpecsBox,
                        {
                          backgroundColor: isDarkMode ? '#141A17' : '#F8FAFC',
                          borderColor: CARD_BORDER,
                        },
                      ]}
                    >
                      {/* Operating Hours */}
                      <View style={[styles.workshopSpecRow, { borderBottomColor: CARD_BORDER }]}>
                        <View style={[styles.specIconCircle, { backgroundColor: isDarkMode ? '#2A2016' : '#FFF7ED' }]}>
                          <BootstrapIcon name="clock" size={11} color="#D97706" />
                        </View>
                        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                          <Text style={[styles.specLabelText, { color: MUTED }]}>Operating Hours</Text>
                          <Text style={[styles.specMainText, { color: INK }]}>Mon – Sat, 8:00 AM – 7:00 PM</Text>
                        </View>
                      </View>

                      {/* Workshop Contact */}
                      <View style={[styles.workshopSpecRow, { borderBottomColor: CARD_BORDER }]}>
                        <View style={[styles.specIconCircle, { backgroundColor: isDarkMode ? '#2A2016' : '#FFF7ED' }]}>
                          <BootstrapIcon name="telephone" size={11} color="#D97706" />
                        </View>
                        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                          <Text style={[styles.specLabelText, { color: MUTED }]}>Workshop Contact</Text>
                          <Text style={[styles.specMainText, { color: INK }]}>+63 961 490 4841</Text>
                        </View>
                      </View>

                      {/* Workshop Landmark */}
                      <View style={styles.workshopSpecRow}>
                        <View style={[styles.specIconCircle, { backgroundColor: isDarkMode ? '#2A2016' : '#FFF7ED' }]}>
                          <BootstrapIcon name="cursor" size={11} color="#D97706" />
                        </View>
                        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                          <Text style={[styles.specLabelText, { color: MUTED }]}>Pit Bay Landmark</Text>
                          <Text style={[styles.specMainText, { color: INK }]}>Beside Jerome's Gadget, Naga</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Open in Google Maps Button */}
                  <TouchableOpacity
                    style={styles.openGoogleMapsBtn}
                    onPress={handleOpenGoogleMaps}
                    activeOpacity={0.88}
                  >
                    <BootstrapIcon name="geo-alt-fill" size={13} color="#EF4444" />
                    <Text style={styles.openGoogleMapsBtnText}>
                      Open in Google Maps App
                    </Text>
                    <BootstrapIcon name="box-arrow-up-right" size={10} color="#A1A1AA" />
                  </TouchableOpacity>
                </View>

                {/* ── RIGHT COLUMN: STREET VIEW & MAP VIEWER ── */}
                <View
                  style={[
                    styles.workshopMapCol,
                    { flex: isDesktop ? 1.2 : undefined, width: isDesktop ? undefined : '100%' },
                  ]}
                >
                  {/* Header Row: Title & Segmented Tabs */}
                  <View style={styles.mapViewerHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <BootstrapIcon name="compass" size={13} color="#D97706" />
                      <Text style={[styles.mapViewerTitle, { color: isDarkMode ? '#F8FAFC' : '#78350F' }]}>
                        Workshop Street View & Map
                      </Text>
                    </View>

                    {/* Segmented Tabs: Street View | Roadmap | Satellite */}
                    <View
                      style={[
                        styles.mapSegmentedTabs,
                        {
                          backgroundColor: isDarkMode ? '#222B26' : '#F5F5F4',
                          borderColor: CARD_BORDER,
                        },
                      ]}
                    >
                      <TouchableOpacity
                        style={[
                          styles.mapSegmentedTabBtn,
                          mapMode === 'street' && {
                            backgroundColor: '#1E2227',
                          },
                        ]}
                        onPress={() => setMapMode('street')}
                        activeOpacity={0.85}
                      >
                        <BootstrapIcon
                          name="camera-video-fill"
                          size={10.5}
                          color={mapMode === 'street' ? '#FFFFFF' : MUTED}
                        />
                        <Text
                          style={[
                            styles.mapSegmentedTabText,
                            { color: mapMode === 'street' ? '#FFFFFF' : MUTED },
                          ]}
                        >
                          Street View
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.mapSegmentedTabBtn,
                          mapMode === 'map' && {
                            backgroundColor: '#1E2227',
                          },
                        ]}
                        onPress={() => setMapMode('map')}
                        activeOpacity={0.85}
                      >
                        <BootstrapIcon
                          name="map"
                          size={10.5}
                          color={mapMode === 'map' ? '#FFFFFF' : MUTED}
                        />
                        <Text
                          style={[
                            styles.mapSegmentedTabText,
                            { color: mapMode === 'map' ? '#FFFFFF' : MUTED },
                          ]}
                        >
                          Roadmap
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.mapSegmentedTabBtn,
                          mapMode === 'satellite' && {
                            backgroundColor: '#1E2227',
                          },
                        ]}
                        onPress={() => setMapMode('satellite')}
                        activeOpacity={0.85}
                      >
                        <BootstrapIcon
                          name="globe"
                          size={10.5}
                          color={mapMode === 'satellite' ? '#FFFFFF' : MUTED}
                        />
                        <Text
                          style={[
                            styles.mapSegmentedTabText,
                            { color: mapMode === 'satellite' ? '#FFFFFF' : MUTED },
                          ]}
                        >
                          Satellite
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Viewport Frame */}
                  <View
                    style={[
                      styles.mapViewportFrame,
                      {
                        borderColor: CARD_BORDER,
                        backgroundColor: '#0F172A',
                      },
                    ]}
                  >
                    {Platform.OS === 'web' ? (
                      mapMode === 'street' ? (
                        <iframe
                          title="D'Blockchain Motorparts & Accessories - Google Street View"
                          src={GOOGLE_STREET_VIEW_EMBED_URL}
                          style={{
                            width: '100%',
                            height: '100%',
                            border: 0,
                            display: 'block',
                          }}
                          allowFullScreen
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                        />
                      ) : mapMode === 'map' ? (
                        <iframe
                          title="MotoTrack Service Workshop - Roadmap View"
                          srcDoc={roadMapHtml}
                          style={{
                            width: '100%',
                            height: '100%',
                            border: 0,
                            display: 'block',
                          }}
                          loading="lazy"
                        />
                      ) : (
                        <iframe
                          title="MotoTrack Service Workshop - Satellite View"
                          srcDoc={satelliteMapHtml}
                          style={{
                            width: '100%',
                            height: '100%',
                            border: 0,
                            display: 'block',
                          }}
                          loading="lazy"
                        />
                      )
                    ) : (
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <BootstrapIcon name="geo-alt-fill" size={28} color="#EF4444" />
                        <Text style={{ color: '#FFFFFF', marginTop: 8, fontSize: 12 }}>
                          109 Natalio B. Bacalso Hwy, Naga City
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </View>

            {/* ─── 5. CONTACT & VEHICLE NOTES (AT THE BOTTOM OF THE MAP) ─── */}
            <View
              style={[
                styles.contactSectionCard,
                {
                  backgroundColor: isDarkMode ? '#181E1A' : '#FFFFFF',
                  borderColor: CARD_BORDER,
                },
              ]}
            >
              <View style={styles.sectionHeadingRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <BootstrapIcon name="chat-left-text" size={13} color={BRAND} />
                  <Text style={[styles.sectionHeading, { color: INK }]}>
                    Contact & Vehicle Notes
                  </Text>
                </View>
                <Text style={[styles.sectionSub, { color: MUTED }]}>
                  Shop dispatch will send SMS arrival gate pass and service updates
                </Text>
              </View>

              <View style={{ flexDirection: windowWidth >= 680 ? 'row' : 'column', gap: 14 }}>
                {/* Contact Phone Field */}
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={[styles.inputLabel, { color: INK }]}>
                    Contact Phone Number <Text style={{ color: '#DC2626' }}>*</Text>
                  </Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      {
                        backgroundColor: isDarkMode ? '#141A17' : '#F8FAFC',
                        borderColor: showPhoneError ? '#DC2626' : CARD_BORDER,
                      },
                    ]}
                  >
                    <BootstrapIcon
                      name="telephone-fill"
                      size={13}
                      color={showPhoneError ? '#DC2626' : BRAND}
                    />
                    <TextInput
                      style={[styles.inputField, { color: INK }]}
                      placeholder="0917 123 4567"
                      placeholderTextColor={SUBTLE}
                      value={phone}
                      onChangeText={(val) => {
                        onChangePhone?.(val);
                        if (phoneTouched) setPhoneTouched(false);
                      }}
                      onBlur={handlePhoneBlur}
                      keyboardType="phone-pad"
                      editable={!busy}
                    />
                    {isPhoneValid ? (
                      <BootstrapIcon name="check-circle-fill" size={14} color="#10B981" />
                    ) : null}
                  </View>

                  {showPhoneError ? (
                    <Text style={styles.fieldErrorText}>
                      Please enter a valid mobile number (e.g. 09171234567)
                    </Text>
                  ) : (
                    <Text style={[styles.fieldHelperText, { color: MUTED }]}>
                      Required for SMS pitstop gate pass
                    </Text>
                  )}
                </View>

                {/* Fitting Notes Field */}
                <View style={[styles.fieldGroup, { flex: 1.2 }]}>
                  <Text style={[styles.inputLabel, { color: INK }]}>
                    Fitting Notes{' '}
                    <Text style={{ fontSize: 11, fontWeight: '500', color: MUTED }}>
                      (Optional)
                    </Text>
                  </Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      {
                        backgroundColor: isDarkMode ? '#141A17' : '#F8FAFC',
                        borderColor: CARD_BORDER,
                      },
                    ]}
                  >
                    <BootstrapIcon
                      name="pencil-square"
                      size={13}
                      color={MUTED}
                    />
                    <TextInput
                      style={[styles.inputField, { color: INK }]}
                      placeholder="e.g., torque specs, keep stock parts, test ride after install..."
                      placeholderTextColor={SUBTLE}
                      value={notes}
                      onChangeText={onChangeNotes}
                      editable={!busy}
                    />
                  </View>
                  <Text style={[styles.fieldHelperText, { color: MUTED }]}>
                    Special instructions for our master mechanic
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* ─── 3. FIXED BOTTOM ACTION FOOTER ─── */}
          <View
            style={[
              styles.footer,
              {
                borderTopColor: CARD_BORDER,
                backgroundColor: isDarkMode ? '#18221E' : '#FFFFFF',
              },
            ]}
          >
            <View style={[styles.footerContentRow, isMobile && styles.footerContentCol]}>
              {/* Compact Price & Downpayment Summary */}
              <View style={styles.footerPriceBlock}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.footerPriceLabel, { color: MUTED }]}>
                    {downpaymentPercent > 0 ? `REQUIRED DOWNPAYMENT (${downpaymentPercent}%)` : 'TOTAL ESTIMATED AMOUNT'}
                  </Text>
                  {downpaymentPercent > 0 && (
                    <View style={styles.footerPitRuleBadge}>
                      <Text style={styles.footerPitRuleBadgeText}>Pit Rule</Text>
                    </View>
                  )}
                </View>

                <View style={styles.footerPriceRow}>
                  {freeInstallPromo && partsCostPhp === 0 ? (
                    <Text style={[styles.footerPriceVal, { color: '#059669' }]}>
                      FREE{' '}
                      <Text style={{ fontSize: 11, fontWeight: '600', color: MUTED }}>
                        (Promo Active)
                      </Text>
                    </Text>
                  ) : (
                    <>
                      <Text style={[styles.footerPriceVal, { color: BRAND }]}>
                        ₱{Number(downpaymentPercent > 0 ? downpaymentAmount : totalEstimate).toLocaleString('en-US')}
                      </Text>
                      {downpaymentPercent > 0 && (
                        <Text style={[styles.footerDepositSubVal, { color: MUTED }]}>
                          {' '}/ ₱{Number(totalEstimate).toLocaleString('en-US')} total
                        </Text>
                      )}
                    </>
                  )}
                </View>

                <Text style={[styles.footerPriceSub, { color: SUBTLE }]}>
                  {downpaymentPercent > 0
                    ? `Deposit via ${paymentChannel} • ₱${Number(remainingBalance).toLocaleString()} balance at workshop`
                    : `Product ₱${Number(partsCostPhp || 0).toLocaleString()} + Labor ₱${Number(effectiveLaborFee).toLocaleString()}`}
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={[styles.footerActionsRow, isMobile && styles.footerActionsRowMobile]}>
                {onWishlist ? (
                  <TouchableOpacity
                    style={[
                      styles.wishlistBtn,
                      {
                        borderColor: isDarkMode ? '#34463F' : '#CBD5E1',
                        backgroundColor: isDarkMode ? '#1C2622' : '#FFFFFF',
                      },
                    ]}
                    onPress={() => !busy && onWishlist()}
                    disabled={busy}
                    activeOpacity={0.8}
                    accessibilityLabel="Save build to wishlist"
                  >
                    <BootstrapIcon name="bookmark" size={13} color={BRAND} />
                    <Text style={[styles.wishlistBtnText, { color: INK }]}>Save</Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={[
                    styles.confirmBtn,
                    {
                      backgroundColor: BRAND,
                      opacity: busy || !isPhoneValid ? 0.6 : 1,
                    },
                  ]}
                  onPress={handleConfirmPress}
                  disabled={busy || !isPhoneValid}
                  activeOpacity={0.85}
                  accessibilityLabel="Confirm motorcycle installation booking"
                >
                  {busy ? (
                    <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />
                  ) : (
                    <BootstrapIcon
                      name="calendar2-check-fill"
                      size={14}
                      color="#FFFFFF"
                      style={{ marginRight: 6 }}
                    />
                  )}
                  <Text style={styles.confirmBtnText}>
                    {busy
                      ? 'Booking…'
                      : downpaymentAmount > 0
                        ? `Confirm & Reserve (₱${Number(downpaymentAmount).toLocaleString()})`
                        : 'Confirm Booking'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(4px)',
      },
    }),
  },
  overlayDesktop: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  overlayMobile: {
    justifyContent: 'flex-end',
    alignItems: 'stretch',
    padding: 0,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    width: '100%',
    maxHeight: Platform.select({ web: '90vh', default: '90%' }),
    borderWidth: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    ...Platform.select({
      web: {
        boxShadow: '0 24px 48px -12px rgba(15, 23, 42, 0.28)',
      },
      default: {
        elevation: 10,
      },
    }),
  },
  sheetDesktop: {
    borderRadius: 16,
  },
  sheetMobile: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },

  // 1. Fixed Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    flexShrink: 0,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 10,
  },
  headerIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '400',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },

  // 2. Scroll Area
  scrollArea: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 20,
    gap: 12,
  },

  // Alerts
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 10,
  },
  errorAlertText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#B91C1C',
  },

  // Unified Hero Summary Card
  unifiedSummaryCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  unifiedSummaryRow: {
    flexDirection: Platform.select({ web: 'row', default: 'column' }),
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryBikeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1.1,
    minWidth: 180,
  },
  summaryLocationGroup: {
    flex: 1.2,
    minWidth: 200,
    gap: 2,
  },
  summaryPriceGroup: {
    alignItems: Platform.select({ web: 'flex-end', default: 'flex-start' }),
    minWidth: 140,
  },

  // Legacy Summary Card (kept for safety)
  summaryCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  summaryDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  imageThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  serviceTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  bikeModelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  bikeModelText: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  priceAmount: {
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  priceSublabel: {
    fontSize: 10.5,
    marginTop: 1,
  },
  freeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  freeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },

  // Location Card
  compactLocationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  locationIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationName: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  verifiedBayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  verifiedBayText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#065F46',
  },
  locationAddress: {
    fontSize: 10.5,
    marginTop: 1,
  },

  // Schedule Row Container
  scheduleRowContainer: {
    flexDirection: Platform.select({ web: 'row', default: 'column' }),
    gap: 14,
    alignItems: 'stretch',
    flexWrap: 'wrap',
  },

  // Calendar Card
  calendarCard: {
    flex: 1.15,
    minWidth: 290,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  calendarHeader: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navChevronBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  calendarMonthTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: -0.2,
    textTransform: 'capitalize',
  },
  weekdaysRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: 4,
    marginBottom: 4,
  },
  weekdayCell: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  weekdayText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  daysGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: 2,
  },
  dayCellWrapper: {
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  dayCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellDimmed: {
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarFootnote: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  // Time Slots Card
  timeSlotsCard: {
    flex: 1.25,
    minWidth: 300,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
  },
  minimalSlotRow: {
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginBottom: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
  },
  selectedPillMinimal: {
    backgroundColor: '#EA580C',
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  selectedPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  selectPillMinimal: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 6,
  },
  selectPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  timeSlotsHeader: {
    marginBottom: 10,
  },
  slotsList: {
    gap: 7,
    flex: 1,
    justifyContent: 'center',
  },
  slotButton: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    cursor: 'pointer',
  },
  slotButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  slotText: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.1,
  },
  selectedSlotTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  selectedSlotTagText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bookedTag: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bookedTagText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
  },
  availDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },

  // Contact Section Card
  contactSectionCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  sectionHeadingRow: {
    gap: 2,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  sectionSub: {
    fontSize: 11.5,
  },
  fieldGroup: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: Platform.select({ ios: 9, android: 7, default: 7 }),
    gap: 8,
  },
  inputField: {
    flex: 1,
    fontSize: 12.5,
    padding: 0,
    outline: 'none',
  },
  fieldHelperText: {
    fontSize: 10.5,
  },
  fieldErrorText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
  },
  textAreaWrapper: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  textAreaField: {
    fontSize: 12,
    minHeight: 46,
    textAlignVertical: 'top',
    padding: 0,
    outline: 'none',
  },

  // 3. Fixed Footer
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 26 : 14,
    flexShrink: 0,
  },
  footerContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  footerContentCol: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 10,
  },
  footerPriceBlock: {
    gap: 1,
  },
  footerPriceLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  footerPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  footerPriceVal: {
    fontSize: 19,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  footerPriceSub: {
    fontSize: 10.5,
  },
  footerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerActionsRowMobile: {
    justifyContent: 'space-between',
    width: '100%',
  },
  wishlistBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 8,
    height: 40,
    paddingHorizontal: 12,
    cursor: 'pointer',
  },
  wishlistBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    height: 40,
    paddingHorizontal: 18,
    minWidth: 150,
    flexGrow: 1,
    cursor: 'pointer',
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },

  // Downpayment Card Minimal
  downpaymentCardMinimal: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  downpaymentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  downpaymentIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downpaymentHeading: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  downpaymentSub: {
    fontSize: 11,
    marginTop: 1,
  },
  pitRuleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#FFF7ED',
  },
  pitRuleBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#EA580C',
  },
  downpaymentSplitRow: {
    flexDirection: Platform.select({ web: 'row', default: 'column' }),
    gap: 10,
  },
  downpaymentBox: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  downpaymentBoxLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  downpaymentBoxSub: {
    fontSize: 10.5,
    marginTop: 2,
  },
  downpaymentBoxAmount: {
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  paymentMethodSection: {
    gap: 8,
    paddingTop: 4,
  },
  paymentMethodTitle: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  paymentMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  paymentMethodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    cursor: 'pointer',
  },
  paymentMethodChipText: {
    fontSize: 11.5,
  },
  downpaymentNoteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  downpaymentNoteText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
  },
  footerPitRuleBadge: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  footerPitRuleBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#EA580C',
  },
  footerDepositSubVal: {
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    marginLeft: 4,
  },

  // Workshop Location & Interactive Map
  workshopMapCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    overflow: 'hidden',
  },
  workshopMapContentRow: {
    gap: 16,
  },
  workshopMapContentRowDesktop: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  workshopMapContentRowMobile: {
    flexDirection: 'column',
  },
  workshopInfoCol: {
    justifyContent: 'space-between',
    gap: 12,
  },
  workshopTitleText: {
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  workshopAddressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 6,
    marginBottom: 8,
  },
  workshopAddressText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '500',
  },
  workshopSpecsBox: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  workshopSpecRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  specIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  specLabelText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  specMainText: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 1,
  },
  specSubText: {
    fontSize: 10.5,
    marginTop: 0.5,
  },
  contactInputLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  openGoogleMapsBtn: {
    backgroundColor: '#1E2227',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    cursor: 'pointer',
  },
  openGoogleMapsBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  workshopMapCol: {
    display: 'flex',
    flexDirection: 'column',
  },
  mapViewerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 6,
  },
  mapViewerTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  mapSegmentedTabs: {
    flexDirection: 'row',
    padding: 2,
    borderRadius: 7,
    borderWidth: 1,
  },
  mapSegmentedTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 5,
    cursor: 'pointer',
  },
  mapSegmentedTabText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  mapViewportFrame: {
    width: '100%',
    height: 250,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
});
