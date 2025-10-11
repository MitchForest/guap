import { MutationCtx, mutation, query } from '@guap/api/codegen/server';
import { v } from 'convex/values';
import type { Id } from '@guap/api/codegen/dataModel';
import {
  buildPayloadFromSnapshot,
  clearWorkspaceDiffs,
  clearWorkspaceSessions,
  fetchWorkspaceSnapshot,
  replaceWorkspaceGraph,
} from './workspaceGraph';

const now = () => Date.now();

const ensureVariant = async ({
  ctx,
  householdId,
  variant,
  slug,
  name,
}: {
  ctx: MutationCtx;
  householdId: Id<'households'>;
  variant: 'live' | 'sandbox';
  slug: string;
  name: string;
}) => {
  const existing = await ctx.db
    .query('workspaces')
    .withIndex('by_household_variant', (q) => q.eq('householdId', householdId).eq('variant', variant))
    .unique();

  if (existing) return existing;

  const insertedId = await ctx.db.insert('workspaces', {
    name,
    slug,
    householdId,
    variant,
    lastSyncedAt: variant === 'sandbox' ? now() : undefined,
    lastAppliedAt: variant === 'live' ? now() : undefined,
    pendingRequestId: undefined,
    createdAt: now(),
    updatedAt: now(),
  });

  const inserted = await ctx.db.get(insertedId);
  if (!inserted) throw new Error('Failed to create workspace');
  return inserted;
};

const getWorkspaceVariantOrThrow = async (
  ctx: MutationCtx,
  householdId: Id<'households'>,
  variant: 'live' | 'sandbox'
) => {
  const workspace = await ctx.db
    .query('workspaces')
    .withIndex('by_household_variant', (q) => q.eq('householdId', householdId).eq('variant', variant))
    .unique();
  if (!workspace) {
    throw new Error(`Workspace variant ${variant} not found for household ${householdId}`);
  }
  return workspace;
};

export const ensurePair = mutation({
  args: {
    householdId: v.id('households'),
    slug: v.string(),
    name: v.string(),
    sandboxSlug: v.optional(v.string()),
    sandboxName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const live = await ensureVariant({
      ctx,
      householdId: args.householdId,
      variant: 'live',
      slug: args.slug,
      name: args.name,
    });

    const sandboxSlug = args.sandboxSlug ?? `${args.slug}-sandbox`;
    const sandboxName = args.sandboxName ?? `${args.name} (Sandbox)`;

    const sandbox = await ensureVariant({
      ctx,
      householdId: args.householdId,
      variant: 'sandbox',
      slug: sandboxSlug,
      name: sandboxName,
    });

    return {
      liveId: live._id,
      sandboxId: sandbox._id,
    };
  },
});

export const ensure = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    let user = await ctx.db
      .query('users')
      .withIndex('by_auth_id', (q) => q.eq('authId', identity.subject))
      .unique();

    const nowTs = now();

    if (!user) {
      const displayName = identity.name ?? identity.nickname ?? identity.email ?? 'Member';
      const userId = await ctx.db.insert('users', {
        authId: identity.subject,
        email: identity.email ?? undefined,
        role: 'guardian',
        displayName,
        createdAt: nowTs,
        updatedAt: nowTs,
      });
      user = await ctx.db.get(userId);
    }

    let householdId = user.householdId ?? null;
    if (!householdId) {
      const fallbackSlug = `${args.slug}-household`;
      householdId = await ctx.db.insert('households', {
        name: `${args.name} Household`,
        slug: fallbackSlug,
        createdAt: nowTs,
        updatedAt: nowTs,
      });

      await ctx.db.insert('householdMemberships', {
        householdId,
        userId: user._id,
        role: 'guardian',
        status: 'active',
        createdAt: nowTs,
        updatedAt: nowTs,
      });

      await ctx.db.patch(user._id, {
        householdId,
        updatedAt: nowTs,
      });
    }

    await ensureVariant({
      ctx,
      householdId,
      variant: 'live',
      slug: args.slug,
      name: args.name,
    });

    await ensureVariant({
      ctx,
      householdId,
      variant: 'sandbox',
      slug: `${args.slug}-sandbox`,
      name: `${args.name} (Sandbox)`,
    });
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('workspaces')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .unique();
  },
});

export const getByHousehold = query({
  args: { householdId: v.id('households') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('workspaces')
      .withIndex('by_household_variant', (q) => q.eq('householdId', args.householdId))
      .collect();
  },
});

export const getVariant = query({
  args: {
    householdId: v.id('households'),
    variant: v.union(v.literal('live'), v.literal('sandbox')),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('workspaces')
      .withIndex('by_household_variant', (q) =>
        q.eq('householdId', args.householdId).eq('variant', args.variant)
      )
      .unique();
  },
});

export const remove = mutation({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) return;

    if (workspace.variant === 'live') {
      throw new Error('Cannot remove live workspace');
    }

    const rules = await ctx.db
      .query('rules')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', args.workspaceId))
      .collect();

    for (const rule of rules) {
      const allocations = await ctx.db
        .query('ruleAllocations')
        .withIndex('by_rule', (q) => q.eq('ruleId', rule._id))
        .collect();
      for (const alloc of allocations) {
        await ctx.db.delete(alloc._id);
      }
      await ctx.db.delete(rule._id);
    }

    const edges = await ctx.db
      .query('edges')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', args.workspaceId))
      .collect();
    for (const edge of edges) {
      await ctx.db.delete(edge._id);
    }

    const nodes = await ctx.db
      .query('nodes')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', args.workspaceId))
      .collect();
    for (const node of nodes) {
      await ctx.db.delete(node._id);
    }

    const sessions = await ctx.db
      .query('canvasSessions')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', args.workspaceId))
      .collect();
    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }

    const diffs = await ctx.db
      .query('workspaceChangeDiffs')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', args.workspaceId))
      .collect();
    for (const diff of diffs) {
      await ctx.db.delete(diff._id);
    }

    await ctx.db.delete(args.workspaceId);
  },
});

export const cleanupOrphans = mutation({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db.query('workspaces').collect();
    let removed = 0;
    for (const workspace of items) {
      if (!workspace.householdId) {
        await ctx.db.delete(workspace._id);
        removed += 1;
      }
    }
    return { removed };
  },
});

export const resetSandbox = mutation({
  args: {
    householdId: v.id('households'),
    actorUserId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const live = await getWorkspaceVariantOrThrow(ctx, args.householdId, 'live');
    const sandbox = await getWorkspaceVariantOrThrow(ctx, args.householdId, 'sandbox');

    const snapshot = await fetchWorkspaceSnapshot(ctx, live._id);
    const payload = buildPayloadFromSnapshot(snapshot);
    await replaceWorkspaceGraph(ctx, sandbox._id, payload);
    await clearWorkspaceSessions(ctx, sandbox._id);
    await clearWorkspaceDiffs(ctx, sandbox._id);

    const timestamp = now();
    await ctx.db.patch(sandbox._id, {
      lastSyncedAt: timestamp,
      pendingRequestId: undefined,
      lastAppliedAt: live.lastAppliedAt ?? timestamp,
      updatedAt: timestamp,
    });

    await recordSandboxEvent(ctx, {
      householdId: args.householdId,
      workspaceId: sandbox._id,
      actorUserId: args.actorUserId,
      event: 'reset',
      triggeredAt: timestamp,
    });

    return {
      status: 'synced' as const,
      sandboxId: sandbox._id,
      timestamp,
    };
  },
});

export const applySandbox = mutation({
  args: {
    householdId: v.id('households'),
    actorUserId: v.id('users'),
    bypassApproval: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const live = await getWorkspaceVariantOrThrow(ctx, args.householdId, 'live');
    const sandbox = await getWorkspaceVariantOrThrow(ctx, args.householdId, 'sandbox');

    const snapshot = await fetchWorkspaceSnapshot(ctx, sandbox._id);
    const payload = buildPayloadFromSnapshot(snapshot);

    // TODO: guardrail evaluation and approval routing will live here.
    const requiresApproval = false;

    if (requiresApproval) {
      throw new Error('Approval routing not implemented');
    }

    await replaceWorkspaceGraph(ctx, live._id, payload);
    await clearWorkspaceSessions(ctx, live._id);
    await clearWorkspaceDiffs(ctx, sandbox._id);

    const appliedAt = now();

    await ctx.db.patch(live._id, {
      lastAppliedAt: appliedAt,
      updatedAt: appliedAt,
    });

    await ctx.db.patch(sandbox._id, {
      lastSyncedAt: appliedAt,
      lastAppliedAt: appliedAt,
      pendingRequestId: undefined,
      updatedAt: appliedAt,
    });

    await recordSandboxEvent(ctx, {
      householdId: args.householdId,
      workspaceId: sandbox._id,
      actorUserId: args.actorUserId,
      event: 'apply',
      triggeredAt: appliedAt,
      metadata: {
        requiresApproval,
      },
    });

    return {
      status: 'synced' as const,
      appliedAt,
      requiresApproval,
    };
  },
});

const recordSandboxEvent = async (
  ctx: MutationCtx,
  event: {
    householdId: Id<'households'>;
    workspaceId: Id<'workspaces'>;
    actorUserId: Id<'users'>;
    event: 'reset' | 'apply';
    triggeredAt: number;
    metadata?: Record<string, unknown>;
  }
) => {
  await ctx.db.insert('workspaceSandboxEvents', {
    householdId: event.householdId,
    workspaceId: event.workspaceId,
    actorUserId: event.actorUserId,
    event: event.event,
    triggeredAt: event.triggeredAt,
    metadata: event.metadata,
  });
};
