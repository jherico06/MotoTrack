import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import os from 'os';
import customizeRouter from './routes/customize.js';
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
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    maxAge: 86400,
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/', (_req, res) => {
  res.json({
    name: 'MotoTrack AI Motorcycle Customizer API',
    endpoints: {
      health: 'GET /api/health',
      customize: 'POST /api/customize (multipart: bike, part, customRequest)',
    },
  });
});

app.use('/api', customizeRouter);
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
});
