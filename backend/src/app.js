import express from 'express';

import { createAuthMiddleware } from './middleware/auth.js';
import { createAuthRoutes } from './routes/authRoutes.js';
import { createEventRoutes } from './routes/eventRoutes.js';
import { createMetricsRoutes } from './routes/metricsRoutes.js';
import { createTicketRoutes } from './routes/ticketRoutes.js';
import { createEventBus } from './services/eventBus.js';
import { createSessionStore } from './services/sessionStore.js';
import { ServiceError } from './utils/errors.js';

export function createApp({ pool, eventBus = createEventBus(), sessionStore = createSessionStore() }) {
  if (!pool) {
    throw new Error('createApp requires a database pool');
  }

  const app = express();
  const requireAuth = createAuthMiddleware({ sessionStore });

  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api', createAuthRoutes({ pool, sessionStore }));
  app.use('/api/tickets', requireAuth, createTicketRoutes({ pool, eventBus }));
  app.use('/api/metrics', requireAuth, createMetricsRoutes({ pool }));
  app.use('/api/events', requireAuth, createEventRoutes({ eventBus }));

  app.use((req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `No route found for ${req.method} ${req.path}`
      }
    });
  });

  app.use((err, _req, res, _next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      res.status(400).json({
        error: {
          code: 'INVALID_JSON',
          message: 'Request body must be valid JSON.'
        }
      });
      return;
    }

    if (err instanceof ServiceError) {
      res.status(err.status).json({
        error: {
          code: err.code,
          message: err.message
        }
      });
      return;
    }

    console.error(err);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unexpected server error.'
      }
    });
  });

  return app;
}

