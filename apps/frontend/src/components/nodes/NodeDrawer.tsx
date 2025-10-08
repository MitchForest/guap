import { Component, For, Show, createEffect, createMemo, createSignal } from 'solid-js';
import { CanvasFlow, CanvasNode, CanvasInflow, CanvasInflowCadence, CanvasPodType } from '../../types/graph';
import type { NodeAllocationStatus } from '../canvas/NodeCard';

type FlowListItem = {
  id: string;
  partnerLabel: string;
  hasRule: boolean;
  tag?: string;
};

type NodeDrawerProps = {
  node: CanvasNode | null;
  onClose: () => void;
  outbound: FlowListItem[];
  inbound: FlowListItem[];
  allocations?: Array<{ id: string; percentage: number; targetLabel: string }>;
  allocationStatus?: NodeAllocationStatus | null;
  onManageRules?: (nodeId: string) => void;
  onUpdateBalance?: (nodeId: string, balance: number | null) => void;
  onUpdateInflow?: (nodeId: string, inflow: CanvasInflow | null) => void;
  onUpdatePodType?: (nodeId: string, podType: CanvasPodType) => void;
  onUpdateReturnRate?: (nodeId: string, returnRate: number | null) => void;
};

const flowLabel = (hasRule: boolean) => (hasRule ? 'Flow with rule' : 'Flow');

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

  createEffect(() => {
    const current = node();
    if (!current) {
      setBalanceInput('');
      setIncomeAmountInput('');
      setIncomeCadence('monthly');
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
            <div class="flex items-center justify-between">
              <h3 class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Automation & Allocations</h3>
              <button
                class="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!props.onManageRules}
                onClick={() => {
                  const current = node();
                  if (!current) return;
                  props.onManageRules?.(current.id);
                }}
              >
                Manage
              </button>
            </div>
            <div class={`space-y-4 rounded-2xl border px-4 py-4 ${automationSummary().className}`}>
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
              <div class="space-y-3">
                <Show
                  when={allocationItems().length > 0}
                  fallback={<p class="text-xs text-slate-500">Click 'Manage' to set up allocation rules.</p>}
                >
                  <div class="space-y-3">
                    <For each={allocationItems()}>
                      {(item) => (
                        <div class="space-y-1.5">
                          <div class="flex items-center justify-between">
                            <span class="text-sm font-medium text-slate-700">{item.targetLabel}</span>
                            <span class="text-xs font-semibold text-slate-500">{item.percentage}%</span>
                          </div>
                          <div class="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                            <div
                              class="h-full bg-sky-500 transition-all duration-300"
                              style={{ width: `${item.percentage}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
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
