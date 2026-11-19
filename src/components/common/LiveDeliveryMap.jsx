/**
 * Leaflet + OpenStreetMap live delivery map.
 * Store pin + customer pin + OSRM road route; rider marker updates in place.
 * Supports responsive ResizeObserver invalidateSize() and auto-follow rider camera.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { parseLatLng, STORE_LOCATION } from '../../utils/geo.js';
import { fetchDrivingRoute } from '../../utils/deliveryRouting.js';

function escapeJs(str) {
  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, ' ');
}

function distanceMeters(a, b) {
  if (!a || !b) return Infinity;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(Number(b.lat) - Number(a.lat));
  const dLng = toRad(Number(b.lng) - Number(a.lng));
  const lat1 = toRad(Number(a.lat));
  const lat2 = toRad(Number(b.lat));
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function buildMapHtml({ store, customer, statusLabel, orderId, initialFollow }) {
  const sLat = store?.lat ?? STORE_LOCATION.lat;
  const sLng = store?.lng ?? STORE_LOCATION.lng;
  const cLat = customer?.lat ?? STORE_LOCATION.lat;
  const cLng = customer?.lng ?? STORE_LOCATION.lng;
  const hasStore = Boolean(store);
  const hasCustomer = Boolean(customer);
  const safeOrderId = escapeJs(orderId || 'live');
  const storeName = escapeJs(store?.name || STORE_LOCATION.name || 'Store');
  const startFollow = Boolean(initialFollow);

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
    .pin-store {
      background: #EA580C; color: #fff; border-radius: 50%; width: 30px; height: 30px;
      display: flex; align-items: center; justify-content: center; font-size: 15px;
      border: 2px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,.35);
    }
    .pin-rider {
      background: #0F172A; color: #FBBF24; border-radius: 50%; width: 30px; height: 30px;
      display: flex; align-items: center; justify-content: center; font-size: 15px;
      border: 2.5px solid #fff; box-shadow: 0 2px 10px rgba(0,0,0,.4);
    }
    .pin-customer {
      background: #0284C7; color: #fff; border-radius: 50%; width: 28px; height: 28px;
      display: flex; align-items: center; justify-content: center; font-size: 14px;
      border: 2px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,.35);
    }
    .leaflet-control-zoom {
      border: 1px solid #CBD5E1 !important;
      border-radius: 8px !important;
      overflow: hidden !important;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.12) !important;
      margin-top: 10px !important;
      margin-left: 10px !important;
    }
    .leaflet-control-zoom a {
      background-color: #FFFFFF !important;
      color: #0F172A !important;
      width: 32px !important;
      height: 32px !important;
      line-height: 32px !important;
      font-size: 16px !important;
      font-weight: 700 !important;
      border-bottom: 1px solid #E2E8F0 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      text-decoration: none !important;
      cursor: pointer !important;
      transition: background-color 0.15s ease, color 0.15s ease;
    }
    .leaflet-control-zoom a:hover {
      background-color: #FFF7ED !important;
      color: #EA580C !important;
    }
    .leaflet-control-zoom a:last-child {
      border-bottom: none !important;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var MAP_ORDER_ID = '${safeOrderId}';
    var map = L.map('map', {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      touchZoom: true,
      boxZoom: true,
      dragging: true
    });

    function notifyHost(payload) {
      var msg = JSON.stringify(Object.assign({ orderId: MAP_ORDER_ID }, payload || {}));
      try {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(msg);
        }
      } catch (e) {}
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(msg, '*');
        }
      } catch (e) {}
    }

    var storeMarker = null;
    var customerMarker = null;
    var riderMarker = null;
    var shopRouteOuter = null;
    var shopRouteInner = null;
    var routeOuter = null;
    var routeLine = null;
    var hasFitted = false;
    var userMovedMap = false;
    var followRider = ${startFollow ? 'true' : 'false'};

    map.on('zoomstart', function () { hasFitted = true; userMovedMap = true; });
    map.on('dragstart', function () {
      hasFitted = true;
      userMovedMap = true;
      if (followRider) {
        followRider = false;
        notifyHost({ type: 'followPaused' });
      }
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    var storeIcon = L.divIcon({ className: '', html: '<div class="pin-store">🏪</div>', iconSize: [30,30], iconAnchor: [15,15] });
    var customerIcon = L.divIcon({ className: '', html: '<div class="pin-customer">📍</div>', iconSize: [28,28], iconAnchor: [14,14] });
    var riderIcon = L.divIcon({ className: '', html: '<div class="pin-rider">🛵</div>', iconSize: [30,30], iconAnchor: [15,15] });

    function setStore(lat, lng, label) {
      if (!isFinite(lat) || !isFinite(lng)) return;
      if (!storeMarker) {
        storeMarker = L.marker([lat, lng], { icon: storeIcon, zIndexOffset: 300 }).addTo(map);
      } else {
        storeMarker.setLatLng([lat, lng]);
      }
      storeMarker.bindPopup(label || 'Store');
      if (!userMovedMap && customerMarker && !followRider) fitIfNeeded();
    }

    function setCustomer(lat, lng, label) {
      if (!isFinite(lat) || !isFinite(lng)) return;
      if (!customerMarker) {
        customerMarker = L.marker([lat, lng], { icon: customerIcon, zIndexOffset: 400 }).addTo(map);
      } else {
        customerMarker.setLatLng([lat, lng]);
      }
      if (label) customerMarker.bindPopup(label);
      if (!userMovedMap && (!followRider || !riderMarker)) {
        hasFitted = false;
        fitIfNeeded();
      }
    }

    function setRider(lat, lng, label, smooth) {
      if (!isFinite(lat) || !isFinite(lng)) return;
      var isFirstRiderPin = !riderMarker;
      if (!riderMarker) {
        riderMarker = L.marker([lat, lng], { icon: riderIcon, zIndexOffset: 600 }).addTo(map);
      } else if (smooth) {
        var from = riderMarker.getLatLng();
        var to = L.latLng(lat, lng);
        var steps = 12, i = 0;
        clearInterval(window.__riderAnim);
        window.__riderAnim = setInterval(function () {
          i++;
          var t = i / steps;
          var la = from.lat + (to.lat - from.lat) * t;
          var ln = from.lng + (to.lng - from.lng) * t;
          riderMarker.setLatLng([la, ln]);
          if (i >= steps) clearInterval(window.__riderAnim);
        }, 40);
      } else {
        riderMarker.setLatLng([lat, lng]);
      }
      if (label) riderMarker.bindPopup(label);
      if (followRider) {
        if (isFirstRiderPin || (map.getZoom() || 0) < 14) {
          map.setView([lat, lng], Math.max(map.getZoom() || 15, 15), { animate: !isFirstRiderPin });
        } else {
          map.panTo([lat, lng], { animate: true, duration: 0.45 });
        }
        hasFitted = true;
      } else if (!userMovedMap) {
        fitIfNeeded();
      }
    }

    function setShopRoute(coords) {
      if (!Array.isArray(coords) || coords.length < 2) {
        if (shopRouteOuter) { map.removeLayer(shopRouteOuter); shopRouteOuter = null; }
        if (shopRouteInner) { map.removeLayer(shopRouteInner); shopRouteInner = null; }
        return;
      }
      var latLngs = coords
        .map(function (p) { return [Number(p.lat), Number(p.lng)]; })
        .filter(function (p) { return isFinite(p[0]) && isFinite(p[1]); });
      if (latLngs.length < 2) return;
      if (shopRouteOuter) map.removeLayer(shopRouteOuter);
      if (shopRouteInner) map.removeLayer(shopRouteInner);
      shopRouteOuter = L.polyline(latLngs, {
        color: '#FFFFFF',
        weight: 7,
        opacity: 0.85,
        lineJoin: 'round',
        lineCap: 'round'
      }).addTo(map);
      shopRouteInner = L.polyline(latLngs, {
        color: '#EA580C',
        weight: 4,
        opacity: 0.92,
        dashArray: '7, 6',
        lineJoin: 'round',
        lineCap: 'round'
      }).addTo(map);
      if (!userMovedMap && (!followRider || !riderMarker)) {
        hasFitted = false;
        fitIfNeeded();
      }
    }

    function setRoute(coords, isLiveLeg) {
      if (!Array.isArray(coords) || coords.length < 2) {
        if (routeOuter) { map.removeLayer(routeOuter); routeOuter = null; }
        if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
        return;
      }
      var latLngs = coords
        .map(function (p) { return [Number(p.lat), Number(p.lng)]; })
        .filter(function (p) { return isFinite(p[0]) && isFinite(p[1]); });
      if (latLngs.length < 2) return;
      if (routeOuter) map.removeLayer(routeOuter);
      if (routeLine) map.removeLayer(routeLine);
      routeOuter = L.polyline(latLngs, {
        color: '#FFFFFF',
        weight: 8,
        opacity: 0.85,
        lineJoin: 'round',
        lineCap: 'round'
      }).addTo(map);
      routeLine = L.polyline(latLngs, {
        color: isLiveLeg ? '#059669' : '#EA580C',
        weight: 5,
        opacity: 0.95,
        lineJoin: 'round',
        lineCap: 'round'
      }).addTo(map);
      if (!userMovedMap && (!followRider || !riderMarker)) {
        hasFitted = false;
        fitIfNeeded();
      }
    }

    function fitIfNeeded() {
      if (hasFitted) return;
      var bounds = L.latLngBounds([]);
      if (storeMarker) bounds.extend(storeMarker.getLatLng());
      if (customerMarker) bounds.extend(customerMarker.getLatLng());
      if (riderMarker) bounds.extend(riderMarker.getLatLng());
      if (shopRouteInner) {
        try { bounds.extend(shopRouteInner.getBounds()); } catch (e) {}
      }
      if (routeLine) {
        try { bounds.extend(routeLine.getBounds()); } catch (e) {}
      }
      if (!bounds.isValid()) return;
      if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
        map.setView(bounds.getCenter(), 15);
      } else {
        map.fitBounds(bounds.pad(0.2), { maxZoom: 16, padding: [36, 36] });
      }
      hasFitted = true;
    }

    function setStatus(text) {
      // Unobstructed map view - status is displayed in outer cards
    }

    function setFollow(v) {
      followRider = !!v;
      if (followRider && riderMarker) {
        hasFitted = true;
        map.setView(riderMarker.getLatLng(), Math.max(map.getZoom() || 15, 15), { animate: true });
      }
    }

    function handleResize() {
      try {
        map.invalidateSize({ pan: false });
        if (followRider && riderMarker) {
          map.panTo(riderMarker.getLatLng(), { animate: false });
        }
      } catch (e) {}
    }

    if (typeof ResizeObserver !== 'undefined') {
      try {
        new ResizeObserver(handleResize).observe(document.getElementById('map'));
      } catch (e) {}
    }
    window.addEventListener('resize', handleResize);

    ${hasStore ? `setStore(${sLat}, ${sLng}, '${storeName}');` : ''}
    ${hasCustomer ? `setCustomer(${cLat}, ${cLng}, 'Delivery address');` : `map.setView([${sLat}, ${sLng}], 13);`}

    window.__motoMap = {
      setStore: setStore,
      setCustomer: setCustomer,
      setRider: setRider,
      setShopRoute: setShopRoute,
      setRoute: setRoute,
      setStatus: setStatus,
      setFollow: setFollow,
      fit: function () { userMovedMap = false; followRider = false; hasFitted = false; fitIfNeeded(); }
    };

    function handleMsg(ev) {
      try {
        var data = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
        if (!data || !data.type) return;
        if (data.type === 'store') setStore(data.lat, data.lng, data.label);
        if (data.type === 'customer') setCustomer(data.lat, data.lng, data.label);
        if (data.type === 'rider') setRider(data.lat, data.lng, data.label, data.smooth !== false);
        if (data.type === 'shopRoute') setShopRoute(data.coords || []);
        if (data.type === 'route') setRoute(data.coords || [], Boolean(data.isLiveLeg));
        if (data.type === 'status') setStatus(data.text);
        if (data.type === 'follow') setFollow(data.value);
        if (data.type === 'fit') { userMovedMap = false; followRider = false; hasFitted = false; fitIfNeeded(); }
      } catch (e) {}
    }

    window.addEventListener('message', handleMsg);
    document.addEventListener('message', handleMsg);
  </script>
</body>
</html>`;
}

export default function LiveDeliveryMap({
  orderId,
  statusLabel,
  customerLat,
  customerLng,
  customerAddress,
  customerLandmark = '',
  storeLat = STORE_LOCATION.lat,
  storeLng = STORE_LOCATION.lng,
  storeLabel = STORE_LOCATION.name,
  riderLat,
  riderLng,
  riderLabel = 'Rider',
  lastUpdatedAt,
  height = 280,
  followRider = false,
  onFollowChange,
  routeFromRider = false,
  showShopToRiderRoute = false,
  fitTrigger = 0,
  hideFooter = false,
  style,
}) {
  const webRef = useRef(null);
  const iframeRef = useRef(null);
  const mapReady = useRef(false);
  const lastShopRoutedRef = useRef(null);
  const lastRoutedOriginRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [shopRoutePath, setShopRoutePath] = useState(null);
  const [routePath, setRoutePath] = useState(null);

  const store = useMemo(() => {
    const s = parseLatLng(storeLat, storeLng);
    return s ? { ...s, name: storeLabel } : { lat: STORE_LOCATION.lat, lng: STORE_LOCATION.lng, name: storeLabel };
  }, [storeLat, storeLng, storeLabel]);

  const customer = useMemo(() => parseLatLng(customerLat, customerLng), [customerLat, customerLng]);
  const riderCoords = useMemo(() => parseLatLng(riderLat, riderLng), [riderLat, riderLng]);

  const html = useMemo(
    () =>
      buildMapHtml({
        store,
        customer,
        statusLabel,
        orderId,
        initialFollow: followRider,
      }),
    // Recreate HTML when order / endpoints change — not on rider GPS ticks or follow toggles
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orderId, customer?.lat, customer?.lng, store?.lat, store?.lng, store?.name, statusLabel]
  );

  // Leg 1 driving route: shop -> live rider location (when two-leg mode is enabled & rider GPS exists)
  useEffect(() => {
    if (!showShopToRiderRoute || !riderCoords || !store) {
      lastShopRoutedRef.current = null;
      setShopRoutePath(null);
      return undefined;
    }

    if (distanceMeters(store, riderCoords) < 25) {
      lastShopRoutedRef.current = {
        lat: riderCoords.lat,
        lng: riderCoords.lng,
        storeLat: store.lat,
        storeLng: store.lng,
      };
      setShopRoutePath([store, riderCoords]);
      return undefined;
    }

    const last = lastShopRoutedRef.current;
    if (
      last &&
      last.storeLat === store.lat &&
      last.storeLng === store.lng &&
      distanceMeters(last, riderCoords) < 40
    ) {
      return undefined;
    }

    lastShopRoutedRef.current = {
      lat: riderCoords.lat,
      lng: riderCoords.lng,
      storeLat: store.lat,
      storeLng: store.lng,
    };

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let cancelled = false;
    fetchDrivingRoute(store, riderCoords, { signal: controller?.signal })
      .then((path) => {
        if (!cancelled) {
          setShopRoutePath(Array.isArray(path) && path.length >= 2 ? path : [store, riderCoords]);
        }
      })
      .catch(() => {
        if (!cancelled) setShopRoutePath([store, riderCoords]);
      });
    return () => {
      cancelled = true;
      try {
        controller?.abort();
      } catch (_e) { }
    };
  }, [showShopToRiderRoute, store?.lat, store?.lng, riderCoords?.lat, riderCoords?.lng]);

  // Leg 2 driving route (from live rider location when enabled & available, else store -> customer)
  const routeOrigin = routeFromRider && riderCoords ? riderCoords : store;

  useEffect(() => {
    if (!customer || !routeOrigin) {
      lastRoutedOriginRef.current = null;
      setRoutePath(null);
      return undefined;
    }

    const last = lastRoutedOriginRef.current;
    if (
      last &&
      last.destLat === customer.lat &&
      last.destLng === customer.lng &&
      distanceMeters(last, routeOrigin) < 40
    ) {
      return undefined;
    }

    lastRoutedOriginRef.current = {
      lat: routeOrigin.lat,
      lng: routeOrigin.lng,
      destLat: customer.lat,
      destLng: customer.lng,
    };

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let cancelled = false;
    fetchDrivingRoute(routeOrigin, customer, { signal: controller?.signal })
      .then((path) => {
        if (!cancelled) setRoutePath(Array.isArray(path) && path.length >= 2 ? path : null);
      })
      .catch(() => {
        if (!cancelled) setRoutePath(null);
      });
    return () => {
      cancelled = true;
      try {
        controller?.abort();
      } catch (_e) { }
    };
  }, [routeOrigin?.lat, routeOrigin?.lng, customer?.lat, customer?.lng]);

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
        `try{window.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(msg)}}));}catch(e){};true;`
      );
    }
  }, []);

  const handleHostMessage = useCallback(
    (raw) => {
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!parsed || parsed.type !== 'followPaused') return;
        if (parsed.orderId && orderId && String(parsed.orderId) !== String(orderId)) return;
        onFollowChange?.(false);
      } catch (_e) {}
    },
    [onFollowChange, orderId]
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const onWinMsg = (ev) => handleHostMessage(ev?.data);
    window.addEventListener('message', onWinMsg);
    return () => window.removeEventListener('message', onWinMsg);
  }, [handleHostMessage]);

  useEffect(() => {
    if (!mapReady.current) return;
    postToMap({ type: 'follow', value: Boolean(followRider) });
  }, [followRider, postToMap]);

  useEffect(() => {
    if (!mapReady.current || !fitTrigger) return;
    postToMap({ type: 'fit' });
  }, [fitTrigger, postToMap]);

  useEffect(() => {
    if (!mapReady.current) return;
    postToMap({
      type: 'store',
      lat: store.lat,
      lng: store.lng,
      label: store.name || 'Store',
    });
  }, [store.lat, store.lng, store.name, postToMap]);

  const isLiveRiderLeg = Boolean(showShopToRiderRoute && riderCoords);

  useEffect(() => {
    if (!mapReady.current) return;
    if (!shopRoutePath?.length) {
      postToMap({ type: 'shopRoute', coords: [] });
      return;
    }
    postToMap({ type: 'shopRoute', coords: shopRoutePath });
  }, [shopRoutePath, postToMap]);

  useEffect(() => {
    if (!mapReady.current) return;
    if (!routePath?.length) {
      postToMap({ type: 'route', coords: [], isLiveLeg: isLiveRiderLeg });
      return;
    }
    postToMap({ type: 'route', coords: routePath, isLiveLeg: isLiveRiderLeg });
  }, [routePath, isLiveRiderLeg, postToMap]);

  useEffect(() => {
    if (!mapReady.current || !riderCoords) return;
    postToMap({
      type: 'rider',
      lat: riderCoords.lat,
      lng: riderCoords.lng,
      label: riderLabel,
      smooth: true,
    });
  }, [riderCoords?.lat, riderCoords?.lng, riderLabel, postToMap]);

  useEffect(() => {
    if (!mapReady.current) return;
    const parts = [statusLabel || 'Tracking'];
    if (lastUpdatedAt) {
      try {
        const d = new Date(lastUpdatedAt);
        if (!Number.isNaN(d.getTime())) {
          parts.push(
            `Updated ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
          );
        }
      } catch (_e) { }
    }
    postToMap({ type: 'status', text: parts.join(' · ') });
  }, [statusLabel, lastUpdatedAt, postToMap]);

  const onLoad = () => {
    mapReady.current = true;
    setLoading(false);
    setTimeout(() => {
      postToMap({ type: 'follow', value: Boolean(followRider) });
      postToMap({
        type: 'store',
        lat: store.lat,
        lng: store.lng,
        label: store.name || 'Store',
      });
      if (customer) {
        const destLabelParts = [customerAddress || 'Delivery destination'];
        if (customerLandmark) destLabelParts.push(`Note: ${customerLandmark}`);
        postToMap({
          type: 'customer',
          lat: customer.lat,
          lng: customer.lng,
          label: destLabelParts.join(' — '),
        });
      }
      if (shopRoutePath?.length) {
        postToMap({ type: 'shopRoute', coords: shopRoutePath });
      }
      if (routePath?.length) {
        postToMap({ type: 'route', coords: routePath, isLiveLeg: isLiveRiderLeg });
      }
      if (riderCoords) {
        postToMap({
          type: 'rider',
          lat: riderCoords.lat,
          lng: riderCoords.lng,
          label: riderLabel,
          smooth: false,
        });
      }
      if (!followRider || !riderCoords) {
        postToMap({ type: 'fit' });
      }
    }, 200);
  };

  return (
    <View style={[styles.wrap, { height }, style]}>
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color="#EA580C" />
          <Text style={styles.loadingText}>Loading map…</Text>
        </View>
      ) : null}

      {!customer ? (
        <View style={styles.noGeo}>
          <Text style={styles.noGeoText}>
            Customer delivery coordinates are not available yet
            {customerAddress ? ` for “${String(customerAddress).slice(0, 60)}”` : ''}.
          </Text>
        </View>
      ) : null}

      {Platform.OS === 'web' ? (
        <iframe
          ref={iframeRef}
          title={`delivery-map-${orderId || 'live'}`}
          srcDoc={html}
          onLoad={onLoad}
          style={{
            border: 'none',
            width: '100%',
            height: '100%',
            borderRadius: 12,
            opacity: loading ? 0 : 1,
          }}
          sandbox="allow-scripts allow-same-origin"
        />
      ) : (
        <WebView
          ref={webRef}
          originWhitelist={['*']}
          source={{ html, baseUrl: 'https://unpkg.com' }}
          onLoadEnd={onLoad}
          onMessage={(ev) => handleHostMessage(ev?.nativeEvent?.data)}
          style={[styles.webview, loading && { opacity: 0 }]}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="compatibility"
          scrollEnabled={false}
        />
      )}

      {!hideFooter && (
        lastUpdatedAt ? (
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Last GPS update:{' '}
              {(() => {
                try {
                  return new Date(lastUpdatedAt).toLocaleString();
                } catch (_e) {
                  return String(lastUpdatedAt);
                }
              })()}
            </Text>
          </View>
        ) : (
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {routePath?.length
                ? routeFromRider && riderCoords
                  ? showShopToRiderRoute
                    ? 'Route: shop → rider → delivery address'
                    : 'Route: rider → delivery address'
                  : 'Route: store → delivery address'
                : 'Waiting for rider GPS…'}
            </Text>
          </View>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#E8EEF2',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  webview: { flex: 1, backgroundColor: 'transparent' },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    gap: 8,
    backgroundColor: '#F8FAFC',
  },
  loadingText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  noGeo: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    zIndex: 3,
    backgroundColor: 'rgba(254,243,199,0.95)',
    padding: 8,
    borderRadius: 8,
  },
  noGeoText: { fontSize: 11, color: '#92400E', fontWeight: '600' },
  footer: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  footerText: { fontSize: 11, color: '#64748B', fontWeight: '600' },
});
