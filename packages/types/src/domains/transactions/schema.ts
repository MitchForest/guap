import { z } from 'zod';
import {
  NeedsVsWantsSchema,
  TransactionDirectionSchema,
  TransactionSourceSchema,
  TransactionStatusSchema,
} from '../../shared/enums';
import { CurrencyAmountSchema } from '../../shared/primitives';

export const CategoryRuleMatchTypeValues = [
  'merchant_prefix',
  'merchant_exact',
  'mcc',
  'keywords',
] as const;
export const CategoryRuleMatchTypeSchema = z.enum(CategoryRuleMatchTypeValues);
export type CategoryRuleMatchType = z.infer<typeof CategoryRuleMatchTypeSchema>;

export const TransactionRecordSchema = z.object({
  _id: z.string(),
  organizationId: z.string(),
  accountId: z.string(),
  transferId: z.string().nullable().optional(),
  providerTransactionId: z.string().nullable().optional(),
  direction: TransactionDirectionSchema,
  source: TransactionSourceSchema,
  status: TransactionStatusSchema,
  amount: CurrencyAmountSchema,
  description: z.string(),
  merchantName: z.string().nullable().optional(),
  categoryKey: z.string().nullable().optional(),
  categoryConfidence: z.number().nullable().optional(),
  needsVsWants: NeedsVsWantsSchema.nullable().optional(),
  occurredAt: z.number(),
  createdAt: z.number(),
  metadata: z.record(z.string(), z.any()).nullable().optional(),
  moneyMapNodeId: z.string().nullable().optional(),
});

export const CategoryRuleRecordSchema = z.object({
  _id: z.string(),
  organizationId: z.string(),
  matchType: CategoryRuleMatchTypeSchema,
  pattern: z.string(),
  categoryKey: z.string(),
  needsVsWants: NeedsVsWantsSchema.nullable().optional(),
  priority: z.number(),
  createdByProfileId: z.string(),
  createdAt: z.number(),
  lastMatchedAt: z.number().nullable().optional(),
  moneyMapNodeId: z.string().nullable().optional(),
});

export type TransactionRecord = z.infer<typeof TransactionRecordSchema>;
export type CategoryRuleRecord = z.infer<typeof CategoryRuleRecordSchema>;
