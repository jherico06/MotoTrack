import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { WebView } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar';
import { BootstrapIcon } from '../../common/BootstrapIcon.jsx';
import ExternalLink from '../../common/ExternalLink.jsx';
import { riderGpsTrackingService } from '../../../services/delivery/riderGpsTrackingService.js';
import { ANDROID_BOTTOM_INSET, ANDROID_TOP_INSET } from '../../../utils/safeArea.js';
import {
  geocodeAddress,
  googleMapsNavigateUrl,
  parseLatLng,
  STORE_LOCATION,
} from '../../../utils/geo.js';
import {
  cardShadowStyle,
  formatOrderCode,
  formatPhpExact,
  getInitials,
  getOrderStatusBadge,
  isCodOrder,
  isDeliveredOrder,
  isNeedsPickupOrder,
  riderFont,
} from './riderTheme.js';

function haversineMeters(a, b) {
  if (!a || !b) return 0;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function formatDistanceLabel(meters) {
  const m = Number(meters) || 0;
  if (m <= 0) return 'Near drop-off';
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function formatDurationLabel(seconds) {
  const mins = Math.max(1, Math.round((Number(seconds) || 0) / 60));
  if (mins < 60) return `~${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `~${hrs}h ${rem}m` : `~${hrs}h`;
}

function formatEtaClock(seconds) {
  const eta = new Date(Date.now() + Math.max(60, Number(seconds) || 0) * 1000);
  return eta.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function escapeHtmlJs(str) {
  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, ' ');
}

function buildRiderRouteHtml({ store, rider, customer, riderLabel, customerLabel }) {
  const cLat = customer?.lat ?? store.lat;
  const cLng = customer?.lng ?? store.lng;
  const rLat = rider?.lat ?? store.lat;
  const rLng = rider?.lng ?? store.lng;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #E8EEF2; }
    .leaflet-control-attribution { font-size: 9px !important; }
    .rider-pin-wrap {
      position: relative; width: 38px; height: 38px;
      display: flex; align-items: center; justify-content: center;
    }
    .rider-pin-halo {
      position: absolute; inset: 0; border-radius: 50%;
      background: rgba(5, 150, 105, 0.22);
      animation: riderPulse 1.8s ease-out infinite;
    }
    .rider-pin-core {
      position: relative; width: 32px; height: 32px; border-radius: 50%;
      background: #0F172A; color: #FFFFFF;
      border: 2.5px solid #FFFFFF;
      box-shadow: 0 3px 10px rgba(15, 23, 42, 0.42);
      display: flex; align-items: center; justify-content: center;
      font-size: 16px;
    }
    .customer-pin-wrap {
      position: relative; width: 38px; height: 42px;
      display: flex; align-items: flex-end; justify-content: center;
    }
    .customer-ring {
      position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);
      width: 24px; height: 10px; border-radius: 50%;
      border: 2.5px solid #059669;
      background: rgba(5, 150, 105, 0.18);
    }
    .customer-drop {
      position: relative; margin-bottom: 4px;
      width: 28px; height: 28px; border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      background: #DC2626;
      border: 2.5px solid #FFFFFF;
      box-shadow: 0 3px 10px rgba(220, 38, 38, 0.45);
      display: flex; align-items: center; justify-content: center;
    }
    .customer-drop-dot {
      width: 9px; height: 9px; border-radius: 50%; background: #FFFFFF;
    }
    @keyframes riderPulse {
      0% { transform: scale(0.82); opacity: 0.9; }
      100% { transform: scale(1.45); opacity: 0; }
    }
    .leaflet-control-zoom {
      border: 1px solid #CBD5E1 !important;
      border-radius: 10px !important;
      overflow: hidden !important;
      box-shadow: 0 2px 10px rgba(15, 23, 42, 0.14) !important;
      margin-top: 12px !important;
      margin-left: 12px !important;
    }
    .leaflet-control-zoom a {
      background-color: #FFFFFF !important;
      color: #0F172A !important;
      width: 34px !important;
      height: 34px !important;
      line-height: 34px !important;
      font-size: 16px !important;
      font-weight: 700 !important;
      border-bottom: 1px solid #E2E8F0 !important;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      touchZoom: true,
      dragging: true
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    var riderIcon = L.divIcon({
      className: '',
      html: '<div class="rider-pin-wrap"><div class="rider-pin-halo"></div><div class="rider-pin-core">🛵</div></div>',
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });

    var customerIcon = L.divIcon({
      className: '',
      html: '<div class="customer-pin-wrap"><div class="customer-ring"></div><div class="customer-drop"><div class="customer-drop-dot"></div></div></div>',
      iconSize: [38, 42],
      iconAnchor: [19, 38]
    });

    var riderMarker = null;
    var customerMarker = null;
    var routeOuter = null;
    var routeInner = null;
    var hasFitted = false;
    var followRider = false;

    map.on('zoomstart', function () { hasFitted = true; });
    map.on('dragstart', function () { hasFitted = true; });

    function setCustomer(lat, lng, label) {
      if (!isFinite(lat) || !isFinite(lng)) return;
      if (!customerMarker) {
        customerMarker = L.marker([lat, lng], { icon: customerIcon }).addTo(map);
      } else {
        customerMarker.setLatLng([lat, lng]);
      }
      if (label) customerMarker.bindPopup(label);
      fitIfNeeded();
    }

    function setRider(lat, lng, label, smooth) {
      if (!isFinite(lat) || !isFinite(lng)) return;
      if (!riderMarker) {
        riderMarker = L.marker([lat, lng], { icon: riderIcon }).addTo(map);
      } else if (smooth) {
        var from = riderMarker.getLatLng();
        var to = L.latLng(lat, lng);
        var steps = 10, i = 0;
        clearInterval(window.__riderAnim);
        window.__riderAnim = setInterval(function () {
          i++;
          var t = i / steps;
          riderMarker.setLatLng([
            from.lat + (to.lat - from.lat) * t,
            from.lng + (to.lng - from.lng) * t
          ]);
          if (i >= steps) clearInterval(window.__riderAnim);
        }, 40);
      } else {
        riderMarker.setLatLng([lat, lng]);
      }
      if (label) riderMarker.bindPopup(label);
      if (followRider) {
        map.panTo([lat, lng], { animate: true, duration: 0.4 });
      } else {
        fitIfNeeded();
      }
    }

    function setRoute(coords, isFallback) {
      if (!Array.isArray(coords) || coords.length < 2) {
        if (routeOuter) { map.removeLayer(routeOuter); routeOuter = null; }
        if (routeInner) { map.removeLayer(routeInner); routeInner = null; }
        return;
      }
      var latLngs = coords
        .map(function (p) { return [Number(p.lat), Number(p.lng)]; })
        .filter(function (p) { return isFinite(p[0]) && isFinite(p[1]); });
      if (latLngs.length < 2) return;

      if (routeOuter) map.removeLayer(routeOuter);
      if (routeInner) map.removeLayer(routeInner);

      routeOuter = L.polyline(latLngs, {
        color: '#FFFFFF',
        weight: 8,
        opacity: 0.85,
        lineJoin: 'round',
        lineCap: 'round'
      }).addTo(map);

      routeInner = L.polyline(latLngs, {
        color: '#059669',
        weight: 5,
        opacity: 0.96,
        dashArray: isFallback ? '7, 8' : null,
        lineJoin: 'round',
        lineCap: 'round'
      }).addTo(map);

      hasFitted = false;
      fitIfNeeded();
    }

    function fitIfNeeded() {
      if (hasFitted) return;
      var pts = [];
      if (riderMarker) pts.push(riderMarker.getLatLng());
      if (customerMarker) pts.push(customerMarker.getLatLng());
      if (routeInner) {
        try {
          map.fitBounds(routeInner.getBounds().pad(0.22), { maxZoom: 16, padding: [26, 26] });
          hasFitted = true;
          return;
        } catch (e) {}
      }
      if (pts.length === 1) {
        map.setView(pts[0], 15);
      } else if (pts.length > 1) {
        map.fitBounds(L.latLngBounds(pts).pad(0.28), { maxZoom: 16 });
      }
      hasFitted = true;
    }

    function setFollow(v) {
      followRider = !!v;
      if (followRider && riderMarker) {
        map.setView(riderMarker.getLatLng(), Math.max(map.getZoom(), 15), { animate: true });
      }
    }

    setRider(${rLat}, ${rLng}, '${escapeHtmlJs(riderLabel)}', false);
    ${customer ? `setCustomer(${cLat}, ${cLng}, '${escapeHtmlJs(customerLabel)}');` : `map.setView([${rLat}, ${rLng}], 14);`}

    function handleMsg(ev) {
      try {
        var data = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
        if (!data || !data.type) return;
        if (data.type === 'rider') setRider(data.lat, data.lng, data.label, data.smooth !== false);
        if (data.type === 'customer') setCustomer(data.lat, data.lng, data.label);
        if (data.type === 'route') setRoute(data.coords || [], Boolean(data.isFallback));
        if (data.type === 'follow') setFollow(data.value);
        if (data.type === 'fit') { hasFitted = false; fitIfNeeded(); }
      } catch (e) {}
    }

    window.addEventListener('message', handleMsg);
    document.addEventListener('message', handleMsg);
  </script>
</body>
</html>`;
}

/**
 * Full-screen Rider route tracking view showing live rider GPS position,
 * road route polyline to the customer drop-off location, distance/ETA, and
 * rider operational actions (Call, Google Maps, Start Delivery / Scan QR).
 */
export default function RiderCustomerTrackModal({
  visible,
  delivery,
  palette,
  riderName = 'Rider',
  busyId,
  onClose,
  onStartRoute,
  onScanConfirm,
}) {
  const webRef = useRef(null);
  const iframeRef = useRef(null);
  const mapReadyRef = useRef(false);
  const lastRoutedOriginRef = useRef(null);
  const watchSubRef = useRef(null);

  const [mapLoading, setMapLoading] = useState(true);
  const [followRider, setFollowRider] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('locating'); // 'locating' | 'live' | 'denied' | 'unavailable'
  const [riderCoords, setRiderCoords] = useState(null);
  const [geocodedDest, setGeocodedDest] = useState(null);
  const [geocodingDest, setGeocodingDest] = useState(false);
  const [routeState, setRouteState] = useState({
    path: null,
    distanceMeters: 0,
    durationSeconds: 0,
    isFallback: false,
  });

  const isOpen = Boolean(visible);
  const storedDest = useMemo(
    () => parseLatLng(delivery?.lat, delivery?.lng),
    [delivery?.lat, delivery?.lng]
  );
  const customerCoords = useMemo(
    () => storedDest || geocodedDest,
    [storedDest, geocodedDest]
  );
  const effectiveOrigin = useMemo(
    () => riderCoords || STORE_LOCATION,
    [riderCoords]
  );

  const postToMap = useCallback((payload) => {
    const msg = JSON.stringify(payload);
    if (Platform.OS === 'web') {
      const win = iframeRef.current?.contentWindow;
      if (win) win.postMessage(msg, '*');
      return;
    }
    if (webRef.current) {
      webRef.current.postMessage(msg);
      webRef.current.injectJavaScript(
        `try{window.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(
          msg
        )}}));}catch(e){};true;`
      );
    }
  }, []);

  // Resolve customer pin when order lacks stored lat/lng
  useEffect(() => {
    if (!visible || !delivery) return undefined;
    if (storedDest) {
      setGeocodedDest(null);
      setGeocodingDest(false);
      return undefined;
    }
    const addr = String(delivery?.customerAddress || '').trim();
    if (!addr) {
      setGeocodedDest(null);
      setGeocodingDest(false);
      return undefined;
    }
    let alive = true;
    setGeocodingDest(true);
    geocodeAddress(addr)
      .then((res) => {
        if (alive) setGeocodedDest(res || null);
      })
      .finally(() => {
        if (alive) setGeocodingDest(false);
      });
    return () => {
      alive = false;
    };
  }, [visible, delivery, storedDest]);

  const requestDeviceGps = useCallback(async () => {
    if (!visible) return;
    setGpsStatus((prev) => (riderCoords ? prev : 'locating'));
    try {
      const { status: existing } =
        await Location.getForegroundPermissionsAsync();
      let granted = existing === 'granted';
      if (!granted) {
        const req = await Location.requestForegroundPermissionsAsync();
        granted = req.status === 'granted';
      }
      if (!granted) {
        setGpsStatus('denied');
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const parsed = parseLatLng(
        current?.coords?.latitude,
        current?.coords?.longitude
      );
      if (parsed) {
        setRiderCoords(parsed);
        setGpsStatus('live');
      }
    } catch (_e) {
      setGpsStatus((prev) => (prev === 'live' ? prev : 'unavailable'));
    }
  }, [visible, riderCoords]);

  // Live GPS watcher while tracking screen is open
  useEffect(() => {
    if (!visible) {
      mapReadyRef.current = false;
      setFollowRider(false);
      lastRoutedOriginRef.current = null;
      return undefined;
    }

    let alive = true;
    setMapLoading(true);

    const unsubGps = riderGpsTrackingService.subscribe((event, payload) => {
      if (!alive) return;
      if ((event === 'started' || event === 'location') && payload?.coords) {
        const parsed = parseLatLng(
          payload.coords.latitude,
          payload.coords.longitude
        );
        if (parsed) {
          setRiderCoords(parsed);
          setGpsStatus('live');
        }
      }
    });

    (async () => {
      try {
        const { status: existing } =
          await Location.getForegroundPermissionsAsync();
        let granted = existing === 'granted';
        if (!granted) {
          const req = await Location.requestForegroundPermissionsAsync();
          granted = req.status === 'granted';
        }
        if (!alive) return;
        if (!granted) {
          setGpsStatus('denied');
          return;
        }

        const initial = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!alive) return;
        const parsedInit = parseLatLng(
          initial?.coords?.latitude,
          initial?.coords?.longitude
        );
        if (parsedInit) {
          setRiderCoords(parsedInit);
          setGpsStatus('live');
        }

        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 5000,
            distanceInterval: 10,
          },
          (pos) => {
            if (!alive) return;
            const next = parseLatLng(
              pos?.coords?.latitude,
              pos?.coords?.longitude
            );
            if (next) {
              setRiderCoords(next);
              setGpsStatus('live');
            }
          }
        );
        if (alive) {
          watchSubRef.current = sub;
        } else {
          sub.remove();
        }
      } catch (_e) {
        if (alive) {
          setGpsStatus((prev) => (prev === 'live' ? prev : 'unavailable'));
        }
      }
    })();

    return () => {
      alive = false;
      unsubGps();
      if (watchSubRef.current) {
        try {
          watchSubRef.current.remove();
        } catch (_e) {}
        watchSubRef.current = null;
      }
    };
  }, [visible, delivery?.orderId]);

  // Fetch live OSRM road route from current rider position -> customer destination
  useEffect(() => {
    if (!visible || !customerCoords || !effectiveOrigin) {
      setRouteState({
        path: null,
        distanceMeters: 0,
        durationSeconds: 0,
        isFallback: false,
      });
      return undefined;
    }

    const lastOrigin = lastRoutedOriginRef.current;
    if (
      lastOrigin &&
      lastOrigin.destLat === customerCoords.lat &&
      lastOrigin.destLng === customerCoords.lng &&
      haversineMeters(lastOrigin, effectiveOrigin) < 40
    ) {
      return undefined;
    }

    lastRoutedOriginRef.current = {
      lat: effectiveOrigin.lat,
      lng: effectiveOrigin.lng,
      destLat: customerCoords.lat,
      destLng: customerCoords.lng,
    };

    const controller =
      typeof AbortController !== 'undefined' ? new AbortController() : null;
    let alive = true;

    const fallbackDist = haversineMeters(effectiveOrigin, customerCoords);
    const fallbackDuration = Math.max(120, Math.round((fallbackDist / 1000 / 28) * 3600));

    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${effectiveOrigin.lng},${effectiveOrigin.lat};${customerCoords.lng},${customerCoords.lat}` +
      `?overview=full&geometries=geojson&steps=false`;

    fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      ...(controller ? { signal: controller.signal } : {}),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!alive) return;
        const route = data?.routes?.[0];
        const coords = route?.geometry?.coordinates;
        if (data?.code === 'Ok' && Array.isArray(coords) && coords.length >= 2) {
          const path = coords
            .map(([lng, lat]) => ({ lat: Number(lat), lng: Number(lng) }))
            .filter((p) => parseLatLng(p.lat, p.lng));
          setRouteState({
            path,
            distanceMeters: Number(route.distance) || fallbackDist,
            durationSeconds: Number(route.duration) || fallbackDuration,
            isFallback: false,
          });
          return;
        }
        setRouteState({
          path: [effectiveOrigin, customerCoords],
          distanceMeters: fallbackDist,
          durationSeconds: fallbackDuration,
          isFallback: true,
        });
      })
      .catch((err) => {
        if (!alive || err?.name === 'AbortError') return;
        setRouteState({
          path: [effectiveOrigin, customerCoords],
          distanceMeters: fallbackDist,
          durationSeconds: fallbackDuration,
          isFallback: true,
        });
      });

    return () => {
      alive = false;
      try {
        controller?.abort();
      } catch (_e) {}
    };
  }, [visible, effectiveOrigin, customerCoords]);

  // Initial static map HTML (incremental updates go via postToMap)
  const mapHtml = useMemo(
    () =>
      buildRiderRouteHtml({
        store: STORE_LOCATION,
        rider: riderCoords || STORE_LOCATION,
        customer: customerCoords,
        riderLabel: riderName,
        customerLabel: delivery?.customerAddress || delivery?.customerName || 'Customer Drop-off',
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [delivery?.orderId, isOpen]
  );

  // Push live coordinate/route changes to Leaflet
  useEffect(() => {
    if (!mapReadyRef.current) return;
    postToMap({
      type: 'rider',
      lat: effectiveOrigin.lat,
      lng: effectiveOrigin.lng,
      label: gpsStatus === 'live' ? `${riderName} (You)` : `${STORE_LOCATION.name}`,
      smooth: true,
    });
  }, [effectiveOrigin, gpsStatus, riderName, postToMap]);

  useEffect(() => {
    if (!mapReadyRef.current || !customerCoords) return;
    postToMap({
      type: 'customer',
      lat: customerCoords.lat,
      lng: customerCoords.lng,
      label: delivery?.customerAddress || delivery?.customerName || 'Customer drop-off',
    });
  }, [customerCoords, delivery?.customerAddress, delivery?.customerName, postToMap]);

  useEffect(() => {
    if (!mapReadyRef.current) return;
    postToMap({
      type: 'route',
      coords: routeState.path || [],
      isFallback: routeState.isFallback,
    });
  }, [routeState.path, routeState.isFallback, postToMap]);

  useEffect(() => {
    if (!mapReadyRef.current) return;
    postToMap({ type: 'follow', value: followRider });
  }, [followRider, postToMap]);

  const handleMapLoad = () => {
    mapReadyRef.current = true;
    setMapLoading(false);
    setTimeout(() => {
      postToMap({
        type: 'rider',
        lat: effectiveOrigin.lat,
        lng: effectiveOrigin.lng,
        label: gpsStatus === 'live' ? `${riderName} (You)` : STORE_LOCATION.name,
        smooth: false,
      });
      if (customerCoords) {
        postToMap({
          type: 'customer',
          lat: customerCoords.lat,
          lng: customerCoords.lng,
          label: delivery?.customerAddress || delivery?.customerName || 'Customer drop-off',
        });
      }
      if (routeState.path?.length >= 2) {
        postToMap({
          type: 'route',
          coords: routeState.path,
          isFallback: routeState.isFallback,
        });
      }
      postToMap({ type: 'fit' });
    }, 180);
  };

  if (!delivery) return null;

  const badge = getOrderStatusBadge(delivery, palette);
  const delivered = isDeliveredOrder(delivery);
  const needsPickup = isNeedsPickupOrder(delivery);
  const statusStr = String(delivery?.deliveryStatus || '').toLowerCase();
  const isOutForDelivery = !needsPickup && statusStr.includes('out');
  const isReported = statusStr.includes('report');
  const isBusy = busyId === delivery.orderId;
  const cod = isCodOrder(delivery);
  const cleanPhone = String(delivery?.customerPhone || '').replace(
    /[^\d+]/g,
    ''
  );

  const navUrl =
    riderCoords && customerCoords
      ? `https://www.google.com/maps/dir/?api=1&origin=${riderCoords.lat},${riderCoords.lng}&destination=${customerCoords.lat},${customerCoords.lng}&travelmode=driving`
      : googleMapsNavigateUrl(
          customerCoords?.lat,
          customerCoords?.lng,
          delivery?.customerAddress
        );

  const hasMetrics = Boolean(customerCoords && routeState.distanceMeters > 0);
  const etaClock = hasMetrics ? formatEtaClock(routeState.durationSeconds) : '—';
  const distanceSummary = hasMetrics
    ? `${formatDistanceLabel(routeState.distanceMeters)} · ${formatDurationLabel(routeState.durationSeconds)}`
    : geocodingDest
      ? 'Locating pin…'
      : 'Pin not set';

  const headerBg = palette.isDark ? '#1C1F23' : '#FFFFFF';
  const cardBg = palette.isDark ? '#1C1F23' : '#FFFFFF';
  const subtleBoxBg = palette.isDark ? '#23272B' : '#F8FAFC';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[
          styles.safeRoot,
          { backgroundColor: headerBg, paddingTop: ANDROID_TOP_INSET },
        ]}
      >
        <StatusBar
          style={palette.isDark ? 'light' : 'dark'}
          translucent
          backgroundColor="transparent"
        />

        {/* Top Track Header */}
        <View
          style={[
            styles.topBar,
            { backgroundColor: headerBg, borderBottomColor: palette.border },
          ]}
        >
          <TouchableOpacity
            onPress={onClose}
            style={[
              styles.topBackBtn,
              {
                backgroundColor: palette.isDark ? '#252A30' : '#F8FAFC',
                borderColor: palette.border,
              },
            ]}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Back to deliveries"
          >
            <BootstrapIcon
              name="chevron-left"
              size={16}
              color={palette.textPrimary}
            />
          </TouchableOpacity>

          <Text style={[styles.topTitle, { color: palette.textPrimary }]}>
            Track Customer
          </Text>

          <TouchableOpacity
            onPress={requestDeviceGps}
            activeOpacity={0.8}
            style={[
              styles.gpsPill,
              {
                backgroundColor:
                  gpsStatus === 'live'
                    ? palette.isDark
                      ? 'rgba(16, 185, 129, 0.16)'
                      : '#ECFDF5'
                    : palette.orangeSoft,
                borderColor:
                  gpsStatus === 'live'
                    ? palette.isDark
                      ? 'rgba(16, 185, 129, 0.35)'
                      : '#A7F3D0'
                    : palette.orangeBorder,
              },
            ]}
            accessibilityLabel="Refresh live GPS position"
          >
            <View
              style={[
                styles.gpsDot,
                {
                  backgroundColor: gpsStatus === 'live' ? '#059669' : '#EA580C',
                },
              ]}
            />
            <Text
              style={[
                styles.gpsPillText,
                {
                  color:
                    gpsStatus === 'live'
                      ? palette.isDark
                        ? '#6EE7B7'
                        : '#047857'
                      : palette.orangeText,
                },
              ]}
            >
              {gpsStatus === 'live'
                ? 'GPS Live'
                : gpsStatus === 'locating'
                  ? 'GPS…'
                  : 'Retry GPS'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Full-Height Interactive Map */}
        <View style={styles.mapContainer}>
          {mapLoading ? (
            <View style={styles.mapLoader}>
              <ActivityIndicator size="small" color="#059669" />
              <Text style={styles.mapLoaderText}>Loading route map…</Text>
            </View>
          ) : null}

          {!customerCoords && !geocodingDest ? (
            <View style={styles.noPinBanner}>
              <BootstrapIcon
                name="exclamation-circle"
                size={14}
                color="#92400E"
              />
              <Text style={styles.noPinText} numberOfLines={2}>
                Exact customer pin unavailable. Use Google Maps below to search the address.
              </Text>
            </View>
          ) : null}

          {Platform.OS === 'web' ? (
            <iframe
              ref={iframeRef}
              title={`rider-track-${delivery.orderId}`}
              srcDoc={mapHtml}
              onLoad={handleMapLoad}
              style={{
                border: 'none',
                width: '100%',
                height: '100%',
              }}
              sandbox="allow-scripts allow-same-origin"
            />
          ) : (
            <WebView
              ref={webRef}
              originWhitelist={['*']}
              source={{ html: mapHtml, baseUrl: 'https://unpkg.com' }}
              onLoadEnd={handleMapLoad}
              style={styles.webview}
              javaScriptEnabled
              domStorageEnabled
              mixedContentMode="compatibility"
            />
          )}

          {/* Floating Map Controls (Fit Route & Follow Me) */}
          <View style={styles.floatingMapControls}>
            <TouchableOpacity
              onPress={() => {
                setFollowRider(false);
                postToMap({ type: 'fit' });
              }}
              activeOpacity={0.82}
              style={[
                styles.mapControlBtn,
                !palette.isDark && cardShadowStyle,
                {
                  backgroundColor: cardBg,
                  borderColor: palette.border,
                },
              ]}
              accessibilityLabel="Fit full route"
            >
              <BootstrapIcon name="map" size={14} color={palette.textPrimary} />
              <Text
                style={[styles.mapControlText, { color: palette.textPrimary }]}
              >
                Fit route
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setFollowRider((v) => !v)}
              activeOpacity={0.82}
              style={[
                styles.mapControlBtn,
                !palette.isDark && cardShadowStyle,
                {
                  backgroundColor: followRider ? '#059669' : cardBg,
                  borderColor: followRider ? '#059669' : palette.border,
                },
              ]}
              accessibilityLabel="Follow my live position"
            >
              <BootstrapIcon
                name="crosshair"
                size={14}
                color={followRider ? '#FFFFFF' : palette.orange}
              />
              <Text
                style={[
                  styles.mapControlText,
                  { color: followRider ? '#FFFFFF' : palette.textPrimary },
                ]}
              >
                {followRider ? 'Following' : 'Follow me'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Floating Track Sheet Card */}
        <View
          style={[
            styles.bottomCard,
            {
              backgroundColor: cardBg,
              borderTopColor: palette.border,
              paddingBottom:
                Platform.OS === 'ios' ? 20 : Math.max(16, ANDROID_BOTTOM_INSET + 8),
            },
          ]}
        >
          {/* Order ID & Status Row */}
          <View style={styles.cardHeaderRow}>
            <View style={styles.orderTitleGroup}>
              <View
                style={[
                  styles.orderBoxBadge,
                  {
                    backgroundColor: palette.orangeSoft,
                    borderColor: palette.orangeBorder,
                  },
                ]}
              >
                <BootstrapIcon name="box-seam" size={16} color={palette.orange} />
              </View>
              <Text
                style={[styles.orderCodeTitle, { color: palette.textPrimary }]}
                numberOfLines={1}
              >
                {formatOrderCode(delivery.orderId)}
              </Text>
            </View>

            <View style={[styles.statusPill, { backgroundColor: badge.bg }]}>
              <Text style={[styles.statusPillText, { color: badge.text }]}>
                {badge.label}
              </Text>
            </View>
          </View>

          {/* Route Waypoints Timeline */}
          <View
            style={[
              styles.routeTimelineBox,
              {
                backgroundColor: subtleBoxBg,
                borderColor: palette.border,
              },
            ]}
          >
            <View style={styles.timelineRow}>
              <View style={styles.timelineIconCol}>
                <View
                  style={[
                    styles.originDot,
                    {
                      backgroundColor:
                        gpsStatus === 'live' ? '#059669' : '#EA580C',
                    },
                  ]}
                />
                <View
                  style={[
                    styles.timelineStem,
                    { backgroundColor: palette.borderStrong },
                  ]}
                />
              </View>
              <View style={styles.timelineTextCol}>
                <Text
                  style={[styles.timelineLabel, { color: palette.textMuted }]}
                >
                  {gpsStatus === 'live' ? 'Your location:' : 'Dispatch hub:'}{' '}
                  <Text
                    style={[
                      styles.timelineValue,
                      { color: palette.textPrimary },
                    ]}
                  >
                    {gpsStatus === 'live'
                      ? 'Live GPS tracking active'
                      : 'MotoTrack Naga Hub'}
                  </Text>
                </Text>
              </View>
            </View>

            <View style={styles.timelineRow}>
              <View style={styles.timelineIconCol}>
                <BootstrapIcon name="geo-alt-fill" size={13} color="#DC2626" />
              </View>
              <View style={styles.timelineTextCol}>
                <Text
                  style={[styles.timelineLabel, { color: palette.textMuted }]}
                  numberOfLines={2}
                >
                  Drop off:{' '}
                  <Text
                    style={[
                      styles.timelineValue,
                      { color: palette.textPrimary },
                    ]}
                  >
                    {delivery.customerAddress || 'Customer address unavailable'}
                  </Text>
                </Text>
                {delivery.landmark ? (
                  <Text style={styles.landmarkText} numberOfLines={1}>
                    Landmark: {delivery.landmark}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>

          {/* Customer Info & Estimated Arrival Split Row */}
          <View style={styles.customerEtaRow}>
            <View style={styles.customerInfoCol}>
              <View
                style={[
                  styles.customerAvatar,
                  {
                    backgroundColor: palette.bgAvatar,
                    borderColor: palette.orangeBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.customerInitials,
                    { color: palette.avatarText },
                  ]}
                >
                  {getInitials(delivery.customerName)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.customerName, { color: palette.textPrimary }]}
                  numberOfLines={1}
                >
                  {delivery.customerName || 'Customer'}
                </Text>
                <Text
                  style={[styles.customerMeta, { color: palette.textMuted }]}
                  numberOfLines={1}
                >
                  {cod
                    ? `COD · ${formatPhpExact(delivery.totalAmount)}`
                    : 'Paid order'}
                </Text>
              </View>
              {cleanPhone ? (
                <ExternalLink href={`tel:${cleanPhone}`}>
                  <View
                    style={[
                      styles.callCircleBtn,
                      {
                        backgroundColor: palette.orangeSoft,
                        borderColor: palette.orangeBorder,
                      },
                    ]}
                  >
                    <BootstrapIcon
                      name="telephone"
                      size={14}
                      color={palette.orange}
                    />
                  </View>
                </ExternalLink>
              ) : null}
            </View>

            <View
              style={[
                styles.etaBox,
                {
                  backgroundColor: subtleBoxBg,
                  borderColor: palette.border,
                },
              ]}
            >
              <Text style={[styles.etaOverline, { color: palette.textMuted }]}>
                Estimated arrival
              </Text>
              <Text style={[styles.etaTime, { color: palette.textPrimary }]}>
                {etaClock}
              </Text>
              <Text style={styles.etaDistance}>{distanceSummary}</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsBar}>
            <ExternalLink href={navUrl} style={{ flex: 1 }}>
              <View
                style={[
                  styles.secondaryActionBtn,
                  {
                    backgroundColor: subtleBoxBg,
                    borderColor: palette.borderStrong,
                  },
                ]}
              >
                <BootstrapIcon name="compass-fill" size={14} color="#EA580C" />
                <Text
                  style={[
                    styles.secondaryActionText,
                    { color: palette.textPrimary },
                  ]}
                >
                  Google Maps
                </Text>
              </View>
            </ExternalLink>

            {!delivered ? (
              !isOutForDelivery && !isReported ? (
                <TouchableOpacity
                  style={[
                    styles.primaryActionBtn,
                    {
                      backgroundColor: '#EA580C',
                      opacity: isBusy ? 0.7 : 1,
                    },
                  ]}
                  disabled={isBusy}
                  onPress={() => onStartRoute?.(delivery)}
                  activeOpacity={0.85}
                >
                  {isBusy ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <BootstrapIcon
                        name="play-fill"
                        size={14}
                        color="#FFFFFF"
                      />
                      <Text style={styles.primaryActionText}>
                        Start delivery
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.primaryActionBtn,
                    {
                      backgroundColor: palette.isDark ? '#EA580C' : '#141414',
                    },
                  ]}
                  onPress={() => onScanConfirm?.(delivery)}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon
                    name="qr-code-scan"
                    size={14}
                    color="#FFFFFF"
                  />
                  <Text style={styles.primaryActionText}>Scan QR</Text>
                </TouchableOpacity>
              )
            ) : null}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeRoot: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  topBackBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    ...riderFont('700'),
    fontSize: 17,
    letterSpacing: -0.2,
  },
  gpsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  gpsDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  gpsPillText: {
    ...riderFont('700'),
    fontSize: 11.5,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#E8EEF2',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  mapLoader: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(248, 250, 252, 0.88)',
    gap: 8,
  },
  mapLoaderText: {
    ...riderFont('600'),
    fontSize: 12.5,
    color: '#475569',
  },
  noPinBanner: {
    position: 'absolute',
    top: 12,
    left: 56,
    right: 12,
    zIndex: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  noPinText: {
    flex: 1,
    ...riderFont('600'),
    fontSize: 11.5,
    color: '#92400E',
    lineHeight: 15,
  },
  floatingMapControls: {
    position: 'absolute',
    right: 12,
    bottom: 14,
    flexDirection: 'row',
    gap: 8,
    zIndex: 5,
  },
  mapControlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  mapControlText: {
    ...riderFont('600'),
    fontSize: 12,
  },
  bottomCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 12,
    marginTop: -12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  orderTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  orderBoxBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderCodeTitle: {
    ...riderFont('700'),
    fontSize: 16,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillText: {
    ...riderFont('700'),
    fontSize: 11.5,
  },
  routeTimelineBox: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  timelineIconCol: {
    width: 14,
    alignItems: 'center',
    paddingTop: 3,
  },
  originDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  timelineStem: {
    width: 1.5,
    height: 12,
    marginTop: 3,
  },
  timelineTextCol: {
    flex: 1,
  },
  timelineLabel: {
    ...riderFont('500'),
    fontSize: 12.5,
    lineHeight: 17,
  },
  timelineValue: {
    ...riderFont('600'),
  },
  landmarkText: {
    ...riderFont('600'),
    fontSize: 11.5,
    color: '#EA580C',
    marginTop: 2,
  },
  customerEtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  customerInfoCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  customerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerInitials: {
    ...riderFont('700'),
    fontSize: 13,
  },
  customerName: {
    ...riderFont('700'),
    fontSize: 13.5,
  },
  customerMeta: {
    ...riderFont('500'),
    fontSize: 11.5,
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  callCircleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  etaBox: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 7,
    alignItems: 'flex-end',
    minWidth: 118,
  },
  etaOverline: {
    ...riderFont('500'),
    fontSize: 10.5,
  },
  etaTime: {
    ...riderFont('700'),
    fontSize: 15,
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  etaDistance: {
    ...riderFont('600'),
    fontSize: 11,
    color: '#059669',
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 2,
  },
  secondaryActionBtn: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 12,
  },
  secondaryActionText: {
    ...riderFont('600'),
    fontSize: 13.5,
  },
  primaryActionBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 14,
  },
  primaryActionText: {
    ...riderFont('700'),
    fontSize: 13.5,
    color: '#FFFFFF',
  },
});
