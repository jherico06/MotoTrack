/**
 * Web-only interactive Leaflet + OpenStreetMap delivery house-pin picker.
 * Renders via an isolated <iframe> with Leaflet CDN retry guards, ResizeObserver
 * invalidateSize() calls, click-to-drop/drag pin placement, address geocoding search,
 * and browser GPS detection.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { BootstrapIcon } from '../common/BootstrapIcon.jsx';
import { geocodeAddress, parseLatLng, STORE_LOCATION } from '../../utils/geo.js';
import { fontFamily } from '../../styles/typography.js';

const DEFAULT_ZOOM_UNSET = 14;
const PIN_ZOOM = 18;

function buildWebPickerHtml({ initialLat, initialLng, hasInitialPin, pickerId }) {
  const centerLat = hasInitialPin ? initialLat : STORE_LOCATION.lat;
  const centerLng = hasInitialPin ? initialLng : STORE_LOCATION.lng;
  const startZoom = hasInitialPin ? PIN_ZOOM : DEFAULT_ZOOM_UNSET;
  const safePickerId = String(pickerId || 'web-delivery-picker').replace(/[^a-zA-Z0-9_-]/g, '');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map {
      height: 100%;
      width: 100%;
      margin: 0;
      padding: 0;
      background: #E8EEF2;
      overflow: hidden;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .pin-house-wrap {
      position: relative;
      width: 36px;
      height: 42px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: grab;
    }
    .pin-house-wrap:active {
      cursor: grabbing;
    }
    .pin-house-badge {
      width: 34px;
      height: 34px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      background: #EA580C;
      border: 2.5px solid #FFFFFF;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.35);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .pin-house-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #FFFFFF;
    }
    .store-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #0F172A;
      border: 2.5px solid #FFFFFF;
      box-shadow: 0 2px 6px rgba(15, 23, 42, 0.35);
    }
    .leaflet-control-zoom {
      border: 1px solid #CBD5E1 !important;
      border-radius: 8px !important;
      overflow: hidden !important;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.12) !important;
    }
    .leaflet-control-zoom a {
      background-color: #FFFFFF !important;
      color: #0F172A !important;
      width: 30px !important;
      height: 30px !important;
      line-height: 30px !important;
      font-size: 16px !important;
      font-weight: 700 !important;
      text-decoration: none !important;
    }
    .hint-pill {
      position: absolute;
      bottom: 10px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 900;
      background: rgba(15, 23, 42, 0.86);
      color: #FFFFFF;
      font-size: 11px;
      font-weight: 600;
      padding: 5px 12px;
      border-radius: 999px;
      white-space: nowrap;
      pointer-events: none;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.25);
    }
    .offline-notice {
      display: none;
      position: absolute;
      inset: 0;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 20px;
      background: #F8FAFC;
      color: #475569;
      font-size: 12.5px;
      font-weight: 600;
      z-index: 1000;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="hint" class="hint-pill">Click anywhere on your house to drop pin, or drag pin to fine-tune</div>
  <div id="offlineNotice" class="offline-notice">
    Unable to load OpenStreetMap tiles. Please check your internet connection and reload.
  </div>
  <script>
    (function () {
      var attempts = 0;
      var maxAttempts = 45;
      var pendingPin = ${hasInitialPin ? `{ lat: ${centerLat}, lng: ${centerLng}, zoom: ${PIN_ZOOM} }` : 'null'};

      function bootMap() {
        if (typeof window.L === 'undefined') {
          attempts += 1;
          if (attempts >= maxAttempts) {
            var notice = document.getElementById('offlineNotice');
            if (notice) notice.style.display = 'flex';
            return;
          }
          setTimeout(bootMap, 150);
          return;
        }

        var L = window.L;
        var map = L.map('map', { zoomControl: true, attributionControl: true }).setView(
          [${centerLat}, ${centerLng}],
          ${startZoom}
        );

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap'
        }).addTo(map);

        var storeIcon = L.divIcon({
          className: '',
          html: '<div class="store-dot" title="MotoTrack Store Hub"></div>',
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        });
        L.marker([${STORE_LOCATION.lat}, ${STORE_LOCATION.lng}], {
          icon: storeIcon,
          interactive: false
        }).addTo(map);

        var houseIcon = L.divIcon({
          className: '',
          html: '<div class="pin-house-wrap"><div class="pin-house-badge"><div class="pin-house-dot"></div></div></div>',
          iconSize: [36, 42],
          iconAnchor: [18, 38]
        });

        var marker = null;

        function emitPin(lat, lng, source) {
          var payload = JSON.stringify({
            type: 'moto-location-picker',
            pickerId: '${safePickerId}',
            lat: Number(Number(lat).toFixed(6)),
            lng: Number(Number(lng).toFixed(6)),
            source: source || 'drag'
          });
          try {
            if (window.parent && window.parent !== window) {
              window.parent.postMessage(payload, '*');
            }
          } catch (e) {}
        }

        function ensureMarker(lat, lng, zoomLevel) {
          if (!isFinite(lat) || !isFinite(lng)) return;
          if (!marker) {
            marker = L.marker([lat, lng], { icon: houseIcon, draggable: true }).addTo(map);
            marker.on('dragend', function () {
              var pos = marker.getLatLng();
              emitPin(pos.lat, pos.lng, 'drag');
            });
          } else {
            marker.setLatLng([lat, lng]);
          }
          var targetZoom = typeof zoomLevel === 'number' ? zoomLevel : Math.max(map.getZoom() || 0, ${PIN_ZOOM});
          map.setView([lat, lng], targetZoom, { animate: true });
        }

        if (pendingPin) {
          ensureMarker(pendingPin.lat, pendingPin.lng, pendingPin.zoom);
        }

        map.on('click', function (ev) {
          var lat = ev.latlng.lat;
          var lng = ev.latlng.lng;
          var nextZoom = Math.max(map.getZoom() || 0, ${PIN_ZOOM});
          ensureMarker(lat, lng, nextZoom);
          emitPin(lat, lng, 'tap');
        });

        function handleIncoming(ev) {
          try {
            var msg = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
            if (!msg) return;
            if (msg.type === 'set-pin') {
              if (isFinite(Number(msg.lat)) && isFinite(Number(msg.lng))) {
                ensureMarker(Number(msg.lat), Number(msg.lng), Number(msg.zoom) || ${PIN_ZOOM});
              }
            } else if (msg.type === 'center-view') {
              if (isFinite(Number(msg.lat)) && isFinite(Number(msg.lng))) {
                map.setView([Number(msg.lat), Number(msg.lng)], Number(msg.zoom) || ${DEFAULT_ZOOM_UNSET}, { animate: true });
              }
            } else if (msg.type === 'invalidate-size') {
              map.invalidateSize();
            }
          } catch (e) {}
        }

        window.addEventListener('message', handleIncoming);
        window.addEventListener('resize', function () { map.invalidateSize(); });

        if (typeof ResizeObserver !== 'undefined') {
          var ro = new ResizeObserver(function () {
            map.invalidateSize();
          });
          ro.observe(document.body);
        }

        setTimeout(function () { map.invalidateSize(); }, 120);
        setTimeout(function () { map.invalidateSize(); }, 420);
        setTimeout(function () { map.invalidateSize(); }, 900);
      }

      bootMap();
    })();
  </script>
</body>
</html>`;
}

export default function WebLocationPicker({
  latitude,
  longitude,
  addressText = '',
  onLocationChange,
  isDarkMode = false,
  height = 240,
  errorText = '',
  showSearch = true,
  compact = false,
}) {
  const iframeRef = useRef(null);
  const mapReady = useRef(false);
  const lastEmittedRef = useRef(null);
  const pickerIdRef = useRef(`webpick_${Math.random().toString(36).slice(2, 10)}`);

  const [mapLoading, setMapLoading] = useState(true);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [statusNotice, setStatusNotice] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const parsedPin = useMemo(() => parseLatLng(latitude, longitude), [latitude, longitude]);

  // Capture initial coordinate once so dragging does not reload iframe HTML
  const initialPinRef = useRef(parsedPin);
  const html = useMemo(
    () =>
      buildWebPickerHtml({
        initialLat: initialPinRef.current?.lat ?? STORE_LOCATION.lat,
        initialLng: initialPinRef.current?.lng ?? STORE_LOCATION.lng,
        hasInitialPin: Boolean(initialPinRef.current),
        pickerId: pickerIdRef.current,
      }),
    []
  );

  const postToMap = useCallback((payload) => {
    const win = iframeRef.current?.contentWindow;
    if (win) {
      win.postMessage(JSON.stringify(payload), '*');
    }
  }, []);

  // Push external coordinate updates (GPS, Locate Address, reopened dialog) into the map
  useEffect(() => {
    if (!parsedPin || !mapReady.current) return;
    const prev = lastEmittedRef.current;
    if (
      prev &&
      Math.abs(prev.lat - parsedPin.lat) < 0.000001 &&
      Math.abs(prev.lng - parsedPin.lng) < 0.000001
    ) {
      return;
    }
    postToMap({
      type: 'set-pin',
      lat: parsedPin.lat,
      lng: parsedPin.lng,
      zoom: PIN_ZOOM,
    });
  }, [parsedPin, postToMap]);

  useEffect(() => {
    if (!mapReady.current) return undefined;
    const t = setTimeout(() => {
      postToMap({ type: 'invalidate-size' });
    }, 120);
    return () => clearTimeout(t);
  }, [isExpanded, height, postToMap]);

  const handleMapPayload = useCallback(
    (rawData) => {
      try {
        const msg = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
        if (!msg || msg.type !== 'moto-location-picker') return;
        if (msg.pickerId !== pickerIdRef.current) return;
        const coords = parseLatLng(msg.lat, msg.lng);
        if (!coords) return;

        lastEmittedRef.current = coords;
        setLocalError('');
        setStatusNotice(
          msg.source === 'drag'
            ? 'Pin moved to your exact house spot.'
            : 'Pin dropped. Drag the orange marker to adjust if needed.'
        );
        onLocationChange?.({ lat: coords.lat, lng: coords.lng, source: msg.source || 'drag' });
      } catch (_e) {}
    },
    [onLocationChange]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onWindowMessage = (event) => {
      handleMapPayload(event?.data);
    };
    window.addEventListener('message', onWindowMessage);
    return () => window.removeEventListener('message', onWindowMessage);
  }, [handleMapPayload]);

  const handleUseCurrentLocation = async () => {
    if (gpsLoading) return;
    setLocalError('');
    setStatusNotice('');

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocalError(
        'Browser geolocation is not supported on this browser. Click your house on the map or search your street instead.'
      );
      return;
    }

    setGpsLoading(true);
    try {
      await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const coords = parseLatLng(pos?.coords?.latitude, pos?.coords?.longitude);
            if (!coords) {
              setLocalError('Could not read a valid GPS coordinate. Click the map to drop your pin.');
              resolve();
              return;
            }
            lastEmittedRef.current = null;
            postToMap({ type: 'set-pin', lat: coords.lat, lng: coords.lng, zoom: PIN_ZOOM });
            setStatusNotice('GPS location detected. Drag the orange pin onto your exact gate or house.');
            onLocationChange?.({ lat: coords.lat, lng: coords.lng, source: 'gps' });
            resolve();
          },
          (err) => {
            if (err?.code === 1) {
              setLocalError(
                'Location permission was denied in your browser. Allow location access or click directly on the map.'
              );
            } else if (err?.code === 2) {
              setLocalError(
                'Current location is unavailable right now. Search your street or click directly on the map.'
              );
            } else {
              setLocalError(
                'GPS lookup timed out. Click your location on the map or try searching your street.'
              );
            }
            resolve();
          },
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
        );
      });
    } finally {
      setGpsLoading(false);
    }
  };

  const runGeocodeQuery = async (queryText) => {
    if (geocodeLoading) return;
    const q = String(queryText || '').trim();
    if (!q || q.length < 3) {
      setLocalError('Enter your street, purok, or barangay first before searching the map.');
      return;
    }

    setLocalError('');
    setStatusNotice('');
    setGeocodeLoading(true);
    try {
      const coords = await geocodeAddress(q);
      if (!coords) {
        setLocalError(
          'Could not find that exact street. Try searching just the barangay + city, then drag the pin to your house.'
        );
        return;
      }
      lastEmittedRef.current = null;
      postToMap({ type: 'set-pin', lat: coords.lat, lng: coords.lng, zoom: 17 });
      setStatusNotice('Approximate area found — drag the orange pin onto your exact house!');
      onLocationChange?.({ lat: coords.lat, lng: coords.lng, source: 'geocode' });
    } catch (_e) {
      setLocalError('Address lookup failed. Click or drag directly on the map to set your pin.');
    } finally {
      setGeocodeLoading(false);
    }
  };

  const handleRecenterOnHub = () => {
    postToMap({
      type: 'center-view',
      lat: STORE_LOCATION.lat,
      lng: STORE_LOCATION.lng,
      zoom: DEFAULT_ZOOM_UNSET,
    });
    setStatusNotice('Centered map near City of Naga / MotoTrack Hub. Click your street to drop a pin.');
  };

  const surfaceBg = isDarkMode ? '#14181D' : '#F8FAFC';
  const inputBg = isDarkMode ? '#111316' : '#FFFFFF';
  const borderCol = isDarkMode ? '#303236' : '#CBD5E1';
  const textPrimary = isDarkMode ? '#F2F2F3' : '#0F172A';
  const textMuted = isDarkMode ? '#A1A1AA' : '#64748B';
  const mapHeight = isExpanded ? Math.max(height + 110, 340) : height;

  return (
    <View style={{ gap: compact ? 6 : 8 }}>
      {/* Optional place search bar for easy web lookup */}
      {showSearch && (
        <View style={styles.searchRow}>
          <View
            style={[
              styles.searchInputWrap,
              {
                backgroundColor: inputBg,
                borderColor: borderCol,
              },
            ]}
          >
            <BootstrapIcon name="search" size={12.5} color={textMuted} />
            <TextInput
              style={[
                styles.searchInput,
                {
                  color: textPrimary,
                  fontFamily: fontFamily.sans,
                },
              ]}
              placeholder="Search barangay, street, or landmark (e.g. Inoburan, City of Naga)"
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={(val) => {
                setSearchQuery(val);
                if (localError) setLocalError('');
              }}
              returnKeyType="search"
              onSubmitEditing={() => runGeocodeQuery(searchQuery || addressText)}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <BootstrapIcon name="x-circle-fill" size={13} color={textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            onPress={() => runGeocodeQuery(searchQuery || addressText)}
            disabled={geocodeLoading}
            activeOpacity={0.85}
            style={[
              styles.searchBtn,
              {
                backgroundColor: isDarkMode ? '#202124' : '#FFFFFF',
                borderColor: borderCol,
                opacity: geocodeLoading ? 0.7 : 1,
              },
            ]}
          >
            {geocodeLoading ? (
              <ActivityIndicator size="small" color="#EA580C" />
            ) : (
              <Text style={{ fontSize: 12, fontWeight: '600', color: textPrimary, fontFamily: fontFamily.sans }}>
                Find
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Action Buttons Row */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          onPress={handleUseCurrentLocation}
          disabled={gpsLoading}
          activeOpacity={0.85}
          style={[styles.gpsBtn, { opacity: gpsLoading ? 0.7 : 1 }]}
        >
          {gpsLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <BootstrapIcon name="crosshair" size={13} color="#FFFFFF" />
          )}
          <Text style={[styles.gpsBtnText, { fontFamily: fontFamily.sans }]}>
            {gpsLoading ? 'Locating…' : 'Use My Current Location'}
          </Text>
        </TouchableOpacity>

        {Boolean(addressText && addressText.trim().length >= 3) && (
          <TouchableOpacity
            onPress={() => runGeocodeQuery(addressText)}
            disabled={geocodeLoading}
            activeOpacity={0.85}
            style={[
              styles.secondaryBtn,
              {
                backgroundColor: isDarkMode ? '#1C2422' : '#FFFFFF',
                borderColor: isDarkMode ? '#303236' : '#CBD5E1',
                opacity: geocodeLoading ? 0.7 : 1,
              },
            ]}
          >
            {geocodeLoading ? (
              <ActivityIndicator size="small" color="#EA580C" />
            ) : (
              <BootstrapIcon name="pin-map" size={13} color={textPrimary} />
            )}
            <Text style={{ fontSize: 12, fontWeight: '600', color: textPrimary, fontFamily: fontFamily.sans }}>
              {geocodeLoading ? 'Searching…' : 'Locate Typed Address'}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={handleRecenterOnHub}
          activeOpacity={0.85}
          style={[
            styles.secondaryBtn,
            {
              backgroundColor: isDarkMode ? '#18181B' : '#F8FAFC',
              borderColor: isDarkMode ? '#303236' : '#CBD5E1',
            },
          ]}
        >
          <BootstrapIcon name="shop" size={12.5} color={textMuted} />
          <Text style={{ fontSize: 11.5, fontWeight: '600', color: textMuted, fontFamily: fontFamily.sans }}>
            Center Hub
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setIsExpanded((prev) => !prev)}
          activeOpacity={0.85}
          style={[
            styles.secondaryBtn,
            {
              backgroundColor: isDarkMode ? '#18181B' : '#F8FAFC',
              borderColor: isDarkMode ? '#303236' : '#CBD5E1',
              marginLeft: 'auto',
            },
          ]}
        >
          <BootstrapIcon
            name={isExpanded ? 'arrows-angle-contract' : 'arrows-angle-expand'}
            size={12}
            color={textMuted}
          />
          <Text style={{ fontSize: 11.5, fontWeight: '600', color: textMuted, fontFamily: fontFamily.sans }}>
            {isExpanded ? 'Compact' : 'Expand Map'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Coordinate Status Pill */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: parsedPin
            ? isDarkMode
              ? 'rgba(22, 163, 74, 0.14)'
              : '#F0FDF4'
            : isDarkMode
              ? 'rgba(245, 158, 11, 0.14)'
              : '#FFFBEB',
          borderWidth: 1,
          borderColor: parsedPin
            ? isDarkMode
              ? 'rgba(34, 197, 94, 0.35)'
              : '#BBF7D0'
            : isDarkMode
              ? 'rgba(245, 158, 11, 0.35)'
              : '#FDE68A',
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingVertical: 7,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
          <BootstrapIcon
            name={parsedPin ? 'check-circle-fill' : 'geo-alt-fill'}
            size={13}
            color={parsedPin ? '#16A34A' : '#D97706'}
          />
          <Text
            style={{
              fontSize: 11.5,
              fontWeight: '600',
              fontFamily: fontFamily.sans,
              fontVariant: ['tabular-nums'],
              color: parsedPin ? (isDarkMode ? '#86EFAC' : '#166534') : isDarkMode ? '#FCD34D' : '#92400E',
              flex: 1,
            }}
          >
            {parsedPin
              ? `Exact pin set (${parsedPin.lat.toFixed(5)}, ${parsedPin.lng.toFixed(5)}) — drag pin to adjust`
              : 'Pin required — click on the map, search your street, or use current location'}
          </Text>
        </View>
      </View>

      {/* Error or Status Notice */}
      {(localError || errorText) ? (
        <View
          style={{
            backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.14)' : '#FEF2F2',
            borderWidth: 1,
            borderColor: '#FCA5A5',
            borderRadius: 10,
            paddingHorizontal: 10,
            paddingVertical: 7,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <BootstrapIcon name="exclamation-triangle-fill" size={13} color="#DC2626" />
          <Text
            style={{
              fontSize: 11.5,
              fontWeight: '600',
              fontFamily: fontFamily.sans,
              color: isDarkMode ? '#FCA5A5' : '#B91C1C',
              flex: 1,
            }}
          >
            {localError || errorText}
          </Text>
        </View>
      ) : statusNotice ? (
        <Text style={{ fontSize: 11, fontWeight: '500', fontFamily: fontFamily.sans, color: textMuted }}>
          {statusNotice}
        </Text>
      ) : null}

      {/* Interactive Leaflet Map Canvas */}
      <View
        style={[
          styles.mapWrap,
          {
            height: mapHeight,
            backgroundColor: surfaceBg,
            borderColor: parsedPin
              ? isDarkMode
                ? 'rgba(34, 197, 94, 0.45)'
                : '#86EFAC'
              : borderCol,
          },
        ]}
      >
        {mapLoading ? (
          <View
            style={[
              styles.loadingOverlay,
              { backgroundColor: isDarkMode ? '#14181D' : '#F8FAFC' },
            ]}
          >
            <ActivityIndicator color="#EA580C" />
            <Text style={[styles.loadingLabel, { color: textMuted, fontFamily: fontFamily.sans }]}>
              Loading interactive map…
            </Text>
          </View>
        ) : null}

        <iframe
          ref={iframeRef}
          title={`web-location-picker-${pickerIdRef.current}`}
          srcDoc={html}
          onLoad={() => {
            mapReady.current = true;
            setMapLoading(false);
            if (parsedPin) {
              setTimeout(() => {
                postToMap({ type: 'set-pin', lat: parsedPin.lat, lng: parsedPin.lng, zoom: PIN_ZOOM });
              }, 160);
            }
          }}
          style={{
            border: 'none',
            width: '100%',
            height: '100%',
            opacity: mapLoading ? 0 : 1,
          }}
          sandbox="allow-scripts allow-same-origin"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    minHeight: 36,
  },
  searchInput: {
    flex: 1,
    fontSize: 12.5,
    paddingVertical: 6,
    outlineStyle: 'none',
  },
  searchBtn: {
    paddingHorizontal: 12,
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EA580C',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    cursor: 'pointer',
  },
  gpsBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    cursor: 'pointer',
  },
  mapWrap: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1.5,
    position: 'relative',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    gap: 8,
  },
  loadingLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
});
