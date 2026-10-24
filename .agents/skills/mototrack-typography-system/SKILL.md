---
name: mototrack-typography-system
description: >-
  Enforces MOTOTRACK typography standards using Plus Jakarta Sans as the ONLY
  approved font family. Use when modifying or creating UI across admin dashboards,
  tables, KPI cards, sidebar navigation, forms, modals, status badges, or when the
  user mentions typography, font sizes, font weights, tabular numbers, or Plus Jakarta Sans.
---

# MOTOTRACK Typography System

Single source of truth and architectural guidelines for typography across **MOTOTRACK**.

## Core Tenet: Plus Jakarta Sans is the Only Approved Font Family

- **Plus Jakarta Sans** is the sole approved typeface for all MOTOTRACK interfaces (Admin, Shop, Rider, POS, and Shared Web/Mobile).
- **Zero secondary brand typefaces:** Never import or specify Inter, Poppins, Roboto, Manrope, Playfair, Arial, or generic fonts as brand styling.
- OS fallback stacks may only be used as standard system fallbacks:
  ```css
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
  ```
- **Monospace Exception:** Monospace fonts (`SFMono-Regular`, `Menlo`, `monospace`) are strictly reserved for code blocks, raw telemetry logs, and thermal receipt ticket simulation.

---

## 1. Typography Hierarchy & Standard Scale

Every UI element must adhere to these standardized token values:

| Element | Size | Weight | Line Height | Letter Spacing | Token (`src/styles/typography.js`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Page Headers** | `20px` | `700` (Bold) | `26–28px` | `-0.25px` | `typography.pageHeader` |
| **Section Headers** | `16px` | `700` (Bold) | `22px` | `-0.2px` | `typography.sectionHeader` |
| **KPI Figures** | `28–32px` (`30px` def) | `800` (ExtraBold) | `34–36px` | `-0.5px` | `typography.kpiFigure` |
| **KPI Compact / Secondary** | `24–26px` | `800` (ExtraBold) | `30–32px` | `-0.4px` | `typography.kpiFigureCompact` |
| **Card Titles** | `13–15px` (`14px` def) | `600` or `700` | `20px` | `-0.1px` | `typography.cardTitle` |
| **Sidebar Navigation (Default)** | `13–14px` (`13.5px`) | `500` (Medium) | `18px` | `0` | `typography.sidebarNav` |
| **Sidebar Navigation (Active)** | `13–14px` (`13.5px`) | `600` (SemiBold) | `18px` | `0` | `typography.sidebarNavActive` |
| **Body Text** | `12–14px` (`13px` def) | `400` (Regular) | `18px` | `0` | `typography.body` |
| **Body Text (Medium / Emphasized)** | `12–14px` (`13px` def) | `500` (Medium) | `18px` | `0` | `typography.bodyMedium` |
| **Supporting Descriptions** | `11–12px` (`11.5px`) | `400` (Regular) | `16px` | `0` | `typography.supporting` |
| **Supporting (Medium)** | `11–12px` (`11.5px`) | `500` (Medium) | `16px` | `0` | `typography.supportingMedium` |
| **Small Labels & Overlines** | `10–11px` (`10.5px`) | `500` (Medium) | `14px` | `+0.4px` | `typography.smallLabel` |
| **Small Labels (Uppercase / Badges)**| `10–11px` (`10.5px`) | `600` (SemiBold) | `14px` | `+0.8px` | `typography.smallLabelCaps` |
| **Buttons & Tabs** | `12–14px` (`13px` def) | `600` (SemiBold) | `18px` | `+0.1px` | `typography.button` / `typography.tab` |
| **Table Headers** | `11.5px` | `600` (SemiBold) | `16px` | `+0.5px` | `typography.tableHeader` |
| **Table Cells** | `12.5–13px` | `500` (Medium) | `18px` | `0` | `typography.tableCell` |
| **Table Subtext** | `11–11.5px` | `400` (Regular) | `16px` | `0` | `typography.tableCellMuted` |
| **Currency Figures** | `13.5–16px` | `700` (Bold) | `18–22px` | `-0.2px` | `typography.currency` |

> [!NOTE]
> Treat these sizes as strict defaults. Slight adjustments (±0.5–1px) are permitted only to accommodate tight component constraints or mobile accessibility.

---

## 2. Dashboard Figures, Metrics & Tabular Numbers

Financial figures, orders, stock counts, and timestamps must scan cleanly without vertical jitter:

1. **Tabular Numerals Enforcement**:
   - In React Native Web / Mobile: Always include `fontVariant: ['tabular-nums']`.
   - In CSS / Tailwind: Always include `.tabular-nums` (`font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1;`).
2. **Currency Symbol Proportions**:
   - The Philippine Peso symbol (`₱`) must match the figure's weight and font family (Plus Jakarta Sans supports unicode `₱` natively).
   - Never use arbitrary italicization or differing font families for currency signs.
3. **Metric Card Scanning**:
   - KPI values (`28–32px`, weight `800`) must be distinctly dominant over card titles (`13–15px`, weight `600`) and subtext (`11–12px`, weight `400`).

```jsx
// Correct KPI Metric Implementation:
<Text
  style={{
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
    letterSpacing: -0.5,
    color: theme.textPrimary,
    fontVariant: ['tabular-nums'],
    fontFamily: fontFamily.sans,
  }}
>
  ₱124,500.00
</Text>
```

---

## 3. Reusable Tokens & Architecture

Typography tokens are centralized and shared across the entire project:

### A. JavaScript / React Native Tokens (`src/styles/typography.js`)
Import tokens directly into StyleSheets or components:
```javascript
import { typography, fontFamily, fontSizes, fontWeights } from '../styles/typography.js';
// Or from theme.js:
import { typography } from '../styles/theme.js';

const styles = StyleSheet.create({
  header: {
    ...typography.pageHeader,
    color: theme.textPrimary,
  },
  kpi: {
    ...typography.kpiFigure,
    color: theme.textPrimary,
  },
  navLabel: {
    ...typography.sidebarNav,
    color: theme.textSecondary,
  },
  navLabelActive: {
    ...typography.sidebarNavActive,
    color: '#FFFFFF',
  },
});
```

### B. CSS Variables (`global.css`)
For web markup and Tailwind CSS components:
```css
:root {
  --font-family-sans: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --font-size-page-header: 20px;
  --font-size-section-header: 16px;
  --font-size-kpi: 30px;
  --font-size-card-title: 14px;
  --font-size-sidebar-nav: 13.5px;
  --font-size-body: 13px;
  --font-size-supporting: 11.5px;
  --font-size-small-label: 10.5px;
  --font-size-button: 13px;

  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  --font-weight-extrabold: 800;
}
```

Predefined CSS classes in `global.css`:
- `.typography-page-header`
- `.typography-section-header`
- `.typography-kpi`
- `.typography-card-title`
- `.typography-sidebar-nav`
- `.typography-sidebar-nav-active`
- `.typography-body`
- `.typography-supporting`
- `.typography-small-label`
- `.typography-btn`
- `.tabular-nums`

---

## 4. Accessibility & Contrast Standards

1. **Contrast Ratios (WCAG 2.1 AA Compliance)**:
   - Normal text (`< 18px` regular or `< 14px` bold): Minimum contrast ratio **4.5:1** against the background.
   - Large text (`≥ 18px` regular or `≥ 14px` bold): Minimum contrast ratio **3.0:1**.
   - Muted secondary text (`theme.textMuted`): Use `#64748B` (Light) and `#AAB4B0` (Dark) to ensure at least 4.5:1 ratio against their card backgrounds.
2. **Font Smoothing & Rendering**:
   - `antialiased` and `text-rendering: optimizeLegibility` must be active globally on web.
3. **No Decorative Weight Reductions**:
   - Never reduce body text below `400` weight (avoid `200` or `300` for body/descriptions as it causes thin, unreadable rendering on low-DPI displays).

---

## 5. Responsive Typography Rules

MOTOTRACK dashboards must adapt gracefully across device viewports:

| Element | Desktop (`≥ 1024px`) | Tablet (`768px – 1023px`) | Mobile (`< 768px`) |
| :--- | :--- | :--- | :--- |
| **Page Header** | `20px` (lineHeight `26px`) | `19px` | `18px` (lineHeight `24px`) |
| **Section Header** | `16px` (lineHeight `22px`) | `15px` | `15px` |
| **KPI Metric** | `30px` (or `28–32px`) | `26–28px` | `24–26px` (lineHeight `30px`) |
| **Card Title** | `14px` | `13.5px` | `13px` |
| **Sidebar / Tab Nav** | `13.5px` | `13px` | `12.5px` (Bottom Bar: `10.5px` labels) |
| **Body Text** | `13px` | `13px` | `12.5px` |
| **Supporting Text** | `11.5px` | `11.5px` | `11px` |

---

## 6. Preservation of Existing Design & Functionality

- **Do Not Redesign the Layout:** Never alter the existing grid, cards, spacing, borders, or navigation structure unless necessary to fix a typography overflow.
- **Preserve Brand Colors:**
  - Primary Brand Green: `#1D4533`
  - Brand Dark: `#143325`
  - Accent Green: `#10B981`
  - Dark Charcoal Theme: `#0F1412`, `#151C19`, `#1A2320`
- **Preserve Functionality:** Keep all event handlers, modals, navigation callbacks, and data fetching intact.

---

## 7. AI Agent Operating Instructions

When an AI agent is asked to work on MOTOTRACK UI:

1. **Read This Skill**: Review these standards before making any typography or styling changes.
2. **Inspect Existing Tokens**: Check `src/styles/typography.js`, `src/styles/theme.js`, and `src/styles/admin.styles.js` before writing inline styles.
3. **Use Shared Tokens**: Reuse `typography.*` and `fontFamily.sans`. Never declare raw font family strings containing unapproved fonts (`Poppins`, `Inter`, `Manrope`, `Playfair`).
4. **Enforce Tabular Nums**: Apply `fontVariant: ['tabular-nums']` or `.tabular-nums` to every currency, count, or metric display.
5. **Check Weights & Sizes**: Keep headers at `20px`/`16px` weight `700`, KPIs at `28–32px` weight `800`, card titles at `13–15px` weight `600–700`, nav at `13.5px` weight `500/600`.
6. **Validate Syntax & Compilation**: Run AST verification / build checks on modified files.
7. **Report Deliverables**: Clearly list files modified/created and verify compliance against the checklist.

---

## 8. Pre-Flight Verification Checklist

Before completing any typography-related task, verify:

```markdown
- [ ] Plus Jakarta Sans is the ONLY font family used (no Inter, Poppins, Roboto, etc.).
- [ ] Page headers are 20px (weight 700).
- [ ] Section headers are 16px (weight 700).
- [ ] KPI figures are 28–32px (weight 800) with fontVariant: ['tabular-nums'].
- [ ] Card titles are 13–15px (weight 600 or 700).
- [ ] Sidebar navigation items are 13–14px (weight 500 for normal, 600 for active).
- [ ] Body text is 12–14px (weight 400).
- [ ] Supporting descriptions are 11–12px (weight 400).
- [ ] Small labels and badges are 10–11px (weight 500/600).
- [ ] Buttons and action tabs are 12–14px (weight 600).
- [ ] Existing brand colors (#1D4533, #10B981, dark theme) and layout structure are preserved.
- [ ] No duplicate styles or unnecessary `!important` declarations added.
- [ ] All code compiles cleanly without syntax or lint errors.
```
