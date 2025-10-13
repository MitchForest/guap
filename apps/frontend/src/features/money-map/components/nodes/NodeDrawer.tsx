import { Component, For, Show, createEffect, createMemo, createSignal } from 'solid-js';
import { createStore, produce } from 'solid-js/store';
import { Button } from '~/shared/components/ui/button';
import { Input } from '~/shared/components/ui/input';
import type { SelectOption } from '~/shared/components/ui/select';
import {
  Select,
  SelectContent,
  SelectHiddenSelect,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/shared/components/ui/select';
import { CanvasNode, CanvasInflow, CanvasInflowCadence, CanvasPodType } from '~/features/money-map/types/graph';
import type { NodeAllocationStatus } from '../canvas/NodeCard';

type FlowListItem = {
  id: string;
  partnerNodeId: string;
  partnerLabel: string;
  hasRule: boolean;
  tag?: string;
};

type AllocationDraft = {
  id: string;
  percentage: number;
  targetNodeId: string | null;
};

type RuleDraft = {
  id?: string;
  sourceNodeId: string;
  trigger: 'incoming' | 'scheduled';
  triggerNodeId: string | null;
  allocations: Array<{ id: string; percentage: number; targetNodeId: string }>;
};

type NodeDrawerProps = {
  open: boolean;
  node: CanvasNode | null;
  nodes: CanvasNode[];
  onClose: () => void;
  outbound: FlowListItem[];
  inbound: FlowListItem[];
  allocations?: Array<{ id: string; percentage: number; targetLabel: string; targetNodeId: string }>;
  allocationStatus?: NodeAllocationStatus | null;
  initialRule?: RuleDraft | null;
  onSaveRule?: (rule: RuleDraft) => void;
  onUpdateBalance?: (nodeId: string, balance: number | null) => void;
  onUpdateInflow?: (nodeId: string, inflow: CanvasInflow | null) => void;
  onUpdatePodType?: (nodeId: string, podType: CanvasPodType) => void;
  onUpdateReturnRate?: (nodeId: string, returnRate: number | null) => void;
};

const ALLOCATION_TOLERANCE = 0.001;

const createAllocationId = () =>
  `alloc-${
    typeof globalThis.crypto !== 'undefined' && 'randomUUID' in globalThis.crypto
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  }`;

const NodeDrawer: Component<NodeDrawerProps> = (props) => {
  const node = () => props.node;
  const kindLabel = createMemo(() => {
    const current = node();
    if (!current) return 'node';
    if (current.kind === 'income') return 'income source';
    if (current.kind === 'pod') return 'pod';
    if (current.kind === 'goal') return 'goal';
    if (current.kind === 'liability') return 'liability';
    return current.category ? current.category.replace(/-/g, ' ') : 'account';
  });
  const allocationStatus = createMemo<NodeAllocationStatus | null>(() => props.allocationStatus ?? null);
  const automationSummary = createMemo<{
    message: string;
    tone: 'success' | 'warning' | 'danger' | 'info';
    className: string;
  }>(() => {
    const current = node();
    const isIncome = current?.kind === 'income';
    const status = allocationStatus();
    
    if (!status) {
      if (isIncome) {
        return {
          message: 'Define how this income flows onward.',
          tone: 'warning',
          className: 'border-amber-200 bg-amber-50',
        };
      }
      return {
        message: 'Optionally set up automatic forwarding rules.',
        tone: 'info',
        className: 'border-slate-200 bg-slate-50',
      };
    }
    
    const rounded = Math.round(status.total * 10) / 10;
    switch (status.state) {
      case 'complete':
        return {
          message: '100% allocated across destinations.',
          tone: 'success',
          className: 'border-emerald-200 bg-emerald-50',
        };
      case 'under':
        if (isIncome) {
          return {
            message: `Only ${rounded}% allocated. Allocate the remaining funds.`,
            tone: 'warning',
            className: 'border-amber-200 bg-amber-50',
          };
        }
        return {
          message: `${rounded}% allocated. ${(100 - rounded).toFixed(1)}% stays here.`,
          tone: 'info',
          className: 'border-sky-200 bg-sky-50',
        };
      case 'over':
        return {
          message: `${rounded}% allocated. Reduce to 100%.`,
          tone: 'danger',
          className: 'border-rose-200 bg-rose-50',
        };
      default:
        if (isIncome) {
          return {
            message: 'No allocations yet. Create a rule to route this income.',
            tone: 'warning',
            className: 'border-amber-200 bg-amber-50',
          };
        }
        return {
          message: 'No forwarding rules set. Money stays here.',
          tone: 'info',
          className: 'border-slate-200 bg-slate-50',
        };
    }
  });
  const [balanceInput, setBalanceInput] = createSignal('');
  const [balanceError, setBalanceError] = createSignal<string | null>(null);
  const [incomeAmountInput, setIncomeAmountInput] = createSignal('');
  const [incomeCadence, setIncomeCadence] = createSignal<CanvasInflowCadence>('monthly');
  const [incomeError, setIncomeError] = createSignal<string | null>(null);
  const [returnRateInput, setReturnRateInput] = createSignal('');
  const [returnRateError, setReturnRateError] = createSignal<string | null>(null);
  const [balanceDirty, setBalanceDirty] = createSignal(false);
  const [lastSyncedBalance, setLastSyncedBalance] = createSignal('');
  const [incomeDirty, setIncomeDirty] = createSignal(false);
  const [lastSyncedIncomeAmount, setLastSyncedIncomeAmount] = createSignal('');
  const [lastSyncedIncomeCadence, setLastSyncedIncomeCadence] =
    createSignal<CanvasInflowCadence>('monthly');
  const [returnRateDirty, setReturnRateDirty] = createSignal(false);
  const [lastSyncedReturnRate, setLastSyncedReturnRate] = createSignal('');

  const cadenceOptions: SelectOption[] = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'daily', label: 'Daily' },
  ];
  
  // Allocation editing state
  const [trigger, setTrigger] = createSignal<'incoming' | 'scheduled'>('incoming');
  const [triggerNodeId, setTriggerNodeId] = createSignal<string | null>(null);
  const [allocationDrafts, setAllocationDrafts] = createStore<AllocationDraft[]>([]);
  const [allocationError, setAllocationError] = createSignal<string | null>(null);
  const [initializedNodeId, setInitializedNodeId] = createSignal<string | null>(null);
  const [seededRuleSignature, setSeededRuleSignature] = createSignal<string>('');
  const [lastCommittedAllocationSignature, setLastCommittedAllocationSignature] = createSignal<string>('');

  const outboundTargets = createMemo(() => {
    const seen = new Set<string>();
    return props.outbound.reduce<Array<{ targetNodeId: string; label: string }>>((list, flow) => {
      if (!seen.has(flow.partnerNodeId)) {
        seen.add(flow.partnerNodeId);
        list.push({ targetNodeId: flow.partnerNodeId, label: flow.partnerLabel });
      }
      return list;
    }, []);
  });

  const computeRuleSignature = (rule: RuleDraft | null) => {
    if (!rule) return 'none';
    const allocParts = [...rule.allocations]
      .map((alloc) => `${alloc.id ?? alloc.targetNodeId}:${alloc.targetNodeId}:${alloc.percentage}`)
      .sort()
      .join(';');
    return `${rule.id ?? 'draft'}|${rule.trigger}|${rule.triggerNodeId ?? 'self'}|${allocParts}`;
  };

  const computeDraftSignature = (
    drafts: AllocationDraft[],
    triggerValue: 'incoming' | 'scheduled',
    triggerNode: string | null
  ) => {
    const allocParts = [...drafts]
      .map((alloc) => `${alloc.id}:${alloc.targetNodeId ?? 'none'}:${alloc.percentage}`)
      .sort()
      .join(';');
    return `${triggerValue}|${triggerNode ?? 'self'}|${allocParts}`;
  };

  const seedAllocations = (rule: RuleDraft | null) => {
    const existingAllocations = rule?.allocations ?? [];
    const existingByTarget = new Map(existingAllocations.map((alloc) => [alloc.targetNodeId, alloc]));
    const seeded: AllocationDraft[] = [];

    outboundTargets().forEach(({ targetNodeId }) => {
      const existing = existingByTarget.get(targetNodeId);
      if (existing) {
        seeded.push({
          id: existing.id ?? createAllocationId(),
          percentage: existing.percentage,
          targetNodeId: existing.targetNodeId,
        });
        existingByTarget.delete(targetNodeId);
      } else {
        seeded.push({
          id: createAllocationId(),
          percentage: 0,
          targetNodeId,
        });
      }
    });

    existingByTarget.forEach((alloc) => {
      seeded.push({
        id: alloc.id ?? createAllocationId(),
        percentage: alloc.percentage,
        targetNodeId: alloc.targetNodeId,
      });
    });

    if (!seeded.length) {
      seeded.push({
        id: createAllocationId(),
        percentage: 100,
        targetNodeId: null,
      });
    }

    setAllocationDrafts(seeded);
  };

  const commitBalance = () => {
    const current = node();
    if (!current || !props.onUpdateBalance) return;
    const raw = balanceInput().trim();
    if (!raw.length) {
      setBalanceError(null);
      if (current.balance !== null && current.balance !== undefined) {
        props.onUpdateBalance(current.id, null);
      }
      setBalanceDirty(false);
      setLastSyncedBalance('');
      setBalanceInput('');
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      setBalanceError('Enter a valid number.');
      return;
    }
    setBalanceError(null);
    const normalized = String(parsed);
    if (typeof current.balance === 'number' && Math.abs(current.balance - parsed) < 0.0001) {
      setBalanceDirty(false);
      setLastSyncedBalance(normalized);
      setBalanceInput(normalized);
      return;
    }
    props.onUpdateBalance(current.id, parsed);
    setBalanceDirty(false);
    setLastSyncedBalance(normalized);
    setBalanceInput(normalized);
  };

  const commitInflow = () => {
    const current = node();
    if (!current || current.kind !== 'income' || !props.onUpdateInflow) return;
    const raw = incomeAmountInput().trim();
    if (!raw.length) {
      setIncomeError(null);
      if (current.inflow) {
        props.onUpdateInflow(current.id, null);
      }
      setIncomeDirty(false);
      setLastSyncedIncomeAmount('');
      setIncomeAmountInput('');
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setIncomeError('Enter a positive amount.');
      return;
    }
    setIncomeError(null);
    const cadence = incomeCadence();
    const normalized = String(parsed);
    const sameExisting =
      current.inflow &&
      Math.abs(current.inflow.amount - parsed) < 0.0001 &&
      current.inflow.cadence === cadence;
    if (sameExisting) {
      setIncomeDirty(false);
      setLastSyncedIncomeAmount(normalized);
      setLastSyncedIncomeCadence(cadence);
      setIncomeAmountInput(normalized);
      return;
    }
    props.onUpdateInflow(current.id, { amount: parsed, cadence });
    setIncomeDirty(false);
    setLastSyncedIncomeAmount(normalized);
    setLastSyncedIncomeCadence(cadence);
    setIncomeAmountInput(normalized);
  };

  const commitReturnRate = () => {
    const current = node();
    if (!current || !props.onUpdateReturnRate) return;
    const raw = returnRateInput().trim();
    if (!raw.length) {
      setReturnRateError(null);
      if (typeof current.returnRate === 'number') {
        props.onUpdateReturnRate(current.id, null);
      }
      setReturnRateDirty(false);
      setLastSyncedReturnRate('');
      setReturnRateInput('');
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      setReturnRateError('Enter a valid percentage.');
      return;
    }
    const normalized = parsed / 100;
    if (normalized < 0) {
      setReturnRateError('Return rate cannot be negative.');
      return;
    }
    setReturnRateError(null);
    const percentString = String(parsed);
    const existing = typeof current.returnRate === 'number' ? current.returnRate : null;
    if (existing !== null && Math.abs(existing - normalized) < 0.0001) {
      setReturnRateDirty(false);
      setLastSyncedReturnRate(percentString);
      setReturnRateInput(percentString);
      return;
    }
    props.onUpdateReturnRate(current.id, normalized);
    setReturnRateDirty(false);
    setLastSyncedReturnRate(percentString);
    setReturnRateInput(percentString);
  };

  createEffect(() => {
    const isOpen = props.open;
    const current = node();
    if (!isOpen && initializedNodeId()) {
      if (current && current.id === initializedNodeId()) {
        commitBalance();
        commitReturnRate();
        commitInflow();
      }
    }

    if (!isOpen || !current) {
      setInitializedNodeId(null);
      setSeededRuleSignature('');
      setAllocationDrafts([]);
      setAllocationError(null);
      setBalanceInput('');
      setBalanceDirty(false);
      setLastSyncedBalance('');
      setIncomeAmountInput('');
      setIncomeDirty(false);
      setLastSyncedIncomeAmount('');
      setIncomeCadence('monthly');
      setLastSyncedIncomeCadence('monthly');
      setIncomeError(null);
      setReturnRateInput('');
      setReturnRateDirty(false);
      setLastSyncedReturnRate('');
      setReturnRateError(null);
      setLastCommittedAllocationSignature('');
      return;
    }

    const nodeId = current.id;
    const canHaveAllocations = current.kind === 'income' || current.kind === 'account' || current.kind === 'pod';
    const rule = canHaveAllocations ? props.initialRule ?? null : null;
    const signature = computeRuleSignature(rule);

    const normalizedBalance =
      typeof current.balance === 'number' && Number.isFinite(current.balance)
        ? String(current.balance)
        : '';
    const inflow = current.inflow ?? null;
    const normalizedIncomeAmount =
      inflow && typeof inflow.amount === 'number' && Number.isFinite(inflow.amount)
        ? String(inflow.amount)
        : '';
    const cadence = inflow?.cadence ?? 'monthly';
    const normalizedReturnRate =
      typeof current.returnRate === 'number' && Number.isFinite(current.returnRate)
        ? String(current.returnRate * 100)
        : '';

    const isNewNode = initializedNodeId() !== nodeId;

    if (isNewNode) {
      setInitializedNodeId(nodeId);
      setBalanceError(null);
      setIncomeError(null);
      setReturnRateError(null);

      setBalanceInput(normalizedBalance);
      setLastSyncedBalance(normalizedBalance);
      setBalanceDirty(false);

      setIncomeAmountInput(normalizedIncomeAmount);
      setLastSyncedIncomeAmount(normalizedIncomeAmount);
      setIncomeCadence(cadence);
      setLastSyncedIncomeCadence(cadence);
      setIncomeDirty(false);

      setReturnRateInput(normalizedReturnRate);
      setLastSyncedReturnRate(normalizedReturnRate);
      setReturnRateDirty(false);

      setSeededRuleSignature(signature);
      setLastCommittedAllocationSignature(signature);
      if (canHaveAllocations) {
        setTrigger(rule?.trigger ?? 'incoming');
        setTriggerNodeId(rule?.triggerNodeId ?? current.id);
        seedAllocations(rule);
        setAllocationError(null);
      } else {
        setTrigger('incoming');
        setTriggerNodeId(current.id);
        setAllocationDrafts([]);
        setAllocationError(null);
      }
      return;
    }

    if (!balanceDirty() && normalizedBalance !== lastSyncedBalance()) {
      setBalanceInput(normalizedBalance);
      setLastSyncedBalance(normalizedBalance);
    }

    if (!incomeDirty() && normalizedIncomeAmount !== lastSyncedIncomeAmount()) {
      setIncomeAmountInput(normalizedIncomeAmount);
      setLastSyncedIncomeAmount(normalizedIncomeAmount);
    }

    if (!incomeDirty() && cadence !== lastSyncedIncomeCadence()) {
      setIncomeCadence(cadence);
      setLastSyncedIncomeCadence(cadence);
    }

    if (!returnRateDirty() && normalizedReturnRate !== lastSyncedReturnRate()) {
      setReturnRateInput(normalizedReturnRate);
      setLastSyncedReturnRate(normalizedReturnRate);
    }

    if (seededRuleSignature() !== signature) {
      setSeededRuleSignature(signature);
      const matchesCommitted = signature === lastCommittedAllocationSignature();
      if (matchesCommitted) return;

      setLastCommittedAllocationSignature(signature);
      if (canHaveAllocations) {
        setTrigger(rule?.trigger ?? 'incoming');
        setTriggerNodeId(rule?.triggerNodeId ?? current.id);
        seedAllocations(rule);
      } else {
        setAllocationDrafts([]);
      }
      setAllocationError(null);
    }
  });

  createEffect(() => {
    if (!props.open) return;
    const current = node();
    if (!current) return;
    const canHaveAllocations = current.kind === 'income' || current.kind === 'account' || current.kind === 'pod';
    if (!canHaveAllocations) return;

    const targets = outboundTargets();
    const targetSet = new Set(targets.map((target) => target.targetNodeId));
    const ruleTargets = new Set((props.initialRule?.allocations ?? []).map((alloc) => alloc.targetNodeId));

    const existingByTarget = new Map(
      allocationDrafts
        .filter((draft) => draft.targetNodeId)
        .map((draft) => [draft.targetNodeId as string, draft]),
    );

    // Check if we need to add new allocations
    const toAdd: AllocationDraft[] = [];
    targets.forEach(({ targetNodeId }) => {
      if (!existingByTarget.has(targetNodeId)) {
        toAdd.push({
          id: createAllocationId(),
          percentage: 0,
          targetNodeId,
        });
      }
    });

    // Check if we need to remove allocations
    const toRemoveIndices: number[] = [];
    allocationDrafts.forEach((draft, index) => {
      if (!draft.targetNodeId) return;
      if (targetSet.has(draft.targetNodeId)) return;
      if (ruleTargets.has(draft.targetNodeId)) return;
      toRemoveIndices.push(index);
    });

    // Apply changes if needed
    if (toAdd.length > 0 || toRemoveIndices.length > 0) {
      setAllocationDrafts(
        produce((drafts) => {
          // Remove items (in reverse order to maintain indices)
          toRemoveIndices.reverse().forEach(index => {
            drafts.splice(index, 1);
          });
          // Add new items
          toAdd.forEach(item => {
            drafts.push(item);
          });
        })
      );
    }
  });

  createEffect(() => {
    if (!props.open) return;
    const current = node();
    if (!current || !props.onSaveRule) return;
    const canHaveAllocations = current.kind === 'income' || current.kind === 'account' || current.kind === 'pod';
    if (!canHaveAllocations) return;

    const drafts = allocationDrafts;
    if (!drafts.length) {
      setAllocationError(null);
      return;
    }

    const remaining = remainingPercent();
    const missingTarget = drafts.some((alloc) => !alloc.targetNodeId);
    const hasNonZero = drafts.some((alloc) => alloc.percentage > 0);
    const isIncome = current.kind === 'income';

    if (missingTarget && hasNonZero) {
      setAllocationError('Choose a target for every allocation.');
      return;
    }

    // Over-allocation is always an error (can't allocate more than 100%)
    if (remaining < -ALLOCATION_TOLERANCE) {
      setAllocationError('Allocation cannot exceed 100%.');
      return;
    }

    // Under-allocation is only an error for income sources (must be 100%)
    // For accounts/pods, under-allocation means the remainder stays in that account
    if (isIncome && Math.abs(remaining) > ALLOCATION_TOLERANCE) {
      setAllocationError('Income must allocate exactly 100%.');
      return;
    }

    if (missingTarget) {
      setAllocationError(null);
      return;
    }

    setAllocationError(null);

    const triggerValue = trigger();
    const triggerNode = triggerNodeId();
    const signature = computeDraftSignature(drafts, triggerValue, triggerNode);
    if (signature === lastCommittedAllocationSignature()) return;

    const sanitizedAllocations = drafts.map((allocation) => ({
      id: allocation.id,
      percentage: allocation.percentage,
      targetNodeId: allocation.targetNodeId!,
    }));

    props.onSaveRule({
      id: props.initialRule?.id,
      sourceNodeId: current.id,
      trigger: triggerValue,
      triggerNodeId: triggerNode,
      allocations: sanitizedAllocations,
    });
    setLastCommittedAllocationSignature(signature);
  });

  const availableTargets = createMemo(() => {
    const current = node();
    if (!current) return [];
    
    return props.nodes.filter((n) => {
      // Exclude self - prevent direct self-allocation
      if (n.id === current.id) return false;
      
      // Prevent pod from allocating back to its parent account
      if (current.kind === 'pod' && n.id === current.parentId) return false;
      
      // Prevent child pods from being allocation targets of their parent
      if (n.kind === 'pod' && n.parentId === current.id) return false;
      
      return true;
    });
  });
  
  const targetOptions = createMemo<SelectOption[]>(() =>
    availableTargets().map((option) => ({
      value: option.id,
      label: option.label,
    }))
  );
  const podTypeOptions: SelectOption[] = [
    { value: 'goal', label: 'Goal' },
    { value: 'category', label: 'Category' },
    { value: 'envelope', label: 'Envelope' },
    { value: 'custom', label: 'Custom' },
  ];
  
  const remainingPercent = createMemo(() => {
    const total = allocationDrafts.reduce((sum, alloc) => sum + alloc.percentage, 0);
    return 100 - total;
  });

  const multipleAllocations = createMemo(() => allocationDrafts.length > 1);

  const targetLabelLookup = createMemo(() => new Map(props.nodes.map((n) => [n.id, n.label])));

  const updateAllocationDraft = (id: string, partial: Partial<AllocationDraft>) => {
    setAllocationDrafts(
      produce((drafts) => {
        const index = drafts.findIndex((item) => item.id === id);
        if (index !== -1) {
          Object.assign(drafts[index], partial);
        }
      })
    );
  };

  const removeAllocationDraft = (id: string) => {
    if (allocationDrafts.length <= 1) return;
    setAllocationDrafts(
      produce((drafts) => {
        const index = drafts.findIndex((item) => item.id === id);
        if (index !== -1) {
          drafts.splice(index, 1);
        }
      })
    );
  };

  return (
    <aside class="flex h-full w-full flex-col bg-white">
      <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-xl">
            <Show when={node()} fallback="💼">
              {(item) => item().icon ?? '💼'}
            </Show>
          </div>
          <div>
            <h2 class="text-sm font-semibold text-slate-900">{node()?.label ?? 'Node Details'}</h2>
            <p class="text-xs text-subtle capitalize">{kindLabel()}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="xs"
          class="rounded-lg uppercase tracking-[0.18em]"
          onClick={props.onClose}
        >
          Close
        </Button>
      </div>
      <div class="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <section class="space-y-2.5">
          <h3 class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Overview</h3>
          <div class="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <label class="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
              Balance
              <Input
                type="number"
                min="0"
                step="0.01"
                size="sm"
                class="mt-1.5"
                value={balanceInput()}
                onInput={(event) => {
                  setBalanceInput(event.currentTarget.value);
                  setBalanceDirty(true);
                  setBalanceError(null);
                }}
                onBlur={commitBalance}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    commitBalance();
                  }
                }}
                placeholder="0.00"
              />
            </label>
            <Show when={balanceError()}>
              {(message) => <p class="text-xs font-semibold text-rose-600">{message()}</p>}
            </Show>
            <Show when={node() && node()!.kind !== 'income'}>
              <label class="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                Return rate (%)
                <Input
                  type="number"
                  step="0.01"
                  size="sm"
                  class="mt-1.5"
                  placeholder="0.0"
                  value={returnRateInput()}
                  onInput={(event) => {
                    setReturnRateInput(event.currentTarget.value);
                    setReturnRateDirty(true);
                    setReturnRateError(null);
                  }}
                  onBlur={commitReturnRate}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      commitReturnRate();
                    }
                  }}
                  disabled={!props.onUpdateReturnRate}
                />
              </label>
              <Show when={returnRateError()}>
                {(message) => <p class="text-xs font-semibold text-rose-600">{message()}</p>}
              </Show>
            </Show>
          </div>
        </section>

        <Show when={node()?.kind === 'income'}>
          <section class="space-y-2.5">
            <h3 class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Income Settings</h3>
            <div class="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label class="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                  Amount
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    size="sm"
                    class="mt-1"
                    placeholder="0.00"
                    value={incomeAmountInput()}
                    onInput={(event) => {
                      setIncomeAmountInput(event.currentTarget.value);
                      setIncomeDirty(true);
                      setIncomeError(null);
                    }}
                    onBlur={commitInflow}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        commitInflow();
                      }
                    }}
                    disabled={!props.onUpdateInflow}
                  />
                </label>
                <label class="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                  Cadence
                <Select
                  options={cadenceOptions}
                  optionValue="value"
                  optionTextValue="label"
                  value={cadenceOptions.find((option) => option.value === incomeCadence()) ?? cadenceOptions[0]}
                  onChange={(option) => {
                    setIncomeCadence((option?.value as CanvasInflowCadence | undefined) ?? 'monthly');
                    setIncomeDirty(true);
                    queueMicrotask(commitInflow);
                  }}
                  disabled={!props.onUpdateInflow}
                  placeholder={<span class="truncate text-slate-400">Monthly</span>}
                  itemComponent={(itemProps) => <SelectItem {...itemProps} />}
                >
                <SelectTrigger
                  class="mt-1 flex h-[38px] w-full items-center justify-between rounded-xl border border-slate-200 px-3 text-xs text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/30"
                  aria-label="Income cadence"
                >
                    <SelectValue<SelectOption>>
                      {(state) => <span class="truncate">{state.selectedOption()?.label ?? 'Monthly'}</span>}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent />
                  <SelectHiddenSelect name="income-cadence" />
                </Select>
                </label>
              </div>
              <Show when={incomeError()}>
                {(message) => <p class="text-xs font-semibold text-rose-600">{message()}</p>}
              </Show>
            </div>
          </section>
        </Show>

        <Show when={node() && (node()!.kind === 'income' || node()!.kind === 'account' || node()!.kind === 'pod')}>
          <section class="space-y-2.5">
            <h3 class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Outgoing Flows</h3>
            <div class={`space-y-3 rounded-2xl border px-4 py-3.5 ${automationSummary().className}`}>
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <p
                    class={`text-sm font-semibold ${
                      automationSummary().tone === 'success'
                        ? 'text-emerald-700'
                        : automationSummary().tone === 'danger'
                        ? 'text-rose-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {allocationStatus()
                      ? `${Math.round(allocationStatus()!.total)}% allocated`
                      : '0% allocated'}
                  </p>
                  <span
                    class="text-xs font-semibold"
                    classList={{
                      'text-rose-600': remainingPercent() < 0,
                      'text-slate-500': remainingPercent() >= 0,
                    }}
                  >
                    {remainingPercent() < 0
                      ? `${Math.abs(remainingPercent()).toFixed(1)}% over`
                      : `${remainingPercent().toFixed(1)}% remaining`}
                  </span>
                </div>
                <div class="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    class={`h-full transition-all duration-300 ${
                      automationSummary().tone === 'success'
                        ? 'bg-emerald-500'
                        : automationSummary().tone === 'danger'
                        ? 'bg-rose-500'
                        : 'bg-amber-500'
                    }`}
                    style={{
                      width: `${Math.min(allocationStatus()?.total ?? 0, 100)}%`,
                    }}
                  />
                </div>
                <p class="text-xs text-slate-600">{automationSummary().message}</p>
              </div>

              <div class="space-y-2">
                <For each={allocationDrafts}>
                  {(allocation) => {
                    const flow =
                      props.outbound.find((item) => item.partnerNodeId === allocation.targetNodeId) ?? null;
                    const destinationLabel = flow
                      ? flow.partnerLabel
                      : allocation.targetNodeId
                      ? targetLabelLookup().get(allocation.targetNodeId) ?? 'Unknown account'
                      : 'Select destination';
                    const showRemove = !flow && multipleAllocations();

                    return (
                      <div class="rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 shadow-sm">
                        <div class="flex flex-row items-center gap-2">
                          <Show
                            when={flow}
                            fallback={
                              <div class="min-w-0 flex-1">
                                <Select
                                  options={targetOptions()}
                                  optionValue="value"
                                  optionTextValue="label"
                                  value={targetOptions().find((option) => option.value === allocation.targetNodeId) ?? null}
                                  onChange={(option) =>
                                    updateAllocationDraft(allocation.id, {
                                      targetNodeId: option?.value ?? null,
                                    })
                                  }
                                  placeholder={<span class="truncate text-slate-400">Select account</span>}
                                  itemComponent={(itemProps) => <SelectItem {...itemProps} />}
                                >
                                  <SelectTrigger class="h-8 w-full rounded-lg border border-slate-200 text-sm font-medium text-slate-700" aria-label="Allocation target">
                                    <SelectValue<SelectOption>>
                                      {(state) => (
                                        <span class="truncate">{state.selectedOption()?.label ?? 'Select account'}</span>
                                      )}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent />
                                  <SelectHiddenSelect name={`allocation-target-${allocation.id}`} />
                                </Select>
                              </div>
                            }
                          >
                            <div class="min-w-0 flex-1">
                              <p class="text-sm font-semibold text-slate-800 truncate">{destinationLabel}</p>
                            </div>
                          </Show>
                          <div class="flex items-center gap-1">
                            <Input
                              type="number"
                              inputMode="decimal"
                              size="sm"
                              class="h-8 w-16 rounded-lg border border-slate-200 px-2 text-sm font-semibold text-slate-800 shadow-inner"
                              value={allocation.percentage}
                              min={0}
                              max={100}
                              onInput={(event) => {
                                const raw = event.currentTarget.value;
                                const parsed = Number(raw);
                                updateAllocationDraft(allocation.id, {
                                  percentage: Number.isFinite(parsed) ? parsed : 0,
                                });
                              }}
                            />
                            <span class="text-xs font-semibold text-slate-500">%</span>
                          </div>
                          <Show when={showRemove}>
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              class="h-8 px-2 text-xs font-semibold text-slate-400 hover:text-rose-600"
                              onClick={() => removeAllocationDraft(allocation.id)}
                            >
                              Remove
                            </Button>
                          </Show>
                        </div>
                      </div>
                    );
                  }}
                </For>

                <Show when={allocationError()}>
                  <p class="text-xs font-semibold text-rose-600">{allocationError()}</p>
                </Show>
              </div>
            </div>
          </section>
        </Show>

        <Show when={node()?.kind === 'pod'}>
          <section class="space-y-2.5">
            <h3 class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pod Settings</h3>
            <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <label class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Pod type
                <Select
                  options={podTypeOptions}
                  optionValue="value"
                  optionTextValue="label"
                  value={podTypeOptions.find((option) => option.value === (node()?.podType ?? 'goal')) ?? podTypeOptions[0]}
                  onChange={(option) => {
                    const current = node();
                    if (!current || !props.onUpdatePodType) return;
                    const next = (option?.value as CanvasPodType | undefined) ?? current.podType ?? 'goal';
                    props.onUpdatePodType(current.id, next);
                  }}
                  disabled={!props.onUpdatePodType}
                  placeholder={<span class="truncate text-slate-400">Select type</span>}
                  itemComponent={(itemProps) => <SelectItem {...itemProps} />}
                >
                  <SelectTrigger class="mt-2" aria-label="Pod type">
                    <SelectValue<SelectOption>>
                      {(state) => <span class="truncate">{state.selectedOption()?.label ?? 'Select type'}</span>}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent />
                  <SelectHiddenSelect name="pod-type" />
                </Select>
              </label>
            </div>
          </section>
        </Show>

        <section class="space-y-2.5">
          <h3 class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Incoming Flows</h3>
          <Show when={props.inbound.length > 0} fallback={<p class="text-sm text-subtle">No incoming flows yet.</p>}>
            <div class="space-y-2">
              <For each={props.inbound}>
                {(item) => (
                  <div class="rounded-2xl border border-slate-200 px-4 py-3">
                    <div class="flex items-center justify-between">
                      <p class="text-sm font-semibold text-slate-700">From {item.partnerLabel}</p>
                      <Show when={item.hasRule}>
                        <span class="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-700">
                          With rule
                        </span>
                      </Show>
                    </div>
                    <Show when={item.tag}>
                      {(tag) => <p class="mt-1 text-xs text-slate-500">Tag: {tag()}</p>}
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </section>
      </div>
    </aside>
  );
};

export default NodeDrawer;
