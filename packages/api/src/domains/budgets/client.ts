import { z } from 'zod';
import type { ConvexClientInstance } from '../../core/client';
import {
  BudgetSummarySchema,
  BudgetWithActualsSchema,
  BudgetGuardrailSummarySchema,
  CreateBudgetInputSchema,
  UpdateBudgetInputSchema,
  type BudgetSummary,
  type BudgetWithActuals,
  type CreateBudgetInput,
  type UpdateBudgetInput,
  type BudgetGuardrailSummary,
} from '@guap/types';

const ListBudgetsQuery = 'domains/budgets/queries:listForOrganization' as const;
const SummarizeBudgetsQuery = 'domains/budgets/queries:summarizeForOrganization' as const;
const CreateBudgetMutation = 'domains/budgets/mutations:createBudget' as const;
const UpdateBudgetMutation = 'domains/budgets/mutations:updateBudget' as const;
const ArchiveBudgetMutation = 'domains/budgets/mutations:archiveBudget' as const;
const UpdateGuardrailMutation = 'domains/budgets/mutations:updateGuardrail' as const;

const ListBudgetsInputSchema = z.object({
  organizationId: z.string(),
  periodKey: z.string().optional(),
  includeArchived: z.boolean().optional(),
});

const SummarizeBudgetsInputSchema = z.object({
  organizationId: z.string(),
  periodKey: z.string().optional(),
});

const ArchiveBudgetInputSchema = z.object({
  organizationId: z.string(),
  budgetId: z.string(),
});

const UpdateGuardrailInputSchema = z.object({
  organizationId: z.string(),
  budgetId: z.string(),
  autoApproveUpToCents: z.number().nullable().optional(),
});

export class BudgetsApi {
  constructor(private readonly client: ConvexClientInstance) {}

  async list(input: z.input<typeof ListBudgetsInputSchema>): Promise<BudgetWithActuals[]> {
    const payload = ListBudgetsInputSchema.parse(input);
    const result = await (this.client.query as any)(ListBudgetsQuery, payload);
    return z.array(BudgetWithActualsSchema).parse(result);
  }

  async summarize(input: z.input<typeof SummarizeBudgetsInputSchema>): Promise<BudgetSummary | null> {
    const payload = SummarizeBudgetsInputSchema.parse(input);
    const result = await (this.client.query as any)(SummarizeBudgetsQuery, payload);
    if (result == null) return null;
    return BudgetSummarySchema.parse(result);
  }

  async create(input: CreateBudgetInput): Promise<BudgetWithActuals> {
    const payload = CreateBudgetInputSchema.parse(input);
    const result = await (this.client.mutation as any)(CreateBudgetMutation, payload);
    return BudgetWithActualsSchema.parse(result);
  }

  async update(input: UpdateBudgetInput): Promise<BudgetWithActuals> {
    const payload = UpdateBudgetInputSchema.parse(input);
    const result = await (this.client.mutation as any)(UpdateBudgetMutation, payload);
    return BudgetWithActualsSchema.parse(result);
  }

  async archive(input: z.input<typeof ArchiveBudgetInputSchema>) {
    const payload = ArchiveBudgetInputSchema.parse(input);
    return await (this.client.mutation as any)(ArchiveBudgetMutation, payload);
  }

  async updateGuardrail(
    input: z.input<typeof UpdateGuardrailInputSchema>
  ): Promise<BudgetGuardrailSummary | null> {
    const payload = UpdateGuardrailInputSchema.parse(input);
    const result = await (this.client.mutation as any)(UpdateGuardrailMutation, payload);
    if (result == null) return null;
    return BudgetGuardrailSummarySchema.parse(result);
  }
}

export const createBudgetsApi = (client: ConvexClientInstance) => new BudgetsApi(client);
