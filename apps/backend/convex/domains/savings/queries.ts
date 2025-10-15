import { z } from 'zod';
import { TransferStatusSchema } from '@guap/types';
import { defineQuery } from '../../core/functions';
import { ensureOrganizationAccess } from '../../core/session';
import {
  calculateGoalProgress,
  loadGoalWithProgress,
  selectGuardrailForDirection,
  summarizeGuardrail,
} from './services';

const ListGoalsArgs = {
  organizationId: z.string(),
} as const;

const GetGoalArgs = {
  goalId: z.string(),
} as const;

const ListTransfersArgs = {
  organizationId: z.string(),
  goalId: z.string(),
  status: TransferStatusSchema.optional(),
} as const;

export const listGoalsHandler = async (ctx: any, rawArgs: unknown) => {
  const args = z.object(ListGoalsArgs).parse(rawArgs);
  await ensureOrganizationAccess(ctx, args.organizationId);

  const [goals, guardrails] = await Promise.all([
    ctx.db
      .query('savingsGoals')
      .withIndex('by_organization', (q: any) => q.eq('organizationId', args.organizationId))
      .collect(),
    ctx.db
      .query('transferGuardrails')
      .withIndex('by_organization_intent', (q: any) =>
        q.eq('organizationId', args.organizationId).eq('intent', 'save')
      )
      .collect(),
  ]);

  const results = [];
  for (const goal of goals) {
    const { progress } = await calculateGoalProgress(ctx.db, goal);
    const depositGuardrail = selectGuardrailForDirection(
      guardrails,
      goal,
      'deposit',
      goal.accountId
    );
    const withdrawalGuardrail = selectGuardrailForDirection(
      guardrails,
      goal,
      'withdrawal',
      goal.accountId
    );
    results.push({
      goal,
      progress,
      guardrails: {
        deposit: summarizeGuardrail(depositGuardrail),
        withdrawal: summarizeGuardrail(withdrawalGuardrail),
      },
    });
  }

  return results;
};

export const getGoalHandler = async (ctx: any, rawArgs: unknown) => {
  const args = z.object(GetGoalArgs).parse(rawArgs);
  const record = await loadGoalWithProgress(ctx.db, args.goalId as any);
  if (!record) {
    return null;
  }

  await ensureOrganizationAccess(ctx, record.goal.organizationId);
  return record;
};

export const listTransfersForGoalHandler = async (ctx: any, rawArgs: unknown) => {
  const args = z.object(ListTransfersArgs).parse(rawArgs);
  const goal = await ctx.db.get(args.goalId as any);
  if (!goal) {
    throw new Error('Goal not found');
  }
  await ensureOrganizationAccess(ctx, goal.organizationId);

  let query = ctx.db
    .query('transfers')
    .withIndex('by_goal', (q: any) => q.eq('goalId', args.goalId))
    .order('desc');

  const transfers = await query.collect();
  const filtered = args.status
    ? transfers.filter((transfer: any) => transfer.status === args.status)
    : transfers;

  return filtered;
};

export const listForOrganization = defineQuery({
  args: ListGoalsArgs,
  handler: listGoalsHandler,
});

export const getById = defineQuery({
  args: GetGoalArgs,
  handler: getGoalHandler,
});

export const listTransfersForGoal = defineQuery({
  args: ListTransfersArgs,
  handler: listTransfersForGoalHandler,
});
