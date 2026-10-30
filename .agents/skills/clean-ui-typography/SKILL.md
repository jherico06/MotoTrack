---
name: clean-ui-typography
description: >-
  Standardizes clean UI typography across MOTOTRACK using Inter/system sans font family
  with balanced 400/500/600 font weights, refined typographic hierarchy, subtle labels,
  tabular numbers, and orange brand accent harmony. Use when working on fonts, text styling,
  headers, cards, tables, forms, modals, or when the user mentions typography, font weights,
  or clean UI.
---

# Clean UI Typography System

Single source of truth and architectural design standard for clean, modern, and accessible typography across **MOTOTRACK**.

---

## 1. Core Principles

1. **Balanced Font Weights (400 / 500 / 600)**:
   - **400 (Regular)**: Body copy, long-form descriptions, muted table cells, form placeholders, secondary timestamps.
   - **500 (Medium)**: Medium body emphasis, standard sidebar nav items, input field values, neutral chips.
   - **600 (SemiBold)**: Page titles, section headings, card titles, active navigation states, primary buttons, table headers, status badges.
   - **700 (Bold)**: Reserved strictly for hero page headers (`20px`) and primary KPI metric figures (`28–30px`).
   - **Zero Synthetic Bolding (No 800 / 900)**: Never specify `font-extrabold`, `font-black`, `800`, or `900`. The loaded Google Font (`Inter`) contains weights `300;400;500;600;700`. Heavier weights trigger unsightly synthetic browser font distortion.

2. **Hierarchy Through Size, Spacing & Color (Not Raw Weight)**:
   - Establish distinction between headers, card titles, and labels through carefully calibrated font sizes, line heights, and neutral text colors (`#0F172A` primary, `#64748B` secondary/muted) rather than bolding every element.
   - Prevent visual crowding by maintaining comfortable line heights (`16–22px`).

3. **Consistent Single Font Family**:
   - **Inter** is the standard font family across web and shared views, backed by clean OS system fallbacks:
     ```css
     font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
     ```

4. **Tabular Numbers for Financial & Metric Alignment**:
   - Financial figures (`₱`), order counts, inventory quantities, percentages, and timestamps must always enable tabular numbers:
     - React Native: `fontVariant: ['tabular-nums']`
     - CSS / Web: `.tabular-nums` (`font-variant-numeric: tabular-nums;`)

5. **Brand Harmony**:
   - Accent orange (`#EA580C` / `#F97316`) is used for primary buttons, active tabs, critical total figures, and status dots.
   - Dark surfaces use Charcoal (`#24272B` / `#181A1D`) with high-contrast text (`#FFFFFF`, `#94A3B8`).

---

## 2. Typographic Scale & Hierarchy

| UI Element | Size | Weight | Line Height | Letter Spacing | Color (Light / Dark) | Token Presets |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Page Header** | `20px` | `700` | `26px` | `-0.25px` | `#0F172A` / `#FFFFFF` | `typography.pageHeader` |
| **Section Header** | `16px` | `600` | `22px` | `-0.2px` | `#0F172A` / `#F1F5F9` | `typography.sectionHeader` |
| **KPI Primary Metric** | `28–30px` | `700` | `34px` | `-0.5px` | `#0F172A` / `#FFFFFF` | `typography.kpiFigure` |
| **KPI Compact / Secondary** | `22–24px` | `700` | `28px` | `-0.4px` | `#0F172A` / `#FFFFFF` | `typography.kpiFigureCompact` |
| **Card Title** | `13.5–14px` | `600` | `20px` | `-0.1px` | `#0F172A` / `#F1F5F9` | `typography.cardTitle` |
| **Sidebar Nav (Default)** | `13.5px` | `500` | `18px` | `0` | `rgba(255,255,255,0.7)` | `typography.sidebarNav` |
| **Sidebar Nav (Active)** | `13.5px` | `600` | `18px` | `0` | `#FFFFFF` | `typography.sidebarNavActive` |
| **Body Text** | `13px` | `400` | `18px` | `0` | `#334155` / `#CBD5E1` | `typography.body` |
| **Body (Emphasized)** | `13px` | `500` | `18px` | `0` | `#0F172A` / `#FFFFFF` | `typography.bodyMedium` |
| **Supporting / Subtext** | `11.5px` | `400` | `16px` | `0` | `#64748B` / `#94A3B8` | `typography.supporting` |
| **Small Label / Overline** | `9.5–10px` | `600` | `14px` | `+0.5px` | `#64748B` / `#94A3B8` | `typography.smallLabelCaps` |
| **Button / Interactive** | `12.5–13px` | `600` | `18px` | `+0.1px` | `#FFFFFF` / `#334155` | `typography.button` |
| **Table Header** | `11.5px` | `600` | `16px` | `+0.5px` | `#475569` / `#94A3B8` | `typography.tableHeader` |
| **Table Cell** | `12.5–13px` | `400` / `500` | `18px` | `0` | `#1E293B` / `#E2E8F0` | `typography.tableCell` |
| **Featured Currency Total** | `18–20px` | `700` | `24px` | `-0.3px` | `#EA580C` | `typography.currencyTotal` |
| **Inline Currency Amount** | `13–15px` | `600` | `18px` | `-0.1px` | `#0F172A` / `#EA580C` | `typography.currency` |

---

## 3. Component Application Guidelines

### A. Admin Dashboard & Sidebar
- **Navigation Links**: Standard links must use `fontWeight: '500'`. Active links use `fontWeight: '600'` with a subtle background badge (`#EA580C` or charcoal hover).
- **Stat Cards**: Stat titles are `13px` (`500` or `600` muted `#64748B`). Big figures are `28–30px` (`700`, never `800`). Percentage badges are `11px` (`600`).

### B. Cards & Tables
- **Table Headers**: Uppercase, `11.5px`, `fontWeight: '600'`, color `#64748B`.
- **Table Rows**: Standard data uses `12.5px`, `fontWeight: '400'` or `'500'`. IDs or SKUs use `11.5px` mono or tabular numbers.
- **Status Badges**: `10.5–11px`, `fontWeight: '600'`, soft pastel backgrounds with dark tinted text (e.g., `#DCFCE7` with `#166534`).

### C. Forms & Inputs
- **Field Labels**: `11.5px`, `fontWeight: '600'`, color `#334155`.
- **Input Text**: `13px`, `fontWeight: '400'`, color `#0F172A`.
- **Helper Text**: `11px`, `fontWeight: '400'`, color `#64748B`.

### D. Modals, Service Booking & Checkout
- **Modal Header**: `18px`, `fontWeight: '700'`, subtitle `9.5px` uppercase `fontWeight: '600'`.
- **Card Subheadings**: `13.5px`, `fontWeight: '600'`.
- **Detail Grids**: Label `9.5–10px` (`400` muted), value `11.5px` (`600` `#0F172A`).
- **Service Breakdown**: Line item `11.5px` (`600`), service description `9.5–10px` (`400`), totals `18–20px` (`700` orange `#EA580C`).

---

## 4. Shared Tokens Reference (`src/styles/typography.js`)

```javascript
import { typography, fontWeights, fontSizes, fontFamily } from '../styles/typography.js';

// Example: Header
<Text style={typography.pageHeader}>Motorcycle Garage</Text>

// Example: Clean Card Title
<Text style={typography.cardTitle}>2026 Suzuki Smash 125</Text>

// Example: Currency Figure with Tabular Numbers
<Text style={typography.currencyTotal}>₱1,350.00</Text>
```

---

## 5. Pre-Flight Verification Checklist

```markdown
- [ ] Font weights are strictly 400 (regular), 500 (medium), 600 (semibold), or 700 (bold).
- [ ] Zero instances of 800 (ExtraBold) or 900 (Black).
- [ ] Inter font family is applied universally with standard OS fallbacks.
- [ ] Numeric, price, and timestamp fields include tabular-nums.
- [ ] Contrast meets WCAG 2.1 AA (at least 4.5:1 for body text, 3:1 for large headers).
- [ ] Brand colors (#EA580C orange, #24272B charcoal) are preserved.
- [ ] Text wraps cleanly without truncation or overflow across viewports.
```
