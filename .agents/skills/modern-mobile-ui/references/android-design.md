# MotoTrack Android Design Guidelines

Comprehensive guide for engineering native-feeling, production-ready Android interfaces for MotoTrack using React Native, Expo, and Material Design 3 principles.

---

## 1. Material Design 3 & MotoTrack Alignment

Android interfaces in MotoTrack adopt **Material Design 3 (M3)** concepts—expressive surfaces, elevation through tonal contrast, and fluid shape systems—while maintaining brand harmony with MotoTrack's signature Racing Orange and Charcoal palette.

### Key Tenets
1. **Visual Consistency ≠ Identical Layouts**: Android users expect platform conventions like hardware back navigation, elevation-based surface hierarchy, and native touch ripples, while retaining MotoTrack's recognizable brand identity.
2. **Edge-to-Edge Layouts**: Status bars and system navigation bars must feel seamlessly integrated, using translucent overlays with proper top insets.
3. **Responsive Tactile Feedback**: Tap surfaces support `activeOpacity={0.75}` or `TouchableNativeFeedback` with bounded ripples.

---

## 2. Status Bars, Insets & Edge-to-Edge Layout

Android devices display varying status bar heights and software navigation bars. MotoTrack relies on `ANDROID_TOP_INSET` from `src/utils/safeArea.js` to ensure content does not collide with the camera cutout.

### Implementation Standard
```javascript
import { Platform, StatusBar } from 'react-native';
import { ANDROID_TOP_INSET } from '../../../utils/safeArea.js';

export const androidTopSpacing = Platform.OS === 'android' ? ANDROID_TOP_INSET : 0;
```

### Android Screen Container Shell
```jsx
import React from 'react';
import { View, StyleSheet, Platform, StatusBar } from 'react-native';
import { ANDROID_TOP_INSET } from '../../utils/safeArea.js';

export function MotoTrackAndroidScreen({ children, header, bottomNav }) {
  return (
    <View style={styles.rootContainer}>
      <StatusBar 
        translucent 
        backgroundColor="transparent" 
        barStyle="dark-content" 
      />
      <View style={styles.topInsetShim} />
      
      {header}
      
      <View style={styles.bodyContainer}>
        {children}
      </View>

      {bottomNav}
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topInsetShim: {
    height: Platform.OS === 'android' ? ANDROID_TOP_INSET : 0,
    backgroundColor: '#FFFFFF',
  },
  bodyContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
});
```

---

## 3. Hardware Back Button Handling

On Android, users expect the hardware back button or swipe-from-edge gesture to close active modals, search overlays, or bottom sheets **before** navigating away from the current screen.

### Hardware Back Press Standard Pattern
```jsx
import { useEffect } from 'react';
import { BackHandler } from 'react-native';

export function useAndroidBackHandler({ isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen) return;

    const backAction = () => {
      onClose();
      return true; // Prevents default hardware exit
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, [isOpen, onClose]);
}
```

---

## 4. Android Elevation & Surface Hierarchy

On Android, avoid multi-property iOS shadows. Instead, use native `elevation` paired with subtle borders (`#E2E8F0` or `#F1F5F9`) to ensure crisp rendering on all GPU chipsets:

| Component Type | Elevation Level | Border Fallback | Background Surface |
| :--- | :--- | :--- | :--- |
| **Flat Base Surface** | `elevation: 0` | None | `#FFFFFF` or `#F8FAFC` |
| **Product / Roster Cards** | `elevation: 2` | `1px #E2E8F0` | `#FFFFFF` |
| **Active Floating Chips** | `elevation: 3` | `1px #FED7AA` | `#FFF7ED` |
| **Top App Bar / Header** | `elevation: 3` | `1px #F1F5F9` | `#FFFFFF` |
| **Persistent Bottom Nav** | `elevation: 8` | `1px #E2E8F0` | `#FFFFFF` |
| **Modal Bottom Sheet** | `elevation: 20` | `1px #F1F5F9` | `#FFFFFF` |

---

## 5. Android Bottom Sheet Architecture

Android bottom sheets in MotoTrack adhere to the unified sliding sheet design with top rounded squircles:

```jsx
<Modal
  visible={visible}
  transparent={true}
  animationType="slide"
  onRequestClose={onClose} // Handled by Android system
>
  <View style={styles.androidModalOverlay}>
    <TouchableOpacity 
      style={styles.androidBackdropTouch} 
      activeOpacity={1} 
      onPress={onClose} 
    />
    <View style={styles.androidModalSheet}>
      {/* 4px drag handle bar */}
      <View style={styles.dragHandleBar} />
      
      {/* Unified Peach Icon Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleWrap}>
          <View style={styles.peachIconBox}>
            <BootstrapIcon name={icon} size={17} color="#F97316" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.titleText}>{title}</Text>
            <Text style={styles.subtitleText}>{subtitle}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.circleCloseBtn} onPress={onClose}>
          <BootstrapIcon name="x-lg" size={14} color="#64748B" />
        </TouchableOpacity>
      </View>

      {/* Body Content */}
      <ScrollView style={styles.sheetBody}>
        {children}
      </ScrollView>

      {/* Android Bottom Footer */}
      <View style={styles.footerRow}>
        {footerButtons}
      </View>
    </View>
  </View>
</Modal>
```

### Sheet Styling Tokens
```javascript
export const androidSheetStyles = {
  androidModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
    padding: 0,
  },
  androidModalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    maxHeight: '88%',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    elevation: 20,
  },
  dragHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 10,
  },
};
```

---

## 6. Keyboard Behavior on Android

1. **Avoid Double Padded Insets**: Do not wrap whole screens with `KeyboardAvoidingView` on Android when `android:windowSoftInputMode="adjustResize"` is active in `app.json`.
2. **Scroll Content Clearance**: Ensure all `ScrollView` and `FlatList` containers include bottom padding of at least `120px` to clear the persistent `BottomNavBar` and keyboard state.
