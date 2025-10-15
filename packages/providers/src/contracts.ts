import { z } from 'zod';
import {
  AccountKindSchema,
  AccountStatusSchema,
  CurrencyAmountSchema,
  IncomeCadenceSchema,
  UserRoleSchema,
  InstrumentTypeSchema,
  OrderSideSchema,
} from '@guap/types';

export { CurrencyAmountSchema, IncomeCadenceSchema };

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

export const ProviderPositionSchema = z.object({
  accountId: z.string(),
  symbol: z.string(),
  instrumentType: InstrumentTypeSchema,
  quantity: z.number(),
  averageCost: CurrencyAmountSchema,
  marketValue: CurrencyAmountSchema,
  lastPrice: CurrencyAmountSchema,
  lastPricedAt: z.number(),
});

export const ProviderInstrumentQuoteSchema = z.object({
  symbol: z.string(),
  instrumentType: InstrumentTypeSchema,
  price: CurrencyAmountSchema,
  capturedAt: z.number(),
  source: z.string().default('virtual'),
});

export const ProviderOrderExecutionParamsSchema = z.object({
  organizationId: z.string(),
  accountId: z.string(),
  symbol: z.string(),
  instrumentType: InstrumentTypeSchema,
  side: OrderSideSchema,
  quantity: z.number(),
});

export const ProviderOrderExecutionResultSchema = z.object({
  symbol: z.string(),
  quantity: z.number(),
  price: CurrencyAmountSchema,
  filledAt: z.number(),
  instrumentType: InstrumentTypeSchema,
});

export const ProviderUserSchema = z.object({
  providerUserId: z.string(),
  displayName: z.string(),
  email: z.string().email().optional(),
  role: UserRoleSchema.default('member'),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const ProviderSyncContextSchema = z.object({
  householdId: z.string(),
  organizationId: z.string().optional(),
  profileId: z.string(),
  providerConfig: z.record(z.string(), z.any()).optional(),
  forceRefresh: z.boolean().default(false),
});

export const ProviderSyncResultSchema = z.object({
  accounts: z.array(ProviderAccountSchema),
  transactions: z.array(ProviderTransactionSchema).optional(),
  incomeStreams: z.array(ProviderIncomeSchema).optional(),
  positions: z.array(ProviderPositionSchema).optional(),
  quotes: z.array(ProviderInstrumentQuoteSchema).optional(),
  users: z.array(ProviderUserSchema).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type ProviderAccount = z.infer<typeof ProviderAccountSchema>;
export type ProviderTransaction = z.infer<typeof ProviderTransactionSchema>;
export type ProviderIncome = z.infer<typeof ProviderIncomeSchema>;
export type ProviderPosition = z.infer<typeof ProviderPositionSchema>;
export type ProviderInstrumentQuote = z.infer<typeof ProviderInstrumentQuoteSchema>;
export type ProviderUser = z.infer<typeof ProviderUserSchema>;
export type ProviderSyncContext = z.infer<typeof ProviderSyncContextSchema>;
export type ProviderSyncResult = z.infer<typeof ProviderSyncResultSchema>;
export type ProviderOrderExecutionParams = z.infer<typeof ProviderOrderExecutionParamsSchema>;
export type ProviderOrderExecutionResult = z.infer<typeof ProviderOrderExecutionResultSchema>;

export interface ProviderAdapter {
  readonly id: string;
  readonly displayName: string;
  readonly supportsRealtime?: boolean;

  sync(context: ProviderSyncContext): Promise<ProviderSyncResult>;

  getQuotes?(symbols: string[]): Promise<ProviderInstrumentQuote[]>;

  executeInvestmentOrder?(
    params: ProviderOrderExecutionParams
  ): Promise<ProviderOrderExecutionResult>;

  disconnect?(context: ProviderSyncContext): Promise<void>;
}
