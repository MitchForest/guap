import { Component, JSX, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { createStore } from 'solid-js/store';
import CanvasViewport, { DragPayload, ViewportControls } from '../components/canvas/CanvasViewport';
import { CanvasEdge, CanvasNode } from '../types/graph';
import BottomDock, { DockMenuItem } from '../components/layout/BottomDock';
import { AnchorType, NODE_CARD_HEIGHT, NODE_CARD_WIDTH } from '../components/canvas/NodeCard';
import { buildEdgePath, getAnchorPoint } from '../components/canvas/EdgeLayer';
import EmptyHero from '../components/empty/EmptyHero';
import NodeContextMenu from '../components/nodes/NodeContextMenu';
import NodeDrawer from '../components/nodes/NodeDrawer';
import IncomeSourceModal from '../components/create/IncomeSourceModal';
import PodModal from '../components/create/PodModal';
import AccountTypeModal, { AccountOption } from '../components/create/AccountTypeModal';
import RuleDrawer, { RuleDraft } from '../components/rules/RuleDrawer';
import {
  ensureWorkspace,
  fetchGraph,
  createNode as createNodeMutation,
  moveNodes as moveNodesMutation,
  deleteNode as deleteNodeMutation,
  saveAutomationRule as saveAutomationRuleMutation,
  createEdge,
  watchGraph,
} from '../services/graphClient';

const GRID_SIZE = 28;
const snapToGrid = (value: number) => Math.round(value / GRID_SIZE) * GRID_SIZE;

const dockMenuItems: DockMenuItem[] = [
  {
    id: 'income',
    label: 'Income Source',
    description: 'An internal account for fast fund transfers',
  },
  {
    id: 'pod',
    label: 'Pod',
    description: 'A sub-account for organizing your money',
  },
  {
    id: 'account',
    label: 'Account',
    description: 'Add deposit, investment, or liability accounts',
  },
  {
    id: 'automation',
    label: 'Automation',
    description: 'Create a rule triggered by funds or schedule',
  },
];

const demoNodes: CanvasNode[] = [
  {
    id: 'allowance',
    type: 'income',
    label: 'Allowance',
    icon: '🏦',
    balance: 820,
    accent: '#2563eb',
    position: { x: 520, y: 60 },
  },
  {
    id: 'savings',
    type: 'account',
    label: 'Savings',
    icon: '💰',
    balance: 40,
    accent: '#f97316',
    position: { x: 320, y: 252 },
  },
  {
    id: 'checking',
    type: 'account',
    label: 'Checking',
    icon: '🧾',
    balance: 440,
    accent: '#1d4ed8',
    position: { x: 520, y: 252 },
  },
  {
    id: 'credit-card',
    type: 'liability',
    label: 'Credit Card',
    icon: '💳',
    balance: 790,
    accent: '#f59e0b',
    position: { x: 720, y: 252 },
  },
  {
    id: 'brokerage',
    type: 'account',
    label: 'Brokerage Account',
    icon: '📈',
    balance: 680,
    accent: '#16a34a',
    position: { x: 920, y: 252 },
  },
  {
    id: 'vacation',
    type: 'goal',
    label: 'Vacation',
    icon: '🏖️',
    balance: 420,
    accent: '#a855f7',
    position: { x: 220, y: 440 },
  },
  {
    id: 'college',
    type: 'goal',
    label: 'College Tuition',
    icon: '🎓',
    balance: 890,
    accent: '#6366f1',
    position: { x: 370, y: 440 },
  },
  {
    id: 'needs',
    type: 'pod',
    label: 'Needs',
    icon: '🧺',
    balance: 520,
    accent: '#0ea5e9',
    position: { x: 520, y: 440 },
  },
  {
    id: 'wants',
    type: 'pod',
    label: 'Wants',
    icon: '🎯',
    balance: 190,
    accent: '#ec4899',
    position: { x: 720, y: 440 },
  },
];

const demoEdges: CanvasEdge[] = [
  {
    id: 'allowance-to-savings',
    sourceId: 'allowance',
    targetId: 'savings',
    kind: 'automation',
    ruleId: 'rule-allowance-main',
  },
  {
    id: 'allowance-to-checking',
    sourceId: 'allowance',
    targetId: 'checking',
    kind: 'automation',
    ruleId: 'rule-allowance-main',
  },
  {
    id: 'allowance-to-credit',
    sourceId: 'allowance',
    targetId: 'credit-card',
    kind: 'automation',
    ruleId: 'rule-allowance-main',
  },
  {
    id: 'checking-to-needs',
    sourceId: 'checking',
    targetId: 'needs',
    kind: 'automation',
    ruleId: 'rule-checking-distribute',
  },
  {
    id: 'checking-to-wants',
    sourceId: 'checking',
    targetId: 'wants',
    kind: 'automation',
    ruleId: 'rule-checking-distribute',
  },
  {
    id: 'savings-to-vacation',
    sourceId: 'savings',
    targetId: 'vacation',
    kind: 'automation',
    ruleId: 'rule-savings-goals',
  },
  {
    id: 'savings-to-college',
    sourceId: 'savings',
    targetId: 'college',
    kind: 'automation',
    ruleId: 'rule-savings-goals',
  },
  {
    id: 'credit-to-brokerage',
    sourceId: 'credit-card',
    targetId: 'brokerage',
    kind: 'automation',
    ruleId: 'rule-credit-invest',
  },
];

const demoRules: RuleRecord[] = [
  {
    id: 'rule-allowance-main',
    sourceNodeId: 'allowance',
    trigger: 'incoming',
    triggerNodeId: 'allowance',
    allocations: [
      { targetNodeId: 'savings', percentage: 25 },
      { targetNodeId: 'checking', percentage: 50 },
      { targetNodeId: 'credit-card', percentage: 25 },
    ],
  },
  {
    id: 'rule-checking-distribute',
    sourceNodeId: 'checking',
    trigger: 'incoming',
    triggerNodeId: 'checking',
    allocations: [
      { targetNodeId: 'needs', percentage: 60 },
      { targetNodeId: 'wants', percentage: 40 },
    ],
  },
  {
    id: 'rule-savings-goals',
    sourceNodeId: 'savings',
    trigger: 'incoming',
    triggerNodeId: 'savings',
    allocations: [
      { targetNodeId: 'vacation', percentage: 70 },
      { targetNodeId: 'college', percentage: 30 },
    ],
  },
  {
    id: 'rule-credit-invest',
    sourceNodeId: 'credit-card',
    trigger: 'incoming',
    triggerNodeId: 'credit-card',
    allocations: [
      { targetNodeId: 'brokerage', percentage: 100 },
    ],
  },
];

type Snapshot = {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  rules: RuleRecord[];
  selectedIds: string[];
};

const HISTORY_CAP = 50;

type DragState = {
  nodeIds: string[];
  startPositions: Record<string, { x: number; y: number }>;
};

type RuleRecord = RuleDraft & { id: string };

const CanvasPage: Component = () => {
  const [graph, setGraph] = createStore<{ nodes: CanvasNode[]; edges: CanvasEdge[] }>({
    nodes: [],
    edges: [],
  });
  const [selectedIds, setSelectedIds] = createSignal<string[]>([]);
  const [scalePercent, setScalePercent] = createSignal(100);
  const [dragState, setDragState] = createSignal<DragState | null>(null);
  const [viewportState, setViewportState] = createSignal({ scale: 1, translate: { x: 0, y: 0 } });
  const [connectingEdge, setConnectingEdge] = createSignal<
    | null
    | {
        sourceNodeId: string;
        sourceAnchor: AnchorType;
        pointerId: number;
        sourcePoint: { x: number; y: number };
        cursorPoint: { x: number; y: number };
      }
  >(null);
  const [hoveredAnchor, setHoveredAnchor] = createSignal<{ nodeId: string; anchor: AnchorType } | null>(
    null
  );
  const [drawerNodeId, setDrawerNodeId] = createSignal<string | null>(null);
  const [contextMenu, setContextMenu] = createSignal<{ nodeId: string; x: number; y: number } | null>(
    null
  );
  const [createModal, setCreateModal] = createSignal<'income' | 'pod' | 'account' | null>(null);
  const [ruleDrawer, setRuleDrawer] = createSignal<{ sourceNodeId: string } | null>(null);
  const [rules, setRules] = createSignal<RuleRecord[]>([]);
  const [showHero, setShowHero] = createSignal(true);
  const [loading, setLoading] = createSignal(true);
  const [history, setHistory] = createSignal<Snapshot[]>([]);
  const [historyIndex, setHistoryIndex] = createSignal(-1);
  const [marquee, setMarquee] = createSignal<
    | null
    | {
        originLocal: { x: number; y: number };
        currentLocal: { x: number; y: number };
        originWorld: { x: number; y: number };
        currentWorld: { x: number; y: number };
      }
  >(null);

  const cloneSnapshot = (snap: Snapshot): Snapshot => ({
    nodes: snap.nodes.map((node) => ({ ...node, position: { ...node.position } })),
    edges: snap.edges.map((edge) => ({ ...edge })),
    rules: snap.rules.map((rule) => ({
      ...rule,
      allocations: rule.allocations.map((alloc) => ({ ...alloc })),
    })),
    selectedIds: [...snap.selectedIds],
  });

  const snapshotGraph = (): Snapshot =>
    cloneSnapshot({
      nodes: graph.nodes,
      edges: graph.edges,
      rules: rules(),
      selectedIds: selectedIds(),
    });

  const replaceHistory = (snap: Snapshot) => {
    const clone = cloneSnapshot(snap);
    setHistory([clone]);
    setHistoryIndex(0);
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
  };

  const applySnapshot = (snap: Snapshot) => {
    const clone = cloneSnapshot(snap);
    setGraph('nodes', () => clone.nodes);
    setGraph('edges', () => clone.edges);
    setRules(clone.rules);
    setSelectedIds(clone.selectedIds);
    setDrawerNodeId(null);
    setRuleDrawer(null);
    setMarquee(null);
    setConnectingEdge(null);
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
  const describeRule = (rule: RuleRecord) => {
    const parts = rule.allocations
      .filter((alloc) => alloc.targetNodeId)
      .map((alloc) => {
        const target = alloc.targetNodeId ? nodeLookup().get(alloc.targetNodeId) : null;
        return `${alloc.percentage}% to ${target?.label ?? 'Unknown'}`;
      });
    return parts.join(', ');
  };
  const ruleSourceNode = createMemo(() => {
    const id = ruleDrawer()?.sourceNodeId;
    if (!id) return null;
    return graph.nodes.find((node) => node.id === id) ?? null;
  });

  let graphUnsubscribe: (() => void) | null = null;
  let historyPrimed = false;

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
        deleteSelectedNodes().catch((error) => console.error('Failed to delete nodes', error));
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
        await ensureWorkspace();
        let data = await fetchGraph();
        if (!data || !(data.nodes?.length > 0)) {
          await seedDemoWorkspace();
          data = await fetchGraph();
        }
        if (data) {
          hydrateGraph(data, { primeHistory: true });
          historyPrimed = true;
        }

        graphUnsubscribe = await watchGraph((payload) => {
          if (!payload) return;
          const prime = !historyPrimed;
          hydrateGraph(payload, { primeHistory: prime });
          if (prime) historyPrimed = true;
        });
      } catch (error) {
        console.error('Failed to load Convex graph', error);
        setLoading(false);
      }
    })();

    onCleanup(() => {
      window.removeEventListener('keydown', handleKeyDown);
      graphUnsubscribe?.();
    });
  });

  const hydrateGraph = (data: any, options: { primeHistory?: boolean } = {}) => {
    const nodes = (data.nodes ?? []).map((node: any) => ({
      id: String(node._id),
      type: node.type,
      label: node.label,
      icon: node.icon ?? undefined,
      accent: node.accent ?? undefined,
      balance: typeof node.balanceCents === 'number' ? node.balanceCents / 100 : undefined,
      position: node.position,
    }));

    const edges = (data.edges ?? []).map((edge: any) => ({
      id: String(edge._id),
      sourceId: String(edge.sourceNodeId),
      targetId: String(edge.targetNodeId),
      kind: edge.kind ?? 'automation',
      ruleId: edge.ruleId ? String(edge.ruleId) : undefined,
    }));

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
    allocations: (allocationsByRule.get(String(rule._id)) ?? []).map((alloc: any) => ({
      targetNodeId: String(alloc.targetNodeId),
      percentage: alloc.percentage,
    })),
  }));

  setGraph('nodes', nodes);
  setGraph('edges', edges);
  setRules(ruleRecords);
  setShowHero(nodes.length === 0);
  if (options.primeHistory) {
    const initialSelection = nodes.length ? [nodes[0].id] : [];
    replaceHistory({
      nodes,
      edges,
      rules: ruleRecords,
      selectedIds: initialSelection,
    });
    setSelectedIds(initialSelection);
  } else {
    setSelectedIds((current) => {
      const valid = current.filter((id) => nodes.some((node) => node.id === id));
      if (valid.length > 0) return valid;
      return current.length ? current : nodes.length ? [nodes[0].id] : [];
    });
  }
  setLoading(false);
  };

  const seedDemoWorkspace = async () => {
    try {
      await ensureWorkspace();
      const idMap = new Map<string, string>();
      for (const node of demoNodes) {
        const nodeId = await createNodeMutation({
          type: node.type,
          label: node.label,
          icon: node.icon,
          accent: node.accent,
          balanceCents: typeof node.balance === 'number' ? Math.round(node.balance * 100) : undefined,
          position: node.position,
        });
        idMap.set(node.id, nodeId);
      }

    for (const rule of demoRules) {
        const sourceId = idMap.get(rule.sourceNodeId);
        if (!sourceId) continue;
        await saveAutomationRuleMutation({
          sourceNodeId: sourceId,
          trigger: rule.trigger,
          triggerNodeId: rule.triggerNodeId ? idMap.get(rule.triggerNodeId) ?? sourceId : sourceId,
          allocations: rule.allocations
            .map((alloc) => {
              const targetId = idMap.get(alloc.targetNodeId);
              if (!targetId) return null;
              return { targetNodeId: targetId, percentage: alloc.percentage };
            })
            .filter((alloc): alloc is { targetNodeId: string; percentage: number } => Boolean(alloc)),
        });
      }
    } catch (error) {
      console.error('Failed to seed workspace', error);
    }
  };

  let viewportControls: ViewportControls | undefined;
  let viewportElement: HTMLDivElement | undefined;

  const nodes = createMemo(() => graph.nodes);
  const edges = createMemo(() => graph.edges);

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

  const clearSelection = () => setSelectedIds([]);

  const handleNodeSelect = (event: PointerEvent, nodeId: string) => {
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
      setDragState({ nodeIds: Array.from(idsToMove), startPositions });
      return;
    }

    const state = dragState();
    if (!state) return;

    state.nodeIds.forEach((id) => {
      const start = state.startPositions[id];
      if (!start) return;
      const nextPosition = {
        x: snapToGrid(start.x + delta.x),
        y: snapToGrid(start.y + delta.y),
      };
      const index = graph.nodes.findIndex((node) => node.id === id);
      if (index >= 0) {
        setGraph('nodes', index, 'position', nextPosition);
      }
    });

    if (phase === 'end') {
      setDragState(null);
      const updates = state.nodeIds
        .map((id) => {
          const node = graph.nodes.find((n) => n.id === id);
          return node ? { nodeId: id, position: node.position } : null;
        })
        .filter((value): value is { nodeId: string; position: { x: number; y: number } } => Boolean(value));
      try {
        if (updates.length) {
          await moveNodesMutation(updates);
        }
      } catch (error) {
        console.error('Failed to persist node move', error);
      }
      pushHistory();
    }
  };

  const translatePointerToWorld = (event: PointerEvent) => {
    if (!viewportElement) return null;
    const { scale, translate } = viewportState();
    const rect = viewportElement.getBoundingClientRect();
    const x = (event.clientX - rect.left - translate.x) / scale;
    const y = (event.clientY - rect.top - translate.y) / scale;
    return { x, y };
  };

  const findAnchorAtPoint = (event: PointerEvent) => {
    let element = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
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

  const removeGlobalPointerListeners = () => {
    window.removeEventListener('pointermove', handleGlobalPointerMove, true);
    window.removeEventListener('pointerup', handleGlobalPointerUp, true);
  };

  const handleGlobalPointerMove = (event: PointerEvent) => {
    const active = connectingEdge();
    if (!active || event.pointerId !== active.pointerId) return;
    const basePoint = translatePointerToWorld(event);
    if (!basePoint) return;
    let cursorPoint = basePoint;
    const anchor = findAnchorAtPoint(event);
    if (anchor && anchor.anchor === 'top' && anchor.nodeId !== active.sourceNodeId) {
      const targetNode = graph.nodes.find((n) => n.id === anchor.nodeId);
      if (targetNode) {
        cursorPoint = getAnchorPoint(targetNode, 'top');
        setHoveredAnchor(anchor);
      } else {
        setHoveredAnchor(null);
      }
    } else {
      setHoveredAnchor(null);
    }
    setConnectingEdge((prev) => (prev ? { ...prev, cursorPoint } : prev));
  };

  const handleGlobalPointerUp = (event: PointerEvent) => {
    const active = connectingEdge();
    if (!active || event.pointerId !== active.pointerId) return;
    event.preventDefault();
    const anchor = findAnchorAtPoint(event);
    if (anchor && anchor.anchor === 'top' && anchor.nodeId !== active.sourceNodeId) {
      const exists = graph.edges.some(
        (edge) => edge.sourceId === active.sourceNodeId && edge.targetId === anchor.nodeId
      );
      if (!exists) {
        const id = `${active.sourceNodeId}-${anchor.nodeId}-${Date.now()}`;
        setGraph('edges', (edges) => [
          ...edges,
          { id, sourceId: active.sourceNodeId, targetId: anchor.nodeId, kind: 'manual' },
        ]);
        pushHistory();
        createEdge({
          sourceNodeId: active.sourceNodeId,
          targetNodeId: anchor.nodeId,
          kind: 'manual',
        }).catch((error) => console.error('Failed to persist edge', error));
      }
    }
    setConnectingEdge(null);
    setHoveredAnchor(null);
    removeGlobalPointerListeners();
  };

  const handleAnchorConnectStart = (payload: { nodeId: string; anchor: AnchorType; event: PointerEvent }) => {
    if (connectingEdge()) return;
    if (payload.anchor !== 'bottom') return;
    const node = graph.nodes.find((n) => n.id === payload.nodeId);
    if (!node) return;
    const sourcePoint = getAnchorPoint(node, payload.anchor);
    setConnectingEdge({
      sourceNodeId: payload.nodeId,
      sourceAnchor: payload.anchor,
      pointerId: payload.event.pointerId,
      sourcePoint,
      cursorPoint: sourcePoint,
    });
    setHoveredAnchor(null);
    removeGlobalPointerListeners();
    window.addEventListener('pointermove', handleGlobalPointerMove, true);
    window.addEventListener('pointerup', handleGlobalPointerUp, true);
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
    removeGlobalPointerListeners();
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
    const active = connectingEdge();
    if (!active) return null;
    const path = buildEdgePath(active.sourcePoint, active.cursorPoint);
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
    const active = connectingEdge();
    return active ? { nodeId: active.sourceNodeId, anchor: active.sourceAnchor } : null;
  });

  const createNodeAtViewport = async (preset: {
    type: CanvasNode['type'];
    label: string;
    icon: string;
    accent: string;
    balance?: number;
  }) => {
    if (!viewportElement) return;
    const { scale, translate } = viewportState();
    const rect = viewportElement.getBoundingClientRect();
    const worldCenter = {
      x: (rect.width / 2 - translate.x) / scale,
      y: (rect.height / 2 - translate.y) / scale,
    };

    const position = {
      x: snapToGrid(worldCenter.x - 104),
      y: snapToGrid(worldCenter.y - 66),
    };

    try {
      const nodeId = await createNodeMutation({
        type: preset.type,
        label: preset.label,
        icon: preset.icon,
        accent: preset.accent,
        balanceCents:
          typeof preset.balance === 'number' ? Math.round(preset.balance * 100) : undefined,
        position,
      });

      const newNode: CanvasNode = {
        id: nodeId,
        type: preset.type,
        label: preset.label,
        icon: preset.icon,
        accent: preset.accent,
        balance: preset.balance,
        position,
      };

      setGraph('nodes', (nodes) => [...nodes, newNode]);
      setSelectedIds([newNode.id]);
      setDrawerNodeId(newNode.id);
      setShowHero(false);
      pushHistory();
    } catch (error) {
      console.error('Failed to create node', error);
    }
  };

  const handleCreateMenuSelect = (item: DockMenuItem) => {
    if (item.id === 'automation') {
      const sourceId = selectedIds()[0] ?? graph.nodes.find((node) => node.type === 'income')?.id;
      if (!sourceId) return;
      setDrawerNodeId(null);
      setRuleDrawer({ sourceNodeId: sourceId });
      return;
    }
    setRuleDrawer(null);
    setShowHero(false);
    setCreateModal(item.id as 'income' | 'pod' | 'account');
  };

  const duplicateNode = async (nodeId: string) => {
    const original = graph.nodes.find((node) => node.id === nodeId);
    if (!original) return;
    const position = {
      x: snapToGrid(original.position.x + GRID_SIZE * 2),
      y: snapToGrid(original.position.y + GRID_SIZE * 2),
    };
    try {
      const nodeIdCreated = await createNodeMutation({
        type: original.type,
        label: `${original.label} Copy`,
        icon: original.icon,
        accent: original.accent,
        balanceCents:
          typeof original.balance === 'number' ? Math.round(original.balance * 100) : undefined,
        position,
      });

      const newNode: CanvasNode = {
        ...original,
        id: nodeIdCreated,
        label: `${original.label} Copy`,
        position,
      };
      setGraph('nodes', (nodes) => [...nodes, newNode]);
      setSelectedIds([newNode.id]);
      setDrawerNodeId(newNode.id);
      pushHistory();
    } catch (error) {
      console.error('Failed to duplicate node', error);
    }
  };

  const deleteNode = async (nodeId: string, options: { skipHistory?: boolean } = {}) => {
    try {
      await deleteNodeMutation(nodeId);
    } catch (error) {
      console.error('Failed to delete node', error);
    }
    setGraph('nodes', (nodes) => {
      const filtered = nodes.filter((node) => node.id !== nodeId);
      if (filtered.length === 0) setShowHero(true);
      return filtered;
    });
    setGraph('edges', (edges) => edges.filter((edge) => edge.sourceId !== nodeId && edge.targetId !== nodeId));
    setRules((existing) => existing.filter((rule) => rule.sourceNodeId !== nodeId));
    setSelectedIds((ids) => ids.filter((id) => id !== nodeId));
    if (drawerNodeId() === nodeId) {
      setDrawerNodeId(null);
    }
    if (!options.skipHistory) {
      pushHistory();
    }
  };

  const handleContextMenuAction = async (action: 'details' | 'duplicate' | 'delete') => {
    const menu = contextMenu();
    if (!menu) return;
    if (action === 'details') {
      handleNodeOpenDrawer(menu.nodeId);
    } else if (action === 'duplicate') {
      await duplicateNode(menu.nodeId);
    } else {
      await deleteNode(menu.nodeId);
    }
    setContextMenu(null);
  };

  const deleteSelectedNodes = async () => {
    const ids = selectedIds();
    if (!ids.length) return;
    await Promise.all(ids.map((id) => deleteNode(id, { skipHistory: true })));
    setSelectedIds([]);
    setContextMenu(null);
    pushHistory();
  };

  const drawerOpen = createMemo(() => Boolean(drawerNode()) || Boolean(ruleDrawer()));

  return (
    <div class="relative h-full w-full" classList={{ 'pr-[360px]': drawerOpen() }}>
      <CanvasViewport
        nodes={nodes()}
        edges={edges()}
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
        onAnchorConnectStart={handleAnchorConnectStart}
        onNodeOpenDrawer={handleNodeOpenDrawer}
        onNodeContextMenu={handleNodeContextMenu}
        onMarqueeStart={handleMarqueeStart}
        onMarqueeUpdate={handleMarqueeUpdate}
        onMarqueeEnd={handleMarqueeEnd}
        getRuleCount={getRuleCount}
        connectingFrom={connectingFrom()}
        hoveredAnchor={hoveredAnchor()}
        selectionOverlay={marqueeOverlay()}
      >
        {connectingPreview()}
      </CanvasViewport>
      <Show when={!loading() && showHero() && !hasNodes()}>
        <div class="absolute inset-0 pointer-events-none">
          <div class="pointer-events-auto h-full w-full">
            <EmptyHero
              onCreate={() => {
                setShowHero(false);
                setCreateModal('income');
              }}
            />
          </div>
        </div>
      </Show>
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
      <Show when={drawerNode()}>
        {(node) => (
          <div class="absolute right-0 top-0 z-20 h-full w-[360px] border-l border-slate-200/70 bg-white">
            <NodeDrawer
              node={node()}
              onClose={() => setDrawerNodeId(null)}
              rules={rules()
                .filter((rule) => rule.sourceNodeId === node().id)
                .map((rule) => ({
                  id: rule.id,
                  trigger: rule.trigger === 'incoming' ? 'Triggered by incoming funds' : 'Triggered by date',
                  summary: describeRule(rule),
                }))}
            />
          </div>
        )}
      </Show>
      <Show when={ruleDrawer()}>
        <div class="absolute right-0 top-0 z-30 h-full w-[360px] border-l border-slate-200/70 bg-white">
          <RuleDrawer
            open={Boolean(ruleDrawer())}
            sourceNode={ruleSourceNode()}
            nodes={graph.nodes}
            onClose={() => setRuleDrawer(null)}
            onSave={async (rule) => {
              try {
                const savedId = await saveAutomationRuleMutation({
                  sourceNodeId: rule.sourceNodeId,
                  trigger: rule.trigger,
                  triggerNodeId: rule.triggerNodeId,
                  allocations: rule.allocations,
                });

                const record: RuleRecord = {
                  id: savedId as string,
                  ...rule,
                };
                setRules((existing) => [...existing, record]);
                setGraph('edges', (edges) => {
                  const next = [...edges];
                  rule.allocations.forEach((alloc) => {
                    const exists = next.some(
                      (edge) => edge.sourceId === rule.sourceNodeId && edge.targetId === alloc.targetNodeId,
                    );
                    if (!exists) {
                      next.push({
                        id: `edge-${rule.sourceNodeId}-${alloc.targetNodeId}-${Date.now()}`,
                        sourceId: rule.sourceNodeId,
                        targetId: alloc.targetNodeId,
                        kind: 'automation',
                        ruleId: savedId as string,
                      });
                    }
                  });
                  return next;
                });
                pushHistory();
              } catch (error) {
                console.error('Failed to save automation rule', error);
              } finally {
                setRuleDrawer(null);
              }
            }}
          />
        </div>
      </Show>
      <BottomDock
        zoomPercent={scalePercent()}
        menuItems={dockMenuItems}
        onCreateNode={handleCreateMenuSelect}
        onLinkNodes={() => {
          const first = graph.nodes[0];
          if (first) {
            setSelectedIds([first.id]);
          }
        }}
        onZoomIn={() => viewportControls?.zoomIn()}
        onZoomOut={() => viewportControls?.zoomOut()}
      />
      <IncomeSourceModal
        open={createModal() === 'income'}
        onClose={() => setCreateModal(null)}
        onSubmit={async (name) => {
          await createNodeAtViewport({ type: 'income', label: name, icon: '🏦', accent: '#2563eb' });
        }}
      />
      <PodModal
        open={createModal() === 'pod'}
        onClose={() => setCreateModal(null)}
        onSubmit={async (name) => {
          await createNodeAtViewport({ type: 'pod', label: name, icon: '💰', accent: '#0ea5e9' });
        }}
      />
      <AccountTypeModal
        open={createModal() === 'account'}
        onClose={() => setCreateModal(null)}
        onSubmit={async (option: AccountOption) => {
          await createNodeAtViewport({
            type: option.nodeType,
            label: option.label,
            icon: option.icon,
            accent: option.accent,
          });
        }}
      />
    </div>
  );
};

export default CanvasPage;
