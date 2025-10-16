import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent, screen } from '@solidjs/testing-library';
import type { EventJournalWithReceipt } from '@guap/api';
import { ActivityFeed, friendlyDayLabel, summarizeEvent } from '../features/app-shell/components/ActivityFeed';

const buildEvent = (
  overrides: Partial<EventJournalWithReceipt> = {}
): EventJournalWithReceipt => ({
  _id: overrides._id ?? 'evt-1',
  organizationId: overrides.organizationId ?? 'org-1',
  eventKind: overrides.eventKind ?? 'account_synced',
  actorProfileId: Object.prototype.hasOwnProperty.call(overrides, 'actorProfileId')
    ? overrides.actorProfileId ?? null
    : 'user-1',
  primaryEntity: overrides.primaryEntity ?? { table: 'financialAccounts', id: 'acc-1' },
  relatedEntities: overrides.relatedEntities ?? [],
  payload: overrides.payload ?? {},
  createdAt: overrides.createdAt ?? 1_700_000_000_000,
  receipt: overrides.receipt ?? null,
});

describe('summarizeEvent', () => {
  it('formats event title, detail, and timestamp', () => {
    const result = summarizeEvent(buildEvent());
    expect(result.title).toBe('Account synced');
    expect(result.detail).toBe('financialAccounts:acc-1 • by user-1');
    const expectedTimestamp = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    }).format(1_700_000_000_000);
    expect(result.timestamp).toBe(expectedTimestamp);
  });

  it('handles system actors gracefully', () => {
    const result = summarizeEvent(buildEvent({ actorProfileId: null, eventKind: 'transfer_approved' }));
    expect(result.detail).toContain('by system');
    expect(result.title).toBe('Transfer approved');
  });

  it('summarizes order events', () => {
    const result = summarizeEvent(
      buildEvent({
        eventKind: 'order_executed',
        payload: { symbol: 'VTI', side: 'buy', quantity: 2.5 },
      })
    );
    expect(result.title).toBe('Order executed for VTI');
    expect(result.detail).toContain('2.50 units');
    expect(result.detail).toContain('buy');
  });
});

describe('friendlyDayLabel', () => {
  it('returns Today for current day', () => {
    const now = Date.now();
    expect(friendlyDayLabel(now, now)).toBe('Today');
  });

  it('returns Yesterday for previous day', () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    expect(friendlyDayLabel(yesterday.getTime(), now.getTime())).toBe('Yesterday');
  });

  it('formats older dates with month and day', () => {
    const sample = new Date('2024-05-10T12:00:00Z');
    const label = friendlyDayLabel(sample.getTime(), new Date('2024-05-15T08:00:00Z').getTime());
    expect(label).toMatch(/May/);
  });
});

describe('ActivityFeed interactions', () => {
  it('invokes mark-all-read handler for unread events', () => {
    const unread = buildEvent({ _id: 'evt-unread', receipt: null });
    const read = buildEvent({
      _id: 'evt-read',
      receipt: { eventId: 'evt-read', deliveredAt: Date.now(), readAt: Date.now() },
    });
    const handler = vi.fn();

    render(() => <ActivityFeed events={[unread, read]} onMarkAllRead={handler} />);
    fireEvent.click(screen.getByRole('button', { name: /mark all read/i }));

    expect(handler).toHaveBeenCalledWith(['evt-unread']);
  });
});
