# Prompt: Fix MotoTrack Booking System

Use this prompt with an AI coding assistant to systematically fix all issues identified in the booking system audit.

---

## Copy This Prompt

```
You are fixing critical bugs and architectural issues across the MotoTrack booking system only.
This is a React Native + Expo SDK 57 app with Supabase backend, plain JavaScript (no TypeScript).
Read the exact Expo v57 docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Project Context
- Entry: `src/app/index.jsx` (auth gate at line 686)
- Core booking service: `src/services/garageService.js` (~2354 lines)
- Mobile booking UI: `src/pages/GaragePage.jsx`
- Web booking UI: `src/pages/GaragePage.web.jsx`
- Duplicate booking CRUD (do not extend): `src/services/databaseService.js` lines 202-247
- AI booking entry: `src/services/aiCustomizerService.js` (`bookCustomizationService` lines 426-469)
- Admin workflow: `src/pages/AdminDashboard.jsx` (handlers 331-341) and `src/pages/AdminDashboard.web.jsx` (handlers 1879-1974)
- Customer bookings view: `src/pages/ProfilePage.jsx` / `ProfilePage.web.jsx` ("Pit Bays" tab)
- Payment: `src/components/modals/GCashPaymentModal.jsx`, `src/services/gcashPaymentService.js`
- Settings: `src/services/systemSettingsService.js`
- Notifications: `src/services/notificationService.js`
- Migrations: `supabase/migrations/001_initial_schema.sql` (bookings table 266-287, RLS 339/370-371), `006_mechanics.sql`, `009_normalize_schema.sql` (§E 145-168), `20260919040000_booking_packages_and_approval.sql`, `20260920170000_financial_management.sql` (§5), `016_egress_query_indexes.sql`
- Prior audit notes: `docs/FIX_ALL_SYSTEMS_PROMPT.md` Section B (issues 13, 14, 15, 20 — all still open)

## Booking Flow (for reference)
Browse packages/mechanics/slots → pick category/package/date/time slot → `handleConfirmBooking` validates and builds a Pending draft → 20% GCash downpayment via `GCashPaymentModal` → `handleGcashPaymentSuccess` → `garageService.createBooking` (local save + `syncBookingToSupabase` upsert + notifications + audit) → admin lifecycle: Pending → Confirmed/Rejected → Inspection → Estimate Pending → In Progress → Service Done → Paid → Closed (plus Cancelled).

Statuses: Pending, Confirmed, Rejected, Cancelled, Inspection, Estimate Pending, In Progress, Service Done, Paid, Closed.

---

## SECTION A: DATABASE & SECURITY (CRITICAL — do these first)

### 1. CRITICAL — No Unique Constraint Allows Double-Booking
**Files:** new migration + `src/services/garageService.js` (`getDaySlotAvailability` ~1062, `syncBookingToSupabase` ~1120-1288, `createBooking` ~1488)
**Problem:** Slot availability is computed only from the local cache. `syncBookingToSupabase` upserts on `booking_id` with no pre-insert conflict check, and the `bookings` table has NO unique constraint on (appointment date, time slot, mechanic). Two users booking the same slot at the same time both succeed.
**Fix:**
- Create a NEW migration file (do not edit old ones) that:
  - Ensures the columns used for slot identity exist (see issue 2).
  - Adds a partial unique index: `CREATE UNIQUE INDEX ... ON bookings (appointment_date, time_slot, COALESCE(mechanic_id, mechanic)) WHERE status NOT IN ('Cancelled', 'Rejected');` (adjust column names to the actual schema after issue 2 is applied).
- In `createBooking`, before inserting: query Supabase for an active booking with the same `appointment_date` + `time_slot` + mechanic. If found, return `{ success: false, error: 'Time slot is no longer available. Please choose another.' }`.
- Catch unique-violation errors (SQLSTATE 23505) from the upsert and surface the same friendly error instead of swallowing it.
- After a successful create, refetch day slot availability so the UI disables the taken slot.

### 2. CRITICAL — RLS and Schema Mismatch Breaks All Booking Writes
**Files:** new migration + `src/services/garageService.js` (`syncBookingToSupabase` payload 1221-1271, `fetchBookings` 1310, `updateBooking` 2104, `cancelBooking` 2228, `deleteBooking` 2170)
**Problem:** The `bookings` table has RLS enabled with ONLY an anonymous SELECT policy (`allow_anon_read_bookings`). There are no INSERT/UPDATE/DELETE policies, so every client-side upsert/update/delete should be rejected. Errors are swallowed with `console.warn`, so bookings silently become local-only. Additionally, the sync payload includes ~15 columns that were never created by any migration: `package_id`, `package_name`, `included_services`, `time_slot`, `appointment_date`, `category`, `branch_name`, `bike_plate`, `bike_odo`, `downpayment_amount`, `downpayment_status`, `downpayment_ref`, `downpayment_method`, `downpayment_paid_at`, `remaining_balance`, `user_id`, `repair_type`, `current_stage`, `service_progress`, `previous_schedule` (verify which exist), so even with RLS open the upsert fails with "column does not exist".
**Fix:**
- Create a NEW migration that `ADD COLUMN IF NOT EXISTS` for every field the payload sends (use appropriate types: `text`, `numeric`, `timestamptz`, `boolean`, `jsonb` for `included_services`).
- Add RLS policies in the same migration:
  - INSERT: authenticated (or anon, matching how the app authenticates — check how supabase client is created) can insert bookings.
  - UPDATE: only rows matching the inserting user's `customer_id`/`user_id`, plus a policy that allows status transitions used by the admin flow (see issue 6 for how admin auth should work).
  - DELETE: restrict to the owner or admin.
- Stop swallowing sync errors: in `syncBookingToSupabase`, on failure return `{ success: false, error }` and have `createBooking` propagate it so the UI can warn the user instead of pretending the booking saved.
- Remove the demo-row `DELETE ... IN (demoIds)` that runs on every `fetchBookings` (line ~1318) or gate it behind a demo-mode flag.

### 3. CRITICAL — Migration Conflict on `mechanic` Column
**Files:** `supabase/migrations/009_normalize_schema.sql` line 168, `supabase/migrations/20260919040000_booking_packages_and_approval.sql`
**Problem:** `009` runs `DROP COLUMN IF EXISTS mechanic` while `20260919040000` re-adds `mechanic` and also runs `CREATE INDEX ... (package_id)` plus `COMMENT ON COLUMN package_id` on a column no migration ever creates. Depending on run order the migration fails or leaves the schema half-applied.
**Fix:**
- In your NEW migration, reconcile the final state idempotently: ensure `mechanic` and `mechanic_id` both exist (or standardize on `mechanic_id` FK to `mechanics` and a generated/denormalized `mechanic` name if the UI needs it), ensure `package_id` exists before any index/comment on it, and make all statements `IF NOT EXISTS` / `IF EXISTS` so re-runs are safe.
- Do not rewrite the historical migration files; the new migration is the source of truth for final state.

### 4. CRITICAL — GCash Payment Is Entirely Client-Side Forgeable
**Files:** `src/services/gcashPaymentService.js` (hardcoded `sk_test_` at line 8, OTP accepts any 6 digits at ~117, MPIN any 4 digits at ~134, wallet balance in localStorage), `src/components/modals/GCashPaymentModal.jsx` (`onPaymentSuccess` ~169)
**Problem:** The "payment" is sandbox simulation. `onPaymentSuccess` fires from client state alone, so a user can skip or forge the 20% downpayment (devtools, edited localStorage, or calling the handler directly). There is no server-side verification tied to the booking.
**Fix (minimum viable for now):**
- Never treat client payment state as authoritative: mark the local booking's downpayment as `status: 'Unpaid'` until a server row confirms it.
- Insert a row into the `payments` table (or persist payment fields on the booking via the sync payload from issue 2) at the moment of claimed success, with `status: 'Pending'`, then confirm only after that insert succeeds. If the insert fails, do not proceed to `createBooking` as paid.
- Keep the hardcoded secret out of the client: move any real secret to a Supabase Edge Function; if this remains a sandbox, clearly label it and gate it behind `__DEV__` or an env flag so production cannot use the fake path.
- (Out of scope but recommended: implement a `verify_gcash_payment` Edge Function that the client must call, and only then mark `downpayment_paid`.)

---

## SECTION B: BOOKING CREATION & VALIDATION (HIGH)

### 5. HIGH — No Double-Submit Guard on Confirm Booking
**Files:** `src/pages/GaragePage.jsx` (`handleConfirmBooking` 340-414, button ~1983), `src/pages/GaragePage.web.jsx` (`handleConfirmBooking` 336-443, button ~2168)
**Problem:** The confirm button has no `isSubmitting`/`disabled` state (unlike the GCash modal's `isProcessing`). Rapid taps create multiple drafts and duplicate bookings.
**Fix:**
- Add an `isSubmittingBooking` state; set it at the start of `handleConfirmBooking`.
- Disable the button and show a loading spinner while true; reset on error.
- Pass the state down so the GCash modal cannot open twice either.

### 6. HIGH — Weak Booking ID Generation
**Files:** `src/pages/GaragePage.jsx` (~367/378), `src/pages/GaragePage.web.jsx` (~378), `src/services/garageService.js` (`createBooking` ~1496-1499)
**Problem:** IDs use `BK-{REP|PMS|CUST}-#####` with 5 random digits (~90k space) → collisions under concurrent use.
**Fix:**
- Use `Date.now()` + random suffix, or `crypto.randomUUID()` where available, keeping the `BK-` prefix for display if needed (store a separate display code if the prefix format matters to users).
- Apply consistently in GaragePage, GaragePage.web, and garageService (the service should be the single source of ID generation; the pages should stop generating IDs themselves).

### 7. HIGH — Required Field Validation Gaps
**Files:** `src/pages/GaragePage.jsx` (340-414), `src/pages/GaragePage.web.jsx` (336-443), `src/services/garageService.js` (~1645)
**Problem:**
- `selectedTimeSlot` is never validated; booking silently defaults to `'09:00 AM'`.
- Past dates are only disabled in the UI pill (`disabled={isPast}`); nothing rejects a past `appointment_date` at confirm time.
**Fix:**
- Require a non-empty time slot before proceeding; show an inline error.
- Validate in `handleConfirmBooking` (and again in `createBooking` as defense): reject dates before today (compare date strings `YYYY-MM-DD`, no `new Date()` parsing — see issue 12).
- Require a package/service selection if the flow expects one.

### 8. HIGH — Availability Ignores System Settings
**Files:** `src/services/garageService.js` (`getDaySlotAvailability` ~1062, `isTodayFullyBookedOverride` ~736), `src/services/systemSettingsService.js` (`allowWeekendBookings` ~26)
**Problem:** `allowWeekendBookings`, `maxDailyAppointments`, `autoAssignMechanic`, and opening/closing hours are never consulted by availability or confirm logic. Weekend/hours restrictions are not enforced.
**Fix:**
- In `getDaySlotAvailability`, mark all slots unavailable on weekends when `allowWeekendBookings` is false.
- Enforce opening/closing hours against the `TIME_SLOTS` list.
- Enforce `maxDailyAppointments` per day (count active bookings for the date).
- Re-check all of these inside `handleConfirmBooking`/`createBooking`, not only in the slot grid UI.

### 9. HIGH — Slot Capacity Hardcoded to 1; Mechanic-Busy Check Is Fuzzy
**Files:** `src/services/garageService.js` (`getDaySlotAvailability` ~1091-1098, mechanic availability ~993-1030)
**Problem:** One booking marks a slot `isBooked` for everyone, despite the shop having multiple pit bays. Conversely, mechanic-busy logic uses fuzzy string matching on mechanic names, so a mechanic can appear free while already assigned.
**Fix:**
- Introduce a per-slot capacity (constant or from system settings, e.g. number of bays) and count active bookings for that date+slot instead of binary first-match.
- Match mechanics by `mechanic_id`, not display name; if only a name is stored, normalize with a strict (non-fuzzy) comparison and prefer the FK after issue 2 adds `mechanic_id`.

---

## SECTION C: PERSISTENCE & LIFECYCLE (HIGH)

### 10. HIGH — Lifecycle Updates Never Reach Supabase
**Files:** `src/services/garageService.js` — `addInspectionEstimate` (1788), `respondToEstimate` (1832), `continueScheduledService` (1886), `updateServiceProgress` (1895), `processBookingPayment` (1926), `releaseMotorcycle` (1981), `approveBooking` (1720), `rejectBooking` (1744), `checkInBooking` (1765), `updateBookingStatus` (2043)
**Problem:** These call only `saveLocalBookings`. Estimates, inspection data, payments, service reports, rejection reasons, progress percent, and approval metadata are lost when storage is cleared or on another device. `updateBooking`'s field whitelist (2108-2130) also omits `service_progress`, `additional_estimates`, `inspection_*`, `rejection_reason`, `billing`, `downpayment_*`, `rescheduled_at`.
**Fix:**
- After every local save in the lifecycle functions above, also call a Supabase update for the affected columns (once issue 2 adds the columns; use `jsonb` columns for nested objects like `additional_estimates`, `billing`, `service_report` if they don't fit scalar columns).
- Extend the `updateBooking` whitelist to include all lifecycle fields.
- Return `{ success: false, error }` when the remote update fails (no silent loss); consider an offline retry queue (same pattern as `orderService.enqueueOfflineAction`).

### 11. HIGH — Downpayment Fields Not Fully Persisted
**Files:** `src/services/garageService.js` (`syncBookingToSupabase` payload 1249-1253, `createBooking` 1570-1663)
**Problem:** Payload includes `downpayment_amount/ref/paid_at/method` but omits `downpayment_paid`, `downpayment_status`, `downpayment_percent`, `is_non_refundable`; and the columns don't exist anyway (issue 2). Admin/accounting cannot reconcile downpayments.
**Fix:**
- Add the missing fields to the payload and columns to the DB (in the issue 2 migration).
- Mirror each successful downpayment into the `payments` table (`payment_method: 'GCash'`, amount, reference_number, status, and a booking link) so revenue reporting works.
- Ensure `remaining_balance` persists too.

### 12. HIGH — Reschedule Diverges Local vs Remote
**Files:** `src/services/garageService.js` (`rescheduleBooking` 2299-2328)
**Problem:** The new `appointment_date`/`time_slot` are updated only locally. The Supabase update sets only `rescheduled_at` and forces `status: 'Confirmed'` regardless of current status — the server keeps the old schedule.
**Fix:**
- Include `appointment_date`, `time_slot`, `schedule`, `previous_schedule`, `rescheduled_at` in the Supabase update.
- Preserve the current status (or only transition to `Confirmed` when it was a valid prior status like `Pending`/`Confirmed`).
- Run the same slot-conflict check from issue 1 before allowing the reschedule.

### 13. HIGH — Customer Data Leakage in `getUserBookings`
**Files:** `src/services/garageService.js` (`getUserBookings` 2330-2349, `fetchBookings` 1310, `getAllBookings` 1484)
**Problem:** When no email/id is provided, it falls back to matching `customer_name` — two accounts with the same display name see each other's bookings. `getAllBookings` returns every booking to any client.
**Fix:**
- Remove the `customer_name` fallback; require a user id (or Supabase auth user id) and filter only on `customer_id`/`user_id`.
- Gate `getAllBookings` behind an explicit admin check (see issue 14) or remove client access to it and use a scoped view/RPC.
- Consider making the SELECT RLS policy user-scoped instead of `USING (true)` once admin access is properly separated.

### 14. HIGH — Admin Secrets in Client Bundle; No Server Authorization
**Files:** `.env` / `EXPO_PUBLIC_ADMIN_SECRET_KEY`, `EXPO_PUBLIC_ADMIN_DEFAULT_PIN`; `src/pages/AdminDashboard.jsx` / `.web.jsx` approve/reject handlers
**Problem:** Admin secrets ship to the browser. Approval and all lifecycle writes are client-side with no admin authorization on the booking writes themselves — any user who knows the payload shape can approve their own booking.
**Fix:**
- Move admin authorization server-side: a `SECURITY DEFINER` Postgres function or Edge Function that performs approve/reject/check-in/etc., checking an admin role claim (JWT) before updating.
- Remove admin secrets from `EXPO_PUBLIC_*` env vars (they are public by definition in Expo).
- Client handlers should call the RPC/function and handle its returned error, not write bookings directly.

---

## SECTION D: CORRECTNESS & UX (MEDIUM/LOW)

### 15. MEDIUM — Timezone Off-By-One on `YYYY-MM-DD`
**Files:** `src/services/garageService.js` (~1188-1207 schedule derivation)
**Problem:** `new Date('YYYY-MM-DD')` parses as UTC midnight; re-serializing in PH time (UTC+8) can shift the date, so `schedule` and `appointment_date` can disagree — breaking admin queries and availability.
**Fix:**
- Never round-trip date strings through `Date`. Keep `appointment_date` as the literal `YYYY-MM-DD` string for all comparisons and DB storage.
- When a timestamp is required, build it explicitly: `new Date(\`${date}T${time}:00+08:00\`)`, or store date and time slot as separate columns and let SQL `::date` do the grouping.
- Normalize `schedule` in `fetchBookings` so it always agrees with `appointment_date`.

### 16. MEDIUM — Silent Failures Around Sync, Notifications, Audit
**Files:** `src/services/garageService.js` (~1674, ~2294, and other empty catch blocks)
**Problem:** Booking sync, notification, and audit failures are swallowed. If Supabase is down, the booking exists only in sessionStorage/AsyncStorage and is lost on tab close.
**Fix:**
- Add `console.warn('[GarageService] ...', error)` in every empty catch.
- On sync failure, enqueue the booking into an offline retry queue (reuse `orderService.enqueueOfflineAction` pattern) and flush on app start/`mototrack_bookings_updated`.
- Surface a non-blocking UI warning in GaragePage when a booking is local-only pending sync.

### 17. MEDIUM — Duplicate Booking CRUD in `databaseService`
**Files:** `src/services/databaseService.js` (202-247) vs `src/services/garageService.js` (1488+)
**Problem:** Two `createBooking` implementations with different payload shapes (no downpayment/category/DP math in `databaseService`). Divergent writes corrupt data.
**Fix:**
- Make `garageService.createBooking` the single entry point. Have `databaseService.createBooking` delegate to it, or delete the duplicate and update all call sites (grep for `databaseService.createBooking` first).

### 18. MEDIUM — Meta Trailer in `notes` Can Corrupt User Text
**Files:** `src/services/garageService.js` (1209-1219 encode, 1364-1375 decode)
**Problem:** Fields (`time_slot`, `appointment_date`, `customer_email`, `repair_type`, `photos`) are packed into `notes` as a `__MT_META_START__…END__` JSON trailer. If user notes already contain that marker, meta is silently skipped → data loss. No validation.
**Fix:**
- After issue 2, move these fields to real columns and stop using the trailer for new writes; keep the decoder for legacy rows.
- Until then: escape/strip the marker from user notes before encoding, and store the meta under a key that cannot collide (or base64-encode the JSON blob).

### 19. LOW — Stale-First Reads in Charts and Admin
**Files:** `src/components/admin/BookingCategoryPieChart.jsx` (26, 47, 60, 97), admin booking views
**Problem:** They read `getLocalBookings()` first and stay stale until `getAllBookings` resolves.
**Fix:**
- Show a loading state, then render remote data; subscribe to both local and remote update events (they already listen to `mototrack_bookings_updated` — ensure remote fetch dispatches it).

### 20. LOW — `releaseMotorcycle` Odometer Fallback
**Files:** `src/services/garageService.js` (~1987)
**Problem:** Assumes numeric odometer and silently defaults to `5000`, corrupting vehicle history.
**Fix:**
- Validate odometer input as a non-negative number; if missing, leave unchanged instead of defaulting; show a validation error in the admin release form.

---

## Important Constraints
- Do NOT convert to TypeScript — keep all files as plain JavaScript.
- Do NOT add new npm dependencies unless absolutely necessary.
- Do NOT rewrite historical migration files — add ONE new idempotent migration for schema/RLS fixes (issues 1-3, and columns needed by 10-12).
- Maintain backward compatibility with existing local storage data (decode legacy `notes` trailers; migrate on read).
- Keep the existing file structure (`.jsx` for mobile, `.web.jsx` for web) and mirror every GaragePage fix in GaragePage.web and vice versa.
- Follow existing code style: no comments added unless the user requests them.
- Read https://docs.expo.dev/versions/v57.0.0/ before using any Expo API.
- After changes, run `npx eslint src/` to verify no lint errors.

## Suggested Order of Work
1. Migration + RLS + columns + unique slot index (issues 1-3)
2. Create-path fixes: submit guard, ID generation, validation, settings, capacity (issues 5-9)
3. Persistence: lifecycle, downpayment, reschedule, user scoping, admin RPC (issues 10-14)
4. Correctness cleanup (issues 15-20)

## Verification Checklist
After implementing fixes, verify:
1. The new migration applies cleanly on a fresh database AND on the existing database (idempotent re-run).
2. Creating a booking writes a row visible in the Supabase dashboard (all payload columns exist; no "column does not exist" errors in logs).
3. Two rapid bookings for the same date + slot + mechanic: exactly one succeeds; the second gets "Time slot is no longer available".
4. The confirm button disables during submission and cannot create duplicate bookings on double-tap.
5. Confirming with no time slot or a past date is blocked with a clear error.
6. Weekend bookings are blocked when `allowWeekendBookings` is false, including via direct `createBooking` call.
7. Approve → check-in → estimate → customer response → progress → payment → release: every step survives a page refresh and appears on a second device.
8. Downpayment status and a matching `payments` row are visible in Supabase after GCash "payment".
9. Editing storage/clearing sessionStorage does not lose lifecycle history (remote is source of truth).
10. Reschedule updates both local and Supabase `appointment_date`/`time_slot`.
11. Two users with the same display name see only their own bookings.
12. Admin approve/reject via RPC is rejected for non-admin sessions.
13. Sync failures log a warning and enqueue a retry instead of failing silently.
14. `npx eslint src/` passes.
```
