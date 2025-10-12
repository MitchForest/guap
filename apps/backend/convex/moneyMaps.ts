import { mutation, query } from './_generated/server';
import type { Id } from '@guap/api/codegen/dataModel';
import { v } from 'convex/values';
import {
  MoneyMapChangeStatusValues,
  MoneyMapNodeKindValues,
  MoneyMapRuleTriggerValues,
} from '@guap/types';
import type {
  MoneyMapChangeStatus,
  MoneyMapNodeKind,
  MoneyMapRuleTrigger,
} from '@guap/types';
import { ensureOrganizationAccess, ensureRole } from './authorization';

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
    ensureRole(session, ['guardian', 'child']);
    const timestamp = now();

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
        name: args.name,
        description: args.description ?? undefined,
        updatedAt: timestamp,
      });
      mapId = existing._id;
    } else {
      mapId = await ctx.db.insert('moneyMaps', {
        organizationId: args.organizationId,
        name: args.name,
        description: args.description ?? undefined,
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

    for (const node of args.nodes) {
      await ctx.db.insert('moneyMapNodes', {
        mapId,
        key: node.key,
        kind: node.kind as MoneyMapNodeKind,
        label: node.label,
        metadata: node.metadata ?? undefined,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    for (const edge of args.edges) {
      await ctx.db.insert('moneyMapEdges', {
        mapId,
        sourceKey: edge.sourceKey,
        targetKey: edge.targetKey,
        metadata: edge.metadata ?? undefined,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    for (const rule of args.rules) {
      await ctx.db.insert('moneyMapRules', {
        mapId,
        key: rule.key,
        trigger: rule.trigger as MoneyMapRuleTrigger,
        config: rule.config,
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
    payload: v.record(v.string(), v.any()),
  },
  handler: async (ctx, args) => {
    const session = await ensureOrganizationAccess(ctx, args.organizationId);
    ensureRole(session, ['child']);

    const map = await ctx.db.get(args.mapId);
    if (!map || map.organizationId !== args.organizationId) {
      throw new Error('Money map not found for organization');
    }

    const timestamp = now();

    return await ctx.db.insert('moneyMapChangeRequests', {
      mapId: args.mapId,
      organizationId: args.organizationId,
      submitterId: args.submitterId,
      status: 'awaiting_guardian',
      summary: args.summary ?? undefined,
      payload: args.payload,
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
    ensureRole(session, ['guardian']);

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
    ensureRole(session, ['guardian', 'child']);

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
