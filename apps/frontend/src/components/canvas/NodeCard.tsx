import { Component, JSX, createMemo, createSignal } from 'solid-js';
import { Motion } from 'solid-motionone';
import { CanvasNode } from '../../types/graph';
import { DragPayload } from './CanvasViewport';

export const NODE_CARD_WIDTH = 240;
export const NODE_CARD_HEIGHT = 120;
export type AnchorType = 'top' | 'bottom';

const GRID_CLASS =
  'absolute select-none rounded-2xl border border-slate-200/60 bg-white p-4 shadow-card cursor-grab';

const formatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

type NodeCardProps = {
  node: CanvasNode;
  scale: number;
  selected?: boolean;
  onSelect?: (event: PointerEvent, nodeId: string) => void;
  onDrag?: (payload: DragPayload) => void;
  onConnectionStart?: (payload: { nodeId: string; anchor: AnchorType; event: PointerEvent }) => void;
  onConnectionTargetSelect?: (payload: { nodeId: string; anchor: AnchorType; event: PointerEvent }) => void;
  connectingFrom?: { nodeId: string; anchor: AnchorType } | null;
  hoveredAnchor?: { nodeId: string; anchor: AnchorType } | null;
  connectionMode?: boolean;
  onOpenDrawer?: (nodeId: string) => void;
  onContextMenu?: (event: PointerEvent, nodeId: string) => void;
  ruleCount?: number;
};

const NodeCard: Component<NodeCardProps> = (props) => {
  const { node } = props;
  const accent = () => node.accent ?? '#312e81';
  const icon = () => node.icon ?? '🏦';

  const isConnectingFromHere = createMemo(
    () => props.connectingFrom?.nodeId === node.id && props.connectingFrom?.anchor === 'bottom'
  );
  const isDropTarget = createMemo(
    () => props.hoveredAnchor?.nodeId === node.id && props.hoveredAnchor?.anchor === 'top'
  );
  const canAcceptConnection = createMemo(
    () => Boolean(props.connectionMode) && props.connectingFrom?.nodeId !== node.id
  );

  let element: HTMLDivElement | undefined;
  let isDragging = false;
  let hasDragged = false;
  const startPointer = { x: 0, y: 0 };
  const [hovered, setHovered] = createSignal(false);
  const connectorVisible = createMemo(
    () => {
      if (props.connectionMode) {
        return isConnectingFromHere();
      }
      return hovered() || props.selected || props.connectingFrom?.nodeId === node.id;
    }
  );

  const handlePointerDown: JSX.EventHandlerUnion<HTMLDivElement, PointerEvent> = (event) => {
    if (props.connectionMode && !isConnectingFromHere()) {
      if (event.button !== 0) return;
      event.stopPropagation();
      event.preventDefault();
      event.stopImmediatePropagation?.();
      props.onConnectionTargetSelect?.({ nodeId: node.id, anchor: 'top', event });
      return;
    }
    if (event.defaultPrevented) return;
    event.stopPropagation();
    props.onSelect?.(event, node.id);
    startPointer.x = event.clientX;
    startPointer.y = event.clientY;
    isDragging = true;
    hasDragged = false;
    element?.setPointerCapture(event.pointerId);
    props.onDrag?.({ nodeId: node.id, delta: { x: 0, y: 0 }, phase: 'start' });
    element?.classList.add('cursor-grabbing');
  };

  const handlePointerMove: JSX.EventHandlerUnion<HTMLDivElement, PointerEvent> = (event) => {
    if (!isDragging) return;
    const scale = props.scale || 1;
    const dx = (event.clientX - startPointer.x) / scale;
    const dy = (event.clientY - startPointer.y) / scale;
    if (!hasDragged && Math.hypot(dx, dy) > 3) {
      hasDragged = true;
    }
    props.onDrag?.({ nodeId: node.id, delta: { x: dx, y: dy }, phase: 'move' });
  };

  const handlePointerUp: JSX.EventHandlerUnion<HTMLDivElement, PointerEvent> = (event) => {
    if (!isDragging) return;
    const scale = props.scale || 1;
    const dx = (event.clientX - startPointer.x) / scale;
    const dy = (event.clientY - startPointer.y) / scale;
    props.onDrag?.({ nodeId: node.id, delta: { x: dx, y: dy }, phase: 'end' });
    element?.releasePointerCapture(event.pointerId);
    isDragging = false;
    element?.classList.remove('cursor-grabbing');

    if (event.button !== 0) return;
    if (hasDragged) return;
    if (event.shiftKey || event.metaKey || event.ctrlKey) return;
    props.onOpenDrawer?.(node.id);
  };

  const handleConnectorPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    event.stopImmediatePropagation?.();
    props.onSelect?.(event, node.id);
    console.log('[connect] source pointer down', {
      nodeId: node.id,
      label: node.label,
      connectionMode: props.connectionMode,
    });
    props.onConnectionStart?.({ nodeId: node.id, anchor: 'bottom', event });
  };

  const handleTargetPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    if (!canAcceptConnection()) return;
    event.stopPropagation();
    event.preventDefault();
    event.stopImmediatePropagation?.();
    console.log('[connect] target pointer down', {
      nodeId: node.id,
      label: node.label,
      isDropTarget: isDropTarget(),
      connectingFrom: props.connectingFrom,
    });
    props.onConnectionTargetSelect?.({ nodeId: node.id, anchor: 'top', event });
  };

  const handleDoubleClick: JSX.EventHandlerUnion<HTMLDivElement, MouseEvent> = (event) => {
    props.onSelect?.(event as unknown as PointerEvent, node.id);
    props.onOpenDrawer?.(node.id);
  };

  const handleContextMenu: JSX.EventHandlerUnion<HTMLDivElement, MouseEvent> = (event) => {
    event.preventDefault();
    props.onSelect?.(event as unknown as PointerEvent, node.id);
    props.onContextMenu?.(event as unknown as PointerEvent, node.id);
  };

  return (
    <div
      ref={(el: HTMLDivElement) => (element = el)}
      class={`${GRID_CLASS} group`}
      classList={{ 'ring-4 ring-offset-2 ring-offset-white ring-sky-400/50': props.selected }}
      style={{
        width: `${NODE_CARD_WIDTH}px`,
        height: `${NODE_CARD_HEIGHT}px`,
        transform: `translate3d(${node.position.x}px, ${node.position.y}px, 0)`
      }}
      data-node-card="true"
      data-node-card-id={node.id}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDblClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <Motion.div
        class="relative h-full w-full"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: props.selected ? 1.02 : 1 }}
        transition={{ duration: 0.2 }}
      >
        <div class="absolute left-1/2 top-0 flex -translate-x-1/2 -translate-y-full flex-col items-center">
          <button
            type="button"
            class="h-8 w-24"
            data-anchor-node={node.id}
            data-anchor-type="top"
            aria-label="Connect to this node"
            onPointerDown={handleTargetPointerDown}
            classList={{ 'pointer-events-none': !canAcceptConnection() }}
            style={{ opacity: 0 }}
          />
          <Motion.div
            class="pointer-events-none h-8 w-8 -translate-y-2 rounded-full"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{
              opacity: isDropTarget() ? 1 : canAcceptConnection() ? 0.7 : 0,
              scale: isDropTarget() ? 1.05 : canAcceptConnection() ? 0.9 : 0.6,
            }}
            transition={{ duration: 0.18, easing: [0.16, 1, 0.3, 1] }}
            style={{
              border: `2px solid ${accent()}70`,
              background: `${accent()}12`,
              'box-shadow': isDropTarget()
                ? `0 0 0 10px ${accent()}18`
                : `0 0 0 8px ${accent()}12`,
            }}
          />
        </div>
        <div class="flex items-center gap-3">
          <div
            class="flex h-11 w-11 items-center justify-center rounded-xl"
            style={{ background: `${accent()}1A`, color: accent() }}
          >
            <span class="text-xl">{icon()}</span>
          </div>
          <div>
            <p class="text-sm font-semibold text-slate-800 truncate">{node.label}</p>
            <p class="text-xs capitalize text-slate-500">{node.type}</p>
          </div>
        </div>
        {node.balance !== undefined ? (
          <p class="mt-5 text-2xl font-semibold text-slate-900">
            {formatter.format(node.balance)}
          </p>
        ) : (
          <p class="mt-5 text-sm text-slate-500">Balance not set</p>
        )}
        <Motion.div
          class="pointer-events-none absolute left-1/2 bottom-0 flex -translate-x-1/2 translate-y-full"
          initial={{ opacity: 0, scale: 0.6, y: 16 }}
          animate={{
            opacity: connectorVisible() ? 1 : 0,
            scale: connectorVisible() ? 1 : 0.6,
            y: connectorVisible() ? 0 : 16,
          }}
          transition={{ duration: 0.22, easing: [0.22, 1, 0.36, 1] }}
        >
          <button
            type="button"
            class="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl font-semibold text-slate-700 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
            data-anchor-node={node.id}
            data-anchor-type="bottom"
            onPointerDown={handleConnectorPointerDown}
            onPointerEnter={() => setHovered(true)}
            onPointerLeave={() => setHovered(false)}
            style={{
              border: `2px solid ${accent()}50`,
              color: accent(),
              'box-shadow': isConnectingFromHere()
                ? `0 8px 20px ${accent()}35`
                : `0 6px 16px ${accent()}20`,
              transform: isConnectingFromHere() ? 'translateY(-4px)' : undefined,
            }}
            classList={{ 'pointer-events-none opacity-60': props.connectionMode && !isConnectingFromHere() }}
          >
            <span class="-mt-0.5 text-lg leading-none">＋</span>
          </button>
        </Motion.div>
      </Motion.div>
    </div>
  );
};

export default NodeCard;
