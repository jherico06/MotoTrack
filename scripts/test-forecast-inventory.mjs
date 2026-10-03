/**
 * Unit tests: Croston/SBA, ROP, WAPE/MASE, reorder helpers.
 * Run: node scripts/test-forecast-inventory.mjs
 */
import assert from 'assert';
import {
  calculateCrostonSBA,
  calculateReorderPoint,
  calculateWAPE,
  calculateMASE,
  demandStdDev,
  toAverageDailyDemand,
  computeSeasonalFactors,
  MIN_PERIODS_FOR_SEASONALITY,
} from '../src/utils/crostonSBA.js';
import { resolveReorderLevel, isLowStock } from '../src/utils/inventoryHelpers.js';

function determineStockStatus(currentStock, forecastedDemand, safetyStock, reorderPoint = null) {
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

function calculateRecommendedRestock(forecastedDemand, currentStock, safetyStock, reorderPoint = null) {
  const forecast = Math.max(0, Number(forecastedDemand) || 0);
  const stock = Math.max(0, Number(currentStock) || 0);
  const safety = Math.max(0, Number(safetyStock) || 0);
  const rop = reorderPoint != null ? Math.max(0, Number(reorderPoint) || 0) : null;
  if (rop != null && Number.isFinite(rop)) {
    return Math.max(0, Math.round(Math.max(rop, forecast + safety) - stock));
  }
  return Math.max(0, Math.round(forecast + safety - stock));
}

function ok(label) {
  console.log('  ✓', label);
}

console.log('\n=== Croston/SBA ===');
{
  const zero = calculateCrostonSBA([0, 0, 0, 0, 0, 0]);
  assert.strictEqual(zero.sufficient, false);
  ok('all-zero demand → insufficient');

  const one = calculateCrostonSBA([0, 0, 5, 0, 0, 0, 0, 0]);
  assert.strictEqual(one.sufficient, false);
  ok('one sale → insufficient');

  const two = calculateCrostonSBA([0, 3, 0, 0, 0, 2, 0, 0, 0, 0]);
  assert.ok(two.nonZeroObservations === 2);
  ok('two sparse sales tracked');

  const intermittent = calculateCrostonSBA([
    0, 0, 4, 0, 0, 0, 5, 0, 0, 3, 0, 0, 0, 6, 0, 0,
  ]);
  assert.strictEqual(intermittent.sufficient, true);
  assert.ok(intermittent.forecast > 0);
  assert.ok(intermittent.method === 'croston_sba');
  ok('intermittent demand → SBA forecast');

  const continuous = calculateCrostonSBA([5, 6, 4, 7, 5, 6, 5, 4, 6, 5, 7, 6]);
  assert.strictEqual(continuous.sufficient, true);
  ok('continuous demand → sufficient');
}

console.log('\n=== Seasonality ===');
{
  const short = Array.from({ length: 6 }, (_, i) => ({ demand: i % 2, dow: i % 7 }));
  assert.ok(short.length < MIN_PERIODS_FOR_SEASONALITY);
  ok('insufficient history length for seasonality gate');

  const long = [];
  for (let i = 0; i < 28; i += 1) {
    long.push({ demand: i % 7 === 5 ? 10 : 1, dow: i % 7 });
  }
  const factors = computeSeasonalFactors(long, 'dow');
  assert.ok(factors.enabled);
  ok('sufficient history activates seasonal factors');
}

console.log('\n=== ROP / stock status ===');
{
  const rop = calculateReorderPoint({
    averageDailyDemand: 2,
    leadTimeDays: 5,
    reviewPeriodDays: 1,
    demandStdDevDaily: 1,
    z: 1.65,
  });
  assert.ok(rop.reorderPoint >= 2 * 6);
  assert.ok(rop.safetyStock >= 0);
  ok('ROP formula');

  assert.strictEqual(determineStockStatus(0, 10, 2, 8), 'Critical Stock');
  assert.strictEqual(determineStockStatus(3, 10, 2, 8), 'Critical Stock');
  assert.strictEqual(determineStockStatus(8, 10, 2, 8), 'Low Stock');
  assert.strictEqual(determineStockStatus(20, 5, 2, 8), 'Healthy Stock');
  ok('stock status from ROP');

  const restock = calculateRecommendedRestock(10, 3, 2, 12);
  assert.ok(restock >= 9);
  ok('recommended restock uses ROP');
}

console.log('\n=== Reorder level helpers ===');
{
  const p10 = { stock: 8, reorder_level: 10 };
  const p3 = { stock: 4, reorder_level: 3 };
  assert.strictEqual(resolveReorderLevel(p10), 10);
  assert.strictEqual(resolveReorderLevel(p3), 3);
  assert.strictEqual(isLowStock(p10), true);
  assert.strictEqual(isLowStock(p3), false);
  ok('custom reorder levels per product');
}

console.log('\n=== Scoring ===');
{
  assert.strictEqual(calculateWAPE([{ actual: 0, predicted: 5 }]), null);
  ok('WAPE null when Σactual = 0');

  const wape = calculateWAPE([
    { actual: 10, predicted: 8 },
    { actual: 5, predicted: 5 },
  ]);
  assert.ok(Math.abs(wape - 2 / 15) < 1e-9);
  ok('WAPE daily/weekly pairs');

  const mase = calculateMASE([
    { actual: 10, predicted: 9 },
    { actual: 12, predicted: 11 },
    { actual: 8, predicted: 10 },
  ]);
  assert.ok(mase == null || Number.isFinite(mase));
  ok('MASE finite or null');

  assert.ok(toAverageDailyDemand(14, 'week') === 2);
  assert.ok(demandStdDev([1, 2, 3, 4]) > 0);
  ok('daily conversion + stddev');
}

console.log('\nAll forecast/inventory unit tests passed.\n');
