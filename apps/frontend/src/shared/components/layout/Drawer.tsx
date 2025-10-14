import { onCleanup, Show, createEffect } from 'solid-js';
import type { Component, JSX } from 'solid-js';
import { cn } from '~/shared/utils/classnames';

type DrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: JSX.Element;
  position?: 'left' | 'right';
  children: JSX.Element;
};

export const Drawer: Component<DrawerProps> = (props) => {
  createEffect(() => {
    if (props.open) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      onCleanup(() => {
        document.body.style.overflow = original;
      });
    }
  });

  const handleClose = () => props.onOpenChange(false);

  return (
    <Show when={props.open}>
      <div class="fixed inset-0 z-50 flex">
        <button
          type="button"
          class="flex-1 bg-slate-900/40 backdrop-blur-sm"
          aria-label="Close drawer"
          onClick={handleClose}
        />
        <div
          class={cn(
            'flex h-full w-full max-w-md flex-col gap-6 border border-slate-200/60 bg-white p-6 shadow-2xl transition sm:max-w-lg',
            props.position === 'left' ? 'order-first' : 'order-last'
          )}
        >
          <div class="flex items-start justify-between gap-3">
            <Show when={props.title}>
              {(title) => <h2 class="text-lg font-semibold text-slate-900">{title()}</h2>}
            </Show>
            <button
              type="button"
              class="inline-flex size-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
              onClick={handleClose}
            >
              <span class="sr-only">Close drawer</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4">
                <path d="M18 6L6 18" />
                <path d="M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="flex-1 overflow-y-auto">{props.children}</div>
        </div>
      </div>
    </Show>
  );
};
