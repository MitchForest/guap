import { z } from 'zod';
import type {
  ProviderAdapter,
  ProviderSyncContext,
  ProviderSyncResult,
  ProviderInstrumentQuote,
  ProviderOrderExecutionParams,
  ProviderOrderExecutionResult,
} from './contracts';
import {
  CurrencyAmountSchema,
  ProviderAccountSchema,
  ProviderIncomeSchema,
  ProviderTransactionSchema,
  ProviderPositionSchema,
  ProviderInstrumentQuoteSchema,
  ProviderOrderExecutionParamsSchema,
  ProviderOrderExecutionResultSchema,
} from './contracts';

const amount = (value: number, currency = 'USD') =>
  CurrencyAmountSchema.parse({ cents: Math.round(value), currency });

const defaultAccounts = [
  ProviderAccountSchema.parse({
    providerAccountId: 'virtual-checking',
    name: 'Virtual Checking',
    kind: 'checking',
    status: 'active',
    currency: 'USD',
    balance: amount(250_00),
    available: amount(250_00),
    metadata: {
      institution: 'Guap Virtual Bank',
      moneyMapNodeKey: 'virtual-checking',
    },
    lastSyncedAt: Date.now(),
  }),
  ProviderAccountSchema.parse({
    providerAccountId: 'virtual-savings',
    name: 'Virtual Savings',
    kind: 'hysa',
    status: 'active',
    currency: 'USD',
    balance: amount(1_250_00),
    available: amount(1_250_00),
    metadata: {
      apy: 0.0425,
      moneyMapNodeKey: 'virtual-savings',
    },
    lastSyncedAt: Date.now(),
  }),
  ProviderAccountSchema.parse({
    providerAccountId: 'virtual-credit',
    name: 'Virtual Credit Card',
    kind: 'credit',
    status: 'active',
    currency: 'USD',
    balance: amount(420_00),
    available: amount(2_500_00),
    metadata: {
      limit: 2500,
      moneyMapNodeKey: 'virtual-credit',
    },
    lastSyncedAt: Date.now(),
  }),
  ProviderAccountSchema.parse({
    providerAccountId: 'virtual-utma',
    name: 'Virtual UTMA',
    kind: 'utma',
    status: 'active',
    currency: 'USD',
    balance: amount(3_950_00),
    available: amount(3_950_00),
    metadata: {
      custody: 'Guap Investments',
      moneyMapNodeKey: 'virtual-utma',
    },
    lastSyncedAt: Date.now(),
  }),
];

const defaultIncome = [
  ProviderIncomeSchema.parse({
    providerIncomeId: 'virtual-allowance',
    label: 'Weekly Allowance',
    cadence: 'weekly',
    amount: amount(20_00),
    accountId: 'virtual-checking',
    metadata: { category: 'allowance', autoSchedule: true },
  }),
  ProviderIncomeSchema.parse({
    providerIncomeId: 'virtual-chore',
    label: 'Saturday Chores',
    cadence: 'weekly',
    amount: amount(15_00),
    metadata: { category: 'chores', requiresApproval: true },
  }),
  ProviderIncomeSchema.parse({
    providerIncomeId: 'virtual-tutoring',
    label: 'Tutoring Gig',
    cadence: 'monthly',
    amount: amount(80_00),
    metadata: { category: 'jobs', requiresApproval: false },
  }),
];

const defaultTransactions = [
  ProviderTransactionSchema.parse({
    providerTransactionId: 'virtual-txn-001',
    accountId: 'virtual-checking',
    description: 'Corner Market',
    amount: amount(-45_12),
    postedAt: Date.now() - 1000 * 60 * 60 * 24,
    metadata: { merchantName: 'Corner Market', categoryKey: 'groceries' },
  }),
  ProviderTransactionSchema.parse({
    providerTransactionId: 'virtual-txn-002',
    accountId: 'virtual-checking',
    description: 'Allowance Deposit',
    amount: amount(50_00),
    postedAt: Date.now() - 1000 * 60 * 60 * 48,
    metadata: { merchantName: 'Guap Earn', categoryKey: 'income' },
  }),
  ProviderTransactionSchema.parse({
    providerTransactionId: 'virtual-txn-003',
    accountId: 'virtual-savings',
    description: 'Interest Credit',
    amount: amount(5_25),
    postedAt: Date.now() - 1000 * 60 * 60 * 72,
    metadata: { merchantName: 'Virtual Savings', categoryKey: 'interest' },
  }),
  ProviderTransactionSchema.parse({
    providerTransactionId: 'virtual-txn-004',
    accountId: 'virtual-credit',
    description: 'Guap Equipment',
    amount: amount(-125_50),
    postedAt: Date.now() - 1000 * 60 * 60 * 30,
    metadata: { merchantName: 'Guap Equipment', categoryKey: 'supplies', mcc: '5732' },
  }),
];

const instrumentCatalog = {
  VTI: {
    instrumentType: 'etf' as const,
    priceCents: 25812,
    source: 'virtual',
  },
  AAPL: {
    instrumentType: 'equity' as const,
    priceCents: 18940,
    source: 'virtual',
  },
  SCHB: {
    instrumentType: 'etf' as const,
    priceCents: 5412,
    source: 'virtual',
  },
};

const defaultPositions = [
  ProviderPositionSchema.parse({
    accountId: 'virtual-utma',
    symbol: 'VTI',
    instrumentType: instrumentCatalog.VTI.instrumentType,
    quantity: 15.25,
    averageCost: amount(225_00),
    marketValue: amount(Math.round(15.25 * instrumentCatalog.VTI.priceCents)),
    lastPrice: amount(instrumentCatalog.VTI.priceCents),
    lastPricedAt: Date.now() - 1000 * 60 * 60,
  }),
  ProviderPositionSchema.parse({
    accountId: 'virtual-utma',
    symbol: 'AAPL',
    instrumentType: instrumentCatalog.AAPL.instrumentType,
    quantity: 4.5,
    averageCost: amount(175_00),
    marketValue: amount(Math.round(4.5 * instrumentCatalog.AAPL.priceCents)),
    lastPrice: amount(instrumentCatalog.AAPL.priceCents),
    lastPricedAt: Date.now() - 1000 * 60 * 60,
  }),
];

const defaultQuotes = [
  ProviderInstrumentQuoteSchema.parse({
    symbol: 'VTI',
    instrumentType: instrumentCatalog.VTI.instrumentType,
    price: amount(instrumentCatalog.VTI.priceCents),
    capturedAt: Date.now(),
    source: instrumentCatalog.VTI.source,
  }),
  ProviderInstrumentQuoteSchema.parse({
    symbol: 'AAPL',
    instrumentType: instrumentCatalog.AAPL.instrumentType,
    price: amount(instrumentCatalog.AAPL.priceCents),
    capturedAt: Date.now(),
    source: instrumentCatalog.AAPL.source,
  }),
  ProviderInstrumentQuoteSchema.parse({
    symbol: 'SCHB',
    instrumentType: instrumentCatalog.SCHB.instrumentType,
    price: amount(instrumentCatalog.SCHB.priceCents),
    capturedAt: Date.now(),
    source: instrumentCatalog.SCHB.source,
  }),
];

const VirtualConfigSchema = z.object({
  accounts: z.array(ProviderAccountSchema).default(defaultAccounts),
  income: z.array(ProviderIncomeSchema).default(defaultIncome),
  transactions: z.array(ProviderTransactionSchema).default(defaultTransactions),
  positions: z.array(ProviderPositionSchema).default(defaultPositions),
  quotes: z.array(ProviderInstrumentQuoteSchema).default(defaultQuotes),
});

const resolveInstrument = (symbol: string) => {
  const key = symbol.toUpperCase();
  if (key in instrumentCatalog) {
    return instrumentCatalog[key as keyof typeof instrumentCatalog];
  }
  return {
    instrumentType: 'equity' as const,
    priceCents: 10_000,
    source: 'virtual',
  };
};

const buildQuote = (symbol: string): ProviderInstrumentQuote => {
  const instrument = resolveInstrument(symbol);
  return ProviderInstrumentQuoteSchema.parse({
    symbol: symbol.toUpperCase(),
    instrumentType: instrument.instrumentType,
    price: amount(instrument.priceCents),
    capturedAt: Date.now(),
    source: instrument.source,
  });
};

export class VirtualProvider implements ProviderAdapter {
  readonly id = 'virtual';
  readonly displayName = 'Virtual (Playground)';

  async sync(context: ProviderSyncContext): Promise<ProviderSyncResult> {
    const parsedConfig = VirtualConfigSchema.parse(context.providerConfig ?? {});

    return {
      accounts: parsedConfig.accounts,
      incomeStreams: parsedConfig.income,
      transactions: parsedConfig.transactions,
      positions: parsedConfig.positions,
      quotes: parsedConfig.quotes,
    };
  }

  async getQuotes(symbols: string[]): Promise<ProviderInstrumentQuote[]> {
    const unique = [...new Set(symbols.map((symbol) => symbol.toUpperCase()))];
    return unique.map((symbol) => buildQuote(symbol));
  }

  async executeInvestmentOrder(
    params: ProviderOrderExecutionParams
  ): Promise<ProviderOrderExecutionResult> {
    const parsed = ProviderOrderExecutionParamsSchema.parse(params);
    const instrument = resolveInstrument(parsed.symbol);
    const filledAt = Date.now();
    const price = amount(instrument.priceCents);

    return ProviderOrderExecutionResultSchema.parse({
      symbol: parsed.symbol.toUpperCase(),
      quantity: parsed.quantity,
      price,
      filledAt,
      instrumentType: instrument.instrumentType,
    });
  }
}

export const virtualProvider = new VirtualProvider();
