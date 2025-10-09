import { CanvasInflowCadence, CanvasNode } from '../types/graph';

type SimulationNode = {
  id: string;
  kind: CanvasNode['kind'];
  category?: CanvasNode['category'];
  balance: number;
  inflow?: { amount: number; cadence: CanvasInflowCadence } | null;
  returnRate: number;
};

type SimulationRule = {
  sourceNodeId: string;
  allocations: Array<{ targetNodeId: string; percentage: number }>;
};

type SimulationSettings = {
  horizonYears: number;
};

type SimulationPoint = {
  month: number;
  total: number;
  balances: Record<string, number>;
};

type SimulationMilestone = {
  label: string;
  threshold: number;
  reachedAtMonth: number | null;
};

export type SimulationResult = {
  points: SimulationPoint[];
  milestones: SimulationMilestone[];
  finalBalances: Record<string, number>;
  finalTotal: number;
};

type SimulationInput = {
  nodes: SimulationNode[];
  rules: SimulationRule[];
  settings: SimulationSettings;
};

const WEALTH_LADDER: SimulationMilestone[] = [
  { label: 'Level 1: $10k', threshold: 10_000, reachedAtMonth: null },
  { label: 'Level 2: $100k', threshold: 100_000, reachedAtMonth: null },
  { label: 'Level 3: $1M', threshold: 1_000_000, reachedAtMonth: null },
  { label: 'Level 4: $10M', threshold: 10_000_000, reachedAtMonth: null },
  { label: 'Level 5: $100M', threshold: 100_000_000, reachedAtMonth: null },
];

const cadenceToMonthly = (inflow: SimulationNode['inflow']): number => {
  if (!inflow) return 0;
  switch (inflow.cadence) {
    case 'daily':
      return inflow.amount * 30;
    case 'weekly':
      return inflow.amount * 4;
    case 'monthly':
    default:
      return inflow.amount;
  }
};

const cloneMilestones = () => WEALTH_LADDER.map((milestone) => ({ ...milestone }));

export const simulateGraph = ({ nodes, rules, settings }: SimulationInput): SimulationResult => {
  const months = Math.max(1, Math.round(settings.horizonYears * 12));

  const state = new Map<string, {
    kind: CanvasNode['kind'];
    balance: number;
    inflowMonthly: number;
    returnRate: number;
  }>();

  nodes.forEach((node) => {
    const inflowMonthly = cadenceToMonthly(node.inflow ?? null);
    const returnRate = Number.isFinite(node.returnRate) ? node.returnRate : 0;
    state.set(node.id, {
      kind: node.kind,
      balance: Number.isFinite(node.balance) ? node.balance : 0,
      inflowMonthly,
      returnRate,
    });
  });

  const allocationMap = new Map<string, Array<{ targetId: string; weight: number }>>();
  rules.forEach((rule) => {
    const allocations = rule.allocations
      .filter((alloc) => alloc.targetNodeId && Number.isFinite(alloc.percentage))
      .map((alloc) => ({ targetId: alloc.targetNodeId, weight: Math.max(0, alloc.percentage / 100) }));
    if (allocations.length) {
      allocationMap.set(rule.sourceNodeId, allocations);
    }
  });

  const captureBalances = (): Record<string, number> => {
    const snapshot: Record<string, number> = {};
    state.forEach((value, id) => {
      snapshot[id] = value.balance;
    });
    return snapshot;
  };

  const computeTotal = () => {
    let total = 0;
    state.forEach((value) => {
      total += value.balance;
    });
    return total;
  };

  const points: SimulationPoint[] = [];
  const milestones = cloneMilestones();

  points.push({ month: 0, total: computeTotal(), balances: captureBalances() });

  for (let month = 1; month <= months; month += 1) {
    // Apply return rates
    state.forEach((value) => {
      if (value.returnRate === 0) return;
      const monthlyRate = value.returnRate / 12;
      value.balance *= 1 + monthlyRate;
    });

    // Add inflows and distribute according to rules
    allocationMap.forEach((allocations, sourceId) => {
      const sourceState = state.get(sourceId);
      if (!sourceState) return;
      const inflow = sourceState.inflowMonthly;
      if (inflow <= 0) return;

      sourceState.balance += inflow;

      allocations.forEach((allocation) => {
        const targetState = state.get(allocation.targetId);
        if (!targetState) return;
        const amount = inflow * allocation.weight;
        if (amount <= 0) return;
        sourceState.balance -= amount;
        targetState.balance += amount;
      });

      // Any leftover remains with the source node
      if (sourceState.balance < 0) {
        // Prevent numerical drift from pushing income negative
        sourceState.balance = Math.max(0, sourceState.balance);
      }
    });

    points.push({ month, total: computeTotal(), balances: captureBalances() });
  }

  // Determine milestone completion
  points.forEach((point) => {
    milestones.forEach((milestone) => {
      if (milestone.reachedAtMonth !== null) return;
      if (point.total >= milestone.threshold) {
        milestone.reachedAtMonth = point.month;
      }
    });
  });

  const finalPoint = points[points.length - 1];

  return {
    points,
    milestones,
    finalBalances: finalPoint.balances,
    finalTotal: finalPoint.total,
  };
};

export type { SimulationInput, SimulationSettings, SimulationRule, SimulationNode, SimulationPoint, SimulationMilestone };
