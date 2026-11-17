import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { BootstrapIcon } from '../../common/BootstrapIcon.jsx';
import ExternalLink from '../../common/ExternalLink.jsx';
import {
  geocodeAddress,
  googleMapsNavigateUrl,
  STORE_LOCATION,
} from '../../../utils/geo.js';
import {
  RIDER_FONT,
  cardShadowStyle,
  formatOrderCode,
  getOrderStatusBadge,
} from './riderTheme.js';

export default function RiderHomeDeliveryMapCard({
  deliveries = [],
  palette,
  riderName = 'Rider',
  onOpenFullMap,
  onScanConfirm,
  onViewDetails,
}) {
  const orderedDeliveries = useMemo(() => {
    const list = Array.isArray(deliveries) ? deliveries.slice() : [];
    return list.sort((a, b) => {
      const aOut = String(a?.deliveryStatus || '').toLowerCase().includes('out') ? 0 : 1;
      const bOut = String(b?.deliveryStatus || '').toLowerCase().includes('out') ? 0 : 1;
      return aOut - bOut;
    });
  }, [deliveries]);

  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const activeDelivery = useMemo(() => {
    if (orderedDeliveries.length === 0) return null;
    if (selectedOrderId) {
      const match = orderedDeliveries.find(
        (d) => String(d.orderId) === String(selectedOrderId)
      );
      if (match) return match;
    }
    return orderedDeliveries[0];
  }, [orderedDeliveries, selectedOrderId]);

  const [destCoords, setDestCoords] = useState(null);

  useEffect(() => {
    let mounted = true;
    if (!activeDelivery) {
      setDestCoords(null);
      return undefined;
    }
    const oLat = Number(activeDelivery?.lat);
    const oLng = Number(activeDelivery?.lng);
    if (Number.isFinite(oLat) && Number.isFinite(oLng) && oLat !== 0 && oLng !== 0) {
      setDestCoords({ lat: oLat, lng: oLng });
      return undefined;
    }
    const addr = String(activeDelivery?.customerAddress || '').trim();
    if (!addr) {
      setDestCoords(null);
      return undefined;
    }
    geocodeAddress(addr)
      .then((coords) => {
        if (mounted && coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
          setDestCoords(coords);
        } else if (mounted) {
          setDestCoords(null);
        }
      })
      .catch(() => {
        if (mounted) setDestCoords(null);
      });
    return () => {
      mounted = false;
    };
  }, [activeDelivery?.orderId, activeDelivery?.lat, activeDelivery?.lng, activeDelivery?.customerAddress]);

  const leafletHtml = useMemo(() => {
    const hubLat = STORE_LOCATION?.lat || 10.20663;
    const hubLng = STORE_LOCATION?.lng || 123.75675;
    const hasDest = Boolean(activeDelivery);
    const destLat = destCoords?.lat ?? 10.2185;
    const destLng = destCoords?.lng ?? 123.7535;
    const safeCustomer = String(activeDelivery?.customerName || 'Customer')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"');
    const safeAddr = String(activeDelivery?.customerAddress || 'Delivery destination')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"');
    const safeRider = String(riderName || 'Rider')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #E2E8F0; overflow: hidden; }
    .hub-pin { background: #EA580C; color: #fff; border: 2px solid #fff; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 8px rgba(0,0,0,0.3); font-size: 14px; }
    .dest-pin { background: #141D2E; color: #fff; border: 2px solid #fff; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 8px rgba(0,0,0,0.3); font-size: 14px; }
    .rider-badge { background: #141D2E; color: #fff; border: 1.5px solid #EA580C; border-radius: 999px; padding: 2px 8px; font-size: 10px; font-weight: 700; white-space: nowrap; box-shadow: 0 3px 8px rgba(0,0,0,0.28); font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    function initMap() {
      if (typeof L === 'undefined') { setTimeout(initMap, 60); return; }
      try {
        var hubLat = ${hubLat}, hubLng = ${hubLng};
        var destLat = ${destLat}, destLng = ${destLng};
        var hasDest = ${hasDest ? 'true' : 'false'};
        var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([hubLat, hubLng], 14);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
        var hubIcon = L.divIcon({ className: '', html: '<div class="hub-pin">🏪</div>', iconSize: [28, 28], iconAnchor: [14, 14] });
        L.marker([hubLat, hubLng], { icon: hubIcon }).addTo(map).bindPopup("<b>MotoTrack Hub</b>");
        if (hasDest) {
          var routeCoords = [
            [hubLat, hubLng],
            [hubLat + (destLat - hubLat) * 0.35, hubLng + (destLng - hubLng) * 0.28],
            [hubLat + (destLat - hubLat) * 0.7, hubLng + (destLng - hubLng) * 0.72],
            [destLat, destLng]
          ];
          var line = L.polyline(routeCoords, { color: '#EA580C', weight: 4.5, opacity: 0.9, dashArray: '7, 5' }).addTo(map);
          var destIcon = L.divIcon({ className: '', html: '<div class="dest-pin">📍</div>', iconSize: [28, 28], iconAnchor: [14, 14] });
          L.marker([destLat, destLng], { icon: destIcon }).addTo(map).bindPopup("<b>${safeCustomer}</b><br/>${safeAddr}");
          var midLat = hubLat + (destLat - hubLat) * 0.45;
          var midLng = hubLng + (destLng - hubLng) * 0.45;
          var riderIcon = L.divIcon({ className: '', html: '<div class="rider-badge">🏍️ ${safeRider}</div>', iconSize: [110, 24], iconAnchor: [55, 12] });
          L.marker([midLat, midLng], { icon: riderIcon }).addTo(map);
          try { map.fitBounds(line.getBounds(), { padding: [34, 34] }); } catch (e) {}
        }
        setTimeout(function() { map.invalidateSize(); }, 250);
      } catch (e) {}
    }
    initMap();
  </script>
</body>
</html>`;
  }, [activeDelivery, destCoords, riderName]);

  const cardBg = palette.isDark ? '#1C1F23' : '#FFFFFF';
  const cardBorder = palette.isDark ? '#2B3035' : '#EDE9E0';
  const badge = activeDelivery ? getOrderStatusBadge(activeDelivery, palette) : null;
  const navUrl = activeDelivery
    ? googleMapsNavigateUrl(
        activeDelivery?.lat,
        activeDelivery?.lng,
        activeDelivery?.customerAddress
      )
    : '';

  return (
    <View
      style={[
        styles.card,
        !palette.isDark && cardShadowStyle,
        {
          backgroundColor: cardBg,
          borderColor: cardBorder,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={[styles.eyebrow, { color: palette.orange }]}>
            {activeDelivery ? 'DELIVERY ROUTE MAP' : 'DISPATCH MAP'}
          </Text>
          <Text
            style={[styles.title, { color: palette.textPrimary }]}
            numberOfLines={1}
          >
            {activeDelivery
              ? `${formatOrderCode(activeDelivery.orderId)} · ${activeDelivery.customerName || 'Customer'}`
              : 'All deliveries completed'}
          </Text>
          <Text
            style={[styles.subtitle, { color: palette.textMuted }]}
            numberOfLines={1}
          >
            {activeDelivery
              ? activeDelivery.customerAddress || 'Tap map to view full route'
              : 'Assigned deliveries will appear on your route map here.'}
          </Text>
        </View>

        {badge ? (
          <View style={[styles.statusPill, { backgroundColor: badge.bg }]}>
            <Text style={[styles.statusPillText, { color: badge.text }]}>
              {badge.label}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Order Selector Pills when multiple deliveries exist */}
      {orderedDeliveries.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.orderTabsRow}
          style={{ marginTop: 10 }}
        >
          {orderedDeliveries.map((d) => {
            const isSelected =
              String(d.orderId) === String(activeDelivery?.orderId);
            return (
              <TouchableOpacity
                key={d.orderId}
                onPress={() => setSelectedOrderId(d.orderId)}
                activeOpacity={0.82}
                style={[
                  styles.orderChip,
                  {
                    backgroundColor: isSelected
                      ? palette.isDark
                        ? '#EA580C'
                        : '#141414'
                      : palette.bgMuted,
                    borderColor: isSelected
                      ? palette.isDark
                        ? '#EA580C'
                        : '#141414'
                      : cardBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.orderChipText,
                    { color: isSelected ? '#FFFFFF' : palette.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  {formatOrderCode(d.orderId)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}

      {/* Interactive Map Canvas */}
      <View
        style={[
          styles.mapBox,
          {
            borderColor: cardBorder,
            backgroundColor: palette.bgMuted,
          },
        ]}
      >
        {Platform.OS === 'web' ? (
          <iframe
            title="Rider Delivery Route Map"
            srcDoc={leafletHtml}
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        ) : (
          <WebView
            originWhitelist={['*']}
            source={{ html: leafletHtml }}
            style={styles.webView}
            javaScriptEnabled
            domStorageEnabled
            scrollEnabled={false}
          />
        )}

        {activeDelivery ? (
          <TouchableOpacity
            onPress={() => onOpenFullMap?.(activeDelivery)}
            activeOpacity={0.85}
            style={styles.expandMapBtn}
            accessibilityLabel="Expand live delivery map"
          >
            <BootstrapIcon name="arrows-fullscreen" size={11} color="#FFFFFF" />
            <Text style={styles.expandMapText}>Full map</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Bottom Action Bar */}
      {activeDelivery ? (
        <View style={styles.actionsRow}>
          <ExternalLink href={navUrl} style={{ flex: 1 }}>
            <View
              style={[
                styles.secondaryBtn,
                {
                  backgroundColor: palette.bgMuted,
                  borderColor: cardBorder,
                },
              ]}
            >
              <BootstrapIcon name="cursor-fill" size={12} color="#EA580C" />
              <Text
                style={[styles.secondaryBtnText, { color: palette.textPrimary }]}
              >
                Navigate
              </Text>
            </View>
          </ExternalLink>

          <TouchableOpacity
            onPress={() => onViewDetails?.(activeDelivery)}
            activeOpacity={0.82}
            style={[
              styles.secondaryBtn,
              {
                flex: 1,
                backgroundColor: palette.bgMuted,
                borderColor: cardBorder,
              },
            ]}
          >
            <BootstrapIcon
              name="receipt"
              size={13}
              color={palette.textPrimary}
            />
            <Text
              style={[styles.secondaryBtnText, { color: palette.textPrimary }]}
            >
              Details
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => onScanConfirm?.(activeDelivery)}
            activeOpacity={0.85}
            style={[
              styles.primaryBtn,
              {
                backgroundColor: palette.isDark ? '#EA580C' : '#141414',
              },
            ]}
          >
            <BootstrapIcon name="qr-code-scan" size={13} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>Scan</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 16,
    borderRadius: 20,
    borderWidth: 1,
    padding: 15,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  eyebrow: {
    fontFamily: RIDER_FONT,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: RIDER_FONT,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
    marginTop: 2,
  },
  subtitle: {
    fontFamily: RIDER_FONT,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  statusPillText: {
    fontFamily: RIDER_FONT,
    fontSize: 11,
    fontWeight: '600',
  },
  orderTabsRow: {
    gap: 7,
    paddingBottom: 2,
  },
  orderChip: {
    paddingHorizontal: 11,
    paddingVertical: 5.5,
    borderRadius: 9999,
    borderWidth: 1,
  },
  orderChipText: {
    fontFamily: RIDER_FONT,
    fontSize: 11.5,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  mapBox: {
    height: 200,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 12,
    position: 'relative',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  expandMapBtn: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(20, 29, 46, 0.88)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  expandMapText: {
    fontFamily: RIDER_FONT,
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  secondaryBtn: {
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
  },
  secondaryBtnText: {
    fontFamily: RIDER_FONT,
    fontSize: 12,
    fontWeight: '600',
  },
  primaryBtn: {
    minHeight: 40,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
  },
  primaryBtnText: {
    fontFamily: RIDER_FONT,
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
