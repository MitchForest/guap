import {
  Accessor,
  Component,
  For,
  JSX,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from 'solid-js';
import { CanvasFlow, CanvasNode } from '../../types/graph';
import EdgeLayer from './EdgeLayer';
import NodeCard, { AnchorType } from './NodeCard';

type ViewportControls = {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
};

type DragPayload = {
  nodeId: string;
  delta: { x: number; y: number };
  phase: 'start' | 'move' | 'end';
};

type ConnectionEventPayload = {
  nodeId: string;
  anchor: AnchorType;
  event: PointerEvent;
};

type MarqueePayload = {
  local: { x: number; y: number };
  world: { x: number; y: number };
};

type CanvasViewportProps = {
  nodes: CanvasNode[];
  flows: CanvasFlow[];
  positions?: Map<string, { x: number; y: number }> | null;
  selectedNodeIds?: Set<string>;
  selectionOverlay?: JSX.Element;
  onBackgroundPointerDown?: (event: PointerEvent) => void;
  onViewportChange?: (payload: { scale: number; translate: { x: number; y: number } }) => void;
  onControlsReady?: (controls: ViewportControls) => void;
  onNodeSelect?: (event: PointerEvent, nodeId: string) => void;
  onNodeDrag?: (payload: DragPayload) => void;
  onConnectionStart?: (payload: ConnectionEventPayload) => void;
  onConnectionTargetSelect?: (payload: ConnectionEventPayload) => void;
  onNodeOpenDrawer?: (nodeId: string) => void;
  onNodeContextMenu?: (event: PointerEvent, nodeId: string) => void;
  onMarqueeStart?: (payload: MarqueePayload) => void;
  onMarqueeUpdate?: (payload: MarqueePayload) => void;
  onMarqueeEnd?: (payload: MarqueePayload) => void;
  getRuleCount?: (nodeId: string) => number;
  connectingFrom?: { nodeId: string; anchor: AnchorType } | null;
  hoveredAnchor?: { nodeId: string; anchor: AnchorType } | null;
  connectionMode?: boolean;
  onContainerReady?: (element: HTMLDivElement) => void;
  describeFlow?: (flow: CanvasFlow, source: CanvasNode, target: CanvasNode) => string;
  children?: JSX.Element;
};

const MIN_SCALE = 0.4;
const MAX_SCALE = 2.4;
const ZOOM_INTENSITY = 0.0015;
const ZOOM_STEP = 0.1;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const CanvasViewport: Component<CanvasViewportProps> = (props) => {
  const [scale, setScale] = createSignal(1);
  const [translate, setTranslate] = createSignal({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = createSignal(false);

  let containerRef: HTMLDivElement | undefined;
  let panPointerId: number | null = null;
  let marqueePointerId: number | null = null;
  const panOrigin = { x: 0, y: 0 };
  const panTranslate = { x: 0, y: 0 };

  const nodesForEdges = createMemo(() => nodesForEdgesMemo(props.nodes, props.positions));
  const resolvePosition = (node: CanvasNode) => props.positions?.get(node.id) ?? node.position;

  const viewportState: Accessor<{ scale: number; translate: { x: number; y: number } }> = createMemo(
    () => ({ scale: scale(), translate: translate() })
  );

  const emitViewportChange = () => props.onViewportChange?.(viewportState());

  const toLocalPoint = (event: PointerEvent | WheelEvent) => {
    if (!containerRef) return { x: 0, y: 0 };
    const rect = containerRef.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const toWorldPoint = (local: { x: number; y: number }) => {
    const currentScale = scale();
    const currentTranslate = translate();
    return {
      x: (local.x - currentTranslate.x) / currentScale,
      y: (local.y - currentTranslate.y) / currentScale,
    };
  };

  const applyZoom = (nextScale: number, focalPoint?: { x: number; y: number }) => {
    if (!containerRef) return;
    const clampedScale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    const prevScale = scale();
    const focus =
      focalPoint ?? {
        x: containerRef.clientWidth / 2,
        y: containerRef.clientHeight / 2,
      };

    const prevTranslate = translate();
    const scaleDelta = clampedScale / prevScale;

    const newTranslate = {
      x: focus.x - scaleDelta * (focus.x - prevTranslate.x),
      y: focus.y - scaleDelta * (focus.y - prevTranslate.y),
    };

    setTranslate(newTranslate);
    setScale(clampedScale);
    emitViewportChange();
  };

  const controls: ViewportControls = {
    zoomIn: () => applyZoom(scale() + ZOOM_STEP),
    zoomOut: () => applyZoom(scale() - ZOOM_STEP),
    reset: () => {
      setTranslate({ x: 0, y: 0 });
      setScale(1);
      emitViewportChange();
    },
  };

  onMount(() => {
    attachWheelListener(() => containerRef);
    props.onControlsReady?.(controls);
  });

  const handlePointerDown: JSX.EventHandlerUnion<HTMLDivElement, PointerEvent> = (event) => {
    if (!containerRef) return;

    const targetElement = event.target as Element | null;
    if (targetElement?.closest('[data-node-card="true"]') || targetElement?.closest('[data-anchor-node]')) {
      return;
    }

    const isBackground = (() => {
      if (!targetElement) return false;
      if (targetElement === containerRef) return true;
      if (targetElement instanceof HTMLElement && targetElement.dataset.canvasSurface === 'content') return true;
      const surfaceAncestor = targetElement.closest('[data-canvas-surface="content"]');
      return Boolean(surfaceAncestor);
    })();

    if (isBackground) {
      if (event.shiftKey) {
        const local = toLocalPoint(event);
        const world = toWorldPoint(local);
        marqueePointerId = event.pointerId;
        props.onMarqueeStart?.({ local, world });
        containerRef.setPointerCapture(event.pointerId);
        return;
      }
      props.onBackgroundPointerDown?.(event);
    } else {
      return;
    }
    if (event.button !== 0) return;

    panPointerId = event.pointerId;
    panOrigin.x = event.clientX;
    panOrigin.y = event.clientY;
    const current = translate();
    panTranslate.x = current.x;
    panTranslate.y = current.y;
    setIsPanning(true);
    containerRef.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (marqueePointerId !== null && event.pointerId === marqueePointerId) {
      const local = toLocalPoint(event);
      const world = toWorldPoint(local);
      props.onMarqueeUpdate?.({ local, world });
      return;
    }

    if (!isPanning() || event.pointerId !== panPointerId) return;

    const dx = event.clientX - panOrigin.x;
    const dy = event.clientY - panOrigin.y;

    setTranslate({
      x: panTranslate.x + dx,
      y: panTranslate.y + dy,
    });
    emitViewportChange();
  };

  const stopPanning = (event: PointerEvent) => {
    if (event.pointerId === marqueePointerId) {
      const local = toLocalPoint(event);
      const world = toWorldPoint(local);
      props.onMarqueeEnd?.({ local, world });
      containerRef?.releasePointerCapture(event.pointerId);
      marqueePointerId = null;
      return;
    }

    if (event.pointerId !== panPointerId) return;
    setIsPanning(false);
    panPointerId = null;
    containerRef?.releasePointerCapture(event.pointerId);
    emitViewportChange();
  };

  const handleWheel = (event: WheelEvent) => {
    if (!containerRef) return;
    event.preventDefault();

    const rect = containerRef.getBoundingClientRect();
    const cursor = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };

    const currentScale = scale();
    const nextScale = clamp(currentScale * (1 - event.deltaY * ZOOM_INTENSITY), MIN_SCALE, MAX_SCALE);

    applyZoom(nextScale, cursor);
  };

  const attachWheelListener = (refAccessor: Accessor<HTMLDivElement | undefined>) => {
    const element = refAccessor();
    if (!element) return;
    const handler = (event: WheelEvent) => handleWheel(event);
    element.addEventListener('wheel', handler, { passive: false });
    onCleanup(() => element.removeEventListener('wheel', handler));
  };

  return (
    <div
      ref={(el) => {
        containerRef = el;
        if (el) props.onContainerReady?.(el);
      }}
      class="relative h-full w-full overflow-hidden bg-dot-grid"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopPanning}
      onPointerCancel={stopPanning}
      onPointerLeave={stopPanning}
    >
      <div
        class="absolute left-0 top-0 origin-top-left"
        data-canvas-surface="content"
        style={{
          transform: `translate3d(${translate().x}px, ${translate().y}px, 0) scale(${scale()})`,
        }}
      >
        <EdgeLayer
          nodes={nodesForEdges()}
          flows={props.flows}
          describeFlow={props.describeFlow}
        />
        <For each={props.nodes}>
          {(node) => (
            <NodeCard
              node={node}
              position={resolvePosition(node)}
              scale={scale()}
              selected={props.selectedNodeIds?.has(node.id) ?? false}
              onSelect={props.onNodeSelect}
              onDrag={props.onNodeDrag}
              connectingFrom={props.connectingFrom}
              hoveredAnchor={props.hoveredAnchor}
              connectionMode={props.connectionMode}
              onConnectionStart={props.onConnectionStart}
              onConnectionTargetSelect={props.onConnectionTargetSelect}
              onOpenDrawer={props.onNodeOpenDrawer}
              onContextMenu={props.onNodeContextMenu}
              ruleCount={props.getRuleCount?.(node.id) ?? 0}
            />
          )}
        </For>
        {props.children}
      </div>
      {props.selectionOverlay}
    </div>
  );
};

const nodesForEdgesMemo = (nodes: CanvasNode[], positions?: Map<string, { x: number; y: number }> | null) =>
  nodes.map((node) => {
    const override = positions?.get(node.id);
    if (!override) return node;
    return { ...node, position: override } satisfies CanvasNode;
  });

export default CanvasViewport;
export type { ViewportControls, DragPayload };
