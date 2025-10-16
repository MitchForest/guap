import { z } from 'zod';
import type { ConvexClientInstance } from '../../core/client';
import { EventJournalWithReceiptSchema } from '@guap/types';

const ListEventsQuery = 'domains/events/queries:listForOrganization' as const;
const MarkEventReadMutation = 'domains/events/mutations:markEventRead' as const;

const ListEventsInputSchema = z.object({
  organizationId: z.string(),
  limit: z.number().optional(),
});

const MarkEventReadInputSchema = z.object({
  eventId: z.string(),
});

const MarkEventReadResultSchema = z.object({
  eventId: z.string(),
  readAt: z.number(),
  receiptId: z.string().optional(),
});

export class EventsApi {
  constructor(private readonly client: ConvexClientInstance) {}

  async list(input: z.input<typeof ListEventsInputSchema>) {
    const payload = ListEventsInputSchema.parse(input);
    const result = await (this.client.query as any)(ListEventsQuery, payload);
    return z.array(EventJournalWithReceiptSchema).parse(result);
  }

  async markRead(input: z.input<typeof MarkEventReadInputSchema>) {
    const payload = MarkEventReadInputSchema.parse(input);
    const result = await (this.client.mutation as any)(MarkEventReadMutation, payload);
    return MarkEventReadResultSchema.parse(result);
  }
}

export const createEventsApi = (client: ConvexClientInstance) => new EventsApi(client);
