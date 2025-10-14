import { defineMutation } from '../../core/functions';

const DOMAIN = 'transactions' as const;

export const bootstrap = defineMutation({
  handler: async () => ({
    domain: DOMAIN,
    implemented: false,
  }),
});
