import type { Accessor, Component } from 'solid-js';
import { Show } from 'solid-js';
import { Button } from '~/components/ui/button';

type CanvasToolbarProps = {
  initializing: Accessor<boolean>;
  title: Accessor<string>;
  lastUpdatedLabel: Accessor<string | null>;
  canSave: Accessor<boolean>;
  saving: Accessor<boolean>;
  saveDisabledReason: Accessor<string | null>;
  onSave: () => void | Promise<void>;
  canSubmit: Accessor<boolean>;
  submitting: Accessor<boolean>;
  submitDisabledReason: Accessor<string | null>;
  onSubmit: () => void | Promise<void>;
  onShare: () => void | Promise<void>;
};

export const CanvasToolbar: Component<CanvasToolbarProps> = (props) => (
  <div class="pointer-events-none absolute left-6 top-6 z-40 flex items-center gap-2">
    <Show
      when={!props.initializing()}
      fallback={
        <span class="pointer-events-auto rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 shadow-sm">
          Loading…
        </span>
      }
    >
      <div class="pointer-events-auto flex flex-wrap items-center gap-3 rounded-full border border-slate-200/70 bg-white/85 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur">
        <span class="flex items-center gap-2 text-sm text-slate-800">
          {props.title()}
          <Show when={props.lastUpdatedLabel()}>
            {(label) => (
              <span class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                Last saved {label()}
              </span>
            )}
          </Show>
        </span>
        <div class="flex items-center gap-2">
          <Button type="button" variant="secondary" size="xs" onClick={() => void props.onShare()}>
            Share
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="xs"
            class="rounded-full"
            disabled={!props.canSave()}
            title={props.saveDisabledReason() ?? undefined}
            onClick={() => void props.onSave()}
          >
            {props.saving() ? 'Saving…' : 'Save'}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="xs"
            class="rounded-full"
            disabled={!props.canSubmit()}
            title={props.submitDisabledReason() ?? undefined}
            onClick={() => void props.onSubmit()}
          >
            {props.submitting() ? 'Submitting…' : 'Request Approval'}
          </Button>
        </div>
      </div>
    </Show>
  </div>
);
