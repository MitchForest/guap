import { z } from 'zod';
import type { ConvexClientInstance } from '../../core/client';
import {
  CreateSavingsGoalInputSchema,
  InitiateSavingsTransferInputSchema,
  SavingsGoalProgressSchema,
  SavingsGoalWithProgressSchema,
  SavingsGuardrailSummarySchema,
  TransferRecordSchema,
  TransferStatusSchema,
  UpdateSavingsGoalInputSchema,
  type CreateSavingsGoalInput,
  type InitiateSavingsTransferInput,
  type SavingsGoalProgress,
  type SavingsGoalWithProgress,
  type UpdateSavingsGoalInput,
} from '@guap/types';

const ListGoalsQuery = 'domains/savings/queries:listForOrganization' as const;
const GetGoalQuery = 'domains/savings/queries:getById' as const;
const ListTransfersForGoalQuery = 'domains/savings/queries:listTransfersForGoal' as const;

const CreateGoalMutation = 'domains/savings/mutations:createGoal' as const;
const UpdateGoalMutation = 'domains/savings/mutations:updateGoal' as const;
const ArchiveGoalMutation = 'domains/savings/mutations:archiveGoal' as const;
const InitiateTransferMutation = 'domains/savings/mutations:initiateTransfer' as const;

const ListTransfersInputSchema = z.object({
  organizationId: z.string(),
  goalId: z.string(),
  status: TransferStatusSchema.optional(),
});

const ArchiveGoalInputSchema = z.object({
  organizationId: z.string(),
  goalId: z.string(),
});

const GuardrailSummarySchema = SavingsGuardrailSummarySchema.nullable();

const TransferDirectionSchema = z.enum(['deposit', 'withdrawal']);

const InitiateTransferResultSchema = z.object({
  transfer: TransferRecordSchema,
  guardrail: GuardrailSummarySchema,
  direction: TransferDirectionSchema,
  progress: SavingsGoalProgressSchema,
});

export type SavingsTransferResult = z.infer<typeof InitiateTransferResultSchema>;

export class SavingsApi {
  constructor(private readonly client: ConvexClientInstance) {}

  async listGoals(organizationId: string): Promise<SavingsGoalWithProgress[]> {
    const response = await (this.client.query as any)(ListGoalsQuery, { organizationId });
    return z.array(SavingsGoalWithProgressSchema).parse(response);
  }

  async getGoal(goalId: string): Promise<SavingsGoalWithProgress | null> {
    const response = await (this.client.query as any)(GetGoalQuery, { goalId });
    if (!response) return null;
    return SavingsGoalWithProgressSchema.parse(response);
  }

  async listTransfers(input: z.input<typeof ListTransfersInputSchema>) {
    const payload = ListTransfersInputSchema.parse(input);
    const response = await (this.client.query as any)(ListTransfersForGoalQuery, payload);
    return z.array(TransferRecordSchema).parse(response);
  }

  async createGoal(input: CreateSavingsGoalInput) {
    const payload = CreateSavingsGoalInputSchema.parse(input);
    const response = await (this.client.mutation as any)(CreateGoalMutation, payload);
    return SavingsGoalWithProgressSchema.parse(response);
  }

  async updateGoal(input: UpdateSavingsGoalInput) {
    const payload = UpdateSavingsGoalInputSchema.parse(input);
    const response = await (this.client.mutation as any)(UpdateGoalMutation, payload);
    return SavingsGoalWithProgressSchema.parse(response);
  }

  async archiveGoal(input: z.input<typeof ArchiveGoalInputSchema>) {
    const payload = ArchiveGoalInputSchema.parse(input);
    const response = await (this.client.mutation as any)(ArchiveGoalMutation, payload);
    return SavingsGoalWithProgressSchema.parse(response);
  }

  async initiateTransfer(input: InitiateSavingsTransferInput): Promise<SavingsTransferResult> {
    const payload = InitiateSavingsTransferInputSchema.parse(input);
    const response = await (this.client.mutation as any)(InitiateTransferMutation, payload);
    return InitiateTransferResultSchema.parse(response);
  }
}

export const createSavingsApi = (client: ConvexClientInstance) => new SavingsApi(client);
