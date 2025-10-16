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
    const session = await ensureOrganizationAccess(ctx, args.organizationId);
    const profileId = session.userId;
    const limit = args.limit ?? 50;

    const events = await ctx.db
      .query('eventsJournal')
      .withIndex('by_organization_time', (q: any) =>
        q.eq('organizationId', args.organizationId)
      )
      .order('desc')
      .take(limit);

    if (!profileId) {
      return events.map((event: any) => ({ ...event, receipt: null }));
    }

    const receiptResults = await Promise.all(
      events.map(async (event: any) => {
        const receipt = await ctx.db
          .query('eventReceipts')
          .withIndex('by_profile_event', (q: any) =>
            q.eq('profileId', profileId).eq('eventId', event._id)
          )
          .unique();
        return [event._id, receipt] as const;
      })
    );

    const receiptMap = new Map(
      receiptResults
        .filter(([, receipt]) => Boolean(receipt))
        .map(([eventId, receipt]: readonly [string, any]) => [eventId, receipt])
    );

    return events.map((event: any) => {
      const receipt = receiptMap.get(event._id) ?? null;
      return {
        ...event,
        receipt: receipt
          ? {
              eventId: receipt.eventId,
              deliveredAt: receipt.deliveredAt ?? null,
              readAt: receipt.readAt ?? null,
            }
          : null,
      };
    });
  },
});
