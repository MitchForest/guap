import { createAuthClient } from 'better-auth/solid';
import { magicLinkClient, organizationClient, adminClient } from 'better-auth/client/plugins';
import { createAccessControl } from 'better-auth/plugins/access';
import { convexClient, crossDomainClient } from '@convex-dev/better-auth/client/plugins';

type ResolvedBaseSettings = {
  baseURL?: string;
  basePath?: string;
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const resolveBaseSettings = (raw?: string): ResolvedBaseSettings => {
  if (!raw) {
    return {};
  }

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

// Better Auth needs the Convex HTTP endpoint (.convex.site). Fall back to VITE_CONVEX_URL
// if the site-specific variable isn’t provided.
const rawBaseUrl =
  import.meta.env.VITE_CONVEX_SITE_URL ?? import.meta.env.VITE_CONVEX_URL ?? undefined;

const { baseURL, basePath } = resolveBaseSettings(rawBaseUrl);

const organizationStatements = {
  organization: ['read', 'update', 'delete'],
  member: ['create', 'update', 'delete'],
  invitation: ['create', 'cancel'],
} as const;

const organizationAccessControl = createAccessControl<typeof organizationStatements>(organizationStatements);

const ownerRole = organizationAccessControl.newRole({
  organization: ['read', 'update', 'delete'],
  member: ['create', 'update', 'delete'],
  invitation: ['create', 'cancel'],
}) as any;

const adminRole = organizationAccessControl.newRole({
  organization: ['read', 'update'],
  member: ['create', 'update'],
  invitation: ['create', 'cancel'],
}) as any;

const memberRole = organizationAccessControl.newRole({
  organization: ['read'],
}) as any;

const guardianRole = organizationAccessControl.newRole({
  organization: ['read'],
  invitation: ['create'],
}) as any;

const studentRole = organizationAccessControl.newRole({}) as any;

const organizationRoles = {
  owner: ownerRole,
  admin: adminRole,
  member: memberRole,
  guardian: guardianRole,
  student: studentRole,
};

const clientOptions = {
  baseURL,
  basePath,
  plugins: [
    convexClient(),
    crossDomainClient(),
    magicLinkClient(),
    organizationClient({
      ac: organizationAccessControl,
      roles: organizationRoles,
      dynamicAccessControl: {
        enabled: false,
      },
      teams: {
        enabled: false,
      },
    }),
    adminClient(),
  ],
};

type SessionQueryOptions = {
  disableCookieCache?: boolean;
  disableRefresh?: boolean;
};

type SessionApi = {
  getSession: (args?: { query?: SessionQueryOptions }) => Promise<{
    data: BetterAuthSession | null;
    error: { message?: string | null } | null;
  }>;
};

type ConvexApi = {
  convex: {
    token: () => Promise<ConvexTokenResponse>;
  };
};

type RawAuthClient = ReturnType<typeof createAuthClient<typeof clientOptions>>;

const hasSessionApi = (value: RawAuthClient): value is RawAuthClient & SessionApi => {
  const candidate = value as Partial<SessionApi>;
  return typeof candidate.getSession === 'function';
};

const hasConvexApi = (value: RawAuthClient): value is RawAuthClient & ConvexApi => {
  const candidate = value as Partial<ConvexApi>;
  return typeof candidate.convex?.token === 'function';
};

const ensureAuthClientCapabilities = (
  client: RawAuthClient,
): RawAuthClient & SessionApi & ConvexApi => {
  if (!hasSessionApi(client)) {
    throw new Error('Better Auth client missing session helpers');
  }
  if (!hasConvexApi(client)) {
    throw new Error('Better Auth client missing convex token helper');
  }

  return client;
};

export const authClient = ensureAuthClientCapabilities(createAuthClient(clientOptions));

export type AuthClient = typeof authClient;

export type BetterAuthSession = {
  session: {
    id: string;
    token?: string | null;
  };
  user: {
    id: string;
    email?: string | null;
    name?: string | null;
  };
};

type ConvexTokenResponse = {
  data?: {
    token?: string | null;
  } | null;
};

type SessionFetchResult = Awaited<ReturnType<SessionApi['getSession']>>;

const unwrapSessionResponse = (response: SessionFetchResult): BetterAuthSession | null => {
  if (response.error) {
    return null;
  }
  const payload = response.data;
  if (!payload) {
    return null;
  }
  if (typeof (payload as { data?: unknown }).data !== 'undefined') {
    const inner = (payload as { data?: unknown; error?: unknown }).data;
    return (inner ?? null) as BetterAuthSession | null;
  }
  return payload as unknown as BetterAuthSession | null;
};

export const getBetterAuthSession = async (
  query?: SessionQueryOptions,
): Promise<BetterAuthSession | null> => {
  const response = await authClient.getSession(query ? { query } : undefined);
  console.log('getBetterAuthSession: raw response', response);
  const session = unwrapSessionResponse(response);
  console.log('getBetterAuthSession: unwrapped session', session);
  return session;
};

type ConvexTokenResult = Awaited<ReturnType<(typeof authClient)['convex']['token']>>;

const extractConvexToken = (result: ConvexTokenResult): string | null => {
  if (!result?.data) return null;
  const wrapped = result.data as ConvexTokenResponse;
  return wrapped?.data?.token ?? (result.data as unknown as { token?: string })?.token ?? null;
};

export const fetchConvexAuthToken = async (): Promise<string | null> => {
  const result = await authClient.convex.token();
  if (result.error) {
    throw new Error(result.error.message ?? 'Failed to fetch Convex auth token');
  }
  return extractConvexToken(result);
};

export const refreshBetterAuthSession = async (): Promise<BetterAuthSession | null> => {
  try {
    const response = await authClient.getSession({
      query: {
        disableCookieCache: true,
      },
    });
    return unwrapSessionResponse(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('aborted') || message.includes('Failed to fetch')) {
      // Treat aborted or transient network fetches as a cache miss.
      return null;
    }
    throw error;
  }
};
