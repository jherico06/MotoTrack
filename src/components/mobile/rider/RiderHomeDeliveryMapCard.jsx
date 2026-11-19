import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BootstrapIcon } from '../../common/BootstrapIcon.jsx';
import DeliveryTrackingPanel from '../../common/DeliveryTrackingPanel.jsx';
import { riderGpsTrackingService } from '../../../services/delivery/riderGpsTrackingService.js';
import { parseLatLng } from '../../../utils/geo.js';
import {
  riderFont,
  cardShadowStyle,
  isNeedsPickupOrder,
} from './riderTheme.js';

/**
 * Clean map-only route card rendered at the top of the Rider Home tab,
 * showing the live road route from the rider's current GPS position to the
 * active delivery drop-off with auto-follow camera tracking.
 */
export default function RiderHomeDeliveryMapCard({
  deliveries = [],
  palette,
  riderName = 'Rider',
}) {
  const [localRiderCoords, setLocalRiderCoords] = useState(() => {
    try {
      const last = riderGpsTrackingService.getLastCoords?.();
      const parsed = parseLatLng(last?.latitude, last?.longitude);
      return parsed
        ? { lat: parsed.lat, lng: parsed.lng, updatedAt: new Date().toISOString() }
        : null;
    } catch (_e) {
      return null;
    }
  });

  const orderedDeliveries = useMemo(() => {
    const list = Array.isArray(deliveries) ? deliveries.slice() : [];
    return list.sort((a, b) => {
      const aOut =
        !isNeedsPickupOrder(a) &&
          String(a?.deliveryStatus || '').toLowerCase().includes('out')
          ? 0
          : 1;
      const bOut =
        !isNeedsPickupOrder(b) &&
          String(b?.deliveryStatus || '').toLowerCase().includes('out')
          ? 0
          : 1;
      return aOut - bOut;
    });
  }, [deliveries]);

  const activeDelivery = orderedDeliveries[0] || null;

  // Mirror in-memory device GPS ticks directly (and seed from last known GPS) so the map follows immediately without waiting for DB round-trips
  useEffect(() => {
    const activeId = activeDelivery?.orderId;
    if (!activeId) {
      setLocalRiderCoords(null);
      return undefined;
    }

    const last = riderGpsTrackingService.getLastCoords?.();
    const initialParsed = parseLatLng(last?.latitude, last?.longitude);
    setLocalRiderCoords(
      initialParsed
        ? { lat: initialParsed.lat, lng: initialParsed.lng, updatedAt: new Date().toISOString() }
        : null
    );
    const unsub = riderGpsTrackingService.subscribe((event, payload) => {
      if ((event === 'started' || event === 'location') && payload?.coords) {
        const matchesOrder =
          !payload.orderId ||
          String(payload.orderId) === String(activeId) ||
          (Array.isArray(payload.orderIds) &&
            payload.orderIds.some((oid) => String(oid) === String(activeId)));
        if (!matchesOrder) return;
        const parsed = parseLatLng(payload.coords.latitude, payload.coords.longitude);
        if (parsed) {
          setLocalRiderCoords({
            lat: parsed.lat,
            lng: parsed.lng,
            updatedAt: new Date().toISOString(),
          });
        }
      } else if (event === 'stopped') {
        const matchesStopped =
          !payload?.orderId ||
          String(payload.orderId) === String(activeId) ||
          (Array.isArray(payload.orderIds) &&
            payload.orderIds.some((oid) => String(oid) === String(activeId)));
        if (matchesStopped) {
          setLocalRiderCoords(null);
        }
      }
    });

    return unsub;
  }, [activeDelivery?.orderId]);

  const trackingOrder = useMemo(() => {
    if (!activeDelivery) return null;
    const status =
      activeDelivery.deliveryStatus || activeDelivery.rawStatus || 'Assigned';
    return {
      order_id: activeDelivery.orderId,
      id: activeDelivery.orderId,
      status,
      delivery_status: status,
      delivery_lat: activeDelivery.lat,
      delivery_lng: activeDelivery.lng,
      delivery_landmark: activeDelivery.landmark || '',
      delivery_notes: activeDelivery.landmark || '',
      customer_address: activeDelivery.customerAddress || '',
      shipping_address: activeDelivery.customerAddress || '',
      rider_name: riderName,
    };
  }, [activeDelivery, riderName]);

  const cardBg = palette.isDark ? '#1C1F23' : '#FFFFFF';
  const cardBorder = palette.isDark ? '#2B3035' : '#EDE9E0';

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
      {trackingOrder ? (
        <View
          style={[
            styles.mapBox,
            {
              backgroundColor: palette.bgMuted,
            },
          ]}
        >
          <DeliveryTrackingPanel
            key={activeDelivery.orderId}
            order={trackingOrder}
            statusOverride={trackingOrder.status}
            height={240}
            autoFollow={true}
            routeFromRider={true}
            showFollowControl={true}
            localRiderCoords={localRiderCoords}
            title="Live tracking"
            showWhenInactive={true}
            hideHeader={true}
            hideLegend={true}
            hideFooter={true}
          />
        </View>
      ) : (
        <View
          style={[
            styles.emptyMapBox,
            {
              borderColor: cardBorder,
              backgroundColor: palette.bgMuted,
            },
          ]}
        >
          <BootstrapIcon name="geo-alt" size={20} color={palette.orange} />
          <Text style={[styles.emptyMapTitle, { color: palette.textPrimary }]}>
            No active deliveries on route
          </Text>
          <Text style={[styles.emptyMapSub, { color: palette.textMuted }]}>
            New assigned or out-for-delivery orders will show their live road route here.
          </Text>
        </View>
      )}
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
    padding: 8,
  },
  mapBox: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  emptyMapBox: {
    height: 150,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyMapTitle: {
    ...riderFont('700'),
    fontSize: 14,
  },
  emptyMapSub: {
    ...riderFont('400'),
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
});
