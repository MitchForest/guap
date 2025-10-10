import { action } from '@guap/api/codegen/server';
import type { ActionCtx, MutationCtx } from '@guap/api/codegen/server';
import type { Id } from '@guap/api/codegen/dataModel';
import { v } from 'convex/values';
import type {
  ProviderSyncResult,
  ProviderUser,
  ProviderAccount,
  ProviderIncome,
} from '@guap/providers';
import { diffProviderSync } from '@guap/providers';
import { getProvider, defaultProviderId } from '../providers/register';
import { scheduleProviderTask } from '../providers/queue';

const now = () => Date.now();

const getDb = (ctx: ActionCtx): MutationCtx['db'] => (ctx as any).db as MutationCtx['db'];
type DbClient = MutationCtx['db'];

export const syncHousehold = action({
  args: {
    householdId: v.id('households'),
    providerId: v.optional(v.string()),
    forceRefresh: v.optional(v.boolean()),
    config: v.optional(v.record(v.string(), v.any())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const db = getDb(ctx);

    const user = await db
      .query('users')
      .withIndex('by_auth_id', (q) => q.eq('authId', identity.subject))
      .unique();

    if (!user) {
      throw new Error('User profile not found');
    }

    const providerId = args.providerId ?? defaultProviderId;
    const provider = getProvider(providerId);

    if (!provider) {
      throw new Error(`Provider '${providerId}' is not registered`);
    }

    const context = {
      householdId: args.householdId,
      userId: user._id,
      providerConfig: args.config ?? undefined,
      forceRefresh: args.forceRefresh ?? false,
    };

    const baseline = await loadProviderBaseline(db, args.householdId, providerId);
    const startedAt = Date.now();
    try {
      const result = await scheduleProviderTask(providerId, () => provider.sync(context));

      await upsertFromProvider(ctx, db, {
        householdId: args.householdId,
        providerId,
        result,
      });

      const diff = diffProviderSync(baseline, result);
      const finishedAt = Date.now();
      await recordProviderSyncEvent(db, {
        providerId,
        householdId: args.householdId,
        status: 'success',
        startedAt,
        finishedAt,
        diff,
      });
      logProviderDiff(providerId, args.householdId, diff);

      return {
        providerId,
        accountsProcessed: result.accounts.length,
        incomeProcessed: result.incomeStreams?.length ?? 0,
      };
    } catch (error) {
      const finishedAt = Date.now();
      await recordProviderSyncEvent(db, {
        providerId,
        householdId: args.householdId,
        status: 'error',
        startedAt,
        finishedAt,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
});

const toCurrencyAmount = (value: number, currency: string) => ({
  cents: Math.round(value),
  currency,
});

const mapAccountToProvider = (record: any): ProviderAccount | null => {
  const providerAccountId = record.institution?.accountId;
  if (!providerAccountId) {
    return null;
  }
  const currency = record.currency ?? 'USD';
  return {
    providerAccountId,
    externalId: typeof record.metadata?.externalId === 'string' ? record.metadata.externalId : undefined,
    name: record.name,
    kind: record.kind,
    status: record.status,
    currency,
    balance: toCurrencyAmount(record.balanceCents, currency),
    available:
      typeof record.availableCents === 'number'
        ? toCurrencyAmount(record.availableCents, currency)
        : undefined,
    metadata: record.metadata ?? undefined,
    lastSyncedAt: record.institution?.lastSyncedAt ?? undefined,
  } satisfies ProviderAccount;
};

const mapIncomeToProvider = (record: any): ProviderIncome | null => {
  const providerIncomeId = record.metadata?.providerIncomeId;
  if (!providerIncomeId) {
    return null;
  }
  const currency = typeof record.metadata?.currency === 'string' ? record.metadata.currency : 'USD';
  return {
    providerIncomeId,
    accountId: record.metadata?.providerAccountId ?? undefined,
    label: record.label,
    cadence: record.cadence,
    amount: toCurrencyAmount(record.amountCents, currency),
    metadata: record.metadata ?? undefined,
  } satisfies ProviderIncome;
};

const loadProviderBaseline = async (
  db: DbClient,
  householdId: Id<'households'>,
  providerId: string
): Promise<ProviderSyncResult> => {
  const accounts = await db
    .query('accounts')
    .withIndex('by_household', (q) => q.eq('householdId', householdId))
    .collect();

  const providerAccounts = accounts
    .filter((record) => record.institution?.provider === providerId)
    .map(mapAccountToProvider)
    .filter((record): record is ProviderAccount => !!record);

  const incomes = await db
    .query('incomeStreams')
    .withIndex('by_household', (q) => q.eq('householdId', householdId))
    .collect();

  const providerIncomes = incomes
    .filter((record) => record.metadata?.providerId === providerId)
    .map(mapIncomeToProvider)
    .filter((record): record is ProviderIncome => !!record);

  return {
    accounts: providerAccounts,
    transactions: [],
    incomeStreams: providerIncomes,
    users: [],
  } satisfies ProviderSyncResult;
};

const summarizeDiff = (collection: {
  created: unknown[];
  updated: unknown[];
  removed: unknown[];
}) => ({
  created: collection.created.length,
  updated: collection.updated.length,
  removed: collection.removed.length,
});

const logProviderDiff = (
  providerId: string,
  householdId: Id<'households'>,
  diff: ReturnType<typeof diffProviderSync>
) => {
  const summary = {
    accounts: summarizeDiff(diff.accounts),
    transactions: summarizeDiff(diff.transactions),
    incomeStreams: summarizeDiff(diff.incomeStreams),
    users: summarizeDiff(diff.users),
  };

  console.info('[provider][diff]', {
    providerId,
    householdId,
    summary,
  });
};

const recordProviderSyncEvent = async (
  db: DbClient,
  params: {
    providerId: string;
    householdId: Id<'households'>;
    status: 'success' | 'error';
    startedAt: number;
    finishedAt: number;
    diff?: ReturnType<typeof diffProviderSync>;
    errorMessage?: string;
  }
) => {
  const durationMs = params.finishedAt - params.startedAt;
  const summary = params.diff
    ? {
        accounts: summarizeDiff(params.diff.accounts),
        transactions: summarizeDiff(params.diff.transactions),
        incomeStreams: summarizeDiff(params.diff.incomeStreams),
        users: summarizeDiff(params.diff.users),
      }
    : null;

  await db.insert('providerSyncEvents', {
    providerId: params.providerId,
    householdId: params.householdId,
    status: params.status,
    durationMs,
    startedAt: params.startedAt,
    finishedAt: params.finishedAt,
    accountsCreated: summary?.accounts.created ?? 0,
    accountsUpdated: summary?.accounts.updated ?? 0,
    accountsRemoved: summary?.accounts.removed ?? 0,
    transactionsCreated: summary?.transactions.created ?? 0,
    transactionsUpdated: summary?.transactions.updated ?? 0,
    transactionsRemoved: summary?.transactions.removed ?? 0,
    incomeCreated: summary?.incomeStreams.created ?? 0,
    incomeUpdated: summary?.incomeStreams.updated ?? 0,
    incomeRemoved: summary?.incomeStreams.removed ?? 0,
    usersCreated: summary?.users.created ?? 0,
    usersUpdated: summary?.users.updated ?? 0,
    usersRemoved: summary?.users.removed ?? 0,
    errorMessage: params.errorMessage,
    createdAt: Date.now(),
  });
};

type UpsertContext = {
  ctx: ActionCtx;
  householdId: Id<'households'>;
  providerId: string;
};

type UpsertArgs = {
  householdId: Id<'households'>;
  providerId: string;
  result: ProviderSyncResult;
};

const upsertFromProvider = async (ctx: ActionCtx, db: DbClient, args: UpsertArgs) => {
  const accountMap = await upsertAccounts(db, args);
  await upsertIncomeStreams(db, args, accountMap);
  await updateUsers(ctx, db, args);
};

const upsertAccounts = async (
  db: DbClient,
  { householdId, providerId, result }: UpsertArgs
) => {
  const accounts = result.accounts ?? [];

  const existing = await db
    .query('accounts')
    .withIndex('by_household', (q) => q.eq('householdId', householdId))
    .collect();

  const providerAccountIds = new Map<string, Id<'accounts'>>();

  if (accounts.length === 0) {
    return providerAccountIds;
  }

  for (const record of existing) {
    const providerAccountId = record.institution?.accountId;
    if (record.institution?.provider === providerId && providerAccountId) {
      providerAccountIds.set(providerAccountId, record._id);
    }
  }

  for (const account of accounts) {
    const match = existing.find(
      (item) =>
        item.institution?.provider === providerId &&
        item.institution?.accountId === account.providerAccountId
    );

    const metadata = {
      ...(match?.metadata ?? {}),
      ...account.metadata,
      providerAccountId: account.providerAccountId,
    };

    const base = {
      name: account.name,
      kind: account.kind,
      status: account.status,
      currency: account.currency,
      balanceCents: account.balance.cents,
      availableCents: account.available?.cents ?? account.balance.cents,
      metadata,
      institution: {
        provider: providerId,
        accountId: account.providerAccountId,
        lastSyncedAt: now(),
      },
      updatedAt: now(),
    } as const;

    if (match) {
      await db.patch(match._id, base);
      providerAccountIds.set(account.providerAccountId, match._id);
    } else {
      const accountId = await db.insert('accounts', {
        householdId,
        name: account.name,
        kind: account.kind,
        status: account.status,
        currency: account.currency,
        balanceCents: base.balanceCents,
        availableCents: base.availableCents,
        metadata: base.metadata,
        institution: base.institution,
        createdAt: now(),
        updatedAt: now(),
      });
      providerAccountIds.set(account.providerAccountId, accountId);
    }
  }

  return providerAccountIds;
};

const upsertIncomeStreams = async (
  db: DbClient,
  { householdId, providerId, result }: UpsertArgs,
  accountMap: Map<string, Id<'accounts'>> | void
) => {
  const incomes = result.incomeStreams ?? [];
  if (incomes.length === 0) return;

  const existing = await db
    .query('incomeStreams')
    .withIndex('by_household', (q) => q.eq('householdId', householdId))
    .collect();

  for (const income of incomes) {
    const match = existing.find(
      (item) => item.metadata?.providerIncomeId === income.providerIncomeId
    );

    const metadata = {
      ...(match?.metadata ?? {}),
      ...income.metadata,
      providerIncomeId: income.providerIncomeId,
      providerId,
    };

    const base = {
      label: income.label,
      cadence: income.cadence,
      amountCents: income.amount.cents,
      active: true,
      metadata,
      updatedAt: now(),
    } as const;

    const sourceAccountId = income.accountId
      ? accountMap?.get(income.accountId) ?? undefined
      : match?.sourceAccountId;

    if (match) {
      await db.patch(match._id, {
        ...base,
        sourceAccountId,
      });
    } else {
      await db.insert('incomeStreams', {
        householdId,
        sourceAccountId,
        label: income.label,
        cadence: income.cadence,
        amountCents: income.amount.cents,
        active: true,
        metadata,
        createdAt: now(),
        updatedAt: now(),
      });
    }
  }
};

const updateUsers = async (ctx: ActionCtx, db: DbClient, { result }: UpsertArgs) => {
  const users = result.users ?? [];
  if (users.length === 0) return;

  for (const user of users) {
    await updateUserFromProvider(db, user);
  }
};

const updateUserFromProvider = async (db: DbClient, user: ProviderUser) => {
  try {
    const userId = user.providerUserId as Id<'users'>;
    const existing = await db.get(userId);
    if (!existing) return;

    await db.patch(userId, {
      displayName: user.displayName ?? existing.displayName,
      email: user.email ?? existing.email,
      role: user.role ?? existing.role,
      lastActiveAt: now(),
      updatedAt: now(),
    });
  } catch (error) {
    console.warn('Failed to update provider user', error);
  }
};
