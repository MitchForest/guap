import { defineQuery } from '../../core/functions';

const DOMAIN = 'budgets' as const;

export const status = defineQuery({
  handler: async () => ({
    domain: DOMAIN,
    implemented: false,
  }),
});
