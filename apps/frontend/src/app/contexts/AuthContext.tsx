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
import { UserRoleSchema, type OrganizationKind, type UserRole } from '@guap/types';
import {
  authClient,
  fetchConvexAuthToken,
  getBetterAuthSession,
  refreshBetterAuthSession,
  type BetterAuthSession,
} from '~/shared/services/authClient';
import { clearConvexAuthToken, setConvexAuthToken } from '~/shared/services/convexClient';
import { recordAuthFailure, recordAuthSignOut, resetAuthTelemetry } from '~/shared/services/telemetry';
import { toast } from 'solid-sonner';
import { AppPaths } from '~/app/routerPaths';
import {
  encodeSignupState,
  storeSignupState,
  SIGNUP_STATE_QUERY_PARAM,
  getPendingInvitations,
  removePendingInvitation,
  clearPendingInvitations,
  type SignupState,
} from '~/features/auth/utils/authFlowStorage';

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

  const acceptPendingInvitations = async (): Promise<boolean> => {
    const pending = getPendingInvitations();
    if (!pending.length) {
      return false;
    }

    let acceptedAny = false;
    for (const invitationId of pending) {
      try {
        await authClient.organization.acceptInvitation({ invitationId });
        removePendingInvitation(invitationId);
        acceptedAny = true;
      } catch (error) {
        console.warn('Pending invitation acceptance failed', invitationId, error);
        removePendingInvitation(invitationId);
      }
    }

    return acceptedAny;
  };

  const redeemOneTimeToken = async () => {
    if (typeof window === 'undefined') return;
    const currentUrl = new URL(window.location.href);
    const token = currentUrl.searchParams.get('ott');
    if (!token) return;

    try {
      const oneTimeTokenClient = (authClient as unknown as {
        oneTimeToken?: { verify?: (input: { token: string }) => Promise<unknown> };
      }).oneTimeToken;
      if (!oneTimeTokenClient || typeof oneTimeTokenClient.verify !== 'function') {
        console.warn('Better Auth one-time token client unavailable');
        return;
      }
      const crossDomainVerify = (authClient as unknown as {
        crossDomain?: {
          oneTimeToken?: { verify?: (input: { token: string }) => Promise<unknown> };
          updateSession?: () => void;
        };
      }).crossDomain?.oneTimeToken?.verify;

      if (typeof crossDomainVerify === 'function') {
        await crossDomainVerify({ token });
        (authClient as unknown as {
          crossDomain?: { updateSession?: () => void };
        }).crossDomain?.updateSession?.();
      } else {
        await oneTimeTokenClient.verify({ token });
      }
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

      const invitationsAccepted = await acceptPendingInvitations();
      if (invitationsAccepted) {
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
      const organizationKind = payload.organizationKind ?? 'family';
      const signupState: SignupState = {
        role: payload.role,
        organizationKind,
        ...(payload.organizationName ? { organizationName: payload.organizationName.trim() } : {}),
      };

      storeSignupState(signupState);
      const encodedState = encodeSignupState(signupState);

      const buildCallbackUrl = (path: string) => {
        if (typeof window === 'undefined') {
          return path;
        }
        try {
          const url = new URL(path, window.location.origin);
          url.searchParams.set(SIGNUP_STATE_QUERY_PARAM, encodedState);
          return url.toString();
        } catch (error) {
          console.warn('Failed to build signup callback URL', error);
          return path;
        }
      };

      const callbackURL = buildCallbackUrl(AppPaths.app);
      const newUserCallbackURL = buildCallbackUrl(AppPaths.completeSignup);
      const result = await authClient.signIn.magicLink({
        email: trimmedEmail,
        name: trimmedName,
        callbackURL,
        newUserCallbackURL,
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
    clearPendingInvitations();
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
