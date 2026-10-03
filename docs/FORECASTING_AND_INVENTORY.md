# MotoTrack — Forecasting & Inventory Improvement Plan

Audit date: 2026-09-29
Scope: demand forecasting and inventory management
Every claim below cites the file and line where the current behaviour lives.

Related docs: [USE_CASES.md](./USE_CASES.md) (feature inventory), [ROLES.md](./ROLES.md) (roles)

---

## Summary

The forecast is ordinary least squares on a period index. Motorcycle parts demand is
sparse, lumpy, and seasonal, which is the case linear regression handles worst. Separately,
stock deduction is not atomic, there is no movement history, and the reorder threshold is a
hardcoded constant that the database column is never read from.

Three changes carry most of the value:

1. Move stock movement into an atomic Postgres function.
2. Add an append-only `inventory_transactions` ledger.
3. Replace OLS with Croston/SBA plus a seasonal index.

The rest of this document is the long game.

---

## Part 1 — Current state

### 1.1 Forecast algorithm

`src/utils/linearRegression.js:24-81` — standard OLS on `(x = period index, y = units)`.

```
meanX = Σx / n
meanY = Σy / n
slope = Σ((X - meanX)(Y - meanY)) / Σ((X - meanX)²)
intercept = meanY - slope * meanX
```

Constraints in the implementation:

| Behaviour | Location |
|---|---|
| Aborts below 2 points, returns `sufficient: false` | `linearRegression.js:9, 31-42` |
| Identical X values fall back to a flat line at `meanY` | `linearRegression.js:56-67` |
| `predictY` floors at 0 | `linearRegression.js:87-91` |
| Trend classified by `slope / max(\|meanY\|, 1)`, ±5% threshold | `linearRegression.js:117-118` |

`MIN_REGRESSION_PERIODS = 2` (`:9`) is the core weakness. A product with one unit sold on
two different days produces a full-looking trend and a confident restock number.

### 1.2 Forecast pipeline

| Step | Location | Behaviour |
|---|---|---|
| Flatten orders to rows | `forecastService.js:128-168` | Skips `CANCELLED` and `REFUNDED` (`:141-142`) |
| Bucket by period | `forecastService.js:173-228` | Back-fills empty periods as true zeros (`:204-219`) |
| Resolve granularity | `forecastService.js:234-269` | Auto-downgrades day → week → month until 2+ buckets exist |
| Per-product forecast | `forecastService.js:319-467` | OLS, project `forecastAhead`, compute stock policy |
| Per-category forecast | `forecastService.js:516-670` | Same math at category level |

### 1.3 Restock and stock status

`forecastService.js:274-307`:

```js
// Recommended Restock = Forecasted Demand + Safety Stock - Current Stock
return Math.max(0, Math.round(forecast + safety - stock));
```

```js
if (stock <= 0) return 'Critical Stock';
if (forecast > 0 && stock < forecast * 0.35) return 'Critical Stock';
if (need > 0 && stock < need) return 'Low Stock';
if (forecast > 0 && stock > forecast * 2 + safety) return 'Overstocked';
return 'Healthy Stock';
```

Safety stock (`:284-291`) is a global absolute-unit or percent preference, persisted to
`localStorage` under `mototrack_forecast_safety_prefs` (`:19, 717-742`). It is not per-product
and not server-side, so two devices can disagree and neither is auditable.

### 1.4 Forecast history

- `forecast_history` table: `schema.sql:692-709` — stores `predicted_quantity`,
  `actual_quantity`, `slope`, `intercept`, `safety_stock`, `current_stock`,
  `recommended_restock`, `period_key`.
- `saveForecastHistory` (`forecastService.js:766-801`) upserts, falling back to
  `localStorage` capped at 200 rows.
- `getForecastHistory` (`:806-848`) back-fills actuals by summing sales into `period_key`,
  but only distinguishes `month` vs `week` (`:832`). **Day-period forecasts are never
  scored.**
- Snapshots are only written when an admin presses Generate
  (`SalesForecastPanel.jsx:306-326`). There is no scheduled run.

### 1.5 Data available and unused

Present in the schema, not used by the forecast:

| Signal | Where | Opportunity |
|---|---|---|
| Channel split | `orders.channel` = `'Online Store'` / `'POS (In-Store)'` (`orderService.js:2441`) | Model separately so a walk-in event does not distort the online curve |
| Promo / discount | `orders.discount_amount`, `promos`, `discounts` | Post-promo demand spikes are currently indistinguishable from organic trend |
| Realised price | `order_items.subtotal`, `orders.old_price` | Price elasticity as a regression feature |
| COGS snapshot | `order_items.unit_cost`, `products.unit_cost` | Margin-aware restock prioritisation — restock profitable SKUs first |
| Cost history | `product_cost_history` (`schema.sql:712-719`) | Detect margin erosion |
| Supplier lead time | `suppliers.lead_time` (`005_suppliers_enhancements.sql:9`) | See 2.3 — not just unused, also unparseable |

Note: `lead_time` is a `TEXT` column defaulting to `'3-5 Days'`, not a numeric day count.
It needs a numeric `lead_time_days` alongside it before any reorder formula can use it.

### 1.6 Data missing

- **No stock movement ledger.** Every quantity change is an in-place upsert of
  `inventory.stock_quantity` (`productService.js:65-104`). No reason code, no actor, no
  history. Demand signal exists; supply signal does not.
- **No `reorder_level` in practice.** `upsertInventoryStock` hardcodes `reorder_level: 5`
  on every write (`productService.js:74, 98`) and never selects the column
  (`:179` selects only `inventory(stock_quantity)`). The column is write-only.
- **No reservations.** Stock is deducted at order creation (`orderService.js:1230`) with
  no hold, so in-flight orders are indistinguishable from available stock.
- **No warehouse, bin, lot, or serial.** Single-location integer quantity.
- **No cycle counts, no ABC/XYZ classification, no shrinkage tracking.**
- **No external features.** No weather (a major Philippine motorcycle-seasonality driver),
  no holiday or event calendar, no marketing spend.

---

## Part 2 — Inventory correctness (fix before any modeling)

### 2.1 Stock deduction is not atomic — data loss bug

`productService.js:864-895` performs SELECT-then-UPSERT per line item, with no row lock and
no `WHERE stock_quantity >= qty` guard:

```js
const { data: invRows, error } = await client
  .from('inventory')
  .select('product_id, stock_quantity')
  .eq('product_id', step.productId)
  .limit(1);
// ...
if (remoteStock < step.quantity) { /* reject */ }
const newQty = remoteStock - step.quantity;
await upsertInventoryStock(client, step.productId, newQty);
```

Two concurrent checkouts both read the same `remoteStock`, both pass the check, and both
succeed. The second write silently overwrites the first. This is already flagged in
`docs/FIX_ALL_SYSTEMS_PROMPT.md:27-33, 184-191`.

**Fix:** one Postgres function, and delete the client-side select-then-upsert path.

```sql
CREATE OR REPLACE FUNCTION public.fn_adjust_stock(
  p_product_id text,
  p_delta      integer,
  p_reason     text,
  p_ref_type   text DEFAULT NULL,
  p_ref_id     text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE v_new integer;
BEGIN
  UPDATE public.inventory
     SET stock_quantity = stock_quantity + p_delta,
         last_updated    = now()
   WHERE product_id = p_product_id
     AND stock_quantity + p_delta >= 0
  RETURNING stock_quantity INTO v_new;

  IF v_new IS NULL THEN
    RAISE EXCEPTION 'insufficient_stock:%', p_product_id;
  END IF;

  INSERT INTO public.inventory_transactions
    (product_id, qty_delta, reason, reference_type, reference_id)
  VALUES (p_product_id, p_delta, p_reason, p_ref_type, p_ref_id);

  RETURN v_new;
END;
$$;
```

Zero rows returned means insufficient stock. The same function writes the ledger row, so
the two can never diverge. Then remove the `Math.max(0, ...)` clamps at
`productService.js:540, 615, 857, 929` — they exist only to paper over the race.

Also worth fixing while in this code: `rollbackRemote` (`:844-853`) swallows errors, so a
mid-loop network failure leaves inventory partially deducted with nothing to reconcile
against. The function approach makes each line independently committed, which removes the
need for a compensating rollback entirely.

### 2.2 Add the inventory transactions ledger

Single highest-value schema change. Without it, shrinkage, lead-time demand, reorder points,
and forecast accuracy are all uncomputable.

```sql
CREATE TABLE public.inventory_transactions (
  txn_id          text PRIMARY KEY DEFAULT ('itx-' || substr(md5(random()::text), 1, 12)),
  product_id      text NOT NULL REFERENCES public.products(product_id),
  qty_delta       integer NOT NULL,
  reason          text NOT NULL CHECK (reason IN
                    ('sale','return','restock','adjustment','count','shrinkage')),
  reference_type  text,
  reference_id    text,
  actor_id        text,
  balance_after   integer,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invtxn_product_created
  ON public.inventory_transactions (product_id, created_at DESC);
```

`inventory.stock_quantity` stays as a cached balance — the ledger is the source of truth for
*why*, the balance is for speed. A nightly reconciliation query comparing
`SUM(qty_delta)` to `stock_quantity` should return zero rows; alert if it does not.

### 2.3 Make `reorder_level` real

The column exists (`schema.sql` `inventory.reorder_level integer DEFAULT 5`) but is
write-only. Three changes:

1. Select it. Add `reorder_level` to the product query at `productService.js:179`.
2. Let admins edit it per SKU in the inventory tab.
3. Delete the hardcoded `5` literals:

| Location | Expression |
|---|---|
| `AdminDashboard.web.jsx:573` | `Number(p.stock \|\| 0) <= 5` |
| `AdminDashboard.web.jsx:996-997` | `>= 5`, `> 0 && < 5` |
| `AdminDashboard.web.jsx:1074-1075` | `>= 5`, `> 0 && < 5` |
| `AdminDashboard.web.jsx:2958` | `< 5` |
| `AdminDashboard.web.jsx:6834` | `> 0 && < 5` |
| `AdminDashboard.jsx:588-589` | `>= 5`, `> 0 && < 5` |
| `AdminDashboard.jsx:660-661` | `>= 5`, `> 0 && < 5` |
| `excelService.js:21, 27` | `< 5`, `p.stock` |
| `excelService.js:72-74` | `>= 5`, `> 0 && < 5` |
| `notificationService.js:1114` | `minThreshold = 5` default |

Add companion columns while you are there:

```sql
ALTER TABLE public.inventory
  ADD COLUMN reorder_point   integer,
  ADD COLUMN order_quantity   integer DEFAULT 1,   -- pack size / MOQ
  ADD COLUMN supplier_id      text REFERENCES public.suppliers(supplier_id),
  ADD COLUMN lead_time_days   integer DEFAULT 3;
```

Also note: `products.stock` was dropped in `009_normalize_schema.sql:82`, but
`productService.js:205` still has `Number(inv?.stock_quantity ?? item.stock ?? 0)` and
`excelService.js:21` still reads `p.stock`. The `?? item.stock` branch is dead and will
silently mask a broken inventory join by falling back to 0.

### 2.4 Lock down RLS

`supabase/migrations/20260921002000_products_inventory_write_rls.sql:22-29`:

```sql
CREATE POLICY "allow_anon_write_inventory" ON public.inventory
  FOR ALL USING (true) WITH CHECK (true);
```

Anyone holding the anon key — which ships in the client bundle — can zero out inventory.
`forecast_history` has the same pattern (`20260919153000_forecast_history.sql:30-33`).

Replace with `auth.uid()`-scoped admin checks. Note the migration comment claims this
"matches the allow_anon_* write pattern used elsewhere in this project" — that pattern is
the problem, not the precedent.

Related: `src/config/index.js:19-20` defaults `secretKey: 'ADMIN2026'` and
`defaultPin: '2026'` under `EXPO_PUBLIC_*`, which means both are inlined into the shipped
bundle. Move admin auth server-side.

### 2.5 Delete the fabricated revenue chart

`AdminDashboard.web.jsx:1597-1607`:

```js
const wave = Math.sin((i / periodsCount) * Math.PI * 2) * 0.3 + 0.7;
const variance = Math.sin((i * 137.5 * Math.PI) / 180) * 0.15;
const rev = baseRev * (0.05 + 0.05 * (wave + variance));
```

The 4W / 12W / 24W revenue bars are a deterministic sine wave scaled by total revenue. They
are not observed data and should not be read as a baseline. Replace with a real time series
or remove the chart.

Also delete the duplicate regression at `AdminDashboard.web.jsx:1492-1512`. It uses the
`n·Σxy − Σx·Σy` form, allows `n === 1`, and feeds `categoryRegression` directly to the UI —
bypassing `forecastService` entirely. Two regression implementations with different minimums
means the two dashboards can disagree about the same category.

---

## Part 3 — Forecast engine

### 3.1 Move it out of the client

`forecastService.js` (869 lines) runs inside a 1,966-line React component
(`SalesForecastPanel.jsx`) and recomputes on render. Ship it as a Postgres function or Edge
Function so the admin dashboard, POS, and any future channel share one implementation and
one set of numbers.

Then schedule it. Move the on-demand snapshot pattern (`SalesForecastPanel.jsx:306-326`) to
a `pg_cron` job that writes to `forecast_history` nightly, and score the previous day's
forecast against actuals on the same run. An n8n workflow is the alternative if you prefer
the orchestration you already run for other jobs.

### 3.2 Replace OLS, cheapest model first

Motorcycle parts demand is intermittent — many SKUs sell zero on most days. OLS reads those
zeros as genuine demand collapse and trends the line downward. In order of effort-to-payoff:

**1. Croston / SBA for intermittent demand.** Estimates demand size and inter-arrival
interval separately instead of regressing on zeros. Add a day-of-week factor and a simple
month-of-year seasonal index. No ML required, and it will beat OLS by a wide margin across
most of the catalog.

**2. Holt-Winters** (triple exponential smoothing: level, trend, seasonality) for SKUs with
enough history to support it.

**3. Gradient-boosted trees on lag features** — `lag_1`, `lag_7`, `lag_28`, rolling mean and
std, days-since-last-sale, promo flag, price, category, brand. LightGBM or XGBoost, trained
offline, served as a versioned artifact. This is where the channel, promo, and price fields
from 1.5 start paying off.

**4. Negative-binomial GLM per category** as a shrinkage estimator. For long-tail SKUs with
no history, a category-level model beats a per-SKU model because it borrows strength.

### 3.3 Replace the constant with real reorder maths

```
ROP      = avg_daily_demand × (lead_time_days + review_period_days) + safety_stock
safety   = z × σ_demand × √(lead_time_days)
```

Both inputs exist and neither is used: demand history is in `order_items`, and
`suppliers.lead_time` is already stored. `lead_time` needs to become a numeric
`lead_time_days` column (1.5) and `suppliers.supplier_id` needs to link from
`inventory.supplier_id` (2.3).

`determineStockStatus` (`forecastService.js:294-307`) should read from the computed ROP
rather than the `forecast * 0.35` and `forecast * 2` multipliers.

### 3.4 Make model quality measurable

Fix the day-period back-fill bug at `forecastService.js:832`, then add error metrics to
`forecast_history`:

- **WAPE** = Σ|actual − predicted| / Σ actual
- **MASE** = MAE / in-sample naive MAE (scale-independent, comparable across SKUs)

Track these per product and per category. Right now forecast quality is assumed, not known —
which is why the algorithm has never been questioned.

### 3.5 Reservations

Add a `reservations` table so in-flight orders do not read as available stock:

```sql
CREATE TABLE public.reservations (
  reservation_id text PRIMARY KEY DEFAULT ('rsv-' || substr(md5(random()::text), 1, 12)),
  order_id     text NOT NULL,
  product_id   text NOT NULL REFERENCES public.products(product_id),
  quantity     integer NOT NULL,
  expires_at   timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
```

Available stock becomes `stock_quantity − SUM(reservations.quantity)`. This also lets you
implement backorder rather than silently refusing a sale.

---

## Part 4 — AI layer

### 4.1 Move the Gemini key server-side

`src/config/index.js:23` reads `EXPO_PUBLIC_GEMINI_API_KEY`, and
`src/services/geminiService.js:5-6` reads it from `localStorage` first
(`mototrack_gemini_api_key`). The `EXPO_PUBLIC_` prefix inlines it into the shipped bundle,
where it is trivially extractable and abusable for billing.

The Express server already exists and already has a working `@google/genai` integration
(`server/src/services/aiCustomizeService.js`, route
`server/src/routes/customize.js:7-39`). Route all model calls through it.

### 4.2 Legitimate uses — interpret, never calculate

Gemini has never touched analytics in this project; it is wired for image generation
(`geminiService.js:128-258`) and build-description copy (`:393-439`). Four defensible
additions:

- **Draft restock proposals and POs in natural language** from a numeric recommendation the
  service already computed. A supplier gets a readable message, not a raw number.
- **Explain a forecast** — "unit sales fell 30% over the last 6 weeks while the category was
  flat" — as prose over numbers the service produced.
- **Tag cold-start SKUs** with no sales history into the category taxonomy from free-text
  descriptions, using the keyword→catalog matching pattern already at
  `geminiService.js:444-491`.
- **Draft campaign copy** tied to SKUs predicted to go out of stock.

Never let the model emit quantities, prices, or stock levels. Enforce server-side with schema
validation and hard clamps, and keep the n8n guardrail rule
(`n8n/README.md:50-51`, which forbids the model from touching price/stock/compatibility) as a
documented invariant.

The reusable pieces are in `_callGeminiApi` (`geminiService.js:263-337`): 4-model fallback
chain, `AbortController` timeout, block-reason extraction, markdown-fence stripping before
`JSON.parse`. Lift those into a shared client for analytics calls.

---

## Part 5 — Prioritised

### P0 — correctness, blocks everything else

| # | Change | Why it blocks |
|---|---|---|
| 1 | `fn_adjust_stock` RPC, delete client-side select-then-upsert | Fixes an active overselling bug |
| 2 | `inventory_transactions` ledger | Without it, nothing in Part 3 is computable |
| 3 | Read and edit `reorder_level`; delete the 10 hardcoded `5` literals | 10 call sites are lying about stock health |
| 4 | Fix RLS on `inventory`, `products`, `forecast_history` | Public write access to stock |
| 5 | Delete the sine-wave revenue chart and the duplicate regression | Two dashboards producing fabricated or divergent numbers |

### P1 — forecast accuracy

| # | Change | Why |
|---|---|---|
| 6 | Move engine to Postgres/Edge Function, schedule with `pg_cron` | One implementation, shared by all channels |
| 7 | Croston/SBA + day-of-week + seasonal index | Largest accuracy gain per hour of work |
| 8 | Fix day-period back-fill; add WAPE and MASE | Makes quality measurable |
| 9 | Computed ROP from lead time and demand variance | Uses data you already have |
| 10 | Add channel, promo, and price as features | Data exists, unused |

### P2 — operational maturity

| # | Change | Why |
|---|---|---|
| 11 | `reservations` table | In-flight orders currently read as stock |
| 12 | Draft PO workflow with expected dates and partial receipt | `purchase_orders` is a side effect of immediate restock today (`productService.js:656-663`) |
| 13 | `holidays` / `events` table | PH seasonality |
| 14 | ABC/XYZ classification, cycle counts, shrinkage reporting | Now measurable via the ledger |
| 15 | Move Gemini key server-side | Shipped secret |
| 16 | Holt-Winters, then gradient boosting | Diminishing returns until P1 lands |

---

## Appendix — Files touched

| File | Lines | Role |
|---|---|---|
| `src/services/forecastService.js` | 869 | All demand and restock math |
| `src/utils/linearRegression.js` | 136 | OLS, `predictY`, `determineTrend` |
| `src/components/admin/SalesForecastPanel.jsx` | 1,966 | Forecast UI |
| `src/components/admin/ForecastChart.jsx` | 405 | Hand-rolled SVG chart |
| `src/services/productService.js` | 1,075 | Inventory read/write, `deductStock`, `restoreStock` |
| `src/services/orderService.js` | 2,539 | Stock deduction call sites |
| `src/services/notificationService.js` | 1,395 | Low/out-of-stock alerts |
| `src/services/excelService.js` | 163 | Inventory export |
| `src/pages/AdminDashboard.web.jsx` | 19,809 | Inventory tab, duplicate regression, fake chart |
| `src/pages/AdminDashboard.jsx` | 8,385 | Mobile mirror |
| `src/services/geminiService.js` | 583 | Gemini client (images and copy only) |
| `schema.sql` | 1,002 | 50+ tables |
| `supabase/migrations/20260921002000_products_inventory_write_rls.sql` | — | Public write RLS |
| `supabase/migrations/005_suppliers_enhancements.sql` | — | Adds `lead_time` as TEXT |
