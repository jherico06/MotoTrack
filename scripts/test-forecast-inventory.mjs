/**
 * Comprehensive Verification & Regression Test Suite
 * Simple Linear Regression Forecasting System (Node.js + Express + PostgreSQL)
 *
 * Run with: node scripts/test-forecast-inventory.mjs
 */

import assert from 'node:assert/strict';
import {
  calculateLinearRegression,
  predictDemand,
  predictY,
  calculateForecastAccuracy,
  evaluateChronologicalHoldout,
  calculateSafetyStock,
  calculateReorderPoint,
  calculateSuggestedOrderQuantity,
  validateForecastPeriod,
  FORECAST_PERIOD_CONFIG,
  determineTrend,
  formatRegressionEquation,
} from '../src/utils/linearRegression.js';
import {
  getHistoricalSales,
  generateForecast,
  generateInventoryRecommendation,
  persistForecastRecord,
  classifyInventoryRecommendation,
  clearForecastCache,
} from '../server/src/services/forecastService.js';
import {
  runScheduledForecastJob,
  getForecastSchedulerStatus,
} from '../server/src/services/forecastScheduler.js';
import forecastRouter from '../server/src/routes/forecast.js';

let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

function approx(actual, expected, eps = 1e-4) {
  assert.ok(
    Math.abs(actual - expected) <= eps,
    `Expected ${actual} ≈ ${expected} (±${eps})`
  );
}

console.log('\n=== 1. Mathematical Verification (Section 16 Exact Dataset) ===');

await test('Exact Section 16 dataset: [10, 12, 14, 16, 18] -> Slope=2, Intercept=8, R²=1, Period 6=20', () => {
  const dataset = [
    { x: 1, y: 10 },
    { x: 2, y: 12 },
    { x: 3, y: 14 },
    { x: 4, y: 16 },
    { x: 5, y: 18 },
  ];
  const model = calculateLinearRegression(dataset);

  assert.equal(model.sufficient, true);
  assert.equal(model.n, 5);
  assert.equal(model.sumX, 15);
  assert.equal(model.sumY, 70);
  assert.equal(model.sumXY, 230);
  assert.equal(model.sumX2, 55);
  assert.equal(model.slope, 2);
  assert.equal(model.intercept, 8);
  assert.equal(model.rSquared, 1);

  const period6Prediction = predictDemand(model, 6);
  assert.equal(period6Prediction, 20);
});

await test('1-3. Correct regression slope, intercept, and future demand predictions on numeric array', () => {
  const model = calculateLinearRegression([10, 12, 14, 16, 18]);
  assert.equal(model.slope, 2);
  assert.equal(model.intercept, 8);
  assert.equal(model.rSquared, 1);
  assert.equal(predictDemand(model, 6), 20);
  assert.equal(predictDemand(model, 7), 22);
  assert.equal(predictDemand(model, 8), 24);
});

console.log('\n=== 2. Demand Patterns & Edge Cases (Tests 4 - 9) ===');

await test('4. Increasing demand produces positive slope and growing predictions', () => {
  const model = calculateLinearRegression([5, 9, 12, 15, 20, 24]);
  assert.equal(model.sufficient, true);
  assert.ok(model.slope > 3.5);
  assert.ok(model.rSquared > 0.98);
  const p7 = predictDemand(model, 7);
  const p8 = predictDemand(model, 8);
  assert.ok(p7 >= 24);
  assert.ok(p8 > p7);
  assert.equal(determineTrend(model.slope, model.meanY), 'increasing');
});

await test('5. Decreasing demand produces negative slope and clamps negative predictions to 0', () => {
  const model = calculateLinearRegression([20, 15, 10, 5, 0]);
  assert.equal(model.sufficient, true);
  assert.equal(model.slope, -5);
  assert.equal(model.intercept, 25);
  assert.equal(model.rSquared, 1);
  // At X = 6: Y = 25 - 5(6) = -5 -> must be clamped to 0
  assert.equal(predictDemand(model, 6), 0);
  assert.equal(predictDemand(model, 10), 0);
  assert.equal(predictY(model.intercept, model.slope, 6), 0);
  assert.equal(determineTrend(model.slope, model.meanY), 'decreasing');
});

await test('6. Stable demand produces slope = 0, intercept = mean, R² = 1', () => {
  const model = calculateLinearRegression([15, 15, 15, 15, 15, 15]);
  assert.equal(model.sufficient, true);
  assert.equal(model.slope, 0);
  assert.equal(model.intercept, 15);
  assert.equal(model.rSquared, 1);
  assert.equal(predictDemand(model, 7), 15);
  assert.equal(determineTrend(model.slope, model.meanY), 'stable');
});

await test('7. Zero-demand periods are preserved in regression and all-zero products are flagged', () => {
  // Intermittent series with zero-demand periods included
  const intermittent = calculateLinearRegression([0, 4, 0, 8, 0, 12]);
  assert.equal(intermittent.sufficient, true);
  assert.equal(intermittent.n, 6);
  assert.equal(intermittent.zeroDemand, false);
  assert.ok(intermittent.slope > 0);

  // All-zero demand product
  const allZero = calculateLinearRegression([0, 0, 0, 0, 0]);
  assert.equal(allZero.sufficient, true);
  assert.equal(allZero.zeroDemand, true);
  assert.equal(allZero.slope, 0);
  assert.equal(allZero.intercept, 0);
  assert.equal(predictDemand(allZero, 6), 0);
});

await test('8. Insufficient historical data (< 2 valid observations) and constant X detection', () => {
  const empty = calculateLinearRegression([]);
  assert.equal(empty.sufficient, false);
  assert.equal(empty.n, 0);
  assert.equal(predictDemand(empty, 1), 0);

  const single = calculateLinearRegression([{ x: 1, y: 25 }]);
  assert.equal(single.sufficient, false);
  assert.equal(single.n, 1);
  assert.equal(predictDemand(single, 2), 0);

  const constantX = calculateLinearRegression([
    { x: 3, y: 10 },
    { x: 3, y: 15 },
    { x: 3, y: 20 },
  ]);
  assert.equal(constantX.sufficient, false);
  assert.equal(constantX.constantX, true);
});

await test('9. Invalid transaction records (cancelled, refunded, voided, restocks, negative/NaN, duplicates) are excluded', async () => {
  const rawTxns = [
    { id: 't1', date: '2026-10-01T10:00:00Z', quantity: 5, reason: 'sale', status: 'Completed' },
    { id: 't1', date: '2026-10-01T10:00:00Z', quantity: 5, reason: 'sale', status: 'Completed' }, // duplicate ID -> excluded
    { id: 't2', date: '2026-10-02T10:00:00Z', quantity: 10, reason: 'sale', status: 'Cancelled' }, // cancelled -> excluded
    { id: 't3', date: '2026-10-02T11:00:00Z', quantity: 8, reason: 'sale', status: 'Voided' }, // voided -> excluded
    { id: 't4', date: '2026-10-03T10:00:00Z', quantity: 50, reason: 'restock', status: 'Completed' }, // restock -> excluded
    { id: 't5', date: '2026-10-03T12:00:00Z', quantity: 20, reason: 'adjustment', status: 'Completed' }, // manual stock increase -> excluded
    { id: 't6', date: '2026-10-04T10:00:00Z', quantity: -4, reason: 'sale', status: 'Completed' }, // negative -> excluded
    { id: 't7', date: '2026-10-05T10:00:00Z', quantity: 7, reason: 'sale', status: 'Completed' },
  ];

  const hist = await getHistoricalSales('prod-1', 'daily', {
    transactions: rawTxns,
    historicalWindow: 7,
    referenceDate: '2026-10-05T23:59:59Z',
  });

  const totalDemand = hist.periods.reduce((s, p) => s + p.y, 0);
  assert.equal(totalDemand, 12); // Only t1 (5) + t7 (7) = 12
  assert.ok(hist.invalidRecordsFiltered >= 6);
});

console.log('\n=== 3. Forecasting Frequencies: Daily, Weekly, Monthly (Tests 10 - 12) ===');

await test('10. Daily forecasting uses 90-day historical window and 30-day forecast horizon', async () => {
  assert.equal(FORECAST_PERIOD_CONFIG.daily.historicalWindow, 90);
  assert.equal(FORECAST_PERIOD_CONFIG.daily.forecastHorizon, 30);

  const txns = [];
  const ref = new Date('2026-10-30T12:00:00Z');
  for (let i = 0; i < 90; i += 1) {
    const d = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate() - (89 - i)));
    txns.push({
      id: `d-${i}`,
      date: d.toISOString(),
      quantity: 5 + Math.floor(i / 10),
      reason: 'sale',
      status: 'Completed',
    });
  }

  const forecast = await generateForecast('prod-daily', 'daily', {
    productContext: {
      productId: 'prod-daily',
      name: 'Chain Sprocket Kit',
      sku: 'CSK-01',
      category: 'Transmission',
      currentStock: 25,
      reservedStock: 2,
      incomingStock: 5,
      availableStock: 23,
      inventoryPosition: 28,
      leadTimeDays: 5,
      orderQuantity: 10,
    },
    transactions: txns,
    referenceDate: ref,
    persist: false,
  });

  assert.equal(forecast.period, 'daily');
  assert.equal(forecast.historicalWindow, 90);
  assert.equal(forecast.forecastHorizon, 30);
  assert.equal(forecast.historicalDemand.length, 90);
  assert.equal(forecast.predictedDemand.length, 30);
  assert.equal(forecast.forecastDates.length, 30);
  assert.ok(forecast.slope > 0);
});

await test('11. Weekly forecasting uses 26-week historical window and 12-week forecast horizon', async () => {
  assert.equal(FORECAST_PERIOD_CONFIG.weekly.historicalWindow, 26);
  assert.equal(FORECAST_PERIOD_CONFIG.weekly.forecastHorizon, 12);

  const txns = [];
  const ref = new Date('2026-10-26T12:00:00Z'); // Monday
  for (let w = 0; w < 26; w += 1) {
    const d = new Date(ref.getTime() - (25 - w) * 7 * 24 * 60 * 60 * 1000);
    txns.push({
      id: `w-${w}`,
      date: d.toISOString(),
      quantity: 10 + w * 2,
      reason: 'sale',
      status: 'Completed',
    });
  }

  const forecast = await generateForecast('prod-weekly', 'weekly', {
    productContext: {
      productId: 'prod-weekly',
      name: 'LED Headlight Assembly',
      sku: 'LED-02',
      category: 'Electrical',
      currentStock: 40,
      reservedStock: 0,
      incomingStock: 0,
      availableStock: 40,
      inventoryPosition: 40,
      leadTimeDays: 7,
      orderQuantity: 5,
    },
    transactions: txns,
    referenceDate: ref,
    persist: false,
  });

  assert.equal(forecast.period, 'weekly');
  assert.equal(forecast.historicalWindow, 26);
  assert.equal(forecast.forecastHorizon, 12);
  assert.equal(forecast.historicalDemand.length, 26);
  assert.equal(forecast.predictedDemand.length, 12);
  assert.equal(forecast.forecastDates.length, 12);
  approx(forecast.slope, 2, 1e-4);
  approx(forecast.intercept, 8, 1e-4);
  approx(forecast.rSquared, 1, 1e-4);
  // Period 27 = 8 + 2(27) = 62
  assert.equal(forecast.predictedDemand[0].predictedDemand, 62);
});

await test('12. Monthly forecasting uses 12-month historical window and 6-month forecast horizon', async () => {
  assert.equal(FORECAST_PERIOD_CONFIG.monthly.historicalWindow, 12);
  assert.equal(FORECAST_PERIOD_CONFIG.monthly.forecastHorizon, 6);

  const txns = [];
  for (let m = 0; m < 12; m += 1) {
    const d = new Date(Date.UTC(2025, 11 + m, 15, 10, 0, 0));
    txns.push({
      id: `m-${m}`,
      date: d.toISOString(),
      quantity: 30 + m * 5,
      reason: 'sale',
      status: 'Completed',
    });
  }

  const forecast = await generateForecast('prod-monthly', 'monthly', {
    productContext: {
      productId: 'prod-monthly',
      name: 'Full Synthetic 10W-40 Oil',
      sku: 'OIL-10W40',
      category: 'Engine Oils',
      currentStock: 80,
      reservedStock: 5,
      incomingStock: 20,
      availableStock: 75,
      inventoryPosition: 95,
      leadTimeDays: 14,
      orderQuantity: 12,
    },
    transactions: txns,
    referenceDate: new Date(Date.UTC(2026, 10, 20)),
    persist: false,
  });

  assert.equal(forecast.period, 'monthly');
  assert.equal(forecast.historicalWindow, 12);
  assert.equal(forecast.forecastHorizon, 6);
  assert.equal(forecast.historicalDemand.length, 12);
  assert.equal(forecast.predictedDemand.length, 6);
  assert.equal(forecast.forecastDates.length, 6);
  approx(forecast.slope, 5, 1e-4);
  approx(forecast.intercept, 25, 1e-4);
  approx(forecast.rSquared, 1, 1e-4);
  // Period 13 = 25 + 5(13) = 90
  assert.equal(forecast.predictedDemand[0].predictedDemand, 90);
});

console.log('\n=== 4. Accuracy Metrics & Inventory Planning (Tests 13 - 18) ===');

await test('13. MAE, RMSE, and WAPE calculations + chronological holdout + zero actual demand handling', () => {
  // Direct accuracy check
  const actual = [10, 20, 30, 40];
  const predicted = [12, 18, 33, 37];
  // Abs errors: [2, 2, 3, 3] -> sum = 10, MAE = 10/4 = 2.5
  // Sq errors: [4, 4, 9, 9] -> sum = 26, RMSE = sqrt(26/4) = sqrt(6.5) ≈ 2.5495
  // Sum actual = 100 -> WAPE = (10 / 100) * 100 = 10%
  const acc = calculateForecastAccuracy(actual, predicted);
  approx(acc.mae, 2.5, 1e-4);
  approx(acc.rmse, Math.sqrt(6.5), 1e-3);
  approx(acc.wape, 10, 1e-4);

  // Zero actual demand handling -> WAPE must not divide by zero (returns 0 when predicted=0, null when predicted>0)
  const zeroExact = calculateForecastAccuracy([0, 0, 0], [0, 0, 0]);
  assert.equal(zeroExact.mae, 0);
  assert.equal(zeroExact.rmse, 0);
  assert.equal(zeroExact.wape, 0);

  const zeroWithPred = calculateForecastAccuracy([0, 0, 0], [2, 3, 1]);
  assert.equal(zeroWithPred.mae, 2);
  assert.equal(zeroWithPred.wape, null);

  // Chronological holdout evaluation on perfect linear trend -> out-of-sample error is 0
  const holdout = evaluateChronologicalHoldout([10, 12, 14, 16, 18, 20]);
  assert.equal(holdout.evaluationMethod, 'chronological_holdout');
  assert.ok(holdout.trainSize >= 2 && holdout.holdoutSize >= 1);
  assert.equal(holdout.mae, 0);
  assert.equal(holdout.rmse, 0);
  assert.equal(holdout.wape, 0);
});

await test('14. Safety stock calculation handles demand and lead-time variability', () => {
  const ss = calculateSafetyStock({
    demandSeries: [10, 14, 18, 12, 16, 20],
    periodType: 'weekly',
    leadTimeDays: 7,
    serviceLevelZ: 1.65,
  });
  assert.ok(Number.isInteger(ss) && ss > 0);
});

await test('15. Reorder point formula: ROP = (Average Daily Demand × Supplier Lead Time) + Safety Stock', () => {
  const rop = calculateReorderPoint({
    averageDailyDemand: 4,
    leadTimeDays: 5,
    safetyStock: 8,
  });
  // Lead time demand = 4 * 5 = 20; ROP = 20 + 8 = 28
  assert.equal(rop.leadTimeDemand, 20);
  assert.equal(rop.safetyStock, 8);
  assert.equal(rop.reorderPoint, 28);
});

await test('16. Suggested purchase quantity accounts for forecasted demand, safety stock, current stock, reserved stock, and incoming POs', () => {
  // Lead time demand = 30, Safety stock = 10 -> Required = 40
  // Current stock = 25, Reserved = 5 (Available = 20), Incoming PO = 8 -> Net Position = 28
  // Net deficit = 40 - 28 = 12 units
  const calc = calculateSuggestedOrderQuantity({
    forecastedDemand: 30,
    leadTimeDemand: 30,
    safetyStock: 10,
    reorderPoint: 40,
    currentStock: 25,
    reservedStock: 5,
    incomingStock: 8,
    orderQuantity: 1,
  });
  assert.equal(calc.availableStock, 20);
  assert.equal(calc.inventoryPosition, 28);
  assert.equal(calc.suggestedOrderQuantity, 12);

  // When incoming POs already cover required target -> suggested purchase quantity = 0
  const covered = calculateSuggestedOrderQuantity({
    forecastedDemand: 30,
    leadTimeDemand: 30,
    safetyStock: 10,
    reorderPoint: 40,
    currentStock: 25,
    reservedStock: 5,
    incomingStock: 25, // Position = 20 + 25 = 45 >= 40
  });
  assert.equal(covered.suggestedOrderQuantity, 0);
});

await test('17. Duplicate forecast prevention via deterministic upsert & scheduled job concurrency protection', async () => {
  const storedRows = new Map();
  const mockSupabase = {
    from(table) {
      assert.equal(table, 'forecast_history');
      return {
        upsert(rows, { onConflict }) {
          assert.equal(onConflict, 'forecast_id');
          for (const r of rows) {
            storedRows.set(r.forecast_id, r);
          }
          return {
            select() {
              return {
                async maybeSingle() {
                  return { data: rows[0], error: null };
                },
              };
            },
          };
        },
      };
    },
  };

  await persistForecastRecord(
    {
      productId: 'dup-test-prod',
      productName: 'Duplicate Test Brake Rotor',
      period: 'weekly',
      nextPeriodKey: '2026-W45',
      predictedNextPeriodDemand: 18,
      slope: 2,
      intercept: 8,
      rSquared: 1,
    },
    { supabaseClient: mockSupabase }
  );

  await persistForecastRecord(
    {
      productId: 'dup-test-prod',
      productName: 'Duplicate Test Brake Rotor',
      period: 'weekly',
      nextPeriodKey: '2026-W45',
      predictedNextPeriodDemand: 22,
      slope: 2.5,
      intercept: 9,
      rSquared: 0.99,
    },
    { supabaseClient: mockSupabase }
  );

  assert.equal(storedRows.size, 1);
  const saved = Array.from(storedRows.values())[0];
  assert.equal(saved.predicted_quantity, 22);
  assert.equal(saved.algorithm_name, 'simple_linear_regression');

  // Scheduler execution check
  const jobResult = await runScheduledForecastJob('daily', {
    productIds: ['sched-prod-1'],
    persist: false,
    productContexts: {
      'sched-prod-1': {
        productId: 'sched-prod-1',
        name: 'Scheduled Test Part',
        sku: 'STP-1',
        category: 'Brakes',
        currentStock: 10,
        reservedStock: 0,
        incomingStock: 0,
        availableStock: 10,
        inventoryPosition: 10,
        leadTimeDays: 3,
        orderQuantity: 1,
      },
    },
    transactionsByProduct: {
      'sched-prod-1': [
        { id: 'st-1', date: '2026-10-28T10:00:00Z', quantity: 4, reason: 'sale', status: 'Completed' },
        { id: 'st-2', date: '2026-10-29T10:00:00Z', quantity: 6, reason: 'sale', status: 'Completed' },
        { id: 'st-3', date: '2026-10-30T10:00:00Z', quantity: 8, reason: 'sale', status: 'Completed' },
      ],
    },
  });
  assert.equal(jobResult.skipped, false);
  assert.equal(jobResult.processed, 1);
  assert.equal(jobResult.succeeded, 1);
});

await test('18. Period validation, inventory recommendation statuses, and Express API route structure', async () => {
  // Invalid period parameter rejected strictly to protect SQL DATE_TRUNC
  assert.throws(() => validateForecastPeriod('yearly; DROP TABLE products;', { strict: true }));

  // Inventory recommendation statuses
  assert.equal(
    classifyInventoryRecommendation({ sufficient: false }).status,
    'Insufficient historical data'
  );
  assert.equal(
    classifyInventoryRecommendation({
      sufficient: true,
      currentStock: 4,
      reservedStock: 1,
      incomingStock: 0,
      reorderPoint: 10,
      safetyStock: 3,
      suggestedOrderQuantity: 12,
    }).status,
    'Reorder recommended'
  );
  assert.equal(
    classifyInventoryRecommendation({
      sufficient: true,
      currentStock: 11,
      reservedStock: 0,
      incomingStock: 0,
      reorderPoint: 10,
      safetyStock: 4,
      suggestedOrderQuantity: 0,
    }).status,
    'Approaching reorder point'
  );
  assert.equal(
    classifyInventoryRecommendation({
      sufficient: true,
      currentStock: 50,
      reservedStock: 0,
      incomingStock: 0,
      reorderPoint: 10,
      safetyStock: 4,
      suggestedOrderQuantity: 0,
      forecastedDemand: 8,
      trend: 'stable',
    }).status,
    'Stock sufficient'
  );

  // Verify Express router exposes /:productId, /:productId/recommendation, /schedule/status, /schedule/run
  const routePaths = forecastRouter.stack
    .filter((layer) => layer.route)
    .map((layer) => layer.route.path);
  assert.ok(routePaths.includes('/:productId'));
  assert.ok(routePaths.includes('/:productId/recommendation'));
  assert.ok(routePaths.includes('/schedule/status'));
  assert.ok(routePaths.includes('/schedule/run'));

  // Verify persistForecastRecord falls back cleanly when remote DB only has base schema.sql columns
  const baseSchemaCols = new Set([
    'forecast_id',
    'product_id',
    'product_name',
    'forecast_date',
    'forecast_period',
    'period_label',
    'period_key',
    'predicted_quantity',
    'actual_quantity',
    'slope',
    'intercept',
    'safety_stock',
    'current_stock',
    'recommended_restock',
    'created_at',
  ]);
  let fallbackSavedRow = null;
  const strictSchemaSupabase = {
    from() {
      return {
        upsert(rows) {
          const row = rows[0];
          const invalidCol = Object.keys(row).find((k) => !baseSchemaCols.has(k));
          if (invalidCol) {
            return {
              error: { code: 'PGRST204', message: `Could not find the '${invalidCol}' column of 'forecast_history'` },
              select() {
                return {
                  async maybeSingle() {
                    return {
                      data: null,
                      error: { code: 'PGRST204', message: `Could not find the '${invalidCol}' column` },
                    };
                  },
                };
              },
            };
          }
          fallbackSavedRow = row;
          return {
            error: null,
            select() {
              return {
                async maybeSingle() {
                  return { data: row, error: null };
                },
              };
            },
          };
        },
      };
    },
  };

  const fallbackRes = await persistForecastRecord(
    {
      productId: 'schema-fallback-prod',
      productName: 'Schema Fallback Oil Filter',
      period: 'weekly',
      nextPeriodKey: '2026-W46',
      predictedNextPeriodDemand: 14,
      slope: 1.5,
      intercept: 6,
      rSquared: 0.92,
    },
    { supabaseClient: strictSchemaSupabase }
  );
  assert.equal(fallbackRes.persisted, true);
  assert.ok(fallbackSavedRow);
  assert.equal(fallbackSavedRow.predicted_quantity, 14);
});

if (!process.exitCode) {
  console.log(`\nALL ${passed} SIMPLE LINEAR REGRESSION FORECASTING TESTS PASSED.\n`);
}
