import { useRouter } from '@tanstack/solid-router';
import { Component, createSignal, createEffect } from 'solid-js';
import { Motion } from 'solid-motionone';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { useAuth } from '~/contexts/AuthContext';
import { AppPaths } from '~/routerPaths';
import AnimatedLogo from '~/components/auth/AnimatedLogo';
import MiniMoneyAnimation from '~/components/auth/MiniMoneyAnimation';

const SignInPage: Component = () => {
  const router = useRouter();
  const { signIn, isAuthenticated, isLoading } = useAuth();
  const [email, setEmail] = createSignal('');
  const [name] = createSignal('');
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
      await signIn(email(), name().trim() || undefined);
      // Navigate to verify page with email as query param
      window.location.href = `/auth/verify?email=${encodeURIComponent(email())}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in');
    }
  };

  return (
    <div class="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <Motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        class="w-full max-w-md space-y-8 rounded-3xl border border-slate-200 bg-white p-12 shadow-xl"
      >
        {/* Animated Logo */}
        <AnimatedLogo />

        {/* Heading */}
        <div class="space-y-2 text-center">
          <Motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            class="text-4xl font-bold text-slate-900"
          >
            Welcome back!
          </Motion.h1>
          <Motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            class="text-base text-slate-600"
          >
            Pick up where you left off
          </Motion.p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} class="space-y-5">
          {error() && (
            <div class="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
              {error()}
            </div>
          )}

          <Input
            type="email"
            placeholder="Enter your email"
            required
            value={email()}
            onInput={(event) => setEmail(event.currentTarget.value)}
            class="h-14 rounded-2xl border border-slate-300 text-base placeholder:text-slate-400 focus:border-slate-900 transition-colors"
          />

          <Button
            type="submit"
            class="h-14 w-full rounded-2xl bg-slate-900 text-base font-semibold text-white hover:bg-slate-800 hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:bg-slate-300 disabled:cursor-not-allowed disabled:transform-none"
            disabled={isLoading()}
          >
            {isLoading() ? 'Sending link…' : 'Sign in'}
          </Button>

          {/* Helper text */}
          <Motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            class="text-center text-sm text-slate-500"
          >
            💡 We'll send you a secure magic link
          </Motion.p>
        </form>

        {/* Sign up link */}
        <p class="text-center text-sm text-slate-600">
          Don't have an account?{' '}
          <button
            type="button"
            class="font-semibold text-slate-900 hover:underline"
            onClick={() => router.navigate({ to: AppPaths.signUp })}
          >
            Sign up
          </button>
        </p>

        {/* Mini money animation */}
        <div class="pt-4 border-t border-slate-100">
          <MiniMoneyAnimation />
        </div>
      </Motion.div>
    </div>
  );
};

export default SignInPage;
