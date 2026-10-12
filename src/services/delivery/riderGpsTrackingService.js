/**
 * Rider-side GPS watcher (expo-location).
 * Active ONLY while an order is Out for Delivery.
 * Stops on delivered / cancelled / explicit stop / leave screen.
 */
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { deliveryLocationService, GPS_UPDATE_INTERVAL_MS } from './deliveryLocationService.js';

let watchSub = null;
let activeSession = null; // { orderId, riderId, accessToken }
let lastPushAt = 0;
let listeners = new Set();

function emit(event, payload) {
  listeners.forEach((fn) => {
    try {
      fn(event, payload);
    } catch (_e) {}
  });
}

async function ensurePermissions() {
  if (Platform.OS === 'web') {
    // Browser geolocation via expo-location when available
  }
  const { status: existing } = await Location.getForegroundPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

async function pushLocation(coords) {
  if (!activeSession || !coords) return;
  const now = Date.now();
  if (now - lastPushAt < GPS_UPDATE_INTERVAL_MS - 200) return;
  lastPushAt = now;

  const res = await deliveryLocationService.upsertLocation({
    orderId: activeSession.orderId,
    riderId: activeSession.riderId,
    accessToken: activeSession.accessToken || null,
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: coords.accuracy,
    heading: coords.heading,
    speed: coords.speed,
  });

  emit('location', {
    orderId: activeSession.orderId,
    coords: {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      heading: coords.heading,
      speed: coords.speed,
    },
    result: res,
  });
}

export const riderGpsTrackingService = {
  isTracking() {
    return Boolean(activeSession && watchSub);
  },

  getActiveSession() {
    return activeSession ? { ...activeSession } : null;
  },

  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /**
   * Start GPS for one active delivery. Idempotent for same order.
   * Logged-in riders pass riderId; token dashboard passes accessToken.
   */
  async start({ orderId, riderId, accessToken = null }) {
    if (!orderId || (!riderId && !accessToken)) {
      return { success: false, error: 'orderId and riderId or accessToken required' };
    }

    if (
      activeSession?.orderId === orderId &&
      activeSession?.riderId === (riderId || null) &&
      activeSession?.accessToken === (accessToken || null) &&
      watchSub
    ) {
      return { success: true, already: true };
    }

    await this.stop({ clearDb: false });

    const granted = await ensurePermissions();
    if (!granted) {
      return {
        success: false,
        error: 'Location permission denied. Enable location to share live delivery tracking.',
      };
    }

    activeSession = {
      orderId,
      riderId: riderId || null,
      accessToken: accessToken || null,
    };
    lastPushAt = 0;

    try {
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (current?.coords) {
        await deliveryLocationService.upsertLocation({
          orderId,
          riderId: riderId || null,
          accessToken: accessToken || null,
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
          accuracy: current.coords.accuracy,
          heading: current.coords.heading,
          speed: current.coords.speed,
          force: true,
        });
        lastPushAt = Date.now();
        emit('started', { orderId, riderId, coords: current.coords });
      }

      watchSub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: GPS_UPDATE_INTERVAL_MS,
          distanceInterval: 15,
          mayShowUserSettingsDialog: true,
        },
        (pos) => {
          if (!activeSession) return;
          pushLocation(pos?.coords);
        }
      );

      return { success: true };
    } catch (e) {
      activeSession = null;
      watchSub = null;
      return { success: false, error: e?.message || 'Could not start GPS tracking' };
    }
  },

  /**
   * Stop GPS watcher. Optionally clear DB row (on delivered / cancelled).
   */
  async stop({ clearDb = true, orderId, riderId, accessToken } = {}) {
    const session = activeSession;
    if (watchSub) {
      try {
        watchSub.remove();
      } catch (_e) {}
      watchSub = null;
    }
    activeSession = null;
    lastPushAt = 0;

    const oid = orderId || session?.orderId;
    const rid = riderId || session?.riderId;
    const tok = accessToken || session?.accessToken;
    if (clearDb && oid) {
      await deliveryLocationService.clearLocation(oid, {
        riderId: rid,
        accessToken: tok || null,
      });
    }

    if (session) emit('stopped', { orderId: session.orderId, riderId: session.riderId });
    return { success: true };
  },
};

export default riderGpsTrackingService;
