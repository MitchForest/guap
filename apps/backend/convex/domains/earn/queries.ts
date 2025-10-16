import { z } from 'zod';
import {
  IncomeStreamStatusSchema,
  EarnSummarySchema,
  EarnTimelineEntrySchema,
} from '@guap/types';
import { defineQuery } from '../../core/functions';
import { ensureOrganizationAccess } from '../../core/session';
import {
  calculateMonthlyAmount,
  buildEarnProjections,
  createStreamAllocationLookup,
} from './services';

const ListStreamsArgs = {
  organizationId: z.string(),
  status: IncomeStreamStatusSchema.optional(),
} as const;

const GetStreamArgs = {
  organizationId: z.string(),
  incomeStreamId: z.string(),
} as const;

const SummaryArgs = {
  organizationId: z.string(),
} as const;

const TimelineArgs = {
  organizationId: z.string(),
  limit: z.number().int().min(1).max(100).optional(),
} as const;

const relevantEventKinds = new Set(['income_request', 'income_completed', 'income_skipped']);

export const listForOrganization = defineQuery({
  args: ListStreamsArgs,
  handler: async (ctx, rawArgs) => {
    const args = z.object(ListStreamsArgs).parse(rawArgs);
    await ensureOrganizationAccess(ctx, args.organizationId);

    const baseQuery = ctx.db
      .query('incomeStreams')
      .withIndex('by_organization_status', (q: any) =>
        q.eq('organizationId', args.organizationId)
      );

    const records = await baseQuery.collect();
    const filtered = args.status
      ? records.filter((stream: any) => stream.status === args.status)
      : records;

    return filtered.sort((a: any, b: any) => a.createdAt - b.createdAt);
  },
});

export const getById = defineQuery({
  args: GetStreamArgs,
  handler: async (ctx, rawArgs) => {
    const args = z.object(GetStreamArgs).parse(rawArgs);
    await ensureOrganizationAccess(ctx, args.organizationId);
    const stream = await ctx.db.get(args.incomeStreamId as any);
    if (!stream || stream.organizationId !== args.organizationId) {
      return null;
    }
    return stream;
  },
});

export const summarizeForOrganization = defineQuery({
  args: SummaryArgs,
  handler: async (ctx, rawArgs) => {
    const args = z.object(SummaryArgs).parse(rawArgs);
    await ensureOrganizationAccess(ctx, args.organizationId);

    const streams = await ctx.db
      .query('incomeStreams')
      .withIndex('by_organization_status', (q: any) =>
        q.eq('organizationId', args.organizationId)
      )
      .collect();

    const activeStreams = streams.filter((stream: any) => stream.status === 'active');
    const totalMonthlyCents = activeStreams.reduce((sum: number, stream: any) => {
      const amountCents = Math.round(stream.amount?.cents ?? 0);
      return sum + calculateMonthlyAmount(amountCents, stream.cadence);
    }, 0);

    const upcoming = activeStreams
      .filter((stream: any) => typeof stream.nextScheduledAt === 'number')
      .sort(
        (a: any, b: any) =>
          (a.nextScheduledAt ?? Number.MAX_SAFE_INTEGER) - (b.nextScheduledAt ?? Number.MAX_SAFE_INTEGER)
      )[0];

    const limit = 50;
    const events = await ctx.db
      .query('eventsJournal')
      .withIndex('by_organization_time', (q: any) => q.eq('organizationId', args.organizationId))
      .order('desc')
      .take(limit);

    const completionEvents = events.filter((event: any) => event.eventKind === 'income_completed');
    const now = Date.now();
    const streakLength = completionEvents.filter(
      (event: any) => now - (event.createdAt ?? 0) <= 30 * 24 * 60 * 60 * 1000
    ).length;
    const lastCompletedAt = completionEvents[0]?.createdAt ?? null;

    const allocationLookup = await createStreamAllocationLookup(ctx.db, {
      organizationId: args.organizationId,
    });

    const streamById = new Map(activeStreams.map((stream: any) => [stream._id, stream]));
    const projections = buildEarnProjections(activeStreams, { now: Date.now() }).map((entry) => {
      const stream = streamById.get(entry.streamId) as any | null | undefined;
      return {
        ...entry,
        allocations: allocationLookup(stream ?? null),
      };
    });

    const summary = {
      totalMonthlyCents,
      activeStreams: activeStreams.length,
      upcomingPayout: upcoming
        ? {
            streamId: upcoming._id,
            streamName: upcoming.name,
            scheduledAt: upcoming.nextScheduledAt,
            amount: upcoming.amount,
            autoScheduled: upcoming.autoSchedule,
          }
        : null,
      streakLength,
      lastCompletedAt,
      projections,
    };

    return EarnSummarySchema.parse(summary);
  },
});

export const timelineForOrganization = defineQuery({
  args: TimelineArgs,
  handler: async (ctx, rawArgs) => {
    const args = z.object(TimelineArgs).parse(rawArgs);
    await ensureOrganizationAccess(ctx, args.organizationId);
    const limit = args.limit ?? 50;

    const events = await ctx.db
      .query('eventsJournal')
      .withIndex('by_organization_time', (q: any) => q.eq('organizationId', args.organizationId))
      .order('desc')
      .take(limit * 2);

    const timeline = events
      .filter((event: any) => relevantEventKinds.has(event.eventKind))
      .slice(0, limit)
      .map((event: any) => {
        const payload = (event.payload ?? {}) as Record<string, unknown>;
        const relatedTransfer = Array.isArray(event.relatedEntities)
          ? event.relatedEntities.find((entity: any) => entity.table === 'transfers')
          : null;

        const kind =
          event.eventKind === 'income_completed'
            ? 'completed'
            : event.eventKind === 'income_skipped'
              ? 'skipped'
              : 'requested';

        const streamId =
          event.primaryEntity?.table === 'incomeStreams'
            ? event.primaryEntity.id
            : (payload.incomeStreamId as string | undefined) ?? 'unknown';

        const streamName =
          typeof payload.streamName === 'string'
            ? payload.streamName
            : (payload.streamTitle as string | undefined) ?? 'Income stream';

        const status =
          event.eventKind === 'income_completed'
            ? 'executed'
            : event.eventKind === 'income_skipped'
              ? 'canceled'
              : (payload.autoExecuted as boolean | undefined) ? 'executed' : 'pending_approval';

        return {
          id: event._id,
          kind,
          streamId,
          streamName,
          occurredAt: event.createdAt,
          amount: (payload.amount as unknown) ?? null,
          transferId: relatedTransfer?.id ?? null,
          status,
          metadata: payload ?? null,
        };
      });

    return EarnTimelineEntrySchema.array().parse(timeline);
  },
});
