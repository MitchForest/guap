import { z } from 'zod';
import { api } from '../codegen/api';
import type { ConvexClientInstance } from './env';
import type { BackendApi } from './types';
import {
  MoneyMapChangeRequestRecordSchema,
  MoneyMapChangeStatusSchema,
  MoneyMapSnapshotSchema,
  type MoneyMapChangeRequestRecord as MoneyMapChangeRequestRecordType,
  type MoneyMapChangeStatus as MoneyMapChangeStatusType,
  type MoneyMapSnapshot as MoneyMapSnapshotType,
} from '@guap/types';
import {
  createMoneyMapSaveInput,
  workspaceGraphFromSnapshot,
  MoneyMapSaveInputSchema,
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
} from './moneyMap';

export { createConvexClient } from './env';
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
} from './moneyMap';
export type { BackendApi } from './types';
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

type Client = ConvexClientInstance;

const SubmitChangeRequestSchema = z.object({
  mapId: z.string(),
  organizationId: z.string(),
  submitterId: z.string(),
  summary: z.string().optional(),
  payload: MoneyMapSaveInputSchema,
});

const UpdateChangeRequestStatusSchema = z.object({
  requestId: z.string(),
  status: MoneyMapChangeStatusSchema,
});

export type SubmitChangeRequestInput = z.infer<typeof SubmitChangeRequestSchema>;
export type UpdateChangeRequestStatusInput = z.infer<typeof UpdateChangeRequestStatusSchema>;

export class GuapApi {
  constructor(private readonly client: Client) {}

  async loadMoneyMap(organizationId: string): Promise<MoneyMapSnapshotType | null> {
    const result = await this.client.query(api.moneyMaps.load, { organizationId });
    return result ? MoneyMapSnapshotSchema.parse(result) : null;
  }

  async saveMoneyMap(payload: MoneyMapSaveInput): Promise<MoneyMapSnapshotType> {
    const parsed = MoneyMapSaveInputSchema.parse(payload);
    const result = await this.client.mutation(api.moneyMaps.save, parsed);
    return MoneyMapSnapshotSchema.parse(result);
  }

  async submitChangeRequest(input: SubmitChangeRequestInput): Promise<string> {
    const parsed = SubmitChangeRequestSchema.parse(input);
    const result = await this.client.mutation(api.moneyMaps.submitChangeRequest, parsed);
    return z.string().parse(result);
  }

  async updateChangeRequestStatus(input: UpdateChangeRequestStatusInput): Promise<void> {
    const parsed = UpdateChangeRequestStatusSchema.parse(input);
    await this.client.mutation(api.moneyMaps.updateChangeRequestStatus, parsed);
  }

  async listChangeRequests(
    organizationId: string,
    status?: MoneyMapChangeStatusType
  ): Promise<MoneyMapChangeRequestRecordType[]> {
    const result = await this.client.query(api.moneyMaps.listChangeRequests, {
      organizationId,
      status,
    });
    return z.array(MoneyMapChangeRequestRecordSchema).parse(result);
  }
}

export const createGuapApi = (client: Client) => new GuapApi(client);
