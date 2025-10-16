import { z } from 'zod';
import { CurrencyAmountSchema } from '../../shared/primitives';
import {
  IncomeCadenceSchema,
  IncomeStreamStatusSchema,
  TransferStatusSchema,
} from '../../shared/enums';

export const EarnGuardrailApprovalPolicyValues = ['auto', 'parent_required', 'admin_only'] as const;
export const EarnGuardrailApprovalPolicySchema = z.enum(EarnGuardrailApprovalPolicyValues);
export type EarnGuardrailApprovalPolicy = z.infer<typeof EarnGuardrailApprovalPolicySchema>;

export const EarnGuardrailScopeValues = ['organization', 'money_map_node', 'account'] as const;
export const EarnGuardrailScopeSchema = z.enum(EarnGuardrailScopeValues);
export type EarnGuardrailScope = z.infer<typeof EarnGuardrailScopeSchema>;

export const EarnGuardrailSummarySchema = z.object({
  approvalPolicy: EarnGuardrailApprovalPolicySchema,
  autoApproveUpToCents: z.number().nullable(),
  scope: EarnGuardrailScopeSchema.nullable(),
});

export type EarnGuardrailSummary = z.infer<typeof EarnGuardrailSummarySchema>;

export const EarnProjectionEntrySchema = z.object({
  streamId: z.string(),
  streamName: z.string(),
  scheduledAt: z.number(),
  amount: CurrencyAmountSchema,
  cadence: IncomeCadenceSchema,
  autoScheduled: z.boolean(),
  allocations: z.array(
    z.object({
      nodeId: z.string(),
      nodeName: z.string(),
      percentage: z.number(),
    })
  ),
});

export type EarnProjectionEntry = z.infer<typeof EarnProjectionEntrySchema>;

export const IncomeStreamRecordSchema = z.object({
  _id: z.string(),
  organizationId: z.string(),
  ownerProfileId: z.string(),
  name: z.string(),
  cadence: IncomeCadenceSchema,
  amount: CurrencyAmountSchema,
  defaultDestinationAccountId: z.string().nullable().optional(),
  sourceAccountId: z.string().nullable().optional(),
  requiresApproval: z.boolean(),
  autoSchedule: z.boolean(),
  status: IncomeStreamStatusSchema,
  nextScheduledAt: z.number().nullable().optional(),
  lastPaidAt: z.number().nullable().optional(),
  createdByProfileId: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type IncomeStreamRecord = z.infer<typeof IncomeStreamRecordSchema>;

export const EarnSummarySchema = z.object({
  totalMonthlyCents: z.number(),
  activeStreams: z.number(),
  upcomingPayout: z
    .object({
      streamId: z.string(),
      streamName: z.string(),
      scheduledAt: z.number(),
      amount: CurrencyAmountSchema,
      autoScheduled: z.boolean(),
    })
    .nullable(),
  streakLength: z.number(),
  lastCompletedAt: z.number().nullable(),
  projections: z.array(EarnProjectionEntrySchema),
});

export type EarnSummary = z.infer<typeof EarnSummarySchema>;

export const EarnTimelineEntrySchema = z.object({
  id: z.string(),
  kind: z.enum(['requested', 'completed', 'skipped']),
  streamId: z.string(),
  streamName: z.string(),
  occurredAt: z.number(),
  amount: CurrencyAmountSchema.nullable(),
  transferId: z.string().nullable(),
  status: TransferStatusSchema.nullable(),
  metadata: z.record(z.string(), z.any()).nullable().optional(),
});

export type EarnTimelineEntry = z.infer<typeof EarnTimelineEntrySchema>;

export const CreateIncomeStreamInputSchema = z.object({
  organizationId: z.string(),
  ownerProfileId: z.string(),
  name: z.string(),
  cadence: IncomeCadenceSchema,
  amount: CurrencyAmountSchema,
  defaultDestinationAccountId: z.string().nullable().optional(),
  sourceAccountId: z.string().nullable().optional(),
  requiresApproval: z.boolean().default(true),
  autoSchedule: z.boolean().default(false),
  firstScheduledAt: z.number().nullable().optional(),
});

export type CreateIncomeStreamInput = z.infer<typeof CreateIncomeStreamInputSchema>;

export const UpdateIncomeStreamInputSchema = z.object({
  organizationId: z.string(),
  incomeStreamId: z.string(),
  name: z.string().optional(),
  cadence: IncomeCadenceSchema.optional(),
  amount: CurrencyAmountSchema.optional(),
  defaultDestinationAccountId: z.string().nullable().optional(),
  sourceAccountId: z.string().nullable().optional(),
  requiresApproval: z.boolean().optional(),
  autoSchedule: z.boolean().optional(),
  status: IncomeStreamStatusSchema.optional(),
  nextScheduledAt: z.number().nullable().optional(),
});

export type UpdateIncomeStreamInput = z.infer<typeof UpdateIncomeStreamInputSchema>;

export const RequestIncomePayoutInputSchema = z.object({
  organizationId: z.string(),
  incomeStreamId: z.string(),
  amount: CurrencyAmountSchema.optional(),
  destinationAccountId: z.string().nullable().optional(),
  sourceAccountId: z.string().nullable().optional(),
  requestedAt: z.number().optional(),
  scheduledFor: z.number().nullable().optional(),
  force: z.boolean().optional(),
});

export type RequestIncomePayoutInput = z.infer<typeof RequestIncomePayoutInputSchema>;

export const SkipIncomePayoutInputSchema = z.object({
  organizationId: z.string(),
  incomeStreamId: z.string(),
  scheduledFor: z.number().nullable().optional(),
  reason: z.string().optional(),
});

export type SkipIncomePayoutInput = z.infer<typeof SkipIncomePayoutInputSchema>;

export const EarnPayoutResultSchema = z.object({
  transferId: z.string(),
  status: TransferStatusSchema,
  guardrail: EarnGuardrailSummarySchema,
  autoExecuted: z.boolean(),
  scheduledFor: z.number().nullable(),
});

export type EarnPayoutResult = z.infer<typeof EarnPayoutResultSchema>;
