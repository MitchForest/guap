import { Component, For, Show, createEffect, createMemo, createSignal } from 'solid-js';
import { CanvasNode } from '../../types/graph';

export type AllocationDraft = {
  id: string;
  percentage: number;
  targetNodeId: string | null;
};

export type RuleDraft = {
  sourceNodeId: string;
  trigger: 'incoming' | 'scheduled';
  triggerNodeId: string | null;
  allocations: Array<{ id: string; percentage: number; targetNodeId: string }>;
};

type RuleDrawerProps = {
  open: boolean;
  sourceNode: CanvasNode | null;
  nodes: CanvasNode[];
  onClose: () => void;
  onSave: (rule: RuleDraft) => void;
};

const RuleDrawer: Component<RuleDrawerProps> = (props) => {
  const [trigger, setTrigger] = createSignal<'incoming' | 'scheduled'>('incoming');
  const [triggerNodeId, setTriggerNodeId] = createSignal<string | null>(null);
  const [allocations, setAllocations] = createSignal<AllocationDraft[]>([]);
  const [error, setError] = createSignal<string | null>(null);

  createEffect(() => {
    if (!props.open) return;
    const source = props.sourceNode;
    setTrigger('incoming');
    setTriggerNodeId(source ? source.id : null);
    setAllocations([
      {
        id: `alloc-${Date.now()}`,
        percentage: 50,
        targetNodeId: null,
      },
      {
        id: `alloc-${Date.now()}-b`,
        percentage: 50,
        targetNodeId: null,
      },
    ]);
    setError(null);
  });

  const remainingPercent = createMemo(() => {
    const total = allocations().reduce((sum, alloc) => sum + alloc.percentage, 0);
    return 100 - total;
  });

  const availableTargets = createMemo(() => props.nodes.filter((node) => node.id !== props.sourceNode?.id));

  const updateAllocation = (id: string, partial: Partial<AllocationDraft>) => {
    setAllocations((list) =>
      list.map((item) => (item.id === id ? { ...item, ...partial } : item)),
    );
  };

  const addAllocation = () => {
    setAllocations((list) => [
      ...list,
      { id: `alloc-${Date.now()}`, percentage: Math.max(remainingPercent(), 0), targetNodeId: null },
    ]);
  };

  const removeAllocation = (id: string) => {
    if (allocations().length <= 1) return;
    setAllocations((list) => list.filter((item) => item.id !== id));
  };

  const handleSave = () => {
    if (!props.sourceNode) {
      setError('Select an income source to attach this rule to.');
      return;
    }
    const remaining = remainingPercent();
    if (remaining !== 0) {
      setError('Allocation must total 100%.');
      return;
    }
    if (allocations().some((alloc) => !alloc.targetNodeId)) {
      setError('Choose a target for every allocation.');
      return;
    }

    const sanitizedAllocations = allocations().map((allocation) => ({
      id: allocation.id,
      percentage: allocation.percentage,
      targetNodeId: allocation.targetNodeId!,
    }));

    props.onSave({
      sourceNodeId: props.sourceNode.id,
      trigger: trigger(),
      triggerNodeId: triggerNodeId(),
      allocations: sanitizedAllocations,
    });
    props.onClose();
  };

  return (
    <Show when={props.open}>
      <aside class="flex h-full flex-col bg-white">
        <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 class="text-lg font-semibold text-slate-900">Set up an auto flow</h2>
            <p class="text-sm text-subtle">Route money automatically when cash hits an account.</p>
          </div>
          <button
            class="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
            onClick={props.onClose}
          >
            Close
          </button>
        </div>
        <div class="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <section class="space-y-3">
            <h3 class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">When should it run?</h3>
            <div class="flex gap-2">
              <button
                class="flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition"
                classList={{
                  'border-slate-900 bg-slate-900 text-white': trigger() === 'incoming',
                  'border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-800': trigger() !== 'incoming',
                }}
                onClick={() => setTrigger('incoming')}
              >
                Whenever money arrives
              </button>
              <button
                class="flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition"
                classList={{
                  'border-slate-900 bg-slate-900 text-white': trigger() === 'scheduled',
                  'border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-800': trigger() !== 'scheduled',
                }}
                onClick={() => setTrigger('scheduled')}
              >
                On a schedule
              </button>
            </div>
            <div class="rounded-2xl border border-slate-200 px-4 py-4">
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Watch this account</p>
              <select
                class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/30"
                value={triggerNodeId() ?? ''}
                onChange={(event) => setTriggerNodeId(event.currentTarget.value || null)}
              >
                <option value="">Select source</option>
                {props.nodes
                  .filter((node) => node.kind === 'income')
                  .map((node) => (
                    <option value={node.id}>{node.label}</option>
                  ))}
              </select>
            </div>
          </section>

          <section class="space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Action</h3>
              <button class="text-xs font-semibold text-slate-600 hover:text-slate-900" onClick={addAllocation}>
                + Add account
              </button>
            </div>
            <div class="space-y-3">
              <For each={allocations()}>
                {(allocation) => (
                  <div class="rounded-2xl border border-slate-200 px-4 py-4">
                    <div class="flex items-center justify-between">
                      <p class="text-sm font-semibold text-slate-700">Move this percent onward</p>
                      <button
                        class="text-xs text-slate-400 hover:text-slate-600"
                        onClick={() => removeAllocation(allocation.id)}
                      >
                        Remove
                      </button>
                    </div>
                    <div class="mt-3 flex items-center gap-3">
                      <div class="flex items-center gap-2">
                        <span class="text-sm text-slate-500">%</span>
                        <input
                          type="number"
                          class="w-20 rounded-lg border border-slate-200 px-2 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/30"
                          value={allocation.percentage}
                          min={0}
                          max={100}
                          onInput={(event) =>
                            updateAllocation(allocation.id, {
                              percentage: Number(event.currentTarget.value),
                            })
                          }
                        />
                      </div>
                      <span class="text-sm text-slate-500">To</span>
                      <select
                        class="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/30"
                        value={allocation.targetNodeId ?? ''}
                        onChange={(event) =>
                          updateAllocation(allocation.id, {
                            targetNodeId: event.currentTarget.value || null,
                          })
                        }
                      >
                        <option value="">Select account</option>
                        {availableTargets().map((node) => (
                          <option value={node.id}>{node.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </For>
              <p class="text-xs font-semibold text-slate-500">{Math.max(remainingPercent(), 0)}% remaining</p>
              <Show when={error()}>
                <p class="text-xs font-semibold text-rose-600">{error()}</p>
              </Show>
            </div>
          </section>
        </div>
        <div class="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
            onClick={props.onClose}
          >
            Cancel
          </button>
          <button
            class="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-floating transition hover:bg-slate-800"
            onClick={handleSave}
          >
            Save rule
          </button>
        </div>
      </aside>
    </Show>
  );
};

export default RuleDrawer;
