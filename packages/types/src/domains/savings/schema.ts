import { z } from 'zod';
import { CurrencyAmountSchema } from '../../shared/primitives';
import { GoalStatusSchema } from '../../shared/enums';

export const GuardrailApprovalPolicyValues = ['auto', 'parent_required', 'admin_only'] as const;
export const GuardrailApprovalPolicySchema = z.enum(GuardrailApprovalPolicyValues);
export type GuardrailApprovalPolicy = z.infer<typeof GuardrailApprovalPolicySchema>;

export const GuardrailScopeValues = ['organization', 'money_map_node', 'account'] as const;
export const GuardrailScopeSchema = z.enum(GuardrailScopeValues);
export type GuardrailScope = z.infer<typeof GuardrailScopeSchema>;

export const SavingsGoalRecordSchema = z.object({
  _id: z.string(),
  organizationId: z.string(),
  moneyMapNodeId: z.string(),
  accountId: z.string(),
  name: z.string(),
  targetAmount: CurrencyAmountSchema,
  startingAmount: CurrencyAmountSchema,
  targetDate: z.number().nullable().optional(),
  status: GoalStatusSchema,
  createdByProfileId: z.string(),
  createdAt: z.number(),
  achievedAt: z.number().nullable().optional(),
  archivedAt: z.number().nullable().optional(),
});

export type SavingsGoalRecord = z.infer<typeof SavingsGoalRecordSchema>;

export const SavingsGoalProgressSchema = z.object({
  currentAmount: CurrencyAmountSchema,
  contributedAmount: CurrencyAmountSchema,
  remainingAmount: CurrencyAmountSchema,
  percentageComplete: z.number(),
  lastContributionAt: z.number().nullable(),
  projectedCompletionDate: z.number().nullable(),
});

export type SavingsGoalProgress = z.infer<typeof SavingsGoalProgressSchema>;

export const SavingsGuardrailSummarySchema = z.object({
  approvalPolicy: GuardrailApprovalPolicySchema,
  autoApproveUpToCents: z.number().nullable(),
  scope: GuardrailScopeSchema.nullable(),
});

export type SavingsGuardrailSummary = z.infer<typeof SavingsGuardrailSummarySchema>;

export const SavingsGoalWithProgressSchema = z.object({
  goal: SavingsGoalRecordSchema,
  progress: SavingsGoalProgressSchema,
  guardrails: z.object({
    deposit: SavingsGuardrailSummarySchema,
    withdrawal: SavingsGuardrailSummarySchema,
  }),
});

export type SavingsGoalWithProgress = z.infer<typeof SavingsGoalWithProgressSchema>;

export const CreateSavingsGoalInputSchema = z.object({
  organizationId: z.string(),
  moneyMapNodeId: z.string(),
  accountId: z.string(),
  name: z.string(),
  targetAmount: CurrencyAmountSchema,
  startingAmount: CurrencyAmountSchema,
  targetDate: z.number().nullable().optional(),
});

export type CreateSavingsGoalInput = z.infer<typeof CreateSavingsGoalInputSchema>;

export const UpdateSavingsGoalInputSchema = z.object({
  organizationId: z.string(),
  goalId: z.string(),
  name: z.string().optional(),
  targetAmount: CurrencyAmountSchema.optional(),
  startingAmount: CurrencyAmountSchema.optional(),
  targetDate: z.number().nullable().optional(),
  status: GoalStatusSchema.optional(),
});

export type UpdateSavingsGoalInput = z.infer<typeof UpdateSavingsGoalInputSchema>;

export const InitiateSavingsTransferInputSchema = z.object({
  organizationId: z.string(),
  goalId: z.string(),
  sourceAccountId: z.string(),
  amount: CurrencyAmountSchema,
  memo: z.string().optional(),
});

export type InitiateSavingsTransferInput = z.infer<typeof InitiateSavingsTransferInputSchema>;
