import { createAuth, authComponent } from '../../core/auth';

export const slugFromName = (name: string) => {
  const base =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '') || 'organization';
  const suffix = Math.random().toString(36).slice(2, 10);
  return `${base}-${suffix}`;
};

export const getAuthContext = async (ctx: unknown) => {
  const auth = createAuth(ctx as any);
  const headers = await authComponent.getHeaders(ctx as any);
  return { auth, headers };
};
