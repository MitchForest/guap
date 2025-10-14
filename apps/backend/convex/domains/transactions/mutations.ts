import { z } from 'zod';
import {
  CategoryRuleMatchTypeSchema,
  NeedsVsWantsSchema,
} from '@guap/types';
import { defineMutation } from '../../core/functions';
import {
  ensureOrganizationAccess,
  ensureRole,
  OWNER_ADMIN_ROLES,
} from '../../core/session';

const UpsertCategoryRuleArgs = {
  organizationId: z.string(),
  ruleId: z.string().optional(),
  matchType: CategoryRuleMatchTypeSchema,
  pattern: z.string(),
  categoryKey: z.string(),
  needsVsWants: NeedsVsWantsSchema.optional(),
  priority: z.number().int(),
} as const;

export const upsertCategoryRule = defineMutation({
  args: UpsertCategoryRuleArgs,
  handler: async (ctx, rawArgs) => {
    const args = z.object(UpsertCategoryRuleArgs).parse(rawArgs);
    const session = await ensureOrganizationAccess(ctx, args.organizationId);
    ensureRole(session, OWNER_ADMIN_ROLES);
    const timestamp = Date.now();

    if (args.ruleId) {
      const rule = await ctx.db.get(args.ruleId as any);
      if (!rule) {
        throw new Error('Category rule not found');
      }
      if (rule.organizationId !== args.organizationId) {
        throw new Error('Cannot update rule outside organization scope');
      }

      await ctx.db.patch(args.ruleId as any, {
        matchType: args.matchType,
        pattern: args.pattern,
        categoryKey: args.categoryKey,
        needsVsWants: args.needsVsWants ?? null,
        priority: args.priority,
      });

      return args.ruleId;
    }

    const ruleId = await ctx.db.insert('categoryRules', {
      organizationId: args.organizationId,
      matchType: args.matchType,
      pattern: args.pattern,
      categoryKey: args.categoryKey,
      needsVsWants: args.needsVsWants ?? null,
      priority: args.priority,
      createdByProfileId: session.userId ?? 'system',
      createdAt: timestamp,
      lastMatchedAt: null,
      moneyMapNodeId: null,
    });

    return ruleId;
  },
});
