import { UserRoleValues } from '@guap/types';
import { authComponent } from './auth';

export type SessionSnapshot = {
  activeOrganizationId: string | null;
  role: (typeof UserRoleValues)[number] | null;
  userId: string | null;
};

const ROLE_SET = new Set<string>(UserRoleValues);
export const ALL_ROLES: ReadonlyArray<(typeof UserRoleValues)[number]> = [...UserRoleValues];
export const OWNER_ADMIN_ROLES: ReadonlyArray<(typeof UserRoleValues)[number]> = ALL_ROLES.filter(
  (role): role is (typeof UserRoleValues)[number] => role === 'owner' || role === 'admin'
);

const extractSession = (authUser: unknown): SessionSnapshot => {
  const merged = {
    ...((authUser as any)?.user ?? {}),
    ...(((authUser as any)?.session?.user) ?? {}),
  } as Record<string, unknown>;

  const activeOrganizationId =
    typeof merged.activeOrganizationId === 'string'
      ? (merged.activeOrganizationId as string)
      : typeof merged.organizationId === 'string'
        ? (merged.organizationId as string)
        : null;

  const role =
    typeof merged.role === 'string' && ROLE_SET.has(merged.role)
      ? (merged.role as (typeof UserRoleValues)[number])
      : null;

  const userId = typeof merged.id === 'string' ? (merged.id as string) : null;

  return {
    activeOrganizationId,
    role,
    userId,
  };
};

export const requireSession = async (ctx: unknown): Promise<SessionSnapshot> => {
  const authUser = await authComponent.getAuthUser(ctx as any);
  if (!authUser) {
    throw new Error('Authentication required');
  }
  return extractSession(authUser);
};

export const ensureOrganizationAccess = async (
  ctx: unknown,
  organizationId: string
): Promise<SessionSnapshot> => {
  if (!organizationId) {
    throw new Error('Organization id is required');
  }
  const session = await requireSession(ctx);
  if (session.activeOrganizationId && session.activeOrganizationId !== organizationId) {
    throw new Error('Access denied for organization');
  }
  return session;
};

export const ensureRole = (
  session: SessionSnapshot,
  allowedRoles: ReadonlyArray<(typeof UserRoleValues)[number]>
) => {
  if (!allowedRoles.length) {
    return;
  }
  if (!session.role || !allowedRoles.includes(session.role)) {
    throw new Error('Insufficient permissions');
  }
};
