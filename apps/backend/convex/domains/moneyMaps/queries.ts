import { query } from '../../_generated/server';
import { v } from 'convex/values';
import type { MoneyMapChangeStatus } from '@guap/types';
import {
  ALL_ROLES,
  changeStatusArg,
  ensureOrganizationAccess,
  ensureRole,
  loadSnapshot,
} from './services';

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

export const listChangeRequests = query({
  args: {
    organizationId: v.string(),
    status: v.optional(changeStatusArg),
  },
  handler: async (ctx, args) => {
    const session = await ensureOrganizationAccess(ctx, args.organizationId);
    ensureRole(session, ALL_ROLES);

    let requests;
    if (args.status) {
      requests = await ctx.db
        .query('moneyMapChangeRequests')
        .withIndex('by_organization_status', (q: any) =>
          q.eq('organizationId', args.organizationId).eq(
            'status',
            args.status as MoneyMapChangeStatus
          )
        )
        .collect();
    } else {
      requests = await ctx.db
        .query('moneyMapChangeRequests')
        .withIndex('by_organization_status', (q: any) =>
          q.eq('organizationId', args.organizationId)
        )
        .collect();
    }

    return requests.sort((a, b) => b.createdAt - a.createdAt);
  },
});
