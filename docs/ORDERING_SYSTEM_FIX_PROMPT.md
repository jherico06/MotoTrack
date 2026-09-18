# Prompt: Fix MotoTrack Ordering System Issues

Use this prompt with an AI coding assistant to systematically fix all identified ordering system bugs and architectural problems.

---

## Copy This Prompt

```
You are fixing critical bugs and architectural issues in the MotoTrack ordering system.
This is a React Native + Expo SDK 54 app with Supabase backend, plain JavaScript (no TypeScript).

## Project Context
- Entry: `src/app/index.jsx`
- Order service: `src/services/orderService.js`
- Cart context: `src/context/CartContext.jsx`
- Checkout modal: `src/components/modals/CheckoutModal.jsx`
- Shop pages: `src/pages/ShopPage.jsx` (mobile) and `src/pages/ShopPage.web.jsx` (web)
- GCash service: `src/services/gcashPaymentService.js`
- Product service: `src/services/productService.js`
- Supabase migrations: `supabase/migrations/001_initial_schema.sql` and `002_orders_enhancements.sql`

## Issues to Fix (in priority order)

### 1. CRITICAL — Stock Overselling Race Condition
**File:** `src/services/orderService.js` lines 578-589
**Problem:** Stock is decremented AFTER the order is saved, and each item fetches the full product catalog individually in a loop. Two users can buy the last unit simultaneously — both succeed locally, causing overselling.
**Fix:**
- Fetch the product catalog ONCE before the loop, not per item.
- Add a stock check BEFORE saving the order. If any item has insufficient stock, abort and return an error to the user.
- Ideally, use a Supabase RPC function that atomically checks and decrements stock (`UPDATE products SET stock = stock - $qty WHERE product_id = $id AND stock >= $qty`). If the RPC returns 0 rows affected, the stock was insufficient.
- Return `{ success: false, error: 'Insufficient stock for [product name]' }` if stock is insufficient.

### 2. CRITICAL — "Place Order Now" Has No Double-Tap Protection
**File:** `src/components/modals/CheckoutModal.jsx` lines 439-449
**Problem:** The "Place Order Now" button has no `disabled` prop or loading indicator. Double-tapping creates duplicate orders.
**Fix:**
- Add an `isSubmitting` state to CheckoutModal.
- Set `isSubmitting = true` before calling `onCompleteOrder`.
- Disable the button and show a loading spinner while `isSubmitting` is true.
- Reset `isSubmitting = false` if the order fails.

### 3. CRITICAL — No Loading State During Order Creation in ShopPage
**Files:** `src/pages/ShopPage.jsx` and `src/pages/ShopPage.web.jsx`
**Problem:** `executeCreateOrder` is async but no loading state is set. The UI is interactive while orders are being created.
**Fix:**
- Add an `isPlacingOrder` state variable.
- Set `isPlacingOrder = true` at the start of `executeCreateOrder`.
- Set `isPlacingOrder = false` in both success and error paths.
- Pass this loading state to CheckoutModal so it can disable the button.

### 4. HIGH — `cancelOrder()` Hardcodes Wrong `oldStatus` in Email
**File:** `src/services/orderService.js` line 925
**Problem:** The email notification for cancellation always reports the old status as `'Pending Approval'`, regardless of the actual previous status.
**Fix:**
- In `cancelOrder()`, capture `oldStatus` from the existing order object before updating it (same pattern already used in `updateOrderStatus` at line 823).
- Pass `oldStatus` to `emailService.sendOrderStatusNotification` instead of hardcoding `'Pending Approval'`.

### 5. HIGH — `getOrders()` Filters by `customer_name === userId`
**File:** `src/services/orderService.js` line 349
**Problem:** The filter `o.customer_name === userId` means if `userId` happens to match someone's name string, they see that person's orders. This is a data leakage vector.
**Fix:**
- Remove the `o.customer_name === userId` check from the filter.
- Only filter by `customer_id` and `user_id`.

### 6. HIGH — Order ID Collision Risk
**File:** `src/services/orderService.js` line 519
**Problem:** `'ord-' + Date.now() + Math.floor(10 + Math.random() * 90)` — the 2-digit random suffix makes collisions possible under concurrent load.
**Fix:**
- Use a longer random suffix: `Math.floor(100000 + Math.random() * 900000)` (6 digits).
- Or use `crypto.randomUUID()` if available, or a combination of timestamp + random hex.
- Apply the same fix to `createPOSOrder` (line 1269) and `paymentId`/`saleId` generation (lines 618, 630).

### 7. HIGH — `user_id` Missing from Supabase Order Payload
**File:** `src/services/orderService.js` lines 596-616
**Problem:** The local `newOrder` object includes `user_id` (line 544), but the `orderPayload` sent to Supabase does not include it. This breaks the RLS policy in `002_orders_enhancements.sql` which joins on `customers.user_id`.
**Fix:**
- Add `user_id: userId || null` to the `orderPayload` object at line 596.

### 8. MEDIUM — `parseItemsSummary()` Assigns Fake Prices
**File:** `src/services/orderService.js` lines 476-493
**Problem:** When falling back to parsing the items summary string, every item gets `price: 99.0` and synthetic IDs like `prod-0`. This corrupts order totals in the UI.
**Fix:**
- When falling back, try to look up real product data from Supabase by searching products table by name.
- If that fails, use `0` for price and clearly mark these as "price unavailable" items rather than fake `$99` prices.
- At minimum, do NOT display a fake price — show "Price unavailable" or fetch from the order's `total_amount`.

### 9. MEDIUM — Promo Discount Not Re-Validated at Order Time
**File:** `src/pages/ShopPage.jsx` (and `.web.jsx`)
**Problem:** Promo is validated once when applied in CartModal. Between application and order placement, an admin could deactivate it.
**Fix:**
- In `executeCreateOrder`, if `appliedPromoId` is set, re-validate the promo against Supabase before creating the order.
- If validation fails (promo expired/deactivated), create the order WITHOUT the discount and inform the user.
- Alternatively, validate in `orderService.createOrder` itself.

### 10. MEDIUM — Cart Cleared Even if Supabase Write Fails
**Files:** `src/pages/ShopPage.jsx` and `src/pages/ShopPage.web.jsx`
**Problem:** `clearCart()` is called unconditionally after `orderService.createOrder()` returns. But `createOrder` always returns `{ success: true }` even when Supabase fails (it silently enqueues to offline queue). The cart is lost.
**Fix:**
- Have `orderService.createOrder` include a `supabaseSynced: true/false` flag in its return value.
- In `executeCreateOrder`, only clear the cart if `supabaseSynced` is true, OR if the user explicitly confirms they want to proceed offline.

### 11. LOW — N+1 Product Fetch in Stock Decrement
**File:** `src/services/orderService.js` lines 578-589
**Problem:** `productService.getProducts()` is called once per item in the order. A 10-item order triggers 10 full catalog fetches.
**Fix:**
- Fetch the catalog once before the loop: `const catalog = await productService.getProducts();`
- Reuse `catalog` inside the loop to find each product's stock.

### 12. LOW — Silent Email Failures
**File:** `src/services/orderService.js` lines 686, 788, 857, 931, 1012
**Problem:** All email sends are wrapped in `try/catch(e) {}` with empty catch blocks. Failures are invisible.
**Fix:**
- Add `console.warn('[OrderService] Email failed:', e)` in each catch block.
- Consider adding a retry queue for failed emails.

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
3. Stock is decremented correctly after order creation.
4. Cancelling an order shows the correct previous status in the email notification.
5. `getOrders('some-user-id')` only returns orders belonging to that user, not orders by name match.
6. Order IDs are unique even under rapid creation.
```
