/**
 * Express API Routes: Simple Linear Regression Inventory Forecasting
 * ---------------------------------------------------------------------------
 * Endpoints:
 *   GET  /api/forecast/:productId?period=daily
 *   GET  /api/forecast/:productId?period=weekly
 *   GET  /api/forecast/:productId?period=monthly
 *   GET  /api/forecast/:productId/recommendation?period=daily|weekly|monthly
 *   POST /api/forecast/:productId/generate
 *   GET  /api/forecast/schedule/status
 *   POST /api/forecast/schedule/run
 */
import express from 'express';
import {
  generateForecast,
  generateInventoryRecommendation,
  validateForecastPeriod,
} from '../services/forecastService.js';
import { runScheduledForecastJob, getForecastSchedulerStatus } from '../services/forecastScheduler.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = express.Router();

/**
 * GET /api/forecast/schedule/status
 * Returns scheduled forecasting job status and execution history.
 */
router.get('/schedule/status', (_req, res) => {
  res.json({
    success: true,
    scheduler: getForecastSchedulerStatus(),
  });
});

/**
 * POST /api/forecast/schedule/run
 * Triggers a scheduled batch forecast run for a specified period ('daily'|'weekly'|'monthly').
 */
router.post('/schedule/run', requireAdmin, async (req, res) => {
  try {
    const requestedPeriod = req.body?.period || req.query?.period || 'daily';
    const periodCfg = validateForecastPeriod(requestedPeriod, { strict: true });
    const summary = await runScheduledForecastJob(periodCfg.period, {
      limit: Number(req.body?.limit) > 0 ? Number(req.body.limit) : 500,
    });
    return res.json({
      success: true,
      ...summary,
    });
  } catch (err) {
    const status = err.statusCode || 400;
    return res.status(status).json({
      success: false,
      error: err.message || 'Failed to execute scheduled forecast job.',
    });
  }
});

/**
 * GET /api/forecast/:productId/recommendation?period=daily|weekly|monthly
 * Returns inventory replenishment recommendation based on Simple Linear Regression.
 */
router.get('/:productId/recommendation', async (req, res) => {
  try {
    const productId = String(req.params.productId || '').trim();
    if (!productId) {
      return res.status(400).json({
        success: false,
        error: 'Product ID is required.',
      });
    }

    const rawPeriod = req.query.period || 'weekly';
    const periodCfg = validateForecastPeriod(rawPeriod, { strict: true });

    const recommendation = await generateInventoryRecommendation(productId, {
      period: periodCfg.period,
      historicalWindow: req.query.historicalWindow ? Number(req.query.historicalWindow) : undefined,
      forecastHorizon: req.query.forecastHorizon ? Number(req.query.forecastHorizon) : undefined,
      persist: req.query.persist !== 'false',
    });

    return res.json(recommendation);
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: err.message || 'Failed to generate inventory recommendation.',
    });
  }
});

/**
 * GET /api/forecast/:productId?period=daily|weekly|monthly
 * Main forecasting endpoint returning:
 *   - Product information
 *   - Forecast period
 *   - Historical demand
 *   - Predicted future demand
 *   - Regression slope
 *   - Regression intercept
 *   - R-squared
 *   - MAE, RMSE, WAPE (chronological holdout evaluation)
 *   - Forecast dates
 *   - Inventory recommendations
 *   - Reorder point
 *   - Safety stock
 *   - Suggested purchase quantity
 */
router.get('/:productId', async (req, res) => {
  try {
    const productId = String(req.params.productId || '').trim();
    if (!productId) {
      return res.status(400).json({
        success: false,
        error: 'Product ID is required.',
      });
    }

    const rawPeriod = req.query.period || 'daily';
    const periodCfg = validateForecastPeriod(rawPeriod, { strict: true });

    const forecast = await generateForecast(productId, periodCfg.period, {
      historicalWindow: req.query.historicalWindow ? Number(req.query.historicalWindow) : undefined,
      forecastHorizon: req.query.forecastHorizon ? Number(req.query.forecastHorizon) : undefined,
      persist: req.query.persist !== 'false',
      force: req.query.force === 'true',
    });

    return res.json(forecast);
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: err.message || 'Failed to generate product forecast.',
    });
  }
});

/**
 * POST /api/forecast/:productId/generate
 * Explicitly regenerates and persists a product forecast.
 */
router.post('/:productId/generate', async (req, res) => {
  try {
    const productId = String(req.params.productId || '').trim();
    if (!productId) {
      return res.status(400).json({
        success: false,
        error: 'Product ID is required.',
      });
    }

    const rawPeriod = req.body?.period || req.query?.period || 'daily';
    const periodCfg = validateForecastPeriod(rawPeriod, { strict: true });

    const forecast = await generateForecast(productId, periodCfg.period, {
      historicalWindow: req.body?.historicalWindow ? Number(req.body.historicalWindow) : undefined,
      forecastHorizon: req.body?.forecastHorizon ? Number(req.body.forecastHorizon) : undefined,
      persist: true,
      force: true,
    });

    return res.json(forecast);
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: err.message || 'Failed to generate product forecast.',
    });
  }
});

export default router;
