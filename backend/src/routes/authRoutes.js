import { Router } from 'express';

import { getSessionToken } from '../middleware/auth.js';
import { authenticateReviewer } from '../services/authService.js';
import { normalizeLocale } from '../utils/locales.js';
import { asyncRoute } from '../utils/routes.js';
import { ServiceError } from '../utils/errors.js';

function sessionCookie(token) {
  const parts = [
    `crq_session=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax'
  ];

  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }

  return parts.join('; ');
}

export function createAuthRoutes({ pool, sessionStore }) {
  const router = Router();

  router.post('/login', asyncRoute(async (req, res) => {
    const reviewerId = Number(req.body?.reviewerId);
    const locale = normalizeLocale(req.body?.locale);

    if (!Number.isInteger(reviewerId) || reviewerId <= 0 || !locale) {
      throw new ServiceError(400, 'INVALID_LOGIN', 'A valid reviewerId and locale are required.');
    }

    const reviewer = await authenticateReviewer({ db: pool, reviewerId, locale });
    const token = sessionStore.create(reviewer);

    res.setHeader('Set-Cookie', sessionCookie(token));
    res.status(200).json({ reviewer, token });
  }));

  router.post('/logout', (req, res) => {
    const token = getSessionToken(req);
    if (token) {
      sessionStore.remove(token);
    }

    res.setHeader('Set-Cookie', 'crq_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0');
    res.status(204).end();
  });

  router.get('/me', (req, res, next) => {
    const token = getSessionToken(req);
    if (!token) {
      next(new ServiceError(401, 'UNAUTHENTICATED', 'Login is required.'));
      return;
    }

    const session = sessionStore.get(token);
    if (!session) {
      next(new ServiceError(401, 'UNAUTHENTICATED', 'Session is invalid or expired.'));
      return;
    }

    res.json({ reviewer: session.reviewer });
  });

  return router;
}
