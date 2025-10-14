import { z } from 'zod';
import type { ConvexClientInstance } from '../../core/client';

const EventsStatusSchema = z.object({
  domain: z.literal('events'),
  implemented: z.boolean(),
});

export type EventsStatus = z.infer<typeof EventsStatusSchema>;

const EventsStatusQuery = 'domains/events/queries:status' as const;
const EventsBootstrapMutation = 'domains/events/mutations:bootstrap' as const;

export class EventsApi {
  constructor(private readonly client: ConvexClientInstance) {}

  async status(): Promise<EventsStatus> {
    const result = await (this.client.query as any)(EventsStatusQuery, {});
    return EventsStatusSchema.parse(result);
  }

  async bootstrap(): Promise<EventsStatus> {
    const result = await (this.client.mutation as any)(EventsBootstrapMutation, {});
    return EventsStatusSchema.parse(result);
  }
}

export const createEventsApi = (client: ConvexClientInstance) =>
  new EventsApi(client);
