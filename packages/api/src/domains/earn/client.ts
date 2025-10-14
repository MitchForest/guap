import { z } from 'zod';
import type { ConvexClientInstance } from '../../core/client';

const EarnStatusSchema = z.object({
  domain: z.literal('earn'),
  implemented: z.boolean(),
});

export type EarnStatus = z.infer<typeof EarnStatusSchema>;

const EarnStatusQuery = 'domains/earn/queries:status' as const;
const EarnBootstrapMutation = 'domains/earn/mutations:bootstrap' as const;

export class EarnApi {
  constructor(private readonly client: ConvexClientInstance) {}

  async status(): Promise<EarnStatus> {
    const result = await (this.client.query as any)(EarnStatusQuery, {});
    return EarnStatusSchema.parse(result);
  }

  async bootstrap(): Promise<EarnStatus> {
    const result = await (this.client.mutation as any)(EarnBootstrapMutation, {});
    return EarnStatusSchema.parse(result);
  }
}

export const createEarnApi = (client: ConvexClientInstance) =>
  new EarnApi(client);
