/**
 * Shared admin/customer live tracking panel: status + Leaflet map + last update.
 * Customer view should only pass their own orderId (RLS enforces ownership).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import LiveDeliveryMap from './LiveDeliveryMap.jsx';
import { useDeliveryLocation } from '../../hooks/useDeliveryLocation.js';
import { geocodeAddress, parseLatLng, STORE_LOCATION } from '../../utils/geo.js';
import { useTheme } from '../../context/ThemeContext.jsx';

export default function DeliveryTrackingPanel({
  order,
  statusOverride,
  height = 300,
  followRider = false,
  title = 'Live Delivery Tracking',
  showWhenInactive = false,
  hideHeader = false,
  hideLegend = false,
  hideFooter = false,
}) {
  const { isDarkMode } = useTheme();
  const isDark = Platform.OS === 'web' && isDarkMode;
  const orderId = order?.order_id || order?.id || order?.orderId;
  const status = statusOverride || order?.status || order?.delivery_status || 'Tracking';
  const statusLower = String(status || '').toLowerCase();
  const isActive =
    statusLower.includes('out for delivery') ||
    statusLower.includes('delivery reported') ||
    statusLower.includes('shipped') ||
    statusLower.includes('transit');

  const enabled = Boolean(orderId) && (isActive || showWhenInactive);
  const { riderLat, riderLng, lastUpdatedAt, loading } = useDeliveryLocation(orderId, { enabled });

  const storedCustomer = parseLatLng(order?.delivery_lat, order?.delivery_lng);
  const [fallbackGeoCoords, setFallbackGeoCoords] = useState(null);
  const address = order?.customer_address || order?.delivery_address || '';
  const landmark = order?.delivery_landmark || order?.delivery_notes || '';

  useEffect(() => {
    if (storedCustomer) {
      setFallbackGeoCoords(null);
      return undefined;
    }
    if (!address) {
      setFallbackGeoCoords(null);
      return undefined;
    }
    let cancelled = false;
    geocodeAddress(address).then((geo) => {
      if (!cancelled && geo) setFallbackGeoCoords({ lat: geo.lat, lng: geo.lng });
    });
    return () => {
      cancelled = true;
    };
  }, [address, storedCustomer]);

  const customerCoords = storedCustomer || fallbackGeoCoords;

  if (!orderId) return null;

  if (!enabled) {
    return (
      <View style={[styles.idleBox, isDark && styles.idleBoxDark]}>
        <Text style={[styles.idleTitle, isDark && styles.idleTitleDark]}>{title}</Text>
        <Text style={[styles.idleText, isDark && styles.idleTextDark]}>
          Live GPS starts when the rider marks this order Out for Delivery.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {!hideHeader && (
        <View style={styles.header}>
          <Text style={[styles.title, isDark && styles.titleDark]}>{title}</Text>
          <View style={[styles.badge, isDark && styles.badgeDark]}>
            <Text style={[styles.badgeText, isDark && styles.badgeTextDark]}>{status}</Text>
          </View>
        </View>
      )}

      {loading && !riderLat ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={isDark ? '#FF5A00' : '#EA580C'} />
          <Text style={[styles.loadingText, isDark && styles.loadingTextDark]}>Connecting to live GPS…</Text>
        </View>
      ) : null}

      <LiveDeliveryMap
        orderId={orderId}
        statusLabel={status}
        customerLat={customerCoords?.lat}
        customerLng={customerCoords?.lng}
        customerAddress={address}
        customerLandmark={landmark}
        storeLat={STORE_LOCATION.lat}
        storeLng={STORE_LOCATION.lng}
        storeLabel={STORE_LOCATION.name}
        riderLat={riderLat}
        riderLng={riderLng}
        lastUpdatedAt={lastUpdatedAt}
        height={height}
        followRider={followRider}
        hideFooter={hideFooter}
      />

      {!hideLegend && (
        <View style={styles.legend}>
          <Text style={[styles.legendItem, isDark && styles.legendItemDark]}>🏪 Store</Text>
          <Text style={[styles.legendItem, isDark && styles.legendItemDark]}>🛵 Rider (live)</Text>
          <Text style={[styles.legendItem, isDark && styles.legendItemDark]}>📍 Customer delivery</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  badge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#0369A1' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  idleBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  idleTitle: { fontSize: 13, fontWeight: '600', color: '#334155' },
  idleText: { fontSize: 12, color: '#64748B', fontWeight: '500', lineHeight: 17 },
  titleDark: { color: '#F5F5F5' },
  badgeDark: {
    backgroundColor: 'rgba(59, 130, 246, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
  },
  badgeTextDark: { color: '#60A5FA' },
  loadingTextDark: { color: '#A1A1AA' },
  legendItemDark: { color: '#A1A1AA' },
  idleBoxDark: {
    backgroundColor: '#202124',
    borderColor: '#303236',
  },
  idleTitleDark: { color: '#F5F5F5' },
  idleTextDark: { color: '#A1A1AA' },
});
