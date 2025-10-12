import type { GenericCtx } from '@convex-dev/better-auth';
import type { DataModel } from '@guap/api/codegen/dataModel';
import { requireAuth } from './auth';

type SessionInfo = {
  authUser: unknown;
  role: string | null;
  activeOrganizationId: string | null;
  profileId: string | null;
};

const extractValue = (value: unknown, key: string): any => {
  if (!value || typeof value !== 'object') return null;
  if (key in (value as Record<string, unknown>)) {
    return (value as Record<string, unknown>)[key];
  }
  return null;
};

export const getSessionInfo = async (ctx: GenericCtx<DataModel>): Promise<SessionInfo> => {
  const authUser = await requireAuth(ctx);
  const session = (authUser as any)?.session ?? {};
  const sessionUser = session?.user ?? {};
  const baseUser = (authUser as any)?.user ?? {};

  const role =
    extractValue(sessionUser, 'role') ??
    extractValue(baseUser, 'role') ??
    null;

  const activeOrganizationId =
    extractValue(sessionUser, 'activeOrganizationId') ??
    extractValue(sessionUser, 'organizationId') ??
    extractValue(baseUser, 'activeOrganizationId') ??
    extractValue(baseUser, 'organizationId') ??
    null;

  const profileId =
    extractValue(sessionUser, 'profileId') ??
    extractValue(baseUser, 'profileId') ??
    null;

  return {
    authUser,
    role: typeof role === 'string' ? role : null,
    activeOrganizationId: typeof activeOrganizationId === 'string' ? activeOrganizationId : null,
    profileId: typeof profileId === 'string' ? profileId : null,
  };
};

export const ensureOrganizationAccess = async (
  ctx: GenericCtx<DataModel>,
  organizationId: string
): Promise<SessionInfo> => {
  const session = await getSessionInfo(ctx);
  if (!organizationId) {
    throw new Error('Organization id is required');
  }
  if (session.activeOrganizationId && session.activeOrganizationId !== organizationId) {
    throw new Error('Access denied for organization');
  }
  return session;
};

export const ensureRole = (session: SessionInfo, allowedRoles: Array<string>) => {
  if (!allowedRoles.length) return;
  if (!session.role || !allowedRoles.includes(session.role)) {
    throw new Error('Insufficient permissions');
  }
};
