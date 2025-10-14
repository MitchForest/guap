import type { ConvexClientInstance } from './core/client';
import { createConvexClient } from './core/client';
import type { BackendApi } from './core/types';
import {
  createMoneyMapsApi,
  MoneyMapsApi,
  MoneyMapSaveInputSchema,
  createMoneyMapSaveInput,
  workspaceGraphFromSnapshot,
  type MoneyMapDraft,
  type MoneyMapDraftFlowInput,
  type MoneyMapDraftNodeInput,
  type MoneyMapDraftRuleInput,
  type MoneyMapGraphAllocation,
  type MoneyMapGraphData,
  type MoneyMapGraphEdge,
  type MoneyMapGraphNode,
  type MoneyMapGraphRule,
  type MoneyMapEdgeInput,
  type MoneyMapNodeInput,
  type MoneyMapRuleInput,
  type MoneyMapSaveInput,
  type SubmitChangeRequestInput,
  type UpdateChangeRequestStatusInput,
} from './domains/moneyMaps';
import {
  createAuthApi,
  AuthApi,
  type AuthCompleteSignupInput,
  type AuthCompleteSignupResult,
} from './domains/auth';
import type {
  MoneyMapChangeRequestRecord,
  MoneyMapChangeStatus,
  MoneyMapSnapshot,
  MoneyMapNodeKind,
  MoneyMapRuleTrigger,
} from '@guap/types';

export { createConvexClient };
export type { ConvexClientInstance };
export type { BackendApi } from './core/types';

export {
  createMoneyMapSaveInput,
  workspaceGraphFromSnapshot,
  MoneyMapSaveInputSchema,
  type MoneyMapDraftNodeInput,
  type MoneyMapDraftFlowInput,
  type MoneyMapDraftRuleInput,
  type MoneyMapDraft,
  type MoneyMapGraphNode,
  type MoneyMapGraphEdge,
  type MoneyMapGraphRule,
  type MoneyMapGraphAllocation,
  type MoneyMapGraphData,
  type MoneyMapNodeInput,
  type MoneyMapEdgeInput,
  type MoneyMapRuleInput,
  type MoneyMapSaveInput,
  type SubmitChangeRequestInput,
  type UpdateChangeRequestStatusInput,
} from './domains/moneyMaps';
export {
  type AuthCompleteSignupInput,
  type AuthCompleteSignupResult,
} from './domains/auth';
export type {
  HouseholdRecord,
  MembershipRecord,
  ProfileRecord,
  AccountRecord,
  IncomeRecord,
  RequestRecord,
  MoneyMapSnapshot,
  MoneyMapChangeStatus,
  MoneyMapChangeRequestRecord,
  MoneyMapNodeKind,
  MoneyMapRuleTrigger,
} from '@guap/types';

export class GuapApi {
  readonly moneyMaps: MoneyMapsApi;
  readonly auth: AuthApi;

  constructor(private readonly client: ConvexClientInstance) {
    this.moneyMaps = createMoneyMapsApi(client);
    this.auth = createAuthApi(client);
  }

  async loadMoneyMap(organizationId: string): Promise<MoneyMapSnapshot | null> {
    return this.moneyMaps.load(organizationId);
  }

  async saveMoneyMap(payload: MoneyMapSaveInput): Promise<MoneyMapSnapshot> {
    return this.moneyMaps.save(payload);
  }

  async submitChangeRequest(input: SubmitChangeRequestInput): Promise<string> {
    return this.moneyMaps.submitChangeRequest(input);
  }

  async updateChangeRequestStatus(input: UpdateChangeRequestStatusInput): Promise<void> {
    await this.moneyMaps.updateChangeRequestStatus(input);
  }

  async listChangeRequests(
    organizationId: string,
    status?: MoneyMapChangeStatus
  ): Promise<MoneyMapChangeRequestRecord[]> {
    return this.moneyMaps.listChangeRequests(organizationId, status);
  }

  async completeSignup(
    input: AuthCompleteSignupInput
  ): Promise<AuthCompleteSignupResult> {
    return this.auth.completeSignup(input);
  }
}

export const createGuapApi = (client: ConvexClientInstance) => new GuapApi(client);
