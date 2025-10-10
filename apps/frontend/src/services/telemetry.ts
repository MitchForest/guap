const AUTH_FAILURE_KEY = 'guap:auth-failure-count';
const AUTH_WINDOW_MS = 5 * 60 * 1000;

type AuthEvent = {
  timestamp: number;
  type: 'failure' | 'signOut';
  message?: string;
};

const isBrowser = typeof window !== 'undefined';

const readAuthEvents = (): AuthEvent[] => {
  if (!isBrowser) return [];
  try {
    const raw = window.localStorage.getItem(AUTH_FAILURE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AuthEvent[];
    const cutoff = Date.now() - AUTH_WINDOW_MS;
    return parsed.filter((event) => event.timestamp >= cutoff);
  } catch (error) {
    console.warn('[telemetry] failed to read auth events', error);
    return [];
  }
};

const writeAuthEvents = (events: AuthEvent[]) => {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(AUTH_FAILURE_KEY, JSON.stringify(events));
  } catch (error) {
    console.warn('[telemetry] failed to persist auth events', error);
  }
};

export const recordAuthFailure = (message?: string) => {
  const events = readAuthEvents();
  events.push({ timestamp: Date.now(), type: 'failure', message });
  writeAuthEvents(events);
  const failureCount = events.filter((event) => event.type === 'failure').length;
  if (failureCount >= 3) {
    console.error('[telemetry] multiple auth failures detected', { failureCount, message });
  }
};

export const recordAuthSignOut = (reason?: string) => {
  const events = readAuthEvents();
  events.push({ timestamp: Date.now(), type: 'signOut', message: reason });
  writeAuthEvents(events);
};

export const resetAuthTelemetry = () => {
  if (!isBrowser) return;
  window.localStorage.removeItem(AUTH_FAILURE_KEY);
};
