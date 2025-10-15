import { z } from 'zod';
import type {
  ProviderAdapter,
  ProviderSyncContext,
  ProviderSyncResult,
} from './contracts';
import {
  CurrencyAmountSchema,
  ProviderAccountSchema,
  ProviderIncomeSchema,
  ProviderTransactionSchema,
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
];

const defaultIncome = [
  ProviderIncomeSchema.parse({
    providerIncomeId: 'virtual-allowance',
    label: 'Weekly Allowance',
    cadence: 'weekly',
    amount: amount(20_00),
    metadata: { category: 'allowance' },
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

const VirtualConfigSchema = z.object({
  accounts: z.array(ProviderAccountSchema).default(defaultAccounts),
  income: z.array(ProviderIncomeSchema).default(defaultIncome),
  transactions: z.array(ProviderTransactionSchema).default(defaultTransactions),
});

export class VirtualProvider implements ProviderAdapter {
  readonly id = 'virtual';
  readonly displayName = 'Virtual (Playground)';

  async sync(context: ProviderSyncContext): Promise<ProviderSyncResult> {
    const parsedConfig = VirtualConfigSchema.parse(context.providerConfig ?? {});

    return {
      accounts: parsedConfig.accounts,
      incomeStreams: parsedConfig.income,
      transactions: parsedConfig.transactions,
    };
  }
}

export const virtualProvider = new VirtualProvider();
