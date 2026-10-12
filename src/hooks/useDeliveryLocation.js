/**
 * Subscribe to live GPS for a single order (Realtime + initial fetch).
 * Cleans up channel on unmount / order change.
 */
import { useEffect, useState } from 'react';
import { deliveryLocationService } from '../services/delivery/deliveryLocationService.js';
import { parseLatLng } from '../utils/geo.js';

export function useDeliveryLocation(orderId, { enabled = true } = {}) {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(Boolean(orderId && enabled));

  useEffect(() => {
    if (!orderId || !enabled) {
      setLocation(null);
      setLoading(false);
      return undefined;
    }

    let alive = true;
    setLoading(true);

    deliveryLocationService.getLatestForOrder(orderId).then((loc) => {
      if (!alive) return;
      setLocation(loc);
      setLoading(false);
    });

    const unsub = deliveryLocationService.subscribeToOrder(orderId, (loc) => {
      if (!alive) return;
      setLocation(loc);
      setLoading(false);
    });

    return () => {
      alive = false;
      unsub();
    };
  }, [orderId, enabled]);

  const coords = location ? parseLatLng(location.latitude, location.longitude) : null;

  return {
    location,
    loading,
    riderLat: coords?.lat ?? null,
    riderLng: coords?.lng ?? null,
    lastUpdatedAt: location?.updatedAt ?? null,
    accuracy: location?.accuracy ?? null,
    heading: location?.heading ?? null,
    speed: location?.speed ?? null,
  };
}

export default useDeliveryLocation;
