import { mutation } from '../../_generated/server';
import type { Id } from '@guap/api/codegen/dataModel';
import { v } from 'convex/values';
import {
  MoneyMapNodeKindValues,
  MoneyMapRuleTriggerValues,
  MoneyMapSaveInputSchema,
  type MoneyMapChangeStatus,
  type MoneyMapNodeKind,
  type MoneyMapRuleTrigger,
} from '@guap/types';
import {
  ALL_ROLES,
  OWNER_ADMIN_ROLES,
  changeStatusArg,
  ensureOrganizationAccess,
  ensureRole,
  loadSnapshot,
  now,
  scrubMetadata,
  enumArg,
} from './services';

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
    ensureRole(session, ALL_ROLES);
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
    ensureRole(session, OWNER_ADMIN_ROLES);

    const timestamp = now();
    await ctx.db.patch(args.requestId, {
      status: args.status as MoneyMapChangeStatus,
      resolvedAt:
        args.status === 'approved' || args.status === 'rejected' ? timestamp : undefined,
      updatedAt: timestamp,
    });
  },
});
