import { z } from 'zod';
import { api } from '../codegen/api';
import type { ConvexClientInstance } from './env';
import type { BackendApi } from './types';
import {
  AccountKindSchema,
  AccountStatusSchema,
  BillingIntervalSchema,
  HouseholdPlanSchema,
  HouseholdPlanStatusSchema,
  IncomeCadenceSchema,
  MembershipRoleSchema,
  MembershipStatusSchema,
  RequestKindSchema,
  RequestStateSchema,
  UserRoleSchema,
  WorkspaceEdgeRecordSchema,
  WorkspaceGraphRecordSchema,
  WorkspacePublishPayloadSchema,
  WorkspacePublishResultSchema,
  WorkspaceRecordSchema,
  WorkspaceRuleAllocationRecordSchema,
  WorkspaceRuleRecordSchema,
  MoneyMapChangeRequestRecordSchema,
  MoneyMapChangeStatusSchema,
  MoneyMapNodeKindSchema,
  MoneyMapRuleTriggerSchema,
  MoneyMapSnapshotSchema,
  type MoneyMapChangeRequestRecord,
  type MoneyMapChangeStatus,
  type MoneyMapSnapshot,
} from '@guap/types';
import {
  createWorkspacePublishPayload,
  type WorkspaceGraphFlowInput,
  type WorkspaceGraphNodeInput,
  type WorkspaceGraphPublishInput,
  type WorkspaceGraphRuleInput,
} from './workspaces';

export { createConvexClient } from './env';
export {
  createWorkspacePublishPayload,
  type WorkspaceGraphNodeInput,
  type WorkspaceGraphFlowInput,
  type WorkspaceGraphRuleInput,
  type WorkspaceGraphPublishInput,
} from './workspaces';
export type {
  BackendApi,
  MoneyMapSnapshot,
  MoneyMapChangeStatus,
  MoneyMapChangeRequestRecord,
};

type Client = ConvexClientInstance;

const householdRecordSchema = z.object({
  _id: z.string(),
  name: z.string(),
  slug: z.string(),
  plan: HouseholdPlanSchema,
  planStatus: HouseholdPlanStatusSchema,
  planInterval: BillingIntervalSchema.optional(),
  planSeats: z.number().int().nonnegative().optional(),
  subscriptionId: z.string().optional(),
  customerId: z.string().optional(),
  linkedOrganizationId: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const membershipSchema = z.object({
  _id: z.string(),
  householdId: z.string(),
  userId: z.string(),
  role: MembershipRoleSchema,
  status: MembershipStatusSchema,
  organizationMembershipId: z.string().optional().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const userSchema = z.object({
  _id: z.string(),
  authId: z.string(),
  role: UserRoleSchema,
  displayName: z.string(),
  avatarUrl: z.string().optional(),
  email: z.string().optional(),
  householdId: z.string().optional().nullable(),
  guardianId: z.string().optional().nullable(),
  primaryOrganizationId: z.string().optional().nullable(),
  defaultMembershipId: z.string().optional().nullable(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
});

const accountSchema = z.object({
  _id: z.string(),
  householdId: z.string(),
  ownerUserId: z.string().nullable().optional(),
  name: z.string(),
  kind: AccountKindSchema,
  status: AccountStatusSchema,
  currency: z.string(),
  balanceCents: z.number(),
  availableCents: z.number().nullable().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const incomeSchema = z.object({
  _id: z.string(),
  householdId: z.string(),
  label: z.string(),
  cadence: IncomeCadenceSchema,
  amountCents: z.number(),
  sourceAccountId: z.string().optional(),
  active: z.boolean(),
  metadata: z.record(z.string(), z.any()).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const requestSchema = z.object({
  _id: z.string(),
  householdId: z.string(),
  createdByUserId: z.string(),
  assignedToUserId: z.string().optional(),
  kind: RequestKindSchema,
  state: RequestStateSchema,
  payload: z.record(z.string(), z.any()).optional(),
  resolvedByUserId: z.string().optional(),
  resolvedAt: z.number().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const providerSyncEventSchema = z.object({
  _id: z.string(),
  providerId: z.string(),
  householdId: z.string(),
  status: z.enum(['success', 'error']),
  durationMs: z.number(),
  startedAt: z.number(),
  finishedAt: z.number(),
  accountsCreated: z.number(),
  accountsUpdated: z.number(),
  accountsRemoved: z.number(),
  transactionsCreated: z.number(),
  transactionsUpdated: z.number(),
  transactionsRemoved: z.number(),
  incomeCreated: z.number(),
  incomeUpdated: z.number(),
  incomeRemoved: z.number(),
  usersCreated: z.number(),
  usersUpdated: z.number(),
  usersRemoved: z.number(),
  errorMessage: z.string().optional(),
  createdAt: z.number(),
});

const sandboxEventSchema = z.object({
  _id: z.string(),
  householdId: z.string(),
  workspaceId: z.string(),
  actorUserId: z.string(),
  event: z.enum(['reset', 'apply']),
  triggeredAt: z.number(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type HouseholdRecord = z.infer<typeof householdRecordSchema>;
export type AccountRecord = z.infer<typeof accountSchema>;
export type IncomeRecord = z.infer<typeof incomeSchema>;
export type RequestRecord = z.infer<typeof requestSchema>;
export type MembershipRecord = z.infer<typeof membershipSchema>;
export type UserRecord = z.infer<typeof userSchema>;
export type ProviderSyncEventRecord = z.infer<typeof providerSyncEventSchema>;
export type WorkspaceSandboxEventRecord = z.infer<typeof sandboxEventSchema>;
export type WorkspaceRecord = z.infer<typeof WorkspaceRecordSchema>;
export type WorkspaceGraphRecord = z.infer<typeof WorkspaceGraphRecordSchema>;
export type WorkspaceRuleAllocationRecord = z.infer<typeof WorkspaceRuleAllocationRecordSchema>;
export type WorkspaceRuleRecord = z.infer<typeof WorkspaceRuleRecordSchema>;
export type WorkspacePublishPayload = z.infer<typeof WorkspacePublishPayloadSchema>;
export type WorkspacePublishResult = z.infer<typeof WorkspacePublishResultSchema>;

const MoneyMapNodeInputSchema = z.object({
  key: z.string(),
  kind: MoneyMapNodeKindSchema,
  label: z.string(),
  metadata: z.record(z.string(), z.any()).optional(),
});

const MoneyMapEdgeInputSchema = z.object({
  sourceKey: z.string(),
  targetKey: z.string(),
});

const MoneyMapRuleInputSchema = z.object({
  key: z.string(),
  trigger: MoneyMapRuleTriggerSchema,
  config: z.record(z.string(), z.any()),
});

const MoneyMapSaveInputSchema = z.object({
  organizationId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  nodes: z.array(MoneyMapNodeInputSchema),
  edges: z.array(MoneyMapEdgeInputSchema),
  rules: z.array(MoneyMapRuleInputSchema),
});

const SubmitChangeRequestSchema = z.object({
  mapId: z.string(),
  organizationId: z.string(),
  submitterId: z.string(),
  summary: z.string().optional(),
  payload: z.record(z.string(), z.any()),
});

const UpdateChangeRequestStatusSchema = z.object({
  requestId: z.string(),
  status: MoneyMapChangeStatusSchema,
});

export type MoneyMapNodeInput = z.infer<typeof MoneyMapNodeInputSchema>;
export type MoneyMapEdgeInput = z.infer<typeof MoneyMapEdgeInputSchema>;
export type MoneyMapRuleInput = z.infer<typeof MoneyMapRuleInputSchema>;
export type MoneyMapSaveInput = z.infer<typeof MoneyMapSaveInputSchema>;
export type SubmitChangeRequestInput = z.infer<typeof SubmitChangeRequestSchema>;
export type UpdateChangeRequestStatusInput = z.infer<typeof UpdateChangeRequestStatusSchema>;

export class GuapApi {
  constructor(private readonly client: Client) {}

  // Legacy household helpers – return empty placeholders while the app transitions to Better Auth data.
  async listHouseholds(_userId: string): Promise<HouseholdRecord[]> {
    return [];
  }

  async listHouseholdMembers(_householdId: string): Promise<Array<{ user: UserRecord; membership: MembershipRecord }>> {
    return [];
  }

  async listAccounts(_householdId: string): Promise<AccountRecord[]> {
    return [];
  }

  async listIncomeStreams(_householdId: string): Promise<IncomeRecord[]> {
    return [];
  }

  async listRequests(_householdId: string): Promise<RequestRecord[]> {
    return [];
  }

  async createHousehold(_payload: {
    name: string;
    slug: string;
    creatorUserId: string;
    plan?: string;
  }): Promise<string> {
    return 'legacy-household';
  }

  async updateUserProfile(_payload: { userId: string; householdId?: string | null }): Promise<void> {
    return;
  }

  async getUserProfile(_authId: string): Promise<UserRecord | null> {
    return null;
  }

  async createProfile(_payload: {
    authId: string;
    email: string;
    displayName: string;
    role: string;
  }): Promise<string> {
    return 'legacy-user';
  }

  async getUserById(_userId: string): Promise<UserRecord | null> {
    return null;
  }

  async ensureWorkspacePair(_payload: {
    householdId: string;
    slug: string;
    name: string;
    sandboxSlug?: string;
    sandboxName?: string;
  }): Promise<void> {
    return;
  }

  async listWorkspaces(_householdId: string): Promise<WorkspaceRecord[]> {
    return [];
  }

  async getWorkspace(_slug: string): Promise<WorkspaceRecord | null> {
    return null;
  }

  async getWorkspaceVariant(_householdId: string, _variant: 'live' | 'sandbox'): Promise<WorkspaceRecord | null> {
    return null;
  }

  async fetchWorkspaceGraph(_slug: string): Promise<z.infer<typeof WorkspaceGraphRecordSchema> | null> {
    return null;
  }

  async publishWorkspaceGraph(_payload: WorkspacePublishPayload): Promise<z.infer<typeof WorkspacePublishResultSchema>> {
    return {
      nodes: {},
      edges: {},
      rules: {},
    };
  }

  async resetSandbox(_payload: { householdId: string; actorUserId: string }): Promise<void> {
    return;
  }

  async applySandbox(_payload: {
    householdId: string;
    actorUserId: string;
    bypassApproval?: boolean;
  }): Promise<{ requiresApproval: boolean }> {
    return { requiresApproval: false };
  }

  async loadMoneyMap(organizationId: string) {
    const result = await this.client.query(api.moneyMaps.load, { organizationId });
    return result ? MoneyMapSnapshotSchema.parse(result) : null;
  }

  async saveMoneyMap(payload: MoneyMapSaveInput) {
    const parsed = MoneyMapSaveInputSchema.parse(payload);
    const result = await this.client.mutation(api.moneyMaps.save, parsed);
    return MoneyMapSnapshotSchema.parse(result);
  }

  async submitChangeRequest(input: SubmitChangeRequestInput) {
    const parsed = SubmitChangeRequestSchema.parse(input);
    return await this.client.mutation(api.moneyMaps.submitChangeRequest, parsed);
  }

  async updateChangeRequestStatus(input: UpdateChangeRequestStatusInput) {
    const parsed = UpdateChangeRequestStatusSchema.parse(input);
    await this.client.mutation(api.moneyMaps.updateChangeRequestStatus, parsed);
  }

  async listChangeRequests(organizationId: string, status?: MoneyMapChangeStatus) {
    const result = await this.client.query(api.moneyMaps.listChangeRequests, {
      organizationId,
      status,
    });
    return z.array(MoneyMapChangeRequestRecordSchema).parse(result);
  }
}

export const createGuapApi = (client: Client) => new GuapApi(client);
