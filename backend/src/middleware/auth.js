import { ServiceError } from '../utils/errors.js';

function parseCookies(cookieHeader = '') {
  return cookieHeader
    .split(';')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .reduce((cookies, pair) => {
      const index = pair.indexOf('=');
      if (index === -1) {
        return cookies;
      }
      const key = decodeURIComponent(pair.slice(0, index));
      const value = decodeURIComponent(pair.slice(index + 1));
      cookies[key] = value;
      return cookies;
    }, {});
}

function getBearerToken(req) {
  const header = req.get('authorization');
  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
}

export function getSessionToken(req) {
  // Fallback to browser cookies when no bearer token is provided
  const bearer = getBearerToken(req);
  if (bearer) {
    return bearer;
  }

  const cookies = parseCookies(req.get('cookie'));
  return cookies.crq_session || null;
}

export function createAuthMiddleware({ sessionStore }) {
  return (req, _res, next) => {
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

    req.auth = {
      token,
      reviewer: session.reviewer
    };
    next();
  };
}

