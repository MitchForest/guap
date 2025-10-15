import { z } from 'zod';
import { CurrencyAmountSchema } from '../../shared/primitives';
import { GuardrailApprovalPolicySchema, GuardrailScopeSchema } from '../savings/schema';

export const BudgetPeriodKeySchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Expected YYYY-MM format for periodKey');

export const CreateBudgetInputSchema = z.object({
  organizationId: z.string(),
  moneyMapNodeId: z.string(),
  periodKey: BudgetPeriodKeySchema,
  plannedAmount: CurrencyAmountSchema,
  rollover: z.boolean().default(false),
  capAmount: CurrencyAmountSchema.nullable().optional(),
});

export const UpdateBudgetInputSchema = z.object({
  organizationId: z.string(),
  budgetId: z.string(),
  plannedAmount: CurrencyAmountSchema.optional(),
  rollover: z.boolean().optional(),
  capAmount: CurrencyAmountSchema.nullable().optional(),
});

export const BudgetRecordSchema = z.object({
  _id: z.string(),
  organizationId: z.string(),
  moneyMapNodeId: z.string(),
  periodKey: BudgetPeriodKeySchema,
  plannedAmount: CurrencyAmountSchema,
  rollover: z.boolean(),
  capAmount: CurrencyAmountSchema.nullable(),
  createdByProfileId: z.string(),
  createdAt: z.number(),
  archivedAt: z.number().nullable(),
});

export const BudgetActualsSchema = z.object({
  spentAmount: CurrencyAmountSchema,
  remainingAmount: CurrencyAmountSchema,
  percentageUsed: z.number(),
  transactionsCount: z.number(),
  overspent: z.boolean(),
  lastTransactionAt: z.number().nullable(),
});

export const GuardrailSummarySchema = z.object({
  approvalPolicy: GuardrailApprovalPolicySchema,
  autoApproveUpToCents: z.number().nullable(),
  scope: GuardrailScopeSchema.nullable(),
});

export const BudgetWithActualsSchema = z.object({
  budget: BudgetRecordSchema,
  actuals: BudgetActualsSchema,
  guardrail: GuardrailSummarySchema.nullable(),
});

export const BudgetSummarySchema = z.object({
  periodKey: BudgetPeriodKeySchema,
  totalPlanned: CurrencyAmountSchema,
  totalSpent: CurrencyAmountSchema,
  totalRemaining: CurrencyAmountSchema,
  overspentBudgets: z.number(),
});

export type BudgetPeriodKey = z.infer<typeof BudgetPeriodKeySchema>;
export type CreateBudgetInput = z.infer<typeof CreateBudgetInputSchema>;
export type UpdateBudgetInput = z.infer<typeof UpdateBudgetInputSchema>;
export type BudgetRecord = z.infer<typeof BudgetRecordSchema>;
export type BudgetActuals = z.infer<typeof BudgetActualsSchema>;
export type GuardrailSummary = z.infer<typeof GuardrailSummarySchema>;
export type BudgetWithActuals = z.infer<typeof BudgetWithActualsSchema>;
export type BudgetSummary = z.infer<typeof BudgetSummarySchema>;
