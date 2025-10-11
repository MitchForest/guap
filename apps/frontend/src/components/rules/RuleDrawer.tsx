import { Component, For, Show, createEffect, createMemo, createSignal } from 'solid-js';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import type { SelectOption } from '~/components/ui/select';
import {
  Select,
  SelectContent,
  SelectHiddenSelect,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { CanvasNode } from '../../types/graph';

export type AllocationDraft = {
  id: string;
  percentage: number;
  targetNodeId: string | null;
};

export type RuleDraft = {
  id?: string;
  sourceNodeId: string;
  trigger: 'incoming' | 'scheduled';
  triggerNodeId: string | null;
  allocations: Array<{ id: string; percentage: number; targetNodeId: string }>;
};

type RuleDrawerProps = {
  open: boolean;
  sourceNode: CanvasNode | null;
  nodes: CanvasNode[];
  initialRule?: RuleDraft | null;
  onClose: () => void;
  onSave: (rule: RuleDraft) => void;
};

const ALLOCATION_TOLERANCE = 0.001;

const RuleDrawer: Component<RuleDrawerProps> = (props) => {
  const [trigger, setTrigger] = createSignal<'incoming' | 'scheduled'>('incoming');
  const [triggerNodeId, setTriggerNodeId] = createSignal<string | null>(null);
  const [allocations, setAllocations] = createSignal<AllocationDraft[]>([]);
  const [error, setError] = createSignal<string | null>(null);
  const [initialized, setInitialized] = createSignal(false);

  const incomeNodes = createMemo(() => props.nodes.filter((node) => node.kind === 'income'));
  const triggerOptions = createMemo<SelectOption[]>(() =>
    incomeNodes().map((node) => ({
      value: node.id,
      label: node.label,
    }))
  );
  const allocationOptions = createMemo<SelectOption[]>(() =>
    availableTargets().map((node) => ({
      value: node.id,
      label: node.label,
    }))
  );

  createEffect(() => {
    // Only initialize when drawer opens (transitions from false to true)
    if (!props.open) {
      setInitialized(false);
      return;
    }
    if (initialized()) return; // Don't re-initialize if already open
    
    const source = props.sourceNode;
    const initial = props.initialRule ?? null;
    setTrigger(initial?.trigger ?? 'incoming');
    setTriggerNodeId(initial?.triggerNodeId ?? (source ? source.id : null));
    if (initial) {
      setAllocations(
        initial.allocations.map((allocation) => ({
          id: allocation.id,
          percentage: allocation.percentage,
          targetNodeId: allocation.targetNodeId,
        }))
      );
    } else {
      setAllocations([
        {
          id: `alloc-${Date.now()}`,
          percentage: 100,
          targetNodeId: null,
        },
      ]);
    }
    setError(null);
    setInitialized(true);
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
    if (Math.abs(remaining) > ALLOCATION_TOLERANCE) {
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
      id: props.initialRule?.id,
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
        <div class="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <section class="space-y-3">
            <h3 class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">When should it run?</h3>
            <div class="flex gap-2">
              <Button
                type="button"
                variant={trigger() === 'incoming' ? 'primary' : 'outline'}
                class="flex-1 h-auto justify-center rounded-xl px-4 py-3 text-sm font-semibold"
                onClick={() => setTrigger('incoming')}
              >
                Whenever money arrives
              </Button>
              <Button
                type="button"
                variant={trigger() === 'scheduled' ? 'primary' : 'outline'}
                class="flex-1 h-auto justify-center rounded-xl px-4 py-3 text-sm font-semibold"
                onClick={() => setTrigger('scheduled')}
              >
                On a schedule
              </Button>
            </div>
            <div class="rounded-2xl border border-slate-200 px-4 py-4">
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Watch this account</p>
              <Select
                options={triggerOptions()}
                optionValue="value"
                optionTextValue="label"
                value={triggerOptions().find((option) => option.value === triggerNodeId()) ?? null}
                onChange={(option) => setTriggerNodeId(option?.value ?? null)}
                placeholder={<span class="truncate text-slate-400">Select source</span>}
                itemComponent={(itemProps) => <SelectItem {...itemProps} />}
              >
                <SelectTrigger class="mt-2" aria-label="Source account">
                  <SelectValue<SelectOption>>
                    {(state) => <span class="truncate">{state.selectedOption()?.label ?? 'Select source'}</span>}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent />
                <SelectHiddenSelect name="rule-trigger" />
              </Select>
            </div>
          </section>

          <section class="space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Action</h3>
              <Button type="button" variant="ghost" size="xs" class="text-xs font-semibold uppercase tracking-[0.18em]" onClick={addAllocation}>
                + Add account
              </Button>
            </div>
            <div class="space-y-3">
              <For each={allocations()}>
                {(allocation) => (
                  <div class="rounded-2xl border border-slate-200 px-4 py-4">
                    <div class="flex items-center justify-between">
                      <p class="text-sm font-semibold text-slate-700">Move this percent onward</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        class="text-xs font-semibold text-slate-400 hover:text-slate-600"
                        onClick={() => removeAllocation(allocation.id)}
                      >
                        Remove
                      </Button>
                    </div>
                    <div class="mt-3 flex items-center gap-3">
                      <div class="flex items-center gap-2">
                        <span class="text-sm text-slate-500">%</span>
                        <Input
                          type="number"
                          size="sm"
                          class="w-20 rounded-lg border border-slate-200 px-2 py-2 text-sm text-slate-700"
                          value={allocation.percentage}
                          min={0}
                          max={100}
                          onInput={(event) => {
                            const next = Number(event.currentTarget.value);
                            const sanitized = Number.isFinite(next) ? next : 0;
                            updateAllocation(allocation.id, {
                              percentage: sanitized,
                            });
                          }}
                        />
                      </div>
                      <span class="text-sm text-slate-500">To</span>
                      <Select
                        options={allocationOptions()}
                        optionValue="value"
                        optionTextValue="label"
                        value={allocationOptions().find((option) => option.value === allocation.targetNodeId) ?? null}
                        onChange={(option) =>
                          updateAllocation(allocation.id, {
                            targetNodeId: option?.value ?? null,
                          })
                        }
                        placeholder={<span class="truncate text-slate-400">Select account</span>}
                        itemComponent={(itemProps) => <SelectItem {...itemProps} />}
                      >
                        <SelectTrigger class="flex-1" aria-label="Allocation target">
                          <SelectValue<SelectOption>>
                            {(state) => <span class="truncate">{state.selectedOption()?.label ?? 'Select account'}</span>}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent />
                        <SelectHiddenSelect name={`rule-target-${allocation.id}`} />
                      </Select>
                    </div>
                  </div>
                )}
              </For>
              <p 
                class="text-xs font-semibold"
                classList={{
                  'text-rose-600': remainingPercent() < 0,
                  'text-slate-500': remainingPercent() >= 0,
                }}
              >
                {remainingPercent() < 0 ? '' : ''}{remainingPercent().toFixed(1)}% remaining
              </p>
              <Show when={error()}>
                <p class="text-xs font-semibold text-rose-600">{error()}</p>
              </Show>
            </div>
          </section>
        </div>
        <div class="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <Button type="button" variant="secondary" onClick={props.onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} class="shadow-floating">
            Save rule
          </Button>
        </div>
      </aside>
    </Show>
  );
};

export default RuleDrawer;
