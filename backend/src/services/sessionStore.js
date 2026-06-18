import crypto from 'node:crypto';

const DEFAULT_TTL_MS = 8 * 60 * 60 * 1000;

export function createSessionStore({ ttlMs = DEFAULT_TTL_MS } = {}) {
  const sessions = new Map();

  function pruneExpired(now = Date.now()) {
    for (const [token, session] of sessions.entries()) {
      if (session.expiresAt <= now) {
        sessions.delete(token);
      }
    }
  }

  return {
    create(reviewer) {
      // Generate a secure session token and persist its expiry
      pruneExpired();
      const token = crypto.randomBytes(32).toString('hex');
      sessions.set(token, {
        reviewer,
        createdAt: Date.now(),
        expiresAt: Date.now() + ttlMs
      });
      return token;
    },

    get(token) {
      pruneExpired();
      return sessions.get(token) || null;
    },

    remove(token) {
      sessions.delete(token);
    }
  };
}

