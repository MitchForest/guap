import { CanvasInflowCadence, CanvasNode } from '~/features/money-map/types/graph';

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
    // Apply return rates with monthly compounding
    // returnRate is treated as APY (Annual Percentage Yield)
    // Convert to equivalent monthly rate: (1 + annual)^(1/12) - 1
    state.forEach((value) => {
      if (value.returnRate === 0) return;
      const monthlyRate = Math.pow(1 + value.returnRate, 1 / 12) - 1;
      value.balance *= 1 + monthlyRate;
    });

    // Track incoming flows this month for cascading allocations
    const monthlyInflows = new Map<string, number>();
    
    // Step 1: Add all income source inflows to their balances
    state.forEach((value, id) => {
      if (value.inflowMonthly > 0) {
        value.balance += value.inflowMonthly;
        monthlyInflows.set(id, value.inflowMonthly);
      }
    });

    // Step 2: Process allocations in cascading order
    // Income nodes allocate their monthly inflow
    // Accounts/pods allocate whatever they just received
    const processed = new Set<string>();
    const maxIterations = allocationMap.size * 2; // Allow for deep chains
    let iteration = 0;
    
    while (processed.size < allocationMap.size && iteration < maxIterations) {
      iteration++;
      let madeProgress = false;
      
      allocationMap.forEach((allocations, sourceId) => {
        if (processed.has(sourceId)) return;
        
        const sourceState = state.get(sourceId);
        if (!sourceState) {
          processed.add(sourceId);
          return;
        }
        
        // Determine what amount to allocate:
        // - Income: allocate the monthly inflow
        // - Accounts/Pods: allocate what they received this month (cascading)
        let amountToAllocate = 0;
        if (sourceState.kind === 'income') {
          amountToAllocate = sourceState.inflowMonthly;
        } else {
          amountToAllocate = monthlyInflows.get(sourceId) ?? 0;
        }
        
        if (amountToAllocate <= 0) {
          processed.add(sourceId);
          madeProgress = true;
          return;
        }
        
        // Distribute to targets
        allocations.forEach((allocation) => {
          const targetState = state.get(allocation.targetId);
          if (!targetState) return;
          
          // Prevent self-allocation
          if (allocation.targetId === sourceId) return;
          
          const amount = amountToAllocate * allocation.weight;
          if (amount <= 0) return;
          
          sourceState.balance -= amount;
          targetState.balance += amount;
          
          // Track that target received this amount (for cascading)
          monthlyInflows.set(allocation.targetId, (monthlyInflows.get(allocation.targetId) ?? 0) + amount);
        });
        
        processed.add(sourceId);
        madeProgress = true;
      });
      
      if (!madeProgress) {
        // Circular dependency detected - break to prevent infinite loop
        console.warn('Circular dependency detected in allocation rules. Iteration stopped.');
        break;
      }
    }

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
