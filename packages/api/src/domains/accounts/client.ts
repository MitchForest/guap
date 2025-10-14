import { z } from 'zod';
import type { ConvexClientInstance } from '../../core/client';
import {
  AccountSnapshotRecordSchema,
  FinancialAccountRecordSchema,
} from '@guap/types';

const ListAccountsQuery = 'domains/accounts/queries:listForOrganization' as const;
const GetAccountQuery = 'domains/accounts/queries:getById' as const;
const ListSnapshotsQuery = 'domains/accounts/queries:listSnapshots' as const;
const SyncAccountsMutation = 'domains/accounts/mutations:syncAccounts' as const;

const SyncAccountsInputSchema = z.object({
  organizationId: z.string(),
  provider: z.string().optional(),
  force: z.boolean().optional(),
});

const SyncAccountsResultSchema = z.object({
  provider: z.string(),
  createdAccountIds: z.array(z.string()),
  updatedAccountIds: z.array(z.string()),
  transactions: z.object({
    created: z.number(),
    updated: z.number(),
  }),
});

export class AccountsApi {
  constructor(private readonly client: ConvexClientInstance) {}

  async list(organizationId: string) {
    const result = await (this.client.query as any)(ListAccountsQuery, { organizationId });
    return z.array(FinancialAccountRecordSchema).parse(result);
  }

  async get(accountId: string) {
    const result = await (this.client.query as any)(GetAccountQuery, { accountId });
    if (!result) return null;
    return FinancialAccountRecordSchema.parse(result);
  }

  async listSnapshots(accountId: string, options?: { limit?: number }) {
    const result = await (this.client.query as any)(ListSnapshotsQuery, {
      accountId,
      limit: options?.limit,
    });
    return z.array(AccountSnapshotRecordSchema).parse(result);
  }

  async sync(input: z.input<typeof SyncAccountsInputSchema>) {
    const payload = SyncAccountsInputSchema.parse(input);
    const result = await (this.client.mutation as any)(SyncAccountsMutation, payload);
    return SyncAccountsResultSchema.parse(result);
  }
}

export const createAccountsApi = (client: ConvexClientInstance) => new AccountsApi(client);
