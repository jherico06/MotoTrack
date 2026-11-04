// =========================================================================
// MotoTrack Customer Booking - Screen 5: Booking Information & Schedule
// Modern 2-column calendar and live time slot selection
// =========================================================================

import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, Linking, useWindowDimensions } from 'react-native';
import { BootstrapIcon } from '../../common';
import { packageBookingStyles as styles } from '../../../styles/web/packageBooking.web.styles.js';
import { garageService } from '../../../services/bookings/garageService.js';

// Shop pin location (triangulated from the Street View storefront frames)
const SHOP_LAT = 10.20672;
const SHOP_LNG = 123.75685;

// Minimum number of days between the booking day and the appointment day
const BOOKING_LEAD_DAYS = 3;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatSelectedFullDate(dateStr) {
  if (!dateStr) return 'Select a date from the calendar';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default function BookingInformationScreen({
  selectedMotorcycle: _selectedMotorcycle,
  selectedPackages: _selectedPackages = [],
  preferredDate,
  setPreferredDate,
  onDateChange,
  preferredTimeSlot,
  setPreferredTimeSlot,
  onTimeSlotChange,
  customerNotes: _customerNotes,
  setCustomerNotes: _setCustomerNotes,
  onNotesChange: _onNotesChange,
  motorcyclePhotos: _motorcyclePhotos = [],
  setMotorcyclePhotos: _setMotorcyclePhotos,
  onPhotosChange: _onPhotosChange,
  currentUser: _currentUser,
  onBack,
  onContinue,
  showToast: _showToast,
}) {
  const [mapMode, setMapMode] = useState('street'); // 'street' | 'satellite' | 'map'
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 960;

  const googleStreetViewUrl =
    'https://www.google.com/maps/@10.2066654,123.7569248,3a,75y,310h,90t/data=!3m6!1e1!3m4!1s1lF1W3G6qtLGnhLCbeyNKw!2e0!7i16384!8i8192';

  const googleStreetViewEmbedUrl =
    'https://www.google.com/maps/embed?pb=!4v1700000000000!6m8!1m7!1s1lF1W3G6qtLGnhLCbeyNKw!2m2!1d10.2066654!2d123.7569248!3f310!4f0!5f0.78';

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
      width: 36px;
      height: 36px;
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 6px 16px rgba(0,0,0,0.45);
      cursor: pointer;
    }
    .shop-pin-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #FFFFFF;
    }
    .leaflet-popup-content-wrapper {
      border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
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
      html: '<div style="position:relative;width:36px;height:36px;"><div class="shop-pin" title="D\\'Blockchain Motorparts"><div class="shop-pin-dot"></div></div></div>',
      iconSize: [36, 36],
      iconAnchor: [18, 44],
      popupAnchor: [0, -44]
    });

    L.marker([${lat}, ${lng}], { icon: pin }).addTo(map)
      .bindPopup("<b>D'Blockchain Motorparts</b><br/>109 Natalio B. Bacalso S National Hwy, Naga<br/><span style='color:#EA580C;font-size:11px;font-weight:700;'>📍 Official Service Pit Bays</span>")
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
      width: 36px;
      height: 36px;
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 6px 16px rgba(0,0,0,0.45);
      cursor: pointer;
    }
    .shop-pin-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #FFFFFF;
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
      html: '<div style="position:relative;width:36px;height:36px;"><div class="shop-pin" title="D\\'Blockchain Motorparts"><div class="shop-pin-dot"></div></div></div>',
      iconSize: [36, 36],
      iconAnchor: [18, 44],
      popupAnchor: [0, -44]
    });

    L.marker([${lat}, ${lng}], { icon: pin }).addTo(map)
      .bindPopup("<b>D'Blockchain Motorparts</b><br/>109 Natalio B. Bacalso S National Hwy, Naga")
      .openPopup();
  </script>
</body>
</html>`;
  }, []);

  // Customers must book at least BOOKING_LEAD_DAYS days after the day they book.
  const minBookingDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + BOOKING_LEAD_DAYS);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  // Calendar month view date
  const [currentMonthDate, setCurrentMonthDate] = useState(() => {
    if (preferredDate) {
      const d = new Date(preferredDate + 'T00:00:00');
      if (!isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    const target = new Date(minBookingDate + 'T00:00:00');
    return new Date(target.getFullYear(), target.getMonth(), 1);
  });

  const handleDateChange = (newDate) => {
    onDateChange?.(newDate);
    setPreferredDate?.(newDate);
  };

  const handleTimeSlotChange = (newTime) => {
    onTimeSlotChange?.(newTime);
    setPreferredTimeSlot?.(newTime);
  };

  // Default (or correct an out-of-range date) to the earliest allowed day, skipping Sunday
  useEffect(() => {
    if (!preferredDate || preferredDate < minBookingDate) {
      const first = new Date(minBookingDate + 'T00:00:00');
      if (first.getDay() === 0) {
        first.setDate(first.getDate() + 1);
      }
      const defaultDateStr = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}-${String(first.getDate()).padStart(2, '0')}`;
      onDateChange?.(defaultDateStr);
      setPreferredDate?.(defaultDateStr);
    }
  }, [preferredDate, minBookingDate, onDateChange, setPreferredDate]);

  // Sync calendar month with preferred date
  useEffect(() => {
    if (preferredDate) {
      const d = new Date(preferredDate + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        setCurrentMonthDate((prev) => {
          if (
            d.getFullYear() !== prev.getFullYear() ||
            d.getMonth() !== prev.getMonth()
          ) {
            return new Date(d.getFullYear(), d.getMonth(), 1);
          }
          return prev;
        });
      }
    }
  }, [preferredDate]);

  const handleSelectDate = (newDate) => {
    handleDateChange(newDate);
    // If selected time slot is already booked on the new date, reset it
    const newAvail = garageService.getDaySlotAvailability(newDate);
    if (preferredTimeSlot) {
      const match = newAvail?.slots?.find((s) => s.timeSlot === preferredTimeSlot);
      if (match?.isBooked) {
        handleTimeSlotChange('');
      }
    }
  };

  const getDayInfo = (dateStr) => {
    const selAvail = garageService.getDaySlotAvailability(dateStr);
    const d = new Date(dateStr + 'T00:00:00');
    const isSunday = d.getDay() === 0;
    const bookedCount = selAvail?.bookedSlotsCount || 0;
    const total = selAvail?.totalSlots || 5;
    const avail = typeof selAvail?.availableSlotsCount === 'number'
      ? selAvail.availableSlotsCount
      : Math.max(0, total - bookedCount);
    return {
      bookingCount: bookedCount,
      availableSlots: avail,
      totalSlots: total,
      isFullyBooked: selAvail?.isFullyBooked || false,
      isOffDuty: isSunday,
    };
  };

  // Month navigation
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
      const dayInfo = getDayInfo(dateStr);
      const isFullyBooked = dayInfo.isFullyBooked;
      const isSelectable = !isSunday && !isBeforeMin && !isFullyBooked;
      const isSelected = dateStr === preferredDate;

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
  }, [year, month, minBookingDate, preferredDate]);

  // Slots for the selected date
  const availableSlots = useMemo(() => {
    if (!preferredDate) return [];
    const selAvail = garageService.getDaySlotAvailability(preferredDate);
    return selAvail?.slots || [];
  }, [preferredDate]);

  const morningSlots = useMemo(() => {
    return availableSlots.filter((s) => /AM/i.test(s.timeSlot.split('-')[0]));
  }, [availableSlots]);

  const afternoonSlots = useMemo(() => {
    return availableSlots.filter((s) => !/AM/i.test(s.timeSlot.split('-')[0]));
  }, [availableSlots]);

  const isFormValid = Boolean(preferredDate && preferredTimeSlot);

  // Render a time slot row
  const renderSlotRow = (slot) => {
    const isSelected = preferredTimeSlot === slot.timeSlot;
    const isBooked = slot.isBooked;

    return (
      <TouchableOpacity
        key={slot.timeSlot}
        style={{
          borderRadius: 10,
          borderWidth: isSelected ? 1.5 : 1,
          borderColor: isSelected ? '#1E2227' : isBooked ? '#F4F4F5' : '#E4E4E7',
          backgroundColor: isSelected ? '#FAFAF9' : isBooked ? '#FAFAF9' : '#FFFFFF',
          paddingVertical: 12,
          paddingHorizontal: 16,
          marginBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: isBooked ? 'not-allowed' : 'pointer',
          shadowColor: '#000000',
          shadowOpacity: isSelected ? 0.04 : 0.02,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 1 },
          opacity: isBooked ? 0.6 : 1,
        }}
        disabled={isBooked}
        onPress={() => handleTimeSlotChange(slot.timeSlot)}
        activeOpacity={0.85}
      >
        {/* Left: Time & Slot Status Indicator */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              backgroundColor: isSelected ? '#1E2227' : isBooked ? '#F4F4F5' : '#F4F4F5',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BootstrapIcon
              name="clock"
              size={14}
              color={isSelected ? '#FFFFFF' : isBooked ? '#A1A1AA' : '#71717A'}
            />
          </View>

          <View>
            <Text
              style={{
                fontSize: 14,
                fontWeight: isSelected ? '700' : '600',
                color: isSelected ? '#1E2227' : isBooked ? '#A1A1AA' : '#18181B',
                letterSpacing: -0.2,
                fontVariant: ['tabular-nums'],
              }}
            >
              {slot.timeSlot}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: isSelected ? '#EA580C' : isBooked ? '#D4D4D8' : '#16A34A',
                }}
              />
              <Text
                style={{
                  fontSize: 11.5,
                  fontWeight: '500',
                  color: isSelected ? '#EA580C' : isBooked ? '#A1A1AA' : '#52525B',
                }}
              >
                {isSelected ? 'Selected time slot' : isBooked ? 'Fully booked' : 'Available'}
              </Text>
            </View>
          </View>
        </View>

        {/* Right: CTA Button */}
        {isSelected ? (
          <View
            style={{
              backgroundColor: '#1E2227',
              paddingHorizontal: 16,
              paddingVertical: 7,
              borderRadius: 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <BootstrapIcon name="check-lg" size={12} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>Selected</Text>
          </View>
        ) : isBooked ? (
          <View
            style={{
              backgroundColor: '#F4F4F5',
              paddingHorizontal: 16,
              paddingVertical: 7,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: '#A1A1AA', fontSize: 12, fontWeight: '600' }}>Full</Text>
          </View>
        ) : (
          <View
            style={{
              backgroundColor: '#1E2227',
              paddingHorizontal: 16,
              paddingVertical: 7,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>Book now</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View>
      {/* ─── PAGE TITLE & SUBTITLE ─── */}
      <View style={{ marginBottom: 28, alignItems: 'center', textAlign: 'center' }}>
        <Text style={[styles.pageTitle, { textAlign: 'center' }]}>Schedule & Workshop Location</Text>
        <Text style={[styles.pageSubtitle, { textAlign: 'center', maxWidth: 640 }]}>
          Choose your preferred appointment schedule and view our workshop pit bay location in Naga, Cebu.
        </Text>
      </View>

      {/* ─── 1. MODERN CALENDAR & LIVE TIME SLOTS (SIDE-BY-SIDE) ─── */}
      <View style={{ marginBottom: 24 }}>
        <View style={{ marginBottom: 14 }}>
          <Text style={styles.formLabel}>
            Select Preferred Appointment Schedule *
          </Text>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20, alignItems: 'stretch' }}>
          {/* ─── LEFT: CALENDAR CARD ─── */}
          <View
            style={{
              flex: 1.15,
              minWidth: 280,
              maxWidth: '100%',
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              borderWidth: 1,
              borderColor: '#E4E4E7',
              overflow: 'hidden',
              shadowColor: '#000000',
              shadowOpacity: 0.04,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 2 },
            }}
          >
            {/* Dark Header */}
            <View
              style={{
                backgroundColor: '#1E2227',
                paddingVertical: 16,
                paddingHorizontal: 18,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              {/* Prev Month Button */}
              <TouchableOpacity
                onPress={handlePrevMonth}
                disabled={!canGoPrev}
                style={{
                  backgroundColor: canGoPrev ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.04)',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: canGoPrev ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.08)',
                  cursor: canGoPrev ? 'pointer' : 'not-allowed',
                }}
                activeOpacity={0.8}
              >
                <Text style={{ color: canGoPrev ? '#FFFFFF' : '#71717A', fontSize: 11.5, fontWeight: '600' }}>
                  ← {prevMonthName}
                </Text>
              </TouchableOpacity>

              {/* Month Year Title */}
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '800',
                  color: '#FED7AA',
                  letterSpacing: 0.5,
                  textTransform: 'capitalize',
                }}
              >
                {MONTH_NAMES[month]} {year}
              </Text>

              {/* Next Month Button */}
              <TouchableOpacity
                onPress={handleNextMonth}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.18)',
                  cursor: 'pointer',
                }}
                activeOpacity={0.8}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 11.5, fontWeight: '600' }}>
                  {nextMonthName} →
                </Text>
              </TouchableOpacity>
            </View>

            {/* Days Grid Body */}
            <View style={{ padding: 18 }}>
              {/* Weekdays Row */}
              <View
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: 6,
                  marginBottom: 10,
                }}
              >
                {WEEKDAY_NAMES.map((name) => (
                  <View key={name} style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 4 }}>
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#71717A', textTransform: 'capitalize' }}>
                      {name}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Day Cells Grid */}
              <View
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: 6,
                }}
              >
                {calendarCells.map((cell) => {
                  if (!cell.isCurrentMonth) {
                    return (
                      <View
                        key={cell.key}
                        style={{
                          height: 42,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 10,
                        }}
                      >
                        <Text style={{ fontSize: 12.5, color: '#E4E4E7', fontWeight: '400' }}>
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
                      onPress={() => isSelectable && handleSelectDate(cell.dateStr)}
                      disabled={!isSelectable}
                      activeOpacity={0.8}
                      style={{
                        height: 42,
                        borderRadius: 10,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: isSelected ? 1.5 : isSelectable ? 1.5 : 1,
                        borderColor: isSelected
                          ? '#C2410C'
                          : isSelectable
                          ? '#FED7AA'
                          : '#F4F4F5',
                        backgroundColor: isSelected
                          ? '#EA580C'
                          : isSelectable
                          ? '#FFFFFF'
                          : '#FAFAF9',
                        cursor: isSelectable ? 'pointer' : 'not-allowed',
                        shadowColor: isSelected ? '#EA580C' : 'transparent',
                        shadowOpacity: isSelected ? 0.35 : 0,
                        shadowRadius: 6,
                        shadowOffset: { width: 0, height: 2 },
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13.5,
                          fontWeight: isSelected ? '800' : isSelectable ? '700' : '400',
                          color: isSelected
                            ? '#FFFFFF'
                            : isSelectable
                            ? '#18181B'
                            : isSunday
                            ? '#D4D4D8'
                            : '#D4D4D8',
                        }}
                      >
                        {cell.day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Bottom Legend */}
            <View
              style={{
                backgroundColor: '#FAFAF9',
                borderTopWidth: 1,
                borderTopColor: '#F4F4F5',
                paddingVertical: 12,
                paddingHorizontal: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-around',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#EA580C' }} />
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#18181B' }}>Selected</Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    borderWidth: 1.5,
                    borderColor: '#FED7AA',
                    backgroundColor: '#FFFFFF',
                  }}
                />
                <Text style={{ fontSize: 11, fontWeight: '500', color: '#71717A' }}>
                  Available (Mon–Sat)
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    borderWidth: 1,
                    borderColor: '#E4E4E7',
                    backgroundColor: '#FAFAF9',
                  }}
                />
                <Text style={{ fontSize: 11, fontWeight: '400', color: '#A1A1AA' }}>
                  Unavailable (Closed / &lt;3 Days)
                </Text>
              </View>
            </View>
          </View>

          {/* ─── RIGHT: LIVE BOOKING TIME & AVAILABILITY CARD ─── */}
          <View
            style={{
              flex: 1,
              minWidth: 280,
              maxWidth: '100%',
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              borderWidth: 1,
              borderColor: '#E4E4E7',
              padding: 22,
              shadowColor: '#000000',
              shadowOpacity: 0.04,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 2 },
            }}
          >
            {/* Header */}
            <View style={{ marginBottom: 18 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#18181B', letterSpacing: -0.3 }}>
                Live Booking Time & Availability
              </Text>
              <Text style={{ fontSize: 12.5, fontWeight: '500', color: '#71717A', marginTop: 3 }}>
                {formatSelectedFullDate(preferredDate)}
              </Text>
            </View>

            {/* Morning Session Slots */}
            {morningSlots.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <BootstrapIcon name="sun" size={13} color="#71717A" />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#71717A', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Morning Sessions (8:00 AM – 12:00 PM)
                  </Text>
                </View>
                {morningSlots.map(renderSlotRow)}
              </View>
            )}

            {/* Afternoon Session Slots */}
            {afternoonSlots.length > 0 && (
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, marginTop: 4 }}>
                  <BootstrapIcon name="sun-fill" size={13} color="#71717A" />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#71717A', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Afternoon Sessions (1:30 PM – 6:00 PM)
                  </Text>
                </View>
                {afternoonSlots.map(renderSlotRow)}
              </View>
            )}

            {availableSlots.length === 0 && (
              <View style={{ paddingVertical: 32, alignItems: 'center', justifyContent: 'center' }}>
                <BootstrapIcon name="calendar-x" size={28} color="#94A3B8" />
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#18181B', marginTop: 8 }}>
                  No Available Slots
                </Text>
                <Text style={{ fontSize: 12, color: '#71717A', textAlign: 'center', marginTop: 2 }}>
                  Pit bays are closed or fully booked on this date.
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* ─── 2. WORKSHOP LOCATION & INTERACTIVE MAP ─── */}
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 20,
          borderWidth: 1,
          borderColor: '#EFECE6',
          padding: 24,
          marginTop: 8,
          marginBottom: 24,
          shadowColor: '#78350F',
          shadowOpacity: 0.04,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        <View
          style={{
            flexDirection: isDesktop ? 'row' : 'column',
            gap: isDesktop ? 28 : 20,
            alignItems: 'stretch',
          }}
        >
          {/* ── LEFT COLUMN: WORKSHOP DETAILS, HOURS & ADDRESS ── */}
          <View
            style={{
              flex: isDesktop ? 0.44 : undefined,
              width: isDesktop ? undefined : '100%',
              justifyContent: 'space-between',
            }}
          >
            <View>
              {/* Workshop Title */}
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: '600',
                  color: '#18181B',
                  letterSpacing: -0.3,
                }}
              >
                D'Blockchain Motorparts & Accessories
              </Text>

              {/* Address */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8, marginBottom: 16 }}>
                <View style={{ marginTop: 2 }}>
                  <BootstrapIcon name="geo-alt-fill" size={13} color="#EF4444" />
                </View>
                <Text style={{ flex: 1, fontSize: 13, fontWeight: '500', color: '#3F3F46', lineHeight: 19 }}>
                  109 Natalio B. Bacalso S National Hwy, City of Naga, Cebu, 6037
                </Text>
              </View>

              {/* Information Box */}
              <View
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: '#EFECE6',
                  paddingHorizontal: 16,
                  paddingVertical: 4,
                }}
              >
                {[
                  {
                    key: 'hours',
                    icon: 'clock',
                    label: 'Operating Hours',
                    lines: ['Mon – Sat, 8:00 AM – 7:00 PM', 'Closed on Sundays'],
                  },
                  {
                    key: 'contact',
                    icon: 'telephone',
                    label: 'Contact',
                    lines: ['+63 961 490 4841', 'support@mototrack.ph'],
                  },
                  {
                    key: 'landmark',
                    icon: 'cursor',
                    label: 'Landmark',
                    lines: ["Beside Jerome's Gadget & Millenium", 'Natalio Bacalso Hwy, South Poblacion'],
                  },
                ].map((row, index, all) => (
                  <View
                    key={row.key}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      gap: 12,
                      paddingVertical: 12,
                      borderBottomWidth: index === all.length - 1 ? 0 : 1,
                      borderBottomColor: '#F4F4F5',
                    }}
                  >
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 10,
                        backgroundColor: '#FFF7ED',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <BootstrapIcon name={row.icon} size={13} color="#D97706" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: '500', color: '#A1A1AA', letterSpacing: 0.3 }}>
                        {row.label}
                      </Text>
                      <Text style={{ fontSize: 13, fontWeight: '500', color: '#18181B', marginTop: 2 }}>
                        {row.lines[0]}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#71717A', marginTop: 1 }}>{row.lines[1]}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Bottom Full-Width Action Button (Charcoal color #1E2227) */}
            <TouchableOpacity
              style={{
                backgroundColor: '#1E2227',
                borderRadius: 12,
                paddingVertical: 13,
                paddingHorizontal: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginTop: 18,
                shadowColor: '#000000',
                shadowOpacity: 0.12,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 },
              }}
              onPress={() => {
                if (typeof window !== 'undefined') {
                  window.open(googleStreetViewUrl, '_blank', 'noopener,noreferrer');
                } else {
                  Linking.openURL(googleStreetViewUrl).catch(() => {});
                }
              }}
              activeOpacity={0.88}
            >
              <BootstrapIcon name="geo-alt-fill" size={14} color="#EF4444" />
              <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 13.5 }}>
                Open in Google Maps App
              </Text>
              <BootstrapIcon name="box-arrow-up-right" size={11} color="#A1A1AA" />
            </TouchableOpacity>
          </View>

          {/* ── RIGHT COLUMN: STREET VIEW & MAP VIEWER ── */}
          <View style={{ flex: isDesktop ? 0.56 : undefined, width: isDesktop ? undefined : '100%' }}>
            {/* Header Row: Title & Segmented Tabs */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <BootstrapIcon name="compass" size={15} color="#D97706" />
                <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#78350F' }}>
                  Workshop Street View & Map
                </Text>
              </View>

              {/* Segmented Tabs: Street View | Roadmap | Satellite */}
              <View
                style={{
                  flexDirection: 'row',
                  backgroundColor: '#F5F5F4',
                  padding: 3,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#E7E5E4',
                }}
              >
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                    borderRadius: 6,
                    backgroundColor: mapMode === 'street' ? '#1E2227' : 'transparent',
                  }}
                  onPress={() => setMapMode('street')}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon
                    name="camera-video-fill"
                    size={11}
                    color={mapMode === 'street' ? '#FFFFFF' : '#71717A'}
                  />
                  <Text
                    style={{
                      fontSize: 11.5,
                      fontWeight: '700',
                      color: mapMode === 'street' ? '#FFFFFF' : '#57534E',
                    }}
                  >
                    Street View
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                    borderRadius: 6,
                    backgroundColor: mapMode === 'map' ? '#1E2227' : 'transparent',
                  }}
                  onPress={() => setMapMode('map')}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon
                    name="map"
                    size={11}
                    color={mapMode === 'map' ? '#FFFFFF' : '#71717A'}
                  />
                  <Text
                    style={{
                      fontSize: 11.5,
                      fontWeight: '700',
                      color: mapMode === 'map' ? '#FFFFFF' : '#57534E',
                    }}
                  >
                    Roadmap
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                    borderRadius: 6,
                    backgroundColor: mapMode === 'satellite' ? '#1E2227' : 'transparent',
                  }}
                  onPress={() => setMapMode('satellite')}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon
                    name="globe"
                    size={11}
                    color={mapMode === 'satellite' ? '#FFFFFF' : '#71717A'}
                  />
                  <Text
                    style={{
                      fontSize: 11.5,
                      fontWeight: '700',
                      color: mapMode === 'satellite' ? '#FFFFFF' : '#57534E',
                    }}
                  >
                    Satellite
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Viewport Frame */}
            <View
              style={{
                width: '100%',
                height: 390,
                borderRadius: 16,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: '#E4E4E7',
                backgroundColor: '#0F172A',
                position: 'relative',
              }}
            >
              {mapMode === 'street' ? (
                <iframe
                  title="D'Blockchain Motorparts & Accessories - Google Street View"
                  src={googleStreetViewEmbedUrl}
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
              )}
            </View>
          </View>
        </View>
      </View>

      {/* ─── NAVIGATION BUTTONS ─── */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 24,
          paddingTop: 16,
          borderTopWidth: 1,
          borderTopColor: '#E4E4E7',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: '#1E2227',
            cursor: 'pointer',
          }}
          onPress={onBack}
          activeOpacity={0.8}
        >
          <BootstrapIcon name="arrow-left" size={13} color="#1E2227" />
          <Text style={{ color: '#1E2227', fontWeight: '600', fontSize: 13 }}>
            Back to Rider Info
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 10,
            paddingHorizontal: 22,
            borderRadius: 8,
            backgroundColor: isFormValid ? '#1E2227' : '#94A3B8',
            cursor: isFormValid ? 'pointer' : 'not-allowed',
            shadowColor: '#000000',
            shadowOpacity: isFormValid ? 0.12 : 0,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
            opacity: isFormValid ? 1 : 0.6,
          }}
          disabled={!isFormValid}
          onPress={onContinue}
          activeOpacity={0.85}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
            Next: Review & Confirm
          </Text>
          <BootstrapIcon name="arrow-right" size={13} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
