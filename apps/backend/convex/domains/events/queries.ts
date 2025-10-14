import { z } from 'zod';
import { defineQuery } from '../../core/functions';
import { ensureOrganizationAccess } from '../../core/session';

const ListEventsArgs = {
  organizationId: z.string(),
  limit: z.number().int().min(1).max(100).optional(),
} as const;

export const listForOrganization = defineQuery({
  args: ListEventsArgs,
  handler: async (ctx, rawArgs) => {
    const args = z.object(ListEventsArgs).parse(rawArgs);
    await ensureOrganizationAccess(ctx, args.organizationId);
    const limit = args.limit ?? 50;

    const events = await ctx.db
      .query('eventsJournal')
      .withIndex('by_organization_time', (q: any) =>
        q.eq('organizationId', args.organizationId)
      )
      .order('desc')
      .take(limit);

    return events;
  },
});
