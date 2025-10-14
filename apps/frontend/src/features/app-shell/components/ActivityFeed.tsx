import { For, type Component } from 'solid-js';

type ActivityEntry = {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
};

type ActivityFeedProps = {
  entries: ActivityEntry[];
};

export const ActivityFeed: Component<ActivityFeedProps> = (props) => (
  <div class="flex flex-col gap-4">
    <header class="flex flex-col gap-1">
      <h2 class="text-lg font-semibold text-slate-900">Household activity</h2>
      <p class="text-sm text-slate-500">Recent approvals, transfers, and guardrail updates.</p>
    </header>
    <ol class="flex flex-col gap-3">
      <For each={props.entries}>
        {(entry) => (
          <li class="flex items-start gap-3 rounded-2xl border border-slate-200/60 bg-white/80 p-4 shadow-sm">
            <span class="mt-1 inline-flex size-2.5 rounded-full bg-slate-400" aria-hidden="true" />
            <div class="flex flex-col gap-1">
              <p class="text-sm font-medium text-slate-900">{entry.title}</p>
              <p class="text-xs text-slate-500">{entry.detail}</p>
              <span class="text-xs text-slate-400">{entry.timestamp}</span>
            </div>
          </li>
        )}
      </For>
    </ol>
  </div>
);

export const createPlaceholderActivity = (): ActivityEntry[] => [
  {
    id: 'activity-1',
    title: 'Transfer approved',
    detail: 'Jordan moved $25 into Goal: “Summer Camp”.',
    timestamp: '2 hours ago',
  },
  {
    id: 'activity-2',
    title: 'Guardrail updated',
    detail: 'Spend over $50 now requires parent approval.',
    timestamp: 'Yesterday',
  },
  {
    id: 'activity-3',
    title: 'Weekly allowance sent',
    detail: 'Automatically routed $15 to Avery’s checking account.',
    timestamp: 'Mar 3',
  },
];
