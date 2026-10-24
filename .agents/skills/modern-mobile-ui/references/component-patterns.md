# MotoTrack Mobile Component Patterns & Design Tokens

Production-ready component specifications and reusable design tokens for building modern, high-converting interfaces across the MotoTrack mobile application.

---

## 1. MotoTrack Design Tokens

Single source of truth for color roles, sizing, radii, and spatial geometry in MotoTrack.

### A. Semantic Color Palette
```javascript
export const tokens = {
  colors: {
    // Brand Core
    brandOrange: '#F97316',        // Primary action, key highlights, active states
    brandOrangeHover: '#EA580C',   // Pressed / darker state
    brandCharcoal: '#0F172A',      // Primary text, dark accents, slate dark backgrounds
    brandDarkSlate: '#1E293B',     // Secondary headers, dark card borders
    
    // Warm Accents (Signature Peach Badge System)
    peachBackground: '#FFF7ED',    // Icon box background
    peachBorder: '#FED7AA',        // Icon box subtle border
    peachText: '#C2410C',          // Warm badge text
    
    // Neutral Scales
    surfaceBase: '#FFFFFF',        // Primary background
    surfaceMuted: '#F8FAFC',       // Secondary card surfaces, inactive inputs
    surfacePressed: '#F1F5F9',     // Button press state, chip backgrounds
    borderMuted: '#F1F5F9',        // Dividers, list separators
    borderDefault: '#E2E8F0',      // Card outlines, text inputs
    borderFocus: '#F97316',        // Active field outline
    
    // Text Hierarchy
    textPrimary: '#0F172A',        // Main headings, prices, primary labels
    textSecondary: '#475569',      // Subheadings, form labels, descriptions
    textMuted: '#64748B',          // Timestamps, captions, metadata
    textInverse: '#FFFFFF',        // Text on primary buttons and dark surfaces
    
    // Status & Feedback
    success: '#10B981',            // Positive status, stock in, compatible
    successDark: '#15803D',
    successBg: '#ECFDF5',
    error: '#EF4444',              // Incompatible, error alerts, canceled
    errorBg: '#FEF2F2',
    warning: '#F59E0B',            // Pending, low stock, attention
    warningBg: '#FFFBEB',
    info: '#3B82F6',               // Instructions, telemetry
    infoBg: '#EFF6FF',
  },
  
  // Radii System
  radii: {
    micro: 6,                      // Micro pills, rating badges
    chip: 10,                      // Filter chips, tag labels
    iconBox: 12,                   // Peach header icon badge boxes
    button: 14,                    // Standard action buttons, input fields
    card: 16,                      // Standard product and order cards
    largeCard: 20,                 // KPI cards, booking containers
    bottomSheet: 28,               // Edge-to-edge modal sheet top corners
    circle: 9999,                  // Avatars, circular action buttons
  },
  
  // Spacing Scale
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  
  // Icon Sizing Scale
  icons: {
    tiny: 10,                      // Inline perks, mini indicators
    micro: 12,                     // Small secondary badges
    compact: 14,                   // Inline buttons, close icons
    standard: 16,                  // Input icons, standard buttons
    headerBadge: 17,               // Peach header box icons
    large: 24,                     // Navigation icons
    hero: 32,                      // Empty state icons
  },
};
```

---

## 2. Reusable Component Patterns

### A. Primary & Secondary Buttons
Standardized on `borderRadius: 14` and height `48–50px` for optimal thumb tapping ergonomics.

```jsx
// Primary Action Button
<TouchableOpacity
  style={styles.primaryBtn}
  onPress={handlePress}
  disabled={isLoading || disabled}
  activeOpacity={0.85}
  accessibilityRole="button"
>
  {isLoading ? (
    <ActivityIndicator color="#FFFFFF" size="small" />
  ) : (
    <>
      {icon && <BootstrapIcon name={icon} size={15} color="#FFFFFF" />}
      <Text style={styles.primaryBtnText}>{label}</Text>
    </>
  )}
</TouchableOpacity>

// Secondary Action Button
<TouchableOpacity
  style={styles.secondaryBtn}
  onPress={handleCancel}
  activeOpacity={0.8}
  accessibilityRole="button"
>
  <Text style={styles.secondaryBtnText}>{cancelLabel}</Text>
</TouchableOpacity>

const buttonStyles = StyleSheet.create({
  primaryBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F97316',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  secondaryBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  secondaryBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#475569',
  },
});
```

---

### B. Unified Bottom Sheet Modal (Image 1 Standard)
The standard pattern for all popups, pickers, filters, and dialogs.

```jsx
<Modal
  visible={isOpen}
  transparent={true}
  animationType="slide"
  onRequestClose={onClose}
>
  <TouchableWithoutFeedback onPress={onClose}>
    <View style={styles.modalOverlay}>
      <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
        <View style={styles.modalSheetCard}>
          {/* Header Row */}
          <View style={styles.modalHeaderRow}>
            <View style={styles.modalHeaderLeft}>
              <View style={styles.peachIconBox}>
                <BootstrapIcon name={iconName} size={17} color="#F97316" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle} numberOfLines={1}>{title}</Text>
                <Text style={styles.modalSubtitle} numberOfLines={1}>{subtitle}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={onClose}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <BootstrapIcon name="x-lg" size={14} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Scrollable Content */}
          <ScrollView 
            style={styles.modalScrollArea}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>

          {/* Footer Actions */}
          {footer && (
            <View style={styles.modalFooterRow}>
              {footer}
            </View>
          )}
        </View>
      </TouchableWithoutFeedback>
    </View>
  </TouchableWithoutFeedback>
</Modal>

const modalStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalSheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '88%',
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 8,
  },
  peachIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScrollArea: {
    marginVertical: 10,
    maxHeight: 460,
  },
  modalFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
});
```

---

### C. Motorcycle Compatibility Indicator
Dual-signal badge system (Icon + Color + Explicit Text Label):

```jsx
export function CompatibilityBadge({ isCompatible, motorcycleName }) {
  if (!motorcycleName) return null;

  return (
    <View
      style={[
        styles.compatBadge,
        {
          backgroundColor: isCompatible ? '#ECFDF5' : '#FEF2F2',
          borderColor: isCompatible ? '#A7F3D0' : '#FECACA',
        },
      ]}
      accessible={true}
      accessibilityLabel={
        isCompatible
          ? `Compatible with your ${motorcycleName}`
          : `Not compatible with your ${motorcycleName}`
      }
    >
      <BootstrapIcon
        name={isCompatible ? 'check-circle-fill' : 'x-circle-fill'}
        size={11}
        color={isCompatible ? '#10B981' : '#EF4444'}
      />
      <Text
        style={[
          styles.compatText,
          { color: isCompatible ? '#065F46' : '#991B1B' },
        ]}
        numberOfLines={1}
      >
        {isCompatible
          ? `Fits ${motorcycleName}`
          : `Not compatible with ${motorcycleName}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  compatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  compatText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
```

---

### D. Currency & Price Display
Tabular numerals for zero jitter with Philippine peso formatting:

```jsx
export function PriceLabel({ amount, compareAtAmount, size = 'md' }) {
  const formattedPrice = `₱${Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const hasDiscount = compareAtAmount && Number(compareAtAmount) > Number(amount);
  const formattedOldPrice = hasDiscount
    ? `₱${Number(compareAtAmount).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : null;

  return (
    <View style={styles.priceRow}>
      <Text style={[styles.mainPrice, size === 'lg' ? styles.priceLg : styles.priceMd]}>
        {formattedPrice}
      </Text>
      {formattedOldPrice && (
        <Text style={styles.comparePrice}>{formattedOldPrice}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  mainPrice: {
    color: '#0F172A',
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  priceMd: {
    fontSize: 16,
  },
  priceLg: {
    fontSize: 22,
    color: '#F97316',
  },
  comparePrice: {
    fontSize: 12,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
});
```

---

### E. Quantity Stepper
Touch-accessible quantity control with disabled boundary states:

```jsx
<View style={styles.stepperContainer}>
  <TouchableOpacity
    style={[styles.stepperBtn, quantity <= 1 && styles.stepperBtnDisabled]}
    onPress={onDecrease}
    disabled={quantity <= 1}
    accessibilityRole="button"
    accessibilityLabel="Decrease quantity"
  >
    <BootstrapIcon name="dash" size={14} color={quantity <= 1 ? '#CBD5E1' : '#0F172A'} />
  </TouchableOpacity>

  <Text style={styles.stepperValue}>{quantity}</Text>

  <TouchableOpacity
    style={[styles.stepperBtn, quantity >= maxStock && styles.stepperBtnDisabled]}
    onPress={onIncrease}
    disabled={quantity >= maxStock}
    accessibilityRole="button"
    accessibilityLabel="Increase quantity"
  >
    <BootstrapIcon name="plus" size={14} color={quantity >= maxStock ? '#CBD5E1' : '#0F172A'} />
  </TouchableOpacity>
</View>
```

---

### F. Loading Skeletons
Clean pulse shimmers for catalog browsing:

```jsx
export function ProductCardSkeleton() {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonThumb} />
      <View style={styles.skeletonTextLineWide} />
      <View style={styles.skeletonTextLineNarrow} />
      <View style={styles.skeletonPriceBox} />
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 8,
  },
  skeletonThumb: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  skeletonTextLineWide: {
    width: '85%',
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  skeletonTextLineNarrow: {
    width: '50%',
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F8FAFC',
  },
  skeletonPriceBox: {
    width: '60%',
    height: 16,
    borderRadius: 6,
    backgroundColor: '#FFF7ED',
    marginTop: 4,
  },
});
```

---

### G. Empty States
Helpful, non-intrusive empty states that guide the customer forward:

```jsx
export function EmptyState({ icon, title, description, actionLabel, onAction }) {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <BootstrapIcon name={icon} size={30} color="#F97316" />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDesc}>{description}</Text>
      {actionLabel && (
        <TouchableOpacity style={styles.emptyBtn} onPress={onAction} activeOpacity={0.85}>
          <Text style={styles.emptyBtnText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    maxWidth: 280,
  },
  emptyBtn: {
    backgroundColor: '#F97316',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 14,
  },
  emptyBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13.5,
  },
});
```
