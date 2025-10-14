import type { Component, JSX } from 'solid-js';
import { Show } from 'solid-js';
import { cn } from '~/shared/utils/classnames';

type MetricCardProps = {
  label: JSX.Element;
  value: JSX.Element;
  change?: JSX.Element;
  icon?: JSX.Element;
  class?: string;
};

export const MetricCard: Component<MetricCardProps> = (props) => (
  <div
    class={cn(
      'flex flex-col gap-3 rounded-3xl border border-slate-200/70 bg-white/90 p-5 shadow-sm transition hover:border-slate-300',
      props.class
    )}
  >
    <div class="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
      <span>{props.label}</span>
      <Show when={props.icon}>{(icon) => <span class="text-lg text-slate-500">{icon()}</span>}</Show>
    </div>
    <div class="text-2xl font-semibold text-slate-900">{props.value}</div>
    <Show when={props.change}>
      {(change) => <div class="text-xs font-medium text-emerald-600">{change()}</div>}
    </Show>
  </div>
);
