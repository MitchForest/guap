import { defineQuery } from '../../core/functions';

const DOMAIN = 'transactions' as const;

export const status = defineQuery({
  handler: async () => ({
    domain: DOMAIN,
    implemented: false,
  }),
});
