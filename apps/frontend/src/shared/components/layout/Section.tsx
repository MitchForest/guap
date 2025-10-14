import type { Component, JSX } from 'solid-js';
import { Show } from 'solid-js';
import { cn } from '~/shared/utils/classnames';

type SectionProps = {
  title?: JSX.Element;
  description?: JSX.Element;
  actions?: JSX.Element;
  class?: string;
  children: JSX.Element;
};

export const Section: Component<SectionProps> = (props) => (
  <section class={cn('flex flex-col gap-4 rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-sm', props.class)}>
    <Show when={props.title || props.description || props.actions}>
      <header class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex flex-col gap-1">
          <Show when={props.title}>
            {(title) => <h2 class="text-lg font-semibold text-slate-900">{title()}</h2>}
          </Show>
          <Show when={props.description}>
            {(description) => <p class="text-sm text-slate-500">{description()}</p>}
          </Show>
        </div>
        <Show when={props.actions}>{(actions) => <div class="flex items-center gap-2">{actions()}</div>}</Show>
      </header>
    </Show>
    {props.children}
  </section>
);
