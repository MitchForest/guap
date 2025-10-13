import {
  createContext,
  useContext,
  createSignal,
  onCleanup,
  onMount,
  type Accessor,
  type Component,
  type JSX,
} from 'solid-js';
import { api } from '@guap/api/codegen/api';
import { UserRoleSchema, type OrganizationKind, type UserRole } from '@guap/types';
import {
  authClient,
  fetchConvexAuthToken,
  getBetterAuthSession,
  refreshBetterAuthSession,
  type BetterAuthSession,
} from '~/lib/authClient';
import { convex, clearConvexAuthToken, setConvexAuthToken } from '~/services/convexClient';
import { recordAuthFailure, recordAuthSignOut, resetAuthTelemetry } from '~/services/telemetry';
import { toast } from 'solid-sonner';
import { AppPaths } from '~/routerPaths';

type SignUpRequest = {
  email: string;
  name: string;
  role: UserRole;
  organizationName?: string;
  organizationKind?: OrganizationKind;
};

type SessionUserPayload = Record<string, unknown> & {
  id?: string;
  email?: string;
  name?: string;
  role?: string;
  activeOrganizationId?: string;
  organizationId?: string;
  householdId?: string;
  profileId?: string;
  organizationMembershipId?: string | null;
};

type SessionInfo = { raw: BetterAuthSession; user: SessionUserPayload };

export type AuthUser = {
  authId: string;
  profileId: string;
  householdId?: string | null;
  organizationId?: string | null;
  organizationMembershipId?: string | null;
  email?: string;
  displayName: string;
  role: UserRole;
};

type AuthContextValue = {
  user: Accessor<AuthUser | null>;
  isLoading: Accessor<boolean>;
  isAuthenticated: Accessor<boolean>;
  signIn: (email: string, name?: string) => Promise<void>;
  signUp: (payload: SignUpRequest) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  error: Accessor<string | null>;
};

const AuthContext = createContext<AuthContextValue>();

const AuthProvider: Component<{ children: JSX.Element }> = (props) => {
  const [user, setUser] = createSignal<AuthUser | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  let hydrating = false;

  const parseSessionUser = (session: BetterAuthSession | null): SessionInfo | null => {
    if (!session) {
      return null;
    }
    const merged: SessionUserPayload = {
      ...session.user,
      ...(session.session?.user ?? {}),
    };
    return { raw: session, user: merged };
  };

  const refreshSessionUser = async (): Promise<SessionInfo | null> => {
    const refreshed = await refreshBetterAuthSession().catch((error) => {
      console.warn('Better Auth session refresh failed', error);
      return null;
    });
    if (!refreshed) {
      return null;
    }
    return parseSessionUser(refreshed);
  };

  const bootstrapSignup = async (): Promise<boolean> => {
    try {
      const result = await convex.mutation(api.signup.bootstrap, {});
      return Boolean(result?.shouldRefresh);
    } catch (error) {
      console.warn('Signup bootstrap failed', error);
      return false;
    }
  };

  const redeemOneTimeToken = async () => {
    if (typeof window === 'undefined') return;
    const currentUrl = new URL(window.location.href);
    const token = currentUrl.searchParams.get('ott');
    if (!token) return;

    try {
      if (!authClient.oneTimeToken) {
        console.warn('Better Auth one-time token client unavailable');
        return;
      }
      await authClient.oneTimeToken.verify({ token });
      await authClient.getSession({ query: { disableCookieCache: true } });
    } catch (error) {
      console.error('Failed to redeem Better Auth one-time token', error);
    } finally {
      currentUrl.searchParams.delete('ott');
      window.history.replaceState({}, '', currentUrl.toString());
    }
  };

  const hydrateFromSession = async (options?: { refresh?: boolean }) => {
    if (hydrating) return;
    hydrating = true;
    setIsLoading(true);
    try {
      let sessionInfo = options?.refresh ? await refreshSessionUser() : null;
      if (!sessionInfo) {
        const initial = await getBetterAuthSession();
        sessionInfo = parseSessionUser(initial ?? null);
      }

      if (!sessionInfo) {
        clearConvexAuthToken();
        setUser(null);
        setError(null);
        return;
      }

      let sessionUser = sessionInfo.user;
      const baseName = sessionUser.name ?? sessionUser.email ?? 'Member';

      const accessToken = await fetchConvexAuthToken().catch((error) => {
        console.warn('Failed to fetch Convex auth token', error);
        return null;
      });

      if (accessToken && accessToken.length > 0) {
        setConvexAuthToken(accessToken);
      } else {
        clearConvexAuthToken();
      }

      const bootstrapped = await bootstrapSignup();
      if (bootstrapped) {
        const refreshed = await refreshSessionUser();
        if (refreshed) {
          sessionUser = refreshed.user;
        }
      }


      const organizationId =
        typeof sessionUser.activeOrganizationId === 'string'
          ? sessionUser.activeOrganizationId
          : typeof sessionUser.organizationId === 'string'
            ? sessionUser.organizationId
            : null;
      let resolvedRole: UserRole = 'member';
      const parsedRole = UserRoleSchema.safeParse(sessionUser.role);
      if (parsedRole.success) {
        resolvedRole = parsedRole.data;
      }
      sessionUser = {
        ...sessionUser,
        role: resolvedRole,
      };
      const householdId =
        typeof sessionUser.householdId === 'string'
          ? sessionUser.householdId
          : organizationId;

      const authId = typeof sessionUser.id === 'string' ? sessionUser.id : null;
      if (!authId) {
        throw new Error('Session is missing user id');
      }

      const profileId =
        typeof sessionUser.profileId === 'string' ? sessionUser.profileId : authId;

      const organizationMembershipId =
        typeof sessionUser.organizationMembershipId === 'string'
          ? sessionUser.organizationMembershipId
          : null;

      const email = typeof sessionUser.email === 'string' ? sessionUser.email : undefined;

      const active: AuthUser = {
        authId,
        profileId,
        householdId,
        organizationId,
        organizationMembershipId,
        email,
        displayName: baseName,
        role: resolvedRole,
      };

      setUser(active);
      setError(null);
      resetAuthTelemetry();
    } catch (error) {
      console.error('Auth session hydrate failed', error);
      setUser(null);
      clearConvexAuthToken();
      await authClient
        .signOut()
        .catch((signOutError) => console.warn('Better Auth sign out failed', signOutError));
      setError(error instanceof Error ? error.message : 'Unable to refresh session');
      recordAuthFailure(error instanceof Error ? error.message : undefined);
      toast.error('Session refresh failed. Please sign in again.');
    } finally {
      setIsLoading(false);
      hydrating = false;
    }
  };

  onMount(() => {
    void (async () => {
      await redeemOneTimeToken();
      await hydrateFromSession();
    })();
    if (typeof window !== 'undefined') {
      const handleFocus = () => void hydrateFromSession({ refresh: true });
      const handleVisibility = () => {
        if (!document.hidden) {
          void hydrateFromSession({ refresh: true });
        }
      };
      window.addEventListener('focus', handleFocus);
      document.addEventListener('visibilitychange', handleVisibility);
      onCleanup(() => {
        window.removeEventListener('focus', handleFocus);
        document.removeEventListener('visibilitychange', handleVisibility);
      });
    }
  });

  const signIn = async (email: string, name?: string) => {
    setIsLoading(true);
    try {
      const result = await authClient.signIn.magicLink({
        email,
        name,
        callbackURL: AppPaths.app,
        newUserCallbackURL: AppPaths.app,
        errorCallbackURL: AppPaths.signIn,
      });
      if (result.error) {
        throw new Error(result.error.message);
      }
      setError(null);
      toast.success('Magic link sent! Check your email to continue.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to sign in';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (payload: SignUpRequest) => {
    setIsLoading(true);
    try {
      const trimmedEmail = payload.email.trim();
      const trimmedName = payload.name.trim();
      await convex
        .mutation(api.signup.record, {
          email: trimmedEmail,
          role: payload.role,
          organizationName: payload.organizationName?.trim() || null,
          organizationKind: payload.organizationKind ?? 'family',
        })
        .catch((error) => {
          console.error('Signup record mutation failed', error);
          throw new Error('Unable to prepare signup');
        });
      const result = await authClient.signIn.magicLink({
        email: trimmedEmail,
        name: trimmedName,
        callbackURL: AppPaths.app,
        newUserCallbackURL: AppPaths.app,
        errorCallbackURL: AppPaths.signIn,
      });
      if (result.error) {
        throw new Error(result.error.message ?? 'Sign up failed');
      }
      setError(null);
      toast.success('Magic link sent! Check your email to finish signing up.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to sign up';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await authClient.signOut();
    } catch (error) {
      console.warn('Better Auth sign out error', error);
    }
    clearConvexAuthToken();
    setUser(null);
    setError(null);
    recordAuthSignOut();
    toast.success('Signed out. See you soon!');
  };

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: () => !!user(),
    signIn,
    signUp,
    signOut,
    refresh: hydrateFromSession,
    error,
  };

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>;
};

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export { AuthProvider, useAuth };
