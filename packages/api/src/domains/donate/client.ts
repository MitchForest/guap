import { z } from 'zod';
import type { ConvexClientInstance } from '../../core/client';
import {
  DonationCauseSchema,
  DonationHistoryEntrySchema,
  DonationOverviewSchema,
  ScheduleDonationInputSchema,
  ScheduleDonationResultSchema,
  DonationGuardrailSummarySchema,
  UpdateDonationGuardrailInputSchema,
  type ScheduleDonationInput,
  type UpdateDonationGuardrailInput,
} from '@guap/types';

const ListCausesInputSchema = z.object({
  organizationId: z.string(),
});

const OverviewInputSchema = z.object({
  organizationId: z.string(),
  historyLimit: z.number().int().min(1).max(100).optional(),
});

const HistoryInputSchema = z.object({
  organizationId: z.string(),
  limit: z.number().int().min(1).max(100).optional(),
});

const ListCausesQuery = 'domains/donate/queries:listCauses' as const;
const OverviewQuery = 'domains/donate/queries:overview' as const;
const ListHistoryQuery = 'domains/donate/queries:listHistory' as const;
const ScheduleDonationMutation = 'domains/donate/mutations:scheduleDonation' as const;
const UpdateGuardrailMutation = 'domains/donate/mutations:updateGuardrail' as const;

export class DonateApi {
  constructor(private readonly client: ConvexClientInstance) {}

  async listCauses(organizationId: string) {
    const payload = ListCausesInputSchema.parse({ organizationId });
    const result = await (this.client.query as any)(ListCausesQuery, payload);
    return z.array(DonationCauseSchema).parse(result);
  }

  async overview(input: z.input<typeof OverviewInputSchema>) {
    const payload = OverviewInputSchema.parse(input);
    const result = await (this.client.query as any)(OverviewQuery, payload);
    return DonationOverviewSchema.parse(result);
  }

  async listHistory(input: z.input<typeof HistoryInputSchema>) {
    const payload = HistoryInputSchema.parse(input);
    const result = await (this.client.query as any)(ListHistoryQuery, payload);
    return z.array(DonationHistoryEntrySchema).parse(result);
  }

  async scheduleDonation(input: ScheduleDonationInput) {
    const payload = ScheduleDonationInputSchema.parse(input);
    const result = await (this.client.mutation as any)(ScheduleDonationMutation, payload);
    return ScheduleDonationResultSchema.parse(result);
  }

  async updateGuardrail(input: UpdateDonationGuardrailInput) {
    const payload = UpdateDonationGuardrailInputSchema.parse(input);
    const result = await (this.client.mutation as any)(UpdateGuardrailMutation, payload);
    return DonationGuardrailSummarySchema.parse(result);
  }
}

export const createDonateApi = (client: ConvexClientInstance) => new DonateApi(client);
