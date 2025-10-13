import { createAuthClient } from 'better-auth/solid';
import {
  adminClient,
  magicLinkClient,
  organizationClient,
  oneTimeTokenClient,
  jwtClient,
} from 'better-auth/client/plugins';
import { convexClient } from '@convex-dev/better-auth/client/plugins';

const baseURL = import.meta.env.VITE_AUTH_BASE_URL ?? undefined;

export const authClient = createAuthClient({
  baseURL,
  plugins: [
    convexClient(),
    magicLinkClient(),
    organizationClient(),
    adminClient(),
    oneTimeTokenClient(),
    jwtClient(),
  ],
});

export type AuthClient = typeof authClient;

type SessionResponse = Awaited<ReturnType<typeof authClient.getSession>>;
export type BetterAuthSession = NonNullable<SessionResponse['data']>;

const unwrapSession = (response: SessionResponse) => {
  if (!response || response.error) {
    return null;
  }
  return response.data ?? null;
};

export const getBetterAuthSession = async () => {
  const response = await authClient.getSession();
  return unwrapSession(response);
};

export const refreshBetterAuthSession = async () => {
  const response = await authClient.getSession({
    query: {
      disableCookieCache: true,
    },
  });
  return unwrapSession(response);
};

export const fetchConvexAuthToken = async () => {
  const client = authClient as unknown as {
    convex?: {
      token?: () => Promise<{ data?: { token?: string | null } | null } | null>;
    };
  };
  const result = await client.convex?.token?.();
  return result?.data?.token ?? null;
};
