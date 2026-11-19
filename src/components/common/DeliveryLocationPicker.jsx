/**
 * Cross-platform Leaflet + OpenStreetMap delivery location picker.
 * Renders via <iframe> on Web and <WebView> on iOS/Android, reusing the same
 * approach as LiveDeliveryMap.jsx with postMessage coordinate sync.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StyleSheet,
} from 'react-native';
import { WebView } from 'react-native-webview';
import BootstrapIcon from './BootstrapIcon.jsx';
import { geocodeAddress, parseLatLng, STORE_LOCATION } from '../../utils/geo.js';

const DEFAULT_ZOOM_UNSET = 14;
const PIN_ZOOM = 18;

function buildPickerHtml({ initialLat, initialLng, hasInitialPin, pickerId }) {
  const centerLat = hasInitialPin ? initialLat : STORE_LOCATION.lat;
  const centerLng = hasInitialPin ? initialLng : STORE_LOCATION.lng;
  const startZoom = hasInitialPin ? PIN_ZOOM : DEFAULT_ZOOM_UNSET;
  const safePickerId = String(pickerId || 'delivery-picker').replace(/[^a-zA-Z0-9_-]/g, '');

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
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
    .leaflet-control-zoom {
      border: 1px solid #CBD5E1 !important;
      border-radius: 8px !important;
      overflow: hidden !important;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.12) !important;
    }
    .leaflet-control-zoom a {
      background-color: #FFFFFF !important;
      color: #0F172A !important;
      width: 32px !important;
      height: 32px !important;
      line-height: 32px !important;
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
      background: rgba(15, 23, 42, 0.84);
      color: #FFFFFF;
      font-size: 11px;
      font-weight: 600;
      padding: 5px 11px;
      border-radius: 999px;
      white-space: nowrap;
      pointer-events: none;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="hint-pill" class="hint-pill">Drag the orange pin or tap the map on your house</div>
  <script>
    (function () {
      var PICKER_ID = '${safePickerId}';
      var map = L.map('map', {
        zoomControl: true,
        attributionControl: false,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        touchZoom: true,
        dragging: true
      }).setView([${centerLat}, ${centerLng}], ${startZoom});

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
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
          pickerId: PICKER_ID,
          lat: Number(lat.toFixed(6)),
          lng: Number(lng.toFixed(6)),
          source: source || 'drag'
        });
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(payload);
        }
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(payload, '*');
        }
      }

      function ensureMarker(lat, lng, zoomLevel) {
        if (!isFinite(lat) || !isFinite(lng)) return;
        if (!marker) {
          marker = L.marker([lat, lng], { icon: houseIcon, draggable: true }).addTo(map);
          marker.on('dragend', function (ev) {
            var pos = ev.target.getLatLng();
            emitPin(pos.lat, pos.lng, 'drag');
          });
        } else {
          marker.setLatLng([lat, lng]);
        }
        var targetZoom = typeof zoomLevel === 'number' ? zoomLevel : Math.max(map.getZoom() || 0, ${PIN_ZOOM});
        map.setView([lat, lng], targetZoom, { animate: true });
      }

      if (${hasInitialPin ? 'true' : 'false'}) {
        ensureMarker(${centerLat}, ${centerLng}, ${PIN_ZOOM});
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
          if (!msg || msg.type !== 'set-pin') return;
          if (isFinite(Number(msg.lat)) && isFinite(Number(msg.lng))) {
            ensureMarker(Number(msg.lat), Number(msg.lng), Number(msg.zoom) || ${PIN_ZOOM});
          }
        } catch (e) {}
      }

      window.addEventListener('message', handleIncoming);
      document.addEventListener('message', handleIncoming);

      setTimeout(function () {
        map.invalidateSize();
      }, 250);
    })();
  </script>
</body>
</html>`;
}

export default function DeliveryLocationPicker({
  latitude,
  longitude,
  addressText = '',
  onLocationChange,
  isDarkMode = false,
  height = 240,
  errorText = '',
}) {
  const webRef = useRef(null);
  const iframeRef = useRef(null);
  const mapReady = useRef(false);
  const lastEmittedRef = useRef(null);
  const pickerIdRef = useRef(`picker_${Math.random().toString(36).slice(2, 10)}`);

  const [mapLoading, setMapLoading] = useState(true);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [statusNotice, setStatusNotice] = useState('');

  const parsedPin = useMemo(() => parseLatLng(latitude, longitude), [latitude, longitude]);

  // Capture initial coordinate once so dragging does not reload HTML / snap the WebView
  const initialPinRef = useRef(parsedPin);
  const html = useMemo(
    () =>
      buildPickerHtml({
        initialLat: initialPinRef.current?.lat ?? STORE_LOCATION.lat,
        initialLng: initialPinRef.current?.lng ?? STORE_LOCATION.lng,
        hasInitialPin: Boolean(initialPinRef.current),
        pickerId: pickerIdRef.current,
      }),
    []
  );

  const postToMap = useCallback((payload) => {
    const msg = JSON.stringify(payload);
    if (Platform.OS === 'web') {
      const win = iframeRef.current?.contentWindow;
      if (win) win.postMessage(msg, '*');
      return;
    }
    if (webRef.current) {
      webRef.current.injectJavaScript(
        `try{window.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(msg)}}));}catch(e){};true;`
      );
    }
  }, []);

  // Push external coordinate updates (GPS, Locate Address, or reopened modal) into the map
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

  const handleMapPayload = useCallback(
    (rawData) => {
      try {
        const msg = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
        if (!msg || msg.type !== 'moto-location-picker') return;
        if (Platform.OS === 'web' && msg.pickerId !== pickerIdRef.current) return;
        const coords = parseLatLng(msg.lat, msg.lng);
        if (!coords) return;

        lastEmittedRef.current = coords;
        setLocalError('');
        setStatusNotice(
          msg.source === 'drag'
            ? 'Pin moved to your exact house spot.'
            : 'Pin dropped. Drag to fine-tune if needed.'
        );
        onLocationChange?.({ lat: coords.lat, lng: coords.lng, source: msg.source || 'drag' });
      } catch (_e) {}
    },
    [onLocationChange]
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
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
    setGpsLoading(true);

    try {
      if (Platform.OS === 'web') {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          setLocalError(
            'Browser geolocation is not supported on this device. Drag the pin on the map instead.'
          );
          setGpsLoading(false);
          return;
        }
        await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const coords = parseLatLng(pos?.coords?.latitude, pos?.coords?.longitude);
              if (!coords) {
                setLocalError('Could not read a valid GPS coordinate. Please drag the pin manually.');
                resolve();
                return;
              }
              lastEmittedRef.current = null;
              postToMap({ type: 'set-pin', lat: coords.lat, lng: coords.lng, zoom: PIN_ZOOM });
              setStatusNotice('GPS location detected. Drag the pin to refine your exact gate/house.');
              onLocationChange?.({ lat: coords.lat, lng: coords.lng, source: 'gps' });
              resolve();
            },
            (err) => {
              if (err?.code === 1) {
                setLocalError(
                  'Location permission was denied. Allow location access in your browser or drag the pin onto your house.'
                );
              } else if (err?.code === 2) {
                setLocalError(
                  'Current location is unavailable right now. Please tap or drag the pin on the map.'
                );
              } else {
                setLocalError(
                  'Location request timed out. Please try again or drag the pin onto your house.'
                );
              }
              resolve();
            },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
          );
        });
        setGpsLoading(false);
        return;
      }

      // iOS / Android via expo-location
      const Location = await import('expo-location');
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm?.status !== 'granted') {
        setLocalError(
          'Location permission was denied. Enable location access in Settings or drag the pin on the map.'
        );
        setGpsLoading(false);
        return;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setLocalError('GPS / Location Services are turned off. Please turn them on or drag the pin.');
        setGpsLoading(false);
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const coords = parseLatLng(current?.coords?.latitude, current?.coords?.longitude);
      if (!coords) {
        setLocalError('Unable to determine GPS coordinates. Please drop the pin on the map.');
        setGpsLoading(false);
        return;
      }

      lastEmittedRef.current = null;
      postToMap({ type: 'set-pin', lat: coords.lat, lng: coords.lng, zoom: PIN_ZOOM });
      setStatusNotice('GPS location detected. Drag the pin to refine your exact gate/house.');
      onLocationChange?.({ lat: coords.lat, lng: coords.lng, source: 'gps' });
    } catch (e) {
      setLocalError(
        e?.message || 'Unable to get your current location. Please drag the pin on the map.'
      );
    } finally {
      setGpsLoading(false);
    }
  };

  const handleGeocodeStartingPin = async () => {
    const query = String(addressText || '').trim();
    if (!query || query.length < 3) {
      setLocalError('Type a barangay, street, or city in the address field first.');
      return;
    }
    setLocalError('');
    setStatusNotice('');
    setGeocodeLoading(true);
    try {
      const geo = await geocodeAddress(query);
      if (!geo) {
        setLocalError(
          'Could not locate that text on OpenStreetMap. Use "Use my current location" or tap the map directly.'
        );
        return;
      }
      lastEmittedRef.current = null;
      postToMap({ type: 'set-pin', lat: geo.lat, lng: geo.lng, zoom: PIN_ZOOM });
      setStatusNotice('Approximate area found. Drag the orange pin directly onto your house.');
      onLocationChange?.({ lat: geo.lat, lng: geo.lng, source: 'geocode' });
    } catch (_e) {
      setLocalError('Could not search that address right now. Please tap or drag on the map.');
    } finally {
      setGeocodeLoading(false);
    }
  };

  const surfaceBg = isDarkMode ? '#14181D' : '#F8FAFC';
  const borderCol = errorText || localError ? '#EF4444' : isDarkMode ? 'rgba(255,255,255,0.12)' : '#CBD5E1';
  const textPrimary = isDarkMode ? '#F8FAFC' : '#0F172A';
  const textMuted = isDarkMode ? '#94A3B8' : '#475569';

  return (
    <View className="gap-2" style={{ gap: 8 }}>
      {/* Action Buttons Row */}
      <View className="flex-row flex-wrap gap-2" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <TouchableOpacity
          onPress={handleUseCurrentLocation}
          disabled={gpsLoading || geocodeLoading}
          activeOpacity={0.85}
          className="flex-row items-center rounded-xl px-3 py-2"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: '#EA580C',
            paddingHorizontal: 12,
            paddingVertical: 9,
            borderRadius: 10,
            opacity: gpsLoading ? 0.75 : 1,
          }}
        >
          {gpsLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <BootstrapIcon name="crosshair" size={14} color="#FFFFFF" />
          )}
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>
            {gpsLoading ? 'Getting GPS…' : 'Use my current location'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleGeocodeStartingPin}
          disabled={gpsLoading || geocodeLoading}
          activeOpacity={0.8}
          className="flex-row items-center rounded-xl px-3 py-2"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: isDarkMode ? '#1C2422' : '#FFFFFF',
            borderWidth: 1,
            borderColor: isDarkMode ? 'rgba(255,255,255,0.14)' : '#CBD5E1',
            paddingHorizontal: 12,
            paddingVertical: 9,
            borderRadius: 10,
            opacity: geocodeLoading ? 0.7 : 1,
          }}
        >
          {geocodeLoading ? (
            <ActivityIndicator size="small" color="#EA580C" />
          ) : (
            <BootstrapIcon name="search" size={13} color={textPrimary} />
          )}
          <Text style={{ fontSize: 12, fontWeight: '700', color: textPrimary }}>
            {geocodeLoading ? 'Searching…' : 'Locate typed address'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Coordinate Status Pill */}
      <View
        className="flex-row items-center justify-between rounded-xl px-3 py-2"
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
              fontWeight: '700',
              color: parsedPin ? (isDarkMode ? '#86EFAC' : '#166534') : isDarkMode ? '#FCD34D' : '#92400E',
              flex: 1,
            }}
          >
            {parsedPin
              ? `Exact pin set (${parsedPin.lat.toFixed(5)}, ${parsedPin.lng.toFixed(5)})`
              : 'Pin required — tap "Use my current location" or tap the map on your house'}
          </Text>
        </View>
      </View>

      {/* Inline Feedback or Error Banner */}
      {(localError || errorText) ? (
        <View
          style={{
            backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.14)' : '#FEF2F2',
            borderWidth: 1,
            borderColor: '#FCA5A5',
            borderRadius: 10,
            paddingHorizontal: 10,
            paddingVertical: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <BootstrapIcon name="exclamation-triangle-fill" size={13} color="#DC2626" />
          <Text style={{ fontSize: 11.5, fontWeight: '600', color: isDarkMode ? '#FCA5A5' : '#B91C1C', flex: 1 }}>
            {localError || errorText}
          </Text>
        </View>
      ) : statusNotice ? (
        <Text style={{ fontSize: 11, fontWeight: '600', color: textMuted }}>{statusNotice}</Text>
      ) : null}

      {/* Leaflet Map Canvas */}
      <View
        style={[
          styles.mapWrap,
          {
            height,
            backgroundColor: surfaceBg,
            borderColor: borderCol,
          },
        ]}
      >
        {mapLoading ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color="#EA580C" />
            <Text style={styles.loadingLabel}>Loading OpenStreetMap…</Text>
          </View>
        ) : null}

        {Platform.OS === 'web' ? (
          <iframe
            ref={iframeRef}
            title={`delivery-location-picker-${pickerIdRef.current}`}
            srcDoc={html}
            onLoad={() => {
              mapReady.current = true;
              setMapLoading(false);
              if (parsedPin) {
                setTimeout(() => {
                  postToMap({ type: 'set-pin', lat: parsedPin.lat, lng: parsedPin.lng, zoom: PIN_ZOOM });
                }, 150);
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
        ) : (
          <WebView
            ref={webRef}
            originWhitelist={['*']}
            source={{ html, baseUrl: 'https://unpkg.com' }}
            onLoadEnd={() => {
              mapReady.current = true;
              setMapLoading(false);
              if (parsedPin) {
                setTimeout(() => {
                  postToMap({ type: 'set-pin', lat: parsedPin.lat, lng: parsedPin.lng, zoom: PIN_ZOOM });
                }, 200);
              }
            }}
            onMessage={(ev) => handleMapPayload(ev?.nativeEvent?.data)}
            style={[styles.webview, mapLoading && { opacity: 0 }]}
            javaScriptEnabled
            domStorageEnabled
            mixedContentMode="compatibility"
            nestedScrollEnabled
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrap: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    gap: 8,
    backgroundColor: '#F8FAFC',
  },
  loadingLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
});
