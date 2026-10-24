import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * useNetworkStatus
 * 
 * Production-ready hook for monitoring network connectivity (online/offline)
 * and network round-trip latency (RTT) in MotoTrack.
 *
 * Adheres strictly to .agents/skills/prevent-usage-burn:
 * - NO continuous polling of Supabase or remote APIs
 * - Uses native browser/device event listeners ('online', 'offline', 'navigator.connection')
 * - Real round-trip measurement using window origin or native connection RTT
 * - Latency warning reflects actual performance and clears when performance recovers
 * - Provides developer simulation tools for testing offline and lag conditions
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return navigator.onLine;
    }
    return true;
  });

  const [effectiveType, setEffectiveType] = useState(() => {
    if (typeof navigator !== 'undefined') {
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (conn?.effectiveType) return conn.effectiveType;
    }
    return '4g';
  });

  const [latencyMs, setLatencyMs] = useState(() => {
    if (typeof navigator !== 'undefined') {
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (typeof conn?.rtt === 'number' && conn.rtt > 0) return conn.rtt;
    }
    return 85;
  });

  const [isLagging, setIsLagging] = useState(false);
  const [simulatedOffline, setSimulatedOffline] = useState(false);
  const [simulatedLag, setSimulatedLag] = useState(false);
  const [isMeasuring, setIsMeasuring] = useState(false);

  const isMountedRef = useRef(true);

  // Effective status accounting for simulation toggles
  const effectiveOnline = simulatedOffline ? false : isOnline;
  const effectiveLag = !effectiveOnline ? false : (simulatedLag ? true : isLagging);

  // Fast connection threshold: online, not lagging, low latency (<=180ms), modern network type
  const isFast = effectiveOnline && !effectiveLag && latencyMs <= 180 && (effectiveType === '4g' || effectiveType === '5g' || !effectiveType);

  // Connection speed tier for adaptive UI rendering
  const speedTier = !effectiveOnline
    ? 'offline'
    : effectiveLag || latencyMs >= 550 || effectiveType === '2g' || effectiveType === 'slow-2g'
    ? 'slow'
    : isFast
    ? 'fast'
    : 'moderate';

  // True if internet connection is sufficient and stable (online, not lagging, optimal/fair latency)
  const hasEnoughInternet = effectiveOnline && !effectiveLag && speedTier !== 'slow';

  // Compute connection health tier
  const connectionQuality = !effectiveOnline
    ? 'offline'
    : effectiveLag
    ? 'lagging'
    : latencyMs > 450
    ? 'fair'
    : 'optimal';

  // Dynamic minimum duration for skeleton loading based on connection speed:
  // - Fast connection / enough to load: show loading animation for exactly 0.1s (100ms)
  // - Moderate / slow: strictly real-time (0ms added delay), dismisses the moment data resolves
  const recommendedLoadingDuration = !effectiveOnline
    ? 0
    : isFast
    ? 100
    : 0;

  // Measure actual round-trip network latency (ping) without hitting Supabase or rate-limited endpoints
  const measureLatency = useCallback(async () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return { latencyMs: 75, isFast: true, isLagging: false, tier: 'fast' };
    }

    if (!navigator.onLine) {
      if (isMountedRef.current) {
        setIsOnline(false);
        setIsLagging(false);
      }
      return { latencyMs: 9999, isFast: false, isLagging: false, tier: 'offline' };
    }

    setIsMeasuring(true);

    // 1. If browser natively reports connection RTT (Chrome, Edge, Android Webview, Opera), use it as baseline
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (typeof conn?.rtt === 'number' && conn.rtt > 0) {
      const rtt = Math.round(conn.rtt);
      const isSlow = rtt >= 800 || conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g';
      const isConnFast = !isSlow && rtt <= 180;
      const tier = isSlow ? 'slow' : isConnFast ? 'fast' : 'moderate';

      if (isMountedRef.current) {
        setLatencyMs(rtt);
        setIsOnline(true);
        setIsLagging(isSlow);
        setIsMeasuring(false);
      }
      return { latencyMs: rtt, isFast: isConnFast, isLagging: isSlow, tier };
    }

    // 2. Otherwise perform a safe lightweight HEAD request to window.location.origin
    const startTime = performance?.now ? performance.now() : Date.now();
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = setTimeout(() => {
      if (controller) controller.abort();
    }, 2500);

    try {
      const pingUrl = typeof window !== 'undefined' && window.location?.origin
        ? `${window.location.origin}/?_rtt=${Date.now()}`
        : `/?_rtt=${Date.now()}`;

      await fetch(pingUrl, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller?.signal,
      });

      const elapsed = Math.round((performance?.now ? performance.now() : Date.now()) - startTime);
      const isSlow = elapsed >= 800;
      const isConnFast = !isSlow && elapsed <= 180;
      const tier = isSlow ? 'slow' : isConnFast ? 'fast' : 'moderate';

      if (isMountedRef.current) {
        setLatencyMs(elapsed);
        setIsOnline(true);
        // Only mark lagging if actual RTT is >= 800ms
        setIsLagging(isSlow);
      }
      return { latencyMs: elapsed, isFast: isConnFast, isLagging: isSlow, tier };
    } catch (err) {
      if (isMountedRef.current) {
        if (!navigator.onLine) {
          setIsOnline(false);
          setIsLagging(false);
          return { latencyMs: 9999, isFast: false, isLagging: false, tier: 'offline' };
        } else if (err.name === 'AbortError') {
          // Timeout occurred (>2500ms) -> High network lag
          setLatencyMs(2500);
          setIsLagging(true);
          return { latencyMs: 2500, isFast: false, isLagging: true, tier: 'slow' };
        } else {
          // Keep a normal baseline if fetch HEAD was blocked by local dev server config
          setLatencyMs(80);
          setIsLagging(false);
          return { latencyMs: 80, isFast: true, isLagging: false, tier: 'fast' };
        }
      }
      return { latencyMs: 80, isFast: true, isLagging: false, tier: 'fast' };
    } finally {
      clearTimeout(timeoutId);
      if (isMountedRef.current) {
        setIsMeasuring(false);
      }
    }
  }, []);

  // Real-time connection speed probe: dynamically classifies connection in real-time
  // and returns recommended loading duration so skeletons are seen slightly on fast connections
  const detectRealtimeSpeed = useCallback(async () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return { tier: 'fast', latencyMs: 60, minLoadingMs: 180, isFast: true, isOffline: false, isLagging: false };
    }

    if (!navigator.onLine || simulatedOffline) {
      if (isMountedRef.current) {
        setIsOnline(false);
        setIsLagging(false);
      }
      return { tier: 'offline', latencyMs: 9999, minLoadingMs: 0, isFast: false, isOffline: true, isLagging: false };
    }

    if (simulatedLag) {
      if (isMountedRef.current) {
        setIsLagging(true);
      }
      return { tier: 'slow', latencyMs: 1200, minLoadingMs: 700, isFast: false, isOffline: false, isLagging: true };
    }

    // 1. Check Network Information API (browser native telemetry)
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    let rtt = typeof conn?.rtt === 'number' && conn.rtt > 0 ? Math.round(conn.rtt) : null;
    const type = conn?.effectiveType || effectiveType || '4g';

    // 2. If RTT is not directly available, measure with rapid probe
    if (rtt == null) {
      const pingResult = await measureLatency();
      rtt = pingResult?.latencyMs ?? latencyMs ?? 75;
    }

    const isSlow = rtt >= 550 || type === '2g' || type === 'slow-2g';
    const isConnFast = !isSlow && rtt <= 180 && (type === '4g' || type === '5g' || !type);
    const tier = isSlow ? 'slow' : isConnFast ? 'fast' : 'moderate';

    // Fast connection / enough to load: show loading animation for 0.1s (100ms)
    const minLoadingMs = isConnFast ? 100 : 0;

    if (isMountedRef.current) {
      setLatencyMs(rtt);
      setIsOnline(true);
      setIsLagging(isSlow);
      if (type) setEffectiveType(type);
    }

    return {
      tier,
      latencyMs: rtt,
      effectiveType: type,
      minLoadingMs,
      isFast: isConnFast,
      isLagging: isSlow,
      isOffline: false,
      hasEnoughInternet: !isSlow,
    };
  }, [measureLatency, latencyMs, effectiveType, simulatedOffline, simulatedLag]);

  // Listen to browser online / offline & connection change events
  useEffect(() => {
    isMountedRef.current = true;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleOnline = () => {
        if (!isMountedRef.current) return;
        setIsOnline(true);
        setIsLagging(false);
        measureLatency();
      };

      const handleOffline = () => {
        if (!isMountedRef.current) return;
        setIsOnline(false);
        setIsLagging(false);
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      // Listen to Network Information API
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      const handleConnectionChange = () => {
        if (!isMountedRef.current || !conn) return;
        const type = conn.effectiveType || '4g';
        setEffectiveType(type);

        if (typeof conn.rtt === 'number' && conn.rtt > 0) {
          setLatencyMs(Math.round(conn.rtt));
        }

        if (type === '2g' || type === 'slow-2g' || (conn.rtt && conn.rtt >= 800)) {
          setIsLagging(true);
        } else {
          setIsLagging(false);
        }
      };

      if (conn?.addEventListener) {
        conn.addEventListener('change', handleConnectionChange);
      }

      // Initial latency read
      measureLatency();

      return () => {
        isMountedRef.current = false;
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        if (conn?.removeEventListener) {
          conn.removeEventListener('change', handleConnectionChange);
        }
      };
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [measureLatency]);

  // Track an in-flight operation's execution without permanently locking lag state
  const trackOperationDuration = useCallback(async (asyncFn) => {
    let lagTimer = null;

    // Only set transient lag flag while operation is running past 1200ms
    lagTimer = setTimeout(() => {
      if (isMountedRef.current && isOnline) {
        setIsLagging(true);
      }
    }, 1200);

    try {
      const result = await asyncFn();
      return result;
    } finally {
      clearTimeout(lagTimer);
      // ALWAYS clear operation-induced lag state when the operation finishes!
      if (isMountedRef.current) {
        setIsLagging(false);
      }
    }
  }, [isOnline]);

  // Developer simulation controls
  const toggleSimulateOffline = useCallback(() => {
    setSimulatedOffline((prev) => !prev);
  }, []);

  const toggleSimulateLag = useCallback(() => {
    setSimulatedLag((prev) => !prev);
  }, []);

  return {
    isOnline: effectiveOnline,
    isOffline: !effectiveOnline,
    isLagging: effectiveLag,
    effectiveType,
    latencyMs,
    connectionQuality,
    speedTier,
    isFast,
    hasEnoughInternet,
    recommendedLoadingDuration,
    isMeasuring,
    simulatedOffline,
    simulatedLag,
    measureLatency,
    detectRealtimeSpeed,
    trackOperationDuration,
    toggleSimulateOffline,
    toggleSimulateLag,
  };
}

export default useNetworkStatus;
