import { z } from 'zod';
import { CurrencyAmountSchema } from '../../shared/primitives';
import { GuardrailApprovalPolicySchema, GuardrailScopeSchema } from '../savings/schema';
import { TransferStatusSchema } from '../../shared/enums';
import { TransferRecordSchema } from '../transfers/schema';

export const DonationCadenceValues = ['weekly', 'monthly', 'quarterly', 'yearly'] as const;
export const DonationCadenceSchema = z.enum(DonationCadenceValues);
export type DonationCadence = z.infer<typeof DonationCadenceSchema>;

export const DonationCauseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  tagline: z.string().optional(),
  icon: z.string().optional(),
  tags: z.array(z.string()).default([]),
  recommendedAmount: CurrencyAmountSchema.optional(),
  moneyMapNodeKey: z.string().optional(),
  accentColor: z.string().optional(),
  impactStatement: z.string().optional(),
});

export type DonationCause = z.infer<typeof DonationCauseSchema>;

export const DonationSummarySchema = z.object({
  yearToDate: CurrencyAmountSchema,
  monthlyAverage: CurrencyAmountSchema,
  target: CurrencyAmountSchema.nullable(),
  percentTowardTarget: z.number().min(0),
  totalDonations: z.number().int().min(0),
  lastDonationAt: z.number().nullable(),
});

export type DonationSummary = z.infer<typeof DonationSummarySchema>;

export const DonationHistoryEntrySchema = z.object({
  transferId: z.string(),
  causeId: z.string(),
  causeName: z.string(),
  amount: CurrencyAmountSchema,
  status: TransferStatusSchema,
  requestedAt: z.number(),
  executedAt: z.number().nullable(),
  memo: z.string().nullable(),
});

export type DonationHistoryEntry = z.infer<typeof DonationHistoryEntrySchema>;

export const DonationGuardrailSummarySchema = z.object({
  approvalPolicy: GuardrailApprovalPolicySchema,
  autoApproveUpToCents: z.number().nullable(),
  scope: GuardrailScopeSchema.nullable(),
});

export type DonationGuardrailSummary = z.infer<typeof DonationGuardrailSummarySchema>;

export const ScheduleDonationInputSchema = z.object({
  organizationId: z.string(),
  causeId: z.string(),
  sourceAccountId: z.string(),
  destinationAccountId: z.string(),
  amount: CurrencyAmountSchema,
  memo: z.string().optional(),
  scheduledFor: z.number().nullable().optional(),
  recurringCadence: DonationCadenceSchema.nullable().optional(),
});

export type ScheduleDonationInput = z.infer<typeof ScheduleDonationInputSchema>;

export const DonationScheduleEntrySchema = z.object({
  transferId: z.string().nullable(),
  causeId: z.string(),
  causeName: z.string(),
  amount: CurrencyAmountSchema,
  scheduledFor: z.number(),
  status: TransferStatusSchema,
});

export type DonationScheduleEntry = z.infer<typeof DonationScheduleEntrySchema>;

export const DonationOverviewSchema = z.object({
  summary: DonationSummarySchema,
  causes: z.array(DonationCauseSchema),
  history: z.array(DonationHistoryEntrySchema),
  upcoming: z.array(DonationScheduleEntrySchema),
  guardrail: DonationGuardrailSummarySchema.nullable(),
});

export type DonationOverview = z.infer<typeof DonationOverviewSchema>;

export const ScheduleDonationResultSchema = z.object({
  transfer: TransferRecordSchema,
  guardrail: DonationGuardrailSummarySchema.nullable(),
  autoExecuted: z.boolean(),
  cause: DonationCauseSchema,
});

export type ScheduleDonationResult = z.infer<typeof ScheduleDonationResultSchema>;

export const UpdateDonationGuardrailInputSchema = z.object({
  organizationId: z.string(),
  accountId: z.string(),
  approvalPolicy: GuardrailApprovalPolicySchema.optional(),
  autoApproveUpToCents: z.number().nullable().optional(),
});

export type UpdateDonationGuardrailInput = z.infer<typeof UpdateDonationGuardrailInputSchema>;
