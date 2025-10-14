import { defineMutation } from '../../core/functions';

const DOMAIN = 'budgets' as const;

export const bootstrap = defineMutation({
  handler: async () => ({
    domain: DOMAIN,
    implemented: false,
  }),
});
