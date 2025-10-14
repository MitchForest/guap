import { z } from 'zod';
import type { ConvexClientInstance } from '../../core/client';

const BudgetsStatusSchema = z.object({
  domain: z.literal('budgets'),
  implemented: z.boolean(),
});

export type BudgetsStatus = z.infer<typeof BudgetsStatusSchema>;

const BudgetsStatusQuery = 'domains/budgets/queries:status' as const;
const BudgetsBootstrapMutation = 'domains/budgets/mutations:bootstrap' as const;

export class BudgetsApi {
  constructor(private readonly client: ConvexClientInstance) {}

  async status(): Promise<BudgetsStatus> {
    const result = await (this.client.query as any)(BudgetsStatusQuery, {});
    return BudgetsStatusSchema.parse(result);
  }

  async bootstrap(): Promise<BudgetsStatus> {
    const result = await (this.client.mutation as any)(BudgetsBootstrapMutation, {});
    return BudgetsStatusSchema.parse(result);
  }
}

export const createBudgetsApi = (client: ConvexClientInstance) =>
  new BudgetsApi(client);
