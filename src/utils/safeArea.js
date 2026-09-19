import { Platform, StatusBar } from 'react-native';
import Constants from 'expo-constants';

/** Android draws under the status bar; RN SafeAreaView does not offset it. */
export const ANDROID_TOP_INSET =
  Platform.OS === 'android'
    ? Math.max(Number(Constants.statusBarHeight) || 0, Number(StatusBar.currentHeight) || 0, 24) + 8
    : 0;

export const androidTopInsetStyle =
  Platform.OS === 'android' ? { paddingTop: ANDROID_TOP_INSET } : null;
