/**
 * Loads the dashboard KPI helpers without the React Native import chain,
 * then checks them against the recognized-sales and unit-cost rules.
 * Run: node --test src/utils/__tests__/kpiFormulas.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '../../..');
const source = fs.readFileSync(
  path.join(root, 'src/services/inventory/dashboardInsightsService.js'),
  'utf8'
);
const body = source.replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?\r?\n/gm, '');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moto-kpi-'));
const helperSrc = path.join(root, 'src/utils/inventoryHelpers.js');
fs.copyFileSync(helperSrc, path.join(dir, 'inventoryHelpers.js'));
const modulePath = path.join(dir, 'kpis.mjs');
fs.writeFileSync(
  modulePath,
  `import { resolveReorderLevel, isLowStock, isOutOfStock } from './inventoryHelpers.js';
const ORDER_STATUSES = { CANCELLED: 'Cancelled', REFUNDED: 'Refunded' };
function canonicalizeStatus(status) {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'cancelled' || s === 'canceled') return ORDER_STATUSES.CANCELLED;
  if (s === 'refunded') return ORDER_STATUSES.REFUNDED;
  return status || '';
}
function getHistoricalSales() { return []; }
function generateProductForecast() { return null; }
function buildProductForecastTable() { return []; }
${body}`
);

const {
  computeInventoryKpis,
  computeWeeklyKpiSeries,
  isRecognizedSalesOrder,
  recognizedOrderAmount,
  sparklinePath,
} = await import(pathToFileURL(modulePath).href);

const products = [
  { status: 'active', stock: 200, price: 500, unit_cost: 0, reorder_level: 5 },
  { status: 'active', stock: 30, price: 800, unit_cost: 700, reorder_level: 5 },
  { status: 'active', stock: 8, price: 1000, unit_cost: 1000, reorder_level: 5 },
  { status: 'archived', stock: 50, price: 100, unit_cost: 40, reorder_level: 5 },
  { status: 'active', stock: 0, price: 100, unit_cost: 40, reorder_level: 5 },
  { status: 'active', stock: 3, price: 100, unit_cost: 40, reorder_level: 5 },
];

const orders = [
  { status: 'Delivered', grand_total: 10522, created_at: new Date().toISOString() },
  { status: 'Cancelled', grand_total: 2000, created_at: new Date().toISOString() },
  { status: 'canceled', grand_total: 50, created_at: new Date().toISOString() },
  { status: 'Refunded', grand_total: 300, created_at: new Date().toISOString() },
  { status: 'Delivered', total_amount: 10 },
];

describe('recognized sales', () => {
  it('drops cancelled and refunded orders from revenue', () => {
    const recognized = orders.filter(isRecognizedSalesOrder);
    const revenue = recognized.reduce((sum, order) => sum + recognizedOrderAmount(order), 0);
    assert.equal(recognized.length, 2);
    assert.equal(revenue, 10532);
  });
});

describe('inventory KPIs', () => {
  it('values stock at unit cost and skips archived products', () => {
    const stats = computeInventoryKpis(products);
    assert.equal(stats.totalSkus, 5);
    assert.equal(stats.outOfStockCount, 1);
    assert.equal(stats.lowStockCount, 1);
    assert.equal(stats.inStockCount, 3);
    assert.equal(stats.totalUnits, 241);
    assert.equal(stats.totalValue, 29120);
    assert.equal(stats.retailValue, 132300);
  });
});

describe('weekly series', () => {
  it('keeps dated recognized revenue and skips undated orders', () => {
    const series = computeWeeklyKpiSeries(orders, 8);
    const revenue = series.reduce((sum, bucket) => sum + bucket.revenue, 0);
    assert.equal(revenue, 10522);
    assert.equal(sparklinePath([0, 0, 0]), '');
    assert.match(sparklinePath([1, 4, 2]), /^M /);
  });
});
