import { render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';
import { EarnHero } from '../features/earn/components/EarnHero';
import { EarnProjectionCard } from '../features/earn/components/EarnProjectionCard';

vi.mock('../shared/components/ui/button', () => ({
  Button: (props: any) => <button {...props} />,
}));

describe('Earn UI components', () => {
  it('renders hero summary stats', () => {
    render(() => (
      <EarnHero
        summary={{
          totalMonthlyCents: 8_000,
          activeStreams: 2,
          upcomingPayout: {
            streamId: 'stream-1',
            streamName: 'Allowance',
            scheduledAt: Date.UTC(2025, 0, 10),
            amount: { cents: 2_000, currency: 'USD' },
            autoScheduled: true,
          },
          streakLength: 4,
          lastCompletedAt: Date.UTC(2024, 11, 31),
          projections: [],
        }}
        streamsCount={2}
        loading={false}
        onCreateStream={vi.fn()}
        onRequestPayout={vi.fn()}
      />
    ));

    expect(screen.getByText('$80.00')).toBeInTheDocument();
    expect(screen.getByText(/Monthly inflow/i)).toBeInTheDocument();
    expect(screen.getByText(/4 approvals/i)).toBeInTheDocument();
  });

  it('lists projected payouts', () => {
    render(() => (
      <EarnProjectionCard
        projections={[
          {
            streamId: 'stream-1',
            streamName: 'Allowance',
            scheduledAt: Date.UTC(2025, 0, 5),
            amount: { cents: 2_000, currency: 'USD' },
            cadence: 'weekly',
            autoScheduled: true,
            allocations: [
              { nodeId: 'node-1', nodeName: 'Save', percentage: 60 },
              { nodeId: 'node-2', nodeName: 'Spend', percentage: 40 },
            ],
          },
        ]}
        loading={false}
      />
    ));

    expect(screen.getByText('Allowance')).toBeInTheDocument();
    expect(screen.getByText('$20.00')).toBeInTheDocument();
    expect(screen.getByText(/Auto/i)).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
  });
});
