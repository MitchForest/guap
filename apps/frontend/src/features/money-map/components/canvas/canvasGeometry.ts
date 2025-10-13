import { CanvasNode } from '~/features/money-map/types/graph';
import { NODE_CARD_HEIGHT, NODE_CARD_WIDTH } from './NodeCard';

export type CanvasExtents = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type EdgeViewBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const EDGE_LAYER_PADDING = 200;

export const getNodeExtents = (nodes: CanvasNode[]): CanvasExtents => {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: NODE_CARD_WIDTH, maxY: NODE_CARD_HEIGHT };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
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
};

export const buildEdgeViewBox = (nodes: CanvasNode[], padding = EDGE_LAYER_PADDING): EdgeViewBox => {
  const { minX, minY, maxX, maxY } = getNodeExtents(nodes);
  const width = Math.max(maxX - minX, 1) + padding * 2;
  const height = Math.max(maxY - minY, 1) + padding * 2;
  return {
    x: minX - padding,
    y: minY - padding,
    width,
    height,
  };
};
