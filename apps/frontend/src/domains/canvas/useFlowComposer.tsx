import { createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import type { CanvasFlow, CanvasNode } from '~/types/graph';
import type { AnchorType } from '~/components/canvas/NodeCard';

export type FlowComposerState =
  | { stage: 'idle' }
  | { stage: 'pickSource' }
  | {
      stage: 'pickTarget';
      sourceNodeId: string;
      sourcePoint: { x: number; y: number };
      cursorPoint: { x: number; y: number };
    };

type UseFlowComposerOptions = {
  getNodes: () => CanvasNode[];
  getFlows: () => CanvasFlow[];
  updateFlows: (updater: (flows: CanvasFlow[]) => CanvasFlow[]) => void;
  pushHistory: () => void;
  openDrawer: (nodeId: string) => void;
  translateClientToWorld: (clientX: number, clientY: number) => { x: number; y: number } | null;
  getAnchorPoint: (node: CanvasNode, anchor: AnchorType) => { x: number; y: number };
  buildEdgePath: (from: { x: number; y: number }, to: { x: number; y: number }) => string;
};

type FlowAnchor = { nodeId: string; anchor: AnchorType };

const findAnchorAtClientPoint = (clientX: number, clientY: number): FlowAnchor | null => {
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

export const useFlowComposer = ({
  getNodes,
  getFlows,
  updateFlows,
  pushHistory,
  openDrawer,
  translateClientToWorld,
  getAnchorPoint,
  buildEdgePath,
}: UseFlowComposerOptions) => {
  const [composer, setComposer] = createSignal<FlowComposerState>({ stage: 'idle' });
  const [hoveredAnchor, setHoveredAnchor] = createSignal<FlowAnchor | null>(null);

  const updateCursor = (clientX: number, clientY: number) => {
    const state = composer();
    if (state.stage !== 'pickTarget') return;
    const worldPoint = translateClientToWorld(clientX, clientY);
    if (!worldPoint) return;

    let cursorPoint = worldPoint;
    const anchor = findAnchorAtClientPoint(clientX, clientY);
    if (anchor && anchor.anchor === 'top' && anchor.nodeId !== state.sourceNodeId) {
      const targetNode = getNodes().find((node) => node.id === anchor.nodeId);
      if (targetNode) {
        cursorPoint = getAnchorPoint(targetNode, 'top');
        setHoveredAnchor(anchor);
      } else {
        setHoveredAnchor(null);
      }
    } else {
      setHoveredAnchor(null);
    }

    setComposer((prev) => (prev.stage === 'pickTarget' ? { ...prev, cursorPoint } : prev));
  };

  const exitFlowMode = () => {
    setComposer({ stage: 'idle' });
    setHoveredAnchor(null);
  };

  const completeFlow = (targetNodeId: string) => {
    const state = composer();
    if (state.stage !== 'pickTarget') return;
    if (targetNodeId === state.sourceNodeId) {
      exitFlowMode();
      return;
    }

    const flows = getFlows();
    const exists = flows.some(
      (flow) => flow.sourceId === state.sourceNodeId && flow.targetId === targetNodeId
    );
    if (!exists) {
      const newFlow: CanvasFlow = {
        id: `${state.sourceNodeId}-${targetNodeId}-${Date.now()}`,
        sourceId: state.sourceNodeId,
        targetId: targetNodeId,
        tag: 'Flow',
      };
      updateFlows((current) => [...current, newFlow]);
      pushHistory();

      const sourceNode = getNodes().find((node) => node.id === state.sourceNodeId);
      if (sourceNode?.kind === 'income') {
        openDrawer(state.sourceNodeId);
      }
    }

    exitFlowMode();
  };

  const startFlowFromNode = (nodeId: string, pointer?: PointerEvent) => {
    const node = getNodes().find((n) => n.id === nodeId);
    if (!node) return;
    const sourcePoint = getAnchorPoint(node, 'bottom');
    const initialCursor = pointer
      ? translateClientToWorld(pointer.clientX, pointer.clientY) ?? sourcePoint
      : sourcePoint;

    setComposer({
      stage: 'pickTarget',
      sourceNodeId: nodeId,
      sourcePoint,
      cursorPoint: initialCursor,
    });
    setHoveredAnchor(null);
    if (pointer) {
      updateCursor(pointer.clientX, pointer.clientY);
    }
  };

  const enterFlowMode = () => {
    const state = composer();
    if (state.stage === 'pickTarget') {
      exitFlowMode();
    }
    setComposer({ stage: 'pickSource' });
    setHoveredAnchor(null);
  };

  const handleFlowStartFromAnchor = (payload: { nodeId: string; anchor: AnchorType; event: PointerEvent }) => {
    if (payload.anchor !== 'bottom') return;
    const state = composer();
    if (state.stage === 'pickTarget' && state.sourceNodeId === payload.nodeId) return;
    startFlowFromNode(payload.nodeId, payload.event);
  };

  const handleFlowTargetSelect = (payload: {
    nodeId: string;
    anchor: AnchorType;
    event: PointerEvent;
  }) => {
    if (payload.anchor !== 'top') return;
    const state = composer();
    if (state.stage !== 'pickTarget') return;
    const targetNode = getNodes().find((node) => node.id === payload.nodeId);
    if (!targetNode) return;
    const targetPoint = getAnchorPoint(targetNode, payload.anchor);
    setComposer((prev) =>
      prev.stage === 'pickTarget' ? { ...prev, cursorPoint: targetPoint } : prev
    );
    setHoveredAnchor({ nodeId: payload.nodeId, anchor: 'top' });
    completeFlow(payload.nodeId);
  };

  const connectingPreview = createMemo(() => {
    const state = composer();
    if (state.stage !== 'pickTarget') return null;
    const path = buildEdgePath(state.sourcePoint, state.cursorPoint);
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
    const state = composer();
    return state.stage === 'pickTarget'
      ? { nodeId: state.sourceNodeId, anchor: 'bottom' as AnchorType }
      : null;
  });

  createEffect(() => {
    const state = composer();
    if (state.stage !== 'pickTarget') {
      setHoveredAnchor(null);
      return;
    }

    const handlePointer = (event: PointerEvent) => updateCursor(event.clientX, event.clientY);
    const handleMouse = (event: MouseEvent) => updateCursor(event.clientX, event.clientY);
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        exitFlowMode();
      }
    };

    window.addEventListener('pointermove', handlePointer, true);
    window.addEventListener('pointermove', handlePointer);
    window.addEventListener('mousemove', handleMouse, true);
    window.addEventListener('mousemove', handleMouse);
    window.addEventListener('keydown', handleKey);

    onCleanup(() => {
      window.removeEventListener('pointermove', handlePointer, true);
      window.removeEventListener('pointermove', handlePointer);
      window.removeEventListener('mousemove', handleMouse, true);
      window.removeEventListener('mousemove', handleMouse);
      window.removeEventListener('keydown', handleKey);
    });
  });

  onCleanup(() => {
    setHoveredAnchor(null);
    setComposer({ stage: 'idle' });
  });

  return {
    flowComposer: composer,
    hoveredAnchor,
    connectingPreview,
    connectingFrom,
    enterFlowMode,
    exitFlowMode,
    startFlowFromNode,
    completeFlow,
    handleFlowStartFromAnchor,
    handleFlowTargetSelect,
  };
};

