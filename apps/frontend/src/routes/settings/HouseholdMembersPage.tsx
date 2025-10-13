import { Component, For, Show, createMemo, createResource, createSignal } from 'solid-js';
import { z } from 'zod';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { useAppData } from '~/contexts/AppDataContext';
import { useAuth } from '~/contexts/AuthContext';
import { toast } from 'solid-sonner';
import { authClient } from '~/lib/authClient';
import type { MembershipRecord, ProfileRecord } from '@guap/api';
import { MembershipRecordSchema, ProfileRecordSchema, UserRoleSchema } from '@guap/types';

const HouseholdMembersPage: Component = () => {
  const { activeHousehold } = useAppData();
  const { user } = useAuth();

  const householdId = createMemo(() => activeHousehold()?._id ?? null);
  const [members] = createResource(householdId, async (id) => {
    const organizationId = user()?.organizationId ?? null;
    if (!id || !organizationId) return [];
    try {
      const result = await authClient.organization.listMembers({
        query: { organizationId },
      });
      if (result.error) {
        throw new Error(result.error.message ?? 'Unable to load organization members');
      }
      const dataset = Array.isArray(result.data) ? result.data : [];
      return dataset
        .map((entry: Record<string, unknown>) => {
          const rawRole =
            typeof entry.role === 'string' ? (entry.role as string) : 'member';
          const parsedRole = UserRoleSchema.safeParse(rawRole);
          const normalizedRole = parsedRole.success ? parsedRole.data : 'member';

          const userInfo = ProfileRecordSchema.pick({
            _id: true,
            displayName: true,
            email: true,
            role: true,
          })
            .extend({
              authId: ProfileRecordSchema.shape.authId,
            })
            .passthrough()
            .safeParse({
              _id: String(entry.profileId ?? entry.userId ?? ''),
              displayName: String(entry.name ?? entry.displayName ?? ''),
              email: entry.email ? String(entry.email) : undefined,
              role: normalizedRole,
              authId: String(entry.userId ?? ''),
            });

          const membershipInfo = MembershipRecordSchema.pick({
            role: true,
            status: true,
          })
            .extend({
              membershipId: z.string().optional(),
            })
            .safeParse({
              role: normalizedRole,
              status: 'active',
              membershipId: entry.memberId ? String(entry.memberId) : undefined,
            });

          if (!userInfo.success || !membershipInfo.success) {
            return null;
          }

          return {
            user: userInfo.data as Pick<ProfileRecord, '_id' | 'displayName' | 'email' | 'role'> & {
              authId: string;
            },
            membership: membershipInfo.data as Pick<MembershipRecord, 'role' | 'status'> & {
              membershipId?: string;
            },
          };
        })
        .filter(Boolean) as Array<{
        user: Pick<ProfileRecord, '_id' | 'displayName' | 'email' | 'role'> & { authId: string };
        membership: Pick<MembershipRecord, 'role' | 'status'> & { membershipId?: string };
      }>;
    } catch (error) {
      console.error('Failed to load household members', error);
      return [];
    }
  });
  const linkedOrganizationId = createMemo(() => user()?.organizationId ?? null);
  const inviteQuery = createMemo(() => {
    const organizationId = linkedOrganizationId();
    const household = householdId();
    if (!organizationId || !household) return null;
    return { organizationId, householdId: household };
  });

  const [invites, { refetch: refetchInvites }] = createResource(inviteQuery, async (query) => {
    if (!query) return [];
    const result = await authClient.organization.listInvitations({
      query: { organizationId: query.organizationId },
    });
    if (result.error) {
      throw new Error(result.error.message ?? 'Unable to load organization invites');
    }
    const dataset = Array.isArray(result.data) ? result.data : [];
    return dataset
      .map((invite: Record<string, unknown>) => ({
        id: String(invite.id ?? invite.invitationId ?? ''),
        email: String(invite.email ?? ''),
        role: String(invite.role ?? 'member'),
        code: (invite.code as string | undefined | null) ?? null,
        metadata: (invite.metadata as Record<string, unknown> | null) ?? null,
      }))
      .filter((invite) => invite.metadata?.householdId === query.householdId);
  });

  const [inviteEmail, setInviteEmail] = createSignal('');
  const [inviteRole, setInviteRole] = createSignal<'member' | 'admin'>('member');
  const [submitting, setSubmitting] = createSignal(false);

  const canManage = createMemo(() => {
    const currentRole = user()?.role;
    if (!currentRole) return false;
    if (currentRole === 'member') return false;
    return Boolean(linkedOrganizationId());
  });

  const handleInvite = async (event: Event) => {
    event.preventDefault();
    if (!canManage()) return;
    const id = householdId();
    const organizationId = linkedOrganizationId();
    if (!id) return;
    if (!organizationId) {
      toast.error('Link this household to an organization before inviting members.');
      return;
    }
    const email = inviteEmail().trim();
    if (!email) {
      toast.error('Email is required');
      return;
    }

    setSubmitting(true);
    try {
      const result = await authClient.organization.inviteMember({
        organizationId,
        email,
        role: inviteRole(),
        metadata: { householdId: id },
      } as Parameters<typeof authClient.organization.inviteMember>[0]);
      if (result.error) {
        throw new Error(result.error.message ?? 'Unable to send invite');
      }
      toast.success('Invite sent!');
      setInviteEmail('');
      await refetchInvites();
    } catch (error) {
      console.error('Create household invite failed', error);
      toast.error(error instanceof Error ? error.message : 'Unable to send invite');
    } finally {
      setSubmitting(false);
    }
  };

  const revokeInvite = async (inviteId: string) => {
    if (!canManage()) return;
    try {
      const result = await authClient.organization.cancelInvitation({ invitationId: inviteId });
      if (result.error) {
        throw new Error(result.error.message ?? 'Unable to revoke invite');
      }
      toast.success('Invite canceled');
      await refetchInvites();
    } catch (error) {
      console.error('Revoke invite failed', error);
      toast.error('Unable to revoke invite');
    }
  };

  return (
    <div class="space-y-8">
      <header class="space-y-2">
        <h1 class="text-2xl font-bold text-slate-900">Household members</h1>
        <p class="text-sm text-slate-600">
          Manage the admins and members who can collaborate on this money map.
        </p>
      </header>

      <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Members</h2>
        <div class="mt-4 space-y-3">
          <For each={members()?.filter(Boolean) ?? []}>
            {(entry) => (
              <div class="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                <div>
                  <p class="text-sm font-semibold text-slate-900">{entry.user.displayName}</p>
                  <p class="text-xs text-slate-500">{entry.user.email ?? 'No email on file'}</p>
                </div>
                <div class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {entry.membership.role}
                </div>
              </div>
            )}
          </For>
          <Show when={!members.loading && (members()?.length ?? 0) === 0}>
            <p class="text-sm text-slate-500">No members yet. Send an invite to get started.</p>
          </Show>
        </div>
      </section>

      <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Invite admins or members</h2>
        <Show
          when={canManage()}
          fallback={
            <p class="mt-3 text-sm text-slate-500">
              Link this household to an organization (and sign in as an owner or admin) to send invitations.
            </p>
          }
        >
          <form class="mt-4 space-y-3" onSubmit={handleInvite}>
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-700">Email</label>
              <Input
                type="email"
                required
                value={inviteEmail()}
                onInput={(event) => setInviteEmail(event.currentTarget.value)}
                class="h-12 rounded-2xl border border-slate-300 text-base placeholder:text-slate-400 focus:border-slate-900"
                  placeholder="member@family.com"
              />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-700">Role</label>
              <select
                class="h-12 w-full rounded-2xl border border-slate-300 px-4 text-base text-slate-900 focus:border-slate-900"
                value={inviteRole()}
                onChange={(event) => setInviteRole(event.currentTarget.value as 'member' | 'admin')}
              >
                <option value="member">Household member</option>
                <option value="admin">Household admin</option>
              </select>
            </div>
            <Button
              type="submit"
              class="h-12 w-full rounded-2xl bg-slate-900 text-base font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={submitting()}
            >
              {submitting() ? 'Sending…' : 'Send invite'}
            </Button>
          </form>
        </Show>
      </section>

      <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Pending invites</h2>
        <div class="mt-4 space-y-3">
          <For each={invites() ?? []}>
            {(invite) => (
              <div class="flex flex-col gap-3 rounded-2xl border border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p class="text-sm font-semibold text-slate-900">{invite.email}</p>
                  <p class="text-xs text-slate-500 uppercase tracking-[0.18em]">{invite.role}</p>
                  <Show when={invite.code}>
                    <p class="text-xs text-slate-500">
                      Code: <span class="font-mono">{invite.code}</span>
                    </p>
                  </Show>
                </div>
                <div class="flex items-center gap-2">
                  <Show when={invite.code}>
                    <Button
                      type="button"
                      variant="ghost"
                      class="text-xs font-semibold"
                      onClick={() => {
                        void navigator.clipboard?.writeText(invite.code ?? '');
                        toast.success('Invite code copied');
                      }}
                    >
                      Copy code
                    </Button>
                  </Show>
                  <Button
                    type="button"
                    variant="ghost"
                    class="text-xs font-semibold text-rose-600"
                    onClick={() => revokeInvite(invite.id)}
                  >
                    Revoke
                  </Button>
                </div>
              </div>
            )}
          </For>
          <Show when={!invites.loading && (invites()?.length ?? 0) === 0}>
            <p class="text-sm text-slate-500">No pending invites.</p>
          </Show>
        </div>
      </section>
    </div>
  );
};

export default HouseholdMembersPage;
