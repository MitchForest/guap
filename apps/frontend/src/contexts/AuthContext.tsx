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
import {
  BetterAuthSessionSchema,
  UserRoleSchema,
  type BetterAuthSessionUser,
  type OrganizationKind,
  type UserRole,
} from '@guap/types';
import {
  authClient,
  fetchConvexAuthToken,
  getBetterAuthSession,
  refreshBetterAuthSession,
  type BetterAuthSession,
} from '~/lib/authClient';
import { clearConvexAuthToken, setConvexAuthToken } from '~/services/convexClient';
import { useRole } from '~/contexts/RoleContext';
import { recordAuthFailure, recordAuthSignOut, resetAuthTelemetry } from '~/services/telemetry';
import { toast } from 'solid-sonner';
import { AppPaths } from '~/routerPaths';
import { getPendingInvite, clearPendingInvite } from '~/lib/pendingInvite';

type SignUpRequest = {
  email: string;
  name: string;
  role: UserRole;
  organizationName?: string;
  organizationKind?: OrganizationKind;
};

type PendingSignup = Partial<SignUpRequest> & { email: string };

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

const generateSlug = (seed: string) => {
  const base = seed.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') || 'household';
  const suffix =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${base}-${suffix}`;
};

const AuthProvider: Component<{ children: JSX.Element }> = (props) => {
  const { setRole } = useRole();
  const [user, setUser] = createSignal<AuthUser | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  let hydrating = false;

  const getPendingSignup = () => {
    if (typeof window === 'undefined') return null;
    const raw = window.sessionStorage.getItem('pendingSignup');
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as PendingSignup;
      return parsed?.email ? parsed : null;
    } catch {
      return null;
    }
  };

  const setPendingSignup = (payload: SignUpRequest) => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem('pendingSignup', JSON.stringify(payload));
  };

  const clearPendingSignup = () => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem('pendingSignup');
  };

  const parseSessionUser = (session: BetterAuthSession | null) => {
    if (!session) {
      return null;
    }
    const parsed = BetterAuthSessionSchema.safeParse(session);
    if (!parsed.success) {
      console.error('Unable to parse Better Auth session payload', parsed.error);
      throw new Error('Invalid session payload from Better Auth');
    }
    const merged: BetterAuthSessionUser = {
      ...parsed.data.user,
      ...(parsed.data.session?.user ?? {}),
    };
    return { raw: parsed.data, user: merged };
  };

  const refreshSessionUser = async () => {
    const refreshed = await refreshBetterAuthSession().catch((error) => {
      console.warn('Better Auth session refresh failed', error);
      return null;
    });
    if (!refreshed) {
      return null;
    }
    return parseSessionUser(refreshed);
  };

  const ensureGuardianOrganization = async (
    pending: PendingSignup,
    sessionUser: BetterAuthSessionUser
  ) => {
    if (pending.role !== 'guardian') {
      return sessionUser;
    }

    const hasOrganization =
      !!sessionUser.activeOrganizationId ||
      !!sessionUser.organizationId ||
      !!sessionUser.householdId;

    if (hasOrganization) {
      return sessionUser;
    }

    if (!pending.organizationName) {
      throw new Error('Organization name is required to finish admin onboarding.');
    }

    const kind: OrganizationKind = pending.organizationKind ?? 'family';
    const organizationType = kind === 'institution' ? 'school' : 'household';
    const slug = generateSlug(pending.organizationName);
    const result = await authClient.organization.create({
      name: pending.organizationName,
      slug,
      metadata: {
        type: organizationType,
      },
      userId: sessionUser.id,
    });
    if (result.error) {
      throw new Error(result.error.message ?? 'Unable to create organization');
    }
    toast.success('Organization created! Invite your team from the roster page.');
    const refreshed = await refreshSessionUser();
    return refreshed?.user ?? sessionUser;
  };

  const processPendingInvite = async (pending: ReturnType<typeof getPendingInvite>) => {
    if (!pending?.invitationId) return false;
    try {
      const result = await authClient.organization.acceptInvitation({
        invitationId: pending.invitationId,
      });
      if (result.error) {
        throw new Error(result.error.message ?? 'Unable to accept invite');
      }
      clearPendingInvite();
      toast.success('Invite accepted! Your account has been linked.');
      return true;
    } catch (error) {
      console.error('Pending invite acceptance failed', error);
      toast.error('We could not accept that invite. You can try again from the Invitations page.');
      return false;
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
      const pending = getPendingSignup();
      if (pending && sessionUser.email && pending.email && pending.email !== sessionUser.email) {
        clearPendingSignup();
      }
      const accessToken = await fetchConvexAuthToken().catch((error) => {
        console.warn('Failed to fetch Convex auth token', error);
        return null;
      });

      if (accessToken && accessToken.length > 0) {
        setConvexAuthToken(accessToken);
      } else {
        clearConvexAuthToken();
      }

      const pendingInvite = getPendingInvite();

      if (pending) {
        let processedPending = false;
        try {
          sessionUser = await ensureGuardianOrganization(pending, sessionUser);
          processedPending = true;
        } catch (pendingError) {
          console.error('Pending signup completion failed', pendingError);
          toast.error(
            pendingError instanceof Error
              ? pendingError.message
              : 'We were unable to finish onboarding automatically.'
          );
        }

        if (processedPending) {
          clearPendingSignup();
        } else {
          clearPendingSignup();
        }
      }

      const acceptedInvite = await processPendingInvite(pendingInvite);
      if (acceptedInvite) {
        const refreshed = await refreshSessionUser();
        if (refreshed) {
          sessionUser = refreshed.user;
        }
      }

      const roleResult = UserRoleSchema.safeParse(sessionUser.role);
      const resolvedRole: UserRole = roleResult.success ? roleResult.data : 'child';
      const organizationId =
        sessionUser.activeOrganizationId ?? sessionUser.organizationId ?? null;
      const householdId = sessionUser.householdId ?? organizationId;

      const active: AuthUser = {
        authId: sessionUser.id,
        profileId: sessionUser.profileId ?? sessionUser.id,
        householdId,
        organizationId,
        organizationMembershipId: sessionUser.organizationMembershipId ?? null,
        email: sessionUser.email,
        displayName: baseName,
        role: resolvedRole,
      };

      setUser(active);
      setRole(active.role);
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
    void hydrateFromSession();
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
      setPendingSignup(payload);
      const result = await authClient.signIn.magicLink({
        email: payload.email,
        name: payload.name,
        callbackURL: AppPaths.app,
        newUserCallbackURL: AppPaths.app,
        errorCallbackURL: AppPaths.signIn,
      });
      if (result.error) {
        clearPendingSignup();
        throw new Error(result.error.message ?? 'Sign up failed');
      }
      setError(null);
      toast.success('Magic link sent! Check your email to finish signing up.');
    } catch (err) {
      clearPendingSignup();
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
    setRole('child');
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
