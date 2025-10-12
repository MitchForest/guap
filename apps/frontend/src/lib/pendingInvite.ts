type PendingInvite = {
  invitationId?: string | null;
};

const STORAGE_KEY = 'pendingInvite';

const normalize = (value: PendingInvite | null): PendingInvite | null => {
  if (!value) return null;
  const invitationId = value.invitationId?.trim();
  if (!invitationId) return null;
  return { invitationId };
};

export const getPendingInvite = (): PendingInvite | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingInvite;
    return normalize(parsed);
  } catch {
    return null;
  }
};

export const setPendingInvite = (value: PendingInvite) => {
  if (typeof window === 'undefined') return;
  const normalized = normalize(value);
  if (!normalized) {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
};

export const clearPendingInvite = () => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(STORAGE_KEY);
};
