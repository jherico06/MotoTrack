# MotoTrack iOS Design Guidelines

Comprehensive guide for engineering native-feeling, production-ready iOS interfaces for MotoTrack using React Native and Expo.

---

## 1. Native iOS Interface Philosophy

iOS design in MotoTrack prioritizes **content clarity**, **fluid tactile responsiveness**, and **effortless one-handed navigation**.

### Key Tenets
1. **Fluid Tactile Feedback**: All touchable elements must provide instant, subtle physical feedback (`activeOpacity={0.7}` or spring-based touch animations).
2. **Layered Depth & Translucency**: Use subtle borders (`#E2E8F0`), soft drop shadows, and subtle blur backdrops (`rgba(15, 23, 42, 0.65)`) rather than heavy opaque layers.
3. **Ergonomic Reachability**: Primary interactive controls and bottom sheets must sit in the thumb zone (lower 60% of the display).

---

## 2. Safe Areas & System Insets

iOS displays feature rounded corners, the Home Indicator (bottom safe area), and Dynamic Island / notch (top safe area). MotoTrack screens must strictly handle these insets.

### Safe Area Token Standards
```javascript
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Standard iOS Inset Values
export const IOS_INSETS = {
  topNotch: 44,
  topDynamicIsland: 59,
  bottomHomeIndicator: 34,
  bottomBarPadding: Platform.OS === 'ios' ? 30 : 16,
};
```

### Screen Shell Pattern
```jsx
import React from 'react';
import { View, StyleSheet, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export function MotoTrackIosScreen({ children, footer }) {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView edges={['top']} style={styles.safeRoot}>
      <KeyboardAvoidingView 
        behavior="padding" 
        style={styles.keyboardWrap}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <View style={styles.contentArea}>
          {children}
        </View>
        {footer && (
          <View style={[styles.stickyFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            {footer}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeRoot: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardWrap: {
    flex: 1,
  },
  contentArea: {
    flex: 1,
  },
  stickyFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
});
```

---

## 3. iOS Bottom Sheets & Modal Presentations

MotoTrack uses a unified bottom-sheet architecture for all mobile selection panels, filters, vehicle pickers, and confirmations.

### Modal Guidelines
- **Slide Up Presentation**: Always use `animationType="slide"` with `transparent={true}`.
- **Top Corner Radii**: Exactly `borderTopLeftRadius: 28` and `borderTopRightRadius: 28` (`0` on bottom corners).
- **Backdrop**: `#0F172A` with `65%` opacity (`rgba(15, 23, 42, 0.65)`).
- **Safe Area Bottom**: Always supply `paddingBottom: Platform.OS === 'ios' ? 30 : 16`.
- **Dismissal Gesture / Tap**: Tap outside the sheet card immediately dismisses the modal.

### Standard iOS Header Specification
```jsx
{/* Standard iOS Header Row */}
<View style={styles.modalHeaderRow}>
  <View style={styles.modalHeaderLeft}>
    {/* 38x38 Peach Icon Badge */}
    <View style={styles.modalIconBox}>
      <BootstrapIcon name={iconName} size={17} color="#F97316" />
    </View>
    <View style={styles.modalHeaderTextWrap}>
      <Text style={styles.modalTitle} numberOfLines={1}>{title}</Text>
      <Text style={styles.modalSubtitle} numberOfLines={1}>{subtitle}</Text>
    </View>
  </View>
  
  {/* 34x34 Circular Dismiss Button */}
  <TouchableOpacity 
    style={styles.modalCloseBtn} 
    onPress={onClose}
    activeOpacity={0.7}
    accessibilityRole="button"
    accessibilityLabel="Close sheet"
  >
    <BootstrapIcon name="x-lg" size={14} color="#64748B" />
  </TouchableOpacity>
</View>
```

---

## 4. Typography & Visual Hierarchy

In accordance with MotoTrack standards, **Plus Jakarta Sans** is the only approved font family.

### iOS Font Sizing & Tracking
- **Header Large**: `22px`, `fontWeight: '800'`, `letterSpacing: -0.4px`
- **Header Medium**: `18px`, `fontWeight: '800'`, `letterSpacing: -0.25px`
- **Section Title**: `16px`, `fontWeight: '700'`, `letterSpacing: -0.15px`
- **Body Regular**: `13.5px`, `fontWeight: '500'`, `lineHeight: 19px`
- **Caption / Meta**: `11.5px`, `fontWeight: '600'`, `color: '#64748B'`
- **Currency Figures**: Tabular numeral formatting, `fontWeight: '900'`, e.g., `₱1,250.00`

---

## 5. iOS Shadows & Glassmorphism

iOS avoids harsh Android elevation boundaries. Use curated multi-property shadow definitions:

```javascript
export const iosShadows = {
  cardSubtle: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 0, // Zero elevation on iOS to preserve native look
  },
  cardFloating: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 0,
  },
  bottomSheet: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 0,
  },
  primaryButton: {
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 0,
  },
};
```

---

## 6. Keyboard Avoidance & Scrolling Behaviors

### Standard Scroll Configuration
Always set `keyboardShouldPersistTaps="handled"` and `showsVerticalScrollIndicator={false}` on `ScrollView` and `FlatList` to prevent stuck keyboard dismissal states.

```jsx
<ScrollView
  style={styles.scrollRoot}
  contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
  keyboardShouldPersistTaps="handled"
  showsVerticalScrollIndicator={false}
  bounces={true}
  overScrollMode="never"
>
  {/* Content */}
</ScrollView>
```

---

## 7. iOS Action Buttons & Pills

- **Primary Button**: Height `48–50px`, `borderRadius: 14`, `backgroundColor: '#F97316'`, text `#FFFFFF`, `fontWeight: '800'`.
- **Secondary Button**: Height `48–50px`, `borderRadius: 14`, `backgroundColor: '#F1F5F9'`, border `1px #E2E8F0`, text `#475569`, `fontWeight: '700'`.
- **Icon Buttons**: Circle `34–40px`, `borderRadius: 17–20`, subtle slate background `#F1F5F9`.
