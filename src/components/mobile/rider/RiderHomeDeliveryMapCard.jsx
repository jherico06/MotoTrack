import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BootstrapIcon } from '../../common/BootstrapIcon.jsx';
import DeliveryTrackingPanel from '../../common/DeliveryTrackingPanel.jsx';
import {
  riderFont,
  cardShadowStyle,
  isNeedsPickupOrder,
} from './riderTheme.js';

/**
 * Clean map-only route card rendered at the top of the Rider Home tab,
 * showing the live road route for the rider's active delivery without extra
 * header chrome or action buttons.
 */
export default function RiderHomeDeliveryMapCard({
  deliveries = [],
  palette,
  riderName = 'Rider',
}) {
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
