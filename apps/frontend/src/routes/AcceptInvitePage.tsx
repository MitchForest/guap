import { useRouter } from '@tanstack/solid-router';
import { Component, Show, createEffect, createMemo, createSignal } from 'solid-js';
import { useAuth } from '~/contexts/AuthContext';
import { AppPaths } from '~/routerPaths';
import { setPendingInvite } from '~/lib/pendingInvite';
import { authClient } from '~/lib/authClient';
import { toast } from 'solid-sonner';

const AcceptInvitePage: Component = () => {
  const router = useRouter();
  const invitationId = createMemo(() => {
    const segments = router.state.location.pathname.split('/').filter(Boolean);
    return segments.at(-1) ?? '';
  });
  const { isAuthenticated, isLoading, refresh } = useAuth();

  const [status, setStatus] = createSignal<'idle' | 'processing' | 'success'>('idle');
  const [error, setError] = createSignal<string | null>(null);

  const acceptInvite = async (id: string) => {
    setStatus('processing');
    setError(null);
    try {
      const result = await authClient.organization.acceptInvitation({
        invitationId: id,
      });
      if (result.error) {
        throw new Error(result.error.message ?? 'Unable to accept invite');
      }
      setStatus('success');
      toast.success('Invite accepted!');
      await refresh();
      router.navigate({ to: AppPaths.app });
    } catch (err) {
      console.error('Accept invite failed', err);
      setStatus('idle');
      setError(err instanceof Error ? err.message : 'Unable to accept invite');
    }
  };

  createEffect(() => {
    const id = invitationId();
    if (!id) {
      setError('Invitation link is missing or invalid.');
      return;
    }
    if (isLoading()) return;

    if (!isAuthenticated()) {
      setPendingInvite({ invitationId: id });
      toast.info('Sign in to accept your invite.');
      router.navigate({ to: AppPaths.signIn });
      return;
    }

    if (status() === 'idle') {
      void acceptInvite(id);
    }
  });

  return (
    <div class="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-200 px-4 py-16">
      <div class="w-full max-w-xl space-y-6 rounded-3xl border border-slate-200 bg-white p-10 shadow-xl text-center">
        <div class="space-y-3">
          <p class="text-4xl">📨</p>
          <h1 class="text-3xl font-bold text-slate-900">Accepting your invite…</h1>
          <p class="text-base text-slate-600">
            We&apos;re connecting you to your organization. If this takes more than a few seconds,
            try refreshing the page.
          </p>
        </div>

        <Show when={status() === 'success'}>
          <div class="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            Invite accepted! Redirecting you to your dashboard…
          </div>
        </Show>

        <Show when={error()}>
          <div class="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error()}</div>
        </Show>
      </div>
    </div>
  );
};

export default AcceptInvitePage;
