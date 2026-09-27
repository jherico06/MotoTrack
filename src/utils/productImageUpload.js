/**
 * Upload images to Supabase Storage and return a short public URL.
 * Avoids storing multi-hundred-KB base64 in Postgres (major egress waste).
 */
import { supabaseManager } from '../services/supabaseClient';
import {
  MAX_IMAGE_BYTES,
  MAX_IMAGE_MB,
  estimateDataUriBytes,
  isImageTooLarge,
} from './imagePickerHelper';

const BUCKET = 'product-images';

function guessExtAndMime(uri = '') {
  const s = String(uri);
  if (s.startsWith('data:image/png')) return { ext: 'png', mime: 'image/png' };
  if (s.startsWith('data:image/webp')) return { ext: 'webp', mime: 'image/webp' };
  if (s.startsWith('data:image/gif')) return { ext: 'gif', mime: 'image/gif' };
  return { ext: 'jpg', mime: 'image/jpeg' };
}

function dataUriToBlob(dataUri) {
  const match = String(dataUri).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const mime = match[1];
  const b64 = match[2];
  if (typeof atob !== 'function') return null;
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  if (typeof Blob !== 'undefined') {
    return new Blob([bytes], { type: mime });
  }
  return bytes;
}

async function uriToUploadBody(dataUri) {
  try {
    const res = await fetch(dataUri);
    if (res.ok) {
      const blob = await res.blob();
      if (blob && blob.size > 0) return blob;
    }
  } catch (_e) {
    // fall through to manual decode
  }
  return dataUriToBlob(dataUri);
}

function bodyByteSize(body) {
  if (!body) return 0;
  if (typeof body.size === 'number') return body.size;
  if (typeof body.byteLength === 'number') return body.byteLength;
  if (body instanceof Uint8Array) return body.byteLength;
  return 0;
}

async function ensureBucket(client) {
  try {
    const { data } = await client.storage.getBucket(BUCKET);
    if (data) {
      // Keep bucket limit aligned with app (best-effort; may require service role)
      try {
        await client.storage.updateBucket(BUCKET, {
          public: true,
          fileSizeLimit: MAX_IMAGE_BYTES,
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        });
      } catch (_e) {}
      return true;
    }
  } catch (_e) {
    // ignore
  }
  try {
    await client.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_IMAGE_BYTES,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    });
    return true;
  } catch (e) {
    console.warn('[productImageUpload] createBucket note:', e?.message || e);
    return false;
  }
}

/**
 * If uri is a data: URI, upload to Storage and return the public URL.
 * Remote http(s) URLs are returned unchanged.
 *
 * @param {string} uri
 * @param {{ folder?: string, fileName?: string }} options
 * @returns {Promise<{ success: boolean, url?: string, error?: string, skipped?: boolean }>}
 */
export async function uploadProductImage(uri, options = {}) {
  const raw = String(uri || '').trim();
  if (!raw) return { success: false, error: 'No image provided' };

  if (/^https?:\/\//i.test(raw)) {
    return { success: true, url: raw, skipped: true };
  }

  if (!raw.startsWith('data:')) {
    return { success: true, url: raw, skipped: true };
  }

  if (isImageTooLarge(estimateDataUriBytes(raw))) {
    return {
      success: false,
      error: `Image must be ${MAX_IMAGE_MB} MB or smaller.`,
      url: null,
    };
  }

  const client = supabaseManager.getClient();
  if (!client) {
    return { success: false, error: 'Supabase client unavailable', url: raw };
  }

  await ensureBucket(client);

  const { ext, mime } = guessExtAndMime(raw);
  const folder = options.folder || 'colors';
  const fileName =
    options.fileName ||
    `${folder}/${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}.${ext}`;

  try {
    const body = await uriToUploadBody(raw);
    if (!body) {
      return { success: false, error: 'Invalid image data', url: raw };
    }

    const size = bodyByteSize(body);
    if (isImageTooLarge(size)) {
      return {
        success: false,
        error: `Image must be ${MAX_IMAGE_MB} MB or smaller.`,
        url: null,
      };
    }

    const { error } = await client.storage.from(BUCKET).upload(fileName, body, {
      contentType: mime,
      upsert: true,
    });

    if (error) {
      console.warn('[productImageUpload] upload failed:', error.message);
      return { success: false, error: error.message, url: raw };
    }

    const { data } = client.storage.from(BUCKET).getPublicUrl(fileName);
    const publicUrl = data?.publicUrl;
    if (!publicUrl) {
      return { success: false, error: 'Missing public URL after upload', url: raw };
    }
    return { success: true, url: publicUrl };
  } catch (e) {
    console.warn('[productImageUpload] exception:', e);
    return { success: false, error: String(e?.message || e), url: raw };
  }
}

/**
 * Resolve a proof / media image for DB storage: always prefer a short Storage URL.
 * Falls back to the original URI only when upload fails and the payload is small.
 */
export async function resolveImageForDatabase(uri, options = {}) {
  const raw = String(uri || '').trim();
  if (!raw) return { success: false, error: 'No image provided', url: null };

  if (/^https?:\/\//i.test(raw)) {
    return { success: true, url: raw, skipped: true };
  }

  if (!raw.startsWith('data:')) {
    return { success: true, url: raw, skipped: true };
  }

  const folder = options.folder || 'delivery-proofs';
  const uploaded = await uploadProductImage(raw, {
    folder,
    fileName:
      options.fileName ||
      `${folder}/${options.orderId || 'media'}-${Date.now()}.jpg`,
  });

  if (uploaded.success && uploaded.url && !String(uploaded.url).startsWith('data:')) {
    return { success: true, url: uploaded.url };
  }

  if (raw.length < 80000) {
    return {
      success: false,
      error: uploaded.error || 'Upload failed; kept compact local preview only',
      url: raw,
    };
  }

  return {
    success: false,
    error: uploaded.error || `Image must be ${MAX_IMAGE_MB} MB or smaller.`,
    url: null,
  };
}

/**
 * Normalize colors array: upload any data: images, keep remote URLs.
 */
export async function resolveColorImagesForSave(colors = []) {
  if (!Array.isArray(colors) || colors.length === 0) return { colors: [], errors: [] };
  const errors = [];
  const out = [];
  for (let i = 0; i < colors.length; i += 1) {
    const c = colors[i] || {};
    const image = String(c.image || '').trim();
    if (!image || !image.startsWith('data:')) {
      out.push(c);
      continue;
    }
    const labelSlug = String(c.label || `color-${i + 1}`)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 40);
    const res = await uploadProductImage(image, {
      folder: 'colors',
      fileName: `colors/${labelSlug}-${Date.now()}-${i}.jpg`,
    });
    if (res.success && res.url) {
      out.push({ ...c, image: res.url });
    } else {
      errors.push(res.error || `Failed to upload color image #${i + 1}`);
      if (image.length < MAX_IMAGE_BYTES) {
        out.push(c);
      } else {
        out.push({ ...c, image: '' });
        errors.push(
          `Color "${c.label || i + 1}" photo exceeds ${MAX_IMAGE_MB} MB and was cleared.`
        );
      }
    }
  }
  return { colors: out, errors };
}

export default { uploadProductImage, resolveImageForDatabase, resolveColorImagesForSave };
