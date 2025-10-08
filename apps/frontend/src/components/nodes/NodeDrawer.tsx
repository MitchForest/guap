import { Component, For, Show, createMemo } from 'solid-js';
import { CanvasFlow, CanvasNode } from '../../types/graph';

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

type FlowListItem = {
  id: string;
  partnerLabel: string;
  tone: CanvasFlow['tone'];
  tag?: string;
};

type NodeDrawerProps = {
  node: CanvasNode | null;
  onClose: () => void;
  outbound: FlowListItem[];
  inbound: FlowListItem[];
};

const toneLabel = (tone: CanvasFlow['tone']) => (tone === 'auto' ? 'Auto flow' : 'Manual flow');

const NodeDrawer: Component<NodeDrawerProps> = (props) => {
  const node = () => props.node;
  const balance = createMemo(() => {
    const value = node()?.balance;
    if (typeof value !== 'number') return 'Not set';
    return currency.format(value);
  });
  const kindLabel = createMemo(() => {
    const current = node();
    if (!current) return 'node';
    if (current.kind === 'income') return 'income source';
    if (current.kind === 'subAccount') return 'sub-account';
    return current.category ? current.category.replace(/-/g, ' ') : 'account';
  });

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
      <div class="flex-1 space-y-6 overflow-y-auto px-6 py-6">
        <section class="space-y-3">
          <h3 class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Overview</h3>
          <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p class="text-sm text-slate-600">Balance</p>
            <p class="text-2xl font-semibold text-slate-900">{balance()}</p>
          </div>
        </section>

        <section class="space-y-3">
          <h3 class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Flows leaving</h3>
          <Show when={props.outbound.length > 0} fallback={<p class="text-sm text-subtle">No outgoing flows yet.</p>}>
            <div class="space-y-2">
              <For each={props.outbound}>
                {(item) => (
                  <div class="rounded-2xl border border-slate-200 px-4 py-3">
                    <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {toneLabel(item.tone)}
                    </p>
                    <p class="mt-1 text-sm text-slate-700">To {item.partnerLabel}</p>
                    <Show when={item.tag}>
                      {(tag) => <p class="text-xs text-subtle">Tag: {tag()}</p>}
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </section>

        <section class="space-y-3">
          <h3 class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Flows arriving</h3>
          <Show when={props.inbound.length > 0} fallback={<p class="text-sm text-subtle">No incoming flows yet.</p>}>
            <div class="space-y-2">
              <For each={props.inbound}>
                {(item) => (
                  <div class="rounded-2xl border border-slate-200 px-4 py-3">
                    <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {toneLabel(item.tone)}
                    </p>
                    <p class="mt-1 text-sm text-slate-700">From {item.partnerLabel}</p>
                    <Show when={item.tag}>
                      {(tag) => <p class="text-xs text-subtle">Tag: {tag()}</p>}
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
