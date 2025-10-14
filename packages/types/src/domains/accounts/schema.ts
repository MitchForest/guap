import { z } from 'zod';
import {
  AccountKindSchema,
  AccountStatusSchema,
} from '../../shared/enums';
import { CurrencyAmountSchema } from '../../shared/primitives';

export const AccountSnapshotSourceValues = ['sync', 'manual'] as const;
export const AccountSnapshotSourceSchema = z.enum(AccountSnapshotSourceValues);
export type AccountSnapshotSource = z.infer<typeof AccountSnapshotSourceSchema>;

export const FinancialAccountRecordSchema = z.object({
  _id: z.string(),
  organizationId: z.string(),
  moneyMapNodeId: z.string(),
  name: z.string(),
  kind: AccountKindSchema,
  status: AccountStatusSchema,
  currency: z.string().default('USD'),
  balance: CurrencyAmountSchema,
  available: CurrencyAmountSchema.nullable().optional(),
  provider: z.string(),
  providerAccountId: z.string().nullable().optional(),
  lastSyncedAt: z.number().nullable().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const AccountSnapshotRecordSchema = z.object({
  _id: z.string(),
  organizationId: z.string(),
  accountId: z.string(),
  capturedAt: z.number(),
  balance: CurrencyAmountSchema,
  available: CurrencyAmountSchema.nullable().optional(),
  source: AccountSnapshotSourceSchema,
  createdAt: z.number(),
});

export type FinancialAccountRecord = z.infer<typeof FinancialAccountRecordSchema>;
export type AccountSnapshotRecord = z.infer<typeof AccountSnapshotRecordSchema>;
