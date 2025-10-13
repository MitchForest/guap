import { getStaticAuth } from '@convex-dev/better-auth';
import { createAuth } from '..';

export const auth = getStaticAuth(createAuth);
