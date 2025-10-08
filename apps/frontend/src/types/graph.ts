export type CanvasNodeKind = 'income' | 'account' | 'subAccount';

export type CanvasAccountCategory =
  | 'checking'
  | 'savings'
  | 'brokerage'
  | 'creditCard'
  | 'other'
  | 'cd'
  | '401k'
  | 'ira'
  | 'education'
  | 'mortgage'
  | 'auto-loan'
  | 'student-loan'
  | 'business-loan';

export type CanvasNode = {
  id: string;
  kind: CanvasNodeKind;
  label: string;
  category?: CanvasAccountCategory;
  parentId?: string | null;
  balance?: number;
  icon?: string;
  accent?: string;
  position: { x: number; y: number };
};

export type CanvasFlowTone = 'manual' | 'auto';

export type CanvasFlow = {
  id: string;
  sourceId: CanvasNode['id'];
  targetId: CanvasNode['id'];
  tone: CanvasFlowTone;
  tag?: string;
  amountCents?: number;
  note?: string;
  ruleId?: string;
};

export type CanvasGraph = {
  nodes: CanvasNode[];
  flows: CanvasFlow[];
};
