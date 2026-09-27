import { Linking, Platform } from 'react-native';

/** Hard cap to protect Supabase egress — keep photos small. */
export const MAX_IMAGE_MB = 1;
export const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;

export function formatMaxImageSizeLabel() {
  return `${MAX_IMAGE_MB} MB`;
}

/**
 * Estimate byte size of a data URI or raw base64 string.
 */
export function estimateDataUriBytes(uri) {
  const raw = String(uri || '');
  if (!raw) return 0;
  if (raw.startsWith('data:')) {
    const comma = raw.indexOf(',');
    if (comma < 0) return 0;
    const b64 = raw.slice(comma + 1);
    // base64 → bytes ≈ length * 3/4 (ignore padding noise)
    return Math.floor((b64.length * 3) / 4);
  }
  return 0;
}

export function isImageTooLarge(bytes) {
  const n = Number(bytes || 0);
  return Number.isFinite(n) && n > MAX_IMAGE_BYTES;
}

function tooLargeError() {
  return {
    success: false,
    error: `Image must be ${MAX_IMAGE_MB} MB or smaller. Choose a smaller photo or compress it first.`,
  };
}

async function assetToDataUri(asset) {
  if (!asset) return null;
  if (asset.base64) return `data:image/jpeg;base64,${asset.base64}`;
  return asset.uri || null;
}

/**
 * Validate a picked Expo ImagePicker asset against the MB limit.
 */
function validatePickerAsset(asset) {
  if (!asset) return tooLargeError();
  const fileSize = Number(asset.fileSize || asset.filesize || 0);
  if (fileSize > 0 && isImageTooLarge(fileSize)) {
    return tooLargeError();
  }
  if (asset.base64) {
    const approx = Math.floor((String(asset.base64).length * 3) / 4);
    if (isImageTooLarge(approx)) return tooLargeError();
  }
  return { success: true };
}

/**
 * Request photo library access with a clear denied message.
 */
async function ensureMediaLibraryPermission(ImagePicker) {
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (current.granted) return { ok: true };

  const asked = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (asked.granted) return { ok: true };

  const canAskAgain = asked.canAskAgain !== false && current.canAskAgain !== false;
  return {
    ok: false,
    error: canAskAgain
      ? 'Photo library permission is required to select images. Tap Add photo again and allow access when prompted.'
      : 'Photo library access is blocked. Open device Settings → MotoTrack → Photos/Files and allow access, then try again.',
    openSettings: !canAskAgain,
  };
}

async function ensureCameraPermission(ImagePicker) {
  const current = await ImagePicker.getCameraPermissionsAsync();
  if (current.granted) return { ok: true };

  const asked = await ImagePicker.requestCameraPermissionsAsync();
  if (asked.granted) return { ok: true };

  const canAskAgain = asked.canAskAgain !== false && current.canAskAgain !== false;
  return {
    ok: false,
    error: canAskAgain
      ? 'Camera permission is required to take a delivery photo. Allow camera access when prompted.'
      : 'Camera access is blocked. Open device Settings → MotoTrack → Camera and allow access, then try again.',
    openSettings: !canAskAgain,
  };
}

/**
 * Pick an image from device files (supports Web browser file upload and Mobile camera roll)
 * Returns { success: boolean, uri?: string, error?: string, openSettings?: boolean }
 */
export async function pickImageFromFile() {
  // 1. Web browser environment: Native HTML5 File Picker with Base64 Data URL
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return new Promise((resolve) => {
      try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';

        input.onchange = (e) => {
          const file = e.target.files?.[0];
          if (!file) {
            resolve({ success: false, error: 'No file selected' });
            return;
          }

          if (isImageTooLarge(file.size)) {
            resolve(tooLargeError());
            return;
          }

          const reader = new FileReader();
          reader.onload = () => {
            const uri = reader.result;
            if (isImageTooLarge(estimateDataUriBytes(uri))) {
              resolve(tooLargeError());
              return;
            }
            resolve({ success: true, uri });
          };
          reader.onerror = () => {
            resolve({ success: false, error: 'Failed to read image file' });
          };
          reader.readAsDataURL(file);
        };

        input.oncancel = () => {
          resolve({ success: false, error: 'Selection cancelled' });
        };

        document.body.appendChild(input);
        input.click();
        setTimeout(() => {
          try {
            document.body.removeChild(input);
          } catch (e) {}
        }, 3000);
      } catch (err) {
        resolve({ success: false, error: err.message || 'File picker failed' });
      }
    });
  }

  // 2. Mobile environment (iOS / Android)
  try {
    const ImagePicker = require('expo-image-picker');
    const permission = await ensureMediaLibraryPermission(ImagePicker);
    if (!permission.ok) {
      return {
        success: false,
        error: permission.error,
        openSettings: permission.openSettings,
      };
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.45,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const sizeCheck = validatePickerAsset(asset);
      if (!sizeCheck.success) return sizeCheck;
      const uri = await assetToDataUri(asset);
      if (uri) {
        if (isImageTooLarge(estimateDataUriBytes(uri))) return tooLargeError();
        return { success: true, uri };
      }
    }

    return { success: false, error: 'Selection cancelled' };
  } catch (e) {
    return { success: false, error: e.message || 'Image picker error' };
  }
}

/**
 * Capture a new photo with the device camera (preferred for delivery proof).
 * Returns { success: boolean, uri?: string, error?: string, openSettings?: boolean }
 */
export async function pickImageFromCamera() {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    // Web has no reliable camera capture here — fall back to file picker.
    return pickImageFromFile();
  }

  try {
    const ImagePicker = require('expo-image-picker');
    const permission = await ensureCameraPermission(ImagePicker);
    if (!permission.ok) {
      return {
        success: false,
        error: permission.error,
        openSettings: permission.openSettings,
      };
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.45,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const sizeCheck = validatePickerAsset(asset);
      if (!sizeCheck.success) return sizeCheck;
      const uri = await assetToDataUri(asset);
      if (uri) {
        if (isImageTooLarge(estimateDataUriBytes(uri))) return tooLargeError();
        return { success: true, uri };
      }
    }

    return { success: false, error: 'Capture cancelled' };
  } catch (e) {
    return { success: false, error: e.message || 'Camera error' };
  }
}

export async function openAppPermissionSettings() {
  try {
    await Linking.openSettings();
    return true;
  } catch (_e) {
    return false;
  }
}

/**
 * Pick a video or photo from device files.
 * Supports web and mobile (Expo ImagePicker).
 */
export async function pickVideoFromFile() {
  const MAX_VIDEO_BYTES = 15 * 1024 * 1024; // 15 MB cap for diagnostic video clips

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return new Promise((resolve) => {
      try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/*';
        input.style.display = 'none';

        input.onchange = (e) => {
          const file = e.target.files?.[0];
          if (!file) {
            resolve({ success: false, error: 'No video selected' });
            return;
          }
          if (file.size > MAX_VIDEO_BYTES) {
            resolve({ success: false, error: 'Video clip must be 15 MB or smaller.' });
            return;
          }

          const reader = new FileReader();
          reader.onload = () => {
            const uri = reader.result;
            resolve({ success: true, uri, isVideo: true, fileName: file.name });
          };
          reader.onerror = () => {
            resolve({ success: false, error: 'Failed to read video file' });
          };
          reader.readAsDataURL(file);
        };

        input.oncancel = () => {
          resolve({ success: false, error: 'Selection cancelled' });
        };

        document.body.appendChild(input);
        input.click();
        setTimeout(() => {
          try {
            document.body.removeChild(input);
          } catch (_e) {}
        }, 3000);
      } catch (err) {
        resolve({ success: false, error: err.message || 'Video picker failed' });
      }
    });
  }

  // Mobile
  try {
    const ImagePicker = require('expo-image-picker');
    const permission = await ensureMediaLibraryPermission(ImagePicker);
    if (!permission.ok) {
      return { success: false, error: permission.error, openSettings: permission.openSettings };
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: true,
      quality: 0.5,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const fileSize = Number(asset.fileSize || 0);
      if (fileSize > MAX_VIDEO_BYTES) {
        return { success: false, error: 'Video clip must be 15 MB or smaller.' };
      }
      return { success: true, uri: asset.uri, isVideo: true };
    }

    return { success: false, error: 'Selection cancelled' };
  } catch (e) {
    return { success: false, error: e.message || 'Video picker error' };
  }
}

