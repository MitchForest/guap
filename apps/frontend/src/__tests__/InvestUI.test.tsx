import { fireEvent, render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';
import { InvestHero } from '../features/invest/components/InvestHero';
import { HoldingsTable } from '../features/invest/components/HoldingsTable';
import type { InvestmentPositionRecord } from '@guap/types';

vi.mock('../shared/components/ui/button', () => ({
  Button: (props: any) => <button {...props} />,
}));


describe('Invest UI smoke tests', () => {
  it('renders hero metrics and trend badge', () => {
    render(() => (
      <InvestHero
        totalCents={250_00}
        dailyChangeCents={25_00}
        changePercent={0.1}
        positionsCount={3}
        onCreateOrder={vi.fn()}
      />
    ));

    expect(screen.getByText('$250.00')).toBeInTheDocument();
    expect(screen.getByText(/up/)).toHaveTextContent('up');
    expect(screen.getByText(/3 active positions/i)).toBeInTheDocument();
  });

  it('wires trade callback from holdings table', () => {
    const onTrade = vi.fn();

    const position: InvestmentPositionRecord = {
      _id: 'pos-1',
      organizationId: 'org-1',
      accountId: 'acc-1',
      symbol: 'VTI',
      instrumentType: 'etf',
      quantity: 2.5,
      averageCost: { cents: 200_00, currency: 'USD' },
      marketValue: { cents: 250_00, currency: 'USD' },
      lastPrice: { cents: 100_00, currency: 'USD' },
      lastPricedAt: Date.now(),
      metadata: null,
      updatedAt: Date.now(),
    };

    render(() => (
      <HoldingsTable
        positions={[position]}
        snapshots={new Map([['VTI', { latest: 100_00, previous: 95_00, currency: 'USD' }]])}
        onTrade={onTrade}
      />
    ));

    fireEvent.click(screen.getByRole('button', { name: 'Trade' }));
    expect(onTrade).toHaveBeenCalledWith('VTI', 'etf');
  });
});
