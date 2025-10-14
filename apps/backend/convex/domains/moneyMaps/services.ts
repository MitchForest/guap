import type { Id } from '@guap/api/codegen/dataModel';
import { UserRoleValues } from '@guap/types';
import { authComponent } from '../../core/auth';

export const now = () => Date.now();

type CanonicalRole = (typeof UserRoleValues)[number];

export type SessionSnapshot = {
  activeOrganizationId: string | null;
  role: CanonicalRole | null;
  userId: string | null;
};

const ROLE_SET = new Set<string>(UserRoleValues);
export const ALL_ROLES: ReadonlyArray<CanonicalRole> = [...UserRoleValues];
export const OWNER_ADMIN_ROLES: ReadonlyArray<CanonicalRole> = ALL_ROLES.filter(
  (role): role is CanonicalRole => role === 'owner' || role === 'admin'
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
      ? (merged.role as CanonicalRole)
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
  allowedRoles: ReadonlyArray<CanonicalRole>
) => {
  if (!allowedRoles.length) {
    return;
  }
  if (!session.role || !allowedRoles.includes(session.role)) {
    throw new Error('Insufficient permissions');
  }
};

export const scrubMetadata = (metadata: Record<string, unknown> | undefined) => {
  if (!metadata) return undefined;
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value !== null && value !== undefined) {
      cleaned[key] = value;
    }
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
};

export const loadSnapshot = async (db: any, mapId: Id<'moneyMaps'>) => {
  const map = await db.get(mapId);
  if (!map) {
    throw new Error('Money map not found');
  }

  const [nodes, edges, rules] = await Promise.all([
    db
      .query('moneyMapNodes')
      .withIndex('by_map', (q: any) => q.eq('mapId', mapId))
      .collect(),
    db
      .query('moneyMapEdges')
      .withIndex('by_map', (q: any) => q.eq('mapId', mapId))
      .collect(),
    db
      .query('moneyMapRules')
      .withIndex('by_map', (q: any) => q.eq('mapId', mapId))
      .collect(),
  ]);

  return { map, nodes, edges, rules };
};
