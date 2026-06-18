import { createApp } from './app.js';
import { config } from './config.js';
import { pool } from './db/pool.js';
import { seedDatabase } from './db/seed.js';
import { initializeDatabase } from './db/schema.js';
import { waitForDatabase } from './db/startup.js';
import { startReleaseExpiredReservationsJob } from './jobs/releaseExpiredReservations.js';
import { createEventBus } from './services/eventBus.js';

const eventBus = createEventBus();

async function main() {
  await waitForDatabase(pool);
  await initializeDatabase(pool);
  await seedDatabase(pool);

  startReleaseExpiredReservationsJob({ pool, eventBus });

  const app = createApp({ pool, eventBus });
  app.listen(config.port, () => {
    console.log(`Content Review Queue API listening on port ${config.port}`);
  });
}

main().catch((err) => {
  console.error('Failed to start API', err);
  process.exit(1);
});
