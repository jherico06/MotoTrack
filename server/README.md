# MotoTrack AI Motorcycle Customizer (Express + Google GenAI)

End-to-end pipeline:

```
React Native / Expo
  → multipart POST /api/customize (bike + part + customRequest)
    → Express (server/)
      → Gemini 2.5 Flash analyzes both images → Imagen prompt
      → imagen-3.0-generate-002 (4:3, no persons)
        ↳ fallback: gemini-2.5-flash-image if Imagen unavailable
      → Base64 image JSON response
```

## Directory structure

```
server/
  package.json
  .env.example
  README.md
  src/
    index.js
    middleware/upload.js
    routes/customize.js
    services/aiCustomizeService.js

src/
  services/aiCustomizeApi.js
  components/customizer/AiMotorcycleInstallStudio.jsx
```

## 1) Backend setup

```bash
cd server
cp .env.example .env
# Edit .env and set GEMINI_API_KEY=...

npm install
npm run dev
```

Server prints LAN IPs, e.g.:

```
Local:      http://127.0.0.1:8787
LAN/device: http://192.168.1.10:8787
```

Health check:

```bash
curl http://127.0.0.1:8787/api/health
```

## 2) Frontend setup (Expo app root)

```bash
cd ..
npm install
```

Add to root `.env`:

```env
EXPO_PUBLIC_CUSTOMIZE_API_URL=http://192.168.1.10:8787
EXPO_PUBLIC_GEMINI_API_KEY=
```

> Physical phones cannot reach `localhost` / `127.0.0.1` on your PC.  
> Use the **LAN IP** printed by the server.

Restart Expo after changing env:

```bash
npx expo start -c
```

Open **Customize → AI Install** tab.

## 3) Physical device networking (no CORS / Network Request Failed)

1. Phone and PC must be on the **same Wi‑Fi**.
2. Set `EXPO_PUBLIC_CUSTOMIZE_API_URL` to `http://YOUR_LAN_IP:8787` (not localhost).
3. Windows Firewall: allow inbound TCP **8787** for Node, or temporarily allow Node.js.
4. iOS App Transport: for plain `http://` LAN URLs in production builds you need ATS exceptions; Expo Go / debug usually works for local HTTP.
5. Android emulator special case: `http://10.0.2.2:8787` maps to host localhost (already defaulted in code when env is empty).
6. CORS is open in local/dev (`CORS_ORIGINS` empty). For production, set allowed origins in `server/.env`.

## 4) API contract

`POST /api/customize` — `multipart/form-data`

| Field | Type | Required |
|-------|------|----------|
| `bike` | image file | yes |
| `part` | image file | yes |
| `customRequest` | text | no |

Success response:

```json
{
  "success": true,
  "mimeType": "image/png",
  "imageBase64": "...",
  "dataUrl": "data:image/png;base64,...",
  "promptUsed": "...",
  "model": "imagen-3.0-generate-002"
}
```

## 5) Notes on Imagen 3

`imagen-3.0-generate-002` is requested first (aspect **4:3**, `personGeneration: DONT_ALLOW`).  
If your API key cannot access Imagen 3 (deprecated/shut down on many accounts), the server **automatically falls back** to `gemini-2.5-flash-image` so generation still works.

## 6) Security

- Keep `GEMINI_API_KEY` **only** in `server/.env` — never ship it in the Expo bundle for production.
- The older in-app Gemini path still uses `EXPO_PUBLIC_GEMINI_API_KEY` for legacy flows; prefer this Express API for bike+part installs.
