import { z } from 'zod';
import {
  CreateBudgetInputSchema,
  UpdateBudgetInputSchema,
} from '@guap/types';
import { defineMutation } from '../../core/functions';
import {
  ensureOrganizationAccess,
  ensureRole,
  OWNER_ADMIN_ROLES,
} from '../../core/session';
import {
  ensureBudgetGuardrail,
  loadBudgetsWithActuals,
  updateBudgetGuardrail,
} from './services';

const ArchiveBudgetArgs = {
  organizationId: z.string(),
  budgetId: z.string(),
} as const;

const UpdateGuardrailArgs = {
  organizationId: z.string(),
  budgetId: z.string(),
  autoApproveUpToCents: z.number().nullable().optional(),
} as const;

const assertBudgetScope = async (ctx: any, params: { budgetId: string; organizationId: string }) => {
  const budget = await ctx.db.get(params.budgetId as any);
  if (!budget) {
    throw new Error('Budget not found');
  }
  if (budget.organizationId !== params.organizationId) {
    throw new Error('Budget does not belong to organization');
  }
  return budget;
};

const CreateBudgetArgs = {
  organizationId: z.string(),
  moneyMapNodeId: z.string(),
  periodKey: z.string(),
  plannedAmount: CreateBudgetInputSchema.shape.plannedAmount,
  rollover: CreateBudgetInputSchema.shape.rollover,
  capAmount: CreateBudgetInputSchema.shape.capAmount,
} as const;

const UpdateBudgetArgs = {
  organizationId: z.string(),
  budgetId: z.string(),
  plannedAmount: UpdateBudgetInputSchema.shape.plannedAmount,
  rollover: UpdateBudgetInputSchema.shape.rollover,
  capAmount: UpdateBudgetInputSchema.shape.capAmount,
} as const;

export const createBudget = defineMutation({
  args: CreateBudgetArgs,
  handler: async (ctx, rawArgs) => {
    const args = CreateBudgetInputSchema.parse(rawArgs);
    const session = await ensureOrganizationAccess(ctx, args.organizationId);
    ensureRole(session, OWNER_ADMIN_ROLES);

    const node = await ctx.db.get(args.moneyMapNodeId as any);
    if (!node) {
      throw new Error('Money Map node not found');
    }
    if (node.mapId) {
      const map = await ctx.db.get(node.mapId);
      if (!map || map.organizationId !== args.organizationId) {
        throw new Error('Money Map node outside organization scope');
      }
    }

    const timestamp = Date.now();
    const budgetId = await ctx.db.insert('budgets', {
      organizationId: args.organizationId,
      moneyMapNodeId: args.moneyMapNodeId as any,
      periodKey: args.periodKey,
      plannedAmount: args.plannedAmount,
      rollover: args.rollover ?? false,
      capAmount: args.capAmount ?? null,
      createdByProfileId: session.userId ?? 'system',
      createdAt: timestamp,
      archivedAt: null,
    });

    await ensureBudgetGuardrail(ctx.db, {
      organizationId: args.organizationId,
      moneyMapNodeId: args.moneyMapNodeId as any,
      createdByProfileId: session.userId ?? null,
      autoApproveUpToCents: null,
    });
    const budgetRecord = await ctx.db.get(budgetId);
    if (!budgetRecord) {
      throw new Error('Budget record missing after creation');
    }
    const [record] = await loadBudgetsWithActuals(ctx.db, [budgetRecord]);
    return record;
  },
});

export const updateBudget = defineMutation({
  args: UpdateBudgetArgs,
  handler: async (ctx, rawArgs) => {
    const args = UpdateBudgetInputSchema.parse(rawArgs);
    const session = await ensureOrganizationAccess(ctx, args.organizationId);
    ensureRole(session, OWNER_ADMIN_ROLES);

    const budget = await assertBudgetScope(ctx, {
      budgetId: args.budgetId,
      organizationId: args.organizationId,
    });

    const patch: Record<string, unknown> = {};
    if (args.plannedAmount) patch.plannedAmount = args.plannedAmount;
    if (args.rollover !== undefined) patch.rollover = args.rollover;
    if (args.capAmount !== undefined) patch.capAmount = args.capAmount ?? null;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(budget._id, patch);
    }

    const refreshed = await ctx.db.get(budget._id);
    if (!refreshed) {
      throw new Error('Budget not found after update');
    }
    const records = await loadBudgetsWithActuals(ctx.db, [refreshed]);
    return records[0];
  },
});

export const archiveBudget = defineMutation({
  args: ArchiveBudgetArgs,
  handler: async (ctx, rawArgs) => {
    const args = z.object(ArchiveBudgetArgs).parse(rawArgs);
    const session = await ensureOrganizationAccess(ctx, args.organizationId);
    ensureRole(session, OWNER_ADMIN_ROLES);

    const budget = await assertBudgetScope(ctx, args);
    await ctx.db.patch(budget._id, {
      archivedAt: Date.now(),
    });
    return { budgetId: budget._id, archived: true };
  },
});

export const updateGuardrail = defineMutation({
  args: UpdateGuardrailArgs,
  handler: async (ctx, rawArgs) => {
    const args = z.object(UpdateGuardrailArgs).parse(rawArgs);
    const session = await ensureOrganizationAccess(ctx, args.organizationId);
    ensureRole(session, OWNER_ADMIN_ROLES);

    const budget = await assertBudgetScope(ctx, args);
    await updateBudgetGuardrail(ctx.db, {
      organizationId: args.organizationId,
      moneyMapNodeId: budget.moneyMapNodeId,
      autoApproveUpToCents:
        args.autoApproveUpToCents !== undefined ? args.autoApproveUpToCents : null,
    });

    const refreshed = await ctx.db.get(budget._id);
    if (!refreshed) {
      throw new Error('Budget not found after guardrail update');
    }
    const [record] = await loadBudgetsWithActuals(ctx.db, [refreshed]);
    return record.guardrail;
  },
});
