/**
 * Linear regression helpers for sales forecasting.
 * Model: Y = a + bX
 *
 * b = Σ((X - X̄)(Y - Ȳ)) / Σ((X - X̄)²)
 * a = Ȳ - bX̄
 */

export const MIN_REGRESSION_PERIODS = 2;

/**
 * @param {{ x: number, y: number }[]} points
 * @returns {{
 *   slope: number,
 *   intercept: number,
 *   meanX: number,
 *   meanY: number,
 *   n: number,
 *   equation: string,
 *   sufficient: boolean,
 *   error?: string,
 * }}
 */
export function calculateLinearRegression(points) {
  const data = (points || [])
    .map((p) => ({ x: Number(p.x), y: Number(p.y) }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

  const n = data.length;

  if (n < MIN_REGRESSION_PERIODS) {
    return {
      slope: 0,
      intercept: 0,
      meanX: 0,
      meanY: 0,
      n,
      equation: '',
      sufficient: false,
      error: 'Insufficient historical sales data for forecasting.',
    };
  }

  const meanX = data.reduce((s, p) => s + p.x, 0) / n;
  const meanY = data.reduce((s, p) => s + p.y, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (const p of data) {
    const dx = p.x - meanX;
    const dy = p.y - meanY;
    numerator += dx * dy;
    denominator += dx * dx;
  }

  if (denominator === 0) {
    // All X values identical — flat line at mean Y
    return {
      slope: 0,
      intercept: meanY,
      meanX,
      meanY,
      n,
      equation: formatRegressionEquation(meanY, 0),
      sufficient: true,
    };
  }

  const slope = numerator / denominator;
  const intercept = meanY - slope * meanX;

  return {
    slope,
    intercept,
    meanX,
    meanY,
    n,
    equation: formatRegressionEquation(intercept, slope),
    sufficient: true,
  };
}

/**
 * Predict Y for a given X using Y = a + bX.
 * Floors at 0 — sales quantity cannot be negative.
 */
export function predictY(intercept, slope, x) {
  const y = Number(intercept) + Number(slope) * Number(x);
  if (!Number.isFinite(y)) return 0;
  return Math.max(0, y);
}

/**
 * Format a readable regression equation string.
 */
export function formatRegressionEquation(intercept, slope) {
  const a = Number(intercept);
  const b = Number(slope);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 'Y = a + bX';

  const aStr = a.toFixed(2);
  const absB = Math.abs(b).toFixed(4);
  if (b >= 0) return `Y = ${aStr} + ${absB}X`;
  return `Y = ${aStr} - ${absB}X`;
}

/**
 * Classify trend from slope relative to average sales volume.
 * @param {number} slope
 * @param {number} meanY
 * @returns {'increasing' | 'decreasing' | 'stable'}
 */
export function determineTrend(slope, meanY = 0) {
  const s = Number(slope) || 0;
  const baseline = Math.max(Math.abs(Number(meanY) || 0), 1);
  const relative = s / baseline;
  if (relative > 0.05) return 'increasing';
  if (relative < -0.05) return 'decreasing';
  return 'stable';
}

export function trendLabel(trend) {
  if (trend === 'increasing') return 'Increasing';
  if (trend === 'decreasing') return 'Decreasing';
  return 'Stable';
}

export function trendExplanation(trend) {
  if (trend === 'increasing') {
    return 'Sales show an increasing trend based on historical transaction data.';
  }
  if (trend === 'decreasing') {
    return 'Sales show a decreasing trend based on historical transaction data.';
  }
  return 'Sales appear relatively stable based on historical transaction data.';
}
