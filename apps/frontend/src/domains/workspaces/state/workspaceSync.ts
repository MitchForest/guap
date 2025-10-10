const EVENT_NAME = 'guap:workspace-change';
const STORAGE_KEY = 'guap:workspace-slug';

type WorkspaceChangeHandler = (slug: string | null) => void;

const listenerMap = new Map<WorkspaceChangeHandler, (event: Event) => void>();

const slugPattern = /^[a-z0-9-]+$/;

const normalizeSlug = (slug: string | null | undefined) => {
  if (!slug) return null;
  const trimmed = slug.trim().toLowerCase();
  if (!slugPattern.test(trimmed)) return null;
  return trimmed;
};

const getStoredSlug = () => {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  const normalized = normalizeSlug(stored);
  if (!normalized && stored) {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  return normalized;
};

const dispatchChange = (slug: string | null) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<string | null>(EVENT_NAME, { detail: slug }));
};

const setActiveSlug = (slug: string | null) => {
  if (typeof window === 'undefined') return;
  const normalized = normalizeSlug(slug);
  const current = getStoredSlug();
  if (!normalized) {
    if (current !== null) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    dispatchChange(null);
    return;
  }
  if (current !== normalized) {
    window.localStorage.setItem(STORAGE_KEY, normalized);
  }
  dispatchChange(normalized);
};

const onChange = (handler: WorkspaceChangeHandler) => {
  if (typeof window === 'undefined') return () => undefined;
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<string | null>).detail ?? null;
    handler(detail);
  };
  listenerMap.set(handler, listener);
  window.addEventListener(EVENT_NAME, listener as EventListener);
  return () => {
    const stored = listenerMap.get(handler);
    if (stored) {
      window.removeEventListener(EVENT_NAME, stored as EventListener);
      listenerMap.delete(handler);
    }
  };
};

export const workspaceSync = {
  storageKey: STORAGE_KEY,
  eventName: EVENT_NAME,
  getStoredSlug,
  setActiveSlug,
  onChange,
  clear: () => setActiveSlug(null),
};

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    const normalized = normalizeSlug(event.newValue);
    if (!normalized && event.newValue) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    dispatchChange(normalized);
  });
}
