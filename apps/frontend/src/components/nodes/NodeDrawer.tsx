import { Component, For, Show, createEffect, createMemo, createSignal } from 'solid-js';
import { CanvasFlow, CanvasNode, CanvasInflow, CanvasInflowCadence, CanvasPodType } from '../../types/graph';
import type { NodeAllocationStatus } from '../canvas/NodeCard';

type FlowListItem = {
  id: string;
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

const flowLabel = (hasRule: boolean) => (hasRule ? 'Flow with rule' : 'Flow');

const ALLOCATION_TOLERANCE = 0.001;

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
  const allocationItems = createMemo(() => props.allocations ?? []);
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
  
  // Allocation editing state
  const [trigger, setTrigger] = createSignal<'incoming' | 'scheduled'>('incoming');
  const [triggerNodeId, setTriggerNodeId] = createSignal<string | null>(null);
  const [allocationDrafts, setAllocationDrafts] = createSignal<AllocationDraft[]>([]);
  const [allocationError, setAllocationError] = createSignal<string | null>(null);
  const [initialized, setInitialized] = createSignal(false);

  createEffect(() => {
    const current = node();
    if (!current) {
      setBalanceInput('');
      setIncomeAmountInput('');
      setIncomeCadence('monthly');
      setInitialized(false);
      return;
    }
    setBalanceInput(typeof current.balance === 'number' ? String(current.balance) : '');
    const inflow = current.inflow;
    setIncomeAmountInput(inflow && typeof inflow.amount === 'number' ? String(inflow.amount) : '');
    setIncomeCadence(inflow?.cadence ?? 'monthly');
    setBalanceError(null);
    setIncomeError(null);
    setReturnRateInput(
      typeof current.returnRate === 'number' && Number.isFinite(current.returnRate)
        ? String(current.returnRate * 100)
        : ''
    );
    setReturnRateError(null);
    
    // Initialize allocation editing for income nodes
    if (current.kind === 'income' && !initialized()) {
      const initial = props.initialRule ?? null;
      setTrigger(initial?.trigger ?? 'incoming');
      setTriggerNodeId(initial?.triggerNodeId ?? current.id);
      if (initial && initial.allocations.length > 0) {
        setAllocationDrafts(
          initial.allocations.map((allocation) => ({
            id: allocation.id,
            percentage: allocation.percentage,
            targetNodeId: allocation.targetNodeId,
          }))
        );
      } else {
        setAllocationDrafts([
          {
            id: `alloc-${Date.now()}`,
            percentage: 100,
            targetNodeId: null,
          },
        ]);
      }
      setAllocationError(null);
      setInitialized(true);
    } else if (current.kind !== 'income') {
      setInitialized(false);
    }
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
  
  const remainingPercent = createMemo(() => {
    const total = allocationDrafts().reduce((sum, alloc) => sum + alloc.percentage, 0);
    return 100 - total;
  });

  const updateAllocationDraft = (id: string, partial: Partial<AllocationDraft>) => {
    setAllocationDrafts((list) =>
      list.map((item) => (item.id === id ? { ...item, ...partial } : item)),
    );
  };

  const addAllocationDraft = () => {
    setAllocationDrafts((list) => [
      ...list,
      { id: `alloc-${Date.now()}`, percentage: Math.max(remainingPercent(), 0), targetNodeId: null },
    ]);
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
        <button
          class="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
          onClick={props.onClose}
        >
          Close
        </button>
      </div>
      <div class="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <section class="space-y-2.5">
          <h3 class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Overview</h3>
          <div class="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5">
            <label class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Balance
              <input
                type="number"
                min="0"
                step="0.01"
                class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/30"
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
              <label class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Return rate (%)
                <input
                  type="number"
                  step="0.01"
                  class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/30"
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
            <div class="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5">
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Income amount
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/30"
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
                <label class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Cadence
                  <select
                    class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/30"
                    value={incomeCadence()}
                    onChange={(event) => {
                      setIncomeCadence(event.currentTarget.value as CanvasInflowCadence);
                      queueMicrotask(commitInflow);
                    }}
                    disabled={!props.onUpdateInflow}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                    <option value="daily">Daily</option>
                  </select>
                </label>
              </div>
              <Show when={incomeError()}>
                {(message) => <p class="text-xs font-semibold text-rose-600">{message()}</p>}
              </Show>
            </div>
          </section>

          <section class="space-y-2.5">
            <h3 class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Allocation Rules</h3>
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
                    {remainingPercent() < 0 ? '' : ''}{remainingPercent().toFixed(1)}% remaining
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

              <div class="space-y-3">
                <For each={allocationDrafts()}>
                  {(allocation) => (
                    <div class="rounded-xl border border-slate-200 bg-white px-3 py-3">
                      <div class="flex items-center justify-between mb-2">
                        <span class="text-xs font-semibold text-slate-600">Allocation</span>
                        <Show when={allocationDrafts().length > 1}>
                          <button
                            class="text-xs text-slate-400 hover:text-rose-600 transition"
                            onClick={() => removeAllocationDraft(allocation.id)}
                          >
                            Remove
                          </button>
                        </Show>
                      </div>
                      <div class="flex items-center gap-2">
                        <div class="flex items-center gap-1.5">
                          <input
                            type="number"
                            class="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/30"
                            value={allocation.percentage}
                            min={0}
                            max={100}
                            onInput={(event) => {
                              const next = Number(event.currentTarget.value);
                              const sanitized = Number.isFinite(next) ? next : 0;
                              updateAllocationDraft(allocation.id, { percentage: sanitized });
                            }}
                          />
                          <span class="text-xs text-slate-500">%</span>
                        </div>
                        <span class="text-xs text-slate-400">→</span>
                        <select
                          class="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/30"
                          value={allocation.targetNodeId ?? ''}
                          onChange={(event) =>
                            updateAllocationDraft(allocation.id, {
                              targetNodeId: event.currentTarget.value || null,
                            })
                          }
                        >
                          <option value="">Select account</option>
                          {availableTargets().map((n) => (
                            <option value={n.id}>{n.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </For>
                
                <button
                  type="button"
                  class="w-full rounded-lg border border-dashed border-slate-300 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-800"
                  onClick={addAllocationDraft}
                >
                  + Add allocation
                </button>

                <Show when={allocationError()}>
                  <p class="text-xs font-semibold text-rose-600">{allocationError()}</p>
                </Show>

                <button
                  type="button"
                  class="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                  onClick={handleSaveAllocations}
                >
                  Save allocations
                </button>
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
                <select
                  class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/30"
                  value={node()?.podType ?? 'goal'}
                  onChange={(event) => {
                    const current = node();
                    if (!current || !props.onUpdatePodType) return;
                    props.onUpdatePodType(current.id, event.currentTarget.value as CanvasPodType);
                  }}
                  disabled={!props.onUpdatePodType}
                >
                  <option value="goal">Goal</option>
                  <option value="category">Category</option>
                  <option value="envelope">Envelope</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
            </div>
          </section>
        </Show>

        <section class="space-y-2.5">
          <h3 class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Outgoing Flows</h3>
          <Show when={props.outbound.length > 0} fallback={<p class="text-sm text-subtle">No outgoing flows yet.</p>}>
            <div class="space-y-2">
              <For each={props.outbound}>
                {(item) => (
                  <div class="rounded-2xl border border-slate-200 px-4 py-3">
                    <div class="flex items-center justify-between">
                      <p class="text-sm font-semibold text-slate-700">To {item.partnerLabel}</p>
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
