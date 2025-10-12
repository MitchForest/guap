import type { MembershipRole } from '@guap/types';
import { Component, For, Show, createMemo, createResource, createSignal } from 'solid-js';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { useAuth } from '~/contexts/AuthContext';
import { toast } from 'solid-sonner';
import { authClient } from '~/lib/authClient';

const OrganizationRosterPage: Component = () => {
  const { user } = useAuth();
  const organizationId = createMemo(() => user()?.organizationId ?? null);
  const canManage = createMemo(() => user()?.role === 'admin' || user()?.role === 'internal');

  const [members] = createResource(organizationId, async (id) => {
    if (!id) return [];
    const result = await authClient.organization.listMembers({ query: { organizationId: id } });
    if (result.error) {
      throw new Error(result.error.message ?? 'Unable to load organization members');
    }
    return result.data?.members ?? [];
  });

  const [invites, { refetch: refetchInvites }] = createResource(organizationId, async (id) => {
    if (!id) return [] as Array<{ id: string; email: string; role: string; code?: string | null }>;
    const result = await authClient.organization.listInvitations({ query: { organizationId: id } });
    if (result.error) {
      throw new Error(result.error.message ?? 'Unable to load organization invites');
    }
    const rawInvites = (result.data ?? []) as Array<Record<string, any>>;
    return rawInvites.map((invite) => ({
      id: invite.id as string,
      email: invite.email as string,
      role: invite.role as string,
      code: (invite.code as string | undefined | null) ?? null,
    }));
  });

  const [inviteEmail, setInviteEmail] = createSignal('');
  const [inviteRole, setInviteRole] = createSignal<Extract<MembershipRole, 'student' | 'guardian'>>('student');
  const [submitting, setSubmitting] = createSignal(false);

  const handleInvite = async (event: Event) => {
    event.preventDefault();
    if (!canManage()) return;
    const orgId = organizationId();
    if (!orgId) return;
    const email = inviteEmail().trim();
    if (!email) {
      toast.error('Email is required');
      return;
    }
    setSubmitting(true);
    try {
      const result = await authClient.organization.inviteMember({
        organizationId: orgId,
        email,
        role: inviteRole(),
      });
      if (result.error) {
        throw new Error(result.error.message ?? 'Unable to send invite');
      }
      toast.success('Invite sent');
      setInviteEmail('');
      await refetchInvites();
    } catch (error) {
      console.error('Create organization invite failed', error);
      toast.error(error instanceof Error ? error.message : 'Unable to send invite');
    } finally {
      setSubmitting(false);
    }
  };

  const revokeInvite = async (inviteId: string) => {
    if (!canManage()) return;
    try {
      const result = await authClient.organization.cancelInvitation({
        invitationId: inviteId,
      });
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
        <h1 class="text-2xl font-bold text-slate-900">Organization roster</h1>
        <p class="text-sm text-slate-600">
          Manage who can access this program. Seats are billed per student; guardians are included for free.
        </p>
      </header>

      <Show when={organizationId()} fallback={<p class="text-sm text-slate-500">Link this account to an organization to manage bulk seats.</p>}>
        <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 class="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Members</h2>
          <div class="mt-4 space-y-3">
            <For each={members() ?? []}>
              {(entry) => (
                <div class="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                  <div>
                    <p class="text-sm font-semibold text-slate-900">{entry.user.name ?? entry.user.email}</p>
                    <p class="text-xs text-slate-500">{entry.user.email ?? 'No email on file'}</p>
                  </div>
                  <div class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {entry.role}
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
          <h2 class="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Invite guardians or students</h2>
          <Show when={canManage()} fallback={<p class="mt-3 text-sm text-slate-500">Only organization admins can invite members.</p>}>
            <form class="mt-4 space-y-3" onSubmit={handleInvite}>
              <div class="space-y-2">
                <label class="text-sm font-medium text-slate-700">Email</label>
                <Input
                  type="email"
                  required
                  value={inviteEmail()}
                  onInput={(event) => setInviteEmail(event.currentTarget.value)}
                  class="h-12 rounded-2xl border border-slate-300 text-base placeholder:text-slate-400 focus:border-slate-900"
                  placeholder="student@school.com"
                />
              </div>
              <div class="space-y-2">
                <label class="text-sm font-medium text-slate-700">Role</label>
                <select
                  class="h-12 w-full rounded-2xl border border-slate-300 px-4 text-base text-slate-900 focus:border-slate-900"
                  value={inviteRole()}
                  onChange={(event) => setInviteRole(event.currentTarget.value as 'student' | 'guardian')}
                >
                  <option value="student">Student seat</option>
                  <option value="guardian">Guardian</option>
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
      </Show>
    </div>
  );
};

export default OrganizationRosterPage;
