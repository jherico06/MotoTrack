# Prevent Usage Burn — Reference

## Known incident (2026-10)

**Symptom:** Supabase Log Ingestion ~13 GB / 20 GB (Upcoming limit).

**24h edge_logs breakdown (approx):**

| Path | Count | Share |
|------|------:|------:|
| `/rest/v1/customizations` | ~583k | ~57% |
| `/rest/v1/customization_items` | ~440k | ~43% |
| All other paths | ~7k | &lt;1% |

**Root cause:** `listCustomizations()` wrote local cache and called `notify()`.
UI subscribers (`AiMotorcycleInstallStudio`, Profile, `useCustomizationBuilder`)
called `listCustomizations()` again → infinite loop while Install Studio was open.

**Referer:** almost entirely `http://localhost:8081/` (local Expo web).

**Fix:**

- `saveLocalCustomizations(list, { silent: true })` on LIST
- 15s TTL + in-flight dedupe on `listCustomizations`
- Debounced subscribe refresh in Install Studio
- Invalidate list cache only on create/update/delete

## Related prior incident

Client tabs polling `expire_unpaid_downpayment_bookings` flooded API logs.
Moved to **pg_cron only**; `src/app/index.jsx` documents the ban.

## Wishlist “save disappeared” incident

AI preview base64 (`data:image/...`) exceeded sessionStorage quota.
`setItem` failed; stale empty payload remained → wishlist looked empty after refresh.

**Fix:** strip `data:` URLs; persist customization ID + storage HTTPS URL;
hydrate from `wishlist_items` + `customizations.preview_image_url`.

## How to diagnose with Supabase MCP

```sql
-- Volume by source
select source, count(*) as cnt
from logs
group by source
order by cnt desc
limit 20;

-- Hottest REST paths (use attribute key request.path)
select log_attributes['request.path'] as path, count(*) as cnt
from logs
where source = 'edge_logs'
group by path
order by cnt desc
limit 40;

-- Who is calling
select
  log_attributes['request.headers.referer'] as referer,
  count(*) as cnt
from logs
where source = 'edge_logs'
  and log_attributes['request.path'] = '/rest/v1/customizations'
group by referer
order by cnt desc
limit 10;
```

Project ref historically used: `vtbdmurblidtdghaotne` (Mototrack).

## Code anchors

| Concern | File |
|---------|------|
| Silent list cache | `src/services/bookings/customizationService.js` |
| Orders TTL | `src/services/orders/orderService.js` |
| No client expire RPC | `src/app/index.jsx`, `garageService.js` |
| Wishlist sanitize + hydrate | `src/services/products/wishlistService.js` |
| Wishlist context hydrate | `src/context/WishlistContext.jsx` |
| Install Studio save/debounce | `src/components/customizer/AiMotorcycleInstallStudio.jsx` |

## Review heuristics for PRs

Flag as **critical** if the diff:

1. Adds `subscribe(() => listOrFetch())` without debounce/TTL
2. Calls `notify()` after every remote read
3. Adds `setInterval` that hits Supabase
4. Uses `force: true` / cache bypass on mount or every render
5. Stores `data:` images in `appStorage` / wishlist
6. Reintroduces client calls to expire/cron RPCs
