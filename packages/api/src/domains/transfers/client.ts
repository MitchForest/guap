import { z } from 'zod';
import type { ConvexClientInstance } from '../../core/client';
import { TransferRecordSchema, TransferStatusSchema } from '@guap/types';

const ListTransfersQuery = 'domains/transfers/queries:listForOrganization' as const;
const UpdateTransferStatusMutation = 'domains/transfers/mutations:updateStatus' as const;

const ListTransfersInputSchema = z.object({
  organizationId: z.string(),
  status: TransferStatusSchema.optional(),
  limit: z.number().optional(),
});

const UpdateTransferStatusInputSchema = z.object({
  transferId: z.string(),
  status: TransferStatusSchema,
});

export class TransfersApi {
  constructor(private readonly client: ConvexClientInstance) {}

  async list(input: z.input<typeof ListTransfersInputSchema>) {
    const payload = ListTransfersInputSchema.parse(input);
    const result = await (this.client.query as any)(ListTransfersQuery, payload);
    return z.array(TransferRecordSchema).parse(result);
  }

  async updateStatus(input: z.input<typeof UpdateTransferStatusInputSchema>) {
    const payload = UpdateTransferStatusInputSchema.parse(input);
    const result = await (this.client.mutation as any)(UpdateTransferStatusMutation, payload);
    return TransferRecordSchema.parse(result);
  }
}

export const createTransfersApi = (client: ConvexClientInstance) => new TransfersApi(client);
