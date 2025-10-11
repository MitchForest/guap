import { Link, useRouter } from '@tanstack/solid-router';
import { clsx } from 'clsx';
import {
  Component,
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from 'solid-js';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { useAppData } from '~/contexts/AppDataContext';
import { useAuth } from '~/contexts/AuthContext';
import { formatCurrency } from '~/utils/format';
import { ensureWorkspacePair, listWorkspaceVariants } from '~/domains/workspaces/api/client';
import type { WorkspaceRecord } from '@guap/api';
import { workspaceSync } from '~/domains/workspaces/state/workspaceSync';
import { AppPaths, type AppPathValue } from '~/routerPaths';

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

type WorkspaceVariant = 'live' | 'sandbox';

type SandboxStatus = 'synced' | 'draft' | 'stale' | 'pendingApproval';

const toSlug = (input: string) =>
  input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '') || 'workspace';

const deriveSandboxStatus = (pair: { live: WorkspaceRecord | null; sandbox: WorkspaceRecord | null }): SandboxStatus => {
  const sandbox = pair.sandbox;
  const live = pair.live;
  if (!sandbox) return 'synced';
  if (sandbox.pendingRequestId) return 'pendingApproval';
  const lastSynced = sandbox.lastSyncedAt ?? 0;
  const lastApplied = sandbox.lastAppliedAt ?? 0;
  const sandboxUpdated = sandbox.updatedAt ?? 0;
  const liveUpdated = live?.updatedAt ?? 0;

  if (liveUpdated > lastSynced) {
    return 'stale';
  }
  if (sandboxUpdated > lastSynced || sandboxUpdated > lastApplied) {
    return 'draft';
  }
  return 'synced';
};

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
  const { user, signOut, isAuthenticated } = useAuth();
  const { activeHousehold, accounts, requests } = useAppData();
  const [workspacePair, setWorkspacePair] = createSignal<{ live: WorkspaceRecord | null; sandbox: WorkspaceRecord | null }>({
    live: null,
    sandbox: null,
  });
  const [activeWorkspaceSlug, setActiveWorkspaceSlug] = createSignal<string | null>(
    workspaceSync.getStoredSlug()
  );

  const currentPath = createMemo(() => router.state.location.pathname);

  const isActive = (path: NavigationPath) => {
    if (path === basePath) {
      return currentPath() === basePath;
    }
    return currentPath() === path || currentPath().startsWith(`${path}/`);
  };

  const activeRole = createMemo(() => user()?.role ?? 'kid');
  const requestsLabel = createMemo(() => (activeRole() === 'kid' ? 'Requests' : 'Approvals'));
  const activeHouseholdName = createMemo(() => activeHousehold()?.name ?? 'Household');
  const totalBalance = createMemo(() =>
    accounts().reduce((sum, account) => sum + account.balanceCents, 0)
  );
  const activeRequestsCount = createMemo(
    () => requests().filter((item) => item.state === 'pending').length
  );
  const sandboxStatus = createMemo(() => deriveSandboxStatus(workspacePair()));
  const activeVariant = createMemo<WorkspaceVariant>(() => {
    const slug = activeWorkspaceSlug();
    const pair = workspacePair();
    if (slug && pair.sandbox && pair.sandbox.slug === slug) {
      return 'sandbox';
    }
    return 'live';
  });
  const sandboxBanner = createMemo(() => {
    if (activeVariant() !== 'sandbox') {
      return null;
    }
    const status = sandboxStatus();
    switch (status) {
      case 'pendingApproval':
        return {
          tone: 'warning' as const,
          message: 'Sandbox changes are awaiting approval. Editing is temporarily locked.',
          icon: '⏳',
        };
      case 'stale':
        return {
          tone: 'danger' as const,
          message: 'Money Map changed after the last sandbox sync. Reset or re-sync before applying.',
          icon: '⚠️',
        };
      case 'draft':
        return {
          tone: 'info' as const,
          message: 'Sandbox has unpublished changes. Apply to Money Map once you are ready.',
          icon: '✏️',
        };
      default:
        return null;
    }
  });
  const refreshWorkspaces = async () => {
    if (!isAuthenticated()) {
      setWorkspacePair({ live: null, sandbox: null });
      setActiveWorkspaceSlug(null);
      workspaceSync.clear();
      return;
    }

    const household = activeHousehold();
    if (!household) return;

    try {
      let pair = await listWorkspaceVariants(household._id);
      if (!pair.live || !pair.sandbox) {
        const baseSlug = toSlug(household.slug ?? household.name ?? `household-${household._id}`);
        const liveSlug = `${baseSlug}-live`;
        const sandboxSlug = `${baseSlug}-sandbox`;
        const householdName = household.name ?? 'Money Map';
        await ensureWorkspacePair({
          householdId: household._id,
          slug: liveSlug,
          name: `${householdName} Money Map`,
          sandboxSlug,
          sandboxName: `${householdName} Sandbox`,
        });
        pair = await listWorkspaceVariants(household._id);
      }
      setWorkspacePair(pair);
      const availableSlugs = [pair.sandbox?.slug, pair.live?.slug].filter(Boolean) as string[];
      const currentSlug = activeWorkspaceSlug();
      const resolvedSlug =
        currentSlug && availableSlugs.includes(currentSlug)
          ? currentSlug
          : pair.sandbox?.slug ?? pair.live?.slug ?? null;
      if (resolvedSlug !== currentSlug) {
        setActiveWorkspaceSlug(resolvedSlug);
        if (resolvedSlug) {
          workspaceSync.setActiveSlug(resolvedSlug);
        } else {
          workspaceSync.clear();
        }
      }
    } catch (error) {
      console.error('Failed to load workspaces', error);
      setWorkspacePair({ live: null, sandbox: null });
    }
  };

  onMount(() => {
    const unsubscribe = workspaceSync.onChange((slug) => {
      if (slug !== activeWorkspaceSlug()) {
        setActiveWorkspaceSlug(slug);
      }
      if (isAuthenticated()) {
        void refreshWorkspaces();
      }
    });
    onCleanup(() => unsubscribe());
  });

  createEffect(() => {
    if (isAuthenticated()) {
      void refreshWorkspaces();
    } else {
      setWorkspacePair({ live: null, sandbox: null });
      setActiveWorkspaceSlug(null);
      workspaceSync.clear();
    }
  });

  const handleVariantSelect = (variant: WorkspaceVariant) => {
    const pair = workspacePair();
    const nextSlug = variant === 'sandbox' ? pair.sandbox?.slug : pair.live?.slug;
    if (!nextSlug) return;
    workspaceSync.setActiveSlug(nextSlug);
    setActiveWorkspaceSlug(nextSlug);
  };

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
            <Show when={workspacePair().live && workspacePair().sandbox}>
              <div class="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1 text-xs font-semibold text-slate-700 shadow-sm">
                <Button
                  type="button"
                  variant={activeVariant() === 'live' ? 'primary' : 'ghost'}
                  size="sm"
                  class={clsx('gap-2 rounded-xl px-3 py-1.5', activeVariant() === 'live' ? 'shadow' : '')}
                  onClick={() => handleVariantSelect('live')}
                >
                  Money Map
                </Button>
                <Button
                  type="button"
                  variant={activeVariant() === 'sandbox' ? 'primary' : 'ghost'}
                  size="sm"
                  class={clsx('gap-2 rounded-xl px-3 py-1.5', activeVariant() === 'sandbox' ? 'shadow' : '')}
                  onClick={() => handleVariantSelect('sandbox')}
                >
                  Sandbox
                  <span
                    class={clsx(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]',
                      sandboxStatus() === 'pendingApproval'
                        ? 'bg-amber-100 text-amber-700'
                        : sandboxStatus() === 'stale'
                        ? 'bg-rose-100 text-rose-600'
                        : sandboxStatus() === 'draft'
                        ? 'bg-sky-100 text-sky-700'
                        : 'bg-emerald-100 text-emerald-700'
                    )}
                  >
                    {sandboxStatus() === 'pendingApproval'
                      ? 'Pending'
                      : sandboxStatus() === 'draft'
                      ? 'Draft'
                      : sandboxStatus() === 'stale'
                      ? 'Stale'
                      : 'Synced'}
                  </span>
                </Button>
              </div>
            </Show>
            <Button type="button" variant="secondary" size="sm" class="hidden sm:flex">
              {requestsLabel()}
              <Show when={activeRequestsCount() > 0}>
                <span class="ml-2 inline-flex min-w-[24px] justify-center rounded-full bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">
                  {activeRequestsCount()}
                </span>
              </Show>
            </Button>
            <Show when={isAuthenticated()}>
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
            </Show>
          </div>
        </header>
        <Show when={sandboxBanner()}>
          {(banner) => (
            <div
              class={clsx(
                'flex flex-wrap items-center gap-2 px-3 py-2 text-xs font-medium md:flex-nowrap md:gap-3 md:px-6 md:py-3 md:text-sm',
                banner().tone === 'warning'
                  ? 'bg-amber-50 text-amber-800'
                  : banner().tone === 'danger'
                  ? 'bg-rose-50 text-rose-700'
                  : 'bg-sky-50 text-sky-700'
              )}
              role="status"
            >
              <span aria-hidden="true" class="text-base md:text-xl">
                {banner().icon}
              </span>
              <span class="flex-1 leading-snug md:leading-relaxed">{banner().message}</span>
            </div>
          )}
        </Show>
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
