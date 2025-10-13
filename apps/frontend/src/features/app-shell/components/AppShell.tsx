import { Link, useRouter } from '@tanstack/solid-router';
import { clsx } from 'clsx';
import { Component, For, Show, createMemo } from 'solid-js';
import { Button } from '~/shared/components/ui/button';
import { Input } from '~/shared/components/ui/input';
import { useAppData } from '~/app/contexts/AppDataContext';
import { useAuth } from '~/app/contexts/AuthContext';
import { formatCurrency } from '~/shared/utils/format';
import { AppPaths, type AppPathValue } from '~/app/routerPaths';

type AppShellProps = {
  children: any;
  fullScreen?: boolean;
};

type NavigationPath = AppPathValue;

type NavItem = {
  label: string;
  path: NavigationPath;
  icon: string;
};

const basePath: NavigationPath = AppPaths.appDashboard;

const primaryNav: NavItem[] = [
  { label: 'Dashboard', path: AppPaths.appDashboard, icon: '📊' },
  { label: 'Earn', path: AppPaths.appEarn, icon: '💼' },
  { label: 'Save', path: AppPaths.appSave, icon: '💰' },
  { label: 'Invest', path: AppPaths.appInvest, icon: '📈' },
  { label: 'Spend', path: AppPaths.appSpend, icon: '💳' },
  { label: 'Donate', path: AppPaths.appDonate, icon: '🎁' },
  { label: 'Automations', path: AppPaths.appAutomations, icon: '🛠️' },
];

const toolsNav: NavItem[] = [
  { label: 'Compound Calculator', path: AppPaths.appToolsCompound, icon: '🧮' },
  { label: 'Wealth Ladder', path: AppPaths.appToolsWealthLadder, icon: '🪜' },
];

const AppShell: Component<AppShellProps> = (props) => {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { activeHousehold, accounts, requests } = useAppData();

  const currentPath = createMemo(() => router.state.location.pathname);

  const isActive = (path: NavigationPath) => {
    if (path === basePath) {
      return currentPath() === basePath;
    }
    return currentPath() === path || currentPath().startsWith(`${path}/`);
  };

  const activeRole = createMemo(() => user()?.role ?? 'member');
  const requestsLabel = createMemo(() => (activeRole() === 'member' ? 'Requests' : 'Approvals'));
  const activeHouseholdName = createMemo(() => activeHousehold()?.name ?? 'Household');
  const totalBalance = createMemo(() => accounts().reduce((sum, account) => sum + account.balanceCents, 0));
  const activeRequestsCount = createMemo(() => requests().filter((item) => item.state === 'pending').length);
  const settingsNav = createMemo<NavItem[]>(() => {
    const items: NavItem[] = [
      { label: 'Members', path: AppPaths.appSettingsMembers, icon: '👥' },
      { label: 'Billing', path: AppPaths.appSettingsBilling, icon: '💳' },
    ];
    const role = user()?.role;
    if (role === 'owner' || role === 'admin') {
      items.push({ label: 'Org roster', path: AppPaths.appSettingsOrganization, icon: '🏫' });
    }
    return items;
  });

  return (
    <div class="flex h-full w-full bg-slate-100 text-slate-900">
      <Show when={!props.fullScreen}>
        <aside class="hidden w-64 flex-col border-r border-slate-200 bg-white/90 p-4 backdrop-blur lg:flex">
          <div class="mb-6 flex items-center gap-2 text-lg font-semibold">
            <span class="text-2xl">🪙</span>
            <span>Guap</span>
          </div>
          <nav class="flex flex-1 flex-col gap-6 text-sm">
            <div class="space-y-1">
              <For each={primaryNav}>
                {(item) => (
                  <Link
                    to={item.path}
                    activeOptions={{ exact: item.path === basePath }}
                    class={clsx(
                      'flex items-center gap-3 rounded-xl px-3 py-2 font-medium transition hover:bg-slate-100',
                      isActive(item.path)
                        ? 'bg-slate-900 text-white hover:bg-slate-800'
                        : 'text-slate-600 hover:text-slate-900'
                    )}
                  >
                    <span aria-hidden="true" class="text-lg">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </Link>
                )}
              </For>
            </div>
            <div class="space-y-1">
              <p class="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Tools</p>
              <For each={toolsNav}>
                {(item) => (
                  <Link
                    to={item.path}
                    class={clsx(
                      'flex items-center gap-3 rounded-xl px-3 py-2 font-medium transition hover:bg-slate-100',
                      isActive(item.path)
                        ? 'bg-slate-200 text-slate-900'
                        : 'text-slate-600 hover:text-slate-900'
                    )}
                  >
                    <span aria-hidden="true" class="text-lg">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </Link>
                )}
              </For>
            </div>
            <div class="space-y-1">
              <p class="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Settings</p>
              <For each={settingsNav()}>
                {(item) => (
                  <Link
                    to={item.path}
                    class={clsx(
                      'flex items-center gap-3 rounded-xl px-3 py-2 font-medium transition hover:bg-slate-100',
                      isActive(item.path)
                        ? 'bg-slate-200 text-slate-900'
                        : 'text-slate-600 hover:text-slate-900'
                    )}
                  >
                    <span aria-hidden="true" class="text-lg">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </Link>
                )}
              </For>
            </div>
            <div class="mt-auto space-y-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-4">
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Household
              </p>
              <p class="text-sm font-semibold text-slate-700">{activeHouseholdName()}</p>
              <p class="text-lg font-semibold text-slate-900">{formatCurrency(totalBalance())}</p>
              <p class="text-xs text-subtle">
                {activeRequestsCount()} active {activeRequestsCount() === 1 ? 'request' : 'requests'} awaiting
                action.
              </p>
            </div>
          </nav>
        </aside>
      </Show>
      <div class="flex flex-1 flex-col">
        <header
          class={clsx(
            'flex items-center justify-between border-b px-4 py-3 md:px-6',
            props.fullScreen
              ? 'border-transparent bg-transparent'
              : 'border-slate-200 bg-white/80 backdrop-blur'
          )}
        >
          <div class="flex flex-1 items-center gap-3 md:gap-4">
            <Show when={props.fullScreen}>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                class="lg:hidden"
                onClick={() => router.navigate({ to: basePath })}
              >
                ← Back
              </Button>
            </Show>
            <div class="relative hidden flex-1 max-w-md items-stretch lg:flex">
              <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                🔍
              </span>
              <Input
                type="search"
                class="h-10 w-full pl-10 pr-3"
                placeholder="Search accounts, goals, automations…"
                aria-label="Search"
              />
            </div>
          </div>
          <div class="flex items-center gap-3">
            <Button type="button" variant="secondary" size="sm" class="hidden sm:flex">
              {requestsLabel()}
              <Show when={activeRequestsCount() > 0}>
                <span class="ml-2 inline-flex min-w-[24px] justify-center rounded-full bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">
                  {activeRequestsCount()}
                </span>
              </Show>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="flex items-center gap-2 text-slate-600 hover:text-slate-900"
              onClick={async () => {
                await signOut();
                router.navigate({ to: AppPaths.landing });
              }}
            >
              <span class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
                {user()?.displayName?.slice(0, 1).toUpperCase() ?? 'U'}
              </span>
              <span class="hidden text-sm font-semibold sm:block">Sign out</span>
            </Button>
          </div>
        </header>
        <main
          class={clsx(
            'flex-1',
            props.fullScreen ? 'overflow-hidden bg-slate-200' : 'overflow-y-auto bg-slate-50'
          )}
        >
          <div
            class={clsx(
              'h-full w-full',
              props.fullScreen ? 'p-0' : 'mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-10'
            )}
          >
            {props.children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppShell;
