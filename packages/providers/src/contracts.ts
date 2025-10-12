import { z } from 'zod';

export const CurrencyAmountSchema = z.object({
  cents: z.number().int(),
  currency: z.string().default('USD'),
});

export const AccountKindValues = ['checking', 'savings', 'cash', 'hysa', 'brokerage', 'credit', 'loan'] as const;
export const AccountKindSchema = z.enum(AccountKindValues);

export const AccountStatusValues = ['active', 'inactive', 'closed'] as const;
export const AccountStatusSchema = z.enum(AccountStatusValues);

export const IncomeCadenceValues = [
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'annual',
] as const;
export const IncomeCadenceSchema = z.enum(IncomeCadenceValues);

export const ProviderUserRoleValues = ['owner', 'guardian', 'student', 'member', 'admin'] as const;
export const ProviderUserRoleSchema = z.enum(ProviderUserRoleValues);

export const ProviderAccountSchema = z.object({
  providerAccountId: z.string(),
  externalId: z.string().optional(),
  name: z.string(),
  kind: AccountKindSchema,
  status: AccountStatusSchema,
  currency: z.string().default('USD'),
  balance: CurrencyAmountSchema,
  available: CurrencyAmountSchema.optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  lastSyncedAt: z.number().optional(),
});

export const ProviderTransactionSchema = z.object({
  providerTransactionId: z.string(),
  accountId: z.string(),
  description: z.string(),
  amount: CurrencyAmountSchema,
  postedAt: z.number(),
  category: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const ProviderIncomeSchema = z.object({
  providerIncomeId: z.string(),
  accountId: z.string().optional(),
  label: z.string(),
  cadence: IncomeCadenceSchema.default('monthly'),
  amount: CurrencyAmountSchema,
  metadata: z.record(z.string(), z.any()).optional(),
});

export const ProviderUserSchema = z.object({
  providerUserId: z.string(),
  displayName: z.string(),
  email: z.string().email().optional(),
  role: ProviderUserRoleSchema.default('member'),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const ProviderSyncContextSchema = z.object({
  organizationId: z.string(),
  userId: z.string(),
  providerConfig: z.record(z.string(), z.any()).optional(),
  forceRefresh: z.boolean().default(false),
});

export const ProviderSyncResultSchema = z.object({
  accounts: z.array(ProviderAccountSchema),
  transactions: z.array(ProviderTransactionSchema).optional(),
  incomeStreams: z.array(ProviderIncomeSchema).optional(),
  users: z.array(ProviderUserSchema).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type ProviderAccount = z.infer<typeof ProviderAccountSchema>;
export type ProviderTransaction = z.infer<typeof ProviderTransactionSchema>;
export type ProviderIncome = z.infer<typeof ProviderIncomeSchema>;
export type ProviderUser = z.infer<typeof ProviderUserSchema>;
export type ProviderSyncContext = z.infer<typeof ProviderSyncContextSchema>;
export type ProviderSyncResult = z.infer<typeof ProviderSyncResultSchema>;

export interface ProviderAdapter {
  readonly id: string;
  readonly displayName: string;
  readonly supportsRealtime?: boolean;

  sync(context: ProviderSyncContext): Promise<ProviderSyncResult>;

  disconnect?(context: ProviderSyncContext): Promise<void>;
}
