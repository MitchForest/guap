import { z } from 'zod';
import type { ConvexClientInstance } from '../../core/client';
import { GuardrailOverviewSchema } from '@guap/types';

const ListGuardrailsQuery = 'domains/guardrails/queries:listForOrganization' as const;

const ListGuardrailsInputSchema = z.object({
  organizationId: z.string(),
});

export class GuardrailsApi {
  constructor(private readonly client: ConvexClientInstance) {}

  async list(input: z.input<typeof ListGuardrailsInputSchema>) {
    const payload = ListGuardrailsInputSchema.parse(input);
    const result = await (this.client.query as any)(ListGuardrailsQuery, payload);
    return z.array(GuardrailOverviewSchema).parse(result);
  }
}

export const createGuardrailsApi = (client: ConvexClientInstance) => new GuardrailsApi(client);

