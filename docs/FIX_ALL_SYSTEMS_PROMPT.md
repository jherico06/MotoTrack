# Prompt: Fix MotoTrack Booking, Ordering & POS Systems

Use this prompt with an AI coding assistant to systematically fix all identified bugs across all three core systems.

---

## Copy This Prompt

```
You are fixing critical bugs and architectural issues across the MotoTrack booking system, ordering system, and POS terminal.
This is a React Native + Expo SDK 57 app with Supabase backend, plain JavaScript (no TypeScript).

## Project Context
- Entry: `src/app/index.jsx`
- Order service: `src/services/orderService.js`
- Cart context: `src/context/CartContext.jsx`
- Checkout modal: `src/components/modals/CheckoutModal.jsx`
- Shop pages: `src/pages/ShopPage.jsx` (mobile) and `src/pages/ShopPage.web.jsx` (web)
- Admin dashboard: `src/pages/AdminDashboard.jsx` (mobile) and `src/pages/AdminDashboard.web.jsx` (web)
- Garage/booking page: `src/pages/GaragePage.jsx` (mobile) and `src/pages/GaragePage.web.jsx` (web)
- Garage service: `src/services/garageService.js`
- Product service: `src/services/productService.js`
- Supabase migrations: `supabase/migrations/001_initial_schema.sql`, `002_orders_enhancements.sql`, `006_mechanics.sql`

## SECTION A: ORDERING SYSTEM (12 issues)

### 1. CRITICAL — Stock Overselling Race Condition
**File:** `src/services/orderService.js` lines 606-633
**Problem:** Stock is decremented AFTER the order is saved, and each item fetches the full product catalog individually in a loop (`productService.getProducts()` per item). Two users can buy the last unit simultaneously — both succeed locally, causing overselling. Additionally, `productService.deductStock()` clamps to `Math.max(0, ...)` so overselling is silently masked.
**Fix:**
- Fetch the product catalog ONCE before the loop, not per item.
- Add a stock check BEFORE saving the order. If any item has insufficient stock, abort and return `{ success: false, error: 'Insufficient stock for [product name]' }`.
- Ideally, use a Supabase RPC function that atomically checks and decrements stock (`UPDATE products SET stock = stock - $qty WHERE product_id = $id AND stock >= $qty`). If the RPC returns 0 rows affected, the stock was insufficient.

### 2. CRITICAL — "Place Order Now" Has No Double-Tap Protection
**File:** `src/components/modals/CheckoutModal.jsx` line 77
**Problem:** The "Place Order Now" button calls `onCompleteOrder` with no `disabled` prop or loading indicator. Double-tapping creates duplicate orders.
**Fix:**
- Add an `isSubmitting` state to CheckoutModal.
- Set `isSubmitting = true` before calling `onCompleteOrder`.
- Disable the button and show a loading spinner while `isSubmitting` is true.
- Reset `isSubmitting = false` if the order fails.

### 3. CRITICAL — No Loading State During Order Creation in ShopPage
**Files:** `src/pages/ShopPage.jsx` (line 172) and `src/pages/ShopPage.web.jsx`
**Problem:** `executeCreateOrder` is async but no loading state is set. The UI is interactive while orders are being created.
**Fix:**
- Add an `isPlacingOrder` state variable.
- Set `isPlacingOrder = true` at the start of `executeCreateOrder`.
- Set `isPlacingOrder = false` in both success and error paths.
- Pass this loading state to CheckoutModal so it can disable the button.

### 4. HIGH — `cancelOrder()` Hardcodes Wrong `oldStatus` in Email
**File:** `src/services/orderService.js` line 991
**Problem:** The email notification for cancellation always reports the old status as `'Pending Approval'`, regardless of the actual previous status.
**Fix:**
- In `cancelOrder()`, capture `oldStatus` from the existing order object before updating it (same pattern already used in `updateOrderStatus` at line 876).
- Pass `oldStatus` to `emailService.sendOrderStatusNotification` instead of hardcoding `'Pending Approval'`.

### 5. HIGH — `getOrders()` Filters by `customer_name === userId`
**File:** `src/services/orderService.js` line 350
**Problem:** The filter `o.customer_name === userId` means if `userId` happens to match someone's name string, they see that person's orders. This is a data leakage vector.
**Fix:**
- Remove the `o.customer_name === userId` check from the filter.
- Only filter by `customer_id` and `user_id`.

### 6. HIGH — Order ID Collision Risk
**File:** `src/services/orderService.js` line 521
**Problem:** `'ord-' + Date.now() + Math.floor(10 + Math.random() * 90)` — the 2-digit random suffix makes collisions possible under concurrent load.
**Fix:**
- Use a longer random suffix: `Math.floor(100000 + Math.random() * 900000)` (6 digits).
- Or use `crypto.randomUUID()` if available, or a combination of timestamp + random hex.
- Apply the same fix to `createPOSOrder` (line 1359) and `paymentId`/`saleId` generation (lines 661, 673).

### 7. HIGH — `user_id` Missing from Supabase Order Payload
**File:** `src/services/orderService.js` lines 639-659
**Problem:** The local `newOrder` object includes `user_id` (line 546), but the `orderPayload` sent to Supabase does not include it. This breaks the RLS policy in `002_orders_enhancements.sql` which joins on `customers.user_id`.
**Fix:**
- Add `user_id: userId || null` to the `orderPayload` object at line 639.

### 8. MEDIUM — `parseItemsSummary()` Assigns Fake Prices
**File:** `src/services/orderService.js` lines 471-496
**Problem:** When falling back to parsing the items summary string, every item gets `price: 99.0` and synthetic IDs like `prod-0`. This corrupts order totals in the UI.
**Fix:**
- When falling back, try to look up real product data from Supabase by searching products table by name.
- If that fails, use `0` for price and clearly mark these as "price unavailable" items rather than fake `$99` prices.
- At minimum, do NOT display a fake price — show "Price unavailable" or fetch from the order's `total_amount`.

### 9. MEDIUM — Promo Discount Not Re-Validated at Order Time
**Files:** `src/pages/ShopPage.jsx` and `src/pages/ShopPage.web.jsx`
**Problem:** Promo is validated once when applied in CartModal. Between application and order placement, an admin could deactivate it.
**Fix:**
- In `executeCreateOrder`, if `appliedPromoId` is set, re-validate the promo against Supabase before creating the order.
- If validation fails (promo expired/deactivated), create the order WITHOUT the discount and inform the user.
- Alternatively, validate in `orderService.createOrder` itself.

### 10. MEDIUM — Cart Cleared Even if Supabase Write Fails
**Files:** `src/pages/ShopPage.jsx` line 208 and `src/pages/ShopPage.web.jsx`
**Problem:** `clearCart()` is called unconditionally after `orderService.createOrder()` returns. But `createOrder` always returns `{ success: true }` even when Supabase fails (it silently enqueues to offline queue). The cart is lost.
**Fix:**
- Have `orderService.createOrder` include a `supabaseSynced: true/false` flag in its return value.
- In `executeCreateOrder`, only clear the cart if `supabaseSynced` is true, OR if the user explicitly confirms they want to proceed offline.

### 11. LOW — N+1 Product Fetch in Stock Decrement
**File:** `src/services/orderService.js` lines 606-633
**Problem:** `productService.getProducts()` is called once per item in the order. A 10-item order triggers 10 full catalog fetches.
**Fix:**
- Fetch the catalog once before the loop: `const catalog = await productService.getProducts();`
- Reuse `catalog` inside the loop to find each product's stock.

### 12. LOW — Silent Email Failures
**File:** `src/services/orderService.js` multiple locations
**Problem:** All email sends are wrapped in `try/catch(e) {}` with empty catch blocks. Failures are invisible.
**Fix:**
- Add `console.warn('[OrderService] Email failed:', e)` in each catch block.
- Consider adding a retry queue for failed emails.

---

## SECTION B: BOOKING SYSTEM (3 issues)

### 13. CRITICAL — Double-Booking Race Condition (Oversellable Time Slots)
**File:** `src/services/garageService.js` line 1000-1030 (availability check) and line 1320 (createBooking)
**Problem:** Slot availability is computed from locally cached bookings in `getAvailabilityData()` and displayed to the user. But `createBooking` just saves locally and upserts to Supabase with NO atomic slot reservation. Two users can book the same mechanic + date + time slot simultaneously. There is no DB uniqueness constraint on (date, time_slot, mechanic) in the `bookings` table.
**Fix:**
- Before inserting, query Supabase for existing active bookings with the same `appointment_date` + `time_slot` + `mechanic`. If any exist, reject with `{ success: false, error: 'Time slot is no longer available. Please choose another.' }`.
- In `syncBookingToSupabase` (line 1135), use a Supabase RPC or a `SELECT ... FOR UPDATE` style check to atomically verify no conflicting booking exists before inserting.
- As a defensive layer, add a Supabase partial unique index on `(schedule::date, time_slot, mechanic)` where `status NOT IN ('Cancelled', 'No-Show')` — but since the constraint says "do not modify migrations," implement the check in JS as a pre-insert query.

### 14. HIGH — Downpayment Never Persisted to Supabase
**File:** `src/services/garageService.js` lines 1117-1133 (syncBookingToSupabase payload)
**Problem:** The `syncBookingToSupabase` payload does NOT include `downpayment_amount`, `downpayment_status`, `downpayment_ref`, `downpayment_method`, or `downpayment_paid`. The 20% downpayment (which can be ₱500-₱20000+) exists only in the local booking object and is completely invisible to the Supabase database. This means:
- Admin dashboards can't see revenue from bookings.
- Accounting can't reconcile downpayments against payments table.
- If local storage is cleared, the downpayment information is permanently lost.
**Fix:**
- Add `downpayment_amount`, `downpayment_status`, `downpayment_ref`, `downpayment_method`, `downpayment_paid`, `downpayment_percent` to the `syncBookingToSupabase` payload.
- Since the `bookings` table (001_initial_schema.sql) likely doesn't have these columns, store them in the `notes` JSON metadata trailer (the `__MT_META_START__` pattern already in use at line 1107-1115).
- Alternatively, insert a row into the `payments` table for each booking downpayment with `payment_method`, `amount`, `reference_number`, and `status`.

### 15. MEDIUM — Date Off-By-One Timezone Bug
**File:** `src/services/garageService.js` lines 1098-1100
**Problem:** `appointment_date` is stored as a date string (e.g. `"2026-09-15"`). When parsed via `new Date(rawDate)`, JavaScript treats it as midnight UTC. In the Philippines (UTC+8), this is `08:00 AM` on the correct date — but when converted back to ISO via `toISOString()`, it becomes `"2026-09-14T16:00:00Z"` (the previous day in UTC). This can cause the `schedule` column to show the wrong date, affecting admin queries and date-based availability checks.
**Fix:**
- When parsing `appointment_date`, append a local time component before parsing: `new Date(rawDate + 'T09:00:00+08:00')` or use `YYYY-MM-DDTHH:mm:ss` in local timezone.
- Alternatively, store the date as-is (no time component) and let Supabase handle the timezone.

---

## SECTION C: POS TERMINAL (3 issues)

### 16. CRITICAL — POS Orders Missing Items/Payments/Sales in Supabase
**File:** `src/services/orderService.js` lines 1397-1410 (createPOSOrder Supabase insert)
**Problem:** `createPOSOrder` only inserts into the `orders` table with a bare header (no `order_items`, no `payments`, no `sales` rows). After any data refresh or on a different device:
- POS order items come back empty → `parseItemsSummary` fills them with fake ₱99 prices.
- POS sales never appear in the `sales` ledger → revenue analytics are wrong.
- POS payments never appear in the `payments` table → no payment audit trail.
**Fix:**
- After inserting the order header, insert order_items rows (same pattern as `createOrder` at line 684-691).
- Insert a payment row into `payments` table with the correct method and amount.
- Insert a sale row into `sales` table with `sale_type: 'POS'` and the correct total.

### 17. HIGH — POS Order ID Collision
**File:** `src/services/orderService.js` line 1359
**Problem:** `'pos-' + Date.now().toString().slice(-6)` uses only the last 6 digits of the timestamp. Two sales within the same millisecond, or sales that happen to produce the same 6-digit suffix (e.g. `pos-123456`), create duplicate IDs.
**Fix:**
- Use the full timestamp + random suffix: `'pos-' + Date.now() + Math.floor(100000 + Math.random() * 900000)`.
- Or use a combination of timestamp + 4-digit random hex.

### 18. HIGH — POS Double-Tap / No Loading Guard
**File:** `src/pages/AdminDashboard.jsx` line 392 and `src/pages/AdminDashboard.web.jsx` line 852
**Problem:** `handlePOSCheckout` has no `isSubmitting` or `isProcessingPOS` state. The "Complete POS Sale & Print Receipt" button can be double-tapped, creating two identical POS orders and deducting stock twice.
**Fix:**
- Add an `isPOSProcessing` state variable.
- Set `isPOSProcessing = true` at the start of `handlePOSCheckout`.
- Disable the checkout button and show a loading indicator while `isPOSProcessing` is true.
- Reset `isPOSProcessing = false` on error.
- Additionally, add a pre-sale stock availability check: before processing, verify all items in `posCart` have sufficient stock. If not, show an error and abort.

---

## SECTION D: CROSS-CUTTING ISSUES (2 issues)

### 19. MEDIUM — Stock Deduction is Non-Atomic Everywhere
**Files:** `src/services/orderService.js` lines 606-633 (online orders) and `src/pages/AdminDashboard.jsx` line 421 (POS)
**Problem:** Both online orders and POS sales deduct stock as a separate non-atomic step after the order is saved. If the app crashes or network drops between order creation and stock deduction, inventory is out of sync. The `deductStock` method also clamps to `Math.max(0, ...)` which silently masks overselling.
**Fix (shared approach):**
- Move stock validation INTO `createOrder` and `createPOSOrder` — check stock BEFORE saving the order.
- If insufficient, return `{ success: false, error: 'Insufficient stock for [product name]' }`.
- For POS, move `deductStock` inside `handlePOSCheckout` BEFORE `createPOSOrder` (fail-fast: verify stock first, then create order + deduct atomically).
- Remove the `Math.max(0, ...)` clamp in `productService.deductStock` — if stock would go negative, throw an error instead.

### 20. LOW — Silent Errors in Booking Sync & Notifications
**Files:** `src/services/garageService.js` lines 1459-1468, `1043-1046`, `1147`
**Problem:** Booking sync failures, notification failures, and audit log failures are all silently swallowed with empty `catch` blocks. If Supabase sync fails, the booking exists only locally with no retry mechanism.
**Fix:**
- Add `console.warn('[GarageService] ...')` in each empty catch block.
- For sync failures, add the booking to an offline retry queue (same pattern used in `orderService.enqueueOfflineAction`).

---

## Important Constraints
- Do NOT convert to TypeScript — keep all files as plain JavaScript.
- Do NOT add new npm dependencies unless absolutely necessary.
- Maintain backward compatibility with existing localStorage data.
- Keep the existing file structure (`.jsx` for mobile, `.web.jsx` for web).
- Do NOT modify the Supabase migration files — only modify the JavaScript service/UI files.
- Follow existing code style: no comments added unless the user requests them.
- Run `npx eslint src/` after changes to verify no lint errors.

## Verification Checklist
After implementing fixes, verify:
1. Adding an item to cart, going to checkout, and placing an order works for both COD and GCash.
2. The "Place Order Now" button disables during submission and cannot be double-tapped.
3. Stock is decremented correctly after order creation and cannot go below zero.
4. Cancelling an order shows the correct previous status in the email notification.
5. `getOrders('some-user-id')` only returns orders belonging to that user, not orders by name match.
6. Order IDs are unique even under rapid creation.
7. Two users cannot book the same mechanic + time slot simultaneously.
8. Booking downpayments are visible in Supabase (either in bookings metadata or payments table).
9. POS sales appear in the `sales` ledger with correct totals after page refresh.
10. POS double-tap is prevented by a loading guard.
11. POS stock deduction happens before order creation (fail-fast), not after.
12. Offline/failed Supabase syncs are logged and retried, not silently lost.
```
