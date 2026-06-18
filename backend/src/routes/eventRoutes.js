import { Router } from 'express';

export function createEventRoutes({ eventBus }) {
  const router = Router();

  router.get('/', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const unsubscribe = eventBus.register(res, {
      locale: req.auth.reviewer.locale,
      reviewerId: req.auth.reviewer.id
    });

    req.on('close', unsubscribe);
  });

  return router;
}

