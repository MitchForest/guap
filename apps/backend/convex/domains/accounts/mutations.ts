import { z } from 'zod';
import { virtualProvider } from '@guap/providers';
import type { ProviderAccount, ProviderTransaction } from '@guap/providers';
import { defineMutation } from '../../core/functions';
import {
  ensureOrganizationAccess,
  ensureRole,
  OWNER_ADMIN_ROLES,
} from '../../core/session';
import { now, scrubMetadata } from '../moneyMaps/services';
import { logEvent } from '../events/services';

const SyncAccountsArgs = {
  organizationId: z.string(),
  provider: z.string().optional(),
  force: z.boolean().optional(),
} as const;

const SyncAccountsSchema = z.object(SyncAccountsArgs);
export type SyncAccountsInput = z.infer<typeof SyncAccountsSchema>;

const resolveStartOfDay = (timestamp: number) => {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const DEFAULT_MONEY_MAP_NAME = 'Household Money Map';

const ensureMoneyMap = async (ctx: any, organizationId: string) => {
  const existing = await ctx.db
    .query('moneyMaps')
    .withIndex('by_organization', (q: any) => q.eq('organizationId', organizationId))
    .unique();

  if (existing) {
    return existing;
  }

  const timestamp = now();
  const mapId = await ctx.db.insert('moneyMaps', {
    organizationId,
    name: DEFAULT_MONEY_MAP_NAME,
    description: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const map = await ctx.db.get(mapId);
  if (!map) {
    throw new Error('Failed to create Money Map');
  }
  return map;
};

const resolveMoneyMapNodes = async (ctx: any, organizationId: string) => {
  const map = await ensureMoneyMap(ctx, organizationId);

  const nodes = await ctx.db
    .query('moneyMapNodes')
    .withIndex('by_map', (q: any) => q.eq('mapId', map._id))
    .collect();

  const nodeByKey = new Map<string, any>();
  for (const node of nodes) {
    if (typeof node.key === 'string') {
      nodeByKey.set(node.key, node);
    }
  }

  const accountNodes = nodes.filter((node: any) => node.kind === 'account');

  return { map, nodes, nodeByKey, accountNodes };
};

const resolveNodeForAccount = (
  account: ProviderAccount,
  context: { nodeByKey: Map<string, any>; accountNodes: any[] }
) => {
  const metadata = (account.metadata ?? {}) as Record<string, unknown>;
  const fromMetadata =
    typeof metadata.moneyMapNodeKey === 'string'
      ? (metadata.moneyMapNodeKey as string)
      : null;
  if (fromMetadata && context.nodeByKey.has(fromMetadata)) {
    return context.nodeByKey.get(fromMetadata);
  }

  const fromName = account.name?.toLowerCase?.();
  if (fromName) {
    const match = context.accountNodes.find(
      (node: any) => typeof node.label === 'string' && node.label.toLowerCase() === fromName
    );
    if (match) return match;
  }

  return null;
};

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

const generateMoneyMapNodeKey = (
  providerId: string,
  account: ProviderAccount,
  nodeByKey: Map<string, any>
) => {
  const metadata = (account.metadata ?? {}) as Record<string, unknown>;
  const metadataKey =
    typeof metadata.moneyMapNodeKey === 'string' && metadata.moneyMapNodeKey.trim().length > 0
      ? metadata.moneyMapNodeKey.trim()
      : null;

  if (metadataKey) {
    let key = metadataKey;
    let suffix = 1;
    while (nodeByKey.has(key)) {
      key = `${metadataKey}-${suffix++}`;
    }
    return key;
  }

  const baseSource =
    (typeof account.providerAccountId === 'string' && account.providerAccountId.length > 0
      ? account.providerAccountId
      : account.name) ?? 'account';
  const base = slugify(baseSource || 'account');
  let key = `provider-${providerId}-${base || 'account'}`;
  let suffix = 1;
  while (nodeByKey.has(key)) {
    key = `provider-${providerId}-${base || 'account'}-${suffix++}`;
  }
  return key;
};

const createMoneyMapAccountNode = async (
  ctx: any,
  params: {
    map: any;
    providerId: string;
    account: ProviderAccount;
    timestamp: number;
    nodeByKey: Map<string, any>;
    accountNodes: any[];
    allNodes: any[];
  }
) => {
  const key = generateMoneyMapNodeKey(params.providerId, params.account, params.nodeByKey);
  const metadata = scrubMetadata({
    category: params.account.kind,
    balanceCents: params.account.balance.cents,
    providerAccountId: params.account.providerAccountId ?? null,
    provider: params.providerId,
  });

  const nodeId = await ctx.db.insert('moneyMapNodes', {
    mapId: params.map._id,
    key,
    kind: 'account',
    label: params.account.name,
    metadata,
    createdAt: params.timestamp,
    updatedAt: params.timestamp,
  });

  await ctx.db.patch(params.map._id, { updatedAt: params.timestamp });

  const record = {
    _id: nodeId,
    mapId: params.map._id,
    key,
    kind: 'account',
    label: params.account.name,
    metadata,
    createdAt: params.timestamp,
    updatedAt: params.timestamp,
  };

  params.nodeByKey.set(key, record);
  params.accountNodes.push(record);
  params.allNodes.push(record);

  return record;
};

const deriveCategoryRuleSeeds = (nodes: any[]) => {
  const seeds: Array<{
    matchType: 'keywords';
    pattern: string;
    categoryKey: string;
    needsVsWants: string | null;
  }> = [];
  const seen = new Set<string>();

  for (const node of nodes) {
    if (node.kind !== 'pod') continue;
    const label = typeof node.label === 'string' ? node.label.trim() : '';
    if (!label) continue;
    const normalizedLabel = label.toLowerCase();
    if (seen.has(normalizedLabel)) continue;
    seen.add(normalizedLabel);

    const categoryKey =
      typeof node.metadata?.category === 'string' && node.metadata.category.length > 0
        ? node.metadata.category
        : slugify(label) || `pod-${node._id}`;

    const needsVsWants =
      typeof node.metadata?.needsVsWants === 'string'
        ? (node.metadata.needsVsWants as string)
        : null;

    seeds.push({
      matchType: 'keywords',
      pattern: label,
      categoryKey,
      needsVsWants,
    });
  }

  return seeds;
};

const ensureAccountSnapshot = async (
  ctx: any,
  params: {
    organizationId: string;
    accountId: string;
    balance: { cents: number; currency: string };
    available: { cents: number; currency: string } | null | undefined;
  }
) => {
  const capturedAt = resolveStartOfDay(Date.now());
  const existing = await ctx.db
    .query('accountSnapshots')
    .withIndex('by_account_time', (q: any) =>
      q.eq('accountId', params.accountId).eq('capturedAt', capturedAt)
    )
    .unique();

  if (existing) {
    return existing._id;
  }

  return await ctx.db.insert('accountSnapshots', {
    organizationId: params.organizationId,
    accountId: params.accountId,
    capturedAt,
    balance: params.balance,
    available: params.available ?? null,
    source: 'sync',
    createdAt: Date.now(),
  });
};

const ensureAccountGuardrail = async (
  ctx: any,
  params: { organizationId: string; accountId: string; createdByProfileId: string | null }
) => {
  const guardrails = await ctx.db
    .query('transferGuardrails')
    .withIndex('by_organization_intent', (q: any) =>
      q.eq('organizationId', params.organizationId).eq('intent', 'manual')
    )
    .collect();

  const existing = guardrails.find(
    (rule: any) => rule.scope?.type === 'account' && rule.scope.accountId === params.accountId
  );

  if (existing) {
    return existing._id;
  }

  const timestamp = Date.now();
  const guardrailId = await ctx.db.insert('transferGuardrails', {
    organizationId: params.organizationId,
    scope: { type: 'account', accountId: params.accountId },
    intent: 'manual',
    direction: { sourceNodeId: null, destinationNodeId: null },
    approvalPolicy: 'auto',
    autoApproveUpToCents: null,
    dailyLimitCents: null,
    weeklyLimitCents: null,
    allowedInstrumentKinds: null,
    blockedSymbols: [],
    maxOrderAmountCents: null,
    requireApprovalForSell: null,
    allowedRolesToInitiate: ['owner', 'admin', 'member'],
    createdByProfileId: params.createdByProfileId ?? 'system',
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  await logEvent(ctx.db, {
    organizationId: params.organizationId,
    eventKind: 'guardrail_updated',
    actorProfileId: params.createdByProfileId,
    primaryEntity: { table: 'transferGuardrails', id: guardrailId },
    payload: { scope: 'account', accountId: params.accountId },
  });

  return guardrailId;
};

const upsertTransactions = async (
  ctx: any,
  params: {
    organizationId: string;
    accountMap: Map<string, string>;
    transactions: ProviderTransaction[];
  }
) => {
  const timestamp = Date.now();
  let created = 0;
  let updated = 0;

  for (const transaction of params.transactions) {
    if (!transaction.providerTransactionId) continue;
    const accountId = params.accountMap.get(transaction.accountId);
    if (!accountId) continue;

    const existing = await ctx.db
      .query('transactions')
      .withIndex('by_provider', (q: any) =>
        q.eq('organizationId', params.organizationId).eq('providerTransactionId', transaction.providerTransactionId)
      )
      .unique();

    const payload = {
      organizationId: params.organizationId,
      accountId,
      transferId: null,
      providerTransactionId: transaction.providerTransactionId,
      direction: transaction.amount.cents >= 0 ? 'credit' : 'debit',
      source: 'provider',
      status: 'posted',
      amount: {
        cents: Math.abs(transaction.amount.cents),
        currency: transaction.amount.currency,
      },
      description: transaction.description,
      merchantName:
        typeof (transaction.metadata as any)?.merchantName === 'string'
          ? (transaction.metadata as any).merchantName
          : null,
      categoryKey:
        typeof (transaction.metadata as any)?.categoryKey === 'string'
          ? (transaction.metadata as any).categoryKey
          : null,
      categoryConfidence: null,
      needsVsWants: null,
      occurredAt: transaction.postedAt,
      createdAt: timestamp,
      metadata: scrubMetadata(transaction.metadata ?? undefined) ?? null,
      moneyMapNodeId: null,
    };

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...payload,
        createdAt: existing.createdAt,
      });
      updated += 1;
    } else {
      await ctx.db.insert('transactions', payload);
      created += 1;
    }
  }

  return { created, updated };
};

const ensureDefaultCategoryRules = async (
  ctx: any,
  params: { organizationId: string; createdByProfileId: string | null },
  moneyMapNodes: any[]
) => {
  const existingCount = await ctx.db
    .query('categoryRules')
    .withIndex('by_organization_priority', (q: any) =>
      q.eq('organizationId', params.organizationId)
    )
    .take(1);

  if (existingCount.length > 0) {
    return;
  }

  const timestamp = Date.now();
  const derivedSeeds = deriveCategoryRuleSeeds(moneyMapNodes);
  const seeds = derivedSeeds.length
    ? derivedSeeds.map((seed, index) => ({
        ...seed,
        priority: 100 - index * 5,
      }))
    : [
        {
          matchType: 'merchant_prefix' as const,
          pattern: 'Corner',
          categoryKey: 'groceries',
          needsVsWants: 'needs',
          priority: 100,
        },
        {
          matchType: 'merchant_prefix' as const,
          pattern: 'Guap Earn',
          categoryKey: 'income',
          needsVsWants: 'neutral',
          priority: 95,
        },
        {
          matchType: 'merchant_prefix' as const,
          pattern: 'Virtual Savings',
          categoryKey: 'interest',
          needsVsWants: 'neutral',
          priority: 90,
        },
      ];

  for (const rule of seeds) {
    await ctx.db.insert('categoryRules', {
      organizationId: params.organizationId,
      matchType: rule.matchType,
      pattern: rule.pattern,
      categoryKey: rule.categoryKey,
      needsVsWants: rule.needsVsWants,
      priority: rule.priority,
      createdByProfileId: params.createdByProfileId ?? 'system',
      createdAt: timestamp,
      lastMatchedAt: null,
      moneyMapNodeId: null,
    });
  }
};

export const syncAccountsImpl = async (ctx: any, args: SyncAccountsInput) => {
  const session = await ensureOrganizationAccess(ctx, args.organizationId);
  ensureRole(session, OWNER_ADMIN_ROLES);

  const providerId = args.provider ?? virtualProvider.id;
  if (providerId !== virtualProvider.id) {
    throw new Error(`Unsupported provider: ${providerId}`);
  }

  const { map, nodes: moneyMapNodes, nodeByKey, accountNodes } = await resolveMoneyMapNodes(
    ctx,
    args.organizationId
  );

  const syncResult = await virtualProvider.sync({
    householdId: session.activeOrganizationId ?? args.organizationId,
    organizationId: args.organizationId,
    profileId: session.userId ?? 'system',
    providerConfig: undefined,
    forceRefresh: Boolean(args.force),
  });

  const timestamp = Date.now();
  const accountMap = new Map<string, string>();
  const createdAccountIds: string[] = [];
  const updatedAccountIds: string[] = [];

  for (const account of syncResult.accounts ?? []) {
    let targetNode = resolveNodeForAccount(account, { nodeByKey, accountNodes });
    if (!targetNode) {
      targetNode = await createMoneyMapAccountNode(ctx, {
        map,
        providerId,
        account,
        timestamp,
        nodeByKey,
        accountNodes,
        allNodes: moneyMapNodes,
      });
    }

    const providerAccountId = account.providerAccountId;
    const existing = providerAccountId
      ? await ctx.db
          .query('financialAccounts')
          .withIndex('by_provider', (q: any) =>
            q.eq('provider', providerId).eq('providerAccountId', providerAccountId)
          )
          .unique()
      : null;

    const basePayload = {
      organizationId: args.organizationId,
      moneyMapNodeId: targetNode._id,
      name: account.name,
      kind: account.kind,
      status: account.status,
      currency: account.currency ?? account.balance.currency,
      balance: account.balance,
      available: account.available ?? null,
      provider: providerId,
      providerAccountId: providerAccountId ?? null,
      lastSyncedAt: timestamp,
      metadata: scrubMetadata(account.metadata ?? undefined) ?? null,
      updatedAt: timestamp,
    };

    let accountId: string;
    if (existing) {
      await ctx.db.patch(existing._id, basePayload);
      accountId = existing._id;
      updatedAccountIds.push(accountId);
    } else {
      accountId = await ctx.db.insert('financialAccounts', {
        ...basePayload,
        createdAt: timestamp,
      });
      createdAccountIds.push(accountId);
    }

    accountMap.set(providerAccountId ?? account.name, accountId);

    await ensureAccountSnapshot(ctx, {
      organizationId: args.organizationId,
      accountId,
      balance: account.balance,
      available: account.available ?? null,
    });

    await ensureAccountGuardrail(ctx, {
      organizationId: args.organizationId,
      accountId,
      createdByProfileId: session.userId,
    });
  }

  const transactionSummary = syncResult.transactions?.length
    ? await upsertTransactions(ctx, {
        organizationId: args.organizationId,
        accountMap,
        transactions: syncResult.transactions,
      })
    : { created: 0, updated: 0 };

  await ensureDefaultCategoryRules(
    ctx,
    {
      organizationId: args.organizationId,
      createdByProfileId: session.userId,
    },
    moneyMapNodes
  );

  await logEvent(ctx.db, {
    organizationId: args.organizationId,
    eventKind: 'account_synced',
    actorProfileId: session.userId,
    primaryEntity: {
      table: 'financialAccounts',
      id: createdAccountIds[0] ?? updatedAccountIds[0] ?? 'unknown',
    },
    payload: {
      createdAccounts: createdAccountIds.length,
      updatedAccounts: updatedAccountIds.length,
      transactionsCreated: transactionSummary.created,
      transactionsUpdated: transactionSummary.updated,
    },
  });

  return {
    provider: providerId,
    createdAccountIds,
    updatedAccountIds,
    transactions: transactionSummary,
  };
};

export const syncAccounts = defineMutation({
  args: SyncAccountsArgs,
  handler: async (ctx, rawArgs) => {
    const args = SyncAccountsSchema.parse(rawArgs);
    return await syncAccountsImpl(ctx, args);
  },
});
