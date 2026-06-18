export async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.code = data?.error?.code;
    throw error;
  }

  return data;
}

export function login({ reviewerId, locale }) {
  return api('/api/login', {
    method: 'POST',
    body: JSON.stringify({ reviewerId, locale })
  });
}

export function logout() {
  return api('/api/logout', { method: 'POST' });
}

export function me() {
  return api('/api/me');
}

export function listAvailableTickets() {
  return api('/api/tickets/available');
}

export function getCurrentReservation() {
  return api('/api/tickets/current');
}

export function reserveTicket(ticketId) {
  return api(`/api/tickets/${ticketId}/reserve`, { method: 'POST' });
}

export function confirmTicket(ticketId) {
  return api(`/api/tickets/${ticketId}/confirm`, { method: 'POST' });
}

export function getDashboardMetrics() {
  return api('/api/metrics/locale');
}

export function getSystemMetrics() {
  return api('/api/metrics');
}
