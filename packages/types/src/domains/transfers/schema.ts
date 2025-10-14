import { z } from 'zod';
import { CurrencyAmountSchema } from '../../shared/primitives';
import { TransferIntentSchema, TransferStatusSchema } from '../../shared/enums';

export const TransferRecordSchema = z.object({
  _id: z.string(),
  organizationId: z.string(),
  intent: TransferIntentSchema,
  sourceAccountId: z.string().nullable().optional(),
  destinationAccountId: z.string(),
  amount: CurrencyAmountSchema,
  requestedByProfileId: z.string(),
  approvedByProfileId: z.string().nullable().optional(),
  status: TransferStatusSchema,
  goalId: z.string().nullable().optional(),
  orderId: z.string().nullable().optional(),
  requestedAt: z.number(),
  approvedAt: z.number().nullable().optional(),
  executedAt: z.number().nullable().optional(),
  metadata: z.record(z.string(), z.any()).nullable().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type TransferRecord = z.infer<typeof TransferRecordSchema>;
