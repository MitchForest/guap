import type { IncomeCadence, MoneyMapNodeKind } from '@guap/types';

export type CanvasNodeKind = MoneyMapNodeKind;

export type CanvasPodType = 'goal' | 'category' | 'envelope' | 'custom';

export type CanvasInflowCadence = Extract<IncomeCadence, 'daily' | 'weekly' | 'monthly'>;

export type CanvasInflow = {
  amount: number;
  cadence: CanvasInflowCadence;
};

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
  podType?: CanvasPodType | null;
  balance?: number;
  inflow?: CanvasInflow | null;
  returnRate?: number;
  icon?: string;
  accent?: string;
  position: { x: number; y: number };
  metadata?: Record<string, unknown> | null;
};

export type CanvasFlow = {
  id: string;
  sourceId: CanvasNode['id'];
  targetId: CanvasNode['id'];
  tag?: string;
  amountCents?: number;
  ruleId?: string;
  percentage?: number;
};

export type CanvasGraph = {
  nodes: CanvasNode[];
  flows: CanvasFlow[];
};
