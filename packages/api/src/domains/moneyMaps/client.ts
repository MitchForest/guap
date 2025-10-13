import { z } from 'zod';
import type { ConvexClientInstance } from '../../core/client';
import {
  MoneyMapChangeRequestRecordSchema,
  MoneyMapChangeStatusSchema,
  MoneyMapSnapshotSchema,
  type MoneyMapChangeRequestRecord,
  type MoneyMapChangeStatus,
  type MoneyMapSnapshot,
} from '@guap/types';
import {
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
} from './transformers';

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

const MoneyMapsSaveMutation = 'domains/moneyMaps/mutations:save' as const;
const MoneyMapsLoadQuery = 'domains/moneyMaps/queries:load' as const;
const MoneyMapsSubmitMutation = 'domains/moneyMaps/mutations:submitChangeRequest' as const;
const MoneyMapsUpdateMutation = 'domains/moneyMaps/mutations:updateChangeRequestStatus' as const;
const MoneyMapsListQuery = 'domains/moneyMaps/queries:listChangeRequests' as const;

export class MoneyMapsApi {
  constructor(private readonly client: ConvexClientInstance) {}

  async load(organizationId: string): Promise<MoneyMapSnapshot | null> {
    const result = await (this.client.query as any)(MoneyMapsLoadQuery, { organizationId });
    return result ? MoneyMapSnapshotSchema.parse(result) : null;
  }

  async save(payload: MoneyMapSaveInput): Promise<MoneyMapSnapshot> {
    const result = await (this.client.mutation as any)(MoneyMapsSaveMutation, payload);
    return MoneyMapSnapshotSchema.parse(result);
  }

  async submitChangeRequest(input: SubmitChangeRequestInput): Promise<string> {
    const parsed = SubmitChangeRequestSchema.parse(input);
    const result = await (this.client.mutation as any)(MoneyMapsSubmitMutation, parsed);
    return z.string().parse(result);
  }

  async updateChangeRequestStatus(input: UpdateChangeRequestStatusInput): Promise<void> {
    const parsed = UpdateChangeRequestStatusSchema.parse(input);
    await (this.client.mutation as any)(MoneyMapsUpdateMutation, parsed);
  }

  async listChangeRequests(
    organizationId: string,
    status?: MoneyMapChangeStatus
  ): Promise<MoneyMapChangeRequestRecord[]> {
    const result = await (this.client.query as any)(MoneyMapsListQuery, {
      organizationId,
      status,
    });
    return z.array(MoneyMapChangeRequestRecordSchema).parse(result);
  }
}

export const createMoneyMapsApi = (client: ConvexClientInstance) => new MoneyMapsApi(client);

export type {
  MoneyMapDraft,
  MoneyMapDraftFlowInput,
  MoneyMapDraftNodeInput,
  MoneyMapDraftRuleInput,
  MoneyMapGraphNode,
  MoneyMapGraphEdge,
  MoneyMapGraphRule,
  MoneyMapGraphAllocation,
  MoneyMapGraphData,
  MoneyMapNodeInput,
  MoneyMapEdgeInput,
  MoneyMapRuleInput,
  MoneyMapSaveInput,
} from './transformers';
