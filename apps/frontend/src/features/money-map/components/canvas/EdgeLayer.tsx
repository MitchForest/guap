import { Component, For, Show, createMemo } from 'solid-js';
import { CanvasFlow, CanvasNode } from '~/features/money-map/types/graph';
import { AnchorType, NODE_CARD_HEIGHT, NODE_CARD_WIDTH } from './NodeCard';
import { EDGE_LAYER_PADDING, buildEdgeViewBox } from './canvasGeometry';

type EdgeLayerProps = {
  nodes: CanvasNode[];
  flows: CanvasFlow[];
  describeFlow?: (flow: CanvasFlow, source: CanvasNode, target: CanvasNode) => string;
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
  const viewBox = createMemo(() => buildEdgeViewBox(props.nodes, EDGE_LAYER_PADDING));

  return (
    <svg
      class="absolute left-0 top-0 pointer-events-none"
      style={{
        overflow: 'visible',
        width: `${viewBox().width}px`,
        height: `${viewBox().height}px`,
        transform: `translate3d(${viewBox().x}px, ${viewBox().y}px, 0)`,
      }}
      viewBox={`${viewBox().x} ${viewBox().y} ${viewBox().width} ${viewBox().height}`}
    >
      <For each={props.flows}>
        {(flow) => {
          const edge = createMemo(() => {
            const index = nodeIndex();
            const sourceNode = index[flow.sourceId];
            const targetNode = index[flow.targetId];
            if (!sourceNode || !targetNode) return null;

            const path = buildEdgePath(
              getAnchorPoint(sourceNode, 'bottom'),
              getAnchorPoint(targetNode, 'top')
            );

            const description = props.describeFlow
              ? props.describeFlow(flow, sourceNode, targetNode)
              : `${sourceNode.label} → ${targetNode.label}`;

            return { path, description };
          });

          const isAuto = Boolean(flow.ruleId);
          const strokeColor = isAuto ? '#0891b2' : '#475569';
          const strokeWidth = isAuto ? 2.5 : 3.5;
          const strokeDash = isAuto ? '10 6' : undefined;

          return (
            <Show when={edge()} keyed>
              {(data) => (
                <path
                  id={`flow-${flow.id}`}
                  d={data.path}
                  stroke={strokeColor}
                  stroke-width={strokeWidth}
                  stroke-dasharray={strokeDash}
                  fill="none"
                  stroke-linecap="round"
                  stroke-opacity={0.9}
                  style={{
                    'pointer-events': 'stroke' as const,
                    filter: isAuto
                      ? 'drop-shadow(0 1px 3px rgba(8, 145, 178, 0.35))'
                      : 'drop-shadow(0 2px 4px rgba(15, 23, 42, 0.25))',
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <title>{data.description}</title>
                </path>
              )}
            </Show>
          );
        }}
      </For>
    </svg>
  );
};

export default EdgeLayer;
