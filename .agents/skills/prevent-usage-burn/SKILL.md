---
name: prevent-usage-burn
description: >-
  Prevents Supabase API/log-ingestion burn, refetch storms, polling loops, and
  browser storage quota failures in MotoTrack. Use when adding or changing
  services that call Supabase, subscribe/notify listeners, setInterval/polling,
  list/fetch caches, Realtime channels, wishlist/customization persistence,
  RPCs, admin dashboards, Install Studio, or when the user mentions log
  ingestion, egress, quota, usage burn, high API traffic, or rate limits.
---

# Prevent Usage Burn (MotoTrack)

Hard rules for any change that talks to Supabase or persists large client data.
A single subscribe↔fetch loop has already burned **~1M edge requests / day**
(`customizations` + `customization_items`).

## Mandatory checklist (before finishing work)

Copy and complete:

```
Usage-burn review:
- [ ] No list/fetch calls notify() listeners that re-call the same list/fetch
- [ ] Remote LIST cache writes are silent ({ silent: true })
- [ ] Fetch has TTL and/or in-flight dedupe (no force:true on every render)
- [ ] No setInterval / focus polling of Supabase RPCs or full-table selects
- [ ] Cron/expiry jobs stay server-side (pg_cron) — never client-polled
- [ ] Subscribe handlers are debounced if they refetch
- [ ] No multi‑MB data: URIs written to sessionStorage / wishlist / local caches
- [ ] Selects are column-limited + paginated; avoid select('*') on hot paths
```

If any box fails, fix before shipping.

## Forbidden patterns

### 1. List → notify → list (infinite storm)

**Never** notify subscribers from a remote LIST cache write.

```js
// BAD — burns log ingestion
function saveLocal(list) {
  appStorage.setItem(KEY, JSON.stringify(list));
  notify(); // listeners call listX() again
}
async function listX() {
  const rows = await supabase.from('x').select(...);
  saveLocal(rows); // notifies → listX → ...
}

// GOOD
function saveLocal(list, { silent = false } = {}) {
  appStorage.setItem(KEY, JSON.stringify(list));
  if (!silent) notify();
}
async function listX() {
  const rows = await fetchRemote();
  saveLocal(rows, { silent: true }); // cache only
  return rows;
}
// notify() only on real create/update/delete
```

Canonical example: `src/services/bookings/customizationService.js`
(`saveLocalCustomizations(..., { silent: true })` on list).

### 2. Client polling of server jobs

Do **not** call RPCs like `expire_unpaid_downpayment_bookings` from React
`useEffect` / timers. Use **pg_cron** only. See comment in `src/app/index.jsx`.

### 3. Refetch on every focus / every auth object identity change

- Depend on stable IDs (`currentUser?.id`), not the whole `currentUser` object
- Prefer TTL cache (15–60s) + `force` only after mutations
- Debounce subscribe→refetch (≥300–800ms)

### 4. Storage quota burn (wishlist / previews)

Web `appStorage` uses **sessionStorage** (small quota).

- Never persist AI `data:` image URIs in wishlist / session caches
- Store customization ID + uploaded `https://` preview URL
- Hydrate wishlist from Supabase `wishlist_items` on login

Canonical: `src/services/products/wishlistService.js` (`sanitizePreviewUrl`).

## Required patterns for new Supabase reads

```js
const TTL_MS = 15000;
const cache = new Map();      // key -> { at, data }
const inflight = new Map();   // key -> Promise

async function listThings({ force = false } = {}) {
  const key = 'default';
  if (!force) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
    if (inflight.has(key)) return inflight.get(key);
  }
  const p = (async () => {
    const { data, error } = await client
      .from('things')
      .select('id,name,updated_at') // columns only
      .limit(50);
    if (error) throw error;
    cache.set(key, { at: Date.now(), data: data || [] });
    return data || [];
  })();
  inflight.set(key, p);
  try {
    return await p;
  } finally {
    inflight.delete(key);
  }
}
```

Invalidate TTL only after create/update/delete.

## Hot tables (extra caution)

These paths have historically dominated edge logs — treat as high-risk:

| Path | Notes |
|------|--------|
| `/rest/v1/customizations` | Install Studio / Profile list |
| `/rest/v1/customization_items` | Joined on every list |
| `/rest/v1/customer_motorcycles` | Garage sync |
| `/rest/v1/orders` | Use existing TTL in `orderService` |
| `/rest/v1/bookings` | Prefer targeted selects |
| `/rest/v1/rpc/expire_unpaid_*` | Cron only |

## When investigating high Log Ingestion

1. Query Supabase logs by `request.path` (edge_logs) for last 24h
2. If one REST path is >50% of volume → hunt subscribe/notify or polling
3. Confirm referer (often `localhost:8081` during local storms)
4. Fix silent-cache + TTL before adding more UI

Details: [reference.md](reference.md)

## Agent response duty

When this skill applies, briefly state in the final reply what burn risks were
checked (or fixed). Do not ship features that reintroduce client RPC polling or
list→notify→list loops.
