import { z } from 'zod';
import type { ConvexClientInstance } from '../../core/client';

const SavingsStatusSchema = z.object({
  domain: z.literal('savings'),
  implemented: z.boolean(),
});

export type SavingsStatus = z.infer<typeof SavingsStatusSchema>;

const SavingsStatusQuery = 'domains/savings/queries:status' as const;
const SavingsBootstrapMutation = 'domains/savings/mutations:bootstrap' as const;

export class SavingsApi {
  constructor(private readonly client: ConvexClientInstance) {}

  async status(): Promise<SavingsStatus> {
    const result = await (this.client.query as any)(SavingsStatusQuery, {});
    return SavingsStatusSchema.parse(result);
  }

  async bootstrap(): Promise<SavingsStatus> {
    const result = await (this.client.mutation as any)(SavingsBootstrapMutation, {});
    return SavingsStatusSchema.parse(result);
  }
}

export const createSavingsApi = (client: ConvexClientInstance) =>
  new SavingsApi(client);
