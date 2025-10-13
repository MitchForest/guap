import { createMemo, createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';
import type { SetStoreFunction } from 'solid-js/store';
import { createHistory } from './history';
import type { DragPayload } from '~/features/money-map/components/canvas/CanvasViewport';
import type { CanvasFlow, CanvasNode } from '~/features/money-map/types/graph';
import type { CanvasSnapshot, RuleRecord } from '~/features/money-map/types';

type GraphStore = {
  nodes: CanvasNode[];
  flows: CanvasFlow[];
};

type DragState = {
  nodeIds: string[];
  startPositions: Record<string, { x: number; y: number }>;
  delta: { x: number; y: number };
};

type MarqueeState = {
  originLocal: { x: number; y: number };
  currentLocal: { x: number; y: number };
  originWorld: { x: number; y: number };
  currentWorld: { x: number; y: number };
};

type OverlayRect = { left: number; top: number; width: number; height: number };

export type CanvasEditorOptions = {
  initialSnapshot?: Partial<CanvasSnapshot>;
  historyCap?: number;
  snapToGrid?: (value: number) => number;
  gridSize?: number;
  nodeCardWidth?: number;
  nodeCardHeight?: number;
};

export type CanvasEditor = {
  graph: GraphStore;
  setGraph: SetStoreFunction<GraphStore>;
  rules: () => RuleRecord[];
  setRules: (updater: RuleRecord[] | ((rules: RuleRecord[]) => RuleRecord[])) => void;
  selectedIds: () => string[];
  setSelectedIds: (updater: string[] | ((ids: string[]) => string[])) => void;
  selectedIdSet: () => Set<string>;
  ensureSelection: (nodeId: string, additive: boolean) => void;
  clearSelection: () => void;
  snapshotGraph: () => CanvasSnapshot;
  applySnapshot: (snapshot: CanvasSnapshot) => void;
  resetGraphState: () => void;
  onSnapshotApplied: (listener: () => void) => () => void;
  drag: {
    state: () => DragState | null;
    livePositions: () => Map<string, { x: number; y: number }> | null;
    handleNodeDrag: (payload: DragPayload) => void;
    reset: () => void;
  };
  marquee: {
    state: () => MarqueeState | null;
    overlayRect: () => OverlayRect | null;
    start: (payload: { local: { x: number; y: number }; world: { x: number; y: number } }) => void;
    update: (payload: { local: { x: number; y: number }; world: { x: number; y: number } }) => void;
    end: (payload: { local: { x: number; y: number }; world: { x: number; y: number } }) => void;
    clear: () => void;
  };
  placement: {
    index: () => number;
    set: (value: number) => void;
    increment: (delta?: number) => void;
  };
  history: {
    historyIndex: () => number;
    hasChanges: () => boolean;
    setHasChanges: (value: boolean) => void;
    pushHistory: (snapshot?: CanvasSnapshot) => void;
    replaceHistory: (snapshot: CanvasSnapshot) => void;
    undo: () => void;
    redo: () => void;
    resetHistory: () => void;
  };
};

const cloneSnapshot = (snapshot: CanvasSnapshot): CanvasSnapshot => ({
  nodes: snapshot.nodes.map((node) => ({
    ...node,
    position: { ...node.position },
  })),
  flows: snapshot.flows.map((flow) => ({ ...flow })),
  rules: snapshot.rules.map((rule) => ({
    ...rule,
    allocations: rule.allocations.map((allocation) => ({ ...allocation })),
  })),
  selectedIds: [...snapshot.selectedIds],
});

const rectsIntersect = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;

const computeWorldRect = (
  origin: { x: number; y: number },
  current: { x: number; y: number }
) => {
  const x = Math.min(origin.x, current.x);
  const y = Math.min(origin.y, current.y);
  const width = Math.abs(origin.x - current.x);
  const height = Math.abs(origin.y - current.y);
  return { x, y, width, height };
};

export const createCanvasEditor = (options: CanvasEditorOptions = {}): CanvasEditor => {
  const initialSnapshot = options.initialSnapshot ?? {};
  const nodeCardWidth = options.nodeCardWidth ?? 280;
  const nodeCardHeight = options.nodeCardHeight ?? 180;
  const snap =
    options.snapToGrid ??
    ((value: number) => {
      const gridSize = options.gridSize ?? 1;
      return gridSize > 0 ? Math.round(value / gridSize) * gridSize : value;
    });
  const [graph, setGraph] = createStore<GraphStore>({
    nodes: initialSnapshot.nodes ? [...initialSnapshot.nodes] : [],
    flows: initialSnapshot.flows ? [...initialSnapshot.flows] : [],
  });
  const [rules, setRulesSignal] = createSignal<RuleRecord[]>(
    initialSnapshot.rules ? [...initialSnapshot.rules] : []
  );
  const [selectedIds, setSelectedIdsSignal] = createSignal<string[]>(
    initialSnapshot.selectedIds ? [...initialSnapshot.selectedIds] : []
  );

  const selectedIdSet = createMemo<Set<string>>(() => new Set(selectedIds()));

  const ensureSelection = (nodeId: string, additive: boolean) => {
    setSelectedIdsSignal((current) => {
      const next = new Set(current);
      if (additive) {
        if (next.has(nodeId)) {
          next.delete(nodeId);
        } else {
          next.add(nodeId);
        }
        return [...next];
      }
      return next.has(nodeId) && next.size === 1 ? [...next] : [nodeId];
    });
  };

  const clearSelection = () => {
    setSelectedIdsSignal([]);
  };

  const [dragState, setDragState] = createSignal<DragState | null>(null);
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

  const [marquee, setMarquee] = createSignal<MarqueeState | null>(null);
  const marqueeOverlayRect = createMemo<OverlayRect | null>(() => {
    const data = marquee();
    if (!data) return null;
    const left = Math.min(data.originLocal.x, data.currentLocal.x);
    const top = Math.min(data.originLocal.y, data.currentLocal.y);
    const width = Math.abs(data.originLocal.x - data.currentLocal.x);
    const height = Math.abs(data.originLocal.y - data.currentLocal.y);
    return { left, top, width, height };
  });

  const [placementIndex, setPlacementIndex] = createSignal(
    initialSnapshot.nodes ? initialSnapshot.nodes.length : 0
  );

  const snapshotGraph = (): CanvasSnapshot =>
    cloneSnapshot({
      nodes: graph.nodes,
      flows: graph.flows,
      rules: rules(),
      selectedIds: selectedIds(),
    });

  const updateSelectionFromMarquee = (
    originWorld: { x: number; y: number },
    currentWorld: { x: number; y: number }
  ) => {
    const rect = computeWorldRect(originWorld, currentWorld);
    const selected = graph.nodes
      .filter((node) =>
        rectsIntersect(
          {
            x: node.position.x,
            y: node.position.y,
            width: nodeCardWidth,
            height: nodeCardHeight,
          },
          rect
        )
      )
      .map((node) => node.id);
    setSelectedIdsSignal(selected);
  };

  const snapshotAppliedListeners = new Set<() => void>();

  const notifySnapshotApplied = () => {
    snapshotAppliedListeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error('[canvasEditor] snapshot listener failed', error);
      }
    });
  };

  const applySnapshot = (snap: CanvasSnapshot) => {
    const clone = cloneSnapshot(snap);
    setGraph('nodes', () => clone.nodes);
    setGraph('flows', () => clone.flows);
    setRulesSignal(clone.rules);
    setSelectedIdsSignal(clone.selectedIds);
    setPlacementIndex(clone.nodes.length);
    setDragState(null);
    setMarquee(null);
    notifySnapshotApplied();
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
  } = createHistory<CanvasSnapshot>({
    snapshotSource: snapshotGraph,
    applySnapshot,
    cloneSnapshot,
    cap: options.historyCap,
  });

  if (historyIndex() === -1) {
    replaceHistory(snapshotGraph());
  }

  const handleNodeDrag = (payload: DragPayload) => {
    const { nodeId, delta, phase } = payload;

    if (phase === 'start') {
      let idsToMove = new Set(selectedIds());
      if (!idsToMove.has(nodeId)) {
        idsToMove = new Set([nodeId]);
        setSelectedIdsSignal([...idsToMove]);
      }
      const startPositions: Record<string, { x: number; y: number }> = {};
      idsToMove.forEach((id) => {
        const node = graph.nodes.find((n) => n.id === id);
        if (node) {
          startPositions[id] = { x: node.position.x, y: node.position.y };
        }
      });
      setDragState({
        nodeIds: Array.from(idsToMove),
        startPositions,
        delta: { x: 0, y: 0 },
      });
      return;
    }

    const state = dragState();
    if (!state) return;

    if (phase === 'move') {
      setDragState((prev) =>
        prev ? { ...prev, delta: { x: delta.x, y: delta.y } } : prev
      );
      return;
    }

    if (phase === 'end') {
      const finalDelta = state.delta;
      let moved = false;
      state.nodeIds.forEach((id) => {
        const start = state.startPositions[id];
        if (!start) return;
        const nextPosition = {
          x: snap(start.x + finalDelta.x),
          y: snap(start.y + finalDelta.y),
        };
        const index = graph.nodes.findIndex((node) => node.id === id);
        if (index >= 0) {
          const { x, y } = graph.nodes[index].position;
          if (x !== nextPosition.x || y !== nextPosition.y) {
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

  const startMarquee = (payload: {
    local: { x: number; y: number };
    world: { x: number; y: number };
  }) => {
    setMarquee({
      originLocal: payload.local,
      currentLocal: payload.local,
      originWorld: payload.world,
      currentWorld: payload.world,
    });
    setSelectedIdsSignal([]);
  };

  const updateMarquee = (payload: {
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

  const endMarquee = (payload: {
    local: { x: number; y: number };
    world: { x: number; y: number };
  }) => {
    setMarquee((prev) => {
      if (!prev) return null;
      updateSelectionFromMarquee(prev.originWorld, payload.world);
      return null;
    });
  };

  const clearMarquee = () => setMarquee(null);

  const resetGraphState = () => {
    setGraph('nodes', () => []);
    setGraph('flows', () => []);
    setRulesSignal([]);
    setSelectedIdsSignal([]);
    setPlacementIndex(0);
    setDragState(null);
    setMarquee(null);
    resetHistory();
  };

  return {
    graph,
    setGraph,
    rules,
    setRules: (updater) => {
      if (typeof updater === 'function') {
        setRulesSignal((current) => (updater as (rules: RuleRecord[]) => RuleRecord[])(current));
      } else {
        setRulesSignal(updater);
      }
    },
    selectedIds,
    setSelectedIds: (updater) => {
      if (typeof updater === 'function') {
        setSelectedIdsSignal((current) => (updater as (ids: string[]) => string[])(current));
      } else {
        setSelectedIdsSignal(updater);
      }
    },
    selectedIdSet,
    ensureSelection,
    clearSelection,
    snapshotGraph,
    applySnapshot,
    resetGraphState,
    onSnapshotApplied: (listener: () => void) => {
      snapshotAppliedListeners.add(listener);
      return () => snapshotAppliedListeners.delete(listener);
    },
    drag: {
      state: dragState,
      livePositions,
      handleNodeDrag,
      reset: () => setDragState(null),
    },
    marquee: {
      state: marquee,
      overlayRect: marqueeOverlayRect,
      start: startMarquee,
      update: updateMarquee,
      end: endMarquee,
      clear: clearMarquee,
    },
    placement: {
      index: placementIndex,
      set: (value: number) => setPlacementIndex(() => value),
      increment: (delta = 1) => setPlacementIndex((prev) => prev + delta),
    },
    history: {
      historyIndex,
      hasChanges,
      setHasChanges,
      pushHistory,
      replaceHistory,
      undo,
      redo,
      resetHistory,
    },
  };
};
