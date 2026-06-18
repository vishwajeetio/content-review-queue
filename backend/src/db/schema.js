const LOCALE_CHECK = "locale IN ('WEST_COAST', 'EAST_COAST', 'MIDWEST', 'SOUTH')";

export async function initializeDatabase(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS reviewers (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      locale TEXT NOT NULL CHECK (${LOCALE_CHECK}),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS tickets (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      locale TEXT NOT NULL CHECK (${LOCALE_CHECK}),
      status TEXT NOT NULL DEFAULT 'AVAILABLE'
        CHECK (status IN ('AVAILABLE', 'RESERVED', 'CONFIRMED')),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      current_reservation_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS reservations (
      id UUID PRIMARY KEY,
      ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      reviewer_id INTEGER NOT NULL REFERENCES reviewers(id) ON DELETE RESTRICT,
      locale TEXT NOT NULL CHECK (${LOCALE_CHECK}),
      status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'CONFIRMED', 'EXPIRED')),
      reserved_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      confirmed_at TIMESTAMPTZ,
      released_at TIMESTAMPTZ
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_tickets_locale_status
      ON tickets(locale, status, id)
      WHERE active = TRUE;
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_reservations_status_expiry
      ON reservations(status, expires_at);
  `);

  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_one_active_ticket
      ON reservations(ticket_id)
      WHERE status = 'ACTIVE';
  `);

  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_one_active_reviewer
      ON reservations(reviewer_id)
      WHERE status = 'ACTIVE';
  `);
}
