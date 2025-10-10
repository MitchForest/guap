import { useRouter } from '@tanstack/solid-router';
import { Component, createSignal, createEffect } from 'solid-js';
import { Button } from '~/components/ui/button';
import { useAuth } from '~/contexts/AuthContext';
import { AppPaths } from '~/routerPaths';

const SignInPage: Component = () => {
  const router = useRouter();
  const { signIn, isAuthenticated, isLoading } = useAuth();
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
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
      await signIn(email(), password());
      router.navigate({ to: AppPaths.app });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in');
    }
  };

  return (
    <div class="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <form onSubmit={handleSubmit} class="w-full max-w-md space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
        <div class="space-y-2">
          <h1 class="text-2xl font-semibold text-slate-900">Welcome back</h1>
          <p class="text-sm text-subtle">Sign in to manage automations and track progress.</p>
        </div>
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
            class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
            value={password()}
            onInput={(event) => setPassword(event.currentTarget.value)}
          />
        </label>
        {error() && <p class="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">{error()}</p>}
        <Button type="submit" class="w-full" disabled={isLoading()}>
          {isLoading() ? 'Signing in…' : 'Sign In'}
        </Button>
        <p class="text-center text-sm text-subtle">
          Need an account?{' '}
          <button
            type="button"
            class="font-semibold text-slate-900 underline-offset-4 hover:underline"
            onClick={() => router.navigate({ to: AppPaths.signUp })}
          >
            Sign up
          </button>
        </p>
      </form>
    </div>
  );
};

export default SignInPage;
