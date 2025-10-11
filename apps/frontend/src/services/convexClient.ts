import { createConvexClient } from '@guap/api';

const convexUrl = import.meta.env.VITE_CONVEX_URL || 'http://localhost:3000';

export const convex = createConvexClient(convexUrl);

type AuthTokenFetcher = (args: { forceRefreshToken: boolean }) =>
  | Promise<string | null>
  | string
  | null;

let currentToken: string | null = null;
let authConfigured = false;

const applyAuthFetcher = () => {
  const client = convex as unknown as { setAuth?: (fetcher: AuthTokenFetcher) => void };
  if (typeof client.setAuth !== 'function') {
    return;
  }
  const fetcher: AuthTokenFetcher = async () => currentToken;
  client.setAuth(fetcher);
  authConfigured = true;
};

export const setConvexAuthToken = (token: string | null) => {
  currentToken = typeof token === 'string' && token.length > 0 ? token : null;
  try {
    applyAuthFetcher();
  } catch (error) {
    console.warn('Failed to register Convex auth fetcher', error);
  }
};

export const clearConvexAuthToken = () => {
  currentToken = null;
  if (authConfigured) {
    try {
      applyAuthFetcher();
    } catch (error) {
      console.warn('Failed to clear Convex auth fetcher', error);
    }
  }
};
