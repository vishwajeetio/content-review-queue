import cron from 'node-cron';

import { releaseExpiredReservations } from '../services/ticketService.js';

export function startReleaseExpiredReservationsJob({ pool, eventBus }) {
  const task = cron.schedule('*/2 * * * * *', async () => {
    try {
      const released = await releaseExpiredReservations({ db: pool });
      for (const item of released) {
        eventBus.broadcast('ticket_released', item);
      }
    } catch (err) {
      console.error('Failed to release expired reservations', err);
    }
  });

  return task;
}

