// ─── CURRENCY CONVERSION UTILITY ────────────────────────────────────────────
// Centralizes the USD -> PHP conversion rate so the magic "x50" factor lives
// in exactly one place instead of being scattered across pages/services.

import { USD_TO_PHP_RATE } from '../config/index.js';

export function usdToPhp(value) {
  return Math.round((Number(value) || 0) * USD_TO_PHP_RATE);
}

export function phpFromUsd(value) {
  return usdToPhp(value);
}

export function formatPhp(amount) {
  const num = Number(amount) || 0;
  return '₱' + num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function formatUsd(amount) {
  const num = Number(amount) || 0;
  return '$' + num.toFixed(2);
}

export default { usdToPhp, phpFromUsd, formatPhp, formatUsd, rate: USD_TO_PHP_RATE };
