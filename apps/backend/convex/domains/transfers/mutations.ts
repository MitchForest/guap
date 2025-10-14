import { z } from 'zod';
import { TransferStatusSchema } from '@guap/types';
import { zid } from 'convex-helpers/server/zod';
import { defineMutation } from '../../core/functions';
import { ensureOrganizationAccess, ensureRole, OWNER_ADMIN_ROLES } from '../../core/session';
import { logEvent } from '../events/services';

const UpdateStatusArgs = {
  transferId: zid('transfers'),
  status: TransferStatusSchema,
} as const;

export const updateStatus = defineMutation({
  args: UpdateStatusArgs,
  handler: async (ctx, rawArgs) => {
    const args = z.object(UpdateStatusArgs).parse(rawArgs);
    const transfer = await ctx.db.get(args.transferId);
    if (!transfer) {
      throw new Error('Transfer not found');
    }

    const session = await ensureOrganizationAccess(ctx, transfer.organizationId);
    ensureRole(session, OWNER_ADMIN_ROLES);

    const timestamp = Date.now();
    const patch: Record<string, unknown> = {
      status: args.status,
      updatedAt: timestamp,
    };

    if (args.status === 'approved' || args.status === 'executed') {
      patch.approvedByProfileId = session.userId ?? null;
    }

    if (args.status === 'approved' && !transfer.approvedAt) {
      patch.approvedAt = timestamp;
    }

    if (args.status === 'executed') {
      patch.executedAt = timestamp;
    }

    await ctx.db.patch(args.transferId, patch);

    const eventKind =
      args.status === 'approved'
        ? 'transfer_approved'
        : args.status === 'declined'
          ? 'transfer_declined'
          : args.status === 'executed'
            ? 'transfer_executed'
            : 'transfer_requested';

    await logEvent(ctx.db, {
      organizationId: transfer.organizationId,
      eventKind,
      actorProfileId: session.userId,
      primaryEntity: { table: 'transfers', id: args.transferId },
      payload: {
        previousStatus: transfer.status,
        status: args.status,
      },
    });

    return { ...transfer, ...patch };
  },
});
