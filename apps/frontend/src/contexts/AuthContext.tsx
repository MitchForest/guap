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
import type { OrganizationKind, UserRole } from '@guap/types';
import {
  authClient,
  fetchConvexAuthToken,
  getBetterAuthSession,
  refreshBetterAuthSession,
  type BetterAuthSession,
} from '~/lib/authClient';
import { clearConvexAuthToken, setConvexAuthToken } from '~/services/convexClient';
import { useRole } from '~/contexts/RoleContext';
import { workspaceSync } from '~/domains/workspaces/state/workspaceSync';
import { guapApi } from '~/services/guapApi';
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

  const createDefaultHousehold = async (profileId: string, displayName: string) => {
    const householdId = await guapApi.createHousehold({
      name: `${displayName}'s Household`,
      slug: generateSlug(displayName),
      creatorUserId: profileId,
      plan: 'free',
    });

    await guapApi.updateUserProfile({
      userId: profileId,
      householdId,
    });

    return householdId;
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
    let session: BetterAuthSession | null = null;
    try {
      if (options?.refresh) {
        const refreshed = await refreshBetterAuthSession().catch((error) => {
          console.warn('Better Auth session refresh failed', error);
          return null;
        });
        if (refreshed) {
          session = refreshed;
        }
      }
      session = session ?? (await getBetterAuthSession());
      console.log('Auth hydrate: session result', session);
      if (!session?.user) {
        clearConvexAuthToken();
        setUser(null);
        workspaceSync.clear();
        setError(null);
        return;
      }

      const baseName = session.user.name ?? session.user.email ?? 'Member';
      const pending = getPendingSignup();
      if (pending && session.user.email && pending.email && pending.email !== session.user.email) {
        clearPendingSignup();
      }
      const accessToken = await fetchConvexAuthToken();
      console.log('Auth hydrate: convex token', accessToken);

      if (!accessToken) {
        console.warn('No Convex token received from Better Auth');
      }

      if (accessToken) {
        setConvexAuthToken(accessToken);
      } else {
        clearConvexAuthToken();
      }

      const pendingInvite = getPendingInvite();

      let profile = await guapApi.getUserProfile(session.user.id);
      console.log('Auth hydrate: session loaded', {
        sessionUser: session.user,
        hasAccessToken: !!accessToken,
        hasProfile: !!profile,
      });

      if (!profile) {
        const emailAddress = session.user.email;
        if (!emailAddress) {
          throw new Error('Authenticated user is missing an email address');
        }
        const pending = getPendingSignup();
        if (pending?.email && pending.email !== emailAddress) {
          clearPendingSignup();
        }
        const profileId = await guapApi.createProfile({
          authId: session.user.id,
          email: emailAddress,
          displayName: pending?.name ?? baseName,
          role: pending?.role ?? 'student',
        });
        profile = await guapApi.getUserById(profileId);
      }

      if (!profile) {
        throw new Error('Unable to resolve profile');
      }

      if (pending) {
        let processedPending = false;
        try {
          if (pending.role === 'admin') {
            if (!profile.primaryOrganizationId) {
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
                userId: session.user.id,
              });
              if (result.error) {
                throw new Error(result.error.message ?? 'Unable to create organization');
              }
              toast.success('Organization created! Invite your team from the roster page.');
              processedPending = true;
            } else {
              processedPending = true;
            }
          } else {
            processedPending = true;
          }
        } catch (pendingError) {
          console.error('Pending signup completion failed', pendingError);
          toast.error(
            pendingError instanceof Error
              ? pendingError.message
              : 'We were unable to finish onboarding automatically.'
          );
        }

        if (processedPending) {
          const refreshed = await guapApi.getUserById(profile._id);
          if (refreshed) {
            profile = refreshed;
          }
          clearPendingSignup();
        } else {
          clearPendingSignup();
        }
      }

      let householdId = profile.householdId ?? null;
      if (!householdId && !pendingInvite) {
        householdId = await createDefaultHousehold(profile._id, profile.displayName ?? baseName);
        profile = await guapApi.getUserById(profile._id);
        if (!profile) {
          throw new Error('Unable to resolve profile after household creation');
        }
      }

      const acceptedInvite = await processPendingInvite(pendingInvite);
      if (acceptedInvite) {
        const refreshedProfile = await guapApi.getUserById(profile._id);
        if (refreshedProfile) {
          profile = refreshedProfile;
          householdId = refreshedProfile.householdId ?? householdId;
        }
      }

      const active: AuthUser = {
        authId: profile.authId,
        profileId: profile._id,
        householdId,
        organizationId: profile.primaryOrganizationId ?? null,
        organizationMembershipId: profile.defaultMembershipId ?? null,
        email: profile.email ?? session.user.email ?? undefined,
        displayName: profile.displayName ?? baseName,
        role: profile.role,
      };

      console.log('Auth hydrate: setting user', active);
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
      workspaceSync.clear();
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
    workspaceSync.clear();
    setUser(null);
    setRole('student');
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
