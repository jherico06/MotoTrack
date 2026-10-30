/**
 * Sales Forecast & Stock Optimization Service
 * ---------------------------------------------------------------------------
 * Authoritative Forecasting Engine: Statistical Simple Linear Regression
 *
 *   Y = a + bX
 *   b = [nΣXY - (ΣX)(ΣY)] / [nΣX² - (ΣX)²]
 *   a = [ΣY - b(ΣX)] / n
 *
 * Supports:
 *   - Daily forecasting   (90-day historical window, 30-day horizon, DATE_TRUNC('day', ...))
 *   - Weekly forecasting  (26-week historical window, 12-week horizon, DATE_TRUNC('week', ...))
 *   - Monthly forecasting (12-month historical window, 6-month horizon, DATE_TRUNC('month', ...))
 *   - Chronological holdout accuracy evaluation (MAE, RMSE, WAPE)
 *   - Safety Stock, Reorder Point (ROP = Average Daily Demand × Lead Time + Safety Stock)
 *   - Suggested Purchase Quantity (accounting for current stock, reserved inventory, and incoming POs)
 *   - Inventory replenishment recommendations
 */

import { supabaseManager } from '../../lib/supabase.js';
import { appStorage } from '../system/storageAdapter.js';
import { ORDER_STATUSES, canonicalizeStatus } from '../orders/orderService.js';
import {
  MIN_REGRESSION_PERIODS,
  FORECAST_PERIOD_CONFIG,
  validateForecastPeriod,
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
  determineTrend,
  trendLabel,
  trendExplanation,
  formatRegressionEquation,
} from '../../utils/linearRegression.js';

export {
  MIN_REGRESSION_PERIODS,
  FORECAST_PERIOD_CONFIG,
  validateForecastPeriod,
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
  determineTrend,
  trendLabel,
  trendExplanation,
  formatRegressionEquation,
};

export const ALGORITHM_NAME = 'simple_linear_regression';

// Backward-compatible minimum period constants for UI components
export const MIN_SBA_PERIODS = MIN_REGRESSION_PERIODS;
export const MIN_NONZERO_DEMANDS = 1;

const HISTORY_STORAGE_KEY = 'mototrack_forecast_history';
const SAFETY_PREF_KEY = 'mototrack_forecast_safety_prefs';
const EXCLUDED_STATUSES = new Set([
  ORDER_STATUSES.CANCELLED,
  ORDER_STATUSES.REFUNDED,
  'cancelled',
  'canceled',
  'refunded',
  'voided',
  'void',
  'reversed',
  'draft',
  'failed',
]);

// Cache for getForecastHistory to prevent refetch storms (prevent-usage-burn)
let historyFetchCache = { at: 0, limit: 0, rows: null, inFlight: null };
const HISTORY_CACHE_TTL_MS = 30 * 1000;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function parseOrderDate(order) {
  const raw = order?.created_at || order?.order_date || order?.updated_at || order?.date;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDayUtc(date) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0 Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday start (matches PostgreSQL DATE_TRUNC('week', ...))
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function dateTruncUtc(date, periodType) {
  const norm = normalizePeriodType(periodType);
  if (norm === 'day') return startOfDayUtc(date);
  if (norm === 'month') return startOfMonth(date);
  return startOfWeek(date);
}

function dayKey(date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function weekKey(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${pad2(weekNo)}`;
}

function monthKey(date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}`;
}

export function normalizePeriodType(periodType = 'week') {
  const raw = String(periodType || 'week')
    .trim()
    .toLowerCase();
  if (raw === 'daily' || raw === 'day') return 'day';
  if (raw === 'monthly' || raw === 'month') return 'month';
  return 'week';
}

export function toCanonicalForecastPeriod(periodType = 'week') {
  const norm = normalizePeriodType(periodType);
  if (norm === 'day') return 'daily';
  if (norm === 'month') return 'monthly';
  return 'weekly';
}

function periodKeyForDate(date, periodType) {
  const norm = normalizePeriodType(periodType);
  if (norm === 'day') return dayKey(date);
  if (norm === 'month') return monthKey(date);
  return weekKey(date);
}

function periodIsoDateFromKey(periodKey, periodType) {
  const norm = normalizePeriodType(periodType);
  if (norm === 'day') {
    return String(periodKey).slice(0, 10);
  }
  if (norm === 'month') {
    const [y, m] = String(periodKey).split('-').map(Number);
    if (!y || !m) return String(periodKey);
    return `${y}-${pad2(m)}-01`;
  }
  const match = /^(\d{4})-W(\d{2})$/.exec(String(periodKey));
  if (!match) return String(periodKey);
  const y = Number(match[1]);
  const w = Number(match[2]);
  // Jan 4 is always in ISO Week 1
  const simple = new Date(Date.UTC(y, 0, 4));
  const dayOfWeek = simple.getUTCDay() || 7;
  const mondayWeek1 = new Date(simple);
  mondayWeek1.setUTCDate(simple.getUTCDate() - dayOfWeek + 1);
  const targetMonday = new Date(mondayWeek1);
  targetMonday.setUTCDate(mondayWeek1.getUTCDate() + (w - 1) * 7);
  return targetMonday.toISOString().slice(0, 10);
}

function addPeriods(periodKey, periodType, count) {
  const norm = normalizePeriodType(periodType);
  if (norm === 'day') {
    const [y, m, d] = String(periodKey).split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + count));
    return dayKey(dt);
  }
  if (norm === 'month') {
    const [y, m] = String(periodKey).split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + count, 1));
    return monthKey(d);
  }
  const isoDate = periodIsoDateFromKey(periodKey, 'week');
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + count * 7);
  return weekKey(d);
}

function periodLabel(periodKey, periodType, index) {
  const norm = normalizePeriodType(periodType);
  if (norm === 'day') {
    const [, m, d] = String(periodKey).split('-');
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${names[Number(m) - 1] || m} ${Number(d)}`;
  }
  if (norm === 'month') {
    const [y, m] = String(periodKey).split('-');
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${names[Number(m) - 1] || m} ${y}`;
  }
  return `Week ${index}`;
}

function matchesProduct(row, product) {
  if (!product) return false;
  const ids = [product.id, product.product_id].filter(Boolean).map(String);
  if (row.product_id && ids.includes(String(row.product_id))) return true;
  const name = String(product.name || '')
    .trim()
    .toLowerCase();
  if (
    name &&
    String(row.product_name || '')
      .trim()
      .toLowerCase() === name
  )
    return true;
  return false;
}

/**
 * Retrieve historical sales from orders/transactions.
 *
 * Supports two calling conventions:
 *   1. `getHistoricalSales(orders, products)` -> flattens valid completed order items into sales rows
 *      (excludes cancelled, refunded, voided, reversed, and duplicate order items).
 *   2. `getHistoricalSales(productId, period, options)` -> aggregates a product's historical demand
 *      into Daily (90d), Weekly (26w), or Monthly (12m) buckets with zero-demand periods preserved.
 */
export function getHistoricalSales(firstArg = [], secondArg = [], options = {}) {
  // Convention 2: getHistoricalSales(productId, period, options)
  if (typeof firstArg === 'string' || typeof firstArg === 'number') {
    const productId = String(firstArg).trim();
    const periodCfg = validateForecastPeriod(typeof secondArg === 'string' ? secondArg : 'weekly', {
      strict: false,
    });
    const orders = Array.isArray(options.orders) ? options.orders : [];
    const products = Array.isArray(options.products) ? options.products : [];
    const salesRows = Array.isArray(options.salesRows)
      ? options.salesRows
      : extractValidSalesRows(orders, products);

    const lookbackPeriods =
      Number(options.historicalWindow ?? options.lookbackPeriods) > 0
        ? Math.trunc(Number(options.historicalWindow ?? options.lookbackPeriods))
        : periodCfg.historicalWindow;

    const grouped = groupSalesByPeriod(salesRows, {
      productId,
      product: options.product || null,
      periodType: periodCfg.uiPeriodType,
      lookbackPeriods,
      fillWindow: options.fillWindow !== false,
      referenceDate: options.referenceDate,
    });

    return grouped.periods;
  }

  // Convention 1: getHistoricalSales(orders, products)
  return extractValidSalesRows(firstArg, secondArg);
}

function extractValidSalesRows(orders = [], products = []) {
  const productCatMap = new Map();
  (products || []).forEach((p) => {
    const cat = p.category;
    if (cat && cat !== '—') {
      if (p.id) productCatMap.set(String(p.id), cat);
      if (p.product_id) productCatMap.set(String(p.product_id), cat);
      if (p.name) productCatMap.set(String(p.name).toLowerCase().trim(), cat);
    }
  });

  const rows = [];
  const seenItemKeys = new Set();

  (orders || []).forEach((order) => {
    const rawStatus = String(order?.status || '')
      .toLowerCase()
      .trim();
    const status = canonicalizeStatus(order?.status);
    if (EXCLUDED_STATUSES.has(status) || EXCLUDED_STATUSES.has(rawStatus)) return;

    const returnStatus = String(order?.return_status || '')
      .toLowerCase()
      .trim();
    if (returnStatus === 'completed' || returnStatus === 'returned' || returnStatus === 'refunded') {
      return;
    }

    const date = parseOrderDate(order);
    if (!date) return;

    const orderId = order.order_id || order.id || null;
    const items = Array.isArray(order.items) ? order.items : [];

    items.forEach((item, idx) => {
      const qty = Number(item?.quantity);
      if (!Number.isFinite(qty) || qty <= 0) return;

      const productId = item.product_id || item.id || null;
      const itemId = item.order_item_id || item.id || `${idx}`;
      if (orderId && item.order_item_id) {
        const dedupeKey = `${orderId}:${itemId}`;
        if (seenItemKeys.has(dedupeKey)) return;
        seenItemKeys.add(dedupeKey);
      }

      const mappedCat =
        (productId && productCatMap.get(String(productId))) ||
        (item.name && productCatMap.get(String(item.name).toLowerCase().trim())) ||
        item.category ||
        'Accessories';

      rows.push({
        product_id: productId,
        product_name: item.name || 'Motorcycle Part',
        category: mappedCat,
        quantity: qty,
        date,
        order_id: orderId,
        status,
        channel: order.channel || 'Online Store',
      });
    });
  });

  return rows;
}

/**
 * Group historical sales into continuous chronological time periods (day, week, month)
 * with zero-demand periods included and consecutive period numbers X = 1..n.
 */
export function groupSalesByPeriod(
  salesRows,
  {
    productId = null,
    product = null,
    category = null,
    periodType = 'week',
    lookbackPeriods = 12,
    fillWindow = false,
    referenceDate = null,
  } = {}
) {
  const normPeriodType = normalizePeriodType(periodType);
  const filtered = (salesRows || []).filter((r) => {
    const qty = Number(r?.quantity);
    if (!Number.isFinite(qty) || qty <= 0) return false;
    if (category) {
      if (category === 'All' || category === 'All Categories') return true;
      return String(r.category || '').toLowerCase() === String(category).toLowerCase();
    }
    if (product) return matchesProduct(r, product);
    if (!productId) return true;
    return String(r.product_id) === String(productId);
  });

  if (filtered.length === 0 && !fillWindow) {
    return {
      periods: [],
      periodType: normPeriodType,
      lookbackPeriods,
      saleCount: 0,
      distinctPeriods: 0,
    };
  }

  const bucket = new Map();
  filtered.forEach((row) => {
    const d = row.date instanceof Date ? row.date : new Date(row.date);
    if (Number.isNaN(d.getTime())) return;
    const key = periodKeyForDate(d, normPeriodType);
    bucket.set(key, (bucket.get(key) || 0) + Number(row.quantity));
  });

  const sortedKeys = Array.from(bucket.keys()).sort();
  let lastKey;
  let firstKey;

  const refDate = referenceDate ? new Date(referenceDate) : new Date();
  const currentKey = periodKeyForDate(dateTruncUtc(refDate, normPeriodType), normPeriodType);

  if (sortedKeys.length === 0) {
    lastKey = currentKey;
    firstKey = addPeriods(lastKey, normPeriodType, -(Math.max(1, lookbackPeriods) - 1));
  } else {
    const latestSaleKey = sortedKeys[sortedKeys.length - 1];
    lastKey = fillWindow ? (currentKey > latestSaleKey ? currentKey : latestSaleKey) : latestSaleKey;
    if (fillWindow) {
      firstKey = addPeriods(lastKey, normPeriodType, -(Math.max(1, lookbackPeriods) - 1));
    } else {
      firstKey =
        sortedKeys.length > lookbackPeriods
          ? addPeriods(lastKey, normPeriodType, -(lookbackPeriods - 1))
          : sortedKeys[0];
    }
  }

  // Build continuous chronological range from firstKey -> lastKey including zero-demand periods
  const periods = [];
  let cursor = firstKey;
  let guard = 0;
  const maxBuckets = Math.max(400, (Number(lookbackPeriods) || 12) + 50);

  while (guard < maxBuckets) {
    const demand = Math.max(0, Number(bucket.get(cursor) || 0));
    const idx = periods.length + 1;
    periods.push({
      key: cursor,
      periodKey: cursor,
      date: periodIsoDateFromKey(cursor, normPeriodType),
      label: periodLabel(cursor, normPeriodType, idx),
      periodNumber: idx,
      x: idx,
      y: demand,
      demand,
      isHistorical: true,
    });
    if (cursor === lastKey) break;
    cursor = addPeriods(cursor, normPeriodType, 1);
    guard += 1;
  }

  // Trim to lookbackPeriods if historical range spanned wider than requested window
  const trimmedPeriods =
    lookbackPeriods > 0 && periods.length > lookbackPeriods
      ? periods.slice(periods.length - lookbackPeriods).map((p, i) => ({
          ...p,
          periodNumber: i + 1,
          x: i + 1,
          label: normPeriodType === 'week' ? `Week ${i + 1}` : p.label,
        }))
      : periods;

  return {
    periods: trimmedPeriods,
    periodType: normPeriodType,
    lookbackPeriods,
    saleCount: filtered.reduce((s, r) => s + Number(r.quantity || 0), 0),
    distinctPeriods: sortedKeys.length,
  };
}

/**
 * Pick a period type that has enough distinct observations for Simple Linear Regression.
 * Prefers the caller's choice; falls back day -> week -> month when autoPeriod is enabled.
 */
export function resolvePeriodType(salesRows, target, preferred = 'week', lookbackPeriods = 12) {
  const normPreferred = normalizePeriodType(preferred);
  const isCat = Boolean(
    typeof target === 'string' ||
    target?.isCategory ||
    target?.categoryOnly ||
    (target?.category && !target.id && !target.product_id)
  );
  const categoryName = typeof target === 'string' ? target : target?.category || target?.name || null;
  const product = isCat ? null : target;

  const order =
    normPreferred === 'day'
      ? ['day', 'week', 'month']
      : normPreferred === 'month'
        ? ['month', 'week', 'day']
        : ['week', 'day', 'month'];

  for (const type of order) {
    const grouped = groupSalesByPeriod(salesRows, {
      product,
      category: isCat ? categoryName : null,
      periodType: type,
      lookbackPeriods: type === 'day' ? Math.max(lookbackPeriods, 14) : lookbackPeriods,
    });
    if (grouped.periods.length >= MIN_REGRESSION_PERIODS && grouped.distinctPeriods >= 1) {
      return { periodType: type, grouped, autoAdjusted: type !== normPreferred };
    }
  }

  const fallback = groupSalesByPeriod(salesRows, {
    product,
    category: isCat ? categoryName : null,
    periodType: normPreferred,
    lookbackPeriods,
  });
  return { periodType: normPreferred, grouped: fallback, autoAdjusted: false };
}

/**
 * Calculate recommended purchase / restock quantity considering:
 *   - Forecasted demand during lead time / horizon
 *   - Safety stock
 *   - Reorder point
 *   - Current stock
 *   - Reserved inventory
 *   - Incoming purchase orders
 */
export function calculateRecommendedRestock(
  forecastedDemand,
  currentStock,
  safetyStock,
  reorderPoint = null,
  { reservedStock = 0, incomingStock = 0, orderQuantity = 1 } = {}
) {
  const forecast = Math.max(0, Number(forecastedDemand) || 0);
  const stock = Math.max(0, Number(currentStock) || 0);
  const safety = Math.max(0, Number(safetyStock) || 0);
  const rop = reorderPoint != null ? Math.max(0, Number(reorderPoint) || 0) : null;

  const result = calculateSuggestedOrderQuantity({
    forecastedDemand: forecast,
    leadTimeDemand: forecast,
    safetyStock: safety,
    reorderPoint: rop != null && Number.isFinite(rop) ? rop : forecast + safety,
    currentStock: stock,
    reservedStock,
    incomingStock,
    orderQuantity,
  });

  return result.suggestedOrderQuantity;
}

/**
 * Resolve safety stock from statistical calculation, absolute units, or % of forecast.
 */
export function resolveSafetyStock(forecastedDemand, safetyConfig = {}) {
  if (safetyConfig?.statistical != null && Number.isFinite(Number(safetyConfig.statistical))) {
    return Math.max(0, Math.round(Number(safetyConfig.statistical)));
  }
  const mode = safetyConfig.mode === 'percent' ? 'percent' : 'absolute';
  const value = Math.max(0, Number(safetyConfig.value) || 0);
  if (mode === 'percent') {
    return Math.round((Math.max(0, Number(forecastedDemand) || 0) * value) / 100);
  }
  return Math.round(value);
}

/**
 * Stock status from inventory vs reorder point / forecast.
 */
export function determineStockStatus(currentStock, forecastedDemand, safetyStock, reorderPoint = null) {
  const stock = Math.max(0, Number(currentStock) || 0);
  const forecast = Math.max(0, Number(forecastedDemand) || 0);
  const safety = Math.max(0, Number(safetyStock) || 0);
  const rop = reorderPoint != null ? Math.max(0, Number(reorderPoint) || 0) : null;

  if (stock <= 0) return 'Critical Stock';

  if (rop != null && Number.isFinite(rop) && rop > 0) {
    if (stock <= Math.max(1, Math.ceil(rop * 0.5))) return 'Critical Stock';
    if (stock <= rop) return 'Low Stock';
    if (forecast > 0 && stock > rop + forecast * 2 + safety) return 'Overstocked';
    return 'Healthy Stock';
  }

  const need = forecast + safety;
  if (need > 0 && stock < need * 0.5) return 'Critical Stock';
  if (need > 0 && stock < need) return 'Low Stock';
  if (forecast > 0 && stock > forecast * 3 + safety) return 'Overstocked';
  return 'Healthy Stock';
}

export function stockStatusTone(status) {
  if (status === 'Critical Stock') return 'danger';
  if (status === 'Low Stock') return 'warning';
  if (status === 'Overstocked') return 'info';
  return 'success';
}

/**
 * Compute confidence descriptor & prediction interval around Simple Linear Regression forecast.
 */
function computeRegressionConfidence({ regression, accuracy, demandSeries = [] }) {
  const n = regression?.n || 0;
  const nonZero = demandSeries.filter((v) => Number(v) > 0).length;
  if (!regression?.sufficient || n < MIN_REGRESSION_PERIODS) {
    return {
      level: 'LOW',
      label: 'Low',
      score: 20,
      reason: `Fewer than ${MIN_REGRESSION_PERIODS} historical periods available for regression.`,
    };
  }

  let score = 50;
  if (n >= 12) score += 20;
  else if (n >= 6) score += 10;

  if (nonZero >= 6) score += 10;
  if (regression.rSquared >= 0.5) score += 10;
  else if (regression.rSquared >= 0.25) score += 5;

  if (accuracy?.wape != null) {
    if (accuracy.wape <= 25) score += 10;
    else if (accuracy.wape > 60) score -= 15;
  }

  score = Math.max(15, Math.min(95, Math.round(score)));
  const label = score >= 75 ? 'High' : score >= 50 ? 'Medium' : 'Low';
  const level = label.toUpperCase();
  const reason =
    label === 'High'
      ? `Linear regression trained on ${n} periods (R² = ${regression.rSquared.toFixed(2)}) with consistent demand coverage.`
      : label === 'Medium'
        ? `Linear regression trained on ${n} periods (R² = ${regression.rSquared.toFixed(2)}); moderate period-to-period variance.`
        : `Limited observations (${n} periods, R² = ${regression.rSquared.toFixed(2)}); treat predictions as directional.`;

  return { level, label, score, reason };
}

function computePredictionRange(forecastedValue, demandSeries = [], rmse = null, n = 0) {
  const f = Math.max(0, Number(forecastedValue) || 0);
  const obsCount = Number(n) || demandSeries.length || 0;
  // A regression prediction interval requires at least n >= 3 observations (df = n - 2 >= 1)
  if (obsCount < 3) {
    return {
      low: null,
      high: null,
      halfWidth: null,
      statisticallySupported: false,
    };
  }
  const spread =
    rmse != null && Number.isFinite(Number(rmse)) && Number(rmse) >= 0
      ? Number(rmse)
      : demandStdDev(demandSeries);
  const halfWidth = Math.max(0, Math.round(spread));
  return {
    low: Math.max(0, Math.round(f - halfWidth)),
    high: Math.max(0, Math.round(f + halfWidth)),
    halfWidth,
    statisticallySupported: true,
  };
}

/**
 * Classify inventory recommendation status per Section 12:
 *   - 'Stock sufficient'
 *   - 'Monitor inventory'
 *   - 'Approaching reorder point'
 *   - 'Reorder recommended'
 *   - 'Insufficient historical data'
 */
export function classifyInventoryRecommendation({
  sufficient = true,
  currentStock = 0,
  reservedStock = 0,
  incomingStock = 0,
  reorderPoint = 0,
  safetyStock = 0,
  recommendedRestock = 0,
  forecastedDemand = 0,
  trend = 'stable',
  poorFit = false,
  unusualError = false,
} = {}) {
  if (!sufficient) {
    return {
      status: 'Insufficient historical data',
      code: 'INSUFFICIENT_DATA',
      message: 'At least 2 valid historical demand observations are required for Simple Linear Regression.',
    };
  }

  const available = Math.max(0, Number(currentStock || 0) - Number(reservedStock || 0));
  const position = available + Math.max(0, Number(incomingStock || 0));
  const rop = Math.max(0, Number(reorderPoint || 0));
  const safety = Math.max(0, Number(safetyStock || 0));
  const suggested = Math.max(0, Number(recommendedRestock || 0));

  if (available <= 0 || position <= rop) {
    return {
      status: 'Reorder recommended',
      code: 'REORDER_RECOMMENDED',
      message: `Inventory position (${position} units) is at or below the reorder point (${rop} units). Recommended order quantity: ${suggested} units.`,
    };
  }

  const approachingThreshold = Math.max(rop + Math.ceil(safety * 0.5), Math.ceil(rop * 1.25));
  if (position <= approachingThreshold) {
    return {
      status: 'Approaching reorder point',
      code: 'APPROACHING_REORDER_POINT',
      message: `Inventory position (${position} units) is approaching the reorder point (${rop} units).`,
    };
  }

  if (suggested > 0 || trend === 'increasing' || poorFit || unusualError) {
    return {
      status: 'Monitor inventory',
      code: 'MONITOR_INVENTORY',
      message: `Current stock exceeds the reorder point (${rop} units); monitor inventory alongside projected demand (${forecastedDemand} units).`,
    };
  }

  return {
    status: 'Stock sufficient',
    code: 'STOCK_SUFFICIENT',
    message: `Inventory position (${position} units) is sufficient to cover forecasted demand (${forecastedDemand} units) and safety stock (${safety} units).`,
  };
}

/**
 * Build full Simple Linear Regression forecast result for one product.
 *
 * Uses:
 *   Y = a + bX
 *   b = [nΣXY - (ΣX)(ΣY)] / [nΣX² - (ΣX)²]
 *   a = [ΣY - b(ΣX)] / n
 */
export function generateProductForecast({
  salesRows,
  product,
  periodType = 'week',
  lookbackPeriods = 12,
  forecastAhead = 1,
  safetyConfig = { mode: 'absolute', value: 5 },
  autoPeriod = true,
  serviceLevelZ = 1.65,
}) {
  const productId = product?.id || product?.product_id;
  const currentStock = Math.max(0, Number(product?.stock ?? product?.stock_quantity) || 0);
  const reservedStock = Math.max(0, Number(product?.reserved_stock ?? product?.reservedStock) || 0);
  const incomingStock = Math.max(0, Number(product?.incoming_stock ?? product?.incomingStock) || 0);
  const productName = product?.name || 'Unknown';
  const leadTimeDays = Math.max(0, Number(product?.lead_time_days ?? product?.leadTimeDays ?? 3) || 3);
  const orderQuantity = Math.max(1, Number(product?.order_quantity ?? product?.orderQuantity ?? 1) || 1);

  const normRequestedPeriod = normalizePeriodType(periodType);

  const resolved = autoPeriod
    ? resolvePeriodType(salesRows, product, normRequestedPeriod, lookbackPeriods)
    : {
        periodType: normRequestedPeriod,
        grouped: groupSalesByPeriod(salesRows, {
          product,
          productId,
          periodType: normRequestedPeriod,
          lookbackPeriods: normRequestedPeriod === 'day' ? Math.max(lookbackPeriods, 14) : lookbackPeriods,
          fillWindow: true,
        }),
        autoAdjusted: false,
      };

  const activePeriodType = resolved.periodType;
  const grouped = resolved.grouped;
  const historical = grouped.periods;
  const demandSeries = historical.map((p) => p.y);
  const nonZeroObservations = demandSeries.filter((y) => y > 0).length;

  // Train Simple Linear Regression model: Y = a + bX
  const regressionInput = historical.map((p, idx) => ({
    x: Number(p.x ?? idx + 1),
    y: Number(p.y ?? 0),
  }));
  const regression = calculateLinearRegression(regressionInput);

  const emptyPolicy = () => {
    const safetyStock = resolveSafetyStock(0, safetyConfig);
    const periods = historical.length || grouped.distinctPeriods || 0;
    const confidence = computeRegressionConfidence({
      regression,
      accuracy: null,
      demandSeries,
    });
    const recommendation = classifyInventoryRecommendation({
      sufficient: false,
      currentStock,
      reservedStock,
      incomingStock,
    });

    return {
      productId,
      productName,
      sku: product?.sku || (productId ? `SKU-${productId}` : '—'),
      category: product?.category || '—',
      currentStock,
      reservedStock,
      incomingStock,
      availableStock: Math.max(0, currentStock - reservedStock),
      inventoryPosition: Math.max(0, currentStock - reservedStock + incomingStock),
      insufficient: true,
      error: regression.error || 'Insufficient historical sales data for Simple Linear Regression.',
      limitedDataMessage: buildLimitedDataMessage(periods, nonZeroObservations),
      forecastMethod: ALGORITHM_NAME,
      algorithm: 'Simple Linear Regression',
      equation: regression.equation || 'Y = 0 + 0X',
      slope: regression.slope ?? 0,
      intercept: regression.intercept ?? 0,
      rSquared: regression.rSquared ?? 0,
      mae: null,
      rmse: null,
      wape: null,
      wapePercent: null,
      accuracy: null,
      regression,
      sba: null,
      historical: historical.length ? historical : [],
      trendLine: [],
      forecastPoints: [],
      forecastDates: [],
      chartPoints: historical.map((p) => ({ ...p, actual: p.y, fitted: null, forecast: null })),
      forecastedDemand: null,
      predictedNextPeriodDemand: null,
      previousHorizonDemand: null,
      demandChangePct: null,
      safetyStock,
      reorderPoint: product?.reorder_point ?? product?.reorderPoint ?? null,
      leadTimeDemand: 0,
      recommendedRestock: 0,
      suggestedPurchaseQuantity: 0,
      replenishmentNeeded: false,
      replenishmentReason:
        'At least 2 valid historical demand periods are required before replenishment quantities can be calculated.',
      inventoryRecommendation: recommendation,
      recommendationStatus: recommendation.status,
      stockStatus: determineStockStatus(currentStock, 0, safetyStock, product?.reorder_point),
      trend: 'insufficient',
      trendLabel: 'Insufficient Data',
      trendExplanation: 'Not enough sales history to fit a linear regression trend line.',
      trendPct: null,
      averageSales: 0,
      periodType: activePeriodType,
      autoAdjustedPeriod: resolved.autoAdjusted,
      forecastAhead,
      forecastPeriodLabel: null,
      nextForecastDate: null,
      generatedAt: new Date().toISOString(),
      saleCount: grouped.saleCount || 0,
      distinctPeriods: grouped.distinctPeriods || 0,
      sufficient: false,
      seasonalityEnabled: false,
      leadTimeDays,
      confidence,
      forecastRange: null,
      statisticallySupportedRange: false,
      whyReasons: [],
      belowReorderPoint: false,
    };
  };

  if (!regression.sufficient || historical.length < MIN_REGRESSION_PERIODS) {
    return emptyPolicy();
  }

  // Out-of-sample chronological holdout accuracy (MAE, RMSE, WAPE)
  const accuracy = evaluateChronologicalHoldout(regressionInput);

  // Standard error of the regression estimate s_{y|x} = sqrt(SSE / (n - 2)) when n >= 3
  let residualStdError = null;
  if (regression.n >= 3) {
    const sse = regressionInput.reduce((sum, pt) => {
      const fitted = regression.intercept + regression.slope * pt.x;
      const err = pt.y - fitted;
      return sum + err * err;
    }, 0);
    residualStdError = Math.sqrt(sse / (regression.n - 2));
  }
  const effectiveSpread = accuracy.rmse != null ? accuracy.rmse : residualStdError;

  // Generate future predictions using Y = a + bX for X = n + 1 ... n + forecastAhead
  const lastKey = historical[historical.length - 1]?.key;
  const forecastPoints = [];
  const forecastDates = [];

  for (let i = 1; i <= forecastAhead; i += 1) {
    const futureX = historical.length + i;
    const futureKey = lastKey ? addPeriods(lastKey, activePeriodType, i) : `F${i}`;
    const isoDate = periodIsoDateFromKey(futureKey, activePeriodType);
    const predictedWhole = predictDemand(regression, futureX, { round: 'round' });
    const predictedRaw = predictDemand(regression, futureX, { round: false });
    const pointRange = computePredictionRange(predictedWhole, demandSeries, effectiveSpread, regression.n);

    forecastDates.push(isoDate);
    forecastPoints.push({
      sequenceNumber: i,
      key: futureKey,
      periodKey: futureKey,
      forecastDate: isoDate,
      label: periodLabel(futureKey, activePeriodType, futureX),
      x: futureX,
      y: Math.round(predictedRaw * 100) / 100,
      yRounded: predictedWhole,
      predictedDemand: predictedWhole,
      rangeLow: pointRange.low,
      rangeHigh: pointRange.high,
      statisticallySupported: pointRange.statisticallySupported,
      isForecast: true,
    });
  }

  // Primary horizon demand (whole-number inventory units, sum continuous regression values then round)
  const forecastedDemand = Math.max(
    0,
    Math.round(forecastPoints.reduce((s, p) => s + (Number(p.y) || 0), 0))
  );
  const nextPeriodDemand = forecastPoints[0]?.predictedDemand ?? 0;

  // Percentage change vs previous equivalent historical horizon
  const compareWindow = Math.min(historical.length, Math.max(1, forecastAhead));
  const recentWindowSlice = historical.slice(historical.length - compareWindow);
  const recentWindowSum = recentWindowSlice.reduce((s, p) => s + Number(p.y || 0), 0);
  const previousHorizonDemand =
    compareWindow > 0 ? Math.round((recentWindowSum / compareWindow) * forecastAhead) : null;
  const demandChangePct =
    previousHorizonDemand != null && previousHorizonDemand > 0
      ? Math.round(((forecastedDemand - previousHorizonDemand) / previousHorizonDemand) * 1000) / 10
      : null;

  // Inventory Planning: Safety Stock, Reorder Point, Suggested Order Quantity
  const effectivePeriodDemand = Math.max(nextPeriodDemand, regression.meanY);
  const avgDaily = toAverageDailyDemand(effectivePeriodDemand, activePeriodType);
  const sigmaDaily = toDailyDemandStdDev(demandStdDev(demandSeries), activePeriodType);

  const statisticalSafetyStock = calculateSafetyStock({
    demandSeries,
    periodType: activePeriodType,
    averageDailyDemand: avgDaily,
    demandStdDevDaily: sigmaDaily,
    leadTimeDays,
    serviceLevelZ,
  });

  const safetyStock = resolveSafetyStock(forecastedDemand, {
    ...safetyConfig,
    statistical: statisticalSafetyStock,
  });

  const ropCalc = calculateReorderPoint({
    averageDailyDemand: avgDaily,
    leadTimeDays,
    safetyStock,
  });

  const reorderPoint =
    product?.reorder_point != null && Number(product.reorder_point) > 0
      ? Number(product.reorder_point)
      : ropCalc.reorderPoint;

  const orderQtyResult = calculateSuggestedOrderQuantity({
    forecastedDemand,
    leadTimeDemand: Math.max(ropCalc.leadTimeDemand, forecastedDemand),
    averageDailyDemand: avgDaily,
    leadTimeDays,
    safetyStock,
    reorderPoint,
    currentStock,
    reservedStock,
    incomingStock,
    orderQuantity,
  });

  const recommendedRestock = orderQtyResult.suggestedOrderQuantity;
  const stockStatus = determineStockStatus(
    currentStock - reservedStock + incomingStock,
    forecastedDemand,
    safetyStock,
    reorderPoint
  );

  // Build fitted Simple Linear Regression trend line across historical + future periods
  const trendLine = historical.map((p, i) => {
    const x = Number(p.x ?? i + 1);
    const fittedY = Math.max(0, Math.round(predictY(regression.intercept, regression.slope, x) * 100) / 100);
    return { x, y: fittedY };
  });
  for (let i = 0; i < forecastPoints.length; i += 1) {
    trendLine.push({
      x: forecastPoints[i].x,
      y: forecastPoints[i].y,
    });
  }

  const chartPoints = [
    ...historical.map((p, i) => {
      const x = Number(p.x ?? i + 1);
      const fittedY = Math.max(
        0,
        Math.round(predictY(regression.intercept, regression.slope, x) * 100) / 100
      );
      return {
        ...p,
        actual: p.y,
        fitted: fittedY,
        forecast: null,
      };
    }),
    ...forecastPoints.map((p) => {
      return {
        ...p,
        actual: null,
        fitted: p.y,
        forecast: p.predictedDemand,
        rangeLow: p.rangeLow,
        rangeHigh: p.rangeHigh,
      };
    }),
  ];

  const totalSold = historical.reduce((s, p) => s + p.y, 0);
  const averageSales = historical.length ? totalSold / historical.length : 0;

  const trendInfo = classifySalesTrend(historical, regression);
  const range = computePredictionRange(forecastedDemand, demandSeries, effectiveSpread, regression.n);
  const confidence = computeRegressionConfidence({
    regression,
    accuracy,
    demandSeries,
  });

  const availableStock = Math.max(0, currentStock - reservedStock);
  const inventoryPosition = Math.max(0, currentStock - reservedStock + incomingStock);

  const belowReorderPoint =
    reorderPoint != null &&
    Number.isFinite(Number(reorderPoint)) &&
    inventoryPosition <= Number(reorderPoint);

  const recommendation = classifyInventoryRecommendation({
    sufficient: true,
    currentStock,
    reservedStock,
    incomingStock,
    reorderPoint,
    safetyStock,
    recommendedRestock,
    forecastedDemand,
    trend: trendInfo.trend,
    poorFit: regression.poorFit,
    unusualError: accuracy.unusualError,
  });

  const replenishmentNeeded = Boolean(recommendedRestock > 0 || belowReorderPoint);
  const replenishmentReason = replenishmentNeeded
    ? `Available stock (${availableStock} units) plus incoming purchase orders (${incomingStock} units) gives an inventory position of ${inventoryPosition} units, which is below the required target of ${Math.max(
        reorderPoint || 0,
        forecastedDemand + safetyStock
      )} units (Forecasted Demand: ${forecastedDemand} units, Lead-Time Demand: ${ropCalc.leadTimeDemand} units over ${leadTimeDays}d lead time, Safety Stock: ${safetyStock} units).`
    : `Net inventory position (${inventoryPosition} units = ${currentStock} on hand − ${reservedStock} reserved + ${incomingStock} incoming POs) exceeds both the Reorder Point (${reorderPoint ?? 0} units) and projected horizon requirement (${forecastedDemand + safetyStock} units).`;

  const whyReasons = buildWhyReasons({
    trend: trendInfo.trend,
    trendPct: trendInfo.trendPct,
    slope: regression.slope,
    intercept: regression.intercept,
    rSquared: regression.rSquared,
    currentStock,
    forecastedDemand,
    reorderPoint,
    belowReorderPoint,
    recommendedRestock,
    nonZeroObservations,
    observations: historical.length,
  });

  const trendLabels = {
    increasing: '↑ Increasing',
    decreasing: '↓ Decreasing',
    stable: '→ Stable',
    volatile: '⚠ Volatile',
    insufficient: '— Insufficient Data',
  };

  return {
    productId,
    productName,
    sku: product?.sku || (productId ? `SKU-${productId}` : '—'),
    category: product?.category || '—',
    currentStock,
    reservedStock,
    incomingStock,
    availableStock,
    inventoryPosition,
    insufficient: false,
    error: null,
    limitedDataMessage: null,
    forecastMethod: ALGORITHM_NAME,
    algorithm: 'Simple Linear Regression',
    equation: regression.equation || formatRegressionEquation(regression.intercept, regression.slope),
    slope: regression.slope,
    intercept: regression.intercept,
    rSquared: regression.rSquared,
    mae: accuracy.mae,
    rmse: accuracy.rmse,
    wape: accuracy.wape != null ? accuracy.wape / 100 : null,
    wapePercent: accuracy.wape,
    isSparseDemand: Boolean(accuracy.isSparseDemand),
    accuracy,
    residualStdError: residualStdError != null ? Math.round(residualStdError * 10000) / 10000 : null,
    regression: {
      ...regression,
      nonZeroObservations,
    },
    // Provide compatible summary fields for any legacy callers reading `.sba`
    sba: {
      sufficient: true,
      forecast: nextPeriodDemand,
      meanDemand: regression.meanY,
      observations: regression.n,
      nonZeroObservations,
      slope: regression.slope,
      intercept: regression.intercept,
      rSquared: regression.rSquared,
    },
    historical,
    trendLine,
    forecastPoints,
    forecastDates,
    chartPoints,
    forecastedDemand,
    predictedNextPeriodDemand: nextPeriodDemand,
    previousHorizonDemand,
    demandChangePct,
    safetyStock,
    reorderPoint,
    leadTimeDemand: ropCalc.leadTimeDemand,
    recommendedRestock,
    suggestedPurchaseQuantity: recommendedRestock,
    replenishmentNeeded,
    replenishmentReason,
    inventoryRecommendation: recommendation,
    recommendationStatus: recommendation.status,
    stockStatus,
    trend: trendInfo.trend,
    trendLabel: trendLabels[trendInfo.trend] || '→ Stable',
    trendExplanation: trendInfo.explanation,
    trendPct: trendInfo.trendPct,
    averageSales: Math.round(averageSales * 100) / 100,
    periodType: activePeriodType,
    autoAdjustedPeriod: resolved.autoAdjusted,
    forecastAhead,
    forecastPeriodLabel: forecastPoints.map((p) => p.label).join(', '),
    nextForecastDate: forecastPoints[0]?.forecastDate || null,
    generatedAt: new Date().toISOString(),
    saleCount: grouped.saleCount,
    distinctPeriods: grouped.distinctPeriods,
    sufficient: true,
    seasonalityEnabled: false,
    leadTimeDays,
    orderQuantity,
    reorderLevel: Number(product?.reorder_level ?? product?.reorderLevel ?? 5),
    confidence,
    forecastRange: range,
    statisticallySupportedRange: Boolean(range?.statisticallySupported),
    whyReasons,
    belowReorderPoint,
  };
}

function buildLimitedDataMessage(periods, events) {
  return {
    title: 'Limited Historical Data',
    periods,
    demandEvents: events,
    minPeriods: MIN_REGRESSION_PERIODS,
    minEvents: MIN_NONZERO_DEMANDS,
    summary:
      periods < MIN_REGRESSION_PERIODS
        ? `Only ${periods} historical period${periods === 1 ? '' : 's'} ${periods === 1 ? 'is' : 'are'} currently available. At least ${MIN_REGRESSION_PERIODS} observations are required for Simple Linear Regression.`
        : `Insufficient historical observations (${events} demand events) to fit a linear regression model.`,
  };
}

/**
 * Classify sales trend using Simple Linear Regression slope b and period dispersion.
 */
export function classifySalesTrend(historical = [], regressionModel = null) {
  if (!historical || historical.length < MIN_REGRESSION_PERIODS) {
    return {
      trend: 'insufficient',
      trendPct: null,
      explanation: 'At least 2 historical periods are required to classify linear demand trend.',
    };
  }

  const reg =
    regressionModel ||
    calculateLinearRegression(
      historical.map((p, idx) => ({
        x: Number(p.x ?? idx + 1),
        y: Number(p.y ?? 0),
      }))
    );

  if (!reg.sufficient) {
    return {
      trend: 'insufficient',
      trendPct: null,
      explanation: reg.error || 'Insufficient data for linear regression trend classification.',
    };
  }

  const mean = reg.meanY || 0;
  const sigma = demandStdDev(historical.map((p) => Number(p.y || 0)));
  const cv = mean > 0 ? sigma / mean : 0;

  // Relative slope per period as % of mean demand
  const relativeSlopePct = mean > 0 ? Math.round((reg.slope / mean) * 1000) / 10 : 0;
  const dir = determineTrend(reg.slope, mean);

  if (cv > 1.35 && reg.rSquared < 0.15) {
    return {
      trend: 'volatile',
      trendPct: relativeSlopePct,
      explanation: `Demand fluctuates across periods (R² = ${reg.rSquared.toFixed(2)}). Linear trend slope is ${reg.slope >= 0 ? '+' : ''}${reg.slope.toFixed(2)} units/period.`,
    };
  }

  if (dir === 'increasing') {
    return {
      trend: 'increasing',
      trendPct: relativeSlopePct,
      explanation: `Linear regression shows an upward slope of +${reg.slope.toFixed(2)} units per period (${reg.equation}).`,
    };
  }

  if (dir === 'decreasing') {
    return {
      trend: 'decreasing',
      trendPct: relativeSlopePct,
      explanation: `Linear regression shows a downward slope of ${reg.slope.toFixed(2)} units per period (${reg.equation}).`,
    };
  }

  return {
    trend: 'stable',
    trendPct: relativeSlopePct,
    explanation: `Demand is steady around ${mean.toFixed(1)} units per period (slope ${reg.slope >= 0 ? '+' : ''}${reg.slope.toFixed(2)}, ${reg.equation}).`,
  };
}

/**
 * Dynamic explanation bullets supported by Simple Linear Regression & inventory data.
 */
export function buildWhyReasons({
  trend,
  trendPct,
  slope,
  intercept,
  rSquared,
  currentStock,
  forecastedDemand,
  reorderPoint,
  belowReorderPoint,
  recommendedRestock,
  nonZeroObservations,
  observations,
} = {}) {
  const reasons = [];
  if (slope != null && intercept != null) {
    reasons.push(
      `Simple Linear Regression model (${formatRegressionEquation(intercept, slope)}) fitted across ${observations || 0} periods`
    );
  }
  if (trend === 'increasing') {
    reasons.push(
      trendPct != null
        ? `Linear trend is increasing (${slope >= 0 ? '+' : ''}${Number(slope || 0).toFixed(2)} units/period, ~${Math.abs(trendPct)}%)`
        : 'Linear regression slope indicates increasing product demand'
    );
  } else if (trend === 'decreasing') {
    reasons.push(
      trendPct != null
        ? `Linear trend is decreasing (${Number(slope || 0).toFixed(2)} units/period, ~${Math.abs(trendPct)}%)`
        : 'Linear regression slope indicates decreasing product demand'
    );
  } else if (trend === 'stable') {
    reasons.push('Product demand follows a stable linear trajectory across recent periods');
  } else if (trend === 'volatile') {
    reasons.push('Demand exhibits high variance around the linear regression line');
  }

  if (rSquared != null && Number.isFinite(Number(rSquared))) {
    reasons.push(
      `Regression fit R² = ${Number(rSquared).toFixed(3)} (${nonZeroObservations || 0} active demand periods)`
    );
  }
  if (forecastedDemand != null && currentStock < forecastedDemand) {
    reasons.push('Current on-hand inventory is below forecasted horizon demand');
  }
  if (belowReorderPoint && reorderPoint != null) {
    reasons.push(`Stock (${currentStock}) is at or below the reorder point (${reorderPoint})`);
  }
  if (recommendedRestock > 0) {
    reasons.push(
      `Recommended purchase order of ${recommendedRestock} units to cover lead-time demand and safety stock`
    );
  }
  return reasons.slice(0, 5);
}

/**
 * Multi-product forecast table rows.
 */
export function buildProductForecastTable({
  products = [],
  salesRows = [],
  periodType = 'week',
  lookbackPeriods = 12,
  forecastAhead = 1,
  safetyConfig = { mode: 'absolute', value: 5 },
  limit = 50,
}) {
  const rows = (products || []).map((product) => {
    const result = generateProductForecast({
      salesRows,
      product,
      periodType,
      lookbackPeriods,
      forecastAhead,
      safetyConfig,
    });
    return {
      productId: result.productId,
      productName: result.productName,
      category: result.category,
      currentStock: result.currentStock,
      averageSales: result.averageSales,
      forecastedDemand: result.insufficient ? null : result.forecastedDemand,
      recommendedRestock: result.insufficient ? null : result.recommendedRestock,
      suggestedPurchaseQuantity: result.insufficient ? null : result.suggestedPurchaseQuantity,
      reorderPoint: result.insufficient ? null : result.reorderPoint,
      safetyStock: result.insufficient ? null : result.safetyStock,
      slope: result.insufficient ? null : result.slope,
      intercept: result.insufficient ? null : result.intercept,
      rSquared: result.insufficient ? null : result.rSquared,
      mae: result.insufficient ? null : result.mae,
      rmse: result.insufficient ? null : result.rmse,
      wape: result.insufficient ? null : result.wapePercent,
      leadTimeDays: result.leadTimeDays,
      forecastMethod: ALGORITHM_NAME,
      recommendationStatus: result.recommendationStatus,
      belowReorderPoint: Boolean(result.belowReorderPoint),
      confidence: result.confidence || null,
      insufficient: Boolean(result.insufficient),
      trend: result.insufficient ? '—' : result.trendLabel,
      stockStatus: result.insufficient ? 'Insufficient Data' : result.stockStatus,
      sufficient: result.sufficient,
    };
  });

  rows.sort((a, b) => {
    const ar = a.recommendedRestock ?? -1;
    const br = b.recommendedRestock ?? -1;
    return br - ar;
  });

  return rows.slice(0, limit);
}

/**
 * Build Simple Linear Regression forecast for an entire product category.
 */
export function generateCategoryForecast({
  salesRows = [],
  products = [],
  category = 'All',
  periodType = 'week',
  lookbackPeriods = 12,
  forecastAhead = 1,
  safetyConfig = { mode: 'absolute', value: 10 },
  autoPeriod = true,
  serviceLevelZ = 1.65,
}) {
  const catName = category || 'All';
  const isAll = catName === 'All' || catName === 'All Categories';
  const catProducts = (products || []).filter((p) => {
    if (isAll) return true;
    return String(p.category || '').toLowerCase() === catName.toLowerCase();
  });
  const currentStock = catProducts.reduce((sum, p) => sum + Math.max(0, Number(p.stock) || 0), 0);
  const avgLead =
    catProducts.length > 0
      ? catProducts.reduce((s, p) => s + (Number(p.lead_time_days ?? p.leadTimeDays ?? 3) || 3), 0) /
        catProducts.length
      : 3;

  const aggregateProduct = {
    id: `cat:${catName}`,
    product_id: null,
    name: isAll ? 'All Categories' : `Category: ${catName}`,
    category: catName,
    stock: currentStock,
    lead_time_days: avgLead,
    isCategory: true,
  };

  const normRequestedPeriod = normalizePeriodType(periodType);
  const resolved = autoPeriod
    ? resolvePeriodType(
        salesRows,
        { category: catName, isCategory: true },
        normRequestedPeriod,
        lookbackPeriods
      )
    : {
        periodType: normRequestedPeriod,
        grouped: groupSalesByPeriod(salesRows, {
          category: catName,
          periodType: normRequestedPeriod,
          lookbackPeriods: normRequestedPeriod === 'day' ? Math.max(lookbackPeriods, 14) : lookbackPeriods,
          fillWindow: true,
        }),
        autoAdjusted: false,
      };

  const activePeriodType = resolved.periodType;
  const grouped = resolved.grouped;
  const historical = grouped.periods;
  const demandSeries = historical.map((p) => p.y);
  const nonZeroObservations = demandSeries.filter((y) => y > 0).length;

  const regressionInput = historical.map((p, idx) => ({
    x: Number(p.x ?? idx + 1),
    y: Number(p.y ?? 0),
  }));
  const regression = calculateLinearRegression(regressionInput);

  if (!regression.sufficient || historical.length < MIN_REGRESSION_PERIODS) {
    const periods = historical.length || grouped.distinctPeriods || 0;
    const safetyStock = resolveSafetyStock(0, safetyConfig);
    return {
      productId: aggregateProduct.id,
      isCategory: true,
      category: catName,
      productName: aggregateProduct.name,
      productCount: catProducts.length,
      currentStock,
      insufficient: true,
      sufficient: false,
      error: regression.error || 'Insufficient category sales history for Simple Linear Regression.',
      limitedDataMessage: buildLimitedDataMessage(periods, nonZeroObservations),
      confidence: computeRegressionConfidence({ regression, accuracy: null, demandSeries }),
      trend: 'insufficient',
      trendLabel: '— Insufficient Data',
      trendExplanation: 'Not enough category sales history to fit a linear regression model.',
      whyReasons: [],
      forecastMethod: ALGORITHM_NAME,
      algorithm: 'Simple Linear Regression',
      equation: regression.equation || 'Y = 0 + 0X',
      slope: 0,
      intercept: 0,
      rSquared: 0,
      mae: null,
      rmse: null,
      wape: null,
      regression,
      sba: null,
      saleCount: grouped.saleCount || 0,
      distinctPeriods: grouped.distinctPeriods || 0,
      periodType: activePeriodType,
      autoAdjustedPeriod: resolved.autoAdjusted,
      forecastAhead,
      historical,
      trendLine: [],
      forecastPoints: [],
      chartPoints: historical.map((p) => ({ ...p, actual: p.y, fitted: null, forecast: null })),
      forecastedDemand: null,
      safetyStock,
      reorderPoint: null,
      recommendedRestock: 0,
      stockStatus: determineStockStatus(currentStock, 0, safetyStock, null),
      leadTimeDays: Math.round(avgLead),
      belowReorderPoint: false,
    };
  }

  const lastKey = historical[historical.length - 1]?.key;
  const forecastPoints = [];
  for (let i = 1; i <= forecastAhead; i += 1) {
    const futureX = historical.length + i;
    const futureKey = lastKey ? addPeriods(lastKey, activePeriodType, i) : `F${i}`;
    const predictedWhole = predictDemand(regression, futureX, { round: 'round' });
    const predictedRaw = predictDemand(regression, futureX, { round: false });
    forecastPoints.push({
      key: futureKey,
      periodKey: futureKey,
      label: periodLabel(futureKey, activePeriodType, futureX),
      x: futureX,
      y: Math.round(predictedRaw * 100) / 100,
      yRounded: predictedWhole,
      predictedDemand: predictedWhole,
      isForecast: true,
    });
  }

  const forecastedDemand = Math.max(
    0,
    Math.round(forecastPoints.reduce((s, p) => s + (Number(p.predictedDemand ?? p.y) || 0), 0))
  );
  const nextPeriodDemand = forecastPoints[0]?.predictedDemand ?? 0;
  const accuracy = evaluateChronologicalHoldout(regressionInput);

  const avgDaily = toAverageDailyDemand(Math.max(nextPeriodDemand, regression.meanY), activePeriodType);
  const sigmaDaily = toDailyDemandStdDev(demandStdDev(demandSeries), activePeriodType);
  const statisticalSafety = calculateSafetyStock({
    demandSeries,
    periodType: activePeriodType,
    averageDailyDemand: avgDaily,
    demandStdDevDaily: sigmaDaily,
    leadTimeDays: avgLead,
    serviceLevelZ,
  });
  const safetyStock = resolveSafetyStock(forecastedDemand, {
    ...safetyConfig,
    statistical: statisticalSafety,
  });
  const ropCalc = calculateReorderPoint({
    averageDailyDemand: avgDaily,
    leadTimeDays: avgLead,
    safetyStock,
  });
  const recommendedRestock = calculateRecommendedRestock(
    forecastedDemand,
    currentStock,
    safetyStock,
    ropCalc.reorderPoint
  );
  const stockStatus = determineStockStatus(currentStock, forecastedDemand, safetyStock, ropCalc.reorderPoint);

  const range = computePredictionRange(forecastedDemand, demandSeries, accuracy.rmse);
  const chartPoints = [
    ...historical.map((p, i) => {
      const x = Number(p.x ?? i + 1);
      const fittedY = Math.max(
        0,
        Math.round(predictY(regression.intercept, regression.slope, x) * 100) / 100
      );
      return {
        ...p,
        actual: p.y,
        fitted: fittedY,
        forecast: null,
      };
    }),
    ...forecastPoints.map((p) => {
      const pr = computePredictionRange(p.predictedDemand, demandSeries, accuracy.rmse);
      return {
        ...p,
        actual: null,
        fitted: p.y,
        forecast: p.predictedDemand,
        rangeLow: pr.low,
        rangeHigh: pr.high,
      };
    }),
  ];

  const averageSales = historical.length ? historical.reduce((s, p) => s + p.y, 0) / historical.length : 0;
  const trendInfo = classifySalesTrend(historical, regression);
  const confidence = computeRegressionConfidence({
    regression,
    accuracy,
    demandSeries,
  });
  const belowReorderPoint = currentStock <= ropCalc.reorderPoint;
  const trendLabels = {
    increasing: '↑ Increasing',
    decreasing: '↓ Decreasing',
    stable: '→ Stable',
    volatile: '⚠ Volatile',
    insufficient: '— Insufficient Data',
  };

  return {
    productId: aggregateProduct.id,
    isCategory: true,
    category: catName,
    productName: aggregateProduct.name,
    productCount: catProducts.length,
    currentStock,
    forecastMethod: ALGORITHM_NAME,
    algorithm: 'Simple Linear Regression',
    equation: regression.equation,
    slope: regression.slope,
    intercept: regression.intercept,
    rSquared: regression.rSquared,
    mae: accuracy.mae,
    rmse: accuracy.rmse,
    wape: accuracy.wape != null ? accuracy.wape / 100 : null,
    wapePercent: accuracy.wape,
    isSparseDemand: Boolean(accuracy.isSparseDemand),
    accuracy,
    regression: {
      ...regression,
      nonZeroObservations,
    },
    sba: {
      sufficient: true,
      forecast: nextPeriodDemand,
      meanDemand: regression.meanY,
      observations: regression.n,
      nonZeroObservations,
      slope: regression.slope,
      intercept: regression.intercept,
      rSquared: regression.rSquared,
    },
    periodType: activePeriodType,
    autoAdjustedPeriod: resolved.autoAdjusted,
    forecastAhead,
    saleCount: grouped.saleCount,
    distinctPeriods: grouped.distinctPeriods,
    historical,
    forecastPoints,
    chartPoints,
    forecastedDemand,
    safetyStock,
    reorderPoint: ropCalc.reorderPoint,
    recommendedRestock,
    suggestedPurchaseQuantity: recommendedRestock,
    stockStatus,
    averageSales: Math.round(averageSales * 100) / 100,
    insufficient: false,
    sufficient: true,
    error: null,
    limitedDataMessage: null,
    confidence,
    forecastRange: range,
    trend: trendInfo.trend,
    trendLabel: trendLabels[trendInfo.trend] || '→ Stable',
    trendExplanation: trendInfo.explanation,
    trendPct: trendInfo.trendPct,
    belowReorderPoint,
    whyReasons: buildWhyReasons({
      trend: trendInfo.trend,
      trendPct: trendInfo.trendPct,
      slope: regression.slope,
      intercept: regression.intercept,
      rSquared: regression.rSquared,
      currentStock,
      forecastedDemand,
      reorderPoint: ropCalc.reorderPoint,
      belowReorderPoint,
      recommendedRestock,
      nonZeroObservations,
      observations: historical.length,
    }),
    leadTimeDays: Math.round(avgLead),
  };
}

/**
 * Multi-category forecast table rows.
 */
export function buildCategoryForecastTable({
  categories = [],
  products = [],
  salesRows = [],
  periodType = 'week',
  lookbackPeriods = 12,
  forecastAhead = 1,
  safetyConfig = { mode: 'absolute', value: 10 },
}) {
  const list = (categories || []).filter((c) => c && c !== 'All' && c !== 'All Categories');
  const rows = list.map((cat) => {
    const result = generateCategoryForecast({
      salesRows,
      products,
      category: cat,
      periodType,
      lookbackPeriods,
      forecastAhead,
      safetyConfig,
    });
    return {
      category: cat,
      productCount: result.productCount,
      currentStock: result.currentStock,
      averageSales: result.averageSales,
      forecastedDemand: result.insufficient ? null : result.forecastedDemand,
      recommendedRestock: result.insufficient ? null : result.recommendedRestock,
      slope: result.insufficient ? null : result.slope,
      intercept: result.insufficient ? null : result.intercept,
      rSquared: result.insufficient ? null : result.rSquared,
      trend: result.insufficient ? '—' : result.trendLabel,
      stockStatus: result.insufficient ? 'Insufficient Data' : result.stockStatus,
      insufficient: result.insufficient,
    };
  });

  rows.sort((a, b) => {
    const ar = a.recommendedRestock ?? -1;
    const br = b.recommendedRestock ?? -1;
    return br - ar;
  });

  return rows;
}

/**
 * High-level `generateForecast(productId, period, options)` coordinator function
 * matching Section 7 specification:
 *   - Daily:   90-day historical window, 30-day horizon
 *   - Weekly:  26-week historical window, 12-week horizon
 *   - Monthly: 12-month historical window, 6-month horizon
 */
export async function generateForecast(productId, period = 'weekly', options = {}) {
  const periodCfg = validateForecastPeriod(period, { strict: true });
  const lookbackPeriods =
    Number(options.historicalWindow ?? options.lookbackPeriods) > 0
      ? Math.trunc(Number(options.historicalWindow ?? options.lookbackPeriods))
      : periodCfg.historicalWindow;
  const forecastAhead =
    Number(options.forecastHorizon ?? options.forecastAhead) > 0
      ? Math.trunc(Number(options.forecastHorizon ?? options.forecastAhead))
      : periodCfg.forecastHorizon;

  const products = Array.isArray(options.products) ? options.products : [];
  const product = options.product ||
    products.find((p) => String(p.id || p.product_id) === String(productId)) || {
      id: productId,
      product_id: productId,
      name: options.productName || String(productId),
      stock: Number(options.currentStock ?? 0),
      lead_time_days: Number(options.leadTimeDays ?? 3),
    };

  const salesRows = Array.isArray(options.salesRows)
    ? options.salesRows
    : extractValidSalesRows(options.orders || [], products);

  const forecast = generateProductForecast({
    salesRows,
    product,
    periodType: periodCfg.uiPeriodType,
    lookbackPeriods,
    forecastAhead,
    safetyConfig: options.safetyConfig || loadSafetyPrefs(),
    autoPeriod: false,
  });

  if (options.persist !== false && forecast.sufficient) {
    const firstPoint = forecast.forecastPoints?.[0];
    await saveForecastHistory({
      product_id: forecast.productId,
      product_name: forecast.productName,
      forecast_period: periodCfg.period,
      period_label: firstPoint?.label || forecast.forecastPeriodLabel,
      period_key: firstPoint?.key || new Date().toISOString().slice(0, 10),
      predicted_quantity: firstPoint?.predictedDemand ?? forecast.forecastedDemand,
      slope: forecast.slope,
      intercept: forecast.intercept,
      r_squared: forecast.rSquared,
      mae: forecast.mae,
      rmse: forecast.rmse,
      wape: forecast.wapePercent,
      safety_stock: forecast.safetyStock,
      current_stock: forecast.currentStock,
      reorder_point: forecast.reorderPoint,
      recommended_restock: forecast.recommendedRestock,
      recommendation_status: forecast.recommendationStatus,
      forecast_method: ALGORITHM_NAME,
      sufficient: forecast.sufficient,
    });
  }

  return forecast;
}

/**
 * Generate inventory replenishment recommendation for a product based on Simple Linear Regression.
 */
export async function generateInventoryRecommendation(productId, options = {}) {
  const period = options.period || 'weekly';
  const forecast = await generateForecast(productId, period, { ...options, persist: false });
  return {
    productId: forecast.productId,
    productName: forecast.productName,
    period: toCanonicalForecastPeriod(forecast.periodType),
    recommendation: forecast.recommendationStatus,
    details: forecast.inventoryRecommendation,
    stockStatus: forecast.stockStatus,
    currentStock: forecast.currentStock,
    reservedStock: forecast.reservedStock || 0,
    incomingStock: forecast.incomingStock || 0,
    safetyStock: forecast.safetyStock,
    reorderPoint: forecast.reorderPoint,
    suggestedPurchaseQuantity: forecast.recommendedRestock,
    forecastedDemand: forecast.forecastedDemand,
    slope: forecast.slope,
    intercept: forecast.intercept,
    rSquared: forecast.rSquared,
    mae: forecast.mae,
    rmse: forecast.rmse,
    wape: forecast.wapePercent,
  };
}

const inventorySnapshotCache = new Map();
const INVENTORY_SNAPSHOT_TTL_MS = 60 * 1000;
const OPEN_PO_STATUS_SET = new Set(['pending', 'ordered', 'approved', 'in transit', 'processing', 'open']);

/**
 * Fetch live reserved stock and incoming purchase order quantities for a product
 * from Supabase with 60s TTL cache and in-flight deduplication.
 */
export async function fetchProductInventorySnapshot(productId, { force = false } = {}) {
  const cleanId = String(productId || '').trim();
  if (!cleanId) {
    return { reservedStock: 0, incomingStock: 0 };
  }

  const now = Date.now();
  const cached = inventorySnapshotCache.get(cleanId);
  if (!force && cached) {
    if (cached.inFlight) return cached.inFlight;
    if (now - cached.at < INVENTORY_SNAPSHOT_TTL_MS) {
      return cached.data;
    }
  }

  const client = supabaseManager.getClient?.() || supabaseManager.client;
  if (!client) {
    return { reservedStock: 0, incomingStock: 0 };
  }

  const promise = (async () => {
    let reservedStock = 0;
    let incomingStock = 0;

    // 1. Try RPC fn_get_product_inventory_position first if available
    if (inventorySnapshotCache.get('__rpc_supported__') !== false) {
      try {
        const { data: rpcData, error: rpcErr } = await client.rpc('fn_get_product_inventory_position', {
          p_product_id: cleanId,
        });
        if (!rpcErr && rpcData && typeof rpcData === 'object') {
          inventorySnapshotCache.set('__rpc_supported__', true);
          const result = {
            reservedStock: Math.max(0, Number(rpcData.reserved_stock) || 0),
            incomingStock: Math.max(0, Number(rpcData.incoming_stock) || 0),
            leadTimeDays: rpcData.lead_time_days != null ? Number(rpcData.lead_time_days) : null,
            reorderPoint: rpcData.reorder_point != null ? Number(rpcData.reorder_point) : null,
          };
          inventorySnapshotCache.set(cleanId, { at: Date.now(), data: result, inFlight: null });
          return result;
        }
        if (rpcErr) {
          inventorySnapshotCache.set('__rpc_supported__', false);
        }
      } catch {
        inventorySnapshotCache.set('__rpc_supported__', false);
      }
    }

    // 2. Fallback: query open purchase_items + purchase_orders (guaranteed in schema.sql)
    try {
      const { data: poItems, error: poErr } = await client
        .from('purchase_items')
        .select('quantity, purchase_orders!inner(po_id, status)')
        .eq('product_id', cleanId);
      if (!poErr && Array.isArray(poItems)) {
        for (const item of poItems) {
          const po = Array.isArray(item.purchase_orders) ? item.purchase_orders[0] : item.purchase_orders;
          const st = String(po?.status || '')
            .trim()
            .toLowerCase();
          if (OPEN_PO_STATUS_SET.has(st)) {
            const q = Number(item.quantity);
            if (Number.isFinite(q) && q > 0) incomingStock += q;
          }
        }
      }
    } catch {
      incomingStock = 0;
    }

    // 3. Optional stock_reservations table if migrated
    if (inventorySnapshotCache.get('__reservations_supported__') !== false) {
      try {
        const { data: resRows, error: resErr } = await client
          .from('stock_reservations')
          .select('quantity')
          .eq('product_id', cleanId)
          .gt('expires_at', new Date().toISOString());
        if (!resErr && Array.isArray(resRows)) {
          inventorySnapshotCache.set('__reservations_supported__', true);
          reservedStock = resRows.reduce((s, r) => s + Math.max(0, Number(r.quantity) || 0), 0);
        } else if (resErr) {
          inventorySnapshotCache.set('__reservations_supported__', false);
        }
      } catch {
        inventorySnapshotCache.set('__reservations_supported__', false);
      }
    }

    const result = { reservedStock, incomingStock };
    inventorySnapshotCache.set(cleanId, { at: Date.now(), data: result, inFlight: null });
    return result;
  })();

  inventorySnapshotCache.set(cleanId, {
    at: now,
    data: cached?.data || { reservedStock: 0, incomingStock: 0 },
    inFlight: promise,
  });
  return promise;
}

/**
 * Fetch product forecast from the Express backend API (`GET /api/forecast/:productId?period=...`).
 */
export async function fetchProductForecastFromApi(productId, period = 'daily', options = {}) {
  const periodCfg = validateForecastPeriod(period, { strict: false });
  const baseUrl =
    options.baseUrl || (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) || '';
  const url = `${String(baseUrl).replace(/\/$/, '')}/api/forecast/${encodeURIComponent(
    String(productId)
  )}?period=${encodeURIComponent(periodCfg.period)}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json', ...(options.headers || {}) },
  });
  if (!res.ok) {
    throw new Error(`Forecast API returned HTTP ${res.status}`);
  }
  return res.json();
}

export function loadSafetyPrefs() {
  try {
    const raw = appStorage.getItem(SAFETY_PREF_KEY);
    if (!raw) return { mode: 'absolute', value: 5 };
    const parsed = JSON.parse(raw);
    return {
      mode: parsed.mode === 'percent' ? 'percent' : 'absolute',
      value: Math.max(0, Number(parsed.value) || 0),
    };
  } catch {
    return { mode: 'absolute', value: 5 };
  }
}

export function saveSafetyPrefs(prefs) {
  const next = {
    mode: prefs?.mode === 'percent' ? 'percent' : 'absolute',
    value: Math.max(0, Number(prefs?.value) || 0),
  };
  try {
    appStorage.setItem(SAFETY_PREF_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

function readLocalHistory() {
  try {
    const raw = appStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalHistory(rows) {
  try {
    appStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(rows.slice(0, 200)));
  } catch {
    /* ignore */
  }
}

/**
 * Build deterministic forecast_id to prevent duplicate forecast records for the same
 * (product_id, forecast_period, period_key).
 */
export function buildDeterministicForecastId(entry = {}) {
  if (entry.forecast_id) return String(entry.forecast_id);
  if (entry.product_id && entry.period_key) {
    const period = entry.forecast_period || 'week';
    return `fc-${entry.product_id}-${period}-${entry.period_key}`
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 96);
  }
  return `fc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Persist a forecast snapshot (Supabase + local fallback) using deterministic upsert.
 */
export async function saveForecastHistory(entry) {
  const forecastId = buildDeterministicForecastId(entry);
  const row = {
    forecast_id: forecastId,
    product_id: entry.product_id || null,
    product_name: entry.product_name || 'Unknown',
    forecast_date: entry.forecast_date || new Date().toISOString().slice(0, 10),
    forecast_period: entry.forecast_period || 'week',
    period_label: entry.period_label || null,
    period_key: entry.period_key || null,
    predicted_quantity: Math.max(0, Math.round(Number(entry.predicted_quantity) || 0)),
    actual_quantity: entry.actual_quantity == null ? null : Number(entry.actual_quantity),
    slope: entry.slope == null ? null : Number(entry.slope),
    intercept: entry.intercept == null ? null : Number(entry.intercept),
    r_squared: entry.r_squared == null ? null : Number(entry.r_squared),
    mae: entry.mae == null ? null : Number(entry.mae),
    rmse: entry.rmse == null ? null : Number(entry.rmse),
    wape: entry.wape == null ? null : Number(entry.wape),
    mase: entry.mase == null ? null : Number(entry.mase),
    safety_stock: entry.safety_stock == null ? null : Number(entry.safety_stock),
    current_stock: entry.current_stock == null ? null : Number(entry.current_stock),
    recommended_restock: entry.recommended_restock == null ? null : Number(entry.recommended_restock),
    reorder_point: entry.reorder_point == null ? null : Number(entry.reorder_point),
    recommendation_status: entry.recommendation_status || null,
    forecast_method: entry.forecast_method || ALGORITHM_NAME,
    algorithm_name: entry.algorithm_name || ALGORITHM_NAME,
    sufficient: entry.sufficient == null ? true : Boolean(entry.sufficient),
    created_at: entry.created_at || new Date().toISOString(),
  };

  // Update local history (deduplicated by forecast_id and (product_id, forecast_period, period_key))
  const local = readLocalHistory();
  const idx = local.findIndex(
    (r) =>
      r.forecast_id === row.forecast_id ||
      (row.product_id &&
        row.period_key &&
        r.product_id === row.product_id &&
        r.forecast_period === row.forecast_period &&
        r.period_key === row.period_key)
  );
  if (idx >= 0) local[idx] = { ...local[idx], ...row };
  else local.unshift(row);
  writeLocalHistory(local);

  // Invalidate read cache so explicit reload sees latest record
  historyFetchCache.at = 0;

  const client = supabaseManager.getClient?.() || supabaseManager.client;
  if (client) {
    try {
      // Base columns guaranteed by schema.sql on public.forecast_history
      const baseSchemaRow = {
        forecast_id: row.forecast_id,
        product_id: row.product_id,
        product_name: row.product_name,
        forecast_date: row.forecast_date,
        forecast_period: row.forecast_period,
        period_label: row.period_label,
        period_key: row.period_key,
        predicted_quantity: row.predicted_quantity,
        actual_quantity: row.actual_quantity,
        slope: row.slope,
        intercept: row.intercept,
        safety_stock: row.safety_stock,
        current_stock: row.current_stock,
        recommended_restock: row.recommended_restock,
        created_at: row.created_at,
      };

      if (historyFetchCache.supportsExtendedColumns !== false) {
        const { error } = await client.from('forecast_history').upsert([row], { onConflict: 'forecast_id' });
        if (!error) {
          historyFetchCache.supportsExtendedColumns = true;
          return { success: true, row, source: 'supabase' };
        }
        const errCode = String(error?.code || '');
        const errMsg = String(error?.message || '');
        if (errCode === 'PGRST204' || errCode === '42703' || errMsg.includes('column')) {
          historyFetchCache.supportsExtendedColumns = false;
        }
      }

      // Fallback strictly to base schema.sql columns
      const retry = await client
        .from('forecast_history')
        .upsert([baseSchemaRow], { onConflict: 'forecast_id' });
      if (!retry.error) return { success: true, row, source: 'supabase' };

      // If product_id is a local/demo ID not present in public.products (FK 23503), retry with product_id: null
      if (baseSchemaRow.product_id && String(retry.error?.code || '') === '23503') {
        const fkSafeRow = { ...baseSchemaRow, product_id: null };
        const fkRetry = await client
          .from('forecast_history')
          .upsert([fkSafeRow], { onConflict: 'forecast_id' });
        if (!fkRetry.error) return { success: true, row, source: 'supabase' };
      }
    } catch {
      /* fall through to local */
    }
  }

  return { success: true, row, source: 'local' };
}

/**
 * Load forecast history and backfill actuals from completed sales.
 * Uses TTL cache + in-flight deduplication to prevent Supabase refetch storms.
 */
export async function getForecastHistory({ salesRows = [], limit = 40, force = false } = {}) {
  let rows = [];
  const now = Date.now();

  if (
    !force &&
    historyFetchCache.rows &&
    now - historyFetchCache.at < HISTORY_CACHE_TTL_MS &&
    historyFetchCache.limit >= limit
  ) {
    rows = historyFetchCache.rows.slice(0, limit);
  } else {
    const client = supabaseManager.getClient?.() || supabaseManager.client;
    if (client) {
      try {
        if (!historyFetchCache.inFlight) {
          historyFetchCache.inFlight = client
            .from('forecast_history')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit)
            .then(({ data, error }) => {
              historyFetchCache.inFlight = null;
              if (!error && Array.isArray(data)) {
                historyFetchCache.rows = data;
                historyFetchCache.at = Date.now();
                historyFetchCache.limit = limit;
                return data;
              }
              return [];
            })
            .catch(() => {
              historyFetchCache.inFlight = null;
              return [];
            });
        }
        rows = await historyFetchCache.inFlight;
      } catch {
        /* local fallback */
      }
    }
    if (rows.length === 0) rows = readLocalHistory().slice(0, limit);
  }

  return rows.map((r) => {
    let actual = r.actual_quantity;
    if ((actual == null || actual === '') && r.product_id && r.period_key) {
      const periodKey = r.period_key;
      const periodType = normalizePeriodType(r.forecast_period || 'week');
      const matching = (salesRows || []).filter((s) => String(s.product_id) === String(r.product_id));
      const sum = matching
        .filter((s) => {
          const d = s.date instanceof Date ? s.date : new Date(s.date);
          if (Number.isNaN(d.getTime())) return false;
          if (periodType === 'day') return dayKey(d) === periodKey;
          if (periodType === 'month') return monthKey(d) === periodKey;
          return weekKey(d) === periodKey;
        })
        .reduce((acc, s) => acc + Number(s.quantity || 0), 0);
      actual = sum;
    }
    const predicted = Number(r.predicted_quantity) || 0;
    const actualNum = actual == null ? null : Number(actual);
    const diff = actualNum == null ? null : actualNum - predicted;
    return {
      ...r,
      actual_quantity: actualNum,
      forecast_difference: diff,
      forecast_method: r.forecast_method || ALGORITHM_NAME,
    };
  });
}

/**
 * Aggregate MAE, RMSE, and WAPE for scored history rows.
 */
export function scoreForecastAccuracy(historyRows = [], { days = null } = {}) {
  let rows = historyRows || [];
  if (days != null && Number(days) > 0) {
    const cutoff = Date.now() - Number(days) * 24 * 60 * 60 * 1000;
    rows = rows.filter((r) => {
      const raw = r.created_at || r.forecast_date;
      if (!raw) return false;
      const t = new Date(raw).getTime();
      return Number.isFinite(t) ? t >= cutoff : true;
    });
  }

  const pairs = rows
    .filter((r) => r.actual_quantity != null && r.predicted_quantity != null)
    .map((r) => ({
      actual: Number(r.actual_quantity),
      predicted: Number(r.predicted_quantity),
    }));

  const actualArr = pairs.map((p) => p.actual);
  const predictedArr = pairs.map((p) => p.predicted);
  const metrics = calculateForecastAccuracy(actualArr, predictedArr);

  // Maintain both normalized wape (0..1) and percentage wapePercent (0..100) for UI compatibility
  const wapeRatio = metrics.wape != null ? Math.round((metrics.wape / 100) * 10000) / 10000 : null;
  let accuracyPct = null;
  if (metrics.wape != null && Number.isFinite(metrics.wape)) {
    accuracyPct = Math.round(Math.max(0, Math.min(99, 100 - metrics.wape)));
  }

  return {
    mae: metrics.mae,
    rmse: metrics.rmse,
    wape: wapeRatio,
    wapePercent: metrics.wape,
    mase: null,
    bias: metrics.bias,
    accuracyPct,
    sampleSize: metrics.sampleSize,
    sufficient: metrics.sampleSize >= 2,
  };
}

export const forecastService = {
  MIN_REGRESSION_PERIODS,
  MIN_SBA_PERIODS,
  MIN_NONZERO_DEMANDS,
  ALGORITHM_NAME,
  FORECAST_PERIOD_CONFIG,
  validateForecastPeriod,
  calculateLinearRegression,
  predictDemand,
  predictY,
  calculateForecastAccuracy,
  evaluateChronologicalHoldout,
  calculateSafetyStock,
  calculateReorderPoint,
  calculateSuggestedOrderQuantity,
  getHistoricalSales,
  groupSalesByPeriod,
  resolvePeriodType,
  generateProductForecast,
  buildProductForecastTable,
  generateCategoryForecast,
  buildCategoryForecastTable,
  generateForecast,
  generateInventoryRecommendation,
  fetchProductInventorySnapshot,
  fetchProductForecastFromApi,
  classifyInventoryRecommendation,
  calculateRecommendedRestock,
  resolveSafetyStock,
  determineStockStatus,
  stockStatusTone,
  classifySalesTrend,
  buildWhyReasons,
  loadSafetyPrefs,
  saveSafetyPrefs,
  saveForecastHistory,
  getForecastHistory,
  scoreForecastAccuracy,
};

export default forecastService;
