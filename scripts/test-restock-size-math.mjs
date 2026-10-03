/**
 * Verify shared-pool vs explicit size/color restock math.
 * Run: node scripts/test-restock-size-math.mjs
 */

import {
  applyColorRestockDeltas,
  applySizeRestockDeltas,
  buildRestockDeltaMap,
} from '../src/utils/inventoryHelpers.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertEq(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg}\n  expected: ${e}\n  actual:   ${a}`);
}

// --- Shared pool (null size stocks): restock +5 for M must NOT inflate ---
{
  const sizes = [
    { label: 'S', price: 100, stock: null },
    { label: 'M', price: 100, stock: null },
    { label: 'L', price: 100, stock: null },
  ];
  const prevStock = 10;
  const deltaMap = buildRestockDeltaMap([{ label: 'M', quantity: 5 }]);
  const result = applySizeRestockDeltas(sizes, deltaMap, 100);

  assert(result.sharedPool === true, 'null sizes should be shared pool');
  assertEq(result.qtyFromSizes, 5, 'qty from size deltas');
  assert(result.nextSizes === undefined, 'shared pool should not rewrite size JSON');
  assertEq(prevStock + result.qtyFromSizes, 15, 'product stock must become 15 not 35');
}

// --- Explicit per-size stocks: apply deltas and sum ---
{
  const sizes = [
    { label: 'S', price: 100, stock: 2 },
    { label: 'M', price: 100, stock: 3 },
    { label: 'L', price: 100, stock: 5 },
  ];
  const deltaMap = buildRestockDeltaMap([{ label: 'M', quantity: 4 }]);
  const result = applySizeRestockDeltas(sizes, deltaMap, 100);

  assert(result.sharedPool === false, 'numeric sizes should be explicit pool');
  assertEq(result.qtyFromSizes, 4, 'explicit qty');
  assertEq(
    result.nextSizes.map((s) => s.stock),
    [2, 7, 5],
    'per-size stocks after restock'
  );
  assertEq(result.productStockFromSizes, 14, 'product stock from size sum');
}

// --- Unsized (no size deltas): qty stays at purchase quantity ---
{
  const deltaMap = buildRestockDeltaMap(null);
  const result = applySizeRestockDeltas([], deltaMap, 0);
  assertEq(result.qtyFromSizes, 0, 'no size deltas');
  assert(result.nextSizes === undefined, 'no sizes to rewrite');
  const prevStock = 20;
  const qty = 10;
  assertEq(prevStock + qty, 30, 'unsized restock adds qty once');
}

// --- Shared color pool: do not materialize product stock onto each color ---
{
  const colors = [
    { label: 'Red', hex: '#f00', stock: null },
    { label: 'Blue', hex: '#00f', stock: null },
  ];
  const deltaMap = buildRestockDeltaMap([{ label: 'Red', quantity: 3 }]);
  const result = applyColorRestockDeltas(colors, deltaMap);

  assert(result.sharedPool === true, 'null colors shared pool');
  assertEq(result.qtyFromColors, 3, 'color qty');
  assert(result.nextColors === undefined, 'shared color pool skips rewrite');
}

// --- Explicit color stocks ---
{
  const colors = [
    { label: 'Red', stock: 1 },
    { label: 'Blue', stock: 2 },
  ];
  const deltaMap = buildRestockDeltaMap([{ label: 'Blue', quantity: 5 }]);
  const result = applyColorRestockDeltas(colors, deltaMap);

  assert(result.sharedPool === false, 'explicit colors');
  assertEq(
    result.nextColors.map((c) => c.stock),
    [1, 7],
    'color stocks after restock'
  );
}

// --- Regression: old buggy formula would yield 35 ---
{
  const prevStock = 10;
  const sizes = [
    { label: 'S', stock: null },
    { label: 'M', stock: null },
    { label: 'L', stock: null },
  ];
  // Buggy: materialize product.stock onto every size then sum
  const buggy = sizes.map((s, i) => {
    const add = s.label === 'M' ? 5 : 0;
    const prev = s.stock == null ? prevStock : s.stock;
    return prev + add;
  });
  const buggyTotal = buggy.reduce((a, b) => a + b, 0);
  assertEq(buggyTotal, 35, 'document old bug total');

  const fixed = applySizeRestockDeltas(
    sizes.map((s) => ({ ...s, price: 0 })),
    buildRestockDeltaMap([{ label: 'M', quantity: 5 }]),
    0
  );
  assertEq(prevStock + fixed.qtyFromSizes, 15, 'fixed total is +qty only');
  assert(buggyTotal !== prevStock + fixed.qtyFromSizes, 'fix differs from bug');
}

console.log('All restock size/color math checks passed.');
