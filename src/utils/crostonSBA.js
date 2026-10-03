/**
 * Croston / Syntetos-Boylan Approximation (SBA) for intermittent demand.
 * Deterministic — no AI. Missing periods must already be filled as zeros.
 *
 * SBA: forecast ≈ (z / p) * (1 - α/2)
 * where z = smoothed demand size, p = smoothed inter-demand interval.
 */

export const MIN_SBA_PERIODS = 4;
export const MIN_NONZERO_DEMANDS = 2;
export const DEFAULT_SMOOTHING_ALPHA = 0.15;
/** Clamp seasonal multipliers to avoid extreme overfit */
export const SEASONAL_FACTOR_MIN = 0.5;
export const SEASONAL_FACTOR_MAX = 1.5;
export const MIN_PERIODS_FOR_SEASONALITY = 12;

/**
 * @param {number[]} demandSeries chronological demand (zeros allowed)
 * @param {{ alpha?: number, minPeriods?: number, minNonZero?: number }} [opts]
 */
export function calculateCrostonSBA(demandSeries, opts = {}) {
  const alpha = Math.min(1, Math.max(0.01, Number(opts.alpha) || DEFAULT_SMOOTHING_ALPHA));
  const minPeriods = Number(opts.minPeriods) > 0 ? Number(opts.minPeriods) : MIN_SBA_PERIODS;
  const minNonZero = Number(opts.minNonZero) > 0 ? Number(opts.minNonZero) : MIN_NONZERO_DEMANDS;

  const series = Array.isArray(demandSeries)
    ? demandSeries.map((v) => Math.max(0, Number(v) || 0))
    : [];
  const n = series.length;
  const nonZeroIdx = [];
  for (let i = 0; i < n; i += 1) {
    if (series[i] > 0) nonZeroIdx.push(i);
  }
  const nonZeroCount = nonZeroIdx.length;
  const totalDemand = series.reduce((a, b) => a + b, 0);
  const meanDemand = n > 0 ? totalDemand / n : 0;

  const baseMeta = {
    method: 'croston_sba',
    observations: n,
    nonZeroObservations: nonZeroCount,
    totalDemand,
    meanDemand,
    alpha,
    lastDemandIndex: nonZeroCount ? nonZeroIdx[nonZeroCount - 1] : null,
  };

  if (n < minPeriods || nonZeroCount < minNonZero) {
    return {
      sufficient: false,
      forecast: meanDemand,
      z: null,
      p: null,
      ...baseMeta,
      error:
        nonZeroCount === 0
          ? 'No non-zero demand in lookback window.'
          : `Need ≥${minPeriods} periods and ≥${minNonZero} demand events (have ${n} periods, ${nonZeroCount} events).`,
    };
  }

  // Initialize z, p from first demand
  let z = series[nonZeroIdx[0]];
  let p = nonZeroIdx.length > 1 ? nonZeroIdx[1] - nonZeroIdx[0] : Math.max(1, n / nonZeroCount);
  let lastDemandPos = nonZeroIdx[0];

  for (let k = 1; k < nonZeroIdx.length; k += 1) {
    const idx = nonZeroIdx[k];
    const interval = idx - lastDemandPos;
    const size = series[idx];
    z = z + alpha * (size - z);
    p = p + alpha * (interval - p);
    lastDemandPos = idx;
  }

  // Interval must stay ≥ 1
  p = Math.max(1, p);
  const croston = z / p;
  // Syntetos-Boylan Approximation bias correction
  const forecast = Math.max(0, croston * (1 - alpha / 2));

  return {
    sufficient: true,
    forecast,
    z,
    p,
    croston,
    ...baseMeta,
    error: null,
  };
}

/**
 * Day-of-week (0–6) or month-of-year (1–12) seasonal factors from history.
 * @param {{ demand: number, dow?: number, month?: number }[]} points
 * @param {'dow'|'month'} kind
 */
export function computeSeasonalFactors(points, kind = 'dow') {
  const buckets = new Map();
  for (const pt of points || []) {
    const key = kind === 'month' ? Number(pt.month) : Number(pt.dow);
    if (!Number.isFinite(key)) continue;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(Math.max(0, Number(pt.demand) || 0));
  }
  const means = [];
  for (const arr of buckets.values()) {
    if (arr.length) means.push(arr.reduce((a, b) => a + b, 0) / arr.length);
  }
  const globalMean = means.length ? means.reduce((a, b) => a + b, 0) / means.length : 0;
  const factors = {};
  if (globalMean <= 0) {
    return { factors: {}, enabled: false, globalMean: 0 };
  }
  for (const [key, arr] of buckets.entries()) {
    const m = arr.reduce((a, b) => a + b, 0) / arr.length;
    let f = m / globalMean;
    f = Math.min(SEASONAL_FACTOR_MAX, Math.max(SEASONAL_FACTOR_MIN, f));
    factors[key] = f;
  }
  return { factors, enabled: true, globalMean };
}

/**
 * Apply seasonal factor to base forecast.
 */
export function applySeasonality(baseForecast, factor) {
  const f = Number(factor);
  if (!Number.isFinite(f) || f <= 0) return Math.max(0, Number(baseForecast) || 0);
  const clamped = Math.min(SEASONAL_FACTOR_MAX, Math.max(SEASONAL_FACTOR_MIN, f));
  return Math.max(0, (Number(baseForecast) || 0) * clamped);
}

/**
 * Project `ahead` future period forecasts from SBA (+ optional seasonality).
 */
export function projectSBAForecast(sbaResult, {
  ahead = 1,
  seasonalFactors = null,
  periodKeys = [],
  periodType = 'week',
} = {}) {
  const base = Math.max(0, Number(sbaResult?.forecast) || 0);
  const out = [];
  for (let i = 0; i < ahead; i += 1) {
    let factor = 1;
    if (seasonalFactors?.enabled && periodKeys[i]) {
      const key = periodKeys[i];
      if (periodType === 'day') {
        const [y, m, d] = String(key).split('-').map(Number);
        const dt = new Date(Date.UTC(y, m - 1, d));
        factor = seasonalFactors.factors[dt.getUTCDay()] ?? 1;
      } else if (periodType === 'month') {
        const m = Number(String(key).split('-')[1]);
        factor = seasonalFactors.factors[m] ?? 1;
      }
    }
    out.push({
      index: i + 1,
      periodKey: periodKeys[i] || null,
      forecast: Math.round(applySeasonality(base, factor) * 1000) / 1000,
      seasonalFactor: factor,
    });
  }
  return out;
}

/**
 * Sample standard deviation of demand series (population N-1).
 */
export function demandStdDev(series) {
  const vals = (series || []).map((v) => Math.max(0, Number(v) || 0));
  const n = vals.length;
  if (n < 2) return 0;
  const mean = vals.reduce((a, b) => a + b, 0) / n;
  const varSum = vals.reduce((a, b) => a + (b - mean) ** 2, 0);
  return Math.sqrt(varSum / (n - 1));
}

/**
 * Reorder point:
 * ROP = avgDailyDemand * (leadTimeDays + reviewPeriodDays) + safetyStock
 * safetyStock = z * demandStdDevDaily * sqrt(leadTimeDays)
 */
export function calculateReorderPoint({
  averageDailyDemand = 0,
  leadTimeDays = 3,
  reviewPeriodDays = 1,
  demandStdDevDaily = 0,
  z = 1.65,
} = {}) {
  const lt = Math.max(0, Number(leadTimeDays) || 0);
  const review = Math.max(0, Number(reviewPeriodDays) || 0);
  const avg = Math.max(0, Number(averageDailyDemand) || 0);
  const sigma = Math.max(0, Number(demandStdDevDaily) || 0);
  const zScore = Math.max(0, Number(z) || 0);
  const safetyStock = zScore * sigma * Math.sqrt(Math.max(lt, 0));
  const rop = avg * (lt + review) + safetyStock;
  return {
    reorderPoint: Math.max(0, Math.ceil(rop)),
    safetyStock: Math.max(0, Math.ceil(safetyStock)),
    averageDailyDemand: avg,
    leadTimeDays: lt,
    reviewPeriodDays: review,
    z: zScore,
  };
}

/**
 * Convert period demand mean to approximate daily demand.
 */
export function toAverageDailyDemand(meanPeriodDemand, periodType) {
  const m = Math.max(0, Number(meanPeriodDemand) || 0);
  if (periodType === 'day') return m;
  if (periodType === 'month') return m / 30;
  return m / 7; // week
}

/**
 * WAPE = Σ|a−p| / Σa ; null if Σa = 0
 */
export function calculateWAPE(pairs) {
  let absErr = 0;
  let sumAct = 0;
  for (const { actual, predicted } of pairs || []) {
    if (actual == null || predicted == null) continue;
    const a = Number(actual);
    const p = Number(predicted);
    if (!Number.isFinite(a) || !Number.isFinite(p)) continue;
    absErr += Math.abs(a - p);
    sumAct += Math.abs(a);
  }
  if (sumAct === 0) return null;
  return absErr / sumAct;
}

/**
 * MASE = MAE / naiveMAE ; naive = |y_t - y_{t-1}| mean on actuals series
 * pairs should be chronological. Returns null if undefined.
 */
export function calculateMASE(pairs) {
  const cleaned = (pairs || []).filter(
    (x) => x.actual != null && x.predicted != null && Number.isFinite(Number(x.actual))
  );
  if (cleaned.length < 2) return null;
  let mae = 0;
  for (const row of cleaned) {
    mae += Math.abs(Number(row.actual) - Number(row.predicted));
  }
  mae /= cleaned.length;

  let naive = 0;
  let naiveN = 0;
  for (let i = 1; i < cleaned.length; i += 1) {
    naive += Math.abs(Number(cleaned[i].actual) - Number(cleaned[i - 1].actual));
    naiveN += 1;
  }
  if (naiveN === 0) return null;
  naive /= naiveN;
  if (naive === 0) return mae === 0 ? 0 : null;
  return mae / naive;
}

export default {
  calculateCrostonSBA,
  computeSeasonalFactors,
  applySeasonality,
  projectSBAForecast,
  demandStdDev,
  calculateReorderPoint,
  toAverageDailyDemand,
  calculateWAPE,
  calculateMASE,
  MIN_SBA_PERIODS,
  MIN_NONZERO_DEMANDS,
  MIN_PERIODS_FOR_SEASONALITY,
};
