import { Component, For, Show, createMemo } from 'solid-js';
import { CanvasNode } from '../../types/graph';

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

type NodeDrawerProps = {
  node: CanvasNode | null;
  onClose: () => void;
  rules: Array<{
    id: string;
    trigger: string;
    summary: string;
  }>;
};

const NodeDrawer: Component<NodeDrawerProps> = (props) => {
  const node = () => props.node;
  const balance = createMemo(() => {
    const value = node()?.balance;
    if (typeof value !== 'number') return 'Not set';
    return currency.format(value);
  });
  const hasRules = createMemo(() => props.rules.length > 0);

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
            <p class="text-xs text-subtle capitalize">{node()?.type ?? 'node'}</p>
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
            <p class="text-sm text-slate-600">
              Balance
            </p>
            <p class="text-2xl font-semibold text-slate-900">{balance()}</p>
          </div>
        </section>
        <section class="space-y-3">
          <h3 class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Actions</h3>
          <div class="flex flex-col gap-2">
            <button class="rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
              Rename node
            </button>
            <button class="rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
              Update balance
            </button>
            <button class="rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
              View automation rules
            </button>
          </div>
        </section>
        <section class="space-y-3">
          <h3 class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Connections</h3>
          <Show when={hasRules()} fallback={<p class="text-sm text-subtle">No automations yet.</p>}>
            <div class="space-y-2">
              <For each={props.rules}>
                {(rule) => (
                  <div class="rounded-2xl border border-slate-200 px-4 py-3">
                    <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {rule.trigger}
                    </p>
                    <p class="mt-1 text-sm text-slate-700">{rule.summary}</p>
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
