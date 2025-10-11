import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import {
  AccountKindValues,
  AccountStatusValues,
  AutomationEdgeKindValues,
  IncomeCadenceValues,
  MembershipRoleValues,
  MembershipStatusValues,
  RequestKindValues,
  RequestStateValues,
  UserRoleValues,
  WorkspaceNodeKindValues,
  WorkspaceRuleTriggerValues,
} from '@guap/types';
import { literalEnum } from './utils';

export const nodePosition = v.object({
  x: v.number(),
  y: v.number(),
});

const workspaceVariant = v.union(v.literal('live'), v.literal('sandbox'));

const graphSnapshot = v.object({
  nodes: v.array(
    v.object({
      clientId: v.string(),
      type: literalEnum(WorkspaceNodeKindValues),
      label: v.string(),
      icon: v.optional(v.string()),
      accent: v.optional(v.string()),
      balanceCents: v.optional(v.number()),
      parentClientId: v.optional(v.string()),
      position: nodePosition,
      metadata: v.optional(v.record(v.string(), v.any())),
    })
  ),
  edges: v.array(
    v.object({
      clientId: v.string(),
      sourceClientId: v.string(),
      targetClientId: v.string(),
      kind: v.optional(literalEnum(AutomationEdgeKindValues)),
      ruleClientId: v.optional(v.string()),
    })
  ),
  rules: v.array(
    v.object({
      clientId: v.string(),
      sourceClientId: v.string(),
      trigger: literalEnum(WorkspaceRuleTriggerValues),
      triggerNodeClientId: v.optional(v.string()),
      allocations: v.array(
        v.object({
          targetClientId: v.string(),
          percentage: v.number(),
        })
      ),
    })
  ),
});

const userRole = literalEnum(UserRoleValues);

const membershipRole = literalEnum(MembershipRoleValues);

const membershipStatus = literalEnum(MembershipStatusValues);

const accountKind = literalEnum(AccountKindValues);

const accountStatus = literalEnum(AccountStatusValues);

const incomeCadence = literalEnum(IncomeCadenceValues);

const requestKind = literalEnum(RequestKindValues);

const requestState = literalEnum(RequestStateValues);

const notificationKind = v.union(
  v.literal('request'),
  v.literal('transfer'),
  v.literal('automation'),
  v.literal('milestone')
);

export default defineSchema({
  users: defineTable({
    authId: v.string(),
    email: v.optional(v.string()),
    role: userRole,
    displayName: v.string(),
    avatarUrl: v.optional(v.string()),
    householdId: v.optional(v.id('households')),
    guardianId: v.optional(v.id('users')),
    lastActiveAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_auth_id', ['authId'])
    .index('by_household', ['householdId'])
    .index('by_guardian', ['guardianId']),

  households: defineTable({
    name: v.string(),
    slug: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_slug', ['slug']),

  householdMemberships: defineTable({
    householdId: v.id('households'),
    userId: v.id('users'),
    role: membershipRole,
    status: membershipStatus,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_household', ['householdId'])
    .index('by_user', ['userId']),

  accounts: defineTable({
    householdId: v.id('households'),
    ownerUserId: v.optional(v.id('users')),
    name: v.string(),
    kind: accountKind,
    status: accountStatus,
    currency: v.string(),
    balanceCents: v.number(),
    availableCents: v.optional(v.number()),
    institution: v.optional(
      v.object({
        provider: v.optional(v.string()),
        accountId: v.optional(v.string()),
        lastSyncedAt: v.optional(v.number()),
      })
    ),
    metadata: v.optional(v.record(v.string(), v.any())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_household', ['householdId'])
    .index('by_owner', ['ownerUserId']),

  incomeStreams: defineTable({
    householdId: v.id('households'),
    sourceAccountId: v.optional(v.id('accounts')),
    label: v.string(),
    cadence: incomeCadence,
    amountCents: v.number(),
    active: v.boolean(),
    metadata: v.optional(v.record(v.string(), v.any())),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_household', ['householdId']),

  requests: defineTable({
    householdId: v.id('households'),
    createdByUserId: v.id('users'),
    assignedToUserId: v.optional(v.id('users')),
    kind: requestKind,
    state: requestState,
    payload: v.optional(v.record(v.string(), v.any())),
    resolvedByUserId: v.optional(v.id('users')),
    resolvedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_household', ['householdId'])
    .index('by_assignee', ['assignedToUserId'])
    .index('by_creator', ['createdByUserId']),

  notifications: defineTable({
    userId: v.id('users'),
    kind: notificationKind,
    payload: v.optional(v.record(v.string(), v.any())),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index('by_user', ['userId']),

  providerSyncEvents: defineTable({
    providerId: v.string(),
    householdId: v.id('households'),
    status: v.union(v.literal('success'), v.literal('error')),
    durationMs: v.number(),
    startedAt: v.number(),
    finishedAt: v.number(),
    accountsCreated: v.number(),
    accountsUpdated: v.number(),
    accountsRemoved: v.number(),
    transactionsCreated: v.number(),
    transactionsUpdated: v.number(),
    transactionsRemoved: v.number(),
    incomeCreated: v.number(),
    incomeUpdated: v.number(),
    incomeRemoved: v.number(),
    usersCreated: v.number(),
    usersUpdated: v.number(),
    usersRemoved: v.number(),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_provider', ['providerId'])
    .index('by_household', ['householdId']),

  workspaceSandboxEvents: defineTable({
    householdId: v.id('households'),
    workspaceId: v.id('workspaces'),
    actorUserId: v.id('users'),
    event: v.union(v.literal('reset'), v.literal('apply')),
    triggeredAt: v.number(),
    metadata: v.optional(v.record(v.string(), v.any())),
  })
    .index('by_household', ['householdId'])
    .index('by_workspace', ['workspaceId']),

  workspaces: defineTable({
    name: v.string(),
    slug: v.string(),
    householdId: v.id('households'),
    variant: workspaceVariant,
    lastSyncedAt: v.optional(v.number()),
    lastAppliedAt: v.optional(v.number()),
    pendingRequestId: v.optional(v.id('requests')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_slug', ['slug'])
    .index('by_household_variant', ['householdId', 'variant']),

  nodes: defineTable({
    workspaceId: v.id('workspaces'),
    type: literalEnum(WorkspaceNodeKindValues),
    label: v.string(),
    icon: v.optional(v.string()),
    accent: v.optional(v.string()),
    balanceCents: v.optional(v.number()),
    parentId: v.optional(v.id('nodes')),
    position: nodePosition,
    metadata: v.optional(v.record(v.string(), v.any())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_workspace', ['workspaceId'])
    .index('by_workspace_type', ['workspaceId', 'type']),

  edges: defineTable({
    workspaceId: v.id('workspaces'),
    sourceNodeId: v.id('nodes'),
    targetNodeId: v.id('nodes'),
    kind: v.optional(literalEnum(AutomationEdgeKindValues)),
    ruleId: v.optional(v.id('rules')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_workspace', ['workspaceId'])
    .index('by_source_target', ['sourceNodeId', 'targetNodeId']),

  rules: defineTable({
    workspaceId: v.id('workspaces'),
    sourceNodeId: v.id('nodes'),
    triggerType: literalEnum(WorkspaceRuleTriggerValues),
    triggerNodeId: v.optional(v.id('nodes')),
    schedule: v.optional(
      v.object({
        cadence: v.union(v.literal('daily'), v.literal('weekly'), v.literal('monthly')),
        day: v.optional(v.number()),
      })
    ),
    name: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_workspace', ['workspaceId'])
    .index('by_source', ['sourceNodeId']),

  ruleAllocations: defineTable({
    ruleId: v.id('rules'),
    order: v.number(),
    percentage: v.number(),
    targetNodeId: v.id('nodes'),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_rule', ['ruleId']),

  canvasSessions: defineTable({
    workspaceId: v.id('workspaces'),
    snapshot: v.object({
      nodes: v.array(
        v.object({ id: v.id('nodes'), position: nodePosition })
      ),
      edges: v.array(v.object({ id: v.id('edges') })),
      viewport: v.object({ x: v.number(), y: v.number(), scale: v.number() }),
    }),
    status: v.union(v.literal('draft'), v.literal('published')),
    authorId: v.optional(v.string()),
    savedAt: v.number(),
  }).index('by_workspace', ['workspaceId']),

  workspaceChangeDiffs: defineTable({
    workspaceId: v.id('workspaces'),
    version: v.number(),
    baseSnapshot: graphSnapshot,
    proposedSnapshot: graphSnapshot,
    summary: v.object({
      addedNodes: v.number(),
      removedNodes: v.number(),
      updatedNodes: v.number(),
      automationChanges: v.number(),
    }),
    createdAt: v.number(),
    createdByUserId: v.id('users'),
  })
    .index('by_workspace', ['workspaceId'])
    .index('by_workspace_version', ['workspaceId', 'version']),
});
