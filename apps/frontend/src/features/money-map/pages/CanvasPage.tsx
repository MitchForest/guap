import { Component, For, Show, createEffect, createMemo, createSignal, onCleanup, onMount, on } from 'solid-js';
import CanvasViewport, { DragPayload, ViewportControls } from '~/features/money-map/components/canvas/CanvasViewport';
import type { NodeAllocationStatus, IncomingAllocationInfo } from '~/features/money-map/components/canvas/NodeCard';
import { CanvasFlow, CanvasNode, CanvasInflow, CanvasInflowCadence, CanvasPodType } from '~/features/money-map/types/graph';
import type { MoneyMapSnapshot } from '@guap/api';
import BottomDock from '~/features/money-map/components/BottomDock';
import ZoomPad from '~/features/money-map/components/ZoomPad';
import { NODE_CARD_HEIGHT, NODE_CARD_WIDTH } from '~/features/money-map/components/canvas/NodeCard';
import { buildEdgePath, getAnchorPoint } from '~/features/money-map/components/canvas/EdgeLayer';
import EmptyHero from '~/features/money-map/components/empty/EmptyHero';
import NodeContextMenu from '~/features/money-map/components/nodes/NodeContextMenu';
import IncomeSourceModal from '~/features/money-map/components/create/IncomeSourceModal';
import PodModal from '~/features/money-map/components/create/PodModal';
import AccountTypeModal, { AccountOption } from '~/features/money-map/components/create/AccountTypeModal';
import { useCanvasSimulation, simulationHorizonOptions } from '~/features/money-map/state/useCanvasSimulation';
import { SimulationPanel } from '~/features/money-map';
import { useFlowComposer } from '~/features/money-map/state/useFlowComposer';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '~/shared/components/ui/dropdown-menu';
import { Button } from '~/shared/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '~/shared/components/ui/alert-dialog';
import { useAppData } from '~/app/contexts/AppDataContext';
import { useAuth } from '~/app/contexts/AuthContext';
import { CanvasDrawerPanel, CanvasScene, createCanvasEditor } from '~/features/money-map';
import type { AllocationHealth, AllocationIssue, RuleRecord } from '~/features/money-map';
import {
  clearMoneyMapCache,
  loadMoneyMapGraph,
  submitMoneyMapChangeRequest,
} from '~/features/money-map/api/client';
import { useShell } from '~/app/contexts/ShellContext';
import { toast } from 'solid-sonner';

const GRID_SIZE = 28;
const snapToGrid = (value: number) => Math.round(value / GRID_SIZE) * GRID_SIZE;

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

const CloseIcon = () => (
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
    <path d="M18 6L6 18" />
    <path d="M6 6l12 12" />
  </svg>
);

const createId = () =>
  typeof globalThis.crypto !== 'undefined' && 'randomUUID' in globalThis.crypto
    ? globalThis.crypto.randomUUID()
    : Math.random().toString(36).slice(2);

type RuleDraftInput = {
  id?: string;
  sourceNodeId: string;
  trigger: 'incoming' | 'scheduled';
  triggerNodeId: string | null;
  allocations: Array<{ id: string; percentage: number; targetNodeId: string }>;
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

  const householdId = createMemo(() => activeHousehold()?._id ?? null);
  const [initializingMap, setInitializingMap] = createSignal(true);
  const [submittingChangeRequest, setSubmittingChangeRequest] = createSignal(false);
  const [lastSnapshot, setLastSnapshot] = createSignal<MoneyMapSnapshot | null>(null);
  const lastUpdatedLabel = createMemo(() => {
    const ts = lastSnapshot()?.map?.updatedAt ?? null;
    if (!ts) return null;
    return new Date(ts).toLocaleString();
  });
  const mapTitle = createMemo(
    () => lastSnapshot()?.map?.name ?? activeHousehold()?.name ?? 'Money Map'
  );
  let drawerContainerRef: HTMLDivElement | undefined;

  const {
    graph,
    setGraph,
    rules,
    setRules,
    selectedIds,
    setSelectedIds,
    selectedIdSet,
    ensureSelection,
    resetGraphState: resetEditorState,
    onSnapshotApplied,
    clearSelection: clearSelectionBase,
    drag,
    marquee,
    placement,
    history: { hasChanges, setHasChanges, pushHistory, replaceHistory, undo, redo },
  } = createCanvasEditor({
    historyCap: HISTORY_CAP,
    snapToGrid,
    gridSize: GRID_SIZE,
    nodeCardWidth: NODE_CARD_WIDTH,
    nodeCardHeight: NODE_CARD_HEIGHT,
  });
  const [scalePercent, setScalePercent] = createSignal(100);
  const [viewportState, setViewportState] = createSignal({ scale: 1, translate: { x: 0, y: 0 } });
  const [drawerNodeId, setDrawerNodeId] = createSignal<string | null>(null);
  const [contextMenu, setContextMenu] = createSignal<{ nodeId: string; x: number; y: number } | null>(
    null
  );
  const [createModal, setCreateModal] = createSignal<'income' | 'pod' | 'account' | null>(null);
  const [podParentId, setPodParentId] = createSignal<string | null>(null);
  const [showHero, setShowHero] = createSignal(true);
  const [loading, setLoading] = createSignal(true);

  const loadMoneyMapState = async ({ primeHistory = false }: { primeHistory?: boolean } = {}) => {
    const id = householdId();
    if (!id || !isAuthenticated()) {
      clearMoneyMapCache();
      resetCanvasState();
      setLastSnapshot(null);
      setHasChanges(false);
      setShowHero(true);
      setLoading(false);
      setInitializingMap(false);
      return;
    }

    setLoading(true);
    try {
      const { snapshot, graph } = await loadMoneyMapGraph(id);
      setLastSnapshot(snapshot);
      if (graph.nodes.length || graph.edges.length || graph.rules.length) {
        hydrateGraph(graph, { primeHistory });
        setShowHero(false);
      } else {
        resetCanvasState();
        setShowHero(true);
      }
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to load Money Map', error);
      resetCanvasState();
      toast.error('Unable to load Money Map data.');
    } finally {
      setLoading(false);
      setInitializingMap(false);
    }
  };

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

  const removeSnapshotListener = onSnapshotApplied(() => {
    setDrawerNodeId(null);
    marquee.clear();
    drag.reset();
    exitFlowMode();
  });
  onCleanup(removeSnapshotListener);


  function resetCanvasState() {
    resetEditorState();
    setDrawerNodeId(null);
    marquee.clear();
    drag.reset();
    exitFlowMode();
    setShowHero(true);
  }

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

  const editingLocked = createMemo(() => false);

  const canSendRequest = createMemo(
    () =>
      !submittingChangeRequest() &&
      Boolean(user()?.profileId) &&
      Boolean(householdId()) &&
      hasChanges()
  );

  const requestDisabledReason = createMemo(() => {
    if (submittingChangeRequest()) return null;
    if (!isAuthenticated()) return 'Sign in to submit changes.';
    if (!householdId()) return 'Join or create a household to submit changes.';
    if (!hasChanges()) return 'No changes to submit.';
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
    void loadMoneyMapState({ primeHistory: true });

    onCleanup(() => {
      window.removeEventListener('keydown', handleKeyDown);
    });
  });

  createEffect(
    on(
      () => ({ id: householdId(), authed: isAuthenticated() }),
      ({ id, authed }) => {
        if (!id || !authed) {
          clearMoneyMapCache();
          resetCanvasState();
          setLastSnapshot(null);
          setHasChanges(false);
          setShowHero(true);
          setLoading(false);
          setInitializingMap(false);
          return;
        }
        setInitializingMap(true);
        void loadMoneyMapState({ primeHistory: true });
      },
      { defer: true }
    )
  );

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
  placement.set(nodes.length);
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

  const clearSelection = () => {
    if (flowComposer().stage !== 'idle') {
      console.log('[flow] clearSelection cancels active flow');
      exitFlowMode();
      return;
    }
    clearSelectionBase();
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

  const handleNodeDrag = (payload: DragPayload) => {
    drag.handleNodeDrag(payload);
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
    marquee.start(payload);
  };

  const handleMarqueeUpdate = (payload: {
    local: { x: number; y: number };
    world: { x: number; y: number };
  }) => {
    marquee.update(payload);
  };

  const handleMarqueeEnd = (payload: {
    local: { x: number; y: number };
    world: { x: number; y: number };
  }) => {
    marquee.end(payload);
  };

  const marqueeOverlay = createMemo(() => {
    const rect = marquee.overlayRect();
    if (!rect) return null;
    return (
      <div
        class="pointer-events-none absolute rounded-2xl border-2 border-sky-400/70 bg-sky-400/10"
        style={{
          left: `${rect.left}px`,
          top: `${rect.top}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
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
    if (editingLocked()) {
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

    const placementCursor = placement.index();
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
    placement.set(placementCursor + 1);
    pushHistory();
    return newNodeId;
  };

  const handleAddIncome = () => {
    if (editingLocked()) return;
    setShowHero(false);
    setCreateModal('income');
  };

  const handleAddAccount = () => {
    if (editingLocked()) return;
    setShowHero(false);
    setCreateModal('account');
  };

  const handleAddPod = () => {
    if (editingLocked()) return;
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
    if (editingLocked()) return;
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
    placement.increment();
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

  const handleSaveRule = (ruleDraft: RuleDraftInput) => {
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
  };

  const deleteNode = (nodeId: string, options: { skipHistory?: boolean } = {}) => {
    if (editingLocked()) return;
    setGraph('nodes', (nodes) => {
      const filtered = nodes.filter((node) => node.id !== nodeId);
      if (filtered.length === 0) setShowHero(true);
      if (filtered.length === 0) {
        placement.set(0);
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

  const handleSubmitChangeRequest = async () => {
    const id = householdId();
    const submitterId = user()?.profileId ?? null;
    if (!id || !submitterId) {
      toast.error('Sign in with a linked profile to submit changes.');
      return;
    }
    if (!hasChanges()) {
      toast.message('No changes to submit for approval.');
      return;
    }

    setSubmittingChangeRequest(true);
    try {
      await submitMoneyMapChangeRequest({
        householdId: id,
        submitterId,
        draft: {
          nodes: graph.nodes,
          flows: graph.flows,
          rules: rules(),
        },
      });
      setHasChanges(false);
      toast.success('Submitted for admin approval.');
    } catch (error) {
      console.error('Failed to submit Money Map change request', error);
      toast.error('Unable to submit changes for approval.');
    } finally {
      setSubmittingChangeRequest(false);
    }
  };

  const handleExit = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/';
    }
  };

  const overlayHeader = (
    <div class="pointer-events-none absolute inset-x-4 top-4 z-40 flex flex-col gap-3 sm:inset-x-6 sm:top-6 sm:flex-row sm:items-center sm:justify-between">
      <div class="pointer-events-auto flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="rounded-full border border-slate-200/70 bg-white/80 text-slate-600 shadow-sm backdrop-blur hover:border-slate-300 hover:text-slate-900"
          onClick={handleExit}
          aria-label="Exit money map"
        >
          <CloseIcon />
        </Button>
        <div class="hidden sm:flex flex-col leading-tight text-slate-700">
          <Show when={!initializingMap()}>
            <span class="text-sm font-semibold text-slate-800">{mapTitle()}</span>
          </Show>
          <Show when={lastUpdatedLabel()}>
            {(label) => (
              <span class="text-xs text-subtle">Last updated {label()}</span>
            )}
          </Show>
        </div>
      </div>
      <div class="pointer-events-auto flex items-center gap-2 self-end sm:self-auto">
        <Show when={simulationError()}>
          {(message) => (
            <span class="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-600 shadow-sm">
              {message()}
            </span>
          )}
        </Show>
        <DropdownMenu open={simulationMenuOpen()} onOpenChange={setSimulationMenuOpen}>
          <DropdownMenuTrigger
            as="button"
            type="button"
            class="flex h-9 items-center gap-1.5 rounded-full border border-slate-200/60 bg-white/80 px-3 text-xs font-medium text-slate-600 shadow-sm backdrop-blur-sm hover:border-slate-300 hover:bg-white/90 hover:text-slate-800 disabled:cursor-not-allowed"
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
        <AlertDialog>
          <AlertDialogTrigger
            as={Button}
            type="button"
            variant="primary"
            size="sm"
            disabled={!canSendRequest()}
            title={requestDisabledReason() ?? undefined}
          >
            {submittingChangeRequest() ? 'Sending…' : 'Save'}
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Send this money map for approval?</AlertDialogTitle>
              <AlertDialogDescription>
                We’ll notify your parent or guardian so they can review and approve these changes.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel variant="ghost" size="sm">
                Keep editing
              </AlertDialogCancel>
              <AlertDialogAction
                variant="primary"
                size="sm"
                disabled={submittingChangeRequest()}
                onClick={() => {
                  void handleSubmitChangeRequest();
                }}
              >
                {submittingChangeRequest() ? 'Sending…' : 'Send request'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );

  const viewport = (
    <CanvasViewport
        nodes={graph.nodes}
        positions={drag.livePositions()}
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
  );

  const heroOverlay = (
    <Show when={!loading() && showHero() && !hasNodes()}>
      <div class="absolute inset-0 pointer-events-none">
        <div class="pointer-events-auto h-full w-full">
          <EmptyHero
            onCreate={() => {
              if (editingLocked()) return;
              setShowHero(false);
              setCreateModal('income');
            }}
          />
        </div>
      </div>
    </Show>
  );

  const contextMenuOverlay = (
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
  );

  const drawerPanel = (
    <CanvasDrawerPanel
      open={drawerOpen}
      node={drawerNode}
      nodes={() => graph.nodes}
      flows={flows}
      nodeLookup={nodeLookup}
      allocationStatuses={allocationStatuses}
      rulesBySource={rulesBySource}
      registerContainer={(el) => (drawerContainerRef = el)}
      onClose={() => setDrawerNodeId(null)}
      onSaveRule={handleSaveRule}
      onUpdateBalance={updateNodeBalance}
      onUpdateInflow={updateNodeInflow}
      onUpdatePodType={updateNodePodType}
      onUpdateReturnRate={updateNodeReturnRate}
    />
  );

  const bottomDockSection = (
    <BottomDock
      onAddIncome={handleAddIncome}
      onAddAccount={handleAddAccount}
      onAddPod={handleAddPod}
      onStartFlow={handleStartFlow}
    />
  );

  const zoomPadControl = (
    <ZoomPad
      zoomPercent={scalePercent()}
      onZoomIn={() => viewportControls?.zoomIn()}
      onZoomOut={() => viewportControls?.zoomOut()}
      onReset={() => viewportControls?.reset()}
    />
  );

  const simulationPanelSection = (
    <SimulationPanel
      open={simulationPanelOpen}
      result={simulationResult}
      settings={simulationSettings}
      horizonOptions={simulationHorizonOptions}
      onRun={runSimulation}
      onClose={clearSimulation}
      getNodeLabel={(id) => nodeLookup().get(id)?.label ?? 'Unknown node'}
    />
  );

  const modals = (
    <>
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
    </>
  );

  return (
    <CanvasScene
      drawerOpen={drawerOpen}
      simulationPanelOpen={simulationPanelOpen}
      toolbar={overlayHeader}
      viewport={viewport}
      heroOverlay={heroOverlay}
      contextMenu={contextMenuOverlay}
      drawer={drawerPanel}
      bottomDock={bottomDockSection}
      zoomPad={zoomPadControl}
      simulationPanel={simulationPanelSection}
      modals={modals}
    />
  );
};

export default CanvasPage;
