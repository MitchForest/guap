import { z } from 'zod';
import type { ConvexClientInstance } from '../../core/client';

const AccountsStatusSchema = z.object({
  domain: z.literal('accounts'),
  implemented: z.boolean(),
});

export type AccountsStatus = z.infer<typeof AccountsStatusSchema>;

const AccountsStatusQuery = 'domains/accounts/queries:status' as const;
const AccountsBootstrapMutation = 'domains/accounts/mutations:bootstrap' as const;

export class AccountsApi {
  constructor(private readonly client: ConvexClientInstance) {}

  async status(): Promise<AccountsStatus> {
    const result = await (this.client.query as any)(AccountsStatusQuery, {});
    return AccountsStatusSchema.parse(result);
  }

  async bootstrap(): Promise<AccountsStatus> {
    const result = await (this.client.mutation as any)(AccountsBootstrapMutation, {});
    return AccountsStatusSchema.parse(result);
  }
}

export const createAccountsApi = (client: ConvexClientInstance) =>
  new AccountsApi(client);
