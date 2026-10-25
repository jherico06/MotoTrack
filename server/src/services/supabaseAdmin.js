import { createClient } from '@supabase/supabase-js';
const DEFAULT_SUPABASE_URL = 'https://vtbdmurblidtdghaotne.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0YmRtdXJibGlkdGRnaGFvdG5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwMzc1MTgsImV4cCI6MjEwMjYxMzUxOH0.MBzHtE42GqOTEReIr35QZfTSejrsk6UIdmc1mwIBqwI';

let cached = null;

/**
 * Prefer service role; fall back to anon key for read-only admin checks
 * when service role is not configured (local/dev/serverless).
 */
export function getSupabaseAdmin() {
  if (cached) return cached;

  const url =
    process.env.SUPABASE_URL ||
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    DEFAULT_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const anonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_ANON_KEY;
  const key = serviceKey || anonKey;

  if (!url || !key) {
    return null;
  }

  try {
    cached = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return cached;
  } catch (err) {
    console.warn('[supabaseAdmin] client creation error:', err?.message || err);
    return null;
  }
}

