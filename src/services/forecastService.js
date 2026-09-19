/**
 * Sales Forecast & Stock Optimization service.
 * Builds demand forecasts from orders + order_items using linear regression.
 */

import { supabaseManager } from './supabaseClient';
import { appStorage } from './storageAdapter';
import { ORDER_STATUSES, canonicalizeStatus } from './orderService';
import {
  calculateLinearRegression,
  predictY,
  determineTrend,
  trendLabel,
  trendExplanation,
  MIN_REGRESSION_PERIODS,
} from '../utils/linearRegression';

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
export function getHistoricalSales(orders = []) {
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
      rows.push({
        product_id: productId,
        product_name: item.name || 'Motorcycle Part',
        category: item.category || 'Accessories',
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
 * Group sales into continuous time periods for one product (or all).
 */
export function groupSalesByPeriod(
  salesRows,
  { productId = null, product = null, periodType = 'week', lookbackPeriods = 12 } = {}
) {
  const filtered = (salesRows || []).filter((r) => {
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
export function resolvePeriodType(salesRows, product, preferred = 'week', lookbackPeriods = 12) {
  const order = preferred === 'day'
    ? ['day', 'week', 'month']
    : preferred === 'month'
      ? ['month', 'week', 'day']
      : ['week', 'day', 'month'];

  for (const type of order) {
    const grouped = groupSalesByPeriod(salesRows, {
      product,
      periodType: type,
      lookbackPeriods: type === 'day' ? Math.max(lookbackPeriods, 14) : lookbackPeriods,
    });
    if (grouped.distinctPeriods >= MIN_REGRESSION_PERIODS) {
      return { periodType: type, grouped, autoAdjusted: type !== preferred };
    }
  }

  const fallback = groupSalesByPeriod(salesRows, {
    product,
    periodType: preferred,
    lookbackPeriods,
  });
  return { periodType: preferred, grouped: fallback, autoAdjusted: false };
}

/**
 * Recommended Restock = Forecasted Demand + Safety Stock - Current Stock
 */
export function calculateRecommendedRestock(forecastedDemand, currentStock, safetyStock) {
  const forecast = Math.max(0, Number(forecastedDemand) || 0);
  const stock = Math.max(0, Number(currentStock) || 0);
  const safety = Math.max(0, Number(safetyStock) || 0);
  return Math.max(0, Math.round(forecast + safety - stock));
}

/**
 * Resolve safety stock from absolute units or % of forecast.
 */
export function resolveSafetyStock(forecastedDemand, safetyConfig = {}) {
  const mode = safetyConfig.mode === 'percent' ? 'percent' : 'absolute';
  const value = Math.max(0, Number(safetyConfig.value) || 0);
  if (mode === 'percent') {
    return Math.round((Math.max(0, Number(forecastedDemand) || 0) * value) / 100);
  }
  return Math.round(value);
}

/**
 * Stock status from inventory vs forecast — never manually assigned.
 */
export function determineStockStatus(currentStock, forecastedDemand, safetyStock) {
  const stock = Math.max(0, Number(currentStock) || 0);
  const forecast = Math.max(0, Number(forecastedDemand) || 0);
  const safety = Math.max(0, Number(safetyStock) || 0);
  const need = forecast + safety;

  if (stock <= 0) return 'Critical Stock';
  if (forecast > 0 && stock < forecast * 0.35) return 'Critical Stock';
  if (need > 0 && stock < need) return 'Low Stock';
  if (forecast > 0 && stock > forecast * 2 + safety) return 'Overstocked';
  return 'Healthy Stock';
}

export function stockStatusTone(status) {
  if (status === 'Critical Stock') return 'danger';
  if (status === 'Low Stock') return 'warning';
  if (status === 'Overstocked') return 'info';
  return 'success';
}

/**
 * Build full forecast result for one product.
 */
export function generateProductForecast({
  salesRows,
  product,
  periodType = 'week',
  lookbackPeriods = 12,
  forecastAhead = 1,
  safetyConfig = { mode: 'absolute', value: 5 },
  autoPeriod = true,
}) {
  const productId = product?.id || product?.product_id;
  const currentStock = Math.max(0, Number(product?.stock) || 0);
  const productName = product?.name || 'Unknown';

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
  const points = historical.map((p) => ({ x: p.x, y: p.y }));
  const regression = calculateLinearRegression(points);

  if (!regression.sufficient) {
    const saleCount = grouped.saleCount || 0;
    const distinct = grouped.distinctPeriods || 0;
    let error = 'Insufficient historical sales data for forecasting.';
    if (saleCount === 0) {
      error = `No completed sales found for ${productName}. Delivered/POS orders are required.`;
    } else if (distinct < MIN_REGRESSION_PERIODS) {
      error = `${productName} has ${saleCount} unit(s) sold across ${distinct} ${periodUnitLabel(activePeriodType, distinct)}. Need sales on at least ${MIN_REGRESSION_PERIODS} different days (or weeks) to forecast.`;
    }

    return {
      productId,
      productName,
      category: product?.category || '—',
      currentStock,
      insufficient: true,
      error,
      regression: { ...regression, error },
      historical: [],
      trendLine: [],
      forecastPoints: [],
      chartPoints: [],
      forecastedDemand: null,
      safetyStock: resolveSafetyStock(0, safetyConfig),
      recommendedRestock: 0,
      stockStatus: determineStockStatus(currentStock, 0, resolveSafetyStock(0, safetyConfig)),
      trend: 'stable',
      trendLabel: 'Stable',
      trendExplanation: error,
      averageSales: 0,
      periodType: activePeriodType,
      autoAdjustedPeriod: resolved.autoAdjusted,
      forecastAhead,
      forecastPeriodLabel: null,
      saleCount,
      distinctPeriods: distinct,
    };
  }

  const trend = determineTrend(regression.slope, regression.meanY);
  const lastX = historical.length;
  const forecastPoints = [];
  for (let i = 1; i <= forecastAhead; i += 1) {
    const x = lastX + i;
    const lastKey = historical[historical.length - 1]?.key;
    const key = lastKey ? addPeriods(lastKey, activePeriodType, i) : `F${i}`;
    const y = predictY(regression.intercept, regression.slope, x);
    forecastPoints.push({
      key,
      label: periodLabel(key, activePeriodType, x),
      x,
      y: Math.round(y * 100) / 100,
      yRounded: Math.round(y),
      isForecast: true,
    });
  }

  const primaryForecast = forecastPoints[forecastPoints.length - 1];
  const forecastedDemand = primaryForecast ? Math.round(primaryForecast.y) : 0;
  const safetyStock = resolveSafetyStock(forecastedDemand, safetyConfig);
  const recommendedRestock = calculateRecommendedRestock(forecastedDemand, currentStock, safetyStock);
  const stockStatus = determineStockStatus(currentStock, forecastedDemand, safetyStock);

  const trendLine = [];
  for (let x = 1; x <= lastX + forecastAhead; x += 1) {
    trendLine.push({
      x,
      y: Math.round(predictY(regression.intercept, regression.slope, x) * 100) / 100,
    });
  }

  const chartPoints = [
    ...historical.map((p) => ({
      ...p,
      actual: p.y,
      fitted: predictY(regression.intercept, regression.slope, p.x),
      forecast: null,
    })),
    ...forecastPoints.map((p) => ({
      ...p,
      actual: null,
      fitted: predictY(regression.intercept, regression.slope, p.x),
      forecast: p.y,
    })),
  ];

  const totalSold = historical.reduce((s, p) => s + p.y, 0);
  const averageSales = historical.length ? totalSold / historical.length : 0;

  return {
    productId,
    productName,
    category: product?.category || '—',
    currentStock,
    insufficient: false,
    error: null,
    regression,
    historical,
    trendLine,
    forecastPoints,
    chartPoints,
    forecastedDemand,
    safetyStock,
    recommendedRestock,
    stockStatus,
    trend,
    trendLabel: trendLabel(trend),
    trendExplanation: trendExplanation(trend),
    averageSales: Math.round(averageSales * 100) / 100,
    periodType: activePeriodType,
    autoAdjustedPeriod: resolved.autoAdjusted,
    forecastAhead,
    forecastPeriodLabel: primaryForecast?.label || null,
    saleCount: grouped.saleCount,
    distinctPeriods: grouped.distinctPeriods,
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

  return rows.slice(0, limit);
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
    if ((actual == null || actual === '') && r.product_id && r.period_label) {
      // Best-effort: sum sales for product in matching period key if stored
      const periodKey = r.period_key || null;
      if (periodKey) {
        const sum = (salesRows || [])
          .filter((s) => String(s.product_id) === String(r.product_id))
          .filter((s) => {
            const key = r.forecast_period === 'month' ? monthKey(s.date) : weekKey(s.date);
            return key === periodKey;
          })
          .reduce((acc, s) => acc + s.quantity, 0);
        if (sum > 0) actual = sum;
      }
    }
    const predicted = Number(r.predicted_quantity) || 0;
    const actualNum = actual == null ? null : Number(actual);
    const diff = actualNum == null ? null : actualNum - predicted;
    return {
      ...r,
      actual_quantity: actualNum,
      forecast_difference: diff,
    };
  });
}

export const forecastService = {
  MIN_REGRESSION_PERIODS,
  getHistoricalSales,
  groupSalesByPeriod,
  resolvePeriodType,
  generateProductForecast,
  buildProductForecastTable,
  calculateRecommendedRestock,
  resolveSafetyStock,
  determineStockStatus,
  stockStatusTone,
  loadSafetyPrefs,
  saveSafetyPrefs,
  saveForecastHistory,
  getForecastHistory,
};

export default forecastService;
