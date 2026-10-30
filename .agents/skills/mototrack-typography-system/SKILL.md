---
name: mototrack-typography-system
description: >-
  Enforces clean MOTOTRACK typography standards using Inter as the primary approved font family
  with 400/500/600/700 font weights, tabular numbers, and charcoal/orange brand styling. Use when
  modifying or creating UI across admin dashboards, tables, KPI cards, sidebar navigation, forms,
  modals, status badges, or when the user mentions typography, font sizes, font weights, tabular
  numbers, or clean UI.
---

# MOTOTRACK Typography System

Single source of truth and architectural guidelines for typography across **MOTOTRACK**.

## Core Tenet: Clean, Consistent Typography (Inter)

- **Inter** is the sole approved typeface for all MOTOTRACK web and shared interfaces, loaded with clean system OS fallbacks:
  ```css
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
  ```
- **Approved Weights**: 400 (Regular), 500 (Medium), 600 (SemiBold), and 700 (Bold).
- **Prohibited Weights**: Never use 800 (ExtraBold) or 900 (Black). Visual hierarchy is achieved through size, color, and spacing, not heavy font weights.
- **Monospace Exception**: Monospace fonts (`SFMono-Regular`, `Menlo`, `monospace`) are strictly reserved for raw telemetry logs, VIN numbers, and thermal receipt tickets.

---

## 1. Typography Hierarchy & Standard Scale

Every UI element must adhere to these standardized token values:

| Element | Size | Weight | Line Height | Letter Spacing | Token (`src/styles/typography.js`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Page Headers** | `20px` | `700` (Bold) | `26px` | `-0.25px` | `typography.pageHeader` |
| **Section Headers** | `16px` | `600` (SemiBold) | `22px` | `-0.2px` | `typography.sectionHeader` |
| **KPI Figures** | `28–30px` | `700` (Bold) | `34px` | `-0.5px` | `typography.kpiFigure` |
| **KPI Compact / Secondary** | `22–24px` | `700` (Bold) | `28px` | `-0.4px` | `typography.kpiFigureCompact` |
| **Card Titles** | `13.5–14px` | `600` (SemiBold) | `20px` | `-0.1px` | `typography.cardTitle` |
| **Sidebar Navigation (Default)** | `13.5px` | `500` (Medium) | `18px` | `0` | `typography.sidebarNav` |
| **Sidebar Navigation (Active)** | `13.5px` | `600` (SemiBold) | `18px` | `0` | `typography.sidebarNavActive` |
| **Body Text** | `13px` | `400` (Regular) | `18px` | `0` | `typography.body` |
| **Body Text (Medium / Emphasized)** | `13px` | `500` (Medium) | `18px` | `0` | `typography.bodyMedium` |
| **Supporting Descriptions** | `11.5px` | `400` (Regular) | `16px` | `0` | `typography.supporting` |
| **Supporting (Medium)** | `11.5px` | `500` (Medium) | `16px` | `0` | `typography.supportingMedium` |
| **Small Labels & Overlines** | `9.5–10.5px` | `500` (Medium) | `14px` | `+0.4px` | `typography.smallLabel` |
| **Small Labels (Uppercase / Badges)**| `9.5–10.5px` | `600` (SemiBold) | `14px` | `+0.5px` | `typography.smallLabelCaps` |
| **Buttons & Action Tabs** | `12.5–13px` | `600` (SemiBold) | `18px` | `+0.1px` | `typography.button` / `typography.tab` |
| **Table Headers** | `11.5px` | `600` (SemiBold) | `16px` | `+0.5px` | `typography.tableHeader` |
| **Table Cells** | `12.5–13px` | `400` / `500` | `18px` | `0` | `typography.tableCell` |
| **Featured Currency Figures** | `18–20px` | `700` (Bold) | `24px` | `-0.3px` | `typography.currencyTotal` |
| **Standard Currency Figures** | `13–15px` | `600` (SemiBold) | `18px` | `-0.1px` | `typography.currency` |

---

## 2. Tabular Numbers & Financial Figures

1. **Tabular Numerals Enforcement**:
   - In React Native Web / Mobile: Always include `fontVariant: ['tabular-nums']`.
   - In CSS / Tailwind: Always include `.tabular-nums` (`font-variant-numeric: tabular-nums;`).
2. **Currency Symbol Proportions**:
   - The Philippine Peso symbol (`₱`) must match the figure's weight and font family.
3. **Metric Card Scanning**:
   - KPI values (`28–30px`, weight `700`) must be distinctly dominant over card titles (`13.5–14px`, weight `600`) and subtext (`11.5px`, weight `400`).

---

## 3. Brand Colors & UI Preservation

- **Preserve Brand Palette**:
  - Primary Brand Accent: `#EA580C` (Racing Orange)
  - Dark Header / Sidebar: `#24272B` (Charcoal)
  - Surface Background: `#FFFFFF`
  - Body Background: `#F3F4F6` (Light Gray)
  - Text Primary: `#0F172A` / `#111827`
  - Text Muted: `#64748B` / `#6B7280`
- **Preserve Functionality**: Never alter event handlers, modal logic, navigation parameters, or API integration when refining typography.

---

## 4. Pre-Flight Verification Checklist

```markdown
- [ ] Inter is the universal font family.
- [ ] Weights are strictly 400 (regular), 500 (medium), 600 (semibold), or 700 (bold). Zero instances of 800 or 900.
- [ ] Page headers are 20px (weight 700), section headers are 16px (weight 600).
- [ ] KPI figures are 28–30px (weight 700) with fontVariant: ['tabular-nums'].
- [ ] Card titles are 13.5–14px (weight 600).
- [ ] Sidebar navigation items are 13.5px (weight 500 for normal, 600 for active).
- [ ] Body text is 12–13px (weight 400), supporting text is 11–11.5px (weight 400).
- [ ] Small labels and badges are 9.5–10.5px (weight 500/600).
- [ ] Buttons and action tabs are 12.5–13px (weight 600).
- [ ] Brand colors (#EA580C, #24272B) are preserved.
- [ ] All code compiles cleanly without syntax or lint errors.
```
