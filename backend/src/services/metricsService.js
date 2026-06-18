import { localeLabel } from '../utils/locales.js';

function emptyTicketCounts() {
  return {
    available: 0,
    reserved: 0,
    confirmed: 0,
    total: 0
  };
}

function mapTicketCounts(rows) {
  const tickets = emptyTicketCounts();

  for (const row of rows) {
    const key = row.status.toLowerCase();
    tickets[key] = row.count;
    tickets.total += row.count;
  }

  return tickets;
}

async function getTicketCounts({ db, locale }) {
  const params = locale ? [locale] : [];
  const where = locale ? 'WHERE locale = $1' : '';

  const result = await db.query(`
    SELECT status, COUNT(*)::int AS count
    FROM tickets
    ${where}
    GROUP BY status;
  `, params);

  return mapTicketCounts(result.rows);
}

async function getReservationCounts({ db, locale }) {
  const params = locale ? [locale] : [];
  const where = locale ? 'WHERE locale = $1' : '';

  const result = await db.query(`
    SELECT
      COALESCE(SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END), 0)::int AS active,
      COALESCE(SUM(CASE WHEN status = 'CONFIRMED' AND confirmed_at::date = CURRENT_DATE THEN 1 ELSE 0 END), 0)::int AS confirmed_today,
      COALESCE(SUM(CASE WHEN status = 'EXPIRED' AND released_at::date = CURRENT_DATE THEN 1 ELSE 0 END), 0)::int AS released_today
    FROM reservations
    ${where};
  `, params);

  return {
    active: result.rows[0].active,
    confirmedToday: result.rows[0].confirmed_today,
    releasedToday: result.rows[0].released_today
  };
}

export async function getSystemMetrics({ db }) {
  // Build metrics across all locales
  const tickets = await getTicketCounts({ db });
  const reservations = await getReservationCounts({ db });
  const localeResult = await db.query(`
    SELECT locale, status, COUNT(*)::int AS count
    FROM tickets
    GROUP BY locale, status
    ORDER BY locale, status;
  `);

  return {
    scope: {
      type: 'system'
    },
    tickets,
    reservations,
    byLocale: localeResult.rows,
    generatedAt: new Date().toISOString()
  };
}

export async function getLocaleMetrics({ db, locale }) {
  // Build metrics scoped to a single locale
  return {
    scope: {
      type: 'locale',
      locale,
      localeLabel: localeLabel(locale)
    },
    tickets: await getTicketCounts({ db, locale }),
    reservations: await getReservationCounts({ db, locale }),
    generatedAt: new Date().toISOString()
  };
}
