import { z } from 'zod';
import { OrderSideSchema, OrderStatusSchema } from '../../shared/enums';
import { CurrencyAmountSchema } from '../../shared/primitives';

export const InstrumentTypeValues = ['equity', 'etf', 'cash'] as const;
export const InstrumentTypeSchema = z.enum(InstrumentTypeValues);
export type InstrumentType = z.infer<typeof InstrumentTypeSchema>;

export const InvestmentPositionRecordSchema = z.object({
  _id: z.string(),
  organizationId: z.string(),
  accountId: z.string(),
  symbol: z.string(),
  instrumentType: InstrumentTypeSchema,
  quantity: z.number(),
  averageCost: CurrencyAmountSchema,
  marketValue: CurrencyAmountSchema,
  lastPrice: CurrencyAmountSchema,
  lastPricedAt: z.number(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  updatedAt: z.number(),
});

export type InvestmentPositionRecord = z.infer<typeof InvestmentPositionRecordSchema>;

export const InvestmentOrderRecordSchema = z.object({
  _id: z.string(),
  organizationId: z.string(),
  accountId: z.string(),
  symbol: z.string(),
  instrumentType: InstrumentTypeSchema,
  side: OrderSideSchema,
  orderType: z.literal('market'),
  quantity: z.number(),
  notional: CurrencyAmountSchema,
  limitPrice: CurrencyAmountSchema.nullable().optional(),
  status: OrderStatusSchema,
  placedByProfileId: z.string(),
  approvedByProfileId: z.string().nullable().optional(),
  submittedAt: z.number(),
  approvedAt: z.number().nullable().optional(),
  executedAt: z.number().nullable().optional(),
  executionPrice: CurrencyAmountSchema.nullable().optional(),
  transferId: z.string().nullable().optional(),
  failureReason: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type InvestmentOrderRecord = z.infer<typeof InvestmentOrderRecordSchema>;


export const InvestmentGuardrailSummarySchema = z.object({
  approvalPolicy: z.enum(['auto', 'parent_required', 'admin_only']),
  maxOrderAmountCents: z.number().nullable(),
  blockedSymbols: z.array(z.string()),
  allowedInstrumentKinds: z.array(InstrumentTypeSchema),
  requireApprovalForSell: z.boolean(),
  scope: z
    .object({
      type: z.string(),
      nodeId: z.string().optional(),
      accountId: z.string().optional(),
    })
    .nullable(),
});

export type InvestmentGuardrailSummary = z.infer<typeof InvestmentGuardrailSummarySchema>;

export const InvestmentGuardrailEvaluationSchema = z.object({
  decision: z.enum(['auto_execute', 'needs_parent', 'needs_admin', 'blocked']),
  guardrailId: z.string().nullable(),
  summary: InvestmentGuardrailSummarySchema,
  reason: z.string().nullable().optional(),
});

export type InvestmentGuardrailEvaluation = z.infer<typeof InvestmentGuardrailEvaluationSchema>;
export const InvestmentOrderWithPositionSchema = z.object({
  order: InvestmentOrderRecordSchema,
  position: InvestmentPositionRecordSchema.nullable(),
});

export type InvestmentOrderWithPosition = z.infer<typeof InvestmentOrderWithPositionSchema>;

export const CreateInvestmentOrderInputSchema = z.object({
  organizationId: z.string(),
  accountId: z.string(),
  symbol: z.string().min(1),
  instrumentType: InstrumentTypeSchema,
  side: OrderSideSchema,
  quantity: z.number().positive(),
});

export type CreateInvestmentOrderInput = z.infer<typeof CreateInvestmentOrderInputSchema>;

export const ApproveInvestmentOrderInputSchema = z.object({
  organizationId: z.string(),
  orderId: z.string(),
});

export type ApproveInvestmentOrderInput = z.infer<typeof ApproveInvestmentOrderInputSchema>;

export const CancelInvestmentOrderInputSchema = z.object({
  organizationId: z.string(),
  orderId: z.string(),
  reason: z.string().optional(),
});

export type CancelInvestmentOrderInput = z.infer<typeof CancelInvestmentOrderInputSchema>;

export const WatchlistEntryRecordSchema = z.object({
  _id: z.string(),
  organizationId: z.string(),
  profileId: z.string(),
  symbol: z.string(),
  instrumentType: InstrumentTypeSchema,
  createdAt: z.number(),
  notes: z.string().nullable().optional(),
});

export type WatchlistEntryRecord = z.infer<typeof WatchlistEntryRecordSchema>;

export const UpsertWatchlistEntryInputSchema = z.object({
  organizationId: z.string(),
  profileId: z.string(),
  symbol: z.string(),
  instrumentType: InstrumentTypeSchema,
  notes: z.string().optional(),
});

export type UpsertWatchlistEntryInput = z.infer<typeof UpsertWatchlistEntryInputSchema>;

export const RemoveWatchlistEntryInputSchema = z.object({
  organizationId: z.string(),
  profileId: z.string(),
  symbol: z.string(),
});

export type RemoveWatchlistEntryInput = z.infer<typeof RemoveWatchlistEntryInputSchema>;

export const InstrumentSnapshotRecordSchema = z.object({
  _id: z.string(),
  symbol: z.string(),
  price: CurrencyAmountSchema,
  capturedAt: z.number(),
  source: z.string(),
});

export type InstrumentSnapshotRecord = z.infer<typeof InstrumentSnapshotRecordSchema>;
