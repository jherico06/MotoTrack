# Prompt: Refactor MotoTrack (Expo + Supabase) with Security & Code Quality Improvements

## Context
You are working on **MotoTrack**, a React Native cross-platform app built with **Expo SDK 54** (iOS, Android, Web). It is a motorcycle parts & service e-commerce app using **Supabase** (PostgreSQL + Auth) with a hand-rolled JavaScript router and platform-specific pages (`.jsx` for mobile, `.web.jsx` for web).

**IMPORTANT:** Before writing any code, read the Expo v54 docs at `https://docs.expo.dev/versions/v54.0.0/` to verify current APIs.

Key facts:
- `package.json`: expo ~54.0.36, react-native 0.81.5, react 19.1.0, @supabase/supabase-js ^2.112.3, newArchEnabled: true
- `src/app/index.jsx` is the root router (state-machine via `currentScreen`, no react-navigation)
- `src/services/` (13 modules) = Supabase client, auth, users, orders, garage, products, promos, wishlist, AI customizer, Gemini, GCash sandbox, admin security
- `src/context/` = AuthContext, CartContext, WishlistContext
- Web + mobile variants of admin dashboard are ~5,115 lines each
- 100% JavaScript (no TypeScript), no tests, no lint config
- AGENTS.md in repo root enforces reading versioned Expo docs before coding

## Task List (implement in priority order)

### 1. Critical Security Fixes (HIGH)
- **Plaintext passwords**: `src/services/userService.js` and `src/services/authService.js` store/compare passwords as raw strings (`dbUser.password === password`). Implement password hashing (e.g., SHA-256 with email salt, stored as `sha256$<hex>`). Add an upgrade path so legacy plaintext rows are re-hashed on next successful sign-in without breaking existing accounts.
- **Hard-coded secrets**: Move Admin secret key (`ADMIN2026`), admin credentials (`admin@mototrack.com` / `admin123`), default admin PIN (`2026`), and any API keys (Supabase anon key, Gemini key, GCash test keys) into environment variables (`EXPO_PUBLIC_*`) via a central config module, with `.env` + `.env.example` files. Keep defaults so the app runs out-of-the-box.
- **Client-side-only admin enforcement**: Admin checks are only `currentUser.role === 'admin'` in components. Add Supabase Row-Level Security (RLS) policies in a SQL migration and document server-side enforcement.
- **Demo backdoors**: `demoCustomerLogin()` / `adminLogin()` one-click logins exist in `authService.js` and Login pages. Gate them behind an env flag (e.g., `EXPO_PUBLIC_ENABLE_DEMO_LOGINS`).

### 2. Data Layer (HIGH)
- **Duplicate services**: `databaseService.js` vs `orderService.js` both create orders; `authService.js` vs `userService.js` both handle auth; `garageService.js` vs `databaseService.js` both manage bookings. Consolidate into single-responsibility services and update all imports.
- **SQL schema embedded in client**: `src/services/supabaseClient.js` ships a 300-line 24-table SQL migration as a JS template string. Extract it to `supabase/migrations/` as proper SQL files.

### 3. Architecture (MEDIUM)
- **Navigation**: Replace the state-machine router + ~40 prop-drilled `onNavigateTo*` callbacks with Expo Router or react-navigation (back stack, deep-linking, state preservation).
- **Break up giant files**: Split `AdminDashboard.jsx` / `AdminDashboard.web.jsx` (5,115 lines each) and `LiveOrderTrackingMapModal.jsx` (2,240 lines) into feature modules, extracting shared logic into hooks so web/mobile variants converge.

### 4. Code Quality (MEDIUM)
- Add **TypeScript** (`*.tsx` for new files) with shared `Product`/`User`/`Order` types. Migrate the service layer only; do not force full migration.
- Add **ESLint (flat config, eslint-config-expo) + Prettier** and a `lint` script.
- Add minimal **Jest** tests for the service layer.
- Replace silent `catch {}` blocks with structured logging or error propagation.
- Consolidate the `* 50` USD→PHP currency conversion (currently in ~19 places) into a single `usdToPhp()` utility; centralize currency formatting.
- De-duplicate Bootstrap font injection logic in `src/app/index.jsx` and `src/components/common/BootstrapIcon.jsx`.

### 5. Reliability (MEDIUM)
- Realtime product subscriptions (`productService.subscribe`) are never torn down; clean up channels/subscriptions.
- The `supabase` Proxy object always truthy means connectivity guards never work; replace with an explicit nullable client + guards.

## Verification
1. Run `npx eslint` on changed files — must pass with no errors (warnings ok for pre-existing style).
2. Run `npx expo export --platform web` — must complete without bundling errors.
3. Run tests (`npm test`) if added.
4. Do NOT commit changes unless asked.

## Constraints
- Do not change behavior or UI. These are safety/code-quality refactors.
- Keep the app working with default/fallback data when Supabase is offline.
- Follow existing code style and conventions.
- Never log or expose secrets.