import { APP_CONFIG } from '../config/index.js';
import { Platform } from 'react-native';

/**
 * Base URL for the Express AI Customizer API.
 * On a physical phone, localhost will NOT work — use your PC LAN IP
 * (e.g. http://192.168.1.10:8787) via EXPO_PUBLIC_CUSTOMIZE_API_URL.
 */
export function getCustomizeApiBaseUrl() {
  const fromEnv = String(
    process.env.EXPO_PUBLIC_CUSTOMIZE_API_URL || APP_CONFIG.customizeApiUrl || ''
  ).trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

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
 * RN needs { uri, name, type }. Data URLs from the web picker must be converted.
 */
async function appendImage(form, field, uri, fallbackName) {
  const mime = guessMime(uri);
  const name = guessName(uri, fallbackName);

  if (Platform.OS === 'web' && typeof uri === 'string' && uri.startsWith('data:')) {
    const res = await fetch(uri);
    const blob = await res.blob();
    form.append(field, blob, name);
    return;
  }

  if (Platform.OS === 'web' && typeof uri === 'string' && /^https?:\/\//i.test(uri)) {
    const res = await fetch(uri);
    const blob = await res.blob();
    form.append(field, blob, name);
    return;
  }

  form.append(field, {
    uri,
    name,
    type: mime,
  });
}

/**
 * POST /api/customize with multipart bike + part images.
 */
export async function requestMotorcycleCustomization({
  bikeUri,
  partUri,
  customRequest = '',
  timeoutMs = 120000,
}) {
  if (!bikeUri || !partUri) {
    return { success: false, error: 'Select both a motorcycle photo and a part photo.' };
  }

  const base = getCustomizeApiBaseUrl();
  const url = `${base}/api/customize`;

  const form = new FormData();
  await appendImage(form, 'bike', bikeUri, 'bike.jpg');
  await appendImage(form, 'part', partUri, 'part.jpg');
  form.append('customRequest', String(customRequest || '').trim());

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const response = await fetch(url, {
      method: 'POST',
      // Do NOT set Content-Type manually — RN/fetch must add multipart boundary
      body: form,
      signal: controller?.signal,
    });

    if (timer) clearTimeout(timer);

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.success) {
      return {
        success: false,
        error: data?.error || `Server error (${response.status}). Is the API running at ${base}?`,
        code: data?.code,
      };
    }

    const dataUrl =
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
  requestMotorcycleCustomization,
  pingCustomizeApi,
};
