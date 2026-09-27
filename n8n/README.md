# MotoTrack × n8n Customization Integration

## Architecture

```
Customer App
  → customizationService (Supabase client)
    → Supabase Edge Functions (secrets stay server-side)
      → n8n webhooks
        → Compatibility automation / AI image generation
      → MotoTrack DB (source of truth)
```

## Edge function secrets

Set these in the Supabase project (Dashboard → Edge Functions → Secrets):

| Secret | Purpose |
|--------|---------|
| `N8N_COMPAT_WEBHOOK_URL` | Full URL of the Compatibility Check webhook |
| `N8N_PREVIEW_WEBHOOK_URL` | Full URL of the AI Preview webhook |
| `N8N_WEBHOOK_SECRET` | Shared secret sent as `X-MotoTrack-Secret` |

Never put these values in `EXPO_PUBLIC_*` or React Native code.

## n8n env vars

| Variable | Purpose |
|----------|---------|
| `MOTOTRACK_WEBHOOK_SECRET` | Must match `N8N_WEBHOOK_SECRET` |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role for Rest + edge calls |

## Import workflows

1. Import `mototrack-compatibility.json`
2. Import `mototrack-ai-preview.json`
3. Activate both workflows
4. Copy production webhook URLs into Edge Function secrets
5. Deploy edge functions:

```bash
supabase functions deploy customization-compatibility
supabase functions deploy customization-preview
```

## Rules

- Compatibility always comes from `product_compatibility` (and edge/n8n DB reads)
- Prices & stock always come from `products` + `inventory`
- AI only generates the visual preview image
