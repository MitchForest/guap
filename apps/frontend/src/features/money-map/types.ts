import type { CanvasFlow, CanvasNode } from '~/types/graph';

export type RuleAllocationRecord = {
  id: string;
  targetNodeId: string;
  percentage: number;
};

export type RuleRecord = {
  id: string;
  sourceNodeId: string;
  trigger: 'incoming' | 'scheduled';
  triggerNodeId: string | null;
  allocations: RuleAllocationRecord[];
};

export type AllocationHealth = 'missing' | 'under' | 'over' | 'complete';

export type AllocationIssue = {
  nodeId: string;
  label: string;
  total: number;
  state: AllocationHealth;
};

export type CanvasSnapshot = {
  nodes: CanvasNode[];
  flows: CanvasFlow[];
  rules: RuleRecord[];
  selectedIds: string[];
};
