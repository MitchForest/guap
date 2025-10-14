import { defineMutation } from '../../core/functions';

const DOMAIN = 'donate' as const;

export const bootstrap = defineMutation({
  handler: async () => ({
    domain: DOMAIN,
    implemented: false,
  }),
});
