import { Component, For, Match, Show, Switch, createEffect, createMemo, createSignal, onCleanup, onMount, on } from 'solid-js';
import { Motion } from 'solid-motionone';
import { createStore } from 'solid-js/store';
import CanvasViewport, { DragPayload, ViewportControls } from '../components/canvas/CanvasViewport';
import type { NodeAllocationStatus } from '../components/canvas/NodeCard';
import { CanvasFlow, CanvasNode, CanvasInflow, CanvasInflowCadence, CanvasPodType } from '../types/graph';
import { simulateGraph, type SimulationResult } from '../utils/simulation';
import BottomDock from '../components/layout/BottomDock';
import ZoomPad from '../components/layout/ZoomPad';
import { AnchorType, NODE_CARD_HEIGHT, NODE_CARD_WIDTH } from '../components/canvas/NodeCard';
import { buildEdgePath, getAnchorPoint } from '../components/canvas/EdgeLayer';
import EmptyHero from '../components/empty/EmptyHero';
import NodeContextMenu from '../components/nodes/NodeContextMenu';
import NodeDrawer from '../components/nodes/NodeDrawer';
import IncomeSourceModal from '../components/create/IncomeSourceModal';
import PodModal from '../components/create/PodModal';
import AccountTypeModal, { AccountOption } from '../components/create/AccountTypeModal';
import RuleDrawer from '../components/rules/RuleDrawer';
import Modal from '../components/ui/Modal';
import {
  ensureWorkspace,
  fetchGraph,
  publishGraph,
  listWorkspaces,
  deleteWorkspace,
  type WorkspaceRecord,
} from '../services/graphClient';

const GRID_SIZE = 28;
const snapToGrid = (value: number) => Math.round(value / GRID_SIZE) * GRID_SIZE;

type Snapshot = {
  nodes: CanvasNode[];
  flows: CanvasFlow[];
  rules: RuleRecord[];
  selectedIds: string[];
};

const HISTORY_CAP = 50;

const WORKSPACE_STORAGE_KEY = 'guap:workspace-slug';

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

type FlowComposerState =
  | { stage: 'idle' }
  | { stage: 'pickSource' }
  | {
      stage: 'pickTarget';
      sourceNodeId: string;
      sourcePoint: { x: number; y: number };
      cursorPoint: { x: number; y: number };
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

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const formatMonths = (value: number | null) => {
  if (value === null) return 'Not reached';
  if (value === 0) return 'Now';
  const years = Math.floor(value / 12);
  const months = value % 12;
  const yearSegment = years > 0 ? `${years} yr${years === 1 ? '' : 's'}` : '';
  const monthSegment = months > 0 ? `${months} mo${months === 1 ? '' : 's'}` : '';
  return [yearSegment, monthSegment].filter(Boolean).join(' ').trim();
};

const CanvasPage: Component = () => {
  const [workspaces, setWorkspaces] = createSignal<WorkspaceRecord[]>([]);
  const [workspaceSlug, setWorkspaceSlug] = createSignal<string | null>(null);
  const [workspaceModal, setWorkspaceModal] = createSignal<'create' | 'delete' | null>(null);
  const [workspaceDraftName, setWorkspaceDraftName] = createSignal('');
  const [workspaceToDelete, setWorkspaceToDelete] = createSignal<WorkspaceRecord | null>(null);
  const [initializingWorkspace, setInitializingWorkspace] = createSignal(true);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = createSignal(false);
  let workspaceMenuRef: HTMLDivElement | undefined;
let workspaceMenuButtonRef: HTMLButtonElement | undefined;
let drawerContainerRef: HTMLDivElement | undefined;

  const [graph, setGraph] = createStore<{ nodes: CanvasNode[]; flows: CanvasFlow[] }>({
    nodes: [],
    flows: [],
  });
  const [selectedIds, setSelectedIds] = createSignal<string[]>([]);
  const [scalePercent, setScalePercent] = createSignal(100);
  const [dragState, setDragState] = createSignal<DragState | null>(null);
  const [viewportState, setViewportState] = createSignal({ scale: 1, translate: { x: 0, y: 0 } });
  const [flowComposer, setFlowComposer] = createSignal<FlowComposerState>({ stage: 'idle' });
  const [hoveredAnchor, setHoveredAnchor] = createSignal<{ nodeId: string; anchor: AnchorType } | null>(
    null
  );
  const [drawerNodeId, setDrawerNodeId] = createSignal<string | null>(null);
  const [contextMenu, setContextMenu] = createSignal<{ nodeId: string; x: number; y: number } | null>(
    null
  );
  const [createModal, setCreateModal] = createSignal<'income' | 'pod' | 'account' | null>(null);
  const [podParentId, setPodParentId] = createSignal<string | null>(null);
  const [ruleDrawer, setRuleDrawer] = createSignal<{ sourceNodeId: string } | null>(null);
  const [rules, setRules] = createSignal<RuleRecord[]>([]);
  const [showHero, setShowHero] = createSignal(true);
  const [saving, setSaving] = createSignal(false);
  const [loading, setLoading] = createSignal(true);
  const [history, setHistory] = createSignal<Snapshot[]>([]);
  const [historyIndex, setHistoryIndex] = createSignal(-1);
  const [simulationSettings, setSimulationSettings] = createSignal({ horizonYears: 10 });
  const [simulationResult, setSimulationResult] = createSignal<SimulationResult | null>(null);
  const [simulationError, setSimulationError] = createSignal<string | null>(null);
  const [simulationMenuOpen, setSimulationMenuOpen] = createSignal(false);
  let simulationMenuRef: HTMLDivElement | undefined;
  let simulationButtonRef: HTMLButtonElement | undefined;
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
  const [hasChanges, setHasChanges] = createSignal(false);
  const currentWorkspace = createMemo(() => {
    const slug = workspaceSlug();
    return workspaces().find((item) => item.slug === slug) ?? null;
  });

  const resetWorkspaceState = () => {
    setGraph('nodes', () => []);
    setGraph('flows', () => []);
    setRules([]);
    setSelectedIds([]);
    setDrawerNodeId(null);
    setRuleDrawer(null);
    setMarquee(null);
    exitFlowMode();
    setPlacementIndex(0);
    setHistory([]);
    setHistoryIndex(-1);
    setHasChanges(false);
    setShowHero(true);
  };

  const loadWorkspaces = async () => {
    const list = await listWorkspaces();
    setWorkspaces(list);
    return list;
  };

  const openCreateWorkspace = () => {
    setWorkspaceDraftName('');
    setWorkspaceMenuOpen(false);
    setWorkspaceModal('create');
  };

  const handleWorkspaceCreate = async (event: Event) => {
    event.preventDefault();
    const name = workspaceDraftName().trim() || 'Untitled Workspace';
    const slug = `workspace-${createId()}`;

    await ensureWorkspace(slug, name);
    await loadWorkspaces();
    setWorkspaceSlug(slug);
    setWorkspaceModal(null);
    setWorkspaceDraftName('');
    setWorkspaceMenuOpen(false);
  };

  const handleWorkspaceDelete = async () => {
    const workspace = workspaceToDelete();
    if (!workspace) return;

    await deleteWorkspace(workspace._id);
    const list = await loadWorkspaces();
    const currentSlugValue = workspaceSlug();
    if (currentSlugValue === workspace.slug) {
      const nextSlug = list[0]?.slug ?? null;
      setWorkspaceSlug(nextSlug);
    }

    setWorkspaceToDelete(null);
    setWorkspaceModal(null);

    if (list.length === 0) {
      openCreateWorkspace();
    }

    setWorkspaceMenuOpen(false);
  };

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

  const replaceHistory = (snap: Snapshot) => {
    const clone = cloneSnapshot(snap);
    setHistory([clone]);
    setHistoryIndex(0);
    setHasChanges(false);
  };

  const pushHistory = (snap?: Snapshot) => {
    const snapshot = snap ? cloneSnapshot(snap) : snapshotGraph();
    setHistory((current) => {
      const currentIndex = historyIndex();
      const trimmed = current.slice(0, currentIndex + 1);
      const updated = [...trimmed, snapshot];
      const limited =
        updated.length > HISTORY_CAP ? updated.slice(updated.length - HISTORY_CAP) : updated;
      setHistoryIndex(limited.length - 1);
      return limited;
    });
    setHasChanges(true);
  };

  const applySnapshot = (snap: Snapshot) => {
    const clone = cloneSnapshot(snap);
    setGraph('nodes', () => clone.nodes);
    setGraph('flows', () => clone.flows);
    setRules(clone.rules);
    setSelectedIds(clone.selectedIds);
    setDrawerNodeId(null);
    setRuleDrawer(null);
    setMarquee(null);
    exitFlowMode();
    setHoveredAnchor(null);
  };

  const undo = () => {
    const currentHistory = history();
    const index = historyIndex();
    if (index <= 0 || currentHistory.length === 0) return;
    const newIndex = index - 1;
    setHistoryIndex(newIndex);
    applySnapshot(currentHistory[newIndex]);
  };

  const redo = () => {
    const currentHistory = history();
    const index = historyIndex();
    if (index >= currentHistory.length - 1) return;
    const newIndex = index + 1;
    setHistoryIndex(newIndex);
    applySnapshot(currentHistory[newIndex]);
  };

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
    const incomes = graph.nodes.filter((node) => node.kind === 'income');
    const totals = new Map<string, { total: number; hasRule: boolean }>();
    incomes.forEach((income) => totals.set(income.id, { total: 0, hasRule: false }));

    rules().forEach((rule) => {
      const entry = totals.get(rule.sourceNodeId);
      if (!entry) return;
      entry.hasRule = true;
      const sum = rule.allocations.reduce((acc, allocation) => acc + allocation.percentage, 0);
      entry.total += sum;
    });

    incomes.forEach((income) => {
      const entry = totals.get(income.id) ?? { total: 0, hasRule: false };
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
      map.set(income.id, { state, total: entry.total });
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

  const allocationIssueMessage = createMemo(() => {
    const issues = allocationIssues();
    if (issues.length === 0) return null;
    if (issues.length === 1) {
      const issue = issues[0];
      const rounded = Math.round(issue.total * 10) / 10;
      switch (issue.state) {
        case 'missing':
          return `${issue.label} needs an allocation rule before you can save.`;
        case 'under':
          return `${issue.label} is only ${rounded}% allocated. Allocations must total 100%.`;
        case 'over':
          return `${issue.label} exceeds 100% allocation (${rounded}%). Adjust the rule before saving.`;
      }
    }
    return 'Complete allocations for every income source before saving.';
  });
  const ruleForDrawer = createMemo(() => {
    const sourceId = ruleDrawer()?.sourceNodeId;
    if (!sourceId) return null;
    return rulesBySource().get(sourceId) ?? null;
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
  const ruleSourceNode = createMemo(() => {
    const id = ruleDrawer()?.sourceNodeId;
    if (!id) return null;
    return graph.nodes.find((node) => node.id === id) ?? null;
  });

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
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') {
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
        event.preventDefault();
        deleteSelectedNodes();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        setCreateModal('income');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    (async () => {
      try {
        const list = await loadWorkspaces();
        const savedSlug =
          typeof window !== 'undefined' ? window.localStorage.getItem(WORKSPACE_STORAGE_KEY) : null;
        const hasSaved = savedSlug && list.some((workspace) => workspace.slug === savedSlug);
        const initialSlug = hasSaved ? savedSlug : list[0]?.slug ?? null;

        if (initialSlug) {
          setWorkspaceSlug(initialSlug);
        } else {
          setLoading(false);
          setWorkspaceModal('create');
        }
      } catch (error) {
        console.error('Failed to load workspaces', error);
        setWorkspaceModal('create');
        setLoading(false);
      } finally {
        setInitializingWorkspace(false);
      }
    })();

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
        if (initializingWorkspace()) return;

        if (!slug) {
          resetWorkspaceState();
          setLoading(false);
          return;
        }

        const slugSnapshot = slug;
        const workspaceName = currentWorkspace()?.name ?? slugSnapshot;

        resetWorkspaceState();
        setLoading(true);

        (async () => {
          try {
            await ensureWorkspace(slugSnapshot, workspaceName);
            const data = await fetchGraph(slugSnapshot);
            if (workspaceSlug() !== slugSnapshot) return;

        if (data && data.nodes?.length) {
          hydrateGraph(data, { primeHistory: true });
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
        })();
      },
      { defer: true },
    ),
  );

  createEffect(() => {
    const slug = workspaceSlug();
    if (typeof window === 'undefined') return;
    if (slug) {
      window.localStorage.setItem(WORKSPACE_STORAGE_KEY, slug);
    } else {
      window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
    }
  });

  createEffect(() => {
    if (!workspaceMenuOpen()) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (workspaceMenuRef?.contains(target) || workspaceMenuButtonRef?.contains(target as HTMLElement)) {
        return;
      }
      setWorkspaceMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setWorkspaceMenuOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    onCleanup(() => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    });
  });

  createEffect(() => {
    if (!simulationMenuOpen()) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (simulationMenuRef?.contains(target) || simulationButtonRef?.contains(target as HTMLElement)) {
        return;
      }
      setSimulationMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSimulationMenuOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    onCleanup(() => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    });
  });

  createEffect(() => {
    if (!drawerOpen()) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (drawerContainerRef?.contains(target as HTMLElement)) return;
      setDrawerNodeId(null);
      setRuleDrawer(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawerNodeId(null);
        setRuleDrawer(null);
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
  const accountNodes = createMemo(() => graph.nodes.filter((node) => node.kind === 'account'));
  const accountOptions = createMemo(() => accountNodes().map((node) => ({ id: node.id, label: node.label })));
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
    setRuleDrawer(null);
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

  const translateClientToWorld = (clientX: number, clientY: number) => {
    if (!viewportElement) return null;
    const { scale, translate } = viewportState();
    const rect = viewportElement.getBoundingClientRect();
    const x = (clientX - rect.left - translate.x) / scale;
    const y = (clientY - rect.top - translate.y) / scale;
    return { x, y };
  };

  const translatePointerToWorld = (event: PointerEvent) =>
    translateClientToWorld(event.clientX, event.clientY);

  const updateFlowCursor = (clientX: number, clientY: number) => {
    const composer = flowComposer();
    if (composer.stage !== 'pickTarget') return;
    const basePoint = translateClientToWorld(clientX, clientY);
    if (!basePoint) return;
    let cursorPoint = basePoint;
    const anchor = findAnchorAtClientPoint(clientX, clientY);
    if (anchor && anchor.anchor === 'top' && anchor.nodeId !== composer.sourceNodeId) {
      const targetNode = graph.nodes.find((n) => n.id === anchor.nodeId);
      if (targetNode) {
        cursorPoint = getAnchorPoint(targetNode, 'top');
        setHoveredAnchor(anchor);
        console.log('[flow] cursor over target anchor', {
          sourceNodeId: composer.sourceNodeId,
          targetNodeId: anchor.nodeId,
        });
      } else {
        console.log('[flow] anchor node not found during cursor update', anchor);
        setHoveredAnchor(null);
      }
    } else {
      setHoveredAnchor(null);
    }
    setFlowComposer((prev) => (prev.stage === 'pickTarget' ? { ...prev, cursorPoint } : prev));
  };

  const findAnchorAtClientPoint = (clientX: number, clientY: number) => {
    let element = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    while (element) {
      const nodeId = element.dataset.anchorNode;
      const anchorType = element.dataset.anchorType as AnchorType | undefined;
      if (nodeId && anchorType) {
        return { nodeId, anchor: anchorType };
      }
      element = element.parentElement;
    }
    return null;
  };

  const handleGlobalPointerMove = (event: PointerEvent) => {
    updateFlowCursor(event.clientX, event.clientY);
  };

  function handleFlowComposerKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      exitFlowMode();
    }
  }

  const handleGlobalMouseMove = (event: MouseEvent) => {
    updateFlowCursor(event.clientX, event.clientY);
  };

  function removeFlowListeners() {
    window.removeEventListener('pointermove', handleGlobalPointerMove, true);
    window.removeEventListener('pointermove', handleGlobalPointerMove);
    window.removeEventListener('keydown', handleFlowComposerKeyDown);
    window.removeEventListener('mousemove', handleGlobalMouseMove, true);
    window.removeEventListener('mousemove', handleGlobalMouseMove);
  }

  function ensureFlowListeners() {
    removeFlowListeners();
    window.addEventListener('pointermove', handleGlobalPointerMove, true);
    window.addEventListener('pointermove', handleGlobalPointerMove);
    window.addEventListener('keydown', handleFlowComposerKeyDown);
    window.addEventListener('mousemove', handleGlobalMouseMove, true);
    window.addEventListener('mousemove', handleGlobalMouseMove);
  }

  const exitFlowMode = () => {
    const composer = flowComposer();
    if (composer.stage !== 'idle') {
      console.log('[flow] cancel', composer);
      console.trace('[flow] cancel stack');
    }
    setFlowComposer({ stage: 'idle' });
    setHoveredAnchor(null);
    removeFlowListeners();
  };

  const completeFlow = (targetNodeId: string) => {
    const composer = flowComposer();
    if (composer.stage !== 'pickTarget') return;
    console.log('[flow] attempt complete', {
      sourceNodeId: composer.sourceNodeId,
      targetNodeId,
    });
    if (targetNodeId === composer.sourceNodeId) {
      console.log('[flow] abort self-connection', targetNodeId);
      exitFlowMode();
      return;
    }
    const exists = graph.flows.some(
      (flow) => flow.sourceId === composer.sourceNodeId && flow.targetId === targetNodeId
    );
    if (!exists) {
      const id = `${composer.sourceNodeId}-${targetNodeId}-${Date.now()}`;
      setGraph('flows', (flows) => [
        ...flows,
        { id, sourceId: composer.sourceNodeId, targetId: targetNodeId, tag: 'Flow' },
      ]);
      pushHistory();
      console.log('[flow] created', { id, sourceNodeId: composer.sourceNodeId, targetNodeId });
      console.log('[flow] all', graph.flows.map((flow) => flow.id));
      
      // Auto-open drawer for income nodes to set up allocation rules
      const sourceNode = graph.nodes.find((n) => n.id === composer.sourceNodeId);
      if (sourceNode?.kind === 'income') {
        setRuleDrawer({ sourceNodeId: composer.sourceNodeId });
      }
    } else {
      console.log('[flow] already exists', {
        sourceNodeId: composer.sourceNodeId,
        targetNodeId,
      });
    }
    exitFlowMode();
  };

  const startFlowFromNode = (nodeId: string, event?: PointerEvent) => {
    const node = graph.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const sourcePoint = getAnchorPoint(node, 'bottom');
    const initialCursor = event ? translatePointerToWorld(event) ?? sourcePoint : sourcePoint;

    setFlowComposer({
      stage: 'pickTarget',
      sourceNodeId: nodeId,
      sourcePoint,
      cursorPoint: initialCursor,
    });
    setHoveredAnchor(null);
    ensureFlowListeners();
    if (event) {
      updateFlowCursor(event.clientX, event.clientY);
    }
    console.log('[flow] source selected', {
      sourceNodeId: nodeId,
      sourcePoint,
    });
  };

  const enterFlowMode = () => {
    const composer = flowComposer();
    if (composer.stage === 'pickTarget') return;
    setFlowComposer({ stage: 'pickSource' });
    setHoveredAnchor(null);
    removeFlowListeners();
    console.log('[flow] mode armed for source selection');
  };

  const handleFlowStartFromAnchor = (payload: { nodeId: string; anchor: AnchorType; event: PointerEvent }) => {
    if (payload.anchor !== 'bottom') return;
    const composer = flowComposer();
    if (composer.stage === 'pickTarget' && composer.sourceNodeId === payload.nodeId) {
      console.log('[flow] duplicate source trigger ignored', composer);
      return;
    }
    startFlowFromNode(payload.nodeId, payload.event);
  };

  const handleFlowTargetSelect = (payload: {
    nodeId: string;
    anchor: AnchorType;
    event: PointerEvent;
  }) => {
    if (payload.anchor !== 'top') return;
    const composer = flowComposer();
    if (composer.stage !== 'pickTarget') return;
    const node = graph.nodes.find((n) => n.id === payload.nodeId);
    if (!node) return;
    const targetPoint = getAnchorPoint(node, payload.anchor);
    setFlowComposer((prev) => (prev.stage === 'pickTarget' ? { ...prev, cursorPoint: targetPoint } : prev));
    setHoveredAnchor({ nodeId: payload.nodeId, anchor: 'top' });
    console.log('[flow] target anchor pressed', {
      nodeId: payload.nodeId,
      anchor: payload.anchor,
    });
    completeFlow(payload.nodeId);
  };

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

  onCleanup(() => {
    removeFlowListeners();
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

  const connectingPreview = createMemo(() => {
    const composer = flowComposer();
    if (composer.stage !== 'pickTarget') return null;
    const path = buildEdgePath(composer.sourcePoint, composer.cursorPoint);
    return (
      <svg class="absolute inset-0 h-full w-full pointer-events-none" style={{ overflow: 'visible' }}>
        <path
          d={path}
          stroke="rgba(14, 116, 144, 0.8)"
          stroke-width="4"
          stroke-linecap="round"
          stroke-dasharray="6 6"
          fill="none"
        />
      </svg>
    );
  });

  const connectingFrom = createMemo(() => {
    const composer = flowComposer();
    return composer.stage === 'pickTarget'
      ? { nodeId: composer.sourceNodeId, anchor: 'bottom' as AnchorType }
      : null;
  });

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
  }): Promise<string> => {
    const slug = workspaceSlug();
    if (!slug) {
      openCreateWorkspace();
      return;
    }
    if (!viewportElement) return;
    if (graph.nodes.length === 0) {
      viewportControls?.reset();
    }
    const { scale, translate } = viewportState();
    const rect = viewportElement.getBoundingClientRect();
    const worldCenter = {
      x: (rect.width / 2 - translate.x) / scale,
      y: (rect.height / 2 - translate.y) / scale,
    };

    const index = placementIndex();
    const columns = 2;
    const col = index % columns;
    const row = Math.floor(index / columns);
    const spacingX = NODE_CARD_WIDTH + GRID_SIZE * 2;
    const spacingY = NODE_CARD_HEIGHT + GRID_SIZE * 2;

    const position = {
      x: snapToGrid(worldCenter.x - NODE_CARD_WIDTH / 2 + col * spacingX),
      y: snapToGrid(worldCenter.y - NODE_CARD_HEIGHT / 2 + row * spacingY),
    };

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
    setPlacementIndex(index + 1);
    pushHistory();
    return newNodeId;
  };

  const handleAddIncome = () => {
    if (!workspaceSlug()) {
      openCreateWorkspace();
      return;
    }
    setRuleDrawer(null);
    setShowHero(false);
    setCreateModal('income');
  };

  const handleAddAccount = () => {
    if (!workspaceSlug()) {
      openCreateWorkspace();
      return;
    }
    setRuleDrawer(null);
    setShowHero(false);
    setCreateModal('account');
  };

  const handleAddPod = () => {
    if (!workspaceSlug()) {
      openCreateWorkspace();
      return;
    }
    const available = accountNodes();
    if (available.length === 0) {
      handleAddAccount();
      return;
    }
    const selectedAccount = selectedIds().find((id) => available.some((node) => node.id === id));
    const parentId = selectedAccount ?? available[0].id;
    setPodParentId(parentId);
    setRuleDrawer(null);
    setShowHero(false);
    setCreateModal('pod');
  };

  const handleStartFlow = () => {
    if (!workspaceSlug()) {
      openCreateWorkspace();
      return;
    }
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

  const runSimulation = (years?: number) => {
    if (years) {
      setSimulationSettings({ horizonYears: years });
    }
    
    if (graph.nodes.length === 0) {
      setSimulationError('Add nodes before running a simulation.');
      setSimulationResult(null);
      return;
    }
    if (allocationIssues().length > 0) {
      setSimulationError('Resolve allocation coverage for every income source before simulating.');
      setSimulationResult(null);
      return;
    }

    const settings = years ? { horizonYears: years } : simulationSettings();
    
    const nodesForSimulation = graph.nodes.map((node) => ({
      id: node.id,
      kind: node.kind,
      category: node.category,
      balance: typeof node.balance === 'number' ? node.balance : 0,
      inflow: node.inflow ?? null,
      returnRate: node.returnRate ?? getDefaultReturnRate(node),
    }));

    const rulesForSimulation = rules().map((rule) => ({
      sourceNodeId: rule.sourceNodeId,
      allocations: rule.allocations.map((alloc) => ({
        targetNodeId: alloc.targetNodeId,
        percentage: alloc.percentage,
      })),
    }));

    try {
      const result = simulateGraph({
        nodes: nodesForSimulation,
        rules: rulesForSimulation,
        settings,
      });
      setSimulationResult(result);
      setSimulationError(null);
      setSimulationMenuOpen(false);
    } catch (error) {
      console.error('Simulation failed', error);
      setSimulationError('Simulation failed. Check console for details.');
      setSimulationResult(null);
    }
  };

  const deleteNode = (nodeId: string, options: { skipHistory?: boolean } = {}) => {
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
    const ids = selectedIds();
    if (!ids.length) return;
    ids.forEach((id) => deleteNode(id, { skipHistory: true }));
    setSelectedIds([]);
    setContextMenu(null);
    pushHistory();
  };

  const drawerOpen = createMemo(() => Boolean(drawerNode()) || Boolean(ruleDrawer()));

  const handleSave = async () => {
    const slug = workspaceSlug();
    if (!slug || saving() || !hasChanges()) return;
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
      const flowMap = new Map<string, string>(Object.entries(result.flows ?? result.edges ?? {}));

      setGraph('nodes', (nodes) =>
        nodes.map((node) => {
          const newId = nodeMap.get(node.id);
          return newId ? { ...node, id: newId } : node;
        })
      );

      setGraph('flows', (flows) =>
        flows.map((flow) => {
          const newId = flowMap.get(flow.id);
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
    } catch (error) {
      console.error('Failed to save graph', error);
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
    <div class="relative h-full w-full" classList={{ 'pr-[360px]': drawerOpen() }}>
      <div class="pointer-events-none absolute left-6 top-6 z-40 flex items-center gap-2">
        <Show
          when={!initializingWorkspace()}
          fallback={
            <span class="pointer-events-auto rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 shadow-sm">
              Loading…
            </span>
          }
        >
          <div class="pointer-events-auto flex items-center gap-2">
            <div class="relative">
              <button
                ref={(el) => (workspaceMenuButtonRef = el)}
                type="button"
                class="flex h-8 items-center gap-1.5 rounded-full border border-slate-200/60 bg-white/70 px-3 text-xs font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-white/90 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/20 disabled:cursor-not-allowed disabled:opacity-60 backdrop-blur-sm"
                onClick={() => setWorkspaceMenuOpen((open) => !open)}
                disabled={workspaces().length === 0}
                title={currentWorkspace()?.name ?? 'Select workspace'}
              >
                <span class="text-[10px]">📁</span>
                <span class="max-w-[120px] truncate">
                  {currentWorkspace()?.name ?? 'Workspace'}
                </span>
                <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              <Show when={workspaceMenuOpen()}>
                <div
                  ref={(el) => (workspaceMenuRef = el)}
                  class="absolute left-0 top-full z-50 mt-2 w-64 rounded-2xl border border-slate-200 bg-white shadow-floating"
                >
                  <div class="max-h-64 overflow-y-auto py-1">
                    <Show when={workspaces().length > 0} fallback={<p class="px-4 py-3 text-xs text-subtle">No workspaces yet.</p>}>
                      <For each={workspaces()}>
                        {(workspace) => (
                          <button
                            type="button"
                            class="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            onClick={() => {
                              setWorkspaceSlug(workspace.slug);
                              setWorkspaceMenuOpen(false);
                            }}
                          >
                            <span>{workspace.name}</span>
                            <Show when={workspaceSlug() === workspace.slug}>
                              <span class="text-xs text-slate-500">Selected</span>
                            </Show>
                          </button>
                        )}
                      </For>
                    </Show>
                  </div>
                </div>
              </Show>
            </div>
            <button
              type="button"
              class="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/60 bg-white/70 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-white/90 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/20 backdrop-blur-sm"
              onClick={openCreateWorkspace}
              title="New workspace"
            >
              ＋
            </button>
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
      >
        {connectingPreview()}
      </CanvasViewport>
      <Show when={!loading() && showHero() && !hasNodes()}>
        <div class="absolute inset-0 pointer-events-none">
          <div class="pointer-events-auto h-full w-full">
            <EmptyHero
              onCreate={() => {
                if (!workspaceSlug()) {
                  openCreateWorkspace();
                  return;
                }
                setShowHero(false);
                setCreateModal('income');
              }}
            />
          </div>
        </div>
      </Show>
      <div class="pointer-events-none absolute right-6 top-6 z-10 flex items-center gap-2">
        <button
          type="button"
          class="pointer-events-auto flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
          onClick={handleExit}
        >
          <ExitIcon />
          Exit
        </button>
        <button
          type="button"
          class="pointer-events-auto flex items-center gap-2 rounded-full border border-rose-200 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-600 shadow-sm transition hover:border-rose-300 hover:text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-200/40 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!currentWorkspace()}
          onClick={() => {
            const workspace = currentWorkspace();
            if (!workspace) {
              openCreateWorkspace();
              return;
            }
            setWorkspaceToDelete(workspace);
            setWorkspaceModal('delete');
          }}
        >
          <DeleteIcon />
          Delete
        </button>
        <Show when={simulationError()}>
          {(message) => (
            <span class="pointer-events-auto rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-600 shadow-sm">
              {message()}
            </span>
          )}
        </Show>
        <div class="pointer-events-auto relative">
          <button
            ref={(el) => (simulationButtonRef = el)}
            type="button"
            class="flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
            onClick={() => setSimulationMenuOpen((open) => !open)}
          >
            ▶ Simulate
            <ChevronDownIcon />
          </button>
          <Show when={simulationMenuOpen()}>
            <div
              ref={(el) => (simulationMenuRef = el)}
              class="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-slate-200 bg-white shadow-floating"
            >
              <div class="py-1">
                <button
                  type="button"
                  class="w-full px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  onClick={() => runSimulation(5)}
                >
                  5 Years
                </button>
                <button
                  type="button"
                  class="w-full px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  onClick={() => runSimulation(10)}
                >
                  10 Years
                </button>
                <button
                  type="button"
                  class="w-full px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  onClick={() => runSimulation(20)}
                >
                  20 Years
                </button>
                <button
                  type="button"
                  class="w-full px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  onClick={() => runSimulation(30)}
                >
                  30 Years
                </button>
              </div>
            </div>
          </Show>
        </div>
        <div class="pointer-events-auto relative group">
          <button
            type="button"
            class="flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-floating transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/40 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:opacity-70"
            onClick={handleSave}
            disabled={!workspaceSlug() || saving() || !hasChanges() || allocationIssues().length > 0}
          >
            <SaveIcon />
            {saving() ? 'Saving…' : 'Save'}
          </button>
          <Show when={!saving() && (!hasChanges() || allocationIssues().length > 0)}>
            <div class="pointer-events-none absolute bottom-full right-0 mb-2 w-64 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-lg opacity-0 transition-opacity group-hover:opacity-100">
              <Show
                when={!hasChanges()}
                fallback={
                  <p class="font-medium">
                    Complete allocation rules for all income sources to save.
                  </p>
                }
              >
                <p class="font-medium text-slate-500">No changes to save</p>
              </Show>
            </div>
          </Show>
        </div>
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
                    partnerLabel: lookup.get(flow.targetId)?.label ?? 'Unknown',
                    hasRule: Boolean(flow.ruleId),
                    tag: flow.tag,
                  }));
                const inbound = flows()
                  .filter((flow) => flow.targetId === selected.id)
                  .map((flow) => ({
                    id: flow.id,
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
                    }))
                  : [];
                const allocationStatus = allocationStatuses().get(selected.id) ?? null;
                return (
                  <NodeDrawer
                    node={node()}
                    onClose={() => setDrawerNodeId(null)}
                    outbound={outbound}
                    inbound={inbound}
                    allocations={allocationDetails}
                    allocationStatus={allocationStatus}
                    onManageRules={selected.kind === 'income'
                      ? (nodeId) => {
                          setDrawerNodeId(null);
                          setRuleDrawer({ sourceNodeId: nodeId });
                        }
                      : undefined}
                    onUpdateBalance={updateNodeBalance}
                    onUpdateInflow={updateNodeInflow}
                    onUpdatePodType={updateNodePodType}
                    onUpdateReturnRate={updateNodeReturnRate}
                  />
                );
              })()
            )}
          </Show>
          <Show when={!drawerNode() && ruleDrawer()}>
            <RuleDrawer
              open={Boolean(ruleDrawer())}
              sourceNode={ruleSourceNode()}
              nodes={graph.nodes}
              initialRule={ruleForDrawer()}
              onClose={() => setRuleDrawer(null)}
              onSave={(rule) => {
                const fallbackId = `rule-${createId()}`;
                const ruleId = rule.id ?? rulesBySource().get(rule.sourceNodeId)?.id ?? fallbackId;
                const record: RuleRecord = {
                  id: ruleId,
                  sourceNodeId: rule.sourceNodeId,
                  trigger: rule.trigger,
                  triggerNodeId: rule.triggerNodeId ?? rule.sourceNodeId,
                  allocations: rule.allocations.map((alloc) => ({ ...alloc })),
                };
                setRules((existing) => [
                  ...existing.filter((r) => r.sourceNodeId !== rule.sourceNodeId),
                  record,
                ]);
                setGraph('flows', (flows) => {
                  const targets = new Set(rule.allocations.map((alloc) => alloc.targetNodeId));
                  const next = flows
                    .map((flow) => {
                      if (flow.sourceId !== rule.sourceNodeId) return flow;
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
                      (flow) => flow.sourceId === rule.sourceNodeId && flow.targetId === targetId,
                    );
                    if (!existingFlow) {
                      next.push({
                        id: `flow-${createId()}`,
                        sourceId: rule.sourceNodeId,
                        targetId,
                        ruleId,
                        tag: 'Flow',
                      });
                    }
                  });

                  return next;
                });
                pushHistory();
                setRuleDrawer(null);
              }}
            />
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
      <Show when={simulationResult()}>
        {(sim) => {
          const settings = simulationSettings();
          const result = sim();
          const horizonYears = settings.horizonYears;
          const lookup = nodeLookup();
          const sortedBalances = Object.entries(result.finalBalances)
            .map(([id, value]) => ({ id, value, label: lookup.get(id)?.label ?? 'Unknown node' }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

          return (
            <div class="pointer-events-none absolute left-6 bottom-6 z-40 w-[380px]">
              <div class="pointer-events-auto space-y-4 rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-floating backdrop-blur-sm">
                <div class="flex items-start justify-between gap-3">
                  <div class="space-y-1">
                    <h2 class="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {horizonYears}-Year Projection
                    </h2>
                    <p class="text-2xl font-bold text-slate-900 tracking-tight">
                      {currencyFormatter.format(result.finalTotal)}
                    </p>
                    <p class="text-xs text-slate-500">Total Portfolio Value</p>
                  </div>
                  <button
                    type="button"
                    class="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                    onClick={() => setSimulationResult(null)}
                  >
                    ✕
                  </button>
                </div>
                
                <div class="space-y-2">
                  <h3 class="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Financial Milestones
                  </h3>
                  <div class="space-y-1.5">
                    {result.milestones.map((milestone) => (
                      <div class="flex items-center justify-between rounded-lg border border-slate-200/60 bg-slate-50 px-3 py-2">
                        <span class="text-sm font-medium text-slate-700">{milestone.label}</span>
                        <span class="text-xs font-semibold text-slate-500">{formatMonths(milestone.reachedAtMonth)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div class="space-y-2">
                  <h3 class="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Top Account Balances
                  </h3>
                  <div class="space-y-2">
                    {sortedBalances.map((entry, index) => {
                      const maxValue = sortedBalances[0].value;
                      const percentage = (entry.value / maxValue) * 100;
                      return (
                        <div class="space-y-1">
                          <div class="flex items-center justify-between">
                            <span class="text-sm font-medium text-slate-700">{entry.label}</span>
                            <span class="text-xs font-semibold text-slate-500">{currencyFormatter.format(entry.value)}</span>
                          </div>
                          <div class="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                            <div
                              class="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-300"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        }}
      </Show>
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
          setDrawerNodeId(id);
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
          setDrawerNodeId(id);
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
          setDrawerNodeId(id);
        }}
      />
      <Modal
        open={workspaceModal() === 'create'}
        onClose={() => {
          setWorkspaceModal(null);
        }}
      >
        <form
          class="flex w-full flex-col gap-5"
          onSubmit={handleWorkspaceCreate}
        >
          <div class="space-y-1 text-center">
            <h2 class="text-xl font-semibold text-slate-900">Create workspace</h2>
            <p class="text-sm text-subtle">Workspaces group your nodes, flows, and rules.</p>
          </div>
          <div class="flex flex-col gap-3 text-left">
            <label class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Name
              <input
                class="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/30"
                placeholder="New workspace"
                value={workspaceDraftName()}
                onInput={(event) => {
                  const value = event.currentTarget.value;
                  setWorkspaceDraftName(value);
                }}
              />
            </label>
          </div>
          <div class="flex flex-col gap-2">
            <button
              type="submit"
              class="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white shadow-floating transition hover:bg-slate-800"
            >
              Create workspace
            </button>
            <button
              type="button"
              class="w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
              onClick={() => {
                setWorkspaceModal(null);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        open={workspaceModal() === 'delete'}
        onClose={() => {
          setWorkspaceModal(null);
          setWorkspaceToDelete(null);
        }}
      >
        <div class="flex w-full flex-col gap-5">
          <div class="space-y-1 text-left">
            <h2 class="text-xl font-semibold text-slate-900">Delete workspace</h2>
            <p class="text-sm text-subtle">
              This removes <strong>{workspaceToDelete()?.name ?? ''}</strong> and all associated nodes, flows,
              and rules. This action cannot be undone.
            </p>
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              class="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
              onClick={() => {
                setWorkspaceModal(null);
                setWorkspaceToDelete(null);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              class="flex-1 rounded-xl bg-rose-600 py-3 text-sm font-semibold text-white shadow-floating transition hover:bg-rose-500"
              onClick={handleWorkspaceDelete}
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CanvasPage;
