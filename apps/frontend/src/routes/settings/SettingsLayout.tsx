import { Link, Outlet, useRouter } from '@tanstack/solid-router';
import { Component, For, createEffect, createMemo } from 'solid-js';
import { clsx } from 'clsx';
import { AppPaths } from '~/routerPaths';
import { useAuth } from '~/contexts/AuthContext';

const SettingsLayout: Component = () => {
  const router = useRouter();
  const { user } = useAuth();

  createEffect(() => {
    if (router.state.location.pathname === AppPaths.appSettings) {
      router.navigate({ to: AppPaths.appSettingsMembers });
    }
  });

  const settingsNav = createMemo(() => {
    const base: Array<{ label: string; path: string }> = [
      { label: 'Household members', path: AppPaths.appSettingsMembers },
      { label: 'Billing & plans', path: AppPaths.appSettingsBilling },
    ];
    if (user()?.role === 'owner' || user()?.role === 'admin') {
      base.push({ label: 'Organization roster', path: AppPaths.appSettingsOrganization });
    }
    return base;
  });

  return (
    <div class="flex flex-col gap-8 lg:flex-row">
      <nav class="w-full max-w-xs rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Settings</h2>
        <ul class="mt-4 space-y-2">
          <For each={settingsNav()}>
            {(item) => (
              <li>
                <Link
                  to={item.path}
                  class={clsx(
                    'block rounded-2xl px-4 py-3 text-sm font-semibold transition hover:bg-slate-100',
                    router.state.location.pathname.startsWith(item.path)
                      ? 'bg-slate-900 text-white shadow'
                      : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  {item.label}
                </Link>
              </li>
            )}
          </For>
        </ul>
      </nav>

      <div class="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  );
};

export default SettingsLayout;
