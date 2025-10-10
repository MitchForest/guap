import { CurrencyAmountSchema } from '@guap/types';
import { z } from 'zod';
import type {
  ProviderAdapter,
  ProviderSyncContext,
  ProviderSyncResult,
} from './contracts';
import { ProviderAccountSchema, ProviderIncomeSchema } from './contracts';

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
    metadata: { institution: 'Guap Virtual Bank' },
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
    metadata: { apy: 0.0425 },
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

const VirtualConfigSchema = z.object({
  accounts: z.array(ProviderAccountSchema).default(defaultAccounts),
  income: z.array(ProviderIncomeSchema).default(defaultIncome),
});

export class VirtualProvider implements ProviderAdapter {
  readonly id = 'virtual';
  readonly displayName = 'Virtual (Playground)';

  async sync(context: ProviderSyncContext): Promise<ProviderSyncResult> {
    const parsedConfig = VirtualConfigSchema.parse(context.providerConfig ?? {});

    return {
      accounts: parsedConfig.accounts,
      incomeStreams: parsedConfig.income,
    };
  }
}

export const virtualProvider = new VirtualProvider();
