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
import type { UserRole } from '@guap/types';
import {
  authClient,
  fetchConvexAuthToken,
  getBetterAuthSession,
  refreshBetterAuthSession,
} from '~/lib/authClient';
import { clearConvexAuthToken, setConvexAuthToken } from '~/services/convexClient';
import { useRole } from '~/contexts/RoleContext';
import { workspaceSync } from '~/domains/workspaces/state/workspaceSync';
import { guapApi } from '~/services/guapApi';
import { recordAuthFailure, recordAuthSignOut, resetAuthTelemetry } from '~/services/telemetry';
import { toast } from 'solid-sonner';

export type AuthUser = {
  authId: string;
  profileId: string;
  householdId?: string | null;
  email?: string;
  displayName: string;
  role: UserRole;
};

type AuthContextValue = {
  user: Accessor<AuthUser | null>;
  isLoading: Accessor<boolean>;
  isAuthenticated: Accessor<boolean>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, role: UserRole) => Promise<void>;
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

const upsertProfile = async (payload: {
  authId: string;
  email?: string;
  displayName: string;
  role: UserRole;
}) => {
  const result = await guapApi.ensureUser({
    authId: payload.authId,
    email: payload.email,
    displayName: payload.displayName,
    role: payload.role,
  });
  return result;
};

const AuthProvider: Component<{ children: JSX.Element }> = (props) => {
  const { setRole } = useRole();
  const [user, setUser] = createSignal<AuthUser | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  let hydrating = false;

  const createDefaultHousehold = async (profileId: string, displayName: string) => {
    const householdId = await guapApi.createHousehold({
      name: `${displayName}'s Household`,
      slug: generateSlug(displayName),
      creatorUserId: profileId,
    });

    await guapApi.updateUserProfile({
      userId: profileId,
      householdId,
    });

    return householdId;
  };

  const hydrateFromSession = async (options?: { refresh?: boolean }) => {
    if (hydrating) return;
    hydrating = true;
    setIsLoading(true);
    try {
      if (options?.refresh) {
        await refreshBetterAuthSession().catch((error) => {
          console.warn('Better Auth session refresh failed', error);
        });
      }
      const session = await getBetterAuthSession();
      if (!session?.user) {
        clearConvexAuthToken();
        setUser(null);
        workspaceSync.clear();
        setError(null);
        return;
      }

      const baseName = session.user.name ?? session.user.email ?? 'Member';
      const tokenResult = await fetchConvexAuthToken();
      const accessToken = tokenResult?.data?.token ?? null;

      if (!accessToken) {
        console.warn('No Convex token received from Better Auth');
      }

      if (accessToken) {
        setConvexAuthToken(accessToken);
      } else {
        clearConvexAuthToken();
      }

      let profile = await guapApi.getUserProfile(session.user.id);

      if (!profile) {
        const emailAddress = session.user.email;
        if (!emailAddress) {
          throw new Error('Authenticated user is missing an email address');
        }
        const profileId = await guapApi.createProfile({
          authId: session.user.id,
          email: emailAddress,
          displayName: baseName,
          role: 'kid',
        });
        profile = await guapApi.getUserById(profileId);
      }

      if (!profile) {
        throw new Error('Unable to resolve profile');
      }

      let householdId = profile.householdId ?? null;
      if (!householdId) {
        householdId = await createDefaultHousehold(profile._id, profile.displayName ?? baseName);
        profile = await guapApi.getUserById(profile._id);
        if (!profile) {
          throw new Error('Unable to resolve profile after household creation');
        }
      }

      const active: AuthUser = {
        authId: profile.authId,
        profileId: profile._id,
        householdId,
        email: profile.email ?? session.user.email ?? undefined,
        displayName: profile.displayName ?? baseName,
        role: profile.role,
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

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) {
        throw new Error(result.error.message);
      }
      await hydrateFromSession({ refresh: true });
      setError(null);
      toast.success('Signed in successfully.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to sign in';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name: string, role: UserRole) => {
    setIsLoading(true);
    try {
      const result = await authClient.signUp.email({ email, password, name });
      if (result.error || !result.data) {
        throw new Error(result.error?.message ?? 'Sign up failed');
      }
      const profileId = await upsertProfile({
        authId: result.data.user.id,
        email,
        displayName: name,
        role,
      });
      if (role === 'guardian') {
        await createDefaultHousehold(profileId, name);
      }
      await hydrateFromSession({ refresh: true });
      setError(null);
      toast.success('Welcome to Guap!');
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
    workspaceSync.clear();
    setUser(null);
    setRole('kid');
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
