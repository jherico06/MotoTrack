import { Platform, StatusBar } from 'react-native';
import Constants from 'expo-constants';

/** Android draws under the status bar when translucent; offset by exact status bar height */
export const ANDROID_TOP_INSET =
  Platform.OS === 'android'
    ? Math.max(Number(StatusBar.currentHeight) || 0, Number(Constants.statusBarHeight) || 0, 24)
    : 0;

/** Android gesture bar or 3-button navigation bar clearance inset */
export const ANDROID_BOTTOM_INSET = Platform.OS === 'android' ? 12 : 0;

export const androidTopInsetStyle =
  Platform.OS === 'android' ? { paddingTop: ANDROID_TOP_INSET } : null;

export const androidBottomInsetStyle =
  Platform.OS === 'android' ? { paddingBottom: ANDROID_BOTTOM_INSET } : null;
