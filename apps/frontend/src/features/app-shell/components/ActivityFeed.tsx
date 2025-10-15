import { For, type Component } from 'solid-js';
import type { EventJournalRecord } from '@guap/api';
import { formatCurrency } from '~/shared/utils/format';

type ActivityFeedProps = {
  events: EventJournalRecord[];
};

const friendlyDateTime = (timestamp: number) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).format(timestamp);

const summarizeTransferEvent = (event: EventJournalRecord) => {
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

export const summarizeEvent = (event: EventJournalRecord) => {
  const transferSummary = summarizeTransferEvent(event);
  if (transferSummary) {
    return {
      title: transferSummary.title,
      detail: transferSummary.detail,
      timestamp: friendlyDateTime(event.createdAt),
    };
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
