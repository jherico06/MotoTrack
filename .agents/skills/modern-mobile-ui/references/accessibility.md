# MotoTrack Mobile Accessibility (a11y) Guidelines

Practical accessibility standards and implementation checklists for the MotoTrack React Native mobile application.

---

## 1. Touch Target Geometry

Every interactive element (buttons, chips, icons, stepper controls, checkboxes, tabs) must provide adequate physical space to prevent accidental taps:

### Sizing Standards
- **iOS Minimum**: `44 × 44 pt`
- **Android Minimum**: `48 × 48 dp`

### Expanding Hit Slop for Compact Icons
When an icon is visually small (e.g., `14px` close icon or `16px` chevron), expand its touch target using `hitSlop`:

```jsx
<TouchableOpacity
  onPress={onClose}
  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
  accessibilityRole="button"
  accessibilityLabel="Close dialog"
>
  <BootstrapIcon name="x-lg" size={14} color="#64748B" />
</TouchableOpacity>
```

---

## 2. Color Contrast & Redundant Signaling (WCAG 2.1 AA)

All text, icons, and essential boundary borders must meet or exceed WCAG 2.1 AA contrast ratios:

| Contrast Category | Minimum Ratio | Approved MotoTrack Pairings |
| :--- | :--- | :--- |
| **Normal Text (< 18px)** | `4.5 : 1` | `#0F172A` on `#FFFFFF` (16.1 : 1)<br>`#475569` on `#FFFFFF` (7.3 : 1)<br>`#FFFFFF` on `#F97316` (4.6 : 1) |
| **Large Text (>= 18px)** | `3.0 : 1` | `#F97316` on `#FFFFFF` (3.2 : 1) |
| **UI Components & Icons**| `3.0 : 1` | `#64748B` on `#F1F5F9` (4.2 : 1)<br>`#CBD5E1` on `#FFFFFF` (3.1 : 1) |

### Dual-Signaling Rule (Never Rely on Color Alone)
Never communicate state (such as compatibility, stock, or delivery status) solely through color:

- ❌ **Incorrect**: A colored circle (green vs red) with no icon or text.
- ✅ **Correct**: Green icon (`check-circle-fill`) + text label ("Compatible with Honda Click") + green background (`#ECFDF5`).

---

## 3. Screen Reader Optimization (VoiceOver & TalkBack)

### Required Accessibility Props
Always supply semantic roles and descriptive labels for actionable elements:

```jsx
<TouchableOpacity
  style={styles.cartBtn}
  onPress={handleAddToCart}
  accessible={true}
  accessibilityRole="button"
  accessibilityLabel={`Add ${product.name} to cart`}
  accessibilityHint="Double tap to place this part into your shopping bag"
  accessibilityState={{ disabled: isSoldOut, busy: isAdding }}
>
  <BootstrapIcon name="cart-plus" size={16} color="#FFFFFF" />
  <Text style={styles.cartBtnText}>Add to Cart</Text>
</TouchableOpacity>
```

### Screen Reader Friendly Compatibility Indicator
```jsx
<View 
  accessible={true}
  accessibilityRole="text"
  accessibilityLabel={
    isCompatible 
      ? `Product is confirmed compatible with your ${bike.brand} ${bike.model}` 
      : `Product is not compatible with your ${bike.brand} ${bike.model}`
  }
>
  <CompatibilityBadge isCompatible={isCompatible} motorcycleName={bikeName} />
</View>
```

---

## 4. Dynamic Type & Scalable Typography

1. **Avoid Fixed Clipping Containers**: Never specify hardcoded small container heights (e.g. `height: 24`) on containers wrapping user-facing text. Allow containers to expand naturally with flexbox:
   ```javascript
   // Recommended
   minHeight: 48,
   paddingVertical: 12,
   ```
2. **Text Ellipsize Safety**: Use `numberOfLines` only on secondary labels or summaries. Never truncate essential prices, error messages, or terms of service.
3. **Tabular Numerals for Numeric Content**: Prevent vertical and horizontal numeral jitter when values tick by declaring:
   ```javascript
   fontVariant: ['tabular-nums'],
   ```

---

## 5. Form Field Accessibility

Every text input must have a visible label and clear error feedback:

```jsx
<View style={styles.formGroup}>
  <Text 
    style={styles.label} 
    nativeID="plateNumberLabel"
  >
    Motorcycle Plate Number
  </Text>
  <TextInput
    style={[styles.input, hasError && styles.inputError]}
    value={plateNumber}
    onChangeText={setPlateNumber}
    placeholder="e.g. 7890-AB"
    placeholderTextColor="#94A3B8"
    accessibilityLabelledBy="plateNumberLabel"
    accessibilityInvalid={hasError}
    autoCapitalize="characters"
  />
  {hasError && (
    <View style={styles.errorRow} accessibilityLiveRegion="polite">
      <BootstrapIcon name="exclamation-circle-fill" size={12} color="#EF4444" />
      <Text style={styles.errorText}>Please enter a valid plate or MV file number</Text>
    </View>
  )}
</View>
```

---

## 6. Asynchronous Screen Reader Announcements

When an action completes asynchronously (such as adding an item to the cart or updating a booking), notify the user through accessibility announcements or live regions:

```javascript
import { AccessibilityInfo } from 'react-native';

export function announceToScreenReader(message) {
  if (AccessibilityInfo && AccessibilityInfo.announceForAccessibility) {
    AccessibilityInfo.announceForAccessibility(message);
  }
}

// Usage
announceToScreenReader('Added Honda Air Filter to your cart. Cart total ₱450.00.');
```
