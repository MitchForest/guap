import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import {
  AccountKindValues,
  AccountSnapshotSourceValues,
  AccountStatusValues,
  CategoryRuleMatchTypeValues,
  EventKindValues,
  GoalStatusValues,
  MoneyMapChangeStatusValues,
  MoneyMapNodeKindValues,
  MoneyMapRuleTriggerValues,
  NeedsVsWantsValues,
  NotificationChannelValues,
  TransactionDirectionValues,
  TransactionSourceValues,
  TransactionStatusValues,
  TransferIntentValues,
  TransferStatusValues,
  UserRoleValues,
} from '@guap/types';

const literalUnion = (values: readonly string[]) =>
  v.union(...values.map((value) => v.literal(value)));

const moneyMapNodeKind = literalUnion(MoneyMapNodeKindValues);
const moneyMapRuleTrigger = literalUnion(MoneyMapRuleTriggerValues);
const moneyMapChangeStatus = literalUnion(MoneyMapChangeStatusValues);

const accountKind = literalUnion(AccountKindValues);
const accountStatus = literalUnion(AccountStatusValues);
const accountSnapshotSource = literalUnion(AccountSnapshotSourceValues);

const transactionDirection = literalUnion(TransactionDirectionValues);
const transactionSource = literalUnion(TransactionSourceValues);
const transactionStatus = literalUnion(TransactionStatusValues);
const needsVsWants = literalUnion(NeedsVsWantsValues);
const categoryRuleMatchType = literalUnion(CategoryRuleMatchTypeValues);

const transferIntent = literalUnion(TransferIntentValues);
const transferStatus = literalUnion(TransferStatusValues);

const eventKind = literalUnion(EventKindValues);
const notificationChannel = literalUnion(NotificationChannelValues);
const goalStatus = literalUnion(GoalStatusValues);

const userRole = literalUnion(UserRoleValues);

const currencyAmount = v.object({
  cents: v.number(),
  currency: v.string(),
});

const optionalCurrencyAmount = v.optional(v.union(currencyAmount, v.null()));

const recordMetadata = v.optional(v.union(v.record(v.string(), v.any()), v.null()));

const moneyMapNodeMetadata = v.optional(
  v.object({
    id: v.optional(v.string()),
    category: v.optional(v.string()),
    parentId: v.optional(v.string()),
    podType: v.optional(
      v.union(
        v.literal('goal'),
        v.literal('category'),
        v.literal('envelope'),
        v.literal('custom')
      )
    ),
    icon: v.optional(v.string()),
    accent: v.optional(v.string()),
    balanceCents: v.optional(v.number()),
    inflow: v.optional(
      v.object({
        amount: v.number(),
        cadence: v.union(
          v.literal('monthly'),
          v.literal('weekly'),
          v.literal('daily')
        ),
      })
    ),
    position: v.optional(
      v.object({
        x: v.number(),
        y: v.number(),
      })
    ),
    returnRate: v.optional(v.number()),
  })
);

const moneyMapEdgeMetadata = v.optional(
  v.object({
    id: v.optional(v.string()),
    ruleId: v.optional(v.string()),
    amountCents: v.optional(v.number()),
    tag: v.optional(v.string()),
  })
);

const moneyMapRuleConfig = v.object({
  ruleId: v.optional(v.string()),
  sourceNodeId: v.optional(v.string()),
  triggerNodeId: v.optional(v.string()),
  allocations: v.optional(
    v.array(
      v.object({
        targetNodeId: v.string(),
        percentage: v.number(),
      })
    )
  ),
});

export default defineSchema({
  moneyMaps: defineTable({
    organizationId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_organization', ['organizationId']),

  moneyMapNodes: defineTable({
    mapId: v.id('moneyMaps'),
    key: v.string(),
    kind: moneyMapNodeKind,
    label: v.string(),
    metadata: moneyMapNodeMetadata,
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_map', ['mapId']),

  moneyMapEdges: defineTable({
    mapId: v.id('moneyMaps'),
    sourceKey: v.string(),
    targetKey: v.string(),
    metadata: moneyMapEdgeMetadata,
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_map', ['mapId']),

  moneyMapRules: defineTable({
    mapId: v.id('moneyMaps'),
    key: v.string(),
    trigger: moneyMapRuleTrigger,
    config: moneyMapRuleConfig,
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_map', ['mapId']),

  moneyMapChangeRequests: defineTable({
    mapId: v.id('moneyMaps'),
    organizationId: v.string(),
    submitterId: v.string(),
    status: moneyMapChangeStatus,
    summary: v.optional(v.string()),
    payload: v.object({
      organizationId: v.string(),
      name: v.string(),
      description: v.optional(v.string()),
      nodes: v.array(
        v.object({
          key: v.string(),
          kind: moneyMapNodeKind,
          label: v.string(),
          metadata: moneyMapNodeMetadata,
        })
      ),
      edges: v.array(
        v.object({
          sourceKey: v.string(),
          targetKey: v.string(),
          metadata: moneyMapEdgeMetadata,
        })
      ),
      rules: v.array(
        v.object({
          key: v.string(),
          trigger: moneyMapRuleTrigger,
          config: moneyMapRuleConfig,
        })
      ),
    }),
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index('by_map_status', ['mapId', 'status'])
    .index('by_organization_status', ['organizationId', 'status']),

  financialAccounts: defineTable({
    organizationId: v.string(),
    moneyMapNodeId: v.id('moneyMapNodes'),
    name: v.string(),
    kind: accountKind,
    status: accountStatus,
    currency: v.string(),
    balance: currencyAmount,
    available: optionalCurrencyAmount,
    provider: v.string(),
    providerAccountId: v.optional(v.union(v.string(), v.null())),
    lastSyncedAt: v.optional(v.union(v.number(), v.null())),
    metadata: recordMetadata,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_organization', ['organizationId'])
    .index('by_organization_kind', ['organizationId', 'kind'])
    .index('by_provider', ['provider', 'providerAccountId']),

  accountSnapshots: defineTable({
    organizationId: v.string(),
    accountId: v.id('financialAccounts'),
    capturedAt: v.number(),
    balance: currencyAmount,
    available: optionalCurrencyAmount,
    source: accountSnapshotSource,
    createdAt: v.number(),
  }).index('by_account_time', ['accountId', 'capturedAt']),

  transactions: defineTable({
    organizationId: v.string(),
    accountId: v.id('financialAccounts'),
    transferId: v.optional(v.union(v.id('transfers'), v.null())),
    providerTransactionId: v.optional(v.union(v.string(), v.null())),
    direction: transactionDirection,
    source: transactionSource,
    status: transactionStatus,
    amount: currencyAmount,
    description: v.string(),
    merchantName: v.optional(v.union(v.string(), v.null())),
    categoryKey: v.optional(v.union(v.string(), v.null())),
    categoryConfidence: v.optional(v.union(v.number(), v.null())),
    needsVsWants: v.optional(v.union(needsVsWants, v.null())),
    occurredAt: v.number(),
    createdAt: v.number(),
    metadata: recordMetadata,
    moneyMapNodeId: v.optional(v.union(v.id('moneyMapNodes'), v.null())),
  })
    .index('by_account_time', ['accountId', 'occurredAt'])
    .index('by_org_category_time', ['organizationId', 'categoryKey', 'occurredAt'])
    .index('by_provider', ['organizationId', 'providerTransactionId']),

  categoryRules: defineTable({
    organizationId: v.string(),
    matchType: categoryRuleMatchType,
    pattern: v.string(),
    categoryKey: v.string(),
    needsVsWants: v.optional(v.union(needsVsWants, v.null())),
    priority: v.number(),
    createdByProfileId: v.string(),
    createdAt: v.number(),
    lastMatchedAt: v.optional(v.union(v.number(), v.null())),
    moneyMapNodeId: v.optional(v.union(v.id('moneyMapNodes'), v.null())),
  }).index('by_organization_priority', ['organizationId', 'priority']),

  transfers: defineTable({
    organizationId: v.string(),
    intent: transferIntent,
    sourceAccountId: v.optional(v.union(v.id('financialAccounts'), v.null())),
    destinationAccountId: v.id('financialAccounts'),
    amount: currencyAmount,
    requestedByProfileId: v.string(),
    approvedByProfileId: v.optional(v.union(v.string(), v.null())),
    status: transferStatus,
    goalId: v.optional(v.union(v.string(), v.null())),
    orderId: v.optional(v.union(v.string(), v.null())),
    requestedAt: v.number(),
    approvedAt: v.optional(v.union(v.number(), v.null())),
    executedAt: v.optional(v.union(v.number(), v.null())),
    metadata: recordMetadata,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_organization_status', ['organizationId', 'status'])
    .index('by_destination_time', ['destinationAccountId', 'requestedAt'])
    .index('by_goal', ['goalId']),

  eventsJournal: defineTable({
    organizationId: v.string(),
    eventKind: eventKind,
    actorProfileId: v.optional(v.union(v.string(), v.null())),
    primaryEntity: v.object({
      table: v.string(),
      id: v.string(),
    }),
    relatedEntities: v.optional(
      v.array(
        v.object({
          table: v.string(),
          id: v.string(),
        })
      )
    ),
    payload: recordMetadata,
    createdAt: v.number(),
  }).index('by_organization_time', ['organizationId', 'createdAt']),

  eventReceipts: defineTable({
    eventId: v.id('eventsJournal'),
    profileId: v.string(),
    deliveredAt: v.number(),
    readAt: v.optional(v.union(v.number(), v.null())),
  }).index('by_profile_event', ['profileId', 'eventId']),

  notificationPreferences: defineTable({
    profileId: v.string(),
    channel: notificationChannel,
    eventKind: eventKind,
    enabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_profile_channel', ['profileId', 'channel']),

  savingsGoals: defineTable({
    organizationId: v.string(),
    moneyMapNodeId: v.id('moneyMapNodes'),
    accountId: v.id('financialAccounts'),
    name: v.string(),
    targetAmount: currencyAmount,
    startingAmount: currencyAmount,
    targetDate: v.optional(v.union(v.number(), v.null())),
    status: goalStatus,
    createdByProfileId: v.string(),
    createdAt: v.number(),
    achievedAt: v.optional(v.union(v.number(), v.null())),
    archivedAt: v.optional(v.union(v.number(), v.null())),
  })
    .index('by_organization', ['organizationId'])
    .index('by_money_map_node', ['moneyMapNodeId'])
    .index('by_account', ['accountId']),

  transferGuardrails: defineTable({
    organizationId: v.string(),
    scope: v.union(
      v.object({ type: v.literal('organization') }),
      v.object({ type: v.literal('money_map_node'), nodeId: v.id('moneyMapNodes') }),
      v.object({ type: v.literal('account'), accountId: v.id('financialAccounts') })
    ),
    intent: transferIntent,
    direction: v.object({
      sourceNodeId: v.union(v.null(), v.id('moneyMapNodes')),
      destinationNodeId: v.union(v.null(), v.id('moneyMapNodes')),
    }),
    approvalPolicy: v.union(
      v.literal('auto'),
      v.literal('parent_required'),
      v.literal('admin_only')
    ),
    autoApproveUpToCents: v.optional(v.union(v.null(), v.number())),
    dailyLimitCents: v.optional(v.union(v.null(), v.number())),
    weeklyLimitCents: v.optional(v.union(v.null(), v.number())),
    allowedInstrumentKinds: v.optional(
      v.array(
        v.union(
          v.literal('etf'),
          v.literal('stock'),
          v.literal('bond'),
          v.literal('cash')
        )
      )
    ),
    blockedSymbols: v.optional(v.array(v.string())),
    maxOrderAmountCents: v.optional(v.union(v.null(), v.number())),
    requireApprovalForSell: v.optional(v.union(v.null(), v.boolean())),
    allowedRolesToInitiate: v.array(userRole),
    createdByProfileId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_organization_intent', ['organizationId', 'intent'])
    .index('by_scope_intent', ['scope.type', 'intent']),
});
