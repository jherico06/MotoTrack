import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import os from 'os';
import customizeRouter from './routes/customize.js';
import staffRouter from './routes/staff.js';
import { multerErrorHandler } from './middleware/upload.js';

const app = express();
const PORT = Number(process.env.PORT) || 8787;
const HOST = process.env.HOST || '0.0.0.0';

const allowedOrigins = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser clients (RN fetch often has no Origin) and local/dev
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-User-Id',
      'X-Mototrack-User-Id',
      'X-Admin-User-Id',
      'X-Mototrack-Admin-Id',
    ],
    maxAge: 86400,
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/', (_req, res) => {
  res.json({
    name: 'MotoTrack API',
    endpoints: {
      health: 'GET /api/health',
      customize: 'POST /api/customize (multipart: bike, part, customRequest)',
      staffCreate: 'POST /api/staff/create',
      staffSendTempCredentials: 'POST /api/staff/send-temp-credentials',
      staffVerify: 'POST /api/staff/verify',
      staffList: 'GET /api/staff',
    },
  });
});

app.use('/api', customizeRouter);
app.use('/api/staff', staffRouter);
app.use(multerErrorHandler);

app.use((err, _req, res, _next) => {
  console.error('[server]', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

function listLanIPv4() {
  const nets = os.networkInterfaces();
  const results = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      const family = net.family === 'IPv4' || net.family === 4;
      if (family && !net.internal) results.push(net.address);
    }
  }
  return results;
}

app.listen(PORT, HOST, () => {
  const lan = listLanIPv4();
  console.log(`MotoTrack AI Customizer API listening on http://${HOST}:${PORT}`);
  console.log(`Local:   http://127.0.0.1:${PORT}`);
  lan.forEach((ip) => console.log(`LAN/device: http://${ip}:${PORT}`));
  console.log(`Health:  http://127.0.0.1:${PORT}/api/health`);
  if (!process.env.GEMINI_API_KEY) {
    console.warn('WARNING: GEMINI_API_KEY is not set. Copy server/.env.example → server/.env');
  }
  const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY);
  const hasAnon = Boolean(process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
  if (!hasServiceRole && !hasAnon) {
    console.warn(
      'WARNING: Set SUPABASE_SERVICE_ROLE_KEY (preferred) or SUPABASE_ANON_KEY in server/.env for staff APIs.'
    );
  } else if (!hasServiceRole) {
    console.warn(
      'NOTE: Using SUPABASE_ANON_KEY for staff APIs. For production, set SUPABASE_SERVICE_ROLE_KEY.'
    );
  }
  if (!process.env.RESEND_API_KEY && !process.env.SMTP_USER && !process.env.GMAIL_USER) {
    if (String(process.env.ALLOW_EMAIL_DEV_FALLBACK || '').toLowerCase() === 'true') {
      console.warn(
        'WARNING: No email provider — OTP/temp passwords are printed in THIS console only. Set RESEND_API_KEY or Gmail SMTP to send to Gmail.'
      );
    } else {
      console.warn('WARNING: Set RESEND_API_KEY or SMTP_USER/SMTP_PASS for staff OTP/credential emails.');
    }
  }
});
