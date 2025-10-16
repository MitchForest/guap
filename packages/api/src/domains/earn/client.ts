import { z } from 'zod';
import type { ConvexClientInstance } from '../../core/client';
import {
  CreateIncomeStreamInputSchema,
  UpdateIncomeStreamInputSchema,
  RequestIncomePayoutInputSchema,
  SkipIncomePayoutInputSchema,
  IncomeStreamRecordSchema,
  IncomeStreamStatusSchema,
  EarnSummarySchema,
  EarnTimelineEntrySchema,
  EarnPayoutResultSchema,
  type CreateIncomeStreamInput,
  type UpdateIncomeStreamInput,
  type RequestIncomePayoutInput,
  type SkipIncomePayoutInput,
  type IncomeStreamRecord,
  type EarnSummary,
  type EarnTimelineEntry,
  type EarnPayoutResult,
} from '@guap/types';

const ListStreamsQuery = 'domains/earn/queries:listForOrganization' as const;
const GetStreamQuery = 'domains/earn/queries:getById' as const;
const SummaryQuery = 'domains/earn/queries:summarizeForOrganization' as const;
const TimelineQuery = 'domains/earn/queries:timelineForOrganization' as const;

const CreateStreamMutation = 'domains/earn/mutations:createIncomeStream' as const;
const UpdateStreamMutation = 'domains/earn/mutations:updateIncomeStream' as const;
const RequestPayoutMutation = 'domains/earn/mutations:requestIncomePayout' as const;
const SkipPayoutMutation = 'domains/earn/mutations:skipIncomePayout' as const;

const ListStreamsInputSchema = z.object({
  organizationId: z.string(),
  status: IncomeStreamStatusSchema.optional(),
});

const GetStreamInputSchema = z.object({
  organizationId: z.string(),
  incomeStreamId: z.string(),
});

const TimelineInputSchema = z.object({
  organizationId: z.string(),
  limit: z.number().int().min(1).max(100).optional(),
});

export class EarnApi {
  constructor(private readonly client: ConvexClientInstance) {}

  async listStreams(input: z.input<typeof ListStreamsInputSchema>): Promise<IncomeStreamRecord[]> {
    const payload = ListStreamsInputSchema.parse(input);
    const result = await (this.client.query as any)(ListStreamsQuery, payload);
    return z.array(IncomeStreamRecordSchema).parse(result);
  }

  async getStream(
    input: z.input<typeof GetStreamInputSchema>
  ): Promise<IncomeStreamRecord | null> {
    const payload = GetStreamInputSchema.parse(input);
    const result = await (this.client.query as any)(GetStreamQuery, payload);
    if (!result) return null;
    return IncomeStreamRecordSchema.parse(result);
  }

  async summarize(organizationId: string): Promise<EarnSummary> {
    const result = await (this.client.query as any)(SummaryQuery, { organizationId });
    return EarnSummarySchema.parse(result);
  }

  async timeline(
    input: z.input<typeof TimelineInputSchema>
  ): Promise<EarnTimelineEntry[]> {
    const payload = TimelineInputSchema.parse(input);
    const result = await (this.client.query as any)(TimelineQuery, payload);
    return z.array(EarnTimelineEntrySchema).parse(result);
  }

  async createStream(input: CreateIncomeStreamInput): Promise<IncomeStreamRecord> {
    const payload = CreateIncomeStreamInputSchema.parse(input);
    const result = await (this.client.mutation as any)(CreateStreamMutation, payload);
    return IncomeStreamRecordSchema.parse(result);
  }

  async updateStream(input: UpdateIncomeStreamInput): Promise<IncomeStreamRecord> {
    const payload = UpdateIncomeStreamInputSchema.parse(input);
    const result = await (this.client.mutation as any)(UpdateStreamMutation, payload);
    return IncomeStreamRecordSchema.parse(result);
  }

  async requestPayout(input: RequestIncomePayoutInput): Promise<EarnPayoutResult> {
    const payload = RequestIncomePayoutInputSchema.parse(input);
    const result = await (this.client.mutation as any)(RequestPayoutMutation, payload);
    return EarnPayoutResultSchema.parse(result);
  }

  async skipPayout(input: SkipIncomePayoutInput): Promise<IncomeStreamRecord> {
    const payload = SkipIncomePayoutInputSchema.parse(input);
    const result = await (this.client.mutation as any)(SkipPayoutMutation, payload);
    return IncomeStreamRecordSchema.parse(result);
  }
}

export const createEarnApi = (client: ConvexClientInstance) => new EarnApi(client);
