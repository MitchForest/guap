import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod';
import { defineMutation } from '../../core/functions';
import { ensureOrganizationAccess } from '../../core/session';

const MarkEventReadArgs = {
  eventId: zid('eventsJournal'),
} as const;

export const markEventRead = defineMutation({
  args: MarkEventReadArgs,
  handler: async (ctx, rawArgs) => {
    const args = z.object(MarkEventReadArgs).parse(rawArgs);
    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    const session = await ensureOrganizationAccess(ctx, event.organizationId);
    const profileId = session.userId;
    if (!profileId) {
      throw new Error('Profile required to mark events read');
    }

    const existing = await ctx.db
      .query('eventReceipts')
      .withIndex('by_profile_event', (q: any) => q.eq('profileId', profileId).eq('eventId', args.eventId))
      .unique();

    const readAt = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        readAt,
      });
      return { eventId: args.eventId, readAt };
    }

    const receiptId = await ctx.db.insert('eventReceipts', {
      eventId: args.eventId,
      profileId,
      deliveredAt: readAt,
      readAt,
    });

    return { eventId: args.eventId, readAt, receiptId };
  },
});
