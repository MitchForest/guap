import { Component, Show } from 'solid-js';
import { Motion } from 'solid-motionone';
import { CanvasNode } from '../../types/graph';
import { DragPayload } from './CanvasViewport';

export const NODE_CARD_WIDTH = 208;
export const NODE_CARD_HEIGHT = 132;
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
  onAnchorConnectStart?: (payload: { nodeId: string; anchor: AnchorType; event: PointerEvent }) => void;
  connectingFrom?: { nodeId: string; anchor: AnchorType } | null;
  hoveredAnchor?: { nodeId: string; anchor: AnchorType } | null;
  onOpenDrawer?: (nodeId: string) => void;
  onContextMenu?: (event: PointerEvent, nodeId: string) => void;
  ruleCount?: number;
};

const NodeCard: Component<NodeCardProps> = (props) => {
  const { node } = props;
  const accent = () => node.accent ?? '#312e81';
  const icon = () => node.icon ?? '🏦';

  let element: HTMLDivElement | undefined;
  let isDragging = false;
  const startPointer = { x: 0, y: 0 };
  const anchorClass = (anchor: AnchorType) => {
    const isSource =
      props.connectingFrom?.nodeId === node.id && props.connectingFrom?.anchor === anchor;
    const isHovered = props.hoveredAnchor?.nodeId === node.id && props.hoveredAnchor?.anchor === anchor;
    return [
      'absolute h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white shadow-sm transition',
      isSource || isHovered ? 'bg-slate-900' : 'bg-slate-300',
    ].join(' ');
  };

  const anchorStyle = (anchor: AnchorType) =>
    anchor === 'top'
      ? { left: '50%', top: '-8px' }
      : { left: '50%', bottom: '-8px' };

  const handlePointerDown: PointerEventHandler = (event) => {
    event.stopPropagation();
    props.onSelect?.(event, node.id);
    startPointer.x = event.clientX;
    startPointer.y = event.clientY;
    isDragging = true;
    element?.setPointerCapture(event.pointerId);
    props.onDrag?.({ nodeId: node.id, delta: { x: 0, y: 0 }, phase: 'start' });
    element?.classList.add('cursor-grabbing');
  };

  const handlePointerMove: PointerEventHandler = (event) => {
    if (!isDragging) return;
    const scale = props.scale || 1;
    const dx = (event.clientX - startPointer.x) / scale;
    const dy = (event.clientY - startPointer.y) / scale;
    props.onDrag?.({ nodeId: node.id, delta: { x: dx, y: dy }, phase: 'move' });
  };

  const handlePointerUp: PointerEventHandler = (event) => {
    if (!isDragging) return;
    const scale = props.scale || 1;
    const dx = (event.clientX - startPointer.x) / scale;
    const dy = (event.clientY - startPointer.y) / scale;
    props.onDrag?.({ nodeId: node.id, delta: { x: dx, y: dy }, phase: 'end' });
    element?.releasePointerCapture(event.pointerId);
    isDragging = false;
    element?.classList.remove('cursor-grabbing');
  };

  const handleAnchorPointerDown = (anchor: AnchorType) => (event: PointerEvent) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    props.onSelect?.(event, node.id);
    props.onAnchorConnectStart?.({ nodeId: node.id, anchor, event });
  };

  const handleDoubleClick: PointerEventHandler = () => {
    props.onOpenDrawer?.(node.id);
  };

  const handleContextMenu: PointerEventHandler = (event) => {
    event.preventDefault();
    props.onContextMenu?.(event, node.id);
  };

  return (
    <Motion.div
      ref={(el: HTMLDivElement) => (element = el)}
      class={GRID_CLASS}
      classList={{ 'ring-4 ring-offset-2 ring-offset-white ring-sky-400/50': props.selected }}
      style={{
        width: `${NODE_CARD_WIDTH}px`,
        height: `${NODE_CARD_HEIGHT}px`,
        transform: `translate3d(${node.position.x}px, ${node.position.y}px, 0)`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDblClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: props.selected ? 1.02 : 1 }}
      transition={{ duration: 0.2 }}
    >
      <span
        class={anchorClass('top')}
        style={anchorStyle('top')}
        data-anchor-node={node.id}
        data-anchor-type="top"
        onPointerDown={handleAnchorPointerDown('top')}
      />
      <div class="flex items-center gap-3">
        <div
          class="flex h-11 w-11 items-center justify-center rounded-xl"
          style={{ background: `${accent()}1A`, color: accent() }}
        >
          <span class="text-xl">{icon()}</span>
        </div>
        <div>
          <p class="text-sm font-semibold text-slate-800">{node.label}</p>
          <p class="text-xs capitalize text-slate-500">{node.type}</p>
        </div>
      </div>
      <Show when={(props.ruleCount ?? 0) > 0}>
        <div class="mt-3 flex items-center gap-2">
          <span class="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
            {props.ruleCount} rule{props.ruleCount && props.ruleCount > 1 ? 's' : ''}
          </span>
        </div>
      </Show>
      {node.balance !== undefined ? (
        <p class="mt-5 text-2xl font-semibold text-slate-900">
          {formatter.format(node.balance)}
        </p>
      ) : (
        <p class="mt-5 text-sm text-slate-500">Balance not set</p>
      )}
      <span
        class={anchorClass('bottom')}
        style={anchorStyle('bottom')}
        data-anchor-node={node.id}
        data-anchor-type="bottom"
        onPointerDown={handleAnchorPointerDown('bottom')}
      />
    </Motion.div>
  );
};

type PointerEventHandler = (event: PointerEvent) => void;

export default NodeCard;
