import { z } from 'zod';
import type { ConvexClientInstance } from '../../core/client';
import {
  CategoryRuleMatchTypeSchema,
  CategoryRuleRecordSchema,
  NeedsVsWantsSchema,
  TransactionDirectionSchema,
  TransactionRecordSchema,
  TransactionStatusSchema,
} from '@guap/types';

const ListTransactionsQuery = 'domains/transactions/queries:listForOrganization' as const;
const ListCategoryRulesQuery = 'domains/transactions/queries:listCategoryRules' as const;
const UpsertCategoryRuleMutation = 'domains/transactions/mutations:upsertCategoryRule' as const;
const DeleteCategoryRuleMutation = 'domains/transactions/mutations:deleteCategoryRule' as const;
const ReorderCategoryRulesMutation = 'domains/transactions/mutations:reorderCategoryRules' as const;

const ListTransactionsInputSchema = z.object({
  organizationId: z.string(),
  accountId: z.string().optional(),
  categoryKey: z.string().optional(),
  direction: TransactionDirectionSchema.optional(),
  status: TransactionStatusSchema.optional(),
  needsVsWants: NeedsVsWantsSchema.optional(),
  limit: z.number().optional(),
  search: z.string().optional(),
  sort: z.enum(['occurredAt', '-occurredAt', 'amount', '-amount']).optional(),
});

const UpsertCategoryRuleInputSchema = z.object({
  organizationId: z.string(),
  ruleId: z.string().optional(),
  matchType: CategoryRuleMatchTypeSchema,
  pattern: z.string(),
  categoryKey: z.string(),
  needsVsWants: NeedsVsWantsSchema.optional(),
  priority: z.number(),
});

const DeleteCategoryRuleInputSchema = z.object({
  organizationId: z.string(),
  ruleId: z.string(),
});

const ReorderCategoryRulesInputSchema = z.object({
  organizationId: z.string(),
  ruleIds: z.array(z.string()).nonempty(),
});

export class TransactionsApi {
  constructor(private readonly client: ConvexClientInstance) {}

  async list(input: z.input<typeof ListTransactionsInputSchema>) {
    const payload = ListTransactionsInputSchema.parse(input);
    const result = await (this.client.query as any)(ListTransactionsQuery, payload);
    return z.array(TransactionRecordSchema).parse(result);
  }

  async listCategoryRules(organizationId: string) {
    const result = await (this.client.query as any)(ListCategoryRulesQuery, {
      organizationId,
    });
    return z.array(CategoryRuleRecordSchema).parse(result);
  }

  async upsertCategoryRule(input: z.input<typeof UpsertCategoryRuleInputSchema>) {
    const payload = UpsertCategoryRuleInputSchema.parse(input);
    const result = await (this.client.mutation as any)(UpsertCategoryRuleMutation, payload);
    return z.string().parse(result);
  }

  async deleteCategoryRule(input: z.input<typeof DeleteCategoryRuleInputSchema>) {
    const payload = DeleteCategoryRuleInputSchema.parse(input);
    const result = await (this.client.mutation as any)(DeleteCategoryRuleMutation, payload);
    return z.string().parse(result);
  }

  async reorderCategoryRules(input: z.input<typeof ReorderCategoryRulesInputSchema>) {
    const payload = ReorderCategoryRulesInputSchema.parse(input);
    const result = await (this.client.mutation as any)(ReorderCategoryRulesMutation, payload);
    return z.object({ updated: z.number() }).parse(result);
  }
}

export const createTransactionsApi = (client: ConvexClientInstance) =>
  new TransactionsApi(client);
