import { Component, For, Show, createEffect, createMemo, createSignal, onCleanup, onMount, on } from 'solid-js';
import { Motion } from 'solid-motionone';
import { createStore } from 'solid-js/store';
import CanvasViewport, { DragPayload, ViewportControls } from '../components/canvas/CanvasViewport';
import type { NodeAllocationStatus, IncomingAllocationInfo } from '../components/canvas/NodeCard';
import { CanvasFlow, CanvasNode, CanvasInflow, CanvasInflowCadence, CanvasPodType } from '../types/graph';
import BottomDock from '../components/layout/BottomDock';
import ZoomPad from '../components/layout/ZoomPad';
import { NODE_CARD_HEIGHT, NODE_CARD_WIDTH } from '../components/canvas/NodeCard';
import { buildEdgePath, getAnchorPoint } from '../components/canvas/EdgeLayer';
import { clsx } from 'clsx';
import EmptyHero from '../components/empty/EmptyHero';
import NodeContextMenu from '../components/nodes/NodeContextMenu';
import NodeDrawer from '../components/nodes/NodeDrawer';
import IncomeSourceModal from '../components/create/IncomeSourceModal';
import PodModal from '../components/create/PodModal';
import AccountTypeModal, { AccountOption } from '../components/create/AccountTypeModal';
import { Button } from '~/components/ui/button';
import { createHistory } from '~/domains/canvas/history';
import { useCanvasSimulation, simulationHorizonOptions } from '~/domains/canvas/useCanvasSimulation';
import { SimulationPanel } from '~/components/canvas/SimulationPanel';
import { useFlowComposer } from '~/domains/canvas/useFlowComposer';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { useAppData } from '~/contexts/AppDataContext';
import { useAuth } from '~/contexts/AuthContext';
import {
  applySandbox as applySandboxMutation,
  fetchGraph,
  publishGraph,
  resetSandbox as resetSandboxMutation,
} from '~/domains/workspaces/api/client';
import { useWorkspaceVariants } from '~/domains/workspaces/state/useWorkspaceVariants';
import { useShell } from '../contexts/ShellContext';
import { toast } from 'solid-sonner';

const GRID_SIZE = 28;
const snapToGrid = (value: number) => Math.round(value / GRID_SIZE) * GRID_SIZE;

type Snapshot = {
  nodes: CanvasNode[];
  flows: CanvasFlow[];
  rules: RuleRecord[];
  selectedIds: string[];
};

const HISTORY_CAP = 50;

const ChevronDownIcon = () => (
  <svg
    class="ml-2 h-4 w-4 text-slate-400"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const ExitIcon = () => (
  <svg
    class="h-4 w-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M15 6l6 6-6 6" />
    <path d="M21 12H9" />
    <path d="M9 5H5a2 2 0 00-2 2v10a2 2 0 002 2h4" />
  </svg>
);

const DeleteIcon = () => (
  <svg
    class="h-4 w-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M3 6h18" />
    <path d="M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2" />
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </svg>
);

const SaveIcon = () => (
  <svg
    class="h-4 w-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M5 21h14a2 2 0 002-2V7.828a2 2 0 00-.586-1.414l-3.828-3.828A2 2 0 0015.172 2H5a2 2 0 00-2 2v15a2 2 0 002 2z" />
    <path d="M9 21v-6h6v6" />
    <path d="M9 5h6v4H9z" />
  </svg>
);

const DuplicateIcon = () => (
  <svg
    class="h-4 w-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </svg>
);

const ShareIcon = () => (
  <svg
    class="h-4 w-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7" />
    <path d="M16 6l-4-4-4 4" />
    <path d="M12 2v14" />
  </svg>
);

const createId = () =>
  typeof globalThis.crypto !== 'undefined' && 'randomUUID' in globalThis.crypto
    ? globalThis.crypto.randomUUID()
    : Math.random().toString(36).slice(2);

type DragState = {
  nodeIds: string[];
  startPositions: Record<string, { x: number; y: number }>;
  delta: { x: number; y: number };
};

type RuleAllocationRecord = {
  id: string;
  targetNodeId: string;
  percentage: number;
};

type RuleRecord = {
  id: string;
  sourceNodeId: string;
  trigger: 'incoming' | 'scheduled';
  triggerNodeId: string | null;
  allocations: RuleAllocationRecord[];
};

type AllocationHealth = 'missing' | 'under' | 'over' | 'complete';

type AllocationIssue = {
  nodeId: string;
  label: string;
  total: number;
  state: AllocationHealth;
};

const ALLOCATION_TOLERANCE = 0.001;

const getDefaultReturnRate = (node: { kind: CanvasNode['kind']; category?: CanvasNode['category']; podType?: CanvasNode['podType'] | null }) => {
  if (node.kind === 'account') {
    if (node.category === 'brokerage') return 0.1;
    if (node.category === 'savings') return 0.04;
  }
  if (node.kind === 'goal' && node.podType === 'goal') {
    return 0.04;
  }
  return 0;
};

const CanvasPage: Component = () => {
  const { setFullScreen } = useShell();
  const { activeHousehold } = useAppData();
  const { user, isAuthenticated } = useAuth();
  onMount(() => setFullScreen(true));
  onCleanup(() => setFullScreen(false));

  const {
    workspacePair,
    workspaceSlug,
    activeVariant,
    currentWorkspace,
    sandboxStatus,
    editingLocked,
    canApplySandbox,
    canResetSandbox,
    sandboxStatusLabel,
    sandboxStatusClass,
    refreshWorkspaces,
    initializingWorkspace,
  } = useWorkspaceVariants({
    activeHousehold,
    isAuthenticated,
  });
  const [resetConfirmOpen, setResetConfirmOpen] = createSignal(false);
  const [applyConfirmOpen, setApplyConfirmOpen] = createSignal(false);
  const [approvalConfirmOpen, setApprovalConfirmOpen] = createSignal(false);
  const [resetting, setResetting] = createSignal(false);
  const [applying, setApplying] = createSignal(false);
  let drawerContainerRef: HTMLDivElement | undefined;
  let shareStatusTimeout: number | undefined;

  const [graph, setGraph] = createStore<{ nodes: CanvasNode[]; flows: CanvasFlow[] }>({
    nodes: [],
    flows: [],
  });
  const [selectedIds, setSelectedIds] = createSignal<string[]>([]);
  const [scalePercent, setScalePercent] = createSignal(100);
  const [dragState, setDragState] = createSignal<DragState | null>(null);
  const [viewportState, setViewportState] = createSignal({ scale: 1, translate: { x: 0, y: 0 } });
  const [drawerNodeId, setDrawerNodeId] = createSignal<string | null>(null);
  const [contextMenu, setContextMenu] = createSignal<{ nodeId: string; x: number; y: number } | null>(
    null
  );
  const [createModal, setCreateModal] = createSignal<'income' | 'pod' | 'account' | null>(null);
  const [podParentId, setPodParentId] = createSignal<string | null>(null);
  const [rules, setRules] = createSignal<RuleRecord[]>([]);
  const [showHero, setShowHero] = createSignal(true);
  const [saving, setSaving] = createSignal(false);
  const [loading, setLoading] = createSignal(true);
  const [actionsMenuOpen, setActionsMenuOpen] = createSignal(false);
  const [shareStatus, setShareStatus] = createSignal<'copied' | 'error' | null>(null);
  const [marquee, setMarquee] = createSignal<
    | null
    | {
        originLocal: { x: number; y: number };
        currentLocal: { x: number; y: number };
        originWorld: { x: number; y: number };
        currentWorld: { x: number; y: number };
      }
  >(null);
  const [placementIndex, setPlacementIndex] = createSignal(0);

  const refreshWorkspacePair = async () => {
    setLoading(true);
    try {
      await refreshWorkspaces();
      return workspacePair();
    } finally {
      setLoading(false);
    }
  };

  const showShareStatus = (status: 'copied' | 'error') => {
    setShareStatus(status);
    if (typeof window !== 'undefined') {
      if (shareStatusTimeout) window.clearTimeout(shareStatusTimeout);
      shareStatusTimeout = window.setTimeout(() => setShareStatus(null), 2400);
    }
  };

  const handleShareWorkspace = async () => {
    const slug = workspaceSlug();
    if (!slug) return;
    if (typeof window === 'undefined') return;

    try {
      const url = new URL(window.location.href);
      url.searchParams.set('workspace', slug);
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(url.toString());
        showShareStatus('copied');
      } else {
        showShareStatus('error');
      }
    } catch (error) {
      console.error('Failed to copy workspace link', error);
      showShareStatus('error');
    }
  };

  const loadGraphForSlug = async (slug: string, options: { primeHistory?: boolean } = {}) => {
    const slugSnapshot = slug;

    resetWorkspaceState();
    setLoading(true);

    try {
      const data = await fetchGraph(slugSnapshot);
      if (workspaceSlug() !== slugSnapshot) return;

      if (data && data.nodes?.length) {
        hydrateGraph(data, { primeHistory: options.primeHistory });
        setHasChanges(false);
      } else {
        resetWorkspaceState();
      }
    } catch (error) {
      if (workspaceSlug() === slugSnapshot) {
        console.error('Failed to load workspace graph', error);
        resetWorkspaceState();
      }
    } finally {
      if (workspaceSlug() === slugSnapshot) {
        setLoading(false);
      }
    }
  };

  const handleResetSandbox = async () => {
    if (activeVariant() !== 'sandbox' || resetting()) return;
    const sandbox = workspacePair().sandbox;
    const actorId = user()?.profileId;
    if (!sandbox || !actorId) {
      setResetConfirmOpen(false);
      return;
    }

    setResetting(true);
    try {
      await resetSandboxMutation({
        householdId: sandbox.householdId,
        actorUserId: actorId,
      });
      await refreshWorkspacePair();
      if (workspaceSlug() === sandbox.slug) {
        await loadGraphForSlug(sandbox.slug, { primeHistory: true });
      }
      toast.success('Sandbox reset to match your Money Map.');
    } catch (error) {
      console.error('Failed to reset sandbox', error);
      toast.error('Unable to reset the sandbox. Please try again.');
    } finally {
      setResetting(false);
      setResetConfirmOpen(false);
    }
  };

  const handleApplySandbox = async () => {
    if (activeVariant() !== 'sandbox' || applying()) return;
    const sandbox = workspacePair().sandbox;
    const actorId = user()?.profileId;
    if (!sandbox || !actorId) {
      setApplyConfirmOpen(false);
      return;
    }

    setApplying(true);
    try {
      const result = await applySandboxMutation({
        householdId: sandbox.householdId,
        actorUserId: actorId,
      });
      await refreshWorkspacePair();
      await loadGraphForSlug(sandbox.slug, { primeHistory: true });
      if (result.requiresApproval) {
        setApprovalConfirmOpen(true);
        toast.message('Sandbox submitted for approval.');
      } else {
        toast.success('Sandbox applied to your Money Map.');
      }
    } catch (error) {
      console.error('Failed to apply sandbox to live', error);
      toast.error('Apply failed. Check the console for details.');
    } finally {
      setApplying(false);
      setApplyConfirmOpen(false);
    }
  };

  onCleanup(() => {
    if (typeof window !== 'undefined' && shareStatusTimeout) {
      window.clearTimeout(shareStatusTimeout);
    }
  });

  const cloneSnapshot = (snap: Snapshot): Snapshot => ({
    nodes: snap.nodes.map((node) => ({ ...node, position: { ...node.position } })),
    flows: snap.flows.map((flow) => ({ ...flow })),
    rules: snap.rules.map((rule) => ({
      ...rule,
      allocations: rule.allocations.map((alloc) => ({ ...alloc })),
    })),
    selectedIds: [...snap.selectedIds],
  });

  const snapshotGraph = (): Snapshot =>
    cloneSnapshot({
      nodes: graph.nodes,
      flows: graph.flows,
      rules: rules(),
      selectedIds: selectedIds(),
    });

  const applySnapshot = (snap: Snapshot) => {
    const clone = cloneSnapshot(snap);
    setGraph('nodes', () => clone.nodes);
    setGraph('flows', () => clone.flows);
    setRules(clone.rules);
    setSelectedIds(clone.selectedIds);
    setDrawerNodeId(null);
    setMarquee(null);
    exitFlowMode();
  };

  const {
    historyIndex,
    hasChanges,
    setHasChanges,
    pushHistory,
    replaceHistory,
    undo,
    redo,
    resetHistory,
  } = createHistory<Snapshot>({
    snapshotSource: snapshotGraph,
    applySnapshot,
    cloneSnapshot,
    cap: HISTORY_CAP,
  });
  const {
    flowComposer,
    hoveredAnchor,
    connectingPreview,
    connectingFrom,
    enterFlowMode,
    exitFlowMode,
    startFlowFromNode,
    completeFlow,
    handleFlowStartFromAnchor,
    handleFlowTargetSelect,
  } = useFlowComposer({
    getNodes: () => graph.nodes,
    getFlows: () => graph.flows,
    updateFlows: (mutator) => setGraph('flows', (flows) => mutator([...flows])),
    pushHistory,
    openDrawer: (nodeId) => setDrawerNodeId(nodeId),
    translateClientToWorld,
    getAnchorPoint,
    buildEdgePath,
  });


  function resetWorkspaceState() {
    setGraph('nodes', () => []);
    setGraph('flows', () => []);
    setRules([]);
    setSelectedIds([]);
    setDrawerNodeId(null);
    setMarquee(null);
    exitFlowMode();
    setPlacementIndex(0);
    resetHistory();
    setShowHero(true);
  }

  createEffect(() => {
    if (historyIndex() === -1) {
      replaceHistory(snapshotGraph());
    }
  });

  const rectsIntersect = (
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number },
  ) =>
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y;

  const computeWorldRect = (origin: { x: number; y: number }, current: { x: number; y: number }) => {
    const x = Math.min(origin.x, current.x);
    const y = Math.min(origin.y, current.y);
    const width = Math.abs(origin.x - current.x);
    const height = Math.abs(origin.y - current.y);
    return { x, y, width, height };
  };

  const updateSelectionFromMarquee = (
    originWorld: { x: number; y: number },
    currentWorld: { x: number; y: number },
  ) => {
    const rect = computeWorldRect(originWorld, currentWorld);
    const selected = graph.nodes
      .filter((node) =>
        rectsIntersect(
          { x: node.position.x, y: node.position.y, width: NODE_CARD_WIDTH, height: NODE_CARD_HEIGHT },
          rect,
        ),
      )
      .map((node) => node.id);
    setSelectedIds(selected);
  };
  const selectedIdSet = createMemo(() => new Set(selectedIds()));
  const hasNodes = createMemo(() => graph.nodes.length > 0);
  const drawerNode = createMemo(() => {
    const id = drawerNodeId();
    if (!id) return null;
    return graph.nodes.find((node) => node.id === id) ?? null;
  });
  const nodeLookup = createMemo(() => {
    const map = new Map<string, CanvasNode>();
    graph.nodes.forEach((node) => map.set(node.id, node));
    return map;
  });
  const getRuleCount = (nodeId: string) => rules().filter((rule) => rule.sourceNodeId === nodeId).length;
  const ruleById = createMemo(() => {
    const map = new Map<string, RuleRecord>();
    rules().forEach((rule) => map.set(rule.id, rule));
    return map;
  });
  const rulesBySource = createMemo(() => {
    const map = new Map<string, RuleRecord>();
    rules().forEach((rule) => map.set(rule.sourceNodeId, rule));
    return map;
  });

  const allocationStatuses = createMemo<Map<string, NodeAllocationStatus>>(() => {
    const map = new Map<string, NodeAllocationStatus>();
    const allocatableNodes = graph.nodes.filter(
      (node) => node.kind === 'income' || node.kind === 'account' || node.kind === 'pod'
    );
    const totals = new Map<string, { total: number; hasRule: boolean }>();
    allocatableNodes.forEach((node) => totals.set(node.id, { total: 0, hasRule: false }));

    rules().forEach((rule) => {
      const entry = totals.get(rule.sourceNodeId);
      if (!entry) return;
      entry.hasRule = true;
      const sum = rule.allocations.reduce((acc, allocation) => acc + allocation.percentage, 0);
      entry.total += sum;
    });

    allocatableNodes.forEach((node) => {
      const entry = totals.get(node.id) ?? { total: 0, hasRule: false };
      let state: AllocationHealth = 'missing';
      if (!entry.hasRule) {
        state = 'missing';
      } else if (entry.total > 100 + ALLOCATION_TOLERANCE) {
        state = 'over';
      } else if (entry.total < 100 - ALLOCATION_TOLERANCE) {
        state = 'under';
      } else {
        state = 'complete';
      }
      map.set(node.id, { state, total: entry.total });
    });

    return map;
  });

  const incomingAllocationsMap = createMemo<Map<string, IncomingAllocationInfo[]>>(() => {
    const map = new Map<string, IncomingAllocationInfo[]>();
    
    rules().forEach((rule) => {
      const sourceNode = graph.nodes.find((n) => n.id === rule.sourceNodeId);
      if (!sourceNode) return;
      
      rule.allocations.forEach((alloc) => {
        const existing = map.get(alloc.targetNodeId) ?? [];
        existing.push({
          percentage: alloc.percentage,
          sourceLabel: sourceNode.label,
        });
        map.set(alloc.targetNodeId, existing);
      });
    });
    
    return map;
  });

  const allocationIssues = createMemo<AllocationIssue[]>(() => {
    const statuses = allocationStatuses();
    return graph.nodes
      .filter((node) => node.kind === 'income')
      .map((node) => {
        const status = statuses.get(node.id);
        return {
          nodeId: node.id,
          label: node.label,
          total: status?.total ?? 0,
          state: status?.state ?? 'missing',
        } satisfies AllocationIssue;
      })
      .filter((issue) => issue.state !== 'complete');
  });

  const {
    simulationSettings,
    simulationResult,
    simulationError,
    simulationMenuOpen,
    setSimulationMenuOpen,
    runSimulation,
    clearSimulation,
  } = useCanvasSimulation({
    collectNodes: () =>
      graph.nodes.map((node) => ({
        id: node.id,
        kind: node.kind,
        category: node.category,
        balance: typeof node.balance === 'number' ? node.balance : 0,
        inflow: node.inflow ?? null,
        returnRate: node.returnRate ?? getDefaultReturnRate(node),
      })),
    collectRules: () =>
      rules().map((rule) => ({
        sourceNodeId: rule.sourceNodeId,
        allocations: rule.allocations.map((alloc) => ({
          targetNodeId: alloc.targetNodeId,
          percentage: alloc.percentage,
        })),
      })),
    hasNodes: () => graph.nodes.length > 0,
    hasAllocationIssues: () => allocationIssues().length > 0,
  });

  const canSave = createMemo(
    () =>
      activeVariant() === 'sandbox' &&
      Boolean(workspaceSlug()) &&
      hasChanges() &&
      allocationIssues().length === 0 &&
      !saving(),
  );

  const saveDisabledReason = createMemo(() => {
    if (saving()) return null;
    if (activeVariant() !== 'sandbox') return 'Switch to the Sandbox to save changes.';
    if (!workspaceSlug()) return 'Select or create a workspace to save.';
    if (!hasChanges()) return 'No changes to save.';
    if (allocationIssues().length > 0) {
      return 'Complete allocation rules for all income sources to save.';
    }
    return null;
  });

  const describeFlow = (flow: CanvasFlow, source: CanvasNode, target: CanvasNode) => {
    const rule = flow.ruleId ? ruleById().get(flow.ruleId) : undefined;
    if (rule) {
      const allocations = rule.allocations
        .filter((alloc) => alloc.targetNodeId === target.id)
        .map((alloc) => `${alloc.percentage}%`);
      const allocationSegment = allocations.length ? ` (${allocations.join(', ')})` : '';
      return `Flow${allocationSegment} from ${source.label} to ${target.label}`;
    }
    return `Flow from ${source.label} to ${target.label}`;
  };

  onMount(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return (
        target.closest('input, textarea, [contenteditable="true"]') !== null ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA'
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        if (editingLocked()) return;
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') {
        if (editingLocked()) return;
        event.preventDefault();
        redo();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && (event.key === '=' || event.key === '+')) {
        event.preventDefault();
        viewportControls?.zoomIn();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === '-') {
        event.preventDefault();
        viewportControls?.zoomOut();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === '0') {
        event.preventDefault();
        viewportControls?.reset();
        return;
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedIds().length) {
        if (editingLocked()) return;
        event.preventDefault();
        deleteSelectedNodes();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
        if (editingLocked()) return;
        event.preventDefault();
        setCreateModal('income');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    void refreshWorkspacePair();

    onCleanup(() => {
      window.removeEventListener('keydown', handleKeyDown);
    });
  });

  const hydrateGraph = (data: any, options: { primeHistory?: boolean } = {}) => {
    const nodes = (data.nodes ?? []).map((node: any) => {
      const type = node.type ?? 'account';
      let kind: CanvasNode['kind'];
      switch (type) {
        case 'income':
          kind = 'income';
          break;
        case 'pod':
          kind = 'pod';
          break;
        case 'goal':
          kind = 'goal';
          break;
        case 'liability':
          kind = 'liability';
          break;
        default:
          kind = 'account';
      }
      const category = node.category ?? (type === 'liability' ? 'creditCard' : undefined);
      const metadata = (node.metadata ?? null) as Record<string, unknown> | null;
      const podType = metadata && typeof metadata.podType === 'string' ? (metadata.podType as CanvasPodType) : null;
      const inflowRaw = metadata && typeof metadata.inflow === 'object' ? (metadata.inflow as Partial<CanvasInflow>) : null;
      const inflow: CanvasInflow | null = inflowRaw && typeof inflowRaw.amount === 'number' && typeof inflowRaw.cadence === 'string'
        ? { amount: inflowRaw.amount, cadence: inflowRaw.cadence as CanvasInflowCadence }
        : null;
      const storedReturnRate = metadata && typeof metadata.returnRate === 'number' ? (metadata.returnRate as number) : undefined;
      const returnRate = storedReturnRate !== undefined ? storedReturnRate : getDefaultReturnRate({ kind, category, podType });

      return {
        id: String(node._id),
        kind,
        category,
        parentId: node.parentId ? String(node.parentId) : null,
        podType,
        label: node.label,
        icon: node.icon ?? undefined,
        accent: node.accent ?? undefined,
        balance: typeof node.balanceCents === 'number' ? node.balanceCents / 100 : undefined,
        inflow,
        returnRate,
        position: node.position,
        metadata,
      } satisfies CanvasNode;
    });

    const flows = (data.edges ?? []).map((edge: any) => ({
      id: String(edge._id),
      sourceId: String(edge.sourceNodeId),
      targetId: String(edge.targetNodeId),
      tag: edge.tag ?? undefined,
      amountCents: typeof edge.amountCents === 'number' ? edge.amountCents : undefined,
      note: edge.note ?? undefined,
      ruleId: edge.ruleId ? String(edge.ruleId) : undefined,
    } satisfies CanvasFlow));

    const allocationsByRule = new Map<string, any[]>();
    (data.allocations ?? []).forEach((alloc: any) => {
      const key = String(alloc.ruleId);
      if (!allocationsByRule.has(key)) allocationsByRule.set(key, []);
      allocationsByRule.get(key)!.push(alloc);
    });

  const ruleRecords: RuleRecord[] = (data.rules ?? []).map((rule: any) => ({
    id: String(rule._id),
    sourceNodeId: String(rule.sourceNodeId),
    trigger: rule.triggerType,
    triggerNodeId: rule.triggerNodeId ? String(rule.triggerNodeId) : null,
    allocations: (allocationsByRule.get(String(rule._id)) ?? []).map((alloc: any, index: number) => ({
      id: alloc._id ? String(alloc._id) : `${rule._id}-alloc-${index}`,
      targetNodeId: String(alloc.targetNodeId),
      percentage: alloc.percentage,
    })),
  }));

  setGraph('nodes', nodes);
  setGraph('flows', flows);
  setRules(ruleRecords);
  setShowHero(nodes.length === 0);
  setPlacementIndex(nodes.length);
  if (options.primeHistory) {
    const initialSelection = nodes.length ? [nodes[0].id] : [];
    replaceHistory({
      nodes,
      flows,
      rules: ruleRecords,
      selectedIds: initialSelection,
    });
    setSelectedIds(initialSelection);
  } else {
    setSelectedIds((current) => {
      const valid = current.filter((id) => nodes.some((node: CanvasNode) => node.id === id));
      if (valid.length > 0) return valid;
      return current.length ? current : nodes.length ? [nodes[0].id] : [];
    });
  }
  };

  createEffect(
    on(
      () => workspaceSlug(),
      (slug) => {
        if (!slug) {
          resetWorkspaceState();
          setLoading(false);
          return;
        }

        const slugSnapshot = slug;
        (async () => {
          if (!currentWorkspace() || currentWorkspace()?.slug !== slugSnapshot) {
            await refreshWorkspacePair();
            if (workspaceSlug() !== slugSnapshot) return;
          }
          await loadGraphForSlug(slugSnapshot, { primeHistory: true });
        })().catch((error) => {
          if (workspaceSlug() === slugSnapshot) {
            console.error('Failed to load workspace graph', error);
            setLoading(false);
          }
        });
      },
      { defer: true },
    ),
  );

  createEffect(
    on(
      () => activeHousehold()?._id,
      () => {
        void refreshWorkspacePair();
      },
      { defer: true },
    ),
  );

  createEffect(() => {
    const slug = workspaceSlug();
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (slug) {
      if (url.searchParams.get('workspace') !== slug) {
        url.searchParams.set('workspace', slug);
        window.history.replaceState(null, '', url.toString());
      }
    } else if (url.searchParams.has('workspace')) {
      url.searchParams.delete('workspace');
      window.history.replaceState(null, '', url.toString());
    }
  });

  createEffect(() => {
    if (!simulationMenuOpen()) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSimulationMenuOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    onCleanup(() => {
      document.removeEventListener('keydown', handleKeyDown);
    });
  });

  createEffect(() => {
    if (!actionsMenuOpen()) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActionsMenuOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    onCleanup(() => {
      document.removeEventListener('keydown', handleKeyDown);
    });
  });

  createEffect(() => {
    if (!drawerOpen()) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (drawerContainerRef?.contains(target as HTMLElement)) return;
      setDrawerNodeId(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawerNodeId(null);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    onCleanup(() => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    });
  });

  let viewportControls: ViewportControls | undefined;
  let viewportElement: HTMLDivElement | undefined;

  const livePositions = createMemo(() => {
    const state = dragState();
    if (!state) return null;
    const overrides = new Map<string, { x: number; y: number }>();
    const { delta, startPositions } = state;
    state.nodeIds.forEach((id) => {
      const start = startPositions[id];
      if (!start) return;
      overrides.set(id, {
        x: start.x + delta.x,
        y: start.y + delta.y,
      });
    });
    return overrides;
  });
  const accountNodes = createMemo(() =>
    graph.nodes.filter(
      (node) =>
        node.kind === 'account' && (node.category === 'checking' || node.category === 'savings')
    )
  );
  const accountOptions = createMemo(() =>
    accountNodes().map((node) => ({ id: node.id, label: node.label, category: node.category }))
  );
  const flows = createMemo(() => graph.flows);

  const ensureSelection = (nodeId: string, additive: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (additive) {
        if (next.has(nodeId)) next.delete(nodeId);
        else next.add(nodeId);
      } else {
        next.clear();
        next.add(nodeId);
      }
      return [...next];
    });
  };

  const clearSelection = () => {
    if (flowComposer().stage !== 'idle') {
      console.log('[flow] clearSelection cancels active flow');
      exitFlowMode();
      return;
    }
    setSelectedIds([]);
  };

  const handleNodeSelect = (event: PointerEvent, nodeId: string) => {
    const composer = flowComposer();
    if (composer.stage === 'pickTarget') {
      event.stopPropagation();
      event.preventDefault();
      if (composer.sourceNodeId === nodeId) {
        exitFlowMode();
        return;
      }
      completeFlow(nodeId);
      return;
    }
    if (composer.stage === 'pickSource') {
      event.stopPropagation();
      event.preventDefault();
      startFlowFromNode(nodeId, event);
      return;
    }
    const multiSelect = event.shiftKey || event.metaKey || event.ctrlKey;
    ensureSelection(nodeId, multiSelect);
  };

  const handleNodeOpenDrawer = (nodeId: string) => {
    ensureSelection(nodeId, false);
    setDrawerNodeId(nodeId);
  };

  const handleNodeContextMenu = (event: PointerEvent, nodeId: string) => {
    ensureSelection(nodeId, event.shiftKey || event.metaKey || event.ctrlKey);
    const rect = viewportElement?.getBoundingClientRect();
    const x = rect ? event.clientX - rect.left : event.clientX;
    const y = rect ? event.clientY - rect.top : event.clientY;
    setContextMenu({ nodeId, x, y });
  };

  const handleNodeDrag = async (payload: DragPayload) => {
    const { nodeId, delta, phase } = payload;
    if (phase === 'start') {
      let idsToMove = new Set(selectedIds());
      if (!idsToMove.has(nodeId)) {
        idsToMove = new Set([nodeId]);
        setSelectedIds([...idsToMove]);
      }
      const startPositions: Record<string, { x: number; y: number }> = {};
      idsToMove.forEach((id) => {
        const node = graph.nodes.find((n) => n.id === id);
        if (node) {
          startPositions[id] = { x: node.position.x, y: node.position.y };
        }
      });
      setDragState({ nodeIds: Array.from(idsToMove), startPositions, delta: { x: 0, y: 0 } });
      return;
    }

    const state = dragState();
    if (!state) return;

    if (phase === 'move') {
      setDragState((prev) => (prev ? { ...prev, delta: { x: delta.x, y: delta.y } } : prev));
      return;
    }

    if (phase === 'end') {
      const finalDelta = state.delta;
      let moved = false;
      state.nodeIds.forEach((id) => {
        const start = state.startPositions[id];
        if (!start) return;
        const nextPosition = {
          x: snapToGrid(start.x + finalDelta.x),
          y: snapToGrid(start.y + finalDelta.y),
        };
        const index = graph.nodes.findIndex((node) => node.id === id);
        if (index >= 0) {
          const current = graph.nodes[index].position;
          if (current.x !== nextPosition.x || current.y !== nextPosition.y) {
            moved = true;
            setGraph('nodes', index, 'position', nextPosition);
          }
        }
      });
      setDragState(null);
      if (moved) {
        pushHistory();
      }
    }
  };

  function translateClientToWorld(clientX: number, clientY: number) {
    if (!viewportElement) return null;
    const { scale, translate } = viewportState();
    const rect = viewportElement.getBoundingClientRect();
    const x = (clientX - rect.left - translate.x) / scale;
    const y = (clientY - rect.top - translate.y) / scale;
    return { x, y };
  }

  const handleMarqueeStart = (payload: {
    local: { x: number; y: number };
    world: { x: number; y: number };
  }) => {
    setMarquee({
      originLocal: payload.local,
      currentLocal: payload.local,
      originWorld: payload.world,
      currentWorld: payload.world,
    });
    setSelectedIds([]);
  };

  const handleMarqueeUpdate = (payload: {
    local: { x: number; y: number };
    world: { x: number; y: number };
  }) => {
    setMarquee((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        currentLocal: payload.local,
        currentWorld: payload.world,
      };
      updateSelectionFromMarquee(next.originWorld, next.currentWorld);
      return next;
    });
  };

  const handleMarqueeEnd = (payload: {
    local: { x: number; y: number };
    world: { x: number; y: number };
  }) => {
    setMarquee((prev) => {
      if (!prev) return null;
      updateSelectionFromMarquee(prev.originWorld, payload.world);
      return null;
    });
  };

  const marqueeOverlay = createMemo(() => {
    const data = marquee();
    if (!data) return null;
    const left = Math.min(data.originLocal.x, data.currentLocal.x);
    const top = Math.min(data.originLocal.y, data.currentLocal.y);
    const width = Math.abs(data.originLocal.x - data.currentLocal.x);
    const height = Math.abs(data.originLocal.y - data.currentLocal.y);
    return (
      <div
        class="pointer-events-none absolute rounded-2xl border-2 border-sky-400/70 bg-sky-400/10"
        style={{
          left: `${left}px`,
          top: `${top}px`,
          width: `${width}px`,
          height: `${height}px`,
        }}
      />
    );
  });

  createEffect(() => {
    if (!contextMenu()) return;
    const handleClick = () => setContextMenu(null);
    const handleContext = () => setContextMenu(null);
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('click', handleClick);
    window.addEventListener('contextmenu', handleContext);
    window.addEventListener('keydown', handleKey);
    onCleanup(() => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('contextmenu', handleContext);
      window.removeEventListener('keydown', handleKey);
    });
  });

  const handleViewportChange = (payload: { scale: number; translate: { x: number; y: number } }) => {
    setScalePercent(Math.round(payload.scale * 100));
  };

  const createNodeAtViewport = async (preset: {
    kind: CanvasNode['kind'];
    category?: CanvasNode['category'];
    parentId?: string | null;
    podType?: CanvasNode['podType'];
    label: string;
    icon: string;
    accent: string;
    balance?: number;
    inflow?: CanvasInflow | null;
    returnRate?: number;
    metadata?: CanvasNode['metadata'];
  }): Promise<string | undefined> => {
    const slug = workspaceSlug();
    if (!slug || editingLocked()) {
      return undefined;
    }
    if (!viewportElement) return undefined;
    if (graph.nodes.length === 0) {
      viewportControls?.reset();
    }
    const { scale, translate } = viewportState();
    const rect = viewportElement.getBoundingClientRect();
    const worldCenter = {
      x: (rect.width / 2 - translate.x) / scale,
      y: (rect.height / 2 - translate.y) / scale,
    };

    const placementCursor = placementIndex();
    const worldOrigin = {
      x: (-translate.x) / scale,
      y: (-translate.y) / scale,
    };
    const worldSize = {
      width: rect.width / scale,
      height: rect.height / scale,
    };
    const worldCenterX = worldOrigin.x + worldSize.width / 2;
    const margin = GRID_SIZE * 4;
    const minX = worldOrigin.x + margin;
    const maxX = worldOrigin.x + worldSize.width - margin - NODE_CARD_WIDTH;
    const minY = worldOrigin.y + margin;
    const maxY = worldOrigin.y + worldSize.height - margin - NODE_CARD_HEIGHT;
    const clampPosition = (x: number, y: number) => ({
      x: snapToGrid(Math.min(Math.max(x, minX), maxX)),
      y: snapToGrid(Math.min(Math.max(y, minY), maxY)),
    });

    const existingIncomeCount = graph.nodes.filter((node) => node.kind === 'income').length;
    const existingAccountCount = graph.nodes.filter(
      (node) =>
        (node.kind === 'account' && !node.parentId) ||
        node.kind === 'goal' ||
        node.kind === 'liability'
    ).length;

    let position = clampPosition(worldCenter.x - NODE_CARD_WIDTH / 2, worldCenter.y - NODE_CARD_HEIGHT / 2);

    if (preset.kind === 'income') {
      const indexForKind = existingIncomeCount;
      const perRow = Math.max(1, Math.min(3, Math.floor(worldSize.width / (NODE_CARD_WIDTH + GRID_SIZE * 4)) || 1));
      const col = indexForKind % perRow;
      const row = Math.floor(indexForKind / perRow);
      const spacingX = NODE_CARD_WIDTH + GRID_SIZE * 6;
      const spacingY = NODE_CARD_HEIGHT + GRID_SIZE * 5;
      const baseY = worldOrigin.y + worldSize.height * 0.18;
      const desiredX =
        worldCenterX + (col - (perRow - 1) / 2) * spacingX - NODE_CARD_WIDTH / 2;
      const desiredY = baseY + row * spacingY;
      position = clampPosition(desiredX, desiredY);
    } else if (
      preset.kind === 'account' ||
      preset.kind === 'goal' ||
      preset.kind === 'liability'
    ) {
      const indexForKind = existingAccountCount;
      const perRow = Math.max(1, Math.min(4, Math.floor(worldSize.width / (NODE_CARD_WIDTH + GRID_SIZE * 3)) || 1));
      const col = indexForKind % perRow;
      const row = Math.floor(indexForKind / perRow);
      const spacingX = NODE_CARD_WIDTH + GRID_SIZE * 4;
      const spacingY = NODE_CARD_HEIGHT + GRID_SIZE * 4;
      const baseY = worldOrigin.y + worldSize.height * 0.48;
      const desiredX =
        worldCenterX + (col - (perRow - 1) / 2) * spacingX - NODE_CARD_WIDTH / 2;
      const desiredY = baseY + row * spacingY;
      position = clampPosition(desiredX, desiredY);
    }

    if (preset.kind === 'pod' && preset.parentId) {
      const parent = graph.nodes.find((node) => node.id === preset.parentId);
      if (parent) {
        const siblingPods = graph.nodes.filter(
          (node) => node.kind === 'pod' && node.parentId === parent.id
        );
        const siblingCount = siblingPods.length;
        const podSpacingX = NODE_CARD_WIDTH + GRID_SIZE * 2;
        const rowSpacing = NODE_CARD_HEIGHT + GRID_SIZE * 3;
        const offsetMultiplier = Math.floor((siblingCount + 1) / 2);
        const direction = siblingCount % 2 === 0 ? 1 : -1;
        const offsetX = direction * offsetMultiplier * podSpacingX;
        const row = Math.floor(siblingCount / 2);
        const offsetY = (NODE_CARD_HEIGHT + GRID_SIZE * 4) + row * rowSpacing;
        const baseY = Math.max(
          parent.position.y + offsetY,
          worldOrigin.y + worldSize.height * 0.65
        );
        position = clampPosition(parent.position.x + offsetX, baseY);
      } else {
        const pods = graph.nodes.filter((node) => node.kind === 'pod');
        const indexForKind = pods.length;
        const perRow = Math.max(1, Math.min(4, Math.floor(worldSize.width / (NODE_CARD_WIDTH + GRID_SIZE * 3)) || 1));
        const col = indexForKind % perRow;
        const row = Math.floor(indexForKind / perRow);
        const spacingX = NODE_CARD_WIDTH + GRID_SIZE * 3;
        const spacingY = NODE_CARD_HEIGHT + GRID_SIZE * 3;
        const baseY = worldOrigin.y + worldSize.height * 0.75;
        const desiredX =
          worldCenterX + (col - (perRow - 1) / 2) * spacingX - NODE_CARD_WIDTH / 2;
        const desiredY = baseY + row * spacingY;
        position = clampPosition(desiredX, desiredY);
      }
    }

    if (
      preset.kind !== 'income' &&
      preset.kind !== 'account' &&
      preset.kind !== 'goal' &&
      preset.kind !== 'liability' &&
      !(preset.kind === 'pod' && preset.parentId)
    ) {
      const index = placementCursor;
      const columns = 2;
      const col = index % columns;
      const row = Math.floor(index / columns);
      const spacingX = NODE_CARD_WIDTH + GRID_SIZE * 2;
      const spacingY = NODE_CARD_HEIGHT + GRID_SIZE * 2;
      const fallbackX = worldCenter.x - NODE_CARD_WIDTH / 2 + col * spacingX;
      const fallbackY = worldCenter.y - NODE_CARD_HEIGHT / 2 + row * spacingY;
      position = clampPosition(fallbackX, fallbackY);
    }

    const newNodeId = `node-${createId()}`;
    const defaultReturnRate = preset.returnRate ?? getDefaultReturnRate({
      kind: preset.kind,
      category: preset.category,
      podType: preset.podType ?? null,
    });

    const baseMetadata: Record<string, unknown> = preset.metadata ? { ...preset.metadata } : {};
    if (preset.podType) baseMetadata.podType = preset.podType;
    if (preset.inflow) baseMetadata.inflow = preset.inflow;
    if (defaultReturnRate) baseMetadata.returnRate = defaultReturnRate;
    const metadata = Object.keys(baseMetadata).length ? baseMetadata : null;

    const newNode: CanvasNode = {
      id: newNodeId,
      kind: preset.kind,
      category: preset.category,
      parentId: preset.parentId ?? null,
      podType: preset.podType ?? null,
      label: preset.label,
      icon: preset.icon,
      accent: preset.accent,
      balance: preset.balance,
      inflow: preset.inflow ?? null,
      returnRate: defaultReturnRate,
      position,
      metadata,
    };

    setGraph('nodes', (nodes) => [...nodes, newNode]);
    setSelectedIds([newNode.id]);
    setShowHero(false);
    setPlacementIndex(placementCursor + 1);
    pushHistory();
    return newNodeId;
  };

  const handleAddIncome = () => {
    if (!workspaceSlug() || editingLocked()) return;
    setShowHero(false);
    setCreateModal('income');
  };

  const handleAddAccount = () => {
    if (!workspaceSlug() || editingLocked()) return;
    setShowHero(false);
    setCreateModal('account');
  };

  const handleAddPod = () => {
    if (!workspaceSlug() || editingLocked()) return;
    const available = accountNodes();
    if (available.length === 0) {
      handleAddAccount();
      return;
    }
    const selectedAccount = selectedIds().find((id) => available.some((node) => node.id === id));
    const parentId = selectedAccount ?? available[0].id;
    setPodParentId(parentId);
    setShowHero(false);
    setCreateModal('pod');
  };

  const handleStartFlow = () => {
    if (!workspaceSlug() || editingLocked()) return;
    const stage = flowComposer().stage;
    if (stage === 'pickSource') {
      exitFlowMode();
      return;
    }
    if (stage === 'pickTarget') {
      exitFlowMode();
    }
    enterFlowMode();
  };

  const duplicateNode = (nodeId: string) => {
    if (editingLocked()) return;
    const original = graph.nodes.find((node) => node.id === nodeId);
    if (!original) return;
    const position = {
      x: snapToGrid(original.position.x + GRID_SIZE * 2),
      y: snapToGrid(original.position.y + GRID_SIZE * 2),
    };
    const newNode: CanvasNode = {
      ...original,
      id: `node-${createId()}`,
      label: `${original.label} Copy`,
      position,
    };
    setGraph('nodes', (nodes) => [...nodes, newNode]);
    setSelectedIds([newNode.id]);
    pushHistory();
    setPlacementIndex((prev) => prev + 1);
  };

  const updateNodeBalance = (nodeId: string, balance: number | null) => {
    const index = graph.nodes.findIndex((node) => node.id === nodeId);
    if (index < 0) return;
    const current = graph.nodes[index];
    const normalized = typeof balance === 'number' ? balance : undefined;
    const existing = current.balance;
    const unchanged =
      (normalized === undefined && existing === undefined) ||
      (typeof normalized === 'number' && typeof existing === 'number' && Math.abs(existing - normalized) < 0.0001);
    if (unchanged) return;
    setGraph('nodes', index, (node) => ({
      ...node,
      balance: normalized,
    }));
    pushHistory();
  };

  const updateNodeInflow = (nodeId: string, inflow: CanvasInflow | null) => {
    const index = graph.nodes.findIndex((node) => node.id === nodeId);
    if (index < 0) return;
    const current = graph.nodes[index];
    const nextInflow = inflow ? { amount: inflow.amount, cadence: inflow.cadence } : null;
    const existing = current.inflow ?? null;
    const unchanged =
      (!existing && !nextInflow) ||
      (existing && nextInflow && Math.abs(existing.amount - nextInflow.amount) < 0.0001 && existing.cadence === nextInflow.cadence);
    if (unchanged) return;
    const metadata = { ...(current.metadata ?? {}) } as Record<string, unknown>;
    if (nextInflow) metadata.inflow = nextInflow;
    else delete metadata.inflow;
    const normalizedMetadata = Object.keys(metadata).length ? metadata : null;
    setGraph('nodes', index, (node) => ({
      ...node,
      inflow: nextInflow,
      metadata: normalizedMetadata,
    }));
    pushHistory();
  };

  const updateNodePodType = (nodeId: string, podType: CanvasPodType) => {
    const index = graph.nodes.findIndex((node) => node.id === nodeId);
    if (index < 0) return;
    const current = graph.nodes[index];
    if (current.podType === podType) return;
    const metadata = { ...(current.metadata ?? {}) } as Record<string, unknown>;
    metadata.podType = podType;
    const normalizedMetadata = Object.keys(metadata).length ? metadata : null;
    setGraph('nodes', index, (node) => ({
      ...node,
      podType,
      metadata: normalizedMetadata,
    }));
    pushHistory();
  };

  const updateNodeReturnRate = (nodeId: string, returnRate: number | null) => {
    const index = graph.nodes.findIndex((node) => node.id === nodeId);
    if (index < 0) return;
    const current = graph.nodes[index];
    const override = returnRate !== null ? returnRate : undefined;
    const baseRate = override !== undefined ? override : getDefaultReturnRate(current);
    const existing = current.returnRate ?? getDefaultReturnRate(current);
    const unchanged =
      Math.abs(existing - baseRate) < 0.0001;
    if (unchanged) return;
    const metadata = { ...(current.metadata ?? {}) } as Record<string, unknown>;
    if (override !== undefined) metadata.returnRate = override;
    else delete metadata.returnRate;
    const normalizedMetadata = Object.keys(metadata).length ? metadata : null;
    setGraph('nodes', index, (node) => ({
      ...node,
      returnRate: baseRate,
      metadata: normalizedMetadata,
    }));
    pushHistory();
  };

  const deleteNode = (nodeId: string, options: { skipHistory?: boolean } = {}) => {
    if (editingLocked()) return;
    setGraph('nodes', (nodes) => {
      const filtered = nodes.filter((node) => node.id !== nodeId);
      if (filtered.length === 0) setShowHero(true);
      if (filtered.length === 0) {
        setPlacementIndex(0);
      }
      return filtered;
    });
    setGraph('flows', (flows) => flows.filter((flow) => flow.sourceId !== nodeId && flow.targetId !== nodeId));
    setRules((existing) =>
      existing
        .map((rule) => {
          if (rule.sourceNodeId === nodeId) return null;

          const allocations = rule.allocations.filter((alloc) => alloc.targetNodeId !== nodeId);
          if (allocations.length === 0) return null;

          const triggerNodeId = rule.triggerNodeId === nodeId ? rule.sourceNodeId : rule.triggerNodeId;

          return {
            ...rule,
            triggerNodeId,
            allocations,
          };
        })
        .filter((value): value is RuleRecord => Boolean(value))
    );
    setSelectedIds((ids) => ids.filter((id) => id !== nodeId));
    if (drawerNodeId() === nodeId) {
      setDrawerNodeId(null);
    }
    if (!options.skipHistory) {
      pushHistory();
    }
  };

  const handleContextMenuAction = (action: 'details' | 'duplicate' | 'delete') => {
    const menu = contextMenu();
    if (!menu) return;
    if (editingLocked() && action !== 'details') return;
    if (action === 'details') {
      handleNodeOpenDrawer(menu.nodeId);
    } else if (action === 'duplicate') {
      duplicateNode(menu.nodeId);
    } else {
      deleteNode(menu.nodeId);
    }
    setContextMenu(null);
  };

  const deleteSelectedNodes = () => {
    if (editingLocked()) return;
    const ids = selectedIds();
    if (!ids.length) return;
    ids.forEach((id) => deleteNode(id, { skipHistory: true }));
    setSelectedIds([]);
    setContextMenu(null);
    pushHistory();
  };

  const drawerOpen = createMemo(() => Boolean(drawerNode()));
  const simulationPanelOpen = createMemo(() => Boolean(simulationResult()));

  const handleSave = async () => {
    const slug = workspaceSlug();
    if (!slug || saving() || !hasChanges()) return;
    if (activeVariant() !== 'sandbox') {
      console.warn('Cannot save changes while viewing Money Map.');
      return;
    }
    if (editingLocked()) {
      console.warn('Sandbox is currently locked.');
      return;
    }
    if (allocationIssues().length > 0) {
      console.warn('Cannot save until all income allocations total 100%.');
      return;
    }
    setSaving(true);
    try {
      const result = await publishGraph(slug, {
        nodes: graph.nodes,
        flows: graph.flows,
        rules: rules(),
      });

      const nodeMap = new Map<string, string>(Object.entries(result.nodes ?? {}));
      const ruleMap = new Map<string, string>(Object.entries(result.rules ?? {}));
      const edgeMap = new Map<string, string>(Object.entries(result.edges ?? {}));

      setGraph('nodes', (nodes) =>
        nodes.map((node) => {
          const newId = nodeMap.get(node.id);
          return newId ? { ...node, id: newId } : node;
        })
      );

      setGraph('flows', (flows) =>
        flows.map((flow) => {
          const newId = edgeMap.get(flow.id);
          return {
            ...flow,
            id: newId ?? flow.id,
            sourceId: nodeMap.get(flow.sourceId) ?? flow.sourceId,
            targetId: nodeMap.get(flow.targetId) ?? flow.targetId,
            ruleId: flow.ruleId ? ruleMap.get(flow.ruleId) ?? flow.ruleId : flow.ruleId,
          };
        })
      );

      setRules((existing) =>
        existing.map((rule) => ({
          ...rule,
          id: ruleMap.get(rule.id) ?? rule.id,
          sourceNodeId: nodeMap.get(rule.sourceNodeId) ?? rule.sourceNodeId,
          triggerNodeId: rule.triggerNodeId
            ? nodeMap.get(rule.triggerNodeId) ?? rule.triggerNodeId
            : rule.triggerNodeId,
          allocations: rule.allocations.map((alloc) => ({
            id: alloc.id,
            targetNodeId: nodeMap.get(alloc.targetNodeId) ?? alloc.targetNodeId,
            percentage: alloc.percentage,
          })),
        }))
      );

      setSelectedIds((ids) => ids.map((id) => nodeMap.get(id) ?? id));
      setPlacementIndex(graph.nodes.length);
      setShowHero(graph.nodes.length === 0);
      replaceHistory(snapshotGraph());
      await refreshWorkspacePair();
      toast.success('Sandbox changes saved.');
    } catch (error) {
      console.error('Failed to save graph', error);
      toast.error('Unable to save the sandbox.');
    } finally {
      setSaving(false);
    }
  };

  const handleExit = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div
      class="relative h-full w-full"
      classList={{ 'pr-[360px]': drawerOpen(), 'pl-[360px]': simulationPanelOpen() }}
    >
      <div class="pointer-events-none absolute left-6 top-6 z-40 flex items-center gap-2">
        <Show
          when={!initializingWorkspace()}
          fallback={
            <span class="pointer-events-auto rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 shadow-sm">
              Loading…
            </span>
          }
        >
          <div class="pointer-events-auto flex flex-wrap items-center gap-3 rounded-full border border-slate-200/70 bg-white/85 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur">
            <span class="flex items-center gap-2 text-sm text-slate-800">
              {currentWorkspace()?.name ?? 'Workspace'}
              <Show when={activeVariant() === 'sandbox'}>
                <span
                  class={clsx(
                    sandboxStatusClass(),
                    'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]'
                  )}
                >
                  {sandboxStatusLabel()}
                </span>
              </Show>
              <Show when={activeVariant() === 'live'}>
                <span class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                  View Only
                </span>
              </Show>
            </span>
            <div class="flex items-center gap-2">
              <Button type="button" variant="secondary" size="xs" onClick={handleShareWorkspace}>
                Share
              </Button>
              <Show when={activeVariant() === 'sandbox'}>
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  class="rounded-full"
                  disabled={!canResetSandbox() || saving() || resetting()}
                  onClick={() => setResetConfirmOpen(true)}
                >
                  Reset
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="xs"
                  class="rounded-full"
                  disabled={!canApplySandbox() || saving() || applying()}
                  onClick={() => setApplyConfirmOpen(true)}
                >
                  {applying() ? 'Applying…' : 'Apply'}
                </Button>
              </Show>
            </div>
            <Show when={activeVariant() === 'sandbox' && sandboxStatus() === 'stale'}>
              <span class="w-full text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-600">
                Money Map changed since last reset
              </span>
            </Show>
          </div>
        </Show>
      </div>
      <CanvasViewport
        nodes={graph.nodes}
        positions={livePositions()}
        flows={flows()}
        selectedNodeIds={selectedIdSet()}
        onBackgroundPointerDown={clearSelection}
        onViewportChange={(payload) => {
          setViewportState(payload);
          handleViewportChange(payload);
        }}
        onControlsReady={(controls) => {
          viewportControls = controls;
        }}
        onContainerReady={(element) => {
          viewportElement = element;
        }}
        onNodeSelect={handleNodeSelect}
        onNodeDrag={handleNodeDrag}
        onConnectionStart={handleFlowStartFromAnchor}
        onConnectionTargetSelect={handleFlowTargetSelect}
        onNodeOpenDrawer={handleNodeOpenDrawer}
        onNodeContextMenu={handleNodeContextMenu}
        onMarqueeStart={handleMarqueeStart}
        onMarqueeUpdate={handleMarqueeUpdate}
        onMarqueeEnd={handleMarqueeEnd}
        getRuleCount={getRuleCount}
        describeFlow={describeFlow}
        connectingFrom={connectingFrom()}
        hoveredAnchor={hoveredAnchor()}
        connectionMode={flowComposer().stage === 'pickTarget'}
        selectionOverlay={marqueeOverlay()}
        allocationStatuses={allocationStatuses()}
        incomingAllocations={incomingAllocationsMap()}
      >
        {connectingPreview()}
      </CanvasViewport>
      <Show when={editingLocked()}>
        <div class="pointer-events-none absolute inset-0 z-30 bg-white/30 backdrop-blur-sm">
          <div class="pointer-events-auto absolute left-1/2 top-8 w-max -translate-x-1/2 rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-slate-700 shadow">
            {activeVariant() === 'live'
              ? 'Money Map is view-only. Switch to Sandbox to make changes.'
              : 'Sandbox changes are pending approval.'}
          </div>
        </div>
      </Show>
      <Show when={!loading() && showHero() && !hasNodes()}>
        <div class="absolute inset-0 pointer-events-none">
          <div class="pointer-events-auto h-full w-full">
            <EmptyHero
              onCreate={() => {
                if (!workspaceSlug()) {
                  void refreshWorkspacePair();
                  return;
                }
                if (editingLocked()) return;
                setShowHero(false);
                setCreateModal('income');
              }}
            />
          </div>
        </div>
      </Show>
      <div class="pointer-events-none absolute right-6 top-6 z-10 flex flex-col items-end gap-1.5">
        <div class="pointer-events-auto flex items-center gap-2">
          <Show when={simulationError()}>
            {(message) => (
              <span class="pointer-events-auto rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-600 shadow-sm">
                {message()}
              </span>
            )}
          </Show>
          <DropdownMenu open={simulationMenuOpen()} onOpenChange={setSimulationMenuOpen}>
            <DropdownMenuTrigger
              as="button"
              type="button"
              class="h-8 flex items-center gap-1.5 rounded-full border border-slate-200/60 bg-white/80 px-3 text-xs font-medium text-slate-600 shadow-sm hover:border-slate-300 hover:bg-white/90 hover:text-slate-800 backdrop-blur-sm disabled:cursor-not-allowed"
            >
              ▶ Simulate
              <ChevronDownIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent class="w-56">
              <div class="py-1">
                <For each={[5, 10, 20, 30, 40, 50]}>
                  {(years) => (
                    <DropdownMenuItem
                      class="px-4 py-3 text-sm font-semibold text-slate-700"
                      onSelect={() => runSimulation(years)}
                    >
                      {years} Years
                    </DropdownMenuItem>
                  )}
                </For>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu open={actionsMenuOpen()} onOpenChange={setActionsMenuOpen}>
            <DropdownMenuTrigger
              as="button"
              type="button"
              class="h-8 flex items-center gap-1.5 rounded-full border border-slate-200/60 bg-white/80 px-3 text-xs font-medium text-slate-600 shadow-sm hover:border-slate-300 hover:bg-white/90 hover:text-slate-800 backdrop-blur-sm disabled:cursor-not-allowed"
            >
              Actions
              <ChevronDownIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent class="w-60">
              <DropdownMenuLabel>Sandbox</DropdownMenuLabel>
              <DropdownMenuItem
                class="px-3 py-2 text-sm font-semibold text-slate-700"
                disabled={activeVariant() !== 'sandbox' || !canSave()}
                onSelect={() => {
                  if (activeVariant() !== 'sandbox' || !canSave()) return;
                  setActionsMenuOpen(false);
                  void handleSave();
                }}
              >
                <SaveIcon />
                <span>{saving() ? 'Saving…' : 'Save Sandbox'}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                class="px-3 py-2 text-sm font-semibold text-slate-700"
                disabled={activeVariant() !== 'sandbox' || !canApplySandbox() || applying()}
                onSelect={() => {
                  if (activeVariant() !== 'sandbox' || !canApplySandbox() || applying()) return;
                  setActionsMenuOpen(false);
                  setApplyConfirmOpen(true);
                }}
              >
                <DuplicateIcon />
                <span>{applying() ? 'Applying…' : 'Apply to Money Map'}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                class="px-3 py-2 text-sm font-semibold text-slate-700"
                disabled={activeVariant() !== 'sandbox' || !canResetSandbox() || resetting()}
                onSelect={() => {
                  if (activeVariant() !== 'sandbox' || !canResetSandbox() || resetting()) return;
                  setActionsMenuOpen(false);
                  setResetConfirmOpen(true);
                }}
              >
                <DeleteIcon />
                <span>{resetting() ? 'Resetting…' : 'Reset Sandbox'}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                class="px-3 py-2 text-sm font-semibold text-slate-700"
                onSelect={() => {
                  setActionsMenuOpen(false);
                  void handleShareWorkspace();
                }}
              >
                <ShareIcon />
                <span>Share</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                class="px-3 py-2 text-sm font-semibold text-slate-700"
                onSelect={() => {
                  setActionsMenuOpen(false);
                  handleExit();
                }}
              >
                <ExitIcon />
                <span>Exit</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Show when={shareStatus()}>
          {(status) => (
            <span
              class="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white shadow-floating"
              classList={{
                'bg-emerald-500': status() === 'copied',
                'bg-rose-500': status() === 'error',
              }}
            >
              {status() === 'copied' ? 'Link copied to clipboard' : 'Unable to copy link'}
            </span>
          )}
        </Show>
        <Show when={actionsMenuOpen() ? saveDisabledReason() : null}>
          {(message) => (
            <span class="max-w-xs rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-600 shadow-floating">
              {message()}
            </span>
          )}
        </Show>
      </div>
      <Show when={contextMenu()}>
        {(menu) => (
          <div class="absolute z-30" style={{ left: `${menu().x}px`, top: `${menu().y}px` }}>
            <NodeContextMenu
              onOpenDrawer={() => handleContextMenuAction('details')}
              onDuplicate={() => handleContextMenuAction('duplicate')}
              onDelete={() => handleContextMenuAction('delete')}
            />
          </div>
        )}
      </Show>
      <div
        class="absolute right-0 top-0 z-40 h-full w-[360px]"
        classList={{ 'pointer-events-none': !drawerOpen() }}
      >
        <Motion.div
          class="h-full border-l border-slate-200/70 bg-white shadow-xl"
          initial={{ x: 360, opacity: 0 }}
          animate={{ x: drawerOpen() ? 0 : 360, opacity: drawerOpen() ? 1 : 0.4 }}
          transition={{ duration: 0.2, easing: [0.16, 1, 0.3, 1] }}
          ref={(el) => (drawerContainerRef = el)}
        >
          <Show when={drawerNode()}>
            {(node) => (
              (() => {
                const selected = node();
                const lookup = nodeLookup();
                const outbound = flows()
                  .filter((flow) => flow.sourceId === selected.id)
          .map((flow) => ({
            id: flow.id,
            partnerNodeId: flow.targetId,
            partnerLabel: lookup.get(flow.targetId)?.label ?? 'Unknown',
            hasRule: Boolean(flow.ruleId),
            tag: flow.tag,
          }));
                    const inbound = flows()
                      .filter((flow) => flow.targetId === selected.id)
                      .map((flow) => ({
                        id: flow.id,
                        partnerNodeId: flow.sourceId,
                        partnerLabel: lookup.get(flow.sourceId)?.label ?? 'Unknown',
                        hasRule: Boolean(flow.ruleId),
                        tag: flow.tag,
                      }));
                const rule = rulesBySource().get(selected.id) ?? null;
                const allocationDetails = rule
                  ? rule.allocations.map((alloc) => ({
                      id: alloc.id,
                      percentage: alloc.percentage,
                      targetLabel: lookup.get(alloc.targetNodeId)?.label ?? 'Unknown',
                      targetNodeId: alloc.targetNodeId,
                    }))
                  : [];
                const allocationStatus = allocationStatuses().get(selected.id) ?? null;
                return (
                  <NodeDrawer
                    open={drawerOpen()}
                    node={node()}
                    nodes={graph.nodes}
                    onClose={() => setDrawerNodeId(null)}
                    outbound={outbound}
                    inbound={inbound}
                    allocations={allocationDetails}
                    allocationStatus={allocationStatus}
                    initialRule={rule}
                    onSaveRule={(ruleDraft) => {
                      const fallbackId = `rule-${createId()}`;
                      const ruleId = ruleDraft.id ?? rulesBySource().get(ruleDraft.sourceNodeId)?.id ?? fallbackId;
                      const record: RuleRecord = {
                        id: ruleId,
                        sourceNodeId: ruleDraft.sourceNodeId,
                        trigger: ruleDraft.trigger,
                        triggerNodeId: ruleDraft.triggerNodeId ?? ruleDraft.sourceNodeId,
                        allocations: ruleDraft.allocations.map((alloc) => ({ ...alloc })),
                      };
                      setRules((existing) => [
                        ...existing.filter((r) => r.sourceNodeId !== ruleDraft.sourceNodeId),
                        record,
                      ]);
                      setGraph('flows', (flows) => {
                        const targets = new Set(ruleDraft.allocations.map((alloc) => alloc.targetNodeId));
                        const next = flows
                          .map((flow) => {
                            if (flow.sourceId !== ruleDraft.sourceNodeId) return flow;
                            if (targets.has(flow.targetId)) {
                              return {
                                ...flow,
                                ruleId,
                                tag: flow.tag ?? 'Flow',
                              };
                            }
                            if (flow.ruleId === ruleId) {
                              return null;
                            }
                            return flow.ruleId ? null : flow;
                          })
                          .filter((flow): flow is CanvasFlow => flow !== null);

                        targets.forEach((targetId) => {
                          const existingFlow = next.find(
                            (flow) => flow.sourceId === ruleDraft.sourceNodeId && flow.targetId === targetId,
                          );
                          if (!existingFlow) {
                            next.push({
                              id: `flow-${createId()}`,
                              sourceId: ruleDraft.sourceNodeId,
                              targetId,
                              ruleId,
                              tag: 'Flow',
                            });
                          }
                        });

                        return next;
                      });
                      pushHistory();
                    }}
                    onUpdateBalance={updateNodeBalance}
                    onUpdateInflow={updateNodeInflow}
                    onUpdatePodType={updateNodePodType}
                    onUpdateReturnRate={updateNodeReturnRate}
                  />
                );
              })()
            )}
          </Show>
        </Motion.div>
      </div>
      <BottomDock
        onAddIncome={handleAddIncome}
        onAddAccount={handleAddAccount}
        onAddPod={handleAddPod}
        onStartFlow={handleStartFlow}
      />
      <ZoomPad
        zoomPercent={scalePercent()}
        onZoomIn={() => viewportControls?.zoomIn()}
        onZoomOut={() => viewportControls?.zoomOut()}
        onReset={() => viewportControls?.reset()}
      />
      <SimulationPanel
        open={simulationPanelOpen}
        result={simulationResult}
        settings={simulationSettings}
        horizonOptions={simulationHorizonOptions}
        onRun={runSimulation}
        onClose={clearSimulation}
        getNodeLabel={(id) => nodeLookup().get(id)?.label ?? 'Unknown node'}
      />
      <IncomeSourceModal
        open={createModal() === 'income'}
        onClose={() => setCreateModal(null)}
        onSubmit={async ({ name, startingBalance, inflow }) => {
          const metadata = inflow ? { inflow } : undefined;
          const id = await createNodeAtViewport({
            kind: 'income',
            label: name,
            icon: '🏦',
            accent: '#2563eb',
            balance: startingBalance ?? undefined,
            inflow,
            metadata,
          });
          if (id) setDrawerNodeId(id);
        }}
      />
      <PodModal
        open={createModal() === 'pod'}
        accounts={accountOptions()}
        defaultAccountId={podParentId()}
        onClose={() => {
          setCreateModal(null);
          setPodParentId(null);
        }}
        onSubmit={async ({ name, parentAccountId, podType, startingBalance }) => {
          const id = await createNodeAtViewport({
            kind: 'pod',
            label: name,
            icon: '💰',
            accent: '#0ea5e9',
            parentId: parentAccountId,
            podType,
            balance: startingBalance ?? undefined,
          });
          setPodParentId(parentAccountId);
          if (id) setDrawerNodeId(id);
        }}
      />
      <AccountTypeModal
        open={createModal() === 'account'}
        onClose={() => setCreateModal(null)}
        onSubmit={async (option: AccountOption) => {
          const id = await createNodeAtViewport({
            kind: 'account',
            category: option.category,
            label: option.label,
            icon: option.icon,
            accent: option.accent,
          });
          if (id) setDrawerNodeId(id);
        }}
      />
      <Dialog open={resetConfirmOpen()} onOpenChange={setResetConfirmOpen}>
        <DialogContent class="max-w-md">
          <DialogHeader class="gap-2 text-left">
            <DialogTitle>Reset sandbox</DialogTitle>
            <DialogDescription>
              Replace sandbox data with your current Money Map. This cannot be undone and any in-progress sandbox work will be removed.
            </DialogDescription>
          </DialogHeader>
          <div class="flex flex-col gap-2 text-xs text-slate-500 md:text-sm">
            <p>
              Resetting keeps the sandbox aligned with live data before you start a fresh iteration. You can always rebuild changes after the reset.
            </p>
          </div>
          <div class="mt-4 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setResetConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              class="shadow-floating"
              disabled={resetting()}
              onClick={() => void handleResetSandbox()}
            >
              {resetting() ? 'Resetting…' : 'Reset sandbox'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={applyConfirmOpen()} onOpenChange={setApplyConfirmOpen}>
        <DialogContent class="max-w-md">
          <DialogHeader class="gap-2 text-left">
            <DialogTitle>Apply to Money Map</DialogTitle>
            <DialogDescription>
              Publish sandbox changes to the live Money Map. Once applied, live accounts, automations, and shared members will see the updates instantly.
            </DialogDescription>
          </DialogHeader>
          <div class="flex flex-col gap-2 text-xs text-slate-500 md:text-sm">
            <p>Make sure the sandbox is ready for prime time before applying—this action overwrites the live graph.</p>
          </div>
          <div class="mt-4 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setApplyConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              class="shadow-floating"
              disabled={applying()}
              onClick={() => void handleApplySandbox()}
            >
              {applying() ? 'Applying…' : 'Apply changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={approvalConfirmOpen()} onOpenChange={setApprovalConfirmOpen}>
        <DialogContent>
          <DialogHeader class="gap-2 text-left">
            <DialogTitle>Sent for approval</DialogTitle>
            <DialogDescription>
              Your sandbox updates need a guardian review. We’ll let you know once the Money Map is updated.
            </DialogDescription>
          </DialogHeader>
          <div class="flex justify-end">
            <Button type="button" onClick={() => setApprovalConfirmOpen(false)}>
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CanvasPage;
