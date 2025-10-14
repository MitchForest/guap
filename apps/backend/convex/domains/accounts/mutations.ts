import { defineMutation } from '../../core/functions';

const DOMAIN = 'accounts' as const;

export const bootstrap = defineMutation({
  handler: async () => ({
    domain: DOMAIN,
    implemented: false,
  }),
});
