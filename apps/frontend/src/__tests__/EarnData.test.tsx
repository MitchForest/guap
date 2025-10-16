import { describe, expect, it, vi } from 'vitest';
import { fetchIncomeStreams } from '../features/earn/api/client';

vi.mock('../shared/services/guapApi', () => ({
  guapApi: {
    earn: {
      listStreams: vi.fn(async () => [
        { _id: 'stream-1', organizationId: 'org-1', status: 'paused' } as any,
        { _id: 'stream-2', organizationId: 'org-1', status: 'active' } as any,
      ]),
    },
  },
}));

describe('fetchIncomeStreams', () => {
  it('returns streams regardless of status', async () => {
    const streams = await fetchIncomeStreams('org-1');
    expect(streams.length).toBe(2);
    expect(streams.some((stream) => stream.status === 'paused')).toBe(true);
  });
});
