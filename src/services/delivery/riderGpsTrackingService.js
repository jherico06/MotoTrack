/**
 * Rider-side GPS watcher (expo-location).
 * Active ONLY while an order is Out for Delivery.
 * Stops on delivered / cancelled / explicit stop / leave screen.
 */
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { deliveryLocationService, GPS_UPDATE_INTERVAL_MS } from './deliveryLocationService.js';

let watchSub = null;
let activeSession = null; // { orderId, orderIds, riderId, accessToken }
let lastPushAt = 0;
let lastCoords = null;
let listeners = new Set();

const HIGH_GPS_ACCURACY =
  Location.Accuracy?.BestForNavigation ||
  Location.Accuracy?.Highest ||
  Location.Accuracy?.High ||
  Location.Accuracy?.Balanced;

function shouldAcceptGpsFix(prevCoords, nextCoords) {
  if (!nextCoords) return false;
  const la = Number(nextCoords.latitude);
  const ln = Number(nextCoords.longitude);
  if (!Number.isFinite(la) || !Number.isFinite(ln) || (la === 0 && ln === 0)) {
    return false;
  }
  if (!prevCoords) return true;
  const prevAcc = Number(prevCoords.accuracy);
  const nextAcc = Number(nextCoords.accuracy);
  // Reject coarse cell-tower bounces (> 120m) that are significantly less accurate than our current fix
  if (
    Number.isFinite(prevAcc) &&
    prevAcc > 0 &&
    Number.isFinite(nextAcc) &&
    nextAcc > 120 &&
    nextAcc > prevAcc * 1.15
  ) {
    return false;
  }
  return true;
}

function normalizeOrderIds(orderId, orderIds) {
  const raw = [];
  if (Array.isArray(orderIds)) raw.push(...orderIds);
  if (orderId) raw.push(orderId);
  return [...new Set(raw.map((v) => String(v || '').trim()).filter(Boolean))];
}

function sameOrderIdSet(a = [], b = []) {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((id) => setB.has(id));
}

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

async function syncCoordsToOrders(
  coords,
  session,
  { orderIds = null, force = false, eventName = 'location' } = {}
) {
  if (!session || !coords) return { results: [], syncError: null };
  const targetIds = orderIds?.length ? orderIds : session.orderIds || [];
  if (!targetIds.length) return { results: [], syncError: null };

  lastCoords = {
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: coords.accuracy,
    heading: coords.heading,
    speed: coords.speed,
  };

  const results = await Promise.all(
    targetIds.map((oid) =>
      deliveryLocationService.upsertLocation({
        orderId: oid,
        riderId: session.riderId,
        accessToken: session.accessToken || null,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        heading: coords.heading,
        speed: coords.speed,
        force,
      })
    )
  );

  const syncError =
    results.find((r) => r && r.success === false && r.error)?.error || null;

  emit(eventName, {
    orderId: session.orderId,
    orderIds: [...session.orderIds],
    coords: lastCoords,
    result: results[0] || null,
    results,
    syncError,
  });

  return { results, syncError };
}

async function pushLocation(coords) {
  if (!activeSession || !coords) return;
  if (!shouldAcceptGpsFix(lastCoords, coords)) return;
  const now = Date.now();
  const nextAcc = Number(coords.accuracy);
  const prevAcc = Number(lastCoords?.accuracy);
  const isAccuracyUpgrade =
    Number.isFinite(nextAcc) &&
    nextAcc > 0 &&
    Number.isFinite(prevAcc) &&
    prevAcc > 100 &&
    nextAcc < prevAcc * 0.7;
  if (!isAccuracyUpgrade && now - lastPushAt < GPS_UPDATE_INTERVAL_MS - 200) return;
  lastPushAt = now;
  await syncCoordsToOrders(coords, activeSession, {
    force: isAccuracyUpgrade,
    eventName: 'location',
  });
}

export const riderGpsTrackingService = {
  isTracking() {
    return Boolean(activeSession && watchSub);
  },

  getActiveSession() {
    return activeSession
      ? { ...activeSession, orderIds: [...(activeSession.orderIds || [])] }
      : null;
  },

  getLastCoords() {
    return lastCoords ? { ...lastCoords } : null;
  },

  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /**
   * Start GPS across all active Out for Delivery orders. Idempotent for same set.
   * Logged-in riders pass riderId; token dashboard passes accessToken.
   */
  async start({ orderId, orderIds, riderId, accessToken = null }) {
    const targetIds = normalizeOrderIds(orderId, orderIds);
    if (!targetIds.length || (!riderId && !accessToken)) {
      return { success: false, error: 'orderId and riderId or accessToken required' };
    }

    const normRiderId = riderId || null;
    const normToken = accessToken || null;

    if (
      watchSub &&
      activeSession &&
      activeSession.riderId === normRiderId &&
      activeSession.accessToken === normToken
    ) {
      if (sameOrderIdSet(activeSession.orderIds, targetIds)) {
        return { success: true, already: true };
      }

      const prevSet = new Set(activeSession.orderIds || []);
      const addedIds = targetIds.filter((oid) => !prevSet.has(oid));
      activeSession = {
        orderId: targetIds[0],
        orderIds: targetIds,
        riderId: normRiderId,
        accessToken: normToken,
      };
      let syncError = null;
      if (addedIds.length && lastCoords) {
        const res = await syncCoordsToOrders(lastCoords, activeSession, {
          orderIds: addedIds,
          force: true,
          eventName: 'started',
        });
        syncError = res.syncError;
        lastPushAt = Date.now();
      }
      return { success: true, updated: true, syncError };
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
      orderId: targetIds[0],
      orderIds: targetIds,
      riderId: normRiderId,
      accessToken: normToken,
    };
    lastPushAt = 0;

    try {
      let syncError = null;
      const current = await Location.getCurrentPositionAsync({
        accuracy: HIGH_GPS_ACCURACY,
      });
      if (current?.coords && shouldAcceptGpsFix(lastCoords, current.coords)) {
        const syncRes = await syncCoordsToOrders(current.coords, activeSession, {
          force: true,
          eventName: 'started',
        });
        syncError = syncRes.syncError;
        lastPushAt = Date.now();
      }

      watchSub = await Location.watchPositionAsync(
        {
          accuracy: HIGH_GPS_ACCURACY,
          timeInterval: 2500,
          distanceInterval: 3,
          mayShowUserSettingsDialog: true,
        },
        (pos) => {
          if (!activeSession) return;
          pushLocation(pos?.coords);
        }
      );

      return { success: true, syncError };
    } catch (e) {
      activeSession = null;
      watchSub = null;
      lastCoords = null;
      return { success: false, error: e?.message || 'Could not start GPS tracking' };
    }
  },

  /**
   * Stop GPS watcher (or remove one completed order when multiple orders remain active).
   */
  async stop({ clearDb = true, orderId, orderIds, riderId, accessToken } = {}) {
    const session = activeSession;
    const requestedStopIds = normalizeOrderIds(orderId, orderIds);
    const hasExplicitSubset =
      requestedStopIds.length > 0 &&
      session &&
      (session.orderIds || []).some((oid) => !requestedStopIds.includes(oid));

    if (hasExplicitSubset) {
      const stopSet = new Set(requestedStopIds);
      const remaining = (session.orderIds || []).filter((oid) => !stopSet.has(oid));
      activeSession = {
        ...session,
        orderId: remaining[0],
        orderIds: remaining,
      };
      if (clearDb) {
        await Promise.all(
          requestedStopIds.map((oid) =>
            deliveryLocationService.clearLocation(oid, {
              riderId: riderId || session.riderId,
              accessToken: accessToken || session.accessToken || null,
            })
          )
        );
      }
      return { success: true, remainingOrderIds: remaining };
    }

    if (watchSub) {
      try {
        watchSub.remove();
      } catch (_e) {}
      watchSub = null;
    }
    activeSession = null;
    lastPushAt = 0;
    lastCoords = null;

    const clearIds = requestedStopIds.length
      ? requestedStopIds
      : normalizeOrderIds(session?.orderId, session?.orderIds);
    const rid = riderId || session?.riderId;
    const tok = accessToken || session?.accessToken;
    if (clearDb && clearIds.length) {
      await Promise.all(
        clearIds.map((oid) =>
          deliveryLocationService.clearLocation(oid, {
            riderId: rid,
            accessToken: tok || null,
          })
        )
      );
    }

    if (session) {
      emit('stopped', {
        orderId: session.orderId,
        orderIds: [...(session.orderIds || [])],
        riderId: session.riderId,
      });
    }
    return { success: true };
  },
};

export default riderGpsTrackingService;
