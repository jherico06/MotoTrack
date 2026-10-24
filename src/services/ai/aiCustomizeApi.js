import { APP_CONFIG } from '../../config/index.js';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

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
  // This guarantees web will always reach the local AI server even if Wi-Fi IP or .env is out of sync.
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      const proto = window.location.protocol === 'https:' ? 'https:' : 'http:';
      const host = window.location.hostname;
      return `${proto}//${host}:8787`;
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
 * Web browsers need a Blob/File in FormData.
 * RN needs a local { uri, name, type } for local files.
 * Remote HTTP/HTTPS URLs must NEVER be passed as { uri } file objects on RN — pass them as URL fields!
 */
async function appendImage(form, field, uri, fallbackName) {
  const mime = guessMime(uri);
  const name = guessName(uri, fallbackName);

  if (Platform.OS === 'web') {
    if (
      typeof uri === 'string' &&
      (uri.startsWith('data:') || uri.startsWith('blob:') || /^https?:\/\//i.test(uri))
    ) {
      try {
        const res = await fetch(uri);
        const blob = await res.blob();
        form.append(field, blob, name);
        return;
      } catch (_e) {
        // Fall back to string URL parameter
        form.append(`${field}Url`, uri);
        form.append(`${field}Uri`, uri);
        return;
      }
    }
    if (uri && typeof uri === 'object' && (uri instanceof Blob || (typeof File !== 'undefined' && uri instanceof File))) {
      form.append(field, uri, name);
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
 * POST /api/customize with multipart bike + part images.
 * bikeUri = motorcycle identity reference; partUri = product identity reference.
 */
export async function requestMotorcycleCustomization({
  userId = '',
  bikeUri,
  partUri,
  customRequest = '',
  installationPrompt = '',
  selectionMeta = null,
  timeoutMs = 120000,
}) {
  if (!bikeUri || !partUri) {
    return { success: false, error: 'Select both a motorcycle photo and a part photo.' };
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
  await appendImage(form, 'part', partUri, 'part.jpg');
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
      apiBase: base,
      usage: data.usage || null,
    };
  } catch (err) {
    if (timer) clearTimeout(timer);
    const aborted = err?.name === 'AbortError';
    return {
      success: false,
      error: aborted
        ? 'Request timed out. Image generation can take up to a minute — try again.'
        : `Network request failed. On a physical phone use your PC LAN IP in EXPO_PUBLIC_CUSTOMIZE_API_URL (current: ${base}). ${err?.message || ''}`.trim(),
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
