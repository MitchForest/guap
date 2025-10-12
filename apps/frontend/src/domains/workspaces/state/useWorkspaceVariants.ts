import type { Accessor } from 'solid-js';
import { createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import type { WorkspaceRecord } from '@guap/api';
import type { HouseholdRecord } from '@guap/api';
import { ensureWorkspacePair, listWorkspaceVariants } from '~/domains/workspaces/api/client';
import { workspaceSync } from '~/domains/workspaces/state/workspaceSync';

export type WorkspaceVariant = 'live' | 'sandbox';
export type SandboxStatus = 'synced' | 'draft' | 'stale' | 'pendingApproval';

const toSlug = (input: string) =>
  input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '') || 'workspace';

type WorkspacePair = { live: WorkspaceRecord | null; sandbox: WorkspaceRecord | null };

type UseWorkspaceVariantsOptions = {
  activeHousehold: Accessor<HouseholdRecord | null>;
  isAuthenticated: Accessor<boolean>;
};

const emptyPair: WorkspacePair = { live: null, sandbox: null };

export const useWorkspaceVariants = ({
  activeHousehold,
  isAuthenticated,
}: UseWorkspaceVariantsOptions) => {
  const [workspacePair, setWorkspacePair] = createSignal<WorkspacePair>(emptyPair);
  const [workspaceSlugValue, setWorkspaceSlugValue] = createSignal<string | null>(
    workspaceSync.getStoredSlug()
  );
  const [initializing, setInitializing] = createSignal(true);

  const liveWorkspace = createMemo(() => workspacePair().live);
  const sandboxWorkspace = createMemo(() => workspacePair().sandbox);

  const activeVariant = createMemo<WorkspaceVariant>(() => {
    const slug = workspaceSlugValue();
    const sandbox = sandboxWorkspace();
    if (slug && sandbox && sandbox.slug === slug) return 'sandbox';
    return 'live';
  });

  const currentWorkspace = createMemo<WorkspaceRecord | null>(() => {
    return activeVariant() === 'sandbox'
      ? sandboxWorkspace() ?? liveWorkspace() ?? null
      : liveWorkspace() ?? sandboxWorkspace() ?? null;
  });

  const sandboxStatus = createMemo<SandboxStatus>(() => {
    const sandbox = sandboxWorkspace();
    const live = liveWorkspace();
    if (!sandbox) return 'synced';
    if (sandbox.pendingRequestId) return 'pendingApproval';
    const lastSynced = sandbox.lastSyncedAt ?? 0;
    const lastApplied = sandbox.lastAppliedAt ?? 0;
    const sandboxUpdated = sandbox.updatedAt ?? 0;
    const liveUpdated = live?.updatedAt ?? 0;
    if (liveUpdated > lastSynced) return 'stale';
    if (sandboxUpdated > lastSynced || sandboxUpdated > lastApplied) return 'draft';
    return 'synced';
  });

  const editingLocked = createMemo(
    () => activeVariant() !== 'sandbox' || sandboxStatus() === 'pendingApproval'
  );

  const canApplySandbox = createMemo(
    () => activeVariant() === 'sandbox' && sandboxStatus() === 'draft'
  );

  const canResetSandbox = createMemo(
    () => activeVariant() === 'sandbox' && (sandboxStatus() === 'draft' || sandboxStatus() === 'stale')
  );

  const sandboxStatusLabel = createMemo(() => {
    switch (sandboxStatus()) {
      case 'pendingApproval':
        return 'Pending Approval';
      case 'draft':
        return 'Draft';
      case 'stale':
        return 'Stale';
      default:
        return 'Synced';
    }
  });

  const sandboxStatusClass = createMemo(() => {
    switch (sandboxStatus()) {
      case 'pendingApproval':
        return 'bg-amber-100 text-amber-700';
      case 'stale':
        return 'bg-rose-100 text-rose-600';
      case 'draft':
        return 'bg-sky-100 text-sky-700';
      default:
        return 'bg-emerald-100 text-emerald-700';
    }
  });

  const applyWorkspaceSlug = (slug: string | null) => {
    setWorkspaceSlugValue(slug);
    if (slug) {
      workspaceSync.setActiveSlug(slug);
    } else {
      workspaceSync.clear();
    }
  };

  const clearState = () => {
    setWorkspacePair(emptyPair);
    applyWorkspaceSlug(null);
  };

  const refreshWorkspaces = async () => {
    if (!isAuthenticated()) {
      clearState();
      setInitializing(false);
      return;
    }

    const household = activeHousehold();
    if (!household) {
      clearState();
      setInitializing(false);
      return;
    }

    try {
      let pair = await listWorkspaceVariants(household._id);
      if (!pair.live || !pair.sandbox) {
        const baseSlug = toSlug(household.slug ?? household.name ?? `household-${household._id}`);
        const liveSlug = `${baseSlug}-live`;
        const sandboxSlug = `${baseSlug}-draft`;
        const householdName = household.name ?? 'Money Map';
        await ensureWorkspacePair({
          householdId: household._id,
          slug: liveSlug,
          name: `${householdName} Money Map`,
          sandboxSlug,
          sandboxName: `${householdName} Draft`,
        });
        pair = await listWorkspaceVariants(household._id);
      }
      setWorkspacePair(pair);
      const availableSlugs = [pair.sandbox?.slug, pair.live?.slug].filter(Boolean) as string[];
      const currentSlug = workspaceSlugValue();
      const resolvedSlug =
        currentSlug && availableSlugs.includes(currentSlug)
          ? currentSlug
          : pair.sandbox?.slug ?? pair.live?.slug ?? null;

      if (resolvedSlug !== currentSlug) {
        applyWorkspaceSlug(resolvedSlug);
      } else if (!resolvedSlug) {
        applyWorkspaceSlug(null);
      }
    } catch (error) {
      console.error('Failed to load workspaces', error);
      clearState();
    } finally {
      setInitializing(false);
    }
  };

  onMount(() => {
    const unsubscribe = workspaceSync.onChange((slug) => {
      if (slug !== workspaceSlugValue()) {
        setWorkspaceSlugValue(slug);
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
      clearState();
      setInitializing(false);
    }
  });

  createEffect(() => {
    const household = activeHousehold();
    if (household && isAuthenticated()) {
      void refreshWorkspaces();
    }
  });

  return {
    workspacePair,
    workspaceSlug: workspaceSlugValue,
    setWorkspaceSlug: applyWorkspaceSlug,
    activeVariant,
    currentWorkspace,
    sandboxStatus,
    editingLocked,
    canApplySandbox,
    canResetSandbox,
    sandboxStatusLabel,
    sandboxStatusClass,
    refreshWorkspaces,
    initializingWorkspace: initializing,
  };
};

export { toSlug };
