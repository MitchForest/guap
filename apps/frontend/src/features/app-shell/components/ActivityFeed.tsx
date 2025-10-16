import { For, Show, createMemo, type Component } from 'solid-js';
import type { EventJournalWithReceipt } from '@guap/api';
import { formatCurrency } from '~/shared/utils/format';
import { Button } from '~/shared/components/ui/button';

type ActivityFeedProps = {
  events: EventJournalWithReceipt[];
  onMarkAllRead?: (eventIds: string[]) => Promise<void>;
  isMarking?: boolean;
};

const friendlyDateTime = (timestamp: number) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).format(timestamp);

const dayLabelFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
});

const isSameDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

export const friendlyDayLabel = (timestamp: number, now: number = Date.now()) => {
  const date = new Date(timestamp);
  const today = new Date(now);
  if (isSameDay(date, today)) {
    return 'Today';
  }

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(date, yesterday)) {
    return 'Yesterday';
  }

  return dayLabelFormatter.format(date);
};

const summarizeTransferEvent = (event: EventJournalWithReceipt) => {
  const payload = (event.payload ?? {}) as Record<string, unknown>;
  if (event.eventKind === 'transfer_requested' || event.eventKind === 'transfer_executed') {
    if (payload.intent === 'credit_payoff') {
      const accountName = typeof payload.destinationAccountName === 'string' ? payload.destinationAccountName : 'credit account';
      const amountCents =
        typeof payload.amount === 'object' && payload.amount !== null && 'cents' in payload.amount
          ? (payload.amount as { cents: number }).cents
          : null;
      const amountLabel = amountCents != null ? formatCurrency(amountCents) : 'Payoff';
      const actor = event.actorProfileId ? `by ${event.actorProfileId}` : 'Auto-approved';
      const verb = event.eventKind === 'transfer_requested' ? 'Payoff requested' : 'Payoff executed';
      return {
        title: `${verb} for ${accountName}`,
        detail: `${amountLabel} • ${actor}`,
        timestamp: friendlyDateTime(event.createdAt),
      };
    }
  }

  const goalName = typeof payload.goalName === 'string' ? payload.goalName : 'savings goal';
  const amountCents =
    typeof payload.amount === 'object' && payload.amount !== null && 'cents' in payload.amount
      ? (payload.amount as { cents: number }).cents
      : null;
  const amountLabel = amountCents != null ? formatCurrency(amountCents) : 'Contribution';
  const actor = event.actorProfileId ? `by ${event.actorProfileId}` : 'Auto-approved';

  if (event.eventKind === 'transfer_requested') {
    return {
      title: `Contribution requested for ${goalName}`,
      detail: `${amountLabel} pending approval • ${actor}`,
      timestamp: friendlyDateTime(event.createdAt),
    };
  }

  if (event.eventKind === 'transfer_executed') {
    return {
      title: `Contribution completed for ${goalName}`,
      detail: `${amountLabel} deposited • ${actor}`,
      timestamp: friendlyDateTime(event.createdAt),
    };
  }

  return null;
};

const summarizeIncomeEvent = (event: EventJournalWithReceipt) => {
  const payload = (event.payload ?? {}) as Record<string, unknown>;
  const streamName = typeof payload.streamName === 'string' ? payload.streamName : 'income stream';
  const amountCents =
    typeof payload.amount === 'object' && payload.amount !== null && 'cents' in payload.amount
      ? (payload.amount as { cents: number }).cents
      : null;
  const scheduledFor =
    typeof payload.scheduledFor === 'number'
      ? new Date(payload.scheduledFor).toLocaleDateString()
      : null;
  const actor = event.actorProfileId ? `by ${event.actorProfileId}` : 'Auto';
  const amountLabel = amountCents != null ? formatCurrency(amountCents) : null;

  if (event.eventKind === 'income_request') {
    return {
      title: `Payout requested for ${streamName}`,
      detail: `${amountLabel ?? 'Allowance'} pending approval • ${actor}`,
      timestamp: friendlyDateTime(event.createdAt),
    };
  }

  if (event.eventKind === 'income_completed') {
    return {
      title: `Payout completed for ${streamName}`,
      detail: `${amountLabel ?? 'Allowance'} delivered${scheduledFor ? ` • scheduled ${scheduledFor}` : ''}`,
      timestamp: friendlyDateTime(event.createdAt),
    };
  }

  if (event.eventKind === 'income_skipped') {
    return {
      title: `Payout skipped for ${streamName}`,
      detail: `${scheduledFor ? `Next target ${scheduledFor}` : 'Rescheduled to next cadence'} • ${actor}`,
      timestamp: friendlyDateTime(event.createdAt),
    };
  }

  return null;
};

const summarizeDonationEvent = (event: EventJournalWithReceipt) => {
  if (event.eventKind !== 'donation_requested' && event.eventKind !== 'donation_completed') {
    return null;
  }

  const payload = (event.payload ?? {}) as Record<string, unknown>;
  const causeName = typeof payload.causeName === 'string' ? payload.causeName : 'Donation';
  const amountCents =
    typeof payload.amount === 'object' && payload.amount !== null && 'cents' in payload.amount
      ? (payload.amount as { cents: number }).cents
      : null;
  const amountLabel = amountCents != null ? formatCurrency(amountCents) : null;
  const scheduledForDate =
    typeof payload.scheduledFor === 'number'
      ? new Date(payload.scheduledFor).toLocaleDateString()
      : null;

  if (event.eventKind === 'donation_requested') {
    return {
      title: `Donation scheduled for ${causeName}`,
      detail: `${amountLabel ?? 'Gift'} pending approval${scheduledForDate ? ` • runs ${scheduledForDate}` : ''}`,
    } as const;
  }

  if (event.eventKind === 'donation_completed') {
    return {
      title: `Donation completed for ${causeName}`,
      detail: `${amountLabel ?? 'Gift'} delivered` +
        (event.actorProfileId ? ` • by ${event.actorProfileId}` : ''),
    } as const;
  }

  return null;
};

export const summarizeEvent = (event: EventJournalWithReceipt) => {
  const donationSummary = summarizeDonationEvent(event);
  if (donationSummary) {
    return {
      title: donationSummary.title,
      detail: donationSummary.detail,
      timestamp: friendlyDateTime(event.createdAt),
    };
  }

  const transferSummary = summarizeTransferEvent(event);
  if (transferSummary) {
    return transferSummary;
  }

  const incomeSummary = summarizeIncomeEvent(event);
  if (incomeSummary) {
    return incomeSummary;
  }

  if (event.eventKind.startsWith('order_')) {
    const payload = (event.payload ?? {}) as Record<string, unknown>;
    const symbol = (payload.symbol as string | undefined) ?? 'Unknown symbol';
    const side = (payload.side as string | undefined) ?? 'order';
    const quantity = typeof payload.quantity === 'number' ? payload.quantity : null;
    const baseTitle =
      event.eventKind === 'order_submitted'
        ? `Order submitted for ${symbol}`
        : event.eventKind === 'order_approved'
          ? `Order approved for ${symbol}`
          : event.eventKind === 'order_executed'
            ? `Order executed for ${symbol}`
            : event.eventKind === 'order_failed'
              ? `Order failed for ${symbol}`
              : `Order update for ${symbol}`;

    const detailParts: string[] = [];
    if (quantity != null) {
      detailParts.push(`${quantity.toFixed(2)} units`);
    }
    if (side) {
      detailParts.push(side);
    }
    if (event.actorProfileId) {
      detailParts.push(`by ${event.actorProfileId}`);
    }
    if (event.eventKind === 'order_failed' && typeof payload.reason === 'string') {
      detailParts.push(payload.reason);
    }

    return {
      title: baseTitle,
      detail: detailParts.join(' • '),
      timestamp: friendlyDateTime(event.createdAt),
    };
  }

  const label = event.eventKind.replace(/_/g, ' ');
  const title = label.charAt(0).toUpperCase() + label.slice(1);
  const actor = event.actorProfileId ? `by ${event.actorProfileId}` : 'by system';
  const primary = `${event.primaryEntity.table}:${event.primaryEntity.id}`;
  return {
    title,
    detail: `${primary} • ${actor}`,
    timestamp: friendlyDateTime(event.createdAt),
  };
};

export const ActivityFeed: Component<ActivityFeedProps> = (props) => {
  const groups = createMemo(() => {
    const buckets = new Map<string, { label: string; events: EventJournalWithReceipt[] }>();
    const now = Date.now();
    for (const event of props.events) {
      const date = new Date(event.createdAt);
      const key = date.toISOString().slice(0, 10);
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { label: friendlyDayLabel(event.createdAt, now), events: [] };
        buckets.set(key, bucket);
      }
      bucket.events.push(event);
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => (a > b ? -1 : a < b ? 1 : 0))
      .map(([, bucket]) => ({
        label: bucket.label,
        events: bucket.events.sort((left, right) => right.createdAt - left.createdAt),
      }));
  });

  const unreadIds = createMemo(() =>
    props.events.filter((event) => !event.receipt?.readAt).map((event) => event._id)
  );

  return (
    <div class="flex flex-col gap-4">
      <header class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="text-lg font-semibold text-slate-900">Household activity</h2>
          <p class="text-sm text-slate-500">Recent approvals, transfers, and guardrail updates.</p>
        </div>
        <Show when={unreadIds().length > 0 && props.onMarkAllRead}>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            class="self-start"
            disabled={props.isMarking}
            onClick={() => props.onMarkAllRead?.(unreadIds())}
          >
            Mark all read
          </Button>
        </Show>
      </header>
      <Show
        when={groups().length > 0}
        fallback={
          <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
            No activity yet.
          </div>
        }
      >
        <div class="flex flex-col gap-4">
          <For each={groups()}>
            {(group) => (
              <section class="flex flex-col gap-3">
                <h3 class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {group.label}
                </h3>
                <ol class="flex flex-col gap-3">
                  <For each={group.events}>
                    {(event) => {
                      const summary = summarizeEvent(event);
                      const unread = !event.receipt?.readAt;
                      return (
                        <li
                          class={`flex items-start gap-3 rounded-2xl border p-4 shadow-sm transition ${
                            unread
                              ? 'border-slate-900/40 bg-white'
                              : 'border-slate-200/60 bg-white/80'
                          }`}
                        >
                          <span
                            class={`mt-1 inline-flex size-2.5 rounded-full ${
                              unread ? 'bg-emerald-500' : 'bg-slate-300'
                            }`}
                            aria-hidden="true"
                          />
                          <div class="flex flex-col gap-1">
                            <p class="text-sm font-medium text-slate-900">{summary.title}</p>
                            <p class="text-xs text-slate-500">{summary.detail}</p>
                            <span class="text-xs text-slate-400">{summary.timestamp}</span>
                            <Show when={unread}>
                              <span class="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-600">
                                Unread
                              </span>
                            </Show>
                          </div>
                        </li>
                      );
                    }}
                  </For>
                </ol>
              </section>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

