import { Outlet, useRouter } from '@tanstack/solid-router';
import { Component, Show, createEffect, createMemo } from 'solid-js';
import AppShell from '~/features/app-shell/components/AppShell';
import { useAuth } from '~/app/contexts/AuthContext';
import { useShell } from '~/app/contexts/ShellContext';
import { AppPaths } from '~/app/routerPaths';

const AppLayout: Component = () => {
  const { fullScreen } = useShell();
  const { isAuthenticated, isLoading, error } = useAuth();
  const router = useRouter();
  const authed = createMemo(() => isAuthenticated());
  const checkingSession = createMemo(() => !authed() && isLoading());

  createEffect(() => {
    if (!isLoading() && !isAuthenticated()) {
      router.navigate({ to: AppPaths.signIn });
    }
  });

  return (
    <Show
      when={authed()}
      fallback={
        <Show when={checkingSession()} fallback={null}>
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
        </Show>
      }
    >
      <AppShell fullScreen={fullScreen()}>
        <Outlet />
      </AppShell>
    </Show>
  );
};

export default AppLayout;
