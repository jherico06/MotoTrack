/**
 * MotoTrack Backend Statistical Forecasting Service (Simple Linear Regression).
 *
 * Implements:
 * - getHistoricalSales(productId, period, options)
 * - calculateLinearRegression(data)
 * - predictDemand(model, futurePeriod, options)
 * - calculateForecastAccuracy(actual, predicted)
 * - calculateSafetyStock(params)
 * - calculateReorderPoint(params)
 * - calculateSuggestedOrderQuantity(params)
 * - generateForecast(productId, period, options)
 * - generateInventoryRecommendation(productId, options)
 */

import { getSupabaseAdmin } from './supabaseAdmin.js';
import {
  MIN_REGRESSION_PERIODS,
  ALGORITHM_NAME,
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
  formatRegressionEquation,
  determineTrend,
  trendLabel,
  trendExplanation,
} from '../../../src/utils/linearRegression.js';

const EXCLUDED_ORDER_STATUSES = new Set([
  'cancelled',
  'canceled',
  'refunded',
  'voided',
  'void',
  'rejected',
  'draft',
  'failed',
  'delivery issue',
  'delivery failed',
]);

const OPEN_PO_STATUSES = new Set(['pending', 'ordered', 'approved', 'in transit', 'processing', 'open']);

// Short TTL cache to prevent expensive forecast recalculations on rapid page loads
const forecastCache = new Map();
const FORECAST_CACHE_TTL_MS = 60 * 1000;

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Truncate a Date to UTC day, ISO Monday week, or month start — matching PostgreSQL DATE_TRUNC.
 */
export function dateTruncUtc(dateInput, truncUnit = 'week') {
  const d = dateInput instanceof Date ? new Date(dateInput.getTime()) : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return null;

  if (truncUnit === 'day') {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  if (truncUnit === 'month') {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  }
  // PostgreSQL DATE_TRUNC('week', ts) truncates to Monday 00:00:00 UTC
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff));
}

/**
 * Step a UTC bucket date by `count` periods of `truncUnit` ('day' | 'week' | 'month').
 * Handles month and week boundaries accurately.
 */
export function addTruncPeriodsUtc(bucketDate, truncUnit, count) {
  const d = new Date(bucketDate.getTime());
  if (truncUnit === 'day') {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + count));
  }
  if (truncUnit === 'month') {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + count, 1));
  }
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + count * 7));
}

export function formatIsoDateUtc(date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

export function formatPeriodKeyUtc(bucketDate, truncUnit) {
  if (truncUnit === 'day') {
    return formatIsoDateUtc(bucketDate);
  }
  if (truncUnit === 'month') {
    return `${bucketDate.getUTCFullYear()}-${pad2(bucketDate.getUTCMonth() + 1)}`;
  }
  // ISO week key YYYY-Www
  const d = new Date(
    Date.UTC(bucketDate.getUTCFullYear(), bucketDate.getUTCMonth(), bucketDate.getUTCDate())
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${pad2(weekNo)}`;
}

export function formatPeriodLabelUtc(bucketDate, truncUnit, index) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (truncUnit === 'day') {
    return `${months[bucketDate.getUTCMonth()]} ${bucketDate.getUTCDate()}`;
  }
  if (truncUnit === 'month') {
    return `${months[bucketDate.getUTCMonth()]} ${bucketDate.getUTCFullYear()}`;
  }
  return `Week ${index} (${months[bucketDate.getUTCMonth()]} ${bucketDate.getUTCDate()})`;
}

function parseLeadTimeDays(leadTimeText, fallback = 3) {
  if (typeof leadTimeText === 'number' && Number.isFinite(leadTimeText) && leadTimeText > 0) {
    return Math.ceil(leadTimeText);
  }
  if (typeof leadTimeText === 'string' && leadTimeText.trim()) {
    const nums = leadTimeText.match(/\d+/g);
    if (nums && nums.length > 0) {
      return Math.max(1, Number(nums[nums.length - 1]) || fallback);
    }
  }
  return fallback;
}

/**
 * Fetch product, inventory, reservations, and incoming purchase order quantities from PostgreSQL.
 */
export async function getProductInventoryContext(productId, { supabaseClient = null } = {}) {
  const cleanId = String(productId || '').trim();
  if (!cleanId) {
    throw new Error('productId is required.');
  }

  const supabase = supabaseClient || getSupabaseAdmin();
  if (!supabase) {
    throw new Error('PostgreSQL database connection is unavailable.');
  }

  // 1. Fetch product + inventory row (select inventory(*) to remain compatible with both base schema.sql and extended migrations)
  const { data: prodRow, error: prodErr } = await supabase
    .from('products')
    .select(
      'product_id, id, supplier_id, category_id, name, price, unit_cost, cost_price, sku, status, brand, created_at, categories(name), inventory(*)'
    )
    .or(`product_id.eq.${cleanId},id.eq.${cleanId}`)
    .limit(1)
    .maybeSingle();

  if (prodErr) {
    throw new Error(`Failed to query product ${cleanId}: ${prodErr.message}`);
  }
  if (!prodRow) {
    return null;
  }

  const canonicalId = prodRow.product_id || prodRow.id || cleanId;
  const inv = Array.isArray(prodRow.inventory) ? prodRow.inventory[0] : prodRow.inventory;
  const cat = Array.isArray(prodRow.categories) ? prodRow.categories[0] : prodRow.categories;
  const supplierId = inv?.supplier_id || prodRow.supplier_id || null;

  // 2. Fetch supplier lead time if supplier_id exists
  let supplierLeadTimeDays = Number(inv?.lead_time_days ?? 3) || 3;
  let supplierName = null;
  if (supplierId) {
    const { data: supRow } = await supabase
      .from('suppliers')
      .select('supplier_id, name, lead_time')
      .eq('supplier_id', supplierId)
      .maybeSingle();
    if (supRow) {
      supplierName = supRow.name || null;
      if (inv?.lead_time_days == null && supRow.lead_time) {
        supplierLeadTimeDays = parseLeadTimeDays(supRow.lead_time, supplierLeadTimeDays);
      }
    }
  }

  // 3. Fetch active stock reservations
  const nowIso = new Date().toISOString();
  let reservedStock = 0;
  try {
    const { data: resRows } = await supabase
      .from('stock_reservations')
      .select('quantity')
      .eq('product_id', canonicalId)
      .gt('expires_at', nowIso);
    if (Array.isArray(resRows)) {
      reservedStock = resRows.reduce((sum, r) => sum + Math.max(0, Number(r.quantity) || 0), 0);
    }
  } catch {
    reservedStock = 0;
  }

  // 4. Fetch incoming purchase orders (pending / ordered / in transit)
  let incomingStock = 0;
  try {
    const { data: poItems } = await supabase
      .from('purchase_items')
      .select('quantity, purchase_orders!inner(po_id, status)')
      .eq('product_id', canonicalId);
    if (Array.isArray(poItems)) {
      for (const item of poItems) {
        const po = Array.isArray(item.purchase_orders) ? item.purchase_orders[0] : item.purchase_orders;
        const st = String(po?.status || '')
          .trim()
          .toLowerCase();
        if (OPEN_PO_STATUSES.has(st)) {
          const q = Number(item.quantity);
          if (Number.isFinite(q) && q > 0) incomingStock += q;
        }
      }
    }
  } catch {
    incomingStock = 0;
  }

  const currentStock = Math.max(0, Number(inv?.stock_quantity ?? 0));
  const availableStock = Math.max(0, currentStock - reservedStock);
  const inventoryPosition = Math.max(0, currentStock - reservedStock + incomingStock);

  return {
    productId: canonicalId,
    name: prodRow.name || 'Unknown Product',
    sku: prodRow.sku || `SKU-${canonicalId}`,
    category: cat?.name || 'Accessories',
    categoryId: prodRow.category_id || null,
    brand: prodRow.brand || '',
    price: Number(prodRow.price) || 0,
    unitCost: Number(prodRow.unit_cost ?? prodRow.cost_price ?? 0) || 0,
    status: prodRow.status || 'active',
    createdAt: prodRow.created_at || null,
    currentStock,
    reservedStock,
    incomingStock,
    availableStock,
    inventoryPosition,
    reorderLevel: Math.max(0, Number(inv?.reorder_level ?? 5)),
    storedReorderPoint: inv?.reorder_point != null ? Number(inv.reorder_point) : null,
    orderQuantity: Math.max(1, Number(inv?.order_quantity ?? 1) || 1),
    leadTimeDays: Math.max(1, supplierLeadTimeDays),
    supplierId,
    supplierName,
  };
}

/**
 * Retrieve historical product demand from PostgreSQL grouped by DATE_TRUNC('day'|'week'|'month').
 *
 * Excludes:
 * - Cancelled orders, uncompleted/rejected transactions, voided sales, refunded returns
 * - Stock replenishments ('restock'), manual stock increases ('adjustment', 'count', 'shrinkage')
 * - Duplicate transactions (deduplicates order_items vs inventory_transactions by order_id)
 * - Invalid or negative transaction quantities
 *
 * Includes:
 * - Continuous chronological buckets with zero-demand periods
 * - Consecutive period numbers X = 1..n
 * - Stockout period detection and adjustment so out-of-stock periods do not distort regression slope
 *
 * @param {string} productId
 * @param {'daily'|'weekly'|'monthly'|'day'|'week'|'month'} period
 * @param {object} [options]
 */
export async function getHistoricalSales(productId, period = 'weekly', options = {}) {
  const cleanId = String(productId || '').trim();
  if (!cleanId) {
    throw new Error('productId is required to retrieve historical sales.');
  }

  // Strictly validate period before using in DATE_TRUNC
  const periodCfg = validateForecastPeriod(period, { strict: true });
  const truncUnit = periodCfg.sqlTrunc; // 'day' | 'week' | 'month'
  const lookbackWindow =
    Number(options.historicalWindow ?? options.lookbackPeriods) > 0
      ? Math.trunc(Number(options.historicalWindow ?? options.lookbackPeriods))
      : periodCfg.historicalWindow;

  const referenceNow = options.referenceDate ? new Date(options.referenceDate) : new Date();
  const endBucket = dateTruncUtc(referenceNow, truncUnit);
  const startBucket = addTruncPeriodsUtc(endBucket, truncUnit, -(lookbackWindow - 1));

  // Allow injected transactions for unit/integration testing without mocking SQL internals
  let rawEvents = null;
  let stockoutBuckets = new Set();
  let hasTransactionCoverage = false;
  let invalidRecordsFiltered = 0;

  if (Array.isArray(options.transactions)) {
    rawEvents = [];
    const seenIds = new Set();
    for (const tx of options.transactions) {
      if (!tx || typeof tx !== 'object') {
        invalidRecordsFiltered += 1;
        continue;
      }
      const txProdId = String(tx.product_id ?? tx.productId ?? cleanId);
      if (txProdId !== cleanId) continue;

      const txId = tx.txn_id || tx.order_item_id || tx.id || null;
      if (txId && seenIds.has(String(txId))) {
        invalidRecordsFiltered += 1;
        continue;
      }
      if (txId) seenIds.add(String(txId));

      const status = String(tx.status || 'completed')
        .trim()
        .toLowerCase();
      if (EXCLUDED_ORDER_STATUSES.has(status)) {
        invalidRecordsFiltered += 1;
        continue;
      }

      const reason = String(tx.reason || tx.type || 'sale')
        .trim()
        .toLowerCase();
      if (
        reason === 'restock' ||
        reason === 'adjustment' ||
        reason === 'count' ||
        reason === 'shrinkage' ||
        reason === 'replenishment' ||
        reason === 'manual_increase'
      ) {
        invalidRecordsFiltered += 1;
        continue;
      }

      const dt = dateTruncUtc(tx.transaction_date || tx.order_date || tx.created_at || tx.date, truncUnit);
      if (!dt) {
        invalidRecordsFiltered += 1;
        continue;
      }

      if (tx.balance_after !== undefined && Number(tx.balance_after) <= 0) {
        stockoutBuckets.add(formatPeriodKeyUtc(dt, truncUnit));
      }

      const qty = Number(tx.quantity ?? tx.demand ?? (tx.qty_delta < 0 ? -tx.qty_delta : tx.qty_delta));
      if (!Number.isFinite(qty) || qty <= 0) {
        invalidRecordsFiltered += 1;
        continue;
      }

      const sign = reason === 'return' || tx.return_status === 'refunded' ? -1 : 1;
      rawEvents.push({ bucketDate: dt, qty: sign * qty });
      hasTransactionCoverage = true;
    }
  } else {
    const supabase = options.supabaseClient || getSupabaseAdmin();
    if (!supabase) {
      throw new Error('PostgreSQL connection unavailable.');
    }

    // Try parameterized PostgreSQL DATE_TRUNC RPC first when using default current reference date
    if (!options.referenceDate) {
      try {
        const { data: rpcRows, error: rpcErr } = await supabase.rpc('fn_get_historical_demand', {
          p_product_id: cleanId,
          p_period: periodCfg.period,
          p_lookback: lookbackWindow,
        });

        if (!rpcErr && Array.isArray(rpcRows) && rpcRows.length > 0) {
          const totalRpcDemand = rpcRows.reduce((s, r) => s + (Number(r.demand_qty) || 0), 0);
          if (totalRpcDemand > 0) {
            return finalizeHistoricalBuckets(
              rpcRows.map((r, idx) => {
                const bDate =
                  dateTruncUtc(r.period_start, truncUnit) || addTruncPeriodsUtc(startBucket, truncUnit, idx);
                return {
                  periodNumber: Number(r.period_number) || idx + 1,
                  x: Number(r.period_number) || idx + 1,
                  date: formatIsoDateUtc(bDate),
                  periodStart: bDate.toISOString(),
                  periodKey: r.period_key || formatPeriodKeyUtc(bDate, truncUnit),
                  label: formatPeriodLabelUtc(bDate, truncUnit, idx + 1),
                  rawDemand: Math.max(0, Number(r.demand_qty) || 0),
                  y: Math.max(0, Number(r.demand_qty) || 0),
                  demand: Math.max(0, Number(r.demand_qty) || 0),
                  hadStockout: Boolean(r.had_stockout),
                };
              }),
              { periodCfg, lookbackWindow, invalidRecordsFiltered: 0, hasTransactionCoverage: true }
            );
          }
        }
      } catch {
        // Fall through to parameterized table queries
      }
    }

    // Parameterized queries via Supabase PostgreSQL client
    rawEvents = [];
    const countedOrderIds = new Set();
    const seenOrderItemIds = new Set();

    // Query 1: Completed/valid order_items joined with orders
    const { data: orderItems, error: oiErr } = await supabase
      .from('order_items')
      .select(
        'order_item_id, order_id, product_id, quantity, orders!inner(order_id, status, return_status, order_date, created_at)'
      )
      .eq('product_id', cleanId)
      .gte('orders.created_at', startBucket.toISOString());

    if (!oiErr && Array.isArray(orderItems)) {
      for (const item of orderItems) {
        if (item.order_item_id && seenOrderItemIds.has(item.order_item_id)) {
          invalidRecordsFiltered += 1;
          continue;
        }
        if (item.order_item_id) seenOrderItemIds.add(item.order_item_id);

        const ord = Array.isArray(item.orders) ? item.orders[0] : item.orders;
        if (!ord) continue;
        const status = String(ord.status || '')
          .trim()
          .toLowerCase();
        if (EXCLUDED_ORDER_STATUSES.has(status)) continue;

        const retStatus = String(ord.return_status || 'none')
          .trim()
          .toLowerCase();
        if (retStatus === 'returned' || retStatus === 'refunded' || retStatus === 'approved') {
          continue;
        }

        const qty = Number(item.quantity);
        if (!Number.isFinite(qty) || qty <= 0) {
          invalidRecordsFiltered += 1;
          continue;
        }

        const txDate = ord.order_date || ord.created_at;
        const bucketDate = dateTruncUtc(txDate, truncUnit);
        if (!bucketDate) {
          invalidRecordsFiltered += 1;
          continue;
        }

        if (ord.order_id) countedOrderIds.add(String(ord.order_id));
        rawEvents.push({ bucketDate, qty });
        hasTransactionCoverage = true;
      }
    }

    // Fallback: Also check orders.items JSON / items_summary if order_items table had no rows for this product
    if (rawEvents.length === 0) {
      const { data: recentOrders } = await supabase
        .from('orders')
        .select('order_id, status, return_status, order_date, created_at')
        .gte('created_at', startBucket.toISOString())
        .limit(500);
      if (Array.isArray(recentOrders) && recentOrders.length > 0) {
        hasTransactionCoverage = true;
      }
    }

    // Query 2: Confirmed inventory_transactions ledger (reason IN ('sale', 'return'))
    const { data: ledgerRows, error: ledErr } = await supabase
      .from('inventory_transactions')
      .select(
        'txn_id, product_id, qty_delta, reason, reference_type, reference_id, balance_after, created_at'
      )
      .eq('product_id', cleanId)
      .gte('created_at', startBucket.toISOString())
      .order('created_at', { ascending: true });

    if (!ledErr && Array.isArray(ledgerRows)) {
      const seenTxnIds = new Set();
      for (const tx of ledgerRows) {
        if (tx.txn_id && seenTxnIds.has(tx.txn_id)) {
          invalidRecordsFiltered += 1;
          continue;
        }
        if (tx.txn_id) seenTxnIds.add(tx.txn_id);

        const bucketDate = dateTruncUtc(tx.created_at, truncUnit);
        if (!bucketDate) continue;

        if (Number(tx.balance_after) <= 0) {
          stockoutBuckets.add(formatPeriodKeyUtc(bucketDate, truncUnit));
        }

        const reason = String(tx.reason || '')
          .trim()
          .toLowerCase();
        // Exclude stock replenishments, manual adjustments, cycle counts, shrinkage
        if (reason !== 'sale' && reason !== 'return') {
          continue;
        }

        // Deduplicate against orders already counted in order_items
        if (tx.reference_id && countedOrderIds.has(String(tx.reference_id))) {
          continue;
        }

        const delta = Number(tx.qty_delta);
        if (!Number.isFinite(delta) || delta === 0) {
          invalidRecordsFiltered += 1;
          continue;
        }

        if (reason === 'sale' && delta < 0) {
          rawEvents.push({ bucketDate, qty: Math.abs(delta) });
          hasTransactionCoverage = true;
        } else if (reason === 'return' && delta > 0) {
          rawEvents.push({ bucketDate, qty: -Math.abs(delta) });
          hasTransactionCoverage = true;
        } else {
          invalidRecordsFiltered += 1;
        }
      }
    }
  }

  // Group events into DATE_TRUNC buckets
  const bucketMap = new Map();
  for (const ev of rawEvents || []) {
    const key = formatPeriodKeyUtc(ev.bucketDate, truncUnit);
    bucketMap.set(key, (bucketMap.get(key) || 0) + ev.qty);
  }

  // Build continuous chronological series of `lookbackWindow` periods including zero-demand periods
  const buckets = [];
  for (let i = 0; i < lookbackWindow; i += 1) {
    const bDate = addTruncPeriodsUtc(startBucket, truncUnit, i);
    const key = formatPeriodKeyUtc(bDate, truncUnit);
    const netDemand = Math.max(0, Math.round((bucketMap.get(key) || 0) * 100) / 100);
    buckets.push({
      periodNumber: i + 1,
      x: i + 1,
      date: formatIsoDateUtc(bDate),
      periodStart: bDate.toISOString(),
      periodKey: key,
      label: formatPeriodLabelUtc(bDate, truncUnit, i + 1),
      rawDemand: netDemand,
      y: netDemand,
      demand: netDemand,
      hadStockout: stockoutBuckets.has(key),
    });
  }

  return finalizeHistoricalBuckets(buckets, {
    periodCfg,
    lookbackWindow,
    invalidRecordsFiltered,
    hasTransactionCoverage,
  });
}

/**
 * Post-process chronological buckets:
 * - Trim leading pre-coverage empty tail when options dictate, or preserve full window when active
 * - Adjust zero-demand periods that occurred during confirmed stockouts so out-of-stock periods
 *   do not artificially depress the regression line.
 */
function finalizeHistoricalBuckets(
  buckets,
  { periodCfg, lookbackWindow, invalidRecordsFiltered = 0, hasTransactionCoverage = false }
) {
  const nonZeroBuckets = buckets.filter((b) => b.rawDemand > 0);
  const nonZeroMean =
    nonZeroBuckets.length > 0
      ? nonZeroBuckets.reduce((s, b) => s + b.rawDemand, 0) / nonZeroBuckets.length
      : 0;

  let stockoutAdjustedCount = 0;
  const processed = buckets.map((b) => {
    let adjustedY = b.rawDemand;
    let stockoutAdjusted = false;
    // If product was out of stock during a zero-sales period and has established demand,
    // impute with conservative trailing mean so stockouts are not mistaken for zero demand.
    if (b.hadStockout && b.rawDemand === 0 && nonZeroMean > 0) {
      adjustedY = Math.round(nonZeroMean * 100) / 100;
      stockoutAdjusted = true;
      stockoutAdjustedCount += 1;
    }
    return {
      ...b,
      y: adjustedY,
      demand: adjustedY,
      stockoutAdjusted,
    };
  });

  return {
    period: periodCfg.period,
    bucketType: periodCfg.bucketType,
    sqlTrunc: periodCfg.sqlTrunc,
    historicalWindow: lookbackWindow,
    forecastHorizon: periodCfg.forecastHorizon,
    observations: processed.length,
    nonZeroPeriods: nonZeroBuckets.length,
    totalDemand: processed.reduce((s, b) => s + b.y, 0),
    stockoutAdjustedCount,
    invalidRecordsFiltered,
    hasTransactionCoverage: hasTransactionCoverage || nonZeroBuckets.length > 0,
    periods: processed,
  };
}

/**
 * Classify inventory replenishment recommendation according to Section 12 rules:
 * - 'Insufficient historical data'
 * - 'Reorder recommended'
 * - 'Approaching reorder point'
 * - 'Monitor inventory'
 * - 'Stock sufficient'
 */
export function classifyInventoryRecommendation({
  sufficient = true,
  currentStock = 0,
  reservedStock = 0,
  incomingStock = 0,
  reorderPoint = 0,
  safetyStock = 0,
  suggestedOrderQuantity = 0,
  forecastedDemand = 0,
  trend = 'stable',
  poorFit = false,
  unusualError = false,
} = {}) {
  const onHand = Math.max(0, Number(currentStock) || 0);
  const reserved = Math.max(0, Number(reservedStock) || 0);
  const incoming = Math.max(0, Number(incomingStock) || 0);
  const inventoryPosition = Math.max(0, onHand - reserved + incoming);
  const rop = Math.max(0, Number(reorderPoint) || 0);
  const safety = Math.max(0, Number(safetyStock) || 0);
  const suggested = Math.max(0, Number(suggestedOrderQuantity) || 0);
  const forecast = Math.max(0, Number(forecastedDemand) || 0);

  if (!sufficient) {
    return {
      status: 'Insufficient historical data',
      code: 'INSUFFICIENT_DATA',
      stockStatus: 'Insufficient Data',
      belowReorderPoint: false,
      message:
        'At least two valid historical observations are required to generate a statistical replenishment recommendation.',
    };
  }

  if (onHand <= 0 || inventoryPosition <= rop) {
    return {
      status: 'Reorder recommended',
      code: 'REORDER_RECOMMENDED',
      stockStatus: onHand <= 0 || inventoryPosition <= Math.ceil(rop * 0.5) ? 'Critical Stock' : 'Low Stock',
      belowReorderPoint: true,
      message: `Inventory position (${inventoryPosition} units) is at or below the reorder point (${rop} units). Recommended purchase quantity: ${suggested} units.`,
    };
  }

  if (rop > 0 && inventoryPosition <= Math.ceil(rop * 1.25)) {
    return {
      status: 'Approaching reorder point',
      code: 'APPROACHING_REORDER_POINT',
      stockStatus: 'Low Stock',
      belowReorderPoint: false,
      message: `Inventory position (${inventoryPosition} units) is approaching the reorder point (${rop} units). Prepare supplier order of ${suggested > 0 ? suggested : Math.max(1, rop + safety - inventoryPosition)} units.`,
    };
  }

  if (suggested > 0 || trend === 'increasing' || poorFit || unusualError) {
    return {
      status: 'Monitor inventory',
      code: 'MONITOR_INVENTORY',
      stockStatus: 'Healthy Stock',
      belowReorderPoint: false,
      message:
        suggested > 0
          ? `Current stock covers immediate reorder point (${rop} units), but forecasted horizon demand (${forecast} units) suggests monitoring and planning a ${suggested}-unit replenishment.`
          : `Stock exceeds reorder point (${rop} units); monitor inventory due to ${trend === 'increasing' ? 'increasing demand trend' : 'demand variability'}.`,
    };
  }

  const isOverstocked = forecast > 0 && inventoryPosition > rop + forecast * 2 + safety;
  return {
    status: 'Stock sufficient',
    code: 'STOCK_SUFFICIENT',
    stockStatus: isOverstocked ? 'Overstocked' : 'Healthy Stock',
    belowReorderPoint: false,
    message: `Inventory position (${inventoryPosition} units) is sufficient to cover forecasted demand (${forecast} units) and safety stock (${safety} units).`,
  };
}

/**
 * Persist forecast record in PostgreSQL `forecast_history` using upsert to prevent duplicates.
 */
export async function persistForecastRecord(record, { supabaseClient = null } = {}) {
  const supabase = supabaseClient || getSupabaseAdmin();
  if (!supabase || !record?.productId) {
    return { persisted: false, reason: 'no_db_or_product' };
  }

  const periodKey =
    record.nextPeriodKey || record.forecastDates?.[0] || new Date().toISOString().slice(0, 10);
  const deterministicId = `fc-${record.productId}-${record.period}-${periodKey}`
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 96);

  const row = {
    forecast_id: record.forecastId || deterministicId,
    product_id: record.productId,
    product_name: record.productName || 'Unknown Product',
    forecast_date: record.forecastDate || new Date().toISOString().slice(0, 10),
    forecast_period: record.period,
    period_label: record.nextPeriodLabel || `${record.period} (${periodKey})`,
    period_key: periodKey,
    predicted_quantity: Number(record.predictedNextPeriodDemand ?? record.predictedHorizonDemand ?? 0),
    actual_quantity: record.actualQuantity ?? null,
    slope: record.slope != null ? Number(record.slope) : null,
    intercept: record.intercept != null ? Number(record.intercept) : null,
    r_squared: record.rSquared != null ? Number(record.rSquared) : null,
    mae: record.mae != null ? Number(record.mae) : null,
    rmse: record.rmse != null ? Number(record.rmse) : null,
    wape: record.wape != null ? Number(record.wape) : null,
    safety_stock: record.safetyStock != null ? Number(record.safetyStock) : 0,
    current_stock: record.currentStock != null ? Number(record.currentStock) : 0,
    reserved_stock: record.reservedStock != null ? Number(record.reservedStock) : 0,
    incoming_stock: record.incomingStock != null ? Number(record.incomingStock) : 0,
    reorder_point: record.reorderPoint != null ? Number(record.reorderPoint) : 0,
    recommended_restock:
      record.suggestedPurchaseQuantity != null ? Number(record.suggestedPurchaseQuantity) : 0,
    recommendation_status: record.recommendationStatus || null,
    forecast_method: ALGORITHM_NAME,
    algorithm_name: ALGORITHM_NAME,
    sufficient: Boolean(record.sufficient),
    generated_at: record.generatedAt || new Date().toISOString(),
  };

  try {
    // Base columns guaranteed by schema.sql on public.forecast_history
    const legacyRow = {
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
    };

    const { data, error } = await supabase
      .from('forecast_history')
      .upsert([row], { onConflict: 'forecast_id' })
      .select()
      .maybeSingle();

    if (!error) {
      return { persisted: true, row: data || row };
    }

    // Fallback if new columns haven't been migrated yet on remote DB (strict schema.sql base columns)
    const retry = await supabase.from('forecast_history').upsert([legacyRow], { onConflict: 'forecast_id' });
    return { persisted: !retry.error, row: legacyRow, error: retry.error?.message || null };
  } catch (err) {
    return { persisted: false, error: err?.message || String(err) };
  }
}

/**
 * Coordinate historical demand retrieval, Simple Linear Regression, future predictions,
 * chronological holdout accuracy evaluation, inventory planning, and persistence.
 *
 * @param {string} productId
 * @param {'daily'|'weekly'|'monthly'|'day'|'week'|'month'} [period='weekly']
 * @param {object} [options]
 */
export async function generateForecast(productId, period = 'weekly', options = {}) {
  const periodCfg = validateForecastPeriod(period, { strict: true });
  const cacheKey = `${productId}:${periodCfg.period}:${options.historicalWindow || ''}:${options.forecastHorizon || ''}`;

  if (!options.force && !options.transactions && !options.productContext) {
    const cached = forecastCache.get(cacheKey);
    if (cached && Date.now() - cached.at < FORECAST_CACHE_TTL_MS) {
      return cached.data;
    }
  }

  // 1. Load product & inventory context
  const productCtx =
    options.productContext ||
    (await getProductInventoryContext(productId, { supabaseClient: options.supabaseClient }));

  if (!productCtx) {
    const err = new Error(`Product "${productId}" not found.`);
    err.statusCode = 404;
    throw err;
  }

  // 2. Retrieve historical demand series for the requested frequency
  const historyResult = options.historicalData
    ? options.historicalData
    : await getHistoricalSales(productCtx.productId, periodCfg.period, options);

  const historicalPeriods = Array.isArray(historyResult.periods)
    ? historyResult.periods
    : Array.isArray(historyResult)
      ? historyResult
      : [];

  const horizon =
    Number(options.forecastHorizon ?? options.horizon) > 0
      ? Math.trunc(Number(options.forecastHorizon ?? options.horizon))
      : periodCfg.forecastHorizon;

  const regressionInput = historicalPeriods.map((p, idx) => ({
    x: Number(p.x ?? p.periodNumber ?? idx + 1),
    y: Number(p.y ?? p.demand ?? 0),
  }));

  // 3. Calculate Simple Linear Regression: Y = a + bX
  const regression = calculateLinearRegression(regressionInput);

  // Check if historical observations are sufficient
  const nonZeroCount = regressionInput.filter((p) => p.y > 0).length;
  const hasMinimumData = regression.sufficient && regression.n >= MIN_REGRESSION_PERIODS;

  // 4. Generate future demand predictions for X = n + 1 ... n + horizon
  const lastPeriod = historicalPeriods[historicalPeriods.length - 1];
  const lastBucketDate = lastPeriod?.periodStart
    ? new Date(lastPeriod.periodStart)
    : dateTruncUtc(new Date(), periodCfg.sqlTrunc);

  const futurePredictions = [];
  const forecastDates = [];

  for (let h = 1; h <= horizon; h += 1) {
    const futureX = regression.n + h;
    const futureBucketDate = addTruncPeriodsUtc(lastBucketDate, periodCfg.sqlTrunc, h);
    const isoDate = formatIsoDateUtc(futureBucketDate);
    const periodKey = formatPeriodKeyUtc(futureBucketDate, periodCfg.sqlTrunc);
    const label = formatPeriodLabelUtc(futureBucketDate, periodCfg.sqlTrunc, futureX);

    const predictedQty = hasMinimumData ? predictDemand(regression, futureX, { round: 'round' }) : 0;
    const rawPredicted = hasMinimumData ? predictDemand(regression, futureX, { round: false }) : 0;

    forecastDates.push(isoDate);
    futurePredictions.push({
      horizonStep: h,
      periodNumber: futureX,
      x: futureX,
      forecastDate: isoDate,
      periodKey,
      label,
      predictedDemand: predictedQty,
      rawPredictedDemand: Math.round(rawPredicted * 100) / 100,
      y: predictedQty,
      isForecast: true,
    });
  }

  // 5. Evaluate forecast accuracy using chronological holdout data (out-of-sample)
  const accuracy = evaluateChronologicalHoldout(regressionInput);

  // 6. Calculate Safety Stock, Reorder Point, and Suggested Purchase Quantity
  const demandSeries = regressionInput.map((p) => p.y);
  const nextPeriodPrediction = futurePredictions[0]?.predictedDemand ?? 0;
  const totalHorizonPrediction = Math.max(
    0,
    Math.round(futurePredictions.reduce((s, p) => s + (Number(p.rawPredictedDemand ?? p.y) || 0), 0))
  );

  // Daily demand rate derived from regression prediction & historical mean
  const effectivePeriodDemand = hasMinimumData ? Math.max(nextPeriodPrediction, regression.meanY) : 0;
  const averageDailyDemand = toAverageDailyDemand(effectivePeriodDemand, periodCfg.period);
  const dailyStdDev = toDailyDemandStdDev(demandStdDev(demandSeries), periodCfg.period);

  const safetyStock = hasMinimumData
    ? calculateSafetyStock({
        demandSeries,
        periodType: periodCfg.period,
        averageDailyDemand,
        demandStdDevDaily: dailyStdDev,
        leadTimeDays: productCtx.leadTimeDays,
        serviceLevelZ: options.serviceLevelZ ?? 1.65,
      })
    : 0;

  const ropResult = calculateReorderPoint({
    averageDailyDemand,
    leadTimeDays: productCtx.leadTimeDays,
    safetyStock,
  });

  const reorderPoint =
    productCtx.storedReorderPoint != null && productCtx.storedReorderPoint > 0
      ? productCtx.storedReorderPoint
      : ropResult.reorderPoint;

  // Lead-time demand from regression forecast
  const leadTimePeriods = Math.max(1, Math.ceil(productCtx.leadTimeDays / (periodCfg.daysPerPeriod || 1)));
  const forecastedLeadTimeDemand = futurePredictions
    .slice(0, leadTimePeriods)
    .reduce((s, p) => s + p.predictedDemand, 0);

  const orderQtyCalc = calculateSuggestedOrderQuantity({
    forecastedDemand: nextPeriodPrediction,
    leadTimeDemand: Math.max(ropResult.leadTimeDemand, forecastedLeadTimeDemand),
    averageDailyDemand,
    leadTimeDays: productCtx.leadTimeDays,
    safetyStock,
    reorderPoint,
    currentStock: productCtx.currentStock,
    reservedStock: productCtx.reservedStock,
    incomingStock: productCtx.incomingStock,
    orderQuantity: productCtx.orderQuantity,
  });

  const suggestedPurchaseQuantity = hasMinimumData ? orderQtyCalc.suggestedOrderQuantity : 0;

  // 7. Classify trend and inventory recommendation
  const trend = hasMinimumData ? determineTrend(regression.slope, regression.meanY) : 'insufficient';
  const recommendation = classifyInventoryRecommendation({
    sufficient: hasMinimumData,
    currentStock: productCtx.currentStock,
    reservedStock: productCtx.reservedStock,
    incomingStock: productCtx.incomingStock,
    reorderPoint,
    safetyStock,
    suggestedOrderQuantity: suggestedPurchaseQuantity,
    forecastedDemand: nextPeriodPrediction,
    trend,
    poorFit: regression.poorFit,
    unusualError: accuracy.unusualError,
  });

  // 8. Build validation warnings
  const warnings = [];
  if (!hasMinimumData) {
    warnings.push('Insufficient historical observations (minimum 2 periods required).');
  }
  if (regression.constantX) {
    warnings.push('Constant X values detected in historical series.');
  }
  if (regression.zeroDemand) {
    warnings.push('Product has zero recorded demand across the historical window.');
  }
  if (regression.poorFit && !regression.zeroDemand) {
    warnings.push(
      `Low R-squared (${regression.rSquared.toFixed(4)}): linear trend explains a limited portion of demand variance. R-squared does not guarantee future forecast accuracy.`
    );
  }
  if (accuracy.unusualError) {
    warnings.push(
      `Elevated out-of-sample forecast error detected during chronological backtesting (WAPE: ${accuracy.wape ?? 'N/A'}%).`
    );
  }
  if (historyResult.stockoutAdjustedCount > 0) {
    warnings.push(`${historyResult.stockoutAdjustedCount} period(s) were adjusted for stockout constraints.`);
  }

  const generatedAt = new Date().toISOString();

  const result = {
    success: true,
    algorithm: 'Simple Linear Regression',
    algorithmName: ALGORITHM_NAME,
    equation: regression.equation || formatRegressionEquation(regression.intercept, regression.slope),
    generatedAt,
    product: {
      productId: productCtx.productId,
      name: productCtx.name,
      sku: productCtx.sku,
      category: productCtx.category,
      brand: productCtx.brand,
      price: productCtx.price,
      unitCost: productCtx.unitCost,
      currentStock: productCtx.currentStock,
      reservedStock: productCtx.reservedStock,
      incomingStock: productCtx.incomingStock,
      availableStock: productCtx.availableStock,
      inventoryPosition: productCtx.inventoryPosition,
      reorderLevel: productCtx.reorderLevel,
      leadTimeDays: productCtx.leadTimeDays,
      orderQuantity: productCtx.orderQuantity,
      supplierId: productCtx.supplierId,
      supplierName: productCtx.supplierName,
    },
    period: periodCfg.period,
    forecastPeriod: periodCfg.period,
    historicalWindow: historyResult.historicalWindow || periodCfg.historicalWindow,
    forecastHorizon: horizon,
    historicalDemand: historicalPeriods.map((p, idx) => ({
      periodNumber: p.x ?? idx + 1,
      x: p.x ?? idx + 1,
      date: p.date,
      periodKey: p.periodKey,
      label: p.label,
      demand: p.y,
      rawDemand: p.rawDemand ?? p.y,
      fittedDemand: hasMinimumData
        ? Math.round(predictY(regression.intercept, regression.slope, p.x ?? idx + 1) * 100) / 100
        : null,
      stockoutAdjusted: Boolean(p.stockoutAdjusted),
    })),
    predictedDemand: futurePredictions,
    predictedNextPeriodDemand: nextPeriodPrediction,
    predictedHorizonDemand: totalHorizonPrediction,
    forecastDates,
    slope: regression.slope,
    intercept: regression.intercept,
    rSquared: regression.rSquared,
    regression: {
      n: regression.n,
      sumX: regression.sumX,
      sumY: regression.sumY,
      sumXY: regression.sumXY,
      sumX2: regression.sumX2,
      meanX: regression.meanX,
      meanY: regression.meanY,
      slope: regression.slope,
      intercept: regression.intercept,
      rSquared: regression.rSquared,
      equation: regression.equation,
      sufficient: hasMinimumData,
    },
    mae: accuracy.mae,
    rmse: accuracy.rmse,
    wape: accuracy.wape,
    accuracy: {
      mae: accuracy.mae,
      rmse: accuracy.rmse,
      wape: accuracy.wape,
      bias: accuracy.bias,
      sampleSize: accuracy.sampleSize,
      trainSize: accuracy.trainSize,
      holdoutSize: accuracy.holdoutSize,
      evaluationMethod: accuracy.evaluationMethod,
      unusualError: accuracy.unusualError,
    },
    safetyStock,
    reorderPoint,
    suggestedPurchaseQuantity,
    recommendedRestock: suggestedPurchaseQuantity,
    inventoryRecommendation: {
      ...recommendation,
      productId: productCtx.productId,
      productName: productCtx.name,
      currentStock: productCtx.currentStock,
      reservedStock: productCtx.reservedStock,
      incomingStock: productCtx.incomingStock,
      availableStock: productCtx.availableStock,
      inventoryPosition: productCtx.inventoryPosition,
      safetyStock,
      reorderPoint,
      leadTimeDays: productCtx.leadTimeDays,
      leadTimeDemand: Math.max(ropResult.leadTimeDemand, forecastedLeadTimeDemand),
      averageDailyDemand: ropResult.averageDailyDemand,
      suggestedOrderQuantity: suggestedPurchaseQuantity,
      suggestedPurchaseQuantity,
    },
    trend,
    trendLabel: hasMinimumData ? trendLabel(trend) : 'Insufficient Data',
    trendExplanation: hasMinimumData
      ? trendExplanation(trend)
      : 'Insufficient historical sales observations for linear trend classification.',
    validation: {
      sufficient: hasMinimumData,
      observations: regression.n,
      nonZeroObservations: nonZeroCount,
      constantX: regression.constantX,
      zeroDemand: regression.zeroDemand,
      poorFit: regression.poorFit,
      unusualError: accuracy.unusualError,
      invalidRecordsFiltered: (regression.invalidCount || 0) + (historyResult.invalidRecordsFiltered || 0),
      stockoutAdjustedCount: historyResult.stockoutAdjustedCount || 0,
      rSquaredDisclaimer:
        'R-squared measures in-sample linear fit only and is not a guarantee of future forecast accuracy; out-of-sample MAE, RMSE, and WAPE from chronological holdout validation should be used to judge predictive performance.',
      warnings,
    },
  };

  // 9. Persist forecast snapshot to PostgreSQL when enabled (default: true when using DB)
  if (options.persist !== false && !options.transactions) {
    const persistence = await persistForecastRecord(
      {
        productId: productCtx.productId,
        productName: productCtx.name,
        period: periodCfg.period,
        nextPeriodKey: futurePredictions[0]?.periodKey,
        nextPeriodLabel: futurePredictions[0]?.label,
        forecastDates,
        predictedNextPeriodDemand: nextPeriodPrediction,
        predictedHorizonDemand: totalHorizonPrediction,
        slope: regression.slope,
        intercept: regression.intercept,
        rSquared: regression.rSquared,
        mae: accuracy.mae,
        rmse: accuracy.rmse,
        wape: accuracy.wape,
        safetyStock,
        currentStock: productCtx.currentStock,
        reservedStock: productCtx.reservedStock,
        incomingStock: productCtx.incomingStock,
        reorderPoint,
        suggestedPurchaseQuantity,
        recommendationStatus: recommendation.status,
        sufficient: hasMinimumData,
        generatedAt,
      },
      { supabaseClient: options.supabaseClient }
    );
    result.persisted = persistence.persisted;
  }

  if (!options.transactions && !options.productContext) {
    forecastCache.set(cacheKey, { at: Date.now(), data: result });
  }

  return result;
}

/**
 * Generate inventory replenishment recommendation for a product based on Simple Linear Regression results.
 */
export async function generateInventoryRecommendation(productId, options = {}) {
  const period = options.period || 'weekly';
  const forecast = await generateForecast(productId, period, options);
  return {
    success: true,
    productId: forecast.product.productId,
    productName: forecast.product.name,
    sku: forecast.product.sku,
    category: forecast.product.category,
    period: forecast.period,
    recommendation: forecast.inventoryRecommendation.status,
    code: forecast.inventoryRecommendation.code,
    stockStatus: forecast.inventoryRecommendation.stockStatus,
    message: forecast.inventoryRecommendation.message,
    currentStock: forecast.product.currentStock,
    reservedStock: forecast.product.reservedStock,
    incomingStock: forecast.product.incomingStock,
    availableStock: forecast.product.availableStock,
    inventoryPosition: forecast.product.inventoryPosition,
    safetyStock: forecast.safetyStock,
    reorderPoint: forecast.reorderPoint,
    suggestedPurchaseQuantity: forecast.suggestedPurchaseQuantity,
    leadTimeDays: forecast.product.leadTimeDays,
    leadTimeDemand: forecast.inventoryRecommendation.leadTimeDemand,
    predictedNextPeriodDemand: forecast.predictedNextPeriodDemand,
    predictedHorizonDemand: forecast.predictedHorizonDemand,
    slope: forecast.slope,
    intercept: forecast.intercept,
    rSquared: forecast.rSquared,
    mae: forecast.mae,
    rmse: forecast.rmse,
    wape: forecast.wape,
    generatedAt: forecast.generatedAt,
  };
}

export function clearForecastCache() {
  forecastCache.clear();
}

export {
  MIN_REGRESSION_PERIODS,
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
};

export const backendForecastService = {
  MIN_REGRESSION_PERIODS,
  ALGORITHM_NAME,
  FORECAST_PERIOD_CONFIG,
  validateForecastPeriod,
  getHistoricalSales,
  calculateLinearRegression,
  predictDemand,
  predictY,
  calculateForecastAccuracy,
  evaluateChronologicalHoldout,
  calculateSafetyStock,
  calculateReorderPoint,
  calculateSuggestedOrderQuantity,
  generateForecast,
  generateInventoryRecommendation,
  classifyInventoryRecommendation,
  getProductInventoryContext,
  persistForecastRecord,
  clearForecastCache,
};

export default backendForecastService;
