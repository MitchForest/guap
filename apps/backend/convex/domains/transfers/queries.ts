import { z } from 'zod';
import { TransferStatusSchema } from '@guap/types';
import { defineQuery } from '../../core/functions';
import { ensureOrganizationAccess } from '../../core/session';

const ListTransfersArgs = {
  organizationId: z.string(),
  status: TransferStatusSchema.optional(),
  limit: z.number().int().min(1).max(100).optional(),
} as const;

const ListTransfersSchema = z.object(ListTransfersArgs);

export const listTransfersImpl = async (
  ctx: any,
  args: z.infer<typeof ListTransfersSchema>
) => {
  await ensureOrganizationAccess(ctx, args.organizationId);
  const limit = args.limit ?? 50;

  const baseQuery = ctx.db
    .query('transfers')
    .withIndex('by_organization_status', (q: any) =>
      q.eq('organizationId', args.organizationId)
    );

  const filtered = args.status
    ? baseQuery.eq('status', args.status)
    : baseQuery;

  const records = await filtered.collect();
  records.sort((a: any, b: any) => (b.requestedAt ?? 0) - (a.requestedAt ?? 0));
  return records.slice(0, limit);
};

export const listForOrganization = defineQuery({
  args: ListTransfersArgs,
  handler: async (ctx, rawArgs) => {
    const args = ListTransfersSchema.parse(rawArgs);
    return await listTransfersImpl(ctx, args);
  },
});
