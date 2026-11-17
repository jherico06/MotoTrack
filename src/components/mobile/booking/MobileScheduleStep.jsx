import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Platform, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { BootstrapIcon } from '../../common';
import { garageService } from '../../../services/bookings/garageService.js';

const SHOP_LAT = 10.20672;
const SHOP_LNG = 123.75685;
const BOOKING_LEAD_DAYS = 3;

const GOOGLE_STREET_VIEW_URL =
  'https://www.google.com/maps/@10.2066654,123.7569248,3a,75y,310h,90t/data=!3m6!1e1!3m4!1s1lF1W3G6qtLGnhLCbeyNKw!2e0!7i16384!8i8192';
const GOOGLE_STREET_VIEW_EMBED_URL =
  'https://www.google.com/maps/embed?pb=!4v1700000000000!6m8!1m7!1s1lF1W3G6qtLGnhLCbeyNKw!2m2!1d10.2066654!2d123.7569248!3f310!4f0!5f0.78';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function toLocalYmd(dateObj) {
  return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
}

function formatSelectedFullDate(dateStr) {
  if (!dateStr) return 'Select a date';
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

/** Builds Leaflet map HTML shared by Roadmap and Satellite views. */
function buildLeafletMapHtml({ lat, lng, tileUrl, initialZoom, maxZoom, background, popupHtml }) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * { box-sizing: border-box; }
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: ${background}; }
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
      box-shadow: 0 6px 16px rgba(0,0,0,0.45);
    }
    .shop-pin-dot {
      width: 11px;
      height: 11px;
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
    var map = L.map('map', { zoomControl: true, attributionControl: false }).setView([${lat}, ${lng}], ${initialZoom});
    L.tileLayer('${tileUrl}', { maxZoom: ${maxZoom} }).addTo(map);
    var pin = L.divIcon({
      className: '',
      html: '<div style="width:34px;height:34px;"><div class="shop-pin"><div class="shop-pin-dot"></div></div></div>',
      iconSize: [34, 34],
      iconAnchor: [17, 42],
      popupAnchor: [0, -40]
    });
    L.marker([${lat}, ${lng}], { icon: pin }).addTo(map).bindPopup("${popupHtml}").openPopup();
  </script>
</body>
</html>`;
}

/**
 * Web-parity Schedule step for mobile bottom sheet:
 * Calendar card, Time Slots picker card, and Workshop Location viewer.
 */
export default function MobileScheduleStep({
  selectedDate,
  onSelectDate,
  selectedTime,
  onSelectTime,
  isDarkMode = false,
}) {
  const [mapMode, setMapMode] = useState('street'); // 'street' | 'map' | 'satellite'

  const minBookingDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + BOOKING_LEAD_DAYS);
    return toLocalYmd(d);
  }, []);

  const [currentMonthDate, setCurrentMonthDate] = useState(() => {
    if (selectedDate) {
      const d = new Date(selectedDate + 'T00:00:00');
      if (!isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    const target = new Date(minBookingDate + 'T00:00:00');
    return new Date(target.getFullYear(), target.getMonth(), 1);
  });

  // Ensure initial date honors the 3-day lead rule and skips closed Sundays
  useEffect(() => {
    const parsed = selectedDate ? new Date(selectedDate + 'T00:00:00') : null;
    const isInvalidOrSunday =
      !selectedDate ||
      !parsed ||
      isNaN(parsed.getTime()) ||
      selectedDate < minBookingDate ||
      parsed.getDay() === 0;

    if (isInvalidOrSunday) {
      const next = new Date(minBookingDate + 'T00:00:00');
      if (next.getDay() === 0) next.setDate(next.getDate() + 1);
      onSelectDate?.(toLocalYmd(next));
    }
  }, [selectedDate, minBookingDate, onSelectDate]);

  useEffect(() => {
    if (!selectedDate) return;
    const d = new Date(selectedDate + 'T00:00:00');
    if (isNaN(d.getTime())) return;
    setCurrentMonthDate((prev) =>
      d.getFullYear() !== prev.getFullYear() || d.getMonth() !== prev.getMonth()
        ? new Date(d.getFullYear(), d.getMonth(), 1)
        : prev
    );
  }, [selectedDate]);

  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
  const minYear = parseInt(minBookingDate.slice(0, 4), 10);
  const minMonth = parseInt(minBookingDate.slice(5, 7), 10) - 1;
  const canGoPrev = year > minYear || (year === minYear && month > minMonth);

  const handlePickDate = (dateStr) => {
    onSelectDate?.(dateStr);
    if (selectedTime) {
      const avail = garageService.getDaySlotAvailability(dateStr);
      const taken = avail?.slots?.find((s) => s.timeSlot === selectedTime)?.isBooked;
      if (taken) onSelectTime?.('');
    }
  };

  const calendarWeeks = useMemo(() => {
    const firstDayRaw = new Date(year, month, 1).getDay();
    const firstDayCol = (firstDayRaw + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells = [];
    for (let i = firstDayCol - 1; i >= 0; i--) {
      cells.push({
        key: `prev-${i}`,
        day: daysInPrevMonth - i,
        isCurrentMonth: false,
        isSelectable: false,
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = (firstDayCol + d - 1) % 7;
      const isSunday = dayOfWeek === 6;
      const isBeforeMin = dateStr < minBookingDate;
      const avail = garageService.getDaySlotAvailability(dateStr);
      const isFullyBooked = Boolean(avail?.isFullyBooked);
      const isSelectable = !isSunday && !isBeforeMin && !isFullyBooked;

      cells.push({
        key: `cur-${d}`,
        day: d,
        dateStr,
        isCurrentMonth: true,
        isSelectable,
        isSelected: dateStr === selectedDate,
      });
    }

    const trailing = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= trailing; i++) {
      cells.push({
        key: `next-${i}`,
        day: i,
        isCurrentMonth: false,
        isSelectable: false,
      });
    }

    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    return weeks;
  }, [year, month, minBookingDate, selectedDate]);

  const availableSlots = useMemo(() => {
    if (!selectedDate) return [];
    return garageService.getDaySlotAvailability(selectedDate)?.slots || [];
  }, [selectedDate]);

  const morningSlots = useMemo(
    () => availableSlots.filter((s) => /AM/i.test(s.timeSlot.split('-')[0])),
    [availableSlots]
  );
  const afternoonSlots = useMemo(
    () => availableSlots.filter((s) => !/AM/i.test(s.timeSlot.split('-')[0])),
    [availableSlots]
  );

  const satelliteMapHtml = useMemo(
    () =>
      buildLeafletMapHtml({
        lat: SHOP_LAT,
        lng: SHOP_LNG,
        tileUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        initialZoom: 19,
        maxZoom: 19,
        background: '#0F172A',
        popupHtml: "<b>D'Blockchain Motorparts</b><br/>Naga City, Cebu",
      }),
    []
  );

  const roadMapHtml = useMemo(
    () =>
      buildLeafletMapHtml({
        lat: SHOP_LAT,
        lng: SHOP_LNG,
        tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        initialZoom: 18,
        maxZoom: 19,
        background: '#F8FAFC',
        popupHtml: "<b>D'Blockchain Motorparts</b><br/>109 N. Bacalso Hwy, Naga",
      }),
    []
  );

  const streetViewHtml = useMemo(
    () => `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>html, body, iframe { margin: 0; padding: 0; width: 100%; height: 100%; border: 0; background: #0F172A; }</style>
</head>
<body>
  <iframe src="${GOOGLE_STREET_VIEW_EMBED_URL}" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
</body>
</html>`,
    []
  );

  const cardSurface = {
    backgroundColor: isDarkMode ? '#191A1D' : '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: isDarkMode ? '#303236' : '#E4E4E7',
    overflow: 'hidden',
  };

  const renderSlotRow = (slot) => {
    const isPicked = selectedTime === slot.timeSlot;
    const isBooked = Boolean(slot.isBooked);

    return (
      <TouchableOpacity
        key={slot.timeSlot}
        disabled={isBooked}
        onPress={() => onSelectTime?.(slot.timeSlot)}
        activeOpacity={0.85}
        style={{
          borderRadius: 10,
          borderWidth: isPicked ? 1.5 : 1,
          borderColor: isPicked ? '#1E2227' : isBooked ? '#F4F4F5' : '#E4E4E7',
          backgroundColor: isPicked ? '#FAFAF9' : '#FFFFFF',
          paddingVertical: 11,
          paddingHorizontal: 13,
          marginBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: isBooked ? 0.58 : 1,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: 8 }}>
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 7,
              backgroundColor: isPicked ? '#1E2227' : '#F4F4F5',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BootstrapIcon
              name="clock"
              size={13}
              color={isPicked ? '#FFFFFF' : isBooked ? '#A1A1AA' : '#71717A'}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 13.5,
                fontWeight: isPicked ? '700' : '600',
                color: isPicked ? '#1E2227' : isBooked ? '#A1A1AA' : '#18181B',
                fontVariant: ['tabular-nums'],
              }}
              numberOfLines={1}
            >
              {slot.timeSlot}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: isPicked ? '#EA580C' : isBooked ? '#D4D4D8' : '#16A34A',
                }}
              />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '500',
                  color: isPicked ? '#EA580C' : isBooked ? '#A1A1AA' : '#52525B',
                }}
              >
                {isPicked ? 'Selected' : isBooked ? 'Full' : 'Available'}
              </Text>
            </View>
          </View>
        </View>

        <View
          style={{
            backgroundColor: isBooked ? '#F4F4F5' : '#1E2227',
            paddingHorizontal: 13,
            paddingVertical: 6.5,
            borderRadius: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {isPicked ? <BootstrapIcon name="check-lg" size={11} color="#FFFFFF" /> : null}
          <Text
            style={{
              color: isBooked ? '#A1A1AA' : '#FFFFFF',
              fontSize: 11.5,
              fontWeight: '700',
            }}
          >
            {isPicked ? 'Selected' : isBooked ? 'Full' : 'Select'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ gap: 14, paddingTop: 6 }}>
      {/* ─── 1. WEB-STYLE CALENDAR CARD ─── */}
      <View style={cardSurface}>
        <View
          style={{
            backgroundColor: '#1E2227',
            paddingVertical: 13,
            paddingHorizontal: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <TouchableOpacity
            onPress={() => canGoPrev && setCurrentMonthDate(new Date(year, month - 1, 1))}
            disabled={!canGoPrev}
            activeOpacity={0.8}
            style={{
              backgroundColor: canGoPrev ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
              paddingHorizontal: 10,
              paddingVertical: 5.5,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: canGoPrev ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)',
            }}
          >
            <Text style={{ color: canGoPrev ? '#FFFFFF' : '#71717A', fontSize: 11.5, fontWeight: '600' }}>
              ← {SHORT_MONTHS[(month + 11) % 12]}
            </Text>
          </TouchableOpacity>

          <Text style={{ fontSize: 15.5, fontWeight: '800', color: '#FED7AA', letterSpacing: 0.3 }}>
            {MONTH_NAMES[month]} {year}
          </Text>

          <TouchableOpacity
            onPress={() => setCurrentMonthDate(new Date(year, month + 1, 1))}
            activeOpacity={0.8}
            style={{
              backgroundColor: 'rgba(255,255,255,0.1)',
              paddingHorizontal: 10,
              paddingVertical: 5.5,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.18)',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 11.5, fontWeight: '600' }}>
              {SHORT_MONTHS[(month + 1) % 12]} →
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ padding: 14 }}>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
            {WEEKDAY_NAMES.map((name) => (
              <View key={name} style={{ flex: 1, alignItems: 'center', paddingVertical: 3 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#71717A' }}>{name}</Text>
              </View>
            ))}
          </View>

          <View style={{ gap: 6 }}>
            {calendarWeeks.map((week, wIdx) => (
              <View key={`wk-${wIdx}`} style={{ flexDirection: 'row', gap: 6 }}>
                {week.map((cell) => {
                  if (!cell.isCurrentMonth) {
                    return (
                      <View
                        key={cell.key}
                        style={{ flex: 1, height: 38, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Text style={{ fontSize: 12, color: '#D4D4D8' }}>{cell.day}</Text>
                      </View>
                    );
                  }
                  const { isSelectable, isSelected } = cell;
                  return (
                    <TouchableOpacity
                      key={cell.key}
                      disabled={!isSelectable}
                      onPress={() => isSelectable && handlePickDate(cell.dateStr)}
                      activeOpacity={0.8}
                      style={{
                        flex: 1,
                        height: 38,
                        borderRadius: 9,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: isSelected || isSelectable ? 1.5 : 1,
                        borderColor: isSelected ? '#C2410C' : isSelectable ? '#FED7AA' : '#F4F4F5',
                        backgroundColor: isSelected ? '#EA580C' : isSelectable ? '#FFFFFF' : '#FAFAF9',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: isSelected ? '800' : isSelectable ? '700' : '400',
                          color: isSelected ? '#FFFFFF' : isSelectable ? '#18181B' : '#D4D4D8',
                        }}
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

        <View
          style={{
            backgroundColor: '#FAFAF9',
            borderTopWidth: 1,
            borderTopColor: '#F4F4F5',
            paddingVertical: 10,
            paddingHorizontal: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-around',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#EA580C' }} />
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#18181B' }}>Selected</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View
              style={{
                width: 9,
                height: 9,
                borderRadius: 4.5,
                borderWidth: 1.5,
                borderColor: '#FED7AA',
                backgroundColor: '#FFFFFF',
              }}
            />
            <Text style={{ fontSize: 11, fontWeight: '500', color: '#71717A' }}>Available</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View
              style={{
                width: 9,
                height: 9,
                borderRadius: 4.5,
                borderWidth: 1,
                borderColor: '#E4E4E7',
                backgroundColor: '#FAFAF9',
              }}
            />
            <Text style={{ fontSize: 11, color: '#A1A1AA' }}>Unavailable</Text>
          </View>
        </View>
      </View>

      {/* ─── 2. WEB-STYLE TIME PICKER CARD ─── */}
      <View style={[cardSurface, { padding: 16 }]}>
        <View style={{ marginBottom: 12 }}>
          <Text
            style={{
              fontSize: 16.5,
              fontWeight: '800',
              color: isDarkMode ? '#F2F2F3' : '#18181B',
              letterSpacing: -0.2,
            }}
          >
            Time Slots
          </Text>
          <Text style={{ fontSize: 12, fontWeight: '500', color: '#71717A', marginTop: 2 }}>
            {formatSelectedFullDate(selectedDate)}
          </Text>
        </View>

        {morningSlots.length > 0 ? (
          <View style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <BootstrapIcon name="sun" size={12} color="#71717A" />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: '#71717A',
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                }}
              >
                Morning
              </Text>
            </View>
            {morningSlots.map(renderSlotRow)}
          </View>
        ) : null}

        {afternoonSlots.length > 0 ? (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, marginTop: 2 }}>
              <BootstrapIcon name="sun-fill" size={12} color="#71717A" />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: '#71717A',
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                }}
              >
                Afternoon
              </Text>
            </View>
            {afternoonSlots.map(renderSlotRow)}
          </View>
        ) : null}

        {availableSlots.length === 0 ? (
          <View style={{ paddingVertical: 20, alignItems: 'center', gap: 6 }}>
            <BootstrapIcon name="calendar-x" size={24} color="#94A3B8" />
            <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#18181B' }}>No Slots Available</Text>
          </View>
        ) : null}
      </View>

      {/* ─── 3. WEB-STYLE WORKSHOP LOCATION VIEWER CARD ─── */}
      <View style={[cardSurface, { padding: 16, gap: 12, borderColor: '#EFECE6' }]}>
        <View>
          <Text
            style={{
              fontSize: 17,
              fontWeight: '700',
              color: isDarkMode ? '#F2F2F3' : '#18181B',
              letterSpacing: -0.2,
            }}
          >
            D'Blockchain Motorparts & Accessories
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 5 }}>
            <View style={{ marginTop: 2 }}>
              <BootstrapIcon name="geo-alt-fill" size={12} color="#EF4444" />
            </View>
            <Text style={{ flex: 1, fontSize: 12.5, fontWeight: '500', color: '#3F3F46', lineHeight: 18 }}>
              109 Natalio B. Bacalso S National Hwy, Naga, Cebu 6037
            </Text>
          </View>
        </View>

        <View
          style={{
            borderRadius: 14,
            borderWidth: 1,
            borderColor: '#EFECE6',
            paddingHorizontal: 12,
            paddingVertical: 2,
          }}
        >
          {[
            { key: 'hours', icon: 'clock', label: 'Hours', value: 'Mon – Sat, 8:00 AM – 7:00 PM' },
            { key: 'contact', icon: 'telephone', label: 'Phone', value: '+63 961 490 4841' },
            { key: 'landmark', icon: 'cursor', label: 'Landmark', value: "Beside Jerome's Gadget & Millenium" },
          ].map((row, idx, arr) => (
            <View
              key={row.key}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 9,
                borderBottomWidth: idx === arr.length - 1 ? 0 : 1,
                borderBottomColor: '#F4F4F5',
              }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  backgroundColor: '#FFF7ED',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BootstrapIcon name={row.icon} size={12} color="#D97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10.5, fontWeight: '600', color: '#A1A1AA' }}>{row.label}</Text>
                <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#18181B' }}>{row.value}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Map Mode Tabs: Street View | Roadmap | Satellite */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: '#F5F5F4',
            padding: 3,
            borderRadius: 9,
            borderWidth: 1,
            borderColor: '#E7E5E4',
          }}
        >
          {[
            { id: 'street', label: 'Street View', icon: 'camera-video-fill' },
            { id: 'map', label: 'Roadmap', icon: 'map' },
            { id: 'satellite', label: 'Satellite', icon: 'globe' },
          ].map((tab) => {
            const active = mapMode === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setMapMode(tab.id)}
                activeOpacity={0.85}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  paddingVertical: 7,
                  borderRadius: 7,
                  backgroundColor: active ? '#1E2227' : 'transparent',
                }}
              >
                <BootstrapIcon name={tab.icon} size={11} color={active ? '#FFFFFF' : '#71717A'} />
                <Text
                  style={{
                    fontSize: 11.5,
                    fontWeight: '700',
                    color: active ? '#FFFFFF' : '#57534E',
                  }}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Map Viewer Frame */}
        <View
          style={{
            width: '100%',
            height: 230,
            borderRadius: 14,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: '#E4E4E7',
            backgroundColor: '#0F172A',
          }}
        >
          {Platform.OS === 'web' ? (
            <iframe
              title={`MotoTrack Workshop - ${mapMode}`}
              src={mapMode === 'street' ? GOOGLE_STREET_VIEW_EMBED_URL : undefined}
              srcDoc={
                mapMode === 'map'
                  ? roadMapHtml
                  : mapMode === 'satellite'
                    ? satelliteMapHtml
                    : undefined
              }
              style={{ width: '100%', height: '100%', border: 0 }}
              loading="lazy"
            />
          ) : (
            <WebView
              key={mapMode}
              originWhitelist={['*']}
              source={
                mapMode === 'street'
                  ? { html: streetViewHtml, baseUrl: 'https://mototrack.ph' }
                  : {
                      html: mapMode === 'map' ? roadMapHtml : satelliteMapHtml,
                      baseUrl: 'https://unpkg.com',
                    }
              }
              style={{ flex: 1, backgroundColor: 'transparent' }}
              javaScriptEnabled
              domStorageEnabled
              mixedContentMode="compatibility"
              nestedScrollEnabled
            />
          )}
        </View>

        <TouchableOpacity
          onPress={() => Linking.openURL(GOOGLE_STREET_VIEW_URL).catch(() => {})}
          activeOpacity={0.85}
          style={{
            backgroundColor: '#1E2227',
            borderRadius: 12,
            paddingVertical: 12,
            paddingHorizontal: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <BootstrapIcon name="geo-alt-fill" size={13} color="#EF4444" />
          <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 13 }}>Open in Google Maps</Text>
          <BootstrapIcon name="box-arrow-up-right" size={11} color="#A1A1AA" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
