import { Platform } from 'react-native';

/**
 * Pick an image from device files (supports Web browser file upload and Mobile camera roll)
 * Returns { success: boolean, uri?: string, error?: string }
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

          // Limit file size to 6MB for smooth performance
          if (file.size > 6 * 1024 * 1024) {
            resolve({ success: false, error: 'Image size should be less than 6MB' });
            return;
          }

          const reader = new FileReader();
          reader.onload = () => {
            resolve({ success: true, uri: reader.result });
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
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      return { success: false, error: 'Photo library permission is required to select images.' };
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
      return { success: true, uri };
    }

    return { success: false, error: 'Selection cancelled' };
  } catch (e) {
    return { success: false, error: e.message || 'Image picker error' };
  }
}
