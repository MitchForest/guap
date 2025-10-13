import { query } from './_generated/server';
import { v } from 'convex/values';
import { authComponent } from './auth';
import type { Doc } from './betterAuth/_generated/dataModel';

const SMOKE_SECRET = process.env.SMOKE_MAGIC_LINK_SECRET ?? null;

const parseVerificationValue = (raw: unknown) => {
  if (typeof raw !== 'string') {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as { email?: string | null };
    return parsed?.email ?? null;
  } catch {
    return null;
  }
};

type VerificationDoc = Doc<'verification'>;

export const latestMagicLinkToken = query({
  args: {
    email: v.string(),
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    if (!SMOKE_SECRET || args.secret !== SMOKE_SECRET) {
      throw new Error('Unauthorized');
    }

    const adapter = authComponent.adapter(ctx as any) as any;
    const page = (await adapter.findMany({
      model: 'verification',
      limit: 50,
      sortBy: { field: 'createdAt', direction: 'desc' },
    })) as Array<VerificationDoc>;
    const matches = page
      .map((record) => ({
        record,
        email: parseVerificationValue(record.value),
      }))
      .filter((candidate) => candidate.email && candidate.email.toLowerCase() === args.email.toLowerCase());

    const latest = matches[0];
    if (!latest) {
      return null;
    }

    return {
      token: latest.record.identifier,
      expiresAt: latest.record.expiresAt,
    };
  },
});
