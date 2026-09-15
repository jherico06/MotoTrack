// ─── CENTRALIZED APP CONFIGURATION ──────────────────────────────────────────
// All secrets/keys are supplied through EXPO_PUBLIC_* environment variables
// (see .env.example). Hard-coded values below are DEFAULTS ONLY so the app
// keeps running out-of-the-box; override them in your .env file for production.

const env = typeof process !== 'undefined' && process.env ? process.env : {};

export const APP_CONFIG = {
  appName: env.EXPO_PUBLIC_APP_NAME || 'MotoTrack',
  version: '1.0.0',
  supabase: {
    url: env.EXPO_PUBLIC_SUPABASE_URL || '',
    anonKey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
  },
  admin: {
    secretKey: env.EXPO_PUBLIC_ADMIN_SECRET_KEY || 'ADMIN2026',
    defaultPin: env.EXPO_PUBLIC_ADMIN_DEFAULT_PIN || '2026',
    adminEmail: env.EXPO_PUBLIC_ADMIN_EMAIL || 'admin@mototrack.com',
  },
  gemini: {
    apiKey: env.EXPO_PUBLIC_GEMINI_API_KEY || '',
    model: env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-1.5-flash',
  },
  gcash: {
    merchantId: env.EXPO_PUBLIC_GCASH_MERCHANT_ID || 'MOTOTRACK-GRABPAY-DEMO',
    clientKey: env.EXPO_PUBLIC_GCASH_CLIENT_KEY || 'gcash-sandbox-key',
  },
  demo: {
    // Set EXPO_PUBLIC_ENABLE_DEMO_LOGINS=false to disable the one-click demo /
    // admin backdoor logins on the Sign In screen.
    enableDemoLogins: env.EXPO_PUBLIC_ENABLE_DEMO_LOGINS !== 'false',
  },
  currency: {
    usdToPhpRate: Number(env.EXPO_PUBLIC_USD_TO_PHP_RATE || 50),
  },
};

export const SUPABASE_URL = APP_CONFIG.supabase.url;
export const SUPABASE_ANON_KEY = APP_CONFIG.supabase.anonKey;
export const ADMIN_SECRET_KEY = APP_CONFIG.admin.secretKey;
export const GEMINI_API_KEY = APP_CONFIG.gemini.apiKey;
export const USD_TO_PHP_RATE = APP_CONFIG.currency.usdToPhpRate;

export default APP_CONFIG;
