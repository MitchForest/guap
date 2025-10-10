import { createAuthClient } from 'better-auth/react';
import { convexClient } from '@convex-dev/better-auth/client/plugins';

const baseURL = import.meta.env.VITE_CONVEX_SITE_URL;

type BetterAuthClient = ReturnType<typeof createAuthClient>;

type ExtendedAuthClient = BetterAuthClient & {
  session: {
    get: () => Promise<BetterAuthSession | null>;
  };
  convex: {
    token: () => Promise<ConvexTokenResponse>;
  };
  updateSession: () => Promise<void>;
};

export const authClient = createAuthClient({
  baseURL: baseURL ?? undefined,
  plugins: [convexClient()],
}) as unknown as ExtendedAuthClient;

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

export const getBetterAuthSession = async (): Promise<BetterAuthSession | null> =>
  await authClient.session.get();

export const fetchConvexAuthToken = async (): Promise<ConvexTokenResponse> =>
  await authClient.convex.token();

export const refreshBetterAuthSession = async () => {
  await authClient.updateSession();
};
