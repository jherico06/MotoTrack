import { APP_CONFIG } from '../../config/index.js';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const MAX_SELECTED_PRODUCTS = 3;

/**
 * Base URL for the Express AI Customizer API.
 * Dynamically resolves LAN host IP on physical mobile devices.
 */
export function getCustomizeApiBaseUrl() {
  const fromEnv = String(
    process.env.EXPO_PUBLIC_CUSTOMIZE_API_URL || APP_CONFIG.customizeApiUrl || ''
  ).trim();

  // If a production HTTPS url is provided, use it directly
  if (fromEnv && fromEnv.startsWith('https://')) {
    return fromEnv.replace(/\/+$/, '');
  }

  // 1. Web browser runtime: dynamically match the current origin host (e.g. localhost, 127.0.0.1, or local LAN IP)
  // On localhost, it connects to local Express server port 8787.
  // On production (e.g. Vercel), it uses same-origin window.location.origin (unless an explicit HTTPS URL is provided).
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      const hostname = window.location.hostname;
      const isPrivateLanIp =
        /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
        /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
        /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname);
      const isLocalhost =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        (isPrivateLanIp && window.location.protocol === 'http:');

      if (isLocalhost) {
        if (fromEnv && fromEnv.startsWith('http://') && !fromEnv.includes('192.168.')) {
          return fromEnv.replace(/\/+$/, '');
        }
        const proto = window.location.protocol === 'https:' ? 'https:' : 'http:';
        return `${proto}//${hostname}:8787`;
      }

      // Production web environment (e.g. Vercel deployment)
      if (fromEnv && fromEnv.startsWith('https://')) {
        return fromEnv.replace(/\/+$/, '');
      }

      // Default to same origin for Vercel Serverless /api
      return window.location.origin;
    }
    if (fromEnv) return fromEnv.replace(/\/+$/, '');
    return 'http://127.0.0.1:8787';
  }

  // 2. In Expo runtime on mobile, extract the development machine IP automatically
  const hostFromExpo =
    Constants?.expoConfig?.hostUri?.split(':')[0] ||
    Constants?.expoGoConfig?.debuggerHost?.split(':')[0] ||
    Constants?.manifest2?.extra?.expoGo?.debuggerHost?.split(':')[0] ||
    (Constants?.linkingUri
      ? String(Constants.linkingUri)
          .replace(/^exp:\/\//i, '')
          .replace(/^https?:\/\//i, '')
          .split('/')[0]
          .split(':')[0]
      : '') ||
    (Constants?.experienceUrl
      ? String(Constants.experienceUrl)
          .replace(/^exp:\/\//i, '')
          .replace(/^https?:\/\//i, '')
          .split('/')[0]
          .split(':')[0]
      : '');

  if (hostFromExpo && hostFromExpo !== 'localhost' && hostFromExpo !== '127.0.0.1') {
    return `http://${hostFromExpo}:8787`;
  }

  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  // Extract from EXPO_PUBLIC_APP_URL (e.g. http://192.168.31.246:8081)
  const appUrl = String(process.env.EXPO_PUBLIC_APP_URL || APP_CONFIG.publicAppUrl || '');
  const match = appUrl.match(/https?:\/\/([^/:]+)/);
  if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
    return `http://${match[1]}:8787`;
  }

  // Sensible local defaults for simulators / web only
  if (Platform.OS === 'android') return 'http://10.0.2.2:8787';
  return 'http://127.0.0.1:8787';
}

function guessMime(uri = '', fallback = 'image/jpeg') {
  const lower = String(uri).toLowerCase();
  if (lower.includes('.png') || lower.startsWith('data:image/png')) return 'image/png';
  if (lower.includes('.webp') || lower.startsWith('data:image/webp')) return 'image/webp';
  if (lower.includes('.heic')) return 'image/heic';
  if (lower.startsWith('data:image/')) {
    return lower.slice(5, lower.indexOf(';')) || fallback;
  }
  return fallback;
}

function guessName(uri = '', fallback = 'photo.jpg') {
  try {
    const clean = String(uri).split('?')[0];
    const base = clean.split('/').pop();
    if (base && base.includes('.')) return base;
  } catch (_e) {}
  return fallback;
}

/**
 * Compress a browser Blob/File via HTML Canvas when needed so multipart
 * uploads stay well below Vercel Serverless Function's 4.5 MB body limit.
 */
async function compressWebBlobIfNeeded(blob, maxDimension = 1280, quality = 0.86) {
  if (!blob || typeof document === 'undefined' || typeof Image === 'undefined') {
    return blob;
  }
  // Keep small images untouched (< 650 KB)
  if (blob.size > 0 && blob.size <= 650 * 1024) {
    return blob;
  }
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        URL.revokeObjectURL(objectUrl);
        let { width, height } = img;
        if (!width || !height) {
          resolve(blob);
          return;
        }
        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(blob);
          return;
        }
        // Fill white background for transparent PNGs converted to JPEG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (compressed) => {
            resolve(compressed && compressed.size < blob.size ? compressed : blob);
          },
          'image/jpeg',
          quality
        );
      } catch (_err) {
        resolve(blob);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(blob);
    };
    img.src = objectUrl;
  });
}

/**
 * Web browsers need a Blob/File in FormData for local files, or URL fields for remote https:// images.
 * RN needs a local { uri, name, type } for local files.
 * Remote HTTP/HTTPS URLs are passed as URL fields so Vercel Serverless payload stays under 4.5 MB.
 */
async function appendImage(form, field, uri, fallbackName) {
  const mime = guessMime(uri);
  const name = guessName(uri, fallbackName);

  if (Platform.OS === 'web') {
    if (typeof uri === 'string') {
      // Remote HTTP/HTTPS URLs (e.g. Supabase Storage): pass URL text fields directly
      // so the server downloads them and the request never hits Vercel's 4.5 MB payload cap.
      if (/^https?:\/\//i.test(uri)) {
        const isLocalUrl = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?\//i.test(uri);
        if (!isLocalUrl) {
          form.append(`${field}Url`, uri);
          form.append(`${field}Uri`, uri);
          return;
        }
      }

      if (uri.startsWith('data:') || uri.startsWith('blob:') || /^https?:\/\//i.test(uri)) {
        try {
          const res = await fetch(uri);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const rawBlob = await res.blob();
          const blob = await compressWebBlobIfNeeded(rawBlob);
          const finalName = blob.type === 'image/jpeg' ? name.replace(/\.(png|webp|heic)$/i, '.jpg') : name;
          form.append(field, blob, finalName);
          return;
        } catch (_e) {
          // Fall back to string URL parameter
          form.append(`${field}Url`, uri);
          form.append(`${field}Uri`, uri);
          return;
        }
      }
    }
    if (uri && typeof uri === 'object' && (uri instanceof Blob || (typeof File !== 'undefined' && uri instanceof File))) {
      const compressed = await compressWebBlobIfNeeded(uri);
      const finalName = compressed.type === 'image/jpeg' ? name.replace(/\.(png|webp|heic)$/i, '.jpg') : name;
      form.append(field, compressed, finalName);
      return;
    }
  }

  // On Native Mobile (iOS / Android):
  if (Platform.OS !== 'web' && typeof uri === 'string') {
    // 1. If it's a remote URL (https:// or http://):
    // Pass as URL text field so the backend server downloads it directly.
    // React Native's FormData parser crashes with [TypeError: Network request failed] if a remote URL is put in { uri }.
    if (/^https?:\/\//i.test(uri)) {
      form.append(`${field}Url`, uri);
      form.append(`${field}Uri`, uri);
      return;
    }

    // 2. If it's a base64 data: URI:
    if (uri.startsWith('data:')) {
      form.append(`${field}Base64`, uri);
      form.append(`${field}Url`, uri);
      return;
    }
  }

  // Local file (file://, content://, ph://) picked from camera / gallery:
  form.append(field, {
    uri,
    name,
    type: mime,
  });
}

/**
 * GET /api/customize/usage
 * Retrieves current customer rate-limit counts & cooldown status.
 */
export async function getCustomizeUsage({ userId }) {
  if (!userId) {
    return {
      success: false,
      allowed: false,
      error: 'User ID is required to fetch usage.',
    };
  }

  const base = getCustomizeApiBaseUrl();
  const url = `${base}/api/customize/usage?userId=${encodeURIComponent(userId)}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-User-Id': String(userId),
        'X-Mototrack-User-Id': String(userId),
      },
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        success: false,
        allowed: false,
        error: data?.error || data?.message || `Failed to fetch usage (${response.status})`,
        ...data,
      };
    }

    return {
      success: true,
      ...data,
    };
  } catch (err) {
    return {
      success: false,
      allowed: false,
      error: err?.message || 'Network error fetching usage.',
    };
  }
}

/**
 * POST /api/customize with multipart bike + 1..3 selected product images.
 * bikeUri = motorcycle identity reference; partUris (or partUri) = 1 to 3 product identity references.
 */
export async function requestMotorcycleCustomization({
  userId = '',
  bikeUri,
  partUri,
  partUris = [],
  customRequest = '',
  installationPrompt = '',
  selectionMeta = null,
  timeoutMs = 120000,
}) {
  const resolvedPartUris =
    Array.isArray(partUris) && partUris.length > 0
      ? partUris.filter(Boolean)
      : partUri
        ? [partUri]
        : [];

  if (!bikeUri || resolvedPartUris.length === 0) {
    return { success: false, error: 'Select both a motorcycle photo and at least one part photo.' };
  }

  if (resolvedPartUris.length > MAX_SELECTED_PRODUCTS) {
    return {
      success: false,
      code: 'MAX_PRODUCTS_EXCEEDED',
      error: 'You can select a maximum of 3 products.',
    };
  }

  const base = getCustomizeApiBaseUrl();
  const url = `${base}/api/customize`;

  const resolvedUserId = String(
    userId || selectionMeta?.userId || selectionMeta?.user_id || 'usr-customer-01'
  ).trim();

  const form = new FormData();
  if (resolvedUserId) {
    form.append('userId', resolvedUserId);
  }
  await appendImage(form, 'bike', bikeUri, 'bike.jpg');
  for (let idx = 0; idx < resolvedPartUris.length; idx += 1) {
    await appendImage(form, `part_${idx}`, resolvedPartUris[idx], `part_${idx + 1}.jpg`);
  }
  const remotePartUrls = resolvedPartUris.map((u) =>
    typeof u === 'string' && /^https?:\/\//i.test(u) ? u : ''
  );
  if (remotePartUrls.some(Boolean)) {
    form.append('partUrls', JSON.stringify(remotePartUrls));
  }

  const promptText = String(installationPrompt || customRequest || '').trim();
  form.append('customRequest', promptText);
  form.append('installationPrompt', promptText);
  if (selectionMeta && typeof selectionMeta === 'object') {
    form.append('selectionMeta', JSON.stringify(selectionMeta));
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const headers = {};
    if (resolvedUserId) {
      headers['X-User-Id'] = resolvedUserId;
      headers['X-Mototrack-User-Id'] = resolvedUserId;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      // Do NOT set Content-Type manually — RN/fetch must add multipart boundary
      body: form,
      signal: controller?.signal,
    });

    if (timer) clearTimeout(timer);

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.success) {
      let errorText =
        data?.message ||
        data?.error ||
        `Server error (${response.status}). Is the API running at ${base}?`;
      // Flatten nested Google error JSON when the server passes it through raw.
      if (typeof errorText === 'string' && errorText.trim().startsWith('{')) {
        try {
          const nested = JSON.parse(errorText);
          errorText = nested?.error?.message || nested?.message || errorText;
        } catch (_e) {
          // keep original
        }
      }
      return {
        success: false,
        error: errorText,
        code: data?.code || (response.status === 429 ? 'RATE_LIMIT' : undefined),
        reason: data?.reason,
        weeklyUsed: data?.weeklyUsed,
        weeklyLimit: data?.weeklyLimit,
        consecutiveUsed: data?.consecutiveUsed,
        consecutiveLimit: data?.consecutiveLimit,
        cooldownUntil: data?.cooldownUntil,
        remainingSeconds: data?.remainingSeconds,
        usage: data?.usage,
      };
    }

    const dataUrl =
      data.previewImageUrl ||
      data.dataUrl ||
      (data.imageBase64
        ? `data:${data.mimeType || 'image/png'};base64,${data.imageBase64}`
        : null);

    if (!dataUrl) {
      return { success: false, error: 'Server returned no image.' };
    }

    return {
      success: true,
      previewImageUrl: dataUrl,
      promptUsed: data.promptUsed,
      model: data.model,
      note: data.note,
      partsInstalledCount: data.partsInstalledCount || resolvedPartUris.length,
      apiBase: base,
      usage: data.usage || null,
    };
  } catch (err) {
    if (timer) clearTimeout(timer);
    const aborted = err?.name === 'AbortError' || Boolean(controller?.signal?.aborted);
    const errorMsg = aborted
      ? 'Request timed out. Image generation can take up to a minute — try again.'
      : Platform.OS === 'web'
        ? `Cannot reach AI server at ${base || window?.location?.origin || ''}. Please ensure the server API is active.`
        : `Network request failed. On a physical phone use your PC LAN IP in EXPO_PUBLIC_CUSTOMIZE_API_URL (current: ${base}). ${err?.message || ''}`.trim();
    return {
      success: false,
      error: errorMsg,
    };
  }
}

export async function pingCustomizeApi() {
  const base = getCustomizeApiBaseUrl();
  try {
    const res = await fetch(`${base}/api/health`);
    const data = await res.json();
    return { ok: res.ok, base, data };
  } catch (err) {
    return { ok: false, base, error: err?.message || String(err) };
  }
}

export default {
  getCustomizeApiBaseUrl,
  getCustomizeUsage,
  requestMotorcycleCustomization,
  pingCustomizeApi,
};
