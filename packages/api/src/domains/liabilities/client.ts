import { z } from 'zod';
import type { ConvexClientInstance } from '../../core/client';
import {
  LiabilityTermsRecordSchema,
  UpsertLiabilityTermsInputSchema,
  type LiabilityTermsRecord,
  type UpsertLiabilityTermsInput,
} from '@guap/types';

const ListLiabilitiesQuery = 'domains/liabilities/queries:listForOrganization' as const;
const GetLiabilityQuery = 'domains/liabilities/queries:getByAccount' as const;
const UpsertLiabilityMutation = 'domains/liabilities/mutations:upsertTerms' as const;

const ListLiabilitiesInputSchema = z.object({
  organizationId: z.string(),
});

const GetLiabilityInputSchema = z.object({
  accountId: z.string(),
});

export class LiabilitiesApi {
  constructor(private readonly client: ConvexClientInstance) {}

  async list(input: z.input<typeof ListLiabilitiesInputSchema>): Promise<LiabilityTermsRecord[]> {
    const payload = ListLiabilitiesInputSchema.parse(input);
    const result = await (this.client.query as any)(ListLiabilitiesQuery, payload);
    return z.array(LiabilityTermsRecordSchema).parse(result);
  }

  async getByAccount(input: z.input<typeof GetLiabilityInputSchema>): Promise<LiabilityTermsRecord | null> {
    const payload = GetLiabilityInputSchema.parse(input);
    const result = await (this.client.query as any)(GetLiabilityQuery, payload);
    if (!result) return null;
    return LiabilityTermsRecordSchema.parse(result);
  }

  async upsert(input: UpsertLiabilityTermsInput): Promise<string> {
    const payload = UpsertLiabilityTermsInputSchema.parse(input);
    const result = await (this.client.mutation as any)(UpsertLiabilityMutation, payload);
    return z.string().parse(result);
  }
}

export const createLiabilitiesApi = (client: ConvexClientInstance) => new LiabilitiesApi(client);
