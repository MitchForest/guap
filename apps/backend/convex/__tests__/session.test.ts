import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../core/auth', () => ({
  authComponent: {
    getAuthUser: vi.fn(),
  },
}));

import { authComponent } from '../core/auth';
import {
  ensureOrganizationAccess,
  ensureRole,
  requireSession,
  type SessionSnapshot,
} from '../core/session';

const getAuthUser = vi.mocked(authComponent.getAuthUser);

describe('session helpers', () => {
  beforeEach(() => {
    getAuthUser.mockReset();
  });

  it('extracts session from Better Auth payload', async () => {
    getAuthUser.mockResolvedValue({
      session: { user: { activeOrganizationId: 'org-1', role: 'owner', id: 'user-1' } },
    } as any);

    const session = await requireSession({});
    expect(session).toEqual<SessionSnapshot>({
      activeOrganizationId: 'org-1',
      role: 'owner',
      userId: 'user-1',
    });
  });

  it('throws when auth is missing', async () => {
    getAuthUser.mockResolvedValue(null as any);
    await expect(requireSession({})).rejects.toThrow('Authentication required');
  });

  it('blocks cross-organization access', async () => {
    getAuthUser.mockResolvedValue({ session: { user: { activeOrganizationId: 'org-1' } } } as any);
    await expect(ensureOrganizationAccess({}, 'org-2')).rejects.toThrow('Access denied for organization');
  });

  it('allows when session organization matches', async () => {
    getAuthUser.mockResolvedValue({ session: { user: { activeOrganizationId: 'org-1', role: 'member' } } } as any);
    const session = await ensureOrganizationAccess({}, 'org-1');
    expect(session.role).toBe('member');
  });

  it('enforces role membership', () => {
    const session: SessionSnapshot = {
      activeOrganizationId: 'org-1',
      role: 'member',
      userId: 'user-1',
    };
    expect(() => ensureRole(session, ['owner', 'admin'])).toThrow('Insufficient permissions');
    expect(() => ensureRole(session, ['member'])).not.toThrow();
  });
});
