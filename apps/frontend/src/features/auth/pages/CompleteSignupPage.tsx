import { useRouter } from '@tanstack/solid-router';
import { Component, Show, createSignal, onMount } from 'solid-js';
import { toast } from 'solid-sonner';
import { AppPaths } from '~/app/routerPaths';
import { useAuth } from '~/app/contexts/AuthContext';
import { guapApi } from '~/shared/services/guapApi';
import {
  SIGNUP_STATE_QUERY_PARAM,
  consumeSignupState,
  decodeSignupState,
  type SignupState,
} from '~/features/auth/utils/authFlowStorage';

const removeSignupQueryParam = () => {
  if (typeof window === 'undefined') return;
  const current = new URL(window.location.href);
  current.searchParams.delete(SIGNUP_STATE_QUERY_PARAM);
  window.history.replaceState({}, '', current.toString());
};

const CompleteSignupPage: Component = () => {
  const router = useRouter();
  const { refresh, isAuthenticated } = useAuth();
  const [status, setStatus] = createSignal<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [error, setError] = createSignal<string | null>(null);

  const resolveSignupState = (): SignupState | null => {
    const search = router.state.location.search ?? '';
    const params = new URLSearchParams(search);
    const encoded = params.get(SIGNUP_STATE_QUERY_PARAM);
    const decoded = decodeSignupState(encoded);
    if (encoded) {
      removeSignupQueryParam();
    }
    if (decoded) {
      return decoded;
    }
    return consumeSignupState();
  };

  const ensureSession = async () => {
    if (isAuthenticated()) return true;
    await refresh();
    return isAuthenticated();
  };

  const finalizeSignup = async () => {
    if (status() !== 'idle') {
      return;
    }
    setStatus('processing');
    setError(null);

    const signupState = resolveSignupState();
    if (!signupState) {
      setError('Signup details are missing. Please request a new magic link.');
      setStatus('error');
      return;
    }

    const hasSession = await ensureSession();
    if (!hasSession) {
      setError('Please sign in to finish setting up your account.');
      setStatus('error');
      return;
    }

    try {
      const result = await guapApi.completeSignup(signupState);
      if (result.shouldRefresh) {
        await refresh();
      }
      toast.success('Your account is ready!');
      setStatus('success');
      router.navigate({ to: AppPaths.app });
    } catch (err) {
      console.error('Complete signup failed', err);
      setError(err instanceof Error ? err.message : 'Unable to finish signup');
      setStatus('error');
    }
  };

  onMount(() => {
    void finalizeSignup();
  });

  return (
    <div class="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-200 px-4 py-16">
      <div class="w-full max-w-lg space-y-6 rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-xl">
        <div class="space-y-3">
          <p class="text-4xl">🔐</p>
          <h1 class="text-3xl font-bold text-slate-900">Finishing your setup…</h1>
          <p class="text-base text-slate-600">
            We&apos;re creating your household and connecting your account. This only takes a moment.
          </p>
        </div>

        <Show when={status() === 'processing'}>
          <div class="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
            Preparing your workspace. Please keep this tab open.
          </div>
        </Show>

        <Show when={status() === 'success'}>
          <div class="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            All set! Redirecting you to your dashboard…
          </div>
        </Show>

        <Show when={error()}>
          <div class="space-y-4">
            <div class="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {error()}
            </div>
            <button
              type="button"
              class="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              onClick={() => {
                setStatus('idle');
                void finalizeSignup();
              }}
            >
              Try again
            </button>
            <button
              type="button"
              class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
              onClick={() => router.navigate({ to: AppPaths.signIn })}
            >
              Return to sign-in
            </button>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default CompleteSignupPage;
