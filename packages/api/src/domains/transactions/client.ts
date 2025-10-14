import { z } from 'zod';
import type { ConvexClientInstance } from '../../core/client';

const TransactionsStatusSchema = z.object({
  domain: z.literal('transactions'),
  implemented: z.boolean(),
});

export type TransactionsStatus = z.infer<typeof TransactionsStatusSchema>;

const TransactionsStatusQuery = 'domains/transactions/queries:status' as const;
const TransactionsBootstrapMutation = 'domains/transactions/mutations:bootstrap' as const;

export class TransactionsApi {
  constructor(private readonly client: ConvexClientInstance) {}

  async status(): Promise<TransactionsStatus> {
    const result = await (this.client.query as any)(TransactionsStatusQuery, {});
    return TransactionsStatusSchema.parse(result);
  }

  async bootstrap(): Promise<TransactionsStatus> {
    const result = await (this.client.mutation as any)(
      TransactionsBootstrapMutation,
      {}
    );
    return TransactionsStatusSchema.parse(result);
  }
}

export const createTransactionsApi = (client: ConvexClientInstance) =>
  new TransactionsApi(client);
