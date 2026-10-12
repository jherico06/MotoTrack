import { getSupabaseAdmin } from './supabaseAdmin.js';

export const RATE_LIMITS = Object.freeze({
  WEEKLY_LIMIT: 3,
  CONSECUTIVE_LIMIT: 2,
  COOLDOWN_MINUTES: 30,
});

/**
 * In-flight lock per user_id to prevent race conditions from rapid multiple clicks
 * or concurrent requests across multiple browser tabs.
 */
const activeGenerations = new Set();

/**
 * Returns YYYY-MM-DD for the Monday 00:00:00 UTC of the given date's ISO week.
 */
export function getUtcWeekStart(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
  const diff = (day + 6) % 7; // distance from Monday
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

/**
 * Fetch authenticated user record from users table to verify identity and role.
 */
export async function getVerifiedUser(userId) {
  if (!userId || typeof userId !== 'string') return null;
  const cleanId = userId.trim();
  if (!cleanId) return null;

  try {
    const supabase = getSupabaseAdmin();
    const { data: user, error } = await supabase
      .from('users')
      .select('user_id, role, status, email, name')
      .eq('user_id', cleanId)
      .maybeSingle();

    if (error || !user) return null;
    return user;
  } catch (err) {
    console.error('[aiRateLimit] getVerifiedUser error:', err?.message || err);
    return null;
  }
}

/**
 * Check whether a user is an active administrator.
 */
export function isUserAdmin(user) {
  return Boolean(user && user.role === 'admin' && user.status === 'active');
}

/**
 * Calculate the user's current rate-limit usage and check if generation is permitted.
 */
export async function checkAiUsage(userId, userRecord = null) {
  const user = userRecord || (await getVerifiedUser(userId));
  if (!user) {
    return {
      allowed: false,
      reason: 'UNAUTHENTICATED',
      message: 'Sign in to generate AI installation previews.',
    };
  }

  // Administrators have unlimited AI generation access
  if (isUserAdmin(user)) {
    return {
      allowed: true,
      isAdmin: true,
      weeklyUsed: 0,
      weeklyLimit: null,
      consecutiveUsed: 0,
      consecutiveLimit: null,
      isCooldownActive: false,
      cooldownUntil: null,
      remainingSeconds: 0,
    };
  }

  const now = new Date();
  const currentWeekStart = getUtcWeekStart(now);
  const supabase = getSupabaseAdmin();

  let { data: row, error } = await supabase
    .from('ai_generation_usage')
    .select('*')
    .eq('user_id', user.user_id)
    .maybeSingle();

  if (error) {
    console.warn('[aiRateLimit] fetch usage warning:', error.message);
  }

  let weeklyUsed = 0;
  let consecutiveUsed = 0;
  let cooldownUntil = null;
  let isCooldownActive = false;
  let remainingSeconds = 0;

  if (row) {
    const isNewWeek = String(row.week_start || '') < currentWeekStart;
    const cooldownTime = row.cooldown_until ? new Date(row.cooldown_until) : null;
    const hasActiveCooldown = Boolean(cooldownTime && cooldownTime > now);

    if (isNewWeek) {
      // New week: weekly counter resets to 0
      weeklyUsed = 0;
      if (hasActiveCooldown) {
        // Cooldown still running its remaining minutes
        isCooldownActive = true;
        cooldownUntil = cooldownTime.toISOString();
        remainingSeconds = Math.max(0, Math.ceil((cooldownTime.getTime() - now.getTime()) / 1000));
        consecutiveUsed = Number(row.consecutive_generation_count) || 0;
      } else {
        // Cooldown expired or nonexistent
        consecutiveUsed = 0;
      }
    } else {
      // Same week
      weeklyUsed = Number(row.weekly_generation_count) || 0;
      if (hasActiveCooldown) {
        isCooldownActive = true;
        cooldownUntil = cooldownTime.toISOString();
        remainingSeconds = Math.max(0, Math.ceil((cooldownTime.getTime() - now.getTime()) / 1000));
        consecutiveUsed = Number(row.consecutive_generation_count) || 0;
      } else {
        // Cooldown has expired: consecutive counter resets
        if (row.consecutive_generation_count >= RATE_LIMITS.CONSECUTIVE_LIMIT) {
          consecutiveUsed = 0;
        } else {
          consecutiveUsed = Number(row.consecutive_generation_count) || 0;
        }
      }
    }
  }

  // 1. Check weekly limit first
  if (weeklyUsed >= RATE_LIMITS.WEEKLY_LIMIT) {
    return {
      allowed: false,
      reason: 'WEEKLY_LIMIT',
      isAdmin: false,
      weeklyUsed,
      weeklyLimit: RATE_LIMITS.WEEKLY_LIMIT,
      consecutiveUsed,
      consecutiveLimit: RATE_LIMITS.CONSECUTIVE_LIMIT,
      isCooldownActive: false,
      cooldownUntil: null,
      remainingSeconds: 0,
      message: "You've reached your weekly AI preview limit. You can generate another preview next week.",
    };
  }

  // 2. Check consecutive cooldown limit
  if (isCooldownActive) {
    return {
      allowed: false,
      reason: 'CONSECUTIVE_LIMIT',
      isAdmin: false,
      weeklyUsed,
      weeklyLimit: RATE_LIMITS.WEEKLY_LIMIT,
      consecutiveUsed,
      consecutiveLimit: RATE_LIMITS.CONSECUTIVE_LIMIT,
      isCooldownActive: true,
      cooldownUntil,
      remainingSeconds,
      message: 'Please wait before generating another preview.',
    };
  }

  // Allowed
  return {
    allowed: true,
    isAdmin: false,
    weeklyUsed,
    weeklyLimit: RATE_LIMITS.WEEKLY_LIMIT,
    consecutiveUsed,
    consecutiveLimit: RATE_LIMITS.CONSECUTIVE_LIMIT,
    isCooldownActive: false,
    cooldownUntil: null,
    remainingSeconds: 0,
  };
}

/**
 * Acquire concurrency lock for a user.
 */
export function acquireLock(userId) {
  if (activeGenerations.has(userId)) {
    return false;
  }
  activeGenerations.add(userId);
  return true;
}

/**
 * Release concurrency lock for a user.
 */
export function releaseLock(userId) {
  activeGenerations.delete(userId);
}

/**
 * Increment usage counters upon SUCCESSFUL generation and write history.
 */
export async function recordSuccessfulGeneration({
  user,
  motorcycleId = null,
  productId = null,
  imageUrl = null,
  prompt = null,
}) {
  const userId = user.user_id;
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const currentWeekStart = getUtcWeekStart(now);

  let newWeekly = 1;
  let newConsecutive = 1;
  let newCooldownUntil = null;

  if (!isUserAdmin(user)) {
    const { data: existing } = await supabase
      .from('ai_generation_usage')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      const isNewWeek = String(existing.week_start || '') < currentWeekStart;
      const cooldownTime = existing.cooldown_until ? new Date(existing.cooldown_until) : null;
      const cooldownExpired = Boolean(cooldownTime && cooldownTime <= now);

      if (isNewWeek) {
        newWeekly = 1;
      } else {
        newWeekly = (Number(existing.weekly_generation_count) || 0) + 1;
      }

      // If cooldown expired before this generation or starting fresh:
      if (cooldownExpired || (existing.consecutive_generation_count >= RATE_LIMITS.CONSECUTIVE_LIMIT && !cooldownTime)) {
        newConsecutive = 1;
      } else {
        newConsecutive = (Number(existing.consecutive_generation_count) || 0) + 1;
      }
    } else {
      newWeekly = 1;
      newConsecutive = 1;
    }

    // Activate cooldown if consecutive threshold reached
    if (newConsecutive >= RATE_LIMITS.CONSECUTIVE_LIMIT) {
      const cooldownEnd = new Date(now.getTime() + RATE_LIMITS.COOLDOWN_MINUTES * 60 * 1000);
      newCooldownUntil = cooldownEnd.toISOString();
    }

    const usagePayload = {
      user_id: userId,
      week_start: currentWeekStart,
      weekly_generation_count: newWeekly,
      consecutive_generation_count: newConsecutive,
      last_generated_at: now.toISOString(),
      cooldown_until: newCooldownUntil,
      updated_at: now.toISOString(),
    };

    const { error: upsertErr } = await supabase
      .from('ai_generation_usage')
      .upsert(usagePayload, { onConflict: 'user_id' });

    if (upsertErr) {
      console.error('[aiRateLimit] usage upsert error:', upsertErr.message);
    }
  }

  // Record generation history for audit
  const historyPayload = {
    user_id: userId,
    generated_at: now.toISOString(),
    status: 'success',
    motorcycle_id: motorcycleId || null,
    product_id: productId || null,
    image_url: imageUrl || null,
    prompt: prompt || null,
  };

  const { error: histErr } = await supabase
    .from('ai_generation_history')
    .insert(historyPayload);

  if (histErr) {
    console.warn('[aiRateLimit] history insert warning:', histErr.message);
  }

  const isCooldownActive = Boolean(newCooldownUntil && new Date(newCooldownUntil) > now);
  const remainingSeconds = isCooldownActive
    ? Math.max(0, Math.ceil((new Date(newCooldownUntil).getTime() - now.getTime()) / 1000))
    : 0;

  return {
    isAdmin: isUserAdmin(user),
    weeklyUsed: isUserAdmin(user) ? 0 : newWeekly,
    weeklyLimit: isUserAdmin(user) ? null : RATE_LIMITS.WEEKLY_LIMIT,
    consecutiveUsed: isUserAdmin(user) ? 0 : newConsecutive,
    consecutiveLimit: isUserAdmin(user) ? null : RATE_LIMITS.CONSECUTIVE_LIMIT,
    cooldownUntil: newCooldownUntil,
    isCooldownActive,
    remainingSeconds,
  };
}

/**
 * Record generation FAILURE in history without consuming quota.
 */
export async function recordFailedGeneration({
  userId,
  motorcycleId = null,
  productId = null,
  prompt = null,
  errorMessage = null,
}) {
  if (!userId) return;
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from('ai_generation_history').insert({
      user_id: userId,
      generated_at: new Date().toISOString(),
      status: 'failed',
      motorcycle_id: motorcycleId || null,
      product_id: productId || null,
      prompt: prompt || null,
      error_message: errorMessage ? String(errorMessage).slice(0, 500) : null,
    });
  } catch (err) {
    console.warn('[aiRateLimit] recordFailedGeneration warning:', err?.message || err);
  }
}
