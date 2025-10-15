import { describe, expect, it } from 'vitest';
import type { EventJournalRecord } from '@guap/api';
import { summarizeEvent } from '../features/app-shell/components/ActivityFeed';

const buildEvent = (overrides: Partial<EventJournalRecord> = {}): EventJournalRecord => ({
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
