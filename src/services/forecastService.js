/**
 * Sales Forecast & Stock Optimization service.
 * Authoritative engine: Croston / Syntetos-Boylan Approximation (SBA) + optional seasonality + ROP.
 * Legacy OLS kept in linearRegression.js for reading old forecast_history rows only.
 */

import { supabaseManager } from './supabaseClient';
import { appStorage } from './storageAdapter';
import { ORDER_STATUSES, canonicalizeStatus } from './orderService';
import {
  calculateCrostonSBA,
  computeSeasonalFactors,
  projectSBAForecast,
  demandStdDev,
  calculateReorderPoint,
  toAverageDailyDemand,
  calculateWAPE,
  calculateMASE,
  MIN_SBA_PERIODS,
  MIN_NONZERO_DEMANDS,
  MIN_PERIODS_FOR_SEASONALITY,
} from '../utils/crostonSBA';

const HISTORY_STORAGE_KEY = 'mototrack_forecast_history';
const SAFETY_PREF_KEY = 'mototrack_forecast_safety_prefs';
const EXCLUDED_STATUSES = new Set([ORDER_STATUSES.CANCELLED, ORDER_STATUSES.REFUNDED]);

function pad2(n) {
  return String(n).padStart(2, '0');
}

function parseOrderDate(order) {
  const raw = order?.created_at || order?.updated_at || order?.order_date;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0 Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function dayKey(date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function weekKey(date) {
  const start = startOfWeek(date);
  const y = start.getUTCFullYear();
  const oneJan = new Date(Date.UTC(y, 0, 1));
  const week = Math.floor((start - oneJan) / (7 * 24 * 60 * 60 * 1000)) + 1;
  return `${y}-W${pad2(week)}`;
}

function monthKey(date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}`;
}

function periodKeyForDate(date, periodType) {
  if (periodType === 'day') return dayKey(date);
  if (periodType === 'month') return monthKey(date);
  return weekKey(date);
}

function addPeriods(periodKey, periodType, count) {
  if (periodType === 'day') {
    const [y, m, d] = periodKey.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + count));
    return dayKey(dt);
  }
  if (periodType === 'month') {
    const [y, m] = periodKey.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + count, 1));
    return monthKey(d);
  }
  // week: YYYY-Www
  const match = /^(\d{4})-W(\d{2})$/.exec(periodKey);
  if (!match) return periodKey;
  const y = Number(match[1]);
  const w = Number(match[2]);
  const oneJan = new Date(Date.UTC(y, 0, 1));
  const day = oneJan.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const firstMonday = new Date(oneJan);
  firstMonday.setUTCDate(oneJan.getUTCDate() + mondayOffset);
  const target = new Date(firstMonday);
  target.setUTCDate(firstMonday.getUTCDate() + (w - 1 + count) * 7);
  return weekKey(target);
}

function periodLabel(periodKey, periodType, index) {
  if (periodType === 'day') {
    const [y, m, d] = String(periodKey).split('-');
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${names[Number(m) - 1] || m} ${Number(d)}`;
  }
  if (periodType === 'month') {
    const [y, m] = periodKey.split('-');
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${names[Number(m) - 1] || m} ${y}`;
  }
  return `Week ${index}`;
}

function periodUnitLabel(periodType, count) {
  if (periodType === 'day') return count === 1 ? 'day' : 'days';
  if (periodType === 'month') return count === 1 ? 'month' : 'months';
  return count === 1 ? 'week' : 'weeks';
}

function matchesProduct(row, product) {
  if (!product) return false;
  const ids = [product.id, product.product_id].filter(Boolean).map(String);
  if (row.product_id && ids.includes(String(row.product_id))) return true;
  const name = String(product.name || '')
    .trim()
    .toLowerCase();
  if (name && String(row.product_name || '').trim().toLowerCase() === name) return true;
  return false;
}

/**
 * Flatten valid sales line items from orders.
 */
export function getHistoricalSales(orders = [], products = []) {
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
  (orders || []).forEach((order) => {
    const status = canonicalizeStatus(order.status);
    if (EXCLUDED_STATUSES.has(status)) return;
    const date = parseOrderDate(order);
    if (!date) return;
    const items = Array.isArray(order.items) ? order.items : [];
    items.forEach((item) => {
      const qty = Number(item.quantity) || 0;
      if (qty <= 0) return;
      const productId = item.product_id || item.id || null;
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
        order_id: order.order_id || order.id,
        status,
        channel: order.channel || 'Online Store',
      });
    });
  });
  return rows;
}

/**
 * Group sales into continuous time periods for one product or category (or all).
 */
export function groupSalesByPeriod(
  salesRows,
  { productId = null, product = null, category = null, periodType = 'week', lookbackPeriods = 12 } = {}
) {
  const filtered = (salesRows || []).filter((r) => {
    if (category) {
      if (category === 'All' || category === 'All Categories') return true;
      return String(r.category || '').toLowerCase() === String(category).toLowerCase();
    }
    if (product) return matchesProduct(r, product);
    if (!productId) return true;
    return String(r.product_id) === String(productId);
  });

  if (filtered.length === 0) {
    return { periods: [], periodType, lookbackPeriods, saleCount: 0, distinctPeriods: 0 };
  }

  const bucket = new Map();
  filtered.forEach((row) => {
    const key = periodKeyForDate(row.date, periodType);
    bucket.set(key, (bucket.get(key) || 0) + row.quantity);
  });

  const sortedKeys = Array.from(bucket.keys()).sort();
  const lastKey = sortedKeys[sortedKeys.length - 1];
  const firstKey =
    sortedKeys.length > lookbackPeriods
      ? addPeriods(lastKey, periodType, -(lookbackPeriods - 1))
      : sortedKeys[0];

  // Build continuous range from firstKey → lastKey
  const periods = [];
  let cursor = firstKey;
  let guard = 0;
  while (guard < 400) {
    periods.push({
      key: cursor,
      label: periodLabel(cursor, periodType, periods.length + 1),
      x: periods.length + 1,
      y: bucket.get(cursor) || 0,
      isHistorical: true,
    });
    if (cursor === lastKey) break;
    cursor = addPeriods(cursor, periodType, 1);
    guard += 1;
  }

  return {
    periods,
    periodType,
    lookbackPeriods,
    saleCount: filtered.reduce((s, r) => s + r.quantity, 0),
    distinctPeriods: sortedKeys.length,
  };
}

/**
 * Pick a period type that has enough distinct buckets for regression.
 * Prefers the caller's choice; falls back day → week → month.
 */
export function resolvePeriodType(salesRows, target, preferred = 'week', lookbackPeriods = 12) {
  const isCat = Boolean(
    typeof target === 'string' ||
    target?.isCategory ||
    target?.categoryOnly ||
    (target?.category && !target.id && !target.product_id)
  );
  const categoryName = typeof target === 'string' ? target : (target?.category || target?.name || null);
  const product = isCat ? null : target;

  const order = preferred === 'day'
    ? ['day', 'week', 'month']
    : preferred === 'month'
      ? ['month', 'week', 'day']
      : ['week', 'day', 'month'];

  for (const type of order) {
    const grouped = groupSalesByPeriod(salesRows, {
      product,
      category: isCat ? categoryName : null,
      periodType: type,
      lookbackPeriods: type === 'day' ? Math.max(lookbackPeriods, 14) : lookbackPeriods,
    });
    if (grouped.distinctPeriods >= MIN_SBA_PERIODS) {
      return { periodType: type, grouped, autoAdjusted: type !== preferred };
    }
  }

  const fallback = groupSalesByPeriod(salesRows, {
    product,
    category: isCat ? categoryName : null,
    periodType: preferred,
    lookbackPeriods,
  });
  return { periodType: preferred, grouped: fallback, autoAdjusted: false };
}

/**
 * Recommended Restock = max(0, ROP + forecast horizon need - current),
 * or classic demand + safety - stock when ROP not provided.
 */
export function calculateRecommendedRestock(forecastedDemand, currentStock, safetyStock, reorderPoint = null) {
  const forecast = Math.max(0, Number(forecastedDemand) || 0);
  const stock = Math.max(0, Number(currentStock) || 0);
  const safety = Math.max(0, Number(safetyStock) || 0);
  const rop = reorderPoint != null ? Math.max(0, Number(reorderPoint) || 0) : null;
  if (rop != null && Number.isFinite(rop)) {
    // Restock enough to cover ROP buffer + near-term forecast above on-hand
    return Math.max(0, Math.round(Math.max(rop, forecast + safety) - stock));
  }
  return Math.max(0, Math.round(forecast + safety - stock));
}

/**
 * Resolve safety stock from absolute units or % of forecast (UI preference).
 * When ROP engine provides statistical safety, prefer that value.
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
 * Stock status from inventory vs reorder point (preferred) / forecast.
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

  // Fallback when ROP unavailable
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
 * Build full forecast result for one product (SBA + optional seasonality + ROP).
 */
export function generateProductForecast({
  salesRows,
  product,
  periodType = 'week',
  lookbackPeriods = 12,
  forecastAhead = 1,
  safetyConfig = { mode: 'absolute', value: 5 },
  autoPeriod = true,
  reviewPeriodDays = 1,
  serviceLevelZ = 1.65,
}) {
  const productId = product?.id || product?.product_id;
  const currentStock = Math.max(0, Number(product?.stock) || 0);
  const productName = product?.name || 'Unknown';
  const leadTimeDays = Math.max(
    0,
    Number(product?.lead_time_days ?? product?.leadTimeDays ?? 3) || 3
  );

  const resolved = autoPeriod
    ? resolvePeriodType(salesRows, product, periodType, lookbackPeriods)
    : {
        periodType,
        grouped: groupSalesByPeriod(salesRows, {
          product,
          productId,
          periodType,
          lookbackPeriods: periodType === 'day' ? Math.max(lookbackPeriods, 14) : lookbackPeriods,
        }),
        autoAdjusted: false,
      };

  const activePeriodType = resolved.periodType;
  const grouped = resolved.grouped;
  const historical = grouped.periods;
  const demandSeries = historical.map((p) => p.y);
  const sba = calculateCrostonSBA(demandSeries);

  const emptyPolicy = () => {
    const safetyStock = resolveSafetyStock(0, safetyConfig);
    return {
      productId,
      productName,
      category: product?.category || '—',
      currentStock,
      insufficient: true,
      error: sba.error || 'Insufficient historical sales data for forecasting.',
      forecastMethod: 'croston_sba',
      sba,
      regression: null,
      historical: historical.length ? historical : [],
      trendLine: [],
      forecastPoints: [],
      chartPoints: historical.map((p) => ({ ...p, actual: p.y, fitted: null, forecast: null })),
      forecastedDemand: null,
      safetyStock,
      reorderPoint: product?.reorder_point ?? product?.reorderPoint ?? null,
      recommendedRestock: 0,
      stockStatus: determineStockStatus(currentStock, 0, safetyStock, product?.reorder_point),
      trend: 'stable',
      trendLabel: 'Insufficient Data',
      trendExplanation: sba.error || 'Insufficient historical data',
      averageSales: 0,
      periodType: activePeriodType,
      autoAdjustedPeriod: resolved.autoAdjusted,
      forecastAhead,
      forecastPeriodLabel: null,
      saleCount: grouped.saleCount || 0,
      distinctPeriods: grouped.distinctPeriods || 0,
      sufficient: false,
      seasonalityEnabled: false,
      leadTimeDays,
    };
  };

  if (!sba.sufficient) {
    return emptyPolicy();
  }

  // Seasonality only with enough history
  let seasonal = { enabled: false, factors: {} };
  if (historical.length >= MIN_PERIODS_FOR_SEASONALITY && activePeriodType === 'day') {
    seasonal = computeSeasonalFactors(
      historical.map((p) => {
        const [y, m, d] = String(p.key).split('-').map(Number);
        const dt = new Date(Date.UTC(y, m - 1, d));
        return { demand: p.y, dow: dt.getUTCDay() };
      }),
      'dow'
    );
  } else if (historical.length >= MIN_PERIODS_FOR_SEASONALITY && activePeriodType === 'month') {
    seasonal = computeSeasonalFactors(
      historical.map((p) => {
        const m = Number(String(p.key).split('-')[1]);
        return { demand: p.y, month: m };
      }),
      'month'
    );
  }

  const lastKey = historical[historical.length - 1]?.key;
  const futureKeys = [];
  for (let i = 1; i <= forecastAhead; i += 1) {
    futureKeys.push(lastKey ? addPeriods(lastKey, activePeriodType, i) : `F${i}`);
  }
  const projected = projectSBAForecast(sba, {
    ahead: forecastAhead,
    seasonalFactors: seasonal,
    periodKeys: futureKeys,
    periodType: activePeriodType,
  });

  const forecastPoints = projected.map((p, idx) => ({
    key: p.periodKey || `F${idx + 1}`,
    label: periodLabel(p.periodKey || `F${idx + 1}`, activePeriodType, historical.length + idx + 1),
    x: historical.length + idx + 1,
    y: Math.round(p.forecast * 100) / 100,
    yRounded: Math.round(p.forecast),
    isForecast: true,
    seasonalFactor: p.seasonalFactor,
  }));

  // Primary demand = sum of horizon (more useful for restock than last point only)
  const forecastedDemand = Math.round(
    forecastPoints.reduce((s, p) => s + (Number(p.y) || 0), 0)
  );

  const avgDaily = toAverageDailyDemand(sba.meanDemand, activePeriodType);
  const sigmaDaily = toAverageDailyDemand(demandStdDev(demandSeries), activePeriodType);
  const ropCalc = calculateReorderPoint({
    averageDailyDemand: avgDaily,
    leadTimeDays,
    reviewPeriodDays,
    demandStdDevDaily: sigmaDaily,
    z: serviceLevelZ,
  });

  const safetyStock = resolveSafetyStock(forecastedDemand, {
    ...safetyConfig,
    statistical: ropCalc.safetyStock,
  });
  const reorderPoint =
    product?.reorder_point != null && Number(product.reorder_point) > 0
      ? Number(product.reorder_point)
      : ropCalc.reorderPoint;

  const recommendedRestock = calculateRecommendedRestock(
    forecastedDemand,
    currentStock,
    safetyStock,
    reorderPoint
  );
  const stockStatus = determineStockStatus(
    currentStock,
    forecastedDemand,
    safetyStock,
    reorderPoint
  );

  const baseLevel = sba.forecast;
  const trendLine = historical.map((p, i) => ({
    x: i + 1,
    y: Math.round(baseLevel * 100) / 100,
  }));
  for (let i = 0; i < forecastPoints.length; i += 1) {
    trendLine.push({
      x: historical.length + i + 1,
      y: forecastPoints[i].y,
    });
  }

  const chartPoints = [
    ...historical.map((p) => ({
      ...p,
      actual: p.y,
      fitted: Math.round(baseLevel * 100) / 100,
      forecast: null,
    })),
    ...forecastPoints.map((p) => ({
      ...p,
      actual: null,
      fitted: p.y,
      forecast: p.y,
    })),
  ];

  const totalSold = historical.reduce((s, p) => s + p.y, 0);
  const averageSales = historical.length ? totalSold / historical.length : 0;

  // Simple trend from recent half vs earlier half of non-zero means
  let trend = 'stable';
  if (historical.length >= 4) {
    const mid = Math.floor(historical.length / 2);
    const early = historical.slice(0, mid).reduce((s, p) => s + p.y, 0) / mid;
    const late =
      historical.slice(mid).reduce((s, p) => s + p.y, 0) / (historical.length - mid);
    const denom = Math.max(Math.abs(early), 1);
    if ((late - early) / denom > 0.15) trend = 'increasing';
    else if ((early - late) / denom > 0.15) trend = 'decreasing';
  }

  const trendLabels = {
    increasing: 'Trending Up',
    decreasing: 'Trending Down',
    stable: 'Stable',
  };

  return {
    productId,
    productName,
    category: product?.category || '—',
    currentStock,
    insufficient: false,
    error: null,
    forecastMethod: 'croston_sba',
    sba,
    regression: null,
    historical,
    trendLine,
    forecastPoints,
    chartPoints,
    forecastedDemand,
    safetyStock,
    reorderPoint,
    recommendedRestock,
    stockStatus,
    trend,
    trendLabel: trendLabels[trend] || 'Stable',
    trendExplanation: seasonal.enabled
      ? 'SBA forecast with seasonal adjustment'
      : 'SBA intermittent-demand forecast',
    averageSales: Math.round(averageSales * 100) / 100,
    periodType: activePeriodType,
    autoAdjustedPeriod: resolved.autoAdjusted,
    forecastAhead,
    forecastPeriodLabel: forecastPoints.map((p) => p.label).join(', '),
    saleCount: grouped.saleCount,
    distinctPeriods: grouped.distinctPeriods,
    sufficient: true,
    seasonalityEnabled: Boolean(seasonal.enabled),
    leadTimeDays,
    orderQuantity: Number(product?.order_quantity ?? 1) || 1,
    reorderLevel: Number(product?.reorder_level ?? product?.reorderLevel ?? 5),
  };
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
      reorderPoint: result.insufficient ? null : result.reorderPoint,
      safetyStock: result.insufficient ? null : result.safetyStock,
      leadTimeDays: result.leadTimeDays,
      forecastMethod: result.forecastMethod || 'croston_sba',
      trend: result.insufficient ? '—' : result.trendLabel,
      stockStatus: result.insufficient ? 'Insufficient Data' : result.stockStatus,
      insufficient: result.insufficient,
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
 * Build forecast for an entire category (aggregating sales of all products in that category).
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
  reviewPeriodDays = 1,
  serviceLevelZ = 1.65,
}) {
  const catName = category || 'All';
  const isAll = catName === 'All' || catName === 'All Categories';
  const catProducts = (products || []).filter((p) => {
    if (isAll) return true;
    return String(p.category || '').toLowerCase() === catName.toLowerCase();
  });
  const currentStock = catProducts.reduce((sum, p) => sum + (Math.max(0, Number(p.stock) || 0)), 0);
  const avgLead =
    catProducts.length > 0
      ? catProducts.reduce((s, p) => s + (Number(p.lead_time_days ?? p.leadTimeDays ?? 3) || 3), 0) /
        catProducts.length
      : 3;

  // Reuse product forecast path on a synthetic aggregate "product"
  const aggregateProduct = {
    id: `cat:${catName}`,
    product_id: null,
    name: isAll ? 'All Categories' : `Category: ${catName}`,
    category: catName,
    stock: currentStock,
    lead_time_days: avgLead,
    isCategory: true,
  };

  // groupSalesByPeriod matches category via product.category when isCategory
  const result = generateProductForecast({
    salesRows,
    product: { ...aggregateProduct, category: catName, isCategory: true },
    periodType,
    lookbackPeriods,
    forecastAhead,
    safetyConfig,
    autoPeriod,
    reviewPeriodDays,
    serviceLevelZ,
  });

  // Force category grouping: regenerate with category filter if product id won't match
  const resolved = autoPeriod
    ? resolvePeriodType(salesRows, { category: catName, isCategory: true }, periodType, lookbackPeriods)
    : {
        periodType,
        grouped: groupSalesByPeriod(salesRows, {
          category: catName,
          periodType,
          lookbackPeriods: periodType === 'day' ? Math.max(lookbackPeriods, 14) : lookbackPeriods,
        }),
        autoAdjusted: false,
      };

  const activePeriodType = resolved.periodType;
  const grouped = resolved.grouped;
  const historical = grouped.periods;
  const demandSeries = historical.map((p) => p.y);
  const sba = calculateCrostonSBA(demandSeries);

  if (!sba.sufficient) {
    return {
      ...result,
      isCategory: true,
      category: catName,
      productName: aggregateProduct.name,
      productCount: catProducts.length,
      currentStock,
      insufficient: true,
      error: sba.error || result.error,
      forecastMethod: 'croston_sba',
      sufficient: false,
      saleCount: grouped.saleCount || 0,
      distinctPeriods: grouped.distinctPeriods || 0,
      periodType: activePeriodType,
      autoAdjustedPeriod: resolved.autoAdjusted,
    };
  }

  // Rebuild using category series (product path can't match category id)
  return {
    ...generateProductForecast({
      salesRows: (salesRows || []).map((r) => ({
        ...r,
        // Keep as-is; groupSalesByPeriod for category uses category field
      })),
      product: {
        id: `cat-${catName}`,
        name: aggregateProduct.name,
        category: catName,
        stock: currentStock,
        lead_time_days: avgLead,
      },
      periodType: activePeriodType,
      lookbackPeriods,
      forecastAhead,
      safetyConfig,
      autoPeriod: false,
      reviewPeriodDays,
      serviceLevelZ,
    }),
    // Override with proper category grouping
    ...(() => {
      const hist = historical;
      const series = demandSeries;
      const sba2 = sba;
      const lastKey = hist[hist.length - 1]?.key;
      const futureKeys = [];
      for (let i = 1; i <= forecastAhead; i += 1) {
        futureKeys.push(lastKey ? addPeriods(lastKey, activePeriodType, i) : `F${i}`);
      }
      const projected = projectSBAForecast(sba2, {
        ahead: forecastAhead,
        periodKeys: futureKeys,
        periodType: activePeriodType,
      });
      const forecastPoints = projected.map((p, idx) => ({
        key: p.periodKey || `F${idx + 1}`,
        label: periodLabel(p.periodKey || `F${idx + 1}`, activePeriodType, hist.length + idx + 1),
        x: hist.length + idx + 1,
        y: Math.round(p.forecast * 100) / 100,
        yRounded: Math.round(p.forecast),
        isForecast: true,
      }));
      const forecastedDemand = Math.round(forecastPoints.reduce((s, p) => s + p.y, 0));
      const avgDaily = toAverageDailyDemand(sba2.meanDemand, activePeriodType);
      const sigmaDaily = toAverageDailyDemand(demandStdDev(series), activePeriodType);
      const ropCalc = calculateReorderPoint({
        averageDailyDemand: avgDaily,
        leadTimeDays: avgLead,
        reviewPeriodDays,
        demandStdDevDaily: sigmaDaily,
        z: serviceLevelZ,
      });
      const safetyStock = resolveSafetyStock(forecastedDemand, {
        ...safetyConfig,
        statistical: ropCalc.safetyStock,
      });
      const recommendedRestock = calculateRecommendedRestock(
        forecastedDemand,
        currentStock,
        safetyStock,
        ropCalc.reorderPoint
      );
      const stockStatus = determineStockStatus(
        currentStock,
        forecastedDemand,
        safetyStock,
        ropCalc.reorderPoint
      );
      const chartPoints = [
        ...hist.map((p) => ({
          ...p,
          actual: p.y,
          fitted: Math.round(sba2.forecast * 100) / 100,
          forecast: null,
        })),
        ...forecastPoints.map((p) => ({
          ...p,
          actual: null,
          fitted: p.y,
          forecast: p.y,
        })),
      ];
      const averageSales = hist.length ? hist.reduce((s, p) => s + p.y, 0) / hist.length : 0;
      return {
        historical: hist,
        forecastPoints,
        chartPoints,
        forecastedDemand,
        safetyStock,
        reorderPoint: ropCalc.reorderPoint,
        recommendedRestock,
        stockStatus,
        averageSales: Math.round(averageSales * 100) / 100,
        sba: sba2,
        insufficient: false,
        sufficient: true,
        error: null,
      };
    })(),
    isCategory: true,
    category: catName,
    productName: aggregateProduct.name,
    productCount: catProducts.length,
    currentStock,
    forecastMethod: 'croston_sba',
    periodType: activePeriodType,
    autoAdjustedPeriod: resolved.autoAdjusted,
    forecastAhead,
    saleCount: grouped.saleCount,
    distinctPeriods: grouped.distinctPeriods,
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
 * Persist a forecast snapshot (Supabase + local fallback).
 */
export async function saveForecastHistory(entry) {
  const row = {
    forecast_id: entry.forecast_id || `fc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    product_id: entry.product_id || null,
    product_name: entry.product_name || 'Unknown',
    forecast_date: entry.forecast_date || new Date().toISOString().slice(0, 10),
    forecast_period: entry.forecast_period || 'week',
    period_label: entry.period_label || null,
    period_key: entry.period_key || null,
    predicted_quantity: Number(entry.predicted_quantity) || 0,
    actual_quantity: entry.actual_quantity == null ? null : Number(entry.actual_quantity),
    slope: entry.slope == null ? null : Number(entry.slope),
    intercept: entry.intercept == null ? null : Number(entry.intercept),
    safety_stock: entry.safety_stock == null ? null : Number(entry.safety_stock),
    current_stock: entry.current_stock == null ? null : Number(entry.current_stock),
    recommended_restock: entry.recommended_restock == null ? null : Number(entry.recommended_restock),
    forecast_method: entry.forecast_method || 'croston_sba',
    reorder_point: entry.reorder_point == null ? null : Number(entry.reorder_point),
    sufficient: entry.sufficient == null ? null : Boolean(entry.sufficient),
    wape: entry.wape == null ? null : Number(entry.wape),
    mase: entry.mase == null ? null : Number(entry.mase),
    created_at: entry.created_at || new Date().toISOString(),
  };

  const client = supabaseManager.getClient?.() || supabaseManager.client;
  if (client) {
    try {
      const { error } = await client.from('forecast_history').upsert([row], { onConflict: 'forecast_id' });
      if (!error) return { success: true, row, source: 'supabase' };
    } catch {
      /* fall through to local */
    }
  }

  const local = readLocalHistory();
  const idx = local.findIndex((r) => r.forecast_id === row.forecast_id);
  if (idx >= 0) local[idx] = row;
  else local.unshift(row);
  writeLocalHistory(local);
  return { success: true, row, source: 'local' };
}

/**
 * Load forecast history and optionally backfill actuals from sales.
 */
export async function getForecastHistory({ salesRows = [], limit = 40 } = {}) {
  let rows = [];
  const client = supabaseManager.getClient?.() || supabaseManager.client;
  if (client) {
    try {
      const { data, error } = await client
        .from('forecast_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (!error && Array.isArray(data)) rows = data;
    } catch {
      /* local fallback */
    }
  }
  if (rows.length === 0) rows = readLocalHistory().slice(0, limit);

  return rows.map((r) => {
    let actual = r.actual_quantity;
    if ((actual == null || actual === '') && r.product_id && r.period_key) {
      const periodKey = r.period_key;
      const periodType = r.forecast_period || 'week';
      const matching = (salesRows || []).filter((s) => String(s.product_id) === String(r.product_id));
      const sum = matching
        .filter((s) => {
          if (periodType === 'day') return dayKey(s.date) === periodKey;
          if (periodType === 'month') return monthKey(s.date) === periodKey;
          return weekKey(s.date) === periodKey;
        })
        .reduce((acc, s) => acc + s.quantity, 0);
      // Record zero actuals as 0 (not leave null) when period has elapsed
      actual = sum;
    }
    const predicted = Number(r.predicted_quantity) || 0;
    const actualNum = actual == null ? null : Number(actual);
    const diff = actualNum == null ? null : actualNum - predicted;
    return {
      ...r,
      actual_quantity: actualNum,
      forecast_difference: diff,
      forecast_method: r.forecast_method || 'legacy_ols',
    };
  });
}

/**
 * Aggregate WAPE / MASE for a set of scored history rows.
 */
export function scoreForecastAccuracy(historyRows = []) {
  const pairs = (historyRows || [])
    .filter((r) => r.actual_quantity != null && r.predicted_quantity != null)
    .map((r) => ({
      actual: Number(r.actual_quantity),
      predicted: Number(r.predicted_quantity),
    }));
  return {
    wape: calculateWAPE(pairs),
    mase: calculateMASE(pairs),
    sampleSize: pairs.length,
  };
}

export const forecastService = {
  MIN_SBA_PERIODS,
  MIN_NONZERO_DEMANDS,
  getHistoricalSales,
  groupSalesByPeriod,
  resolvePeriodType,
  generateProductForecast,
  buildProductForecastTable,
  generateCategoryForecast,
  buildCategoryForecastTable,
  calculateRecommendedRestock,
  resolveSafetyStock,
  determineStockStatus,
  stockStatusTone,
  loadSafetyPrefs,
  saveSafetyPrefs,
  saveForecastHistory,
  getForecastHistory,
  scoreForecastAccuracy,
};

export default forecastService;
