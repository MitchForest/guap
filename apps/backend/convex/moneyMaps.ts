import { mutation, query } from './_generated/server';
import type { Id } from '@guap/api/codegen/dataModel';
import { v } from 'convex/values';
import {
  MoneyMapChangeStatusValues,
  MoneyMapNodeKindValues,
  MoneyMapRuleTriggerValues,
  MoneyMapSaveInputSchema,
  UserRoleValues,
} from '@guap/types';
import type {
  MoneyMapChangeStatus,
  MoneyMapNodeKind,
  MoneyMapRuleTrigger,
} from '@guap/types';
import { authComponent } from './auth';

const now = () => Date.now();

const enumArg = <const T extends readonly string[]>(values: T) =>
  v.union(...values.map((value) => v.literal(value)));

const nodeInputArg = v.object({
  key: v.string(),
  kind: enumArg(MoneyMapNodeKindValues),
  label: v.string(),
  metadata: v.optional(v.record(v.string(), v.any())),
});

const edgeInputArg = v.object({
  sourceKey: v.string(),
  targetKey: v.string(),
  metadata: v.optional(v.record(v.string(), v.any())),
});

const ruleInputArg = v.object({
  key: v.string(),
  trigger: enumArg(MoneyMapRuleTriggerValues),
  config: v.record(v.string(), v.any()),
});

const changeStatusArg = enumArg(MoneyMapChangeStatusValues);

type CanonicalRole = (typeof UserRoleValues)[number];
type SessionSnapshot = {
  activeOrganizationId: string | null;
  role: CanonicalRole | null;
  userId: string | null;
};

const ROLE_SET = new Set<string>(UserRoleValues);

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

const requireSession = async (ctx: unknown): Promise<SessionSnapshot> => {
  const authUser = await authComponent.getAuthUser(ctx as any);
  if (!authUser) {
    throw new Error('Authentication required');
  }
  return extractSession(authUser);
};

const ensureOrganizationAccess = async (
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

const ensureRole = (
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

const scrubMetadata = (metadata: Record<string, unknown> | undefined) => {
  if (!metadata) return undefined;
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value !== null && value !== undefined) {
      cleaned[key] = value;
    }
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
};

const loadSnapshot = async (db: any, mapId: Id<'moneyMaps'>) => {
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

export const load = query({
  args: {
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    await ensureOrganizationAccess(ctx, args.organizationId);
    const map = await ctx.db
      .query('moneyMaps')
      .withIndex('by_organization', (q: any) => q.eq('organizationId', args.organizationId))
      .unique();

    if (!map) {
      return null;
    }

    return await loadSnapshot(ctx.db, map._id);
  },
});

export const save = mutation({
  args: {
    organizationId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    nodes: v.array(nodeInputArg),
    edges: v.array(edgeInputArg),
    rules: v.array(ruleInputArg),
  },
  handler: async (ctx, args) => {
    const session = await ensureOrganizationAccess(ctx, args.organizationId);
    ensureRole(session, UserRoleValues);
    const timestamp = now();

    const payload = MoneyMapSaveInputSchema.parse({
      organizationId: args.organizationId,
      name: args.name,
      description: args.description ?? undefined,
      nodes: args.nodes,
      edges: args.edges,
      rules: args.rules,
    });

    if (payload.organizationId !== args.organizationId) {
      throw new Error('Money map organization mismatch');
    }

    const existing = await ctx.db
      .query('moneyMaps')
      .withIndex('by_organization', (q: any) => q.eq('organizationId', args.organizationId))
      .unique();

    let mapId: Id<'moneyMaps'>;
    if (existing) {
      if (existing.organizationId !== args.organizationId) {
        throw new Error('Money map organization mismatch');
      }
      await ctx.db.patch(existing._id, {
        name: payload.name,
        description: payload.description ?? undefined,
        updatedAt: timestamp,
      });
      mapId = existing._id;
    } else {
      mapId = await ctx.db.insert('moneyMaps', {
        organizationId: args.organizationId,
        name: payload.name,
        description: payload.description ?? undefined,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    const existingNodes = await ctx.db
      .query('moneyMapNodes')
      .withIndex('by_map', (q: any) => q.eq('mapId', mapId))
      .collect();
    for (const record of existingNodes) {
      await ctx.db.delete(record._id);
    }

    const existingEdges = await ctx.db
      .query('moneyMapEdges')
      .withIndex('by_map', (q: any) => q.eq('mapId', mapId))
      .collect();
    for (const record of existingEdges) {
      await ctx.db.delete(record._id);
    }

    const existingRules = await ctx.db
      .query('moneyMapRules')
      .withIndex('by_map', (q: any) => q.eq('mapId', mapId))
      .collect();
    for (const record of existingRules) {
      await ctx.db.delete(record._id);
    }

    for (const node of payload.nodes) {
      await ctx.db.insert('moneyMapNodes', {
        mapId,
        key: node.key,
        kind: node.kind as MoneyMapNodeKind,
        label: node.label,
        metadata: scrubMetadata(node.metadata ?? undefined),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    for (const edge of payload.edges) {
      await ctx.db.insert('moneyMapEdges', {
        mapId,
        sourceKey: edge.sourceKey,
        targetKey: edge.targetKey,
        metadata: scrubMetadata(edge.metadata ?? undefined),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    for (const rule of payload.rules) {
      const config = { ...rule.config } as Record<string, unknown>;
      if (config.triggerNodeId === null) {
        delete config.triggerNodeId;
      }
      await ctx.db.insert('moneyMapRules', {
        mapId,
        key: rule.key,
        trigger: rule.trigger as MoneyMapRuleTrigger,
        config,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    return await loadSnapshot(ctx.db, mapId);
  },
});

export const submitChangeRequest = mutation({
  args: {
    mapId: v.id('moneyMaps'),
    organizationId: v.string(),
    submitterId: v.string(),
    summary: v.optional(v.string()),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const session = await ensureOrganizationAccess(ctx, args.organizationId);
    ensureRole(session, ['member']);

    const map = await ctx.db.get(args.mapId);
    if (!map || map.organizationId !== args.organizationId) {
      throw new Error('Money map not found for organization');
    }

    const parsedPayload = MoneyMapSaveInputSchema.parse(args.payload);
    if (parsedPayload.organizationId !== args.organizationId) {
      throw new Error('Money map payload organization mismatch');
    }

    const normalizedPayload = {
      ...parsedPayload,
      nodes: parsedPayload.nodes.map((node) => ({
        ...node,
        metadata: scrubMetadata(node.metadata ?? undefined),
      })),
      edges: parsedPayload.edges.map((edge) => ({
        ...edge,
        metadata: scrubMetadata(edge.metadata ?? undefined),
      })),
      rules: parsedPayload.rules.map((rule) => {
        const config = { ...rule.config } as Record<string, unknown>;
        if (config.triggerNodeId === null) {
          delete config.triggerNodeId;
        }
        return { ...rule, config };
      }),
    };

    const timestamp = now();

    return await ctx.db.insert('moneyMapChangeRequests', {
      mapId: args.mapId,
      organizationId: args.organizationId,
      submitterId: args.submitterId,
      status: 'awaiting_admin',
      summary: args.summary ?? undefined,
      payload: normalizedPayload,
      createdAt: timestamp,
      resolvedAt: undefined,
      updatedAt: timestamp,
    });
  },
});

export const updateChangeRequestStatus = mutation({
  args: {
    requestId: v.id('moneyMapChangeRequests'),
    status: changeStatusArg,
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error('Change request not found');
    }
    const session = await ensureOrganizationAccess(ctx, request.organizationId);
    ensureRole(
      session,
      UserRoleValues.filter((role) => role === 'owner' || role === 'admin')
    );

    const timestamp = now();
    await ctx.db.patch(args.requestId, {
      status: args.status as MoneyMapChangeStatus,
      resolvedAt:
        args.status === 'approved' || args.status === 'rejected' ? timestamp : undefined,
      updatedAt: timestamp,
    });
  },
});

export const listChangeRequests = query({
  args: {
    organizationId: v.string(),
    status: v.optional(changeStatusArg),
  },
  handler: async (ctx, args) => {
    const session = await ensureOrganizationAccess(ctx, args.organizationId);
    ensureRole(session, UserRoleValues);

    let requests;
    if (args.status) {
      requests = await ctx.db
        .query('moneyMapChangeRequests')
        .withIndex('by_organization_status', (q: any) =>
          q.eq('organizationId', args.organizationId).eq('status', args.status as MoneyMapChangeStatus)
        )
        .collect();
    } else {
      requests = await ctx.db
        .query('moneyMapChangeRequests')
        .withIndex('by_organization_status', (q: any) => q.eq('organizationId', args.organizationId))
        .collect();
    }

    return requests.sort((a, b) => b.createdAt - a.createdAt);
  },
});
