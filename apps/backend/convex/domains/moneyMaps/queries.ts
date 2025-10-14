import { z } from 'zod';
import { defineQuery } from '../../core/functions';
import { MoneyMapChangeStatusSchema, type MoneyMapChangeStatus } from '@guap/types';
import {
  ALL_ROLES,
  ensureOrganizationAccess,
  ensureRole,
  loadSnapshot,
} from './services';

const LoadArgsShape = {
  organizationId: z.string(),
} as const;
const LoadArgsSchema = z.object(LoadArgsShape);

export const load = defineQuery({
  args: LoadArgsShape,
  handler: async (ctx, args) => {
    const parsed = LoadArgsSchema.parse(args);
    await ensureOrganizationAccess(ctx, parsed.organizationId);
    const map = await ctx.db
      .query('moneyMaps')
      .withIndex('by_organization', (q: any) => q.eq('organizationId', parsed.organizationId))
      .unique();

    if (!map) {
      return null;
    }

    return await loadSnapshot(ctx.db, map._id);
  },
});

const ListChangeRequestsShape = {
  organizationId: z.string(),
  status: MoneyMapChangeStatusSchema.optional(),
} as const;
const ListChangeRequestsSchema = z.object(ListChangeRequestsShape);

export const listChangeRequests = defineQuery({
  args: ListChangeRequestsShape,
  handler: async (ctx, args) => {
    const parsed = ListChangeRequestsSchema.parse(args);
    const session = await ensureOrganizationAccess(ctx, parsed.organizationId);
    ensureRole(session, ALL_ROLES);

    const baseQuery = ctx.db
      .query('moneyMapChangeRequests')
      .withIndex('by_organization_status', (q: any) => q.eq('organizationId', parsed.organizationId));

    const records = parsed.status
      ? await baseQuery.eq('status', parsed.status as MoneyMapChangeStatus).collect()
      : await baseQuery.collect();

    return records.sort((a: any, b: any) => b.createdAt - a.createdAt);
  },
});
