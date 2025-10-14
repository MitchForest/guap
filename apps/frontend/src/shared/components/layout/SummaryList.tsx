import type { Component, JSX } from 'solid-js';
import { For } from 'solid-js';
import { cn } from '~/shared/utils/classnames';

export type SummaryItem = {
  label: JSX.Element;
  value: JSX.Element;
};

type SummaryListProps = {
  items: SummaryItem[];
  columns?: number;
};

export const SummaryList: Component<SummaryListProps> = (props) => {
  const columns = Math.min(Math.max(props.columns ?? 2, 1), 4);
  const gridClass = `sm:grid-cols-${columns}`;
  return (
    <dl class={cn('grid gap-4', gridClass)}>
      <For each={props.items}>
        {(item) => (
          <div class="flex flex-col gap-1 rounded-2xl border border-slate-200/60 bg-slate-50/60 p-4">
            <dt class="text-xs font-semibold uppercase tracking-widest text-slate-400">{item.label}</dt>
            <dd class="text-sm font-medium text-slate-900">{item.value}</dd>
          </div>
        )}
      </For>
    </dl>
  );
};
