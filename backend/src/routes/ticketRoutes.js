import { Router } from 'express';

import {
  confirmTicket,
  getCurrentReservation,
  listAvailableTickets,
  reserveTicket
} from '../services/ticketService.js';
import { parsePositiveInteger } from '../utils/numbers.js';
import { asyncRoute } from '../utils/routes.js';
import { ServiceError } from '../utils/errors.js';

export function createTicketRoutes({ pool, eventBus }) {
  const router = Router();

  router.get('/', asyncRoute(async (req, res) => {
    const status = String(req.query.status || 'AVAILABLE').toUpperCase();
    if (status !== 'AVAILABLE') {
      throw new ServiceError(400, 'UNSUPPORTED_STATUS', 'Only status=AVAILABLE is supported for queue browsing.');
    }

    const tickets = await listAvailableTickets({ db: pool, reviewer: req.auth.reviewer });
    res.json({ tickets });
  }));

  router.get('/available', asyncRoute(async (req, res) => {
    const tickets = await listAvailableTickets({ db: pool, reviewer: req.auth.reviewer });
    res.json({ tickets });
  }));

  router.get('/current', asyncRoute(async (req, res) => {
    const reservation = await getCurrentReservation({ db: pool, reviewer: req.auth.reviewer });
    res.json({ reservation });
  }));

  router.post('/:id/reserve', asyncRoute(async (req, res) => {
    const ticketId = parsePositiveInteger(req.params.id);
    if (!ticketId) {
      throw new ServiceError(400, 'INVALID_TICKET_ID', 'Ticket id must be a positive integer.');
    }

    const reservation = await reserveTicket({ db: pool, reviewer: req.auth.reviewer, ticketId });
    eventBus.broadcast('ticket_reserved', {
      ticketId: reservation.ticket.id,
      reservationId: reservation.id,
      locale: reservation.ticket.locale,
      reviewerId: req.auth.reviewer.id
    });

    res.status(201).json({ reservation });
  }));

  router.post('/:id/confirm', asyncRoute(async (req, res) => {
    const ticketId = parsePositiveInteger(req.params.id);
    if (!ticketId) {
      throw new ServiceError(400, 'INVALID_TICKET_ID', 'Ticket id must be a positive integer.');
    }

    const reservation = await confirmTicket({ db: pool, reviewer: req.auth.reviewer, ticketId });
    eventBus.broadcast('ticket_confirmed', {
      ticketId: reservation.ticket.id,
      reservationId: reservation.id,
      locale: reservation.ticket.locale,
      reviewerId: req.auth.reviewer.id
    });

    res.json({ reservation });
  }));

  return router;
}

