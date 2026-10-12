/**
 * Dashboard insight computations from real orders / inventory.
 * Used by Admin Overview — no fabricated analytics.
 */

import { canonicalizeStatus, ORDER_STATUSES } from '../orders/orderService.js';
import { resolveReorderLevel, isLowStock, isOutOfStock } from '../../utils/inventoryHelpers.js';
import {
  getHistoricalSales,
  generateProductForecast,
  buildProductForecastTable,
} from './forecastService.js';

const EXCLUDED = new Set([ORDER_STATUSES.CANCELLED, ORDER_STATUSES.REFUNDED]);

function orderRevenue(order) {
  return Number(order?.grand_total) || Number(order?.total_amount) || 0;
}

function orderDate(order) {
  if (!order) return null;
  if (order.created_at) {
    const d = new Date(order.created_at);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (order.updated_at) {
    const d = new Date(order.updated_at);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (order.order_date) {
    const raw = String(order.order_date).trim();
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
    const lower = raw.toLowerCase();
    const now = new Date();
    if (lower.includes('today')) return now;
    if (lower.includes('yesterday')) {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return y;
    }
  }
  if (order.date) {
    const d = new Date(order.date);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const idStr = String(order.order_id || order.id || '');
  const tsMatch = idStr.match(/(?:ord-)?(\d{12,14})/);
  if (tsMatch) {
    const ts = Number(tsMatch[1]);
    const d = new Date(ts);
    if (!Number.isNaN(d.getTime()) && d.getFullYear() >= 2020 && d.getFullYear() <= 2040) {
      return d;
    }
  }
  const yrMatch = idStr.match(/(?:20\d{2})/);
  if (yrMatch) {
    return new Date(parseInt(yrMatch[0], 10), 0, 1);
  }
  return null;
}

function isValidOrder(order) {
  const status = canonicalizeStatus(order?.status);
  return !EXCLUDED.has(status);
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d, n) {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

function pctChange(current, previous, label = 'vs. previous period') {
  if (previous == null) {
    return {
      pct: null,
      direction: 'neutral',
      label,
      message: 'Not available',
      isUnavailable: true,
    };
  }

  // Both periods had zero sales
  if (previous === 0 && current === 0) {
    return {
      pct: 0,
      direction: 'neutral',
      label,
      message: label,
      noPrior: true,
    };
  }

  // Prior had 0 sales, but current has sales (>0)
  if (previous === 0 && current > 0) {
    return {
      pct: null,
      direction: 'up',
      label,
      message: 'No sales in previous period',
      isNewBaseline: true,
    };
  }

  // Prior had sales, but current is 0
  if (previous > 0 && current === 0) {
    return {
      pct: -100,
      direction: 'down',
      label,
      message: label,
    };
  }

  const diff = current - previous;
  const rawPct = (diff / previous) * 100;
  const rounded = Math.round(rawPct * 10) / 10;

  if (Math.abs(rounded) < 0.1) {
    return {
      pct: 0,
      direction: 'neutral',
      label,
      message: label,
    };
  }

  const direction = rounded > 0 ? 'up' : 'down';
  return {
    pct: rounded,
    direction,
    label,
    message: label,
  };
}

function sumRevenueInRange(orders, start, end) {
  let total = 0;
  let count = 0;
  (orders || []).forEach((o) => {
    if (!isValidOrder(o)) return;
    const d = orderDate(o);
    if (!d) return;
    if (d >= start && d < end) {
      total += orderRevenue(o);
      count += 1;
    }
  });
  return { total, count };
}

/**
 * Today's / week / month sales + AOV with period comparisons.
 */
export function computeSalesPerformance(orders = []) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayStart = addDays(todayStart, -1);
  const weekStart = addDays(todayStart, -6); // last 7 calendar days inclusive of today
  const prevWeekStart = addDays(weekStart, -7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const today = sumRevenueInRange(orders, todayStart, addDays(todayStart, 1));
  const yesterday = sumRevenueInRange(orders, yesterdayStart, todayStart);
  const thisWeek = sumRevenueInRange(orders, weekStart, addDays(todayStart, 1));
  const prevWeek = sumRevenueInRange(orders, prevWeekStart, weekStart);
  const thisMonth = sumRevenueInRange(orders, monthStart, nextMonthStart);
  const prevMonth = sumRevenueInRange(orders, prevMonthStart, monthStart);

  const allValid = (orders || []).filter(isValidOrder);
  const totalRev = allValid.reduce((s, o) => s + orderRevenue(o), 0);
  const aov = allValid.length > 0 ? totalRev / allValid.length : 0;

  // Previous-period AOV: orders before this month
  const prevOrders = allValid.filter((o) => {
    const d = orderDate(o);
    return d && d < monthStart;
  });
  const prevRev = prevOrders.reduce((s, o) => s + orderRevenue(o), 0);
  const prevAov = prevOrders.length > 0 ? prevRev / prevOrders.length : 0;

  return {
    todaySales: today.total,
    todayCompare: pctChange(today.total, yesterday.total, 'vs. yesterday'),
    weekSales: thisWeek.total,
    weekCompare: pctChange(thisWeek.total, prevWeek.total, 'vs. previous 7 days'),
    monthSales: thisMonth.total,
    monthCompare: pctChange(thisMonth.total, prevMonth.total, 'vs. previous month'),
    averageOrderValue: aov,
    aovCompare: pctChange(aov, prevAov, 'vs. previous period'),
    todayOrderCount: today.count,
    weekOrderCount: thisWeek.count,
    monthOrderCount: thisMonth.count,
    totalOrderCount: allValid.length,
  };
}

/**
 * Inventory health buckets from catalog stock levels.
 */
export function computeInventoryHealth(products = []) {
  let healthy = 0;
  let low = 0;
  let out = 0;
  let overstocked = 0;

  (products || []).forEach((p) => {
    const stock = Number(p.stock ?? p.stock_quantity ?? 0);
    const reorder = resolveReorderLevel(p, 5);
    if (stock <= 0) {
      out += 1;
      return;
    }
    if (stock <= reorder) {
      low += 1;
      return;
    }
    // Overstock: well above reorder without recent need signal
    if (stock > Math.max(reorder * 3, reorder + 15)) {
      overstocked += 1;
      return;
    }
    healthy += 1;
  });

  return {
    healthy,
    low,
    out,
    overstocked,
    total: (products || []).length,
  };
}

/**
 * Sales split Online Store vs POS Cashier.
 */
export function computeSalesByChannel(orders = []) {
  let online = 0;
  let pos = 0;
  (orders || []).forEach((o) => {
    if (!isValidOrder(o)) return;
    const rev = orderRevenue(o);
    const ch = String(o.channel || '').toLowerCase();
    if (ch.includes('pos') || ch.includes('in-store') || ch.includes('walk-in')) {
      pos += rev;
    } else {
      online += rev;
    }
  });
  const total = online + pos;
  return {
    online,
    pos,
    total,
    onlinePct: total > 0 ? Math.round((online / total) * 100) : 0,
    posPct: total > 0 ? Math.round((pos / total) * 100) : 0,
  };
}

/**
 * Best-selling and slow-moving products from real order line items.
 */
export function computeProductPerformance(orders = [], products = [], { topLimit = 5, slowLimit = 5 } = {}) {
  const productSales = {};
  (orders || []).forEach((o) => {
    if (!isValidOrder(o)) return;
    (Array.isArray(o.items) ? o.items : []).forEach((it) => {
      const name = (it.name || '').trim();
      if (!name || name === 'Motorcycle Part') return;
      const key = name.toLowerCase();
      if (!productSales[key]) {
        productSales[key] = {
          name,
          brand: it.brand || 'MotoTrack',
          productId: it.product_id || it.id || null,
          unitsSold: 0,
          revenue: 0,
        };
      }
      const qty = Number(it.quantity) || 1;
      productSales[key].unitsSold += qty;
      productSales[key].revenue += (Number(it.price) || 0) * qty;
      if (!productSales[key].productId && (it.product_id || it.id)) {
        productSales[key].productId = it.product_id || it.id;
      }
    });
  });

  const sold = Object.values(productSales).sort((a, b) => b.revenue - a.revenue);
  const bestSelling = sold.slice(0, topLimit).map((tp) => {
    const match = (products || []).find(
      (p) =>
        String(p.id) === String(tp.productId) ||
        String(p.product_id) === String(tp.productId) ||
        String(p.name || '').trim().toLowerCase() === tp.name.toLowerCase()
    );
    return {
      ...tp,
      productId: match?.id || match?.product_id || tp.productId,
      image_url: match?.image_url || match?.image || null,
      stock: match ? Number(match.stock) || 0 : null,
    };
  });

  // Slow-moving: catalog products with lowest units sold (including zero)
  const soldById = new Map();
  sold.forEach((s) => {
    if (s.productId) soldById.set(String(s.productId), s);
    soldById.set(s.name.toLowerCase(), s);
  });

  const slowCandidates = (products || [])
    .map((p) => {
      const id = String(p.id || p.product_id || '');
      const byId = soldById.get(id);
      const byName = soldById.get(String(p.name || '').trim().toLowerCase());
      const hit = byId || byName;
      return {
        name: p.name,
        brand: p.brand || 'MotoTrack',
        productId: p.id || p.product_id,
        unitsSold: hit?.unitsSold || 0,
        revenue: hit?.revenue || 0,
        stock: Number(p.stock) || 0,
        image_url: p.image_url || p.image || null,
      };
    })
    .filter((p) => p.name)
    .sort((a, b) => a.unitsSold - b.unitsSold || a.revenue - b.revenue);

  // Prefer items that have stock but aren't selling
  const slowMoving = slowCandidates
    .filter((p) => p.unitsSold <= 2)
    .slice(0, slowLimit);

  return { bestSelling, slowMoving };
}

/**
 * Action-required items for the admin (deduplicated, navigable).
 */
export function computeActionRequired({
  products = [],
  orders = [],
  pendingCodCount = 0,
  restockRecommendations = [],
} = {}) {
  const items = [];
  const outProducts = (products || []).filter(isOutOfStock);
  const lowProducts = (products || []).filter((p) => isLowStock(p, 5));

  if (outProducts.length > 0) {
    items.push({
      id: 'out-of-stock',
      severity: 'critical',
      color: '#DC2626',
      title: `${outProducts.length} product${outProducts.length === 1 ? '' : 's'} ${outProducts.length === 1 ? 'is' : 'are'} out of stock`,
      actionLabel: 'Review inventory →',
      nav: 'inventory',
      filter: 'outOfStock',
    });
  }

  if (lowProducts.length > 0) {
    items.push({
      id: 'below-reorder',
      severity: 'warning',
      color: '#D97706',
      title: `${lowProducts.length} product${lowProducts.length === 1 ? '' : 's'} ${lowProducts.length === 1 ? 'is' : 'are'} below reorder point`,
      actionLabel: 'Review stock →',
      nav: 'inventory',
      filter: 'lowStock',
    });
  }

  if (pendingCodCount > 0) {
    items.push({
      id: 'pending-cod',
      severity: 'attention',
      color: '#CA8A04',
      title: `${pendingCodCount} COD order${pendingCodCount === 1 ? '' : 's'} require${pendingCodCount === 1 ? 's' : ''} approval`,
      actionLabel: 'Review orders →',
      nav: 'orders',
      filter: 'Pending Approval',
    });
  }

  const attentionOrders = (orders || []).filter((o) => {
    const s = String(o.status || '').toLowerCase();
    return (
      s.includes('attention') ||
      s.includes('failed') ||
      s.includes('exception') ||
      s === 'on hold' ||
      s === 'hold'
    );
  });
  if (attentionOrders.length > 0) {
    items.push({
      id: 'orders-attention',
      severity: 'attention',
      color: '#CA8A04',
      title: `${attentionOrders.length} order${attentionOrders.length === 1 ? '' : 's'} require${attentionOrders.length === 1 ? 's' : ''} attention`,
      actionLabel: 'Review orders →',
      nav: 'orders',
    });
  }

  const restockCount = (restockRecommendations || []).length;
  if (restockCount > 0) {
    const firstId = restockRecommendations[0]?.productId || null;
    items.push({
      id: 'restock-forecast',
      severity: 'info',
      color: '#059669',
      title: `${restockCount} product${restockCount === 1 ? '' : 's'} ${restockCount === 1 ? 'has' : 'have'} restock recommendations`,
      actionLabel: 'View forecast →',
      nav: 'forecast',
      productId: firstId,
    });
  }

  return items;
}

/**
 * Products that need restock per forecast engine (for dashboard + deep-link).
 */
export function computeRestockRecommendations(orders = [], products = [], { limit = 12 } = {}) {
  const salesRows = getHistoricalSales(orders, products);
  const table = buildProductForecastTable({
    products,
    salesRows,
    periodType: 'week',
    lookbackPeriods: 12,
    forecastAhead: 1,
    safetyConfig: { mode: 'absolute', value: 5 },
    limit: 80,
  });
  return (table || [])
    .filter((r) => !r.insufficient && Number(r.recommendedRestock) > 0)
    .sort((a, b) => Number(b.recommendedRestock) - Number(a.recommendedRestock))
    .slice(0, limit);
}

/**
 * Real weekly sparkline points from orders (replaces hardcoded SVG paths).
 */
export function computeRevenueSparkline(orders = [], weeks = 12) {
  const weekBuckets = new Map();
  const now = new Date();
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i * 7));
    const day = d.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + diff);
    const key = `${d.getUTCFullYear()}-W${String(
      Math.floor((d - new Date(Date.UTC(d.getUTCFullYear(), 0, 1))) / (7 * 24 * 60 * 60 * 1000)) + 1
    ).padStart(2, '0')}`;
    weekBuckets.set(key, 0);
  }
  (orders || []).forEach((o) => {
    if (!isValidOrder(o)) return;
    const d = orderDate(o);
    if (!d) return;
    const day = d.getUTCDay();
    const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const diff = day === 0 ? -6 : 1 - day;
    monday.setUTCDate(monday.getUTCDate() + diff);
    const key = `${monday.getUTCFullYear()}-W${String(
      Math.floor(
        (monday - new Date(Date.UTC(monday.getUTCFullYear(), 0, 1))) / (7 * 24 * 60 * 60 * 1000)
      ) + 1
    ).padStart(2, '0')}`;
    if (!weekBuckets.has(key)) return;
    weekBuckets.set(key, (weekBuckets.get(key) || 0) + orderRevenue(o));
  });
  const bars = Array.from(weekBuckets.values());
  const max = Math.max(...bars, 1);
  return { bars, max, hasData: bars.some((v) => v > 0) };
}

/**
 * Preferred supplier summary for a product restock recommendation.
 */
export function resolvePreferredSupplier(product, suppliers = []) {
  if (!product) return null;
  const sid = product.supplier_id || product.supplierId;
  let match = null;
  if (sid) {
    match = (suppliers || []).find(
      (s) => String(s.id) === String(sid) || String(s.supplier_id) === String(sid)
    );
  }
  if (!match && product.supplier_name) {
    match = (suppliers || []).find(
      (s) =>
        String(s.name || '').toLowerCase() === String(product.supplier_name).toLowerCase()
    );
  }
  if (!match) {
    const cat = String(product.category || '').toLowerCase();
    match = (suppliers || []).find((s) => {
      const cats = Array.isArray(s.categories) ? s.categories : [];
      return cats.some((c) => String(c).toLowerCase() === cat);
    });
  }
  if (!match) return null;
  const lead =
    product.lead_time_days ??
    product.leadTimeDays ??
    parseLeadTimeDays(match.lead_time) ??
    3;
  return {
    id: match.id || match.supplier_id,
    name: match.name || 'Supplier',
    leadTimeDays: lead,
    leadTimeLabel: match.lead_time || `${lead} days`,
  };
}

function parseLeadTimeDays(text) {
  if (text == null) return null;
  if (typeof text === 'number' && Number.isFinite(text)) return text;
  const m = String(text).match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

/**
 * Aggregate sales trend by Daily, Weekly, or Monthly granularity from real orders.
 */
export function aggregateSalesTrend(orders = [], granularity = 'daily') {
  const validOrders = (orders || []).filter(isValidOrder);
  const now = new Date();
  const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (granularity === 'daily') {
    const days = 14;
    const buckets = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const label = `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
      const fullLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      buckets.push({ key, label, fullLabel, date: d, revenue: 0, ordersCount: 0 });
    }
    validOrders.forEach((o) => {
      const d = orderDate(o);
      if (!d) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const b = buckets.find((x) => x.key === key);
      if (b) {
        b.revenue += orderRevenue(o);
        b.ordersCount += 1;
      }
    });
    return buckets;
  }

  if (granularity === 'weekly') {
    const weeks = 8;
    const buckets = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7);
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
      const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
      const key = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
      const label = `${SHORT_MONTHS[monday.getMonth()]} ${monday.getDate()}`;
      const fullLabel = `${SHORT_MONTHS[monday.getMonth()]} ${monday.getDate()} - ${SHORT_MONTHS[sunday.getMonth()]} ${sunday.getDate()}`;
      buckets.push({ key, monday, sunday, label, fullLabel, revenue: 0, ordersCount: 0 });
    }
    validOrders.forEach((o) => {
      const d = orderDate(o);
      if (!d) return;
      for (const b of buckets) {
        const start = new Date(b.monday.getFullYear(), b.monday.getMonth(), b.monday.getDate(), 0, 0, 0);
        const end = new Date(b.sunday.getFullYear(), b.sunday.getMonth(), b.sunday.getDate(), 23, 59, 59, 999);
        if (d >= start && d <= end) {
          b.revenue += orderRevenue(o);
          b.ordersCount += 1;
          break;
        }
      }
    });
    return buckets;
  }

  if (granularity === 'monthly') {
    const months = 6;
    const buckets = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${SHORT_MONTHS[d.getMonth()]}`;
      const fullLabel = `${SHORT_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      buckets.push({ key, year: d.getFullYear(), month: d.getMonth(), label, fullLabel, revenue: 0, ordersCount: 0 });
    }
    validOrders.forEach((o) => {
      const d = orderDate(o);
      if (!d) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const b = buckets.find((x) => x.key === key);
      if (b) {
        b.revenue += orderRevenue(o);
        b.ordersCount += 1;
      }
    });
    return buckets;
  }

  return [];
}

/**
 * Full overview insights bundle.
 */
export function buildDashboardInsights({
  orders = [],
  products = [],
  pendingCodCount = 0,
} = {}) {
  const salesPerformance = computeSalesPerformance(orders);
  const inventoryHealth = computeInventoryHealth(products);
  const salesByChannel = computeSalesByChannel(orders);
  const productPerformance = computeProductPerformance(orders, products);
  const restockRecommendations = computeRestockRecommendations(orders, products);
  const actionRequired = computeActionRequired({
    products,
    orders,
    pendingCodCount,
    restockRecommendations,
  });
  const sparkline = computeRevenueSparkline(orders);

  // Period trend for revenue banner (last 4 weeks vs prior 4)
  const bars = sparkline.bars || [];
  let periodTrend = { pct: 0, direction: 'flat', label: 'this period' };
  if (bars.length >= 8) {
    const recent = bars.slice(-4).reduce((a, b) => a + b, 0);
    const prior = bars.slice(-8, -4).reduce((a, b) => a + b, 0);
    periodTrend = { ...pctChange(recent, prior), label: 'vs prior 4 weeks' };
  } else if (bars.length >= 2) {
    const mid = Math.floor(bars.length / 2);
    const recent = bars.slice(mid).reduce((a, b) => a + b, 0);
    const prior = bars.slice(0, mid).reduce((a, b) => a + b, 0);
    periodTrend = { ...pctChange(recent, prior), label: 'vs earlier period' };
  }

  const revenueTrends = {
    daily: aggregateSalesTrend(orders, 'daily'),
    weekly: aggregateSalesTrend(orders, 'weekly'),
    monthly: aggregateSalesTrend(orders, 'monthly'),
  };

  return {
    salesPerformance,
    inventoryHealth,
    salesByChannel,
    productPerformance,
    restockRecommendations,
    actionRequired,
    sparkline,
    periodTrend,
    revenueTrends,
    orders,
  };
}

/** Convenience: single-product forecast for deep-link focus */
export function previewProductForecast(orders, products, productId) {
  const product = (products || []).find(
    (p) => String(p.id) === String(productId) || String(p.product_id) === String(productId)
  );
  if (!product) return null;
  const salesRows = getHistoricalSales(orders, products);
  return generateProductForecast({ salesRows, product });
}

export default {
  computeSalesPerformance,
  computeInventoryHealth,
  computeSalesByChannel,
  computeProductPerformance,
  computeActionRequired,
  computeRestockRecommendations,
  computeRevenueSparkline,
  aggregateSalesTrend,
  resolvePreferredSupplier,
  buildDashboardInsights,
  previewProductForecast,
};
