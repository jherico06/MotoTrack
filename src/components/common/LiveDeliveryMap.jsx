/**
 * Leaflet + OpenStreetMap live delivery map.
 * Store pin + customer pin + OSRM road route; rider marker updates in place.
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

function buildMapHtml({ store, customer, statusLabel, orderId }) {
  const sLat = store?.lat ?? STORE_LOCATION.lat;
  const sLng = store?.lng ?? STORE_LOCATION.lng;
  const cLat = customer?.lat ?? STORE_LOCATION.lat;
  const cLng = customer?.lng ?? STORE_LOCATION.lng;
  const hasStore = Boolean(store);
  const hasCustomer = Boolean(customer);
  const status = escapeJs(statusLabel || 'Tracking');
  const storeName = escapeJs(store?.name || STORE_LOCATION.name || 'Store');

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
      background: #0F172A; color: #FBBF24; border-radius: 50%; width: 28px; height: 28px;
      display: flex; align-items: center; justify-content: center; font-size: 14px;
      border: 2px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,.35);
    }
    .pin-customer {
      background: #0284C7; color: #fff; border-radius: 50%; width: 28px; height: 28px;
      display: flex; align-items: center; justify-content: center; font-size: 14px;
      border: 2px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,.35);
    }
    .status-chip {
      position: absolute; z-index: 1000; top: 10px; left: 10px; right: 10px;
      background: rgba(15,23,42,.88); color: #fff; font: 600 12px/1.3 system-ui,sans-serif;
      padding: 8px 12px; border-radius: 10px; pointer-events: none;
    }
  </style>
</head>
<body>
  <div id="statusChip" class="status-chip">${status}</div>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: true, attributionControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    var storeIcon = L.divIcon({ className: '', html: '<div class="pin-store">🏪</div>', iconSize: [30,30], iconAnchor: [15,15] });
    var customerIcon = L.divIcon({ className: '', html: '<div class="pin-customer">📍</div>', iconSize: [28,28], iconAnchor: [14,14] });
    var riderIcon = L.divIcon({ className: '', html: '<div class="pin-rider">🛵</div>', iconSize: [28,28], iconAnchor: [14,14] });

    var storeMarker = null;
    var customerMarker = null;
    var riderMarker = null;
    var routeLine = null;
    var hasFitted = false;
    var followRider = false;

    function setStore(lat, lng, label) {
      if (!isFinite(lat) || !isFinite(lng)) return;
      if (!storeMarker) {
        storeMarker = L.marker([lat, lng], { icon: storeIcon }).addTo(map);
      } else {
        storeMarker.setLatLng([lat, lng]);
      }
      storeMarker.bindPopup(label || 'Store');
      fitIfNeeded();
    }

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
        map.panTo([lat, lng], { animate: true, duration: 0.4 });
      } else {
        fitIfNeeded();
      }
    }

    function setRoute(coords) {
      if (!Array.isArray(coords) || coords.length < 2) {
        if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
        return;
      }
      var latLngs = coords
        .map(function (p) { return [Number(p.lat), Number(p.lng)]; })
        .filter(function (p) { return isFinite(p[0]) && isFinite(p[1]); });
      if (latLngs.length < 2) return;
      if (routeLine) {
        routeLine.setLatLngs(latLngs);
      } else {
        routeLine = L.polyline(latLngs, {
          color: '#EA580C',
          weight: 5,
          opacity: 0.9,
          lineJoin: 'round',
          lineCap: 'round'
        }).addTo(map);
      }
      hasFitted = false;
      fitIfNeeded();
    }

    function fitIfNeeded() {
      if (hasFitted) return;
      var pts = [];
      if (storeMarker) pts.push(storeMarker.getLatLng());
      if (customerMarker) pts.push(customerMarker.getLatLng());
      if (riderMarker) pts.push(riderMarker.getLatLng());
      if (routeLine) {
        try {
          map.fitBounds(routeLine.getBounds().pad(0.2), { maxZoom: 16, padding: [40, 40] });
          hasFitted = true;
          return;
        } catch (e) {}
      }
      if (pts.length === 0) return;
      if (pts.length === 1) {
        map.setView(pts[0], 15);
      } else {
        map.fitBounds(L.latLngBounds(pts).pad(0.28), { maxZoom: 16 });
      }
      hasFitted = true;
    }

    function setStatus(text) {
      var el = document.getElementById('statusChip');
      if (el) el.textContent = text || '';
    }

    function setFollow(v) { followRider = !!v; }

    ${hasStore ? `setStore(${sLat}, ${sLng}, '${storeName}');` : ''}
    ${hasCustomer ? `setCustomer(${cLat}, ${cLng}, 'Delivery address');` : `map.setView([${sLat}, ${sLng}], 13);`}

    window.__motoMap = {
      setStore: setStore,
      setCustomer: setCustomer,
      setRider: setRider,
      setRoute: setRoute,
      setStatus: setStatus,
      setFollow: setFollow,
      fit: function () { hasFitted = false; fitIfNeeded(); }
    };

    function handleMsg(ev) {
      try {
        var data = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
        if (!data || !data.type) return;
        if (data.type === 'store') setStore(data.lat, data.lng, data.label);
        if (data.type === 'customer') setCustomer(data.lat, data.lng, data.label);
        if (data.type === 'rider') setRider(data.lat, data.lng, data.label, data.smooth !== false);
        if (data.type === 'route') setRoute(data.coords || []);
        if (data.type === 'status') setStatus(data.text);
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

export default function LiveDeliveryMap({
  orderId,
  statusLabel,
  customerLat,
  customerLng,
  customerAddress,
  storeLat = STORE_LOCATION.lat,
  storeLng = STORE_LOCATION.lng,
  storeLabel = STORE_LOCATION.name,
  riderLat,
  riderLng,
  riderLabel = 'Rider',
  lastUpdatedAt,
  height = 280,
  followRider = false,
  style,
}) {
  const webRef = useRef(null);
  const iframeRef = useRef(null);
  const mapReady = useRef(false);
  const [loading, setLoading] = useState(true);
  const [routePath, setRoutePath] = useState(null);

  const store = useMemo(() => {
    const s = parseLatLng(storeLat, storeLng);
    return s ? { ...s, name: storeLabel } : { lat: STORE_LOCATION.lat, lng: STORE_LOCATION.lng, name: storeLabel };
  }, [storeLat, storeLng, storeLabel]);

  const customer = useMemo(() => parseLatLng(customerLat, customerLng), [customerLat, customerLng]);

  const html = useMemo(
    () =>
      buildMapHtml({
        store,
        customer,
        statusLabel,
        orderId,
      }),
    // Recreate HTML when order / endpoints change — not on rider GPS ticks
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orderId, customer?.lat, customer?.lng, store?.lat, store?.lng, store?.name, statusLabel]
  );

  // Fetch accurate road route: store → customer
  useEffect(() => {
    if (!customer || !store) {
      setRoutePath(null);
      return undefined;
    }
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let cancelled = false;
    fetchDrivingRoute(store, customer, { signal: controller?.signal })
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
      } catch (_e) {}
    };
  }, [store?.lat, store?.lng, customer?.lat, customer?.lng]);

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

  useEffect(() => {
    if (!mapReady.current) return;
    postToMap({ type: 'follow', value: followRider });
  }, [followRider, postToMap]);

  useEffect(() => {
    if (!mapReady.current) return;
    postToMap({
      type: 'store',
      lat: store.lat,
      lng: store.lng,
      label: store.name || 'Store',
    });
  }, [store.lat, store.lng, store.name, postToMap]);

  useEffect(() => {
    if (!mapReady.current) return;
    if (!routePath?.length) {
      postToMap({ type: 'route', coords: [] });
      return;
    }
    postToMap({ type: 'route', coords: routePath });
  }, [routePath, postToMap]);

  useEffect(() => {
    if (!mapReady.current) return;
    const rider = parseLatLng(riderLat, riderLng);
    if (!rider) return;
    postToMap({
      type: 'rider',
      lat: rider.lat,
      lng: rider.lng,
      label: riderLabel,
      smooth: true,
    });
  }, [riderLat, riderLng, riderLabel, postToMap]);

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
      } catch (_e) {}
    }
    postToMap({ type: 'status', text: parts.join(' · ') });
  }, [statusLabel, lastUpdatedAt, postToMap]);

  const onLoad = () => {
    mapReady.current = true;
    setLoading(false);
    setTimeout(() => {
      postToMap({
        type: 'store',
        lat: store.lat,
        lng: store.lng,
        label: store.name || 'Store',
      });
      if (customer) {
        postToMap({
          type: 'customer',
          lat: customer.lat,
          lng: customer.lng,
          label: 'Delivery address',
        });
      }
      if (routePath?.length) {
        postToMap({ type: 'route', coords: routePath });
      }
      const rider = parseLatLng(riderLat, riderLng);
      if (rider) {
        postToMap({
          type: 'rider',
          lat: rider.lat,
          lng: rider.lng,
          label: riderLabel,
          smooth: false,
        });
      }
      postToMap({ type: 'fit' });
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
          style={[styles.webview, loading && { opacity: 0 }]}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="compatibility"
          scrollEnabled={false}
        />
      )}

      {lastUpdatedAt ? (
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
            {routePath?.length ? 'Route: store → delivery address' : 'Waiting for rider GPS…'}
          </Text>
        </View>
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
