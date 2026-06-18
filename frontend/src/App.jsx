import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  confirmTicket,
  getCurrentReservation,
  getDashboardMetrics,
  listAvailableTickets,
  login,
  logout,
  me,
  reserveTicket
} from './api.js';
import './styles.css';

const LOCALES = [
  { code: 'WEST_COAST', label: 'West Coast' },
  { code: 'EAST_COAST', label: 'East Coast' },
  { code: 'MIDWEST', label: 'Midwest' },
  { code: 'SOUTH', label: 'South' }
];

function formatCountdown(expiresAt) {
  if (!expiresAt) {
    return '00:00';
  }

  const remainingMs = Math.max(0, new Date(expiresAt).getTime() - Date.now());
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function LoginView({ onLogin }) {
  const [reviewerId, setReviewerId] = useState('1');
  const [locale, setLocale] = useState('WEST_COAST');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const result = await login({ reviewerId: Number(reviewerId), locale });
      onLogin(result.reviewer);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel" aria-labelledby="login-title">
        <div>
          <p className="eyebrow">Content Review Queue</p>
          <h1 id="login-title">Reviewer login</h1>
        </div>

        <form onSubmit={handleSubmit} className="form-grid">
          <label>
            Reviewer ID
            <input
              inputMode="numeric"
              min="1"
              required
              type="number"
              value={reviewerId}
              onChange={(event) => setReviewerId(event.target.value)}
            />
          </label>

          <label>
            Locale
            <select value={locale} onChange={(event) => setLocale(event.target.value)}>
              {LOCALES.map((item) => (
                <option key={item.code} value={item.code}>{item.label}</option>
              ))}
            </select>
          </label>

          {error ? <p className="error" role="alert">{error}</p> : null}

          <button type="submit" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="seed-note" aria-label="Seeded reviewers">
          <span>Try reviewer 1 or 5 for West Coast</span>
          <span>2 or 6 for East Coast</span>
          <span>3 for Midwest</span>
          <span>4 for South</span>
        </div>
      </section>
    </main>
  );
}

function MetricStrip({ metrics }) {
  const items = [
    ['Available', metrics?.tickets?.available ?? 0],
    ['Reserved', metrics?.tickets?.reserved ?? 0],
    ['Confirmed', metrics?.tickets?.confirmed ?? 0],
    ['Released today', metrics?.reservations?.releasedToday ?? 0]
  ];

  return (
    <section className="metrics" aria-label="Queue metrics">
      {items.map(([label, value]) => (
        <div className="metric" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </section>
  );
}

function ActiveReservation({ reservation, onConfirm, busy }) {
  const [countdown, setCountdown] = useState(formatCountdown(reservation?.expiresAt));

  useEffect(() => {
    setCountdown(formatCountdown(reservation?.expiresAt));
    const timer = window.setInterval(() => {
      setCountdown(formatCountdown(reservation?.expiresAt));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [reservation?.expiresAt]);

  if (!reservation) {
    return (
      <section className="active-empty">
        <h2>Active hold</h2>
        <p>No ticket is currently reserved.</p>
      </section>
    );
  }

  return (
    <section className="active-panel">
      <div>
        <p className="eyebrow">Active hold</p>
        <h2>{reservation.ticket.title}</h2>
        <p className="muted">Ticket #{reservation.ticket.id} - {reservation.ticket.localeLabel}</p>
      </div>

      <div className="countdown" aria-label="Time remaining">
        {countdown}
      </div>

      <button type="button" onClick={() => onConfirm(reservation.ticket.id)} disabled={busy}>
        {busy ? 'Confirming...' : 'Confirm processing'}
      </button>
    </section>
  );
}

function TicketTable({ tickets, onReserve, busyTicketId }) {
  if (tickets.length === 0) {
    return (
      <section className="empty-list">
        <h2>Available tickets</h2>
        <p>No available tickets for this locale right now.</p>
      </section>
    );
  }

  return (
    <section className="table-wrap">
      <div className="section-heading">
        <h2>Available tickets</h2>
        <span>{tickets.length} in queue</span>
      </div>

      <div className="ticket-scroll">
        <table>
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Locale</th>
              <th>Status</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id}>
                <td>
                  <strong>{ticket.title}</strong>
                  <span>#{ticket.id}</span>
                </td>
                <td>{ticket.localeLabel}</td>
                <td><span className="status-pill">{ticket.status}</span></td>
                <td>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => onReserve(ticket.id)}
                    disabled={Boolean(busyTicketId)}
                  >
                    {busyTicketId === ticket.id ? 'Reserving...' : 'Reserve'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function QueueView({ reviewer, onLogout }) {
  const [tickets, setTickets] = useState([]);
  const [reservation, setReservation] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyTicketId, setBusyTicketId] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const refresh = useCallback(async ({ clearError = true } = {}) => {
    if (clearError) {
      setError('');
    }

    const [availableResult, currentResult, metricsResult] = await Promise.all([
      listAvailableTickets(),
      getCurrentReservation(),
      getDashboardMetrics()
    ]);

    setTickets(availableResult.tickets);
    setReservation(currentResult.reservation);
    setMetrics(metricsResult);
  }, []);

  useEffect(() => {
    refresh()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    const events = new EventSource('/api/events');

    function handleQueueEvent() {
      refresh().catch((err) => setError(err.message));
    }

    events.addEventListener('ticket_reserved', handleQueueEvent);
    events.addEventListener('ticket_confirmed', handleQueueEvent);
    events.addEventListener('ticket_released', handleQueueEvent);
    events.onerror = () => {
      events.close();
    };

    return () => events.close();
  }, [refresh]);

  const sortedTickets = useMemo(() => [...tickets].sort((a, b) => a.id - b.id), [tickets]);

  async function handleReserve(ticketId) {
    setError('');
    setNotice('');

    setBusyTicketId(ticketId);

    try {
      const result = await reserveTicket(ticketId);
      setReservation(result.reservation);
      setNotice(`Ticket #${ticketId} is held for you.`);
      await refresh();
    } catch (err) {
      const message = err.message;
      await refresh({ clearError: false }).catch(() => {});
      setError(message);
    } finally {
      setBusyTicketId(null);
    }
  }

  async function handleConfirm(ticketId) {
    setConfirming(true);
    setError('');
    setNotice('');

    try {
      await confirmTicket(ticketId);
      setReservation(null);
      setNotice(`Ticket #${ticketId} confirmed.`);
      await refresh();
    } catch (err) {
      const message = err.message;
      await refresh({ clearError: false }).catch(() => {});
      setError(message);
    } finally {
      setConfirming(false);
    }
  }

  async function handleLogout() {
    await logout().catch(() => {});
    onLogout();
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Content Review Queue</p>
          <h1>{reviewer.localeLabel}</h1>
        </div>
        <div className="reviewer-chip">
          <span>{reviewer.name}</span>
          <button type="button" className="ghost" onClick={handleLogout}>Log out</button>
        </div>
      </header>

      <MetricStrip metrics={metrics} />

      {notice ? <p className="notice" role="status">{notice}</p> : null}
      {error ? <p className="error" role="alert">{error}</p> : null}

      {loading ? (
        <section className="loading">Loading queue...</section>
      ) : (
        <div className="content-grid">
          <ActiveReservation reservation={reservation} onConfirm={handleConfirm} busy={confirming} />
          <TicketTable tickets={sortedTickets} onReserve={handleReserve} busyTicketId={busyTicketId} />
        </div>
      )}
    </main>
  );
}

export default function App() {
  const [reviewer, setReviewer] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    me()
      .then((result) => setReviewer(result.reviewer))
      .catch(() => setReviewer(null))
      .finally(() => setCheckingSession(false));
  }, []);

  if (checkingSession) {
    return <main className="loading full">Loading...</main>;
  }

  if (!reviewer) {
    return <LoginView onLogin={setReviewer} />;
  }

  return <QueueView reviewer={reviewer} onLogout={() => setReviewer(null)} />;
}
