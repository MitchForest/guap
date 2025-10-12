import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import {
  AccountKindValues,
  AccountStatusValues,
  AutomationEdgeKindValues,
  IncomeCadenceValues,
  BillingIntervalValues,
  HouseholdPlanStatusValues,
  HouseholdPlanValues,
  InviteKindValues,
  InviteStateValues,
  MembershipRoleValues,
  MembershipStatusValues,
  OrganizationBillingIntervalValues,
  OrganizationBillingPlanValues,
  OrganizationKindValues,
  OrganizationStatusValues,
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

const householdPlan = literalEnum(HouseholdPlanValues);

const householdPlanStatus = literalEnum(HouseholdPlanStatusValues);

const billingInterval = literalEnum(BillingIntervalValues);

const organizationKind = literalEnum(OrganizationKindValues);

const organizationStatus = literalEnum(OrganizationStatusValues);

const organizationBillingPlan = literalEnum(OrganizationBillingPlanValues);

const organizationBillingInterval = literalEnum(OrganizationBillingIntervalValues);

const inviteKind = literalEnum(InviteKindValues);

const inviteState = literalEnum(InviteStateValues);

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

const organizationPricingTier = v.object({
  minSeats: v.number(),
  maxSeats: v.optional(v.number()),
  monthlyCentsPerSeat: v.number(),
  annualCentsPerSeat: v.number(),
});

const organizationPricing = v.object({
  baseMonthlyCents: v.optional(v.number()),
  baseAnnualCents: v.optional(v.number()),
  includedSeats: v.optional(v.number()),
  tiers: v.optional(v.array(organizationPricingTier)),
});

export default defineSchema({
  users: defineTable({
    authId: v.string(),
    email: v.optional(v.string()),
    role: userRole,
    displayName: v.string(),
    avatarUrl: v.optional(v.string()),
    householdId: v.optional(v.id('households')),
    guardianId: v.optional(v.id('users')),
    primaryOrganizationId: v.optional(v.id('organizations')),
    defaultMembershipId: v.optional(v.id('organizationMemberships')),
    onboarding: v.optional(
      v.object({
        organizationId: v.optional(v.id('organizations')),
        inviteId: v.optional(v.id('membershipInvites')),
        role: v.optional(membershipRole),
        joinCode: v.optional(v.string()),
        status: v.optional(v.string()),
      })
    ),
    impersonatedByUserId: v.optional(v.id('users')),
    permissions: v.optional(v.record(v.string(), v.boolean())),
    lastActiveAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_auth_id', ['authId'])
    .index('by_household', ['householdId'])
    .index('by_guardian', ['guardianId'])
    .index('by_primary_organization', ['primaryOrganizationId'])
    .index('by_impersonator', ['impersonatedByUserId']),

  households: defineTable({
    name: v.string(),
    slug: v.string(),
    plan: v.optional(householdPlan),
    planStatus: v.optional(householdPlanStatus),
    planInterval: v.optional(billingInterval),
    planSeats: v.optional(v.number()),
    subscriptionId: v.optional(v.string()),
    customerId: v.optional(v.string()),
    linkedOrganizationId: v.optional(v.id('organizations')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_slug', ['slug'])
    .index('by_linked_org', ['linkedOrganizationId']),

  householdMemberships: defineTable({
    householdId: v.id('households'),
    userId: v.id('users'),
    role: membershipRole,
    status: membershipStatus,
    organizationMembershipId: v.optional(v.id('organizationMemberships')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_household', ['householdId'])
    .index('by_user', ['userId'])
    .index('by_organization_membership', ['organizationMembershipId']),

  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    logo: v.optional(v.string()),
    shortCode: v.string(),
    joinCode: v.string(),
    kind: organizationKind,
    type: v.optional(v.string()),
    status: organizationStatus,
    createdByUserId: v.id('users'),
    primaryHouseholdId: v.optional(v.id('households')),
    billingPlan: organizationBillingPlan,
    billingInterval: organizationBillingInterval,
    pricing: v.optional(organizationPricing),
    subscriptionId: v.optional(v.string()),
    customerId: v.optional(v.string()),
    seatCapacity: v.optional(v.number()),
    seatUsage: v.optional(
      v.object({
        total: v.number(),
        students: v.number(),
        guardians: v.number(),
      })
    ),
    billingProvider: v.optional(
      v.object({
        provider: v.optional(v.string()),
        customerId: v.optional(v.string()),
        subscriptionId: v.optional(v.string()),
        status: v.optional(v.string()),
      })
    ),
    metadata: v.optional(v.record(v.string(), v.any())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_slug', ['slug'])
    .index('by_short_code', ['shortCode'])
    .index('by_join_code', ['joinCode'])
    .index('by_creator', ['createdByUserId']),

  organizationMemberships: defineTable({
    organizationId: v.id('organizations'),
    userId: v.id('users'),
    role: membershipRole,
    status: membershipStatus,
    invitedByUserId: v.optional(v.id('users')),
    invitationId: v.optional(v.id('membershipInvites')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_organization', ['organizationId'])
    .index('by_user', ['userId'])
    .index('by_role', ['organizationId', 'role'])
    .index('by_invitation', ['invitationId']),

  membershipInvites: defineTable({
    targetKind: inviteKind,
    organizationId: v.optional(v.id('organizations')),
    householdId: v.optional(v.id('households')),
    email: v.string(),
    role: membershipRole,
    code: v.string(),
    token: v.string(),
    state: inviteState,
    invitedByUserId: v.id('users'),
    invitedAt: v.number(),
    expiresAt: v.optional(v.number()),
    acceptedByUserId: v.optional(v.id('users')),
    acceptedAt: v.optional(v.number()),
    rejectedByUserId: v.optional(v.id('users')),
    rejectedAt: v.optional(v.number()),
    canceledByUserId: v.optional(v.id('users')),
    canceledAt: v.optional(v.number()),
    metadata: v.optional(v.record(v.string(), v.any())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_target', ['targetKind'])
    .index('by_email', ['email'])
    .index('by_code', ['code'])
    .index('by_token', ['token']),

  accounts: defineTable({
    householdId: v.id('households'),
    organizationId: v.optional(v.id('organizations')),
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
    .index('by_organization', ['organizationId'])
    .index('by_owner', ['ownerUserId']),

  incomeStreams: defineTable({
    householdId: v.id('households'),
    organizationId: v.optional(v.id('organizations')),
    sourceAccountId: v.optional(v.id('accounts')),
    label: v.string(),
    cadence: incomeCadence,
    amountCents: v.number(),
    active: v.boolean(),
    metadata: v.optional(v.record(v.string(), v.any())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_household', ['householdId'])
    .index('by_organization', ['organizationId']),

  requests: defineTable({
    householdId: v.id('households'),
    organizationId: v.optional(v.id('organizations')),
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
    .index('by_organization', ['organizationId'])
    .index('by_assignee', ['assignedToUserId'])
    .index('by_creator', ['createdByUserId']),

  notifications: defineTable({
    userId: v.id('users'),
    organizationId: v.optional(v.id('organizations')),
    kind: notificationKind,
    payload: v.optional(v.record(v.string(), v.any())),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_organization', ['organizationId']),

  providerSyncEvents: defineTable({
    providerId: v.string(),
    householdId: v.id('households'),
    organizationId: v.optional(v.id('organizations')),
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
    .index('by_household', ['householdId'])
    .index('by_organization', ['organizationId']),

  workspaceSandboxEvents: defineTable({
    householdId: v.id('households'),
    workspaceId: v.id('workspaces'),
    organizationId: v.optional(v.id('organizations')),
    actorUserId: v.id('users'),
    event: v.union(v.literal('reset'), v.literal('apply')),
    triggeredAt: v.number(),
    metadata: v.optional(v.record(v.string(), v.any())),
  })
    .index('by_household', ['householdId'])
    .index('by_workspace', ['workspaceId'])
    .index('by_organization', ['organizationId']),

  workspaces: defineTable({
    name: v.string(),
    slug: v.string(),
    householdId: v.id('households'),
    organizationId: v.optional(v.id('organizations')),
    variant: workspaceVariant,
    lastSyncedAt: v.optional(v.number()),
    lastAppliedAt: v.optional(v.number()),
    pendingRequestId: v.optional(v.id('requests')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_slug', ['slug'])
    .index('by_household_variant', ['householdId', 'variant'])
    .index('by_organization_variant', ['organizationId', 'variant']),

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
