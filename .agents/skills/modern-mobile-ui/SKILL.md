---
name: modern-mobile-ui
description: >-
  Guides the development, refactoring, and review of modern, production-ready
  iOS and Android mobile interfaces for MotoTrack. Use when building or styling
  mobile screens, navigation, bottom sheets, modals, product cards, compatibility
  badges, checkout flows, PMS garage booking, or when the user mentions mobile UI/UX,
  iOS/Android design, touch ergonomics, or design tokens.
---

# Modern Mobile UI Design Skill for MotoTrack

Production-ready architecture, design tokens, platform standards, and checklists for engineering world-class iOS and Android mobile interfaces for **MotoTrack**.

---

## 1. When to Use This Skill

Activate and follow this skill whenever:
- Creating a new mobile screen or component in `src/screens/mobile/*` or `src/components/mobile/*`.
- Refactoring existing mobile screens (`ShopPage`, `GaragePage`, `CustomizerPage`, `WishlistPage`, `ProfilePage`, `OrderPage`).
- Designing or modifying bottom sheets, modals, and dialogs.
- Building motorcycle compatibility indicators, price displays, or product cards.
- Implementing PMS service booking, cart/checkout flows, or delivery tracking.
- Auditing UI for iOS/Android platform conventions, accessibility (WCAG AA), and touch ergonomics.

---

## 2. Core Design Philosophy

Every MotoTrack mobile screen must be:
1. **Modern, Clean, and Visually Polished**: Emphasize uncluttered layouts, deliberate white space, and refined squircle corners (`borderRadius: 14` for controls, `28` for bottom sheets).
2. **Effortless for Everyday Riders**: Clear typography, scannable product information, intuitive iconography, and zero confusing jargon.
3. **True to the MotoTrack Brand**: Rooted in **Charcoal (`#0F172A`)** and **Racing Orange (`#F97316`)**, complemented by signature **Warm Peach (`#FFF7ED` / `#FED7AA`)** badges. Never introduce arbitrary neon colors or disrupt the established theme.
4. **Mobile-First & Touch-Comfortable**: Sized for one-handed operation. All interactive targets meet the `44×44 pt` (iOS) and `48×48 dp` (Android) standard.
5. **Content-Clarity Focused**: Avoid heavy gradients, giant decorative headers, repetitive text inside cards, and gratuitous animations that slow down task completion.

---

## 3. Reference Documents Architecture

Before writing or modifying mobile UI code, consult the relevant reference documents located in `references/`:

| Reference Document | Primary Focus & Usage |
| :--- | :--- |
| **[`references/ios-design.md`](file:///c:/Users/Jherico%20S.%20Maurin/Desktop/Moto/.agents/skills/modern-mobile-ui/references/ios-design.md)** | Safe areas (notch/home indicator), native navigation tabs, pageSheet modals, iOS shadow physics, smooth spring touches, and keyboard avoidance. |
| **[`references/android-design.md`](file:///c:/Users/Jherico%20S.%20Maurin/Desktop/Moto/.agents/skills/modern-mobile-ui/references/android-design.md)** | Material Design 3 alignment, hardware back button lifecycle (`BackHandler`), edge-to-edge status bar insets (`ANDROID_TOP_INSET`), and Android elevation. |
| **[`references/component-patterns.md`](file:///c:/Users/Jherico%20S.%20Maurin/Desktop/Moto/.agents/skills/modern-mobile-ui/references/component-patterns.md)** | Core design tokens (colors, spacing, radii), primary/secondary buttons, product cards, compatibility chips, price labels, bottom sheets, and empty states. |
| **[`references/accessibility.md`](file:///c:/Users/Jherico%20S.%20Maurin/Desktop/Moto/.agents/skills/modern-mobile-ui/references/accessibility.md)** | Touch target minimums, WCAG AA color contrast (>= 4.5:1), VoiceOver/TalkBack attributes, dynamic type scaling, and dual-signaling rules. |

---

## 4. Platform Selection: iOS vs. Android

**Visual consistency does NOT mean identical layouts.** Respect platform conventions:

```
                                  [Mobile UI Request]
                                           |
                   +-----------------------+-----------------------+
                   |                                               |
              [iOS Target]                                  [Android Target]
                   |                                               |
     - Home indicator inset (34pt)                   - Status bar inset (ANDROID_TOP_INSET)
     - Soft multi-stop shadows                       - GPU-friendly elevation (2–6)
     - KeyboardAvoidingView ('padding')              - Hardware back dismisses sheets first
     - SF Symbol / Cupertino touch spring            - Material 3 surface elevation & shapes
```

- When design or interaction differs, write platform-specific files (`Component.ios.jsx` vs `Component.android.jsx`) or branch cleanly using `Platform.select({ ios: ..., android: ... })`.
- Shared design tokens (`src/styles/theme.js`, `src/styles/typography.js`) remain the single source of truth across platforms.

---

## 5. Design System Tokens Summary

### Color Roles
- **Primary Brand**: `#F97316` (Racing Orange) — Reserve for primary buttons, active indicators, and brand accents.
- **Surface Dark / Text**: `#0F172A` (Charcoal) — Primary headings, high-contrast dark accents.
- **Surface Background**: `#FFFFFF` (Base) & `#F8FAFC` (Card backgrounds & chips).
- **Peach Badge System**: `#FFF7ED` (Background), `#FED7AA` (Border), `#F97316` (Icon).
- **Divider & Border**: `#F1F5F9` (Dividers) & `#E2E8F0` (Card boundaries).
- **Semantic Feedback**:
  - Success: `#10B981` (Background `#ECFDF5`, Border `#A7F3D0`)
  - Error: `#EF4444` (Background `#FEF2F2`, Border `#FECACA`)
  - Warning: `#F59E0B` (Background `#FFFBEB`, Border `#FDE68A`)

### Corner Radii Hierarchy
- Micro badges & chips: `8px – 10px`
- Header icon box: `12px` (`38×38 px` or `40×40 px`)
- Standard buttons & inputs: `14px` (`height: 48–50 px`)
- Product & booking cards: `16px – 20px`
- Native Bottom Sheet top corners: `28px` (`borderBottomLeftRadius: 0, borderBottomRightRadius: 0`)

---

## 6. MotoTrack-Specific UI Rules

### A. Motorcycle Compatibility Indicator System
Every product card, modal, or detail screen must explicitly declare vehicle compatibility using the **Dual-Signaling Rule**:
1. **Compatible**: Green badge (`check-circle-fill`, `#10B981`, `#ECFDF5` background) + clear label: `"Fits Honda Click 125i"`.
2. **Incompatible**: Red badge (`x-circle-fill`, `#EF4444`, `#FEF2F2` background) + clear label: `"Not compatible with your bike"`.
3. **No Bike Selected**: Soft slate prompt: `"Select bike to check fit"`.

### B. Currency & Price Display
- Standard: Philippine Pesos (`₱`).
- Always format with commas and two decimals: `₱1,250.00`.
- Always declare `fontVariant: ['tabular-nums']` to ensure numeral columns align without horizontal shifting.

### C. Unified Modal Bottom Sheet Architecture
All popups, filters, and vehicle selection sheets must match the **Category Selection Modal (Image 1)** standard:
- Slide-up bottom sheet with `borderTopLeftRadius: 28` and `borderTopRightRadius: 28`.
- Header layout:
  - 38×38 px peach badge (`#FFF7ED`, border `#FED7AA`) with 17px `#F97316` icon.
  - Bold slate title (`16.5px`, `fontWeight: '800'`).
  - Descriptive subtitle (`12px`, `#64748B`).
  - 34×34 px circular dismiss button (`#F1F5F9`) with 14px `x-lg` icon.
- Actions: Full-width or paired buttons with `borderRadius: 14`.
- Safe area bottom padding: `paddingBottom: Platform.OS === 'ios' ? 30 : 16`.

### D. Periodic Maintenance Service (PMS) Pricing
Display fixed service pricing categorized by engine displacement tiers:
- Under 110cc
- 110cc – 125cc
- 126cc – 155cc
- 156cc – 200cc
- Above 200cc

---

## 7. React Native & Expo Coding Standards

1. **Expo Versioning**: Always develop against Expo SDK 57 (`https://docs.expo.dev/versions/v57.0.0/`).
2. **Clean Separation of Concerns**: Keep business logic, Supabase queries, and calculations inside dedicated services (`src/services/*`), custom hooks (`src/hooks/*`), or contexts. UI components only receive props and dispatch callbacks.
3. **No Web HTML/CSS on Mobile**: Never use `<div>`, `<button>`, `class=""`, or web CSS inside native mobile screens. Use React Native's `<View>`, `<Text>`, `<TouchableOpacity>`, and `<StyleSheet>`.
4. **List Performance**: Long catalogs must use `FlatList` with `initialNumToRender={8}`, `maxToRenderPerBatch={10}`, and a unique `keyExtractor`. Never render uncontrolled `.map()` arrays of 50+ items inside a raw `ScrollView`.
5. **Safe-Area Insets**: Use `SafeAreaView` from `react-native-safe-area-context` or compute explicit insets with `useSafeAreaInsets()`.
6. **Zero API Burn**: Adhere to `prevent-usage-burn` rules:
   - Debounce search inputs (`300ms`).
   - Cache results in memory where appropriate.
   - Never place Supabase fetches inside un-memoized useEffect dependencies.
   - Clean up Realtime subscriptions on unmount.

---

## 8. Step-by-Step UI Implementation Workflow

Whenever applying this skill to create or update a mobile screen:

1. **Inspect Existing UI & Context**:
   - Check existing screen implementation and styles.
   - Identify active props, state, and connected services.
2. **Determine Target Platform**:
   - Identify whether the task is iOS-specific, Android-specific, or shared mobile.
3. **Verify Brand & Design Tokens**:
   - Reference `tokens` in `references/component-patterns.md` and `mototrack-typography-system`.
4. **Clarify Primary User Goal**:
   - What is the customer trying to accomplish? (e.g., filter parts, register a bike, complete checkout). Keep this task effortless.
5. **Structure Layout & Hierarchy**:
   - Establish clear visual rhythm: Top App Bar -> Hero/Summary -> Filter Row -> Content Cards -> Sticky Safe-Area Footer.
6. **Implement Reusable Components**:
   - Use standard buttons (`borderRadius: 14`), cards, compatibility badges, and unified bottom sheets (`borderTopLeftRadius: 28`).
7. **Handle All Interaction States**:
   - Implement loading skeleton, empty state with forward guidance, and error feedback.
8. **Preserve Business Logic**:
   - Maintain authentication, cart totals, Supabase calls, and navigation callbacks intact.
9. **Verify Small Screens & Keyboard**:
   - Test layout with virtual keyboard open and on smaller screens (iPhone SE / 360dp Android).
10. **Validate Accessibility**:
    - Confirm touch targets (>= 44pt / 48dp), color contrast (>= 4.5:1), and VoiceOver/TalkBack labels.
11. **Perform Syntax & Bundle Verification**:
    - Validate with Babel or bundler to verify zero syntax errors.

---

## 9. Mobile UI Quality Checklist

Before completing any mobile UI task, verify every item:

- [ ] **Platform Native Feel**: Follows iOS or Android navigation, gestures, and system insets.
- [ ] **Typography Standard**: Uses **Plus Jakarta Sans** with clean size/weight hierarchy.
- [ ] **Touch Ergonomics**: All tappable elements meet `44×44 pt` (iOS) or `48×48 dp` (Android) touch targets.
- [ ] **Dual-Signaled Compatibility**: Motorcycle fitment displays an icon + explicit text (not color alone).
- [ ] **Currency Accuracy**: Prices use the `₱` symbol, 2 decimals, commas, and tabular numerals.
- [ ] **Unified Bottom Sheets**: Modals use slide animation, `borderTopLeftRadius: 28`, peach icon box, and safe-area padding.
- [ ] **Complete State Coverage**: Loading skeletons, empty states, and error alerts are fully implemented.
- [ ] **Safe-Area Protection**: Home indicator (iOS) and top camera cutouts (Android) do not clip content.
- [ ] **Keyboard Friendly**: Inputs avoid stuck states using `keyboardShouldPersistTaps="handled"`.
- [ ] **Zero API Burn**: No infinite polling, un-memoized fetches, or duplicate requests on re-render.
- [ ] **Web Protection**: Mobile refactoring does not alter web interfaces (`src/screens/web/*`).
- [ ] **Clean Compilation**: Zero JSX, style, or TypeScript/Babel parsing errors.

---

## 10. Example: Redesigning a Mobile Screen with This Skill

### Scenario: Refactoring a Motorcycle Selection Card

#### ❌ Before (Basic, Inconsistent, Poor Ergonomics):
```jsx
<View style={{ backgroundColor: '#333', padding: 10, borderRadius: 5 }}>
  <Text style={{ color: '#FFF', fontSize: 18 }}>{bike.model}</Text>
  <View style={{ backgroundColor: bike.isPrimary ? 'green' : 'gray', width: 10, height: 10 }} />
  <TouchableOpacity onPress={onSelect} style={{ backgroundColor: 'orange', padding: 5 }}>
    <Text>Select</Text>
  </TouchableOpacity>
</View>
```

#### ✅ After (Applying `modern-mobile-ui` Skill):
```jsx
<TouchableOpacity
  style={[styles.bikeCard, isSelected && styles.bikeCardActive]}
  onPress={onSelect}
  activeOpacity={0.8}
  accessible={true}
  accessibilityRole="button"
  accessibilityLabel={`${bike.brand} ${bike.model}, ${bike.plateNumber || 'No plate'}. ${isPrimary ? 'Primary motorcycle' : ''}`}
>
  {/* Left: Peach Motorcycle Icon Badge */}
  <View style={[styles.bikeIconBox, isSelected && styles.bikeIconBoxActive]}>
    <BootstrapIcon 
      name="scooter" 
      size={18} 
      color={isSelected ? '#FFFFFF' : '#F97316'} 
    />
  </View>

  {/* Center: Vehicle Details */}
  <View style={styles.bikeInfo}>
    <View style={styles.bikeTitleRow}>
      <Text style={styles.bikeBrandModel} numberOfLines={1}>
        {bike.brand} {bike.model}
      </Text>
      {isPrimary && (
        <View style={styles.primaryBadge}>
          <BootstrapIcon name="star-fill" size={10} color="#EA580C" />
          <Text style={styles.primaryBadgeText}>Primary</Text>
        </View>
      )}
    </View>
    <Text style={styles.bikeMeta}>
      {bike.year ? `${bike.year} • ` : ''}{bike.displacement || '125'}cc • {bike.plateNumber || 'Unregistered Plate'}
    </Text>
  </View>

  {/* Right: Selection Check Radio */}
  <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
    {isSelected && <BootstrapIcon name="check" size={14} color="#FFFFFF" />}
  </View>
</TouchableOpacity>

const styles = StyleSheet.create({
  bikeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  bikeCardActive: {
    backgroundColor: '#FFF7ED',
    borderColor: '#F97316',
  },
  bikeIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  bikeIconBoxActive: {
    backgroundColor: '#F97316',
    borderColor: '#F97316',
  },
  bikeInfo: {
    flex: 1,
  },
  bikeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  bikeBrandModel: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  primaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  primaryBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
  },
  bikeMeta: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  radioCircleActive: {
    backgroundColor: '#F97316',
    borderColor: '#F97316',
  },
});
```
