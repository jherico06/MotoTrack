import { Platform } from 'react-native';

export const isWeb = Platform.OS === 'web';
export const isAndroid = Platform.OS === 'android';
export const isIOS = Platform.OS === 'ios';
export const isMobile = Platform.OS === 'android' || Platform.OS === 'ios';

/**
 * Android and iOS share a mobile screen unless that screen has a real platform UI.
 * Pass `android` or `ios` only for a screen that cannot stay shared.
 */
export function selectNativeScreen(mobileScreen, overrides = {}) {
  if (Platform.OS === 'web' && overrides.web) return overrides.web;
  if (Platform.OS === 'ios' && overrides.ios) return overrides.ios;
  if (Platform.OS === 'android' && overrides.android) return overrides.android;
  return mobileScreen;
}
