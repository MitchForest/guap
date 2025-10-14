import { For, type Component } from 'solid-js';
import type { EventJournalRecord } from '@guap/api';

type ActivityFeedProps = {
  events: EventJournalRecord[];
};

export const summarizeEvent = (event: EventJournalRecord) => {
  const label = event.eventKind.replace(/_/g, ' ');
  const title = label.charAt(0).toUpperCase() + label.slice(1);
  const actor = event.actorProfileId ? `by ${event.actorProfileId}` : 'by system';
  const primary = `${event.primaryEntity.table}:${event.primaryEntity.id}`;
  return {
    title,
    detail: `${primary} • ${actor}`,
    timestamp: new Date(event.createdAt).toLocaleString(),
  };
};

export const ActivityFeed: Component<ActivityFeedProps> = (props) => (
  <div class="flex flex-col gap-4">
    <header class="flex flex-col gap-1">
      <h2 class="text-lg font-semibold text-slate-900">Household activity</h2>
      <p class="text-sm text-slate-500">Recent approvals, transfers, and guardrail updates.</p>
    </header>
    <ol class="flex flex-col gap-3">
      <For each={props.events}>
        {(event) => {
          const summary = summarizeEvent(event);
          return (
            <li class="flex items-start gap-3 rounded-2xl border border-slate-200/60 bg-white/80 p-4 shadow-sm">
              <span class="mt-1 inline-flex size-2.5 rounded-full bg-slate-400" aria-hidden="true" />
              <div class="flex flex-col gap-1">
                <p class="text-sm font-medium text-slate-900">{summary.title}</p>
                <p class="text-xs text-slate-500">{summary.detail}</p>
                <span class="text-xs text-slate-400">{summary.timestamp}</span>
              </div>
            </li>
          );
        }}
      </For>
    </ol>
  </div>
);
