import { Component, For, Show, createEffect, createMemo, createSignal } from 'solid-js';
import { Button } from '~/components/ui/button';
import type { SelectOption } from '~/components/ui/select';
import {
  Select,
  SelectContent,
  SelectHiddenSelect,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { CanvasNode, CanvasInflow, CanvasInflowCadence, CanvasPodType } from '../../types/graph';
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
  const automationSummary = createMemo(() => {
    const status = allocationStatus();
    if (!status) {
      return {
        message: 'Define how this income flows onward.',
        tone: 'warning' as const,
        className: 'border-amber-200 bg-amber-50',
      };
    }
    const rounded = Math.round(status.total * 10) / 10;
    switch (status.state) {
      case 'complete':
        return {
          message: '100% allocated across destinations.',
          tone: 'success' as const,
          className: 'border-emerald-200 bg-emerald-50',
        };
      case 'under':
        return {
          message: `Only ${rounded}% allocated. Allocate the remaining funds.`,
          tone: 'warning' as const,
          className: 'border-amber-200 bg-amber-50',
        };
      case 'over':
        return {
          message: `${rounded}% allocated. Reduce allocations to 100%.`,
          tone: 'danger' as const,
          className: 'border-rose-200 bg-rose-50',
        };
      default:
        return {
          message: 'No allocations yet. Create a rule to route this income.',
          tone: 'warning' as const,
          className: 'border-amber-200 bg-amber-50',
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

  const cadenceOptions: SelectOption[] = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'daily', label: 'Daily' },
  ];
  
  // Allocation editing state
  const [trigger, setTrigger] = createSignal<'incoming' | 'scheduled'>('incoming');
  const [triggerNodeId, setTriggerNodeId] = createSignal<string | null>(null);
  const [allocationDrafts, setAllocationDrafts] = createSignal<AllocationDraft[]>([]);
  const [allocationError, setAllocationError] = createSignal<string | null>(null);
  const [initializedNodeId, setInitializedNodeId] = createSignal<string | null>(null);
  const [seededRuleSignature, setSeededRuleSignature] = createSignal<string>('');

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

  createEffect(() => {
    const isOpen = props.open;
    const current = node();
    if (!isOpen || !current) {
      setInitializedNodeId(null);
      setSeededRuleSignature('');
      setAllocationDrafts([]);
      setAllocationError(null);
      return;
    }

    const rule = current.kind === 'income' ? props.initialRule ?? null : null;
    const signature = computeRuleSignature(rule);
    const nodeId = current.id;

    const normalizedBalance = typeof current.balance === 'number' ? String(current.balance) : '';
    if (balanceInput() !== normalizedBalance) {
      setBalanceInput(normalizedBalance);
    }

    const inflow = current.inflow ?? null;
    const normalizedIncomeAmount =
      inflow && typeof inflow.amount === 'number' ? String(inflow.amount) : '';
    if (incomeAmountInput() !== normalizedIncomeAmount) {
      setIncomeAmountInput(normalizedIncomeAmount);
    }

    const cadence = inflow?.cadence ?? 'monthly';
    if (incomeCadence() !== cadence) {
      setIncomeCadence(cadence);
    }

    const normalizedReturnRate =
      typeof current.returnRate === 'number' && Number.isFinite(current.returnRate)
        ? String(current.returnRate * 100)
        : '';
    if (returnRateInput() !== normalizedReturnRate) {
      setReturnRateInput(normalizedReturnRate);
    }

    if (initializedNodeId() === nodeId && seededRuleSignature() === signature) {
      return;
    }

    setInitializedNodeId(nodeId);
    setSeededRuleSignature(signature);
    setBalanceError(null);
    setIncomeError(null);
    setReturnRateError(null);

    if (current.kind === 'income') {
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
  });

  createEffect(() => {
    if (!props.open) return;
    const current = node();
    if (!current || current.kind !== 'income') return;

    const targets = outboundTargets();
    const targetSet = new Set(targets.map((target) => target.targetNodeId));
    const ruleTargets = new Set((props.initialRule?.allocations ?? []).map((alloc) => alloc.targetNodeId));

    setAllocationDrafts((drafts) => {
      let changed = false;
      const next = drafts.slice();
      const existingByTarget = new Map(
        drafts
          .filter((draft) => draft.targetNodeId)
          .map((draft) => [draft.targetNodeId as string, draft]),
      );

      targets.forEach(({ targetNodeId }) => {
        if (!existingByTarget.has(targetNodeId)) {
          next.push({
            id: createAllocationId(),
            percentage: 0,
            targetNodeId,
          });
          changed = true;
        }
      });

      const filtered = next.filter((draft) => {
        if (!draft.targetNodeId) return true;
        if (targetSet.has(draft.targetNodeId)) return true;
        return ruleTargets.has(draft.targetNodeId);
      });

      if (filtered.length !== next.length) {
        changed = true;
      }

      if (!changed) return drafts;
      return filtered;
    });
  });

  const commitBalance = () => {
    const current = node();
    if (!current || !props.onUpdateBalance) return;
    const raw = balanceInput().trim();
    if (!raw.length) {
      setBalanceError(null);
      props.onUpdateBalance(current.id, null);
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      setBalanceError('Enter a valid number.');
      return;
    }
    setBalanceError(null);
    if (typeof current.balance === 'number' && Math.abs(current.balance - parsed) < 0.0001) return;
    props.onUpdateBalance(current.id, parsed);
  };

  const commitInflow = () => {
    const current = node();
    if (!current || current.kind !== 'income' || !props.onUpdateInflow) return;
    const raw = incomeAmountInput().trim();
    if (!raw.length) {
      setIncomeError(null);
      props.onUpdateInflow(current.id, null);
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setIncomeError('Enter a positive amount.');
      return;
    }
    setIncomeError(null);
    const cadence = incomeCadence();
    const sameExisting =
      current.inflow &&
      Math.abs(current.inflow.amount - parsed) < 0.0001 &&
      current.inflow.cadence === cadence;
    if (sameExisting) return;
    props.onUpdateInflow(current.id, { amount: parsed, cadence });
  };

  const commitReturnRate = () => {
    const current = node();
    if (!current || !props.onUpdateReturnRate) return;
    const raw = returnRateInput().trim();
    if (!raw.length) {
      setReturnRateError(null);
      props.onUpdateReturnRate(current.id, null);
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
    const existing = typeof current.returnRate === 'number' ? current.returnRate : null;
    if (existing !== null && Math.abs(existing - normalized) < 0.0001) return;
    props.onUpdateReturnRate(current.id, normalized);
  };

  const availableTargets = createMemo(() => props.nodes.filter((n) => n.id !== node()?.id));
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
    const total = allocationDrafts().reduce((sum, alloc) => sum + alloc.percentage, 0);
    return 100 - total;
  });

  const multipleAllocations = createMemo(() => allocationDrafts().length > 1);

  const targetLabelLookup = createMemo(() => new Map(props.nodes.map((n) => [n.id, n.label])));

  const updateAllocationDraft = (id: string, partial: Partial<AllocationDraft>) => {
    setAllocationDrafts((list) =>
      list.map((item) => (item.id === id ? { ...item, ...partial } : item)),
    );
  };

  const removeAllocationDraft = (id: string) => {
    if (allocationDrafts().length <= 1) return;
    setAllocationDrafts((list) => list.filter((item) => item.id !== id));
  };

  const handleSaveAllocations = () => {
    const current = node();
    if (!current || current.kind !== 'income' || !props.onSaveRule) return;
    
    const remaining = remainingPercent();
    if (Math.abs(remaining) > ALLOCATION_TOLERANCE) {
      setAllocationError('Allocation must total 100%.');
      return;
    }
    if (allocationDrafts().some((alloc) => !alloc.targetNodeId)) {
      setAllocationError('Choose a target for every allocation.');
      return;
    }

    const sanitizedAllocations = allocationDrafts().map((allocation) => ({
      id: allocation.id,
      percentage: allocation.percentage,
      targetNodeId: allocation.targetNodeId!,
    }));

    props.onSaveRule({
      id: props.initialRule?.id,
      sourceNodeId: current.id,
      trigger: trigger(),
      triggerNodeId: triggerNodeId(),
      allocations: sanitizedAllocations,
    });
    setAllocationError(null);
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
              <input
                type="number"
                min="0"
                step="0.01"
                class="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/30"
                value={balanceInput()}
                onInput={(event) => {
                  setBalanceInput(event.currentTarget.value);
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
                <input
                  type="number"
                  step="0.01"
                  class="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/30"
                  placeholder="0.0"
                  value={returnRateInput()}
                  onInput={(event) => {
                    setReturnRateInput(event.currentTarget.value);
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
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/30"
                    placeholder="0.00"
                    value={incomeAmountInput()}
                    onInput={(event) => {
                      setIncomeAmountInput(event.currentTarget.value);
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
                    queueMicrotask(commitInflow);
                  }}
                  disabled={!props.onUpdateInflow}
                  placeholder={<span class="truncate text-slate-400">Monthly</span>}
                  itemComponent={(itemProps) => <SelectItem {...itemProps} />}
                >
                  <SelectTrigger
                    class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/30"
                    aria-label="Income cadence"
                  >
                    <SelectValue>
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

          <section class="space-y-2.5">
            <h3 class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Outgoing Allocations</h3>
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

              <div class="space-y-2.5">
                <For each={allocationDrafts()}>
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
                      <div class="rounded-xl border border-slate-200/80 bg-white/80 px-3.5 py-3 shadow-sm transition-shadow hover:shadow-md">
                        <div class="flex flex-wrap items-center justify-between gap-3">
                          <div class="min-w-[140px] flex-1">
                            <p class="text-sm font-semibold text-slate-800">{destinationLabel}</p>
                            <Show when={!flow}>
                              <p class="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-400">Destination</p>
                            </Show>
                          </div>
                          <div class="flex items-center gap-1.5">
                            <input
                              type="number"
                              inputMode="decimal"
                              class="h-9 w-20 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-800 shadow-inner focus:outline-none focus:ring-2 focus:ring-slate-900/30"
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
                            <span class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">%</span>
                          </div>
                          <Show when={showRemove}>
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              class="text-xs font-semibold text-slate-400 hover:text-rose-600"
                              onClick={() => removeAllocationDraft(allocation.id)}
                            >
                              Remove
                            </Button>
                          </Show>
                        </div>
                        <Show when={!flow}>
                          <div class="mt-3">
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
                              <SelectTrigger class="h-9 w-full rounded-lg border border-slate-200 text-sm font-medium text-slate-700" aria-label="Allocation target">
                                <SelectValue>
                                  {(state) => (
                                    <span class="truncate">{state.selectedOption()?.label ?? 'Select account'}</span>
                                  )}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent />
                              <SelectHiddenSelect name={`allocation-target-${allocation.id}`} />
                            </Select>
                          </div>
                        </Show>
                      </div>
                    );
                  }}
                </For>

                <Show when={allocationError()}>
                  <p class="text-xs font-semibold text-rose-600">{allocationError()}</p>
                </Show>

                <Button type="button" class="w-full py-2.5 shadow-sm" onClick={handleSaveAllocations}>
                  Save allocations
                </Button>
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
                    <SelectValue>
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
