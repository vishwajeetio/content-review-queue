// Core ticket workflow service responsible for reservation, confirmation, and expiration of tickets.

import crypto from 'node:crypto';
import { reservationTtlMs } from '../config.js';
import { ServiceError } from '../utils/errors.js';
import { localeLabel } from '../utils/locales.js';

function toIso(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapTicket(row) {
  return {
    id: row.id,
    title: row.title,
    locale: row.locale,
    localeLabel: localeLabel(row.locale),
    status: row.status,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function mapReservation(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.reservation_id,
    status: row.reservation_status,
    reviewerId: row.reviewer_id,
    reservedAt: toIso(row.reserved_at),
    expiresAt: toIso(row.expires_at),
    confirmedAt: row.confirmed_at ? toIso(row.confirmed_at) : null,
    releasedAt: row.released_at ? toIso(row.released_at) : null,
    ticket: mapTicket(row)
  };
}

// Keep multiple database updates atomic
async function withTransaction(db, callback) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function releaseExpiredReservations({ db, now = new Date() }) {
  const run = async (client) => {
    const result = await client.query(
      `
        UPDATE reservations
        SET status = 'EXPIRED',
            released_at = $1
        WHERE status = 'ACTIVE'
          AND expires_at <= $1
        RETURNING id, ticket_id, reviewer_id, locale;
      `,
      [now]
    );

    if (result.rowCount === 0) {
      return [];
    }

    const ids = result.rows.map((row) => row.id);
    const placeholders = ids.map((_, index) => `$${index + 2}`).join(', ');

    await client.query(
      `
        UPDATE tickets
        SET status = 'AVAILABLE',
            current_reservation_id = NULL,
            updated_at = $1
        WHERE status = 'RESERVED'
          AND current_reservation_id IN (${placeholders});
      `,
      [now, ...ids]
    );

    return result.rows.map((row) => ({
      reservationId: row.id,
      ticketId: row.ticket_id,
      reviewerId: row.reviewer_id,
      locale: row.locale
    }));
  };

  if (typeof db.connect === 'function') {
    return withTransaction(db, run);
  }

  return run(db);
}

export async function listAvailableTickets({ db, reviewer, now = new Date() }) {
  await releaseExpiredReservations({ db, now });

  const result = await db.query(
    `
      SELECT id, title, locale, status, created_at, updated_at
      FROM tickets
      WHERE locale = $1
        AND status = 'AVAILABLE'
        AND active = TRUE
      ORDER BY created_at ASC, id ASC
      LIMIT 100;
    `,
    [reviewer.locale]
  );

  return result.rows.map(mapTicket);
}

export async function getCurrentReservation({ db, reviewer, now = new Date() }) {
  await releaseExpiredReservations({ db, now });

  const result = await db.query(
    `
      SELECT
        r.id AS reservation_id,
        r.status AS reservation_status,
        r.reviewer_id,
        r.reserved_at,
        r.expires_at,
        r.confirmed_at,
        r.released_at,
        t.id,
        t.title,
        t.locale,
        t.status,
        t.created_at,
        t.updated_at
      FROM reservations r
      JOIN tickets t ON t.id = r.ticket_id
      WHERE r.reviewer_id = $1
        AND r.locale = $2
        AND r.status = 'ACTIVE'
        AND r.expires_at > $3
        AND t.current_reservation_id = r.id
      ORDER BY r.reserved_at DESC
      LIMIT 1;
    `,
    [reviewer.id, reviewer.locale, now]
  );

  return mapReservation(result.rows[0]);
}

export async function reserveTicket({ db, reviewer, ticketId, now = new Date() }) {
  await releaseExpiredReservations({ db, now });

  return withTransaction(db, async (client) => {
    const reservationId = crypto.randomUUID();
    const expiresAt = new Date(now.getTime() + reservationTtlMs);

    const activeReservation = await client.query(
      `
        SELECT id
        FROM reservations
        WHERE reviewer_id = $1
          AND status = 'ACTIVE'
          AND expires_at > $2
        LIMIT 1;
      `,
      [reviewer.id, now]
    );

    if (activeReservation.rowCount > 0) {
      throw new ServiceError(409, 'ACTIVE_RESERVATION_EXISTS', 'Confirm or wait for the current reservation before reserving another ticket.');
    }

    const ticketResult = await client.query(
      `
        UPDATE tickets
        SET status = 'RESERVED',
            current_reservation_id = $1,
            updated_at = $4
        WHERE id = $2
          AND locale = $3
          AND status = 'AVAILABLE'
          AND active = TRUE
        RETURNING id, title, locale, status, created_at, updated_at;
      `,
      [reservationId, ticketId, reviewer.locale, now]
    );

    if (ticketResult.rowCount !== 1) {
      throw new ServiceError(409, 'TICKET_NOT_AVAILABLE', 'Ticket is not available for this reviewer.');
    }

    try {
      const reservationResult = await client.query(
        `
          INSERT INTO reservations (id, ticket_id, reviewer_id, locale, status, reserved_at, expires_at)
          VALUES ($1, $2, $3, $4, 'ACTIVE', $5, $6)
          RETURNING
            id AS reservation_id,
            status AS reservation_status,
            reviewer_id,
            reserved_at,
            expires_at,
            confirmed_at,
            released_at;
        `,
        [reservationId, ticketId, reviewer.id, reviewer.locale, now, expiresAt]
      );

      return mapReservation({
        ...reservationResult.rows[0],
        ...ticketResult.rows[0]
      });
    } catch (err) {
      if (err.code === '23505') {
        throw new ServiceError(409, 'ACTIVE_RESERVATION_EXISTS', 'Reviewer or ticket already has an active reservation.');
      }
      throw err;
    }
  });
}

export async function confirmTicket({ db, reviewer, ticketId, now = new Date() }) {
  await releaseExpiredReservations({ db, now });

  return withTransaction(db, async (client) => {
    const reservationResult = await client.query(
      `
        UPDATE reservations
        SET status = 'CONFIRMED',
            confirmed_at = $4
        WHERE id = (
          SELECT r.id
          FROM reservations r
          JOIN tickets t ON t.id = r.ticket_id
          WHERE r.ticket_id = $1
            AND r.reviewer_id = $2
            AND r.locale = $3
            AND r.status = 'ACTIVE'
            AND r.expires_at > $4
            AND t.status = 'RESERVED'
            AND t.current_reservation_id = r.id
          LIMIT 1
        )
        RETURNING
          id AS reservation_id,
          status AS reservation_status,
          reviewer_id,
          reserved_at,
          expires_at,
          confirmed_at,
          released_at;
      `,
      [ticketId, reviewer.id, reviewer.locale, now]
    );

    if (reservationResult.rowCount !== 1) {
      throw new ServiceError(409, 'CONFIRM_NOT_ALLOWED', 'Reservation is not active for this reviewer or has expired.');
    }

    const ticketResult = await client.query(
      `
        UPDATE tickets
        SET status = 'CONFIRMED',
            updated_at = $2
        WHERE id = $1
        RETURNING id, title, locale, status, created_at, updated_at;
      `,
      [ticketId, now]
    );

    return mapReservation({
      ...reservationResult.rows[0],
      ...ticketResult.rows[0]
    });
  });
}
