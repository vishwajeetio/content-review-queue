export function createEventBus() {
  const clients = new Set();

  function write(res, event, payload) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }

  return {
    register(res, filter) {
      // Store a new client and send an initial connection event
      const client = { res, filter };
      clients.add(client);
      write(res, 'connected', { ok: true });

      return () => {
        clients.delete(client);
      };
    },

    broadcast(event, payload) {
      // Push updates only to clients subscribed to the same locale
      for (const client of clients) {
        if (payload.locale && client.filter.locale !== payload.locale) {
          continue;
        }

        try {
          write(client.res, event, payload);
        } catch {
          clients.delete(client);
        }
      }
    }
  };
}

