import type { OrganizationKind, UserRole } from '@guap/types';

const SIGNUP_STATE_STORAGE_KEY = 'guap.auth.signupState';
const PENDING_INVITATIONS_STORAGE_KEY = 'guap.auth.pendingInvitations';

export const SIGNUP_STATE_QUERY_PARAM = 'signup';

export type SignupState = {
  role: UserRole;
  organizationKind: OrganizationKind;
  organizationName?: string;
};

const isBrowser = () => typeof window !== 'undefined';

export const encodeSignupState = (state: SignupState): string => {
  try {
    return btoa(encodeURIComponent(JSON.stringify(state)));
  } catch (error) {
    console.warn('Failed to encode signup state', error);
    return '';
  }
};

export const decodeSignupState = (value: string | null | undefined): SignupState | null => {
  if (!value) {
    return null;
  }
  try {
    const json = decodeURIComponent(atob(value));
    const parsed = JSON.parse(json) as SignupState;
    if (!parsed || typeof parsed.role !== 'string' || typeof parsed.organizationKind !== 'string') {
      return null;
    }
    return parsed;
  } catch (error) {
    console.warn('Failed to decode signup state', error);
    return null;
  }
};

export const storeSignupState = (state: SignupState) => {
  if (!isBrowser()) return;
  try {
    const payload: SignupState = {
      role: state.role,
      organizationKind: state.organizationKind,
      ...(state.organizationName ? { organizationName: state.organizationName } : {}),
    };
    window.sessionStorage.setItem(SIGNUP_STATE_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Failed to store signup state', error);
  }
};

export const consumeSignupState = (): SignupState | null => {
  if (!isBrowser()) return null;
  try {
    const raw = window.sessionStorage.getItem(SIGNUP_STATE_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    window.sessionStorage.removeItem(SIGNUP_STATE_STORAGE_KEY);
    const parsed = JSON.parse(raw) as SignupState;
    if (!parsed || typeof parsed.role !== 'string' || typeof parsed.organizationKind !== 'string') {
      return null;
    }
    return parsed;
  } catch (error) {
    console.warn('Failed to read signup state', error);
    return null;
  }
};

const readPendingInvitations = (): string[] => {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(PENDING_INVITATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter((value) => value.length > 0);
  } catch (error) {
    console.warn('Failed to read pending invitations', error);
    return [];
  }
};

const writePendingInvitations = (values: string[]) => {
  if (!isBrowser()) return;
  try {
    if (!values.length) {
      window.localStorage.removeItem(PENDING_INVITATIONS_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(PENDING_INVITATIONS_STORAGE_KEY, JSON.stringify(values));
  } catch (error) {
    console.warn('Failed to persist pending invitations', error);
  }
};

export const rememberPendingInvitation = (invitationId: string) => {
  const trimmed = invitationId.trim();
  if (!trimmed) return;
  const current = readPendingInvitations();
  if (current.includes(trimmed)) return;
  writePendingInvitations([...current, trimmed]);
};

export const getPendingInvitations = (): string[] => readPendingInvitations();

export const removePendingInvitation = (invitationId: string) => {
  const trimmed = invitationId.trim();
  if (!trimmed) return;
  const filtered = readPendingInvitations().filter((value) => value !== trimmed);
  writePendingInvitations(filtered);
};

export const clearPendingInvitations = () => {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(PENDING_INVITATIONS_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear pending invitations', error);
  }
};
