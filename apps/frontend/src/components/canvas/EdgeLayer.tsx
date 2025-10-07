import { Component, For, createMemo } from 'solid-js';
import { CanvasEdge, CanvasNode } from '../../types/graph';
import { AnchorType, NODE_CARD_HEIGHT, NODE_CARD_WIDTH } from './NodeCard';

type EdgeLayerProps = {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  describeEdge?: (edge: CanvasEdge, source: CanvasNode, target: CanvasNode) => string;
};

const buildNodeIndex = (nodes: CanvasNode[]) =>
  nodes.reduce<Record<string, CanvasNode>>((acc, node) => {
    acc[node.id] = node;
    return acc;
  }, {});

export const getAnchorPoint = (node: CanvasNode, anchor: AnchorType) => {
  const x = node.position.x + NODE_CARD_WIDTH / 2;
  if (anchor === 'top') {
    return { x, y: node.position.y };
  }
  return { x, y: node.position.y + NODE_CARD_HEIGHT };
};

export const buildEdgePath = (source: { x: number; y: number }, target: { x: number; y: number }) => {
  const verticalGap = Math.max(Math.abs(target.y - source.y), 40);
  const control = Math.max(verticalGap * 0.35, 80);

  const c1 = { x: source.x, y: source.y + control };
  const c2 = { x: target.x, y: target.y - control };

  return `M ${source.x} ${source.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${target.x} ${target.y}`;
};

const EdgeLayer: Component<EdgeLayerProps> = (props) => {
  const nodeIndex = createMemo(() => buildNodeIndex(props.nodes));
  const bounds = createMemo(() => {
    if (props.nodes.length === 0) {
      return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of props.nodes) {
      const { x, y } = node.position;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      const right = x + NODE_CARD_WIDTH;
      const bottom = y + NODE_CARD_HEIGHT;
      if (right > maxX) maxX = right;
      if (bottom > maxY) maxY = bottom;
    }

    return {
      minX: Math.min(0, minX),
      minY: Math.min(0, minY),
      maxX,
      maxY,
    };
  });

  const padding = 200;
  const viewBox = createMemo(() => {
    const box = bounds();
    const width = Math.max(box.maxX - box.minX, 1) + padding * 2;
    const height = Math.max(box.maxY - box.minY, 1) + padding * 2;
    const x = box.minX - padding;
    const y = box.minY - padding;
    return { x, y, width, height };
  });

  return (
    <svg
      class="absolute left-0 top-0 pointer-events-none"
      style={{
        overflow: 'visible',
        width: `${viewBox().width}px`,
        height: `${viewBox().height}px`,
      }}
      viewBox={`${viewBox().x} ${viewBox().y} ${viewBox().width} ${viewBox().height}`}
    >
      <For each={props.edges}>
        {(edge) => {
          const source = nodeIndex()[edge.sourceId];
          const target = nodeIndex()[edge.targetId];

          if (!source || !target) return null;

          const path = buildEdgePath(getAnchorPoint(source, 'bottom'), getAnchorPoint(target, 'top'));
          const description = props.describeEdge
            ? props.describeEdge(edge, source, target)
            : `${source.label} → ${target.label}`;

          const strokeColor = edge.kind === 'automation' ? '#0891b2' : '#475569';
          const strokeWidth = edge.kind === 'automation' ? 2.5 : 3.5;
          const strokeDash = edge.kind === 'automation' ? '10 6' : undefined;

          return (
            <path
              id={`edge-${edge.id}`}
              d={path}
              stroke={strokeColor}
              stroke-width={strokeWidth}
              stroke-dasharray={strokeDash}
              fill="none"
              stroke-linecap="round"
              stroke-opacity={0.9}
              style={{
                'pointer-events': 'stroke' as const,
                filter: edge.kind === 'automation'
                  ? 'drop-shadow(0 1px 3px rgba(8, 145, 178, 0.35))'
                  : 'drop-shadow(0 2px 4px rgba(15, 23, 42, 0.25))',
              }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <title>{description}</title>
            </path>
          );
        }}
      </For>
    </svg>
  );
};

export default EdgeLayer;
