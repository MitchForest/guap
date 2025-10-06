export type CanvasNodeType = 'income' | 'account' | 'pod' | 'goal' | 'liability';

export type CanvasNode = {
  id: string;
  type: CanvasNodeType;
  label: string;
  balance?: number;
  icon?: string;
  accent?: string;
  position: { x: number; y: number };
};

export type CanvasEdge = {
  id: string;
  sourceId: CanvasNode['id'];
  targetId: CanvasNode['id'];
  kind?: 'manual' | 'automation';
  ruleId?: string;
};
