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

type CategoryRuleRecord = {
  _id: string;
  organizationId: string;
  matchType: 'merchant_prefix' | 'merchant_exact' | 'mcc' | 'keywords';
  pattern: string;
  categoryKey: string;
  needsVsWants: string | null;
  priority: number;
  createdByProfileId: string;
  createdAt: number;
  lastMatchedAt: number | null;
  moneyMapNodeId: string | null;
};

type ClassificationResult = {
  categoryKey: string | null;
  needsVsWants: string | null;
  moneyMapNodeId: string | null;
  confidence: number | null;
  matchedRuleId: string | null;
};

const normalize = (value: unknown) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const MCC_CATEGORY_MAP: Record<string, { categoryKey: string; needsVsWants: string | null }> = {
  '5411': { categoryKey: 'groceries', needsVsWants: 'needs' },
  '5812': { categoryKey: 'dining', needsVsWants: 'wants' },
  '5541': { categoryKey: 'gas', needsVsWants: 'needs' },
  '5732': { categoryKey: 'electronics', needsVsWants: 'wants' },
  '4131': { categoryKey: 'transportation', needsVsWants: 'needs' },
};

const HEURISTIC_PATTERNS: Array<{
  pattern: RegExp;
  categoryKey: string;
  needsVsWants: string | null;
}> = [
  { pattern: /grocery|market|foods?/i, categoryKey: 'groceries', needsVsWants: 'needs' },
  { pattern: /uber|lyft|ride/i, categoryKey: 'transportation', needsVsWants: 'needs' },
  { pattern: /netflix|spotify|subscription/i, categoryKey: 'entertainment', needsVsWants: 'wants' },
  { pattern: /utility|energy|electric|water/i, categoryKey: 'utilities', needsVsWants: 'needs' },
  { pattern: /school|tuition|books?/i, categoryKey: 'education', needsVsWants: 'needs' },
];

const matchCategoryRule = (transaction: ProviderTransaction, rule: CategoryRuleRecord) => {
  const description = normalize(transaction.description);
  const merchant = normalize((transaction.metadata as any)?.merchantName ?? transaction.description);
  const mcc = typeof (transaction.metadata as any)?.mcc === 'string'
    ? (transaction.metadata as any).mcc
    : null;

  switch (rule.matchType) {
    case 'merchant_prefix':
      return merchant.startsWith(normalize(rule.pattern));
    case 'merchant_exact':
      return merchant === normalize(rule.pattern);
    case 'mcc':
      return mcc === rule.pattern;
    case 'keywords':
      return description.includes(normalize(rule.pattern));
    default:
      return false;
  }
};

const resolveCategoryFromMcc = (transaction: ProviderTransaction): ClassificationResult | null => {
  const mcc = typeof (transaction.metadata as any)?.mcc === 'string'
    ? (transaction.metadata as any).mcc
    : null;
  if (!mcc) return null;
  const mapping = MCC_CATEGORY_MAP[mcc];
  if (!mapping) return null;
  return {
    categoryKey: mapping.categoryKey,
    needsVsWants: mapping.needsVsWants,
    moneyMapNodeId: null,
    confidence: 0.6,
    matchedRuleId: null,
  };
};

const resolveCategoryFromHeuristics = (
  transaction: ProviderTransaction
): ClassificationResult | null => {
  const merchant = (transaction.metadata as any)?.merchantName ?? transaction.description;
  const description = transaction.description;
  for (const heuristic of HEURISTIC_PATTERNS) {
    if (heuristic.pattern.test(merchant) || heuristic.pattern.test(description)) {
      return {
        categoryKey: heuristic.categoryKey,
        needsVsWants: heuristic.needsVsWants,
        moneyMapNodeId: null,
        confidence: 0.5,
        matchedRuleId: null,
      };
    }
  }
  return null;
};

const recurringKeyFor = (transaction: ProviderTransaction) => {
  const merchant = normalize((transaction.metadata as any)?.merchantName ?? transaction.description);
  const amountBucket = Math.abs(transaction.amount.cents);
  return `${merchant}|${amountBucket}`;
};

const recurringKeyForStored = (transaction: any) => {
  const merchant = normalize(transaction.merchantName ?? transaction.description);
  const amount = Math.abs(transaction.amount?.cents ?? 0);
  return `${merchant}|${amount}`;
};

const classifyTransaction = (
  transaction: ProviderTransaction,
  context: {
    rules: CategoryRuleRecord[];
    nodeByCategory: Map<string, string>;
    recurrenceMap: Map<string, { count: number; lastSeen: number }>;
  }
): ClassificationResult => {
  for (const rule of context.rules) {
    if (matchCategoryRule(transaction, rule)) {
      const nodeId =
        rule.moneyMapNodeId ?? context.nodeByCategory.get(rule.categoryKey) ?? null;
      return {
        categoryKey: rule.categoryKey,
        needsVsWants: rule.needsVsWants,
        moneyMapNodeId: nodeId,
        confidence: 1,
        matchedRuleId: rule._id,
      };
    }
  }

  const mccResult = resolveCategoryFromMcc(transaction);
  if (mccResult) {
    const nodeId = mccResult.categoryKey
      ? context.nodeByCategory.get(mccResult.categoryKey) ?? null
      : null;
    return { ...mccResult, moneyMapNodeId: nodeId };
  }

  const heuristicResult = resolveCategoryFromHeuristics(transaction);
  if (heuristicResult) {
    const nodeId = heuristicResult.categoryKey
      ? context.nodeByCategory.get(heuristicResult.categoryKey) ?? null
      : null;
    return { ...heuristicResult, moneyMapNodeId: nodeId };
  }

  const recurrenceKey = recurringKeyFor(transaction);
  const summary = context.recurrenceMap.get(recurrenceKey);
  if (summary && summary.count >= 2) {
    const nodeId = context.nodeByCategory.get('subscriptions') ?? null;
    return {
      categoryKey: 'subscriptions',
      needsVsWants: 'wants',
      moneyMapNodeId: nodeId,
      confidence: 0.4,
      matchedRuleId: null,
    };
  }

  return {
    categoryKey: null,
    needsVsWants: null,
    moneyMapNodeId: null,
    confidence: null,
    matchedRuleId: null,
  };
};

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

const ensureLiabilityTerms = async (
  ctx: any,
  params: {
    organizationId: string;
    accountId: string;
    accountKind: string;
    currency: string;
    balanceCents: number;
  }
) => {
  const existing = await ctx.db
    .query('liabilityTerms')
    .withIndex('by_account', (q: any) => q.eq('accountId', params.accountId))
    .unique();

  if (existing) {
    return existing._id;
  }

  const timestamp = Date.now();
  const liabilityType = params.accountKind === 'credit' ? 'secured_credit' : 'loan';
  const originPrincipal = {
    cents: Math.abs(Math.round(params.balanceCents)),
    currency: params.currency,
  };
  const minimumPayment = {
    cents: Math.max(0, Math.round(params.balanceCents * 0.03)) || 2500,
    currency: params.currency,
  };

  const termId = await ctx.db.insert('liabilityTerms', {
    organizationId: params.organizationId,
    accountId: params.accountId,
    liabilityType,
    originPrincipal,
    interestRate: params.accountKind === 'credit' ? 0.1999 : 0.0599,
    minimumPayment,
    statementDay: null,
    dueDay: null,
    maturesAt: null,
    openedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return termId;
};

const upsertTransactions = async (
  ctx: any,
  params: {
    organizationId: string;
    accountMap: Map<string, string>;
    transactions: ProviderTransaction[];
    categoryRules: CategoryRuleRecord[];
    nodeByCategory: Map<string, string>;
    recurrenceMap: Map<string, { count: number; lastSeen: number }>;
  }
) => {
  const timestamp = Date.now();
  let created = 0;
  let updated = 0;

  const rules = [...params.categoryRules].sort((a, b) => b.priority - a.priority);

  for (const transaction of params.transactions) {
    if (!transaction.providerTransactionId) continue;
    const accountId = params.accountMap.get(transaction.accountId);
    if (!accountId) continue;

    const existing = await ctx.db
      .query('transactions')
      .withIndex('by_provider', (q: any) =>
        q
          .eq('organizationId', params.organizationId)
          .eq('providerTransactionId', transaction.providerTransactionId)
      )
      .unique();

    const classification = classifyTransaction(transaction, {
      rules,
      nodeByCategory: params.nodeByCategory,
      recurrenceMap: params.recurrenceMap,
    });

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
          : classification.categoryKey,
      categoryConfidence:
        typeof (transaction.metadata as any)?.categoryKey === 'string'
          ? 1
          : classification.confidence,
      needsVsWants:
        typeof (transaction.metadata as any)?.needsVsWants === 'string'
          ? (transaction.metadata as any).needsVsWants
          : classification.needsVsWants,
      occurredAt: transaction.postedAt,
      createdAt: timestamp,
      metadata: scrubMetadata(transaction.metadata ?? undefined) ?? null,
      moneyMapNodeId:
        (transaction.metadata as any)?.moneyMapNodeId ??
        classification.moneyMapNodeId ??
        null,
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

    if (classification.matchedRuleId) {
      await ctx.db.patch(classification.matchedRuleId as any, {
        lastMatchedAt: timestamp,
      });
    }

    const recurrenceKey = recurringKeyFor(transaction);
    const history = params.recurrenceMap.get(recurrenceKey);
    const occurredAt = transaction.postedAt;
    if (history) {
      params.recurrenceMap.set(recurrenceKey, {
        count: history.count + 1,
        lastSeen: Math.max(history.lastSeen, occurredAt),
      });
    } else {
      params.recurrenceMap.set(recurrenceKey, {
        count: 1,
        lastSeen: occurredAt,
      });
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

    if (account.kind === 'credit' || account.kind === 'liability') {
      await ensureLiabilityTerms(ctx, {
        organizationId: args.organizationId,
        accountId,
        accountKind: account.kind,
        currency: account.currency ?? account.balance.currency,
        balanceCents: account.balance.cents,
      });
    }
  }

  await ensureDefaultCategoryRules(
    ctx,
    {
      organizationId: args.organizationId,
      createdByProfileId: session.userId,
    },
    moneyMapNodes
  );

  const categoryRules: CategoryRuleRecord[] = await ctx.db
    .query('categoryRules')
    .withIndex('by_organization_priority', (q: any) =>
      q.eq('organizationId', args.organizationId)
    )
    .order('desc')
    .collect();

  const nodeByCategory = new Map<string, string>();
  for (const node of moneyMapNodes) {
    if (node.kind !== 'pod') continue;
    const category = typeof node.metadata?.category === 'string' ? node.metadata.category : null;
    if (category) {
      nodeByCategory.set(category, node._id);
    }
  }

  const recurrenceMap = new Map<string, { count: number; lastSeen: number }>();
  const recentTransactions = await ctx.db
    .query('transactions')
    .withIndex('by_org_time', (q: any) => q.eq('organizationId', args.organizationId))
    .order('desc')
    .take(200);

  for (const record of recentTransactions as any[]) {
    const key = recurringKeyForStored(record);
    const current = recurrenceMap.get(key);
    const occurredAt = typeof record.occurredAt === 'number' ? record.occurredAt : record.createdAt ?? Date.now();
    if (current) {
      recurrenceMap.set(key, {
        count: current.count + 1,
        lastSeen: Math.max(current.lastSeen, occurredAt),
      });
    } else {
      recurrenceMap.set(key, {
        count: 1,
        lastSeen: occurredAt,
      });
    }
  }

  const transactionSummary = syncResult.transactions?.length
    ? await upsertTransactions(ctx, {
        organizationId: args.organizationId,
        accountMap,
        transactions: syncResult.transactions,
        categoryRules,
        nodeByCategory,
        recurrenceMap,
      })
    : { created: 0, updated: 0 };

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
