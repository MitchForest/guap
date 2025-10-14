import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod';
import type { Id } from '@guap/api/codegen/dataModel';
import {
  MoneyMapChangeStatusSchema,
  MoneyMapSaveInputSchema,
  type MoneyMapSaveInput,
  type MoneyMapChangeStatus,
  type MoneyMapNodeKind,
  type MoneyMapRuleTrigger,
} from '@guap/types';
import { defineMutation } from '../../core/functions';
import {
  ALL_ROLES,
  OWNER_ADMIN_ROLES,
  ensureOrganizationAccess,
  ensureRole,
  loadSnapshot,
  now,
  scrubMetadata,
} from './services';

const SaveArgsSchema = MoneyMapSaveInputSchema.shape;

export const save = defineMutation({
  args: SaveArgsSchema,
  handler: async (ctx, args) => {
    const payload = MoneyMapSaveInputSchema.parse(args) as MoneyMapSaveInput;
    const session = await ensureOrganizationAccess(ctx, payload.organizationId);
    ensureRole(session, ALL_ROLES);

    const timestamp = now();

    const existing = await ctx.db
      .query('moneyMaps')
      .withIndex('by_organization', (q: any) => q.eq('organizationId', payload.organizationId))
      .unique();

    let mapId: Id<'moneyMaps'>;
    if (existing) {
      if (existing.organizationId !== payload.organizationId) {
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
        organizationId: payload.organizationId,
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
    await Promise.all(existingNodes.map((record: any) => ctx.db.delete(record._id)));

    const existingEdges = await ctx.db
      .query('moneyMapEdges')
      .withIndex('by_map', (q: any) => q.eq('mapId', mapId))
      .collect();
    await Promise.all(existingEdges.map((record: any) => ctx.db.delete(record._id)));

    const existingRules = await ctx.db
      .query('moneyMapRules')
      .withIndex('by_map', (q: any) => q.eq('mapId', mapId))
      .collect();
    await Promise.all(existingRules.map((record: any) => ctx.db.delete(record._id)));

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

const SubmitChangeRequestArgs = {
  mapId: zid('moneyMaps'),
  organizationId: z.string(),
  submitterId: z.string(),
  summary: z.string().optional(),
  payload: MoneyMapSaveInputSchema,
} as const;

export const submitChangeRequest = defineMutation({
  args: SubmitChangeRequestArgs,
  handler: async (ctx, args) => {
    const mapId = args.mapId as Id<'moneyMaps'>;
    const organizationId = z.string().parse(args.organizationId);
    const submitterId = z.string().parse(args.submitterId);
    const summary = args.summary ?? undefined;

    const payload = MoneyMapSaveInputSchema.parse(args.payload) as MoneyMapSaveInput;
    const session = await ensureOrganizationAccess(ctx, organizationId);
    ensureRole(session, ['member']);

    const map = await ctx.db.get(mapId);
    if (!map || map.organizationId !== organizationId) {
      throw new Error('Money map not found for organization');
    }

    const normalizedPayload = {
      ...payload,
      nodes: payload.nodes.map((node) => ({
        ...node,
        metadata: scrubMetadata(node.metadata ?? undefined),
      })),
      edges: payload.edges.map((edge) => ({
        ...edge,
        metadata: scrubMetadata(edge.metadata ?? undefined),
      })),
      rules: payload.rules.map((rule) => {
        const config = { ...rule.config } as Record<string, unknown>;
        if (config.triggerNodeId === null) {
          delete config.triggerNodeId;
        }
        return { ...rule, config };
      }),
    };

    const timestamp = now();

    return await ctx.db.insert('moneyMapChangeRequests', {
      mapId,
      organizationId,
      submitterId,
      status: 'awaiting_admin',
      summary,
      payload: normalizedPayload,
      createdAt: timestamp,
      resolvedAt: undefined,
      updatedAt: timestamp,
    });
  },
});

const UpdateChangeRequestStatusArgs = {
  requestId: zid('moneyMapChangeRequests'),
  status: MoneyMapChangeStatusSchema,
} as const;

export const updateChangeRequestStatus = defineMutation({
  args: UpdateChangeRequestStatusArgs,
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error('Change request not found');
    }

    const session = await ensureOrganizationAccess(ctx, request.organizationId);

    const isWithdraw = args.status === 'withdrawn';
    if (isWithdraw) {
      if (!session.userId || session.userId !== request.submitterId) {
        throw new Error('Only the submitter can withdraw this request');
      }
    } else {
      ensureRole(session, OWNER_ADMIN_ROLES);
    }

    const timestamp = now();
    await ctx.db.patch(args.requestId, {
      status: args.status as MoneyMapChangeStatus,
      resolvedAt:
        args.status === 'approved' ||
        args.status === 'rejected' ||
        args.status === 'withdrawn'
          ? timestamp
          : undefined,
      updatedAt: timestamp,
    });
  },
});
