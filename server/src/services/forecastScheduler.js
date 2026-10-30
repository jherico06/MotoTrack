/**
 * Scheduled Forecasting Process (Simple Linear Regression)
 * ---------------------------------------------------------------------------
 * Implements automatic scheduled forecast updates for:
 *   - Daily forecasts: updated daily (every 24 hours)
 *   - Weekly forecasts: updated weekly (every 7 days)
 *   - Monthly forecasts: updated monthly (every 30 days)
 *
 * Safeguards:
 *   - Prevents duplicate concurrent executions per period using an in-memory mutex lock.
 *   - Retries failed product forecast calculations up to `maxRetries` times with backoff.
 *   - Never runs on individual frontend page loads.
 */
import { getSupabaseAdmin } from './supabaseAdmin.js';
import { generateForecast, validateForecastPeriod } from './forecastService.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export const SCHEDULE_INTERVALS_MS = Object.freeze({
  daily: DAY_MS,
  weekly: 7 * DAY_MS,
  monthly: 30 * DAY_MS,
});

const runningJobs = new Map();
const schedulerTimers = new Map();
const jobRunHistory = {
  daily: { lastRunAt: null, lastStatus: 'idle', processed: 0, succeeded: 0, failed: 0, lastError: null },
  weekly: { lastRunAt: null, lastStatus: 'idle', processed: 0, succeeded: 0, failed: 0, lastError: null },
  monthly: { lastRunAt: null, lastStatus: 'idle', processed: 0, succeeded: 0, failed: 0, lastError: null },
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a single product forecast with retry protection.
 */
async function generateForecastWithRetry(
  productId,
  period,
  { maxRetries = 2, retryDelayMs = 200, options = {} } = {}
) {
  let attempt = 0;
  let lastError = null;
  while (attempt <= maxRetries) {
    try {
      const result = await generateForecast(productId, period, {
        ...options,
        persist: options.persist !== false,
        force: true,
      });
      return { ok: true, attempt: attempt + 1, result };
    } catch (err) {
      lastError = err;
      attempt += 1;
      if (attempt <= maxRetries) {
        await sleep(retryDelayMs * attempt);
      }
    }
  }
  return {
    ok: false,
    attempt,
    error: lastError?.message || String(lastError),
  };
}

/**
 * Fetch active product IDs from PostgreSQL for batch scheduled forecasting.
 */
async function fetchActiveProductIds({ supabaseClient = null, limit = 500 } = {}) {
  const supabase = supabaseClient || getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase.from('products').select('product_id, status').limit(limit);

  if (error || !Array.isArray(data)) return [];
  return data
    .filter((p) => {
      const status = String(p.status || 'active').toLowerCase();
      return status !== 'archived' && status !== 'deleted';
    })
    .map((p) => String(p.product_id))
    .filter(Boolean);
}

/**
 * Run a batch forecast update for a specific frequency ('daily' | 'weekly' | 'monthly').
 * Prevents duplicate concurrent executions for the same frequency.
 */
export async function runScheduledForecastJob(period = 'daily', options = {}) {
  const periodCfg = validateForecastPeriod(period, { strict: true });
  const canonicalPeriod = periodCfg.period;

  if (runningJobs.get(canonicalPeriod)) {
    return {
      skipped: true,
      reason: 'already_running',
      period: canonicalPeriod,
      startedAt: runningJobs.get(canonicalPeriod).startedAt,
    };
  }

  const startedAt = new Date().toISOString();
  runningJobs.set(canonicalPeriod, { startedAt });
  jobRunHistory[canonicalPeriod] = {
    ...jobRunHistory[canonicalPeriod],
    lastRunAt: startedAt,
    lastStatus: 'running',
    lastError: null,
  };

  try {
    const productIds = Array.isArray(options.productIds)
      ? options.productIds
      : await fetchActiveProductIds({
          supabaseClient: options.supabaseClient,
          limit: options.limit || 500,
        });

    let succeeded = 0;
    let failed = 0;
    const errors = [];

    for (const productId of productIds) {
      const outcome = await generateForecastWithRetry(productId, canonicalPeriod, {
        maxRetries: options.maxRetries ?? 2,
        retryDelayMs: options.retryDelayMs ?? 150,
        options: {
          supabaseClient: options.supabaseClient,
          persist: options.persist !== false,
          productContext: options.productContexts?.[productId],
          transactions: options.transactionsByProduct?.[productId],
        },
      });

      if (outcome.ok) {
        succeeded += 1;
      } else {
        failed += 1;
        errors.push({ productId, error: outcome.error, attempts: outcome.attempt });
      }
    }

    const completedAt = new Date().toISOString();
    const summary = {
      skipped: false,
      period: canonicalPeriod,
      startedAt,
      completedAt,
      processed: productIds.length,
      succeeded,
      failed,
      errors,
    };

    jobRunHistory[canonicalPeriod] = {
      lastRunAt: completedAt,
      lastStatus: failed > 0 && succeeded === 0 ? 'failed' : 'completed',
      processed: productIds.length,
      succeeded,
      failed,
      lastError: errors[0]?.error || null,
    };

    return summary;
  } catch (err) {
    const completedAt = new Date().toISOString();
    jobRunHistory[canonicalPeriod] = {
      ...jobRunHistory[canonicalPeriod],
      lastRunAt: completedAt,
      lastStatus: 'failed',
      lastError: err?.message || String(err),
    };
    throw err;
  } finally {
    runningJobs.delete(canonicalPeriod);
  }
}

/**
 * Start background interval schedulers for daily, weekly, and monthly forecast updates.
 */
export function startForecastScheduler(options = {}) {
  if (schedulerTimers.size > 0) {
    return getForecastSchedulerStatus();
  }

  for (const [period, intervalMs] of Object.entries(SCHEDULE_INTERVALS_MS)) {
    const timer = setInterval(() => {
      runScheduledForecastJob(period, options).catch((err) => {
        console.error(`[forecastScheduler] Scheduled ${period} forecast job failed:`, err?.message || err);
      });
    }, intervalMs);

    if (typeof timer.unref === 'function') {
      timer.unref();
    }
    schedulerTimers.set(period, timer);
  }

  return getForecastSchedulerStatus();
}

/**
 * Stop all background forecast scheduler timers.
 */
export function stopForecastScheduler() {
  for (const timer of schedulerTimers.values()) {
    clearInterval(timer);
  }
  schedulerTimers.clear();
}

/**
 * Return current scheduler state and recent job run metrics.
 */
export function getForecastSchedulerStatus() {
  return {
    active: schedulerTimers.size > 0,
    scheduledPeriods: Array.from(schedulerTimers.keys()),
    runningPeriods: Array.from(runningJobs.keys()),
    intervalsHours: {
      daily: SCHEDULE_INTERVALS_MS.daily / (60 * 60 * 1000),
      weekly: SCHEDULE_INTERVALS_MS.weekly / (60 * 60 * 1000),
      monthly: SCHEDULE_INTERVALS_MS.monthly / (60 * 60 * 1000),
    },
    history: { ...jobRunHistory },
  };
}

export default {
  SCHEDULE_INTERVALS_MS,
  runScheduledForecastJob,
  startForecastScheduler,
  stopForecastScheduler,
  getForecastSchedulerStatus,
};
