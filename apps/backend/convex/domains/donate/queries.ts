import { z } from 'zod';
import { defineQuery } from '../../core/functions';
import { ensureOrganizationAccess } from '../../core/session';
import {
  buildDonationHistory,
  buildDonationOverview,
  fetchDonationTransfers,
  getDonationCauses,
} from './services';

const OrganizationArgs = {
  organizationId: z.string(),
} as const;

const OverviewArgs = {
  organizationId: z.string(),
  historyLimit: z.number().int().min(1).max(100).optional(),
} as const;

const HistoryArgs = {
  organizationId: z.string(),
  limit: z.number().int().min(1).max(100).optional(),
} as const;

export const listCausesHandler = async (ctx: any, rawArgs: unknown) => {
  const args = z.object(OrganizationArgs).parse(rawArgs);
  await ensureOrganizationAccess(ctx, args.organizationId);
  return getDonationCauses();
};

export const overviewHandler = async (ctx: any, rawArgs: unknown) => {
  const args = z.object(OverviewArgs).parse(rawArgs);
  await ensureOrganizationAccess(ctx, args.organizationId);

  return await buildDonationOverview(ctx.db, {
    organizationId: args.organizationId,
    limit: args.historyLimit ?? 20,
  });
};

export const listHistoryHandler = async (ctx: any, rawArgs: unknown) => {
  const args = z.object(HistoryArgs).parse(rawArgs);
  await ensureOrganizationAccess(ctx, args.organizationId);

  const [causes, transfers] = await Promise.all([
    getDonationCauses(),
    fetchDonationTransfers(ctx.db, args.organizationId),
  ]);

  return buildDonationHistory(transfers, causes, args.limit ?? 25);
};

export const listCauses = defineQuery({
  args: OrganizationArgs,
  handler: listCausesHandler,
});

export const overview = defineQuery({
  args: OverviewArgs,
  handler: overviewHandler,
});

export const listHistory = defineQuery({
  args: HistoryArgs,
  handler: listHistoryHandler,
});
