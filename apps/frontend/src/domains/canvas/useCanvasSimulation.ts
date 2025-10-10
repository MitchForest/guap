import { createSignal } from 'solid-js';
import { simulateGraph, type SimulationResult } from '~/utils/simulation';
import type { CanvasNode } from '~/types/graph';

type SimulationAllocation = {
  targetNodeId: string;
  percentage: number;
};

type SimulationRule = {
  sourceNodeId: string;
  allocations: SimulationAllocation[];
};

type UseCanvasSimulationOptions = {
  collectNodes: () => Array<{
    id: string;
    kind: CanvasNode['kind'];
    category?: CanvasNode['category'];
    balance: number;
    inflow: CanvasNode['inflow'] | null;
    returnRate: number;
  }>;
  collectRules: () => SimulationRule[];
  hasNodes: () => boolean;
  hasAllocationIssues: () => boolean;
};

type SimulationSettings = {
  horizonYears: number;
};

const DEFAULT_HORIZON = 10;

export const simulationHorizonOptions = [
  { value: '5', label: '5 Years' },
  { value: '10', label: '10 Years' },
  { value: '20', label: '20 Years' },
  { value: '30', label: '30 Years' },
  { value: '40', label: '40 Years' },
  { value: '50', label: '50 Years' },
] as const;

export const useCanvasSimulation = ({
  collectNodes,
  collectRules,
  hasNodes,
  hasAllocationIssues,
}: UseCanvasSimulationOptions) => {
  const [settings, setSettings] = createSignal<SimulationSettings>({
    horizonYears: DEFAULT_HORIZON,
  });
  const [result, setResult] = createSignal<SimulationResult | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [menuOpen, setMenuOpen] = createSignal(false);

  const runSimulation = (years?: number) => {
    const hasExplicitYears = typeof years === 'number' && Number.isFinite(years) && years > 0;
    const nextHorizon = hasExplicitYears ? (years as number) : settings().horizonYears;

    if (hasExplicitYears) {
      setSettings({ horizonYears: nextHorizon });
    }

    if (!hasNodes()) {
      setError('Add nodes before running a simulation.');
      setResult(null);
      return;
    }

    if (hasAllocationIssues()) {
      setError('Resolve allocation coverage for every income source before simulating.');
      setResult(null);
      return;
    }

    const nodes = collectNodes();
    const rules = collectRules();

    try {
      const simulation = simulateGraph({
        nodes,
        rules,
        settings: { horizonYears: nextHorizon },
      });
      setResult(simulation);
      setError(null);
      setMenuOpen(false);
    } catch (err) {
      console.error('Simulation failed', err);
      setError('Simulation failed. Check console for details.');
      setResult(null);
    }
  };

  const clearSimulation = () => setResult(null);

  return {
    simulationSettings: settings,
    simulationResult: result,
    simulationError: error,
    simulationMenuOpen: menuOpen,
    setSimulationMenuOpen: setMenuOpen,
    runSimulation,
    clearSimulation,
  };
};

