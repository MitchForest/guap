import { MutationCtx, mutation } from './_generated/server';
import { v } from 'convex/values';
import { Id } from './_generated/dataModel';

const now = () => Date.now();

export const saveAutomation = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    sourceNodeId: v.id('nodes'),
    ruleId: v.optional(v.id('rules')),
    trigger: v.union(v.literal('incoming'), v.literal('scheduled')),
    triggerNodeId: v.optional(v.id('nodes')),
    schedule: v.optional(
      v.object({
        cadence: v.union(v.literal('daily'), v.literal('weekly'), v.literal('monthly')),
        day: v.optional(v.number()),
      })
    ),
    allocations: v.array(
      v.object({
        targetNodeId: v.id('nodes'),
        percentage: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const total = args.allocations.reduce((sum, alloc) => sum + alloc.percentage, 0);
    if (total !== 100) {
      throw new Error('Allocations must sum to 100%.');
    }

    let ruleId: Id<'rules'>;
    if (args.ruleId) {
      ruleId = args.ruleId;
      await ctx.db.patch(ruleId, {
        triggerType: args.trigger,
        triggerNodeId: args.triggerNodeId,
        schedule: args.schedule,
        updatedAt: now(),
      });
      const existing = await ctx.db
        .query('ruleAllocations')
        .withIndex('by_rule', (q) => q.eq('ruleId', ruleId))
        .collect();
      for (const alloc of existing) {
        await ctx.db.delete(alloc._id);
      }
    } else {
      ruleId = await ctx.db.insert('rules', {
        workspaceId: args.workspaceId,
        sourceNodeId: args.sourceNodeId,
        triggerType: args.trigger,
        triggerNodeId: args.triggerNodeId,
        schedule: args.schedule,
        createdAt: now(),
        updatedAt: now(),
      });
    }

    let order = 0;
    for (const alloc of args.allocations) {
      await ctx.db.insert('ruleAllocations', {
        ruleId,
        order: order++,
        percentage: alloc.percentage,
        targetNodeId: alloc.targetNodeId,
        createdAt: now(),
        updatedAt: now(),
      });
      await ensureEdge(ctx, ruleId, args.sourceNodeId, alloc.targetNodeId);
    }

    return ruleId;
  },
});

async function ensureEdge(
  ctx: MutationCtx,
  ruleId: Id<'rules'>,
  sourceNodeId: Id<'nodes'>,
  targetNodeId: Id<'nodes'>
) {
  const existing = await ctx.db
    .query('edges')
    .withIndex('by_source_target', (q) =>
      q.eq('sourceNodeId', sourceNodeId).eq('targetNodeId', targetNodeId)
    )
    .unique();

  if (existing) {
    if (existing.kind !== 'automation' || existing.ruleId !== ruleId) {
      await ctx.db.patch(existing._id, {
        kind: 'automation',
        ruleId,
        updatedAt: now(),
      });
    }
    return existing._id;
  }

  const source = await ctx.db.get(sourceNodeId);
  if (!source) throw new Error('Source node not found');

  await ctx.db.insert('edges', {
    workspaceId: source.workspaceId,
    sourceNodeId,
    targetNodeId,
    kind: 'automation',
    ruleId,
    createdAt: now(),
    updatedAt: now(),
  });
}
