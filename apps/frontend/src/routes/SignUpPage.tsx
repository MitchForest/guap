import type { UserRole } from '@guap/types';
import { useRouter } from '@tanstack/solid-router';
import { Component, createEffect, createSignal } from 'solid-js';
import { Button } from '~/components/ui/button';
import { useAuth } from '~/contexts/AuthContext';
import { AppPaths } from '~/routerPaths';

const SignUpPage: Component = () => {
  const router = useRouter();
  const { signUp, isAuthenticated, isLoading } = useAuth();
  const [name, setName] = createSignal('');
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [role, setRole] = createSignal<UserRole>('kid');
  const [error, setError] = createSignal<string | null>(null);

  createEffect(() => {
    if (isAuthenticated()) {
      router.navigate({ to: AppPaths.app });
    }
  });

  const handleSubmit = async (event: Event) => {
    event.preventDefault();
    setError(null);
    try {
      await signUp(email(), password(), name(), role());
      router.navigate({ to: AppPaths.app });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign up');
    }
  };

  return (
    <div class="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <form onSubmit={handleSubmit} class="w-full max-w-md space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
        <div class="space-y-2">
          <h1 class="text-2xl font-semibold text-slate-900">Create your Guap account</h1>
          <p class="text-sm text-subtle">Invite your family and start automating the money map.</p>
        </div>
        <label class="space-y-2 text-sm font-medium text-slate-700">
          Name
          <input
            required
            class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
            value={name()}
            onInput={(event) => setName(event.currentTarget.value)}
          />
        </label>
        <label class="space-y-2 text-sm font-medium text-slate-700">
          Email
          <input
            type="email"
            required
            class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
            value={email()}
            onInput={(event) => setEmail(event.currentTarget.value)}
          />
        </label>
        <label class="space-y-2 text-sm font-medium text-slate-700">
          Password
          <input
            type="password"
            required
            minlength={8}
            class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
            value={password()}
            onInput={(event) => setPassword(event.currentTarget.value)}
          />
        </label>
        <label class="space-y-2 text-sm font-medium text-slate-700">
          Role
          <select
            class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
            value={role()}
            onChange={(event) => setRole(event.currentTarget.value as UserRole)}
          >
            <option value="kid">Kid</option>
            <option value="guardian">Guardian</option>
          </select>
        </label>
        {error() && <p class="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">{error()}</p>}
        <Button type="submit" class="w-full" disabled={isLoading()}>
          {isLoading() ? 'Creating account…' : 'Create Account'}
        </Button>
        <p class="text-center text-sm text-subtle">
          Already have an account?{' '}
          <button
            type="button"
            class="font-semibold text-slate-900 underline-offset-4 hover:underline"
            onClick={() => router.navigate({ to: AppPaths.signIn })}
          >
            Sign in
          </button>
        </p>
      </form>
    </div>
  );
};

export default SignUpPage;
