import { For, Show, type Component } from 'solid-js';
import type { DonationCause } from '@guap/api';
import { Button } from '~/shared/components/ui/button';
import { formatCurrency } from '~/shared/utils/format';

type DonationCauseGridProps = {
  causes: DonationCause[];
  onSelect: (cause: DonationCause) => void;
};

export const DonationCauseGrid: Component<DonationCauseGridProps> = (props) => (
  <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
    <For each={props.causes}>
      {(cause) => (
        <div class="flex h-full flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300">
          <div class="flex items-center gap-3">
            <Show when={cause.icon}>
              {(icon) => (
                <span class="flex size-10 items-center justify-center rounded-full bg-slate-100 text-xl">
                  {icon()}
                </span>
              )}
            </Show>
            <div>
              <p class="text-base font-semibold text-slate-900">{cause.name}</p>
              <Show when={cause.tagline}>
                {(tagline) => <p class="text-xs text-slate-500">{tagline()}</p>}
              </Show>
            </div>
          </div>
          <p class="text-sm text-slate-600">{cause.description}</p>
          <div class="mt-auto space-y-2">
            <Show when={cause.recommendedAmount}>
              {(amount) => (
                <p class="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                  Suggested gift • {formatCurrency(amount().cents)}
                </p>
              )}
            </Show>
            <Button
              variant="primary"
              size="sm"
              class="w-full"
              onClick={() => props.onSelect(cause)}
            >
              Schedule donation
            </Button>
          </div>
        </div>
      )}
    </For>
  </div>
);
