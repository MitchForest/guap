import { Component, For, createMemo } from 'solid-js';
import { CanvasEdge, CanvasNode } from '../../types/graph';
import { AnchorType, NODE_CARD_HEIGHT, NODE_CARD_WIDTH } from './NodeCard';

type EdgeLayerProps = {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
};

const buildNodeIndex = (nodes: CanvasNode[]) =>
  nodes.reduce<Record<string, CanvasNode>>((acc, node) => {
    acc[node.id] = node;
    return acc;
  }, {});

export type AnchorType = 'top' | 'bottom';

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

  return (
    <svg class="absolute inset-0 h-full w-full" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="edgeStroke" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#94a3b8" stop-opacity="0.35" />
          <stop offset="100%" stop-color="#0f172a" stop-opacity="0.45" />
        </linearGradient>
      </defs>
      <For each={props.edges}>
        {(edge) => {
          const source = nodeIndex()[edge.sourceId];
          const target = nodeIndex()[edge.targetId];

          if (!source || !target) return null;

          const path = buildEdgePath(getAnchorPoint(source, 'bottom'), getAnchorPoint(target, 'top'));

          return (
            <path
              id={`edge-${edge.id}`}
              d={path}
              stroke="url(#edgeStroke)"
              stroke-width={edge.kind === 'automation' ? 3 : 4}
              stroke-dasharray={edge.kind === 'automation' ? '8 6' : undefined}
              fill="none"
              stroke-linecap="round"
              opacity={edge.kind === 'automation' ? 0.85 : 0.9}
            />
          );
        }}
      </For>
    </svg>
  );
};

export default EdgeLayer;
