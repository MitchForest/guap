import { api } from '../codegen/api';
import type { Id } from '../codegen/dataModel';
import {
  AccountKindSchema,
  AccountStatusSchema,
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
} from '@guap/types';
import type { UserRole } from '@guap/types';
import { z } from 'zod';
import type { ConvexClientInstance } from './env';
import type { BackendApi } from './types';
export { createConvexClient } from './env';
export {
  createWorkspacePublishPayload,
  type WorkspaceGraphNodeInput,
  type WorkspaceGraphFlowInput,
  type WorkspaceGraphRuleInput,
  type WorkspaceGraphPublishInput,
} from './workspaces';

type Client = ConvexClientInstance;

const householdRecordSchema = z.object({
  _id: z.string(),
  name: z.string(),
  slug: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const membershipSchema = z.object({
  _id: z.string(),
  householdId: z.string(),
  userId: z.string(),
  role: MembershipRoleSchema,
  status: MembershipStatusSchema,
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
  householdId: z.string().optional(),
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
export type UserProfileRecord = z.infer<typeof userSchema>;
export type ApiUserRole = z.infer<typeof UserRoleSchema>;
export type WorkspaceRecord = z.infer<typeof WorkspaceRecordSchema>;
export type WorkspaceGraphRecord = z.infer<typeof WorkspaceGraphRecordSchema>;
export type WorkspaceRuleAllocationRecord = z.infer<typeof WorkspaceRuleAllocationRecordSchema>;
export type WorkspaceRuleRecord = z.infer<typeof WorkspaceRuleRecordSchema>;
export type WorkspacePublishPayload = z.infer<typeof WorkspacePublishPayloadSchema>;
export type WorkspacePublishResult = z.infer<typeof WorkspacePublishResultSchema>;
export type ProviderSyncEventRecord = z.infer<typeof providerSyncEventSchema>;
export type WorkspaceSandboxEventRecord = z.infer<typeof sandboxEventSchema>;

type UserId = Id<'users'>;
type HouseholdId = Id<'households'>;

export class GuapApi {
  constructor(private readonly client: Client) {}

  async listHouseholds(userId: UserId | string) {
    const result = await this.client.query(api.households.listForUser, {
      userId: userId as UserId,
    });
    return z.array(householdRecordSchema).parse(result);
  }

  async listHouseholdMembers(householdId: HouseholdId | string) {
    const result = await this.client.query(api.households.listMembers, {
      householdId: householdId as HouseholdId,
    });
    return z
      .array(
        z.object({
          user: userSchema,
          membership: membershipSchema,
        })
      )
      .parse(result);
  }

  async listAccounts(householdId: HouseholdId | string) {
    const result = await this.client.query(api.accounts.listForHousehold, {
      householdId: householdId as HouseholdId,
    });
    return z.array(accountSchema).parse(result);
  }

  async listIncomeStreams(householdId: HouseholdId | string) {
    const result = await this.client.query(api.income.listForHousehold, {
      householdId: householdId as HouseholdId,
    });
    return z.array(incomeSchema).parse(result);
  }

  async listRequests(householdId: HouseholdId | string) {
    const result = await this.client.query(api.requests.listForHousehold, {
      householdId: householdId as HouseholdId,
    });
    return z.array(requestSchema).parse(result);
  }

  async listProviderSyncEvents(providerId: string, limit = 50) {
    const result = await this.client.query(api.providerEvents.listRecent, {
      providerId,
      limit,
    });
    return z.array(providerSyncEventSchema).parse(result);
  }

  async listSandboxEvents(householdId: HouseholdId | string, limit = 50) {
    const result = await this.client.query(api.sandboxEvents.listForHousehold, {
      householdId: householdId as HouseholdId,
      limit,
    });
    return z.array(sandboxEventSchema).parse(result);
  }

  async listWorkspaces(householdId: HouseholdId | string) {
    const result = await this.client.query(api.workspaces.getByHousehold, {
      householdId: householdId as HouseholdId,
    });
    return z.array(WorkspaceRecordSchema).parse(result);
  }

  async ensureWorkspacePair(payload: {
    householdId: HouseholdId | string;
    slug: string;
    name: string;
    sandboxSlug?: string;
    sandboxName?: string;
  }) {
    return await this.client.mutation(api.workspaces.ensurePair, {
      householdId: payload.householdId as HouseholdId,
      slug: payload.slug,
      name: payload.name,
      sandboxSlug: payload.sandboxSlug,
      sandboxName: payload.sandboxName,
    });
  }

  async getWorkspace(slug: string) {
    const workspace = await this.client.query(api.workspaces.getBySlug, { slug });
    return workspace ? WorkspaceRecordSchema.parse(workspace) : null;
  }

  async getWorkspaceVariant(householdId: HouseholdId | string, variant: 'live' | 'sandbox') {
    const workspace = await this.client.query(api.workspaces.getVariant, {
      householdId: householdId as HouseholdId,
      variant,
    });
    return workspace ? WorkspaceRecordSchema.parse(workspace) : null;
  }

  async deleteWorkspace(workspaceId: string) {
    await this.client.mutation(api.workspaces.remove, {
      workspaceId: workspaceId as Id<'workspaces'>,
    });
  }

  async resetSandbox(payload: { householdId: HouseholdId | string; actorUserId: Id<'users'> | string }) {
    return await this.client.mutation(api.workspaces.resetSandbox, {
      householdId: payload.householdId as HouseholdId,
      actorUserId: payload.actorUserId as Id<'users'>,
    });
  }

  async applySandbox(payload: {
    householdId: HouseholdId | string;
    actorUserId: Id<'users'> | string;
    bypassApproval?: boolean;
  }) {
    return await this.client.mutation(api.workspaces.applySandbox, {
      householdId: payload.householdId as HouseholdId,
      actorUserId: payload.actorUserId as Id<'users'>,
      bypassApproval: payload.bypassApproval,
    });
  }

  async fetchWorkspaceGraph(slug: string) {
    const result = await this.client.query(api.graph.getGraph, { slug });
    if (!result) return null;
    return WorkspaceGraphRecordSchema.parse(result);
  }

  async publishWorkspaceGraph(payload: WorkspacePublishPayload) {
    const parsed = WorkspacePublishPayloadSchema.parse(payload);
    const result = await this.client.mutation(api.graph.publish, parsed);
    return WorkspacePublishResultSchema.parse(result);
  }

  async ensureUser(payload: {
    authId: string;
    email?: string;
    displayName: string;
    role: ApiUserRole;
    avatarUrl?: string;
    householdId?: string;
    guardianId?: string;
  }) {
    const result = await this.client.mutation(api.users.ensure, {
      authId: payload.authId,
      email: payload.email,
      displayName: payload.displayName,
      role: payload.role,
      avatarUrl: payload.avatarUrl,
      householdId: payload.householdId as Id<'households'> | undefined,
      guardianId: payload.guardianId as Id<'users'> | undefined,
    });
    return result as Id<'users'>;
  }

  async createProfile(payload: {
    authId: string;
    email: string;
    displayName: string;
    role: ApiUserRole;
    avatarUrl?: string;
  }) {
    const result = await this.client.mutation(api.users.createProfile, {
      authId: payload.authId,
      email: payload.email,
      displayName: payload.displayName,
      role: payload.role,
      avatarUrl: payload.avatarUrl,
    });
    return result as Id<'users'>;
  }

  async getUserById(userId: string) {
    const result = await this.client.query(api.users.getById, {
      userId: userId as Id<'users'>,
    });
    return result ? userSchema.parse(result) : null;
  }

  async getUserByAuthId(authId: string) {
    const result = await this.client.query(api.users.getByAuthId, { authId });
    return result ? userSchema.parse(result) : null;
  }

  async getUserProfile(authId: string) {
    const result = await this.client.query(api.users.getUserProfile, { authId });
    return result ? userSchema.parse(result) : null;
  }

  async updateUserProfile(payload: {
    userId: string;
    displayName?: string;
    avatarUrl?: string | null;
    role?: ApiUserRole;
    email?: string;
    householdId?: string | null;
    guardianId?: string | null;
  }) {
    await this.client.mutation(api.users.updateProfile, {
      userId: payload.userId as Id<'users'>,
      displayName: payload.displayName,
      avatarUrl: payload.avatarUrl,
      role: payload.role,
      email: payload.email,
      householdId: payload.householdId as Id<'households'> | null | undefined,
      guardianId: payload.guardianId as Id<'users'> | null | undefined,
    });
  }

  async createHousehold(payload: { name: string; slug: string; creatorUserId: string }) {
    const householdId = await this.client.mutation(api.households.create, {
      name: payload.name,
      slug: payload.slug,
      creatorUserId: payload.creatorUserId as Id<'users'>,
    });
    return householdId as Id<'households'>;
  }

  async addHouseholdMember(payload: {
    householdId: string;
    userId: string;
    role: z.infer<typeof MembershipRoleSchema>;
    status?: z.infer<typeof MembershipStatusSchema>;
  }) {
    await this.client.mutation(api.households.addMember, {
      householdId: payload.householdId as Id<'households'>,
      userId: payload.userId as Id<'users'>,
      role: payload.role,
      status: payload.status,
    });
  }
}

export const createGuapApi = (client: Client) => new GuapApi(client);

export type { BackendApi };
