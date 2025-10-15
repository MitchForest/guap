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

const DeleteCategoryRuleArgs = {
  organizationId: z.string(),
  ruleId: z.string(),
} as const;

const ReorderCategoryRulesArgs = {
  organizationId: z.string(),
  ruleIds: z.array(z.string()).nonempty(),
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

export const deleteCategoryRule = defineMutation({
  args: DeleteCategoryRuleArgs,
  handler: async (ctx, rawArgs) => {
    const args = z.object(DeleteCategoryRuleArgs).parse(rawArgs);
    const session = await ensureOrganizationAccess(ctx, args.organizationId);
    ensureRole(session, OWNER_ADMIN_ROLES);

    const rule = await ctx.db.get(args.ruleId as any);
    if (!rule) {
      throw new Error('Category rule not found');
    }
    if (rule.organizationId !== args.organizationId) {
      throw new Error('Cannot delete rule outside organization scope');
    }

    await ctx.db.delete(args.ruleId as any);
    return args.ruleId;
  },
});

export const reorderCategoryRules = defineMutation({
  args: ReorderCategoryRulesArgs,
  handler: async (ctx, rawArgs) => {
    const args = z.object(ReorderCategoryRulesArgs).parse(rawArgs);
    const session = await ensureOrganizationAccess(ctx, args.organizationId);
    ensureRole(session, OWNER_ADMIN_ROLES);

    const basePriority = 200;
    const step = 5;
    let updated = 0;

    for (let index = 0; index < args.ruleIds.length; index += 1) {
      const ruleId = args.ruleIds[index];
      const rule = await ctx.db.get(ruleId as any);
      if (!rule || rule.organizationId !== args.organizationId) {
        continue;
      }
      const priority = basePriority - index * step;
      await ctx.db.patch(ruleId as any, { priority });
      updated += 1;
    }

    return { updated };
  },
});
