import { z } from 'zod';
import type { ConvexClientInstance } from '../../core/client';

const InvestingStatusSchema = z.object({
  domain: z.literal('investing'),
  implemented: z.boolean(),
});

export type InvestingStatus = z.infer<typeof InvestingStatusSchema>;

const InvestingStatusQuery = 'domains/investing/queries:status' as const;
const InvestingBootstrapMutation = 'domains/investing/mutations:bootstrap' as const;

export class InvestingApi {
  constructor(private readonly client: ConvexClientInstance) {}

  async status(): Promise<InvestingStatus> {
    const result = await (this.client.query as any)(InvestingStatusQuery, {});
    return InvestingStatusSchema.parse(result);
  }

  async bootstrap(): Promise<InvestingStatus> {
    const result = await (this.client.mutation as any)(
      InvestingBootstrapMutation,
      {}
    );
    return InvestingStatusSchema.parse(result);
  }
}

export const createInvestingApi = (client: ConvexClientInstance) =>
  new InvestingApi(client);
