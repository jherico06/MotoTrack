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

const HIGH_GPS_ACCURACY =
  Location.Accuracy?.BestForNavigation ||
  Location.Accuracy?.Highest ||
  Location.Accuracy?.High ||
  Location.Accuracy?.Balanced;

const OSRM_LEG_CACHE_TTL_MS = 5 * 60 * 1000;
const OSRM_MAX_CACHE_ENTRIES = 48;
const osrmLegCache = new Map();
const osrmInFlightMap = new Map();
let cachedShopLegPath = null;
let cachedLatestRiderCoords = null;

function parseRiderFix(raw) {
  if (!raw) return null;
  const parsed = parseLatLng(
    raw.lat ?? raw.latitude,
    raw.lng ?? raw.longitude
  );
  if (!parsed) return null;
  const acc = Number(raw.accuracy);
  return {
    lat: parsed.lat,
    lng: parsed.lng,
    accuracy: Number.isFinite(acc) && acc > 0 ? acc : null,
  };
}

function pickBetterRiderFix(prevFix, nextFix, { force = false } = {}) {
  if (!nextFix) return prevFix;
  if (
    !force &&
    prevFix &&
    prevFix.lat === nextFix.lat &&
    prevFix.lng === nextFix.lng &&
    prevFix.accuracy === nextFix.accuracy
  ) {
    return prevFix;
  }
  if (force || !prevFix) return nextFix;
  const prevAcc = Number(prevFix.accuracy);
  const nextAcc = Number(nextFix.accuracy);
  if (
    Number.isFinite(prevAcc) &&
    prevAcc > 0 &&
    Number.isFinite(nextAcc) &&
    nextAcc > 120 &&
    nextAcc > prevAcc * 1.15
  ) {
    return prevFix;
  }
  return nextFix;
}

function readInitialRiderCoords() {
  if (cachedLatestRiderCoords) return cachedLatestRiderCoords;
  try {
    const svcCoords = riderGpsTrackingService.getLastCoords?.();
    const parsed = parseRiderFix(svcCoords);
    if (parsed) {
      cachedLatestRiderCoords = parsed;
      return parsed;
    }
  } catch (_e) {}
  return null;
}

try {
  riderGpsTrackingService.subscribe((event, payload) => {
    if ((event === 'started' || event === 'location') && payload?.coords) {
      const parsed = parseRiderFix(payload.coords);
      if (parsed) {
        cachedLatestRiderCoords = pickBetterRiderFix(
          cachedLatestRiderCoords,
          parsed
        );
      }
    }
  });
} catch (_e) {}

function getOsrmCacheKey(from, to, avoidBacktrack) {
  return `${Number(from.lat).toFixed(4)},${Number(from.lng).toFixed(4)}>${Number(
    to.lat
  ).toFixed(4)},${Number(to.lng).toFixed(4)}:${avoidBacktrack ? 1 : 0}`;
}

function cacheOsrmLegEntry(from, to, avoidBacktrack, value) {
  if (!from || !to || !value || value.isFallback) return;
  const key = getOsrmCacheKey(from, to, avoidBacktrack);
  if (osrmLegCache.has(key)) {
    osrmLegCache.delete(key);
  }
  osrmLegCache.set(key, {
    from: { lat: Number(from.lat), lng: Number(from.lng) },
    to: { lat: Number(to.lat), lng: Number(to.lng) },
    avoidBacktrack: Boolean(avoidBacktrack),
    value,
    at: Date.now(),
  });
  while (osrmLegCache.size > OSRM_MAX_CACHE_ENTRIES) {
    const oldestKey = osrmLegCache.keys().next().value;
    if (!oldestKey) break;
    osrmLegCache.delete(oldestKey);
  }
}

function findCachedOsrmLeg(
  from,
  to,
  avoidBacktrack,
  maxOriginDriftMeters = 60,
  maxDestDriftMeters = 60
) {
  if (!from || !to) return null;
  const now = Date.now();
  const exactKey = getOsrmCacheKey(from, to, avoidBacktrack);
  const exact = osrmLegCache.get(exactKey);
  if (exact && now - exact.at < OSRM_LEG_CACHE_TTL_MS) {
    return exact.value;
  }
  const entries = Array.from(osrmLegCache.entries());
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const [entryKey, entry] = entries[i];
    if (now - entry.at >= OSRM_LEG_CACHE_TTL_MS) {
      osrmLegCache.delete(entryKey);
      continue;
    }
    if (Boolean(entry.avoidBacktrack) !== Boolean(avoidBacktrack)) continue;
    if (
      haversineMeters(entry.to, to) <= maxDestDriftMeters &&
      haversineMeters(entry.from, from) <= maxOriginDriftMeters
    ) {
      return entry.value;
    }
  }
  return null;
}

function simplifyRoutePath(path, minStepMeters = 12) {
  if (!Array.isArray(path) || path.length <= 3) return path;
  const out = [path[0]];
  let lastKept = path[0];
  for (let i = 1; i < path.length - 1; i += 1) {
    const pt = path[i];
    if (haversineMeters(lastKept, pt) >= minStepMeters) {
      out.push(pt);
      lastKept = pt;
    }
  }
  out.push(path[path.length - 1]);
  return out;
}

function pruneRouteSpurs(path) {
  if (!Array.isArray(path) || path.length < 4) return path;
  const maxLoopPts = Math.floor(path.length * 0.45);
  const out = [];
  const indexByKey = new Map();
  for (let i = 0; i < path.length; i += 1) {
    const pt = path[i];
    const key = `${pt.lat.toFixed(5)},${pt.lng.toFixed(5)}`;
    if (indexByKey.has(key)) {
      const prevIdx = indexByKey.get(key);
      if (out.length - prevIdx <= maxLoopPts) {
        while (out.length > prevIdx + 1) {
          const popped = out.pop();
          const pKey = `${popped.lat.toFixed(5)},${popped.lng.toFixed(5)}`;
          if (indexByKey.get(pKey) === out.length) {
            indexByKey.delete(pKey);
          }
        }
        continue;
      }
    }
    indexByKey.set(key, out.length);
    out.push(pt);
  }
  return out;
}

function polylineDistanceMeters(path) {
  if (!Array.isArray(path) || path.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < path.length; i += 1) {
    total += haversineMeters(path[i - 1], path[i]);
  }
  return total;
}

function minDistanceToStore(path) {
  if (!Array.isArray(path) || path.length === 0) return Infinity;
  let min = Infinity;
  for (let i = 0; i < path.length; i += 1) {
    const d = haversineMeters(path[i], STORE_LOCATION);
    if (d < min) min = d;
  }
  return min;
}

function computeShopOverlapRatio(path, shopPath) {
  if (
    !Array.isArray(shopPath) ||
    shopPath.length < 2 ||
    !Array.isArray(path) ||
    path.length < 2
  ) {
    return 0;
  }
  let overlapped = 0;
  let total = 0;
  for (let i = 1; i < path.length; i += 1) {
    const seg = haversineMeters(path[i - 1], path[i]);
    total += seg;
    const p = path[i];
    let near = false;
    for (let j = 0; j < shopPath.length; j += 2) {
      if (
        Math.abs(p.lat - shopPath[j].lat) < 0.0012 &&
        Math.abs(p.lng - shopPath[j].lng) < 0.0012 &&
        haversineMeters(p, shopPath[j]) < 100
      ) {
        near = true;
        break;
      }
    }
    if (near) overlapped += seg;
  }
  return total > 0 ? overlapped / total : 0;
}

async function fetchOsrmJson(url, parentSignal, timeoutMs = 3800) {
  const controller =
    typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timer = null;
  const onParentAbort = () => {
    try {
      controller?.abort();
    } catch (_e) {}
  };
  if (parentSignal) {
    if (parentSignal.aborted) return null;
    try {
      parentSignal.addEventListener('abort', onParentAbort, { once: true });
    } catch (_e) {}
  }
  if (controller) {
    timer = setTimeout(() => {
      try {
        controller.abort();
      } catch (_e) {}
    }, timeoutMs);
  }
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      ...(controller
        ? { signal: controller.signal }
        : parentSignal
          ? { signal: parentSignal }
          : {}),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.code === 'Ok' && Array.isArray(data?.routes) ? data.routes : null;
  } catch (err) {
    if (parentSignal?.aborted) throw err;
    return null;
  } finally {
    if (timer) clearTimeout(timer);
    if (parentSignal) {
      try {
        parentSignal.removeEventListener('abort', onParentAbort);
      } catch (_e) {}
    }
  }
}

function selectBestOsrmRoute(
  rawRoutes,
  from,
  to,
  shouldCheckMidpoint,
  shopPath,
  fallbackDist,
  fallbackDuration
) {
  let bestCandidate = null;
  const checkStorePass =
    shouldCheckMidpoint &&
    haversineMeters(from, STORE_LOCATION) > 600 &&
    haversineMeters(to, STORE_LOCATION) > 600;

  for (let i = 0; i < rawRoutes.length; i += 1) {
    const route = rawRoutes[i];
    const coords = route?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const rawPath = coords
      .map(([lng, lat]) => ({ lat: Number(lat), lng: Number(lng) }))
      .filter((p) => parseLatLng(p.lat, p.lng));
    if (rawPath.length < 2) continue;
    const path = shouldCheckMidpoint ? pruneRouteSpurs(rawPath) : rawPath;
    if (path.length < 2) continue;

    const polyDist = polylineDistanceMeters(path);
    const rawDist = Number(route.distance) || polyDist || fallbackDist;
    const dist = polyDist > 0 ? polyDist : rawDist;
    const rawDur = Number(route.duration) || fallbackDuration;
    const dur = Math.max(
      60,
      Math.round(rawDur * Math.min(1, dist / Math.max(1, rawDist)))
    );

    let score = dist;
    if (shouldCheckMidpoint) {
      const minStore = checkStorePass ? minDistanceToStore(path) : Infinity;
      const storePassPenalty = minStore < 550 ? 0.35 : 0;
      const overlap = computeShopOverlapRatio(
        path,
        shopPath || cachedShopLegPath
      );
      score = dist * (1 + Math.max(storePassPenalty, overlap * 0.45));
    }

    if (!bestCandidate || score < bestCandidate.score) {
      bestCandidate = {
        path: simplifyRoutePath(path, 12),
        distanceMeters: Math.round(dist) || fallbackDist,
        durationSeconds: dur || fallbackDuration,
        isFallback: false,
        score,
      };
    }
  }
  return bestCandidate;
}

function toPublicOsrmResult(candidate) {
  return {
    path: candidate.path,
    distanceMeters: candidate.distanceMeters,
    durationSeconds: candidate.durationSeconds,
    isFallback: false,
  };
}

async function fetchOsrmLeg(from, to, signal, options = {}) {
  const shouldCheckMidpoint =
    Boolean(options?.avoidShopBacktrack) &&
    haversineMeters(from, STORE_LOCATION) > 150 &&
    haversineMeters(from, to) > 350;

  const cached = findCachedOsrmLeg(
    from,
    to,
    shouldCheckMidpoint,
    options?.maxOriginDriftMeters ?? 60,
    options?.maxDestDriftMeters ?? 60
  );
  if (cached) {
    return cached;
  }

  const cacheKey = getOsrmCacheKey(from, to, shouldCheckMidpoint);
  const fallbackDist = haversineMeters(from, to);
  const fallbackDuration = Math.max(
    120,
    Math.round((fallbackDist / 1000 / 28) * 3600)
  );

  let entry = osrmInFlightMap.get(cacheKey);
  if (!entry) {
    const abortCtrl =
      typeof AbortController !== 'undefined' ? new AbortController() : null;
    const newEntry = {
      abortCtrl,
      waiters: 0,
      onInterims: new Set(),
      lastInterim: null,
      bestInterimScore: Infinity,
      promise: null,
    };

    const collectedRawRoutes = [];
    const shopPathRef = options?.shopPath || cachedShopLegPath;
    const directUrl =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${from.lng},${from.lat};${to.lng},${to.lat}` +
      `?overview=full&geometries=geojson&alternatives=3&steps=false`;

    const handleSubRoutes = (routes) => {
      if (!Array.isArray(routes) || routes.length === 0) return;
      collectedRawRoutes.push(...routes);
      const interim = selectBestOsrmRoute(
        collectedRawRoutes,
        from,
        to,
        shouldCheckMidpoint,
        shopPathRef,
        fallbackDist,
        fallbackDuration
      );
      if (interim && interim.score < newEntry.bestInterimScore) {
        newEntry.bestInterimScore = interim.score;
        newEntry.lastInterim = toPublicOsrmResult(interim);
        newEntry.onInterims.forEach((cb) => {
          try {
            cb(newEntry.lastInterim);
          } catch (_e) {}
        });
      }
    };

    const requests = [
      fetchOsrmJson(directUrl, abortCtrl?.signal, 3500).then(handleSubRoutes),
    ];

    if (shouldCheckMidpoint) {
      const rawMid = {
        lat: (from.lat + to.lat) / 2,
        lng: (from.lng + to.lng) / 2,
      };
      let viaPt = rawMid;
      if (haversineMeters(rawMid, STORE_LOCATION) < 2500) {
        const dx = rawMid.lng - STORE_LOCATION.lng;
        const dy = rawMid.lat - STORE_LOCATION.lat;
        const len = Math.hypot(dx, dy) || 1;
        viaPt = {
          lat: rawMid.lat + (dy / len) * 0.008,
          lng: rawMid.lng + (dx / len) * 0.008,
        };
      }
      const viaUrl =
        `https://router.project-osrm.org/route/v1/driving/` +
        `${from.lng},${from.lat};${viaPt.lng},${viaPt.lat};${to.lng},${to.lat}` +
        `?overview=full&geometries=geojson&steps=false`;
      requests.push(
        fetchOsrmJson(viaUrl, abortCtrl?.signal, 2200).then(handleSubRoutes)
      );
    }

    newEntry.promise = (async () => {
      try {
        const settled = await Promise.allSettled(requests);
        for (let i = 0; i < settled.length; i += 1) {
          if (
            settled[i].status === 'rejected' &&
            settled[i].reason?.name === 'AbortError'
          ) {
            throw settled[i].reason;
          }
        }
        const bestCandidate = selectBestOsrmRoute(
          collectedRawRoutes,
          from,
          to,
          shouldCheckMidpoint,
          shopPathRef,
          fallbackDist,
          fallbackDuration
        );
        if (bestCandidate) {
          const result = toPublicOsrmResult(bestCandidate);
          cacheOsrmLegEntry(from, to, shouldCheckMidpoint, result);
          return result;
        }
        return {
          path: [from, to],
          distanceMeters: fallbackDist,
          durationSeconds: fallbackDuration,
          isFallback: true,
        };
      } finally {
        if (osrmInFlightMap.get(cacheKey) === newEntry) {
          osrmInFlightMap.delete(cacheKey);
        }
      }
    })();

    entry = newEntry;
    osrmInFlightMap.set(cacheKey, entry);
  }

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      const abortErr = new Error('Aborted');
      abortErr.name = 'AbortError';
      reject(abortErr);
      return;
    }

    entry.waiters += 1;
    const interimCb =
      typeof options?.onInterim === 'function' ? options.onInterim : null;
    if (interimCb) {
      entry.onInterims.add(interimCb);
      if (entry.lastInterim) {
        try {
          interimCb(entry.lastInterim);
        } catch (_e) {}
      }
    }

    let done = false;
    const detach = () => {
      if (interimCb) entry.onInterims.delete(interimCb);
      if (signal) {
        try {
          signal.removeEventListener('abort', onAbort);
        } catch (_e) {}
      }
    };

    const onAbort = () => {
      if (done) return;
      done = true;
      detach();
      entry.waiters = Math.max(0, entry.waiters - 1);
      if (entry.waiters <= 0) {
        try {
          entry.abortCtrl?.abort();
        } catch (_e) {}
        if (osrmInFlightMap.get(cacheKey) === entry) {
          osrmInFlightMap.delete(cacheKey);
        }
      }
      const abortErr = new Error('Aborted');
      abortErr.name = 'AbortError';
      reject(abortErr);
    };

    if (signal) {
      try {
        signal.addEventListener('abort', onAbort, { once: true });
      } catch (_e) {}
    }

    entry.promise.then(
      (res) => {
        if (done) return;
        done = true;
        entry.waiters = Math.max(0, entry.waiters - 1);
        detach();
        resolve(res);
      },
      (err) => {
        if (done) return;
        done = true;
        entry.waiters = Math.max(0, entry.waiters - 1);
        detach();
        reject(err);
      }
    );
  });
}

/**
 * Quietly pre-warm Shop -> Rider and Rider -> Customer OSRM legs into memory
 * cache when a rider inspects an order or taps Track Customer so the map shows
 * road polylines & ETA immediately without waiting on network round-trips.
 */
export async function prefetchRiderOrderRoute(delivery) {
  try {
    const dest = parseLatLng(delivery?.lat, delivery?.lng);
    if (!dest) return;
    let rider = readInitialRiderCoords();
    if (!rider) {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm?.status === 'granted') {
          const last = await Location.getLastKnownPositionAsync({
            maxAge: 180000,
            requiredAccuracy: 250,
          });
          const parsed = parseRiderFix(last?.coords);
          if (parsed) {
            cachedLatestRiderCoords = pickBetterRiderFix(
              cachedLatestRiderCoords,
              parsed
            );
            rider = cachedLatestRiderCoords;
          }
        }
      } catch (_e) {}
    }

    if (rider) {
      const jobs = [];
      if (haversineMeters(STORE_LOCATION, rider) >= 25) {
        jobs.push(
          fetchOsrmLeg(STORE_LOCATION, rider, null)
            .then((res) => {
              if (!res?.isFallback && Array.isArray(res?.path) && res.path.length >= 2) {
                cachedShopLegPath = res.path;
              }
            })
            .catch(() => {})
        );
      }
      jobs.push(
        fetchOsrmLeg(rider, dest, null, {
          avoidShopBacktrack: true,
          shopPath: cachedShopLegPath,
        }).catch(() => {})
      );
      await Promise.allSettled(jobs);
    } else {
      await fetchOsrmLeg(STORE_LOCATION, dest, null).catch(() => {});
    }
  } catch (_e) {}
}

function escapeHtmlJs(str) {
  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, ' ');
}

function buildRiderRouteHtml({
  store,
  rider,
  customer,
  storeLabel,
  riderLabel,
  customerLabel,
  orderId = 'track',
  initialFollow = true,
  initialShopRoute = null,
  initialShopIsFallback = false,
  initialRoute = null,
  initialRouteIsFallback = false,
}) {
  const sLat = store?.lat ?? STORE_LOCATION.lat;
  const sLng = store?.lng ?? STORE_LOCATION.lng;
  const cLat = customer?.lat ?? sLat;
  const cLng = customer?.lng ?? sLng;
  const rLat = rider?.lat;
  const rLng = rider?.lng;
  const hasRider = Number.isFinite(rLat) && Number.isFinite(rLng);
  const safeOrderId = escapeHtmlJs(orderId || 'track');
  const safeStoreLabel = escapeHtmlJs(storeLabel || store?.name || STORE_LOCATION.name);
  const startFollow = Boolean(initialFollow);
  const shopRouteSeed =
    Array.isArray(initialShopRoute) && initialShopRoute.length >= 2
      ? JSON.stringify(
          initialShopRoute.map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }))
        )
      : 'null';
  const routeSeed =
    Array.isArray(initialRoute) && initialRoute.length >= 2
      ? JSON.stringify(
          initialRoute.map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }))
        )
      : 'null';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="preconnect" href="https://unpkg.com" crossorigin />
  <link rel="preconnect" href="https://tile.openstreetmap.org" crossorigin />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #E8EEF2; }
    .leaflet-control-attribution { font-size: 9px !important; }
    .store-pin-wrap {
      position: relative; width: 34px; height: 34px;
      display: flex; align-items: center; justify-content: center;
    }
    .store-pin-core {
      width: 30px; height: 30px; border-radius: 50%;
      background: #EA580C; color: #FFFFFF;
      border: 2.5px solid #FFFFFF;
      box-shadow: 0 3px 10px rgba(234, 88, 12, 0.42);
      display: flex; align-items: center; justify-content: center;
      font-size: 15px;
    }
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

    var shopDashPane = map.createPane('shopDashPane');
    shopDashPane.style.zIndex = 425;
    shopDashPane.style.pointerEvents = 'none';

    var storeIcon = L.divIcon({
      className: '',
      html: '<div class="store-pin-wrap"><div class="store-pin-core">🏪</div></div>',
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });

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

    var MAP_ORDER_ID = '${safeOrderId}';
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
    var riderMarker = null;
    var customerMarker = null;
    var shopRouteOuter = null;
    var shopRouteInner = null;
    var routeOuter = null;
    var routeInner = null;
    var lastShopRouteSig = '';
    var lastRouteSig = '';
    var hasFitted = false;
    var userInteracted = false;
    var ignoreMoveUntil = 0;
    var followRider = ${startFollow ? 'true' : 'false'};

    function computeRouteSig(coords, isFallback) {
      if (!Array.isArray(coords) || coords.length < 2) return '';
      var first = coords[0];
      var mid = coords[Math.floor(coords.length / 2)];
      var last = coords[coords.length - 1];
      return [
        coords.length,
        Number(first.lat).toFixed(4),
        Number(first.lng).toFixed(4),
        Number(mid.lat).toFixed(4),
        Number(mid.lng).toFixed(4),
        Number(last.lat).toFixed(4),
        Number(last.lng).toFixed(4),
        isFallback ? 1 : 0
      ].join(':');
    }

    map.on('zoomstart', function () {
      hasFitted = true;
      if (Date.now() > ignoreMoveUntil) userInteracted = true;
    });
    map.on('dragstart', function () {
      hasFitted = true;
      userInteracted = true;
      if (followRider) {
        followRider = false;
        notifyHost({ type: 'followPaused' });
      }
    });

    function setStore(lat, lng, label) {
      if (!isFinite(lat) || !isFinite(lng)) return;
      if (!storeMarker) {
        storeMarker = L.marker([lat, lng], { icon: storeIcon, zIndexOffset: 300 }).addTo(map);
      } else {
        storeMarker.setLatLng([lat, lng]);
      }
      if (label) storeMarker.bindPopup(label);
      if ((!followRider || !riderMarker) && !userInteracted) fitIfNeeded();
    }

    function setCustomer(lat, lng, label) {
      if (!isFinite(lat) || !isFinite(lng)) return;
      if (!customerMarker) {
        customerMarker = L.marker([lat, lng], { icon: customerIcon, zIndexOffset: 400 }).addTo(map);
      } else {
        customerMarker.setLatLng([lat, lng]);
      }
      if (label) customerMarker.bindPopup(label);
      if ((!followRider || !riderMarker) && !userInteracted) fitIfNeeded();
    }

    function setRider(lat, lng, label, smooth) {
      if (!isFinite(lat) || !isFinite(lng)) return;
      var isFirstRiderPin = !riderMarker;
      if (!riderMarker) {
        riderMarker = L.marker([lat, lng], { icon: riderIcon, zIndexOffset: 600 }).addTo(map);
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
        if (isFirstRiderPin || (map.getZoom() || 0) < 14) {
          ignoreMoveUntil = Date.now() + 450;
          map.setView([lat, lng], Math.max(map.getZoom() || 15, 15), { animate: !isFirstRiderPin });
        } else {
          map.panTo([lat, lng], { animate: true, duration: 0.4 });
        }
        hasFitted = true;
      } else if (!userInteracted) {
        fitIfNeeded();
      }
    }

    function setShopRoute(coords, isFallback) {
      if (!Array.isArray(coords) || coords.length < 2) {
        lastShopRouteSig = '';
        if (shopRouteOuter) { map.removeLayer(shopRouteOuter); shopRouteOuter = null; }
        if (shopRouteInner) { map.removeLayer(shopRouteInner); shopRouteInner = null; }
        return;
      }
      var nextSig = computeRouteSig(coords, isFallback);
      if (nextSig && nextSig === lastShopRouteSig && shopRouteInner) return;

      var latLngs = coords
        .map(function (p) { return [Number(p.lat), Number(p.lng)]; })
        .filter(function (p) { return isFinite(p[0]) && isFinite(p[1]); });
      if (latLngs.length < 2) return;
      lastShopRouteSig = nextSig;

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
        pane: 'shopDashPane',
        color: '#EA580C',
        weight: 3.5,
        opacity: 0.96,
        dashArray: isFallback ? '6, 8' : '6, 7',
        lineJoin: 'round',
        lineCap: 'round'
      }).addTo(map);

      if ((!followRider || !riderMarker) && !userInteracted) {
        hasFitted = false;
        fitIfNeeded();
      }
    }

    function setRoute(coords, isFallback) {
      if (!Array.isArray(coords) || coords.length < 2) {
        lastRouteSig = '';
        if (routeOuter) { map.removeLayer(routeOuter); routeOuter = null; }
        if (routeInner) { map.removeLayer(routeInner); routeInner = null; }
        return;
      }
      var nextSig = computeRouteSig(coords, isFallback);
      if (nextSig && nextSig === lastRouteSig && routeInner) return;

      var latLngs = coords
        .map(function (p) { return [Number(p.lat), Number(p.lng)]; })
        .filter(function (p) { return isFinite(p[0]) && isFinite(p[1]); });
      if (latLngs.length < 2) return;
      lastRouteSig = nextSig;

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

      if ((!followRider || !riderMarker) && !userInteracted) {
        hasFitted = false;
        fitIfNeeded();
      }
    }

    function fitIfNeeded() {
      if (hasFitted) return;
      var bounds = L.latLngBounds([]);
      if (storeMarker) bounds.extend(storeMarker.getLatLng());
      if (riderMarker) bounds.extend(riderMarker.getLatLng());
      if (customerMarker) bounds.extend(customerMarker.getLatLng());
      if (shopRouteInner) {
        try { bounds.extend(shopRouteInner.getBounds()); } catch (e) {}
      }
      if (routeInner) {
        try { bounds.extend(routeInner.getBounds()); } catch (e) {}
      }
      if (!bounds.isValid()) return;
      ignoreMoveUntil = Date.now() + 450;
      if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
        map.setView(bounds.getCenter(), 15);
      } else {
        map.fitBounds(bounds.pad(0.18), { maxZoom: 16, padding: [26, 26] });
      }
      hasFitted = true;
    }

    function setFollow(v) {
      followRider = !!v;
      if (followRider && riderMarker) {
        userInteracted = false;
        hasFitted = true;
        ignoreMoveUntil = Date.now() + 450;
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

    setStore(${sLat}, ${sLng}, '${safeStoreLabel}');
    ${hasRider ? `setRider(${rLat}, ${rLng}, '${escapeHtmlJs(riderLabel)}', false);` : ''}
    ${customer ? `setCustomer(${cLat}, ${cLng}, '${escapeHtmlJs(customerLabel)}');` : `ignoreMoveUntil = Date.now() + 450; map.setView([${hasRider ? rLat : sLat}, ${hasRider ? rLng : sLng}], 15);`}
    if (${shopRouteSeed}) setShopRoute(${shopRouteSeed}, ${Boolean(initialShopIsFallback)});
    if (${routeSeed}) setRoute(${routeSeed}, ${Boolean(initialRouteIsFallback)});

    function handleMsg(ev) {
      try {
        var data = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
        if (!data || !data.type) return;
        if (data.type === 'store') setStore(data.lat, data.lng, data.label);
        if (data.type === 'rider') setRider(data.lat, data.lng, data.label, data.smooth !== false);
        if (data.type === 'customer') setCustomer(data.lat, data.lng, data.label);
        if (data.type === 'shopRoute') setShopRoute(data.coords || [], Boolean(data.isFallback));
        if (data.type === 'route') setRoute(data.coords || [], Boolean(data.isFallback));
        if (data.type === 'follow') setFollow(data.value);
        if (data.type === 'fit') { followRider = false; userInteracted = false; hasFitted = false; fitIfNeeded(); }
      } catch (e) {}
    }

    window.__handleHostMsg = function (raw) {
      handleMsg({ data: raw });
    };
    window.addEventListener('message', handleMsg);
    document.addEventListener('message', handleMsg);
    notifyHost({ type: 'mapReady' });
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
  const shopLegRef = useRef({
    controller: null,
    inFlightOrigin: null,
    completedOrigin: null,
    completedIsFallback: false,
    lastFailedAt: 0,
    lastFailedOrigin: null,
  });
  const custLegRef = useRef({
    controller: null,
    inFlightKey: null,
    inFlightOrigin: null,
    completedKey: null,
    completedOrigin: null,
    completedIsFallback: false,
    lastFailedAt: 0,
    lastFailedKey: null,
    lastFailedOrigin: null,
    deferTimer: null,
  });
  const watchSubRef = useRef(null);

  const [mapLoading, setMapLoading] = useState(true);
  const [followRider, setFollowRider] = useState(true);
  const [gpsStatus, setGpsStatus] = useState(() =>
    readInitialRiderCoords() ? 'live' : 'locating'
  ); // 'locating' | 'live' | 'denied' | 'unavailable'
  const [riderCoords, setRiderCoords] = useState(() => readInitialRiderCoords());
  const [geocodedDest, setGeocodedDest] = useState(null);
  const [geocodingDest, setGeocodingDest] = useState(false);
  const [shopRouteState, setShopRouteState] = useState({
    path: null,
    isFallback: false,
  });
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
      webRef.current.injectJavaScript(
        `try{if(window.__handleHostMsg){window.__handleHostMsg(${JSON.stringify(
          msg
        )});}else{window.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(
          msg
        )}}));}}catch(e){};true;`
      );
    }
  }, []);

  // Resolve customer pin when order lacks stored lat/lng
  useEffect(() => {
    setGeocodedDest(null);
    if (!visible || !delivery) {
      setGeocodingDest(false);
      return undefined;
    }
    if (storedDest) {
      setGeocodingDest(false);
      return undefined;
    }
    const addr = String(delivery?.customerAddress || '').trim();
    if (!addr) {
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
        accuracy: HIGH_GPS_ACCURACY,
      });
      const parsed = parseRiderFix(current?.coords);
      if (parsed) {
        cachedLatestRiderCoords = parsed;
        setRiderCoords(parsed);
        setGpsStatus('live');
      }
    } catch (_e) {
      setGpsStatus((prev) => (prev === 'live' ? prev : 'unavailable'));
    }
  }, [visible, riderCoords]);

  // Live GPS watcher + warm route cache hydration while tracking screen is open
  useEffect(() => {
    const resetControllers = () => {
      try {
        shopLegRef.current.controller?.abort();
      } catch (_e) {}
      shopLegRef.current = {
        controller: null,
        inFlightOrigin: null,
        completedOrigin: null,
        completedIsFallback: false,
        lastFailedAt: 0,
        lastFailedOrigin: null,
      };
      if (custLegRef.current.deferTimer) {
        clearTimeout(custLegRef.current.deferTimer);
      }
      try {
        custLegRef.current.controller?.abort();
      } catch (_e) {}
      custLegRef.current = {
        controller: null,
        inFlightKey: null,
        inFlightOrigin: null,
        completedKey: null,
        completedOrigin: null,
        completedIsFallback: false,
        lastFailedAt: 0,
        lastFailedKey: null,
        lastFailedOrigin: null,
        deferTimer: null,
      };
    };

    mapReadyRef.current = false;
    resetControllers();

    if (!visible) {
      setFollowRider(true);
      setShopRouteState({ path: null, isFallback: false });
      setRouteState({
        path: null,
        distanceMeters: 0,
        durationSeconds: 0,
        isFallback: false,
      });
      return undefined;
    }

    setFollowRider(true);
    const seedCoords = readInitialRiderCoords();
    if (seedCoords) {
      setRiderCoords((prev) => pickBetterRiderFix(prev, seedCoords));
      setGpsStatus('live');
    }

    const cachedShop = seedCoords
      ? haversineMeters(STORE_LOCATION, seedCoords) < 25
        ? { path: [STORE_LOCATION, seedCoords], isFallback: false }
        : findCachedOsrmLeg(STORE_LOCATION, seedCoords, false, 60, 60)
      : null;
    if (cachedShop && Array.isArray(cachedShop.path) && cachedShop.path.length >= 2) {
      if (!cachedShop.isFallback) {
        cachedShopLegPath = cachedShop.path;
        shopLegRef.current.completedOrigin = {
          lat: seedCoords.lat,
          lng: seedCoords.lng,
        };
      }
      setShopRouteState({ path: cachedShop.path, isFallback: cachedShop.isFallback });
    } else {
      setShopRouteState({ path: null, isFallback: false });
    }

    const initialDest = parseLatLng(delivery?.lat, delivery?.lng);
    const initialOrigin = seedCoords || STORE_LOCATION;
    const cachedCust = initialDest
      ? findCachedOsrmLeg(initialOrigin, initialDest, Boolean(seedCoords), 60, 30)
      : null;
    if (cachedCust && Array.isArray(cachedCust.path) && cachedCust.path.length >= 2) {
      custLegRef.current.completedKey = `${initialDest.lat.toFixed(6)},${initialDest.lng.toFixed(6)}:${seedCoords ? 1 : 0}`;
      custLegRef.current.completedOrigin = {
        lat: initialOrigin.lat,
        lng: initialOrigin.lng,
      };
      custLegRef.current.completedIsFallback = Boolean(cachedCust.isFallback);
      setRouteState(cachedCust);
    } else {
      setRouteState({
        path: null,
        distanceMeters: 0,
        durationSeconds: 0,
        isFallback: false,
      });
    }

    let alive = true;
    setMapLoading(true);

    const applyFix = (rawFix) => {
      if (!alive || !rawFix) return;
      cachedLatestRiderCoords = pickBetterRiderFix(
        cachedLatestRiderCoords,
        rawFix
      );
      setRiderCoords((prev) => pickBetterRiderFix(prev, rawFix));
      setGpsStatus('live');
    };

    const unsubGps = riderGpsTrackingService.subscribe((event, payload) => {
      if (!alive) return;
      if ((event === 'started' || event === 'location') && payload?.coords) {
        applyFix(parseRiderFix(payload.coords));
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

        try {
          const lastKnown = await Location.getLastKnownPositionAsync({
            maxAge: 180000,
            requiredAccuracy: 250,
          });
          if (alive && lastKnown?.coords) {
            applyFix(parseRiderFix(lastKnown.coords));
          }
        } catch (_e) {}

        // Acquire initial high-accuracy fix in parallel so watchPositionAsync starts immediately
        Location.getCurrentPositionAsync({
          accuracy: HIGH_GPS_ACCURACY,
        })
          .then((currentPos) => {
            if (alive && currentPos?.coords) {
              applyFix(parseRiderFix(currentPos.coords));
            }
          })
          .catch(() => {});

        const sub = await Location.watchPositionAsync(
          {
            accuracy: HIGH_GPS_ACCURACY,
            timeInterval: 2000,
            distanceInterval: 2,
          },
          (pos) => {
            if (!alive) return;
            applyFix(parseRiderFix(pos?.coords));
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
      resetControllers();
      if (watchSubRef.current) {
        try {
          watchSubRef.current.remove();
        } catch (_e) {}
        watchSubRef.current = null;
      }
    };
  }, [visible, delivery?.orderId, delivery?.lat, delivery?.lng]);

  // Fetch OSRM road route for Leg 1: Shop (STORE_LOCATION) -> current rider position.
  // Never abort an in-flight OSRM call for micro GPS jitter (< 40m).
  useEffect(() => {
    if (!visible || !riderCoords) {
      try {
        shopLegRef.current.controller?.abort();
      } catch (_e) {}
      shopLegRef.current.controller = null;
      shopLegRef.current.inFlightOrigin = null;
      return undefined;
    }

    const distFromShop = haversineMeters(STORE_LOCATION, riderCoords);
    if (distFromShop < 25) {
      try {
        shopLegRef.current.controller?.abort();
      } catch (_e) {}
      shopLegRef.current.controller = null;
      shopLegRef.current.inFlightOrigin = null;
      shopLegRef.current.completedOrigin = {
        lat: riderCoords.lat,
        lng: riderCoords.lng,
      };
      shopLegRef.current.completedIsFallback = false;
      setShopRouteState({ path: [STORE_LOCATION, riderCoords], isFallback: false });
      return undefined;
    }

    const ctrlState = shopLegRef.current;
    if (
      !ctrlState.completedIsFallback &&
      ctrlState.completedOrigin &&
      haversineMeters(ctrlState.completedOrigin, riderCoords) < 40
    ) {
      return undefined;
    }

    const cachedHit = findCachedOsrmLeg(STORE_LOCATION, riderCoords, false, 60, 60);
    if (cachedHit && !cachedHit.isFallback) {
      try {
        ctrlState.controller?.abort();
      } catch (_e) {}
      ctrlState.controller = null;
      ctrlState.inFlightOrigin = null;
      ctrlState.completedOrigin = { lat: riderCoords.lat, lng: riderCoords.lng };
      ctrlState.completedIsFallback = false;
      cachedShopLegPath = cachedHit.path;
      setShopRouteState({ path: cachedHit.path, isFallback: false });
      return undefined;
    }

    if (
      ctrlState.controller &&
      ctrlState.inFlightOrigin &&
      haversineMeters(ctrlState.inFlightOrigin, riderCoords) < 40
    ) {
      return undefined;
    }

    if (
      ctrlState.lastFailedAt &&
      Date.now() - ctrlState.lastFailedAt < 5000 &&
      ctrlState.lastFailedOrigin &&
      haversineMeters(ctrlState.lastFailedOrigin, riderCoords) < 40
    ) {
      return undefined;
    }

    try {
      ctrlState.controller?.abort();
    } catch (_e) {}

    const controller =
      typeof AbortController !== 'undefined' ? new AbortController() : null;
    ctrlState.controller = controller;
    ctrlState.inFlightOrigin = { lat: riderCoords.lat, lng: riderCoords.lng };

    fetchOsrmLeg(STORE_LOCATION, riderCoords, controller?.signal)
      .then((res) => {
        if (shopLegRef.current.controller !== controller) return;
        shopLegRef.current.controller = null;
        shopLegRef.current.inFlightOrigin = null;
        if (!res.isFallback && Array.isArray(res.path) && res.path.length >= 2) {
          cachedShopLegPath = res.path;
          shopLegRef.current.completedOrigin = {
            lat: riderCoords.lat,
            lng: riderCoords.lng,
          };
          shopLegRef.current.completedIsFallback = false;
        } else {
          shopLegRef.current.lastFailedAt = Date.now();
          shopLegRef.current.lastFailedOrigin = {
            lat: riderCoords.lat,
            lng: riderCoords.lng,
          };
        }
        setShopRouteState({ path: res.path, isFallback: res.isFallback });
      })
      .catch((err) => {
        if (
          err?.name === 'AbortError' ||
          shopLegRef.current.controller !== controller
        ) {
          return;
        }
        shopLegRef.current.controller = null;
        shopLegRef.current.inFlightOrigin = null;
        shopLegRef.current.lastFailedAt = Date.now();
        shopLegRef.current.lastFailedOrigin = {
          lat: riderCoords.lat,
          lng: riderCoords.lng,
        };
        setShopRouteState({
          path: [STORE_LOCATION, riderCoords],
          isFallback: true,
        });
      });

    return undefined;
  }, [visible, delivery?.orderId, riderCoords]);

  // Fetch live OSRM road route for Leg 2: current rider position (or Shop) -> customer destination.
  // Never abort an in-flight OSRM call for micro GPS jitter (< 40m).
  useEffect(() => {
    const legState = custLegRef.current;

    if (!visible || !customerCoords || !effectiveOrigin) {
      if (legState.deferTimer) {
        clearTimeout(legState.deferTimer);
        legState.deferTimer = null;
      }
      try {
        legState.controller?.abort();
      } catch (_e) {}
      legState.controller = null;
      legState.inFlightKey = null;
      legState.inFlightOrigin = null;
      return undefined;
    }

    const hasRider = Boolean(riderCoords);
    const destKey = `${customerCoords.lat.toFixed(6)},${customerCoords.lng.toFixed(6)}:${hasRider ? 1 : 0}`;
    const waitForInitialGps = !hasRider && gpsStatus === 'locating';

    if (!waitForInitialGps && legState.deferTimer) {
      clearTimeout(legState.deferTimer);
      legState.deferTimer = null;
    }

    if (
      !legState.completedIsFallback &&
      legState.completedKey === destKey &&
      legState.completedOrigin &&
      haversineMeters(legState.completedOrigin, effectiveOrigin) < 40
    ) {
      return undefined;
    }

    const cachedHit = findCachedOsrmLeg(
      effectiveOrigin,
      customerCoords,
      hasRider,
      60,
      30
    );
    if (cachedHit && !cachedHit.isFallback) {
      if (legState.deferTimer) {
        clearTimeout(legState.deferTimer);
        legState.deferTimer = null;
      }
      try {
        legState.controller?.abort();
      } catch (_e) {}
      legState.controller = null;
      legState.inFlightKey = null;
      legState.inFlightOrigin = null;
      legState.completedKey = destKey;
      legState.completedOrigin = {
        lat: effectiveOrigin.lat,
        lng: effectiveOrigin.lng,
      };
      legState.completedIsFallback = false;
      setRouteState(cachedHit);
      return undefined;
    }

    if (
      legState.controller &&
      legState.inFlightKey === destKey &&
      legState.inFlightOrigin &&
      haversineMeters(legState.inFlightOrigin, effectiveOrigin) < 40
    ) {
      return undefined;
    }

    if (
      legState.lastFailedKey === destKey &&
      legState.lastFailedAt &&
      Date.now() - legState.lastFailedAt < 5000 &&
      legState.lastFailedOrigin &&
      haversineMeters(legState.lastFailedOrigin, effectiveOrigin) < 40
    ) {
      return undefined;
    }

    const startLeg2Fetch = () => {
      const current = custLegRef.current;
      current.deferTimer = null;
      try {
        current.controller?.abort();
      } catch (_e) {}

      const controller =
        typeof AbortController !== 'undefined' ? new AbortController() : null;
      current.controller = controller;
      current.inFlightKey = destKey;
      current.inFlightOrigin = {
        lat: effectiveOrigin.lat,
        lng: effectiveOrigin.lng,
      };

      const fallbackDist = haversineMeters(effectiveOrigin, customerCoords);
      const fallbackDuration = Math.max(
        120,
        Math.round((fallbackDist / 1000 / 28) * 3600)
      );

      fetchOsrmLeg(effectiveOrigin, customerCoords, controller?.signal, {
        avoidShopBacktrack: hasRider,
        shopPath: cachedShopLegPath,
        maxOriginDriftMeters: 60,
        maxDestDriftMeters: 30,
        onInterim: (interimRes) => {
          if (custLegRef.current.controller !== controller) return;
          setRouteState(interimRes);
        },
      })
        .then((res) => {
          if (custLegRef.current.controller !== controller) return;
          custLegRef.current.controller = null;
          custLegRef.current.inFlightKey = null;
          custLegRef.current.inFlightOrigin = null;
          if (!res.isFallback) {
            custLegRef.current.completedKey = destKey;
            custLegRef.current.completedOrigin = {
              lat: effectiveOrigin.lat,
              lng: effectiveOrigin.lng,
            };
            custLegRef.current.completedIsFallback = false;
          } else {
            custLegRef.current.lastFailedAt = Date.now();
            custLegRef.current.lastFailedKey = destKey;
            custLegRef.current.lastFailedOrigin = {
              lat: effectiveOrigin.lat,
              lng: effectiveOrigin.lng,
            };
          }
          setRouteState(res);
        })
        .catch((err) => {
          if (
            err?.name === 'AbortError' ||
            custLegRef.current.controller !== controller
          ) {
            return;
          }
          custLegRef.current.controller = null;
          custLegRef.current.inFlightKey = null;
          custLegRef.current.inFlightOrigin = null;
          custLegRef.current.lastFailedAt = Date.now();
          custLegRef.current.lastFailedKey = destKey;
          custLegRef.current.lastFailedOrigin = {
            lat: effectiveOrigin.lat,
            lng: effectiveOrigin.lng,
          };
          setRouteState({
            path: [effectiveOrigin, customerCoords],
            distanceMeters: fallbackDist,
            durationSeconds: fallbackDuration,
            isFallback: true,
          });
        });
    };

    if (waitForInitialGps) {
      if (!legState.deferTimer) {
        legState.deferTimer = setTimeout(startLeg2Fetch, 60);
      }
      return undefined;
    }

    startLeg2Fetch();
    return undefined;
  }, [
    visible,
    delivery?.orderId,
    effectiveOrigin,
    customerCoords,
    riderCoords,
    gpsStatus,
  ]);

  // Snap coarse cell-tower fixes onto the nearest road junction within their uncertainty radius
  // and ensure the rider pin & both route legs always meet cleanly with zero floating gap.
  const displayRiderCoords = useMemo(() => {
    if (!riderCoords) return null;
    const leg2Start =
      Array.isArray(routeState.path) && routeState.path.length >= 2
        ? routeState.path[0]
        : null;
    const leg1End =
      Array.isArray(shopRouteState.path) && shopRouteState.path.length >= 2
        ? shopRouteState.path[shopRouteState.path.length - 1]
        : null;
    const roadJunction = leg2Start || leg1End;
    if (!roadJunction) return riderCoords;

    const distToRoad = haversineMeters(riderCoords, roadJunction);
    const acc = Number(riderCoords.accuracy);
    const isCoarseFix = !Number.isFinite(acc) || acc > 120;
    const maxSnapMeters = isCoarseFix
      ? Math.min(Math.max(acc || 650, 350), 950)
      : 45;
    if (distToRoad <= maxSnapMeters) {
      return {
        lat: roadJunction.lat,
        lng: roadJunction.lng,
        accuracy: riderCoords.accuracy,
      };
    }
    return riderCoords;
  }, [riderCoords, routeState.path, shopRouteState.path]);

  const displayShopRoutePath = useMemo(() => {
    const base = shopRouteState.path;
    if (!Array.isArray(base) || base.length < 2) return base || [];
    if (!displayRiderCoords) return base;
    const last = base[base.length - 1];
    const gap = haversineMeters(last, displayRiderCoords);
    if (gap > 3 && gap <= 300) {
      return [...base, { lat: displayRiderCoords.lat, lng: displayRiderCoords.lng }];
    }
    return base;
  }, [shopRouteState.path, displayRiderCoords]);

  const displayRoutePath = useMemo(() => {
    const base = routeState.path;
    if (!Array.isArray(base) || base.length < 2) return base || [];
    if (!displayRiderCoords) return base;
    const first = base[0];
    const gap = haversineMeters(first, displayRiderCoords);
    if (gap > 3 && gap <= 300) {
      return [{ lat: displayRiderCoords.lat, lng: displayRiderCoords.lng }, ...base];
    }
    return base;
  }, [routeState.path, displayRiderCoords]);

  // Initial static map HTML (embeds warm cached routes for this delivery immediately on mount; live updates go via postToMap)
  const mapHtml = useMemo(() => {
    const seedRider = riderCoords || readInitialRiderCoords();
    const seedDest = customerCoords || storedDest;
    const warmShop = seedRider
      ? haversineMeters(STORE_LOCATION, seedRider) < 25
        ? { path: [STORE_LOCATION, seedRider], isFallback: false }
        : findCachedOsrmLeg(STORE_LOCATION, seedRider, false, 60, 60)
      : null;
    const warmOrigin = seedRider || STORE_LOCATION;
    const warmCust = seedDest
      ? findCachedOsrmLeg(warmOrigin, seedDest, Boolean(seedRider), 60, 30)
      : null;

    return buildRiderRouteHtml({
      store: STORE_LOCATION,
      rider: seedRider,
      customer: seedDest,
      storeLabel: STORE_LOCATION.name,
      riderLabel: `${riderName} (You)`,
      customerLabel:
        delivery?.customerAddress ||
        delivery?.customerName ||
        'Customer Drop-off',
      orderId: delivery?.orderId || 'track',
      initialFollow: true,
      initialShopRoute: warmShop?.path || null,
      initialShopIsFallback: Boolean(warmShop?.isFallback),
      initialRoute: warmCust?.path || null,
      initialRouteIsFallback: Boolean(warmCust?.isFallback),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delivery?.orderId, isOpen]);

  const latestMapStateRef = useRef({});
  latestMapStateRef.current = {
    followRider,
    riderCoords: displayRiderCoords || riderCoords,
    customerCoords,
    riderName,
    customerLabel:
      delivery?.customerAddress ||
      delivery?.customerName ||
      'Customer drop-off',
    shopRouteState: {
      ...shopRouteState,
      path: displayShopRoutePath,
    },
    routeState: {
      ...routeState,
      path: displayRoutePath,
    },
  };

  const syncAllToMap = useCallback(() => {
    const s = latestMapStateRef.current;
    postToMap({ type: 'follow', value: Boolean(s.followRider) });
    postToMap({
      type: 'store',
      lat: STORE_LOCATION.lat,
      lng: STORE_LOCATION.lng,
      label: STORE_LOCATION.name,
    });
    if (s.riderCoords) {
      postToMap({
        type: 'rider',
        lat: s.riderCoords.lat,
        lng: s.riderCoords.lng,
        label: `${s.riderName} (You)`,
        smooth: false,
      });
    }
    if (s.customerCoords) {
      postToMap({
        type: 'customer',
        lat: s.customerCoords.lat,
        lng: s.customerCoords.lng,
        label: s.customerLabel,
      });
    }
    postToMap({
      type: 'shopRoute',
      coords: s.shopRouteState?.path || [],
      isFallback: Boolean(s.shopRouteState?.isFallback),
    });
    postToMap({
      type: 'route',
      coords: s.routeState?.path || [],
      isFallback: Boolean(s.routeState?.isFallback),
    });
    if (!s.followRider || !s.riderCoords) {
      postToMap({ type: 'fit' });
    }
  }, [postToMap]);

  const handleHostMessage = useCallback(
    (raw) => {
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!parsed || !parsed.type) return;
        if (parsed.orderId && delivery?.orderId && String(parsed.orderId) !== String(delivery.orderId)) {
          return;
        }
        if (parsed.type === 'mapReady') {
          mapReadyRef.current = true;
          setMapLoading(false);
          syncAllToMap();
          return;
        }
        if (parsed.type === 'followPaused') {
          setFollowRider(false);
        }
      } catch (_e) {}
    },
    [delivery?.orderId, syncAllToMap]
  );

  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const onWinMsg = (ev) => handleHostMessage(ev?.data);
    window.addEventListener('message', onWinMsg);
    return () => window.removeEventListener('message', onWinMsg);
  }, [visible, handleHostMessage]);

  // Push live coordinate/route changes to Leaflet
  useEffect(() => {
    const activeRider = displayRiderCoords || riderCoords;
    if (!mapReadyRef.current || !activeRider) return;
    postToMap({
      type: 'rider',
      lat: activeRider.lat,
      lng: activeRider.lng,
      label: `${riderName} (You)`,
      smooth: true,
    });
  }, [displayRiderCoords, riderCoords, riderName, postToMap]);

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
      type: 'shopRoute',
      coords: displayShopRoutePath || [],
      isFallback: shopRouteState.isFallback,
    });
  }, [displayShopRoutePath, shopRouteState.isFallback, postToMap]);

  useEffect(() => {
    if (!mapReadyRef.current) return;
    postToMap({
      type: 'route',
      coords: displayRoutePath || [],
      isFallback: routeState.isFallback,
    });
  }, [displayRoutePath, routeState.isFallback, postToMap]);

  useEffect(() => {
    if (!mapReadyRef.current) return;
    postToMap({ type: 'follow', value: followRider });
  }, [followRider, postToMap]);

  const handleMapLoad = () => {
    mapReadyRef.current = true;
    setMapLoading(false);
    syncAllToMap();
    setTimeout(syncAllToMap, 160);
  };

  const approxMetrics = useMemo(() => {
    if (!customerCoords || !effectiveOrigin) return null;
    const straight = haversineMeters(effectiveOrigin, customerCoords);
    const estDist = Math.max(50, Math.round(straight * 1.25));
    const estDur = Math.max(120, Math.round((estDist / 1000 / 28) * 3600));
    return { distanceMeters: estDist, durationSeconds: estDur };
  }, [customerCoords, effectiveOrigin]);

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
  const etaClock = hasMetrics
    ? formatEtaClock(routeState.durationSeconds)
    : customerCoords && approxMetrics
      ? formatEtaClock(approxMetrics.durationSeconds)
      : '—';
  const distanceSummary = hasMetrics
    ? `${formatDistanceLabel(routeState.distanceMeters)} · ${formatDurationLabel(routeState.durationSeconds)}`
    : customerCoords
      ? approxMetrics
        ? `~${formatDistanceLabel(approxMetrics.distanceMeters)} · Routing…`
        : 'Calculating route…'
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
              key={`rider-track-frame-${delivery?.orderId || 'track'}`}
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
              key={`rider-track-webview-${delivery?.orderId || 'track'}`}
              ref={webRef}
              originWhitelist={['*']}
              source={{ html: mapHtml, baseUrl: 'https://unpkg.com' }}
              onLoadEnd={handleMapLoad}
              onMessage={(ev) => handleHostMessage(ev?.nativeEvent?.data)}
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

          {/* Route Waypoints Timeline: Shop -> Rider -> Customer */}
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
                <View style={[styles.originDot, { backgroundColor: '#EA580C' }]} />
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
                  numberOfLines={1}
                >
                  Shop:{' '}
                  <Text
                    style={[
                      styles.timelineValue,
                      { color: palette.textPrimary },
                    ]}
                  >
                    {STORE_LOCATION.name}
                  </Text>
                </Text>
              </View>
            </View>

            <View style={styles.timelineRow}>
              <View style={styles.timelineIconCol}>
                <View
                  style={[
                    styles.originDot,
                    {
                      backgroundColor:
                        gpsStatus === 'live' ? '#059669' : '#94A3B8',
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
                  numberOfLines={1}
                >
                  Rider (You):{' '}
                  <Text
                    style={[
                      styles.timelineValue,
                      { color: palette.textPrimary },
                    ]}
                  >
                    {gpsStatus === 'live'
                      ? 'Live GPS tracking active'
                      : gpsStatus === 'denied'
                        ? 'Location permission needed'
                        : 'Locating GPS…'}
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
    paddingVertical: 9,
    gap: 5,
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
    height: 10,
    marginTop: 2,
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
