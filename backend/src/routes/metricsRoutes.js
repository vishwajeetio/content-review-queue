import { Router } from 'express';

import { getLocaleMetrics, getSystemMetrics } from '../services/metricsService.js';
import { asyncRoute } from '../utils/routes.js';

export function createMetricsRoutes({ pool }) {
  const router = Router();

  router.get('/locale', asyncRoute(async (req, res) => {
    const metrics = await getLocaleMetrics({
      db: pool,
      locale: req.auth.reviewer.locale
    });
    res.json(metrics);
  }));

  router.get('/', asyncRoute(async (_req, res) => {
    const metrics = await getSystemMetrics({ db: pool });
    res.json(metrics);
  }));

  return router;
}
