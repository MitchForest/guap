import { createAuthClient } from 'better-auth/solid';
import { convexClient, crossDomainClient } from '@convex-dev/better-auth/client/plugins';
import {
  adminClient,
  jwtClient,
  magicLinkClient,
  oneTimeTokenClient,
  organizationClient,
} from 'better-auth/client/plugins';

type ResolvedBaseSettings = {
  baseURL?: string;
  basePath?: string;
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const resolveBaseSettings = (raw?: string): ResolvedBaseSettings => {
  if (!raw) return {};
  try {
    const url = new URL(raw);
    const normalizedPath = trimTrailingSlash(url.pathname);
    if (normalizedPath.endsWith('/api/auth/convex')) {
      return { baseURL: url.origin, basePath: '/api/auth' };
    }
    if (normalizedPath.endsWith('/api/auth')) {
      return { baseURL: url.origin, basePath: '/api/auth' };
    }
    return { baseURL: raw };
  } catch {
    return { baseURL: raw };
  }
};

const rawBaseUrl =
  import.meta.env.VITE_CONVEX_SITE_URL ?? import.meta.env.VITE_CONVEX_URL ?? undefined;

const { baseURL, basePath } = resolveBaseSettings(rawBaseUrl);

const authClientOptions = {
  ...(baseURL ? { baseURL } : {}),
  ...(basePath ? { basePath } : {}),
  plugins: [
    convexClient(),
    crossDomainClient(),
    magicLinkClient(),
    organizationClient(),
    adminClient(),
    oneTimeTokenClient(),
    jwtClient(),
  ],
};

export const authClient = createAuthClient(authClientOptions);

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
