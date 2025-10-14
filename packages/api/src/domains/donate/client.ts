import { z } from 'zod';
import type { ConvexClientInstance } from '../../core/client';

const DonateStatusSchema = z.object({
  domain: z.literal('donate'),
  implemented: z.boolean(),
});

export type DonateStatus = z.infer<typeof DonateStatusSchema>;

const DonateStatusQuery = 'domains/donate/queries:status' as const;
const DonateBootstrapMutation = 'domains/donate/mutations:bootstrap' as const;

export class DonateApi {
  constructor(private readonly client: ConvexClientInstance) {}

  async status(): Promise<DonateStatus> {
    const result = await (this.client.query as any)(DonateStatusQuery, {});
    return DonateStatusSchema.parse(result);
  }

  async bootstrap(): Promise<DonateStatus> {
    const result = await (this.client.mutation as any)(DonateBootstrapMutation, {});
    return DonateStatusSchema.parse(result);
  }
}

export const createDonateApi = (client: ConvexClientInstance) =>
  new DonateApi(client);
