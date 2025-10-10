import { Outlet, useRouter } from '@tanstack/solid-router';
import { Component, Show, createEffect } from 'solid-js';
import AppShell from '~/components/layout/AppShell';
import { useAuth } from '~/contexts/AuthContext';
import { useShell } from '~/contexts/ShellContext';
import { AppPaths } from '~/routerPaths';

const AppLayout: Component = () => {
  const { fullScreen } = useShell();
  const { isAuthenticated, isLoading, error } = useAuth();
  const router = useRouter();

  createEffect(() => {
    if (!isLoading() && !isAuthenticated()) {
      router.navigate({ to: AppPaths.signIn });
    }
  });

  return (
    <Show
      when={!isLoading() && isAuthenticated()}
      fallback={
        <div class="flex min-h-screen flex-col items-center justify-center gap-2 text-sm text-subtle">
          <span>Checking your session…</span>
          <Show when={error()}>
            {(message) => (
              <span class="rounded-xl bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-600">
                {message()}
              </span>
            )}
          </Show>
        </div>
      }
    >
      <AppShell fullScreen={fullScreen()}>
        <Outlet />
      </AppShell>
    </Show>
  );
};

export default AppLayout;
