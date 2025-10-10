import { useRouter } from '@tanstack/solid-router';
import { Component } from 'solid-js';
import { Button } from '~/components/ui/button';
import { useAuth } from '~/contexts/AuthContext';
import { AppPaths } from '~/routerPaths';

const LandingPage: Component = () => {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  return (
    <div class="flex min-h-screen flex-col bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
      <header class="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div class="flex items-center gap-2 text-lg font-semibold">
          <span class="text-2xl">🪙</span>
          <span>Guap</span>
        </div>
        <div class="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            class="text-sm font-semibold text-white/80 hover:text-white"
            onClick={() => router.navigate({ to: isAuthenticated() ? AppPaths.app : AppPaths.signIn })}
          >
            {isAuthenticated() ? 'Open App' : 'Sign In'}
          </Button>
          <Button
            type="button"
            class="bg-white text-slate-900 hover:bg-slate-100"
            onClick={() => router.navigate({ to: isAuthenticated() ? AppPaths.app : AppPaths.signUp })}
          >
            {isAuthenticated() ? 'Go to Dashboard' : 'Get Started'}
          </Button>
        </div>
      </header>
      <main class="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div class="mx-auto max-w-3xl space-y-6">
          <p class="inline-flex items-center rounded-full bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
            Teen wealth OS
          </p>
          <h1 class="text-4xl font-bold leading-tight sm:text-5xl">
            Automate allowance, build habits, and watch their money map come alive.
          </h1>
          <p class="text-lg text-white/80">
            Guap helps families route every dollar with intent. Earn, save, invest, spend, and donate—guided by smart automations and transparent approvals.
          </p>
          <div class="flex flex-wrap items-center justify-center gap-3">
            <Button
              type="button"
              class="h-12 rounded-full bg-white px-8 text-base font-semibold text-slate-900 hover:bg-slate-100"
              onClick={() =>
                router.navigate({ to: isAuthenticated() ? AppPaths.app : AppPaths.signUp })
              }
            >
              {isAuthenticated() ? 'Launch Workspace' : 'Create Account'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              class="h-12 rounded-full border-white/40 bg-transparent px-8 text-base font-semibold text-white hover:border-white hover:bg-white/10"
              onClick={() =>
                router.navigate({
                  to: isAuthenticated() ? AppPaths.appAutomations : AppPaths.signIn,
                })
              }
            >
              Explore Money Map
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LandingPage;
