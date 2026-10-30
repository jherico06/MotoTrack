/**
 * Statistical Simple Linear Regression Forecasting & Inventory Planning Utilities.
 *
 * Primary Model:
 *   Y = a + bX
 *   b = [nΣXY - (ΣX)(ΣY)] / [nΣX² - (ΣX)²]
 *   a = [ΣY - b(ΣX)] / n
 *
 * Pure native JavaScript mathematical implementation (no AI / ML).
 */

export const MIN_REGRESSION_PERIODS = 2;
export const ALGORITHM_NAME = 'simple_linear_regression';

/**
 * Configurable forecasting windows and horizons per frequency.
 * - Daily:   90 days historical window, 30 days forecast horizon
 * - Weekly:  26 weeks historical window, 12 weeks forecast horizon
 * - Monthly: 12 months historical window, 6 months forecast horizon
 */
export const FORECAST_PERIOD_CONFIG = {
  daily: {
    period: 'daily',
    bucketType: 'day',
    sqlTrunc: 'day',
    historicalWindow: 90,
    forecastHorizon: 30,
    daysPerPeriod: 1,
  },
  weekly: {
    period: 'weekly',
    bucketType: 'week',
    sqlTrunc: 'week',
    historicalWindow: 26,
    forecastHorizon: 12,
    daysPerPeriod: 7,
  },
  monthly: {
    period: 'monthly',
    bucketType: 'month',
    sqlTrunc: 'month',
    historicalWindow: 12,
    forecastHorizon: 6,
    daysPerPeriod: 30,
  },
};

/**
 * Validate and normalize requested forecasting period before using in DATE_TRUNC or aggregation.
 * Accepts 'daily' | 'day' | 'weekly' | 'week' | 'monthly' | 'month'.
 * Throws an Error on invalid input when strict=true.
 */
export function validateForecastPeriod(period, { strict = false } = {}) {
  const raw = String(period || '')
    .trim()
    .toLowerCase();
  if (raw === 'daily' || raw === 'day') return FORECAST_PERIOD_CONFIG.daily;
  if (raw === 'weekly' || raw === 'week') return FORECAST_PERIOD_CONFIG.weekly;
  if (raw === 'monthly' || raw === 'month') return FORECAST_PERIOD_CONFIG.monthly;
  if (strict) {
    throw new Error(`Invalid forecast period "${period}". Expected "daily", "weekly", or "monthly".`);
  }
  return FORECAST_PERIOD_CONFIG.weekly;
}

/**
 * Clean floating-point arithmetic noise (e.g. 1.9999999999999998 -> 2).
 */
function cleanFloat(value, decimals = 10) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/**
 * Normalize input observations into validated { x, y } points.
 * Filters out null, NaN, non-numeric, or negative demand records.
 *
 * @param {Array<number | { x?: number, y?: number, period?: number, demand?: number, quantity?: number }>} data
 */
export function sanitizeRegressionData(data) {
  if (!Array.isArray(data)) {
    return { points: [], invalidCount: 0, negativeCount: 0 };
  }

  const points = [];
  let invalidCount = 0;
  let negativeCount = 0;

  for (let i = 0; i < data.length; i += 1) {
    const item = data[i];
    if (typeof item === 'number') {
      if (!Number.isFinite(item)) {
        invalidCount += 1;
        continue;
      }
      if (item < 0) {
        negativeCount += 1;
        invalidCount += 1;
        continue;
      }
      points.push({ x: points.length + 1, y: item });
      continue;
    }

    if (!item || typeof item !== 'object') {
      invalidCount += 1;
      continue;
    }

    const rawX = item.x ?? item.period ?? item.periodNumber ?? i + 1;
    const rawY = item.y ?? item.demand ?? item.quantity ?? item.actual;
    const x = Number(rawX);
    const y = Number(rawY);

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      invalidCount += 1;
      continue;
    }
    if (y < 0) {
      negativeCount += 1;
      invalidCount += 1;
      continue;
    }

    points.push({ x, y });
  }

  return { points, invalidCount, negativeCount };
}

/**
 * Calculate Simple Linear Regression parameters mathematically:
 *   Y = a + bX
 *   b = [nΣXY - (ΣX)(ΣY)] / [nΣX² - (ΣX)²]
 *   a = [ΣY - b(ΣX)] / n
 *
 * Responsibilities:
 * - Calculate the number of historical observations (n)
 * - Calculate ΣX, ΣY, ΣXY, ΣX²
 * - Calculate regression slope (b) and intercept (a)
 * - Calculate R-squared (rSquared)
 * - Validate insufficient or invalid data, constant X values, and zero-demand series
 *
 * @param {Array<number | { x?: number, y?: number, period?: number, demand?: number }>} data
 */
export function calculateLinearRegression(data) {
  const { points, invalidCount, negativeCount } = sanitizeRegressionData(data);
  const n = points.length;

  if (n < MIN_REGRESSION_PERIODS) {
    return {
      n,
      observations: n,
      sumX: n === 1 ? points[0].x : 0,
      sumY: n === 1 ? points[0].y : 0,
      sumXY: n === 1 ? points[0].x * points[0].y : 0,
      sumX2: n === 1 ? points[0].x * points[0].x : 0,
      sumY2: n === 1 ? points[0].y * points[0].y : 0,
      meanX: n === 1 ? points[0].x : 0,
      meanY: n === 1 ? points[0].y : 0,
      slope: 0,
      intercept: 0,
      rSquared: 0,
      equation: '',
      sufficient: false,
      constantX: false,
      zeroDemand: n === 0 || points.every((p) => p.y === 0),
      poorFit: true,
      invalidCount,
      negativeCount,
      error: 'Insufficient historical sales data for forecasting (at least 2 valid observations required).',
    };
  }

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i += 1) {
    const { x, y } = points[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;
  }

  sumX = cleanFloat(sumX);
  sumY = cleanFloat(sumY);
  sumXY = cleanFloat(sumXY);
  sumX2 = cleanFloat(sumX2);
  sumY2 = cleanFloat(sumY2);

  const meanX = cleanFloat(sumX / n);
  const meanY = cleanFloat(sumY / n);
  const denominator = cleanFloat(n * sumX2 - sumX * sumX);

  if (denominator === 0) {
    return {
      n,
      observations: n,
      sumX,
      sumY,
      sumXY,
      sumX2,
      sumY2,
      meanX,
      meanY,
      slope: 0,
      intercept: meanY,
      rSquared: 0,
      equation: formatRegressionEquation(meanY, 0),
      sufficient: false,
      constantX: true,
      zeroDemand: sumY === 0,
      poorFit: true,
      invalidCount,
      negativeCount,
      error: 'Constant X values detected; regression slope cannot be determined.',
    };
  }

  const numerator = cleanFloat(n * sumXY - sumX * sumY);
  const slope = cleanFloat(numerator / denominator);
  const intercept = cleanFloat((sumY - slope * sumX) / n);

  // Calculate R-squared = 1 - (SS_res / SS_tot)
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i += 1) {
    const { x, y } = points[i];
    const yHat = intercept + slope * x;
    const diffTot = y - meanY;
    const diffRes = y - yHat;
    ssTot += diffTot * diffTot;
    ssRes += diffRes * diffRes;
  }
  ssTot = cleanFloat(ssTot);
  ssRes = cleanFloat(ssRes);

  const zeroDemand = sumY === 0;
  let rSquared = 0;
  if (ssTot === 0) {
    // Constant Y series: if all Y are 0, R² = 0 (zero demand); if constant positive demand and residual is 0, R² = 1
    rSquared = !zeroDemand && ssRes === 0 ? 1 : 0;
  } else {
    rSquared = cleanFloat(Math.max(0, Math.min(1, 1 - ssRes / ssTot)));
  }

  const poorFit = !zeroDemand && ssTot > 0 && rSquared < 0.3;

  return {
    n,
    observations: n,
    sumX,
    sumY,
    sumXY,
    sumX2,
    sumY2,
    meanX,
    meanY,
    slope,
    intercept,
    rSquared,
    equation: formatRegressionEquation(intercept, slope),
    sufficient: true,
    constantX: false,
    zeroDemand,
    poorFit,
    invalidCount,
    negativeCount,
    error: null,
  };
}

/**
 * Predict future product demand using Y = a + bX.
 *
 * Responsibilities:
 * - Calculate predicted demand using the regression equation Y = a + bX
 * - Prevent negative demand predictions (clamped at 0)
 * - Return whole-number inventory quantities using an appropriate rounding policy (default: Math.round)
 *
 * @param {{ intercept?: number, a?: number, slope?: number, b?: number, sufficient?: boolean }} model
 * @param {number} futurePeriod - Future time period index X
 * @param {{ round?: boolean | 'round' | 'ceil' | 'floor' }} [options]
 * @returns {number}
 */
export function predictDemand(model, futurePeriod, options = {}) {
  if (!model || typeof model !== 'object') return 0;
  if (model.sufficient === false && model.constantX !== true) return 0;

  const a = Number(model.intercept ?? model.a ?? 0);
  const b = Number(model.slope ?? model.b ?? 0);
  const x = Number(futurePeriod);

  if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(x)) {
    return 0;
  }

  const rawY = a + b * x;
  const nonNegativeY = Math.max(0, cleanFloat(rawY));

  const roundPolicy = options.round !== undefined ? options.round : 'round';
  if (roundPolicy === false || roundPolicy === 'none') {
    return nonNegativeY;
  }
  if (roundPolicy === 'ceil') {
    return Math.ceil(nonNegativeY);
  }
  if (roundPolicy === 'floor') {
    return Math.floor(nonNegativeY);
  }
  return Math.round(nonNegativeY);
}

/**
 * Predict Y for a given X using Y = a + bX (legacy helper signature).
 * Floors at 0 — sales quantity cannot be negative.
 */
export function predictY(intercept, slope, x, { round = false } = {}) {
  return predictDemand({ intercept, slope, sufficient: true }, x, {
    round: round ? 'round' : false,
  });
}

/**
 * Calculate forecast accuracy metrics:
 * - Mean Absolute Error:            MAE  = Σ|Actual - Predicted| / n
 * - Root Mean Squared Error:        RMSE = √[Σ(Actual - Predicted)² / n]
 * - Weighted Absolute Pct Error:    WAPE = [Σ|Actual - Predicted| / ΣActual] × 100
 *
 * Supports calling as:
 *   calculateForecastAccuracy([actual1, actual2, ...], [pred1, pred2, ...])
 * OR:
 *   calculateForecastAccuracy([{ actual, predicted }, ...])
 *
 * Handles cases where total actual demand is zero safely without NaN/Infinity.
 */
export function calculateForecastAccuracy(actual, predicted) {
  const pairs = [];

  if (Array.isArray(actual) && Array.isArray(predicted)) {
    const len = Math.min(actual.length, predicted.length);
    for (let i = 0; i < len; i += 1) {
      const a = Number(actual[i]);
      const p = Number(predicted[i]);
      if (Number.isFinite(a) && Number.isFinite(p) && a >= 0 && p >= 0) {
        pairs.push({ actual: a, predicted: p });
      }
    }
  } else if (Array.isArray(actual) && predicted === undefined) {
    for (let i = 0; i < actual.length; i += 1) {
      const item = actual[i];
      if (!item || typeof item !== 'object') continue;
      const a = Number(item.actual ?? item.actual_quantity);
      const p = Number(item.predicted ?? item.predicted_quantity ?? item.forecast);
      if (Number.isFinite(a) && Number.isFinite(p) && a >= 0 && p >= 0) {
        pairs.push({ actual: a, predicted: p });
      }
    }
  }

  const n = pairs.length;
  if (n === 0) {
    return {
      n: 0,
      sampleSize: 0,
      mae: null,
      rmse: null,
      wape: null,
      bias: null,
      zeroActualDemand: true,
      unusualError: false,
      sufficient: false,
    };
  }

  let sumAbsError = 0;
  let sumSqError = 0;
  let sumSignedError = 0;
  let sumActual = 0;

  for (let i = 0; i < n; i += 1) {
    const a = pairs[i].actual;
    const p = pairs[i].predicted;
    const err = a - p;
    const absErr = Math.abs(err);
    sumAbsError += absErr;
    sumSqError += err * err;
    sumSignedError += p - a;
    sumActual += a;
  }

  const mae = cleanFloat(sumAbsError / n, 4);
  const rmse = cleanFloat(Math.sqrt(sumSqError / n), 4);
  const bias = cleanFloat(sumSignedError / n, 4);
  const zeroActualDemand = sumActual <= 0;
  const isSparseDemand = sumActual > 0 && (sumActual < 5 || (sumActual / n) < 0.25);

  // Handle total actual demand === 0 safely
  let wape = null;
  if (!zeroActualDemand) {
    wape = cleanFloat((sumAbsError / sumActual) * 100, 4);
  } else if (sumAbsError === 0) {
    wape = 0;
  }

  const meanActual = sumActual / n;
  const unusualError = (wape != null && wape > 50) || (meanActual > 0 && rmse > meanActual * 2);

  return {
    n,
    sampleSize: n,
    mae,
    rmse,
    wape,
    wapeCapped: wape != null ? Math.min(100, wape) : null,
    isSparseDemand,
    bias,
    sumActual: cleanFloat(sumActual, 4),
    sumAbsError: cleanFloat(sumAbsError, 4),
    zeroActualDemand,
    unusualError,
    sufficient: n >= 1,
  };
}

/**
 * Evaluate forecast accuracy using chronological holdout backtesting.
 * Splits historical observations chronologically into a training window and a holdout test window
 * (or expanding-window out-of-sample walk-forward when observations are small), so accuracy is
 * NEVER calculated only from the same observations used to train the regression model.
 *
 * @param {Array<{ x: number, y: number } | number>} data
 */
export function evaluateChronologicalHoldout(data) {
  const { points } = sanitizeRegressionData(data);
  const n = points.length;

  if (n < 3) {
    return {
      n: 0,
      sampleSize: 0,
      mae: null,
      rmse: null,
      wape: null,
      bias: null,
      zeroActualDemand: true,
      unusualError: false,
      sufficient: false,
      evaluationMethod: 'chronological_holdout',
      holdoutSize: 0,
      trainSize: n,
      holdoutPairs: [],
    };
  }

  // Use the first ~75% (minimum 2 points) for training and the remaining chronological tail as holdout.
  // For small series (3..5 points), use walk-forward expanding holdout starting from index >= 2
  // so every test prediction is strictly out-of-sample.
  const holdoutPairs = [];
  const splitIdx = n >= 6 ? Math.max(2, Math.floor(n * 0.75)) : 2;

  if (n >= 6) {
    const trainSlice = points.slice(0, splitIdx);
    const holdoutSlice = points.slice(splitIdx);
    const trainModel = calculateLinearRegression(trainSlice);
    if (trainModel.sufficient) {
      for (const pt of holdoutSlice) {
        const pred = predictDemand(trainModel, pt.x, { round: false });
        holdoutPairs.push({ x: pt.x, actual: pt.y, predicted: pred });
      }
    }
  } else {
    // Walk-forward chronological holdout for n = 3..5
    for (let t = 2; t < n; t += 1) {
      const trainSlice = points.slice(0, t);
      const testPt = points[t];
      const trainModel = calculateLinearRegression(trainSlice);
      if (trainModel.sufficient) {
        const pred = predictDemand(trainModel, testPt.x, { round: false });
        holdoutPairs.push({ x: testPt.x, actual: testPt.y, predicted: pred });
      }
    }
  }

  const actuals = holdoutPairs.map((p) => p.actual);
  const preds = holdoutPairs.map((p) => p.predicted);
  const metrics = calculateForecastAccuracy(actuals, preds);

  return {
    ...metrics,
    evaluationMethod: 'chronological_holdout',
    trainSize: splitIdx,
    holdoutSize: holdoutPairs.length,
    holdoutPairs,
  };
}

/**
 * Sample standard deviation of a numeric series (N - 1).
 */
export function demandStdDev(series) {
  const vals = (series || [])
    .map((v) => (typeof v === 'object' && v !== null ? Number(v.y ?? v.demand ?? 0) : Number(v)))
    .filter((v) => Number.isFinite(v) && v >= 0);
  const n = vals.length;
  if (n < 2) return 0;
  const mean = vals.reduce((a, b) => a + b, 0) / n;
  const varSum = vals.reduce((a, b) => a + (b - mean) ** 2, 0);
  return Math.sqrt(varSum / (n - 1));
}

/**
 * Convert period demand metric (mean or stdDev) to daily equivalent.
 */
export function toAverageDailyDemand(periodValue, periodType = 'weekly') {
  const v = Math.max(0, Number(periodValue) || 0);
  const cfg = validateForecastPeriod(periodType);
  if (cfg.bucketType === 'day') return v;
  if (cfg.bucketType === 'month') return v / 30;
  return v / 7;
}

/**
 * Convert period demand standard deviation to daily standard deviation:
 * σ_daily = σ_period / √(daysPerPeriod)
 */
export function toDailyDemandStdDev(periodStdDev, periodType = 'weekly') {
  const sd = Math.max(0, Number(periodStdDev) || 0);
  const cfg = validateForecastPeriod(periodType);
  return sd / Math.sqrt(cfg.daysPerPeriod || 1);
}

/**
 * Calculate Safety Stock using demand and lead-time variability:
 *   Safety Stock = Z × √(L × σ_d² + d̄² × σ_LT²)
 * When leadTimeStdDevDays = 0, simplifies to:
 *   Safety Stock = Z × σ_d × √L
 *
 * @param {object} params
 * @param {number[]} [params.demandSeries] - Historical period demands
 * @param {string} [params.periodType='weekly'] - 'daily' | 'weekly' | 'monthly'
 * @param {number} [params.averageDailyDemand] - Optional precomputed daily demand mean
 * @param {number} [params.demandStdDevDaily] - Optional precomputed daily demand std dev
 * @param {number} [params.leadTimeDays=3] - Supplier lead time in days
 * @param {number} [params.leadTimeStdDevDays=0] - Supplier lead time variability in days
 * @param {number} [params.serviceLevelZ=1.65] - Z-score (1.65 ≈ 95% service level)
 * @returns {number} Whole-number safety stock units
 */
export function calculateSafetyStock({
  demandSeries = [],
  periodType = 'weekly',
  averageDailyDemand = null,
  demandStdDevDaily = null,
  leadTimeDays = 3,
  leadTimeStdDevDays = 0,
  serviceLevelZ = 1.65,
} = {}) {
  const lt = Math.max(0, Number(leadTimeDays) || 0);
  const ltStd = Math.max(0, Number(leadTimeStdDevDays) || 0);
  const z = Math.max(0, Number(serviceLevelZ) || 0);

  let sigmaDaily = demandStdDevDaily != null ? Number(demandStdDevDaily) : NaN;
  if (!Number.isFinite(sigmaDaily) || sigmaDaily < 0) {
    const periodSd = demandStdDev(demandSeries);
    sigmaDaily = toDailyDemandStdDev(periodSd, periodType);
  }

  let avgDaily = averageDailyDemand != null ? Number(averageDailyDemand) : NaN;
  if (!Number.isFinite(avgDaily) || avgDaily < 0) {
    const vals = (demandSeries || [])
      .map((v) => (typeof v === 'object' && v !== null ? Number(v.y ?? v.demand ?? 0) : Number(v)))
      .filter((v) => Number.isFinite(v) && v >= 0);
    const meanPeriod = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    avgDaily = toAverageDailyDemand(meanPeriod, periodType);
  }

  const varianceDuringLeadTime = lt * sigmaDaily * sigmaDaily + avgDaily * avgDaily * ltStd * ltStd;
  const rawSafety = z * Math.sqrt(Math.max(0, varianceDuringLeadTime));
  return Math.max(0, Math.ceil(cleanFloat(rawSafety, 6)));
}

/**
 * Calculate Reorder Point (ROP):
 *   ROP = (Average Daily Demand × Supplier Lead Time) + Safety Stock
 *
 * Supports both positional arguments (averageDailyDemand, supplierLeadTime, safetyStock)
 * and options object { averageDailyDemand, leadTimeDays, safetyStock, ... }.
 */
export function calculateReorderPoint(arg1 = {}, arg2, arg3) {
  if (typeof arg1 === 'number') {
    const avgDaily = Math.max(0, Number(arg1) || 0);
    const leadTime = Math.max(0, Number(arg2) || 0);
    const safety = Math.max(0, Number(arg3) || 0);
    return Math.max(0, Math.ceil(cleanFloat(avgDaily * leadTime + safety, 6)));
  }

  const {
    averageDailyDemand = 0,
    leadTimeDays = 3,
    supplierLeadTime = null,
    safetyStock = null,
    demandSeries = [],
    periodType = 'weekly',
    demandStdDevDaily = null,
    leadTimeStdDevDays = 0,
    serviceLevelZ = 1.65,
    z = null,
  } = arg1 || {};

  const lt = Math.max(0, Number(supplierLeadTime ?? leadTimeDays) || 0);
  const avgDaily = Math.max(0, Number(averageDailyDemand) || 0);

  const resolvedSafety =
    safetyStock != null && Number.isFinite(Number(safetyStock))
      ? Math.max(0, Math.ceil(Number(safetyStock)))
      : calculateSafetyStock({
          demandSeries,
          periodType,
          averageDailyDemand: avgDaily,
          demandStdDevDaily,
          leadTimeDays: lt,
          leadTimeStdDevDays,
          serviceLevelZ: z ?? serviceLevelZ,
        });

  const leadTimeDemand = avgDaily * lt;
  const rop = Math.max(0, Math.ceil(cleanFloat(leadTimeDemand + resolvedSafety, 6)));

  return {
    reorderPoint: rop,
    safetyStock: resolvedSafety,
    leadTimeDemand: Math.ceil(cleanFloat(leadTimeDemand, 6)),
    averageDailyDemand: cleanFloat(avgDaily, 4),
    leadTimeDays: lt,
    z: Number(z ?? serviceLevelZ) || 1.65,
  };
}

/**
 * Calculate Suggested Purchase / Order Quantity.
 *
 * Considers:
 * - Forecasted demand during the supplier lead time (and/or forecast horizon)
 * - Safety stock
 * - Current stock
 * - Reserved inventory (active stock reservations)
 * - Incoming purchase orders (open/pending PO quantities)
 *
 * Never recommends purchasing quantities based only on predicted demand without
 * deducting existing available and incoming inventory.
 */
export function calculateSuggestedOrderQuantity({
  forecastedDemand = 0,
  leadTimeDemand = null,
  averageDailyDemand = null,
  leadTimeDays = 3,
  safetyStock = 0,
  reorderPoint = null,
  currentStock = 0,
  reservedStock = 0,
  incomingStock = 0,
  orderQuantity = 1,
} = {}) {
  const onHand = Math.max(0, Number(currentStock) || 0);
  const reserved = Math.max(0, Number(reservedStock) || 0);
  const incoming = Math.max(0, Number(incomingStock) || 0);
  const safety = Math.max(0, Number(safetyStock) || 0);
  const horizonDemand = Math.max(0, Number(forecastedDemand) || 0);
  const ltDays = Math.max(0, Number(leadTimeDays) || 0);

  const computedLtDemand =
    leadTimeDemand != null && Number.isFinite(Number(leadTimeDemand))
      ? Math.max(0, Number(leadTimeDemand))
      : averageDailyDemand != null && Number.isFinite(Number(averageDailyDemand))
        ? Math.max(0, Number(averageDailyDemand) * ltDays)
        : horizonDemand;

  const rop =
    reorderPoint != null && Number.isFinite(Number(reorderPoint))
      ? Math.max(0, Number(reorderPoint))
      : Math.ceil(computedLtDemand + safety);

  // Net Inventory Position = (On-Hand - Reserved) + Incoming POs
  const availableStock = Math.max(0, onHand - reserved);
  const inventoryPosition = Math.max(0, onHand - reserved + incoming);

  // Target stock covers the greater of (lead-time demand + safety stock) or (forecasted demand + safety stock)
  const targetStock = Math.max(rop, computedLtDemand + safety, horizonDemand + safety);
  const rawShortfall = Math.max(0, targetStock - inventoryPosition);
  let suggested = Math.ceil(cleanFloat(rawShortfall, 6));

  const moq = Math.max(1, Math.trunc(Number(orderQuantity) || 1));
  if (suggested > 0 && moq > 1) {
    suggested = Math.ceil(suggested / moq) * moq;
  }

  return {
    suggestedOrderQuantity: suggested,
    inventoryPosition: Math.round(inventoryPosition),
    availableStock: Math.round(availableStock),
    currentStock: Math.round(onHand),
    reservedStock: Math.round(reserved),
    incomingStock: Math.round(incoming),
    targetStock: Math.ceil(targetStock),
    reorderPoint: Math.ceil(rop),
    safetyStock: Math.ceil(safety),
    leadTimeDemand: Math.ceil(computedLtDemand),
  };
}

/**
 * Format a readable regression equation string: Y = a + bX
 */
export function formatRegressionEquation(intercept, slope) {
  const a = Number(intercept);
  const b = Number(slope);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 'Y = a + bX';

  const aStr = a.toFixed(2);
  const absB = Math.abs(b).toFixed(4);
  if (b >= 0) return `Y = ${aStr} + ${absB}X`;
  return `Y = ${aStr} - ${absB}X`;
}

/**
 * Classify demand trend from regression slope relative to mean demand.
 * @param {number} slope
 * @param {number} meanY
 * @returns {'increasing' | 'decreasing' | 'stable'}
 */
export function determineTrend(slope, meanY = 0) {
  const s = Number(slope) || 0;
  if (Math.abs(s) < 1e-9) return 'stable';
  const baseline = Math.max(Math.abs(Number(meanY) || 0), 1);
  const relative = s / baseline;
  if (relative > 0.03) return 'increasing';
  if (relative < -0.03) return 'decreasing';
  return 'stable';
}

export function trendLabel(trend) {
  if (trend === 'increasing') return 'Increasing';
  if (trend === 'decreasing') return 'Decreasing';
  return 'Stable';
}

export function trendExplanation(trend) {
  if (trend === 'increasing') {
    return 'Sales show an increasing linear trend (b > 0) based on historical transaction data.';
  }
  if (trend === 'decreasing') {
    return 'Sales show a decreasing linear trend (b < 0) based on historical transaction data.';
  }
  return 'Sales appear relatively stable (b ≈ 0) based on historical transaction data.';
}

export default {
  MIN_REGRESSION_PERIODS,
  ALGORITHM_NAME,
  FORECAST_PERIOD_CONFIG,
  validateForecastPeriod,
  sanitizeRegressionData,
  calculateLinearRegression,
  predictDemand,
  predictY,
  calculateForecastAccuracy,
  evaluateChronologicalHoldout,
  demandStdDev,
  toAverageDailyDemand,
  toDailyDemandStdDev,
  calculateSafetyStock,
  calculateReorderPoint,
  calculateSuggestedOrderQuantity,
  formatRegressionEquation,
  determineTrend,
  trendLabel,
  trendExplanation,
};
