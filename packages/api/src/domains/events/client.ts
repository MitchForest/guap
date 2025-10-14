import { z } from 'zod';
import type { ConvexClientInstance } from '../../core/client';
import { EventJournalRecordSchema } from '@guap/types';

const ListEventsQuery = 'domains/events/queries:listForOrganization' as const;

const ListEventsInputSchema = z.object({
  organizationId: z.string(),
  limit: z.number().optional(),
});

export class EventsApi {
  constructor(private readonly client: ConvexClientInstance) {}

  async list(input: z.input<typeof ListEventsInputSchema>) {
    const payload = ListEventsInputSchema.parse(input);
    const result = await (this.client.query as any)(ListEventsQuery, payload);
    return z.array(EventJournalRecordSchema).parse(result);
  }
}

export const createEventsApi = (client: ConvexClientInstance) => new EventsApi(client);
